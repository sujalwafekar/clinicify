"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { subscribeClinicify } from "@/lib/firebase/realtime";
import type { Doctor, QueueState, Visit } from "@/lib/domain/types";

/* ── Helpers ───────────────────────────────────── */
export function getClinicNumber(doc: { room?: string; id?: string }): string {
  const match = (doc.room || "").match(/\d+/);
  if (match) return match[0];
  const idMatch = (doc.id || "").match(/\d+/);
  if (idMatch) return idMatch[0];
  return "1";
}

export function parseTokenNumber(token: string): { clinicNum: string; tokenSeq: string } {
  if (!token) return { clinicNum: "—", tokenSeq: "—" };
  const match = token.match(/^C(\d+)-(\d+)$/i);
  if (match) {
    return { clinicNum: match[1], tokenSeq: match[2] };
  }
  const seqMatch = token.match(/-(\d+)$/);
  if (seqMatch) {
    return { clinicNum: "1", tokenSeq: seqMatch[1] };
  }
  return { clinicNum: "1", tokenSeq: token };
}

const fmtTime = (ms: number | null | undefined) => {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

/* ── Sound Chime Effect ─────────────────────────── */
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    // Ignore audio permission restrictions
  }
}

/* ════════════════════════════════════════════════
   WAITING ROOM TV DISPLAY BOARD (100% REAL DATA)
   ════════════════════════════════════════════════ */
export function WaitingRoomDisplay({
  initialDoctors,
  initialVisits,
  isModal,
  onClose,
}: {
  initialDoctors?: Doctor[];
  initialVisits?: Visit[];
  isModal?: boolean;
  onClose?: () => void;
}) {
  const [liveState, setLiveState] = useState<QueueState>(() => ({
    doctors: initialDoctors ?? [],
    visits: initialVisits ?? [],
    events: [],
  }));

  const [loading, setLoading] = useState(!initialDoctors?.length && !initialVisits?.length);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const prevInConsultRef = useRef<string[]>([]);

  // 1. Fetch authoritative real database state from /api/waiting-room
  const fetchLive = async () => {
    try {
      const res = await fetch("/api/waiting-room", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { doctors: Doctor[]; visits: Visit[] };
      if (Array.isArray(data.doctors) && Array.isArray(data.visits)) {
        setLiveState(prev => {
          // Play chime if new patient is called
          const newInConsult = data.visits.filter(v => v.status === "in_consultation").map(v => v.id);
          const newlyCalled = newInConsult.find(id => !prevInConsultRef.current.includes(id));
          if (newlyCalled && soundEnabled && prevInConsultRef.current.length > 0) {
            playChime();
          }
          prevInConsultRef.current = newInConsult;
          return {
            doctors: data.doctors,
            visits: data.visits,
            events: prev.events,
          };
        });
      }
    } catch (e) {
      console.warn("[WaitingRoomDisplay] poll error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Poll real-time database every 10 seconds so public display always mirrors live mutations
  useEffect(() => {
    void fetchLive();
    const interval = setInterval(fetchLive, 10000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Also hook into client realtime listener if staff is logged in
  useEffect(() => {
    return subscribeClinicify(
      newState => {
        if (newState.doctors.length > 0 || newState.visits.length > 0) {
          setLiveState(newState);
          setLoading(false);
        }
      },
      { role: "receptionist" }
    );
  }, []);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Map real doctors to clinics
  const clinics = useMemo(() => {
    // If doctors collection has records, map each doctor
    const docs = liveState.doctors;

    return docs.map(docItem => {
      const clinicNum = getClinicNumber(docItem);
      const activeVisit = liveState.visits.find(
        v => v.doctorId === docItem.id && v.status === "in_consultation"
      );
      const parsed = activeVisit ? parseTokenNumber(activeVisit.token) : null;
      return {
        doctor: docItem,
        clinicNum,
        activeVisit,
        tokenSeq: parsed ? parsed.tokenSeq : "—",
        fullToken: activeVisit ? activeVisit.token : "—",
      };
    }).sort((a, b) => Number(a.clinicNum) - Number(b.clinicNum));
  }, [liveState.doctors, liveState.visits]);

  // Pair up clinics for the 2-column layout (TOKEN | CLINIC | TOKEN | CLINIC)
  const pairedRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < clinics.length; i += 2) {
      rows.push({
        left: clinics[i],
        right: clinics[i + 1] || null,
      });
    }
    return rows;
  }, [clinics]);

  // Real waiting queue sequence (status === "waiting" only)
  const waitingSequence = useMemo(() => {
    return liveState.visits
      .filter(v => v.status === "waiting")
      .map((v, idx) => {
        const docItem = liveState.doctors.find(d => d.id === v.doctorId);
        const clinicNum = docItem ? getClinicNumber(docItem) : "1";
        const parsed = parseTokenNumber(v.token);
        return {
          visit: v,
          seqNumber: idx + 1,
          tokenSeq: parsed.tokenSeq,
          fullToken: v.token,
          clinicNum,
          doctorName: docItem?.name || "Doctor",
          room: docItem?.room || `Clinic ${clinicNum}`,
          department: docItem?.department || "General",
        };
      });
  }, [liveState.visits, liveState.doctors]);

  return (
    <div className={`waiting-room-tv-screen ${isModal ? "modal-mode" : ""}`}>
      {/* ── TOP UTILITY STRIP ── */}
      <div className="tv-utility-strip">
        <div className="tv-brand">
          <span className="tv-brand-icon">✚</span>
          <span>CLINICIFY OPD · WAITING ROOM QUEUE MONITOR</span>
        </div>
        <div className="tv-meta-controls">
          <div className="tv-live-pill">
            <span className="tv-pulse-dot" />
            LIVE DATABASE
          </div>
          <div className="tv-clock">{currentTime}</div>
          <button
            className="tv-icon-btn"
            title={soundEnabled ? "Mute Chime" : "Enable Chime"}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? "🔔" : "🔕"}
          </button>
          {!isModal && (
            <button className="tv-icon-btn" title="Toggle Fullscreen" onClick={toggleFullscreen}>
              {isFullscreen ? "🗗" : "⛶"}
            </button>
          )}
          {isModal && onClose && (
            <button className="tv-close-btn" onClick={onClose} title="Close Display">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN DISPLAY BOARD: EXACT REPLICA OF USER PHOTO ── */}
      <div className="tokens-called-board">
        {/* Main Blue Banner */}
        <div className="tokens-called-banner">
          <h1>TOKENS CALLED</h1>
        </div>

        {/* 4-Column Table Header: TOKEN | CLINIC | TOKEN | CLINIC */}
        <div className="tokens-grid-header">
          <div className="th-cell th-token">TOKEN</div>
          <div className="th-cell th-clinic">CLINIC</div>
          <div className="th-divider-col" />
          <div className="th-cell th-token">TOKEN</div>
          <div className="th-cell th-clinic">CLINIC</div>
        </div>

        {/* Alternating Data Rows */}
        <div className="tokens-grid-body">
          {loading && clinics.length === 0 ? (
            <div className="tokens-empty-row">
              <span className="btn-spinner dark" style={{ marginRight: 10 }} />
              Connecting to live hospital database…
            </div>
          ) : pairedRows.length === 0 ? (
            <div className="tokens-empty-row">No consultation rooms currently registered in hospital.</div>
          ) : (
            pairedRows.map((pair, idx) => (
              <div key={idx} className={`tokens-grid-row ${idx % 2 === 0 ? "row-even" : "row-odd"}`}>
                {/* Left Clinic Pair */}
                <div className="td-cell td-token">
                  <span className={`token-digits ${pair.left.tokenSeq !== "—" ? "active-token" : ""}`}>
                    {pair.left.tokenSeq}
                  </span>
                </div>
                <div className="td-cell td-clinic">
                  <span className="clinic-digits">{pair.left.clinicNum}</span>
                </div>

                <div className="td-divider-col" />

                {/* Right Clinic Pair */}
                {pair.right ? (
                  <>
                    <div className="td-cell td-token">
                      <span className={`token-digits ${pair.right.tokenSeq !== "—" ? "active-token" : ""}`}>
                        {pair.right.tokenSeq}
                      </span>
                    </div>
                    <div className="td-cell td-clinic">
                      <span className="clinic-digits">{pair.right.clinicNum}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="td-cell td-token"><span className="token-digits">—</span></div>
                    <div className="td-cell td-clinic"><span className="clinic-digits">—</span></div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>


      {/* ── FOOTER INFORMATION STRIP ── */}
      <div className="tv-footer-ticker">
        <div className="ticker-label">NOTICE:</div>
        <div className="ticker-text">
          Please proceed to your assigned clinic room when your token number is displayed above. All tokens follow a sequential numbering system.
        </div>
      </div>
    </div>
  );
}

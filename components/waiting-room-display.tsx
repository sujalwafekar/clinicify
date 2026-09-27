"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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

  // Robust cross-browser fullscreen toggle
  const toggleFullscreen = () => {
    try {
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      const isFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFs) {
        const req =
          docEl.requestFullscreen ||
          docEl.webkitRequestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.msRequestFullscreen;
        if (req) {
          req.call(docEl)
            ?.then(() => setIsFullscreen(true))
            ?.catch((err: unknown) => console.warn("Fullscreen request error:", err));
        }
      } else {
        const exit =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;
        if (exit) {
          exit.call(doc)
            ?.then(() => setIsFullscreen(false))
            ?.catch((err: unknown) => console.warn("Exit fullscreen error:", err));
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  // Synchronize fullscreen state from browser events
  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      setIsFullscreen(
        !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement)
      );
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    document.addEventListener("MSFullscreenChange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("mozfullscreenchange", handleFsChange);
      document.removeEventListener("MSFullscreenChange", handleFsChange);
    };
  }, []);

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

  const router = useRouter();

  const handleBack = () => {
    // If browser is currently in fullscreen, exit fullscreen first
    const doc = document as unknown as {
      fullscreenElement?: Element;
      webkitFullscreenElement?: Element;
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void>;
    };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) {
        exit.call(doc)?.catch(() => {});
      }
    }

    if (isModal && onClose) {
      onClose();
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1 && document.referrer) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: "#ffffff",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: "relative",
    }}>
      {/* ── Top Left Action Bar: Back & Fullscreen ── */}
      <div style={{
        position: "absolute",
        top: 14,
        left: 14,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        {/* Back Button */}
        <button
          onClick={handleBack}
          style={{
            background: "#1565c0",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 10px rgba(21,101,192,0.35)",
            letterSpacing: "0.02em",
            opacity: 0.9,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.background = "#0d47a1";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "0.9";
            e.currentTarget.style.background = "#1565c0";
          }}
        >
          ← Back
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen (F11)"}
          style={{
            background: "#1565c0",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 10px rgba(21,101,192,0.35)",
            letterSpacing: "0.02em",
            opacity: 0.9,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.background = "#0d47a1";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "0.9";
            e.currentTarget.style.background = "#1565c0";
          }}
        >
          <span style={{ fontSize: 16 }}>{isFullscreen ? "🗗" : "⛶"}</span>
          <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
        </button>
      </div>
      {/* ── MAIN TOKEN BOARD ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Banner */}
        <div style={{
          background: "#1565c0",
          color: "#ffffff",
          textAlign: "center",
          padding: "18px 24px",
          fontSize: "clamp(18px, 3vw, 32px)",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          TOKENS CALLED
        </div>

        {/* 4-Column Header: TOKEN | CLINIC | TOKEN | CLINIC */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 4px 1fr 1fr",
          background: "#1976d2",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "clamp(13px, 2vw, 22px)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          <div style={{ padding: "12px 16px", textAlign: "center" }}>TOKEN</div>
          <div style={{ padding: "12px 16px", textAlign: "center" }}>CLINIC</div>
          <div style={{ background: "#1565c0" }} />
          <div style={{ padding: "12px 16px", textAlign: "center" }}>TOKEN</div>
          <div style={{ padding: "12px 16px", textAlign: "center" }}>CLINIC</div>
        </div>

        {/* Rows */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {loading && clinics.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#1565c0", fontSize: 22, gap: 12 }}>
              <span className="btn-spinner dark" />
              Connecting to live database…
            </div>
          ) : pairedRows.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 22 }}>
              No consultation rooms currently active.
            </div>
          ) : (
            pairedRows.map((pair, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 4px 1fr 1fr",
                  flex: 1,
                  background: idx % 2 === 0 ? "#e3f2fd" : "#bbdefb",
                  borderBottom: "1px solid #90caf9",
                  minHeight: 0,
                }}
              >
                {/* Left Token */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{
                    fontSize: "clamp(28px, 6vw, 80px)",
                    fontWeight: 900,
                    color: pair.left.tokenSeq !== "—" ? "#0d47a1" : "#90caf9",
                    letterSpacing: "0.04em",
                  }}>{pair.left.tokenSeq}</span>
                </div>
                {/* Left Clinic */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{
                    fontSize: "clamp(32px, 7vw, 96px)",
                    fontWeight: 900,
                    color: "#1565c0",
                  }}>{pair.left.clinicNum}</span>
                </div>

                {/* Divider */}
                <div style={{ background: "#1565c0" }} />

                {/* Right Token */}
                {pair.right ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{
                        fontSize: "clamp(28px, 6vw, 80px)",
                        fontWeight: 900,
                        color: pair.right.tokenSeq !== "—" ? "#0d47a1" : "#90caf9",
                        letterSpacing: "0.04em",
                      }}>{pair.right.tokenSeq}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{
                        fontSize: "clamp(32px, 7vw, 96px)",
                        fontWeight: 900,
                        color: "#1565c0",
                      }}>{pair.right.clinicNum}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "clamp(28px, 6vw, 80px)", fontWeight: 900, color: "#90caf9" }}>—</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "clamp(32px, 7vw, 96px)", fontWeight: 900, color: "#90caf9" }}>—</span>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

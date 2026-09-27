"use client";
import { useEffect, useRef, useState } from "react";

const fmt = (v: number | null) =>
  v
    ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(v)
    : "—";

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  in_consultation: "In Consultation",
  done: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  waiting: "#1565c0",
  in_consultation: "#15803d",
  done: "#555",
  cancelled: "#b91c1c",
};

type PublicVisit = {
  token: string;
  status: string;
  etaLower: number | null;
  etaUpper: number | null;
  recommendedArrival: number | null;
  doctor: string;
  patientsAhead: number;
  updatedAt: number;
  lastEtaUpdateReason?: string;
  estimatedDurationMin?: number;
  durationSource?: string;
};

const durationLabel = (visit: PublicVisit) => {
  if (!visit.estimatedDurationMin) return null;
  const src = visit.durationSource;
  const label =
    src === "doctor_category"
      ? `Based on ${visit.doctor}'s history for this visit type`
      : src === "doctor_overall"
        ? `Based on ${visit.doctor}'s overall pattern`
        : src === "global_category"
          ? "Based on clinic-wide averages"
          : "Standard estimate";
  return { mins: visit.estimatedDurationMin, label };
};

export default function TrackingPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const [key, setKey] = useState<string>();
  const [visit, setVisit] = useState<PublicVisit>();
  const [error, setError] = useState("");
  const [movement, setMovement] = useState("");
  const previous = useRef<number | undefined>(undefined);

  useEffect(() => {
    void params.then((v) => setKey(v.key));
  }, [params]);

  useEffect(() => {
    if (!key) return;
    const load = () =>
      fetch(`/api/track/${key}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("This tracking link is unavailable.");
          return r.json() as Promise<PublicVisit>;
        })
        .then((v) => {
          if (previous.current && v.etaLower && previous.current !== v.etaLower) {
            setMovement(
              v.etaLower < previous.current
                ? "Your expected time moved earlier."
                : "Your expected time moved later.",
            );
          }
          previous.current = v.etaLower ?? undefined;
          setVisit(v);
          setError("");
        })
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Unable to refresh your visit."),
        );
    void load();
    const id = window.setInterval(load, 10_000);
    return () => window.clearInterval(id);
  }, [key]);

  /* ── shell ── */
  const shell = (children: React.ReactNode) => (
    <div style={{
      minHeight: "100vh",
      background: "#f7f9fc",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#1a2535",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* top bar */}
      <div style={{
        borderBottom: "1px solid #e4e9f0",
        background: "#ffffff",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{
          fontSize: 18,
          fontWeight: 800,
          color: "#1565c0",
          letterSpacing: "-0.02em",
        }}>✚ Clinicify</span>
        <span style={{
          marginLeft: "auto",
          fontSize: 12,
          color: "#64748b",
          background: "#f0f4ff",
          border: "1px solid #dbe5ff",
          borderRadius: 20,
          padding: "3px 10px",
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}>LIVE QUEUE</span>
      </div>
      {/* body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px 64px" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
      </div>
    </div>
  );

  if (!visit && !error) return shell(
    <p style={{ color: "#64748b", textAlign: "center", marginTop: 60, fontSize: 15 }}>
      Loading your visit…
    </p>
  );

  if (error && !visit) return shell(
    <div style={{ textAlign: "center", marginTop: 60 }}>
      <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Link unavailable</p>
      <p style={{ color: "#64748b", fontSize: 14 }}>{error}</p>
    </div>
  );

  const dur = visit ? durationLabel(visit) : null;
  const statusKey = visit!.status in STATUS_LABEL ? visit!.status : "waiting";
  const statusColor = STATUS_COLOR[statusKey] ?? "#1565c0";
  const isDone = visit!.status === "done" || visit!.status === "cancelled";

  return shell(
    <>
      {/* Token */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>
          Your Token
        </p>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1565c0",
          color: "#fff",
          fontSize: 40,
          fontWeight: 900,
          letterSpacing: "0.04em",
          borderRadius: 16,
          padding: "14px 36px",
          boxShadow: "0 4px 20px rgba(21,101,192,0.2)",
        }}>
          {visit!.token}
        </div>
        <p style={{ fontSize: 14, color: "#475569", marginTop: 10 }}>
          with <strong style={{ color: "#1a2535" }}>{visit!.doctor}</strong>
        </p>
      </div>

      {/* Status pill */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 24,
      }}>
        <span style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: statusColor,
          boxShadow: isDone ? "none" : `0 0 0 3px ${statusColor}33`,
          animation: isDone ? "none" : "pulse 1.6s ease infinite",
        }} />
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", color: statusColor, textTransform: "uppercase" }}>
          {STATUS_LABEL[statusKey] ?? statusKey.replace("_", " ")}
        </span>
      </div>

      {/* ETA card */}
      {!isDone && (
        <div style={{
          background: "#fff",
          border: "1px solid #e4e9f0",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
            Expected Consultation
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#1a2535", margin: "0 0 4px" }}>
            {fmt(visit!.etaLower)} – {fmt(visit!.etaUpper)}
          </p>
          {visit!.recommendedArrival && (
            <p style={{ fontSize: 13, color: "#64748b" }}>
              Arrive by <strong style={{ color: "#1565c0" }}>{fmt(visit!.recommendedArrival)}</strong>
            </p>
          )}
        </div>
      )}

      {/* Patients ahead + duration */}
      <div style={{ display: "grid", gridTemplateColumns: dur ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
        <div style={{
          background: "#fff",
          border: "1px solid #e4e9f0",
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
            Ahead of you
          </p>
          <p style={{ fontSize: 32, fontWeight: 900, color: "#1565c0", margin: 0 }}>
            {visit!.patientsAhead}
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>patients</p>
        </div>

        {dur && (
          <div style={{
            background: "#fff",
            border: "1px solid #e4e9f0",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
              Est. Duration
            </p>
            <p style={{ fontSize: 32, fontWeight: 900, color: "#1a2535", margin: 0 }}>
              ~{dur.mins}
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>minutes</p>
          </div>
        )}
      </div>

      {/* Queue note */}
      <div style={{
        background: "#f0f4ff",
        border: "1px solid #dbe5ff",
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 13,
        color: "#334155",
        marginBottom: 20,
        lineHeight: 1.5,
      }}>
        {visit!.lastEtaUpdateReason === "PRIORITY_INSERTION"
          ? "⚡ Queue adjusted for an emergency priority case."
          : movement
            ? `↻ ${movement}`
            : "↻ Queue updates live every few seconds."}
        {" "}Your position is updated privately — no other patient details are shared.
      </div>

      {/* Footer */}
      <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
        {error
          ? `⚠ ${error} Retrying…`
          : `Last updated ${fmt(visit!.updatedAt)}`}
      </p>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

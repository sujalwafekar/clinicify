"use client";
import { useEffect, useRef, useState } from "react";

const time = (v: number | null) =>
  v
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      }).format(v)
    : "Updating";

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
    void params.then((value) => setKey(value.key));
  }, [params]);

  useEffect(() => {
    if (!key) return;

    const load = () =>
      fetch(`/api/track/${key}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("This tracking link is unavailable.");
          return r.json() as Promise<PublicVisit>;
        })
        .then((value) => {
          if (
            previous.current &&
            value.etaLower &&
            previous.current !== value.etaLower
          ) {
            setMovement(
              value.etaLower < previous.current
                ? "Your expected time moved earlier."
                : "Your expected time moved later.",
            );
          }
          previous.current = value.etaLower ?? undefined;
          setVisit(value);
          setError("");
        })
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Unable to refresh your visit.",
          ),
        );

    void load();
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
  }, [key]);

  if (error && !visit) {
    return (
      <main className="tracking">
        <main>
          <p className="eyebrow">Clinicify</p>
          <h1>Tracking unavailable</h1>
          <p>{error}</p>
        </main>
      </main>
    );
  }

  if (!visit) {
    return (
      <main className="tracking">
        <main>
          <p className="eyebrow">Clinicify</p>
          <h1>Loading your secure visit…</h1>
        </main>
      </main>
    );
  }

  return (
    <main className="tracking">
      <header>
        <a className="brand" href="/">
          <span>✚</span> CLINICIFY
        </a>
        <button>Live queue tracking</button>
      </header>
      <main>
        <p className="eyebrow">Your OPD visit</p>
        <h1>{visit.token}</h1>
        <p className="tracking-doctor">{visit.doctor}</p>

        <div className="track-status">
          <span className="pulse" /> QUEUE STATUS ·{" "}
          {visit.status.replace("_", " ")}
        </div>

        <section className="eta-card">
          <p>Expected consultation</p>
          <h2>
            {time(visit.etaLower)} – {time(visit.etaUpper)}
          </h2>
          <span>
            Recommended arrival <b>{time(visit.recommendedArrival)}</b>
          </span>
        </section>

        <div className="progress">
          <div>
            <span>Patients ahead</span>
            <b>{visit.patientsAhead}</b>
          </div>
          <small>
            Your position updates without showing other patient details.
          </small>
        </div>

        {visit.estimatedDurationMin && (
          <section className="eta-card" style={{ marginTop: "0.75rem" }}>
            <p>Estimated consultation duration</p>
            <h2>~{visit.estimatedDurationMin} min</h2>
            <span>
              {visit.durationSource === "doctor_category"
                ? `Based on ${visit.doctor}'s history for this visit type`
                : visit.durationSource === "doctor_overall"
                  ? `Based on ${visit.doctor}'s overall consultation pattern`
                  : visit.durationSource === "global_category"
                    ? "Based on clinic-wide averages for this visit type"
                    : "Standard estimate"}
            </span>
          </section>
        )}

        <aside className="priority-note">
          <b>
            {visit.lastEtaUpdateReason === "PRIORITY_INSERTION"
              ? "Queue adjusted for emergency priority case"
              : movement || "Queue updates live"}
          </b>
          <p>
            A priority case may adjust your time, but no other patient
            information is ever shown.
          </p>
        </aside>

        {error ? (
          <p className="form-error">{error} Retrying automatically.</p>
        ) : (
          <p className="last-updated">
            Last updated {time(visit.updatedAt)} · checks every few seconds.
          </p>
        )}
      </main>
    </main>
  );
}

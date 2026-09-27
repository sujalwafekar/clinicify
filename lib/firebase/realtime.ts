"use client";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "./client";
import type { Doctor, QueueEvent, QueueState, Role, Visit } from "@/lib/domain/types";

const millis = (value: unknown) =>
  typeof value === "object" && value !== null && "toMillis" in value && typeof (value as any).toMillis === "function"
    ? (value as any).toMillis()
    : typeof value === "number"
    ? value
    : undefined;

export function subscribeClinicify(
  onState: (state: QueueState) => void,
  access: { role: Role; doctorId?: string }
) {
  let doctors: Doctor[] = [];
  let visits: Visit[] = [];
  let events: QueueEvent[] = [];

  const publish = () => onState({ doctors, visits, events });

  // 1. Polling fallback against authoritative database /api/realtime-state
  let isMounted = true;
  const pollServer = async () => {
    try {
      const url = `/api/realtime-state?role=${encodeURIComponent(access.role)}${
        access.doctorId ? `&doctorId=${encodeURIComponent(access.doctorId)}` : ""
      }`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (isMounted && data && Array.isArray(data.doctors) && Array.isArray(data.visits)) {
        doctors = data.doctors;
        visits = data.visits;
        events = data.events || [];
        publish();
      }
    } catch {
      // Ignore polling errors
    }
  };

  void pollServer();
  const pollInterval = setInterval(pollServer, 3000);

  // 2. Client onSnapshot listeners (when Firebase security rules allow)
  const unsubs: Array<() => void> = [];

  try {
    const unsubDoc = onSnapshot(
      collection(firestore, "doctors"),
      snapshot => {
        if (!snapshot.empty) {
          doctors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Doctor));
          publish();
        }
      },
      () => {
        // Ignored on permission failure, polling handles it
      }
    );
    unsubs.push(unsubDoc);
  } catch {
    // Ignore
  }

  if (access.role !== "pharmacist") {
    try {
      const visitQuery =
        access.role === "doctor" && access.doctorId
          ? query(collection(firestore, "visits"), where("doctorId", "==", access.doctorId))
          : collection(firestore, "visits");

      const unsubVisit = onSnapshot(
        visitQuery,
        snapshot => {
          if (!snapshot.empty) {
            visits = snapshot.docs.map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                patientId: d.patientId,
                patientName: d.patientName ?? "Patient",
                age: d.age ?? 0,
                mobile: d.mobile,
                token: d.token,
                doctorId: d.doctorId,
                complaint: d.complaintText ?? "General consultation",
                complaintCategory: d.complaintCategory,
                priorityLevel: d.priorityLevel ?? 0,
                priorityInsertedAt: millis(d.priorityInsertedAt),
                sequenceNumber: d.sequenceNumber ?? 0,
                status: d.status,
                predictedDuration: d.predictedDurationMin ?? 8,
                etaLower: millis(d.etaLower),
                etaUpper: millis(d.etaUpper),
                recommendedArrival: millis(d.recommendedArrival),
                registeredAt: millis(d.registeredAt),
                consultationStartedAt: millis(d.consultationStartedAt),
                consultationEndedAt: millis(d.consultationEndedAt),
                actualDuration: d.actualDurationMin,
                etaRevisionCount: d.etaRevisionCount ?? 0,
                predictionErrorMin: d.predictionErrorMin,
              } as Visit;
            });
            publish();
          }
        },
        () => {
          // Ignored on permission failure, polling handles it
        }
      );
      unsubs.push(unsubVisit);
    } catch {
      // Ignore
    }
  }

  if (access.role !== "doctor" && access.role !== "pharmacist") {
    try {
      const unsubEvents = onSnapshot(
        collection(firestore, "queueEvents"),
        snapshot => {
          if (!snapshot.empty) {
            events = snapshot.docs.map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                type: d.eventType,
                doctorId: d.doctorId ?? "",
                visitId: d.visitId ?? "",
                createdAt: millis(d.createdAt) ?? Date.now(),
                actor: d.actorUid ?? "",
              } as QueueEvent;
            });
            publish();
          }
        },
        () => {
          // Ignored on permission failure, polling handles it
        }
      );
      unsubs.push(unsubEvents);
    } catch {
      // Ignore
    }
  }

  return () => {
    isMounted = false;
    clearInterval(pollInterval);
    unsubs.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch {
        // Ignore
      }
    });
  };
}

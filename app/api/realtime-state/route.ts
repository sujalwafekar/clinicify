import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getLocalDb } from "@/lib/server/local-db";
import type { Doctor, QueueEvent, Visit } from "@/lib/domain/types";
import { getCachedState, getLastKnownState, setCachedState } from "@/lib/server/realtime-cache";
import type { CachedState } from "@/lib/server/realtime-cache";

const millis = (value: unknown): number | undefined => {
  if (typeof value === "object" && value !== null && "toMillis" in value && typeof (value as any).toMillis === "function") {
    return (value as any).toMillis();
  }
  if (typeof value === "number") return value;
  return undefined;
};

// ── Server-side in-memory cache to prevent quota exhaustion ──────────
const CACHE_TTL_MS = 5_000; // 5 seconds cache to conserve database reads

async function getStateFromLocalDb(): Promise<CachedState> {
  const db = getLocalDb();
  const doctorsSnap = await db.collection("doctors").get();
  const doctors: Doctor[] = doctorsSnap.docs.map((doc: any) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name ?? "Doctor",
      department: d.department ?? "General Medicine",
      departmentId: d.departmentId,
      room: d.room ?? "Room 1",
      status: d.status ?? "available",
      currentVisitId: d.currentVisitId ?? null,
      averageDuration: Number(d.averageDuration) || 9,
    };
  });

  const visitsSnap = await db.collection("visits")
    .where("status", "in", ["waiting", "in_consultation"])
    .get();

  const allVisits: Visit[] = visitsSnap.docs.map((doc: any) => {
    const d = doc.data();
    return {
      id: doc.id,
      patientId: d.patientId ?? "",
      patientName: d.patientName ?? "Patient",
      age: Number(d.age) || 0,
      gender: d.gender,
      mobile: d.mobile,
      token: d.token ?? "",
      doctorId: d.doctorId ?? "",
      complaint: d.complaintText ?? d.complaint ?? "General consultation",
      complaintCategory: d.complaintCategory ?? "general",
      priorityLevel: d.priorityLevel ?? 0,
      priorityInsertedAt: millis(d.priorityInsertedAt),
      sequenceNumber: d.sequenceNumber ?? 0,
      status: d.status ?? "waiting",
      predictedDuration: Number(d.predictedDurationMin) || 8,
      etaLower: millis(d.etaLower),
      etaUpper: millis(d.etaUpper),
      recommendedArrival: millis(d.recommendedArrival),
      registeredAt: millis(d.registeredAt),
      consultationStartedAt: millis(d.consultationStartedAt),
      consultationEndedAt: millis(d.consultationEndedAt),
      actualDuration: d.actualDurationMin,
      etaRevisionCount: typeof d.etaRevisionCount === "number" ? d.etaRevisionCount : 0,
      predictionErrorMin: d.predictionErrorMin,
    };
  });

  allVisits.sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

  const doctorVisits = new Map<string, Visit[]>();
  for (const v of allVisits) {
    const existing = doctorVisits.get(v.doctorId) || [];
    existing.push(v);
    doctorVisits.set(v.doctorId, existing);
  }

  const eventsSnap = await db.collection("queueEvents")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const events: QueueEvent[] = eventsSnap.docs.map((doc: any) => {
    const d = doc.data();
    return {
      id: doc.id,
      type: d.eventType ?? "",
      doctorId: d.doctorId ?? "",
      visitId: d.visitId ?? "",
      createdAt: millis(d.createdAt) ?? Date.now(),
      actor: d.actorUid ?? "",
    };
  });

  const state: CachedState = {
    doctors,
    allVisits,
    doctorVisits,
    events,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  setCachedState(state);
  return state;
}

let firestoreQuotaExceededUntil = 0;

async function getState(): Promise<CachedState> {
  const cached = getCachedState();
  if (cached) return cached;

  if (Date.now() < firestoreQuotaExceededUntil) {
    const lastKnown = getLastKnownState();
    if (lastKnown && lastKnown.doctors.length > 0) {
      return {
        ...lastKnown,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
    }
    return getStateFromLocalDb();
  }

  try {
    const db = adminDb();

    // 1. Doctors (usually 2-5 docs — cheap)
    const doctorsSnap = await db.collection("doctors").get();
    const doctors: Doctor[] = doctorsSnap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name ?? "Doctor",
        department: d.department ?? "General Medicine",
        departmentId: d.departmentId,
        room: d.room ?? "Room 1",
        status: d.status ?? "available",
        currentVisitId: d.currentVisitId ?? null,
        averageDuration: Number(d.averageDuration) || 9,
      };
    });

    // 2. Visits — only fetch ACTIVE ones to save quota
    const visitsSnap = await db.collection("visits")
      .where("status", "in", ["waiting", "in_consultation"])
      .get();

    const allVisits: Visit[] = visitsSnap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        patientId: d.patientId ?? "",
        patientName: d.patientName ?? "Patient",
        age: Number(d.age) || 0,
        gender: d.gender,
        mobile: d.mobile,
        token: d.token ?? "",
        doctorId: d.doctorId ?? "",
        complaint: d.complaintText ?? d.complaint ?? "General consultation",
        complaintCategory: d.complaintCategory ?? "general",
        priorityLevel: d.priorityLevel ?? 0,
        priorityInsertedAt: millis(d.priorityInsertedAt),
        sequenceNumber: d.sequenceNumber ?? 0,
        status: d.status ?? "waiting",
        predictedDuration: Number(d.predictedDurationMin) || 8,
        etaLower: millis(d.etaLower),
        etaUpper: millis(d.etaUpper),
        recommendedArrival: millis(d.recommendedArrival),
        registeredAt: millis(d.registeredAt),
        consultationStartedAt: millis(d.consultationStartedAt),
        consultationEndedAt: millis(d.consultationEndedAt),
        actualDuration: d.actualDurationMin,
        etaRevisionCount: typeof d.etaRevisionCount === "number" ? d.etaRevisionCount : 0,
        predictionErrorMin: d.predictionErrorMin,
      };
    });

    // Sort by sequence number
    allVisits.sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

    // Pre-build per-doctor lookup
    const doctorVisits = new Map<string, Visit[]>();
    for (const v of allVisits) {
      const existing = doctorVisits.get(v.doctorId) || [];
      existing.push(v);
      doctorVisits.set(v.doctorId, existing);
    }

    // 3. QueueEvents — limit to last 20 to save reads
    const eventsSnap = await db.collection("queueEvents")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const events: QueueEvent[] = eventsSnap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.eventType ?? "",
        doctorId: d.doctorId ?? "",
        visitId: d.visitId ?? "",
        createdAt: millis(d.createdAt) ?? Date.now(),
        actor: d.actorUid ?? "",
      };
    });

    const state: CachedState = {
      doctors,
      allVisits,
      doctorVisits,
      events,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    setCachedState(state);
    return state;
  } catch (err) {
    if (err instanceof Error && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("Quota exceeded"))) {
      firestoreQuotaExceededUntil = Date.now() + 5 * 60 * 1000;
    }
    console.warn("[RealtimeState] Firestore read fallback to local state (quota/network):", err instanceof Error ? err.message : err);
    const lastKnown = getLastKnownState();
    if (lastKnown && lastKnown.doctors.length > 0) {
      return {
        ...lastKnown,
        expiresAt: Date.now() + 5_000,
      };
    }
    return getStateFromLocalDb();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const doctorId = searchParams.get("doctorId");

    const state = await getState();

    // For doctors, return only their own visits
    const visits = (role === "doctor" && doctorId)
      ? (state.doctorVisits.get(doctorId) ?? [])
      : state.allVisits;

    return NextResponse.json(
      { doctors: state.doctors, visits, events: state.events },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    // Ultimate safety fallback: never return 500 when we can return local-db state
    try {
      const localState = await getStateFromLocalDb();
      return NextResponse.json({ doctors: localState.doctors, visits: localState.allVisits, events: localState.events });
    } catch {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to load realtime state" },
        { status: 500 }
      );
    }
  }
}

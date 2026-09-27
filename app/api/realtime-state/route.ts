import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { Doctor, QueueEvent, Visit } from "@/lib/domain/types";

const millis = (value: unknown): number | undefined => {
  if (typeof value === "object" && value !== null && "toMillis" in value && typeof (value as any).toMillis === "function") {
    return (value as any).toMillis();
  }
  if (typeof value === "number") return value;
  return undefined;
};

// ── Server-side in-memory cache to prevent quota exhaustion ──────────
// Multiple clients polling every few seconds will share this single cache
// instead of each triggering fresh Firestore reads.
interface CachedState {
  doctors: Doctor[];
  allVisits: Visit[];       // active visits only (waiting + in_consultation)
  doctorVisits: Map<string, Visit[]>; // pre-filtered by doctorId
  events: QueueEvent[];
  expiresAt: number;
}
let cachedState: CachedState | null = null;
const CACHE_TTL_MS = 3_000; // 3 seconds — fresh enough for a clinic, saves 95%+ reads

async function getState(): Promise<CachedState> {
  if (cachedState && cachedState.expiresAt > Date.now()) {
    return cachedState;
  }

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

  cachedState = {
    doctors,
    allVisits,
    doctorVisits,
    events,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return cachedState;
}

// Allow other server code to bust the cache after mutations (register, call-next, complete, etc.)
export function invalidateRealtimeCache() {
  cachedState = null;
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load realtime state" },
      { status: 500 }
    );
  }
}

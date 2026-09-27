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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const doctorId = searchParams.get("doctorId");

    const db = adminDb();

    // 1. Doctors
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

    // 2. Visits
    let visitsSnap;
    if (role === "doctor" && doctorId) {
      visitsSnap = await db.collection("visits").where("doctorId", "==", doctorId).get();
    } else {
      visitsSnap = await db.collection("visits").get();
    }

    const visits: Visit[] = visitsSnap.docs.map((doc: any) => {
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

    // Sort visits by sequenceNumber
    visits.sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

    // 3. QueueEvents
    const eventsSnap = await db.collection("queueEvents").get();
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

    return NextResponse.json(
      { doctors, visits, events },
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

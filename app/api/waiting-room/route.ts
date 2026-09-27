import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import type { Doctor, Visit } from "@/lib/domain/types";

const millis = (value: unknown): number | undefined => {
  if (typeof value === "object" && value !== null && "toMillis" in value && typeof (value as any).toMillis === "function") {
    return (value as any).toMillis();
  }
  if (typeof value === "number") return value;
  return undefined;
};

export async function GET() {
  try {
    const db = adminDb();

    // 1. Fetch doctors
    const doctorsSnap = await db.collection("doctors").get();
    const doctors: Doctor[] = doctorsSnap.docs.map(doc => {
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

    // 2. Fetch visits (real records only)
    const visitsSnap = await db.collection("visits").orderBy("sequenceNumber", "asc").get();
    const visits: Visit[] = visitsSnap.docs.map(doc => {
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
        etaRevisionCount: d.etaRevisionCount ?? 0,
        predictionErrorMin: d.predictionErrorMin,
      };
    });

    return NextResponse.json(
      { doctors, visits },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load waiting room queue" },
      { status: 500 }
    );
  }
}

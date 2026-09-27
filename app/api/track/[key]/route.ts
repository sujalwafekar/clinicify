import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getPatientsAhead } from "@/lib/server/queue-service";
import { predictDuration } from "@/lib/server/duration-model";

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const hit = await adminDb().collection("visits").where("trackingKey", "==", key).limit(1).get();
  const visit = hit.docs[0]?.data();
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  const doctor = await adminDb().collection("doctors").doc(visit.doctorId).get();
  const date = (v: { toMillis?: () => number } | undefined) => v?.toMillis?.() ?? null;
  
  const ahead = await getPatientsAhead(visit.doctorId, hit.docs[0].id, visit.priorityLevel ?? 0, visit.sequenceNumber ?? 0);
  
  // Get model-predicted consultation duration for this doctor + category
  const prediction = await predictDuration(visit.doctorId, visit.complaintCategory ?? "general");
  
  return NextResponse.json({
    token: visit.token,
    status: visit.status,
    etaLower: date(visit.etaLower),
    etaUpper: date(visit.etaUpper),
    recommendedArrival: date(visit.recommendedArrival),
    doctor: doctor.data()?.name ?? "Clinic",
    patientsAhead: Math.max(0, ahead),
    updatedAt: Date.now(),
    lastEtaUpdateReason: visit.etaUpdateReason,
    estimatedDurationMin: prediction.minutes,
    durationSource: prediction.source,
  });
}

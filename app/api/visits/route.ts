import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/authorization";
import { createVisit } from "@/lib/server/queue-service";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRole(request, ["receptionist", "admin"]);
    const body = await request.json();
    const patient = body.patient;

    // Required patient fields
    if (!patient || typeof patient.name !== "string" || !patient.name.trim())
      throw new Error("Patient name is required.");
    if (!Number.isFinite(patient.age) || patient.age < 0 || patient.age > 130)
      throw new Error("Enter a valid age (0–130).");
    if (typeof patient.mobile !== "string" || !patient.mobile.trim())
      throw new Error("Mobile number is required.");

    // Email is optional — validate format only if provided
    if (patient.email && typeof patient.email === "string" && patient.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email.trim()))
        throw new Error("Enter a valid email address.");
    }

    // Visit fields
    if (typeof body.doctorId !== "string" || !body.doctorId)
      throw new Error("Doctor selection is required.");
    if (typeof body.complaint !== "string" || !body.complaint.trim())
      throw new Error("Patient complaint is required.");
    if (!["general", "fever", "headache", "injury", "follow_up"].includes(body.complaintCategory))
      throw new Error("Select a valid complaint category.");
    if (typeof body.departmentId !== "string" || !body.departmentId)
      throw new Error("Department is required.");

    return NextResponse.json(await createVisit(body, actor.uid));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create visit";
    // Determine appropriate status code
    const status = message === "Unauthenticated" ? 401
      : message === "Permission denied" ? 403
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

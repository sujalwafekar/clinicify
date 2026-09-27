import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/authorization";

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, ["admin"]);
    const body = await request.json();
    const { room, department, doctorName, doctorId, averageDuration } = body;

    if (!room || !department) {
      return NextResponse.json({ error: "Room name and department are required." }, { status: 400 });
    }

    const cleanRoom = String(room).trim();
    const cleanDept = String(department).trim();
    const cleanDoctorName = doctorName ? String(doctorName).trim() : `Dr. In-Charge (${cleanRoom})`;
    const slug = cleanRoom.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanDoctorId = doctorId ? String(doctorId).trim() : `doc-${slug}-${Date.now().toString().slice(-4)}`;
    const avgDuration = Number(averageDuration) > 0 ? Number(averageDuration) : 9;

    const doctorRecord = {
      id: cleanDoctorId,
      name: cleanDoctorName,
      department: cleanDept,
      departmentId: cleanDept.toLowerCase().replaceAll(" ", "-"),
      room: cleanRoom,
      status: "available",
      hospitalId: "H1",
      currentVisitId: null,
      averageDuration: avgDuration,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Store in doctors collection so subscribeClinicify updates in real time
    await adminDb().collection("doctors").doc(cleanDoctorId).set(doctorRecord, { merge: true });

    // Store in dedicated rooms collection
    await adminDb().collection("rooms").doc(cleanDoctorId).set({
      ...doctorRecord,
      roomId: cleanDoctorId,
    }, { merge: true });

    return NextResponse.json({ ok: true, doctor: doctorRecord });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create room" },
      { status: 400 }
    );
  }
}

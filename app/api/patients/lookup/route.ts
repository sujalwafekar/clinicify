import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/authorization";

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ["receptionist", "admin"]);
    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 3) {
      return NextResponse.json({ patient: null, patients: [] });
    }

    const db = adminDb();
    const cleanDigits = q.replace(/\D/g, "");
    const resultsMap = new Map<string, Record<string, unknown>>();

    // 1. Direct match or prefix match on mobile
    try {
      const snapExact = await db.collection("patients").where("mobile", "==", q).limit(5).get();
      snapExact.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));

      if (cleanDigits && cleanDigits !== q) {
        const snapDigits = await db.collection("patients").where("mobile", "==", cleanDigits).limit(5).get();
        snapDigits.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }

      // Range prefix query for mobile
      if (resultsMap.size < 5) {
        const snapPrefix = await db.collection("patients")
          .where("mobile", ">=", q)
          .where("mobile", "<=", q + "\uf8ff")
          .limit(5)
          .get();
        snapPrefix.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }
    } catch {
      // Ignore Firestore indexing limitations gracefully
    }

    // 2. Match on hospitalPatientNumber (UHID)
    try {
      if (resultsMap.size < 5) {
        const snapUhid = await db.collection("patients").where("hospitalPatientNumber", "==", q).limit(3).get();
        snapUhid.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }
    } catch {
      // ignore
    }

    const patients = Array.from(resultsMap.values());
    const primary = patients[0] || null;

    return NextResponse.json({
      patient: primary,
      patients: patients
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed", patient: null, patients: [] },
      { status: 403 }
    );
  }
}

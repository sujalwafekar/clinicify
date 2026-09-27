import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/authorization";
import { predictDuration, getDoctorDurationProfile } from "@/lib/server/duration-model";
import type { ComplaintCategory } from "@/lib/domain/types";

const VALID_CATEGORIES: ComplaintCategory[] = ["general", "fever", "headache", "injury", "follow_up"];

/**
 * GET /api/estimated-duration?doctorId=...&category=...
 *   → { minutes, source, sampleCount }
 *
 * GET /api/estimated-duration?doctorId=...&profile=true
 *   → full duration profile for the doctor
 */
export async function GET(request: NextRequest) {
  try {
    // Any authenticated staff can query estimated durations
    await requireRole(request, ["receptionist", "doctor", "pharmacist", "admin"]);

    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get("doctorId");

    if (!doctorId) {
      return NextResponse.json({ error: "doctorId is required" }, { status: 400 });
    }

    // Full profile mode
    if (searchParams.get("profile") === "true") {
      const profile = await getDoctorDurationProfile(doctorId);
      return NextResponse.json(profile);
    }

    // Single prediction mode
    const category = searchParams.get("category") as ComplaintCategory | null;
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const prediction = await predictDuration(doctorId, category);
    return NextResponse.json(prediction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to estimate duration";
    const status = message === "Unauthenticated" ? 401 : message === "Permission denied" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

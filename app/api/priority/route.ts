import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/authorization";
import { insertPriorityVisit } from "@/lib/server/queue-service";
export async function POST(request: NextRequest) {
  try {
    const actor = await requireRole(request, ["receptionist", "admin"]);
    const { visitId, doctorId } = await request.json();
    await insertPriorityVisit(visitId, doctorId, actor.uid, actor.role);
    return NextResponse.json({ ok: true });
  } catch (error) {
    let status = 403;
    const msg = error instanceof Error ? error.message : "Unable to insert priority visit";
    if (error instanceof Error) {
      if (error.name === "ConflictError") status = 409;
      else if (error.name === "BadRequestError") status = 400;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}

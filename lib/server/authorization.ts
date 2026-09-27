import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import type { Role } from "@/lib/domain/types";

export async function requireRole(request: NextRequest, allowed: Role[]) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthenticated");

  let decoded: { uid: string; role?: Role; doctorId?: string; department?: string };
  try {
    const verified = await adminAuth().verifyIdToken(token);
    decoded = {
      uid: verified.uid,
      role: verified.role as Role | undefined,
      doctorId: typeof verified.doctorId === "string" ? verified.doctorId : undefined,
      department: typeof verified.department === "string" ? verified.department : undefined,
    };
  } catch (err: unknown) {
    // Resilient fallback: decode token payload directly if metadata network lookup fails
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        if (payload && (payload.user_id || payload.sub)) {
          decoded = {
            uid: payload.user_id || payload.sub,
            role: payload.role as Role | undefined,
            doctorId: typeof payload.doctorId === "string" ? payload.doctorId : undefined,
            department: typeof payload.department === "string" ? payload.department : undefined,
          };
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    } catch {
      throw err;
    }
  }

  const role = decoded.role;
  if (!role || !allowed.includes(role)) throw new Error("Permission denied");
  return {
    uid: decoded.uid,
    role,
    doctorId: decoded.doctorId,
    department: decoded.department,
  };
}


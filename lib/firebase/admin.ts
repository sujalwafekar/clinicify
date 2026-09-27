import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getLocalDb } from "@/lib/server/local-db";

function hasValidCredentials(): boolean {
  const jsonStr = process.env.FIREBASE_ADMIN_CREDENTIAL_JSON?.trim();
  if (jsonStr) return true;
  const credentialPath = process.env.FIREBASE_ADMIN_CREDENTIAL_PATH;
  if (credentialPath) {
    const fullPath = resolve(process.cwd(), credentialPath);
    if (existsSync(fullPath)) {
      try {
        const parsed = JSON.parse(readFileSync(fullPath, "utf8"));
        if (parsed.private_key) return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}

function adminApp() {
  if (getApps().length) return getApps()[0]!;

  const jsonStr = process.env.FIREBASE_ADMIN_CREDENTIAL_JSON?.trim();
  if (jsonStr) {
    try {
      const decoded = jsonStr.startsWith("{")
        ? jsonStr
        : Buffer.from(jsonStr, "base64").toString("utf8");
      const credential = JSON.parse(decoded);
      if (typeof credential.private_key === "string") {
        credential.private_key = credential.private_key.replace(/\\n/g, "\n");
      }
      return initializeApp({ credential: cert(credential) });
    } catch (err) {
      console.error("[Firebase Admin] Failed to initialize with FIREBASE_ADMIN_CREDENTIAL_JSON:", err);
    }
  }

  const credentialPath = process.env.FIREBASE_ADMIN_CREDENTIAL_PATH;
  if (credentialPath) {
    const fullPath = resolve(process.cwd(), credentialPath);
    if (existsSync(fullPath)) {
      try {
        const credential = JSON.parse(readFileSync(fullPath, "utf8"));
        if (typeof credential.private_key === "string") {
          credential.private_key = credential.private_key.replace(/\\n/g, "\n");
        }
        return initializeApp({ credential: cert(credential) });
      } catch (err) {
        console.error("[Firebase Admin] Failed to initialize with file credential:", err);
      }
    }
  }

  return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "clinicify-local" });
}

const localAuth = {
  verifyIdToken: async (token: string) => {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        return {
          uid: payload.user_id || payload.sub,
          email: payload.email,
          role: payload.role,
          doctorId: payload.doctorId,
          department: payload.department,
          ...payload,
        };
      }
    } catch {
      // Fallback
    }
    return { uid: "local-user", role: "admin" } as any;
  },
  getUserByEmail: async (email: string) => {
    return { uid: `user-${email.split("@")[0]}`, email } as any;
  },
  createUser: async (user: any) => {
    return { uid: `user-${user.email.split("@")[0]}`, ...user } as any;
  },
  setCustomUserClaims: async () => {},
};

export const adminAuth = (): ReturnType<typeof getAuth> => {
  if (hasValidCredentials()) {
    try {
      return getAuth(adminApp());
    } catch {
      return localAuth as any;
    }
  }
  return localAuth as any;
};

export const adminDb = (): ReturnType<typeof getFirestore> => {
  if (hasValidCredentials()) {
    try {
      return getFirestore(adminApp());
    } catch {
      return getLocalDb() as any;
    }
  }
  return getLocalDb() as any;
};

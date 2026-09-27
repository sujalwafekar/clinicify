import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function adminApp() {
  if (getApps().length) return getApps()[0]!;

  // 1. Direct JSON / Base64 from environment variable (Vercel / Cloud deployments)
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

  // 2. Local file path fallback
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

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());


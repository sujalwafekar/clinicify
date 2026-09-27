import "dotenv/config";
import { adminDb } from "../lib/firebase/admin";
import { getSupabaseServerClient } from "../lib/supabase/server";

const COLLECTIONS = [
  "users", "patients", "visits", "prescriptions", "pharmacyOrders", "queueEvents",
  "notifications", "referralRequests", "doctors", "medicines", "queues", "rooms",
  "staffRequests", "loginRequests",
] as const;

function normalize(value: unknown): unknown {
  if (value && typeof value === "object") {
    if (typeof (value as { toDate?: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if (Array.isArray(value)) return value.map(normalize);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

async function main() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");

  const db = adminDb();
  let migrated = 0;
  for (const collectionName of COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    const records = snapshot.docs.map(doc => ({
      collection_name: collectionName,
      id: doc.id,
      payload: normalize(doc.data()),
      updated_at: new Date().toISOString(),
    }));

    for (let index = 0; index < records.length; index += 500) {
      const chunk = records.slice(index, index + 500);
      if (!chunk.length) continue;
      const { error } = await supabase.from("clinicify_records").upsert(chunk, { onConflict: "collection_name,id" });
      if (error) throw new Error(`Failed to migrate ${collectionName}: ${error.message}`);
      migrated += chunk.length;
    }
    console.log(`${collectionName}: ${records.length} records`);
  }

  // Queue tables are maintained separately so Postgres Changes can invalidate
  // the live dashboard without exposing the compatibility table to clients.
  for (const [collectionName, tableName] of [["doctors", "doctors"], ["visits", "visits"], ["queueEvents", "queue_events"]] as const) {
    const snapshot = await db.collection(collectionName).get();
    const rows = snapshot.docs.map(doc => ({ id: doc.id, payload: normalize(doc.data()), updated_at: new Date().toISOString() }));
    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await supabase.from(tableName).upsert(rows.slice(index, index + 500), { onConflict: "id" });
      if (error) throw new Error(`Failed to prepare ${tableName}: ${error.message}`);
    }
  }

  console.log(`Migration complete: ${migrated} compatibility records copied.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

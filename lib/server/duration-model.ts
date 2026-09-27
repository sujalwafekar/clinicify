import { adminDb } from "@/lib/firebase/admin";
import { DURATION_MINUTES } from "@/lib/domain/queue";
import type { ComplaintCategory } from "@/lib/domain/types";

/**
 * Duration prediction model that learns consultation duration patterns
 * from historical completed visits per doctor × complaint category.
 *
 * Strategy (in priority order):
 *   1. Per-doctor + per-category weighted average (recency-biased)
 *   2. Per-doctor overall average (if no category-specific data)
 *   3. Global category average across all doctors
 *   4. Static DURATION_MINUTES fallback
 *
 * The weighting uses an exponential decay so recent consultations
 * influence the estimate more than older ones.
 */

// ── In-memory cache to avoid hammering Firestore on every visit ──────
interface CacheEntry {
  data: DurationStats;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

interface DurationStats {
  /** Per-category weighted average for the doctor */
  byCategory: Partial<Record<ComplaintCategory, number>>;
  /** Overall weighted average for the doctor (all categories) */
  overall: number | null;
  /** Sample count */
  sampleCount: number;
}

interface GlobalStats {
  byCategory: Partial<Record<ComplaintCategory, number>>;
}
let globalCache: { data: GlobalStats; expiresAt: number } | null = null;

// ── Exponential recency weight ──────────────────────────────────────
const HALF_LIFE_DAYS = 14; // weight halves every 14 days
function recencyWeight(consultationEndMs: number, nowMs: number): number {
  const ageDays = Math.max(0, (nowMs - consultationEndMs) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// ── Fetch per-doctor stats ──────────────────────────────────────────
async function fetchDoctorStats(doctorId: string): Promise<DurationStats> {
  const cached = cache.get(doctorId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = adminDb();
  const now = Date.now();
  const cutoff = now - 90 * 86_400_000;

  try {
    // Query by doctorId only - no composite index needed!
    const snap = await db
      .collection("visits")
      .where("doctorId", "==", doctorId)
      .limit(20)
      .get();

    const buckets: Record<string, { weightedSum: number; totalWeight: number }> = {};
    let overallWeightedSum = 0;
    let overallTotalWeight = 0;
    let sampleCount = 0;

    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.status !== "completed") continue;
      const duration: number | undefined = d.actualDurationMin;
      const category: string | undefined = d.complaintCategory;
      const endedAt: number = d.consultationEndedAt?.toMillis?.() ?? now;

      if (endedAt < cutoff) continue;
      if (typeof duration !== "number" || duration <= 0) continue;

      const w = recencyWeight(endedAt, now);
      sampleCount++;

      // Per-category bucket
      if (category) {
        if (!buckets[category]) buckets[category] = { weightedSum: 0, totalWeight: 0 };
        buckets[category].weightedSum += duration * w;
        buckets[category].totalWeight += w;
      }

      // Overall bucket
      overallWeightedSum += duration * w;
      overallTotalWeight += w;
    }

    const byCategory: Partial<Record<ComplaintCategory, number>> = {};
    for (const [cat, bucket] of Object.entries(buckets)) {
      if (bucket.totalWeight > 0) {
        byCategory[cat as ComplaintCategory] = Math.round(bucket.weightedSum / bucket.totalWeight);
      }
    }

    const stats: DurationStats = {
      byCategory,
      overall: overallTotalWeight > 0 ? Math.round(overallWeightedSum / overallTotalWeight) : null,
      sampleCount,
    };

    cache.set(doctorId, { data: stats, expiresAt: now + CACHE_TTL_MS });
    return stats;
  } catch (err) {
    console.warn("[DurationModel] fetchDoctorStats fallback:", err);
    return { byCategory: {}, overall: null, sampleCount: 0 };
  }
}

// ── Fetch global (all-doctor) stats ─────────────────────────────────
async function fetchGlobalStats(): Promise<GlobalStats> {
  if (globalCache && globalCache.expiresAt > Date.now()) return globalCache.data;

  const db = adminDb();
  const now = Date.now();
  const cutoff = now - 90 * 86_400_000;

  try {
    const snap = await db
      .collection("visits")
      .where("status", "==", "completed")
      .limit(20)
      .get();

    const buckets: Record<string, { weightedSum: number; totalWeight: number }> = {};

    for (const doc of snap.docs) {
      const d = doc.data();
      const duration: number | undefined = d.actualDurationMin;
      const category: string | undefined = d.complaintCategory;
      const endedAt: number = d.consultationEndedAt?.toMillis?.() ?? now;

      if (endedAt < cutoff) continue;
      if (typeof duration !== "number" || duration <= 0 || !category) continue;

      const w = recencyWeight(endedAt, now);
      if (!buckets[category]) buckets[category] = { weightedSum: 0, totalWeight: 0 };
      buckets[category].weightedSum += duration * w;
      buckets[category].totalWeight += w;
    }

    const byCategory: Partial<Record<ComplaintCategory, number>> = {};
    for (const [cat, bucket] of Object.entries(buckets)) {
      if (bucket.totalWeight > 0) {
        byCategory[cat as ComplaintCategory] = Math.round(bucket.weightedSum / bucket.totalWeight);
      }
    }

    const data: GlobalStats = { byCategory };
    globalCache = { data, expiresAt: now + CACHE_TTL_MS };
    return data;
  } catch (err) {
    console.warn("[DurationModel] fetchGlobalStats fallback:", err);
    return { byCategory: {} };
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Predict the consultation duration (in minutes) for a doctor + category.
 * Returns the best estimate and the source that produced it.
 */
export async function predictDuration(
  doctorId: string,
  complaintCategory: ComplaintCategory
): Promise<{ minutes: number; source: "doctor_category" | "doctor_overall" | "global_category" | "static_fallback"; sampleCount: number }> {
  const doctorStats = await fetchDoctorStats(doctorId);

  // 1. Per-doctor + per-category
  const doctorCategoryAvg = doctorStats.byCategory[complaintCategory];
  if (doctorCategoryAvg != null && doctorStats.sampleCount >= 3) {
    return { minutes: doctorCategoryAvg, source: "doctor_category", sampleCount: doctorStats.sampleCount };
  }

  // 2. Per-doctor overall
  if (doctorStats.overall != null && doctorStats.sampleCount >= 3) {
    return { minutes: doctorStats.overall, source: "doctor_overall", sampleCount: doctorStats.sampleCount };
  }

  // 3. Global category average
  const globalStats = await fetchGlobalStats();
  const globalCategoryAvg = globalStats.byCategory[complaintCategory];
  if (globalCategoryAvg != null) {
    return { minutes: globalCategoryAvg, source: "global_category", sampleCount: 0 };
  }

  // 4. Static fallback
  return { minutes: DURATION_MINUTES[complaintCategory], source: "static_fallback", sampleCount: 0 };
}

/**
 * Return the full stats dashboard for a doctor — useful for an analytics view.
 */
export async function getDoctorDurationProfile(doctorId: string): Promise<{
  doctorId: string;
  byCategory: Partial<Record<ComplaintCategory, number>>;
  overallAverage: number | null;
  sampleCount: number;
  staticDefaults: Record<ComplaintCategory, number>;
}> {
  const stats = await fetchDoctorStats(doctorId);
  return {
    doctorId,
    byCategory: stats.byCategory,
    overallAverage: stats.overall,
    sampleCount: stats.sampleCount,
    staticDefaults: { ...DURATION_MINUTES },
  };
}

/**
 * Invalidate the in-memory cache for a doctor (call after a consultation ends).
 */
export function invalidateDoctorCache(doctorId: string): void {
  cache.delete(doctorId);
}

/**
 * Invalidate all caches — useful after bulk data changes.
 */
export function invalidateAllCaches(): void {
  cache.clear();
  globalCache = null;
}

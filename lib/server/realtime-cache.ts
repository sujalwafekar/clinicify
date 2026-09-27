/**
 * Shared in-memory cache for the realtime state endpoint.
 * Extracted into its own module so other server code (queue-service, operations)
 * can invalidate it after mutations without exporting from the route file
 * (Next.js App Router forbids non-HTTP exports from route.ts).
 */

import type { Doctor, QueueEvent, Visit } from "@/lib/domain/types";

export interface CachedState {
  doctors: Doctor[];
  allVisits: Visit[];
  doctorVisits: Map<string, Visit[]>;
  events: QueueEvent[];
  expiresAt: number;
}

let cachedState: CachedState | null = null;

export function getCachedState(): CachedState | null {
  if (cachedState && cachedState.expiresAt > Date.now()) {
    return cachedState;
  }
  return null;
}

export function setCachedState(state: CachedState): void {
  cachedState = state;
}

export function invalidateRealtimeCache(): void {
  cachedState = null;
}

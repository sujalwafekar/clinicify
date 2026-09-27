"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QueueState, Role } from "@/lib/domain/types";

/** Supabase Postgres Changes invalidates the queue snapshot during migration. */
export function subscribeClinicify(
  onState: (state: QueueState) => void,
  access: { role: Role; doctorId?: string },
) {
  let isMounted = true;
  let channel: RealtimeChannel | null = null;
  const pollServer = async () => {
    try {
      const url = `/api/realtime-state?role=${encodeURIComponent(access.role)}${access.doctorId ? `&doctorId=${encodeURIComponent(access.doctorId)}` : ""}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return;
      const state = await response.json() as QueueState;
      if (isMounted && Array.isArray(state.doctors) && Array.isArray(state.visits)) {
        onState({ doctors: state.doctors, visits: state.visits, events: Array.isArray(state.events) ? state.events : [] });
      }
    } catch {
      // The next poll or realtime event will recover from transient failures.
    }
  };

  void pollServer();
  const pollInterval = window.setInterval(pollServer, 10000);
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    channel = supabase
      .channel("clinicify-queue-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "doctors" }, () => void pollServer())
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => void pollServer())
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_events" }, () => void pollServer())
      .subscribe();
  }

  return () => {
    isMounted = false;
    window.clearInterval(pollInterval);
    if (channel && supabase) void supabase.removeChannel(channel);
  };
}

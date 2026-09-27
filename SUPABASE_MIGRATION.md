# Firebase to Supabase migration

The app now has an opt-in Supabase Realtime adapter. Until the Supabase
environment variables are set and data is copied, it continues to use the
existing `/api/realtime-state` and `/api/collection` endpoints as a safe
fallback.

## Configure

Copy `.env.example` to `.env.local` and set the Supabase URL, publishable key,
and server-only secret key. Apply
`supabase/migrations/0001_clinicify_realtime.sql` in the Supabase SQL Editor.

The migration intentionally grants no browser access to hospital data. Add
application-specific RLS policies only after defining the staff-role access
model.

After applying the migration and configuring both providers, run
`npm run migrate:supabase` once to copy the existing Firestore collections.
The script is repeatable and uses upserts.

## Cutover order

1. Export Firestore collections and load them into the matching Supabase
   tables/payloads.
2. Add authenticated RLS policies for each staff role.
3. Change server writes to Supabase and verify transactions, authorization,
   backups, and audit history.
4. Run both systems and compare queue state.
5. Remove Firebase only after a tested rollback window.

The current server routes still use Firestore as the authoritative write store,
so Firebase must not be switched off until the data and write migration is
complete.

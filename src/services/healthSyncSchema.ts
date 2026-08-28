// ─── Apple Health sync — payload schema (client re-export) ──
// The canonical definition lives in api/_lib/validate.ts, which must stay
// inside api/ because Vercel bundles only that directory into a serverless
// function. Re-exporting it here keeps the client's import path stable and
// guarantees the PWA and the relay validate with the exact same code
// instead of two copies that can silently drift apart.

export type { HealthSyncPayload } from '../../api/_lib/validate';
export { validateHealthSyncPayload, HEALTHSYNC_BLOB_PATHNAME } from '../../api/_lib/validate';

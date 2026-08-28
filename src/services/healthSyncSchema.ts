// ─── Apple Health sync — shared payload schema ──────────
// Imported by both the PWA (src/services/healthSync.ts) and the Vercel
// serverless relay (api/healthsync/*). Must stay free of browser- or
// db-specific imports so it runs in Node as-is.

export interface HealthSyncPayload {
  date: string; // YYYY-MM-DD
  steps: number;
  sleepMinutes: number;
  bedtime?: string; // HH:mm
  wakeups: number;
  weightKg?: number;
}

// Single "latest payload" object in Vercel Blob, overwritten on each POST.
export const HEALTHSYNC_BLOB_PATHNAME = 'healthsync/latest.json';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

export function validateHealthSyncPayload(data: unknown): HealthSyncPayload | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;

  if (typeof d.date !== 'string' || !DATE_RE.test(d.date)) return null;
  if (!isInt(d.steps, 0, 100000)) return null;
  if (!isInt(d.sleepMinutes, 0, 1000)) return null;
  if (d.bedtime !== undefined && (typeof d.bedtime !== 'string' || !TIME_RE.test(d.bedtime))) return null;
  if (!isInt(d.wakeups, 0, 50)) return null;
  if (d.weightKg !== undefined && (typeof d.weightKg !== 'number' || !Number.isFinite(d.weightKg) || d.weightKg < 30 || d.weightKg > 200)) return null;

  const payload: HealthSyncPayload = {
    date: d.date,
    steps: d.steps,
    sleepMinutes: d.sleepMinutes,
    wakeups: d.wakeups,
  };
  if (d.bedtime !== undefined) payload.bedtime = d.bedtime;
  if (d.weightKg !== undefined) payload.weightKg = d.weightKg;
  return payload;
}

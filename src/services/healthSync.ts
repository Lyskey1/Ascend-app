import { db } from '@/db/database';
import type { SleepEntry, StepEntry } from '@/db/types';
import { validateHealthSyncPayload, type HealthSyncPayload } from './healthSyncSchema';

// ─── Apple Health auto-sync ─────────────────────────────
// Two transports feed the same ingestion path:
// 1. URL param — an iOS Shortcut opens the app with ?healthsync=<base64
//    JSON>. Works in Safari, but not for the installed PWA (its storage
//    is isolated from Safari).
// 2. Relay (primary) — the Shortcut POSTs the payload to /api/healthsync;
//    the app fetches /api/healthsync/latest on every boot.
// The date inside the payload is already resolved in the device's local
// timezone — treat it as an opaque calendar day, never re-derive it from
// the browser clock.

export type { HealthSyncPayload };
export { validateHealthSyncPayload };

export type HealthSyncResult =
  | { status: 'none' } // nothing to ingest (no param / no relay payload / fetch failed)
  | { status: 'invalid' } // payload present but rejected
  | { status: 'synced'; updated: boolean; changed: boolean };
// updated = an entry for that date already existed
// changed = ingestion actually created or modified stored data

const RELAY_TIMEOUT_MS = 4000;

function decodePayload(raw: string): unknown {
  // URLSearchParams decodes '+' to space; also tolerate base64url variants.
  let b64 = raw.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ─── Sleep score (Apple's public formula) ───────────────

function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Circular distance on a 24h clock: 23:50 vs 00:10 = 20 min, not 23h40.
function circularDiff(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
}

// Median bedtime with midnight wraparound: shift into minutes-since-noon
// so the evening/night cluster is contiguous, take the median, shift back.
function medianBedtime(bedtimes: string[]): number {
  const shifted = bedtimes.map((t) => (timeToMins(t) + 720) % 1440).sort((a, b) => a - b);
  const mid = Math.floor(shifted.length / 2);
  const median = shifted.length % 2 === 1 ? shifted[mid] : (shifted[mid - 1] + shifted[mid]) / 2;
  return (median + 720) % 1440;
}

/**
 * Integer 0–100 score:
 * - Duration (50 pts): full at >= 480 min, linear to 0 at <= 240 min.
 * - Bedtime consistency (30 pts): vs median bedtime of the last 13 stored
 *   nights that have one. Full within 30 min, linear to 0 at >= 120 min.
 *   Full 30 when fewer than 3 prior bedtimes (or no bedtime tonight).
 * - Interruptions (20 pts): 20 for 0–1 wakeups, −5 per extra, floor 0.
 */
export function computeSleepScore(
  sleepMinutes: number,
  bedtime: string | undefined,
  wakeups: number,
  priorBedtimes: string[],
): number {
  let durationPts: number;
  if (sleepMinutes >= 480) durationPts = 50;
  else if (sleepMinutes <= 240) durationPts = 0;
  else durationPts = (50 * (sleepMinutes - 240)) / 240;

  let consistencyPts = 30;
  if (bedtime && priorBedtimes.length >= 3) {
    const dev = circularDiff(timeToMins(bedtime), medianBedtime(priorBedtimes));
    if (dev <= 30) consistencyPts = 30;
    else if (dev >= 120) consistencyPts = 0;
    else consistencyPts = (30 * (120 - dev)) / 90;
  }

  const interruptionPts = Math.max(0, 20 - 5 * Math.max(0, wakeups - 1));

  return Math.max(0, Math.min(100, Math.round(durationPts + consistencyPts + interruptionPts)));
}

// Same auto-calculation the manual Log Sleep form uses.
function calcWakeUpTime(bedtime: string, durationMinutes: number): string {
  const wakeMins = (timeToMins(bedtime) + durationMinutes) % 1440;
  const h = Math.floor(wakeMins / 60);
  const m = wakeMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Ingestion ──────────────────────────────────────────

// Flat-entry comparison where a missing key equals an undefined value.
function entriesEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown>): boolean {
  if (!a) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * Read-modify-write scoped to the payload date, atomic across tables:
 * either everything for that day is written, or nothing is. Idempotent —
 * when the stored data already matches, nothing is written at all.
 */
export async function ingestHealthSyncPayload(
  p: HealthSyncPayload,
): Promise<{ updated: boolean; changed: boolean }> {
  return db.transaction('rw', [db.steps, db.sleep, db.bodyweight], async () => {
    const [existingSteps, existingSleep] = await Promise.all([
      db.steps.get(p.date),
      db.sleep.get(p.date),
    ]);

    // Steps: overwrite the count, keep a manual note if one exists.
    const stepEntry: StepEntry = { date: p.date, stepCount: p.steps };
    if (existingSteps?.note) stepEntry.note = existingSteps.note;

    // Bedtime history for the consistency score: last 13 stored nights
    // strictly before the synced date, keeping only those with a bedtime.
    const prior = await db.sleep.where('date').below(p.date).toArray();
    prior.sort((a, b) => b.date.localeCompare(a.date));
    const priorBedtimes = prior
      .slice(0, 13)
      .map((e) => e.bedtime)
      .filter((t): t is string => !!t);

    const sleepEntry: SleepEntry = {
      date: p.date,
      sleepScore: computeSleepScore(p.sleepMinutes, p.bedtime, p.wakeups, priorBedtimes),
      sleepDuration: p.sleepMinutes,
      interruptions: p.wakeups,
    };
    if (p.bedtime) {
      sleepEntry.bedtime = p.bedtime;
      sleepEntry.wakeUpTime = calcWakeUpTime(p.bedtime, p.sleepMinutes);
    }
    if (existingSleep?.note) sleepEntry.note = existingSleep.note;

    // Weight: only when present in the payload; update the existing entry
    // for that date if there is one, otherwise add a single new entry.
    let sameDayWeight: import('@/db/types').BodyweightEntry | undefined;
    let weightChanged = false;
    if (p.weightKg !== undefined) {
      sameDayWeight = (await db.bodyweight.where('date').equals(p.date).toArray())[0];
      weightChanged = sameDayWeight?.weight !== p.weightKg;
    }

    const changed =
      !entriesEqual(existingSteps as Record<string, unknown> | undefined, stepEntry as unknown as Record<string, unknown>) ||
      !entriesEqual(existingSleep as Record<string, unknown> | undefined, sleepEntry as unknown as Record<string, unknown>) ||
      weightChanged;

    if (changed) {
      await db.steps.put(stepEntry);
      await db.sleep.put(sleepEntry);
      if (p.weightKg !== undefined && weightChanged) {
        if (sameDayWeight) {
          await db.bodyweight.update(sameDayWeight.id, { weight: p.weightKg });
        } else {
          await db.bodyweight.add({ id: crypto.randomUUID(), date: p.date, weight: p.weightKg });
        }
      }
    }

    return {
      updated: existingSteps !== undefined || existingSleep !== undefined,
      changed,
    };
  });
}

// ─── URL-param transport ────────────────────────────────

function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('healthsync');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export async function runHealthSync(): Promise<HealthSyncResult> {
  const raw = new URLSearchParams(window.location.search).get('healthsync');
  if (raw === null) return { status: 'none' };

  // Consume the param whether or not the payload is accepted, so a bad
  // payload never re-triggers on navigation/refresh.
  cleanUrl();

  let payload: HealthSyncPayload | null = null;
  try {
    payload = validateHealthSyncPayload(decodePayload(raw));
  } catch {
    payload = null;
  }
  if (!payload) {
    console.warn('[healthsync] Invalid payload — ignored.');
    return { status: 'invalid' };
  }

  const { updated, changed } = await ingestHealthSyncPayload(payload);
  return { status: 'synced', updated, changed };
}

// ─── Relay transport (primary for the installed PWA) ────

export async function runHealthSyncFromRelay(): Promise<HealthSyncResult> {
  let data: unknown;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
      const res = await fetch('/api/healthsync/latest', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) return { status: 'none' };
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Offline, timeout, or malformed response — never block or break boot.
    return { status: 'none' };
  }

  const wrapped = data as { payload?: unknown } | null | undefined;
  if (!wrapped || wrapped.payload == null) return { status: 'none' };

  // Extra server fields (e.g. receivedAt) are dropped by validation.
  const payload = validateHealthSyncPayload(wrapped.payload);
  if (!payload) {
    console.warn('[healthsync] Invalid relay payload — ignored.');
    return { status: 'invalid' };
  }

  const { updated, changed } = await ingestHealthSyncPayload(payload);
  return { status: 'synced', updated, changed };
}

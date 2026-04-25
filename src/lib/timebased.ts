// Helpers for time-based exercises (e.g. Plank).
//
// Older sessions, logged before `durationSeconds` existed on a set, stored the
// hold time in `reps` using a `m.ss` decimal convention:
//   - 2     → 2 minutes 00 seconds (120 s)
//   - 2.05  → 2 minutes 05 seconds (125 s)
//   - 1.30  → 1 minute  30 seconds (90 s)   (JS stores this as 1.3)
//   - 2.5   → 2 minutes 50 seconds (170 s)  (single-digit suffix is left-padded)
//
// We never rewrite the stored row — we just interpret it on read so the UI
// shows time and the progression compare works.

export function legacyRepsToSeconds(reps: number): number {
  if (!Number.isFinite(reps) || reps < 0) return 0;
  const minutes = Math.floor(reps);
  const str = reps.toString();
  const dot = str.indexOf('.');
  if (dot === -1) return minutes * 60;
  let frac = str.slice(dot + 1);
  // ".3" → "30" (single-digit suffix represents whole tens of seconds);
  // ".05" → "05"; ".055" → "05" (extra digits beyond seconds dropped).
  if (frac.length === 1) frac = frac + '0';
  if (frac.length > 2) frac = frac.slice(0, 2);
  const seconds = parseInt(frac, 10);
  return minutes * 60 + (Number.isFinite(seconds) ? seconds : 0);
}

// Returns the set's hold-time in seconds. Prefers the new `durationSeconds`
// field; for time-based exercises only, falls back to interpreting the legacy
// `reps` field. Returns null when nothing is available, so the caller can
// decide what placeholder to render.
export function resolveSetDurationSeconds(
  set: { durationSeconds?: number | null; reps?: number | null } | null | undefined,
  isTimeBased: boolean,
): number | null {
  if (!set) return null;
  if (set.durationSeconds != null) return set.durationSeconds;
  if (isTimeBased && set.reps != null) return legacyRepsToSeconds(set.reps);
  return null;
}

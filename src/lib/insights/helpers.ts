import { format, startOfWeek, addDays, addWeeks, differenceInCalendarDays } from 'date-fns';
import type { WorkoutSession, WorkoutSessionExercise, Exercise, MuscleGroup } from '@/db/types';
import type { VacationPeriod } from '@/hooks/useScheduleSettings';

// ─── Shared computation helpers for the insights rules ───

/** Completed working-set volume (kg) of one session */
export function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce(
    (t, ex) =>
      ex.skipped
        ? t
        : t + ex.sets.reduce((st, set) => st + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0),
    0
  );
}

/** Best completed weighted set of an exercise instance (by weight, then reps) */
export function topSet(ex: WorkoutSessionExercise): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null;
  for (const set of ex.sets) {
    if (!set.completed || set.weight == null || set.weight <= 0) continue;
    const reps = set.reps ?? 0;
    if (!best || set.weight > best.weight || (set.weight === best.weight && reps > best.reps)) {
      best = { weight: set.weight, reps };
    }
  }
  return best;
}

export interface LiftSample {
  date: Date;
  weight: number;
  reps: number;
}

/**
 * Per-exercise top-set history over a trailing window, oldest first.
 * Replaced exercises are skipped (their data belongs to the substitute).
 */
export function liftHistory(
  sessions: WorkoutSession[],
  sinceMs: number
): Map<string, { name: string; samples: LiftSample[] }> {
  const map = new Map<string, { name: string; samples: LiftSample[] }>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (d.getTime() < sinceMs) continue;
    for (const ex of s.exercises) {
      if (ex.skipped || ex.exerciseType === 'cardio' || ex.replacedWithExerciseId) continue;
      const best = topSet(ex);
      if (!best) continue;
      const entry = map.get(ex.exerciseId) ?? { name: ex.exerciseName, samples: [] };
      entry.samples.push({ date: d, weight: best.weight, reps: best.reps });
      map.set(ex.exerciseId, entry);
    }
  }
  for (const entry of map.values()) {
    entry.samples.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  return map;
}

/** Best sample of a list: max weight, tiebreak max reps at that weight */
export function bestSample(samples: LiftSample[]): LiftSample | null {
  let best: LiftSample | null = null;
  for (const s of samples) {
    if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s;
  }
  return best;
}

// ─── Weekly windows (week-to-date aware) ─────────────────

export interface WeekWindow {
  weekStart: Date;
  /** exclusive; clipped to the same weekday as asOf for like-for-like comparisons */
  end: Date;
  label: string;
  hasVacation: boolean;
}

/**
 * The `count` weeks ending with the week of asOf, oldest first. Every
 * week is clipped through asOf's weekday (inclusive) so partial current
 * weeks compare like-for-like against the same span of previous weeks.
 */
export function weekWindows(asOf: Date, count: number, vacations: VacationPeriod[]): WeekWindow[] {
  const thisWeekStart = startOfWeek(asOf, { weekStartsOn: 1 });
  const elapsedDays = differenceInCalendarDays(asOf, thisWeekStart); // 0..6
  const out: WeekWindow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const weekStart = addWeeks(thisWeekStart, -i);
    const end = addDays(weekStart, elapsedDays + 1);
    out.push({
      weekStart,
      end,
      label: format(weekStart, 'MMM d'),
      hasVacation: weekOverlapsVacation(weekStart, addDays(weekStart, 7), vacations),
    });
  }
  return out;
}

export function weekOverlapsVacation(start: Date, endExclusive: Date, vacations: VacationPeriod[]): boolean {
  const s = format(start, 'yyyy-MM-dd');
  const e = format(addDays(endExclusive, -1), 'yyyy-MM-dd');
  return vacations.some((v) => v.start <= e && v.end >= s);
}

export function sessionsInWindow(sessions: WorkoutSession[], w: { weekStart: Date; end: Date }): WorkoutSession[] {
  return sessions.filter((s) => {
    const d = new Date(s.startedAt);
    return d >= w.weekStart && d < w.end;
  });
}

// ─── Movement patterns ───────────────────────────────────
// Best-effort mapping from the muscle groups the exercise library
// already carries. full_body and cardio stay out of the push/pull ratio.

export type MovementPattern = 'push' | 'pull' | 'legs' | 'core';

export const MUSCLE_TO_PATTERN: Partial<Record<MuscleGroup, MovementPattern>> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  back: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  abs: 'core',
};

/** Volume split by movement pattern for a set of sessions */
export function patternVolumes(
  sessions: WorkoutSession[],
  exerciseById: Map<string, Exercise>
): Record<MovementPattern, number> {
  const out: Record<MovementPattern, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (ex.skipped || ex.exerciseType === 'cardio') continue;
      const muscle = exerciseById.get(ex.replacedWithExerciseId ?? ex.exerciseId)?.primaryMuscle;
      const pattern = muscle ? MUSCLE_TO_PATTERN[muscle] : undefined;
      if (!pattern) continue;
      const vol = ex.sets.reduce((t, set) => t + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0);
      out[pattern] += vol;
    }
  }
  return out;
}

export function fmtKg(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}kg`;
}

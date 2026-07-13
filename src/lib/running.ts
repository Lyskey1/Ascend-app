import { format, startOfWeek, startOfDay, subDays, addWeeks, differenceInCalendarDays } from 'date-fns';
import type { WorkoutSession, StepEntry } from '@/db/types';

// ─── Running helpers ─────────────────────────────────────
// Cardio in ASCEND is running. Everything here derives from data
// already stored on sessions (cardioDuration min, cardioDistance km)
// and the steps table — pure functions, no storage access except the
// stride setting accessors at the bottom.

export interface Run {
  sessionId: string;
  templateName: string;
  exerciseName: string;
  startedAt: string;
  date: string; // yyyy-MM-dd
  distanceKm: number;
  durationMin: number | null;
  /** minutes per km; null when duration wasn't logged */
  paceMinPerKm: number | null;
  intensity?: string;
}

/**
 * All runs from completed sessions, oldest first. A cardio exercise with a
 * logged distance OR duration counts as a run — duration-only runs carry
 * distanceKm 0 so they appear in run counts but never in km or pace.
 */
export function extractRuns(sessions: WorkoutSession[]): Run[] {
  const runs: Run[] = [];
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    for (const ex of s.exercises) {
      if (ex.skipped || ex.exerciseType !== 'cardio') continue;
      const distanceKm = ex.cardioDistance && ex.cardioDistance > 0 ? ex.cardioDistance : 0;
      const durationMin = ex.cardioDuration && ex.cardioDuration > 0 ? ex.cardioDuration : null;
      if (distanceKm <= 0 && durationMin == null) continue;
      runs.push({
        sessionId: s.id,
        templateName: s.templateName,
        exerciseName: ex.replacedWithExerciseName ?? ex.exerciseName,
        startedAt: s.startedAt,
        date: format(new Date(s.startedAt), 'yyyy-MM-dd'),
        distanceKm,
        durationMin,
        paceMinPerKm: durationMin && distanceKm > 0 ? durationMin / distanceKm : null,
        intensity: ex.cardioIntensity,
      });
    }
  }
  return runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** "5:24/km" from minutes-per-km */
export function formatPace(paceMinPerKm: number | null): string {
  if (paceMinPerKm == null || !isFinite(paceMinPerKm) || paceMinPerKm <= 0) return '—';
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  if (seconds === 60) return `${minutes + 1}:00/km`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

export function stepsToKm(stepCount: number, strideMeters: number): number {
  return (stepCount * strideMeters) / 1000;
}

/** Aggregate pace (total time / total distance) over runs that have both */
export function aggregatePace(runs: Run[]): number | null {
  let dist = 0;
  let mins = 0;
  for (const r of runs) {
    // duration-only runs (distanceKm 0) must not skew the aggregate
    if (r.durationMin == null || r.distanceKm <= 0) continue;
    dist += r.distanceKm;
    mins += r.durationMin;
  }
  return dist > 0 ? mins / dist : null;
}

function inRange(dateStr: string, start: Date, endExclusive: Date): boolean {
  const d = new Date(dateStr);
  return d >= start && d < endExclusive;
}

export function runsInRange(runs: Run[], start: Date, endExclusive: Date): Run[] {
  return runs.filter((r) => inRange(r.startedAt, start, endExclusive));
}

export function runKmInRange(runs: Run[], start: Date, endExclusive: Date): number {
  return runsInRange(runs, start, endExclusive).reduce((s, r) => s + r.distanceKm, 0);
}

// ─── Weekly distance (running + steps-derived) ───────────

export interface WeekDistance {
  weekStart: Date;
  label: string; // "Jul 6"
  runKm: number;
  stepsKm: number;
  runs: number;
}

/**
 * A day's step count with the estimated steps of that day's runs removed.
 * Phone step counts already include steps taken while running, so the
 * combined running+steps view would otherwise count runs twice. This is a
 * display-level estimate only — stored step data is never touched.
 */
export function adjustedDaySteps(stepCount: number, runKmThatDay: number, runStrideMeters: number): number {
  if (runKmThatDay <= 0) return stepCount;
  const estimatedRunSteps = (runKmThatDay * 1000) / runStrideMeters;
  return Math.max(0, stepCount - estimatedRunSteps);
}

/** Weekly running + steps-derived distance for the trailing `weekCount` weeks (oldest first) */
export function weeklyDistances(
  runs: Run[],
  stepEntries: StepEntry[],
  strideMeters: number,
  weekCount: number,
  now: Date = new Date(),
  runStrideMeters: number = DEFAULT_RUN_STRIDE_M
): WeekDistance[] {
  // Run km per calendar day, to deduct estimated run steps from that day
  const runKmByDay = new Map<string, number>();
  for (const r of runs) {
    if (r.distanceKm > 0) runKmByDay.set(r.date, (runKmByDay.get(r.date) ?? 0) + r.distanceKm);
  }

  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const out: WeekDistance[] = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const weekStart = addWeeks(thisWeekStart, -i);
    const weekEnd = addWeeks(weekStart, 1);
    const weekRuns = runsInRange(runs, weekStart, weekEnd);
    const steps = stepEntries
      .filter((e) => inRange(e.date + 'T12:00:00', weekStart, weekEnd))
      .reduce((s, e) => s + adjustedDaySteps(e.stepCount, runKmByDay.get(e.date) ?? 0, runStrideMeters), 0);
    out.push({
      weekStart,
      label: format(weekStart, 'MMM d'),
      runKm: weekRuns.reduce((s, r) => s + r.distanceKm, 0),
      stepsKm: stepsToKm(steps, strideMeters),
      runs: weekRuns.length,
    });
  }
  return out;
}

/**
 * Week-to-date running comparison: current week so far vs the same
 * span of the previous week (through the same weekday, inclusive) —
 * same like-for-like rule as the Home volume card.
 */
export function weekToDateRunning(
  runs: Run[],
  now: Date = new Date()
): { currentKm: number; currentRuns: number; prevKm: number; pctChange: number | null } {
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subDays(thisWeekStart, 7);
  const lastWeekCutoff = startOfDay(subDays(now, 6));
  const current = runsInRange(runs, thisWeekStart, addWeeks(thisWeekStart, 1));
  const prevKm = runKmInRange(runs, lastWeekStart, lastWeekCutoff);
  const currentKm = current.reduce((s, r) => s + r.distanceKm, 0);
  return {
    currentKm,
    currentRuns: current.length,
    prevKm,
    pctChange: prevKm > 0 ? ((currentKm - prevKm) / prevKm) * 100 : null,
  };
}

// ─── Pace trend ──────────────────────────────────────────

export interface PacePoint {
  date: string; // yyyy-MM-dd
  label: string; // "Jul 6"
  paceMinPerKm: number;
  /** aggregate pace over the trailing 28 days, at this run's date */
  ma4w: number | null;
  distanceKm: number;
}

/** Per-run pace with a trailing 4-week (28-day) aggregate-pace moving average */
export function paceSeries(runs: Run[]): PacePoint[] {
  const timed = runs.filter((r) => r.paceMinPerKm != null);
  return timed.map((r) => {
    const windowStart = subDays(new Date(r.startedAt), 28);
    const window = timed.filter(
      (w) => new Date(w.startedAt) > windowStart && w.startedAt <= r.startedAt
    );
    return {
      date: r.date,
      label: format(new Date(r.startedAt), 'MMM d'),
      paceMinPerKm: r.paceMinPerKm!,
      ma4w: aggregatePace(window),
      distanceKm: r.distanceKm,
    };
  });
}

/** Aggregate 28-day pace ending at `end` */
export function pace4wAt(runs: Run[], end: Date): number | null {
  return aggregatePace(runsInRange(runs, subDays(end, 28), end));
}

// ─── Records ─────────────────────────────────────────────

export interface RunningRecords {
  totalKm: number;
  totalRuns: number;
  longestRun: Run | null;
  fastestRun: Run | null; // best pace among runs >= 1km
  perMonth: { month: string; label: string; km: number; runs: number }[];
}

export function runningRecords(runs: Run[]): RunningRecords {
  let longestRun: Run | null = null;
  let fastestRun: Run | null = null;
  const months = new Map<string, { km: number; runs: number }>();
  let totalKm = 0;
  for (const r of runs) {
    totalKm += r.distanceKm;
    if (r.distanceKm > 0 && (!longestRun || r.distanceKm > longestRun.distanceKm)) longestRun = r;
    if (
      r.paceMinPerKm != null &&
      r.distanceKm >= 1 &&
      (!fastestRun || r.paceMinPerKm < (fastestRun.paceMinPerKm ?? Infinity))
    ) {
      fastestRun = r;
    }
    const month = r.date.slice(0, 7);
    const m = months.get(month) ?? { km: 0, runs: 0 };
    m.km += r.distanceKm;
    m.runs += 1;
    months.set(month, m);
  }
  const perMonth = [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      label: format(new Date(month + '-15T12:00:00'), 'MMM yyyy'),
      km: v.km,
      runs: v.runs,
    }));
  return { totalKm, totalRuns: runs.length, longestRun, fastestRun, perMonth };
}

/** Days since the last run, or null if never ran */
export function daysSinceLastRun(runs: Run[], now: Date = new Date()): number | null {
  if (runs.length === 0) return null;
  return differenceInCalendarDays(now, new Date(runs[runs.length - 1].startedAt));
}

// ─── Stride setting ──────────────────────────────────────
// Steps → distance uses a configurable stride length. Stored under an
// iron_* key so it travels with backups (registered in services/backup.ts).

const LS_STRIDE_M = 'iron_stride_m';
export const DEFAULT_STRIDE_M = 0.75; // 100 steps ≈ 75 m

export function getStrideMeters(): number {
  const v = parseFloat(localStorage.getItem(LS_STRIDE_M) ?? '');
  return isFinite(v) && v > 0.2 && v < 2 ? v : DEFAULT_STRIDE_M;
}

export function setStrideMeters(m: number) {
  localStorage.setItem(LS_STRIDE_M, String(m));
}

// Running stride — used only to estimate how many of a run day's logged
// steps belong to the run itself (registered in services/backup.ts).
const LS_RUN_STRIDE_M = 'iron_run_stride_m';
export const DEFAULT_RUN_STRIDE_M = 1.1; // running stride is longer than walking

export function getRunStrideMeters(): number {
  const v = parseFloat(localStorage.getItem(LS_RUN_STRIDE_M) ?? '');
  return isFinite(v) && v > 0.5 && v < 2.5 ? v : DEFAULT_RUN_STRIDE_M;
}

export function setRunStrideMeters(m: number) {
  localStorage.setItem(LS_RUN_STRIDE_M, String(m));
}

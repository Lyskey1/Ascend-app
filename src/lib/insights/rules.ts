import { format, subDays, addDays, startOfWeek, addWeeks } from 'date-fns';
import type { Finding, InsightData, InsightRule } from './types';
import {
  liftHistory, bestSample, weekWindows, sessionsInWindow, sessionVolume,
  patternVolumes, fmtKg, weekOverlapsVacation,
} from './helpers';
import { formatPace, runsInRange, pace4wAt } from '@/lib/running';

// ═════════════════════════════════════════════════════════
// Deterministic coaching rules. Each rule is documented, pure,
// and returns null when the data can't support a claim.
// ═════════════════════════════════════════════════════════

const DAY = 86400000;
const WEEK = 7 * DAY;

/** A lift qualifies as "main" with 6+ logged sessions over the trailing 8 weeks */
const MAIN_LIFT_MIN_SESSIONS = 6;

// ─── R1 · Progressive overload radar ─────────────────────
// Main lifts: best top set of the last 4 weeks vs the 4 weeks before.
// Weight decides; reps at equal weight break the tie.
const r1Overload: InsightRule = {
  id: 'R1',
  describe:
    'Compares best working-set load of the last 4 weeks vs the previous 4 for every lift with 6+ sessions in the trailing 8 weeks.',
  evaluate(data: InsightData): Finding | null {
    const since = data.asOf.getTime() - 8 * WEEK;
    const mid = data.asOf.getTime() - 4 * WEEK;
    const lifts = liftHistory(data.sessions, since);

    const improving: string[] = [];
    const holding: string[] = [];
    const regressing: string[] = [];
    let hasStrength = false;

    for (const { name, samples } of lifts.values()) {
      hasStrength = true;
      if (samples.length < MAIN_LIFT_MIN_SESSIONS) continue;
      const older = samples.filter((s) => s.date.getTime() < mid);
      const recent = samples.filter((s) => s.date.getTime() >= mid);
      if (older.length === 0 || recent.length === 0) continue;
      const before = bestSample(older)!;
      const after = bestSample(recent)!;
      const dw = after.weight - before.weight;
      if (dw > 0) {
        improving.push(`${name}: +${round1(dw)}kg top set (${round1(before.weight)}→${round1(after.weight)}kg)`);
      } else if (dw < 0) {
        regressing.push(`${name}: ${round1(dw)}kg (${round1(before.weight)}→${round1(after.weight)}kg)`);
      } else if (after.reps > before.reps) {
        improving.push(`${name}: +${after.reps - before.reps} reps @ ${round1(after.weight)}kg`);
      } else if (after.reps < before.reps) {
        regressing.push(`${name}: −${before.reps - after.reps} reps @ ${round1(after.weight)}kg`);
      } else {
        holding.push(`${name}: ${round1(after.weight)}kg × ${after.reps} held`);
      }
    }

    const total = improving.length + holding.length + regressing.length;
    if (total === 0) {
      if (!hasStrength) return null;
      return {
        id: 'overload-building',
        rule: 'R1',
        severity: 'info',
        impact: 10,
        headline: 'Building lifting history',
        detail: `Progressive-overload tracking needs ${MAIN_LIFT_MIN_SESSIONS}+ sessions per lift over 8 weeks. Keep logging — comparisons unlock soon.`,
        evidence: [],
        domain: 'training',
      };
    }

    const severity = regressing.length > improving.length ? 'warning' : improving.length > 0 ? 'good' : 'info';
    return {
      id: 'overload',
      rule: 'R1',
      severity,
      impact: 90,
      headline:
        severity === 'good'
          ? `Progressive overload: ${improving.length} of ${total} main lifts improving`
          : severity === 'warning'
            ? `Progressive overload: ${regressing.length} of ${total} main lifts regressing`
            : `Main lifts holding steady (${total} tracked)`,
      detail: 'Best working set over the last 4 weeks vs the 4 weeks before.',
      evidence: [...improving, ...holding, ...regressing],
      recommendation:
        regressing.length > improving.length
          ? 'Loads trending down across several lifts usually point to recovery or adherence, not strength loss — check sleep and week structure before changing the program.'
          : undefined,
      domain: 'training',
    };
  },
};

// ─── R2 · Plateau detection ──────────────────────────────
// A main lift with no improvement across its last 6+ sessions gets a
// standard-practice suggestion cycle (recovery check → deload / rep
// variation / volume bump), phrased as options.
const r2Plateau: InsightRule = {
  id: 'R2',
  describe:
    'Flags main lifts whose top set has not improved across their last 6+ sessions and suggests a deload, rep-range change, or volume bump.',
  evaluate(data: InsightData): Finding | null {
    const since = data.asOf.getTime() - 8 * WEEK;
    const lifts = liftHistory(data.sessions, since);
    const plateaued: string[] = [];

    for (const { name, samples } of lifts.values()) {
      if (samples.length < MAIN_LIFT_MIN_SESSIONS) continue;
      const window = samples.slice(-MAIN_LIFT_MIN_SESSIONS);
      const first = window[0];
      let improved = false;
      for (const s of window.slice(1)) {
        if (s.weight > first.weight || (s.weight === first.weight && s.reps > first.reps)) {
          improved = true;
          break;
        }
      }
      if (!improved) {
        plateaued.push(`${name}: ${window.length} sessions at ${round1(first.weight)}kg × ${first.reps}`);
      }
    }

    if (plateaued.length === 0) return null;

    // Recovery-first framing when sleep looks short
    const recentSleep = data.sleepEntries.filter(
      (e) => new Date(e.date + 'T12:00:00') >= subDays(data.asOf, 14)
    );
    const avgScore = recentSleep.length > 0
      ? Math.round(recentSleep.reduce((s, e) => s + e.sleepScore, 0) / recentSleep.length)
      : null;
    const recoveryNote = avgScore !== null && avgScore < 65
      ? ` Sleep averaged ${avgScore} over the last two weeks — recovery is the first thing to rule out.`
      : '';

    return {
      id: 'plateau',
      rule: 'R2',
      severity: 'warning',
      impact: 70,
      headline: `${plateaued.length} lift${plateaued.length > 1 ? 's' : ''} plateaued over 6+ sessions`,
      detail: `No top-set improvement across the last ${MAIN_LIFT_MIN_SESSIONS} sessions.${recoveryNote}`,
      evidence: plateaued,
      recommendation:
        'Options: a small deload (−10% for a week), a rep-range change (e.g. 8–10 → 5–7), or one extra set per session. Pick one, run it 2–3 weeks.',
      domain: 'training',
    };
  },
};

// ─── R3 · Muscle group balance ───────────────────────────
// Push vs pull volume over the last 4 weeks (pattern mapping derived
// from each exercise's primary muscle group). Sustained >1.5× imbalance
// gets the injury-prevention rationale.
const r3Balance: InsightRule = {
  id: 'R3',
  describe:
    'Checks the push/pull volume ratio per week over the last 4 weeks; flags sustained imbalance beyond 1.5×.',
  evaluate(data: InsightData): Finding | null {
    const exerciseById = new Map(data.exercises.map((e) => [e.id, e]));
    // Full completed weeks only — clipped windows would only ever see the
    // weekdays already elapsed and misread a split routine as imbalanced
    const thisWeekStart = startOfWeek(data.asOf, { weekStartsOn: 1 });
    const weeks = [4, 3, 2, 1].map((i) => ({
      weekStart: addWeeks(thisWeekStart, -i),
      end: addWeeks(thisWeekStart, -i + 1),
    }));
    let pushDominant = 0;
    let pullDominant = 0;
    let usable = 0;
    let totalPush = 0;
    let totalPull = 0;

    for (const w of weeks) {
      const vols = patternVolumes(sessionsInWindow(data.sessions, w), exerciseById);
      if (vols.push + vols.pull === 0) continue;
      usable++;
      totalPush += vols.push;
      totalPull += vols.pull;
      if (vols.pull === 0 || vols.push / vols.pull > 1.5) pushDominant++;
      else if (vols.push === 0 || vols.pull / vols.push > 1.5) pullDominant++;
    }

    if (usable < 2) return null; // too little data for a balance claim
    const ratio = totalPull > 0 ? totalPush / totalPull : Infinity;
    const ratioStr = isFinite(ratio) ? `${ratio.toFixed(1)}×` : 'no pull volume';
    const evidence = [
      `Push: ${fmtKg(totalPush)} over ${usable} week${usable > 1 ? 's' : ''}`,
      `Pull: ${fmtKg(totalPull)}`,
      `Ratio: ${ratioStr}`,
    ];

    if (pushDominant >= 3) {
      return {
        id: 'balance-push',
        rule: 'R3',
        severity: 'warning',
        impact: 60,
        headline: isFinite(ratio)
          ? `Push volume ${ratioStr} pull for ${pushDominant} of the last 4 weeks`
          : `Push work with no pull volume for ${pushDominant} of the last 4 weeks`,
        detail:
          'Sustained push-dominant training is a common shoulder-health risk factor. Patterns are derived from each exercise\'s primary muscle group (best-effort mapping).',
        evidence,
        recommendation: 'Add 2–3 weekly sets of rows or pulldowns until pull volume is within ~1.5× of push.',
        domain: 'training',
      };
    }
    if (pullDominant >= 3) {
      return {
        id: 'balance-pull',
        rule: 'R3',
        severity: 'info',
        impact: 40,
        headline: `Pull volume outweighs push ${isFinite(ratio) && ratio > 0 ? `(${(1 / ratio).toFixed(1)}×)` : ''} for ${pullDominant} of 4 weeks`,
        detail: 'Less risky than the reverse, but worth balancing over time. Patterns derived from primary muscle groups.',
        evidence,
        domain: 'training',
      };
    }
    return {
      id: 'balance-ok',
      rule: 'R3',
      severity: 'good',
      impact: 30,
      headline: `Push/pull balanced (${ratioStr} over 4 weeks)`,
      detail: 'Volume split across movement patterns looks healthy. Patterns derived from primary muscle groups.',
      evidence,
      domain: 'training',
    };
  },
};

// ─── R4 · Volume trend with context ──────────────────────
// 4-week like-for-like volume trend; vacation weeks are excluded from
// negative judgments, and falling volume is cross-read against
// bodyweight and running before it's called a problem.
const r4VolumeTrend: InsightRule = {
  id: 'R4',
  describe:
    'Classifies the 4-week volume trend (week-to-date aware), excluding vacation weeks from negative verdicts and cross-checking bodyweight and running context.',
  evaluate(data: InsightData): Finding | null {
    const weeks = weekWindows(data.asOf, 4, data.vacations);
    const vols = weeks.map((w) => ({
      ...w,
      volume: sessionsInWindow(data.sessions, w).reduce((t, s) => t + sessionVolume(s), 0),
    }));
    const usable = vols.filter((w) => !w.hasVacation);
    if (usable.length < 2 || usable.every((w) => w.volume === 0)) return null;

    const half = Math.floor(usable.length / 2);
    const olderAvg = avg(usable.slice(0, half).map((w) => w.volume));
    const recentAvg = avg(usable.slice(half).map((w) => w.volume));
    if (olderAvg === 0) return null;
    const changePct = ((recentAvg - olderAvg) / olderAvg) * 100;
    const trend = changePct > 10 ? 'rising' : changePct < -10 ? 'falling' : 'stable';
    const excludedNote = vols.some((w) => w.hasVacation)
      ? ` Vacation week${vols.filter((w) => w.hasVacation).length > 1 ? 's' : ''} excluded from the judgment.`
      : '';
    const evidence = usable.map((w) => `wk of ${w.label}: ${fmtKg(w.volume)}${''}`);

    if (trend === 'rising') {
      return {
        id: 'volume-rising',
        rule: 'R4',
        severity: 'good',
        impact: 55,
        headline: `Training volume rising (+${Math.round(changePct)}% over 4 weeks)`,
        detail: `Week-to-date comparisons, like-for-like.${excludedNote}`,
        evidence,
        domain: 'training',
      };
    }
    if (trend === 'stable') {
      return {
        id: 'volume-stable',
        rule: 'R4',
        severity: 'info',
        impact: 25,
        headline: `Training volume stable (${changePct >= 0 ? '+' : ''}${Math.round(changePct)}% over 4 weeks)`,
        detail: `Consistent workload.${excludedNote}`,
        evidence,
        domain: 'training',
      };
    }

    // Falling: add context before judging
    const bwRecent = avgBw(data, 0, 14);
    const bwPrev = avgBw(data, 14, 28);
    const bwRising = bwRecent !== null && bwPrev !== null && bwRecent - bwPrev >= 0.5;
    const runNow = kmInTrailingWeeks(data, 0, 2);
    const runPrev = kmInTrailingWeeks(data, 2, 4);
    const runsDeclining = runPrev > 0 && runNow < runPrev * 0.7;

    let detail = `Week-to-date comparisons, like-for-like.${excludedNote}`;
    let recommendation: string | undefined;
    if (bwRising) {
      detail = `Volume is down ${Math.abs(Math.round(changePct))}% while bodyweight moved up ${round1(bwRecent! - bwPrev!)}kg over two weeks — the combination is worth a look.${excludedNote}`;
      recommendation = 'If this isn\'t an intentional deload, restore your usual session count first — volume drives both strength and energy balance.';
    } else if (runsDeclining) {
      detail = `Both lifting volume and running (${round1(runPrev)}→${round1(runNow)}km bi-weekly) are trending down.${excludedNote}`;
      recommendation = 'Pick the one anchor session you never skip, and rebuild from there.';
    }

    return {
      id: 'volume-falling',
      rule: 'R4',
      severity: 'warning',
      impact: 65,
      headline: `Training volume falling (−${Math.abs(Math.round(changePct))}% over 4 weeks)`,
      detail,
      evidence,
      recommendation,
      domain: 'training',
    };
  },
};

// ─── R5 · Recovery signals ───────────────────────────────
// Speaks only when there is data: consecutive hard-day clustering plus
// sleep quality. Without sleep data it stays to a single quiet line.
const r5Recovery: InsightRule = {
  id: 'R5',
  describe:
    'When sleep is logged: flags 3+ consecutive high-volume days and low sleep during high load. Without sleep data: one quiet info line.',
  evaluate(data: InsightData): Finding | null {
    const since = subDays(data.asOf, 14);
    const sleep = data.sleepEntries.filter((e) => new Date(e.date + 'T12:00:00') >= since);
    if (sleep.length === 0) {
      return {
        id: 'recovery-nodata',
        rule: 'R5',
        severity: 'info',
        impact: 5,
        headline: 'No sleep data logged',
        detail: 'Log sleep in the Health tab to unlock recovery insights.',
        evidence: [],
        domain: 'recovery',
      };
    }
    const avgScore = Math.round(sleep.reduce((s, e) => s + e.sleepScore, 0) / sleep.length);

    // Hard-day clustering over the last 14 days
    const daily = new Map<string, number>();
    for (const s of data.sessions) {
      const d = new Date(s.startedAt);
      if (d < since || d > data.asOf) continue;
      const key = format(d, 'yyyy-MM-dd');
      daily.set(key, (daily.get(key) ?? 0) + sessionVolume(s));
    }
    const nonzero = [...daily.values()].filter((v) => v > 0);
    const hardThreshold = nonzero.length > 0 ? Math.max(...nonzero) * 0.75 : Infinity;
    let maxStreak = 0;
    let streak = 0;
    for (let i = 13; i >= 0; i--) {
      const key = format(subDays(data.asOf, i), 'yyyy-MM-dd');
      if ((daily.get(key) ?? 0) >= hardThreshold && hardThreshold > 0 && isFinite(hardThreshold)) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }

    if (maxStreak >= 3) {
      return {
        id: 'recovery-clustering',
        rule: 'R5',
        severity: 'warning',
        impact: 60,
        headline: `${maxStreak} consecutive high-volume days`,
        detail: `Hard sessions are clustering (sleep avg ${avgScore}). Spacing them gives each muscle group more recovery time.`,
        evidence: [`${maxStreak} consecutive days ≥75% of your biggest day`, `Sleep score avg: ${avgScore}`],
        recommendation: 'Slot an easy or rest day between your two biggest sessions.',
        domain: 'recovery',
      };
    }
    if (avgScore < 65) {
      return {
        id: 'recovery-sleep',
        rule: 'R5',
        severity: 'warning',
        impact: 50,
        headline: `Sleep averaging ${avgScore} over two weeks`,
        detail: 'Below-par sleep limits training adaptation before anything else does.',
        evidence: [`${sleep.length} nights logged`, `Avg score ${avgScore}`],
        recommendation: 'Aim for a consistent bedtime this week before touching the program.',
        domain: 'recovery',
      };
    }
    return {
      id: 'recovery-ok',
      rule: 'R5',
      severity: 'good',
      impact: 35,
      headline: `Recovery on track (sleep avg ${avgScore})`,
      detail: 'Sleep quality and session spacing both look sustainable.',
      evidence: [`${sleep.length} nights logged`, `Avg score ${avgScore}`],
      domain: 'recovery',
    };
  },
};

// ─── R6 · Running progression ────────────────────────────
// 4-week aggregate pace trend + weekly km: improving pace at stable+
// km is a highlight; >30% week-over-week km jumps get the standard
// overuse caution; long stagnation suggests one quality session.
const r6Running: InsightRule = {
  id: 'R6',
  describe:
    'Pace 4-week moving average vs 4 weeks earlier, weekly km jumps >30%, and 6-week stagnation → one quality session suggestion.',
  evaluate(data: InsightData): Finding | null {
    if (data.runs.length < 3) return null;
    const runs = data.runs.filter((r) => new Date(r.startedAt) <= data.asOf);
    if (runs.length < 3) return null;

    const paceNow = pace4wAt(runs, data.asOf);
    const pacePrev = pace4wAt(runs, subDays(data.asOf, 28));
    const pace6wAgo = pace4wAt(runs, subDays(data.asOf, 42));

    // Weekly km (full weeks) for jump + stability checks
    const thisWeekStart = startOfWeek(data.asOf, { weekStartsOn: 1 });
    const km = (i: number) => // i weeks back, full week
      runsInRange(runs, addWeeks(thisWeekStart, -i), addWeeks(thisWeekStart, -i + 1))
        .reduce((s, r) => s + r.distanceKm, 0);
    const lastFull = km(1);
    const prevFull = km(2);
    const last4 = km(1) + km(2) + km(3) + km(4);
    const prev4 = km(5) + km(6) + km(7) + km(8);

    // Overuse caution: >30% week-over-week jump with meaningful distance
    const currentWtd = runsInRange(runs, thisWeekStart, data.asOf).reduce((s, r) => s + r.distanceKm, 0);
    const jumpBase = lastFull > 0 ? lastFull : prevFull;
    const jumped =
      (prevFull >= 5 && lastFull > prevFull * 1.3) ||
      (lastFull >= 5 && currentWtd > lastFull * 1.3);
    if (jumped && jumpBase > 0) {
      const from = prevFull >= 5 && lastFull > prevFull * 1.3 ? prevFull : lastFull;
      const to = prevFull >= 5 && lastFull > prevFull * 1.3 ? lastFull : currentWtd;
      return {
        id: 'running-jump',
        rule: 'R6',
        severity: 'warning',
        impact: 65,
        headline: `Weekly running volume jumped +${Math.round(((to - from) / from) * 100)}%`,
        detail: `${round1(from)}km → ${round1(to)}km. Standard guidance keeps weekly increases under ~30% to limit overuse risk.`,
        evidence: [`${round1(from)}km → ${round1(to)}km week over week`],
        recommendation: 'Nothing wrong with a big week — just avoid stacking two in a row.',
        domain: 'running',
      };
    }

    // Improving pace at stable-or-rising volume
    if (paceNow != null && pacePrev != null) {
      const deltaSec = (pacePrev - paceNow) * 60; // positive = faster now
      const kmStable = prev4 === 0 || last4 >= prev4 * 0.9;
      if (deltaSec >= 5 && kmStable) {
        return {
          id: 'running-improving',
          rule: 'R6',
          severity: 'good',
          impact: 60,
          headline: `Pace improving: ${formatPace(paceNow)} (−${Math.round(deltaSec)}s/km over 4 weeks)`,
          detail: `4-week average pace moved from ${formatPace(pacePrev)} to ${formatPace(paceNow)} at ${prev4 > 0 ? 'stable' : 'building'} volume (${round1(last4)}km/4wk).`,
          evidence: [
            `${formatPace(pacePrev)} → ${formatPace(paceNow)} (4-wk avg)`,
            `${round1(last4)}km over the last 4 weeks`,
          ],
          domain: 'running',
        };
      }
      // Stagnation: 6+ weeks of running, pace flat, km flat
      const sixWeeksOfHistory = runs.length >= 6 &&
        new Date(runs[0].startedAt) <= subDays(data.asOf, 42);
      if (
        sixWeeksOfHistory &&
        pace6wAgo != null &&
        Math.abs((pace6wAgo - paceNow) * 60) < 5 &&
        prev4 > 0 &&
        Math.abs(last4 - prev4) / prev4 < 0.15
      ) {
        return {
          id: 'running-stagnant',
          rule: 'R6',
          severity: 'info',
          impact: 40,
          headline: `Pace flat around ${formatPace(paceNow)} for 6+ weeks`,
          detail: `Same weekly distance at the same pace stops producing adaptation after a while (${round1(last4)}km/4wk, unchanged).`,
          evidence: [`4-wk avg pace ${formatPace(paceNow)}, ±5s/km over 6 weeks`],
          recommendation: 'Swap one easy run per week for a quality session — intervals or a 20-minute tempo.',
          domain: 'running',
        };
      }
    }
    return null;
  },
};

// ─── R7 · Consistency ────────────────────────────────────
// Planned (template × scheduled weekday) slots vs completed sessions
// over the last 4 non-vacation weeks, plus the single most-missed slot.
const r7Consistency: InsightRule = {
  id: 'R7',
  describe:
    'Completion rate of planned weekly slots over the last 4 weeks (vacation weeks excluded) and the most frequently missed slot.',
  evaluate(data: InsightData): Finding | null {
    const DAY_NUM: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
    };
    const slots: { templateId: string; name: string; dayNum: number; day: string }[] = [];
    for (const t of data.templates) {
      for (const day of t.day ?? []) {
        if (DAY_NUM[day] !== undefined) slots.push({ templateId: t.id, name: t.name, dayNum: DAY_NUM[day], day });
      }
    }
    if (slots.length === 0) return null;

    const completedByDate = new Map<string, Set<string>>();
    for (const s of data.sessions) {
      const key = format(new Date(s.startedAt), 'yyyy-MM-dd');
      if (!completedByDate.has(key)) completedByDate.set(key, new Set());
      completedByDate.get(key)!.add(s.templateId);
    }

    const thisWeekStart = startOfWeek(data.asOf, { weekStartsOn: 1 });
    let planned = 0;
    let done = 0;
    const missCount = new Map<string, { label: string; n: number }>();

    for (let i = 4; i >= 1; i--) {
      const weekStart = addWeeks(thisWeekStart, -i);
      if (weekOverlapsVacation(weekStart, addWeeks(weekStart, 1), data.vacations)) continue;
      for (const slot of slots) {
        const offset = (slot.dayNum - 1 + 7) % 7; // Monday-start offset
        const slotDate = format(addDays(weekStart, offset), 'yyyy-MM-dd');
        planned++;
        if (completedByDate.get(slotDate)?.has(slot.templateId)) {
          done++;
        } else {
          const key = `${slot.day}|${slot.name}`;
          const cur = missCount.get(key) ?? { label: `${slot.day} — ${slot.name}`, n: 0 };
          cur.n++;
          missCount.set(key, cur);
        }
      }
    }
    if (planned === 0) return null;

    const rate = done / planned;
    const worst = [...missCount.values()].sort((a, b) => b.n - a.n)[0];
    const evidence = [`${done}/${planned} planned sessions over 4 weeks`];
    if (worst && worst.n >= 2) evidence.push(`Most missed: ${worst.label} (${worst.n}×)`);

    if (rate >= 0.9) {
      return {
        id: 'consistency-high',
        rule: 'R7',
        severity: 'good',
        impact: 70,
        headline: `Highly consistent: ${done}/${planned} planned sessions completed`,
        detail: 'Adherence is the strongest predictor of long-term progress — this is the thing to protect.',
        evidence,
        domain: 'consistency',
      };
    }
    const recommendation = worst && worst.n >= 2
      ? `The miss is almost always the same slot — make ${worst.label} the one you protect, or move it to a day that fits.`
      : 'Pick the single most skipped session and anchor it to a fixed time.';
    return {
      id: rate >= 0.7 ? 'consistency-mid' : 'consistency-low',
      rule: 'R7',
      severity: rate >= 0.7 ? 'info' : 'warning',
      impact: rate >= 0.7 ? 45 : 75,
      headline: `${done}/${planned} planned sessions over the last 4 weeks (${Math.round(rate * 100)}%)`,
      detail: worst && worst.n >= 2
        ? `The missed slot is usually ${worst.label}.`
        : 'Misses are spread across the week.',
      evidence,
      recommendation,
      domain: 'consistency',
    };
  },
};

export const RULES: InsightRule[] = [
  r1Overload,
  r2Plateau,
  r3Balance,
  r4VolumeTrend,
  r5Recovery,
  r6Running,
  r7Consistency,
];

// ─── Small local helpers ─────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function avgBw(data: InsightData, fromDaysAgo: number, toDaysAgo: number): number | null {
  const from = subDays(data.asOf, toDaysAgo);
  const to = subDays(data.asOf, fromDaysAgo);
  const entries = data.bodyweightEntries.filter((e) => {
    const d = new Date(e.date + 'T12:00:00');
    return d >= from && d < to;
  });
  if (entries.length === 0) return null;
  return entries.reduce((s, e) => s + e.weight, 0) / entries.length;
}

function kmInTrailingWeeks(data: InsightData, fromWeeksAgo: number, toWeeksAgo: number): number {
  const end = subDays(data.asOf, fromWeeksAgo * 7);
  const start = subDays(data.asOf, toWeeksAgo * 7);
  return data.runs
    .filter((r) => {
      const d = new Date(r.startedAt);
      return d >= start && d < end;
    })
    .reduce((s, r) => s + r.distanceKm, 0);
}

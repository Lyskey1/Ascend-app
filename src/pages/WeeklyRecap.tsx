import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight as ChevronRightIcon, Trophy, Heart, Footprints,
  Moon, Scale, Dumbbell, TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertTriangle, Target, Flame, Zap,
} from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  eachDayOfInterval, isAfter, isBefore, isSameDay,
} from 'date-fns';
import { Card, CardTitle } from '@/components/ui/Card';
import {
  useSessions, useBodyweightEntries, useStepEntries, useSleepEntries, useTemplates,
} from '@/hooks/useWorkout';
import { getRestDay } from '@/hooks/useScheduleSettings';
import type { WorkoutSession, SleepEntry, StepEntry, BodyweightEntry } from '@/db/types';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function roundAvg(arr: number[]): number {
  return Math.round(avg(arr));
}

function fmtSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function durationStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function pctStr(current: number, previous: number): string {
  if (previous === 0) return '';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Solid';
  if (score >= 40) return 'Mixed';
  return 'Off-track';
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 55) return 'text-zinc-200';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBorder(score: number): string {
  if (score >= 85) return 'border-emerald-500/30';
  if (score >= 70) return 'border-blue-500/30';
  if (score >= 55) return 'border-zinc-600/30';
  if (score >= 40) return 'border-amber-500/30';
  return 'border-red-500/30';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-500/8';
  if (score >= 70) return 'bg-blue-500/8';
  if (score >= 55) return 'bg-zinc-500/8';
  if (score >= 40) return 'bg-amber-500/8';
  return 'bg-red-500/8';
}

function minutesToTimeStr(mins: number): string {
  let m = mins;
  if (m < 0) m += 1440;
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

function normalizeBedtime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  if (mins >= 1080) return mins - 1440;
  return mins;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ═══════════════════════════════════════════════════════
// Data extraction for a given week
// ═══════════════════════════════════════════════════════

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  sessions: WorkoutSession[];
  sleepEntries: SleepEntry[];
  stepEntries: StepEntry[];
  bwEntries: BodyweightEntry[];
  latestBw: BodyweightEntry | null;
  prevWeekSessions: WorkoutSession[];
  prevWeekSleep: SleepEntry[];
  prevWeekSteps: StepEntry[];
  prevWeekBw: BodyweightEntry[];
  plannedDays: number;
}

function useWeekData(weekOffset: number) {
  const allSessions = useSessions();
  const allBw = useBodyweightEntries();
  const allSteps = useStepEntries();
  const allSleep = useSleepEntries();
  const templates = useTemplates();

  return useMemo(() => {
    const base = weekOffset === 0 ? new Date() : addWeeks(new Date(), weekOffset);
    const weekStart = startOfWeek(base, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(base, { weekStartsOn: 1 });
    const prevStart = subWeeks(weekStart, 1);
    const prevEnd = subWeeks(weekEnd, 1);

    const inWeek = (dateStr: string, start: Date, end: Date) => {
      const d = new Date(dateStr);
      return !isBefore(d, start) && !isAfter(d, end);
    };

    const inWeekSession = (s: WorkoutSession, start: Date, end: Date) => {
      const d = new Date(s.startedAt);
      return !isBefore(d, start) && !isAfter(d, end);
    };

    const sessions = allSessions.filter((s) => inWeekSession(s, weekStart, weekEnd));
    const prevWeekSessions = allSessions.filter((s) => inWeekSession(s, prevStart, prevEnd));

    const sleepEntries = allSleep
      .filter((e) => inWeek(e.date, weekStart, weekEnd))
      .sort((a, b) => a.date.localeCompare(b.date));
    const prevWeekSleep = allSleep
      .filter((e) => inWeek(e.date, prevStart, prevEnd));

    const stepEntries = allSteps
      .filter((e) => inWeek(e.date, weekStart, weekEnd))
      .sort((a, b) => a.date.localeCompare(b.date));
    const prevWeekSteps = allSteps
      .filter((e) => inWeek(e.date, prevStart, prevEnd));

    const bwSorted = [...allBw].sort((a, b) => a.date.localeCompare(b.date));
    const bwEntries = bwSorted.filter((e) => inWeek(e.date, weekStart, weekEnd));
    const prevWeekBw = bwSorted.filter((e) => inWeek(e.date, prevStart, prevEnd));

    // Latest bodyweight (fallback to any entry before/during the week)
    const latestBw = bwSorted.filter((e) => !isAfter(new Date(e.date), weekEnd)).pop() ?? null;

    // Planned days from templates
    const DAY_MAP: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
      Friday: 5, Saturday: 6, Sunday: 0,
    };
    const scheduledDays = new Set<number>();
    for (const t of templates) {
      if (t.day) {
        for (const d of t.day) {
          const num = DAY_MAP[d];
          if (num !== undefined) scheduledDays.add(num);
        }
      }
    }
    const plannedDays = scheduledDays.size || sessions.length; // fallback

    return {
      weekStart, weekEnd, sessions, sleepEntries, stepEntries,
      bwEntries, latestBw, prevWeekSessions, prevWeekSleep,
      prevWeekSteps, prevWeekBw, plannedDays,
    } as WeekData;
  }, [weekOffset, allSessions, allBw, allSteps, allSleep, templates]);
}

// ═══════════════════════════════════════════════════════
// Scoring engine
// ═══════════════════════════════════════════════════════

interface Scores {
  training: number;
  recovery: number;
  weekly: number;
  trainingLabel: string;
  recoveryLabel: string;
  weeklyLabel: string;
}

interface TrainingBreakdown {
  strengthCount: number;
  cardioCount: number;
  totalVolume: number;
  adherence: number; // 0-100
  bestSession: { name: string; volume: number } | null;
  progressionSignal: 'up' | 'down' | 'stable';
  prevVolume: number;
  prevCount: number;
}

interface SleepBreakdown {
  avgScore: number;
  avgDuration: number;
  avgBedtime: number | null;
  bedtimeConsistency: number | null; // std dev minutes
  bestNight: SleepEntry | null;
  worstNight: SleepEntry | null;
  prevAvgScore: number;
  prevAvgDuration: number;
  entryCount: number;
}

interface StepsBreakdown {
  avgSteps: number;
  totalSteps: number;
  bestDay: StepEntry | null;
  lowestDay: StepEntry | null;
  prevAvgSteps: number;
  entryCount: number;
}

interface BwBreakdown {
  weekAvg: number | null;
  prevWeekAvg: number | null;
  latest: BodyweightEntry | null;
  change: number | null;
  entryCount: number;
}

function computeScores(data: WeekData): {
  scores: Scores;
  training: TrainingBreakdown;
  sleep: SleepBreakdown;
  steps: StepsBreakdown;
  bw: BwBreakdown;
} {
  // ── Training ──────────────────────────────────────
  const strengthSessions = data.sessions.filter((s) =>
    s.exercises.some((e) => e.sets.some((set) => set.completed && (set.weight ?? 0) > 0))
  );
  const cardioSessions = data.sessions.filter((s) =>
    s.exercises.some((e) => e.exerciseType === 'cardio' || (e.cardioDuration && e.cardioDuration > 0))
  );

  const totalVolume = data.sessions.reduce((sum, s) =>
    sum + s.exercises.reduce((eSum, e) =>
      eSum + e.sets.reduce((sSum, set) => sSum + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0), 0), 0);

  const prevVolume = data.prevWeekSessions.reduce((sum, s) =>
    sum + s.exercises.reduce((eSum, e) =>
      eSum + e.sets.reduce((sSum, set) => sSum + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0), 0), 0);

  const adherence = data.plannedDays > 0
    ? clamp((data.sessions.length / data.plannedDays) * 100, 0, 100)
    : (data.sessions.length > 0 ? 75 : 0);

  // Best session by volume
  let bestSession: { name: string; volume: number } | null = null;
  for (const s of data.sessions) {
    const vol = s.exercises.reduce((eSum, e) =>
      eSum + e.sets.reduce((sSum, set) => sSum + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0), 0);
    if (!bestSession || vol > bestSession.volume) {
      bestSession = { name: s.templateName, volume: vol };
    }
  }

  // Progression signal (volume vs prev week)
  let progressionSignal: 'up' | 'down' | 'stable' = 'stable';
  if (prevVolume > 0) {
    const volChange = ((totalVolume - prevVolume) / prevVolume) * 100;
    if (volChange > 5) progressionSignal = 'up';
    else if (volChange < -5) progressionSignal = 'down';
  }

  // Training score: adherence (50%) + volume trend (25%) + session count (25%)
  const adherenceScore = adherence;
  const volumeTrendScore = prevVolume > 0
    ? clamp(50 + ((totalVolume - prevVolume) / prevVolume) * 50, 0, 100)
    : (totalVolume > 0 ? 60 : 0);
  const countScore = data.sessions.length >= 5 ? 100
    : data.sessions.length >= 4 ? 85
    : data.sessions.length >= 3 ? 70
    : data.sessions.length >= 2 ? 50
    : data.sessions.length >= 1 ? 30 : 0;

  const trainingScore = Math.round(adherenceScore * 0.5 + volumeTrendScore * 0.25 + countScore * 0.25);

  const trainingBreakdown: TrainingBreakdown = {
    strengthCount: strengthSessions.length,
    cardioCount: cardioSessions.length,
    totalVolume: Math.round(totalVolume),
    adherence: Math.round(adherence),
    bestSession,
    progressionSignal,
    prevVolume: Math.round(prevVolume),
    prevCount: data.prevWeekSessions.length,
  };

  // ── Sleep ─────────────────────────────────────────
  const sleepScores = data.sleepEntries.map((e) => e.sleepScore);
  const sleepDurations = data.sleepEntries.map((e) => e.sleepDuration);
  const bedtimes = data.sleepEntries.filter((e) => e.bedtime).map((e) => normalizeBedtime(e.bedtime!));

  const avgSleepScore = roundAvg(sleepScores);
  const avgSleepDuration = roundAvg(sleepDurations);
  const avgBedtime = bedtimes.length > 0 ? Math.round(avg(bedtimes)) : null;

  let bedtimeConsistency: number | null = null;
  if (bedtimes.length >= 3) {
    const mean = avg(bedtimes);
    const variance = bedtimes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / bedtimes.length;
    bedtimeConsistency = Math.round(Math.sqrt(variance));
  }

  const bestNight = data.sleepEntries.length > 0
    ? data.sleepEntries.reduce((best, e) => e.sleepScore > best.sleepScore ? e : best)
    : null;
  const worstNight = data.sleepEntries.length > 0
    ? data.sleepEntries.reduce((worst, e) => e.sleepScore < worst.sleepScore ? e : worst)
    : null;

  const prevSleepScores = data.prevWeekSleep.map((e) => e.sleepScore);
  const prevAvgSleepScore = roundAvg(prevSleepScores);
  const prevAvgSleepDuration = roundAvg(data.prevWeekSleep.map((e) => e.sleepDuration));

  // Recovery score: sleep score (50%) + sleep duration (25%) + bedtime consistency (25%)
  const sleepScoreComponent = avgSleepScore; // already 0-100
  const durationComponent = avgSleepDuration > 0
    ? clamp((avgSleepDuration / 480) * 100, 0, 100) // 8h = 100
    : 0;
  const consistencyComponent = bedtimeConsistency !== null
    ? clamp(100 - bedtimeConsistency * 1.5, 0, 100) // 0min variance = 100, 66min = 0
    : 50; // neutral if no data

  const hasSleepData = data.sleepEntries.length > 0;
  const recoveryScore = hasSleepData
    ? Math.round(sleepScoreComponent * 0.5 + durationComponent * 0.25 + consistencyComponent * 0.25)
    : 0;

  const sleepBreakdown: SleepBreakdown = {
    avgScore: avgSleepScore,
    avgDuration: avgSleepDuration,
    avgBedtime,
    bedtimeConsistency,
    bestNight,
    worstNight,
    prevAvgScore: prevAvgSleepScore,
    prevAvgDuration: prevAvgSleepDuration,
    entryCount: data.sleepEntries.length,
  };

  // ── Steps ─────────────────────────────────────────
  const stepCounts = data.stepEntries.map((e) => e.stepCount);
  const avgSteps = roundAvg(stepCounts);
  const totalSteps = stepCounts.reduce((a, b) => a + b, 0);
  const prevAvgSteps = roundAvg(data.prevWeekSteps.map((e) => e.stepCount));

  const bestDay = data.stepEntries.length > 0
    ? data.stepEntries.reduce((best, e) => e.stepCount > best.stepCount ? e : best)
    : null;
  const lowestDay = data.stepEntries.length > 0
    ? data.stepEntries.reduce((low, e) => e.stepCount < low.stepCount ? e : low)
    : null;

  const stepsBreakdown: StepsBreakdown = {
    avgSteps, totalSteps, bestDay, lowestDay, prevAvgSteps,
    entryCount: data.stepEntries.length,
  };

  // ── Bodyweight ────────────────────────────────────
  const bwWeights = data.bwEntries.map((e) => e.weight);
  const weekAvg = bwWeights.length > 0 ? Math.round(avg(bwWeights) * 10) / 10 : null;
  const prevBwWeights = data.prevWeekBw.map((e) => e.weight);
  const prevWeekAvg = prevBwWeights.length > 0 ? Math.round(avg(prevBwWeights) * 10) / 10 : null;
  const bwChange = weekAvg !== null && prevWeekAvg !== null ? Math.round((weekAvg - prevWeekAvg) * 10) / 10 : null;

  const bwBreakdown: BwBreakdown = {
    weekAvg,
    prevWeekAvg,
    latest: data.latestBw,
    change: bwChange,
    entryCount: data.bwEntries.length,
  };

  // ── Movement score (for weekly) ───────────────────
  const movementScore = avgSteps > 0
    ? clamp((avgSteps / 10000) * 100, 0, 100)
    : 0;

  // ── Bodyweight stability score ────────────────────
  let bwStabilityScore = 50; // neutral
  if (bwWeights.length >= 2) {
    const bwStdDev = Math.sqrt(bwWeights.reduce((sum, w) => sum + Math.pow(w - avg(bwWeights), 2), 0) / bwWeights.length);
    bwStabilityScore = clamp(100 - bwStdDev * 20, 0, 100); // low variance = high stability
  }

  // ── Weekly Score ──────────────────────────────────
  // 35% training + 30% recovery + 20% movement + 15% stability
  const hasAnyData = data.sessions.length > 0 || hasSleepData || data.stepEntries.length > 0;
  const weeklyScore = hasAnyData
    ? Math.round(
        trainingScore * 0.35 +
        recoveryScore * 0.30 +
        movementScore * 0.20 +
        bwStabilityScore * 0.15
      )
    : 0;

  return {
    scores: {
      training: clamp(trainingScore, 0, 100),
      recovery: clamp(recoveryScore, 0, 100),
      weekly: clamp(weeklyScore, 0, 100),
      trainingLabel: scoreLabel(trainingScore),
      recoveryLabel: scoreLabel(recoveryScore),
      weeklyLabel: scoreLabel(weeklyScore),
    },
    training: trainingBreakdown,
    sleep: sleepBreakdown,
    steps: stepsBreakdown,
    bw: bwBreakdown,
  };
}

// ═══════════════════════════════════════════════════════
// Takeaways & Insights Generator
// ═══════════════════════════════════════════════════════

function generateTakeaways(
  scores: Scores,
  training: TrainingBreakdown,
  sleep: SleepBreakdown,
  steps: StepsBreakdown,
  bw: BwBreakdown,
): string[] {
  const takeaways: string[] = [];

  // Training
  if (training.adherence >= 90) {
    takeaways.push('Training consistency was excellent this week, with all planned sessions completed.');
  } else if (training.adherence >= 70) {
    takeaways.push('Training consistency was solid — most planned sessions were completed.');
  } else if (training.strengthCount + training.cardioCount > 0) {
    takeaways.push(`Training was lighter than planned this week, with ${training.strengthCount + training.cardioCount} session${training.strengthCount + training.cardioCount > 1 ? 's' : ''} completed.`);
  } else if (training.strengthCount + training.cardioCount === 0) {
    takeaways.push('No training sessions were logged this week.');
  }

  // Volume progression
  if (training.prevVolume > 0 && training.totalVolume > 0) {
    if (training.progressionSignal === 'up') {
      takeaways.push(`Training volume increased compared to last week (${pctStr(training.totalVolume, training.prevVolume)}), suggesting good progression.`);
    } else if (training.progressionSignal === 'down') {
      takeaways.push(`Training volume dropped versus last week (${pctStr(training.totalVolume, training.prevVolume)}), which may reflect a lighter week or missed sessions.`);
    }
  }

  // Sleep
  if (sleep.entryCount > 0) {
    if (sleep.avgScore >= 80) {
      takeaways.push(`Sleep quality was strong this week with an average score of ${sleep.avgScore}.`);
    } else if (sleep.avgScore >= 60) {
      const consistency = sleep.bedtimeConsistency !== null && sleep.bedtimeConsistency > 45
        ? ' Bedtime was inconsistent, which may have affected quality.'
        : '';
      takeaways.push(`Sleep quality was decent (avg ${sleep.avgScore}) but has room for improvement.${consistency}`);
    } else {
      takeaways.push(`Sleep quality was low this week (avg ${sleep.avgScore}), which likely impacted recovery and performance.`);
    }
  }

  // Steps
  if (steps.entryCount > 0) {
    if (steps.prevAvgSteps > 0 && steps.avgSteps < steps.prevAvgSteps * 0.85) {
      takeaways.push(`Daily movement dropped compared to last week (${fmtSteps(steps.avgSteps)} vs ${fmtSteps(steps.prevAvgSteps)} avg), which may have limited recovery.`);
    } else if (steps.avgSteps >= 10000) {
      takeaways.push(`Daily movement was excellent this week with an average of ${fmtSteps(steps.avgSteps)} steps.`);
    } else if (steps.avgSteps >= 7000) {
      takeaways.push(`Daily movement was solid, averaging ${fmtSteps(steps.avgSteps)} steps per day.`);
    }
  }

  // Bodyweight
  if (bw.weekAvg !== null && bw.prevWeekAvg !== null) {
    const diff = Math.abs(bw.change ?? 0);
    if (diff <= 0.3) {
      takeaways.push('Bodyweight remained stable this week, suggesting a balanced energy intake.');
    } else if ((bw.change ?? 0) > 0) {
      takeaways.push(`Bodyweight increased slightly (+${diff}kg) compared to last week.`);
    } else {
      takeaways.push(`Bodyweight decreased slightly (-${diff}kg) compared to last week.`);
    }
  }

  return takeaways.slice(0, 5);
}

function generateCoachSummary(
  scores: Scores,
  training: TrainingBreakdown,
  sleep: SleepBreakdown,
  steps: StepsBreakdown,
  bw: BwBreakdown,
): string {
  const parts: string[] = [];

  // Opening
  if (scores.weekly >= 80) {
    parts.push('You had a strong week overall.');
  } else if (scores.weekly >= 60) {
    parts.push('This was a solid week with room to tighten a few areas.');
  } else if (scores.weekly >= 40) {
    parts.push('This week was mixed.');
  } else {
    parts.push('This was a lighter week.');
  }

  // Training
  if (training.adherence >= 80) {
    parts.push('Training consistency was high');
    if (training.progressionSignal === 'up') parts[parts.length - 1] += ' and volume progressed well.';
    else parts[parts.length - 1] += '.';
  } else if (training.strengthCount + training.cardioCount > 0) {
    parts.push('Training output was below the usual level.');
  } else {
    parts.push('No training was logged.');
  }

  // Recovery
  if (sleep.entryCount > 0) {
    if (sleep.avgScore >= 75) {
      parts.push('Sleep quality supported recovery well.');
    } else if (sleep.avgScore >= 55) {
      parts.push('Sleep was acceptable but could be optimized for better recovery.');
    } else {
      parts.push('Sleep quality was low, which likely limited recovery capacity.');
    }
  }

  // Movement + BW synthesis
  const movementNote = steps.entryCount > 0 && steps.avgSteps < 6000
    ? 'Daily movement was on the lower side.'
    : '';
  const bwNote = bw.change !== null && Math.abs(bw.change) > 0.5
    ? `Bodyweight shifted ${bw.change > 0 ? 'up' : 'down'} slightly.`
    : '';

  if (movementNote) parts.push(movementNote);
  if (bwNote) parts.push(bwNote);

  return parts.join(' ');
}

function generateWentWell(
  scores: Scores,
  training: TrainingBreakdown,
  sleep: SleepBreakdown,
  steps: StepsBreakdown,
  bw: BwBreakdown,
): string[] {
  const items: string[] = [];
  if (training.adherence >= 80) items.push('Strong training adherence');
  if (training.progressionSignal === 'up') items.push('Volume progressed vs last week');
  if (sleep.avgScore >= 75) items.push('Good sleep quality');
  if (sleep.bedtimeConsistency !== null && sleep.bedtimeConsistency <= 30) items.push('Consistent bedtime');
  if (steps.avgSteps >= 8000) items.push('Solid daily movement');
  if (bw.weekAvg !== null && bw.change !== null && Math.abs(bw.change) <= 0.3) items.push('Stable bodyweight');
  if (training.bestSession && training.bestSession.volume > 0) items.push(`Strong session: ${training.bestSession.name}`);
  return items.length > 0 ? items.slice(0, 4) : ['Data is limited — log more consistently to unlock insights'];
}

function generateNeedsAttention(
  scores: Scores,
  training: TrainingBreakdown,
  sleep: SleepBreakdown,
  steps: StepsBreakdown,
  bw: BwBreakdown,
): string[] {
  const items: string[] = [];
  if (training.adherence < 70 && training.adherence > 0) items.push('Training consistency below target');
  if (training.progressionSignal === 'down') items.push('Training volume declined');
  if (sleep.avgScore > 0 && sleep.avgScore < 65) items.push('Sleep quality needs improvement');
  if (sleep.bedtimeConsistency !== null && sleep.bedtimeConsistency > 45) items.push('Bedtime was inconsistent');
  if (sleep.avgDuration > 0 && sleep.avgDuration < 420) items.push('Sleep duration below 7 hours');
  if (steps.avgSteps > 0 && steps.avgSteps < 6000) items.push('Daily movement is low');
  if (steps.prevAvgSteps > 0 && steps.avgSteps < steps.prevAvgSteps * 0.8) items.push('Steps dropped vs last week');
  if (bw.entryCount === 0) items.push('No bodyweight logged this week');
  return items.length > 0 ? items.slice(0, 4) : ['Nothing major — keep it up'];
}

function generateNextWeekFocus(
  scores: Scores,
  training: TrainingBreakdown,
  sleep: SleepBreakdown,
  steps: StepsBreakdown,
  bw: BwBreakdown,
): string[] {
  const items: string[] = [];
  if (training.adherence >= 80) {
    items.push('Maintain your current training consistency');
  } else {
    items.push('Aim to complete all planned sessions');
  }

  if (sleep.avgScore > 0 && sleep.avgScore < 70) {
    items.push('Prioritize sleep quality — try an earlier bedtime');
  } else if (sleep.bedtimeConsistency !== null && sleep.bedtimeConsistency > 40) {
    items.push('Stabilize your bedtime within a 30-minute window');
  }

  if (steps.avgSteps > 0 && steps.avgSteps < 7500) {
    items.push('Raise daily steps closer to 8–10k on rest days');
  }

  if (bw.entryCount === 0) {
    items.push('Log bodyweight at least 3 times this week');
  }

  return items.slice(0, 3);
}

// ═══════════════════════════════════════════════════════
// Score Card Component
// ═══════════════════════════════════════════════════════

function ScoreCard({ label, score, sublabel, icon: Icon }: {
  label: string;
  score: number;
  sublabel: string;
  icon: React.ElementType;
}) {
  return (
    <div className={`rounded-2xl border ${scoreBorder(score)} ${scoreBg(score)} p-4 text-center`}>
      <Icon className={`h-5 w-5 mx-auto mb-2 ${scoreColor(score)}`} strokeWidth={1.5} />
      <p className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</p>
      <p className="text-[11px] font-semibold text-zinc-300 mt-1">{label}</p>
      <p className={`text-[10px] mt-0.5 ${scoreColor(score)}`}>{sublabel}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Mini sparkline helpers
// ═══════════════════════════════════════════════════════

function MiniBar({ data, color }: { data: { v: number }[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <Bar dataKey="v" radius={[2, 2, 0, 0]} opacity={0.7}>
            {data.map((_, i) => <Cell key={i} fill={color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniLine({ data, color }: { data: { v: number }[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line dataKey="v" type="monotone" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════════

export function WeeklyRecap() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const data = useWeekData(weekOffset);
  const { scores, training, sleep, steps, bw } = useMemo(() => computeScores(data), [data]);
  const takeaways = useMemo(() => generateTakeaways(scores, training, sleep, steps, bw), [scores, training, sleep, steps, bw]);
  const coachSummary = useMemo(() => generateCoachSummary(scores, training, sleep, steps, bw), [scores, training, sleep, steps, bw]);
  const wentWell = useMemo(() => generateWentWell(scores, training, sleep, steps, bw), [scores, training, sleep, steps, bw]);
  const needsAttention = useMemo(() => generateNeedsAttention(scores, training, sleep, steps, bw), [scores, training, sleep, steps, bw]);
  const nextFocus = useMemo(() => generateNextWeekFocus(scores, training, sleep, steps, bw), [scores, training, sleep, steps, bw]);

  const isCurrentWeek = weekOffset === 0;
  const weekLabel = `${format(data.weekStart, 'MMM d')} – ${format(data.weekEnd, 'MMM d')}`;

  // Mini chart data
  const sleepSparkData = data.sleepEntries.map((e) => ({ v: e.sleepScore }));
  const stepsSparkData = data.stepEntries.map((e) => ({ v: e.stepCount }));
  const bwSparkData = data.bwEntries.map((e) => ({ v: e.weight }));

  const hasAnyData = data.sessions.length > 0 || data.sleepEntries.length > 0 || data.stepEntries.length > 0;

  return (
    <div className="space-y-5 px-4 pt-14 pb-28">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="rounded-full p-1.5 text-zinc-400 active:text-zinc-200 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-zinc-50">Weekly Recap</h1>
          <div className="flex items-center justify-center gap-3 mt-0.5">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1 text-zinc-500 active:text-zinc-300"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-zinc-400 min-w-[120px]">{weekLabel}</span>
            <button
              onClick={() => setWeekOffset((w) => Math.min(w + 1, 0))}
              className={`p-1 ${isCurrentWeek ? 'text-zinc-700' : 'text-zinc-500 active:text-zinc-300'}`}
              disabled={isCurrentWeek}
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="w-8" /> {/* spacer */}
      </div>

      {!hasAnyData ? (
        <Card className="py-12 text-center">
          <p className="text-zinc-400 text-sm">No data logged for this week.</p>
          <p className="text-zinc-600 text-xs mt-1">Train, sleep, and move to unlock your recap.</p>
        </Card>
      ) : (
        <>
          {/* ── Hero Scores ──────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5">
            <ScoreCard
              label="Weekly"
              score={scores.weekly}
              sublabel={scores.weeklyLabel}
              icon={Trophy}
            />
            <ScoreCard
              label="Training"
              score={scores.training}
              sublabel={scores.trainingLabel}
              icon={Dumbbell}
            />
            <ScoreCard
              label="Recovery"
              score={scores.recovery}
              sublabel={scores.recoveryLabel}
              icon={Heart}
            />
          </div>

          {/* ── Main Takeaways ───────────────────────── */}
          <Card>
            <CardTitle className="mb-3">Main Takeaways</CardTitle>
            <div className="space-y-2.5">
              {takeaways.map((t, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <p className="text-sm text-zinc-300 leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Coach Summary ────────────────────────── */}
          <Card className="border-zinc-700/40 bg-zinc-900/70">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Coach Summary</p>
                <p className="text-sm text-zinc-200 leading-relaxed">{coachSummary}</p>
              </div>
            </div>
          </Card>

          {/* ── Training Breakdown ────────────────────── */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell className="h-4 w-4 text-zinc-400" />
              <CardTitle>Training</CardTitle>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Strength</p>
                <p className="text-lg font-bold text-zinc-100">{training.strengthCount} <span className="text-sm font-normal text-zinc-500">sessions</span></p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Cardio</p>
                <p className="text-lg font-bold text-zinc-100">{training.cardioCount} <span className="text-sm font-normal text-zinc-500">sessions</span></p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Volume</p>
                <p className="text-lg font-bold text-zinc-100">
                  {training.totalVolume >= 1000 ? `${(training.totalVolume / 1000).toFixed(1)}t` : `${training.totalVolume}kg`}
                </p>
                {training.prevVolume > 0 && (
                  <p className={`text-[10px] ${training.totalVolume >= training.prevVolume ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pctStr(training.totalVolume, training.prevVolume)} vs last week
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Adherence</p>
                <p className="text-lg font-bold text-zinc-100">{training.adherence}%</p>
              </div>
            </div>
            {training.bestSession && training.bestSession.volume > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Most productive session</p>
                <p className="text-sm text-zinc-300">{training.bestSession.name} — {training.bestSession.volume >= 1000 ? `${(training.bestSession.volume / 1000).toFixed(1)}t` : `${training.bestSession.volume}kg`}</p>
              </div>
            )}
            <div className="mt-3 flex items-center gap-1.5">
              {training.progressionSignal === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
              {training.progressionSignal === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
              {training.progressionSignal === 'stable' && <Minus className="h-3.5 w-3.5 text-zinc-500" />}
              <span className={`text-xs ${
                training.progressionSignal === 'up' ? 'text-emerald-400' :
                training.progressionSignal === 'down' ? 'text-red-400' : 'text-zinc-500'
              }`}>
                {training.progressionSignal === 'up' ? 'Volume progressing' :
                 training.progressionSignal === 'down' ? 'Volume declined' : 'Volume stable'}
              </span>
            </div>
          </Card>

          {/* ── Sleep Breakdown ───────────────────────── */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-violet-400" />
                <CardTitle>Sleep</CardTitle>
              </div>
              <MiniLine data={sleepSparkData} color="#8b5cf6" />
            </div>
            {sleep.entryCount > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Score</p>
                    <p className="text-lg font-bold text-zinc-100">{sleep.avgScore}</p>
                    {sleep.prevAvgScore > 0 && (
                      <p className={`text-[10px] ${sleep.avgScore >= sleep.prevAvgScore ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pctStr(sleep.avgScore, sleep.prevAvgScore)} vs last week
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Duration</p>
                    <p className="text-lg font-bold text-zinc-100">{durationStr(sleep.avgDuration)}</p>
                    {sleep.prevAvgDuration > 0 && (
                      <p className={`text-[10px] ${sleep.avgDuration >= sleep.prevAvgDuration ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pctStr(sleep.avgDuration, sleep.prevAvgDuration)} vs last week
                      </p>
                    )}
                  </div>
                  {sleep.avgBedtime !== null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Bedtime</p>
                      <p className="text-lg font-bold text-zinc-100">{minutesToTimeStr(sleep.avgBedtime)}</p>
                    </div>
                  )}
                  {sleep.bedtimeConsistency !== null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Bedtime Variance</p>
                      <p className={`text-lg font-bold ${sleep.bedtimeConsistency <= 30 ? 'text-emerald-400' : sleep.bedtimeConsistency <= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                        &plusmn;{sleep.bedtimeConsistency}m
                      </p>
                    </div>
                  )}
                </div>
                {(sleep.bestNight || sleep.worstNight) && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/40 flex gap-4">
                    {sleep.bestNight && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Best</p>
                        <p className="text-xs text-emerald-400">{sleep.bestNight.sleepScore} — {format(new Date(sleep.bestNight.date), 'EEE')}</p>
                      </div>
                    )}
                    {sleep.worstNight && sleep.worstNight.date !== sleep.bestNight?.date && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Worst</p>
                        <p className="text-xs text-red-400">{sleep.worstNight.sleepScore} — {format(new Date(sleep.worstNight.date), 'EEE')}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-500">No sleep data logged this week.</p>
            )}
          </Card>

          {/* ── Steps Breakdown ───────────────────────── */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-blue-400" />
                <CardTitle>Movement</CardTitle>
              </div>
              <MiniBar data={stepsSparkData} color="#3b82f6" />
            </div>
            {steps.entryCount > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Daily Avg</p>
                    <p className="text-lg font-bold text-zinc-100">{fmtSteps(steps.avgSteps)}</p>
                    {steps.prevAvgSteps > 0 && (
                      <p className={`text-[10px] ${steps.avgSteps >= steps.prevAvgSteps ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pctStr(steps.avgSteps, steps.prevAvgSteps)} vs last week
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Weekly Total</p>
                    <p className="text-lg font-bold text-zinc-100">{fmtSteps(steps.totalSteps)}</p>
                  </div>
                </div>
                {(steps.bestDay || steps.lowestDay) && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/40 flex gap-4">
                    {steps.bestDay && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Best Day</p>
                        <p className="text-xs text-emerald-400">
                          {fmtSteps(steps.bestDay.stepCount)} — {format(new Date(steps.bestDay.date), 'EEE')}
                          {steps.bestDay.note && <span className="text-zinc-500"> · {steps.bestDay.note}</span>}
                        </p>
                      </div>
                    )}
                    {steps.lowestDay && steps.lowestDay.date !== steps.bestDay?.date && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Lowest</p>
                        <p className="text-xs text-zinc-500">{fmtSteps(steps.lowestDay.stepCount)} — {format(new Date(steps.lowestDay.date), 'EEE')}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-500">No step data logged this week.</p>
            )}
          </Card>

          {/* ── Bodyweight Breakdown ──────────────────── */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald-400" />
                <CardTitle>Bodyweight</CardTitle>
              </div>
              <MiniLine data={bwSparkData} color="#34d399" />
            </div>
            {bw.weekAvg !== null ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Week Avg</p>
                  <p className="text-lg font-bold text-zinc-100">{bw.weekAvg} <span className="text-sm font-normal text-zinc-500">kg</span></p>
                </div>
                {bw.change !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">vs Last Week</p>
                    <p className={`text-lg font-bold ${Math.abs(bw.change) <= 0.3 ? 'text-zinc-300' : bw.change > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                      {bw.change > 0 ? '+' : ''}{bw.change} kg
                    </p>
                  </div>
                )}
              </div>
            ) : bw.latest ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Latest recorded</p>
                <p className="text-lg font-bold text-zinc-100">
                  {bw.latest.weight} <span className="text-sm font-normal text-zinc-500">kg</span>
                  <span className="text-xs text-zinc-600 ml-2">{format(new Date(bw.latest.date), 'MMM d')}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No bodyweight data available.</p>
            )}
          </Card>

          {/* ── Recovery Interpretation ───────────────── */}
          <Card className="border-zinc-700/40">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-rose-400" />
              <CardTitle>Recovery Readiness</CardTitle>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {scores.recovery >= 75
                ? 'Recovery indicators look good this week. Sleep and movement supported your training load well.'
                : scores.recovery >= 55
                ? 'Recovery was adequate but not optimal. There is room to improve sleep quality or daily movement to better support your training.'
                : scores.recovery >= 30
                ? 'Recovery was limited this week. Lower sleep quality or insufficient movement likely affected your ability to recover from training.'
                : sleep.entryCount === 0
                ? 'Not enough recovery data this week. Log sleep and steps consistently to get meaningful recovery insights.'
                : 'Recovery was poor this week. Prioritize sleep and light movement before pushing training intensity.'}
            </p>
          </Card>

          {/* ── What Went Well / Needs Attention ──────── */}
          <div className="grid grid-cols-2 gap-2.5">
            <Card>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Went Well</p>
              </div>
              <div className="space-y-1.5">
                {wentWell.map((item, i) => (
                  <p key={i} className="text-xs text-zinc-300 leading-snug">{item}</p>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Attention</p>
              </div>
              <div className="space-y-1.5">
                {needsAttention.map((item, i) => (
                  <p key={i} className="text-xs text-zinc-300 leading-snug">{item}</p>
                ))}
              </div>
            </Card>
          </div>

          {/* ── Next Week Focus ───────────────────────── */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-blue-400" />
              <CardTitle>Next Week Focus</CardTitle>
            </div>
            <div className="space-y-2">
              {nextFocus.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <p className="text-sm text-zinc-200">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

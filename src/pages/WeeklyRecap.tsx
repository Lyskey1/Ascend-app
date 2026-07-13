import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight as ChevronRightIcon, Trophy, Heart, Footprints,
  Moon, Scale, Dumbbell, TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertTriangle, Target, Zap,
} from 'lucide-react';
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks, endOfDay,
  isAfter, isBefore,
} from 'date-fns';
import { Card, CardTitle } from '@/components/ui/Card';
import {
  useSessions, useBodyweightEntries, useStepEntries, useSleepEntries, useTemplates,
} from '@/hooks/useWorkout';
import { extractRuns, aggregatePace, formatPace } from '@/lib/running';
import { useInsights } from '@/hooks/useInsights';
import { topTakeaways, buildCoachSummary, buildNextWeekFocus, domainSeverity, type Severity } from '@/lib/insights';
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

/* Status badge tone per score band — cards stay neutral,
   color lives only in the small badge */
function scoreBadgeClass(score: number): string {
  if (score >= 85) return 'bg-positive/10 text-positive';
  if (score >= 70) return 'bg-accent/10 text-accent';
  if (score >= 55) return 'bg-zinc-800 text-zinc-300';
  if (score >= 40) return 'bg-warning/10 text-warning';
  return 'bg-negative/10 text-negative';
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
    let prevEnd = subWeeks(weekEnd, 1);
    // Current in-progress week: clamp the comparison window to week-to-date
    // (through the same weekday last week) so partial weeks compare like-for-like
    if (weekOffset === 0) {
      const wtdEnd = endOfDay(subWeeks(new Date(), 1));
      if (isBefore(wtdEnd, prevEnd)) prevEnd = wtdEnd;
    }

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
  runKm: number;
  runPaceMinPerKm: number | null;
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

  // Running for the week (cardio = running)
  const weekRuns = extractRuns(data.sessions);
  const runKm = weekRuns.reduce((s, r) => s + r.distanceKm, 0);
  const runPaceMinPerKm = aggregatePace(weekRuns);

  const trainingBreakdown: TrainingBreakdown = {
    strengthCount: strengthSessions.length,
    cardioCount: cardioSessions.length,
    totalVolume: Math.round(totalVolume),
    adherence: Math.round(adherence),
    bestSession,
    progressionSignal,
    prevVolume: Math.round(prevVolume),
    prevCount: data.prevWeekSessions.length,
    runKm: Math.round(runKm * 10) / 10,
    runPaceMinPerKm,
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
// Score Card Component
// ═══════════════════════════════════════════════════════

const SEVERITY_BADGE: Record<Severity, string> = {
  good: 'bg-positive/10 text-positive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-zinc-800 text-zinc-300',
};

function ScoreCard({ label, score, sublabel, icon: Icon, tone }: {
  label: string;
  score: number;
  sublabel: string;
  icon: React.ElementType;
  /** rules-engine severity for the badge; falls back to the score band */
  tone?: Severity | null;
}) {
  return (
    <div className="card-surface p-4 text-center">
      <Icon className="h-5 w-5 mx-auto mb-2 text-zinc-500" strokeWidth={1.5} />
      <p className="text-[28px] leading-tight font-medium tabular-nums text-zinc-100">{score}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mt-1">{label}</p>
      <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${tone ? SEVERITY_BADGE[tone] : scoreBadgeClass(score)}`}>
        {sublabel}
      </span>
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

  // Rules engine, anchored to the selected week (past weeks evaluate
  // as of their Sunday so historical recaps stay faithful)
  const asOf = useMemo(
    () => (weekOffset === 0 ? new Date() : endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 })),
    [weekOffset]
  );
  const findings = useInsights(asOf);
  const takeaways = topTakeaways(findings, 3);
  const coachSummary = buildCoachSummary(findings);
  const wentWell = findings.filter((f) => f.severity === 'good').map((f) => f.headline).slice(0, 4);
  const needsAttention = findings.filter((f) => f.severity === 'warning').map((f) => f.headline).slice(0, 4);
  const nextFocus = buildNextWeekFocus(findings, 2);
  const trainingTone = domainSeverity(findings, ['training', 'consistency']);
  const recoveryTone = domainSeverity(findings, ['recovery']);
  const weeklyTone = domainSeverity(findings, ['training', 'consistency', 'recovery', 'running']);

  const isCurrentWeek = weekOffset === 0;
  // Current week comparisons are clamped to week-to-date in useWeekData
  const cmpNote = isCurrentWeek ? ` (to ${format(new Date(), 'EEE')})` : '';
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
            <span className="text-xs text-zinc-400 min-w-[120px]">
              {weekLabel}
              {isCurrentWeek && <span className="text-zinc-600"> · to date</span>}
            </span>
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
              tone={weeklyTone}
            />
            <ScoreCard
              label="Training"
              score={scores.training}
              sublabel={scores.trainingLabel}
              icon={Dumbbell}
              tone={trainingTone}
            />
            <ScoreCard
              label="Recovery"
              score={scores.recovery}
              sublabel={scores.recoveryLabel}
              icon={Heart}
              tone={recoveryTone}
            />
          </div>

          {/* ── Main Takeaways: top findings from the rules engine ── */}
          <Card>
            <CardTitle className="mb-3">Main Takeaways</CardTitle>
            {takeaways.length > 0 ? (
              <div className="space-y-3">
                {takeaways.map((f) => (
                  <div key={f.id} className="flex gap-2.5">
                    <span
                      className={`mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full ${
                        f.severity === 'good' ? 'bg-positive' : f.severity === 'warning' ? 'bg-warning' : 'bg-zinc-500'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-200 leading-snug">{f.headline}</p>
                      <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{f.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Needs more data — keep logging workouts, sleep, and runs.</p>
            )}
          </Card>

          {/* ── Coach Summary ────────────────────────── */}
          <Card className="border-zinc-700/40 bg-zinc-900/70">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-accent" />
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
                <p className="text-lg font-semibold tabular-nums text-zinc-100">{training.strengthCount} <span className="text-sm font-normal text-zinc-500">sessions</span></p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Cardio</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-100">
                  {training.runKm > 0 ? training.runKm : training.cardioCount}{' '}
                  <span className="text-sm font-normal text-zinc-500">{training.runKm > 0 ? 'km' : 'sessions'}</span>
                </p>
                {training.runKm > 0 && (
                  <p className="text-[10px] text-zinc-500">
                    {training.cardioCount} session{training.cardioCount !== 1 ? 's' : ''}
                    {training.runPaceMinPerKm != null && ` · ${formatPace(training.runPaceMinPerKm)} avg`}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Volume</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-100">
                  {training.totalVolume >= 1000 ? `${(training.totalVolume / 1000).toFixed(1)}t` : `${training.totalVolume}kg`}
                </p>
                {training.prevVolume > 0 && (
                  <p className={`text-[10px] ${training.totalVolume >= training.prevVolume ? 'text-positive' : 'text-negative'}`}>
                    {pctStr(training.totalVolume, training.prevVolume)} vs last week{cmpNote}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Adherence</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-100">{training.adherence}%</p>
              </div>
            </div>
            {training.bestSession && training.bestSession.volume > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800/40">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Most productive session</p>
                <p className="text-sm text-zinc-300">{training.bestSession.name} — {training.bestSession.volume >= 1000 ? `${(training.bestSession.volume / 1000).toFixed(1)}t` : `${training.bestSession.volume}kg`}</p>
              </div>
            )}
            <div className="mt-3 flex items-center gap-1.5">
              {training.progressionSignal === 'up' && <TrendingUp className="h-3.5 w-3.5 text-positive" />}
              {training.progressionSignal === 'down' && <TrendingDown className="h-3.5 w-3.5 text-negative" />}
              {training.progressionSignal === 'stable' && <Minus className="h-3.5 w-3.5 text-zinc-500" />}
              <span className={`text-xs ${
                training.progressionSignal === 'up' ? 'text-positive' :
                training.progressionSignal === 'down' ? 'text-negative' : 'text-zinc-500'
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
                <Moon className="h-4 w-4 text-accent" />
                <CardTitle>Sleep</CardTitle>
              </div>
              <MiniLine data={sleepSparkData} color="var(--color-accent)" />
            </div>
            {sleep.entryCount > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Score</p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-100">{sleep.avgScore}</p>
                    {sleep.prevAvgScore > 0 && (
                      <p className={`text-[10px] ${sleep.avgScore >= sleep.prevAvgScore ? 'text-positive' : 'text-negative'}`}>
                        {pctStr(sleep.avgScore, sleep.prevAvgScore)} vs last week{cmpNote}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Duration</p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-100">{durationStr(sleep.avgDuration)}</p>
                    {sleep.prevAvgDuration > 0 && (
                      <p className={`text-[10px] ${sleep.avgDuration >= sleep.prevAvgDuration ? 'text-positive' : 'text-negative'}`}>
                        {pctStr(sleep.avgDuration, sleep.prevAvgDuration)} vs last week{cmpNote}
                      </p>
                    )}
                  </div>
                  {sleep.avgBedtime !== null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Bedtime</p>
                      <p className="text-lg font-semibold tabular-nums text-zinc-100">{minutesToTimeStr(sleep.avgBedtime)}</p>
                    </div>
                  )}
                  {sleep.bedtimeConsistency !== null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Bedtime Variance</p>
                      <p className={`text-lg font-semibold tabular-nums ${sleep.bedtimeConsistency <= 30 ? 'text-positive' : sleep.bedtimeConsistency <= 60 ? 'text-warning' : 'text-negative'}`}>
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
                        <p className="text-xs text-positive">{sleep.bestNight.sleepScore} — {format(new Date(sleep.bestNight.date), 'EEE')}</p>
                      </div>
                    )}
                    {sleep.worstNight && sleep.worstNight.date !== sleep.bestNight?.date && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Worst</p>
                        <p className="text-xs text-negative">{sleep.worstNight.sleepScore} — {format(new Date(sleep.worstNight.date), 'EEE')}</p>
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
                <Footprints className="h-4 w-4 text-accent" />
                <CardTitle>Movement</CardTitle>
              </div>
              <MiniBar data={stepsSparkData} color="var(--color-accent)" />
            </div>
            {steps.entryCount > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Daily Avg</p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-100">{fmtSteps(steps.avgSteps)}</p>
                    {steps.prevAvgSteps > 0 && (
                      <p className={`text-[10px] ${steps.avgSteps >= steps.prevAvgSteps ? 'text-positive' : 'text-negative'}`}>
                        {pctStr(steps.avgSteps, steps.prevAvgSteps)} vs last week{cmpNote}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Weekly Total</p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-100">{fmtSteps(steps.totalSteps)}</p>
                  </div>
                </div>
                {(steps.bestDay || steps.lowestDay) && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/40 flex gap-4">
                    {steps.bestDay && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Best Day</p>
                        <p className="text-xs text-positive">
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
                <Scale className="h-4 w-4 text-positive" />
                <CardTitle>Bodyweight</CardTitle>
              </div>
              <MiniLine data={bwSparkData} color="var(--color-positive)" />
            </div>
            {bw.weekAvg !== null ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Week Avg</p>
                  <p className="text-lg font-semibold tabular-nums text-zinc-100">{bw.weekAvg} <span className="text-sm font-normal text-zinc-500">kg</span></p>
                </div>
                {bw.change !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">vs Last Week</p>
                    <p className={`text-lg font-semibold tabular-nums ${Math.abs(bw.change) <= 0.3 ? 'text-zinc-300' : bw.change > 0 ? 'text-warning' : 'text-accent'}`}>
                      {bw.change > 0 ? '+' : ''}{bw.change} kg
                    </p>
                  </div>
                )}
              </div>
            ) : bw.latest ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Latest recorded</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-100">
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
              <Heart className="h-4 w-4 text-zinc-400" />
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
                <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-positive">Went Well</p>
              </div>
              <div className="space-y-1.5">
                {wentWell.length > 0 ? (
                  wentWell.map((item, i) => (
                    <p key={i} className="text-xs text-zinc-300 leading-snug">{item}</p>
                  ))
                ) : (
                  <p className="text-xs text-zinc-600">Nothing stands out yet</p>
                )}
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">Attention</p>
              </div>
              <div className="space-y-1.5">
                {needsAttention.length > 0 ? (
                  needsAttention.map((item, i) => (
                    <p key={i} className="text-xs text-zinc-300 leading-snug">{item}</p>
                  ))
                ) : (
                  <p className="text-xs text-zinc-600">Nothing major — keep it up</p>
                )}
              </div>
            </Card>
          </div>

          {/* ── Next Week Focus ───────────────────────── */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-accent" />
              <CardTitle>Next Week Focus</CardTitle>
            </div>
            <div className="space-y-2">
              {nextFocus.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-accent" />
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

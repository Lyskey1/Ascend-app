import { useState, useMemo } from 'react';
import { format, subDays, isAfter, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import { Settings, Plus, X, Palmtree } from 'lucide-react';
import { useSessions, useBodyweightEntries, useExercises, useTemplates } from '@/hooks/useWorkout';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '@/db/types';
import {
  getProgramStartDate,
  setProgramStartDate,
  getRestDay,
  setRestDaySetting,
  getVacationPeriods,
  setVacationPeriods,
  isDateInVacation,
  type VacationPeriod,
} from '@/hooks/useScheduleSettings';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

type StatsRange = '7d' | '30d' | '90d' | '365d' | '730d' | '1095d' | 'all';

const RANGE_LABELS: Record<StatsRange, string> = {
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  '365d': '1y',
  '730d': '2y',
  '1095d': '3y',
  all: 'All',
};

const RANGE_DAYS: Record<Exclude<StatsRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
  '730d': 730,
  '1095d': 1095,
};

const DAY_NAME_TO_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

export function Stats() {
  const allSessions = useSessions();
  const bodyweightEntries = useBodyweightEntries();
  const exercises = useExercises();
  const templates = useTemplates();
  const [range, setRange] = useState<StatsRange>('90d');
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  // ─── Schedule settings ────────────────────────────
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [programStart, setProgramStart] = useState<string>(getProgramStartDate() ?? '');
  const [restDay, setRestDay] = useState<string>(getRestDay());
  const [vacations, setVacations] = useState<VacationPeriod[]>(getVacationPeriods());
  const [showVacationForm, setShowVacationForm] = useState(false);
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacNote, setVacNote] = useState('');

  const handleSaveProgramStart = (date: string) => {
    setProgramStart(date);
    setProgramStartDate(date || null);
  };

  const handleSaveRestDay = (day: string) => {
    setRestDay(day);
    setRestDaySetting(day);
  };

  const handleAddVacation = () => {
    if (!vacStart || !vacEnd || vacEnd < vacStart) return;
    const updated = [...vacations, { id: crypto.randomUUID(), start: vacStart, end: vacEnd, note: vacNote || undefined }];
    setVacations(updated);
    setVacationPeriods(updated);
    setVacStart('');
    setVacEnd('');
    setVacNote('');
    setShowVacationForm(false);
  };

  const handleRemoveVacation = (id: string) => {
    const updated = vacations.filter((v) => v.id !== id);
    setVacations(updated);
    setVacationPeriods(updated);
  };

  const restDayNum = DAY_NAME_TO_NUM[restDay] ?? 0;

  // ─── Cutoff date ─────────────────────────────────
  const cutoffDate = useMemo(() => {
    if (range === 'all') return null;
    return subDays(new Date(), RANGE_DAYS[range]);
  }, [range]);

  // ─── Filtered sessions ───────────────────────────
  const sessions = useMemo(() => {
    if (!cutoffDate) return allSessions;
    return allSessions.filter((s) => isAfter(new Date(s.startedAt), cutoffDate));
  }, [allSessions, cutoffDate]);

  // ─── Scheduled days from templates ────────────────
  const scheduledDays = useMemo(() => {
    const days = new Set<number>();
    for (const t of templates) {
      if (t.day) {
        for (const d of t.day) {
          const num = DAY_NAME_TO_NUM[d];
          if (num !== undefined) days.add(num);
        }
      }
    }
    return days;
  }, [templates]);

  // ─── Bodyweight chart ──────────────────────────────
  const bodyweightData = useMemo(() => {
    const reversed = [...bodyweightEntries].reverse();
    const filtered = cutoffDate
      ? reversed.filter((e) => isAfter(new Date(e.date), cutoffDate))
      : reversed;
    return filtered.map((e) => ({
      date: format(new Date(e.date), range === '7d' ? 'EEE' : 'MMM d'),
      weight: e.weight,
    }));
  }, [bodyweightEntries, cutoffDate, range]);

  // ─── Weekly volume ─────────────────────────────────
  const weeklyVolumeData = useMemo(() => {
    const start = cutoffDate
      ?? (sessions.length > 0
        ? new Date(sessions.reduce((oldest, s) => {
            const d = s.startedAt;
            return d < oldest ? d : oldest;
          }, sessions[0].startedAt))
        : subDays(new Date(), 84));
    const weeks = eachWeekOfInterval(
      { start, end: new Date() },
      { weekStartsOn: 1 }
    );

    return weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekSessions = sessions.filter((s) => {
        const d = new Date(s.startedAt);
        return d >= weekStart && d < weekEnd;
      });

      const volume = weekSessions.reduce(
        (total, session) =>
          total +
          session.exercises.reduce(
            (exTotal, ex) =>
              exTotal + ex.sets.reduce((setTotal, set) => setTotal + (set.weight ?? 0) * (set.reps ?? 0), 0),
            0
          ),
        0
      );

      return {
        week: format(weekStart, 'MMM d'),
        volume: Math.round(volume),
        sessions: weekSessions.length,
      };
    });
  }, [sessions, cutoffDate]);

  // ─── Workouts per week ─────────────────────────────
  const workoutsPerWeek = useMemo(() => {
    return weeklyVolumeData.map((w) => ({
      week: w.week,
      count: w.sessions,
    }));
  }, [weeklyVolumeData]);

  // ─── Muscle balance composite scoring ──────────────
  //
  // Each muscle group gets a composite score (0–100) based on:
  //   40% — Effective sets (hard sets weighted by muscle role)
  //   30% — Frequency (unique training days for that muscle)
  //   30% — Progression (performance trend: improving / stagnating / declining)
  //
  // This avoids the raw-weight bias where legs always dwarf arms/abs.

  const muscleBalanceData = useMemo(() => {
    if (sessions.length === 0) return [];
    const now = new Date();

    // ── Per-muscle accumulators ────────────────────────
    type MuscleAccum = {
      effectiveSets: number;          // weighted hard sets
      trainingDays: Set<string>;      // unique dates
      // For progression: first-half vs second-half avg set performance
      firstHalfSets: number[];        // best-set-weight values from older half
      secondHalfSets: number[];       // best-set-weight values from newer half
      lastTrainedAt: Date | null;
    };
    const accum: Record<string, MuscleAccum> = {};

    const ensure = (m: string) => {
      if (!accum[m]) accum[m] = {
        effectiveSets: 0,
        trainingDays: new Set(),
        firstHalfSets: [],
        secondHalfSets: [],
        lastTrainedAt: null,
      };
    };

    // Sort sessions chronologically for half-split
    const chronoSessions = [...sessions].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    const midIdx = Math.floor(chronoSessions.length / 2);

    for (let si = 0; si < chronoSessions.length; si++) {
      const session = chronoSessions[si];
      const isSecondHalf = si >= midIdx;
      const sessionDate = format(new Date(session.startedAt), 'yyyy-MM-dd');
      const sessionTime = new Date(session.startedAt);

      for (const ex of session.exercises) {
        if (ex.skipped) continue;
        const exercise = exercises.find((e) => e.id === ex.exerciseId);
        if (!exercise || exercise.primaryMuscle === 'cardio') continue;

        // Count completed hard sets for this exercise
        const completedSets = ex.sets.filter((s) => s.completed && (s.weight ?? 0) > 0).length;
        if (completedSets === 0) continue;

        // Best set weight for progression tracking
        const bestWeight = Math.max(...ex.sets.filter((s) => s.completed).map((s) => s.weight ?? 0));

        // Primary muscle: full credit
        const primary = exercise.primaryMuscle;
        ensure(primary);
        accum[primary].effectiveSets += completedSets;
        accum[primary].trainingDays.add(sessionDate);
        if (!accum[primary].lastTrainedAt || sessionTime > accum[primary].lastTrainedAt) {
          accum[primary].lastTrainedAt = sessionTime;
        }
        if (isSecondHalf) accum[primary].secondHalfSets.push(bestWeight);
        else accum[primary].firstHalfSets.push(bestWeight);

        // Secondary muscles: 50% set credit
        const secondaries = exercise.secondaryMuscles ?? (exercise.secondaryMuscle ? [exercise.secondaryMuscle] : []);
        for (const sm of secondaries) {
          if (sm === 'cardio') continue;
          ensure(sm);
          accum[sm].effectiveSets += completedSets * 0.5;
          accum[sm].trainingDays.add(sessionDate);
          if (!accum[sm].lastTrainedAt || sessionTime > accum[sm].lastTrainedAt) {
            accum[sm].lastTrainedAt = sessionTime;
          }
          if (isSecondHalf) accum[sm].secondHalfSets.push(bestWeight * 0.5);
          else accum[sm].firstHalfSets.push(bestWeight * 0.5);
        }
      }
    }

    // ── Compute sub-scores and composite ──────────────
    const muscleKeys = Object.keys(accum).filter((m) => accum[m].effectiveSets > 0);
    if (muscleKeys.length === 0) return [];

    // Find maximums for normalization
    const maxSets = Math.max(...muscleKeys.map((m) => accum[m].effectiveSets));
    const maxDays = Math.max(...muscleKeys.map((m) => accum[m].trainingDays.size));

    const rangeDays = cutoffDate
      ? Math.max(1, Math.round((now.getTime() - cutoffDate.getTime()) / 86400000))
      : Math.max(1, Math.round((now.getTime() - new Date(chronoSessions[0].startedAt).getTime()) / 86400000));

    const result = muscleKeys.map((muscle) => {
      const a = accum[muscle];

      // 1. Effective sets score (0–100), normalized against best muscle
      const setsScore = (a.effectiveSets / maxSets) * 100;

      // 2. Frequency score (0–100)
      //    Normalized against best muscle's training days
      const freqScore = (a.trainingDays.size / maxDays) * 100;

      // 3. Progression score (0–100)
      //    Compare average best-set-weight in second half vs first half
      //    50 = stable, >50 = improving, <50 = declining
      let progressionScore = 50; // neutral default
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (a.firstHalfSets.length >= 2 && a.secondHalfSets.length >= 2) {
        const avgFirst = a.firstHalfSets.reduce((s, v) => s + v, 0) / a.firstHalfSets.length;
        const avgSecond = a.secondHalfSets.reduce((s, v) => s + v, 0) / a.secondHalfSets.length;
        if (avgFirst > 0) {
          const change = ((avgSecond - avgFirst) / avgFirst) * 100;
          // Map: -20% or worse → 0, 0% → 50, +20% or better → 100
          progressionScore = Math.max(0, Math.min(100, 50 + change * 2.5));
          if (change > 3) trend = 'up';
          else if (change < -3) trend = 'down';
        }
      }

      // 4. Recency penalty
      //    If muscle hasn't been trained recently, dampen the score
      let recencyMultiplier = 1;
      if (a.lastTrainedAt) {
        const daysSince = Math.round((now.getTime() - a.lastTrainedAt.getTime()) / 86400000);
        // No penalty if trained in last 25% of range; linear decay to 0.4 at full range
        const threshold = rangeDays * 0.25;
        if (daysSince > threshold) {
          recencyMultiplier = Math.max(0.4, 1 - ((daysSince - threshold) / (rangeDays * 0.75)) * 0.6);
        }
      }

      // Composite: 40% sets + 30% frequency + 30% progression, with recency dampening
      const raw = (setsScore * 0.4 + freqScore * 0.3 + progressionScore * 0.3) * recencyMultiplier;
      const composite = Math.round(Math.max(0, Math.min(100, raw)));

      return {
        muscleKey: muscle,
        muscle: MUSCLE_GROUP_LABELS[muscle as MuscleGroup] ?? muscle,
        composite,
        effectiveSets: Math.round(a.effectiveSets),
        frequency: a.trainingDays.size,
        trend,
        setsScore: Math.round(setsScore),
        freqScore: Math.round(freqScore),
        progressionScore: Math.round(progressionScore),
      };
    }).sort((a, b) => b.composite - a.composite);

    return result;
  }, [sessions, exercises, cutoffDate]);

  // ─── Radar chart data (top 8 muscles) ─────────────
  const radarData = useMemo(() => {
    return muscleBalanceData.slice(0, 8).map((d) => ({
      muscle: d.muscle,
      score: d.composite,
      trend: d.trend,
    }));
  }, [muscleBalanceData]);

  // ─── Exercise progression ──────────────────────────
  const exerciseOptions = useMemo(() => {
    const exerciseIds = new Set<string>();
    for (const session of sessions) {
      for (const ex of session.exercises) {
        if (!ex.skipped) exerciseIds.add(ex.exerciseId);
      }
    }
    return exercises.filter((e) => exerciseIds.has(e.id));
  }, [sessions, exercises]);

  const exerciseProgressionData = useMemo(() => {
    if (!selectedExercise) return [];
    return [...sessions]
      .filter((s) => s.exercises.some((e) => e.exerciseId === selectedExercise && !e.skipped))
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .map((s) => {
        const ex = s.exercises.find((e) => e.exerciseId === selectedExercise)!;
        const bestSet = ex.sets.reduce(
          (best, set) => {
            if (!set.completed || !set.weight) return best;
            if (set.weight > (best.weight ?? 0)) return set;
            return best;
          },
          ex.sets[0]
        );
        const volume = ex.sets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
        return {
          date: format(new Date(s.startedAt), 'MMM d'),
          weight: bestSet?.weight ?? 0,
          reps: bestSet?.reps ?? 0,
          volume: Math.round(volume),
        };
      });
  }, [sessions, selectedExercise]);

  // ─── Consistency heatmap ───────────────────────────
  type DayStatus = 'workout' | 'rest' | 'missed' | 'off' | 'inactive';

  const heatmapData = useMemo(() => {
    const start = cutoffDate
      ?? (allSessions.length > 0
        ? new Date(allSessions.reduce((oldest, s) => {
            const d = s.startedAt;
            return d < oldest ? d : oldest;
          }, allSessions[0].startedAt))
        : subDays(new Date(), 89));
    const days = eachDayOfInterval({ start, end: new Date() });
    const sessionDates = new Set(
      allSessions.map((s) => format(new Date(s.startedAt), 'yyyy-MM-dd'))
    );
    const today = format(new Date(), 'yyyy-MM-dd');

    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const hasWorkout = sessionDates.has(dateStr);
      const isPast = dateStr < today;
      const isScheduled = scheduledDays.has(day.getDay());

      let status: DayStatus = 'rest';

      if (hasWorkout) {
        status = 'workout';
      } else if (programStart && dateStr < programStart) {
        status = 'inactive';
      } else if (isDateInVacation(dateStr, vacations)) {
        status = 'off';
      } else if (day.getDay() === restDayNum) {
        status = 'rest';
      } else if (isScheduled && isPast) {
        status = 'missed';
      }

      return { date: dateStr, status };
    });
  }, [allSessions, cutoffDate, scheduledDays, programStart, vacations, restDayNum]);

  const heatmapSize = heatmapData.length > 365
    ? 'h-2 w-2'
    : heatmapData.length > 90
      ? 'h-2.5 w-2.5'
      : 'h-3 w-3';
  const heatmapGap = heatmapData.length > 365 ? 'gap-[2px]' : 'gap-[3px]';

  return (
    <div className="px-4 pt-14 pb-4 space-y-5">
      <h1 className="text-2xl font-bold text-zinc-50">Statistics</h1>

      {/* Global timeline selector */}
      <div className="flex gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        {(Object.keys(RANGE_LABELS) as StatsRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              range === r
                ? 'bg-white text-zinc-900'
                : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 active:text-zinc-300'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Consistency heatmap */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Consistency</CardTitle>
          <button
            onClick={() => setShowScheduleSettings(true)}
            className="rounded-full p-1.5 text-zinc-500 active:text-zinc-300 active:bg-zinc-800 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
        <div className={`flex ${heatmapGap} flex-wrap`}>
          {heatmapData.map((day) => {
            const bg =
              day.status === 'workout'
                ? 'bg-positive'
                : day.status === 'missed'
                  ? 'bg-negative/70'
                  : day.status === 'off'
                    ? 'bg-accent/30'
                    : day.status === 'inactive'
                      ? 'bg-zinc-800/20'
                      : 'bg-zinc-800/50';
            const tip =
              day.status === 'workout'
                ? ' — Worked out'
                : day.status === 'missed'
                  ? ' — Missed'
                  : day.status === 'off'
                    ? ' — Vacation'
                    : day.status === 'inactive'
                      ? ' — Before program'
                      : '';
            return (
              <div
                key={day.date}
                className={`${heatmapSize} rounded-[2px] ${bg}`}
                title={`${day.date}${tip}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] text-zinc-600">
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-positive" />
            Workout
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-zinc-800/50" />
            Rest
          </div>
          {scheduledDays.size > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-negative/70" />
              Missed
            </div>
          )}
          {vacations.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-accent/30" />
              Vacation
            </div>
          )}
          {programStart && (
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-zinc-800/20" />
              Before start
            </div>
          )}
        </div>
      </Card>

      {/* Schedule settings sheet */}
      <Sheet open={showScheduleSettings} onClose={() => setShowScheduleSettings(false)} title="Schedule Settings">
        <div className="space-y-5">
          {/* Program start date */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Program start date</label>
            <p className="text-[10px] text-zinc-600 mb-1.5">Days before this date won't count as missed</p>
            <input
              type="date"
              value={programStart}
              onChange={(e) => handleSaveProgramStart(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </div>

          {/* Rest day */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Weekly rest day</label>
            <p className="text-[10px] text-zinc-600 mb-1.5">This day won't count as a missed workout</p>
            <div className="flex flex-wrap gap-1.5">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <button
                  key={day}
                  onClick={() => handleSaveRestDay(day)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    restDay === day
                      ? 'bg-white text-zinc-900'
                      : 'bg-zinc-800/50 text-zinc-500 active:text-zinc-300'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Vacation periods */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <label className="text-xs font-medium text-zinc-400">Vacation / off periods</label>
                <p className="text-[10px] text-zinc-600">These periods won't count as missed</p>
              </div>
              <button
                onClick={() => setShowVacationForm(!showVacationForm)}
                className="rounded-full bg-zinc-800/50 p-1.5 text-zinc-400 active:text-zinc-200 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Add vacation form */}
            {showVacationForm && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2.5 mb-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500">Start</label>
                    <input
                      type="date"
                      value={vacStart}
                      onChange={(e) => setVacStart(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500">End</label>
                    <input
                      type="date"
                      value={vacEnd}
                      onChange={(e) => setVacEnd(e.target.value)}
                      min={vacStart}
                      className="mt-0.5 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={vacNote}
                  onChange={(e) => setVacNote(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
                />
                <Button
                  size="sm"
                  onClick={handleAddVacation}
                  disabled={!vacStart || !vacEnd || vacEnd < vacStart}
                >
                  Add period
                </Button>
              </div>
            )}

            {/* Existing vacation list */}
            {vacations.length > 0 ? (
              <div className="space-y-1.5">
                {vacations
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Palmtree className="h-3.5 w-3.5 text-accent/60" />
                      <div>
                        <p className="text-xs font-medium text-zinc-300">
                          {format(new Date(v.start + 'T12:00:00'), 'MMM d')} — {format(new Date(v.end + 'T12:00:00'), 'MMM d, yyyy')}
                        </p>
                        {v.note && <p className="text-[10px] text-zinc-500">{v.note}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveVacation(v.id)}
                      className="rounded-full p-1 text-zinc-600 active:text-zinc-400 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-600 py-1">No vacation periods set</p>
            )}
          </div>
        </div>
      </Sheet>

      {/* Bodyweight evolution */}
      {bodyweightData.length > 2 && (
        <Card>
          <CardTitle className="mb-3">Bodyweight Evolution</CardTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bodyweightData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="bwStatsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-zinc-900)',
                    border: '1px solid var(--color-zinc-800)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#bwStatsFill)"
                  dot={{ r: 2, fill: 'var(--color-accent)', strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Weekly volume chart */}
      <Card>
        <CardTitle className="mb-3">Weekly Training Volume</CardTitle>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyVolumeData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}t` : `${v}`)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-zinc-900)',
                  border: '1px solid var(--color-zinc-800)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                formatter={(value) => [`${Number(value).toLocaleString()} kg`, 'Volume']}
              />
              <Bar dataKey="volume" fill="var(--color-accent)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Workouts per week */}
      <Card>
        <CardTitle className="mb-3">Workouts Per Week</CardTitle>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workoutsPerWeek} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-zinc-900)',
                  border: '1px solid var(--color-zinc-800)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="count" fill="var(--color-accent)" fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={24} name="Workouts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Muscle balance radar */}
      {radarData.length >= 3 && (
        <Card>
          <CardTitle className="mb-3">Muscle Balance</CardTitle>
          <p className="text-[10px] text-zinc-500 -mt-2 mb-2">Composite score: 40% effective sets · 30% frequency · 30% progression</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <PolarGrid stroke="var(--color-zinc-800)" />
                <PolarAngleAxis
                  dataKey="muscle"
                  tick={{ fontSize: 11, fill: 'var(--color-zinc-400)' }}
                />
                <PolarRadiusAxis
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-600)' }}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <Radar
                  dataKey="score"
                  stroke="var(--color-accent)"
                  fill="var(--color-accent)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Muscle breakdown list */}
      {muscleBalanceData.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Muscle Breakdown</CardTitle>
          <div className="space-y-2.5">
            {muscleBalanceData.map((d) => (
              <div key={d.muscleKey}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-300">{d.muscle}</span>
                    <span className={`text-[10px] font-medium ${
                      d.trend === 'up' ? 'text-positive' :
                      d.trend === 'down' ? 'text-negative' : 'text-zinc-500'
                    }`}>
                      {d.trend === 'up' ? '↑ Up' : d.trend === 'down' ? '↓ Down' : '→ Stable'}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {d.effectiveSets} sets · {d.frequency}d
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800/50">
                  <div
                    className="h-2 rounded-full bg-accent/80 transition-all"
                    style={{ width: `${d.composite}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Exercise progression */}
      <Card>
        <CardTitle className="mb-3">Exercise Progression</CardTitle>
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 text-sm text-zinc-100 outline-none"
        >
          <option value="">Select an exercise</option>
          {exerciseOptions.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        {exerciseProgressionData.length > 1 && (
          <div className="space-y-4">
            {/* Weight progression */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">Best Weight (kg)</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exerciseProgressionData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" strokeOpacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-zinc-900)',
                        border: '1px solid var(--color-zinc-800)',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="var(--color-positive)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'var(--color-positive)', strokeWidth: 0 }}
                      name="Weight"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Volume progression */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">Session Volume (kg)</p>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={exerciseProgressionData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" strokeOpacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--color-zinc-500)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-zinc-900)',
                        border: '1px solid var(--color-zinc-800)',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="volume" fill="var(--color-accent)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={20} name="Volume" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {selectedExercise && exerciseProgressionData.length <= 1 && (
          <p className="text-center text-sm text-zinc-600 py-4">
            Need at least 2 sessions for progression data
          </p>
        )}
      </Card>
    </div>
  );
}

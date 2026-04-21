import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, Flame, Calendar, ChevronRight, Dumbbell, Trash2, Zap, Target, BarChart3, ArrowUpRight, Activity, Sun, Moon } from 'lucide-react';
import { AscendLogo } from '@/components/brand/AscendLogo';
import { format, subDays, isAfter, isBefore, startOfWeek, startOfDay } from 'date-fns';
import { Card, CardTitle, CardValue } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TemplateSelector } from '@/components/workout/TemplateSelector';
import { useTheme } from '@/hooks/useTheme';
import {
  getProgramStartDate,
  getRestDay,
  getVacationPeriods,
  isDateInVacation,
} from '@/hooks/useScheduleSettings';
import {
  useSessions,
  useBodyweightEntries,
  useActiveSession,
  useTemplates,
  startWorkoutSession,
  startPastWorkoutSession,
} from '@/hooks/useWorkout';
import { db } from '@/db/database';
import { useTrashCount } from '@/hooks/useTrash';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
} from 'recharts';

export function Dashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showModeChooser, setShowModeChooser] = useState(false);
  const [workoutMode, setWorkoutMode] = useState<'live' | 'past'>('live');
  const [showPastForm, setShowPastForm] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [pastDate, setPastDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [pastDurationH, setPastDurationH] = useState('1');
  const [pastDurationM, setPastDurationM] = useState('0');
  const sessions = useSessions();
  const bodyweightEntries = useBodyweightEntries();
  const activeSession = useActiveSession();
  const templates = useTemplates();
  const trashCount = useTrashCount();

  const handleStartWorkout = async (templateId: string) => {
    if (workoutMode === 'past') {
      setPendingTemplateId(templateId);
      setShowPastForm(true);
      return;
    }
    const template = await db.templates.get(templateId);
    if (!template) return;
    const sessionId = await startWorkoutSession(template);
    navigate(`/workout/${sessionId}`);
  };

  const handleStartPastWorkout = async () => {
    if (!pendingTemplateId) return;
    const template = await db.templates.get(pendingTemplateId);
    if (!template) return;
    const durationMinutes = (parseInt(pastDurationH) || 0) * 60 + (parseInt(pastDurationM) || 0);
    const startedAt = new Date(pastDate + 'T12:00:00').toISOString();
    const sessionId = await startPastWorkoutSession(template, startedAt, durationMinutes);
    setPendingTemplateId(null);
    setShowPastForm(false);
    navigate(`/workout/${sessionId}`);
  };

  const handleResumeWorkout = () => {
    if (activeSession) {
      navigate(`/workout/${activeSession.id}`);
    }
  };

  // Stats computations
  const latestWeight = bodyweightEntries[0];
  const weightTrend7d = useMemo(() => {
    const cutoff = subDays(new Date(), 7);
    const recent = bodyweightEntries.filter((e) => isAfter(new Date(e.date), cutoff));
    if (recent.length < 2) return null;
    return recent[0].weight - recent[recent.length - 1].weight;
  }, [bodyweightEntries]);

  const bodyweightChartData = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    return bodyweightEntries
      .filter((e) => isAfter(new Date(e.date), cutoff))
      .reverse()
      .map((e) => ({ date: e.date, weight: e.weight }));
  }, [bodyweightEntries]);

  const thisWeekSessions = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return sessions.filter((s) => isAfter(new Date(s.startedAt), weekStart));
  }, [sessions]);

  const weeklyVolume = useMemo(() => {
    return thisWeekSessions.reduce((total, session) => {
      return (
        total +
        session.exercises.reduce(
          (exTotal, ex) =>
            exTotal +
            ex.sets.reduce((setTotal, set) => setTotal + (set.weight ?? 0) * (set.reps ?? 0), 0),
          0
        )
      );
    }, 0);
  }, [thisWeekSessions]);

  const lastSession = sessions[0];

  // ── Progress this week computations ────────────────────

  // Last week sessions & volume
  const lastWeekData = useMemo(() => {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const lastWeekStart = subDays(thisWeekStart, 7);
    const lastWeekSessions = sessions.filter((s) => {
      const d = new Date(s.startedAt);
      return isAfter(d, lastWeekStart) && isBefore(d, thisWeekStart);
    });
    const volume = lastWeekSessions.reduce((total, session) =>
      total + session.exercises.reduce((exT, ex) =>
        exT + ex.sets.reduce((sT, set) => sT + (set.weight ?? 0) * (set.reps ?? 0), 0), 0), 0);
    return { sessions: lastWeekSessions, volume };
  }, [sessions]);

  // Planned workouts this week (count template day slots that match Mon-Sun of current week)
  const plannedThisWeek = useMemo(() => {
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const scheduled = new Set<string>();
    for (const t of templates) {
      for (const d of t.day ?? []) {
        if (weekDays.includes(d)) scheduled.add(d);
      }
    }
    return scheduled.size;
  }, [templates]);

  // Exercise progression: improved / stalled / declined
  const exerciseProgress = useMemo(() => {
    let improved = 0;
    let stalled = 0;
    let declined = 0;

    // For each session this week, compare each exercise against the previous session for same template
    for (const ws of thisWeekSessions) {
      // Find the previous completed session for this template (before this session)
      const prev = sessions.find(
        (s) =>
          s.templateId === ws.templateId &&
          s.id !== ws.id &&
          s.status === 'completed' &&
          isBefore(new Date(s.startedAt), new Date(ws.startedAt))
      );
      if (!prev) continue;

      for (const ex of ws.exercises) {
        if (ex.skipped || ex.exerciseType === 'cardio') continue;
        const prevEx = prev.exercises.find((pe) => pe.exerciseId === ex.exerciseId);
        if (!prevEx) continue;

        // Compare best completed set (by weight, then reps)
        const bestSet = ex.sets
          .filter((s) => s.completed && s.weight != null)
          .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
        const prevBestSet = prevEx.sets
          .filter((s) => s.completed && s.weight != null)
          .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];

        if (!bestSet || !prevBestSet) continue;

        const bw = bestSet.weight ?? 0;
        const pw = prevBestSet.weight ?? 0;
        const br = bestSet.reps ?? 0;
        const pr = prevBestSet.reps ?? 0;

        if (bw > pw) {
          improved++;
        } else if (bw === pw && br > pr) {
          improved++;
        } else if (bw === pw && br === pr) {
          stalled++;
        } else if (bw < pw) {
          declined++;
        } else {
          // same weight, fewer reps
          declined++;
        }
      }
    }

    return { improved, stalled, declined };
  }, [thisWeekSessions, sessions]);

  // Consistency: consecutive training-day streak (rest days & vacation don't break it)
  const streak = useMemo(() => {
    if (sessions.length === 0) return 0;
    const DAY_NUM: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };
    const workoutDates = new Set(
      sessions.map((s) => format(new Date(s.startedAt), 'yyyy-MM-dd'))
    );
    const restDayNum = DAY_NUM[getRestDay()] ?? 0;
    const vacationPeriods = getVacationPeriods();
    const programStartDate = getProgramStartDate();

    let count = 0;
    let day = startOfDay(new Date());

    // If today has no workout and isn't an excused day, start from yesterday
    const todayStr = format(day, 'yyyy-MM-dd');
    if (
      !workoutDates.has(todayStr) &&
      day.getDay() !== restDayNum &&
      !isDateInVacation(todayStr, vacationPeriods)
    ) {
      day = subDays(day, 1);
    }

    // Walk backwards, counting workouts and skipping excused days
    for (let i = 0; i < 365; i++) {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (programStartDate && dateStr < programStartDate) break;

      if (workoutDates.has(dateStr)) {
        count++;
      } else if (day.getDay() === restDayNum || isDateInVacation(dateStr, vacationPeriods)) {
        // Excused day — skip without breaking
      } else {
        break;
      }
      day = subDays(day, 1);
    }
    return count;
  }, [sessions]);

  // Weekly summary sentence
  const weeklySummary = useMemo(() => {
    const parts: string[] = [];
    const { improved, stalled, declined } = exerciseProgress;
    const volumeChange = lastWeekData.volume > 0
      ? ((weeklyVolume - lastWeekData.volume) / lastWeekData.volume) * 100
      : null;
    const onPace = plannedThisWeek > 0
      ? thisWeekSessions.length >= plannedThisWeek * 0.5
      : thisWeekSessions.length > 0;

    if (onPace && (volumeChange === null || volumeChange >= 0) && improved >= declined) {
      parts.push('You\'re on track this week.');
    } else if (!onPace || (volumeChange !== null && volumeChange < -10)) {
      parts.push('This week is slightly behind pace.');
    } else {
      parts.push('Solid week so far.');
    }

    if (volumeChange !== null && volumeChange > 0) {
      parts.push(`Volume is up ${Math.abs(volumeChange).toFixed(0)}%.`);
    } else if (volumeChange !== null && volumeChange < 0) {
      parts.push(`Volume is down ${Math.abs(volumeChange).toFixed(0)}% vs last week.`);
    }

    if (improved > 0) {
      parts.push(`${improved} exercise${improved !== 1 ? 's' : ''} improved.`);
    }
    if (declined > 0 && improved === 0) {
      parts.push(`${declined} exercise${declined !== 1 ? 's' : ''} declined.`);
    }

    if (streak >= 3) {
      parts.push(`${streak}-day streak going strong.`);
    }

    return parts.join(' ') || 'Start a workout to see your progress.';
  }, [exerciseProgress, lastWeekData, weeklyVolume, plannedThisWeek, thisWeekSessions, streak]);

  // Determine next planned workout
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = dayNames[new Date().getDay()];
  const nextTemplate = templates.find((t) => t.day?.includes(today)) ?? templates[0];

  return (
    <div className="space-y-4 px-4 pt-14 pb-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {format(new Date(), 'EEEE, MMM d')}
          </p>
          <AscendLogo size="md" className="mt-1" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-full p-1.5 text-zinc-400 active:text-zinc-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
            <Flame className="h-4 w-4 text-orange-500" />
            {thisWeekSessions.length} this week
          </div>
        </div>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <button
          onClick={handleResumeWorkout}
          className="flex w-full items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-left"
        >
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-400">Workout in progress</p>
            <p className="text-xs text-emerald-500/70">{activeSession.templateName}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-emerald-500" />
        </button>
      )}

      {/* Start workout button */}
      {!activeSession && (
        <button
          onClick={() => setShowModeChooser(true)}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 font-semibold text-zinc-900 shadow-lg shadow-white/10 active:bg-zinc-200 transition-colors"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          Start Workout
        </button>
      )}

      {/* Bodyweight card with sparkline */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Bodyweight</CardTitle>
            <div className="mt-1 flex items-end gap-2">
              <CardValue>{latestWeight?.weight ?? '—'}</CardValue>
              <span className="mb-0.5 text-sm text-zinc-500">kg</span>
              {weightTrend7d !== null && (
                <div
                  className={`mb-1 flex items-center gap-0.5 text-xs font-medium ${
                    weightTrend7d <= 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {weightTrend7d <= 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {Math.abs(weightTrend7d).toFixed(1)} kg / 7d
                </div>
              )}
            </div>
          </div>
          {bodyweightChartData.length > 2 && (
            <div className="h-12 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bodyweightChartData}>
                  <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-zinc-400)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Next workout */}
      {nextTemplate && (
        <Card
          onClick={() => { setWorkoutMode('live'); setShowTemplateSelector(true); }}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
            <Calendar className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-zinc-500">Next Planned</p>
            <p className="font-semibold text-zinc-200">{nextTemplate.name}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600" />
        </Card>
      )}

      {/* Last workout */}
      {lastSession && (
        <Card
          onClick={() => navigate(`/history/${lastSession.id}`)}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
            <Dumbbell className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-zinc-500">Last Workout</p>
            <p className="font-semibold text-zinc-200">{lastSession.templateName}</p>
            <p className="text-xs text-zinc-600">
              {format(new Date(lastSession.startedAt), 'EEEE, MMM d')}
              {lastSession.duration && ` · ${Math.round(lastSession.duration / 60)} min`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600" />
        </Card>
      )}

      {/* Progress this week */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-zinc-300">Progress this week</h2>
          <p className="text-[11px] text-zinc-600">Weekly training momentum</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1 — Workouts completed */}
          <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Workouts</span>
            </div>
            <p className="text-lg font-bold text-zinc-100">
              {thisWeekSessions.length}
              {plannedThisWeek > 0 && (
                <span className="text-sm font-medium text-zinc-600"> / {plannedThisWeek}</span>
              )}
            </p>
            <p className="text-[10px] text-zinc-600">
              {plannedThisWeek > 0 ? 'completed' : 'this week'}
            </p>
          </div>

          {/* Card 2 — Weekly volume */}
          <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <BarChart3 className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Volume</span>
            </div>
            <p className="text-lg font-bold text-zinc-100">
              {weeklyVolume >= 1000
                ? `${(weeklyVolume / 1000).toFixed(1)}t`
                : weeklyVolume > 0
                  ? `${Math.round(weeklyVolume).toLocaleString()}kg`
                  : '—'}
            </p>
            {lastWeekData.volume > 0 ? (() => {
              const pct = ((weeklyVolume - lastWeekData.volume) / lastWeekData.volume) * 100;
              return (
                <p className={`text-[10px] font-medium ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% vs last week
                </p>
              );
            })() : (
              <p className="text-[10px] text-zinc-600">total weight moved</p>
            )}
          </div>

          {/* Card 3 — Exercises improved */}
          <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowUpRight className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Exercises</span>
            </div>
            {exerciseProgress.improved + exerciseProgress.stalled + exerciseProgress.declined > 0 ? (
              <>
                <p className="text-lg font-bold text-emerald-400">{exerciseProgress.improved} improved</p>
                <p className="text-[10px] text-zinc-500">
                  {[
                    exerciseProgress.stalled > 0 && `${exerciseProgress.stalled} stalled`,
                    exerciseProgress.declined > 0 && `${exerciseProgress.declined} declined`,
                  ].filter(Boolean).join(' · ') || 'no decline'}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-zinc-400">—</p>
                <p className="text-[10px] text-zinc-600">needs comparison data</p>
              </>
            )}
          </div>

          {/* Card 4 — Consistency */}
          <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Activity className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Consistency</span>
            </div>
            {streak > 0 ? (
              <>
                <p className="text-lg font-bold text-zinc-100">{streak}-day streak</p>
                <p className="text-[10px] text-zinc-600">keep it going</p>
              </>
            ) : plannedThisWeek > 0 && thisWeekSessions.length >= plannedThisWeek ? (
              <>
                <p className="text-lg font-bold text-emerald-400">On track</p>
                <p className="text-[10px] text-zinc-600">week complete</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-zinc-400">—</p>
                <p className="text-[10px] text-zinc-600">log a workout to start</p>
              </>
            )}
          </div>
        </div>

        {/* Summary sentence */}
        {thisWeekSessions.length > 0 && (
          <p className="mt-3 rounded-xl bg-zinc-800/20 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-400">
            {weeklySummary}
          </p>
        )}
      </div>

      {/* Trash link */}
      {trashCount > 0 && (
        <Card
          onClick={() => navigate('/trash')}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
            <Trash2 className="h-5 w-5 text-zinc-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-400">Trash</p>
            <p className="text-xs text-zinc-600">{trashCount} item{trashCount !== 1 ? 's' : ''}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600" />
        </Card>
      )}

      {/* Mode chooser */}
      <Sheet open={showModeChooser} onClose={() => setShowModeChooser(false)} title="Start Workout">
        <div className="space-y-3">
          <button
            onClick={() => {
              setWorkoutMode('live');
              setShowModeChooser(false);
              setShowTemplateSelector(true);
            }}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 px-4 py-4 text-left active:bg-zinc-800/50 transition-colors"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15">
              <Zap className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-zinc-100">Start now</p>
              <p className="text-xs text-zinc-500">Track your workout in real-time</p>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </button>
          <button
            onClick={() => {
              setWorkoutMode('past');
              setShowModeChooser(false);
              setShowTemplateSelector(true);
            }}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 px-4 py-4 text-left active:bg-zinc-800/50 transition-colors"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15">
              <Calendar className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-zinc-100">Log previous workout</p>
              <p className="text-xs text-zinc-500">Enter a workout from another day</p>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </button>
        </div>
      </Sheet>

      {/* Template selector */}
      <TemplateSelector
        open={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={handleStartWorkout}
      />

      {/* Past workout details form */}
      <Sheet
        open={showPastForm}
        onClose={() => { setShowPastForm(false); setPendingTemplateId(null); }}
        title="Workout Details"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-500">Date</label>
            <input
              type="date"
              value={pastDate}
              onChange={(e) => setPastDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Duration</label>
            <div className="mt-1 flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={5}
                  placeholder="0"
                  value={pastDurationH}
                  onChange={(e) => setPastDurationH(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 pr-16 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">hours</span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  placeholder="0"
                  value={pastDurationM}
                  onChange={(e) => setPastDurationM(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 pr-12 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">min</span>
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={handleStartPastWorkout}
            disabled={(parseInt(pastDurationH) || 0) === 0 && (parseInt(pastDurationM) || 0) === 0}
          >
            Continue
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

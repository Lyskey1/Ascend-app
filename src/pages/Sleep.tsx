import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus,
  Moon, ChevronLeft,
} from 'lucide-react';
import { format, subDays, isAfter, isSameWeek, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle, CardValue } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useSleepEntries, putSleepEntry, deleteSleepEntry } from '@/hooks/useWorkout';
import type { SleepEntry } from '@/db/types';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────

type Range = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  '180d': '6m',
  '365d': '1y',
  all: 'All',
};

const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
};

// ─── Helpers ────────────────────────────────────────────

function durationStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function avgArr(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// Score → text color (for cards and labels)
function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-500';
  if (score >= 85) return 'text-emerald-400';
  if (score >= 80) return 'text-blue-400';
  if (score >= 60) return 'text-red-400';
  return 'text-red-500';
}

// Score → chart fill color
function scoreChartColor(score: number): string {
  if (score >= 90) return '#15803d'; // dark green
  if (score >= 85) return '#22c55e'; // green
  if (score >= 80) return '#3b82f6'; // blue
  if (score >= 60) return '#ef4444'; // red
  return '#dc2626';                   // darker red
}

// Score → dot stroke for line chart
function scoreDotColor(score: number): string {
  return scoreChartColor(score);
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-500/10';
  if (score >= 80) return 'bg-blue-500/10';
  if (score >= 60) return 'bg-red-500/10';
  return 'bg-red-500/15';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 85) return 'Great';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Poor';
}

function trendDirection(current: number, previous: number): 'up' | 'down' | 'stable' {
  if (previous === 0) return 'stable';
  const pctChange = ((current - previous) / previous) * 100;
  if (pctChange > 3) return 'up';
  if (pctChange < -3) return 'down';
  return 'stable';
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return '+0%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Normalize bedtime for chart axis (times after 6pm → negative offset from midnight)
function normalizeBedtime(time: string): number {
  const mins = timeToMinutes(time);
  if (mins >= 1080) return mins - 1440;
  return mins;
}

function minutesToTimeStr(normalizedMins: number): string {
  let mins = normalizedMins;
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Auto-calculate wake-up time from bedtime + duration
function calcWakeUpTime(bedtime: string, durationMinutes: number): string {
  const bedMins = timeToMinutes(bedtime);
  const wakeMins = (bedMins + durationMinutes) % 1440;
  const h = Math.floor(wakeMins / 60);
  const m = wakeMins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ─── Custom score dot for line chart ────────────────────

function ScoreDot(props: { cx?: number; cy?: number; payload?: { score: number } }) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill={scoreDotColor(payload.score)} stroke="none" />;
}

// ─── Component ──────────────────────────────────────────

export function SleepPage() {
  const navigate = useNavigate();
  const entries = useSleepEntries();
  const [range, setRange] = useState<Range>('30d');
  const [showAdd, setShowAdd] = useState(false);
  const [editDate, setEditDate] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formScore, setFormScore] = useState('');
  const [formHours, setFormHours] = useState('');
  const [formMinutes, setFormMinutes] = useState('');
  const [formBedtime, setFormBedtime] = useState('');
  const [formInterruptions, setFormInterruptions] = useState('');
  const [formNote, setFormNote] = useState('');

  // Derived wake-up time (auto-calculated)
  const derivedWakeUp = useMemo(() => {
    if (!formBedtime) return null;
    const hours = parseInt(formHours, 10) || 0;
    const minutes = parseInt(formMinutes, 10) || 0;
    const dur = hours * 60 + minutes;
    if (dur <= 0) return null;
    return calcWakeUpTime(formBedtime, dur);
  }, [formBedtime, formHours, formMinutes]);

  // ─── Sorted & filtered ──────────────────────────────
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );

  const filtered = useMemo(() => {
    if (range === 'all') return sorted;
    const cutoff = subDays(new Date(), RANGE_DAYS[range]);
    return sorted.filter((e) => isAfter(new Date(e.date), cutoff));
  }, [sorted, range]);

  // ─── Score trend chart data ─────────────────────────
  const scoreTrendData = useMemo(() => {
    return filtered.map((e) => ({
      date: e.date,
      label: range === '7d' ? format(new Date(e.date), 'EEE') : format(new Date(e.date), 'MMM d'),
      score: e.sleepScore,
      fill: scoreChartColor(e.sleepScore),
    }));
  }, [filtered, range]);

  // ─── Duration chart data (color by score) ───────────
  const durationChartData = useMemo(() => {
    return filtered.map((e) => ({
      date: e.date,
      label: range === '7d' ? format(new Date(e.date), 'EEE') : format(new Date(e.date), 'MMM d'),
      hours: Math.round((e.sleepDuration / 60) * 10) / 10,
      duration: e.sleepDuration,
      fill: scoreChartColor(e.sleepScore),
    }));
  }, [filtered, range]);

  // ─── Bedtime consistency data ───────────────────────
  const bedtimeData = useMemo(() => {
    return filtered
      .filter((e) => e.bedtime)
      .map((e) => ({
        date: e.date,
        label: range === '7d' ? format(new Date(e.date), 'EEE') : format(new Date(e.date), 'MMM d'),
        bedtime: normalizeBedtime(e.bedtime!),
      }));
  }, [filtered, range]);

  // ─── Stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const scores = filtered.map((e) => e.sleepScore);
    const durations = filtered.map((e) => e.sleepDuration);
    const bedtimes = filtered.filter((e) => e.bedtime).map((e) => normalizeBedtime(e.bedtime!));

    const avgScore = avgArr(scores);
    const avgDuration = avgArr(durations);
    const avgBedtime = bedtimes.length > 0
      ? Math.round(bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length)
      : null;

    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const bestEntry = filtered.find((e) => e.sleepScore === bestScore);

    const last = sorted.length > 0 ? sorted[sorted.length - 1] : null;

    // 7-day average
    const last7 = sorted.filter((e) => isAfter(new Date(e.date), subDays(now, 7)));
    const avg7Score = avgArr(last7.map((e) => e.sleepScore));

    // Trend (7d vs prev 7d)
    const prev7 = sorted.filter((e) => {
      const d = new Date(e.date);
      return isAfter(d, subDays(now, 14)) && !isAfter(d, subDays(now, 7));
    });
    const prevAvg7Score = avgArr(prev7.map((e) => e.sleepScore));
    const scoreTrend = trendDirection(avg7Score, prevAvg7Score);

    // This week vs last week
    const thisWeekEntries = sorted.filter((e) => isSameWeek(new Date(e.date), now, { weekStartsOn: 1 }));
    const lastWeekStart = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
    const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
    const lastWeekEntries = sorted.filter((e) => {
      const d = new Date(e.date);
      return d >= lastWeekStart && d <= lastWeekEnd;
    });

    const thisWeekAvgScore = avgArr(thisWeekEntries.map((e) => e.sleepScore));
    const lastWeekAvgScore = avgArr(lastWeekEntries.map((e) => e.sleepScore));
    const thisWeekAvgDuration = avgArr(thisWeekEntries.map((e) => e.sleepDuration));
    const lastWeekAvgDuration = avgArr(lastWeekEntries.map((e) => e.sleepDuration));

    // Bedtime consistency (std dev)
    let bedtimeConsistency: number | null = null;
    if (bedtimes.length >= 3) {
      const mean = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
      const variance = bedtimes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / bedtimes.length;
      bedtimeConsistency = Math.round(Math.sqrt(variance));
    }

    return {
      avgScore, avgDuration, avgBedtime,
      bestScore, bestEntry, last,
      avg7Score, scoreTrend,
      thisWeekAvgScore, lastWeekAvgScore,
      thisWeekAvgDuration, lastWeekAvgDuration,
      bedtimeConsistency,
      totalEntries: filtered.length,
    };
  }, [filtered, sorted]);

  // ─── Form handlers ──────────────────────────────────
  function openAdd() {
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormScore('');
    setFormHours('');
    setFormMinutes('');
    setFormBedtime('');
    setFormInterruptions('');
    setFormNote('');
    setEditDate(null);
    setShowAdd(true);
  }

  function openEdit(entry: SleepEntry) {
    setFormDate(entry.date);
    setFormScore(String(entry.sleepScore));
    const h = Math.floor(entry.sleepDuration / 60);
    const m = entry.sleepDuration % 60;
    setFormHours(String(h));
    setFormMinutes(m > 0 ? String(m) : '');
    setFormBedtime(entry.bedtime || '');
    setFormInterruptions(entry.interruptions != null ? String(entry.interruptions) : '');
    setFormNote(entry.note || '');
    setEditDate(entry.date);
    setShowAdd(true);
  }

  async function handleSave() {
    const score = parseInt(formScore, 10);
    const hours = parseInt(formHours, 10) || 0;
    const minutes = parseInt(formMinutes, 10) || 0;
    const duration = hours * 60 + minutes;
    if (isNaN(score) || score < 1 || score > 100 || duration <= 0) return;

    const entry: SleepEntry = {
      date: formDate,
      sleepScore: score,
      sleepDuration: duration,
    };
    if (formBedtime) {
      entry.bedtime = formBedtime;
      // Auto-calculate wake-up time
      entry.wakeUpTime = calcWakeUpTime(formBedtime, duration);
    }
    if (formInterruptions) {
      const n = parseInt(formInterruptions, 10);
      if (!isNaN(n)) entry.interruptions = n;
    }
    if (formNote.trim()) entry.note = formNote.trim();

    await putSleepEntry(entry);
    setShowAdd(false);
  }

  async function handleDelete(date: string) {
    await deleteSleepEntry(date);
  }

  // Avg duration reference
  const avgDurationHours = useMemo(() => {
    const vals = filtered.map((e) => e.sleepDuration);
    if (vals.length === 0) return 0;
    return Math.round((avgArr(vals) / 60) * 10) / 10;
  }, [filtered]);

  return (
    <div className="space-y-4 px-4 pt-14 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/health')}
            className="rounded-full p-1.5 text-zinc-400 active:text-zinc-200 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">Sleep</h1>
            <p className="text-xs text-zinc-500">Recovery & sleep quality</p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Last night highlight */}
      {stats.last && (
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Last Night</CardTitle>
              <div className="flex items-baseline gap-3 mt-1">
                <span className={`text-3xl font-bold ${scoreColor(stats.last.sleepScore)}`}>
                  {stats.last.sleepScore}
                </span>
                <span className="text-lg text-zinc-300">{durationStr(stats.last.sleepDuration)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {scoreLabel(stats.last.sleepScore)} &middot; {format(new Date(stats.last.date), 'MMM d')}
                {stats.last.bedtime && (
                  <> &middot; {stats.last.bedtime} → {stats.last.wakeUpTime || calcWakeUpTime(stats.last.bedtime, stats.last.sleepDuration)}</>
                )}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-full ${scoreBg(stats.last.sleepScore)} flex items-center justify-center`}>
              <Moon className={`h-6 w-6 ${scoreColor(stats.last.sleepScore)}`} />
            </div>
          </div>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>Avg Score</CardTitle>
          <CardValue className={scoreColor(stats.avgScore)}>{stats.avgScore}</CardValue>
          <div className="mt-1 flex items-center gap-1 text-xs">
            {stats.scoreTrend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
            {stats.scoreTrend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
            {stats.scoreTrend === 'stable' && <Minus className="h-3 w-3 text-zinc-400" />}
            <span className={
              stats.scoreTrend === 'up' ? 'text-emerald-400' :
              stats.scoreTrend === 'down' ? 'text-red-400' : 'text-zinc-500'
            }>
              {stats.scoreTrend === 'up' ? 'Improving' : stats.scoreTrend === 'down' ? 'Declining' : 'Stable'}
            </span>
          </div>
        </Card>
        <Card>
          <CardTitle>Avg Duration</CardTitle>
          <CardValue>{durationStr(stats.avgDuration)}</CardValue>
          <p className="text-xs text-zinc-500 mt-1">{scoreLabel(stats.avgScore)} quality</p>
        </Card>
        {stats.avgBedtime !== null && (
          <Card>
            <CardTitle>Avg Bedtime</CardTitle>
            <CardValue className="text-xl">{minutesToTimeStr(stats.avgBedtime)}</CardValue>
            {stats.bedtimeConsistency !== null && (
              <p className={`text-xs mt-1 ${stats.bedtimeConsistency <= 30 ? 'text-emerald-400' : stats.bedtimeConsistency <= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                &plusmn;{stats.bedtimeConsistency}min variance
              </p>
            )}
          </Card>
        )}
        <Card>
          <CardTitle>Best Night</CardTitle>
          <CardValue className="text-emerald-400">{stats.bestScore}</CardValue>
          {stats.bestEntry && (
            <p className="text-xs text-zinc-500 mt-1">
              {format(new Date(stats.bestEntry.date), 'MMM d')} &middot; {durationStr(stats.bestEntry.sleepDuration)}
            </p>
          )}
        </Card>
      </div>

      {/* Period filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              range === r
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-800/60 text-zinc-400 active:bg-zinc-700'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Sleep score trend — color-coded dots */}
      {scoreTrendData.length > 0 && (
        <Card className="p-3">
          <CardTitle className="mb-1">Sleep Score Trend</CardTitle>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            {[
              { color: '#dc2626', label: '< 60' },
              { color: '#ef4444', label: '60–79' },
              { color: '#3b82f6', label: '80–84' },
              { color: '#22c55e', label: '85–89' },
              { color: '#15803d', label: '90+' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-zinc-500">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrendData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={range === '7d' ? 0 : 'equidistantPreserveStart'}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-zinc-900)',
                    border: '1px solid var(--color-zinc-700)',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                    color: 'var(--color-zinc-100)',
                  }}
                  formatter={(value) => [value as number, 'Score']}
                />
                <ReferenceLine y={stats.avgScore} stroke="var(--color-zinc-600)" strokeDasharray="4 4" />
                <Line
                  dataKey="score"
                  type="monotone"
                  stroke="var(--color-zinc-500)"
                  strokeWidth={1.5}
                  dot={<ScoreDot />}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Sleep duration chart — color-coded by score */}
      {durationChartData.length > 0 && (
        <Card className="p-3">
          <CardTitle className="mb-3">Sleep Duration</CardTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationChartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={range === '7d' ? 0 : 'equidistantPreserveStart'}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-zinc-900)',
                    border: '1px solid var(--color-zinc-700)',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                    color: 'var(--color-zinc-100)',
                  }}
                  formatter={(_v, _n, item) => [
                    durationStr((item as unknown as { payload: { duration: number } }).payload.duration),
                    'Duration',
                  ]}
                />
                <ReferenceLine
                  y={avgDurationHours}
                  stroke="var(--color-zinc-600)"
                  strokeDasharray="4 4"
                  label={{ value: `avg ${durationStr(stats.avgDuration)}`, position: 'right', fontSize: 9, fill: 'var(--color-zinc-500)' }}
                />
                <Bar dataKey="hours" radius={[3, 3, 0, 0]} opacity={0.85}>
                  {durationChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Bedtime consistency chart */}
      {bedtimeData.length >= 3 && (
        <Card className="p-3">
          <CardTitle className="mb-3">Bedtime Consistency</CardTitle>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bedtimeData} margin={{ top: 5, right: 5, bottom: 0, left: -5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={range === '7d' ? 0 : 'equidistantPreserveStart'}
                />
                <YAxis
                  reversed
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => minutesToTimeStr(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-zinc-900)',
                    border: '1px solid var(--color-zinc-700)',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                    color: 'var(--color-zinc-100)',
                  }}
                  formatter={(value) => [minutesToTimeStr(value as number), 'Bedtime']}
                />
                {stats.avgBedtime !== null && (
                  <ReferenceLine y={stats.avgBedtime} stroke="var(--color-zinc-600)" strokeDasharray="4 4" />
                )}
                <Line
                  dataKey="bedtime"
                  type="monotone"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#fbbf24' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Weekly comparison cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>This Week Score</CardTitle>
          <CardValue className={`text-xl ${scoreColor(stats.thisWeekAvgScore)}`}>{stats.thisWeekAvgScore}</CardValue>
          {stats.lastWeekAvgScore > 0 && (
            <p className={`text-xs mt-1 ${
              stats.thisWeekAvgScore >= stats.lastWeekAvgScore ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {pctChange(stats.thisWeekAvgScore, stats.lastWeekAvgScore)} vs last week
            </p>
          )}
        </Card>
        <Card>
          <CardTitle>This Week Duration</CardTitle>
          <CardValue className="text-xl">{durationStr(stats.thisWeekAvgDuration)}</CardValue>
          {stats.lastWeekAvgDuration > 0 && (
            <p className={`text-xs mt-1 ${
              stats.thisWeekAvgDuration >= stats.lastWeekAvgDuration ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {pctChange(stats.thisWeekAvgDuration, stats.lastWeekAvgDuration)} vs last week
            </p>
          )}
        </Card>
      </div>

      {/* History list */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">History</h2>
        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">No entries yet. Tap "Add" to log your sleep.</p>
          )}
          {[...filtered].reverse().slice(0, 30).map((entry) => {
            const wakeUp = entry.bedtime
              ? (entry.wakeUpTime || calcWakeUpTime(entry.bedtime, entry.sleepDuration))
              : null;
            return (
              <div
                key={entry.date}
                className="flex items-center justify-between rounded-xl bg-zinc-900/50 border border-zinc-800/30 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: scoreChartColor(entry.sleepScore) }}
                    />
                    <span className={`text-lg font-bold ${scoreColor(entry.sleepScore)}`}>
                      {entry.sleepScore}
                    </span>
                    <span className="text-sm text-zinc-300">{durationStr(entry.sleepDuration)}</span>
                    {entry.bedtime && (
                      <span className="text-xs text-zinc-500">{entry.bedtime} → {wakeUp}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 ml-[22px]">
                    {format(new Date(entry.date), 'EEE, MMM d yyyy')}
                    {entry.interruptions != null && ` · ${entry.interruptions} wake-ups`}
                    {entry.note && <> · {entry.note}</>}
                  </p>
                </div>
                <div className="flex gap-2 ml-2">
                  <button
                    onClick={() => openEdit(entry)}
                    className="p-1.5 text-zinc-500 active:text-zinc-300"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.date)}
                    className="p-1.5 text-zinc-500 active:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title={editDate ? 'Edit Sleep' : 'Log Sleep'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Sleep Score (1–100)</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              placeholder="e.g. 78"
              value={formScore}
              onChange={(e) => setFormScore(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Sleep Duration</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="24"
                  placeholder="Hours"
                  value={formHours}
                  onChange={(e) => setFormHours(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  placeholder="Minutes"
                  value={formMinutes}
                  onChange={(e) => setFormMinutes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800/50 pt-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Optional</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Bedtime</label>
                <input
                  type="time"
                  value={formBedtime}
                  onChange={(e) => setFormBedtime(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
                />
                {derivedWakeUp && (
                  <p className="text-xs text-zinc-500 mt-1.5">
                    Wake-up: <span className="text-zinc-300 font-medium">{derivedWakeUp}</span>
                    <span className="text-zinc-600 ml-1">(auto-calculated)</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Wake-ups / Interruptions</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={formInterruptions}
                  onChange={(e) => setFormInterruptions(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Note</label>
                <input
                  type="text"
                  placeholder="e.g. Late coffee, stressful day..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <Button
            fullWidth
            onClick={handleSave}
            disabled={!formScore || !formHours || isNaN(parseInt(formScore, 10))}
          >
            {editDate ? 'Update' : 'Save'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

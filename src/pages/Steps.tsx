import { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus,
  Footprints, Flame, ChevronLeft,
} from 'lucide-react';
import { format, subDays, isAfter, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameWeek, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle, CardValue } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useStepEntries, putStepEntry, deleteStepEntry } from '@/hooks/useWorkout';
import type { StepEntry } from '@/db/types';
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
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

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function avgArr(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
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

// Step count → bar color
function stepBarColor(steps: number): string {
  if (steps >= 10000) return '#15803d'; // dark green
  if (steps >= 7500) return '#22c55e';  // green
  if (steps >= 5000) return '#f59e0b';  // amber/orange
  return '#ef4444';                      // red
}

// ─── Component ──────────────────────────────────────────

export function StepsPage() {
  const navigate = useNavigate();
  const entries = useStepEntries();
  const [range, setRange] = useState<Range>('30d');
  const [showAdd, setShowAdd] = useState(false);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formSteps, setFormSteps] = useState('');
  const [formNote, setFormNote] = useState('');

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

  // ─── Chart data ─────────────────────────────────────
  const chartData = useMemo(() => {
    if (filtered.length === 0) return [];

    const lookup = new Map(filtered.map((e) => [e.date, e.stepCount]));
    const start = new Date(filtered[0].date);
    const end = new Date(filtered[filtered.length - 1].date);
    const days = eachDayOfInterval({ start, end });

    const allValues: number[] = [];
    return days.map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const val = lookup.get(dateStr) ?? 0;
      allValues.push(val);

      const maWindow = allValues.slice(-7);
      const ma = maWindow.length > 0 ? Math.round(maWindow.reduce((a, b) => a + b, 0) / maWindow.length) : val;

      return {
        date: dateStr,
        label: range === '7d' ? format(d, 'EEE') : format(d, 'MMM d'),
        steps: val,
        ma,
        hasData: lookup.has(dateStr),
        fill: stepBarColor(val),
      };
    });
  }, [filtered, range]);

  // ─── Stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const vals = filtered.filter((e) => e.stepCount > 0).map((e) => e.stepCount);
    const now = new Date();

    // This week vs last week
    const thisWeekEntries = sorted.filter((e) => isSameWeek(new Date(e.date), now, { weekStartsOn: 1 }));
    const lastWeekStart = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
    const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
    const lastWeekEntries = sorted.filter((e) => {
      const d = new Date(e.date);
      return d >= lastWeekStart && d <= lastWeekEnd;
    });

    const thisWeekAvg = avgArr(thisWeekEntries.map((e) => e.stepCount));
    const lastWeekAvg = avgArr(lastWeekEntries.map((e) => e.stepCount));

    // This month vs last month
    const thisMonthEntries = sorted.filter((e) => isSameMonth(new Date(e.date), now));
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);
    const lastMonthEntries = sorted.filter((e) => {
      const d = new Date(e.date);
      return d >= lastMonthStart && d <= lastMonthEnd;
    });

    const thisMonthAvg = avgArr(thisMonthEntries.map((e) => e.stepCount));
    const lastMonthAvg = avgArr(lastMonthEntries.map((e) => e.stepCount));

    // 7-day average
    const last7 = sorted.filter((e) => isAfter(new Date(e.date), subDays(now, 7)));
    const avg7 = avgArr(last7.map((e) => e.stepCount));

    // Best / worst
    const best = vals.length > 0 ? Math.max(...vals) : 0;
    const worst = vals.length > 0 ? Math.min(...vals) : 0;
    const bestDate = filtered.find((e) => e.stepCount === best)?.date;

    // Streak above 10k
    let streak = 0;
    const reverseSorted = [...sorted].reverse();
    for (const e of reverseSorted) {
      if (e.stepCount >= 10000) streak++;
      else break;
    }

    // Trend direction (7-day avg vs prev 7-day avg)
    const prev7 = sorted.filter((e) => {
      const d = new Date(e.date);
      return isAfter(d, subDays(now, 14)) && !isAfter(d, subDays(now, 7));
    });
    const prevAvg7 = avgArr(prev7.map((e) => e.stepCount));
    const trend = trendDirection(avg7, prevAvg7);

    // Today
    const todayStr = format(now, 'yyyy-MM-dd');
    const today = sorted.find((e) => e.date === todayStr)?.stepCount ?? null;

    return {
      avg7, best, bestDate, streak, trend, today,
      thisWeekAvg, lastWeekAvg, thisMonthAvg, lastMonthAvg,
      totalEntries: vals.length,
    };
  }, [filtered, sorted]);

  // ─── Monthly insight sentence ───────────────────────
  const monthlyInsight = useMemo(() => {
    if (stats.lastMonthAvg === 0 || stats.thisMonthAvg === 0) return null;
    const diff = stats.thisMonthAvg - stats.lastMonthAvg;
    const pct = Math.abs(((diff) / stats.lastMonthAvg) * 100);
    if (Math.abs(diff) < 200) {
      return 'Your daily average this month is on par with last month.';
    }
    if (diff > 0) {
      return `Your daily average is up ${fmt(Math.abs(diff))} steps (+${pct.toFixed(0)}%) compared to last month.`;
    }
    return `You're averaging ${fmt(Math.abs(diff))} fewer steps per day (−${pct.toFixed(0)}%) compared to last month.`;
  }, [stats.thisMonthAvg, stats.lastMonthAvg]);

  // ─── Form handlers ──────────────────────────────────
  function openAdd() {
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormSteps('');
    setFormNote('');
    setEditDate(null);
    setShowAdd(true);
  }

  function openEdit(entry: StepEntry) {
    setFormDate(entry.date);
    setFormSteps(String(entry.stepCount));
    setFormNote(entry.note || '');
    setEditDate(entry.date);
    setShowAdd(true);
  }

  async function handleSave() {
    const count = parseInt(formSteps, 10);
    if (isNaN(count) || count < 0) return;
    await putStepEntry(formDate, count, formNote.trim() || undefined);
    setShowAdd(false);
  }

  async function handleDelete(date: string) {
    await deleteStepEntry(date);
  }

  // ─── Average reference line value ───────────────────
  const avgRef = useMemo(() => {
    const vals = chartData.filter((d) => d.hasData).map((d) => d.steps);
    return avgArr(vals);
  }, [chartData]);

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
            <h1 className="text-2xl font-bold text-zinc-50">Steps</h1>
            <p className="text-xs text-zinc-500">Daily movement tracking</p>
          </div>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Today highlight */}
      {stats.today !== null && (
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Today</CardTitle>
              <CardValue className="text-3xl">{fmt(stats.today)}</CardValue>
              <p className="text-xs text-zinc-500 mt-1">steps</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Footprints className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </Card>
      )}

      {/* Summary cards row */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>7-Day Avg</CardTitle>
          <CardValue>{fmt(stats.avg7)}</CardValue>
          <div className="mt-1 flex items-center gap-1 text-xs">
            {stats.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
            {stats.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
            {stats.trend === 'stable' && <Minus className="h-3 w-3 text-zinc-400" />}
            <span className={
              stats.trend === 'up' ? 'text-emerald-400' :
              stats.trend === 'down' ? 'text-red-400' : 'text-zinc-500'
            }>
              {stats.trend === 'up' ? 'Trending up' : stats.trend === 'down' ? 'Trending down' : 'Stable'}
            </span>
          </div>
        </Card>
        <Card>
          <CardTitle>Best Day</CardTitle>
          <CardValue>{fmt(stats.best)}</CardValue>
          {stats.bestDate && (
            <p className="text-xs text-zinc-500 mt-1">
              {format(new Date(stats.bestDate), 'MMM d')}
            </p>
          )}
        </Card>
        <Card>
          <CardTitle>10k+ Streak</CardTitle>
          <CardValue>{stats.streak} <span className="text-base font-normal text-zinc-500">days</span></CardValue>
          <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            <Flame className="h-3 w-3 text-orange-400" />
            Consecutive
          </div>
        </Card>
        <Card>
          <CardTitle>Total Logged</CardTitle>
          <CardValue>{stats.totalEntries} <span className="text-base font-normal text-zinc-500">days</span></CardValue>
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

      {/* Main chart — color-coded bars */}
      {chartData.length > 0 && (
        <Card className="p-3">
          <CardTitle className="mb-1">Daily Steps</CardTitle>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            {[
              { color: '#ef4444', label: '< 5k' },
              { color: '#f59e0b', label: '5k–7.5k' },
              { color: '#22c55e', label: '7.5k–10k' },
              { color: '#15803d', label: '10k+' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-zinc-500">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
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
                  tickFormatter={(v) => fmt(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-zinc-900)',
                    border: '1px solid var(--color-zinc-700)',
                    borderRadius: '0.75rem',
                    fontSize: 12,
                    color: 'var(--color-zinc-100)',
                  }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(),
                    name === 'ma' ? '7d avg' : 'Steps',
                  ]}
                  labelFormatter={(label) => label}
                />
                <ReferenceLine
                  y={avgRef}
                  stroke="var(--color-zinc-600)"
                  strokeDasharray="4 4"
                  label={{ value: `avg ${fmt(avgRef)}`, position: 'right', fontSize: 9, fill: 'var(--color-zinc-500)' }}
                />
                <Bar dataKey="steps" radius={[3, 3, 0, 0]} opacity={0.85}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
                {range !== '7d' && (
                  <Line
                    dataKey="ma"
                    type="monotone"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Comparison cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>This Week</CardTitle>
          <CardValue className="text-xl">{fmt(stats.thisWeekAvg)}<span className="text-sm font-normal text-zinc-500"> avg</span></CardValue>
          {stats.lastWeekAvg > 0 && (
            <p className={`text-xs mt-1 ${
              stats.thisWeekAvg >= stats.lastWeekAvg ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {pctChange(stats.thisWeekAvg, stats.lastWeekAvg)} vs last week
            </p>
          )}
        </Card>
        <Card>
          <CardTitle>This Month</CardTitle>
          <CardValue className="text-xl">{fmt(stats.thisMonthAvg)}<span className="text-sm font-normal text-zinc-500"> avg</span></CardValue>
          {stats.lastMonthAvg > 0 && (
            <p className={`text-xs mt-1 ${
              stats.thisMonthAvg >= stats.lastMonthAvg ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {pctChange(stats.thisMonthAvg, stats.lastMonthAvg)} vs last month
            </p>
          )}
        </Card>
      </div>

      {/* Monthly insight sentence */}
      {monthlyInsight && (
        <Card>
          <CardTitle className="mb-1">Monthly Trend</CardTitle>
          <p className={`text-sm ${
            stats.thisMonthAvg > stats.lastMonthAvg ? 'text-emerald-400' :
            stats.thisMonthAvg < stats.lastMonthAvg ? 'text-amber-400' : 'text-zinc-400'
          }`}>
            {monthlyInsight}
          </p>
        </Card>
      )}

      {/* History list */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">History</h2>
        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">No entries yet. Tap "Add" to log your steps.</p>
          )}
          {[...filtered].reverse().slice(0, 30).map((entry) => (
            <div
              key={entry.date}
              className="flex items-center justify-between rounded-xl bg-zinc-900/50 border border-zinc-800/30 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stepBarColor(entry.stepCount) }}
                  />
                  <p className="text-sm font-medium text-zinc-200">
                    {entry.stepCount.toLocaleString()} steps
                  </p>
                </div>
                <p className="text-xs text-zinc-500 ml-4">
                  {format(new Date(entry.date), 'EEE, MMM d yyyy')}
                  {entry.note && <> &middot; {entry.note}</>}
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
          ))}
        </div>
      </div>

      {/* Add/Edit Sheet */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title={editDate ? 'Edit Steps' : 'Add Steps'}>
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
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Step Count</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 8500"
              value={formSteps}
              onChange={(e) => setFormSteps(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Note <span className="text-zinc-600 font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. Marathon day, long hike..."
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-zinc-100 text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <Button fullWidth onClick={handleSave} disabled={!formSteps || isNaN(parseInt(formSteps, 10))}>
            {editDate ? 'Update' : 'Save'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

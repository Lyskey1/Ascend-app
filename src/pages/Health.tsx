import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale, Footprints, Moon, ChevronRight,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { Card, CardTitle } from '@/components/ui/Card';
import { useBodyweightEntries, useStepEntries, useSleepEntries } from '@/hooks/useWorkout';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';

// ─── Helpers ────────────────────────────────────────────

function avgArr(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function fmt(n: number): string {
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

function trendIcon(current: number, previous: number, invert = false) {
  if (previous === 0) return { icon: Minus, color: 'text-zinc-500', label: 'No prior data' };
  const pct = ((current - previous) / previous) * 100;
  const isUp = invert ? pct < -3 : pct > 3;
  const isDown = invert ? pct > 3 : pct < -3;
  if (isUp) return { icon: TrendingUp, color: 'text-emerald-400', label: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` };
  if (isDown) return { icon: TrendingDown, color: 'text-red-400', label: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` };
  return { icon: Minus, color: 'text-zinc-500', label: 'Stable' };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Component ──────────────────────────────────────────

export function HealthPage() {
  const navigate = useNavigate();
  const bwEntries = useBodyweightEntries();
  const stepEntries = useStepEntries();
  const sleepEntries = useSleepEntries();

  // ─── Bodyweight summary ─────────────────────────────
  const bwSummary = useMemo(() => {
    if (bwEntries.length === 0) return null;
    const sorted = [...bwEntries].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const last7 = sorted.filter((e) => isAfter(new Date(e.date), subDays(new Date(), 7)));
    const prev7 = sorted.filter((e) => {
      const d = new Date(e.date);
      return isAfter(d, subDays(new Date(), 14)) && !isAfter(d, subDays(new Date(), 7));
    });
    const avg7 = avgArr(last7.map((e) => e.weight));
    const prevAvg7 = avgArr(prev7.map((e) => e.weight));

    // Sparkline data (last 14 points)
    const sparkData = sorted.slice(-14).map((e) => ({ v: e.weight }));

    return { latest, avg7, prevAvg7, sparkData, count: bwEntries.length };
  }, [bwEntries]);

  // ─── Steps summary ─────────────────────────────────
  const stepsSummary = useMemo(() => {
    if (stepEntries.length === 0) return null;
    const sorted = [...stepEntries].sort((a, b) => a.date.localeCompare(b.date));
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = sorted.find((e) => e.date === todayStr);
    const last7 = sorted.filter((e) => isAfter(new Date(e.date), subDays(new Date(), 7)));
    const prev7 = sorted.filter((e) => {
      const d = new Date(e.date);
      return isAfter(d, subDays(new Date(), 14)) && !isAfter(d, subDays(new Date(), 7));
    });
    const avg7 = avgArr(last7.map((e) => e.stepCount));
    const prevAvg7 = avgArr(prev7.map((e) => e.stepCount));

    // Sparkline (last 14 days)
    const sparkData = sorted.slice(-14).map((e) => ({ v: e.stepCount }));

    return { today, avg7, prevAvg7, sparkData, count: stepEntries.length };
  }, [stepEntries]);

  // ─── Sleep summary ──────────────────────────────────
  const sleepSummary = useMemo(() => {
    if (sleepEntries.length === 0) return null;
    const sorted = [...sleepEntries].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const last7 = sorted.filter((e) => isAfter(new Date(e.date), subDays(new Date(), 7)));
    const prev7 = sorted.filter((e) => {
      const d = new Date(e.date);
      return isAfter(d, subDays(new Date(), 14)) && !isAfter(d, subDays(new Date(), 7));
    });
    const avg7Score = avgArr(last7.map((e) => e.sleepScore));
    const prevAvg7Score = avgArr(prev7.map((e) => e.sleepScore));
    const avg7Duration = avgArr(last7.map((e) => e.sleepDuration));

    // Sparkline
    const sparkData = sorted.slice(-14).map((e) => ({ v: e.sleepScore }));

    return { last, avg7Score, prevAvg7Score, avg7Duration, sparkData, count: sleepEntries.length };
  }, [sleepEntries]);

  return (
    <div className="space-y-4 px-4 pt-14 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Health</h1>
        <p className="text-xs text-zinc-500">Track your body, movement & recovery</p>
      </div>

      {/* ── Body Weight card ────────────────────────── */}
      <Card onClick={() => navigate('/bodyweight')} className="group">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle>Body Weight</CardTitle>
              {bwSummary ? (
                <>
                  <p className="text-xl font-bold text-zinc-50 mt-0.5">
                    {bwSummary.latest.weight} <span className="text-sm font-normal text-zinc-500">kg</span>
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {(() => {
                      const t = trendIcon(bwSummary.avg7, bwSummary.prevAvg7);
                      const Icon = t.icon;
                      return (
                        <>
                          <Icon className={`h-3 w-3 ${t.color}`} />
                          <span className={`text-xs ${t.color}`}>{t.label}</span>
                          <span className="text-xs text-zinc-600 ml-1">7d avg</span>
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500 mt-1">No entries yet</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bwSummary && bwSummary.sparkData.length >= 3 && (
              <div className="h-10 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bwSummary.sparkData}>
                    <Line dataKey="v" type="monotone" stroke="var(--color-zinc-500)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </div>
        </div>
      </Card>

      {/* ── Steps card ──────────────────────────────── */}
      <Card onClick={() => navigate('/steps')} className="group">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Footprints className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle>Daily Steps</CardTitle>
              {stepsSummary ? (
                <>
                  <p className="text-xl font-bold text-zinc-50 mt-0.5">
                    {stepsSummary.today
                      ? <>{fmt(stepsSummary.today.stepCount)} <span className="text-sm font-normal text-zinc-500">today</span></>
                      : <>{fmt(stepsSummary.avg7)} <span className="text-sm font-normal text-zinc-500">7d avg</span></>
                    }
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {(() => {
                      const t = trendIcon(stepsSummary.avg7, stepsSummary.prevAvg7);
                      const Icon = t.icon;
                      return (
                        <>
                          <Icon className={`h-3 w-3 ${t.color}`} />
                          <span className={`text-xs ${t.color}`}>{t.label}</span>
                          <span className="text-xs text-zinc-600 ml-1">vs prev week</span>
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500 mt-1">No entries yet</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stepsSummary && stepsSummary.sparkData.length >= 3 && (
              <div className="h-10 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stepsSummary.sparkData}>
                    <Bar dataKey="v" fill="#3b82f6" radius={[1, 1, 0, 0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </div>
        </div>
      </Card>

      {/* ── Sleep card ──────────────────────────────── */}
      <Card onClick={() => navigate('/sleep')} className="group">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Moon className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <CardTitle>Sleep</CardTitle>
              {sleepSummary ? (
                <>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className={`text-xl font-bold ${scoreColor(sleepSummary.last.sleepScore)}`}>
                      {sleepSummary.last.sleepScore}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {durationStr(sleepSummary.last.sleepDuration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {(() => {
                      const t = trendIcon(sleepSummary.avg7Score, sleepSummary.prevAvg7Score);
                      const Icon = t.icon;
                      return (
                        <>
                          <Icon className={`h-3 w-3 ${t.color}`} />
                          <span className={`text-xs ${t.color}`}>{t.label}</span>
                          <span className="text-xs text-zinc-600 ml-1">7d score avg</span>
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500 mt-1">No entries yet</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sleepSummary && sleepSummary.sparkData.length >= 3 && (
              <div className="h-10 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sleepSummary.sparkData}>
                    <Line dataKey="v" type="monotone" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </div>
        </div>
      </Card>

      {/* ── Recovery insight ───────────────────────── */}
      {sleepSummary && stepsSummary && (
        <Card>
          <CardTitle className="mb-2">Recovery Snapshot</CardTitle>
          <div className="space-y-2">
            {sleepSummary.avg7Score >= 70 && stepsSummary.avg7 >= 7000 ? (
              <p className="text-sm text-emerald-400">
                You're recovering well — good sleep and solid daily movement this week.
              </p>
            ) : sleepSummary.avg7Score < 60 ? (
              <p className="text-sm text-amber-400">
                Sleep quality has been low recently. Consider prioritizing recovery before pushing hard in training.
              </p>
            ) : stepsSummary.avg7 < 5000 ? (
              <p className="text-sm text-amber-400">
                Daily movement has been low. Try to get more steps in on non-training days.
              </p>
            ) : (
              <p className="text-sm text-zinc-400">
                Sleep: {sleepSummary.avg7Score} avg score &middot; Steps: {fmt(stepsSummary.avg7)} avg
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

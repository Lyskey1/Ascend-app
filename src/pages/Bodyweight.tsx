import { useState, useMemo, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import {
  Plus, TrendingDown, TrendingUp, Trash2, Pencil, X,
  Eye, Target, GripVertical, ChevronLeft,
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { parseDecimalInput, DECIMAL_INPUT_PATTERN } from '@/lib/decimal';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  useBodyweightEntries,
  addBodyweightEntry,
  updateBodyweightEntry,
  deleteBodyweightEntry,
  getBodyweightEntriesByDate,
} from '@/hooks/useWorkout';
import { trashBodyweightEntry } from '@/hooks/useTrash';
import { Card, CardTitle, CardValue } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import {
  TAG_COLOR_PRESETS,
  DEFAULT_TAG_CONFIGS,
  type TagConfig,
  type BodyweightEntry,
  type BodyweightTargetRange,
  type ChartDisplayMode,
} from '@/db/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────

type Range = '7d' | '30d' | '90d' | '180d' | '365d' | '730d' | '1095d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  '180d': '6m',
  '365d': '1y',
  '730d': '2y',
  '1095d': '3y',
  all: 'All',
};

const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
  '730d': 730,
  '1095d': 1095,
};

// ─── LocalStorage helpers ────────────────────────────────

const LS_KEYS = {
  targetRange: 'iron_bw_target_range',
  customTags: 'iron_bw_custom_tags',
  tagConfigs: 'iron_bw_tag_configs',
  chartMode: 'iron_bw_chart_mode',
};

function loadTargetRange(): BodyweightTargetRange | null {
  try {
    const v = localStorage.getItem(LS_KEYS.targetRange);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

function saveTargetRange(range: BodyweightTargetRange | null) {
  if (range) localStorage.setItem(LS_KEYS.targetRange, JSON.stringify(range));
  else localStorage.removeItem(LS_KEYS.targetRange);
}

function loadTagConfigs(): TagConfig[] {
  try {
    const v = localStorage.getItem(LS_KEYS.tagConfigs);
    if (v) return JSON.parse(v);
    // Migrate: merge defaults with any legacy custom tags
    const legacy = localStorage.getItem(LS_KEYS.customTags);
    const legacyTags: string[] = legacy ? JSON.parse(legacy) : [];
    const configs = [...DEFAULT_TAG_CONFIGS];
    for (const tag of legacyTags) {
      if (!configs.some((c) => c.id === tag)) {
        configs.push({ id: tag, label: tag, color: '#71717a' });
      }
    }
    return configs;
  } catch {
    return [...DEFAULT_TAG_CONFIGS];
  }
}

function saveTagConfigs(configs: TagConfig[]) {
  localStorage.setItem(LS_KEYS.tagConfigs, JSON.stringify(configs));
}

function loadChartMode(): ChartDisplayMode {
  return (localStorage.getItem(LS_KEYS.chartMode) as ChartDisplayMode) ?? 'both';
}

function saveChartMode(mode: ChartDisplayMode) {
  localStorage.setItem(LS_KEYS.chartMode, mode);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tagStyle(color: string): React.CSSProperties {
  return { backgroundColor: hexToRgba(color, 0.2), color };
}

// ─── History row (works on both touch and mouse) ─────────

function HistoryRow({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const moved = useRef(false);
  const touchUsed = useRef(false);

  const handleTouchStart = (e: ReactTouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
    moved.current = false;
    touchUsed.current = true;
  };

  const handleTouchMove = (e: ReactTouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!swiping.current && !moved.current) {
      if (Math.abs(dx) > 8) {
        swiping.current = true;
        moved.current = true;
      } else if (Math.abs(dy) > 8) {
        moved.current = true;
        return;
      }
    }

    if (swiping.current) {
      const clamped = Math.max(-80, Math.min(0, dx + (offset < -40 ? -80 : 0)));
      setOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (swiping.current) {
      setOffset(offset < -40 ? -80 : 0);
    } else if (!moved.current) {
      onEdit();
    }
    swiping.current = false;
  };

  const handleClick = () => {
    // On touch devices, taps are handled in handleTouchEnd.
    // On mouse/desktop, touchUsed stays false, so we fire onEdit here.
    if (!touchUsed.current) {
      onEdit();
    }
    // Reset for next interaction
    touchUsed.current = false;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button revealed behind on swipe */}
      <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-500/90">
        <button onClick={onDelete} className="flex flex-col items-center gap-0.5 p-2">
          <Trash2 className="h-4 w-4 text-white" />
          <span className="text-[10px] font-medium text-white">Delete</span>
        </button>
      </div>
      {/* Content row */}
      <div
        className="relative bg-zinc-950 transition-transform duration-150 cursor-pointer select-none"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Custom chart dot with target range coloring ─────────

function TargetDot(props: {
  cx?: number;
  cy?: number;
  payload?: { weight: number };
  targetRange: BodyweightTargetRange | null;
}) {
  const { cx, cy, payload, targetRange } = props;
  if (cx === undefined || cy === undefined || !payload) return null;

  let fill = 'var(--color-zinc-100)';
  if (targetRange) {
    if (payload.weight > targetRange.max) fill = '#f87171';
    else if (payload.weight < targetRange.min) fill = '#60a5fa';
    else fill = '#34d399';
  }

  return <circle cx={cx} cy={cy} r={3.5} fill={fill} stroke="none" />;
}

// ─── Tag picker sub-component ────────────────────────────

function TagPicker({
  tagConfigs,
  selectedTags,
  onToggle,
  onManage,
}: {
  tagConfigs: TagConfig[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onManage: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-zinc-500">Tags</label>
        <button
          onClick={onManage}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-300 active:text-zinc-300"
        >
          Manage tags
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tagConfigs.map((tc) => (
          <button
            key={tc.id}
            onClick={() => onToggle(tc.id)}
            className="rounded-full px-2.5 py-1.5 text-xs font-medium transition-all"
            style={
              selectedTags.includes(tc.id)
                ? tagStyle(tc.color)
                : { backgroundColor: 'var(--color-zinc-800)', color: 'var(--color-zinc-500)' }
            }
          >
            {tc.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

export function BodyweightPage() {
  const navigate = useNavigate();
  const entries = useBodyweightEntries();
  const [range, setRange] = useState<Range>('30d');

  // Sheet states
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showTargetSheet, setShowTargetSheet] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // Add/Edit form state
  const [addMode, setAddMode] = useState<'quick' | 'advanced'>('quick');
  const [formWeight, setFormWeight] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formNote, setFormNote] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [editingEntry, setEditingEntry] = useState<BodyweightEntry | null>(null);
  const [pendingAdd, setPendingAdd] = useState<{
    weight: number; date: string; note?: string; tags?: string[];
  } | null>(null);

  // Settings
  const [targetRange, setTargetRange] = useState<BodyweightTargetRange | null>(loadTargetRange);
  const [targetMin, setTargetMin] = useState(targetRange?.min.toString() ?? '');
  const [targetMax, setTargetMax] = useState(targetRange?.max.toString() ?? '');
  const [chartMode, setChartMode] = useState<ChartDisplayMode>(loadChartMode);
  const [tagConfigs, setTagConfigs] = useState<TagConfig[]>(loadTagConfigs);
  const [newTagName, setNewTagName] = useState('');
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null);
  const [customHexInput, setCustomHexInput] = useState('');
  const [showDeleteTagConfirm, setShowDeleteTagConfirm] = useState<string | null>(null);

  // Tag config map for lookups
  const tagMap = useMemo(() => new Map(tagConfigs.map((t) => [t.id, t])), [tagConfigs]);
  const getTagLabel = (tag: string) => tagMap.get(tag)?.label ?? tag;
  const getTagColor = (tag: string) => tagMap.get(tag)?.color ?? '#71717a';

  // ─── Filtered entries (period-aware) ─────────────────

  const filteredEntries = useMemo(() => {
    const sorted = [...entries].reverse(); // oldest → newest
    if (range === 'all') return sorted;
    const cutoff = subDays(new Date(), RANGE_DAYS[range]);
    return sorted.filter((e) => isAfter(new Date(e.date), cutoff));
  }, [entries, range]);

  // ─── Chart data ──────────────────────────────────────

  const chartData = useMemo(() => {
    const fmt = range === '7d' ? 'EEE' : 'MMM d';
    return filteredEntries.map((e) => ({
      date: format(new Date(e.date), fmt),
      weight: e.weight,
      fullDate: e.date,
    }));
  }, [filteredEntries, range]);

  const chartDataWithMA = useMemo(() => {
    return chartData.map((point, i) => {
      const windowSize = Math.min(7, i + 1);
      const windowSlice = chartData.slice(Math.max(0, i - 6), i + 1);
      const avg = windowSlice.reduce((sum, p) => sum + p.weight, 0) / windowSize;
      return { ...point, ma: Math.round(avg * 10) / 10 };
    });
  }, [chartData]);

  // ─── Period-aware stats ──────────────────────────────

  const latest = entries[0];

  const stats = useMemo(() => {
    if (filteredEntries.length < 1) return null;
    const weights = filteredEntries.map((e) => e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const avg = weights.reduce((s, w) => s + w, 0) / weights.length;
    const change = filteredEntries.length >= 2
      ? filteredEntries[filteredEntries.length - 1].weight - filteredEntries[0].weight
      : 0;
    return { change, min, max, avg: Math.round(avg * 10) / 10, count: filteredEntries.length };
  }, [filteredEntries]);

  // ─── Entries with diffs for history list ─────────────

  const entriesWithDiff = useMemo(() => {
    return entries.map((entry, i) => {
      const prev = entries[i + 1];
      const diff = prev ? Math.round((entry.weight - prev.weight) * 10) / 10 : null;
      return { ...entry, diff };
    });
  }, [entries]);

  // ─── Chart Y domain ─────────────────────────────────

  const yDomain = useMemo(() => {
    const weights = filteredEntries.map((e) => e.weight);
    if (weights.length === 0) return [70, 90];
    let lo = Math.min(...weights);
    let hi = Math.max(...weights);
    if (targetRange) {
      lo = Math.min(lo, targetRange.min);
      hi = Math.max(hi, targetRange.max);
    }
    return [lo - 0.5, hi + 0.5];
  }, [filteredEntries, targetRange]);

  // ─── Handlers ────────────────────────────────────────

  const resetForm = () => {
    setFormWeight('');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormNote('');
    setFormTags([]);
    setAddMode('quick');
  };

  const openAddSheet = () => {
    resetForm();
    setShowAddSheet(true);
  };

  const openEditSheet = (entry: BodyweightEntry) => {
    setEditingEntry(entry);
    setFormWeight(entry.weight.toString());
    setFormDate(entry.date);
    setFormNote(entry.note ?? '');
    setFormTags(entry.tags ?? []);
    setShowEditSheet(true);
  };

  const toggleFormTag = (tag: string) => {
    setFormTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAdd = async () => {
    const w = parseDecimalInput(formWeight);
    if (isNaN(w) || w <= 0) return;

    const date = addMode === 'quick' ? format(new Date(), 'yyyy-MM-dd') : formDate;
    const note = addMode === 'advanced' && formNote ? formNote : undefined;
    const tags = addMode === 'advanced' && formTags.length > 0 ? formTags : undefined;

    const existing = await getBodyweightEntriesByDate(date);
    if (existing.length > 0) {
      setPendingAdd({ weight: w, date, note, tags });
      setShowDuplicateConfirm(true);
      return;
    }

    await addBodyweightEntry(w, date, note, tags);
    setShowAddSheet(false);
    resetForm();
  };

  const handleDuplicateReplace = async () => {
    if (!pendingAdd) return;
    const existing = await getBodyweightEntriesByDate(pendingAdd.date);
    for (const e of existing) await deleteBodyweightEntry(e.id);
    await addBodyweightEntry(pendingAdd.weight, pendingAdd.date, pendingAdd.note, pendingAdd.tags);
    setShowDuplicateConfirm(false);
    setShowAddSheet(false);
    setPendingAdd(null);
    resetForm();
  };

  const handleDuplicateKeepBoth = async () => {
    if (!pendingAdd) return;
    await addBodyweightEntry(pendingAdd.weight, pendingAdd.date, pendingAdd.note, pendingAdd.tags);
    setShowDuplicateConfirm(false);
    setShowAddSheet(false);
    setPendingAdd(null);
    resetForm();
  };

  const handleEdit = async () => {
    if (!editingEntry) return;
    const w = parseDecimalInput(formWeight);
    if (isNaN(w) || w <= 0) return;

    await updateBodyweightEntry(editingEntry.id, {
      weight: w,
      date: formDate,
      note: formNote || undefined,
      tags: formTags.length > 0 ? formTags : undefined,
    });

    setShowEditSheet(false);
    setEditingEntry(null);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    const entry = entries.find((e) => e.id === showDeleteConfirm);
    if (entry) {
      await trashBodyweightEntry(entry);
    } else {
      await deleteBodyweightEntry(showDeleteConfirm);
    }
    setShowDeleteConfirm(null);
    if (showEditSheet) {
      setShowEditSheet(false);
      setEditingEntry(null);
    }
  };

  const handleSaveTargetRange = () => {
    const min = parseDecimalInput(targetMin);
    const max = parseDecimalInput(targetMax);
    if (!isNaN(min) && !isNaN(max) && min < max) {
      const r = { min, max };
      setTargetRange(r);
      saveTargetRange(r);
    } else {
      setTargetRange(null);
      saveTargetRange(null);
    }
    setShowTargetSheet(false);
  };

  const handleClearTargetRange = () => {
    setTargetRange(null);
    saveTargetRange(null);
    setTargetMin('');
    setTargetMax('');
    setShowTargetSheet(false);
  };

  const handleChartModeToggle = () => {
    const next: ChartDisplayMode =
      chartMode === 'both' ? 'raw' : chartMode === 'raw' ? 'ma' : 'both';
    setChartMode(next);
    saveChartMode(next);
  };

  const handleAddTag = () => {
    const id = newTagName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!id || tagConfigs.some((t) => t.id === id)) return;
    const updated = [...tagConfigs, { id, label: newTagName.trim(), color: '#71717a' }];
    setTagConfigs(updated);
    saveTagConfigs(updated);
    setNewTagName('');
  };

  const handleDeleteTag = async (tagId: string) => {
    // Remove tag from entries in DB
    const entriesWithTag = entries.filter((e) => e.tags?.includes(tagId));
    for (const entry of entriesWithTag) {
      await updateBodyweightEntry(entry.id, {
        tags: entry.tags?.filter((t) => t !== tagId),
      });
    }
    const updated = tagConfigs.filter((t) => t.id !== tagId);
    setTagConfigs(updated);
    saveTagConfigs(updated);
    setShowDeleteTagConfirm(null);
  };

  const handleTagColorChange = (tagId: string, color: string) => {
    const updated = tagConfigs.map((t) => (t.id === tagId ? { ...t, color } : t));
    setTagConfigs(updated);
    saveTagConfigs(updated);
  };

  const handleTagReorder = (newOrder: string[]) => {
    const configMap = new Map(tagConfigs.map((t) => [t.id, t]));
    const reordered = newOrder.map((id) => configMap.get(id)!).filter(Boolean);
    setTagConfigs(reordered);
    saveTagConfigs(reordered);
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="px-4 pt-14 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/health')}
            className="rounded-full p-1.5 text-zinc-400 active:text-zinc-200 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-zinc-50">Bodyweight</h1>
        </div>
        <Button size="sm" onClick={openAddSheet}>
          <Plus className="h-4 w-4" />
          Log
        </Button>
      </div>

      {/* Current weight card with period-aware stats */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Current</CardTitle>
            <div className="mt-1 flex items-end gap-2">
              <CardValue>{latest?.weight ?? '—'}</CardValue>
              <span className="mb-0.5 text-sm text-zinc-500">kg</span>
            </div>
            {latest && (
              <p className="mt-0.5 text-xs text-zinc-600">
                {format(new Date(latest.date), 'MMM d, yyyy')}
              </p>
            )}
            {targetRange && latest && (
              <p className={`mt-1 text-xs font-medium ${
                latest.weight > targetRange.max
                  ? 'text-red-400'
                  : latest.weight < targetRange.min
                    ? 'text-blue-400'
                    : 'text-emerald-400'
              }`}>
                {latest.weight > targetRange.max
                  ? `+${(latest.weight - targetRange.max).toFixed(1)} above target`
                  : latest.weight < targetRange.min
                    ? `${(targetRange.min - latest.weight).toFixed(1)} below target`
                    : 'Within target range'}
              </p>
            )}
          </div>
          {stats && stats.count >= 2 && (
            <div className="text-right">
              <div className={`flex items-center gap-1 text-sm font-medium ${
                stats.change <= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {stats.change <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                {stats.change > 0 ? '+' : ''}{stats.change.toFixed(1)} kg
              </div>
              <p className="text-xs text-zinc-600">{RANGE_LABELS[range]} change</p>
            </div>
          )}
        </div>
      </Card>

      {/* Range selector — scrollable on mobile, wrapping on desktop */}
      <div className="flex gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
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

      {/* Chart controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleChartModeToggle}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 active:text-zinc-200"
        >
          <Eye className="h-3 w-3" />
          {chartMode === 'both' ? 'Raw + MA' : chartMode === 'raw' ? 'Raw only' : 'MA only'}
        </button>
        <button
          onClick={() => {
            setTargetMin(targetRange?.min.toString() ?? '');
            setTargetMax(targetRange?.max.toString() ?? '');
            setShowTargetSheet(true);
          }}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
            targetRange
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 active:text-zinc-200'
          }`}
        >
          <Target className="h-3 w-3" />
          {targetRange ? `${targetRange.min}–${targetRange.max}` : 'Target range'}
        </button>
      </div>

      {/* Chart */}
      {chartDataWithMA.length > 1 && (
        <Card className="p-2">
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataWithMA} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: 'var(--color-zinc-500)' }}
                  tickLine={false}
                  axisLine={false}
                  tickCount={5}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-zinc-900)',
                    border: '1px solid var(--color-zinc-800)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />

                {targetRange && (
                  <ReferenceArea
                    y1={targetRange.min}
                    y2={targetRange.max}
                    fill="#34d399"
                    fillOpacity={0.06}
                    stroke="#34d399"
                    strokeOpacity={0.2}
                    strokeDasharray="4 4"
                  />
                )}
                {targetRange && (
                  <>
                    <ReferenceLine
                      y={targetRange.min}
                      stroke="#34d399"
                      strokeOpacity={0.3}
                      strokeDasharray="4 4"
                      label={{ value: `${targetRange.min}`, position: 'left', fill: '#34d399', fontSize: 9 }}
                    />
                    <ReferenceLine
                      y={targetRange.max}
                      stroke="#34d399"
                      strokeOpacity={0.3}
                      strokeDasharray="4 4"
                      label={{ value: `${targetRange.max}`, position: 'left', fill: '#34d399', fontSize: 9 }}
                    />
                  </>
                )}

                {stats && (
                  <ReferenceLine
                    y={stats.avg}
                    stroke="var(--color-zinc-600)"
                    strokeDasharray="4 4"
                    label={{ value: `avg ${stats.avg}`, position: 'right', fill: 'var(--color-zinc-600)', fontSize: 10 }}
                  />
                )}

                {(chartMode === 'both' || chartMode === 'raw') && (
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={targetRange ? 'var(--color-zinc-500)' : 'var(--color-zinc-100)'}
                    strokeWidth={chartMode === 'raw' ? 2 : 1.5}
                    dot={targetRange
                      ? (props: Record<string, unknown>) => (
                          <TargetDot
                            key={`dot-${props.index}`}
                            cx={props.cx as number}
                            cy={props.cy as number}
                            payload={props.payload as { weight: number }}
                            targetRange={targetRange}
                          />
                        )
                      : { r: 3, fill: 'var(--color-zinc-100)', strokeWidth: 0 }
                    }
                    activeDot={{ r: 5, fill: 'var(--color-white)' }}
                  />
                )}

                {(chartMode === 'both' || chartMode === 'ma') && (
                  <Line
                    type="monotone"
                    dataKey="ma"
                    stroke="#a78bfa"
                    strokeWidth={chartMode === 'ma' ? 2 : 1.5}
                    strokeDasharray={chartMode === 'ma' ? undefined : '4 4'}
                    dot={chartMode === 'ma'
                      ? (targetRange
                          ? (props: Record<string, unknown>) => {
                              const payload = props.payload as { ma: number };
                              let fill = '#a78bfa';
                              if (targetRange) {
                                if (payload.ma > targetRange.max) fill = '#f87171';
                                else if (payload.ma < targetRange.min) fill = '#60a5fa';
                                else fill = '#34d399';
                              }
                              return <circle key={`ma-${props.index}`} cx={props.cx as number} cy={props.cy as number} r={3} fill={fill} stroke="none" />;
                            }
                          : { r: 2.5, fill: '#a78bfa', strokeWidth: 0 })
                      : false
                    }
                    name="7-day MA"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Period-aware stats grid */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <Card className="px-3 py-2.5">
            <CardTitle className="text-[10px]">Min</CardTitle>
            <p className="mt-0.5 text-base font-bold text-zinc-100">{stats.min}</p>
          </Card>
          <Card className="px-3 py-2.5">
            <CardTitle className="text-[10px]">Avg</CardTitle>
            <p className="mt-0.5 text-base font-bold text-zinc-100">{stats.avg}</p>
          </Card>
          <Card className="px-3 py-2.5">
            <CardTitle className="text-[10px]">Max</CardTitle>
            <p className="mt-0.5 text-base font-bold text-zinc-100">{stats.max}</p>
          </Card>
          <Card className="px-3 py-2.5">
            <CardTitle className="text-[10px]">Change</CardTitle>
            <p className={`mt-0.5 text-base font-bold ${
              stats.change <= 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {stats.change > 0 ? '+' : ''}{stats.change.toFixed(1)}
            </p>
          </Card>
        </div>
      )}

      {/* History list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-zinc-400">History</h2>
          <span className="text-xs text-zinc-600">{entries.length} entries</span>
        </div>
        <div className="space-y-1">
          {entriesWithDiff.map((entry) => (
            <HistoryRow
              key={entry.id}
              onEdit={() => openEditSheet(entry)}
              onDelete={() => setShowDeleteConfirm(entry.id)}
            >
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-zinc-900/30 hover:bg-zinc-800/40 active:bg-zinc-800/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-300">
                      {format(new Date(entry.date), 'EEE, MMM d, yyyy')}
                    </p>
                  </div>
                  {entry.note && (
                    <p className="mt-0.5 text-xs text-zinc-600 truncate">{entry.note}</p>
                  )}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={tagStyle(getTagColor(tag))}
                        >
                          {getTagLabel(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-200">{entry.weight} kg</p>
                    {entry.diff !== null && (
                      <p className={`text-[11px] font-medium ${
                        entry.diff < 0
                          ? 'text-emerald-500/70'
                          : entry.diff > 0
                            ? 'text-amber-500/70'
                            : 'text-zinc-600'
                      }`}>
                        {entry.diff > 0 ? '+' : ''}{entry.diff.toFixed(1)} kg
                      </p>
                    )}
                  </div>
                  <Pencil className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                </div>
              </div>
            </HistoryRow>
          ))}
        </div>
      </div>

      {/* ─── Add weight sheet ───────────────────────────── */}
      <Sheet
        open={showAddSheet}
        onClose={() => { setShowAddSheet(false); resetForm(); }}
        title="Log Bodyweight"
      >
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-zinc-800/50 p-0.5">
            <button
              onClick={() => setAddMode('quick')}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                addMode === 'quick' ? 'bg-white text-zinc-900' : 'text-zinc-400'
              }`}
            >
              Quick Add
            </button>
            <button
              onClick={() => setAddMode('advanced')}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                addMode === 'advanced' ? 'bg-white text-zinc-900' : 'text-zinc-400'
              }`}
            >
              Advanced
            </button>
          </div>

          {/* Weight input */}
          <div>
            <label className="text-xs font-medium text-zinc-500">Weight (kg)</label>
            <input
              type="text"
              inputMode="decimal"
              pattern={DECIMAL_INPUT_PATTERN}
              value={formWeight}
              onChange={(e) => setFormWeight(e.target.value)}
              placeholder={latest?.weight.toString() ?? '80.0'}
              autoFocus
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-center text-2xl font-bold text-zinc-100 placeholder-zinc-700 outline-none focus:border-zinc-600"
            />
          </div>

          {/* Advanced fields */}
          <AnimatePresence>
            {addMode === 'advanced' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div>
                  <label className="text-xs font-medium text-zinc-500">Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Note (optional)</label>
                  <input
                    type="text"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="e.g. fasted, post-workout..."
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
                  />
                </div>
                <TagPicker
                  tagConfigs={tagConfigs}
                  selectedTags={formTags}
                  onToggle={toggleFormTag}
                  onManage={() => setShowTagManager(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Button variant="primary" fullWidth size="lg" onClick={handleAdd}>
            {addMode === 'quick' ? 'Save (Today)' : 'Save'}
          </Button>
        </div>
      </Sheet>

      {/* ─── Edit entry sheet ───────────────────────────── */}
      <Sheet
        open={showEditSheet}
        onClose={() => { setShowEditSheet(false); setEditingEntry(null); }}
        title="Edit Entry"
      >
        {editingEntry && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-500">Weight (kg)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern={DECIMAL_INPUT_PATTERN}
                value={formWeight}
                onChange={(e) => setFormWeight(e.target.value)}
                autoFocus
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-center text-2xl font-bold text-zinc-100 outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Note (optional)</label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="e.g. fasted, post-workout..."
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
            </div>
            <TagPicker
              tagConfigs={tagConfigs}
              selectedTags={formTags}
              onToggle={toggleFormTag}
              onManage={() => setShowTagManager(true)}
            />
            <div className="flex gap-3">
              <Button variant="primary" fullWidth size="lg" onClick={handleEdit}>
                Save Changes
              </Button>
              <Button
                variant="danger"
                size="lg"
                onClick={() => setShowDeleteConfirm(editingEntry.id)}
                className="px-4"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* ─── Target weight range sheet ──────────────────── */}
      <Sheet
        open={showTargetSheet}
        onClose={() => setShowTargetSheet(false)}
        title="Target Weight Range"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            Set your target weight range. The chart will highlight entries above (red), within (green), or below (blue) this range.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500">Min (kg)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern={DECIMAL_INPUT_PATTERN}
                value={targetMin}
                onChange={(e) => setTargetMin(e.target.value)}
                placeholder="e.g. 78"
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-center text-lg font-semibold text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Max (kg)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern={DECIMAL_INPUT_PATTERN}
                value={targetMax}
                onChange={(e) => setTargetMax(e.target.value)}
                placeholder="e.g. 82"
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-center text-lg font-semibold text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" fullWidth size="lg" onClick={handleSaveTargetRange}>
              Save
            </Button>
            {targetRange && (
              <Button variant="ghost" size="lg" onClick={handleClearTargetRange}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </Sheet>

      {/* ─── Tag manager sheet ──────────────────────────── */}
      <Sheet
        open={showTagManager}
        onClose={() => { setShowTagManager(false); setExpandedTagId(null); }}
        title="Manage Tags"
      >
        <div className="space-y-5">
          {/* Add new tag */}
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Create tag</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
              <Button size="sm" onClick={handleAddTag} disabled={!newTagName.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Tag list with drag-and-drop reorder */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-2">
              Drag to reorder
            </p>
            <Reorder.Group
              axis="y"
              values={tagConfigs.map((t) => t.id)}
              onReorder={handleTagReorder}
              className="space-y-1.5"
            >
              {tagConfigs.map((tc) => {
                const usageCount = entries.filter((e) => e.tags?.includes(tc.id)).length;
                return (
                  <Reorder.Item
                    key={tc.id}
                    value={tc.id}
                    onDragStart={() => setExpandedTagId(null)}
                    className="rounded-xl bg-zinc-800/20 overflow-hidden list-none"
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <GripVertical className="h-4 w-4 text-zinc-600 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" />
                      <button
                        onClick={() => {
                          setExpandedTagId(expandedTagId === tc.id ? null : tc.id);
                          setCustomHexInput(tc.color);
                        }}
                        className="h-5 w-5 rounded-full flex-shrink-0 border-2 transition-all"
                        style={{
                          backgroundColor: tc.color,
                          borderColor: expandedTagId === tc.id ? '#fff' : 'rgba(63,63,70,0.5)',
                        }}
                        title="Change color"
                      />
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={tagStyle(tc.color)}
                      >
                        {tc.label}
                      </span>
                      <div className="flex-1" />
                      {usageCount > 0 && (
                        <span className="text-[10px] text-zinc-600 flex-shrink-0">{usageCount}</span>
                      )}
                      <button
                        onClick={() => setShowDeleteTagConfirm(tc.id)}
                        className="rounded-full p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 active:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Color picker (expanded) */}
                    <AnimatePresence>
                      {expandedTagId === tc.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1">
                            <div className="grid grid-cols-8 gap-1.5 mb-2">
                              {TAG_COLOR_PRESETS.map((color) => (
                                <button
                                  key={color}
                                  onClick={() => handleTagColorChange(tc.id, color)}
                                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                                    tc.color === color ? 'border-white scale-110' : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customHexInput}
                                onChange={(e) => setCustomHexInput(e.target.value)}
                                placeholder="#hex"
                                maxLength={7}
                                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (/^#[0-9a-fA-F]{6}$/.test(customHexInput)) {
                                    handleTagColorChange(tc.id, customHexInput.toLowerCase());
                                  }
                                }}
                                disabled={!/^#[0-9a-fA-F]{6}$/.test(customHexInput)}
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </div>
        </div>
      </Sheet>

      {/* ─── Delete tag confirmation ─────────────────────── */}
      <ConfirmDialog
        open={!!showDeleteTagConfirm}
        title="Delete tag?"
        description={
          showDeleteTagConfirm
            ? (() => {
                const count = entries.filter((e) => e.tags?.includes(showDeleteTagConfirm)).length;
                return count > 0
                  ? `This tag is used in ${count} ${count === 1 ? 'entry' : 'entries'}. Deleting it will remove the tag from those entries.`
                  : 'This tag is not used in any entries.';
              })()
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => showDeleteTagConfirm && handleDeleteTag(showDeleteTagConfirm)}
        onCancel={() => setShowDeleteTagConfirm(null)}
      />

      {/* ─── Delete confirmation ────────────────────────── */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        title="Delete entry?"
        description="This entry will be moved to Trash."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      {/* ─── Duplicate date confirmation ────────────────── */}
      <AnimatePresence>
        {showDuplicateConfirm && pendingAdd && (
          <DialogOverlay onClose={() => { setShowDuplicateConfirm(false); setPendingAdd(null); }}>
            <h3 className="text-base font-semibold text-zinc-100">Duplicate date</h3>
            <p className="mt-1 text-sm text-zinc-400">
              An entry already exists for {format(new Date(pendingAdd.date), 'MMM d, yyyy')}.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" fullWidth onClick={handleDuplicateReplace}>
                Replace existing
              </Button>
              <Button variant="secondary" fullWidth onClick={handleDuplicateKeepBoth}>
                Keep both
              </Button>
              <Button variant="ghost" fullWidth onClick={() => { setShowDuplicateConfirm(false); setPendingAdd(null); }}>
                Cancel
              </Button>
            </div>
          </DialogOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Reusable confirm dialog ─────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <DialogOverlay onClose={onCancel}>
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="ghost" fullWidth onClick={onCancel}>Cancel</Button>
            <Button variant={confirmVariant} fullWidth onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </DialogOverlay>
      )}
    </AnimatePresence>
  );
}

function DialogOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed z-[110] inset-0 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50">
          {children}
        </div>
      </motion.div>
    </>
  );
}

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus, ChevronRight, Trash2, Search, X, GripVertical, Play, Upload, Pencil,
  FolderPlus,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  useTemplates, useExercises, saveTemplate,
  addCustomExercise, saveTemplateOrder, updateExercise,
} from '@/hooks/useWorkout';
import { trashTemplate, trashProgramGroup } from '@/hooks/useTrash';
import {
  CATEGORY_LABELS, MUSCLE_GROUP_LABELS, MUSCLE_GROUP_COLORS, WORKOUT_EMOJIS,
  type WorkoutCategory, type WorkoutTemplate, type WorkoutTemplateExercise,
  type MuscleGroup, type Exercise, type ExerciseType,
} from '@/db/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { DecimalInput } from '@/components/ui/DecimalInput';

// ─── Helpers ────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const categoryIcons: Record<string, string> = {
  upper_push: '\u{1F4AA}',
  upper_pull: '\u{1F3CB}\u{FE0F}',
  legs: '\u{1F9B5}',
  shoulders: '\u{1F525}',
  cardio: '\u{2764}\u{FE0F}',
  full_body: '\u{26A1}',
  rest: '\u{1F634}',
  custom: '\u{2699}\u{FE0F}',
};

const LS_EXERCISE_ORDER = 'iron_exercise_order';

function loadExerciseOrder(): string[] {
  try {
    const v = localStorage.getItem(LS_EXERCISE_ORDER);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

function saveExerciseOrder(order: string[]) {
  localStorage.setItem(LS_EXERCISE_ORDER, JSON.stringify(order));
}

const MUSCLE_FILTER_OPTIONS: (MuscleGroup | 'all')[] = [
  'all', 'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms',
  'cardio', 'full_body',
];

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MAX_MEDIA_SIZE = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function detectMediaType(file: File): 'image' | 'gif' | 'video' {
  if (file.type === 'image/gif') return 'gif';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}

// ─── Cardio helpers ─────────────────────────────────────

function computePace(durationMin: number, distanceKm: number): string {
  if (!durationMin || !distanceKm || distanceKm <= 0) return '';
  const paceMin = durationMin / distanceKm;
  const mins = Math.floor(paceMin);
  const secs = Math.round((paceMin - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/km`;
}

type CardioIntensity = NonNullable<WorkoutTemplateExercise['cardioIntensity']>;

const INTENSITY_LABELS: Record<CardioIntensity, string> = {
  very_easy: 'Very Easy',
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  very_hard: 'Very Hard',
  intervals: 'Intervals',
};

function inferIntensity(durationMin: number, distanceKm: number): CardioIntensity | undefined {
  if (!durationMin || !distanceKm || distanceKm <= 0) return undefined;
  const paceMinPerKm = durationMin / distanceKm;
  if (paceMinPerKm > 10) return 'very_easy';
  if (paceMinPerKm >= 7) return 'easy';
  if (paceMinPerKm >= 5.5) return 'moderate';
  if (paceMinPerKm >= 4.5) return 'hard';
  return 'very_hard';
}

// ─── Program groups ─────────────────────────────────────

interface ProgramGroup {
  id: string;
  name: string;
  emoji?: string;
}

const GROUP_EMOJIS = [
  // Sports & fitness
  '💪', '🏋️', '🏃', '🚴', '🏊', '🤸', '🧗', '🧘', '🥊', '🥋',
  '⛹️', '🏌️', '🏄', '🏂', '⛷️', '🎾', '⚽', '🏀', '🏈', '🎯',
  // Energy & motivation
  '🔥', '⚡', '💥', '✨', '⭐', '🌟', '💎', '👑', '🏆', '🥇',
  '🛡️', '⚔️',
  // Animals (strong / iconic)
  '🦁', '🐺', '🦅', '🐉', '🦍', '🐻', '🐯', '🦈', '🐍', '🦄',
  // Hearts
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
  // Colored circles
  '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪',
  // Places & buildings
  '🏠', '🏢', '🏟️', '🏰', '🏯', '⛩️', '🗼', '🗽', '🌆', '🏙️',
  '🏖️', '⛰️', '🏔️', '🌋',
  // Travel & transport
  '✈️', '🚀', '🛸', '⛵', '🚂', '🌍', '🌎', '🌏', '🗺️', '📍',
  '🧭', '⛺',
  // Weather
  '☀️', '🌈', '❄️', '🌊', '🌪️',
  // Nature & plants
  '🌱', '🌲', '🌳', '🌴', '🌵', '🍀', '🌸', '🌺', '🌻', '🌹',
  '🍁', '🍄', '🌿',
  // Animals (cute)
  '🐶', '🐱', '🐼', '🐨', '🦊', '🐸', '🐵', '🐧', '🦉', '🐬',
  '🦋', '🐝', '🐘', '🦌', '🐴',
  // Food & drinks
  '☕', '🍵', '🍺', '🍷', '🍕', '🍔', '🌮', '🍣', '🍜', '🥗',
  '🍎', '🍌', '🥑', '🌶️', '🍫', '🍩', '🎂',
  // Celebration & mood
  '🎉', '🎊', '🎈', '🎁', '🎆', '🥳', '😎', '🤩',
  // Work & productivity
  '💼', '📁', '📋', '📌', '📝', '💡', '🔧', '⚙️', '🛠️', '📈',
  '📊', '🗂️', '🏷️', '🔖',
  // Lifestyle & media
  '🎵', '🎧', '🎸', '🎬', '🎮', '🎲', '🧩', '🎨', '📷', '📱',
  '💻', '⏰', '🔔',
  // Symbols
  '💰', '🔑', '🔒', '✅', '❌', '💯', '🏁', '🚩',
  // Flags
  '🇫🇷', '🇺🇸', '🇬🇧', '🇩🇪', '🇪🇸', '🇮🇹', '🇯🇵', '🇰🇷',
  '🇨🇳', '🇧🇷', '🇦🇺', '🇨🇦', '🇲🇽', '🇮🇳', '🇷🇺', '🇻🇳',
  '🇹🇭', '🇮🇩', '🇵🇭', '🇸🇬', '🇲🇾', '🇭🇰', '🇹🇼', '🇵🇹',
  '🇳🇱', '🇧🇪', '🇨🇭', '🇦🇹', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮',
];

interface GroupLayout {
  groups: ProgramGroup[];
  assignments: Record<string, string>;
}

const LS_GROUP_LAYOUT = 'iron_program_groups';
const UNCATEGORIZED_ID = '__uncategorized__';

function loadGroupLayout(): GroupLayout {
  try {
    const v = localStorage.getItem(LS_GROUP_LAYOUT);
    if (v) return JSON.parse(v);
  } catch { /* ignore */ }
  return { groups: [], assignments: {} };
}

function saveGroupLayout(layout: GroupLayout) {
  localStorage.setItem(LS_GROUP_LAYOUT, JSON.stringify(layout));
}

// ─── Flat list item type ────────────────────────────────

type FlatItem =
  | { kind: 'header'; groupId: string; name: string; emoji?: string; isUncategorized: boolean }
  | { kind: 'card'; template: WorkoutTemplate; groupId: string };

// ─── MediaThumbnail ─────────────────────────────────────

function MediaThumbnail({
  exercise,
  size = 'sm',
  onClick,
}: {
  exercise: Exercise;
  size?: 'sm' | 'md';
  onClick?: (e: React.MouseEvent) => void;
}) {
  const dim = size === 'md' ? 'h-9 w-9' : 'h-6 w-6';

  if (exercise.mediaUrl && exercise.mediaType) {
    const isPlayable = exercise.mediaType === 'gif' || exercise.mediaType === 'video';
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
        className={`${dim} rounded-lg overflow-hidden flex-shrink-0 relative group`}
      >
        {exercise.mediaType === 'video' ? (
          <video src={exercise.mediaUrl} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <img src={exercise.mediaUrl} alt={exercise.name} className="h-full w-full object-cover" />
        )}
        {isPlayable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play className="h-2.5 w-2.5 text-white fill-white" />
          </div>
        )}
      </button>
    );
  }

  const color = MUSCLE_GROUP_COLORS[exercise.primaryMuscle];
  const label = MUSCLE_GROUP_LABELS[exercise.primaryMuscle];
  const sz = size === 'md' ? 'h-9 w-9 text-[10px]' : 'h-6 w-6 text-[8px]';
  return (
    <div
      className={`${sz} rounded-lg flex items-center justify-center font-bold tracking-tight flex-shrink-0`}
      style={{ backgroundColor: hexToRgba(color, 0.2), color }}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

function MuscleChips({ exercise }: { exercise: Exercise }) {
  const secondaries = exercise.secondaryMuscles ?? (exercise.secondaryMuscle ? [exercise.secondaryMuscle] : []);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span
        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
        style={{
          backgroundColor: hexToRgba(MUSCLE_GROUP_COLORS[exercise.primaryMuscle], 0.15),
          color: MUSCLE_GROUP_COLORS[exercise.primaryMuscle],
        }}
      >
        {MUSCLE_GROUP_LABELS[exercise.primaryMuscle]}
      </span>
      {secondaries.map((m) => (
        <span
          key={m}
          className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-zinc-500"
          style={{ backgroundColor: 'rgba(63,63,70,0.3)' }}
        >
          {MUSCLE_GROUP_LABELS[m]}
        </span>
      ))}
    </div>
  );
}

// ─── Cardio exercise fields component ───────────────────

function CardioFields({
  te,
  idx,
  onUpdate,
}: {
  te: WorkoutTemplateExercise;
  idx: number;
  onUpdate: (index: number, updates: Partial<WorkoutTemplateExercise>) => void;
}) {
  const paceManuallyEdited = useRef(false);
  const intensityManuallyEdited = useRef(false);

  const autoPace = computePace(te.cardioDuration ?? 0, te.cardioDistance ?? 0);
  const autoIntensity = inferIntensity(te.cardioDuration ?? 0, te.cardioDistance ?? 0);

  const displayPace = paceManuallyEdited.current ? (te.cardioPace ?? '') : (autoPace || te.cardioPace || '');
  const displayIntensity = intensityManuallyEdited.current
    ? (te.cardioIntensity ?? '')
    : (autoIntensity ?? te.cardioIntensity ?? '');

  const handleDurationChange = (val: number) => {
    const updates: Partial<WorkoutTemplateExercise> = { cardioDuration: val };
    const newPace = computePace(val, te.cardioDistance ?? 0);
    const newIntensity = inferIntensity(val, te.cardioDistance ?? 0);
    if (!paceManuallyEdited.current && newPace) updates.cardioPace = newPace;
    if (!intensityManuallyEdited.current && newIntensity) updates.cardioIntensity = newIntensity;
    onUpdate(idx, updates);
  };

  const handleDistanceChange = (val: number) => {
    const updates: Partial<WorkoutTemplateExercise> = { cardioDistance: val };
    const newPace = computePace(te.cardioDuration ?? 0, val);
    const newIntensity = inferIntensity(te.cardioDuration ?? 0, val);
    if (!paceManuallyEdited.current && newPace) updates.cardioPace = newPace;
    if (!intensityManuallyEdited.current && newIntensity) updates.cardioIntensity = newIntensity;
    onUpdate(idx, updates);
  };

  return (
    <>
      <div className="px-3 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-600">Duration (min)</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*"
              value={te.cardioDuration || ''} onFocus={(e) => e.target.select()}
              onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); handleDurationChange(raw === '' ? 0 : Number(raw)); }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-center text-xs text-zinc-100 outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-600">Distance (km)</label>
            <DecimalInput
              value={te.cardioDistance ?? null}
              onFocus={(e) => e.target.select()}
              onChange={(n) => handleDistanceChange(n ?? 0)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-center text-xs text-zinc-100 outline-none" />
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-600">
              Pace{autoPace && !paceManuallyEdited.current && <span className="text-zinc-700 ml-1">auto</span>}
            </label>
            <input type="text" placeholder="e.g. 5:30/km" value={displayPace}
              onFocus={(e) => e.target.select()}
              onChange={(e) => { paceManuallyEdited.current = true; onUpdate(idx, { cardioPace: e.target.value || undefined }); }}
              onBlur={() => { if (!te.cardioPace && autoPace) paceManuallyEdited.current = false; }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-center text-xs text-zinc-300 placeholder-zinc-600 outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-600">
              Intensity{autoIntensity && !intensityManuallyEdited.current && <span className="text-zinc-700 ml-1">auto</span>}
            </label>
            <select value={displayIntensity}
              onChange={(e) => { intensityManuallyEdited.current = true; onUpdate(idx, { cardioIntensity: (e.target.value || undefined) as WorkoutTemplateExercise['cardioIntensity'] }); }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-center text-xs text-zinc-100 outline-none">
              <option value="">—</option>
              {Object.entries(INTENSITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <textarea placeholder="Notes (optional)" value={te.notes ?? ''}
          onChange={(e) => onUpdate(idx, { notes: e.target.value || undefined })} rows={1}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
          onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none" />
      </div>
    </>
  );
}

// ─── Main component ─────────────────────────────────────

export function Programs() {
  const templates = useTemplates();
  const exercises = useExercises();

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Exercise picker state
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all');
  const [exerciseOrder, setExerciseOrder] = useState<string[]>(loadExerciseOrder);
  const [reorderMode, setReorderMode] = useState(false);

  // Custom exercise creator state
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExPrimary, setNewExPrimary] = useState<MuscleGroup>('chest');
  const [newExCategory, setNewExCategory] = useState<WorkoutCategory>('custom');
  const [newExType, setNewExType] = useState<ExerciseType>('compound');
  const [newExMediaUrl, setNewExMediaUrl] = useState('');
  const [newExMediaType, setNewExMediaType] = useState<'image' | 'gif' | 'video' | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete template confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Media viewer state
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: 'image' | 'gif' | 'video'; name: string } | null>(null);

  // Exercise editor state
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editExName, setEditExName] = useState('');
  const [editExPrimary, setEditExPrimary] = useState<MuscleGroup>('chest');
  const [editExSecondary, setEditExSecondary] = useState<MuscleGroup[]>([]);

  // Media upload for existing exercises
  const exerciseMediaInputRef = useRef<HTMLInputElement>(null);
  const [mediaUploadTargetId, setMediaUploadTargetId] = useState<string | null>(null);

  // ─── Program groups state ─────────────────────────
  const [groupLayout, setGroupLayout] = useState<GroupLayout>(loadGroupLayout);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('');
  const [showNewGroupEmojiPicker, setShowNewGroupEmojiPicker] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupEmoji, setEditGroupEmoji] = useState('');
  const [showEditGroupEmojiPicker, setShowEditGroupEmojiPicker] = useState(false);

  const persistGroupLayout = useCallback((layout: GroupLayout) => {
    setGroupLayout(layout);
    saveGroupLayout(layout);
  }, []);

  const hasGroups = groupLayout.groups.length > 0;

  // ─── Grouped templates computation ─────────────────
  const groupedTemplates = useMemo(() => {
    const groups = groupLayout.groups;
    const assignments = groupLayout.assignments;
    const sections: { groupId: string; name: string; templates: WorkoutTemplate[] }[] = [];

    for (const g of groups) {
      sections.push({ groupId: g.id, name: g.name, templates: templates.filter((t) => assignments[t.id] === g.id) });
    }

    const assignedIds = new Set(Object.keys(assignments).filter((k) => assignments[k]));
    sections.push({ groupId: UNCATEGORIZED_ID, name: 'Programs', templates: templates.filter((t) => !assignedIds.has(t.id)) });

    return sections;
  }, [templates, groupLayout]);

  // ─── Flat list for integrated rendering ────────────
  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];
    for (const section of groupedTemplates) {
      if (hasGroups) {
        const group = groupLayout.groups.find((g) => g.id === section.groupId);
        items.push({ kind: 'header', groupId: section.groupId, name: section.name, emoji: group?.emoji, isUncategorized: section.groupId === UNCATEGORIZED_ID });
      }
      for (const t of section.templates) {
        items.push({ kind: 'card', template: t, groupId: section.groupId });
      }
    }
    return items;
  }, [groupedTemplates, hasGroups]);

  const flatItemsRef = useRef(flatItems);
  flatItemsRef.current = flatItems;

  // ─── Flat-list drag state (templates) ──────────────
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const dragStartFlatIdx = useRef(0);
  const dragItemH = useRef(88);
  const dragOffsetRef = useRef(0);
  const dragItemHeights = useRef<number[]>([]);
  const justDragged = useRef(false);
  const flatItemElRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ─── Group header drag state ───────────────────────
  const [gDragId, setGDragId] = useState<string | null>(null);
  const [gDragOffset, setGDragOffset] = useState(0);
  const gDragStartY = useRef(0);
  const gDragStartIdx = useRef(0);
  const gDragOffsetRef = useRef(0);
  const gDragHeights = useRef<number[]>([]);

  // ─── Flat drag: compute target index ───────────────
  const dragTargetFlatIdx = useMemo(() => {
    if (!dragId) return -1;
    const startIdx = dragStartFlatIdx.current;
    const offset = dragOffset;
    const heights = dragItemHeights.current;

    let target = startIdx;
    if (offset > 0) {
      let cum = 0;
      for (let i = startIdx + 1; i < heights.length; i++) {
        const half = heights[i] / 2;
        if (offset < cum + half) break;
        cum += heights[i];
        target = i;
      }
    } else if (offset < 0) {
      let cum = 0;
      for (let i = startIdx - 1; i >= 0; i--) {
        const half = heights[i] / 2;
        if (offset > cum - half) break;
        cum -= heights[i];
        target = i;
      }
    }
    // Clamp: if groups exist, don't go above the first header
    if (hasGroups && target === 0) target = 1;
    return target;
  }, [dragId, dragOffset, hasGroups]);

  // ─── Flat drag: visual style per item ──────────────
  const getFlatItemStyle = useCallback(
    (flatIdx: number): React.CSSProperties => {
      if (!dragId) return {};
      const startIdx = dragStartFlatIdx.current;
      const targetIdx = dragTargetFlatIdx;
      const h = dragItemH.current;

      if (flatIdx === startIdx) {
        return { transform: `translateY(${dragOffset}px) scale(1.03)`, zIndex: 50, position: 'relative', willChange: 'transform' };
      }

      let shift = 0;
      if (startIdx < targetIdx && flatIdx > startIdx && flatIdx <= targetIdx) shift = -h;
      else if (startIdx > targetIdx && flatIdx >= targetIdx && flatIdx < startIdx) shift = h;

      return {
        transform: shift ? `translateY(${shift}px)` : undefined,
        transition: 'transform 200ms cubic-bezier(.25,.1,.25,1)',
        position: 'relative',
        zIndex: 0,
      };
    },
    [dragId, dragOffset, dragTargetFlatIdx],
  );

  // ─── Flat drag: start handler ──────────────────────
  const handleFlatDragStart = useCallback(
    (e: React.PointerEvent, templateId: string, flatIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      // Measure all item heights
      const heights = flatItemsRef.current.map((_, i) => {
        const el = flatItemElRefs.current[i];
        return el ? el.getBoundingClientRect().height + 12 : 88;
      });
      dragItemHeights.current = heights;
      const el = flatItemElRefs.current[flatIdx];
      dragItemH.current = el ? el.getBoundingClientRect().height + 12 : 88;
      dragStartY.current = e.clientY;
      dragStartFlatIdx.current = flatIdx;
      dragOffsetRef.current = 0;
      setDragId(templateId);
      setDragOffset(0);
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    },
    [],
  );

  // ─── Flat drag: move + end effect ──────────────────
  useEffect(() => {
    if (!dragId) return;
    let autoScrollRaf = 0;

    const autoScroll = (clientY: number) => {
      cancelAnimationFrame(autoScrollRaf);
      const margin = 60, maxSpeed = 12;
      let speed = 0;
      if (clientY < margin) speed = -maxSpeed * (1 - clientY / margin);
      else if (clientY > window.innerHeight - margin) speed = maxSpeed * (1 - (window.innerHeight - clientY) / margin);
      if (speed !== 0) {
        window.scrollBy({ top: speed });
        dragStartY.current -= speed;
        autoScrollRaf = requestAnimationFrame(() => autoScroll(clientY));
      }
    };

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const offset = e.clientY - dragStartY.current;
      dragOffsetRef.current = offset;
      setDragOffset(offset);
      autoScroll(e.clientY);
    };

    const onEnd = () => {
      cancelAnimationFrame(autoScrollRaf);
      const items = flatItemsRef.current;
      const startIdx = dragStartFlatIdx.current;
      const heights = dragItemHeights.current;
      const offset = dragOffsetRef.current;

      // Compute target (same logic as memo)
      let target = startIdx;
      if (offset > 0) {
        let cum = 0;
        for (let i = startIdx + 1; i < heights.length; i++) {
          if (offset < cum + heights[i] / 2) break;
          cum += heights[i];
          target = i;
        }
      } else if (offset < 0) {
        let cum = 0;
        for (let i = startIdx - 1; i >= 0; i--) {
          if (offset > cum - heights[i] / 2) break;
          cum -= heights[i];
          target = i;
        }
      }
      if (hasGroups && target === 0) target = 1;

      if (target !== startIdx) {
        // Build new flat list with the item moved
        const newFlat = [...items];
        const [moved] = newFlat.splice(startIdx, 1);
        newFlat.splice(target > startIdx ? target : target, 0, moved);

        // Derive group assignments + template order from new flat list
        let currentGroup = UNCATEGORIZED_ID;
        const newAssignments: Record<string, string> = {};
        const newOrder: string[] = [];

        for (const item of newFlat) {
          if (item.kind === 'header') {
            currentGroup = item.groupId;
          } else {
            newOrder.push(item.template.id);
            if (currentGroup !== UNCATEGORIZED_ID) {
              newAssignments[item.template.id] = currentGroup;
            }
          }
        }

        saveTemplateOrder(newOrder);
        persistGroupLayout({ ...groupLayout, assignments: newAssignments });
      }

      setDragId(null);
      setDragOffset(0);
      dragOffsetRef.current = 0;
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

      justDragged.current = true;
      requestAnimationFrame(() => { requestAnimationFrame(() => { justDragged.current = false; }); });
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    return () => {
      cancelAnimationFrame(autoScrollRaf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
    };
  }, [dragId, hasGroups, groupLayout, persistGroupLayout]);

  // ─── Group drag: target computation ────────────────
  const gDragTargetIdx = useMemo(() => {
    if (!gDragId) return -1;
    const startIdx = gDragStartIdx.current;
    const offset = gDragOffset;
    const heights = gDragHeights.current;
    let target = startIdx;
    if (offset > 0) {
      let cum = 0;
      for (let i = startIdx + 1; i < heights.length; i++) {
        if (offset < cum + heights[i] / 2) break;
        cum += heights[i];
        target = i;
      }
    } else if (offset < 0) {
      let cum = 0;
      for (let i = startIdx - 1; i >= 0; i--) {
        if (offset > cum - heights[i] / 2) break;
        cum -= heights[i];
        target = i;
      }
    }
    return target;
  }, [gDragId, gDragOffset]);

  // ─── Group drag: start handler ─────────────────────
  const handleGroupDragStart = useCallback(
    (e: React.PointerEvent, groupId: string, groupIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      // Measure section heights for each group (header + all cards in it)
      const items = flatItemsRef.current;
      const sectionHeights: number[] = [];
      let currentGroupIdx = -1;
      let currentHeight = 0;

      for (let i = 0; i < items.length; i++) {
        const el = flatItemElRefs.current[i];
        const h = el ? el.getBoundingClientRect().height + 12 : 50;
        if (items[i].kind === 'header') {
          if (currentGroupIdx >= 0) sectionHeights[currentGroupIdx] = currentHeight;
          const gIdx = groupLayout.groups.findIndex((g) => g.id === items[i].groupId);
          if (gIdx >= 0) { currentGroupIdx = gIdx; currentHeight = h; }
          else { currentGroupIdx = -1; currentHeight = 0; }
        } else {
          currentHeight += h;
        }
      }
      if (currentGroupIdx >= 0) sectionHeights[currentGroupIdx] = currentHeight;

      gDragHeights.current = sectionHeights;
      gDragStartY.current = e.clientY;
      gDragStartIdx.current = groupIdx;
      gDragOffsetRef.current = 0;
      setGDragId(groupId);
      setGDragOffset(0);
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    },
    [groupLayout.groups],
  );

  // ─── Group drag: move + end effect ─────────────────
  useEffect(() => {
    if (!gDragId) return;

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      gDragOffsetRef.current = e.clientY - gDragStartY.current;
      setGDragOffset(gDragOffsetRef.current);
    };

    const onEnd = () => {
      const startIdx = gDragStartIdx.current;
      const heights = gDragHeights.current;
      const offset = gDragOffsetRef.current;

      let target = startIdx;
      if (offset > 0) {
        let cum = 0;
        for (let i = startIdx + 1; i < heights.length; i++) {
          if (offset < cum + (heights[i] || 50) / 2) break;
          cum += heights[i] || 50;
          target = i;
        }
      } else if (offset < 0) {
        let cum = 0;
        for (let i = startIdx - 1; i >= 0; i--) {
          if (offset > cum - (heights[i] || 50) / 2) break;
          cum -= heights[i] || 50;
          target = i;
        }
      }

      if (target !== startIdx) {
        const newGroups = [...groupLayout.groups];
        const [item] = newGroups.splice(startIdx, 1);
        newGroups.splice(target, 0, item);
        persistGroupLayout({ ...groupLayout, groups: newGroups });
      }

      setGDragId(null);
      setGDragOffset(0);
      gDragOffsetRef.current = 0;
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
    };
  }, [gDragId, groupLayout, persistGroupLayout]);

  // ─── Group header visual style during drag ─────────
  const getGroupHeaderDragStyle = useCallback(
    (groupId: string): React.CSSProperties => {
      if (!gDragId) return {};
      if (groupId === gDragId) {
        return { transform: `translateY(${gDragOffset}px)`, zIndex: 50, position: 'relative', willChange: 'transform' };
      }
      const gIdx = groupLayout.groups.findIndex((g) => g.id === groupId);
      const startIdx = gDragStartIdx.current;
      const targetIdx = gDragTargetIdx;
      if (gIdx < 0) return {};

      const heights = gDragHeights.current;
      const h = heights[startIdx] || 50;
      let shift = 0;
      if (startIdx < targetIdx && gIdx > startIdx && gIdx <= targetIdx) shift = -h;
      else if (startIdx > targetIdx && gIdx >= targetIdx && gIdx < startIdx) shift = h;

      return {
        transform: shift ? `translateY(${shift}px)` : undefined,
        transition: 'transform 200ms cubic-bezier(.25,.1,.25,1)',
        position: 'relative',
        zIndex: 0,
      };
    },
    [gDragId, gDragOffset, gDragTargetIdx, groupLayout.groups],
  );

  // Exercise map for lookups
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  // Sorted exercises for picker
  const sortedExercises = useMemo(() => {
    const order = exerciseOrder;
    const orderMap = new Map(order.map((id, idx) => [id, idx]));
    return [...exercises].sort((a, b) => {
      const oa = orderMap.get(a.id) ?? 99999;
      const ob = orderMap.get(b.id) ?? 99999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, exerciseOrder]);

  // Filtered exercises for picker
  const filteredExercises = useMemo(() => {
    let list = sortedExercises;
    if (muscleFilter !== 'all') list = list.filter((e) => e.primaryMuscle === muscleFilter);
    if (exerciseSearch.trim()) {
      const q = exerciseSearch.trim().toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [sortedExercises, muscleFilter, exerciseSearch]);

  // ─── Template handlers ──────────────────────────────

  const handleNewTemplate = () => {
    setEditingTemplate({ id: crypto.randomUUID(), name: '', category: 'custom', exercises: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setShowEditor(true);
  };

  const handleEditTemplate = (template: WorkoutTemplate) => { setEditingTemplate({ ...template }); setShowEditor(true); };

  const handleSave = async () => {
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    await saveTemplate({ ...editingTemplate, updatedAt: new Date().toISOString() });
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handleDelete = async () => {
    if (!editingTemplate) return;
    await trashTemplate(editingTemplate);
    // trashTemplate already cleans up group assignments
    setGroupLayout(loadGroupLayout());
    setShowEditor(false);
    setEditingTemplate(null);
    setShowDeleteConfirm(false);
  };

  const handleToggleDay = (day: string) => {
    if (!editingTemplate) return;
    const current = editingTemplate.day ?? [];
    const isSelected = current.includes(day);
    const updated = isSelected ? current.filter((d) => d !== day) : [...current, day];
    setEditingTemplate({ ...editingTemplate, day: updated.length > 0 ? updated : undefined });
  };

  // ─── Exercise in template handlers ──────────────────

  const handleSelectExercise = (exerciseId: string) => {
    if (!editingTemplate) return;
    const ex = exerciseMap.get(exerciseId);
    const isCardio = ex?.exerciseType === 'cardio';
    const newExercise: WorkoutTemplateExercise = {
      id: crypto.randomUUID(), exerciseId, order: editingTemplate.exercises.length + 1,
      targetSets: isCardio ? 1 : 3, targetRepsMin: isCardio ? 0 : 8, targetRepsMax: isCardio ? 0 : 12,
      restSeconds: isCardio ? 0 : 90, ...(isCardio ? { cardioDuration: 30 } : {}),
    };
    setEditingTemplate({ ...editingTemplate, exercises: [...editingTemplate.exercises, newExercise] });
    setShowExercisePicker(false);
    setExerciseSearch('');
    setMuscleFilter('all');
  };

  const handleUpdateExercise = (index: number, updates: Partial<WorkoutTemplateExercise>) => {
    if (!editingTemplate) return;
    const newExercises = [...editingTemplate.exercises];
    newExercises[index] = { ...newExercises[index], ...updates };
    setEditingTemplate({ ...editingTemplate, exercises: newExercises });
  };

  const handleRemoveExercise = (index: number) => {
    if (!editingTemplate) return;
    const newExercises = editingTemplate.exercises.filter((_, i) => i !== index);
    newExercises.forEach((e, i) => (e.order = i + 1));
    setEditingTemplate({ ...editingTemplate, exercises: newExercises });
  };

  const handleReorderExercises = (newOrder: string[]) => {
    if (!editingTemplate) return;
    const exerciseById = new Map(editingTemplate.exercises.map((e) => [e.id, e]));
    const reordered = newOrder.map((id) => exerciseById.get(id)!).filter(Boolean);
    reordered.forEach((e, i) => (e.order = i + 1));
    setEditingTemplate({ ...editingTemplate, exercises: reordered });
  };

  // ─── Custom exercise handlers ───────────────────────

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MEDIA_SIZE) { alert('File too large. Maximum size is 10 MB.'); return; }
    setNewExMediaUrl(await fileToBase64(file));
    setNewExMediaType(detectMediaType(file));
  };

  const handleCreateExercise = async () => {
    if (!newExName.trim()) return;
    const id = await addCustomExercise({
      name: newExName.trim(), primaryMuscle: newExPrimary, category: newExCategory,
      exerciseType: newExType, isCustom: true,
      ...(newExMediaUrl && newExMediaType ? { mediaUrl: newExMediaUrl, mediaType: newExMediaType } : {}),
    });
    handleSelectExercise(id);
    setShowCreateExercise(false); setNewExName(''); setNewExMediaUrl(''); setNewExMediaType('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExerciseLibraryReorder = (newOrder: string[]) => { setExerciseOrder(newOrder); saveExerciseOrder(newOrder); };

  // ─── Media / exercise editor ──────────────────────

  const openMediaViewer = (exercise: Exercise) => {
    if (exercise.mediaUrl && exercise.mediaType) setViewingMedia({ url: exercise.mediaUrl, type: exercise.mediaType, name: exercise.name });
  };

  const openExerciseEditor = (exercise: Exercise) => {
    setEditingExercise(exercise); setEditExName(exercise.name); setEditExPrimary(exercise.primaryMuscle);
    setEditExSecondary(exercise.secondaryMuscles ?? (exercise.secondaryMuscle ? [exercise.secondaryMuscle] : []));
  };

  const handleSaveExercise = async () => {
    if (!editingExercise || !editExName.trim()) return;
    await updateExercise(editingExercise.id, { name: editExName.trim(), primaryMuscle: editExPrimary, secondaryMuscles: editExSecondary });
    setEditingExercise(null);
  };

  const handleThumbnailClick = (exercise: Exercise) => {
    if (exercise.mediaUrl && exercise.mediaType) openMediaViewer(exercise);
    else { setMediaUploadTargetId(exercise.id); exerciseMediaInputRef.current?.click(); }
  };

  const handleExerciseMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mediaUploadTargetId) return;
    if (file.size > MAX_MEDIA_SIZE) { alert('File too large. Maximum size is 10 MB.'); return; }
    await updateExercise(mediaUploadTargetId, { mediaUrl: await fileToBase64(file), mediaType: detectMediaType(file) });
    setMediaUploadTargetId(null);
    if (exerciseMediaInputRef.current) exerciseMediaInputRef.current.value = '';
  };

  // ─── Group handlers ───────────────────────────────

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    persistGroupLayout({ ...groupLayout, groups: [...groupLayout.groups, { id: crypto.randomUUID(), name: newGroupName.trim(), ...(newGroupEmoji ? { emoji: newGroupEmoji } : {}) }] });
    setNewGroupName(''); setNewGroupEmoji(''); setShowCreateGroup(false); setShowNewGroupEmojiPicker(false);
  };

  const handleRenameGroup = (groupId: string) => {
    if (!editGroupName.trim()) return;
    persistGroupLayout({ ...groupLayout, groups: groupLayout.groups.map((g) => g.id === groupId ? { ...g, name: editGroupName.trim(), emoji: editGroupEmoji || undefined } : g) });
    setEditingGroupId(null); setEditGroupName(''); setEditGroupEmoji(''); setShowEditGroupEmojiPicker(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groupLayout.groups.find((g) => g.id === groupId);
    if (!group) return;
    const assignedTemplateIds = Object.entries(groupLayout.assignments)
      .filter(([, gid]) => gid === groupId)
      .map(([tid]) => tid);
    await trashProgramGroup(group, assignedTemplateIds);
    // trashProgramGroup updates localStorage, so re-read it
    setGroupLayout(loadGroupLayout());
  };

  const handleMoveTemplate = (templateId: string, targetGroupId: string) => {
    const newAssignments = { ...groupLayout.assignments };
    if (targetGroupId === UNCATEGORIZED_ID) delete newAssignments[templateId];
    else newAssignments[templateId] = targetGroupId;
    persistGroupLayout({ ...groupLayout, assignments: newAssignments });
  };

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-50">Programs</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateGroup(true)}
            className="flex items-center gap-1 rounded-lg bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-400 active:text-zinc-200 transition-colors">
            <FolderPlus className="h-3.5 w-3.5" />Group
          </button>
          <Button size="sm" onClick={handleNewTemplate}><Plus className="h-4 w-4" />New</Button>
        </div>
      </div>

      {/* Create group inline form */}
      <AnimatePresence>
        {showCreateGroup && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNewGroupEmojiPicker(!showNewGroupEmojiPicker)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/80 text-lg hover:bg-zinc-700/80 active:bg-zinc-700/80 transition-colors flex-shrink-0">
                  {newGroupEmoji || '📁'}
                </button>
                <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name..." autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                <Button size="sm" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Create</Button>
                <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setNewGroupEmoji(''); setShowNewGroupEmojiPicker(false); }} className="p-2 text-zinc-500 active:text-zinc-300"><X className="h-4 w-4" /></button>
              </div>
              <AnimatePresence>
                {showNewGroupEmojiPicker && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="grid grid-cols-8 gap-1.5 rounded-xl bg-zinc-800/30 p-3 max-h-64 overflow-y-auto">
                      {newGroupEmoji && (
                        <button onClick={() => { setNewGroupEmoji(''); setShowNewGroupEmojiPicker(false); }}
                          className="flex h-9 w-full items-center justify-center rounded-lg text-xs text-zinc-500 hover:bg-zinc-700/50 active:bg-zinc-700/50">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {GROUP_EMOJIS.map((emoji, i) => (
                        <button key={`${emoji}-${i}`}
                          onClick={() => { setNewGroupEmoji(emoji); setShowNewGroupEmojiPicker(false); }}
                          className={`flex h-9 w-full items-center justify-center rounded-lg text-lg transition-all ${newGroupEmoji === emoji ? 'bg-white/10 scale-110' : 'hover:bg-zinc-700/50 active:bg-zinc-700/50'}`}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Flat integrated list ──────────────────── */}
      {flatItems.length > 0 ? (
        <div className="space-y-3">
          {flatItems.map((item, flatIdx) => {
            if (item.kind === 'header') {
              const gIdx = groupLayout.groups.findIndex((g) => g.id === item.groupId);
              // Combine flat drag style + group drag style
              const flatStyle = getFlatItemStyle(flatIdx);
              const groupStyle = !item.isUncategorized ? getGroupHeaderDragStyle(item.groupId) : {};
              // For group drag, apply section-level style to ALL items in this section
              const isSectionBeingDragged = gDragId && !item.isUncategorized;

              return (
                <div
                  key={`h-${item.groupId}`}
                  ref={(el) => { flatItemElRefs.current[flatIdx] = el; }}
                  style={{ ...flatStyle, ...(isSectionBeingDragged ? groupStyle : {}) }}
                >
                  <div className="pt-3 pb-1">
                    <div className="flex items-center gap-2">
                      {!item.isUncategorized && (
                        <div
                          onPointerDown={(e) => handleGroupDragStart(e, item.groupId, gIdx)}
                          className="flex items-center justify-center w-6 cursor-grab active:cursor-grabbing touch-none select-none"
                        >
                          <GripVertical className="h-4 w-4 text-zinc-700" />
                        </div>
                      )}
                      {editingGroupId === item.groupId ? (
                        <>
                          <button onClick={() => setShowEditGroupEmojiPicker(!showEditGroupEmojiPicker)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 text-base hover:bg-zinc-700/80 active:bg-zinc-700/80 transition-colors flex-shrink-0">
                            {editGroupEmoji || '📁'}
                          </button>
                          <input type="text" value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameGroup(item.groupId); if (e.key === 'Escape') { setEditingGroupId(null); setEditGroupName(''); setEditGroupEmoji(''); setShowEditGroupEmojiPicker(false); } }}
                            autoFocus
                            className="flex-1 bg-transparent text-base font-bold text-zinc-300 outline-none" />
                          <button onClick={() => handleRenameGroup(item.groupId)}
                            className="px-2 py-1 text-xs font-medium text-zinc-400 active:text-zinc-200">Done</button>
                        </>
                      ) : (
                        <>
                          {item.emoji && <span className="text-base flex-shrink-0">{item.emoji}</span>}
                          <h2 className="flex-1 text-base font-bold text-zinc-400 truncate">
                            {item.name}
                          </h2>
                        </>
                      )}
                      {!item.isUncategorized && editingGroupId !== item.groupId && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { const g = groupLayout.groups.find((g) => g.id === item.groupId); setEditingGroupId(item.groupId); setEditGroupName(item.name); setEditGroupEmoji(g?.emoji ?? ''); }}
                            className="p-1 text-zinc-700 active:text-zinc-400 transition-colors"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => handleDeleteGroup(item.groupId)}
                            className="p-1 text-zinc-700 active:text-negative transition-colors"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                    <AnimatePresence>
                      {editingGroupId === item.groupId && showEditGroupEmojiPicker && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="grid grid-cols-8 gap-1.5 rounded-xl bg-zinc-800/30 p-3 mt-2 max-h-64 overflow-y-auto">
                            {editGroupEmoji && (
                              <button onClick={() => { setEditGroupEmoji(''); setShowEditGroupEmojiPicker(false); }}
                                className="flex h-9 w-full items-center justify-center rounded-lg text-xs text-zinc-500 hover:bg-zinc-700/50 active:bg-zinc-700/50">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {GROUP_EMOJIS.map((emoji, i) => (
                              <button key={`edit-${emoji}-${i}`}
                                onClick={() => { setEditGroupEmoji(emoji); setShowEditGroupEmojiPicker(false); }}
                                className={`flex h-9 w-full items-center justify-center rounded-lg text-lg transition-all ${editGroupEmoji === emoji ? 'bg-white/10 scale-110' : 'hover:bg-zinc-700/50 active:bg-zinc-700/50'}`}>
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            }

            // Template card
            const template = item.template;
            const isDragging = dragId === template.id;
            return (
              <div
                key={`c-${template.id}`}
                ref={(el) => { flatItemElRefs.current[flatIdx] = el; }}
                style={{
                  ...getFlatItemStyle(flatIdx),
                  // If this card's group section is being dragged, apply the group style
                  ...(gDragId && groupLayout.groups.some((g) => g.id === item.groupId && g.id === gDragId)
                    ? getGroupHeaderDragStyle(item.groupId) : {}),
                }}
              >
                <Card
                  onClick={() => { if (justDragged.current || dragId) return; handleEditTemplate(template); }}
                  className={`flex items-center gap-3 transition-shadow duration-200 ${isDragging ? 'shadow-2xl shadow-black/60 ring-1 ring-zinc-700/50' : ''}`}
                >
                  <div onPointerDown={(e) => handleFlatDragStart(e, template.id, flatIdx)}
                    className="flex items-center justify-center w-8 -ml-1 self-stretch cursor-grab active:cursor-grabbing touch-none select-none">
                    <GripVertical className="h-5 w-5 text-zinc-600" />
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/80 text-xl flex-shrink-0">
                    {template.emoji ?? categoryIcons[template.category] ?? '\u{1F3CB}\u{FE0F}'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-100 truncate">{template.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <Badge>{CATEGORY_LABELS[template.category]}</Badge>
                      {template.day && template.day.length > 0 && template.day.map((d) => (
                        <span key={d} className="text-[10px] rounded-full bg-zinc-800 px-1.5 py-0.5 text-zinc-400 font-medium">{d.slice(0, 3)}</span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600 flex-shrink-0" />
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-sm text-zinc-600">No programs yet</p>
          <p className="mt-1 text-xs text-zinc-700">Tap + New to create your first workout template</p>
        </div>
      )}

      {/* ─── Template editor sheet ───────────────────── */}
      <Sheet open={showEditor} onClose={() => { setShowEditor(false); setEditingTemplate(null); setShowEmojiPicker(false); }}
        title={editingTemplate?.name ? 'Edit Template' : 'New Template'}>
        {editingTemplate && (
          <div className="space-y-4">
            {/* Emoji + Name */}
            <div className="flex items-start gap-3">
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800/80 text-2xl hover:bg-zinc-700/80 active:bg-zinc-700/80 transition-colors">
                {editingTemplate.emoji ?? categoryIcons[editingTemplate.category] ?? '\u{1F3CB}\u{FE0F}'}
              </button>
              <div className="flex-1">
                <label className="text-xs font-medium text-zinc-500">Template Name</label>
                <input type="text" value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder="e.g. Upper Body — Chest Focus"
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600" />
              </div>
            </div>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-8 gap-1.5 rounded-xl bg-zinc-800/30 p-3 max-h-56 overflow-y-auto">
                    {WORKOUT_EMOJIS.map((emoji, i) => (
                      <button key={`${emoji}-${i}`}
                        onClick={() => { setEditingTemplate({ ...editingTemplate, emoji }); setShowEmojiPicker(false); }}
                        className={`flex h-10 w-full items-center justify-center rounded-lg text-xl transition-all ${editingTemplate.emoji === emoji ? 'bg-white/10 scale-110' : 'hover:bg-zinc-700/50 active:bg-zinc-700/50'}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-zinc-500">Category</label>
              <select value={editingTemplate.category}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as WorkoutCategory })}
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-sm text-zinc-100 outline-none">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>

            {/* Days */}
            <div>
              <label className="text-xs font-medium text-zinc-500">Days</label>
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                {ALL_DAYS.map((d) => {
                  const sel = editingTemplate.day?.includes(d) ?? false;
                  return (
                    <button key={d} type="button" onClick={() => handleToggleDay(d)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${sel ? 'bg-white text-zinc-900' : 'bg-zinc-800/50 text-zinc-500 active:text-zinc-300'}`}>
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group */}
            {hasGroups && (
              <div>
                <label className="text-xs font-medium text-zinc-500">Group</label>
                <select value={groupLayout.assignments[editingTemplate.id] ?? UNCATEGORIZED_ID}
                  onChange={(e) => handleMoveTemplate(editingTemplate.id, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-sm text-zinc-100 outline-none">
                  <option value={UNCATEGORIZED_ID}>Programs</option>
                  {groupLayout.groups.map((g) => <option key={g.id} value={g.id}>{g.emoji ? `${g.emoji} ` : ''}{g.name}</option>)}
                </select>
              </div>
            )}

            {/* Exercises */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-500">Exercises ({editingTemplate.exercises.length})</label>
                <button onClick={() => { setShowExercisePicker(true); setExerciseSearch(''); setMuscleFilter('all'); setShowCreateExercise(false); }}
                  className="text-xs font-medium text-zinc-400 active:text-zinc-200">+ Add Exercise</button>
              </div>

              {editingTemplate.exercises.length > 0 ? (
                <Reorder.Group axis="y" values={editingTemplate.exercises.map((e) => e.id)} onReorder={handleReorderExercises} className="space-y-2">
                  {editingTemplate.exercises.map((te, idx) => {
                    const ex = exerciseMap.get(te.exerciseId);
                    return (
                      <Reorder.Item key={te.id} value={te.id} className="list-none rounded-xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                          <GripVertical className="h-4 w-4 text-zinc-600 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" />
                          {ex && <MediaThumbnail exercise={ex} onClick={() => handleThumbnailClick(ex)} />}
                          <div className="flex-1 min-w-0">
                            <button type="button" onClick={() => ex && openExerciseEditor(ex)} className="group flex items-center gap-1 text-left">
                              <p className="text-sm font-medium text-zinc-200 truncate">{ex?.name ?? 'Unknown'}</p>
                              <Pencil className="h-2.5 w-2.5 text-zinc-600 opacity-0 group-active:opacity-100" />
                            </button>
                            {ex && <MuscleChips exercise={ex} />}
                          </div>
                          <button onClick={() => handleRemoveExercise(idx)} className="rounded p-1.5 text-zinc-600 hover:text-negative active:text-negative transition-colors flex-shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {ex?.exerciseType === 'cardio' ? (
                          <CardioFields te={te} idx={idx} onUpdate={handleUpdateExercise} />
                        ) : (
                          <>
                            <div className="px-3 pb-2">
                              <input type="text" placeholder="Warm-up (e.g. bar x 15, 40 x 10, 60 x 5)" value={te.warmup ?? ''}
                                onChange={(e) => handleUpdateExercise(idx, { warmup: e.target.value || undefined })}
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none" />
                            </div>
                            <div className="px-3 pb-2">
                              <div className="grid grid-cols-4 gap-2">
                                {([['Sets', 'targetSets', te.targetSets], ['Min', 'targetRepsMin', te.targetRepsMin], ['Max', 'targetRepsMax', te.targetRepsMax]] as const).map(([label, key, val]) => (
                                  <div key={key}>
                                    <label className="text-[10px] text-zinc-600">{label}</label>
                                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={val || ''} onFocus={(e) => e.target.select()}
                                      onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); handleUpdateExercise(idx, { [key]: raw === '' ? 0 : Number(raw) }); }}
                                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-center text-xs text-zinc-100 outline-none" />
                                  </div>
                                ))}
                                <div>
                                  <label className="text-[10px] text-zinc-600">Rest (min)</label>
                                  <input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*"
                                    value={te.restSeconds ? (te.restSeconds / 60).toString().replace(/\.?0+$/, '') : ''}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => { const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'); const mins = raw === '' ? 0 : parseFloat(raw); handleUpdateExercise(idx, { restSeconds: Math.round((isNaN(mins) ? 0 : mins) * 60) }); }}
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-center text-xs text-zinc-100 outline-none" />
                                </div>
                              </div>
                            </div>
                            <div className="px-3 pb-3">
                              <textarea placeholder="Notes (optional)" value={te.notes ?? ''}
                                onChange={(e) => handleUpdateExercise(idx, { notes: e.target.value || undefined })} rows={1}
                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                                className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none" />
                            </div>
                          </>
                        )}
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-800 py-8 text-center">
                  <p className="text-xs text-zinc-600">No exercises added yet</p>
                  <button onClick={() => { setShowExercisePicker(true); setExerciseSearch(''); setMuscleFilter('all'); setShowCreateExercise(false); }}
                    className="mt-2 text-xs font-medium text-zinc-400 active:text-zinc-200">+ Add your first exercise</button>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="primary" fullWidth onClick={handleSave} disabled={!editingTemplate.name.trim()}>Save Template</Button>
              {templates.find((t) => t.id === editingTemplate.id) && (
                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* ─── Exercise picker sheet ───────────────────── */}
      <Sheet open={showExercisePicker} onClose={() => { setShowExercisePicker(false); setExerciseSearch(''); setMuscleFilter('all'); setShowCreateExercise(false); setReorderMode(false); }}
        title={reorderMode ? 'Reorder Exercises' : 'Add Exercise'}>
        <div className="space-y-3">
          {reorderMode ? (
            <>
              <p className="text-xs text-zinc-500">Drag exercises to reorder. Your favorites will appear first.</p>
              <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
                <Reorder.Group axis="y" values={sortedExercises.map((e) => e.id)} onReorder={handleExerciseLibraryReorder} className="space-y-1">
                  {sortedExercises.map((ex) => (
                    <Reorder.Item key={ex.id} value={ex.id} className="list-none flex items-center gap-2 rounded-xl bg-zinc-900/30 px-3 py-2.5">
                      <GripVertical className="h-4 w-4 text-zinc-600 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none" />
                      <MediaThumbnail exercise={ex} />
                      <p className="text-sm font-medium text-zinc-200 truncate flex-1">{ex.name}</p>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
              <Button variant="primary" fullWidth onClick={() => setReorderMode(false)}>Done</Button>
            </>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input type="text" value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Search exercises..." autoFocus
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                {exerciseSearch && <button onClick={() => setExerciseSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"><X className="h-4 w-4" /></button>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 -ml-1 pl-1">
                  {MUSCLE_FILTER_OPTIONS.map((m) => (
                    <button key={m} onClick={() => setMuscleFilter(m)}
                      className={`flex-shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all ${muscleFilter === m ? 'bg-white text-zinc-900' : 'bg-zinc-800/50 text-zinc-500 active:text-zinc-300'}`}>
                      {m === 'all' ? 'All' : MUSCLE_GROUP_LABELS[m]}
                    </button>
                  ))}
                </div>
                <button onClick={() => setReorderMode(true)} className="flex-shrink-0 rounded-lg bg-zinc-800/50 p-2 text-zinc-500 active:text-zinc-300 transition-colors" title="Reorder exercises">
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              </div>
              <button onClick={() => { setShowCreateExercise(!showCreateExercise); if (!showCreateExercise) { setNewExName(exerciseSearch); setNewExMediaUrl(''); setNewExMediaType(''); } }}
                className="w-full flex items-center gap-2 rounded-xl bg-zinc-800/30 px-3 py-2.5 text-xs font-medium text-zinc-400 active:text-zinc-200 transition-colors">
                <Plus className="h-3.5 w-3.5" />{showCreateExercise ? 'Cancel' : 'Create custom exercise'}
              </button>
              <AnimatePresence>
                {showCreateExercise && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/20 p-3 space-y-3">
                      <div>
                        <label className="text-[10px] font-medium text-zinc-500">Exercise Name</label>
                        <input type="text" value={newExName} onChange={(e) => setNewExName(e.target.value)} placeholder="e.g. Band Pull-Apart" autoFocus
                          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-zinc-500">Primary Muscle</label>
                          <select value={newExPrimary} onChange={(e) => setNewExPrimary(e.target.value as MuscleGroup)}
                            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-2 py-2 text-[11px] text-zinc-100 outline-none">
                            {Object.entries(MUSCLE_GROUP_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-zinc-500">Category</label>
                          <select value={newExCategory} onChange={(e) => setNewExCategory(e.target.value as WorkoutCategory)}
                            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-2 py-2 text-[11px] text-zinc-100 outline-none">
                            {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-zinc-500">Type</label>
                          <select value={newExType} onChange={(e) => setNewExType(e.target.value as ExerciseType)}
                            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-2 py-2 text-[11px] text-zinc-100 outline-none">
                            <option value="compound">Compound</option><option value="isolation">Isolation</option>
                            <option value="cardio">Cardio</option><option value="bodyweight">Bodyweight</option><option value="mobility">Mobility</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-zinc-500">Media (optional)</label>
                        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
                        {newExMediaUrl ? (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0">
                              {newExMediaType === 'video' ? <video src={newExMediaUrl} muted className="h-full w-full object-cover" /> : <img src={newExMediaUrl} alt="Preview" className="h-full w-full object-cover" />}
                            </div>
                            <span className="text-[10px] text-zinc-500 flex-1 truncate">{newExMediaType === 'video' ? 'Video' : newExMediaType === 'gif' ? 'GIF' : 'Image'} attached</span>
                            <button type="button" onClick={() => { setNewExMediaUrl(''); setNewExMediaType(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-zinc-500 active:text-zinc-300"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="mt-1 w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 px-3 py-2.5 text-[11px] text-zinc-500 active:text-zinc-300 transition-colors">
                            <Upload className="h-3.5 w-3.5" />Upload image, GIF, or video
                          </button>
                        )}
                      </div>
                      <Button variant="primary" size="sm" fullWidth onClick={handleCreateExercise} disabled={!newExName.trim()}>Create & Add</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-1 max-h-[50vh] overflow-y-auto -mx-1 px-1">
                {filteredExercises.map((ex) => (
                  <button key={ex.id} onClick={() => handleSelectExercise(ex.id)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-800/40 active:bg-zinc-800/40 transition-colors">
                    <MediaThumbnail exercise={ex} size="md" onClick={() => handleThumbnailClick(ex)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {ex.name}{ex.isCustom && <span className="ml-1.5 text-[9px] font-normal text-zinc-600">custom</span>}
                      </p>
                      <MuscleChips exercise={ex} />
                    </div>
                    <Plus className="h-4 w-4 text-zinc-600 flex-shrink-0" />
                  </button>
                ))}
                {filteredExercises.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-zinc-600">No exercises found</p>
                    {exerciseSearch && !showCreateExercise && (
                      <button onClick={() => { setShowCreateExercise(true); setNewExName(exerciseSearch); }}
                        className="mt-2 text-xs font-medium text-zinc-400 active:text-zinc-200">Create "{exerciseSearch}" as custom exercise</button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Sheet>

      {/* ─── Fullscreen media viewer ─────────────────── */}
      <AnimatePresence>
        {viewingMedia && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm" onClick={() => setViewingMedia(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[120] inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-lg">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-semibold text-zinc-200">{viewingMedia.name}</p>
                  <button onClick={() => setViewingMedia(null)} className="rounded-full bg-zinc-800 p-2 text-zinc-400 active:text-zinc-200"><X className="h-5 w-5" /></button>
                </div>
                <div className="rounded-2xl overflow-hidden bg-zinc-900">
                  {viewingMedia.type === 'video'
                    ? <video src={viewingMedia.url} controls autoPlay loop className="w-full max-h-[70vh] object-contain" />
                    : <img src={viewingMedia.url} alt={viewingMedia.name} className="w-full max-h-[70vh] object-contain" />}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <input ref={exerciseMediaInputRef} type="file" accept="image/*,video/*" onChange={handleExerciseMediaUpload} className="hidden" />

      {/* ─── Exercise editor sheet ───────────────────── */}
      <Sheet open={!!editingExercise} onClose={() => setEditingExercise(null)} title="Edit Exercise">
        {editingExercise && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-500">Exercise Name</label>
              <input type="text" value={editExName} onChange={(e) => setEditExName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Primary Muscle</label>
              <select value={editExPrimary} onChange={(e) => setEditExPrimary(e.target.value as MuscleGroup)}
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-sm text-zinc-100 outline-none">
                {Object.entries(MUSCLE_GROUP_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Secondary Muscles</label>
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                {(Object.entries(MUSCLE_GROUP_LABELS) as [MuscleGroup, string][]).filter(([k]) => k !== editExPrimary).map(([key, label]) => {
                  const sel = editExSecondary.includes(key);
                  return (
                    <button key={key} type="button"
                      onClick={() => setEditExSecondary(sel ? editExSecondary.filter((m) => m !== key) : [...editExSecondary, key])}
                      className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all ${sel ? 'bg-white text-zinc-900' : 'bg-zinc-800/50 text-zinc-500 active:text-zinc-300'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Media</label>
              {editingExercise.mediaUrl && editingExercise.mediaType ? (
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => openMediaViewer(editingExercise)}>
                    {editingExercise.mediaType === 'video' ? <video src={editingExercise.mediaUrl} muted className="h-full w-full object-cover" /> : <img src={editingExercise.mediaUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <button type="button" onClick={async () => { await updateExercise(editingExercise.id, { mediaUrl: undefined, mediaType: undefined }); setEditingExercise({ ...editingExercise, mediaUrl: undefined, mediaType: undefined }); }}
                    className="text-xs text-zinc-500 active:text-negative transition-colors">Remove media</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setMediaUploadTargetId(editingExercise.id); exerciseMediaInputRef.current?.click(); }}
                  className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 px-3 py-3 text-xs text-zinc-500 active:text-zinc-300 transition-colors">
                  <Upload className="h-3.5 w-3.5" />Upload image, GIF, or video
                </button>
              )}
            </div>
            <Button variant="primary" fullWidth onClick={handleSaveExercise} disabled={!editExName.trim()}>Save Changes</Button>
          </div>
        )}
      </Sheet>

      {/* ─── Delete template confirmation ────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[110] inset-0 flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/50">
                <h3 className="text-base font-semibold text-zinc-100">Delete template?</h3>
                <p className="mt-1 text-sm text-zinc-400">"{editingTemplate?.name}" will be moved to Trash. You can restore it later.</p>
                <div className="mt-4 flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                  <Button variant="danger" fullWidth onClick={handleDelete}>Delete</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

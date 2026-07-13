import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Pencil, Check, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useSession, updateSession } from '@/hooks/useWorkout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  SESSION_TAG_LABELS,
  SESSION_TAG_COLORS,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type ExerciseSet,
  type WarmupSet,
} from '@/db/types';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { resolveSetDurationSeconds } from '@/lib/timebased';

const INTENSITY_KEYS = ['very_easy', 'easy', 'moderate', 'hard', 'very_hard', 'intervals'] as const;
const INTENSITY_LABELS: Record<(typeof INTENSITY_KEYS)[number], string> = {
  very_easy: 'Very Easy',
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  very_hard: 'Very Hard',
  intervals: 'Intervals',
};

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
}

export function HistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useSession(id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkoutSession | null>(null);
  const [saving, setSaving] = useState(false);

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  const view = editing && draft ? draft : session;

  const hasStrengthExercises = view.exercises.some(
    (ex) => ex.exerciseType !== 'cardio' && !ex.skipped,
  );

  const totalVolume = view.exercises.reduce(
    (acc, ex) =>
      acc + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  );

  const totalSets = view.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0,
  );

  const totalCardioDistance = view.exercises.reduce(
    (acc, ex) => acc + (ex.exerciseType === 'cardio' && !ex.skipped ? (ex.cardioDistance ?? 0) : 0),
    0,
  );

  // ─── Edit helpers ──────────────────────────────────────

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(session)) as WorkoutSession);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateSession(draft);
      setEditing(false);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const updateExercise = (
    exerciseId: string,
    patch: Partial<WorkoutSessionExercise>,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId ? { ...ex, ...patch } : ex,
        ),
      };
    });
  };

  const updateSet = (
    exerciseId: string,
    setId: string,
    patch: Partial<ExerciseSet>,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
              }
            : ex,
        ),
      };
    });
  };

  const updateWarmupSet = (
    exerciseId: string,
    warmupId: string,
    patch: Partial<WarmupSet>,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                warmupSets: (ex.warmupSets ?? []).map((w) =>
                  w.id === warmupId ? { ...w, ...patch } : w,
                ),
              }
            : ex,
        ),
      };
    });
  };

  const addWorkingSet = (ex: WorkoutSessionExercise) => {
    const next: ExerciseSet = {
      id: crypto.randomUUID(),
      setNumber: ex.sets.length + 1,
      weight: null,
      reps: null,
      completed: false,
    };
    updateExercise(ex.id, { sets: [...ex.sets, next] });
  };

  const removeWorkingSet = (ex: WorkoutSessionExercise, setId: string) => {
    const filtered = ex.sets
      .filter((s) => s.id !== setId)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    updateExercise(ex.id, { sets: filtered });
  };

  const addWarmupSet = (ex: WorkoutSessionExercise) => {
    const next: WarmupSet = { id: crypto.randomUUID(), weight: null, reps: null };
    updateExercise(ex.id, { warmupSets: [...(ex.warmupSets ?? []), next] });
  };

  const removeWarmupSet = (ex: WorkoutSessionExercise, warmupId: string) => {
    const filtered = (ex.warmupSets ?? []).filter((w) => w.id !== warmupId);
    updateExercise(ex.id, { warmupSets: filtered.length === 0 ? undefined : filtered });
  };

  return (
    <div className="pb-32">
      {/* Header — pt-[env(safe-area-inset-top)] keeps the row clear of the
          iPhone status bar (time/battery/signal). The flex row uses py-2 so
          that, combined with min 40×40 touch targets, the visible header height
          stays close to the original. */}
      <div
        className="sticky top-0 z-40 border-b border-zinc-800/50 bg-zinc-950/95 backdrop-blur-sm pt-[env(safe-area-inset-top)]"
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <button
            onClick={() => (editing ? cancelEdit() : navigate(-1))}
            aria-label="Back"
            className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 active:text-zinc-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="truncate font-semibold text-zinc-200">{view.templateName}</p>
            <p className="text-xs text-zinc-500">
              {format(new Date(view.startedAt), 'EEEE, MMM d, yyyy')}
            </p>
          </div>
          {!editing ? (
            <button
              onClick={startEdit}
              aria-label="Edit performance"
              className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 active:text-zinc-200"
            >
              <Pencil className="h-5 w-5" />
            </button>
          ) : (
            <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
              Editing
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats bar */}
        <div className="flex items-center justify-around rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-4 py-3">
          <div className="text-center">
            <p className="text-lg font-bold text-zinc-100">
              {view.duration ? `${Math.round(view.duration / 60)}` : '—'}
            </p>
            <p className="text-[10px] font-medium text-zinc-500">minutes</p>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          {hasStrengthExercises ? (
            <>
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-100">{totalSets}</p>
                <p className="text-[10px] font-medium text-zinc-500">sets</p>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-100">
                  {totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${Math.round(totalVolume)}kg`}
                </p>
                <p className="text-[10px] font-medium text-zinc-500">volume</p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-100">
                  {view.exercises.filter((ex) => !ex.skipped).length}
                </p>
                <p className="text-[10px] font-medium text-zinc-500">exercises</p>
              </div>
              {totalCardioDistance > 0 && (
                <>
                  <div className="h-8 w-px bg-zinc-800" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-100">{totalCardioDistance.toFixed(1)}</p>
                    <p className="text-[10px] font-medium text-zinc-500">km</p>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Tags */}
        {view.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {view.tags.map((tag) => (
              <Badge key={tag} className={SESSION_TAG_COLORS[tag]}>
                {SESSION_TAG_LABELS[tag]}
              </Badge>
            ))}
          </div>
        )}

        {/* Notes */}
        {view.notes && !editing && (
          <div className="flex items-start gap-2 rounded-xl bg-zinc-800/20 px-3 py-2.5">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
            <p className="text-xs text-zinc-400">{view.notes}</p>
          </div>
        )}

        {/* Exercises */}
        <div className="space-y-3">
          {view.exercises.map((exercise) => (
            <div
              key={exercise.id}
              className={`rounded-2xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden ${
                exercise.skipped ? 'opacity-40' : ''
              }`}
            >
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-200">
                    {exercise.replacedWithExerciseName ?? exercise.exerciseName}
                  </h3>
                  {exercise.skipped && <Badge variant="neutral">Skipped</Badge>}
                </div>
                {exercise.replacedWithExerciseName && (
                  <p className="text-xs text-zinc-600">
                    Replaced: {exercise.exerciseName}
                  </p>
                )}
              </div>

              {/* ── Cardio ───────────────────────────────────────── */}
              {!exercise.skipped && exercise.exerciseType === 'cardio' && (
                editing ? (
                  <CardioEditor
                    exercise={exercise}
                    onChange={(patch) => updateExercise(exercise.id, patch)}
                    onToggleCompleted={() => {
                      // Legacy sessions stored completion in sets[0]; new sessions
                      // use cardioCompleted. Toggle whichever applies.
                      if (exercise.sets.length > 0) {
                        const first = exercise.sets[0];
                        updateSet(exercise.id, first.id, { completed: !first.completed });
                      } else {
                        updateExercise(exercise.id, {
                          cardioCompleted: !(exercise.cardioCompleted ?? false),
                        });
                      }
                    }}
                  />
                ) : (
                  <CardioReadOnly exercise={exercise} />
                )
              )}

              {/* ── Strength / time-based ───────────────────────── */}
              {!exercise.skipped && exercise.exerciseType !== 'cardio' && (
                editing ? (
                  <StrengthEditor
                    exercise={exercise}
                    onSetChange={(setId, patch) => updateSet(exercise.id, setId, patch)}
                    onWarmupChange={(wid, patch) => updateWarmupSet(exercise.id, wid, patch)}
                    onAddSet={() => addWorkingSet(exercise)}
                    onRemoveSet={(setId) => removeWorkingSet(exercise, setId)}
                    onAddWarmup={() => addWarmupSet(exercise)}
                    onRemoveWarmup={(wid) => removeWarmupSet(exercise, wid)}
                    onNotesChange={(notes) =>
                      updateExercise(exercise.id, { notes: notes || undefined })
                    }
                  />
                ) : (
                  <StrengthReadOnly exercise={exercise} />
                )
              )}

              {exercise.notes && !editing && (
                <div className="border-t border-zinc-800/30 px-4 py-2">
                  <p className="text-xs text-zinc-500">{exercise.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom save bar (edit mode) ─────────────────────────────── */}
      {editing && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800/50 bg-zinc-950/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-lg gap-3 px-4 py-3">
            <Button variant="ghost" fullWidth onClick={cancelEdit} disabled={saving}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button variant="primary" fullWidth onClick={saveEdit} disabled={saving}>
              <Check className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Read-only blocks ────────────────────────────

function CardioReadOnly({ exercise }: { exercise: WorkoutSessionExercise }) {
  return (
    <div className="px-4 pb-3 space-y-2">
      <div className="flex gap-3">
        {exercise.cardioDuration != null && (
          <div className="flex-1 rounded-xl bg-zinc-800/30 px-3 py-2 text-center">
            <p className="text-sm font-semibold text-zinc-200">{exercise.cardioDuration} min</p>
            <p className="text-[10px] text-zinc-500">Duration</p>
          </div>
        )}
        {exercise.cardioDistance != null && (
          <div className="flex-1 rounded-xl bg-zinc-800/30 px-3 py-2 text-center">
            <p className="text-sm font-semibold text-zinc-200">{exercise.cardioDistance} km</p>
            <p className="text-[10px] text-zinc-500">Distance</p>
          </div>
        )}
        {exercise.cardioPace && (
          <div className="flex-1 rounded-xl bg-zinc-800/30 px-3 py-2 text-center">
            <p className="text-sm font-semibold text-zinc-200">{exercise.cardioPace}</p>
            <p className="text-[10px] text-zinc-500">Pace</p>
          </div>
        )}
      </div>
      {exercise.cardioIntensity && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase text-zinc-600">Intensity</span>
          <span className="rounded-full bg-zinc-800/50 px-2 py-0.5 text-xs font-medium text-zinc-400 capitalize">
            {exercise.cardioIntensity.replace('_', ' ')}
          </span>
        </div>
      )}
    </div>
  );
}

function StrengthReadOnly({ exercise }: { exercise: WorkoutSessionExercise }) {
  const isTimeBased = !!exercise.isTimeBased;
  return (
    <div className="px-4 pb-3">
      {exercise.warmupSets && exercise.warmupSets.length > 0 && (
        <div className="mb-2 rounded-xl border border-warning/10 bg-warning/5 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-warning/70">
            Warm-up
          </p>
          {exercise.warmupSets.map((ws, i) => {
            const wsSecs = resolveSetDurationSeconds(ws, isTimeBased);
            return (
              <div
                key={ws.id}
                className="flex items-center gap-3 py-0.5 text-xs text-zinc-400"
              >
                <span className="w-6 text-center font-bold text-warning/50">W{i + 1}</span>
                {isTimeBased && wsSecs != null ? (
                  <span>{formatSeconds(wsSecs)}</span>
                ) : (
                  <>
                    <span className="w-12 text-center">{ws.weight ?? '—'} kg</span>
                    <span>x</span>
                    <span>{ws.reps ?? '—'}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 px-1 py-1 text-[10px] font-semibold uppercase text-zinc-600">
        <span className="w-6 text-center">Set</span>
        {isTimeBased ? (
          <span className="w-28 text-center">Duration</span>
        ) : (
          <>
            <span className="w-16 text-center">kg</span>
            <span className="w-12 text-center">Reps</span>
          </>
        )}
        <span className="flex-1">Note</span>
      </div>
      {exercise.sets
        .filter((s) => s.completed)
        .map((set) => {
          const setSecs = resolveSetDurationSeconds(set, isTimeBased);
          const showDuration = isTimeBased && setSecs != null;
          const durLabel = setSecs != null
            ? `${Math.floor(setSecs / 60)}m ${(setSecs % 60).toString().padStart(2, '0')}s`
            : '—';
          return (
            <div key={set.id} className="flex items-center gap-4 rounded-lg px-1 py-1.5">
              <span className="w-6 text-center text-xs font-bold text-zinc-500">
                {set.setNumber}
              </span>
              {showDuration ? (
                <span className="w-28 text-center text-sm font-medium text-zinc-200">
                  {durLabel}
                </span>
              ) : (
                <>
                  <span className="w-16 text-center text-sm font-medium text-zinc-200">
                    {set.weight ?? '—'}
                  </span>
                  <span className="w-12 text-center text-sm font-medium text-zinc-200">
                    {set.reps ?? '—'}
                  </span>
                </>
              )}
              <span className="flex-1 text-xs text-zinc-500 truncate">{set.note ?? ''}</span>
            </div>
          );
        })}

      {!isTimeBased && (
        <div className="mt-2 border-t border-zinc-800/30 pt-2 text-right">
          <span className="text-xs text-zinc-600">
            Volume:{' '}
            {exercise.sets
              .reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0)
              .toLocaleString()}{' '}
            kg
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Editors ────────────────────────────────────

function IntegerInput({
  value,
  placeholder,
  className,
  onChange,
}: {
  value: number | null | undefined;
  placeholder?: string;
  className?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        onChange(raw === '' ? null : Number(raw));
      }}
      className={className}
    />
  );
}

function CardioEditor({
  exercise,
  onChange,
  onToggleCompleted,
}: {
  exercise: WorkoutSessionExercise;
  onChange: (patch: Partial<WorkoutSessionExercise>) => void;
  onToggleCompleted: () => void;
}) {
  const completed =
    exercise.sets.length > 0
      ? exercise.sets[0]?.completed ?? false
      : exercise.cardioCompleted ?? false;

  return (
    <div className="px-4 pb-3 space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] font-semibold uppercase text-zinc-600">Duration (min)</label>
          <DecimalInput
            value={exercise.cardioDuration ?? null}
            placeholder="—"
            onChange={(n) => onChange({ cardioDuration: n ?? undefined })}
            className="mt-1 w-full rounded-xl bg-zinc-800/50 px-3 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-semibold uppercase text-zinc-600">Distance (km)</label>
          <DecimalInput
            value={exercise.cardioDistance ?? null}
            placeholder="—"
            onChange={(n) => onChange({ cardioDistance: n ?? undefined })}
            className="mt-1 w-full rounded-xl bg-zinc-800/50 px-3 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase text-zinc-600">Intensity</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {INTENSITY_KEYS.map((key) => {
            const active = exercise.cardioIntensity === key;
            return (
              <button
                key={key}
                onClick={() =>
                  onChange({ cardioIntensity: active ? undefined : key })
                }
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'bg-zinc-200 text-zinc-900 border-transparent'
                    : 'bg-zinc-800/40 text-zinc-400 border-zinc-700/50'
                }`}
              >
                {INTENSITY_LABELS[key]}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onToggleCompleted}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
          completed
            ? 'bg-white text-zinc-900'
            : 'border border-zinc-700 text-zinc-400'
        }`}
      >
        <Check className="h-4 w-4" strokeWidth={2.5} />
        {completed ? 'Completed' : 'Mark complete'}
      </button>
    </div>
  );
}

function StrengthEditor({
  exercise,
  onSetChange,
  onWarmupChange,
  onAddSet,
  onRemoveSet,
  onAddWarmup,
  onRemoveWarmup,
  onNotesChange,
}: {
  exercise: WorkoutSessionExercise;
  onSetChange: (setId: string, patch: Partial<ExerciseSet>) => void;
  onWarmupChange: (warmupId: string, patch: Partial<WarmupSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onAddWarmup: () => void;
  onRemoveWarmup: (warmupId: string) => void;
  onNotesChange: (notes: string) => void;
}) {
  const isTimeBased = !!exercise.isTimeBased;
  const warmups = exercise.warmupSets ?? [];

  return (
    <div className="px-3 pb-3 space-y-2">
      {/* Warm-ups */}
      <div className="rounded-xl border border-warning/10 bg-warning/5 overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-warning/70">
            Warm-up
          </span>
        </div>
        <div className="space-y-1 px-2 pb-1.5">
          {warmups.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-zinc-600">No warm-up sets.</p>
          )}
          {warmups.map((ws, i) => {
            const total = ws.durationSeconds ?? 0;
            const mins = total > 0 ? Math.floor(total / 60) : null;
            const secs = total > 0 ? total % 60 : null;
            return (
              <div key={ws.id} className="flex items-center gap-2 rounded-lg bg-zinc-900/40 px-2 py-1.5">
                <span className="w-7 text-center text-[10px] font-bold text-warning/60">W{i + 1}</span>
                {isTimeBased && ws.durationSeconds != null ? (
                  <>
                    <IntegerInput
                      value={mins}
                      placeholder="min"
                      onChange={(m) => {
                        const next = (m ?? 0) * 60 + (secs ?? 0);
                        onWarmupChange(ws.id, { durationSeconds: next === 0 ? null : next });
                      }}
                      className="w-12 rounded-lg bg-zinc-800/50 px-2 py-1.5 text-center text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-warning/40"
                    />
                    <span className="text-xs text-zinc-600">:</span>
                    <IntegerInput
                      value={secs}
                      placeholder="sec"
                      onChange={(s) => {
                        const safe = s != null && s > 59 ? 59 : s;
                        const next = (mins ?? 0) * 60 + (safe ?? 0);
                        onWarmupChange(ws.id, { durationSeconds: next === 0 ? null : next });
                      }}
                      className="w-12 rounded-lg bg-zinc-800/50 px-2 py-1.5 text-center text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-warning/40"
                    />
                  </>
                ) : (
                  <>
                    <DecimalInput
                      value={ws.weight}
                      placeholder="kg"
                      onChange={(n) => onWarmupChange(ws.id, { weight: n })}
                      className="w-16 rounded-lg bg-zinc-800/50 px-2 py-1.5 text-center text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-warning/40"
                    />
                    <IntegerInput
                      value={ws.reps}
                      placeholder="reps"
                      onChange={(n) => onWarmupChange(ws.id, { reps: n })}
                      className="w-14 rounded-lg bg-zinc-800/50 px-2 py-1.5 text-center text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-warning/40"
                    />
                  </>
                )}
                <button
                  onClick={() => onRemoveWarmup(ws.id)}
                  className="ml-auto rounded-full p-1 text-zinc-600 active:text-zinc-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={onAddWarmup}
          className="flex w-full items-center justify-center gap-1 border-t border-warning/10 py-1.5 text-[10px] font-medium text-warning/60 active:text-warning"
        >
          <Plus className="h-3 w-3" />
          Add warm-up set
        </button>
      </div>

      {/* Working sets */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 px-3 py-1">
          <span className="w-6 text-center text-[10px] font-semibold uppercase text-zinc-600">Set</span>
          {isTimeBased ? (
            <span className="text-[10px] font-semibold uppercase text-zinc-600">Duration (mm : ss)</span>
          ) : (
            <>
              <span className="w-16 text-center text-[10px] font-semibold uppercase text-zinc-600">kg</span>
              <span className="w-14 text-center text-[10px] font-semibold uppercase text-zinc-600">Reps</span>
            </>
          )}
          <span className="ml-auto w-9 text-center text-[10px] font-semibold uppercase text-zinc-600">✓</span>
        </div>

        {exercise.sets.map((set) => (
          <EditableSet
            key={set.id}
            set={set}
            isTimeBased={isTimeBased}
            onChange={(patch) => onSetChange(set.id, patch)}
            onRemove={() => onRemoveSet(set.id)}
          />
        ))}

        <button
          onClick={onAddSet}
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-700/50 py-1.5 text-[11px] font-medium text-zinc-500 active:text-zinc-300"
        >
          <Plus className="h-3 w-3" />
          Add set
        </button>
      </div>

      {/* Per-exercise notes */}
      <div>
        <label className="text-[10px] font-semibold uppercase text-zinc-600">Notes</label>
        <input
          type="text"
          value={exercise.notes ?? ''}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add a note for this exercise…"
          className="mt-1 w-full rounded-lg bg-zinc-800/50 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500"
        />
      </div>
    </div>
  );
}

function EditableSet({
  set,
  isTimeBased,
  onChange,
  onRemove,
}: {
  set: ExerciseSet;
  isTimeBased: boolean;
  onChange: (patch: Partial<ExerciseSet>) => void;
  onRemove: () => void;
}) {
  if (isTimeBased) {
    const total = set.durationSeconds ?? 0;
    const mins = total > 0 ? Math.floor(total / 60) : null;
    const secs = total > 0 ? total % 60 : null;
    return (
      <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="w-6 text-center text-xs font-bold text-zinc-500">{set.setNumber}</span>
          <IntegerInput
            value={mins}
            placeholder="min"
            onChange={(m) => {
              const next = (m ?? 0) * 60 + (secs ?? 0);
              onChange({ durationSeconds: next === 0 ? null : next });
            }}
            className="w-14 rounded-lg bg-zinc-800/50 px-2 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500"
          />
          <span className="text-xs text-zinc-600">:</span>
          <IntegerInput
            value={secs}
            placeholder="sec"
            onChange={(s) => {
              const safe = s != null && s > 59 ? 59 : s;
              const next = (mins ?? 0) * 60 + (safe ?? 0);
              onChange({ durationSeconds: next === 0 ? null : next });
            }}
            className="w-14 rounded-lg bg-zinc-800/50 px-2 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500"
          />
          <button
            onClick={() => onChange({ completed: !set.completed })}
            className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-all ${
              set.completed
                ? 'bg-white text-zinc-900'
                : 'border border-zinc-700 text-zinc-600'
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={onRemove}
            className="rounded-full p-1.5 text-zinc-600 active:text-zinc-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="w-6 text-center text-xs font-bold text-zinc-500">{set.setNumber}</span>
        <DecimalInput
          value={set.weight}
          placeholder="kg"
          onChange={(n) => onChange({ weight: n })}
          className="w-16 rounded-lg bg-zinc-800/50 px-2.5 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500"
        />
        <IntegerInput
          value={set.reps}
          placeholder="reps"
          onChange={(n) => onChange({ reps: n })}
          className="w-14 rounded-lg bg-zinc-800/50 px-2.5 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500"
        />
        <button
          onClick={() => onChange({ completed: !set.completed })}
          className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-all ${
            set.completed
              ? 'bg-white text-zinc-900'
              : 'border border-zinc-700 text-zinc-600'
          }`}
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <button
          onClick={onRemove}
          className="rounded-full p-1.5 text-zinc-600 active:text-zinc-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

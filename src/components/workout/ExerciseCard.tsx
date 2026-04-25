import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, SkipForward, ArrowRightLeft, MessageSquare, Info, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkoutSessionExercise, ExerciseSet, WarmupSet, SetProgressComparison } from '@/db/types';
import { SetRow } from './SetRow';
import { RestTimer, type RestTimerHandle } from './RestTimer';
import { compareSetProgress } from '@/hooks/useWorkout';
import { Button } from '@/components/ui/Button';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { resolveSetDurationSeconds } from '@/lib/timebased';

function formatWarmupDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface ExerciseCardProps {
  exercise: WorkoutSessionExercise;
  prevExercise?: WorkoutSessionExercise | null;
  templateNotes?: string;
  machineSetup?: string;
  onChange: (updated: WorkoutSessionExercise) => void;
  onSkip: () => void;
  onReplace: () => void;
}

export function ExerciseCard({
  exercise,
  prevExercise,
  templateNotes,
  machineSetup,
  onChange,
  onSkip,
  onReplace,
}: ExerciseCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [exerciseNote, setExerciseNote] = useState(exercise.notes ?? '');
  const timerRef = useRef<RestTimerHandle>(null);

  // Warm-up state: derive from exercise data, track dismissal locally
  const [warmupDismissed, setWarmupDismissed] = useState(false);
  const hasWarmupSets = exercise.warmupSets && exercise.warmupSets.length > 0;
  const warmupState = hasWarmupSets
    ? 'logging'
    : warmupDismissed
      ? 'declined'
      : 'prompt';

  const isTimeBased = !!exercise.isTimeBased;
  const prevWarmupSets = prevExercise?.warmupSets ?? [];
  const hasPrevWarmup = prevWarmupSets.length > 0;

  if (exercise.skipped) {
    return (
      <div className="rounded-2xl border border-zinc-800/30 bg-zinc-900/20 px-4 py-3 opacity-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 line-through">{exercise.exerciseName}</p>
            {exercise.skipReason && (
              <p className="mt-0.5 text-xs text-zinc-600">Skipped: {exercise.skipReason}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSetChange = (setIndex: number, updates: Partial<ExerciseSet>) => {
    const newSets = [...exercise.sets];
    newSets[setIndex] = { ...newSets[setIndex], ...updates };
    onChange({ ...exercise, sets: newSets });
  };

  const handleSetComplete = (setIndex: number) => {
    const set = exercise.sets[setIndex];
    const newSets = [...exercise.sets];
    newSets[setIndex] = { ...set, completed: !set.completed };
    onChange({ ...exercise, sets: newSets });

    // Auto-start rest timer when completing a set
    if (!set.completed && exercise.restSeconds > 0) {
      timerRef.current?.start(exercise.restSeconds);
    }
  };

  const getComparison = (setIndex: number): SetProgressComparison => {
    const currentSet = exercise.sets[setIndex];
    const prevSet = prevExercise?.sets[setIndex];
    const isTime = !!exercise.isTimeBased;
    return compareSetProgress(
      currentSet.weight,
      currentSet.reps,
      prevSet?.weight ?? null,
      prevSet?.reps ?? null,
      resolveSetDurationSeconds(currentSet, isTime),
      resolveSetDurationSeconds(prevSet ?? null, isTime),
    );
  };

  // ── Warm-up handlers ────────────────────────────────

  const handleStartWarmup = () => {
    onChange({
      ...exercise,
      warmupSets: [{ id: crypto.randomUUID(), weight: null, reps: null }],
    });
  };

  const handleAddWarmupSet = () => {
    const current = exercise.warmupSets ?? [];
    onChange({
      ...exercise,
      warmupSets: [...current, { id: crypto.randomUUID(), weight: null, reps: null }],
    });
  };

  const handleWarmupSetChange = (index: number, updates: Partial<WarmupSet>) => {
    const newSets = [...(exercise.warmupSets ?? [])];
    newSets[index] = { ...newSets[index], ...updates };
    onChange({ ...exercise, warmupSets: newSets });
  };

  const handleRemoveWarmupSet = (index: number) => {
    const newSets = (exercise.warmupSets ?? []).filter((_, i) => i !== index);
    if (newSets.length === 0) {
      // All removed → go back to prompt
      onChange({ ...exercise, warmupSets: undefined });
    } else {
      onChange({ ...exercise, warmupSets: newSets });
    }
  };

  const completedSets = exercise.sets.filter((s) => s.completed).length;
  const totalSets = exercise.sets.length;

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-100">
              {exercise.replacedWithExerciseName ?? exercise.exerciseName}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">
                {exercise.targetSets} x {exercise.targetRepsMin}
                {exercise.targetRepsMax !== exercise.targetRepsMin && `–${exercise.targetRepsMax}`}
              </span>
              <span className="text-zinc-700">|</span>
              <span className="text-xs text-zinc-600">
                {Math.floor(exercise.restSeconds / 60)}:{(exercise.restSeconds % 60).toString().padStart(2, '0')} rest
              </span>
              <span className="text-zinc-700">|</span>
              <span className="text-xs font-medium text-zinc-500">
                {completedSets}/{totalSets}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(templateNotes || machineSetup) && (
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="rounded-full p-1.5 text-zinc-500 active:bg-zinc-800 active:text-zinc-300"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setShowActions(!showActions)}
              className="rounded-full p-1.5 text-zinc-500 active:bg-zinc-800 active:text-zinc-300"
            >
              {showActions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible notes */}
        <AnimatePresence>
          {showNotes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1 rounded-xl bg-zinc-800/30 px-3 py-2">
                {templateNotes && (
                  <p className="text-xs text-zinc-400">{templateNotes}</p>
                )}
                {machineSetup && (
                  <p className="text-xs text-blue-400/80">Setup: {machineSetup}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Previous warm-up summary ─────────────────── */}
      {hasPrevWarmup && warmupState !== 'declined' && (
        <div className="mx-3 mb-2 rounded-xl bg-zinc-800/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Previous warm-up
          </p>
          <ul className="mt-1 space-y-0.5">
            {prevWarmupSets.map((ws, i) => {
              if (isTimeBased) {
                const secs = resolveSetDurationSeconds(ws, true);
                return (
                  <li key={ws.id ?? i} className="text-xs text-zinc-400">
                    {secs != null ? formatWarmupDuration(secs) : '—'}
                  </li>
                );
              }
              return (
                <li key={ws.id ?? i} className="text-xs text-zinc-400">
                  {`${ws.weight ?? '—'} kg × ${ws.reps ?? '—'}`}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Warm-up prompt ──────────────────────────── */}
      {warmupState === 'prompt' && (
        <div className="mx-3 mb-2 flex items-center justify-between rounded-xl bg-zinc-800/30 px-3 py-2">
          <span className="text-xs font-medium text-zinc-400">Warm-up sets?</span>
          <div className="flex gap-2">
            <button
              onClick={() => setWarmupDismissed(true)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 active:text-zinc-300 transition-colors"
            >
              No
            </button>
            <button
              onClick={handleStartWarmup}
              className="rounded-lg bg-zinc-700/50 px-2.5 py-1 text-xs font-medium text-zinc-300 active:bg-zinc-600/50 transition-colors"
            >
              Yes
            </button>
          </div>
        </div>
      )}

      {/* ── Warm-up sets section ────────────────────── */}
      {warmupState === 'logging' && (
        <div className="mx-3 mb-2 rounded-xl border border-amber-500/10 bg-amber-500/5 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/70">Warm-up</span>
          </div>
          <div className="space-y-1 px-2 pb-1.5">
            {exercise.warmupSets!.map((ws, i) => (
              <div key={ws.id} className="flex items-center gap-2 rounded-lg bg-zinc-900/40 px-2 py-1.5">
                <span className="w-7 text-center text-[10px] font-bold text-amber-500/60">W{i + 1}</span>
                <DecimalInput
                  placeholder="kg"
                  value={ws.weight}
                  onChange={(n) => handleWarmupSetChange(i, { weight: n })}
                  className="w-16 rounded-lg bg-zinc-800/50 px-2 py-1.5 text-center text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-amber-500/40 transition-all"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="reps"
                  value={ws.reps ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    handleWarmupSetChange(i, { reps: raw === '' ? null : Number(raw) });
                  }}
                  className="w-14 rounded-lg bg-zinc-800/50 px-2 py-1.5 text-center text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-amber-500/40 transition-all"
                />
                <button
                  onClick={() => handleRemoveWarmupSet(i)}
                  className="rounded-full p-1 text-zinc-600 active:text-zinc-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleAddWarmupSet}
            className="flex w-full items-center justify-center gap-1 border-t border-amber-500/10 py-1.5 text-[10px] font-medium text-amber-500/60 active:text-amber-400 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add set
          </button>
        </div>
      )}

      {/* ── Working Sets label (only when warm-up is shown) ── */}
      {warmupState === 'logging' && (
        <div className="mx-3 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Working Sets</span>
        </div>
      )}

      {/* Sets */}
      <div className="space-y-1.5 px-3 pb-2">
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-1">
          <span className="w-6 text-center text-[10px] font-semibold uppercase text-zinc-600">Set</span>
          <span className="w-20 text-[10px] font-semibold uppercase text-zinc-600">Previous</span>
          {isTimeBased ? (
            <span className="text-[10px] font-semibold uppercase text-zinc-600">Duration (mm : ss)</span>
          ) : (
            <>
              <span className="w-16 text-center text-[10px] font-semibold uppercase text-zinc-600">kg</span>
              <span className="w-14 text-center text-[10px] font-semibold uppercase text-zinc-600">Reps</span>
            </>
          )}
          <span className="w-9" />
        </div>

        {exercise.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            prevSet={prevExercise?.sets[i] ?? null}
            comparison={getComparison(i)}
            isTimeBased={isTimeBased}
            onChange={(updates) => handleSetChange(i, updates)}
            onComplete={() => handleSetComplete(i)}
          />
        ))}
      </div>

      {/* Rest timer */}
      <div className="px-3 pb-3">
        <RestTimer
          ref={timerRef}
          defaultSeconds={exercise.restSeconds}
          persistKey={`rest-${exercise.id}`}
        />
      </div>

      {/* Actions drawer */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-800/30"
          >
            <div className="flex flex-col gap-2 px-4 py-3">
              {/* Note input */}
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Add a note for this exercise..."
                  value={exerciseNote}
                  onChange={(e) => {
                    setExerciseNote(e.target.value);
                    onChange({ ...exercise, notes: e.target.value || undefined });
                  }}
                  className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </Button>
                <Button variant="ghost" size="sm" onClick={onReplace}>
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Replace
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

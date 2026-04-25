import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, SkipForward, ArrowRightLeft, MessageSquare, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkoutSessionExercise } from '@/db/types';
import { Button } from '@/components/ui/Button';
import { parseDecimalInput, DECIMAL_INPUT_PATTERN } from '@/lib/decimal';

interface CardioExerciseCardProps {
  exercise: WorkoutSessionExercise;
  templateNotes?: string;
  onChange: (updated: WorkoutSessionExercise) => void;
  onSkip: () => void;
  onReplace: () => void;
}

const INTENSITY_LABELS: Record<string, string> = {
  very_easy: 'Very Easy',
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  very_hard: 'Very Hard',
  intervals: 'Intervals',
};

const INTENSITY_COLORS: Record<string, { active: string; inactive: string }> = {
  very_easy: { active: 'bg-blue-500/20 text-blue-400 border-blue-500/30', inactive: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50' },
  easy: { active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', inactive: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50' },
  moderate: { active: 'bg-amber-500/20 text-amber-400 border-amber-500/30', inactive: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50' },
  hard: { active: 'bg-orange-500/20 text-orange-400 border-orange-500/30', inactive: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50' },
  very_hard: { active: 'bg-red-500/20 text-red-400 border-red-500/30', inactive: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50' },
  intervals: { active: 'bg-purple-500/20 text-purple-400 border-purple-500/30', inactive: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50' },
};

function computePace(duration: number, distance: number): string {
  if (!duration || !distance || distance <= 0) return '';
  const paceMin = duration / distance;
  const minutes = Math.floor(paceMin);
  const seconds = Math.round((paceMin - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

export function CardioExerciseCard({
  exercise,
  templateNotes,
  onChange,
  onSkip,
  onReplace,
}: CardioExerciseCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [exerciseNote, setExerciseNote] = useState(exercise.notes ?? '');

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

  const hasLegacySets = exercise.sets.length > 0;
  const isCompleted = hasLegacySets
    ? (exercise.sets[0]?.completed ?? false)
    : (exercise.cardioCompleted ?? false);
  const pace =
    exercise.cardioDuration && exercise.cardioDistance
      ? computePace(exercise.cardioDuration, exercise.cardioDistance)
      : exercise.cardioPace ?? '';

  const handleToggleComplete = () => {
    if (hasLegacySets) {
      const newSets = [...exercise.sets];
      newSets[0] = { ...newSets[0], completed: !newSets[0].completed };
      onChange({ ...exercise, sets: newSets });
    } else {
      onChange({ ...exercise, cardioCompleted: !isCompleted });
    }
  };

  const handleFieldChange = (field: string, value: number | string | undefined) => {
    const updated = { ...exercise, [field]: value };
    // Auto-compute pace when duration & distance change
    if ((field === 'cardioDuration' || field === 'cardioDistance') && updated.cardioDuration && updated.cardioDistance) {
      updated.cardioPace = computePace(updated.cardioDuration, updated.cardioDistance);
    }
    onChange(updated);
  };

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-100">
              {exercise.replacedWithExerciseName ?? exercise.exerciseName}
            </h3>
            <span className="text-xs font-medium text-rose-400/80">Cardio</span>
          </div>
          <div className="flex items-center gap-1">
            {templateNotes && (
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
              <div className="mt-2 rounded-xl bg-zinc-800/30 px-3 py-2">
                <p className="text-xs text-zinc-400">{templateNotes}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cardio fields */}
      <div className="space-y-3 px-4 pb-4">
        {/* Duration & Distance row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase text-zinc-600">Duration (min)</label>
            <input
              type="text"
              inputMode="decimal"
              pattern={DECIMAL_INPUT_PATTERN}
              placeholder="—"
              value={exercise.cardioDuration ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return handleFieldChange('cardioDuration', undefined);
                const n = parseDecimalInput(raw);
                handleFieldChange('cardioDuration', isNaN(n) ? undefined : n);
              }}
              className="mt-1 w-full rounded-xl bg-zinc-800/50 px-3 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500 transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase text-zinc-600">Distance (km)</label>
            <input
              type="text"
              inputMode="decimal"
              pattern={DECIMAL_INPUT_PATTERN}
              placeholder="—"
              value={exercise.cardioDistance ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return handleFieldChange('cardioDistance', undefined);
                const n = parseDecimalInput(raw);
                handleFieldChange('cardioDistance', isNaN(n) ? undefined : n);
              }}
              className="mt-1 w-full rounded-xl bg-zinc-800/50 px-3 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500 transition-all"
            />
          </div>
        </div>

        {/* Pace display */}
        {pace && (
          <div className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase text-zinc-600">Pace</span>
            <span className="text-sm font-medium text-zinc-300">{pace}</span>
          </div>
        )}

        {/* Intensity pills */}
        <div>
          <label className="text-[10px] font-semibold uppercase text-zinc-600">Intensity</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(INTENSITY_LABELS).map(([key, label]) => {
              const isActive = exercise.cardioIntensity === key;
              const colors = INTENSITY_COLORS[key];
              return (
                <button
                  key={key}
                  onClick={() =>
                    handleFieldChange(
                      'cardioIntensity',
                      isActive ? undefined : key
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                    isActive ? colors.active : colors.inactive
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Complete button */}
        <button
          onClick={handleToggleComplete}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
            isCompleted
              ? 'bg-white text-zinc-900'
              : 'border border-zinc-700 text-zinc-400 active:border-zinc-500 active:text-zinc-300'
          }`}
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          {isCompleted ? 'Completed' : 'Mark Complete'}
        </button>
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
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Add a note..."
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

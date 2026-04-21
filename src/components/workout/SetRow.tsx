import { type ExerciseSet, type SetProgressComparison } from '@/db/types';
import { Check } from 'lucide-react';

interface SetRowProps {
  set: ExerciseSet;
  prevSet?: ExerciseSet | null;
  comparison: SetProgressComparison;
  onChange: (updated: Partial<ExerciseSet>) => void;
  onComplete: () => void;
}

export function SetRow({ set, prevSet, comparison, onChange, onComplete }: SetRowProps) {
  const hasWeightProgression = set.completed && comparison.weight !== 'none' && comparison.weight !== 'same';
  const hasRepsProgression = set.completed && comparison.reps !== 'none' && comparison.reps !== 'same';
  const repsNeutral = set.completed && comparison.reps === 'same';
  const showIndicators = hasWeightProgression || hasRepsProgression || repsNeutral;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-all ${
        set.completed ? 'border-zinc-700/50 bg-zinc-900/40' : 'border-zinc-800/50 bg-zinc-900/30'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Set number */}
        <span className="w-6 text-center text-xs font-bold text-zinc-500">
          {set.setNumber}
        </span>

        {/* Previous set ghost */}
        {prevSet && prevSet.weight !== null ? (
          <div className="flex w-20 items-center gap-1 text-xs text-zinc-600">
            <span>{prevSet.weight}kg</span>
            <span>x</span>
            <span>{prevSet.reps}</span>
          </div>
        ) : (
          <div className="w-20" />
        )}

        {/* Weight input */}
        <input
          type="number"
          inputMode="decimal"
          placeholder="kg"
          value={set.weight ?? ''}
          onChange={(e) => onChange({ weight: e.target.value ? Number(e.target.value) : null })}
          className="w-16 rounded-lg bg-zinc-800/50 px-2.5 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500 transition-all"
        />

        {/* Reps input */}
        <input
          type="number"
          inputMode="numeric"
          placeholder="reps"
          value={set.reps ?? ''}
          onChange={(e) => onChange({ reps: e.target.value ? Number(e.target.value) : null })}
          className="w-14 rounded-lg bg-zinc-800/50 px-2.5 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500 transition-all"
        />

        {/* Complete button */}
        <button
          onClick={onComplete}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
            set.completed
              ? 'bg-white text-zinc-900'
              : 'border border-zinc-700 text-zinc-600 active:border-zinc-500 active:text-zinc-400'
          }`}
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Progression indicators */}
      {showIndicators && (
        <div className="flex items-center gap-2 mt-1.5 ml-6 flex-wrap">
          {/* Weight progression */}
          {comparison.weight === 'up' && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              +{comparison.weightDiff}kg
            </span>
          )}
          {comparison.weight === 'down' && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              {comparison.weightDiff}kg
            </span>
          )}

          {/* Reps progression — only shown when same weight */}
          {comparison.reps === 'up' && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              +{comparison.repsDiff} rep{comparison.repsDiff !== 1 ? 's' : ''}
            </span>
          )}
          {comparison.reps === 'down' && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              {comparison.repsDiff} rep{comparison.repsDiff !== -1 ? 's' : ''}
            </span>
          )}
          {repsNeutral && !hasWeightProgression && (
            <span className="rounded-full bg-zinc-800/50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              = same
            </span>
          )}
        </div>
      )}
    </div>
  );
}

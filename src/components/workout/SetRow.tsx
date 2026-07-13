import { type ExerciseSet, type SetProgressComparison } from '@/db/types';
import { Check } from 'lucide-react';
import { resolveSetDurationSeconds } from '@/lib/timebased';
import { DecimalInput } from '@/components/ui/DecimalInput';

interface SetRowProps {
  set: ExerciseSet;
  prevSet?: ExerciseSet | null;
  comparison: SetProgressComparison;
  isTimeBased?: boolean;
  onChange: (updated: Partial<ExerciseSet>) => void;
  onComplete: () => void;
}

function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return '—';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatDurationDiff(secondsDiff: number): string {
  const abs = Math.abs(secondsDiff);
  if (abs < 60) return `${secondsDiff > 0 ? '+' : '−'}${abs}s`;
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${secondsDiff > 0 ? '+' : '−'}${m}m${s ? ` ${s}s` : ''}`;
}

export function SetRow({ set, prevSet, comparison, isTimeBased, onChange, onComplete }: SetRowProps) {
  const hasWeightProgression = set.completed && comparison.weight !== 'none' && comparison.weight !== 'same';
  const hasRepsProgression = set.completed && comparison.reps !== 'none' && comparison.reps !== 'same';
  const repsNeutral = set.completed && comparison.reps === 'same';
  const showIndicators = !isTimeBased && (hasWeightProgression || hasRepsProgression || repsNeutral);

  // ── Time-based row (e.g. Plank): replace weight+reps with mm:ss ─────────
  if (isTimeBased) {
    const total = set.durationSeconds ?? 0;
    const mins = total > 0 ? Math.floor(total / 60) : null;
    const secs = total > 0 ? total % 60 : null;
    const hasDurProgression = set.completed && comparison.duration !== 'none' && comparison.duration !== 'same';
    const durNeutral = set.completed && comparison.duration === 'same';
    const showTimeIndicators =
      hasWeightProgression || hasDurProgression || durNeutral;

    const handleMinChange = (raw: string) => {
      const m = raw === '' ? 0 : parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
      const next = m * 60 + (secs ?? 0);
      onChange({ durationSeconds: next === 0 ? null : next });
    };
    const handleSecChange = (raw: string) => {
      let s = raw === '' ? 0 : parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
      if (s > 59) s = 59;
      const next = (mins ?? 0) * 60 + s;
      onChange({ durationSeconds: next === 0 ? null : next });
    };

    return (
      <div
        className={`rounded-xl border px-3 py-2.5 transition-all ${
          set.completed ? 'border-zinc-700/50 bg-zinc-900/40' : 'border-zinc-800/50 bg-zinc-900/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 text-center text-xs font-bold text-zinc-500">{set.setNumber}</span>

          {/* Previous duration ghost: prefers new durationSeconds, falls back to
              legacy reps (mm.ss) for older time-based entries. */}
          {(() => {
            const prevSecs = resolveSetDurationSeconds(prevSet, true);
            return prevSecs != null ? (
              <div className="flex w-20 items-center gap-1 text-xs text-zinc-600">
                <span>{formatDuration(prevSecs)}</span>
              </div>
            ) : (
              <div className="w-20" />
            );
          })()}

          {/* Minutes */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="min"
            value={mins ?? ''}
            onChange={(e) => handleMinChange(e.target.value)}
            className="w-14 rounded-lg bg-zinc-800/50 px-2 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500 transition-all"
          />
          <span className="text-xs text-zinc-600">:</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="sec"
            value={secs ?? ''}
            onChange={(e) => handleSecChange(e.target.value)}
            className="w-14 rounded-lg bg-zinc-800/50 px-2 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500 transition-all"
          />

          <button
            onClick={onComplete}
            className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-all ${
              set.completed
                ? 'bg-white text-zinc-900'
                : 'border border-zinc-700 text-zinc-600 active:border-zinc-500 active:text-zinc-400'
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Progression indicators (time-based) */}
        {showTimeIndicators && (
          <div className="flex items-center gap-2 mt-1.5 ml-6 flex-wrap">
            {comparison.weight === 'up' && (
              <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive">
                +{comparison.weightDiff}kg
              </span>
            )}
            {comparison.weight === 'down' && (
              <span className="rounded-full bg-negative/10 px-2 py-0.5 text-[10px] font-semibold text-negative">
                {comparison.weightDiff}kg
              </span>
            )}
            {comparison.duration === 'up' && comparison.durationDiff != null && (
              <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive">
                {formatDurationDiff(comparison.durationDiff)}
              </span>
            )}
            {comparison.duration === 'down' && comparison.durationDiff != null && (
              <span className="rounded-full bg-negative/10 px-2 py-0.5 text-[10px] font-semibold text-negative">
                {formatDurationDiff(comparison.durationDiff)}
              </span>
            )}
            {durNeutral && !hasWeightProgression && comparison.duration === 'same' && (
              <span className="rounded-full bg-zinc-800/50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                = same
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Standard weight + reps row ──────────────────────────────────────────
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
        <DecimalInput
          placeholder="kg"
          value={set.weight}
          onChange={(n) => onChange({ weight: n })}
          className="w-16 rounded-lg bg-zinc-800/50 px-2.5 py-2 text-center text-sm font-medium text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-700/50 focus:ring-zinc-500 transition-all"
        />

        {/* Reps input */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="reps"
          value={set.reps ?? ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            onChange({ reps: raw === '' ? null : Number(raw) });
          }}
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
            <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive">
              +{comparison.weightDiff}kg
            </span>
          )}
          {comparison.weight === 'down' && (
            <span className="rounded-full bg-negative/10 px-2 py-0.5 text-[10px] font-semibold text-negative">
              {comparison.weightDiff}kg
            </span>
          )}

          {/* Reps progression — only shown when same weight */}
          {comparison.reps === 'up' && (
            <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive">
              +{comparison.repsDiff} rep{comparison.repsDiff !== 1 ? 's' : ''}
            </span>
          )}
          {comparison.reps === 'down' && (
            <span className="rounded-full bg-negative/10 px-2 py-0.5 text-[10px] font-semibold text-negative">
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

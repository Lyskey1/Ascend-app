import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Dumbbell, Tag, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useSession } from '@/hooks/useWorkout';
import { Badge } from '@/components/ui/Badge';
import { SESSION_TAG_LABELS, SESSION_TAG_COLORS } from '@/db/types';

export function HistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useSession(id);

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  const hasStrengthExercises = session.exercises.some(
    (ex) => ex.exerciseType !== 'cardio' && !ex.skipped
  );

  const totalVolume = session.exercises.reduce(
    (acc, ex) =>
      acc + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0
  );

  const totalSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );

  const totalCardioDistance = session.exercises.reduce(
    (acc, ex) => acc + (ex.exerciseType === 'cardio' && !ex.skipped ? (ex.cardioDistance ?? 0) : 0),
    0
  );

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-zinc-800/50 bg-zinc-950/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full p-1.5 text-zinc-400 active:text-zinc-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="font-semibold text-zinc-200">{session.templateName}</p>
            <p className="text-xs text-zinc-500">
              {format(new Date(session.startedAt), 'EEEE, MMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats bar */}
        <div className="flex items-center justify-around rounded-2xl border border-zinc-800/50 bg-zinc-900/30 px-4 py-3">
          <div className="text-center">
            <p className="text-lg font-bold text-zinc-100">
              {session.duration ? `${Math.round(session.duration / 60)}` : '—'}
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
                  {session.exercises.filter((ex) => !ex.skipped).length}
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
        {session.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {session.tags.map((tag) => (
              <Badge key={tag} className={SESSION_TAG_COLORS[tag]}>
                {SESSION_TAG_LABELS[tag]}
              </Badge>
            ))}
          </div>
        )}

        {/* Notes */}
        {session.notes && (
          <div className="flex items-start gap-2 rounded-xl bg-zinc-800/20 px-3 py-2.5">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
            <p className="text-xs text-zinc-400">{session.notes}</p>
          </div>
        )}

        {/* Exercises */}
        <div className="space-y-3">
          {session.exercises.map((exercise) => (
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
                  {exercise.skipped && (
                    <Badge variant="neutral">Skipped</Badge>
                  )}
                </div>
                {exercise.replacedWithExerciseName && (
                  <p className="text-xs text-zinc-600">
                    Replaced: {exercise.exerciseName}
                  </p>
                )}
              </div>

              {!exercise.skipped && exercise.exerciseType === 'cardio' && (
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
              )}
              {!exercise.skipped && exercise.exerciseType !== 'cardio' && (
                <div className="px-4 pb-3">
                  {/* Warm-up sets */}
                  {exercise.warmupSets && exercise.warmupSets.length > 0 && (
                    <div className="mb-2 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500/70">
                        Warm-up
                      </p>
                      {exercise.warmupSets.map((ws, i) => (
                        <div
                          key={ws.id}
                          className="flex items-center gap-3 py-0.5 text-xs text-zinc-400"
                        >
                          <span className="w-6 text-center font-bold text-amber-500/50">W{i + 1}</span>
                          <span className="w-12 text-center">{ws.weight ?? '—'} kg</span>
                          <span>x</span>
                          <span>{ws.reps ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Working sets */}
                  <div className="flex items-center gap-4 px-1 py-1 text-[10px] font-semibold uppercase text-zinc-600">
                    <span className="w-6 text-center">Set</span>
                    <span className="w-16 text-center">kg</span>
                    <span className="w-12 text-center">Reps</span>
                    <span className="flex-1">Note</span>
                  </div>
                  {exercise.sets
                    .filter((s) => s.completed)
                    .map((set) => (
                      <div
                        key={set.id}
                        className="flex items-center gap-4 rounded-lg px-1 py-1.5"
                      >
                        <span className="w-6 text-center text-xs font-bold text-zinc-500">
                          {set.setNumber}
                        </span>
                        <span className="w-16 text-center text-sm font-medium text-zinc-200">
                          {set.weight ?? '—'}
                        </span>
                        <span className="w-12 text-center text-sm font-medium text-zinc-200">
                          {set.reps ?? '—'}
                        </span>
                        <span className="flex-1 text-xs text-zinc-500 truncate">
                          {set.note ?? ''}
                        </span>
                      </div>
                    ))}

                  {/* Exercise volume */}
                  <div className="mt-2 border-t border-zinc-800/30 pt-2 text-right">
                    <span className="text-xs text-zinc-600">
                      Volume:{' '}
                      {exercise.sets
                        .reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0)
                        .toLocaleString()}{' '}
                      kg
                    </span>
                  </div>
                </div>
              )}

              {exercise.notes && (
                <div className="border-t border-zinc-800/30 px-4 py-2">
                  <p className="text-xs text-zinc-500">{exercise.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

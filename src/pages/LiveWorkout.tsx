import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Clock, Calendar, Tag, Dumbbell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { CardioExerciseCard } from '@/components/workout/CardioExerciseCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import {
  useSession,
  useLastSessionForTemplate,
  useExercises,
  useTemplate,
  updateSession,
  completeSession,
  cancelSession,
} from '@/hooks/useWorkout';
import {
  type WorkoutSessionExercise,
  type SessionTag,
  SESSION_TAG_LABELS,
  SESSION_TAG_COLORS,
} from '@/db/types';

export function LiveWorkout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useSession(id);
  const template = useTemplate(session?.templateId);
  const prevSession = useLastSessionForTemplate(session?.templateId);
  const exercises = useExercises();
  const [elapsed, setElapsed] = useState(0);
  const [showFinishSheet, setShowFinishSheet] = useState(false);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [showReplaceSheet, setShowReplaceSheet] = useState<number | null>(null);
  const [sessionNote, setSessionNote] = useState('');

  // Elapsed timer (skip for manual entries)
  useEffect(() => {
    if (!session || session.status !== 'active' || session.manualEntry) return;
    const start = new Date(session.startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Build previous exercise map
  const prevExerciseMap = useMemo(() => {
    if (!prevSession) return new Map<string, WorkoutSessionExercise>();
    const map = new Map<string, WorkoutSessionExercise>();
    for (const ex of prevSession.exercises) {
      map.set(ex.exerciseId, ex);
    }
    return map;
  }, [prevSession]);

  // ── All hooks MUST be above the early return ──────────

  const sessionExercises = session?.exercises ?? [];

  const completedSetsCount = sessionExercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );
  const totalSetsCount = sessionExercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const progress = totalSetsCount > 0 ? completedSetsCount / totalSetsCount : 0;
  const progressPct = Math.round(progress * 100);
  const isComplete = progress === 1 && totalSetsCount > 0;

  // Total weight moved (working sets + warm-up sets)
  const totalWeightMoved = useMemo(() => {
    return sessionExercises.reduce((total, ex) => {
      if (ex.skipped) return total;
      const working = ex.sets.reduce(
        (acc, s) => acc + (s.completed ? (s.weight ?? 0) * (s.reps ?? 0) : 0),
        0
      );
      const warmup = (ex.warmupSets ?? []).reduce(
        (acc, ws) => acc + (ws.weight ?? 0) * (ws.reps ?? 0),
        0
      );
      return total + working + warmup;
    }, 0);
  }, [sessionExercises]);

  // Previous session total weight for comparison
  const prevTotalWeightMoved = useMemo(() => {
    if (!prevSession) return null;
    return prevSession.exercises.reduce((total, ex) => {
      if (ex.skipped) return total;
      const working = ex.sets.reduce(
        (acc, s) => acc + (s.completed ? (s.weight ?? 0) * (s.reps ?? 0) : 0),
        0
      );
      const warmup = (ex.warmupSets ?? []).reduce(
        (acc, ws) => acc + (ws.weight ?? 0) * (ws.reps ?? 0),
        0
      );
      return total + working + warmup;
    }, 0);
  }, [prevSession]);

  // Celebration on 100% completion
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (isComplete) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    } else {
      setShowConfetti(false);
    }
  }, [isComplete]);

  const completionMessage = useMemo(() => {
    if (!session) return '';
    const messages = ['Workout crushed', 'Another one in the bag', 'Great session', 'All sets done', 'Beast mode'];
    const hash = session.id.charCodeAt(0) + session.id.charCodeAt(session.id.length - 1);
    return messages[hash % messages.length];
  }, [session?.id]);

  // ── Early return AFTER all hooks ──────────────────────

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-zinc-500">Loading workout...</p>
      </div>
    );
  }

  const formatElapsed = () => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleExerciseChange = async (index: number, updated: WorkoutSessionExercise) => {
    const newExercises = [...session.exercises];
    newExercises[index] = updated;
    await updateSession({ ...session, exercises: newExercises });
  };

  const handleSkipExercise = async (index: number) => {
    const reason = prompt('Reason for skipping? (optional)');
    const newExercises = [...session.exercises];
    newExercises[index] = {
      ...newExercises[index],
      skipped: true,
      skipReason: reason || undefined,
    };
    await updateSession({ ...session, exercises: newExercises });
  };

  const handleReplaceExercise = async (exerciseIndex: number, newExerciseId: string) => {
    const newExercise = exercises.find((e) => e.id === newExerciseId);
    if (!newExercise) return;
    const newExercises = [...session.exercises];
    newExercises[exerciseIndex] = {
      ...newExercises[exerciseIndex],
      replacedWithExerciseId: newExerciseId,
      replacedWithExerciseName: newExercise.name,
    };
    await updateSession({ ...session, exercises: newExercises });
    setShowReplaceSheet(null);
  };

  const handleToggleTag = async (tag: SessionTag) => {
    const newTags = session.tags.includes(tag)
      ? session.tags.filter((t) => t !== tag)
      : [...session.tags, tag];
    await updateSession({ ...session, tags: newTags });
  };

  const handleFinish = async () => {
    if (sessionNote) {
      await updateSession({ ...session, notes: sessionNote });
    }
    await completeSession(session.id);
    navigate('/');
  };

  const handleCancel = async () => {
    if (confirm('Cancel this workout? Data will be lost.')) {
      await cancelSession(session.id);
      navigate('/');
    }
  };

  // Get template notes for each exercise
  const getTemplateNotes = (templateExerciseId: string) => {
    return template?.exercises.find((te) => te.id === templateExerciseId);
  };

  return (
    <div className="min-h-dvh pb-32">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b border-zinc-800/50 bg-zinc-950/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-full p-1.5 text-zinc-400 active:text-zinc-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-200">{session.templateName}</p>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              {session.manualEntry ? (
                <>
                  <Calendar className="h-3 w-3" />
                  {format(new Date(session.startedAt), 'MMM d, yyyy')}
                  {session.duration ? ` · ${Math.round(session.duration / 60)} min` : ''}
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  {formatElapsed()}
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowFinishSheet(true)}
            className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 active:bg-emerald-500/25"
          >
            Finish
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-800">
          <div
            className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-400' : 'bg-white'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tags quick-add */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
        <button
          onClick={() => setShowTagSheet(true)}
          className="flex-shrink-0 rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 active:border-zinc-600"
        >
          <Tag className="inline h-3 w-3 mr-1" />
          Tags
        </button>
        {session.tags.map((tag) => (
          <Badge
            key={tag}
            className={`flex-shrink-0 ${SESSION_TAG_COLORS[tag]}`}
            onClick={() => handleToggleTag(tag)}
          >
            {SESSION_TAG_LABELS[tag]}
          </Badge>
        ))}
      </div>

      {/* Completion banner */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="mx-4 mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/5 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
            <p className="text-sm font-semibold text-emerald-400 relative">{completionMessage}</p>
            <p className="mt-0.5 text-xs text-emerald-500/60 relative">100% complete</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise list */}
      <div className="space-y-3 px-4">
        {session.exercises.map((exercise, index) => {
          const te = getTemplateNotes(exercise.templateExerciseId);
          return exercise.exerciseType === 'cardio' ? (
            <CardioExerciseCard
              key={exercise.id}
              exercise={exercise}
              templateNotes={te?.notes}
              onChange={(updated) => handleExerciseChange(index, updated)}
              onSkip={() => handleSkipExercise(index)}
              onReplace={() => setShowReplaceSheet(index)}
            />
          ) : (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              prevExercise={prevExerciseMap.get(exercise.exerciseId) ?? null}
              templateNotes={te?.notes}
              machineSetup={te?.machineSetup}
              onChange={(updated) => handleExerciseChange(index, updated)}
              onSkip={() => handleSkipExercise(index)}
              onReplace={() => setShowReplaceSheet(index)}
            />
          );
        })}
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800/50 bg-zinc-950/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-lg flex items-center justify-between gap-3 px-4 py-3">
          <Button variant="danger" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <div className="text-center">
            <p className={`text-xs font-medium ${isComplete ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {completedSetsCount}/{totalSetsCount} sets · {progressPct}%
            </p>
            {totalWeightMoved > 0 && (
              <p className="text-[10px] text-zinc-500 flex items-center justify-center gap-1">
                <Dumbbell className="h-2.5 w-2.5" />
                {totalWeightMoved >= 1000
                  ? `${(totalWeightMoved / 1000).toFixed(1)}t`
                  : `${Math.round(totalWeightMoved).toLocaleString()} kg`}
                {prevTotalWeightMoved != null && prevTotalWeightMoved > 0 && (() => {
                  const diff = totalWeightMoved - prevTotalWeightMoved;
                  if (diff === 0) return null;
                  const formatted = Math.abs(diff) >= 1000
                    ? `${(Math.abs(diff) / 1000).toFixed(1)}t`
                    : `${Math.round(Math.abs(diff))}kg`;
                  return (
                    <span className={diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {diff > 0 ? '+' : '−'}{formatted}
                    </span>
                  );
                })()}
              </p>
            )}
          </div>
          <Button size="sm" onClick={() => setShowFinishSheet(true)}>
            <Check className="h-4 w-4" />
            Finish
          </Button>
        </div>
      </div>

      {/* Tag selector sheet */}
      <Sheet open={showTagSheet} onClose={() => setShowTagSheet(false)} title="Session Tags">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SESSION_TAG_LABELS) as SessionTag[]).map((tag) => (
            <button
              key={tag}
              onClick={() => handleToggleTag(tag)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-all ${
                session.tags.includes(tag)
                  ? SESSION_TAG_COLORS[tag]
                  : 'bg-zinc-800/50 text-zinc-500'
              }`}
            >
              {SESSION_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Replace exercise sheet */}
      <Sheet
        open={showReplaceSheet !== null}
        onClose={() => setShowReplaceSheet(null)}
        title="Replace Exercise"
      >
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => showReplaceSheet !== null && handleReplaceExercise(showReplaceSheet, ex.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-4 py-3 text-left active:bg-zinc-800/50"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-200">{ex.name}</p>
                <p className="text-xs text-zinc-500 capitalize">{ex.primaryMuscle}</p>
              </div>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Finish workout sheet */}
      <Sheet open={showFinishSheet} onClose={() => setShowFinishSheet(false)} title="Finish Workout">
        <div className="space-y-4">
          <div className="rounded-xl bg-zinc-800/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Duration</span>
              <span className="font-semibold text-zinc-200">
                {session.manualEntry && session.duration
                  ? `${Math.round(session.duration / 60)} min`
                  : formatElapsed()}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Sets completed</span>
              <span className="font-semibold text-zinc-200">
                {completedSetsCount} / {totalSetsCount}
              </span>
            </div>
            {totalWeightMoved > 0 && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Total weight</span>
                <span className="font-semibold text-zinc-200">
                  {totalWeightMoved >= 1000
                    ? `${(totalWeightMoved / 1000).toFixed(1)}t`
                    : `${Math.round(totalWeightMoved).toLocaleString()} kg`}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500">Workout notes</label>
            <textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="How did it go? Any observations?"
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 resize-none"
            />
          </div>

          <Button variant="primary" fullWidth size="lg" onClick={handleFinish}>
            <Check className="h-5 w-5" />
            Complete Workout
          </Button>
        </div>
      </Sheet>

      {/* Celebration confetti */}
      <AnimatePresence>
        {showConfetti && <ConfettiBurst />}
      </AnimatePresence>
    </div>
  );
}

// ─── Confetti burst ────────────────────────────────────

const CONFETTI_COLORS = ['#10b981', '#fbbf24', '#d4d4d8', '#a78bfa', '#34d399', '#f59e0b'];

function ConfettiBurst() {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 280,
        y: (Math.random() - 0.5) * 350 - 60,
        rotate: Math.random() * 360,
        scale: Math.random() * 0.6 + 0.4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 0.15,
        size: Math.random() > 0.5 ? 'h-2 w-2' : 'h-1.5 w-1.5',
      })),
    []
  );

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: p.scale, rotate: p.rotate }}
          transition={{ duration: 1.4, delay: p.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={`absolute rounded-full ${p.size}`}
          style={{ backgroundColor: p.color }}
        />
      ))}
    </motion.div>
  );
}

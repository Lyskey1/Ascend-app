import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { WorkoutSession, WorkoutTemplate, SetProgressComparison } from '@/db/types';

const LS_TEMPLATE_ORDER = 'iron_template_order';

export function loadTemplateOrder(): string[] {
  try {
    const v = localStorage.getItem(LS_TEMPLATE_ORDER);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

export function saveTemplateOrder(order: string[]) {
  localStorage.setItem(LS_TEMPLATE_ORDER, JSON.stringify(order));
}

export function useTemplates() {
  const raw = useLiveQuery(() => db.templates.toArray()) ?? [];
  const order = loadTemplateOrder();
  if (order.length === 0) return raw;
  const orderMap = new Map(order.map((id, idx) => [id, idx]));
  return [...raw].sort((a, b) => {
    const oa = orderMap.get(a.id) ?? 99999;
    const ob = orderMap.get(b.id) ?? 99999;
    return oa - ob;
  });
}

export function useTemplate(id: string | undefined) {
  return useLiveQuery(() => (id ? db.templates.get(id) : undefined), [id]);
}

export function useSessions(limit?: number) {
  return (
    useLiveQuery(() =>
      db.sessions
        .where('status')
        .equals('completed')
        .reverse()
        .sortBy('startedAt')
        .then((s) => (limit ? s.slice(0, limit) : s))
    ) ?? []
  );
}

export function useActiveSession() {
  return useLiveQuery(() =>
    db.sessions.where('status').equals('active').first()
  );
}

export function useSession(id: string | undefined) {
  return useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id]);
}

export function useExercises() {
  return useLiveQuery(() => db.exercises.toArray()) ?? [];
}

export function useExercise(id: string | undefined) {
  return useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id]);
}

export function useBodyweightEntries() {
  return useLiveQuery(() => db.bodyweight.orderBy('date').reverse().toArray()) ?? [];
}

export function usePersonalRecords(limit?: number) {
  return (
    useLiveQuery(() =>
      db.records
        .reverse()
        .sortBy('date')
        .then((r) => (limit ? r.slice(0, limit) : r))
    ) ?? []
  );
}

/**
 * Get the last completed session for a given template
 */
export function useLastSessionForTemplate(templateId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!templateId) return undefined;
      const sessions = await db.sessions
        .where('templateId')
        .equals(templateId)
        .filter((s) => s.status === 'completed')
        .reverse()
        .sortBy('startedAt');
      return sessions[0];
    },
    [templateId]
  );
}

/**
 * Compare a single set's weight and reps against the previous set.
 *
 * Weight comparison: straightforward higher/lower/same.
 * Reps comparison: only meaningful when the weight is identical.
 *   – If weight changed, reps stays 'none' (neutral) because a weight
 *     increase naturally lowers reps and shouldn't penalize.
 */
export function compareSetProgress(
  currentWeight: number | null,
  currentReps: number | null,
  prevWeight: number | null,
  prevReps: number | null,
): SetProgressComparison {
  const result: SetProgressComparison = {
    weight: 'none',
    reps: 'none',
    weightDiff: null,
    repsDiff: null,
  };

  if (currentWeight == null || prevWeight == null) return result;

  // Weight comparison
  if (currentWeight > prevWeight) {
    result.weight = 'up';
    result.weightDiff = currentWeight - prevWeight;
  } else if (currentWeight < prevWeight) {
    result.weight = 'down';
    result.weightDiff = currentWeight - prevWeight;
  } else {
    result.weight = 'same';
    result.weightDiff = 0;
  }

  // Reps comparison — only when weight is the same
  if (currentReps != null && prevReps != null && currentWeight === prevWeight) {
    if (currentReps > prevReps) {
      result.reps = 'up';
      result.repsDiff = currentReps - prevReps;
    } else if (currentReps < prevReps) {
      result.reps = 'down';
      result.repsDiff = currentReps - prevReps;
    } else {
      result.reps = 'same';
      result.repsDiff = 0;
    }
  }

  return result;
}

function buildSessionExercises(
  templateExercises: WorkoutTemplate['exercises'],
  exerciseMap: Map<string, import('@/db/types').Exercise>
): WorkoutSession['exercises'] {
  return templateExercises.map((te) => {
    const ex = exerciseMap.get(te.exerciseId);
    const isCardio = ex?.exerciseType === 'cardio';
    return {
      id: crypto.randomUUID(),
      exerciseId: te.exerciseId,
      exerciseName: ex?.name ?? 'Unknown',
      templateExerciseId: te.id,
      order: te.order,
      sets: isCardio
        ? []
        : Array.from({ length: te.targetSets }, (_, i) => ({
            id: crypto.randomUUID(),
            setNumber: i + 1,
            weight: null,
            reps: null,
            completed: false,
          })),
      skipped: false,
      targetSets: te.targetSets,
      targetRepsMin: te.targetRepsMin,
      targetRepsMax: te.targetRepsMax,
      restSeconds: te.restSeconds,
      exerciseType: ex?.exerciseType,
      ...(isCardio
        ? {
            cardioDuration: te.cardioDuration,
            cardioDistance: te.cardioDistance,
            cardioPace: te.cardioPace,
            cardioIntensity: te.cardioIntensity,
          }
        : {}),
    };
  });
}

export async function startWorkoutSession(template: WorkoutTemplate): Promise<string> {
  const exerciseList = await db.exercises.toArray();
  const exerciseMap = new Map(exerciseList.map((e) => [e.id, e]));

  const session: WorkoutSession = {
    id: crypto.randomUUID(),
    templateId: template.id,
    templateName: template.name,
    startedAt: new Date().toISOString(),
    exercises: buildSessionExercises(template.exercises, exerciseMap),
    tags: [],
    status: 'active',
  };

  await db.sessions.add(session);
  return session.id;
}

export async function startPastWorkoutSession(
  template: WorkoutTemplate,
  startedAt: string,
  durationMinutes: number
): Promise<string> {
  const exerciseList = await db.exercises.toArray();
  const exerciseMap = new Map(exerciseList.map((e) => [e.id, e]));

  const session: WorkoutSession = {
    id: crypto.randomUUID(),
    templateId: template.id,
    templateName: template.name,
    startedAt,
    duration: durationMinutes * 60,
    exercises: buildSessionExercises(template.exercises, exerciseMap),
    tags: [],
    status: 'active',
    manualEntry: true,
  };

  await db.sessions.add(session);
  return session.id;
}

export async function updateSession(session: WorkoutSession) {
  await db.sessions.put(session);
}

export async function completeSession(sessionId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;

  let completedAt: string;
  let duration: number;

  if (session.manualEntry) {
    duration = session.duration ?? 0;
    completedAt = new Date(
      new Date(session.startedAt).getTime() + duration * 1000
    ).toISOString();
  } else {
    completedAt = new Date().toISOString();
    duration = Math.round(
      (new Date(completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
    );
  }

  await db.sessions.update(sessionId, {
    status: 'completed',
    completedAt,
    duration,
  });

  // Check for PRs
  for (const ex of session.exercises) {
    if (ex.skipped) continue;
    for (const set of ex.sets) {
      if (!set.completed || !set.weight || !set.reps) continue;

      // Check max weight PR
      const existingWeightPR = await db.records
        .where('exerciseId')
        .equals(ex.exerciseId)
        .filter((r) => r.type === 'max_weight')
        .first();

      if (!existingWeightPR || set.weight > existingWeightPR.value) {
        await db.records.add({
          id: crypto.randomUUID(),
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          type: 'max_weight',
          value: set.weight,
          weight: set.weight,
          reps: set.reps,
          date: completedAt,
          sessionId,
        });
      }
    }

    // Check max volume PR
    const totalVolume = ex.sets.reduce(
      (sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0),
      0
    );
    if (totalVolume > 0) {
      const existingVolumePR = await db.records
        .where('exerciseId')
        .equals(ex.exerciseId)
        .filter((r) => r.type === 'max_volume')
        .first();

      if (!existingVolumePR || totalVolume > existingVolumePR.value) {
        await db.records.add({
          id: crypto.randomUUID(),
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          type: 'max_volume',
          value: totalVolume,
          date: completedAt,
          sessionId,
        });
      }
    }
  }
}

export async function cancelSession(sessionId: string) {
  await db.sessions.update(sessionId, { status: 'cancelled' });
}

export async function deleteSession(sessionId: string) {
  await db.sessions.delete(sessionId);
}

export async function addBodyweightEntry(
  weight: number,
  date?: string,
  note?: string,
  tags?: string[]
) {
  const { format } = await import('date-fns');
  await db.bodyweight.add({
    id: crypto.randomUUID(),
    date: date ?? format(new Date(), 'yyyy-MM-dd'),
    weight,
    note,
    tags,
  });
}

export async function updateBodyweightEntry(
  id: string,
  updates: Partial<Pick<import('@/db/types').BodyweightEntry, 'date' | 'weight' | 'note' | 'tags'>>
) {
  await db.bodyweight.update(id, updates);
}

export async function deleteBodyweightEntry(id: string) {
  await db.bodyweight.delete(id);
}

export async function getBodyweightEntriesByDate(date: string) {
  return db.bodyweight.where('date').equals(date).toArray();
}

// ─── Steps CRUD ─────────────────────────────────────────

export function useStepEntries() {
  return useLiveQuery(() => db.steps.orderBy('date').reverse().toArray()) ?? [];
}

export async function putStepEntry(date: string, stepCount: number, note?: string) {
  const entry: import('@/db/types').StepEntry = { date, stepCount };
  if (note) entry.note = note;
  await db.steps.put(entry);
}

export async function deleteStepEntry(date: string) {
  await db.steps.delete(date);
}

// ─── Sleep CRUD ─────────────────────────────────────────

export function useSleepEntries() {
  return useLiveQuery(() => db.sleep.orderBy('date').reverse().toArray()) ?? [];
}

export async function putSleepEntry(entry: import('@/db/types').SleepEntry) {
  await db.sleep.put(entry);
}

export async function deleteSleepEntry(date: string) {
  await db.sleep.delete(date);
}

export async function saveTemplate(template: WorkoutTemplate) {
  await db.templates.put(template);
}

export async function deleteTemplate(id: string) {
  await db.templates.delete(id);
}

export async function addCustomExercise(exercise: Omit<import('@/db/types').Exercise, 'id'>) {
  const id = crypto.randomUUID();
  await db.exercises.add({ ...exercise, id, isCustom: true });
  return id;
}

export async function deleteExercise(id: string) {
  await db.exercises.delete(id);
}

export async function updateExercise(id: string, updates: Partial<import('@/db/types').Exercise>) {
  await db.exercises.update(id, updates);
}

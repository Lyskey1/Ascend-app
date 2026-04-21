import { v4 as uuid } from 'uuid';
import { db } from './database';
import { EXERCISE_LIBRARY } from './exerciseLibrary';
import type {
  WorkoutTemplate,
  WorkoutSession,
  WorkoutSessionExercise,
  ExerciseSet,
  BodyweightEntry,
  PersonalRecord,
} from './types';
import { subDays, format } from 'date-fns';

// ─── Use the full exercise library ──────────────────────
const exercises = EXERCISE_LIBRARY;

// ─── Templates ───────────────────────────────────────────
const templates: WorkoutTemplate[] = [
  {
    id: 'tpl-upper-push',
    name: 'Upper Body — Chest Focus',
    day: ['Monday'],
    category: 'upper_push',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    exercises: [
      { id: 'te-1', exerciseId: 'ex-bench', order: 1, targetSets: 4, targetRepsMin: 6, targetRepsMax: 8, restSeconds: 180, notes: 'Focus on controlled eccentric, pause at chest', progressionNote: 'Add 2.5kg when hitting 4x8' },
      { id: 'te-2', exerciseId: 'ex-incline-bench', order: 2, targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, restSeconds: 120, notes: '30-degree incline, full stretch at bottom' },
      { id: 'te-3', exerciseId: 'ex-cable-fly', order: 3, targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, restSeconds: 90, notes: 'Squeeze at peak contraction for 1s', machineSetup: 'Cables at shoulder height' },
      { id: 'te-4', exerciseId: 'ex-dips', order: 4, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, restSeconds: 120, notes: 'Lean forward for chest emphasis', alternativeExerciseId: 'ex-pec-deck' },
      { id: 'te-5', exerciseId: 'ex-tricep-pushdown', order: 5, targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, restSeconds: 60, machineSetup: 'Rope attachment' },
      { id: 'te-6', exerciseId: 'ex-overhead-ext', order: 6, targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 60 },
      { id: 'te-7', exerciseId: 'ex-lateral-raise', order: 7, targetSets: 3, targetRepsMin: 15, targetRepsMax: 20, restSeconds: 60, notes: 'Light weight, controlled reps' },
    ],
  },
  {
    id: 'tpl-legs',
    name: 'Legs',
    day: ['Tuesday'],
    category: 'legs',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    exercises: [
      { id: 'te-10', exerciseId: 'ex-squat', order: 1, targetSets: 4, targetRepsMin: 6, targetRepsMax: 8, restSeconds: 180, notes: 'Below parallel, brace core tightly', progressionNote: 'Add 2.5kg when hitting 4x8' },
      { id: 'te-11', exerciseId: 'ex-leg-press', order: 2, targetSets: 4, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 120, machineSetup: 'Feet shoulder width, mid-platform' },
      { id: 'te-12', exerciseId: 'ex-rdl', order: 3, targetSets: 3, targetRepsMin: 8, targetRepsMax: 10, restSeconds: 120, notes: 'Slight knee bend, hinge at hips, feel hamstring stretch' },
      { id: 'te-13', exerciseId: 'ex-leg-curl', order: 4, targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 90, machineSetup: 'Pad above ankle' },
      { id: 'te-14', exerciseId: 'ex-leg-ext', order: 5, targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, restSeconds: 90, notes: 'Squeeze at top for 2s' },
      { id: 'te-15', exerciseId: 'ex-calf-raise', order: 6, targetSets: 4, targetRepsMin: 12, targetRepsMax: 15, restSeconds: 60, notes: 'Full stretch at bottom, pause at top' },
    ],
  },
  {
    id: 'tpl-upper-pull',
    name: 'Upper Body — Back Focus',
    day: ['Thursday'],
    category: 'upper_pull',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    exercises: [
      { id: 'te-20', exerciseId: 'ex-pullup', order: 1, targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, restSeconds: 120, notes: 'Full dead hang, chin over bar', progressionNote: 'Add weight belt when hitting 4x10' },
      { id: 'te-21', exerciseId: 'ex-barbell-row', order: 2, targetSets: 4, targetRepsMin: 8, targetRepsMax: 10, restSeconds: 120, notes: '45-degree torso angle, pull to lower chest' },
      { id: 'te-22', exerciseId: 'ex-cable-row', order: 3, targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 90, machineSetup: 'V-handle attachment' },
      { id: 'te-23', exerciseId: 'ex-face-pull', order: 4, targetSets: 3, targetRepsMin: 15, targetRepsMax: 20, restSeconds: 60, machineSetup: 'Rope at face height', notes: 'Pull to ears, external rotation at end' },
      { id: 'te-24', exerciseId: 'ex-barbell-curl', order: 5, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, restSeconds: 60, notes: 'No swinging, controlled negative' },
      { id: 'te-25', exerciseId: 'ex-hammer-curl', order: 6, targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 60 },
      { id: 'te-26', exerciseId: 'ex-rear-delt-fly', order: 7, targetSets: 3, targetRepsMin: 15, targetRepsMax: 20, restSeconds: 60 },
    ],
  },
  {
    id: 'tpl-shoulders-light-legs',
    name: 'Shoulders + Light Legs',
    day: ['Friday'],
    category: 'shoulders',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    exercises: [
      { id: 'te-30', exerciseId: 'ex-ohp', order: 1, targetSets: 4, targetRepsMin: 6, targetRepsMax: 8, restSeconds: 150, notes: 'Standing, tight core, full lockout' },
      { id: 'te-31', exerciseId: 'ex-arnold-press', order: 2, targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 90 },
      { id: 'te-32', exerciseId: 'ex-lateral-raise', order: 3, targetSets: 4, targetRepsMin: 12, targetRepsMax: 15, restSeconds: 60, notes: 'Slight lean forward, lead with elbows' },
      { id: 'te-33', exerciseId: 'ex-rear-delt-fly', order: 4, targetSets: 3, targetRepsMin: 15, targetRepsMax: 20, restSeconds: 60, machineSetup: 'Pec deck reversed' },
      { id: 'te-34', exerciseId: 'ex-walking-lunge', order: 5, targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, restSeconds: 90, notes: 'Each leg, controlled steps' },
      { id: 'te-35', exerciseId: 'ex-hip-thrust', order: 6, targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, restSeconds: 90, notes: 'Squeeze glutes at top for 2s' },
      { id: 'te-36', exerciseId: 'ex-hanging-leg-raise', order: 7, targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, restSeconds: 60 },
    ],
  },
  {
    id: 'tpl-cardio',
    name: 'Cardio',
    day: ['Wednesday'],
    category: 'cardio',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    exercises: [
      { id: 'te-40', exerciseId: 'ex-rowing', order: 1, targetSets: 1, targetRepsMin: 20, targetRepsMax: 20, restSeconds: 120, notes: '20 min steady-state, keep pace at 2:00/500m' },
      { id: 'te-41', exerciseId: 'ex-stairmaster', order: 2, targetSets: 1, targetRepsMin: 15, targetRepsMax: 15, restSeconds: 60, notes: '15 min intervals: 1 min fast / 1 min slow', machineSetup: 'Level 7-10' },
      { id: 'te-42', exerciseId: 'ex-incline-walking', order: 3, targetSets: 1, targetRepsMin: 15, targetRepsMax: 15, restSeconds: 60, notes: '15 min incline walk, 10-12% grade' },
      { id: 'te-43', exerciseId: 'ex-jump-rope', order: 4, targetSets: 1, targetRepsMin: 10, targetRepsMax: 10, restSeconds: 60, notes: '10 min jump rope, 30s on / 30s rest' },
    ],
  },
];

// ─── Helper to generate session data ─────────────────────
function makeSets(
  count: number,
  baseWeight: number,
  baseReps: number,
  variance: number = 1
): ExerciseSet[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(),
    setNumber: i + 1,
    weight: baseWeight,
    reps: Math.max(1, baseReps - Math.floor(Math.random() * variance) - (i > 2 ? 1 : 0)),
    completed: true,
  }));
}

function generateSessions(): WorkoutSession[] {
  const sessions: WorkoutSession[] = [];
  const now = new Date();

  // Training pattern: 4 sessions per week for 6 weeks
  const weeklyPattern = [
    { template: templates[0], dayOffset: 0 }, // Mon: Upper Push
    { template: templates[1], dayOffset: 1 }, // Tue: Legs
    { template: templates[4], dayOffset: 2 }, // Wed: Cardio
    { template: templates[2], dayOffset: 3 }, // Thu: Upper Pull
    { template: templates[3], dayOffset: 4 }, // Fri: Shoulders + Light Legs
  ];

  // Progressive weights over 6 weeks
  const progressions: Record<string, { baseWeight: number; weekIncrement: number; baseReps: number }> = {
    'ex-bench': { baseWeight: 70, weekIncrement: 2.5, baseReps: 7 },
    'ex-incline-bench': { baseWeight: 24, weekIncrement: 2, baseReps: 10 },
    'ex-cable-fly': { baseWeight: 15, weekIncrement: 1, baseReps: 13 },
    'ex-dips': { baseWeight: 0, weekIncrement: 0, baseReps: 10 },
    'ex-tricep-pushdown': { baseWeight: 25, weekIncrement: 1, baseReps: 12 },
    'ex-overhead-ext': { baseWeight: 20, weekIncrement: 1, baseReps: 11 },
    'ex-squat': { baseWeight: 80, weekIncrement: 2.5, baseReps: 7 },
    'ex-leg-press': { baseWeight: 160, weekIncrement: 5, baseReps: 11 },
    'ex-rdl': { baseWeight: 70, weekIncrement: 2.5, baseReps: 9 },
    'ex-leg-curl': { baseWeight: 40, weekIncrement: 2.5, baseReps: 11 },
    'ex-leg-ext': { baseWeight: 50, weekIncrement: 2.5, baseReps: 13 },
    'ex-calf-raise': { baseWeight: 80, weekIncrement: 5, baseReps: 14 },
    'ex-pullup': { baseWeight: 0, weekIncrement: 0, baseReps: 8 },
    'ex-barbell-row': { baseWeight: 60, weekIncrement: 2.5, baseReps: 9 },
    'ex-cable-row': { baseWeight: 50, weekIncrement: 2.5, baseReps: 11 },
    'ex-face-pull': { baseWeight: 15, weekIncrement: 1, baseReps: 17 },
    'ex-barbell-curl': { baseWeight: 30, weekIncrement: 1, baseReps: 10 },
    'ex-hammer-curl': { baseWeight: 14, weekIncrement: 1, baseReps: 11 },
    'ex-ohp': { baseWeight: 40, weekIncrement: 2.5, baseReps: 7 },
    'ex-arnold-press': { baseWeight: 18, weekIncrement: 1, baseReps: 11 },
    'ex-lateral-raise': { baseWeight: 8, weekIncrement: 0.5, baseReps: 14 },
    'ex-rear-delt-fly': { baseWeight: 10, weekIncrement: 0.5, baseReps: 17 },
    'ex-walking-lunge': { baseWeight: 16, weekIncrement: 2, baseReps: 13 },
    'ex-hip-thrust': { baseWeight: 60, weekIncrement: 5, baseReps: 11 },
    'ex-hanging-leg-raise': { baseWeight: 0, weekIncrement: 0, baseReps: 12 },
    'ex-cable-crunch': { baseWeight: 30, weekIncrement: 2, baseReps: 17 },
    'ex-rowing': { baseWeight: 0, weekIncrement: 0, baseReps: 20 },
    'ex-stairmaster': { baseWeight: 0, weekIncrement: 0, baseReps: 15 },
    'ex-pec-deck': { baseWeight: 45, weekIncrement: 2, baseReps: 12 },
    'ex-tbar-row': { baseWeight: 40, weekIncrement: 2.5, baseReps: 9 },
    'ex-lat-pulldown': { baseWeight: 55, weekIncrement: 2.5, baseReps: 10 },
  };

  for (let week = 5; week >= 0; week--) {
    for (const { template, dayOffset } of weeklyPattern) {
      // Skip some workouts randomly for realism
      if (week > 0 && Math.random() < 0.08) continue;

      const daysAgo = week * 7 + (4 - dayOffset);
      const sessionDate = subDays(now, daysAgo);
      const startHour = 7 + Math.floor(Math.random() * 2);
      const startMin = Math.floor(Math.random() * 30);
      const startedAt = new Date(sessionDate);
      startedAt.setHours(startHour, startMin, 0, 0);
      const duration = 45 * 60 + Math.floor(Math.random() * 30) * 60; // 45–75 min

      const sessionExercises: WorkoutSessionExercise[] = template.exercises.map((te) => {
        const prog = progressions[te.exerciseId] || { baseWeight: 20, weekIncrement: 1, baseReps: 10 };
        const currentWeight = prog.baseWeight + prog.weekIncrement * (5 - week);
        return {
          id: uuid(),
          exerciseId: te.exerciseId,
          exerciseName: exercises.find((e) => e.id === te.exerciseId)!.name,
          templateExerciseId: te.id,
          order: te.order,
          sets: makeSets(te.targetSets, currentWeight, prog.baseReps, 2),
          skipped: false,
          targetSets: te.targetSets,
          targetRepsMin: te.targetRepsMin,
          targetRepsMax: te.targetRepsMax,
          restSeconds: te.restSeconds,
        };
      });

      const tags: WorkoutSession['tags'] = [];
      if (Math.random() < 0.3) tags.push('good_energy');
      if (Math.random() < 0.15) tags.push('bad_sleep');
      if (Math.random() < 0.1) tags.push('great_pump');

      sessions.push({
        id: uuid(),
        templateId: template.id,
        templateName: template.name,
        startedAt: startedAt.toISOString(),
        completedAt: new Date(startedAt.getTime() + duration * 1000).toISOString(),
        duration,
        exercises: sessionExercises,
        tags,
        status: 'completed',
      });
    }
  }

  return sessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

function generateBodyweight(): BodyweightEntry[] {
  const entries: BodyweightEntry[] = [];
  const now = new Date();
  let weight = 82.5;

  for (let day = 90; day >= 0; day--) {
    // ~5 entries per week
    if (Math.random() < 0.3 && day > 0) continue;

    const date = subDays(now, day);
    weight += (Math.random() - 0.52) * 0.4; // slight downward trend
    weight = Math.round(weight * 10) / 10;

    entries.push({
      id: uuid(),
      date: format(date, 'yyyy-MM-dd'),
      weight: Math.max(75, Math.min(90, weight)),
    });
  }

  return entries;
}

function generatePRs(sessions: WorkoutSession[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const bestByExercise: Record<string, { weight: number; reps: number; volume: number }> = {};

  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (!bestByExercise[ex.exerciseId]) {
        bestByExercise[ex.exerciseId] = { weight: 0, reps: 0, volume: 0 };
      }
      const best = bestByExercise[ex.exerciseId];
      let sessionVolume = 0;

      for (const set of ex.sets) {
        if (!set.weight || !set.reps) continue;
        sessionVolume += set.weight * set.reps;

        if (set.weight > best.weight) {
          best.weight = set.weight;
          records.push({
            id: uuid(),
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            type: 'max_weight',
            value: set.weight,
            weight: set.weight,
            reps: set.reps,
            date: session.startedAt,
            sessionId: session.id,
          });
        }
      }

      if (sessionVolume > best.volume) {
        best.volume = sessionVolume;
        records.push({
          id: uuid(),
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          type: 'max_volume',
          value: sessionVolume,
          date: session.startedAt,
          sessionId: session.id,
        });
      }
    }
  }

  return records;
}

export async function seedDatabase() {
  const count = await db.exercises.count();
  if (count > 0) return; // Already seeded

  const sessions = generateSessions();
  const bodyweightEntries = generateBodyweight();
  const prs = generatePRs(sessions);

  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.bodyweight, db.records], async () => {
    await db.exercises.bulkAdd(exercises);
    await db.templates.bulkAdd(templates);
    await db.sessions.bulkAdd(sessions);
    await db.bodyweight.bulkAdd(bodyweightEntries);
    await db.records.bulkAdd(prs);
  });

  console.log(`Seeded: ${exercises.length} exercises, ${templates.length} templates, ${sessions.length} sessions, ${bodyweightEntries.length} bodyweight entries, ${prs.length} PRs`);
}

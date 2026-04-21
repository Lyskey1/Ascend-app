import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutSession,
  BodyweightEntry,
  PersonalRecord,
  TrashItem,
  StepEntry,
  SleepEntry,
} from './types';

export class IronDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;
  sessions!: Table<WorkoutSession, string>;
  bodyweight!: Table<BodyweightEntry, string>;
  records!: Table<PersonalRecord, string>;
  trash!: Table<TrashItem, string>;
  steps!: Table<StepEntry, string>;
  sleep!: Table<SleepEntry, string>;

  constructor() {
    super('IronDB');
    this.version(1).stores({
      exercises: 'id, name, primaryMuscle, category',
      templates: 'id, name, category, day',
      sessions: 'id, templateId, startedAt, status',
      bodyweight: 'id, date',
      records: 'id, exerciseId, type, date',
    });

    this.version(2).stores({
      exercises: 'id, name, primaryMuscle, category',
      templates: 'id, name, category, day',
      sessions: 'id, templateId, startedAt, status',
      bodyweight: 'id, date',
      records: 'id, exerciseId, type, date',
    }).upgrade(async (tx) => {
      const { EXERCISE_LIBRARY } = await import('./exerciseLibrary');
      const existing = await tx.table('exercises').toArray();
      const existingIds = new Set(existing.map((e: { id: string }) => e.id));
      const newExercises = EXERCISE_LIBRARY.filter((e) => !existingIds.has(e.id));
      if (newExercises.length > 0) {
        await tx.table('exercises').bulkAdd(newExercises);
      }
    });

    this.version(3).stores({
      exercises: 'id, name, primaryMuscle, category',
      templates: 'id, name, category, *day',
      sessions: 'id, templateId, startedAt, status',
      bodyweight: 'id, date',
      records: 'id, exerciseId, type, date',
    }).upgrade(async (tx) => {
      // Migrate day from string to string[]
      await tx.table('templates').toCollection().modify((template: Record<string, unknown>) => {
        if (typeof template.day === 'string') {
          template.day = template.day ? [template.day] : [];
        } else if (!template.day) {
          template.day = [];
        }
      });

      // Merge new exercises from expanded library
      const { EXERCISE_LIBRARY } = await import('./exerciseLibrary');
      const existing = await tx.table('exercises').toArray();
      const existingIds = new Set(existing.map((e: { id: string }) => e.id));
      const newExercises = EXERCISE_LIBRARY.filter((e) => !existingIds.has(e.id));
      if (newExercises.length > 0) {
        await tx.table('exercises').bulkAdd(newExercises);
      }

      // Update existing exercises with new data (renamed exercises, new secondary muscles)
      for (const libEx of EXERCISE_LIBRARY) {
        if (existingIds.has(libEx.id)) {
          await tx.table('exercises').update(libEx.id, {
            name: libEx.name,
            secondaryMuscles: libEx.secondaryMuscles,
          });
        }
      }
    });

    this.version(4).stores({
      exercises: 'id, name, primaryMuscle, category',
      templates: 'id, name, category, *day',
      sessions: 'id, templateId, startedAt, status',
      bodyweight: 'id, date',
      records: 'id, exerciseId, type, date',
      trash: 'id, itemType, deletedAt',
    });

    this.version(5).stores({
      exercises: 'id, name, primaryMuscle, category',
      templates: 'id, name, category, *day',
      sessions: 'id, templateId, startedAt, status',
      bodyweight: 'id, date',
      records: 'id, exerciseId, type, date',
      trash: 'id, itemType, deletedAt',
      steps: '&date',
      sleep: '&date',
    });
  }
}

export const db = new IronDB();

// ─── Exercise library sync ─────────────────────────────
// Runs on every app start. Dexie upgrade handlers use dynamic imports
// which can silently fail, so this ensures the full library is always
// present regardless of migration state.

const LIBRARY_VERSION_KEY = 'iron_exercise_library_v';
const CURRENT_LIBRARY_VERSION = '3'; // bump when exerciseLibrary.ts changes

export async function syncExerciseLibrary() {
  const stored = localStorage.getItem(LIBRARY_VERSION_KEY);
  if (stored === CURRENT_LIBRARY_VERSION) return;

  const { EXERCISE_LIBRARY } = await import('./exerciseLibrary');
  const existing = await db.exercises.toArray();
  const existingMap = new Map(existing.map((e) => [e.id, e]));

  // Add missing exercises
  const missing = EXERCISE_LIBRARY.filter((e) => !existingMap.has(e.id));
  if (missing.length > 0) {
    await db.exercises.bulkAdd(missing);
  }

  // Update non-custom library exercises with latest data (names, muscles, category)
  await db.transaction('rw', db.exercises, async () => {
    for (const libEx of EXERCISE_LIBRARY) {
      const ex = existingMap.get(libEx.id);
      if (ex && !ex.isCustom) {
        await db.exercises.update(libEx.id, {
          name: libEx.name,
          primaryMuscle: libEx.primaryMuscle,
          secondaryMuscles: libEx.secondaryMuscles,
          category: libEx.category,
          exerciseType: libEx.exerciseType,
        });
      }
    }
  });

  localStorage.setItem(LIBRARY_VERSION_KEY, CURRENT_LIBRARY_VERSION);
}

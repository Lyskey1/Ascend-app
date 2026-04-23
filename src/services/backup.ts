import { db } from '@/db/database';

// ─── Backup format ──────────────────────────────────────

export interface BackupFile {
  app: 'ascend-app';
  backupVersion: 1;
  createdAt: string;
  dexie: {
    exercises: unknown[];
    templates: unknown[];
    sessions: unknown[];
    bodyweight: unknown[];
    records: unknown[];
    trash: unknown[];
    steps: unknown[];
    sleep: unknown[];
  };
  localStorage: Record<string, string | null>;
}

// All localStorage keys the app uses
const LS_KEYS = [
  'iron_theme',
  'iron_template_order',
  'iron_exercise_order',
  'iron_program_groups',
  'iron_program_start',
  'iron_rest_day',
  'iron_vacations',
  'iron_bw_target_range',
  'iron_bw_tag_configs',
  'iron_bw_custom_tags',
  'iron_bw_chart_mode',
  'iron_exercise_library_v',
];

// ─── Export ─────────────────────────────────────────────

export async function createBackup(): Promise<BackupFile> {
  const [exercises, templates, sessions, bodyweight, records, trash, steps, sleep] =
    await Promise.all([
      db.exercises.toArray(),
      db.templates.toArray(),
      db.sessions.toArray(),
      db.bodyweight.toArray(),
      db.records.toArray(),
      db.trash.toArray(),
      db.steps.toArray(),
      db.sleep.toArray(),
    ]);

  const lsData: Record<string, string | null> = {};
  for (const key of LS_KEYS) {
    lsData[key] = localStorage.getItem(key);
  }

  return {
    app: 'ascend-app',
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    dexie: { exercises, templates, sessions, bodyweight, records, trash, steps, sleep },
    localStorage: lsData,
  };
}

export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const filename = `ascend-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Validation ─────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
  stats?: {
    exercises: number;
    templates: number;
    sessions: number;
    bodyweight: number;
    records: number;
    trash: number;
    steps: number;
    sleep: number;
    localStorageKeys: number;
    createdAt: string;
  };
}

export function validateBackup(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File does not contain valid JSON.' };
  }

  const obj = data as Record<string, unknown>;

  if (obj.app !== 'ascend-app') {
    return { valid: false, error: 'Not an ASCEND backup file.' };
  }

  if (obj.backupVersion !== 1) {
    return { valid: false, error: `Unsupported backup version: ${obj.backupVersion}` };
  }

  if (!obj.dexie || typeof obj.dexie !== 'object') {
    return { valid: false, error: 'Backup file is missing database data.' };
  }

  const dexie = obj.dexie as Record<string, unknown>;
  const requiredTables = ['exercises', 'templates', 'sessions', 'bodyweight', 'records', 'trash', 'steps', 'sleep'];

  for (const table of requiredTables) {
    if (!Array.isArray(dexie[table])) {
      return { valid: false, error: `Missing or invalid table: ${table}` };
    }
  }

  const ls = obj.localStorage;
  if (!ls || typeof ls !== 'object') {
    return { valid: false, error: 'Backup file is missing localStorage data.' };
  }

  return {
    valid: true,
    stats: {
      exercises: (dexie.exercises as unknown[]).length,
      templates: (dexie.templates as unknown[]).length,
      sessions: (dexie.sessions as unknown[]).length,
      bodyweight: (dexie.bodyweight as unknown[]).length,
      records: (dexie.records as unknown[]).length,
      trash: (dexie.trash as unknown[]).length,
      steps: (dexie.steps as unknown[]).length,
      sleep: (dexie.sleep as unknown[]).length,
      localStorageKeys: Object.values(ls as Record<string, unknown>).filter((v) => v !== null).length,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : 'Unknown',
    },
  };
}

// ─── Import ─────────────────────────────────────────────

export async function restoreBackup(backup: BackupFile): Promise<void> {
  const { dexie, localStorage: lsData } = backup;

  // Clear all tables and repopulate in a single transaction
  await db.transaction(
    'rw',
    [db.exercises, db.templates, db.sessions, db.bodyweight, db.records, db.trash, db.steps, db.sleep],
    async () => {
      // Clear all tables
      await Promise.all([
        db.exercises.clear(),
        db.templates.clear(),
        db.sessions.clear(),
        db.bodyweight.clear(),
        db.records.clear(),
        db.trash.clear(),
        db.steps.clear(),
        db.sleep.clear(),
      ]);

      // Restore all tables
      if (dexie.exercises.length) await db.exercises.bulkAdd(dexie.exercises as never[]);
      if (dexie.templates.length) await db.templates.bulkAdd(dexie.templates as never[]);
      if (dexie.sessions.length) await db.sessions.bulkAdd(dexie.sessions as never[]);
      if (dexie.bodyweight.length) await db.bodyweight.bulkAdd(dexie.bodyweight as never[]);
      if (dexie.records.length) await db.records.bulkAdd(dexie.records as never[]);
      if (dexie.trash.length) await db.trash.bulkAdd(dexie.trash as never[]);
      if (dexie.steps.length) await db.steps.bulkAdd(dexie.steps as never[]);
      if (dexie.sleep.length) await db.sleep.bulkAdd(dexie.sleep as never[]);
    }
  );

  // Restore localStorage
  for (const key of LS_KEYS) {
    const value = lsData[key];
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  }
}

// ─── Read file helper ───────────────────────────────────

export function readFileAsJSON(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch {
        reject(new Error('File is not valid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

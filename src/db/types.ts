export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'cardio'
  | 'full_body';

export type WorkoutCategory =
  | 'upper_push'
  | 'upper_pull'
  | 'legs'
  | 'shoulders'
  | 'cardio'
  | 'full_body'
  | 'rest'
  | 'custom';

export type SessionTag =
  | 'good_energy'
  | 'bad_sleep'
  | 'travel'
  | 'stomach_issues'
  | 'stress'
  | 'great_pump'
  | 'low_motivation'
  | 'gym_crowded'
  | 'different_gym'
  | 'pain_discomfort'
  | 'deload'
  | 'pr_day';

export type PRType = 'max_weight' | 'max_reps' | 'max_volume' | 'max_session_volume';

export type ExerciseType = 'compound' | 'isolation' | 'cardio' | 'bodyweight' | 'mobility';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscle?: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  category: WorkoutCategory;
  exerciseType?: ExerciseType;
  isCustom?: boolean;
  sortOrder?: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'gif' | 'video';
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  emoji?: string;
  day?: string[];
  category: WorkoutCategory;
  exercises: WorkoutTemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds: number;
  warmup?: string;
  notes?: string;
  machineSetup?: string;
  alternativeExerciseId?: string;
  progressionNote?: string;
  // Cardio-specific fields
  cardioDuration?: number; // minutes
  cardioDistance?: number; // km
  cardioPace?: string; // e.g. "5:30/km", "easy", "zone 3"
  cardioIntensity?: 'very_easy' | 'easy' | 'moderate' | 'hard' | 'very_hard' | 'intervals';
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: string;
  completedAt?: string;
  duration?: number; // seconds
  exercises: WorkoutSessionExercise[];
  notes?: string;
  tags: SessionTag[];
  status: 'active' | 'completed' | 'cancelled';
  manualEntry?: boolean;
}

export interface WorkoutSessionExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  templateExerciseId: string;
  order: number;
  sets: ExerciseSet[];
  skipped: boolean;
  replacedWithExerciseId?: string;
  replacedWithExerciseName?: string;
  skipReason?: string;
  notes?: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds: number;
  // Cardio fields (carried from template, editable during session)
  exerciseType?: ExerciseType;
  cardioDuration?: number;
  cardioDistance?: number;
  cardioPace?: string;
  cardioIntensity?: 'very_easy' | 'easy' | 'moderate' | 'hard' | 'very_hard' | 'intervals';
  // Warm-up sets (strength exercises only)
  warmupSets?: WarmupSet[];
}

export interface WarmupSet {
  id: string;
  weight: number | null;
  reps: number | null;
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  note?: string;
}

export interface BodyweightEntry {
  id: string;
  date: string;
  weight: number;
  note?: string;
  tags?: string[];
}

// ─── Bodyweight tag system ───────────────────────────────

export const DEFAULT_BW_TAGS = [
  'cheat_meal',
  'travel',
  'bad_sleep',
  'stomach_issues',
  'after_workout',
  'morning_fasted',
  'creatine',
  'dehydrated',
  'bloated',
  'sick',
] as const;

export const BW_TAG_LABELS: Record<string, string> = {
  cheat_meal: 'Cheat Meal',
  travel: 'Travel',
  bad_sleep: 'Bad Sleep',
  stomach_issues: 'Stomach Issues',
  after_workout: 'After Workout',
  morning_fasted: 'Morning Fasted',
  creatine: 'Creatine',
  dehydrated: 'Dehydrated',
  bloated: 'Bloated',
  sick: 'Sick',
};

export const BW_TAG_COLORS: Record<string, string> = {
  cheat_meal: 'bg-orange-500/20 text-orange-400',
  travel: 'bg-blue-500/20 text-blue-400',
  bad_sleep: 'bg-amber-500/20 text-amber-400',
  stomach_issues: 'bg-red-500/20 text-red-400',
  after_workout: 'bg-emerald-500/20 text-emerald-400',
  morning_fasted: 'bg-cyan-500/20 text-cyan-400',
  creatine: 'bg-purple-500/20 text-purple-400',
  dehydrated: 'bg-yellow-500/20 text-yellow-400',
  bloated: 'bg-rose-500/20 text-rose-400',
  sick: 'bg-red-500/20 text-red-400',
};

export interface TagConfig {
  id: string;
  label: string;
  color: string; // hex color
}

export const TAG_COLOR_PRESETS = [
  '#f97316', '#3b82f6', '#f59e0b', '#ef4444',
  '#10b981', '#06b6d4', '#8b5cf6', '#eab308',
  '#f43f5e', '#6366f1', '#ec4899', '#84cc16',
  '#14b8a6', '#0ea5e9', '#d946ef', '#71717a',
];

export const DEFAULT_TAG_CONFIGS: TagConfig[] = [
  { id: 'cheat_meal', label: 'Cheat Meal', color: '#f97316' },
  { id: 'travel', label: 'Travel', color: '#3b82f6' },
  { id: 'bad_sleep', label: 'Bad Sleep', color: '#f59e0b' },
  { id: 'stomach_issues', label: 'Stomach Issues', color: '#ef4444' },
  { id: 'after_workout', label: 'After Workout', color: '#10b981' },
  { id: 'morning_fasted', label: 'Morning Fasted', color: '#06b6d4' },
  { id: 'creatine', label: 'Creatine', color: '#8b5cf6' },
  { id: 'dehydrated', label: 'Dehydrated', color: '#eab308' },
  { id: 'bloated', label: 'Bloated', color: '#f43f5e' },
  { id: 'sick', label: 'Sick', color: '#ef4444' },
];

export interface BodyweightTargetRange {
  min: number;
  max: number;
}

export type ChartDisplayMode = 'both' | 'raw' | 'ma';

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  type: PRType;
  value: number;
  weight?: number;
  reps?: number;
  date: string;
  sessionId: string;
}

// ─── Health tracking ──────────────────────────────────

export interface StepEntry {
  date: string; // YYYY-MM-DD
  stepCount: number;
  note?: string;
}

export interface SleepEntry {
  date: string; // YYYY-MM-DD (the morning date)
  sleepScore: number; // 1–100
  sleepDuration: number; // minutes
  bedtime?: string; // HH:MM
  wakeUpTime?: string; // HH:MM
  interruptions?: number;
  note?: string;
}

// ─── Trash system ──────────────────────────────────────

export type TrashItemType = 'session' | 'template' | 'exercise' | 'bodyweight' | 'program_group';

export interface TrashItem {
  id: string;
  itemType: TrashItemType;
  itemId: string;
  name: string;
  context?: string;
  data: string; // JSON snapshot of original item
  deletedAt: string;
}

// Per-set progression comparison (weight + reps independently)
export interface SetProgressComparison {
  weight: 'up' | 'down' | 'same' | 'none';
  reps: 'up' | 'down' | 'same' | 'none';
  weightDiff: number | null;
  repsDiff: number | null;
}

export const SESSION_TAG_LABELS: Record<SessionTag, string> = {
  good_energy: 'Good Energy',
  bad_sleep: 'Bad Sleep',
  travel: 'Travel',
  stomach_issues: 'Stomach Issues',
  stress: 'Stress',
  great_pump: 'Great Pump',
  low_motivation: 'Low Motivation',
  gym_crowded: 'Gym Crowded',
  different_gym: 'Different Gym',
  pain_discomfort: 'Pain / Discomfort',
  deload: 'Deload',
  pr_day: 'PR Day',
};

export const SESSION_TAG_COLORS: Record<SessionTag, string> = {
  good_energy: 'bg-emerald-500/20 text-emerald-400',
  bad_sleep: 'bg-amber-500/20 text-amber-400',
  travel: 'bg-blue-500/20 text-blue-400',
  stomach_issues: 'bg-red-500/20 text-red-400',
  stress: 'bg-orange-500/20 text-orange-400',
  great_pump: 'bg-purple-500/20 text-purple-400',
  low_motivation: 'bg-zinc-500/20 text-zinc-400',
  gym_crowded: 'bg-yellow-500/20 text-yellow-400',
  different_gym: 'bg-cyan-500/20 text-cyan-400',
  pain_discomfort: 'bg-red-500/20 text-red-400',
  deload: 'bg-indigo-500/20 text-indigo-400',
  pr_day: 'bg-amber-500/20 text-amber-300',
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  cardio: 'Cardio',
  full_body: 'Full Body',
};

export const CATEGORY_LABELS: Record<WorkoutCategory, string> = {
  upper_push: 'Upper Push',
  upper_pull: 'Upper Pull',
  legs: 'Legs',
  shoulders: 'Shoulders',
  cardio: 'Cardio',
  full_body: 'Full Body',
  rest: 'Rest',
  custom: 'Custom',
};

export const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f97316',
  biceps: '#8b5cf6',
  triceps: '#a855f7',
  forearms: '#6366f1',
  quads: '#10b981',
  hamstrings: '#14b8a6',
  glutes: '#ec4899',
  calves: '#06b6d4',
  abs: '#eab308',
  cardio: '#f43f5e',
  full_body: '#71717a',
};

export const WORKOUT_EMOJIS = [
  // Strength & lifting
  '💪', '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🦾', '⚒️', '🔨', '🪨',
  // Cardio & running
  '🏃', '🏃‍♂️', '🏃‍♀️', '🚴', '🚴‍♂️', '🚴‍♀️', '🏊', '🏊‍♂️',
  // Sports & combat
  '🥊', '🥋', '🤼', '⛹️', '🤾', '🏀', '⚽', '🎾',
  // Recovery & mobility
  '🧘', '🧘‍♂️', '🧘‍♀️', '🧖', '💆', '🩹', '🛁', '😴',
  // Nature & outdoor
  '🧗', '🧗‍♂️', '🏔️', '🌊', '🏄', '🎿', '🛶', '🚶',
  // Body parts
  '🦵', '🍑', '🦴', '🫀', '🧠', '👐',
  // Motivational
  '🔥', '⚡', '💥', '💣', '🎯', '🏆', '🥇', '⭐',
  '💎', '👑', '🦁', '🐺', '🦅', '🐉', '🐻', '🦍',
  '🐅', '🦈', '🦬', '🐗',
  // Misc
  '❤️', '☀️', '🌙', '❄️', '🌶️', '🎵', '⏱️', '📈',
  '👊', '🤸', '⚔️', '🛡️', '⚙️', '🚣', '🎪', '🪢',
];

import type {
  WorkoutSession, WorkoutTemplate, Exercise, StepEntry, SleepEntry, BodyweightEntry,
} from '@/db/types';
import type { VacationPeriod } from '@/hooks/useScheduleSettings';
import type { Run } from '@/lib/running';

// ─── Insights engine types ───────────────────────────────
// Every rule is a pure function over InsightData. It returns null when
// it has nothing meaningful to say (low data stays quiet — a rule must
// never emit a misleading number), or a Finding with quantified evidence.

export type Severity = 'good' | 'warning' | 'info';

export interface Finding {
  /** stable id, unique per rule output (e.g. 'overload', 'plateau') */
  id: string;
  /** rule that produced it: R1..R7 */
  rule: string;
  severity: Severity;
  /** 0–100, used with severity for ranking (warnings surface first) */
  impact: number;
  /** one-line, quantified */
  headline: string;
  /** 1–2 sentences of context */
  detail: string;
  /** short chips, each one number-backed ("Bench: +5kg top set") */
  evidence: string[];
  /** concrete, optional; phrased as options not orders */
  recommendation?: string;
  /** which recap domain the finding informs */
  domain: 'training' | 'recovery' | 'running' | 'consistency';
}

export interface InsightData {
  /** evaluation reference time — end of the selected week for past recaps */
  asOf: Date;
  /** completed sessions up to asOf, oldest first */
  sessions: WorkoutSession[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  stepEntries: StepEntry[];
  sleepEntries: SleepEntry[];
  bodyweightEntries: BodyweightEntry[];
  vacations: VacationPeriod[];
  /** runs extracted from sessions (lib/running), oldest first */
  runs: Run[];
}

export interface InsightRule {
  id: string;
  /** short human description of what the rule checks (documentation) */
  describe: string;
  evaluate(data: InsightData): Finding | Finding[] | null;
}

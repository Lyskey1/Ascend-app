import { useMemo } from 'react';
import {
  useSessions, useExercises, useTemplates, useStepEntries, useSleepEntries, useBodyweightEntries,
} from '@/hooks/useWorkout';
import { getVacationPeriods } from '@/hooks/useScheduleSettings';
import { extractRuns } from '@/lib/running';
import { evaluateInsights, type Finding, type InsightData } from '@/lib/insights';

/**
 * Live findings from the deterministic insights engine.
 * `asOf` defaults to now; pass a past week's end to evaluate a
 * historical recap — every rule window is anchored to it.
 */
export function useInsights(asOf?: Date): Finding[] {
  const allSessions = useSessions();
  const exercises = useExercises();
  const templates = useTemplates();
  const stepEntries = useStepEntries();
  const sleepEntries = useSleepEntries();
  const bodyweightEntries = useBodyweightEntries();

  const asOfMs = asOf ? asOf.getTime() : null;

  return useMemo(() => {
    const ref = asOfMs != null ? new Date(asOfMs) : new Date();
    const refMs = ref.getTime();
    const sessions = allSessions
      .filter((s) => new Date(s.startedAt).getTime() <= refMs)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const data: InsightData = {
      asOf: ref,
      sessions,
      exercises,
      templates,
      stepEntries: stepEntries.filter((e) => e.date <= isoDay(ref)),
      sleepEntries: sleepEntries.filter((e) => e.date <= isoDay(ref)),
      bodyweightEntries: bodyweightEntries.filter((e) => e.date <= isoDay(ref)),
      vacations: getVacationPeriods(),
      runs: extractRuns(sessions),
    };
    return evaluateInsights(data);
  }, [asOfMs, allSessions, exercises, templates, stepEntries, sleepEntries, bodyweightEntries]);
}

function isoDay(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

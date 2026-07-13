import type { Finding, InsightData, Severity } from './types';
import { RULES } from './rules';

export type { Finding, InsightData, Severity } from './types';
export { RULES } from './rules';

// ─── Engine ──────────────────────────────────────────────

const SEVERITY_RANK: Record<Severity, number> = { warning: 2, good: 1, info: 0 };

/** Evaluate every rule; returns findings sorted by severity then impact */
export function evaluateInsights(data: InsightData): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    const result = rule.evaluate(data);
    if (!result) continue;
    if (Array.isArray(result)) findings.push(...result);
    else findings.push(result);
  }
  return findings.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.impact - a.impact
  );
}

/** Top findings for "Main Takeaways": severity+impact ranked, quiet ones excluded */
export function topTakeaways(findings: Finding[], count = 3): Finding[] {
  return findings.filter((f) => f.impact >= 20).slice(0, count);
}

/** Findings for a recap domain badge: worst severity wins */
export function domainSeverity(findings: Finding[], domains: Finding['domain'][]): Severity | null {
  const relevant = findings.filter((f) => domains.includes(f.domain) && f.impact >= 20);
  if (relevant.length === 0) return null;
  if (relevant.some((f) => f.severity === 'warning')) return 'warning';
  if (relevant.some((f) => f.severity === 'good')) return 'good';
  return 'info';
}

// ─── Deterministic narrative ─────────────────────────────

/** 2–3 sentence coach summary assembled from the ranked findings */
export function buildCoachSummary(findings: Finding[]): string {
  const meaningful = findings.filter((f) => f.impact >= 20);
  if (meaningful.length === 0) {
    return 'Not enough data yet for a meaningful readout. Log workouts, sleep, and runs — the coach gets sharper with every entry.';
  }
  const warnings = meaningful.filter((f) => f.severity === 'warning');
  const goods = meaningful.filter((f) => f.severity === 'good');

  const opener =
    warnings.length === 0
      ? goods.length >= 2
        ? 'Strong stretch of training.'
        : 'Steady progress overall.'
      : goods.length > warnings.length
        ? 'Mostly on track, with one thing to address.'
        : warnings.length >= 2
          ? 'A few signals need attention this week.'
          : 'Decent week with one clear focus area.';

  const lead = meaningful[0];
  const second = goods.find((f) => f !== lead) ?? warnings.find((f) => f !== lead);

  const sentences = [opener, sentenceize(lead.headline)];
  if (second) sentences.push(sentenceize(second.headline));
  return sentences.join(' ');
}

/** Up to `max` concrete focus items from the top recommendations */
export function buildNextWeekFocus(findings: Finding[], max = 2): string[] {
  const recs = findings
    .filter((f) => f.recommendation)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.impact - a.impact)
    .map((f) => f.recommendation!) ;
  const unique = [...new Set(recs)].slice(0, max);
  return unique.length > 0 ? unique : ['Keep the current rhythm — consistency is doing its job.'];
}

function sentenceize(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : t + '.';
}

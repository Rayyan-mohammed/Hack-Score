// Pure scoring/aggregation logic for the leaderboard.
// A team's score in a round = the average of all submitted judges'
// total scores for that team in that round. Overall = sum across rounds.

export type EvalRow = {
  round_id: string;
  team_id: string;
  total_score: number;
  status: string;
};

export type TeamRow = {
  id: string;
  team_code: string;
  name: string;
  track: string | null;
  college: string | null;
  /** Manual admin tie-break override; lower ranks higher. Null = none. */
  tiebreak_priority?: number | null;
};

export type RoundRow = { id: string; name: string };

export type Standing = {
  team: TeamRow;
  roundAverages: Record<string, number>;
  overall: number;
  /** Shares its overall score with at least one other team. */
  tied: boolean;
  /** Tied and identical through every automatic tier with no manual priority. */
  unresolved: boolean;
};

/**
 * Tie-break order (highest wins, applied only when `overall` is equal):
 *   1. Score in the LAST round (finals performance).
 *   2. Highest single criterion score the team earned (from `maxCriterion`).
 *   3. Manual admin priority (`tiebreak_priority`, lower = higher).
 *   4. Team code, as a stable final fallback.
 * Teams still level after tier 3 are flagged `unresolved` for an admin decision.
 */
export function computeStandings(
  teams: TeamRow[],
  rounds: RoundRow[],
  evals: EvalRow[],
  opts?: { maxCriterion?: Record<string, number> },
): Standing[] {
  const submitted = evals.filter((e) => e.status === "submitted");
  const lastRoundId = rounds.length ? rounds[rounds.length - 1].id : null;
  const maxCriterion = opts?.maxCriterion ?? {};

  const base = teams.map((team) => {
    const roundAverages: Record<string, number> = {};
    let overall = 0;
    for (const r of rounds) {
      const rows = submitted.filter(
        (e) => e.team_id === team.id && e.round_id === r.id,
      );
      const avg = rows.length
        ? rows.reduce((s, e) => s + Number(e.total_score), 0) / rows.length
        : 0;
      roundAverages[r.id] = avg;
      overall += avg;
    }
    return { team, roundAverages, overall, tied: false, unresolved: false };
  });

  const lastRoundScore = (s: (typeof base)[number]) =>
    lastRoundId ? (s.roundAverages[lastRoundId] ?? 0) : 0;
  const priority = (s: (typeof base)[number]) =>
    s.team.tiebreak_priority ?? Number.POSITIVE_INFINITY;

  base.sort(
    (a, b) =>
      b.overall - a.overall ||
      lastRoundScore(b) - lastRoundScore(a) ||
      (maxCriterion[b.team.id] ?? 0) - (maxCriterion[a.team.id] ?? 0) ||
      priority(a) - priority(b) ||
      a.team.team_code.localeCompare(b.team.team_code),
  );

  // Flag ties (equal overall) and the subset still level through every
  // automatic tier with no manual priority set.
  for (let i = 0; i < base.length; i++) {
    for (let j = 0; j < base.length; j++) {
      if (i === j) continue;
      if (round1(base[i].overall) !== round1(base[j].overall)) continue;
      base[i].tied = true;
      const sameLast = round1(lastRoundScore(base[i])) === round1(lastRoundScore(base[j]));
      const sameCrit =
        (maxCriterion[base[i].team.id] ?? 0) === (maxCriterion[base[j].team.id] ?? 0);
      const noPriority =
        base[i].team.tiebreak_priority == null &&
        base[j].team.tiebreak_priority == null;
      if (sameLast && sameCrit && noPriority) base[i].unresolved = true;
    }
  }

  return base;
}

export const TIEBREAK_RULE =
  "Ties are broken by: higher last-round score → highest single criterion score → admin decision.";

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

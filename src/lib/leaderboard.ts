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
};

export type RoundRow = { id: string; name: string };

export type Standing = {
  team: TeamRow;
  roundAverages: Record<string, number>;
  overall: number;
};

export function computeStandings(
  teams: TeamRow[],
  rounds: RoundRow[],
  evals: EvalRow[],
): Standing[] {
  const submitted = evals.filter((e) => e.status === "submitted");

  return teams
    .map((team) => {
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
      return { team, roundAverages, overall };
    })
    .sort(
      (a, b) =>
        b.overall - a.overall ||
        a.team.team_code.localeCompare(b.team.team_code),
    );
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// Number formatting shared by the report builder (server) and the PDF/Excel
// writers (client). Pure module — no server imports, safe to bundle.

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 2 decimals, without the trailing ".00" on whole numbers. */
export function fmt(n: number): string {
  const r = round2(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/** Marks-out-of, e.g. "42.5 / 50". */
export function outOf(score: number, max: number): string {
  return `${fmt(score)} / ${fmt(max)}`;
}

/**
 * The evaluator's own summary, broken down by round.
 *
 * Built from the marks the evaluator actually recorded, so a round they did
 * not score shows a dash rather than a zero. Shared by the PDF and the Word
 * document so the two always print the same table.
 *
 * Columns: team, team name, one per round, then what they gave and the total
 * that was available to give.
 */
export function evaluatorSummaryTable(
  evaluator: {
    rows: { teamCode: string; roundName: string; maxMarks: number; score: number }[];
    summary: { teamCode: string; teamName: string; maxMarks: number; given: number }[];
    totalMax: number;
    totalGiven: number;
  },
  roundNames: string[],
): { head: string[]; body: (string | number)[][] } {
  // team code -> round name -> marks given
  const given = new Map<string, Map<string, number>>();
  for (const r of evaluator.rows) {
    const perRound = given.get(r.teamCode) ?? new Map<string, number>();
    perRound.set(r.roundName, (perRound.get(r.roundName) ?? 0) + r.score);
    given.set(r.teamCode, perRound);
  }

  // Only the rounds this evaluator actually judged earn a column.
  const rounds = roundNames.filter((name) =>
    evaluator.rows.some((r) => r.roundName === name),
  );

  const body: (string | number)[][] = evaluator.summary.map((s) => {
    const perRound = given.get(s.teamCode);
    return [
      s.teamCode,
      s.teamName,
      ...rounds.map((name) => {
        const value = perRound?.get(name);
        return value === undefined ? "—" : fmt(value);
      }),
      fmt(s.given),
      fmt(s.maxMarks),
    ];
  });

  body.push([
    "TOTAL",
    "",
    ...rounds.map((name) => {
      let sum = 0;
      let seen = false;
      for (const perRound of given.values()) {
        const value = perRound.get(name);
        if (value !== undefined) {
          sum += value;
          seen = true;
        }
      }
      return seen ? fmt(sum) : "—";
    }),
    fmt(evaluator.totalGiven),
    fmt(evaluator.totalMax),
  ]);

  return {
    head: ["Team", "Team name", ...rounds, "Marks given", "Maximum marks"],
    body,
  };
}

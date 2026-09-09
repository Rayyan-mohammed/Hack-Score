// The single source of truth for the official evaluation report.
//
// Everything the report shows — the overall summary (level 1), the round-wise
// distribution (level 2) and the full evaluator/team/component audit trail
// (level 3) — is derived here, in one pass, from one set of rows. The PDF, the
// Excel workbook and the on-screen preview all consume this same bundle, so
// the three levels cannot drift apart.
//
// Reconciliation chain, checked at the end and reported in `discrepancies`:
//   evaluator marks -> component average -> round total -> team total -> overall
//
// Scoring rules (identical to the leaderboard):
//   * a judge's subtotal for a team in a round = sum of their criterion scores
//   * a team's round score  = average of the SUBMITTED judges' subtotals
//   * a team's overall      = sum of its round scores
// Draft and unstarted evaluations never contribute; they are counted as
// coverage gaps instead.

import { createClient } from "@/lib/supabase/server";
import { computeStandings, type EvalRow } from "@/lib/leaderboard";
import {
  normaliseReportConfig,
  type ReportConfig,
} from "@/lib/report-config";
import { fmt, round2 } from "@/lib/report-format";

export { fmt, round2 };

export type ReportCriterion = {
  id: string;
  name: string;
  maxMarks: number;
  weight: number;
};

export type ReportRound = {
  id: string;
  name: string;
  criteria: ReportCriterion[];
  /** Sum of the round's criterion maximums — the scale one judge marks on. */
  maxMarks: number;
  /** Evaluators assigned to the round, for the event-details section. */
  judgeNames: string[];
};

export type ReportTeam = {
  id: string;
  code: string;
  name: string;
  track: string | null;
  college: string | null;
  leaderName: string | null;
  leaderEmail: string | null;
  /** Team-mates other than the leader, in the order they were entered. */
  members: string[];
};

export type ReportJudge = { id: string; name: string; email: string | null };

/** One mark, exactly as an evaluator awarded it. Level 3 is built from these. */
export type ReportEntry = {
  judgeId: string;
  judgeName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  roundId: string;
  roundName: string;
  criterionId: string;
  criterionName: string;
  maxMarks: number;
  score: number;
};

export type Level1Row = {
  rank: number;
  teamId: string;
  teamCode: string;
  teamName: string;
  track: string | null;
  college: string | null;
  /** roundId -> team's score in that round */
  roundScores: Record<string, number>;
  overall: number;
  maxTotal: number;
  percentage: number;
  result: string;
};

export type Level2Row = {
  teamId: string;
  teamCode: string;
  teamName: string;
  /** criterionId -> average across the submitted judges */
  componentScores: Record<string, number>;
  total: number;
  /** How many judges' marks the row averages. 0 = not evaluated yet. */
  judgeCount: number;
};

export type Level2Round = {
  roundId: string;
  roundName: string;
  criteria: ReportCriterion[];
  maxMarks: number;
  rows: Level2Row[];
};

export type Level3EvaluatorRow = {
  teamCode: string;
  teamName: string;
  roundName: string;
  criterionName: string;
  maxMarks: number;
  score: number;
};

export type Level3Evaluator = {
  judgeId: string;
  judgeName: string;
  email: string | null;
  rows: Level3EvaluatorRow[];
  summary: {
    teamCode: string;
    teamName: string;
    maxMarks: number;
    given: number;
  }[];
  totalMax: number;
  totalGiven: number;
};

export type Level3TeamRound = {
  roundId: string;
  roundName: string;
  rows: {
    judgeName: string;
    criterionName: string;
    maxMarks: number;
    score: number;
  }[];
  judgeCount: number;
  /** The team's score for the round (average of judges), and its scale. */
  total: number;
  maxMarks: number;
};

export type Level3Team = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rounds: Level3TeamRound[];
  overall: number;
  overallMax: number;
};

export type Level3Component = {
  roundName: string;
  criterionName: string;
  maxMarks: number;
  rows: {
    teamCode: string;
    teamName: string;
    judgeName: string;
    maxMarks: number;
    score: number;
  }[];
  /** Sum of the per-team averages — the component's contribution to the round. */
  total: number;
};

export type ReportBundle = {
  hackathon: {
    id: string;
    name: string;
    venue: string | null;
    start_date: string | null;
    end_date: string | null;
  };
  config: ReportConfig;
  generatedAt: string;
  rounds: ReportRound[];
  teams: ReportTeam[];
  judges: ReportJudge[];
  level1: {
    rows: Level1Row[];
    stats: {
      totalTeams: number;
      totalRounds: number;
      totalEvaluators: number;
      totalMarksAvailable: number;
      highest: number;
      lowest: number;
      average: number;
      evaluationsSubmitted: number;
      evaluationsExpected: number;
    };
  };
  level2: {
    rounds: Level2Round[];
    consolidated: {
      teamId: string;
      teamCode: string;
      teamName: string;
      roundScores: Record<string, number>;
      grandTotal: number;
    }[];
  };
  level3: {
    byEvaluator: Level3Evaluator[];
    byTeam: Level3Team[];
    byComponent: Level3Component[];
  };
  /** Reconciliation failures. Non-empty means the report must not be trusted. */
  discrepancies: string[];
};

const AWARDS = ["Winner", "Runner-up", "Second runner-up"];

type RawEval = {
  id: string;
  round_id: string;
  team_id: string;
  judge_id: string;
  status: string;
  total_score: number;
};

/**
 * Build the complete report for one hackathon. Returns null if the hackathon
 * doesn't exist. Admin-only data — call it from an admin-gated route.
 */
export async function buildReportBundle(
  hackathonId: string,
): Promise<ReportBundle | null> {
  const supabase = await createClient();

  const { data: hackathon } = await supabase
    .from("hackathons")
    .select("id, name, venue, start_date, end_date, report_config")
    .eq("id", hackathonId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!hackathon) return null;

  const [{ data: teamData }, { data: roundData }] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "id, team_code, name, track, college, tiebreak_priority, team_leader_name, team_leader_email",
      )
      .eq("hackathon_id", hackathonId)
      .is("deleted_at", null)
      .order("team_code", { ascending: true }),
    supabase
      .from("rounds")
      .select("id, name")
      .eq("hackathon_id", hackathonId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  const rawTeams = teamData ?? [];
  const rawRounds = roundData ?? [];
  const roundIds = rawRounds.map((r) => r.id);

  const [criteriaRes, judgeRes, evalRes] = await Promise.all([
    roundIds.length
      ? supabase
          .from("rubric_criteria")
          .select("id, round_id, name, max_marks, weight, sort_order")
          .in("round_id", roundIds)
          .order("sort_order", { ascending: true })
      : { data: [] },
    roundIds.length
      ? supabase
          .from("round_judges")
          .select("round_id, judge_id, profiles(full_name, email)")
          .in("round_id", roundIds)
      : { data: [] },
    roundIds.length
      ? supabase
          .from("evaluations")
          .select("id, round_id, team_id, judge_id, status, total_score")
          .in("round_id", roundIds)
      : { data: [] },
  ]);

  const rawCriteria = (criteriaRes.data ?? []) as {
    id: string;
    round_id: string;
    name: string;
    max_marks: number;
    weight: number;
  }[];
  const assignments = (judgeRes.data ?? []) as unknown as {
    round_id: string;
    judge_id: string;
    profiles: { full_name: string | null; email: string | null } | null;
  }[];
  const evaluations = (evalRes.data ?? []) as unknown as RawEval[];

  // Participant names, so the report can list who actually took part.
  const memberRows: { team_id: string; name: string }[] = [];
  const teamIds = rawTeams.map((t) => t.id);
  for (let i = 0; i < teamIds.length; i += 200) {
    const { data } = await supabase
      .from("team_members")
      .select("team_id, name")
      .in("team_id", teamIds.slice(i, i + 200));
    memberRows.push(...((data ?? []) as { team_id: string; name: string }[]));
  }

  const submittedEvals = evaluations.filter((e) => e.status === "submitted");
  const evalIds = submittedEvals.map((e) => e.id);

  const scoreRows: { evaluation_id: string; criterion_id: string; score: number }[] =
    [];
  // Chunked so a large event doesn't blow the URL length of the `in` filter.
  for (let i = 0; i < evalIds.length; i += 200) {
    const { data } = await supabase
      .from("evaluation_scores")
      .select("evaluation_id, criterion_id, score")
      .in("evaluation_id", evalIds.slice(i, i + 200));
    scoreRows.push(
      ...((data ?? []) as { evaluation_id: string; criterion_id: string; score: number }[]),
    );
  }

  // ---- Shape the reference data -----------------------------------------
  const teams: ReportTeam[] = rawTeams.map((t) => ({
    id: t.id,
    code: t.team_code,
    name: t.name,
    track: t.track,
    college: t.college,
    leaderName: t.team_leader_name ?? null,
    leaderEmail: t.team_leader_email ?? null,
    members: memberRows.filter((m) => m.team_id === t.id).map((m) => m.name),
  }));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const rounds: ReportRound[] = rawRounds.map((r) => {
    const criteria = rawCriteria
      .filter((c) => c.round_id === r.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        maxMarks: Number(c.max_marks),
        weight: Number(c.weight),
      }));
    return {
      id: r.id,
      name: r.name,
      criteria,
      maxMarks: criteria.reduce((s, c) => s + c.maxMarks, 0),
      judgeNames: assignments
        .filter((a) => a.round_id === r.id)
        .map((a) => a.profiles?.full_name || a.profiles?.email || "Unknown evaluator")
        .sort((x, y) => x.localeCompare(y)),
    };
  });
  const roundById = new Map(rounds.map((r) => [r.id, r]));

  const judgeMap = new Map<string, ReportJudge>();
  for (const a of assignments) {
    if (judgeMap.has(a.judge_id)) continue;
    judgeMap.set(a.judge_id, {
      id: a.judge_id,
      name: a.profiles?.full_name || a.profiles?.email || "Unknown evaluator",
      email: a.profiles?.email ?? null,
    });
  }
  // An evaluation from a judge since unassigned still has to appear in the audit.
  for (const e of submittedEvals) {
    if (!judgeMap.has(e.judge_id))
      judgeMap.set(e.judge_id, {
        id: e.judge_id,
        name: "Unknown evaluator",
        email: null,
      });
  }
  const judges = [...judgeMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // ---- Level 3 source rows: one per awarded mark ------------------------
  const scoresByEval = new Map<string, { criterion_id: string; score: number }[]>();
  for (const s of scoreRows) {
    const list = scoresByEval.get(s.evaluation_id) ?? [];
    list.push({ criterion_id: s.criterion_id, score: Number(s.score) });
    scoresByEval.set(s.evaluation_id, list);
  }

  const entries: ReportEntry[] = [];
  for (const ev of submittedEvals) {
    const team = teamById.get(ev.team_id);
    const round = roundById.get(ev.round_id);
    const judge = judgeMap.get(ev.judge_id);
    if (!team || !round || !judge) continue;

    // Iterate the rubric, not the stored scores, so a criterion a judge never
    // touched still shows in the audit trail as 0 rather than vanishing.
    const stored = new Map(
      (scoresByEval.get(ev.id) ?? []).map((s) => [s.criterion_id, s.score]),
    );
    for (const c of round.criteria) {
      entries.push({
        judgeId: judge.id,
        judgeName: judge.name,
        teamId: team.id,
        teamCode: team.code,
        teamName: team.name,
        roundId: round.id,
        roundName: round.name,
        criterionId: c.id,
        criterionName: c.name,
        maxMarks: c.maxMarks,
        score: stored.get(c.id) ?? 0,
      });
    }
  }

  // ---- Derived aggregates, all from `entries` ---------------------------
  // (team, round, judge) -> subtotal
  const subtotals = new Map<string, number>();
  // (team, round, criterion) -> list of judge scores
  const componentScores = new Map<string, number[]>();
  // (team, round) -> set of judges who submitted
  const judgesPerTeamRound = new Map<string, Set<string>>();

  for (const e of entries) {
    const sub = `${e.teamId}|${e.roundId}|${e.judgeId}`;
    subtotals.set(sub, (subtotals.get(sub) ?? 0) + e.score);

    const comp = `${e.teamId}|${e.roundId}|${e.criterionId}`;
    const list = componentScores.get(comp) ?? [];
    list.push(e.score);
    componentScores.set(comp, list);

    const tr = `${e.teamId}|${e.roundId}`;
    const set = judgesPerTeamRound.get(tr) ?? new Set<string>();
    set.add(e.judgeId);
    judgesPerTeamRound.set(tr, set);
  }

  const average = (xs: number[]) =>
    xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

  /** A team's score in a round: mean of the submitted judges' subtotals. */
  const roundScore = (teamId: string, roundId: string) => {
    const judgeIds = [...(judgesPerTeamRound.get(`${teamId}|${roundId}`) ?? [])];
    return average(
      judgeIds.map((j) => subtotals.get(`${teamId}|${roundId}|${j}`) ?? 0),
    );
  };

  const maxTotal = rounds.reduce((s, r) => s + r.maxMarks, 0);

  // ---- Level 1 ----------------------------------------------------------
  // Ranking (including tie-breaks) stays with the leaderboard's own routine so
  // the report can never disagree with the on-screen standings.
  const maxCriterion: Record<string, number> = {};
  for (const e of entries)
    maxCriterion[e.teamId] = Math.max(maxCriterion[e.teamId] ?? 0, e.score);

  const standings = computeStandings(
    rawTeams.map((t) => ({
      id: t.id,
      team_code: t.team_code,
      name: t.name,
      track: t.track,
      college: t.college,
      tiebreak_priority: t.tiebreak_priority,
    })),
    rounds.map((r) => ({ id: r.id, name: r.name })),
    evaluations as unknown as EvalRow[],
    { maxCriterion },
  );

  const level1Rows: Level1Row[] = standings.map((s, i) => {
    const roundScores: Record<string, number> = {};
    let overall = 0;
    for (const r of rounds) {
      const value = round2(roundScore(s.team.id, r.id));
      roundScores[r.id] = value;
      overall += value;
    }
    overall = round2(overall);
    return {
      rank: i + 1,
      teamId: s.team.id,
      teamCode: s.team.team_code,
      teamName: s.team.name,
      track: s.team.track,
      college: s.team.college,
      roundScores,
      overall,
      maxTotal,
      percentage: maxTotal > 0 ? round2((overall / maxTotal) * 100) : 0,
      result:
        overall <= 0 ? "Not evaluated" : (AWARDS[i] ?? "Participant"),
    };
  });

  const scored = level1Rows.filter((r) => r.overall > 0).map((r) => r.overall);
  const expectedEvaluations = rounds.reduce((total, r) => {
    const assigned = assignments.filter((a) => a.round_id === r.id).length;
    return total + assigned * teams.length;
  }, 0);

  // ---- Level 2 ----------------------------------------------------------
  const level2Rounds: Level2Round[] = rounds.map((r) => ({
    roundId: r.id,
    roundName: r.name,
    criteria: r.criteria,
    maxMarks: r.maxMarks,
    rows: teams.map((t) => {
      const scores: Record<string, number> = {};
      let total = 0;
      for (const c of r.criteria) {
        const value = round2(
          average(componentScores.get(`${t.id}|${r.id}|${c.id}`) ?? []),
        );
        scores[c.id] = value;
        total += value;
      }
      return {
        teamId: t.id,
        teamCode: t.code,
        teamName: t.name,
        componentScores: scores,
        total: round2(total),
        judgeCount: (judgesPerTeamRound.get(`${t.id}|${r.id}`) ?? new Set())
          .size,
      };
    }),
  }));

  const consolidated = level1Rows.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    roundScores: row.roundScores,
    grandTotal: row.overall,
  }));

  // ---- Level 3 ----------------------------------------------------------
  const byEvaluator: Level3Evaluator[] = judges
    .map((j) => {
      const mine = entries.filter((e) => e.judgeId === j.id);
      const rows = mine
        .slice()
        .sort(
          (a, b) =>
            a.teamCode.localeCompare(b.teamCode) ||
            a.roundName.localeCompare(b.roundName) ||
            a.criterionName.localeCompare(b.criterionName),
        )
        .map((e) => ({
          teamCode: e.teamCode,
          teamName: e.teamName,
          roundName: e.roundName,
          criterionName: e.criterionName,
          maxMarks: e.maxMarks,
          score: e.score,
        }));

      const perTeam = new Map<string, { maxMarks: number; given: number }>();
      for (const e of mine) {
        const acc = perTeam.get(e.teamId) ?? { maxMarks: 0, given: 0 };
        acc.maxMarks += e.maxMarks;
        acc.given += e.score;
        perTeam.set(e.teamId, acc);
      }

      const summary = [...perTeam.entries()]
        .map(([teamId, acc]) => ({
          teamCode: teamById.get(teamId)?.code ?? "—",
          teamName: teamById.get(teamId)?.name ?? "—",
          maxMarks: round2(acc.maxMarks),
          given: round2(acc.given),
        }))
        .sort((a, b) => a.teamCode.localeCompare(b.teamCode));

      return {
        judgeId: j.id,
        judgeName: j.name,
        email: j.email,
        rows,
        summary,
        totalMax: round2(summary.reduce((s, x) => s + x.maxMarks, 0)),
        totalGiven: round2(summary.reduce((s, x) => s + x.given, 0)),
      };
    })
    .filter((e) => e.rows.length > 0);

  const byTeam: Level3Team[] = level1Rows.map((row) => {
    const roundsForTeam: Level3TeamRound[] = rounds.map((r) => {
      const rows = entries
        .filter((e) => e.teamId === row.teamId && e.roundId === r.id)
        .sort(
          (a, b) =>
            a.judgeName.localeCompare(b.judgeName) ||
            a.criterionName.localeCompare(b.criterionName),
        )
        .map((e) => ({
          judgeName: e.judgeName,
          criterionName: e.criterionName,
          maxMarks: e.maxMarks,
          score: e.score,
        }));
      return {
        roundId: r.id,
        roundName: r.name,
        rows,
        judgeCount: (judgesPerTeamRound.get(`${row.teamId}|${r.id}`) ?? new Set())
          .size,
        total: row.roundScores[r.id] ?? 0,
        maxMarks: r.maxMarks,
      };
    });

    return {
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      rounds: roundsForTeam,
      overall: row.overall,
      overallMax: maxTotal,
    };
  });

  const byComponent: Level3Component[] = rounds.flatMap((r) =>
    r.criteria.map((c) => {
      const rows = entries
        .filter((e) => e.roundId === r.id && e.criterionId === c.id)
        .sort(
          (a, b) =>
            a.teamCode.localeCompare(b.teamCode) ||
            a.judgeName.localeCompare(b.judgeName),
        )
        .map((e) => ({
          teamCode: e.teamCode,
          teamName: e.teamName,
          judgeName: e.judgeName,
          maxMarks: e.maxMarks,
          score: e.score,
        }));

      const total = teams.reduce(
        (sum, t) =>
          sum + average(componentScores.get(`${t.id}|${r.id}|${c.id}`) ?? []),
        0,
      );

      return {
        roundName: r.name,
        criterionName: c.name,
        maxMarks: c.maxMarks,
        rows,
        total: round2(total),
      };
    }),
  );

  // ---- Reconciliation ---------------------------------------------------
  const discrepancies: string[] = [];
  const TOLERANCE = 0.05;

  // 1. Each evaluator's marks must add up to the stored evaluation total.
  for (const ev of submittedEvals) {
    const computed = subtotals.get(`${ev.team_id}|${ev.round_id}|${ev.judge_id}`);
    if (computed === undefined) continue;
    if (Math.abs(computed - Number(ev.total_score)) > TOLERANCE) {
      const team = teamById.get(ev.team_id);
      const judge = judgeMap.get(ev.judge_id);
      discrepancies.push(
        `${judge?.name ?? ev.judge_id} / ${team?.code ?? ev.team_id}: component marks total ${fmt(computed)} but the stored evaluation total is ${fmt(Number(ev.total_score))}.`,
      );
    }
  }

  // 2. Component averages must rebuild the round total (level 2 vs level 1).
  for (const r2 of level2Rounds) {
    for (const row of r2.rows) {
      const fromLevel1 =
        level1Rows.find((l) => l.teamId === row.teamId)?.roundScores[
          r2.roundId
        ] ?? 0;
      if (Math.abs(row.total - fromLevel1) > TOLERANCE)
        discrepancies.push(
          `${row.teamCode} / ${r2.roundName}: component totals give ${fmt(row.total)} but the round score is ${fmt(fromLevel1)}.`,
        );
    }
  }

  // 3. Round totals must rebuild the overall (level 2 vs the leaderboard).
  for (const row of level1Rows) {
    const fromStandings = standings.find((s) => s.team.id === row.teamId);
    if (!fromStandings) continue;
    if (Math.abs(row.overall - fromStandings.overall) > TOLERANCE)
      discrepancies.push(
        `${row.teamCode}: report overall ${fmt(row.overall)} differs from the leaderboard overall ${fmt(fromStandings.overall)}.`,
      );
  }

  return {
    hackathon: {
      id: hackathon.id,
      name: hackathon.name,
      venue: hackathon.venue,
      start_date: hackathon.start_date,
      end_date: hackathon.end_date,
    },
    config: normaliseReportConfig(hackathon.report_config),
    generatedAt: new Date().toISOString(),
    rounds,
    teams,
    judges,
    level1: {
      rows: level1Rows,
      stats: {
        totalTeams: teams.length,
        totalRounds: rounds.length,
        totalEvaluators: judges.length,
        totalMarksAvailable: maxTotal,
        highest: scored.length ? round2(Math.max(...scored)) : 0,
        lowest: scored.length ? round2(Math.min(...scored)) : 0,
        average: scored.length ? round2(average(scored)) : 0,
        evaluationsSubmitted: submittedEvals.length,
        evaluationsExpected: expectedEvaluations,
      },
    },
    level2: { rounds: level2Rounds, consolidated },
    level3: { byEvaluator, byTeam, byComponent },
    discrepancies,
  };
}

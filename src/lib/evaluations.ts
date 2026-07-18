// Server-side data access for the admin team-detail breakdown.
//
// This performs the full joined fetch (team -> rounds -> rubric -> assigned
// judges -> evaluations -> per-criterion scores) so the view never has to
// stitch together partial data on the client. Admins can read every
// evaluation/score via the is_admin() RLS policies, so the normal authed
// server client is sufficient — no service-role key needed.

import { createClient } from "@/lib/supabase/server";
import { round1 } from "@/lib/leaderboard";

export type CriterionMeta = {
  id: string;
  name: string;
  max_marks: number;
  weight: number;
};

export type JudgeBreakdown = {
  judgeId: string;
  judgeName: string;
  status: "submitted" | "draft" | "pending";
  /** criterionId -> score, present only when an evaluation exists */
  scores: Record<string, number>;
  subtotal: number;
  comments: string | null;
  submittedAt: string | null;
};

export type RoundBreakdown = {
  roundId: string;
  roundName: string;
  criteria: CriterionMeta[];
  judges: JudgeBreakdown[];
  submittedCount: number;
  /** Average of submitted judge subtotals — the value that feeds the leaderboard rank. */
  roundAverage: number;
};

export type TeamEvaluationBreakdown = {
  team: {
    id: string;
    team_code: string;
    name: string;
    track: string | null;
    college: string | null;
    hackathon_id: string;
  };
  rounds: RoundBreakdown[];
  /** Sum of per-round averages — matches the leaderboard "Overall" column. */
  grandTotal: number;
} | null;

type EvalRow = {
  id: string;
  round_id: string;
  judge_id: string;
  status: string;
  comments: string | null;
  total_score: number;
  submitted_at: string | null;
};

export async function getTeamEvaluationBreakdown(
  teamId: string,
): Promise<TeamEvaluationBreakdown> {
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_code, name, track, college, hackathon_id")
    .eq("id", teamId)
    .single();

  if (!team) return null;

  const { data: roundsData } = await supabase
    .from("rounds")
    .select("id, name")
    .eq("hackathon_id", team.hackathon_id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const rounds = roundsData ?? [];
  const roundIds = rounds.map((r) => r.id);

  if (roundIds.length === 0) {
    return { team, rounds: [], grandTotal: 0 };
  }

  // Rubric, assigned judges, this team's evaluations, and their scores.
  const [
    { data: criteriaData },
    { data: assignmentData },
    { data: evalData },
  ] = await Promise.all([
    supabase
      .from("rubric_criteria")
      .select("id, round_id, name, max_marks, weight, sort_order")
      .in("round_id", roundIds)
      .order("sort_order", { ascending: true }),
    supabase
      .from("round_judges")
      .select("round_id, judge_id, profiles(full_name, email)")
      .in("round_id", roundIds),
    supabase
      .from("evaluations")
      .select("id, round_id, judge_id, status, comments, total_score, submitted_at")
      .eq("team_id", teamId)
      .in("round_id", roundIds),
  ]);

  const evals = (evalData as EvalRow[]) ?? [];
  const evalIds = evals.map((e) => e.id);

  const scoresByEval = new Map<string, Record<string, number>>();
  if (evalIds.length) {
    const { data: scoreData } = await supabase
      .from("evaluation_scores")
      .select("evaluation_id, criterion_id, score")
      .in("evaluation_id", evalIds);
    for (const s of scoreData ?? []) {
      const row = scoresByEval.get(s.evaluation_id) ?? {};
      row[s.criterion_id] = Number(s.score);
      scoresByEval.set(s.evaluation_id, row);
    }
  }

  const evalByRoundJudge = new Map<string, EvalRow>();
  for (const e of evals) evalByRoundJudge.set(`${e.round_id}:${e.judge_id}`, e);

  type Assignment = {
    round_id: string;
    judge_id: string;
    profiles: { full_name: string | null; email: string | null } | null;
  };
  const assignments = (assignmentData as unknown as Assignment[]) ?? [];

  let grandTotal = 0;

  const roundBreakdowns: RoundBreakdown[] = rounds.map((round) => {
    const criteria = (criteriaData ?? [])
      .filter((c) => c.round_id === round.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        max_marks: Number(c.max_marks),
        weight: Number(c.weight),
      }));

    const roundJudges = assignments.filter((a) => a.round_id === round.id);

    const judges: JudgeBreakdown[] = roundJudges
      .map((a) => {
        const ev = evalByRoundJudge.get(`${round.id}:${a.judge_id}`);
        const status: JudgeBreakdown["status"] = !ev
          ? "pending"
          : ev.status === "submitted"
            ? "submitted"
            : "draft";
        return {
          judgeId: a.judge_id,
          judgeName: a.profiles?.full_name || a.profiles?.email || "Unknown judge",
          status,
          scores: ev ? (scoresByEval.get(ev.id) ?? {}) : {},
          subtotal: ev ? Number(ev.total_score) : 0,
          comments: ev?.comments ?? null,
          submittedAt: ev?.submitted_at ?? null,
        };
      })
      .sort((a, b) => a.judgeName.localeCompare(b.judgeName));

    const submitted = judges.filter((j) => j.status === "submitted");
    const roundAverage = submitted.length
      ? submitted.reduce((s, j) => s + j.subtotal, 0) / submitted.length
      : 0;

    grandTotal += roundAverage;

    return {
      roundId: round.id,
      roundName: round.name,
      criteria,
      judges,
      submittedCount: submitted.length,
      roundAverage: round1(roundAverage),
    };
  });

  return { team, rounds: roundBreakdowns, grandTotal: round1(grandTotal) };
}

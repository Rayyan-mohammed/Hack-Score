// Server-side data access for the admin judge-progress view.
//
// A judge is assigned to rounds (round_judges); the teams they must evaluate
// are the teams in each assigned round's hackathon. A (round, team) task is
// "evaluated" once the judge has a *submitted* evaluation for it — a draft
// does not count as visited.

import { createClient } from "@/lib/supabase/server";
import { getParticipantsMap, participates } from "@/lib/rounds";

export type ProgressTeam = {
  teamId: string;
  teamCode: string;
  teamName: string;
  submittedAt: string | null;
};

export type RoundProgress = {
  roundId: string;
  roundName: string;
  hackathonName: string | null;
  evaluated: ProgressTeam[];
  pending: ProgressTeam[];
};

export type JudgeProgress = {
  judge: { id: string; full_name: string | null; email: string | null };
  totalTasks: number;
  submittedCount: number;
  rounds: RoundProgress[];
} | null;

export async function getJudgeProgress(judgeId: string): Promise<JudgeProgress> {
  const supabase = await createClient();

  const { data: judge } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", judgeId)
    .eq("role", "judge")
    .single();

  if (!judge) return null;

  // Rounds this judge is assigned to, with hackathon context.
  const { data: assignmentData } = await supabase
    .from("round_judges")
    .select(
      "round_id, rounds(id, name, hackathon_id, deleted_at, hackathons(name))",
    )
    .eq("judge_id", judgeId);

  type Assignment = {
    round_id: string;
    rounds: {
      id: string;
      name: string;
      hackathon_id: string;
      deleted_at: string | null;
      hackathons: { name: string } | null;
    } | null;
  };
  const assignments = ((assignmentData as unknown as Assignment[]) ?? []).filter(
    (a) => a.rounds && !a.rounds.deleted_at,
  );

  if (assignments.length === 0) {
    return { judge, totalTasks: 0, submittedCount: 0, rounds: [] };
  }

  const roundIds = assignments.map((a) => a.round_id);
  const hackathonIds = [
    ...new Set(assignments.map((a) => a.rounds!.hackathon_id)),
  ];

  const [{ data: teamData }, { data: evalData }, participants] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_code, name, hackathon_id")
        .in("hackathon_id", hackathonIds)
        .is("deleted_at", null)
        .order("team_code", { ascending: true }),
      supabase
        .from("evaluations")
        .select("round_id, team_id, status, submitted_at")
        .eq("judge_id", judgeId)
        .in("round_id", roundIds),
      getParticipantsMap(supabase, roundIds),
    ]);

  const teams = (teamData as {
    id: string;
    team_code: string;
    name: string;
    hackathon_id: string;
  }[]) ?? [];

  // (round:team) -> submitted_at for submitted evaluations only.
  const submittedAt = new Map<string, string | null>();
  for (const e of (evalData as {
    round_id: string;
    team_id: string;
    status: string;
    submitted_at: string | null;
  }[]) ?? []) {
    if (e.status === "submitted")
      submittedAt.set(`${e.round_id}:${e.team_id}`, e.submitted_at);
  }

  let totalTasks = 0;
  let submittedCount = 0;

  const rounds: RoundProgress[] = assignments.map((a) => {
    const round = a.rounds!;
    const roundTeams = teams.filter(
      (t) =>
        t.hackathon_id === round.hackathon_id &&
        participates(participants, round.id, t.id),
    );

    const evaluated: ProgressTeam[] = [];
    const pending: ProgressTeam[] = [];

    for (const t of roundTeams) {
      totalTasks += 1;
      const key = `${round.id}:${t.id}`;
      const base = { teamId: t.id, teamCode: t.team_code, teamName: t.name };
      if (submittedAt.has(key)) {
        submittedCount += 1;
        evaluated.push({ ...base, submittedAt: submittedAt.get(key) ?? null });
      } else {
        pending.push({ ...base, submittedAt: null });
      }
    }

    return {
      roundId: round.id,
      roundName: round.name,
      hackathonName: round.hackathons?.name ?? null,
      evaluated,
      pending,
    };
  });

  return { judge, totalTasks, submittedCount, rounds };
}

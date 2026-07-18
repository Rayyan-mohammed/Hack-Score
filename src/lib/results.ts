// Public (unauthenticated) team results, fetched by a private token.
//
// This uses the service-role admin client so a team can view their result via
// their unguessable link without an account — but ONLY once an admin has
// published the hackathon's results. We return exactly what that one team is
// allowed to see (their rank, scores, and anonymised feedback), never the
// whole leaderboard.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeStandings,
  round1,
  type EvalRow,
  type RoundRow,
  type TeamRow,
} from "@/lib/leaderboard";

export type PublicTeamResult =
  | { found: false }
  | { found: true; published: false; hackathonName: string }
  | {
      found: true;
      published: true;
      hackathon: {
        name: string;
        venue: string | null;
        start_date: string | null;
        end_date: string | null;
      };
      team: {
        team_code: string;
        name: string;
        track: string | null;
        college: string | null;
        members: string[];
      };
      rank: number;
      totalTeams: number;
      overall: number;
      rounds: { name: string; score: number }[];
      feedback: string[];
      award: "Winner" | "Runner-up" | "Second runner-up" | "Participant";
    };

const AWARDS = ["Winner", "Runner-up", "Second runner-up"] as const;

export async function getPublicTeamResult(
  token: string,
): Promise<PublicTeamResult> {
  const admin = createAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, team_code, name, track, college, hackathon_id")
    .eq("result_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!team) return { found: false };

  const { data: hackathon } = await admin
    .from("hackathons")
    .select("name, venue, start_date, end_date, results_published")
    .eq("id", team.hackathon_id)
    .single();

  if (!hackathon) return { found: false };
  if (!hackathon.results_published)
    return { found: true, published: false, hackathonName: hackathon.name };

  // Full standings (needed for this team's rank), then narrow to this team.
  const [{ data: teamRows }, { data: roundRows }, { data: members }] =
    await Promise.all([
      admin
        .from("teams")
        .select("id, team_code, name, track, college, tiebreak_priority")
        .eq("hackathon_id", team.hackathon_id)
        .is("deleted_at", null),
      admin
        .from("rounds")
        .select("id, name")
        .eq("hackathon_id", team.hackathon_id)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      admin.from("team_members").select("name").eq("team_id", team.id),
    ]);

  const teams = (teamRows as TeamRow[]) ?? [];
  const rounds = (roundRows as RoundRow[]) ?? [];
  const roundIds = rounds.map((r) => r.id);

  let evals: EvalRow[] = [];
  const maxCriterion: Record<string, number> = {};
  const feedback: string[] = [];

  if (roundIds.length) {
    const { data: e } = await admin
      .from("evaluations")
      .select("id, round_id, team_id, total_score, status, comments")
      .in("round_id", roundIds);
    const rows = (e as (EvalRow & { id: string; comments: string | null })[]) ?? [];
    evals = rows;

    const submittedIds = new Map<string, string>();
    for (const ev of rows) {
      if (ev.status !== "submitted") continue;
      submittedIds.set(ev.id, ev.team_id);
      // Anonymised feedback for this team only.
      if (ev.team_id === team.id && ev.comments?.trim())
        feedback.push(ev.comments.trim());
    }

    const ids = [...submittedIds.keys()];
    if (ids.length) {
      const { data: scores } = await admin
        .from("evaluation_scores")
        .select("evaluation_id, score")
        .in("evaluation_id", ids);
      for (const s of scores ?? []) {
        const tid = submittedIds.get(s.evaluation_id);
        if (!tid) continue;
        maxCriterion[tid] = Math.max(maxCriterion[tid] ?? 0, Number(s.score));
      }
    }
  }

  const standings = computeStandings(teams, rounds, evals, { maxCriterion });
  const idx = standings.findIndex((s) => s.team.id === team.id);
  const standing = standings[idx];
  const rank = idx + 1;

  const award =
    standing && standing.overall > 0 && rank <= 3 ? AWARDS[rank - 1] : "Participant";

  return {
    found: true,
    published: true,
    hackathon: {
      name: hackathon.name,
      venue: hackathon.venue,
      start_date: hackathon.start_date,
      end_date: hackathon.end_date,
    },
    team: {
      team_code: team.team_code,
      name: team.name,
      track: team.track,
      college: team.college,
      members: (members ?? []).map((m) => m.name),
    },
    rank,
    totalTeams: teams.length,
    overall: standing ? round1(standing.overall) : 0,
    rounds: rounds.map((r) => ({
      name: r.name,
      score: standing ? round1(standing.roundAverages[r.id] ?? 0) : 0,
    })),
    feedback,
    award,
  };
}

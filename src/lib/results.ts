// Public (unauthenticated) team results, fetched by a private token.
//
// This uses the service-role admin client so a team can view their result via
// their unguessable link without an account — but ONLY once an admin has
// published the hackathon's results. We return exactly what that one team is
// allowed to see (their rank, scores, and anonymised feedback), never the
// whole leaderboard.
//
// Every failure path returns a typed status instead of throwing, so the public
// page degrades to a clear message rather than a 500. "unavailable" means a
// server-side problem (missing SUPABASE_SECRET_KEY, un-applied migration, or a
// query error) — check the deployment env and that migration 0004 is applied.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeStandings,
  round1,
  type EvalRow,
  type RoundRow,
  type TeamRow,
} from "@/lib/leaderboard";

export type PublicTeamResult =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "unpublished"; hackathonName: string }
  | {
      status: "ok";
      /** True when an admin is looking before the results are published. */
      preview: boolean;
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
        /** The team leader — person 1 on the team, and on its certificates. */
        leaderName: string | null;
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

/**
 * `allowUnpublished` lets an admin see a team's page before results go out,
 * exactly as the team will. Pass it only after checking the viewer is an
 * admin — for everyone else an unpublished event stays hidden.
 */
export async function getPublicTeamResult(
  token: string,
  { allowUnpublished = false }: { allowUnpublished?: boolean } = {},
): Promise<PublicTeamResult> {
  // The service role is required to read past RLS for an anonymous visitor.
  if (!process.env.SUPABASE_SECRET_KEY) {
    console.error("[results] SUPABASE_SECRET_KEY is not set");
    return { status: "unavailable" };
  }

  try {
    const admin = createAdminClient();

    const { data: team, error: teamErr } = await admin
      .from("teams")
      .select("id, team_code, name, track, college, hackathon_id, team_leader_name")
      .eq("result_token", token)
      .is("deleted_at", null)
      .maybeSingle();

    // A query error here usually means migration 0004 hasn't been applied
    // (no result_token / deleted_at column) — surface as "unavailable".
    if (teamErr) {
      console.error("[results] team lookup failed:", teamErr.message);
      return { status: "unavailable" };
    }
    if (!team) return { status: "not_found" };

    const { data: hackathon, error: hkErr } = await admin
      .from("hackathons")
      .select("name, venue, start_date, end_date, results_published")
      .eq("id", team.hackathon_id)
      .single();

    if (hkErr) {
      console.error("[results] hackathon lookup failed:", hkErr.message);
      return { status: "unavailable" };
    }
    if (!hackathon) return { status: "not_found" };
    if (!hackathon.results_published && !allowUnpublished)
      return { status: "unpublished", hackathonName: hackathon.name };

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
        // In the order the team listed them, so certificates keep that order.
        admin
          .from("team_members")
          .select("name")
          .eq("team_id", team.id)
          .order("id", { ascending: true }),
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
      const rows =
        (e as (EvalRow & { id: string; comments: string | null })[]) ?? [];
      evals = rows;

      const submittedIds = new Map<string, string>();
      for (const ev of rows) {
        if (ev.status !== "submitted") continue;
        submittedIds.set(ev.id, ev.team_id);
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
    const rank = idx >= 0 ? idx + 1 : teams.length;

    const award =
      standing && standing.overall > 0 && rank <= 3
        ? AWARDS[rank - 1]
        : "Participant";

    return {
      status: "ok",
      preview: !hackathon.results_published,
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
        leaderName: team.team_leader_name ?? null,
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
  } catch (err) {
    console.error("[results] unexpected error:", err);
    return { status: "unavailable" };
  }
}

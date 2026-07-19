"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getSiteOrigin } from "@/lib/site";
import { sendBulk, isEmailConfigured } from "@/lib/email";
import { resultEmailHtml } from "@/lib/email-templates";
import {
  computeStandings,
  round1,
  type EvalRow,
  type RoundRow,
  type TeamRow,
} from "@/lib/leaderboard";

export type PublishState = { error?: string; message?: string };

// Un-publish (or plain publish with no email) — kept simple.
export async function setResultsPublished(formData: FormData) {
  const { user } = await requireAdmin();
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const publish = String(formData.get("publish") ?? "") === "true";
  if (!hackathon_id) return;

  const supabase = await createClient();
  await supabase
    .from("hackathons")
    .update({
      results_published: publish,
      results_published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", hackathon_id);

  await logAudit({
    actorId: user.id,
    action: publish ? "results.publish" : "results.unpublish",
    entity: "hackathon",
    entityId: hackathon_id,
  });

  revalidatePath("/admin/leaderboard");
}

type TeamWithLeader = TeamRow & {
  team_leader_name: string | null;
  team_leader_email: string | null;
  result_token: string;
};

// Publish results AND email every team leader their private result +
// certificate links. Never throws; reports how many emails were sent.
export async function publishResultsAndEmail(
  _prev: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const { user } = await requireAdmin();
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  if (!hackathon_id) return { error: "Missing hackathon." };

  const supabase = await createClient();

  const { data: hk } = await supabase
    .from("hackathons")
    .select("name")
    .eq("id", hackathon_id)
    .single();
  if (!hk) return { error: "Hackathon not found." };

  // Mark published first, so results are visible even if email has issues.
  await supabase
    .from("hackathons")
    .update({
      results_published: true,
      results_published_at: new Date().toISOString(),
    })
    .eq("id", hackathon_id);

  // Gather teams + standings for rank/score in the email.
  const [{ data: teamRows }, { data: roundRows }] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "id, team_code, name, track, college, tiebreak_priority, team_leader_name, team_leader_email, result_token",
      )
      .eq("hackathon_id", hackathon_id)
      .is("deleted_at", null),
    supabase
      .from("rounds")
      .select("id, name")
      .eq("hackathon_id", hackathon_id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  const teams = (teamRows as TeamWithLeader[]) ?? [];
  const rounds = (roundRows as RoundRow[]) ?? [];
  const roundIds = rounds.map((r) => r.id);

  let evals: EvalRow[] = [];
  const maxCriterion: Record<string, number> = {};
  if (roundIds.length) {
    const { data: e } = await supabase
      .from("evaluations")
      .select("id, round_id, team_id, total_score, status")
      .in("round_id", roundIds);
    const rows = (e as (EvalRow & { id: string })[]) ?? [];
    evals = rows;
    const submitted = new Map<string, string>();
    for (const ev of rows)
      if (ev.status === "submitted") submitted.set(ev.id, ev.team_id);
    const ids = [...submitted.keys()];
    if (ids.length) {
      const { data: scores } = await supabase
        .from("evaluation_scores")
        .select("evaluation_id, score")
        .in("evaluation_id", ids);
      for (const s of scores ?? []) {
        const t = submitted.get(s.evaluation_id);
        if (t) maxCriterion[t] = Math.max(maxCriterion[t] ?? 0, Number(s.score));
      }
    }
  }

  const standings = computeStandings(teams, rounds, evals, { maxCriterion });
  const origin = await getSiteOrigin();

  const messages: { to: string; subject: string; html: string }[] = [];
  let noEmail = 0;
  standings.forEach((s, i) => {
    const team = teams.find((t) => t.id === s.team.id);
    const email = team?.team_leader_email?.trim();
    if (!team || !email) {
      noEmail++;
      return;
    }
    const resultsUrl = `${origin}/results/${team.result_token}`;
    messages.push({
      to: email,
      subject: `🎉 Results Published — ${hk.name}`,
      html: resultEmailHtml({
        leaderName: team.team_leader_name || "Team leader",
        teamName: team.name,
        hackathonName: hk.name,
        rank: i + 1,
        totalTeams: teams.length,
        overall: round1(s.overall),
        rounds: rounds.map((r) => ({
          name: r.name,
          score: round1(s.roundAverages[r.id] ?? 0),
        })),
        resultsUrl,
        certificateUrl: `${resultsUrl}/certificate`,
      }),
    });
  });

  const configured = isEmailConfigured();
  const results = configured ? await sendBulk(messages) : [];
  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  await logAudit({
    actorId: user.id,
    action: "results.publish",
    entity: "hackathon",
    entityId: hackathon_id,
    meta: {
      name: hk.name,
      detail: configured
        ? `emailed ${sent}/${messages.length} leaders${failed ? `, ${failed} failed` : ""}`
        : "published; email not configured",
    },
  });

  revalidatePath("/admin/leaderboard");

  if (!configured)
    return {
      message:
        "Results published. Email isn't configured yet, so no emails were sent — set the SMTP env vars to enable them.",
    };
  if (messages.length === 0)
    return {
      message: `Results published, but no team leaders have an email on file${
        noEmail ? ` (${noEmail} team${noEmail === 1 ? "" : "s"})` : ""
      }, so nothing was emailed.`,
    };
  if (failed > 0)
    return {
      error: `Results published and ${sent} of ${messages.length} emails sent. ${failed} failed — check the SMTP settings / App Password.`,
    };
  return {
    message: `✓ Results published and emailed to ${sent} team leader${sent === 1 ? "" : "s"}.`,
  };
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** How long a saved draft may sit untouched before the judge is reminded. */
export const DRAFT_REMINDER_HOURS = 5;
export const DRAFT_REMINDER_MS = DRAFT_REMINDER_HOURS * 60 * 60 * 1000;

/**
 * The moment a draft must have been saved before to count as "left behind".
 * Lives here rather than in the page because reading the clock while
 * rendering a component is impure.
 */
export function staleDraftCutoff(): string {
  return new Date(Date.now() - DRAFT_REMINDER_MS).toISOString();
}

/**
 * Submit every draft whose event deadline has passed.
 *
 * There is no cron here, the same as the registration form's one-hour window:
 * the sweep runs whenever anyone reads evaluations (a judge opening their
 * dashboard, an admin opening the leaderboard), which is enough to guarantee a
 * draft is never left scoring nothing after the deadline.
 *
 * Runs with the service role because it closes other people's drafts, which
 * RLS rightly forbids to both judges and the page that triggers it.
 * `submitted_at` is set to the deadline rather than now, so the record says
 * when scoring actually closed. Scores themselves are already correct — a
 * trigger keeps `total_score` in step with every saved criterion.
 */
export async function finalizeExpiredEvaluations(): Promise<number> {
  if (!process.env.SUPABASE_SECRET_KEY) return 0;

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await supabase
    .from("hackathons")
    .select("id, evaluation_deadline")
    .is("deleted_at", null)
    .not("evaluation_deadline", "is", null)
    .lte("evaluation_deadline", nowIso);

  if (!due || due.length === 0) return 0;

  let closed = 0;
  for (const hackathon of due) {
    const { data: rounds } = await supabase
      .from("rounds")
      .select("id")
      .eq("hackathon_id", hackathon.id)
      .is("deleted_at", null);

    const roundIds = (rounds ?? []).map((r) => r.id);
    if (roundIds.length === 0) continue;

    const { data: updated } = await supabase
      .from("evaluations")
      .update({
        status: "submitted",
        submitted_at: hackathon.evaluation_deadline,
        auto_submitted: true,
      })
      .eq("status", "draft")
      .in("round_id", roundIds)
      .select("id");

    closed += updated?.length ?? 0;
  }

  return closed;
}

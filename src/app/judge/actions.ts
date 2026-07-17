"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireJudge } from "@/lib/auth";

export type EvalState = { error?: string; message?: string };

// Save an evaluation as a draft or submit it (which locks it). Scores are
// written while the row is still a draft, then the status is flipped so the
// RLS "scores writable only while draft" rule doesn't block the submit.
export async function saveEvaluation(
  _prev: EvalState,
  formData: FormData,
): Promise<EvalState> {
  const { user } = await requireJudge();
  const round_id = String(formData.get("round_id") ?? "");
  const team_id = String(formData.get("team_id") ?? "");
  const comments = String(formData.get("comments") ?? "").trim() || null;
  const mode = String(formData.get("mode") ?? "draft");

  if (!round_id || !team_id) return { error: "Missing round or team." };

  const supabase = await createClient();

  // Pull the rubric so we can validate score ranges.
  const { data: criteria } = await supabase
    .from("rubric_criteria")
    .select("id, name, max_marks")
    .eq("round_id", round_id);

  if (!criteria || criteria.length === 0)
    return { error: "This round has no rubric yet." };

  const scores: { criterion_id: string; score: number }[] = [];
  for (const c of criteria) {
    const raw = formData.get(`score_${c.id}`);
    const value = raw === null || raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value) || value < 0)
      return { error: `Invalid score for ${c.name}.` };
    if (value > Number(c.max_marks))
      return { error: `${c.name} can't exceed ${c.max_marks}.` };
    scores.push({ criterion_id: c.id, score: value });
  }

  // Upsert the evaluation as a draft first and get its id.
  const { data: evalRow, error: evalErr } = await supabase
    .from("evaluations")
    .upsert(
      { round_id, team_id, judge_id: user!.id, comments, status: "draft" },
      { onConflict: "round_id,team_id,judge_id" },
    )
    .select("id")
    .single();

  if (evalErr || !evalRow)
    return { error: evalErr?.message ?? "Could not save. Is it locked?" };

  // Upsert the per-criterion scores.
  const { error: scoreErr } = await supabase
    .from("evaluation_scores")
    .upsert(
      scores.map((s) => ({ evaluation_id: evalRow.id, ...s })),
      { onConflict: "evaluation_id,criterion_id" },
    );

  if (scoreErr) return { error: scoreErr.message };

  if (mode === "submit") {
    const { error: submitErr } = await supabase
      .from("evaluations")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", evalRow.id);
    if (submitErr) return { error: submitErr.message };

    await supabase.from("audit_logs").insert({
      actor_id: user!.id,
      action: "evaluation.submit",
      entity: "evaluation",
      entity_id: evalRow.id,
    });
  } else {
    await supabase.from("audit_logs").insert({
      actor_id: user!.id,
      action: "evaluation.draft",
      entity: "evaluation",
      entity_id: evalRow.id,
    });
  }

  revalidatePath("/judge");
  revalidatePath(`/judge/rounds/${round_id}/teams/${team_id}`);
  return {
    message: mode === "submit" ? "Evaluation submitted." : "Draft saved.",
  };
}

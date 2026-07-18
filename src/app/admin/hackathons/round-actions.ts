"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type FormState = { error?: string };

// ---- Round participants (shortlisting / promotion) ----------------------

// Replace the set of teams participating in a round. An empty selection clears
// the shortlist, which the app reads as "all hackathon teams participate".
export async function setRoundParticipants(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const round_id = String(formData.get("round_id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const teamIds = formData.getAll("team_ids").map(String).filter(Boolean);
  if (!round_id) return;

  const supabase = await createClient();

  // Full replace: clear then insert the current selection.
  await supabase.from("round_teams").delete().eq("round_id", round_id);
  if (teamIds.length > 0) {
    await supabase
      .from("round_teams")
      .insert(teamIds.map((team_id) => ({ round_id, team_id })));
  }

  await logAudit({
    actorId: user.id,
    action: "round.shortlist",
    entity: "round",
    entityId: round_id,
    meta: { detail: `${teamIds.length} team(s) shortlisted` },
  });

  revalidatePath(`/admin/hackathons/${hackathon_id}/rounds/${round_id}`);
  revalidatePath("/admin/leaderboard");
}

// ---- Rounds -------------------------------------------------------------

export async function createRound(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Round name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("rounds").insert({
    hackathon_id,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    starts_at: String(formData.get("starts_at") ?? "") || null,
    ends_at: String(formData.get("ends_at") ?? "") || null,
    sort_order: Number(formData.get("sort_order") ?? 0),
  });

  if (error) return { error: error.message };
  revalidatePath(`/admin/hackathons/${hackathon_id}`);
  return {};
}

export async function updateRound(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Round name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rounds")
    .update({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      starts_at: String(formData.get("starts_at") ?? "") || null,
      ends_at: String(formData.get("ends_at") ?? "") || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/admin/hackathons/${hackathon_id}/rounds/${id}`);
  revalidatePath(`/admin/hackathons/${hackathon_id}`);
  return {};
}

export async function deleteRound(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const supabase = await createClient();

  const { data: snapshot } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", id)
    .single();

  // Soft delete — recoverable from Trash for 30 days.
  await supabase
    .from("rounds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  await logAudit({
    actorId: user.id,
    action: "round.delete",
    entity: "round",
    entityId: id,
    meta: { name: snapshot?.name, snapshot },
  });

  revalidatePath(`/admin/hackathons/${hackathon_id}`);
  redirect(`/admin/hackathons/${hackathon_id}`);
}

// ---- Rubric criteria ----------------------------------------------------

export async function addCriterion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const round_id = String(formData.get("round_id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const max_marks = Number(formData.get("max_marks") ?? 0);
  if (!name) return { error: "Criterion name is required." };
  if (!max_marks || max_marks <= 0)
    return { error: "Max marks must be greater than 0." };

  const supabase = await createClient();
  const { error } = await supabase.from("rubric_criteria").insert({
    round_id,
    name,
    max_marks,
    weight: Number(formData.get("weight") ?? 1),
    sort_order: Number(formData.get("sort_order") ?? 0),
  });

  if (error) return { error: error.message };

  // Rubric changes are audit-sensitive ("who changed the rubric after judging
  // started?"), so record them explicitly.
  await logAudit({
    action: "rubric.add_criterion",
    entity: "round",
    entityId: round_id,
    meta: { name, detail: `max ${max_marks}` },
  });

  revalidatePath(`/admin/hackathons/${hackathon_id}/rounds/${round_id}`);
  return {};
}

export async function deleteCriterion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const round_id = String(formData.get("round_id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const supabase = await createClient();
  await supabase.from("rubric_criteria").delete().eq("id", id);

  await logAudit({
    action: "rubric.delete_criterion",
    entity: "rubric_criteria",
    entityId: id,
    meta: { detail: `round ${round_id}` },
  });

  revalidatePath(`/admin/hackathons/${hackathon_id}/rounds/${round_id}`);
}

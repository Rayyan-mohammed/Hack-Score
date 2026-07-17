"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

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
  const id = String(formData.get("id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const supabase = await createClient();
  await supabase.from("rounds").delete().eq("id", id);
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
  revalidatePath(`/admin/hackathons/${hackathon_id}/rounds/${round_id}`);
  return {};
}

export async function deleteCriterion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const round_id = String(formData.get("round_id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const supabase = await createClient();
  await supabase.from("rubric_criteria").delete().eq("id", id);
  revalidatePath(`/admin/hackathons/${hackathon_id}/rounds/${round_id}`);
}

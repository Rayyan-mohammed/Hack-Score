"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type FormState = { error?: string };

function parseHackathon(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    venue: String(formData.get("venue") ?? "").trim() || null,
    start_date: String(formData.get("start_date") ?? "") || null,
    end_date: String(formData.get("end_date") ?? "") || null,
    min_team_size: Number(formData.get("min_team_size") ?? 1),
    max_team_size: Number(formData.get("max_team_size") ?? 6),
  };
}

export async function createHackathon(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = parseHackathon(formData);
  if (!values.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { user } = await getSessionUser();

  const { data, error } = await supabase
    .from("hackathons")
    .insert({ ...values, created_by: user?.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/hackathons");
  redirect(`/admin/hackathons/${data.id}`);
}

export async function updateHackathon(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const values = parseHackathon(formData);
  if (!values.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hackathons")
    .update(values)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/hackathons");
  revalidatePath(`/admin/hackathons/${id}`);
  return {};
}

// Soft delete: mark deleted_at instead of removing rows, so the hackathon and
// everything under it can be restored from Trash within 30 days. A snapshot of
// the row is written to the audit log as a lightweight pre-delete backup.
export async function deleteHackathon(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  const { data: snapshot } = await supabase
    .from("hackathons")
    .select("*")
    .eq("id", id)
    .single();

  // Cascade the soft delete to children so a hidden hackathon's rounds/teams
  // also disappear from judge views. Restore reverses this (see trash actions).
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("hackathons").update({ deleted_at: now }).eq("id", id),
    supabase
      .from("rounds")
      .update({ deleted_at: now })
      .eq("hackathon_id", id)
      .is("deleted_at", null),
    supabase
      .from("teams")
      .update({ deleted_at: now })
      .eq("hackathon_id", id)
      .is("deleted_at", null),
  ]);

  await logAudit({
    actorId: user.id,
    action: "hackathon.delete",
    entity: "hackathon",
    entityId: id,
    meta: { name: snapshot?.name, snapshot },
  });

  revalidatePath("/admin/hackathons");
  redirect("/admin/hackathons");
}

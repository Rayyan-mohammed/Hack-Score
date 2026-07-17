"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

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

export async function deleteHackathon(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("hackathons").delete().eq("id", id);
  revalidatePath("/admin/hackathons");
  redirect("/admin/hackathons");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type FormState = { error?: string; message?: string };

/** Links are handed to participants, so only accept absolute http(s) URLs. */
function normaliseUrl(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Registration switch + the three links the confirmation page offers
 * (WhatsApp group, PPT template, resource pack).
 */
export async function updateRegistrationSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  if (!hackathon_id) return { error: "Pick a hackathon first." };

  const fields = {
    whatsapp_group_url: normaliseUrl(String(formData.get("whatsapp_group_url") ?? "")),
    ppt_template_url: normaliseUrl(String(formData.get("ppt_template_url") ?? "")),
    resources_url: normaliseUrl(String(formData.get("resources_url") ?? "")),
  };

  const labels: Record<keyof typeof fields, string> = {
    whatsapp_group_url: "WhatsApp group link",
    ppt_template_url: "PPT template link",
    resources_url: "Important resources link",
  };
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    if (fields[key] === undefined)
      return { error: `${labels[key]} must be a full http(s) URL.` };
  }

  const registration_open = formData.get("registration_open") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("hackathons")
    .update({ ...fields, registration_open })
    .eq("id", hackathon_id);

  if (error) return { error: error.message };

  await logAudit({
    actorId: user.id,
    action: "registration.settings",
    entity: "hackathon",
    entityId: hackathon_id,
    meta: { registration_open },
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/teams");
  revalidatePath(`/register/${hackathon_id}`);
  return {
    message: registration_open
      ? "Saved. The registration form is open."
      : "Saved. The registration form is closed.",
  };
}

/** Add one problem statement to a hackathon's catalogue. */
export async function addProblemStatement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const ps_code = String(formData.get("ps_code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!hackathon_id) return { error: "Pick a hackathon first." };
  if (!ps_code) return { error: "Problem statement ID is required." };
  if (title.length < 3)
    return { error: "Problem statement must be at least 3 characters." };

  const supabase = await createClient();

  // Append to the end of the list.
  const { data: last } = await supabase
    .from("problem_statements")
    .select("sort_order")
    .eq("hackathon_id", hackathon_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("problem_statements").insert({
    hackathon_id,
    ps_code,
    title,
    description,
    sort_order: Number(last?.sort_order ?? 0) + 1,
  });

  if (error)
    return {
      error: error.code === "23505"
        ? `${ps_code} already exists for this hackathon.`
        : error.message,
    };

  await logAudit({
    actorId: user.id,
    action: "problem_statement.create",
    entity: "hackathon",
    entityId: hackathon_id,
    meta: { ps_code, title },
  });

  revalidatePath("/admin/registrations");
  return { message: `Added ${ps_code}.` };
}

export async function deleteProblemStatement(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: snapshot } = await supabase
    .from("problem_statements")
    .select("hackathon_id, ps_code, title")
    .eq("id", id)
    .maybeSingle();

  // Registrations keep the code and text they were submitted with — the FK is
  // ON DELETE SET NULL — so removing a statement never rewrites history.
  await supabase.from("problem_statements").delete().eq("id", id);

  await logAudit({
    actorId: user.id,
    action: "problem_statement.delete",
    entity: "hackathon",
    entityId: snapshot?.hackathon_id,
    meta: { snapshot },
  });

  revalidatePath("/admin/registrations");
}

/** Remove a registration outright (junk drafts, duplicates). */
export async function deleteRegistration(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: snapshot } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("registrations").delete().eq("id", id);

  await logAudit({
    actorId: user.id,
    action: "registration.delete",
    entity: "registration",
    entityId: id,
    meta: { snapshot },
  });

  revalidatePath("/admin/registrations");
}

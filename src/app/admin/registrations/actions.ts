"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  createTeamFromRegistration,
  getRegistrationHackathon,
} from "@/lib/registrations";

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

const RESOURCES_BUCKET = "event-resources";
/** Server Actions are capped by `serverActions.bodySizeLimit` in next.config —
 *  keep this comfortably under it so a too-large deck fails with our message
 *  rather than a framework error. Bigger decks go up as a link instead. */
const PPT_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const PPT_EXTENSIONS = [".ppt", ".pptx", ".pdf"];

/**
 * Put the uploaded PPT template in the public event-resources bucket and hand
 * back its URL. Uses the service role (server-only, already behind
 * requireAdmin), the same arrangement as sponsor logos, so the bucket needs no
 * client-facing write policy. The `?download=` parameter makes Supabase serve
 * it as an attachment under its original name instead of opening it inline.
 */
async function uploadPptTemplate(
  hackathonId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  const ext = PPT_EXTENSIONS.find((e) => file.name.toLowerCase().endsWith(e));
  if (!ext)
    return { error: "The PPT template must be a .ppt, .pptx or .pdf file." };
  if (file.size > PPT_MAX_BYTES)
    return {
      error:
        "The PPT template must be under 4 MB. Host a larger deck (Drive, OneDrive…) and paste its link instead.",
    };
  if (!process.env.SUPABASE_SECRET_KEY)
    return {
      error: "Server is missing SUPABASE_SECRET_KEY (needed to store uploads).",
    };

  try {
    const admin = createAdminClient();
    const path = `${hackathonId}/${crypto.randomUUID()}${ext}`;
    const { error } = await admin.storage
      .from(RESOURCES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: `Upload failed: ${error.message}` };
    const {
      data: { publicUrl },
    } = admin.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
    return { url: `${publicUrl}?download=${encodeURIComponent(file.name)}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }
}

/**
 * Registration switch + the three links the confirmation page offers
 * (WhatsApp group, PPT template, resource pack). The PPT template can also be
 * uploaded outright, in which case the uploaded file wins over the link box.
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

  // An uploaded deck replaces whatever is in the link box — organisers who
  // upload expect that file to be the one participants get.
  const upload = formData.get("ppt_template_file");
  if (upload instanceof File && upload.size > 0) {
    const up = await uploadPptTemplate(hackathon_id, upload);
    if (up.error || !up.url) return { error: up.error ?? "Upload failed." };
    fields.ppt_template_url = up.url;
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

/**
 * Create the team for a submitted registration that didn't get one — usually
 * because the roster was incomplete when the one-hour window closed. Reuses
 * exactly the same routine as the public form, so a manually created team is
 * identical to an automatic one. Feedback comes back as a query param, since
 * this is a plain row-level form.
 */
export async function createTeamForRegistration(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const hackathonId = String(formData.get("hackathon_id") ?? "");
  const back = `/admin/registrations?h=${hackathonId}`;
  if (!id) redirect(back);

  const supabase = await createClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("token, hackathon_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!registration)
    redirect(`${back}&err=${encodeURIComponent("Registration not found.")}`);
  if (registration.status !== "submitted")
    redirect(
      `${back}&err=${encodeURIComponent("Only submitted registrations can become teams.")}`,
    );

  const hackathon = await getRegistrationHackathon(registration.hackathon_id);
  if (!hackathon)
    redirect(`${back}&err=${encodeURIComponent("Hackathon not found.")}`);

  const result = await createTeamFromRegistration(hackathon, registration.token);

  await logAudit({
    actorId: user.id,
    action: "registration.create_team",
    entity: "registration",
    entityId: id,
    meta: { teamCode: result.teamCode, error: result.error },
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/teams");

  redirect(
    result.teamCode
      ? `${back}&msg=${encodeURIComponent(`Team ${result.teamCode} created.`)}`
      : `${back}&err=${encodeURIComponent(result.error ?? "Could not create the team.")}`,
  );
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

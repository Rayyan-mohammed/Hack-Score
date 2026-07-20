"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type SponsorState = { error?: string; message?: string };

const BUCKET = "sponsor-logos";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const OK_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
];

/** Read the label from either the preset dropdown or the custom text field. */
function readLabel(formData: FormData): string {
  const preset = String(formData.get("label_preset") ?? "").trim();
  if (preset && preset !== "__custom__") return preset;
  return String(formData.get("label_custom") ?? "").trim();
}

/**
 * Upload a logo to the public sponsor-logos bucket and return its public URL.
 * Uses the service role (server-only, already behind requireAdmin) so no
 * storage RLS policy is needed for writes.
 */
async function uploadLogo(
  hackathonId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (file.size > MAX_BYTES) return { error: "Logo must be under 2 MB." };
  if (!OK_TYPES.includes(file.type))
    return { error: "Logo must be a PNG, JPG, SVG or WebP image." };
  if (!process.env.SUPABASE_SECRET_KEY)
    return { error: "Server is missing SUPABASE_SECRET_KEY (needed to store logos)." };

  try {
    const admin = createAdminClient();
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${hackathonId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: `Logo upload failed: ${error.message}` };
    const {
      data: { publicUrl },
    } = admin.storage.from(BUCKET).getPublicUrl(path);
    return { url: publicUrl };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Logo upload failed.",
    };
  }
}

// Postgres unique-violation → a friendly message about the order slot.
function orderTaken(message: string, order: number) {
  return /duplicate key|unique/i.test(message)
    ? `Order ${order} is already used by another sponsor — pick a different number.`
    : message;
}

export async function createSponsor(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const { user } = await requireAdmin();
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const label = readLabel(formData);
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const file = formData.get("logo");

  if (!hackathon_id) return { error: "Missing hackathon." };
  if (!name) return { error: "Sponsor name is required." };
  if (!label) return { error: "A label (e.g. “Powered by”) is required." };
  if (!Number.isFinite(sort_order) || sort_order < 1)
    return { error: "Order must be 1 or higher." };
  if (!(file instanceof File) || file.size === 0)
    return { error: "A sponsor logo is required." };

  const up = await uploadLogo(hackathon_id, file);
  if (up.error || !up.url) return { error: up.error ?? "Logo upload failed." };

  const supabase = await createClient();
  const { error } = await supabase.from("sponsors").insert({
    hackathon_id,
    name,
    label,
    sort_order,
    logo_url: up.url,
  });

  if (error) return { error: orderTaken(error.message, sort_order) };

  await logAudit({
    actorId: user.id,
    action: "sponsor.create",
    entity: "hackathon",
    entityId: hackathon_id,
    meta: { name, detail: `${label} · order ${sort_order}` },
  });

  revalidatePath(`/admin/hackathons/${hackathon_id}`);
  revalidatePath("/admin/leaderboard");
  return { message: `Sponsor “${name}” added.` };
}

export async function updateSponsor(
  _prev: SponsorState,
  formData: FormData,
): Promise<SponsorState> {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const label = readLabel(formData);
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const file = formData.get("logo");

  if (!id) return { error: "Missing sponsor." };
  if (!name) return { error: "Sponsor name is required." };
  if (!label) return { error: "A label is required." };
  if (!Number.isFinite(sort_order) || sort_order < 1)
    return { error: "Order must be 1 or higher." };

  const patch: Record<string, unknown> = { name, label, sort_order };

  // Replacing the logo is optional when editing.
  if (file instanceof File && file.size > 0) {
    const up = await uploadLogo(hackathon_id, file);
    if (up.error || !up.url) return { error: up.error ?? "Logo upload failed." };
    patch.logo_url = up.url;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sponsors").update(patch).eq("id", id);
  if (error) return { error: orderTaken(error.message, sort_order) };

  await logAudit({
    actorId: user.id,
    action: "sponsor.update",
    entity: "sponsor",
    entityId: id,
    meta: { name, detail: `${label} · order ${sort_order}` },
  });

  revalidatePath(`/admin/hackathons/${hackathon_id}`);
  revalidatePath("/admin/leaderboard");
  return { message: "Sponsor saved successfully." };
}

export async function deleteSponsor(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: snapshot } = await supabase
    .from("sponsors")
    .select("name")
    .eq("id", id)
    .single();

  // Removing a sponsor is non-destructive to scores — no confirmation needed.
  await supabase.from("sponsors").delete().eq("id", id);

  await logAudit({
    actorId: user.id,
    action: "sponsor.delete",
    entity: "sponsor",
    entityId: id,
    meta: { name: snapshot?.name },
  });

  revalidatePath(`/admin/hackathons/${hackathon_id}`);
  revalidatePath("/admin/leaderboard");
}

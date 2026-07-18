"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Kind = "hackathon" | "round" | "team";
const TABLE: Record<Kind, string> = {
  hackathon: "hackathons",
  round: "rounds",
  team: "teams",
};

export async function restoreEntity(formData: FormData) {
  const { user } = await requireAdmin();
  const kind = String(formData.get("kind") ?? "") as Kind;
  const id = String(formData.get("id") ?? "");
  if (!TABLE[kind] || !id) return;

  const supabase = await createClient();
  await supabase.from(TABLE[kind]).update({ deleted_at: null }).eq("id", id);

  // Restoring a hackathon also brings back the rounds/teams it took down.
  if (kind === "hackathon") {
    await Promise.all([
      supabase.from("rounds").update({ deleted_at: null }).eq("hackathon_id", id),
      supabase.from("teams").update({ deleted_at: null }).eq("hackathon_id", id),
    ]);
  }

  await logAudit({
    actorId: user.id,
    action: `${kind}.restore`,
    entity: kind,
    entityId: id,
  });

  revalidatePath("/admin/trash");
  revalidatePath("/admin/hackathons");
  revalidatePath("/admin/teams");
}

export async function purgeEntity(formData: FormData) {
  const { user } = await requireAdmin();
  const kind = String(formData.get("kind") ?? "") as Kind;
  const id = String(formData.get("id") ?? "");
  if (!TABLE[kind] || !id) return;

  const supabase = await createClient();
  // Permanent: only allowed on already soft-deleted rows.
  await supabase
    .from(TABLE[kind])
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null);

  await logAudit({
    actorId: user.id,
    action: `${kind}.purge`,
    entity: kind,
    entityId: id,
  });

  revalidatePath("/admin/trash");
}

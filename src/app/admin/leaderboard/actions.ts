"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Toggle whether teams can see their results via their private link.
export async function setResultsPublished(formData: FormData) {
  const { user } = await requireAdmin();
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const publish = String(formData.get("publish") ?? "") === "true";
  if (!hackathon_id) return;

  const supabase = await createClient();
  await supabase
    .from("hackathons")
    .update({
      results_published: publish,
      results_published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", hackathon_id);

  await logAudit({
    actorId: user.id,
    action: publish ? "results.publish" : "results.unpublish",
    entity: "hackathon",
    entityId: hackathon_id,
  });

  revalidatePath("/admin/leaderboard");
}

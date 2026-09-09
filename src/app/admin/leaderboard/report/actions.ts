"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { readReportConfigForm } from "@/lib/report-config";

export type FormState = { error?: string; message?: string };

/**
 * Save the letterhead, report particulars and signatory details used by the
 * PDF and the Excel workbook. Stored on the hackathon so both exports — and
 * anyone regenerating the report later — use the same values.
 */
export async function saveReportConfig(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  const hackathonId = String(formData.get("hackathon_id") ?? "");
  if (!hackathonId) return { error: "Missing hackathon." };

  const config = readReportConfigForm((key) =>
    String(formData.get(key) ?? "").trim(),
  );

  if (!config.institution) return { error: "Institution name is required." };
  if (!config.reportTitle) return { error: "Report title is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hackathons")
    .update({ report_config: config })
    .eq("id", hackathonId);

  if (error) return { error: error.message };

  await logAudit({
    actorId: user.id,
    action: "report.settings",
    entity: "hackathon",
    entityId: hackathonId,
    meta: { reportTitle: config.reportTitle, refNumber: config.refNumber },
  });

  revalidatePath(`/admin/leaderboard/report`);
  return { message: "Report details saved. They apply to the PDF and Excel." };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendBulk, isEmailConfigured } from "@/lib/email";
import { customEmailHtml, fillVars } from "@/lib/email-templates";

export type SendState = { error?: string; message?: string };

export async function sendCustomEmails(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const { user } = await requireAdmin();
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const recipients = [
    ...new Set(formData.getAll("recipients").map(String).filter(Boolean)),
  ];

  if (!hackathon_id) return { error: "Choose a hackathon." };
  if (recipients.length === 0)
    return { error: "Select at least one team leader." };
  if (subject.length < 5)
    return { error: "Subject must be at least 5 characters." };
  if (body.length < 10) return { error: "Body must be at least 10 characters." };
  if (!isEmailConfigured())
    return {
      error:
        "Email isn't configured. Set the SMTP env vars (Gmail App Password) first.",
    };

  const supabase = await createClient();
  const { data: hk } = await supabase
    .from("hackathons")
    .select("name")
    .eq("id", hackathon_id)
    .single();
  const { data: teams } = await supabase
    .from("teams")
    .select("name, team_leader_name, team_leader_email")
    .eq("hackathon_id", hackathon_id)
    .is("deleted_at", null);

  const byEmail = new Map<
    string,
    { name: string; team_leader_name: string | null }
  >();
  for (const t of teams ?? [])
    if (t.team_leader_email?.trim())
      byEmail.set(t.team_leader_email.trim(), {
        name: t.name,
        team_leader_name: t.team_leader_name,
      });

  const hackathonName = hk?.name ?? "";
  const messages = recipients
    .filter((e) => byEmail.has(e))
    .map((email) => {
      const t = byEmail.get(email)!;
      const vars = {
        leaderName: t.team_leader_name || "Team leader",
        teamName: t.name,
        hackathonName,
      };
      const subj = fillVars(subject, vars);
      return { to: email, subject: subj, html: customEmailHtml(subj, fillVars(body, vars)) };
    });

  if (messages.length === 0)
    return { error: "None of the selected recipients are valid for this hackathon." };

  const results = await sendBulk(messages);
  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  await logAudit({
    actorId: user.id,
    action: "email.custom_send",
    entity: "hackathon",
    entityId: hackathon_id,
    meta: {
      name: hackathonName,
      detail: `sent ${sent}/${messages.length}${failed ? `, ${failed} failed` : ""} · "${subject.slice(0, 40)}"`,
    },
  });

  if (failed > 0)
    return {
      error: `Sent ${sent} of ${messages.length}. ${failed} failed — check the SMTP settings.`,
    };
  return {
    message: `✓ Email sent successfully to ${sent} team leader${sent === 1 ? "" : "s"}.`,
  };
}

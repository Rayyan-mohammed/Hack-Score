"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { ALL_JUDGES } from "@/lib/judges";
import { logAudit } from "@/lib/audit";

export type FormState = { error?: string; message?: string };

// Create a judge account with a password so they can log in right away.
export async function createJudge(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password)
    return { error: "Email and password are required." };
  if (password.length < 6)
    return { error: "Password must be at least 6 characters." };

  if (!process.env.SUPABASE_SECRET_KEY)
    return { error: "Server is missing SUPABASE_SECRET_KEY." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: "judge" },
  });

  if (error) return { error: error.message };

  // The admin set a temporary password, so require the judge to change it on
  // first login. The profile row is created by the handle_new_user trigger.
  if (data.user)
    await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.user.id);

  revalidatePath("/admin/judges");
  return {
    message: `Created judge ${email}. They'll be asked to set a new password on first login.`,
  };
}

export async function assignJudge(formData: FormData) {
  const { user } = await requireAdmin();
  const judge_id = String(formData.get("judge_id") ?? "");
  const round_id = String(formData.get("round_id") ?? "");
  if (!judge_id || !round_id) return;

  // Teams ticked in the form. None ticked means "score every team in the
  // round", which is what a judge got before per-team assignment existed.
  const team_ids = formData
    .getAll("team_ids")
    .map((t) => String(t))
    .filter(Boolean);

  const supabase = await createClient();

  // "All judges" assigns the whole panel in one go. Judges already on the
  // round are left as they are rather than erroring, so this is safe to repeat
  // and safe to use again after adding a judge.
  let judgeIds = [judge_id];
  if (judge_id === ALL_JUDGES) {
    const { data: judges } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "judge");
    judgeIds = (judges ?? []).map((j) => j.id);
  }
  if (judgeIds.length === 0) return;

  await supabase
    .from("round_judges")
    .upsert(
      judgeIds.map((id) => ({ judge_id: id, round_id })),
      { onConflict: "round_id,judge_id" },
    );

  // The ticked set replaces whatever the judge had for this round, so
  // unticking a team takes it away. Untouched rounds are not affected.
  await supabase
    .from("judge_teams")
    .delete()
    .eq("round_id", round_id)
    .in("judge_id", judgeIds);

  if (team_ids.length > 0)
    await supabase.from("judge_teams").insert(
      judgeIds.flatMap((id) =>
        team_ids.map((team_id) => ({ round_id, judge_id: id, team_id })),
      ),
    );

  await logAudit({
    actorId: user.id,
    action: "judge.assign",
    entity: "round",
    entityId: round_id,
    meta: {
      judges: judgeIds.length,
      teams: team_ids.length === 0 ? "all teams in the round" : team_ids.length,
    },
  });

  revalidatePath("/admin/judges");
  revalidatePath("/judge");
}

export async function unassignJudge(formData: FormData) {
  await requireAdmin();
  const judge_id = String(formData.get("judge_id") ?? "");
  const round_id = String(formData.get("round_id") ?? "");

  const supabase = await createClient();
  await supabase
    .from("round_judges")
    .delete()
    .eq("judge_id", judge_id)
    .eq("round_id", round_id);

  // Their per-team list for that round goes with it, so re-adding them later
  // starts from "every team" rather than a stale subset.
  await supabase
    .from("judge_teams")
    .delete()
    .eq("judge_id", judge_id)
    .eq("round_id", round_id);

  revalidatePath("/admin/judges");
  revalidatePath("/judge");
}

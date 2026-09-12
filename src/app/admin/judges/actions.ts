"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { ALL_JUDGES } from "@/lib/judges";

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
  await requireAdmin();
  const judge_id = String(formData.get("judge_id") ?? "");
  const round_id = String(formData.get("round_id") ?? "");
  if (!judge_id || !round_id) return;

  const supabase = await createClient();

  // "All judges": one upsert for the whole panel. Judges already on the round
  // are left as they are rather than erroring, so this is safe to repeat and
  // safe to use after adding a judge.
  if (judge_id === ALL_JUDGES) {
    const { data: judges } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "judge");
    const rows = (judges ?? []).map((j) => ({ judge_id: j.id, round_id }));
    if (rows.length > 0)
      await supabase
        .from("round_judges")
        .upsert(rows, { onConflict: "round_id,judge_id" });
    revalidatePath("/admin/judges");
    return;
  }

  await supabase
    .from("round_judges")
    .upsert({ judge_id, round_id }, { onConflict: "round_id,judge_id" });

  revalidatePath("/admin/judges");
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

  revalidatePath("/admin/judges");
}

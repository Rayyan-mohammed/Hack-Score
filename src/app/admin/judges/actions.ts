"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

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
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: "judge" },
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/judges");
  return { message: `Created judge ${email}.` };
}

export async function assignJudge(formData: FormData) {
  await requireAdmin();
  const judge_id = String(formData.get("judge_id") ?? "");
  const round_id = String(formData.get("round_id") ?? "");
  if (!judge_id || !round_id) return;

  const supabase = await createClient();
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

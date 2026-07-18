"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type PwState = { error?: string };

export async function changePassword(
  _prev: PwState,
  formData: FormData,
): Promise<PwState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8)
    return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Clear the forced-change flag now that a new password is set.
  await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  await logAudit({
    actorId: user.id,
    action: "auth.password_changed",
    entity: "profile",
    entityId: user.id,
  });

  redirect("/");
}

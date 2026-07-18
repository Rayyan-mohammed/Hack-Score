"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { error?: string; message?: string };

export async function requestReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) return { error: error.message };

  // Don't reveal whether the email exists.
  return {
    message:
      "If that email has an account, a password-reset link is on its way. Check your inbox.",
  };
}

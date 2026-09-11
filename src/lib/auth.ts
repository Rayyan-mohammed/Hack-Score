import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "judge";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  must_change_password: boolean;
};

/** The signed-in user as far as the app needs it — callers only use the id. */
export type SessionUser = { id: string; email: string | null };

/**
 * The logged-in user and their profile row (or nulls).
 *
 * Identity comes from `getClaims()`, which verifies the session JWT locally
 * against the project's (cached) ES256 public key instead of asking the Auth
 * server on every call the way `getUser()` does — that round trip was paid on
 * every click. The profile is still read fresh each request, so a role change
 * or a deleted account (its profile cascades away) takes effect immediately.
 *
 * Wrapped in React `cache` so the layout and the page rendering the same
 * request share one lookup rather than each doing their own.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) return { user: null, profile: null };

  const user: SessionUser = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, must_change_password")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as Profile) ?? null };
});

// Require any authenticated user; redirect to login otherwise.
export async function requireUser() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  return { user, profile };
}

// Require an admin; non-admins are bounced to the judge dashboard.
export async function requireAdmin() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  if (profile?.must_change_password) redirect("/change-password");
  if (profile?.role !== "admin") redirect("/judge");
  return { user, profile: profile! };
}

// Require a judge (admins are allowed through as well).
export async function requireJudge() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  if (profile?.must_change_password) redirect("/change-password");
  return { user, profile: profile! };
}

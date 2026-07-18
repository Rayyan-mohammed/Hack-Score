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

// Returns the logged-in auth user and their profile row (or nulls).
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, must_change_password")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as Profile) ?? null };
}

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

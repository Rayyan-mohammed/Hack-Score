// Server-side data access for participant registrations.
//
// The registration form is public (no account), so reads and writes go through
// the service-role client, exactly like the public results pages. Every entry
// point is keyed by either a hackathon id (the form's own URL) or the
// registration's unguessable token, and returns a typed status instead of
// throwing so the public pages degrade to a message rather than a 500.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DRAFT_WINDOW_MS,
  type RegistrationValues,
} from "@/lib/registration-form";

export type ProblemStatement = {
  id: string;
  ps_code: string;
  title: string;
  description: string | null;
};

export type RegistrationRow = {
  id: string;
  hackathon_id: string;
  token: string;
  full_name: string | null;
  sap_id: string | null;
  mobile: string | null;
  college_email: string | null;
  problem_statement_id: string | null;
  problem_statement_code: string | null;
  problem_statement: string | null;
  status: "draft" | "submitted";
  auto_submitted: boolean;
  draft_expires_at: string;
  submitted_at: string | null;
  created_at: string;
};

export type RegistrationHackathon = {
  id: string;
  name: string;
  description: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_open: boolean;
  whatsapp_group_url: string | null;
  ppt_template_url: string | null;
  resources_url: string | null;
};

const HACKATHON_COLUMNS =
  "id, name, description, venue, start_date, end_date, registration_open, " +
  "whatsapp_group_url, ppt_template_url, resources_url";

const REGISTRATION_COLUMNS =
  "id, hackathon_id, token, full_name, sap_id, mobile, college_email, " +
  "problem_statement_id, problem_statement_code, problem_statement, status, " +
  "auto_submitted, draft_expires_at, submitted_at, created_at";

/** The registration store is unusable without the service role — say so once. */
export function registrationsConfigured(): boolean {
  if (!process.env.SUPABASE_SECRET_KEY) {
    console.error("[registrations] SUPABASE_SECRET_KEY is not set");
    return false;
  }
  return true;
}

/**
 * Close every draft whose hour has run out.
 *
 * There is no cron here on purpose: the sweep runs whenever anyone reads
 * registrations (the participant reopening their link, the admin list, the
 * confirmation page), which is enough to guarantee a draft is never editable
 * past its deadline — the write paths re-check the deadline themselves.
 * `submitted_at` is set to the deadline, not to now, so the record says when
 * the window actually closed.
 */
export async function finalizeExpiredDrafts(hackathonId?: string) {
  if (!registrationsConfigured()) return;
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("registrations")
    .select("id, draft_expires_at")
    .eq("status", "draft")
    .lte("draft_expires_at", nowIso);
  if (hackathonId) query = query.eq("hackathon_id", hackathonId);

  const { data: due, error } = await query;
  if (error || !due || due.length === 0) return;

  // Row-by-row so submitted_at can carry each draft's own deadline.
  await Promise.all(
    due.map((r) =>
      supabase
        .from("registrations")
        .update({
          status: "submitted",
          auto_submitted: true,
          submitted_at: r.draft_expires_at,
        })
        .eq("id", r.id)
        .eq("status", "draft"),
    ),
  );
}

/** The hackathon a public registration form is for. */
export async function getRegistrationHackathon(
  hackathonId: string,
): Promise<RegistrationHackathon | null> {
  if (!registrationsConfigured()) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hackathons")
    .select(HACKATHON_COLUMNS)
    .eq("id", hackathonId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as unknown as RegistrationHackathon) ?? null;
}

/** The newest live hackathon that is still accepting registrations. */
export async function getOpenHackathon(): Promise<RegistrationHackathon | null> {
  if (!registrationsConfigured()) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hackathons")
    .select(HACKATHON_COLUMNS)
    .is("deleted_at", null)
    .eq("registration_open", true)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as RegistrationHackathon) ?? null;
}

export async function listProblemStatements(
  hackathonId: string,
): Promise<ProblemStatement[]> {
  if (!registrationsConfigured()) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("problem_statements")
    .select("id, ps_code, title, description")
    .eq("hackathon_id", hackathonId)
    .order("sort_order", { ascending: true })
    .order("ps_code", { ascending: true });
  return (data as unknown as ProblemStatement[]) ?? [];
}

/** A participant's own registration, by their private token. */
export async function getRegistrationByToken(
  token: string,
): Promise<RegistrationRow | null> {
  if (!registrationsConfigured()) return null;
  // Finalise first so a draft that expired while the tab was closed comes back
  // as a locked submission rather than an editable form.
  await finalizeExpiredDrafts();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("token", token)
    .maybeSingle();
  return (data as unknown as RegistrationRow) ?? null;
}

/** Every registration for a hackathon, newest first (admin view). */
export async function listRegistrations(
  hackathonId: string,
): Promise<RegistrationRow[]> {
  if (!registrationsConfigured()) return [];
  await finalizeExpiredDrafts(hackathonId);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("hackathon_id", hackathonId)
    .order("created_at", { ascending: false });
  return (data as unknown as RegistrationRow[]) ?? [];
}

/** Row -> the shape the form and validators work with. */
export function toValues(row: RegistrationRow): RegistrationValues {
  return {
    full_name: row.full_name ?? "",
    sap_id: row.sap_id ?? "",
    mobile: row.mobile ?? "",
    college_email: row.college_email ?? "",
    problem_statement_code: row.problem_statement_code ?? "",
    problem_statement: row.problem_statement ?? "",
  };
}

/** Deadline for a draft created now. */
export function draftDeadline(from: Date = new Date()): string {
  return new Date(from.getTime() + DRAFT_WINDOW_MS).toISOString();
}

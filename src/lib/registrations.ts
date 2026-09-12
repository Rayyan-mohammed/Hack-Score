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
import { parseMembers, validateTeamSize } from "@/lib/team-validation";
import type { Sponsor } from "@/components/sponsor-strip";

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
  domain: string | null;
  team_name: string | null;
  members: string | null;
  team_id: string | null;
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
  min_team_size: number;
  max_team_size: number;
};

const HACKATHON_COLUMNS =
  "id, name, description, venue, start_date, end_date, registration_open, " +
  "whatsapp_group_url, ppt_template_url, resources_url, min_team_size, max_team_size";

const REGISTRATION_COLUMNS =
  "id, hackathon_id, token, full_name, sap_id, mobile, college_email, " +
  "problem_statement_id, problem_statement_code, problem_statement, domain, " +
  "team_name, members, team_id, status, " +
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

/** The event's sponsors, shown above the public registration form. */
export async function listSponsors(hackathonId: string): Promise<Sponsor[]> {
  if (!registrationsConfigured()) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sponsors")
    .select("id, name, logo_url, label, sort_order")
    .eq("hackathon_id", hackathonId)
    .order("sort_order", { ascending: true });
  return (data as Sponsor[]) ?? [];
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

/** The team a registration was turned into, if any. */
export async function getRegistrationTeam(
  teamId: string | null,
): Promise<{ team_code: string; name: string } | null> {
  if (!teamId || !registrationsConfigured()) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("teams")
    .select("team_code, name")
    .eq("id", teamId)
    .maybeSingle();
  return (data as unknown as { team_code: string; name: string }) ?? null;
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
    domain: row.domain ?? "",
    team_name: row.team_name ?? "",
    members: row.members ?? "",
  };
}

/** The hackathon's team-size bounds, as the registration form applies them. */
export function teamSizeBounds(h: RegistrationHackathon): {
  min: number;
  max: number;
} {
  return {
    min: Number(h.min_team_size ?? 1),
    max: Number(h.max_team_size ?? 6),
  };
}

/** Deadline for a draft created now. */
export function draftDeadline(from: Date = new Date()): string {
  return new Date(from.getTime() + DRAFT_WINDOW_MS).toISOString();
}

/**
 * Turn a submitted registration into a real team.
 *
 * The registrant is the team leader, so the team is leader + the members they
 * listed — the same shape (and the same size rule) as the admin Add-team form
 * and the CSV import. Idempotent: a registration that already has `team_id`
 * is left alone, so a retry or a late auto-submit can't create a duplicate.
 *
 * Returns the team code on success, or a reason it was skipped. Never throws:
 * the registration itself is already recorded and must not be lost because
 * team creation failed.
 */
export async function createTeamFromRegistration(
  hackathon: RegistrationHackathon,
  token: string,
): Promise<{ teamCode?: string; error?: string }> {
  const supabase = createAdminClient();

  const { data: registration } = await supabase
    .from("registrations")
    .select(
      "id, team_id, full_name, college_email, team_name, members, problem_statement, problem_statement_code, domain",
    )
    .eq("token", token)
    .maybeSingle();

  if (!registration) return { error: "Registration not found." };
  if (registration.team_id) {
    const { data: existing } = await supabase
      .from("teams")
      .select("team_code")
      .eq("id", registration.team_id)
      .maybeSingle();
    return { teamCode: existing?.team_code };
  }

  const teamName = String(registration.team_name ?? "").trim();
  if (teamName.length < 3) return { error: "No team name was given." };

  const members = parseMembers(registration.members);
  const { min, max } = teamSizeBounds(hackathon);
  const sizeError = validateTeamSize(members.length, min, max);
  if (sizeError) return { error: sizeError };

  // Next free code for this hackathon: T01, T02, … Codes are only unique among
  // live teams, so a soft-deleted code is free to reuse.
  const { data: existingTeams } = await supabase
    .from("teams")
    .select("team_code")
    .eq("hackathon_id", hackathon.id)
    .is("deleted_at", null);
  const taken = new Set(
    (existingTeams ?? []).map((t) => String(t.team_code).toUpperCase()),
  );

  const nextCode = (offset: number) => {
    let n = 1;
    let skipped = 0;
    for (;;) {
      const code = `T${String(n).padStart(2, "0")}`;
      if (!taken.has(code)) {
        if (skipped === offset) return code;
        skipped++;
      }
      n++;
      if (n > 9999) return `T${Date.now().toString().slice(-6)}`;
    }
  };

  // Two people can submit at the same instant; retry past a code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const team_code = nextCode(attempt);
    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        hackathon_id: hackathon.id,
        team_code,
        name: teamName,
        team_leader_name: registration.full_name,
        team_leader_email: registration.college_email,
        problem_statement: registration.problem_statement,
        problem_statement_code: registration.problem_statement_code,
        // The form's "Domain" is the same thing the rest of the app calls a
        // track, so the admin Teams table and exports pick it up for free.
        track: registration.domain,
      })
      .select("id, team_code")
      .single();

    if (error) {
      if (error.code === "23505") continue; // code taken in the meantime
      return { error: error.message };
    }
    if (!team) return { error: "Could not create the team." };

    if (members.length > 0)
      await supabase
        .from("team_members")
        .insert(members.map((m) => ({ team_id: team.id, name: m })));

    await supabase
      .from("registrations")
      .update({ team_id: team.id })
      .eq("id", registration.id);

      return { teamCode: team.team_code };
  }

  return { error: "Could not allocate a team code — please contact the organisers." };
}

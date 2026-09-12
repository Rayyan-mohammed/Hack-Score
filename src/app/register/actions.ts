"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateRegistration,
  type RegistrationValues,
} from "@/lib/registration-form";
import {
  createTeamFromRegistration,
  draftDeadline,
  getRegistrationHackathon,
  registrationsConfigured,
  teamSizeBounds,
} from "@/lib/registrations";

export type RegistrationResult = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Code of the team created from this registration, when one was made. */
  teamCode?: string;
  /** The participant's private token — the draft link and, later, the receipt. */
  token?: string;
  /** ISO deadline the countdown runs against. */
  expiresAt?: string;
  status?: "draft" | "submitted";
  /** Set when the form may no longer be edited (submitted or window closed). */
  locked?: boolean;
};

export type RegistrationInput = {
  hackathonId: string;
  token?: string | null;
  values: RegistrationValues;
};

const LIMITS: Record<keyof RegistrationValues, number> = {
  full_name: 120,
  sap_id: 32,
  mobile: 24,
  college_email: 160,
  problem_statement_code: 40,
  problem_statement: 2000,
  domain: 120,
  team_name: 80,
  members: 600,
};

/** Trim and cap every field. Everything here arrives from an anonymous POST. */
function clean(values: RegistrationValues): RegistrationValues {
  const out = {} as RegistrationValues;
  for (const key of Object.keys(LIMITS) as (keyof RegistrationValues)[]) {
    out[key] = String(values?.[key] ?? "")
      .trim()
      .slice(0, LIMITS[key]);
  }
  return out;
}

function isBlank(values: RegistrationValues): boolean {
  return Object.values(values).every((v) => v === "");
}

/** Remember the draft on this device so a participant who loses the link (or
 *  just reloads) lands back on their own draft instead of starting a new one. */
async function rememberDraft(hackathonId: string, token: string) {
  const jar = await cookies();
  jar.set(`hs_reg_${hackathonId}`, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 3, // outlives the 1-hour window, then forgets
  });
}

/** Shared preamble: the hackathon must exist, be live and be open. */
async function openHackathonOrError(hackathonId: string) {
  if (!registrationsConfigured())
    return { error: "Registrations are unavailable right now." };
  const hackathon = await getRegistrationHackathon(hackathonId);
  if (!hackathon) return { error: "This registration form doesn't exist." };
  if (!hackathon.registration_open)
    return { error: "Registrations for this event are closed." };
  return { hackathon };
}

/**
 * Create or update the participant's draft. Called as soon as they start
 * filling the form, and on every autosave after that, so the one-hour window
 * starts at the first keystroke rather than at submit time.
 */
export async function saveDraft(
  input: RegistrationInput,
): Promise<RegistrationResult> {
  const values = clean(input?.values ?? ({} as RegistrationValues));
  const hackathonId = String(input?.hackathonId ?? "");

  const gate = await openHackathonOrError(hackathonId);
  if ("error" in gate) return { ok: false, error: gate.error };
  if (isBlank(values)) return { ok: false, error: "Nothing to save yet." };

  const supabase = createAdminClient();

  // Resolve the picked problem statement back to a catalogue row when the code
  // matches one, so admins can group registrations by statement.
  const { data: ps } = values.problem_statement_code
    ? await supabase
        .from("problem_statements")
        .select("id")
        .eq("hackathon_id", hackathonId)
        .eq("ps_code", values.problem_statement_code)
        .maybeSingle()
    : { data: null };

  const fields = { ...values, problem_statement_id: ps?.id ?? null };
  const token = String(input?.token ?? "") || null;

  if (token) {
    const { data: existing } = await supabase
      .from("registrations")
      .select("id, status, draft_expires_at")
      .eq("token", token)
      .eq("hackathon_id", hackathonId)
      .maybeSingle();

    if (!existing) return { ok: false, error: "Draft not found." };

    // Past the deadline the row belongs to the auto-submit path, not to us.
    if (
      existing.status === "submitted" ||
      new Date(existing.draft_expires_at).getTime() <= Date.now()
    ) {
      await autoSubmitDraft(token);
      return {
        ok: false,
        locked: true,
        token,
        status: "submitted",
        error:
          "Your one-hour window has closed — the form was submitted automatically.",
      };
    }

    const { error } = await supabase
      .from("registrations")
      .update(fields)
      .eq("id", existing.id)
      .eq("status", "draft");

    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      token,
      status: "draft",
      expiresAt: existing.draft_expires_at,
      message: "Draft saved.",
    };
  }

  const expiresAt = draftDeadline();
  const { data: created, error } = await supabase
    .from("registrations")
    .insert({
      hackathon_id: hackathonId,
      ...fields,
      status: "draft",
      draft_expires_at: expiresAt,
    })
    .select("token, draft_expires_at")
    .single();

  if (error || !created)
    return { ok: false, error: error?.message ?? "Could not save your draft." };

  await rememberDraft(hackathonId, created.token);
  revalidatePath("/admin/registrations");

  return {
    ok: true,
    token: created.token,
    status: "draft",
    expiresAt: created.draft_expires_at,
    message: "Draft saved.",
  };
}

/**
 * Final submit pressed by the participant. Unlike the auto-submit path this
 * one validates every field and refuses a duplicate SAP ID, then locks the row.
 */
export async function submitRegistration(
  input: RegistrationInput,
): Promise<RegistrationResult> {
  const values = clean(input?.values ?? ({} as RegistrationValues));
  const hackathonId = String(input?.hackathonId ?? "");

  const gate = await openHackathonOrError(hackathonId);
  if ("error" in gate) return { ok: false, error: gate.error };

  const invalid = validateRegistration(values, teamSizeBounds(gate.hackathon));
  if (invalid) return { ok: false, error: invalid };

  // Save first: this creates the draft if the participant never triggered an
  // autosave, and guarantees the row holds exactly what is on screen.
  const saved = await saveDraft({ ...input, values });
  if (!saved.ok || !saved.token) return saved;

  const supabase = createAdminClient();

  const { data: duplicate } = await supabase
    .from("registrations")
    .select("id")
    .eq("hackathon_id", hackathonId)
    .eq("status", "submitted")
    .ilike("sap_id", values.sap_id)
    .neq("token", saved.token)
    .maybeSingle();

  if (duplicate)
    return {
      ok: false,
      error: `SAP ID ${values.sap_id} has already been registered for this event.`,
    };

  const { error } = await supabase
    .from("registrations")
    .update({
      status: "submitted",
      auto_submitted: false,
      submitted_at: new Date().toISOString(),
    })
    .eq("token", saved.token)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  // Registered participants become a team straight away, so organisers don't
  // have to re-key them. A failure here is reported but never undoes the
  // submission — an admin can add the team by hand from the Registrations page.
  const team = await createTeamFromRegistration(gate.hackathon, saved.token);

  revalidatePath("/admin/registrations");
  if (team.teamCode) revalidatePath("/admin/teams");
  return {
    ok: true,
    token: saved.token,
    status: "submitted",
    locked: true,
    teamCode: team.teamCode,
    message: team.teamCode
      ? `Submission recorded. Your team is ${team.teamCode}.`
      : "Submission recorded.",
  };
}

/**
 * Close a draft whose hour is up. Fired by the countdown in the participant's
 * browser, and by the server-side sweep for anyone who closed the tab. It
 * never validates — whatever was typed is what gets recorded.
 */
export async function autoSubmitDraft(
  token: string,
): Promise<RegistrationResult> {
  if (!registrationsConfigured())
    return { ok: false, error: "Registrations are unavailable right now." };
  if (!token) return { ok: false, error: "Missing draft." };

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("registrations")
    .select("id, hackathon_id, status, draft_expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) return { ok: false, error: "Draft not found." };
  if (row.status === "submitted")
    return { ok: true, token, status: "submitted", locked: true };

  // Trust the stored deadline, not the caller's clock.
  if (new Date(row.draft_expires_at).getTime() > Date.now())
    return {
      ok: false,
      token,
      status: "draft",
      error: "This draft still has time left.",
    };

  const { error } = await supabase
    .from("registrations")
    .update({
      status: "submitted",
      auto_submitted: true,
      submitted_at: row.draft_expires_at,
    })
    .eq("id", row.id)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  // An auto-submitted registration still becomes a team when it holds a valid
  // team name and roster; an incomplete one is left for an admin to finish.
  const hackathon = await getRegistrationHackathon(row.hackathon_id);
  const team = hackathon
    ? await createTeamFromRegistration(hackathon, token)
    : ({} as { teamCode?: string });

  revalidatePath("/admin/registrations");
  if (team.teamCode) revalidatePath("/admin/teams");
  return {
    ok: true,
    token,
    status: "submitted",
    locked: true,
    teamCode: team.teamCode,
    message: "Your draft was submitted automatically.",
  };
}

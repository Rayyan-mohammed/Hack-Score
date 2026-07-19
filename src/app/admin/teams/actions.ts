"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import {
  parseMembers,
  isValidEmail,
  validateTeamSize,
} from "@/lib/team-validation";

export type FormState = { error?: string; message?: string };

// Fetch a hackathon's team-size bounds (defaults if unset).
async function teamSizeBounds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hackathonId: string,
) {
  const { data } = await supabase
    .from("hackathons")
    .select("min_team_size, max_team_size")
    .eq("id", hackathonId)
    .single();
  return {
    min: Number(data?.min_team_size ?? 1),
    max: Number(data?.max_team_size ?? 6),
  };
}

// Manual tie-break override (feature 3, tier "admin decision"). Lower number
// ranks higher among tied teams; blank clears the override.
export async function setTiebreakPriority(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  const team_id = String(formData.get("team_id") ?? "");
  const raw = String(formData.get("priority") ?? "").trim();
  if (!team_id) return { error: "Missing team." };

  const priority = raw === "" ? null : Number(raw);
  if (priority !== null && !Number.isFinite(priority))
    return { error: "Priority must be a number." };

  const supabase = await createClient();
  await supabase
    .from("teams")
    .update({ tiebreak_priority: priority })
    .eq("id", team_id);

  await logAudit({
    actorId: user.id,
    action: "team.tiebreak_priority",
    entity: "team",
    entityId: team_id,
    meta: { detail: priority === null ? "cleared" : `priority ${priority}` },
  });

  revalidatePath("/admin/leaderboard");
  revalidatePath(`/admin/leaderboard/${team_id}`);
  return {
    message: priority === null ? "Tie-break priority cleared." : "Priority saved.",
  };
}

export async function createTeam(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const team_code = String(formData.get("team_code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const leader_name = String(formData.get("team_leader_name") ?? "").trim();
  const leader_email = String(formData.get("team_leader_email") ?? "").trim();
  const members = parseMembers(String(formData.get("members") ?? ""));

  if (!hackathon_id) return { error: "Pick a hackathon first." };
  if (!team_code || !name)
    return { error: "Team code and name are required." };
  if (name.length < 3) return { error: "Team name must be at least 3 characters." };
  if (leader_name.length < 2)
    return { error: "Team leader name is required (min 2 characters)." };
  if (!isValidEmail(leader_email))
    return { error: "A valid team leader email is required." };

  const supabase = await createClient();

  const { min, max } = await teamSizeBounds(supabase, hackathon_id);
  const sizeError = validateTeamSize(members.length, min, max);
  if (sizeError) return { error: sizeError };

  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      hackathon_id,
      team_code,
      name,
      team_leader_name: leader_name,
      team_leader_email: leader_email,
      college: String(formData.get("college") ?? "").trim() || null,
      track: String(formData.get("track") ?? "").trim() || null,
      mentor: String(formData.get("mentor") ?? "").trim() || null,
      problem_statement:
        String(formData.get("problem_statement") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error || !team) return { error: error?.message ?? "Could not add team." };

  if (members.length > 0) {
    await supabase
      .from("team_members")
      .insert(members.map((m) => ({ team_id: team.id, name: m })));
  }

  revalidatePath("/admin/teams");
  return { message: `Added ${name} (${1 + members.length} members).` };
}

// Edit an existing team. Same validation as create; replaces the member list.
export async function updateTeam(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const team_code = String(formData.get("team_code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const leader_name = String(formData.get("team_leader_name") ?? "").trim();
  const leader_email = String(formData.get("team_leader_email") ?? "").trim();
  const members = parseMembers(String(formData.get("members") ?? ""));

  if (!id) return { error: "Missing team." };
  if (!team_code || !name)
    return { error: "Team code and name are required." };
  if (name.length < 3) return { error: "Team name must be at least 3 characters." };
  if (leader_name.length < 2)
    return { error: "Team leader name is required (min 2 characters)." };
  if (!isValidEmail(leader_email))
    return { error: "A valid team leader email is required." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("teams")
    .select("hackathon_id")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Team not found." };

  const { min, max } = await teamSizeBounds(supabase, existing.hackathon_id);
  const sizeError = validateTeamSize(members.length, min, max);
  if (sizeError) return { error: sizeError };

  const { error } = await supabase
    .from("teams")
    .update({
      team_code,
      name,
      team_leader_name: leader_name,
      team_leader_email: leader_email,
      college: String(formData.get("college") ?? "").trim() || null,
      track: String(formData.get("track") ?? "").trim() || null,
      mentor: String(formData.get("mentor") ?? "").trim() || null,
      problem_statement:
        String(formData.get("problem_statement") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Replace the member list with the submitted one.
  await supabase.from("team_members").delete().eq("team_id", id);
  if (members.length > 0) {
    await supabase
      .from("team_members")
      .insert(members.map((m) => ({ team_id: id, name: m })));
  }

  await logAudit({
    actorId: user.id,
    action: "team.update",
    entity: "team",
    entityId: id,
    meta: { name },
  });

  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}/edit`);
  return { message: "Team saved successfully." };
}

export async function deleteTeam(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  const { data: snapshot } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .single();

  // Soft delete — recoverable from Trash for 30 days.
  await supabase
    .from("teams")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  await logAudit({
    actorId: user.id,
    action: "team.delete",
    entity: "team",
    entityId: id,
    meta: { name: snapshot?.name, snapshot },
  });

  revalidatePath("/admin/teams");
}

// Bulk import teams from an uploaded CSV file.
// Expected headers: team_code, team_leader_name, team_leader_email, name,
// college, track, mentor, problem_statement, members (members separated by ';').
// Each row is validated (leader name + email, team size) and skipped with a
// reason if invalid, so a bad row never aborts the whole import.
export async function importTeams(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  if (!hackathon_id) return { error: "Pick a hackathon first." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose a CSV file to import." };

  const rows = parseCsv(await file.text());
  if (rows.length === 0) return { error: "No rows found in the file." };

  const supabase = await createClient();
  const { min, max } = await teamSizeBounds(supabase, hackathon_id);

  let imported = 0;
  const skipped: string[] = [];

  for (const [i, r] of rows.entries()) {
    const label = `Row ${i + 2}`; // +2: header row + 1-based
    const team_code = (r.team_code || r.code || r["team id"] || "").trim();
    const name = (r.name || r["team name"] || "").trim();
    const leader_name = (
      r.team_leader_name ||
      r["team leader name"] ||
      r.leader_name ||
      ""
    ).trim();
    const leader_email = (
      r.team_leader_email ||
      r["team leader email"] ||
      r.leader_email ||
      ""
    ).trim();
    const members = parseMembers(r.members);

    if (!team_code || !name) {
      skipped.push(`${label}: missing team code or name`);
      continue;
    }
    if (leader_name.length < 2) {
      skipped.push(`${label} (${team_code}): missing team leader name`);
      continue;
    }
    if (!isValidEmail(leader_email)) {
      skipped.push(`${label} (${team_code}): invalid team leader email`);
      continue;
    }
    const sizeError = validateTeamSize(members.length, min, max);
    if (sizeError) {
      skipped.push(`${label} (${team_code}): ${sizeError}`);
      continue;
    }

    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        hackathon_id,
        team_code,
        name,
        team_leader_name: leader_name,
        team_leader_email: leader_email,
        college: r.college || null,
        track: r.track || null,
        mentor: r.mentor || null,
        problem_statement: r.problem_statement || r["problem statement"] || null,
      })
      .select("id")
      .single();

    if (error || !team) {
      skipped.push(`${label} (${team_code}): ${error?.message ?? "insert failed"}`);
      continue;
    }
    imported++;

    if (members.length > 0) {
      await supabase
        .from("team_members")
        .insert(members.map((m) => ({ team_id: team.id, name: m })));
    }
  }

  revalidatePath("/admin/teams");

  if (imported === 0)
    return {
      error: `No rows imported. ${skipped.slice(0, 5).join(" · ")}${
        skipped.length > 5 ? ` · +${skipped.length - 5} more` : ""
      }`,
    };

  const summary = `Imported ${imported} of ${rows.length} rows.`;
  return {
    message: skipped.length
      ? `${summary} Skipped ${skipped.length}: ${skipped.slice(0, 3).join(" · ")}${
          skipped.length > 3 ? " …" : ""
        }`
      : summary,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";

export type FormState = { error?: string; message?: string };

// Manual tie-break override (feature 3, tier "admin decision"). Lower number
// ranks higher among tied teams; blank clears the override.
export async function setTiebreakPriority(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const team_id = String(formData.get("team_id") ?? "");
  const raw = String(formData.get("priority") ?? "").trim();
  if (!team_id) return;

  const priority = raw === "" ? null : Number(raw);
  if (priority !== null && !Number.isFinite(priority)) return;

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
}

export async function createTeam(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const hackathon_id = String(formData.get("hackathon_id") ?? "");
  const team_code = String(formData.get("team_code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!hackathon_id) return { error: "Pick a hackathon first." };
  if (!team_code || !name)
    return { error: "Team code and name are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({
    hackathon_id,
    team_code,
    name,
    college: String(formData.get("college") ?? "").trim() || null,
    track: String(formData.get("track") ?? "").trim() || null,
    mentor: String(formData.get("mentor") ?? "").trim() || null,
    problem_statement:
      String(formData.get("problem_statement") ?? "").trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  return { message: `Added ${name}.` };
}

export async function deleteTeam(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("teams").delete().eq("id", id);
  revalidatePath("/admin/teams");
}

// Bulk import teams from an uploaded CSV file.
// Expected headers: team_code, name, college, track, mentor,
// problem_statement, members (members separated by ';').
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
  let imported = 0;

  for (const r of rows) {
    const team_code = (r.team_code || r.code || r["team id"] || "").trim();
    const name = (r.name || r["team name"] || "").trim();
    if (!team_code || !name) continue;

    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        hackathon_id,
        team_code,
        name,
        college: r.college || null,
        track: r.track || null,
        mentor: r.mentor || null,
        problem_statement: r.problem_statement || r["problem statement"] || null,
      })
      .select("id")
      .single();

    if (error || !team) continue;
    imported++;

    const members = (r.members || "")
      .split(";")
      .map((m) => m.trim())
      .filter(Boolean);
    if (members.length > 0) {
      await supabase
        .from("team_members")
        .insert(members.map((m) => ({ team_id: team.id, name: m })));
    }
  }

  revalidatePath("/admin/teams");
  return { message: `Imported ${imported} of ${rows.length} rows.` };
}

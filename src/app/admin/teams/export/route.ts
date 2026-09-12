import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";

function csvCell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type TeamRow = {
  id: string;
  team_code: string;
  name: string;
  college: string | null;
  track: string | null;
  mentor: string | null;
  team_leader_name: string | null;
  team_leader_email: string | null;
  problem_statement_code: string | null;
  problem_statement: string | null;
  created_at: string;
};

/**
 * Every team of one hackathon as a CSV.
 *
 * Holds everything the app knows about a team: the team row, its roster (one
 * column per member so the file opens readably in Excel, plus a semicolon
 * column matching the import format), and the contact details that live on the
 * registration behind it rather than on the team itself.
 */
export async function GET(request: NextRequest) {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin")
    return new NextResponse("Forbidden", { status: 403 });

  const hackathonId = request.nextUrl.searchParams.get("h");
  if (!hackathonId)
    return new NextResponse("Missing hackathon id", { status: 400 });

  const supabase = await createClient();

  const { data: hackathon } = await supabase
    .from("hackathons")
    .select("name")
    .eq("id", hackathonId)
    .maybeSingle();

  const { data: t } = await supabase
    .from("teams")
    .select(
      "id, team_code, name, college, track, mentor, team_leader_name, team_leader_email, problem_statement_code, problem_statement, created_at",
    )
    .eq("hackathon_id", hackathonId)
    .is("deleted_at", null)
    .order("team_code", { ascending: true });

  const teams = (t as TeamRow[]) ?? [];
  const teamIds = teams.map((x) => x.id);

  const [{ data: memberRows }, { data: registrationRows }] = await Promise.all([
    teamIds.length
      ? supabase
          .from("team_members")
          .select("team_id, name")
          .in("team_id", teamIds)
          .order("id", { ascending: true })
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? supabase
          .from("registrations")
          .select(
            "team_id, sap_id, mobile, college_email, domain, status, submitted_at, auto_submitted",
          )
          .in("team_id", teamIds)
      : Promise.resolve({ data: [] }),
  ]);

  const membersByTeam = new Map<string, string[]>();
  for (const m of (memberRows as { team_id: string; name: string }[]) ?? []) {
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push(m.name);
    membersByTeam.set(m.team_id, list);
  }

  type Reg = {
    team_id: string;
    sap_id: string | null;
    mobile: string | null;
    college_email: string | null;
    domain: string | null;
    status: string | null;
    submitted_at: string | null;
    auto_submitted: boolean | null;
  };
  const regByTeam = new Map<string, Reg>();
  for (const r of (registrationRows as Reg[]) ?? []) regByTeam.set(r.team_id, r);

  // Enough member columns for the largest roster, so nothing is truncated.
  const maxMembers = teams.reduce(
    (n, team) => Math.max(n, membersByTeam.get(team.id)?.length ?? 0),
    0,
  );

  const header = [
    "Team Code",
    "Team Name",
    "Team Leader Name",
    "Team Leader Email",
    "Leader SAP ID",
    "Leader Mobile",
    "Leader College Email",
    "Problem Statement ID",
    "Problem Statement",
    "Domain",
    "Track",
    "College",
    "Mentor",
    "Team Size",
    ...Array.from({ length: maxMembers }, (_, i) => `Member ${i + 2}`),
    "Members (semicolon separated)",
    "Registration Status",
    "Submitted At (IST)",
    "Team Added (IST)",
  ];

  const lines = [header.map(csvCell).join(",")];

  for (const team of teams) {
    const members = membersByTeam.get(team.id) ?? [];
    const reg = regByTeam.get(team.id);
    const padded = Array.from(
      { length: maxMembers },
      (_, i) => members[i] ?? "",
    );

    lines.push(
      [
        team.team_code,
        team.name,
        team.team_leader_name,
        team.team_leader_email,
        reg?.sap_id,
        reg?.mobile,
        reg?.college_email,
        team.problem_statement_code,
        team.problem_statement,
        reg?.domain ?? team.track,
        team.track,
        team.college,
        team.mentor,
        // The leader counts as one, the same as everywhere else in the app.
        1 + members.length,
        ...padded,
        members.join("; "),
        reg
          ? reg.status === "submitted" && reg.auto_submitted
            ? "submitted (auto)"
            : (reg.status ?? "")
          : "added manually",
        formatDateTime(reg?.submitted_at),
        formatDateTime(team.created_at),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const slug = (hackathon?.name ?? "teams")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);

  // The BOM makes Excel read the file as UTF-8, so names with accents survive.
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}_teams.csv"`,
    },
  });
}

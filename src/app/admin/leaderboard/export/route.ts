import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import {
  computeStandings,
  round1,
  type EvalRow,
  type RoundRow,
  type TeamRow,
} from "@/lib/leaderboard";

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin")
    return new NextResponse("Forbidden", { status: 403 });

  const hackathonId = request.nextUrl.searchParams.get("h");
  if (!hackathonId)
    return new NextResponse("Missing hackathon id", { status: 400 });

  const supabase = await createClient();
  const [{ data: t }, { data: r }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_code, name, track, college")
      .eq("hackathon_id", hackathonId)
      .is("deleted_at", null),
    supabase
      .from("rounds")
      .select("id, name")
      .eq("hackathon_id", hackathonId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  const teams = (t as TeamRow[]) ?? [];
  const rounds = (r as RoundRow[]) ?? [];
  const roundIds = rounds.map((x) => x.id);

  let evals: EvalRow[] = [];
  if (roundIds.length) {
    const { data: e } = await supabase
      .from("evaluations")
      .select("round_id, team_id, total_score, status")
      .in("round_id", roundIds);
    evals = (e as EvalRow[]) ?? [];
  }

  const standings = computeStandings(teams, rounds, evals);

  const header = [
    "Rank",
    "Team Code",
    "Team Name",
    "Track",
    "College",
    ...rounds.map((rd) => rd.name),
    "Overall",
  ];
  const lines = [header.map(csvCell).join(",")];
  standings.forEach((s, i) => {
    lines.push(
      [
        i + 1,
        s.team.team_code,
        s.team.name,
        s.team.track ?? "",
        s.team.college ?? "",
        ...rounds.map((rd) => round1(s.roundAverages[rd.id] ?? 0)),
        round1(s.overall),
      ]
        .map(csvCell)
        .join(","),
    );
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leaderboard.csv"',
    },
  });
}

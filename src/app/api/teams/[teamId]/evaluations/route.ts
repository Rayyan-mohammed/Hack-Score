import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTeamEvaluationBreakdown } from "@/lib/evaluations";

// GET /api/teams/{teamId}/evaluations
// Returns the full per-round, per-judge evaluation breakdown for a team.
// Admin-only, matching the RBAC convention used by the leaderboard export.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teamId } = await params;
  const breakdown = await getTeamEvaluationBreakdown(teamId);

  if (!breakdown)
    return NextResponse.json({ error: "Team not found" }, { status: 404 });

  return NextResponse.json(breakdown);
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getJudgeProgress } from "@/lib/judge-progress";

// GET /api/judges/{judgeId}/progress
// Returns the judge's assigned teams split into evaluated (submitted) vs
// pending, per round, with an overall count. Admin-only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ judgeId: string }> },
) {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { judgeId } = await params;
  const progress = await getJudgeProgress(judgeId);

  if (!progress)
    return NextResponse.json({ error: "Judge not found" }, { status: 404 });

  return NextResponse.json(progress);
}

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildReportBundle } from "@/lib/report-data";
import { buildReportWord } from "@/lib/report-word";

// The official evaluation report as a Word document, built from the same
// bundle as the PDF and the workbook so the three can never disagree.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin")
    return new NextResponse("Forbidden", { status: 403 });

  const hackathonId = request.nextUrl.searchParams.get("h");
  if (!hackathonId)
    return new NextResponse("Missing hackathon id", { status: 400 });

  const bundle = await buildReportBundle(hackathonId);
  if (!bundle) return new NextResponse("Hackathon not found", { status: 404 });

  const { html, filename } = buildReportWord(bundle);

  // The BOM makes Word read it as UTF-8, so accented names survive.
  return new NextResponse("\uFEFF" + html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

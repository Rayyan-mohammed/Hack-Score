import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildReportBundle } from "@/lib/report-data";
import { buildReportWorkbook } from "@/lib/report-excel";

// The official evaluation report as an .xlsx workbook: the same three levels,
// the same numbers and the same letterhead as the PDF, built from the same
// bundle. exceljs is a Node library, so this route is pinned to the Node
// runtime; a large event takes a few seconds to write.
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

  const { buffer, filename } = await buildReportWorkbook(bundle);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}

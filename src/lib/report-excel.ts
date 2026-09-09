// The official evaluation report as an Excel workbook.
//
// Same three levels and the same numbers as the PDF — both are rendered from
// one `ReportBundle`, so they cannot disagree. Where the PDF is a fixed printed
// document, the workbook is built the way a spreadsheet is actually used:
// flat, filterable tables with frozen headers, plus print setup (A4, repeating
// header row, page numbers in the footer) so any sheet prints like the PDF.

import ExcelJS from "exceljs";
import { fmt } from "@/lib/report-format";
import { reportFileBase } from "@/lib/report-config";
import type { ReportBundle } from "@/lib/report-data";

const HEAD_FILL = "FFEBEDF2";
const TOTAL_FILL = "FFF3F4F7";

/** Excel sheet names: 31 chars, and none of : \ / ? * [ ] */
function sheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[:\\/?*[\]]/g, "-").slice(0, 31).trim() || "Sheet";
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

type Column = { header: string; width: number; numeric?: boolean };

export async function buildReportWorkbook(
  bundle: ReportBundle,
): Promise<{ buffer: Buffer; filename: string }> {
  const { config } = bundle;
  const wb = new ExcelJS.Workbook();
  wb.creator = config.institution || "HackScore";
  wb.created = new Date(bundle.generatedAt);

  const used = new Set<string>();

  /**
   * Add a sheet with the institutional letterhead, then a table. Returns the
   * worksheet so callers can append totals underneath.
   */
  const addSheet = (
    title: string,
    subtitle: string,
    columns: Column[],
    rows: (string | number)[][],
    orientation: "portrait" | "landscape" = "landscape",
  ) => {
    const ws = wb.addWorksheet(sheetName(title, used), {
      views: [{ state: "frozen", ySplit: 6 }],
      pageSetup: {
        paperSize: 9, // A4
        orientation,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.5,
          right: 0.5,
          top: 0.6,
          bottom: 0.6,
          header: 0.3,
          footer: 0.3,
        },
      },
      headerFooter: {
        oddHeader: `&C&"Helvetica,Bold"${config.institution}`,
        oddFooter: `&L${config.reportTitle} | ${config.department}&RPage &P of &N`,
      },
    });

    // Letterhead rows (1-5), then the table header on row 6.
    ws.addRow([config.institution]);
    ws.addRow([config.department]);
    ws.addRow([
      `${config.reportTitle}${config.examName ? ` — ${config.examName}` : ""}${
        config.academicYear ? ` — A.Y. ${config.academicYear}` : ""
      }`,
    ]);
    ws.addRow([subtitle]);
    ws.addRow([]);

    ws.getRow(1).font = { bold: true, size: 13 };
    ws.getRow(2).font = { size: 11 };
    ws.getRow(3).font = { size: 10 };
    ws.getRow(4).font = { bold: true, size: 11 };

    const headerRow = ws.addRow(columns.map((c) => c.header));
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", wrapText: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEAD_FILL },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    for (const row of rows) {
      const r = ws.addRow(row);
      r.eachCell((cell, col) => {
        cell.border = {
          top: { style: "hair" },
          left: { style: "hair" },
          bottom: { style: "hair" },
          right: { style: "hair" },
        };
        if (columns[col - 1]?.numeric) {
          cell.alignment = { horizontal: "right" };
          cell.numFmt = "0.##";
        }
      });
    }

    columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width;
    });

    if (rows.length > 0) {
      const last = ws.rowCount;
      ws.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: last, column: columns.length },
      };
    }
    ws.pageSetup.printTitlesRow = "6:6";
    return ws;
  };

  /** Bold, shaded total row appended under a table. */
  const addTotalRow = (
    ws: ExcelJS.Worksheet,
    values: (string | number)[],
  ) => {
    const row = ws.addRow(values);
    row.font = { bold: true };
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: TOTAL_FILL },
      };
    });
    return row;
  };

  // =========================================================================
  // Cover
  // =========================================================================
  const cover = wb.addWorksheet(sheetName("Cover", used), {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true },
  });
  cover.columns = [{ width: 34 }, { width: 62 }];

  const coverRows: [string, string][] = [
    ["Institution", config.institution],
    ["Department", config.department],
    ["Address", config.address || "—"],
    ["Report title", config.reportTitle],
    ["Examination / Event", config.examName || bundle.hackathon.name],
    ["Academic year", config.academicYear || "—"],
    [
      "Report date",
      config.reportDate || new Date(bundle.generatedAt).toLocaleDateString(),
    ],
    ["Reference number", config.refNumber || "—"],
    ["Venue", bundle.hackathon.venue || "—"],
    [
      "Event period",
      [bundle.hackathon.start_date, bundle.hackathon.end_date]
        .filter(Boolean)
        .join(" to ") || "—",
    ],
    ["", ""],
    ["Teams assessed", String(bundle.level1.stats.totalTeams)],
    ["Rounds conducted", String(bundle.level1.stats.totalRounds)],
    ["Evaluators", String(bundle.level1.stats.totalEvaluators)],
    ["Total marks available", fmt(bundle.level1.stats.totalMarksAvailable)],
    ["Highest overall score", fmt(bundle.level1.stats.highest)],
    ["Lowest overall score", fmt(bundle.level1.stats.lowest)],
    ["Average overall score", fmt(bundle.level1.stats.average)],
    [
      "Evaluations submitted",
      `${bundle.level1.stats.evaluationsSubmitted} of ${bundle.level1.stats.evaluationsExpected}`,
    ],
    ["", ""],
    [
      "Reconciliation",
      bundle.discrepancies.length === 0
        ? "OK — evaluator marks → component totals → round totals → team totals → overall"
        : `${bundle.discrepancies.length} discrepancy(ies) found — see below`,
    ],
    ...bundle.discrepancies.map(
      (d, i) => [`Discrepancy ${i + 1}`, d] as [string, string],
    ),
    ["", ""],
    ["Generated", new Date(bundle.generatedAt).toLocaleString()],
  ];

  cover.addRow([config.institution]).font = { bold: true, size: 14 };
  cover.addRow([config.reportTitle]).font = { bold: true, size: 12 };
  cover.addRow([bundle.hackathon.name]).font = { size: 11 };
  cover.addRow([]);
  for (const [label, value] of coverRows) {
    const row = cover.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true };
  }

  // =========================================================================
  // LEVEL 1 — overall summary
  // =========================================================================
  const l1Columns: Column[] = [
    { header: "Rank", width: 7, numeric: true },
    { header: "Team code", width: 12 },
    { header: "Team name", width: 28 },
    { header: "Track", width: 16 },
    { header: "College", width: 24 },
    ...bundle.rounds.map((r) => ({
      header: `${r.name} (max ${fmt(r.maxMarks)})`,
      width: 16,
      numeric: true,
    })),
    { header: "Overall total", width: 14, numeric: true },
    { header: "Max total", width: 12, numeric: true },
    { header: "Percentage", width: 12, numeric: true },
    { header: "Result", width: 18 },
  ];

  addSheet(
    "1. Overall Summary",
    "Level 1 — Overall results summary",
    l1Columns,
    bundle.level1.rows.map((row) => [
      row.rank,
      row.teamCode,
      row.teamName,
      row.track ?? "—",
      row.college ?? "—",
      ...bundle.rounds.map((r) => row.roundScores[r.id] ?? 0),
      row.overall,
      row.maxTotal,
      row.percentage,
      row.result,
    ]),
  );

  // =========================================================================
  // LEVEL 2 — one sheet per round, then the consolidated view
  // =========================================================================
  bundle.level2.rounds.forEach((round, index) => {
    const columns: Column[] = [
      { header: "Team code", width: 12 },
      { header: "Team name", width: 28 },
      ...round.criteria.map((c) => ({
        header: `${c.name} (max ${fmt(c.maxMarks)})`,
        width: 16,
        numeric: true,
      })),
      { header: "Round total", width: 13, numeric: true },
      { header: "Max", width: 10, numeric: true },
      { header: "Evaluators", width: 11, numeric: true },
    ];

    addSheet(
      `2.${index + 1} ${round.roundName}`,
      `Level 2 — ${round.roundName}: component-wise distribution`,
      columns,
      round.rows.map((row) => [
        row.teamCode,
        row.teamName,
        ...round.criteria.map((c) => row.componentScores[c.id] ?? 0),
        row.total,
        round.maxMarks,
        row.judgeCount,
      ]),
    );
  });

  addSheet(
    "2. Consolidated",
    "Level 2 — consolidated round totals",
    [
      { header: "Team code", width: 12 },
      { header: "Team name", width: 28 },
      ...bundle.rounds.map((r) => ({
        header: r.name,
        width: 16,
        numeric: true,
      })),
      { header: "Grand total", width: 14, numeric: true },
    ],
    bundle.level2.consolidated.map((row) => [
      row.teamCode,
      row.teamName,
      ...bundle.rounds.map((r) => row.roundScores[r.id] ?? 0),
      row.grandTotal,
    ]),
  );

  // =========================================================================
  // LEVEL 3 — the audit trail, three ways
  // =========================================================================
  addSheet(
    "3.1 Evaluator-wise",
    "Level 3 — every mark, by evaluator",
    [
      { header: "Evaluator", width: 24 },
      { header: "Evaluator email", width: 26 },
      { header: "Team code", width: 12 },
      { header: "Team name", width: 26 },
      { header: "Round", width: 18 },
      { header: "Component", width: 26 },
      { header: "Maximum marks", width: 14, numeric: true },
      { header: "Marks given", width: 13, numeric: true },
    ],
    bundle.level3.byEvaluator.flatMap((e) =>
      e.rows.map((r) => [
        e.judgeName,
        e.email ?? "—",
        r.teamCode,
        r.teamName,
        r.roundName,
        r.criterionName,
        r.maxMarks,
        r.score,
      ]),
    ),
  );

  const evaluatorTotals = addSheet(
    "3.1 Evaluator Totals",
    "Level 3 — evaluator totals per team",
    [
      { header: "Evaluator", width: 24 },
      { header: "Team code", width: 12 },
      { header: "Team name", width: 26 },
      { header: "Maximum marks", width: 14, numeric: true },
      { header: "Marks given", width: 13, numeric: true },
    ],
    bundle.level3.byEvaluator.flatMap((e) => [
      ...e.summary.map((s) => [
        e.judgeName,
        s.teamCode,
        s.teamName,
        s.maxMarks,
        s.given,
      ]),
      [`${e.judgeName} — TOTAL`, "", "", e.totalMax, e.totalGiven],
    ]),
  );
  // Shade each evaluator's total line so the blocks are readable when printed.
  evaluatorTotals.eachRow((row, index) => {
    if (index <= 6) return;
    if (String(row.getCell(1).value ?? "").endsWith("— TOTAL")) {
      row.font = { bold: true };
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: TOTAL_FILL },
        };
      });
    }
  });

  addSheet(
    "3.2 Team-wise",
    "Level 3 — every mark, by team",
    [
      { header: "Team code", width: 12 },
      { header: "Team name", width: 26 },
      { header: "Round", width: 18 },
      { header: "Evaluator", width: 24 },
      { header: "Component", width: 26 },
      { header: "Maximum marks", width: 14, numeric: true },
      { header: "Marks given", width: 13, numeric: true },
    ],
    bundle.level3.byTeam.flatMap((t) =>
      t.rounds.flatMap((r) =>
        r.rows.map((row) => [
          t.teamCode,
          t.teamName,
          r.roundName,
          row.judgeName,
          row.criterionName,
          row.maxMarks,
          row.score,
        ]),
      ),
    ),
  );

  const teamTotals = addSheet(
    "3.2 Team Totals",
    "Level 3 — team totals by round",
    [
      { header: "Team code", width: 12 },
      { header: "Team name", width: 26 },
      { header: "Round", width: 18 },
      { header: "Evaluators counted", width: 17, numeric: true },
      { header: "Round total", width: 13, numeric: true },
      { header: "Round max", width: 12, numeric: true },
    ],
    bundle.level3.byTeam.flatMap((t) =>
      t.rounds.map((r) => [
        t.teamCode,
        t.teamName,
        r.roundName,
        r.judgeCount,
        r.total,
        r.maxMarks,
      ]),
    ),
  );
  teamTotals.addRow([]);
  addTotalRow(teamTotals, [
    "Team",
    "Name",
    "Overall total",
    "",
    "Max total",
    "",
  ]);
  for (const t of bundle.level3.byTeam)
    teamTotals.addRow([t.teamCode, t.teamName, t.overall, "", t.overallMax, ""]);

  addSheet(
    "3.3 Component-wise",
    "Level 3 — every mark, by component",
    [
      { header: "Round", width: 18 },
      { header: "Component", width: 26 },
      { header: "Team code", width: 12 },
      { header: "Team name", width: 26 },
      { header: "Evaluator", width: 24 },
      { header: "Maximum marks", width: 14, numeric: true },
      { header: "Marks given", width: 13, numeric: true },
    ],
    bundle.level3.byComponent.flatMap((c) =>
      c.rows.map((r) => [
        c.roundName,
        c.criterionName,
        r.teamCode,
        r.teamName,
        r.judgeName,
        r.maxMarks,
        r.score,
      ]),
    ),
  );

  addSheet(
    "3.3 Component Totals",
    "Level 3 — component totals (sum of per-team averages)",
    [
      { header: "Round", width: 18 },
      { header: "Component", width: 26 },
      { header: "Maximum marks", width: 14, numeric: true },
      { header: "Component total", width: 16, numeric: true },
    ],
    bundle.level3.byComponent.map((c) => [
      c.roundName,
      c.criterionName,
      c.maxMarks,
      c.total,
    ]),
    "portrait",
  );

  // =========================================================================
  // Signatures — printed and signed by hand
  // =========================================================================
  const sign = wb.addWorksheet(sheetName("Verification", used), {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true },
  });
  sign.columns = [{ width: 26 }, { width: 40 }];
  sign.addRow([config.institution]).font = { bold: true, size: 14 };
  sign.addRow(["Verification & signatures"]).font = { bold: true, size: 12 };
  sign.addRow([]);

  for (const [label, person] of [
    ["Prepared by", config.preparedBy],
    ["Verified by", config.verifiedBy],
    ["Approved by / Head of Department", config.approvedBy],
  ] as const) {
    sign.addRow([label]).font = { bold: true };
    sign.addRow(["Name", person.name || ""]);
    sign.addRow(["Designation", person.designation || ""]);
    sign.addRow(["Department", person.department || config.department]);
    sign.addRow(["Institution", person.institution || config.institution]);
    sign.addRow(["Signature", ""]);
    sign.addRow(["Date", ""]);
    sign.addRow([]);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    filename: `${reportFileBase(config, bundle.hackathon.name)}.xlsx`,
  };
}

// The official evaluation report as a Word document.
//
// Same three levels and the same numbers as the PDF and the workbook — all
// three render one `ReportBundle`, so they cannot disagree. Where the PDF is
// fixed and the workbook is for filtering, this one is for editing: Word opens
// it as a normal document, so an organiser can add a note or a heading before
// printing.
//
// It is written as Word-flavoured HTML rather than a binary .docx. Word has
// read that format natively for twenty years, it keeps tables, page breaks and
// A4 page setup intact, and it needs no extra dependency in the bundle.

import { evaluatorSummaryTable, fmt } from "@/lib/report-format";
import { reportFileBase } from "@/lib/report-config";
import type { ReportBundle } from "@/lib/report-data";
import { formatDate, formatDateTime } from "@/lib/datetime";

const INK = "#12213b";
const RULE = "#c9cfdb";
const BAND = "#eceef3";

/** HTML-escape — every value here comes from user input. */
function esc(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAGE_BREAK = `<div style="page-break-before:always"></div>`;

type Cell = string | number;

/** A bordered table; `numericFrom` right-aligns the columns from that index. */
function table(
  head: string[],
  rows: Cell[][],
  opts: { numericFrom?: number; emphasiseLast?: boolean } = {},
): string {
  const { numericFrom = head.length, emphasiseLast = false } = opts;
  const align = (i: number) => (i >= numericFrom ? "right" : "left");

  const headHtml = head
    .map(
      (h, i) =>
        `<td style="background:${BAND};border:0.5pt solid ${RULE};padding:3pt 4pt;text-align:${align(i)}"><b>${esc(h)}</b></td>`,
    )
    .join("");

  const bodyHtml = rows
    .map((row, r) => {
      const last = emphasiseLast && r === rows.length - 1;
      return `<tr>${row
        .map(
          (c, i) =>
            `<td style="border:0.5pt solid ${RULE};padding:3pt 4pt;text-align:${align(i)}${
              last ? ";background:#f5f6f9" : ""
            }">${last ? "<b>" : ""}${esc(c)}${last ? "</b>" : ""}</td>`,
        )
        .join("")}</tr>`;
    })
    .join("");

  return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:8.5pt;margin:6pt 0 10pt">
<thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function sectionTitle(text: string): string {
  return `<p style="background:${BAND};border-left:3pt solid ${INK};padding:4pt 6pt;margin:14pt 0 8pt;font-size:11pt"><b>${esc(text.toUpperCase())}</b></p>`;
}

function heading(text: string, size = 10): string {
  return `<p style="margin:10pt 0 4pt;font-size:${size}pt"><b>${esc(text)}</b></p>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 6pt;font-size:8.5pt;color:#4a5568">${esc(text)}</p>`;
}

/** The line an evaluator signs under their own summary. */
function signatureStrip(judgeName: string): string {
  return `<p style="margin:14pt 0 0;font-size:8pt;color:#4a5568">I confirm the marks recorded above are those I awarded.</p>
<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin-top:22pt;font-size:8pt;color:#4a5568">
<tr>
  <td style="width:45%;border-top:0.5pt solid ${RULE};padding-top:3pt">Signature — ${esc(judgeName)}</td>
  <td style="width:20%"></td>
  <td style="width:35%;border-top:0.5pt solid ${RULE};padding-top:3pt">Date</td>
</tr></table>`;
}

export function buildReportWord(bundle: ReportBundle): {
  html: string;
  filename: string;
} {
  const { config, hackathon } = bundle;
  const parts: string[] = [];

  // --- letterhead & cover ---------------------------------------------------
  parts.push(
    `<p style="text-align:center;margin:0;font-size:13pt"><b>${esc(config.institution)}</b></p>`,
    `<p style="text-align:center;margin:2pt 0;font-size:10pt">${esc(config.department)}</p>`,
    `<p style="text-align:center;margin:2pt 0 10pt;font-size:9pt;color:#4a5568">${esc(config.reportTitle)}</p>`,
    `<hr style="border:none;border-top:1pt solid ${RULE}">`,
    `<p style="text-align:center;margin:16pt 0 4pt;font-size:16pt"><b>${esc(config.examName || hackathon.name)}</b></p>`,
  );

  const meta: Cell[][] = [
    ["Event", hackathon.name],
    ["Venue", hackathon.venue ?? "—"],
    [
      "Held on",
      [formatDate(hackathon.start_date), formatDate(hackathon.end_date)]
        .filter(Boolean)
        .join(" – ") || "—",
    ],
    ["Academic year", config.academicYear || "—"],
    ["Reference number", config.refNumber || "—"],
    ["Report date", config.reportDate || formatDate(bundle.generatedAt)],
    ["Generated", formatDateTime(bundle.generatedAt)],
  ];
  parts.push(table(["Field", "Detail"], meta));

  const s = bundle.level1.stats;
  parts.push(
    heading("At a glance"),
    table(
      ["Measure", "Value"],
      [
        ["Teams assessed", s.totalTeams],
        ["Rounds", s.totalRounds],
        ["Evaluators", s.totalEvaluators],
        ["Marks available per team", fmt(s.totalMarksAvailable)],
        ["Highest total", fmt(s.highest)],
        ["Lowest total", fmt(s.lowest)],
        ["Average total", fmt(s.average)],
        [
          "Evaluations submitted",
          `${s.evaluationsSubmitted} of ${s.evaluationsExpected}`,
        ],
      ],
      { numericFrom: 1 },
    ),
  );

  // --- Level 1 --------------------------------------------------------------
  parts.push(PAGE_BREAK, sectionTitle("Section 1 — Overall results summary"));
  parts.push(
    table(
      [
        "Rank",
        "Team",
        "Team name",
        "Track",
        ...bundle.rounds.map((r) => `${r.name} (max ${fmt(r.maxMarks)})`),
        "Overall",
        "Max",
        "%",
        "Result",
      ],
      bundle.level1.rows.map((row) => [
        row.rank,
        row.teamCode,
        row.teamName,
        row.track ?? "—",
        ...bundle.rounds.map((r) => fmt(row.roundScores[r.id] ?? 0)),
        fmt(row.overall),
        fmt(row.maxTotal),
        fmt(row.percentage),
        row.result,
      ]),
      { numericFrom: 4 },
    ),
  );

  // --- Level 2 --------------------------------------------------------------
  parts.push(
    PAGE_BREAK,
    sectionTitle("Section 2 — Component-wise distribution"),
  );
  bundle.level2.rounds.forEach((round, index) => {
    if (index > 0) parts.push(PAGE_BREAK);
    parts.push(heading(`2.${index + 1}  ${round.roundName}`, 11));
    parts.push(
      table(
        [
          "Team",
          "Team name",
          ...round.criteria.map((c) => `${c.name} (max ${fmt(c.maxMarks)})`),
          "Total",
          "Max",
          "Evaluators",
        ],
        round.rows.map((row) => [
          row.teamCode,
          row.teamName,
          ...round.criteria.map((c) => fmt(row.componentScores[c.id] ?? 0)),
          fmt(row.total),
          fmt(round.maxMarks),
          row.judgeCount,
        ]),
        { numericFrom: 2 },
      ),
    );
  });

  parts.push(
    heading("Consolidated round totals", 11),
    table(
      [
        "Team",
        "Team name",
        ...bundle.rounds.map((r) => r.name),
        "Grand total",
      ],
      bundle.level2.consolidated.map((row) => [
        row.teamCode,
        row.teamName,
        ...bundle.rounds.map((r) => fmt(row.roundScores[r.id] ?? 0)),
        fmt(row.grandTotal),
      ]),
      { numericFrom: 2 },
    ),
  );

  // --- Level 3 --------------------------------------------------------------
  parts.push(
    PAGE_BREAK,
    sectionTitle("Section 3 — Evaluator, team and component details"),
    para(
      "Every mark awarded in this assessment, presented three ways: by evaluator, by team and by component.",
    ),
    heading("3.1  Evaluator-wise details", 11),
  );

  bundle.level3.byEvaluator.forEach((evaluator, index) => {
    // Each evaluator starts a page, and their summary — the part they sign —
    // gets a page of its own, exactly as the PDF lays it out.
    if (index > 0) parts.push(PAGE_BREAK);
    parts.push(
      heading(
        `Evaluator: ${evaluator.judgeName}${evaluator.email ? `  (${evaluator.email})` : ""}`,
      ),
      table(
        ["Team", "Team name", "Round", "Component", "Max marks", "Marks given"],
        evaluator.rows.map((r) => [
          r.teamCode,
          r.teamName,
          r.roundName,
          r.criterionName,
          fmt(r.maxMarks),
          fmt(r.score),
        ]),
        { numericFrom: 4 },
      ),
      PAGE_BREAK,
      heading(`Evaluator summary — ${evaluator.judgeName}`, 9),
      (() => {
        const t = evaluatorSummaryTable(
          evaluator,
          bundle.rounds.map((r) => r.name),
        );
        return table(t.head, t.body, {
          numericFrom: 2,
          emphasiseLast: true,
        });
      })(),
      signatureStrip(evaluator.judgeName),
    );
  });

  parts.push(PAGE_BREAK, heading("3.2  Team-wise detailed evaluation", 11));
  bundle.level3.byTeam.forEach((team, index) => {
    if (index > 0) parts.push(PAGE_BREAK);
    parts.push(
      heading(`${team.teamCode} — ${team.teamName}`),
      table(
        ["Round", "Evaluator", "Component", "Max marks", "Marks given"],
        team.rounds.flatMap((round) =>
          round.rows.map((r) => [
            round.roundName,
            r.judgeName,
            r.criterionName,
            fmt(r.maxMarks),
            fmt(r.score),
          ]),
        ),
        { numericFrom: 3 },
      ),
      para(
        `Overall: ${fmt(team.overall)} of ${fmt(team.overallMax)}`,
      ),
    );
  });

  parts.push(PAGE_BREAK, heading("3.3  Component-wise analysis", 11));
  parts.push(
    table(
      ["Round", "Component", "Max marks", "Teams scored", "Component total"],
      bundle.level3.byComponent.map((c) => [
        c.roundName,
        c.criterionName,
        fmt(c.maxMarks),
        new Set(c.rows.map((r) => r.teamCode)).size,
        fmt(c.total),
      ]),
      { numericFrom: 2 },
    ),
  );

  // --- verification ---------------------------------------------------------
  parts.push(PAGE_BREAK, sectionTitle("Verification & signatures"));
  const blocks: [string, typeof config.preparedBy][] = [
    ["Prepared by", config.preparedBy],
    ["Verified by", config.verifiedBy],
    ["Approved by", config.approvedBy],
  ];
  for (const [label, person] of blocks) {
    const blank = "______________________________";
    parts.push(
      `<table cellspacing="0" cellpadding="0" style="width:100%;border:0.5pt solid ${RULE};border-collapse:collapse;margin:10pt 0;font-size:9pt">
<tr><td colspan="2" style="background:${BAND};padding:4pt 6pt"><b>${esc(label.toUpperCase())}</b></td></tr>
<tr>
  <td style="padding:6pt;width:60%">
    Name: ${esc(person.name || blank)}<br>
    Designation: ${esc(person.designation || blank)}<br>
    Department: ${esc(person.department || config.department || blank)}<br>
    Institution: ${esc(person.institution || config.institution)}
  </td>
  <td style="padding:18pt 6pt 6pt;width:40%;color:#4a5568;font-size:8pt">
    <div style="border-top:0.5pt solid ${RULE};padding-top:3pt">Signature</div>
    <div style="border-top:0.5pt solid ${RULE};padding-top:3pt;margin-top:16pt">Date</div>
  </td>
</tr></table>`,
    );
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<title>${esc(config.examName || hackathon.name)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4 portrait; margin: 16mm 12mm; }
  body { font-family: Calibri, Arial, sans-serif; color: ${INK}; font-size: 10pt; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
</style></head>
<body>${parts.join("\n")}</body></html>`;

  return {
    html,
    filename: `${reportFileBase(config, hackathon.name)}.doc`,
  };
}

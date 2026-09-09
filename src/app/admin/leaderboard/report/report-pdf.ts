// Builds the official evaluation report as a real PDF document: structured
// text and vector tables written with jsPDF + autoTable, not a screenshot or a
// browser print of the page.
//
// Layout rules the report has to satisfy:
//   * A4, professional margins, automatic page breaks, rows never split
//   * table headers repeat on every page (`showHead: "everyPage"`)
//   * a letterhead on every page and "Page N of M" in every footer
//   * wide tables switch the page to landscape rather than shrinking the type
//
// jsPDF keeps the last-used orientation for subsequent `addPage()` calls, so a
// section that starts landscape stays landscape while autoTable paginates it,
// and the next section switches back explicitly.

import type { ReportBundle } from "@/lib/report-data";
import { fmt, outOf } from "@/lib/report-format";
import { reportFileBase, type ReportConfig } from "@/lib/report-config";

type Doc = import("jspdf").jsPDF;
type Orientation = "portrait" | "landscape";

const MARGIN = 12; // mm
const HEADER_H = 26; // reserved band at the top of every page
const FOOTER_H = 14; // reserved band at the bottom

const INK = { r: 17, g: 24, b: 39 };
const RULE = { r: 120, g: 120, b: 130 };
const HEAD_FILL = { r: 235, g: 237, b: 242 };

type Logo = { data: string; format: string; ratio: number };

/** Fetch the configured logo as a data URL. Never throws — the report just
 *  renders without it. */
async function loadLogo(url: string): Promise<Logo | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width / img.height || 1);
      img.onerror = () => resolve(1);
      img.src = data;
    });
    const format = blob.type.includes("png")
      ? "PNG"
      : blob.type.includes("webp")
        ? "WEBP"
        : "JPEG";
    return { data, format, ratio };
  } catch {
    return null;
  }
}

function pageWidth(doc: Doc) {
  return doc.internal.pageSize.getWidth();
}
function pageHeight(doc: Doc) {
  return doc.internal.pageSize.getHeight();
}

class ReportDoc {
  readonly doc: Doc;
  private readonly config: ReportConfig;
  private readonly logo: Logo | null;
  /** Pages whose letterhead has already been drawn (autoTable's page hook and
   *  the manual page adds would otherwise double-print it). */
  private readonly stamped = new Set<number>();

  constructor(doc: Doc, config: ReportConfig, logo: Logo | null) {
    this.doc = doc;
    this.config = config;
    this.logo = logo;
  }

  get page() {
    return this.doc.getCurrentPageInfo().pageNumber;
  }

  /** Letterhead. Idempotent per page. */
  header = () => {
    const { doc, config } = this;
    const page = this.page;
    if (this.stamped.has(page)) return;
    this.stamped.add(page);

    const w = pageWidth(doc);
    const centre = w / 2;

    if (this.logo) {
      const h = 11;
      try {
        doc.addImage(
          this.logo.data,
          this.logo.format,
          MARGIN,
          7,
          h * this.logo.ratio,
          h,
        );
      } catch {
        // An unsupported image never blocks the report.
      }
    }

    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(config.institution.toUpperCase(), centre, 11, {
      align: "center",
      maxWidth: w - 2 * MARGIN - 30,
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (config.department)
      doc.text(config.department.toUpperCase(), centre, 16, {
        align: "center",
      });

    doc.setFontSize(8);
    const strip = [
      config.reportTitle.toUpperCase(),
      config.examName,
      config.academicYear ? `A.Y. ${config.academicYear}` : "",
    ]
      .filter(Boolean)
      .join("  |  ");
    doc.text(strip, centre, 20.5, { align: "center" });

    doc.setDrawColor(RULE.r, RULE.g, RULE.b);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, HEADER_H - 4, w - MARGIN, HEADER_H - 4);
  };

  /** Footers, written once at the end so "of M" is the real page count. */
  footers(generatedAt: string) {
    const { doc, config } = this;
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      const w = pageWidth(doc);
      const h = pageHeight(doc);
      const y = h - FOOTER_H + 5;

      doc.setDrawColor(RULE.r, RULE.g, RULE.b);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y - 3.5, w - MARGIN, y - 3.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(90, 95, 105);

      const left = [config.reportTitle, config.department]
        .filter(Boolean)
        .join(" | ");
      doc.text(left, MARGIN, y, { maxWidth: w * 0.55 });
      doc.text(`Page ${i} of ${total}`, w - MARGIN, y, { align: "right" });

      const meta = [
        `Generated ${new Date(generatedAt).toLocaleString()}`,
        config.refNumber ? `Ref: ${config.refNumber}` : "",
      ]
        .filter(Boolean)
        .join("  ·  ");
      doc.text(meta, MARGIN, y + 3.6, { maxWidth: w - 2 * MARGIN });
    }
    doc.setTextColor(INK.r, INK.g, INK.b);
  }

  /** Start a new page in the given orientation and return the starting y. */
  newPage(orientation: Orientation): number {
    this.doc.addPage("a4", orientation);
    this.header();
    return HEADER_H + 4;
  }

  /** Room left before the footer band. */
  bottom() {
    return pageHeight(this.doc) - FOOTER_H - 4;
  }

  /** Break to a fresh page (same orientation) if `needed` mm won't fit. */
  space(y: number, needed: number): number {
    if (y + needed <= this.bottom()) return y;
    this.doc.addPage();
    this.header();
    return HEADER_H + 4;
  }

  sectionTitle(y: number, text: string): number {
    const { doc } = this;
    const next = this.space(y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(text, MARGIN, next + 4);
    doc.setDrawColor(RULE.r, RULE.g, RULE.b);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, next + 6, pageWidth(doc) - MARGIN, next + 6);
    return next + 11;
  }

  heading(y: number, text: string, size = 10): number {
    const { doc } = this;
    const next = this.space(y, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(INK.r, INK.g, INK.b);
    doc.text(text, MARGIN, next + 3.5);
    return next + 6.5;
  }

  paragraph(y: number, text: string, size = 8.5): number {
    const { doc } = this;
    const width = pageWidth(doc) - 2 * MARGIN;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    const next = this.space(y, lines.length * 4 + 3);
    doc.setTextColor(60, 65, 75);
    doc.text(lines, MARGIN, next + 3);
    doc.setTextColor(INK.r, INK.g, INK.b);
    return next + lines.length * 4 + 2;
  }
}

type TableArgs = {
  head: string[][];
  body: (string | number)[][];
  startY: number;
  fontSize?: number;
  columnStyles?: Record<number, { cellWidth?: number; halign?: "left" | "right" | "center" }>;
};

export async function generateReportPdf(bundle: ReportBundle): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const { config } = bundle;
  const logo = await loadLogo(config.logoUrl);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const rd = new ReportDoc(doc, config, logo);
  rd.header();

  /** Draw a table and return the y just below it. */
  const table = ({ head, body, startY, fontSize = 8, columnStyles }: TableArgs) => {
    autoTable(doc, {
      head,
      body,
      startY,
      theme: "grid",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      margin: { top: HEADER_H + 2, bottom: FOOTER_H + 2, left: MARGIN, right: MARGIN },
      styles: {
        font: "helvetica",
        fontSize,
        cellPadding: 1.6,
        overflow: "linebreak",
        lineColor: [200, 204, 212],
        lineWidth: 0.15,
        textColor: [INK.r, INK.g, INK.b],
      },
      headStyles: {
        fillColor: [HEAD_FILL.r, HEAD_FILL.g, HEAD_FILL.b],
        textColor: [INK.r, INK.g, INK.b],
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      columnStyles,
      didDrawPage: rd.header,
    });
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    return (last?.finalY ?? startY) + 6;
  };

  const numeric = (from: number, count: number) => {
    const styles: Record<number, { halign: "right" }> = {};
    for (let i = from; i < from + count; i++) styles[i] = { halign: "right" };
    return styles;
  };

  // =========================================================================
  // Title block
  // =========================================================================
  let y = HEADER_H + 6;
  const w = pageWidth(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(config.reportTitle.toUpperCase(), w / 2, y + 4, { align: "center" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(bundle.hackathon.name, w / 2, y + 2, { align: "center" });
  y += 8;

  const period = [bundle.hackathon.start_date, bundle.hackathon.end_date]
    .filter(Boolean)
    .join(" to ");

  y = table({
    startY: y,
    head: [["Report particulars", "", "", ""]],
    body: [
      [
        "Institution",
        config.institution,
        "Examination / Event",
        config.examName || bundle.hackathon.name,
      ],
      [
        "Department",
        config.department || "—",
        "Academic year",
        config.academicYear || "—",
      ],
      [
        "Venue",
        bundle.hackathon.venue || "—",
        "Event period",
        period || "—",
      ],
      [
        "Report date",
        config.reportDate || new Date(bundle.generatedAt).toLocaleDateString(),
        "Reference number",
        config.refNumber || "—",
      ],
      [
        "Teams assessed",
        String(bundle.level1.stats.totalTeams),
        "Rounds",
        String(bundle.level1.stats.totalRounds),
      ],
      [
        "Evaluators",
        String(bundle.level1.stats.totalEvaluators),
        "Total marks available",
        fmt(bundle.level1.stats.totalMarksAvailable),
      ],
      ...(config.address ? [["Address", config.address, "", ""]] : []),
    ],
    fontSize: 8.5,
    columnStyles: {
      0: { cellWidth: 32 },
      2: { cellWidth: 34 },
    },
  });

  // =========================================================================
  // LEVEL 1 — overall summary
  // =========================================================================
  const wideSummary = bundle.rounds.length > 3;
  if (wideSummary) y = rd.newPage("landscape");

  y = rd.sectionTitle(y, "SECTION 1 — OVERALL RESULTS SUMMARY");
  y = rd.paragraph(
    y,
    "Each team's round score is the average of the marks awarded by all evaluators who submitted for that round. The overall total is the sum of the round scores. Percentages are calculated against the total marks available across all rounds.",
  );

  y = table({
    startY: y,
    head: [
      [
        "Rank",
        "Team code",
        "Team name",
        ...bundle.rounds.map((r) => `${r.name}\n(max ${fmt(r.maxMarks)})`),
        "Overall total",
        "Max",
        "%",
        "Result",
      ],
    ],
    body: bundle.level1.rows.map((row) => [
      row.rank,
      row.teamCode,
      row.teamName,
      ...bundle.rounds.map((r) => fmt(row.roundScores[r.id] ?? 0)),
      fmt(row.overall),
      fmt(row.maxTotal),
      `${fmt(row.percentage)}%`,
      row.result,
    ]),
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 20 },
      ...numeric(3, bundle.rounds.length + 3),
    },
  });

  y = rd.heading(y, "Overall statistics");
  y = table({
    startY: y,
    head: [["Measure", "Value", "Measure", "Value"]],
    body: [
      [
        "Total teams",
        String(bundle.level1.stats.totalTeams),
        "Total marks available",
        fmt(bundle.level1.stats.totalMarksAvailable),
      ],
      [
        "Highest overall score",
        fmt(bundle.level1.stats.highest),
        "Lowest overall score",
        fmt(bundle.level1.stats.lowest),
      ],
      [
        "Average overall score",
        fmt(bundle.level1.stats.average),
        "Rounds conducted",
        String(bundle.level1.stats.totalRounds),
      ],
      [
        "Evaluators",
        String(bundle.level1.stats.totalEvaluators),
        "Evaluations submitted",
        `${bundle.level1.stats.evaluationsSubmitted} of ${bundle.level1.stats.evaluationsExpected}`,
      ],
    ],
    fontSize: 8.5,
  });

  y = rd.heading(y, "Verification of totals");
  y = rd.paragraph(
    y,
    bundle.discrepancies.length === 0
      ? "All three levels of this report reconcile: evaluator marks → component totals → round totals → team totals → overall total. No discrepancies were found."
      : `WARNING — ${bundle.discrepancies.length} reconciliation problem(s) were detected. This report must not be treated as final until they are resolved:`,
  );
  if (bundle.discrepancies.length > 0)
    y = table({
      startY: y,
      head: [["#", "Discrepancy"]],
      body: bundle.discrepancies.map((d, i) => [i + 1, d]),
      fontSize: 8,
      columnStyles: { 0: { cellWidth: 10, halign: "center" } },
    });

  // =========================================================================
  // LEVEL 2 — round-wise distribution
  // =========================================================================
  const widestRound = Math.max(
    0,
    ...bundle.rounds.map((r) => r.criteria.length),
  );
  y = rd.newPage(widestRound > 4 ? "landscape" : "portrait");
  y = rd.sectionTitle(y, "SECTION 2 — DETAILED DISTRIBUTION OF ROUND MARKS");
  y = rd.paragraph(
    y,
    "For every round, the marks obtained by each team in each component. A component figure is the average of that component's marks across the evaluators who submitted for the team; the round total is the sum of those component figures.",
  );

  for (const round of bundle.level2.rounds) {
    y = rd.heading(
      y,
      `${round.roundName} — maximum ${fmt(round.maxMarks)} marks`,
    );
    if (round.criteria.length === 0) {
      y = rd.paragraph(y, "No rubric components are configured for this round.");
      continue;
    }
    y = table({
      startY: y,
      head: [
        [
          "Team code",
          "Team name",
          ...round.criteria.map((c) => `${c.name}\n(max ${fmt(c.maxMarks)})`),
          "Round total",
          "Max",
          "Evaluators",
        ],
      ],
      body: round.rows.map((row) => [
        row.teamCode,
        row.teamName,
        ...round.criteria.map((c) => fmt(row.componentScores[c.id] ?? 0)),
        fmt(row.total),
        fmt(round.maxMarks),
        row.judgeCount,
      ]),
      columnStyles: {
        0: { cellWidth: 20 },
        ...numeric(2, round.criteria.length + 3),
      },
    });
  }

  y = rd.heading(y, "Consolidated round totals");
  y = table({
    startY: y,
    head: [
      [
        "Team code",
        "Team name",
        ...bundle.rounds.map((r) => r.name),
        "Grand total",
      ],
    ],
    body: bundle.level2.consolidated.map((row) => [
      row.teamCode,
      row.teamName,
      ...bundle.rounds.map((r) => fmt(row.roundScores[r.id] ?? 0)),
      fmt(row.grandTotal),
    ]),
    columnStyles: {
      0: { cellWidth: 20 },
      ...numeric(2, bundle.rounds.length + 1),
    },
  });

  // =========================================================================
  // LEVEL 3 — full audit trail
  // =========================================================================
  y = rd.newPage("portrait");
  y = rd.sectionTitle(
    y,
    "SECTION 3 — DETAILED EVALUATOR, TEAM AND COMPONENT REPORT",
  );
  y = rd.paragraph(
    y,
    "Every mark awarded in this assessment, presented three ways: by evaluator, by team and by component. Together these show exactly how each figure in Sections 1 and 2 was arrived at.",
  );

  // --- 3.1 evaluator-wise --------------------------------------------------
  y = rd.heading(y, "3.1  Evaluator-wise details", 11);
  if (bundle.level3.byEvaluator.length === 0)
    y = rd.paragraph(y, "No submitted evaluations were found for this event.");

  for (const evaluator of bundle.level3.byEvaluator) {
    y = rd.heading(
      y,
      `Evaluator: ${evaluator.judgeName}${evaluator.email ? ` (${evaluator.email})` : ""}`,
    );
    y = table({
      startY: y,
      head: [["Team", "Team name", "Round", "Component", "Max marks", "Marks given"]],
      body: evaluator.rows.map((r) => [
        r.teamCode,
        r.teamName,
        r.roundName,
        r.criterionName,
        fmt(r.maxMarks),
        fmt(r.score),
      ]),
      columnStyles: { 0: { cellWidth: 18 }, ...numeric(4, 2) },
    });

    y = rd.heading(y, `Evaluator total — ${evaluator.judgeName}`, 9);
    y = table({
      startY: y,
      head: [["Team", "Team name", "Maximum marks", "Marks given"]],
      body: [
        ...evaluator.summary.map((s) => [
          s.teamCode,
          s.teamName,
          fmt(s.maxMarks),
          fmt(s.given),
        ]),
        [
          "TOTAL",
          "",
          fmt(evaluator.totalMax),
          fmt(evaluator.totalGiven),
        ],
      ],
      fontSize: 8.5,
      columnStyles: { 0: { cellWidth: 18 }, ...numeric(2, 2) },
    });
  }

  // --- 3.2 team-wise -------------------------------------------------------
  y = rd.newPage("portrait");
  y = rd.heading(y, "3.2  Team-wise detailed evaluation", 11);

  for (const team of bundle.level3.byTeam) {
    y = rd.heading(y, `${team.teamCode} — ${team.teamName}`);
    for (const round of team.rounds) {
      y = rd.heading(y, round.roundName, 9);
      if (round.rows.length === 0) {
        y = rd.paragraph(
          y,
          "No submitted evaluations for this round — the round score is 0.",
        );
      } else {
        y = table({
          startY: y,
          head: [["Evaluator", "Component", "Maximum marks", "Marks given"]],
          body: round.rows.map((r) => [
            r.judgeName,
            r.criterionName,
            fmt(r.maxMarks),
            fmt(r.score),
          ]),
          fontSize: 8,
          columnStyles: numeric(2, 2),
        });
      }
      y = rd.paragraph(
        y,
        `${round.roundName} total: ${outOf(round.total, round.maxMarks)}  (average of ${round.judgeCount} evaluator${round.judgeCount === 1 ? "" : "s"})`,
        9,
      );
    }
    y = rd.paragraph(
      y,
      `${team.teamCode} overall total: ${outOf(team.overall, team.overallMax)}`,
      9.5,
    );
  }

  // --- 3.3 component-wise --------------------------------------------------
  y = rd.newPage("portrait");
  y = rd.heading(y, "3.3  Component-wise details", 11);

  for (const component of bundle.level3.byComponent) {
    y = rd.heading(
      y,
      `Component: ${component.criterionName} — ${component.roundName} (max ${fmt(component.maxMarks)})`,
      9.5,
    );
    if (component.rows.length === 0) {
      y = rd.paragraph(y, "No marks recorded for this component.");
      continue;
    }
    y = table({
      startY: y,
      head: [["Team", "Team name", "Evaluator", "Maximum marks", "Marks given"]],
      body: component.rows.map((r) => [
        r.teamCode,
        r.teamName,
        r.judgeName,
        fmt(r.maxMarks),
        fmt(r.score),
      ]),
      fontSize: 8,
      columnStyles: { 0: { cellWidth: 18 }, ...numeric(3, 2) },
    });
    y = rd.paragraph(
      y,
      `Component total across all teams (sum of per-team averages): ${fmt(component.total)}`,
      9,
    );
  }

  // =========================================================================
  // Verification & signatures
  // =========================================================================
  y = rd.newPage("portrait");
  y = rd.sectionTitle(y, "VERIFICATION & SIGNATURES");
  y = rd.paragraph(
    y,
    "This report was generated from the evaluation records held in the HackScore system. The figures in Sections 1, 2 and 3 are derived from the same underlying marks and have been checked to reconcile with one another.",
  );

  const blocks: [string, ReportConfig["preparedBy"]][] = [
    ["Prepared by", config.preparedBy],
    ["Verified by", config.verifiedBy],
    ["Approved by / Head of Department", config.approvedBy],
  ];

  const boxW = pageWidth(doc) - 2 * MARGIN;
  for (const [label, person] of blocks) {
    y = rd.space(y, 42);
    doc.setDrawColor(RULE.r, RULE.g, RULE.b);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, boxW, 38);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(label.toUpperCase(), MARGIN + 4, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rows = [
      `Name: ${person.name || "____________________________"}`,
      `Designation: ${person.designation || "____________________________"}`,
      `Department: ${person.department || config.department || "____________________________"}`,
      `Institution: ${person.institution || config.institution}`,
    ];
    rows.forEach((line, i) => doc.text(line, MARGIN + 4, y + 13 + i * 5));

    // Room for a physical signature and the date.
    const sigX = MARGIN + boxW - 68;
    doc.line(sigX, y + 28, sigX + 60, y + 28);
    doc.setFontSize(8);
    doc.text("Signature", sigX, y + 32);
    doc.line(sigX, y + 34.5, sigX + 60, y + 34.5);
    doc.text("Date", sigX, y + 37.5);

    y += 44;
  }

  rd.footers(bundle.generatedAt);
  doc.save(`${reportFileBase(config, bundle.hackathon.name)}.pdf`);
}

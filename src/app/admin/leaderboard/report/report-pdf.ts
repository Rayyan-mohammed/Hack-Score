// Builds the official evaluation report as a real PDF document: structured
// text and vector tables written with jsPDF + autoTable, not a screenshot or a
// browser print of the page.
//
// Document shape:
//   cover page  ->  event details  ->  level 1  ->  level 2  ->  level 3
//   ->  verification & signatures
//
// Layout rules the report has to satisfy:
//   * A4, professional margins, automatic page breaks, rows never split
//   * table headers repeat on every page (`showHead: "everyPage"`)
//   * a letterhead on every page after the cover, and "Page N of M" footers
//   * wide tables switch the page to landscape rather than shrinking the type
//   * printable in black and white — no dark ink-heavy fills
//
// jsPDF keeps the last-used orientation for subsequent `addPage()` calls, so a
// section that starts landscape stays landscape while autoTable paginates it,
// and the next section switches back explicitly.

import type { ReportBundle } from "@/lib/report-data";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { fmt, outOf } from "@/lib/report-format";
import { reportFileBase, type ReportConfig } from "@/lib/report-config";

type Doc = import("jspdf").jsPDF;
type Orientation = "portrait" | "landscape";

const MARGIN = 14; // mm
const HEADER_H = 26; // reserved band at the top of every page after the cover
const FOOTER_H = 14; // reserved band at the bottom

const INK: [number, number, number] = [17, 24, 39];
const SOFT: [number, number, number] = [90, 96, 108];
const RULE: [number, number, number] = [120, 126, 138];
const HAIRLINE: [number, number, number] = [205, 209, 217];
const BAND: [number, number, number] = [238, 240, 245];
const HEAD_FILL: [number, number, number] = [228, 231, 238];
const ZEBRA: [number, number, number] = [249, 250, 252];

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
  readonly config: ReportConfig;
  readonly logo: Logo | null;
  /** Pages whose letterhead has already been drawn — autoTable's page hook and
   *  a manual page add would otherwise print it twice. The cover is listed
   *  here from the start so it keeps its own full-size masthead. */
  private readonly stamped = new Set<number>();

  constructor(doc: Doc, config: ReportConfig, logo: Logo | null) {
    this.doc = doc;
    this.config = config;
    this.logo = logo;
  }

  get page() {
    return this.doc.getCurrentPageInfo().pageNumber;
  }

  skipHeaderOn(page: number) {
    this.stamped.add(page);
  }

  /**
   * Running letterhead. The logo occupies a fixed slot on the left and the
   * text is centred in the space that is left, so a wide crest can never be
   * overprinted by the institution name.
   */
  header = () => {
    const { doc, config } = this;
    const page = this.page;
    if (this.stamped.has(page)) return;
    this.stamped.add(page);

    const w = pageWidth(doc);
    let textLeft = MARGIN;

    if (this.logo) {
      const h = 10;
      const logoW = Math.min(h * this.logo.ratio, 30);
      try {
        doc.addImage(this.logo.data, this.logo.format, MARGIN, 6.5, logoW, h);
        textLeft = MARGIN + logoW + 5;
      } catch {
        // An unsupported image never blocks the report.
      }
    }

    const textRight = w - MARGIN;
    const centre = (textLeft + textRight) / 2;
    const maxWidth = textRight - textLeft;

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(config.institution.toUpperCase(), centre, 10.5, {
      align: "center",
      maxWidth,
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    if (config.department)
      doc.text(config.department.toUpperCase(), centre, 15, {
        align: "center",
        maxWidth,
      });

    doc.setFontSize(7.5);
    doc.setTextColor(...SOFT);
    const strip = [
      config.reportTitle.toUpperCase(),
      config.examName,
      config.academicYear ? `A.Y. ${config.academicYear}` : "",
    ]
      .filter(Boolean)
      .join("   ·   ");
    doc.text(strip, centre, 19, { align: "center", maxWidth });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, HEADER_H - 4.5, w - MARGIN, HEADER_H - 4.5);
    doc.setTextColor(...INK);
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

      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y - 3.5, w - MARGIN, y - 3.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...SOFT);

      const left = [config.reportTitle, config.department]
        .filter(Boolean)
        .join("  |  ");
      doc.text(left, MARGIN, y, { maxWidth: w * 0.6 });
      doc.text(`Page ${i} of ${total}`, w - MARGIN, y, { align: "right" });

      const meta = [
        `Generated ${formatDateTime(generatedAt)}`,
        config.refNumber ? `Ref: ${config.refNumber}` : "",
      ]
        .filter(Boolean)
        .join("   ·   ");
      doc.text(meta, MARGIN, y + 3.6, { maxWidth: w - 2 * MARGIN });
    }
    doc.setTextColor(...INK);
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

  /** Section banner: a light band with a solid accent block at its left. */
  sectionTitle(y: number, text: string): number {
    const { doc } = this;
    const next = this.space(y, 22);
    const w = pageWidth(doc) - 2 * MARGIN;

    doc.setFillColor(...BAND);
    doc.rect(MARGIN, next, w, 9, "F");
    doc.setFillColor(...INK);
    doc.rect(MARGIN, next, 1.6, 9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(text.toUpperCase(), MARGIN + 5, next + 6);
    return next + 14;
  }

  heading(y: number, text: string, size = 10): number {
    const { doc } = this;
    const next = this.space(y, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...INK);
    doc.text(text, MARGIN, next + 3.5);
    return next + 7;
  }

  paragraph(y: number, text: string, size = 8.5, tone = SOFT): number {
    const { doc } = this;
    const width = pageWidth(doc) - 2 * MARGIN;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    const next = this.space(y, lines.length * 4.2 + 3);
    doc.setTextColor(...tone);
    doc.text(lines, MARGIN, next + 3);
    doc.setTextColor(...INK);
    return next + lines.length * 4.2 + 3;
  }

  /** A short bold statement line, e.g. a running total under a table. */
  statement(y: number, text: string): number {
    const { doc } = this;
    const next = this.space(y, 10);
    const width = pageWidth(doc) - 2 * MARGIN;
    doc.setFillColor(...BAND);
    doc.rect(MARGIN, next, width, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(text, MARGIN + 3, next + 4.4);
    return next + 10;
  }
}

type ColumnStyle = {
  cellWidth?: number;
  halign?: "left" | "right" | "center";
  fontStyle?: "bold" | "normal";
};

type TableArgs = {
  head: string[][];
  body: (string | number)[][];
  startY: number;
  fontSize?: number;
  columnStyles?: Record<number, ColumnStyle>;
  /** Row indexes to print in bold (totals, podium places). */
  emphasise?: number[];
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
  rd.skipHeaderOn(1); // the cover carries its own, larger masthead

  /** Draw a table and return the y just below it. */
  const table = ({
    head,
    body,
    startY,
    fontSize = 8,
    columnStyles,
    emphasise = [],
  }: TableArgs) => {
    const bold = new Set(emphasise);
    autoTable(doc, {
      head,
      body,
      startY,
      theme: "grid",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      margin: {
        top: HEADER_H + 2,
        bottom: FOOTER_H + 2,
        left: MARGIN,
        right: MARGIN,
      },
      styles: {
        font: "helvetica",
        fontSize,
        cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
        overflow: "linebreak",
        lineColor: HAIRLINE,
        lineWidth: 0.15,
        textColor: INK,
        valign: "middle",
      },
      headStyles: {
        fillColor: HEAD_FILL,
        textColor: INK,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        lineColor: RULE,
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === "body" && bold.has(data.row.index))
          data.cell.styles.fontStyle = "bold";
      },
      didDrawPage: rd.header,
    });
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    return (last?.finalY ?? startY) + 7;
  };

  const numeric = (from: number, count: number) => {
    const styles: Record<number, ColumnStyle> = {};
    for (let i = from; i < from + count; i++) styles[i] = { halign: "right" };
    return styles;
  };

  const reportDate =
    config.reportDate || formatDate(bundle.generatedAt);
  const period =
    [bundle.hackathon.start_date, bundle.hackathon.end_date]
      .filter(Boolean)
      .join("  to  ") || "";

  // =========================================================================
  // COVER
  // =========================================================================
  const w = pageWidth(doc);
  const centre = w / 2;
  let y = 26;

  if (logo) {
    const h = 20;
    const logoW = Math.min(h * logo.ratio, w - 2 * MARGIN - 40);
    try {
      doc.addImage(logo.data, logo.format, centre - logoW / 2, y, logoW, h);
      y += h + 8;
    } catch {
      y += 2;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  for (const line of doc.splitTextToSize(
    config.institution.toUpperCase(),
    w - 2 * MARGIN,
  ) as string[]) {
    doc.text(line, centre, y, { align: "center" });
    y += 7;
  }

  if (config.department) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(config.department.toUpperCase(), centre, y + 1, {
      align: "center",
      maxWidth: w - 2 * MARGIN,
    });
    y += 7;
  }

  if (config.address) {
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    for (const line of doc.splitTextToSize(
      config.address,
      w - 2 * MARGIN - 30,
    ) as string[]) {
      doc.text(line, centre, y, { align: "center" });
      y += 4.4;
    }
    doc.setTextColor(...INK);
  }

  y += 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, w - MARGIN, y);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y + 1.4, w - MARGIN, y + 1.4);
  y += 14;

  // Title plate
  doc.setFillColor(...BAND);
  doc.rect(MARGIN + 8, y, w - 2 * MARGIN - 16, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(config.reportTitle.toUpperCase(), centre, y + 11.5, {
    align: "center",
    maxWidth: w - 2 * MARGIN - 24,
  });
  y += 26;

  doc.setFontSize(13);
  doc.text(bundle.hackathon.name, centre, y, {
    align: "center",
    maxWidth: w - 2 * MARGIN,
  });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SOFT);
  const subtitle = [bundle.hackathon.venue, period].filter(Boolean).join("  ·  ");
  if (subtitle) {
    doc.text(subtitle, centre, y, { align: "center" });
    y += 6;
  }
  if (config.academicYear) {
    doc.text(`Academic Year ${config.academicYear}`, centre, y, {
      align: "center",
    });
    y += 6;
  }
  doc.setTextColor(...INK);
  y += 6;

  // Report particulars — optional fields are omitted rather than printed "—",
  // so the cover never looks half-filled.
  const particulars: [string, string][] = [
    ["Examination / Event", config.examName || bundle.hackathon.name],
    ["Institution", config.institution],
    ["Department", config.department],
    ["Academic year", config.academicYear],
    ["Venue", bundle.hackathon.venue ?? ""],
    ["Event period", period],
    ["Report date", reportDate],
    ["Reference number", config.refNumber],
    ["Teams assessed", String(bundle.level1.stats.totalTeams)],
    ["Rounds conducted", String(bundle.level1.stats.totalRounds)],
    ["Evaluators", String(bundle.level1.stats.totalEvaluators)],
    ["Total marks available", fmt(bundle.level1.stats.totalMarksAvailable)],
  ].filter(([, value]) => Boolean(value && value.trim())) as [string, string][];

  y = table({
    startY: y,
    head: [["Report particulars", ""]],
    body: particulars,
    fontSize: 9,
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold" } },
  });

  y = rd.heading(y, "Contents");
  const contents: [string, string][] = [
    ["Event details", "Rounds, rubric, evaluators and participating teams"],
    ["Section 1", "Overall results summary"],
    ["Section 2", "Detailed distribution of round marks"],
    ["Section 3", "Evaluator, team and component details (audit trail)"],
    ["Verification", "Prepared by, verified by and approval signatures"],
  ];
  y = table({
    startY: y,
    head: [["", ""]],
    body: contents,
    fontSize: 9,
    columnStyles: { 0: { cellWidth: 34, fontStyle: "bold" } },
  });

  // =========================================================================
  // EVENT DETAILS
  // =========================================================================
  y = rd.newPage("portrait");
  y = rd.sectionTitle(y, "Event details");
  y = rd.paragraph(
    y,
    "The structure of the assessment: the rounds conducted, the rubric each round was marked against, the evaluators appointed, and the teams that took part.",
  );

  y = rd.heading(y, "Rounds");
  y = table({
    startY: y,
    head: [["#", "Round", "Components", "Maximum marks", "Evaluators appointed"]],
    body: bundle.rounds.map((r, i) => [
      i + 1,
      r.name,
      r.criteria.length,
      fmt(r.maxMarks),
      r.judgeNames.length ? r.judgeNames.join(", ") : "—",
    ]),
    fontSize: 8.5,
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 34 },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
    },
  });

  y = rd.heading(y, "Rubric");
  y = table({
    startY: y,
    head: [["Round", "Component", "Maximum marks", "Weight"]],
    body: bundle.rounds.flatMap((r) =>
      r.criteria.length
        ? r.criteria.map((c) => [r.name, c.name, fmt(c.maxMarks), fmt(c.weight)])
        : [[r.name, "No components configured", "—", "—"]],
    ),
    fontSize: 8.5,
    columnStyles: { 0: { cellWidth: 34 }, ...numeric(2, 2) },
  });

  y = rd.heading(y, "Evaluators");
  y = table({
    startY: y,
    head: [["#", "Evaluator", "Email", "Rounds appointed"]],
    body: bundle.judges.map((j, i) => [
      i + 1,
      j.name,
      j.email ?? "—",
      bundle.rounds
        .filter((r) => r.judgeNames.includes(j.name))
        .map((r) => r.name)
        .join(", ") || "—",
    ]),
    fontSize: 8.5,
    columnStyles: { 0: { cellWidth: 10, halign: "center" } },
  });

  y = rd.heading(y, "Participating teams");
  y = table({
    startY: y,
    head: [["Team", "Team name", "College", "Track", "Team leader", "Members"]],
    body: bundle.teams.map((t) => [
      t.code,
      t.name,
      t.college ?? "—",
      t.track ?? "—",
      t.leaderName ?? "—",
      t.members.length ? t.members.join(", ") : "—",
    ]),
    fontSize: 8,
    columnStyles: { 0: { cellWidth: 16 } },
  });

  // =========================================================================
  // LEVEL 1 — overall summary
  // =========================================================================
  y = rd.newPage(bundle.rounds.length > 3 ? "landscape" : "portrait");
  y = rd.sectionTitle(y, "Section 1 — Overall results summary");
  y = rd.paragraph(
    y,
    "A team's score in a round is the average of the totals awarded by every evaluator who submitted for that round. The overall total is the sum of the round scores, and the percentage is calculated against the total marks available across all rounds.",
  );

  const podium = bundle.level1.rows
    .map((r, i) => (r.rank <= 3 && r.overall > 0 ? i : -1))
    .filter((i) => i >= 0);

  y = table({
    startY: y,
    head: [
      [
        "Rank",
        "Team",
        "Team name",
        ...bundle.rounds.map((r) => `${r.name}\n(max ${fmt(r.maxMarks)})`),
        "Overall",
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
    fontSize: 8.5,
    emphasise: podium,
    columnStyles: {
      0: { cellWidth: 13, halign: "center" },
      1: { cellWidth: 18 },
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
    columnStyles: {
      0: { fontStyle: "bold" },
      2: { fontStyle: "bold" },
    },
  });

  y = rd.heading(y, "Verification of totals");
  if (bundle.discrepancies.length === 0) {
    y = rd.statement(
      y,
      "All levels reconcile: evaluator marks -> component totals -> round totals -> team totals -> overall total.",
    );
  } else {
    y = rd.paragraph(
      y,
      `WARNING — ${bundle.discrepancies.length} reconciliation problem(s) were detected. This report must not be treated as final until they are resolved:`,
      9,
      INK,
    );
    y = table({
      startY: y,
      head: [["#", "Discrepancy"]],
      body: bundle.discrepancies.map((d, i) => [i + 1, d]),
      fontSize: 8,
      columnStyles: { 0: { cellWidth: 10, halign: "center" } },
    });
  }

  // =========================================================================
  // LEVEL 2 — round-wise distribution
  // =========================================================================
  const widestRound = Math.max(
    0,
    ...bundle.rounds.map((r) => r.criteria.length),
  );
  y = rd.newPage(widestRound > 4 ? "landscape" : "portrait");
  y = rd.sectionTitle(y, "Section 2 — Detailed distribution of round marks");
  y = rd.paragraph(
    y,
    "For every round, the marks obtained by each team in each component. A component figure is the average of that component's marks across the evaluators who submitted for the team; the round total is the sum of those component figures.",
  );

  for (const round of bundle.level2.rounds) {
    y = rd.space(y, 46);
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
          "Team",
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
      fontSize: 8.5,
      columnStyles: {
        0: { cellWidth: 18 },
        ...numeric(2, round.criteria.length + 3),
      },
    });
  }

  y = rd.space(y, 46);
  y = rd.heading(y, "Consolidated round totals");
  y = table({
    startY: y,
    head: [
      ["Team", "Team name", ...bundle.rounds.map((r) => r.name), "Grand total"],
    ],
    body: bundle.level2.consolidated.map((row) => [
      row.teamCode,
      row.teamName,
      ...bundle.rounds.map((r) => fmt(row.roundScores[r.id] ?? 0)),
      fmt(row.grandTotal),
    ]),
    fontSize: 8.5,
    columnStyles: {
      0: { cellWidth: 18 },
      ...numeric(2, bundle.rounds.length + 1),
    },
  });

/**
 * Signing strip under an evaluator's own summary: the evaluator confirms, in
 * ink, that the marks printed directly above are the marks they awarded.
 * Kept whole — if it will not fit under the table it moves to the next page
 * rather than splitting the rule from its caption.
 */
function evaluatorSignature(
  rd: ReportDoc,
  doc: Doc,
  y: number,
  judgeName: string,
): number {
  const boxW = pageWidth(doc) - 2 * MARGIN;
  let next = rd.space(y, 34);
  next += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SOFT);
  doc.text(
    "I confirm the marks recorded above are those I awarded.",
    MARGIN,
    next,
  );

  const lineY = next + 16;
  const sigW = 70;
  const dateX = MARGIN + boxW - 52;

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, lineY, MARGIN + sigW, lineY);
  doc.line(dateX, lineY, dateX + 52, lineY);

  doc.setFontSize(8);
  doc.setTextColor(...SOFT);
  doc.text(`Signature — ${judgeName}`, MARGIN, lineY + 4);
  doc.text("Date", dateX, lineY + 4);
  doc.setTextColor(...INK);

  return lineY + 10;
}

  // =========================================================================
  // LEVEL 3 — full audit trail
  // =========================================================================
  y = rd.newPage("portrait");
  y = rd.sectionTitle(
    y,
    "Section 3 — Evaluator, team and component details",
  );
  y = rd.paragraph(
    y,
    "Every mark awarded in this assessment, presented three ways: by evaluator, by team and by component. Together these show exactly how each figure in Sections 1 and 2 was arrived at.",
  );

  // --- 3.1 evaluator-wise --------------------------------------------------
  y = rd.heading(y, "3.1  Evaluator-wise details", 11);
  if (bundle.level3.byEvaluator.length === 0)
    y = rd.paragraph(y, "No submitted evaluations were found for this event.");

  for (const [index, evaluator] of bundle.level3.byEvaluator.entries()) {
    // Each evaluator starts on a fresh page, so their marks and the signature
    // that attests to them are never split across two evaluators' pages.
    y = index === 0 ? rd.space(y, 60) : rd.newPage("portrait");
    y = rd.heading(
      y,
      `Evaluator: ${evaluator.judgeName}${evaluator.email ? `  (${evaluator.email})` : ""}`,
    );
    y = table({
      startY: y,
      head: [
        ["Team", "Team name", "Round", "Component", "Max marks", "Marks given"],
      ],
      body: evaluator.rows.map((r) => [
        r.teamCode,
        r.teamName,
        r.roundName,
        r.criterionName,
        fmt(r.maxMarks),
        fmt(r.score),
      ]),
      columnStyles: { 0: { cellWidth: 16 }, ...numeric(4, 2) },
    });

    // The summary and the signature it carries get a page of their own, so
    // what the evaluator signs is never a fragment at the foot of their
    // detailed marks.
    y = rd.newPage("portrait");
    y = rd.heading(y, `Evaluator summary — ${evaluator.judgeName}`, 9);
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
        ["TOTAL", "", fmt(evaluator.totalMax), fmt(evaluator.totalGiven)],
      ],
      fontSize: 8.5,
      emphasise: [evaluator.summary.length],
      columnStyles: { 0: { cellWidth: 16 }, ...numeric(2, 2) },
    });

    y = evaluatorSignature(rd, doc, y, evaluator.judgeName);
  }

  // --- 3.2 team-wise -------------------------------------------------------
  y = rd.newPage("portrait");
  y = rd.heading(y, "3.2  Team-wise detailed evaluation", 11);

  for (const team of bundle.level3.byTeam) {
    y = rd.space(y, 55);
    y = rd.heading(y, `${team.teamCode} — ${team.teamName}`);
    for (const round of team.rounds) {
      y = rd.space(y, 40);
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
      y = rd.statement(
        y,
        `${round.roundName} total: ${outOf(round.total, round.maxMarks)}   (average of ${round.judgeCount} evaluator${round.judgeCount === 1 ? "" : "s"})`,
      );
    }
    y = rd.statement(
      y,
      `${team.teamCode} — ${team.teamName}   ·   Overall total: ${outOf(team.overall, team.overallMax)}`,
    );
  }

  // --- 3.3 component-wise --------------------------------------------------
  y = rd.newPage("portrait");
  y = rd.heading(y, "3.3  Component-wise details", 11);

  for (const component of bundle.level3.byComponent) {
    y = rd.space(y, 55);
    y = rd.heading(
      y,
      `${component.criterionName} — ${component.roundName} (max ${fmt(component.maxMarks)})`,
      9.5,
    );
    if (component.rows.length === 0) {
      y = rd.paragraph(y, "No marks recorded for this component.");
      continue;
    }
    y = table({
      startY: y,
      head: [
        ["Team", "Team name", "Evaluator", "Maximum marks", "Marks given"],
      ],
      body: component.rows.map((r) => [
        r.teamCode,
        r.teamName,
        r.judgeName,
        fmt(r.maxMarks),
        fmt(r.score),
      ]),
      fontSize: 8,
      columnStyles: { 0: { cellWidth: 16 }, ...numeric(3, 2) },
    });
    y = rd.statement(
      y,
      `Component total across all teams (sum of per-team averages): ${fmt(component.total)}`,
    );
  }

  // =========================================================================
  // Verification & signatures
  // =========================================================================
  y = rd.newPage("portrait");
  y = rd.sectionTitle(y, "Verification & signatures");
  y = rd.paragraph(
    y,
    "This report was generated from the evaluation records held in the HackScore system on " +
      `${formatDateTime(bundle.generatedAt)}. ` +
      "The figures in Sections 1, 2 and 3 are derived from the same underlying marks and have been checked to reconcile with one another.",
  );

  const summaryLine =
    bundle.discrepancies.length === 0
      ? `${bundle.level1.stats.totalTeams} teams · ${bundle.level1.stats.totalRounds} rounds · ${bundle.level1.stats.totalEvaluators} evaluators · ${bundle.level1.stats.evaluationsSubmitted} of ${bundle.level1.stats.evaluationsExpected} evaluations submitted · totals reconciled`
      : `${bundle.discrepancies.length} reconciliation problem(s) recorded in Section 1 — resolve before treating this report as final`;
  y = rd.statement(y, summaryLine);
  y += 2;

  const blocks: [string, ReportConfig["preparedBy"]][] = [
    ["Prepared by", config.preparedBy],
    ["Verified by", config.verifiedBy],
    ["Approved by / Head of Department", config.approvedBy],
  ];

  const boxW = pageWidth(doc) - 2 * MARGIN;
  for (const [label, person] of blocks) {
    y = rd.space(y, 46);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, boxW, 40);
    doc.setFillColor(...BAND);
    doc.rect(MARGIN, y, boxW, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(label.toUpperCase(), MARGIN + 4, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rows = [
      `Name: ${person.name || "______________________________"}`,
      `Designation: ${person.designation || "______________________________"}`,
      `Department: ${person.department || config.department || "______________________________"}`,
      `Institution: ${person.institution || config.institution}`,
    ];
    rows.forEach((line, i) =>
      doc.text(line, MARGIN + 4, y + 15 + i * 5.5, { maxWidth: boxW - 78 }),
    );

    // Room for a physical signature and the date.
    const sigX = MARGIN + boxW - 70;
    doc.setDrawColor(...RULE);
    doc.line(sigX, y + 26, sigX + 62, y + 26);
    doc.setFontSize(8);
    doc.setTextColor(...SOFT);
    doc.text("Signature", sigX, y + 30);
    doc.setDrawColor(...RULE);
    doc.line(sigX, y + 34, sigX + 62, y + 34);
    doc.text("Date", sigX, y + 38);
    doc.setTextColor(...INK);

    y += 46;
  }

  rd.footers(bundle.generatedAt);
  doc.save(`${reportFileBase(config, bundle.hackathon.name)}.pdf`);
}

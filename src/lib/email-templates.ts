// HTML email templates — the "ceremony" design: a navy masthead with gold
// rules, a medal seal for the team's placing, score plaques and the jury's
// remarks set like a letter.
//
// Table-based with inline styles for broad email-client compatibility. Every
// gradient sits on top of a solid `bgcolor`, so clients that drop CSS
// backgrounds (Outlook) still get the right colour. Every interpolated user
// value is HTML-escaped; a plain-text alternative is generated alongside to
// improve deliverability.

function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Substitute the supported {{VARIABLES}} in subject/body text. */
export function fillVars(
  text: string,
  vars: { leaderName: string; teamName: string; hackathonName: string },
): string {
  return text
    .replaceAll("{{TEAM_LEADER_NAME}}", vars.leaderName)
    .replaceAll("{{TEAM_NAME}}", vars.teamName)
    .replaceAll("{{HACKATHON_NAME}}", vars.hackathonName);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const NAVY = "#1e1b4b";
const PLUM = "#2e1065";
const GOLD = "#c9a227";
const GOLD_DARK = "#a87f0f";
const GOLD_LIGHT = "#f1d27a";
const INDIGO = "#4f46e5";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6b7280";
const RULE = "#e6e1d3";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Helvetica,Arial,sans-serif";

function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(
    text,
  )}</div>`;
}

const GOLD_BAR = `<tr><td bgcolor="${GOLD}" style="background:${GOLD};background-image:linear-gradient(90deg,${GOLD_DARK},${GOLD_LIGHT},${GOLD_DARK});height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

/**
 * The frame every email shares: navy masthead, the content, navy footer.
 * `bodyHtml` is placed in a full-width cell and brings its own padding.
 */
export function emailShell(
  title: string,
  bodyHtml: string,
  preview = "",
  subtitle = "NMIMS Hyderabad &nbsp;&middot;&nbsp; SIH 2026 Internal Hackathon",
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f1e8;-webkit-font-smoothing:antialiased;">
  ${preview ? preheader(preview) : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f1e8" style="background:#f5f1e8;background-image:linear-gradient(180deg,#f7f3ea 0%,#eef0f6 100%);padding:40px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 40px 80px -40px rgba(30,27,75,.45),0 0 0 1px ${RULE};font-family:${SERIF};">

        <!-- Masthead -->
        <tr><td bgcolor="${NAVY}" style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY} 0%,${PLUM} 55%,${NAVY} 100%);padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${GOLD_BAR}
            <tr><td align="center" style="padding:26px 36px 24px;">
              <div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:5px;color:${GOLD_LIGHT};">HACKSCORE</div>
              <div style="margin-top:8px;font-size:13px;font-style:italic;color:#c7c3e6;letter-spacing:.3px;">${subtitle}</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0;">${bodyHtml}</td></tr>

        <!-- Footer -->
        <tr><td bgcolor="${NAVY}" style="background:${NAVY};padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${GOLD_BAR}
            <tr><td align="center" style="padding:20px 36px;font-family:${SANS};font-size:11px;line-height:1.8;color:#9d98c9;letter-spacing:.3px;">
              <span style="color:${GOLD_LIGHT};font-weight:700;letter-spacing:3px;">HACKSCORE</span><br>
              You&rsquo;re receiving this as the registered team leader for this event.<br>&copy; 2026 HackScore. All rights reserved.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type ResultEmailData = {
  leaderName: string;
  teamName: string;
  teamCode: string;
  track: string | null;
  award: "Winner" | "Runner-up" | "Second runner-up" | "Participant";
  hackathonName: string;
  rank: number;
  totalTeams: number;
  overall: number;
  /** Marks available across all rounds, when the rubric is known. */
  overallMax?: number;
  rounds: { name: string; score: number; maxMarks?: number }[];
  feedback: string[];
  resultsUrl: string;
  certificateUrl: string;
};

/** "Team AstraForge", but never "Team Team Cypher". */
function teamLabel(name: string): string {
  return /^team\b/i.test(name.trim()) ? name.trim() : `Team ${name.trim()}`;
}

/** "Dear Sahiti," — the first name, unless it is only an initial ("MD."). */
function salutation(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? "";
  return first.replace(/\./g, "").length <= 2 || first.includes(".")
    ? fullName.trim()
    : first;
}

const PLACE_WORD: Record<number, string> = { 1: "First", 2: "Second", 3: "Third" };

// The seal and the words around it, by placing.
const SEAL: Record<
  "1" | "2" | "3" | "other",
  { gradient: string; solid: string; ring: string; ink: string; emoji: string; label: string; laurel: string; chip?: string }
> = {
  "1": {
    gradient: "linear-gradient(160deg,#fbe8a6 0%,#e2b93b 55%,#b8860b 100%)",
    solid: GOLD_LIGHT, ring: "#d6c07a", ink: "#5c4200",
    emoji: "🏆", label: "FIRST PLACE", laurel: "CHAMPIONS", chip: "🥇 WINNER",
  },
  "2": {
    gradient: "linear-gradient(160deg,#f5f7fa 0%,#c3cad6 55%,#8a94a3 100%)",
    solid: "#d5dae2", ring: "#b7bfcb", ink: "#353c47",
    emoji: "🥈", label: "SECOND PLACE", laurel: "RUNNER-UP", chip: "🥈 RUNNER-UP",
  },
  "3": {
    gradient: "linear-gradient(160deg,#f8dcc2 0%,#d18c52 55%,#9a5a26 100%)",
    solid: "#e2a877", ring: "#d4a47e", ink: "#4d2a0c",
    emoji: "🥉", label: "THIRD PLACE", laurel: "SECOND RUNNER-UP", chip: "🥉 SECOND RUNNER-UP",
  },
  other: {
    gradient: "linear-gradient(160deg,#ecebf8 0%,#9d98c9 55%,#4b4690 100%)",
    solid: "#b8b4dd", ring: "#c9c6e6", ink: "#ffffff",
    emoji: "🎖️", label: "PARTICIPANT", laurel: "WITH APPRECIATION",
  },
};

function sectionTitle(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:22px;color:${NAVY};white-space:nowrap;padding-right:16px;">${esc(text)}</td>
    <td width="100%" style="border-top:1px solid ${RULE};font-size:0;">&nbsp;</td>
  </tr></table>`;
}

function chip(text: string, color: string, border: string, fill = ""): string {
  return `<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:1.5px;color:${color};${fill ? `background:${fill};` : ""}border:1px solid ${border};border-radius:2px;padding:7px 14px;margin:0 4px 6px;">${esc(text)}</span>`;
}

export function resultEmailHtml(p: ResultEmailData): string {
  const seal = SEAL[p.rank <= 3 && p.award !== "Participant" ? (String(p.rank) as "1" | "2" | "3") : "other"];
  const isPodium = p.award !== "Participant";
  const team = teamLabel(p.teamName);
  const suffix = ordinal(p.rank).replace(String(p.rank), "");

  const standing = isPodium
    ? p.rank === 1
      ? `First among ${p.totalTeams} teams, with the highest combined score<br>in the ${esc(p.hackathonName)}.`
      : `${PLACE_WORD[p.rank]} among ${p.totalTeams} teams<br>in the ${esc(p.hackathonName)}.`
    : `Ranked ${ordinal(p.rank)} among ${p.totalTeams} teams<br>in the ${esc(p.hackathonName)}.`;

  const letter = isPodium
    ? `On behalf of the organising committee, congratulations to you and your team. Judging has concluded, and your project ${
        p.rank === 1
          ? `earned the highest combined score of all ${p.totalTeams} teams`
          : `finished ${PLACE_WORD[p.rank].toLowerCase()} of ${p.totalTeams} teams`
      }. The full breakdown follows.`
    : `Thank you for taking part. Judging has concluded, and your project was ranked ${ordinal(p.rank)} of ${p.totalTeams} teams. The full breakdown follows.`;

  const chips = [
    chip(`TEAM ${p.teamCode}`, "#4338ca", "#c7d2fe"),
    p.track ? chip(p.track.toUpperCase(), "#0e7490", "#a5f3fc") : "",
    seal.chip ? chip(seal.chip, "#ffffff", NAVY, NAVY) : "",
  ]
    .filter(Boolean)
    .join("");

  const rounds = p.rounds
    .map((r, i) => {
      const pct =
        r.maxMarks && r.maxMarks > 0
          ? Math.max(0, Math.min(100, Math.round((r.score / r.maxMarks) * 100)))
          : null;
      const barColor = i % 2 === 0 ? GOLD : INDIGO;
      const barImage =
        i % 2 === 0
          ? `linear-gradient(90deg,${GOLD_DARK},#e2b93b)`
          : "linear-gradient(90deg,#4338ca,#7c3aed)";
      const bar =
        pct === null
          ? ""
          : `<tr><td colspan="2" style="padding:0 0 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#efece3" style="background:#efece3;border-radius:2px;"><tr>
                ${pct > 0 ? `<td width="${pct}%" bgcolor="${barColor}" style="background:${barColor};background-image:${barImage};height:8px;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>` : ""}
                ${pct < 100 ? `<td width="${100 - pct}%" style="height:8px;font-size:0;line-height:0;">&nbsp;</td>` : ""}
              </tr></table>
            </td></tr>`;
      return `<tr>
          <td style="padding:8px 0 6px;font-size:14px;color:${BODY};">${esc(r.name)}</td>
          <td align="right" style="padding:8px 0 6px;font-family:${SERIF};font-size:20px;color:${NAVY};">${esc(r.score)}${
            r.maxMarks ? `<span style="font-size:13px;color:#9ca3af;"> / ${esc(r.maxMarks)}</span>` : ""
          }</td>
        </tr>${bar}`;
    })
    .join("");

  const remarks = p.feedback
    .map((f, i) => {
      const lead = i === 0;
      return `<tr><td style="padding:0 0 18px;${lead ? "" : "border-top:1px solid #f0ede4;"}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"${lead ? "" : ' style="margin-top:18px;"'}><tr>
            <td width="34" valign="top" style="font-size:44px;line-height:.8;color:${GOLD};">&ldquo;</td>
            <td style="font-size:${lead ? 18 : 16}px;line-height:${lead ? 1.6 : 1.65};color:${lead ? NAVY : BODY};font-style:italic;">${esc(f)}</td>
          </tr></table>
        </td></tr>`;
    })
    .join("");

  const body = `
    <!-- Ceremony hero -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:44px 40px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
        <tr><td align="center" bgcolor="${seal.solid}" style="width:156px;height:156px;border-radius:78px;background:${seal.solid};background-image:${seal.gradient};box-shadow:0 0 0 5px #ffffff,0 0 0 6px ${seal.ring},0 26px 44px -18px rgba(30,27,75,.35);">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center">
            <tr><td align="center" style="width:126px;height:126px;border-radius:63px;border:1px solid rgba(255,255,255,.75);">
              <div style="font-size:40px;line-height:1;">${seal.emoji}</div>
              <div style="margin-top:4px;font-family:${SANS};font-size:10px;font-weight:800;letter-spacing:3px;color:${seal.ink};">${seal.label}</div>
            </td></tr>
          </table>
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:28px;"><tr>
        <td style="width:64px;border-top:1px solid #d6c07a;font-size:0;">&nbsp;</td>
        <td style="padding:0 14px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:4px;color:${GOLD_DARK};white-space:nowrap;">${seal.laurel}</td>
        <td style="width:64px;border-top:1px solid #d6c07a;font-size:0;">&nbsp;</td>
      </tr></table>

      <div style="margin-top:16px;font-size:42px;line-height:1.1;font-weight:400;color:${NAVY};letter-spacing:-.4px;">${esc(team)}</div>
      <div style="margin-top:14px;font-size:17px;line-height:1.7;color:#4b5563;font-style:italic;">${standing}</div>
      <div style="margin-top:22px;font-family:${SANS};">${chips}</div>
    </td></tr></table>

    <!-- Score plaques -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:38px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="49%" align="center" bgcolor="#faf6ea" style="background:#faf6ea;border:1px solid #e6d9ac;border-top:3px solid ${GOLD};border-radius:4px;padding:24px 12px 22px;">
          <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.5px;color:${GOLD_DARK};">FINAL RANK</div>
          <div style="font-size:60px;line-height:1;color:${NAVY};margin-top:10px;">${esc(p.rank)}<span style="font-size:22px;vertical-align:top;line-height:1.6;">${esc(suffix)}</span></div>
          <div style="font-family:${SANS};font-size:12px;color:${MUTED};margin-top:8px;">of ${esc(p.totalTeams)} teams</div>
        </td>
        <td width="2%" style="font-size:0;">&nbsp;</td>
        <td width="49%" align="center" bgcolor="#f3f2fb" style="background:#f3f2fb;border:1px solid #d4d0ee;border-top:3px solid ${INDIGO};border-radius:4px;padding:24px 12px 22px;">
          <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.5px;color:${INDIGO};">OVERALL SCORE</div>
          <div style="font-size:60px;line-height:1;color:${NAVY};margin-top:10px;">${esc(p.overall)}</div>
          <div style="font-family:${SANS};font-size:12px;color:${MUTED};margin-top:8px;">${p.overallMax ? `out of ${esc(p.overallMax)}` : "points"}</div>
        </td>
      </tr></table>
    </td></tr></table>

    <!-- Letter -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 40px 0;color:${INK};font-size:16px;line-height:1.75;">
      <p style="margin:0 0 10px;font-size:18px;color:${NAVY};">Dear ${esc(salutation(p.leaderName))},</p>
      <p style="margin:0;color:${BODY};">${letter}</p>
    </td></tr></table>

    ${
      rounds
        ? `<!-- Scores by round -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:36px 40px 0;">
      ${sectionTitle("Scores by round")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;font-family:${SANS};">${rounds}</table>
    </td></tr></table>`
        : ""
    }

    ${
      remarks
        ? `<!-- Jury remarks -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 40px 0;">
      ${sectionTitle("Remarks from the jury")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">${remarks}</table>
    </td></tr></table>`
        : ""
    }

    <!-- Actions -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 40px 0;font-family:${SANS};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" bgcolor="${GOLD}" style="background:${GOLD};background-image:linear-gradient(135deg,#e2b93b,#b8860b);border-radius:3px;box-shadow:0 16px 30px -14px rgba(184,134,11,.8);">
          <a href="${esc(p.certificateUrl)}" target="_blank" style="display:block;padding:19px 20px;color:${NAVY};text-decoration:none;text-align:center;">
            <span style="font-size:14px;font-weight:800;letter-spacing:2px;">DOWNLOAD YOUR CERTIFICATES</span><br>
            <span style="font-family:${SERIF};font-size:13px;font-style:italic;color:#3b2a00;">One for every team member</span>
          </a>
        </td></tr>
        <tr><td style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" bgcolor="${NAVY}" style="background:${NAVY};border-radius:3px;">
          <a href="${esc(p.resultsUrl)}" target="_blank" style="display:block;padding:17px 20px;color:#ffffff;text-decoration:none;text-align:center;font-size:13px;font-weight:700;letter-spacing:2px;">
            VIEW FULL RESULTS &nbsp;<span style="color:${GOLD_LIGHT};">&rarr;</span>
          </a>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:${MUTED};">These links are private to your team; please don&rsquo;t share them publicly. Questions? Reply to this email.</p>
    </td></tr></table>

    <!-- Sign-off -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:34px 40px 40px;">
      <div style="font-size:16px;line-height:1.7;color:${BODY};">With warm regards,</div>
      <div style="font-size:20px;color:${NAVY};margin-top:4px;">HackScore Team</div>
      <div style="font-family:${SANS};font-size:12px;color:${MUTED};margin-top:4px;">NMIMS School of Technology Management and Engineering</div>
    </td></tr></table>`;

  return emailShell(
    "Results Published — HackScore",
    body,
    `${team} — ${isPodium ? `${PLACE_WORD[p.rank]} place` : `ranked ${ordinal(p.rank)}`} of ${p.totalTeams} teams, ${p.overall} points. Your certificates are ready.`,
  );
}

/** Plain-text alternative (deliverability + accessibility). */
export function resultEmailText(p: ResultEmailData): string {
  const lines = [
    `Results Published — ${p.hackathonName}`,
    "",
    `Dear ${salutation(p.leaderName)},`,
    "",
    `Your team's results for ${p.hackathonName} are now published.`,
    "",
    `Team:        ${p.teamName} (${p.teamCode})`,
    `Rank:        ${ordinal(p.rank)} of ${p.totalTeams}${p.award !== "Participant" ? ` — ${p.award}` : ""}`,
    `Total score: ${p.overall}${p.overallMax ? ` / ${p.overallMax}` : ""}`,
  ];
  if (p.rounds.length) {
    lines.push("", "Scores by round:");
    for (const r of p.rounds)
      lines.push(`  - ${r.name}: ${r.score}${r.maxMarks ? ` / ${r.maxMarks}` : ""}`);
  }
  if (p.feedback.length) {
    lines.push("", "Remarks from the jury:");
    for (const f of p.feedback) lines.push(`  - ${f}`);
  }
  lines.push(
    "",
    `Your certificates (one per member): ${p.certificateUrl}`,
    `View full results: ${p.resultsUrl}`,
    "",
    "These links are private to your team. Reply to this email with any questions.",
    "",
    "With warm regards,",
    "HackScore Team",
    "",
    "© 2026 HackScore. All rights reserved.",
  );
  return lines.join("\n");
}

/** Generic template for the custom "Send emails" page. */
export function customEmailHtml(subject: string, bodyText: string): string {
  const safe = esc(bodyText).replace(/\n/g, "<br>");
  return emailShell(
    subject,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:36px 40px 40px;font-size:16px;line-height:1.75;color:${BODY};">${safe}</td></tr></table>`,
    bodyText.slice(0, 120),
  );
}

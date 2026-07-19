// HTML email templates — DARK theme matching the HackScore results page.
// Table-based with inline styles for broad email-client compatibility; the
// color-scheme meta + explicit colors keep clients (Gmail/Apple Mail dark mode)
// from re-inverting the design. Every interpolated user value is HTML-escaped;
// a plain-text alternative is generated alongside to improve deliverability.

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

// Dark palette (mirrors the app's design tokens)
const OUTER = "#0b0e14";
const CARD = "#12161f";
const RAISED = "#171c27";
const INK = "#e8ecf4";
const MUTED = "#9ba6bc";
const SUBTLE = "#6c778d";
const BORDER = "#232936";
const BORDER_2 = "#2e3646";
const VIOLET = "#7c3aed";
const VIOLET_BRIGHT = "#a78bfa";
const INDIGO = "#4f46e5";
const CYAN = "#06b6d4";
const CYAN_BRIGHT = "#22d3ee";
const PINK = "#f472b6";

function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
    text,
  )}</div>`;
}

/** Dark shell: gradient header + footer. */
export function emailShell(
  title: string,
  bodyHtml: string,
  preview = "",
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;background:${OUTER};color-scheme:dark;-webkit-font-smoothing:antialiased;">
  ${preview ? preheader(preview) : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${OUTER};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${CARD};border:1px solid ${BORDER};border-radius:18px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${VIOLET} 0%,${INDIGO} 48%,${CYAN} 100%);padding:30px 34px;">
          <div style="font-size:12px;letter-spacing:3px;color:#ffffff;opacity:.92;font-weight:700;">HACKSCORE</div>
          <div style="font-size:23px;color:#ffffff;font-weight:800;margin-top:8px;line-height:1.25;">${esc(title)}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 34px;color:${INK};font-size:15px;line-height:1.6;">
          ${bodyHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:22px 34px;border-top:1px solid ${BORDER};background:${OUTER};color:${SUBTLE};font-size:12px;line-height:1.7;">
          <strong style="color:${MUTED};">HackScore</strong> · NMIMS School of Technology, Management &amp; Engineering, Hyderabad.<br>
          You received this because you are a registered team leader for this event.
        </td></tr>
      </table>
      <div style="max-width:600px;color:${SUBTLE};font-size:11px;padding:14px 8px 0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">© 2026 HackScore. All rights reserved.</div>
    </td></tr>
  </table>
</body></html>`;
}

function button(label: string, sublabel: string, url: string, from: string, to: string): string {
  return `<a href="${esc(url)}" target="_blank" style="display:block;background:linear-gradient(135deg,${from},${to});color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 16px;text-align:center;box-shadow:0 6px 18px -6px ${from}66;">
    <span style="font-size:15px;font-weight:700;">${esc(label)}</span><br>
    <span style="font-size:12px;opacity:.9;">${esc(sublabel)}</span>
  </a>`;
}

function pill(text: string, color: string, bg: string, border: string): string {
  return `<span style="display:inline-block;font-size:12px;font-weight:600;color:${color};background:${bg};border:1px solid ${border};border-radius:999px;padding:3px 10px;">${esc(text)}</span>`;
}

// Podium medal gradients matching the app's RankBadge.
const PODIUM: Record<number, { grad: string; medal: string }> = {
  1: { grad: "linear-gradient(135deg,#fde68a,#f59e0b)", medal: "🥇" },
  2: { grad: "linear-gradient(135deg,#f1f5f9,#94a3b8)", medal: "🥈" },
  3: { grad: "linear-gradient(135deg,#e8a87c,#b45309)", medal: "🥉" },
};

function rankBadge(rank: number): string {
  const p = PODIUM[rank];
  if (p)
    return `<span style="display:inline-block;min-width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:${p.grad};color:#0b0e14;font-weight:800;font-size:14px;">${rank}</span>`;
  return `<span style="display:inline-block;min-width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:${RAISED};border:1px solid ${BORDER_2};color:${MUTED};font-weight:700;font-size:14px;">${rank}</span>`;
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
  rounds: { name: string; score: number }[];
  feedback: string[];
  resultsUrl: string;
  certificateUrl: string;
};

export function resultEmailHtml(p: ResultEmailData): string {
  const podium = PODIUM[p.rank];
  const isWinner = p.award !== "Participant";
  const congrats = isWinner
    ? `Congratulations — <strong style="color:${INK};">Team ${esc(p.teamName)}</strong> finished <strong style="color:${VIOLET_BRIGHT};">${esc(ordinal(p.rank))}</strong> in ${esc(p.hackathonName)}! ${podium?.medal ?? "🎉"}`
    : `Here are the final results for <strong style="color:${INK};">Team ${esc(p.teamName)}</strong> in ${esc(p.hackathonName)}.`;

  const badges = [
    pill(p.teamCode, MUTED, RAISED, BORDER_2),
    p.track ? pill(p.track, VIOLET_BRIGHT, "rgba(124,58,237,.15)", "rgba(124,58,237,.4)") : "",
    isWinner ? pill(`🏆 ${p.award}`, PINK, "rgba(244,114,182,.15)", "rgba(244,114,182,.4)") : "",
  ]
    .filter(Boolean)
    .join("&nbsp;");

  const roundsRows = p.rounds
    .map(
      (r) =>
        `<tr>
          <td style="padding:10px 0;color:${MUTED};border-bottom:1px solid ${BORDER};">${esc(r.name)}</td>
          <td style="padding:10px 0;color:${INK};text-align:right;font-weight:700;border-bottom:1px solid ${BORDER};font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(r.score)}</td>
        </tr>`,
    )
    .join("");

  const feedbackBlock = p.feedback.length
    ? `<p style="margin:22px 0 8px;font-weight:700;font-size:14px;color:${INK};">Judge feedback</p>
       ${p.feedback
         .map(
           (f) =>
             `<div style="background:${RAISED};border:1px solid ${BORDER};border-radius:10px;padding:12px 14px;margin:0 0 8px;color:${MUTED};font-size:14px;">“${esc(f)}”</div>`,
         )
         .join("")}`
    : "";

  const body = `
    <p style="margin:0 0 12px;font-size:16px;color:${INK};">Hi ${esc(p.leaderName)},</p>
    <p style="margin:0 0 14px;color:${MUTED};">${congrats}</p>
    <div style="margin:0 0 22px;">${badges}</div>

    <!-- Rank + score hero (matches the results page) -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:${RAISED};border:1px solid ${BORDER};border-radius:14px;margin:0 0 22px;">
      <tr>
        <td width="55%" style="padding:20px;border-right:1px solid ${BORDER};">
          <table role="presentation"><tr>
            <td style="padding-right:12px;">${rankBadge(p.rank)}</td>
            <td>
              <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:.5px;">Final rank</div>
              <div style="font-size:26px;font-weight:800;color:${INK};line-height:1.1;">#${esc(p.rank)} <span style="font-size:13px;font-weight:400;color:${SUBTLE};">of ${esc(p.totalTeams)}</span></div>
            </td>
          </tr></table>
        </td>
        <td width="45%" style="padding:20px;text-align:right;">
          <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:.5px;">Overall</div>
          <div style="font-size:30px;font-weight:800;color:${CYAN_BRIGHT};line-height:1.1;">${esc(p.overall)}</div>
          <div style="font-size:12px;color:${SUBTLE};">points</div>
        </td>
      </tr>
    </table>

    ${
      roundsRows
        ? `<p style="margin:0 0 4px;font-weight:700;font-size:14px;color:${INK};">Scores by round</p>
           <table role="presentation" width="100%" style="margin:0 0 4px;font-size:14px;">${roundsRows}</table>`
        : ""
    }

    ${feedbackBlock}

    <!-- Buttons -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 20px;">
      <tr>
        <td width="50%" style="padding-right:7px;">${button("View full results", "Scores & judge feedback", p.resultsUrl, VIOLET, INDIGO)}</td>
        <td width="50%" style="padding-left:7px;">${button("Download certificate", "PDF for your team", p.certificateUrl, INDIGO, CYAN)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" style="background:${RAISED};border:1px solid ${BORDER};border-radius:10px;">
      <tr><td style="padding:12px 14px;color:${MUTED};font-size:13px;">
        🔒 These links are <strong style="color:${INK};">private to your team</strong> — please don't share them publicly.
        Have a question? Just reply to this email.
      </td></tr>
    </table>`;

  return emailShell(
    "🎉 Results Published",
    body,
    `Team ${p.teamName} ranked ${ordinal(p.rank)} of ${p.totalTeams} in ${p.hackathonName} — view results & certificate.`,
  );
}

/** Plain-text alternative (deliverability + accessibility). */
export function resultEmailText(p: ResultEmailData): string {
  const lines = [
    `Results Published — ${p.hackathonName}`,
    "",
    `Hi ${p.leaderName},`,
    "",
    `Your team's results for ${p.hackathonName} are now published.`,
    "",
    `Team:        ${p.teamName} (${p.teamCode})`,
    `Rank:        ${ordinal(p.rank)} of ${p.totalTeams}${p.award !== "Participant" ? ` — ${p.award}` : ""}`,
    `Total score: ${p.overall}`,
  ];
  if (p.rounds.length) {
    lines.push("", "Scores by round:");
    for (const r of p.rounds) lines.push(`  - ${r.name}: ${r.score}`);
  }
  if (p.feedback.length) {
    lines.push("", "Judge feedback:");
    for (const f of p.feedback) lines.push(`  - ${f}`);
  }
  lines.push(
    "",
    `View full results:    ${p.resultsUrl}`,
    `Download certificate: ${p.certificateUrl}`,
    "",
    "These links are private to your team. Reply to this email with any questions.",
    "",
    "© 2026 HackScore · NMIMS School of Technology, Management & Engineering.",
  );
  return lines.join("\n");
}

/** Generic template for the custom "Send emails" page. */
export function customEmailHtml(subject: string, bodyText: string): string {
  const safe = esc(bodyText).replace(/\n/g, "<br>");
  return emailShell(
    subject,
    `<div style="font-size:15px;line-height:1.7;color:${INK};">${safe}</div>`,
    bodyText.slice(0, 120),
  );
}

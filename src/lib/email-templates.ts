// HTML email templates. Table-based with inline styles for broad email-client
// compatibility. Light, professional card on a soft neutral background (looks
// clean in Gmail light/dark), with the brand violet→cyan accents. Every
// interpolated user value is HTML-escaped. A plain-text alternative is
// generated alongside each HTML email to improve deliverability.

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

// Light palette
const OUTER = "#eef1f7";
const CARD = "#ffffff";
const INK = "#111827";
const MUTED = "#6b7280";
const SUBTLE = "#9aa3b2";
const BORDER = "#e8ebf0";
const VIOLET = "#7c3aed";
const INDIGO = "#4f46e5";
const CYAN = "#06b6d4";
const TINT = "#f6f4ff"; // soft violet panel
const TINT_BORDER = "#ece9fe";

/** Hidden inbox preview text. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
    text,
  )}</div>`;
}

/** Wrap body content in the shared light shell (gradient header + footer). */
export function emailShell(
  title: string,
  bodyHtml: string,
  preview = "",
): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:0;background:${OUTER};-webkit-font-smoothing:antialiased;">
  ${preview ? preheader(preview) : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${OUTER};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${CARD};border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(17,24,39,.06),0 18px 40px -22px rgba(17,24,39,.35);font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${VIOLET} 0%,${INDIGO} 50%,${CYAN} 100%);padding:30px 34px;">
          <div style="font-size:12px;letter-spacing:3px;color:#ffffff;opacity:.9;font-weight:700;">HACKSCORE</div>
          <div style="font-size:23px;color:#ffffff;font-weight:800;margin-top:8px;line-height:1.25;">${esc(title)}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 34px;color:${INK};font-size:15px;line-height:1.6;">
          ${bodyHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:22px 34px;border-top:1px solid ${BORDER};background:#fbfcfe;color:${SUBTLE};font-size:12px;line-height:1.7;">
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
  return `<a href="${esc(url)}" target="_blank" style="display:block;background:linear-gradient(135deg,${from},${to});color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 18px;text-align:center;">
    <span style="font-size:15px;font-weight:700;">${esc(label)}</span><br>
    <span style="font-size:12px;opacity:.9;">${esc(sublabel)}</span>
  </a>`;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function resultEmailHtml(p: {
  leaderName: string;
  teamName: string;
  hackathonName: string;
  rank: number;
  totalTeams: number;
  overall: number;
  rounds: { name: string; score: number }[];
  resultsUrl: string;
  certificateUrl: string;
}): string {
  const medal = MEDALS[p.rank] ?? "🎯";
  const isPodium = p.rank <= 3;
  const congrats = isPodium
    ? `Congratulations — <strong style="color:${INK};">Team ${esc(p.teamName)}</strong> finished <strong style="color:${VIOLET};">${esc(ordinal(p.rank))}</strong> in ${esc(p.hackathonName)}! 🎉`
    : `Here are the final results for <strong style="color:${INK};">Team ${esc(p.teamName)}</strong> in ${esc(p.hackathonName)}.`;

  const roundsRows = p.rounds
    .map(
      (r) =>
        `<tr>
          <td style="padding:9px 0;color:${MUTED};border-bottom:1px solid ${BORDER};">${esc(r.name)}</td>
          <td style="padding:9px 0;color:${INK};text-align:right;font-weight:700;border-bottom:1px solid ${BORDER};">${esc(r.score)}</td>
        </tr>`,
    )
    .join("");

  const body = `
    <p style="margin:0 0 14px;font-size:16px;">Hi ${esc(p.leaderName)},</p>
    <p style="margin:0 0 22px;color:${MUTED};">${congrats}</p>

    <!-- Hero rank + score -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:${TINT};border:1px solid ${TINT_BORDER};border-radius:14px;margin:0 0 22px;">
      <tr>
        <td width="50%" style="padding:20px;text-align:center;border-right:1px solid ${TINT_BORDER};">
          <div style="font-size:12px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;">Final rank</div>
          <div style="font-size:34px;font-weight:800;color:${VIOLET};margin-top:4px;line-height:1;">${medal} ${esc(ordinal(p.rank))}</div>
          <div style="font-size:12px;color:${SUBTLE};margin-top:6px;">of ${esc(p.totalTeams)} teams</div>
        </td>
        <td width="50%" style="padding:20px;text-align:center;">
          <div style="font-size:12px;letter-spacing:1px;color:${MUTED};text-transform:uppercase;">Total score</div>
          <div style="font-size:34px;font-weight:800;color:${INK};margin-top:4px;line-height:1;">${esc(p.overall)}</div>
          <div style="font-size:12px;color:${SUBTLE};margin-top:6px;">points</div>
        </td>
      </tr>
    </table>

    ${
      roundsRows
        ? `<p style="margin:0 0 6px;font-weight:700;font-size:14px;">Scores by round</p>
           <table role="presentation" width="100%" style="margin:0 0 26px;font-size:14px;">${roundsRows}</table>`
        : ""
    }

    <!-- Buttons -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      <tr>
        <td width="50%" style="padding-right:7px;">${button("View full results", "Scores & judge feedback", p.resultsUrl, VIOLET, INDIGO)}</td>
        <td width="50%" style="padding-left:7px;">${button("Download certificate", "PDF for your team", p.certificateUrl, INDIGO, CYAN)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" style="background:#f7f8fa;border-radius:10px;margin:0 0 6px;">
      <tr><td style="padding:12px 14px;color:${MUTED};font-size:13px;">
        🔒 These links are <strong style="color:${INK};">private to your team</strong> — please don't share them publicly.
        Have a question? Just reply to this email.
      </td></tr>
    </table>`;

  return emailShell(
    "🎉 Results Published",
    body,
    `Your team ranked ${ordinal(p.rank)} of ${p.totalTeams} in ${p.hackathonName} — view results & certificate.`,
  );
}

/** Plain-text alternative for the result email (deliverability + accessibility). */
export function resultEmailText(p: {
  leaderName: string;
  teamName: string;
  hackathonName: string;
  rank: number;
  totalTeams: number;
  overall: number;
  rounds: { name: string; score: number }[];
  resultsUrl: string;
  certificateUrl: string;
}): string {
  const lines = [
    `Results Published — ${p.hackathonName}`,
    "",
    `Hi ${p.leaderName},`,
    "",
    `Your team's results for ${p.hackathonName} are now published.`,
    "",
    `Team:        ${p.teamName}`,
    `Rank:        ${ordinal(p.rank)} of ${p.totalTeams}`,
    `Total score: ${p.overall}`,
  ];
  if (p.rounds.length) {
    lines.push("", "Scores by round:");
    for (const r of p.rounds) lines.push(`  - ${r.name}: ${r.score}`);
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

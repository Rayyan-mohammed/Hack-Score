// HTML email templates. Table-based with inline styles for broad email-client
// compatibility. Dark theme (#1a1a2e) with the project's violet/indigo/cyan
// accents. All interpolated user values are HTML-escaped.

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

const BG = "#0f1020";
const PANEL = "#1a1a2e";
const PANEL_2 = "#20223a";
const TEXT = "#e8ecf4";
const MUTED = "#a3a9bd";
const VIOLET = "#7c3aed";
const INDIGO = "#4f46e5";
const CYAN = "#06b6d4";
const BORDER = "#2b2d47";

/** Wrap body content in the shared dark shell (header + footer). */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${PANEL};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${VIOLET},${CYAN});padding:28px 32px;">
          <div style="font-size:13px;letter-spacing:3px;color:#ffffff;opacity:.85;font-weight:700;">HACKSCORE</div>
          <div style="font-size:24px;color:#ffffff;font-weight:800;margin-top:6px;">${esc(title)}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;color:${TEXT};font-size:15px;line-height:1.6;">
          ${bodyHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:22px 32px;border-top:1px solid ${BORDER};color:${MUTED};font-size:12px;line-height:1.6;">
          © 2026 HackScore · NMIMS School of Technology, Management &amp; Engineering.<br>
          You received this because you are a registered team leader for this event.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(label: string, url: string, color: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:12px;">${esc(label)}</a>`;
}

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
  const roundsRows = p.rounds
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 0;color:${MUTED};border-bottom:1px solid ${BORDER};">${esc(r.name)}</td>
          <td style="padding:8px 0;color:${TEXT};text-align:right;font-weight:700;border-bottom:1px solid ${BORDER};">${esc(r.score)}</td>
        </tr>`,
    )
    .join("");

  const body = `
    <p style="margin:0 0 16px;">Hi ${esc(p.leaderName)},</p>
    <p style="margin:0 0 20px;color:${MUTED};">Congratulations! Your team's results for
      <strong style="color:${TEXT};">${esc(p.hackathonName)}</strong> are now published.</p>

    <!-- Summary card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:${PANEL_2};border:1px solid ${BORDER};border-radius:12px;margin:0 0 22px;">
      <tr><td style="padding:18px 20px;">
        <table role="presentation" width="100%">
          <tr>
            <td style="color:${MUTED};font-size:13px;">Team</td>
            <td style="color:${TEXT};font-size:15px;font-weight:700;text-align:right;">${esc(p.teamName)}</td>
          </tr>
          <tr>
            <td style="color:${MUTED};font-size:13px;padding-top:8px;">Rank</td>
            <td style="color:${CYAN};font-size:20px;font-weight:800;text-align:right;padding-top:8px;">${esc(ordinal(p.rank))} <span style="color:${MUTED};font-size:13px;font-weight:400;">of ${esc(p.totalTeams)}</span></td>
          </tr>
          <tr>
            <td style="color:${MUTED};font-size:13px;padding-top:8px;">Total score</td>
            <td style="color:${TEXT};font-size:20px;font-weight:800;text-align:right;padding-top:8px;">${esc(p.overall)}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    ${
      roundsRows
        ? `<p style="margin:0 0 8px;font-weight:700;">Scores by round</p>
           <table role="presentation" width="100%" style="margin:0 0 24px;font-size:14px;">${roundsRows}</table>`
        : ""
    }

    <!-- Buttons -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      <tr>
        <td style="padding-right:10px;">${button("🔍 View Results", p.resultsUrl, VIOLET)}</td>
        <td>${button("📜 Download Certificate", p.certificateUrl, INDIGO)}</td>
      </tr>
    </table>

    <p style="margin:0;color:${MUTED};font-size:13px;">
      ✨ These links are private and unique to your team — please keep them secure.
    </p>`;

  return emailShell("🎉 Results Published", body);
}

/** Generic template for the custom "Send emails" page (Part 3). Body is the
 *  admin's message with {{variables}} already substituted; newlines → <br>. */
export function customEmailHtml(subject: string, bodyText: string): string {
  const safe = esc(bodyText).replace(/\n/g, "<br>");
  return emailShell(subject, `<div style="font-size:15px;line-height:1.7;">${safe}</div>`);
}

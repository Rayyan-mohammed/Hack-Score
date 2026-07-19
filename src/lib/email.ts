import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// SMTP email transport. Configured entirely via environment variables so no
// credential ever lives in the repo:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  (required)
//   SMTP_FROM_NAME                              (optional, defaults "HackScore")
//
// For Gmail: SMTP_PASS must be a 16-char App Password (2-Step Verification on),
// NOT the account password — Google rejects plain passwords over SMTP.

export function isEmailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Pool + reuse connections so bulk sends stay within function time limits.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });
  return cached;
}

export type SendResult = { to: string; ok: boolean; error?: string };

function fromHeader() {
  const name = process.env.SMTP_FROM_NAME ?? "HackScore";
  return `${name} <${process.env.SMTP_USER}>`;
}

/** Send one email. Never throws — returns ok/error so callers can report. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  if (!isEmailConfigured())
    return { to, ok: false, error: "Email is not configured (SMTP env vars missing)." };
  try {
    await getTransporter().sendMail({ from: fromHeader(), to, subject, html });
    return { to, ok: true };
  } catch (e) {
    return { to, ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Send many emails concurrently; returns a per-recipient result list. */
export async function sendBulk(
  messages: { to: string; subject: string; html: string }[],
): Promise<SendResult[]> {
  if (!isEmailConfigured())
    return messages.map((m) => ({
      to: m.to,
      ok: false,
      error: "Email is not configured (SMTP env vars missing).",
    }));
  return Promise.all(messages.map((m) => sendEmail(m.to, m.subject, m.html)));
}

/** Verify the SMTP connection/credentials (used by a test button/diagnostic). */
export async function verifyEmail(): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured())
    return { ok: false, error: "SMTP env vars are missing." };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "verify failed" };
  }
}

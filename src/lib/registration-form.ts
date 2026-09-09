// Pure helpers shared by the public registration form (client) and the server
// actions that persist it. Keep this file free of server-only imports — it is
// bundled into the browser.

import { isValidEmail } from "@/lib/team-validation";

/** How long a participant may keep editing their draft before it auto-submits. */
export const DRAFT_WINDOW_MINUTES = 60;
export const DRAFT_WINDOW_MS = DRAFT_WINDOW_MINUTES * 60 * 1000;

export type RegistrationValues = {
  full_name: string;
  sap_id: string;
  mobile: string;
  college_email: string;
  problem_statement_code: string;
  problem_statement: string;
};

export const EMPTY_REGISTRATION: RegistrationValues = {
  full_name: "",
  sap_id: "",
  mobile: "",
  college_email: "",
  problem_statement_code: "",
  problem_statement: "",
};

/** 10–15 digits, optional leading +, spaces/dashes ignored. */
export function isValidMobile(raw: string): boolean {
  const digits = raw.replace(/[\s()-]/g, "");
  return /^\+?\d{10,15}$/.test(digits);
}

/** SAP IDs are numeric in practice; accept 6–15 digits. */
export function isValidSapId(raw: string): boolean {
  return /^\d{6,15}$/.test(raw.trim());
}

/**
 * Field-level validation for a *manual* submit. Returns the first problem, or
 * null when the form is complete. Auto-submitted drafts skip this on purpose —
 * the one-hour window closing must never silently discard what was typed.
 */
export function validateRegistration(
  v: RegistrationValues,
): string | null {
  if (v.full_name.trim().length < 2) return "Enter your full name.";
  if (!isValidSapId(v.sap_id)) return "Enter a valid SAP ID (6–15 digits).";
  if (!isValidMobile(v.mobile))
    return "Enter a valid mobile number (10–15 digits).";
  if (!isValidEmail(v.college_email))
    return "Enter a valid college email ID.";
  if (!v.problem_statement_code.trim())
    return "Select or enter a problem statement ID.";
  if (v.problem_statement.trim().length < 3)
    return "Enter the problem statement.";
  return null;
}

/** Which required fields are still blank/invalid — shown on the confirmation
 *  page when a draft was auto-submitted half-finished. */
export function missingFields(v: RegistrationValues): string[] {
  const gaps: string[] = [];
  if (v.full_name.trim().length < 2) gaps.push("Name");
  if (!isValidSapId(v.sap_id)) gaps.push("SAP ID");
  if (!isValidMobile(v.mobile)) gaps.push("Mobile number");
  if (!isValidEmail(v.college_email)) gaps.push("College email ID");
  if (!v.problem_statement_code.trim()) gaps.push("Problem statement ID");
  if (v.problem_statement.trim().length < 3) gaps.push("Problem statement");
  return gaps;
}

/** Milliseconds -> "59:32" (or "1:02:15" if more than an hour remains). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

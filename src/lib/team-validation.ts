// Shared team validation used by the Add-team form and CSV import.

/** Split a semicolon-separated members string into trimmed, non-empty names. */
export function parseMembers(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(";")
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Basic email shape check (something@something.tld). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Total team size = the leader (counts as 1) + the listed members.
 * Returns an error string if outside [min, max], else null.
 */
export function validateTeamSize(
  memberCount: number,
  min: number,
  max: number,
): string | null {
  const total = 1 + memberCount; // +1 for the team leader
  if (total < min)
    return `Team must have at least ${min} members (leader + members) — currently ${total}.`;
  if (total > max)
    return `Team cannot exceed ${max} members — currently ${total}.`;
  return null;
}

/**
 * Spread a members string across a fixed number of input slots, so a roster
 * can be typed one name per field ("Member 2", "Member 3", …) while still
 * being stored in the semicolon format the CSV import and team creation use.
 * Extra names beyond `slots` are kept in the last slot rather than dropped.
 */
export function membersToSlots(
  raw: string | null | undefined,
  slots: number,
): string[] {
  const names = parseMembers(raw);
  const out = Array.from({ length: Math.max(0, slots) }, (_, i) => names[i] ?? "");
  if (slots > 0 && names.length > slots)
    out[slots - 1] = names.slice(slots - 1).join("; ");
  return out;
}

/** The inverse: slot values -> the stored "A; B; C" string, blanks dropped. */
export function slotsToMembers(slots: string[]): string {
  return slots
    .map((s) => s.trim())
    .filter(Boolean)
    .join("; ");
}

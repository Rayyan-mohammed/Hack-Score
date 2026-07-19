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

// Date-boundary validation for hackathon setup.
//
// The rule: nothing may be scheduled AFTER the hackathon's end_date, and round
// dates must sit within the hackathon's [start_date, end_date] window. Dates
// are compared by their calendar day (YYYY-MM-DD), which sorts correctly as a
// string, so a round ending at 23:00 on the end date is still valid.
//
// Note on the data model: only hackathons (start_date/end_date) and rounds
// (starts_at/ends_at) carry dates. There are no separate "team creation",
// "evaluation" or "judge assignment" deadline fields — a round's ends_at IS
// its evaluation cut-off, so validating round dates covers those cases.

export type Validation = { ok: true } | { ok: false; error: string };

/** ISO date (YYYY-MM-DD or a full ISO string) → DD-MM-YYYY for messages. */
export function fmtDMY(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

const day = (v: string) => v.slice(0, 10);

function afterEndError(field: string, endDate: string): string {
  return `❌ Invalid date: ${field} cannot be set after the hackathon end date (${fmtDMY(
    endDate,
  )}). Please select a date on or before the hackathon completion date.`;
}

function beforeStartError(field: string, startDate: string): string {
  return `❌ Invalid date: ${field} cannot be before the hackathon start date (${fmtDMY(
    startDate,
  )}).`;
}

/** Hackathon: start must be on or before end (same-day events are allowed). */
export function validateHackathonDates(
  start: string | null | undefined,
  end: string | null | undefined,
): Validation {
  if (start && end && day(start) > day(end)) {
    return {
      ok: false,
      error: `❌ Invalid date: Start date cannot be after the end date (${fmtDMY(
        end,
      )}).`,
    };
  }
  return { ok: true };
}

/**
 * Round dates must fall within the hackathon window. `hkStart`/`hkEnd` are the
 * hackathon's start_date/end_date; either may be null (that bound is skipped).
 */
export function validateRoundWithinHackathon(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  hkStart: string | null | undefined,
  hkEnd: string | null | undefined,
): Validation {
  if (startsAt && endsAt && startsAt > endsAt) {
    return {
      ok: false,
      error: "❌ Invalid date: Round start must be on or before its end.",
    };
  }
  if (hkEnd) {
    if (endsAt && day(endsAt) > day(hkEnd))
      return { ok: false, error: afterEndError("Round end date", hkEnd) };
    if (startsAt && day(startsAt) > day(hkEnd))
      return { ok: false, error: afterEndError("Round start date", hkEnd) };
  }
  if (hkStart) {
    if (startsAt && day(startsAt) < day(hkStart))
      return { ok: false, error: beforeStartError("Round start date", hkStart) };
    if (endsAt && day(endsAt) < day(hkStart))
      return { ok: false, error: beforeStartError("Round end date", hkStart) };
  }
  return { ok: true };
}

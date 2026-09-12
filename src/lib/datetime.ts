// Dates are rendered on the server, and the server runs in UTC — so a plain
// `toLocaleString()` showed a team added at 8:38 AM in Hyderabad as "3:08 AM".
// The event happens in one place, so every timestamp is formatted in that one
// zone regardless of where the code runs or who is reading it.
//
// Values are stored as `timestamptz` (an absolute instant); only the display
// is pinned here.

export const EVENT_TIME_ZONE = "Asia/Kolkata";
export const EVENT_LOCALE = "en-IN";

/** "12 Sep 2026, 08:38" — the default for anything with a time of day. */
export function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat(EVENT_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(value));
}

/** "12 Sep 2026" — no time. */
export function formatDate(value: string | number | Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat(EVENT_LOCALE, {
    dateStyle: "medium",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(value));
}

/** "12 September 2026" — for certificates and report covers. */
export function formatDateLong(
  value: string | number | Date | null | undefined,
) {
  if (!value) return "";
  return new Intl.DateTimeFormat(EVENT_LOCALE, {
    dateStyle: "long",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(value));
}

/** "08:38" — clock time only. */
export function formatTime(value: string | number | Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat(EVENT_LOCALE, {
    timeStyle: "short",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(value));
}

/**
 * "2026-09-12" for the event's day, not the server's. `toISOString()` would
 * roll over at 05:30 IST, dating an evening report to the next day.
 */
export function isoDateInEventZone(value: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
  }).format(value);
}

/**
 * "2026-09-13T18:00" (what a datetime-local input submits) -> the ISO instant
 * it means in the event's timezone. India has no daylight saving, so the
 * offset is a constant +05:30 and no lookup table is needed.
 */
export function eventLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}:00`
    : trimmed;
  const date = new Date(`${withSeconds}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

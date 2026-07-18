import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve which teams participate in each of the given rounds.
 *
 * Returns a Map from round_id to the Set of participating team ids. A round is
 * ONLY present in the map when it has an explicit shortlist (round_teams rows).
 * A round absent from the map has no shortlist and means "all hackathon teams
 * participate" — this keeps existing hackathons (created before shortlisting)
 * working unchanged until an admin promotes a subset.
 */
export async function getParticipantsMap(
  supabase: SupabaseClient,
  roundIds: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (roundIds.length === 0) return map;

  const { data } = await supabase
    .from("round_teams")
    .select("round_id, team_id")
    .in("round_id", roundIds);

  for (const row of data ?? []) {
    const set = map.get(row.round_id) ?? new Set<string>();
    set.add(row.team_id);
    map.set(row.round_id, set);
  }
  return map;
}

/** Single-round convenience: null means "no shortlist → all teams". */
export async function getRoundParticipantIds(
  supabase: SupabaseClient,
  roundId: string,
): Promise<Set<string> | null> {
  const map = await getParticipantsMap(supabase, [roundId]);
  return map.get(roundId) ?? null;
}

/** Does this team participate in this round? (No shortlist ⇒ yes.) */
export function participates(
  participants: Map<string, Set<string>>,
  roundId: string,
  teamId: string,
): boolean {
  const set = participants.get(roundId);
  return set ? set.has(teamId) : true;
}

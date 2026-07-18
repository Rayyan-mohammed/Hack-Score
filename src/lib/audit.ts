import { createClient } from "@/lib/supabase/server";

/**
 * Append a tamper-evident entry to audit_logs. The table is append-only
 * (admins can read, RLS blocks updates/deletes), so this is the record of
 * who did what and when. Best-effort: a logging failure never blocks the
 * underlying action.
 */
export async function logAudit(entry: {
  action: string;
  entity?: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  /** Pass the known actor id to skip an extra auth round-trip. */
  actorId?: string | null;
}) {
  try {
    const supabase = await createClient();

    let actorId = entry.actorId ?? null;
    if (actorId === undefined || actorId === null) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      actorId = user?.id ?? null;
    }

    await supabase.from("audit_logs").insert({
      actor_id: actorId,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      meta: entry.meta ?? null,
    });
  } catch {
    // Never let audit logging break the primary operation.
  }
}

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyCard } from "@/components/ui/states";
import { AuditFilters } from "./audit-filters";

type AuditRow = {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function toneFor(
  action: string,
): "danger" | "success" | "warning" | "violet" | "neutral" {
  if (action.includes("delete") || action.includes("purge")) return "danger";
  if (action.includes("restore") || action.includes("submit")) return "success";
  if (action.includes("publish") || action.includes("promote")) return "violet";
  if (action.includes("update") || action.includes("rubric")) return "warning";
  return "neutral";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    who?: string;
    action?: string;
  }>;
}) {
  const { from, to, who, action } = await searchParams;
  const supabase = await createClient();

  // Filter options: users who could be actors, and the set of actions seen.
  const [{ data: profiles }, { data: actionRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true }),
    supabase.from("audit_logs").select("action").limit(2000),
  ]);

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || "Unknown",
  }));
  const actions = [
    ...new Set((actionRows ?? []).map((r) => r.action as string)),
  ].sort();

  // Filtered log query. Dates are interpreted in IST (the app's display zone).
  let query = supabase
    .from("audit_logs")
    .select(
      "id, action, entity, entity_id, meta, created_at, profiles(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (from) query = query.gte("created_at", `${from}T00:00:00+05:30`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999+05:30`);
  if (who) query = query.eq("actor_id", who);
  if (action) query = query.eq("action", action);

  const { data } = await query;
  const rows = (data as unknown as AuditRow[]) ?? [];
  const filtered = !!(from || to || who || action);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every admin and judge action, timestamped and append-only."
      />

      <AuditFilters
        users={users}
        actions={actions}
        current={{ from, to, who, action }}
      />

      <p className="text-sm text-muted">
        {rows.length} {rows.length === 1 ? "entry" : "entries"}
        {filtered ? " match your filters" : ""}
        {rows.length === 500 ? " (showing the most recent 500)" : ""}
      </p>

      {rows.length === 0 ? (
        <EmptyCard
          title={filtered ? "No matching activity" : "No activity yet"}
          description={
            filtered
              ? "No audit entries match these filters. Try widening the date range or clearing them."
              : "Actions like creating hackathons, editing rubrics, submitting evaluations and deletions will appear here."
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Who</TH>
              <TH>Action</TH>
              <TH>Details</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-muted tabular-nums">
                  {fmt(r.created_at)}
                </TD>
                <TD className="whitespace-nowrap">
                  {r.profiles?.full_name || r.profiles?.email || (
                    <span className="text-subtle">system</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={toneFor(r.action)}>{r.action}</Badge>
                </TD>
                <TD className="text-muted">
                  {r.entity && (
                    <span className="font-mono text-xs">{r.entity}</span>
                  )}
                  {r.meta?.name ? ` · ${String(r.meta.name)}` : ""}
                  {r.meta?.detail ? ` · ${String(r.meta.detail)}` : ""}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

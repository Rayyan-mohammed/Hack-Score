import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyCard } from "@/components/ui/states";

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

// Colour-code the broad action families so the log scans quickly.
function toneFor(action: string): "danger" | "success" | "warning" | "violet" | "neutral" {
  if (action.includes("delete") || action.includes("purge")) return "danger";
  if (action.includes("restore") || action.includes("submit")) return "success";
  if (action.includes("publish") || action.includes("promote")) return "violet";
  if (action.includes("update") || action.includes("rubric")) return "warning";
  return "neutral";
}

export default async function AuditPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select(
      "id, action, entity, entity_id, meta, created_at, profiles(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data as unknown as AuditRow[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every admin and judge action, timestamped and append-only."
      />

      {rows.length === 0 ? (
        <EmptyCard
          title="No activity yet"
          description="Actions like creating hackathons, editing rubrics, submitting evaluations and deletions will appear here."
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

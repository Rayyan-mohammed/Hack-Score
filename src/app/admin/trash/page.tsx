import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyCard } from "@/components/ui/states";
import { restoreEntity, purgeEntity } from "./actions";

const RETENTION_DAYS = 30;
const MS_PER_DAY = 86_400_000;

type Kind = "hackathon" | "round" | "team";

type Row = {
  id: string;
  label: string;
  sublabel: string | null;
  deleted_at: string;
  kind: Kind;
};

function daysLeft(deletedAt: string, now: number) {
  const elapsed = (now - new Date(deletedAt).getTime()) / MS_PER_DAY;
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
}

export default async function TrashPage() {
  const supabase = await createClient();

  // Server components render once per request on the server, so reading the
  // wall clock here is intentional and correct (not a client-render impurity).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const cutoffIso = new Date(now - RETENTION_DAYS * MS_PER_DAY).toISOString();

  // Opportunistic purge: permanently remove anything past the 30-day window.
  // (A scheduled job is ideal; this cleans up whenever an admin opens Trash.)
  await Promise.all([
    supabase.from("hackathons").delete().lt("deleted_at", cutoffIso),
    supabase.from("rounds").delete().lt("deleted_at", cutoffIso),
    supabase.from("teams").delete().lt("deleted_at", cutoffIso),
  ]);

  const [{ data: hackathons }, { data: rounds }, { data: teams }] =
    await Promise.all([
      supabase
        .from("hackathons")
        .select("id, name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("rounds")
        .select("id, name, deleted_at, hackathons(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("teams")
        .select("id, team_code, name, deleted_at, hackathons(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);

  const rows: Row[] = [
    ...((hackathons ?? []).map((h) => ({
      id: h.id,
      label: h.name,
      sublabel: null,
      deleted_at: h.deleted_at as string,
      kind: "hackathon" as const,
    })) ?? []),
    ...((rounds ?? []).map((r) => ({
      id: r.id,
      label: r.name,
      sublabel:
        (r as unknown as { hackathons: { name: string } | null }).hackathons
          ?.name ?? null,
      deleted_at: r.deleted_at as string,
      kind: "round" as const,
    })) ?? []),
    ...((teams ?? []).map((t) => ({
      id: t.id,
      label: `${t.team_code} · ${t.name}`,
      sublabel:
        (t as unknown as { hackathons: { name: string } | null }).hackathons
          ?.name ?? null,
      deleted_at: t.deleted_at as string,
      kind: "team" as const,
    })) ?? []),
  ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trash"
        description={`Deleted items are recoverable for ${RETENTION_DAYS} days, then permanently removed.`}
      />

      {rows.length === 0 ? (
        <EmptyCard
          title="Trash is empty"
          description="Deleted hackathons, rounds and teams show up here with a 30-day recovery window."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recoverable items ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((row) => (
              <div
                key={`${row.kind}:${row.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-raised/50 px-4 py-3"
              >
                <Badge tone="neutral" className="uppercase">
                  {row.kind}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.label}</p>
                  {row.sublabel && (
                    <p className="truncate text-xs text-muted">{row.sublabel}</p>
                  )}
                </div>
                <span className="text-xs text-subtle">
                  {daysLeft(row.deleted_at, now)}d left
                </span>
                <form action={restoreEntity}>
                  <input type="hidden" name="kind" value={row.kind} />
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Restore
                  </Button>
                </form>
                <form action={purgeEntity}>
                  <input type="hidden" name="kind" value={row.kind} />
                  <input type="hidden" name="id" value={row.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="hover:bg-danger/10 hover:text-danger"
                  >
                    Delete forever
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

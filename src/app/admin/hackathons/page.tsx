import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyCard } from "@/components/ui/states";

type Hackathon = {
  id: string;
  name: string;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

export default async function HackathonsPage() {
  const supabase = await createClient();
  const { data: hackathons } = await supabase
    .from("hackathons")
    .select("id, name, venue, start_date, end_date, is_active")
    .order("created_at", { ascending: false });

  const rows = (hackathons as Hackathon[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Hackathons"
        description="Create and manage your events."
        action={
          <Link href="/admin/hackathons/new">
            <Button>New hackathon</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyCard
          title="No hackathons yet"
          description="Create your first one to get started."
          action={
            <Link href="/admin/hackathons/new">
              <Button>New hackathon</Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Venue</TH>
              <TH>Dates</TH>
              <TH>Status</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((h) => (
              <TR key={h.id}>
                <TD className="font-medium">{h.name}</TD>
                <TD className="text-muted">{h.venue ?? "—"}</TD>
                <TD className="text-muted">
                  {h.start_date ?? "—"}
                  {h.end_date ? ` → ${h.end_date}` : ""}
                </TD>
                <TD>
                  {h.is_active ? (
                    <StatusBadge status="active" />
                  ) : (
                    <Badge tone="neutral">Inactive</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  <Link
                    href={`/admin/hackathons/${h.id}`}
                    className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
                  >
                    Manage
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";

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
        <Card>
          <CardContent>
            <p className="text-sm text-muted">
              No hackathons yet. Create your first one to get started.
            </p>
          </CardContent>
        </Card>
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
                  <span
                    className={
                      h.is_active
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                    }
                  >
                    {h.is_active ? "Active" : "Inactive"}
                  </span>
                </TD>
                <TD className="text-right">
                  <Link
                    href={`/admin/hackathons/${h.id}`}
                    className="text-sm font-medium text-primary"
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

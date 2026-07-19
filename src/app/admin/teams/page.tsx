import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { TrackBadge } from "@/components/ui/badge";
import { EmptyCard, EmptyState } from "@/components/ui/states";
import {
  HackathonSelect,
  AddTeamForm,
  ImportTeamsForm,
} from "./teams-panel";
import { deleteTeam } from "./actions";

type Team = {
  id: string;
  team_code: string;
  name: string;
  college: string | null;
  track: string | null;
};

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const { h } = await searchParams;
  const supabase = await createClient();

  const { data: hackathons } = await supabase
    .from("hackathons")
    .select("id, name, min_team_size, max_team_size")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = hackathons ?? [];
  const selected = h || list[0]?.id;
  const selectedHk = list.find((x) => x.id === selected);
  const minSize = Number(selectedHk?.min_team_size ?? 1);
  const maxSize = Number(selectedHk?.max_team_size ?? 6);

  const { data: teams } = selected
    ? await supabase
        .from("teams")
        .select("id, team_code, name, college, track")
        .eq("hackathon_id", selected)
        .is("deleted_at", null)
        .order("team_code", { ascending: true })
    : { data: [] as Team[] };

  const rows = (teams as Team[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description="Add teams manually or import them from a CSV file."
        action={
          list.length > 0 ? (
            <HackathonSelect hackathons={list} selected={selected} />
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyCard
          title="No hackathons yet"
          description="Create a hackathon first, then come back to add teams."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {rows.length} team{rows.length === 1 ? "" : "s"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <EmptyState
                  title="No teams yet"
                  description="Add a team below, or import a whole roster from CSV."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Code</TH>
                      <TH>Name</TH>
                      <TH>College</TH>
                      <TH>Track</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <tbody>
                    {rows.map((t) => (
                      <TR key={t.id}>
                        <TD className="font-mono text-xs text-muted">
                          {t.team_code}
                        </TD>
                        <TD className="font-medium">{t.name}</TD>
                        <TD className="text-muted">{t.college ?? "—"}</TD>
                        <TD>
                          <TrackBadge track={t.track} />
                        </TD>
                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/teams/${t.id}/edit`}>
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            </Link>
                            <form action={deleteTeam}>
                              <input type="hidden" name="id" value={t.id} />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="submit"
                                className="hover:bg-danger/10 hover:text-danger"
                              >
                                Remove
                              </Button>
                            </form>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Add a team</CardTitle>
              </CardHeader>
              <CardContent>
                <AddTeamForm
                  hackathonId={selected!}
                  minSize={minSize}
                  maxSize={maxSize}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Import from CSV</CardTitle>
              </CardHeader>
              <CardContent>
                <ImportTeamsForm hackathonId={selected!} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

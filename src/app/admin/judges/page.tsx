import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { CreateJudgeForm } from "./create-judge-form";
import { AssignJudgeForm, type AssignTeam } from "./assign-form";
import { unassignJudge } from "./actions";

type Judge = { id: string; full_name: string | null; email: string | null };
type RoundRow = {
  id: string;
  name: string;
  hackathon_id: string;
  hackathons: { name: string } | null;
};
type Assignment = {
  round_id: string;
  judge_id: string;
  rounds: { name: string; hackathons: { name: string } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function JudgesPage() {
  const supabase = await createClient();

  const [
    { data: judges },
    { data: rounds },
    { data: assignments },
    { data: teams },
    { data: judgeTeams },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "judge")
      .order("full_name", { ascending: true }),
    supabase
      .from("rounds")
      .select("id, name, hackathon_id, hackathons(name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("round_judges")
      .select(
        "round_id, judge_id, rounds(name, hackathons(name)), profiles(full_name, email)",
      ),
    supabase
      .from("teams")
      .select(
        "id, hackathon_id, team_code, name, team_leader_name, track, problem_statement_code, problem_statement",
      )
      .is("deleted_at", null)
      .order("team_code", { ascending: true }),
    supabase.from("judge_teams").select("round_id, judge_id, team_id"),
  ]);

  const judgeList = (judges as Judge[]) ?? [];
  const roundList = (rounds as unknown as RoundRow[]) ?? [];
  const assignList = (assignments as unknown as Assignment[]) ?? [];
  const teamList = (teams as AssignTeam[]) ?? [];

  // "<roundId>:<judgeId>" -> team ids, so the form opens pre-ticked and the
  // table below can say how many teams each judge holds.
  const assignedTeams: Record<string, string[]> = {};
  for (const row of (judgeTeams as
    | { round_id: string; judge_id: string; team_id: string }[]
    | null) ?? []) {
    const key = `${row.round_id}:${row.judge_id}`;
    (assignedTeams[key] ??= []).push(row.team_id);
  }

  // How many teams a round has, to read "5 of 12" against.
  const roundTeamTotal = (roundId: string) => {
    const round = roundList.find((r) => r.id === roundId);
    return teamList.filter((t) => t.hackathon_id === round?.hackathon_id)
      .length;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Judges"
        description="Create judge accounts and assign them to rounds."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create a judge account</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateJudgeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Judges ({judgeList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {judgeList.length === 0 ? (
            <EmptyState
              title="No judges yet"
              description="Create a judge account above to get started."
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {judgeList.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/admin/judges/${j.id}`}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-raised/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-bright"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-accent-soft font-display text-xs font-semibold text-violet-bright"
                    >
                      {(j.full_name || j.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{j.full_name || "—"}</p>
                      <p className="truncate text-xs text-muted">{j.email}</p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign a judge to a round</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {judgeList.length === 0 || roundList.length === 0 ? (
            <EmptyState
              title="Nothing to assign yet"
              description="You need at least one judge and one round first."
            />
          ) : (
            <AssignJudgeForm
              judges={judgeList}
              rounds={roundList.map((r) => ({
                id: r.id,
                name: r.name,
                hackathon_id: r.hackathon_id,
                hackathon_name: r.hackathons?.name ?? null,
              }))}
              teams={teamList}
              assignedTeams={assignedTeams}
            />
          )}

          {assignList.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>Judge</TH>
                  <TH>Hackathon</TH>
                  <TH>Round</TH>
                  <TH>Teams</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {assignList.map((a) => (
                  <TR key={`${a.round_id}-${a.judge_id}`}>
                    <TD className="font-medium">
                      {a.profiles?.full_name || a.profiles?.email}
                    </TD>
                    <TD className="text-muted">
                      {a.rounds?.hackathons?.name ?? "—"}
                    </TD>
                    <TD className="text-muted">{a.rounds?.name ?? "—"}</TD>
                    <TD className="text-muted">
                      {(() => {
                        const picked =
                          assignedTeams[`${a.round_id}:${a.judge_id}`]?.length ??
                          0;
                        const total = roundTeamTotal(a.round_id);
                        return picked === 0 ? (
                          <span className="text-xs">All ({total})</span>
                        ) : (
                          <span className="text-xs text-foreground">
                            {picked} of {total}
                          </span>
                        );
                      })()}
                    </TD>
                    <TD className="text-right">
                      <form action={unassignJudge}>
                        <input type="hidden" name="judge_id" value={a.judge_id} />
                        <input type="hidden" name="round_id" value={a.round_id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Remove
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

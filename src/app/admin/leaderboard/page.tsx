import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import {
  computeStandings,
  round1,
  type EvalRow,
  type RoundRow,
  type TeamRow,
} from "@/lib/leaderboard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HackathonSelect } from "./hackathon-select";
import { TopTeamsChart } from "./top-teams-chart";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const { h } = await searchParams;
  const supabase = await createClient();

  const { data: hackathons } = await supabase
    .from("hackathons")
    .select("id, name")
    .order("created_at", { ascending: false });

  const list = hackathons ?? [];
  const selected = h || list[0]?.id;

  let teams: TeamRow[] = [];
  let rounds: RoundRow[] = [];
  let evals: EvalRow[] = [];
  let judgesPerRound = 0;

  if (selected) {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase
        .from("teams")
        .select("id, team_code, name, track, college")
        .eq("hackathon_id", selected),
      supabase
        .from("rounds")
        .select("id, name")
        .eq("hackathon_id", selected)
        .order("sort_order", { ascending: true }),
    ]);
    teams = (t as TeamRow[]) ?? [];
    rounds = (r as RoundRow[]) ?? [];

    const roundIds = rounds.map((x) => x.id);
    if (roundIds.length) {
      const [{ data: e }, { count }] = await Promise.all([
        supabase
          .from("evaluations")
          .select("round_id, team_id, total_score, status")
          .in("round_id", roundIds),
        supabase
          .from("round_judges")
          .select("*", { count: "exact", head: true })
          .in("round_id", roundIds),
      ]);
      evals = (e as EvalRow[]) ?? [];
      judgesPerRound = count ?? 0;
    }
  }

  const standings = computeStandings(teams, rounds, evals);
  const submittedCount = evals.filter((e) => e.status === "submitted").length;
  const expected = teams.length * judgesPerRound;
  const completion = expected ? Math.round((submittedCount / expected) * 100) : 0;

  const chartData = standings
    .filter((s) => s.overall > 0)
    .slice(0, 10)
    .map((s) => ({ name: s.team.team_code, score: round1(s.overall) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="Rankings computed from submitted evaluations."
        action={
          list.length > 0 ? (
            <div className="flex items-center gap-2">
              <HackathonSelect hackathons={list} selected={selected} />
              {selected && (
                <>
                  <a href={`/admin/leaderboard/export?h=${selected}`}>
                    <Button variant="outline" size="sm">
                      Export CSV
                    </Button>
                  </a>
                  <Link href={`/admin/leaderboard/report?h=${selected}`}>
                    <Button variant="outline" size="sm">
                      Report (PDF)
                    </Button>
                  </Link>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted">Create a hackathon first.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Teams", value: teams.length },
              { label: "Submitted evaluations", value: submittedCount },
              { label: "Completion", value: `${completion}%` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent>
                  <p className="text-sm text-muted">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top teams</CardTitle>
            </CardHeader>
            <CardContent>
              <TopTeamsChart data={chartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              {standings.length === 0 ? (
                <p className="text-sm text-muted">No teams yet.</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>#</TH>
                      <TH>Team</TH>
                      <TH>Track</TH>
                      {rounds.map((r) => (
                        <TH key={r.id}>{r.name}</TH>
                      ))}
                      <TH>Overall</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {standings.map((s, i) => (
                      <TR key={s.team.id}>
                        <TD className="font-medium">{i + 1}</TD>
                        <TD>
                          <span className="font-mono text-xs text-muted">
                            {s.team.team_code}
                          </span>{" "}
                          {s.team.name}
                        </TD>
                        <TD className="text-muted">{s.team.track ?? "—"}</TD>
                        {rounds.map((r) => (
                          <TD key={r.id} className="text-muted">
                            {round1(s.roundAverages[r.id] ?? 0)}
                          </TD>
                        ))}
                        <TD className="font-semibold">{round1(s.overall)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

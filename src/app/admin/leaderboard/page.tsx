import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
} from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { LiveBadge, RankBadge, TrackBadge } from "@/components/ui/badge";
import { EmptyCard, EmptyState } from "@/components/ui/states";
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
        <EmptyCard
          title="No hackathons yet"
          description="Create a hackathon first, then add rounds, teams and judges to see live standings here."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Teams" value={teams.length} />
            <StatCard label="Submitted evaluations" value={submittedCount} />
            <Card interactive className="relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-line opacity-60"
              />
              <CardContent>
                <p className="text-sm text-muted">Completion</p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
                  {completion}%
                </p>
                <div
                  role="progressbar"
                  aria-valuenow={completion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Evaluation completion"
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
                >
                  <div
                    className="h-full rounded-full bg-gradient-accent transition-[width] duration-500 ease-out"
                    // Dynamic width — the one place a style attribute is unavoidable.
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </CardContent>
            </Card>
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
            <CardHeader className="flex items-center justify-between gap-3">
              <CardTitle>Rankings</CardTitle>
              <LiveBadge />
            </CardHeader>
            <CardContent>
              {standings.length === 0 ? (
                <EmptyState
                  title="No teams yet"
                  description="Add teams to this hackathon to start ranking them."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>#</TH>
                      <TH>Team</TH>
                      <TH>Track</TH>
                      {rounds.map((r) => (
                        <TH key={r.id} className="text-right">
                          {r.name}
                        </TH>
                      ))}
                      <TH className="text-right">Overall</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {standings.map((s, i) => (
                      <TR key={s.team.id}>
                        <TD>
                          <RankBadge rank={i + 1} />
                        </TD>
                        <TD>
                          <Link
                            href={`/admin/leaderboard/${s.team.id}`}
                            className="group inline-flex items-baseline gap-1.5 rounded-md transition-colors hover:text-violet-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
                          >
                            <span className="font-mono text-xs text-muted group-hover:text-violet-bright">
                              {s.team.team_code}
                            </span>
                            <span className="font-medium underline-offset-4 group-hover:underline">
                              {s.team.name}
                            </span>
                          </Link>
                        </TD>
                        <TD>
                          <TrackBadge track={s.team.track} />
                        </TD>
                        {rounds.map((r) => (
                          <TD
                            key={r.id}
                            className="text-right text-muted tabular-nums"
                          >
                            {round1(s.roundAverages[r.id] ?? 0)}
                          </TD>
                        ))}
                        <TD className="text-right font-display font-semibold tabular-nums">
                          {round1(s.overall)}
                        </TD>
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

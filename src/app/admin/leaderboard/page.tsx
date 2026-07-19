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
import { Badge, LiveBadge, RankBadge, TrackBadge } from "@/components/ui/badge";
import { EmptyCard, EmptyState } from "@/components/ui/states";
import {
  computeStandings,
  round1,
  TIEBREAK_RULE,
  type EvalRow,
  type RoundRow,
  type TeamRow,
} from "@/lib/leaderboard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HackathonSelect } from "./hackathon-select";
import { TopTeamsChart } from "./top-teams-chart";
import { PublishControl } from "./publish-control";

// Allow up to 60s for bulk result emails (applies on Vercel Pro; Hobby caps
// at 10s regardless).
export const maxDuration = 60;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const { h } = await searchParams;
  const supabase = await createClient();

  const { data: hackathons } = await supabase
    .from("hackathons")
    .select("id, name, results_published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = hackathons ?? [];
  const selected = h || list[0]?.id;
  const selectedHk = list.find((x) => x.id === selected);

  let teams: TeamRow[] = [];
  let rounds: RoundRow[] = [];
  let evals: EvalRow[] = [];
  let judgesPerRound = 0;
  let leaderCount = 0;

  const maxCriterion: Record<string, number> = {};

  if (selected) {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase
        .from("teams")
        .select(
          "id, team_code, name, track, college, tiebreak_priority, team_leader_email",
        )
        .eq("hackathon_id", selected)
        .is("deleted_at", null),
      supabase
        .from("rounds")
        .select("id, name")
        .eq("hackathon_id", selected)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
    ]);
    teams = (t as TeamRow[]) ?? [];
    rounds = (r as RoundRow[]) ?? [];
    leaderCount = (
      (t as { team_leader_email: string | null }[]) ?? []
    ).filter((x) => x.team_leader_email?.trim()).length;

    const roundIds = rounds.map((x) => x.id);
    if (roundIds.length) {
      const [{ data: e }, { count }] = await Promise.all([
        supabase
          .from("evaluations")
          .select("id, round_id, team_id, total_score, status")
          .in("round_id", roundIds),
        supabase
          .from("round_judges")
          .select("*", { count: "exact", head: true })
          .in("round_id", roundIds),
      ]);
      evals = (e as EvalRow[]) ?? [];
      judgesPerRound = count ?? 0;

      // Highest single criterion score per team (tie-break tier 2), from the
      // per-criterion scores of submitted evaluations.
      const evalTeam = new Map<string, string>();
      for (const ev of (e as (EvalRow & { id: string })[]) ?? []) {
        if (ev.status === "submitted") evalTeam.set(ev.id, ev.team_id);
      }
      const evalIds = [...evalTeam.keys()];
      if (evalIds.length) {
        const { data: scores } = await supabase
          .from("evaluation_scores")
          .select("evaluation_id, score")
          .in("evaluation_id", evalIds);
        for (const s of scores ?? []) {
          const teamId = evalTeam.get(s.evaluation_id);
          if (!teamId) continue;
          maxCriterion[teamId] = Math.max(
            maxCriterion[teamId] ?? 0,
            Number(s.score),
          );
        }
      }
    }
  }

  const standings = computeStandings(teams, rounds, evals, { maxCriterion });
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

      {selected && (
        <PublishControl
          hackathonId={selected}
          published={!!selectedHk?.results_published}
          leaderCount={leaderCount}
        />
      )}

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
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Rankings</CardTitle>
                <p className="mt-1 text-xs text-muted">{TIEBREAK_RULE}</p>
              </div>
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
                          {s.unresolved ? (
                            <Badge tone="warning" className="ml-2 align-middle">
                              Tie — decide
                            </Badge>
                          ) : s.tied ? (
                            <Badge tone="neutral" className="ml-2 align-middle">
                              Tie-break
                            </Badge>
                          ) : null}
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

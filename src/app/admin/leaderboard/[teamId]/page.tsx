import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge, TrackBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { getTeamEvaluationBreakdown } from "@/lib/evaluations";

function fmtTime(iso: string | null) {
  if (!iso) return null;
  // Fixed locale/zone keeps server and client render identical (no hydration drift).
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getTeamEvaluationBreakdown(teamId);
  if (!data) notFound();

  const { team, rounds, grandTotal } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={team.name}
        description="Full evaluation breakdown by round and judge."
        action={
          <Link
            href="/admin/leaderboard"
            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            ← Back to leaderboard
          </Link>
        }
      />

      {/* Team meta */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">{team.team_code}</span>
        <TrackBadge track={team.track} />
        {team.college && <Badge tone="neutral">{team.college}</Badge>}
      </div>

      {rounds.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No rounds yet"
              description="This team's hackathon has no rounds configured."
            />
          </CardContent>
        </Card>
      ) : (
        rounds.map((round) => (
          <Card key={round.roundId}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>{round.roundName}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">
                  {round.submittedCount} judge
                  {round.submittedCount === 1 ? "" : "s"} submitted
                </span>
                <Badge tone="cyan">Round avg {round.roundAverage}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {round.judges.length === 0 ? (
                <EmptyState
                  title="No judges assigned"
                  description="Assign judges to this round to collect scores."
                />
              ) : (
                round.judges.map((judge) => (
                  <div
                    key={judge.judgeId}
                    className="rounded-xl border border-border bg-surface-raised/50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{judge.judgeName}</p>
                      <div className="flex items-center gap-2">
                        {judge.status === "submitted" && (
                          <span className="font-display text-sm font-semibold tabular-nums text-foreground">
                            {judge.subtotal} pts
                          </span>
                        )}
                        <StatusBadge
                          status={judge.status}
                          label={
                            judge.status === "pending"
                              ? "Not evaluated"
                              : undefined
                          }
                        />
                      </div>
                    </div>

                    {judge.status === "pending" ? (
                      <p className="mt-2 text-sm text-muted">
                        Not yet evaluated in this round.
                      </p>
                    ) : (
                      <>
                        <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                          {round.criteria.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-3 border-b border-border/60 py-1 last:border-0"
                            >
                              <dt className="text-sm text-muted">{c.name}</dt>
                              <dd className="font-mono text-sm tabular-nums text-foreground">
                                {judge.scores[c.id] ?? 0}
                                <span className="text-subtle">
                                  /{c.max_marks}
                                </span>
                              </dd>
                            </div>
                          ))}
                        </dl>

                        {judge.comments && (
                          <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted">
                            <span className="text-subtle">Comment: </span>
                            {judge.comments}
                          </p>
                        )}

                        {judge.status === "draft" && (
                          <p className="mt-2 text-xs text-warning">
                            Draft — not counted toward the round average until
                            submitted.
                          </p>
                        )}
                        {judge.submittedAt && (
                          <p className="mt-2 text-xs text-subtle">
                            Submitted {fmtTime(judge.submittedAt)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Grand total — highlighted */}
      <Card className="border-violet/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Grand total</p>
            <p className="text-xs text-subtle">
              Sum of per-round averages — matches the leaderboard.
            </p>
          </div>
          <p className="font-display text-4xl font-bold tracking-tight text-gradient-accent tabular-nums">
            {grandTotal}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

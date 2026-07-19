import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, RankBadge, TrackBadge } from "@/components/ui/badge";
import { getPublicTeamResult } from "@/lib/results";

export default async function TeamResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicTeamResult(token);

  if (result.status === "not_found") notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>

      {result.status === "unavailable" ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              Results are temporarily unavailable
            </p>
            <p className="mt-2 text-sm text-muted">
              We couldn’t load these results right now. Please try again in a
              little while, or contact the organisers if it persists.
            </p>
          </CardContent>
        </Card>
      ) : result.status === "unpublished" ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              Results aren’t published yet
            </p>
            <p className="mt-2 text-sm text-muted">
              Results for {result.hackathonName} will appear here once the
              organisers publish them. Check back soon.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted">{result.hackathon.name}</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
              {result.team.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono text-xs text-muted">
                {result.team.team_code}
              </span>
              <TrackBadge track={result.team.track} />
              {result.award !== "Participant" && (
                <Badge tone="pink">🏆 {result.award}</Badge>
              )}
            </div>
          </div>

          <Card className="border-violet/30">
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <RankBadge rank={result.rank} />
                <div>
                  <p className="text-sm text-muted">Final rank</p>
                  <p className="font-display text-xl font-bold">
                    #{result.rank}{" "}
                    <span className="text-sm font-normal text-muted">
                      of {result.totalTeams}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted">Overall</p>
                <p className="font-display text-3xl font-bold text-gradient-accent tabular-nums">
                  {result.overall}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scores by round</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.rounds.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0"
                >
                  <span className="text-muted">{r.name}</span>
                  <span className="font-mono tabular-nums">{r.score}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {result.feedback.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Judge feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.feedback.map((f, i) => (
                  <p
                    key={i}
                    className="rounded-lg bg-surface-raised/50 px-3 py-2 text-sm text-muted"
                  >
                    {f}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center">
            <Link
              href={`/results/${token}/certificate`}
              className="inline-flex h-11 items-center rounded-xl bg-gradient-accent px-6 text-sm font-medium text-white shadow-glow-soft transition-all hover:brightness-110"
            >
              View certificate
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

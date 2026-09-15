import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, RankBadge, TrackBadge } from "@/components/ui/badge";
import { getPublicTeamResult } from "@/lib/results";
import { getSessionUser } from "@/lib/auth";
import { ResultsPreviewBanner } from "@/components/results-preview-banner";

export default async function TeamResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // An admin may look before results are published; nobody else can.
  const { profile } = await getSessionUser();
  const result = await getPublicTeamResult(token, {
    allowUnpublished: profile?.role === "admin",
  });

  if (result.status === "not_found") notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>

      {result.status === "ok" && result.preview && <ResultsPreviewBanner />}

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

          {/* Round by round, criterion by criterion — each mark is the average
              of the evaluators who scored the team, so the team can see where
              it did well and where it lost marks. No evaluator is named. */}
          {result.rounds.map((r, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle>{r.name}</CardTitle>
                <p className="font-display text-lg font-bold tabular-nums">
                  {r.score}
                  {r.maxMarks > 0 && (
                    <span className="text-sm font-normal text-muted">
                      {" "}
                      / {r.maxMarks}
                    </span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {r.criteria.length === 0 ? (
                  <p className="text-sm text-muted">
                    No scoring criteria were recorded for this round.
                  </p>
                ) : (
                  r.criteria.map((c, j) => {
                    const pct =
                      c.maxMarks > 0
                        ? Math.min(100, Math.max(0, (c.score / c.maxMarks) * 100))
                        : 0;
                    return (
                      <div key={j}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-foreground">{c.name}</span>
                          <span className="shrink-0 font-mono tabular-nums">
                            {c.score}
                            <span className="text-subtle"> / {c.maxMarks}</span>
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised"
                          role="presentation"
                        >
                          <div
                            className="h-full rounded-full bg-gradient-accent"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
                {r.evaluators > 0 && (
                  <p className="pt-1 text-xs text-subtle">
                    Each mark is the average of {r.evaluators} evaluator
                    {r.evaluators === 1 ? "" : "s"}.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

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
              View certificates
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

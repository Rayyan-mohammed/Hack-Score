import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { ProgressBar } from "@/components/ui/progress";
import { getJudgeProgress, type ProgressTeam } from "@/lib/judge-progress";

function fmtTime(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 4.5 6 12 2.5 8.5" />
    </svg>
  );
}

function DotIcon() {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-subtle"
    />
  );
}

function TeamRowItem({
  team,
  evaluated,
}: {
  team: ProgressTeam;
  evaluated: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5 px-4 py-3">
      {evaluated ? <CheckIcon /> : <DotIcon />}
      <span className="min-w-0 flex-1">
        <span className="font-mono text-xs text-muted">{team.teamCode}</span>{" "}
        <span className="font-medium">{team.teamName}</span>
      </span>
      {evaluated && team.submittedAt && (
        <span className="shrink-0 text-xs text-subtle">
          {fmtTime(team.submittedAt)}
        </span>
      )}
    </li>
  );
}

export default async function JudgeDetailPage({
  params,
}: {
  params: Promise<{ judgeId: string }>;
}) {
  const { judgeId } = await params;
  const data = await getJudgeProgress(judgeId);
  if (!data) notFound();

  const { judge, totalTasks, submittedCount, rounds } = data;
  const pct = totalTasks ? (submittedCount / totalTasks) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={judge.full_name || judge.email || "Judge"}
        description={judge.email ?? undefined}
        action={
          <Link
            href="/admin/judges"
            className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
          >
            ← Back to judges
          </Link>
        }
      />

      {/* Overall progress */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {submittedCount} of {totalTasks} team
              {totalTasks === 1 ? "" : "s"} evaluated
            </p>
            <span className="font-display text-sm font-semibold text-violet-bright tabular-nums">
              {Math.round(pct)}%
            </span>
          </div>
          <ProgressBar value={pct} label="Evaluation progress" />
        </CardContent>
      </Card>

      {rounds.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No rounds assigned"
              description="This judge hasn't been assigned to any rounds yet."
            />
          </CardContent>
        </Card>
      ) : (
        rounds.map((round) => (
          <Card key={round.roundId}>
            <CardHeader>
              <CardTitle>
                {round.hackathonName ? `${round.hackathonName} · ` : ""}
                {round.roundName}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {/* Evaluated */}
              <div className="rounded-xl border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-sm font-medium">Teams Evaluated</span>
                  <Badge tone="success">{round.evaluated.length}</Badge>
                </div>
                {round.evaluated.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    None yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {round.evaluated.map((t) => (
                      <TeamRowItem key={t.teamId} team={t} evaluated />
                    ))}
                  </ul>
                )}
              </div>

              {/* Pending */}
              <div className="rounded-xl border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-sm font-medium">Teams Pending</span>
                  <Badge tone={round.pending.length ? "warning" : "neutral"}>
                    {round.pending.length}
                  </Badge>
                </div>
                {round.pending.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    All done 🎉
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {round.pending.map((t) => (
                      <TeamRowItem key={t.teamId} team={t} evaluated={false} />
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

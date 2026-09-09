import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { buildReportBundle } from "@/lib/report-data";
import { fmt, outOf } from "@/lib/report-format";
import { ReportWorkspace } from "./report-workspace";

// The report reads every evaluation and score for the event, so it is always
// rendered fresh rather than served from the route cache.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Details({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-border bg-surface-raised/40 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {summary}
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const { h } = await searchParams;
  if (!h) notFound();

  const bundle = await buildReportBundle(h);
  if (!bundle) notFound();

  const { config, level1, level2, level3, rounds } = bundle;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Official evaluation report"
        description="Set the letterhead and signatories, check the preview, then generate the PDF or Excel workbook."
      />

      <ReportWorkspace bundle={bundle} />

      <div id="report-preview" className="space-y-6">
        {/* Letterhead — the same block that opens the PDF. */}
        <Card>
          <CardContent className="space-y-1 text-center">
            <p className="font-display text-lg font-bold tracking-tight">
              {config.institution.toUpperCase()}
            </p>
            {config.department && (
              <p className="text-sm text-muted">
                {config.department.toUpperCase()}
              </p>
            )}
            <p className="pt-2 font-display text-base font-semibold text-gradient-accent">
              {config.reportTitle.toUpperCase()}
            </p>
            <p className="text-sm text-muted">
              {config.examName || bundle.hackathon.name}
              {config.academicYear ? ` · A.Y. ${config.academicYear}` : ""}
            </p>
            <p className="text-xs text-subtle">
              {config.reportDate ||
                new Date(bundle.generatedAt).toLocaleDateString()}
              {config.refNumber ? ` · Ref: ${config.refNumber}` : ""}
              {bundle.hackathon.venue ? ` · ${bundle.hackathon.venue}` : ""}
            </p>
          </CardContent>
        </Card>

        {bundle.discrepancies.length > 0 && (
          <Card className="border-danger/40">
            <CardHeader>
              <CardTitle>
                Reconciliation problems ({bundle.discrepancies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
                {bundle.discrepancies.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ---- LEVEL 1 ---------------------------------------------------- */}
        <SectionCard
          title="Section 1 — Overall results summary"
          subtitle="Round score = average of the submitted evaluators' totals. Overall = sum of the round scores."
        >
          <Table>
            <THead>
              <TR>
                <TH>Rank</TH>
                <TH>Team</TH>
                {rounds.map((r) => (
                  <TH key={r.id} className="text-right">
                    {r.name}
                    <span className="block text-[10px] font-normal normal-case">
                      max {fmt(r.maxMarks)}
                    </span>
                  </TH>
                ))}
                <TH className="text-right">Overall</TH>
                <TH className="text-right">%</TH>
                <TH>Result</TH>
              </TR>
            </THead>
            <tbody>
              {level1.rows.map((row) => (
                <TR key={row.teamId}>
                  <TD className="tabular-nums">{row.rank}</TD>
                  <TD>
                    <span className="font-mono text-xs text-muted">
                      {row.teamCode}
                    </span>{" "}
                    <span className="font-medium">{row.teamName}</span>
                  </TD>
                  {rounds.map((r) => (
                    <TD key={r.id} className="text-right tabular-nums text-muted">
                      {fmt(row.roundScores[r.id] ?? 0)}
                    </TD>
                  ))}
                  <TD className="text-right font-display font-semibold tabular-nums">
                    {fmt(row.overall)}
                    <span className="text-xs font-normal text-subtle">
                      {" "}
                      / {fmt(row.maxTotal)}
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {fmt(row.percentage)}%
                  </TD>
                  <TD>
                    <Badge
                      tone={row.rank <= 3 && row.overall > 0 ? "pink" : "neutral"}
                    >
                      {row.result}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total teams", String(level1.stats.totalTeams)],
              ["Total marks available", fmt(level1.stats.totalMarksAvailable)],
              ["Highest", fmt(level1.stats.highest)],
              ["Lowest", fmt(level1.stats.lowest)],
              ["Average", fmt(level1.stats.average)],
              ["Rounds", String(level1.stats.totalRounds)],
              ["Evaluators", String(level1.stats.totalEvaluators)],
              [
                "Evaluations submitted",
                `${level1.stats.evaluationsSubmitted} of ${level1.stats.evaluationsExpected}`,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-surface-raised/40 px-3 py-2"
              >
                <p className="text-xs text-muted">{label}</p>
                <p className="font-display text-lg font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ---- LEVEL 2 ---------------------------------------------------- */}
        <SectionCard
          title="Section 2 — Detailed distribution of round marks"
          subtitle="Each component figure is the average of that component's marks across the evaluators who submitted for the team."
        >
          {level2.rounds.map((round) => (
            <div key={round.roundId} className="space-y-2">
              <h3 className="font-display text-sm font-semibold">
                {round.roundName}{" "}
                <span className="font-normal text-muted">
                  — maximum {fmt(round.maxMarks)} marks
                </span>
              </h3>
              {round.criteria.length === 0 ? (
                <p className="text-sm text-muted">
                  No rubric components configured for this round.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Team</TH>
                      {round.criteria.map((c) => (
                        <TH key={c.id} className="text-right">
                          {c.name}
                          <span className="block text-[10px] font-normal normal-case">
                            max {fmt(c.maxMarks)}
                          </span>
                        </TH>
                      ))}
                      <TH className="text-right">Round total</TH>
                      <TH className="text-right">Evaluators</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {round.rows.map((row) => (
                      <TR key={row.teamId}>
                        <TD>
                          <span className="font-mono text-xs text-muted">
                            {row.teamCode}
                          </span>{" "}
                          {row.teamName}
                        </TD>
                        {round.criteria.map((c) => (
                          <TD
                            key={c.id}
                            className="text-right tabular-nums text-muted"
                          >
                            {fmt(row.componentScores[c.id] ?? 0)}
                          </TD>
                        ))}
                        <TD className="text-right font-semibold tabular-nums">
                          {outOf(row.total, round.maxMarks)}
                        </TD>
                        <TD className="text-right tabular-nums text-muted">
                          {row.judgeCount}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          ))}

          <div className="space-y-2">
            <h3 className="font-display text-sm font-semibold">
              Consolidated round totals
            </h3>
            <Table>
              <THead>
                <TR>
                  <TH>Team</TH>
                  {rounds.map((r) => (
                    <TH key={r.id} className="text-right">
                      {r.name}
                    </TH>
                  ))}
                  <TH className="text-right">Grand total</TH>
                </TR>
              </THead>
              <tbody>
                {level2.consolidated.map((row) => (
                  <TR key={row.teamId}>
                    <TD>
                      <span className="font-mono text-xs text-muted">
                        {row.teamCode}
                      </span>{" "}
                      {row.teamName}
                    </TD>
                    {rounds.map((r) => (
                      <TD key={r.id} className="text-right tabular-nums text-muted">
                        {fmt(row.roundScores[r.id] ?? 0)}
                      </TD>
                    ))}
                    <TD className="text-right font-semibold tabular-nums">
                      {fmt(row.grandTotal)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </SectionCard>

        {/* ---- LEVEL 3 ---------------------------------------------------- */}
        <SectionCard
          title="Section 3 — Evaluator, team and component details"
          subtitle="Every mark awarded, three ways. Expand a block to see it here; the PDF and Excel always contain all of it."
        >
          <div className="space-y-3">
            <h3 className="font-display text-sm font-semibold">
              3.1 Evaluator-wise
            </h3>
            {level3.byEvaluator.length === 0 && (
              <p className="text-sm text-muted">
                No submitted evaluations yet.
              </p>
            )}
            {level3.byEvaluator.map((e) => (
              <Details
                key={e.judgeId}
                summary={`${e.judgeName} — ${e.rows.length} marks, ${outOf(e.totalGiven, e.totalMax)}`}
              >
                <Table>
                  <THead>
                    <TR>
                      <TH>Team</TH>
                      <TH>Round</TH>
                      <TH>Component</TH>
                      <TH className="text-right">Max</TH>
                      <TH className="text-right">Given</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {e.rows.map((r, i) => (
                      <TR key={i}>
                        <TD>
                          <span className="font-mono text-xs text-muted">
                            {r.teamCode}
                          </span>{" "}
                          {r.teamName}
                        </TD>
                        <TD className="text-muted">{r.roundName}</TD>
                        <TD>{r.criterionName}</TD>
                        <TD className="text-right tabular-nums text-muted">
                          {fmt(r.maxMarks)}
                        </TD>
                        <TD className="text-right font-medium tabular-nums">
                          {fmt(r.score)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </Details>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-display text-sm font-semibold">3.2 Team-wise</h3>
            {level3.byTeam.map((t) => (
              <Details
                key={t.teamId}
                summary={`${t.teamCode} — ${t.teamName} · ${outOf(t.overall, t.overallMax)}`}
              >
                {t.rounds.map((r) => (
                  <div key={r.roundId} className="space-y-1.5">
                    <p className="text-xs font-medium tracking-wide text-muted uppercase">
                      {r.roundName} — {outOf(r.total, r.maxMarks)} (average of{" "}
                      {r.judgeCount} evaluator{r.judgeCount === 1 ? "" : "s"})
                    </p>
                    {r.rows.length === 0 ? (
                      <p className="text-sm text-subtle">
                        No submitted evaluations for this round.
                      </p>
                    ) : (
                      <Table>
                        <THead>
                          <TR>
                            <TH>Evaluator</TH>
                            <TH>Component</TH>
                            <TH className="text-right">Max</TH>
                            <TH className="text-right">Given</TH>
                          </TR>
                        </THead>
                        <tbody>
                          {r.rows.map((row, i) => (
                            <TR key={i}>
                              <TD>{row.judgeName}</TD>
                              <TD className="text-muted">{row.criterionName}</TD>
                              <TD className="text-right tabular-nums text-muted">
                                {fmt(row.maxMarks)}
                              </TD>
                              <TD className="text-right font-medium tabular-nums">
                                {fmt(row.score)}
                              </TD>
                            </TR>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </div>
                ))}
              </Details>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-display text-sm font-semibold">
              3.3 Component-wise
            </h3>
            {level3.byComponent.map((c, i) => (
              <Details
                key={i}
                summary={`${c.criterionName} — ${c.roundName} · total ${fmt(c.total)}`}
              >
                <Table>
                  <THead>
                    <TR>
                      <TH>Team</TH>
                      <TH>Evaluator</TH>
                      <TH className="text-right">Max</TH>
                      <TH className="text-right">Given</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {c.rows.map((r, j) => (
                      <TR key={j}>
                        <TD>
                          <span className="font-mono text-xs text-muted">
                            {r.teamCode}
                          </span>{" "}
                          {r.teamName}
                        </TD>
                        <TD className="text-muted">{r.judgeName}</TD>
                        <TD className="text-right tabular-nums text-muted">
                          {fmt(r.maxMarks)}
                        </TD>
                        <TD className="text-right font-medium tabular-nums">
                          {fmt(r.score)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </Details>
            ))}
          </div>
        </SectionCard>

        {/* ---- Signatures -------------------------------------------------- */}
        <SectionCard
          title="Verification & signatures"
          subtitle="Printed on the final page of the PDF with space for handwritten signatures."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Prepared by", config.preparedBy],
                ["Verified by", config.verifiedBy],
                ["Approved by / HOD", config.approvedBy],
              ] as const
            ).map(([label, person]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-surface-raised/40 p-4"
              >
                <p className="text-xs font-medium tracking-wide text-muted uppercase">
                  {label}
                </p>
                <p className="mt-2 font-medium">{person.name || "—"}</p>
                <p className="text-sm text-muted">{person.designation || "—"}</p>
                <p className="text-xs text-subtle">
                  {person.department || config.department}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

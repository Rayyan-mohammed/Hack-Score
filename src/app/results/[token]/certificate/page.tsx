import { notFound } from "next/navigation";
import { PrintButton } from "@/app/admin/leaderboard/report/print-button";
import { getPublicTeamResult } from "@/lib/results";

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicTeamResult(token);
  if (result.status !== "ok") notFound();

  const isWinner = result.award !== "Participant";
  const dateLine =
    fmtDate(result.hackathon.end_date) ??
    fmtDate(result.hackathon.start_date) ??
    "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex justify-end no-print">
        <PrintButton />
      </div>

      {/* The certificate itself. Forced to print light-on-white via globals. */}
      <div className="certificate relative overflow-hidden rounded-2xl border border-border bg-surface p-10 text-center shadow-card">
        {/* Accent frame */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-xl border-2 border-violet/30"
        />

        <div className="relative">
          <p className="font-display text-sm font-semibold tracking-[0.3em] text-violet-bright uppercase">
            Certificate of {isWinner ? "Achievement" : "Participation"}
          </p>

          <p className="mt-8 text-sm text-muted">This certifies that</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-foreground">
            {result.team.name}
          </h1>
          {result.team.members.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              {result.team.members.join(" · ")}
            </p>
          )}

          <p className="mx-auto mt-6 max-w-lg text-sm text-muted">
            {isWinner ? (
              <>
                secured the position of{" "}
                <span className="font-semibold text-foreground">
                  {result.award}
                </span>{" "}
                (Rank #{result.rank} of {result.totalTeams})
              </>
            ) : (
              <>
                participated and was ranked #{result.rank} of{" "}
                {result.totalTeams}
              </>
            )}{" "}
            at{" "}
            <span className="font-semibold text-foreground">
              {result.hackathon.name}
            </span>
            {result.hackathon.venue ? `, ${result.hackathon.venue}` : ""}.
          </p>

          {isWinner && (
            <p className="mt-6 font-display text-2xl">🏆</p>
          )}

          <div className="mt-12 flex items-end justify-between gap-6">
            <div className="flex-1 text-left">
              <p className="text-sm text-muted">{dateLine}</p>
              <div className="mt-1 border-t border-border pt-1 text-xs text-subtle">
                Date
              </div>
            </div>
            <div className="flex-1 text-right">
              <div className="ml-auto mt-1 w-48 border-t border-border pt-1 text-xs text-subtle">
                Authorised signatory · STME
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

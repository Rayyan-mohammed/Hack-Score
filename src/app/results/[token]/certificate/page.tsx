import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { ResultsPreviewBanner } from "@/components/results-preview-banner";
import { getSessionUser } from "@/lib/auth";
import { getPublicTeamResult } from "@/lib/results";
import { TeamCertificates } from "./team-certificates";

export const metadata = {
  title: "Certificates — HackScore",
};

/**
 * Every member's certificate for one team, behind that team's private results
 * link. Locked until results are published (an admin may preview earlier), and
 * scoped to the token's own team — no other team's certificates are reachable.
 */
export default async function CertificatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { profile } = await getSessionUser();
  const result = await getPublicTeamResult(token, {
    allowUnpublished: profile?.role === "admin",
  });

  if (result.status === "not_found") notFound();

  if (result.status !== "ok")
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex justify-center">
          <Brand size="lg" />
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              {result.status === "unpublished"
                ? "Certificates aren’t available yet"
                : "Certificates are temporarily unavailable"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {result.status === "unpublished"
                ? "They’ll appear here as soon as the organisers publish the results."
                : "Please try again in a little while."}
            </p>
          </CardContent>
        </Card>
      </main>
    );

  // The leader is person 1, then the team in the order it was registered.
  const people = [
    ...(result.team.leaderName
      ? [{ name: result.team.leaderName, role: "Team leader" }]
      : []),
    ...result.team.members.map((name, i) => ({
      name,
      role: `Member ${result.team.leaderName ? i + 2 : i + 1}`,
    })),
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>

      {result.preview && <ResultsPreviewBanner />}

      <div className="mb-8 text-center">
        <p className="text-sm text-muted">{result.hackathon.name}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Certificates of Participation
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          One for every member of your team. Download them individually, or all
          together as a single PDF.
        </p>
        <Link
          href={`/results/${token}`}
          className="mt-3 inline-block text-sm font-medium text-violet-bright hover:text-cyan-bright"
        >
          ← Back to results
        </Link>
      </div>

      <TeamCertificates teamName={result.team.name} people={people} />
    </main>
  );
}

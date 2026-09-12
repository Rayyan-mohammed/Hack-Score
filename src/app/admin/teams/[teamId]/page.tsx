import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, TrackBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/datetime";

type Team = {
  id: string;
  hackathon_id: string;
  team_code: string;
  name: string;
  college: string | null;
  track: string | null;
  mentor: string | null;
  team_leader_name: string | null;
  team_leader_email: string | null;
  problem_statement_code: string | null;
  problem_statement: string | null;
  created_at: string;
};

/** One label/value line. Long values wrap instead of stretching the card. */
function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}) {
  const empty =
    value === null || value === undefined || value === "" ? true : false;
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-full shrink-0 text-sm text-muted sm:w-48">{label}</span>
      <span
        className={`min-w-0 text-sm break-words ${
          empty ? "text-subtle" : "text-foreground"
        } ${mono ? "font-mono text-xs" : ""}`}
      >
        {empty ? "—" : value}
      </span>
    </div>
  );
}

export default async function TeamViewPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select(
      "id, hackathon_id, team_code, name, college, track, mentor, team_leader_name, team_leader_email, problem_statement_code, problem_statement, created_at",
    )
    .eq("id", teamId)
    .is("deleted_at", null)
    .single<Team>();

  if (!team) notFound();

  // The roster, the event it belongs to, and — when the team came from the
  // public form — the registration behind it, which carries the contact
  // details the team row doesn't store.
  const [{ data: members }, { data: hackathon }, { data: registration }] =
    await Promise.all([
      supabase
        .from("team_members")
        .select("id, name, email, role")
        .eq("team_id", teamId)
        .order("id", { ascending: true }),
      supabase
        .from("hackathons")
        .select("name")
        .eq("id", team.hackathon_id)
        .single(),
      supabase
        .from("registrations")
        .select(
          "sap_id, mobile, college_email, domain, status, submitted_at, auto_submitted, token",
        )
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  const roster = members ?? [];
  const teamSize = 1 + roster.length; // the leader plus the listed members

  return (
    <div>
      <PageHeader
        title={team.name}
        description={`Full details for ${team.team_code}${
          hackathon?.name ? ` · ${hackathon.name}` : ""
        }`}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/admin/teams/${team.id}/edit`}>
              <Button variant="outline" size="sm">
                Edit team
              </Button>
            </Link>
            <Link
              href={`/admin/teams?h=${team.hackathon_id}`}
              className="text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
            >
              ← Back to teams
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Row label="Team code" value={team.team_code} mono />
            <Row label="Team name" value={team.name} />
            <Row
              label="Track / domain"
              value={team.track ? <TrackBadge track={team.track} /> : null}
            />
            <Row label="College" value={team.college} />
            <Row label="Mentor" value={team.mentor} />
            <Row
              label="Team size"
              value={`${teamSize} (leader + ${roster.length} member${
                roster.length === 1 ? "" : "s"
              })`}
            />
            <Row
              label="Added"
              value={formatDateTime(team.created_at)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team leader</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Row label="Name" value={team.team_leader_name} />
            <Row
              label="Email"
              value={
                team.team_leader_email ? (
                  <a
                    href={`mailto:${team.team_leader_email}`}
                    className="text-violet-bright hover:text-cyan-bright"
                  >
                    {team.team_leader_email}
                  </a>
                ) : null
              }
            />
            <Row label="SAP ID" value={registration?.sap_id} mono />
            <Row label="Mobile number" value={registration?.mobile} />
            <Row label="College email ID" value={registration?.college_email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Problem statement</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Row
              label="Problem statement ID"
              value={team.problem_statement_code}
              mono
            />
            <Row label="Domain" value={registration?.domain ?? team.track} />
            <Row label="Description" value={team.problem_statement} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Members ({roster.length === 0 ? "none listed" : roster.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col gap-1 border-b border-border/60 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-full shrink-0 text-sm text-muted sm:w-48">
                Member 1
              </span>
              <span className="min-w-0 text-sm break-words text-foreground">
                {team.team_leader_name || "—"}{" "}
                <Badge tone="violet">Team leader</Badge>
              </span>
            </div>
            {roster.length === 0 ? (
              <div className="pt-3">
                <EmptyState
                  title="No members listed"
                  description="Only the team leader is on record for this team."
                />
              </div>
            ) : (
              roster.map((m, i) => (
                <Row
                  key={m.id}
                  label={`Member ${i + 2}`}
                  value={
                    <>
                      {m.name}
                      {m.email ? (
                        <span className="text-muted"> · {m.email}</span>
                      ) : null}
                      {m.role ? (
                        <span className="text-subtle"> · {m.role}</span>
                      ) : null}
                    </>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {registration && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Registration</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Row
              label="Submitted"
              value={
                registration.submitted_at
                  ? `${formatDateTime(registration.submitted_at)}${
                      registration.auto_submitted ? " (auto-submitted)" : ""
                    }`
                  : registration.status
              }
            />
            <Row
              label="Participant's receipt"
              value={
                <Link
                  href={`/register/success/${registration.token}`}
                  className="text-violet-bright hover:text-cyan-bright"
                >
                  Open the form this team submitted ↗
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

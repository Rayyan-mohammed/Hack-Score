import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site";
import { PageHeader } from "@/components/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { EmptyCard, EmptyState } from "@/components/ui/states";
import { listProblemStatements, listRegistrations } from "@/lib/registrations";
import { RegistrationLink } from "./registration-link";
import {
  AddProblemStatementForm,
  ConfirmRemoveButton,
  DraftCountdown,
  HackathonSelect,
  RegistrationSettingsForm,
} from "./registrations-panel";
import {
  createTeamForRegistration,
  deleteProblemStatement,
  deleteRegistration,
} from "./actions";
import { Toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";

type HackathonRow = {
  id: string;
  name: string;
  registration_open: boolean;
  whatsapp_group_url: string | null;
  ppt_template_url: string | null;
  resources_url: string | null;
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ h?: string; msg?: string; err?: string }>;
}) {
  const { h, msg, err } = await searchParams;
  const supabase = await createClient();

  const { data: hackathons } = await supabase
    .from("hackathons")
    .select(
      "id, name, registration_open, whatsapp_group_url, ppt_template_url, resources_url",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = (hackathons as HackathonRow[]) ?? [];
  const selected = h || list[0]?.id;
  const hackathon = list.find((x) => x.id === selected);

  if (!hackathon)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Registrations"
          description="Collect participant details through a public form."
        />
        <EmptyCard
          title="No hackathons yet"
          description="Create a hackathon first, then share its registration form."
        />
      </div>
    );

  const [registrations, problemStatements, { data: teamRows }] =
    await Promise.all([
      listRegistrations(hackathon.id),
      listProblemStatements(hackathon.id),
      supabase
        .from("teams")
        .select("id, team_code")
        .eq("hackathon_id", hackathon.id)
        .is("deleted_at", null),
    ]);

  // Registrations carry a team_id once they have been turned into a team.
  const teamCodeById = new Map(
    ((teamRows as { id: string; team_code: string }[]) ?? []).map((t) => [
      t.id,
      t.team_code,
    ]),
  );

  const origin = await getSiteOrigin();
  const formUrl = `${origin}/register/${hackathon.id}`;

  const submitted = registrations.filter((r) => r.status === "submitted");
  const drafts = registrations.filter((r) => r.status === "draft");
  const withTeams = registrations.filter(
    (r) => r.team_id && teamCodeById.has(r.team_id),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description="Share the public form, then track drafts and submissions as they arrive."
        action={<HackathonSelect hackathons={list} selected={selected} />}
      />

      <Toast tone="success" message={msg} />
      <Toast tone="error" message={err} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={registrations.length} />
        <StatCard label="Submitted" value={submitted.length} />
        <StatCard label="Drafts in progress" value={drafts.length} />
        <StatCard label="Teams created" value={withTeams} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registration form link</CardTitle>
        </CardHeader>
        <CardContent>
          <RegistrationLink
            url={formUrl}
            open={hackathon.registration_open}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {registrations.length} registration
            {registrations.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <EmptyState
              title="No registrations yet"
              description="Share the link above — entries appear here as soon as participants start filling the form."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>SAP ID</TH>
                  <TH>Contact</TH>
                  <TH>Problem statement</TH>
                  <TH>Team</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {registrations.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.full_name || "—"}</TD>
                    <TD className="font-mono text-xs text-muted">
                      {r.sap_id || "—"}
                    </TD>
                    <TD className="text-muted">
                      <span className="block text-xs">
                        {r.college_email || "—"}
                      </span>
                      <span className="block text-xs">{r.mobile || "—"}</span>
                    </TD>
                    <TD className="max-w-[18rem] text-muted">
                      <span className="block font-mono text-xs text-violet-bright">
                        {r.problem_statement_code || "—"}
                      </span>
                      <span className="block truncate text-xs">
                        {r.problem_statement || "—"}
                      </span>
                      {r.domain && (
                        <span className="block truncate text-xs text-subtle">
                          {r.domain}
                        </span>
                      )}
                    </TD>
                    <TD>
                      {r.team_id && teamCodeById.get(r.team_id) ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge tone="violet">
                            {teamCodeById.get(r.team_id)}
                          </Badge>
                          <span className="text-xs text-subtle">
                            {r.team_name || "—"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs text-muted">
                            {r.team_name || "—"}
                          </span>
                          {r.status === "submitted" ? (
                            <form action={createTeamForRegistration}>
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                type="hidden"
                                name="hackathon_id"
                                value={hackathon.id}
                              />
                              <Button variant="ghost" size="sm" type="submit">
                                Create team
                              </Button>
                            </form>
                          ) : (
                            <span className="text-xs text-subtle">draft</span>
                          )}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={r.status} />
                        {r.status === "draft" ? (
                          <DraftCountdown expiresAt={r.draft_expires_at} />
                        ) : (
                          <span className="text-xs text-subtle">
                            {r.auto_submitted ? "auto · " : ""}
                            {r.submitted_at
                              ? formatDateTime(r.submitted_at)
                              : ""}
                          </span>
                        )}
                      </div>
                    </TD>
                    <TD className="text-right">
                      <form action={deleteRegistration}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmRemoveButton
                          message={`Remove the registration for ${
                            r.full_name || r.sap_id || "this participant"
                          }? This cannot be undone.`}
                        />
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Form settings &amp; resources</CardTitle>
          </CardHeader>
          <CardContent>
            <RegistrationSettingsForm
              hackathonId={hackathon.id}
              values={hackathon}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Problem statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {problemStatements.length === 0 ? (
              <p className="text-sm text-muted">
                No predefined statements yet. Participants will type their own ID
                and statement until you add some here.
              </p>
            ) : (
              <ul className="space-y-2">
                {problemStatements.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-raised/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone="violet">{p.ps_code}</Badge>
                        <span className="truncate text-sm font-medium text-foreground">
                          {p.title}
                        </span>
                      </div>
                      {p.description && (
                        <p className="mt-1 text-xs text-muted">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <form action={deleteProblemStatement}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmRemoveButton
                        message={`Remove ${p.ps_code} from the list? Registrations already submitted keep their statement.`}
                      />
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-border pt-4">
              <AddProblemStatementForm hackathonId={hackathon.id} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

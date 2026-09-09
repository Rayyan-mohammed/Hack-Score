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
import { deleteProblemStatement, deleteRegistration } from "./actions";

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
  searchParams: Promise<{ h?: string }>;
}) {
  const { h } = await searchParams;
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

  const [registrations, problemStatements] = await Promise.all([
    listRegistrations(hackathon.id),
    listProblemStatements(hackathon.id),
  ]);

  const origin = await getSiteOrigin();
  const formUrl = `${origin}/register/${hackathon.id}`;

  const submitted = registrations.filter((r) => r.status === "submitted");
  const drafts = registrations.filter((r) => r.status === "draft");
  const auto = submitted.filter((r) => r.auto_submitted);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description="Share the public form, then track drafts and submissions as they arrive."
        action={<HackathonSelect hackathons={list} selected={selected} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={registrations.length} />
        <StatCard label="Submitted" value={submitted.length} />
        <StatCard label="Drafts in progress" value={drafts.length} />
        <StatCard label="Auto-submitted" value={auto.length} />
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
                              ? new Date(r.submitted_at).toLocaleString()
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

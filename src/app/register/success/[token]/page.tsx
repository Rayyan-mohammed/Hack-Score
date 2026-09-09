import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { missingFields } from "@/lib/registration-form";
import {
  getRegistrationByToken,
  getRegistrationHackathon,
  getRegistrationTeam,
  teamSizeBounds,
  toValues,
} from "@/lib/registrations";

export const metadata: Metadata = {
  title: "Submission successful — HackScore",
};

// The receipt is only ever correct at request time (a draft may have just been
// auto-submitted), so never serve it from the route cache.
export const dynamic = "force-dynamic";

function ResourceLink({
  href,
  label,
  hint,
  icon,
  download,
}: {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...(download ? { download: "" } : {})}
      className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 transition-all duration-200 hover:border-violet/60 hover:shadow-glow-soft"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-accent-soft text-violet-bright">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0 text-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 3h7v7M13 3 4 12" />
      </svg>
    </a>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="max-w-full text-right font-medium break-words text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}

export default async function RegistrationSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const registration = await getRegistrationByToken(token);
  if (!registration) notFound();

  // Still editable — nothing to confirm yet.
  if (registration.status === "draft")
    redirect(`/register/${registration.hackathon_id}?draft=${token}`);

  const hackathon = await getRegistrationHackathon(registration.hackathon_id);
  const team = await getRegistrationTeam(registration.team_id);
  const values = toValues(registration);
  const gaps = missingFields(
    values,
    hackathon ? teamSizeBounds(hackathon) : undefined,
  );

  const resources = [
    hackathon?.whatsapp_group_url && {
      href: hackathon.whatsapp_group_url,
      label: "Join WhatsApp Group",
      hint: "Announcements and support during the event",
      icon: (
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 9.5a7 7 0 0 1-10.3 6.2L3 17l1.4-3.6A7 7 0 1 1 17 9.5Z" />
          <path d="M7.5 8c.3 1.6 1.9 3.2 3.5 3.5l.8-1 1.7.8" />
        </svg>
      ),
    },
    hackathon?.ppt_template_url && {
      href: hackathon.ppt_template_url,
      label: "Download PPT Template",
      hint: "Use this deck for your submission",
      download: true,
      icon: (
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 3v9m0 0 3-3m-3 3-3-3M4 15v2h12v-2" />
        </svg>
      ),
    },
    hackathon?.resources_url && {
      href: hackathon.resources_url,
      label: "View Important Resources",
      hint: "Rules, timeline and judging criteria",
      icon: (
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4.5h5a2 2 0 0 1 2 2V16a2 2 0 0 0-2-2H4Z" />
          <path d="M16 4.5h-5a2 2 0 0 0-2 2V16a2 2 0 0 1 2-2h5Z" />
        </svg>
      ),
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    hint: string;
    icon: React.ReactNode;
    download?: boolean;
  }[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>

      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-success/40 bg-success/10 text-2xl">
          🎉
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Submission Successful!
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your submission has been successfully recorded
          {hackathon ? ` for ${hackathon.name}` : ""}.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="success">Submitted</Badge>
          {team && <Badge tone="violet">Team {team.team_code}</Badge>}
          {registration.auto_submitted && (
            <Badge tone="warning">Auto-submitted</Badge>
          )}
          {registration.submitted_at && (
            <span className="text-xs text-subtle">
              {new Date(registration.submitted_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {registration.auto_submitted && (
          <Toast
            tone="info"
            message="Your one-hour editing window closed, so this form was submitted automatically. It can no longer be edited."
          />
        )}
        {team ? (
          <Toast
            tone="success"
            message={`Your team has been added to the event as ${team.team_code} — ${team.name}.`}
          />
        ) : (
          <Toast
            tone="info"
            message="Your registration is recorded, but a team could not be created from it automatically (usually an incomplete team list). The organisers will add your team manually."
          />
        )}
        {gaps.length > 0 && (
          <Toast
            tone="error"
            message={`Recorded with missing details: ${gaps.join(", ")}. Contact the organisers if you need this corrected.`}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>What you submitted</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <Row label="Team name" value={values.team_name} />
            <Row
              label="Team members"
              value={
                values.members
                  ? [values.full_name, values.members]
                      .filter(Boolean)
                      .join("; ")
                  : values.full_name
              }
            />
            <Row label="Name (team leader)" value={values.full_name} />
            <Row label="SAP ID" value={values.sap_id} />
            <Row label="Mobile number" value={values.mobile} />
            <Row label="College email ID" value={values.college_email} />
            <Row
              label="Problem statement ID"
              value={values.problem_statement_code}
            />
            <Row label="Problem statement" value={values.problem_statement} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {resources.length > 0 ? (
              <>
                <p className="text-sm text-muted">
                  You can access the following resources below:
                </p>
                {resources.map((r) => (
                  <ResourceLink key={r.href} {...r} />
                ))}
              </>
            ) : (
              <p className="text-sm text-muted">
                The organisers haven&apos;t shared the group link, PPT template
                or resource pack yet. Bookmark this page — they appear here as
                soon as they&apos;re added.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-subtle">
          Keep this page bookmarked — it&apos;s your submission receipt.
        </p>
      </div>
    </main>
  );
}

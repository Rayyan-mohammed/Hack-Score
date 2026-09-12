import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DRAFT_WINDOW_MINUTES } from "@/lib/registration-form";
import {
  getRegistrationByToken,
  getRegistrationHackathon,
  listProblemStatements,
  listSponsors,
  teamSizeBounds,
  toValues,
} from "@/lib/registrations";
import { SponsorStrip } from "@/components/sponsor-strip";
import { RegistrationForm } from "../registration-form";

export const metadata: Metadata = {
  title: "Registration — HackScore",
  description: "Register your hackathon participation.",
};

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ hackathonId: string }>;
  searchParams: Promise<{ draft?: string; new?: string }>;
}) {
  const { hackathonId } = await params;
  const { draft, new: startFresh } = await searchParams;

  const hackathon = await getRegistrationHackathon(hackathonId);
  if (!hackathon) notFound();

  // The draft link wins; otherwise fall back to the cookie this device was
  // given when its draft was created, so a plain reload resumes the same form.
  const jar = await cookies();
  const fromCookie = !draft;
  const cookieToken = startFresh ? null : jar.get(`hs_reg_${hackathonId}`)?.value;
  const token = draft || cookieToken || null;
  const existing = token ? await getRegistrationByToken(token) : null;
  const found = existing?.hackathon_id === hackathonId ? existing : null;

  // A finished registration is only shown to whoever holds its link. On a
  // shared machine the leftover cookie must not hand the next person someone
  // else's receipt — they get a blank form, and their first save replaces it.
  if (found?.status === "submitted" && !fromCookie)
    redirect(`/register/success/${found.token}`);

  const mine = found?.status === "draft" ? found : null;

  const [problemStatements, sponsors] = await Promise.all([
    listProblemStatements(hackathonId),
    listSponsors(hackathonId),
  ]);
  const bounds = teamSizeBounds(hackathon);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>

      {/* Who the event is run with — shown before the form so participants
          see the collaborators up front. */}
      {sponsors.length > 0 && (
        <div className="mb-6">
          <SponsorStrip sponsors={sponsors} />
        </div>
      )}

      <div className="mb-6 text-center">
        <p className="text-sm text-muted">{hackathon.name}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Registration form
        </h1>
        {hackathon.description && (
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            {hackathon.description}
          </p>
        )}
      </div>

      {!hackathon.registration_open ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              Registrations are closed
            </p>
            <p className="mt-2 text-sm text-muted">
              {hackathon.name} is no longer accepting registrations. Please
              contact the organisers if you think this is a mistake.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            <Badge tone="violet">Step 1 of 2 · Your details</Badge>
            <Badge tone="neutral">Step 2 · Resources</Badge>
          </div>

          <p className="text-center text-sm text-muted">
            Your answers are saved as a draft as you type. You have{" "}
            {DRAFT_WINDOW_MINUTES} minutes to finish — after that the form is
            submitted automatically and can no longer be edited. Teams must have{" "}
            {bounds.min === bounds.max
              ? `exactly ${bounds.min}`
              : `${bounds.min}–${bounds.max}`}{" "}
            members, including you.
          </p>

          {/* Resumed from this device's cookie rather than a personal link —
              say whose draft it is, so a shared machine doesn't quietly hand
              one person another person's form. */}
          {mine && fromCookie && (
            <p className="rounded-xl border border-cyan/40 bg-cyan/10 px-4 py-3 text-center text-sm text-foreground">
              Resuming the draft saved on this device
              {mine.full_name ? ` for ${mine.full_name}` : ""}.{" "}
              <Link
                href={`/register/${hackathonId}?new=1`}
                className="font-medium text-cyan-bright underline underline-offset-2"
              >
                Not you? Start a new form
              </Link>
            </p>
          )}

          <RegistrationForm
            hackathonId={hackathonId}
            problemStatements={problemStatements}
            minSize={bounds.min}
            maxSize={bounds.max}
            initialValues={mine ? toValues(mine) : undefined}
            initialToken={mine?.token ?? null}
            initialExpiresAt={mine?.draft_expires_at ?? null}
          />
        </div>
      )}
    </main>
  );
}

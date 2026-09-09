import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { getOpenHackathon } from "@/lib/registrations";

// Convenience entry point: /register sends participants to whichever event is
// currently open, so organisers can share one short link.
//
// Never prerendered: which event is open changes during the season, and a
// build-time snapshot would keep redirecting to last month's hackathon.
export const dynamic = "force-dynamic";

export default async function RegisterIndexPage() {
  const hackathon = await getOpenHackathon();
  if (hackathon) redirect(`/register/${hackathon.id}`);

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8 flex justify-center">
        <Brand size="lg" />
      </div>
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            No open registrations
          </p>
          <p className="mt-2 text-sm text-muted">
            There is no event accepting registrations right now. If you were
            given a registration link, please open that link directly.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

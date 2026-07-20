import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { HackathonForm } from "../hackathon-form";
import { createHackathon } from "../actions";

export default function NewHackathonPage() {
  return (
    <div>
      <PageHeader title="New hackathon" description="Set up a new event." />
      <Card>
        <CardContent>
          <HackathonForm action={createHackathon} submitLabel="Create" />
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
            Sponsors, rounds and teams are set up on the next screen — creating
            the event takes you straight there. Sponsors can be added or changed
            at any time, including mid-event.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

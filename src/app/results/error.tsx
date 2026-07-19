"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Segment-level safety net: if anything in a results/certificate page throws
// unexpectedly, show a friendly message instead of the raw platform 500.
export default function ResultsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <p className="font-display text-lg font-semibold text-foreground">
            Results are temporarily unavailable
          </p>
          <p className="text-sm text-muted">
            Something went wrong loading this page. Please try again shortly.
          </p>
          <Button onClick={() => reset()}>Try again</Button>
        </CardContent>
      </Card>
    </main>
  );
}

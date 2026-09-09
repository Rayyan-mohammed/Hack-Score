"use client";

import { Button } from "@/components/ui/button";

/**
 * Browser print. Used by the participant certificate, which is a single
 * styled page meant to be printed as-is.
 *
 * The admin evaluation report does NOT use this: it builds a real PDF
 * document (see admin/leaderboard/report/report-pdf.ts).
 */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button size="sm" onClick={() => window.print()}>
      {label}
    </Button>
  );
}

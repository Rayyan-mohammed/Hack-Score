"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  certificateFileName,
  drawCertificate,
  prepareTemplate,
  type PreparedTemplate,
} from "@/lib/certificate-canvas";

/** On-screen previews are drawn at a quarter of the print size. */
const PREVIEW_SCALE = 0.25;
/** PDF pages at A4 width and 300 dpi — print-sharp, a sensible file size. */
const PDF_SCALE = 3508 / CERTIFICATE_WIDTH;

type Person = { name: string; role: string };

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function renderToCanvas(
  prepared: PreparedTemplate,
  person: Person,
  team: string,
  scale: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(CERTIFICATE_WIDTH * scale);
  canvas.height = Math.round(CERTIFICATE_HEIGHT * scale);
  drawCertificate(canvas.getContext("2d")!, prepared, { name: person.name, team }, scale);
  return canvas;
}

function Preview({
  prepared,
  person,
  team,
}: {
  prepared: PreparedTemplate;
  person: Person;
  team: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    drawCertificate(canvas.getContext("2d")!, prepared, { name: person.name, team }, PREVIEW_SCALE);
  }, [prepared, person.name, team]);

  return (
    <canvas
      ref={ref}
      width={Math.round(CERTIFICATE_WIDTH * PREVIEW_SCALE)}
      height={Math.round(CERTIFICATE_HEIGHT * PREVIEW_SCALE)}
      className="block h-auto w-full rounded-lg shadow-card"
      aria-label={`Certificate of participation for ${person.name}`}
    />
  );
}

/**
 * The team's certificates, one per person, drawn from the event's template
 * with the names as they are in the database right now — so a name corrected
 * after the results email went out is still correct here.
 */
export function TeamCertificates({
  teamName,
  people,
}: {
  teamName: string;
  people: Person[];
}) {
  const [prepared, setPrepared] = useState<PreparedTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    prepareTemplate()
      .then((p) => !cancelled && setPrepared(p))
      .catch((e) =>
        !cancelled &&
        setError(e instanceof Error ? e.message : "Could not load the certificates."),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadOne = async (person: Person, index: number) => {
    if (!prepared) return;
    setBusy(person.name);
    try {
      const canvas = renderToCanvas(prepared, person, teamName, 1);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (blob) saveBlob(blob, `${certificateFileName(index + 1, person.name)}.png`);
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    if (!prepared) return;
    setBusy("all");
    try {
      const { jsPDF } = await import("jspdf");
      const pageW = 297; // A4 landscape, mm
      const pageH = (pageW * CERTIFICATE_HEIGHT) / CERTIFICATE_WIDTH;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageW, pageH] });
      people.forEach((person, i) => {
        const canvas = renderToCanvas(prepared, person, teamName, PDF_SCALE);
        if (i > 0) doc.addPage([pageW, pageH], "landscape");
        doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);
      });
      doc.save(`${teamName.replace(/[^\w.-]+/g, "_")}_certificates.pdf`);
    } finally {
      setBusy(null);
    }
  };

  if (error)
    return (
      <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error} Please refresh the page to try again.
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {people.length} certificate{people.length === 1 ? "" : "s"} for Team{" "}
          <span className="font-medium text-foreground">{teamName}</span>
        </p>
        <Button onClick={() => void downloadAll()} disabled={!prepared || busy !== null}>
          {busy === "all" ? "Preparing PDF…" : "Download all (PDF)"}
        </Button>
      </div>

      {!prepared ? (
        <div className="space-y-4" role="status" aria-live="polite">
          <span className="sr-only">Preparing certificates…</span>
          {people.map((p) => (
            <div
              key={p.name}
              className="aspect-[5463/3875] w-full animate-shimmer rounded-lg bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--color-surface)_25%,var(--color-surface-raised)_50%,var(--color-surface)_75%)]"
            />
          ))}
        </div>
      ) : (
        <ol className="space-y-8">
          {people.map((person, i) => (
            <li key={`${i}-${person.name}`} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium text-foreground">{person.name}</span>
                  <span className="text-subtle"> · {person.role}</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void downloadOne(person, i)}
                  disabled={busy !== null}
                >
                  {busy === person.name ? "Preparing…" : "Download PNG"}
                </Button>
              </div>
              <Preview prepared={prepared} person={person} team={teamName} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

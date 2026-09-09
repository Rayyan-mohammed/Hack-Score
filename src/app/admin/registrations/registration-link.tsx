"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * The shareable public registration link, with a copy button. Shown on the
 * Teams page (next to CSV import) and on the Registrations page.
 */
export function RegistrationLink({
  url,
  open,
  manageHref,
}: {
  url: string;
  open: boolean;
  /** Link to the Registrations page, when shown outside it. */
  manageHref?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure origin / permission) — the field is
      // selectable, so copying by hand still works.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge tone={open ? "success" : "neutral"}>
          {open ? "Open" : "Closed"}
        </Badge>
        <p className="text-sm text-muted">
          {open
            ? "Participants can fill this form now."
            : "The form is closed — visitors see a notice instead."}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={url}
          aria-label="Public registration link"
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="md" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="ghost" size="md">
              Open
            </Button>
          </a>
        </div>
      </div>

      <p className="text-xs text-muted">
        Participants fill in name, SAP ID, mobile, college email and their
        problem statement. Their answers save as a draft and submit
        automatically one hour later.
      </p>

      {manageHref && (
        <Link
          href={manageHref}
          className="inline-block text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
        >
          Manage registrations, problem statements &amp; resources →
        </Link>
      )}
    </div>
  );
}

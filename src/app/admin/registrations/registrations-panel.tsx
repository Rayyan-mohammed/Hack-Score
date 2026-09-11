"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { formatCountdown } from "@/lib/registration-form";
import {
  addProblemStatement,
  updateRegistrationSettings,
  type FormState,
} from "./actions";

export function HackathonSelect({
  hackathons,
  selected,
}: {
  hackathons: { id: string; name: string }[];
  selected?: string;
}) {
  const router = useRouter();
  return (
    <Select
      aria-label="Select hackathon"
      value={selected ?? ""}
      onChange={(e) => router.push(`/admin/registrations?h=${e.target.value}`)}
      className="max-w-[16rem]"
    >
      <option value="" disabled>
        Select a hackathon…
      </option>
      {hackathons.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
    </Select>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Registration switch + the links participants get on the confirmation page. */
export function RegistrationSettingsForm({
  hackathonId,
  values,
}: {
  hackathonId: string;
  values: {
    registration_open: boolean;
    whatsapp_group_url: string | null;
    ppt_template_url: string | null;
    resources_url: string | null;
  };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateRegistrationSettings,
    {},
  );
  const [open, setOpen] = useState(values.registration_open);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hackathon_id" value={hackathonId} />

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-raised/50 px-4 py-3">
        <input
          type="checkbox"
          name="registration_open"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-violet"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Registrations open
          </span>
          <span className="block text-xs text-muted">
            Uncheck to close the form. Drafts already in progress still
            auto-submit when their hour is up.
          </span>
        </span>
      </label>

      <div>
        <Label htmlFor="whatsapp_group_url">WhatsApp group link</Label>
        <Input
          id="whatsapp_group_url"
          name="whatsapp_group_url"
          type="url"
          placeholder="https://chat.whatsapp.com/…"
          defaultValue={values.whatsapp_group_url ?? ""}
        />
      </div>
      <div className="rounded-xl border border-border bg-surface-raised/50 p-4">
        <Label htmlFor="ppt_template_url">PPT template</Label>
        <p className="mb-3 text-xs text-subtle">
          Upload the deck, or paste a link to it. Either way it appears on every
          participant&apos;s confirmation page immediately, including the ones
          already submitted.
        </p>

        <FileDropzone
          name="ppt_template_file"
          accept=".ppt,.pptx,.pdf"
          extensions={[".ppt", ".pptx", ".pdf"]}
          maxSizeMB={4}
          title="Drag & drop the PPT template here"
          hint="PPT, PPTX or PDF, up to 4MB"
          readyLabel="Ready to upload"
        />

        <p className="mt-3 mb-1.5 text-xs text-subtle">
          Or paste a link (Drive, OneDrive…) — needed for decks over 4MB.
          Uploading a file replaces whatever is in this box.
        </p>
        <Input
          id="ppt_template_url"
          name="ppt_template_url"
          type="url"
          placeholder="https://…/template.pptx"
          defaultValue={values.ppt_template_url ?? ""}
        />
        {values.ppt_template_url && (
          <p className="mt-2 text-xs text-muted">
            Participants currently get{" "}
            <a
              href={values.ppt_template_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-violet-bright underline underline-offset-2 hover:text-cyan-bright"
            >
              this template
            </a>
            . Clear the box and save to take it down.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="resources_url">Important resources link</Label>
        <Input
          id="resources_url"
          name="resources_url"
          type="url"
          placeholder="https://…/resources"
          defaultValue={values.resources_url ?? ""}
        />
      </div>

      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
      <SubmitButton label="Save settings" />
    </form>
  );
}

/** Add one entry to the problem-statement list the public form offers. */
export function AddProblemStatementForm({
  hackathonId,
}: {
  hackathonId: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    addProblemStatement,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="hackathon_id" value={hackathonId} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <Label htmlFor="ps_code">Problem statement ID</Label>
          <Input id="ps_code" name="ps_code" placeholder="PS-001" required />
        </div>
        <div>
          <Label htmlFor="title">Problem statement</Label>
          <Input
            id="title"
            name="title"
            placeholder="AI-Based Healthcare Assistant"
            minLength={3}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Details (optional)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Extra context shown under the statement on the form."
        />
      </div>
      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
      <SubmitButton label="Add problem statement" />
    </form>
  );
}

/**
 * Live time-left for a draft. Once it hits zero the row is auto-submitted on
 * the next read, so the page is refreshed to pick that up.
 */
export function DraftCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const deadline = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(deadline - Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    if (remaining > 0) return;
    const id = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(id);
  }, [remaining, router]);

  if (remaining <= 0)
    return <span className="text-xs text-muted">submitting…</span>;

  return (
    <span
      className={`font-mono text-xs tabular-nums ${
        remaining < 5 * 60 * 1000 ? "text-warning" : "text-muted"
      }`}
    >
      {formatCountdown(remaining)} left
    </span>
  );
}

/**
 * Row-level destructive action. Registrations and problem statements are
 * removed outright (no Trash), so the click is confirmed first.
 */
export function ConfirmRemoveButton({
  message,
  label = "Remove",
}: {
  message: string;
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className="hover:bg-danger/10 hover:text-danger"
    >
      {pending ? "Removing…" : label}
    </Button>
  );
}

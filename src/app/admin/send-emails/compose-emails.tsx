"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/states";
import { customEmailHtml, fillVars } from "@/lib/email-templates";
import { sendCustomEmails, type SendState } from "./actions";

export type Leader = {
  email: string;
  leaderName: string;
  teamName: string;
  college: string | null;
};

const VARS = ["{{TEAM_LEADER_NAME}}", "{{TEAM_NAME}}", "{{HACKATHON_NAME}}"];

function SendButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || count === 0}
      onClick={(e) => {
        if (!confirm(`Send this email to ${count} team leader${count === 1 ? "" : "s"}?`))
          e.preventDefault();
      }}
    >
      {pending ? "Sending…" : `Send to ${count}`}
    </Button>
  );
}

export function ComposeEmails({
  hackathonId,
  hackathonName,
  leaders,
}: {
  hackathonId: string;
  hackathonName: string;
  leaders: Leader[];
}) {
  const [state, formAction] = useActionState<SendState, FormData>(
    sendCustomEmails,
    {},
  );

  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(leaders.map((l) => l.email)),
  );
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [showPreview, setShowPreview] = React.useState(false);

  const allSelected = selected.size === leaders.length && leaders.length > 0;
  const selectedLeaders = leaders.filter((l) => selected.has(l.email));

  const toggle = (email: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(leaders.map((l) => l.email)));

  // Live preview for the first selected leader (or a sample).
  const sample = selectedLeaders[0] ?? leaders[0];
  const previewVars = {
    leaderName: sample?.leaderName || "Team leader",
    teamName: sample?.teamName || "Team",
    hackathonName,
  };
  const previewHtml = customEmailHtml(
    fillVars(subject || "(no subject)", previewVars),
    fillVars(body || "(empty body)", previewVars),
  );

  if (leaders.length === 0) {
    return (
      <EmptyState
        title="No team leaders with an email"
        description="Add teams with a team leader email to this hackathon first, then you can email them here."
      />
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="hackathon_id" value={hackathonId} />
      {selectedLeaders.map((l) => (
        <input key={l.email} type="hidden" name="recipients" value={l.email} />
      ))}

      {/* Recipients */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="mb-0">Select team leaders</Label>
          <span className="text-sm text-muted">
            {selected.size} of {leaders.length} selected
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <label className="flex cursor-pointer items-center gap-3 border-b border-border bg-surface-raised/50 px-4 py-2.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-violet"
            />
            <span className="font-medium">All team leaders in this hackathon</span>
          </label>
          <div className="max-h-56 overflow-y-auto">
            {leaders.map((l) => (
              <label
                key={l.email}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-raised/60"
              >
                <input
                  type="checkbox"
                  checked={selected.has(l.email)}
                  onChange={() => toggle(l.email)}
                  className="h-4 w-4 accent-violet"
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{l.leaderName}</span>{" "}
                  <span className="text-muted">({l.email})</span>
                </span>
                <span className="shrink-0 text-xs text-subtle">{l.teamName}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Selected cards */}
      {selectedLeaders.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {selectedLeaders.map((l) => (
            <div
              key={l.email}
              className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2.5"
            >
              <span className="mt-0.5 text-success">✓</span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{l.leaderName}</p>
                <p className="truncate text-xs text-muted">📧 {l.email}</p>
                <p className="truncate text-xs text-muted">🏫 {l.teamName}</p>
                {l.college && (
                  <p className="truncate text-xs text-muted">🎓 {l.college}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggle(l.email)}
                aria-label={`Remove ${l.leaderName}`}
                className="shrink-0 rounded-lg px-2 py-0.5 text-xs text-muted hover:text-danger"
              >
                ✕ Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composition */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            minLength={5}
            placeholder="Update for {{TEAM_NAME}}"
            required
          />
        </div>
        <div>
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            minLength={10}
            className="min-h-40"
            placeholder="Hi {{TEAM_LEADER_NAME}}, …"
            required
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Insert variables:</span>
          {VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBody((b) => `${b}${v}`)}
              className="rounded-md border border-border-strong bg-surface-raised px-2 py-0.5 font-mono text-violet-bright hover:border-violet/60"
            >
              {v}
            </button>
          ))}
          <span>— replaced per recipient.</span>
        </div>
      </div>

      {/* Preview + send */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowPreview((p) => !p)}
        >
          {showPreview ? "Hide preview" : "Preview"}
        </Button>
        <SendButton count={selected.size} />
      </div>

      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />

      {showPreview && (
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs text-muted">
            Preview for <Badge tone="violet">{previewVars.teamName}</Badge> — each
            recipient gets their own values.
          </p>
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            className="h-[520px] w-full rounded-lg border border-border bg-white"
          />
        </div>
      )}
    </form>
  );
}

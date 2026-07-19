"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toast } from "@/components/ui/toast";
import {
  publishResultsAndEmail,
  setResultsPublished,
  type PublishState,
} from "./actions";

function PublishButton({ leaderCount }: { leaderCount: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={(e) => {
        const msg =
          leaderCount > 0
            ? `Publish results and email ${leaderCount} team leader${
                leaderCount === 1 ? "" : "s"
              } their private result & certificate links?`
            : "Publish results? No team leaders have an email on file, so no emails will be sent.";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      {pending ? "Publishing & emailing…" : "Publish results"}
    </Button>
  );
}

export function PublishControl({
  hackathonId,
  published,
  leaderCount,
}: {
  hackathonId: string;
  published: boolean;
  leaderCount: number;
}) {
  const [state, formAction] = useActionState<PublishState, FormData>(
    publishResultsAndEmail,
    {},
  );

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">Results</p>
            {published ? (
              <Badge tone="success">Published</Badge>
            ) : (
              <Badge tone="neutral">Not published</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {published
              ? "Teams can view their results via their private links."
              : `Publishing emails ${leaderCount} team leader${
                  leaderCount === 1 ? "" : "s"
                } their private result & certificate links.`}
          </p>
        </div>

        {published ? (
          <form action={setResultsPublished}>
            <input type="hidden" name="hackathon_id" value={hackathonId} />
            <input type="hidden" name="publish" value="false" />
            <Button size="sm" variant="outline">
              Unpublish
            </Button>
          </form>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="hackathon_id" value={hackathonId} />
            <PublishButton leaderCount={leaderCount} />
          </form>
        )}
      </div>

      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
    </div>
  );
}

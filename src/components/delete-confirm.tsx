"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ConfirmButton({ enabled, label }: { enabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={!enabled || pending}>
      {pending ? "Deleting…" : label}
    </Button>
  );
}

/**
 * Danger-zone delete gated by a typed confirmation. The button stays disabled
 * until the user types the exact `confirmText` (e.g. the hackathon or round
 * name), preventing accidental cascade deletes during a live event.
 */
export function DeleteConfirm({
  action,
  fields,
  confirmText,
  label,
  description,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  confirmText: string;
  label: string;
  description: string;
}) {
  const [value, setValue] = React.useState("");
  const enabled = value.trim() === confirmText;

  return (
    <form action={action} className="space-y-3">
      {Object.entries(fields).map(([name, val]) => (
        <input key={name} type="hidden" name={name} value={val} />
      ))}
      <p className="text-sm text-muted">{description}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Type ${confirmText} to confirm deletion`}
          placeholder={`Type "${confirmText}" to confirm`}
          className="sm:max-w-xs"
        />
        <ConfirmButton enabled={enabled} label={label} />
      </div>
    </form>
  );
}

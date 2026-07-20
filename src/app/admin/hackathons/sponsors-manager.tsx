"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import {
  createSponsor,
  updateSponsor,
  deleteSponsor,
  type SponsorState,
} from "./sponsor-actions";

export type Sponsor = {
  id: string;
  name: string;
  logo_url: string;
  label: string;
  sort_order: number;
};

const LABEL_PRESETS = [
  "Title sponsor",
  "Powered by",
  "Co-powered by",
  "Sponsored by",
  "Associate sponsor",
  "Beverage partner",
  "Media partner",
];

function SubmitButton({ label, size = "sm" }: { label: string; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Logo on a white chip so dark logos stay visible on the dark theme. */
export function LogoChip({
  src,
  alt,
  className = "h-10",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-white px-2 py-1.5 ring-1 ring-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`${className} w-auto object-contain`} />
    </span>
  );
}

/** Shared name / label / order / logo fields for the add and edit forms. */
function SponsorFields({
  initial,
  logoRequired,
}: {
  initial?: Partial<Sponsor>;
  logoRequired: boolean;
}) {
  const presetMatch =
    initial?.label && LABEL_PRESETS.includes(initial.label)
      ? initial.label
      : initial?.label
        ? "__custom__"
        : "Powered by";
  const [preset, setPreset] = React.useState(presetMatch);
  const [preview, setPreview] = React.useState<string | null>(
    initial?.logo_url ?? null,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="name">Sponsor name</Label>
        <Input
          id="name"
          name="name"
          placeholder="TCS"
          defaultValue={initial?.name ?? ""}
          required
        />
      </div>

      <div>
        <Label htmlFor="sort_order">Order</Label>
        <Input
          id="sort_order"
          name="sort_order"
          type="number"
          min={1}
          step={1}
          defaultValue={initial?.sort_order ?? 1}
          required
        />
        <p className="mt-1 text-xs text-subtle">1 = title sponsor (shown first).</p>
      </div>

      <div>
        <Label htmlFor="label_preset">Label</Label>
        <Select
          id="label_preset"
          name="label_preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
        >
          {LABEL_PRESETS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </Select>
        {preset === "__custom__" && (
          <Input
            name="label_custom"
            placeholder="e.g. Hospitality partner"
            defaultValue={
              initial?.label && !LABEL_PRESETS.includes(initial.label)
                ? initial.label
                : ""
            }
            className="mt-2"
            required
          />
        )}
      </div>

      <div>
        <Label htmlFor="logo">
          {logoRequired ? "Logo" : "Replace logo (optional)"}
        </Label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          required={logoRequired}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
          }}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-sm file:text-foreground hover:file:bg-surface"
        />
        <p className="mt-1 text-xs text-subtle">PNG, JPG, SVG or WebP · max 2 MB.</p>
        {preview && (
          <div className="mt-2">
            <LogoChip src={preview} alt="Logo preview" className="h-10" />
          </div>
        )}
      </div>
    </div>
  );
}

function AddSponsorForm({
  hackathonId,
  nextOrder,
}: {
  hackathonId: string;
  nextOrder: number;
}) {
  const [state, formAction] = useActionState<SponsorState, FormData>(
    createSponsor,
    {},
  );
  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-dashed border-border p-4"
    >
      <input type="hidden" name="hackathon_id" value={hackathonId} />
      <p className="text-sm font-medium">Add a sponsor</p>
      <SponsorFields initial={{ sort_order: nextOrder }} logoRequired />
      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
      <SubmitButton label="Add sponsor" />
    </form>
  );
}

function SponsorRow({
  sponsor,
  hackathonId,
}: {
  sponsor: Sponsor;
  hackathonId: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [state, formAction] = useActionState<SponsorState, FormData>(
    updateSponsor,
    {},
  );

  return (
    <li className="rounded-xl border border-border bg-surface-raised/50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <LogoChip src={sponsor.logo_url} alt={sponsor.name} className="h-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{sponsor.name}</p>
          <p className="truncate text-xs text-muted">{sponsor.label}</p>
        </div>
        <Badge tone={sponsor.sort_order === 1 ? "violet" : "neutral"}>
          #{sponsor.sort_order}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Cancel" : "Edit"}
        </Button>
        <form action={deleteSponsor}>
          <input type="hidden" name="id" value={sponsor.id} />
          <input type="hidden" name="hackathon_id" value={hackathonId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="hover:bg-danger/10 hover:text-danger"
          >
            Remove
          </Button>
        </form>
      </div>

      {editing && (
        <form action={formAction} className="mt-3 space-y-3 border-t border-border pt-3">
          <input type="hidden" name="id" value={sponsor.id} />
          <input type="hidden" name="hackathon_id" value={hackathonId} />
          <SponsorFields initial={sponsor} logoRequired={false} />
          <Toast tone="error" message={state.error} />
          <Toast tone="success" message={state.message} />
          <SubmitButton label="Save changes" />
        </form>
      )}
    </li>
  );
}

export function SponsorsManager({
  hackathonId,
  sponsors,
}: {
  hackathonId: string;
  sponsors: Sponsor[];
}) {
  const nextOrder =
    sponsors.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;

  return (
    <div className="space-y-4">
      {sponsors.length > 0 ? (
        <ul className="space-y-2">
          {sponsors.map((s) => (
            <SponsorRow key={s.id} sponsor={s} hackathonId={hackathonId} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No sponsors yet. Add them any time — they appear on the leaderboard
          immediately.
        </p>
      )}

      <AddSponsorForm hackathonId={hackathonId} nextOrder={nextOrder} />
    </div>
  );
}

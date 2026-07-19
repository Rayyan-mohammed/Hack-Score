"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { createTeam, importTeams, type FormState } from "./actions";

type Hackathon = { id: string; name: string };

export function HackathonSelect({
  hackathons,
  selected,
}: {
  hackathons: Hackathon[];
  selected?: string;
}) {
  const router = useRouter();
  return (
    <Select
      aria-label="Select hackathon"
      value={selected ?? ""}
      onChange={(e) => router.push(`/admin/teams?h=${e.target.value}`)}
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
      {pending ? "Working…" : label}
    </Button>
  );
}

export function AddTeamForm({ hackathonId }: { hackathonId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createTeam,
    {},
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="hackathon_id" value={hackathonId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="team_code">Team code</Label>
          <Input id="team_code" name="team_code" placeholder="T01" required />
        </div>
        <div>
          <Label htmlFor="name">Team name</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="college">College</Label>
          <Input id="college" name="college" />
        </div>
        <div>
          <Label htmlFor="track">Track</Label>
          <Input id="track" name="track" />
        </div>
        <div>
          <Label htmlFor="mentor">Mentor</Label>
          <Input id="mentor" name="mentor" />
        </div>
      </div>
      <div>
        <Label htmlFor="problem_statement">Problem statement</Label>
        <Textarea id="problem_statement" name="problem_statement" />
      </div>
      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
      <SubmitButton label="Add team" />
    </form>
  );
}

export function ImportTeamsForm({ hackathonId }: { hackathonId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    importTeams,
    {},
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="hackathon_id" value={hackathonId} />
      <p className="text-sm text-muted">
        CSV headers: team_code, name, college, track, mentor,
        problem_statement, members (names separated by <code>;</code>).
      </p>
      <a
        href="/team-import-template.csv"
        download
        className="inline-block text-sm font-medium text-violet-bright transition-colors duration-150 hover:text-cyan-bright"
      >
        Download template CSV
      </a>
      <FileDropzone name="file" accept=".csv" maxSizeMB={10} />
      <Toast tone="error" message={state.error} />
      <Toast tone="success" message={state.message} />
      <SubmitButton label="Import CSV" />
    </form>
  );
}

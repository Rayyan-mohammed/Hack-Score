"use client";

import { useRouter } from "next/navigation";

export function HackathonSelect({
  hackathons,
  selected,
}: {
  hackathons: { id: string; name: string }[];
  selected?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selected ?? ""}
      onChange={(e) => router.push(`/admin/leaderboard?h=${e.target.value}`)}
      className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
    >
      <option value="" disabled>
        Select a hackathon…
      </option>
      {hackathons.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
    </select>
  );
}

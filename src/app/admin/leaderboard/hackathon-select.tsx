"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

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
      onChange={(e) => router.push(`/admin/leaderboard?h=${e.target.value}`)}
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

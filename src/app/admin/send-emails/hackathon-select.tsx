"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

function dmy(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export function SendHackathonSelect({
  hackathons,
  selected,
}: {
  hackathons: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
  }[];
  selected?: string;
}) {
  const router = useRouter();
  return (
    <Select
      aria-label="Choose hackathon"
      value={selected ?? ""}
      onChange={(e) => router.push(`/admin/send-emails?h=${e.target.value}`)}
      className="max-w-[22rem]"
    >
      {hackathons.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
          {h.start_date ? ` (${dmy(h.start_date)} to ${dmy(h.end_date)})` : ""}
        </option>
      ))}
    </Select>
  );
}

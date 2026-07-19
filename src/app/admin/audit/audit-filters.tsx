"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export type AuditFilterValues = {
  from?: string;
  to?: string;
  who?: string;
  action?: string;
};

// Local YYYY-MM-DD (not UTC) so quick ranges match the viewer's calendar day.
function localDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function AuditFilters({
  users,
  actions,
  current,
}: {
  users: { id: string; name: string }[];
  actions: string[];
  current: AuditFilterValues;
}) {
  const router = useRouter();

  function push(next: AuditFilterValues) {
    const merged = { ...current, ...next };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    router.push(qs ? `/admin/audit?${qs}` : "/admin/audit");
  }

  const active =
    !!current.from || !!current.to || !!current.who || !!current.action;

  const rangeIs = (from: string, to: string) =>
    current.from === from && current.to === to;

  const quick: { label: string; from: string; to: string }[] = [
    { label: "Today", from: localDay(0), to: localDay(0) },
    { label: "Last 7 days", from: localDay(-6), to: localDay(0) },
    { label: "Last 30 days", from: localDay(-29), to: localDay(0) },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      {/* Quick date ranges */}
      <div className="flex flex-wrap items-center gap-2">
        {quick.map((q) => (
          <Button
            key={q.label}
            type="button"
            size="sm"
            variant={rangeIs(q.from, q.to) ? "secondary" : "outline"}
            onClick={() => push({ from: q.from, to: q.to })}
          >
            {q.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={!current.from && !current.to ? "secondary" : "outline"}
          onClick={() => push({ from: "", to: "" })}
        >
          All time
        </Button>
      </div>

      {/* Precise filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={current.from ?? ""}
            max={current.to || undefined}
            onChange={(e) => push({ from: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={current.to ?? ""}
            min={current.from || undefined}
            onChange={(e) => push({ to: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="who">User</Label>
          <Select
            id="who"
            value={current.who ?? ""}
            onChange={(e) => push({ who: e.target.value })}
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="action">Action</Label>
          <Select
            id="action"
            value={current.action ?? ""}
            onChange={(e) => push({ action: e.target.value })}
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {active && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => router.push("/admin/audit")}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}

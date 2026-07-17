import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    // Horizontal scroll keeps wide score tables usable at 375px without squashing columns.
    <div className="-mx-px overflow-x-auto rounded-2xl border border-border bg-surface">
      <table
        className={cn("w-full min-w-max text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-raised text-left text-xs font-medium tracking-wide text-muted uppercase">
      {children}
    </thead>
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-4 py-3 font-medium whitespace-nowrap", className)}
      {...props}
    />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-raised/60",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 text-foreground", className)}
      {...props}
    />
  );
}

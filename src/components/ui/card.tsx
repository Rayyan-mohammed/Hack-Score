import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-card",
        interactive && "hover-lift",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-0", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-base font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/** KPI tile for dashboard stat rows — big display numeral over a muted label. */
export function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <Card interactive className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-line opacity-60"
      />
      <CardContent>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

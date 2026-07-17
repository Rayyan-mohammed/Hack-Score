"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart, tooltipStyle } from "@/lib/chart-theme";
import { EmptyState } from "@/components/ui/states";

export function TopTeamsChart({
  data,
}: {
  data: { name: string; score: number }[];
}) {
  if (data.length === 0)
    return (
      <EmptyState
        title="No submitted scores yet"
        description="Once judges submit their evaluations, the top teams will appear here."
      />
    );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="barAccent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chart.gradientTo} />
            <stop offset="100%" stopColor={chart.gradientFrom} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={chart.grid}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: chart.axis }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: chart.axis }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: chart.cursor }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: chart.foreground, fontWeight: 600 }}
          itemStyle={{ color: chart.axis }}
        />
        <Bar dataKey="score" fill="url(#barAccent)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

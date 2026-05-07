"use client";

import { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Icon } from "@iconify/react";
import type { GradeBarData } from "../analytics";

interface GradeDistributionChartProps {
  data: GradeBarData[];
}

function GradeDistributionChartComponent({ data }: GradeDistributionChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <Icon icon="solar:chart-linear" className="text-3xl text-slate-300" />
        <p className="text-sm text-slate-400">ยังไม่มีข้อมูลคะแนน</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }} barSize={36}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            fontSize: "12px",
          }}
          formatter={(value) => [`${value} คน`, "จำนวน"] as [string, string]}
          cursor={{ fill: "#f8fafc" }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const GradeDistributionChart = memo(GradeDistributionChartComponent);

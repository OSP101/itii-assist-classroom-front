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
  ReferenceLine,
} from "recharts";
import { Icon } from "@iconify/react";
import type { AssignmentBarData } from "../analytics";

interface AssignmentDifficultyChartProps {
  data: AssignmentBarData[];
}

function AssignmentDifficultyChartComponent({ data }: AssignmentDifficultyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <Icon icon="solar:document-text-linear" className="text-3xl text-slate-300" />
        <p className="text-sm text-slate-400">ยังไม่มีข้อมูลงาน</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
        barSize={16}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            fontSize: "12px",
          }}
          formatter={(value) => [`${value}%`, "คะแนนเฉลี่ย"] as [string, string]}
          cursor={{ fill: "#f8fafc" }}
        />
        <ReferenceLine
          x={50}
          stroke="#94a3b8"
          strokeDasharray="4 2"
          label={{ value: "50%", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }}
        />
        <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const AssignmentDifficultyChart = memo(AssignmentDifficultyChartComponent);

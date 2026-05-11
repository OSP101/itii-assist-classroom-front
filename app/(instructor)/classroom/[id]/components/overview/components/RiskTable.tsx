"use client";

import { memo } from "react";
import { Progress } from "@heroui/progress";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Icon } from "@iconify/react";
import type { RiskStudent, RiskLevel } from "../analytics";

const RISK_CONFIG: Record<RiskLevel, {
  label: string;
  color: "danger" | "warning" | "success";
  dotClass: string;
}> = {
  high: { label: "เสี่ยงสูง", color: "danger", dotClass: "bg-red-500" },
  medium: { label: "ปานกลาง", color: "warning", dotClass: "bg-amber-500" },
  low: { label: "ปกติ", color: "success", dotClass: "bg-emerald-500" },
};

interface RiskTableProps {
  students: RiskStudent[];
  onSelectStudent?: (student: RiskStudent) => void;
}

function RiskTableComponent({ students, onSelectStudent }: RiskTableProps) {
  if (students.length === 0) return null;

  return (
    <div>
      <div className="sm:hidden space-y-1.5">
        {students.map((student, i) => {
          const cfg = RISK_CONFIG[student.riskLevel];
          const pctRaw = student.percentage ?? 0;
          const pct = Math.max(0, Math.min(100, Math.round(pctRaw)));
          return (
            <button
              key={student.id}
              type="button"
              className="w-full text-left border border-slate-100 dark:border-zinc-700/60 bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              onClick={() => onSelectStudent?.(student)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar
                    name={student.full_name}
                    size="sm"
                    className="shrink-0 bg-linear-to-br from-slate-400 to-slate-600 text-white"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{student.full_name}</p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">{student.student_id}</p>
                  </div>
                </div>
                <Chip size="sm" color={cfg.color} variant="flat">{cfg.label}</Chip>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                <span>ขาดส่ง: {student.missedCount} ชิ้น</span>
                <span className="text-right">คะแนน: {pct}%</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Progress
                  value={pct}
                  size="sm"
                  color={pct >= 60 ? "success" : pct >= 40 ? "warning" : "danger"}
                  className="flex-1"
                />
                <span className="text-[11px] text-slate-500 shrink-0">{student.recommendation}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left pb-3 text-[11px] font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide pr-4">นักศึกษา</th>
            <th className="text-left pb-3 text-[11px] font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide pr-4">ระดับความเสี่ยง</th>
            <th className="text-left pb-3 text-[11px] font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide pr-4 hidden sm:table-cell">งานที่ขาด</th>
            <th className="text-left pb-3 text-[11px] font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide pr-4 hidden md:table-cell">คะแนน</th>
            <th className="text-left pb-3 text-[11px] font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wide">คำแนะนำ</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, i) => {
            const cfg = RISK_CONFIG[student.riskLevel];
            const pctRaw = student.percentage ?? 0;
            const pct = Math.max(0, Math.min(100, Math.round(pctRaw)));
            return (
              <tr
                key={student.id}
                className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                onClick={() => onSelectStudent?.(student)}
              >
                {/* Student info */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={student.full_name}
                      size="sm"
                      className="shrink-0 bg-linear-to-br from-slate-400 to-slate-600 text-white"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate max-w-32.5">{student.full_name}</p>
                      <p className="text-xs text-slate-400">{student.student_id}</p>
                    </div>
                  </div>
                </td>

                {/* Risk level */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                    <Chip size="sm" color={cfg.color} variant="flat">
                      {cfg.label}
                    </Chip>
                  </div>
                </td>

                {/* Missing count */}
                <td className="py-3 pr-4 hidden sm:table-cell tabular-nums">
                  <span className={`text-sm font-medium ${student.missedCount > 0 ? "text-red-500" : "text-slate-400"}`}>
                    {student.missedCount} ชิ้น
                  </span>
                </td>

                {/* Score progress */}
                <td className="py-3 pr-4 hidden md:table-cell">
                  <div className="flex items-center gap-2 min-w-25 tabular-nums">
                    <Progress
                      value={pct}
                      size="sm"
                      color={pct >= 60 ? "success" : pct >= 40 ? "warning" : "danger"}
                      className="w-16"
                    />
                    <span className="text-xs text-slate-500 w-10">{pct}%</span>
                  </div>
                </td>

                {/* Recommendation */}
                <td className="py-3">
                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                    {student.recommendation}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {students.length === 0 && (
        <div className="text-center py-10">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Icon icon="solar:check-circle-bold" className="text-2xl text-emerald-500" />
          </div>
          <p className="text-sm text-slate-500">ไม่มีนักศึกษาที่อยู่ในกลุ่มเสี่ยง</p>
        </div>
      )}
    </div>
  );
}

export const RiskTable = memo(RiskTableComponent);

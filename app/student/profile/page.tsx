"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { authService } from "@/services/auth.service";
import { adminSettingsService, type StudentProgram } from "@/services/admin-settings.service";

function getInitials(name: string | undefined | null): string {
  if (!name) return "น";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function StudentProfilePage() {
  const router = useRouter();
  const user = authService.getStoredUser();
  const [copied, setCopied] = useState(false);
  const [programs, setPrograms] = useState<StudentProgram[]>([]);

  const handleLogout = async () => {
    await authService.logout();
    router.replace("/student/login");
  };

  const handleCopyStudentId = async () => {
    const id = user?.username || "";
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const el = document.createElement("textarea");
      el.value = id;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = getInitials(user?.full_name);
  const programValue = typeof user?.extra?.program === "string" ? user.extra.program.trim() : "";

  useEffect(() => {
    let active = true;

    const loadPrograms = async () => {
      try {
        const items = await adminSettingsService.getStudentPrograms();
        if (active) {
          setPrograms(items);
        }
      } catch (error) {
        console.error("Failed to load student programs:", error);
      }
    };

    void loadPrograms();

    return () => {
      active = false;
    };
  }, []);

  const profileSubtitle = useMemo(() => {
    if (!programValue) {
      return "นักศึกษา";
    }

    const normalized = programValue.toLowerCase();
    const definition = programs.find((program) =>
      program.short_name.toLowerCase() === normalized || program.full_name.toLowerCase() === normalized,
    );

    return definition?.full_name || programValue;
  }, [programValue, programs]);

  const programDisplay = useMemo(() => {
    if (!programValue) return "-";

    const normalized = programValue.toLowerCase();
    const definition = programs.find((program) =>
      program.short_name.toLowerCase() === normalized || program.full_name.toLowerCase() === normalized,
    );

    return definition?.full_name || programValue;
  }, [programValue, programs]);

  const infoRows = [
    { icon: "solar:letter-bold-duotone", label: "อีเมล", value: user?.email || "-", copyable: false },
    { icon: "solar:user-id-bold-duotone", label: "รหัสนักศึกษา", value: user?.username || "-", copyable: true },
    { icon: "solar:shield-user-bold-duotone", label: "สาขา", value: programDisplay, copyable: false },
  ];

  const menuItems = [
    { icon: "solar:shield-check-bold-duotone", label: "สิทธิ์เครื่อง", desc: "กล้อง · ตำแหน่ง · แผนที่", href: "/student/device-check" },
    { icon: "solar:question-circle-bold-duotone", label: "ช่วยเหลือ", desc: "คู่มือและการติดต่อสนับสนุน", href: "/support" },
  ];

  return (
    <div className="space-y-4 pb-2">
      <div className="relative overflow-hidden rounded-4xl border border-slate-200/70 bg-slate-900 p-6 shadow-lg shadow-slate-300/40">
        <span className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col items-center gap-4 pt-2">
          <div className="relative">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/25 text-2xl font-bold text-white ring-4 ring-white/30 backdrop-blur-sm">
              {initials}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-white">
              <Icon icon="solar:check-circle-bold" className="text-xs text-white" />
            </span>
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{user?.full_name || "ชื่อผู้ใช้"}</h2>
            <p className="mt-0.5 text-sm text-slate-300">{profileSubtitle} · LabTAS</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-4xl border border-slate-100 bg-white/90 shadow-sm">
        {infoRows.map((row) => (
          <div key={row.label} className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
              <Icon icon={row.icon} className="text-xl text-slate-700" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{row.label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{row.value}</p>
            </div>
            {row.copyable && (
              <button
                onClick={handleCopyStudentId}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition active:scale-95 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
                title="คัดลอกรหัสนักศึกษา"
              >
                <Icon icon={copied ? "solar:check-circle-bold" : "solar:copy-bold"} className={`text-base transition ${copied ? "text-emerald-500" : ""}`} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-4xl border border-slate-100 bg-white/90 shadow-sm">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50">
              <Icon icon={item.icon} className="text-xl text-slate-600" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
            <Icon icon="solar:arrow-right-bold" className="text-slate-300" />
          </Link>
        ))}
      </div>

      <button
        onClick={() => void handleLogout()}
        className="flex w-full items-center justify-center gap-2 rounded-4xl border border-rose-200 bg-rose-50/80 py-4 text-sm font-bold text-rose-600 transition hover:bg-rose-100 active:scale-[0.99]"
      >
        <Icon icon="solar:logout-2-bold-duotone" className="text-lg" />
        ออกจากระบบ
      </button>

      <p className="text-center text-[11px] text-slate-400">© 2026 LabTAS v1.2.90. สงวนลิขสิทธิ์</p>
    </div>
  );
}

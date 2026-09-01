"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { authService } from "@/services/auth.service";
import { adminSettingsService, type StudentProgram } from "@/services/admin-settings.service";

function getInitials(name: string | undefined | null): string {
  if (!name) return "นศ";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}

export default function StudentProfilePage() {
  const router = useRouter();
  const user = authService.getStoredUser();
  const [copied, setCopied] = useState(false);
  const [programs, setPrograms] = useState<StudentProgram[]>([]);

  const handleLogout = async () => {
    const { ssoLogoutUrl } = await authService.logout();
    if (ssoLogoutUrl) {
      window.location.href = ssoLogoutUrl;
      return;
    }
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

  const programDisplay = useMemo(() => {
    if (!programValue) return "-";

    const normalized = programValue.toLowerCase();
    const definition = programs.find((program) =>
      program.short_name.toLowerCase() === normalized || program.full_name.toLowerCase() === normalized,
    );

    return definition?.full_name || programValue;
  }, [programValue, programs]);

  const profileSubtitle = programValue ? programDisplay : "นักศึกษา";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="cg-page-title">บัญชี</h1>

      <div className="cg-list">
        <div className="flex items-center gap-3.5 p-4">
          <span
            className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full text-[17px] font-medium"
            style={{ background: "var(--cg-accent-soft)", color: "var(--cg-accent-strong)" }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-medium leading-snug">{user?.full_name || "นักศึกษา"}</h2>
            <p className="mt-0.5 truncate text-xs font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
              {profileSubtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="cg-list">
        <div className="cg-row">
          <span className="cg-row-ico">
            <Icon icon="solar:letter-linear" width={17} height={17} />
          </span>
          <span className="cg-row-body">
            <span className="cg-row-sub" style={{ marginTop: 0 }}>อีเมล</span>
            <span className="cg-row-title break-all">{user?.email || "-"}</span>
          </span>
        </div>

        <div className="cg-row">
          <span className="cg-row-ico">
            <Icon icon="solar:user-id-linear" width={17} height={17} />
          </span>
          <span className="cg-row-body">
            <span className="cg-row-sub" style={{ marginTop: 0 }}>รหัสนักศึกษา</span>
            <span className="cg-row-title cg-mono text-sm">{user?.username || "-"}</span>
          </span>
          {user?.username && (
            <button
              type="button"
              onClick={() => void handleCopyStudentId()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: "var(--cg-fill)", color: copied ? "var(--cg-success)" : "var(--cg-text-2)" }}
              aria-label="คัดลอกรหัสนักศึกษา"
            >
              <Icon icon={copied ? "solar:check-circle-linear" : "solar:copy-linear"} width={15} height={15} />
            </button>
          )}
        </div>

        <div className="cg-row">
          <span className="cg-row-ico">
            <Icon icon="solar:shield-user-linear" width={17} height={17} />
          </span>
          <span className="cg-row-body">
            <span className="cg-row-sub" style={{ marginTop: 0 }}>สาขาวิชา</span>
            <span className="cg-row-title">{programDisplay}</span>
          </span>
        </div>
      </div>

      <div className="cg-list">
        <Link href="/student/device-check" className="cg-row">
          <span className="cg-row-ico">
            <Icon icon="solar:shield-check-linear" width={17} height={17} />
          </span>
          <span className="cg-row-body">
            <span className="cg-row-title">สิทธิ์เครื่อง</span>
            <span className="cg-row-sub">กล้อง ตำแหน่ง และการแจ้งเตือน</span>
          </span>
          <Icon icon="solar:alt-arrow-right-linear" className="cg-chevron" width={15} height={15} />
        </Link>

        <Link href="/support" className="cg-row">
          <span className="cg-row-ico">
            <Icon icon="solar:question-circle-linear" width={17} height={17} />
          </span>
          <span className="cg-row-body">
            <span className="cg-row-title">ช่วยเหลือ</span>
            <span className="cg-row-sub">คู่มือและการติดต่อสนับสนุน</span>
          </span>
          <Icon icon="solar:alt-arrow-right-linear" className="cg-chevron" width={15} height={15} />
        </Link>
      </div>

      <div className="cg-list">
        <button
          type="button"
          className="cg-row justify-center text-center"
          style={{ color: "var(--cg-danger)", fontWeight: 500, fontSize: "13.5px" }}
          onClick={() => void handleLogout()}
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Button } from "@heroui/button";
import { API_BASE_URL } from "@/config/api";

interface MaintenanceStatus {
  active: boolean;
  message?: string;
  schedule_type?: string;
  start_time?: string;
  end_time?: string;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function formatThaiDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30">
        <span className="text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  );
}

export default function MaintenancePage() {
  const router = useRouter();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("maintenance_info");
    if (stored) {
      try {
        setStatus(JSON.parse(stored) as MaintenanceStatus);
      } catch { /* ignore */ }
    }

    const checkStatus = () => {
      fetch(`${API_BASE_URL}/maintenance-status`)
        .then((res) => res.json())
        .then((res) => {
          if (res?.data) {
            const data = res.data as MaintenanceStatus;
            setStatus(data);
            if (!data.active) {
              sessionStorage.removeItem("maintenance_info");
              document.cookie = 'maintenance_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
              router.replace("/home");
            }
          }
        })
        .catch(() => {});
    };

    checkStatus();
    const pollId = setInterval(checkStatus, 10000);
    return () => clearInterval(pollId);
  }, [router]);

  useEffect(() => {
    if (!status?.end_time || status.schedule_type !== "scheduled") {
      setCountdown(null);
      return;
    }
    const endDate = new Date(status.end_time);
    const tick = () => {
      const diff = endDate.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.end_time, status?.schedule_type]);

  const message = status?.message || "ระบบอยู่ระหว่างปรับปรุง กรุณาลองใหม่ภายหลัง";

  return (
    <div
      data-auth-shell="true"
      className="flex min-h-screen flex-col items-center justify-center bg-[#f4f7fb] px-4 py-12 text-foreground dark:bg-background"
    >
      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-8 shadow-sm shadow-slate-200/60 dark:border-slate-700 dark:bg-content1 dark:shadow-zinc-950/50">

        {/* Maintenance icon */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-200/60 dark:shadow-blue-950/60">
            <Icon icon="solar:settings-bold-duotone" className="text-3xl text-white" />
          </div>
        </div>

        {/* Heading */}
        <div className="mb-5 text-center">
          <h1 className="text-xl font-bold text-slate-800 dark:text-foreground">
            ปิดปรับปรุงระบบชั่วคราว
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            ระบบกำลังอยู่ในช่วงบำรุงรักษา กรุณารอสักครู่
          </p>
        </div>

        {/* Message */}
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
          <div className="flex gap-2">
            <Icon icon="solar:info-circle-bold" className="mt-0.5 shrink-0 text-base text-blue-500" />
            <span className="leading-relaxed">{message}</span>
          </div>
        </div>

        {/* Schedule info — show whenever dates are available */}
        {(status?.start_time || status?.end_time) && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
            <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-400">
              กำหนดการปิดปรับปรุง
            </p>
            {status.start_time && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Icon icon="solar:calendar-bold" className="shrink-0 text-slate-400" />
                <span>
                  <span className="font-medium">เริ่มต้น:</span>{" "}
                  {formatThaiDateTime(status.start_time)}
                </span>
              </div>
            )}
            {status.end_time && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Icon icon="solar:calendar-bold" className="shrink-0 text-indigo-400" />
                <span>
                  <span className="font-medium">สิ้นสุด:</span>{" "}
                  {formatThaiDateTime(status.end_time)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Countdown */}
        {countdown && (
          <div className="mb-4 text-center">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-400">
              ระบบจะกลับมาใน
            </p>
            <div className="flex items-start justify-center gap-2">
              {countdown.days > 0 && (
                <CountdownBox value={countdown.days} label="วัน" />
              )}
              <CountdownBox value={countdown.hours} label="ชั่วโมง" />
              <CountdownBox value={countdown.minutes} label="นาที" />
              <CountdownBox value={countdown.seconds} label="วินาที" />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="my-5 border-t border-slate-100 dark:border-slate-700" />

        {/* Contact admin */}
        <div className="mb-5 flex items-start gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Icon icon="solar:question-circle-bold" className="mt-0.5 shrink-0 text-sm" />
          <span>หากมีข้อสงสัยหรือต้องการความช่วยเหลือ กรุณาติดต่อผู้ดูแลระบบ</span>
        </div>

        {/* Retry button */}
        <Button
          onPress={() => {
            fetch(`${API_BASE_URL}/maintenance-status`)
              .then((res) => res.json())
              .then((res) => {
                if (res?.data && !res.data.active) {
                  sessionStorage.removeItem("maintenance_info");
                  document.cookie = 'maintenance_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                  router.replace("/home");
                }
              })
              .catch(() => {});
          }}
          className="w-full bg-linear-to-r from-blue-500 to-indigo-500 font-medium text-white shadow-sm shadow-blue-200 dark:shadow-blue-950"
          startContent={<Icon icon="solar:refresh-bold" />}
        >
          ตรวจสอบสถานะระบบอีกครั้ง
        </Button>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} ITII Assist Classroom
        {" · "}
        <a
          href="/login"
          className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
        >
          เข้าสู่ระบบสำหรับผู้ดูแล
        </a>
      </p>
    </div>
  );
}


"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { PERMS, queryPermStatus, queryAllPerms } from "@/lib/device-permissions";
import type { PermInfo, PermStatus } from "@/lib/device-permissions";

// ─── browser-specific denied guide ───────────────────────────────────────────

type BrowserHint = { browser: string; steps: string[] };

function getBrowserHint(permId: PermInfo["id"]): BrowserHint {
  if (typeof window === "undefined") return { browser: "unknown", steps: [] };
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edg\//.test(ua);
  const permLabel: Record<PermInfo["id"], string> = {
    location: "ตำแหน่งที่ตั้ง",
    camera: "กล้อง",
    notifications: "การแจ้งเตือน",
  };
  const label = permLabel[permId];

  if (isIOS && isSafari) {
    if (permId === "notifications") {
      return { browser: "iOS Safari", steps: ["เปิดแอป การตั้งค่า", "เลื่อนหา Safari", "เลือก การแจ้งเตือน → เปิดใช้งาน"] };
    }
    return { browser: "iOS Safari", steps: ["เปิดแอป การตั้งค่า", `เลื่อนหา Safari → ${label}`, "เปลี่ยนเป็น อนุญาต แล้วรีโหลดหน้า"] };
  }
  if (isFirefox) {
    return { browser: "Firefox", steps: ["แตะไอคอนกุญแจหรือโล่ที่แถบที่อยู่", `เลือก สิทธิ์ → ${label}`, "เปลี่ยนเป็น อนุญาต แล้วรีโหลดหน้า"] };
  }
  if (isEdge) {
    return { browser: "Edge", steps: ["แตะไอคอน 🔒 หรือ ℹ️ ที่แถบที่อยู่", "เลือก สิทธิ์สำหรับไซต์นี้", `รีเซ็ต ${label} → อนุญาต แล้วรีโหลดหน้า`] };
  }
  // Default: Chrome / Android WebView
  return { browser: "Chrome", steps: ["แตะไอคอน 🔒 ที่แถบที่อยู่ด้านบน", "เลือก การตั้งค่าไซต์", `ตั้งค่า ${label} → อนุญาต แล้วรีโหลดหน้า`] };
}

function DeniedGuide({ permId }: { permId: PermInfo["id"] }) {
  const { browser, steps } = getBrowserHint(permId);
  return (
    <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 space-y-1.5">
      <p className="flex items-center gap-1.5 font-semibold">
        <Icon icon="solar:danger-triangle-bold" className="text-sm shrink-0" />
        สิทธิ์ถูกปฏิเสธ — ต้องรีเซ็ตใน {browser}
      </p>
      <ol className="list-decimal pl-4 space-y-0.5 text-rose-600">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

// ─── request helper ───────────────────────────────────────────────────────────

async function requestPerm(id: PermInfo["id"]): Promise<PermStatus> {
  if (id === "notifications") {
    if (!("Notification" in window)) return "unsupported";
    const result = await Notification.requestPermission();
    if (result === "granted") return "granted";
    if (result === "denied") return "denied";
    return "prompt";
  }

  if (id === "camera") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return "granted";
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
      return "prompt";
    }
  }

  if (id === "location") {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve("granted"),
        (err) => {
          if (err.code === 1) resolve("denied");
          else resolve("prompt");
        },
        { timeout: 8000 },
      );
    });
  }

  return "unknown";
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PermStatus }) {
  const map: Record<PermStatus, { label: string; cls: string; icon: string }> = {
    granted:     { label: "อนุญาตแล้ว",       cls: "bg-emerald-100 text-emerald-700", icon: "solar:check-circle-bold" },
    denied:      { label: "ถูกปฏิเสธ",         cls: "bg-rose-100 text-rose-700",       icon: "solar:close-circle-bold" },
    prompt:      { label: "ยังไม่ได้อนุญาต",   cls: "bg-amber-100 text-amber-700",     icon: "solar:question-circle-bold" },
    unsupported: { label: "ไม่รองรับในเครื่องนี้", cls: "bg-slate-100 text-slate-500",  icon: "solar:minus-circle-bold" },
    unknown:     { label: "กำลังตรวจสอบ…",     cls: "bg-slate-100 text-slate-400",     icon: "solar:refresh-circle-bold" },
  };
  const { label, cls, icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <Icon icon={icon} className="text-sm" />
      {label}
    </span>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DeviceCheckPage() {
  const [statuses, setStatuses] = useState<Record<string, PermStatus>>({
    location: "unknown",
    camera: "unknown",
    notifications: "unknown",
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isRechecking, setIsRechecking] = useState(false);

  const runQuery = useCallback(async () => {
    const entries = await queryAllPerms();
    setStatuses(entries);
  }, []);

  // Query all on mount
  useEffect(() => {
    let cancelled = false;
    queryAllPerms().then((entries) => {
      if (!cancelled) setStatuses(entries);
    });
    return () => { cancelled = true; };
  }, [runQuery]);

  const handleRecheck = useCallback(async () => {
    setIsRechecking(true);
    await runQuery();
    setIsRechecking(false);
  }, [runQuery]);

  const handleRequest = useCallback(async (id: PermInfo["id"]) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await requestPerm(id);
    setStatuses((prev) => ({ ...prev, [id]: result }));
    setLoading((prev) => ({ ...prev, [id]: false }));
  }, []);

  const grantedCount = Object.values(statuses).filter((s) => s === "granted").length;
  const totalUsable = PERMS.filter((p) => statuses[p.id] !== "unsupported").length;
  const allGranted = grantedCount === totalUsable && totalUsable > 0;

  return (
    <div className="space-y-5 pb-4">

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-slate-800 via-slate-700 to-slate-600 p-5 shadow-xl shadow-slate-300/30">
        <span className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl text-white backdrop-blur-sm">
            <Icon icon="solar:shield-check-bold-duotone" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">ก่อนเข้าห้องเรียน</p>
            <h1 className="mt-0.5 text-xl font-bold text-white">เช็กสิทธิ์เครื่อง</h1>
            <p className="mt-1 text-sm text-slate-300/80">
              ตรวจสอบและอนุญาตสิทธิ์ที่จำเป็น เพื่อให้ระบบทำงานได้สมบูรณ์
            </p>
          </div>
        </div>

        {/* progress bar */}
        <div className="relative mt-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ความพร้อมเครื่อง</span>
            <span className="font-semibold text-white">{grantedCount} / {totalUsable} สิทธิ์</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allGranted ? "bg-emerald-400" : "bg-sky-400"}`}
              style={{ width: totalUsable > 0 ? `${(grantedCount / totalUsable) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </div>

      {/* ── All granted banner ─────────────────────────────────────────────── */}
      {allGranted && (
        <div className="flex items-center gap-3 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <Icon icon="solar:verified-check-bold" className="text-xl text-emerald-600" />
          </span>
          <div>
            <p className="font-semibold text-emerald-900">เครื่องพร้อมใช้งานแล้ว!</p>
            <p className="text-sm text-emerald-700/80">สิทธิ์ที่จำเป็นทั้งหมดได้รับการอนุญาตแล้ว</p>
          </div>
        </div>
      )}

      {/* ── Permission cards ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {PERMS.map((perm) => {
          const status = statuses[perm.id];
          const isLoading = loading[perm.id];
          const isDenied = status === "denied";
          const isGranted = status === "granted";
          const isUnsupported = status === "unsupported";
          const canRequest = !isGranted && !isUnsupported && !isLoading;

          return (
            <div
              key={perm.id}
              className={`flex items-start gap-4 rounded-[1.75rem] border bg-white/90 p-5 shadow-sm shadow-slate-100 transition ${isGranted ? "border-emerald-100 bg-emerald-50/40" : "border-slate-100"}`}
            >
              {/* icon */}
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl ${perm.bgColor} ${perm.iconColor}`}>
                <Icon icon={perm.icon} />
              </span>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{perm.label}</p>
                    <p className="text-xs text-slate-500">{perm.description}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                {/* used-for tag */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Icon icon="solar:bolt-bold" className="text-xs text-sky-400" />
                  <span>ใช้สำหรับ: <span className="font-medium text-slate-600">{perm.usedFor}</span></span>
                </div>

                {/* action */}
                {isDenied ? (
                  <DeniedGuide permId={perm.id} />
                ) : canRequest ? (
                  <button
                    onClick={() => handleRequest(perm.id)}
                    disabled={isLoading}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition active:scale-95 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Icon icon="solar:refresh-bold" className="animate-spin text-base" />
                        กำลังขออนุญาต…
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:key-bold" className="text-base" />
                        ขออนุญาต
                      </>
                    )}
                  </button>
                ) : isGranted ? (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                    <Icon icon="solar:check-circle-bold" className="text-sm" />
                    พร้อมใช้งาน
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Re-check all button ───────────────────────────────────────────── */}
      <button
        onClick={handleRecheck}
        disabled={isRechecking}
        className="flex w-full items-center justify-center gap-2 rounded-[1.75rem] border border-slate-200 bg-white/80 py-3.5 text-sm font-semibold text-slate-600 shadow-sm transition active:scale-[0.98] hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
      >
        <Icon icon="solar:refresh-bold" className={`text-base ${isRechecking ? "animate-spin" : ""}`} />
        {isRechecking ? "กำลังตรวจสอบ…" : "ตรวจสอบสิทธิ์ใหม่ทั้งหมด"}
      </button>

      {/* ── Tips ──────────────────────────────────────────────────────────── */}
      <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-5 space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon icon="solar:info-circle-bold" className="text-base text-slate-400" />
          หมายเหตุ
        </p>
        <ul className="space-y-2 text-xs text-slate-500">
          <li className="flex items-start gap-2">
            <Icon icon="solar:point-on-map-bold" className="mt-0.5 shrink-0 text-sky-400" />
            <span>สิทธิ์ตำแหน่งที่ตั้งจำเป็นสำหรับการเช็กชื่อเข้าเรียน หากไม่อนุญาต อาจเช็กชื่อไม่ได้</span>
          </li>
          <li className="flex items-start gap-2">
            <Icon icon="solar:camera-bold" className="mt-0.5 shrink-0 text-violet-400" />
            <span>สิทธิ์กล้องใช้สำหรับสแกน QR Code เท่านั้น ระบบไม่บันทึกหรือส่งภาพวิดีโอ</span>
          </li>
          <li className="flex items-start gap-2">
            <Icon icon="solar:bell-bold" className="mt-0.5 shrink-0 text-amber-400" />
            <span>การแจ้งเตือนช่วยให้ทราบเมื่ออาจารย์ส่งข้อความหรือประกาศสำคัญ</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import PermissionLocationMap from "@/components/device/PermissionLocationMap";
import { queryAllPerms, type PermStatus } from "@/lib/device-permissions";

type LocationSnapshot = {
  lat: number;
  lng: number;
  accuracy: number;
  label: string | null;
  checkedAt: string;
};

function getPermissionHelp(status: PermStatus, label: string) {
  if (status === "granted") {
    return `เบราว์เซอร์จดจำสิทธิ์${label}ให้เว็บนี้แล้ว ครั้งต่อไประบบจะใช้งานได้ทันทีจนกว่าจะเปลี่ยนใน Site settings`;
  }

  if (status === "denied") {
    return `สิทธิ์${label}ถูกบล็อกอยู่ ให้แตะไอคอนแม่กุญแจที่แถบที่อยู่ แล้วเปลี่ยนเป็น อนุญาต`;
  }

  if (status === "unsupported") {
    return `อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการใช้${label}จากหน้าเว็บนี้`;
  }

  return `กดอนุญาตเมื่อเบราว์เซอร์ถาม เพื่อให้เว็บนี้จดจำสิทธิ์${label}ไว้สำหรับครั้งต่อไป`;
}

function StatusBadge({ status }: { status: PermStatus }) {
  const statusMap: Record<PermStatus, { label: string; className: string; icon: string }> = {
    unknown: {
      label: "กำลังตรวจสอบ",
      className: "bg-slate-100 text-slate-500",
      icon: "solar:refresh-bold",
    },
    granted: {
      label: "อนุญาตแล้ว",
      className: "bg-emerald-100 text-emerald-700",
      icon: "solar:check-circle-bold",
    },
    denied: {
      label: "ถูกบล็อก",
      className: "bg-rose-100 text-rose-700",
      icon: "solar:close-circle-bold",
    },
    prompt: {
      label: "รอการอนุญาต",
      className: "bg-amber-100 text-amber-700",
      icon: "solar:question-circle-bold",
    },
    unsupported: {
      label: "ไม่รองรับ",
      className: "bg-slate-100 text-slate-400",
      icon: "solar:forbidden-circle-bold",
    },
  };

  const current = statusMap[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${current.className}`}>
      <Icon icon={current.icon} className={status === "unknown" ? "animate-spin text-sm" : "text-sm"} />
      {current.label}
    </span>
  );
}

export default function DevicePermissionCheckClient() {
  const [statuses, setStatuses] = useState<Record<string, PermStatus>>({
    location: "unknown",
    camera: "unknown",
    notifications: "unknown",
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const cameraTimerRef = useRef<number | null>(null);

  const refreshStatuses = useCallback(async () => {
    const nextStatuses = await queryAllPerms();
    setStatuses(nextStatuses);
    setLastCheckedAt(new Date().toLocaleString("th-TH"));
    return nextStatuses;
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.display_name as string | null;
    } catch {
      return null;
    }
  }, []);

  const checkLocation = useCallback(async () => {
    setLoading((prev) => ({ ...prev, location: true }));
    setLocationMessage(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("unsupported"));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;
      const label = await reverseGeocode(latitude, longitude);

      setLocationSnapshot({
        lat: latitude,
        lng: longitude,
        accuracy,
        label,
        checkedAt: new Date().toLocaleString("th-TH"),
      });
      setLocationMessage("อ่านพิกัดล่าสุดสำเร็จแล้ว คุณสามารถดูหมุดบนแผนที่เพื่อเช็กตำแหน่งได้ทันที");
      setStatuses((prev) => ({ ...prev, location: "granted" }));
    } catch (error: unknown) {
      const geoError = error as GeolocationPositionError;

      if (geoError?.code === 1) {
        setStatuses((prev) => ({ ...prev, location: "denied" }));
        setLocationMessage("ยังไม่ได้อนุญาตตำแหน่ง หรือเคยกดบล็อกไว้ ให้เปลี่ยนสิทธิ์ของเว็บไซต์นี้เป็น อนุญาต");
      } else if ((error as Error)?.message === "unsupported") {
        setStatuses((prev) => ({ ...prev, location: "unsupported" }));
        setLocationMessage("อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่งจากเบราว์เซอร์");
      } else {
        setLocationMessage("อ่านตำแหน่งไม่สำเร็จในครั้งนี้ ลองขยับไปจุดที่สัญญาณชัดขึ้นแล้วกดตรวจอีกครั้ง");
      }
    } finally {
      setLoading((prev) => ({ ...prev, location: false }));
    }
  }, [reverseGeocode]);

  const stopCamera = useCallback(() => {
    if (cameraTimerRef.current) {
      window.clearTimeout(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }

    setCameraStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
    setLoading((prev) => ({ ...prev, camera: false }));
  }, []);

  const checkCamera = useCallback(async () => {
    setLoading((prev) => ({ ...prev, camera: true }));

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      setCameraStream(stream);
      setStatuses((prev) => ({ ...prev, camera: "granted" }));
      cameraTimerRef.current = window.setTimeout(() => {
        stopCamera();
      }, 15000);
    } catch (error: unknown) {
      const mediaError = error as DOMException;
      if (mediaError.name === "NotAllowedError" || mediaError.name === "PermissionDeniedError") {
        setStatuses((prev) => ({ ...prev, camera: "denied" }));
      }
      setLoading((prev) => ({ ...prev, camera: false }));
    }
  }, [stopCamera]);

  const checkNotifications = useCallback(async () => {
    setLoading((prev) => ({ ...prev, notifications: true }));

    try {
      if (!("Notification" in window)) {
        setStatuses((prev) => ({ ...prev, notifications: "unsupported" }));
        return;
      }

      const result = await Notification.requestPermission();
      setStatuses((prev) => ({
        ...prev,
        notifications: result === "default" ? "prompt" : (result as PermStatus),
      }));
    } finally {
      setLoading((prev) => ({ ...prev, notifications: false }));
    }
  }, []);

  const handleRecheckAll = useCallback(async () => {
    const nextStatuses = await refreshStatuses();
    if (nextStatuses.location === "granted") {
      await checkLocation();
    }
  }, [checkLocation, refreshStatuses]);

  const handleCopyLink = useCallback(async () => {
    if (!currentUrl) return;

    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [currentUrl]);

  useEffect(() => {
    void refreshStatuses().then((nextStatuses) => {
      if (nextStatuses.location === "granted") {
        void checkLocation();
      }
    });
  }, [checkLocation, refreshStatuses]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
    setCurrentUrl(window.location.href);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const primaryGrantedCount = useMemo(
    () => ["camera", "location"].filter((id) => statuses[id] === "granted").length,
    [statuses],
  );

  const locationMapsUrl = locationSnapshot
    ? `https://www.google.com/maps?q=${locationSnapshot.lat},${locationSnapshot.lng}`
    : "";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_38%),linear-gradient(180deg,_#f8fbff_0%,_#eef4f8_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/40">
          <span className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-200/30 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-emerald-200/25 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <Icon icon="solar:shield-check-bold-duotone" className="text-base text-sky-600" />
                ลิงก์ทดสอบสิทธิ์สำหรับนักศึกษา
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                เช็กกล้อง ตำแหน่ง และความพร้อมก่อนใช้งานจริง
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                หน้านี้ช่วยให้นักศึกษาลองอนุญาตสิทธิ์ที่เว็บต้องใช้ ดูภาพจากกล้องจริง และเช็กหมุดตำแหน่งว่าปักถูกจุดหรือไม่
                ถ้ากดอนุญาตแล้ว เบราว์เซอร์จะจำสิทธิ์ของเว็บไซต์นี้ไว้ให้ใช้ครั้งต่อ ๆ ไป
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700 active:scale-[0.98]"
              >
                <Icon icon={copied ? "solar:check-circle-bold" : "solar:link-bold"} className="text-base" />
                {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์หน้านี้"}
              </button>
              <button
                onClick={() => void handleRecheckAll()}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <Icon icon="solar:refresh-bold" className="text-base" />
                ตรวจสอบใหม่ทั้งหมด
              </button>
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ความพร้อมหลัก</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{primaryGrantedCount}/2</p>
              <p className="mt-1 text-sm text-slate-500">กล้องและตำแหน่งที่จำเป็นต่อการใช้งานจริง</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">เว็บไซต์นี้</p>
              <p className="mt-2 truncate text-sm font-bold text-slate-900">{origin || "กำลังอ่านค่า..."}</p>
              <p className="mt-1 text-sm text-slate-500">เบราว์เซอร์จะจำสิทธิ์แยกตามโดเมนนี้</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ตรวจล่าสุด</p>
              <p className="mt-2 text-sm font-bold text-slate-900">{lastCheckedAt ?? "ยังไม่ได้ตรวจ"}</p>
              <p className="mt-1 text-sm text-slate-500">ถ้าสถานะเพิ่งเปลี่ยน ให้กดตรวจสอบใหม่อีกครั้ง</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/30">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-violet-100 text-violet-700">
                    <Icon icon="solar:camera-bold-duotone" className="text-3xl" />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-slate-900">สิทธิ์กล้อง</p>
                    <p className="mt-1 text-sm text-slate-500">ใช้สำหรับสแกน QR และยืนยันว่าเบราว์เซอร์เปิดกล้องได้จริง</p>
                  </div>
                </div>
                <StatusBadge status={statuses.camera as PermStatus} />
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-3">
                {cameraStream ? (
                  <div className="space-y-3">
                    <video
                      autoPlay
                      playsInline
                      muted
                      ref={(node) => {
                        if (node && cameraStream) {
                          node.srcObject = cameraStream;
                        }
                      }}
                      className="aspect-video w-full rounded-[1.25rem] bg-black object-cover"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-300">ภาพตัวอย่างจากกล้องกำลังทำงาน ระบบจะปิดให้อัตโนมัติภายใน 15 วินาที</p>
                      <button
                        onClick={stopCamera}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                      >
                        <Icon icon="solar:close-circle-bold" className="text-sm" />
                        ปิดกล้อง
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-4 text-center">
                    <Icon icon="solar:camera-add-bold-duotone" className="text-5xl text-white/60" />
                    <p className="mt-3 text-sm font-semibold text-white">ยังไม่ได้เปิดกล้อง</p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">กดปุ่มทดสอบด้านล่างเพื่อดูว่ากล้องของเครื่องนี้เปิดจากเบราว์เซอร์ได้ตามปกติหรือไม่</p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => void checkCamera()}
                  disabled={loading.camera}
                  className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60 active:scale-[0.98]"
                >
                  <Icon icon={loading.camera ? "solar:refresh-bold" : "solar:camera-bold"} className={loading.camera ? "animate-spin text-base" : "text-base"} />
                  {statuses.camera === "granted" ? "ทดสอบกล้องอีกครั้ง" : "อนุญาตและทดสอบกล้อง"}
                </button>
                <Link
                  href="/student/scan"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 active:scale-[0.98]"
                >
                  <Icon icon="solar:qr-code-bold" className="text-base" />
                  ไปหน้าสแกนจริง
                </Link>
              </div>

              <p className="mt-4 rounded-[1.25rem] bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
                {getPermissionHelp(statuses.camera as PermStatus, "กล้อง")}
              </p>
            </section>

            <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/30">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-emerald-100 text-emerald-700">
                    <Icon icon="solar:map-point-bold-duotone" className="text-3xl" />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-slate-900">สิทธิ์ตำแหน่ง</p>
                    <p className="mt-1 text-sm text-slate-500">ใช้สำหรับเช็กชื่อที่ต้องอ้างอิงตำแหน่ง และแสดงหมุดบนแผนที่ให้ตรวจได้ทันที</p>
                  </div>
                </div>
                <StatusBadge status={statuses.location as PermStatus} />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => void checkLocation()}
                  disabled={loading.location}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 active:scale-[0.98]"
                >
                  <Icon icon={loading.location ? "solar:refresh-bold" : "solar:gps-bold"} className={loading.location ? "animate-spin text-base" : "text-base"} />
                  {statuses.location === "granted" ? "ตรวจตำแหน่งอีกครั้ง" : "อนุญาตและตรวจตำแหน่ง"}
                </button>
                {locationMapsUrl ? (
                  <a
                    href={locationMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 active:scale-[0.98]"
                  >
                    <Icon icon="solar:point-on-map-bold" className="text-base" />
                    เปิดใน Google Maps
                  </a>
                ) : null}
              </div>

              <p className="mt-4 rounded-[1.25rem] bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                {getPermissionHelp(statuses.location as PermStatus, "ตำแหน่ง")}
              </p>

              {locationMessage ? (
                <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {locationMessage}
                </div>
              ) : null}

              {locationSnapshot ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Latitude / Longitude</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {locationSnapshot.lat.toFixed(6)}, {locationSnapshot.lng.toFixed(6)}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ความแม่นยำ</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">ประมาณ ±{locationSnapshot.accuracy.toFixed(0)} เมตร</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ตรวจล่าสุด</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{locationSnapshot.checkedAt}</p>
                    </div>
                  </div>

                  {locationSnapshot.label ? (
                    <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                      <span className="font-semibold text-slate-900">ตำแหน่งโดยประมาณ:</span> {locationSnapshot.label}
                    </div>
                  ) : null}

                  <PermissionLocationMap
                    latitude={locationSnapshot.lat}
                    longitude={locationSnapshot.lng}
                    accuracy={locationSnapshot.accuracy}
                  />
                </div>
              ) : null}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/30">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-amber-100 text-amber-700">
                  <Icon icon="solar:bell-bold-duotone" className="text-2xl" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-900">การแจ้งเตือน</p>
                  <p className="mt-1 text-sm text-slate-500">ตัวเลือกเสริมสำหรับประกาศหรือคิว ไม่จำเป็นต่อการทดสอบกล้องและตำแหน่ง</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">สถานะสิทธิ์แจ้งเตือน</p>
                  <p className="mt-1 text-xs text-slate-500">ถ้าต้องการให้เว็บเด้งแจ้งเตือนในภายหลัง ค่อยเปิดใช้งานส่วนนี้ได้</p>
                </div>
                <StatusBadge status={statuses.notifications as PermStatus} />
              </div>

              <button
                onClick={() => void checkNotifications()}
                disabled={loading.notifications || statuses.notifications === "unsupported"}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:opacity-60 active:scale-[0.98]"
              >
                <Icon icon={loading.notifications ? "solar:refresh-bold" : "solar:bell-bold"} className={loading.notifications ? "animate-spin text-base" : "text-base"} />
                {statuses.notifications === "granted" ? "ขอทดสอบอีกครั้ง" : "เปิดสิทธิ์แจ้งเตือน"}
              </button>
            </section>

            <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/30">
              <p className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Icon icon="solar:shield-user-bold-duotone" className="text-2xl text-sky-600" />
                วิธีให้เว็บจำสิทธิ์ไว้
              </p>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li className="rounded-[1.25rem] bg-slate-50 px-4 py-3">
                  1. กดปุ่มทดสอบของแต่ละสิทธิ์ แล้วเลือก <span className="font-semibold text-slate-900">อนุญาต</span> ในกล่องของเบราว์เซอร์
                </li>
                <li className="rounded-[1.25rem] bg-slate-50 px-4 py-3">
                  2. ถ้าเบราว์เซอร์มีตัวเลือก เช่น <span className="font-semibold text-slate-900">Allow while visiting the site</span> หรือ <span className="font-semibold text-slate-900">Always allow</span> ให้เลือกตัวเลือกอนุญาต
                </li>
                <li className="rounded-[1.25rem] bg-slate-50 px-4 py-3">
                  3. ถ้าเคยกดบล็อกไปแล้ว ให้แตะไอคอนแม่กุญแจข้าง URL แล้วเปลี่ยนสิทธิ์ของเว็บไซต์นี้กลับเป็น <span className="font-semibold text-slate-900">Allow</span>
                </li>
              </ol>
            </section>

            <section className="rounded-[2rem] border border-slate-200/80 bg-slate-900 p-5 text-white shadow-lg shadow-slate-300/30">
              <p className="text-lg font-bold">ลิงก์ใช้งานจริง</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                หลังจากทดสอบผ่านแล้ว สามารถกลับไปใช้งานหน้าสแกนหรือหน้าเช็กชื่อได้เลย ถ้าเปิดจากมือถือ แนะนำให้ใช้เบราว์เซอร์เดียวกับที่ใช้หน้านี้
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/student/scan"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]"
                >
                  <Icon icon="solar:qr-code-bold" className="text-base" />
                  หน้าสแกน QR
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 active:scale-[0.98]"
                >
                  <Icon icon="solar:login-3-bold" className="text-base" />
                  เข้าสู่ระบบ
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

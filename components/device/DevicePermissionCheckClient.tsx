"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import PermissionLocationMap from "@/components/device/PermissionLocationMap";
import { queryAllPerms, type PermStatus } from "@/lib/device-permissions";

type LocationSnapshot = {
  lat: number;
  lng: number;
  accuracy: number;
  label: string | null;
};

async function getRearCameraStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" } },
      audio: false,
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  }
}

function StatusChip({ status }: { status: PermStatus }) {
  const map: Record<PermStatus, { label: string; className: string }> = {
    unknown: { label: "กำลังตรวจสอบ", className: "bg-slate-100 text-slate-600" },
    granted: { label: "พร้อมใช้งาน", className: "bg-emerald-100 text-emerald-700" },
    denied: { label: "ถูกบล็อก", className: "bg-rose-100 text-rose-700" },
    prompt: { label: "รออนุญาต", className: "bg-amber-100 text-amber-700" },
    unsupported: { label: "ไม่รองรับ", className: "bg-slate-100 text-slate-400" },
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${map[status].className}`}>
      {map[status].label}
    </span>
  );
}

function ActionButton({
  onClick,
  loading,
  disabled,
  label,
  loadingLabel,
  icon,
  className,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel: string;
  icon: string;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60 active:scale-[0.98] ${className}`}
    >
      <Icon icon={loading ? "solar:refresh-bold" : icon} className={loading ? "animate-spin text-base" : "text-base"} />
      {loading ? loadingLabel : label}
    </button>
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
  const cameraTimerRef = useRef<number | null>(null);

  const refreshStatuses = useCallback(async () => {
    const nextStatuses = await queryAllPerms();
    setStatuses(nextStatuses);
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
      const stream = await getRearCameraStream();
      setCameraStream(stream);
      setStatuses((prev) => ({ ...prev, camera: "granted" }));
      cameraTimerRef.current = window.setTimeout(() => stopCamera(), 15000);
    } catch (error: unknown) {
      const mediaError = error as DOMException;
      if (mediaError.name === "NotAllowedError" || mediaError.name === "PermissionDeniedError") {
        setStatuses((prev) => ({ ...prev, camera: "denied" }));
      }
      setLoading((prev) => ({ ...prev, camera: false }));
    }
  }, [stopCamera]);

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

      setLocationSnapshot({ lat: latitude, lng: longitude, accuracy, label });
      setStatuses((prev) => ({ ...prev, location: "granted" }));
      setLocationMessage("ตรวจตำแหน่งสำเร็จแล้ว ถ้าหมุดอยู่ถูกที่ก็พร้อมใช้งาน");
    } catch (error: unknown) {
      const geoError = error as GeolocationPositionError;

      if (geoError?.code === 1) {
        setStatuses((prev) => ({ ...prev, location: "denied" }));
        setLocationMessage("ยังไม่ได้อนุญาตตำแหน่ง ให้เปิดสิทธิ์ของเว็บไซต์นี้เป็น อนุญาต");
      } else if ((error as Error)?.message === "unsupported") {
        setStatuses((prev) => ({ ...prev, location: "unsupported" }));
        setLocationMessage("อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่งจากเบราว์เซอร์");
      } else {
        setLocationMessage("อ่านตำแหน่งไม่สำเร็จ ลองกดตรวจใหม่อีกครั้ง");
      }
    } finally {
      setLoading((prev) => ({ ...prev, location: false }));
    }
  }, [reverseGeocode]);

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

  useEffect(() => {
    void refreshStatuses().then((nextStatuses) => {
      if (nextStatuses.location === "granted") {
        void checkLocation();
      }
    });
  }, [checkLocation, refreshStatuses]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const readyCount = useMemo(
    () => ["camera", "location", "notifications"].filter((id) => statuses[id] === "granted").length,
    [statuses],
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Icon icon="solar:shield-check-bold-duotone" className="text-3xl" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">เช็กสิทธิ์ที่จำเป็นก่อนใช้งาน</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                ใช้หน้านี้เพื่อตรวจ 3 อย่างที่เว็บอาจต้องใช้: กล้อง ตำแหน่ง และการแจ้งเตือน
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                ถ้ากดอนุญาตแล้ว เบราว์เซอร์จะจำสิทธิ์ของเว็บ <span className="font-semibold text-slate-900">{origin || "นี้"}</span> ไว้ให้ใช้ครั้งต่อไป
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-800">พร้อมแล้ว {readyCount}/3 สิทธิ์</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. กล้อง</h2>
              <p className="mt-1 text-sm text-slate-600">ใช้สำหรับสแกน QR โดยหน้าทดสอบนี้จะเปิดกล้องหลังให้ก่อน</p>
            </div>
            <StatusChip status={statuses.camera as PermStatus} />
          </div>

          {cameraStream ? (
            <div className="mt-4 space-y-3">
              <video
                autoPlay
                playsInline
                muted
                ref={(node) => {
                  if (node && cameraStream) node.srcObject = cameraStream;
                }}
                className="aspect-video w-full rounded-[1.5rem] bg-black object-cover"
              />
              <button
                onClick={stopCamera}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                ปิดกล้อง
              </button>
            </div>
          ) : null}

          <div className="mt-4">
            <ActionButton
              onClick={() => void checkCamera()}
              loading={loading.camera}
              label={statuses.camera === "granted" ? "ทดสอบกล้องอีกครั้ง" : "อนุญาตและทดสอบกล้อง"}
              loadingLabel="กำลังเปิดกล้อง"
              icon="solar:camera-bold"
              className="bg-violet-600 hover:bg-violet-500"
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">2. ตำแหน่ง</h2>
              <p className="mt-1 text-sm text-slate-600">ใช้สำหรับเช็กว่าระบบอ่านตำแหน่งได้ และหมุดอยู่ถูกจุดหรือไม่</p>
            </div>
            <StatusChip status={statuses.location as PermStatus} />
          </div>

          <div className="mt-4">
            <ActionButton
              onClick={() => void checkLocation()}
              loading={loading.location}
              label={statuses.location === "granted" ? "ตรวจตำแหน่งอีกครั้ง" : "อนุญาตและตรวจตำแหน่ง"}
              loadingLabel="กำลังอ่านตำแหน่ง"
              icon="solar:gps-bold"
              className="bg-emerald-600 hover:bg-emerald-500"
            />
          </div>

          {locationMessage ? (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{locationMessage}</p>
          ) : null}

          {locationSnapshot ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">พิกัด</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {locationSnapshot.lat.toFixed(6)}, {locationSnapshot.lng.toFixed(6)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ความแม่นยำ</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">ประมาณ ±{locationSnapshot.accuracy.toFixed(0)} เมตร</p>
                </div>
              </div>

              {locationSnapshot.label ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{locationSnapshot.label}</p>
              ) : null}

              <PermissionLocationMap
                latitude={locationSnapshot.lat}
                longitude={locationSnapshot.lng}
                accuracy={locationSnapshot.accuracy}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">3. การแจ้งเตือน</h2>
              <p className="mt-1 text-sm text-slate-600">สิทธิ์เสริมสำหรับประกาศหรือคิว เปิดไว้ได้ถ้าต้องการ</p>
            </div>
            <StatusChip status={statuses.notifications as PermStatus} />
          </div>

          <div className="mt-4">
            <ActionButton
              onClick={() => void checkNotifications()}
              loading={loading.notifications}
              disabled={statuses.notifications === "unsupported"}
              label={statuses.notifications === "granted" ? "ขอทดสอบอีกครั้ง" : "เปิดสิทธิ์แจ้งเตือน"}
              loadingLabel="กำลังขอสิทธิ์"
              icon="solar:bell-bold"
              className="bg-amber-500 hover:bg-amber-400"
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">ถ้าเคยกดบล็อกไว้</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            ให้แตะไอคอนแม่กุญแจข้าง URL แล้วเปลี่ยนสิทธิ์ของเว็บไซต์นี้เป็น <span className="font-semibold text-slate-900">Allow</span> จากนั้นกลับมากดทดสอบใหม่
          </p>
        </section>
      </div>
    </div>
  );
}

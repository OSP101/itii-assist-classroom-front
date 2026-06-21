"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@heroui/input";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";

import jsQR from "jsqr";
import { parseStudentQrPayload, type StudentQrParseResult } from "@/lib/qr-deeplink";

type BarcodeDetectorResult = { rawValue: string };

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function normalizeCameraLabel(label: string): string {
  return label.trim().toLowerCase();
}

function isLikelyFrontCameraLabel(label: string): boolean {
  const name = normalizeCameraLabel(label);
  return name.includes("front") || name.includes("user") || name.includes("selfie");
}

function isLikelyRearCameraLabel(label: string): boolean {
  const name = normalizeCameraLabel(label);
  return name.includes("back") || name.includes("rear") || name.includes("environment");
}

function isLikelyUltraWideLabel(label: string): boolean {
  const name = normalizeCameraLabel(label);
  return (
    name.includes("ultra") ||
    name.includes("ultrawide") ||
    name.includes("ultra-wide") ||
    name.includes("0.5") ||
    name.includes("0,5") ||
    name.includes("fisheye")
  );
}

function isLikelyStandardRearLabel(label: string): boolean {
  const name = normalizeCameraLabel(label);
  return (
    name.includes("main") ||
    name.includes("normal") ||
    name.includes("standard") ||
    name.includes("1x")
  );
}

function scoreCameraDevice(label: string): number {
  const name = normalizeCameraLabel(label);
  let score = 0;

  if (!name) score += 5;
  if (isLikelyRearCameraLabel(name)) score += 40;
  if (name.includes("camera")) score += 5;
  if (isLikelyStandardRearLabel(name)) score += 20;
  if (name.includes("tele")) score += 8;
  if (isLikelyFrontCameraLabel(name)) score -= 80;
  if (isLikelyUltraWideLabel(name)) score -= 60;
  if (name.includes("wide")) score -= 25;

  return score;
}

function listRearCameraCandidates(
  devices: MediaDeviceInfo[],
  currentDeviceId: string,
): MediaDeviceInfo[] {
  const videoInputs = devices.filter((device) => device.kind === "videoinput");
  const labeledDevices = videoInputs.filter((device) => normalizeCameraLabel(device.label));
  const hasLabeledDevices = labeledDevices.length > 0;
  const explicitRearCandidates = labeledDevices.filter((device) => (
    isLikelyRearCameraLabel(device.label) &&
    !isLikelyFrontCameraLabel(device.label)
  ));

  const candidatePool = explicitRearCandidates.length > 0
    ? explicitRearCandidates
    : hasLabeledDevices
      ? labeledDevices.filter((device) => !isLikelyFrontCameraLabel(device.label))
      : [];

  if (candidatePool.length === 0) {
    return [];
  }

  return candidatePool
    .map((device) => ({
      device,
      score: scoreCameraDevice(device.label) + (device.deviceId === currentDeviceId ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.device);
}

async function getRearCameraBootstrapStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { exact: "environment" },
      },
      audio: false,
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });
  }
}

function shouldAvoidCameraProbing(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const isIOSDevice = /iPhone|iPad|iPod/i.test(userAgent);
  const isIPadOSDesktopMode =
    /Macintosh/i.test(userAgent) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  return isIOSDevice || isIPadOSDesktopMode;
}

async function applyRearCameraTrackPreferences(track: MediaStreamTrack): Promise<void> {
  if (typeof track.getCapabilities !== "function") {
    return;
  }

  const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: { min?: number; max?: number };
    focusMode?: string[];
  };
  const nextConstraints: MediaTrackConstraints & {
    advanced?: Array<Record<string, unknown>>;
  } = {};
  const advanced: Array<Record<string, unknown>> = [];

  if (typeof capabilities.zoom?.min === "number" && typeof capabilities.zoom?.max === "number") {
    const targetZoom = Math.min(Math.max(1, capabilities.zoom.min), capabilities.zoom.max);
    advanced.push({ zoom: targetZoom });
  }

  if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")) {
    advanced.push({ focusMode: "continuous" });
  }

  if (advanced.length > 0) {
    nextConstraints.advanced = advanced;
  }

  if (Object.keys(nextConstraints).length === 0) {
    return;
  }

  try {
    await track.applyConstraints(nextConstraints);
  } catch {
    // Ignore unsupported camera tuning options and keep the stream alive.
  }
}

type RearCameraProbeResult = {
  deviceId: string;
  label: string;
  score: number;
  stream: MediaStream;
  track: MediaStreamTrack;
};

function scoreRearCameraCapabilities(track: MediaStreamTrack): number {
  if (typeof track.getCapabilities !== "function") {
    return 0;
  }

  const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: { min?: number; max?: number };
    torch?: boolean;
    focusMode?: string[];
    focusDistance?: { min?: number; max?: number };
  };

  let score = 0;

  if (capabilities.torch) score += 20;
  if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")) score += 20;
  if (typeof capabilities.focusDistance?.max === "number" && capabilities.focusDistance.max > 0) score += 10;
  if (typeof capabilities.zoom?.max === "number") {
    if (capabilities.zoom.max >= 2) score += 35;
    else if (capabilities.zoom.max > 1) score += 18;
    else score -= 25;
  }

  return score;
}

async function openRearCameraStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: deviceId
      ? {
          deviceId: { exact: deviceId },
          facingMode: { ideal: "environment" },
        }
      : {
          facingMode: { exact: "environment" },
        },
    audio: false,
  });
}

async function probeRearCamera(
  device: MediaDeviceInfo,
  currentDeviceId: string,
): Promise<RearCameraProbeResult | null> {
  try {
    const stream = await openRearCameraStream(device.deviceId);
    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((candidateTrack) => candidateTrack.stop());
      return null;
    }

    const settings = track.getSettings();
    const label = track.label || device.label;
    let score =
      scoreCameraDevice(label) +
      scoreRearCameraCapabilities(track) +
      (settings.facingMode === "environment" ? 15 : 0) +
      (device.deviceId === currentDeviceId ? 5 : 0);

    if (isLikelyFrontCameraLabel(label)) score -= 100;
    if (isLikelyUltraWideLabel(label)) score -= 80;

    return {
      deviceId: device.deviceId,
      label,
      score,
      stream,
      track,
    };
  } catch {
    return null;
  }
}

async function selectBestRearCameraStream(
  initialStream: MediaStream,
  devices: MediaDeviceInfo[],
  options?: { avoidProbing?: boolean },
): Promise<RearCameraProbeResult> {
  const initialTrack = initialStream.getVideoTracks()[0];
  const initialDeviceId = initialTrack?.getSettings().deviceId ?? "";
  const initialLabel =
    initialTrack?.label ||
    devices.find((device) => device.deviceId === initialDeviceId)?.label ||
    "";

  const initialResult: RearCameraProbeResult = {
    deviceId: initialDeviceId,
    label: initialLabel,
    score:
      scoreCameraDevice(initialLabel) +
      (initialTrack ? scoreRearCameraCapabilities(initialTrack) : 0) +
      10,
    stream: initialStream,
    track: initialTrack!,
  };

  if (options?.avoidProbing || !initialTrack) {
    return initialResult;
  }

  const candidates = listRearCameraCandidates(devices, initialDeviceId)
    .filter((device) => device.deviceId && device.deviceId !== initialDeviceId)
    .slice(0, 3);

  let bestResult = initialResult;

  for (const candidate of candidates) {
    const probed = await probeRearCamera(candidate, initialDeviceId);
    if (!probed) {
      continue;
    }

    if (probed.score > bestResult.score + 8) {
      bestResult.stream.getTracks().forEach((track) => track.stop());
      bestResult = probed;
      continue;
    }

    probed.stream.getTracks().forEach((track) => track.stop());
  }

  return bestResult;
}

export default function StudentScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialData = searchParams.get("data");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<StudentQrParseResult | null>(null);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
    setActiveCameraLabel(null);
  }, []);

  const routeToScanTarget = useCallback((result: StudentQrParseResult) => {
    setLastResult(result);

    if (!result.ok) {
      addToast({
        title: "QR นี้ยังใช้งานไม่ได้",
        description: result.reason,
        color: "warning",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
      return;
    }

    addToast({
      title: result.target.title,
      description: result.target.description,
      color: "success",
      timeout: 2200,
      shouldShowTimeoutProgress: true,
    });

    stopCamera();
    router.push(result.target.href);
  }, [router, stopCamera]);

  const handleDecodedValue = useCallback((value: string) => {
    const result = parseStudentQrPayload(value, typeof window !== "undefined" ? window.location.origin : undefined);
    routeToScanTarget(result);
  }, [routeToScanTarget]);

  const scanLoop = useCallback(() => {
    if (!videoRef.current) return;

    if (window.BarcodeDetector) {
      // Native path — fast
      let detector: InstanceType<BarcodeDetectorConstructor>;
      try {
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        setCameraError("เบราว์เซอร์นี้ยังสแกน QR จากกล้องไม่ได้ กรุณาวางลิงก์หรือ PIN แทน");
        return;
      }

      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          const first = barcodes[0]?.rawValue?.trim();
          if (first) { handleDecodedValue(first); return; }
        } catch { /* warm up */ }
        frameRef.current = window.requestAnimationFrame(() => { void tick(); });
      };
      frameRef.current = window.requestAnimationFrame(() => { void tick(); });
    } else {
      // jsQR fallback — works on Firefox / desktop Chrome
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const tick = () => {
        const video = videoRef.current;
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          frameRef.current = window.requestAnimationFrame(tick);
          return;
        }
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code?.data?.trim()) {
          handleDecodedValue(code.data.trim());
          return;
        }
        frameRef.current = window.requestAnimationFrame(tick);
      };
      frameRef.current = window.requestAnimationFrame(tick);
    }
  }, [handleDecodedValue]);

  const startCamera = useCallback(async () => {
    setIsStartingCamera(true);
    setCameraError(null);

    try {
      stopCamera();

      const initialStream = await getRearCameraBootstrapStream();
      const devices = await navigator.mediaDevices.enumerateDevices();
      const selectedCamera = await selectBestRearCameraStream(initialStream, devices, {
        avoidProbing: shouldAvoidCameraProbing(),
      });
      const stream = selectedCamera.stream;
      const currentTrack = selectedCamera.track;
      const currentDeviceId = selectedCamera.deviceId;

      if (currentTrack) {
        await applyRearCameraTrackPreferences(currentTrack);
      }

      const resolvedLabel =
        currentTrack?.label ||
        devices.find((device) => device.deviceId === currentDeviceId)?.label ||
        selectedCamera.label ||
        null;

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setActiveCameraLabel(resolvedLabel);
      void scanLoop();
    } catch {
      setCameraError("ไม่สามารถเข้าถึงกล้องได้ คุณยังวางลิงก์ QR หรือ PIN คิวได้ด้านล่าง");
    } finally {
      setIsStartingCamera(false);
    }
  }, [scanLoop, stopCamera]);

  useEffect(() => {
    if (initialData) {
      handleDecodedValue(initialData);
    }
  }, [handleDecodedValue, initialData]);

  useEffect(() => {
    if (initialData) {
      return;
    }

    void startCamera();
  }, [initialData, startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const preview = useMemo(() => {
    if (!manualValue.trim()) {
      return null;
    }
    return parseStudentQrPayload(manualValue, typeof window !== "undefined" ? window.location.origin : undefined);
  }, [manualValue]);

  return (
    <div className="space-y-4 pb-2">

      {/* ── Camera viewfinder ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-4xl bg-slate-950 shadow-xl shadow-slate-900/40">

        {/* top bar inside camera card */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">LabTAS</p>
            <p className="mt-0.5 text-base font-bold text-white">สแกน QR</p>
          </div>
          <button
            onClick={() => { if (cameraReady) { stopCamera(); } else { void startCamera(); } }}
            disabled={isStartingCamera}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
              cameraReady
                ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                : "bg-sky-500 text-white hover:bg-sky-400"
            }`}
          >
            {isStartingCamera ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Icon icon={cameraReady ? "solar:close-circle-bold" : "solar:camera-add-bold"} className="text-base" />
            )}
            {isStartingCamera ? "กำลังเปิด..." : cameraReady ? "หยุดกล้อง" : "เปิดกล้อง"}
          </button>
        </div>

        {/* viewfinder */}
        <div className="relative mx-4 mb-4 overflow-hidden rounded-3xl bg-black">
          {/* hidden canvas for jsQR fallback */}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          <video
            ref={videoRef}
            className="h-[42dvh] min-h-[250px] max-h-[360px] w-full object-cover sm:h-auto sm:min-h-0 sm:max-h-none sm:aspect-video"
            muted
            playsInline
            autoPlay
          />

          {/* overlay corners */}
          {!cameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 backdrop-blur-sm">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
                <Icon icon="solar:camera-bold-duotone" className="text-4xl text-white/60" />
              </span>
              <p className="text-sm font-medium text-white/60">
                {cameraError ?? "แตะ 'เปิดกล้อง' เพื่อเริ่มสแกน"}
              </p>
            </div>
          )}

          {/* scanning frame overlay */}
          {cameraReady && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-48 w-48 sm:h-56 sm:w-56">
                {/* corner lines */}
                <span className="absolute left-0 top-0 h-8 w-8 border-l-3 border-t-3 border-sky-400 rounded-tl-lg" />
                <span className="absolute right-0 top-0 h-8 w-8 border-r-3 border-t-3 border-sky-400 rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 h-8 w-8 border-b-3 border-l-3 border-sky-400 rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 h-8 w-8 border-b-3 border-r-3 border-sky-400 rounded-br-lg" />
                {/* scan line */}
                <span className="scan-beam absolute inset-x-1 h-0.5 rounded-full bg-sky-400/80 shadow-[0_0_8px_2px_rgba(14,165,233,0.6)]" />
              </div>
            </div>
          )}
        </div>

        {/* status bar */}
        <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cameraReady ? "animate-pulse bg-emerald-400" : cameraError ? "bg-rose-400" : "bg-amber-400"}`} />
            <p className="text-sm font-medium text-white">
              {cameraReady ? "กำลังสแกน..." : cameraError ? "เกิดข้อผิดพลาด" : "ยังไม่พร้อม"}
            </p>
          </div>
          {cameraReady && (
            <p className="text-xs text-slate-400">หันกล้องไปที่ QR</p>
          )}
          {cameraError && (
            <p className="max-w-[60%] text-right text-xs text-slate-400">{cameraError}</p>
          )}
        </div>
      </div>

      {/* ── Manual entry ──────────────────────────────────────────────── */}
      <div className="rounded-4xl border border-slate-100 bg-white/90 p-5 shadow-sm shadow-slate-100">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50">
            <Icon icon="solar:keyboard-bold-duotone" className="text-xl text-sky-600" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">กรอก PIN หรือวางลิงก์</p>
            <p className="text-xs text-slate-400">ใช้เมื่อกล้องเปิดไม่ได้หรือมีข้อมูล QR อยู่แล้ว</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Input
            value={manualValue}
            onValueChange={setManualValue}
            placeholder="PIN 6 หลัก หรือวางลิงก์ QR"
            onKeyDown={(e) => { if (e.key === "Enter" && manualValue.trim()) handleDecodedValue(manualValue); }}
            classNames={{
              inputWrapper: "h-12 rounded-2xl border border-slate-200 bg-slate-50 shadow-none data-[focused=true]:border-sky-400",
              input: "text-slate-900 placeholder:text-slate-400",
            }}
          />
          <button
            onClick={() => handleDecodedValue(manualValue)}
            disabled={!manualValue.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm transition hover:bg-sky-500 active:scale-95 disabled:opacity-40"
          >
            <Icon icon="solar:arrow-right-bold" className="text-xl" />
          </button>
        </div>

        {preview && (
          <div className={`mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${preview.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
            <Icon icon={preview.ok ? "solar:check-circle-bold" : "solar:danger-triangle-bold"} className="shrink-0 text-lg" />
            <span>{preview.ok ? `พร้อมเปิด: ${preview.target.title}` : preview.reason}</span>
          </div>
        )}
      </div>

      {/* ── Last result ───────────────────────────────────────────────── */}
      {lastResult?.ok && (
        <div className="flex items-center gap-3 rounded-4xl border border-sky-100 bg-sky-50/80 px-5 py-4">
          <Icon icon="solar:history-bold-duotone" className="text-xl text-sky-600" />
          <div>
            <p className="text-xs font-semibold text-sky-700/70 uppercase tracking-wide">สแกนล่าสุด</p>
            <p className="mt-0.5 text-sm font-semibold text-sky-900">{lastResult.target.title}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes beam {
          0%   { top: 15%; }
          50%  { top: 80%; }
          100% { top: 15%; }
        }
        .scan-beam {
          position: absolute;
          animation: beam 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

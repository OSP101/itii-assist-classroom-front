"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";

import jsQR from "jsqr";
import { parseStudentQrPayload, type StudentQrParseResult } from "@/lib/qr-deeplink";
import { API_BASE_URL } from "@/config/api";
import attendanceService from "@/services/attendance.service";

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
  const [pinDigits, setPinDigits] = useState<string[]>(() => Array(6).fill(""));
  const [linkValue, setLinkValue] = useState("");
  const pinInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<StudentQrParseResult | null>(null);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string | null>(null);
  const [isResolvingPin, setIsResolvingPin] = useState(false);

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

  const resolvePinTarget = useCallback(async (pin: string): Promise<StudentQrParseResult> => {
    try {
      const attendance = await attendanceService.verifyPin(pin);
      if (attendance?.session_id) {
        return {
          ok: true,
          target: {
            kind: "attendance",
            href: `/check-in/${encodeURIComponent(String(attendance.session_id))}`,
            title: "เช็กชื่อเข้าเรียน",
            description: `เปิดหน้าเช็กชื่อด้วย PIN ${pin}`,
          },
        };
      }
    } catch {
      // Fall through to queue lookup.
    }

    try {
      const response = await fetch(`${API_BASE_URL}/queue/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin_code: pin }),
      });
      const result = await response.json();

      if (result.success) {
        return {
          ok: true,
          target: {
            kind: "queue",
            href: `/queue/book?pin=${encodeURIComponent(pin)}`,
            title: "จองคิว",
            description: `เปิดหน้าจองคิวด้วย PIN ${pin}`,
          },
        };
      }
    } catch {
      // Ignore and return a user-friendly error below.
    }

    return {
      ok: false,
      reason: "PIN ไม่ถูกต้อง หรือไม่มีการเปิดรับจองคิว/เช็กชื่อ",
    };
  }, []);

  const handleDecodedValue = useCallback(async (value: string) => {
    const raw = value.trim();
    if (/^\d{6}$/.test(raw)) {
      setIsResolvingPin(true);
      try {
        const result = await resolvePinTarget(raw);
        routeToScanTarget(result);
      } finally {
        setIsResolvingPin(false);
      }
      return;
    }

    const result = parseStudentQrPayload(value, typeof window !== "undefined" ? window.location.origin : undefined);
    routeToScanTarget(result);
  }, [resolvePinTarget, routeToScanTarget]);

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
      void handleDecodedValue(initialData);
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

  const pinCode = pinDigits.join("");
  const isPinComplete = pinCode.length === 6;

  const focusPin = (index: number) => {
    pinInputsRef.current[index]?.focus();
  };

  const handlePinChange = (index: number, raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) {
      setPinDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    // Pasting the whole PIN into any box should fill the row, not just one cell.
    setPinDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        next[index + i] = digits[i];
      }
      return next;
    });
    focusPin(Math.min(index + digits.length, 5));
  };

  const handlePinKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !pinDigits[index] && index > 0) {
      event.preventDefault();
      focusPin(index - 1);
      setPinDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
    }
  };

  const submitPin = () => {
    if (!isPinComplete || isResolvingPin) return;
    void handleDecodedValue(pinCode);
  };

  const submitLink = () => {
    if (!linkValue.trim() || isResolvingPin) return;
    void handleDecodedValue(linkValue);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="cg-page-title">สแกน</h1>

      {/* ── viewfinder ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[20px]" style={{ background: "#0a0e18", boxShadow: "var(--cg-shadow-1)" }}>
        <div className="flex items-center justify-between gap-2.5 px-3.5 pt-3.5">
          <b className="text-sm font-medium text-white">สแกน QR เข้าเรียน</b>
          <button
            type="button"
            onClick={() => { if (cameraReady) { stopCamera(); } else { void startCamera(); } }}
            disabled={isStartingCamera}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[11.5px] font-normal text-white disabled:opacity-60"
            style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.18)", backdropFilter: "blur(14px)" }}
          >
            {isStartingCamera ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Icon icon={cameraReady ? "solar:close-circle-linear" : "solar:camera-add-linear"} width={13} height={13} />
            )}
            {isStartingCamera ? "กำลังเปิด" : cameraReady ? "หยุดกล้อง" : "เปิดกล้อง"}
          </button>
        </div>

        <div className="relative m-3 h-[214px] overflow-hidden rounded-[18px]" style={{ background: "radial-gradient(circle at 50% 42%,#1b2438,#05070e)" }}>
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />

          {!cameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: "rgba(5,7,14,.82)" }}>
              <Icon icon="solar:camera-linear" width={34} height={34} className="text-white/50" />
              <p className="text-[12.5px] font-light leading-relaxed text-white/60">
                {cameraError ?? "แตะปุ่มเปิดกล้องเพื่อเริ่มสแกน"}
              </p>
            </div>
          )}

          {cameraReady && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[152px] w-[152px]">
                <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-[2.5px] border-t-[2.5px]" style={{ borderColor: "var(--cg-accent)" }} />
                <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-[2.5px] border-t-[2.5px]" style={{ borderColor: "var(--cg-accent)" }} />
                <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-[2.5px] border-l-[2.5px]" style={{ borderColor: "var(--cg-accent)" }} />
                <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-[2.5px] border-r-[2.5px]" style={{ borderColor: "var(--cg-accent)" }} />
                <span className="scan-beam absolute inset-x-1 h-0.5 rounded-full" style={{ background: "var(--cg-accent)" }} />
              </div>
            </div>
          )}
        </div>

        <div className="mx-3 mb-3.5 flex items-center justify-between gap-2.5 rounded-[13px] px-3 py-2.5" style={{ background: "rgba(255,255,255,.07)" }}>
          <span className="flex items-center gap-2 text-xs font-normal text-white">
            <span
              className={`h-[7px] w-[7px] shrink-0 rounded-full ${cameraReady ? "animate-pulse" : ""}`}
              style={{ background: cameraReady ? "#4ade80" : cameraError ? "#f87171" : "#fbbf24" }}
            />
            {cameraReady ? "กำลังสแกน" : cameraError ? "เกิดข้อผิดพลาด" : "ยังไม่เปิดกล้อง"}
          </span>
          <span className="text-[10.5px] font-light text-white/55">
            {cameraReady ? "หันกล้องไปที่ QR หน้าห้อง" : ""}
          </span>
        </div>
      </div>

      {/* ── PIN ────────────────────────────────────────────────────── */}
      <div className="cg-card">
        <p className="cg-section-label" style={{ padding: 0 }}>กรอกรหัส PIN 6 หลัก</p>
        <p className="mb-3.5 mt-1.5 text-[11.5px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
          ใช้เมื่อกล้องเปิดไม่ได้ โดยอาจารย์จะแจ้งรหัสที่หน้าห้องหรือบนจอฉาย
        </p>

        <div className="cg-pin-wrap">
          {pinDigits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { pinInputsRef.current[index] = el; }}
              className="cg-pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={digit}
              aria-label={`PIN หลักที่ ${index + 1}`}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handlePinKeyDown(index, e)}
            />
          ))}
        </div>

        <button
          type="button"
          className="cg-btn mt-3.5"
          disabled={!isPinComplete || isResolvingPin}
          onClick={submitPin}
        >
          {isResolvingPin ? "กำลังตรวจสอบ" : "ยืนยันรหัส"}
        </button>
      </div>

      {/* ── link fallback ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
        <span className="h-px flex-1" style={{ background: "var(--cg-line)" }} />
        หรือวางลิงก์ QR
        <span className="h-px flex-1" style={{ background: "var(--cg-line)" }} />
      </div>

      <div className="flex gap-2">
        <div className="cg-field-box flex-1">
          <Icon icon="solar:link-linear" width={17} height={17} style={{ color: "var(--cg-text-3)" }} />
          <input
            type="text"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitLink(); }}
            placeholder="วางลิงก์ที่ได้รับจากอาจารย์"
            aria-label="ลิงก์ QR"
          />
        </div>
        <button
          type="button"
          onClick={submitLink}
          disabled={!linkValue.trim() || isResolvingPin}
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] text-white disabled:opacity-40"
          style={{ background: "var(--cg-accent)" }}
          aria-label="เปิดลิงก์"
        >
          <Icon icon="solar:arrow-right-linear" width={19} height={19} />
        </button>
      </div>

      {lastResult?.ok && (
        <div className="cg-list">
          <div className="cg-row">
            <span className="cg-row-ico" style={{ background: "var(--cg-info-soft)", color: "var(--cg-info)" }}>
              <Icon icon="solar:history-linear" width={17} height={17} />
            </span>
            <span className="cg-row-body">
              <span className="cg-row-sub" style={{ marginTop: 0 }}>สแกนล่าสุด</span>
              <span className="cg-row-title">{lastResult.target.title}</span>
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes beam {
          0%   { top: 8%; }
          50%  { top: 88%; }
          100% { top: 8%; }
        }
        .scan-beam {
          position: absolute;
          animation: beam 2.2s ease-in-out infinite;
          box-shadow: 0 0 12px 2px rgba(96, 165, 250, 0.65);
        }
        @media (prefers-reduced-motion: reduce) {
          .scan-beam { animation: none; top: 50%; }
        }
      `}</style>
    </div>
  );
}

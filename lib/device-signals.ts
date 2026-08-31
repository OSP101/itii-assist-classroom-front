/**
 * Best-effort device signals sent alongside a check-in request.
 *
 * None of this gates check-in, and none of it is trustworthy: it all travels
 * in the request body, so anyone who can forge a User-Agent can forge these
 * too. The campus network guard (device/network/domain, evaluated server-side)
 * remains the only actual control. This payload just makes a careless spoof
 * visible in the audit log.
 *
 * Be clear about the limits before adding a signal here:
 *  - Chrome DevTools device toolbar emulates touch, maxTouchPoints,
 *    (pointer: coarse), screen size and devicePixelRatio, and for a preset
 *    device it rewrites the UA client hints too. Those fields cannot catch it.
 *  - `platform` / `mobile` come from navigator.userAgentData, which a plain
 *    UA-switcher extension or a hand-typed custom UA does not rewrite. That is
 *    the one contradiction worth raising severity for, server-side.
 *  - `motion` stays false under DevTools unless sensor emulation is switched
 *    on, but also on a real iPhone whose motion permission was never granted,
 *    so it is a weak hint on its own.
 *
 * See ClientDeviceSignals and clientSignalMismatchReasons on the backend.
 */
export interface ClientDeviceSignals {
  touch: boolean;
  coarse_pointer: boolean;
  motion: boolean;
  /** navigator.userAgentData.platform, "" where UA client hints are unsupported (Safari, Firefox). */
  platform: string;
  /** navigator.userAgentData.mobile, null where UA client hints are unsupported. */
  mobile: boolean | null;
  hardware_cores: number;
  screen_w: number;
  screen_h: number;
  dpr: number;
}

/** The slice of navigator.userAgentData this file reads. Not in lib.dom yet. */
interface UserAgentDataLike {
  platform?: string;
  mobile?: boolean;
}

function readUserAgentData(): UserAgentDataLike | null {
  if (typeof navigator === "undefined") return null;
  const data = (navigator as Navigator & { userAgentData?: UserAgentDataLike }).userAgentData;
  return data && typeof data === "object" ? data : null;
}

function hasTouchSupport(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
}

function hasCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * Listens passively for one real motion/orientation event. Does not request
 * iOS 13+ motion permission — that requires its own user-gesture-triggered
 * prompt, which would add a disruptive extra step to check-in just to
 * populate a soft signal. Resolves `false` on timeout, no listener, or a
 * denied/unsupported browser.
 */
function observeMotionEvent(timeoutMs: number): Promise<boolean> {
  if (typeof window === "undefined" || (!("DeviceMotionEvent" in window) && !("DeviceOrientationEvent" in window))) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrientation);
      clearTimeout(timer);
      resolve(value);
    };
    const onMotion = (e: DeviceMotionEvent) => {
      if (e.acceleration?.x != null || e.accelerationIncludingGravity?.x != null || e.rotationRate?.alpha != null) {
        finish(true);
      }
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha != null || e.beta != null || e.gamma != null) finish(true);
    };

    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrientation);
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

/** Header name the campus guard reads these hints from. Must match utils.DeviceHintsHeader. */
export const DEVICE_HINTS_HEADER = "X-Client-Device-Hints";

/**
 * Builds the device-hints header the campus network guard needs to recognise an
 * iPad.
 *
 * Since iPadOS 13 Safari sends a MacBook User-Agent by default, so server-side
 * UA parsing classifies every stock iPad as a desktop and the guard's device
 * check rejects it — students on iPads could not check in at all. No Mac has
 * ever had a touchscreen, so touch plus a coarse pointer is what separates the
 * two, and only the browser can report that.
 *
 * Synchronous and cheap on purpose: unlike collectClientDeviceSignals this runs
 * on the blocking path of the session-info request, so it must not wait on a
 * motion event.
 */
export function buildDeviceHintsHeader(): string {
  if (typeof window === "undefined") return "";
  const maxTouchPoints = typeof navigator !== "undefined" ? (navigator.maxTouchPoints ?? 0) : 0;
  return [
    `touch=${hasTouchSupport() ? 1 : 0}`,
    `coarse=${hasCoarsePointer() ? 1 : 0}`,
    `maxtouch=${maxTouchPoints}`,
  ].join(";");
}

/** Collects every signal. Never throws, never blocks longer than `motionTimeoutMs`. */
export async function collectClientDeviceSignals(motionTimeoutMs = 400): Promise<ClientDeviceSignals> {
  const motion = await observeMotionEvent(motionTimeoutMs);
  const uaData = readUserAgentData();
  const screenSize = typeof window !== "undefined" && window.screen ? window.screen : null;

  return {
    touch: hasTouchSupport(),
    coarse_pointer: hasCoarsePointer(),
    motion,
    platform: typeof uaData?.platform === "string" ? uaData.platform.slice(0, 64) : "",
    mobile: typeof uaData?.mobile === "boolean" ? uaData.mobile : null,
    hardware_cores: typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 0) : 0,
    screen_w: screenSize?.width ?? 0,
    screen_h: screenSize?.height ?? 0,
    dpr: typeof window !== "undefined" ? (window.devicePixelRatio ?? 0) : 0,
  };
}

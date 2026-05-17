export type StudentQrTarget = {
  kind: "attendance" | "queue" | "desk";
  href: string;
  title: string;
  description: string;
};

export type StudentQrParseResult =
  | { ok: true; target: StudentQrTarget }
  | { ok: false; reason: string };

function buildQueueTarget(pin: string): StudentQrParseResult {
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

function buildDeskTarget(deskId: string): StudentQrParseResult {
  return {
    ok: true,
    target: {
      kind: "desk",
      href: `/desk/${encodeURIComponent(deskId)}`,
      title: "สแกนโต๊ะ",
      description: `ตรวจสอบโต๊ะ ${deskId}`,
    },
  };
}

function buildAttendanceTarget(sessionId: string): StudentQrParseResult {
  return {
    ok: true,
    target: {
      kind: "attendance",
      href: `/check-in/${encodeURIComponent(sessionId)}`,
      title: "เช็กชื่อเข้าเรียน",
      description: `เปิดหน้าเช็กชื่อสำหรับรหัส ${sessionId}`,
    },
  };
}

export function parseStudentQrPayload(rawValue: string, origin?: string): StudentQrParseResult {
  const raw = rawValue.trim();
  if (!raw) {
    return { ok: false, reason: "ไม่พบข้อมูลใน QR" };
  }

  if (/^\d{6}$/.test(raw)) {
    return buildQueueTarget(raw);
  }

  const effectiveOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "http://localhost");

  try {
    const url = new URL(raw, effectiveOrigin);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    const checkInMatch = pathname.match(/^\/check-in\/([^/]+)$/);
    if (checkInMatch) {
      return buildAttendanceTarget(checkInMatch[1]);
    }

    const deskMatch = pathname.match(/^\/desk\/([^/]+)$/);
    if (deskMatch) {
      return buildDeskTarget(deskMatch[1]);
    }

    if (pathname === "/queue/book") {
      const pin = url.searchParams.get("pin")?.trim();
      if (pin) {
        return buildQueueTarget(pin);
      }
      return { ok: false, reason: "QR สำหรับคิวไม่มี PIN" };
    }

    if (pathname === "/m/pair" || pathname.startsWith("/display/live")) {
      return { ok: false, reason: "QR นี้ใช้สำหรับหน้าจอผู้สอน ไม่ใช่การใช้งานของนักศึกษา" };
    }

    if (url.protocol === "itii-assist:" || url.protocol === "itiiassist:") {
      const customPath = `${url.hostname}${url.pathname}`.replace(/\/+$/, "");
      const customCheckInMatch = customPath.match(/^check-in\/([^/]+)$/);
      if (customCheckInMatch) {
        return buildAttendanceTarget(customCheckInMatch[1]);
      }
      const customDeskMatch = customPath.match(/^desk\/([^/]+)$/);
      if (customDeskMatch) {
        return buildDeskTarget(customDeskMatch[1]);
      }
      if (customPath === "queue/book") {
        const pin = url.searchParams.get("pin")?.trim();
        if (pin) {
          return buildQueueTarget(pin);
        }
      }
    }
  } catch {
    return { ok: false, reason: "รูปแบบ QR ไม่ถูกต้อง" };
  }

  return { ok: false, reason: "QR นี้ยังไม่รองรับการใช้งานสำหรับนักศึกษา" };
}
/**
 * Rules for creating an attendance session: what blocks saving, what deserves a
 * second look, and what is only information. The create modal runs them on
 * every change; the backend repeats the blocking ones
 * (handlers/attendance_session_rules.go), so keep the numbers in step.
 */

export const MIN_OPEN_MINUTES = 5;
export const MAX_AHEAD_DAYS = 180;
export const FAR_AHEAD_DAYS = 14;
export const LONG_OPEN_MINUTES = 240;
export const SHORT_LEFT_MINUTES = 15;
export const CLASS_DAY_START_HOUR = 7;
export const CLASS_DAY_END_HOUR = 21;
export const MIN_RADIUS = 10;
export const MAX_RADIUS = 1000;

export interface CampusArea {
    name: string;
    nameEn: string;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

/**
 * Bounding boxes of KKU's campuses from OpenStreetMap (relation 812288, way
 * 545371029). Mirrors utils/campus_area.go on the backend.
 */
export const KKU_CAMPUS_AREAS: CampusArea[] = [
    { name: "มหาวิทยาลัยขอนแก่น", nameEn: "Khon Kaen University", minLat: 16.4413317, maxLat: 16.4821091, minLng: 102.802341, maxLng: 102.8323324 },
    { name: "มหาวิทยาลัยขอนแก่น วิทยาเขตหนองคาย", nameEn: "KKU Nong Khai Campus", minLat: 17.7966963, maxLat: 17.8122636, minLng: 102.742738, maxLng: 102.7518092 },
];

/** About 220 m; keeps a pin on an edge building, or a slightly-off GPS fix, on campus. */
const CAMPUS_MARGIN_DEG = 0.002;
const KM_PER_DEG_LAT = 111;

function kmPerDegLng(lat: number): number {
    return 111.32 * Math.cos((lat * Math.PI) / 180);
}

export function insideKKUCampus(lat: number, lng: number): boolean {
    return KKU_CAMPUS_AREAS.some(
        (a) =>
            lat >= a.minLat - CAMPUS_MARGIN_DEG && lat <= a.maxLat + CAMPUS_MARGIN_DEG &&
            lng >= a.minLng - CAMPUS_MARGIN_DEG && lng <= a.maxLng + CAMPUS_MARGIN_DEG,
    );
}

/** Distance in km from a point to the nearest campus box (0 when inside). */
export function distanceToCampusKm(lat: number, lng: number): number {
    return Math.min(
        ...KKU_CAMPUS_AREAS.map((a) => {
            const dLat = Math.max(a.minLat - lat, 0, lat - a.maxLat) * KM_PER_DEG_LAT;
            const dLng = Math.max(a.minLng - lng, 0, lng - a.maxLng) * kmPerDegLng(lat);
            return Math.sqrt(dLat * dLat + dLng * dLng);
        }),
    );
}

function circleLeavesCampus(lat: number, lng: number, radiusM: number): boolean {
    const area = KKU_CAMPUS_AREAS.find((a) => lat >= a.minLat && lat <= a.maxLat && lng >= a.minLng && lng <= a.maxLng);
    if (!area) return false;
    const rLat = radiusM / 1000 / KM_PER_DEG_LAT;
    const rLng = radiusM / 1000 / kmPerDegLng(lat);
    return lat - rLat < area.minLat || lat + rLat > area.maxLat || lng - rLng < area.minLng || lng + rLng > area.maxLng;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

export function toDateInput(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toTimeInput(d: Date): string {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function combineLocal(date: string, time: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
    const d = new Date(`${date}T${time}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Adds minutes to an HH:mm clock, capped at 23:59 so a shortcut never crosses midnight. */
export function addMinutesToClock(time: string, minutes: number): string {
    const base = combineLocal("2000-01-01", time);
    if (!base) return time;
    const next = new Date(base.getTime() + minutes * 60000);
    if (next.getDate() !== base.getDate()) return "23:59";
    return toTimeInput(next);
}

export function minutesBetweenClocks(from: string, to: string): number {
    const a = combineLocal("2000-01-01", from);
    const b = combineLocal("2000-01-01", to);
    return a && b ? Math.round((b.getTime() - a.getTime()) / 60000) : 0;
}

export function formatSpan(ms: number, isEnglish: boolean): string {
    const total = Math.round(Math.abs(ms) / 60000);
    const d = Math.floor(total / 1440);
    const h = Math.floor((total % 1440) / 60);
    const m = total % 60;
    const parts: string[] = [];
    if (isEnglish) {
        if (d) parts.push(`${d} day${d === 1 ? "" : "s"}`);
        if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
        if (m || !parts.length) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
        return parts.join(" ");
    }
    if (d) parts.push(`${d} วัน`);
    if (h) parts.push(`${h} ชั่วโมง`);
    if (m || !parts.length) parts.push(`${m} นาที`);
    return parts.join(" ");
}

export function formatShortSpan(ms: number, isEnglish: boolean): string {
    const total = Math.round(Math.abs(ms) / 60000);
    const d = Math.floor(total / 1440);
    const h = Math.floor((total % 1440) / 60);
    const m = total % 60;
    if (isEnglish) {
        if (d) return `${d}d${h ? ` ${h}h` : ""}`;
        if (h) return `${h}h${m ? ` ${m}m` : ""}`;
        return `${m}m`;
    }
    if (d) return `${d} วัน${h ? ` ${h} ชม.` : ""}`;
    if (h) return `${h} ชม.${m ? ` ${m} นาที` : ""}`;
    return `${m} นาที`;
}

export function formatDayLabel(d: Date, isEnglish: boolean): string {
    return d.toLocaleDateString(isEnglish ? "en-US" : "th-TH", { weekday: "short", day: "numeric", month: "short" });
}

export function formatClock(d: Date, isEnglish: boolean): string {
    return isEnglish ? toTimeInput(d) : `${toTimeInput(d)} น.`;
}

// ---------------------------------------------------------------------------
// Time rules
// ---------------------------------------------------------------------------

export type RuleTone = "block" | "warn" | "info";

export interface RuleMessage {
    tone: RuleTone;
    text: string;
}

export interface ExistingSessionWindow {
    title: string;
    start: Date;
    end: Date;
    sectionIds: number[];
}

export interface TimeInput {
    date: string;
    start: string;
    late: string;
    end: string;
    sectionIds: number[];
}

export type TimeState = "blocked" | "future" | "now" | "running";

export interface TimeCheck {
    state: TimeState;
    messages: RuleMessage[];
    blocked: boolean;
    bad: { date?: boolean; start?: boolean; late?: boolean; end?: boolean };
    startAt: Date | null;
    lateAt: Date | null;
    endAt: Date | null;
}

export function checkTime(input: TimeInput, now: Date, existing: ExistingSessionWindow[], isEnglish: boolean): TimeCheck {
    const t = (th: string, en: string) => (isEnglish ? en : th);
    const blocks: string[] = [];
    const warns: string[] = [];
    const infos: string[] = [];
    let lead: RuleMessage | null = null;
    const bad: TimeCheck["bad"] = {};
    const done = (state: TimeState, startAt: Date | null = null, lateAt: Date | null = null, endAt: Date | null = null): TimeCheck => {
        const messages: RuleMessage[] = [
            ...blocks.map((text) => ({ tone: "block" as const, text })),
            ...(lead ? [lead] : []),
            ...warns.map((text) => ({ tone: "warn" as const, text })),
            ...infos.map((text) => ({ tone: "info" as const, text })),
        ];
        return { state, messages, blocked: state === "blocked", bad, startAt, lateAt, endAt };
    };

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        blocks.push(t("เลือกวันที่", "Choose a date."));
        bad.date = true;
        return done("blocked");
    }
    const a = combineLocal(input.date, input.start);
    const l = combineLocal(input.date, input.late);
    const e = combineLocal(input.date, input.end);
    if (!a || !l || !e) {
        blocks.push(t("กรอกเวลาเปิดรับ เวลานับสาย และเวลาปิดรับให้ครบ", "Fill in the open, late cutoff and close times."));
        bad.start = !a;
        bad.late = !l;
        bad.end = !e;
        return done("blocked");
    }

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const day = new Date(`${input.date}T00:00:00`);
    const aheadDays = Math.round((day.getTime() - today.getTime()) / 86400000);
    const clock = (d: Date) => formatClock(d, isEnglish);

    if (aheadDays > MAX_AHEAD_DAYS) {
        blocks.push(t(`วันที่ห่างจากวันนี้เกิน ${MAX_AHEAD_DAYS} วัน น่าจะพิมพ์ผิด`, `The date is more than ${MAX_AHEAD_DAYS} days away. It looks like a typo.`));
        bad.date = true;
    }
    if (e <= a) {
        blocks.push(t("เวลาปิดรับต้องอยู่หลังเวลาเปิดรับ", "The close time must be after the open time."));
        bad.end = true;
    } else if ((e.getTime() - a.getTime()) / 60000 < MIN_OPEN_MINUTES) {
        blocks.push(t(`ต้องเปิดรับอย่างน้อย ${MIN_OPEN_MINUTES} นาที`, `Keep check-in open for at least ${MIN_OPEN_MINUTES} minutes.`));
        bad.end = true;
    }
    if (l < a || l > e) {
        blocks.push(t("เวลานับสายต้องอยู่ระหว่างเวลาเปิดรับกับเวลาปิดรับ", "The late cutoff must be between the open and close times."));
        bad.late = true;
    }
    if (e > a && e <= now) {
        blocks.push(
            aheadDays < 0
                ? t("วันที่นี้ผ่านไปแล้ว สร้างรอบย้อนหลังไม่ได้", "This date has passed. Sessions cannot be created in the past.")
                : t(`ช่วงเวลานี้ปิดรับไปแล้วตั้งแต่ ${clock(e)} สร้างรอบย้อนหลังไม่ได้`, `This window already closed at ${clock(e)}. Sessions cannot be created in the past.`),
        );
        bad.end = true;
        if (aheadDays < 0) bad.date = true;
    }
    if (blocks.length) return done("blocked");

    let state: TimeState;
    if (a > now) {
        state = "future";
        lead = {
            tone: "info",
            text: t(
                `อีก ${formatSpan(a.getTime() - now.getTime(), false)} จะเปิดรับเช็กชื่อ (${formatDayLabel(a, false)} ${clock(a)}) ระบบเปิดให้เองเมื่อถึงเวลา`,
                `Check-in opens in ${formatSpan(a.getTime() - now.getTime(), true)} (${formatDayLabel(a, true)} ${clock(a)}). It opens on its own.`,
            ),
        };
    } else if (now.getTime() - a.getTime() < 60000) {
        state = "now";
        lead = { tone: "info", text: t(`เปิดรับเช็กชื่อทันทีที่กดสร้าง จนถึง ${clock(e)}`, `Check-in opens as soon as you create it, until ${clock(e)}.`) };
    } else {
        state = "running";
        lead = {
            tone: "warn",
            text: t(
                `เวลาเปิดรับ ${clock(a)} ผ่านมาแล้ว ${formatSpan(now.getTime() - a.getTime(), false)} แต่ยังอยู่ในช่วงเช็กชื่อ สร้างได้ และจะเปิดรับทันทีจนถึง ${clock(e)}`,
                `The open time ${clock(a)} passed ${formatSpan(now.getTime() - a.getTime(), true)} ago, but the window is still open. You can create it, and check-in opens right away until ${clock(e)}.`,
            ),
        };
        if (now >= l && l < e) {
            warns.push(t(
                `เลยเวลานับสาย ${clock(l)} แล้ว นักศึกษาที่เช็กชื่อหลังสร้างรอบจะถูกนับว่าสายทุกคน`,
                `The late cutoff ${clock(l)} has passed. Everyone who checks in from now on will be marked late.`,
            ));
        }
        if ((e.getTime() - now.getTime()) / 60000 < SHORT_LEFT_MINUTES) {
            warns.push(t(`เหลือเวลาเปิดรับอีกเพียง ${formatSpan(e.getTime() - now.getTime(), false)}`, `Only ${formatSpan(e.getTime() - now.getTime(), true)} of check-in time is left.`));
        }
    }

    const openMinutes = (e.getTime() - a.getTime()) / 60000;
    if (openMinutes > LONG_OPEN_MINUTES) {
        warns.push(t(`เปิดรับนาน ${formatSpan(e.getTime() - a.getTime(), false)} นานกว่าคาบปกติ ตรวจเวลาปิดรับอีกครั้ง`, `Check-in stays open for ${formatSpan(e.getTime() - a.getTime(), true)}, longer than a usual class. Check the close time.`));
    }
    if (l.getTime() === a.getTime()) {
        warns.push(t("ไม่มีช่วงตรงเวลา นักศึกษาทุกคนจะถูกนับว่าสาย", "There is no on-time window. Everyone will be marked late."));
    }
    if (l.getTime() === e.getTime()) {
        infos.push(t("ไม่มีช่วงนับสาย ทุกคนที่เช็กชื่อทันจะนับว่าตรงเวลา", "There is no late window. Everyone who checks in will be on time."));
    }
    if (aheadDays > FAR_AHEAD_DAYS) {
        warns.push(t(`เริ่มอีก ${aheadDays} วัน ตรวจวันที่อีกครั้ง`, `This starts in ${aheadDays} days. Check the date.`));
    }
    const endsLate = e.getHours() > CLASS_DAY_END_HOUR || (e.getHours() === CLASS_DAY_END_HOUR && e.getMinutes() > 0);
    if (a.getHours() < CLASS_DAY_START_HOUR || endsLate) {
        warns.push(t(
            `ช่วง ${clock(a)} ถึง ${clock(e)} อยู่นอกเวลาเรียนปกติ (07:00 ถึง 21:00 น.)`,
            `${clock(a)} to ${clock(e)} is outside usual class hours (07:00 to 21:00).`,
        ));
    }
    const weekday = a.getDay();
    if (weekday === 0 || weekday === 6) {
        infos.push(t(`ตรงกับวัน${weekday === 0 ? "อาทิตย์" : "เสาร์"}`, `This falls on a ${weekday === 0 ? "Sunday" : "Saturday"}.`));
    }
    for (const x of existing) {
        const shared = x.sectionIds.some((id) => input.sectionIds.includes(id));
        if (shared && a < x.end && e > x.start) {
            warns.push(t(
                `ช่วงเวลาทับกับรอบ "${x.title}" (${clock(x.start)} ถึง ${clock(x.end)}) ของกลุ่มเรียนเดียวกัน`,
                `This overlaps "${x.title}" (${clock(x.start)} to ${clock(x.end)}) for the same section.`,
            ));
        }
    }
    return done(state, a, l, e);
}

// ---------------------------------------------------------------------------
// Security rules
// ---------------------------------------------------------------------------

export interface SecurityInput {
    sessionType: "lecture" | "lab" | "online";
    pin: "rotating" | "static";
    requireMobile: boolean;
    requireNetwork: boolean;
    gps: boolean;
    lat?: number;
    lng?: number;
    radius: number;
}

export interface SecurityCheck {
    messages: RuleMessage[];
    blocked: boolean;
    bad: { mobile?: boolean; network?: boolean; gps?: boolean };
    /** 0 to 4: one point each for rotating PIN, mobile only, campus network, GPS. */
    level: number;
}

export function checkSecurity(s: SecurityInput, isEnglish: boolean): SecurityCheck {
    const t = (th: string, en: string) => (isEnglish ? en : th);
    const blocks: string[] = [];
    const warns: string[] = [];
    const infos: string[] = [];
    const bad: SecurityCheck["bad"] = {};
    const online = s.sessionType === "online";
    const hasPin = s.gps && typeof s.lat === "number" && typeof s.lng === "number";

    if (online && s.requireNetwork) {
        blocks.push(t("รอบออนไลน์นักศึกษาเรียนจากที่อื่น จะบังคับเครือข่าย มข. ไม่ได้", "Online sessions are attended from elsewhere, so they cannot require the KKU network."));
        bad.network = true;
    }
    if (online && s.gps) {
        blocks.push(t("รอบออนไลน์นักศึกษาอยู่คนละที่ จะเปิดตรวจ GPS ไม่ได้", "Online students are in different places, so GPS cannot be checked."));
        bad.gps = true;
    }
    if (s.gps && !hasPin) {
        blocks.push(t("เปิดตรวจ GPS แต่ยังไม่ได้ปักหมุด ปักหมุดบนแผนที่หรือกดใช้ตำแหน่งปัจจุบัน", "GPS is on but no pin is placed. Click the map or use your current location."));
        bad.gps = true;
    }
    if (s.gps && (s.radius < MIN_RADIUS || s.radius > MAX_RADIUS)) {
        blocks.push(t(`รัศมีต้องอยู่ระหว่าง ${MIN_RADIUS} ถึง ${MAX_RADIUS} เมตร`, `The radius must be between ${MIN_RADIUS} and ${MAX_RADIUS} metres.`));
        bad.gps = true;
    }
    if (hasPin && s.requireNetwork && !insideKKUCampus(s.lat!, s.lng!)) {
        const km = distanceToCampusKm(s.lat!, s.lng!).toFixed(1);
        blocks.push(t(
            `บังคับใช้เครือข่าย มข. แต่หมุด GPS อยู่นอกมหาวิทยาลัย (ห่างประมาณ ${km} กม.) นักศึกษาจะเช็กชื่อไม่ได้เลย ย้ายหมุดเข้าในมหาวิทยาลัย หรือปิดการบังคับเครือข่าย`,
            `The KKU network is required but the GPS pin is off campus (about ${km} km away), so nobody could check in. Move the pin onto campus or stop requiring the network.`,
        ));
        bad.gps = true;
        bad.network = true;
    }

    if (!blocks.length) {
        if (hasPin && !insideKKUCampus(s.lat!, s.lng!)) {
            warns.push(t("หมุด GPS อยู่นอกมหาวิทยาลัย ตรวจว่าเรียนนอกสถานที่จริง", "The GPS pin is off campus. Check that this class really meets off site."));
        } else if (hasPin && circleLeavesCampus(s.lat!, s.lng!, s.radius)) {
            warns.push(t(`รัศมี ${s.radius} เมตรเลยออกนอกมหาวิทยาลัย นักศึกษาที่อยู่นอกรั้วอาจเช็กชื่อได้ ลดรัศมีลง`, `A ${s.radius} m radius reaches beyond campus, so students outside could check in. Reduce the radius.`));
        }
        if (s.gps && s.radius >= 200) {
            warns.push(t(`รัศมี ${s.radius} เมตรกว้างกว่าห้องเรียนทั่วไป นักศึกษาที่ยังไม่เข้าห้องอาจเช็กชื่อได้`, `A ${s.radius} m radius is wider than a classroom, so students not yet in the room could check in.`));
        }
        if (s.gps && s.radius <= 10) {
            warns.push(t("รัศมี 10 เมตรแคบมาก GPS ในอาคารคลาดเคลื่อนได้ 10 ถึง 30 เมตร นักศึกษาในห้องอาจเช็กชื่อไม่ผ่าน", "A 10 m radius is very tight. Indoor GPS drifts 10 to 30 m, so students in the room may fail."));
        }
        if (s.gps && !s.requireMobile) {
            warns.push(t("ตรวจ GPS แต่เปิดให้ใช้คอมพิวเตอร์ได้ ตำแหน่งจากคอมพิวเตอร์มักคลาดเคลื่อนหลายร้อยเมตร ควรเปิดใช้เฉพาะมือถือ", "GPS is checked but computers are allowed. Computer locations are often hundreds of metres off, so require phones."));
        }
        if (s.requireMobile && !s.requireNetwork && !s.gps && !online) {
            warns.push(t("ตรวจแค่อุปกรณ์อย่างเดียวปลอมได้ไม่ยาก (ดูจากข้อมูลเบราว์เซอร์) ควรใช้ร่วมกับเครือข่าย มข. หรือ GPS", "A device check alone is easy to fake (it reads browser data). Pair it with the KKU network or GPS."));
        }
        if (s.pin === "static" && !s.requireNetwork && !s.gps) {
            warns.push(t("PIN คงที่โดยไม่บังคับเครือข่ายหรือ GPS ใครได้รหัสไปก็เช็กชื่อจากที่ไหนก็ได้", "A fixed PIN with no network or GPS check lets anyone with the code check in from anywhere."));
        }
        if (s.requireMobile && !online) {
            infos.push(t("เช็กชื่อได้เฉพาะมือถือและแท็บเล็ต นักศึกษาที่ใช้คอมพิวเตอร์จะเช็กชื่อไม่ได้ ควรแจ้งล่วงหน้า", "Only phones and tablets can check in. Let students on computers know in advance."));
        }
        if (s.requireNetwork) {
            infos.push(t("นักศึกษาต้องต่อ KKU-WiFi หรือสาย LAN ของมหาวิทยาลัย ปิดเน็ตมือถือและ VPN ก่อนเช็กชื่อ", "Students must be on KKU-WiFi or campus LAN, with mobile data and VPN off."));
        }
    }

    return {
        messages: [
            ...blocks.map((text) => ({ tone: "block" as const, text })),
            ...warns.map((text) => ({ tone: "warn" as const, text })),
            ...infos.map((text) => ({ tone: "info" as const, text })),
        ],
        blocked: blocks.length > 0,
        bad,
        level: (s.pin === "rotating" ? 1 : 0) + (s.requireMobile ? 1 : 0) + (s.requireNetwork ? 1 : 0) + (s.gps ? 1 : 0),
    };
}

export interface SecurityFields {
    session_type: string;
    check_location: boolean;
    location_lat?: number | string | null;
    location_lng?: number | string | null;
    radius_meters?: number;
    require_mobile?: boolean | null;
    require_campus_network?: boolean | null;
}

/**
 * A comparable fingerprint of a session's security settings. The edit form
 * resends every field, so this is how both sides tell a real change from a
 * resave (see sameAttendanceSecurity in the backend).
 */
export function securityFingerprint(x: SecurityFields): string {
    const online = x.session_type === "online";
    return JSON.stringify([
        x.session_type,
        x.check_location,
        x.check_location && x.location_lat != null ? Number(x.location_lat) : null,
        x.check_location && x.location_lng != null ? Number(x.location_lng) : null,
        x.check_location ? x.radius_meters ?? null : null,
        x.require_mobile !== false,
        !online && x.require_campus_network !== false,
    ]);
}

/** One reason the server refused a session (handlers/attendance_session_rules.go). */
export interface SettingsProblem {
    code: string;
    message: string;
}

const PROBLEM_TEXT: Record<string, [string, string]> = {
    end_before_start: ["เวลาปิดรับต้องอยู่หลังเวลาเปิดรับ", "The close time must be after the open time."],
    too_short: [`ต้องเปิดรับอย่างน้อย ${MIN_OPEN_MINUTES} นาที`, `Keep check-in open for at least ${MIN_OPEN_MINUTES} minutes.`],
    late_out_of_range: ["เวลานับสายต้องอยู่ระหว่างเวลาเปิดรับกับเวลาปิดรับ", "The late cutoff must be between the open and close times."],
    already_ended: ["ช่วงเวลานี้ปิดรับไปแล้ว สร้างรอบย้อนหลังไม่ได้", "This window has already closed. Sessions cannot be created in the past."],
    too_far_ahead: [`วันที่ห่างจากวันนี้เกิน ${MAX_AHEAD_DAYS} วัน`, `The date is more than ${MAX_AHEAD_DAYS} days away.`],
    online_campus_network: ["รอบออนไลน์จะบังคับเครือข่าย มข. ไม่ได้", "Online sessions cannot require the KKU network."],
    online_gps: ["รอบออนไลน์จะเปิดตรวจ GPS ไม่ได้", "Online sessions cannot check GPS."],
    gps_without_pin: ["เปิดตรวจ GPS แต่ยังไม่ได้ปักหมุด", "GPS is on but no pin is placed."],
    radius_out_of_range: [`รัศมีต้องอยู่ระหว่าง ${MIN_RADIUS} ถึง ${MAX_RADIUS} เมตร`, `The radius must be between ${MIN_RADIUS} and ${MAX_RADIUS} metres.`],
    campus_network_pin_off_campus: ["บังคับใช้เครือข่าย มข. แต่หมุด GPS อยู่นอกมหาวิทยาลัย นักศึกษาจะเช็กชื่อไม่ได้", "The KKU network is required but the GPS pin is off campus, so nobody could check in."],
};

/** The server's refusal in the reader's language; unknown codes keep the server's text. */
export function describeSettingsProblems(problems: SettingsProblem[] | undefined, isEnglish: boolean): string | undefined {
    if (!problems?.length) return undefined;
    return problems.map((p) => PROBLEM_TEXT[p.code]?.[isEnglish ? 1 : 0] ?? p.message).join(" ");
}

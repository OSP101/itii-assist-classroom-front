import { API_BASE_URL } from "@/config/api";
import type { AttendanceRecord } from "./attendance.service";
import apiService from "./api.service";

interface ApiEnvelope<T> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export class AttendanceDisplayError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "AttendanceDisplayError";
        this.status = status;
    }
}

export interface AttendanceDisplayBootstrap {
    pairing_id: string;
    pairing_token: string;
    expires_at: string;
}

export interface AttendanceDisplaySessionInfo {
    id: number;
    title: string;
    session_type: string;
    check_location: boolean;
    auto_rotate_pin: boolean;
    pin_code: string;
    pin_issued_at?: string | null;
    pin_rotates_at?: string | null;
    late_threshold_minutes: number;
    late_threshold_time: string;
    start_time: string;
    end_time: string;
    status: "draft" | "active" | "closed";
    course?: {
        id: string;
        code: string;
        name: string;
        year: number;
        semester: number;
    } | null;
    section?: {
        id: number;
        section_no: string;
    } | null;
}

export interface AttendanceDisplayPairing {
    id: string;
    status: "pending" | "claimed" | "confirmed" | "expired" | "cancelled";
    course_id?: string;
    attendance_session_id?: number;
    approved_by_user_id?: number;
    expires_at: string;
    session?: AttendanceDisplaySessionInfo | null;
    device_hint?: string;
}

export interface AttendanceDisplayClaimResult {
    pairing: AttendanceDisplayPairing;
    verification_code: string;
}

export interface AttendanceDisplayCurrent {
    grant_id: string;
    status: "active" | "revoked" | "expired";
    course_id: string;
    attendance_session_id: number;
    scope: string;
    expires_at: string;
    session?: AttendanceDisplaySessionInfo | null;
}

export interface AttendanceDisplaySocketTicket {
    ticket: string;
    expires_at: string;
}

function parseEnvelope<T>(rawText: string): ApiEnvelope<T> | null {
    if (!rawText) {
        return null;
    }
    try {
        return JSON.parse(rawText) as ApiEnvelope<T>;
    } catch {
        return null;
    }
}

function toMessage(payload: { message?: string; error?: string } | null, fallback: string): string {
    return payload?.message || payload?.error || fallback;
}

async function publicRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
    // Call the real attendance display backend path directly.
    // In production, NEXT_PUBLIC_API_URL is "/api", so this becomes
    // same-origin "/api/attendance/display/*" and works with the nginx
    // proxy that already forwards /api/* to the backend service.
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    });

    const rawText = await response.text();
    const payload = parseEnvelope<T>(rawText);

    if (!response.ok || !payload?.success || payload.data === undefined) {
        throw new AttendanceDisplayError(
            response.status,
            toMessage(payload, `Request failed with status ${response.status}`),
        );
    }

    return payload.data;
}

const attendanceDisplayService = {
    async bootstrap(): Promise<AttendanceDisplayBootstrap> {
        return publicRequest<AttendanceDisplayBootstrap>("/attendance/display/bootstrap", {
            method: "POST",
        });
    },

    async getPairingStatus(pairingId: string): Promise<{ status: string }> {
        return publicRequest<{ status: string }>(`/attendance/display/pairing-status?pairing_id=${encodeURIComponent(pairingId)}`, {
            method: "GET",
        });
    },

    async confirm(pairingId: string, verificationCode: string): Promise<AttendanceDisplayCurrent> {
        return publicRequest<AttendanceDisplayCurrent>("/attendance/display/confirm", {
            method: "POST",
            body: JSON.stringify({
                pairing_id: pairingId,
                verification_code: verificationCode,
            }),
        });
    },

    async getCurrent(): Promise<AttendanceDisplayCurrent> {
        return publicRequest<AttendanceDisplayCurrent>("/attendance/display/current", {
            method: "GET",
        });
    },

    async heartbeat(): Promise<AttendanceDisplayCurrent> {
        return publicRequest<AttendanceDisplayCurrent>("/attendance/display/heartbeat", {
            method: "POST",
        });
    },

    async getRecords(): Promise<AttendanceRecord[]> {
        return publicRequest<AttendanceRecord[]>("/attendance/display/records", {
            method: "GET",
        });
    },

    async getSocketTicket(): Promise<AttendanceDisplaySocketTicket> {
        return publicRequest<AttendanceDisplaySocketTicket>("/attendance/display/socket-ticket", {
            method: "GET",
        });
    },

    async getPairing(token: string): Promise<AttendanceDisplayPairing> {
        const response = await apiService.get<AttendanceDisplayPairing>(`/attendance/display/pairings/${token}`);
        if (!response.success || !response.data) {
            throw new Error(toMessage(response, "Failed to load pairing request"));
        }
        return response.data;
    },

    async claimPairing(token: string, attendanceSessionId: number): Promise<AttendanceDisplayClaimResult> {
        const response = await apiService.post<AttendanceDisplayClaimResult>(`/attendance/display/pairings/${token}/claim`, {
            attendance_session_id: attendanceSessionId,
        });
        if (!response.success || !response.data) {
            throw new Error(toMessage(response, "Failed to claim display pairing"));
        }
        return response.data;
    },

    async revokeGrant(grantId: string): Promise<void> {
        const response = await apiService.post(`/attendance/display/grants/${grantId}/revoke`);
        if (!response.success) {
            throw new Error(toMessage(response, "Failed to revoke display access"));
        }
    },
};

export default attendanceDisplayService;

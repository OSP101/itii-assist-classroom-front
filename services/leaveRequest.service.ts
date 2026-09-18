/**
 * Leave Request Service
 * คำขอลาของนักศึกษา และการพิจารณาฝั่งผู้สอน/TA
 */

import { apiService } from './api.service';

export type LeaveType = 'sick' | 'personal' | 'official' | 'other';
export type LeaveRequestStatus = 'pending' | 'approved' | 'partially_approved' | 'rejected' | 'cancelled' | 'revoked' | 'expired';
export type LeaveItemStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'awaiting_session' | 'superseded' | 'cancelled' | 'revoked';
export type LeaveEvidencePolicy = 'none' | 'sick_only' | 'sick_personal' | 'all';

export interface LeaveCourseSettings {
  enabled: boolean;
  evidence_policy: LeaveEvidencePolicy;
  backdate_days: number;
  advance_days: number;
  max_pending: number;
  auto_expire_days: number;
}

export interface LeaveEligibleSession {
  id: number;
  title: string;
  session_type: string;
  start_time: string;
  end_time: string;
  leave_date: string;
  status: 'draft' | 'active' | 'closed';
  record_status: string;
  record_source: string;
  section_no: string;
  request_status?: LeaveItemStatus;
  request_id?: number;
  can_request: boolean;
  block_reason?: 'present' | 'pending' | 'approved' | 'out_of_window';
}

export interface StudentLeaveContext {
  settings: LeaveCourseSettings;
  course_active: boolean;
  window: { from: string; to: string; today: string };
  sessions: LeaveEligibleSession[];
  pending_count: number;
  evidence_required_types: Record<LeaveType, boolean>;
  limits: { max_files: number; max_file_size: number };
}

export interface LeaveRequestItem {
  id: number;
  leave_request_id: number;
  leave_date: string;
  leave_date_string: string;
  attendance_session_id?: number | null;
  by_date: boolean;
  item_status: LeaveItemStatus;
  previous_status: string;
  applied_record_id?: number | null;
  applied_at?: string | null;
  review_comment: string;
  session_title?: string;
  session_type?: string;
  session_start?: string | null;
  session_end?: string | null;
  record_status?: string;
  record_source?: string;
}

export interface LeaveRequest {
  id: number;
  course_id: string;
  student_id: number;
  leave_type: LeaveType;
  reason: string;
  status: LeaveRequestStatus;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  review_comment: string;
  created_at: string;
  updated_at: string;
  items: LeaveRequestItem[];
  evidence_list: string[];
  student?: { id: number; student_id: string; full_name: string; email: string };
  reviewer?: { id: number; full_name: string };
  course_name?: string;
  course_code?: string;
}

export interface LeaveRequestCounts {
  pending: number;
  approved: number;
  partially_approved: number;
  rejected: number;
  cancelled: number;
  revoked: number;
  expired: number;
  total: number;
}

export interface LeaveRequestListMeta {
  total: number;
  limit: number;
  offset: number;
  counts: LeaveRequestCounts;
  settings: LeaveCourseSettings;
}

export interface AttendanceRecordHistoryItem {
  id: number;
  from_status: string;
  to_status: string;
  source: 'system' | 'checkin' | 'manual' | 'leave_request';
  actor_type: 'system' | 'user' | 'student';
  actor_id?: number | null;
  actor_name: string;
  leave_request_id?: number | null;
  note: string;
  created_at: string;
}

export type LeaveItemInput = { session_id: number } | { date: string };

type WithMeta<T, M> = { success: boolean; message?: string; data?: T; meta?: M };

class LeaveRequestService {
  // ── นักศึกษา ──────────────────────────────────────────────────────────────
  private studentBase(courseId: string) {
    return `/students/me/courses/${courseId}/leave-requests`;
  }

  getStudentContext(courseId: string) {
    return apiService.get<StudentLeaveContext>(`${this.studentBase(courseId)}/context`);
  }

  getMyRequests(courseId: string) {
    return apiService.get<LeaveRequest[]>(this.studentBase(courseId));
  }

  submit(courseId: string, input: { leave_type: LeaveType; reason: string; items: LeaveItemInput[]; evidence: File[] }) {
    const form = new FormData();
    form.append('leave_type', input.leave_type);
    form.append('reason', input.reason);
    form.append('items', JSON.stringify(input.items));
    input.evidence.forEach((file) => form.append('evidence', file));
    return apiService.post<LeaveRequest>(this.studentBase(courseId), form);
  }

  // แก้ไขคำขอที่ยัง "รอพิจารณา" เท่านั้น — ไม่ส่ง evidence เลย = คงหลักฐานเดิมไว้,
  // ส่ง evidence (ไฟล์ใหม่ หรือไม่มีไฟล์เลยพร้อม replaceEvidence:true) = แทนที่หลักฐานเดิมทั้งหมด
  update(courseId: string, id: number, input: { leave_type: LeaveType; reason: string; items: LeaveItemInput[]; evidence?: File[]; replaceEvidence?: boolean }) {
    const form = new FormData();
    form.append('leave_type', input.leave_type);
    form.append('reason', input.reason);
    form.append('items', JSON.stringify(input.items));
    if (input.evidence) {
      input.evidence.forEach((file) => form.append('evidence', file));
    }
    if (input.replaceEvidence) {
      form.append('replace_evidence', '1');
    }
    return apiService.put<LeaveRequest>(`${this.studentBase(courseId)}/${id}`, form);
  }

  cancel(courseId: string, id: number) {
    return apiService.delete<LeaveRequest>(`${this.studentBase(courseId)}/${id}`);
  }

  // path ของไฟล์หลักฐาน (endpoint ต้อง auth) — ใช้กับ apiService.getBlob / useAuthedBlobUrls เท่านั้น
  // ห้ามใช้เป็น <a href>/<img src> ตรง ๆ เพราะ access token cookie หมดอายุใน 15 นาที จะพังเงียบ ๆ ถ้าเปิดหน้าไว้นาน
  studentEvidencePath(courseId: string, id: number, file: string) {
    return `${this.studentBase(courseId)}/${id}/evidence/${encodeURIComponent(file.split('/').pop() ?? file)}`;
  }

  // ── ผู้สอน / TA ───────────────────────────────────────────────────────────
  list(courseId: string, params: { status?: string; student_id?: number; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams({ course_id: courseId });
    if (params.status) query.set('status', params.status);
    if (params.student_id) query.set('student_id', String(params.student_id));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return apiService.get<LeaveRequest[]>(`/attendance/leave-requests?${query.toString()}`) as Promise<WithMeta<LeaveRequest[], LeaveRequestListMeta>>;
  }

  count(courseId: string) {
    return apiService.get<LeaveRequestCounts>(`/attendance/leave-requests/count?course_id=${encodeURIComponent(courseId)}`);
  }

  get(id: number) {
    return apiService.get<LeaveRequest>(`/attendance/leave-requests/${id}`) as Promise<WithMeta<LeaveRequest, { student_history: AttendanceRecordHistoryItem[] }>>;
  }

  review(id: number, input: { approved?: boolean; comment?: string; items?: Array<{ item_id: number; approved: boolean; comment?: string }> }) {
    return apiService.post<LeaveRequest>(`/attendance/leave-requests/${id}/review`, input);
  }

  batchReview(ids: number[], approved: boolean, comment?: string) {
    return apiService.post<{ processed: number; failed: Array<{ id: number; reason: string }> }>(`/attendance/leave-requests/batch-review`, { ids, approved, comment });
  }

  revoke(id: number, comment: string) {
    return apiService.post<LeaveRequest>(`/attendance/leave-requests/${id}/revoke`, { comment });
  }

  // path ของไฟล์หลักฐาน (endpoint ต้อง auth) — ใช้กับ apiService.getBlob / useAuthedBlobUrls เท่านั้น
  // ห้ามใช้เป็น <a href>/<img src> ตรง ๆ เพราะ access token cookie หมดอายุใน 15 นาที จะพังเงียบ ๆ ถ้าเปิดหน้าไว้นาน
  evidencePath(id: number, file: string) {
    return `/attendance/leave-requests/${id}/evidence/${encodeURIComponent(file.split('/').pop() ?? file)}`;
  }

  recordHistory(sessionId: number, recordId: number) {
    return apiService.get<{ record: unknown; history: AttendanceRecordHistoryItem[] }>(`/attendance/${sessionId}/records/${recordId}/history`);
  }
}

export const leaveRequestService = new LeaveRequestService();
export default leaveRequestService;

// ── labels ──────────────────────────────────────────────────────────────────

export const LEAVE_TYPE_LABEL: Record<LeaveType, { th: string; en: string; icon: string }> = {
  sick: { th: 'ลาป่วย', en: 'Sick leave', icon: 'solar:health-linear' },
  personal: { th: 'ลากิจ', en: 'Personal leave', icon: 'solar:user-hand-up-linear' },
  official: { th: 'ลาราชการ / กิจกรรมมหาวิทยาลัย', en: 'Official / university activity', icon: 'solar:buildings-2-linear' },
  other: { th: 'ลาอื่น ๆ', en: 'Other', icon: 'solar:document-text-linear' },
};

export const LEAVE_STATUS_LABEL: Record<LeaveRequestStatus, { th: string; en: string; badge: string }> = {
  pending: { th: 'รอพิจารณา', en: 'Pending', badge: 'warning' },
  approved: { th: 'อนุมัติแล้ว', en: 'Approved', badge: 'success' },
  partially_approved: { th: 'อนุมัติบางวัน', en: 'Partially approved', badge: 'info' },
  rejected: { th: 'ไม่อนุมัติ', en: 'Rejected', badge: 'danger' },
  cancelled: { th: 'ยกเลิกแล้ว', en: 'Cancelled', badge: 'neutral' },
  revoked: { th: 'ถอนการอนุมัติ', en: 'Revoked', badge: 'danger' },
  expired: { th: 'หมดอายุอัตโนมัติ', en: 'Auto-expired', badge: 'neutral' },
};

export const LEAVE_ITEM_STATUS_LABEL: Record<LeaveItemStatus, { th: string; en: string; badge: string }> = {
  pending: { th: 'รอพิจารณา', en: 'Pending', badge: 'warning' },
  approved: { th: 'อนุมัติ', en: 'Approved', badge: 'success' },
  rejected: { th: 'ไม่อนุมัติ', en: 'Rejected', badge: 'danger' },
  applied: { th: 'บันทึกลาแล้ว', en: 'Leave recorded', badge: 'success' },
  awaiting_session: { th: 'อนุมัติ รอคาบเรียน', en: 'Approved, awaiting session', badge: 'info' },
  superseded: { th: 'มาเรียนแล้ว', en: 'Attended instead', badge: 'neutral' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled', badge: 'neutral' },
  revoked: { th: 'ถอนการอนุมัติ', en: 'Revoked', badge: 'danger' },
};

export const ATTENDANCE_SOURCE_LABEL: Record<string, { th: string; en: string; icon: string }> = {
  system: { th: 'ระบบ', en: 'System', icon: 'solar:cpu-linear' },
  checkin: { th: 'เช็กชื่อเอง', en: 'Self check-in', icon: 'solar:smartphone-linear' },
  manual: { th: 'ผู้สอนบันทึก', en: 'Edited by staff', icon: 'solar:pen-linear' },
  leave_request: { th: 'ลาผ่านระบบ', en: 'Leave request', icon: 'solar:document-add-linear' },
};

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useAuthedBlobUrls } from "@/hooks";
import {
  leaveRequestService,
  LEAVE_ITEM_STATUS_LABEL,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  type LeaveEligibleSession,
  type LeaveItemInput,
  type LeaveRequest,
  type LeaveType,
  type StudentLeaveContext,
} from "@/services/leaveRequest.service";

// ─── helpers ──────────────────────────────────────────────────────────────────

const LEAVE_TYPES: LeaveType[] = ["sick", "personal", "official", "other"];
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 100;

function fmtDate(value: string) {
  if (!value) return "-";
  const d = value.length === 10 ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function badgeClass(kind: string) {
  return `cg-badge cg-badge-${kind}`;
}

function sessionTypeTH(type: string) {
  if (type === "lab") return "ปฏิบัติ";
  if (type === "online") return "ออนไลน์";
  return "บรรยาย";
}

function blockReasonTH(reason?: string) {
  if (reason === "present") return "เช็กชื่อแล้ว";
  if (reason === "pending") return "มีคำขอรอพิจารณา";
  if (reason === "approved") return "อนุมัติลาแล้ว";
  return "";
}

// คำนวณวันที่แบบ string ล้วน (ไม่ผ่าน timezone ของเบราว์เซอร์เลย) กันวันเพี้ยนตอนขยายช่วงวันที่
function addDaysToDateStr(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dateStrDiffDays(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

type SelectedItem = { key: string; input: LeaveItemInput; label: string; sub: string };

// ─── request card ─────────────────────────────────────────────────────────────

function LeaveRequestCard({ courseId, request, onCancel, onEdit, busy }: { courseId: string; request: LeaveRequest; onCancel: (id: number) => void; onEdit: (request: LeaveRequest) => void; busy: boolean }) {
  const [open, setOpen] = useState(request.status === "pending");
  const type = LEAVE_TYPE_LABEL[request.leave_type] ?? LEAVE_TYPE_LABEL.other;
  const status = LEAVE_STATUS_LABEL[request.status] ?? LEAVE_STATUS_LABEL.pending;
  // ดึงหลักฐานเป็น blob URL (ต้อง auth) แทนชี้ตรงไป endpoint เพราะ access token cookie
  // หมดอายุใน 15 นาที ทำให้รูป/ลิงก์พังเงียบ ๆ ถ้าเปิดหน้าค้างไว้นาน — โหลดเมื่อเปิดการ์ดเท่านั้น
  const evidencePaths = useMemo(
    () => (open ? request.evidence_list.map((file) => leaveRequestService.studentEvidencePath(courseId, request.id, file)) : []),
    [open, courseId, request.id, request.evidence_list],
  );
  const evidenceBlobUrls = useAuthedBlobUrls(evidencePaths);
  return (
    <div className="cg-list">
      <button type="button" className="cg-row" onClick={() => setOpen((v) => !v)}>
        <span className="cg-row-ico" style={{ background: "var(--cg-info-soft)", color: "var(--cg-info)" }}>
          <Icon icon={type.icon} width={18} height={18} />
        </span>
        <span className="cg-row-body">
          <span className="cg-row-title">{type.th}</span>
          <span className="cg-row-sub"><span className="cg-mono">LR-{request.id}</span> · ส่งเมื่อ {fmtDateTime(request.created_at)} · {request.items.length} วัน</span>
        </span>
        <span className={badgeClass(status.badge)}>{status.th}</span>
        <Icon icon="solar:alt-arrow-down-linear" width={16} height={16} className="cg-chevron" style={{ transform: open ? "rotate(180deg)" : undefined, color: "var(--cg-text-3)" }} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-1">
          <div className="flex flex-col gap-1.5">
            {request.items.map((item) => {
              const st = LEAVE_ITEM_STATUS_LABEL[item.item_status] ?? LEAVE_ITEM_STATUS_LABEL.pending;
              return (
                <div key={item.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--cg-fill)" }}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-medium" style={{ color: "var(--cg-text)" }}>{fmtDate(item.leave_date_string)}</span>
                    <span className="text-[11px] font-light" style={{ color: "var(--cg-text-2)" }}>
                      {item.session_title ? `${item.session_title} ${fmtTime(item.session_start)}` : "ทุกคาบในวันนั้น (ยังไม่มีคาบเรียน)"}
                    </span>
                    {item.review_comment && <span className="text-[11px] font-light" style={{ color: "var(--cg-text-2)" }}>ความเห็น: {item.review_comment}</span>}
                  </span>
                  <span className={badgeClass(st.badge)}>{st.th}</span>
                </div>
              );
            })}
          </div>
          <div className="text-[12px] font-light leading-relaxed" style={{ color: "var(--cg-text-2)" }}>
            <b className="font-medium" style={{ color: "var(--cg-text)" }}>เหตุผล:</b> {request.reason}
          </div>
          {request.review_comment && (
            <div className="cg-note" style={{ background: "var(--cg-info-soft)" }}>
              <Icon icon="solar:chat-round-line-linear" width={16} height={16} style={{ flexShrink: 0, color: "var(--cg-info)" }} />
              <span>
                <b className="font-medium">ความเห็นผู้สอน{request.reviewer?.full_name ? ` (${request.reviewer.full_name})` : ""}:</b> {request.review_comment}
                {request.reviewed_at && <span className="block text-[11px]" style={{ color: "var(--cg-text-3)" }}>{fmtDateTime(request.reviewed_at)}</span>}
              </span>
            </div>
          )}
          {request.evidence_list.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="cg-section-label">หลักฐาน ({request.evidence_list.length})</span>
              <div className="cg-leave-thumbs">
                {request.evidence_list.map((file) => {
                  const path = leaveRequestService.studentEvidencePath(courseId, request.id, file);
                  const blobUrl = evidenceBlobUrls[path];
                  const isPdf = file.toLowerCase().endsWith(".pdf");
                  if (blobUrl === null) {
                    return (
                      <div key={file} className="cg-leave-thumb" style={{ color: "var(--cg-danger)" }}>
                        <Icon icon="solar:danger-triangle-linear" width={22} height={22} />
                      </div>
                    );
                  }
                  if (!blobUrl) {
                    return (
                      <div key={file} className="cg-leave-thumb">
                        <Icon icon="solar:refresh-linear" width={20} height={20} style={{ color: "var(--cg-text-3)" }} />
                      </div>
                    );
                  }
                  return (
                    <a key={file} href={blobUrl} target="_blank" rel="noreferrer" className="cg-leave-thumb">
                      {isPdf ? <Icon icon="solar:document-linear" width={26} height={26} /> : <img src={blobUrl} alt="หลักฐาน" loading="lazy" />}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {request.status === "pending" && (
            <div className="flex gap-2">
              <button type="button" className="cg-btn-ghost flex-1" disabled={busy} onClick={() => onEdit(request)}>
                แก้ไขคำขอ
              </button>
              <button type="button" className="cg-btn-danger flex-1" disabled={busy} onClick={() => onCancel(request.id)}>
                ยกเลิกคำขอ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── form ─────────────────────────────────────────────────────────────────────

function initialSelectedFromRequest(request?: LeaveRequest): Record<string, SelectedItem> {
  if (!request) return {};
  const map: Record<string, SelectedItem> = {};
  for (const item of request.items) {
    if (item.attendance_session_id) {
      const key = `s:${item.attendance_session_id}`;
      map[key] = {
        key,
        input: { session_id: item.attendance_session_id },
        label: fmtDate(item.leave_date_string),
        sub: item.session_title ? `${item.session_title} ${fmtTime(item.session_start)}` : "",
      };
    } else {
      const key = `d:${item.leave_date_string}`;
      map[key] = { key, input: { date: item.leave_date_string }, label: fmtDate(item.leave_date_string), sub: "ทุกคาบในวันนั้น (ระบบจะบันทึกให้เมื่อผู้สอนสร้างคาบ)" };
    }
  }
  return map;
}

function LeaveForm({ courseId, context, editing, onDone, onBack }: { courseId: string; context: StudentLeaveContext; editing?: LeaveRequest; onDone: () => void; onBack: () => void }) {
  const [leaveType, setLeaveType] = useState<LeaveType>(editing?.leave_type ?? "sick");
  const [selected, setSelected] = useState<Record<string, SelectedItem>>(() => initialSelectedFromRequest(editing));
  const [customDate, setCustomDate] = useState("");
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [replaceEvidence, setReplaceEvidence] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // หลักฐานบังคับแนบทุกกรณี ไม่ว่าประเภทลาไหน
  const evidenceRequired = true;
  const keptEvidenceCount = editing && !replaceEvidence ? editing.evidence_list.length : 0;
  const evidenceSatisfied = keptEvidenceCount > 0 || files.length > 0;
  // หลักฐานเดิม (ตอนแก้ไขคำขอ) ต้องดึงผ่าน blob เพราะ endpoint ต้อง auth ที่หมดอายุได้ (ดู useAuthedBlobUrls)
  const existingEvidencePaths = useMemo(
    () => (editing && !replaceEvidence ? editing.evidence_list.map((file) => leaveRequestService.studentEvidencePath(courseId, editing.id, file)) : []),
    [editing, replaceEvidence, courseId],
  );
  const existingEvidenceBlobUrls = useAuthedBlobUrls(existingEvidencePaths);
  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= REASON_MIN_LENGTH && reasonLength <= REASON_MAX_LENGTH;
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, LeaveEligibleSession[]>();
    for (const s of context.sessions) {
      const list = map.get(s.leave_date) ?? [];
      list.push(s);
      map.set(s.leave_date, list);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [context.sessions]);
  const sessionDates = useMemo(() => new Set(context.sessions.map((s) => s.leave_date)), [context.sessions]);

  useEffect(() => {
    // สร้าง object URL ให้ทุกไฟล์ (รวม PDF) เพื่อให้กดดูตัวอย่างได้ก่อนส่ง
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  const toggleSession = (s: LeaveEligibleSession) => {
    if (!s.can_request) return;
    const key = `s:${s.id}`;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { key, input: { session_id: s.id }, label: fmtDate(s.leave_date), sub: `${s.title} ${fmtTime(s.start_time)}` };
      return next;
    });
  };

  const addCustomDate = () => {
    setError(null);
    if (!customDate) return;
    if (customDate < context.window.from || customDate > context.window.to) {
      setError(`เลือกได้ระหว่าง ${fmtDate(context.window.from)} ถึง ${fmtDate(context.window.to)}`);
      return;
    }
    if (sessionDates.has(customDate)) {
      setError("วันนี้มีคาบเรียนอยู่แล้ว กรุณาเลือกจากรายการคาบเรียนด้านบน");
      return;
    }
    const key = `d:${customDate}`;
    setSelected((prev) => ({ ...prev, [key]: { key, input: { date: customDate }, label: fmtDate(customDate), sub: "ทุกคาบในวันนั้น (ระบบจะบันทึกให้เมื่อผู้สอนสร้างคาบ)" } }));
    setCustomDate("");
  };

  // เลือกลาแบบช่วงวันที่ (เช่น ป่วยนอนโรงพยาบาลหลายวันติด) แทนที่จะกดทีละวัน
  // วันไหนมีคาบเรียนอยู่แล้วจะเลือกคาบนั้นให้เลย วันไหนยังไม่มีคาบใช้แบบ "เลือกวัน" เหมือนเดิม
  const addDateRange = () => {
    setError(null);
    if (!rangeStart || !rangeEnd) return;
    if (rangeEnd < rangeStart) { setError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม"); return; }
    const span = dateStrDiffDays(rangeStart, rangeEnd) + 1;
    if (span > 31) { setError("เลือกช่วงวันที่ได้สูงสุดครั้งละ 31 วัน"); return; }
    const next = { ...selected };
    let added = 0;
    for (let i = 0; i < span; i++) {
      const dateKey = addDaysToDateStr(rangeStart, i);
      if (dateKey < context.window.from || dateKey > context.window.to) continue;
      const daySessions = sessionsByDate.find(([d]) => d === dateKey)?.[1] ?? [];
      if (daySessions.length > 0) {
        for (const s of daySessions) {
          if (!s.can_request) continue;
          const key = `s:${s.id}`;
          if (!next[key]) { next[key] = { key, input: { session_id: s.id }, label: fmtDate(s.leave_date), sub: `${s.title} ${fmtTime(s.start_time)}` }; added++; }
        }
      } else {
        const key = `d:${dateKey}`;
        if (!next[key]) { next[key] = { key, input: { date: dateKey }, label: fmtDate(dateKey), sub: "ทุกคาบในวันนั้น (ระบบจะบันทึกให้เมื่อผู้สอนสร้างคาบ)" }; added++; }
      }
    }
    setSelected(next);
    if (added === 0) setError("ไม่มีวันที่เพิ่มได้ในช่วงนี้ (อาจอยู่นอกช่วงที่ขอลาได้ หรือเลือกไว้แล้วทั้งหมด)");
    setRangeStart("");
    setRangeEnd("");
  };

  const removeSelected = (key: string) => setSelected((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    if (editing) setReplaceEvidence(true);
    const incoming = Array.from(list);
    const next = [...files];
    for (const f of incoming) {
      if (next.length >= context.limits.max_files) { setError(`แนบได้สูงสุด ${context.limits.max_files} ไฟล์`); break; }
      if (f.size > context.limits.max_file_size) { setError(`ไฟล์ ${f.name} ใหญ่เกิน 5 MB`); continue; }
      if (!f.type.startsWith("image/") && f.type !== "application/pdf") { setError(`ไฟล์ ${f.name} ต้องเป็นรูปภาพหรือ PDF`); continue; }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const selectedList = Object.values(selected);
  const canSubmit = selectedList.length > 0 && reasonValid && evidenceSatisfied && !submitting;

  const submit = async () => {
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = editing
        ? await leaveRequestService.update(courseId, editing.id, {
            leave_type: leaveType,
            reason: reason.trim(),
            items: selectedList.map((s) => s.input),
            evidence: replaceEvidence ? files : undefined,
            replaceEvidence,
          })
        : await leaveRequestService.submit(courseId, { leave_type: leaveType, reason: reason.trim(), items: selectedList.map((s) => s.input), evidence: files });
      if (!res.success) {
        setError(res.message || (editing ? "แก้ไขคำขอไม่สำเร็จ" : "ส่งคำขอไม่สำเร็จ"));
        return;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : (editing ? "แก้ไขคำขอไม่สำเร็จ" : "ส่งคำขอไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="cg-link self-start text-[13px]" onClick={onBack}>
        <Icon icon="solar:alt-arrow-left-linear" width={15} height={15} /> กลับไปรายการคำขอ
      </button>

      <div className="cg-note" style={{ background: "var(--cg-fill)" }}>
        <Icon icon="solar:info-circle-linear" width={16} height={16} style={{ flexShrink: 0, color: "var(--cg-text-3)" }} />
        <span className="text-[11.5px] font-light" style={{ color: "var(--cg-text-2)" }}>
          ลาย้อนหลังได้สูงสุด {context.settings.backdate_days} วัน ล่วงหน้าได้สูงสุด {context.settings.advance_days} วัน
          {" "}· คำขอที่รอพิจารณาอยู่ {context.pending_count}/{context.settings.max_pending} ใบ
        </span>
      </div>

      {/* ประเภท */}
      <div className="flex flex-col gap-2">
        <span className="cg-section-label">1. ประเภทการลา</span>
        <div className="grid grid-cols-2 gap-2">
          {LEAVE_TYPES.map((tp) => {
            const meta = LEAVE_TYPE_LABEL[tp];
            const active = leaveType === tp;
            return (
              <button
                key={tp}
                type="button"
                onClick={() => setLeaveType(tp)}
                className="flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-[13px]"
                style={{
                  background: active ? "var(--cg-accent)" : "var(--cg-surface)",
                  color: active ? "#fff" : "var(--cg-text)",
                  boxShadow: "var(--cg-shadow-1)",
                  border: active ? "1.5px solid var(--cg-accent)" : "1.5px solid var(--cg-line)",
                }}
              >
                <Icon icon={meta.icon} width={18} height={18} />
                <span className="font-medium leading-tight">{meta.th}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* วัน/คาบ */}
      <div className="flex flex-col gap-2">
        <span className="cg-section-label">2. วันหรือคาบเรียนที่ต้องการลา</span>
        <div className="cg-list">
          {sessionsByDate.length === 0 ? (
            <div className="cg-empty">
              <Icon icon="solar:calendar-linear" width={27} height={27} />
              <span className="text-[11.5px] font-light">ยังไม่มีคาบเรียนในช่วงที่ขอลาได้ เลือกวันล่วงหน้าได้ด้านล่าง</span>
            </div>
          ) : (
            sessionsByDate.map(([date, sessions]) => (
              <div key={date} className="cg-check-block">
                <div className="px-3.5 pb-1 pt-3 text-[11px] font-medium" style={{ color: "var(--cg-text-3)" }}>{fmtDate(date)}</div>
                {sessions.map((s) => {
                  const checked = Boolean(selected[`s:${s.id}`]);
                  return (
                    <button key={s.id} type="button" className="cg-leave-day" data-checked={checked} data-disabled={!s.can_request} onClick={() => toggleSession(s)}>
                      <span className="cg-leave-check">{checked && <Icon icon="solar:check-read-linear" width={14} height={14} />}</span>
                      <span className="cg-row-body">
                        <span className="cg-row-title">{s.title}</span>
                        <span className="cg-row-sub">{sessionTypeTH(s.session_type)} {fmtTime(s.start_time)} ถึง {fmtTime(s.end_time)}{s.section_no ? ` · กลุ่ม ${s.section_no}` : ""}</span>
                      </span>
                      {!s.can_request && <span className="cg-badge cg-badge-neutral">{blockReasonTH(s.block_reason)}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="cg-list" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="flex items-center gap-2">
            <Icon icon="solar:calendar-add-bold" width={18} height={18} style={{ color: "var(--cg-accent)", flexShrink: 0 }} />
            <span className="text-[12.5px] font-medium" style={{ color: "var(--cg-text)" }}>วันที่ยังไม่มีคาบเรียนในระบบ? เลือกได้ตรงนี้</span>
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="cg-pill" data-active={!rangeMode} onClick={() => setRangeMode(false)}>ทีละวัน</button>
            <button type="button" className="cg-pill" data-active={rangeMode} onClick={() => setRangeMode(true)}>ช่วงวันที่ (หลายวันติดกัน)</button>
          </div>
          {rangeMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="cg-field-box" style={{ flex: "1 1 220px" }}>
                <input type="date" value={rangeStart} min={context.window.from} max={context.window.to} onChange={(e) => setRangeStart(e.target.value)} aria-label="วันเริ่มลา" />
                <span style={{ color: "var(--cg-text-3)", flexShrink: 0 }}>ถึง</span>
                <input type="date" value={rangeEnd} min={rangeStart || context.window.from} max={context.window.to} onChange={(e) => setRangeEnd(e.target.value)} aria-label="วันสุดท้ายที่ลา" />
              </div>
              <button type="button" className="cg-btn-add" onClick={addDateRange} disabled={!rangeStart || !rangeEnd}>
                <Icon icon="solar:add-circle-bold" width={16} height={16} /> เพิ่มช่วงวันที่
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="cg-field-box" style={{ flex: "1 1 180px" }}>
                <input type="date" value={customDate} min={context.window.from} max={context.window.to} onChange={(e) => setCustomDate(e.target.value)} aria-label="วันที่ยังไม่มีคาบเรียน" />
              </div>
              <button type="button" className="cg-btn-add" onClick={addCustomDate} disabled={!customDate}>
                <Icon icon="solar:add-circle-bold" width={16} height={16} /> เพิ่มวันนี้
              </button>
            </div>
          )}
          <span className="text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
            เลือกวันที่แล้วกดปุ่ม "เพิ่ม" ระบบจะบันทึกลาให้อัตโนมัติเมื่อผู้สอนสร้างคาบเรียนของวันนั้น ถ้าวันไหนมีคาบเรียนอยู่แล้วระบบจะเลือกคาบนั้นให้เอง
          </span>
        </div>
        {selectedList.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {selectedList.map((item) => (
              <div key={item.key} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--cg-accent-soft, var(--cg-info-soft))" }}>
                <Icon icon="solar:calendar-mark-linear" width={16} height={16} style={{ color: "var(--cg-accent)" }} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium" style={{ color: "var(--cg-text)" }}>{item.label}</span>
                  <span className="text-[11px] font-light" style={{ color: "var(--cg-text-2)" }}>{item.sub}</span>
                </span>
                <button type="button" onClick={() => removeSelected(item.key)} aria-label="เอาออก" style={{ color: "var(--cg-text-3)", background: "none", border: "none" }}>
                  <Icon icon="solar:close-circle-linear" width={18} height={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* เหตุผล */}
      <div className="flex flex-col gap-2">
        <span className="cg-section-label">3. เหตุผล (จำเป็น {REASON_MIN_LENGTH}-{REASON_MAX_LENGTH} ตัวอักษร)</span>
        <div className="cg-field-box is-multiline">
          <textarea rows={3} value={reason} maxLength={REASON_MAX_LENGTH} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ป่วยเป็นไข้หวัด มีใบรับรองแพทย์แนบ (อย่างน้อย 10 ตัวอักษร)" />
        </div>
        <span className="text-[11px] font-light" style={{ color: reasonLength > 0 && !reasonValid ? "var(--cg-danger)" : "var(--cg-text-3)" }}>
          {reasonLength}/{REASON_MAX_LENGTH} ตัวอักษร
          {reasonLength > 0 && reasonLength < REASON_MIN_LENGTH && ` (ต้องการอีกอย่างน้อย ${REASON_MIN_LENGTH - reasonLength} ตัวอักษร)`}
        </span>
      </div>

      {/* หลักฐาน */}
      <div className="flex flex-col gap-2">
        <span className="cg-section-label">4. หลักฐาน {evidenceRequired ? "(จำเป็น)" : "(ถ้ามี)"}</span>
        {editing && editing.evidence_list.length > 0 && !replaceEvidence && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>หลักฐานเดิม ({editing.evidence_list.length} ไฟล์) — จะเก็บไว้ถ้าไม่แตะส่วนนี้</span>
            <div className="cg-leave-thumbs">
              {editing.evidence_list.map((file) => {
                const path = leaveRequestService.studentEvidencePath(courseId, editing.id, file);
                const blobUrl = existingEvidenceBlobUrls[path];
                const isPdf = file.toLowerCase().endsWith(".pdf");
                if (blobUrl === null) {
                  return (
                    <div key={file} className="cg-leave-thumb" style={{ color: "var(--cg-danger)" }}>
                      <Icon icon="solar:danger-triangle-linear" width={22} height={22} />
                    </div>
                  );
                }
                if (!blobUrl) {
                  return (
                    <div key={file} className="cg-leave-thumb">
                      <Icon icon="solar:refresh-linear" width={20} height={20} style={{ color: "var(--cg-text-3)" }} />
                    </div>
                  );
                }
                return (
                  <a key={file} href={blobUrl} target="_blank" rel="noreferrer" className="cg-leave-thumb">
                    {isPdf ? <Icon icon="solar:document-linear" width={26} height={26} /> : <img src={blobUrl} alt="หลักฐาน" loading="lazy" />}
                  </a>
                );
              })}
            </div>
            <button type="button" className="cg-link self-start text-[12px]" style={{ color: "var(--cg-danger)" }} onClick={() => setReplaceEvidence(true)}>
              แทนที่หลักฐานทั้งหมด
            </button>
          </div>
        )}
        {editing && replaceEvidence && (
          <button type="button" className="cg-link self-start text-[12px]" onClick={() => { setReplaceEvidence(false); setFiles([]); }}>
            ยกเลิก ใช้หลักฐานเดิมต่อ
          </button>
        )}
        <div className="cg-leave-thumbs">
          {files.map((f, i) => {
            const isImage = f.type.startsWith("image/");
            return (
              <div key={`${f.name}-${i}`} className="cg-leave-thumb">
                <button
                  type="button"
                  className="cg-leave-thumb-preview"
                  aria-label={`ดูตัวอย่าง ${f.name}`}
                  onClick={() => previews[i] && window.open(previews[i], "_blank", "noopener,noreferrer")}
                >
                  {isImage && previews[i] ? <img src={previews[i]} alt={f.name} /> : <Icon icon="solar:document-linear" width={26} height={26} />}
                </button>
                <button type="button" className="cg-leave-thumb-x" aria-label={`ลบไฟล์ ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                  <Icon icon="solar:close-linear" width={12} height={12} />
                </button>
              </div>
            );
          })}
          {files.length < context.limits.max_files && (
            <button type="button" className="cg-leave-add" onClick={() => fileInput.current?.click()}>
              <Icon icon="solar:camera-add-linear" width={20} height={20} />
              เพิ่มไฟล์
            </button>
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
        <span className="text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
          รูปภาพหรือ PDF สูงสุด {context.limits.max_files} ไฟล์ ไฟล์ละไม่เกิน {Math.round(context.limits.max_file_size / (1024 * 1024))} MB · กดที่รูปเพื่อดูตัวอย่าง ผู้สอนและผู้ช่วยสอนของวิชานี้เท่านั้นที่เห็นไฟล์
        </span>
      </div>

      {error && (
        <div className="cg-note" style={{ background: "var(--cg-danger-soft)", color: "var(--cg-danger)" }}>
          <Icon icon="solar:danger-circle-linear" width={16} height={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <button type="button" className="cg-btn" disabled={!canSubmit} onClick={submit}>
        {submitting ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : "ส่งคำขอลา"}
      </button>
    </div>
  );
}

// ─── tab ──────────────────────────────────────────────────────────────────────

export default function LeaveTab({ courseId }: { courseId: string }) {
  const [context, setContext] = useState<StudentLeaveContext | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "form" | "done" | "edited">("list");
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ctxRes, listRes] = await Promise.all([leaveRequestService.getStudentContext(courseId), leaveRequestService.getMyRequests(courseId)]);
      if (ctxRes.success && ctxRes.data) setContext(ctxRes.data);
      else setError(ctxRes.message || "โหลดข้อมูลการลาไม่สำเร็จ");
      setRequests(listRes.success && listRes.data ? listRes.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลการลาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  const cancel = async (id: number) => {
    if (!window.confirm("ยกเลิกคำขอลานี้ใช่ไหม")) return;
    setBusy(true);
    try {
      const res = await leaveRequestService.cancel(courseId, id);
      setNotice(res.success ? "ยกเลิกคำขอแล้ว" : res.message || "ยกเลิกไม่สำเร็จ");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (request: LeaveRequest) => {
    setNotice(null);
    setEditingRequest(request);
    setMode("form");
  };

  if (loading && !context) {
    return (
      <div className="cg-list">
        <div className="cg-row animate-pulse">
          <div className="h-9 w-9 shrink-0 rounded-xl" style={{ background: "var(--cg-fill-strong)" }} />
          <div className="h-3.5 w-1/2 rounded-full" style={{ background: "var(--cg-fill-strong)" }} />
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="cg-list">
        <div className="cg-empty">
          <Icon icon="solar:danger-circle-linear" width={27} height={27} />
          <span className="text-[11.5px] font-light">{error || "โหลดข้อมูลการลาไม่สำเร็จ"}</span>
        </div>
      </div>
    );
  }

  if (mode === "form") {
    return (
      <LeaveForm
        courseId={courseId}
        context={context}
        editing={editingRequest ?? undefined}
        onBack={() => { setEditingRequest(null); setMode("list"); }}
        onDone={() => { const wasEdit = Boolean(editingRequest); setEditingRequest(null); setMode(wasEdit ? "edited" : "done"); void load(); }}
      />
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const canCreate = context.settings.enabled && context.course_active && pending.length < context.settings.max_pending;

  return (
    <div className="flex flex-col gap-4">
      {mode === "done" && (
        <div className="cg-note" style={{ background: "var(--cg-success-soft)" }}>
          <Icon icon="solar:check-circle-linear" width={16} height={16} style={{ flexShrink: 0, color: "var(--cg-success)" }} />
          <span>ส่งคำขอลาแล้ว ระบบแจ้งผู้สอนทางอีเมลแล้ว เมื่อพิจารณาเสร็จจะแจ้งผลทางอีเมลของคุณ</span>
        </div>
      )}
      {mode === "edited" && (
        <div className="cg-note" style={{ background: "var(--cg-success-soft)" }}>
          <Icon icon="solar:check-circle-linear" width={16} height={16} style={{ flexShrink: 0, color: "var(--cg-success)" }} />
          <span>บันทึกการแก้ไขคำขอลาแล้ว</span>
        </div>
      )}
      {notice && mode !== "done" && mode !== "edited" && (
        <div className="cg-note" style={{ background: "var(--cg-info-soft)" }}>
          <Icon icon="solar:info-circle-linear" width={16} height={16} style={{ flexShrink: 0, color: "var(--cg-info)" }} />
          <span>{notice}</span>
        </div>
      )}

      {!context.settings.enabled ? (
        <div className="cg-note">
          <Icon icon="solar:lock-linear" width={16} height={16} style={{ flexShrink: 0 }} />
          <span>รายวิชานี้ปิดรับคำขอลาผ่านระบบ กรุณาติดต่อผู้สอนโดยตรง</span>
        </div>
      ) : !context.course_active ? (
        <div className="cg-note">
          <Icon icon="solar:lock-linear" width={16} height={16} style={{ flexShrink: 0 }} />
          <span>รายวิชานี้ปิดแล้ว ไม่รับคำขอลา</span>
        </div>
      ) : (
        <button type="button" className="cg-cta" disabled={!canCreate} onClick={() => { setNotice(null); setEditingRequest(null); setMode("form"); }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.18)" }}>
            <Icon icon="solar:document-add-linear" width={22} height={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-medium leading-tight">ส่งคำขอลา</span>
            <span className="text-[11.5px] font-light opacity-85">
              {pending.length >= context.settings.max_pending ? `มีคำขอรอพิจารณาครบ ${context.settings.max_pending} รายการแล้ว` : "เลือกวันหรือคาบ แนบหลักฐาน แล้วรอผู้สอนพิจารณา"}
            </span>
          </span>
          <Icon icon="solar:alt-arrow-right-linear" width={18} height={18} />
        </button>
      )}

      <div className="flex items-center justify-between">
        <span className="cg-section-label">คำขอของฉัน ({requests.length})</span>
        {pending.length > 0 && <span className="cg-badge cg-badge-warning">รอพิจารณา {pending.length}</span>}
      </div>

      {requests.length === 0 ? (
        <div className="cg-list">
          <div className="cg-empty">
            <Icon icon="solar:document-text-linear" width={27} height={27} />
            <span className="text-[11.5px] font-light">ยังไม่เคยส่งคำขอลาในวิชานี้</span>
          </div>
        </div>
      ) : (
        requests.map((r) => <LeaveRequestCard key={r.id} courseId={courseId} request={r} onCancel={cancel} onEdit={startEdit} busy={busy} />)
      )}
    </div>
  );
}

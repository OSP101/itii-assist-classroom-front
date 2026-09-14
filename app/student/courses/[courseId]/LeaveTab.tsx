"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
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

type SelectedItem = { key: string; input: LeaveItemInput; label: string; sub: string };

// ─── request card ─────────────────────────────────────────────────────────────

function LeaveRequestCard({ courseId, request, onCancel, busy }: { courseId: string; request: LeaveRequest; onCancel: (id: number) => void; busy: boolean }) {
  const [open, setOpen] = useState(request.status === "pending");
  const type = LEAVE_TYPE_LABEL[request.leave_type] ?? LEAVE_TYPE_LABEL.other;
  const status = LEAVE_STATUS_LABEL[request.status] ?? LEAVE_STATUS_LABEL.pending;
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
                  const url = leaveRequestService.studentEvidenceUrl(courseId, request.id, file);
                  const isPdf = file.toLowerCase().endsWith(".pdf");
                  return (
                    <a key={file} href={url} target="_blank" rel="noreferrer" className="cg-leave-thumb">
                      {isPdf ? <Icon icon="solar:document-linear" width={26} height={26} /> : <img src={url} alt="หลักฐาน" loading="lazy" />}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {request.status === "pending" && (
            <button type="button" className="cg-btn-danger" disabled={busy} onClick={() => onCancel(request.id)}>
              ยกเลิกคำขอ
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── form ─────────────────────────────────────────────────────────────────────

function LeaveForm({ courseId, context, onDone, onBack }: { courseId: string; context: StudentLeaveContext; onDone: () => void; onBack: () => void }) {
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const evidenceRequired = context.evidence_required_types[leaveType];
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
    const urls = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
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

  const removeSelected = (key: string) => setSelected((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
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
  const canSubmit = selectedList.length > 0 && reason.trim().length > 0 && (!evidenceRequired || files.length > 0) && !submitting;

  const submit = async () => {
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await leaveRequestService.submit(courseId, { leave_type: leaveType, reason: reason.trim(), items: selectedList.map((s) => s.input), evidence: files });
      if (!res.success) {
        setError(res.message || "ส่งคำขอไม่สำเร็จ");
        return;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งคำขอไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="cg-link self-start text-[13px]" onClick={onBack}>
        <Icon icon="solar:alt-arrow-left-linear" width={15} height={15} /> กลับไปรายการคำขอ
      </button>

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
                <span className="flex flex-col">
                  <span className="font-medium leading-tight">{meta.th}</span>
                  {context.evidence_required_types[tp] && <span className="text-[10.5px] font-light opacity-80">ต้องแนบหลักฐาน</span>}
                </span>
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
        <div className="cg-field-box">
          <Icon icon="solar:calendar-add-linear" width={18} height={18} style={{ color: "var(--cg-text-3)" }} />
          <input type="date" value={customDate} min={context.window.from} max={context.window.to} onChange={(e) => setCustomDate(e.target.value)} aria-label="วันที่ยังไม่มีคาบเรียน" />
          <button type="button" className="cg-link text-[13px]" onClick={addCustomDate} disabled={!customDate}>เพิ่มวัน</button>
        </div>
        <span className="text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>
          ขอลาย้อนหลังได้ {context.settings.backdate_days} วัน และล่วงหน้าได้ {context.settings.advance_days} วัน วันที่ยังไม่มีคาบเรียนเลือกจากปฏิทินได้ ระบบจะบันทึกให้เมื่อผู้สอนสร้างคาบ
        </span>
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
        <span className="cg-section-label">3. เหตุผล</span>
        <div className="cg-field-box is-multiline">
          <textarea rows={3} value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ป่วยเป็นไข้หวัด มีใบรับรองแพทย์แนบ" />
        </div>
      </div>

      {/* หลักฐาน */}
      <div className="flex flex-col gap-2">
        <span className="cg-section-label">4. หลักฐาน {evidenceRequired ? "(จำเป็น)" : "(ถ้ามี)"}</span>
        <div className="cg-leave-thumbs">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="cg-leave-thumb">
              {previews[i] ? <img src={previews[i]} alt={f.name} /> : <Icon icon="solar:document-linear" width={26} height={26} />}
              <button type="button" className="cg-leave-thumb-x" aria-label="ลบไฟล์" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                <Icon icon="solar:close-linear" width={12} height={12} />
              </button>
            </div>
          ))}
          {files.length < context.limits.max_files && (
            <button type="button" className="cg-leave-add" onClick={() => fileInput.current?.click()}>
              <Icon icon="solar:camera-add-linear" width={20} height={20} />
              เพิ่มไฟล์
            </button>
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
        <span className="text-[11px] font-light" style={{ color: "var(--cg-text-3)" }}>รูปภาพหรือ PDF สูงสุด {context.limits.max_files} ไฟล์ ไฟล์ละไม่เกิน 5 MB ผู้สอนและผู้ช่วยสอนของวิชานี้เท่านั้นที่เห็นไฟล์</span>
      </div>

      {error && (
        <div className="cg-note" style={{ background: "var(--cg-danger-soft)", color: "var(--cg-danger)" }}>
          <Icon icon="solar:danger-circle-linear" width={16} height={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <button type="button" className="cg-btn" disabled={!canSubmit} onClick={submit}>
        {submitting ? "กำลังส่ง..." : "ส่งคำขอลา"}
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
  const [mode, setMode] = useState<"list" | "form" | "done">("list");
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
    return <LeaveForm courseId={courseId} context={context} onBack={() => setMode("list")} onDone={() => { setMode("done"); void load(); }} />;
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
      {notice && mode !== "done" && (
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
        <button type="button" className="cg-cta" disabled={!canCreate} onClick={() => { setNotice(null); setMode("form"); }}>
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
        requests.map((r) => <LeaveRequestCard key={r.id} courseId={courseId} request={r} onCancel={cancel} busy={busy} />)
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useAuthedBlobUrls } from "@/hooks";
import {
  leaveRequestService,
  LEAVE_ITEM_STATUS_LABEL,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  ATTENDANCE_SOURCE_LABEL,
  type AttendanceRecordHistoryItem,
  type LeaveRequest,
  type LeaveRequestCounts,
  type LeaveRequestStatus,
} from "@/services/leaveRequest.service";

interface LeaveRequestsTabProps {
  courseId: string;
  canReview: boolean;
  isCourseActive: boolean;
  onPendingCountChange?: (count: number) => void;
}

type FilterStatus = "pending" | "approved" | "rejected" | "all";
type ChipColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";

const BADGE_COLOR: Record<string, ChipColor> = { success: "success", warning: "warning", danger: "danger", info: "primary", neutral: "default" };

function fmtDate(value: string, isEnglish: boolean) {
  if (!value) return "-";
  const d = value.length === 10 ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  return d.toLocaleDateString(isEnglish ? "en-US" : "th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(value?: string | null, isEnglish = false) {
  if (!value) return "-";
  return new Date(value).toLocaleString(isEnglish ? "en-US" : "th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

const EMPTY_COUNTS: LeaveRequestCounts = { pending: 0, approved: 0, partially_approved: 0, rejected: 0, cancelled: 0, revoked: 0, expired: 0, total: 0 };

export default function LeaveRequestsTab({ courseId, canReview, isCourseActive, onPendingCountChange }: LeaveRequestsTabProps) {
  const { language } = useGlobalSettings();
  const isEnglish = language === "en";
  const L = (th: string, en: string) => (isEnglish ? en : th);

  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [counts, setCounts] = useState<LeaveRequestCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState<LeaveRequest | null>(null);
  const [detailHistory, setDetailHistory] = useState<AttendanceRecordHistoryItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [itemDecisions, setItemDecisions] = useState<Record<number, boolean>>({});
  const [comment, setComment] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<LeaveRequest | null>(null);
  const [revokeComment, setRevokeComment] = useState("");
  const [batchAction, setBatchAction] = useState<"approve" | "reject" | null>(null);
  const [batchComment, setBatchComment] = useState("");

  // ดึงหลักฐานของคำขอที่เปิดดูอยู่เป็น blob URL (ต้อง auth) แทนชี้ <img src>/<a href> ตรง ๆ
  // ไปที่ endpoint เพราะ access token cookie หมดอายุใน 15 นาที ทำให้รูป/ลิงก์พังเงียบ ๆ ถ้าเปิดหน้าไว้นาน
  const detailEvidencePaths = useMemo(
    () => (detail ? detail.evidence_list.map((file) => leaveRequestService.evidencePath(detail.id, file)) : []),
    [detail],
  );
  const evidenceBlobUrls = useAuthedBlobUrls(detailEvidencePaths);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = filter === "approved" ? "" : filter === "all" ? "" : filter;
      const res = await leaveRequestService.list(courseId, { status: statusParam || undefined, limit: 200 });
      let list = res.success && res.data ? res.data : [];
      if (filter === "approved") list = list.filter((r) => r.status === "approved" || r.status === "partially_approved");
      setRequests(list);
      if (res.meta?.counts) {
        setCounts(res.meta.counts);
        onPendingCountChange?.(res.meta.counts.pending);
      }
    } catch {
      addToast({ title: L("โหลดคำขอลาไม่สำเร็จ", "Failed to load leave requests"), color: "danger" });
    } finally {
      setLoading(false);
      setSelectedIds(new Set());
    }
  }, [courseId, filter, onPendingCountChange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (r: LeaveRequest) => {
    setDetail(r);
    setComment("");
    setItemDecisions(Object.fromEntries(r.items.filter((i) => i.item_status === "pending").map((i) => [i.id, true])));
    setDetailLoading(true);
    try {
      const res = await leaveRequestService.get(r.id);
      if (res.success && res.data) setDetail(res.data);
      setDetailHistory(res.meta?.student_history ?? []);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReview = async (mode: "approve" | "reject" | "partial") => {
    if (!detail) return;
    setBusy(true);
    try {
      const input = mode === "partial"
        ? { comment, items: detail.items.filter((i) => i.item_status === "pending").map((i) => ({ item_id: i.id, approved: Boolean(itemDecisions[i.id]) })) }
        : { approved: mode === "approve", comment };
      const res = await leaveRequestService.review(detail.id, input);
      if (!res.success) {
        addToast({ title: res.message || L("บันทึกไม่สำเร็จ", "Failed"), color: "danger" });
        return;
      }
      addToast({ title: L("บันทึกผลการพิจารณาแล้ว ระบบส่งอีเมลแจ้งนักศึกษาแล้ว", "Decision saved and emailed to the student"), color: "success" });
      setDetail(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submitRevoke = async () => {
    if (!revokeTarget || !revokeComment.trim()) return;
    setBusy(true);
    try {
      const res = await leaveRequestService.revoke(revokeTarget.id, revokeComment.trim());
      if (!res.success) {
        addToast({ title: res.message || L("ถอนการอนุมัติไม่สำเร็จ", "Failed"), color: "danger" });
        return;
      }
      addToast({ title: L("ถอนการอนุมัติแล้ว สถานะเช็กชื่อถูกคืนค่า", "Approval revoked; attendance restored"), color: "success" });
      setRevokeTarget(null);
      setRevokeComment("");
      setDetail(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submitBatch = async () => {
    if (!batchAction || selectedIds.size === 0) return;
    setBusy(true);
    try {
      const res = await leaveRequestService.batchReview(Array.from(selectedIds), batchAction === "approve", batchComment.trim() || undefined);
      if (!res.success) {
        addToast({ title: res.message || L("ดำเนินการไม่สำเร็จ", "Failed"), color: "danger" });
        return;
      }
      const failed = res.data?.failed?.length ?? 0;
      addToast({ title: `${L("พิจารณาแล้ว", "Reviewed")} ${res.data?.processed ?? 0} ${L("คำขอ", "request(s)")}${failed ? ` (${L("ไม่สำเร็จ", "failed")} ${failed})` : ""}`, color: failed ? "warning" : "success" });
      setBatchAction(null);
      setBatchComment("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const pendingIds = useMemo(() => requests.filter((r) => r.status === "pending").map((r) => r.id), [requests]);
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));
  const pendingItemsInDetail = detail?.items.filter((i) => i.item_status === "pending") ?? [];
  const partialCount = pendingItemsInDetail.filter((i) => itemDecisions[i.id]).length;

  const statusChip = (status: LeaveRequestStatus) => {
    const meta = LEAVE_STATUS_LABEL[status] ?? LEAVE_STATUS_LABEL.pending;
    return <Chip size="sm" variant="flat" color={BADGE_COLOR[meta.badge]}>{isEnglish ? meta.en : meta.th}</Chip>;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{L("คำขอลา", "Leave requests")}</h2>
          <p className="text-sm text-default-500">{L("อนุมัติแล้วระบบจะบันทึกสถานะ \"ลา\" ให้อัตโนมัติ และแจ้งผลนักศึกษาทางอีเมล", "Approved days are recorded as leave automatically and the student is emailed.")}</p>
        </div>
        <Button size="sm" variant="flat" startContent={<Icon icon="solar:refresh-linear" width={16} />} onPress={() => void load()} isLoading={loading}>
          {L("รีเฟรช", "Refresh")}
        </Button>
      </div>

      <Tabs selectedKey={filter} onSelectionChange={(k) => setFilter(k as FilterStatus)} variant="underlined" size="sm">
        <Tab key="pending" title={<span className="flex items-center gap-1.5">{L("รอพิจารณา", "Pending")}{counts.pending > 0 && <Chip size="sm" color="warning" variant="flat">{counts.pending}</Chip>}</span>} />
        <Tab key="approved" title={`${L("อนุมัติแล้ว", "Approved")} (${counts.approved + counts.partially_approved})`} />
        <Tab key="rejected" title={`${L("ไม่อนุมัติ", "Rejected")} (${counts.rejected})`} />
        <Tab key="all" title={`${L("ทั้งหมด", "All")} (${counts.total})`} />
      </Tabs>

      {canReview && filter === "pending" && pendingIds.length > 0 && (
        <Card shadow="sm"><CardBody className="flex flex-row flex-wrap items-center gap-3 py-2">
          <Checkbox size="sm" isSelected={allSelected} onValueChange={(v) => setSelectedIds(v ? new Set(pendingIds) : new Set())}>
            {L("เลือกทั้งหมด", "Select all")} ({selectedIds.size}/{pendingIds.length})
          </Checkbox>
          <div className="ml-auto flex gap-2">
            <Button size="sm" color="success" variant="flat" isDisabled={selectedIds.size === 0 || !isCourseActive} onPress={() => setBatchAction("approve")} startContent={<Icon icon="solar:check-circle-linear" width={16} />}>{L("อนุมัติที่เลือก", "Approve selected")}</Button>
            <Button size="sm" color="danger" variant="flat" isDisabled={selectedIds.size === 0 || !isCourseActive} onPress={() => setBatchAction("reject")} startContent={<Icon icon="solar:close-circle-linear" width={16} />}>{L("ปฏิเสธที่เลือก", "Reject selected")}</Button>
          </div>
        </CardBody></Card>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : requests.length === 0 ? (
        <Card shadow="sm"><CardBody className="flex flex-col items-center gap-2 py-10 text-default-400">
          <Icon icon="solar:document-text-linear" width={36} />
          <span className="text-sm">{L("ไม่มีคำขอลาในหมวดนี้", "No leave requests here")}</span>
        </CardBody></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => {
            const type = LEAVE_TYPE_LABEL[r.leave_type] ?? LEAVE_TYPE_LABEL.other;
            return (
              <Card key={r.id} shadow="sm" isPressable onPress={() => void openDetail(r)} className="w-full">
                <CardBody className="flex flex-row items-start gap-3 py-3">
                  {canReview && r.status === "pending" && (
                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation" className="pt-0.5">
                      <Checkbox size="sm" isSelected={selectedIds.has(r.id)} onValueChange={(v) => setSelectedIds((prev) => { const n = new Set(prev); if (v) n.add(r.id); else n.delete(r.id); return n; })} />
                    </div>
                  )}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <Icon icon={type.icon} width={20} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-default-400">LR-{r.id}</span>
                      <span className="font-medium">{r.student?.student_id} {r.student?.full_name}</span>
                      {statusChip(r.status)}
                      <Chip size="sm" variant="bordered">{isEnglish ? type.en : type.th}</Chip>
                      {r.evidence_list.length > 0 && <Chip size="sm" variant="flat" startContent={<Icon icon="solar:paperclip-linear" width={13} />}>{r.evidence_list.length}</Chip>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs text-default-500">
                      {r.items.map((it) => {
                        const st = LEAVE_ITEM_STATUS_LABEL[it.item_status];
                        return (
                          <span key={it.id} className="rounded-md bg-default-100 px-2 py-0.5">
                            {fmtDate(it.leave_date_string, isEnglish)}{it.session_title ? ` · ${it.session_title}` : ""}
                            {r.status !== "pending" && st ? ` · ${isEnglish ? st.en : st.th}` : ""}
                          </span>
                        );
                      })}
                    </div>
                    <p className="line-clamp-2 text-sm text-default-600">{r.reason}</p>
                    <span className="text-xs text-default-400">{L("ส่งเมื่อ", "Submitted")} {fmtDateTime(r.created_at, isEnglish)}{r.reviewed_at ? ` · ${L("พิจารณาเมื่อ", "Reviewed")} ${fmtDateTime(r.reviewed_at, isEnglish)}${r.reviewer ? ` (${r.reviewer.full_name})` : ""}` : ""}</span>
                  </div>
                  <Icon icon="solar:alt-arrow-right-linear" width={18} className="shrink-0 text-default-400" />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* detail modal */}
      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {detail && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  {L("คำขอลา", "Leave request")} <span className="font-mono text-default-500">LR-{detail.id}</span> {statusChip(detail.status)}
                </span>
                <span className="text-sm font-normal text-default-500">{detail.student?.student_id} {detail.student?.full_name} · {isEnglish ? LEAVE_TYPE_LABEL[detail.leave_type]?.en : LEAVE_TYPE_LABEL[detail.leave_type]?.th}</span>
              </ModalHeader>
              <ModalBody className="gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-default-400">{L("เหตุผล", "Reason")}</p>
                  <p className="whitespace-pre-wrap text-sm">{detail.reason}</p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-default-400">{L("วันที่ขอลา", "Requested days")}</p>
                  <div className="flex flex-col gap-1.5">
                    {detail.items.map((it) => {
                      const st = LEAVE_ITEM_STATUS_LABEL[it.item_status] ?? LEAVE_ITEM_STATUS_LABEL.pending;
                      const pending = it.item_status === "pending";
                      return (
                        <div key={it.id} className="flex items-center gap-3 rounded-lg bg-default-50 px-3 py-2">
                          {canReview && pending && detail.status === "pending" && (
                            <Checkbox size="sm" isSelected={Boolean(itemDecisions[it.id])} onValueChange={(v) => setItemDecisions((prev) => ({ ...prev, [it.id]: v }))} />
                          )}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-medium">{fmtDate(it.leave_date_string, isEnglish)}</span>
                            <span className="text-xs text-default-500">
                              {it.session_title ? `${it.session_title} ${fmtTime(it.session_start)}` : L("ยังไม่มีคาบเรียน ระบบจะบันทึกให้เมื่อสร้างคาบ", "No session yet; recorded when one is created")}
                              {it.record_status && ` · ${L("สถานะปัจจุบัน", "current")}: ${it.record_status}${it.record_source ? ` (${isEnglish ? ATTENDANCE_SOURCE_LABEL[it.record_source]?.en : ATTENDANCE_SOURCE_LABEL[it.record_source]?.th})` : ""}`}
                            </span>
                            {it.review_comment && <span className="text-xs text-default-500">{L("ความเห็น", "Note")}: {it.review_comment}</span>}
                          </div>
                          <Chip size="sm" variant="flat" color={BADGE_COLOR[st.badge]}>{isEnglish ? st.en : st.th}</Chip>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {detail.evidence_list.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-default-400">{L("หลักฐาน", "Evidence")} ({detail.evidence_list.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {detail.evidence_list.map((file) => {
                        const path = leaveRequestService.evidencePath(detail.id, file);
                        const blobUrl = evidenceBlobUrls[path];
                        const isPdf = file.toLowerCase().endsWith(".pdf");
                        if (blobUrl === null) {
                          return (
                            <div key={file} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-danger-200 bg-danger-50 text-danger-500">
                              <Icon icon="solar:danger-triangle-linear" width={22} />
                              <span className="text-[10px]">{L("เปิดไม่ได้", "Failed")}</span>
                            </div>
                          );
                        }
                        if (!blobUrl) {
                          return (
                            <div key={file} className="flex h-24 w-24 items-center justify-center rounded-lg border border-default-200 bg-default-100">
                              <Spinner size="sm" />
                            </div>
                          );
                        }
                        return (
                          <a key={file} href={blobUrl} target="_blank" rel="noreferrer" className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-default-200 bg-default-100">
                            {isPdf ? <Icon icon="solar:document-linear" width={30} className="text-default-500" /> : <img src={blobUrl} alt="evidence" className="h-full w-full object-cover" loading="lazy" />}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {detail.review_comment && (
                  <div className="rounded-lg bg-primary-50 px-3 py-2 text-sm">
                    <span className="font-medium">{L("ความเห็นผู้ตรวจ", "Reviewer comment")}{detail.reviewer ? ` (${detail.reviewer.full_name})` : ""}:</span> {detail.review_comment}
                  </div>
                )}

                {detailLoading ? <Spinner size="sm" /> : detailHistory.length > 0 && (
                  <div>
                    <Divider className="mb-3" />
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-default-400">{L("ประวัติสถานะเช็กชื่อของนักศึกษาในวิชานี้", "Student's attendance status history in this course")}</p>
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs">
                      {detailHistory.map((h) => {
                        const src = ATTENDANCE_SOURCE_LABEL[h.source];
                        return (
                          <div key={h.id} className="flex items-center gap-2 text-default-600">
                            <span className="w-32 shrink-0 text-default-400">{fmtDateTime(h.created_at, isEnglish)}</span>
                            <span className="rounded bg-default-100 px-1.5">{h.from_status || "-"}</span>
                            <Icon icon="solar:arrow-right-linear" width={12} />
                            <span className="rounded bg-default-100 px-1.5">{h.to_status}</span>
                            <span className="flex items-center gap-1 text-default-500"><Icon icon={src?.icon ?? "solar:info-circle-linear"} width={12} />{isEnglish ? src?.en : src?.th}{h.actor_name ? ` · ${h.actor_name}` : ""}</span>
                            {h.leave_request_id && <span className="text-default-400">#{h.leave_request_id}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canReview && detail.status === "pending" && (
                  <Textarea label={L("ความเห็นถึงนักศึกษา (ไม่บังคับ)", "Comment to student (optional)")} value={comment} onValueChange={setComment} minRows={2} maxLength={2000} />
                )}
              </ModalBody>
              <ModalFooter className="flex-wrap">
                <Button variant="light" onPress={() => setDetail(null)}>{L("ปิด", "Close")}</Button>
                {canReview && detail.status === "pending" && isCourseActive && (
                  <>
                    <Button color="danger" variant="flat" isLoading={busy} onPress={() => void submitReview("reject")}>{L("ไม่อนุมัติทั้งหมด", "Reject all")}</Button>
                    {pendingItemsInDetail.length > 1 && partialCount > 0 && partialCount < pendingItemsInDetail.length && (
                      <Button color="primary" variant="flat" isLoading={busy} onPress={() => void submitReview("partial")}>{L("อนุมัติเฉพาะที่เลือก", "Approve selected")} ({partialCount})</Button>
                    )}
                    <Button color="success" isLoading={busy} onPress={() => void submitReview("approve")}>{L("อนุมัติทั้งหมด", "Approve all")}</Button>
                  </>
                )}
                {canReview && (detail.status === "approved" || detail.status === "partially_approved") && isCourseActive && (
                  <Button color="warning" variant="flat" onPress={() => { setRevokeTarget(detail); setRevokeComment(""); }}>{L("ถอนการอนุมัติ", "Revoke approval")}</Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* revoke modal */}
      <Modal isOpen={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)} size="md">
        <ModalContent>
          <ModalHeader>{L("ถอนการอนุมัติคำขอลา", "Revoke leave approval")}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">{L("สถานะเช็กชื่อของวันที่บันทึกเป็น \"ลา\" จากคำขอนี้จะถูกคืนเป็นสถานะก่อนหน้า และแจ้งนักศึกษาทางอีเมล", "Days recorded as leave by this request will be restored to their previous status, and the student will be emailed.")}</p>
            <Textarea label={L("เหตุผล (จำเป็น)", "Reason (required)")} value={revokeComment} onValueChange={setRevokeComment} minRows={2} maxLength={2000} isRequired />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setRevokeTarget(null)}>{L("ยกเลิก", "Cancel")}</Button>
            <Button color="warning" isLoading={busy} isDisabled={!revokeComment.trim()} onPress={() => void submitRevoke()}>{L("ยืนยันถอนการอนุมัติ", "Revoke")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* batch modal */}
      <Modal isOpen={Boolean(batchAction)} onClose={() => setBatchAction(null)} size="md">
        <ModalContent>
          <ModalHeader>{batchAction === "approve" ? L("อนุมัติคำขอที่เลือก", "Approve selected requests") : L("ปฏิเสธคำขอที่เลือก", "Reject selected requests")} ({selectedIds.size})</ModalHeader>
          <ModalBody>
            <Textarea label={L("ความเห็นถึงนักศึกษา (ไม่บังคับ)", "Comment to students (optional)")} value={batchComment} onValueChange={setBatchComment} minRows={2} maxLength={2000} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setBatchAction(null)}>{L("ยกเลิก", "Cancel")}</Button>
            <Button color={batchAction === "approve" ? "success" : "danger"} isLoading={busy} onPress={() => void submitBatch()}>{L("ยืนยัน", "Confirm")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Icon } from "@iconify/react";
import type { ActivityLog, ResolvedRef } from "@/services/courseActivityLog.service";
import {
  buildDetailParts,
  formatDevice,
  formatRef,
  formatTarget,
  getRefTypeLabel,
  isOutsiderAdminView,
  isSystemDetectedEvent,
} from "./activityDetail";

interface ActivityLogDetailModalProps {
  log: ActivityLog | null;
  isOpen: boolean;
  onClose: () => void;
  isEnglish: boolean;
  actionLabel: string;
  categoryLabel: string;
  categoryIcon: string;
  roleLabel: string;
  /** Narrows the whole timeline to one entity; also closes this dialog. */
  onSubjectSelect?: (ref: ResolvedRef) => void;
}

function FieldRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon icon={icon} width={16} className="mt-0.5 shrink-0 text-default-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-default-500">{label}</p>
        <div className="text-sm text-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

export default function ActivityLogDetailModal({
  log,
  isOpen,
  onClose,
  isEnglish,
  actionLabel,
  categoryLabel,
  categoryIcon,
  roleLabel,
  onSubjectSelect,
}: ActivityLogDetailModalProps) {
  const [showRaw, setShowRaw] = useState(false);

  const parts = useMemo(
    () => (log ? buildDetailParts(log, isEnglish) : []),
    [log, isEnglish],
  );

  const targetText = log ? formatTarget(log, isEnglish) : "";
  const systemDetected = log ? isSystemDetectedEvent(log) : false;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setShowRaw(false);
          onClose();
        }
      }}
      size="2xl"
      scrollBehavior="inside"
      classNames={{ backdrop: "bg-black/40" }}
    >
      <ModalContent>
        {log && (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon={categoryIcon} className="text-xl text-primary" />
                <span>{actionLabel}</span>
              </div>
              <p className="text-sm font-normal text-default-500">
                {new Date(log.created_at).toLocaleString(isEnglish ? "en-US" : "th-TH", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </ModalHeader>

            <ModalBody className="gap-4 py-2">
              {isOutsiderAdminView(log) && (
                <div className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 p-3 dark:bg-danger-100/10">
                  <Icon icon="solar:shield-warning-bold" className="mt-0.5 shrink-0 text-danger-600" width={18} />
                  <p className="text-sm text-danger-700 dark:text-danger-400">
                    {isEnglish
                      ? "This was an admin who is not an instructor or TA on this course."
                      : "รายการนี้เกิดจากแอดมินที่ไม่ได้เป็นอาจารย์หรือผู้ช่วยสอนในรายวิชานี้"}
                  </p>
                </div>
              )}

              {/* Actor */}
              <div className="rounded-xl border border-default-200 p-3">
                <p className="mb-2 text-xs font-semibold text-default-500">
                  {systemDetected
                    ? (isEnglish ? "Detected by the system" : "ระบบตรวจพบ")
                    : (isEnglish ? "Performed by" : "ผู้ดำเนินการ")}
                </p>
                <div className="flex items-center gap-3">
                  {systemDetected ? (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-content2">
                      <Icon icon="solar:shield-check-bold" width={20} className="text-default-500" />
                    </div>
                  ) : (
                    <Avatar
                      name={log.actor?.full_name || "Unknown"}
                      src={log.actor?.avatar || undefined}
                      size="md"
                      className="shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {systemDetected
                        ? (targetText || (isEnglish ? "Student" : "นักศึกษา"))
                        : (log.actor?.full_name || (isEnglish ? "Unknown user" : "ไม่ทราบผู้ใช้"))}
                    </p>
                    <p className="truncate text-xs text-default-500">
                      {log.actor_email || log.actor?.email || "-"}
                    </p>
                  </div>
                  {!systemDetected && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color={(log.actor_role || log.actor?.role) === "admin" ? "danger" : "primary"}
                      className="ml-auto shrink-0"
                    >
                      {roleLabel}
                    </Chip>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  <FieldRow icon="solar:global-linear" label="IP Address">
                    <span className="font-mono text-xs">{log.ip_address || "-"}</span>
                  </FieldRow>
                  <FieldRow
                    icon="solar:smartphone-linear"
                    label={isEnglish ? "Device" : "อุปกรณ์"}
                  >
                    {formatDevice(log, isEnglish)}
                    {log.device_type ? (
                      <span className="text-default-400"> ({log.device_type})</span>
                    ) : null}
                  </FieldRow>
                </div>
              </div>

              {/* Context */}
              <div className="rounded-xl border border-default-200 p-3">
                <p className="mb-1 text-xs font-semibold text-default-500">
                  {isEnglish ? "Context" : "บริบท"}
                </p>
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  <FieldRow icon="solar:widget-linear" label={isEnglish ? "Category" : "หมวดหมู่"}>
                    {categoryLabel}
                  </FieldRow>
                  <FieldRow icon="solar:target-linear" label={isEnglish ? "Target" : "เป้าหมาย"}>
                    {targetText ? (
                      <>
                        {log.target_ref && onSubjectSelect ? (
                          <button
                            type="button"
                            className="text-primary-600 hover:underline"
                            onClick={() => log.target_ref && onSubjectSelect(log.target_ref)}
                          >
                            {targetText}
                          </button>
                        ) : (
                          targetText
                        )}
                        {log.target_type ? (
                          <span className="text-default-400">
                            {" "}
                            ({getRefTypeLabel(log.target_type, isEnglish)})
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-default-400">-</span>
                    )}
                  </FieldRow>
                </div>
              </div>

              {/* Details */}
              <div className="rounded-xl border border-default-200 p-3">
                <p className="mb-1 text-xs font-semibold text-default-500">
                  {isEnglish ? "What changed" : "รายละเอียดที่เกิดขึ้น"}
                </p>
                {parts.length === 0 ? (
                  <p className="py-2 text-sm text-default-400">
                    {isEnglish ? "No extra detail recorded." : "ไม่มีรายละเอียดเพิ่มเติมที่บันทึกไว้"}
                  </p>
                ) : (
                  <div className="divide-y divide-default-100">
                    {parts.map((part) => (
                      <div key={part.key} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
                        <p className="w-full shrink-0 text-xs text-default-500 sm:w-48 sm:pt-0.5">
                          {part.label}
                        </p>
                        <div className="min-w-0 flex-1">
                          {part.change ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-content2 px-1.5 py-0.5 text-sm text-default-500 line-through decoration-default-400">
                                {part.change.from}
                              </span>
                              <Icon icon="solar:arrow-right-linear" width={14} className="text-default-400" />
                              <span
                                className={
                                  part.tone === "score"
                                    ? "rounded-md bg-amber-100 px-1.5 py-0.5 text-sm font-semibold text-amber-700 dark:bg-amber-100/20 dark:text-amber-400"
                                    : "rounded-md bg-success-100 px-1.5 py-0.5 text-sm font-medium text-success-700 dark:bg-success-100/20 dark:text-success-400"
                                }
                              >
                                {part.change.to}
                              </span>
                            </span>
                          ) : part.refs && part.refs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {part.refs.map((ref) => (
                                <Chip
                                  key={`${ref.type}-${ref.id}`}
                                  size="sm"
                                  variant="flat"
                                  color={onSubjectSelect ? "primary" : "default"}
                                  className={onSubjectSelect ? "cursor-pointer" : undefined}
                                  onClick={onSubjectSelect ? () => onSubjectSelect(ref) : undefined}
                                >
                                  {formatRef(ref, isEnglish)}
                                </Chip>
                              ))}
                            </div>
                          ) : (
                            <span
                              className={
                                part.tone === "score"
                                  ? "text-sm font-semibold text-amber-600"
                                  : part.tone === "warn"
                                    ? "text-sm font-medium text-danger-600"
                                    : "text-sm text-foreground"
                              }
                            >
                              {part.text}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Raw payload, for verification */}
              <div>
                <Button
                  size="sm"
                  variant="light"
                  className="text-default-500"
                  startContent={
                    <Icon
                      icon={showRaw ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                      width={14}
                    />
                  }
                  onPress={() => setShowRaw((prev) => !prev)}
                >
                  {isEnglish ? "Raw data" : "ข้อมูลดิบ"}
                </Button>
                {showRaw && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-content2 p-3 text-xs text-default-600">
                    {JSON.stringify(
                      {
                        id: log.id,
                        action: log.action,
                        category: log.category,
                        target_type: log.target_type,
                        target_id: log.target_id,
                        detail: log.detail,
                        user_agent: log.user_agent,
                        created_at: log.created_at,
                      },
                      null,
                      2,
                    )}
                  </pre>
                )}
              </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" className="text-default-600" onPress={onClose}>
                {isEnglish ? "Close" : "ปิด"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

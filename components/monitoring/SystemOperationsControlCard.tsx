"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Chip } from "@heroui/chip";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";

import { useI18n } from "@/hooks/useI18n";
import { stepUpService } from "@/services/step-up.service";
import { systemOperationsService, type SystemOperationRecord } from "@/services/system-operations.service";
import { OperationTimelineCard } from "./OperationTimelineCard";

type OperationKind = "restart" | "reboot" | "cancel";

interface PendingOperation {
  kind: OperationKind;
  action: string;
  payload:
    | { service: string; reason: string; dry_run: boolean; force: boolean }
    | { reason: string; delay_seconds: number; dry_run: boolean; force: boolean }
    | { operation_id: string; reason: string };
}

interface SystemOperationsControlCardProps {
  title?: string;
  description?: string;
  limit?: number;
}

function actionLabel(action: SystemOperationRecord["action"], t: ReturnType<typeof useI18n>): string {
  if (action === "restart_service") return t("adminSystemOpsActionRestart");
  return t("adminSystemOpsActionReboot");
}

function statusLabel(status: SystemOperationRecord["status"], t: ReturnType<typeof useI18n>): string {
  if (status === "success") return t("adminSystemOpsStatusSuccess");
  if (status === "failed") return t("adminSystemOpsStatusFailed");
  return t("adminSystemOpsStatusCancelled");
}

function getMetaNumber(row: SystemOperationRecord, key: string): number {
  const raw = row.meta?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function SystemOperationsControlCard({
  title,
  description,
  limit = 5,
}: SystemOperationsControlCardProps) {
  const t = useI18n();
  const [isRunningOperation, setIsRunningOperation] = useState(false);
  const [operationHistory, setOperationHistory] = useState<SystemOperationRecord[]>([]);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [operationKind, setOperationKind] = useState<OperationKind>("restart");
  const [operationService, setOperationService] = useState("api");
  const [operationReason, setOperationReason] = useState("operational maintenance");
  const [operationDelaySeconds, setOperationDelaySeconds] = useState("30");
  const [operationDryRun, setOperationDryRun] = useState(false);
  const [operationForce, setOperationForce] = useState(false);
  const [cancelReason, setCancelReason] = useState("cancel requested by admin");
  const [isStepUpModalOpen, setIsStepUpModalOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState("");
  const [stepUpMethod, setStepUpMethod] = useState<"totp" | "email">("totp");
  const [stepUpCode, setStepUpCode] = useState("");
  const [isStepUpVerifying, setIsStepUpVerifying] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());

  const loadOperationHistory = useCallback(async () => {
    const rows = await systemOperationsService.getHistory();
    setOperationHistory(rows.slice(0, limit));
  }, [limit]);

  const getCancelRemainingSeconds = useCallback((row: SystemOperationRecord): number => {
    const delay = getMetaNumber(row, "delay_seconds");
    if (delay <= 0) return 0;
    const requestedAt = new Date(row.requested_at).getTime();
    if (!Number.isFinite(requestedAt)) return 0;
    const elapsed = Math.floor((nowTickMs - requestedAt) / 1000);
    return Math.max(0, Math.floor(delay - elapsed));
  }, [nowTickMs]);

  const isCancellableReboot = useCallback((row: SystemOperationRecord): boolean => {
    if (row.action !== "reboot_host") return false;
    if (row.status !== "success" || row.dry_run) return false;
    return getCancelRemainingSeconds(row) > 0;
  }, [getCancelRemainingSeconds]);

  const shouldPollOperationHistory = useMemo(() => {
    if (isRunningOperation) return true;
    return operationHistory.some((row) => isCancellableReboot(row));
  }, [isRunningOperation, operationHistory, isCancellableReboot]);

  useEffect(() => {
    loadOperationHistory();
  }, [loadOperationHistory]);

  useEffect(() => {
    if (!shouldPollOperationHistory) return;
    const timer = setInterval(() => {
      loadOperationHistory();
    }, 5000);
    return () => clearInterval(timer);
  }, [shouldPollOperationHistory, loadOperationHistory]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTickMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [t]);

  const ensureStepUpToken = useCallback(async (action: string): Promise<string | null> => {
    const cached = stepUpService.getCachedToken(action);
    if (cached) return cached;

    const challenge = await stepUpService.requestChallenge(action);
    if (!challenge) {
      const err = stepUpService.getLastChallengeError();
      addToast({
        title: t("error"),
        description: err?.message || t("adminSystemOpsStepUpChallengeFailed"),
        color: "danger",
      });
      return null;
    }

    setStepUpAction(action);
    setStepUpMethod(challenge.method);
    setStepUpCode("");
    setIsStepUpModalOpen(true);
    return null;
  }, []);

  const executePendingOperation = useCallback(async (nextOperation: PendingOperation, token: string) => {
    setIsRunningOperation(true);

    if (nextOperation.kind === "restart") {
      const result = await systemOperationsService.restartService(
        nextOperation.payload as { service: string; reason: string; dry_run?: boolean; force?: boolean },
        token,
      );
      if (!result && systemOperationsService.getLastError()?.code === "STEP_UP_REQUIRED") {
        stepUpService.clearCachedToken(nextOperation.action);
        addToast({ title: t("warning"), description: t("adminSystemOpsStepUpExpired"), color: "warning" });
      }
      setIsRunningOperation(false);
      if (!result) {
        const err = systemOperationsService.getLastError();
        addToast({ title: t("error"), description: err?.message || t("adminSystemOpsRestartFailed"), color: "danger" });
        return;
      }
      addToast({ title: t("success"), description: t("adminSystemOpsRestartSuccess", { target: result.target, status: statusLabel(result.status, t) }), color: "success" });
      await loadOperationHistory();
      return;
    }

    if (nextOperation.kind === "reboot") {
      const result = await systemOperationsService.rebootHost(
        nextOperation.payload as { reason: string; delay_seconds?: number; dry_run?: boolean; force?: boolean },
        token,
      );
      if (!result && systemOperationsService.getLastError()?.code === "STEP_UP_REQUIRED") {
        stepUpService.clearCachedToken(nextOperation.action);
        addToast({ title: t("warning"), description: t("adminSystemOpsStepUpExpired"), color: "warning" });
      }
      setIsRunningOperation(false);
      if (!result) {
        const err = systemOperationsService.getLastError();
        addToast({ title: t("error"), description: err?.message || t("adminSystemOpsRebootFailed"), color: "danger" });
        return;
      }
      addToast({ title: t("success"), description: t("adminSystemOpsRebootSuccess", { status: statusLabel(result.status, t) }), color: "success" });
      await loadOperationHistory();
      return;
    }

    const result = await systemOperationsService.cancelOperation(
      nextOperation.payload as { operation_id: string; reason: string },
      token,
    );
    if (!result && systemOperationsService.getLastError()?.code === "STEP_UP_REQUIRED") {
      stepUpService.clearCachedToken(nextOperation.action);
      addToast({ title: t("warning"), description: t("adminSystemOpsStepUpExpired"), color: "warning" });
    }
    setIsRunningOperation(false);
    if (!result) {
      const err = systemOperationsService.getLastError();
      addToast({ title: t("error"), description: err?.message || t("adminSystemOpsCancelFailed"), color: "danger" });
      return;
    }
    addToast({ title: t("success"), description: t("adminSystemOpsCancelSuccess", { action: actionLabel(result.action, t), status: statusLabel(result.status, t) }), color: "success" });
    await loadOperationHistory();
  }, [loadOperationHistory, t]);

  const requestStepUpAndExecute = useCallback(async (nextOperation: PendingOperation) => {
    const token = stepUpService.getCachedToken(nextOperation.action);
    if (token) {
      await executePendingOperation(nextOperation, token);
      return;
    }

    setPendingOperation(nextOperation);
    await ensureStepUpToken(nextOperation.action);
  }, [ensureStepUpToken, executePendingOperation]);

  const openRestartModal = useCallback(() => {
    setOperationKind("restart");
    setOperationService("api");
    setOperationReason("operational maintenance");
    setOperationDryRun(false);
    setOperationForce(false);
    setIsOpModalOpen(true);
  }, []);

  const openRebootModal = useCallback(() => {
    setOperationKind("reboot");
    setOperationDelaySeconds("30");
    setOperationReason("scheduled maintenance");
    setOperationDryRun(false);
    setOperationForce(false);
    setIsOpModalOpen(true);
  }, []);

  const handleCancelOperation = useCallback(async (record: SystemOperationRecord) => {
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      addToast({
        title: t("warning"),
        description: t("adminSystemOpsCancelReasonMin"),
        color: "warning",
      });
      return;
    }

    const operation: PendingOperation = {
      kind: "cancel",
      action: "system.monitoring.operations.cancel",
      payload: { operation_id: record.id, reason },
    };
    await requestStepUpAndExecute(operation);
  }, [cancelReason, requestStepUpAndExecute, t]);

  const handleRetryOperation = useCallback((record: SystemOperationRecord) => {
    if (record.action === "restart_service") {
      setOperationKind("restart");
      setOperationService(record.target || "api");
      setOperationReason(`${t("adminSystemOpsRetryPrefix")}: ${record.reason}`.slice(0, 200));
      setOperationDryRun(false);
      setOperationForce(false);
      setIsOpModalOpen(true);
      return;
    }

    if (record.action === "reboot_host") {
      setOperationKind("reboot");
      const delay = getMetaNumber(record, "delay_seconds");
      setOperationDelaySeconds(String(delay > 0 ? Math.floor(delay) : 30));
      setOperationReason(`${t("adminSystemOpsRetryPrefix")}: ${record.reason}`.slice(0, 200));
      setOperationDryRun(false);
      setOperationForce(false);
      setIsOpModalOpen(true);
    }
  }, [t]);

  const handleSubmitOperation = useCallback(async () => {
    const reason = operationReason.trim();
    if (reason.length < 5) {
      addToast({
        title: t("warning"),
        description: t("adminSystemOpsReasonMin"),
        color: "warning",
      });
      return;
    }

    if (operationKind === "restart") {
      const operation: PendingOperation = {
        kind: "restart",
        action: "system.monitoring.operations.restart_service",
        payload: {
          service: operationService,
          reason,
          dry_run: operationDryRun,
          force: operationForce,
        },
      };
      setIsOpModalOpen(false);
      await requestStepUpAndExecute(operation);
      return;
    }

    const parsedDelay = Number.parseInt(operationDelaySeconds, 10);
    const delaySeconds = Number.isFinite(parsedDelay) && parsedDelay >= 0 ? parsedDelay : 30;
    const operation: PendingOperation = {
      kind: "reboot",
      action: "system.monitoring.operations.reboot_host",
      payload: {
        reason,
        delay_seconds: delaySeconds,
        dry_run: operationDryRun,
        force: operationForce,
      },
    };
    setIsOpModalOpen(false);
    await requestStepUpAndExecute(operation);
  }, [operationKind, operationReason, operationService, operationDryRun, operationForce, operationDelaySeconds, requestStepUpAndExecute, t]);

  const handleVerifyStepUp = useCallback(async () => {
    if (!pendingOperation || !stepUpAction) return;
    const code = stepUpCode.trim();
    if (code.length < 6) {
      addToast({
        title: t("warning"),
        description: t("adminSystemOpsStepUpInvalidCode"),
        color: "warning",
      });
      return;
    }

    setIsStepUpVerifying(true);
    const token = await stepUpService.verifyChallenge(stepUpAction, code);
    setIsStepUpVerifying(false);
    if (!token) {
      addToast({
        title: t("error"),
        description: t("adminSystemOpsStepUpVerifyFailed"),
        color: "danger",
      });
      return;
    }

    setIsStepUpModalOpen(false);
    setStepUpCode("");
    setStepUpAction("");
    const nextOperation = pendingOperation;
    setPendingOperation(null);
    await executePendingOperation(nextOperation, token);
  }, [pendingOperation, stepUpAction, stepUpCode, executePendingOperation, t]);

  return (
    <>
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="pb-1 pt-3 px-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-default-500 font-medium">{title ?? t("adminSystemOpsTitle")}</p>
            <p className="text-xs text-default-400 mt-0.5">{description ?? t("adminSystemOpsDescription")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="flat" color="warning" isLoading={isRunningOperation} onPress={openRestartModal}>
              {t("adminSystemOpsRestartService")}
            </Button>
            <Button size="sm" variant="flat" color="danger" isLoading={isRunningOperation} onPress={openRebootModal}>
              {t("adminSystemOpsRebootHost")}
            </Button>
          </div>
        </CardHeader>
        <CardBody className="pt-2 px-4 pb-4 space-y-4">
          <div>
            <Textarea
              label={t("adminSystemOpsCancelReason")}
              value={cancelReason}
              onValueChange={setCancelReason}
              minRows={2}
              maxRows={3}
            />
          </div>

          {operationHistory.length === 0 ? (
            <p className="text-sm text-default-400">{t("adminSystemOpsNoHistory")}</p>
          ) : (
            <div className="space-y-2">
              {operationHistory.map((row) => (
                <div key={row.id} className="flex items-center justify-between p-2 rounded-md bg-default-50 border border-default-100">
                  <div>
                    <p className="text-sm font-medium">{actionLabel(row.action, t)} · {row.target}</p>
                    <p className="text-xs text-default-500">{new Date(row.requested_at).toLocaleString()} · {row.reason}</p>
                    {isCancellableReboot(row) && (
                      <p className="text-[11px] text-warning mt-0.5">{t("adminSystemOpsCancelWindow", { seconds: getCancelRemainingSeconds(row) })}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip size="sm" color={row.status === "success" ? "success" : row.status === "cancelled" ? "warning" : "danger"} variant="flat">
                      {statusLabel(row.status, t)}
                    </Chip>
                    {row.action === "reboot_host" && row.status === "success" && !row.dry_run && getCancelRemainingSeconds(row) <= 0 && (
                      <Chip size="sm" color="warning" variant="flat">{t("adminSystemOpsExpired")}</Chip>
                    )}
                    {isCancellableReboot(row) && (
                      <Button size="sm" variant="flat" color="warning" isLoading={isRunningOperation} onPress={() => handleCancelOperation(row)}>
                        {t("adminSystemOpsCancel")}
                      </Button>
                    )}
                    {row.status === "failed" && (row.action === "restart_service" || row.action === "reboot_host") && (
                      <Button size="sm" variant="flat" color="primary" onPress={() => handleRetryOperation(row)}>
                        {t("adminSystemOpsRetry")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <OperationTimelineCard operations={operationHistory} />
        </CardBody>
      </Card>

      <Modal isOpen={isOpModalOpen} onOpenChange={setIsOpModalOpen} placement="center" size="lg">
        <ModalContent>
          <ModalHeader>{operationKind === "restart" ? t("adminSystemOpsModalRestartTitle") : t("adminSystemOpsModalRebootTitle")}</ModalHeader>
          <ModalBody className="space-y-3">
            {operationKind === "restart" ? (
              <Select
                label={t("adminSystemOpsService")}
                selectedKeys={[operationService]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0];
                  if (typeof value === "string") {
                    setOperationService(value);
                  }
                }}
              >
                <SelectItem key="api">api</SelectItem>
                <SelectItem key="frontend">frontend</SelectItem>
                <SelectItem key="database">database</SelectItem>
              </Select>
            ) : (
              <Input
                type="number"
                label={t("adminSystemOpsDelaySeconds")}
                min={0}
                max={3600}
                value={operationDelaySeconds}
                onValueChange={setOperationDelaySeconds}
              />
            )}

            <Textarea
              label={t("adminSystemOpsReason")}
              value={operationReason}
              onValueChange={setOperationReason}
              minRows={2}
              maxRows={4}
            />

            <div className="flex gap-4">
              <Switch isSelected={operationDryRun} onValueChange={setOperationDryRun}>{t("adminSystemOpsDryRun")}</Switch>
              <Switch isSelected={operationForce} onValueChange={setOperationForce} color="warning">{t("adminSystemOpsForcePreflight")}</Switch>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsOpModalOpen(false)}>{t("cancel")}</Button>
            <Button color={operationKind === "restart" ? "warning" : "danger"} onPress={handleSubmitOperation}>{t("adminSystemOpsConfirm")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isStepUpModalOpen} onOpenChange={setIsStepUpModalOpen} placement="center" size="sm">
        <ModalContent>
          <ModalHeader>{t("adminStepUpTitle")}</ModalHeader>
          <ModalBody className="space-y-3">
            <p className="text-sm text-default-500">{t("adminSystemOpsStepUpPrompt", { method: stepUpMethod.toUpperCase(), action: stepUpAction })}</p>
            <InputOtp length={6} value={stepUpCode} onValueChange={setStepUpCode} />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => {
                setIsStepUpModalOpen(false);
                setPendingOperation(null);
                setStepUpCode("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button color="primary" isLoading={isStepUpVerifying} onPress={handleVerifyStepUp}>
              {t("adminStepUpVerifyAction")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

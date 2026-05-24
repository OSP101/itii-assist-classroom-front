"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { RadioGroup, Radio } from "@heroui/radio";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useI18n } from "@/hooks/useI18n";
import { SystemOperationsControlCard } from "@/components/monitoring";
import {
    adminSettingsService,
    type Announcement,
    type AnnouncementPayload,
    type BackupOperationStatus,
    type DatabaseBackupRecord,
    type FeatureFlag,
    type MaintenanceConfig,
    type ServiceHealth,
} from "@/services/admin-settings.service";
import { stepUpService } from "@/services/step-up.service";
import { userService, type User } from "@/services/user.service";
import { API_BASE_URL } from "@/config/api";
import TablePaginationFooter, { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/components/ui/table-pagination-footer";

const ANNOUNCEMENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const ANNOUNCEMENT_IMAGE_MIN_WIDTH = 1200;
const ANNOUNCEMENT_IMAGE_MIN_HEIGHT = 675;
const ANNOUNCEMENT_IMAGE_EDIT_WIDTH = 1920;
const ANNOUNCEMENT_IMAGE_EDIT_HEIGHT = 1080;

async function getImageDimensions(file: File): Promise<{ width: number; height: number; objectUrl: string } | null> {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    return await new Promise((resolve) => {
        image.onload = () => {
            resolve({ width: image.naturalWidth, height: image.naturalHeight, objectUrl });
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        image.src = objectUrl;
    });
}

async function cropImageFromSource(
    sourceUrl: string,
    area: Area,
    outputFileName: string,
): Promise<File | null> {
    const image = new Image();
    image.crossOrigin = "anonymous";

    const loaded = await new Promise<boolean>((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = sourceUrl;
    });

    if (!loaded) {
        return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = ANNOUNCEMENT_IMAGE_EDIT_WIDTH;
    canvas.height = ANNOUNCEMENT_IMAGE_EDIT_HEIGHT;

    const context = canvas.getContext("2d");
    if (!context) {
        return null;
    }

    context.drawImage(
        image,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        ANNOUNCEMENT_IMAGE_EDIT_WIDTH,
        ANNOUNCEMENT_IMAGE_EDIT_HEIGHT,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
        return null;
    }

    const normalizedName = outputFileName.replace(/\.[^.]+$/, "") || "announcement";
    return new File([blob], `${normalizedName}-cropped.jpg`, { type: "image/jpeg" });
}

export default function AdminSettingsPage() {
        type FeatureFlagConfirmTarget =
            | { mode: "single"; key: string; label: string; enabled: boolean }
            | { mode: "bulk"; keys: string[]; enabled: boolean };

    const t = useI18n();
    const { language } = useGlobalSettings();
    const [isLoading, setIsLoading] = useState(true);
    const [backups, setBackups] = useState<DatabaseBackupRecord[]>([]);
    const [backupStatus, setBackupStatus] = useState<BackupOperationStatus | null>(null);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
    const [maintenance, setMaintenance] = useState<MaintenanceConfig>({
        enabled: false,
        schedule_type: "indefinite",
        message: "",
        start_time: null,
        end_time: null,
        whitelist_admin_users: [],
    });
    const [serviceHealth, setServiceHealth] = useState<ServiceHealth | null>(null);
    const [announcementForm, setAnnouncementForm] = useState<AnnouncementPayload>({
        title: "",
        message: "",
        display_paths: ["all_pages"],
        scheduled_at: null,
        expires_at: null,
        audience: ["all"],
        content_type: "text",
        display_mode: "banner_top",
        image_url: "",
        action_label: "",
        action_url: "",
        is_dismissible: true,
        require_acknowledge: false,
        is_active: true,
    });
    const [announcementLocalizedForm, setAnnouncementLocalizedForm] = useState({
        title_th: "",
        title_en: "",
        message_th: "",
        message_en: "",
        action_label_th: "",
        action_label_en: "",
    });
    const [announcementPreviewLanguage, setAnnouncementPreviewLanguage] = useState<"th" | "en">("th");
    const [announcementPreviewPath, setAnnouncementPreviewPath] = useState("all_pages");
    const [editingAnnouncementId, setEditingAnnouncementId] = useState<number | null>(null);
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [isBackupListModalOpen, setIsBackupListModalOpen] = useState(false);
    const [backupListSortOrder, setBackupListSortOrder] = useState<"latest" | "oldest">("latest");
    const [backupListPage, setBackupListPage] = useState(1);
    const [backupListRowsPerPage, setBackupListRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
    const [isAnnouncementListModalOpen, setIsAnnouncementListModalOpen] = useState(false);
    const [announcementListSearchQuery, setAnnouncementListSearchQuery] = useState("");
    const [announcementListStatusFilter, setAnnouncementListStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [announcementListPage, setAnnouncementListPage] = useState(1);
    const [announcementListRowsPerPage, setAnnouncementListRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
    const [shouldOpenAnnouncementComposer, setShouldOpenAnnouncementComposer] = useState(false);
    const [isFeatureFlagsModalOpen, setIsFeatureFlagsModalOpen] = useState(false);
    const [featureFlagSearchQuery, setFeatureFlagSearchQuery] = useState("");
    const [featureFlagStatusFilter, setFeatureFlagStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [adminUsers, setAdminUsers] = useState<User[]>([]);
    const [flagConfirmTarget, setFlagConfirmTarget] = useState<FeatureFlagConfirmTarget | null>(null);
    const [flagConfirmInput, setFlagConfirmInput] = useState("");
    const [isStepUpModalOpen, setIsStepUpModalOpen] = useState(false);
    const [stepUpAction, setStepUpAction] = useState("");
    const [stepUpMethod, setStepUpMethod] = useState<"totp" | "email">("totp");
    const [stepUpMaskedEmail, setStepUpMaskedEmail] = useState("");
    const [stepUpCode, setStepUpCode] = useState("");
    const [isStepUpVerifying, setIsStepUpVerifying] = useState(false);
    const [isRunningBackupNow, setIsRunningBackupNow] = useState(false);
    const [restoreBackupTarget, setRestoreBackupTarget] = useState<DatabaseBackupRecord | null>(null);
    const [restoreConfirmInput, setRestoreConfirmInput] = useState("");
    const [restoreAcknowledgeOverwrite, setRestoreAcknowledgeOverwrite] = useState(false);
    const [restoreReason, setRestoreReason] = useState("");
    const [isRestoringBackup, setIsRestoringBackup] = useState(false);
    const [isUploadingAnnouncementImage, setIsUploadingAnnouncementImage] = useState(false);
    const [isAnnouncementImageCropModalOpen, setIsAnnouncementImageCropModalOpen] = useState(false);
    const [announcementImageCropSourceUrl, setAnnouncementImageCropSourceUrl] = useState("");
    const [announcementImageCropFileName, setAnnouncementImageCropFileName] = useState("announcement.jpg");
    const [announcementImageCropPosition, setAnnouncementImageCropPosition] = useState<Point>({ x: 0, y: 0 });
    const [announcementImageCropZoom, setAnnouncementImageCropZoom] = useState(1);
    const [announcementImageCropAreaPixels, setAnnouncementImageCropAreaPixels] = useState<Area | null>(null);
    const [isApplyingAnnouncementImageCrop, setIsApplyingAnnouncementImageCrop] = useState(false);
    const pendingStepUpActionRef = useRef<((token: string) => Promise<void>) | null>(null);
    const announcementImageInputRef = useRef<HTMLInputElement | null>(null);

    const loadAllSettings = async () => {
        setIsLoading(true);
        const [backupRows, backupStatusRow, announcementRows, flags, maintenanceCfg, health] = await Promise.all([
            adminSettingsService.getBackups(),
            adminSettingsService.getBackupStatus(),
            adminSettingsService.getAnnouncements(true),
            adminSettingsService.getFeatureFlags(),
            adminSettingsService.getMaintenanceConfig(),
            adminSettingsService.getServiceHealth(),
        ]);

        setBackups(backupRows);
        setBackupStatus(backupStatusRow);
        setAnnouncements(announcementRows);
        setFeatureFlags(flags);
        if (maintenanceCfg) {
            setMaintenance(maintenanceCfg);
        }
        setServiceHealth(health);

        // Fetch all admin users for whitelist selector (non-blocking)
        userService.getUsers({ role: "admin", limit: 100 }).then((res) => {
            if (res.success && res.data?.users) {
                setAdminUsers(res.data.users.filter((u) => u.is_active));
            }
        }).catch(() => {});

        setIsLoading(false);
    };

    useEffect(() => {
        loadAllSettings();
    }, []);

    useEffect(() => {
        setAnnouncementPreviewLanguage(language);
    }, [language]);

    const resetAnnouncementComposer = () => {
        setEditingAnnouncementId(null);
        setAnnouncementPreviewPath("all_pages");
        setAnnouncementForm({
            title: "",
            message: "",
            display_paths: ["all_pages"],
            scheduled_at: null,
            expires_at: null,
            audience: ["all"],
            content_type: "text",
            display_mode: "banner_top",
            image_url: "",
            action_label: "",
            action_url: "",
            is_dismissible: true,
            require_acknowledge: false,
            is_active: true,
        });
        setAnnouncementLocalizedForm({
            title_th: "",
            title_en: "",
            message_th: "",
            message_en: "",
            action_label_th: "",
            action_label_en: "",
        });
    };

    const openAnnouncementComposerSafely = () => {
        // Close sibling modals first to avoid stacked backdrops intercepting pointer events.
        setIsAnnouncementListModalOpen(false);
        setIsFeatureFlagsModalOpen(false);
        setIsMaintenanceModalOpen(false);
        setShouldOpenAnnouncementComposer(true);
    };

    const openAnnouncementCreateModal = () => {
        resetAnnouncementComposer();
        openAnnouncementComposerSafely();
    };

    const closeAnnouncementComposer = () => {
        setShouldOpenAnnouncementComposer(false);
        resetAnnouncementComposer();
        setIsAnnouncementModalOpen(false);
    };

    const openAnnouncementEditorFromList = (item: Announcement) => {
        loadAnnouncementForEdit(item);
    };

    const openAnnouncementDuplicateFromList = (item: Announcement) => {
        const duplicateSuffix = t("adminAnnouncementDuplicateSuffix");
        const nextTitleTh = item.title_th?.trim() ? `${item.title_th.trim()} ${duplicateSuffix}` : "";
        const nextTitleEn = item.title_en?.trim() ? `${item.title_en.trim()} ${duplicateSuffix}` : "";
        const baseTitle = item.title?.trim() ? `${item.title.trim()} ${duplicateSuffix}` : duplicateSuffix;

        setEditingAnnouncementId(null);
        setAnnouncementPreviewPath(item.display_paths?.[0] || "all_pages");
        setAnnouncementForm({
            title: baseTitle,
            title_th: nextTitleTh || null,
            title_en: nextTitleEn || null,
            message: item.message || "",
            message_th: item.message_th || null,
            message_en: item.message_en || null,
            display_paths: item.display_paths?.length ? item.display_paths : ["all_pages"],
            scheduled_at: null,
            expires_at: null,
            audience: item.audience?.length ? item.audience : ["all"],
            content_type: item.content_type,
            display_mode: item.display_mode,
            image_url: item.image_url || "",
            action_label: item.action_label || "",
            action_label_th: item.action_label_th || null,
            action_label_en: item.action_label_en || null,
            action_url: item.action_url || "",
            is_dismissible: item.is_dismissible,
            require_acknowledge: item.require_acknowledge,
            is_active: item.is_active,
        });
        setAnnouncementLocalizedForm({
            title_th: nextTitleTh,
            title_en: nextTitleEn,
            message_th: item.message_th || "",
            message_en: item.message_en || "",
            action_label_th: item.action_label_th || "",
            action_label_en: item.action_label_en || "",
        });
        openAnnouncementComposerSafely();
    };

    const loadAnnouncementForEdit = (item: Announcement) => {
        setEditingAnnouncementId(item.id);
        setAnnouncementPreviewPath(item.display_paths?.[0] || "all_pages");
        setAnnouncementForm({
            title: item.title || "",
            title_th: item.title_th || null,
            title_en: item.title_en || null,
            message: item.message || "",
            message_th: item.message_th || null,
            message_en: item.message_en || null,
            display_paths: item.display_paths?.length ? item.display_paths : ["all_pages"],
            scheduled_at: item.scheduled_at || null,
            expires_at: item.expires_at || null,
            audience: item.audience?.length ? item.audience : ["all"],
            content_type: item.content_type,
            display_mode: item.display_mode,
            image_url: item.image_url || "",
            action_label: item.action_label || "",
            action_label_th: item.action_label_th || null,
            action_label_en: item.action_label_en || null,
            action_url: item.action_url || "",
            is_dismissible: item.is_dismissible,
            require_acknowledge: item.require_acknowledge,
            is_active: item.is_active,
        });
        setAnnouncementLocalizedForm({
            title_th: item.title_th || "",
            title_en: item.title_en || "",
            message_th: item.message_th || "",
            message_en: item.message_en || "",
            action_label_th: item.action_label_th || "",
            action_label_en: item.action_label_en || "",
        });
        openAnnouncementComposerSafely();
    };

    const runWithStepUp = async (action: string, callback: (token: string) => Promise<void>) => {
        const cached = stepUpService.getCachedToken(action);
        if (cached) {
            await callback(cached);
            return;
        }

        const challenge = await stepUpService.requestChallenge(action);
        if (!challenge) {
            const err = stepUpService.getLastChallengeError();
            const desc = err?.code === "2FA_NOT_ENABLED"
                ? t("adminStepUp2FANotEnabled")
                : t("adminStepUpRequestFailed");
            addToast({ title: t("error"), description: desc, color: "danger" });
            return;
        }

        pendingStepUpActionRef.current = callback;
        setStepUpAction(action);
        setStepUpMethod(challenge.method);
        setStepUpMaskedEmail(challenge.maskedEmail || "");
        setStepUpCode("");
        setIsStepUpModalOpen(true);
    };

    const submitStepUpCode = async (codeValue?: string) => {
        const code = (codeValue ?? stepUpCode).trim();
        if (!code) {
            addToast({ title: t("error"), description: t("adminStepUpCodeRequired"), color: "warning" });
            return;
        }

        setIsStepUpVerifying(true);
        const token = await stepUpService.verifyChallenge(stepUpAction, code);
        if (!token) {
            setIsStepUpVerifying(false);
            addToast({ title: t("error"), description: t("adminStepUpVerifyFailed"), color: "danger" });
            return;
        }

        const pendingAction = pendingStepUpActionRef.current;
        pendingStepUpActionRef.current = null;
        setIsStepUpModalOpen(false);
        setIsStepUpVerifying(false);
        if (!pendingAction) {
            return;
        }
        await pendingAction(token);
    };

    const requestFlagChange = (flagKey: string, label: string, enabled: boolean) => {
        setFlagConfirmInput("");
        setFlagConfirmTarget({ mode: "single", key: flagKey, label, enabled });
    };

    const requestBulkFlagChange = (enabled: boolean) => {
        const targetKeys = featureFlags.filter((flag) => flag.enabled !== enabled).map((flag) => flag.key);
        if (targetKeys.length === 0) {
            addToast({ title: t("success"), description: t("adminFeatureFlagNoChangeNeeded"), color: "success" });
            return;
        }

        setFlagConfirmInput("");
        setFlagConfirmTarget({ mode: "bulk", keys: targetKeys, enabled });
    };

    const updateFlag = async (flagKey: string, enabled: boolean) => {
        setFlagConfirmTarget(null);
        setFlagConfirmInput("");

        let needsStepUpRetry = false;

        await runWithStepUp("system_settings.feature_flags.update", async (stepUpToken) => {
            const updated = await adminSettingsService.updateFeatureFlag(flagKey, enabled, stepUpToken);
            if (!updated) {
                const err = adminSettingsService.getLastFlagUpdateError();
                if (err?.code === "STEP_UP_REQUIRED") {
                    stepUpService.clearCachedToken("system_settings.feature_flags.update");
                    needsStepUpRetry = true;
                    return;
                }
                addToast({ title: t("error"), description: err?.message || t("adminSettingsUpdateFailed"), color: "danger" });
                return;
            }
            setFeatureFlags((prev) => prev.map((item) => (item.key === flagKey ? updated : item)));
        });

        if (needsStepUpRetry) {
            await runWithStepUp("system_settings.feature_flags.update", async (stepUpToken) => {
                const updated = await adminSettingsService.updateFeatureFlag(flagKey, enabled, stepUpToken);
                if (!updated) {
                    const err = adminSettingsService.getLastFlagUpdateError();
                    addToast({ title: t("error"), description: err?.message || t("adminSettingsUpdateFailed"), color: "danger" });
                    return;
                }
                setFeatureFlags((prev) => prev.map((item) => (item.key === flagKey ? updated : item)));
            });
        }
    };

    const updateFlagsBulk = async (flagKeys: string[], enabled: boolean) => {
        setFlagConfirmTarget(null);
        setFlagConfirmInput("");

        let needsStepUpRetry = false;

        const executeBulkUpdate = async (stepUpToken: string): Promise<FeatureFlag[]> => {
            const updatedItems: FeatureFlag[] = [];
            for (const flagKey of flagKeys) {
                const updated = await adminSettingsService.updateFeatureFlag(flagKey, enabled, stepUpToken);
                if (updated) {
                    updatedItems.push(updated);
                }
            }
            return updatedItems;
        };

        await runWithStepUp("system_settings.feature_flags.update", async (stepUpToken) => {
            const updatedItems = await executeBulkUpdate(stepUpToken);

            if (updatedItems.length === 0) {
                const err = adminSettingsService.getLastFlagUpdateError();
                if (err?.code === "STEP_UP_REQUIRED") {
                    stepUpService.clearCachedToken("system_settings.feature_flags.update");
                    needsStepUpRetry = true;
                    return;
                }
                addToast({ title: t("error"), description: t("adminSettingsUpdateFailed"), color: "danger" });
                return;
            }

            const updatedByKey = new Map(updatedItems.map((item) => [item.key, item]));
            setFeatureFlags((prev) => prev.map((item) => updatedByKey.get(item.key) || item));
            addToast({ title: t("success"), description: t("adminFeatureFlagBulkSuccess", { count: updatedItems.length }), color: "success" });
        });

        if (needsStepUpRetry) {
            await runWithStepUp("system_settings.feature_flags.update", async (stepUpToken) => {
                const updatedItems = await executeBulkUpdate(stepUpToken);

                if (updatedItems.length === 0) {
                    addToast({ title: t("error"), description: t("adminSettingsUpdateFailed"), color: "danger" });
                    return;
                }

                const updatedByKey = new Map(updatedItems.map((item) => [item.key, item]));
                setFeatureFlags((prev) => prev.map((item) => updatedByKey.get(item.key) || item));
                addToast({ title: t("success"), description: t("adminFeatureFlagBulkSuccess", { count: updatedItems.length }), color: "success" });
            });
        }
    };

    const saveMaintenance = async () => {
        await runWithStepUp("system_settings.maintenance.update", async (stepUpToken) => {
            const updated = await adminSettingsService.updateMaintenanceConfig(maintenance, stepUpToken);
            if (!updated) {
                addToast({ title: t("error"), description: t("adminSettingsUpdateFailed"), color: "danger" });
                return;
            }
            setMaintenance(updated);
            addToast({ title: t("success"), description: t("settingsSaved"), color: "success" });
        });
    };

    const runBackupNow = async () => {
        if (isRunningBackupNow) {
            return;
        }

        setIsRunningBackupNow(true);
        let needsStepUpRetry = false;

        await runWithStepUp("system_settings.backups.run_now", async (stepUpToken) => {
            const created = await adminSettingsService.runBackupNow("manual_backup_from_admin_settings", stepUpToken);
            if (!created) {
                const err = adminSettingsService.getLastBackupActionError();
                if (err?.code === "STEP_UP_REQUIRED") {
                    stepUpService.clearCachedToken("system_settings.backups.run_now");
                    needsStepUpRetry = true;
                    return;
                }
                addToast({ title: t("error"), description: err?.message || t("adminBackupRunFailed"), color: "danger" });
                return;
            }

            setBackups((prev) => [created, ...prev.filter((item) => item.id !== created.id)].slice(0, 20));
            addToast({ title: t("success"), description: t("adminBackupRunSuccess"), color: "success" });
        });

        if (needsStepUpRetry) {
            await runWithStepUp("system_settings.backups.run_now", async (stepUpToken) => {
                const created = await adminSettingsService.runBackupNow("manual_backup_from_admin_settings", stepUpToken);
                if (!created) {
                    const err = adminSettingsService.getLastBackupActionError();
                    addToast({ title: t("error"), description: err?.message || t("adminBackupRunFailed"), color: "danger" });
                    return;
                }
                setBackups((prev) => [created, ...prev.filter((item) => item.id !== created.id)].slice(0, 20));
                addToast({ title: t("success"), description: t("adminBackupRunSuccess"), color: "success" });
            });
        }

        setIsRunningBackupNow(false);
    };

    const openRestoreModal = (backup: DatabaseBackupRecord) => {
        setRestoreBackupTarget(backup);
        setRestoreConfirmInput("");
        setRestoreAcknowledgeOverwrite(false);
        setRestoreReason("");
    };

    const submitRestoreBackup = async () => {
        if (!restoreBackupTarget || isRestoringBackup) {
            return;
        }

        setIsRestoringBackup(true);
        let needsStepUpRetry = false;

        const payload = {
            backup_id: restoreBackupTarget.id,
            confirm_text: "RESTORE",
            reason: restoreReason.trim() || undefined,
        };

        await runWithStepUp("system_settings.backups.restore", async (stepUpToken) => {
            const ok = await adminSettingsService.restoreBackup(payload, stepUpToken);
            if (!ok) {
                const err = adminSettingsService.getLastBackupActionError();
                if (err?.code === "STEP_UP_REQUIRED") {
                    stepUpService.clearCachedToken("system_settings.backups.restore");
                    needsStepUpRetry = true;
                    return;
                }
                addToast({ title: t("error"), description: err?.message || t("adminBackupRestoreFailed"), color: "danger" });
                return;
            }
            setRestoreBackupTarget(null);
            setRestoreConfirmInput("");
            setRestoreAcknowledgeOverwrite(false);
            setRestoreReason("");
            await loadAllSettings();
            addToast({ title: t("success"), description: t("adminBackupRestoreSuccessWithSnapshot"), color: "success" });
        });

        if (needsStepUpRetry) {
            await runWithStepUp("system_settings.backups.restore", async (stepUpToken) => {
                const ok = await adminSettingsService.restoreBackup(payload, stepUpToken);
                if (!ok) {
                    const err = adminSettingsService.getLastBackupActionError();
                    addToast({ title: t("error"), description: err?.message || t("adminBackupRestoreFailed"), color: "danger" });
                    return;
                }
                setRestoreBackupTarget(null);
                setRestoreConfirmInput("");
                setRestoreAcknowledgeOverwrite(false);
                setRestoreReason("");
                await loadAllSettings();
                addToast({ title: t("success"), description: t("adminBackupRestoreSuccessWithSnapshot"), color: "success" });
            });
        }

        setIsRestoringBackup(false);
    };

    const openBackupDownloadURL = async (backup: DatabaseBackupRecord) => {
        let needsStepUpRetry = false;

        const executeDownloadUrl = async (stepUpToken: string): Promise<boolean> => {
            const url = await adminSettingsService.getBackupDownloadURL(backup.id, stepUpToken);
            if (!url) {
                const err = adminSettingsService.getLastBackupActionError();
                if (err?.code === "STEP_UP_REQUIRED") {
                    stepUpService.clearCachedToken("system_settings.backups.download");
                    needsStepUpRetry = true;
                    return false;
                }
                addToast({ title: t("error"), description: err?.message || t("adminSettingsUpdateFailed"), color: "danger" });
                return false;
            }

            window.open(url, "_blank", "noopener,noreferrer");
            return true;
        };

        await runWithStepUp("system_settings.backups.download", async (stepUpToken) => {
            await executeDownloadUrl(stepUpToken);
        });

        if (needsStepUpRetry) {
            await runWithStepUp("system_settings.backups.download", async (stepUpToken) => {
                await executeDownloadUrl(stepUpToken);
            });
        }
    };

    const saveAnnouncement = async () => {
        const wasEditing = editingAnnouncementId !== null;
        const localizedTitle =
            announcementLocalizedForm.title_th.trim() || announcementLocalizedForm.title_en.trim() || announcementForm.title.trim();
        const localizedMessage =
            announcementLocalizedForm.message_th.trim() || announcementLocalizedForm.message_en.trim() || announcementForm.message.trim();
        const localizedActionLabel =
            announcementLocalizedForm.action_label_th.trim()
            || announcementLocalizedForm.action_label_en.trim()
            || (announcementForm.action_label || "").trim();

        if (!localizedTitle) {
            addToast({ title: t("error"), description: t("adminAnnouncementRequireFields"), color: "danger" });
            return false;
        }

        if (announcementForm.content_type === "text" && !localizedMessage) {
            addToast({ title: t("error"), description: t("adminAnnouncementRequireMessage"), color: "danger" });
            return false;
        }

        if (announcementForm.content_type === "image" && !announcementForm.image_url?.trim()) {
            addToast({ title: t("error"), description: t("adminAnnouncementRequireImage"), color: "danger" });
            return false;
        }

        const payload: AnnouncementPayload = {
            ...announcementForm,
            title: localizedTitle,
            title_th: announcementLocalizedForm.title_th.trim() || null,
            title_en: announcementLocalizedForm.title_en.trim() || null,
            message: localizedMessage,
            message_th: announcementLocalizedForm.message_th.trim() || null,
            message_en: announcementLocalizedForm.message_en.trim() || null,
            action_label: localizedActionLabel,
            action_label_th: announcementLocalizedForm.action_label_th.trim() || null,
            action_label_en: announcementLocalizedForm.action_label_en.trim() || null,
        };
        const saved = editingAnnouncementId
            ? await adminSettingsService.updateAnnouncement(editingAnnouncementId, payload)
            : await adminSettingsService.createAnnouncement(payload);
        if (!saved) {
            addToast({ title: t("error"), description: t("adminSettingsUpdateFailed"), color: "danger" });
            return false;
        }
        resetAnnouncementComposer();
        await loadAllSettings();
        addToast({
            title: t("success"),
            description: wasEditing ? t("adminAnnouncementUpdated") : t("adminAnnouncementCreated"),
            color: "success",
        });
        return true;
    };

    const getAnnouncementTextByLanguage = (
        item: Announcement,
        field: "title" | "message" | "action_label",
        preferredLanguage: "th" | "en",
    ) => {
        if (field === "title") {
            return preferredLanguage === "th"
                ? (item.title_th?.trim() || item.title_en?.trim() || item.title)
                : (item.title_en?.trim() || item.title_th?.trim() || item.title);
        }

        if (field === "message") {
            return preferredLanguage === "th"
                ? (item.message_th?.trim() || item.message_en?.trim() || item.message)
                : (item.message_en?.trim() || item.message_th?.trim() || item.message);
        }

        return preferredLanguage === "th"
            ? (item.action_label_th?.trim() || item.action_label_en?.trim() || item.action_label || "")
            : (item.action_label_en?.trim() || item.action_label_th?.trim() || item.action_label || "");
    };

    const totalEnabledFlags = useMemo(() => featureFlags.filter((item) => item.enabled).length, [featureFlags]);
    const isMaintenanceEffectivelyActive = useMemo(() => {
        if (maintenance.schedule_type === "scheduled") {
            const now = new Date();
            const start = maintenance.start_time ? new Date(maintenance.start_time) : null;
            const end = maintenance.end_time ? new Date(maintenance.end_time) : null;
            if (start && end) return now >= start && now <= end;
            return false;
        }
        return maintenance.enabled;
    }, [maintenance]);
    const canEnableAllFeatureFlags = useMemo(() => featureFlags.some((item) => !item.enabled), [featureFlags]);
    const canDisableAllFeatureFlags = useMemo(() => featureFlags.some((item) => item.enabled), [featureFlags]);
    const sortedFeatureFlags = useMemo(() => {
        const workflowOrder = [
            "menu.attendance",
            "menu.queue",
            "menu.assignments",
            "menu.scores",
            "menu.exams",
            "menu.teams",
            "menu.courses",
            "menu.classrooms",
        ];
        const orderMap = new Map(workflowOrder.map((key, index) => [key, index]));

        return [...featureFlags].sort((a, b) => {
            const orderA = orderMap.get(a.key);
            const orderB = orderMap.get(b.key);

            if (orderA !== undefined && orderB !== undefined) {
                return orderA - orderB;
            }
            if (orderA !== undefined) {
                return -1;
            }
            if (orderB !== undefined) {
                return 1;
            }

            return a.label.localeCompare(b.label, "th");
        });
    }, [featureFlags]);
    const groupedFeatureFlags = useMemo(() => {
        const sectionConfig = [
            {
                id: "teachingOps",
                title: t("adminFeatureFlagSectionTeachingOps"),
                description: t("adminFeatureFlagSectionTeachingOpsHint"),
                keys: ["menu.attendance", "menu.queue"],
            },
            {
                id: "assessment",
                title: t("adminFeatureFlagSectionAssessment"),
                description: t("adminFeatureFlagSectionAssessmentHint"),
                keys: ["menu.assignments", "menu.scores", "menu.exams"],
            },
            {
                id: "courseStructure",
                title: t("adminFeatureFlagSectionCourseStructure"),
                description: t("adminFeatureFlagSectionCourseStructureHint"),
                keys: ["menu.teams", "menu.people", "menu.activity-log", "menu.ta-stats", "menu.settings"],
            },
            {
                id: "other",
                title: t("adminFeatureFlagSectionOther"),
                description: t("adminFeatureFlagSectionOtherHint"),
                keys: [] as string[],
            },
        ];

        const sectionByKey = new Map<string, string>();
        for (const section of sectionConfig) {
            for (const key of section.keys) {
                sectionByKey.set(key, section.id);
            }
        }

        const grouped = new Map<string, typeof sortedFeatureFlags>();
        for (const section of sectionConfig) {
            grouped.set(section.id, []);
        }

        for (const flag of sortedFeatureFlags) {
            const sectionId = sectionByKey.get(flag.key) || "other";
            grouped.get(sectionId)?.push(flag);
        }

        return sectionConfig
            .map((section) => ({
                ...section,
                flags: grouped.get(section.id) || [],
            }))
            .filter((section) => section.flags.length > 0);
    }, [sortedFeatureFlags, t]);
    const filteredGroupedFeatureFlags = useMemo(() => {
        const normalizedQuery = featureFlagSearchQuery.trim().toLowerCase();

        return groupedFeatureFlags
            .map((section) => ({
                ...section,
                flags: section.flags.filter((flag) => {
                    const matchesStatus = featureFlagStatusFilter === "all"
                        || (featureFlagStatusFilter === "enabled" && flag.enabled)
                        || (featureFlagStatusFilter === "disabled" && !flag.enabled);
                    if (!matchesStatus) {
                        return false;
                    }

                    if (!normalizedQuery) {
                        return true;
                    }

                    const searchableText = `${flag.label} ${flag.description} ${flag.key}`.toLowerCase();
                    return searchableText.includes(normalizedQuery);
                }),
            }))
            .filter((section) => section.flags.length > 0);
    }, [featureFlagSearchQuery, featureFlagStatusFilter, groupedFeatureFlags]);
    const audienceOptions = useMemo(
        () => [
            { key: "all", label: t("adminAudienceAll") },
            { key: "admin", label: t("adminAudienceAdmin") },
            { key: "instructor", label: t("adminAudienceInstructor") },
            { key: "ta", label: t("adminAudienceTa") },
            { key: "student", label: t("adminAudienceStudent") },
        ],
        [t],
    );
    const announcementContentOptions = useMemo(
        () => [
            { key: "text", label: t("adminAnnouncementContentText") },
            { key: "image", label: t("adminAnnouncementContentImage") },
            { key: "mixed", label: t("adminAnnouncementContentMixed") },
        ],
        [t],
    );
    const announcementDisplayModeOptions = useMemo(
        () => [
            { key: "banner_top", label: t("adminAnnouncementDisplayBannerTop") },
            { key: "fullscreen", label: t("adminAnnouncementDisplayFullscreen") },
        ],
        [t],
    );
    const announcementDisplayPathOptions = useMemo(
        () => [
            { key: "all_pages", label: t("adminAnnouncementPathsAllPages") },
            { key: "student_pages", label: t("adminAnnouncementPathsStudent") },
            { key: "student_notifications", label: t("adminAnnouncementPathsStudentNotifications") },
            { key: "admin_pages", label: t("adminAnnouncementPathsAdmin") },
            { key: "instructor_pages", label: t("adminAnnouncementPathsInstructor") },
            { key: "classroom_pages", label: t("adminAnnouncementPathsClassroom") },
        ],
        [t],
    );
    const announcementPreviewPathUrlMap: Record<string, string> = {
        all_pages: "/home",
        student_pages: "/student/courses",
        student_notifications: "/student/notifications",
        admin_pages: "/admin/dashboard",
        instructor_pages: "/classroom/SC363204/overview",
        classroom_pages: "/classroom/SC363204/attendance",
    };

    const toAnnouncementImagePreviewUrl = (pathOrUrl?: string | null): string => {
        const value = String(pathOrUrl || "").trim();
        if (!value) return "";
        if (/^https?:\/\//i.test(value)) return value;
        if (!value.startsWith("/")) return value;

        const apiBase = API_BASE_URL.replace(/\/$/, "");
        const origin = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
        return `${origin}${value}`;
    };

    const resetAnnouncementCropModal = useCallback(() => {
        setIsAnnouncementImageCropModalOpen(false);
        setAnnouncementImageCropPosition({ x: 0, y: 0 });
        setAnnouncementImageCropZoom(1);
        setAnnouncementImageCropAreaPixels(null);
        if (announcementImageCropSourceUrl.startsWith("blob:")) {
            URL.revokeObjectURL(announcementImageCropSourceUrl);
        }
        setAnnouncementImageCropSourceUrl("");
        setAnnouncementImageCropFileName("announcement.jpg");
    }, [announcementImageCropSourceUrl]);

    const uploadAnnouncementImageFile = async (file: File) => {
        setIsUploadingAnnouncementImage(true);
        const uploadedUrl = await adminSettingsService.uploadAnnouncementImage(file);
        setIsUploadingAnnouncementImage(false);
        if (!uploadedUrl) {
            addToast({ title: t("error"), description: t("adminAnnouncementImageUploadFailed"), color: "danger" });
            return;
        }

        setAnnouncementForm((prev) => ({ ...prev, image_url: uploadedUrl }));
        addToast({ title: t("success"), description: t("adminAnnouncementImageUploadSuccess"), color: "success" });
    };

    const applyAnnouncementImageCrop = async () => {
        if (!announcementImageCropSourceUrl || !announcementImageCropAreaPixels) {
            return;
        }

        setIsApplyingAnnouncementImageCrop(true);
        const croppedFile = await cropImageFromSource(
            announcementImageCropSourceUrl,
            announcementImageCropAreaPixels,
            announcementImageCropFileName,
        );
        setIsApplyingAnnouncementImageCrop(false);

        if (!croppedFile) {
            addToast({ title: t("error"), description: t("adminAnnouncementImageCropFailed"), color: "danger" });
            return;
        }

        await uploadAnnouncementImageFile(croppedFile);
        resetAnnouncementCropModal();
    };

    const uploadAnnouncementImage = async (file?: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            addToast({ title: t("error"), description: t("adminAnnouncementInvalidImageType"), color: "danger" });
            return;
        }
        if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
            addToast({ title: t("error"), description: t("adminAnnouncementImageTooLarge"), color: "danger" });
            return;
        }

        const dimensions = await getImageDimensions(file);
        if (!dimensions) {
            addToast({ title: t("error"), description: t("adminAnnouncementInvalidImageType"), color: "danger" });
            return;
        }

        if (dimensions.width < ANNOUNCEMENT_IMAGE_MIN_WIDTH || dimensions.height < ANNOUNCEMENT_IMAGE_MIN_HEIGHT) {
            URL.revokeObjectURL(dimensions.objectUrl);
            addToast({
                title: t("error"),
                description: t("adminAnnouncementImageTooSmall", {
                    width: ANNOUNCEMENT_IMAGE_MIN_WIDTH,
                    height: ANNOUNCEMENT_IMAGE_MIN_HEIGHT,
                }),
                color: "danger",
            });
            return;
        }

        if (dimensions.width > ANNOUNCEMENT_IMAGE_EDIT_WIDTH || dimensions.height > ANNOUNCEMENT_IMAGE_EDIT_HEIGHT) {
            setAnnouncementImageCropSourceUrl(dimensions.objectUrl);
            setAnnouncementImageCropFileName(file.name || "announcement.jpg");
            setAnnouncementImageCropPosition({ x: 0, y: 0 });
            setAnnouncementImageCropZoom(1);
            setAnnouncementImageCropAreaPixels(null);
            setIsAnnouncementImageCropModalOpen(true);
            addToast({ title: t("adminAnnouncementImageCropTitle"), description: t("adminAnnouncementImageCropHint"), color: "primary" });
            return;
        }

        URL.revokeObjectURL(dimensions.objectUrl);
        await uploadAnnouncementImageFile(file);
        if (announcementImageInputRef.current) {
            announcementImageInputRef.current.value = "";
        }
    };

    const toLocalInputValue = (value?: string | null) => {
        if (!value) return "";
        const date = new Date(value);
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    };

    const fieldClassNames = {
        label: "text-default-700 text-sm font-medium pb-1",
        inputWrapper: "bg-content1 border-default-200 hover:border-default-300",
    };

    const textareaClassNames = {
        label: "text-default-700 text-sm font-medium pb-1",
        inputWrapper: "bg-content1 border-default-200 hover:border-default-300",
    };

    const selectClassNames = {
        label: "text-default-700 text-sm font-medium pb-1",
        trigger: "bg-content1 border-default-200 hover:border-default-300",
    };

    const localizedPreviewTitle =
        announcementPreviewLanguage === "th"
            ? (announcementLocalizedForm.title_th.trim() || announcementLocalizedForm.title_en.trim() || t("adminAnnouncementPreviewTitleFallback"))
            : (announcementLocalizedForm.title_en.trim() || announcementLocalizedForm.title_th.trim() || t("adminAnnouncementPreviewTitleFallback"));

    const localizedPreviewMessage =
        announcementPreviewLanguage === "th"
            ? (announcementLocalizedForm.message_th.trim() || announcementLocalizedForm.message_en.trim())
            : (announcementLocalizedForm.message_en.trim() || announcementLocalizedForm.message_th.trim());

    const localizedPreviewActionLabel =
        announcementPreviewLanguage === "th"
            ? (announcementLocalizedForm.action_label_th.trim() || announcementLocalizedForm.action_label_en.trim() || t("adminAnnouncementOpenAction"))
            : (announcementLocalizedForm.action_label_en.trim() || announcementLocalizedForm.action_label_th.trim() || t("adminAnnouncementOpenAction"));

    const hasAnnouncementTitle =
        announcementLocalizedForm.title_th.trim().length > 0
        || announcementLocalizedForm.title_en.trim().length > 0
        || announcementForm.title.trim().length > 0;
    const hasAnnouncementMessage =
        announcementLocalizedForm.message_th.trim().length > 0
        || announcementLocalizedForm.message_en.trim().length > 0
        || announcementForm.message.trim().length > 0;
    const hasAnnouncementImage = (announcementForm.image_url || "").trim().length > 0;
    const canSubmitAnnouncement =
        hasAnnouncementTitle
        && (
            (announcementForm.content_type === "text" && hasAnnouncementMessage)
            || (announcementForm.content_type === "image" && hasAnnouncementImage)
            || (announcementForm.content_type === "mixed" && (hasAnnouncementMessage || hasAnnouncementImage))
        );
    const announcementToggleValues = [
        announcementForm.require_acknowledge ? "require_acknowledge" : "",
        announcementForm.is_dismissible ? "is_dismissible" : "",
        announcementForm.is_active ? "is_active" : "",
    ].filter(Boolean);

    const previewDisplayPaths = announcementForm.display_paths.length > 0 ? announcementForm.display_paths : ["all_pages"];
    const previewMatchesSelectedPath = previewDisplayPaths.includes("all_pages") || previewDisplayPaths.includes(announcementPreviewPath);
    const previewPathLabel = announcementDisplayPathOptions.find((option) => option.key === announcementPreviewPath)?.label || announcementPreviewPath;

    const filteredAnnouncements = useMemo(() => {
        const query = announcementListSearchQuery.trim().toLowerCase();
        return announcements.filter((item) => {
            if (announcementListStatusFilter === "active" && !item.is_active) return false;
            if (announcementListStatusFilter === "inactive" && item.is_active) return false;
            if (!query) return true;

            const searchable = [
                item.title,
                item.title_th,
                item.title_en,
                item.message,
                item.message_th,
                item.message_en,
                item.action_label,
                item.action_label_th,
                item.action_label_en,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchable.includes(query);
        });
    }, [announcements, announcementListSearchQuery, announcementListStatusFilter]);

    const sortedBackups = useMemo(() => {
        return [...backups].sort((a, b) => {
            const left = new Date(a.created_at).getTime();
            const right = new Date(b.created_at).getTime();
            if (backupListSortOrder === "oldest") {
                return left - right;
            }
            return right - left;
        });
    }, [backups, backupListSortOrder]);

    const backupListTotalPages = Math.max(1, Math.ceil(sortedBackups.length / backupListRowsPerPage));
    const backupListCurrentPage = Math.min(backupListPage, backupListTotalPages);
    const backupListStart = (backupListCurrentPage - 1) * backupListRowsPerPage;
    const backupListPageItems = useMemo(
        () => sortedBackups.slice(backupListStart, backupListStart + backupListRowsPerPage),
        [sortedBackups, backupListStart, backupListRowsPerPage],
    );

    const announcementListTotalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / announcementListRowsPerPage));
    const announcementListCurrentPage = Math.min(announcementListPage, announcementListTotalPages);
    const announcementListStart = (announcementListCurrentPage - 1) * announcementListRowsPerPage;
    const announcementListPageItems = useMemo(
        () => filteredAnnouncements.slice(announcementListStart, announcementListStart + announcementListRowsPerPage),
        [filteredAnnouncements, announcementListStart, announcementListRowsPerPage],
    );
    const announcementListFrom = filteredAnnouncements.length === 0 ? 0 : announcementListStart + 1;
    const announcementListTo = Math.min(announcementListStart + announcementListRowsPerPage, filteredAnnouncements.length);
    const announcementListColumns = useMemo(
        () => [
            { key: "announcement", label: t("adminAnnouncementListColumnAnnouncement") },
            { key: "status", label: t("adminAnnouncementListColumnStatus") },
            { key: "ack", label: t("adminAnnouncementListColumnAck") },
            { key: "actions", label: t("adminAnnouncementListColumnActions") },
        ],
        [t],
    );

    const announcementDisplayModeLabelMap = useMemo(
        () => new Map(announcementDisplayModeOptions.map((option) => [option.key, option.label])),
        [announcementDisplayModeOptions],
    );

    useEffect(() => {
        setAnnouncementListPage(1);
    }, [announcementListSearchQuery, announcementListStatusFilter, announcementListRowsPerPage]);

    useEffect(() => {
        setBackupListPage(1);
    }, [backupListSortOrder, backupListRowsPerPage]);

    useEffect(() => {
        if (announcementListPage > announcementListTotalPages) {
            setAnnouncementListPage(announcementListTotalPages);
        }
    }, [announcementListPage, announcementListTotalPages]);

    useEffect(() => {
        if (backupListPage > backupListTotalPages) {
            setBackupListPage(backupListTotalPages);
        }
    }, [backupListPage, backupListTotalPages]);

    useEffect(() => {
        if (!shouldOpenAnnouncementComposer) {
            return;
        }

        if (isAnnouncementListModalOpen || isFeatureFlagsModalOpen || isMaintenanceModalOpen || flagConfirmTarget !== null) {
            return;
        }

        setIsAnnouncementModalOpen(true);
        setShouldOpenAnnouncementComposer(false);
    }, [
        shouldOpenAnnouncementComposer,
        isAnnouncementListModalOpen,
        isFeatureFlagsModalOpen,
        isMaintenanceModalOpen,
        flagConfirmTarget,
    ]);

    if (isLoading) {
        return (
            <div className="space-y-4 max-w-5xl">
                <h1 className="text-2xl font-bold text-default-900">{t("systemSettings")}</h1>
                <Card>
                    <CardBody className="py-10 text-center text-default-500">{t("loading")}</CardBody>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <div>
                <h1 className="text-2xl font-bold text-default-900">{t("systemSettings")}</h1>
                <p className="text-sm text-default-500 mt-1">{t("adminSettingsDescription")}</p>
            </div>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex w-full items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Icon icon="solar:database-bold" className="text-xl text-amber-600 dark:text-amber-300" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">{t("adminBackupTitle")}</h3>
                                <p className="text-xs text-default-500">{t("adminBackupDescription")}</p>
                            </div>
                        </div>
                        <Button
                            color="warning"
                            variant="flat"
                            size="sm"
                            isLoading={isRunningBackupNow}
                            startContent={!isRunningBackupNow ? <Icon icon="solar:database-bold" /> : null}
                            onPress={runBackupNow}
                        >
                            {isRunningBackupNow ? t("adminBackupRunning") : t("adminBackupRunNow")}
                        </Button>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-3">
                    {backupStatus ? (
                        <div className="rounded-lg border border-default-200 bg-content2 px-3 py-2 text-xs text-default-600">
                            <p>
                                {backupStatus.running
                                    ? t("adminBackupStatusRunning")
                                    : backupStatus.last_status === "success"
                                        ? t("adminBackupStatusLastSuccess", { at: backupStatus.last_backup_at ? new Date(backupStatus.last_backup_at).toLocaleString() : "-" })
                                        : t("adminBackupStatusLastFailed", { error: backupStatus.last_error || "-" })}
                            </p>
                        </div>
                    ) : null}
                    <div className="rounded-lg border border-default-200 bg-content2 px-3 py-2.5">
                        <p className="text-xs uppercase tracking-wide text-default-500">{t("adminBackupCountLabel")}</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{backups.length}</p>
                    </div>
                    <Button
                        color="warning"
                        variant="flat"
                        onPress={() => setIsBackupListModalOpen(true)}
                        startContent={<Icon icon="solar:list-bold" />}
                        className="h-11"
                    >
                        {t("adminBackupOpenList")}
                    </Button>
                </CardBody>
            </Card>

            <SystemOperationsControlCard
                title={t("adminSystemOpsTitle")}
                description={t("adminSystemOpsDescription")}
            />

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Icon icon="solar:chat-round-bold" className="text-xl text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{t("adminAnnouncementsTitle")}</h3>
                            <p className="text-xs text-default-500">{t("adminAnnouncementsDescription")}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-default-200 bg-content2 px-3 py-2.5">
                            <p className="text-xs uppercase tracking-wide text-default-500">{t("totalLabel")}</p>
                            <p className="mt-1 text-2xl font-semibold text-foreground">{announcements.length}</p>
                        </div>
                        <div className="rounded-lg border border-default-200 bg-content2 px-3 py-2.5">
                            <p className="text-xs uppercase tracking-wide text-default-500">{t("active")}</p>
                            <p className="mt-1 text-2xl font-semibold text-success-600">
                                {announcements.filter((item) => item.is_active).length}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Button
                            color="primary"
                            variant="solid"
                            onPress={openAnnouncementCreateModal}
                            startContent={<Icon icon="solar:add-circle-bold" />}
                            className="h-11"
                        >
                            {t("adminCreateAnnouncement")}
                        </Button>
                        <Button
                            color="primary"
                            variant="flat"
                            onPress={() => setIsAnnouncementListModalOpen(true)}
                            startContent={<Icon icon="solar:list-bold" />}
                            className="h-11"
                        >
                            {t("adminViewAllAnnouncements")}
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <Icon icon="solar:widget-bold" className="text-xl text-green-600 dark:text-green-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{t("adminFeatureFlagsTitle")}</h3>
                            <p className="text-xs text-default-500">{t("adminFeatureFlagsDescription")}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-default-200 p-3 bg-content2">
                        <p className="text-sm text-default-600">{t("adminEnabledFeatures")}</p>
                        <Chip color="success" variant="flat">{totalEnabledFlags}/{featureFlags.length}</Chip>
                    </div>
                    <Button
                        color="success"
                        variant="flat"
                        onPress={() => setIsFeatureFlagsModalOpen(true)}
                        startContent={<Icon icon="solar:settings-bold" />}
                    >
                        {t("adminManageFeatureFlags")}
                    </Button>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <Icon icon="solar:shield-warning-bold" className="text-xl text-red-600 dark:text-red-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{t("adminMaintenanceTitle")}</h3>
                            <p className="text-xs text-default-500">{t("adminMaintenanceDescription")}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-default-200 p-3 bg-content2">
                        <p className="text-sm text-default-600">{t("status")}</p>
                        <Chip size="sm" color={isMaintenanceEffectivelyActive ? "danger" : "success"} variant="flat">
                            {isMaintenanceEffectivelyActive ? t("adminMaintenanceStatusActive") : t("adminMaintenanceStatusNormal")}
                        </Chip>
                    </div>
                    {maintenance.schedule_type === "scheduled" && (maintenance.start_time || maintenance.end_time) && (
                        <div className="text-xs text-default-500 rounded-lg border border-default-200 p-3 space-y-1">
                            {maintenance.start_time && (
                                <p>{t("adminMaintenanceStartTime")}: {new Date(maintenance.start_time).toLocaleString("th-TH")}</p>
                            )}
                            {maintenance.end_time && (
                                <p>{t("adminMaintenanceEndTime")}: {new Date(maintenance.end_time).toLocaleString("th-TH")}</p>
                            )}
                        </div>
                    )}
                    <p className="text-xs text-default-500 rounded-lg border border-default-200 p-3">
                        {maintenance.message || t("adminMaintenanceDescription")}
                    </p>
                    <Button
                        color="danger"
                        variant="flat"
                        onPress={() => setIsMaintenanceModalOpen(true)}
                        startContent={<Icon icon="solar:settings-bold" />}
                    >
                        {t("adminConfigureMaintenance")}
                    </Button>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-default-100 rounded-lg">
                            <Icon icon="solar:heart-pulse-bold" className="text-xl text-default-600" />
                        </div>
                        <h3 className="font-semibold text-foreground">{t("adminServiceHealthTitle")}</h3>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-default-500">{t("status")}</span>
                        <Chip size="sm" color={serviceHealth?.overall_status === "up" ? "success" : "warning"} variant="flat">
                            {serviceHealth?.overall_status || "unknown"}
                        </Chip>
                    </div>
                    <Divider />
                    {serviceHealth?.dependencies.map((dependency) => (
                        <div key={dependency.name} className="flex items-center justify-between gap-3 rounded-lg border border-default-200 p-3">
                            <div>
                                <p className="text-sm font-medium text-foreground">{dependency.name}</p>
                                <p className="text-xs text-default-500">{dependency.detail}</p>
                            </div>
                            <Chip size="sm" variant="flat" color={dependency.status === "up" ? "success" : "danger"}>
                                {dependency.status}
                            </Chip>
                        </div>
                    ))}
                </CardBody>
            </Card>

            <Modal
                isOpen={isAnnouncementModalOpen}
                onClose={closeAnnouncementComposer}
                size="5xl"
                scrollBehavior="inside"
                classNames={{ base: "max-h-[92vh] w-[96vw] max-w-[1440px]" }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{editingAnnouncementId ? t("adminEditAnnouncement") : t("adminAnnouncementsTitle")}</ModalHeader>
                            <ModalBody className="p-0 xl:overflow-hidden">
                                <div className="grid grid-cols-1 xl:grid-cols-3 xl:h-[82vh]">
                                    <div className="space-y-4 border-b border-default-100 p-5 xl:col-span-1 xl:h-full xl:overflow-y-auto xl:border-b-0 xl:border-r">
                                        <div className="rounded-xl border border-default-200 bg-content2 p-3">
                                            <p className="text-sm font-semibold text-foreground">{t("adminAnnouncementFormLanguageTitle")}</p>
                                            <p className="text-xs text-default-500 mt-1">{t("adminAnnouncementFormLanguageHint")}</p>
                                        </div>

                                        <div className="space-y-3 rounded-xl border border-default-200 p-3">
                                            <p className="text-sm font-semibold text-foreground">{t("adminAnnouncementThaiSection")}</p>
                                            <Input
                                                label={t("adminAnnouncementTitleThai")}
                                                labelPlacement="outside-top"
                                                value={announcementLocalizedForm.title_th}
                                                onValueChange={(value) => setAnnouncementLocalizedForm((prev) => ({ ...prev, title_th: value }))}
                                                variant="bordered"
                                                classNames={fieldClassNames}
                                            />
                                            <Textarea
                                                label={t("adminAnnouncementMessageThai")}
                                                labelPlacement="outside-top"
                                                value={announcementLocalizedForm.message_th}
                                                onValueChange={(value) => setAnnouncementLocalizedForm((prev) => ({ ...prev, message_th: value }))}
                                                minRows={3}
                                                variant="bordered"
                                                classNames={textareaClassNames}
                                            />
                                            <Input
                                                label={t("adminAnnouncementActionLabelThai")}
                                                labelPlacement="outside-top"
                                                value={announcementLocalizedForm.action_label_th}
                                                onValueChange={(value) => setAnnouncementLocalizedForm((prev) => ({ ...prev, action_label_th: value }))}
                                                variant="bordered"
                                                classNames={fieldClassNames}
                                            />
                                        </div>

                                        <div className="space-y-3 rounded-xl border border-default-200 p-3">
                                            <p className="text-sm font-semibold text-foreground">{t("adminAnnouncementEnglishSection")}</p>
                                            <Input
                                                label={t("adminAnnouncementTitleEnglish")}
                                                labelPlacement="outside-top"
                                                value={announcementLocalizedForm.title_en}
                                                onValueChange={(value) => setAnnouncementLocalizedForm((prev) => ({ ...prev, title_en: value }))}
                                                variant="bordered"
                                                classNames={fieldClassNames}
                                            />
                                            <Textarea
                                                label={t("adminAnnouncementMessageEnglish")}
                                                labelPlacement="outside-top"
                                                value={announcementLocalizedForm.message_en}
                                                onValueChange={(value) => setAnnouncementLocalizedForm((prev) => ({ ...prev, message_en: value }))}
                                                minRows={3}
                                                variant="bordered"
                                                classNames={textareaClassNames}
                                            />
                                            <Input
                                                label={t("adminAnnouncementActionLabelEnglish")}
                                                labelPlacement="outside-top"
                                                value={announcementLocalizedForm.action_label_en}
                                                onValueChange={(value) => setAnnouncementLocalizedForm((prev) => ({ ...prev, action_label_en: value }))}
                                                variant="bordered"
                                                classNames={fieldClassNames}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Select
                                                label={t("adminAnnouncementContentType")}
                                                labelPlacement="outside-top"
                                                selectedKeys={new Set([announcementForm.content_type])}
                                                onSelectionChange={(keys) => {
                                                    const selected = Array.from(keys)[0] as "text" | "image" | "mixed" | undefined;
                                                    if (!selected) return;
                                                    setAnnouncementForm((prev) => ({ ...prev, content_type: selected }));
                                                }}
                                                variant="bordered"
                                                classNames={selectClassNames}
                                            >
                                                {announcementContentOptions.map((option) => (
                                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                                ))}
                                            </Select>
                                            <Select
                                                label={t("adminAnnouncementDisplayMode")}
                                                labelPlacement="outside-top"
                                                selectedKeys={new Set([announcementForm.display_mode])}
                                                onSelectionChange={(keys) => {
                                                    const selected = Array.from(keys)[0] as "banner_top" | "fullscreen" | undefined;
                                                    if (!selected) return;
                                                    setAnnouncementForm((prev) => ({ ...prev, display_mode: selected }));
                                                }}
                                                variant="bordered"
                                                classNames={selectClassNames}
                                            >
                                                {announcementDisplayModeOptions.map((option) => (
                                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                                ))}
                                            </Select>
                                        </div>

                                        {announcementForm.content_type !== "text" && (
                                            <div className="space-y-3 rounded-lg border border-default-200 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm font-medium text-foreground">{t("adminAnnouncementImageSection")}</p>
                                                    <Button
                                                        size="sm"
                                                        variant="flat"
                                                        color="primary"
                                                        isLoading={isUploadingAnnouncementImage}
                                                        startContent={<Icon icon="solar:upload-bold" />}
                                                        onPress={() => announcementImageInputRef.current?.click()}
                                                    >
                                                        {t("adminAnnouncementUploadImage")}
                                                    </Button>
                                                </div>
                                                <input
                                                    ref={announcementImageInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0] || null;
                                                        void uploadAnnouncementImage(file);
                                                    }}
                                                />
                                                <Input
                                                    label={t("adminAnnouncementImageUrl")}
                                                    labelPlacement="outside-top"
                                                    value={announcementForm.image_url || ""}
                                                    onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, image_url: value }))}
                                                    variant="bordered"
                                                    placeholder="https://..."
                                                    description={t("adminAnnouncementImageUrlHint")}
                                                    classNames={fieldClassNames}
                                                />
                                            </div>
                                        )}

                                        <Input
                                            label={t("adminAnnouncementActionUrl")}
                                            labelPlacement="outside-top"
                                            value={announcementForm.action_url || ""}
                                            onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, action_url: value }))}
                                            variant="bordered"
                                            placeholder="https://..."
                                            classNames={fieldClassNames}
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label={t("adminScheduleAt")}
                                                labelPlacement="outside-top"
                                                type="datetime-local"
                                                value={toLocalInputValue(announcementForm.scheduled_at)}
                                                onValueChange={(value) => setAnnouncementForm((prev) => ({
                                                    ...prev,
                                                    scheduled_at: value ? new Date(value).toISOString() : null,
                                                }))}
                                                variant="bordered"
                                                classNames={fieldClassNames}
                                            />
                                            <Input
                                                label={t("adminExpiresAt")}
                                                labelPlacement="outside-top"
                                                type="datetime-local"
                                                value={toLocalInputValue(announcementForm.expires_at)}
                                                onValueChange={(value) => setAnnouncementForm((prev) => ({
                                                    ...prev,
                                                    expires_at: value ? new Date(value).toISOString() : null,
                                                }))}
                                                variant="bordered"
                                                classNames={fieldClassNames}
                                            />
                                        </div>

                                        <Select
                                            label={t("adminAudienceRoles")}
                                            labelPlacement="outside-top"
                                            placeholder={t("adminAudienceRolesPlaceholder")}
                                            selectionMode="multiple"
                                            selectedKeys={new Set(announcementForm.audience.length > 0 ? announcementForm.audience : ["all"])}
                                            onSelectionChange={(keys) => {
                                                if (keys === "all") {
                                                    setAnnouncementForm((prev) => ({ ...prev, audience: ["all"] }));
                                                    return;
                                                }

                                                const selected = Array.from(keys as Set<string>).map(String);
                                                const normalized = selected.filter((item) => item !== "all");
                                                if (selected.length === 0 || normalized.length === 0) {
                                                    setAnnouncementForm((prev) => ({ ...prev, audience: ["all"] }));
                                                    return;
                                                }

                                                setAnnouncementForm((prev) => ({ ...prev, audience: normalized }));
                                            }}
                                            variant="bordered"
                                            description={t("adminAudienceRolesHint")}
                                            classNames={selectClassNames}
                                        >
                                            {audienceOptions.map((option) => (
                                                <SelectItem key={option.key} textValue={option.label}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </Select>

                                        <Select
                                            label={t("adminAnnouncementDisplayPaths")}
                                            labelPlacement="outside-top"
                                            selectionMode="multiple"
                                            selectedKeys={new Set(announcementForm.display_paths.length > 0 ? announcementForm.display_paths : ["all_pages"])}
                                            onSelectionChange={(keys) => {
                                                if (keys === "all") {
                                                    setAnnouncementForm((prev) => ({ ...prev, display_paths: ["all_pages"] }));
                                                    return;
                                                }

                                                const selected = Array.from(keys as Set<string>).map(String);
                                                const normalized = selected.filter((item) => item !== "all_pages");
                                                if (selected.length === 0 || normalized.length === 0) {
                                                    setAnnouncementForm((prev) => ({ ...prev, display_paths: ["all_pages"] }));
                                                    return;
                                                }

                                                setAnnouncementForm((prev) => ({ ...prev, display_paths: normalized }));
                                            }}
                                            variant="bordered"
                                            description={t("adminAnnouncementDisplayPathsHint")}
                                            classNames={selectClassNames}
                                        >
                                            {announcementDisplayPathOptions.map((option) => (
                                                <SelectItem key={option.key}>{option.label}</SelectItem>
                                            ))}
                                        </Select>

                                        <CheckboxGroup
                                            value={announcementToggleValues}
                                            onValueChange={(values) => {
                                                const selectedValues = new Set(values);
                                                setAnnouncementForm((prev) => ({
                                                    ...prev,
                                                    require_acknowledge: selectedValues.has("require_acknowledge"),
                                                    is_dismissible: selectedValues.has("is_dismissible"),
                                                    is_active: selectedValues.has("is_active"),
                                                }));
                                            }}
                                            className="mt-2 px-1"
                                            classNames={{
                                                wrapper: "gap-3",
                                            }}
                                        >
                                            <Checkbox
                                                value="require_acknowledge"
                                                color="primary"
                                                className="w-full max-w-none rounded-md px-2 py-1.5 hover:bg-default-100/60"
                                                classNames={{
                                                    label: "text-sm font-medium text-foreground leading-6",
                                                }}
                                            >
                                                {t("adminRequireAcknowledge")}
                                            </Checkbox>
                                            <Checkbox
                                                value="is_dismissible"
                                                color="primary"
                                                className="w-full max-w-none rounded-md px-2 py-1.5 hover:bg-default-100/60"
                                                classNames={{
                                                    label: "text-sm font-medium text-foreground leading-6",
                                                }}
                                            >
                                                {t("adminAnnouncementDismissible")}
                                            </Checkbox>
                                            <Checkbox
                                                value="is_active"
                                                color="primary"
                                                className="w-full max-w-none rounded-md px-2 py-1.5 hover:bg-default-100/60"
                                                classNames={{
                                                    label: "text-sm font-medium text-foreground leading-6",
                                                }}
                                            >
                                                {t("status")}
                                            </Checkbox>
                                        </CheckboxGroup>
                                    </div>

                                    <div className="space-y-4 bg-default-50/60 p-5 xl:col-span-2 xl:sticky xl:top-0 xl:h-full">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">{t("adminAnnouncementPreviewBrowserTitle")}</p>
                                                <p className="text-xs text-default-500">{t("adminAnnouncementPreviewBrowserHint")}</p>
                                            </div>
                                            <div className="inline-flex rounded-lg border border-default-200 bg-content1 p-1">
                                                <Button
                                                    size="sm"
                                                    variant={announcementPreviewLanguage === "th" ? "flat" : "light"}
                                                    color={announcementPreviewLanguage === "th" ? "primary" : "default"}
                                                    onPress={() => setAnnouncementPreviewLanguage("th")}
                                                >
                                                    TH
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={announcementPreviewLanguage === "en" ? "flat" : "light"}
                                                    color={announcementPreviewLanguage === "en" ? "primary" : "default"}
                                                    onPress={() => setAnnouncementPreviewLanguage("en")}
                                                >
                                                    EN
                                                </Button>
                                            </div>
                                        </div>

                                        <Select
                                            label={t("adminAnnouncementPreviewPath")}
                                            labelPlacement="outside-top"
                                            selectedKeys={new Set([announcementPreviewPath])}
                                            onSelectionChange={(keys) => {
                                                const selected = Array.from(keys)[0] as string | undefined;
                                                if (!selected) return;
                                                setAnnouncementPreviewPath(selected);
                                            }}
                                            variant="bordered"
                                            classNames={selectClassNames}
                                        >
                                            {announcementDisplayPathOptions.map((option) => (
                                                <SelectItem key={option.key}>{option.label}</SelectItem>
                                            ))}
                                        </Select>

                                        <div className="rounded-2xl border border-default-200 bg-content1 shadow-sm overflow-hidden">
                                            <div className="flex items-center justify-between border-b border-default-100 bg-default-100/70 px-3 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                                </div>
                                                <div className="rounded-md bg-content1 px-2 py-1 text-[11px] text-default-500">
                                                    https://itii.osp101.dev/{announcementPreviewLanguage === "th" ? "th" : "en"}{announcementPreviewPathUrlMap[announcementPreviewPath] || "/home"}
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                {!previewMatchesSelectedPath ? (
                                                    <div className="rounded-xl border border-dashed border-default-300 bg-default-50 px-4 py-6 text-center">
                                                        <p className="text-sm font-medium text-foreground">{t("adminAnnouncementNotVisibleOnPreviewPath")}</p>
                                                        <p className="mt-1 text-xs text-default-500">{t("adminAnnouncementNotVisibleOnPreviewPathHint", { path: previewPathLabel })}</p>
                                                    </div>
                                                ) : announcementForm.display_mode === "banner_top" ? (
                                                    <div className="rounded-xl border border-sky-200 bg-linear-to-r from-sky-50 to-cyan-50 px-4 py-3 shadow-sm">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-semibold text-sky-900">{localizedPreviewTitle}</p>
                                                                {localizedPreviewMessage ? <p className="text-sm text-sky-800/90">{localizedPreviewMessage}</p> : null}
                                                            </div>
                                                            <Icon icon="solar:bell-bold" className="text-xl text-sky-500" />
                                                        </div>
                                                        {announcementForm.content_type !== "text" && announcementForm.image_url ? (
                                                            <img src={toAnnouncementImagePreviewUrl(announcementForm.image_url)} alt="announcement-preview" className="mt-3 h-36 w-full rounded-lg object-cover" />
                                                        ) : null}
                                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                                            {!!announcementForm.action_url && (
                                                                <Button size="sm" color="default" variant="flat">
                                                                    {localizedPreviewActionLabel}
                                                                </Button>
                                                            )}
                                                            {announcementForm.require_acknowledge ? (
                                                                <Button size="sm" color="primary" variant="flat">
                                                                    {t("adminAcknowledgeAction")}
                                                                </Button>
                                                            ) : null}
                                                            {!announcementForm.require_acknowledge && announcementForm.is_dismissible ? (
                                                                <Button size="sm" variant="light">
                                                                    {t("dismiss")}
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-xl bg-black/80 p-4 text-white">
                                                        <p className="text-lg font-semibold">{localizedPreviewTitle}</p>
                                                        {localizedPreviewMessage ? <p className="text-sm text-white/90 mt-1">{localizedPreviewMessage}</p> : null}
                                                        {announcementForm.content_type !== "text" && announcementForm.image_url ? (
                                                            <img src={toAnnouncementImagePreviewUrl(announcementForm.image_url)} alt="announcement-preview" className="mt-3 h-44 w-full rounded-xl object-contain bg-black/30" />
                                                        ) : null}
                                                        <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
                                                            {!!announcementForm.action_url && (
                                                                <Button size="sm" color="primary" variant="solid">
                                                                    {localizedPreviewActionLabel}
                                                                </Button>
                                                            )}
                                                            {announcementForm.require_acknowledge ? (
                                                                <Button size="sm" color="primary" variant="solid">
                                                                    {t("adminAcknowledgeAction")}
                                                                </Button>
                                                            ) : null}
                                                            {!announcementForm.require_acknowledge && announcementForm.is_dismissible ? (
                                                                <Button size="sm" variant="bordered" className="border-white/40 text-white">
                                                                    {t("dismiss")}
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={() => {
                                    closeAnnouncementComposer();
                                    onClose();
                                }}>{editingAnnouncementId ? t("adminCancelEditAnnouncement") : t("cancel")}</Button>
                                <Button
                                    onPress={async () => {
                                    const success = await saveAnnouncement();
                                    if (success) {
                                        onClose();
                                    }
                                }}
                                    isDisabled={!canSubmitAnnouncement || isUploadingAnnouncementImage}
                                    className="bg-linear-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-500/25 data-[hover=true]:from-blue-500 data-[hover=true]:to-indigo-600 data-[disabled=true]:from-blue-200 data-[disabled=true]:to-indigo-200 data-[disabled=true]:text-white/90"
                                    startContent={<Icon icon="solar:add-circle-bold" />}
                                >
                                    {editingAnnouncementId ? t("adminSaveAnnouncementChanges") : t("adminCreateAnnouncement")}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isFeatureFlagsModalOpen}
                onClose={() => {
                    setIsFeatureFlagsModalOpen(false);
                    setFeatureFlagSearchQuery("");
                    setFeatureFlagStatusFilter("all");
                }}
                size="3xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-base font-semibold text-foreground">{t("adminFeatureFlagsTitle")}</p>
                                    <p className="mt-0.5 text-xs text-default-500">{t("adminFeatureFlagsDescription")}</p>
                                </div>
                                <Chip color="success" variant="flat">{totalEnabledFlags}/{featureFlags.length}</Chip>
                            </ModalHeader>
                            <ModalBody className="space-y-3">
                                <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-900/20 p-3">
                                    <Icon icon="solar:danger-triangle-bold" className="text-lg text-warning-600 dark:text-warning-400 mt-0.5 shrink-0" />
                                    <p className="text-xs text-warning-700 dark:text-warning-300">{t("adminFeatureFlagConfirmWarning")}</p>
                                </div>
                                <div className="rounded-lg border border-default-200 bg-content2 p-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <Input
                                            value={featureFlagSearchQuery}
                                            onValueChange={setFeatureFlagSearchQuery}
                                            placeholder={t("adminFeatureFlagSearchPlaceholder")}
                                            startContent={<Icon icon="solar:magnifer-bold" className="text-default-400" />}
                                            variant="bordered"
                                            size="md"
                                            className="md:col-span-2"
                                            classNames={{
                                                inputWrapper: "border-default-200 bg-content1 hover:border-success-300 data-[focus=true]:border-success",
                                            }}
                                        />
                                        <Select
                                            aria-label={t("adminFeatureFlagStatusFilter")}
                                            placeholder={t("adminFeatureFlagStatusFilter")}
                                            selectedKeys={new Set([featureFlagStatusFilter])}
                                            onSelectionChange={(keys) => {
                                                const selected = Array.from(keys)[0] as "all" | "enabled" | "disabled" | undefined;
                                                if (!selected) return;
                                                setFeatureFlagStatusFilter(selected);
                                            }}
                                            variant="bordered"
                                            disallowEmptySelection
                                            classNames={{
                                                trigger: "border-default-200 bg-content1 hover:border-success-300 data-[focus=true]:border-success",
                                            }}
                                        >
                                            <SelectItem key="all">{t("adminFeatureFlagStatusAll")}</SelectItem>
                                            <SelectItem key="enabled">{t("adminFeatureFlagStatusEnabled")}</SelectItem>
                                            <SelectItem key="disabled">{t("adminFeatureFlagStatusDisabled")}</SelectItem>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <Button
                                        color="danger"
                                        variant="flat"
                                        onPress={() => requestBulkFlagChange(false)}
                                        isDisabled={!canDisableAllFeatureFlags}
                                        startContent={<Icon icon="solar:close-circle-bold" />}
                                    >
                                        {t("adminFeatureFlagDisableAll")}
                                    </Button>
                                    <Button
                                        color="success"
                                        variant="flat"
                                        onPress={() => requestBulkFlagChange(true)}
                                        isDisabled={!canEnableAllFeatureFlags}
                                        startContent={<Icon icon="solar:check-circle-bold" />}
                                    >
                                        {t("adminFeatureFlagEnableAll")}
                                    </Button>
                                </div>
                                {filteredGroupedFeatureFlags.map((section) => (
                                    <div key={section.id} className="space-y-2">
                                        <div className="rounded-lg border border-default-200 bg-content2 px-3 py-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-default-700">{section.title}</p>
                                            <p className="text-xs text-default-500 mt-0.5">{section.description}</p>
                                        </div>
                                        <div className="space-y-2">
                                            {section.flags.map((flag) => (
                                                <div key={flag.key} className="flex items-center justify-between gap-3 rounded-lg border border-default-200 px-3 py-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">{flag.label}</p>
                                                        <p className="text-xs text-default-500">{flag.description}</p>
                                                        <p className="text-xs text-default-400">{flag.key}</p>
                                                    </div>
                                                    <Switch
                                                        isSelected={flag.enabled}
                                                        onValueChange={(value) => requestFlagChange(flag.key, flag.label, value)}
                                                        color="success"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {filteredGroupedFeatureFlags.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-default-300 bg-content2 px-4 py-6 text-center">
                                        <p className="text-sm text-default-600">{t("adminFeatureFlagNoResults")}</p>
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{t("adminCloseButton")}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Feature Flag Confirmation Modal */}
            <Modal
                isOpen={flagConfirmTarget !== null}
                onClose={() => { setFlagConfirmTarget(null); setFlagConfirmInput(""); }}
                size="sm"
                isDismissable={false}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex items-center gap-2">
                                <Icon icon="solar:danger-triangle-bold" className="text-xl text-warning-500" />
                                <span>{t("adminFeatureFlagConfirmTitle")}</span>
                            </ModalHeader>
                            <ModalBody className="space-y-4">
                                <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-900/20 p-3 space-y-1">
                                    <p className="text-xs text-warning-700 dark:text-warning-300">{t("adminFeatureFlagConfirmWarning")}</p>
                                    <p className="text-xs text-warning-600 dark:text-warning-400">{t("adminFeatureFlagImpactNote")}</p>
                                </div>
                                {flagConfirmTarget?.mode === "single" && (
                                    <div className="rounded-lg border border-default-200 bg-content2 p-3 space-y-1">
                                        <p className="text-sm font-semibold text-foreground">{flagConfirmTarget.label}</p>
                                        <div className="flex items-center gap-2 text-xs text-default-500">
                                            <Chip size="sm" variant="flat" color={flagConfirmTarget.enabled ? "default" : "success"}>
                                                {flagConfirmTarget.enabled ? t("adminFeatureFlagConfirmDisable") : t("adminFeatureFlagConfirmEnable")}
                                            </Chip>
                                            <span className="text-default-400">{flagConfirmTarget.key}</span>
                                        </div>
                                    </div>
                                )}
                                {flagConfirmTarget?.mode === "bulk" && (
                                    <div className="rounded-lg border border-default-200 bg-content2 p-3 space-y-1">
                                        <p className="text-sm font-semibold text-foreground">
                                            {flagConfirmTarget.enabled
                                                ? t("adminFeatureFlagBulkConfirmEnable")
                                                : t("adminFeatureFlagBulkConfirmDisable")}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-default-500">
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color={flagConfirmTarget.enabled ? "success" : "danger"}
                                            >
                                                {flagConfirmTarget.enabled ? t("adminFeatureFlagConfirmEnable") : t("adminFeatureFlagConfirmDisable")}
                                            </Chip>
                                            <span className="text-default-400">
                                                {t("adminFeatureFlagBulkCount", { count: flagConfirmTarget.keys.length })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <p className="text-xs text-default-600">{t("adminFeatureFlagConfirmTypeHint")}</p>
                                    <Input
                                        value={flagConfirmInput}
                                        onValueChange={setFlagConfirmInput}
                                        placeholder={t("adminFeatureFlagConfirmPlaceholder")}
                                        variant="bordered"
                                        size="sm"
                                        classNames={{
                                            inputWrapper: "border-default-200 bg-content1 hover:border-warning-300 data-[focus=true]:border-warning",
                                        }}
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{t("adminFeatureFlagConfirmCancel")}</Button>
                                <Button
                                    color="warning"
                                    isDisabled={flagConfirmInput !== "ยืนยัน"}
                                    onPress={() => {
                                        if (!flagConfirmTarget) return;
                                        if (flagConfirmTarget.mode === "single") {
                                            updateFlag(flagConfirmTarget.key, flagConfirmTarget.enabled);
                                            return;
                                        }
                                        updateFlagsBulk(flagConfirmTarget.keys, flagConfirmTarget.enabled);
                                    }}
                                >
                                    {t("adminFeatureFlagConfirmAction")}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isBackupListModalOpen}
                onClose={() => setIsBackupListModalOpen(false)}
                size="3xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-base font-semibold text-foreground">{t("adminBackupListTitle")}</p>
                                    <p className="mt-0.5 text-xs text-default-500">{t("adminBackupListDescription")}</p>
                                </div>
                                <Chip color="warning" variant="flat">{backups.length}</Chip>
                            </ModalHeader>
                            <ModalBody className="space-y-3">
                                {backups.length === 0 ? (
                                    <p className="text-sm text-default-500">{t("adminNoBackupRecords")}</p>
                                ) : (
                                    <>
                                        <div className="flex justify-end">
                                            <Select
                                                aria-label={t("adminBackupSortLabel")}
                                                selectedKeys={new Set([backupListSortOrder])}
                                                onSelectionChange={(keys) => {
                                                    const selected = Array.from(keys)[0] as "latest" | "oldest" | undefined;
                                                    if (!selected) return;
                                                    setBackupListSortOrder(selected);
                                                }}
                                                disallowEmptySelection
                                                variant="bordered"
                                                size="sm"
                                                className="w-full sm:w-56"
                                                classNames={{
                                                    trigger: "border-default-200 bg-content1 hover:border-primary-300 data-[focus=true]:border-primary",
                                                }}
                                            >
                                                <SelectItem key="latest">{t("adminBackupSortLatest")}</SelectItem>
                                                <SelectItem key="oldest">{t("adminBackupSortOldest")}</SelectItem>
                                            </Select>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <Table
                                                aria-label="Backup list table"
                                                removeWrapper
                                                classNames={{
                                                    th: "bg-content2 text-default-600 font-semibold text-xs",
                                                    td: "py-3 align-top",
                                                }}
                                            >
                                                <TableHeader>
                                                    <TableColumn>{t("adminBackupTableColumnName")}</TableColumn>
                                                    <TableColumn>{t("adminBackupTableColumnSlot")}</TableColumn>
                                                    <TableColumn>{t("adminBackupTableColumnCreatedAt")}</TableColumn>
                                                    <TableColumn>{t("adminBackupTableColumnSize")}</TableColumn>
                                                    <TableColumn className="text-right">{t("adminBackupTableColumnActions")}</TableColumn>
                                                </TableHeader>
                                                <TableBody items={backupListPageItems}>
                                                    {(backup) => (
                                                        <TableRow key={backup.id}>
                                                            <TableCell>
                                                                <p className="text-sm font-medium text-foreground break-all">{backup.backup_name}</p>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-xs text-default-500">
                                                                    {typeof backup.storage_slot === "number"
                                                                        ? t("adminBackupStorageSlot", { slot: backup.storage_slot })
                                                                        : "-"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-xs text-default-500">{new Date(backup.created_at).toLocaleString()}</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Chip size="sm" variant="flat" color="warning">
                                                                    {(backup.file_size_bytes / 1048576).toFixed(1)} MB
                                                                </Chip>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-wrap justify-end gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        color="danger"
                                                                        variant="flat"
                                                                        startContent={<Icon icon="solar:refresh-bold" />}
                                                                        onPress={() => {
                                                                            onClose();
                                                                            setIsBackupListModalOpen(false);
                                                                            openRestoreModal(backup);
                                                                        }}
                                                                    >
                                                                        {t("adminBackupRestore")}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        startContent={<Icon icon="solar:link-round-bold" />}
                                                                        onPress={() => openBackupDownloadURL(backup)}
                                                                    >
                                                                        {t("adminBackupOpenDownload")}
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <TablePaginationFooter
                                            totalItems={sortedBackups.length}
                                            currentPage={backupListCurrentPage}
                                            rowsPerPage={backupListRowsPerPage}
                                            totalPages={backupListTotalPages}
                                            isEnglish={language === "en"}
                                            nounEnglish="backup"
                                            nounEnglishPlural="backups"
                                            nounThai="รายการสำรองข้อมูล"
                                            onPageChange={setBackupListPage}
                                            onRowsPerPageChange={setBackupListRowsPerPage}
                                            rowsPerPageOptions={[5, 10, 20, 50]}
                                        />
                                    </>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{t("adminCloseButton")}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isAnnouncementListModalOpen}
                onClose={() => setIsAnnouncementListModalOpen(false)}
                size="4xl"
                scrollBehavior="inside"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-base font-semibold text-foreground">{t("adminAnnouncementListTitle")}</p>
                                    <p className="mt-0.5 text-xs text-default-500">{t("adminAnnouncementListDescription")}</p>
                                </div>
                                <Chip color="primary" variant="flat">{filteredAnnouncements.length}/{announcements.length}</Chip>
                            </ModalHeader>
                            <ModalBody className="space-y-3">
                                <div className="rounded-xl border border-default-200 bg-content2 p-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <Input
                                            value={announcementListSearchQuery}
                                            onValueChange={setAnnouncementListSearchQuery}
                                            placeholder={t("adminAnnouncementListSearchPlaceholder")}
                                            startContent={<Icon icon="solar:magnifer-bold" className="text-default-400" />}
                                            variant="bordered"
                                            size="md"
                                            className="md:col-span-2"
                                            classNames={{
                                                inputWrapper: "border-default-200 bg-content1 hover:border-primary-300 data-[focus=true]:border-primary",
                                            }}
                                        />
                                        <Select
                                            aria-label={t("adminAnnouncementListStatusFilter")}
                                            placeholder={t("adminAnnouncementListStatusFilter")}
                                            selectedKeys={new Set([announcementListStatusFilter])}
                                            onSelectionChange={(keys) => {
                                                const selected = Array.from(keys)[0] as "all" | "active" | "inactive" | undefined;
                                                if (!selected) return;
                                                setAnnouncementListStatusFilter(selected);
                                            }}
                                            variant="bordered"
                                            disallowEmptySelection
                                            classNames={{
                                                trigger: "border-default-200 bg-content1 hover:border-primary-300 data-[focus=true]:border-primary",
                                            }}
                                        >
                                            <SelectItem key="all">{t("adminAnnouncementListStatusAll")}</SelectItem>
                                            <SelectItem key="active">{t("adminAnnouncementListStatusActive")}</SelectItem>
                                            <SelectItem key="inactive">{t("adminAnnouncementListStatusInactive")}</SelectItem>
                                        </Select>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table
                                        aria-label="Announcement list table"
                                        removeWrapper
                                        classNames={{
                                            th: "bg-content2 text-default-600 font-semibold text-xs",
                                            td: "py-3 align-top",
                                        }}
                                    >
                                        <TableHeader columns={announcementListColumns}>
                                            {(column) => (
                                                <TableColumn
                                                    key={column.key}
                                                    align={column.key === "ack" || column.key === "actions" ? "center" : "start"}
                                                >
                                                    {column.label}
                                                </TableColumn>
                                            )}
                                        </TableHeader>
                                        <TableBody items={announcementListPageItems} emptyContent={t("adminAnnouncementListEmpty")}>
                                            {(item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="min-w-0 space-y-1">
                                                            <p className="text-sm font-semibold text-foreground line-clamp-1">
                                                                {getAnnouncementTextByLanguage(item, "title", language)}
                                                            </p>
                                                            {getAnnouncementTextByLanguage(item, "message", language) ? (
                                                                <p className="text-xs text-default-500 line-clamp-2">
                                                                    {getAnnouncementTextByLanguage(item, "message", language)}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                                            <Chip size="sm" color="primary" variant="flat">
                                                                {announcementDisplayModeLabelMap.get(item.display_mode) || item.display_mode}
                                                            </Chip>
                                                            <Chip size="sm" color={item.is_active ? "success" : "default"} variant="flat">
                                                                {item.is_active ? t("active") : t("inactive")}
                                                            </Chip>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs text-default-500">{item.ack_count}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="flat"
                                                                startContent={<Icon icon="solar:copy-bold" />}
                                                                onPress={() => openAnnouncementDuplicateFromList(item)}
                                                            >
                                                                {t("adminAnnouncementDuplicate")}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                color="primary"
                                                                variant="flat"
                                                                startContent={<Icon icon="solar:pen-bold" />}
                                                                onPress={() => openAnnouncementEditorFromList(item)}
                                                            >
                                                                {t("editAction")}
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                <TablePaginationFooter
                                    totalItems={filteredAnnouncements.length}
                                    currentPage={announcementListCurrentPage}
                                    rowsPerPage={announcementListRowsPerPage}
                                    totalPages={announcementListTotalPages}
                                    isEnglish={language === "en"}
                                    nounEnglish="announcement"
                                    nounEnglishPlural="announcements"
                                    nounThai="รายการประกาศ"
                                    onPageChange={setAnnouncementListPage}
                                    onRowsPerPageChange={setAnnouncementListRowsPerPage}
                                    rowsPerPageOptions={[5, 10, 20, 50]}
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{t("adminCloseButton")}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={isMaintenanceModalOpen} onClose={() => setIsMaintenanceModalOpen(false)} size="2xl">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{t("adminMaintenanceTitle")}</ModalHeader>
                            <ModalBody className="space-y-5">
                                <RadioGroup
                                    label={t("adminMaintenanceTypeLabel")}
                                    orientation="horizontal"
                                    value={maintenance.schedule_type ?? "indefinite"}
                                    onValueChange={(value) =>
                                        setMaintenance((prev) => ({
                                            ...prev,
                                            schedule_type: value as "indefinite" | "scheduled",
                                            enabled: value === "indefinite" ? prev.enabled : false,
                                        }))
                                    }
                                    classNames={{ label: "text-sm font-medium text-foreground mb-1" }}
                                >
                                    <Radio value="indefinite">{t("adminMaintenanceTypeIndefinite")}</Radio>
                                    <Radio value="scheduled">{t("adminMaintenanceTypeScheduled")}</Radio>
                                </RadioGroup>

                                {(maintenance.schedule_type ?? "indefinite") === "indefinite" && (
                                    <Switch
                                        isSelected={maintenance.enabled}
                                        onValueChange={(value) => setMaintenance((prev) => ({ ...prev, enabled: value }))}
                                        color="danger"
                                    >
                                        {t("adminEnableMaintenance")}
                                    </Switch>
                                )}

                                {(maintenance.schedule_type ?? "indefinite") === "scheduled" && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            type="datetime-local"
                                            label={t("adminMaintenanceStartTime")}
                                            labelPlacement="outside-top"
                                            value={maintenance.start_time ? maintenance.start_time.slice(0, 16) : ""}
                                            onValueChange={(value) =>
                                                setMaintenance((prev) => ({
                                                    ...prev,
                                                    start_time: value ? new Date(value).toISOString() : null,
                                                }))
                                            }
                                            variant="bordered"
                                            classNames={fieldClassNames}
                                        />
                                        <Input
                                            type="datetime-local"
                                            label={t("adminMaintenanceEndTime")}
                                            labelPlacement="outside-top"
                                            value={maintenance.end_time ? maintenance.end_time.slice(0, 16) : ""}
                                            onValueChange={(value) =>
                                                setMaintenance((prev) => ({
                                                    ...prev,
                                                    end_time: value ? new Date(value).toISOString() : null,
                                                }))
                                            }
                                            variant="bordered"
                                            classNames={fieldClassNames}
                                        />
                                    </div>
                                )}

                                <Input
                                    label={t("adminMaintenanceMessage")}
                                    labelPlacement="outside-top"
                                    value={maintenance.message}
                                    onValueChange={(value) => setMaintenance((prev) => ({ ...prev, message: value }))}
                                    variant="bordered"
                                    classNames={fieldClassNames}
                                />
                                <Select
                                    label={t("adminMaintenanceWhitelist")}
                                    labelPlacement="outside-top"
                                    selectionMode="multiple"
                                    selectedKeys={new Set(maintenance.whitelist_admin_users.map(String))}
                                    onSelectionChange={(keys) => {
                                        const ids = [...keys].map(Number).filter((n) => n > 0);
                                        setMaintenance((prev) => ({ ...prev, whitelist_admin_users: ids }));
                                    }}
                                    variant="bordered"
                                    placeholder={t("adminMaintenanceWhitelistPlaceholder")}
                                    description={t("adminMaintenanceWhitelistHint")}
                                    classNames={fieldClassNames}
                                    isDisabled={adminUsers.length === 0}
                                    items={adminUsers}
                                >
                                    {(user) => (
                                        <SelectItem
                                            key={String(user.id)}
                                            textValue={user.full_name || user.username}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{user.full_name || user.username}</span>
                                                <span className="text-xs text-default-400">{user.email ?? user.username}</span>
                                            </div>
                                        </SelectItem>
                                    )}
                                </Select>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{t("cancel")}</Button>
                                <Button color="danger" onPress={async () => {
                                    await saveMaintenance();
                                    onClose();
                                }} startContent={<Icon icon="solar:diskette-bold" />}>
                                    {t("saveSettings")}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={restoreBackupTarget !== null}
                onClose={() => {
                    if (isRestoringBackup) return;
                    setRestoreBackupTarget(null);
                    setRestoreConfirmInput("");
                    setRestoreAcknowledgeOverwrite(false);
                    setRestoreReason("");
                }}
                size="md"
                isDismissable={!isRestoringBackup}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{t("adminBackupRestoreTitle")}</ModalHeader>
                            <ModalBody className="space-y-3">
                                <p className="text-sm text-default-500">{t("adminBackupRestoreDescription")}</p>
                                <div className="rounded-lg border border-danger-200 bg-danger-50/80 px-3 py-2 space-y-1">
                                    <p className="text-sm font-semibold text-danger-700">{t("adminBackupRestoreWarningTitle")}</p>
                                    <p className="text-xs text-danger-700">{t("adminBackupRestoreWarningOverwrite")}</p>
                                    <p className="text-xs text-danger-700">{t("adminBackupRestoreWarningAutoBackup")}</p>
                                </div>
                                {restoreBackupTarget ? (
                                    <div className="rounded-lg border border-default-200 bg-content2 p-3 space-y-1">
                                        <p className="text-sm font-semibold text-foreground">{restoreBackupTarget.backup_name}</p>
                                        <p className="text-xs text-default-500">{new Date(restoreBackupTarget.created_at).toLocaleString()}</p>
                                    </div>
                                ) : null}
                                <Input
                                    label={t("adminBackupRestoreReasonLabel")}
                                    labelPlacement="outside-top"
                                    value={restoreReason}
                                    onValueChange={setRestoreReason}
                                    placeholder={t("adminBackupRestoreReasonPlaceholder")}
                                    variant="bordered"
                                />
                                <Input
                                    label={t("adminBackupRestoreConfirmHint")}
                                    labelPlacement="outside-top"
                                    value={restoreConfirmInput}
                                    onValueChange={setRestoreConfirmInput}
                                    placeholder={t("adminBackupRestorePlaceholder")}
                                    variant="bordered"
                                />
                                <Checkbox
                                    isSelected={restoreAcknowledgeOverwrite}
                                    onValueChange={setRestoreAcknowledgeOverwrite}
                                >
                                    {t("adminBackupRestoreAcknowledge")}
                                </Checkbox>
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    variant="light"
                                    onPress={() => {
                                        setRestoreBackupTarget(null);
                                        setRestoreConfirmInput("");
                                        setRestoreAcknowledgeOverwrite(false);
                                        setRestoreReason("");
                                        onClose();
                                    }}
                                    isDisabled={isRestoringBackup}
                                >
                                    {t("cancel")}
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={submitRestoreBackup}
                                    isLoading={isRestoringBackup}
                                    isDisabled={restoreConfirmInput.trim().toUpperCase() !== "RESTORE" || !restoreAcknowledgeOverwrite}
                                >
                                    {t("adminBackupRestore")}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={isStepUpModalOpen} onClose={() => setIsStepUpModalOpen(false)} size="md" isDismissable={!isStepUpVerifying}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{t("adminStepUpTitle")}</ModalHeader>
                            <ModalBody className="space-y-3">
                                <p className="text-sm text-default-500">
                                    {stepUpMethod === "email"
                                        ? t("adminStepUpDescriptionEmail", { email: stepUpMaskedEmail || "-" })
                                        : t("adminStepUpDescriptionTotp")}
                                </p>
                                <div className="flex flex-col items-center gap-2">
                                    <label className="text-sm text-default-600">{t("adminStepUpCodeLabel")}</label>
                                    <InputOtp
                                        length={6}
                                        value={stepUpCode}
                                        onValueChange={(value) => {
                                            setStepUpCode(value);
                                            if (value.length === 6 && !isStepUpVerifying) {
                                                submitStepUpCode(value);
                                            }
                                        }}
                                        size="lg"
                                        variant="bordered"
                                        isDisabled={isStepUpVerifying}
                                        classNames={{
                                            segment: "w-12 h-14 text-xl",
                                            segmentWrapper: "gap-2",
                                        }}
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose} isDisabled={isStepUpVerifying}>{t("cancel")}</Button>
                                <Button color="primary" onPress={() => submitStepUpCode()} isLoading={isStepUpVerifying} isDisabled={stepUpCode.trim().length !== 6}>
                                    {t("adminStepUpVerifyAction")}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isAnnouncementImageCropModalOpen}
                onClose={resetAnnouncementCropModal}
                size="3xl"
                isDismissable={!isApplyingAnnouncementImageCrop}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{t("adminAnnouncementImageCropTitle")}</ModalHeader>
                            <ModalBody className="space-y-4">
                                <p className="text-sm text-default-500">{t("adminAnnouncementImageCropHint")}</p>
                                <div className="relative h-[52vh] w-full overflow-hidden rounded-xl bg-black/70">
                                    {announcementImageCropSourceUrl ? (
                                        <Cropper
                                            image={announcementImageCropSourceUrl}
                                            crop={announcementImageCropPosition}
                                            zoom={announcementImageCropZoom}
                                            aspect={16 / 9}
                                            onCropChange={setAnnouncementImageCropPosition}
                                            onZoomChange={setAnnouncementImageCropZoom}
                                            onCropComplete={(_, croppedAreaPixels) => setAnnouncementImageCropAreaPixels(croppedAreaPixels)}
                                            objectFit="contain"
                                            showGrid={false}
                                        />
                                    ) : null}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium uppercase tracking-wide text-default-500">{t("adminAnnouncementImageCropZoom")}</label>
                                    <input
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={0.05}
                                        value={announcementImageCropZoom}
                                        onChange={(event) => setAnnouncementImageCropZoom(Number(event.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    variant="light"
                                    onPress={() => {
                                        resetAnnouncementCropModal();
                                        onClose();
                                    }}
                                    isDisabled={isApplyingAnnouncementImageCrop}
                                >
                                    {t("cancel")}
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={applyAnnouncementImageCrop}
                                    isLoading={isApplyingAnnouncementImageCrop}
                                    isDisabled={!announcementImageCropAreaPixels}
                                >
                                    {t("adminAnnouncementApplyCrop")}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}

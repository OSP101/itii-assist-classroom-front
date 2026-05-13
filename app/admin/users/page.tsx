"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    getKeyValue,
} from "@heroui/table";
import { useSocket } from "@/contexts/SocketContext";
import { Pagination } from "@heroui/pagination";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { userService } from "@/services/user.service";
import type { User, CreateUserDto, UpdateUserDto, UserStats } from "@/services/user.service";
import { useAdmin } from "@/contexts/AdminContext";
import { useTableParams } from "@/lib/table/use-table-params";
import { MetricCardSkeleton, TableRowsSkeleton } from "@/components/ui/resource-loading";
import { useI18n } from "@/hooks/useI18n";

// Column definitions
const columnDefs = [
    { key: "username", labelKey: "username", sortable: true },
    { key: "full_name", labelKey: "fullName", sortable: true },
    { key: "email", labelKey: "email", sortable: true },
    { key: "role", labelKey: "role", sortable: true },
    { key: "status", labelKey: "status", sortable: true },
    { key: "provider", labelKey: "type", sortable: false },
    { key: "actions", labelKey: "actions", sortable: false },
];

const roleOptionDefs = [
    { key: "all", labelKey: "allRoles" },
    { key: "admin", labelKey: "roleAdmin" },
    { key: "instructor", labelKey: "roleInstructor" },
    { key: "ta", labelKey: "roleTa" },
];

const statusOptionDefs = [
    { key: "all", labelKey: "allStatuses" },
    { key: "active", labelKey: "active" },
    { key: "inactive", labelKey: "inactive" },
];

const roleLabelKeys: Record<string, string> = {
    admin: "roleAdmin",
    instructor: "roleInstructor",
    ta: "roleTa",
};

const roleColors: Record<string, "primary" | "secondary" | "success" | "warning" | "danger"> = {
    admin: "danger",
    instructor: "primary",
    ta: "success",
};

export default function UsersPage() {
    const t = useI18n();
    const { user: authUser } = useAdmin();
    const { emitDataUpdate, onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, isConnected } = useSocket();
    const isUpdatingRef = useRef(false);
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<UserStats | null>(null);

    // Pagination & Filters
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const {
        params,
        setSearch,
        setPage,
        setSort,
        setFilter,
    } = useTableParams({
        defaultLimit: 7,
        defaultSort: "created_at",
        defaultOrder: "desc",
        searchDebounceMs: 300,
    });
    const [searchInput, setSearchInput] = useState(String(params.search ?? ""));

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 7;
    const search = String(params.search ?? "");
    const roleFilter = String(params.role ?? "all");
    const statusFilter = String(params.status ?? "all");
    const sortBy = String(params.sort ?? "created_at");
    const sortOrder: "ASC" | "DESC" = params.order === "asc" ? "ASC" : "DESC";
    const columns = columnDefs.map((column) => ({
        ...column,
        label: t(column.labelKey),
    }));
    const roleOptions = roleOptionDefs.map((option) => ({
        ...option,
        label: t(option.labelKey),
    }));
    const statusOptions = statusOptionDefs.map((option) => ({
        ...option,
        label: t(option.labelKey),
    }));
    const roleLabels = Object.fromEntries(
        Object.entries(roleLabelKeys).map(([role, key]) => [role, t(key)])
    ) as Record<string, string>;

    // Loading state
    const [isLoading, setIsLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);
    const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userToToggle, setUserToToggle] = useState<User | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newCredentials, setNewCredentials] = useState<{ username: string; password: string } | null>(null);

    // Form data
    const [formData, setFormData] = useState<CreateUserDto>({
        username: "",
        full_name: "",
        email: "",
        role: "ta",
        avatar: "",
    });

    // Track original form data for change detection (edit mode)
    const [originalFormData, setOriginalFormData] = useState<CreateUserDto | null>(null);

    // Avatar preview
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    // Fetch users
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await userService.getUsers({
                page,
                limit,
                search: search || undefined,
                role: roleFilter !== "all" ? roleFilter : undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
                sortBy,
                sortOrder,
            });

            if (response.success && response.data) {
                setUsers(response.data.users);
                setTotalPages(response.data.pagination.totalPages);
                setTotalItems(response.data.pagination.totalItems);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            addToast({
                title: t("somethingWentWrong"),
                description: t("cannotLoadUsers"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, search, roleFilter, statusFilter, sortBy, sortOrder]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        setIsStatsLoading(true);
        try {
            const response = await userService.getStats();
            if (response.success && response.data) {
                setStats(response.data);
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setIsStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchStats();
    }, [fetchUsers, fetchStats]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    // Real-time sync - Subscribe to user updates
    useEffect(() => {
        subscribeToUpdates();
        return () => unsubscribeFromUpdates();
    }, [subscribeToUpdates, unsubscribeFromUpdates]);

    // Handle real-time updates from other tabs/users
    useEffect(() => {
        const unsubscribe = onDataUpdate((data) => {
            if (data.resource === "user" && !isUpdatingRef.current) {
                fetchUsers();
                fetchStats();
            }
        });
        return unsubscribe;
    }, [onDataUpdate, fetchUsers, fetchStats]);

    // Handle create user
    const handleCreate = async () => {
        if (!formData.username || !formData.full_name) {
            addToast({
                title: t("pleaseFillRequiredFields"),
                description: t("usernameAndFullNameRequired"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const response = await userService.createUser(formData);
            if (response.success && response.data) {
                setIsCreateModalOpen(false);
                resetForm();
                
                // Show credentials modal
                setNewCredentials(response.data.credentials);
                setIsCredentialsModalOpen(true);
                
                fetchUsers();
                fetchStats();
                emitDataUpdate("user", "create");
            } else {
                const errorMessage = (response as { error?: { message?: string } }).error?.message || t("somethingWentWrong");
                addToast({
                    title: t("createUserFailed"),
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("createUserFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
            isUpdatingRef.current = false;
        }
    };

    // Handle update user
    const handleUpdate = async () => {
        if (!selectedUser) return;

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const updateData: UpdateUserDto = {
                username: formData.username,
                full_name: formData.full_name,
                email: formData.email || undefined,
                role: formData.role,
                avatar: formData.avatar,
            };

            const response = await userService.updateUser(selectedUser.ID, updateData);
            if (response.success) {
                addToast({
                    title: t("updateUserSuccess"),
                    description: t("userUpdatedForUsername", { username: formData.username }),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsEditModalOpen(false);
                resetForm();
                fetchUsers();
                emitDataUpdate("user", "update", selectedUser.ID);
            } else {
                const errorMessage = (response as { error?: { message?: string } }).error?.message || t("somethingWentWrong");
                addToast({
                    title: t("updateUserFailed"),
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("updateUserFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
            isUpdatingRef.current = false;
        }
    };

    // Handle delete user
    const handleDelete = async () => {
        if (!selectedUser) return;

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const response = await userService.deleteUser(selectedUser.ID);
            if (response.success) {
                addToast({
                    title: t("deleteUserSuccess"),
                    description: t("userDeletedForUsername", { username: selectedUser.username }),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsDeleteModalOpen(false);
                setSelectedUser(null);
                fetchUsers();
                fetchStats();
                emitDataUpdate("user", "delete", selectedUser.ID);
            } else {
                addToast({
                    title: t("deleteUserFailed"),
                    description: response.message || t("somethingWentWrong"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("deleteUserFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
            isUpdatingRef.current = false;
        }
    };

    // Open toggle status confirmation modal
    const openToggleStatusModal = (user: User) => {
        setUserToToggle(user);
        setIsToggleStatusModalOpen(true);
    };

    // Handle toggle status (called from confirmation modal)
    const handleToggleStatus = async () => {
        if (!userToToggle) return;
        const user = userToToggle;
        isUpdatingRef.current = true;
        setIsToggleStatusModalOpen(false);
        try {
            const response = await userService.toggleStatus(user.ID);
            if (response.success) {
                addToast({
                    title: user.is_active ? t("disableUserSuccess") : t("enableUserSuccess"),
                    description: user.is_active
                        ? t("userDisabledForUsername", { username: user.username })
                        : t("userEnabledForUsername", { username: user.username }),
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                fetchUsers();
                fetchStats();
                emitDataUpdate("user", "toggle", user.ID);
            } else {
                addToast({
                    title: t("somethingWentWrong"),
                    description: response.message || t("toggleUserStatusFailed"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("toggleUserStatusFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            isUpdatingRef.current = false;
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            username: "",
            full_name: "",
            email: "",
            role: "ta",
            avatar: "",
        });
        setOriginalFormData(null);
        setAvatarPreview(null);
        setSelectedUser(null);
    };

    // Check if form has changes
    const hasFormChanges = () => {
        if (!originalFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
    };

    // Copy to clipboard
    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            addToast({
                title: t("copiedToClipboard"),
                description: t("copiedLabelToClipboard", { label }),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error) {
            addToast({
                title: t("unableToCopy"),
                description: t("pleaseCopyManually"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    // Open edit modal
    const openEditModal = (user: User) => {
        setSelectedUser(user);
        const userData = {
            username: user.username,
            full_name: user.full_name,
            email: user.email || "",
            role: user.role,
            avatar: user.avatar || "",
        };
        setFormData(userData);
        setOriginalFormData(userData);
        setAvatarPreview(user.avatar || null);
        setIsEditModalOpen(true);
    };

    // Handle avatar upload
    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                addToast({
                    title: t("fileTooLarge"),
                    description: t("chooseFileUpTo2Mb"),
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
                setFormData({ ...formData, avatar: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    // Remove avatar
    const handleRemoveAvatar = () => {
        setAvatarPreview(null);
        setFormData({ ...formData, avatar: "" });
    };

    // Open delete modal
    const openDeleteModal = (user: User) => {
        setSelectedUser(user);
        setIsDeleteModalOpen(true);
    };

    // Render cell content
    const renderCell = useCallback((user: User, columnKey: React.Key) => {
        switch (columnKey) {
            case "username":
                return (
                    <div className="flex items-center gap-3">
                        <Avatar
                            size="md"
                            src={user.avatar || undefined}
                            name={user.full_name}
                            className="bg-linear-to-br from-blue-400 to-indigo-500 text-white"
                        />
                        <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-xs text-default-400">ID: {user.ID}</p>
                        </div>
                    </div>
                );
            case "full_name":
                return <span className="font-medium">{user.full_name}</span>;
            case "email":
                return user.email ? (
                    <span className="text-default-600">{user.email}</span>
                ) : (
                    <span className="text-default-300">-</span>
                );
            case "role":
                return (
                    <Chip
                        color={roleColors[user.role]}
                        variant="flat"
                        size="sm"
                    >
                        {roleLabels[user.role]}
                    </Chip>
                );
            case "status":
                return (
                    <Chip
                        color={user.is_active ? "success" : "default"}
                        variant="dot"
                        size="sm"
                    >
                        {user.is_active ? t("active") : t("inactive")}
                    </Chip>
                );
            case "provider":
                return (
                    <div className="flex items-center gap-1">
                        <Icon
                            icon={user.provider === "google" ? "logos:google-icon" : "solar:key-bold"}
                            className="text-lg"
                        />
                        <span className="text-sm text-default-500">
                            {user.provider === "google" ? t("providerGoogle") : t("providerLocal")}
                        </span>
                    </div>
                );
            case "actions":
                return (
                    <div className="flex items-center gap-1 justify-center">
                        <Tooltip content={t("editAction")}>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openEditModal(user)}
                            >
                                <Icon icon="solar:pen-linear" className="text-lg text-default-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content={user.is_active ? t("disableAction") : t("enableAction")}>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openToggleStatusModal(user)}
                            >
                                <Icon
                                    icon={user.is_active ? "solar:eye-closed-linear" : "solar:eye-linear"}
                                    className="text-lg text-default-500"
                                />
                            </Button>
                        </Tooltip>
                        {/* <Tooltip content="ลบ" color="danger">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => openDeleteModal(user)}
                                isDisabled={user.id === authUser?.id}
                            >
                                <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                            </Button>
                        </Tooltip> */}
                    </div>
                );
            default:
                return getKeyValue(user, columnKey as keyof User);
        }
    }, [authUser, roleLabels, t]);

    // Handle sort
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSort(column, sortOrder === "ASC" ? "desc" : "asc");
        } else {
            setSort(column, "asc");
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-default-900">{t("manageUsers")}</h1>
                        <p className="text-sm text-default-500">{t("manageUsersInSystem")}</p>
                    </div>
                    {/* Live Indicator */}
                    <Tooltip content={isConnected ? t("realTimeSyncRunning") : t("connectingRealtime")}>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isConnected 
                                ? "bg-emerald-100 text-emerald-700" 
                                : "bg-yellow-100 text-yellow-700"
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${
                                isConnected ? "bg-emerald-500 animate-pulse" : "bg-yellow-500"
                            }`}></span>
                            {isConnected ? t("liveStatus") : "..."}
                        </div>
                    </Tooltip>
                </div>
                <Button
                    color="primary"
                    startContent={<Icon icon="solar:user-plus-bold" className="text-xl" />}
                    onPress={() => {
                        resetForm();
                        setIsCreateModalOpen(true);
                    }}
                    className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 w-full sm:w-auto"
                >
                    {t("addUser")}
                </Button>
            </div>

            {/* Stats Cards */}
            {stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl">
                                <Icon icon="solar:users-group-rounded-bold" className="text-xl sm:text-2xl text-blue-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">{t("allUsers")}</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-red-100 rounded-xl">
                                <Icon icon="solar:shield-user-bold" className="text-xl sm:text-2xl text-red-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">{t("roleAdmin")}</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byRole.admin}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-purple-100 rounded-xl">
                                <Icon icon="solar:user-check-bold" className="text-xl sm:text-2xl text-purple-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">{t("roleInstructor")}</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byRole.instructor}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                                <Icon icon="solar:user-hand-up-bold" className="text-xl sm:text-2xl text-green-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">{t("roleTa")}</p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.byRole.ta}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : isStatsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <MetricCardSkeleton iconClassName="bg-blue-100" />
                    <MetricCardSkeleton iconClassName="bg-red-100" />
                    <MetricCardSkeleton iconClassName="bg-purple-100" />
                    <MetricCardSkeleton iconClassName="bg-green-100" />
                </div>
            ) : null}

            {/* Table Card with Filters */}
            <div className="overflow-hidden rounded-xl border border-default-200 bg-content1 shadow-sm">
                <div className="p-3 sm:p-4">
                    <div className="flex flex-col md:flex-row gap-3 pb-3 sm:pb-4">
                        <Input
                            className="w-full md:flex-1"
                            placeholder={t("searchUsers")}
                            value={searchInput}
                            onValueChange={(value) => {
                                setSearchInput(value);
                                setSearch(value);
                            }}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-blue-400" />}
                            isClearable
                            onClear={() => {
                                setSearchInput("");
                                setSearch("");
                            }}
                            variant="bordered"
                            classNames={{
                                inputWrapper: "border-blue-200 hover:border-blue-300 focus-within:!border-blue-400",
                                label: "text-blue-400 text-sm",
                            }}
                        />
                        <div className="flex gap-2 flex-wrap md:flex-nowrap">
                            <Select
                                className="flex-1 min-w-37.5 sm:w-48"
                                placeholder={t("rolePlaceholder")}
                                selectedKeys={[roleFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("role", value);
                                }}
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                                variant="bordered"
                            >
                                {roleOptions.map((option) => (
                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                ))}
                            </Select>
                            <Select
                                className="flex-1 min-w-37.5 sm:w-48"
                                placeholder={t("statusPlaceholder")}
                                selectedKeys={[statusFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("status", value);
                                }}
                                classNames={{
                                    trigger: "bg-content2 border-default-200 hover:border-default-300",
                                }}
                                variant="bordered"
                            >
                                {statusOptions.map((option) => (
                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Table with horizontal scroll on mobile */}
                    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                        <div className="min-w-175">
                            <Table
                                aria-label={t("usersTable")}
                                removeWrapper
                                classNames={{
                                    th: "bg-content2 text-default-600 font-semibold text-xs sm:text-sm",
                                    td: "py-2 text-sm sm:py-3",
                                }}
                            >
                                <TableHeader columns={columns}>
                                    {(column) => (
                                        <TableColumn
                                            key={column.key}
                                            align={column.key === "actions" ? "center" : "start"}
                                            allowsSorting={column.sortable}
                                            onClick={() => column.sortable && handleSort(column.key)}
                                            className={column.sortable ? "cursor-pointer hover:bg-default-200" : ""}
                                        >
                                            {column.label}

                                        </TableColumn>
                                    )}
                                </TableHeader>
                                <TableBody
                                    items={users}
                                    isLoading={isLoading}
                                    emptyContent={
                                        <div className="py-10 text-center">
                                            <Icon icon="solar:users-group-rounded-linear" className="text-5xl text-default-300 mx-auto mb-3" />
                                            <p className="text-default-400">{t("noUsersFound")}</p>
                                        </div>
                                    }
                                    loadingContent={
                                        <TableRowsSkeleton
                                            rows={limit}
                                            columns={["w-24", "w-32", "w-40", "w-16", "w-16", "w-16", "w-14"]}
                                        />
                                    }
                                >
                                    {(item) => (
                                        <TableRow key={item.ID}>
                                            {(columnKey) => (
                                                <TableCell>{renderCell(item, columnKey)}</TableCell>
                                            )}
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex flex-col items-center justify-between gap-3 border-t border-divider px-3 py-3 sm:flex-row sm:px-4">
                        <span className="order-2 text-xs text-default-500 sm:order-1 sm:text-sm">
                            {t("showingRangeOfTotal", {
                                start: ((page - 1) * limit) + 1,
                                end: Math.min(page * limit, totalItems),
                                total: totalItems,
                            })}
                        </span>
                        <Pagination
                            total={totalPages}
                            page={page}
                            onChange={setPage}
                            showControls
                            size="sm"
                            color="primary"
                            className="order-1 sm:order-2"
                        />
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                size="2xl"
                scrollBehavior="inside"
                classNames={{
                    base: "mx-2 sm:mx-4",
                    body: "py-4",
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:user-plus-bold" className="text-xl sm:text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground sm:text-xl">{t("addNewUser")}</h3>
                                <p className="mt-1 text-xs font-normal text-default-500 sm:text-sm">{t("fillUserDetailsInSystem")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            {/* รูปโปรไฟล์ */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:camera-bold" className="text-lg text-purple-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("profilePicture")}</span>
                                </div>
                                <div className="flex items-center gap-6 py-3">
                                    <div className="relative">
                                        <Avatar
                                            size="lg"
                                            src={avatarPreview || undefined}
                                            name={formData.full_name || "I T"}
                                            className="w-24 h-24 text-2xl bg-linear-to-br from-blue-400 to-indigo-500 text-white"
                                        />
                                        {avatarPreview && (
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                color="danger"
                                                variant="solid"
                                                className="absolute -top-1 -right-1 min-w-6 w-6 h-6"
                                                onPress={handleRemoveAvatar}
                                            >
                                                <Icon icon="solar:close-circle-bold" className="text-sm" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAvatarUpload}
                                                className="hidden"
                                            />
                                            <div className="rounded-xl border-2 border-dashed border-default-300 p-4 text-center transition-colors hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-500/10">
                                                <Icon icon="solar:cloud-upload-bold-duotone" className="text-3xl text-purple-400 mx-auto mb-2" />
                                                <p className="text-sm font-medium text-default-600">{t("clickToUploadImage")}</p>
                                                <p className="mt-1 text-xs text-default-400">{t("imageMaxSizeHint")}</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* ข้อมูลส่วนตัว */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-emerald-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("personalInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 py-3">
                                    <Input
                                        label={t("fullName")}
                                        labelPlacement="outside"
                                        placeholder={t("enterFullName")}
                                        variant="bordered"
                                        size="md"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-id-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                    <Input
                                        label={t("email")}
                                        labelPlacement="outside"
                                        placeholder={t("enterOptionalEmail")}
                                        type="email"
                                        variant="bordered"
                                        size="md"
                                        value={formData.email}
                                        onValueChange={(value) => setFormData({ ...formData, email: value })}
                                        startContent={<Icon icon="solar:letter-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* ข้อมูลบัญชี */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:shield-user-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("accountInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-5 py-3">
                                    <Input
                                        label={t("username")}
                                        labelPlacement="outside"
                                        placeholder={t("enterUsername")}
                                        variant="bordered"
                                        size="md"
                                        value={formData.username}
                                        onValueChange={(value) => setFormData({ ...formData, username: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />                                
                                </div>
                                <Select
                                    label={t("role")}
                                    labelPlacement="outside"
                                    placeholder={t("selectRole")}
                                    variant="bordered"
                                    size="md"
                                    selectedKeys={[formData.role]}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0] as "admin" | "instructor" | "ta";
                                        setFormData({ ...formData, role: value });
                                    }}
                                    isRequired
                                    classNames={{
                                        trigger: "bg-content1 border-default-200 text-sm hover:border-blue-300 data-[focus=true]:border-blue-400",
                                        label: "text-default-600 font-medium text-sm",
                                    }}
                                >
                                    <SelectItem key="admin" startContent={<Icon icon="solar:shield-user-bold" className="text-red-500" />}>{t("roleAdmin")}</SelectItem>
                                    <SelectItem key="instructor" startContent={<Icon icon="solar:user-check-bold" className="text-purple-500" />}>{t("roleInstructor")}</SelectItem>
                                    <SelectItem key="ta" startContent={<Icon icon="solar:user-hand-up-bold" className="text-green-500" />}>{t("roleTa")}</SelectItem>
                                </Select>
                            </div>


                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsCreateModalOpen(false)}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleCreate}
                            isLoading={isSubmitting}
                            isDisabled={!formData.username.trim() || !formData.full_name.trim()}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500"
                        >
                            {t("addUser")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="2xl">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("editUser")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("editUserWithUsername", { username: selectedUser?.username || "" })}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-5">
                            {/* รูปโปรไฟล์ */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:camera-bold" className="text-lg text-purple-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("profilePicture")}</span>
                                </div>
                                <div className="flex items-center gap-6 py-3">
                                    <div className="relative">
                                        <Avatar
                                            size="lg"
                                            src={avatarPreview || undefined}
                                            name={formData.full_name || "User"}
                                            className="w-24 h-24 text-2xl bg-linear-to-br from-blue-400 to-indigo-500 text-white"
                                        />
                                        {avatarPreview && (
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                color="danger"
                                                variant="solid"
                                                className="absolute -top-1 -right-1 min-w-6 w-6 h-6"
                                                onPress={handleRemoveAvatar}
                                            >
                                                <Icon icon="solar:close-circle-bold" className="text-sm" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAvatarUpload}
                                                className="hidden"
                                            />
                                            <div className="rounded-xl border-2 border-dashed border-default-300 p-4 text-center transition-colors hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-500/10">
                                                <Icon icon="solar:cloud-upload-bold-duotone" className="text-3xl text-purple-400 mx-auto mb-2" />
                                                <p className="text-sm font-medium text-default-600">{t("clickToUploadImage")}</p>
                                                <p className="mt-1 text-xs text-default-400">{t("imageMaxSizeHint")}</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* ข้อมูลส่วนตัว */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-emerald-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("personalInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label={t("fullName")}
                                        labelPlacement="outside"
                                        placeholder={t("enterFullName")}
                                        variant="bordered"
                                        size="md"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-id-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                    <Input
                                        label={t("email")}
                                        labelPlacement="outside"
                                        placeholder={t("enterOptionalEmail")}
                                        type="email"
                                        variant="bordered"
                                        size="md"
                                        value={formData.email}
                                        onValueChange={(value) => setFormData({ ...formData, email: value })}
                                        startContent={<Icon icon="solar:letter-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* ข้อมูลบัญชี */}
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:shield-user-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("accountInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label={t("username")}
                                        labelPlacement="outside"
                                        placeholder={t("enterUsername")}
                                        variant="bordered"
                                        size="md"
                                        value={formData.username}
                                        onValueChange={(value) => setFormData({ ...formData, username: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-default-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                                <Select
                                    label={t("role")}
                                    labelPlacement="outside"
                                    placeholder={t("selectRole")}
                                    variant="bordered"
                                    size="md"
                                    selectedKeys={[formData.role]}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0] as "admin" | "instructor" | "ta";
                                        setFormData({ ...formData, role: value });
                                    }}
                                    isRequired
                                    isDisabled={selectedUser?.ID === authUser?.id}
                                    classNames={{
                                        trigger: "bg-content1 border-default-200 hover:border-blue-300 data-[focus=true]:border-blue-400",
                                        label: "text-default-600 font-medium text-sm",
                                    }}
                                >
                                    <SelectItem key="admin" startContent={<Icon icon="solar:shield-user-bold" className="text-red-500" />}>{t("roleAdmin")}</SelectItem>
                                    <SelectItem key="instructor" startContent={<Icon icon="solar:user-check-bold" className="text-purple-500" />}>{t("roleInstructor")}</SelectItem>
                                    <SelectItem key="ta" startContent={<Icon icon="solar:user-hand-up-bold" className="text-green-500" />}>{t("roleTa")}</SelectItem>
                                </Select>
                            </div>

                            
                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsEditModalOpen(false)}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleUpdate}
                            isLoading={isSubmitting}
                            isDisabled={!hasFormChanges()}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("saveChanges")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
            {/* Toggle Status Confirmation Modal */}
            <Modal isOpen={isToggleStatusModalOpen} onClose={() => setIsToggleStatusModalOpen(false)} size="md">
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl shadow-lg bg-linear-to-br from-blue-400 to-indigo-500 shadow-blue-500/30">
                                <Icon icon={userToToggle?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">
                                {userToToggle?.is_active ? t("confirmDisableTitle") : t("confirmEnableTitle")}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className={`rounded-2xl border p-6 ${userToToggle?.is_active ? "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10" : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${userToToggle?.is_active ? "bg-amber-100 dark:bg-amber-500/15" : "bg-emerald-100 dark:bg-emerald-500/15"}`}>
                                    <Icon icon="solar:user-bold" className={`text-2xl ${userToToggle?.is_active ? "text-amber-600" : "text-emerald-600"}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">{userToToggle?.full_name}</p>
                                    <p className="text-sm text-default-500">@{userToToggle?.username}</p>
                                    <p className="mt-1 text-xs text-default-400">{userToToggle ? roleLabels[userToToggle.role] : ""}</p>
                                </div>
                            </div>
                            <p className={`mt-4 text-sm ${userToToggle?.is_active ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                                {userToToggle?.is_active
                                    ? t("userCannotSignInAfterDisabled")
                                    : t("userCanSignInAfterEnabled")}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsToggleStatusModalOpen(false)}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleToggleStatus}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {userToToggle?.is_active ? t("disableAction") : t("enableAction")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} size="md">
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:trash-bin-trash-bold" className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">{t("deleteConfirmTitle")}</h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center dark:border-danger-500/20 dark:bg-danger-500/10">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-danger-500/15">
                                <Icon icon="solar:user-cross-bold" className="text-3xl text-red-500" />
                            </div>
                            <p className="text-lg text-default-700">
                                {t("doYouWantDeleteUser", { username: selectedUser?.username || "" }).split(selectedUser?.username || "")[0]}
                                <strong className="text-red-600">{selectedUser?.username}</strong>
                                {selectedUser?.username ? t("doYouWantDeleteUser", { username: selectedUser.username }).split(selectedUser.username)[1] : ""}
                            </p>
                            <p className="mt-3 rounded-lg border border-red-100 bg-content1 p-3 text-sm text-default-500 dark:border-danger-500/20">
                                <Icon icon="solar:danger-triangle-bold" className="text-amber-500 inline mr-1" />
                                {t("irreversibleAction")}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsDeleteModalOpen(false)}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleDelete}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {t("deleteUser")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Credentials Modal - Show after user creation */}
            <Modal 
                isOpen={isCredentialsModalOpen} 
                onClose={() => {
                    setIsCredentialsModalOpen(false);
                    setNewCredentials(null);
                }} 
                size="md"
                isDismissable={false}
                isKeyboardDismissDisabled={true}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:check-circle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("createUserSuccessTitle")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("saveCredentialsBelow")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-4">
                            {/* Warning */}
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                                <div className="flex items-start gap-3">
                                    <Icon icon="solar:danger-triangle-bold" className="text-amber-500 text-xl mt-0.5" />
                                    <div className="text-sm text-amber-700 dark:text-amber-300">
                                        <p className="font-semibold">{t("importantLabel")}</p>
                                        <p className="mt-1">{t("copyPasswordAndShare")}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Credentials */}
                            <div className="space-y-4 rounded-xl bg-content2/80 p-5">
                                {/* Username */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-default-600">{t("username")}</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 rounded-lg border border-default-200 bg-content1 p-3 font-mono text-foreground">
                                            {newCredentials?.username}
                                        </div>
                                        <Button
                                            isIconOnly
                                            variant="flat"
                                            color="primary"
                                            onPress={() => copyToClipboard(newCredentials?.username || "", t("username"))}
                                        >
                                            <Icon icon="solar:copy-bold" className="text-lg" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-default-600">{t("temporaryPassword")}</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 rounded-lg border border-default-200 bg-content1 p-3 font-mono text-foreground">
                                            {newCredentials?.password}
                                        </div>
                                        <Button
                                            isIconOnly
                                            variant="flat"
                                            color="primary"
                                            onPress={() => copyToClipboard(newCredentials?.password || "", t("password"))}
                                        >
                                            <Icon icon="solar:copy-bold" className="text-lg" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Copy All Button */}
                                <Button
                                    variant="flat"
                                    color="secondary"
                                    className="w-full mt-2"
                                    startContent={<Icon icon="solar:clipboard-list-bold" className="text-lg" />}
                                    onPress={() => copyToClipboard(
                                        `${t("username")}: ${newCredentials?.username}\n${t("password")}: ${newCredentials?.password}`,
                                        t("copyAll")
                                    )}
                                >
                                    {t("copyAll")}
                                </Button>
                            </div>

                            {/* Note */}
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-primary-500/20 dark:bg-primary/10">
                                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                                    <Icon icon="solar:info-circle-bold" className="text-blue-500" />
                                    <span>{t("userMustChangePasswordOnFirstLogin")}</span>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="border-t border-divider px-6 py-4">
                        <Button
                            color="primary"
                            onPress={() => {
                                setIsCredentialsModalOpen(false);
                                setNewCredentials(null);
                            }}
                            className="w-full font-medium bg-linear-to-r from-blue-400 to-indigo-500"
                        >
                            {t("done")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

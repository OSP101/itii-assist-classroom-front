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

// Column definitions
const columns = [
    { key: "username", label: "ชื่อผู้ใช้", sortable: true },
    { key: "full_name", label: "ชื่อ-นามสกุล", sortable: true },
    { key: "email", label: "อีเมล", sortable: true },
    { key: "role", label: "บทบาท", sortable: true },
    { key: "status", label: "สถานะ", sortable: true },
    { key: "provider", label: "ประเภท", sortable: false },
    { key: "actions", label: "จัดการ", sortable: false },
];

const roleOptions = [
    { key: "all", label: "ทุกบทบาท" },
    { key: "admin", label: "ผู้ดูแลระบบ" },
    { key: "instructor", label: "อาจารย์" },
    { key: "ta", label: "ผู้ช่วยสอน" },
];

const statusOptions = [
    { key: "all", label: "ทุกสถานะ" },
    { key: "active", label: "ใช้งาน" },
    { key: "inactive", label: "ปิดใช้งาน" },
];

const roleLabels: Record<string, string> = {
    admin: "ผู้ดูแลระบบ",
    instructor: "อาจารย์",
    ta: "ผู้ช่วยสอน",
};

const roleColors: Record<string, "primary" | "secondary" | "success" | "warning" | "danger"> = {
    admin: "danger",
    instructor: "primary",
    ta: "success",
};

export default function UsersPage() {
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
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
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
                console.log("📥 User data updated from another source:", data);
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
                title: "กรุณากรอกข้อมูลให้ครบ",
                description: "ชื่อผู้ใช้ และชื่อ-นามสกุล จำเป็นต้องกรอก",
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
                const errorMessage = (response as { error?: { message?: string } }).error?.message || "เกิดข้อผิดพลาด";
                addToast({
                    title: "ไม่สามารถสร้างผู้ใช้ได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถสร้างผู้ใช้ได้",
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
                    title: "อัปเดตผู้ใช้สำเร็จ",
                    description: `ผู้ใช้ ${formData.username} ถูกอัปเดตเรียบร้อยแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsEditModalOpen(false);
                resetForm();
                fetchUsers();
                emitDataUpdate("user", "update", selectedUser.ID);
            } else {
                const errorMessage = (response as { error?: { message?: string } }).error?.message || "เกิดข้อผิดพลาด";
                addToast({
                    title: "ไม่สามารถอัปเดตผู้ใช้ได้",
                    description: errorMessage,
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถอัปเดตผู้ใช้ได้",
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
                    title: "ลบผู้ใช้สำเร็จ",
                    description: `ผู้ใช้ ${selectedUser.username} ถูกลบเรียบร้อยแล้ว`,
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
                    title: "ไม่สามารถลบผู้ใช้ได้",
                    description: response.message || "เกิดข้อผิดพลาด",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถลบผู้ใช้ได้",
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
                    title: user.is_active ? "ปิดใช้งานสำเร็จ" : "เปิดใช้งานสำเร็จ",
                    description: `ผู้ใช้ ${user.username} ถูก${user.is_active ? "ปิด" : "เปิด"}ใช้งานแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                fetchUsers();
                fetchStats();
                emitDataUpdate("user", "toggle", user.ID);
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: response.message || "ไม่สามารถเปลี่ยนสถานะได้",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเปลี่ยนสถานะได้",
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
        setAvatarPreview(null);
        setSelectedUser(null);
    };

    // Copy to clipboard
    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            addToast({
                title: "คัดลอกแล้ว",
                description: `${label} ถูกคัดลอกไปยังคลิปบอร์ดแล้ว`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error) {
            addToast({
                title: "ไม่สามารถคัดลอกได้",
                description: "กรุณาคัดลอกด้วยตนเอง",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    // Open edit modal
    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setFormData({
            username: user.username,
            full_name: user.full_name,
            email: user.email || "",
            role: user.role,
            avatar: user.avatar || "",
        });
        setAvatarPreview(user.avatar || null);
        setIsEditModalOpen(true);
    };

    // Handle avatar upload
    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                addToast({
                    title: "ไฟล์ใหญ่เกินไป",
                    description: "กรุณาเลือกไฟล์ขนาดไม่เกิน 2MB",
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
                            className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
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
                        {user.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
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
                            {user.provider === "google" ? "Google" : "Local"}
                        </span>
                    </div>
                );
            case "actions":
                return (
                    <div className="flex items-center gap-1 justify-center">
                        <Tooltip content="แก้ไข">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openEditModal(user)}
                            >
                                <Icon icon="solar:pen-linear" className="text-lg text-default-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content={user.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
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
    }, [authUser]);

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
                        <h1 className="text-xl sm:text-2xl font-bold text-default-900">จัดการผู้ใช้งาน</h1>
                        <p className="text-sm text-default-500">จัดการผู้ใช้งานในระบบ</p>
                    </div>
                    {/* Live Indicator */}
                    <Tooltip content={isConnected ? "ซิงค์แบบเรียลไทม์กำลังทำงาน" : "กำลังเชื่อมต่อ..."}>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isConnected 
                                ? "bg-emerald-100 text-emerald-700" 
                                : "bg-yellow-100 text-yellow-700"
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${
                                isConnected ? "bg-emerald-500 animate-pulse" : "bg-yellow-500"
                            }`}></span>
                            {isConnected ? "Live" : "..."}
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
                    className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500 w-full sm:w-auto"
                >
                    เพิ่มผู้ใช้
                </Button>
            </div>

            {/* Stats Cards */}
            {stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl">
                                <Icon icon="solar:users-group-rounded-bold" className="text-xl sm:text-2xl text-blue-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">ผู้ใช้ทั้งหมด</p>
                                <p className="text-xl sm:text-2xl font-bold text-default-900">{stats.total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-red-100 rounded-xl">
                                <Icon icon="solar:shield-user-bold" className="text-xl sm:text-2xl text-red-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">ผู้ดูแลระบบ</p>
                                <p className="text-xl sm:text-2xl font-bold text-default-900">{stats.byRole.admin}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-purple-100 rounded-xl">
                                <Icon icon="solar:user-check-bold" className="text-xl sm:text-2xl text-purple-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">อาจารย์</p>
                                <p className="text-xl sm:text-2xl font-bold text-default-900">{stats.byRole.instructor}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                                <Icon icon="solar:user-hand-up-bold" className="text-xl sm:text-2xl text-green-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-default-500">ผู้ช่วยสอน</p>
                                <p className="text-xl sm:text-2xl font-bold text-default-900">{stats.byRole.ta}</p>
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
            <div className="bg-white rounded-xl border border-default-200 shadow-sm overflow-hidden">
                <div className="p-3 sm:p-4">
                    <div className="flex flex-col md:flex-row gap-3 pb-3 sm:pb-4">
                        <Input
                            className="w-full md:flex-1"
                            placeholder="ค้นหาผู้ใช้..."
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
                                className="flex-1 min-w-[150px] sm:w-48"
                                placeholder="บทบาท"
                                selectedKeys={[roleFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("role", value);
                                }}
                                classNames={{
                                    trigger: "bg-slate-50 border-slate-200 hover:border-slate-300",
                                }}
                                variant="bordered"
                            >
                                {roleOptions.map((option) => (
                                    <SelectItem key={option.key}>{option.label}</SelectItem>
                                ))}
                            </Select>
                            <Select
                                className="flex-1 min-w-[150px] sm:w-48"
                                placeholder="สถานะ"
                                selectedKeys={[statusFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("status", value);
                                }}
                                classNames={{
                                    trigger: "bg-slate-50 border-slate-200 hover:border-slate-300",
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
                        <div className="min-w-[700px]">
                            <Table
                                aria-label="Users table"
                                removeWrapper
                                classNames={{
                                    th: "bg-slate-50 text-slate-600 font-semibold text-xs sm:text-sm",
                                    td: "py-2 sm:py-3 text-sm",
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
                                            <p className="text-default-400">ไม่พบข้อมูลผู้ใช้</p>
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
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-slate-100">
                        <span className="text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
                            แสดง {((page - 1) * limit) + 1} - {Math.min(page * limit, totalItems)} จาก {totalItems} รายการ
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
                            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:user-plus-bold" className="text-xl sm:text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">เพิ่มผู้ใช้ใหม่</h3>
                                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">กรอกข้อมูลผู้ใช้ที่ต้องการเพิ่มในระบบ</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            {/* รูปโปรไฟล์ */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:camera-bold" className="text-lg text-purple-500" />
                                    <span className="text-sm font-semibold text-slate-700">รูปโปรไฟล์</span>
                                </div>
                                <div className="flex items-center gap-6 py-3">
                                    <div className="relative">
                                        <Avatar
                                            size="lg"
                                            src={avatarPreview || undefined}
                                            name={formData.full_name || "I T"}
                                            className="w-24 h-24 text-2xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
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
                                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                                                <Icon icon="solar:cloud-upload-bold-duotone" className="text-3xl text-purple-400 mx-auto mb-2" />
                                                <p className="text-slate-600 text-sm font-medium">คลิกเพื่ออัปโหลดรูป</p>
                                                <p className="text-slate-400 text-xs mt-1">JPG, PNG ไม่เกิน 2MB</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* ข้อมูลส่วนตัว */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-emerald-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลส่วนตัว</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 py-3">
                                    <Input
                                        label="ชื่อ-นามสกุล"
                                        labelPlacement="outside"
                                        placeholder="กรอกชื่อ-นามสกุล"
                                        variant="bordered"
                                        size="md"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-id-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    <Input
                                        label="อีเมล"
                                        labelPlacement="outside"
                                        placeholder="กรอกอีเมล (ไม่บังคับ)"
                                        type="email"
                                        variant="bordered"
                                        size="md"
                                        value={formData.email}
                                        onValueChange={(value) => setFormData({ ...formData, email: value })}
                                        startContent={<Icon icon="solar:letter-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* ข้อมูลบัญชี */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:shield-user-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลบัญชี</span>
                                </div>
                                <div className="grid grid-cols-1 gap-5 py-3">
                                    <Input
                                        label="ชื่อผู้ใช้"
                                        labelPlacement="outside"
                                        placeholder="กรอกชื่อผู้ใช้"
                                        variant="bordered"
                                        size="md"
                                        value={formData.username}
                                        onValueChange={(value) => setFormData({ ...formData, username: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />                                
                                </div>
                                <Select
                                    label="บทบาท"
                                    labelPlacement="outside"
                                    placeholder="เลือกบทบาท"
                                    variant="bordered"
                                    size="md"
                                    selectedKeys={[formData.role]}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0] as "admin" | "instructor" | "ta";
                                        setFormData({ ...formData, role: value });
                                    }}
                                    isRequired
                                    classNames={{
                                        trigger: "text-sm bg-white border-slate-200 hover:border-blue-300 data-[focus=true]:border-blue-400",
                                        label: "text-slate-600 font-medium text-sm",
                                    }}
                                >
                                    <SelectItem key="admin" startContent={<Icon icon="solar:shield-user-bold" className="text-red-500" />}>ผู้ดูแลระบบ</SelectItem>
                                    <SelectItem key="instructor" startContent={<Icon icon="solar:user-check-bold" className="text-purple-500" />}>อาจารย์</SelectItem>
                                    <SelectItem key="ta" startContent={<Icon icon="solar:user-hand-up-bold" className="text-green-500" />}>ผู้ช่วยสอน</SelectItem>
                                </Select>
                            </div>


                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100 gap-3">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsCreateModalOpen(false)}
                            className="font-medium px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleCreate}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500"
                            startContent={!isSubmitting && <Icon icon="solar:add-circle-bold" className="text-lg" />}
                        >
                            เพิ่มผู้ใช้
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="2xl">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">แก้ไขผู้ใช้</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">แก้ไขข้อมูลผู้ใช้ {selectedUser?.username}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-5">
                            {/* รูปโปรไฟล์ */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:camera-bold" className="text-lg text-purple-500" />
                                    <span className="text-sm font-semibold text-slate-700">รูปโปรไฟล์</span>
                                </div>
                                <div className="flex items-center gap-6 py-3">
                                    <div className="relative">
                                        <Avatar
                                            size="lg"
                                            src={avatarPreview || undefined}
                                            name={formData.full_name || "User"}
                                            className="w-24 h-24 text-2xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
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
                                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                                                <Icon icon="solar:cloud-upload-bold-duotone" className="text-3xl text-purple-400 mx-auto mb-2" />
                                                <p className="text-slate-600 text-sm font-medium">คลิกเพื่ออัปโหลดรูป</p>
                                                <p className="text-slate-400 text-xs mt-1">JPG, PNG ไม่เกิน 2MB</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* ข้อมูลส่วนตัว */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-emerald-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลส่วนตัว</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label="ชื่อ-นามสกุล"
                                        labelPlacement="outside"
                                        placeholder="กรอกชื่อ-นามสกุล"
                                        variant="bordered"
                                        size="md"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-id-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    <Input
                                        label="อีเมล"
                                        labelPlacement="outside"
                                        placeholder="กรอกอีเมล (ไม่บังคับ)"
                                        type="email"
                                        variant="bordered"
                                        size="md"
                                        value={formData.email}
                                        onValueChange={(value) => setFormData({ ...formData, email: value })}
                                        startContent={<Icon icon="solar:letter-linear" className="text-emerald-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-emerald-300 focus-within:!border-emerald-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* ข้อมูลบัญชี */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:shield-user-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลบัญชี</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label="ชื่อผู้ใช้"
                                        labelPlacement="outside"
                                        placeholder="กรอกชื่อผู้ใช้"
                                        variant="bordered"
                                        size="md"
                                        value={formData.username}
                                        onValueChange={(value) => setFormData({ ...formData, username: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                                <Select
                                    label="บทบาท"
                                    labelPlacement="outside"
                                    placeholder="เลือกบทบาท"
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
                                        trigger: "bg-white border-slate-200 hover:border-blue-300 data-[focus=true]:border-blue-400",
                                        label: "text-slate-600 font-medium text-sm",
                                    }}
                                >
                                    <SelectItem key="admin" startContent={<Icon icon="solar:shield-user-bold" className="text-red-500" />}>ผู้ดูแลระบบ</SelectItem>
                                    <SelectItem key="instructor" startContent={<Icon icon="solar:user-check-bold" className="text-purple-500" />}>อาจารย์</SelectItem>
                                    <SelectItem key="ta" startContent={<Icon icon="solar:user-hand-up-bold" className="text-green-500" />}>ผู้ช่วยสอน</SelectItem>
                                </Select>
                            </div>

                            
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100 gap-3">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsEditModalOpen(false)}
                            className="font-medium px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleUpdate}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                            startContent={!isSubmitting && <Icon icon="solar:diskette-bold" className="text-lg" />}
                        >
                            บันทึกการแก้ไข
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
                            <div className="p-3 rounded-xl shadow-lg bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/30">
                                <Icon icon={userToToggle?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {userToToggle?.is_active ? "ยืนยันการปิดใช้งาน" : "ยืนยันการเปิดใช้งาน"}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className={`rounded-2xl p-6 border ${userToToggle?.is_active ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${userToToggle?.is_active ? "bg-amber-100" : "bg-emerald-100"}`}>
                                    <Icon icon="solar:user-bold" className={`text-2xl ${userToToggle?.is_active ? "text-amber-600" : "text-emerald-600"}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{userToToggle?.full_name}</p>
                                    <p className="text-sm text-slate-500">@{userToToggle?.username}</p>
                                    <p className="text-xs text-slate-400 mt-1">{userToToggle ? roleLabels[userToToggle.role] : ""}</p>
                                </div>
                            </div>
                            <p className={`mt-4 text-sm ${userToToggle?.is_active ? "text-amber-700" : "text-emerald-700"}`}>
                                {userToToggle?.is_active
                                    ? "ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้หลังจากปิดใช้งาน"
                                    : "ผู้ใช้จะสามารถเข้าสู่ระบบได้หลังจากเปิดใช้งาน"}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100 gap-3">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsToggleStatusModalOpen(false)}
                            className="font-medium px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleToggleStatus}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                            startContent={<Icon icon={userToToggle?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-lg" />}
                        >
                            {userToToggle?.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} size="md">
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:trash-bin-trash-bold" className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">ยืนยันการลบ</h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-100">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon icon="solar:user-cross-bold" className="text-3xl text-red-500" />
                            </div>
                            <p className="text-slate-700 text-lg">
                                คุณต้องการลบผู้ใช้ <strong className="text-red-600">{selectedUser?.username}</strong> หรือไม่?
                            </p>
                            <p className="text-sm text-slate-500 mt-3 bg-white rounded-lg p-3 border border-red-100">
                                <Icon icon="solar:danger-triangle-bold" className="text-amber-500 inline mr-1" />
                                การดำเนินการนี้ไม่สามารถย้อนกลับได้
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100 gap-3">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => setIsDeleteModalOpen(false)}
                            className="font-medium px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleDelete}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                            startContent={!isSubmitting && <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />}
                        >
                            ลบผู้ใช้
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
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:check-circle-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">สร้างผู้ใช้สำเร็จ!</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">กรุณาบันทึกข้อมูลด้านล่างนี้</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-4">
                            {/* Warning */}
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <Icon icon="solar:danger-triangle-bold" className="text-amber-500 text-xl mt-0.5" />
                                    <div className="text-sm text-amber-700">
                                        <p className="font-semibold">สำคัญ!</p>
                                        <p className="mt-1">กรุณาคัดลอกรหัสผ่านนี้และส่งให้ผู้ใช้ เนื่องจากรหัสผ่านจะไม่สามารถดูได้อีกครั้ง</p>
                                    </div>
                                </div>
                            </div>

                            {/* Credentials */}
                            <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                                {/* Username */}
                                <div>
                                    <label className="text-sm font-medium text-slate-600 mb-2 block">ชื่อผู้ใช้</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 p-3 bg-white border border-slate-200 rounded-lg font-mono text-slate-800">
                                            {newCredentials?.username}
                                        </div>
                                        <Button
                                            isIconOnly
                                            variant="flat"
                                            color="primary"
                                            onPress={() => copyToClipboard(newCredentials?.username || "", "ชื่อผู้ใช้")}
                                        >
                                            <Icon icon="solar:copy-bold" className="text-lg" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="text-sm font-medium text-slate-600 mb-2 block">รหัสผ่าน (ชั่วคราว)</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 p-3 bg-white border border-slate-200 rounded-lg font-mono text-slate-800">
                                            {newCredentials?.password}
                                        </div>
                                        <Button
                                            isIconOnly
                                            variant="flat"
                                            color="primary"
                                            onPress={() => copyToClipboard(newCredentials?.password || "", "รหัสผ่าน")}
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
                                        `ชื่อผู้ใช้: ${newCredentials?.username}\nรหัสผ่าน: ${newCredentials?.password}`,
                                        "ข้อมูลทั้งหมด"
                                    )}
                                >
                                    คัดลอกทั้งหมด
                                </Button>
                            </div>

                            {/* Note */}
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 text-sm text-blue-700">
                                    <Icon icon="solar:info-circle-bold" className="text-blue-500" />
                                    <span>ผู้ใช้จะต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก</span>
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100">
                        <Button
                            color="primary"
                            onPress={() => {
                                setIsCredentialsModalOpen(false);
                                setNewCredentials(null);
                            }}
                            className="w-full font-medium bg-gradient-to-r from-blue-400 to-indigo-500"
                        >
                            เสร็จสิ้น
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

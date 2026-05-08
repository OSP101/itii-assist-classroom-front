"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
} from "@heroui/table";
import { useSocket } from "@/contexts/SocketContext";
import { Pagination } from "@heroui/pagination";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
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
import { studentService } from "@/services/student.service";
import type { Student, CreateStudentDto, UpdateStudentDto, StudentStats } from "@/services/student.service";
import { useTableParams } from "@/lib/table/use-table-params";

// Column definitions
const columns = [
    { key: "student_id", label: "รหัสนักศึกษา", sortable: true },
    { key: "full_name", label: "ชื่อ-นามสกุล", sortable: true },
    { key: "email", label: "อีเมล", sortable: true },
    { key: "status", label: "สถานะ", sortable: true },
    { key: "created_at", label: "วันที่สร้าง", sortable: true },
    { key: "actions", label: "จัดการ", sortable: false },
];

const statusOptions = [
    { key: "all", label: "ทุกสถานะ" },
    { key: "active", label: "ใช้งาน" },
    { key: "inactive", label: "ปิดใช้งาน" },
];

export default function StudentsPage() {
    const { emitDataUpdate, onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, isConnected } = useSocket();
    const isUpdatingRef = useRef(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [stats, setStats] = useState<StudentStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
        defaultLimit: 10,
        defaultSort: "created_at",
        defaultOrder: "desc",
        searchDebounceMs: 300,
    });
    const [searchInput, setSearchInput] = useState(String(params.search ?? ""));

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const search = String(params.search ?? "");
    const statusFilter = String(params.status ?? "all");
    const sortBy = String(params.sort ?? "created_at");
    const sortOrder: "ASC" | "DESC" = params.order === "asc" ? "ASC" : "DESC";

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [studentToToggle, setStudentToToggle] = useState<Student | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form data
    const [formData, setFormData] = useState<CreateStudentDto>({
        student_id: "",
        full_name: "",
        email: "",
    });

    // Import data
    const [importText, setImportText] = useState("");

    // Fetch students
    const fetchStudents = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await studentService.getStudents({
                page,
                limit,
                search: search || undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
                sortBy,
                sortOrder,
            });

            if (response.success && response.data) {
                setStudents(response.data.students);
                setTotalPages(response.data.pagination.totalPages);
                setTotalItems(response.data.pagination.totalItems);
            }
        } catch (error) {
            console.error("Error fetching students:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูลนักศึกษาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, search, statusFilter, sortBy, sortOrder]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await studentService.getStats();
            if (response.success && response.data) {
                setStats(response.data);
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, []);

    useEffect(() => {
        fetchStudents();
        fetchStats();
    }, [fetchStudents, fetchStats]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    // Real-time sync - Subscribe to student updates
    useEffect(() => {
        subscribeToUpdates();
        return () => unsubscribeFromUpdates();
    }, [subscribeToUpdates, unsubscribeFromUpdates]);

    // Handle real-time updates from other tabs/users
    useEffect(() => {
        const unsubscribe = onDataUpdate((data) => {
            if (data.resource === "student" && !isUpdatingRef.current) {
                console.log("📥 Student data updated from another source:", data);
                fetchStudents();
                fetchStats();
            }
        });
        return unsubscribe;
    }, [onDataUpdate, fetchStudents, fetchStats]);

    // Reset form
    const resetForm = () => {
        setFormData({
            student_id: "",
            full_name: "",
            email: "",
        });
    };

    // Handle create student
    const handleCreate = async () => {
        if (!formData.student_id || !formData.full_name || !formData.email) {
            addToast({
                title: "กรุณากรอกข้อมูลให้ครบ",
                description: "รหัสนักศึกษา ชื่อ-นามสกุล และอีเมล จำเป็นต้องกรอก",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const response = await studentService.createStudent(formData);
            if (response.success) {
                addToast({
                    title: "เพิ่มนักศึกษาสำเร็จ",
                    description: `นักศึกษา ${formData.full_name} ถูกเพิ่มเรียบร้อยแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsCreateModalOpen(false);
                resetForm();
                fetchStudents();
                fetchStats();
                emitDataUpdate("student", "create");
            } else {
                addToast({
                    title: "ไม่สามารถเพิ่มนักศึกษาได้",
                    description: response.message || "เกิดข้อผิดพลาด",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถเพิ่มนักศึกษาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
            isUpdatingRef.current = false;
        }
    };

    // Handle update student
    const handleUpdate = async () => {
        if (!selectedStudent) return;

        if (!formData.student_id || !formData.full_name) {
            addToast({
                title: "กรุณากรอกข้อมูลให้ครบ",
                description: "รหัสนักศึกษาและชื่อ-นามสกุล จำเป็นต้องกรอก",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const updateData: UpdateStudentDto = {
                student_id: formData.student_id,
                full_name: formData.full_name,
                email: formData.email || undefined,
            };

            const response = await studentService.updateStudent(selectedStudent.id, updateData);
            if (response.success) {
                addToast({
                    title: "อัปเดตข้อมูลสำเร็จ",
                    description: `ข้อมูลนักศึกษา ${formData.full_name} ถูกอัปเดตแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsEditModalOpen(false);
                setSelectedStudent(null);
                resetForm();
                fetchStudents();
                emitDataUpdate("student", "update", selectedStudent.id);
            } else {
                addToast({
                    title: "ไม่สามารถอัปเดตข้อมูลได้",
                    description: response.message || "เกิดข้อผิดพลาด",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถอัปเดตข้อมูลได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
            isUpdatingRef.current = false;
        }
    };

    // Handle delete student
    const handleDelete = async () => {
        if (!selectedStudent) return;

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const response = await studentService.deleteStudent(selectedStudent.id);
            if (response.success) {
                addToast({
                    title: "ลบนักศึกษาสำเร็จ",
                    description: `นักศึกษา ${selectedStudent.full_name} ถูกลบแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsDeleteModalOpen(false);
                setSelectedStudent(null);
                fetchStudents();
                fetchStats();
                emitDataUpdate("student", "delete", selectedStudent.id);
            } else {
                addToast({
                    title: "ไม่สามารถลบนักศึกษาได้",
                    description: response.message || "เกิดข้อผิดพลาด",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถลบนักศึกษาได้",
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
    const openToggleStatusModal = (student: Student) => {
        setStudentToToggle(student);
        setIsToggleStatusModalOpen(true);
    };

    // Handle toggle status (called from confirmation modal)
    const confirmToggleStatus = async () => {
        if (!studentToToggle) return;
        const student = studentToToggle;
        isUpdatingRef.current = true;
        setIsToggleStatusModalOpen(false);
        try {
            const response = await studentService.toggleStatus(student.id);
            if (response.success) {
                addToast({
                    title: student.is_active ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว",
                    description: `สถานะของ ${student.full_name} ถูกเปลี่ยนแล้ว`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                fetchStudents();
                fetchStats();
                emitDataUpdate("student", "toggle", student.id);
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

    // Handle import
    const handleImport = async () => {
        if (!importText.trim()) {
            addToast({
                title: "กรุณากรอกข้อมูล",
                description: "ใส่ข้อมูลนักศึกษาที่ต้องการนำเข้า",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        // Parse CSV/TSV format: student_id, full_name, email
        const lines = importText.trim().split('\n');
        const studentsToImport: CreateStudentDto[] = [];

        for (const line of lines) {
            const parts = line.split(/[,\t]/).map(p => p.trim());
            if (parts.length >= 2 && parts[0] && parts[1]) {
                studentsToImport.push({
                    student_id: parts[0],
                    full_name: parts[1],
                    email: parts[2] || "",
                });
            }
        }

        if (studentsToImport.length === 0) {
            addToast({
                title: "ไม่พบข้อมูลที่ถูกต้อง",
                description: "กรุณาตรวจสอบรูปแบบข้อมูล (ต้องมีรหัสและชื่อ)",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const response = await studentService.importStudents(studentsToImport);
            if (response.success && response.data) {
                const { created, skipped, failed } = response.data;
                
                // Build detailed message
                let description = "";
                if (created > 0) description += `✅ เพิ่มใหม่ ${created} คน`;
                if (skipped > 0) description += `${description ? ", " : ""}ซ้ำ ${skipped} คน`;
                if (failed > 0) description += `${description ? ", " : ""}ล้มเหลว ${failed} รายการ`;
                
                // Determine toast color based on results
                let toastColor: "success" | "warning" | "danger" = "success";
                if (created === 0 && skipped > 0) {
                    toastColor = "warning";
                } else if (failed > 0 && created === 0) {
                    toastColor = "danger";
                } else if (skipped > 0 || failed > 0) {
                    toastColor = "warning";
                }

                addToast({
                    title: "นำเข้าข้อมูลเสร็จสิ้น",
                    description: description || "ไม่มีการเปลี่ยนแปลง",
                    color: toastColor,
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });

                setIsImportModalOpen(false);
                setImportText("");
                fetchStudents();
                fetchStats();
                emitDataUpdate("student", "bulk");
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถนำเข้าข้อมูลได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
            isUpdatingRef.current = false;
        }
    };

    // Open edit modal
    const openEditModal = (student: Student) => {
        setSelectedStudent(student);
        setFormData({
            student_id: student.student_id,
            full_name: student.full_name,
            email: student.email || "",
        });
        setIsEditModalOpen(true);
    };

    // Open delete modal
    const openDeleteModal = (student: Student) => {
        setSelectedStudent(student);
        setIsDeleteModalOpen(true);
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    // Handle sort
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSort(column, sortOrder === "ASC" ? "desc" : "asc");
        } else {
            setSort(column, "asc");
        }
    };

    // Render cell content
    const renderCell = (student: Student, columnKey: string) => {
        switch (columnKey) {
            case "student_id":
                return (
                    <div className="flex items-center gap-3">
                        <Avatar
                            name={student.full_name}
                            size="sm"
                            className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white"
                        />
                        <div>
                            <p className="font-semibold text-slate-800">{student.student_id}</p>
                        </div>
                    </div>
                );
            case "full_name":
                return <span className="text-slate-700">{student.full_name}</span>;
            case "email":
                return student.email ? (
                    <span className="text-slate-600">{student.email}</span>
                ) : (
                    <span className="text-slate-400 italic">ไม่ระบุ</span>
                );
            case "status":
                return (
                    <Chip
                        size="sm"
                        variant="flat"
                        color={student.is_active ? "success" : "danger"}
                        startContent={
                            <Icon
                                icon={student.is_active ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                                className="text-sm"
                            />
                        }
                    >
                        {student.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </Chip>
                );
            case "created_at":
                return <span className="text-slate-500 text-sm">{formatDate(student.created_at)}</span>;
            case "actions":
                return (
                    <div className="flex items-center gap-1 justify-center">
                        <Tooltip content="แก้ไข">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openEditModal(student)}
                            >
                                <Icon icon="solar:pen-linear" className="text-lg text-default-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content={student.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openToggleStatusModal(student)}
                            >
                                <Icon
                                    icon={student.is_active ? "solar:eye-closed-linear" : "solar:eye-linear"}
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
                                onPress={() => openDeleteModal(student)}
                            >
                                <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                            </Button>
                        </Tooltip> */}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-default-900">
                            จัดการนักศึกษา
                        </h1>
                        <p className="text-sm text-default-500 mt-1">จัดการข้อมูลนักศึกษาทั้งหมดในระบบ</p>
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
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        color="secondary"
                        variant="flat"
                        startContent={<Icon icon="solar:import-bold" className="text-xl" />}
                        onPress={() => setIsImportModalOpen(true)}
                        className="font-medium flex-1 sm:flex-none sm:px-6 bg-emerald-300 text-emerald-900"
                    >
                        <span className="hidden sm:inline">นำเข้าข้อมูล</span>
                        <span className="sm:hidden">นำเข้า</span>
                    </Button>
                    <Button
                        color="primary"
                        startContent={<Icon icon="solar:add-circle-bold" className="text-xl" />}
                        onPress={() => setIsCreateModalOpen(true)}
                        className="font-medium flex-1 sm:flex-none sm:px-6 bg-gradient-to-r from-blue-400 to-indigo-500"
                    >
                        <span className="hidden sm:inline">เพิ่มนักศึกษา</span>
                        <span className="sm:hidden">เพิ่ม</span>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                        <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl">
                            <Icon icon="solar:square-academic-cap-bold" className="text-xl sm:text-2xl text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">ทั้งหมด</p>
                            <p className="text-xl sm:text-2xl font-bold text-default-900">{stats?.total || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                        <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                            <Icon icon="solar:check-circle-bold" className="text-xl sm:text-2xl text-green-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">ใช้งาน</p>
                            <p className="text-xl sm:text-2xl font-bold text-default-900">{stats?.byStatus?.active || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                        <div className="p-2 sm:p-2.5 bg-red-100 rounded-xl">
                            <Icon icon="solar:close-circle-bold" className="text-xl sm:text-2xl text-red-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">ปิดใช้งาน</p>
                            <p className="text-xl sm:text-2xl font-bold text-default-900">{stats?.byStatus?.inactive || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-default-200 shadow-sm overflow-hidden">
                <div className="p-3 sm:p-4">
                    <div className="flex flex-col md:flex-row gap-3 pb-3 sm:pb-4">
                        <Input
                            placeholder="ค้นหารหัสนักศึกษา, ชื่อ, อีเมล..."
                            value={searchInput}
                            onValueChange={(value) => {
                                setSearchInput(value);
                                setSearch(value);
                            }}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-slate-400" />}
                            className="w-full md:flex-1"
                            isClearable
                            onClear={() => {
                                setSearchInput("");
                                setSearch("");
                            }}
                            classNames={{
                                inputWrapper: "bg-slate-50 border-slate-200 hover:border-slate-300",
                            }}
                        />
                        <Select
                            placeholder="สถานะ"
                            selectedKeys={[statusFilter]}
                            onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0] as string;
                                setFilter("status", value);
                            }}
                            className="w-full md:w-44"
                            classNames={{
                                trigger: "bg-slate-50 border-slate-200 hover:border-slate-300",
                            }}
                        >
                            {statusOptions.map((option) => (
                                <SelectItem key={option.key}>{option.label}</SelectItem>
                            ))}
                        </Select>
                    </div>

                    {/* Table with horizontal scroll */}
                    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                        <div className="min-w-[600px]">
                            <Table
                    aria-label="Students table"
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
                        items={students}
                        isLoading={isLoading}
                        loadingContent={<Spinner color="primary" label="กำลังโหลด..." />}
                        emptyContent={
                            <div className="py-10 text-center">
                                <Icon icon="solar:user-cross-rounded-linear" className="text-5xl text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500">ไม่พบข้อมูลนักศึกษา</p>
                            </div>
                        }
                    >
                        {(item) => (
                            <TableRow key={item.id}>
                                {(columnKey) => (
                                    <TableCell>{renderCell(item, columnKey as string)}</TableCell>
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
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-3 sm:px-4 py-3 border-t border-slate-100">
                        <p className="text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
                            แสดง {((page - 1) * limit) + 1} - {Math.min(page * limit, totalItems)} จาก {totalItems} รายการ
                        </p>
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
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">เพิ่มนักศึกษาใหม่</h3>
                                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">กรอกข้อมูลนักศึกษาที่ต้องการเพิ่มในระบบ</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลนักศึกษา</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label="รหัสนักศึกษา"
                                        labelPlacement="outside"
                                        placeholder="เช่น 65010001"
                                        variant="bordered"
                                        size="lg"
                                        value={formData.student_id}
                                        onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:hashtag-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    <Input
                                        label="ชื่อ-นามสกุล"
                                        labelPlacement="outside"
                                        placeholder="กรอกชื่อ-นามสกุล"
                                        variant="bordered"
                                        size="lg"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                                <Input
                                    label="อีเมล"
                                    labelPlacement="outside"
                                    placeholder="กรอกอีเมลของนักศึกษา"
                                    type="email"
                                    variant="bordered"
                                    size="lg"
                                    value={formData.email}
                                    onValueChange={(value) => setFormData({ ...formData, email: value })}
                                    isRequired
                                    startContent={<Icon icon="solar:letter-linear" className="text-blue-400 text-xl" />}
                                    classNames={{
                                        inputWrapper: "h-12 bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                        label: "text-slate-600 font-medium text-sm",
                                    }}
                                />
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
                            เพิ่มนักศึกษา
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
                                <h3 className="text-xl font-bold text-slate-800">แก้ไขข้อมูลนักศึกษา</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">แก้ไขข้อมูลของ {selectedStudent?.full_name}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-5">
                            <div className="bg-slate-50 rounded-xl p-5 space-y-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลนักศึกษา</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label="รหัสนักศึกษา"
                                        labelPlacement="outside"
                                        placeholder="เช่น 65010001"
                                        variant="bordered"
                                        size="lg"
                                        value={formData.student_id}
                                        onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:hashtag-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                    <Input
                                        label="ชื่อ-นามสกุล"
                                        labelPlacement="outside"
                                        placeholder="กรอกชื่อ-นามสกุล"
                                        variant="bordered"
                                        size="lg"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-slate-600 font-medium text-sm",
                                        }}
                                    />
                                </div>
                                <Input
                                    label="อีเมล"
                                    labelPlacement="outside"
                                    placeholder="กรอกอีเมลของนักศึกษา"
                                    type="email"
                                    variant="bordered"
                                    size="lg"
                                    value={formData.email}
                                    onValueChange={(value) => setFormData({ ...formData, email: value })}
                                    isRequired
                                    startContent={<Icon icon="solar:letter-linear" className="text-blue-400 text-xl" />}
                                    classNames={{
                                        inputWrapper: "h-12 bg-white border-slate-200 hover:border-blue-300 focus-within:!border-blue-400",
                                        label: "text-slate-600 font-medium text-sm",
                                    }}
                                />
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


            {/* Toggle Status Confirmation Modal */}
            <Modal isOpen={isToggleStatusModalOpen} onClose={() => setIsToggleStatusModalOpen(false)} size="md">
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl shadow-lg bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/30">
                                <Icon icon={studentToToggle?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {studentToToggle?.is_active ? "ยืนยันการปิดใช้งาน" : "ยืนยันการเปิดใช้งาน"}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className={`rounded-2xl p-6 border ${studentToToggle?.is_active ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${studentToToggle?.is_active ? "bg-amber-100" : "bg-emerald-100"}`}>
                                    <Icon icon="solar:user-bold" className={`text-2xl ${studentToToggle?.is_active ? "text-amber-600" : "text-emerald-600"}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{studentToToggle?.full_name}</p>
                                    <p className="text-sm text-slate-500">{studentToToggle?.student_id}</p>
                                    <p className="text-xs text-slate-400 mt-1">{studentToToggle?.email || "ไม่ระบุอีเมล"}</p>
                                </div>
                            </div>
                            <p className={`mt-4 text-sm ${studentToToggle?.is_active ? "text-amber-700" : "text-emerald-700"}`}>
                                {studentToToggle?.is_active
                                    ? "นักศึกษาจะไม่สามารถเข้าสู่ระบบได้หลังจากปิดใช้งาน"
                                    : "นักศึกษาจะสามารถเข้าสู่ระบบได้หลังจากเปิดใช้งาน"}
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
                            onPress={confirmToggleStatus}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                            startContent={<Icon icon={studentToToggle?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-lg" />}
                        >
                            {studentToToggle?.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
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
                                คุณต้องการลบนักศึกษา <strong className="text-red-600">{selectedStudent?.full_name}</strong> หรือไม่?
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
                            ลบนักศึกษา
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Import Modal */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} size="2xl">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:import-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">นำเข้าข้อมูลนักศึกษา</h3>
                                <p className="text-sm text-slate-500 font-normal mt-1">คัดลอกข้อมูลจาก Excel แล้ววางในช่องด้านล่าง</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-5">
                            <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:info-circle-bold" className="text-lg text-emerald-500" />
                                    <span className="text-sm font-semibold text-slate-700">รูปแบบข้อมูล</span>
                                </div>
                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                    <p className="text-sm text-slate-600 mb-2">คัดลอกข้อมูลจาก Excel โดยเรียงคอลัมน์ดังนี้:</p>
                                    <div className="flex gap-2 flex-wrap">
                                        <Chip size="sm" color="primary" variant="flat">คอลัมน์ A: รหัสนักศึกษา</Chip>
                                        <Chip size="sm" color="success" variant="flat">คอลัมน์ B: ชื่อ-นามสกุล</Chip>
                                        <Chip size="sm" color="warning" variant="flat">คอลัมน์ C: อีเมล</Chip>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3">
                                        <Icon icon="solar:lightbulb-bolt-bold" className="text-amber-500 inline mr-1" />
                                        เมื่อคัดลอกจาก Excel แล้ววาง ระบบจะแยกข้อมูลอัตโนมัติ
                                    </p>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:clipboard-text-bold" className="text-lg text-emerald-500" />
                                    <span className="text-sm font-semibold text-slate-700">ข้อมูลนักศึกษา</span>
                                </div>
                                <textarea
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    placeholder="ตัวอย่าง: 65010001	สมชาย ใจดี	somchai@email.com"
                                    className="w-full h-52 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 bg-white text-sm resize-none"
                                />
                                {importText && (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Icon icon="solar:document-text-bold" className="text-emerald-500" />
                                        <span>พบข้อมูล {importText.trim().split('\n').filter(line => line.trim()).length} รายการ</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100 gap-3">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => {
                                setIsImportModalOpen(false);
                                setImportText("");
                            }}
                            className="font-medium px-6"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleImport}
                            isLoading={isSubmitting}
                            className="font-medium px-6 bg-gradient-to-r from-blue-400 to-indigo-500 text-white"
                            startContent={!isSubmitting && <Icon icon="solar:import-bold" className="text-lg" />}
                        >
                            นำเข้าข้อมูล
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

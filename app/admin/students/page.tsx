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
import { studentService } from "@/services/student.service";
import type { Student, CreateStudentDto, UpdateStudentDto, StudentStats } from "@/services/student.service";
import { useTableParams } from "@/lib/table/use-table-params";
import TablePaginationFooter, { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/components/ui/table-pagination-footer";
import { MetricCardSkeleton, TableRowsSkeleton } from "@/components/ui/resource-loading";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import type ExcelJS from "exceljs";

// Column definitions
const columnDefs = [
    { key: "student_id", labelKey: "studentId", sortable: true },
    { key: "full_name", labelKey: "fullName", sortable: true },
    { key: "email", labelKey: "email", sortable: true },
    { key: "program", labelKey: "program", sortable: false },
    { key: "status", labelKey: "status", sortable: true },
    { key: "created_at", labelKey: "createdAt", sortable: true },
    { key: "actions", labelKey: "actions", sortable: false },
];

const statusOptionDefs = [
    { key: "all", labelKey: "allStatuses" },
    { key: "active", labelKey: "active" },
    { key: "inactive", labelKey: "inactive" },
];

export default function StudentsPage() {
    const t = useI18n();
    const { language } = useGlobalSettings();
    const locale = language === "en" ? "en-US" : "th-TH";
    const { emitDataUpdate, onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, isConnected } = useSocket();
    const isUpdatingRef = useRef(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [stats, setStats] = useState<StudentStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    // Pagination & Filters
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const {
        params,
        setSearch,
        setPage,
        setLimit,
        setSort,
        setFilter,
    } = useTableParams({
        defaultLimit: DEFAULT_TABLE_ROWS_PER_PAGE,
        defaultSort: "created_at",
        defaultOrder: "desc",
        searchDebounceMs: 300,
    });
    const [searchInput, setSearchInput] = useState(String(params.search ?? ""));

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || DEFAULT_TABLE_ROWS_PER_PAGE;
    const isEnglish = language === "en";
    const search = String(params.search ?? "");
    const statusFilter = String(params.status ?? "all");
    const sortBy = String(params.sort ?? "created_at");
    const sortOrder: "ASC" | "DESC" = params.order === "asc" ? "ASC" : "DESC";
    const columns = columnDefs.map((column) => ({
        ...column,
        label: t(column.labelKey),
    }));
    const statusOptions = statusOptionDefs.map((option) => ({
        ...option,
        label: t(option.labelKey),
    }));

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

    // Track original form data for change detection (edit mode)
    const [originalFormData, setOriginalFormData] = useState<CreateStudentDto | null>(null);

    // Import data
    const [importText, setImportText] = useState("");
    const [importMode, setImportMode] = useState<"paste" | "file">("file");
    const [importFile, setImportFile] = useState<File | null>(null);
    const [parsedStudents, setParsedStudents] = useState<CreateStudentDto[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                title: t("somethingWentWrong"),
                description: t("cannotLoadStudents"),
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
        setIsStatsLoading(true);
        try {
            const response = await studentService.getStats();
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
        setOriginalFormData(null);
    };

    // Extract student rows from a parsed ExcelJS workbook (XLSX path)
    const extractStudentsFromWorkbook = async (arrayBuffer: ArrayBuffer): Promise<CreateStudentDto[]> => {
        const { default: ExcelJSLib } = await import("exceljs");
        const workbook: ExcelJS.Workbook = new ExcelJSLib.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) return [];
        const getCellText = (cell: ExcelJS.Cell): string => {
            const v = cell.value;
            if (v == null) return "";
            if (typeof v === "object" && "richText" in v) {
                return (v as { richText: Array<{ text: string }> }).richText.map(r => r.text).join("");
            }
            if (typeof v === "object" && "result" in v) {
                return String((v as { result: unknown }).result ?? "");
            }
            if (typeof v === "object" && "text" in v) {
                return String((v as { text: unknown }).text ?? "");
            }
            return String(v);
        };
        const studentIdPattern = /^\d{9}-\d$/;
        const results: CreateStudentDto[] = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
            const raw = getCellText(row.getCell(2)).trim();
            if (!studentIdPattern.test(raw)) return;
            const fullName = getCellText(row.getCell(3)).trim();
            if (!fullName) return;
            const email = getCellText(row.getCell(4)).trim();
            const program = getCellText(row.getCell(5)).trim();
            const dto: CreateStudentDto = { student_id: raw, full_name: fullName };
            if (email) dto.email = email;
            if (program) dto.extra = { program };
            results.push(dto);
        });
        return results;
    };

    // Extract student rows from an HTML string (KKU HTML-as-XLS path)
    // Uses browser DOMParser — much more reliable than SheetJS HTML mode for quirky legacy HTML
    const extractStudentsFromHtml = (html: string): CreateStudentDto[] => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const rows = Array.from(doc.querySelectorAll("tr"));
        const studentIdPattern = /^\d{9}-\d$/;
        const results: CreateStudentDto[] = [];
        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll("td")).map(td => td.textContent?.trim() ?? "");
            if (cells.length < 3) continue;
            const raw = cells[1].trim();
            if (!studentIdPattern.test(raw)) continue;
            const fullName = cells[2].trim();
            if (!fullName) continue;
            const email = cells[3]?.trim() ?? "";
            const program = cells[4]?.trim() ?? "";
            const dto: CreateStudentDto = { student_id: raw, full_name: fullName };
            if (email) dto.email = email;
            if (program) dto.extra = { program };
            results.push(dto);
        }
        return results;
    };

    // Parse Excel/CSV file → CreateStudentDto[]
    // KKU REG system exports "HTML-as-XLS" (Excel 2003 Publish-as-Web-Page, charset=windows-874).
    // Strategy: sniff first 2 bytes to detect format
    //   OLE2 magic (D0 CF) → true binary XLS  → ArrayBuffer + SheetJS
    //   ZIP magic   (50 4B) → XLSX             → ArrayBuffer + SheetJS
    //   Otherwise           → HTML-as-XLS      → readAsText("windows-874") + DOMParser
    const parseExcelFile = (file: File): Promise<CreateStudentDto[]> => {
        return new Promise((resolve, reject) => {
            const sniffer = new FileReader();
            sniffer.onerror = reject;
            sniffer.onload = (sniff) => {
                const header = new Uint8Array(sniff.target?.result as ArrayBuffer);
                const isBinary =
                    (header[0] === 0xD0 && header[1] === 0xCF) || // OLE2 binary XLS
                    (header[0] === 0x50 && header[1] === 0x4B);   // ZIP / XLSX

                const reader = new FileReader();
                reader.onerror = reject;

                if (isBinary) {
                    if (header[0] === 0xD0 && header[1] === 0xCF) {
                        // OLE2 binary .xls — not supported; ask user to convert
                        return reject(new Error("binary_xls"));
                    }
                    reader.onload = (e) => {
                        extractStudentsFromWorkbook(e.target?.result as ArrayBuffer)
                            .then(resolve)
                            .catch(reject);
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    // HTML-as-XLS: let the browser decode CP874 bytes → Unicode, then use DOMParser
                    reader.onload = (e) => {
                        try {
                            resolve(extractStudentsFromHtml(e.target?.result as string));
                        } catch (err) { reject(err); }
                    };
                    reader.readAsText(file, "windows-874");
                }
            };
            sniffer.readAsArrayBuffer(file.slice(0, 4));
        });
    };

    // Handle file selection (drag-drop or click)
    const handleFileSelect = async (file: File) => {
        try {
            const students = await parseExcelFile(file);
            setImportFile(file);
            setParsedStudents(students);
            if (students.length === 0) {
                addToast({ title: t("noValidImportData"), description: t("checkImportFormatNeedsIdAndName"), color: "warning", timeout: 3000, shouldShowTimeoutProgress: true });
            }
        } catch (err) {
            if (err instanceof Error && err.message === "binary_xls") {
                addToast({ title: t("fileParseError"), description: t("binaryXlsNotSupported"), color: "warning", timeout: 5000, shouldShowTimeoutProgress: true });
            } else {
                addToast({ title: t("fileParseError"), color: "danger", timeout: 3000, shouldShowTimeoutProgress: true });
            }
        }
    };

    // Check if form has changes
    const hasFormChanges = () => {
        if (!originalFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(originalFormData);
    };

    // Handle create student
    const handleCreate = async () => {
        if (!formData.student_id || !formData.full_name || !formData.email) {
            addToast({
                title: t("pleaseFillRequiredFields"),
                description: t("studentIdFullNameAndEmailRequired"),
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
                    title: t("addStudentSuccess"),
                    description: t("studentAddedForName", { name: formData.full_name }),
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
                    title: t("addStudentFailed"),
                    description: response.message || t("somethingWentWrong"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("addStudentFailed"),
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
                title: t("pleaseFillRequiredFields"),
                description: t("studentIdAndFullNameRequired"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const program = formData.extra?.program as string | undefined;
            const updateData: UpdateStudentDto = {
                student_id: formData.student_id,
                full_name: formData.full_name,
                email: formData.email || undefined,
                extra: program ? { program } : undefined,
            };

            const response = await studentService.updateStudent(selectedStudent.id, updateData);
            if (response.success) {
                addToast({
                    title: t("updateStudentSuccess"),
                    description: t("studentUpdatedForName", { name: formData.full_name }),
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
                    title: t("updateStudentFailed"),
                    description: response.message || t("somethingWentWrong"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("updateStudentFailed"),
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
                    title: t("deleteStudentSuccess"),
                    description: t("studentDeletedForName", { name: selectedStudent.full_name }),
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
                    title: t("deleteStudentFailed"),
                    description: response.message || t("somethingWentWrong"),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("deleteStudentFailed"),
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
                    title: student.is_active ? t("studentDisabledSuccess") : t("studentEnabledSuccess"),
                    description: t("studentStatusChangedForName", { name: student.full_name }),
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

    // Handle import
    const handleImport = async () => {
        let studentsToImport: CreateStudentDto[] = [];

        if (importMode === "file") {
            if (parsedStudents.length === 0) {
                addToast({
                    title: t("pleaseSelectFile"),
                    description: t("selectFileToImport"),
                    color: "warning",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                return;
            }
            studentsToImport = parsedStudents;
        } else {
            if (!importText.trim()) {
                addToast({
                    title: t("pleaseEnterImportData"),
                    description: t("enterStudentDataToImport"),
                    color: "warning",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                return;
            }
            const lines = importText.trim().split('\n');
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
                    title: t("noValidImportData"),
                    description: t("checkImportFormatNeedsIdAndName"),
                    color: "warning",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                return;
            }
        }

        setIsSubmitting(true);
        isUpdatingRef.current = true;
        try {
            const response = await studentService.importStudents(studentsToImport);
            if (response.success && response.data) {
                const { created, skipped, failed } = response.data;
                
                // Build detailed message
                const parts: string[] = [];
                if (created > 0) parts.push(t("createdCount", { count: created }));
                if (skipped > 0) parts.push(t("skippedCount", { count: skipped }));
                if (failed > 0) parts.push(t("failedCount", { count: failed }));
                const description = parts.join(", ");
                
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
                    title: t("importCompleted"),
                    description: description || t("noChanges"),
                    color: toastColor,
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });

                setIsImportModalOpen(false);
                setImportText("");
                setImportFile(null);
                setParsedStudents([]);
                setImportMode("file");
                fetchStudents();
                fetchStats();
                emitDataUpdate("student", "bulk");
            }
        } catch (error) {
            addToast({
                title: t("somethingWentWrong"),
                description: t("importStudentsFailed"),
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
        const program = (student.extra as Record<string, unknown> | undefined)?.program as string | undefined;
        const studentData: CreateStudentDto = {
            student_id: student.student_id,
            full_name: student.full_name,
            email: student.email || "",
            ...(program ? { extra: { program } } : {}),
        };
        setFormData(studentData);
        setOriginalFormData(studentData);
        setIsEditModalOpen(true);
    };

    // Open delete modal
    const openDeleteModal = (student: Student) => {
        setSelectedStudent(student);
        setIsDeleteModalOpen(true);
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(locale, {
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
                            className="bg-linear-to-br from-cyan-500 to-blue-600 text-white"
                        />
                        <div>
                            <p className="font-semibold text-foreground">{student.student_id}</p>
                        </div>
                    </div>
                );
            case "full_name":
                return <span className="text-default-700">{student.full_name}</span>;
            case "email":
                return student.email ? (
                    <span className="text-default-600">{student.email}</span>
                ) : (
                    <span className="italic text-default-400">{t("noEmailSpecified")}</span>
                );
            case "program": {
                const prog = student.extra?.program as string | undefined;
                return prog ? (
                    <Chip size="sm" variant="flat" color="secondary">{prog}</Chip>
                ) : (
                    <span className="italic text-default-400">{t("noProgramSpecified")}</span>
                );
            }
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
                        {student.is_active ? t("active") : t("inactive")}
                    </Chip>
                );
            case "created_at":
                return <span className="text-sm text-default-500">{formatDate(student.created_at)}</span>;
            case "actions":
                return (
                    <div className="flex items-center gap-1 justify-center">
                        <Tooltip content={t("editAction")}>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => openEditModal(student)}
                            >
                                <Icon icon="solar:pen-linear" className="text-lg text-default-500" />
                            </Button>
                        </Tooltip>
                        <Tooltip content={student.is_active ? t("disableAction") : t("enableAction")}>
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
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                            {t("manageStudents")}
                        </h1>
                        <p className="text-sm text-default-500 mt-1">{t("manageAllStudentsInSystem")}</p>
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
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        color="secondary"
                        variant="flat"
                        startContent={<Icon icon="solar:import-bold" className="text-xl" />}
                        onPress={() => setIsImportModalOpen(true)}
                        className="font-medium flex-1 sm:flex-none sm:px-6 bg-emerald-300 text-emerald-900"
                    >
                        <span className="hidden sm:inline">{t("importStudents")}</span>
                        <span className="sm:hidden">{t("importData")}</span>
                    </Button>
                    <Button
                        color="primary"
                        startContent={<Icon icon="solar:add-circle-bold" className="text-xl" />}
                        onPress={() => setIsCreateModalOpen(true)}
                        className="font-medium flex-1 sm:flex-none sm:px-6 bg-linear-to-r from-blue-400 to-indigo-500"
                    >
                        <span className="hidden sm:inline">{t("addStudent")}</span>
                        <span className="sm:hidden">{t("add")}</span>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {isStatsLoading && !stats ? (
                    <>
                        <MetricCardSkeleton iconClassName="bg-blue-100" />
                        <MetricCardSkeleton iconClassName="bg-green-100" />
                        <MetricCardSkeleton iconClassName="bg-red-100" />
                    </>
                ) : (
                    <>
                <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                        <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl">
                            <Icon icon="solar:square-academic-cap-bold" className="text-xl sm:text-2xl text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">{t("totalLabel")}</p>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.total || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                        <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                            <Icon icon="solar:check-circle-bold" className="text-xl sm:text-2xl text-green-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">{t("active")}</p>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.byStatus?.active || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-default-200 bg-content1 p-3 shadow-sm sm:p-4">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                        <div className="p-2 sm:p-2.5 bg-red-100 rounded-xl">
                            <Icon icon="solar:close-circle-bold" className="text-xl sm:text-2xl text-red-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">{t("inactive")}</p>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.byStatus?.inactive || 0}</p>
                        </div>
                    </div>
                </div>
                    </>
                )}
            </div>

            {/* Filters */}
            <div className="overflow-hidden rounded-xl border border-default-200 bg-content1 shadow-sm">
                <div className="p-3 sm:p-4">
                    <div className="flex flex-col md:flex-row gap-3 pb-3 sm:pb-4">
                        <Input
                            aria-label={t("searchStudents")}
                            placeholder={t("searchStudents")}
                            value={searchInput}
                            onValueChange={(value) => {
                                setSearchInput(value);
                                setSearch(value);
                            }}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                            className="w-full md:flex-1"
                            isClearable
                            onClear={() => {
                                setSearchInput("");
                                setSearch("");
                            }}
                            classNames={{
                                inputWrapper: "bg-content2 border-default-200 hover:border-default-300",
                            }}
                        />
                        <Select
                            aria-label={t("statusPlaceholder")}
                            placeholder={t("statusPlaceholder")}
                            selectedKeys={[statusFilter]}
                            onSelectionChange={(keys) => {
                                const value = Array.from(keys)[0] as string;
                                setFilter("status", value);
                            }}
                            className="w-full md:w-44"
                            classNames={{
                                trigger: "bg-content2 border-default-200 hover:border-default-300",
                            }}
                        >
                            {statusOptions.map((option) => (
                                <SelectItem key={option.key}>{option.label}</SelectItem>
                            ))}
                        </Select>
                    </div>

                    {/* Table with horizontal scroll */}
                    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                        <div className="min-w-150">
                            <Table
                    aria-label={t("studentsTable")}
                    removeWrapper
                    classNames={{
                        th: "bg-content2 text-default-600 font-semibold text-xs sm:text-sm",
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
                        loadingContent={
                            <TableRowsSkeleton
                                rows={limit}
                                columns={["w-28", "w-36", "w-44", "w-16", "w-24", "w-14"]}
                            />
                        }
                        emptyContent={
                            <div className="py-10 text-center">
                                <Icon icon="solar:user-cross-rounded-linear" className="mx-auto mb-3 text-5xl text-default-300" />
                                <p className="text-default-500">{t("noStudentsFound")}</p>
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

                <TablePaginationFooter
                    totalItems={totalItems}
                    currentPage={page}
                    rowsPerPage={limit}
                    totalPages={totalPages}
                    isEnglish={isEnglish}
                    nounEnglish="student"
                    nounThai="นักศึกษา"
                    onPageChange={setPage}
                    onRowsPerPageChange={setLimit}
                />
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
                                <h3 className="text-lg sm:text-xl font-bold text-foreground">{t("addNewStudent")}</h3>
                                <p className="mt-1 text-xs font-normal text-default-500 sm:text-sm">{t("fillStudentDetailsInSystem")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="space-y-5">
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("studentInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label={t("studentId")}
                                        labelPlacement="outside"
                                        placeholder={t("enterStudentIdExample")}
                                        variant="bordered"
                                        size="lg"
                                        value={formData.student_id}
                                        onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:hashtag-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-sm font-medium text-default-600",
                                        }}
                                    />
                                    <Input
                                        label={t("fullName")}
                                        labelPlacement="outside"
                                        placeholder={t("enterFullName")}
                                        variant="bordered"
                                        size="lg"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-sm font-medium text-default-600",
                                        }}
                                    />
                                </div>
                                <Input
                                    label={t("email")}
                                    labelPlacement="outside"
                                    placeholder={t("enterStudentEmail")}
                                    type="email"
                                    variant="bordered"
                                    size="lg"
                                    value={formData.email}
                                    onValueChange={(value) => setFormData({ ...formData, email: value })}
                                    isRequired
                                    startContent={<Icon icon="solar:letter-linear" className="text-blue-400 text-xl" />}
                                    classNames={{
                                        inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                        label: "text-sm font-medium text-default-600",
                                    }}
                                />
                                <Select
                                    label={t("program")}
                                    labelPlacement="outside"
                                    placeholder={t("selectProgram")}
                                    variant="bordered"
                                    size="lg"
                                    selectedKeys={formData.extra?.program ? [formData.extra.program as string] : []}
                                    onSelectionChange={(keys) => {
                                        const val = Array.from(keys)[0] as string | undefined;
                                        setFormData({ ...formData, extra: val ? { program: val } : undefined });
                                    }}
                                    startContent={<Icon icon="solar:book-bookmark-linear" className="text-blue-400 text-xl" />}
                                    classNames={{
                                        trigger: "h-12 bg-content1 border-default-200 hover:border-blue-300 data-[open=true]:!border-blue-400",
                                        label: "text-sm font-medium text-default-600",
                                    }}
                                >
                                    {["SC-IT", "SC-CS", "CP-Cy", "CP-AI", "SC-GIS"].map((p) => (
                                        <SelectItem key={p}>{p}</SelectItem>
                                    ))}
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
                            isDisabled={!formData.student_id.trim() || !formData.full_name.trim() || !(formData.email || "").trim()}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500"
                        >
                            {t("addStudent")}
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
                                <h3 className="text-xl font-bold text-foreground">{t("editStudentInformation")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("editStudentForName", { name: selectedStudent?.full_name || "" })}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className="space-y-5">
                            <div className="space-y-5 rounded-xl bg-content2/80 p-5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon icon="solar:user-id-bold" className="text-lg text-blue-500" />
                                    <span className="text-sm font-semibold text-default-700">{t("studentInformation")}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
                                    <Input
                                        label={t("studentId")}
                                        labelPlacement="outside"
                                        placeholder={t("enterStudentIdExample")}
                                        variant="bordered"
                                        size="lg"
                                        value={formData.student_id}
                                        onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:hashtag-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-sm font-medium text-default-600",
                                        }}
                                    />
                                    <Input
                                        label={t("fullName")}
                                        labelPlacement="outside"
                                        placeholder={t("enterFullName")}
                                        variant="bordered"
                                        size="lg"
                                        value={formData.full_name}
                                        onValueChange={(value) => setFormData({ ...formData, full_name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:user-linear" className="text-blue-400 text-xl" />}
                                        classNames={{
                                            inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                            label: "text-sm font-medium text-default-600",
                                        }}
                                    />
                                </div>
                                <Input
                                    label={t("email")}
                                    labelPlacement="outside"
                                    placeholder={t("enterStudentEmail")}
                                    type="email"
                                    variant="bordered"
                                    size="lg"
                                    value={formData.email}
                                    onValueChange={(value) => setFormData({ ...formData, email: value })}
                                    isRequired
                                    startContent={<Icon icon="solar:letter-linear" className="text-blue-400 text-xl" />}
                                    classNames={{
                                        inputWrapper: "h-12 bg-content1 border-default-200 hover:border-blue-300 focus-within:!border-blue-400",
                                        label: "text-sm font-medium text-default-600",
                                    }}
                                />
                                <Select
                                    label={t("program")}
                                    labelPlacement="outside"
                                    placeholder={t("selectProgram")}
                                    variant="bordered"
                                    size="lg"
                                    selectedKeys={formData.extra?.program ? [formData.extra.program as string] : []}
                                    onSelectionChange={(keys) => {
                                        const val = Array.from(keys)[0] as string | undefined;
                                        setFormData({ ...formData, extra: val ? { program: val } : undefined });
                                    }}
                                    startContent={<Icon icon="solar:book-bookmark-linear" className="text-blue-400 text-xl" />}
                                    classNames={{
                                        trigger: "h-12 bg-content1 border-default-200 hover:border-blue-300 data-[open=true]:!border-blue-400",
                                        label: "text-sm font-medium text-default-600",
                                    }}
                                >
                                    {["SC-IT", "SC-CS", "CP-Cy", "CP-AI", "SC-GIS"].map((p) => (
                                        <SelectItem key={p}>{p}</SelectItem>
                                    ))}
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


            {/* Toggle Status Confirmation Modal */}
            <Modal isOpen={isToggleStatusModalOpen} onClose={() => setIsToggleStatusModalOpen(false)} size="md">
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl shadow-lg bg-linear-to-br from-blue-400 to-indigo-500 shadow-blue-500/30">
                                <Icon icon={studentToToggle?.is_active ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">
                                {studentToToggle?.is_active ? t("confirmDisableTitle") : t("confirmEnableTitle")}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className={`rounded-2xl p-6 border ${studentToToggle?.is_active ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${studentToToggle?.is_active ? "bg-amber-100" : "bg-emerald-100"}`}>
                                    <Icon icon="solar:user-bold" className={`text-2xl ${studentToToggle?.is_active ? "text-amber-600" : "text-emerald-600"}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">{studentToToggle?.full_name}</p>
                                    <p className="text-sm text-default-500">{studentToToggle?.student_id}</p>
                                    <p className="mt-1 text-xs text-default-400">{studentToToggle?.email || t("noEmailSpecified")}</p>
                                </div>
                            </div>
                            <p className={`mt-4 text-sm ${studentToToggle?.is_active ? "text-amber-700" : "text-emerald-700"}`}>
                                {studentToToggle?.is_active
                                    ? t("studentCannotSignInAfterDisabled")
                                    : t("studentCanSignInAfterEnabled")}
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
                            onPress={confirmToggleStatus}
                            className="font-medium px-6 bg-linear-to-r from-blue-400 to-indigo-500 text-white"
                        >
                            {studentToToggle?.is_active ? t("disableAction") : t("enableAction")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
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
                        <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-100">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon icon="solar:user-cross-bold" className="text-3xl text-red-500" />
                            </div>
                            <p className="text-lg text-default-700">{t("doYouWantDeleteStudent", { name: selectedStudent?.full_name || "" })}</p>
                            <p className="mt-3 rounded-lg border border-red-100 bg-content1 p-3 text-sm text-default-500">
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
                            {t("deleteStudent")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Import Modal */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => {
                    setIsImportModalOpen(false);
                    setImportText("");
                    setImportFile(null);
                    setParsedStudents([]);
                    setImportMode("file");
                }}
                size="2xl"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-linear-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/30">
                                <Icon icon="solar:import-bold" className="text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{t("importStudentDataTitle")}</h3>
                                <p className="mt-1 text-sm font-normal text-default-500">{t("pasteExcelDataBelow")}</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-4 space-y-4">
                        {/* Mode toggle */}
                        <div className="flex gap-1 rounded-xl bg-content2 p-1">
                            <button
                                onClick={() => setImportMode("file")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg font-medium transition-all ${importMode === "file" ? "bg-content1 shadow-sm text-foreground" : "text-default-500 hover:text-default-700"}`}
                            >
                                <Icon icon="solar:upload-linear" className="text-base" />
                                {t("uploadFileTab")}
                            </button>
                            <button
                                onClick={() => setImportMode("paste")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg font-medium transition-all ${importMode === "paste" ? "bg-content1 shadow-sm text-foreground" : "text-default-500 hover:text-default-700"}`}
                            >
                                <Icon icon="solar:clipboard-text-linear" className="text-base" />
                                {t("pasteTextTab")}
                            </button>
                        </div>

                        {importMode === "file" ? (
                            <div className="space-y-4">
                                {/* Drop zone */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xls,.xlsx,.csv"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) await handleFileSelect(file);
                                        e.target.value = "";
                                    }}
                                />
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        setIsDragging(false);
                                        const file = e.dataTransfer.files[0];
                                        if (file) await handleFileSelect(file);
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${isDragging ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : importFile ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-default-300 hover:border-emerald-400 hover:bg-content2/50"}`}
                                >
                                    {importFile ? (
                                        <div className="space-y-2">
                                            <Icon icon="solar:file-check-bold" className="mx-auto text-4xl text-emerald-500" />
                                            <p className="font-medium text-foreground">{importFile.name}</p>
                                            <p className="text-sm text-emerald-600">{t("foundEntriesCount", { count: parsedStudents.length })}</p>
                                            <p className="text-xs text-default-400">{t("dropExcelFileHere")}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Icon icon="solar:cloud-upload-bold" className="mx-auto text-4xl text-default-400" />
                                            <p className="text-sm font-medium text-default-600">{t("dropExcelFileHere")}</p>
                                            <p className="text-xs text-default-400">{t("supportedFormatsHint")}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Column format hint */}
                                <div className="rounded-lg border border-default-200 bg-content1 p-4">
                                    <p className="mb-2 text-xs font-medium text-default-600">{t("copyExcelColumnsHint")}</p>
                                    <div className="flex gap-2 flex-wrap">
                                        <Chip size="sm" color="default" variant="flat">ลำดับ</Chip>
                                        <Chip size="sm" color="primary" variant="flat">{t("columnAStudentId")}</Chip>
                                        <Chip size="sm" color="success" variant="flat">{t("columnBFullName")}</Chip>
                                        <Chip size="sm" color="warning" variant="flat">{t("columnCEmail")}</Chip>
                                        <Chip size="sm" color="secondary" variant="flat">{t("columnDProgram")}</Chip>
                                    </div>
                                </div>

                                {/* Preview */}
                                {parsedStudents.length > 0 && (
                                    <div className="rounded-xl bg-content2/80 p-4">
                                        <p className="text-sm font-semibold text-default-700 mb-3">{t("previewImportData")}</p>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {parsedStudents.slice(0, 6).map((s, i) => (
                                                <div key={i} className="flex items-center gap-3 rounded-lg bg-content1 px-3 py-2 text-xs">
                                                    <span className="font-mono text-default-600 w-28 shrink-0">{s.student_id}</span>
                                                    <span className="text-foreground flex-1 truncate">{s.full_name}</span>
                                                    <span className="text-default-400 truncate hidden sm:block">{s.email || "-"}</span>
                                                    {s.extra?.program != null && (
                                                        <Chip size="sm" variant="flat" color="secondary" className="text-xs shrink-0">{String(s.extra.program)}</Chip>
                                                    )}
                                                </div>
                                            ))}
                                            {parsedStudents.length > 6 && (
                                                <p className="text-xs text-center text-default-400 pt-1">
                                                    +{parsedStudents.length - 6} {isEnglish ? "more" : "รายการอีก"}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-4 rounded-xl bg-content2/80 p-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon icon="solar:info-circle-bold" className="text-lg text-emerald-500" />
                                        <span className="text-sm font-semibold text-default-700">{t("dataFormat")}</span>
                                    </div>
                                    <div className="rounded-lg border border-default-200 bg-content1 p-4">
                                        <p className="mb-2 text-sm text-default-600">{t("copyExcelColumnsHint")}</p>
                                        <div className="flex gap-2 flex-wrap">
                                            <Chip size="sm" color="primary" variant="flat">{t("columnAStudentId")}</Chip>
                                            <Chip size="sm" color="success" variant="flat">{t("columnBFullName")}</Chip>
                                            <Chip size="sm" color="warning" variant="flat">{t("columnCEmail")}</Chip>
                                        </div>
                                        <p className="mt-3 text-xs text-default-500">
                                            <Icon icon="solar:lightbulb-bolt-bold" className="text-amber-500 inline mr-1" />
                                            {t("pasteFromExcelAutoSplit")}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-4 rounded-xl bg-content2/80 p-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon icon="solar:clipboard-text-bold" className="text-lg text-emerald-500" />
                                        <span className="text-sm font-semibold text-default-700">{t("studentData")}</span>
                                    </div>
                                    <textarea
                                        value={importText}
                                        onChange={(e) => setImportText(e.target.value)}
                                        placeholder={t("importStudentExample")}
                                        className="h-52 w-full resize-none rounded-xl border border-default-200 bg-content1 px-4 py-3 text-sm text-foreground placeholder:text-default-400 focus:border-emerald-400 focus:outline-none"
                                    />
                                    {importText && (
                                        <div className="flex items-center gap-2 text-sm text-default-500">
                                            <Icon icon="solar:document-text-bold" className="text-emerald-500" />
                                            <span>{t("foundEntriesCount", { count: importText.trim().split('\n').filter(line => line.trim()).length })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter className="gap-3 border-t border-divider px-6 py-4">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => {
                                setIsImportModalOpen(false);
                                setImportText("");
                                setImportFile(null);
                                setParsedStudents([]);
                                setImportMode("file");
                            }}
                            className="font-medium px-6"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleImport}
                            isLoading={isSubmitting}
                            isDisabled={importMode === "file" ? parsedStudents.length === 0 : !importText.trim()}
                            className="font-medium px-6 bg-linear-to-r from-emerald-400 to-teal-500 text-white"
                        >
                            {t("importStudents")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

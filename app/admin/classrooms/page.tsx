"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Tooltip } from "@heroui/tooltip";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
} from "@heroui/table";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import classroomService, {
    Classroom as APIClassroom,
    Desk as APIDesk,
    ClassroomStats,
} from "@/services/classroom.service";
import { useTableParams } from "@/lib/table/use-table-params";
import { MetricCardSkeleton, TableRowsSkeleton } from "@/components/ui/resource-loading";

// Dynamic import Canvas component (client-side only)
const CanvasEditor = dynamic(() => import("./CanvasEditor"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-slate-100 rounded-xl">
            <div className="text-slate-400">กำลังโหลด...</div>
        </div>
    ),
});

// UI Interface (camelCase)
interface Desk {
    id: string;
    x: number;
    y: number;
    type: "computer" | "normal" | "teacher";
    isEnabled: boolean;
    number: number;
}

interface Zone {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

interface Classroom {
    id: string;
    name: string;
    building: string;
    floor: string;
    description?: string;
    desks: Desk[];
    createdAt: string;
    isActive: boolean;
    isDeleted: boolean;
}

// Transform functions between API (snake_case) and UI (camelCase)
const transformDeskFromAPI = (desk: APIDesk): Desk => ({
    id: desk.id,
    x: desk.x,
    y: desk.y,
    type: desk.type,
    isEnabled: desk.is_enabled,
    number: desk.number,
});

const transformDeskToAPI = (desk: Desk): Omit<APIDesk, "classroom_id"> => ({
    id: desk.id,
    x: desk.x,
    y: desk.y,
    type: desk.type,
    is_enabled: desk.isEnabled,
    number: desk.number,
});

const transformClassroomFromAPI = (classroom: APIClassroom): Classroom => ({
    id: classroom.id,
    name: classroom.name,
    building: classroom.building,
    floor: classroom.floor,
    description: classroom.description,
    desks: (classroom.desks || []).map(transformDeskFromAPI),
    createdAt: classroom.created_at,
    isActive: classroom.is_active ?? true,
    isDeleted: classroom.is_deleted,
});

const DESK_WIDTH = 60;
const DESK_HEIGHT = 60;
const TEACHER_DESK_WIDTH = 180;
const TEACHER_DESK_HEIGHT = 60;
const GRID_SIZE = 20;

// Logical canvas dimensions (the "room" coordinate space)
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 1500;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

const ZONE_COLORS = [
    "#6366f1", // indigo
    "#f43f5e", // rose
    "#14b8a6", // teal
    "#f97316", // orange
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#ec4899", // pink
    "#84cc16", // lime
];

// Table columns
const columns = [
    { key: "name", label: "ชื่อห้อง", sortable: true },
    { key: "building", label: "อาคาร", sortable: true },
    { key: "floor", label: "ชั้น", sortable: true },
    { key: "desks", label: "จำนวนโต๊ะ", sortable: false },
    { key: "status", label: "สถานะ", sortable: false },
    { key: "actions", label: "จัดการ", sortable: false },
];

export default function ClassroomsPage() {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [stats, setStats] = useState<ClassroomStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showLayoutModal, setShowLayoutModal] = useState(false);
    const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
        null
    );
    const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
    const [showDeskModal, setShowDeskModal] = useState(false);
    const [showDeletedOnly, setShowDeletedOnly] = useState(false);
    const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Multi-select state
    const [selectedDeskIds, setSelectedDeskIds] = useState<Set<string>>(new Set());

    // Edit classroom modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: "",
        building: "",
        floor: "",
        description: "",
    });
    const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);

    // Undo/Redo history (stores desk snapshots)
    const [undoStack, setUndoStack] = useState<Desk[][]>([]);
    const [redoStack, setRedoStack] = useState<Desk[][]>([]);
    const MAX_HISTORY = 50;

    // Bulk desk creation
    const [bulkCount, setBulkCount] = useState(1);

    // Zoom state
    const [zoomLevel, setZoomLevel] = useState(0.5);

    // Zone management
    const [zones, setZones] = useState<Zone[]>([]);
    const [showZoneModal, setShowZoneModal] = useState(false);
    const [editingZone, setEditingZone] = useState<Zone | null>(null);
    const [zoneForm, setZoneForm] = useState({ name: "" });

    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'soft' | 'permanent' } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Toggle status modal state
    const [showToggleStatusModal, setShowToggleStatusModal] = useState(false);
    const [toggleTarget, setToggleTarget] = useState<Classroom | null>(null);
    const [isToggling, setIsToggling] = useState(false);

    // Search and filter state (URL-synced)
    const {
        params,
        setSearch,
        setFilter,
    } = useTableParams({
        defaultLimit: 50,
        defaultSort: "created_at",
        defaultOrder: "desc",
        searchDebounceMs: 300,
    });
    const [searchInput, setSearchInput] = useState(String(params.search ?? ""));
    const searchQuery = String(params.search ?? "");
    const floorFilter = String(params.floor ?? "all");

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        building: "",
        floor: "",
        description: "",
    });

    // Fetch classrooms from API
    const fetchClassrooms = useCallback(async () => {
        try {
            setIsLoading(true);
            const classroomsRes = await classroomService.getClassrooms({ showDeleted: "all" });
            
            if (classroomsRes.success && classroomsRes.data) {
                const transformedClassrooms = classroomsRes.data.classrooms.map(transformClassroomFromAPI);
                setClassrooms(transformedClassrooms);
            }
        } catch (error: any) {
            console.error("Failed to fetch classrooms:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถโหลดข้อมูลห้องเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setSearchInput(searchQuery);
    }, [searchQuery]);

    // Helper function to refresh stats only (reduces duplicate code)
    const refreshStats = useCallback(async () => {
        setIsStatsLoading(true);
        try {
            const statsRes = await classroomService.getStats();
            if (statsRes.success && statsRes.data) {
                setStats(statsRes.data);
            }
        } catch (error) {
            console.error("Failed to refresh stats:", error);
        } finally {
            setIsStatsLoading(false);
        }
    }, []);

    // Load independent resources on mount. Classroom rows should not wait for stats.
    useEffect(() => {
        fetchClassrooms();
        refreshStats();
    }, [fetchClassrooms, refreshStats]);

    // Update stage size based on container
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setStageSize({
                    width: rect.width - 48,
                    height: Math.max(600, window.innerHeight - 300),
                });
            }
        };

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, [showLayoutModal]);

    // Snap to grid
    const snapToGrid = (value: number) => {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    };

    // ============ Undo/Redo helpers ============
    const pushUndo = useCallback((desks: Desk[]) => {
        setUndoStack((prev) => {
            const next = [...prev, desks.map(d => ({ ...d }))];
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
        setRedoStack([]);
    }, []);

    const handleUndo = useCallback(() => {
        setUndoStack((prev) => {
            if (prev.length === 0) return prev;
            const newStack = [...prev];
            const snapshot = newStack.pop()!;
            setEditingClassroom((ec) => {
                if (!ec) return ec;
                setRedoStack((rs) => [...rs, ec.desks.map(d => ({ ...d }))]);
                return { ...ec, desks: snapshot };
            });
            return newStack;
        });
    }, []);

    const handleRedo = useCallback(() => {
        setRedoStack((prev) => {
            if (prev.length === 0) return prev;
            const newStack = [...prev];
            const snapshot = newStack.pop()!;
            setEditingClassroom((ec) => {
                if (!ec) return ec;
                setUndoStack((us) => [...us, ec.desks.map(d => ({ ...d }))]);
                return { ...ec, desks: snapshot };
            });
            return newStack;
        });
    }, []);

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!showLayoutModal) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [showLayoutModal, handleUndo, handleRedo]);

    // Renumber desks after deletion: sort spatially (column-major x→y) then assign 1-N per group
    const renumberDesks = useCallback((desks: Desk[]): Desk[] => {
        const sorted = [...desks].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
        let tc = 0, sc = 0;
        return sorted.map((d) => {
            if (d.type === "teacher") { tc++; return { ...d, number: tc }; }
            else { sc++; return { ...d, number: sc }; }
        });
    }, []);

    // Helper: update desks with undo support
    const updateDesksWithUndo = useCallback((updater: (desks: Desk[]) => Desk[]) => {
        setEditingClassroom((prev) => {
            if (!prev) return prev;
            pushUndo(prev.desks);
            return { ...prev, desks: updater(prev.desks) };
        });
    }, [pushUndo]);

    // Handle create classroom
    const handleCreate = async () => {
        if (!formData.name || !formData.building || !formData.floor) {
            addToast({
                title: "ข้อมูลไม่ครบ",
                description: "กรุณากรอกข้อมูลให้ครบถ้วน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        try {
            setIsSaving(true);
            const response = await classroomService.createClassroom({
                name: formData.name,
                building: formData.building,
                floor: formData.floor,
                description: formData.description || undefined,
            });

            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to create classroom");
            }

            const newClassroom = transformClassroomFromAPI(response.data);
            setClassrooms((prev) => [...prev, newClassroom]);
            setShowCreateModal(false);
            setFormData({
                name: "",
                building: "",
                floor: "",
                description: "",
            });

            // Open layout editor immediately
            setEditingClassroom(newClassroom);
            setShowLayoutModal(true);

            // Refresh stats in background (non-blocking)
            refreshStats();

            addToast({
                title: "สำเร็จ",
                description: "สร้างห้องเรียนแล้ว กรุณาจัดผังห้อง",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error: any) {
            console.error("Failed to create classroom:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถสร้างห้องเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSaving(false);
        }
    };


    // Handle delete (soft delete) - open confirmation modal
    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name, type: 'soft' });
        setShowDeleteModal(true);
    };

    // Confirm delete action from modal
    const confirmDeleteAction = async () => {
        if (!deleteTarget) return;

        setIsDeleting(true);
        try {
            if (deleteTarget.type === 'soft') {
                await classroomService.deleteClassroom(deleteTarget.id);
                setClassrooms((prev) =>
                    prev.map((c) => (c.id === deleteTarget.id ? { ...c, isDeleted: true } : c))
                );
                addToast({
                    title: "สำเร็จ",
                    description: "ลบห้องเรียนเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            } else {
                await classroomService.deleteClassroom(deleteTarget.id, true);
                setClassrooms((prev) => prev.filter((c) => c.id !== deleteTarget.id));
                addToast({
                    title: "สำเร็จ",
                    description: "ลบห้องเรียนถาวรเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
            refreshStats();
        } catch (error: any) {
            console.error("Failed to delete classroom:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถลบห้องเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
            setDeleteTarget(null);
        }
    };

    // Handle restore
    const handleRestore = async (id: string) => {
        try {
            await classroomService.restoreClassroom(id);
            setClassrooms((prev) =>
                prev.map((c) => (c.id === id ? { ...c, isDeleted: false } : c))
            );

            // Refresh stats in background
            refreshStats();

            addToast({
                title: "สำเร็จ",
                description: "กู้คืนห้องเรียนเรียบร้อยแล้ว",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error: any) {
            console.error("Failed to restore classroom:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถกู้คืนห้องเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    // Open toggle status modal
    const openToggleStatusModal = (classroom: Classroom) => {
        setToggleTarget(classroom);
        setShowToggleStatusModal(true);
    };

    // Confirm toggle status from modal
    const confirmToggleStatus = async () => {
        if (!toggleTarget) return;

        setIsToggling(true);
        try {
            const response = await classroomService.toggleStatus(toggleTarget.id);
            if (response.success && response.data) {
                const updatedClassroom = transformClassroomFromAPI(response.data);
                setClassrooms((prev) =>
                    prev.map((c) => (c.id === toggleTarget.id ? updatedClassroom : c))
                );

                addToast({
                    title: "สำเร็จ",
                    description: toggleTarget.isActive ? "ปิดใช้งานห้องเรียนแล้ว" : "เปิดใช้งานห้องเรียนแล้ว",
                    color: "success",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: any) {
            console.error("Failed to toggle classroom status:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถเปลี่ยนสถานะห้องเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsToggling(false);
            setShowToggleStatusModal(false);
            setToggleTarget(null);
        }
    };

    // Handle permanent delete - open confirmation modal
    const handlePermanentDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name, type: 'permanent' });
        setShowDeleteModal(true);
    };

    // Open layout editor
    const openLayoutEditor = async (classroom: Classroom) => {
        try {
            // Fetch full classroom with desks
            const response = await classroomService.getClassroom(classroom.id);
            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to load classroom");
            }
            setEditingClassroom(transformClassroomFromAPI(response.data));
            setShowLayoutModal(true);
            // Reset history
            setUndoStack([]);
            setRedoStack([]);
            setSelectedDeskIds(new Set());
            // Load zones from API
            const apiZones = response.data.zones || [];
            setZones(apiZones.map((z: any) => ({
                id: z.id,
                name: z.name,
                x: z.x,
                y: z.y,
                width: z.width,
                height: z.height,
                color: z.color,
            })));
            setZoomLevel(0.5);
        } catch (error: any) {
            console.error("Failed to load classroom:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถโหลดข้อมูลห้องเรียนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    // Open edit classroom modal
    const openEditClassroom = (classroom: Classroom) => {
        setEditingClassroomId(classroom.id);
        setEditFormData({
            name: classroom.name,
            building: classroom.building,
            floor: classroom.floor,
            description: classroom.description || "",
        });
        setShowEditModal(true);
    };

    // Save edited classroom info
    const handleEditClassroom = async () => {
        if (!editingClassroomId || !editFormData.name || !editFormData.building || !editFormData.floor) {
            addToast({ title: "ข้อมูลไม่ครบ", description: "กรุณากรอกข้อมูลให้ครบถ้วน", color: "warning",timeout: 3000,
                shouldShowTimeoutProgress: true, });
            return;
        }
        try {
            setIsSaving(true);
            const response = await classroomService.updateClassroom(editingClassroomId, {
                name: editFormData.name,
                building: editFormData.building,
                floor: editFormData.floor,
                description: editFormData.description || undefined,
            });
            if (!response.success || !response.data) {
                throw new Error(response.error || "Failed to update classroom");
            }
            const updated = transformClassroomFromAPI(response.data);
            setClassrooms((prev) => prev.map((c) => (c.id === editingClassroomId ? updated : c)));
            setShowEditModal(false);
            addToast({ title: "สำเร็จ", description: "แก้ไขข้อมูลห้องเรียนแล้ว", color: "success",timeout: 3000, shouldShowTimeoutProgress: true });
        } catch (error: any) {
            addToast({ title: "เกิดข้อผิดพลาด", description: error.message || "ไม่สามารถแก้ไขข้อมูลได้", color: "danger", timeout: 3000, shouldShowTimeoutProgress: true });
        } finally {
            setIsSaving(false);
        }
    };

    // Add new desk(s) - supports bulk creation
    const handleAddDesk = (type: "computer" | "normal" | "teacher", count: number = 1) => {
        if (!editingClassroom) return;

        const isTeacherDesk = type === "teacher";
        const sameTypeDesks = editingClassroom.desks.filter((d) =>
            isTeacherDesk ? d.type === "teacher" : d.type !== "teacher"
        );
        let nextNumber = sameTypeDesks.length + 1;

        const deskW = isTeacherDesk ? TEACHER_DESK_WIDTH : DESK_WIDTH;
        const deskH = isTeacherDesk ? TEACHER_DESK_HEIGHT : DESK_HEIGHT;
        const cols = Math.max(1, Math.floor((CANVAS_WIDTH - 40) / (deskW + GRID_SIZE)));

        const newDesks: Desk[] = [];
        for (let i = 0; i < count; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            newDesks.push({
                id: `desk_${Date.now()}_${i}`,
                x: snapToGrid(20 + col * (deskW + GRID_SIZE)),
                y: snapToGrid(20 + row * (deskH + GRID_SIZE)),
                type,
                isEnabled: true,
                number: nextNumber++,
            });
        }

        updateDesksWithUndo((desks) => [...desks, ...newDesks]);
    };

    // Handle single desk drag
    const handleDeskDragEnd = (deskId: string, e: any) => {
        if (!editingClassroom) return;
        const newX = snapToGrid(e.target.x());
        const newY = snapToGrid(e.target.y());
        updateDesksWithUndo((desks) =>
            desks.map((d) => (d.id === deskId ? { ...d, x: newX, y: newY } : d))
        );
    };

    // Handle multi-desk drag end
    const handleMultiDeskDragEnd = (moves: { id: string; x: number; y: number }[]) => {
        if (!editingClassroom) return;
        updateDesksWithUndo((desks) => {
            const moveMap = new Map(moves.map((m) => [m.id, m]));
            return desks.map((d) => {
                const m = moveMap.get(d.id);
                return m ? { ...d, x: m.x, y: m.y } : d;
            });
        });
    };

    // ============ Zoom handlers ============
    const handleZoomIn = useCallback(() => {
        setZoomLevel((prev) => Math.min(MAX_ZOOM, +(prev + ZOOM_STEP).toFixed(2)));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoomLevel((prev) => Math.max(MIN_ZOOM, +(prev - ZOOM_STEP).toFixed(2)));
    }, []);

    const handleZoomReset = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const fitScale = Math.min(
                (rect.width - 48) / CANVAS_WIDTH,
                (Math.max(600, window.innerHeight - 300)) / CANVAS_HEIGHT
            );
            setZoomLevel(+Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitScale)).toFixed(2));
        } else {
            setZoomLevel(0.5);
        }
    }, []);

    const handleWheelZoom = useCallback((delta: number) => {
        setZoomLevel((prev) => {
            const step = delta > 0 ? ZOOM_STEP : -ZOOM_STEP;
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(prev + step).toFixed(2)));
        });
    }, []);

    // ============ Zone handlers ============
    const handleAddZone = useCallback(() => {
        const name = zoneForm.name.trim();
        if (!name) return;
        const color = ZONE_COLORS[zones.length % ZONE_COLORS.length];

        if (editingZone) {
            setZones((prev) => prev.map((z) =>
                z.id === editingZone.id ? { ...z, name } : z
            ));
        } else {
            const defaultW = 400;
            const defaultH = 300;
            const row = Math.floor(zones.length / 3);
            const col = zones.length % 3;
            const newZone: Zone = {
                id: `zone_${Date.now()}`,
                name,
                x: snapToGrid(40 + col * (defaultW + 40)),
                y: snapToGrid(40 + row * (defaultH + 60)),
                width: defaultW,
                height: defaultH,
                color,
            };
            setZones((prev) => [...prev, newZone]);
        }
        setZoneForm({ name: "" });
        setEditingZone(null);
        setShowZoneModal(false);
    }, [zoneForm, zones, editingZone, snapToGrid]);

    const handleEditZone = useCallback((zone: Zone) => {
        setEditingZone(zone);
        setZoneForm({ name: zone.name });
        setShowZoneModal(true);
    }, []);

    const handleDeleteZone = useCallback((zoneId: string) => {
        setZones((prev) => prev.filter((z) => z.id !== zoneId));
    }, []);

    // Update zone position/size from canvas drag/resize
    const handleZoneUpdate = useCallback((zoneId: string, update: Partial<Zone>) => {
        setZones((prev) => prev.map((z) => z.id === zoneId ? { ...z, ...update } : z));
    }, []);

    // Handle desk click (for editing)
    const handleDeskClick = (desk: Desk) => {
        setSelectedDesk({ ...desk });
        setShowDeskModal(true);
    };

    // Update desk
    const handleUpdateDesk = () => {
        if (!editingClassroom || !selectedDesk) return;
        updateDesksWithUndo((desks) =>
            desks.map((d) => (d.id === selectedDesk.id ? selectedDesk : d))
        );
        setShowDeskModal(false);
        setSelectedDesk(null);
    };

    // Delete desk(s)
    const handleDeleteDesk = () => {
        if (!editingClassroom || !selectedDesk) return;

        updateDesksWithUndo((desks) => {
            const remaining = desks.filter((d) => d.id !== selectedDesk.id);
            return renumberDesks(remaining);
        });

        setShowDeskModal(false);
        setSelectedDesk(null);
    };

    // Save layout
    const handleSaveLayout = async () => {
        if (!editingClassroom) return;

        try {
            setIsSaving(true);
            
            // Transform desks to API format
            const apiDesks = editingClassroom.desks.map(desk => ({
                id: desk.id,
                number: desk.number,
                x: desk.x,
                y: desk.y,
                type: desk.type,
                isEnabled: desk.isEnabled,
            }));

            // Transform zones to API format
            const apiZones = zones.map(zone => ({
                id: zone.id,
                name: zone.name,
                x: zone.x,
                y: zone.y,
                width: zone.width,
                height: zone.height,
                color: zone.color,
            }));
            
            await classroomService.updateLayout(editingClassroom.id, apiDesks, apiZones);

            // Update local state
            setClassrooms((prev) =>
                prev.map((c) =>
                    c.id === editingClassroom.id ? editingClassroom : c
                )
            );

            // Refresh stats in background
            refreshStats();

            setShowLayoutModal(false);
            setEditingClassroom(null);

            addToast({
                title: "สำเร็จ",
                description: "บันทึกผังห้องเรียบร้อยแล้ว",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error: any) {
            console.error("Failed to save layout:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: error.message || "ไม่สามารถบันทึกผังห้องได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Get unique floors for filter (memoized)
    const uniqueFloors = useMemo(() => 
        Array.from(new Set(classrooms.map((c) => c.floor))).sort(),
        [classrooms]
    );

    // Filter classrooms (memoized)
    const filteredClassrooms = useMemo(() => classrooms.filter((c) => {
        // Deleted filter
        if (showDeletedOnly && !c.isDeleted) return false;
        if (!showDeletedOnly && c.isDeleted) return false;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
                !c.name.toLowerCase().includes(query) &&
                !c.building.toLowerCase().includes(query) &&
                !(c.description?.toLowerCase().includes(query))
            ) {
                return false;
            }
        }

        // Floor filter
        if (floorFilter !== "all" && c.floor !== floorFilter) {
            return false;
        }

        return true;
    }), [classrooms, showDeletedOnly, searchQuery, floorFilter]);

    // Render cell content
    const renderCell = (classroom: Classroom, columnKey: string) => {
        switch (columnKey) {
            case "name":
                return (
                    <div>
                        <p className="font-semibold text-slate-800">{classroom.name}</p>
                        {classroom.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                                {classroom.description}
                            </p>
                        )}
                    </div>
                );
            case "building":
                return (
                    <Chip
                        size="sm"
                        variant="flat"
                        className="bg-blue-50 text-blue-600"
                        startContent={<Icon icon="solar:buildings-2-linear" className="text-xs" />}
                    >
                        {classroom.building}
                    </Chip>
                );
            case "floor":
                return (
                    <Chip
                        size="sm"
                        variant="flat"
                        className="bg-purple-50 text-purple-600"
                    >
                        ชั้น {classroom.floor}
                    </Chip>
                );
            case "desks":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="text-sm text-slate-700">
                            {classroom.desks.length} โต๊ะ
                        </span>
                        <div className="flex gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <Icon icon="solar:monitor-linear" className="text-blue-500" />
                                {classroom.desks.filter(d => d.type === "computer").length}
                            </span>
                            <span className="flex items-center gap-1">
                                <Icon icon="solar:document-linear" className="text-emerald-500" />
                                {classroom.desks.filter(d => d.type === "normal").length}
                            </span>
                            <span className="flex items-center gap-1">
                                <Icon icon="solar:user-speak-linear" className="text-amber-500" />
                                {classroom.desks.filter(d => d.type === "teacher").length}
                            </span>
                        </div>
                    </div>
                );
            case "status":
                if (classroom.isDeleted) {
                    return (
                        <Chip size="sm" color="danger" variant="flat">
                            ลบแล้ว
                        </Chip>
                    );
                }
                return classroom.isActive ? (
                    <Chip
                        size="sm"
                        color="success"
                        variant="flat"
                        startContent={<Icon icon="solar:check-circle-bold" className="text-sm" />}
                    >
                        เปิดใช้งาน
                    </Chip>
                ) : (
                    <Chip
                        size="sm"
                        color="warning"
                        variant="flat"
                        startContent={<Icon icon="solar:pause-circle-bold" className="text-sm" />}
                    >
                        ปิดใช้งาน
                    </Chip>
                );
            case "actions":
                return (
                    <div className="flex items-center gap-1 justify-center">
                        {!classroom.isDeleted ? (
                            <>
                                <Tooltip content={classroom.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color={classroom.isActive ? "warning" : "success"}
                                        onPress={() => openToggleStatusModal(classroom)}
                                    >
                                        <Icon 
                                            icon={classroom.isActive ? "solar:eye-closed-linear" : "solar:eye-linear"} 
                                            className="text-lg" 
                                        />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="แก้ไขข้อมูล">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={() => openEditClassroom(classroom)}
                                    >
                                        <Icon icon="solar:pen-new-square-linear" className="text-lg text-default-500" />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="จัดการผัง">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={() => openLayoutEditor(classroom)}
                                    >
                                        <Icon icon="solar:pen-linear" className="text-lg text-default-500" />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="ลบ" color="danger">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        onPress={() => handleDelete(classroom.id, classroom.name)}
                                    >
                                        <Icon icon="solar:trash-bin-trash-linear" className="text-lg" />
                                    </Button>
                                </Tooltip>
                            </>
                        ) : (
                            <>
                                <Tooltip content="กู้คืน">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="success"
                                        onPress={() => handleRestore(classroom.id)}
                                    >
                                        <Icon icon="solar:restart-bold" className="text-lg" />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="ลบถาวร" color="danger">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        onPress={() => handlePermanentDelete(classroom.id, classroom.name)}
                                    >
                                        <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                    </Button>
                                </Tooltip>
                            </>
                        )}
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
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-default-900">
                        จัดการห้องเรียน
                    </h1>
                    <p className="text-xs sm:text-sm text-default-500 mt-1">
                        สร้างและจัดการผังห้องเรียนสำหรับระบบจองคิวตรวจงาน
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        color={showDeletedOnly ? "default" : "primary"}
                        variant="flat"
                        startContent={<Icon icon="solar:trash-bin-2-bold" className="text-lg sm:text-xl" />}
                        onPress={() => setShowDeletedOnly(!showDeletedOnly)}
                        className="font-medium flex-1 sm:flex-none text-xs sm:text-sm"
                        size="md"
                    >
                        <span className="hidden sm:inline">{showDeletedOnly ? "แสดงห้องปกติ" : "ดูถังขยะ"}</span>
                        <span className="sm:hidden">{showDeletedOnly ? "ปกติ" : "ถังขยะ"}</span>
                    </Button>
                    <Button
                        color="primary"
                        startContent={<Icon icon="solar:add-circle-bold" className="text-lg sm:text-xl" />}
                        onPress={() => setShowCreateModal(true)}
                        className="font-medium flex-1 sm:flex-none sm:px-6 bg-gradient-to-r from-blue-400 to-indigo-500 text-xs sm:text-sm"
                        size="md"
                    >
                        <span className="hidden sm:inline">สร้างห้องเรียนใหม่</span>
                        <span className="sm:hidden">สร้างห้อง</span>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {isStatsLoading && !stats ? (
                    <>
                        <MetricCardSkeleton iconClassName="bg-blue-100" />
                        <MetricCardSkeleton iconClassName="bg-green-100" />
                        <MetricCardSkeleton iconClassName="bg-purple-100" />
                        <MetricCardSkeleton iconClassName="bg-red-100" />
                    </>
                ) : (
                    <>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-blue-100 rounded-xl">
                            <Icon icon="solar:buildings-3-bold" className="text-xl sm:text-2xl text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">ห้องเรียนทั้งหมด</p>
                            <p className="text-xl sm:text-2xl font-bold text-default-900">{stats?.totalClassrooms ?? 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                            <Icon icon="solar:chair-bold" className="text-xl sm:text-2xl text-green-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">โต๊ะทั้งหมด</p>
                            <p className="text-xl sm:text-2xl font-bold text-default-900">{stats?.totalDesks ?? 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-purple-100 rounded-xl">
                            <Icon icon="solar:monitor-bold" className="text-xl sm:text-2xl text-purple-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">โต๊ะคอมพิวเตอร์</p>
                            <p className="text-xl sm:text-2xl font-bold text-default-900">{stats?.computerDesks ?? 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-default-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 bg-red-100 rounded-xl">
                            <Icon icon="solar:trash-bin-2-bold" className="text-xl sm:text-2xl text-red-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-default-500">ถังขยะ</p>
                            <p className="text-xl sm:text-2xl font-bold text-default-900">{stats?.deletedClassrooms ?? 0}</p>
                        </div>
                    </div>
                </div>
                    </>
                )}
            </div>

            {/* Table Card with Filters */}
            <div className="bg-white rounded-xl border border-default-200 shadow-sm overflow-hidden">
                {/* Filters */}
                <div className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pb-3 sm:pb-4">
                        <Input
                            placeholder="ค้นหาห้องเรียน..."
                            value={searchInput}
                            onValueChange={(value) => {
                                setSearchInput(value);
                                setSearch(value);
                            }}
                            startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                            isClearable
                            onClear={() => {
                                setSearchInput("");
                                setSearch("");
                            }}
                            className="flex-1"
                            size="md"
                            classNames={{
                                inputWrapper: "bg-slate-50 border-slate-200 hover:border-slate-300",
                            }}
                        />
                        <div className="flex gap-2 flex-wrap">
                            <Select
                                placeholder="เลือกชั้น"
                                selectedKeys={[floorFilter]}
                                onSelectionChange={(keys) => {
                                    const value = Array.from(keys)[0] as string;
                                    setFilter("floor", value);
                                }}
                                className="flex-1 min-w-[150px] sm:w-48"
                                size="md"
                                classNames={{
                                    trigger: "bg-slate-50 border-slate-200 hover:border-slate-300",
                                }}
                            >
                                {[
                                    <SelectItem key="all">ทุกชั้น</SelectItem>,
                                    ...uniqueFloors.map((floor) => (
                                        <SelectItem key={floor}>ชั้น {floor}</SelectItem>
                                    ))
                                ]}
                            </Select>
                        </div>
                    </div>

                    {/* Table with horizontal scroll */}
                    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                      <div className="min-w-[600px]">
                        <Table
                            aria-label="ตารางห้องเรียน"
                            removeWrapper
                            classNames={{
                                th: "bg-slate-50 text-slate-600 font-semibold text-xs sm:text-sm",
                                td: "py-2 sm:py-3",
                            }}
                        >
                            <TableHeader columns={columns}>
                                {(column) => (
                                    <TableColumn
                                        key={column.key}
                                        align={column.key === "actions" ? "center" : "start"}
                                    >
                                        {column.label}
                                    </TableColumn>
                                )}
                        </TableHeader>
                        <TableBody
                            items={filteredClassrooms}
                            isLoading={isLoading}
                            loadingContent={
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={["w-32", "w-24", "w-16", "w-20", "w-16", "w-16"]}
                                />
                            }
                            emptyContent={
                                <div className="py-10">
                                    <Icon
                                        icon="solar:buildings-3-linear"
                                        className="text-5xl text-slate-300 mx-auto mb-4"
                                    />
                                    <p className="text-slate-500">
                                        {showDeletedOnly
                                            ? "ไม่มีห้องเรียนในถังขยะ"
                                            : "ยังไม่มีห้องเรียน"}
                                    </p>
                                </div>
                            }
                        >
                            {(classroom) => (
                                <TableRow key={classroom.id}>
                                    {(columnKey) => (
                                        <TableCell>
                                            {renderCell(classroom, columnKey as string)}
                                        </TableCell>
                                    )}
                                </TableRow>
                            )}
                        </TableBody>
                          </Table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Classroom Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setFormData({ name: "", building: "", floor: "", description: "" });
                }}
                size="lg"
                scrollBehavior="inside"
                classNames={{
                    base: "mx-2 sm:mx-4",
                }}
            >
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon
                                    icon="solar:display-bold"
                                    className="text-xl sm:text-2xl text-white"
                                />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                                    สร้างห้องเรียนใหม่
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                                    กรอกข้อมูลห้องเรียน แล้วจัดผังในขั้นตอนถัดไป
                                </p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4">
                        <div className="space-y-4">
                            <Input
                                label="ชื่อห้อง"
                                labelPlacement="outside"
                                placeholder="เช่น ห้อง 306"
                                variant="bordered"
                                value={formData.name}
                                onValueChange={(val) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        name: val,
                                    }))
                                }
                                isRequired
                                startContent={
                                    <Icon
                                        icon="solar:display-linear"
                                        className="text-slate-400"
                                    />
                                }
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="อาคาร"
                                    labelPlacement="outside"
                                    placeholder="เช่น อาคาร IT"
                                    variant="bordered"
                                    value={formData.building}
                                    onValueChange={(val) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            building: val,
                                        }))
                                    }
                                    isRequired
                                    startContent={
                                        <Icon
                                            icon="solar:buildings-2-linear"
                                            className="text-slate-400"
                                        />
                                    }
                                />
                                <Input
                                    label="ชั้น"
                                    labelPlacement="outside"
                                    placeholder="เช่น 3"
                                    variant="bordered"
                                    value={formData.floor}
                                    onValueChange={(val) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            floor: val,
                                        }))
                                    }
                                    isRequired
                                    startContent={
                                        <Icon
                                            icon="solar:stairs-linear"
                                            className="text-slate-400"
                                        />
                                    }
                                />
                            </div>
                            <Textarea
                                label="รายละเอียดเพิ่มเติม"
                                labelPlacement="outside"
                                placeholder="ระบุข้อมูลเพิ่มเติมเกี่ยวกับห้องเรียน (ถ้ามี)"
                                variant="bordered"
                                value={formData.description}
                                onValueChange={(val) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        description: val,
                                    }))
                                }
                            />
                            <Card className="bg-blue-50 border-0">
                                <CardBody className="p-4">
                                    <div className="flex items-start gap-3">
                                        <Icon
                                            icon="solar:info-circle-bold"
                                            className="text-blue-500 text-xl mt-0.5"
                                        />
                                        <div className="text-sm text-blue-700">
                                            <p className="font-semibold mb-1">
                                                ขั้นตอนถัดไป
                                            </p>
                                            <p>
                                                หลังจากสร้างห้องแล้ว
                                                คุณจะเข้าสู่หน้าจัดผังห้อง
                                                สามารถเพิ่มโต๊ะและลากวางตำแหน่งได้อิสระ
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={() => {
                                setShowCreateModal(false);
                                setFormData({ name: "", building: "", floor: "", description: "" });
                            }}
                            isDisabled={isSaving}
                        >
                            ยกเลิก
                        </Button>
                        <Button 
                            color="primary" 
                            onPress={handleCreate}
                            isLoading={isSaving}
                        >
                            สร้างและจัดผัง
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Layout Editor Modal */}
            <Modal
                isOpen={showLayoutModal}
                onClose={() => {
                    setShowLayoutModal(false);
                    setEditingClassroom(null);
                    setSelectedDeskIds(new Set());
                    setUndoStack([]);
                    setRedoStack([]);
                    setZones([]);
                    setZoomLevel(0.5);
                }}
                size="full"
                scrollBehavior="inside"
            >
                <ModalContent>
                    <ModalHeader className="border-b border-slate-200 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2 sm:gap-4 pr-0 sm:pr-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/30">
                                    <Icon
                                        icon="solar:display-bold"
                                        className="text-lg sm:text-2xl text-white"
                                    />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-xl font-bold text-slate-800">
                                        <span className="hidden sm:inline">จัดผังห้อง: </span>
                                        <span className="sm:hidden">ผัง: </span>
                                        {editingClassroom?.name}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-slate-500 font-normal hidden sm:block">
                                        ลากโต๊ะเพื่อจัดตำแหน่ง •
                                        Ctrl+คลิก/ลากเลือกหลายโต๊ะ •
                                        Scroll เพื่อซูม
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Undo/Redo */}
                                <Tooltip content="ย้อนกลับ (Ctrl+Z)">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        isDisabled={undoStack.length === 0}
                                        aria-label="ย้อนกลับ"
                                        onPress={handleUndo}
                                    >
                                        <Icon icon="solar:undo-left-round-bold" className="text-lg" />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="ทำซ้ำ (Ctrl+Y)">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        isDisabled={redoStack.length === 0}
                                        aria-label="ทำซ้ำ"
                                        onPress={handleRedo}
                                    >
                                        <Icon icon="solar:undo-right-round-bold" className="text-lg" />
                                    </Button>
                                </Tooltip>
                                <div className="h-5 w-px bg-slate-300 mx-1" />
                                {/* Zoom Controls */}
                                <Tooltip content="ซูมออก">
                                    <Button isIconOnly size="sm" variant="flat" aria-label="ซูมออก" onPress={handleZoomOut} isDisabled={zoomLevel <= MIN_ZOOM}>
                                        <Icon icon="solar:minimize-bold" className="text-lg" />
                                    </Button>
                                </Tooltip>
                                <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-700 min-w-[48px] text-center cursor-pointer" onClick={handleZoomReset}>
                                    {Math.round(zoomLevel * 100)}%
                                </Chip>
                                <Tooltip content="ซูมเข้า">
                                    <Button isIconOnly size="sm" variant="flat" aria-label="ซูมเข้า" onPress={handleZoomIn} isDisabled={zoomLevel >= MAX_ZOOM}>
                                        <Icon icon="solar:maximize-bold" className="text-lg" />
                                    </Button>
                                </Tooltip>
                                <div className="h-5 w-px bg-slate-300 mx-1" />
                                <Chip
                                    variant="flat"
                                    className="bg-emerald-50 text-emerald-600"
                                    startContent={<Icon icon="solar:chair-bold" />}
                                    size="sm"
                                >
                                    {editingClassroom?.desks.length || 0} โต๊ะ
                                </Chip>
                                {selectedDeskIds.size > 0 && (
                                    <Chip
                                        variant="flat"
                                        className="bg-blue-50 text-blue-600"
                                        size="sm"
                                    >
                                        เลือก {selectedDeskIds.size} โต๊ะ
                                    </Chip>
                                )}
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="p-0">
                        {editingClassroom && (
                            <div className="flex flex-col lg:flex-row h-full">
                                {/* Toolbar - Hidden on mobile, shown as floating buttons instead */}
                                <div className="hidden lg:flex w-72 bg-slate-50 border-r border-slate-200 p-4 flex-col">
                                    <h4 className="font-semibold text-slate-800 mb-3">
                                        เพิ่มโต๊ะ
                                    </h4>

                                    {/* Bulk count */}
                                    <div className="mb-3">
                                        <Input
                                            type="number"
                                            label="จำนวน"
                                            labelPlacement="outside"
                                            size="sm"
                                            min={1}
                                            max={50}
                                            value={String(bulkCount)}
                                            onValueChange={(val) => setBulkCount(Math.max(1, Math.min(50, parseInt(val) || 1)))}
                                            variant="bordered"
                                            classNames={{ inputWrapper: "bg-white" }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Button
                                            color="primary"
                                            variant="flat"
                                            className="w-full justify-start"
                                            startContent={
                                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                                    <Icon icon="solar:monitor-bold" className="text-white" />
                                                </div>
                                            }
                                            onPress={() => handleAddDesk("computer", bulkCount)}
                                        >
                                            โต๊ะคอม {bulkCount > 1 ? `x${bulkCount}` : ""}
                                        </Button>
                                        <Button
                                            color="success"
                                            variant="flat"
                                            className="w-full justify-start"
                                            startContent={
                                                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                                                    <Icon icon="solar:document-bold" className="text-white" />
                                                </div>
                                            }
                                            onPress={() => handleAddDesk("normal", bulkCount)}
                                        >
                                            โต๊ะเรียน {bulkCount > 1 ? `x${bulkCount}` : ""}
                                        </Button>
                                        <Button
                                            color="warning"
                                            variant="flat"
                                            className="w-full justify-start"
                                            startContent={
                                                <div className="w-10 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                                                    <Icon icon="solar:user-speak-bold" className="text-white" />
                                                </div>
                                            }
                                            onPress={() => handleAddDesk("teacher", bulkCount)}
                                        >
                                            โต๊ะอาจารย์ {bulkCount > 1 ? `x${bulkCount}` : ""}
                                        </Button>
                                    </div>

                                    {/* Delete selected */}
                                    {selectedDeskIds.size > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-200">
                                            <Button
                                                color="danger"
                                                variant="flat"
                                                className="w-full"
                                                startContent={<Icon icon="solar:trash-bin-trash-linear" />}
                                                onPress={() => {
                                                    updateDesksWithUndo((desks) => {
                                                        const remaining = desks.filter((d) => !selectedDeskIds.has(d.id));
                                                        return renumberDesks(remaining);
                                                    });
                                                    setSelectedDeskIds(new Set());
                                                }}
                                            >
                                                ลบที่เลือก ({selectedDeskIds.size})
                                            </Button>
                                        </div>
                                    )}

                                    {/* Zone Management */}
                                    <div className="mt-6 pt-6 border-t border-slate-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-semibold text-slate-800">โซน</h4>
                                            <Tooltip content="เพิ่มโซน">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="flat"
                                                    color="primary"
                                                    aria-label="เพิ่มโซน"
                                                    onPress={() => {
                                                        setEditingZone(null);
                                                        setZoneForm({ name: "" });
                                                        setShowZoneModal(true);
                                                    }}
                                                >
                                                    <Icon icon="solar:add-circle-bold" className="text-lg" />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                        {zones.length === 0 ? (
                                            <p className="text-xs text-slate-400">ยังไม่มีโซน กดปุ่ม + เพื่อเพิ่ม</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {zones.map((zone) => (
                                                    <div key={zone.id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                                                        <span className="text-xs text-slate-700 flex-1 truncate">{zone.name}</span>
                                                        <Tooltip content="แก้ไข">
                                                            <Button isIconOnly size="sm" variant="light" aria-label="แก้ไขโซน" onPress={() => handleEditZone(zone)}>
                                                                <Icon icon="solar:pen-linear" className="text-sm text-slate-400" />
                                                            </Button>
                                                        </Tooltip>
                                                        <Tooltip content="ลบ">
                                                            <Button isIconOnly size="sm" variant="light" color="danger" aria-label="ลบโซน" onPress={() => handleDeleteZone(zone.id)}>
                                                                <Icon icon="solar:trash-bin-trash-linear" className="text-sm" />
                                                            </Button>
                                                        </Tooltip>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Legend */}
                                    <div className="mt-6 pt-6 border-t border-slate-200">
                                        <h4 className="font-semibold text-slate-800 mb-3">
                                            สัญลักษณ์
                                        </h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-blue-500 rounded" />
                                                <span className="text-sm text-slate-600">
                                                    โต๊ะคอม
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-emerald-500 rounded" />
                                                <span className="text-sm text-slate-600">
                                                    โต๊ะเรียน
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-amber-500 rounded" />
                                                <span className="text-sm text-slate-600">
                                                    โต๊ะอาจารย์
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-slate-300 rounded" />
                                                <span className="text-sm text-slate-600">
                                                    ปิดใช้งาน
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tips */}
                                    <Card className="mt-6 bg-amber-50 border-0">
                                        <CardBody className="p-3">
                                            <div className="flex items-start gap-2">
                                                <Icon
                                                    icon="solar:lightbulb-bolt-bold"
                                                    className="text-amber-500 text-lg mt-0.5"
                                                />
                                                <div className="text-xs text-amber-700">
                                                    <p className="font-semibold mb-1">
                                                        Tips:
                                                    </p>
                                                    <ul className="space-y-1">
                                                        <li>• ลากโต๊ะเพื่อย้ายตำแหน่ง</li>
                                                        <li>• คลิกโต๊ะเพื่อแก้ไขหรือลบ</li>
                                                        <li>• Ctrl+คลิก เลือกหลายโต๊ะ</li>
                                                        <li>• ลากพื้นที่ว่างเลือกกลุ่ม</li>
                                                        <li>• เส้นแดง = แนวเดียวกับโต๊ะอื่น</li>
                                                        <li>• Ctrl+Z / Ctrl+Y ย้อน/ทำซ้ำ</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </div>

                                {/* Canvas Area */}
                                <div
                                    className="flex-1 p-3 sm:p-6 bg-white relative"
                                    ref={containerRef}
                                >
                                    {/* Mobile Floating Add Buttons */}
                                    <div className="lg:hidden absolute top-4 left-4 z-10 flex gap-2">
                                        <Button
                                            isIconOnly
                                            color="primary"
                                            size="sm"
                                            onPress={() => handleAddDesk("computer", bulkCount)}
                                        >
                                            <Icon icon="solar:monitor-bold" className="text-lg" />
                                        </Button>
                                        <Button
                                            isIconOnly
                                            color="success"
                                            size="sm"
                                            aria-label="เพิ่มโต๊ะนักศึกษา"
                                            onPress={() => handleAddDesk("normal", bulkCount)}
                                        >
                                            <Icon icon="solar:document-bold" className="text-lg" />
                                        </Button>
                                        <Button
                                            isIconOnly
                                            color="warning"
                                            size="sm"
                                            aria-label="เพิ่มโต๊ะอาจารย์"
                                            onPress={() => handleAddDesk("teacher", bulkCount)}
                                        >
                                            <Icon icon="solar:user-speak-bold" className="text-lg" />
                                        </Button>
                                        <Tooltip content="ย้อนกลับ">
                                            <Button isIconOnly size="sm" variant="flat" aria-label="ย้อนกลับ" isDisabled={undoStack.length === 0} onPress={handleUndo}>
                                                <Icon icon="solar:undo-left-round-bold" className="text-lg" />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content="ทำซ้ำ">
                                            <Button isIconOnly size="sm" variant="flat" aria-label="ทำซ้ำ" isDisabled={redoStack.length === 0} onPress={handleRedo}>
                                                <Icon icon="solar:undo-right-round-bold" className="text-lg" />
                                            </Button>
                                        </Tooltip>
                                    </div>
                                    
                                    <div className="bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 overflow-auto">
                                        <CanvasEditor
                                            width={stageSize.width}
                                            height={stageSize.height}
                                            canvasWidth={CANVAS_WIDTH}
                                            canvasHeight={CANVAS_HEIGHT}
                                            scale={zoomLevel}
                                            desks={editingClassroom.desks}
                                            zones={zones}
                                            gridSize={GRID_SIZE}
                                            deskWidth={DESK_WIDTH}
                                            deskHeight={DESK_HEIGHT}
                                            teacherDeskWidth={TEACHER_DESK_WIDTH}
                                            teacherDeskHeight={TEACHER_DESK_HEIGHT}
                                            selectedDeskIds={selectedDeskIds}
                                            onDeskDragEnd={handleDeskDragEnd}
                                            onMultiDeskDragEnd={handleMultiDeskDragEnd}
                                            onDeskClick={handleDeskClick}
                                            onSelectionChange={setSelectedDeskIds}
                                            onZoom={handleWheelZoom}
                                            onZoneUpdate={handleZoneUpdate}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter className="border-t border-slate-200 p-3 sm:p-4">
                        <Button
                            variant="light"
                            onPress={() => {
                                setShowLayoutModal(false);
                                setEditingClassroom(null);
                                setSelectedDeskIds(new Set());
                                setUndoStack([]);
                                setRedoStack([]);
                                setZones([]);
                                setZoomLevel(0.5);
                            }}
                            isDisabled={isSaving}
                            size="sm"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSaveLayout}
                            startContent={!isSaving && <Icon icon="solar:diskette-bold" />}
                            isLoading={isSaving}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500"
                            size="sm"
                        >
                            บันทึกผัง
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Desk Modal */}
            <Modal
                isOpen={showDeskModal}
                onClose={() => {
                    setShowDeskModal(false);
                    setSelectedDesk(null);
                }}
                size="md"
                scrollBehavior="inside"
                classNames={{
                    base: "mx-2 sm:mx-4",
                }}
            >
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30">
                                <Icon
                                    icon={
                                        selectedDesk?.type === "computer"
                                            ? "solar:monitor-bold"
                                            : selectedDesk?.type === "teacher"
                                            ? "solar:user-speak-bold"
                                            : "solar:document-bold"
                                    }
                                    className="text-xl sm:text-2xl text-white"
                                />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                                แก้ไขโต๊ะ #{selectedDesk?.number}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4">
                        {selectedDesk && (
                            <div className="space-y-4">
                                <Select
                                    label="ประเภทโต๊ะ"
                                    labelPlacement="outside"
                                    variant="bordered"
                                    selectedKeys={[selectedDesk.type]}
                                    onChange={(e) =>
                                        setSelectedDesk({
                                            ...selectedDesk,
                                            type: e.target.value as
                                                | "computer"
                                                | "normal"
                                                | "teacher",
                                        })
                                    }
                                >
                                    <SelectItem
                                        key="computer"
                                        startContent={
                                            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                                                <Icon
                                                    icon="solar:monitor-bold"
                                                    className="text-white text-sm"
                                                />
                                            </div>
                                        }
                                    >
                                        โต๊ะคอม
                                    </SelectItem>
                                    <SelectItem
                                        key="normal"
                                        startContent={
                                            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center">
                                                <Icon
                                                    icon="solar:document-bold"
                                                    className="text-white text-sm"
                                                />
                                            </div>
                                        }
                                    >
                                        โต๊ะเรียนปกติ
                                    </SelectItem>
                                    <SelectItem
                                        key="teacher"
                                        startContent={
                                            <div className="w-8 h-6 bg-amber-500 rounded flex items-center justify-center">
                                                <Icon
                                                    icon="solar:user-speak-bold"
                                                    className="text-white text-sm"
                                                />
                                            </div>
                                        }
                                    >
                                        โต๊ะอาจารย์
                                    </SelectItem>
                                </Select>

                                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            สถานะการใช้งาน
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {selectedDesk.isEnabled
                                                ? "โต๊ะนี้สามารถใช้งานได้"
                                                : "โต๊ะนี้ถูกปิดใช้งาน"}
                                        </p>
                                    </div>
                                    <Switch
                                        isSelected={selectedDesk.isEnabled}
                                        onValueChange={(val) =>
                                            setSelectedDesk({
                                                ...selectedDesk,
                                                isEnabled: val,
                                            })
                                        }
                                        color="success"
                                    />
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="danger"
                            variant="flat"
                            onPress={handleDeleteDesk}
                            startContent={
                                <Icon icon="solar:trash-bin-trash-linear" />
                            }
                        >
                            ลบโต๊ะ
                        </Button>
                        <div className="flex-1" />
                        <Button
                            variant="light"
                            onPress={() => {
                                setShowDeskModal(false);
                                setSelectedDesk(null);
                            }}
                        >
                            ยกเลิก
                        </Button>
                        <Button color="primary" onPress={handleUpdateDesk}>
                            บันทึก
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Edit Classroom Info Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                size="lg"
                scrollBehavior="inside"
                classNames={{ base: "mx-2 sm:mx-4" }}
            >
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:pen-new-square-bold" className="text-xl sm:text-2xl text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">แก้ไขข้อมูลห้องเรียน</h3>
                                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">แก้ไขชื่อ อาคาร ชั้น หรือรายละเอียดของห้องเรียน</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4">
                        <div className="space-y-4">
                            <Input
                                label="ชื่อห้อง"
                                labelPlacement="outside"
                                placeholder="เช่น ห้อง 306"
                                variant="bordered"
                                value={editFormData.name}
                                onValueChange={(val) => setEditFormData((prev) => ({ ...prev, name: val }))}
                                isRequired
                                startContent={<Icon icon="solar:display-linear" className="text-slate-400" />}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="อาคาร"
                                    labelPlacement="outside"
                                    placeholder="เช่น อาคาร IT"
                                    variant="bordered"
                                    value={editFormData.building}
                                    onValueChange={(val) => setEditFormData((prev) => ({ ...prev, building: val }))}
                                    isRequired
                                    startContent={<Icon icon="solar:buildings-2-linear" className="text-slate-400" />}
                                />
                                <Input
                                    label="ชั้น"
                                    labelPlacement="outside"
                                    placeholder="เช่น 3"
                                    variant="bordered"
                                    value={editFormData.floor}
                                    onValueChange={(val) => setEditFormData((prev) => ({ ...prev, floor: val }))}
                                    isRequired
                                    startContent={<Icon icon="solar:stairs-linear" className="text-slate-400" />}
                                />
                            </div>
                            <Textarea
                                label="รายละเอียดเพิ่มเติม"
                                labelPlacement="outside"
                                placeholder="ระบุข้อมูลเพิ่มเติมเกี่ยวกับห้องเรียน (ถ้ามี)"
                                variant="bordered"
                                value={editFormData.description}
                                onValueChange={(val) => setEditFormData((prev) => ({ ...prev, description: val }))}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setShowEditModal(false)} isDisabled={isSaving}>
                            ยกเลิก
                        </Button>
                        <Button color="primary" onPress={handleEditClassroom} isLoading={isSaving}>
                            บันทึก
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Zone Management Modal */}
            <Modal
                isOpen={showZoneModal}
                onClose={() => {
                    setShowZoneModal(false);
                    setEditingZone(null);
                    setZoneForm({ name: "" });
                }}
                size="sm"
                classNames={{ base: "mx-2 sm:mx-4" }}
            >
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:widget-5-bold" className="text-xl text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingZone ? "แก้ไขโซน" : "เพิ่มโซนใหม่"}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-4 sm:px-6 py-4">
                        <div className="space-y-4">
                            <Input
                                label="ชื่อโซน"
                                labelPlacement="outside"
                                placeholder="เช่น โซน A, แถวหน้า"
                                variant="bordered"
                                value={zoneForm.name}
                                onValueChange={(val) => setZoneForm((prev) => ({ ...prev, name: val }))}
                                isRequired
                                startContent={<Icon icon="solar:tag-linear" className="text-slate-400" />}
                            />
                            <Card className="bg-indigo-50 border-0">
                                <CardBody className="p-3">
                                    <div className="flex items-start gap-2">
                                        <Icon icon="solar:info-circle-bold" className="text-indigo-500 text-lg mt-0.5" />
                                        <p className="text-xs text-indigo-700">
                                            โซนจะปรากฏเป็นกรอบเส้นปะบน Canvas
                                            สามารถลากเพื่อย้ายตำแหน่ง และลากมุม/ขอบเพื่อปรับขนาดได้
                                        </p>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => { setShowZoneModal(false); setEditingZone(null); setZoneForm({ name: "" }); }}>
                            ยกเลิก
                        </Button>
                        <Button color="primary" onPress={handleAddZone} isDisabled={!zoneForm.name.trim()}>
                            {editingZone ? "บันทึก" : "เพิ่มโซน"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={showDeleteModal} onOpenChange={(open) => { if (!open) { setShowDeleteModal(false); setDeleteTarget(null); } }} size="md">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Icon
                                icon={deleteTarget?.type === 'permanent' ? "solar:danger-triangle-bold" : "solar:trash-bin-trash-bold"}
                                className={`text-2xl ${deleteTarget?.type === 'permanent' ? 'text-danger' : 'text-warning'}`}
                            />
                            {deleteTarget?.type === 'permanent' ? 'ลบห้องเรียนถาวร' : 'ลบห้องเรียน'}
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        {deleteTarget?.type === 'soft' ? (
                            <div className="space-y-3">
                                <p>คุณต้องการลบห้องเรียน <strong>&quot;{deleteTarget?.name}&quot;</strong> ใช่หรือไม่?</p>
                                <div className="bg-warning-50 dark:bg-warning-50/10 border border-warning-200 dark:border-warning-200/20 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <Icon icon="solar:info-circle-bold" className="text-warning text-lg mt-0.5 flex-shrink-0" />
                                        <div className="text-sm text-warning-700 dark:text-warning-400">
                                            <p className="font-medium">ห้องเรียนจะถูกย้ายไปยังถังขยะ</p>
                                            <ul className="mt-1 list-disc list-inside space-y-0.5">
                                                <li>สามารถ<strong>กู้คืน</strong>ห้องเรียนจากถังขยะได้</li>
                                                <li>สามารถ<strong>ลบถาวร</strong>ออกจากระบบได้ภายหลัง</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p>คุณต้องการลบห้องเรียน <strong>&quot;{deleteTarget?.name}&quot;</strong> ออกจากระบบถาวรใช่หรือไม่?</p>
                                <div className="bg-danger-50 dark:bg-danger-50/10 border border-danger-200 dark:border-danger-200/20 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <Icon icon="solar:danger-triangle-bold" className="text-danger text-lg mt-0.5 flex-shrink-0" />
                                        <div className="text-sm text-danger-700 dark:text-danger-400">
                                            <p className="font-medium">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                                            <ul className="mt-1 list-disc list-inside space-y-0.5">
                                                <li>ห้องเรียนจะถูก<strong>ลบออกจากระบบทั้งหมด</strong></li>
                                                <li><strong>ไม่สามารถกู้คืน</strong>ได้อีก</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                            isDisabled={isDeleting}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color="danger"
                            onPress={confirmDeleteAction}
                            isLoading={isDeleting}
                        >
                            {deleteTarget?.type === 'permanent' ? 'ลบถาวร' : 'ลบห้องเรียน'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Toggle Status Confirmation Modal */}
            <Modal
                isOpen={showToggleStatusModal}
                onClose={() => {
                    setShowToggleStatusModal(false);
                    setToggleTarget(null);
                }}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl shadow-lg bg-gradient-to-br ${toggleTarget?.isActive ? 'from-amber-400 to-orange-500 shadow-amber-500/30' : 'from-emerald-400 to-green-500 shadow-emerald-500/30'}`}>
                                <Icon icon={toggleTarget?.isActive ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-2xl text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {toggleTarget?.isActive ? 'ยืนยันการปิดใช้งาน' : 'ยืนยันการเปิดใช้งาน'}
                            </h3>
                        </div>
                    </ModalHeader>
                    <ModalBody className="px-6 py-6">
                        <div className={`rounded-2xl p-6 border ${toggleTarget?.isActive ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${toggleTarget?.isActive ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                                    <Icon icon="solar:buildings-3-bold" className={`text-2xl ${toggleTarget?.isActive ? 'text-amber-600' : 'text-emerald-600'}`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{toggleTarget?.name}</p>
                                    <p className="text-sm text-slate-500">อาคาร {toggleTarget?.building} ชั้น {toggleTarget?.floor}</p>
                                </div>
                            </div>
                            <p className={`mt-4 text-sm ${toggleTarget?.isActive ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {toggleTarget?.isActive
                                    ? 'ห้องเรียนที่ปิดใช้งานจะไม่สามารถใช้ในระบบจองคิวตรวจงานได้ แต่ข้อมูลจะยังคงอยู่ในระบบ'
                                    : 'เปิดใช้งานห้องเรียนเพื่อให้สามารถใช้ในระบบจองคิวตรวจงานได้'}
                            </p>
                        </div>
                    </ModalBody>
                    <ModalFooter className="px-6 py-4 border-t border-slate-100 gap-3">
                        <Button
                            variant="flat"
                            color="default"
                            onPress={() => {
                                setShowToggleStatusModal(false);
                                setToggleTarget(null);
                            }}
                            className="font-medium px-6"
                            isDisabled={isToggling}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            color={toggleTarget?.isActive ? 'warning' : 'success'}
                            onPress={confirmToggleStatus}
                            isLoading={isToggling}
                            className={`font-medium px-6 ${toggleTarget?.isActive ? '' : 'bg-gradient-to-r from-emerald-400 to-green-500 text-white'}`}
                            startContent={!isToggling && <Icon icon={toggleTarget?.isActive ? "solar:eye-closed-bold" : "solar:eye-bold"} className="text-lg" />}
                        >
                            {toggleTarget?.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { addToast } from "@heroui/toast";
import assignmentService from "@/services/assignment.service";
import scoreService from "@/services/score.service";
import type { UngradedSummary } from "@/services/score.service";
import { useSocket } from "@/contexts/SocketContext";
import type { AssignmentType } from "../types";
import type { AssignmentTabType, ViewMode } from "./config";

interface UseAssignmentsTabProps {
    assignments: AssignmentType[];
    setAssignments: React.Dispatch<React.SetStateAction<AssignmentType[]>>;
    courseId: string;
    onAssignmentChanged?: () => void;
}

export interface UseAssignmentsTabReturn {
    // State
    searchQuery: string;
    activeTab: AssignmentTabType;
    viewMode: ViewMode;
    isDeleteModalOpen: boolean;
    deleteTarget: AssignmentType | null;
    isDeleting: boolean;
    // Create/Edit Modal State
    isAssignmentModalOpen: boolean;
    editingAssignment: AssignmentType | null;
    // Computed
    labAssignments: AssignmentType[];
    homeworkAssignments: AssignmentType[];
    groupAssignments: AssignmentType[];
    currentAssignments: AssignmentType[];
    courseId: string;
    ungradedSummary: UngradedSummary;
    // Drag reorder
    draggingId: number | null;
    dragOverId: number | null;
    handleDragStart: (id: number) => void;
    handleDragOver: (id: number) => void;
    handleDrop: (dropId: number) => Promise<void>;
    handleDragEnd: () => void;
    // Actions
    setSearchQuery: (query: string) => void;
    setActiveTab: (tab: AssignmentTabType) => void;
    setViewMode: (mode: ViewMode) => void;
    openDeleteModal: (assignment: AssignmentType) => void;
    closeDeleteModal: () => void;
    confirmDeleteAssignment: () => Promise<void>;
    handleDeleteAssignment: (assignment: AssignmentType) => void;
    clearSearch: () => void;
    // Create/Edit Modal Actions
    openCreateModal: () => void;
    openEditModal: (assignment: AssignmentType) => void;
    closeAssignmentModal: () => void;
    onAssignmentSaved: () => void;
}

/**
 * Custom hook for AssignmentsTab state and logic
 * Handles search, filtering, tab switching, view mode, delete, and create/edit modal operations
 */
export function useAssignmentsTab({
    assignments,
    setAssignments,
    courseId,
    onAssignmentChanged,
}: UseAssignmentsTabProps): UseAssignmentsTabReturn {
    const { emitDataUpdate } = useSocket();
    
    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<AssignmentTabType>("lab");
    const [viewMode, setViewMode] = useState<ViewMode>("list");

    // Drag-to-reorder state
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const dragSourceList = useRef<AssignmentType[]>([]);
    
    // Delete modal states
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AssignmentType | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Create/Edit modal states
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<AssignmentType | null>(null);

    // Ungraded summary state
    const [ungradedSummary, setUngradedSummary] = useState<UngradedSummary>({});

    // Fetch ungraded summary when assignments change
    useEffect(() => {
        if (!courseId || assignments.length === 0) {
            setUngradedSummary({});
            return;
        }
        let cancelled = false;
        scoreService.getUngradedSummary(courseId).then((data) => {
            if (!cancelled) setUngradedSummary(data);
        }).catch(() => {
            // silently ignore
        });
        return () => { cancelled = true; };
    }, [courseId, assignments]);

    // Separate assignments by type
    const labAssignments = useMemo(() => 
        assignments.filter(a => a.assignment_type === "individual"),
        [assignments]
    );
    
    const homeworkAssignments = useMemo(() => 
        assignments.filter(a => a.assignment_type === "assignment"),
        [assignments]
    );
    
    const groupAssignments = useMemo(() => 
        assignments.filter(a => a.assignment_type === "permanent_group" || a.assignment_type === "weekly_group"),
        [assignments]
    );

    // Get current tab assignments with search filter
    const currentAssignments = useMemo(() => {
        let list = labAssignments;
        if (activeTab === "assignment") list = homeworkAssignments;
        if (activeTab === "group") list = groupAssignments;

        if (searchQuery) {
            list = list.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return list;
    }, [activeTab, searchQuery, labAssignments, homeworkAssignments, groupAssignments]);

    // Drag-reorder handlers
    const handleDragStart = useCallback((id: number) => {
        setDraggingId(id);
        // Snapshot the current tab list (without search filter) for reorder calculation
        let tabList = labAssignments;
        if (activeTab === "assignment") tabList = homeworkAssignments;
        if (activeTab === "group") tabList = groupAssignments;
        dragSourceList.current = tabList;
    }, [activeTab, labAssignments, homeworkAssignments, groupAssignments]);

    const handleDragOver = useCallback((id: number) => {
        if (id !== draggingId) setDragOverId(id);
    }, [draggingId]);

    const handleDragEnd = useCallback(() => {
        setDraggingId(null);
        setDragOverId(null);
    }, []);

    const handleDrop = useCallback(async (dropId: number) => {
        const dragId = draggingId;
        setDraggingId(null);
        setDragOverId(null);
        if (!dragId || dragId === dropId) return;

        const tabList = dragSourceList.current;
        const fromIdx = tabList.findIndex(a => a.id === dragId);
        const toIdx = tabList.findIndex(a => a.id === dropId);
        if (fromIdx === -1 || toIdx === -1) return;

        const newTabList = [...tabList];
        const [moved] = newTabList.splice(fromIdx, 1);
        newTabList.splice(toIdx, 0, moved);
        const orderedIds = newTabList.map(a => a.id);

        // Optimistic update: assign new order_index for the tab items
        setAssignments(prev => {
            const updated = prev.map(a => {
                const newIdx = orderedIds.indexOf(a.id);
                if (newIdx !== -1) return { ...a, order_index: newIdx + 1 };
                return a;
            });
            return updated.sort((a, b) => a.order_index - b.order_index);
        });

        try {
            await assignmentService.reorderAssignments(courseId, orderedIds);
            emitDataUpdate("assignment", "update", undefined, { courseId });
        } catch {
            addToast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกลำดับได้", color: "danger", timeout: 3000, shouldShowTimeoutProgress: true });
            onAssignmentChanged?.(); // Revert by refreshing
        }
    }, [draggingId, courseId, setAssignments, emitDataUpdate, onAssignmentChanged]);

    // Delete modal actions
    const openDeleteModal = useCallback((assignment: AssignmentType) => {
        setDeleteTarget(assignment);
        setIsDeleteModalOpen(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
    }, []);

    const confirmDeleteAssignment = useCallback(async () => {
        if (!deleteTarget) return;
        
        setIsDeleting(true);
        try {
            await assignmentService.deleteAssignment(deleteTarget.id);
            setAssignments(prev => prev.filter(a => a.id !== deleteTarget.id));
            addToast({
                title: "สำเร็จ",
                description: "ลบงานเรียบร้อยแล้ว",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            
            // Emit real-time update (include courseId so other classrooms can filter)
            emitDataUpdate("assignment", "delete", deleteTarget.id, { courseId });
            
            // Callback to refresh overview data
            onAssignmentChanged?.();
            
            closeDeleteModal();
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถลบงานได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsDeleting(false);
        }
    }, [deleteTarget, setAssignments, emitDataUpdate, onAssignmentChanged, closeDeleteModal]);

    const handleDeleteAssignment = useCallback((assignment: AssignmentType) => {
        openDeleteModal(assignment);
    }, [openDeleteModal]);

    const clearSearch = useCallback(() => {
        setSearchQuery("");
    }, []);

    // Create/Edit modal actions
    const openCreateModal = useCallback(() => {
        setEditingAssignment(null);
        setIsAssignmentModalOpen(true);
    }, []);

    const openEditModal = useCallback((assignment: AssignmentType) => {
        setEditingAssignment(assignment);
        setIsAssignmentModalOpen(true);
    }, []);

    const closeAssignmentModal = useCallback(() => {
        setIsAssignmentModalOpen(false);
        setEditingAssignment(null);
    }, []);

    const onAssignmentSaved = useCallback(() => {
        // Refresh assignments and overview
        onAssignmentChanged?.();
        // Emit real-time update (include courseId so other classrooms can filter)
        if (editingAssignment) {
            emitDataUpdate("assignment", "update", editingAssignment.id, { courseId });
        } else {
            emitDataUpdate("assignment", "create", undefined, { courseId });
        }
    }, [onAssignmentChanged, emitDataUpdate, editingAssignment, courseId]);

    return {
        // State
        searchQuery,
        activeTab,
        viewMode,
        isDeleteModalOpen,
        deleteTarget,
        isDeleting,
        // Create/Edit Modal State
        isAssignmentModalOpen,
        editingAssignment,
        // Computed
        labAssignments,
        homeworkAssignments,
        groupAssignments,
        currentAssignments,
        courseId,
        ungradedSummary,
        // Drag reorder
        draggingId,
        dragOverId,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        // Actions
        setSearchQuery,
        setActiveTab,
        setViewMode,
        openDeleteModal,
        closeDeleteModal,
        confirmDeleteAssignment,
        handleDeleteAssignment,
        clearSearch,
        // Create/Edit Modal Actions
        openCreateModal,
        openEditModal,
        closeAssignmentModal,
        onAssignmentSaved,
    };
}

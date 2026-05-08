"use client";

import type { AssignmentType } from "./types";
import { useAssignmentsTab, AssignmentsTabView } from "./assignments";

interface AssignmentsTabProps {
    assignments: AssignmentType[];
    setAssignments: React.Dispatch<React.SetStateAction<AssignmentType[]>>;
    isLoading: boolean;
    courseId: string;
    weeklyTeams?: Record<number, any[]>;
    onOpenScoreModal: (assignment: AssignmentType) => void;
    onOpenBonusScoreModal?: () => void;
    onAssignmentChanged?: () => void;
    isCourseActive?: boolean;
    hasPendingUpdate?: boolean;
    onPendingUpdateAck?: () => void;
    canCreateAssignments?: boolean;
    canUpdateAssignments?: boolean;
    canDeleteAssignments?: boolean;
    canGradeAssignments?: boolean;
    canEditScores?: boolean;
}

export default function AssignmentsTab({
    assignments,
    setAssignments,
    isLoading,
    courseId,
    weeklyTeams = {},
    onOpenScoreModal,
    onOpenBonusScoreModal,
    onAssignmentChanged,
    isCourseActive = true,
    hasPendingUpdate,
    onPendingUpdateAck,
    canCreateAssignments = false,
    canUpdateAssignments = false,
    canDeleteAssignments = false,
    canGradeAssignments = false,
    canEditScores = false,
}: AssignmentsTabProps) {
    const {
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
        closeDeleteModal,
        confirmDeleteAssignment,
        handleDeleteAssignment,
        clearSearch,
        // Create/Edit Modal Actions
        openCreateModal,
        openEditModal,
        closeAssignmentModal,
        onAssignmentSaved,
    } = useAssignmentsTab({ 
        assignments, 
        setAssignments,
        courseId,
        onAssignmentChanged,
    });

    return (
        <AssignmentsTabView
            assignments={assignments}
            isLoading={isLoading}
            courseId={courseId}
            weeklyTeams={weeklyTeams}
            searchQuery={searchQuery}
            activeTab={activeTab}
            viewMode={viewMode}
            isDeleteModalOpen={isDeleteModalOpen}
            deleteTarget={deleteTarget}
            isDeleting={isDeleting}
            isAssignmentModalOpen={isAssignmentModalOpen}
            editingAssignment={editingAssignment}
            labAssignments={labAssignments}
            homeworkAssignments={homeworkAssignments}
            groupAssignments={groupAssignments}
            currentAssignments={currentAssignments}
            draggingId={draggingId}
            dragOverId={dragOverId}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onSetSearchQuery={setSearchQuery}
            onSetActiveTab={setActiveTab}
            onSetViewMode={setViewMode}
            onCloseDeleteModal={closeDeleteModal}
            onConfirmDelete={confirmDeleteAssignment}
            onDeleteAssignment={handleDeleteAssignment}
            onClearSearch={clearSearch}
            onOpenCreateModal={openCreateModal}
            onOpenEditModal={openEditModal}
            onCloseAssignmentModal={closeAssignmentModal}
            onAssignmentSaved={onAssignmentSaved}
            onOpenScoreModal={onOpenScoreModal}
            onOpenBonusScoreModal={onOpenBonusScoreModal}
            isCourseActive={isCourseActive}
            ungradedSummary={ungradedSummary}
            hasPendingUpdate={hasPendingUpdate}
            onPendingUpdateAck={onPendingUpdateAck}
            canCreateAssignments={canCreateAssignments}
            canUpdateAssignments={canUpdateAssignments}
            canDeleteAssignments={canDeleteAssignments}
            canGradeAssignments={canGradeAssignments}
            canEditScores={canEditScores}
        />
    );
}

/**
 * AttendanceTabView
 * Presentational component - renders UI based on props from hook
 */

"use client";

import React, { memo } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";

import {
    type Course,
    type AttendanceStats,
    type SessionWithComputedStatus,
} from "./config";
import {
    AttendanceTableSkeleton,
    StatsSkeleton,
    StatsCards,
    FiltersCard,
    EmptyState,
    SessionsTable,
    CreateSessionModal,
    EditSessionModal,
    DeleteConfirmModal,
    CloseSessionModal,
    TimeChangePreviewModal,
    SectionChangeWarningModal,
} from "./components";
import type { UseAttendanceTabReturn } from "./useAttendanceTab";

// ============================================================================
// Types
// ============================================================================

interface AttendanceTabViewProps {
    course: Course;
    isLoading: boolean;
    hook: UseAttendanceTabReturn;
    isCourseActive?: boolean;
}

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
    onCreateClick: () => void;
    isCourseActive?: boolean;
}

const Header = memo(function Header({ onCreateClick, isCourseActive = true }: HeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
                <h2 className="text-lg font-semibold text-slate-800">การเช็คชื่อเข้าเรียน</h2>
                <p className="text-sm text-slate-500">จัดการรอบการเช็คชื่อและดูสถิติการเข้าเรียน</p>
            </div>
            <Button
                color="primary"
                startContent={<Icon icon="solar:add-circle-bold" />}
                onPress={onCreateClick}
                isDisabled={!isCourseActive}
                className="bg-gradient-to-r from-blue-400 to-indigo-500 "
            >
                สร้างรอบเช็คชื่อ
            </Button>
        </div>
    );
});

// ============================================================================
// Loading State Component
// ============================================================================

const LoadingState = memo(function LoadingState() {
    return (
        <>
            <StatsSkeleton />
            <AttendanceTableSkeleton />
        </>
    );
});

// ============================================================================
// Content Component
// ============================================================================

interface ContentProps {
    sessions: SessionWithComputedStatus[];
    filteredSessions: SessionWithComputedStatus[];
    stats: AttendanceStats;
    courseId: string;
    searchQuery: string;
    statusFilter: string;
    typeFilter: string;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onTypeChange: (value: string) => void;
    onCreateClick: () => void;
    onActivate: (session: SessionWithComputedStatus) => void;
    onEdit: (session: SessionWithComputedStatus) => void;
    onDelete: (session: SessionWithComputedStatus) => void;
    onClose: (session: SessionWithComputedStatus) => void;
}

const Content = memo(function Content({
    sessions,
    filteredSessions,
    stats,
    courseId,
    searchQuery,
    statusFilter,
    typeFilter,
    onSearchChange,
    onStatusChange,
    onTypeChange,
    onCreateClick,
    onActivate,
    onEdit,
    onDelete,
    onClose,
}: ContentProps) {
    return (
        <>
            <StatsCards stats={stats} />
            <FiltersCard
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                typeFilter={typeFilter}
                onSearchChange={onSearchChange}
                onStatusChange={onStatusChange}
                onTypeChange={onTypeChange}
            />
            {sessions.length === 0 ? (
                <EmptyState onCreateClick={onCreateClick} />
            ) : (
                <SessionsTable
                    sessions={filteredSessions}
                    courseId={courseId}
                    onCreateClick={onCreateClick}
                    onActivate={onActivate}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onClose={onClose}
                />
            )}
        </>
    );
});

// ============================================================================
// Main View Component
// ============================================================================

function AttendanceTabViewComponent({ course, isLoading, hook, isCourseActive = true }: AttendanceTabViewProps) {
    const {
        // Data
        sessions,
        filteredSessions,
        stats,
        allSectionIds,

        // Loading States
        isSessionsLoading,
        isSubmitting,
        isGettingLocation,

        // Filter State
        filters,
        setSearchQuery,
        setStatusFilter,
        setTypeFilter,

        // Modal States
        modals,
        targets,
        openCreateModal,
        closeCreateModal,
        openEditModal,
        closeEditModal,
        openDeleteModal,
        closeDeleteModal,
        openCloseSessionModal,
        closeCloseSessionModal,

        // Form State
        formData,
        setFormData,
        startDateTime,
        setStartDateTime,
        endDateTime,
        setEndDateTime,
        lateThresholdTime,
        setLateThresholdTime,
        lateThresholdMinutes,

        // Actions
        handleCreateSession,
        handleUpdateSession,
        handleDeleteSession,
        handleActivateSession,
        confirmCloseSession,
        getCurrentLocation,

        // Time Change Preview
        timeChangePreview,
        isTimeChangePreviewOpen,
        isApplyingTimeChange,
        closeTimeChangePreview,
        confirmApplyTimeChange,

        // Section Change Preview
        sectionChangePreview,
        isSectionChangePreviewOpen,
        closeSectionChangePreview,
        confirmSectionChange,

        // Context
        courseId,
    } = hook;

    const showLoading = isSessionsLoading;

    return (
        <div className="space-y-4">
            <Header onCreateClick={openCreateModal} isCourseActive={isCourseActive} />

            {showLoading ? (
                <LoadingState />
            ) : (
                <Content
                    sessions={sessions}
                    filteredSessions={filteredSessions}
                    stats={stats}
                    courseId={courseId}
                    searchQuery={filters.searchQuery}
                    statusFilter={filters.statusFilter}
                    typeFilter={filters.typeFilter}
                    onSearchChange={setSearchQuery}
                    onStatusChange={setStatusFilter}
                    onTypeChange={setTypeFilter}
                    onCreateClick={openCreateModal}
                    onActivate={handleActivateSession}
                    onEdit={openEditModal}
                    onDelete={openDeleteModal}
                    onClose={openCloseSessionModal}
                />
            )}

            {/* Modals */}
            <CreateSessionModal
                isOpen={modals.isCreateModalOpen}
                onClose={closeCreateModal}
                formData={formData}
                setFormData={setFormData}
                startDateTime={startDateTime}
                setStartDateTime={setStartDateTime}
                endDateTime={endDateTime}
                setEndDateTime={setEndDateTime}
                lateThresholdTime={lateThresholdTime}
                setLateThresholdTime={setLateThresholdTime}
                lateThresholdMinutes={lateThresholdMinutes}
                sections={course.sections || []}
                isSubmitting={isSubmitting}
                isGettingLocation={isGettingLocation}
                onSubmit={handleCreateSession}
                onGetCurrentLocation={getCurrentLocation}
            />

            <EditSessionModal
                isOpen={modals.isEditModalOpen}
                onClose={closeEditModal}
                editTarget={targets.editTarget}
                formData={formData}
                setFormData={setFormData}
                startDateTime={startDateTime}
                setStartDateTime={setStartDateTime}
                endDateTime={endDateTime}
                setEndDateTime={setEndDateTime}
                lateThresholdTime={lateThresholdTime}
                setLateThresholdTime={setLateThresholdTime}
                lateThresholdMinutes={lateThresholdMinutes}
                sections={course.sections || []}
                allSectionIds={allSectionIds}
                isSubmitting={isSubmitting}
                isGettingLocation={isGettingLocation}
                onSubmit={handleUpdateSession}
                onGetCurrentLocation={getCurrentLocation}
            />

            <DeleteConfirmModal
                isOpen={modals.isDeleteModalOpen}
                onClose={closeDeleteModal}
                targetTitle={targets.deleteTarget?.title}
                isSubmitting={isSubmitting}
                onConfirm={handleDeleteSession}
            />

            <CloseSessionModal
                isOpen={modals.isCloseModalOpen}
                onClose={closeCloseSessionModal}
                targetTitle={targets.closeTarget?.title}
                isSubmitting={isSubmitting}
                onConfirm={confirmCloseSession}
            />

            <TimeChangePreviewModal
                isOpen={isTimeChangePreviewOpen}
                onClose={closeTimeChangePreview}
                preview={timeChangePreview}
                isApplying={isApplyingTimeChange}
                onConfirm={confirmApplyTimeChange}
            />

            <SectionChangeWarningModal
                isOpen={isSectionChangePreviewOpen}
                onClose={closeSectionChangePreview}
                preview={sectionChangePreview}
                isSubmitting={isSubmitting}
                onConfirm={confirmSectionChange}
            />
        </div>
    );
}

// Export memoized component
export const AttendanceTabView = memo(AttendanceTabViewComponent);
export default AttendanceTabView;
/**
 * AttendanceTabView
 * Presentational component - renders UI based on props from hook
 */

"use client";

import React, { memo } from "react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import {
    instructorFlatButtonClass,
    instructorPrimaryButtonClass,
} from "@/components/ui/instructor-button-styles";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

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
    canCreateAttendanceSessions?: boolean;
    canUpdateAttendanceSessions?: boolean;
    canDeleteAttendanceSessions?: boolean;
}

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
    onCreateClick: () => void;
    isCourseActive?: boolean;
    canCreateAttendanceSessions?: boolean;
    canLaunchAttendanceDisplay?: boolean;
}

const Header = memo(function Header({
    onCreateClick,
    isCourseActive = true,
    canCreateAttendanceSessions = false,
    canLaunchAttendanceDisplay = false,
}: HeaderProps) {
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
                <h2 className="text-lg font-semibold text-foreground">{isEnglish ? "Attendance" : "การเช็กชื่อเข้าเรียน"}</h2>
                <p className="text-sm text-default-500">{isEnglish ? "Manage attendance sessions and view attendance statistics" : "จัดการรอบการเช็กชื่อและดูสถิติการเข้าเรียน"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {canLaunchAttendanceDisplay && (
                    <Button
                        variant="flat"
                        className={instructorFlatButtonClass()}
                        onPress={() => window.open("/d", "_blank", "noopener,noreferrer")}
                    >
                        {isEnglish ? "Open attendance display" : "เปิดหน้าจอเช็กชื่อ"}
                    </Button>
                )}
                {canCreateAttendanceSessions && (
                    <Button
                        color="primary"
                        onPress={onCreateClick}
                        isDisabled={!isCourseActive}
                        className={instructorPrimaryButtonClass()}
                    >
                        {isEnglish ? "Create attendance session" : "สร้างรอบเช็กชื่อ"}
                    </Button>
                )}
            </div>
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
    sections: Course["sections"];
    courseId: string;
    isCourseActive?: boolean;
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
    canCreateAttendanceSessions?: boolean;
    canUpdateAttendanceSessions?: boolean;
    canDeleteAttendanceSessions?: boolean;
}

const Content = memo(function Content({
    sessions,
    filteredSessions,
    stats,
    sections,
    courseId,
    isCourseActive = true,
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
    canCreateAttendanceSessions = false,
    canUpdateAttendanceSessions = false,
    canDeleteAttendanceSessions = false,
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
                <EmptyState onCreateClick={onCreateClick} canCreateAttendanceSessions={canCreateAttendanceSessions} />
            ) : (
                <SessionsTable
                    sessions={filteredSessions}
                    sections={sections || []}
                    courseId={courseId}
                    isCourseActive={isCourseActive}
                    onCreateClick={onCreateClick}
                    onActivate={onActivate}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onClose={onClose}
                    canCreateAttendanceSessions={canCreateAttendanceSessions}
                    canUpdateAttendanceSessions={canUpdateAttendanceSessions}
                    canDeleteAttendanceSessions={canDeleteAttendanceSessions}
                />
            )}
        </>
    );
});

// ============================================================================
// Main View Component
// ============================================================================

function AttendanceTabViewComponent({
    course,
    isLoading,
    hook,
    isCourseActive = true,
    canCreateAttendanceSessions = false,
    canUpdateAttendanceSessions = false,
    canDeleteAttendanceSessions = false,
}: AttendanceTabViewProps) {
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
            <Header
                onCreateClick={openCreateModal}
                isCourseActive={isCourseActive}
                canCreateAttendanceSessions={canCreateAttendanceSessions}
                canLaunchAttendanceDisplay={canCreateAttendanceSessions || canUpdateAttendanceSessions}
            />

            {showLoading ? (
                <LoadingState />
            ) : (
                <Content
                    sessions={sessions}
                    filteredSessions={filteredSessions}
                    stats={stats}
                    sections={course.sections || []}
                    courseId={courseId}
                    isCourseActive={isCourseActive}
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
                    canCreateAttendanceSessions={canCreateAttendanceSessions}
                    canUpdateAttendanceSessions={canUpdateAttendanceSessions}
                    canDeleteAttendanceSessions={canDeleteAttendanceSessions}
                />
            )}

            {/* Modals */}
            <CreateSessionModal
                isOpen={modals.isCreateModalOpen}
                onClose={closeCreateModal}
                isCourseActive={isCourseActive}
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
                isCourseActive={isCourseActive}
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
                isCourseActive={isCourseActive}
                targetTitle={targets.deleteTarget?.title}
                isSubmitting={isSubmitting}
                onConfirm={handleDeleteSession}
            />

            <CloseSessionModal
                isOpen={modals.isCloseModalOpen}
                onClose={closeCloseSessionModal}
                isCourseActive={isCourseActive}
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

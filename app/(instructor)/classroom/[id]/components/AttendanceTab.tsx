/**
 * AttendanceTab - Optimized with Container/Presentational Pattern
 * 
 * Performance optimizations:
 * - Separated logic into useAttendanceTab hook
 * - Memoized computed values (sessionsWithComputedStatus, filteredSessions, stats)
 * - Memoized handlers with useCallback
 * - Sub-components wrapped with React.memo
 * - Auto-update uses tick counter instead of full re-render
 * 
 * Structure:
 * - attendance/config.ts - Types, constants, utility functions
 * - attendance/useAttendanceTab.ts - Custom hook with all state/logic
 * - attendance/AttendanceTabView.tsx - Memoized view component
 * - attendance/components/index.tsx - Sub-components
 */

"use client";

import { createPortal } from "react-dom";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useAttendanceTab, AttendanceTabView, type Course } from "./attendance";

interface AttendanceTabProps {
    course: Course;
    isLoading: boolean;
    onAttendanceChanged?: () => void;
    isCourseActive?: boolean;
    canCreateAttendanceSessions?: boolean;
    canUpdateAttendanceSessions?: boolean;
    canDeleteAttendanceSessions?: boolean;
}

export default function AttendanceTab({
    course,
    isLoading,
    onAttendanceChanged,
    isCourseActive = true,
    canCreateAttendanceSessions = false,
    canUpdateAttendanceSessions = false,
    canDeleteAttendanceSessions = false,
}: AttendanceTabProps) {
    // All state and logic handled by custom hook
    const hook = useAttendanceTab(course, onAttendanceChanged);

    return (
        <>
            {/* View layer */}
            <AttendanceTabView
                course={course}
                isLoading={isLoading}
                hook={hook}
                isCourseActive={isCourseActive}
                canCreateAttendanceSessions={canCreateAttendanceSessions}
                canUpdateAttendanceSessions={canUpdateAttendanceSessions}
                canDeleteAttendanceSessions={canDeleteAttendanceSessions}
            />

            {/* Pending update toast — portaled to body to escape stacking contexts */}
            {hook.pendingAttendanceUpdate && createPortal(
                <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[9999] sm:max-w-sm sm:w-full animate-toast-slide-up">
                    <div className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-3 p-4">
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Icon icon="solar:bell-bing-bold" className="text-xl text-white animate-bounce" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800">มีรอบเช็คชื่อใหม่</p>
                                <p className="text-xs text-slate-500 mt-0.5">มีการเพิ่มหรือแก้ไขรอบเช็คชื่อในชั้นเรียนนี้</p>
                            </div>
                            <Button
                                size="sm"
                                color="primary"
                                className="shrink-0 bg-linear-to-r from-blue-500 to-indigo-600 text-white"
                                startContent={<Icon icon="solar:refresh-bold" />}
                                onPress={() => hook.ackAttendanceUpdate()}
                            >
                                โหลดใหม่
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}


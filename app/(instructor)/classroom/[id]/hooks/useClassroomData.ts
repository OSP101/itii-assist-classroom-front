"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { addToast } from "@heroui/toast";
import { courseService } from "@/services/course.service";
import { studentService } from "@/services/student.service";
import { authService } from "@/services/auth.service";
import assignmentService from "@/services/assignment.service";
import attendanceService, { type AttendanceSession } from "@/services/attendance.service";
import scoreEditRequestService from "@/services/scoreEditRequest.service";
import type { Course, TA, CourseOverview, Team, Instructor, SectionStudent } from "@/services/course.service";
import type { Student } from "@/services/student.service";
import type { Assignment as AssignmentType, AssignmentSubItem } from "@/services/assignment.service";
import { useSocket } from "@/contexts/SocketContext";

// Re-export AttendanceSession type
export type { AttendanceSession } from "@/services/attendance.service";

// Team Types
export interface TeamMember {
    id: number;
    student_id: string;
    full_name: string;
}

export interface PermanentTeam {
    id: number;
    name: string;
    members: TeamMember[];
    createdAt: string;
}

export interface WeeklyTeam {
    id: number;
    name: string;
    members: TeamMember[];
    weekNumber: number;
}

// Cache configuration
const CACHE_DURATION = 60000; // 1 minute

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface IncomingRealtimeEvent {
    resource: string;
    action: string;
    id?: string | number;
    data?: {
        courseId?: string | number;
        course_id?: string | number;
        [key: string]: unknown;
    };
    timestamp?: number;
}

export interface CourseRealtimeNotification {
    id: string;
    courseId: string;
    resource: string;
    action: string;
    message: string;
    createdAt: number;
    read: boolean;
}

/**
 * Custom hook for managing classroom data with caching and optimized fetching
 */
export function useClassroomData(courseId: string) {
    // Real-time sync
    const { emitDataUpdate, onDataUpdate, subscribeToUpdates, unsubscribeFromUpdates, isConnected } = useSocket();
    const isUpdatingRef = useRef(false);

    // Data Cache
    const cache = useRef<{
        course?: CacheEntry<Course>;
        overview?: CacheEntry<CourseOverview>;
        assignments?: CacheEntry<AssignmentType[]>;
        attendanceSessions?: CacheEntry<AttendanceSession[]>;
        teams?: CacheEntry<{ permanent: PermanentTeam[]; weekly: Record<number, WeeklyTeam[]> }>;
    }>({});

    // Core data states
    const [course, setCourse] = useState<Course | null>(null);
    const [overview, setOverview] = useState<CourseOverview | null>(null);
    const [assignments, setAssignments] = useState<AssignmentType[]>([]);
    const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
    const [permanentTeams, setPermanentTeams] = useState<PermanentTeam[]>([]);
    const [weeklyTeams, setWeeklyTeams] = useState<Record<number, WeeklyTeam[]>>({});

    // Lists for dropdowns
    const [tasList, setTasList] = useState<TA[]>([]);
    const [studentsList, setStudentsList] = useState<Student[]>([]);
    const [instructorsList, setInstructorsList] = useState<Instructor[]>([]);
    const [sectionStudents, setSectionStudents] = useState<Record<number, SectionStudent[]>>({});

    // User state
    const [userRole, setUserRole] = useState<string>("");
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
    const [pendingAssignmentUpdate, setPendingAssignmentUpdate] = useState(false);
    const [notifications, setNotifications] = useState<CourseRealtimeNotification[]>([]);

    // Loading states - separate for each resource
    const [loadingStates, setLoadingStates] = useState({
        course: true,
        overview: true,
        assignments: false,
        attendance: false,
        teams: true,
        people: false,
        students: true,
    });

    // Helper to check if cache is valid
    const isCacheValid = useCallback(<T,>(entry?: CacheEntry<T>): boolean => {
        if (!entry) return false;
        return Date.now() - entry.timestamp < CACHE_DURATION;
    }, []);

    // Set loading state helper
    const setLoading = useCallback((key: keyof typeof loadingStates, value: boolean) => {
        setLoadingStates(prev => ({ ...prev, [key]: value }));
    }, []);

    // Fetch course details
    const fetchCourse = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid(cache.current.course)) {
            setCourse(cache.current.course!.data);
            return;
        }

        setLoading("course", true);
        try {
            const response = await courseService.getCourseById(courseId);
            if (response.success && response.data) {
                cache.current.course = { data: response.data, timestamp: Date.now() };
                setCourse(response.data);
            }
        } catch (error) {
            console.error("Error fetching course:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูลรายวิชาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setLoading("course", false);
        }
    }, [courseId, isCacheValid, setLoading]);

    // Fetch overview
    const fetchOverview = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid(cache.current.overview)) {
            setOverview(cache.current.overview!.data);
            return;
        }

        setLoading("overview", true);
        try {
            const response = await courseService.getCourseOverview(courseId);
            if (response.success && response.data) {
                cache.current.overview = { data: response.data, timestamp: Date.now() };
                setOverview(response.data);
            }
        } catch (error) {
            console.error("Error fetching overview:", error);
        } finally {
            setLoading("overview", false);
        }
    }, [courseId, isCacheValid, setLoading]);

    // Fetch assignments
    const fetchAssignments = useCallback(async (forceRefresh = false, silent = false) => {
        if (!forceRefresh && isCacheValid(cache.current.assignments)) {
            setAssignments(cache.current.assignments!.data);
            return;
        }

        if (!silent) setLoading("assignments", true);
        try {
            const data = await assignmentService.getAssignments(courseId);
            cache.current.assignments = { data, timestamp: Date.now() };
            setAssignments(data);
        } catch (error) {
            console.error("Error fetching assignments:", error);
        } finally {
            if (!silent) setLoading("assignments", false);
        }
    }, [courseId, isCacheValid, setLoading]);

    // Fetch attendance sessions
    const fetchAttendanceSessions = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid(cache.current.attendanceSessions)) {
            setAttendanceSessions(cache.current.attendanceSessions!.data);
            return;
        }

        setLoading("attendance", true);
        try {
            const data = await attendanceService.getSessions(courseId);
            cache.current.attendanceSessions = { data, timestamp: Date.now() };
            setAttendanceSessions(data);
        } catch (error) {
            console.error("Error fetching attendance sessions:", error);
        } finally {
            setLoading("attendance", false);
        }
    }, [courseId, isCacheValid, setLoading]);

    // Natural sort function for team names
    const naturalSort = useCallback((a: { name: string; id: number }, b: { name: string; id: number }) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
        if (numA && numB) return numA - numB;
        return a.id - b.id;
    }, []);

    // Fetch teams
    const fetchTeams = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid(cache.current.teams)) {
            const cachedTeams = cache.current.teams!.data;
            setPermanentTeams(cachedTeams.permanent);
            setWeeklyTeams(cachedTeams.weekly);
            return;
        }

        setLoading("teams", true);
        try {
            const [permanentResponse, weeklyResponse] = await Promise.all([
                courseService.getTeams(courseId, 'permanent'),
                courseService.getTeams(courseId, 'temporary'),
            ]);

            let permanent: PermanentTeam[] = [];
            let weekly: Record<number, WeeklyTeam[]> = {};

            if (permanentResponse.success && permanentResponse.data) {
                permanent = permanentResponse.data.map(t => ({
                    id: t.id,
                    name: t.name,
                    members: t.members.map(m => ({
                        id: m.id,
                        student_id: m.student_id,
                        full_name: m.full_name,
                    })),
                    createdAt: t.created_at,
                }));
                permanent.sort(naturalSort);
            }

            if (weeklyResponse.success && weeklyResponse.data) {
                weeklyResponse.data.forEach(t => {
                    const weekNum = t.week_number || 1;
                    if (!weekly[weekNum]) weekly[weekNum] = [];
                    weekly[weekNum].push({
                        id: t.id,
                        name: t.name,
                        members: t.members.map(m => ({
                            id: m.id,
                            student_id: m.student_id,
                            full_name: m.full_name,
                        })),
                        weekNumber: weekNum,
                    });
                });
                Object.keys(weekly).forEach(week => {
                    weekly[parseInt(week)].sort(naturalSort);
                });
            }

            cache.current.teams = { data: { permanent, weekly }, timestamp: Date.now() };
            setPermanentTeams(permanent);
            setWeeklyTeams(weekly);
        } catch (error) {
            console.error("Error fetching teams:", error);
        } finally {
            setLoading("teams", false);
        }
    }, [courseId, isCacheValid, naturalSort, setLoading]);

    // Fetch TAs list
    const fetchTAsList = useCallback(async () => {
        setLoading("people", true);
        try {
            const response = await courseService.getTAsList();
            if (response.success && response.data) {
                setTasList(response.data);
            }
        } catch (error) {
            console.error("Error fetching TAs:", error);
        } finally {
            setLoading("people", false);
        }
    }, [setLoading]);

    // Fetch instructors list
    const fetchInstructorsList = useCallback(async () => {
        try {
            const response = await courseService.getInstructors();
            if (response.success && response.data) {
                setInstructorsList(response.data);
            }
        } catch (error) {
            console.error("Error fetching instructors:", error);
        }
    }, []);

    // Fetch students list
    const fetchStudentsList = useCallback(async () => {
        setLoading("students", true);
        try {
            const response = await studentService.getStudents({ limit: 1000, status: "active" });
            if (response.success && response.data) {
                setStudentsList(response.data.students);
            }
        } catch (error) {
            console.error("Error fetching students:", error);
        } finally {
            setLoading("students", false);
        }
    }, [setLoading]);

    // Fetch section students
    const fetchSectionStudents = useCallback(async (sectionId: number) => {
        try {
            const response = await courseService.getSectionStudents(courseId, sectionId);
            if (response.success && response.data) {
                setSectionStudents(prev => ({ ...prev, [sectionId]: response.data! }));
            }
        } catch (error) {
            console.error("Error fetching section students:", error);
        }
    }, [courseId]);

    // Fetch all section students
    const fetchAllSectionStudents = useCallback(async () => {
        if (!course?.sections) return;
        
        const results = await Promise.all(
            course.sections.map(section => 
                courseService.getSectionStudents(courseId, section.id)
                    .then(res => ({ sectionId: section.id, data: res.success ? res.data : [] }))
                    .catch(() => ({ sectionId: section.id, data: [] }))
            )
        );

        const newSectionStudents: Record<number, SectionStudent[]> = {};
        results.forEach(({ sectionId, data }) => {
            if (data) newSectionStudents[sectionId] = data;
        });
        setSectionStudents(newSectionStudents);
    }, [course?.sections, courseId]);

    // Fetch user data
    const fetchUserData = useCallback(async () => {
        const user = await authService.getCurrentUser();
        if (user) {
            setUserRole(user.role);
            setCurrentUserId(user.id);
            if (user.role === 'instructor') {
                try {
                    const count = await scoreEditRequestService.getPendingCount(courseId);
                    setPendingApprovalCount(count);
                } catch (error) {
                    console.error('Failed to fetch pending approval count:', error);
                }
            }
        }
    }, [courseId]);

    // Emit data update with debounce protection
    const emitUpdate = useCallback((resource: string, action: string, id?: string | number) => {
        isUpdatingRef.current = true;
        emitDataUpdate(resource as any, action as any, id, { courseId });
        setTimeout(() => { isUpdatingRef.current = false; }, 500);
    }, [courseId, emitDataUpdate]);

    // Invalidate cache
    const invalidateCache = useCallback((resource?: 'course' | 'overview' | 'assignments' | 'attendanceSessions' | 'teams') => {
        if (resource) {
            delete cache.current[resource];
        } else {
            cache.current = {};
        }
    }, []);

    // Acknowledge pending assignment update (clear banner + silent refresh)
    // Inline cache deletion here to avoid any TDZ dependency on invalidateCache
    const ackAssignmentUpdate = useCallback(async () => {
        setPendingAssignmentUpdate(false);
        delete cache.current['assignments'];
        await fetchAssignments(true, true);
    }, [fetchAssignments]);

    const extractEventCourseId = useCallback((event: IncomingRealtimeEvent): string | null => {
        if (event.resource === "course" && event.id !== undefined && event.id !== null) {
            return String(event.id);
        }
        const payloadCourseId = event.data?.courseId ?? event.data?.course_id;
        if (payloadCourseId === undefined || payloadCourseId === null || payloadCourseId === "") {
            return null;
        }
        return String(payloadCourseId);
    }, []);

    const isCourseEventForCurrentClassroom = useCallback((event: IncomingRealtimeEvent): boolean => {
        const eventCourseId = extractEventCourseId(event);
        return eventCourseId !== null && eventCourseId === String(courseId);
    }, [courseId, extractEventCourseId]);

    const toNotificationMessage = useCallback((event: IncomingRealtimeEvent): string => {
        if (event.resource === "assignment") {
            if (event.action === "create") return "มีการสร้างงานใหม่ในรายวิชานี้";
            if (event.action === "delete") return "มีการลบงานในรายวิชานี้";
            return "มีการแก้ไขข้อมูลงานในรายวิชานี้";
        }
        if (event.resource === "attendance") return "มีการอัปเดตข้อมูลการเช็คชื่อ";
        if (event.resource === "section") return "มีการอัปเดตข้อมูลกลุ่มเรียน";
        if (event.resource === "group") return "มีการอัปเดตข้อมูลทีม";
        if (event.resource === "score") return "มีการอัปเดตข้อมูลคะแนน";
        if (event.resource === "student") return "มีการอัปเดตข้อมูลนักศึกษาในรายวิชา";
        if (event.resource === "queue") return "มีการอัปเดตข้อมูลคิว";
        return "มีการอัปเดตข้อมูลรายวิชา";
    }, []);

    const pushNotification = useCallback((event: IncomingRealtimeEvent) => {
        const eventCourseId = extractEventCourseId(event);
        if (!eventCourseId) return;

        const entry: CourseRealtimeNotification = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            courseId: eventCourseId,
            resource: event.resource,
            action: event.action,
            message: toNotificationMessage(event),
            createdAt: event.timestamp ?? Date.now(),
            read: false,
        };

        setNotifications((prev) => [entry, ...prev].slice(0, 50));
    }, [extractEventCourseId, toNotificationMessage]);

    const unreadNotificationCount = useMemo(
        () => notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0),
        [notifications]
    );

    const markNotificationAsRead = useCallback((id: string) => {
        setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    }, []);

    const markAllNotificationsAsRead = useCallback(() => {
        setNotifications((prev) => prev.map((item) => (item.read ? item : { ...item, read: true })));
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    // Refresh data for specific tab (cache-first by default to avoid loading flicker)
    const refreshForTab = useCallback(async (tab: string, options?: { force?: boolean }) => {
        const force = options?.force ?? false;

        // Dismiss any pending update notification when switching tabs
        setPendingAssignmentUpdate(false);

        switch (tab) {
            case "overview":
                await fetchOverview(force);
                break;
            case "assignments":
                await Promise.all([
                    fetchAssignments(force, !force),
                    fetchTeams(force),
                ]);
                break;
            case "attendance-overview":
            case "attendance":
                await fetchAttendanceSessions(force);
                break;
            case "people":
                await Promise.all([fetchTAsList(), fetchInstructorsList()]);
                break;
            case "sections":
                if (force) {
                    await Promise.all([fetchCourse(true), fetchAllSectionStudents()]);
                } else {
                    await fetchCourse(false);
                }
                break;
            case "scores":
                await Promise.all([
                    fetchAssignments(force, !force),
                    fetchTeams(force),
                ]);
                break;
            case "score-summary":
                await fetchAssignments(force, !force);
                break;
        }
    }, [fetchOverview, fetchAssignments, fetchAttendanceSessions, fetchCourse, fetchAllSectionStudents, fetchTAsList, fetchInstructorsList, fetchTeams]);

    // Initial data load (route-aware to avoid fetching every heavy dataset at once)
    const initializeData = useCallback(async (tab: string = "overview") => {
        const baseRequests: Promise<any>[] = [
            fetchCourse(),
            fetchOverview(),
            fetchUserData(),
        ];

        const tabRequests: Promise<any>[] = [];

        switch (tab) {
            case "sections":
                tabRequests.push(fetchTeams(), fetchStudentsList());
                break;
            case "people":
                tabRequests.push(fetchTAsList(), fetchInstructorsList());
                break;
            case "assignments":
                tabRequests.push(fetchAssignments(), fetchTeams());
                break;
            case "scores":
                tabRequests.push(fetchAssignments(), fetchTeams());
                break;
            case "exam-scores":
            case "approval":
                tabRequests.push(fetchAssignments());
                break;
            case "attendance-overview":
            case "attendance":
                tabRequests.push(fetchAttendanceSessions());
                break;
            default:
                break;
        }

        await Promise.all([...baseRequests, ...tabRequests]);
    }, [fetchCourse, fetchOverview, fetchUserData, fetchTeams, fetchStudentsList, fetchTAsList, fetchInstructorsList, fetchAssignments, fetchAttendanceSessions]);

    // Handle real-time updates
    useEffect(() => {
        subscribeToUpdates();
        
        const unsubscribe = onDataUpdate((data: IncomingRealtimeEvent) => {
            if (isUpdatingRef.current) return;
            if (!isCourseEventForCurrentClassroom(data)) return;

            // Self-filter: skip if the current user was the actor who triggered the event
            try {
                const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                if (rawUser) {
                    const myId = String(JSON.parse(rawUser)?.id ?? '');
                    const eventActorId = String(
                        (data as any).actor_id ??
                        (data as any).data?.actor_id ??
                        ''
                    );
                    if (myId && eventActorId && myId === eventActorId) return;
                }
            } catch { /* ignore parse errors */ }

            pushNotification(data);
            
            switch (data.resource) {
                case "assignment":
                    invalidateCache('assignments');
                    invalidateCache('overview');
                    setPendingAssignmentUpdate(true);
                    fetchOverview(true);
                    break;
                case "score":
                    invalidateCache('overview');
                    fetchOverview(true);
                    break;
                case "attendance":
                    invalidateCache('attendanceSessions');
                    invalidateCache('overview');
                    fetchAttendanceSessions(true);
                    fetchOverview(true);
                    break;
                case "section":
                case "group":
                    invalidateCache('course');
                    invalidateCache('teams');
                    invalidateCache('overview');
                    fetchCourse(true);
                    fetchTeams(true);
                    fetchAllSectionStudents();
                    fetchOverview(true);
                    break;
                case "student":
                    invalidateCache('overview');
                    fetchAllSectionStudents();
                    fetchOverview(true);
                    break;
                case "queue":
                    invalidateCache('overview');
                    fetchOverview(true);
                    break;
            }
        });

        return () => {
            unsubscribe();
            unsubscribeFromUpdates();
        };
    }, [subscribeToUpdates, unsubscribeFromUpdates, onDataUpdate, isCourseEventForCurrentClassroom, pushNotification, invalidateCache, fetchOverview, fetchAttendanceSessions, fetchCourse, fetchTeams, fetchAllSectionStudents]);

    return {
        // Data
        course,
        setCourse,
        overview,
        assignments,
        setAssignments,
        attendanceSessions,
        permanentTeams,
        setPermanentTeams,
        weeklyTeams,
        setWeeklyTeams,
        tasList,
        studentsList,
        instructorsList,
        sectionStudents,
        setSectionStudents,
        userRole,
        currentUserId,
        pendingApprovalCount,
        setPendingApprovalCount,
        isConnected,

        // Loading states
        loadingStates,
        isLoading: loadingStates.course,
        isOverviewLoading: loadingStates.overview,
        isAssignmentsLoading: loadingStates.assignments,
        isTeamsLoading: loadingStates.teams,
        isPeopleLoading: loadingStates.people,
        isStudentsLoading: loadingStates.students,

        // Pending update flags
        pendingAssignmentUpdate,
        ackAssignmentUpdate,

        // Notification center state
        notifications,
        unreadNotificationCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,

        // Actions
        fetchCourse,
        fetchOverview,
        fetchAssignments,
        fetchAttendanceSessions,
        fetchTeams,
        fetchTAsList,
        fetchStudentsList,
        fetchInstructorsList,
        fetchSectionStudents,
        fetchAllSectionStudents,
        refreshForTab,
        initializeData,
        emitUpdate,
        invalidateCache,
        
        // Utility functions
        naturalSort,
    };
}

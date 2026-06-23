"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { addToast } from "@heroui/toast";
import { courseService } from "@/services/course.service";
import { studentService } from "@/services/student.service";
import type { Course, SectionStudent, RemovedSectionStudent } from "@/services/course.service";
import type { Student } from "@/services/student.service";
import {
    type PermanentTeam,
    type WeeklyTeam,
    type TeamMember,
    type SectionSubTab,
    type TeamType,
    type TeamFormationMethod,
    DEFAULT_TOTAL_WEEKS,
    naturalSortTeams,
    filterStudentsByQuery,
} from "./config";
import { useSocket, type ResourceType, type ActionType } from "@/contexts/SocketContext";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

// ============================================
// Cache Configuration
// ============================================

const CACHE_DURATION = 60000; // 1 minute
const STUDENT_SEARCH_DEBOUNCE_MS = 700;
const STUDENT_SEARCH_MIN_QUERY_LENGTH = 2;

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

function localizeAutoTeamName(name: string, isEnglish: boolean) {
    const thaiMatch = name.match(/^กลุ่มที่\s+(\d+)$/);
    if (thaiMatch) {
        return isEnglish ? `Team ${thaiMatch[1]}` : `กลุ่มที่ ${thaiMatch[1]}`;
    }

    const englishMatch = name.match(/^Team\s+(\d+)$/i);
    if (englishMatch) {
        return isEnglish ? `Team ${englishMatch[1]}` : `กลุ่มที่ ${englishMatch[1]}`;
    }

    return name;
}

function localizePermanentTeams(teams: PermanentTeam[], isEnglish: boolean) {
    return teams
        .map(team => ({
            ...team,
            name: localizeAutoTeamName(team.name, isEnglish),
        }))
        .sort(naturalSortTeams);
}

function localizeWeeklyTeams(weeklyTeams: Record<number, WeeklyTeam[]>, isEnglish: boolean) {
    const localized: Record<number, WeeklyTeam[]> = {};

    Object.entries(weeklyTeams).forEach(([week, teams]) => {
        localized[Number(week)] = teams
            .map(team => ({
                ...team,
                name: localizeAutoTeamName(team.name, isEnglish),
            }))
            .sort(naturalSortTeams);
    });

    return localized;
}

function getLocalizedErrorMessage(
    isEnglish: boolean,
    englishMessage: string,
    thaiMessage: string,
    backendMessage?: string
) {
    return isEnglish ? englishMessage : backendMessage || thaiMessage;
}

// ============================================
// Modal State Types
// ============================================

interface SectionModalState {
    isOpen: boolean;
    sectionNo: string;
    note: string;
}

interface StudentModalState {
    isOpen: boolean;
    sectionId: number | null;
    studentId: string;
    searchQuery: string;
    mode: "single" | "bulk";
    pasteData: string;
    parsedStudents: Array<{
        inputValue: string;
        matchedStudent: Student | null;
        status: "matched" | "not_found" | "already_enrolled";
        enrolledSectionNo?: string | null;
    }>;
}

interface TeamModalState {
    isOpen: boolean;
    type: TeamType;
    formationMethod: TeamFormationMethod;
    name: string;
    members: number[];
    size: number;
    memberMode: "select" | "paste";
    isParsing: boolean;
    pasteData: string;
    parsedMembers: Array<{
        inputValue: string;
        matchedStudent: TeamMember | null;
        status: "matched" | "not_found" | "already_in_team";
    }>;
}

interface EditTeamModalState {
    isOpen: boolean;
    team: {
        id: number;
        name: string;
        type: TeamType;
        weekNumber?: number;
        members: TeamMember[];
    } | null;
    name: string;
    members: number[];
}

interface DeleteModalTarget {
    type: "section" | "student" | "team";
    sectionId?: number;
    sectionNo?: string;
    sectionStudentCount?: number;
    studentId?: number;
    studentName?: string;
    studentCode?: string;
    teamId?: number;
    teamName?: string;
    teamType?: TeamType;
    weekNumber?: number;
    teamMembers?: TeamMember[];
}

interface DeleteModalState {
    isOpen: boolean;
    target: DeleteModalTarget | null;
}

// ============================================
// Hook Return Type
// ============================================

export interface UseSectionsTabReturn {
    // Data
    course: Course | null;
    isLoading: boolean;
    isTeamsLoading: boolean;
    
    // UI State
    sectionSubTab: SectionSubTab;
    sectionSearchQuery: string;
    selectedWeek: number;
    totalWeeks: number;
    expandedSections: number[];
    
    // Data Collections
    permanentTeams: PermanentTeam[];
    weeklyTeams: Record<number, WeeklyTeam[]>;
    sectionStudents: Record<number, SectionStudent[]>;
    removedStudents: RemovedSectionStudent[];
    studentsList: Student[];
    studentSearchResults: Student[];
    isStudentSearchLoading: boolean;
    
    // Computed
    totalStudents: number;
    
    // Modal States
    sectionModal: SectionModalState & {
        setIsOpen: (open: boolean) => void;
        setSectionNo: (no: string) => void;
        setNote: (note: string) => void;
        reset: () => void;
    };
    studentModal: StudentModalState & {
        setIsOpen: (open: boolean) => void;
        setSectionId: (id: number | null) => void;
        setStudentId: (id: string) => void;
        setSearchQuery: (query: string) => void;
        setMode: (mode: "single" | "bulk") => void;
        setPasteData: (data: string) => void;
        setParsedStudents: (students: StudentModalState["parsedStudents"]) => void;
        reset: () => void;
    };
    teamModal: TeamModalState & {
        setIsOpen: (open: boolean) => void;
        setType: (type: TeamType) => void;
        setFormationMethod: (method: TeamFormationMethod) => void;
        setName: (name: string) => void;
        setMembers: (members: number[]) => void;
        setSize: (size: number) => void;
        setMemberMode: (mode: "select" | "paste") => void;
        setIsParsing: (parsing: boolean) => void;
        setPasteData: (data: string) => void;
        setParsedMembers: (members: TeamModalState["parsedMembers"]) => void;
        reset: () => void;
    };
    editTeamModal: EditTeamModalState & {
        open: (team: EditTeamModalState["team"]) => void;
        setName: (name: string) => void;
        setMembers: (members: number[]) => void;
        reset: () => void;
    };
    deleteModal: DeleteModalState & {
        open: (type: DeleteModalTarget["type"], target: Omit<DeleteModalTarget, "type">) => void;
        reset: () => void;
        confirmInput: string;
        setConfirmInput: (value: string) => void;
    };
    editSectionModal: {
        isOpen: boolean;
        sectionId: number | null;
        sectionNo: string;
        note: string;
        setIsOpen: (open: boolean) => void;
        setSectionNo: (no: string) => void;
        setNote: (note: string) => void;
        reset: () => void;
    };
    bulkDeleteModal: {
        isOpen: boolean;
        setIsOpen: (open: boolean) => void;
    };
    restoreModal: {
        isOpen: boolean;
        target: RemovedSectionStudent | null;
        open: (removed: RemovedSectionStudent) => void;
        reset: () => void;
    };
    isSubmitting: boolean;
    
    // UI Handlers
    onSubTabChange: (tab: SectionSubTab) => void;
    onSearchQueryChange: (query: string) => void;
    onWeekChange: (week: number) => void;
    onToggleSection: (sectionId: number) => void;
    
    // CRUD Handlers
    handleAddSection: () => Promise<void>;
    handleRemoveSection: (sectionId: number) => void;
    confirmRemoveSection: () => Promise<void>;
    handleEditSection: () => Promise<void>;
    openEditSectionModal: (sectionId: number) => void;
    handleAddStudent: () => Promise<void>;
    handleBulkAddStudents: () => Promise<void>;
    handleRemoveStudent: () => Promise<void>;
    handleRestoreStudent: (removed: RemovedSectionStudent) => void;
    confirmRestoreStudent: () => Promise<void>;
    handleCreateTeam: () => Promise<void>;
    handleSaveEditedTeam: () => Promise<void>;
    handleDeleteTeam: () => Promise<void>;
    handleBulkDeleteTeams: () => Promise<void>;
    handleCopyTeamsFromWeek: (sourceWeek: number) => Promise<void>;
    
    // Modal Openers
    openAddStudentModal: (sectionId: number) => void;
    openDeleteStudentModal: (sectionId: number, student: SectionStudent) => void;
    openCreateTeamModal: (type: TeamType, method: TeamFormationMethod) => void;
    openEditTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    openDeleteTeamModal: (teamId: number, type: TeamType, weekNumber?: number) => void;
    openBulkDeleteModal: () => void;
    
    // Computed Functions
    getFilteredSectionStudents: (sectionId: number) => SectionStudent[];
    findStudentTeam: (studentId: number, type: TeamType, weekNumber?: number) => string | null;
    getUnassignedStudents: (type: TeamType, weekNumber?: number) => TeamMember[];
    getAvailableStudentsForEdit: () => TeamMember[];
    getAllEnrolledStudents: () => TeamMember[];
    
    // Utility
    parseExcelData: (pasteData: string) => Promise<void>;
    parseTeamExcelData: (pasteData: string) => Promise<void>;
    refreshTeams: (forceRefresh?: boolean) => Promise<void>;
}

// ============================================
// Main Hook
// ============================================

export function useSectionsTab(courseId: string): UseSectionsTabReturn {
    // Real-time sync
    const { emitDataUpdate, isConnected } = useSocket();
    const { language } = useGlobalSettings();
    const isEnglish = language === "en";
    
    // Cache
    const cache = useRef<{
        course?: CacheEntry<Course>;
        teams?: CacheEntry<{ permanent: PermanentTeam[]; weekly: Record<number, WeeklyTeam[]> }>;
    }>({});
    
    // ============================================
    // Core Data States
    // ============================================
    
    const [course, setCourse] = useState<Course | null>(null);
    const [permanentTeams, setPermanentTeams] = useState<PermanentTeam[]>([]);
    const [weeklyTeams, setWeeklyTeams] = useState<Record<number, WeeklyTeam[]>>({});
    const [sectionStudents, setSectionStudents] = useState<Record<number, SectionStudent[]>>({});
    const [removedStudents, setRemovedStudents] = useState<RemovedSectionStudent[]>([]);
    const [studentsList, setStudentsList] = useState<Student[]>([]);
    const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([]);
    
    // Loading States
    const [isLoading, setIsLoading] = useState(true);
    const [isTeamsLoading, setIsTeamsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStudentSearchLoading, setIsStudentSearchLoading] = useState(false);
    
    // ============================================
    // UI States
    // ============================================
    
    const [sectionSubTab, setSectionSubTab] = useState<SectionSubTab>("students");
    const [sectionSearchQuery, setSectionSearchQuery] = useState("");
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [expandedSections, setExpandedSections] = useState<number[]>([]);
    const totalWeeks = DEFAULT_TOTAL_WEEKS;
    
    // ============================================
    // Modal States
    // ============================================
    
    const [sectionModalState, setSectionModalState] = useState<SectionModalState>({
        isOpen: false,
        sectionNo: "",
        note: "",
    });
    
    const [studentModalState, setStudentModalState] = useState<StudentModalState>({
        isOpen: false,
        sectionId: null,
        studentId: "",
        searchQuery: "",
        mode: "single",
        pasteData: "",
        parsedStudents: [],
    });
    
    const [teamModalState, setTeamModalState] = useState<TeamModalState>({
        isOpen: false,
        type: "permanent",
        formationMethod: "manual",
        name: "",
        members: [],
        size: 3,
        memberMode: "select",
        isParsing: false,
        pasteData: "",
        parsedMembers: [],
    });
    
    const [editTeamModalState, setEditTeamModalState] = useState<EditTeamModalState>({
        isOpen: false,
        team: null,
        name: "",
        members: [],
    });
    
    const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>({
        isOpen: false,
        target: null,
    });
    
    // Delete confirmation input
    const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
    
    // Edit section modal state
    const [editSectionModalState, setEditSectionModalState] = useState<{
        isOpen: boolean;
        sectionId: number | null;
        sectionNo: string;
        note: string;
    }>({
        isOpen: false,
        sectionId: null,
        sectionNo: "",
        note: "",
    });
    
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
    
    // Restore confirm modal state
    const [restoreModalState, setRestoreModalState] = useState<{
        isOpen: boolean;
        target: RemovedSectionStudent | null;
    }>({ isOpen: false, target: null });
    
    // ============================================
    // Cache Helpers
    // ============================================
    
    const isCacheValid = useCallback(<T,>(entry?: CacheEntry<T>): boolean => {
        if (!entry) return false;
        return Date.now() - entry.timestamp < CACHE_DURATION;
    }, []);
    
    const emitUpdate = useCallback((resource: ResourceType, action: ActionType, id?: string | number) => {
        if (isConnected) {
            emitDataUpdate(resource, action, id);
        }
    }, [isConnected, emitDataUpdate]);
    
    // ============================================
    // Data Fetching
    // ============================================
    
    const fetchCourse = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid(cache.current.course)) {
            setCourse(cache.current.course!.data);
            return;
        }
        
        setIsLoading(true);
        try {
            const response = await courseService.getCourseById(courseId);
            if (response.success && response.data) {
                cache.current.course = { data: response.data, timestamp: Date.now() };
                setCourse(response.data);
            }
        } catch (error) {
            console.error("Error fetching course:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: isEnglish ? "Unable to load course data." : "ไม่สามารถโหลดข้อมูลรายวิชาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [courseId, isCacheValid, isEnglish]);
    
    const fetchTeams = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid(cache.current.teams)) {
            const cachedTeams = cache.current.teams!.data;
            setPermanentTeams(localizePermanentTeams(cachedTeams.permanent, isEnglish));
            setWeeklyTeams(localizeWeeklyTeams(cachedTeams.weekly, isEnglish));
            return;
        }
        
        setIsTeamsLoading(true);
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
                    weekly[parseInt(week)].sort(naturalSortTeams);
                });
            }
            
            cache.current.teams = { data: { permanent, weekly }, timestamp: Date.now() };
            setPermanentTeams(localizePermanentTeams(permanent, isEnglish));
            setWeeklyTeams(localizeWeeklyTeams(weekly, isEnglish));
        } catch (error) {
            console.error("Error fetching teams:", error);
        } finally {
            setIsTeamsLoading(false);
        }
    }, [courseId, isCacheValid, isEnglish]);

    useEffect(() => {
        if (!cache.current.teams) {
            return;
        }

        const cachedTeams = cache.current.teams.data;
        setPermanentTeams(localizePermanentTeams(cachedTeams.permanent, isEnglish));
        setWeeklyTeams(localizeWeeklyTeams(cachedTeams.weekly, isEnglish));
    }, [isEnglish]);
    
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
    
    const fetchAllSectionStudents = useCallback(async () => {
        if (!course?.sections) return;
        
        const results = await Promise.all(
            course.sections.map(async section => {
                const response = await courseService.getSectionStudents(courseId, section.id);
                return { sectionId: section.id, students: response.data || [] };
            })
        );
        
        const newSectionStudents: Record<number, SectionStudent[]> = {};
        results.forEach(r => {
            newSectionStudents[r.sectionId] = r.students;
        });
        setSectionStudents(newSectionStudents);
    }, [course?.sections, courseId]);
    
    const fetchStudentsList = useCallback(async () => {
        try {
            const response = await studentService.getStudents({ limit: 1000, status: "active" });
            if (response.success && response.data) {
                setStudentsList(response.data.students);
            }
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    }, []);

    const fetchRemovedStudents = useCallback(async () => {
        try {
            const response = await courseService.getRemovedStudents(courseId);
            if (response.success && response.data) {
                setRemovedStudents(response.data);
            }
        } catch (error) {
            console.error("Error fetching removed students:", error);
        }
    }, [courseId]);
    
    // ============================================
    // Initialize Data
    // ============================================
    
    useEffect(() => {
        const initializeData = async () => {
            await Promise.all([
                fetchCourse(),
                fetchTeams(),
                fetchStudentsList(),
                fetchRemovedStudents(),
            ]);
        };
        initializeData();
    }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // Fetch section students when course loads
    useEffect(() => {
        if (course?.sections && course.sections.length > 0) {
            fetchAllSectionStudents();
        }
    }, [course?.sections, fetchAllSectionStudents]);

    useEffect(() => {
        const query = studentModalState.searchQuery.trim();

        if (
            !studentModalState.isOpen ||
            studentModalState.mode !== "single" ||
            query.length < STUDENT_SEARCH_MIN_QUERY_LENGTH
        ) {
            setStudentSearchResults([]);
            setIsStudentSearchLoading(false);
            return;
        }

        let isActive = true;
        setIsStudentSearchLoading(true);

        const timeoutId = window.setTimeout(async () => {
            try {
                const response = await studentService.getStudents({
                    limit: 20,
                    search: query,
                    status: "active",
                    sortBy: "student_id",
                    sortOrder: "ASC",
                });

                if (!isActive) {
                    return;
                }

                if (response.success && response.data) {
                    setStudentSearchResults(response.data.students);
                } else {
                    setStudentSearchResults([]);
                }
            } catch (error) {
                if (isActive) {
                    console.error("Error searching students:", error);
                    setStudentSearchResults([]);
                }
            } finally {
                if (isActive) {
                    setIsStudentSearchLoading(false);
                }
            }
        }, STUDENT_SEARCH_DEBOUNCE_MS);

        return () => {
            isActive = false;
            window.clearTimeout(timeoutId);
        };
    }, [studentModalState.isOpen, studentModalState.mode, studentModalState.searchQuery]);
    
    // ============================================
    // Computed Values
    // ============================================
    
    const totalStudents = useMemo(
        () => Object.values(sectionStudents).reduce((acc, students) => acc + students.length, 0),
        [sectionStudents]
    );
    
    const getAllEnrolledStudents = useCallback((): TeamMember[] => {
        const students: TeamMember[] = [];
        Object.values(sectionStudents).forEach(sectionList => {
            sectionList.forEach(s => {
                if (!students.some(existing => existing.id === s.id)) {
                    students.push({
                        id: s.id,
                        student_id: s.student_id,
                        full_name: s.full_name,
                    });
                }
            });
        });
        return students;
    }, [sectionStudents]);
    
    const getFilteredSectionStudents = useCallback((sectionId: number) => {
        const students = sectionStudents[sectionId] || [];
        return filterStudentsByQuery(students, sectionSearchQuery);
    }, [sectionStudents, sectionSearchQuery]);
    
    const findStudentTeam = useCallback((
        studentId: number,
        type: TeamType,
        weekNumber?: number
    ): string | null => {
        if (type === "permanent") {
            const team = permanentTeams.find(t => t.members.some(m => m.id === studentId));
            return team?.name || null;
        } else if (weekNumber !== undefined && weeklyTeams[weekNumber]) {
            const team = weeklyTeams[weekNumber].find(t => t.members.some(m => m.id === studentId));
            return team?.name || null;
        }
        return null;
    }, [permanentTeams, weeklyTeams]);
    
    const getUnassignedStudents = useCallback((
        type: TeamType,
        weekNumber?: number
    ): TeamMember[] => {
        const allStudents = getAllEnrolledStudents();
        const assignedIds = new Set<number>();
        
        if (type === "permanent") {
            permanentTeams.forEach(team => {
                team.members.forEach(m => assignedIds.add(m.id));
            });
        } else if (weekNumber !== undefined && weeklyTeams[weekNumber]) {
            weeklyTeams[weekNumber].forEach(team => {
                team.members.forEach(m => assignedIds.add(m.id));
            });
        }
        
        return allStudents.filter(s => !assignedIds.has(s.id));
    }, [getAllEnrolledStudents, permanentTeams, weeklyTeams]);
    
    const getAvailableStudentsForEdit = useCallback(() => {
        const editTeam = editTeamModalState.team;
        if (!editTeam) return [];
        
        const allStudents = getAllEnrolledStudents();
        const currentMemberIds = new Set(editTeamModalState.members);
        const otherTeamMemberIds = new Set<number>();
        
        if (editTeam.type === "permanent") {
            permanentTeams.forEach(team => {
                if (team.id !== editTeam.id) {
                    team.members.forEach(m => otherTeamMemberIds.add(m.id));
                }
            });
        } else if (editTeam.weekNumber !== undefined) {
            const weekTeams = weeklyTeams[editTeam.weekNumber] || [];
            weekTeams.forEach(team => {
                if (team.id !== editTeam.id) {
                    team.members.forEach(m => otherTeamMemberIds.add(m.id));
                }
            });
        }
        
        return allStudents.filter(s => 
            currentMemberIds.has(s.id) || !otherTeamMemberIds.has(s.id)
        );
    }, [editTeamModalState.team, editTeamModalState.members, getAllEnrolledStudents, permanentTeams, weeklyTeams]);
    
    // ============================================
    // UI Handlers
    // ============================================
    
    const onSubTabChange = useCallback((tab: SectionSubTab) => {
        setSectionSubTab(tab);
    }, []);
    
    const onSearchQueryChange = useCallback((query: string) => {
        setSectionSearchQuery(query);
    }, []);
    
    const onWeekChange = useCallback((week: number) => {
        setSelectedWeek(week);
    }, []);
    
    const onToggleSection = useCallback((sectionId: number) => {
        if (expandedSections.includes(sectionId)) {
            setExpandedSections(expandedSections.filter(id => id !== sectionId));
        } else {
            setExpandedSections([...expandedSections, sectionId]);
            if (!sectionStudents[sectionId]) {
                fetchSectionStudents(sectionId);
            }
        }
    }, [expandedSections, sectionStudents, fetchSectionStudents]);
    
    // ============================================
    // Modal Handlers
    // ============================================
    
    const sectionModal = useMemo(() => ({
        ...sectionModalState,
        setIsOpen: (open: boolean) => setSectionModalState(prev => ({ ...prev, isOpen: open })),
        setSectionNo: (no: string) => setSectionModalState(prev => ({ ...prev, sectionNo: no })),
        setNote: (note: string) => setSectionModalState(prev => ({ ...prev, note })),
        reset: () => setSectionModalState({ isOpen: false, sectionNo: "", note: "" }),
    }), [sectionModalState]);
    
    const studentModal = useMemo(() => ({
        ...studentModalState,
        setIsOpen: (open: boolean) => setStudentModalState(prev => ({ ...prev, isOpen: open })),
        setSectionId: (id: number | null) => setStudentModalState(prev => ({ ...prev, sectionId: id })),
        setStudentId: (id: string) => setStudentModalState(prev => ({ ...prev, studentId: id })),
        setSearchQuery: (query: string) => setStudentModalState(prev => ({ ...prev, searchQuery: query })),
        setMode: (mode: "single" | "bulk") => setStudentModalState(prev => ({ ...prev, mode })),
        setPasteData: (data: string) => setStudentModalState(prev => ({ ...prev, pasteData: data })),
        setParsedStudents: (students: StudentModalState["parsedStudents"]) => 
            setStudentModalState(prev => ({ ...prev, parsedStudents: students })),
        reset: () => setStudentModalState({
            isOpen: false, sectionId: null, studentId: "", searchQuery: "",
            mode: "single", pasteData: "", parsedStudents: [],
        }),
    }), [studentModalState]);
    
    const teamModal = useMemo(() => ({
        ...teamModalState,
        setIsOpen: (open: boolean) => setTeamModalState(prev => ({ ...prev, isOpen: open })),
        setType: (type: TeamType) => setTeamModalState(prev => ({ ...prev, type })),
        setFormationMethod: (method: TeamFormationMethod) => setTeamModalState(prev => ({ ...prev, formationMethod: method })),
        setName: (name: string) => setTeamModalState(prev => ({ ...prev, name })),
        setMembers: (members: number[]) => setTeamModalState(prev => ({ ...prev, members })),
        setSize: (size: number) => setTeamModalState(prev => ({ ...prev, size })),
        setMemberMode: (mode: "select" | "paste") => setTeamModalState(prev => ({ ...prev, memberMode: mode })),
        setIsParsing: (parsing: boolean) => setTeamModalState(prev => ({ ...prev, isParsing: parsing })),
        setPasteData: (data: string) => setTeamModalState(prev => ({ ...prev, pasteData: data })),
        setParsedMembers: (members: TeamModalState["parsedMembers"]) => 
            setTeamModalState(prev => ({ ...prev, parsedMembers: members })),
        reset: () => setTeamModalState({
            isOpen: false, type: "permanent", formationMethod: "manual",
            name: "", members: [], size: 3, memberMode: "select", isParsing: false, pasteData: "", parsedMembers: [],
        }),
    }), [teamModalState]);
    
    const editTeamModal = useMemo(() => ({
        ...editTeamModalState,
        open: (team: EditTeamModalState["team"]) => {
            if (team) {
                setEditTeamModalState({
                    isOpen: true,
                    team,
                    name: team.name,
                    members: team.members.map(m => m.id),
                });
            }
        },
        setName: (name: string) => setEditTeamModalState(prev => ({ ...prev, name })),
        setMembers: (members: number[]) => setEditTeamModalState(prev => ({ ...prev, members })),
        reset: () => setEditTeamModalState({ isOpen: false, team: null, name: "", members: [] }),
    }), [editTeamModalState]);
    
    const deleteModal = useMemo(() => ({
        ...deleteModalState,
        open: (type: DeleteModalTarget["type"], target: Omit<DeleteModalTarget, "type">) => {
            setDeleteModalState({ isOpen: true, target: { type, ...target } });
            setDeleteConfirmInput(""); // Reset confirm input when opening
        },
        reset: () => {
            setDeleteModalState({ isOpen: false, target: null });
            setDeleteConfirmInput(""); // Reset confirm input when closing
        },
        confirmInput: deleteConfirmInput,
        setConfirmInput: setDeleteConfirmInput,
    }), [deleteModalState, deleteConfirmInput]);
    
    const bulkDeleteModal = useMemo(() => ({
        isOpen: bulkDeleteModalOpen,
        setIsOpen: setBulkDeleteModalOpen,
    }), [bulkDeleteModalOpen]);

    const restoreModal = useMemo(() => ({
        isOpen: restoreModalState.isOpen,
        target: restoreModalState.target,
        open: (removed: RemovedSectionStudent) => setRestoreModalState({ isOpen: true, target: removed }),
        reset: () => setRestoreModalState({ isOpen: false, target: null }),
    }), [restoreModalState]);
    
    // ============================================
    // CRUD Actions
    // ============================================
    
    const handleAddSection = useCallback(async () => {
        if (!sectionModalState.sectionNo.trim()) {
            addToast({
                title: isEnglish ? "Incomplete information" : "ข้อมูลไม่ครบ",
                description: isEnglish ? "Please enter a section number." : "กรุณากรอกหมายเลขกลุ่มเรียน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const response = await courseService.addSection(courseId, {
                section_no: sectionModalState.sectionNo,
                note: sectionModalState.note || undefined,
            });
            
            if (response.success && response.data) {
                const newSection = response.data;
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: [...(prev.sections || []), {
                            id: newSection.id,
                            course_id: courseId,
                            section_no: newSection.section_no,
                            note: newSection.note,
                            created_at: newSection.created_at,
                            studentCount: 0
                        }]
                    };
                });
                
                cache.current.course = undefined; // Invalidate cache
                
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Added the section successfully." : "เพิ่มกลุ่มเรียนสำเร็จ",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("section", "create", newSection.id);
                sectionModal.reset();
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to add the section.", "ไม่สามารถเพิ่มกลุ่มเรียนได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, sectionModalState.sectionNo, sectionModalState.note, sectionModal, emitUpdate, isEnglish]);
    
    const handleRemoveSection = useCallback((sectionId: number) => {
        const section = course?.sections?.find(s => s.id === sectionId);
        if (!section) return;
        
        deleteModal.open("section", {
            sectionId,
            sectionNo: section.section_no,
            sectionStudentCount: sectionStudents[sectionId]?.length || 0,
        });
    }, [course?.sections, deleteModal, sectionStudents]);
    
    const confirmRemoveSection = useCallback(async () => {
        const target = deleteModalState.target;
        if (!target?.sectionId) return;
        
        setIsSubmitting(true);
        try {
            const response = await courseService.removeSection(courseId, target.sectionId);
            if (response.success) {
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: prev.sections?.filter(s => s.id !== target.sectionId) || []
                    };
                });
                
                setSectionStudents(prev => {
                    const newState = { ...prev };
                    delete newState[target.sectionId!];
                    return newState;
                });
                
                cache.current.course = undefined;
                
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Deleted the section successfully." : "ลบกลุ่มเรียนเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("section", "delete", target.sectionId);
                deleteModal.reset();
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to delete the section.", "ไม่สามารถลบกลุ่มเรียนได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, deleteModalState.target, deleteModal, emitUpdate, isEnglish]);
    
    // Open edit section modal
    const openEditSectionModal = useCallback((sectionId: number) => {
        const section = course?.sections?.find(s => s.id === sectionId);
        if (!section) return;
        
        setEditSectionModalState({
            isOpen: true,
            sectionId,
            sectionNo: section.section_no,
            note: section.note || "",
        });
    }, [course?.sections]);
    
    // Handle edit section
    const handleEditSection = useCallback(async () => {
        if (!editSectionModalState.sectionId || !editSectionModalState.sectionNo.trim()) {
            addToast({
                title: isEnglish ? "Incomplete information" : "ข้อมูลไม่ครบ",
                description: isEnglish ? "Please enter a section number." : "กรุณากรอกหมายเลขกลุ่มเรียน",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        
        // Check for duplicate section number
        const isDuplicate = course?.sections?.some(
            s => s.id !== editSectionModalState.sectionId && 
                 s.section_no === editSectionModalState.sectionNo.trim()
        );
        
        if (isDuplicate) {
            addToast({
                title: isEnglish ? "Duplicate section number" : "หมายเลขซ้ำ",
                description: isEnglish
                    ? `Section ${editSectionModalState.sectionNo} already exists.`
                    : `หมายเลขกลุ่มเรียน ${editSectionModalState.sectionNo} มีอยู่แล้ว`,
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const response = await courseService.updateSection(
                courseId, 
                editSectionModalState.sectionId,
                {
                    section_no: editSectionModalState.sectionNo.trim(),
                    note: editSectionModalState.note || undefined,
                }
            );
            
            if (response.success) {
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: prev.sections?.map(s => 
                            s.id === editSectionModalState.sectionId
                                ? { ...s, section_no: editSectionModalState.sectionNo.trim(), note: editSectionModalState.note || null }
                                : s
                        ) || []
                    };
                });
                
                cache.current.course = undefined;
                
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Updated the section successfully." : "แก้ไขกลุ่มเรียนสำเร็จ",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("section", "update", editSectionModalState.sectionId);
                editSectionModal.reset();
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to update the section.", "ไม่สามารถแก้ไขกลุ่มเรียนได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, editSectionModalState, course?.sections, emitUpdate, isEnglish]);
    
    // Edit section modal helpers
    const editSectionModal = useMemo(() => ({
        isOpen: editSectionModalState.isOpen,
        sectionId: editSectionModalState.sectionId,
        sectionNo: editSectionModalState.sectionNo,
        note: editSectionModalState.note,
        setIsOpen: (open: boolean) => setEditSectionModalState(prev => ({ ...prev, isOpen: open })),
        setSectionNo: (no: string) => setEditSectionModalState(prev => ({ ...prev, sectionNo: no })),
        setNote: (note: string) => setEditSectionModalState(prev => ({ ...prev, note })),
        reset: () => setEditSectionModalState({ isOpen: false, sectionId: null, sectionNo: "", note: "" }),
    }), [editSectionModalState]);

    const handleAddStudent = useCallback(async () => {
        if (!studentModalState.sectionId || !studentModalState.studentId) {
            addToast({
                title: isEnglish ? "Incomplete information" : "ข้อมูลไม่ครบ",
                description: isEnglish ? "Please select a student." : "กรุณาเลือกนักศึกษา",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const response = await courseService.addStudentToSection(
                courseId,
                studentModalState.sectionId,
                parseInt(studentModalState.studentId)
            );
            
            if (response.success) {
                const studentId = parseInt(studentModalState.studentId);
                const student =
                    studentSearchResults.find(s => s.id === studentId) ||
                    studentsList.find(s => s.id === studentId);

                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: prev.sections?.map(s =>
                            s.id === studentModalState.sectionId
                                ? { ...s, studentCount: (s.studentCount || 0) + 1 }
                                : s
                        ) || []
                    };
                });

                if (student) {
                    setSectionStudents(prev => ({
                        ...prev,
                        [studentModalState.sectionId!]: [...(prev[studentModalState.sectionId!] || []), {
                            id: student.id,
                            student_id: student.student_id,
                            full_name: student.full_name,
                            email: student.email || null,
                            is_active: student.is_active,
                            enrolled_at: new Date().toISOString(),
                        }]
                    }));
                }
                
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Added the student successfully." : "เพิ่มนักศึกษาเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("student", "create", studentModalState.studentId);
                studentModal.reset();
            } else {
                const errObj = response.error as unknown;
                const errMsg =
                    (typeof errObj === "object" && errObj !== null && "message" in errObj
                        ? (errObj as { message: string }).message
                        : null) ||
                    response.message ||
                    "ไม่สามารถเพิ่มนักศึกษาได้";
                addToast({
                    title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                    description: getLocalizedErrorMessage(isEnglish, "Unable to add the student.", "ไม่สามารถเพิ่มนักศึกษาได้", errMsg),
                    color: "danger",
                    timeout: 5000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to add the student.", "ไม่สามารถเพิ่มนักศึกษาได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, studentModalState.sectionId, studentModalState.studentId, studentSearchResults, studentsList, studentModal, emitUpdate, isEnglish]);
    
    const handleBulkAddStudents = useCallback(async () => {
        const studentsToAdd = studentModalState.parsedStudents
            .filter(p => p.status === "matched" && p.matchedStudent)
            .map(p => p.matchedStudent!.id);
        
        if (studentsToAdd.length === 0 || !studentModalState.sectionId) return;
        
        setIsSubmitting(true);
        try {
            const response = await courseService.bulkAddStudentsToSection(
                courseId,
                studentModalState.sectionId,
                studentsToAdd
            );
            
            if (response.success) {
                await fetchAllSectionStudents();
                await fetchCourse(true);
                
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish
                        ? `Added ${studentsToAdd.length} students successfully.`
                        : `เพิ่มนักศึกษา ${studentsToAdd.length} คนเรียบร้อย`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("student", "bulk");
                studentModal.reset();
            } else {
                const errObj = response.error as unknown;
                const errMsg =
                    (typeof errObj === "object" && errObj !== null && "message" in errObj
                        ? (errObj as { message: string }).message
                        : null) ||
                    response.message ||
                    "ไม่สามารถเพิ่มนักศึกษาได้";
                addToast({
                    title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                    description: getLocalizedErrorMessage(isEnglish, "Unable to add the students.", "ไม่สามารถเพิ่มนักศึกษาได้", errMsg),
                    color: "danger",
                    timeout: 5000,
                    shouldShowTimeoutProgress: true,
                });
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to add the students.", "ไม่สามารถเพิ่มนักศึกษาได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, studentModalState.sectionId, studentModalState.parsedStudents, fetchAllSectionStudents, fetchCourse, studentModal, emitUpdate, isEnglish]);
    
    
    const handleRemoveStudent = useCallback(async () => {
        const target = deleteModalState.target;
        if (!target?.sectionId || !target?.studentId) return;
        
        setIsSubmitting(true);
        try {
            const response = await courseService.removeStudentFromSection(
                courseId,
                target.sectionId,
                target.studentId
            );
            
            if (response.success) {
                setSectionStudents(prev => ({
                    ...prev,
                    [target.sectionId!]: (prev[target.sectionId!] || []).filter(s => s.id !== target.studentId)
                }));
                
                setCourse(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        sections: prev.sections?.map(s => 
                            s.id === target.sectionId
                                ? { ...s, studentCount: Math.max(0, (s.studentCount || 0) - 1) }
                                : s
                        ) || []
                    };
                });
                
                // Remove from teams as well
                setPermanentTeams(prev => prev.map(team => ({
                    ...team,
                    members: team.members.filter(m => m.id !== target.studentId)
                })));
                
                setWeeklyTeams(prev => {
                    const newWeekly = { ...prev };
                    Object.keys(newWeekly).forEach(week => {
                        newWeekly[parseInt(week)] = newWeekly[parseInt(week)].map(team => ({
                            ...team,
                            members: team.members.filter(m => m.id !== target.studentId)
                        }));
                    });
                    return newWeekly;
                });
                
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish
                        ? "Removed the student from the section. You can restore this action within 10 days."
                        : "นำนักศึกษาออกเรียบร้อย (กู้คืนได้ภายใน 10 วัน)",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                
                emitUpdate("student", "delete", target.studentId);
                deleteModal.reset();
                fetchRemovedStudents();
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to remove the student.", "ไม่สามารถนำนักศึกษาออกได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, deleteModalState.target, deleteModal, emitUpdate, fetchRemovedStudents, isEnglish]);

    const handleRestoreStudent = useCallback((removed: RemovedSectionStudent) => {
        setRestoreModalState({ isOpen: true, target: removed });
    }, []);

    const confirmRestoreStudent = useCallback(async () => {
        const removed = restoreModalState.target;
        if (!removed) return;
        setIsSubmitting(true);
        try {
            const response = await courseService.restoreStudentToSection(
                courseId,
                removed.section_id,
                removed.student_ref_id
            );

            if (!response.success) {
                const errObj = response.error as unknown;
                const errMsg =
                    (typeof errObj === "object" && errObj !== null && "message" in errObj
                        ? (errObj as { message: string }).message
                        : null) ||
                    response.message ||
                    "ไม่สามารถกู้คืนนักศึกษาได้";

                addToast({
                    title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                    description: getLocalizedErrorMessage(isEnglish, "Unable to restore the student.", "ไม่สามารถกู้คืนนักศึกษาได้", errMsg),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
                return;
            }

            setRestoreModalState({ isOpen: false, target: null });
            await Promise.all([fetchCourse(true), fetchAllSectionStudents(), fetchTeams(true), fetchRemovedStudents()]);

            addToast({
                title: isEnglish ? "Success" : "สำเร็จ",
                description: isEnglish
                    ? `Restored ${removed.full_name} successfully.`
                    : `กู้คืน ${removed.full_name} สำเร็จ`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });

            emitUpdate("student", "update", removed.student_ref_id);
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to restore the student.", "ไม่สามารถกู้คืนนักศึกษาได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [restoreModalState.target, courseId, fetchAllSectionStudents, fetchCourse, fetchRemovedStudents, fetchTeams, emitUpdate, isEnglish]);
    
    const handleCreateTeam = useCallback(async () => {
        setIsSubmitting(true);
        
        if (teamModalState.formationMethod === "manual") {
            if (!teamModalState.name.trim()) {
                addToast({
                    title: isEnglish ? "Incomplete information" : "ข้อมูลไม่ครบ",
                    description: isEnglish ? "Please enter a team name." : "กรุณากรอกชื่อกลุ่ม",
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsSubmitting(false);
                return;
            }
            
            if (teamModalState.members.length === 0) {
                addToast({
                    title: isEnglish ? "Incomplete information" : "ข้อมูลไม่ครบ",
                    description: isEnglish ? "Please select at least one member." : "กรุณาเลือกสมาชิกอย่างน้อย 1 คน",
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                setIsSubmitting(false);
                return;
            }
            
            try {
                const response = await courseService.createTeam(courseId, {
                    name: teamModalState.name,
                    group_type: teamModalState.type === "permanent" ? "permanent" : "temporary",
                    member_ids: teamModalState.members,
                    week_number: teamModalState.type === "weekly" ? selectedWeek : undefined,
                });
                
                if (response.success) {
                    await fetchTeams(true);
                    addToast({
                        title: isEnglish ? "Success" : "สำเร็จ",
                        description: isEnglish
                            ? `Created team "${teamModalState.name}" successfully.`
                            : `สร้างกลุ่ม "${teamModalState.name}" เรียบร้อย`,
                        color: "success",
                        timeout: 3000,
                shouldShowTimeoutProgress: true,
                    });
                    emitUpdate("group", "create");
                    teamModal.reset();
                }
            } catch (error: unknown) {
                const err = error as { message?: string };
                addToast({
                    title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                    description: getLocalizedErrorMessage(isEnglish, "Unable to create the team.", "ไม่สามารถสร้างกลุ่มได้", err.message),
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } else if (teamModalState.formationMethod === "random") {
            // Random team creation
            const unassigned = getUnassignedStudents(
                teamModalState.type,
                teamModalState.type === "weekly" ? selectedWeek : undefined
            );
            
            const shuffled = [...unassigned].sort(() => Math.random() - 0.5);
            const teams: TeamMember[][] = [];
            for (let i = 0; i < shuffled.length; i += teamModalState.size) {
                teams.push(shuffled.slice(i, i + teamModalState.size));
            }
            
            const baseName = isEnglish ? "Team" : "กลุ่มที่";
            let successCount = 0;
            
            for (let i = 0; i < teams.length; i++) {
                const teamName = `${baseName} ${i + 1}`;
                const memberIds = teams[i].map(m => m.id);
                
                try {
                    const response = await courseService.createTeam(courseId, {
                        name: teamName,
                        group_type: teamModalState.type === "permanent" ? "permanent" : "temporary",
                        member_ids: memberIds,
                        week_number: teamModalState.type === "weekly" ? selectedWeek : undefined,
                    });
                    if (response.success) successCount++;
                } catch (error) {
                    console.error(`Error creating team ${teamName}:`, error);
                }
            }
            
            await fetchTeams(true);
            
            if (successCount > 0) {
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish
                        ? `Created ${successCount} random teams successfully.`
                        : `สร้างกลุ่มแบบสุ่ม ${successCount} กลุ่มเรียบร้อย`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                emitUpdate("group", "bulk");
            }
            
            teamModal.reset();
        }
        
        setIsSubmitting(false);
    }, [courseId, teamModalState, selectedWeek, getUnassignedStudents, fetchTeams, teamModal, emitUpdate, isEnglish]);
    
    const handleSaveEditedTeam = useCallback(async () => {
        if (!editTeamModalState.team) return;
        
        setIsSubmitting(true);
        try {
            const response = await courseService.updateTeam(courseId, editTeamModalState.team.id, {
                name: editTeamModalState.name,
                member_ids: editTeamModalState.members,
            });
            
            if (response.success) {
                await fetchTeams(true);
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Updated the team successfully." : "แก้ไขกลุ่มเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                emitUpdate("group", "update", editTeamModalState.team.id);
                editTeamModal.reset();
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to update the team.", "ไม่สามารถแก้ไขกลุ่มได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, editTeamModalState.team, editTeamModalState.name, editTeamModalState.members, fetchTeams, editTeamModal, emitUpdate, isEnglish]);
    
    const handleDeleteTeam = useCallback(async () => {
        const target = deleteModalState.target;
        if (!target?.teamId) return;
        
        setIsSubmitting(true);
        try {
            const response = await courseService.deleteTeam(courseId, target.teamId);
            if (response.success) {
                await fetchTeams(true);
                addToast({
                    title: isEnglish ? "Success" : "สำเร็จ",
                    description: isEnglish ? "Deleted the team successfully." : "ลบกลุ่มเรียบร้อย",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                emitUpdate("group", "delete", target.teamId);
                deleteModal.reset();
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: getLocalizedErrorMessage(isEnglish, "Unable to delete the team.", "ไม่สามารถลบกลุ่มได้", err.message),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [courseId, deleteModalState.target, fetchTeams, deleteModal, emitUpdate, isEnglish]);
    
    const handleBulkDeleteTeams = useCallback(async () => {
        const teamsToDelete = weeklyTeams[selectedWeek] || [];
        if (teamsToDelete.length === 0) return;
        
        setIsSubmitting(true);
        let successCount = 0;
        
        for (const team of teamsToDelete) {
            try {
                const response = await courseService.deleteTeam(courseId, team.id);
                if (response.success) successCount++;
            } catch (error) {
                console.error(`Error deleting team ${team.id}:`, error);
            }
        }
        
        await fetchTeams(true);
        
        if (successCount > 0) {
            addToast({
                title: isEnglish ? "Success" : "สำเร็จ",
                description: isEnglish
                    ? `Deleted ${successCount} teams successfully.`
                    : `ลบกลุ่ม ${successCount} กลุ่มเรียบร้อย`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            emitUpdate("group", "bulk");
        }
        
        setBulkDeleteModalOpen(false);
        setIsSubmitting(false);
    }, [courseId, selectedWeek, weeklyTeams, fetchTeams, emitUpdate, isEnglish]);
    
    const handleCopyTeamsFromWeek = useCallback(async (sourceWeek: number) => {
        const sourceTeams = weeklyTeams[sourceWeek];
        if (!sourceTeams || sourceTeams.length === 0) {
            addToast({
                title: isEnglish ? "No teams found" : "ไม่พบกลุ่ม",
                description: isEnglish
                    ? `No teams were found in week ${sourceWeek}.`
                    : `ไม่พบกลุ่มในสัปดาห์ที่ ${sourceWeek}`,
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        
        setIsSubmitting(true);
        let successCount = 0;
        
        for (const team of sourceTeams) {
            try {
                const response = await courseService.createTeam(courseId, {
                    name: team.name,
                    group_type: "temporary",
                    member_ids: team.members.map(m => m.id),
                    week_number: selectedWeek,
                });
                if (response.success) successCount++;
            } catch (error) {
                console.error(`Error copying team ${team.name}:`, error);
            }
        }
        
        await fetchTeams(true);
        
        if (successCount > 0) {
            addToast({
                title: isEnglish ? "Success" : "สำเร็จ",
                description: isEnglish
                    ? `Copied ${successCount} teams successfully.`
                    : `คัดลอก ${successCount} กลุ่มเรียบร้อย`,
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            emitUpdate("group", "bulk");
        }
        
        setIsSubmitting(false);
    }, [courseId, selectedWeek, weeklyTeams, fetchTeams, emitUpdate, isEnglish]);
    
    // ============================================
    // Modal Openers
    // ============================================
    
    const openAddStudentModal = useCallback((sectionId: number) => {
        studentModal.setSectionId(sectionId);
        studentModal.setStudentId("");
        studentModal.setSearchQuery("");
        studentModal.setIsOpen(true);
    }, [studentModal]);
    
    const openDeleteStudentModal = useCallback((sectionId: number, student: SectionStudent) => {
        const section = course?.sections?.find(s => s.id === sectionId);
        deleteModal.open("student", {
            studentId: student.id,
            studentName: student.full_name,
            studentCode: student.student_id,
            sectionId,
            sectionNo: section?.section_no,
        });
    }, [course?.sections, deleteModal]);
    
    const openCreateTeamModal = useCallback((type: TeamType, method: TeamFormationMethod) => {
        teamModal.setType(type);
        teamModal.setFormationMethod(method);
        teamModal.setIsOpen(true);
    }, [teamModal]);
    
    const openEditTeamModal = useCallback((teamId: number, type: TeamType, weekNumber?: number) => {
        let team: PermanentTeam | WeeklyTeam | undefined;
        if (type === "permanent") {
            team = permanentTeams.find(t => t.id === teamId);
        } else if (weekNumber !== undefined) {
            team = weeklyTeams[weekNumber]?.find(t => t.id === teamId);
        }
        if (team) {
            editTeamModal.open({
                id: team.id,
                name: team.name,
                type,
                weekNumber,
                members: team.members,
            });
        }
    }, [permanentTeams, weeklyTeams, editTeamModal]);
    
    const openDeleteTeamModal = useCallback((teamId: number, type: TeamType, weekNumber?: number) => {
        let team: PermanentTeam | WeeklyTeam | undefined;
        if (type === "permanent") {
            team = permanentTeams.find(t => t.id === teamId);
        } else if (weekNumber !== undefined) {
            team = weeklyTeams[weekNumber]?.find(t => t.id === teamId);
        }
        if (team) {
            deleteModal.open("team", {
                teamId: team.id,
                teamName: team.name,
                teamType: type,
                weekNumber,
                teamMembers: team.members,
            });
        }
    }, [permanentTeams, weeklyTeams, deleteModal]);
    
    const openBulkDeleteModal = useCallback(() => {
        const teamsToDelete = weeklyTeams[selectedWeek];
        if (!teamsToDelete || teamsToDelete.length === 0) {
            addToast({
                title: isEnglish ? "No teams to delete" : "ไม่มีกลุ่มที่จะลบ",
                description: isEnglish ? "No teams were found in the selected week." : "ไม่พบกลุ่มในสัปดาห์ที่เลือก",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }
        setBulkDeleteModalOpen(true);
    }, [selectedWeek, weeklyTeams, isEnglish]);
    
    // ============================================
    // Excel Parsing
    // ============================================
    
    const parseExcelData = useCallback(async (pasteData: string) => {
        if (!pasteData.trim() || !studentModalState.sectionId) {
            studentModal.setParsedStudents([]);
            return;
        }
        
        const lines = pasteData
            .split(/[\n\r]+/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (lines.length === 0) {
            studentModal.setParsedStudents([]);
            return;
        }

        const enrolledStudentSections = new Map<string, string | null>();
        Object.entries(sectionStudents).forEach(([sectionId, students]) => {
            const sectionNo = course?.sections?.find(section => section.id === Number(sectionId))?.section_no || null;
            students.forEach((student) => {
                enrolledStudentSections.set(student.student_id.toLowerCase(), sectionNo);
            });
        });

        try {
            const response = await studentService.searchStudentsByIds(lines);

            if (!response.success || !response.data) {
                studentModal.setParsedStudents([]);
                return;
            }

            const foundMap = new Map<string, Student>();
            response.data.found.forEach((item: any) => {
                foundMap.set(item.query, item.student as Student);
            });

            const results: StudentModalState["parsedStudents"] = lines.map((inputValue) => {
                const matchedStudent = foundMap.get(inputValue);
                if (!matchedStudent) {
                    return {
                        inputValue,
                        matchedStudent: null,
                        status: "not_found" as const,
                        enrolledSectionNo: null,
                    };
                }

                return {
                    inputValue,
                    matchedStudent,
                    status: enrolledStudentSections.has(matchedStudent.student_id.toLowerCase())
                        ? "already_enrolled" as const
                        : "matched" as const,
                    enrolledSectionNo: enrolledStudentSections.get(matchedStudent.student_id.toLowerCase()) || null,
                };
            });

            studentModal.setParsedStudents(results);
        } catch (error) {
            console.error("Error parsing student IDs:", error);
            studentModal.setParsedStudents([]);
        }
    }, [studentModalState.sectionId, sectionStudents, studentModal, course?.id, course?.sections]);
    
    const parseTeamExcelData = useCallback(async (pasteData: string) => {
        if (!pasteData.trim()) {
            teamModal.setParsedMembers([]);
            return;
        }
        
        const lines = pasteData
            .split(/[\n\r]+/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (lines.length === 0) {
            teamModal.setParsedMembers([]);
            return;
        }
        
        teamModal.setIsParsing(true);
        
        try {
            const response = await studentService.searchStudentsByIds(lines, course?.id, "all");
            
            if (!response.success || !response.data) {
                teamModal.setIsParsing(false);
                return;
            }
            
            const unassignedStudents = getUnassignedStudents(
                teamModalState.type,
                teamModalState.type === "weekly" ? selectedWeek : undefined
            );
            const unassignedIds = new Set(unassignedStudents.map(s => s.id));
            
            const results: TeamModalState["parsedMembers"] = [];
            
            response.data.found.forEach((item: any) => {
                const student = item.student;
                const teamMember: TeamMember = {
                    id: student.id,
                    student_id: student.student_id,
                    full_name: student.full_name,
                };
                
                if (unassignedIds.has(student.id)) {
                    results.push({
                        inputValue: item.query,
                        matchedStudent: teamMember,
                        status: "matched",
                    });
                } else {
                    const existingTeam = findStudentTeam(
                        student.id,
                        teamModalState.type,
                        teamModalState.type === "weekly" ? selectedWeek : undefined
                    );
                    results.push({
                        inputValue: item.query,
                        matchedStudent: teamMember,
                        status: existingTeam ? "already_in_team" : "matched",
                    });
                }
            });
            
            response.data.not_found.forEach((inputValue: string) => {
                results.push({
                    inputValue,
                    matchedStudent: null,
                    status: "not_found",
                });
            });
            
            teamModal.setParsedMembers(results);
            
            const matchedIds = results
                .filter(r => r.status === "matched" && r.matchedStudent)
                .map(r => r.matchedStudent!.id);
            teamModal.setMembers(matchedIds);
            
        } catch (error) {
            console.error("Error parsing team members:", error);
            addToast({
                title: isEnglish ? "Error" : "เกิดข้อผิดพลาด",
                description: isEnglish ? "Unable to search for students." : "ไม่สามารถค้นหานักศึกษาได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            teamModal.setParsedMembers([]);
        } finally {
            teamModal.setIsParsing(false);
        }
    }, [course?.id, selectedWeek, teamModalState.type, getUnassignedStudents, findStudentTeam, teamModal, isEnglish]);
    
    // ============================================
    // Return
    // ============================================
    
    return {
        // Data
        course,
        isLoading,
        isTeamsLoading,
        
        // UI State
        sectionSubTab,
        sectionSearchQuery,
        selectedWeek,
        totalWeeks,
        expandedSections,
        
        // Data Collections
        permanentTeams,
        weeklyTeams,
        sectionStudents,
        removedStudents,
        studentsList,
        studentSearchResults,
        isStudentSearchLoading,
        
        // Computed
        totalStudents,
        
        // Modal States
        sectionModal,
        studentModal,
        teamModal,
        editTeamModal,
        deleteModal,
        bulkDeleteModal,
        editSectionModal,
        restoreModal,
        isSubmitting,
        
        // UI Handlers
        onSubTabChange,
        onSearchQueryChange,
        onWeekChange,
        onToggleSection,
        
        // CRUD Handlers
        handleAddSection,
        handleRemoveSection,
        confirmRemoveSection,
        handleEditSection,
        handleAddStudent,
        handleBulkAddStudents,
        handleRemoveStudent,
        handleRestoreStudent,
        confirmRestoreStudent,
        handleCreateTeam,
        handleSaveEditedTeam,
        handleDeleteTeam,
        handleBulkDeleteTeams,
        handleCopyTeamsFromWeek,
        
        // Modal Openers
        openAddStudentModal,
        openDeleteStudentModal,
        openCreateTeamModal,
        openEditTeamModal,
        openDeleteTeamModal,
        openBulkDeleteModal,
        openEditSectionModal,
        
        // Computed Functions
        getFilteredSectionStudents,
        findStudentTeam,
        getUnassignedStudents,
        getAvailableStudentsForEdit,
        getAllEnrolledStudents,
        
        // Utility
        parseExcelData,
        parseTeamExcelData,
        refreshTeams: fetchTeams,
    };
}

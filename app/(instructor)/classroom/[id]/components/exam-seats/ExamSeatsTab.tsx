"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type Key } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import classroomService, { type Classroom, type Desk } from "@/services/classroom.service";
import { courseService } from "@/services/course.service";
import {
    getExamSessions,
    createExamSession,
    deleteExamSession,
    getExamSeats,
    clearExamSeats,
    replaceExamSeats,
    updateExamSession,
    updateExamSessionClassrooms,
    importExamSeatsPreview,
    importExamSeatsCommit,
    type ExamSession,
    type ExamSeat,
    type ImportPreviewResult,
} from "@/services/examSeat.service";
import examScoreService, { type ExamSetting, getExamName } from "@/services/examScore.service";

interface ExamSeatsTabProps {
    courseId: string;
    isCourseActive?: boolean;
}

interface PlannerStudent {
    id: number;
    student_id: string;
    full_name: string;
    section_no: string;
}

interface PlannerAssignment {
    seat_id?: number;
    student_id: string;
    seat_number: string;
}

interface PlannerRow {
    seat_id?: number;
    desk_id: string;
    classroom_id: string;
    classroom_name: string;
    desk_number: number;
    seat_number: string;
    student_id: string;
}

type PlannerViewMode = "map" | "list";
type BulkOrderMode = "row" | "snake";
type BulkPatternMode = "all" | "checkerboardA" | "checkerboardB";
type BulkScopeMode = "current-room" | "all-rooms";
type SelectionPresetMode = "all" | "currentRow" | "oddColumns" | "evenColumns" | "checkerboardA" | "checkerboardB";

interface PhysicalPlannerEntry {
    row: PlannerRow;
    desk: Desk;
    roomIndex: number;
    physicalRowIndex: number;
    physicalColIndex: number;
}

type SaveValidationCode = "seat_number_invalid" | "student_duplicate" | "seat_duplicate";

interface SaveValidationIssue {
    code: SaveValidationCode;
    row: PlannerRow;
    seatNumber?: number;
}

interface PlannerSaveValidation {
    issues: SaveValidationIssue[];
    payload: Array<{ student_id: number; desk_id: string; seat_number: number }>;
}

const NORMAL_DESK_WIDTH = 48;
const NORMAL_DESK_HEIGHT = 38;
const TEACHER_DESK_WIDTH = 76;
const TEACHER_DESK_HEIGHT = 44;
const ROOM_LAYOUT_PADDING = 32;
const ROOM_ROW_GROUP_THRESHOLD = 42;

const EMPTY_SELECT_KEY = "__empty__";

function isTypingElement(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function selectionToArray(keys: "all" | Set<Key>): string[] {
    if (keys === "all") return [];
    return Array.from(keys).map(String);
}

function singleSelection(keys: "all" | Set<Key>): string {
    if (keys === "all") return "";
    return String(Array.from(keys)[0] ?? "");
}

function buildRoomOrderMap(session: ExamSession | null, roomIds: string[]): Map<string, number> {
    const order = new Map<string, number>();

    session?.rooms
        ?.slice()
        .sort((left, right) => left.sort_order - right.sort_order)
        .forEach((room, index) => {
            order.set(room.classroom_id, index);
        });

    roomIds.forEach((roomId) => {
        if (!order.has(roomId)) {
            order.set(roomId, order.size);
        }
    });

    return order;
}

function assignmentsFromSeats(seats: ExamSeat[]): Map<string, PlannerAssignment> {
    const assignments = new Map<string, PlannerAssignment>();

    seats.forEach((seat) => {
        assignments.set(seat.desk_id, {
            seat_id: seat.id,
            student_id: String(seat.student_id),
            seat_number: String(seat.seat_number || seat.desk_number || ""),
        });
    });

    return assignments;
}

function assignmentsFromRows(rows: PlannerRow[]): Map<string, PlannerAssignment> {
    const assignments = new Map<string, PlannerAssignment>();

    rows.forEach((row) => {
        assignments.set(row.desk_id, {
            seat_id: row.seat_id,
            student_id: row.student_id,
            seat_number: row.seat_number,
        });
    });

    return assignments;
}

function compareDesks(left: Desk, right: Desk): number {
    if (left.y !== right.y) return left.y - right.y;
    if (left.x !== right.x) return left.x - right.x;
    return left.number - right.number;
}

function getPlannerDeskSize(desk: Desk) {
    if (desk.type === "teacher") {
        return { width: TEACHER_DESK_WIDTH, height: TEACHER_DESK_HEIGHT };
    }

    return { width: NORMAL_DESK_WIDTH, height: NORMAL_DESK_HEIGHT };
}

function isAssignableDesk(desk: Desk) {
    return desk.type !== "teacher";
}

function buildRoomPhysicalRows(roomRows: PlannerRow[], classroom: Classroom): PhysicalPlannerEntry[][] {
    const deskMap = new Map(classroom.desks.map((desk) => [desk.id, desk]));
    const entries = roomRows
        .map((row) => {
            const desk = deskMap.get(row.desk_id);
            if (!desk) return null;
            return { row, desk };
        })
        .filter((entry): entry is { row: PlannerRow; desk: Desk } => Boolean(entry))
        .sort((left, right) => compareDesks(left.desk, right.desk));

    const grouped: Array<Array<{ row: PlannerRow; desk: Desk }>> = [];

    entries.forEach((entry) => {
        const currentGroup = grouped[grouped.length - 1];
        if (!currentGroup) {
            grouped.push([entry]);
            return;
        }

        const currentY = currentGroup[0]?.desk.y ?? 0;
        if (Math.abs(entry.desk.y - currentY) <= ROOM_ROW_GROUP_THRESHOLD) {
            currentGroup.push(entry);
            return;
        }

        grouped.push([entry]);
    });

    return grouped.map((group, rowIndex) =>
        group
            .slice()
            .sort((left, right) => left.desk.x - right.desk.x || left.row.desk_number - right.row.desk_number)
            .map((entry, colIndex) => ({
                row: entry.row,
                desk: entry.desk,
                roomIndex: 0,
                physicalRowIndex: rowIndex,
                physicalColIndex: colIndex,
            }))
    );
}

function buildOrderedPlannerEntries(
    roomIds: string[],
    plannerRows: PlannerRow[],
    classrooms: Classroom[],
    orderMode: BulkOrderMode
): PhysicalPlannerEntry[] {
    const classroomMap = new Map(classrooms.map((classroom) => [classroom.id, classroom]));
    const orderedEntries: PhysicalPlannerEntry[] = [];

    roomIds.forEach((roomId, roomIndex) => {
        const classroom = classroomMap.get(roomId);
        if (!classroom) return;

        const roomRows = plannerRows.filter((row) => row.classroom_id === roomId);
        const physicalRows = buildRoomPhysicalRows(roomRows, classroom);

        physicalRows.forEach((physicalRow) => {
            const normalizedRow = physicalRow.map((entry) => ({ ...entry, roomIndex }));
            const nextRow = orderMode === "snake" && normalizedRow[0]?.physicalRowIndex % 2 === 1
                ? normalizedRow.slice().reverse()
                : normalizedRow;
            orderedEntries.push(...nextRow);
        });
    });

    return orderedEntries;
}

function matchesBulkPattern(entry: PhysicalPlannerEntry, pattern: BulkPatternMode) {
    if (pattern === "all") {
        return true;
    }

    const parity = (entry.physicalRowIndex + entry.physicalColIndex) % 2;
    return pattern === "checkerboardA" ? parity === 0 : parity === 1;
}

function getRoomLayoutMetrics(classroom: Classroom, roomRows: PlannerRow[]) {
    const desks = classroom.desks.filter((desk) => roomRows.some((row) => row.desk_id === desk.id));
    const zones = classroom.zones ?? [];

    if (desks.length === 0 && zones.length === 0) {
        return {
            minX: 0,
            minY: 0,
            width: 800,
            height: 520,
        };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    desks.forEach((desk) => {
        const { width, height } = getPlannerDeskSize(desk);
        minX = Math.min(minX, desk.x);
        minY = Math.min(minY, desk.y);
        maxX = Math.max(maxX, desk.x + width);
        maxY = Math.max(maxY, desk.y + height);
    });

    zones.forEach((zone) => {
        minX = Math.min(minX, zone.x);
        minY = Math.min(minY, zone.y);
        maxX = Math.max(maxX, zone.x + zone.width);
        maxY = Math.max(maxY, zone.y + zone.height);
    });

    return {
        minX: Number.isFinite(minX) ? minX - ROOM_LAYOUT_PADDING : 0,
        minY: Number.isFinite(minY) ? minY - ROOM_LAYOUT_PADDING : 0,
        width: Math.max(480, (maxX - minX) + ROOM_LAYOUT_PADDING * 2),
        height: Math.max(360, (maxY - minY) + ROOM_LAYOUT_PADDING * 2),
    };
}

function buildDuplicateSeatNumberSet(rows: PlannerRow[]) {
    const counts = rows.reduce((map, row) => {
        if (!row.seat_number) {
            return map;
        }

        map.set(row.seat_number, (map.get(row.seat_number) ?? 0) + 1);
        return map;
    }, new Map<string, number>());

    return new Set(
        Array.from(counts.entries())
            .filter(([, count]) => count > 1)
            .map(([seatNumber]) => seatNumber)
    );
}

function rowHasPlannerIssue(row: PlannerRow, duplicateSeatNumbers: Set<string>) {
    if (!row.student_id) {
        return true;
    }

    if (!row.seat_number) {
        return true;
    }

    return duplicateSeatNumbers.has(row.seat_number);
}

function buildUpdatedPlannerRows(
    rows: PlannerRow[],
    deskId: string,
    updates: Partial<Pick<PlannerRow, "seat_number" | "student_id">>
) {
    return rows.map((row) => {
        if (updates.student_id && row.desk_id !== deskId && row.student_id === updates.student_id) {
            return { ...row, student_id: "" };
        }

        if (row.desk_id !== deskId) {
            return row;
        }

        return { ...row, ...updates };
    });
}

function validatePlannerSave(rows: PlannerRow[]): PlannerSaveValidation {
    const payload: Array<{ student_id: number; desk_id: string; seat_number: number }> = [];
    const seenStudentIds = new Set<string>();
    const seenSeatNumbers = new Set<number>();
    const issues: SaveValidationIssue[] = [];

    rows.forEach((row) => {
        if (!row.student_id) {
            return;
        }

        const seatNumber = Number(row.seat_number);
        if (!Number.isInteger(seatNumber) || seatNumber <= 0) {
            issues.push({ code: "seat_number_invalid", row });
            return;
        }

        if (seenStudentIds.has(row.student_id)) {
            issues.push({ code: "student_duplicate", row, seatNumber });
            return;
        }

        if (seenSeatNumbers.has(seatNumber)) {
            issues.push({ code: "seat_duplicate", row, seatNumber });
            return;
        }

        seenStudentIds.add(row.student_id);
        seenSeatNumbers.add(seatNumber);
        payload.push({
            student_id: Number(row.student_id),
            desk_id: row.desk_id,
            seat_number: seatNumber,
        });
    });

    return { issues, payload };
}

function parsePositiveInteger(value: string) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return null;
    }

    return parsed;
}

function parseSeatNumberStart(value: string) {
    return parsePositiveInteger(value);
}

function parseSeatNumberStep(value: string) {
    return parsePositiveInteger(value);
}

function buildSeatNumberMap(entries: Array<{ row: PlannerRow }>, startNumber: number, stepNumber: number) {
    return new Map(entries.map((entry, index) => [entry.row.desk_id, String(startNumber + (index * stepNumber))]));
}

function findNextIssueDeskId(
    rows: PlannerRow[],
    currentDeskId: string,
    deskMap: Map<string, Desk>,
    includeCurrent = false
) {
    const duplicateSeatNumbers = buildDuplicateSeatNumberSet(rows);
    const currentIndex = rows.findIndex((row) => row.desk_id === currentDeskId);
    const hasIssue = (row: PlannerRow) => {
        const desk = deskMap.get(row.desk_id);
        if (desk && !isAssignableDesk(desk)) {
            return false;
        }

        return rowHasPlannerIssue(row, duplicateSeatNumbers);
    };

    const startIndex = includeCurrent && currentIndex >= 0 ? currentIndex : currentIndex + 1;
    const forwardMatch = rows.slice(Math.max(startIndex, 0)).find(hasIssue);
    if (forwardMatch) {
        return forwardMatch.desk_id;
    }

    return rows.slice(0, Math.max(startIndex, 0)).find(hasIssue)?.desk_id ?? "";
}

function buildPlannerRows(
    roomIds: string[],
    classrooms: Classroom[],
    roomOrder: Map<string, number>,
    assignments: Map<string, PlannerAssignment>
): PlannerRow[] {
    return roomIds
        .map((roomId) => classrooms.find((classroom) => classroom.id === roomId))
        .filter((classroom): classroom is Classroom => Boolean(classroom))
        .sort((left, right) => {
            const leftOrder = roomOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = roomOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return left.name.localeCompare(right.name);
        })
        .flatMap((classroom) =>
            classroom.desks
                .filter((desk) => desk.is_enabled)
                .slice()
                .sort(compareDesks)
                .map((desk) => {
                    const assignment = assignments.get(desk.id);

                    return {
                        seat_id: assignment?.seat_id,
                        desk_id: desk.id,
                        classroom_id: classroom.id,
                        classroom_name: classroom.name,
                        desk_number: desk.number,
                        seat_number: assignment?.seat_number ?? "",
                        student_id: assignment?.student_id ?? "",
                    } satisfies PlannerRow;
                })
        );
}

function buildSessionLabel(session: ExamSession, isEnglish: boolean, fallbackLabel: string): string {
    if (session.exam_setting) {
        return getExamName(session.exam_setting, isEnglish);
    }

    return fallbackLabel;
}

function formatExamDate(dateStr: string, isEnglish: boolean): string {
    try {
        return new Date(dateStr).toLocaleDateString(isEnglish ? "en-GB" : "th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

export default function ExamSeatsTab({ courseId, isCourseActive = true }: ExamSeatsTabProps) {
    const { language } = useGlobalSettings();
    const t = useI18n();
    const isEnglish = language === "en";
    const catalogLoadedRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const seatSearchInputId = "exam-seat-search-input";

    const [isLoading, setIsLoading] = useState(true);
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [settings, setSettings] = useState<ExamSetting[]>([]);
    const [availableClassrooms, setAvailableClassrooms] = useState<Classroom[]>([]);
    const [enrolledStudents, setEnrolledStudents] = useState<PlannerStudent[]>([]);
    const [isCatalogLoading, setIsCatalogLoading] = useState(false);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        exam_setting_id: "",
        exam_date: "",
        start_time: "09:00",
        end_time: "11:00",
        notes: "",
        classroom_ids: [] as string[],
    });
    const [isCreating, setIsCreating] = useState(false);

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importForm, setImportForm] = useState({
        exam_setting_id: "",
        exam_date: "",
        start_time: "09:00",
        end_time: "11:00",
        notes: "",
    });

    const [plannerSession, setPlannerSession] = useState<ExamSession | null>(null);
    const [plannerRows, setPlannerRows] = useState<PlannerRow[]>([]);
    const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
    const [selectedDeskId, setSelectedDeskId] = useState("");
    const [selectedDeskIds, setSelectedDeskIds] = useState<string[]>([]);
    const [isPlannerLoading, setIsPlannerLoading] = useState(false);
    const [isSavingPlan, setIsSavingPlan] = useState(false);
    const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>("map");
    const [activeMapRoomId, setActiveMapRoomId] = useState("");
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [bulkOrderMode, setBulkOrderMode] = useState<BulkOrderMode>("row");
    const [bulkPatternMode, setBulkPatternMode] = useState<BulkPatternMode>("all");
    const [bulkScopeMode, setBulkScopeMode] = useState<BulkScopeMode>("current-room");
    const [seatNumberStart, setSeatNumberStart] = useState("1");
    const [seatNumberStep, setSeatNumberStep] = useState("1");
    const [autoAdvanceCleanup, setAutoAdvanceCleanup] = useState(true);
    const classroomMap = new Map(availableClassrooms.map((classroom) => [classroom.id, classroom]));
    const deskMap = new Map(
        availableClassrooms.flatMap((classroom) =>
            classroom.desks.map((desk) => [desk.id, desk] as const)
        )
    );

    const loadData = useCallback(async (): Promise<ExamSession[]> => {
        setIsLoading(true);
        try {
            const [sessionsData, settingsData] = await Promise.all([
                getExamSessions(courseId),
                examScoreService.getExamSettings(courseId),
            ]);
            setSessions(sessionsData);
            setSettings(settingsData.filter((setting) => setting.is_active));
            return sessionsData;
        } catch {
            addToast({
                title: t("examSeatLoadSessionsFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [courseId, isEnglish]);

    const ensureCatalogLoaded = useCallback(async () => {
        if (catalogLoadedRef.current) {
            return {
                classrooms: availableClassrooms,
                students: enrolledStudents,
            };
        }

        setIsCatalogLoading(true);

        try {
            const [classroomsResponse, courseResponse] = await Promise.all([
                classroomService.getClassrooms({ limit: 200, sortBy: "name", sortOrder: "ASC" }),
                courseService.getCourseById(courseId),
            ]);

            const classrooms = (classroomsResponse.data?.classrooms ?? []).slice().sort((left, right) =>
                left.name.localeCompare(right.name)
            );
            const sections = courseResponse.data?.sections ?? [];
            const sectionResponses = await Promise.all(
                sections.map((section) => courseService.getSectionStudents(courseId, section.id))
            );

            const studentMap = new Map<number, PlannerStudent>();

            sectionResponses.forEach((response, index) => {
                const sectionNo = sections[index]?.section_no ?? "";

                (response.data ?? []).forEach((student) => {
                    if (!student.is_active || studentMap.has(student.id)) {
                        return;
                    }

                    studentMap.set(student.id, {
                        id: student.id,
                        student_id: student.student_id,
                        full_name: student.full_name,
                        section_no: sectionNo,
                    });
                });
            });

            const students = Array.from(studentMap.values()).sort((left, right) =>
                left.student_id.localeCompare(right.student_id)
            );

            setAvailableClassrooms(classrooms);
            setEnrolledStudents(students);
            catalogLoadedRef.current = true;

            return { classrooms, students };
        } catch {
            addToast({
                title: t("examSeatLoadPlannerDataFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            throw new Error("planner-data-load-failed");
        } finally {
            setIsCatalogLoading(false);
        }
    }, [availableClassrooms, courseId, enrolledStudents, t]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        catalogLoadedRef.current = false;
        setAvailableClassrooms([]);
        setEnrolledStudents([]);
    }, [courseId]);

    useEffect(() => {
        if (!plannerRows.length) {
            if (selectedDeskId) setSelectedDeskId("");
            if (selectedDeskIds.length) setSelectedDeskIds([]);
            return;
        }

        if (!selectedDeskId || !plannerRows.some((row) => row.desk_id === selectedDeskId)) {
            setSelectedDeskId(plannerRows[0].desk_id);
            setSelectedDeskIds([plannerRows[0].desk_id]);
            return;
        }

        const validSelectedDeskIds = selectedDeskIds.filter((deskId) =>
            plannerRows.some((row) => row.desk_id === deskId)
        );

        if (validSelectedDeskIds.length !== selectedDeskIds.length) {
            setSelectedDeskIds(validSelectedDeskIds.length > 0 ? validSelectedDeskIds : [selectedDeskId]);
            return;
        }

        if (!selectedDeskIds.length) {
            setSelectedDeskIds([selectedDeskId]);
        }
    }, [plannerRows, selectedDeskId, selectedDeskIds]);

    useEffect(() => {
        if (!selectedRoomIds.length) {
            if (activeMapRoomId) {
                setActiveMapRoomId("");
            }
            return;
        }

        if (!activeMapRoomId || !selectedRoomIds.includes(activeMapRoomId)) {
            setActiveMapRoomId(selectedRoomIds[0]);
        }
    }, [activeMapRoomId, selectedRoomIds]);

    const focusPlannerDesk = useCallback((deskId: string, rows: PlannerRow[] = plannerRows) => {
        const nextRow = rows.find((row) => row.desk_id === deskId);
        if (!nextRow) {
            return;
        }

        setPlannerViewMode("map");
        setActiveMapRoomId(nextRow.classroom_id);
        setSelectedDeskId(nextRow.desk_id);
        setSelectedDeskIds([nextRow.desk_id]);
    }, [plannerRows]);

    const selectPlannerDesk = useCallback((deskId: string, mode: "replace" | "toggle" = "replace") => {
        const desk = deskMap.get(deskId);
        if (mode === "toggle" && desk && !isAssignableDesk(desk)) {
            focusPlannerDesk(deskId);
            return;
        }

        if (mode === "replace") {
            focusPlannerDesk(deskId);
            return;
        }

        const exists = selectedDeskIds.includes(deskId);
        const nextDeskIds = exists
            ? (selectedDeskIds.length > 1 ? selectedDeskIds.filter((id) => id !== deskId) : selectedDeskIds)
            : [...selectedDeskIds, deskId];

        setSelectedDeskIds(nextDeskIds);
        setSelectedDeskId(exists && selectedDeskId === deskId ? (nextDeskIds[nextDeskIds.length - 1] ?? deskId) : deskId);
    }, [deskMap, focusPlannerDesk, selectedDeskId, selectedDeskIds]);

    const applyDeskSelection = useCallback((deskIds: string[]) => {
        const nextDeskIds = Array.from(new Set(deskIds)).filter((deskId) => {
            const desk = deskMap.get(deskId);
            return desk ? isAssignableDesk(desk) : true;
        });

        if (nextDeskIds.length === 0) {
            addToast({
                title: t("examSeatNoSelectionPresetMatch"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setSelectedDeskIds(nextDeskIds);
        setSelectedDeskId((currentDeskId) => nextDeskIds.includes(currentDeskId) ? currentDeskId : nextDeskIds[0]);
    }, [deskMap, t]);

    const maybeAdvanceCleanup = useCallback((rows: PlannerRow[], currentDeskId: string) => {
        if (!autoAdvanceCleanup) {
            return;
        }

        const nextDeskId = findNextIssueDeskId(rows, currentDeskId, deskMap, true);
        if (!nextDeskId || nextDeskId === currentDeskId) {
            return;
        }

        focusPlannerDesk(nextDeskId, rows);
    }, [autoAdvanceCleanup, deskMap, focusPlannerDesk]);

    const updatePlannerRow = useCallback((
        deskId: string,
        updates: Partial<Pick<PlannerRow, "seat_number" | "student_id">>,
        options?: { tryAdvanceCleanup?: boolean }
    ) => {
        const nextRows = buildUpdatedPlannerRows(plannerRows, deskId, updates);
        setPlannerRows(nextRows);

        if (options?.tryAdvanceCleanup) {
            maybeAdvanceCleanup(nextRows, deskId);
        }
    }, [maybeAdvanceCleanup, plannerRows]);

    const updateSeatNumberStartValue = useCallback((value: string) => {
        setSeatNumberStart(value.replace(/[^0-9]/g, ""));
    }, []);

    const updateSeatNumberStepValue = useCallback((value: string) => {
        setSeatNumberStep(value.replace(/[^0-9]/g, ""));
    }, []);

    const applyNumberingPreset = useCallback((start: string, step: string) => {
        setSeatNumberStart(start);
        setSeatNumberStep(step);
    }, []);

    const getBulkPlannerContext = useCallback(() => {
        const scopeRoomIds = bulkScopeMode === "all-rooms"
            ? selectedRoomIds
            : activeMapRoomId
                ? [activeMapRoomId]
                : [];

        const orderedEntries = buildOrderedPlannerEntries(
            scopeRoomIds,
            plannerRows,
            availableClassrooms,
            bulkOrderMode
        ).filter((entry) => isAssignableDesk(entry.desk));

        const eligibleEntries = orderedEntries.filter((entry) => matchesBulkPattern(entry, bulkPatternMode));
        const seatNumbers = new Map<string, string>();

        eligibleEntries.forEach((entry, index) => {
            seatNumbers.set(entry.row.desk_id, String(index + 1));
        });

        return {
            scopeRoomIds,
            eligibleEntries,
            seatNumbers,
        };
    }, [activeMapRoomId, availableClassrooms, bulkOrderMode, bulkPatternMode, bulkScopeMode, plannerRows, selectedRoomIds]);

    const openPlanner = useCallback(
        async (session: ExamSession) => {
            setIsPlannerLoading(true);

            try {
                const { classrooms } = await ensureCatalogLoaded();
                const seats = await getExamSeats(courseId, session.id);
                const sessionRoomIds = session.rooms?.map((room) => room.classroom_id) ?? [];
                const fallbackRoomIds = Array.from(
                    new Set(
                        seats
                            .map((seat) => seat.classroom_id)
                            .filter((roomId): roomId is string => Boolean(roomId))
                    )
                );
                const nextRoomIds = sessionRoomIds.length > 0 ? sessionRoomIds : fallbackRoomIds;
                const nextRows = buildPlannerRows(
                    nextRoomIds,
                    classrooms,
                    buildRoomOrderMap(session, nextRoomIds),
                    assignmentsFromSeats(seats)
                );

                setPlannerSession(session);
                setSelectedRoomIds(nextRoomIds);
                setPlannerRows(nextRows);
                setActiveMapRoomId(nextRoomIds[0] ?? "");
                setPlannerViewMode("map");
                setStudentSearchQuery("");
                setSelectedDeskIds([]);
                setSelectedDeskId("");
                setSeatNumberStart(session.seat_number_start > 0 ? String(session.seat_number_start) : "1");
                setSeatNumberStep(session.seat_number_step > 0 ? String(session.seat_number_step) : "1");
            } catch {
                addToast({
                    title: t("examSeatOpenPlannerFailed"),
                    color: "danger",
                    timeout: 3000,
                    shouldShowTimeoutProgress: true,
                });
            } finally {
                setIsPlannerLoading(false);
            }
        },
        [courseId, ensureCatalogLoaded, t]
    );

    const handleCreateSession = async () => {
        if (!createForm.exam_setting_id || !createForm.exam_date) {
            addToast({
                title: t("examSeatRequiredFields"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsCreating(true);

        try {
            const session = await createExamSession(courseId, {
                exam_setting_id: Number(createForm.exam_setting_id),
                exam_date: createForm.exam_date,
                start_time: createForm.start_time,
                end_time: createForm.end_time,
                notes: createForm.notes.trim(),
                classroom_ids: createForm.classroom_ids,
            });

            setIsCreateOpen(false);
            setCreateForm({
                exam_setting_id: "",
                exam_date: "",
                start_time: "09:00",
                end_time: "11:00",
                notes: "",
                classroom_ids: [],
            });

            const nextSessions = await loadData();
            const nextSession = nextSessions.find((item) => item.id === session.id) ?? session;

            addToast({
                title: t("examSeatCreated"),
                description: t("examSeatCreatedDescription"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });

            await openPlanner(nextSession);
        } catch {
            addToast({
                title: t("examSeatCreateFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteSession = async (sessionId: number) => {
        if (!confirm(t("examSeatDeleteConfirm"))) {
            return;
        }

        try {
            await deleteExamSession(courseId, sessionId);
            await loadData();

            if (plannerSession?.id === sessionId) {
                setPlannerSession(null);
                setPlannerRows([]);
                setSelectedRoomIds([]);
                setSelectedDeskIds([]);
                setSelectedDeskId("");
            }

            addToast({
                title: t("examSeatDeleted"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch {
            addToast({
                title: t("examSeatDeleteFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    const handlePrint = (session: ExamSession) => {
        window.open(`/classroom/${courseId}/exam-sessions/${session.id}/print`, "_blank");
    };

    const handlePlannerRoomChange = (roomIds: string[]) => {
        const nextRows = buildPlannerRows(
            roomIds,
            availableClassrooms,
            buildRoomOrderMap(plannerSession, roomIds),
            assignmentsFromRows(plannerRows)
        );

        setSelectedRoomIds(roomIds);
        setPlannerRows(nextRows);
        setActiveMapRoomId((currentRoomId) => (roomIds.includes(currentRoomId) ? currentRoomId : (roomIds[0] ?? "")));
    };

    const handleAutoNumber = () => {
        const { scopeRoomIds, eligibleEntries } = getBulkPlannerContext();
        const startNumber = parseSeatNumberStart(seatNumberStart);
        const stepNumber = parseSeatNumberStep(seatNumberStep);

        if (!startNumber) {
            addToast({
                title: t("examSeatStartNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!stepNumber) {
            addToast({
                title: t("examSeatStepNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const seatNumbers = buildSeatNumberMap(eligibleEntries, startNumber, stepNumber);

        if (scopeRoomIds.length === 0 || seatNumbers.size === 0) {
            addToast({
                title: t("examSeatNoEligibleSeats"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setPlannerRows((currentRows) =>
            currentRows.map((row) => {
                if (!scopeRoomIds.includes(row.classroom_id)) {
                    return row;
                }

                if (seatNumbers.has(row.desk_id)) {
                    return {
                        ...row,
                        seat_number: seatNumbers.get(row.desk_id) ?? row.seat_number,
                    };
                }

                if (!row.student_id) {
                    return {
                        ...row,
                        seat_number: "",
                    };
                }

                return row;
            })
        );

        addToast({
            title: t("examSeatLayoutNumbered"),
            description: t("examSeatLayoutNumberedDescription", { count: seatNumbers.size }),
            color: "success",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    };

    const handleAutoAssignStudents = () => {
        const { eligibleEntries } = getBulkPlannerContext();
        const startNumber = parseSeatNumberStart(seatNumberStart);
        const stepNumber = parseSeatNumberStep(seatNumberStep);

        if (!startNumber) {
            addToast({
                title: t("examSeatStartNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!stepNumber) {
            addToast({
                title: t("examSeatStepNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const seatNumbers = buildSeatNumberMap(eligibleEntries, startNumber, stepNumber);
        const assignedStudents = new Set(plannerRows.map((row) => row.student_id).filter(Boolean));
        const remainingStudents = enrolledStudents.filter(
            (student) => !assignedStudents.has(String(student.id))
        );
        const eligibleEmptyEntries = eligibleEntries.filter((entry) => !entry.row.student_id);
        const eligibleDeskIds = new Set(eligibleEntries.map((entry) => entry.row.desk_id));
        const assignCount = Math.min(remainingStudents.length, eligibleEmptyEntries.length);

        if (assignCount === 0) {
            addToast({
                title: t("examSeatNoStudentsToPlace"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setPlannerRows((currentRows) => {
            let studentIndex = 0;

            return currentRows.map((row) => {
                if (!eligibleDeskIds.has(row.desk_id) || row.student_id) {
                    return row;
                }

                const nextStudent = remainingStudents[studentIndex];
                studentIndex += 1;

                if (!nextStudent) {
                    return row;
                }

                return {
                    ...row,
                    student_id: String(nextStudent.id),
                    seat_number: row.seat_number || seatNumbers.get(row.desk_id) || "",
                };
            });
        });

        addToast({
            title: t("examSeatStudentsPlaced"),
            description: t("examSeatStudentsPlacedDescription", { count: assignCount }),
            color: "success",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    };

    const handleResetPlanner = () => {
        setPlannerRows((currentRows) =>
            currentRows.map((row) => ({
                ...row,
                seat_id: undefined,
                student_id: "",
                seat_number: "",
            }))
        );
    };

    const handleClearSavedSeats = async () => {
        if (!plannerSession) return;

        if (!confirm(t("examSeatClearSavedConfirm"))) {
            return;
        }

        setIsSavingPlan(true);

        try {
            await clearExamSeats(courseId, plannerSession.id);
            setPlannerRows((currentRows) =>
                currentRows.map((row) => ({
                    ...row,
                    seat_id: undefined,
                    student_id: "",
                    seat_number: "",
                }))
            );
            await loadData();

            addToast({
                title: t("examSeatSavedCleared"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch {
            addToast({
                title: t("examSeatClearFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSavingPlan(false);
        }
    };

    const handleSavePlanner = async () => {
        if (!plannerSession) return;
        const saveValidation = validatePlannerSave(plannerRows);
        const startNumber = parseSeatNumberStart(seatNumberStart);
        const stepNumber = parseSeatNumberStep(seatNumberStep);
        const firstIssue = saveValidation.issues[0];

        if (!startNumber) {
            addToast({
                title: t("examSeatStartNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!stepNumber) {
            addToast({
                title: t("examSeatStepNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (firstIssue) {
            focusPlannerDesk(firstIssue.row.desk_id);

            addToast({
                title: firstIssue.code === "seat_number_invalid"
                    ? t("examSeatSeatNumberPositive")
                    : firstIssue.code === "student_duplicate"
                        ? t("examSeatStudentUnique")
                        : t("examSeatSeatUnique"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsSavingPlan(true);

        try {
            await updateExamSession(courseId, plannerSession.id, {
                notes: plannerSession.notes,
                seat_number_start: startNumber,
                seat_number_step: stepNumber,
            });

            await updateExamSessionClassrooms(courseId, plannerSession.id, selectedRoomIds);

            if (saveValidation.payload.length > 0) {
                await replaceExamSeats(courseId, plannerSession.id, saveValidation.payload);
            } else {
                await clearExamSeats(courseId, plannerSession.id);
            }

            const [nextSessions, nextSeats] = await Promise.all([
                loadData(),
                getExamSeats(courseId, plannerSession.id),
            ]);
            const nextSession = nextSessions.find((item) => item.id === plannerSession.id) ?? plannerSession;
            const nextRows = buildPlannerRows(
                selectedRoomIds,
                availableClassrooms,
                buildRoomOrderMap(nextSession, selectedRoomIds),
                assignmentsFromSeats(nextSeats)
            );

            setPlannerSession(nextSession);
            setPlannerRows(nextRows);

            addToast({
                title: t("examSeatSaved"),
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch {
            addToast({
                title: t("examSeatSaveFailed"),
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsSavingPlan(false);
        }
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        setIsImporting(true);

        try {
            const preview = await importExamSeatsPreview(courseId, file);
            setImportPreview(preview);
            setImportStep(2);
        } catch (error) {
            addToast({
                title: t("examSeatParseFailed"),
                description: error instanceof Error ? error.message : undefined,
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsImporting(false);
        }
    };

    const handleImportCommit = async () => {
        if (!importPreview || !importForm.exam_setting_id || !importForm.exam_date) {
            addToast({
                title: t("examSeatRequiredFields"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const matchedRows = importPreview.rows.filter((row) => row.student_found && row.desk_found);
        if (matchedRows.length === 0) {
            addToast({
                title: t("examSeatNoMatchedRows"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setIsImporting(true);

        try {
            const result = await importExamSeatsCommit(courseId, {
                exam_setting_id: Number(importForm.exam_setting_id),
                exam_date: importForm.exam_date,
                start_time: importForm.start_time,
                end_time: importForm.end_time,
                notes: importForm.notes.trim(),
                seats: matchedRows.map((row) => ({
                    student_id: row.student_db_id,
                    desk_id: row.desk_db_id,
                    seat_number: row.desk_number,
                })),
            });

            await loadData();
            setIsImportOpen(false);
            setImportStep(1);
            setImportFile(null);
            setImportPreview(null);
            setImportForm({
                exam_setting_id: "",
                exam_date: "",
                start_time: "09:00",
                end_time: "11:00",
                notes: "",
            });

            addToast({
                title: t("examSeatImportComplete"),
                description: t("examSeatImportCompleteDescription", { count: result.imported }),
                color: "success",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error) {
            addToast({
                title: t("examSeatImportFailed"),
                description: error instanceof Error ? error.message : undefined,
                color: "danger",
                timeout: 4000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsImporting(false);
        }
    };

    const settingOptions = settings.map((setting) => ({
        value: String(setting.id),
        label: getExamName(setting, isEnglish),
    }));

    const seatNumberCounts = plannerRows.reduce((counts, row) => {
        if (!row.seat_number) return counts;
        counts.set(row.seat_number, (counts.get(row.seat_number) ?? 0) + 1);
        return counts;
    }, new Map<string, number>());
    const duplicateSeatNumbers = new Set(
        Array.from(seatNumberCounts.entries())
            .filter(([, count]) => count > 1)
            .map(([seatNumber]) => seatNumber)
    );
    const selectedRow = plannerRows.find((row) => row.desk_id === selectedDeskId) ?? null;
    const selectedDesk = selectedRow ? deskMap.get(selectedRow.desk_id) ?? null : null;
    const actionableRows = plannerRows.filter((row) => {
        const desk = deskMap.get(row.desk_id);
        return desk ? isAssignableDesk(desk) : true;
    });
    const selectedPlannerRows = plannerRows.filter((row) => selectedDeskIds.includes(row.desk_id));
    const selectedAssignableRows = selectedPlannerRows.filter((row) => {
        const desk = deskMap.get(row.desk_id);
        return desk ? isAssignableDesk(desk) : true;
    });
    const selectedBulkRoomIds = Array.from(new Set(selectedAssignableRows.map((row) => row.classroom_id)));
    const selectedBulkEntries = buildOrderedPlannerEntries(
        selectedBulkRoomIds,
        plannerRows,
        availableClassrooms,
        bulkOrderMode
    ).filter((entry) => selectedDeskIds.includes(entry.row.desk_id));
    const assignedStudentIds = new Set(plannerRows.map((row) => row.student_id).filter(Boolean));
    const assignedCount = plannerRows.filter((row) => row.student_id).length;
    const unassignedStudents = enrolledStudents.filter(
        (student) => !plannerRows.some((row) => row.student_id === String(student.id))
    );
    const selectedRooms = selectedRoomIds
        .map((roomId) => availableClassrooms.find((classroom) => classroom.id === roomId))
        .filter((classroom): classroom is Classroom => Boolean(classroom));
    const activeRoom = selectedRooms.find((room) => room.id === activeMapRoomId) ?? selectedRooms[0] ?? null;
    const activeRoomRows = activeRoom
        ? plannerRows.filter((row) => row.classroom_id === activeRoom.id)
        : [];
    const activeRoomPhysicalRows = activeRoom
        ? buildRoomPhysicalRows(activeRoomRows, activeRoom)
        : [];
    const activeRoomEntries = activeRoomPhysicalRows.flat();
    const activeAssignableEntries = activeRoomEntries.filter((entry) => isAssignableDesk(entry.desk));
    const selectedPhysicalEntry = activeRoomEntries.find((entry) => entry.row.desk_id === selectedDeskId) ?? null;
    const activeRoomMetrics = activeRoom
        ? getRoomLayoutMetrics(activeRoom, activeRoomRows)
        : null;
    const bulkContext = getBulkPlannerContext();
    const selectedStudent = selectedRow
        ? enrolledStudents.find((student) => String(student.id) === selectedRow.student_id) ?? null
        : null;
    const plannerIssueRows = actionableRows.filter((row) => {
        if (!row.student_id) {
            return true;
        }

        if (!row.seat_number) {
            return true;
        }

        return duplicateSeatNumbers.has(row.seat_number);
    });
    const plannerIssuesInActiveRoom = activeRoom
        ? plannerIssueRows.filter((row) => row.classroom_id === activeRoom.id)
        : plannerIssueRows;
    const missingStudentCount = actionableRows.filter((row) => !row.student_id).length;
    const missingSeatNumberCount = actionableRows.filter((row) => row.student_id && !row.seat_number).length;
    const duplicateSeatIssueCount = actionableRows.filter(
        (row) => row.seat_number && duplicateSeatNumbers.has(row.seat_number)
    ).length;
    const studentSearchValue = studentSearchQuery.trim().toLowerCase();
    const candidateStudents = selectedRow
        ? enrolledStudents.filter((student) => {
            const studentId = String(student.id);
            const alreadyAssignedElsewhere = assignedStudentIds.has(studentId) && selectedRow.student_id !== studentId;

            if (alreadyAssignedElsewhere) {
                return false;
            }

            if (!studentSearchValue) {
                return true;
            }

            const haystack = [student.student_id, student.full_name, student.section_no]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(studentSearchValue);
        }).slice(0, 60)
        : [];
    const assignFirstCandidate = useCallback(() => {
        if (!selectedRow || candidateStudents.length === 0) {
            addToast({
                title: t("examSeatNoStudentMatch"),
                color: "warning",
                timeout: 2500,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        updatePlannerRow(selectedRow.desk_id, {
            student_id: String(candidateStudents[0].id),
        }, { tryAdvanceCleanup: true });
    }, [candidateStudents, selectedRow, t, updatePlannerRow]);
    const applySelectionPreset = useCallback((preset: SelectionPresetMode) => {
        const matches = activeAssignableEntries.filter((entry) => {
            switch (preset) {
                case "all":
                    return true;
                case "currentRow":
                    return selectedPhysicalEntry
                        ? entry.physicalRowIndex === selectedPhysicalEntry.physicalRowIndex
                        : false;
                case "oddColumns":
                    return entry.physicalColIndex % 2 === 0;
                case "evenColumns":
                    return entry.physicalColIndex % 2 === 1;
                case "checkerboardA":
                    return (entry.physicalRowIndex + entry.physicalColIndex) % 2 === 0;
                case "checkerboardB":
                    return (entry.physicalRowIndex + entry.physicalColIndex) % 2 === 1;
                default:
                    return false;
            }
        }).map((entry) => entry.row.desk_id);

        applyDeskSelection(matches);
    }, [activeAssignableEntries, applyDeskSelection, selectedPhysicalEntry]);
    const saveValidation = validatePlannerSave(plannerRows);
    const saveValidationIssues = saveValidation.issues;
    const seatNumberStartValid = parseSeatNumberStart(seatNumberStart) !== null;
    const seatNumberStepValid = parseSeatNumberStep(seatNumberStep) !== null;
    const invalidSeatNumberCount = saveValidationIssues.filter((issue) => issue.code === "seat_number_invalid").length;
    const duplicateStudentSaveCount = saveValidationIssues.filter((issue) => issue.code === "student_duplicate").length;
    const duplicateSeatSaveCount = saveValidationIssues.filter((issue) => issue.code === "seat_duplicate").length;
    const handleNumberSelectedDesks = useCallback(() => {
        if (selectedBulkEntries.length === 0) {
            addToast({
                title: t("examSeatNoSelectedDesks"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const startNumber = parseSeatNumberStart(seatNumberStart);
        if (!startNumber) {
            addToast({
                title: t("examSeatStartNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const stepNumber = parseSeatNumberStep(seatNumberStep);
        if (!stepNumber) {
            addToast({
                title: t("examSeatStepNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const seatNumbers = buildSeatNumberMap(selectedBulkEntries, startNumber, stepNumber);
        setPlannerRows((currentRows) => currentRows.map((row) => (
            seatNumbers.has(row.desk_id)
                ? { ...row, seat_number: seatNumbers.get(row.desk_id) ?? row.seat_number }
                : row
        )));

        addToast({
            title: t("examSeatSelectedNumbered"),
            description: t("examSeatSelectedNumberedDescription", { count: seatNumbers.size }),
            color: "success",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    }, [seatNumberStart, seatNumberStep, selectedBulkEntries, t]);

    const handleClearSelectedDesks = useCallback(() => {
        if (selectedAssignableRows.length === 0) {
            addToast({
                title: t("examSeatNoSelectedDesks"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const selectedIdSet = new Set(selectedAssignableRows.map((row) => row.desk_id));
        setPlannerRows((currentRows) => currentRows.map((row) => (
            selectedIdSet.has(row.desk_id)
                ? { ...row, student_id: "", seat_number: "" }
                : row
        )));

        addToast({
            title: t("examSeatSelectedCleared"),
            description: t("examSeatSelectedClearedDescription", { count: selectedIdSet.size }),
            color: "success",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    }, [selectedAssignableRows, t]);
    const handleAssignSelectedDesks = useCallback(() => {
        const selectedOpenEntries = selectedBulkEntries.filter((entry) => !entry.row.student_id);
        const startNumber = parseSeatNumberStart(seatNumberStart);
        const stepNumber = parseSeatNumberStep(seatNumberStep);

        if (!startNumber) {
            addToast({
                title: t("examSeatStartNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        if (!stepNumber) {
            addToast({
                title: t("examSeatStepNumberPositive"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const assignedStudents = new Set(plannerRows.map((row) => row.student_id).filter(Boolean));
        const remainingStudents = enrolledStudents.filter(
            (student) => !assignedStudents.has(String(student.id))
        );
        const assignCount = Math.min(selectedOpenEntries.length, remainingStudents.length);

        if (assignCount === 0) {
            addToast({
                title: t("examSeatNoStudentsToPlace"),
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const selectedSeatNumbers = buildSeatNumberMap(selectedBulkEntries, startNumber, stepNumber);

        setPlannerRows((currentRows) => {
            let studentIndex = 0;

            return currentRows.map((row) => {
                const selectedEntry = selectedOpenEntries.find((entry) => entry.row.desk_id === row.desk_id);
                if (!selectedEntry) {
                    return row;
                }

                const nextStudent = remainingStudents[studentIndex];
                studentIndex += 1;

                if (!nextStudent) {
                    return row;
                }

                return {
                    ...row,
                    student_id: String(nextStudent.id),
                    seat_number: row.seat_number || selectedSeatNumbers.get(row.desk_id) || "",
                };
            });
        });

        addToast({
            title: t("examSeatSelectedPlaced"),
            description: t("examSeatSelectedPlacedDescription", { count: assignCount }),
            color: "success",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    }, [enrolledStudents, plannerRows, seatNumberStart, seatNumberStep, selectedBulkEntries, t]);
    const goToNextIssue = useCallback(() => {
        if (plannerIssueRows.length === 0) {
            addToast({
                title: t("examSeatNoIssues"),
                color: "success",
                timeout: 2500,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        const nextDeskId = findNextIssueDeskId(plannerRows, selectedDeskId, deskMap);
        if (!nextDeskId) {
            addToast({
                title: t("examSeatNoIssues"),
                color: "success",
                timeout: 2500,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        focusPlannerDesk(nextDeskId);
    }, [deskMap, focusPlannerDesk, plannerIssueRows.length, plannerRows, selectedDeskId, t]);

    const goToNextDesk = useCallback(() => {
        if (!plannerRows.length || !selectedRow) {
            return;
        }

        const currentIndex = plannerRows.findIndex((row) => row.desk_id === selectedRow.desk_id);
        const nextRow = plannerRows[currentIndex + 1] ?? plannerRows[0];
        if (nextRow) {
            focusPlannerDesk(nextRow.desk_id);
        }
    }, [focusPlannerDesk, plannerRows, selectedRow]);

    useEffect(() => {
        const handlePlannerHotkeys = (event: KeyboardEvent) => {
            if (!plannerSession || isCreateOpen || isImportOpen) {
                return;
            }

            const typing = isTypingElement(event.target);

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                if (!isSavingPlan) {
                    void handleSavePlanner();
                }
                return;
            }

            if (typing) {
                return;
            }

            if (event.key === "/") {
                event.preventDefault();
                const searchInput = document.getElementById(seatSearchInputId) as HTMLInputElement | null;
                searchInput?.focus();
                searchInput?.select();
                return;
            }

            if (event.key.toLowerCase() === "j") {
                event.preventDefault();
                goToNextDesk();
                return;
            }

            if (event.key.toLowerCase() === "k") {
                event.preventDefault();
                goToNextIssue();
            }
        };

        window.addEventListener("keydown", handlePlannerHotkeys);
        return () => window.removeEventListener("keydown", handlePlannerHotkeys);
    }, [goToNextDesk, goToNextIssue, handleSavePlanner, isCreateOpen, isImportOpen, isSavingPlan, plannerSession]);
    const labels = {
        plannerTitle: t("examSeatPlannerTitle"),
        plannerDescription: t("examSeatPlannerDescription"),
        importKkuFile: t("examSeatImportKkuFile"),
        createExam: t("examSeatCreateExam"),
        plannerBadge: t("examSeatPlannerBadge"),
        closePlanner: t("examSeatClosePlanner"),
        clearSavedSeats: t("examSeatClearSavedSeats"),
        savePlanner: t("examSeatSavePlanner"),
        roomsSummary: t("examSeatRoomsSummary"),
        desksInPlan: t("examSeatDesksInPlan"),
        assignedStudents: t("examSeatAssignedStudents"),
        unassignedStudents: t("examSeatUnassignedStudents"),
        chooseRoomsStep: t("examSeatChooseRoomsStep"),
        chooseRoomsDescription: t("examSeatChooseRoomsDescription"),
        examRooms: t("examSeatExamRoomsLabel"),
        selectRoomsPlaceholder: t("examSeatSelectRoomsPlaceholder"),
        assignStep: t("examSeatAssignStep"),
        assignDescription: t("examSeatAssignDescription"),
        autoNumber: t("examSeatAutoNumber"),
        autoAssign: t("autoAssign"),
        resetPlanner: t("examSeatResetPlanner"),
        selectRoomPrompt: t("examSeatSelectRoomPrompt"),
        seatNo: t("examSeatSeatNo"),
        roomColumn: t("examSeatRoomColumn"),
        deskColumn: t("examSeatDeskColumn"),
        studentColumn: t("examSeatStudentColumn"),
        statusColumn: t("examSeatStatusColumn"),
        notAssigned: t("notAssigned"),
        seatConflict: t("examSeatSeatConflict"),
        assignedStatus: t("examSeatAssignedStatus"),
        openDesk: t("examSeatOpenDesk"),
        editDeskStep: t("examSeatEditDeskStep"),
        editDeskDescription: t("examSeatEditDeskDescription"),
        selectDeskPrompt: t("examSeatSelectDeskPrompt"),
        assignedStudent: t("examSeatAssignedStudent"),
        noStudentAssigned: t("examSeatNoStudentAssigned"),
        clearDesk: t("examSeatClearDesk"),
        nextDesk: t("examSeatNextDesk"),
        studentsWithoutSeat: t("examSeatStudentsWithoutSeat"),
        studentsWithoutSeatDescription: t("examSeatStudentsWithoutSeatDescription"),
        allStudentsAssigned: t("examSeatAllStudentsAssigned"),
        sessionsTitle: t("examSeatSessionsTitle"),
        loadingPlannerData: t("examSeatLoadingPlannerData"),
        noSessionsTitle: t("examSeatNoSessionsTitle"),
        noSessionsDescription: t("examSeatNoSessionsDescription"),
        openPlanner: t("examSeatOpenPlanner"),
        openNow: t("examSeatOpenNow"),
        createSessionTitle: t("examSeatCreateSessionTitle"),
        defineExamStep: t("examSeatDefineExamStep"),
        defineExamDescription: t("examSeatDefineExamDescription"),
        examType: t("examSeatExamType"),
        startTime: t("examSeatStartTime"),
        endTime: t("examSeatEndTime"),
        notes: t("examSeatNotes"),
        initialRoomsOptional: t("examSeatInitialRoomsOptional"),
        createAndContinue: t("examSeatCreateAndContinue"),
        importTitle: t("examSeatImportTitle"),
        chooseDocxFile: t("examSeatChooseDocxFile"),
        officialKkuFormat: t("examSeatOfficialKkuFormat"),
        parsingFile: t("examSeatParsingFile"),
        matched: t("examSeatMatched"),
        studentNotFound: t("examSeatStudentNotFound"),
        nameColumn: t("examSeatNameColumn"),
        seatLabel: t("examSeatSeatLabel"),
        matchedRowsDescription: t("examSeatMatchedRowsDescription"),
        importedRosterDescription: t("examSeatImportedRosterDescription"),
        cancel: t("examSeatCancel"),
        back: t("examSeatBack"),
        confirmImport: t("examSeatConfirmImport"),
        sectionShort: t("examSeatSectionShort"),
        noStudentTextValue: t("examSeatNoStudentTextValue"),
        mapView: t("examSeatMapView"),
        listView: t("examSeatListView"),
        activeRoom: t("examSeatActiveRoom"),
        roomLayout: t("examSeatRoomLayout"),
        roomLayoutDescription: t("examSeatRoomLayoutDescription"),
        bulkLayoutTitle: t("examSeatBulkLayoutTitle"),
        bulkLayoutDescription: t("examSeatBulkLayoutDescription"),
        bulkScope: t("examSeatBulkScope"),
        bulkScopeCurrentRoom: t("examSeatBulkScopeCurrentRoom"),
        bulkScopeAllRooms: t("examSeatBulkScopeAllRooms"),
        bulkOrder: t("examSeatBulkOrder"),
        bulkOrderRow: t("examSeatBulkOrderRow"),
        bulkOrderSnake: t("examSeatBulkOrderSnake"),
        bulkPattern: t("examSeatBulkPattern"),
        bulkPatternAll: t("examSeatBulkPatternAll"),
        bulkPatternCheckerboardA: t("examSeatBulkPatternCheckerboardA"),
        bulkPatternCheckerboardB: t("examSeatBulkPatternCheckerboardB"),
        startNumber: t("examSeatStartNumber"),
        startNumberDescription: t("examSeatStartNumberDescription"),
        startNumberPositive: t("examSeatStartNumberPositive"),
        stepNumber: t("examSeatStepNumber"),
        stepNumberDescription: t("examSeatStepNumberDescription"),
        stepNumberPositive: t("examSeatStepNumberPositive"),
        numberingPresets: t("examSeatNumberingPresets"),
        numberingPresetSequential: t("examSeatNumberingPresetSequential"),
        numberingPresetOdd: t("examSeatNumberingPresetOdd"),
        numberingPresetEven: t("examSeatNumberingPresetEven"),
        sectionNumbering: t("examSeatSectionNumbering"),
        sectionLayout: t("examSeatSectionLayout"),
        eligibleSeats: t("examSeatEligibleSeats"),
        bulkNumberSeats: t("examSeatBulkNumberSeats"),
        bulkFillStudents: t("examSeatBulkFillStudents"),
        mapLegendAssigned: t("examSeatMapLegendAssigned"),
        mapLegendEmpty: t("examSeatMapLegendEmpty"),
        mapLegendConflict: t("examSeatMapLegendConflict"),
        mapLegendTeacher: t("examSeatMapLegendTeacher"),
        mapEmptyRoom: t("examSeatMapEmptyRoom"),
        seatSearch: t("examSeatSeatSearch"),
        seatSearchPlaceholder: t("examSeatSeatSearchPlaceholder"),
        quickAssignMatches: t("examSeatQuickAssignMatches"),
        quickAssignHint: t("examSeatQuickAssignHint"),
        quickAssignEnter: t("examSeatQuickAssignEnter"),
        quickAssignFirst: t("examSeatQuickAssignFirst"),
        noStudentMatch: t("examSeatNoStudentMatch"),
        seatNumberEnterHint: t("examSeatSeatNumberEnterHint"),
        currentStudent: t("examSeatCurrentStudent"),
        unassignedOnlyHint: t("examSeatUnassignedOnlyHint"),
        invigilatorDesk: t("examSeatInvigilatorDesk"),
        multiSelectHint: t("examSeatMultiSelectHint"),
        selectedDesksTitle: t("examSeatSelectedDesksTitle"),
        selectedDesksDescription: t("examSeatSelectedDesksDescription"),
        selectedDesks: t("examSeatSelectedDesks"),
        clearSelected: t("examSeatClearSelected"),
        assignSelected: t("examSeatAssignSelected"),
        numberSelected: t("examSeatNumberSelected"),
        selectionTools: t("examSeatSelectionTools"),
        selectionAllRoom: t("examSeatSelectionAllRoom"),
        selectionCurrentRow: t("examSeatSelectionCurrentRow"),
        selectionOddColumns: t("examSeatSelectionOddColumns"),
        selectionEvenColumns: t("examSeatSelectionEvenColumns"),
        selectionCheckerboardA: t("examSeatSelectionCheckerboardA"),
        selectionCheckerboardB: t("examSeatSelectionCheckerboardB"),
        selectionReset: t("examSeatSelectionReset"),
        noSelectionPresetMatch: t("examSeatNoSelectionPresetMatch"),
        noSelectedDesks: t("examSeatNoSelectedDesks"),
        selectedNumbered: t("examSeatSelectedNumbered"),
        selectedNumberedDescription: t("examSeatSelectedNumberedDescription"),
        selectedCleared: t("examSeatSelectedCleared"),
        selectedClearedDescription: t("examSeatSelectedClearedDescription"),
        selectedPlaced: t("examSeatSelectedPlaced"),
        selectedPlacedDescription: t("examSeatSelectedPlacedDescription"),
        hotkeysTitle: t("examSeatHotkeysTitle"),
        hotkeyNextDesk: t("examSeatHotkeyNextDesk"),
        hotkeyNextIssue: t("examSeatHotkeyNextIssue"),
        hotkeySearch: t("examSeatHotkeySearch"),
        hotkeySave: t("examSeatHotkeySave"),
        validationTitle: t("examSeatValidationTitle"),
        validationDescription: t("examSeatValidationDescription"),
        validationReady: t("examSeatValidationReady"),
        validationFixBeforeSave: t("examSeatValidationFixBeforeSave"),
        validationInvalidSeatNumber: t("examSeatValidationInvalidSeatNumber"),
        validationDuplicateStudent: t("examSeatValidationDuplicateStudent"),
        validationDuplicateSeat: t("examSeatValidationDuplicateSeat"),
        validationJump: t("examSeatValidationJump"),
        autoAdvanceCleanup: t("examSeatAutoAdvanceCleanup"),
        autoAdvanceCleanupDescription: t("examSeatAutoAdvanceCleanupDescription"),
        issuesTitle: t("examSeatIssuesTitle"),
        issuesDescription: t("examSeatIssuesDescription"),
        issueNoStudent: t("examSeatIssueNoStudent"),
        issueNoSeatNumber: t("examSeatIssueNoSeatNumber"),
        issueDuplicateNumber: t("examSeatIssueDuplicateNumber"),
        noIssues: t("examSeatNoIssues"),
        nextIssue: t("examSeatNextIssue"),
        jumpToIssue: t("examSeatJumpToIssue"),
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">
                        {labels.plannerTitle}
                    </h2>
                    <p className="text-sm text-default-500">
                        {labels.plannerDescription}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="flat"
                        isDisabled={!isCourseActive}
                        onPress={() => {
                            setIsImportOpen(true);
                            setImportStep(1);
                        }}
                    >
                        <Icon icon="solar:upload-linear" className="mr-1" />
                        {labels.importKkuFile}
                    </Button>
                    <Button
                        className="bg-linear-to-r from-sky-500 via-cyan-500 to-teal-500 text-white"
                        isDisabled={!isCourseActive}
                        onPress={async () => {
                            setIsCreateOpen(true);
                            if (!catalogLoadedRef.current) {
                                try {
                                    await ensureCatalogLoaded();
                                } catch {
                                    return;
                                }
                            }
                        }}
                    >
                        <Icon icon="solar:add-circle-bold" className="mr-1" />
                        {labels.createExam}
                    </Button>
                </div>
            </div>

            {plannerSession && (
                <Card className="overflow-hidden border border-default-200 shadow-sm">
                    <CardBody className="gap-5 p-0">
                        <div className="border-b border-divider bg-content2/60 px-5 py-4">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Chip size="sm" variant="flat" color="primary">
                                            {labels.plannerBadge}
                                        </Chip>
                                        {plannerSession.exam_setting && (
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color={plannerSession.exam_setting.exam_type === "midterm" ? "primary" : "secondary"}
                                            >
                                                {buildSessionLabel(plannerSession, isEnglish, t("examSeatSessionFallback", { id: plannerSession.id }))}
                                            </Chip>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">
                                            {buildSessionLabel(plannerSession, isEnglish, t("examSeatSessionFallback", { id: plannerSession.id }))}
                                        </h3>
                                        <p className="text-sm text-default-500">
                                            {formatExamDate(plannerSession.exam_date, isEnglish)} · {plannerSession.start_time}–{plannerSession.end_time}
                                        </p>
                                    </div>
                                    {plannerSession.notes && (
                                        <p className="text-sm text-default-500">{plannerSession.notes}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="flat" onPress={() => setPlannerSession(null)}>
                                        <Icon icon="solar:close-circle-linear" className="mr-1" />
                                        {labels.closePlanner}
                                    </Button>
                                    <Button variant="flat" onPress={() => handlePrint(plannerSession)}>
                                        <Icon icon="solar:printer-linear" className="mr-1" />
                                        {t("printExamSheet")}
                                    </Button>
                                    <Button
                                        variant="flat"
                                        color="warning"
                                        isDisabled={!isCourseActive || plannerRows.length === 0}
                                        onPress={handleClearSavedSeats}
                                    >
                                        <Icon icon="solar:trash-bin-minimalistic-linear" className="mr-1" />
                                        {labels.clearSavedSeats}
                                    </Button>
                                    <Button
                                        className="bg-linear-to-r from-sky-500 via-cyan-500 to-teal-500 text-white"
                                        isDisabled={!isCourseActive}
                                        isLoading={isSavingPlan}
                                        onPress={handleSavePlanner}
                                    >
                                        <Icon icon="solar:diskette-linear" className="mr-1" />
                                        {labels.savePlanner}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {isPlannerLoading ? (
                            <div className="flex justify-center py-16">
                                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500" />
                            </div>
                        ) : (
                            <div className="space-y-5 p-5">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <Card className="border border-default-200 bg-content1 shadow-none">
                                        <CardBody className="gap-1 p-4">
                                            <span className="text-xs uppercase tracking-wide text-default-400">
                                                {labels.roomsSummary}
                                            </span>
                                            <span className="text-2xl font-semibold text-foreground">{selectedRoomIds.length}</span>
                                        </CardBody>
                                    </Card>
                                    <Card className="border border-default-200 bg-content1 shadow-none">
                                        <CardBody className="gap-1 p-4">
                                            <span className="text-xs uppercase tracking-wide text-default-400">
                                                {labels.desksInPlan}
                                            </span>
                                            <span className="text-2xl font-semibold text-foreground">{plannerRows.length}</span>
                                        </CardBody>
                                    </Card>
                                    <Card className="border border-default-200 bg-content1 shadow-none">
                                        <CardBody className="gap-1 p-4">
                                            <span className="text-xs uppercase tracking-wide text-default-400">
                                                {labels.assignedStudents}
                                            </span>
                                            <span className="text-2xl font-semibold text-foreground">{assignedCount}</span>
                                        </CardBody>
                                    </Card>
                                    <Card className="border border-default-200 bg-content1 shadow-none">
                                        <CardBody className="gap-1 p-4">
                                            <span className="text-xs uppercase tracking-wide text-default-400">
                                                {labels.unassignedStudents}
                                            </span>
                                            <span className="text-2xl font-semibold text-foreground">{unassignedStudents.length}</span>
                                        </CardBody>
                                    </Card>
                                </div>

                                <Card className="border border-default-200 bg-content1 shadow-none">
                                    <CardBody className="gap-4 p-4">
                                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <h4 className="font-semibold text-foreground">
                                                    {labels.chooseRoomsStep}
                                                </h4>
                                                <p className="text-sm text-default-500">
                                                    {labels.chooseRoomsDescription}
                                                </p>
                                            </div>
                                            {selectedRooms.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedRooms.map((room) => (
                                                        <Chip key={room.id} size="sm" variant="flat">
                                                            {room.name}
                                                        </Chip>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <Select
                                            label={labels.examRooms}
                                            placeholder={labels.selectRoomsPlaceholder}
                                            selectionMode="multiple"
                                            selectedKeys={new Set(selectedRoomIds)}
                                            isDisabled={!isCourseActive || isCatalogLoading}
                                            onSelectionChange={(keys) => handlePlannerRoomChange(selectionToArray(keys as "all" | Set<Key>))}
                                        >
                                            {availableClassrooms.map((classroom) => (
                                                <SelectItem key={classroom.id} textValue={classroom.name}>
                                                    {`${classroom.name} · ${classroom.building} ${classroom.floor}`}
                                                </SelectItem>
                                            ))}
                                        </Select>
                                    </CardBody>
                                </Card>

                                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_360px]">
                                    <Card className="border border-default-200 bg-content1 shadow-none">
                                        <CardBody className="gap-4 p-4">
                                            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                                                <div>
                                                    <h4 className="font-semibold text-foreground">
                                                        {labels.assignStep}
                                                    </h4>
                                                    <p className="text-sm text-default-500">
                                                        {labels.assignDescription}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant={plannerViewMode === "map" ? "solid" : "flat"}
                                                        color={plannerViewMode === "map" ? "primary" : "default"}
                                                        onPress={() => setPlannerViewMode("map")}
                                                    >
                                                        <Icon icon="solar:map-point-bold-duotone" className="mr-1" />
                                                        {labels.mapView}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={plannerViewMode === "list" ? "solid" : "flat"}
                                                        color={plannerViewMode === "list" ? "primary" : "default"}
                                                        onPress={() => setPlannerViewMode("list")}
                                                    >
                                                        <Icon icon="solar:list-bold-duotone" className="mr-1" />
                                                        {labels.listView}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* ── Status bar ── */}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-default-200 bg-content2/50 px-4 py-2.5">
                                                <span className="text-xs font-semibold text-default-600">{labels.bulkLayoutTitle}</span>
                                                <span className="select-none text-default-300">·</span>
                                                <Chip size="sm" variant="flat" color="primary">
                                                    {labels.eligibleSeats}: {bulkContext.eligibleEntries.length}
                                                </Chip>
                                                <Chip size="sm" variant="flat" color={saveValidationIssues.length > 0 ? "danger" : "success"}>
                                                    {labels.validationTitle}: {saveValidationIssues.length}
                                                </Chip>
                                                <Chip size="sm" variant="flat" color={plannerIssueRows.length > 0 ? "warning" : "success"}>
                                                    {labels.statusColumn}: {plannerIssueRows.length}
                                                </Chip>
                                                {activeRoom && (
                                                    <Chip size="sm" variant="flat">
                                                        {labels.activeRoom}: {activeRoom.name}
                                                    </Chip>
                                                )}
                                            </div>

                                            {/* ── Two-panel: Numbering + Layout ── */}
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-2.5 rounded-xl border border-default-200 bg-content2/20 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-default-500">{labels.sectionNumbering}</p>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            size="sm"
                                                            label={labels.startNumber}
                                                            value={seatNumberStart}
                                                            onValueChange={updateSeatNumberStartValue}
                                                            isInvalid={!seatNumberStartValid}
                                                            errorMessage={!seatNumberStartValid ? labels.startNumberPositive : undefined}
                                                            className="flex-1"
                                                        />
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            size="sm"
                                                            label={labels.stepNumber}
                                                            value={seatNumberStep}
                                                            onValueChange={updateSeatNumberStepValue}
                                                            isInvalid={!seatNumberStepValid}
                                                            errorMessage={!seatNumberStepValid ? labels.stepNumberPositive : undefined}
                                                            className="flex-1"
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant={seatNumberStart === "1" && seatNumberStep === "1" ? "solid" : "flat"}
                                                            color={seatNumberStart === "1" && seatNumberStep === "1" ? "primary" : "default"}
                                                            onPress={() => applyNumberingPreset("1", "1")}
                                                        >
                                                            {labels.numberingPresetSequential}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant={seatNumberStart === "1" && seatNumberStep === "2" ? "solid" : "flat"}
                                                            color={seatNumberStart === "1" && seatNumberStep === "2" ? "primary" : "default"}
                                                            onPress={() => applyNumberingPreset("1", "2")}
                                                        >
                                                            {labels.numberingPresetOdd}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant={seatNumberStart === "2" && seatNumberStep === "2" ? "solid" : "flat"}
                                                            color={seatNumberStart === "2" && seatNumberStep === "2" ? "primary" : "default"}
                                                            onPress={() => applyNumberingPreset("2", "2")}
                                                        >
                                                            {labels.numberingPresetEven}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2.5 rounded-xl border border-default-200 bg-content2/20 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-default-500">{labels.sectionLayout}</p>
                                                    <Select
                                                        size="sm"
                                                        label={labels.bulkScope}
                                                        selectedKeys={new Set([bulkScopeMode])}
                                                        onSelectionChange={(keys) => {
                                                            const nextValue = singleSelection(keys as "all" | Set<Key>);
                                                            if (nextValue) {
                                                                setBulkScopeMode(nextValue as BulkScopeMode);
                                                            }
                                                        }}
                                                    >
                                                        <SelectItem key="current-room" textValue={labels.bulkScopeCurrentRoom}>
                                                            {labels.bulkScopeCurrentRoom}
                                                        </SelectItem>
                                                        <SelectItem key="all-rooms" textValue={labels.bulkScopeAllRooms}>
                                                            {labels.bulkScopeAllRooms}
                                                        </SelectItem>
                                                    </Select>
                                                    <Select
                                                        size="sm"
                                                        label={labels.bulkOrder}
                                                        selectedKeys={new Set([bulkOrderMode])}
                                                        onSelectionChange={(keys) => {
                                                            const nextValue = singleSelection(keys as "all" | Set<Key>);
                                                            if (nextValue) {
                                                                setBulkOrderMode(nextValue as BulkOrderMode);
                                                            }
                                                        }}
                                                    >
                                                        <SelectItem key="row" textValue={labels.bulkOrderRow}>
                                                            {labels.bulkOrderRow}
                                                        </SelectItem>
                                                        <SelectItem key="snake" textValue={labels.bulkOrderSnake}>
                                                            {labels.bulkOrderSnake}
                                                        </SelectItem>
                                                    </Select>
                                                    <Select
                                                        size="sm"
                                                        label={labels.bulkPattern}
                                                        selectedKeys={new Set([bulkPatternMode])}
                                                        onSelectionChange={(keys) => {
                                                            const nextValue = singleSelection(keys as "all" | Set<Key>);
                                                            if (nextValue) {
                                                                setBulkPatternMode(nextValue as BulkPatternMode);
                                                            }
                                                        }}
                                                    >
                                                        <SelectItem key="all" textValue={labels.bulkPatternAll}>
                                                            {labels.bulkPatternAll}
                                                        </SelectItem>
                                                        <SelectItem key="checkerboardA" textValue={labels.bulkPatternCheckerboardA}>
                                                            {labels.bulkPatternCheckerboardA}
                                                        </SelectItem>
                                                        <SelectItem key="checkerboardB" textValue={labels.bulkPatternCheckerboardB}>
                                                            {labels.bulkPatternCheckerboardB}
                                                        </SelectItem>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* ── Bulk action buttons ── */}
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="flat" onPress={handleAutoNumber} isDisabled={plannerRows.length === 0}>
                                                    <Icon icon="solar:sort-linear" className="mr-1" />
                                                    {labels.bulkNumberSeats}
                                                </Button>
                                                <Button size="sm" variant="flat" onPress={handleAutoAssignStudents} isDisabled={plannerRows.length === 0 || enrolledStudents.length === 0}>
                                                    <Icon icon="solar:users-group-rounded-linear" className="mr-1" />
                                                    {labels.bulkFillStudents}
                                                </Button>
                                                <Button size="sm" variant="flat" color="warning" onPress={handleResetPlanner} isDisabled={plannerRows.length === 0}>
                                                    <Icon icon="solar:restart-linear" className="mr-1" />
                                                    {labels.resetPlanner}
                                                </Button>
                                            </div>

                                            {plannerRows.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-default-300 bg-content2/40 px-6 py-12 text-center">
                                                    <Icon icon="solar:armchair-bold-duotone" className="mx-auto mb-3 text-5xl text-default-300" />
                                                    <p className="font-medium text-default-700">
                                                        {labels.selectRoomPrompt}
                                                    </p>
                                                </div>
                                            ) : plannerViewMode === "map" ? (
                                                <div className="space-y-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                        <div>
                                                            <h5 className="font-semibold text-foreground">{labels.roomLayout}</h5>
                                                            <p className="text-sm text-default-500">{labels.roomLayoutDescription}</p>
                                                            <p className="mt-1 text-xs text-default-400">{labels.multiSelectHint}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedRooms.map((room) => (
                                                                <Button
                                                                    key={room.id}
                                                                    size="sm"
                                                                    variant={activeRoom?.id === room.id ? "solid" : "flat"}
                                                                    color={activeRoom?.id === room.id ? "primary" : "default"}
                                                                    onPress={() => setActiveMapRoomId(room.id)}
                                                                >
                                                                    {room.name}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-default-200 bg-content2/30 p-3">
                                                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                                            <div>
                                                                <p className="text-sm font-medium text-foreground">{labels.selectionTools}</p>
                                                                <p className="text-xs text-default-500">{labels.multiSelectHint}</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <Button size="sm" variant="flat" onPress={() => applySelectionPreset("all")}>
                                                                    {labels.selectionAllRoom}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="flat"
                                                                    onPress={() => applySelectionPreset("currentRow")}
                                                                    isDisabled={!selectedPhysicalEntry}
                                                                >
                                                                    {labels.selectionCurrentRow}
                                                                </Button>
                                                                <Button size="sm" variant="flat" onPress={() => applySelectionPreset("oddColumns")}>
                                                                    {labels.selectionOddColumns}
                                                                </Button>
                                                                <Button size="sm" variant="flat" onPress={() => applySelectionPreset("evenColumns")}>
                                                                    {labels.selectionEvenColumns}
                                                                </Button>
                                                                <Button size="sm" variant="flat" onPress={() => applySelectionPreset("checkerboardA")}>
                                                                    {labels.selectionCheckerboardA}
                                                                </Button>
                                                                <Button size="sm" variant="flat" onPress={() => applySelectionPreset("checkerboardB")}>
                                                                    {labels.selectionCheckerboardB}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="flat"
                                                                    color="warning"
                                                                    onPress={() => setSelectedDeskIds(selectedDeskId ? [selectedDeskId] : [])}
                                                                >
                                                                    {labels.selectionReset}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!activeRoom || !activeRoomMetrics ? (
                                                        <div className="rounded-2xl border border-dashed border-default-300 bg-content2/40 px-6 py-12 text-center text-sm text-default-500">
                                                            {labels.mapEmptyRoom}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="rounded-3xl border border-default-200 bg-linear-to-br from-content2 via-content1 to-content2 p-4 shadow-sm">
                                                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-foreground">{activeRoom.name}</p>
                                                                        <p className="text-xs text-default-500">{activeRoom.building} {activeRoom.floor}</p>
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <Chip size="sm" variant="flat">
                                                                            {activeRoomRows.length} {labels.desksInPlan.toLowerCase()}
                                                                        </Chip>
                                                                        <Chip size="sm" variant="flat" color={selectedAssignableRows.length > 1 ? "secondary" : "default"}>
                                                                            {labels.selectedDesks}: {selectedAssignableRows.length}
                                                                        </Chip>
                                                                    </div>
                                                                </div>

                                                                <div className="overflow-x-auto pb-1">
                                                                    <div style={{ minWidth: "680px" }}>
                                                                        <div
                                                                            className="relative overflow-hidden rounded-3xl border border-default-200 bg-content1/80"
                                                                            style={{ aspectRatio: `${activeRoomMetrics.width} / ${activeRoomMetrics.height}` }}
                                                                        >
                                                                            {(activeRoom.zones ?? []).map((zone) => {
                                                                                const left = ((zone.x - activeRoomMetrics.minX) / activeRoomMetrics.width) * 100;
                                                                                const top = ((zone.y - activeRoomMetrics.minY) / activeRoomMetrics.height) * 100;
                                                                                const width = (zone.width / activeRoomMetrics.width) * 100;
                                                                                const height = (zone.height / activeRoomMetrics.height) * 100;

                                                                                return (
                                                                                    <div
                                                                                        key={zone.id}
                                                                                        className="pointer-events-none absolute rounded-2xl border border-dashed bg-content2/35"
                                                                                        style={{
                                                                                            left: `${left}%`,
                                                                                            top: `${top}%`,
                                                                                            width: `${width}%`,
                                                                                            height: `${height}%`,
                                                                                            borderColor: zone.color || undefined,
                                                                                        }}
                                                                                    >
                                                                                        <span className="absolute left-3 top-2 text-[11px] font-medium text-default-500">
                                                                                            {zone.name}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}

                                                                            {activeRoomEntries.map((entry) => {
                                                                                const { width, height } = getPlannerDeskSize(entry.desk);
                                                                                const left = ((entry.desk.x - activeRoomMetrics.minX) / activeRoomMetrics.width) * 100;
                                                                                const top = ((entry.desk.y - activeRoomMetrics.minY) / activeRoomMetrics.height) * 100;
                                                                                const widthPct = (width / activeRoomMetrics.width) * 100;
                                                                                const heightPct = (height / activeRoomMetrics.height) * 100;
                                                                                const isSelected = entry.row.desk_id === selectedDeskId;
                                                                                const isMultiSelected = selectedDeskIds.includes(entry.row.desk_id);
                                                                                const hasSeatConflict = entry.row.seat_number ? duplicateSeatNumbers.has(entry.row.seat_number) : false;
                                                                                const assignedStudent = enrolledStudents.find(
                                                                                    (student) => String(student.id) === entry.row.student_id
                                                                                );
                                                                                const isTeacherDesk = entry.desk.type === "teacher";

                                                                                return (
                                                                                    <button
                                                                                        key={entry.row.desk_id}
                                                                                        type="button"
                                                                                        className={[
                                                                                            "absolute rounded-2xl border p-2 text-left transition-all",
                                                                                            isSelected
                                                                                                ? "z-10 border-sky-500 bg-sky-500/15 shadow-lg ring-2 ring-sky-300/70"
                                                                                                : isMultiSelected
                                                                                                    ? "z-10 border-cyan-400 bg-cyan-500/10 ring-2 ring-cyan-200/70"
                                                                                                : hasSeatConflict
                                                                                                    ? "border-danger bg-danger/10"
                                                                                                    : assignedStudent
                                                                                                        ? "border-emerald-300 bg-emerald-500/10 hover:border-emerald-400"
                                                                                                        : isTeacherDesk
                                                                                                            ? "border-amber-300 bg-amber-500/10 hover:border-amber-400"
                                                                                                            : "border-default-200 bg-content1/85 hover:border-sky-300 hover:bg-sky-500/5",
                                                                                        ].join(" ")}
                                                                                        style={{
                                                                                            left: `${left}%`,
                                                                                            top: `${top}%`,
                                                                                            width: `${widthPct}%`,
                                                                                            height: `${heightPct}%`,
                                                                                        }}
                                                                                        onClick={(event) => selectPlannerDesk(entry.row.desk_id, event.metaKey || event.ctrlKey ? "toggle" : "replace")}
                                                                                    >
                                                                                        <div className="flex h-full flex-col justify-between gap-1 overflow-hidden">
                                                                                            <div className="flex items-start justify-between gap-2">
                                                                                                <span className="text-[10px] font-medium uppercase tracking-wide text-default-400">
                                                                                                    {isTeacherDesk ? labels.invigilatorDesk : `${labels.deskColumn} ${entry.row.desk_number}`}
                                                                                                </span>
                                                                                                {entry.row.seat_number ? (
                                                                                                    <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
                                                                                                        {entry.row.seat_number}
                                                                                                    </span>
                                                                                                ) : null}
                                                                                            </div>
                                                                                            <div className="space-y-0.5">
                                                                                                <p className="truncate text-sm font-semibold text-foreground">
                                                                                                    {assignedStudent ? assignedStudent.full_name : labels.notAssigned}
                                                                                                </p>
                                                                                                <p className="truncate text-[11px] text-default-500">
                                                                                                    {assignedStudent ? assignedStudent.student_id : `#${entry.row.desk_number}`}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-3 text-xs text-default-500">
                                                                <span className="inline-flex items-center gap-2 rounded-full bg-content2 px-3 py-1">
                                                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                                                                    {labels.mapLegendAssigned}
                                                                </span>
                                                                <span className="inline-flex items-center gap-2 rounded-full bg-content2 px-3 py-1">
                                                                    <span className="h-2.5 w-2.5 rounded-full bg-default-300" />
                                                                    {labels.mapLegendEmpty}
                                                                </span>
                                                                <span className="inline-flex items-center gap-2 rounded-full bg-content2 px-3 py-1">
                                                                    <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
                                                                    {labels.mapLegendConflict}
                                                                </span>
                                                                <span className="inline-flex items-center gap-2 rounded-full bg-content2 px-3 py-1">
                                                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                                                                    {labels.mapLegendTeacher}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="overflow-hidden rounded-2xl border border-default-200">
                                                    <div className="max-h-140 overflow-auto">
                                                        <table className="w-full min-w-180 text-sm">
                                                            <thead className="sticky top-0 z-10 bg-content2/95 backdrop-blur">
                                                                <tr className="border-b border-divider text-left text-default-500">
                                                                    <th className="px-4 py-3 font-medium">{labels.seatNo}</th>
                                                                    <th className="px-4 py-3 font-medium">{labels.roomColumn}</th>
                                                                    <th className="px-4 py-3 font-medium">{labels.deskColumn}</th>
                                                                    <th className="px-4 py-3 font-medium">{labels.studentColumn}</th>
                                                                    <th className="px-4 py-3 font-medium">{labels.statusColumn}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {plannerRows.map((row) => {
                                                                    const isSelected = row.desk_id === selectedDeskId;
                                                                    const isMultiSelected = selectedDeskIds.includes(row.desk_id);
                                                                    const hasSeatConflict = row.seat_number ? duplicateSeatNumbers.has(row.seat_number) : false;
                                                                    const assignedStudent = enrolledStudents.find(
                                                                        (student) => String(student.id) === row.student_id
                                                                    );

                                                                    return (
                                                                        <tr
                                                                            key={row.desk_id}
                                                                            className={[
                                                                                "cursor-pointer border-b border-divider/70 transition-colors last:border-0",
                                                                                isSelected
                                                                                    ? "bg-sky-500/10"
                                                                                    : isMultiSelected
                                                                                        ? "bg-cyan-500/10"
                                                                                        : "hover:bg-content2/50",
                                                                            ].join(" ")}
                                                                            onClick={(event) => selectPlannerDesk(row.desk_id, event.metaKey || event.ctrlKey ? "toggle" : "replace")}
                                                                        >
                                                                            <td className="px-4 py-3">
                                                                                {row.seat_number ? (
                                                                                    <Chip
                                                                                        size="sm"
                                                                                        variant="flat"
                                                                                        color={hasSeatConflict ? "danger" : "primary"}
                                                                                    >
                                                                                        {row.seat_number}
                                                                                    </Chip>
                                                                                ) : (
                                                                                    <span className="text-default-400">—</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-default-600">{row.classroom_name}</td>
                                                                            <td className="px-4 py-3 font-medium text-foreground">{row.desk_number}</td>
                                                                            <td className="px-4 py-3">
                                                                                {assignedStudent ? (
                                                                                    <div className="space-y-0.5">
                                                                                        <p className="font-medium text-foreground">{assignedStudent.full_name}</p>
                                                                                        <p className="text-xs text-default-500">
                                                                                            {assignedStudent.student_id}
                                                                                            {assignedStudent.section_no ? ` · ${labels.sectionShort} ${assignedStudent.section_no}` : ""}
                                                                                        </p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-default-400">
                                                                                        {labels.notAssigned}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                {hasSeatConflict ? (
                                                                                    <Chip size="sm" variant="flat" color="danger">
                                                                                        {labels.seatConflict}
                                                                                    </Chip>
                                                                                ) : row.student_id ? (
                                                                                    <Chip size="sm" variant="flat" color="success">
                                                                                        {labels.assignedStatus}
                                                                                    </Chip>
                                                                                ) : (
                                                                                    <Chip size="sm" variant="flat">
                                                                                        {labels.openDesk}
                                                                                    </Chip>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </CardBody>
                                    </Card>

                                    <div className="space-y-5">
                                        {selectedAssignableRows.length > 1 && (
                                            <Card className="border border-default-200 bg-content1 shadow-none">
                                                <CardBody className="gap-4 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h4 className="font-semibold text-foreground">
                                                                {labels.selectedDesksTitle}
                                                            </h4>
                                                            <p className="text-sm text-default-500">
                                                                {labels.selectedDesksDescription}
                                                            </p>
                                                        </div>
                                                        <Chip size="sm" variant="flat" color="secondary">
                                                            {selectedAssignableRows.length}
                                                        </Chip>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <Chip size="sm" variant="flat" color="primary">
                                                            {labels.openDesk}: {selectedAssignableRows.filter((row) => !row.student_id).length}
                                                        </Chip>
                                                        <Chip size="sm" variant="flat">
                                                            {labels.assignedStudents}: {selectedAssignableRows.filter((row) => row.student_id).length}
                                                        </Chip>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        <Button size="sm" variant="flat" color="primary" onPress={handleAssignSelectedDesks}>
                                                            <Icon icon="solar:users-group-rounded-linear" className="mr-1" />
                                                            {labels.assignSelected}
                                                        </Button>
                                                        <Button size="sm" variant="flat" onPress={handleNumberSelectedDesks}>
                                                            <Icon icon="solar:sort-linear" className="mr-1" />
                                                            {labels.numberSelected}
                                                        </Button>
                                                        <Button size="sm" variant="flat" color="warning" onPress={handleClearSelectedDesks}>
                                                            <Icon icon="solar:trash-bin-minimalistic-linear" className="mr-1" />
                                                            {labels.clearSelected}
                                                        </Button>
                                                    </div>

                                                    <div className="max-h-48 space-y-2 overflow-auto pr-1">
                                                        {selectedAssignableRows.map((row) => (
                                                            <div
                                                                key={row.desk_id}
                                                                className="rounded-2xl border border-default-200 bg-content2/40 px-3 py-2"
                                                            >
                                                                <p className="font-medium text-foreground">
                                                                    {row.classroom_name} · {labels.deskColumn} {row.desk_number}
                                                                </p>
                                                                <p className="text-xs text-default-500">
                                                                    {row.seat_number ? `${labels.seatNo} ${row.seat_number}` : labels.notAssigned}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        )}

                                        <Card className="border border-default-200 bg-content1 shadow-none">
                                            <CardBody className="gap-4 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">
                                                            {labels.validationTitle}
                                                        </h4>
                                                        <p className="text-sm text-default-500">
                                                            {labels.validationDescription}
                                                        </p>
                                                    </div>
                                                    <Chip size="sm" variant="flat" color={saveValidationIssues.length > 0 ? "danger" : "success"}>
                                                        {saveValidationIssues.length}
                                                    </Chip>
                                                </div>

                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    <Chip size="sm" variant="flat" color={invalidSeatNumberCount > 0 ? "warning" : "default"}>
                                                        {labels.validationInvalidSeatNumber}: {invalidSeatNumberCount}
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" color={duplicateStudentSaveCount > 0 ? "warning" : "default"}>
                                                        {labels.validationDuplicateStudent}: {duplicateStudentSaveCount}
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" color={duplicateSeatSaveCount > 0 ? "danger" : "default"}>
                                                        {labels.validationDuplicateSeat}: {duplicateSeatSaveCount}
                                                    </Chip>
                                                </div>

                                                {saveValidationIssues.length === 0 ? (
                                                    <div className="rounded-2xl bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-700 dark:text-emerald-300">
                                                        {labels.validationReady}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <div className="rounded-2xl border border-dashed border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
                                                            {labels.validationFixBeforeSave}
                                                        </div>
                                                        <div className="max-h-72 space-y-2 overflow-auto pr-1">
                                                            {saveValidationIssues.map((issue, index) => {
                                                                const issueLabel = issue.code === "seat_number_invalid"
                                                                    ? labels.validationInvalidSeatNumber
                                                                    : issue.code === "student_duplicate"
                                                                        ? labels.validationDuplicateStudent
                                                                        : labels.validationDuplicateSeat;

                                                                return (
                                                                    <button
                                                                        key={`${issue.row.desk_id}-${issue.code}-${index}`}
                                                                        type="button"
                                                                        className={[
                                                                            "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                                                                            issue.row.desk_id === selectedDeskId
                                                                                ? "border-sky-300 bg-sky-500/10"
                                                                                : "border-default-200 bg-content2/50 hover:border-sky-200 hover:bg-sky-500/5",
                                                                        ].join(" ")}
                                                                        onClick={() => focusPlannerDesk(issue.row.desk_id)}
                                                                    >
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div>
                                                                                <p className="font-medium text-foreground">
                                                                                    {issue.row.classroom_name} · {labels.deskColumn} {issue.row.desk_number}
                                                                                </p>
                                                                                <p className="text-xs text-default-500">
                                                                                    {issue.row.seat_number ? `${labels.seatNo} ${issue.row.seat_number}` : labels.validationInvalidSeatNumber}
                                                                                </p>
                                                                            </div>
                                                                            <Chip size="sm" variant="flat" color={issue.code === "seat_duplicate" ? "danger" : "warning"}>
                                                                                {issueLabel}
                                                                            </Chip>
                                                                        </div>
                                                                        <div className="mt-2 text-xs text-default-500">
                                                                            {labels.validationJump}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardBody>
                                        </Card>

                                        <Card className="border border-default-200 bg-content1 shadow-none">
                                            <CardBody className="gap-4 p-4">
                                                <div>
                                                    <h4 className="font-semibold text-foreground">
                                                        {labels.editDeskStep}
                                                    </h4>
                                                    <p className="text-sm text-default-500">
                                                        {labels.editDeskDescription}
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-default-200 bg-content2/30 px-3 py-2">
                                                    <Switch
                                                        isSelected={autoAdvanceCleanup}
                                                        onValueChange={setAutoAdvanceCleanup}
                                                        color="secondary"
                                                    >
                                                        {labels.autoAdvanceCleanup}
                                                    </Switch>
                                                    <p className="mt-1 text-xs text-default-500">
                                                        {labels.autoAdvanceCleanupDescription}
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-default-200 bg-content2/30 p-3">
                                                    <p className="text-sm font-medium text-foreground">{labels.hotkeysTitle}</p>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-default-500">
                                                        <Chip size="sm" variant="flat">J · {labels.hotkeyNextDesk}</Chip>
                                                        <Chip size="sm" variant="flat">K · {labels.hotkeyNextIssue}</Chip>
                                                        <Chip size="sm" variant="flat">/ · {labels.hotkeySearch}</Chip>
                                                        <Chip size="sm" variant="flat">Ctrl/Cmd+S · {labels.hotkeySave}</Chip>
                                                    </div>
                                                </div>

                                                {!selectedRow ? (
                                                    <div className="rounded-2xl border border-dashed border-default-300 px-4 py-8 text-center text-sm text-default-400">
                                                        {labels.selectDeskPrompt}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            <div className="rounded-2xl bg-content2/70 p-3">
                                                                <p className="text-xs uppercase tracking-wide text-default-400">
                                                                    {labels.roomColumn}
                                                                </p>
                                                                <p className="mt-1 font-semibold text-foreground">{selectedRow.classroom_name}</p>
                                                            </div>
                                                            <div className="rounded-2xl bg-content2/70 p-3">
                                                                <p className="text-xs uppercase tracking-wide text-default-400">
                                                                    {labels.deskColumn}
                                                                </p>
                                                                <p className="mt-1 font-semibold text-foreground">
                                                                    {selectedDesk?.type === "teacher"
                                                                        ? labels.invigilatorDesk
                                                                        : selectedRow.desk_number}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            label={t("seatNumber")}
                                                            value={selectedRow.seat_number}
                                                            onValueChange={(value) =>
                                                                updatePlannerRow(selectedRow.desk_id, {
                                                                    seat_number: value.replace(/[^0-9]/g, ""),
                                                                })
                                                            }
                                                            onKeyDown={(event) => {
                                                                if (event.key !== "Enter") {
                                                                    return;
                                                                }

                                                                event.preventDefault();
                                                                maybeAdvanceCleanup(buildUpdatedPlannerRows(plannerRows, selectedRow.desk_id, {}), selectedRow.desk_id);
                                                            }}
                                                            onBlur={() => maybeAdvanceCleanup(buildUpdatedPlannerRows(plannerRows, selectedRow.desk_id, {}), selectedRow.desk_id)}
                                                            isInvalid={selectedRow.seat_number ? duplicateSeatNumbers.has(selectedRow.seat_number) : false}
                                                            errorMessage={
                                                                selectedRow.seat_number && duplicateSeatNumbers.has(selectedRow.seat_number)
                                                                    ? t("examSeatDuplicateSeatNumberError")
                                                                    : undefined
                                                            }
                                                        />
                                                        <p className="-mt-1 text-xs text-default-500">
                                                            {labels.seatNumberEnterHint}
                                                        </p>

                                                        <div className="space-y-3 rounded-2xl border border-default-200 bg-content2/30 p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <p className="text-sm font-medium text-foreground">{labels.assignedStudent}</p>
                                                                    <p className="text-xs text-default-500">{labels.unassignedOnlyHint}</p>
                                                                </div>
                                                                {selectedStudent ? (
                                                                    <Chip size="sm" variant="flat" color="success">
                                                                        {labels.currentStudent}
                                                                    </Chip>
                                                                ) : null}
                                                            </div>

                                                            {selectedStudent ? (
                                                                <div className="rounded-2xl bg-content1/80 px-3 py-2">
                                                                    <p className="font-medium text-foreground">{selectedStudent.full_name}</p>
                                                                    <p className="text-xs text-default-500">
                                                                        {selectedStudent.student_id}
                                                                        {selectedStudent.section_no ? ` · ${labels.sectionShort} ${selectedStudent.section_no}` : ""}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-default-400">{labels.noStudentAssigned}</p>
                                                            )}

                                                            <Input
                                                                id={seatSearchInputId}
                                                                label={labels.seatSearch}
                                                                placeholder={labels.seatSearchPlaceholder}
                                                                value={studentSearchQuery}
                                                                onValueChange={setStudentSearchQuery}
                                                                startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                                                                onKeyDown={(event) => {
                                                                    if (event.key !== "Enter") {
                                                                        return;
                                                                    }

                                                                    event.preventDefault();
                                                                    assignFirstCandidate();
                                                                }}
                                                            />

                                                            <div className="flex items-center justify-between gap-2 text-xs text-default-500">
                                                                <span>{labels.quickAssignHint}</span>
                                                                <span>{labels.quickAssignMatches}: {candidateStudents.length}</span>
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-default-500">
                                                                <Chip size="sm" variant="flat" color="secondary">
                                                                    {labels.quickAssignEnter}
                                                                </Chip>
                                                                <Button
                                                                    size="sm"
                                                                    variant="flat"
                                                                    onPress={assignFirstCandidate}
                                                                    isDisabled={candidateStudents.length === 0}
                                                                >
                                                                    <Icon icon="solar:keyboard-linear" className="mr-1" />
                                                                    {labels.quickAssignFirst}
                                                                </Button>
                                                            </div>

                                                            <div className="max-h-72 space-y-2 overflow-auto pr-1">
                                                                {candidateStudents.map((student) => {
                                                                    const isCurrentStudent = selectedRow.student_id === String(student.id);

                                                                    return (
                                                                        <button
                                                                            key={student.id}
                                                                            type="button"
                                                                            className={[
                                                                                "w-full rounded-2xl border px-3 py-2 text-left transition-colors",
                                                                                isCurrentStudent
                                                                                    ? "border-sky-300 bg-sky-500/10"
                                                                                    : "border-default-200 bg-content1/80 hover:border-sky-200 hover:bg-sky-500/5",
                                                                            ].join(" ")}
                                                                            onClick={() =>
                                                                                updatePlannerRow(selectedRow.desk_id, {
                                                                                    student_id: String(student.id),
                                                                                }, { tryAdvanceCleanup: true })
                                                                            }
                                                                        >
                                                                            <p className="font-medium text-foreground">{student.full_name}</p>
                                                                            <p className="text-xs text-default-500">
                                                                                {student.student_id}
                                                                                {student.section_no ? ` · ${labels.sectionShort} ${student.section_no}` : ""}
                                                                            </p>
                                                                        </button>
                                                                    );
                                                                })}

                                                                {candidateStudents.length === 0 && (
                                                                    <div className="rounded-2xl border border-dashed border-default-300 px-3 py-4 text-center text-sm text-default-400">
                                                                        {labels.noStudentAssigned}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="flat"
                                                                color="warning"
                                                                onPress={() =>
                                                                    updatePlannerRow(selectedRow.desk_id, {
                                                                        student_id: "",
                                                                        seat_number: "",
                                                                    })
                                                                }
                                                            >
                                                                <Icon icon="solar:eraser-linear" className="mr-1" />
                                                                {labels.clearDesk}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="flat"
                                                                color="secondary"
                                                                onPress={goToNextIssue}
                                                                isDisabled={plannerIssueRows.length === 0}
                                                            >
                                                                <Icon icon="solar:danger-triangle-linear" className="mr-1" />
                                                                {labels.nextIssue}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="flat"
                                                                onPress={goToNextDesk}
                                                            >
                                                                <Icon icon="solar:arrow-right-linear" className="mr-1" />
                                                                {labels.nextDesk}
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </CardBody>
                                        </Card>

                                        <Card className="border border-default-200 bg-content1 shadow-none">
                                            <CardBody className="gap-4 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">
                                                            {labels.issuesTitle}
                                                        </h4>
                                                        <p className="text-sm text-default-500">
                                                            {labels.issuesDescription}
                                                        </p>
                                                    </div>
                                                    <Chip size="sm" variant="flat" color={plannerIssueRows.length > 0 ? "warning" : "success"}>
                                                        {plannerIssueRows.length}
                                                    </Chip>
                                                </div>

                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    <Chip size="sm" variant="flat" color={missingStudentCount > 0 ? "warning" : "default"}>
                                                        {labels.issueNoStudent}: {missingStudentCount}
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" color={missingSeatNumberCount > 0 ? "warning" : "default"}>
                                                        {labels.issueNoSeatNumber}: {missingSeatNumberCount}
                                                    </Chip>
                                                    <Chip size="sm" variant="flat" color={duplicateSeatIssueCount > 0 ? "danger" : "default"}>
                                                        {labels.issueDuplicateNumber}: {duplicateSeatIssueCount}
                                                    </Chip>
                                                </div>

                                                {plannerIssueRows.length === 0 ? (
                                                    <div className="rounded-2xl bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-700 dark:text-emerald-300">
                                                        {labels.noIssues}
                                                    </div>
                                                ) : (
                                                    <div className="max-h-80 space-y-2 overflow-auto pr-1">
                                                        {plannerIssuesInActiveRoom.map((row) => {
                                                            const desk = deskMap.get(row.desk_id);
                                                            const hasDuplicateSeat = row.seat_number ? duplicateSeatNumbers.has(row.seat_number) : false;
                                                            const issueLabel = hasDuplicateSeat
                                                                ? labels.issueDuplicateNumber
                                                                : !row.student_id
                                                                    ? labels.issueNoStudent
                                                                    : labels.issueNoSeatNumber;

                                                            return (
                                                                <button
                                                                    key={row.desk_id}
                                                                    type="button"
                                                                    className={[
                                                                        "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                                                                        row.desk_id === selectedDeskId
                                                                            ? "border-sky-300 bg-sky-500/10"
                                                                            : "border-default-200 bg-content2/50 hover:border-sky-200 hover:bg-sky-500/5",
                                                                    ].join(" ")}
                                                                    onClick={() => {
                                                                        focusPlannerDesk(row.desk_id);
                                                                    }}
                                                                >
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div>
                                                                            <p className="font-medium text-foreground">
                                                                                {row.classroom_name} · {labels.deskColumn} {desk?.number ?? row.desk_number}
                                                                            </p>
                                                                            <p className="text-xs text-default-500">
                                                                                {row.seat_number ? `${labels.seatNo} ${row.seat_number}` : labels.issueNoSeatNumber}
                                                                            </p>
                                                                        </div>
                                                                        <Chip size="sm" variant="flat" color={hasDuplicateSeat ? "danger" : "warning"}>
                                                                            {issueLabel}
                                                                        </Chip>
                                                                    </div>
                                                                    <div className="mt-2 text-xs text-default-500">
                                                                        {row.student_id
                                                                            ? enrolledStudents.find((student) => String(student.id) === row.student_id)?.full_name ?? labels.noStudentAssigned
                                                                            : labels.noStudentAssigned}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {plannerIssueRows.length > 0 && plannerIssuesInActiveRoom.length === 0 ? (
                                                    <div className="rounded-2xl border border-dashed border-default-300 px-4 py-4 text-center text-sm text-default-400">
                                                        {labels.jumpToIssue}
                                                    </div>
                                                ) : null}
                                            </CardBody>
                                        </Card>

                                        <Card className="border border-default-200 bg-content1 shadow-none">
                                            <CardBody className="gap-4 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">
                                                            {labels.studentsWithoutSeat}
                                                        </h4>
                                                        <p className="text-sm text-default-500">
                                                            {labels.studentsWithoutSeatDescription}
                                                        </p>
                                                    </div>
                                                    <Chip size="sm" variant="flat">
                                                        {unassignedStudents.length}
                                                    </Chip>
                                                </div>

                                                {unassignedStudents.length === 0 ? (
                                                    <div className="rounded-2xl bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-700 dark:text-emerald-300">
                                                        {labels.allStudentsAssigned}
                                                    </div>
                                                ) : (
                                                    <div className="max-h-80 space-y-2 overflow-auto pr-1">
                                                        {unassignedStudents.map((student) => (
                                                            <div
                                                                key={student.id}
                                                                className="rounded-2xl border border-default-200 bg-content2/50 px-3 py-2"
                                                            >
                                                                <p className="font-medium text-foreground">{student.full_name}</p>
                                                                <p className="text-xs text-default-500">
                                                                    {student.student_id}
                                                                    {student.section_no ? ` · ${labels.sectionShort} ${student.section_no}` : ""}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardBody>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-foreground">
                        {labels.sessionsTitle}
                    </h3>
                    {isCatalogLoading && (
                        <div className="flex items-center gap-2 text-sm text-default-400">
                            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-sky-500" />
                            {labels.loadingPlannerData}
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, index) => (
                            <div key={index} className="h-28 animate-pulse rounded-2xl bg-content2" />
                        ))}
                    </div>
                ) : sessions.length === 0 ? (
                    <Card className="border border-dashed border-default-300 bg-content2/40">
                        <CardBody className="py-16 text-center">
                            <Icon icon="solar:armchair-bold-duotone" className="mx-auto mb-4 text-5xl text-default-300" />
                            <h3 className="mb-1 font-semibold text-default-700">
                                {labels.noSessionsTitle}
                            </h3>
                            <p className="text-sm text-default-400">
                                {labels.noSessionsDescription}
                            </p>
                        </CardBody>
                    </Card>
                ) : (
                    <div className="grid gap-3 xl:grid-cols-2">
                        {sessions.map((session) => {
                            const isActivePlanner = plannerSession?.id === session.id;
                            const roomCount = session.rooms?.length ?? 0;

                            return (
                                <Card
                                    key={session.id}
                                    className={[
                                        "border shadow-sm transition-all",
                                        isActivePlanner
                                            ? "border-sky-400/60 bg-sky-500/5"
                                            : "border-default-200 hover:border-default-300 hover:shadow-md",
                                    ].join(" ")}
                                >
                                    <CardBody className="gap-4 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="font-semibold text-foreground">
                                                        {buildSessionLabel(session, isEnglish, t("examSeatSessionFallback", { id: session.id }))}
                                                    </h4>
                                                    {session.exam_setting && (
                                                        <Chip
                                                            size="sm"
                                                            variant="flat"
                                                            color={session.exam_setting.exam_type === "midterm" ? "primary" : "secondary"}
                                                        >
                                                            {session.exam_setting.exam_type === "midterm" ? t("midtermExam") : t("finalExam")}
                                                        </Chip>
                                                    )}
                                                    {isActivePlanner && (
                                                        <Chip size="sm" variant="flat" color="success">
                                                            {labels.openNow}
                                                        </Chip>
                                                    )}
                                                </div>
                                                <p className="text-sm text-default-500">
                                                    {formatExamDate(session.exam_date, isEnglish)} · {session.start_time}–{session.end_time}
                                                </p>
                                                <div className="flex flex-wrap gap-2 text-xs text-default-500">
                                                    <Chip size="sm" variant="flat">
                                                        {t("examSeatRoomCount", { count: roomCount })}
                                                    </Chip>
                                                    {session.rooms?.slice(0, 3).map((room) => (
                                                        <Chip key={room.id} size="sm" variant="flat">
                                                            {room.classroom?.name ?? room.classroom_id}
                                                        </Chip>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant={isActivePlanner ? "solid" : "flat"} onPress={() => void openPlanner(session)}>
                                                    <Icon icon="solar:chair-2-linear" className="mr-1" />
                                                    {labels.openPlanner}
                                                </Button>
                                                <Button size="sm" variant="flat" onPress={() => handlePrint(session)}>
                                                    <Icon icon="solar:printer-linear" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    color="danger"
                                                    isDisabled={!isCourseActive}
                                                    onPress={() => void handleDeleteSession(session.id)}
                                                >
                                                    <Icon icon="solar:trash-bin-minimalistic-linear" />
                                                </Button>
                                            </div>
                                        </div>

                                        {session.notes && <p className="text-sm text-default-500">{session.notes}</p>}
                                    </CardBody>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="lg">
                <ModalContent>
                    <ModalHeader>{labels.createSessionTitle}</ModalHeader>
                    <ModalBody className="gap-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                                {labels.defineExamStep}
                            </p>
                            <p className="text-sm text-default-500">
                                {labels.defineExamDescription}
                            </p>
                        </div>

                        <Select
                            label={labels.examType}
                            placeholder={labels.examType}
                            selectedKeys={createForm.exam_setting_id ? new Set([createForm.exam_setting_id]) : new Set()}
                            onSelectionChange={(keys) =>
                                setCreateForm((current) => ({
                                    ...current,
                                    exam_setting_id: singleSelection(keys as "all" | Set<Key>),
                                }))
                            }
                            isRequired
                        >
                            {settingOptions.map((option) => (
                                <SelectItem key={option.value}>{option.label}</SelectItem>
                            ))}
                        </Select>

                        <Input
                            type="date"
                            label={t("examDate")}
                            value={createForm.exam_date}
                            onValueChange={(value) => setCreateForm((current) => ({ ...current, exam_date: value }))}
                            isRequired
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                                type="time"
                                label={labels.startTime}
                                value={createForm.start_time}
                                onValueChange={(value) => setCreateForm((current) => ({ ...current, start_time: value }))}
                            />
                            <Input
                                type="time"
                                label={labels.endTime}
                                value={createForm.end_time}
                                onValueChange={(value) => setCreateForm((current) => ({ ...current, end_time: value }))}
                            />
                        </div>

                        <Input
                            label={labels.notes}
                            value={createForm.notes}
                            onValueChange={(value) => setCreateForm((current) => ({ ...current, notes: value }))}
                        />

                        <Select
                            label={labels.initialRoomsOptional}
                            placeholder={labels.selectRoomsPlaceholder}
                            selectionMode="multiple"
                            selectedKeys={new Set(createForm.classroom_ids)}
                            isDisabled={isCatalogLoading}
                            onSelectionChange={(keys) =>
                                setCreateForm((current) => ({
                                    ...current,
                                    classroom_ids: selectionToArray(keys as "all" | Set<Key>),
                                }))
                            }
                        >
                            {availableClassrooms.map((classroom) => (
                                <SelectItem key={classroom.id} textValue={classroom.name}>
                                    {`${classroom.name} · ${classroom.building} ${classroom.floor}`}
                                </SelectItem>
                            ))}
                        </Select>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={() => setIsCreateOpen(false)}>
                            {labels.cancel}
                        </Button>
                        <Button className="bg-linear-to-r from-sky-500 via-cyan-500 to-teal-500 text-white" isLoading={isCreating} onPress={handleCreateSession}>
                            {labels.createAndContinue}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isImportOpen}
                onClose={() => {
                    setIsImportOpen(false);
                    setImportStep(1);
                    setImportFile(null);
                    setImportPreview(null);
                }}
                size="2xl"
            >
                <ModalContent>
                    <ModalHeader>
                        {labels.importTitle}
                        <Chip size="sm" variant="flat" className="ml-2">
                            {t("examSeatStepProgress", { current: importStep, total: 3 })}
                        </Chip>
                    </ModalHeader>
                    <ModalBody className="gap-4">
                        {importStep === 1 && (
                            <div className="py-8 text-center">
                                <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
                                <div
                                    className="cursor-pointer rounded-2xl border-2 border-dashed border-default-300 p-10 transition-colors hover:border-sky-400"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Icon icon="solar:file-send-bold-duotone" className="mx-auto mb-3 text-5xl text-sky-400" />
                                    <p className="font-semibold text-default-700">
                                        {labels.chooseDocxFile}
                                    </p>
                                    <p className="mt-1 text-sm text-default-400">
                                        {labels.officialKkuFormat}
                                    </p>
                                    {importFile && (
                                        <p className="mt-4 text-xs text-default-500">{importFile.name}</p>
                                    )}
                                </div>
                                {isImporting && (
                                    <p className="mt-4 text-default-400">
                                        {labels.parsingFile}
                                    </p>
                                )}
                            </div>
                        )}

                        {importStep === 2 && importPreview && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                            {labels.matched}
                                        </p>
                                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                                            {importPreview.matched}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            {labels.studentNotFound}
                                        </p>
                                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-200">
                                            {importPreview.student_not_found}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                                        <p className="text-xs text-rose-700 dark:text-rose-300">
                                            {t("deskNotFound")}
                                        </p>
                                        <p className="text-2xl font-bold text-rose-700 dark:text-rose-200">
                                            {importPreview.desk_not_found}
                                        </p>
                                    </div>
                                </div>

                                <div className="max-h-60 overflow-y-auto rounded-2xl border border-default-200">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-content2 border-b border-divider">
                                            <tr>
                                                <th className="px-3 py-2 text-left">#</th>
                                                <th className="px-3 py-2 text-left">{t("studentId")}</th>
                                                <th className="px-3 py-2 text-left">{labels.nameColumn}</th>
                                                <th className="px-3 py-2 text-left">{labels.seatLabel}</th>
                                                <th className="px-3 py-2 text-center">{labels.statusColumn}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreview.rows.map((row) => (
                                                <tr key={row.row_num} className="border-b border-divider last:border-0">
                                                    <td className="px-3 py-2 text-default-400">{row.row_num}</td>
                                                    <td className="px-3 py-2">{row.student_id}</td>
                                                    <td className="max-w-32 truncate px-3 py-2">{row.full_name}</td>
                                                    <td className="px-3 py-2">{row.seat_label}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        {row.student_found && row.desk_found ? (
                                                            <Icon icon="solar:check-circle-bold" className="text-base text-emerald-500" />
                                                        ) : (
                                                            <Icon icon="solar:close-circle-bold" className="text-base text-rose-400" />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <p className="text-xs text-default-400">
                                    {labels.matchedRowsDescription}
                                </p>
                            </div>
                        )}

                        {importStep === 3 && (
                            <div className="space-y-4">
                                <p className="text-sm text-default-600">
                                    {labels.importedRosterDescription}
                                </p>
                                <Select
                                    label={labels.examType}
                                    selectedKeys={importForm.exam_setting_id ? new Set([importForm.exam_setting_id]) : new Set()}
                                    onSelectionChange={(keys) =>
                                        setImportForm((current) => ({
                                            ...current,
                                            exam_setting_id: singleSelection(keys as "all" | Set<Key>),
                                        }))
                                    }
                                    isRequired
                                >
                                    {settingOptions.map((option) => (
                                        <SelectItem key={option.value}>{option.label}</SelectItem>
                                    ))}
                                </Select>
                                <Input
                                    type="date"
                                    label={t("examDate")}
                                    value={importForm.exam_date}
                                    onValueChange={(value) => setImportForm((current) => ({ ...current, exam_date: value }))}
                                    isRequired
                                />
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Input
                                        type="time"
                                        label={labels.startTime}
                                        value={importForm.start_time}
                                        onValueChange={(value) => setImportForm((current) => ({ ...current, start_time: value }))}
                                    />
                                    <Input
                                        type="time"
                                        label={labels.endTime}
                                        value={importForm.end_time}
                                        onValueChange={(value) => setImportForm((current) => ({ ...current, end_time: value }))}
                                    />
                                </div>
                                <Input
                                    label={labels.notes}
                                    value={importForm.notes}
                                    onValueChange={(value) => setImportForm((current) => ({ ...current, notes: value }))}
                                />
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        {importStep === 1 && (
                            <Button variant="flat" onPress={() => setIsImportOpen(false)}>
                                {labels.cancel}
                            </Button>
                        )}
                        {importStep === 2 && (
                            <>
                                <Button
                                    variant="flat"
                                    onPress={() => {
                                        setImportStep(1);
                                        setImportFile(null);
                                        setImportPreview(null);
                                    }}
                                >
                                    {labels.back}
                                </Button>
                                <Button
                                    className="bg-linear-to-r from-sky-500 via-cyan-500 to-teal-500 text-white"
                                    isDisabled={(importPreview?.matched ?? 0) === 0}
                                    onPress={() => setImportStep(3)}
                                >
                                    {t("examSeatNextRows", { count: importPreview?.matched ?? 0 })}
                                </Button>
                            </>
                        )}
                        {importStep === 3 && (
                            <>
                                <Button variant="flat" onPress={() => setImportStep(2)}>
                                    {labels.back}
                                </Button>
                                <Button className="bg-emerald-500 text-white" isLoading={isImporting} onPress={handleImportCommit}>
                                    {labels.confirmImport}
                                </Button>
                            </>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}

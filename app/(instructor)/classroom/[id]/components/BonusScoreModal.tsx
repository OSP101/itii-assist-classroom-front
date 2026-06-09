"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Tooltip } from "@heroui/tooltip";
import { Tabs, Tab } from "@heroui/tabs";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Avatar } from "@heroui/avatar";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import bonusScoreService, { BonusScoreRecord, StudentWithBonus, StudentBonusData } from "@/services/bonusScore.service";

interface BonusScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    isCourseActive?: boolean;
}

const BONUS_SEARCH_AUTOCOMPLETE_CLASSNAMES = {
    base: "w-full",
    listboxWrapper: "max-h-[300px] p-0",
    listbox: "gap-1 p-1 bg-content1",
    popoverContent: "border border-default-200 bg-content1 text-foreground shadow-xl shadow-black/10",
    selectorButton: "text-amber-400 dark:text-amber-300",
};

const BONUS_SEARCH_LISTBOX_PROPS = {
    classNames: {
        base: "bg-content1 p-1",
        list: "gap-1",
        emptyContent: "text-default-500",
    },
    itemClasses: {
        base: "rounded-lg px-2 py-1.5 text-foreground data-[hover=true]:bg-content2 data-[focus=true]:bg-content2 data-[selected=true]:bg-warning/15 data-[selected=true]:text-foreground",
        wrapper: "gap-0.5",
        title: "text-foreground",
        description: "text-default-500",
        selectedIcon: "text-warning",
    },
};

function bonusDateKey(value: string) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function groupBonusRecordsByDay(records: BonusScoreRecord[]) {
    const grouped = new Map<string, { label: string; total: number; records: BonusScoreRecord[] }>();

    records.forEach((record) => {
        const key = bonusDateKey(record.given_at);
        const existing = grouped.get(key);
        if (existing) {
            existing.total += record.score;
            existing.records.push(record);
            return;
        }

        grouped.set(key, {
            label: new Date(record.given_at).toLocaleDateString("th-TH", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
            }),
            total: record.score,
            records: [record],
        });
    });

    return Array.from(grouped.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, value]) => ({
            key,
            label: value.label,
            total: value.total,
            records: value.records.sort((a, b) => new Date(b.given_at).getTime() - new Date(a.given_at).getTime()),
        }));
}

export default function BonusScoreModal({ isOpen, onClose, courseId, isCourseActive = true }: BonusScoreModalProps) {
    const [activeTab, setActiveTab] = useState<"give" | "history">("give");
    const [searchQuery, setSearchQuery] = useState("");
    const [students, setStudents] = useState<StudentWithBonus[]>([]);
    const [bonusHistory, setBonusHistory] = useState<StudentBonusData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [givingTo, setGivingTo] = useState<number | null>(null);
    const [recentBonuses, setRecentBonuses] = useState<{ student: StudentWithBonus; totalBonus: number }[]>([]);
    const [expandedHistoryGroups, setExpandedHistoryGroups] = useState<Record<string, boolean>>({});

    // Load all students and history when modal opens (like ScoreModal)
    useEffect(() => {
        if (isOpen && courseId) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, courseId]);

    // Reset states when modal closes
    useEffect(() => {
        if (!isOpen) {
            resetStates();
        }
    }, [isOpen]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load all enrolled students
            const studentResponse = await bonusScoreService.getEnrolledStudents(courseId);
            if (studentResponse.success && studentResponse.data) {
                setStudents(studentResponse.data.students);
            }

            // Load bonus history
            const historyResponse = await bonusScoreService.getBonusScoresByCourse(courseId);
            if (historyResponse.success && historyResponse.data) {
                setBonusHistory(historyResponse.data.studentBonusScores);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถโหลดข้อมูลได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const resetStates = () => {
        setActiveTab("give");
        setSearchQuery("");
        setRecentBonuses([]);
        setExpandedHistoryGroups({});
    };

    // Client-side filter students (like ScoreModal)
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students.slice(0, 10);
        const query = searchQuery.toLowerCase();
        return students.filter(
            s => s.student_id.toLowerCase().includes(query) ||
                s.full_name.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [students, searchQuery]);

    const historyCards = useMemo(() => {
        return bonusHistory
            .map((entry) => ({
                ...entry,
                groups: groupBonusRecordsByDay(entry.records),
            }))
            .sort((a, b) => {
                const aLatest = a.records[0] ? new Date(a.records[0].given_at).getTime() : 0;
                const bLatest = b.records[0] ? new Date(b.records[0].given_at).getTime() : 0;
                return bLatest - aLatest;
            });
    }, [bonusHistory]);

    const latestBonusRecordByStudent = useMemo(() => {
        const map = new Map<number, BonusScoreRecord>();
        bonusHistory.forEach((entry) => {
            const latestRecord = [...entry.records].sort(
                (a, b) => new Date(b.given_at).getTime() - new Date(a.given_at).getTime()
            )[0];
            if (latestRecord) {
                map.set(entry.student.id, latestRecord);
            }
        });
        return map;
    }, [bonusHistory]);

    // Handle autocomplete selection - give bonus immediately
    const handleSelectStudent = async (key: React.Key | null) => {
        if (!isCourseActive || !key) return;
        const studentId = Number(key);
        const student = students.find(s => s.id === studentId);
        if (student) {
            await handleGiveBonus(student.id, student.full_name);
        }
        setSearchQuery(""); // Clear search after selection
    };

    // Give bonus score
    const handleGiveBonus = async (studentId: number, studentName: string) => {
        if (!isCourseActive) {
            addToast({
                title: "รายวิชาถูกปิดแล้ว",
                description: "วิชาที่ปิดแล้วจะดูข้อมูลได้อย่างเดียว ไม่สามารถให้คะแนนพิเศษได้",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        setGivingTo(studentId);
        try {
            const response = await bonusScoreService.giveBonusScore({
                course_id: courseId,
                student_id: studentId,
                score: 1,
                reason: "ตอบคำถามในห้องเรียน",
            });

            if (response.success && response.data) {
                addToast({
                    title: "ให้คะแนนสำเร็จ",
                    description: `${studentName} ได้รับ +1 คะแนน (รวม ${response.data.totalBonus} คะแนน)`,
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });

                // Update local state
                const newTotalBonus = response.data.totalBonus;
                setStudents(prev =>
                    prev.map(s =>
                        s.id === studentId
                            ? { ...s, totalBonus: newTotalBonus }
                            : s
                    )
                );

                // Add to recent bonuses (prepend to top)
                const student = students.find(s => s.id === studentId);
                if (student) {
                    setRecentBonuses(prev => {
                        const filtered = prev.filter(r => r.student.id !== studentId);
                        return [{ student: { ...student, totalBonus: newTotalBonus }, totalBonus: newTotalBonus }, ...filtered].slice(0, 10);
                    });
                }

                // Reload history
                const historyResponse = await bonusScoreService.getBonusScoresByCourse(courseId);
                if (historyResponse.success && historyResponse.data) {
                    setBonusHistory(historyResponse.data.studentBonusScores);
                }
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถให้คะแนนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } finally {
            setGivingTo(null);
        }
    };

    // Delete bonus record
    const handleDeleteBonus = async (recordId: number) => {
        if (!isCourseActive) {
            addToast({
                title: "รายวิชาถูกปิดแล้ว",
                description: "วิชาที่ปิดแล้วจะดูข้อมูลได้อย่างเดียว ไม่สามารถลบคะแนนพิเศษได้",
                color: "warning",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
            return;
        }

        try {
            const response = await bonusScoreService.deleteBonusScore(recordId);
            if (response.success) {
                addToast({
                    title: "ลบสำเร็จ",
                    description: "ลบคะแนนพิเศษเรียบร้อยแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
                // Reload data
                loadData();
            }
        } catch (error) {
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถลบคะแนนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="3xl"
            scrollBehavior="inside"
        >
            <ModalContent className="score-modal-theme-scope bg-content2 text-foreground">
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-linear-to-br from-blue-400 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
                            <Icon icon="solar:star-bold" className="text-2xl text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">คะแนนพิเศษ</h3>
                            <p className="mt-1 text-sm font-normal text-default-500">
                                ให้คะแนนจากการถามตอบในห้องเรียน
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="px-6 py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size="lg" color="primary" />
                        </div>
                    ) : (
                        <>
                            {!isCourseActive && (
                                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                                    รายวิชานี้ถูกปิดแล้ว สามารถดูประวัติคะแนนพิเศษได้อย่างเดียว
                                </div>
                            )}

                            <Tabs
                                selectedKey={activeTab}
                                onSelectionChange={(key) => setActiveTab(key as "give" | "history")}
                                variant="underlined"
                                classNames={{
                                    tabList: "gap-6",
                                    cursor: "bg-blue-500",
                                    tab: "px-0 h-10",
                                    tabContent: "group-data-[selected=true]:text-blue-600 text-default-500 font-medium",
                                }}
                            >
                            {/* Give Score Tab */}
                            <Tab
                                key="give"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:add-circle-bold" className="text-lg" />
                                        <span>ให้คะแนน</span>
                                    </div>
                                }
                            >
                                <div className="space-y-4 mt-4">
                                    {/* Autocomplete Search - Same pattern as ScoreModal */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-default-600">ค้นหานักศึกษา</label>
                                        <Autocomplete
                                            placeholder="พิมพ์รหัสหรือชื่อนักศึกษา..."
                                            inputValue={searchQuery}
                                            onInputChange={setSearchQuery}
                                            selectedKey={null}
                                            onSelectionChange={handleSelectStudent}
                                            isDisabled={givingTo !== null || !isCourseActive}
                                            startContent={<Icon icon="solar:magnifer-linear" className="text-amber-500" />}
                                            variant="bordered"
                                            classNames={BONUS_SEARCH_AUTOCOMPLETE_CLASSNAMES}
                                            listboxProps={BONUS_SEARCH_LISTBOX_PROPS}
                                            inputProps={{
                                                classNames: {
                                                    inputWrapper: "bg-content1 border-amber-200 hover:border-amber-300 focus-within:!border-amber-400",
                                                },
                                            }}
                                        >
                                            {filteredStudents.map((student) => (
                                                <AutocompleteItem
                                                    key={student.id.toString()}
                                                    textValue={`${student.student_id} ${student.full_name}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={student.full_name}
                                                            size="sm"
                                                            className="bg-linear-to-br from-amber-400 to-orange-500 text-white shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-foreground">{student.full_name}</p>
                                                            <p className="text-xs text-default-500">
                                                                <span className="font-mono">{student.student_id}</span>
                                                                <span className="mx-1">•</span>
                                                                <span>Sec {student.section_no}</span>
                                                            </p>
                                                        </div>
                                                        {student.totalBonus > 0 && (
                                                            <Chip
                                                                size="sm"
                                                                color="warning"
                                                                variant="flat"
                                                                startContent={<Icon icon="solar:star-bold" className="text-xs" />}
                                                            >
                                                                {student.totalBonus}
                                                            </Chip>
                                                        )}
                                                        <div className="flex items-center gap-1 text-amber-600">
                                                            <Icon icon="solar:add-circle-bold" className="text-lg" />
                                                            <span className="text-sm font-medium">+1</span>
                                                        </div>
                                                    </div>
                                                </AutocompleteItem>
                                            ))}
                                        </Autocomplete>
                                        <p className="mt-2 flex items-center gap-1 text-xs text-default-400">
                                            <Icon icon="solar:info-circle-linear" />
                                            เลือกนักศึกษาเพื่อให้ +1 คะแนนทันที
                                        </p>
                                    </div>

                                    {/* Recent Bonuses */}
                                    {recentBonuses.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="flex items-center gap-2 text-sm font-medium text-default-600">
                                                <Icon icon="solar:clock-circle-bold" className="text-amber-500" />
                                                เพิ่งให้คะแนน ({recentBonuses.length})
                                            </p>
                                            <div className="max-h-70 space-y-2 overflow-y-auto pr-2">
                                                {recentBonuses.map((item, index) => (
                                                    <Card
                                                        key={`${item.student.id}-${index}`}
                                                        className="border border-blue-200 bg-blue-50/50 shadow-sm"
                                                    >
                                                        <CardBody className="p-3">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar
                                                                    name={item.student.full_name}
                                                                    size="md"
                                                                    className="bg-linear-to-br from-blue-400 to-indigo-500 text-white shrink-0"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="truncate font-semibold text-foreground">
                                                                        {item.student.full_name}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 text-sm text-default-500">
                                                                        <span className="font-mono">{item.student.student_id}</span>
                                                                        <span>•</span>
                                                                        <span>Sec {item.student.section_no}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Chip
                                                                        size="sm"
                                                                        color="success"
                                                                        variant="flat"
                                                                    >
                                                                        +1 ✓
                                                                    </Chip>
                                                                    <Chip
                                                                        size="sm"
                                                                        color="warning"
                                                                        variant="solid"
                                                                        startContent={<Icon icon="solar:star-bold" className="text-xs" />}
                                                                    >
                                                                        {item.totalBonus}
                                                                    </Chip>
                                                                    {latestBonusRecordByStudent.get(item.student.id) && (
                                                                        <Tooltip content="ยกเลิกล่าสุด" color="danger">
                                                                            <Button
                                                                                isIconOnly
                                                                                size="sm"
                                                                                variant="flat"
                                                                                color="danger"
                                                                                isDisabled={!isCourseActive}
                                                                                onPress={() => handleDeleteBonus(latestBonusRecordByStudent.get(item.student.id)!.id)}
                                                                            >
                                                                                <Icon icon="solar:undo-left-linear" className="text-base" />
                                                                            </Button>
                                                                        </Tooltip>
                                                                    )}
                                                                </div>
                                                                {/* Quick add more button */}
                                                                <Tooltip content="ให้อีก +1">
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        color="warning"
                                                                        variant="flat"
                                                                        isLoading={givingTo === item.student.id}
                                                                        isDisabled={!isCourseActive}
                                                                        onPress={() => handleGiveBonus(item.student.id, item.student.full_name)}
                                                                    >
                                                                        {givingTo !== item.student.id && (
                                                                            <Icon icon="solar:add-circle-bold" className="text-lg" />
                                                                        )}
                                                                    </Button>
                                                                </Tooltip>
                                                            </div>
                                                        </CardBody>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty state when no recent */}
                                    {recentBonuses.length === 0 && (
                                        <div className="py-8 text-center text-default-500">
                                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
                                                <Icon icon="solar:star-shine-bold-duotone" className="text-5xl text-amber-400" />
                                            </div>
                                            <p className="font-medium text-default-600">พร้อมให้คะแนนพิเศษ</p>
                                            <p className="mt-1 text-sm text-default-400">ค้นหาและเลือกนักศึกษาด้านบน</p>
                                        </div>
                                    )}
                                </div>
                            </Tab>

                            {/* History Tab */}
                            <Tab
                                key="history"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:history-bold" className="text-lg" />
                                        <span>ประวัติ</span>
                                        {historyCards.length > 0 && (
                                            <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-700 h-5 min-w-5 px-1">
                                                {historyCards.length}
                                            </Chip>
                                        )}
                                    </div>
                                }
                            >
                                <div className="space-y-4 mt-4">
                                    {historyCards.length > 0 ? (
                                        <div className="max-h-100 space-y-3 overflow-y-auto pr-2">
                                            {historyCards.map((data) => (
                                                <Card
                                                    key={data.student.id}
                                                    className="border border-default-200 bg-content1 shadow-sm"
                                                >
                                                    <CardBody className="p-4">
                                                        {/* Student Header */}
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar
                                                                    name={data.student.full_name}
                                                                    size="md"
                                                                    className="bg-linear-to-br from-blue-400 to-indigo-500 text-white"
                                                                />
                                                                <div>
                                                                    <p className="font-semibold text-foreground">
                                                                        {data.student.full_name}
                                                                    </p>
                                                                    <p className="font-mono text-sm text-default-500">
                                                                        {data.student.student_id}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Chip
                                                                size="lg"
                                                                color="warning"
                                                                variant="solid"
                                                                startContent={<Icon icon="solar:star-bold" />}
                                                            >
                                                                {data.totalScore} คะแนน
                                                            </Chip>
                                                        </div>

                                                        <div className="space-y-3 pl-13">
                                                            {data.groups.map((group) => {
                                                                const groupKey = `${data.student.id}-${group.key}`;
                                                                const isExpanded = expandedHistoryGroups[groupKey] ?? false;
                                                                const previewRecords = isExpanded ? group.records : group.records.slice(0, 1);

                                                                return (
                                                                    <div key={groupKey} className="rounded-xl border border-default-200 bg-content2 p-3">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setExpandedHistoryGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                                                                            className="flex w-full items-center gap-3 text-left"
                                                                        >
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-sm font-semibold text-foreground">{group.label}</p>
                                                                                <p className="text-xs text-default-500">
                                                                                    {group.records.length} รายการ · รวม +{group.total}
                                                                                </p>
                                                                            </div>
                                                                            <Icon
                                                                                icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                                                                                className="text-lg text-default-400"
                                                                            />
                                                                        </button>

                                                                        <div className="mt-3 space-y-2">
                                                                            {previewRecords.map((record) => (
                                                                                <div
                                                                                    key={record.id}
                                                                                    className="flex items-center justify-between rounded-lg bg-content1 px-3 py-2 text-sm"
                                                                                >
                                                                                    <div className="flex min-w-0 items-center gap-2">
                                                                                        <Chip size="sm" color="success" variant="flat">
                                                                                            +{record.score}
                                                                                        </Chip>
                                                                                        <div className="min-w-0">
                                                                                            <p className="truncate text-default-700">{record.reason}</p>
                                                                                            <p className="text-xs text-default-400">
                                                                                                โดย {record.giver.full_name} · {new Date(record.given_at).toLocaleString("th-TH", {
                                                                                                    day: "numeric",
                                                                                                    month: "short",
                                                                                                    hour: "2-digit",
                                                                                                    minute: "2-digit",
                                                                                                })}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <Tooltip content="ลบคะแนนนี้" color="danger">
                                                                                        <Button
                                                                                            isIconOnly
                                                                                            size="sm"
                                                                                            variant="light"
                                                                                            color="danger"
                                                                                            isDisabled={!isCourseActive}
                                                                                            onPress={() => handleDeleteBonus(record.id)}
                                                                                        >
                                                                                            <Icon icon="solar:trash-bin-trash-linear" className="text-sm" />
                                                                                        </Button>
                                                                                    </Tooltip>
                                                                                </div>
                                                                            ))}
                                                                            {!isExpanded && group.records.length > 1 && (
                                                                                <p className="pt-1 text-center text-xs text-default-400">
                                                                                    และอีก {group.records.length - 1} รายการ
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-default-500">
                                            <Icon icon="solar:star-fall-bold-duotone" className="mx-auto mb-3 text-5xl text-default-300" />
                                            <p>ยังไม่มีประวัติการให้คะแนนพิเศษ</p>
                                        </div>
                                    )}
                                </div>
                            </Tab>
                            </Tabs>
                        </>
                    )}
                </ModalBody>

                <ModalFooter className="border-t border-divider px-6 py-4">
                    <Button variant="light" onPress={onClose}>
                        ปิด
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

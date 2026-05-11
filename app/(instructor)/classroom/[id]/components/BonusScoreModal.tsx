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
import bonusScoreService, { StudentWithBonus, StudentBonusData } from "@/services/bonusScore.service";

interface BonusScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
}

export default function BonusScoreModal({ isOpen, onClose, courseId }: BonusScoreModalProps) {
    const [activeTab, setActiveTab] = useState<"give" | "history">("give");
    const [searchQuery, setSearchQuery] = useState("");
    const [students, setStudents] = useState<StudentWithBonus[]>([]);
    const [bonusHistory, setBonusHistory] = useState<StudentBonusData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [givingTo, setGivingTo] = useState<number | null>(null);
    const [recentBonuses, setRecentBonuses] = useState<{ student: StudentWithBonus; totalBonus: number }[]>([]);

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

    // Handle autocomplete selection - give bonus immediately
    const handleSelectStudent = async (key: React.Key | null) => {
        if (!key) return;
        const studentId = Number(key);
        const student = students.find(s => s.id === studentId);
        if (student) {
            await handleGiveBonus(student.id, student.full_name);
        }
        setSearchQuery(""); // Clear search after selection
    };

    // Give bonus score
    const handleGiveBonus = async (studentId: number, studentName: string) => {
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
            <ModalContent>
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
                                            isDisabled={givingTo !== null}
                                            startContent={<Icon icon="solar:magnifer-linear" className="text-amber-500" />}
                                            variant="bordered"
                                            inputProps={{
                                                classNames: {
                                                    inputWrapper: "bg-content1 border-amber-200 hover:border-amber-300 focus-within:!border-amber-400",
                                                },
                                            }}
                                            classNames={{
                                                base: "w-full",
                                                listboxWrapper: "max-h-[300px]",
                                                selectorButton: "text-amber-400"
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
                                                                </div>
                                                                {/* Quick add more button */}
                                                                <Tooltip content="ให้อีก +1">
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        color="warning"
                                                                        variant="flat"
                                                                        isLoading={givingTo === item.student.id}
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
                                        {bonusHistory.length > 0 && (
                                            <Chip size="sm" variant="flat" className="bg-amber-100 text-amber-700 h-5 min-w-5 px-1">
                                                {bonusHistory.length}
                                            </Chip>
                                        )}
                                    </div>
                                }
                            >
                                <div className="space-y-4 mt-4">
                                    {bonusHistory.length > 0 ? (
                                        <div className="max-h-100 space-y-3 overflow-y-auto pr-2">
                                            {bonusHistory.map((data) => (
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

                                                        {/* Records */}
                                                        <div className="space-y-1.5 pl-13">
                                                            {data.records.slice(0, 5).map((record) => (
                                                                <div
                                                                    key={record.id}
                                                                    className="flex items-center justify-between rounded-lg bg-content2 px-3 py-2 text-sm"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <Chip size="sm" color="success" variant="flat">
                                                                            +{record.score}
                                                                        </Chip>
                                                                        <span className="text-default-600">{record.reason}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-default-400">
                                                                            {new Date(record.given_at).toLocaleString("th-TH", {
                                                                                day: "numeric",
                                                                                month: "short",
                                                                                hour: "2-digit",
                                                                                minute: "2-digit",
                                                                            })}
                                                                        </span>
                                                                        <Tooltip content="ลบคะแนนนี้" color="danger">
                                                                            <Button
                                                                                isIconOnly
                                                                                size="sm"
                                                                                variant="light"
                                                                                color="danger"
                                                                                onPress={() => handleDeleteBonus(record.id)}
                                                                            >
                                                                                <Icon icon="solar:trash-bin-trash-linear" className="text-sm" />
                                                                            </Button>
                                                                        </Tooltip>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {data.records.length > 5 && (
                                                                <p className="pt-1 text-center text-xs text-default-400">
                                                                    และอีก {data.records.length - 5} รายการ
                                                                </p>
                                                            )}
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

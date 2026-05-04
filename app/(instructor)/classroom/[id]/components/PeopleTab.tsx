"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Avatar } from "@heroui/avatar";
import { Skeleton } from "@heroui/skeleton";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
} from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

// Types for the component
interface Instructor {
    id: number;
    full_name: string;
    email: string | null;
    username?: string;
    avatar: string | null;
    CourseInstructor?: {
        is_primary: boolean;
    };
}

interface TA {
    id: number;
    full_name: string;
    email: string | null;
    username: string;
    avatar: string | null;
}

interface Course {
    instructor?: Instructor | null;
    instructors?: Instructor[];
    tas?: TA[];
}

interface PeopleTabProps {
    course: Course;
    isLoading: boolean;
    isPeopleLoading: boolean;
    onOpenAddTAModal: () => void;
    onOpenAddInstructorModal: () => void;
    onRemoveTA: (taId: number) => void;
    onRemoveInstructor: (instructorId: number) => void;
    userRole: string;
    currentUserId: number | null;
    isCourseActive?: boolean;
}

// Loading Skeleton
function PeopleTableSkeleton() {
    return (
        <Card className="shadow-sm border border-slate-200">
            <CardBody className="p-2">
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-4 p-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="w-32 h-4 rounded-lg" />
                                <Skeleton className="w-48 h-3 rounded-lg" />
                            </div>
                            <Skeleton className="w-24 h-6 rounded-full" />
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}

const ITEMS_PER_PAGE = 10;

export default function PeopleTab({
    course,
    isLoading,
    isPeopleLoading,
    onOpenAddTAModal,
    onOpenAddInstructorModal,
    onRemoveTA,
    onRemoveInstructor,
    userRole,
    currentUserId,
    isCourseActive = true,
}: PeopleTabProps) {
    const [currentPage, setCurrentPage] = useState(1);
    
    // Get instructors count - use instructors array if available, otherwise fallback to single instructor
    const instructorsCount = course.instructors?.length || (course.instructor ? 1 : 0);
    const instructorsList = course.instructors || (course.instructor ? [course.instructor] : []);
    
    // Build people list for table
    const allPeople = useMemo(() => [
        // Instructor Rows (multiple instructors)
        ...instructorsList.map(instructor => ({
            id: `instructor-${instructor.id}`,
            type: 'instructor' as const,
            personId: instructor.id,
            full_name: instructor.full_name,
            email: instructor.email || "-",
            avatar: instructor.avatar,
            isPrimary: instructor.CourseInstructor?.is_primary || false,
        })),
        // TA Rows
        ...(course.tas?.map(ta => ({
            id: `ta-${ta.id}`,
            type: 'ta' as const,
            personId: ta.id,
            full_name: ta.full_name,
            email: ta.email || ta.username || "-",
            avatar: ta.avatar,
            isPrimary: false,
        })) || [])
    ], [instructorsList, course.tas]);
    
    // Pagination
    const totalPages = Math.ceil(allPeople.length / ITEMS_PER_PAGE);
    const paginatedPeople = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return allPeople.slice(start, start + ITEMS_PER_PAGE);
    }, [allPeople, currentPage]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">บุคลากรในรายวิชา</h2>
                    <p className="text-sm text-slate-500">จัดการอาจารย์ผู้สอนและผู้ช่วยสอน (TA)</p>
                </div>

                {userRole === "instructor" && (
                    <div className="flex gap-2">
                        <Button
                            color="secondary"
                            variant="flat"
                            startContent={<Icon icon="solar:user-plus-bold" />}
                            onPress={onOpenAddInstructorModal}
                            isDisabled={isPeopleLoading || !isCourseActive}
                            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        >
                            เพิ่มอาจารย์
                        </Button>
                        <Button
                            color="primary"
                            startContent={<Icon icon="solar:user-plus-bold" />}
                            onPress={onOpenAddTAModal}
                            isDisabled={isPeopleLoading || !isCourseActive}
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                        >
                            เพิ่มผู้ช่วยสอน
                        </Button>
                    </div>
                )}


            </div>

            {/* Loading state */}
            {isLoading ? (
                <>
                    {/* Stats Skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="shadow-sm border border-slate-200">
                                <CardBody className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-12 h-12 rounded-xl" />
                                        <div className="space-y-2">
                                            <Skeleton className="w-20 h-3 rounded-lg" />
                                            <Skeleton className="w-8 h-6 rounded-lg" />
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                    <PeopleTableSkeleton />
                </>
            ) : (
                <>
                    {/* Stats Cards - Hidden on mobile */}
                    <div className="hidden md:grid grid-cols-2 md:grid-cols-3 gap-3">
                        <Card className="shadow-sm border border-slate-200">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-100 rounded-xl">
                                        <Icon icon="solar:users-group-rounded-bold" className="text-2xl text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">บุคลากรทั้งหมด</p>
                                        <p className="text-2xl font-bold text-slate-800">
                                            {instructorsCount + (course.tas?.length || 0)}
                                        </p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="shadow-sm border border-slate-200">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-100 rounded-xl">
                                        <Icon icon="solar:user-circle-bold" className="text-2xl text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">อาจารย์ผู้สอน</p>
                                        <p className="text-2xl font-bold text-slate-800">{instructorsCount}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="shadow-sm border border-slate-200">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                                        <Icon icon="solar:user-hands-bold" className="text-2xl text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">ผู้ช่วยสอน (TA)</p>
                                        <p className="text-2xl font-bold text-slate-800">{course.tas?.length || 0}</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    {/* People Table */}
                    <Card className="shadow-sm border border-slate-200">
                        <CardBody className="p-2">
                            <div className="overflow-x-auto">
                                <Table
                                    aria-label="People table"
                                    removeWrapper
                                    classNames={{
                                        base: "min-w-[600px]",
                                        th: "bg-slate-50 text-slate-600 font-semibold text-sm whitespace-nowrap",
                                        td: "py-3 whitespace-nowrap",
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn className="min-w-[180px]">ชื่อ-นามสกุล</TableColumn>
                                        <TableColumn className="min-w-[180px]">อีเมล / Username</TableColumn>
                                        <TableColumn className="min-w-[140px]">บทบาท</TableColumn>
                                        <TableColumn align="center" className="min-w-[80px]">จัดการ</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent={
                                        <div className="py-10 text-center">
                                            <Icon icon="solar:users-group-rounded-linear" className="text-5xl text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-400">ยังไม่มีบุคลากรในรายวิชานี้</p>
                                        </div>
                                    }>
                                        {paginatedPeople.map((person) => (
                                            <TableRow key={person.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={person.full_name}
                                                            src={person.avatar || undefined}
                                                            size="sm"
                                                            className={person.type === 'instructor'
                                                                ? "bg-gradient-to-br from-blue-500 to-indigo-500 flex-shrink-0"
                                                                : "bg-gradient-to-br from-emerald-500 to-teal-500 flex-shrink-0"
                                                            }
                                                        />
                                                        <div>
                                                            <p className="font-medium text-slate-800">{person.full_name}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-slate-600">{person.email}</span>
                                                </TableCell>
                                                <TableCell>
                                                    {person.type === 'instructor' ? (
                                                        <div className="flex items-center gap-2">
                                                            <Chip
                                                                size="sm"
                                                                variant="flat"
                                                                className="bg-blue-100 text-blue-700"
                                                            >
                                                                อาจารย์ผู้สอน
                                                            </Chip>
                                                            {person.isPrimary && (
                                                                <Chip
                                                                    size="sm"
                                                                    variant="flat"
                                                                    className="bg-amber-100 text-amber-700"
                                                                    startContent={<Icon icon="solar:crown-bold" className="text-xs" />}
                                                                >
                                                                    หลัก
                                                                </Chip>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Chip
                                                            size="sm"
                                                            variant="flat"
                                                            className="bg-emerald-100 text-emerald-700"
                                                        >
                                                            ผู้ช่วยสอน
                                                        </Chip>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-1">
                                                        {person.type === 'instructor' ? (
                                                            // Instructor: can remove if not primary and not self, or if admin
                                                            person.isPrimary || person.personId === currentUserId ? (
                                                                <Tooltip content={person.isPrimary ? "อาจารย์หลักไม่สามารถลบออกได้" : "ไม่สามารถลบตัวเองออกได้"}>
                                                                    <span className="text-slate-300">
                                                                        <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
                                                                    </span>
                                                                </Tooltip>
                                                            ) : userRole === 'instructor' ? (
                                                                <Tooltip content="ลบออกจากรายวิชา" color="danger">
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        variant="light"
                                                                        color="danger"
                                                                        isDisabled={!isCourseActive}
                                                                        onPress={() => onRemoveInstructor(person.personId)}
                                                                    >
                                                                        <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                    </Button>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip content="เฉพาะอาจารย์ผู้สอนเท่านั้นที่สามารถจัดการได้">
                                                                    <span className="text-slate-300">
                                                                        <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
                                                                    </span>
                                                                </Tooltip>
                                                            )
                                                        ) : (
                                                            // TA: same logic as before
                                                            userRole !== 'instructor' ? (
                                                                <Tooltip content="เฉพาะอาจารย์ผู้สอนเท่านั้นที่สามารถลบผู้ช่วยสอนได้">
                                                                    <span className="text-slate-300">
                                                                        <Icon icon="solar:lock-keyhole-bold" className="text-lg" />
                                                                    </span>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip content="ลบออกจากรายวิชา" color="danger">
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        variant="light"
                                                                        color="danger"
                                                                        isDisabled={!isCourseActive}
                                                                        onPress={() => onRemoveTA(person.personId)}
                                                                    >
                                                                        <Icon icon="solar:trash-bin-trash-bold" className="text-lg" />
                                                                    </Button>
                                                                </Tooltip>
                                                            )
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center py-4 border-t border-slate-100">
                                    <Pagination
                                        total={totalPages}
                                        page={currentPage}
                                        onChange={setCurrentPage}
                                        showControls
                                        size="sm"
                                        color="primary"
                                        classNames={{
                                            wrapper: "gap-1",
                                            item: "bg-transparent",
                                            cursor: "bg-blue-500 text-white shadow-md",
                                        }}
                                    />
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {/* Empty state when no people at all */}
                    {instructorsCount === 0 && (!course.tas || course.tas.length === 0) && (
                        <Card className="shadow-sm border border-dashed border-slate-300 bg-slate-50/50">
                            <CardBody className="text-center py-16">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                    <Icon icon="solar:users-group-rounded-bold-duotone" className="text-5xl text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">ยังไม่มีบุคลากร</h3>
                                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                                    เพิ่มอาจารย์หรือผู้ช่วยสอน (TA) เพื่อช่วยจัดการรายวิชานี้
                                </p>
                                <div className="flex gap-2 justify-center">
                                    {userRole === "instructor" && (
                                        <Button
                                            color="secondary"
                                            variant="flat"
                                            startContent={<Icon icon="solar:user-plus-bold" />}
                                            onPress={onOpenAddInstructorModal}
                                            className="bg-indigo-100 text-indigo-700"
                                        >
                                            เพิ่มอาจารย์
                                        </Button>
                                    )}
                                    <Button
                                        color="primary"
                                        startContent={<Icon icon="solar:user-plus-bold" />}
                                        onPress={onOpenAddTAModal}
                                        className="bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg shadow-blue-400/25"
                                    >
                                        เพิ่มผู้ช่วยสอน
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
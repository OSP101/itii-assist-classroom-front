"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Progress } from "@heroui/progress";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import { Tooltip } from "@heroui/tooltip";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
} from "@heroui/table";
import { Icon } from "@iconify/react";
import { OverviewSkeleton } from "../Skeletons";
import type { Course, CourseOverview, AssignmentTypeStats, OverviewAssignment } from "@/services/course.service";
import type { AssignmentType } from "../types";
import { getAssignmentTypeConfig, formatRelativeTime } from "./config";
import {
    CircularProgress,
    ScoreDistributionBar,
    StatsCard,
    AssignmentTypeSummaryCard,
    StudentDetailModal,
} from "./components";
import type { OverviewStudent } from "@/services/course.service";

interface OverviewTabViewProps {
    // Data
    course: Course;
    overview: CourseOverview | null;
    isLoading: boolean;
    userRole: string;
    assignments: AssignmentType[];
    // State from hook
    mounted: boolean;
    selectedAssignmentType: string;
    // Computed from hook
    assignmentStatsByType: Record<string, AssignmentTypeStats>;
    availableTypes: string[];
    filteredAssignments: OverviewAssignment[];
    // Actions
    onNavigateToAssignments: () => void;
    onSetSelectedAssignmentType: (type: string) => void;
    onResetAssignmentTypeFilter: () => void;
}

function OverviewTabViewComponent({
    course,
    overview,
    isLoading,
    userRole,
    assignments,
    mounted,
    selectedAssignmentType,
    assignmentStatsByType,
    availableTypes,
    filteredAssignments,
    onNavigateToAssignments,
    onSetSelectedAssignmentType,
    onResetAssignmentTypeFilter,
}: OverviewTabViewProps) {
    const [selectedStudent, setSelectedStudent] = useState<OverviewStudent | null>(null);

    if (isLoading || !mounted) {
        return <OverviewSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Hero Course Card */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
                    <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                </div>
                <CardBody className="relative p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Course Image */}
                        <div className="shrink-0">
                            {course.image ? (
                                <div className="relative w-full md:w-36 h-36">
                                    <Image
                                        src={course.image}
                                        alt={course.name}
                                        fill
                                        className="object-cover rounded-2xl border-2 border-white/20 shadow-xl"
                                        sizes="144px"
                                    />
                                </div>
                            ) : (
                                <div className="w-full md:w-36 h-36 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/20">
                                    <Icon icon="solar:book-2-bold-duotone" className="text-5xl text-white/60" />
                                </div>
                            )}
                        </div>
                        
                        {/* Course Info */}
                        <div className="flex-1">
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Chip size="sm" className="bg-white/20 text-white border-0 backdrop-blur-sm">{course.code}</Chip>
                                <Chip size="sm" className="bg-white/20 text-white border-0 backdrop-blur-sm">
                                    {course.year}/{course.semester === 3 ? "ฤดูร้อน" : course.semester}
                                </Chip>
                                <Chip 
                                    size="sm" 
                                    className={`border-0 ${course.is_active ? "bg-emerald-500/30 text-emerald-100" : "bg-slate-500/30 text-slate-200"}`}
                                    startContent={<div className={`w-2 h-2 rounded-full ${course.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />}
                                >
                                    {course.is_active ? "เปิดใช้งาน" : "ปิด"}
                                </Chip>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold mb-2">{course.name}</h2>
                            {course.description && (
                                <p className="text-white/80 text-sm mb-3 line-clamp-2">{course.description}</p>
                            )}
                            {course.instructor && (
                                <div className="flex items-center gap-2 text-white/70 text-sm">
                                    <Icon icon="solar:user-bold" className="text-lg" />
                                    <span>{course.instructor.full_name}</span>
                                </div>
                            )}
                        </div>

                        {/* Quick Stats */}
                        <div className="flex md:flex-col gap-6 md:gap-4 justify-around md:justify-center items-center md:border-l md:border-white/20 md:pl-6">
                            <div className="text-center">
                                <p className="text-4xl font-bold">{overview?.summary.totalStudents || 0}</p>
                                <p className="text-xs text-white/70 mt-1">นักศึกษา</p>
                            </div>
                            <div className="text-center">
                                <p className="text-4xl font-bold">{overview?.summary.totalAssignments || 0}</p>
                                <p className="text-xs text-white/70 mt-1">งาน</p>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard
                    icon="solar:users-group-rounded-bold"
                    iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
                    label="นักศึกษาทั้งหมด"
                    value={overview?.summary.totalStudents || 0}
                    suffix="คน"
                />
                <StatsCard
                    icon="solar:document-text-bold"
                    iconBg="bg-gradient-to-br from-purple-500 to-purple-600"
                    label="งานที่มอบหมาย"
                    value={overview?.summary.totalAssignments || 0}
                    suffix="งาน"
                />
                <StatsCard
                    icon="solar:diploma-bold"
                    iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
                    label="คะแนนเฉลี่ย"
                    value={
                        overview?.summary.totalMaxScore && overview.summary.totalMaxScore > 0
                            ? Math.round((overview.summary.averageScore / overview.summary.totalMaxScore) * 100)
                            : 0
                    }
                    suffix="%"
                />
                <StatsCard
                    icon="solar:user-hands-bold"
                    iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
                    label="ผู้ช่วยสอน"
                    value={overview?.summary.totalTAs || 0}
                    suffix="คน"
                />
            </div>

            {/* Performance Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Submission Rate */}
                <Card className="shadow-sm border border-slate-200">
                    <CardBody className="p-6">
                        <div className="flex flex-col items-center">
                            <CircularProgress 
                                value={overview?.summary.submissionRate || 0}
                                color="primary"
                                sublabel="อัตราการตรวจงาน"
                            />
                        </div>
                    </CardBody>
                </Card>

                {/* Attendance Rate */}
                <Card className="shadow-sm border border-slate-200">
                    <CardBody className="p-6">
                        <div className="flex flex-col items-center">
                            <CircularProgress 
                                value={overview?.summary.attendanceRate || 0}
                                color="success"
                                sublabel="อัตราการเข้าเรียน"
                            />
                            {overview?.summary.totalAttendanceSessions !== undefined && (
                                <p className="text-xs text-slate-400 mt-2">
                                    จาก {overview.summary.totalAttendanceSessions} รอบเช็คชื่อ
                                </p>
                            )}
                        </div>
                    </CardBody>
                </Card>

                {/* Score Distribution */}
                <Card className="shadow-sm border border-slate-200">
                    <CardBody className="p-6">
                        <h4 className="text-sm font-semibold text-slate-700 mb-4 text-center">การกระจายคะแนน</h4>
                        {overview?.scoreDistribution ? (
                            <ScoreDistributionBar distribution={overview.scoreDistribution} />
                        ) : (
                            <div className="text-center text-sm text-slate-400 py-4">
                                ยังไม่มีข้อมูล
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* Leaderboard & Low Performers Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Students - Leaderboard */}
                <Card className="shadow-sm border border-slate-200 overflow-hidden">
                    <CardHeader className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                                <Icon icon="solar:cup-star-bold" className="text-xl text-white" />
                            </div>
                            <div>
                                <span className="font-semibold text-slate-800 block">นักศึกษาที่โดดเด่น</span>
                                <span className="text-xs text-slate-500">5 อันดับแรก</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardBody className="px-5 py-4">
                        {overview?.topStudents && overview.topStudents.length > 0 ? (
                            <div className="space-y-3">
                                {overview.topStudents.map((student, index) => (
                                    <div 
                                        key={student.id} 
                                        className={`flex items-center justify-between p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                                            index === 0 ? "bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200" :
                                            index === 1 ? "bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200" :
                                            index === 2 ? "bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200" :
                                            "bg-slate-50 border border-slate-100"
                                        }`}
                                        onClick={() => setSelectedStudent(student)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Rank Badge */}
                                            <div className={`relative w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm ${
                                                index === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg" :
                                                index === 1 ? "bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-md" :
                                                index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md" :
                                                "bg-blue-100 text-blue-600"
                                            }`}>
                                                {index < 3 ? (
                                                    <Icon icon="solar:crown-bold" className="text-lg" />
                                                ) : (
                                                    `#${index + 1}`
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{student.full_name}</p>
                                                <p className="text-xs text-slate-400">{student.student_id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-bold ${
                                                index === 0 ? "text-amber-600" :
                                                index === 1 ? "text-slate-600" :
                                                index === 2 ? "text-orange-600" :
                                                "text-blue-600"
                                            }`}>
                                                {student.totalScore.toFixed(1)}
                                            </p>
                                            <p className="text-xs text-slate-400">{student.percentage}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Icon icon="solar:cup-star-linear" className="text-3xl text-slate-300" />
                                </div>
                                <p className="text-sm text-slate-500">ยังไม่มีข้อมูลคะแนน</p>
                                <p className="text-xs text-slate-400 mt-1">เมื่อมีการให้คะแนน จะแสดงนักศึกษาที่โดดเด่น</p>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Students Need Attention */}
                <Card className="shadow-sm border border-slate-200 overflow-hidden">
                    <CardHeader className="px-5 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                                <Icon icon="solar:danger-triangle-bold" className="text-xl text-white" />
                            </div>
                            <div>
                                <span className="font-semibold text-slate-800 block">นักศึกษาที่ควรได้รับการดูแลเพิ่มเติม</span>
                                <span className="text-xs text-slate-500">คะแนนต่ำกว่า {course.attention_threshold ?? 60}% (5 อันดับแรก)</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardBody className="px-5 py-4">
                        {overview?.lowPerformers && overview.lowPerformers.length > 0 ? (
                            <div className="space-y-3">
                                {overview.lowPerformers.slice(0, 5).map((student, index) => (
                                    <div 
                                        key={student.id} 
                                        className={`flex items-center justify-between p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                                            (student.percentage || 0) < 30 
                                                ? "bg-gradient-to-r from-red-50 to-red-100 border border-red-200" 
                                                : "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200"
                                        }`}
                                        onClick={() => setSelectedStudent(student)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Warning Badge */}
                                            <div className={`relative w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm ${
                                                (student.percentage || 0) < 30 
                                                    ? "bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg" 
                                                    : "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md"
                                            }`}>
                                                <Icon icon="solar:danger-triangle-bold" className="text-lg" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{student.full_name}</p>
                                                <p className="text-xs text-slate-400">{student.student_id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-bold ${
                                                (student.percentage || 0) < 30 ? "text-red-600" : "text-amber-600"
                                            }`}>
                                                {student.percentage || 0}%
                                            </p>
                                            <p className="text-xs text-slate-400">{student.totalScore?.toFixed(1) || 0} คะแนน</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Icon icon="solar:check-circle-bold" className="text-3xl text-emerald-500" />
                                </div>
                                <p className="text-sm text-slate-500">ทุกคนมีผลการเรียนที่ดี</p>
                                <p className="text-xs text-slate-400 mt-1">ไม่มีนักศึกษาที่ต้องการความช่วยเหลือ</p>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* Assignment Types Summary */}
            {Object.keys(assignmentStatsByType).length > 0 && (
                <Card className="shadow-sm border border-slate-200">
                    <CardHeader className="px-5 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:chart-2-bold" className="text-xl text-indigo-500" />
                            <span className="font-semibold text-slate-800">สรุปประเภทงาน</span>
                        </div>
                    </CardHeader>
                    <CardBody className="p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(assignmentStatsByType).map(([type, stats]) => (
                                <AssignmentTypeSummaryCard
                                    key={type}
                                    type={type}
                                    stats={stats}
                                />
                            ))}
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Assignment Analysis & Recent Activity Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Assignment Analysis Table */}
                <Card className="shadow-sm border border-slate-200 lg:col-span-2">
                    <CardHeader className="px-5 py-4 border-b border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:document-text-bold" className="text-xl text-blue-500" />
                                <span className="font-semibold text-slate-800">การวิเคราะห์งาน</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Assignment Type Filter Chips */}
                                <div className="flex flex-wrap gap-1">
                                    <Chip
                                        size="sm"
                                        variant={selectedAssignmentType === "all" ? "solid" : "flat"}
                                        color={selectedAssignmentType === "all" ? "primary" : "default"}
                                        className="cursor-pointer"
                                        onClick={() => onSetSelectedAssignmentType("all")}
                                    >
                                        ทั้งหมด
                                    </Chip>
                                    {availableTypes.map((type) => {
                                        const config = getAssignmentTypeConfig(type);
                                        return (
                                            <Chip
                                                key={type}
                                                size="sm"
                                                variant={selectedAssignmentType === type ? "solid" : "flat"}
                                                color={selectedAssignmentType === type ? config.color : "default"}
                                                className="cursor-pointer"
                                                onClick={() => onSetSelectedAssignmentType(type)}
                                                startContent={<Icon icon={config.icon} className="text-xs" />}
                                            >
                                                <span className="hidden sm:inline">{config.shortLabel}</span>
                                            </Chip>
                                        );
                                    })}
                                </div>
                                {assignments.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant="light"
                                        color="primary"
                                        onPress={onNavigateToAssignments}
                                        endContent={<Icon icon="solar:arrow-right-linear" />}
                                        className="hidden sm:flex"
                                    >
                                        ดูทั้งหมด
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardBody className="p-0">
                        {filteredAssignments.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table removeWrapper aria-label="Assignment analysis table">
                                    <TableHeader>
                                        <TableColumn>งาน</TableColumn>
                                        <TableColumn align="center">คะแนนเฉลี่ย</TableColumn>
                                        <TableColumn align="center">ตรวจแล้ว</TableColumn>
                                        <TableColumn align="center">ความก้าวหน้า</TableColumn>
                                    </TableHeader>
                                    <TableBody items={filteredAssignments.slice(0, 8)}>
                                        {(assignment) => (
                                            <TableRow key={assignment.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Tooltip content={getAssignmentTypeConfig(assignment.assignment_type).label}>
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getAssignmentTypeConfig(assignment.assignment_type).bgClass}`}>
                                                                <Icon icon={getAssignmentTypeConfig(assignment.assignment_type).icon} className={`text-lg ${getAssignmentTypeConfig(assignment.assignment_type).textClass}`} />
                                                            </div>
                                                        </Tooltip>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="font-medium text-slate-800">{assignment.name}</p>
                                                                {assignment.is_score_visible === false && (
                                                                    <Tooltip content="คะแนนงานนี้ถูกซ่อนจากนักศึกษา">
                                                                        <div className="flex items-center text-amber-500 cursor-help">
                                                                            <Icon icon="solar:eye-closed-linear" width={16} />
                                                                        </div>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <Chip 
                                                                    size="sm" 
                                                                    variant="flat" 
                                                                    color={getAssignmentTypeConfig(assignment.assignment_type).color}
                                                                    className="h-5 text-xs"
                                                                >
                                                                    {getAssignmentTypeConfig(assignment.assignment_type).shortLabel}
                                                                </Chip>
                                                                <span className="text-xs text-slate-400">เต็ม {assignment.max_score}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {assignment.avgScore !== null ? (
                                                        <div className="text-center">
                                                            <span className="font-semibold text-slate-700 text-lg">{assignment.avgScore}</span>
                                                            <span className="text-xs text-slate-400 ml-1">/ {assignment.max_score}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-center block">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col items-center">
                                                        <Chip 
                                                            size="sm" 
                                                            color={assignment.scoredCount > 0 ? "success" : "default"} 
                                                            variant="flat"
                                                        >
                                                            {assignment.scoredCount} {(assignment.assignment_type === 'permanent_group' || assignment.assignment_type === 'weekly_group') ? 'กลุ่ม' : 'คน'}
                                                        </Chip>
                                                        {!(assignment.assignment_type === 'permanent_group' || assignment.assignment_type === 'weekly_group') && assignment.notScoredCount > 0 && (
                                                            <span className="text-xs text-slate-400 mt-1">
                                                                ยังไม่ตรวจ {assignment.notScoredCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {!(assignment.assignment_type === 'permanent_group' || assignment.assignment_type === 'weekly_group') ? (
                                                        <div className="flex items-center gap-2 justify-center">
                                                            <Progress
                                                                value={assignment.submittedRate}
                                                                color={assignment.submittedRate >= 80 ? "success" : assignment.submittedRate >= 50 ? "warning" : "danger"}
                                                                size="sm"
                                                                className="w-20"
                                                            />
                                                            <span className="text-xs text-slate-500 w-10 text-right">{assignment.submittedRate}%</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 text-center block">งานกลุ่ม</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : overview?.assignments && overview.assignments.length > 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Icon icon="solar:filter-linear" className="text-3xl text-slate-300" />
                                </div>
                                <p className="text-sm text-slate-500">ไม่มีงานประเภทนี้</p>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    className="mt-3"
                                    onPress={onResetAssignmentTypeFilter}
                                >
                                    แสดงงานทั้งหมด
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Icon icon="solar:document-add-linear" className="text-3xl text-slate-300" />
                                </div>
                                <p className="text-sm text-slate-500">ยังไม่มีงานที่มอบหมาย</p>
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant="flat"
                                    className="mt-3"
                                    onPress={onNavigateToAssignments}
                                    startContent={<Icon icon="solar:add-circle-bold" />}
                                >
                                    สร้างงานใหม่
                                </Button>
                            </div>
                        )}
                        
                        {/* Mobile: Show all assignments button */}
                        {assignments.length > 0 && (
                            <div className="p-4 border-t border-slate-100 sm:hidden">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                    className="w-full"
                                    onPress={onNavigateToAssignments}
                                    endContent={<Icon icon="solar:arrow-right-linear" />}
                                >
                                    ดูงานทั้งหมด
                                </Button>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Recent Activity */}
                <Card className="shadow-sm border border-slate-200">
                    <CardHeader className="px-5 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:history-bold" className="text-xl text-purple-500" />
                            <span className="font-semibold text-slate-800">กิจกรรมล่าสุด</span>
                        </div>
                    </CardHeader>
                    <CardBody className="px-4 py-3">
                        {overview?.recentActivities && overview.recentActivities.length > 0 ? (
                            <div className="space-y-3">
                                {overview.recentActivities.slice(0, 5).map((activity) => (
                                    <div key={activity.id} className="flex items-start gap-3">
                                        <Avatar
                                            name={activity.user?.full_name || '?'}
                                            src={activity.user?.avatar || undefined}
                                            size="sm"
                                            className="shrink-0 bg-gradient-to-br from-purple-400 to-pink-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-700 line-clamp-2">{activity.description}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-slate-400">{formatRelativeTime(activity.timestamp)}</span>
                                                <Chip size="sm" variant="flat" color="primary" className="h-5">
                                                    {activity.score} คะแนน
                                                </Chip>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Icon icon="solar:history-2-linear" className="text-4xl text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">ยังไม่มีกิจกรรม</p>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* TA Activity & Course Info Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TA Activity - Only visible to instructor */}
                {(userRole === "instructor" || userRole === "admin") && (
                    <Card className="shadow-sm border border-slate-200 overflow-hidden">
                        <CardHeader className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                                    <Icon icon="solar:user-hands-bold" className="text-xl text-white" />
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-800 block">กิจกรรม TA</span>
                                    <span className="text-xs text-slate-500">เฉพาะอาจารย์</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardBody className="px-5 py-4">
                            {overview?.taActivity && overview.taActivity.length > 0 ? (
                                <div className="space-y-3">
                                    {overview.taActivity.map((ta, idx) => (
                                        <div key={ta.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                            <div className="relative">
                                                <Avatar
                                                    name={ta.full_name}
                                                    src={ta.avatar || undefined}
                                                    size="md"
                                                    className="bg-gradient-to-br from-emerald-500 to-teal-600"
                                                />
                                                {idx === 0 && ta.gradedCount > 0 && (
                                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                                                        <Icon icon="solar:star-bold" className="text-xs text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-800">{ta.full_name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {ta.lastActive ? formatRelativeTime(ta.lastActive) : 'ยังไม่มีกิจกรรม'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-emerald-600">{ta.gradedCount}</p>
                                                <p className="text-xs text-slate-500">ชิ้นงาน</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Icon icon="solar:user-hands-linear" className="text-3xl text-slate-300" />
                                    </div>
                                    <p className="text-sm text-slate-500">ยังไม่มีผู้ช่วยสอน</p>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                )}

                {/* Course Info */}
                <Card className="shadow-sm border border-slate-200">
                    <CardHeader className="px-5 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:info-circle-bold" className="text-xl text-blue-500" />
                            <span className="font-semibold text-slate-800">ข้อมูลรายวิชา</span>
                        </div>
                    </CardHeader>
                    <CardBody className="px-5 py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon icon="solar:hashtag-bold" className="text-blue-500" />
                                    <p className="text-xs text-slate-500">รหัสวิชา</p>
                                </div>
                                <p className="font-bold text-slate-800">{course.code}</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon icon="solar:calendar-bold" className="text-purple-500" />
                                    <p className="text-xs text-slate-500">ปีการศึกษา</p>
                                </div>
                                <p className="font-bold text-slate-800">{course.year}</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon icon="solar:notebook-bold" className="text-emerald-500" />
                                    <p className="text-xs text-slate-500">ภาคเรียน</p>
                                </div>
                                <p className="font-bold text-slate-800">
                                    {course.semester === 3 ? "ฤดูร้อน" : `ภาค ${course.semester}`}
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon icon="solar:user-bold" className="text-amber-500" />
                                    <p className="text-xs text-slate-500">ผู้สอน</p>
                                </div>
                                <p className="font-bold text-slate-800 truncate">{course.instructor?.full_name || "-"}</p>
                            </div>
                        </div>
                        
                        {course.description && (
                            <>
                                <Divider />
                                <div>
                                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                                        <Icon icon="solar:document-text-bold" className="text-sm" />
                                        คำอธิบายรายวิชา
                                    </p>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{course.description}</p>
                                </div>
                            </>
                        )}
                        
                        {/* TAs List for TA view */}
                        {userRole === "ta" && course.tas && course.tas.length > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                                        <Icon icon="solar:users-group-rounded-bold" className="text-sm" />
                                        ผู้ช่วยสอนในรายวิชา
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {course.tas.map((ta) => (
                                            <Chip
                                                key={ta.id}
                                                variant="flat"
                                                color="success"
                                                size="sm"
                                            >
                                                {ta.full_name}
                                            </Chip>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </CardBody>
                </Card>
            </div>
            {/* Student Detail Modal */}
            <StudentDetailModal
                isOpen={!!selectedStudent}
                onClose={() => setSelectedStudent(null)}
                student={selectedStudent}
                courseId={course.id}
            />
        </div>
    );
}

export const OverviewTabView = memo(OverviewTabViewComponent);
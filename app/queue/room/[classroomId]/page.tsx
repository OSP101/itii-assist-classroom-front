"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import queueService, { type ConcurrentSessionInfo } from "@/services/queue.service";

export default function QueueRoomPage() {
    const params = useParams();
    const router = useRouter();
    const classroomId = params.classroomId as string;

    const [sessions, setSessions] = useState<ConcurrentSessionInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
        try {
            const data = await queueService.getClassroomActiveSessions(classroomId);
            setSessions(data);
            if (data.length === 1) {
                router.replace(`/queue/book`);
                return;
            }
        } catch {
            setError("ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setIsLoading(false);
        }
    }, [classroomId, router]);

    useEffect(() => {
        document.title = "เลือกวิชาเพื่อจองคิว - LabTAS";
        fetchSessions();
    }, [fetchSessions]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error || sessions.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="text-center max-w-sm">
                    <Icon icon="solar:close-circle-bold" className="text-5xl text-default-300 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-foreground mb-2">ไม่พบคิวที่เปิดอยู่</h2>
                    <p className="text-sm text-default-500 mb-4">
                        {error || "ขณะนี้ยังไม่มีการเปิดรับจองคิวในห้องนี้"}
                    </p>
                    <Button variant="flat" onPress={() => router.push("/queue/book")}>
                        กรอก PIN เอง
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-md mx-auto px-4 py-12">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-100 flex items-center justify-center">
                        <Icon icon="solar:users-group-rounded-bold" className="text-3xl text-primary-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">เลือกวิชาของคุณ</h1>
                    <p className="text-sm text-default-500 mt-2">มีการเปิดรับคิว {sessions.length} วิชาพร้อมกันในห้องนี้</p>
                </div>

                <div className="space-y-3">
                    {sessions.map(session => (
                        <Card
                            key={session.id}
                            isPressable
                            onPress={() => router.push(`/queue/book`)}
                            className="border border-default-200 hover:border-primary-400 transition-colors"
                        >
                            <CardBody className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-primary-600 mb-0.5 truncate">{session.course_name}</p>
                                        <p className="font-semibold text-foreground truncate">{session.title}</p>
                                    </div>
                                    <Chip
                                        size="sm"
                                        color={session.status === 'active' ? 'success' : 'warning'}
                                        variant="flat"
                                    >
                                        {session.status === 'active' ? 'เปิดอยู่' : 'หยุดชั่วคราว'}
                                    </Chip>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <p className="text-xs text-default-400">กรอก PIN ที่แสดงบนจอสำหรับวิชานี้</p>
                                    <Icon icon="solar:arrow-right-bold" className="text-default-400" />
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>

                <div className="mt-6 text-center">
                    <Button
                        variant="flat"
                        size="sm"
                        color="default"
                        onPress={() => router.push("/queue/book")}
                        startContent={<Icon icon="solar:keyboard-bold" className="text-base" />}
                    >
                        กรอก PIN เอง
                    </Button>
                </div>
            </div>
        </div>
    );
}

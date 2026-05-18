"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/toast";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";

import { API_BASE_URL } from "@/config/api";

interface ActiveSession {
  id: string;
  title: string;
  pin_code: string;
  status: "active" | "paused";
  course: {
    id: string;
    code: string;
    name: string;
  };
}

interface DeskInfo {
  desk: {
    id: string;
    number: number;
    type: string;
    type_label: string;
    is_enabled: boolean;
    hostname?: string;
    ip_address?: string;
    notes?: string;
  };
  classroom: {
    id: string;
    name: string;
    building: string;
    floor: string;
  };
  active_sessions: ActiveSession[];
}

export default function DeskScanPage() {
  const params = useParams();
  const router = useRouter();
  const deskId = params.deskId as string;

  const [info, setInfo] = useState<DeskInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmSession, setConfirmSession] = useState<ActiveSession | null>(null);
  const [confirmType, setConfirmType] = useState<"grading" | "help">("grading");

  useEffect(() => {
    const fetchDesk = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/desks/${encodeURIComponent(deskId)}`);
        const result = await res.json();
        if (!res.ok || !result.success) {
          setError(result.message || "ไม่พบข้อมูลโต๊ะ");
          return;
        }
        setInfo(result.data as DeskInfo);
      } catch {
        setError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่");
      } finally {
        setLoading(false);
      }
    };

    fetchDesk();
  }, [deskId]);

  const handleBookSession = (session: ActiveSession) => {
    if (session.status === "paused") {
      addToast({
        title: "ปิดรับการจองชั่วคราว",
        description: `${session.title} กำลังหยุดพัก กรุณารอสักครู่`,
        color: "warning",
        timeout: 3000,
        shouldShowTimeoutProgress: true,
      });
      return;
    }
    setConfirmType("grading");
    setConfirmSession(session);
  };

  const handleConfirmBooking = () => {
    if (!confirmSession || !info) return;
    router.push(
      `/queue/book?pin=${encodeURIComponent(confirmSession.pin_code)}&desk=${info.desk.number}&type=${confirmType}`
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-sky-500 via-sky-600 to-cyan-600 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardBody className="p-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-linear-to-br from-sky-400 to-cyan-500 rounded-2xl flex items-center justify-center">
              <Icon icon="solar:qr-code-bold-duotone" className="text-3xl text-white" />
            </div>
            <Spinner size="lg" color="primary" />
            <p className="text-slate-500">กำลังโหลดข้อมูลโต๊ะ...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !info) {
    return (
      <div className="min-h-screen bg-linear-to-br from-sky-500 via-sky-600 to-cyan-600 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardBody className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-3xl text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">ไม่พบข้อมูล</h1>
            <p className="text-slate-500 text-sm">{error ?? "ไม่พบข้อมูลโต๊ะนี้ในระบบ"}</p>
            <Button
              variant="flat"
              onPress={() => router.push("/student/scan")}
              startContent={<Icon icon="solar:arrow-left-bold" />}
            >
              กลับไปสแกน
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { desk, classroom, active_sessions } = info;
  const hasActiveSessions = active_sessions.length > 0;

  const deskTypeIcon: Record<string, string> = {
    computer: "solar:monitor-bold-duotone",
    normal: "solar:chair-bold-duotone",
    teacher: "solar:crown-star-bold-duotone",
  };

  // ── Active session(s) found ───────────────────────────────────────────────
  if (hasActiveSessions) {
    return (
      <div className="min-h-screen bg-linear-to-br from-sky-500 via-sky-600 to-cyan-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-3">
          {/* Desk header card */}
          <Card className="shadow-2xl">
            <CardBody className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-sky-400 to-cyan-500 flex items-center justify-center shrink-0">
                  <Icon
                    icon={deskTypeIcon[desk.type] ?? "solar:chair-bold-duotone"}
                    className="text-3xl text-white"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">โต๊ะหมายเลข</p>
                  <p className="text-3xl font-bold text-slate-800 leading-none">{desk.number}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {classroom.name} · {classroom.building}
                    {classroom.floor ? ` ชั้น ${classroom.floor}` : ""}
                  </p>
                  {(desk.hostname || desk.ip_address) && (
                    <p className="text-xs text-sky-500 mt-1 font-mono">
                      {[desk.hostname, desk.ip_address].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Session list */}
          <div className="space-y-2">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider px-1">
              การจองคิวที่กำลังเปิดรับ
            </p>
            {active_sessions.map((session) => (
              <Card key={session.id} className="shadow-xl">
                <CardBody className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={session.status === "active" ? "success" : "warning"}
                          startContent={
                            <Icon
                              icon={session.status === "active" ? "solar:play-circle-bold" : "solar:pause-circle-bold"}
                              className="text-xs"
                            />
                          }
                        >
                          {session.status === "active" ? "กำลังรับจอง" : "หยุดพักชั่วคราว"}
                        </Chip>
                      </div>
                      <p className="font-bold text-slate-800 text-base truncate">{session.title}</p>
                      <p className="text-slate-500 text-sm truncate">
                        {session.course.code} — {session.course.name}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-sky-400 to-cyan-500 flex items-center justify-center shrink-0">
                      <Icon icon="solar:ticket-bold" className="text-xl text-white" />
                    </div>
                  </div>

                  <Divider className="mb-4" />

                  <Button
                    color="primary"
                    size="lg"
                    className="w-full bg-linear-to-r from-sky-500 to-cyan-500"
                    isDisabled={session.status === "paused"}
                    onPress={() => handleBookSession(session)}
                    startContent={<Icon icon="solar:ticket-bold" className="text-lg" />}
                  >
                    {session.status === "paused" ? "ปิดรับชั่วคราว" : "จองคิวเลย"}
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>

          <Button
            variant="flat"
            className="w-full bg-white/10 text-white border border-white/20"
            onPress={() => router.push("/student/scan")}
            startContent={<Icon icon="solar:arrow-left-bold" />}
          >
            กลับ
          </Button>
        </div>

        {/* Booking type confirmation modal */}
        <Modal
          isOpen={!!confirmSession}
          onClose={() => setConfirmSession(null)}
          placement="bottom"
          size="sm"
          classNames={{ backdrop: "bg-black/50" }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex flex-col gap-1 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-sky-400 to-cyan-500 flex items-center justify-center shrink-0">
                      <Icon icon="solar:ticket-bold-duotone" className="text-xl text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{confirmSession?.title}</p>
                      <p className="text-xs text-slate-500">โต๊ะหมายเลข {desk.number} · {confirmSession?.course.code}</p>
                    </div>
                  </div>
                </ModalHeader>
                <ModalBody className="pt-0 pb-2">
                  <p className="text-sm font-semibold text-slate-700 mb-3">คุณต้องการจองคิวเพื่ออะไร?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmType("grading")}
                      className={`rounded-3xl border-2 p-4 transition active:scale-[0.98] ${
                        confirmType === "grading"
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      }`}
                    >
                      <Icon
                        icon="solar:clipboard-check-bold-duotone"
                        className={`mx-auto mb-2 text-3xl ${confirmType === "grading" ? "text-emerald-500" : "text-slate-300"}`}
                      />
                      <p className={`text-sm font-semibold ${confirmType === "grading" ? "text-emerald-700" : "text-slate-500"}`}>
                        ตรวจงาน
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmType("help")}
                      className={`rounded-3xl border-2 p-4 transition active:scale-[0.98] ${
                        confirmType === "help"
                          ? "border-amber-400 bg-amber-50"
                          : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      }`}
                    >
                      <Icon
                        icon="solar:hand-shake-bold-duotone"
                        className={`mx-auto mb-2 text-3xl ${confirmType === "help" ? "text-amber-500" : "text-slate-300"}`}
                      />
                      <p className={`text-sm font-semibold ${confirmType === "help" ? "text-amber-700" : "text-slate-500"}`}>
                        ขอความช่วยเหลือ
                      </p>
                    </button>
                  </div>
                </ModalBody>
                <ModalFooter className="pt-3">
                  <Button
                    variant="flat"
                    onPress={() => setConfirmSession(null)}
                    className="flex-1"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    className="flex-1 bg-linear-to-r from-sky-500 to-cyan-500 text-white font-semibold"
                    onPress={handleConfirmBooking}
                    startContent={<Icon icon="solar:ticket-bold" />}
                  >
                    จองคิว
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    );
  }

  // ── No active sessions – show desk info ──────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-sky-500 via-sky-600 to-cyan-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <Card className="shadow-2xl">
          <CardBody className="p-7">
            {/* Icon + desk number */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-linear-to-br from-sky-400 to-cyan-500 flex items-center justify-center">
                <Icon
                  icon={deskTypeIcon[desk.type] ?? "solar:chair-bold-duotone"}
                  className="text-4xl text-white"
                />
              </div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">โต๊ะหมายเลข</p>
              <p className="text-6xl font-bold text-slate-800 leading-none">{desk.number}</p>
              <p className="text-sm text-slate-500 mt-2">{desk.type_label}</p>
            </div>

            <Divider className="mb-5" />

            {/* Classroom info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <Icon icon="solar:buildings-bold-duotone" className="text-xl text-sky-500 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">ห้องเรียน</p>
                  <p className="font-semibold text-slate-800">{classroom.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <Icon icon="solar:map-point-bold-duotone" className="text-xl text-sky-500 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">อาคาร</p>
                  <p className="font-semibold text-slate-800">
                    {classroom.building}
                    {classroom.floor ? ` ชั้น ${classroom.floor}` : ""}
                  </p>
                </div>
              </div>
              {desk.hostname && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <Icon icon="solar:monitor-bold-duotone" className="text-xl text-sky-500 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">ชื่อเครื่อง</p>
                    <p className="font-semibold text-slate-800 font-mono">{desk.hostname}</p>
                  </div>
                </div>
              )}
              {desk.ip_address && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <Icon icon="solar:server-bold-duotone" className="text-xl text-sky-500 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">หมายเลข IP</p>
                    <p className="font-semibold text-slate-800 font-mono">{desk.ip_address}</p>
                  </div>
                </div>
              )}
              {desk.notes && (
                <div className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3">
                  <Icon icon="solar:notes-bold-duotone" className="text-xl text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-amber-600">หมายเหตุ</p>
                    <p className="text-sm text-amber-800">{desk.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* No session notice */}
            <div className="mt-5 p-4 rounded-xl bg-slate-100 text-slate-500 text-sm flex items-start gap-2">
              <Icon icon="solar:info-circle-bold" className="text-lg shrink-0 mt-0.5 text-slate-400" />
              <span>ยังไม่มีการเปิดรับจองคิวสำหรับโต๊ะนี้ในขณะนี้</span>
            </div>
          </CardBody>
        </Card>

        <Button
          variant="flat"
          className="w-full bg-white/10 text-white border border-white/20"
          onPress={() => router.push("/student/scan")}
          startContent={<Icon icon="solar:arrow-left-bold" />}
        >
          กลับ
        </Button>
      </div>
    </div>
  );
}

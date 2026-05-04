"use client";

import { memo, useCallback, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { Session } from "@/services";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface ActiveSessionsSectionProps {
  sessions: Session[];
  isLoadingSessions: boolean;
  revokingSessionId: number | null;
  onRevokeSession: (session: Session) => void;
  onShowRevokeAllModal: () => void;
}

function ActiveSessionsSection({
  sessions,
  isLoadingSessions,
  revokingSessionId,
  onRevokeSession,
  onShowRevokeAllModal,
}: ActiveSessionsSectionProps) {
  const orderedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
    [sessions]
  );

  const getDeviceIcon = useCallback((device: string, os: string) => {
    const osLower = os.toLowerCase();
    if (osLower.includes('windows')) return "solar:laptop-minimalistic-bold";
    if (osLower.includes('mac')) return "solar:laptop-minimalistic-bold";
    if (osLower.includes('linux')) return "solar:laptop-minimalistic-bold";
    if (osLower.includes('android')) return "solar:smartphone-bold";
    if (osLower.includes('ios') || osLower.includes('iphone')) return "solar:smartphone-bold";
    if (device === 'tablet') return "solar:tablet-bold";
    return "solar:monitor-bold";
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border border-default-200 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-default-100">
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="font-semibold">Active Sessions</h3>
              <p className="text-sm text-default-500 mt-0.5">อุปกรณ์และเซสชันที่เข้าสู่ระบบอยู่</p>
            </div>
            {orderedSessions.filter(s => !s.isCurrent).length > 0 && (
              <Button
                size="sm"
                color="danger"
                variant="light"
                startContent={<Icon icon="solar:logout-2-linear" />}
                onPress={onShowRevokeAllModal}
              >
                ออกจากระบบทั้งหมด
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-default-500">
              <Icon icon="solar:devices-linear" className="text-4xl mx-auto mb-2 text-default-300" />
              <p>ไม่พบเซสชันที่ใช้งานอยู่</p>
            </div>
          ) : (
            <div className="divide-y divide-default-100">
              {orderedSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-default-50 transition-colors"
                >
                  <div className="p-2.5 bg-default-100 rounded-lg flex-shrink-0">
                    <Icon icon={getDeviceIcon(session.device, session.os)} className="text-xl text-default-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-default-900">{session.os}</p>
                      {session.isCurrent && (
                        <Chip size="sm" color="primary" variant="flat">
                          เซสชันปัจจุบัน
                        </Chip>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-sm text-default-500">
                      <div className="flex items-center gap-1.5">
                        <Icon icon="solar:global-linear" className="text-sm" />
                        <span>{session.browser}</span>
                        <span className="text-default-300">·</span>
                        <span>IP: {session.ip}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Icon icon="solar:clock-circle-linear" className="text-sm" />
                        <span>
                          เข้าสู่ระบบ: {new Date(session.loginAt).toLocaleDateString('th-TH')} {new Date(session.loginAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-default-300">·</span>
                        <span className="text-success-600">
                          {formatDistanceToNow(new Date(session.loginAt), { addSuffix: true, locale: th })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      isIconOnly
                      onPress={() => onRevokeSession(session)}
                      isLoading={revokingSessionId === session.id}
                    >
                      <Icon icon="solar:logout-2-linear" className="text-lg" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Icon icon="solar:info-circle-bold" className="text-xl text-warning mt-0.5" />
          <div>
            <p className="font-medium text-warning-700">ความปลอดภัยของบัญชี</p>
            <p className="text-sm text-warning-600 mt-1">
              หากคุณเห็นอุปกรณ์ที่ไม่คุ้นเคย ให้ออกจากระบบอุปกรณ์นั้นทันทีและเปลี่ยนรหัสผ่านของคุณ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ActiveSessionsSection);

"use client";

import { memo, useCallback, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Icon } from "@iconify/react";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { Session } from "@/services";
import { formatDistanceToNow } from "date-fns";
import { enUS, th } from "date-fns/locale";

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
  const { language } = useGlobalSettings();
  const languageKey = language === "en" ? "en" : "th";
  const locale = languageKey === "en" ? "en-US" : "th-TH";
  const distanceLocale = languageKey === "en" ? enUS : th;
  const copy = languageKey === "en"
    ? {
        title: "Active Sessions",
        description: "Devices and sessions currently signed in",
        signOutAll: "Sign out all",
        empty: "No active sessions found",
        currentSession: "Current session",
        ipAddress: "IP",
        signedInAt: "Signed in",
        signOutThisDevice: "Sign out this device",
        accountSecurity: "Account security",
        securityDescription: "If you see an unfamiliar device, sign it out immediately and change your password.",
      }
    : {
        title: "เซสชันที่ใช้งานอยู่",
        description: "อุปกรณ์และเซสชันที่เข้าสู่ระบบอยู่",
        signOutAll: "ออกจากระบบทั้งหมด",
        empty: "ไม่พบเซสชันที่ใช้งานอยู่",
        currentSession: "เซสชันปัจจุบัน",
        ipAddress: "IP",
        signedInAt: "เข้าสู่ระบบ",
        signOutThisDevice: "ออกจากระบบเครื่องนี้",
        accountSecurity: "ความปลอดภัยของบัญชี",
        securityDescription: "หากคุณเห็นอุปกรณ์ที่ไม่คุ้นเคย ให้ออกจากระบบอุปกรณ์นั้นทันทีและเปลี่ยนรหัสผ่านของคุณ",
      };
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
              <h3 className="font-semibold">{copy.title}</h3>
              <p className="text-sm text-default-500 mt-0.5">{copy.description}</p>
            </div>
            {orderedSessions.filter(s => !s.isCurrent).length > 0 && (
              <Button
                size="sm"
                color="danger"
                variant="light"
                startContent={<Icon icon="solar:logout-2-linear" />}
                onPress={onShowRevokeAllModal}
              >
                {copy.signOutAll}
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
              <p>{copy.empty}</p>
            </div>
          ) : (
            <div className="divide-y divide-default-100">
              {orderedSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-default-50 transition-colors"
                >
                  <div className="p-2.5 bg-default-100 rounded-lg shrink-0">
                    <Icon icon={getDeviceIcon(session.device, session.os)} className="text-xl text-default-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-default-900">{session.os}</p>
                      {session.isCurrent && (
                        <Chip size="sm" color="primary" variant="flat">
                          {copy.currentSession}
                        </Chip>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-sm text-default-500">
                      <div className="flex items-center gap-1.5">
                        <Icon icon="solar:global-linear" className="text-sm" />
                        <span>{session.browser}</span>
                        <span className="text-default-300">·</span>
                        <span>{copy.ipAddress}: {session.ip}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Icon icon="solar:clock-circle-linear" className="text-sm" />
                        <span>
                          {copy.signedInAt}: {new Date(session.loginAt).toLocaleDateString(locale)} {new Date(session.loginAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-default-300">·</span>
                        <span className="text-success-600">
                          {formatDistanceToNow(new Date(session.loginAt), { addSuffix: true, locale: distanceLocale })}
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
                      aria-label={copy.signOutThisDevice}
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
            <p className="font-medium text-warning-700">{copy.accountSecurity}</p>
            <p className="text-sm text-warning-600 mt-1">
              {copy.securityDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ActiveSessionsSection);

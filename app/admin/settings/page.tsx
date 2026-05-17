"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";

export default function AdminSettingsPage() {
    const t = useI18n();

    const [pinLength, setPinLength] = useState("6");
    const [pinExpireMinutes, setPinExpireMinutes] = useState("10");

    const [notifyOnLogin, setNotifyOnLogin] = useState(true);
    const [notifyOnCourseCreate, setNotifyOnCourseCreate] = useState(true);

    const [allowLateAttendance, setAllowLateAttendance] = useState(true);
    const [lateThresholdMinutes, setLateThresholdMinutes] = useState("15");

    const handleSave = () => {
        addToast({
            title: t("success"),
            description: t("settingsSaved"),
            color: "success",
            timeout: 3000,
            shouldShowTimeoutProgress: true,
        });
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold text-default-900">{t("systemSettings")}</h1>
                <p className="text-sm text-default-500 mt-1">{t("systemSettingsDescription")}</p>
            </div>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Icon icon="solar:key-bold" className="text-xl text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{t("attendancePinSettings")}</h3>
                            <p className="text-xs text-default-500">{t("attendancePinSettingsDescription")}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label={t("pinLength")}
                            labelPlacement="outside"
                            type="number"
                            value={pinLength}
                            onValueChange={setPinLength}
                            min={4}
                            max={8}
                            variant="bordered"
                            description={t("pinLengthDescription")}
                            classNames={{ inputWrapper: "bg-content2 border-default-200" }}
                        />
                        <Input
                            label={t("pinExpireMinutes")}
                            labelPlacement="outside"
                            type="number"
                            value={pinExpireMinutes}
                            onValueChange={setPinExpireMinutes}
                            min={1}
                            max={60}
                            variant="bordered"
                            description={t("pinExpireMinutesDescription")}
                            classNames={{ inputWrapper: "bg-content2 border-default-200" }}
                        />
                    </div>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <Icon icon="solar:check-circle-bold" className="text-xl text-green-600 dark:text-green-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{t("attendanceSettings")}</h3>
                            <p className="text-xs text-default-500">{t("attendanceSettingsDescription")}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t("allowLateAttendance")}</p>
                            <p className="text-xs text-default-500">{t("allowLateAttendanceDescription")}</p>
                        </div>
                        <Switch isSelected={allowLateAttendance} onValueChange={setAllowLateAttendance} color="success" />
                    </div>
                    {allowLateAttendance && (
                        <>
                            <Divider />
                            <Input
                                label={t("lateThresholdMinutes")}
                                labelPlacement="outside"
                                type="number"
                                value={lateThresholdMinutes}
                                onValueChange={setLateThresholdMinutes}
                                min={1}
                                max={120}
                                variant="bordered"
                                description={t("lateThresholdDescription")}
                                classNames={{ inputWrapper: "bg-content2 border-default-200" }}
                                className="max-w-xs"
                            />
                        </>
                    )}
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Icon icon="solar:bell-bold" className="text-xl text-purple-600 dark:text-purple-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{t("notificationSettings")}</h3>
                            <p className="text-xs text-default-500">{t("notificationSettingsDescription")}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t("notifyOnLogin")}</p>
                            <p className="text-xs text-default-500">{t("notifyOnLoginDescription")}</p>
                        </div>
                        <Switch isSelected={notifyOnLogin} onValueChange={setNotifyOnLogin} color="secondary" />
                    </div>
                    <Divider />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t("notifyOnCourseCreate")}</p>
                            <p className="text-xs text-default-500">{t("notifyOnCourseCreateDescription")}</p>
                        </div>
                        <Switch isSelected={notifyOnCourseCreate} onValueChange={setNotifyOnCourseCreate} color="secondary" />
                    </div>
                </CardBody>
            </Card>

            <Card className="border border-default-200 bg-content1 shadow-sm">
                <CardHeader className="px-6 py-4 border-b border-default-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-default-100 rounded-lg">
                            <Icon icon="solar:info-circle-bold" className="text-xl text-default-600" />
                        </div>
                        <h3 className="font-semibold text-foreground">{t("systemInfo")}</h3>
                    </div>
                </CardHeader>
                <CardBody className="px-6 py-5">
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-default-500">{t("platformLabel")}</span>
                            <Chip size="sm" variant="flat">ITII Assist Classroom</Chip>
                        </div>
                        <Divider />
                        <div className="flex justify-between items-center">
                            <span className="text-default-500">{t("versionLabel")}</span>
                            <Chip size="sm" variant="flat" color="primary">v1.0.0</Chip>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <div className="flex justify-end pt-2">
                <Button
                    color="primary"
                    onPress={handleSave}
                    startContent={<Icon icon="solar:diskette-bold" className="text-lg" />}
                    className="font-medium px-8 bg-linear-to-r from-blue-400 to-indigo-500"
                >
                    {t("saveSettings")}
                </Button>
            </div>
        </div>
    );
}

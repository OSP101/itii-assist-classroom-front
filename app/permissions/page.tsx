"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import Link from "next/link";

type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported" | "checking";

interface PermissionState {
    location: PermissionStatus;
    notification: PermissionStatus;
    camera: PermissionStatus;
}

export default function PermissionsPage() {
    const [permissions, setPermissions] = useState<PermissionState>({
        location: "checking",
        notification: "checking",
        camera: "checking",
    });
    const [locationDetails, setLocationDetails] = useState<{
        lat: number;
        lng: number;
        accuracy: number;
    } | null>(null);
    const [isTestingLocation, setIsTestingLocation] = useState(false);
    const [isTestingCamera, setIsTestingCamera] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

    // Check all permissions on mount
    const checkPermissions = useCallback(async () => {
        // Check Location Permission
        if ("geolocation" in navigator) {
            try {
                const result = await navigator.permissions.query({ name: "geolocation" });
                setPermissions(prev => ({ ...prev, location: result.state as PermissionStatus }));
                
                result.addEventListener("change", () => {
                    setPermissions(prev => ({ ...prev, location: result.state as PermissionStatus }));
                });
            } catch {
                setPermissions(prev => ({ ...prev, location: "prompt" }));
            }
        } else {
            setPermissions(prev => ({ ...prev, location: "unsupported" }));
        }

        // Check Notification Permission
        if ("Notification" in window) {
            const status = Notification.permission;
            setPermissions(prev => ({ 
                ...prev, 
                notification: status === "default" ? "prompt" : status as PermissionStatus 
            }));
        } else {
            setPermissions(prev => ({ ...prev, notification: "unsupported" }));
        }

        // Check Camera Permission
        if ("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices) {
            try {
                const result = await navigator.permissions.query({ name: "camera" as PermissionName });
                setPermissions(prev => ({ ...prev, camera: result.state as PermissionStatus }));
                
                result.addEventListener("change", () => {
                    setPermissions(prev => ({ ...prev, camera: result.state as PermissionStatus }));
                });
            } catch {
                setPermissions(prev => ({ ...prev, camera: "prompt" }));
            }
        } else {
            setPermissions(prev => ({ ...prev, camera: "unsupported" }));
        }
    }, []);

    useEffect(() => {
        checkPermissions();
    }, [checkPermissions]);

    // Cleanup camera stream on unmount
    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [cameraStream]);

    // Request Location Permission
    const requestLocation = async () => {
        setIsTestingLocation(true);
        setLocationDetails(null);

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                });
            });

            setLocationDetails({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
            });

            setPermissions(prev => ({ ...prev, location: "granted" }));
            addToast({
                title: "สำเร็จ",
                description: "อนุญาตการเข้าถึงตำแหน่งแล้ว",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        } catch (error: unknown) {
            const geoError = error as GeolocationPositionError;
            if (geoError.code === geoError.PERMISSION_DENIED) {
                setPermissions(prev => ({ ...prev, location: "denied" }));
                addToast({
                    title: "ถูกปฏิเสธ",
                    description: "การเข้าถึงตำแหน่งถูกปฏิเสธ กรุณาเปิดในการตั้งค่าเบราว์เซอร์",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: "ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่",
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } finally {
            setIsTestingLocation(false);
        }
    };

    // Request Notification Permission
    const requestNotification = async () => {
        try {
            const result = await Notification.requestPermission();
            setPermissions(prev => ({ 
                ...prev, 
                notification: result === "default" ? "prompt" : result as PermissionStatus 
            }));

            if (result === "granted") {
                // Show test notification
                new Notification("ITII Assist Classroom", {
                    body: "การแจ้งเตือนเปิดใช้งานแล้ว! 🎉",
                    icon: "/images/logo.png",
                });
                addToast({
                    title: "สำเร็จ",
                    description: "อนุญาตการแจ้งเตือนแล้ว",
                    color: "success",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else if (result === "denied") {
                addToast({
                    title: "ถูกปฏิเสธ",
                    description: "การแจ้งเตือนถูกปฏิเสธ กรุณาเปิดในการตั้งค่าเบราว์เซอร์",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
        } catch (error) {
            console.error("Notification error:", error);
            addToast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถขอสิทธิ์แจ้งเตือนได้",
                color: "danger",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });
        }
    };

    // Request Camera Permission
    const requestCamera = async () => {
        setIsTestingCamera(true);

        // Stop existing stream if any
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user" },
                audio: false 
            });
            
            setCameraStream(stream);
            setPermissions(prev => ({ ...prev, camera: "granted" }));
            addToast({
                title: "สำเร็จ",
                description: "อนุญาตการเข้าถึงกล้องแล้ว",
                color: "success",
                timeout: 3000,
                shouldShowTimeoutProgress: true,
            });

            // Auto stop after 10 seconds
            setTimeout(() => {
                stream.getTracks().forEach(track => track.stop());
                setCameraStream(null);
                setIsTestingCamera(false);
            }, 10000);
        } catch (error: unknown) {
            const mediaError = error as DOMException;
            if (mediaError.name === "NotAllowedError") {
                setPermissions(prev => ({ ...prev, camera: "denied" }));
                addToast({
                    title: "ถูกปฏิเสธ",
                    description: "การเข้าถึงกล้องถูกปฏิเสธ กรุณาเปิดในการตั้งค่าเบราว์เซอร์",
                    color: "danger",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            } else {
                addToast({
                    title: "เกิดข้อผิดพลาด",
                    description: "ไม่สามารถเข้าถึงกล้องได้",
                    color: "warning",
                    timeout: 3000,
                shouldShowTimeoutProgress: true,
                });
            }
            setIsTestingCamera(false);
        }
    };

    // Stop camera
    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsTestingCamera(false);
    };

    // Get status chip
    const getStatusChip = (status: PermissionStatus) => {
        switch (status) {
            case "granted":
                return (
                    <Chip color="success" variant="flat" startContent={<Icon icon="solar:check-circle-bold" />}>
                        อนุญาตแล้ว
                    </Chip>
                );
            case "denied":
                return (
                    <Chip color="danger" variant="flat" startContent={<Icon icon="solar:close-circle-bold" />}>
                        ถูกปฏิเสธ
                    </Chip>
                );
            case "prompt":
                return (
                    <Chip color="warning" variant="flat" startContent={<Icon icon="solar:question-circle-bold" />}>
                        รอการอนุญาต
                    </Chip>
                );
            case "unsupported":
                return (
                    <Chip color="default" variant="flat" startContent={<Icon icon="solar:forbidden-bold" />}>
                        ไม่รองรับ
                    </Chip>
                );
            case "checking":
                return (
                    <Chip color="default" variant="flat" startContent={<Icon icon="solar:refresh-bold" className="animate-spin" />}>
                        กำลังตรวจสอบ
                    </Chip>
                );
        }
    };

    // Check if all required permissions are granted
    const allGranted = permissions.location === "granted" && 
                       permissions.notification === "granted" && 
                       permissions.camera === "granted";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 py-8 px-4">
            <div className="max-w-lg mx-auto space-y-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
                        <Icon icon="solar:settings-bold" className="text-4xl text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าการอนุญาต</h1>
                    <p className="text-slate-500 mt-2">
                        กรุณาอนุญาตสิทธิ์เหล่านี้เพื่อการใช้งานที่สมบูรณ์(ไม่ใช่การเช็คชื่อจริง)
                    </p>
                </div>

                {/* Location Permission */}
                <Card className="shadow-md">
                    <CardHeader className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                <Icon icon="solar:map-point-bold-duotone" className="text-2xl text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">ตำแหน่งที่ตั้ง</h3>
                                <p className="text-sm text-slate-500">สำหรับการเช็คชื่อในห้องเรียน</p>
                            </div>
                        </div>
                        {getStatusChip(permissions.location)}
                    </CardHeader>
                    <Divider />
                    <CardBody className="px-6 py-4">
                        {locationDetails && (
                            <div className="mb-4 p-3 bg-emerald-50 rounded-lg text-sm">
                                <p className="text-emerald-700 font-medium mb-1">
                                    <Icon icon="solar:check-circle-bold" className="inline mr-1" />
                                    ระบุตำแหน่งสำเร็จ
                                </p>
                                <p className="text-emerald-600 text-xs">
                                    พิกัด: {locationDetails.lat.toFixed(6)}, {locationDetails.lng.toFixed(6)}
                                    <br />
                                    ความแม่นยำ: ±{locationDetails.accuracy.toFixed(0)} เมตร
                                </p>
                            </div>
                        )}
                        
                        {permissions.location === "denied" && (
                            <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                                <Icon icon="solar:info-circle-bold" className="inline mr-1" />
                                กรุณาเปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์
                            </div>
                        )}

                        <Button
                            color={permissions.location === "granted" ? "success" : "primary"}
                            variant={permissions.location === "granted" ? "flat" : "solid"}
                            className="w-full"
                            startContent={!isTestingLocation && <Icon icon="solar:gps-bold" />}
                            isLoading={isTestingLocation}
                            isDisabled={permissions.location === "unsupported"}
                            onPress={requestLocation}
                        >
                            {permissions.location === "granted" ? "ทดสอบอีกครั้ง" : "อนุญาตการเข้าถึงตำแหน่ง"}
                        </Button>
                    </CardBody>
                </Card>

                {/* Notification Permission */}
                <Card className="shadow-md">
                    <CardHeader className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Icon icon="solar:bell-bold-duotone" className="text-2xl text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">การแจ้งเตือน</h3>
                                <p className="text-sm text-slate-500">รับการแจ้งเตือนจากระบบ</p>
                            </div>
                        </div>
                        {getStatusChip(permissions.notification)}
                    </CardHeader>
                    <Divider />
                    <CardBody className="px-6 py-4">
                        {permissions.notification === "denied" && (
                            <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                                <Icon icon="solar:info-circle-bold" className="inline mr-1" />
                                กรุณาเปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์
                            </div>
                        )}

                        <Button
                            color={permissions.notification === "granted" ? "success" : "warning"}
                            variant={permissions.notification === "granted" ? "flat" : "solid"}
                            className="w-full"
                            startContent={<Icon icon="solar:bell-bold" />}
                            isDisabled={permissions.notification === "unsupported" || permissions.notification === "denied"}
                            onPress={requestNotification}
                        >
                            {permissions.notification === "granted" ? "ส่งการแจ้งเตือนทดสอบ" : "อนุญาตการแจ้งเตือน"}
                        </Button>
                    </CardBody>
                </Card>

                {/* Camera Permission */}
                <Card className="shadow-md">
                    <CardHeader className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                                <Icon icon="solar:camera-bold-duotone" className="text-2xl text-purple-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">กล้อง</h3>
                                <p className="text-sm text-slate-500">สำหรับสแกน QR Code</p>
                            </div>
                        </div>
                        {getStatusChip(permissions.camera)}
                    </CardHeader>
                    <Divider />
                    <CardBody className="px-6 py-4">
                        {cameraStream && (
                            <div className="mb-4 relative">
                                <video
                                    autoPlay
                                    playsInline
                                    muted
                                    ref={(video) => {
                                        if (video && cameraStream) {
                                            video.srcObject = cameraStream;
                                        }
                                    }}
                                    className="w-full rounded-lg bg-black"
                                />
                                <Button
                                    isIconOnly
                                    color="danger"
                                    variant="flat"
                                    className="absolute top-2 right-2"
                                    onPress={stopCamera}
                                >
                                    <Icon icon="solar:close-circle-bold" />
                                </Button>
                                <p className="text-xs text-center text-slate-500 mt-2">
                                    กล้องจะปิดอัตโนมัติใน 10 วินาที
                                </p>
                            </div>
                        )}

                        {permissions.camera === "denied" && (
                            <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                                <Icon icon="solar:info-circle-bold" className="inline mr-1" />
                                กรุณาเปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์
                            </div>
                        )}

                        <Button
                            color={permissions.camera === "granted" ? "success" : "secondary"}
                            variant={permissions.camera === "granted" ? "flat" : "solid"}
                            className="w-full"
                            startContent={!isTestingCamera && <Icon icon="solar:camera-bold" />}
                            isLoading={isTestingCamera && !cameraStream}
                            isDisabled={permissions.camera === "unsupported" || !!cameraStream}
                            onPress={requestCamera}
                        >
                            {permissions.camera === "granted" ? "ทดสอบกล้องอีกครั้ง" : "อนุญาตการเข้าถึงกล้อง"}
                        </Button>
                    </CardBody>
                </Card>

                {/* Summary */}
                <Card className={`shadow-md ${allGranted ? "bg-emerald-50 border-emerald-200" : "bg-slate-50"}`}>
                    <CardBody className="px-6 py-5">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                                allGranted ? "bg-emerald-100" : "bg-slate-200"
                            }`}>
                                <Icon 
                                    icon={allGranted ? "solar:shield-check-bold" : "solar:shield-warning-bold"} 
                                    className={`text-3xl ${allGranted ? "text-emerald-600" : "text-slate-400"}`}
                                />
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-semibold ${allGranted ? "text-emerald-800" : "text-slate-700"}`}>
                                    {allGranted ? "พร้อมใช้งานแล้ว!" : "ยังไม่ครบทุกสิทธิ์"}
                                </h3>
                                <p className={`text-sm ${allGranted ? "text-emerald-600" : "text-slate-500"}`}>
                                    {allGranted 
                                        ? "คุณสามารถใช้งานระบบได้อย่างสมบูรณ์" 
                                        : "กรุณาอนุญาตสิทธิ์ที่เหลือเพื่อประสบการณ์ที่ดีที่สุด"
                                    }
                                </p>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Navigation */}
                {/* <div className="flex gap-3">
                    <Button
                        as={Link}
                        href="/"
                        variant="flat"
                        className="flex-1"
                        startContent={<Icon icon="solar:home-2-bold" />}
                    >
                        กลับหน้าแรก
                    </Button>
                    <Button
                        as={Link}
                        href="/login"
                        color="primary"
                        className="flex-1"
                        endContent={<Icon icon="solar:arrow-right-bold" />}
                    >
                        เข้าสู่ระบบ
                    </Button>
                </div> */}

                {/* Help Text */}
                <div className="text-center text-sm text-slate-500 space-y-2">
                    <p>
                        <Icon icon="solar:info-circle-linear" className="inline mr-1" />
                        หากสิทธิ์ถูกปฏิเสธไปแล้ว ให้เปิดในการตั้งค่าเบราว์เซอร์
                    </p>
                    <p className="text-xs text-slate-400">
                        Chrome: คลิกไอคอน 🔒 ที่ address bar → Site settings
                    </p>
                </div>
            </div>
        </div>
    );
}

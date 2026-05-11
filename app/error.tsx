"use client";

import { useEffect } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Icon } from "@iconify/react";

export default function Error({
    error,
    reset,
}: {
    error: Error;
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Application Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-sky-50 to-indigo-100 p-4">
            <Card className="max-w-md w-full shadow-xl">
                <CardBody className="p-8 text-center">
                    {/* Error Icon */}
                    <div className="mb-6">
                        <div className="w-24 h-24 mx-auto bg-linear-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center">
                            <Icon 
                                icon="solar:danger-triangle-bold-duotone" 
                                className="text-6xl text-red-400"
                            />
                        </div>
                    </div>

                    {/* Error Text */}
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                        เกิดข้อผิดพลาด
                    </h1>
                    
                    <p className="text-slate-500 mb-8">
                        ขออภัย เกิดปัญหาบางอย่างในการโหลดหน้านี้ กรุณาลองใหม่อีกครั้ง
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            color="primary"
                            variant="shadow"
                            startContent={<Icon icon="solar:refresh-bold" />}
                            onPress={reset}
                        >
                            ลองใหม่อีกครั้ง
                        </Button>
                        
                        <Button
                            variant="bordered"
                            startContent={<Icon icon="solar:home-2-bold" />}
                            onPress={() => window.location.href = '/'}
                        >
                            กลับหน้าแรก
                        </Button>
                    </div>

                    {/* Help Text */}
                    <p className="text-xs text-slate-400 mt-8">
                        หากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}

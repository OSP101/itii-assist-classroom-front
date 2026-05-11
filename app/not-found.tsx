import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Icon } from "@iconify/react";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-sky-50 to-indigo-100 p-4">
            <Card className="max-w-md w-full shadow-xl">
                <CardBody className="p-8 text-center">
                    {/* 404 Icon */}
                    <div className="mb-6">
                        <div className="w-24 h-24 mx-auto bg-linear-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                            <Icon 
                                icon="solar:ghost-bold-duotone" 
                                className="text-6xl text-indigo-400"
                            />
                        </div>
                    </div>

                    {/* 404 Text */}
                    <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-indigo-600 mb-2">
                        404
                    </h1>
                    
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        ไม่พบหน้าที่คุณต้องการ
                    </h2>
                    
                    <p className="text-slate-500 mb-8">
                        หน้าที่คุณกำลังค้นหาอาจถูกลบ เปลี่ยนชื่อ หรือไม่มีอยู่ในระบบ
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            as="a"
                            href="/"
                            color="primary"
                            variant="shadow"
                            startContent={<Icon icon="solar:home-2-bold" />}
                        >
                            กลับหน้าแรก
                        </Button>
                        
                        <Button
                            as="a"
                            href="/login"
                            variant="bordered"
                            startContent={<Icon icon="solar:login-2-bold" />}
                        >
                            เข้าสู่ระบบ
                        </Button>
                    </div>

                    {/* Help Text */}
                    <p className="text-xs text-slate-400 mt-8">
                        หากคุณคิดว่านี่คือข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}

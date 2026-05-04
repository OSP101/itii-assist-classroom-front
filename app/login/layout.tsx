export const metadata = {
  title: "เข้าสู่ระบบ",
  description: "เข้าสู่ระบบ ITII Assist Classroom เพื่อจัดการห้องเรียนของคุณอย่างมีประสิทธิภาพและง่ายดาย",
  image: "/cp-image-login.jpg",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
return <>{children}</>;
}

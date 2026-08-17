import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COCO LABS",
    short_name: "COCO LABS",
    description: "ระบบจัดการห้องเรียน COCO LABS พร้อมการแจ้งเตือนและการใช้งานแบบติดตั้งได้",
    id: "/",
    start_url: "/student/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7fb",
    theme_color: "#2b7fff",
    lang: "th",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "256x256",
        type: "image/x-icon",
      },
    ],
  };
}

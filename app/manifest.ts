import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LabTAS",
    short_name: "LabTAS",
    description: "ระบบจัดการห้องเรียน LabTAS พร้อมการแจ้งเตือนและการใช้งานแบบติดตั้งได้",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7fb",
    theme_color: "#2b7fff",
    lang: "th",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/images/logo-itii.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COCO LABS",
    short_name: "COCO LABS",
    description: "ระบบจัดการห้องเรียน COCO LABS พร้อมการแจ้งเตือนและการใช้งานแบบติดตั้งได้",
    id: "/",
    // Not "/student/login": this app is shared by admins, instructors/TAs and
    // students. "/" already does the right thing for everyone — it reads the
    // stored session and redirects by role (see app/page.tsx +
    // getDefaultRouteForRole), or to /login when signed out. Hardcoding the
    // student login page meant every instructor/TA who installed this to
    // their home screen got dumped on a login page for a role that was not
    // theirs every time they reopened the icon, instead of landing back in
    // the worker/queue flow they had it installed for.
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

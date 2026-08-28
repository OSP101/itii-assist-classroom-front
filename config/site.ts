import { statusGatewayLink } from '@/config/status-provider';

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "COCO LABS",
  description: "แพลตฟอร์มจัดการห้องเรียนสำหรับงานสอน การเช็กชื่อ การส่งงาน การเข้าคิว การติดตามคะแนน และศูนย์ช่วยเหลือสาธารณะของ COCO LABS.",
  keywords: [
    "COCO LABS",
    "classroom management",
    "attendance",
    "assignments",
    "queue management",
    "scores",
    "support center",
    "documentation",
    "system status",
    "privacy policy",
  ],
  links: {
    github: "https://github.com/OSP101",
    support: "/support",
    docs: "/docs",
    status: statusGatewayLink.href,
  },
  organization: {
    name: "OSP101",
  },
};

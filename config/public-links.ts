import { statusCommunicationSummary, statusGatewayLink } from '@/config/status-provider';

export interface PublicLinkItem {
  label: string;
  href: string;
  description?: string;
  icon?: string;
}

export const publicFooterGroups: Array<{
  title: string;
  links: PublicLinkItem[];
}> = [
  {
    title: "ช่วยเหลือและคู่มือ",
    links: [
      {
        label: "ศูนย์ช่วยเหลือ",
        href: "/support",
        description: "ค้นหาคำตอบ, ขั้นตอนแก้ปัญหา, และช่องทางติดต่อทีมงาน",
        icon: "solar:question-circle-bold",
      },
      {
        label: "Documentation",
        href: "/docs",
        description: "คู่มือการใช้งานระบบสำหรับนักศึกษา, TA, และผู้สอน",
        icon: "solar:book-bookmark-bold",
      },
      {
        label: "ติดต่อสนับสนุน",
        href: "/support/contact",
        description: "ส่งคำขอช่วยเหลือหรืออธิบายปัญหาเชิงเทคนิค",
        icon: "solar:chat-round-dots-bold",
      },
      {
        label: "สถานะระบบ",
        href: statusGatewayLink.href,
        description: statusGatewayLink.description,
        icon: "solar:server-path-bold",
      },
    ],
  },
  {
    title: "นโยบายและความปลอดภัย",
    links: [
      {
        label: "ข้อกำหนดการใช้งาน",
        href: "/terms",
        description: "เงื่อนไขการใช้งาน, บทบาทผู้ใช้, และข้อห้ามสำคัญ",
        icon: "solar:document-text-bold",
      },
      {
        label: "นโยบายความเป็นส่วนตัว",
        href: "/privacy",
        description: "อธิบายข้อมูลที่เก็บ, เหตุผลในการใช้, และสิทธิของผู้ใช้",
        icon: "solar:shield-user-bold",
      },
      {
        label: "นโยบายคุกกี้",
        href: "/cookies",
        description: "คุกกี้และเทคโนโลยีที่ช่วยให้ระบบทำงานอย่างปลอดภัย",
        icon: "solar:cookie-bold",
      },
      {
        label: "แจ้งปัญหาความปลอดภัย",
        href: "/security",
        description: "ช่องทาง Responsible Disclosure และการตอบสนองเหตุการณ์",
        icon: "solar:shield-warning-bold",
      },
    ],
  },
];

export const publicPortalRoutes = publicFooterGroups.flatMap((group) =>
  group.links.map((link) => ({
    ...link,
    groupTitle: group.title,
  })),
);

export const loginPolicyLinks = {
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",
};

export const supportContact = {
  email: "support@itii.ac.th",
  line: "@itii-classroom",
  statusSummary: statusCommunicationSummary,
};
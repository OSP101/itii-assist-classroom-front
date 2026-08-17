const statusGatewayHref = '/status';

export type StatusLink = {
    href: string;
    type: 'internal' | 'external';
    label: string;
    description: string;
};

const configuredStatusPageUrl = process.env.NEXT_PUBLIC_STATUS_PAGE_URL?.trim();
const configuredProviderName = process.env.NEXT_PUBLIC_STATUS_PROVIDER_NAME?.trim();
const configuredSubscribeUrl = process.env.NEXT_PUBLIC_STATUS_SUBSCRIBE_URL?.trim();

export const statusProvider = configuredStatusPageUrl
    ? {
          name: configuredProviderName || 'Statuspage',
          href: configuredStatusPageUrl,
          subscribeHref: configuredSubscribeUrl || configuredStatusPageUrl,
      }
    : null;

export const statusGatewayLink: StatusLink = {
    href: statusGatewayHref,
    type: 'internal',
    label: 'System Status',
    description: statusProvider
        ? `สรุปภาพรวมบริการหลักของ COCO LABS และลิงก์ไปยัง ${statusProvider.name} สำหรับ live incident updates`
        : 'ติดตามความพร้อมใช้งานของ Web, API, Authentication, Upload, และการแจ้งเตือน',
};

export const statusLiveLink: StatusLink = statusProvider
    ? {
          href: statusProvider.href,
          type: 'external',
          label: `Live status via ${statusProvider.name}`,
          description: `ติดตาม incident live, maintenance windows, และประกาศล่าสุดผ่าน ${statusProvider.name}`,
      }
    : statusGatewayLink;

export const statusSubscriptionLink: StatusLink | null = statusProvider
    ? {
          href: statusProvider.subscribeHref,
          type: 'external',
          label: `Subscribe via ${statusProvider.name}`,
          description: `เปิด ${statusProvider.name} เพื่อ subscribe updates และ maintenance notices`,
      }
    : null;

export const statusCommunicationSummary = statusProvider
    ? `สถานะ live, incident updates, และ maintenance notices จะเผยแพร่ผ่าน ${statusProvider.name}`
    : 'ประกาศสถานะสาธารณะและ maintenance updates จะถูกรวมไว้ในหน้า Status';

export const statusGatewayDescription = statusProvider
    ? `ใช้หน้านี้เป็น branded overview ของบริการหลัก และกดต่อไปยัง ${statusProvider.name} เมื่อต้องการดู live incident communication`
    : 'ใช้หน้านี้เพื่อติดตามความพร้อมใช้งานของ Web App, API, Authentication, Uploads, และ Notifications รวมถึงประกาศ maintenance และ incident communication';

export const statusProviderReference = statusProvider
    ? {
          provider: statusProvider.name,
          title: `${statusProvider.name} live status`,
          href: statusProvider.href,
          category: 'status' as const,
          description: 'ช่องทางสถานะภายนอกสำหรับ incident live feed, maintenance notices, และการ subscribe updates',
      }
    : null;

export function getStatusLinkProps(link: StatusLink = statusLiveLink) {
    return link.type === 'external'
        ? {
              href: link.href,
              target: '_blank' as const,
              rel: 'noopener noreferrer' as const,
          }
        : {
              href: link.href,
          };
}
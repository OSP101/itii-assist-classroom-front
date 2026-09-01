/**
 * ผู้ให้บริการล็อกอินที่เปิดใช้งาน
 *
 * ตามประกาศของคณะ ระบบเข้าสู่ระบบด้วยบัญชีภายนอกเหลือเพียง KKU SSO (SSONext)
 * ช่องทาง Google / GitHub ถูกปิดเป็นค่าเริ่มต้น และเปิดกลับมาได้เฉพาะตอนพัฒนา
 * โดยตั้ง NEXT_PUBLIC_LEGACY_SOCIAL_LOGIN=true ตอน build
 *
 * หมายเหตุ: ค่า NEXT_PUBLIC_* ถูกฝังตอน build ปุ่ม KKU SSO จึงไม่ผูกกับ env ใด ๆ
 * เพื่อไม่ให้หายไปเงียบ ๆ เมื่อลืมส่ง build arg ถ้าเซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SSO
 * ฝั่ง backend จะตอบ 503 พร้อมข้อความบอกว่าขาด env ตัวไหน
 */
export const LEGACY_SOCIAL_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_LEGACY_SOCIAL_LOGIN === "true";

/**
 * ช่องทางล็อกอินหลักของแต่ละโดเมน
 *
 * ระบบเปิดสองประตู
 *   - โดเมนหลัก cocolabs.computing.kku.ac.th ผ่าน reverse proxy ของ มข.
 *   - โดเมนสำรอง cocolab.osp101.com ผ่าน Cloudflare Tunnel ใช้ตอนเครือข่าย
 *     หรือพร็อกซีของมหาวิทยาลัยมีปัญหา
 *
 * KKU SSO ใช้ได้เฉพาะโดเมนหลัก เพราะ Redirect Login URL ที่ลงทะเบียนไว้กับสำนัก
 * เทคโนโลยีดิจิทัลผูกกับโดเมนนั้นตัวต่อตัว ถ้าเริ่ม flow จากโดเมนสำรอง ปลายทาง
 * callback จะวิ่งกลับไปที่โดเมนหลักซึ่งตอนนั้นอาจล่มอยู่พอดี โดเมนสำรองจึงใช้
 * Google เป็นช่องทางหลักแทน
 *
 * ตัดสินตอน runtime จาก hostname ไม่ใช่ตอน build เพราะ build ชุดเดียวถูกเสิร์ฟ
 * ทั้งสองโดเมน
 */
export type LoginProviderMode = "kku" | "google";

/** โดเมนที่ถือว่าเป็นโดเมนหลักของมหาวิทยาลัย */
export const KKU_HOST_SUFFIX = "kku.ac.th";

function normalizeHost(hostname?: string | null): string {
  return (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
}

/**
 * เลือกช่องทางล็อกอินจาก hostname
 * บังคับค่าได้ด้วย NEXT_PUBLIC_LOGIN_PROVIDER_MODE = kku | google (ใช้ตอนพัฒนา)
 */
export function resolveLoginProviderMode(hostname?: string | null): LoginProviderMode {
  const forced = (process.env.NEXT_PUBLIC_LOGIN_PROVIDER_MODE ?? "").trim().toLowerCase();
  if (forced === "kku" || forced === "google") {
    return forced;
  }

  const host = normalizeHost(hostname);
  if (host === KKU_HOST_SUFFIX || host.endsWith(`.${KKU_HOST_SUFFIX}`)) {
    return "kku";
  }
  return "google";
}

/**
 * ชั่วคราว (เพิ่ม 1 ก.ย. 2569): เปิดปุ่ม Google เป็นทางเลือกรองบนโดเมนหลักด้วย
 *
 * เหตุผล: ระบบ KKU SSO ที่สำนักเทคโนโลยีดิจิทัลออกให้ตอนนี้ข้อมูลผู้ใช้ยังไม่ครบ
 * บางคนจึงล็อกอินผ่าน SSO ไม่ได้ ระหว่างรอสำนักอัปเดตข้อมูล จึงเปิด Google ไว้
 * เป็นทางสำรองบนโดเมนหลัก
 *
 * วิธีเอาออกเมื่อสำนักอัปเดตเสร็จ: ลบค่านี้ทิ้ง แล้วลบบล็อก
 * TEMP_GOOGLE_FALLBACK_ON_KKU_DOMAIN ในไฟล์เหล่านี้
 *   - app/login/page.tsx
 *   - app/student/login/page.tsx
 *   - components/profile/AuthenticationSection.tsx
 * ปิดชั่วคราวโดยไม่แก้โค้ดได้ด้วย NEXT_PUBLIC_TEMP_GOOGLE_FALLBACK=false
 */
export const TEMP_GOOGLE_FALLBACK_ON_KKU_DOMAIN =
  process.env.NEXT_PUBLIC_TEMP_GOOGLE_FALLBACK !== "false";

/**
 * คีย์ใน localStorage ที่บอกว่าเมื่อกลับมาจากหน้า logout ของ KKU SSO
 * ควรพาผู้ใช้ไปหน้าเข้าสู่ระบบฝั่งไหน (/login หรือ /student/login)
 */
export const POST_LOGOUT_LOGIN_PATH_KEY = "post_logout_login_path";

/** อ่านและล้างค่าปลายทางหลังออกจากระบบ */
export function consumePostLogoutLoginPath(): string {
  if (typeof window === "undefined") return "/login";
  try {
    const stored = localStorage.getItem(POST_LOGOUT_LOGIN_PATH_KEY);
    localStorage.removeItem(POST_LOGOUT_LOGIN_PATH_KEY);
    return stored === "/student/login" ? stored : "/login";
  } catch {
    return "/login";
  }
}

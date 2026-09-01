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

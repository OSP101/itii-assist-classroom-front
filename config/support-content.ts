import {
  statusLiveLink,
  statusProvider,
  statusProviderReference,
} from '@/config/status-provider';

export interface SupportCategory {
  key: string;
  label: string;
}

export interface HelpHighlight {
  label: string;
  value: string;
  description: string;
}

export interface HelpResource {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  type: "internal" | "external";
  badge?: string;
}

export interface SupportGuideSection {
  id: string;
  title: string;
  audience: string;
  summary: string;
  icon: string;
  bullets: string[];
}

export interface SupportFaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface SupportLane {
  title: string;
  responseTime: string;
  icon: string;
  description: string;
}

export interface ExternalReferenceLink {
  provider: string;
  title: string;
  href: string;
  category: "docs" | "policy" | "status" | "support";
  description: string;
}

export interface StatusService {
  name: string;
  status: "operational" | "degraded" | "maintenance";
  icon: string;
  summary: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
}

export interface StatusHistoryItem {
  date: string;
  title: string;
  state: string;
  summary: string;
}

export interface PolicySection {
  title: string;
  icon: string;
  items: string[];
}

export interface SecurityChannel {
  label: string;
  value: string;
  href: string;
  note: string;
  icon: string;
  type?: "internal" | "external";
}

export const supportHeroHighlights: HelpHighlight[] = [
  {
    label: "เป้าหมายเวลาตอบกลับครั้งแรก",
    value: "ภายใน 1 วันทำการ",
    description: "เคสทั่วไปจะได้รับการตอบกลับครั้งแรกทางอีเมลหรือช่องทางที่ผู้ใช้ระบุ",
  },
  {
    label: "ขอบเขตการช่วยเหลือ",
    value: "งาน, เช็คชื่อ, คิว, คะแนน",
    description: "ครอบคลุม workflow หลักของนักศึกษา, TA, และผู้สอนในห้องเรียน",
  },
  {
    label: "การส่งต่อเหตุ",
    value: "ซัพพอร์ต + ความปลอดภัย",
    description: "มีแยกเส้นทางสำหรับเหตุขัดข้องทั่วไปและประเด็นด้านความปลอดภัยของระบบ",
  },
];

export const helpResources: HelpResource[] = [
  {
    id: "docs",
    title: "คู่มือการใช้งาน",
    description: "คู่มือใช้งานแบบ step-by-step สำหรับทุกบทบาทในระบบ",
    icon: "solar:book-bookmark-bold",
    href: "/docs",
    type: "internal",
    badge: "คู่มือหลัก",
  },
  {
    id: "status",
    title: "สถานะระบบ",
    description: statusLiveLink.description,
    icon: "solar:server-path-bold",
    href: statusLiveLink.href,
    type: statusLiveLink.type,
    badge: statusProvider ? statusProvider.name : "สถานะล่าสุด",
  },
  {
    id: "contact",
    title: "ติดต่อทีมสนับสนุน",
    description: "ส่งคำขอช่วยเหลือโดยระบุหมวดปัญหาและบริบทของห้องเรียน",
    icon: "solar:chat-round-dots-bold",
    href: "/support/contact",
    type: "internal",
    badge: "เปิดเคส",
  },
  {
    id: "security",
    title: "แจ้งปัญหาความปลอดภัย",
    description: "แจ้งช่องโหว่หรือพฤติกรรมที่อาจกระทบความปลอดภัยอย่างรับผิดชอบ",
    icon: "solar:shield-warning-bold",
    href: "/security",
    type: "internal",
    badge: "Responsible disclosure",
  },
];

export const supportCategories: SupportCategory[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "onboarding", label: "เริ่มต้นใช้งาน" },
  { key: "assignments", label: "งาน" },
  { key: "attendance", label: "เช็คชื่อ" },
  { key: "queue", label: "คิว" },
  { key: "scores", label: "คะแนน" },
  { key: "account", label: "บัญชี" },
  { key: "permissions", label: "สิทธิ์เบราว์เซอร์" },
  { key: "security", label: "ความปลอดภัย" },
  { key: "privacy", label: "ข้อมูลส่วนบุคคล" },
];

export const supportGuideSections: SupportGuideSection[] = [
  {
    id: "student",
    title: "คู่มือนักศึกษาแบบ Step-by-step",
    audience: "นักศึกษา",
    summary: "เริ่มใช้งานครั้งแรก เช็คชื่อ เข้าคิว ดูคะแนน และแก้ปัญหาเบื้องต้นตามขั้นตอนที่ควรทำจริง",
    icon: "solar:user-id-bold",
    bullets: [
      "ตรวจรายวิชาและ section หลังเข้าสู่ระบบ",
      "เปิดสิทธิ์ browser ที่จำเป็นก่อนเช็คชื่อหรือสแกน QR",
      "รวบรวมหลักฐานก่อนแจ้งปัญหาคะแนนหรือเช็คชื่อ",
    ],
  },
  {
    id: "instructor",
    title: "คู่มือผู้สอนตั้งแต่เปิดรายวิชาถึงปิดเทอม",
    audience: "ผู้สอน",
    summary: "เตรียมรายวิชา ตั้งงาน เช็คชื่อ ให้คะแนน อนุมัติคำขอแก้คะแนน จัดคิว และปิดรายวิชาอย่างเป็นระบบ",
    icon: "solar:diploma-bold",
    bullets: [
      "สร้าง section เพิ่ม TA และนักศึกษาก่อนเปิดใช้งาน",
      "ตั้ง assignment, attendance, score และ queue ให้ตรงนโยบายรายวิชา",
      "ตรวจคะแนนและ activity log ก่อนปิดรายวิชา",
    ],
  },
  {
    id: "ta",
    title: "คู่มือผู้ช่วยสอนและงานประจำสัปดาห์",
    audience: "TA",
    summary: "ตรวจสิทธิ์ งานเช็คชื่อ ตรวจงาน ให้คะแนน คิว คำขอแก้คะแนน และรายงานผู้สอนรายสัปดาห์",
    icon: "solar:user-check-bold",
    bullets: [
      "เริ่มจากตรวจ Course Permission ของตนเอง",
      "ให้คะแนนตาม rubric และใช้คำขอแก้คะแนนเมื่อจำเป็น",
      "สรุป assignment, attendance, queue และ requests ให้ผู้สอน",
    ],
  },
  {
    id: "roles",
    title: "ตารางสิทธิ์และ Permission Matrix",
    audience: "ผู้สอนและผู้ดูแลระบบ",
    summary: "อ้างอิงว่าใครทำอะไรได้บ้าง พร้อมแนวทาง least privilege สำหรับกำหนดสิทธิ์ TA อย่างปลอดภัย",
    icon: "solar:key-minimalistic-square-3-bold",
    bullets: [
      "แยก role, course access และ course permission ออกจากกัน",
      "ให้ TA เฉพาะสิทธิ์ที่จำเป็นต่อหน้าที่จริง",
      "ทบทวนสิทธิ์ช่วงต้นเทอม กลางเทอม และก่อนปิดเกรด",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting และข้อมูลที่ควรส่งให้ Support",
    audience: "ทุกบทบาท",
    summary: "แก้ปัญหาเข้าระบบ สิทธิ์ เช็คชื่อ คิว คะแนน และเตรียมข้อมูลให้ทีมช่วยเหลือตรวจสอบได้เร็วขึ้น",
    icon: "solar:lifebuoy-bold",
    bullets: [
      "แยกอาการและตรวจขั้นพื้นฐานก่อนเปิดเคส",
      "แนบเวลาเกิดปัญหา ข้อความ error และภาพหน้าจอ",
      "ใช้ SLA ที่เหมาะกับความเร่งด่วนของเคส",
    ],
  },
  {
    id: "onboarding",
    title: "เริ่มใช้งานครั้งแรก",
    audience: "ทุกบทบาท",
    summary: "เริ่มจากการเข้าสู่ระบบ, ตรวจสอบสิทธิ์, และตั้งค่าความพร้อมของบัญชีผู้ใช้",
    icon: "solar:login-3-bold",
    bullets: [
      "เข้าสู่ระบบด้วยบัญชีที่สถาบันหรือผู้สอนอนุญาตให้ใช้งานในรายวิชา",
      "ตรวจสอบรายวิชาที่แสดงบนหน้าแรกว่าตรงกับภาคเรียนและกลุ่มเรียนของคุณ",
      "ตั้งรหัสผ่านใหม่เมื่อระบบร้องขอ และใช้นโยบายรหัสผ่านที่คาดเดาได้ยาก",
      "ถ้าต้องการเชื่อม OAuth เช่น Google หรือ GitHub ให้ทำผ่านส่วนโปรไฟล์หลังเข้าสู่ระบบ",
    ],
  },
  {
    id: "assignments",
    title: "การสร้างและส่งงาน",
    audience: "นักศึกษาและผู้สอน",
    summary: "จัดการงานส่ง, ไฟล์แนบ, กำหนดเวลา, และการตรวจสถานะหลังส่งอย่างเป็นระบบ",
    icon: "solar:clipboard-list-bold",
    bullets: [
      "ผู้สอนสามารถกำหนดชื่อ, คำอธิบาย, deadline, และเงื่อนไขการส่งงานได้จากแท็บงาน",
      "นักศึกษาควรตรวจสอบขนาดไฟล์และประเภทไฟล์ที่ระบบรองรับก่อนส่งทุกครั้ง",
      "หลังส่งงานให้กลับมาตรวจสอบ timestamp และสถานะล่าสุดบนหน้า assignment detail",
      "ถ้างานถูกส่งล่าช้า ระบบจะยังบันทึกการส่ง แต่สถานะสายอาจถูกนำไปใช้ในการให้คะแนน",
    ],
  },
  {
    id: "attendance",
    title: "เช็คชื่อและติดตามการเข้าเรียน",
    audience: "นักศึกษา",
    summary: "รองรับการเช็คชื่อด้วยตนเองหรือผ่าน QR และมีเส้นทางสำหรับขอแก้ไขรายการที่ผิดพลาด",
    icon: "solar:users-group-rounded-bold",
    bullets: [
      "เช็คชื่อภายในเวลาที่ผู้สอนเปิด session ไว้เท่านั้น",
      "ถ้าเช็คชื่อผิดคนหรือพลาด session ให้ส่งคำขอแก้ไขพร้อมเหตุผลประกอบ",
      "ดูแนวโน้มการเข้าเรียนประจำสัปดาห์จากหน้า overview ของรายวิชา",
      "เตรียมอุปกรณ์และเครือข่ายให้พร้อมก่อนสแกน QR เพื่อหลีกเลี่ยงการ timeout",
    ],
  },
  {
    id: "queue",
    title: "เข้าคิวตรวจงานหรือขอคำปรึกษา",
    audience: "นักศึกษาและ TA",
    summary: "คิวจะเรียงตามลำดับเวลาที่เข้าระบบ พร้อมข้อมูลสถานะที่อ่านง่ายทั้งฝั่งผู้เรียนและผู้สอน",
    icon: "solar:playlist-bold",
    bullets: [
      "เข้าคิวจากแท็บคิวของรายวิชาและเตรียมรายละเอียดงานก่อนถึงลำดับของตนเอง",
      "ถ้าจำเป็นต้องออกจากคิว ควรยกเลิกก่อนถูกเรียกเพื่อไม่รบกวนลำดับของผู้อื่น",
      "ผู้สอนและ TA ควรอัปเดตสถานะคิวทันทีเมื่อเริ่มหรือจบการตรวจงาน",
      "ใช้ข้อมูลสั้น กระชับ และอธิบาย blocker ให้ชัดเพื่อให้การช่วยเหลือเร็วขึ้น",
    ],
  },
  {
    id: "scores",
    title: "คะแนนและคำขอแก้ไขคะแนน",
    audience: "นักศึกษา",
    summary: "ติดตามคะแนนรายกิจกรรมและยื่นคำขอแก้ไขโดยมีหลักฐานอ้างอิงชัดเจน",
    icon: "solar:medal-ribbon-star-bold",
    bullets: [
      "ตรวจคะแนนจากแท็บคะแนนของรายวิชาและทบทวน rubric หรือหมายเหตุจากผู้สอน",
      "หากคะแนนคลาดเคลื่อน ให้ยื่นคำขอแก้ไขพร้อมระบุเหตุผลและหลักฐานแนบ",
      "คำขอที่ดีควรอ้างถึง assignment, กลุ่มเรียน, และจุดที่คิดว่าระบบหรือการตรวจมีความคลาดเคลื่อน",
      "ติดตามผลการอนุมัติหรือปฏิเสธคำขอจากหน้าประวัติหรือการแจ้งเตือนของระบบ",
    ],
  },
  {
    id: "account",
    title: "บัญชีผู้ใช้และสิทธิ์เข้าถึง",
    audience: "ทุกบทบาท",
    summary: "จัดการโปรไฟล์, รหัสผ่าน, การกู้คืนบัญชี, และตรวจสอบว่าสิทธิ์ในรายวิชาถูกต้อง",
    icon: "solar:user-id-bold",
    bullets: [
      "ใช้ฟังก์ชันลืมรหัสผ่านเมื่อเข้าถึงบัญชีไม่ได้ แทนการสร้างบัญชีใหม่ซ้ำซ้อน",
      "อัปเดตรูปโปรไฟล์และข้อมูลติดต่อเพื่อให้ผู้สอนหรือทีมงานระบุตัวตนได้ถูกต้อง",
      "ถ้ารายวิชาหรือบทบาทไม่ตรง ให้ติดต่อผู้สอนหรือทีม support พร้อมระบุ course code",
      "สำหรับเหตุผิดปกติด้านการเข้าสู่ระบบหรือ session ให้เปลี่ยนรหัสผ่านและรายงานทีมงานทันที",
    ],
  },
  {
    id: "permissions",
    title: "สิทธิ์เบราว์เซอร์และอุปกรณ์",
    audience: "นักศึกษาและผู้ใช้ทุกบทบาท",
    summary: "อธิบายเหตุผลของการขอตำแหน่งที่ตั้ง กล้อง และการแจ้งเตือน เพื่อให้ผู้ใช้อนุญาตสิทธิ์ได้อย่างมั่นใจ",
    icon: "solar:settings-bold",
    bullets: [
      "ระบบขอตำแหน่งที่ตั้งเฉพาะเมื่อจำเป็นต่อการเช็คชื่อแบบยืนยันพื้นที่ตามเงื่อนไขของรายวิชา",
      "ระบบใช้กล้องเมื่อผู้ใช้เลือกสแกน QR Code และไม่ควรเปิดกล้องค้างเกินกว่าการทำรายการนั้น",
      "การแจ้งเตือนใช้สำหรับเหตุสำคัญ เช่น สถานะคิว ผลการตรวจงาน หรือประกาศระบบที่เกี่ยวข้องกับผู้ใช้",
      "หากปฏิเสธสิทธิ์ไว้แล้ว สามารถเปิดใหม่ได้จากการตั้งค่าเว็บไซต์ของ browser หรือหน้า Permission Center",
    ],
  },
  {
    id: "security",
    title: "ความปลอดภัย บันทึกเหตุการณ์ และการใช้งานอย่างรับผิดชอบ",
    audience: "ทุกบทบาท",
    summary: "สรุปแนวทางป้องกันบัญชี การใช้ 2FA การรายงานช่องโหว่ และข้อปฏิบัติเมื่อต้องจัดการข้อมูลการเรียนการสอน",
    icon: "solar:shield-check-bold",
    bullets: [
      "เปิดใช้การยืนยันตัวตนสองชั้นเมื่อมีให้ใช้งาน และเก็บ backup codes ไว้ในที่ปลอดภัย",
      "ผู้สอนและผู้ดูแลระบบควรตรวจสอบ log หรือ activity ที่ผิดปกติ ก่อนแก้ไขข้อมูลสำคัญหรืออนุมัติคำขอคะแนน",
      "ห้ามใช้บัญชีร่วมกันหรือส่งต่อ token, QR, PIN, หรือ session link ให้บุคคลที่ไม่มีสิทธิ์",
      "หากพบช่องโหว่หรือข้อมูลรั่วไหล ให้แจ้งผ่านหน้า Security โดยไม่เผยแพร่รายละเอียดสู่สาธารณะก่อนการประเมินความเสี่ยง",
    ],
  },
];

export const supportFaqItems: SupportFaqItem[] = [
  {
    id: "onboarding-1",
    category: "onboarding",
    question: "เข้าสู่ระบบครั้งแรกต้องทำอะไรบ้าง",
    answer: "เข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์ ตรวจสอบรายวิชาของตน และตั้งรหัสผ่านใหม่หากระบบร้องขอ จากนั้นจึงเริ่มใช้งานเมนูในรายวิชาได้ตามบทบาท",
    tags: ["login", "password", "first time", "บัญชี"],
  },
  {
    id: "assignments-1",
    category: "assignments",
    question: "ส่งงานแล้วจะรู้ได้อย่างไรว่าระบบรับไฟล์ครบ",
    answer: "หลังส่งงานให้ตรวจสอบเวลาส่ง, ชื่อไฟล์, และสถานะบนหน้ารายละเอียดงาน หากรายการแนบไม่ครบควรส่งใหม่ก่อนถึงกำหนด",
    tags: ["งาน", "ไฟล์", "deadline", "submit"],
  },
  {
    id: "assignments-2",
    category: "assignments",
    question: "ไฟล์ที่รองรับและขนาดไฟล์มีข้อจำกัดอย่างไร",
    answer: "โดยทั่วไประบบรองรับเอกสาร, สไลด์, รูปภาพ, และไฟล์บีบอัดตามที่ผู้สอนกำหนด หากไฟล์ใหญ่ผิดปกติควรบีบอัดหรือแยกไฟล์ก่อนอัปโหลด",
    tags: ["upload", "pdf", "zip", "เอกสาร"],
  },
  {
    id: "attendance-1",
    category: "attendance",
    question: "เช็คชื่อไม่ทันในช่วงเวลาที่เปิด session ต้องทำอย่างไร",
    answer: "ให้ติดต่อผู้สอนหรือส่งคำขอแก้ไขการเช็คชื่อพร้อมเหตุผลและเวลาที่เกิดเหตุ เพื่อให้ผู้สอนพิจารณาเป็นรายกรณี",
    tags: ["attendance", "late", "session"],
  },
  {
    id: "attendance-2",
    category: "attendance",
    question: "สถานะการเช็คชื่อแต่ละแบบหมายถึงอะไร",
    answer: "ระบบใช้สถานะเช่น มา, ขาด, สาย, ลา, ป่วย และสถานะอื่นตามที่ผู้สอนกำหนด เพื่อใช้ติดตามการเข้าเรียนในรายวิชา",
    tags: ["status", "มา", "ลา", "ป่วย"],
  },
  {
    id: "queue-1",
    category: "queue",
    question: "ออกจากคิวแล้วสามารถกลับเข้ามาใหม่ได้หรือไม่",
    answer: "ได้ แต่ลำดับใหม่จะอ้างอิงเวลาที่คุณเข้าคิวครั้งล่าสุด ควรตัดสินใจก่อนถูกเรียกชื่อเพื่อไม่ให้กระทบลำดับของผู้อื่น",
    tags: ["queue", "ลำดับ", "cancel"],
  },
  {
    id: "queue-2",
    category: "queue",
    question: "ผู้สอนเห็นข้อมูลอะไรในคิวบ้าง",
    answer: "ผู้สอนหรือ TA จะเห็นลำดับ, ชื่อ, และบริบทที่ผู้ใช้กรอกเพื่อเตรียมตรวจงานหรือให้คำแนะนำได้รวดเร็วขึ้น",
    tags: ["TA", "teacher", "queue info"],
  },
  {
    id: "scores-1",
    category: "scores",
    question: "ขอแก้ไขคะแนนต้องใส่อะไรบ้างจึงจะพิจารณาได้เร็ว",
    answer: "ควรระบุรายวิชา, งานที่เกี่ยวข้อง, คะแนนที่เห็น, เหตุผลที่คิดว่าคลาดเคลื่อน และแนบหลักฐานเช่นภาพหน้าจอหรือไฟล์อ้างอิง",
    tags: ["score", "appeal", "evidence"],
  },
  {
    id: "scores-2",
    category: "scores",
    question: "คะแนนสุดท้ายดูจากจุดใด",
    answer: "ให้ตรวจจากแท็บคะแนนของรายวิชาเป็นหลัก เพราะเป็นหน้าที่รวบรวมคะแนนล่าสุดและผลการพิจารณาคำขอแก้ไขแล้ว",
    tags: ["final score", "grade", "คะแนนรวม"],
  },
  {
    id: "account-1",
    category: "account",
    question: "ลืมรหัสผ่านควรทำอย่างไร",
    answer: "ใช้ฟังก์ชันลืมรหัสผ่านที่หน้าเข้าสู่ระบบและตรวจสอบอีเมลที่ผูกไว้กับบัญชีของคุณ หากไม่ได้รับอีเมลภายในเวลาที่เหมาะสมให้ติดต่อ support",
    tags: ["forgot password", "reset", "email"],
  },
  {
    id: "account-2",
    category: "account",
    question: "รายวิชาไม่ขึ้นในหน้าหลักแต่ลงทะเบียนแล้ว",
    answer: "ตรวจสอบบัญชีที่ใช้เข้าสู่ระบบก่อน หากยังไม่พบให้ส่ง course code, กลุ่มเรียน, และอีเมลของคุณมาที่ทีม support หรือผู้สอนประจำวิชา",
    tags: ["course access", "สิทธิ์", "enrollment"],
  },
  {
    id: "account-3",
    category: "account",
    question: "สามารถเปลี่ยนรูปโปรไฟล์หรือข้อมูลส่วนตัวได้หรือไม่",
    answer: "ได้ ผ่านหน้าโปรไฟล์และการตั้งค่า โดยควรใช้อีเมลและข้อมูลติดต่อที่เป็นปัจจุบันเพื่อให้ทีมงานตอบกลับได้ถูกต้อง",
    tags: ["profile", "avatar", "settings"],
  },
  {
    id: "permissions-1",
    category: "permissions",
    question: "ทำไมระบบต้องขอตำแหน่งที่ตั้ง กล้อง หรือการแจ้งเตือน",
    answer: "ตำแหน่งที่ตั้งใช้เฉพาะกรณีเช็คชื่อที่ผู้สอนกำหนดให้ยืนยันพื้นที่ กล้องใช้เพื่อสแกน QR Code และการแจ้งเตือนใช้แจ้งเหตุสำคัญของคิว คะแนน หรือระบบ ทั้งหมดควรใช้เท่าที่จำเป็นต่อการให้บริการเท่านั้น",
    tags: ["location", "camera", "notification", "permission"],
  },
  {
    id: "security-0",
    category: "security",
    question: "ควรเปิด 2FA เมื่อใด",
    answer: "แนะนำให้เปิด 2FA สำหรับบัญชีผู้สอน TA และผู้ดูแลระบบทุกบัญชี รวมถึงบัญชีนักศึกษาที่มีข้อมูลสำคัญหรือใช้หลายอุปกรณ์ เพราะช่วยลดความเสี่ยงจากรหัสผ่านรั่วไหล",
    tags: ["2fa", "totp", "backup code"],
  },
  {
    id: "security-1",
    category: "security",
    question: "พบพฤติกรรมผิดปกติของบัญชีหรือ session ต้องทำอะไรทันที",
    answer: "ให้เปลี่ยนรหัสผ่าน ออกจากระบบจากอุปกรณ์ที่ไม่รู้จัก และรายงานทีมงานผ่านหน้า Security พร้อมข้อมูลเวลาและอาการที่พบ",
    tags: ["security", "session", "account takeover"],
  },
  {
    id: "security-2",
    category: "security",
    question: "ถ้าพบช่องโหว่ควรแจ้งผ่านทางไหน",
    answer: "ให้ใช้หน้าแจ้งปัญหาความปลอดภัยหรืออีเมลทีม support โดยขึ้นต้นหัวข้อว่า [SECURITY] และหลีกเลี่ยงการเปิดเผยข้อมูลสู่สาธารณะก่อนระบบได้รับการแก้ไข",
    tags: ["vulnerability", "report", "responsible disclosure"],
  },
  {
    id: "support-1",
    category: "onboarding",
    question: "ควรเตรียมข้อมูลอะไรเมื่อส่งคำขอ support",
    answer: "อย่างน้อยควรมีชื่อรายวิชา, เวลาที่เกิดเหตุ, browser หรืออุปกรณ์ที่ใช้, ขั้นตอนที่ทำก่อนเกิดปัญหา และภาพหน้าจอถ้ามี",
    tags: ["support", "checklist", "bug report"],
  },
];

export const supportResponseLanes: SupportLane[] = [
  {
    title: "General Support",
    responseTime: "24-48 ชั่วโมง",
    icon: "solar:help-bold",
    description: "เหมาะกับปัญหาทั่วไป เช่น การเข้าใช้งาน, รายวิชาไม่ขึ้น, และคำถามเชิง workflow",
  },
  {
    title: "Learning Workflow",
    responseTime: "ภายในวันทำการถัดไป",
    icon: "solar:clipboard-check-bold",
    description: "ปัญหาเกี่ยวกับงาน, เช็คชื่อ, คิว, คะแนน และการประสานงานกับผู้สอน",
  },
  {
    title: "Security & Abuse",
    responseTime: "รับเรื่องเร่งด่วน",
    icon: "solar:shield-warning-bold",
    description: "สำหรับการยึดบัญชี, การรั่วไหลของข้อมูล, หรือการใช้งานที่ผิดปกติซึ่งต้อง triage ทันที",
  },
];

export const supportChecklist = [
  "ระบุรายวิชา, section, หรือ course code ให้ชัดเจน",
  "บอกเวลาที่เกิดปัญหาและสิ่งที่คาดว่าจะเกิดขึ้นเทียบกับสิ่งที่เกิดจริง",
  "แนบภาพหน้าจอหรือลำดับขั้นตอนที่ทำก่อนเกิดปัญหา",
  "ถ้าเกี่ยวกับสิทธิ์เข้าใช้ ให้ระบุบทบาทของคุณ เช่น นักศึกษา, TA, หรือผู้สอน",
];

export const supportRequestCategories = [
  { value: "technical", label: "ปัญหาทางเทคนิค" },
  { value: "account", label: "บัญชีผู้ใช้และสิทธิ์" },
  { value: "learning", label: "งาน, เช็คชื่อ, คิว, คะแนน" },
  { value: "feature", label: "ขอฟีเจอร์หรือปรับปรุง UX" },
  { value: "security", label: "ความปลอดภัยหรือ abuse" },
  { value: "other", label: "อื่นๆ" },
];

export const supportPriorityOptions = [
  { value: "normal", label: "ปกติ" },
  { value: "high", label: "สูง" },
  { value: "urgent", label: "เร่งด่วน" },
];

export const platformReferenceLinks: ExternalReferenceLink[] = [
  ...(statusProviderReference ? [statusProviderReference] : []),
  {
    provider: "GitHub",
    title: "GitHub Docs",
    href: "https://docs.github.com/en",
    category: "docs",
    description: "คู่มือผลิตภัณฑ์และ developer reference สำหรับ workflow ที่เชื่อมกับ GitHub",
  },
  {
    provider: "GitHub",
    title: "GitHub Status",
    href: "https://www.githubstatus.com/",
    category: "status",
    description: "สถานะบริการ GitHub และเหตุการณ์ที่เกี่ยวข้องกับ source control และ integrations",
  },
  {
    provider: "GitHub",
    title: "GitHub Terms of Service",
    href: "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    category: "policy",
    description: "ตัวอย่างภาษาสำหรับสิทธิ์ผู้ใช้, ข้อห้าม, และขอบเขตความรับผิดชอบ",
  },
  {
    provider: "GitHub",
    title: "GitHub Privacy Statement",
    href: "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
    category: "policy",
    description: "ตัวอย่างการอธิบายข้อมูลบัญชีและการประมวลผลข้อมูลเชิงแพลตฟอร์ม",
  },
  {
    provider: "PDPC Thailand",
    title: "Government Platform for PDPA Compliance",
    href: "https://gppc.pdpc.or.th/",
    category: "policy",
    description: "แหล่งอ้างอิงภาครัฐเกี่ยวกับการปฏิบัติตามกฎหมายคุ้มครองข้อมูลส่วนบุคคลของไทย",
  },
  {
    provider: "ETDA Thailand",
    title: "กฎหมายการกระทำความผิดเกี่ยวกับคอมพิวเตอร์",
    href: "https://www.etda.or.th/th/Useful-Resource/law/computer-crimes.aspx",
    category: "policy",
    description: "แหล่งรวบรวมข้อมูลกฎหมายและประกาศที่เกี่ยวข้องกับการใช้ระบบคอมพิวเตอร์อย่างถูกต้อง",
  },
  {
    provider: "Next.js",
    title: "Next.js Docs",
    href: "https://nextjs.org/docs",
    category: "docs",
    description: "คู่มือเฟรมเวิร์กที่ใช้ขับเคลื่อน frontend ของระบบนี้",
  },
  {
    provider: "Next.js",
    title: "Next.js Learn",
    href: "https://nextjs.org/learn",
    category: "docs",
    description: "เนื้อหาเรียนรู้สำหรับทีมพัฒนาหรือผู้ดูแลระบบที่ต้องการขยายฟีเจอร์",
  },
  {
    provider: "Next.js",
    title: "Next.js Support Policy",
    href: "https://nextjs.org/support-policy",
    category: "policy",
    description: "แนวทางดูแลเวอร์ชันและ support window ของเฟรมเวิร์ก",
  },
  {
    provider: "Vercel",
    title: "Vercel Docs",
    href: "https://vercel.com/docs",
    category: "docs",
    description: "เอกสารอ้างอิงด้าน deployment, observability, และ environment configuration",
  },
  {
    provider: "Vercel",
    title: "Vercel Privacy Policy",
    href: "https://vercel.com/legal/privacy-policy",
    category: "policy",
    description: "ตัวอย่างการอธิบายบทบาทของผู้ให้บริการ hosting และ platform partner",
  },
];

export const publicStatusServices: StatusService[] = [
  {
    name: "Web App",
    status: "operational",
    icon: "solar:monitor-bold",
    summary: "หน้าเข้าสู่ระบบ, หน้า support, dashboard, และ workflow หลักพร้อมใช้งาน",
    detail: "รองรับการใช้งานบน desktop และ mobile โดยเน้นเสถียรภาพของหน้าเรียนการสอน",
    metricLabel: "Availability",
    metricValue: "99.96%",
  },
  {
    name: "API & Realtime",
    status: "operational",
    icon: "solar:database-bold",
    summary: "บริการ API, queue updates, และ event-driven classroom data อยู่ในสถานะปกติ",
    detail: "ติดตาม latency, error rate, และ throughput จากระบบ monitoring ภายในสำหรับทีมดูแล",
    metricLabel: "p95 latency",
    metricValue: "420 ms",
  },
  {
    name: "Authentication",
    status: "operational",
    icon: "solar:lock-password-bold",
    summary: "รองรับการเข้าสู่ระบบด้วยบัญชีหลักและการเชื่อม OAuth ที่ระบบอนุญาต",
    detail: "มีการเฝ้าระวัง login anomalies, password resets, และ security events อย่างต่อเนื่อง",
    metricLabel: "Login success",
    metricValue: "99.3%",
  },
  {
    name: "File Uploads",
    status: "operational",
    icon: "solar:upload-bold",
    summary: "การแนบไฟล์งานและหลักฐานประกอบยังทำได้ตามปกติในช่วงเวลานี้",
    detail: "ระบบตรวจสอบการอัปโหลดที่ล้มเหลวเพื่อป้องกันผลกระทบต่อ deadline และคะแนน",
    metricLabel: "Transfer success",
    metricValue: "99.1%",
  },
  {
    name: "Notifications",
    status: "operational",
    icon: "solar:bell-bold",
    summary: "การแจ้งเตือนในระบบและ workflow update ยังคงถูกส่งตามปกติ",
    detail: "เหตุการณ์สำคัญ เช่น queue movement หรือ score update ถูกเฝ้าระวังเป็นพิเศษ",
    metricLabel: "Delivery rate",
    metricValue: "98.8%",
  },
];

export const publicStatusHistory: StatusHistoryItem[] = [
  {
    date: "10 พ.ค. 2026",
    title: "ประกาศหน้าสถานะสาธารณะเวอร์ชันใหม่",
    state: "Completed",
    summary: "เพิ่ม public communication layer สำหรับ incident, maintenance, และ reference links",
  },
  {
    date: "08 พ.ค. 2026",
    title: "Planned maintenance: background job workers",
    state: "Resolved",
    summary: "มีการปรับปรุงส่วนประมวลผลงานเบื้องหลังโดยไม่กระทบ workflow หลักของผู้ใช้งานทั่วไป",
  },
  {
    date: "26 เม.ย. 2026",
    title: "ช่วง latency สูงสำหรับ queue updates",
    state: "Resolved",
    summary: "ตรวจพบการตอบสนองช้าชั่วคราวในบางรายวิชาและได้ปรับสมดุลโหลดเรียบร้อยแล้ว",
  },
];

export const statusCommitments = [
  "เหตุขัดข้องที่กระทบผู้ใช้จำนวนมากจะถูกประกาศในหน้าสถานะนี้ก่อนช่องทางอื่นเมื่อทำได้",
  "เหตุด้านความปลอดภัยหรือ abuse จะถูก triage แยกจากเคสทั่วไปและประสานกับทีมที่เกี่ยวข้องทันที",
  "ทีมดูแลระบบมี dashboard ภายในที่ละเอียดกว่าหน้านี้สำหรับ metrics, logs, และ root cause analysis",
];

export const privacySections: PolicySection[] = [
  {
    title: "ขอบเขตและผู้เกี่ยวข้องกับข้อมูล",
    icon: "solar:database-bold",
    items: [
      "นโยบายนี้ใช้กับข้อมูลส่วนบุคคลที่เกี่ยวข้องกับการใช้งาน LabTAS สำหรับการเรียนการสอน การสนับสนุนผู้ใช้ และการรักษาความปลอดภัยของระบบ",
      "ข้อมูลอาจเกี่ยวข้องกับนักศึกษา ผู้ช่วยสอน ผู้สอน ผู้ดูแลระบบ และบุคคลที่ติดต่อผ่านช่องทาง support หรือ feedback",
      "การจัดการข้อมูลจริงควรเป็นไปตามข้อกำหนดของหน่วยงานเจ้าของระบบ สถาบันการศึกษา และกฎหมายคุ้มครองข้อมูลส่วนบุคคลที่เกี่ยวข้อง",
    ],
  },
  {
    title: "ประเภทข้อมูลที่ประมวลผล",
    icon: "solar:folder-with-files-bold",
    items: [
      "ข้อมูลบัญชี เช่น ชื่อ อีเมล รหัสนักศึกษา บทบาท รูปโปรไฟล์ บัญชี OAuth สถานะ 2FA และข้อมูล session ที่จำเป็นต่อการยืนยันตัวตน",
      "ข้อมูลการเรียนการสอน เช่น รายวิชา section กลุ่ม งาน คะแนน คำขอแก้ไขคะแนน การเช็คชื่อ คิวตรวจงาน และบันทึกกิจกรรมในรายวิชา",
      "ข้อมูลจากอุปกรณ์และระบบ เช่น IP โดยสังเขป user agent เวลาเข้าใช้งาน log เหตุการณ์ความปลอดภัย token การแจ้งเตือน และข้อมูลตำแหน่งเมื่อผู้ใช้เลือกเช็คชื่อแบบยืนยันพื้นที่",
      "ข้อมูลที่ผู้ใช้ส่งให้ทีมงาน เช่น รายละเอียดปัญหา เอกสารหรือรูปภาพประกอบ feedback และประวัติการติดต่อ support",
    ],
  },
  {
    title: "วัตถุประสงค์และฐานการใช้ข้อมูล",
    icon: "solar:target-bold",
    items: [
      "ใช้ข้อมูลเพื่อให้บริการตามบทบาทในรายวิชา เช่น จัดการสมาชิก ตรวจงาน ให้คะแนน เช็คชื่อ จองคิว และแสดงผลคะแนนหรือสถานะที่เกี่ยวข้อง",
      "ใช้ข้อมูลเพื่อยืนยันตัวตน ควบคุมสิทธิ์ ป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต ตรวจสอบเหตุผิดปกติ และบันทึกหลักฐานด้านความปลอดภัยของระบบ",
      "ใช้ข้อมูลเพื่อสนับสนุนผู้ใช้ แก้ไขปัญหา วิเคราะห์เหตุขัดข้อง ปรับปรุงคุณภาพบริการ และสื่อสารประกาศสำคัญที่เกี่ยวข้องกับการใช้งาน",
      "เมื่อมีการประมวลผลที่ต้องอาศัยความยินยอม เช่น การเข้าถึงตำแหน่งที่ตั้งหรือการแจ้งเตือน ระบบควรขออนุญาตอย่างชัดเจนก่อนใช้งาน",
    ],
  },
  {
    title: "การเปิดเผยและการเข้าถึงข้อมูล",
    icon: "solar:users-group-rounded-bold",
    items: [
      "ข้อมูลในรายวิชาอาจมองเห็นได้โดยผู้สอน TA ผู้ดูแลระบบ หรือผู้ที่ได้รับสิทธิ์ตามหน้าที่เท่าที่จำเป็นต่อการจัดการเรียนการสอนและการสนับสนุน",
      "ระบบอาจใช้ผู้ให้บริการโครงสร้างพื้นฐาน อีเมล การแจ้งเตือน แผนที่ หรือเครื่องมือความปลอดภัยเท่าที่จำเป็นต่อการให้บริการและการป้องกัน abuse",
      "ระบบไม่ควรขายข้อมูลส่วนบุคคล และไม่ควรเปิดเผยข้อมูลเกินกว่าขอบเขตบริการ หน้าที่ทางการศึกษา ความปลอดภัย หรือข้อกำหนดตามกฎหมาย",
    ],
  },
  {
    title: "การเก็บรักษา สิทธิของผู้ใช้ และคำขอเกี่ยวกับข้อมูล",
    icon: "solar:archive-bold",
    items: [
      "ระยะเวลาเก็บรักษาข้อมูลควรกำหนดตามภารกิจด้านการเรียนการสอน การตรวจสอบคะแนน การรักษาความปลอดภัย และข้อกำหนดของหน่วยงานเจ้าของระบบ",
      "ผู้ใช้สามารถสอบถาม ขอแก้ไขข้อมูลที่ไม่ถูกต้อง หรือขอใช้สิทธิที่เกี่ยวข้องกับข้อมูลส่วนบุคคลผ่านช่องทาง support ตามกระบวนการของหน่วยงาน",
      "คำขอลบหรือจำกัดการใช้ข้อมูลจะพิจารณาร่วมกับหน้าที่ทางการศึกษา ความต่อเนื่องของรายวิชา การเก็บหลักฐาน log และข้อกำหนดทางกฎหมายที่เกี่ยวข้อง",
    ],
  },
  {
    title: "ความมั่นคงปลอดภัยของข้อมูล",
    icon: "solar:shield-check-bold",
    items: [
      "เราใช้การควบคุมการเข้าถึงตามบทบาท การยืนยันตัวตน การบันทึกเหตุการณ์ และ monitoring เพื่อช่วยลดความเสี่ยงต่อข้อมูลและบัญชีผู้ใช้",
      "แม้ไม่มีระบบใดปลอดภัยสมบูรณ์ ทีมงานควรทบทวนมาตรการด้านความปลอดภัยอย่างต่อเนื่องตามความเสี่ยง เทคโนโลยี และข้อกำหนดของหน่วยงาน",
      "หากคุณสงสัยว่ามีเหตุด้านความปลอดภัย โปรดแจ้งผ่านหน้า Security โดยเร็วที่สุด",
    ],
  },
];

export const termsSections: PolicySection[] = [
  {
    title: "การยอมรับข้อตกลง",
    icon: "solar:document-text-bold",
    items: [
      "การเข้าสู่ระบบหรือใช้งาน LabTAS หมายถึงผู้ใช้รับทราบและยอมรับข้อกำหนดฉบับนี้ รวมถึงนโยบายความเป็นส่วนตัว นโยบายคุกกี้ และแนวทางความปลอดภัยที่เกี่ยวข้อง",
      "หากผู้ใช้ดำเนินการในนามรายวิชา หน่วยงาน หรือสถาบัน ผู้ใช้ต้องมีสิทธิ์และได้รับมอบหมายให้ดำเนินการตามบทบาทนั้นอย่างถูกต้อง",
      "กรณีข้อกำหนดของรายวิชา สถาบัน หรือกฎหมายที่ใช้บังคับกำหนดเงื่อนไขเข้มงวดกว่า ให้ปฏิบัติตามเงื่อนไขดังกล่าวควบคู่กัน",
    ],
  },
  {
    title: "บัญชีและความรับผิดชอบของผู้ใช้",
    icon: "solar:user-id-bold",
    items: [
      "ผู้ใช้ต้องรักษาความลับของข้อมูลเข้าสู่ระบบ ตั้งรหัสผ่านที่เหมาะสม เปิดใช้ 2FA เมื่อมีให้ใช้งาน และรับผิดชอบต่อกิจกรรมที่เกิดขึ้นภายใต้บัญชีของตน",
      "ห้ามแชร์บัญชีให้ผู้อื่นใช้งานแทน ปลอมตัวเป็นผู้อื่น ใช้บัญชีผิดบทบาท หรือพยายามหลีกเลี่ยงข้อจำกัดสิทธิ์ของระบบ",
      "เมื่อพบการเข้าถึงผิดปกติ ผู้ใช้ต้องเปลี่ยนรหัสผ่าน ยกเลิก session ที่ไม่รู้จัก และแจ้งทีมงานโดยเร็วที่สุด",
      "ข้อมูลที่ส่งผ่าน support, feedback, รายวิชา หรือคำขอแก้ไขคะแนนต้องถูกต้อง สุจริต และไม่ทำให้ผู้อื่นเสียหาย",
    ],
  },
  {
    title: "การใช้งานที่อนุญาตและข้อห้าม",
    icon: "solar:forbidden-circle-bold",
    items: [
      "ใช้ระบบเพื่อวัตถุประสงค์ด้านการเรียนการสอน การประสานงานรายวิชา การให้คะแนน การเช็คชื่อ การจองคิว และการสนับสนุนที่เกี่ยวข้องเท่านั้น",
      "ห้ามพยายามเข้าถึง แก้ไข ดาวน์โหลด หรือเปิดเผยข้อมูลของรายวิชา ผู้ใช้ หรือระบบที่ตนไม่มีสิทธิ์",
      "ห้ามรบกวนการทำงานของระบบ เช่น ส่งคำขอจำนวนมากโดยเจตนา ใช้ automation ที่ไม่ได้รับอนุญาต ทดสอบช่องโหว่เกินขอบเขต หรือโจมตีระบบ",
      "ห้ามอัปโหลดหรือส่งข้อมูลที่ผิดกฎหมาย ละเมิดทรัพย์สินทางปัญญา ละเมิดความเป็นส่วนตัว ข่มขู่ คุกคาม หรือก่อให้เกิดความเสียหายต่อผู้อื่น",
    ],
  },
  {
    title: "เนื้อหาในรายวิชาและข้อมูลผู้ใช้",
    icon: "solar:notebook-bookmark-bold",
    items: [
      "ผู้ใช้ยังคงเป็นเจ้าของผลงานหรือเนื้อหาที่ตนส่งเข้าระบบภายใต้ข้อตกลงของรายวิชาและสถาบัน",
      "ผู้สอน TA และผู้ดูแลระบบอาจเข้าถึงข้อมูลที่จำเป็นต่อการจัดการเรียนการสอน การให้คะแนน การตรวจสอบคำขอแก้ไข และการตรวจสอบเหตุผิดปกติ",
      "ระบบอาจแสดงข้อมูลบางส่วนตามบทบาท เช่น คะแนน คิว การเช็คชื่อ สถานะงาน หรือ activity log เพื่อให้ workflow ทำงานได้ครบถ้วน",
      "ผู้ใช้ต้องไม่เผยแพร่ข้อมูลคะแนน รายชื่อ บันทึกการเข้าเรียน หรือข้อมูลส่วนบุคคลของผู้อื่นนอกระบบ เว้นแต่มีสิทธิ์หรือได้รับอนุญาตอย่างชัดเจน",
    ],
  },
  {
    title: "ความพร้อมใช้งานและการเปลี่ยนแปลงบริการ",
    icon: "solar:server-square-update-bold",
    items: [
      "ทีมงานพยายามรักษาความพร้อมใช้งานของระบบ แต่ไม่รับประกันว่าบริการจะปราศจากเหตุขัดข้อง ความล่าช้า หรือการบำรุงรักษาตลอดเวลา",
      "อาจมีการเปลี่ยนแปลงฟีเจอร์ กระบวนการ หน้าจอ หรือนโยบายตามความเหมาะสม โดยจะสื่อสารผ่านหน้า support หรือ status เมื่อมีสาระสำคัญต่อผู้ใช้",
      "ทีมงานอาจจำกัด ระงับ หรือยกเลิกการเข้าถึงบัญชีหรือข้อมูลบางส่วน เมื่อจำเป็นเพื่อป้องกันความเสียหาย การละเมิดข้อกำหนด หรือความเสี่ยงด้านความปลอดภัย",
      "ข้อกำหนดฉบับนี้เป็นร่างมาตรฐานสำหรับระบบโครงงานและควรได้รับการตรวจทานโดยผู้รับผิดชอบของสถาบันก่อนใช้เป็นเอกสารทางการภายนอก",
    ],
  },
];

export const cookieSections: PolicySection[] = [
  {
    title: "คุกกี้ที่จำเป็นต่อการทำงาน",
    icon: "solar:cookie-bold",
    items: [
      "ระบบใช้คุกกี้หรือ browser storage ที่จำเป็นต่อการยืนยันตัวตน การรักษา session การป้องกัน CSRF และการคงสถานะการใช้งานที่จำเป็นต่อความปลอดภัย",
      "คุกกี้ประเภทจำเป็นไม่ใช้เพื่อโฆษณาและไม่ควรถูกปิด หากปิดหรือบล็อกไว้ผู้ใช้อาจเข้าสู่ระบบ ใช้ 2FA หรือใช้งานบางฟังก์ชันไม่ได้ตามปกติ",
    ],
  },
  {
    title: "คุกกี้ด้านความปลอดภัยและการป้องกัน abuse",
    icon: "solar:shield-keyhole-bold",
    items: [
      "เราอาจใช้กลไกป้องกันบอทหรือ abuse เช่น challenge, verification, rate limit token หรือข้อมูล session เพื่อลดความเสี่ยงบนหน้าเข้าสู่ระบบและแบบฟอร์มสาธารณะ",
      "ข้อมูลด้านความปลอดภัยจะถูกใช้เท่าที่จำเป็นเพื่อป้องกันการโจมตี ตรวจสอบเหตุผิดปกติ และรักษาความน่าเชื่อถือของระบบ",
    ],
  },
  {
    title: "การตั้งค่าและประสบการณ์ใช้งาน",
    icon: "solar:tuning-square-bold",
    items: [
      "ระบบอาจเก็บค่าตั้งค่าบางอย่างในเครื่องของผู้ใช้ เช่น ธีม สถานะฟอร์มบางรายการ ตัวเลือกตาราง หรือค่าที่ช่วยให้ workflow ต่อเนื่องขึ้น",
      "ข้อมูลกลุ่มนี้ควรเก็บเท่าที่จำเป็น ไม่ใช้เพื่อระบุตัวตนเกินกว่าบริบทบริการ และสามารถถูกล้างได้จากการตั้งค่า browser ของผู้ใช้",
      "การล้างคุกกี้หรือ storage อาจทำให้ต้องเข้าสู่ระบบใหม่ ตั้งค่าบางรายการใหม่ หรือยืนยันตัวตนเพิ่มเติม",
    ],
  },
];

export const securityChannels: SecurityChannel[] = [
  {
    label: "Email",
    value: "support@itii.ac.th",
    href: "mailto:support@itii.ac.th?subject=%5BSECURITY%5D%20ITII%20Assist%20Classroom",
    note: "ใช้หัวข้อ [SECURITY] และอธิบายผลกระทบที่อาจเกิดขึ้นอย่างชัดเจน",
    icon: "solar:mailbox-bold",
  },
  {
    label: "Support Portal",
    value: "/support/contact",
    href: "/support/contact",
    note: "เหมาะสำหรับเหตุที่ต้องการประสานงานต่อเนื่องหรือมีข้อมูลประกอบหลายรายการ",
    icon: "solar:chat-round-dots-bold",
  },
  {
    label: "Status Communication",
    value: statusProvider ? statusProvider.name : "/status",
    href: statusLiveLink.href,
    note: statusProvider
      ? `ใช้ติดตามประกาศเหตุขัดข้องสาธารณะ, maintenance updates, และ live incident communication ผ่าน ${statusProvider.name}`
      : "ใช้ติดตามประกาศเหตุขัดข้องสาธารณะและ maintenance updates",
    icon: "solar:server-path-bold",
    type: statusLiveLink.type,
  },
];

export const securityDisclosureSteps = [
  "รายงานปัญหาโดยเร็วที่สุดพร้อมคำอธิบายผลกระทบ ขอบเขต ระบบที่เกี่ยวข้อง เวลาเกิดเหตุ และขั้นตอนในการทำซ้ำเท่าที่ทำได้อย่างปลอดภัย",
  "แนบหลักฐานเท่าที่จำเป็น เช่น screenshot log หรือ request ที่ตัดข้อมูลลับออกแล้ว เพื่อช่วยให้ทีมงานประเมินความรุนแรงได้ถูกต้อง",
  "หลีกเลี่ยงการเข้าถึงข้อมูลของผู้ใช้รายอื่น การเปลี่ยนแปลงข้อมูลจริง หรือการรบกวนบริการเกินกว่าที่จำเป็นต่อการพิสูจน์ปัญหา",
  "อย่าเปิดเผยรายละเอียดสู่สาธารณะจนกว่าทีมดูแลระบบจะมีโอกาสตรวจสอบ ลดความเสี่ยง และแจ้งแนวทางตอบสนองเรียบร้อยแล้ว",
  "หากเป็นเหตุเร่งด่วน เช่น account takeover, data exposure, privilege escalation, หรือ active abuse ให้ระบุความเร่งด่วนในหัวข้อและเนื้อหาอย่างชัดเจน",
];

export const securitySafeHarbor = [
  "การทดสอบต้องอยู่ในขอบเขตของบัญชีหรือข้อมูลที่คุณมีสิทธิ์เข้าถึงเท่านั้น",
  "ห้ามใช้ social engineering, phishing, spam, DDoS, หรือการทำลายข้อมูลเพื่อพิสูจน์ปัญหา",
  "ห้ามดาวน์โหลด คัดลอก หรือเปิดเผยข้อมูลส่วนบุคคลของผู้อื่นเกินกว่าที่จำเป็นต่อการพิสูจน์ช่องโหว่",
  "ทีมงานจะพิจารณารายงานที่ทำโดยสุจริตและพยายามตอบกลับตามระดับความรุนแรงของเหตุการณ์",
];

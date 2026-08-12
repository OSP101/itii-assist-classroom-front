# ตารางสิทธิ์ตามบทบาท (Role and Permission Matrix)

หมายเหตุ:
- ตารางนี้เป็นภาพรวมเพื่อใช้งานคู่มือ
- สิทธิ์จริงของ TA ขึ้นกับ Course Permission ที่อาจารย์กำหนด

## 1) ภาพรวมสิทธิ์หลัก

| งานในระบบ | Admin | Instructor | TA | Student |
|---|---|---|---|---|
| จัดการผู้ใช้ระบบ | ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ |
| จัดการนักศึกษาระดับระบบ | ได้ | บางส่วน | บางส่วน | ไม่ได้ |
| สร้างรายวิชา | ได้ | ได้ | ไม่ได้ | ไม่ได้ |
| เข้าถึงรายวิชาที่เป็นสมาชิก | ได้ | ได้ | ได้ | ได้ (เฉพาะมุมนักศึกษา) |
| จัดการ section | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| เพิ่ม/ลบ TA และผู้สอนร่วม | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| จัดการนักศึกษาใน section | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| สร้าง/แก้ไขงานมอบหมาย | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| ให้คะแนน | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| ดู score summary/matrix | ได้ | ได้ | ได้ตาม permission | ดูของตัวเองเท่านั้น |
| ส่งคำขอแก้คะแนน | ได้ | ได้ | ได้ | ไม่ได้ |
| อนุมัติ/ปฏิเสธคำขอแก้คะแนน | ได้ | ได้ | ได้ตาม permission review_all | ไม่ได้ |
| สร้างรอบเช็คชื่อ | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| เช็คชื่อ | ไม่ได้ | ไม่ได้ | ไม่ได้ | ได้ |
| เปิด/ปิด queue session | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| เข้าคิว | ไม่ได้ | ไม่ได้ | ไม่ได้ | ได้ |
| จัดการทีม | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| จัดการคะแนนสอบ | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| เพิ่มคะแนนโบนัส | ได้ | ได้ | ได้ตาม permission | ไม่ได้ |
| ดู activity log รายวิชา | ได้ | ได้ | โดยทั่วไปไม่ใช่เจ้าของหลัก | ไม่ได้ |

## 2) ตัวอย่าง Course Permission ที่ใช้บ่อยสำหรับ TA

| Permission | ความหมาย |
|---|---|
| `create_sections` | สร้าง section |
| `update_sections` | แก้ไข section |
| `delete_sections` | ลบ section |
| `manage_section_students` | เพิ่ม/ลบนักศึกษาใน section |
| `add_people` | เพิ่ม TA/ผู้สอนร่วม |
| `remove_people` | ลบ TA/ผู้สอนร่วม |
| `edit_member_permissions` | แก้ permission ของสมาชิก |
| `create_assignments` | สร้างงาน |
| `update_assignments` | แก้ไขงาน |
| `delete_assignments` | ลบงาน |
| `view_score_summary` | ดู score summary/matrix |
| `grade_*`/`edit_*` | ให้คะแนนหรือแก้คะแนน (ตาม policy) |
| `review_all` | อนุมัติ/ปฏิเสธคำขอแก้คะแนนทั้งหมด |
| `create_attendance_sessions` | สร้างรอบเช็คชื่อ |
| `update_attendance_sessions` | แก้ไข/เปิด/ปิดรอบเช็คชื่อ |
| `update_attendance_status` | ปรับสถานะเช็คชื่อรายบุคคล/bulk |
| `view_teams` | ดูทีม |
| `create_teams` | สร้างทีม |
| `update_teams` | แก้ไขทีม |
| `delete_teams` | ลบทีม |
| `manage_team_members` | เพิ่ม/ลบสมาชิกทีม |
| `view_exam_scores` | ดูคะแนนสอบ |
| `create_exam_scores`/`update_exam_scores` | บันทึกคะแนนสอบ |
| `delete_exam_scores` | ลบคะแนนสอบ |

## 3) แนวทางกำหนดสิทธิ์แบบปลอดภัย

1. เริ่มจาก least privilege
- ให้ TA เท่าที่จำเป็นต่อหน้าที่จริง

2. แยก TA ตามบทบาทงาน
- TA คะแนน, TA เช็คชื่อ, TA คิว/หน้างาน

3. ทบทวนสิทธิ์ทุกช่วงสำคัญ
- ต้นเทอม, กลางเทอม, ก่อนปิดเกรด

4. งานเสี่ยงควรให้ผู้สอนอนุมัติ
- อนุมัติคำขอแก้คะแนน
- ปรับข้อมูลที่กระทบผลการเรียนจำนวนมาก

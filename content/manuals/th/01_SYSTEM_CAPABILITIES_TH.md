# ภาพรวมความสามารถของระบบ (System Capabilities)

## 1) บทบาทผู้ใช้งานหลัก

1. Admin
- จัดการผู้ใช้
- จัดการนักศึกษา
- จัดการรายวิชาและห้องเรียนในภาพรวม
- ดู log/monitoring ระดับระบบ

2. Instructor (อาจารย์)
- จัดการรายวิชาที่ตนรับผิดชอบ
- จัดการ section, งาน, คะแนน, สอบ, เช็กชื่อ, คิว
- อนุมัติ/ปฏิเสธคำขอแก้คะแนน
- ดู activity log และสถิติ TA

3. TA (ผู้ช่วยสอน)
- ทำงานในรายวิชาที่ได้รับมอบหมาย
- ให้คะแนน, จัดการเช็กชื่อ/คิว, จัดการทีม (ตาม permission)
- ส่งคำขอแก้คะแนนหรือรีวิวคำขอ (ตาม permission)

4. Student (นักศึกษา)
- เช็กชื่อรอบที่เปิด
- เข้าคิวตรวจงาน/ขอคำปรึกษา
- ดูคะแนนของตนเอง
- ดูสถานะงานและข้อมูลส่วนที่เปิดเผยให้ผู้เรียน

## 2) โมดูลหลักของระบบ

1. Authentication และ Security
- Login, Logout, Refresh token
- OAuth (Google/GitHub/Apple)
- Session management
- 2FA (TOTP/Email)

2. Course Management
- สร้างรายวิชา
- จัดการ section
- เพิ่ม/ลบ instructor และ TA
- เพิ่ม/ลบนักศึกษาใน section

3. Assignment และ Score
- สร้างงาน (รองรับ sub-items)
- ให้คะแนนรายบุคคล/กลุ่ม/bulk
- ดู summary/matrix
- รองรับคำขอแก้คะแนนและ workflow อนุมัติ

4. Attendance
- สร้างรอบเช็กชื่อ
- เปิด/ปิดรอบ
- รองรับ PIN, QR และเงื่อนไขเวลา/ตำแหน่ง
- แก้ไขสถานะเช็กชื่อรายบุคคลหรือ bulk

5. Queue
- เปิด session คิว
- นักศึกษาจองคิว
- TA/Instructor ทำงานแบบ worker
- แสดงผลแบบ real-time (รวม projector/display)

6. Exam และ Bonus
- ตั้งค่าองค์ประกอบคะแนนสอบ
- บันทึกคะแนนสอบรายบุคคลและ bulk
- เพิ่ม/สรุปคะแนน bonus

7. Team Management
- สร้างทีม
- จัดการสมาชิกทีม
- รองรับ bulk create/delete

8. Activity Logs และ Monitoring
- เก็บเหตุการณ์สำคัญระดับรายวิชา
- ใช้ audit ย้อนหลังและสรุปภาระงาน TA

## 3) พื้นที่หน้าใช้งานสำคัญ (Frontend)

1. งาน Admin
- `/admin/users`
- `/admin/students`
- `/admin/courses`
- `/admin/classrooms`

2. งาน Instructor/TA
- `/(instructor)/home`
- `/(instructor)/classroom/[id]`
- แท็บย่อย เช่น overview, sections, assignments, attendance, queue, scores, approval, exam-scores, people, activity-log, settings

3. งานนักศึกษา
- `/check-in/[sessionId]`
- `/queue/book`
- `/student/courses` (ตรวจคะแนน ต้อง login)
- `/permissions` (ตรวจสิทธิ์ browser: location, notification, camera)

## 4) หลักการควบคุมสิทธิ์

1. ระดับ role
- `admin`, `instructor`, `ta`

2. ระดับ course access
- ต้องเป็นสมาชิกรายวิชาเพื่อเข้าถึงข้อมูลรายวิชานั้น

3. ระดับ course permission
- สิทธิ์ละเอียด เช่น create_sections, manage_section_students, create_assignments, update_attendance_sessions, view_score_summary, review_all

หมายเหตุ:
- TA ทำได้ไม่เท่ากันทุกคน ขึ้นกับ permission ที่ผู้สอนกำหนดในแต่ละรายวิชา

## 5) ภาพรวมเส้นทางงาน (High-level Workflows)

1. เริ่มเทอม
- สร้างรายวิชา -> สร้าง section -> เพิ่ม TA -> เพิ่มนักศึกษา -> ตั้งค่างาน/สอบ/เช็กชื่อ

2. ระหว่างเทอม
- เปิดรอบเช็กชื่อ -> เปิดคิว -> ตรวจงานและให้คะแนน -> จัดการคำขอแก้คะแนน

3. ปลายเทอม
- ตรวจความครบถ้วนคะแนน -> ปรับค่าตามนโยบาย -> ปิดรายวิชา -> เก็บหลักฐานใน activity log

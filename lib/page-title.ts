const APP_NAME = "LabTAS";

type CourseLike = {
  code?: string | null;
  name?: string | null;
} | null | undefined;

export function buildPageTitle(pageLabel: string, context?: string | null): string {
  return [pageLabel, context?.trim(), APP_NAME].filter(Boolean).join(" - ");
}

export function buildCourseTitleContext(course: CourseLike): string | null {
  if (!course) {
    return null;
  }

  const segments = [course.code?.trim(), course.name?.trim()].filter(Boolean);
  return segments.length > 0 ? segments.join(" ") : null;
}

export function getClassroomTabLabel(tab: string, isEnglish: boolean): string {
  const labels: Record<string, { th: string; en: string }> = {
    overview: { th: "ภาพรวมรายวิชา", en: "Course Overview" },
    sections: { th: "จัดการตอนเรียนและกลุ่ม", en: "Sections and Teams" },
    people: { th: "ผู้สอน ผู้ช่วยสอน และนักศึกษา", en: "People" },
    assignments: { th: "งานและการส่งงาน", en: "Assignments" },
    scores: { th: "คะแนน", en: "Scores" },
    "exam-scores": { th: "คะแนนสอบ", en: "Exam Scores" },
    "exam-seats": { th: "ผังที่นั่งสอบ", en: "Exam Seating" },
    approval: { th: "คำร้องขออนุมัติคะแนน", en: "Score Approvals" },
    "attendance-overview": { th: "ภาพรวมการเช็คชื่อ", en: "Attendance Overview" },
    attendance: { th: "การเช็คชื่อ", en: "Attendance" },
    queue: { th: "คิวตรวจงานและขอคำปรึกษา", en: "Queue" },
    "activity-log": { th: "บันทึกกิจกรรม", en: "Activity Log" },
    "ta-stats": { th: "สถิติผู้ช่วยสอน", en: "TA Stats" },
    settings: { th: "ตั้งค่ารายวิชา", en: "Course Settings" },
  };

  const label = labels[tab];
  if (!label) {
    return isEnglish ? "Classroom" : "รายวิชา";
  }

  return isEnglish ? label.en : label.th;
}

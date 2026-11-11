import type ExcelJS from "exceljs";
import type { Student, StudentListParams, StudentListResponse } from "@/services/student.service";

type FetchStudents = (params: StudentListParams) => Promise<{
    success: boolean;
    data?: StudentListResponse;
    message?: string;
}>;

export async function fetchAllStudents(fetchStudents: FetchStudents): Promise<Student[]> {
    const students: Student[] = [];
    let page = 1;
    let totalPages = 1;
    do {
        // A fixed ordering and fresh requests keep export independent of table filters.
        const response = await fetchStudents({ page, limit: 500, sortBy: "student_id", sortOrder: "ASC" });
        if (!response.success || !response.data) {
            throw new Error(response.message || "Could not load students for export");
        }
        const { students: batch, pagination } = response.data;
        if (batch.length === 0 && page < pagination.totalPages) {
            throw new Error("Incomplete student export");
        }
        students.push(...batch);
        totalPages = pagination.totalPages;
        page += 1;
    } while (page <= totalPages);
    return students;
}

export function populateStudentWorksheet(
    worksheet: ExcelJS.Worksheet,
    students: Student[],
    isEnglish: boolean,
    programLabel: (value: string) => string,
) {
    worksheet.columns = [
        { header: isEnglish ? "Student ID" : "รหัสนักศึกษา", key: "student_id", width: 22 },
        { header: isEnglish ? "Full name" : "ชื่อ-นามสกุล", key: "full_name", width: 40 },
        { header: isEnglish ? "Email" : "อีเมล", key: "email", width: 40 },
        { header: isEnglish ? "Program" : "หลักสูตร", key: "program", width: 50 },
        { header: isEnglish ? "Status" : "สถานะ", key: "status", width: 20 },
        { header: isEnglish ? "Created at" : "วันที่สร้าง", key: "created_at", width: 26 },
        { header: isEnglish ? "Updated at" : "วันที่แก้ไข", key: "updated_at", width: 26 },
    ];
    worksheet.getColumn("student_id").numFmt = "@";
    for (const student of students) {
        worksheet.addRow({
            student_id: String(student.student_id),
            full_name: student.full_name,
            email: student.email || "",
            program: programLabel(String(student.extra?.program ?? "")),
            status: student.is_active
                ? (isEnglish ? "Active" : "เปิดใช้งาน")
                : (isEnglish ? "Inactive" : "ปิดใช้งาน"),
            created_at: student.created_at,
            updated_at: student.updated_at,
        });
    }
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: "A1", to: `G${worksheet.rowCount}` };
}

import type { CreateStudentDto } from "@/services/student.service";
import type ExcelJS from "exceljs";

type Columns = { studentId: number; fullName: number; email?: number; program?: number };

// REG exports may contain overlapping merge ranges. Import only cell data;
// merge metadata is presentational and can prevent ExcelJS from opening the file.
export const REG_XLSX_READ_OPTIONS = { ignoreNodes: ["mergeCells"] };

const headers = {
    studentId: ["รหัสนักศึกษา", "รหัสประจำตัว", "รหัสประจำตัวนักศึกษา", "studentid", "studentcode"],
    fullName: ["ชื่อ", "ชื่อสกุล", "ชื่อนามสกุล", "ชื่อและนามสกุล", "fullname", "studentname"],
    email: ["อีเมล", "อีเมล์", "email", "emailaddress", "kkumail"],
    program: ["เอก", "สาขา", "สาขาวิชา", "หลักสูตร", "program", "major"],
} satisfies Record<keyof Columns, string[]>;

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s\u200b\ufeff.\-–—_():]/g, "");

/** Keep physical column positions: REG reports contain merged cells and blank columns. */
export function extractStudentsFromRegRows(rows: string[][]): CreateStudentDto[] {
    let columns: Columns = { studentId: 1, fullName: 2, email: 3, program: 4 };
    const students: CreateStudentDto[] = [];
    for (const row of rows) {
        const normalized = row.map(normalizeHeader);
        const detected: Partial<Columns> = {};
        for (const key of Object.keys(headers) as (keyof Columns)[]) {
            const index = normalized.findIndex(value => headers[key].includes(value));
            if (index !== -1) detected[key] = index;
        }
        if (detected.studentId !== undefined && detected.fullName !== undefined) {
            columns = detected as Columns;
            continue;
        }

        const studentId = row[columns.studentId]?.trim() ?? "";
        const fullName = row[columns.fullName]?.trim() ?? "";
        if (!/^\d{9}-\d$/.test(studentId) || !fullName) continue;
        const student: CreateStudentDto = { student_id: studentId, full_name: fullName };
        const email = columns.email === undefined ? "" : row[columns.email]?.trim();
        const program = columns.program === undefined ? "" : row[columns.program]?.trim();
        if (email) student.email = email;
        if (program) student.extra = { program };
        students.push(student);
    }
    return students;
}

export function extractStudentsFromRegWorksheet(worksheet: ExcelJS.Worksheet): CreateStudentDto[] {
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, row => {
        const cells: string[] = [];
        // eachCell reports the original column number, including across merged ranges.
        row.eachCell({ includeEmpty: false }, (cell, column) => {
            cells[column - 1] = cell.text;
        });
        rows.push(cells);
    });
    return extractStudentsFromRegRows(rows);
}

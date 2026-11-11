const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const ExcelJS = require("exceljs");
const source = ts.transpileModule(fs.readFileSync(`${__dirname}/student-export.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const exported = {};
vm.runInNewContext(source, { exports: exported });
const student = {
    id: 1, student_id: "001234-5", full_name: "นายทดสอบ ระบบ", email: null,
    extra: { program: "IT" }, is_active: false,
    created_at: "2026-11-11T01:00:00+07:00", updated_at: "2026-11-11T02:00:00+07:00",
};

test("exports every page without table filters", async () => {
    const queries = [];
    const students = await exported.fetchAllStudents(async query => {
        queries.push(JSON.parse(JSON.stringify(query)));
        return { success: true, data: { students: [{ ...student, id: query.page }], pagination: { totalPages: 3 } } };
    });
    assert.equal(students.length, 3);
    assert.deepEqual(queries, [1, 2, 3].map(page => ({ page, limit: 500, sortBy: "student_id", sortOrder: "ASC" })));
});

test("fails the export when a later page fails", async () => {
    await assert.rejects(exported.fetchAllStudents(async ({ page }) => page === 1
        ? { success: true, data: { students: [student], pagination: { totalPages: 2 } } }
        : { success: false, message: "Server unavailable" }), /Server unavailable/);
});

test("handles an empty student database", async () => {
    const result = await exported.fetchAllStudents(async () => ({ success: true, data: { students: [], pagination: { totalPages: 0 } } }));
    assert.equal(result.length, 0);
});

test("XLSX round trip preserves Thai, leading zeros, empty email and literal formula-like text", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("นักศึกษา");
    exported.populateStudentWorksheet(sheet, [student, { ...student, full_name: "=1+1", is_active: true, extra: null }], false, value => value === "IT" ? "เทคโนโลยีสารสนเทศ (IT)" : value);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const result = loaded.worksheets[0];
    assert.equal(result.getCell("A2").value, "001234-5");
    assert.equal(result.getCell("A2").numFmt, "@");
    assert.equal(result.getCell("B2").value, student.full_name);
    assert.ok(!result.getCell("C2").value);
    assert.equal(result.getCell("D2").value, "เทคโนโลยีสารสนเทศ (IT)");
    assert.equal(result.getCell("E2").value, "ปิดใช้งาน");
    assert.equal(result.getCell("B3").value, "=1+1");
    assert.equal(result.getCell("E3").value, "เปิดใช้งาน");
    assert.equal(result.getCell("F2").value, student.created_at);
    assert.equal(result.views[0].ySplit, 1);
    assert.equal(result.autoFilter, "A1:G3");
});

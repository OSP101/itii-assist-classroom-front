const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const ExcelJS = require("exceljs");

// The app has no test runner; transpile this pure TypeScript module for Node's runner.
const source = ts.transpileModule(fs.readFileSync(`${__dirname}/student-reg-import.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(source, { exports: moduleExports });
const parseRows = rows => JSON.parse(JSON.stringify(moduleExports.extractStudentsFromRegRows(rows)));
const expected = [{ student_id: "693020001-1", full_name: "นายทดสอบ ระบบ", email: "test@kkumail.com", extra: { program: "CP-IT" } }];

test("legacy B-E rows work without a header and ignore report text", () => {
    assert.deepEqual(parseRows([
        ["รายชื่อนักศึกษา"],
        ["1", "693020001-1", "นายทดสอบ ระบบ", "test@kkumail.com", "CP-IT"],
        ["รวม", "1 คน"],
        ["2", "invalid", "Invalid"],
        ["3", "693020002-2", ""],
    ]), expected);
});

test("new REG report detects sparse merged columns and ignores vaccine/grade/from", () => {
    const header = [];
    const row = [];
    for (const [index, value] of [[0, "เลขที่"], [2, "รหัสประจำตัว"], [6, "ชื่อ"], [8, "เอก "], [10, "ได้รับวัคซีน(ครั้ง)"], [12, "เกรด"], [13, "kkumail"], [19, "จาก"]]) header[index] = value;
    for (const [index, value] of [[0, "1"], [2, "693020001-1"], [6, "นายทดสอบ ระบบ"], [8, "CP-IT"], [10, "2"], [12, "A"], [13, "test@kkumail.com"], [19, "0"]]) row[index] = value;
    assert.deepEqual(parseRows([["รายชื่อนักศึกษาที่ลงทะเบียน"], header, ["", "", "", "สัปดาห์"], row, header, ["รวม 1 คน"]]), expected);
});

test("recognized headers may reorder columns or omit email and program", () => {
    assert.deepEqual(parseRows([
        ["ชื่อ - นามสกุล", "รหัสนักศึกษา", "ได้รับวัคซีน(ครั้ง)", "เกรด"],
        ["นายทดสอบ ระบบ", "693020001-1", "2", "A"],
    ]), [{ student_id: expected[0].student_id, full_name: expected[0].full_name }]);
});

test("ExcelJS merged cells, rich text and formula results keep their original columns after loading", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("REG");
    for (const [range, value] of [["C14:F15", "รหัสประจำตัว"], ["G14:H15", "ชื่อ"], ["I14:J15", "เอก"], ["N14:S15", "kkumail"], ["C16:F16", expected[0].student_id], ["G16:H16", { richText: [{ text: "นายทดสอบ " }, { text: "ระบบ" }] }], ["I16:J16", "CP-IT"], ["N16:S16", { formula: '"test@kkumail.com"', result: "test@kkumail.com" }]]) {
        sheet.mergeCells(range);
        sheet.getCell(range.split(":")[0]).value = value;
    }
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer(), moduleExports.REG_XLSX_READ_OPTIONS);
    assert.deepEqual(JSON.parse(JSON.stringify(moduleExports.extractStudentsFromRegWorksheet(loaded.worksheets[0]))), expected);
});

// Opt-in local acceptance check; personal data is never stored in the repository.
if (process.env.REG_SAMPLE_PATH) test("provided REG workbook imports every student with the correct fields", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fs.readFileSync(process.env.REG_SAMPLE_PATH), moduleExports.REG_XLSX_READ_OPTIONS);
    const sheet = workbook.worksheets[0];
    const expectedRows = [];
    sheet.eachRow(row => {
        if (/^\d{9}-\d$/.test(row.getCell("C").text)) {
            expectedRows.push({ student_id: row.getCell("C").text, full_name: row.getCell("G").text, email: row.getCell("N").text, extra: { program: row.getCell("I").text } });
        }
    });
    assert.ok(expectedRows.length > 0);
    assert.deepEqual(JSON.parse(JSON.stringify(moduleExports.extractStudentsFromRegWorksheet(sheet))), expectedRows);
    console.log(`Verified ${expectedRows.length} students against source columns`);
});

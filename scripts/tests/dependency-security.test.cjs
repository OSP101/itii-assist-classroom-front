const { test } = require('node:test');
const assert = require('node:assert/strict');
const merge = require('deepmerge');

test('merge rejects prototype keys from source and target, including nested placeholders', () => {
  const attack = JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true}}');
  for (const [target, source] of [
    [Object.create(null), attack],
    [attack, {}],
    [{ settings: null }, { settings: attack }],
    [{ settings: 1 }, { settings: attack }],
  ]) {
    const result = merge(target, source);
    const object = result.settings || result;
    assert.equal(Object.getPrototypeOf(object), Object.prototype);
    assert.equal(object.isAdmin, undefined);
    assert.equal(Object.hasOwn(object, '__proto__'), false);
    assert.equal(Object.hasOwn(object, 'constructor'), false);
    assert.equal(Object.hasOwn(object, 'prototype'), false);
    assert.equal({}.polluted, undefined);
  }
});

test('merge preserves nested theme values, arrays, symbols and custom array behavior', () => {
  const symbol = Symbol('theme');
  const source = { palette: { accent: '#123456' }, list: [2], [symbol]: 'kept' };
  const result = merge({ palette: { background: '#fff' }, list: [1] }, source);
  assert.deepEqual(result.palette, { background: '#fff', accent: '#123456' });
  assert.deepEqual(result.list, [1, 2]);
  assert.equal(result[symbol], 'kept');
  result.palette.accent = 'changed';
  assert.equal(source.palette.accent, '#123456');
  assert.deepEqual(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_a, b) => b }), { list: [2] });
});

test('HeroUI theme plugin retains built-in and custom theme configuration', () => {
  const { heroui } = require('@heroui/theme');
  const result = heroui({ themes: { light: { colors: { primary: { DEFAULT: '#123456' } } } } });
  assert.equal(typeof result.handler, 'function');
  assert.ok(result.config.theme.extend.colors.primary);
  assert.ok(result.config.theme.extend.borderRadius);
});

test('ExcelJS XLSX roundtrip and extended conditional formatting work with patched uuid', async () => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('คะแนน');
  sheet.addRow(['นักศึกษา', 'คะแนน']);
  sheet.addRow(['นักศึกษาทดสอบ', 9.5]);
  sheet.addConditionalFormatting({ ref: 'B2:B3', rules: [{
    type: 'dataBar', gradient: false, cfvo: [{ type: 'min' }, { type: 'max' }],
    color: { argb: 'FF00FF00' },
  }] });
  const bytes = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  assert.equal(restored.worksheets[0].getCell('A2').value, 'นักศึกษาทดสอบ');
  assert.equal(restored.worksheets[0].getCell('B2').value, 9.5);
  const CfRule = require('exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform');
  const rule = { type: 'iconSet', iconSet: '3Stars' };
  new CfRule().prepare(rule);
  assert.match(rule.x14Id, /^\{[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}\}$/);
});

test('PDF generation remains usable after sanitizer dependency update', () => {
  const { jsPDF } = require('jspdf');
  const pdf = new jsPDF();
  pdf.text('Verification', 10, 10);
  assert.match(Buffer.from(pdf.output('arraybuffer')).toString('ascii', 0, 8), /^%PDF-/);
});

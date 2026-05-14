import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvCell, escapeHtml } from '../src/index.js';

test('parseCsv handles quoted commas and values', () => {
  const rows = parseCsv([
    'invite_code,name,email,password,max_guests',
    'FAM1,"Smith, Alex",alex@example.com,party123,4',
  ].join('\n'));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].invite_code, 'FAM1');
  assert.equal(rows[0].name, 'Smith, Alex');
  assert.equal(rows[0].password, 'party123');
  assert.equal(rows[0].max_guests, '4');
});

test('parseCsv normalizes pasted headers with BOM and spaces', () => {
  const rows = parseCsv([
    '\uFEFFInvite Code,Name,Email,Password,Max Guests',
    'FAM2,Jordan,jordan@example.com,welcome,3',
  ].join('\n'));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].invite_code, 'FAM2');
  assert.equal(rows[0].password, 'welcome');
  assert.equal(rows[0].max_guests, '3');
});

test('parseCsv handles tab-delimited pasted spreadsheet rows', () => {
  const rows = parseCsv([
    'invite_code\tname\temail\tpassword\tmax_guests',
    'FAM3\tTaylor Family\ttaylor@example.com\tpartytime\t5',
  ].join('\n'));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].invite_code, 'FAM3');
  assert.equal(rows[0].name, 'Taylor Family');
  assert.equal(rows[0].password, 'partytime');
  assert.equal(rows[0].max_guests, '5');
});

test('csvCell escapes commas and quotes', () => {
  assert.equal(csvCell('simple'), 'simple');
  assert.equal(csvCell('Smith, Alex'), '"Smith, Alex"');
  assert.equal(csvCell('He said "yes"'), '"He said ""yes"""');
});

test('escapeHtml sanitizes dangerous text', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  iDash — Data Entry Endpoint  (Google Apps Script)
 *  รับค่าที่ staff กรอกจากหน้า "ผู้อินพุตข้อมูล" มาเก็บลง Google Sheets
 *
 *  วิธีติดตั้ง
 *  ─────────────────────────────────────────────────────────────────────
 *  1) เปิด Google Sheet ที่จะใช้เก็บข้อมูล → Extensions → Apps Script
 *  2) ลบโค้ดเดิมทิ้ง แล้ววางไฟล์นี้ทั้งหมด
 *  3) แก้ SHEET_ID ด้านล่างให้ตรงกับชีตของคุณ (ดูจาก URL)
 *  4) Deploy → New deployment → เลือก type = Web app
 *       Execute as        : Me
 *       Who has access    : Anyone            ← สำคัญ ต้องเป็น Anyone
 *  5) กด Deploy แล้วคัดลอก URL ที่ลงท้ายด้วย /exec
 *  6) เอา URL ไปวางใน iDash → ปุ่ม "⚙ ตั้งค่าที่เก็บข้อมูล"
 *
 *  ทดสอบว่าใช้ได้: เปิด URL/exec?action=ping ในเบราว์เซอร์
 *  ควรได้ {"ok":true,...} กลับมา
 * ═══════════════════════════════════════════════════════════════════════
 */

// ⚠️ แก้ตรงนี้ให้เป็น ID ของชีตคุณ (ส่วนที่อยู่ระหว่าง /d/ กับ /edit ใน URL)
const SHEET_ID = '1H0XLGQWP9ozUhkap5JTZLjWi6uNLAiEkK3_rjImyYIs';

// หัวตาราง — 1 แถว = 1 ค่าที่บันทึก (long format เอาไป PivotTable ต่อได้เลย)
const HEADERS = ['UID','วันที่','กะ','เวลา','สถานี','รหัส KPI','พารามิเตอร์',
                 'ค่า','หน่วย','เป้าหมาย','สถานะ','ผู้บันทึก','บันทึกเมื่อ (ISO)'];

// แท็บของแต่ละสถานี — iDash ส่งชื่อสถานีมา ระบบจะสร้างแท็บให้อัตโนมัติถ้ายังไม่มี
const KNOWN_TABS = ['หีบอ้อย','หม้อต้ม','เคี่ยว','ปั่นแยก','หม้อไอน้ำ'];

/* ─────────────── entry points ─────────────── */
function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    switch (p.action || 'ping') {
      case 'ping':   return json({ ok: true, msg: 'iDash endpoint พร้อมใช้งาน', tabs: listTabs() });
      case 'append': return json(appendRow(p));
      case 'batch':  return json(appendBatch(p));
      case 'read':   return json(readRows(p));
      default:       return json({ ok: false, error: 'ไม่รู้จัก action: ' + p.action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ─────────────── helpers ─────────────── */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function book() { return SpreadsheetApp.openById(SHEET_ID); }

function listTabs() {
  return book().getSheets().map(function (s) { return s.getName(); });
}

/** คอลัมน์ "ค่า" เป็นตัวเลข ที่เหลือบังคับเป็นข้อความ
 *  ไม่งั้น Sheets จะตีความ "04/08/2569" เป็นวันที่ และ "14:20" เป็นเวลา แล้วค่าเพี้ยนทั้งคู่ */
const COL_VALUE = 8;

/** หาแท็บตามชื่อสถานี ถ้าไม่มีให้สร้างพร้อมหัวตาราง */
function tabFor(station) {
  const name = String(station || 'อื่นๆ').trim() || 'อื่นๆ';
  const ss = book();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#2f6bf5')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(7, 260);
  }
  return sh;
}

/** เขียนหลายแถวต่อท้าย พร้อมล็อกรูปแบบคอลัมน์ก่อนใส่ค่า */
function writeRows(sh, data) {
  if (!data.length) return;
  const start = sh.getLastRow() + 1;
  const rng = sh.getRange(start, 1, data.length, HEADERS.length);
  rng.setNumberFormat('@');                                        // ทั้งแถวเป็นข้อความก่อน
  sh.getRange(start, COL_VALUE, data.length, 1).setNumberFormat('0.####');  // ยกเว้นคอลัมน์ "ค่า"
  rng.setValues(data);
}

/** UID ที่เคยบันทึกแล้ว — ใช้กันข้อมูลซ้ำเวลา client ส่งซ้ำจากคิวออฟไลน์ */
function existingUids(sh) {
  const n = sh.getLastRow();
  if (n < 2) return {};
  const vals = sh.getRange(2, 1, n - 1, 1).getValues();
  const map = {};
  for (let i = 0; i < vals.length; i++) {
    const u = String(vals[i][0] || '');
    if (u) map[u] = true;
  }
  return map;
}

function rowFrom(r) {
  return [
    String(r.uid || ''),
    String(r.date || ''),
    String(r.shift || ''),
    String(r.time || ''),
    String(r.station || ''),
    String(r.kpiId || ''),
    String(r.kpiName || ''),
    (r.value === '' || r.value == null) ? '' : Number(r.value),
    String(r.unit || ''),
    String(r.target || ''),
    String(r.status || ''),
    String(r.by || ''),
    String(r.iso || new Date().toISOString())
  ];
}

/* ─────────────── actions ─────────────── */

/** บันทึกทีละค่า — iDash เรียกอันนี้ตอนกด "ยืนยันและบันทึก" */
function appendRow(p) {
  if (!p.station) return { ok: false, error: 'ไม่ได้ระบุสถานี' };
  const sh = tabFor(p.station);

  if (p.uid && existingUids(sh)[p.uid]) {
    return { ok: true, duplicate: true, msg: 'บันทึกไว้แล้ว (UID ซ้ำ) — ข้ามให้', uid: p.uid };
  }
  writeRows(sh, [rowFrom(p)]);
  return { ok: true, saved: 1, skipped: 0, uids: [p.uid || ''], row: sh.getLastRow(), tab: sh.getName() };
}

/** บันทึกหลายค่าพร้อมกัน — ใช้ตอน iDash ส่งคิวออฟไลน์ที่ค้างอยู่
 *  ส่งมาเป็น rows = JSON array ของ record */
function appendBatch(p) {
  let rows;
  try {
    rows = JSON.parse(p.rows || '[]');
  } catch (err) {
    return { ok: false, error: 'rows ไม่ใช่ JSON ที่ถูกต้อง' };
  }
  if (!rows.length) return { ok: true, saved: 0, skipped: 0 };

  // จัดกลุ่มตามสถานี เพื่อเขียนทีเดียวต่อแท็บ (เร็วกว่า appendRow ทีละแถวมาก)
  const byTab = {};
  rows.forEach(function (r) {
    const t = String(r.station || 'อื่นๆ');
    (byTab[t] = byTab[t] || []).push(r);
  });

  let saved = 0, skipped = 0;
  const savedUids = [];
  Object.keys(byTab).forEach(function (t) {
    const sh = tabFor(t);
    const seen = existingUids(sh);
    const fresh = byTab[t].filter(function (r) {
      if (r.uid && seen[r.uid]) { skipped++; return false; }
      return true;
    });
    if (!fresh.length) return;
    const data = fresh.map(rowFrom);
    writeRows(sh, data);
    saved += data.length;
    fresh.forEach(function (r) { if (r.uid) savedUids.push(r.uid); });
  });
  return { ok: true, saved: saved, skipped: skipped, uids: savedUids };
}

/** อ่านข้อมูลกลับ — ใช้ตอนเปิด iDash เครื่องใหม่ หรือหลังล้าง cache
 *  ?action=read&station=เคี่ยว&limit=500   (ไม่ใส่ station = ทุกแท็บ) */
function readRows(p) {
  const limit = Math.min(parseInt(p.limit || '1000', 10) || 1000, 5000);
  const tabs = p.station ? [String(p.station)] : KNOWN_TABS;
  const out = [];
  tabs.forEach(function (name) {
    const sh = book().getSheetByName(name);
    if (!sh) return;
    const n = sh.getLastRow();
    if (n < 2) return;
    const take = Math.min(n - 1, limit);
    const vals = sh.getRange(n - take + 1, 1, take, HEADERS.length).getValues();
    // แถวเก่าที่เขียนก่อนล็อกรูปแบบอาจกลายเป็น Date object — แปลงกลับเป็นข้อความให้อ่านได้
    const txt = function (x) { return (x instanceof Date) ? Utilities.formatDate(x, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : x; };
    vals.forEach(function (v) {
      out.push({
        uid: txt(v[0]), date: txt(v[1]), shift: txt(v[2]), time: txt(v[3]), station: txt(v[4]),
        kpiId: txt(v[5]), kpiName: txt(v[6]), value: v[7], unit: txt(v[8]),
        target: txt(v[9]), status: txt(v[10]), by: txt(v[11]), iso: txt(v[12])
      });
    });
  });
  return { ok: true, count: out.length, rows: out };
}

/* ─────────────── ทดสอบจากใน editor ───────────────
 * เลือกฟังก์ชัน testWrite แล้วกด Run เพื่อเช็คว่าเขียนชีตได้จริง
 * (ครั้งแรกจะขอสิทธิ์เข้าถึง Spreadsheet — กด Allow)
 */
function testWrite() {
  const res = appendRow({
    uid: 'TEST-' + Date.now(),
    date: '04/08/2569', shift: 'กะ A', time: '09:30',
    station: 'เคี่ยว', kpiId: 'P_VC_TOUT',
    kpiName: 'อุณหภูมิ C-Mass ออกจากรางกวนตั้ง',
    value: 41.5, unit: '°C', target: '≤ 40.0 °C',
    status: 'เฝ้าระวัง', by: 'ทดสอบระบบ', iso: new Date().toISOString()
  });
  Logger.log(JSON.stringify(res));
}

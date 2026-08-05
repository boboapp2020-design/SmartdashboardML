/**
 * ═══════════════════════════════════════════════════════════════════
 *  ML Dashboard — Cache Booster  (ตัวเร่งความเร็ว endpoint)
 *  ทำให้ /exec ตอบภายใน ~1–2 วิ แทน 5–47 วิ โดยไม่ต้องแก้โค้ดเดิมเลย
 *
 *  หลักการ: โค้ดเดิมอ่านชีต + สร้าง JSON ใหม่ทุกครั้งที่มีคนเปิด (ยิ่งฤดู
 *  เดินไป ชีตยิ่งโต ยิ่งช้า) → เก็บผลลัพธ์ไว้ใน CacheService 10 นาที
 *  คนแรกของรอบเท่านั้นที่รอ ที่เหลือได้ของจาก cache ทันที
 *  (payload ~400KB เกินลิมิต 100KB/คีย์ของ Google จึงต้องหั่นท่อนให้)
 *
 *  วิธีติดตั้ง (3 ขั้น · ไม่แตะโค้ดเดิม)
 *  ─────────────────────────────────────────────────────────────────
 *  1) ในโปรเจกต์ Apps Script ของ ML Dashboard:
 *     เปลี่ยนชื่อฟังก์ชัน doGet เดิม → doGet_ORIG   (แค่เปลี่ยนชื่อ)
 *  2) สร้างไฟล์ใหม่ (File → New → Script) แล้ววางไฟล์นี้ทั้งหมด
 *  3) Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 *     (URL /exec เดิม ไม่เปลี่ยน)
 *
 *  แนะนำเพิ่ม (ทำครั้งเดียว — ทำให้ "ทุกคน" เร็วเสมอแม้เป็นคนแรก):
 *     Triggers (รูปนาฬิกา) → Add Trigger → เลือกฟังก์ชัน warmCache
 *     → Time-driven → Minutes timer → Every 10 minutes → Save
 *
 *  หลังอัพไฟล์ Excel ใหม่ อยากให้ข้อมูลขึ้นทันทีไม่รอ 10 นาที:
 *     เปิด  <URL>/exec?fresh=1  หนึ่งครั้ง (บังคับสร้างใหม่ + อัด cache)
 * ═══════════════════════════════════════════════════════════════════
 */

var CB_KEY  = 'ml_payload';   // ชื่อคีย์ใน cache
var CB_TTL  = 600;            // อายุ cache (วินาที) = 10 นาที
var CB_CHUNK= 90000;          // หั่นท่อนละ ~90KB (ลิมิต Google 100KB/คีย์)

function doGet(e) {
  var fresh = e && e.parameter && e.parameter.fresh;
  if (!fresh) {
    var hit = cbGet_();
    if (hit) return ContentService.createTextOutput(hit)
                    .setMimeType(ContentService.MimeType.JSON);
  }
  /* cache ว่าง/หมดอายุ/สั่ง fresh → เรียกโค้ดเดิมสร้างของจริง แล้วเก็บไว้ให้คนถัดไป */
  var out  = doGet_ORIG(e);
  var json = out.getContent();
  if (json && json.charAt(0) === '{') cbPut_(json);
  return ContentService.createTextOutput(json)
          .setMimeType(ContentService.MimeType.JSON);
}

/* ให้ time-trigger เรียกทุก 10 นาที — cache อุ่นตลอด ไม่มีใครต้องเป็น "คนแรกที่รอ" */
function warmCache() {
  var json = doGet_ORIG({parameter:{}}).getContent();
  if (json && json.charAt(0) === '{') cbPut_(json);
}

/* ── เก็บ/อ่านแบบหั่นท่อน (รองรับ payload ใหญ่กว่า 100KB) ── */
function cbPut_(json) {
  var c = CacheService.getScriptCache(), parts = {}, n = 0;
  for (var i = 0; i < json.length; i += CB_CHUNK)
    parts[CB_KEY + '_' + (n++)] = json.substr(i, CB_CHUNK);
  parts[CB_KEY + '_n'] = String(n);
  c.putAll(parts, CB_TTL);
}
function cbGet_() {
  var c = CacheService.getScriptCache();
  var n = c.get(CB_KEY + '_n');
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < +n; i++) keys.push(CB_KEY + '_' + i);
  var got = c.getAll(keys), out = '';
  for (var j = 0; j < +n; j++) {
    var p = got[CB_KEY + '_' + j];
    if (p == null) return null;      // ท่อนหายบางส่วน = ใช้ไม่ได้ ให้สร้างใหม่
    out += p;
  }
  return out;
}

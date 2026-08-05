/**
 * ═══════════════════════════════════════════════════════════════════
 *  ML Dashboard — Cache Booster + Slim  (ตัวเร่งความเร็ว endpoint)
 *
 *  ทำ 2 อย่างพร้อมกัน:
 *   ① CACHE  — เก็บผลลัพธ์ไว้ 10 นาที ไม่ต้องอ่านชีตใหม่ทุกครั้ง
 *   ② SLIM   — ตัดฟิลด์ที่แดชบอร์ดไม่ได้ใช้ออก (1,137 → 458 ฟิลด์)
 *              payload 733KB → ~290KB ทำให้โหลดเร็วขึ้นอีกเท่าตัว
 *  ทั้งหมดนี้ไม่ต้องแก้โค้ดเดิมแม้แต่บรรทัดเดียว
 *
 *  วิธีติดตั้ง (3 ขั้น)
 *  ─────────────────────────────────────────────────────────────────
 *  1) ในโปรเจกต์ Apps Script ของ ML Dashboard:
 *     เปลี่ยนชื่อฟังก์ชัน doGet เดิม → doGet_ORIG   (แค่เปลี่ยนชื่อ)
 *  2) สร้างไฟล์ใหม่ (File → New → Script) แล้ววางไฟล์นี้ทั้งหมด
 *  3) Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 *     (URL /exec เดิม ไม่เปลี่ยน)
 *
 *  ตั้ง Trigger ให้ cache อุ่นตลอด (สำคัญมาก — คนแรกจะได้ไม่ต้องรอ):
 *     Triggers (รูปนาฬิกา) → Add Trigger → ฟังก์ชัน warmCache
 *     → Time-driven → Minutes timer → Every 10 minutes → Save
 *
 *  พารามิเตอร์ที่รองรับ:
 *     ?fresh=1   บังคับสร้างใหม่ (ใช้หลังอัพไฟล์ Excel จะได้เห็นทันที)
 *     ?full=1    ส่งข้อมูลครบทุกฟิลด์ (ไม่ตัด) เผื่อเครื่องมืออื่นต้องใช้
 * ═══════════════════════════════════════════════════════════════════
 */

var CB_KEY   = 'ml_slim';
var CB_TTL   = 600;      // อายุ cache (วินาที) = 10 นาที
var CB_CHUNK = 90000;    // หั่นท่อนละ ~90KB (ลิมิต Google 100KB/คีย์)

/* ชื่อฟิลด์ฐานที่แดชบอร์ดใช้จริง — ระบบจะเก็บ <ชื่อ>_today/_todate/_week/_period/_target ให้อัตโนมัติ
   ★ ถ้าเพิ่ม KPI ใหม่ในแดชบอร์ดแล้วค่าไม่ขึ้น ให้เติมชื่อฐานของฟิลด์นั้นในลิสต์นี้ */
var CB_KEEP = ['aseed_vol','avgsteam','bhr','bm_brix','bm_op','bm_vol','bmol1_xtal','boil','boiler',
'boilhouse','bseed_vol','bsugar_pol','burnt','cane','caust','ccs','cent','cm_brix','cm_op','cm_vol',
'cmol1_xtal','cseed_vol','csugar_pol','dcrm_brix','dcrm_cycle','dcrm_op','dcrm_strike','dcrm_vol',
'dcrmol1_pdrop','dcrmol1_xtal','dcrmol2_pdrop','dcrmol2_prise','dcrmol2_xtal','edl','evap1','evap2',
'evbrix1','evbrix2','evbrix3','evbrix4','evbrix5','evph1','evph2','evph3','evph4','evph5','extpol',
'fiber','fm_ash','fm_pctcane','fm_purity','fm_rs','fm_tempoutlet','fm_tsai','fmext','imbfiber','kb',
'kgbagkw','kgsteambag','kp','kwhsugar','loss','loss_bag','loss_fc','loss_fm','loss_undet','mccn','me',
'mill','milling','moistbag','netkwh','nocane','oxy','pan','pcttelq','ph_dcrmol','pol','polbag','polysrb',
'power','prepidx','puritydrop','recov','sjm','stopme','stopprod','sum','trash','vhp_colour','vhp_moist',
'vhp_pol','vhpm_brix','vhpm_op','vhpm_strike','vhpm_vol','vhpmol1_pdrop','vhpmol1_xtal','vhpmol2_pdrop',
'vhpmol2_prise',
/* สถานีปั่นแยก — ตามไฮไลท์ในไฟล์ Centrifugal.xlsx */
'pct96','fm','fm_brix','vhp','bmol2_prise','cmol3_brix','cmol3_purity',
'bmagma_brix','bmagma_purity','bsugar_colour','csugar_colour',
/* เคมีน้ำจากรายงานน้ำ (บล็อก water) */
'ws_ph_fw1','ws_tds_fw1','ws_ph_bw1','ws_tds_bw1',
/* ฟิลด์ระบบ */
'date','fileDate','reportNo','filename'];

var CB_SUF = ['','_today','_todate','_week','_period','_target'];

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.full) return doGet_ORIG(e);            // อยากได้ครบทุกฟิลด์

  if (!p.fresh) {
    var hit = cbGet_();
    if (hit) return out_(hit);
  }
  var json = JSON.stringify(slim_(JSON.parse(doGet_ORIG(e).getContent())));
  cbPut_(json);
  return out_(json);
}

/* ให้ time-trigger เรียกทุก 10 นาที — cache อุ่นตลอด ไม่มีใครต้องเป็น "คนแรกที่รอ" */
function warmCache() {
  var json = JSON.stringify(slim_(JSON.parse(doGet_ORIG({parameter:{}}).getContent())));
  cbPut_(json);
}

/* ── ตัดเฉพาะฟิลด์ที่ใช้ ── */
function slim_(o) {
  if (!o || typeof o !== 'object') return o;
  var keep = {};
  for (var i = 0; i < CB_KEEP.length; i++)
    for (var j = 0; j < CB_SUF.length; j++) keep[CB_KEEP[i] + CB_SUF[j]] = 1;

  function trimRows(arr) {
    if (!arr || !arr.length) return arr;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i], n = {};
      for (var k in r) if (keep[k]) n[k] = r[k];
      out.push(n);
    }
    return out;
  }
  var res = {};
  for (var k in o) res[k] = o[k];          // คงโครงเดิม (success, stop, ฯลฯ)
  if (o.daily) res.daily = trimRows(o.daily);
  if (o.water) res.water = trimRows(o.water);
  return res;
}

function out_(json) {
  return ContentService.createTextOutput(json)
         .setMimeType(ContentService.MimeType.JSON);
}

/* ── เก็บ/อ่านแบบหั่นท่อน (รองรับ payload ใหญ่กว่า 100KB) ── */
function cbPut_(json) {
  if (!json || json.charAt(0) !== '{') return;
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
  var got = c.getAll(keys), s = '';
  for (var j = 0; j < +n; j++) {
    var part = got[CB_KEY + '_' + j];
    if (part == null) return null;          // ท่อนหาย = ใช้ไม่ได้ ให้สร้างใหม่
    s += part;
  }
  return s;
}

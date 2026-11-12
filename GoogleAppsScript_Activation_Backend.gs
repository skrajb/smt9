/**
 * ============================================================
 *  Smartech Typing Tutor — Activation Backend (Licenses sheet)
 *  v2: supports ANY number of test types, each with its own codes
 * ------------------------------------------------------------
 *  Paste this WHOLE file into the Apps Script editor bound to
 *  your LICENSES spreadsheet, replacing the old doGet(), then
 *  re-deploy (Deploy ▸ Manage deployments ▸ Edit ▸ New version)
 *  so the change goes live at the SAME /exec URL.
 *
 *  TWO KINDS OF CODES
 *  ------------------
 *  1) Course codes ENG / PBI / HIN  → unchanged. They still live
 *     on the "Licenses" tab in the old column layout:
 *       D/E/F = ENG code/status/device   N = ENG expiry
 *       G/H/I = PBI code/status/device   O = PBI expiry
 *       J/K/L = HIN code/status/device   P = HIN expiry
 *       M     = last activity
 *
 *  2) Test-type codes (NEW) → one row per code on a tab named
 *     "TestAccess" (created automatically on first use):
 *
 *       A Type | B Code | C Status | D Device | E Expiry | F Days | G Student / Note | H Last Activity
 *
 *     - Type  = the code TYPE you wrote after "code:" in the
 *               "### TEST" block of the GitHub file (e.g. CHSL,
 *               PSSSB, TEST1). Any name works; no script change
 *               and no new columns are needed for a new test.
 *     - Code  = what the student types.
 *     - Status: leave empty / NEW for a fresh code. The script
 *               sets USED on first activation. Type BLOCKED to
 *               revoke a code at any time (the app notices on
 *               its next check — it re-checks within about a minute while the student is online).
 *     - Days  = OPTIONAL validity for this one code (e.g. 30).
 *               Empty = DEFAULT_DAYS below.
 *     - Expiry= filled automatically on activation. Edit it by
 *               hand to extend / shorten a code — it is read
 *               live on every check.
 *
 *     Use the menu  Smartech ▸ Generate access codes…  to create
 *     a batch of random codes for a test type in one go.
 * ============================================================
 */

var DEFAULT_DAYS = 90;            // validity of a freshly activated code
var TEST_SHEET   = "TestAccess";  // tab used for test-type codes

function out_(text) { return ContentService.createTextOutput(text); }

function doGet(e) {
  var ak = accessKeys_(e); if (ak) return ak;   // single access key (Users tab)
  var p = (e && e.parameter) || {};
  var action = String(p.action || "ACTIVATE").toUpperCase().trim();
  var type   = String(p.type   || "").toUpperCase().trim();
  var code   = String(p.code   || "").toUpperCase().trim();
  var device = String(p.device || "").trim();

  if (!type || !code) return out_("INVALID");

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return out_("BUSY");
  try {
    if (type === "ENG" || type === "PBI" || type === "HIN") {
      return legacyCourse_(action, type, code, device);
    }
    if (!/^[A-Z0-9_\-]{1,30}$/.test(type)) return out_("INVALID");
    return testType_(action, type, code, device);
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 1) ENG / PBI / HIN on the "Licenses" tab (as before) ---------- */
function legacyCourse_(action, type, code, device) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Licenses");
  if (!sheet) return out_("INVALID");
  var data = sheet.getDataRange().getValues();

  var map = {
    ENG: { code: 4,  status: 5,  device: 6,  expiry: 14 },
    PBI: { code: 7,  status: 8,  device: 9,  expiry: 15 },
    HIN: { code: 10, status: 11, device: 12, expiry: 16 }
  };
  var c = map[type];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][c.code - 1]).toUpperCase().trim() !== code) continue;

    var status = String(data[i][c.status - 1]).toUpperCase().trim();
    var savedDevice = String(data[i][c.device - 1]).trim();
    var expiryDate = toDate_(data[i][c.expiry - 1]);

    if (status === "BLOCKED") return out_("BLOCKED");

    if (action === "ACTIVATE") {
      if (status === "" || status === "NEW") {
        var newExpiry = addDays_(new Date(), DEFAULT_DAYS);
        sheet.getRange(i + 1, c.status).setValue("USED");
        sheet.getRange(i + 1, c.device).setValue(device);
        sheet.getRange(i + 1, c.expiry).setValue(newExpiry);
        sheet.getRange(i + 1, 13).setValue(new Date());
        return out_("VALID|" + newExpiry.getTime());
      }
      if (status === "USED") {
        if (savedDevice !== device) return out_("USED");
        if (expiryDate && new Date() > expiryDate) return out_("EXPIRED");
        sheet.getRange(i + 1, 13).setValue(new Date());
        return out_("VALID|" + (expiryDate ? expiryDate.getTime() : ""));
      }
      return out_("USED");
    }

    if (action === "DEACTIVATE") {
      if (savedDevice !== device) return out_("DEVICE_MISMATCH");
      sheet.getRange(i + 1, c.status).setValue("NEW");
      sheet.getRange(i + 1, c.device).clearContent();
      sheet.getRange(i + 1, c.expiry).clearContent();
      return out_("OK");
    }
  }
  return out_("INVALID");
}

/* ---------- 2) any test type on the "TestAccess" tab ---------- */
function getTestSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TEST_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TEST_SHEET);
    sh.appendRow(["Type", "Code", "Status", "Device", "Expiry", "Days", "Student / Note", "Last Activity"]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 8).setFontWeight("bold");
  }
  return sh;
}

function testType_(action, type, code, device) {
  var sheet = getTestSheet_();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase().trim() !== type) continue;
    if (String(data[i][1]).toUpperCase().trim() !== code) continue;

    var row = i + 1;
    var status = String(data[i][2]).toUpperCase().trim();
    var savedDevice = String(data[i][3]).trim();
    var expiryDate = toDate_(data[i][4]);
    var days = Number(data[i][5]) || DEFAULT_DAYS;

    if (status === "BLOCKED") return out_("BLOCKED");

    if (action === "ACTIVATE") {
      if (status === "" || status === "NEW") {
        var newExpiry = addDays_(new Date(), days);
        sheet.getRange(row, 3).setValue("USED");
        sheet.getRange(row, 4).setValue(device);
        sheet.getRange(row, 5).setValue(newExpiry);
        sheet.getRange(row, 8).setValue(new Date());
        return out_("VALID|" + newExpiry.getTime());
      }
      if (status === "USED") {
        if (savedDevice !== device) return out_("USED");
        if (expiryDate && new Date() > expiryDate) return out_("EXPIRED");
        sheet.getRange(row, 8).setValue(new Date());
        return out_("VALID|" + (expiryDate ? expiryDate.getTime() : ""));
      }
      return out_("USED");
    }

    if (action === "DEACTIVATE") {
      if (savedDevice !== device) return out_("DEVICE_MISMATCH");
      sheet.getRange(row, 3).setValue("NEW");
      sheet.getRange(row, 4).clearContent();
      sheet.getRange(row, 5).clearContent();
      return out_("OK");
    }
  }
  return out_("INVALID");
}

/* ---------- helpers ---------- */
function toDate_(v) {
  if (v instanceof Date) return v;
  if (!v) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function addDays_(d, n) {
  var r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

/* ============================================================
 *  Menu: Smartech ▸ Generate access codes…
 *  Creates N random codes for one test type on the TestAccess tab.
 * ============================================================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Smartech")
    .addItem("Generate access codes…", "generateCodesDialog")
    .addItem("Set admin password…", "setAdminPasswordDialog")
    .addToUi();
}

function generateCodesDialog() {
  var ui = SpreadsheetApp.getUi();
  var t = ui.prompt("Test type", "Code TYPE exactly as written after \"code:\" in the GitHub file (e.g. CHSL):", ui.ButtonSet.OK_CANCEL);
  if (t.getSelectedButton() !== ui.Button.OK) return;
  var n = ui.prompt("How many codes?", "Number of codes to create (1–500):", ui.ButtonSet.OK_CANCEL);
  if (n.getSelectedButton() !== ui.Button.OK) return;
  var d = ui.prompt("Validity in days", "Days each code stays valid after activation (leave empty for " + DEFAULT_DAYS + "):", ui.ButtonSet.OK_CANCEL);
  if (d.getSelectedButton() !== ui.Button.OK) return;

  var made = generateCodes_(t.getResponseText(), Number(n.getResponseText()), Number(d.getResponseText()) || "");
  ui.alert(made + " code(s) added to the \"" + TEST_SHEET + "\" tab.");
}

function generateCodes_(type, count, days) {
  type = String(type || "").toUpperCase().trim();
  if (!/^[A-Z0-9_\-]{1,30}$/.test(type)) throw new Error("Type may only contain A-Z, 0-9, _ and -");
  count = Math.max(1, Math.min(500, Math.floor(count) || 1));

  var sheet = getTestSheet_();
  var existing = {};
  sheet.getDataRange().getValues().slice(1).forEach(function (r) {
    existing[String(r[0]).toUpperCase().trim() + "|" + String(r[1]).toUpperCase().trim()] = true;
  });

  var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  function part(n) { var s = ""; for (var i = 0; i < n; i++) s += alphabet.charAt(Math.floor(Math.random() * alphabet.length)); return s; }

  var rows = [];
  while (rows.length < count) {
    var code = type + "-" + part(4) + "-" + part(4);
    if (existing[type + "|" + code]) continue;
    existing[type + "|" + code] = true;
    rows.push([type, code, "NEW", "", "", days, "", ""]);
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  return rows.length;
}


/* ============================================================
 *  SINGLE ACCESS KEY  (Users tab + admin.html API)
 *  Key | Name | Ref / Phone | Status | Access | Device | Expiry | Days | Note | Last Activity | Created
 *  Access = ALL  or a list such as  ENG,PBI,CHSL,PHC
 *  Unknown keys fall through to the old ENG/PBI/HIN/TestAccess logic above.
 * ============================================================ */
var USERS_SHEET = 'Users';
var U_HEAD = ['Key', 'Name', 'Ref / Phone', 'Status', 'Access', 'Device', 'Expiry', 'Days', 'Note', 'Last Activity', 'Created'];
var KEY_DAYS = 90; // validity after first activation when "Days" is empty

function usersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(USERS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(USERS_SHEET);
    sh.appendRow(U_HEAD); sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, U_HEAD.length).setFontWeight('bold');
  }
  return sh;
}
function txt_(t) { return ContentService.createTextOutput(t); }
function jsonOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ms_(v) { if (v instanceof Date) return v.getTime(); if (!v) return null; var d = new Date(v); return isNaN(d) ? null : d.getTime(); }

/* ---- student side: called from the top of your existing doGet(e) ---- */
function accessKeys_(e) {
  var p = (e && e.parameter) || {};
  var code = String(p.code || '').toUpperCase().trim(), type = String(p.type || '').toUpperCase().trim();
  var action = String(p.action || 'ACTIVATE').toUpperCase().trim(), device = String(p.device || '').trim();
  if (!code) return null;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return txt_('BUSY');
  try {
    var sh = usersSheet_(), v = sh.getDataRange().getValues(), i;
    for (i = 1; i < v.length; i++) if (String(v[i][0]).toUpperCase().trim() === code) break;
    if (i >= v.length) return null;                       // not a single key -> old logic
    var r = v[i], row = i + 1, status = String(r[3]).toUpperCase().trim(), saved = String(r[5]).trim();
    var access = String(r[4]).toUpperCase().split(/[\s,;]+/).filter(String);
    var exp = ms_(r[6]), now = Date.now();

    if (status === 'BLOCKED') return txt_('BLOCKED');
    if (action === 'DEACTIVATE') {
      if (saved !== device) return txt_('DEVICE_MISMATCH');
      sh.getRange(row, 6).clearContent(); return txt_('OK');
    }
    if (type && access.indexOf('ALL') < 0 && access.indexOf(type) < 0) return txt_('NOACCESS');
    if (saved && saved !== device) return txt_('USED');
    if (exp && now > exp) return txt_('EXPIRED');
    if (!saved) {                                          // first use (or after "reset device")
      if (!exp) exp = now + (Number(r[7]) || KEY_DAYS) * 864e5;
      sh.getRange(row, 4, 1, 4).setValues([['ACTIVE', r[4], device, new Date(exp)]]);
    }
    sh.getRange(row, 10).setValue(new Date());
    return txt_('VALID|' + exp + '|' + access.join(','));
  } finally { lock.releaseLock(); }
}

/* ---- admin side: used by admin.html (POST, password in Script properties) ---- */
function doPost(e) {
  var b; try { b = JSON.parse(e.postData.contents); } catch (x) { return jsonOut_({ ok: false, error: 'Bad request' }); }
  var pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!pw) return jsonOut_({ ok: false, error: 'Add ADMIN_PASSWORD in Project Settings > Script properties' });
  if (String(b.admin) !== pw) return jsonOut_({ ok: false, error: 'Wrong admin password' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return jsonOut_({ ok: false, error: 'Server busy, try again' });
  try {
    var sh = usersSheet_(), v = sh.getDataRange().getValues();
    var find = function (k) {
      for (var i = 1; i < v.length; i++) if (String(v[i][0]).toUpperCase() === String(k).toUpperCase()) return i + 1;
      return 0;
    };
    if (b.op === 'list') {
      return jsonOut_({ ok: true, users: v.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
        return { key: r[0], name: r[1], ref: r[2], status: r[3], access: r[4], device: !!String(r[5]).trim(),
                 expiry: ms_(r[6]), days: r[7], note: r[8], last: ms_(r[9]), created: ms_(r[10]) };
      }) });
    }
    if (b.op === 'save') {
      var u = b.user || {}, key = String(u.key || '').toUpperCase().trim(), row = key ? find(key) : 0;
      if (!key) {
        var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', g = function () { var s = ''; for (var i = 0; i < 4; i++) s += A.charAt(Math.floor(Math.random() * A.length)); return s; };
        do { key = 'SMT-' + g() + '-' + g() + '-' + g(); } while (find(key));
      }
      var old = row ? v[row - 1] : [], device = old[5] || '';
      var access = String(u.access || 'ALL').toUpperCase().replace(/\s+/g, '');
      var vals = [key, u.name || '', u.ref || '', u.blocked ? 'BLOCKED' : (device ? 'ACTIVE' : 'NEW'), access, device,
                  u.expiry ? new Date(u.expiry + 'T23:59:59') : '', Number(u.days) || '', u.note || '', old[9] || '', old[10] || new Date()];
      sh.getRange(row || sh.getLastRow() + 1, 1, 1, vals.length).setValues([vals]);
      return jsonOut_({ ok: true, key: key });
    }
    var rw = find(b.key);
    if (!rw) return jsonOut_({ ok: false, error: 'Key not found' });
    if (b.op === 'reset') { sh.getRange(rw, 6).clearContent(); return jsonOut_({ ok: true }); }
    if (b.op === 'delete') { sh.deleteRow(rw); return jsonOut_({ ok: true }); }
    return jsonOut_({ ok: false, error: 'Unknown operation' });
  } finally { lock.releaseLock(); }
}

function setAdminPasswordDialog() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt("Admin password", "Password for admin.html (at least 6 characters):", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var pw = r.getResponseText().trim();
  if (pw.length < 6) { ui.alert("Too short - use at least 6 characters."); return; }
  PropertiesService.getScriptProperties().setProperty("ADMIN_PASSWORD", pw);
  ui.alert("Admin password saved.");
}

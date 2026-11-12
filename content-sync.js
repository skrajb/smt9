/* ============================================================
   Smartech Typing Tutor — Content sync (content-sync.js)
   ------------------------------------------------------------
   Lessons, Speed-Test words and Study Material are read from plain
   text files on GitHub ("raw" files), so they can be changed at any
   time WITHOUT releasing a new version of the app:

     lessons.txt      typing lessons of the English / Punjabi / Hindi courses
     speedwords.txt   word lists of the Speed Test (English / Punjabi / Hindi)
     materials.txt    Typing Books & Study Material, Video Lessons

   The three files live in the SAME GitHub folder as the exercises
   file (the one set in exercises.js). The last good download is kept
   on the computer, and the lists built into the app are used when
   nothing has been downloaded yet, so everything still works offline.
   Starting a page re-checks GitHub in the background (at most once
   every 5 minutes); the "Update" button checks right away.

   ------------------------------------------------------------
   speedwords.txt
   ------------------------------------------------------------
   One "### Language" header per language, then the words separated by
   spaces (line breaks are fine, so the list can be wrapped). A word can
   be written more than once on purpose: it then comes up more often.

       ### English
       has had lad add dada ask alfa ...

       ### Punjabi
       ਪਰ ਕਰ ਤਕ ਚੋਰ ...

       ### Hindi
       शाही काश कोशिश ...

   ------------------------------------------------------------
   lessons.txt
   ------------------------------------------------------------
   One block per lesson, in the order they should appear. The header is
   "### <Language> <lesson title>"; the numbers 1, 2, 3 ... are added
   automatically. An optional "count:" line says how many words a
   practice contains (default 100). The rest is the word list.

       ### English | Home Row
       count: 120
       all ask has dad sad had lad lag add ...

       ### Punjabi | ਹੋਮ ਲਾਈਨ
       ਪਰ ਕਰ ਤਕ ...

   A language that is missing from the file keeps the built-in lessons.

   ------------------------------------------------------------
   materials.txt
   ------------------------------------------------------------
   "### Book | Title" or "### Video | Title" followed by key: value lines.
   Only the url line is required.

       ### Book | Typing Basics for Exams
       url: https://example.com/typing-basics.pdf
       desc: Home row to speed building, with practice tables.
       language: English

       ### Video | Home Row in 10 Minutes
       url: https://www.youtube.com/watch?v=...
       desc: Recorded class
       language: Punjabi

   Text above the first ### line is ignored (use it for notes).

   ------------------------------------------------------------
   pricing.txt   (Dashboard > Buy / Renew)
   ------------------------------------------------------------
   Settings first, then one "### Course name" block per course.

       currency: Rs.
       offer: Special offer till 31 March
       step: Pay the fee at the institute.
       step: You receive an activation code.
       contact: Smartech Education Computer Institute
       email: smartecheducation@gmail.com
       phone: 98xxxxxxxx

       ### English Typing Course
       code: ENG
       buy: 1,500
       renew: 1,000
       validity: 1 Year
       note: Basic to advanced + speed test

   If the file is missing the prices written in pricing.js are shown.
   ============================================================ */
(function (global) {
  "use strict";

  var FALLBACK_BASE = "https://raw.githubusercontent.com/skrajb/smt5/refs/heads/main/";
  var FILES = { lessons: "lessons.txt", words: "speedwords.txt", materials: "materials.txt", pricing: "pricing.txt" };
  var NAMES = { lessons: "Lessons", words: "Speed-test words", materials: "Study material", pricing: "Buy / Renew prices", exercises: "Exercises & tests" };
  var KINDS = ["lessons", "words", "materials", "pricing"];
  var LANGS = ["English", "Punjabi", "Hindi"];
  var TTL_MS = 5 * 60 * 1000;       // re-download at most this often while students move between pages
  var MIN_WORDS = 5;                // a speed-test list shorter than this is ignored

  var KEY_BASE = "smartechContentBase";
  var EX_URL_KEY = "smartechExercisesUrl";
  var EX_AT_KEY = "smartechExercisesFetchedAt";

  var mem = {}, inflight = {}, lastError = {}, listeners = [];

  /* ---------- storage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /* ---------- where the files are ---------- */
  function folderOf(u) {
    u = String(u || "").trim().replace(/[?#].*$/, "");
    u = u.replace(/[^\/]*\.[A-Za-z0-9]+$/, "");               // a pasted file URL -> its folder
    return u && !/\/$/.test(u) ? u + "/" : u;
  }
  // 1) a folder typed in the Manage panel, 2) the folder of the exercises file, 3) the built-in default
  function baseUrl() {
    return folderOf(lsGet(KEY_BASE)) || folderOf(lsGet(EX_URL_KEY)) || FALLBACK_BASE;
  }
  function sourceUrl(kind) {
    return String(lsGet("smartechContentUrl_" + kind) || "").trim() || baseUrl() + FILES[kind];
  }
  function setBase(url) {
    var f = folderOf(url);
    if (f && f !== FALLBACK_BASE) lsSet(KEY_BASE, f); else lsDel(KEY_BASE);
  }
  function setSource(kind, url) {
    url = String(url || "").trim();
    if (url) lsSet("smartechContentUrl_" + kind, url); else lsDel("smartechContentUrl_" + kind);
  }

  /* ---------- parsing ---------- */
  function norm(raw) { return String(raw || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n"); }
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }

  function blocks(text) {
    var re = /^###[ \t]*(.*)$/gm, heads = [], m;
    while ((m = re.exec(text))) heads.push({ header: m[1].trim(), start: m.index, bodyStart: re.lastIndex });
    return heads.map(function (h, i) {
      var end = i + 1 < heads.length ? heads[i + 1].start : text.length;
      return { header: h.header, body: text.slice(h.bodyStart, end) };
    });
  }
  function langOf(header) {
    var m = /^\s*(english|punjabi|hindi)\b/i.exec(header);
    return m ? cap(m[1]) : "";
  }
  // Words are separated by spaces / line breaks. A comma after a word is allowed ("all, ask, has").
  function wordsOf(body) {
    var out = [];
    String(body || "").split(/\s+/).forEach(function (tok) {
      if (tok.length > 1) tok = tok.replace(/,$/, "");
      if (tok) out.push(tok);
    });
    return out;
  }

  function parseWords(raw) {
    var out = {}, n = 0;
    blocks(norm(raw)).forEach(function (b) {
      var L = langOf(b.header);
      if (!L) return;
      var w = wordsOf(b.body);
      if (w.length) out[L] = (out[L] || []).concat(w);     // "### English" may appear several times
    });
    LANGS.forEach(function (L) {
      if (out[L] && out[L].length < MIN_WORDS) delete out[L];
      if (out[L]) n++;
    });
    if (!n) throw new Error("no word lists found in the file");
    return out;
  }

  function parseLessons(raw) {
    var out = {}, n = 0;
    LANGS.forEach(function (L) { out[L] = []; });
    blocks(norm(raw)).forEach(function (b) {
      var L = langOf(b.header);
      if (!L) return;
      var title = b.header
        .replace(/^\s*(english|punjabi|hindi)\b/i, "")
        .replace(/^[\s|:\-–—.]+/, "")
        .replace(/^lesson\b\s*\d*\s*[|:\-–—.]*\s*/i, "")
        .replace(/^\d+\s*(?:[.):|]|\s[-–—])\s*/, "")
        .trim();
      var count = 0, keep = [];
      b.body.split("\n").forEach(function (line) {
        var m = /^[ \t]*(?:count|words-per-test|test-words)[ \t]*[:=][ \t]*(\d+)[ \t]*$/i.exec(line);
        if (m && !count) count = Math.max(10, Math.min(500, parseInt(m[1], 10)));
        else keep.push(line);
      });
      var words = wordsOf(keep.join("\n"));
      if (words.length < 3) return;                       // not a usable lesson
      out[L].push({ title: title, words: words, count: count || 100 });
      n++;
    });
    if (!n) throw new Error("no lessons found in the file");
    return out;
  }

  function parseMaterials(raw) {
    var out = [];
    blocks(norm(raw)).forEach(function (b) {
      var m = /^\s*([A-Za-z ]+?)\s*[|:\-–—]\s*(.+)$/.exec(b.header);
      var kindWord = m ? m[1] : b.header, title = m ? m[2].trim() : b.header.trim();
      var f = {};
      b.body.split("\n").forEach(function (line) {
        var kv = /^[ \t]*([A-Za-z][A-Za-z \-_]*?)[ \t]*[:=][ \t]*(.*?)[ \t]*$/.exec(line);
        if (kv) f[kv[1].toLowerCase().replace(/[ _]+/g, "-")] = kv[2];
      });
      var url = String(f.url || f.link || "").trim();
      if (!/^https?:\/\//i.test(url) || !title) return;
      out.push({
        type: /video|class|lecture|recording|lesson/i.test(kindWord) ? "video" : "book",
        title: title,
        url: url,
        desc: f.desc || f.description || "",
        lang: f.language || f.lang || "",
        tag: f.tag || f.label || ""
      });
    });
    return out;      // an empty file is fine: it just means nothing is listed yet
  }

  /* pricing.txt: settings above the first ###, then one "### Course name" block per course.
       currency: Rs.            offer: text            email: a@b.com     phone: 98xxxxxxxx
       contact: institute name  step: one line (repeat "step:" for each step of "how to buy")
       ### English Typing Course
       code: ENG   buy: 1500   renew: 1000   validity: 1 Year   note: optional line            */
  function kvLines(body) {
    var o = [], kv;
    String(body || "").split("\n").forEach(function (line) {
      kv = /^[ \t]*([A-Za-z][A-Za-z \-_]*?)[ \t]*[:=][ \t]*(.*?)[ \t]*$/.exec(line);
      if (kv) o.push([kv[1].toLowerCase().replace(/[ _]+/g, "-"), kv[2]]);
    });
    return o;
  }
  function parsePricing(raw) {
    var text = norm(raw), cut = text.search(/^###/m), head = cut < 0 ? text : text.slice(0, cut);
    var out = { currency: "", offer: "", how: [], contact: { text: "", email: "", phone: "" }, courses: [] };
    kvLines(head).forEach(function (p) {
      var k = p[0], v = p[1];
      if (k === "currency") out.currency = v;
      else if (k === "offer") out.offer = v;
      else if (k === "step" || k === "how") { if (v) out.how.push(v); }
      else if (k === "contact" || k === "institute") out.contact.text = v;
      else if (k === "email") out.contact.email = v;
      else if (k === "phone" || k === "mobile" || k === "whatsapp") out.contact.phone = v;
    });
    blocks(text).forEach(function (b) {
      var f = {};
      kvLines(b.body).forEach(function (p) { f[p[0]] = p[1]; });
      var name = b.header.trim();
      if (!name || (f.buy == null && f.renew == null)) return;      // a block needs at least a price
      out.courses.push({ code: String(f.code || "").toUpperCase(), name: name, note: f.note || f.desc || "",
        buy: f.buy == null ? "-" : f.buy, renew: f.renew == null ? "-" : f.renew, validity: f.validity || f.valid || "" });
    });
    if (!out.courses.length) throw new Error("no courses with prices found in the file");
    return out;
  }

  var PARSERS = { lessons: parseLessons, words: parseWords, materials: parseMaterials, pricing: parsePricing };

  /* ---------- cached copies ---------- */
  function readRec(kind) {
    if (mem[kind]) return mem[kind];
    try {
      var r = JSON.parse(lsGet("smartechContent_" + kind));
      if (r && r.data) { mem[kind] = r; return r; }
    } catch (e) { /* ignore */ }
    return null;
  }
  function writeRec(kind, rec) {
    mem[kind] = rec;
    lsSet("smartechContent_" + kind, JSON.stringify(rec));
  }
  function sig(t) {
    var h = 5381;
    for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return t.length + ":" + (h >>> 0).toString(36);
  }

  function notify(kind) {
    listeners.slice().forEach(function (f) { try { f(kind); } catch (e) { console.warn("[content]", e); } });
    try { document.dispatchEvent(new CustomEvent("smartech:content-updated", { detail: { kind: kind } })); } catch (e) { /* ignore */ }
  }

  /* ---------- downloading ---------- */
  // Resolves { kind, ok, changed, cached, error }. Never rejects.
  //   ok      - the file was read (or the saved copy is still fresh)
  //   changed - the content differs from what was saved before
  function refresh(kind, opts) {
    opts = opts || {};
    var url = sourceUrl(kind), rec = readRec(kind);
    var fresh = rec && rec.url === url && Date.now() - rec.at < TTL_MS;
    if (!opts.force && fresh) return Promise.resolve({ kind: kind, ok: true, changed: false, cached: true });
    if (inflight[kind]) return inflight[kind];

    // A forced refresh skips GitHub's own few-minutes cache with a throw-away query value.
    var fetchUrl = opts.force ? url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now() : url;
    inflight[kind] = fetch(fetchUrl, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status === 404 ? "file not found on GitHub (404)" : "HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var data = PARSERS[kind](text);
        var s = sig(text);
        var changed = !rec || rec.sig !== s || rec.url !== url;
        writeRec(kind, { at: Date.now(), url: url, sig: s, data: data });
        delete lastError[kind];
        if (changed) notify(kind);
        return { kind: kind, ok: true, changed: changed };
      })
      .catch(function (err) {
        var msg = (err && err.message) || "failed";
        if (/failed to fetch|networkerror|load failed/i.test(msg)) msg = "no internet connection";
        lastError[kind] = msg;
        console.warn("[content] could not refresh " + kind + " from " + url + ": " + msg);
        return { kind: kind, ok: false, changed: false, error: msg };
      })
      .then(function (r) { inflight[kind] = null; return r; });
    return inflight[kind];
  }

  function refreshExercises(opts) {
    var E = global.SmartechExercises;
    if (!E || !E.refresh) return Promise.resolve({ kind: "exercises", ok: true, changed: false, skipped: true });
    return E.refresh({ force: !!(opts && opts.force) }).then(function (ok) {
      return { kind: "exercises", ok: ok || !(opts && opts.force), changed: !!ok };
    });
  }

  // Every kind at once (used by the Update buttons)
  function refreshAll(opts) {
    return Promise.all(KINDS.map(function (k) { return refresh(k, opts); }).concat([refreshExercises(opts)]));
  }
  // Quietly keep everything fresh while the student is online (no force, honours the 5-minute limit)
  function warm() { return refreshAll({}); }

  /* ---------- what is currently in use ---------- */
  function countOf(kind, data) {
    if (kind === "lessons") return LANGS.reduce(function (n, L) { return n + ((data[L] || []).length); }, 0);
    if (kind === "words") return LANGS.reduce(function (n, L) { return n + ((data[L] || []).length); }, 0);
    if (kind === "pricing") return ((data && data.courses) || []).length;
    return (data || []).length;
  }
  function status(kind) {
    if (kind === "exercises") {
      var E = global.SmartechExercises, at = Number(lsGet(EX_AT_KEY)) || 0;
      return { kind: kind, name: NAMES.exercises, source: at ? "github" : "none", at: at,
               count: E ? E.remoteCount() : 0, url: E ? E.getSourceUrl() : "", error: "" };
    }
    var rec = readRec(kind);
    return { kind: kind, name: NAMES[kind], source: rec ? "github" : "builtin", at: rec ? rec.at : 0,
             count: rec ? countOf(kind, rec.data) : 0, url: sourceUrl(kind), error: lastError[kind] || "" };
  }

  /* ---------- binding to a page ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function swap(target, src) {
    Object.keys(target).forEach(function (k) { delete target[k]; });
    Object.keys(src).forEach(function (k) { target[k] = src[k]; });
  }

  /* Lessons of ONE language for a course page. The page passes the three objects it
     already has (its built-in lessons, labels and word counts) and they are replaced IN
     PLACE by the GitHub lessons when there are any. o = {
       lang, lessons, labels, counts,
       onUpdate()  - re-draw the lesson grid,
       isBusy()    - true while a lesson is open: a new list then waits until the student is back
     } */
  function bindLessons(o) {
    var builtin = { lessons: clone(o.lessons), labels: clone(o.labels), counts: clone(o.counts) };
    var waiting = null;

    function build() {
      var rec = readRec("lessons"), list = rec && rec.data && rec.data[o.lang];
      if (!list || !list.length) return builtin;
      var out = { lessons: {}, labels: {}, counts: {} };
      list.forEach(function (l, i) {
        var k = "lesson" + (i + 1);
        out.lessons[k] = l.words.slice();
        out.labels[k] = (i + 1) + ". " + (l.title || "Lesson " + (i + 1));
        out.counts[k] = l.count || 100;
      });
      return out;
    }
    function put(src) { swap(o.lessons, src.lessons); swap(o.labels, src.labels); swap(o.counts, src.counts); }
    function apply() {
      if (o.isBusy && o.isBusy()) {
        if (!waiting) waiting = setInterval(function () {
          if (!o.isBusy()) { clearInterval(waiting); waiting = null; apply(); }
        }, 1500);
        return;
      }
      put(build());
      if (o.onUpdate) o.onUpdate();
    }

    put(build());                                   // the saved GitHub copy (if any) is used straight away
    listeners.push(function (kind) { if (kind === "lessons") apply(); });
    refresh("lessons");                             // and a newer one is fetched in the background
  }

  /* Speed-test words: window.StWords (from speedtest-words.js) is replaced by the GitHub lists.
     o = { onUpdate() } - called after new words arrived (the page restarts only when idle). */
  function bindWords(o) {
    o = o || {};
    var W = global.StWords = global.StWords || {}, builtin = {};
    LANGS.forEach(function (L) { builtin[L.toLowerCase()] = (W[L.toLowerCase()] || []).slice(); });

    function put() {
      var rec = readRec("words"), d = (rec && rec.data) || {};
      LANGS.forEach(function (L) {
        var k = L.toLowerCase();
        W[k] = (d[L] && d[L].length ? d[L] : builtin[k]).slice();
      });
    }
    put();
    listeners.push(function (kind) { if (kind === "words") { put(); if (o.onUpdate) o.onUpdate(); } });
    refresh("words");
  }

  // Study material / videos. o = { onUpdate() }
  function bindMaterials(o) {
    o = o || {};
    listeners.push(function (kind) { if (kind === "materials" && o.onUpdate) o.onUpdate(); });
    return refresh("materials");
  }
  function materials() {
    var rec = readRec("materials");
    return rec && Array.isArray(rec.data) ? rec.data : [];
  }

  // Buy / Renew prices downloaded from pricing.txt (null = none yet -> the page uses pricing.js)
  function pricing() {
    var rec = readRec("pricing");
    return rec && rec.data && rec.data.courses && rec.data.courses.length ? rec.data : null;
  }

  /* ---------- small "Update" pill shown on the pages ---------- */
  function ago(ms) {
    if (!ms) return "";
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    var d = Math.round(s / 86400);
    return d + (d === 1 ? " day ago" : " days ago");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  var REFRESH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>';

  // opts: { kinds: ["lessons"], label: "Lessons" }
  function mountStatus(el, opts) {
    if (typeof el === "string") el = document.getElementById(el);
    if (!el) return;
    opts = opts || {};
    var kinds = opts.kinds || ["lessons"], label = opts.label || NAMES[kinds[0]] || "Content";
    var note = "", noteTimer = null, busy = false;

    function render() {
      var st = kinds.map(status);
      var git = st.every(function (s) { return s.source === "github"; });
      var newest = Math.min.apply(null, st.map(function (s) { return s.at || 0; }));
      var err = st.map(function (s) { return s.error; }).filter(Boolean)[0];
      var text;
      if (busy) text = "Checking GitHub…";
      else if (note) text = note;
      else if (git) text = esc(label) + " · updated from GitHub " + ago(newest);
      else text = esc(label) + " · built-in list" + (err ? " (" + esc(err) + ")" : "");
      el.className = "sc-pill " + (busy ? "busy" : git ? "ok" : "off");
      el.innerHTML = '<span class="sc-dot" aria-hidden="true"></span><span class="sc-text" aria-live="polite">' + text + "</span>" +
        '<button type="button" class="sc-btn"' + (busy ? " disabled" : "") + ' title="Check GitHub for a newer ' + esc(label.toLowerCase()) + ' list">' + REFRESH_ICON + "Update</button>";
      el.querySelector(".sc-btn").addEventListener("click", go);
    }
    function say(t) {
      note = t; render();
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () { note = ""; render(); }, 4000);
    }
    function go() {
      busy = true; render();
      Promise.all(kinds.map(function (k) { return refresh(k, { force: true }); })).then(function (rs) {
        busy = false;
        var bad = rs.filter(function (r) { return !r.ok; })[0];
        if (bad) say("Could not reach GitHub — " + (bad.error || "using the saved list"));
        else if (rs.some(function (r) { return r.changed; })) say("✓ Updated from GitHub");
        else say("✓ Already up to date");
      });
    }
    listeners.push(function (kind) { if (kinds.indexOf(kind) > -1 && !busy) render(); });
    render();
    // the "x min ago" text stays honest while the page is open
    setInterval(function () { if (!busy && !note) render(); }, 60000);
  }

  global.SmartechContent = {
    LANGS: LANGS, FILES: FILES, NAMES: NAMES, KINDS: KINDS,
    baseUrl: baseUrl, sourceUrl: sourceUrl, setBase: setBase, setSource: setSource,
    refresh: refresh, refreshAll: refreshAll, warm: warm, status: status,
    bindLessons: bindLessons, bindWords: bindWords, bindMaterials: bindMaterials, materials: materials, pricing: pricing,
    mountStatus: mountStatus, ago: ago,
    parse: { words: parseWords, lessons: parseLessons, materials: parseMaterials, pricing: parsePricing }
  };
})(window);

/* ============================================================
   Smartech Typing Tutor - page headings + first-launch name prompt
   (replaces sidebar.js: the sidebar menu is gone from every page)

   - builds one consistent heading (label + title + one-line purpose)
     with a Dashboard button (and a Back button where it makes sense)
     on every inner page. Pages with their own hero (Dashboard,
     Activation, Contact) keep it and add their own Dashboard link.
   - on first launch (or when the name was cleared) asks who is
     typing, so results save under that name from then on.
   ============================================================ */

/* ------------------------------------------------------------
   Page headings
   One consistent heading (eyebrow + title + one-line purpose) is
   built here for every inner page, so no page needs its own
   hand-made header. Pages with their own hero (Dashboard,
   Activation, Contact) are left alone.
   ------------------------------------------------------------ */
const SMARTECH_PAGES = {
  "demo.html":           { eyebrow: "Demo",    title: "5-Minute Demo Test",    sub: "Try a real typing test in English, Punjabi or Hindi. Pick your language and type for 5 minutes." },
  "testexercises.html":  { eyebrow: "Tests",   title: "Test Exercises",        sub: "Choose the exercise you want to practise for this test.", back: ["tests.html", "Test Centre"] },
  "manage.html":         { eyebrow: "Admin",   title: "Manage & Print",        sub: "See every test type and exercise from your GitHub file, and print them on A4 with the Smartech Education header." },
  "tests.html":          { eyebrow: "Tests",   title: "Test Centre",           sub: "Choose an exam-style test. Each test has its own time, pass rule and access code." },
  "engtutor.html":       { eyebrow: "English", title: "English Typing Course", sub: "Learn the keyboard letter by letter, then build speed with tests and exam-style exercises." },
  "pbitutor.html":       { eyebrow: "Punjabi", title: "Punjabi Typing Course", sub: "Learn the Punjabi keyboard letter by letter, then build speed with tests and exam-style exercises." },
  "hinditutor.html":     { eyebrow: "Hindi",   title: "Hindi Typing Course",   sub: "Learn the Hindi keyboard letter by letter, then build speed with tests and exam-style exercises." },
  "speedtest.html":      { eyebrow: "Practice", title: "Speed Test",           sub: "Choose your language and a timer, then type the passage. Your speed and accuracy are shown when time is up." },
  "engexercises.html":   { eyebrow: "English", title: "English Long Paragraph Practice", sub: "Full-length exam-style passages for English typing tests.", back: ["engtutor.html", "English Course"] },
  "pbiexercises.html":   { eyebrow: "Punjabi", title: "Punjabi Long Paragraph Practice", sub: "Full-length exam-style passages for Punjabi typing tests.", back: ["pbitutor.html", "Punjabi Course"] },
  "hindiexercises.html": { eyebrow: "Hindi",   title: "Hindi Long Paragraph Practice",   sub: "Full-length exam-style passages for Hindi typing tests.", back: ["hinditutor.html", "Hindi Course"] },
  "testpage.html":       { eyebrow: "Practice", title: "Typing Practice",       sub: "Type each chunk exactly as shown. Your result is saved automatically when you finish.", dynamicLang: true },
  "paragraph.html":      { eyebrow: "Practice", title: "Long Paragraph Practice", sub: "Type the full passage exactly as shown. Your result is saved automatically when you finish.", dynamicLang: true },
  "resources.html":      { eyebrow: "Library", title: "Books &amp; Video Lessons", sub: "Typing books, study material and recorded classes from your institute. New items appear here as soon as they are added." },
  "progress.html":       { eyebrow: "Results", title: "My Progress",            sub: "Every typing test taken on this device: speeds, accuracy and earned certificates." },
  "guide.html":          { eyebrow: "Help",    title: "User Guide",             sub: "Everything you need to install, activate and get the most out of Smartech Typing Tutor." },
  "disclaimer.html":     { eyebrow: "Legal",   title: "Disclaimer, Privacy &amp; Licence", sub: "How this software may be used, what it stores, and the terms of your licence." }
};

function smartechIsDemoMode() {
  try { return localStorage.getItem("selectedExerciseMode") === "demo"; } catch (e) { return false; }
}

/* The test type (from tests.html) being taken on testpage.html / paragraph.html, if any */
function smartechActiveTestInfo() {
  try {
    const c = JSON.parse(localStorage.getItem("smartechActiveTest"));
    return c && c.id && c.minutes ? c : null;
  } catch (e) { return null; }
}

function smartechRenderPageHeader() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  const meta = SMARTECH_PAGES[page];
  if (!meta || document.querySelector(".app-page-head")) return;
  const main = document.querySelector(".main");
  if (!main) return;

  let title = meta.title;
  let sub = meta.sub;
  let back = meta.back;
  const demoMode = page === "paragraph.html" && smartechIsDemoMode();
  const testInfo = meta.dynamicLang && !demoMode ? smartechActiveTestInfo() : null;
  if (meta.dynamicLang) {
    let lang = "";
    try { lang = localStorage.getItem("selectedExerciseLanguage") || ""; } catch (e) {}
    if (/^(English|Punjabi|Hindi)$/.test(lang)) title = lang + " " + title;
    if (demoMode) {
      title = (/^(English|Punjabi|Hindi)$/.test(lang) ? lang + " " : "") + "Demo Test";
      sub = "5-minute demo test. Type the passage exactly as shown. Your speed and accuracy appear when time is up.";
      back = ["demo.html", "Demo"];
    } else if (testInfo) {
      title = String(testInfo.name).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      sub = "Type the passage exactly as shown. Your result follows this test's pass rule and is saved automatically when you finish.";
      back = ["testexercises.html?id=" + encodeURIComponent(testInfo.id), "Test exercises"];
    }
  }

  const links = [`<a class="aph-link" href="index.html">Dashboard</a>`];
  if (back) links.unshift(`<a class="aph-link" href="${back[0]}">&larr; ${back[1]}</a>`);

  let eyebrowExtra = "";
  if (demoMode) {
    eyebrowExtra = '<span class="aph-pill">Demo &middot; 5 min</span>';
  } else if (testInfo) {
    eyebrowExtra = '<span class="aph-pill">' + testInfo.minutes + ' min</span>';
  } else if (meta.dynamicLang) {
    try {
      const no = localStorage.getItem("selectedExerciseNo");
      const t = localStorage.getItem("selectedExerciseTitle");
      if (no) eyebrowExtra = '<span class="aph-pill" title="' + (t || "").replace(/"/g, "&quot;").replace(/</g, "&lt;") + '">Exercise ' + no + '</span>';
    } catch (e) {}
  }

  const head = document.createElement("header");
  head.className = "app-page-head";
  head.innerHTML = `
    <div class="aph-text">
      <div class="aph-eyebrow">Smartech Typing Tutor &middot; ${meta.eyebrow}</div>
      <h1 class="aph-title">${title}${eyebrowExtra}</h1>
      <p class="aph-sub">${sub}</p>
    </div>
    <div class="aph-actions" role="navigation" aria-label="Page navigation">${links.join("")}</div>`;

  main.insertAdjacentElement("afterbegin", head);

  // Keep the window/tab title in step with the heading
  document.title = title.replace(/&amp;/g, "&") + " | Smartech Typing Tutor";
}

document.addEventListener("DOMContentLoaded", function () {
  smartechRenderPageHeader();

  // First launch (or whenever the name has been cleared): ask who's typing.
  if (window.SmartechProfile) {
    window.SmartechProfile.ensureCaptured();
  }
});

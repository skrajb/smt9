/* ============================================================
   Smartech Typing Tutor — Activation & Licensing
   Handles: server activation/deactivation calls, local license
   storage, and the 3-month activation expiry window.

   IMPORTANT: the source of truth for "when does this code expire"
   is the Expiry Date cell on the Licenses Google Sheet, not this
   file. This file just mirrors whatever the server last told it,
   so the UI can show a countdown without hitting the network on
   every single click. Actual enforcement (can this code still be
   used) always happens server-side in GoogleAppsScript_Activation_Backend.gs.
   ============================================================ */

const WEBAPP="https://script.google.com/macros/s/AKfycbxQ1Gvdw74_7EHTWE8wcNYzKxmmMwKmEHnduiO0qF5BtvLvXyeb3vUsQT24bJDV_kns/exec";

/* localStorage key names for each product. */
const ACTIVATION_META = {
  ENG: { flag: "engActivated", code: "ENG_CODE", expiry: "ENG_EXPIRES_AT" },
  PBI: { flag: "pbiActivated", code: "PBI_CODE", expiry: "PBI_EXPIRES_AT" },
  HIN: { flag: "hinActivated", code: "HIN_CODE", expiry: "HIN_EXPIRES_AT" }
};

/* Test-type access codes (from the "TestAccess" tab of the Licenses sheet) use any
   code TYPE the admin invents, e.g. CHSL or PSSSB. Their local mirror keys are
   generated from the type name; ENG / PBI / HIN keep their original keys. */
function getActivationMeta(type){
  type = String(type || "").toUpperCase().trim();
  if (ACTIVATION_META[type]) return ACTIVATION_META[type];
  if (!/^[A-Z0-9_-]{1,30}$/.test(type)) return null;
  return { flag: "lic_" + type + "_active", code: "lic_" + type + "_code", expiry: "lic_" + type + "_expires" };
}

function rawDeviceString(){
  return navigator.userAgent + screen.width + screen.height;
}

/* ---------- server calls ---------- */

/* Returns { ok:true, expiresAt } on success (expiresAt is an epoch-ms
   number pulled straight from the sheet's Expiry Date cell), or
   { ok:false, reason:'EXPIRED'|'USED'|'INVALID' } otherwise. Shows a
   user-facing alert for the failure cases, same as before. */
async function activateProduct(code,type,opts){

    opts = opts || {};
    const quiet = !!opts.silent;
    const say = (m) => { if(!quiet) alert(m); };
    const device = rawDeviceString();

    const url=
        WEBAPP+
        "?action=activate"+
        "&type="+encodeURIComponent(type)+
        "&code="+encodeURIComponent(code)+
        "&device="+encodeURIComponent(device);

    let txt;
    try{
        const res=await fetch(url);
        txt=(await res.text()).trim();
    }catch(err){
        say("Could not reach the activation server. Please check your internet connection and try again.");
        return { ok:false, reason:"NETWORK" };
    }

    if(txt.indexOf("VALID")===0){
        const parts = txt.split("|");
        const expiresAt = parts[1] ? Number(parts[1]) : null;
        /* SINGLE ACCESS KEY: the server also tells us what this one key opens
           (ALL, or a list like ENG,PBI,CHSL). Unlock all of it with this one code. */
        if(parts[2]){
            const list = parts[2].split(",").filter(Boolean);
            if(list.indexOf("ALL") >= 0) list.push("ENG","PBI","HIN");
            /* PER-TYPE DAYS: the server may send "CHSL:<ms>,ENG:<ms>" = each exam type's own expiry. */
            const perType = {};
            (parts[3] || "").split(",").forEach(p => {
                const m = /^([A-Z0-9_-]+):(\d+)$/.exec(p);
                if(m) perType[m[1]] = Number(m[2]);
            });
            list.forEach(t => markActivated(t, String(code).toUpperCase(), perType[t] || expiresAt));
            if(list.indexOf("ALL") < 0) clearOne_("ALL");
            /* The admin may have REMOVED some access from this key: clear every other
               type on this computer that was unlocked by the same key. */
            storedTypes_().forEach(t => {
              if(list.indexOf(t) >= 0) return;
              const m = getActivationMeta(t);
              if(m && localStorage.getItem(m.code) === String(code).toUpperCase()) clearOne_(t);
            });
        }
        return { ok:true, expiresAt: expiresAt };
    }

    if(txt=="NOACCESS"){
        say("Your access key does not include this test. Please contact your institute.");
        return { ok:false, reason:"NOACCESS" };
    }

    if(txt=="EXPIRED"){
        say("This activation code has expired. Please get a new activation code from your institute — the same code can't be reused after it expires.");
        return { ok:false, reason:"EXPIRED" };
    }

    if(txt=="USED"){
        say("Already activated on another computer.");
        return { ok:false, reason:"USED" };
    }

    if(txt=="BLOCKED"){
        say("This activation code has been blocked. Please contact your institute.");
        return { ok:false, reason:"BLOCKED" };
    }

    if(txt=="BUSY"){
        say("The activation server is busy. Please try again in a moment.");
        return { ok:false, reason:"BUSY" };
    }

    say("Invalid activation code.");
    return { ok:false, reason:"INVALID", raw: txt.slice(0,80) };
}

/* Same as activateProduct but never shows an alert — used for background re-checks. */
function checkProduct(code,type){
    return activateProduct(code,type,{ silent:true });
}

/* ---------- local license mirror ---------- */

/* Marks a product activated *now*, storing the code and the expiry
   moment the SERVER returned (not a locally-guessed one). */
function markActivated(type, code, expiresAt){
  const m = getActivationMeta(type);
  if(!m) return;
  localStorage.setItem(m.flag, "true");
  if(code) localStorage.setItem(m.code, code);
  if(expiresAt) localStorage.setItem(m.expiry, String(expiresAt));
  else localStorage.removeItem(m.expiry);
}

function clearOne_(type){
  const m = getActivationMeta(type);
  if(!m) return;
  localStorage.removeItem(m.flag);
  localStorage.removeItem(m.code);
  localStorage.removeItem(m.expiry);
}

/* Clears a product on this computer. One access key unlocks many products with the same
   code, so every product mirrored from that same key is cleared too (deactivate / blocked /
   expired / deleted). onlyThis = the key is fine but no longer includes this product. */
function clearActivation(type, onlyThis){
  const key = getActivationInfo(type).code;
  clearOne_(type);
  if(onlyThis){ clearOne_("ALL"); return; }
  if(!key) return;
  const types = ["ENG","PBI","HIN","ALL"];
  for(let i=0;i<localStorage.length;i++){
    const mm = /^lic_(.+)_code$/.exec(localStorage.key(i) || "");
    if(mm) types.push(mm[1]);
  }
  types.forEach(t => { const m = getActivationMeta(t); if(m && localStorage.getItem(m.code) === key) clearOne_(t); });
}

/* Status for a product based on the local mirror: whether it's
   currently active, expired, the stored code, and the expiry date. */
function getActivationInfo(type){
  const own = getActivationInfoOf_(type);
  if(own.active || String(type).toUpperCase() === "ALL") return own;
  const all = getActivationInfoOf_("ALL");          // a key that opens everything
  return (all.active || all.expired) ? all : own;
}
function getActivationInfoOf_(type){
  const m = getActivationMeta(type);
  const flagged = m ? localStorage.getItem(m.flag) === "true" : false;
  const code = m ? (localStorage.getItem(m.code) || "") : "";
  const expRaw = m ? localStorage.getItem(m.expiry) : null;
  const expiresAt = expRaw ? Number(expRaw) : null;
  const now = Date.now();
  const timedOut = !!(flagged && expiresAt && now >= expiresAt);
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (24*60*60*1000))) : null;

  return {
    active: flagged && !timedOut,
    expired: timedOut,
    code: code,
    expiresAt: expiresAt,
    daysLeft: daysLeft
  };
}

/* Use this for any access-gating check. If the locally-mirrored
   expiry has passed, this stops granting access on this device —
   but it does NOT call deactivate, because that would reset the
   code back to "NEW" and let it be reused, which defeats the
   point: an expired code should stay dead until you (the admin)
   either push its Expiry Date forward in the sheet, or hand the
   student a different code. */
function isActivationValid(type){
  const info = getActivationInfo(type);
  if(info.expired){
    /* Each exam type can have its own expiry, so only THIS type is cleared — the other
       types opened by the same key keep working until their own date. */
    clearOne_(type);
    if(getActivationInfoOf_("ALL").expired) clearOne_("ALL");
    return false;
  }
  return info.active;
}

function formatActivationDate(ms){
  if(!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}


/* ---------- keep this computer in step with the Licenses sheet ---------- */

function storedTypes_(){
  const t = ["ALL","ENG","PBI","HIN"];
  for(let i=0;i<localStorage.length;i++){
    const mm = /^lic_(.+)_code$/.exec(localStorage.key(i) || "");
    if(mm && t.indexOf(mm[1]) < 0) t.push(mm[1]);
  }
  return t;
}

/* The access key currently stored on this computer (any type), or "". */
function storedKeyCode_(){
  const types = storedTypes_();
  for(let i=0;i<types.length;i++){
    const m = getActivationMeta(types[i]);
    const c = m ? localStorage.getItem(m.code) : "";
    if(c) return c;
  }
  return "";
}

/* Asks the sheet what this key opens RIGHT NOW (blocked, expired, deleted, access
   list changed, expiry changed) and updates this computer to match. At most once a
   minute unless force=true. Offline / busy / device mismatch never lock anyone out.
   Resolves true when local state changed. */
const ACCESS_SYNC_EVERY_MS = 60 * 1000;
async function syncAccessKey(force){
  const code = storedKeyCode_();
  if(!code) return false;
  try{
    const last = Number(localStorage.getItem("smartechAccessSync")) || 0;
    if(!force && Date.now() - last < ACCESS_SYNC_EVERY_MS) return false;
  }catch(e){}
  const before = JSON.stringify(storedTypes_().map(t => [t, getActivationInfoOf_(t).active, getActivationInfoOf_(t).expiresAt]));
  const timeout = new Promise(res => setTimeout(() => res({ ok:false, reason:"NETWORK" }), 5000));
  const r = await Promise.race([activateProduct(code, "", { silent:true }), timeout]);
  if(r.reason === "NETWORK" || r.reason === "BUSY" || r.reason === "USED") return false;
  try{ localStorage.setItem("smartechAccessSync", String(Date.now())); }catch(e){}
  if(!r.ok){
    if(r.reason === "BLOCKED" || r.reason === "EXPIRED"){
      clearActivation(storedTypes_().find(t => getActivationMeta(t) && localStorage.getItem(getActivationMeta(t).code) === code) || "ENG");
    }else if(r.reason === "INVALID"){
      /* an old single-course code: ask again with its own type before giving up */
      let alive = false;
      for(const t of storedTypes_()){
        const m = getActivationMeta(t);
        if(!m || localStorage.getItem(m.code) !== code) continue;
        const x = await activateProduct(code, t, { silent:true });
        if(x.ok){ markActivated(t, code, x.expiresAt); alive = true; }
        else if(x.reason === "NETWORK" || x.reason === "BUSY" || x.reason === "USED"){ return false; }
      }
      if(!alive) clearActivation(storedTypes_().find(t => getActivationMeta(t) && localStorage.getItem(getActivationMeta(t).code) === code) || "ENG");
    }
  }
  const after = JSON.stringify(storedTypes_().map(t => [t, getActivationInfoOf_(t).active, getActivationInfoOf_(t).expiresAt]));
  return before !== after;
}

/* Runs on every page that loads this file; pages can listen for the change. */
window.addEventListener("load", function(){
  syncAccessKey(false).then(function(changed){
    if(changed) window.dispatchEvent(new Event("smartech-access-changed"));
  }).catch(function(){});
});

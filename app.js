/**
 * AccessForge — client-side accessibility assistant
 * All data stored in localStorage only.
 */

const STORAGE = {
  vault: 'accessforge_vault',
  resources: 'accessforge_resources',
  steps: 'accessforge_steps',
  notes: 'accessforge_notes',
  settings: 'accessforge_settings',
};

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France',
  'Spain', 'Italy', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland',
  'Poland', 'Brazil', 'Mexico', 'Argentina', 'Japan', 'South Korea', 'Taiwan',
  'Singapore', 'India', 'Philippines', 'New Zealand', 'Ireland', 'Belgium',
  'Austria', 'Switzerland', 'Portugal', 'Czech Republic', 'Romania', 'Hungary',
  'Ukraine', 'Turkey', 'Israel', 'South Africa', 'Chile', 'Colombia', 'Peru',
];

const FILL_FIELD_META = [
  { key: 'email', label: 'Email', vaultId: 'vault-email' },
  { key: 'username', label: 'Username', vaultId: 'vault-username' },
  { key: 'password', label: 'Password', vaultId: 'vault-password' },
  { key: 'passwordConfirm', label: 'Confirm password', vaultId: 'vault-password-confirm' },
  { key: 'battletag', label: 'BattleTag', vaultId: 'vault-battletag' },
  { key: 'country', label: 'Country', vaultId: 'vault-country' },
  { key: 'dob', label: 'Date of birth', vaultId: 'vault-dob' },
  { key: 'dobMonth', label: 'Birth month', vaultId: 'vault-dob-month' },
  { key: 'dobDay', label: 'Birth day', vaultId: 'vault-dob-day' },
  { key: 'dobYear', label: 'Birth year', vaultId: 'vault-dob-year' },
  { key: 'firstname', label: 'First name', vaultId: 'vault-firstname' },
  { key: 'lastname', label: 'Last name', vaultId: 'vault-lastname' },
  { key: 'phoneCode', label: 'Phone country code', vaultId: 'vault-phone-code' },
  { key: 'phone', label: 'Phone number', vaultId: 'vault-phone' },
  { key: 'smsCode', label: 'SMS / verification code', vaultId: 'vault-sms-code' },
  { key: 'address', label: 'Street address', vaultId: 'vault-address' },
  { key: 'city', label: 'City', vaultId: 'vault-city' },
  { key: 'state', label: 'State / province', vaultId: 'vault-state' },
  { key: 'zip', label: 'ZIP / postal code', vaultId: 'vault-zip' },
];

const vaultFields = FILL_FIELD_META.map((f) => f.vaultId);

const DEFAULT_RESOURCES = [
  {
    id: crypto.randomUUID(),
    name: 'Battle.net Account Creation',
    url: 'https://account.battle.net/creation/flow/creation-full',
    notes: 'Official Blizzard signup page',
    category: 'gaming',
  },
  {
    id: crypto.randomUUID(),
    name: 'Blizzard Phone Number Help',
    url: 'https://support.blizzard.com/en/article/phone-number-on-account',
    notes: 'Official guide for adding a phone to your account',
    category: 'support',
  },
  {
    id: crypto.randomUUID(),
    name: 'Google Voice',
    url: 'https://voice.google.com/',
    notes: 'Free US phone number (requires existing Google account)',
    category: 'phone',
  },
];

// ── Utilities ──────────────────────────────────────────────

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

async function copyText(text, label = 'Text') {
  if (!text) {
    toast(`Nothing to copy — fill in ${label.toLowerCase()} in the vault first`);
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copied`);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast(`${label} copied`);
    return true;
  }
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    toast('Text-to-speech not supported in this browser');
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

function getVaultSnapshot() {
  const snap = {};
  vaultFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value) snap[id] = el.value;
  });
  if (snap['vault-dob'] && /^\d{4}-\d{2}-\d{2}$/.test(snap['vault-dob'])) {
    const [, y, m, d] = snap['vault-dob'].match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!snap['vault-dob-month']) snap['vault-dob-month'] = String(+m);
    if (!snap['vault-dob-day']) snap['vault-dob-day'] = String(+d);
    if (!snap['vault-dob-year']) snap['vault-dob-year'] = y;
  }
  return snap;
}

function syncDobPartsFromDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
  const [, y, m, d] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const monthEl = document.getElementById('vault-dob-month');
  const dayEl = document.getElementById('vault-dob-day');
  const yearEl = document.getElementById('vault-dob-year');
  if (monthEl) monthEl.value = String(+m);
  if (dayEl) dayEl.value = String(+d);
  if (yearEl) yearEl.value = y;
  vaultData['vault-dob-month'] = monthEl?.value || '';
  vaultData['vault-dob-day'] = dayEl?.value || '';
  vaultData['vault-dob-year'] = yearEl?.value || '';
}

function populateSelects() {
  const country = document.getElementById('vault-country');
  country.innerHTML = '<option value="">— Select country —</option>';
  COUNTRIES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    country.appendChild(opt);
  });

  const month = document.getElementById('vault-dob-month');
  month.innerHTML = '<option value="">Month</option>';
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = new Date(2000, i - 1, 1).toLocaleString('en', { month: 'long' });
    month.appendChild(opt);
  }

  const day = document.getElementById('vault-dob-day');
  day.innerHTML = '<option value="">Day</option>';
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    day.appendChild(opt);
  }

  const year = document.getElementById('vault-dob-year');
  year.innerHTML = '<option value="">Year</option>';
  const now = new Date().getFullYear();
  for (let y = now; y >= now - 100; y--) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    year.appendChild(opt);
  }
}

// ── Autofill launcher ──────────────────────────────────────

function encodeBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildSignupHashPayload(mode) {
  return encodeBase64Url(JSON.stringify({
    data: getVaultSnapshot(),
    mode: mode || 'automation',
    only: null,
  }));
}

function buildSignupUrl(mode) {
  return BATTLENET_SIGNUP + '#accessforge=' + buildSignupHashPayload(mode);
}

function buildFillPayload(onlyField, mode) {
  return JSON.stringify({
    data: getVaultSnapshot(),
    only: onlyField || null,
    mode: onlyField ? 'fill' : (mode || 'automation'),
  });
}

function buildBookmarkletHref(onlyField) {
  const payload = encodeURIComponent(buildFillPayload(onlyField, onlyField ? 'fill' : 'automation'));
  const engine = [
    '(function(){',
    'var P=JSON.parse(decodeURIComponent("' + payload + '"));',
    'var D=P.data,O=P.only,MODE=P.mode||"automation";',
    'var S=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;',
    'function sv(el,v){if(!el||!v)return false;var t=el.tagName;',
    'if(t==="SELECT"){var o=[].slice.call(el.options),l=String(v).toLowerCase(),m=',
    'o.find(function(x){return x.value.toLowerCase()===l})||',
    'o.find(function(x){return x.textContent.trim().toLowerCase()===l})||',
    'o.find(function(x){return x.textContent.trim().toLowerCase().indexOf(l)>-1});',
    'if(m){el.value=m.value;el.dispatchEvent(new Event("change",{bubbles:true}));return true}return false}',
    'if(t==="INPUT"||t==="TEXTAREA"){S.call(el,String(v));',
    'el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true}return false}',
    'function sd(i){if(!i||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(i))return null;',
    'var p=i.split("-");return{year:p[0],month:String(+p[1]),day:String(+p[2])}}',
    'var VK={"vault-email":"email","vault-password":"password","vault-password-confirm":"passwordConfirm",',
    '"vault-battletag":"battletag","vault-firstname":"firstname","vault-lastname":"lastname",',
    '"vault-phone":"phone","vault-phone-code":"phoneCode","vault-sms-code":"smsCode",',
    '"vault-country":"country","vault-dob":"dob","vault-dob-month":"dobMonth","vault-dob-day":"dobDay",',
    '"vault-dob-year":"dobYear","vault-address":"address","vault-city":"city","vault-state":"state",',
    '"vault-zip":"zip","vault-username":"username"};',
    'var R={email:["input[type=email]","input[name*=email i]","input[id*=email i]","input[autocomplete=email]"],',
    'password:["input[type=password]:not([name*=confirm i]):not([id*=confirm i])","input[name=password i]:not([name*=confirm i])"],',
    'passwordConfirm:["input[name*=confirm i][type=password]","input[id*=confirm i][type=password]"],',
    'battletag:["input[name*=battletag i]","input[id*=battletag i]","input[placeholder*=battletag i]"],',
    'firstname:["input[name*=first i]","input[autocomplete=given-name]","input[placeholder*=first i]"],',
    'lastname:["input[name*=last i]","input[autocomplete=family-name]","input[placeholder*=last i]"],',
    'phone:["input[type=tel]","input[name*=phone i]:not([name*=country i])","input[autocomplete=tel]"],',
    'phoneCode:["input[name*=country i][name*=code i]","select[name*=phone i][id*=country i]"],',
    'smsCode:["input[name*=code i]:not([name*=country i])","input[autocomplete=one-time-code]","input[inputmode=numeric]"],',
    'country:["select[name=country i]","select[id*=country i]:not([id*=phone i])","select[autocomplete=country]"],',
    'dob:["input[type=date]","input[autocomplete=bday]","input[name*=birth i]"],',
    'dobMonth:["select[name*=month i]","select[id*=month i]","select[aria-label*=month i]"],',
    'dobDay:["select[name*=day i]","select[id*=day i]","select[aria-label*=day i]"],',
    'dobYear:["select[name*=year i]","select[id*=year i]","select[aria-label*=year i]"],',
    'address:["input[autocomplete=street-address]","input[name*=address i]"],',
    'city:["input[name=city i]","input[autocomplete=address-level2]"],',
    'state:["input[name=state i]","select[name=state i]","input[autocomplete=address-level1]"],',
    'zip:["input[name=zip i]","input[name=postal i]","input[autocomplete=postal-code]"],',
    'username:["input[name=username i]","input[autocomplete=username]"]};',
    'var N={};for(var k in D){if(D[k])N[VK[k]||k]=D[k]}',
    'var parts=sd(N.dob);if(parts){N.dobMonth=N.dobMonth||parts.month;N.dobDay=N.dobDay||parts.day;N.dobYear=N.dobYear||parts.year}',
    'function toast(msg,ok){var t=document.createElement("div");t.style.cssText="position:fixed;bottom:24px;right:24px;z-index:2147483647;padding:14px 20px;border-radius:10px;font:600 15px system-ui,sans-serif;color:#fff;background:"+(ok?"#1a7f4e":"#b33a3a")+";max-width:320px;line-height:1.4";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.style.opacity="0"},4500)}',
    'function vis(el){if(!el||el.disabled)return false;if(el.type==="hidden")return false;var r=el.getBoundingClientRect();return el.offsetParent!==null||(r&&r.width>0)}',
    'function txt(el){return(el.innerText||el.textContent||el.value||el.getAttribute("aria-label")||"").trim().toLowerCase()}',
    'function fillAll(){var filled=0;for(var f in R){if(O&&O!==f)continue;var v=N[f];if(!v)continue;',
    'for(var si=0;si<R[f].length;si++){var els=document.querySelectorAll(R[f][si]);',
    'for(var ei=0;ei<els.length;ei++){if(sv(els[ei],v)){filled++;break}}}return filled}',
    'function findBtn(){var c=document.querySelectorAll("button,input[type=submit],input[type=button],[role=button]"),out=[];',
    'for(var i=0;i<c.length;i++){var b=c[i];if(!vis(b))continue;var t=txt(b);',
    'if(/continue|next|submit|create account|sign up|register|proceed|confirm/i.test(t)&&!/cancel|back|sign in|log in/i.test(t))out.push(b)}return out}',
    'function clickEl(el){el.focus&&el.focus();el.click()}',
    'function chkBoxes(){var boxes=document.querySelectorAll(\'input[type="checkbox"]\');',
    'for(var i=0;i<boxes.length;i++){var b=boxes[i];if(!vis(b)||b.checked)continue;var ctx=(b.name||"")+(b.id||"")+txt(b.closest("label")||b);',
    'if(/term|privacy|age|agree|accept|consent|13|16|18/i.test(ctx)){b.checked=true;b.dispatchEvent(new Event("change",{bubbles:true}))}}}',
    'function isVerify(){var body=(document.body.innerText||"").slice(0,6000);',
    'return /verify.*email|check.*email|confirmation link|enter.*code|captcha|recaptcha/i.test(body)}',
    'if(MODE==="fill"||O){var n=fillAll();toast(n?"AccessForge filled "+n+" field(s)":"AccessForge: no matching fields",!!n);return}',
    'toast("AccessForge: automation running…",true);',
    '(async function(){var steps=0,filled=0,max=12;',
    'for(var s=0;s<max;s++){if(isVerify()){fillAll();toast("AccessForge paused: verification or CAPTCHA — finish manually.",true);return}',
    'filled+=fillAll();chkBoxes();await new Promise(function(r){setTimeout(r,600)});',
    'var btns=findBtn();if(!btns.length){await new Promise(function(r){setTimeout(r,400)});continue}',
    'clickEl(btns[0]);steps++;toast("AccessForge: step "+steps+"…",true);',
    'await new Promise(function(r){setTimeout(r,1200)})}',
    'toast("AccessForge: done "+steps+" step(s). Check page for verification.",true)})();',
    '})();',
  ].join('');
  return 'javascript:' + engine;
}

function updateBookmarklet(onlyField) {
  const link = document.getElementById('bookmarklet-link');
  if (link) link.href = buildBookmarkletHref(onlyField);
}

function buildConsoleScript(onlyField) {
  const data = getVaultSnapshot();
  const only = onlyField ? JSON.stringify(onlyField) : 'null';
  if (onlyField) {
    return [
      '// AccessForge fill script — paste in browser console on the signup tab',
      '// Requires AccessForgeFill from autofill-engine.js (or install the userscript).',
      'const __afData = ' + JSON.stringify(data) + ';',
      'const __afOnly = ' + only + ';',
      'AccessForgeFill.runFill(__afData, { only: __afOnly });',
    ].join('\n');
  }
  return [
    '// AccessForge signup automation — paste on the Battle.net signup tab',
    '// Requires AccessForgeFill from autofill-engine.js (or install the userscript).',
    'const __afData = ' + JSON.stringify(data) + ';',
    'AccessForgeFill.runSignupAutomation(__afData);',
  ].join('\n');
}

function composeUserscript(engineSource) {
  const data = getVaultSnapshot();
  return [
    '// ==UserScript==',
    '// @name         AccessForge Battle.net Signup Automation',
    '// @namespace    accessforge.local',
    '// @version      2.0',
    '// @description  One-click Battle.net signup automation from AccessForge vault',
    '// @match        https://account.battle.net/creation/*',
    '// @match        https://account.battle.net/*creation*',
    '// @match        https://*.battle.net/creation/*',
    '// @run-at       document-idle',
    '// @grant        none',
    '// ==/UserScript==',
    '',
    engineSource.trim(),
    '',
    '(function () {',
    '  const fallbackData = ' + JSON.stringify(data) + ';',
    '',
    '  function mountControls() {',
    '    if (document.getElementById("accessforge-ui")) return;',
    '    const AF = window.AccessForgeFill;',
    '    if (!AF) return;',
    '    const wrap = document.createElement("div");',
    '    wrap.id = "accessforge-ui";',
    '    wrap.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px";',
    '    const autoBtn = document.createElement("button");',
    '    autoBtn.textContent = "⚡ Run signup";',
    '    autoBtn.style.cssText = "padding:12px 18px;border:none;border-radius:10px;background:#3dd68c;color:#0a1628;font:700 15px system-ui;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.35)";',
    '    autoBtn.onclick = function () { AF.runSignupAutomation(fallbackData); };',
    '    const fillBtn = document.createElement("button");',
    '    fillBtn.textContent = "Fill fields only";',
    '    fillBtn.style.cssText = "padding:10px 14px;border:2px solid #4da3ff;border-radius:10px;background:#0a1628;color:#4da3ff;font:600 13px system-ui;cursor:pointer";',
    '    fillBtn.onclick = function () { AF.runFill(fallbackData); };',
    '    wrap.appendChild(autoBtn);',
    '    wrap.appendChild(fillBtn);',
    '    document.body.appendChild(wrap);',
    '  }',
    '',
    '  function boot() {',
    '    const AF = window.AccessForgeFill;',
    '    if (!AF) return;',
    '    mountControls();',
    '    const hashPayload = AF.parseHashPayload();',
    '    const autostart = sessionStorage.getItem("accessforge_autostart");',
    '    if (hashPayload && hashPayload.data) {',
    '      sessionStorage.removeItem("accessforge_autostart");',
    '      AF.tryAutostartFromHash();',
    '      return;',
    '    }',
    '    if (autostart) {',
    '      try {',
    '        const parsed = JSON.parse(autostart);',
    '        sessionStorage.removeItem("accessforge_autostart");',
    '        if (parsed.mode === "fill") AF.runFill(parsed.data, { only: parsed.only });',
    '        else AF.runSignupAutomation(parsed.data);',
    '      } catch (_) { sessionStorage.removeItem("accessforge_autostart"); }',
    '    }',
    '  }',
    '',
    '  if (document.body) boot();',
    '  else document.addEventListener("DOMContentLoaded", boot);',
    '})();',
  ].join('\n');
}

async function fetchAutofillEngineSource() {
  const res = await fetch('autofill-engine.js');
  if (!res.ok) throw new Error('engine fetch failed');
  return res.text();
}

function hasVaultData() {
  return vaultFields.some((id) => document.getElementById(id)?.value);
}

const BATTLENET_SIGNUP = 'https://account.battle.net/creation/flow/creation-full';

function prepareFillAll() {
  if (!hasVaultData()) {
    toast('Add your info in My Info Vault first, then try again.');
    showPanel('vault');
    return;
  }

  const snap = getVaultSnapshot();
  if (!snap['vault-email']) {
    toast('Email is required in My Info Vault for signup.');
    showPanel('vault');
    return;
  }

  updateBookmarklet(null);

  try {
    sessionStorage.setItem('accessforge_autostart', JSON.stringify({
      data: snap,
      mode: 'automation',
    }));
  } catch (_) { /* cross-tab hint only; hash is primary */ }

  const signupUrl = buildSignupUrl('automation');
  window.open(signupUrl, '_blank', 'noopener');

  toast('Battle.net opened — signup automation starts automatically if userscript is installed. Email/SMS verification may still need you.');
}

function triggerAutofill(onlyField) {
  updateBookmarklet(onlyField);
  const label = onlyField
    ? FILL_FIELD_META.find((f) => f.key === onlyField)?.label || onlyField
    : 'all fields';
  if (onlyField) {
    toast(`Fill bookmark ready for ${label}. Click it on your signup tab.`);
  } else {
    toast('Automation bookmark ready — or use Create Account Now for one-click flow.');
  }
}

function renderAutofillMatrix() {
  const matrix = document.getElementById('autofill-matrix');
  if (!matrix) return;

  matrix.innerHTML = FILL_FIELD_META.map((f) => {
    const el = document.getElementById(f.vaultId);
    const val = el?.value || '';
    const preview = f.key === 'password' || f.key === 'passwordConfirm'
      ? (val ? '••••••••' : '— empty —')
      : (val || '— empty —');
    return `
      <div class="fill-row" data-field="${f.key}">
        <div class="fill-info">
          <strong>${f.label}</strong>
          <span class="fill-preview">${preview}</span>
        </div>
        <div class="fill-actions">
          <button type="button" class="matrix-copy" data-vault="${f.vaultId}">Copy</button>
          <button type="button" class="matrix-fill" data-field="${f.key}">Auto-fill</button>
        </div>
      </div>
    `;
  }).join('');

  matrix.querySelectorAll('.matrix-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.vault);
      const meta = FILL_FIELD_META.find((f) => f.vaultId === btn.dataset.vault);
      copyText(el?.value || '', meta?.label || 'Value');
    });
  });

  matrix.querySelectorAll('.matrix-fill').forEach((btn) => {
    btn.addEventListener('click', () => triggerAutofill(btn.dataset.field));
  });
}

// ── Settings ─────────────────────────────────────────────

const settings = load(STORAGE.settings, {
  fontScale: 1,
  highContrast: false,
  reduceMotion: false,
});

function applySettings() {
  document.documentElement.style.setProperty('--font-base', `${18 * settings.fontScale}px`);
  document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
  document.getElementById('contrast-toggle').setAttribute('aria-pressed', String(settings.highContrast));
  document.getElementById('reduce-motion-toggle').setAttribute('aria-pressed', String(settings.reduceMotion));
}

function persistSettings() {
  save(STORAGE.settings, settings);
  applySettings();
}

document.getElementById('font-increase').addEventListener('click', () => {
  settings.fontScale = Math.min(1.6, settings.fontScale + 0.1);
  persistSettings();
  toast(`Text size: ${Math.round(settings.fontScale * 100)}%`);
});

document.getElementById('font-decrease').addEventListener('click', () => {
  settings.fontScale = Math.max(0.8, settings.fontScale - 0.1);
  persistSettings();
  toast(`Text size: ${Math.round(settings.fontScale * 100)}%`);
});

document.getElementById('font-reset').addEventListener('click', () => {
  settings.fontScale = 1;
  persistSettings();
  toast('Text size reset');
});

document.getElementById('contrast-toggle').addEventListener('click', () => {
  settings.highContrast = !settings.highContrast;
  persistSettings();
  toast(settings.highContrast ? 'High contrast on' : 'High contrast off');
});

document.getElementById('reduce-motion-toggle').addEventListener('click', () => {
  settings.reduceMotion = !settings.reduceMotion;
  persistSettings();
  toast(settings.reduceMotion ? 'Reduced motion on' : 'Reduced motion off');
});

applySettings();

// ── Navigation ─────────────────────────────────────────────

function showPanel(panelId) {
  document.querySelectorAll('.panel').forEach((p) => {
    const isTarget = p.id === `panel-${panelId}`;
    p.hidden = !isTarget;
    p.classList.toggle('active', isTarget);
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    const active = btn.dataset.panel === panelId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  if (panelId === 'autofill') renderAutofillMatrix();
}

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => showPanel(btn.dataset.panel));
});

document.querySelectorAll('.nav-jump').forEach((btn) => {
  btn.addEventListener('click', () => showPanel(btn.dataset.panel));
});

// ── Signup steps ───────────────────────────────────────────

const completedSteps = new Set(load(STORAGE.steps, []));

function updateProgress() {
  const total = 8;
  const done = completedSteps.size;
  const pct = (done / total) * 100;
  document.getElementById('progress-fill').style.width = `${Math.max(12.5, pct)}%`;
  document.getElementById('progress-label').textContent = `Step ${Math.min(done + 1, total)} of ${total} (${done} completed)`;
  document.getElementById('step-progress').setAttribute('aria-valuenow', String(done));
}

function initSteps() {
  document.querySelectorAll('.step-card').forEach((card) => {
    if (completedSteps.has(card.dataset.step)) card.classList.add('done');
  });
  updateProgress();
}

document.querySelectorAll('.step-done-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.step-card');
    const step = card.dataset.step;
    if (completedSteps.has(step)) {
      completedSteps.delete(step);
      card.classList.remove('done');
      btn.textContent = 'Done';
    } else {
      completedSteps.add(step);
      card.classList.add('done');
      btn.textContent = 'Undo';
      toast(`Step ${step} marked complete`);
    }
    save(STORAGE.steps, [...completedSteps]);
    updateProgress();
  });
});

document.querySelectorAll('.step-done-btn').forEach((btn) => {
  const card = btn.closest('.step-card');
  if (completedSteps.has(card.dataset.step)) btn.textContent = 'Undo';
});

initSteps();

const notesEl = document.getElementById('session-notes');
notesEl.value = load(STORAGE.notes, '');
notesEl.addEventListener('input', () => save(STORAGE.notes, notesEl.value));

document.querySelectorAll('.copy-field-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const el = document.getElementById(btn.dataset.copyTarget);
    const label = el?.labels?.[0]?.textContent || btn.dataset.copyTarget;
    copyText(el?.value || '', label);
  });
});

document.querySelectorAll('.autofill-field-btn').forEach((btn) => {
  btn.addEventListener('click', () => triggerAutofill(btn.dataset.fillField));
});

document.querySelectorAll('.speak-btn').forEach((btn) => {
  btn.addEventListener('click', () => speak(btn.dataset.speak));
});

// ── Info Vault ─────────────────────────────────────────────

populateSelects();

const vaultData = load(STORAGE.vault, {});

function onVaultChange(id) {
  vaultData[id] = document.getElementById(id).value;
  save(STORAGE.vault, vaultData);
  document.getElementById('vault-status').textContent = 'Saved locally.';
  updateBookmarklet();
  renderAutofillMatrix();
}

vaultFields.forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (vaultData[id]) el.value = vaultData[id];

  el.addEventListener('input', () => onVaultChange(id));
  el.addEventListener('change', () => {
    if (id === 'vault-dob') syncDobPartsFromDate(el.value);
    onVaultChange(id);
  });
});

if (vaultData['vault-dob']) syncDobPartsFromDate(vaultData['vault-dob']);

document.querySelectorAll('.inline-copy').forEach((btn) => {
  btn.addEventListener('click', () => {
    const el = document.getElementById(btn.dataset.copy);
    const label = el?.labels?.[0]?.textContent || 'Value';
    copyText(el?.value || '', label);
  });
});

document.querySelectorAll('.inline-fill').forEach((btn) => {
  btn.addEventListener('click', () => triggerAutofill(btn.dataset.fill));
});

const pwInput = document.getElementById('vault-password');
const pwToggle = document.getElementById('toggle-password');
pwToggle.addEventListener('click', () => {
  const showing = pwInput.type === 'text';
  pwInput.type = showing ? 'password' : 'text';
  pwToggle.textContent = showing ? 'Show' : 'Hide';
  pwToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

document.getElementById('export-vault').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(vaultData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'accessforge-vault.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Vault exported');
});

document.getElementById('import-vault').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    Object.assign(vaultData, imported);
    save(STORAGE.vault, vaultData);
    vaultFields.forEach((id) => {
      const el = document.getElementById(id);
      if (el && vaultData[id]) el.value = vaultData[id];
    });
    if (vaultData['vault-dob']) syncDobPartsFromDate(vaultData['vault-dob']);
    updateBookmarklet();
    renderAutofillMatrix();
    toast('Vault imported');
  } catch {
    toast('Could not read that file');
  }
  e.target.value = '';
});

document.getElementById('clear-vault').addEventListener('click', () => {
  if (!confirm('Clear all saved info from this device?')) return;
  vaultFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
    delete vaultData[id];
  });
  save(STORAGE.vault, {});
  updateBookmarklet();
  renderAutofillMatrix();
  toast('Vault cleared');
});

// ── Auto-Fill panel actions ────────────────────────────────

document.getElementById('copy-fill-script').addEventListener('click', () => {
  copyText(buildConsoleScript(), 'Fill script');
});

document.getElementById('fill-all-trigger').addEventListener('click', prepareFillAll);
document.getElementById('fill-all-now').addEventListener('click', prepareFillAll);

document.getElementById('refresh-bookmarklet').addEventListener('click', () => {
  updateBookmarklet();
  toast('Bookmark refreshed with latest vault data');
});

document.getElementById('download-userscript').addEventListener('click', async () => {
  try {
    const engine = await fetchAutofillEngineSource();
    const blob = new Blob([composeUserscript(engine)], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'accessforge-battlenet.user.js';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Userscript downloaded — install in Tampermonkey, then use Create Account Now');
  } catch {
    toast('Could not build userscript — open AccessForge via a local server');
  }
});

const bookmarkletLink = document.getElementById('bookmarklet-link');
bookmarkletLink.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/uri-list', bookmarkletLink.href);
  e.dataTransfer.setData('text/plain', bookmarkletLink.href);
});

updateBookmarklet();
renderAutofillMatrix();

// ── Resource Console ───────────────────────────────────────

let resources = load(STORAGE.resources, null);
if (!resources || resources.length === 0) {
  resources = DEFAULT_RESOURCES;
  save(STORAGE.resources, resources);
}

let activeFilter = 'all';
let editingId = null;

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderResources() {
  const list = document.getElementById('resource-list');
  const empty = document.getElementById('resource-empty');
  const filtered = activeFilter === 'all' ? resources : resources.filter((r) => r.category === activeFilter);

  list.innerHTML = '';
  if (filtered.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  filtered.forEach((res) => {
    const li = document.createElement('li');
    li.className = 'resource-item';
    li.innerHTML = `
      <div class="res-info">
        <span class="res-badge">${res.category}</span>
        <h4>${escapeHtml(res.name)}</h4>
        <a class="res-url" href="${escapeAttr(res.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(res.url)}</a>
        ${res.notes ? `<p class="res-notes">${escapeHtml(res.notes)}</p>` : ''}
      </div>
      <div class="res-actions">
        <a class="res-open" href="${escapeAttr(res.url)}" target="_blank" rel="noopener noreferrer">Open</a>
        <button type="button" class="res-edit" data-id="${res.id}">Edit</button>
        <button type="button" class="res-delete" data-id="${res.id}">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.res-edit').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(btn.dataset.id));
  });
  list.querySelectorAll('.res-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteResource(btn.dataset.id));
  });
}

function startEdit(id) {
  const res = resources.find((r) => r.id === id);
  if (!res) return;
  editingId = id;
  document.getElementById('res-name').value = res.name;
  document.getElementById('res-url').value = res.url;
  document.getElementById('res-notes').value = res.notes || '';
  document.getElementById('res-category').value = res.category;
  document.getElementById('res-submit').textContent = 'Save changes';
  document.getElementById('res-name').focus();
  toast('Editing — update fields and click Save changes');
}

function deleteResource(id) {
  const res = resources.find((r) => r.id === id);
  if (!res || !confirm(`Remove "${res.name}"?`)) return;
  resources = resources.filter((r) => r.id !== id);
  save(STORAGE.resources, resources);
  renderResources();
  toast('Site removed');
}

document.getElementById('resource-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = {
    name: document.getElementById('res-name').value.trim(),
    url: document.getElementById('res-url').value.trim(),
    notes: document.getElementById('res-notes').value.trim(),
    category: document.getElementById('res-category').value,
  };
  if (!entry.name || !entry.url) return;

  if (editingId) {
    const idx = resources.findIndex((r) => r.id === editingId);
    if (idx !== -1) resources[idx] = { ...resources[idx], ...entry };
    editingId = null;
    document.getElementById('res-submit').textContent = 'Add site';
    toast('Site updated');
  } else {
    resources.push({ id: crypto.randomUUID(), ...entry });
    toast('Site added');
  }
  save(STORAGE.resources, resources);
  e.target.reset();
  renderResources();
});

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderResources();
  });
});

renderResources();

// ── Keyboard shortcuts ─────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === '1') { e.preventDefault(); showPanel('guide'); }
  if (e.altKey && e.key === '2') { e.preventDefault(); showPanel('vault'); }
  if (e.altKey && e.key === '3') { e.preventDefault(); showPanel('autofill'); }
  if (e.altKey && e.key === '4') { e.preventDefault(); showPanel('resources'); }
  if (e.altKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); prepareFillAll(); }
});

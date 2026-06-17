/**
 * AccessForge autofill engine — runs on external pages (bookmarklet / userscript).
 * Matches inputs & selects by name, id, type, autocomplete, placeholder, aria-label.
 */
(function (global) {
  const REACT_SET = Object.getOwnPropertyDescriptor(
    global.HTMLInputElement?.prototype || {},
    'value'
  )?.set;

  function setNativeValue(el, value) {
    if (!el || value == null || value === '') return false;
    const tag = el.tagName;
    if (tag === 'SELECT') {
      const opts = [...el.options];
      const lower = String(value).toLowerCase();
      const match =
        opts.find((o) => o.value.toLowerCase() === lower) ||
        opts.find((o) => o.textContent.trim().toLowerCase() === lower) ||
        opts.find((o) => o.textContent.trim().toLowerCase().includes(lower)) ||
        opts.find((o) => lower.includes(o.value.toLowerCase()));
      if (match) {
        el.value = match.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (el.type === 'checkbox' || el.type === 'radio') return false;
      if (REACT_SET) REACT_SET.call(el, String(value));
      else el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
    return false;
  }

  function queryAll(doc, selectors) {
    const found = new Set();
    for (const sel of selectors) {
      try {
        doc.querySelectorAll(sel).forEach((el) => {
          if (!el.disabled && el.offsetParent !== null) found.add(el);
        });
      } catch (_) { /* invalid selector */ }
    }
    return [...found];
  }

  function splitDob(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split('-');
    return { year: y, month: String(+m), monthPadded: m, day: String(+d), dayPadded: d };
  }

  /** @type {Record<string, { selectors: string[], derive?: (d: Record<string,string>) => string | null }>} */
  const FIELD_RULES = {
    email: {
      selectors: [
        'input[type="email"]',
        'input[name="email" i]',
        'input[id*="email" i]',
        'input[autocomplete="email"]',
        'input[placeholder*="email" i]',
        'input[aria-label*="email" i]',
      ],
    },
    password: {
      selectors: [
        'input[type="password"]:not([name*="confirm" i]):not([id*="confirm" i])',
        'input[name="password" i]:not([name*="confirm" i])',
        'input[id="password"]',
        'input[autocomplete="new-password"]:not([name*="confirm" i])',
        'input[autocomplete="current-password"]',
      ],
    },
    passwordConfirm: {
      selectors: [
        'input[name*="confirm" i][type="password"]',
        'input[id*="confirm" i][type="password"]',
        'input[name="passwordConfirm" i]',
        'input[autocomplete="new-password"][name*="confirm" i]',
      ],
    },
    battletag: {
      selectors: [
        'input[name*="battletag" i]',
        'input[id*="battletag" i]',
        'input[name*="battle.tag" i]',
        'input[placeholder*="battletag" i]',
        'input[aria-label*="battletag" i]',
      ],
    },
    firstname: {
      selectors: [
        'input[name="firstName" i]',
        'input[name="firstname" i]',
        'input[name="given-name" i]',
        'input[autocomplete="given-name"]',
        'input[id*="first" i][name*="name" i]',
        'input[placeholder*="first" i]',
      ],
    },
    lastname: {
      selectors: [
        'input[name="lastName" i]',
        'input[name="lastname" i]',
        'input[name="family-name" i]',
        'input[autocomplete="family-name"]',
        'input[id*="last" i][name*="name" i]',
        'input[placeholder*="last" i]',
      ],
    },
    phone: {
      selectors: [
        'input[type="tel"]',
        'input[name*="phone" i]:not([name*="country" i])',
        'input[id*="phone" i]:not([id*="country" i])',
        'input[autocomplete="tel"]',
        'input[autocomplete="tel-national"]',
        'input[placeholder*="phone" i]',
      ],
    },
    phoneCode: {
      selectors: [
        'input[name*="country" i][name*="code" i]',
        'input[name="phoneCountryCode" i]',
        'select[name*="country" i][name*="phone" i]',
        'select[id*="phone" i][id*="country" i]',
      ],
    },
    smsCode: {
      selectors: [
        'input[name*="code" i]:not([name*="country" i])',
        'input[name*="otp" i]',
        'input[name*="verification" i]',
        'input[id*="sms" i]',
        'input[id*="otp" i]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"][maxlength="6"]',
        'input[inputmode="numeric"][maxlength="8"]',
      ],
    },
    country: {
      selectors: [
        'select[name="country" i]',
        'select[id*="country" i]:not([id*="phone" i])',
        'select[name="countryCode" i]',
        'select[autocomplete="country"]',
        'select[aria-label*="country" i]',
      ],
    },
    dob: {
      selectors: [
        'input[type="date"]',
        'input[name="dob" i]',
        'input[name="birth" i]',
        'input[autocomplete="bday"]',
      ],
    },
    dobMonth: {
      selectors: [
        'select[name*="month" i]',
        'select[id*="month" i]',
        'select[aria-label*="month" i]',
        'input[name*="month" i][name*="birth" i]',
      ],
      derive: (d) => splitDob(d.dob)?.month || d.dobMonth || null,
    },
    dobDay: {
      selectors: [
        'select[name*="day" i]',
        'select[id*="day" i]',
        'select[aria-label*="day" i]',
        'input[name*="day" i][name*="birth" i]',
      ],
      derive: (d) => splitDob(d.dob)?.day || d.dobDay || null,
    },
    dobYear: {
      selectors: [
        'select[name*="year" i]',
        'select[id*="year" i]',
        'select[aria-label*="year" i]',
        'input[name*="year" i][name*="birth" i]',
      ],
      derive: (d) => splitDob(d.dob)?.year || d.dobYear || null,
    },
    address: {
      selectors: [
        'input[name="address" i]',
        'input[name*="address" i][name*="line" i]',
        'input[autocomplete="street-address"]',
        'input[autocomplete="address-line1"]',
      ],
    },
    city: {
      selectors: [
        'input[name="city" i]',
        'input[autocomplete="address-level2"]',
      ],
    },
    state: {
      selectors: [
        'input[name="state" i]',
        'select[name="state" i]',
        'select[name="province" i]',
        'input[autocomplete="address-level1"]',
      ],
    },
    zip: {
      selectors: [
        'input[name="zip" i]',
        'input[name="postal" i]',
        'input[name="postcode" i]',
        'input[autocomplete="postal-code"]',
      ],
    },
    username: {
      selectors: [
        'input[name="username" i]',
        'input[id="username"]',
        'input[autocomplete="username"]',
        'input[placeholder*="username" i]',
      ],
    },
  };

  const VAULT_KEY_MAP = {
    'vault-email': 'email',
    'vault-password': 'password',
    'vault-password-confirm': 'passwordConfirm',
    'vault-battletag': 'battletag',
    'vault-firstname': 'firstname',
    'vault-lastname': 'lastname',
    'vault-phone': 'phone',
    'vault-phone-code': 'phoneCode',
    'vault-sms-code': 'smsCode',
    'vault-country': 'country',
    'vault-dob': 'dob',
    'vault-dob-month': 'dobMonth',
    'vault-dob-day': 'dobDay',
    'vault-dob-year': 'dobYear',
    'vault-address': 'address',
    'vault-city': 'city',
    'vault-state': 'state',
    'vault-zip': 'zip',
    'vault-username': 'username',
  };

  function normalizeVault(raw) {
    const out = {};
    for (const [key, val] of Object.entries(raw || {})) {
      if (!val) continue;
      const mapped = VAULT_KEY_MAP[key] || key.replace(/^vault-/, '');
      out[mapped] = val;
    }
    return out;
  }

  function fillPage(data, options = {}) {
    const doc = options.document || global.document;
    const only = options.only || null;
    const normalized = normalizeVault(data);
    const filled = [];
    const skipped = [];

    for (const [field, rule] of Object.entries(FIELD_RULES)) {
      if (only && only !== field) continue;
      const value = rule.derive ? rule.derive(normalized) : normalized[field];
      if (!value) {
        skipped.push(field);
        continue;
      }
      const els = queryAll(doc, rule.selectors);
      let hit = false;
      for (const el of els) {
        if (setNativeValue(el, value)) {
          filled.push({ field, value, tag: el.tagName });
          hit = true;
          if (!options.fillAllMatches) break;
        }
      }
      if (!hit) skipped.push(field);
    }

    return { filled, skipped, ok: filled.length > 0 };
  }

  function showFillToast(doc, message, ok) {
    const id = 'accessforge-fill-toast';
    let el = doc.getElementById(id);
    if (!el) {
      el = doc.createElement('div');
      el.id = id;
      el.setAttribute('role', 'status');
      el.style.cssText =
        'position:fixed;bottom:24px;right:24px;z-index:2147483647;padding:14px 20px;' +
        'border-radius:10px;font:600 15px system-ui,sans-serif;color:#fff;' +
        'box-shadow:0 8px 32px rgba(0,0,0,.4);max-width:320px;line-height:1.4;';
      doc.body.appendChild(el);
    }
    el.style.background = ok ? '#1a7f4e' : '#b33a3a';
    el.textContent = message;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 3500);
  }

  function runFill(data, options) {
    const result = fillPage(data, options);
    const msg = result.filled.length
      ? `AccessForge filled ${result.filled.length} field(s): ${result.filled.map((f) => f.field).join(', ')}`
      : 'AccessForge: no matching empty fields found on this page.';
    if (options?.showToast !== false) showFillToast(global.document, msg, result.filled.length > 0);
    return result;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el || el.disabled) return false;
    if (el.type === 'hidden') return false;
    const style = global.getComputedStyle?.(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    const rect = el.getBoundingClientRect?.();
    if (rect && (rect.width <= 0 || rect.height <= 0) && el.offsetParent === null) return false;
    return el.offsetParent !== null || el === global.document.body;
  }

  function elementText(el) {
    if (!el) return '';
    return (
      el.innerText ||
      el.textContent ||
      el.value ||
      el.getAttribute('aria-label') ||
      ''
    ).trim().toLowerCase();
  }

  const ACTION_BUTTON_RE =
    /^(continue|next|submit|create\s*account|sign\s*up|register|done|proceed|confirm|save|finish|get\s*started)$/i;
  const ACTION_BUTTON_PARTIAL =
    /continue|next|submit|create account|sign up|register|proceed|confirm/i;

  function isActionButton(el) {
    if (!isVisible(el)) return false;
    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'A') {
      const text = elementText(el);
      if (ACTION_BUTTON_RE.test(text)) return true;
      if (ACTION_BUTTON_PARTIAL.test(text) && !/cancel|back|skip|close|log\s*in|sign\s*in/i.test(text)) {
        return true;
      }
    }
    if (tag === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
      const text = elementText(el);
      if (ACTION_BUTTON_PARTIAL.test(text)) return true;
    }
    if (el.getAttribute('role') === 'button') {
      const text = elementText(el);
      if (ACTION_BUTTON_PARTIAL.test(text)) return true;
    }
    const cls = (el.className || '').toString();
    if (/blz-button|button-primary|btn-primary|submit/i.test(cls) && ACTION_BUTTON_PARTIAL.test(elementText(el))) {
      return true;
    }
    return false;
  }

  function findActionButtons(doc) {
    const candidates = doc.querySelectorAll(
      'button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]'
    );
    return [...candidates].filter(isActionButton).sort((a, b) => {
      const score = (el) => {
        let s = 0;
        if (el.type === 'submit') s += 3;
        if (/primary|submit/i.test(el.className || '')) s += 2;
        if (/continue|next|create/i.test(elementText(el))) s += 1;
        return s;
      };
      return score(b) - score(a);
    });
  }

  function clickElement(el) {
    if (!el) return false;
    el.focus?.();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: global }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: global }));
    el.click();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: global }));
    return true;
  }

  function hasVaultConsent(normalized) {
    return !!(
      normalized.consentTerms ||
      normalized.consentAge ||
      normalized.consentPrivacy ||
      normalized['consent-terms'] ||
      normalized['consent-age']
    );
  }

  function setCheckboxChecked(el, checked) {
    if (!el || el.type !== 'checkbox') return false;
    if (el.checked === checked) return true;
    el.checked = checked;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click', { bubbles: true }));
    return true;
  }

  function handleConsentCheckboxes(doc, normalized) {
    if (!hasVaultConsent(normalized)) {
      const boxes = doc.querySelectorAll('input[type="checkbox"]');
      for (const box of boxes) {
        if (!isVisible(box) || box.checked) continue;
        const ctx = (
          (box.name || '') +
          (box.id || '') +
          elementText(box.closest('label') || box.parentElement || box)
        ).toLowerCase();
        if (/term|privacy|policy|age|parent|guardian|agree|accept|consent|13|16|18/.test(ctx)) {
          setCheckboxChecked(box, true);
        }
      }
      return;
    }
  }

  const VERIFICATION_HINTS =
    /verify\s*(your\s*)?email|check\s*(your\s*)?email|email\s*sent|confirmation\s*link|enter\s*(the\s*)?(verification|security|auth)\s*code|sms\s*code|text\s*message|one[- ]time|authenticator|captcha|recaptcha|hcaptcha|robot|human/i;

  function detectVerificationScreen(doc, normalized) {
    const bodyText = (doc.body?.innerText || '').slice(0, 8000);
    if (!VERIFICATION_HINTS.test(bodyText)) return null;

    const otp = doc.querySelector(
      'input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="6"], input[inputmode="numeric"][maxlength="8"]'
    );
    if (otp && isVisible(otp)) {
      if (normalized.smsCode) return null;
      return { type: 'sms', message: 'SMS / verification code needed — enter code in vault or manually.' };
    }
    if (/captcha|recaptcha|hcaptcha|robot|human/i.test(bodyText)) {
      return { type: 'captcha', message: 'CAPTCHA detected — complete it manually, then re-run if needed.' };
    }
    if (/verify\s*(your\s*)?email|check\s*(your\s*)?email|confirmation\s*link|email\s*sent/i.test(bodyText)) {
      return { type: 'email', message: 'Email verification needed — check inbox and click Blizzard link.' };
    }
    return { type: 'verify', message: 'Verification step reached — complete manually to continue.' };
  }

  function pageFingerprint(doc) {
    const inputs = [...doc.querySelectorAll('input, select, textarea')]
      .filter(isVisible)
      .slice(0, 40)
      .map((el) => `${el.tagName}:${el.type || ''}:${el.name || el.id || ''}:${el.value || ''}`)
      .join('|');
    const headings = [...doc.querySelectorAll('h1, h2, h3')]
      .slice(0, 5)
      .map((el) => elementText(el))
      .join('|');
    return inputs + '::' + headings + '::' + (global.location?.href || '');
  }

  function waitForDomChange(doc, prevFingerprint, timeoutMs) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      let observer;
      const check = () => {
        const fp = pageFingerprint(doc);
        if (fp !== prevFingerprint) {
          cleanup();
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          cleanup();
          resolve(false);
        }
      };
      const cleanup = () => {
        if (observer) observer.disconnect();
        clearInterval(poll);
      };
      observer = new MutationObserver(check);
      if (doc.body) {
        observer.observe(doc.body, { childList: true, subtree: true, attributes: true, characterData: true });
      }
      const poll = setInterval(check, 250);
      check();
    });
  }

  /**
   * Full signup wizard automation — fill fields, click through steps, stop at verification.
   * @returns {Promise<{ status: string, steps: number, filled: number, message: string }>}
   */
  async function runSignupAutomation(vault, options = {}) {
    const doc = options.document || global.document;
    const normalized = normalizeVault(vault);
    const maxSteps = options.maxSteps ?? 12;
    const stepDelay = options.stepDelay ?? 600;
    const navTimeout = options.navTimeout ?? 8000;
    let totalFilled = 0;
    let steps = 0;
    let lastFingerprint = pageFingerprint(doc);

    const status = (msg, ok) => {
      if (options.onStatus) options.onStatus(msg, ok);
      if (options.showToast !== false) showFillToast(doc, msg, ok !== false);
    };

    status('AccessForge: starting signup automation…', true);

    for (let i = 0; i < maxSteps; i++) {
      if (options.signal?.aborted) {
        return { status: 'aborted', steps, filled: totalFilled, message: 'Automation cancelled.' };
      }

      const verification = detectVerificationScreen(doc, normalized);
      if (verification) {
        fillPage(normalized, { document: doc });
        const msg = `AccessForge paused: ${verification.message}`;
        status(msg, true);
        return { status: 'verification', steps, filled: totalFilled, message: verification.message, verificationType: verification.type };
      }

      const fillResult = fillPage(normalized, { document: doc, fillAllMatches: true });
      totalFilled += fillResult.filled.length;
      handleConsentCheckboxes(doc, normalized);

      await sleep(stepDelay);

      const buttons = findActionButtons(doc);
      if (buttons.length === 0) {
        if (fillResult.filled.length === 0 && i > 0) {
          status('AccessForge: no more fields or buttons found — signup may be complete.', true);
          return { status: 'complete', steps, filled: totalFilled, message: 'Wizard finished or awaiting manual action.' };
        }
        await sleep(stepDelay);
        continue;
      }

      const btn = buttons[0];
      const btnLabel = elementText(btn) || 'Continue';
      const fpBefore = pageFingerprint(doc);
      clickElement(btn);
      steps += 1;
      status(`AccessForge: clicked "${btnLabel}" (step ${steps})…`, true);

      await sleep(stepDelay);
      const changed = await waitForDomChange(doc, fpBefore, navTimeout);
      if (!changed) await sleep(stepDelay);

      const fpAfter = pageFingerprint(doc);
      if (fpAfter === lastFingerprint && !changed && i > 1) {
        status('AccessForge: page unchanged after click — check for errors or CAPTCHA.', false);
        return { status: 'stalled', steps, filled: totalFilled, message: 'Page did not advance — manual action may be needed.' };
      }
      lastFingerprint = fpAfter;
    }

    status(`AccessForge: finished ${steps} wizard step(s). Check page for verification or errors.`, true);
    return { status: 'max_steps', steps, filled: totalFilled, message: `Completed ${steps} automated step(s).` };
  }

  function parseHashPayload() {
    const hash = global.location?.hash || '';
    const match = hash.match(/[#&]accessforge=([^&]+)/i);
    if (!match) return null;
    try {
      let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
      const json = decodeURIComponent(escape(global.atob(b64 + pad)));
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function tryAutostartFromHash(options) {
    const payload = parseHashPayload();
    if (!payload?.data) return null;
    if (global.history?.replaceState) {
      global.history.replaceState(null, '', global.location.pathname + global.location.search);
    }
    const mode = payload.mode || 'automation';
    if (mode === 'fill' || payload.only) {
      return runFill(payload.data, { only: payload.only, ...options });
    }
    return runSignupAutomation(payload.data, options);
  }

  global.AccessForgeFill = {
    FIELD_RULES,
    VAULT_KEY_MAP,
    fillPage,
    runFill,
    runSignupAutomation,
    normalizeVault,
    splitDob,
    parseHashPayload,
    tryAutostartFromHash,
  };
})(typeof window !== 'undefined' ? window : globalThis);

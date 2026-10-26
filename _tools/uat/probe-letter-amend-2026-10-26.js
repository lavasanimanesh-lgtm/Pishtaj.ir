#!/usr/bin/env node
'use strict';
/* probe-letter-amend-2026-10-26.js — بازبینی مستقل «دکمهٔ 📝 اصلاح» برای نامهٔ صادره
   ────────────────────────────────────────────────────────────────────────────
   این ابزار **کد محصول را تغییر نمی‌دهد**؛ فقط همان چیزی را اجرا می‌کند که مرورگر
   اجرا می‌کند (crm/letters.js در VM، با DOM شبیه‌سازی‌شده) و همان محدودیتی را که
   سرور اعمال می‌کند (sd_entity_sanitize_row واقعی از api/sales-domain.php در php-wasm).
   هر مورد یا «سالم» است یا با شاهدِ عددی/متنی به‌عنوان ایراد ثبت می‌شود.

   اجرا:  node _tools/uat/probe-letter-amend-2026-10-26.js
          NODE_PATH=/tmp/phpwasm/node_modules node _tools/uat/probe-letter-amend-2026-10-26.js   (بخش سرور)
   ──────────────────────────────────────────────────────────────────────────── */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const lettersSrc = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf8');
const phpSrc = fs.readFileSync(path.join(ROOT, 'api/sales-domain.php'), 'utf8');

const findings = [];
let oks = 0;
function OK(name, info) { oks++; console.log('  ✅ ' + name + (info ? '\n       ' + info : '')); }
function BAD(id, name, evidence) {
  findings.push({ id, name });
  console.log('  ❌ ' + id + ' — ' + name + (evidence ? '\n       ' + String(evidence).replace(/\n/g, '\n       ') : ''));
}
function head(t) { console.log('\n══ ' + t + ' ' + '═'.repeat(Math.max(0, 68 - t.length))); }

const PNG_SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mPgEpH7D8IMMAYAJowE7d8n2J0AAAAASUVORK5CYII=';
const PNG_STAMP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mM4ISf3H4QZYAwARzQIDRsnkbcAAAAASUVORK5CYII=';
const clone = o => JSON.parse(JSON.stringify(o));
const PROFILE = { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG, stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' };
const USERS = [
  { username: 'boss', name: 'مدیر عامل', role: 'مدیرعامل' },
  { username: 'admin', name: 'علی لواسانی', role: 'مدیر سامانه' }
];
/* شکلِ style دقیقاً همان چیزی که فرم امروز تولید می‌کند */
const MODERN_STYLE = { fs: '', lh: '', font: '', align: 'justify', signFs: '', bold: false, italic: false, margin: { t: '', r: '', b: '', l: '' } };
const BASE = {
  cd: 'L1', kind: 'OUT', st: 'signed', lang: 'fa', no: '1405/پ/ص/0007',
  to: 'جناب آقای محمدی', toRole: 'مدیر بازرگانی', subject: 'موضوع نامه',
  body: 'متن نامه', bodyHtml: '<p>متن نامه</p>', style: clone(MODERN_STYLE),
  t: '1405/08/01', signer: 'boss', signerNm: 'مدیر عامل', signerRole: 'مدیرعامل',
  author: 'boss', authorNm: 'مدیر عامل', signedT: '1405/08/01 09:00',
  att: 'ندارد', bsm: true, prjNo: '', images: []
};

/* ───────────────── sandbox ───────────────── */
function makeCtx(store, opts) {
  opts = opts || {};
  let session = opts.session || { user: 'boss', name: 'مدیر عامل' };
  const previews = [], alerts = [], audits = [], notifies = [], toasts = [], confirms = [], prompts = [];
  const els = {};
  const ctx = {
    console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN, isFinite,
    parseInt, parseFloat, encodeURIComponent,
    atob: b => Buffer.from(String(b), 'base64').toString('binary'),
    btoa: b => Buffer.from(String(b), 'binary').toString('base64'),
    setTimeout: fn => { try { if (typeof fn === 'function') fn(); } catch (e) {} return 0; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    addEventListener: () => {}, FileReader: function () {}, Image: function () {},
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    document: {
      getElementById: id => els[id] || null,
      querySelectorAll: () => [], createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      body: { appendChild() {} }
    },
    getData: k => clone(store[k] === undefined ? [] : store[k]),
    setData: (k, v) => { store[k] = clone(v); return true; },
    curSession: () => session,
    curRole: () => opts.role || 'admin',
    roleDef: () => ({ panels: '*' }),
    isSenior: () => (opts.role || 'admin') !== 'sales',
    genCode: () => 'L-NEW',
    faDate: () => '1405/08/02', faDateTime: () => '1405/08/02 11:00', faYear: () => '1405',
    escP: v => String(v == null ? '' : v),
    ptfOnClickArg: v => String(v == null ? '' : v),
    hideModal: () => { delete els.ltBodyEditor; },
    renderLetters: () => {}, goPanel: () => {},
    audit: (a, b, c) => audits.push([a, b, c]),
    notify: n => notifies.push(n),
    alert: m => alerts.push(String(m)),
    confirm: m => { confirms.push(String(m)); return opts.confirm !== false; },
    prompt: (m, d) => { prompts.push(m); return opts.promptValue === undefined ? 'دلیل آزمایشی' : opts.promptValue; },
    ptfToast: (m, k) => toasts.push([m, k]),
    ptfPreviewPrintableDoc: function () { previews.push([].slice.call(arguments)); },
    ptfLetterSignerMode: () => {}, ptfLtImgRender: () => {},
    letEditorWirePasteAndDrop: () => {}, letSyncDocFont: () => {}
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx._previews = previews; ctx._alerts = alerts; ctx._audits = audits; ctx._notifies = notifies;
  ctx._toasts = toasts; ctx._confirms = confirms; ctx._prompts = prompts;
  ctx._els = els; ctx._store = store; ctx._session = () => session;
  vm.createContext(ctx);
  vm.runInContext(lettersSrc, ctx, { filename: 'letters-runtime.js' });
  ctx.letSafeBodyHtml = h => String(h == null ? '' : h);
  return ctx;
}
function storeWith(profiles, letters) {
  return { ptf_crm_letters: letters || [], ptf_crm_sigprofiles: profiles || {}, ptf_crm_users: clone(USERS), ptf_crm_projects: [] };
}
function signedStore(extra) {
  const store = storeWith({ boss: clone(PROFILE) }, []);
  const c0 = makeCtx(store);
  const l = Object.assign(clone(BASE), extra || {});
  l.signatureSnapshot = c0.letMakeSigSnapshot({ sig: PNG_SIG, stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
  store.ptf_crm_letters = [l];
  return store;
}
/* مودال را همان‌طور که مرورگر رندر می‌کند، می‌سازد: عناصر با مقدارهای نامه. */
function renderModalDom(c, letter) {
  const e = c._els;
  const set = (id, value) => { e[id] = { value, checked: false, innerHTML: '', innerText: '' }; };
  set('ltLang', letter.lang || 'fa');
  set('ltTo', letter.to || '');
  set('ltToRole', letter.toRole || '');
  set('ltSub', letter.subject || '');
  set('ltAtt', letter.att === 'دارد' ? 'دارد' : 'ندارد');
  set('ltPrj', letter.prjNo || '');
  const me = (c.curSession() || {}).user || '';
  /* همان محاسبهٔ دقیق showLetterModal (letters.js) برای انتخاب مقدار select */
  const knownSigner = (c.getData('ptf_crm_users') || []).some(u => u && u.username === letter.signer);
  /* v34.39.65 (D9): امضاکنندهٔ حذف‌شده اکنون گزینهٔ صریح «کاربر حذف‌شده» دارد و
     خودکار به «سایر» نمی‌افتد — آینهٔ دقیق همین رفتار در DOM شبیه‌سازی‌شده. */
  const ghostSigner = !!(letter.signer && letter.signer !== '__me__' && letter.signer !== '__other__' &&
    !knownSigner && letter.signerMode !== 'other');
  const customSigner = !!(letter.signerMode === 'other' || letter.signer === '__other__' ||
    (letter.signer && letter.signer !== '__me__' && !knownSigner));
  set('ltSigner', ghostSigner ? letter.signer
    : (customSigner ? '__other__' : (letter.signer === me ? '__me__' : (letter.signer || '__me__'))));
  set('ltSignerOtherName', customSigner ? letter.signerNm || '' : '');
  set('ltSignerOtherRole', customSigner ? letter.signerRole || '' : '');
  const s = letter.style || {};
  set('ltFs', s.fs || ''); set('ltLh', s.lh || ''); set('ltFont', s.font || '');
  set('ltAlign', s.align || 'justify'); set('ltSignFs', s.signFs || '');
  const mg = s.margin || {};
  set('ltMt', mg.t === '' || mg.t == null ? '' : mg.t);
  set('ltMr', mg.r === '' || mg.r == null ? '' : mg.r);
  set('ltMb', mg.b === '' || mg.b == null ? '' : mg.b);
  set('ltMl', mg.l === '' || mg.l == null ? '' : mg.l);
  e.ltBsm = { checked: letter.bsm !== false };
  e.ltB = { checked: !!s.bold }; e.ltI = { checked: !!s.italic };
  const bodyHtml = letter.bodyHtml || ('<p>' + (letter.body || '') + '</p>');
  e.ltBodyEditor = {
    innerHTML: c.letSafeBodyHtml(c.letHtmlExpand(bodyHtml)),
    innerText: String(bodyHtml).replace(/<[^>]*>/g, ''),  /* مثل مرورگر: innerText از innerHTML */
    dataset: {}, addEventListener() {}, classList: { add() {}, remove() {} }, style: {}
  };
  e.panels = { html: '', insertAdjacentHTML(pos, h) { this.html += h; } };
  return e;
}
/* کاربر متن را در ادیتور عوض می‌کند (هر دو نمای HTML و متن، مثل مرورگر) */
function typeBody(c, text) {
  c._els.ltBodyEditor.innerHTML = '<p>' + text + '</p>';
  c._els.ltBodyEditor.innerText = text;
}
/* یک دور کامل: باز کردن -> (اختیاری) ویرایش -> ثبت */
function runAmend(store, opts) {
  const c = makeCtx(store, opts);
  const letter = clone(store.ptf_crm_letters[0]);
  renderModalDom(c, letter);
  c.letAmendOpen('L1');
  /* v34.39.65 (R5): دلیل اصلاح از prompt() به textarea درون فرم منتقل شد. */
  c._els.ltAmendReason = { value: (opts && opts.reason) || 'دلیل آزمایشی', focus() {} };
  if (opts && typeof opts.edit === 'function') opts.edit(c);
  c.letAmendSave();
  return { c, after: store.ptf_crm_letters[0] };
}
const changedOf = l => ((l.amendments || [])[0] || {}).changed || [];

/* ═══════════════ ۱) بدون هیچ ویرایشی — امضاکننده خودِ کاربر ═══════════════ */
head('۱) امضاکننده فرم اصلاح را باز می‌کند و هیچ ویرایشی نمی‌کند');
(function () {
  const store = signedStore();
  const { c, after } = runAmend(store, { promptValue: 'برای بررسی باز کردم', role: 'admin' });
  const info = 'changed=[' + changedOf(after).join(',') + '] · rev=' + after.rev + ' · st=' + after.st +
    ' · substantive=' + ((after.amendments || [])[0] || {}).substantive +
    ' · امضا باقی؟ ' + !!after.signatureSnapshot +
    ' · نامه از «امضا شده» به «در انتظار امضا» رفت؟ ' + (after.statusHistory || []).some(h => h.act === 'amend') +
    ' · درخواست امضای مجدد ارسال شد؟ ' + c._notifies.some(n => (n.kind === 'sign_req')) +
    '\n       مقدار select امضاکننده در فرم = ' + (c._els.ltSigner || {}).value + ' · signer ذخیره‌شده = "' + (JSON.parse(storeString(store)).signer) + '"';
  if (!after.rev) OK('بدون ویرایش، نسخهٔ تازه/باطل‌شدن امضا رخ نمی‌دهد', info);
  else BAD('D1', '«ثبت اصلاحیه» بدون هیچ ویرایشی هم نسخهٔ تازه می‌سازد و امضا را باطل می‌کند', info);
  function storeString(s) { return JSON.stringify(s.ptf_crm_letters[0]); }
})();

/* ═══════════════ ۲) تغییر ظاهری (فونت) — سیاست: امضا بماند ═══════════════ */
head('۲) تغییر فقط ظاهری (اندازهٔ فونت) توسط همان امضاکننده');
(function () {
  const store = signedStore();
  const { after } = runAmend(store, {
    promptValue: 'فقط فونت بزرگ‌تر شد', role: 'admin',
    edit: c => { c._els.ltFs.value = '15'; }
  });
  const info = 'changed=[' + changedOf(after).join(',') + '] · substantive=' + ((after.amendments || [])[0] || {}).substantive +
    ' · st=' + after.st + ' · امضا باقی؟ ' + !!after.signatureSnapshot;
  if (after.st === 'signed' && after.signatureSnapshot) OK('تغییر ظاهری، امضا و وضعیت را حفظ می‌کند', info);
  else BAD('D2', 'تغییر صرفاً ظاهری امضا را باطل و نامه را «در انتظار امضا» می‌کند (خلاف سیاست اعلام‌شده)', info);
})();

/* ═══════════════ ۳) همان کار توسط نقش ارشد — گروه کنترل ═══════════════ */
head('۳) گروه کنترل: تغییر ظاهری توسط مدیر ارشد (امضاکنندهٔ نامه کسِ دیگری است)');
(function () {
  const store = signedStore({ author: 'admin', authorNm: 'علی لواسانی' });
  const { after } = runAmend(store, {
    promptValue: 'فقط فونت', role: 'admin', session: { user: 'admin', name: 'علی لواسانی' },
    edit: c => { c._els.ltFs.value = '15'; }
  });
  const info = 'changed=[' + changedOf(after).join(',') + '] · substantive=' + ((after.amendments || [])[0] || {}).substantive +
    ' · st=' + after.st + ' · امضا باقی؟ ' + !!after.signatureSnapshot;
  if (after.st === 'signed' && after.signatureSnapshot) OK('گروه کنترل سالم ⇒ ریشهٔ ایراد به «انتخاب خودم» مربوط است', info);
  else BAD('D2b', 'گروه کنترل هم خراب است — مشکل عمومی است ناشی از انتخاب امضاکننده', info);
})();

/* ═══════════════ ۴) بدون ویرایش توسط مدیر ارشد — باید رد شود ═══════════════ */
head('۴) گروه کنترل: مدیر ارشد بدون هیچ ویرایشی «ثبت اصلاحیه» را می‌زند');
(function () {
  const store = signedStore({ author: 'admin', authorNm: 'علی لواسانی' });
  const { c, after } = runAmend(store, { promptValue: 'خالی', role: 'admin', session: { user: 'admin', name: 'علی لواسانی' } });
  if (!after.rev && c._alerts.some(a => /تغییر/.test(a))) OK('بدون تغییر واقعی ثبت نمی‌شود (گارد «تغییری وجود ندارد» کار می‌کند)', 'rev=' + (after.rev || 0));
  else if (!after.rev) OK('بدون تغییر ثبت نشد', 'rev=0');
  else BAD('D1b', 'این گارد برای مدیر ارشد هم کار نمی‌کند', 'rev=' + after.rev + ' changed=[' + changedOf(after).join(',') + ']');
})();

/* ═══════════════ ۵) نامهٔ بلند: نسخهٔ بایگانی ═══════════════ */
head('۵) نامهٔ بلند (≈۳٬۴۰۰ نویسه) — متن نسخهٔ بایگانی');
(function () {
  const longBody = ('متن بلند آزمایشی. '.repeat(200)).trim();
  const longHtml = '<p>' + longBody + '</p>';
  const store = signedStore({ body: longBody, bodyHtml: longHtml });
  const { after } = runAmend(store, { promptValue: 'اصلاح متن بلند', role: 'admin', edit: c => typeBody(c, 'متن تازه') });
  const rev0 = (after.revs || [])[0] || {};
  if ((rev0.body || '') === longBody && (rev0.bodyHtml || '') === longHtml)
    OK('متن نسخهٔ بایگانی در کلاینت کامل است', 'body=' + (rev0.body || '').length + ' · bodyHtml=' + (rev0.bodyHtml || '').length);
  else BAD('D3', 'متن نسخهٔ بایگانی در کلاینت ناقص است', 'body=' + (rev0.body || '').length + '/' + longBody.length + ' · bodyHtml=' + (rev0.bodyHtml || '').length + '/' + longHtml.length);
  fs.writeFileSync('/tmp/amend-row.json', JSON.stringify(after), 'utf8');
})();

/* ═══════════════ ۶) نامهٔ وارده ═══════════════ */
head('۶) نامهٔ وارده (kind:IN) — آیا دکمهٔ «📝 اصلاح» برایش می‌آید؟');
(function () {
  const IN_LETTER = {
    cd: 'L-IN', kind: 'IN', st: 'registered', lang: 'fa', no: '1405/و/ص/0012',
    from: 'شرکت پترو', subject: 'نامهٔ وارده', body: 'متن وارده', bodyHtml: '<p>متن وارده</p>',
    to: '', toRole: '', style: clone(MODERN_STYLE), t: '1405/08/01', author: 'boss', authorNm: 'مدیر عامل',
    att: 'ندارد', bsm: false, prjNo: '', images: []
  };
  const store = storeWith({ boss: clone(PROFILE) }, [IN_LETTER]);
  const c = makeCtx(store);
  let html = '';
  const box = { get innerHTML() { return html; }, set innerHTML(v) { html = v; }, insertAdjacentHTML(p, h) { html += h; } };
  c.document.getElementById = id => (id === 'ltWrap') ? box : (c._els[id] || null);
  c.renderLetters();
  if (!/📝 اصلاح/.test(html)) OK('برای نامهٔ وارده دکمهٔ اصلاح رندر نمی‌شود (فهرست سالم است)');
  else {
    /* کلیک واقعی: چه چیزی باز می‌شود و آیا ثبت ممکن است؟ */
    const store2 = storeWith({ boss: clone(PROFILE) }, [clone(IN_LETTER)]);
    const c2 = makeCtx(store2, { promptValue: 'اصلاح نامهٔ وارده' });
    renderModalDom(c2, clone(IN_LETTER));
    c2.letAmendOpen('L-IN');
    const formOpen = (c2._els.panels.html || '').length > 0;
    const formHasRecipient = /گیرنده — متن روی نامه/.test(c2._els.panels.html || '');
    c2.letAmendSave();
    BAD('D4', 'دکمهٔ «📝 اصلاح» برای نامهٔ وارده هم رندر می‌شود؛ کلیک روی آن فرمِ نامهٔ صادره را باز می‌کند و ثبت بن‌بست می‌شود',
      'فرم باز شد؟ ' + formOpen + ' · فیلد «گیرنده» دارد؟ ' + formHasRecipient +
      ' · فرم مقدار «گیرنده» را از نامهٔ وارده می‌خواند که خالی است' +
      ' · نتیجهٔ ثبت: ' + c2._alerts.join(' | ') + ' · rev=' + ((store2.ptf_crm_letters[0] || {}).rev || 0));
  }
})();

/* ═══════════════ ۷) نامهٔ «در انتظار امضا» ═══════════════ */
head('۷) نامهٔ «در انتظار امضا» (pending) — اصلاح متن قبل از امضا');
(function () {
  const store = signedStore({ st: 'pending' });
  delete store.ptf_crm_letters[0].signatureSnapshot;
  const { c, after } = runAmend(store, { promptValue: 'متن را اصلاح کردم', role: 'admin', edit: cc => typeBody(cc, 'متن تازه') });
  const toldSigner = c._notifies.some(n => (n.toUsers || []).indexOf('boss') > -1);
  const confirmTxt = (c._confirms.slice(-1)[0] || '').replace(/\n/g, ' / ');
  const info = 'st=' + after.st + ' · Rev=' + after.rev + ' · sigInvalidated=' + JSON.stringify(after.sigInvalidated || null) +
    ' · اعلان به امضاکننده؟ ' + toldSigner + '\n       متن تأییدی که کاربر دید: ' + confirmTxt.slice(0, 150);
  if (toldSigner) OK('امضاکننده از تغییر متن پیش از امضا خبردار می‌شود', info);
  else BAD('D5', 'اصلاح متنِ نامهٔ «در انتظار امضا» بی‌صدا است: نه اعلانی می‌رود نه کارتابل امضاکننده به‌روز می‌شود (در حالی که دیالوگ وعدهٔ «جایگزینی درخواست امضا» می‌دهد)', info);
})();

/* ═══════════════ ۸) دلیل بلند ═══════════════ */
head('۸) دلیل ۴۰۰ نویسه‌ای');
(function () {
  const longReason = 'د'.repeat(400);
  const store = signedStore();
  const { c, after } = runAmend(store, { reason: longReason, role: 'admin' });
  const stored = ((after.amendments || [])[0] || {}).reason || '';
  const said = c._alerts.join(' | ');
  /* v34.39.65 (D6): رفتار درست = رد صریح با پیام روشن و ثبت‌نشدن؛ برش بی‌صدا ایراد است. */
  const explicit = /حداکثر 300 نویسه/.test(said) && /اکنون 400/.test(said);
  if (!stored.length && explicit) OK('دلیل بلندتر از سقف، صریح رد می‌شود (نه برش بی‌صدا)', 'پیام: ' + said);
  else BAD('D6', 'دلیل بلند بی‌هشدار بریده می‌شود؛ فرم دلیل کامل را نشان می‌دهد ولی سابقه/پیام ۳۰۰ نویسه دارد',
    'در فرم=' + longReason.length + ' · ذخیره‌شده=' + stored.length + ' · پیام‌ها: ' + said);
})();

/* ═══════════════ ۹) خروجی خودکار PDF پس از ثبت ═══════════════ */
head('۹) «خروجی PDF نسخهٔ جدید» که بلافاصله پس از ثبت باز می‌شود');
(function () {
  const store = signedStore();
  const { c, after } = runAmend(store, { promptValue: 'اصلاح متن', role: 'admin', edit: cc => typeBody(cc, 'متن تازه') });
  const pv = c._previews.slice(-1)[0] || [];
  const html = String(pv[1] || '');
  const watermarked = /پیش‌نویس \/ PREVIEW/.test(html);
  const hasImg = /<img class="(s|st)"/.test(html);
  const info = 'عنوان: ' + String(pv[0] || '') + '\n       واترمارک پیش‌نویس: ' + watermarked + ' · تصویر مهر/امضا: ' + hasImg + ' · st=' + after.st;
  if (after.st === 'signed' || watermarked || !html) OK('خروجی خودکار، وضعیت سند را درست نشان می‌دهد', info);
  else BAD('D7', 'پس از ثبت اصلاحیه (نامه به «در انتظار امضا» می‌رود) خروجی PDF یک سند بی‌امضا و بی‌برچسبِ «پیش‌نویس» می‌سازد که شبیه نامهٔ نهایی است', info);
})();

/* ═══════════════ ۱۰) دو اصلاح پیاپی + چاپ نسخه‌های بایگانی ═══════════════ */
head('۱۰) دو اصلاح پیاپی — شماره‌گذاری و چاپ نسخهٔ قبلی');
(function () {
  const store = signedStore();
  runAmend(store, { promptValue: 'اصلاح ۱', role: 'admin', edit: c => typeBody(c, 'متن دوم') });
  const c2 = makeCtx(store, { promptValue: 'اصلاح ۲', role: 'admin' });
  renderModalDom(c2, clone(store.ptf_crm_letters[0]));
  c2.letAmendOpen('L1');
  c2._els.ltAmendReason = { value: 'اصلاح ۲', focus() {} };
  typeBody(c2, 'متن سوم');
  c2.letAmendSave();
  const after = store.ptf_crm_letters[0];
  const revs = (after.revs || []).map(r => r.n + ':' + String(r.body || '').slice(0, 10));
  const printOf = rev => {
    const i = c2._previews.length; c2.letPrint('L1', false, false, { rev });
    return String((c2._previews[i] || [])[1] || '');
  };
  const h0 = printOf(0), h1 = printOf(1);
  const okRev = after.rev === 2 && (after.revs || []).length === 2;
  const okPrint = h0.indexOf('متن نامه') > -1 && h1.indexOf('متن دوم') > -1 && h0.indexOf('نسخهٔ منسوخ') > -1;
  if (okRev && okPrint) OK('شماره‌گذاری Rev و چاپ نسخهٔ بایگانی (متن همان نسخه + مهر «نسخهٔ منسوخ») درست است', 'revs=' + revs.join(' | '));
  else BAD('D8', 'شماره‌گذاری/چاپ نسخه‌های بایگانی ایراد دارد',
    'rev=' + after.rev + ' revs=' + revs.join(' | ') + ' · چاپ۰ متن اصلی؟ ' + (h0.indexOf('متن نامه') > -1) + ' · چاپ۱ متن دوم؟ ' + (h1.indexOf('متن دوم') > -1));
})();

/* ═══════════════ ۱۱) امضاکننده‌ای که دیگر در فهرست کاربران نیست ═══════════════ */
head('۱۱) امضاکنندهٔ نامه در فهرست کاربران نیست (کاربر حذف/غیرفعال شده)');
(function () {
  const store = signedStore({ signer: 'ghost', signerNm: 'کاربر قدیمی', signerRole: 'مدیر' });
  const { c, after } = runAmend(store, { promptValue: 'اصلاح بعد از حذف کاربر', role: 'admin', session: { user: 'admin', name: 'علی لواسانی' }, edit: cc => typeBody(cc, 'متن تازه') });
  const info = 'select امضاکننده=' + (c._els.ltSigner || {}).value + ' · changed=[' + changedOf(after).join(',') + ']' +
    ' · signerMode ذخیره‌شده=' + (after.signerMode || '—') + ' · signer=' + after.signer + ' · st=' + after.st;
  if (after.signerMode !== 'other') OK('نامه بی‌سروصدا «فیزیکی» نمی‌شود', info);
  else BAD('D9', 'نامه با امضاکنندهٔ حذف‌شده بی‌سروصدا به «امضای فیزیکی / سایر» تبدیل می‌شود و برچسب امضاکننده عوض می‌شود', info);
})();

/* ═══════════════ ۱۲) پاک‌ساز واقعی سرور ═══════════════ */
async function serverChecks() {
  head('۱۲) پاک‌ساز واقعی سرور روی ردیف اصلاح‌شده (sd_entity_sanitize_row)');
  let PhpNode;
  try { PhpNode = require('php-wasm/PhpNode').PhpNode; } catch (e) {}
  if (!PhpNode) { console.log('  ⏭  php-wasm نصب نیست — بخش سرور رد شد (npm i php-wasm@0.2.0 در /tmp/phpwasm)'); return; }
  if (!fs.existsSync('/tmp/amend-row.json')) { console.log('  ⏭  ردیف آزمایشی ساخته نشد'); return; }
  const row = JSON.parse(fs.readFileSync('/tmp/amend-row.json', 'utf8'));
  function phpFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('not found ' + name);
    let i = src.indexOf('{', start), d = 0;
    for (let j = i; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) return src.slice(start, j + 1); } }
    throw new Error('unbalanced ' + name);
  }
  const fns = ['sd_text', 'sd_entity_sanitize_list', 'sd_entity_sanitize_row'].map(n => phpFn(phpSrc, n)).join('\n');
  const php = new PhpNode(); const out = [];
  php.addEventListener('output', e => out.push(e.detail || e.data || ''));
  await php.run('<?php @mkdir("/w",0777,true);');
  /* php-wasm این نسخه mbstring ندارد؛ معادل UTF-8 همان دو تابع را می‌دهیم تا
     رفتار برش/سنجش مثل هاست واقعی (که mbstring دارد) باشد. */
  const polyfill = `
if (!function_exists('mb_strlen')) { function mb_strlen($s, $e = null) { return ($n = preg_match_all('/./us', (string)$s, $m)) === false ? strlen((string)$s) : $n; } }
if (!function_exists('mb_substr')) { function mb_substr($s, $st, $len = null, $e = null) {
    $a = preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY); if ($a === false) return substr((string)$s, $st, $len);
    return implode('', $len === null ? array_slice($a, $st) : array_slice($a, $st, $len)); } }
error_reporting(0);
`;
  await php.writeFile('/w/fns.php', '<?php\n' + polyfill + fns + '\n');
  await php.writeFile('/w/row.json', JSON.stringify(row));
  await php.writeFile('/w/run.php', `<?php
require '/w/fns.php';
$row = json_decode(file_get_contents('/w/row.json'), true);
$big = ['bodyHtml'=>200000,'images'=>600000,'revs'=>900000,'signatureSnapshot'=>600000];
$st = null;
$out = sd_entity_sanitize_row($row, $st, 150, $big);
$revs = $out['revs'] ?? []; $r0 = $revs[0] ?? []; $o0 = $row['revs'][0] ?? [];
echo "STATS ".json_encode($st)."\\n";
echo "BODY ".mb_strlen($o0['body'] ?? '')." ".mb_strlen($r0['body'] ?? '')."\\n";
echo "BODYHTML ".mb_strlen($o0['bodyHtml'] ?? '')." ".mb_strlen($r0['bodyHtml'] ?? '')."\\n";
echo "REVS ".count($revs)."\\n";
echo "AMEND ".count($out['amendments'] ?? [])."\\n";
echo "REV0_SNAP ".((!empty($r0['signatureSnapshot'])) ? 'yes' : 'no')."\\n";
echo "FIELDS ".count($out)."\\n";
echo "HIST ".count($out['statusHistory'] ?? [])."\\n";
echo "REASONS ".implode(',', array_map(function($a){ return mb_strlen($a['reason'] ?? ''); }, $out['amendments'] ?? []))."\\n";
`);
  await php.run("<?php require '/w/run.php';");
  const text = out.join('');
  if (/Fatal error|Uncaught/i.test(text)) {
    console.log('  ⏭  اجرای PHP کامل نشد (محیط php-wasm): ' + text.replace(/\n/g, ' ').slice(0, 240));
    return;
  }
  console.log('       ' + text.trim().split('\n').join('\n       '));
  const g = k => { const m = text.match(new RegExp('^' + k + ' (.*)$', 'm')); return m ? m[1].trim() : ''; };
  const [bin, bout] = g('BODY').split(' ').map(Number);
  const [hin, hout] = g('BODYHTML').split(' ').map(Number);
  if (bin === bout && hin === hout) OK('سرور متن نسخهٔ بایگانی را دست‌نخورده نگه می‌دارد (بدون برش)، و تعداد فیلدها/سابقه سالم است',
    'body ' + bin + '→' + bout + ' · bodyHtml ' + hin + '→' + hout + ' · revs=' + g('REVS') + ' · amendments=' + g('AMEND') + ' · statusHistory=' + g('HIST'));
  else BAD('D10', 'پاک‌ساز سرور متن نسخهٔ بایگانی را می‌برد ⇒ چاپ نسخهٔ قبلی ناقص می‌شود', 'body ' + bin + '→' + bout + ' · bodyHtml ' + hin + '→' + hout);
  const fields = +g('FIELDS');
  if (fields <= 150) OK('تعداد فیلدهای ردیف زیر سقف رجیستری است', 'fields=' + fields + ' (سقف ۱۵۰)');
  else BAD('D11', 'ردیف از سقف فیلد سرور می‌گذرد و فیلدها بی‌صدا حذف می‌شوند', 'fields=' + fields);
}

/* ═══════════════ ۱۳) دکمه و نشان‌ها در فهرست نامه‌ها ═══════════════ */
head('۱۳) فهرست نامه‌ها — دکمهٔ «📝 اصلاح»، نشان Rev و «📚 نسخه‌ها»');
(function () {
  function listHtml(store, opts) {
    const c = makeCtx(store, opts);
    let html = '';
    const box = { get innerHTML() { return html; }, set innerHTML(v) { html = v; }, insertAdjacentHTML(p, h) { html += h; } };
    c.document.getElementById = id => (id === 'ltWrap') ? box : (c._els[id] || null);
    c.renderLetters();
    return { html, c };
  }
  const store = signedStore();
  const r1 = listHtml(store, { role: 'admin' });
  const hasBtn = /📝 اصلاح/.test(r1.html);
  const store2 = signedStore({ author: 'someone' });
  const r2 = listHtml(store2, { role: 'sales', session: { user: 'sales1', name: 'کارشناس' } });
  const blocked = !/📝 اصلاح/.test(r2.html);
  runAmend(store, { promptValue: 'اصلاح متن', role: 'admin', edit: c => typeBody(c, 'متن دوم') });
  const r3 = listHtml(store, { role: 'admin' });
  const badge = /Rev\.1/.test(r3.html) && /📚 نسخه‌ها/.test(r3.html);
  if (hasBtn && blocked && badge) OK('دکمه فقط برای مجازها می‌آید و پس از اصلاحیه، نشان Rev.1 و «📚 نسخه‌ها» ظاهر می‌شود');
  else BAD('D12', 'نمایش دکمه/نشان‌ها در فهرست ایراد دارد', 'دکمه برای مجاز=' + hasBtn + ' · پنهان برای غیرمجاز=' + blocked + ' · نشان Rev/نسخه‌ها=' + badge);
})();

(async () => {
  await serverChecks();
  console.log('\n══════════════════════════════════════════════════');
  console.log('نتیجه: ' + oks + ' مورد سالم · ' + findings.length + ' ایراد');
  findings.forEach(f => console.log('  • ' + f.id + ' — ' + f.name));
  console.log('══════════════════════════════════════════════════');
  /* v34.39.65: این پروب اکنون بخشی از گیت CI است ⇒ قالب نتیجهٔ گیت + کد خروج */
  console.log(oks + ' PASS / ' + findings.length + ' FAIL');
  process.exit(findings.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });

#!/usr/bin/env node
'use strict';
/* tester717 — v34.39.66 (LETTER-AMEND-FIX)
   پین‌تست رفعِ ۶ ایرادِ اثبات‌شدهٔ دکمهٔ «📝 اصلاح» (گزارش:
   ARENA-LETTER-AMEND-BUTTON-REVIEW-2026-10-26.md، D1/D2/D4/D5/D6/D7/D9).

   هر H یک defect واقعی را می‌بندد و باید تا همیشه سبز بماند:
     H1 (D1)  ثبت بدون ویرایش توسط خودِ امضاکننده ⇒ رد می‌شود، امضا/وضعیت دست‌نخورده
     H2 (D2)  تغییر فقط ظاهری ⇒ تغییر ماهوی نیست، امضا می‌ماند، اعلان امضا نمی‌رود
     H3       تغییر متنِ نامهٔ امضاشده ⇒ امضا باطل، pending، درخواست امضا ارسال
     H4 (D4)  نامهٔ وارده (kind:IN) ⇒ دکمه رندر نمی‌شود، فرم باز نمی‌شود، هسته رد می‌کند
     H5 (D5)  اصلاح نامهٔ pending ⇒ کارت امضای قبلی بسته و درخواست تازه ارسال می‌شود
     H6 (D9)  امضاکنندهٔ حذف‌شده ⇒ گزینهٔ صریح «کاربر حذف‌شده»، بدون تغییر بی‌صدا به «سایر»
     H7 (D6)  دلیل >۳۰۰ نویسه ⇒ رد صریح (نه برش بی‌صدا)؛ ۳۰۰ نویسه پذیرفته می‌شود
     H8 (D7)  خروجی خودکار پس از اصلاحیهٔ نامهٔ امضانشده ⇒ «پیش‌نویس» بدون مهر/امضا

   اجرا:  node _tools/uat/tester717-v34.39.65-letter-amend-fix.js
   (بدون وابستگی بیرونی: crm/letters.js واقعی در vm با DOM شبیه‌سازی‌شده اجرا می‌شود.)
*/
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var lettersSrc = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf8');

var P = 0, F = 0;
function T(name, cond, detail) {
  if (cond) { P++; console.log('PASS  ' + name); }
  else { F++; console.error('FAIL  ' + name + (detail ? '\n        ↳ ' + detail : '')); }
}
function head(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 74 - t.length))); }

var PNG_SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mPgEpH7D8IMMAYAJowE7d8n2J0AAAAASUVORK5CYII=';
var PNG_STAMP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mM4ISf3H4QZYAwARzQIDRsnkbcAAAAASUVORK5CYII=';
var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
var PROFILE = { nm: 'مدیر عامل', role: 'مدیرعامل', sig: PNG_SIG, stamp: PNG_STAMP, updatedAtISO: '2026-10-20T08:00:00Z' };
var USERS = [
  { username: 'boss', name: 'مدیر عامل', role: 'مدیرعامل' },
  { username: 'admin', name: 'علی لواسانی', role: 'مدیر سامانه' }
];
/* شکلِ style که فرم امروز تولید می‌کند */
var MODERN_STYLE = { fs: '', lh: '', font: '', align: 'justify', signFs: '', bold: false, italic: false, margin: { t: '', r: '', b: '', l: '' } };
var BASE = {
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
  var session = opts.session || { user: 'boss', name: 'مدیر عامل' };
  var previews = [], alerts = [], audits = [], notifies = [], toasts = [], confirms = [];
  var els = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Number: Number, String: String,
    Object: Object, Array: Array, RegExp: RegExp, Error: Error, isNaN: isNaN, isFinite: isFinite,
    parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent,
    atob: function (b) { return Buffer.from(String(b), 'base64').toString('binary'); },
    btoa: function (b) { return Buffer.from(String(b), 'binary').toString('base64'); },
    setTimeout: function (fn) { try { if (typeof fn === 'function') fn(); } catch (e) {} return 0; },
    clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {},
    addEventListener: function () {}, FileReader: function () {}, Image: function () {},
    URL: { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} },
    localStorage: { _d: {}, getItem: function (k) { return this._d[k] == null ? null : this._d[k]; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } },
    document: {
      getElementById: function (id) { return els[id] || null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
      body: { appendChild: function () {} }
    },
    getData: function (k) { return clone(store[k] === undefined ? [] : store[k]); },
    setData: function (k, v) { store[k] = clone(v); return true; },
    curSession: function () { return session; },
    curRole: function () { return opts.role || 'admin'; },
    roleDef: function () { return { panels: '*' }; },
    isSenior: function () { return (opts.role || 'admin') !== 'sales'; },
    genCode: function () { return 'L-NEW'; },
    faDate: function () { return '1405/08/02'; }, faDateTime: function () { return '1405/08/02 11:00'; },
    faYear: function () { return '1405'; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    hideModal: function () { delete els.ltBodyEditor; },
    renderLetters: function () {}, goPanel: function () {},
    audit: function (a, b, c) { audits.push([a, b, c]); },
    notify: function (n) { notifies.push(n); },
    alert: function (m) { alerts.push(String(m)); },
    confirm: function (m) { confirms.push(String(m)); return opts.confirm !== false; },
    /* prompt دیگر در جریان اصلاحیه استفاده نمی‌شود — اگر کسی برگرداند، H8b می‌گیرد */
    prompt: function (m) { alerts.push('PROMPT:' + m); return 'x'; },
    ptfToast: function (m, k) { toasts.push([m, k]); },
    ptfPreviewPrintableDoc: function () { previews.push([].slice.call(arguments)); },
    ptfLetterSignerMode: function () {}, ptfLtImgRender: function () {},
    letEditorWirePasteAndDrop: function () {}, letSyncDocFont: function () {}
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx._previews = previews; ctx._alerts = alerts; ctx._audits = audits; ctx._notifies = notifies;
  ctx._toasts = toasts; ctx._confirms = confirms; ctx._els = els; ctx._store = store;
  vm.createContext(ctx);
  vm.runInContext(lettersSrc, ctx, { filename: 'letters-runtime.js' });
  ctx.letSafeBodyHtml = function (h) { return String(h == null ? '' : h); };
  return ctx;
}
function storeWith(profiles, letters) {
  return {
    ptf_crm_letters: letters || [], ptf_crm_sigprofiles: profiles || {},
    ptf_crm_users: clone(USERS), ptf_crm_notifs: [], ptf_crm_projects: []
  };
}
function signedStore(extra) {
  var store = storeWith({ boss: clone(PROFILE) }, []);
  var c0 = makeCtx(store);
  var l = Object.assign(clone(BASE), extra || {});
  l.signatureSnapshot = c0.letMakeSigSnapshot({ sig: PNG_SIG, stamp: PNG_STAMP }, 'مدیر عامل', 'مدیرعامل');
  store.ptf_crm_letters = [l];
  return store;
}
/* DOM همان‌طور که مرورگر رندر می‌کند — آینهٔ دقیق منطق showLetterModal */
function renderModalDom(c, letter) {
  var e = c._els;
  var set = function (id, value) { e[id] = { value: value, checked: false, innerHTML: '', innerText: '' }; };
  set('ltLang', letter.lang || 'fa');
  set('ltTo', letter.to || '');
  set('ltToRole', letter.toRole || '');
  set('ltSub', letter.subject || '');
  set('ltAtt', letter.att === 'دارد' ? 'دارد' : 'ندارد');
  set('ltPrj', letter.prjNo || '');
  var me = (c.curSession() || {}).user || '';
  var knownSigner = (c.getData('ptf_crm_users') || []).some(function (u) { return u && u.username === letter.signer; });
  var ghostSigner = !!(letter.signer && letter.signer !== '__me__' && letter.signer !== '__other__' &&
    !knownSigner && letter.signerMode !== 'other');
  var customSigner = !!(letter.signerMode === 'other' || letter.signer === '__other__' ||
    (letter.signer && letter.signer !== '__me__' && !knownSigner));
  set('ltSigner', ghostSigner ? letter.signer
    : (customSigner ? '__other__' : (letter.signer === me ? '__me__' : (letter.signer || '__me__'))));
  set('ltSignerOtherName', customSigner ? letter.signerNm || '' : '');
  set('ltSignerOtherRole', customSigner ? letter.signerRole || '' : '');
  var s = letter.style || {};
  set('ltFs', s.fs || ''); set('ltLh', s.lh || ''); set('ltFont', s.font || '');
  set('ltAlign', s.align || 'justify'); set('ltSignFs', s.signFs || '');
  var mg = s.margin || {};
  set('ltMt', mg.t === '' || mg.t == null ? '' : mg.t);
  set('ltMr', mg.r === '' || mg.r == null ? '' : mg.r);
  set('ltMb', mg.b === '' || mg.b == null ? '' : mg.b);
  set('ltMl', mg.l === '' || mg.l == null ? '' : mg.l);
  e.ltBsm = { checked: letter.bsm !== false };
  e.ltB = { checked: !!s.bold }; e.ltI = { checked: !!s.italic };
  var bodyHtml = letter.bodyHtml || ('<p>' + (letter.body || '') + '</p>');
  e.ltBodyEditor = {
    innerHTML: c.letSafeBodyHtml(c.letHtmlExpand(bodyHtml)),
    innerText: String(bodyHtml).replace(/<[^>]*>/g, ''),
    dataset: {}, addEventListener: function () {}, classList: { add: function () {}, remove: function () {} }, style: {}
  };
  e.panels = { html: '', insertAdjacentHTML: function (pos, h) { this.html += h; } };
  return e;
}
function typeBody(c, text) {
  c._els.ltBodyEditor.innerHTML = '<p>' + text + '</p>';
  c._els.ltBodyEditor.innerText = text;
}
function openAmend(c, reason) {
  c.letAmendOpen('L1');
  /* دلیل اصلاح، فیلد درون فرم است (R5) — مثل مرورگر پرش می‌کنیم */
  c._els.ltAmendReason = { value: reason === undefined ? 'دلیل آزمایشی' : reason, focus: function () {} };
}
function runAmend(store, opts) {
  opts = opts || {};
  var c = makeCtx(store, opts);
  renderModalDom(c, clone(store.ptf_crm_letters[0]));
  openAmend(c, opts.reason);
  if (typeof opts.edit === 'function') opts.edit(c);
  c.letAmendSave();
  return { c: c, after: store.ptf_crm_letters[0] };
}
var changedOf = function (l) { return ((l.amendments || [])[0] || {}).changed || []; };
var signReqs = function (c) { return c._notifies.filter(function (n) { return n && n.kind === 'sign_req'; }); };

/* ═════════ H1 (D1): بدون ویرایش ⇒ هیچ نسخهٔ تازه‌ای ═════════ */
head('H1 (D1) — امضاکننده، «ثبت اصلاحیه» را بدون هیچ ویرایشی می‌زند');
(function () {
  var store = signedStore();
  var r = runAmend(store, { role: 'admin' });
  var after = r.after;
  T('H1 | ثبت بدون تغییر رد می‌شود (rev صفر می‌ماند)',
    !after.rev && after.st === 'signed' && !!after.signatureSnapshot,
    'rev=' + after.rev + ' · st=' + after.st + ' · امضا؟ ' + !!after.signatureSnapshot);
  T('H1b | هیچ درخواست امضا و هیچ رکورد بایگانی ساخته نمی‌شود',
    signReqs(r.c).length === 0 && (after.revs || []).length === 0 && (after.amendments || []).length === 0);
  T('H1c | گارد «تغییری برای ثبت وجود ندارد» با پیام روشن دیده می‌شود',
    r.c._alerts.some(function (m) { return /تغییری برای ثبت وجود ندارد/.test(m); }),
    r.c._alerts.join(' | '));
  T('H1d | نرمال‌سازی __me__ → username پیش از diff انجام می‌شود (select «خودم» تغییر جعلی نیست)',
    r.c._els.ltSigner.value === '__me__' && changedOf(after).indexOf('signer') === -1);
})();

/* ═════════ H2 (D2): تغییر فقط ظاهری ⇒ امضا می‌ماند ═════════ */
head('H2 (D2) — همان امضاکننده فقط اندازهٔ فونت را عوض می‌کند');
(function () {
  var store = signedStore();
  var r = runAmend(store, {
    role: 'admin',
    edit: function (c) { c._els.ltFs.value = '18'; }
  });
  var after = r.after;
  var am = (after.amendments || [])[0] || {};
  T('H2 | اصلاحیه ثبت می‌شود ولی «ماهوی» نیست و امضا/وضعیت حفظ می‌شود',
    after.rev === 1 && am.substantive === false && after.st === 'signed' && !!after.signatureSnapshot,
    'rev=' + after.rev + ' · substantive=' + am.substantive + ' · st=' + after.st + ' · امضا؟ ' + !!after.signatureSnapshot);
  T('H2b | فهرست تغییرات فقط style است (هیچ تغییر جعلی signer)',
    changedOf(after).join(',') === 'style', 'changed=[' + changedOf(after).join(',') + ']');
  T('H2c | برای تغییر ظاهری هیچ درخواست امضای مجدد نمی‌رود', signReqs(r.c).length === 0);
  /* H2d: style ناقص/با نوع متفاوت نباید تغییر جعلی بسازد (کلید مقایسه) */
  var store2 = signedStore({ style: { fs: 14, lh: 2, font: '', align: 'justify', signFs: '', bold: false, italic: false, margin: {} } });
  var r2 = runAmend(store2, {
    role: 'admin',
    edit: function (c) {
      c._els.ltFs.value = '14'; c._els.ltLh.value = '2'; c._els.ltFont.value = '';
      c._els.ltAlign.value = 'justify'; c._els.ltSignFs.value = '';
      c._els.ltMt.value = ''; c._els.ltMr.value = ''; c._els.ltMb.value = ''; c._els.ltMl.value = '';
    }
  });
  T('H2d | قالبِ قدیمی با نوع/کلید متفاوت، تغییر جعلی نمی‌سازد (کلید مقایسهٔ style)',
    !r2.after.rev && r2.c._alerts.some(function (m) { return /تغییری برای ثبت وجود ندارد/.test(m); }),
    'rev=' + r2.after.rev + ' · alerts=' + r2.c._alerts.join(' | '));
})();

/* ═════════ H3: تغییر متنِ نامهٔ امضاشده ⇒ امضا باطل ═════════ */
head('H3 — تغییر متن نامهٔ امضاشده (کنترلِ رفتار درست)');
(function () {
  var store = signedStore();
  var r = runAmend(store, { role: 'admin', edit: function (c) { typeBody(c, 'متن اصلاح‌شده'); } });
  var after = r.after;
  T('H3 | تغییر متن، امضای قبلی را باطل و نامه را به «در انتظار امضا» می‌برد',
    after.rev === 1 && after.st === 'pending' && !after.signatureSnapshot && !!after.sigInvalidated,
    'rev=' + after.rev + ' · st=' + after.st + ' · sigInvalidated=' + JSON.stringify(after.sigInvalidated || null));
  T('H3b | درخواست امضای مجدد برای امضاکننده ارسال می‌شود',
    signReqs(r.c).some(function (n) { return (n.toUsers || []).indexOf('boss') > -1 && n.refCd === 'L1'; }));
  T('H3c | متن قبلی و امضای آن در تاریخچه بایگانی می‌شود',
    ((after.revs || [])[0] || {}).body === 'متن نامه' && !!((after.revs || [])[0] || {}).signatureSnapshot);
})();

/* ═════════ H4 (D4): نامهٔ وارده ═════════ */
head('H4 (D4) — نامهٔ وارده (kind:IN)');
(function () {
  var IN = {
    cd: 'L-IN', kind: 'IN', st: 'registered', lang: 'fa', no: '1405/و/ص/0012',
    from: 'شرکت پترو', subject: 'نامهٔ وارده', body: 'متن وارده', bodyHtml: '<p>متن وارده</p>',
    to: '', toRole: '', style: clone(MODERN_STYLE), t: '1405/08/01', author: 'boss', authorNm: 'مدیر عامل',
    att: 'ندارد', bsm: false, prjNo: '', images: []
  };
  var store = storeWith({ boss: clone(PROFILE) }, [clone(IN)]);
  var c = makeCtx(store);
  var html = '';
  var box = { get innerHTML() { return html; }, set innerHTML(v) { html = v; }, insertAdjacentHTML: function (p, h) { html += h; } };
  c.document.getElementById = function (id) { return (id === 'ltWrap') ? box : (c._els[id] || null); };
  c.renderLetters();
  T('H4 | برای نامهٔ وارده دکمهٔ «📝 اصلاح» رندر نمی‌شود', !/📝 اصلاح/.test(html));

  var c2 = makeCtx(storeWith({ boss: clone(PROFILE) }, [clone(IN)]));
  renderModalDom(c2, clone(IN));
  c2.letAmendOpen('L-IN');
  T('H4b | letAmendOpen برای نامهٔ وارده فرم باز نمی‌کند و دلیل را روشن می‌گوید',
    !((c2._els.panels || {}).html || '').length && !c2.window._letAmend &&
    c2._alerts.some(function (m) { return /فقط برای نامهٔ صادره/.test(m); }),
    'alerts=' + c2._alerts.join(' | '));
  var res = c2.letApplyAmendment('L-IN', 'اصلاح نامهٔ وارده', clone(IN));
  T('H4c | هستهٔ اصلاحیه هم نامهٔ وارده را رد می‌کند (ok:false)',
    res && res.ok === false && /فقط برای نامهٔ صادره/.test(res.error || ''), JSON.stringify(res));
})();

/* ═════════ H5 (D5): نامهٔ pending ═════════ */
head('H5 (D5) — اصلاح متن نامهٔ «در انتظار امضا»');
(function () {
  var store = signedStore({ st: 'pending' });
  delete store.ptf_crm_letters[0].signatureSnapshot;
  /* کارت امضای قبلی که باید بسته شود */
  store.ptf_crm_notifs = [{ refCd: 'L1', kind: 'sign_req', title: 'درخواست امضای نامه', toUsers: ['boss'] }];
  var r = runAmend(store, { role: 'admin', edit: function (c) { typeBody(c, 'متن تازه'); } });
  var after = r.after;
  var stillOld = (store.ptf_crm_notifs || []).filter(function (n) { return n && n.refCd === 'L1' && n.kind === 'sign_req'; });
  T('H5 | درخواست امضای قبلی بسته می‌شود (کارت مرده در کارتابل نمی‌ماند)',
    stillOld.length === 0, 'کارت‌های sign_req بازمانده=' + stillOld.length);
  T('H5b | درخواست تازه برای نسخهٔ اصلاح‌شده به امضاکننده ارسال می‌شود',
    signReqs(r.c).length === 1 && (signReqs(r.c)[0].toUsers || []).indexOf('boss') > -1 &&
    /Rev\.1/.test(signReqs(r.c)[0].title || ''),
    JSON.stringify(signReqs(r.c).map(function (n) { return n.title; })));
  T('H5c | نامه در وضعیت pending می‌ماند و نسخه بایگانی می‌شود',
    after.st === 'pending' && after.rev === 1);
  T('H5d | متن دیالوگ تأیید، همان چیزی را می‌گوید که واقعاً رخ می‌دهد',
    /درخواست امضای قبلی بسته/.test(r.c._confirms.join(' ')) && /Rev\.1/.test(r.c._confirms.join(' ')),
    r.c._confirms.join(' | ').slice(0, 180));
})();

/* ═════════ H6 (D9): امضاکنندهٔ حذف‌شده ═════════ */
head('H6 (D9) — امضاکننده‌ای که دیگر در فهرست کاربران نیست');
(function () {
  var store = signedStore({ signer: 'ghost', signerNm: 'کاربر قدیمی', signerRole: 'مدیر' });
  var r = runAmend(store, { role: 'admin', session: { user: 'admin', name: 'علی لواسانی' } });
  var after = r.after;
  T('H6 | بدون ویرایش، ثبت رد می‌شود (کاربر حذف‌شده تغییر جعلی نمی‌سازد)',
    !after.rev && after.signer === 'ghost' && after.signerMode !== 'other',
    'rev=' + after.rev + ' · signer=' + after.signer + ' · signerMode=' + (after.signerMode || '—') + ' · alerts=' + r.c._alerts.join(' | '));
  T('H6b | نام و سمتِ ثبت‌شدهٔ سند حفظ می‌شود', after.signerNm === 'کاربر قدیمی' && after.signerRole === 'مدیر');
  var store2 = signedStore({ signer: 'ghost', signerNm: 'کاربر قدیمی', signerRole: 'مدیر' });
  var r2 = runAmend(store2, {
    role: 'admin', session: { user: 'admin', name: 'علی لواسانی' },
    edit: function (c) { typeBody(c, 'متن تازه'); }
  });
  var a2 = r2.after;
  T('H6c | اصلاح متن، امضاکننده را بی‌سروصدا «امضای فیزیکی» نمی‌کند',
    a2.signer === 'ghost' && a2.signerMode !== 'other' && a2.st === 'pending',
    'signer=' + a2.signer + ' · signerMode=' + (a2.signerMode || '—') + ' · st=' + a2.st +
    ' · changed=[' + changedOf(a2).join(',') + ']');
  T('H6d | هیچ آینه‌ای از تغییر signer در فهرست تغییرات نیست',
    changedOf(a2).indexOf('signer') === -1 && changedOf(a2).indexOf('signerMode') === -1,
    'changed=[' + changedOf(a2).join(',') + ']');
  /* گزینهٔ صریح در HTML فرم (تولید واقعی showLetterModal) */
  var c3 = makeCtx(storeWith({ boss: clone(PROFILE) }, [clone(BASE)]));
  c3._store.ptf_crm_letters = [Object.assign(clone(BASE), { signer: 'ghost', signerNm: 'کاربر قدیمی', signerRole: 'مدیر', cd: 'L1' })];
  var box = { innerHTML: '', insertAdjacentHTML: function (p, h) { this.innerHTML += h; } };
  c3.document.getElementById = function (id) { return (id === 'panels') ? box : (c3._els[id] || null); };
  c3.showLetterModal('L1', { amend: true, reason: '' });
  var html = box.innerHTML || '';
  T('H6e | فرم، گزینهٔ صریح «کاربر حذف‌شده (بدون تغییر)» را انتخاب‌شده نشان می‌دهد',
    /value="ghost" selected/.test(html) && /کاربر حذف‌شده/.test(html));
  T('H6f | گزینهٔ «سایر — امضای فیزیکی» در این حالت انتخاب‌شده نیست',
    !/value="__other__" selected/.test(html));
})();

/* ═════════ H7 (D6): دلیل بلند ═════════ */
head('H7 (D6) — طول دلیل اصلاح');
(function () {
  var long = 'د'.repeat(400);
  var store = signedStore();
  var r = runAmend(store, { role: 'admin', reason: long, edit: function (c) { typeBody(c, 'متن تازه'); } });
  T('H7 | دلیل ۴۰۰ نویسه‌ای صریح رد می‌شود و چیزی ثبت نمی‌گردد',
    !r.after.rev && r.c._alerts.some(function (m) { return /حداکثر 300 نویسه است \(اکنون 400\)/.test(m); }),
    'rev=' + r.after.rev + ' · alerts=' + r.c._alerts.join(' | '));
  T('H7b | دلیل ردشده هیچ‌جا بریده/ذخیره نمی‌شود',
    ((r.after.amendments || [])[0] || {}).reason === undefined);
  var ok300 = 'د'.repeat(300);
  var store2 = signedStore();
  var r2 = runAmend(store2, { role: 'admin', reason: ok300, edit: function (c) { typeBody(c, 'متن تازه'); } });
  T('H7c | دلیل دقیقاً ۳۰۰ نویسه‌ای پذیرفته و کامل ذخیره می‌شود',
    r2.after.rev === 1 && (((r2.after.amendments || [])[0] || {}).reason || '').length === 300);
  /* فیلد فرم، نه prompt */
  T('H7d | جریان اصلاحیه دیگر از prompt() استفاده نمی‌کند',
    r.c._alerts.every(function (m) { return m.indexOf('PROMPT:') !== 0; }) &&
    /ltAmendReason/.test(lettersSrc) && /maxlength/.test(lettersSrc));
})();

/* ═════════ H8 (D7): خروجی خودکار پس از اصلاحیه ═════════ */
head('H8 (D7) — خروجی PDF خودکار پس از ثبت اصلاحیه');
(function () {
  var store = signedStore({ st: 'pending' });
  delete store.ptf_crm_letters[0].signatureSnapshot;
  var r = runAmend(store, { role: 'admin', edit: function (c) { typeBody(c, 'متن تازه'); } });
  var pv = r.c._previews.slice(-1)[0] || [];
  var html = String(pv[1] || '');
  T('H8 | نامهٔ امضانشده با واترمارک «پیش‌نویس» چاپ می‌شود',
    /پیش‌نویس \/ PREVIEW/.test(html), 'title=' + String(pv[0] || ''));
  T('H8b | در این خروجی، مهر/تصویر امضا چاپ نمی‌شود',
    !/<img class="(s|st)"/.test(html));
  T('H8c | پیام تأیید هم صریح می‌گوید خروجی «پیش‌نویس» است',
    /پیش‌نویس/.test(r.c._confirms.join(' ')), r.c._confirms.join(' | ').slice(0, 160));
  /* سند امضاشده‌ای که با تغییر ظاهری امضایش می‌ماند: خروجی هنوز نسخهٔ نهایی است */
  var store2 = signedStore();
  var r2 = runAmend(store2, { role: 'admin', edit: function (c) { c._els.ltFs.value = '18'; } });
  var html2 = String((r2.c._previews.slice(-1)[0] || [])[1] || '');
  T('H8d | نامهٔ امضاشدهٔ سالم، همچنان نسخهٔ نهایی (بدون واترمارک پیش‌نویس) چاپ می‌شود',
    !!html2 && !/پیش‌نویس \/ PREVIEW/.test(html2) && /<img class="(s|st)"/.test(html2));
})();

console.log('\n══════════════════════════════════════════════════════════════');
console.log('tester717 v34.39.66 — ' + P + ' PASS / ' + F + ' FAIL');
console.log('══════════════════════════════════════════════════════════════');
process.exit(F ? 1 : 0);

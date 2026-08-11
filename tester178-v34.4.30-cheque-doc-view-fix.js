/* CHQ-DOC-001 fixture (client request, 2026-08-10, Persian):
   "بعضی جاها مانند ثبت چک در بخش مالی می‌توان عکس چک را داد اما وقتی رجوع
   می‌کنیم دیگر جایی برای دیدنش وجود ندارد؛ در حساب تامین‌کنندگان هم چک کن."

   Root causes found and fixed:
   1. crm/cheque-panel.js — the issued/received cheque row actions had no
      direct "view attachment" button; the only path was opening the full
      "Edit" modal. A new standalone "📎 سند" button + ptfChequeFilesUi() was
      added to every row so the photo is reachable without editing the cheque.
   2. crm/cheque-panel.js — ptfChEditRemoveFile() read window._ptfChEditCd,
      which was only ever set inside ptfChequeEditSave() (never inside
      ptfChequeEditUi(), the function that renders the ✕ delete button). The
      delete button silently no-op'd until the user saved once. Fixed by
      setting window._ptfChEditCd at the top of ptfChequeEditUi().
   3. crm/cheque-panel.js also carried a dead duplicate ptfChequeEditUi/
      ptfChequeEditSave pair (older, without files support) that was always
      shadowed by the later definition — removed as dead code.
   4. crm/supplier-finance.js — the "ثبت پرداخت" (payment) dialog for a
      supplier's "چک شرکت"/"چک ثالث" method had NO file upload field at all,
      and once a file was force-added later via slPaymentAddFile(), nothing
      ever displayed or allowed removing it (payRows had no file column, and
      slPaymentEdit had no file section). Fixed: upload widget added to the
      payment dialog; files flow into both the payment record and the
      generated cheque record; payRows now shows view/delete links; and
      slPaymentEdit now lists/adds/removes files exactly like slInvoiceEdit.
   5. crm/rbac.js — the customer "ثبت وصولی" (collection) dialog for method
      "چک" also had no attachment field; added for parity.

   This fixture verifies (1)-(3) functionally via vm (loading the real
   cheque-module.js + cheque-panel.js), and (4)-(5) structurally against the
   real source (supplier-finance.js / rbac.js are too DOM/dialog-heavy to
   fully sandbox here, matching the precedent set by other testers in this
   repo that mix functional + structural checks, e.g. tester161). */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');

/* ===================== Part 1: cheque-panel.js functional checks (vm) ===================== */
(function () {
  var db = {};
  var elements = {};
  function mockEl(id) {
    if (elements[id]) return elements[id];
    var el = {
      id: id, innerHTML: '', value: '', children: [],
      insertAdjacentHTML: function (pos, html) { el.innerHTML += html; },
      remove: function () { elements[id] = null; }
    };
    elements[id] = el;
    return el;
  }
  var uploadCalls = [];
  var storedFileOpens = [];
  var deleteCalls = [];
  var toasts = [];

  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Date: Date,
    localStorage: {
      getItem: function (k) { return db[k] !== undefined ? JSON.stringify(db[k]) : null; },
      setItem: function (k, v) { db[k] = JSON.parse(v); }
    },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v).replace(/'/g, ''); },
    genCode: function (p) { return p + '-' + Math.floor(Math.random() * 100000); },
    faDate: function () { return '1405/05/19'; }, faDateTime: function () { return '1405/05/19 10:00'; }, faDateTimeL: function () { return '1405/05/19 10:00:00'; },
    audit: function () {}, ptfToast: function (msg, kind) { toasts.push({ msg: msg, kind: kind }); },
    curSession: function () { return { user: 'commercialUser', name: 'مدیر بازرگانی' }; },
    curRole: function () { return 'commercial'; },
    ptfNum: function (v) { return +String(v == null ? '' : v).replace(/,/g, '') || 0; },
    ptfJToISO: function (v) { return v; }, ptfISOToJ: function (v) { return v; },
    money: function (v) { return String(v); },
    alert: function () {}, confirm: function () { return true; },
    setInterval: function () { return 0; }, setTimeout: function (fn) { fn(); return 0; },
    STORAGE_API: 'api/storage.php',
    ptfStorageAuthHeaders: function () { return {}; },
    fetch: function (url, opts) { deleteCalls.push({ url: url, opts: opts }); return { catch: function () {} }; },
    ptfDeleteStoredFile: function (key, cb) { deleteCalls.push({ key: key }); cb({ ok: true }); },
    openStoredFile: function (key) { storedFileOpens.push(key); },
    attachUploadWidget: function (containerId, folder, onDone) { uploadCalls.push({ containerId: containerId, folder: folder, onDone: onDone }); },
    ptfTopZIndex: function (z) { return z; },
    ptfChequePanelRender: function () {},
    document: {
      getElementById: function (id) { return elements[id] || null; },
      body: { insertAdjacentHTML: function (pos, html) { mockEl('__body__').innerHTML += html; } },
      querySelectorAll: function () { return []; }
    }
  };
  ctx.getData = function (k) { try { return JSON.parse(ctx.localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  ctx.setData = function (k, v) { ctx.localStorage.setItem(k, JSON.stringify(v)); };
  ctx.panelsEl = mockEl('panels');
  ctx.document.getElementById = function (id) { if (id === 'panels') return ctx.panelsEl; return elements[id] || null; };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('crm/cheque-module.js', 'utf8'), ctx, { filename: 'cheque-module.js' });
  vm.runInContext(fs.readFileSync('crm/cheque-panel.js', 'utf8'), ctx, { filename: 'cheque-panel.js' });

  /* --- Sanity: only one live ptfChequeEditUi definition (dead duplicate removed) --- */
  var panelSrc = fs.readFileSync('crm/cheque-panel.js', 'utf8');
  var editUiDefs = panelSrc.match(/window\.ptfChequeEditUi\s*=\s*function/g) || [];
  assert.strictEqual(editUiDefs.length, 1, 'CHQ-DOC-001: dead duplicate ptfChequeEditUi must be removed (exactly one definition should remain)');

  /* --- Create an issued cheque with one attached file --- */
  var cheque = ctx.window.ptfChequeCreate('issued', {
    no: 'CHQ-1001', sayad: '11112222333344445555', amt: 5000000, toWhom: 'تامین‌کننده تست',
    bank: 'ملت', kind: 'finance', files: [{ key: 'cheques/cheque-1001.jpg', name: 'cheque-1001.jpg', t: '1405/05/19' }]
  });
  assert.ok(cheque && cheque.cd, 'چک باید ساخته شود');
  assert.strictEqual((cheque.files || []).length, 1, 'چک باید یک سند ضمیمه داشته باشد');

  /* --- FIX #1: standalone quick "docs" viewer must exist and must render the existing file with a working view link --- */
  assert.strictEqual(typeof ctx.window.ptfChequeFilesUi, 'function', 'CHQ-DOC-001: ptfChequeFilesUi باید تعریف شده باشد (دکمهٔ سریع «📎 سند»)');
  ctx.window.ptfChequeFilesUi(cheque.cd);
  assert.ok(ctx.panelsEl.innerHTML.indexOf('ptfChFilesDlg') > -1, 'دیالوگ مشاهدهٔ سریع سند باید باز شود');
  assert.ok(ctx.panelsEl.innerHTML.indexOf('cheque-1001.jpg') > -1, 'نام فایل موجود باید در دیالوگ نمایش داده شود');
  assert.ok(ctx.panelsEl.innerHTML.indexOf("openStoredFile('cheques/cheque-1001.jpg')") > -1, 'لینک «مشاهده» باید به‌درستی کلید فایل را صدا بزند');
  assert.strictEqual(uploadCalls.length > 0 && uploadCalls[uploadCalls.length - 1].folder, 'cheques/', 'ویجت افزودن سند جدید باید در همان دیالوگ فعال شود');

  /* --- Quick delete from the standalone viewer must actually remove the file --- */
  ctx.window.ptfChequeQuickRemoveFile('cheques/cheque-1001.jpg');
  var updated = ctx.window.ptfChequeFind(cheque.cd);
  assert.strictEqual((updated.files || []).length, 0, 'حذف سریع باید فایل را از چک حذف کند');
  assert.ok(deleteCalls.length > 0, 'حذف سریع باید درخواست حذف از فضای ابری هم بفرستد');

  /* --- Row actions must expose the docs button on both issued and received rows --- */
  ctx.window.ptfChequeCreate('received', {
    no: 'CHQ-R-1', sayad: '12312312312312312312', amt: 2000000, payerName: 'مشتری تست', bank: 'صادرات', kind: 'finance',
    files: [{ key: 'cheques/cheque-r1.jpg', name: 'cheque-r1.jpg', t: '1405/05/19' }]
  });
  ctx.window.ptfChequePanelSub = 'issued';
  var issuedHtml = ctx.window.ptfChequePanelHtml();
  assert.ok(issuedHtml.indexOf('ptfChequeFilesUi(') > -1, 'ردیف چک صادره باید دکمهٔ سند مستقل داشته باشد');
  ctx.window.ptfChequePanelSub = 'received';
  var receivedHtml = ctx.window.ptfChequePanelHtml();
  assert.ok(receivedHtml.indexOf('ptfChequeFilesUi(') > -1, 'ردیف چک وارده باید دکمهٔ سند مستقل داشته باشد');

  /* --- FIX #2: window._ptfChEditCd must be set as soon as the edit modal opens, not only after Save --- */
  var cheque2 = ctx.window.ptfChequeCreate('issued', {
    no: 'CHQ-1002', sayad: '99998888777766665555', amt: 1000000, toWhom: 'تست ۲', bank: 'ملی', kind: 'finance',
    files: [{ key: 'cheques/cheque-1002.jpg', name: 'cheque-1002.jpg', t: '1405/05/19' }]
  });
  ctx.window._ptfChEditCd = undefined; /* simulate a fresh session where Save was never clicked yet */
  ctx.window.ptfChequeEditUi(cheque2.cd);
  assert.strictEqual(ctx.window._ptfChEditCd, cheque2.cd, 'CHQ-DOC-001: باز کردن مودال ویرایش باید بلافاصله _ptfChEditCd را ست کند (نه فقط هنگام ذخیره)');
  /* Now the ✕ delete button (ptfChEditRemoveFile) must work immediately, without ever calling Save first */
  ctx.window.ptfChEditRemoveFile('cheques/cheque-1002.jpg');
  var afterQuickDelete = ctx.window.ptfChequeFind(cheque2.cd);
  assert.strictEqual((afterQuickDelete.files || []).length, 0, 'CHQ-DOC-001: دکمهٔ حذف سند در مودال ویرایش باید بلافاصله بعد از باز شدن (بدون ذخیرهٔ قبلی) کار کند');

  console.log('PASS tester178 Part 1: cheque-panel.js standalone doc viewer + edit-modal delete-file bug fix (5 checks)');
})();

/* ===================== Part 2: supplier-finance.js structural checks ===================== */
(function () {
  var src = fs.readFileSync('crm/supplier-finance.js', 'utf8');
  assert.ok(/function slChequeCreate\(method, sup, amount, cur, payCd, date, files\)/.test(src), 'slChequeCreate باید پارامتر files بپذیرد');
  assert.ok(src.indexOf("files: (files || []).slice()") > -1, 'رکورد چکِ ساخته‌شده از حساب تأمین‌کننده باید سند را نگه دارد');
  assert.ok(src.indexOf('id="slPayFileWrap"') > -1, 'فرم «ثبت پرداخت» باید فیلد آپلود عکس/کپی چک داشته باشد');
  assert.ok(src.indexOf("attachUploadWidget('slPayFileWrap'") > -1, 'ویجت آپلود باید برای فرم پرداخت فعال شود');
  assert.ok(/var ch = slChequeCreate\(method, sup, amount, cur, payCd, date, payFiles\)/.test(src), 'slPaymentSave باید فایل‌های انتخاب‌شده را به چک بفرستد');
  assert.ok(/files:\s*payFiles/.test(src), 'رکورد پرداخت هم باید فایل‌ها را نگه دارد');
  assert.ok(src.indexOf('window.slPaymentRemoveFile') > -1, 'حذف سند پرداخت باید ممکن باشد (slPaymentRemoveFile)');
  assert.ok(src.indexOf("onclick=\"slPaymentRemoveFile(") > -1, 'ردیف پرداخت در گردش حساب باید لینک حذف سند داشته باشد');
  assert.ok(src.indexOf('<th>فایل</th>') > -1 && src.indexOf('پرداخت‌ها و اعتبار') > -1, 'جدول پرداخت‌ها باید ستون «فایل» داشته باشد');
  assert.ok(src.indexOf('slPayEditFilesUp') > -1, 'مودال ویرایش پرداخت باید بخش مدیریت سند داشته باشد (مثل ویرایش فاکتور)');
  console.log('PASS tester178 Part 2: supplier-finance.js payment cheque attachment view/delete (9 structural checks)');
})();

/* ===================== Part 3: rbac.js structural check (customer collection by cheque) ===================== */
(function () {
  var src = fs.readFileSync('crm/rbac.js', 'utf8');
  assert.ok(src.indexOf('id="nPayChFileWrap"') > -1, 'فرم «ثبت وصولی» با چک باید فیلد آپلود عکس چک داشته باشد');
  assert.ok(src.indexOf("attachUploadWidget('nPayChFileWrap'") > -1, 'ویجت آپلود باید برای فرم وصولی فعال شود');
  assert.ok(/files:\s*\(window\._nPayChFiles \|\| \[\]\)\.slice\(\)/.test(src), 'چک وارده ساخته‌شده از وصولی مشتری باید سند را نگه دارد');
  console.log('PASS tester178 Part 3: rbac.js customer collection cheque attachment (3 structural checks)');
})();

console.log('PASS tester178-v34.4.30-cheque-doc-view-fix: all parts green');

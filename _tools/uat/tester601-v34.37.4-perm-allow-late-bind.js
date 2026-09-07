#!/usr/bin/env node
/* =============================================================================
   tester601-v34.37.4-perm-allow-late-bind.js
   ریشهٔ «با اکانت رییس هیات مدیره، فهرست فاکتورها خالی است» (۱۴۰۵/۰۶/۱۴):

   ① مسیر میان‌برِ allow-override در crm/perms.js (goPanel → window._ptfPanelBuilders[id])
      بیلدرها را با setTimeout(1200ms) و با *ارجاعِ ثبت‌شده* میساخت؛ اگر تایمر پیش از
      اجرای crm/official-invoice-v2.js (≈۶۵ اسکریپت بعدتر در defer) میسوخت، پنلِ
      بازنشستۀ rbac.js برای کل نشست میخکوب میشد و رندر روی «ارجاع بی‌فاکتور» با
      TypeError: reading 'offerCurrency' میترید ⇒ فهرست خالی.
   ⇒ اکنون reg() نامِ تابع را میگیرد و در لحظهٔ *کلیک* از window میخواند (late bind).

   ② همان پنل بازنشسته (fallback واقعی اگر v2 هرگز لود نشود) حالا گارد تهی دارد.

   روش (قرارداد tester598/599/600): هر دو رفتار با vm روی کد واقعی سنجیده میشوند؛
   «آزمون جهش» با تبدیل منبع به همان منطق ثبت‌زودهنگام، بارِ تشخیصِ تست را اثبات میکند.
   ============================================================================= */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CRM = path.join(ROOT, 'crm');
const PERMS = fs.readFileSync(path.join(CRM, 'perms.js'), 'utf8');
const RBAC = fs.readFileSync(path.join(CRM, 'rbac.js'), 'utf8');
const HTML = fs.readFileSync(path.join(CRM, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' → ' + extra : '')); }
}
function head(s) { console.log('\n── ' + s + ' ──'); }

/* ── هارنس perms.js: اجرای کل IIFE با window/document/localStorage قلمی ───── */
function mkPerms(src, opts) {
  opts = opts || {};
  const calls = [];
  const alerts = [];
  const timers = [];
  const store = {
    'ptf_crm_perms': opts.perms ? JSON.stringify(opts.perms) : '{}',
    'ptf_theme': 'light',
  };
  const els = {
    panels: { innerHTML: '' },
    pgTitle: { textContent: '' },
  };
  const legacy = { build: () => 'LEGACY_BUILD', render: () => { calls.push('legacy:render'); } };
  const v2 = { build: () => 'V2_BUILD', render: () => { calls.push('v2:render'); } };
  const ctx = {
    console,
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    document: {
      getElementById: (id) => els[id] || null,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({ id: '', textContent: '', style: {} }),
      head: { appendChild: () => {} },
      body: { classList: { add: () => {}, toggle: () => {} } },
      documentElement: { style: { setProperty: () => {}, removeProperty: () => {} } },
      addEventListener: () => {},
    },
    alert: (m) => alerts.push(String(m)),
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    curSession: () => ({ user: 'chair1', name: 'رئیس', role: 'chairman', roleId: 'chairman' }),
    curRole: () => 'chairman',
    ROLES: {
      chairman: { lb: 'رییس هیات مدیره', users: true, panels: '*', finance: true },
      sales: { lb: 'فروش', users: false, panels: ['dash'], finance: false },
    },
    roleDef: () => ctx.ROLES.chairman,
    getData: () => [],
    setData: () => {},
    ptfEntitySaveCollection: () => {},
    audit: () => {}, hideModal: () => {}, ptfToast: () => {},
    escP: (x) => String(x == null ? '' : x),
    ptfOnClickArg: (x) => String(x == null ? '' : x),
  };
  ctx.window = ctx;
  /* goPanel پایه (قبل از perms.js در index.html اینلاین تعریف است) */
  ctx.goPanel = function (id) { calls.push('base:' + id); };
  /* پنل بازنشستهٔ rbac.js که *زودتر* از perms.js روی window نشسته است */
  ctx.buildInvoices = legacy.build; ctx.renderInvoices = legacy.render;
  ctx.buildReceivables = () => 'x'; ctx.renderReceivables = () => calls.push('legacy:recv');
  vm.createContext(ctx);
  vm.runInContext(src + '\n', ctx, { filename: 'perms-harn.js' });
  return {
    ctx, calls, alerts, els, timers, store,
    loadV2() { ctx.buildInvoices = v2.build; ctx.renderInvoices = v2.render; },
    fireTimers() { const q = timers.splice(0); q.forEach((f) => { try { f(); } catch (e) {} }); },
    go(id) { ctx.goPanel(id, null); },
  };
}

/* ── ۱) رفتار: میان‌بر allow-override باید پنلِ «زمانِ کلیک» را اجرا کند ───── */
head('۱. late binding در مسیر allow-override (crm/perms.js)');
{
  const h = mkPerms(PERMS, { perms: { chair1: { inv: 'allow' } } });
  h.fireTimers();          /* تایمرها (۱۲۰۰ms) میسوزند — در کد قدیمی همین‌جا capture رخ میداد */
  h.loadV2();              /* official-invoice-v2.js با تاخیر لود و بازنویسی میکند */
  h.go('inv');
  T('۱.۱ پس از بازنویسی v2، کلیک روی «فاکتورها» رندرِ v2 را اجرا میکند (نه بازنشستهٔ میخکوب)',
    h.calls.indexOf('v2:render') > -1 && h.calls.indexOf('legacy:render') === -1, h.calls.join(','));
  T('۱.۲ بدنۀ پنل از buildInvoicesِ جاری window ساخته میشود', h.els.panels.innerHTML === 'V2_BUILD', h.els.panels.innerHTML);
  T('۱.۳ مسیر allow، goPanel پایه را دور میزند (فقط یک فراخوانی render)', h.calls.length === 1, h.calls.join(','));

  const g = mkPerms(PERMS, { perms: { chair1: { inv: 'allow' } } });
  g.go('inv');             /* کلیکِ زودهنگام — پیش از سوختن تایمر ۱۲۰۰ms */
  T('۱.۴ ثبت بیلدرها فوری است؛ کلیک زیر ۱۲۰۰ms هم پنل را میسازد (نه تهی، نه خطا)',
    g.calls.indexOf('legacy:render') > -1 && g.els.panels.innerHTML === 'LEGACY_BUILD', g.calls.join(','));
}

/* ── ۲) گاردهای نقش/override دست‌نخورده‌اند ───────────────────────────────── */
head('۲. رفتار عمومی perms.js (بدون رگرسیون)');
{
  const deny = mkPerms(PERMS, { perms: { chair1: { inv: 'deny' } } });
  deny.fireTimers(); deny.loadV2(); deny.go('inv');
  T('۲.۱ deny → هیچ رندری اجرا نمیشود و alert دقیق داده میشود',
    deny.calls.length === 0 && deny.alerts.some((a) => a.indexOf('مسدود') > -1), JSON.stringify(deny.calls) + JSON.stringify(deny.alerts));
  const plain = mkPerms(PERMS, {});
  plain.fireTimers(); plain.loadV2(); plain.go('inv');
  T('۲.۲ بدون override → مسیر عادی (goPanel پایه) حفظ شد',
    plain.calls.indexOf('base:inv') > -1 && plain.calls.indexOf('v2:render') === -1, plain.calls.join(','));
  const all8 = mkPerms(PERMS, {});
  T('۲.۳ هر هشت پنلِ گارددار بیلدر دارند (let/cms/sms/rep/inv/recv/buyq/taxret)',
    ['let', 'cms', 'sms', 'rep', 'inv', 'recv', 'buyq', 'taxret'].every((id) => typeof all8.ctx._ptfPanelBuilders[id] === 'function'),
    Object.keys(all8.ctx._ptfPanelBuilders).join(','));
  /* پنلِ ماژول‌نشده: نه crash، نه رندر نیمه — پیام صادقانه */
  const miss = mkPerms(PERMS, { perms: { chair1: { taxret: 'allow' } } });
  miss.fireTimers(); miss.go('taxret');
  T('۲.۴ ماژول بارگذاری‌نشده → alert تشخیصی و رندرِ خراب نه',
    miss.alerts.some((a) => a.indexOf('بارگذاری نشده') > -1), JSON.stringify(miss.alerts));
}

/* ── ۳) آزمون جهش: همان تست با منطق «ثبت‌زودهنگام» باید بشکند ─────────────── */
head('۳. آزمون جهش (ثبوتِ بارِ تشخیص تست ۱)');
{
  const i0 = PERMS.indexOf('function reg(id, title, buildName, renderName) {');
  const i1 = PERMS.indexOf('var PTF_PERM_PANELS', i0);
  if (i0 < 0 || i1 < 0) { T('۳.۰ بلوک reg در perms.js پیدا شد', false, 'i0=' + i0 + ' i1=' + i1); }
  else {
    const MUT = PERMS.slice(0, i0) +
      'function reg(id, title, buildName, renderName) {\n' +
      '    var _capB = window[buildName], _capR = window[renderName]; /* رفتار پیش از v34.37.8 */\n' +
      '    window._ptfPanelBuilders[id] = function (btn) {\n' +
      '      document.getElementById("pgTitle").textContent = title;\n' +
      '      document.getElementById("panels").innerHTML = (typeof _capB === "function") ? _capB() : "";\n' +
      '      if (typeof _capR === "function") _capR();\n' +
      '    };\n' +
      '  }\n  ' +
      PERMS.slice(i1);
    const h = mkPerms(MUT, { perms: { chair1: { inv: 'allow' } } });
    h.fireTimers();
    h.loadV2();
    h.go('inv');
    T('۳.۱ با ثبت‌زودهنگام، همان سناریو به پنلِ بازنشسته قفل میشود (باگِ گزارش‌شده بازتولید شد)',
      h.calls.indexOf('legacy:render') > -1 && h.calls.indexOf('v2:render') === -1, h.calls.join(','));
    T('۳.۲ کد سالمِ امروز، همان سناریو را درست میدهد (تفاوت فقط late bind است)',
      (() => { const s = mkPerms(PERMS, { perms: { chair1: { inv: 'allow' } } }); s.fireTimers(); s.loadV2(); s.go('inv'); return s.calls.indexOf('v2:render') > -1; })());
  }
}

/* ── ۴) گارد تهی در رندر بازنشستۀ rbac.js (مسیر fallback) ────────────────── */
head('۴. renderInvoices بازنشسته: «ارجاع بی‌فاکتور» نباید پنل را بیندازد');
{
  const i0 = RBAC.indexOf('function renderInvoices() {');
  const i1 = RBAC.indexOf('function showInvModal(');
  if (i0 < 0 || i1 < 0) { T('۴.۰ برش renderInvoices از rbac.js', false, 'i0=' + i0 + ' i1=' + i1); }
  const LEGACY = RBAC.slice(i0, i1);
  const REF = { t: '۱۴۰۵/۰۶/۱۴', by: 'chairman-user', role: 'chairman' };
  function mkRender(offers, invoices, src) {
    const wrap = { innerHTML: '' };
    const ctx = {
      console,
      getData: (k) => (k === 'ptf_crm_offers' ? offers : k === 'ptf_crm_invoices' ? invoices : []),
      ptfCanSeeLedger: () => true,
      escP: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
      ptfInvoiceReceivedIRR: () => 0,
      ptfOnClickArg: (x) => String(x == null ? '' : x),
      isSenior: () => true,
      document: { getElementById: (id) => (id === 'invWrap' ? wrap : null) },
      window: {},
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext((src || LEGACY) + '\n', ctx, { filename: 'legacy-render.js' });
    try { ctx.renderInvoices(); return { html: wrap.innerHTML, err: null }; }
    catch (e) { return { html: wrap.innerHTML, err: e }; }
  }
  const orphan = [{ no: 'CO-9', buyerCd: 'C1', buyerCo: 'شرکت آریا', inqNo: 'INQ-9', items: [{ qty: 1, price: 100 }], invRef: Object.assign({}, REF) }];
  const r1 = mkRender(orphan, []);
  T('۴.۱ ارجاعِ بی‌فاکتور: هیچ throw نمیشود (باگِ گزارش‌شدۀ offerCurrency رفع است)',
    !r1.err, r1.err ? String(r1.err) : '');
  T('۴.۲ همان ردیف با دکمۀ «+ ثبت فاکتور صادره» دیده میشود (فهرست خالی نمیماند)',
    r1.html.indexOf('CO-9') > -1 && r1.html.indexOf('ثبت فاکتور صادره') > -1, r1.html.slice(0, 80));
  const eur = [{ no: 'CO-9', buyerCd: 'C1', buyerCo: 'شرکت آریا', currency: 'EUR', fxBasis: 'sana', fxRateRef: 600000, items: [{ qty: 1, price: 100 }], invRef: Object.assign({}, REF) }];
  const inv = [{ no: 'INV-1', offerNo: 'CO-9', t: '۱۴۰۵/۰۶/۱۵', amount: 60000100, status: 'active', offerCurrency: 'EUR', files: [] }];
  const r2 = mkRender(eur, inv);
  T('۴.۳ بدون رگرسیون: «مبنا: EUR» با فاکتورِ مطابقت‌یافته همچنان رندر میشود',
    !r2.err && r2.html.indexOf('مبنا: EUR') > -1 && r2.html.indexOf('INV-1') > -1, String(r2.err || '') + r2.html.slice(0, 80));
  const r3 = mkRender(orphan, [], LEGACY.replace(/\(inv && inv\.offerCurrency\)/g, 'inv.offerCurrency'));
  T('۴.۴ آزمون جهش: با حذف گارد تهی، دقیقاً همان TypeError کارفرما برمیگردد',
    !!r3.err && /offerCurrency/.test(String(r3.err)), String(r3.err));
}

/* ── ۵) قرارداد متنی (نرم، به الگو بسته — نه جمله) ───────────────────────── */
head('۵. قراردادها');
{
  T('۵.۱ reg در perms.js نامِ تابع میگیرد و window[name] را در لحظهٔ اجرا میخواند',
    /function reg\(id, title, buildName, renderName\)/.test(PERMS) && /window\[buildName\]/.test(PERMS) && /window\[renderName\]/.test(PERMS));
  T('۵.۲ هیچ ثبتِ ارجعی به style «window.renderInvoices)» باقی نمانده (capture حذف شد)',
    !/reg\('inv',[^\n]*window\.renderInvoices/.test(PERMS));
  T('۵.۳ ورودی «inv» دقیقاً به نام‌های buildInvoices/renderInvoices بسته شده',
    /'inv',\s*'[^']+',\s*'buildInvoices',\s*'renderInvoices'/.test(PERMS));
  T('۵.۴ پنل v2 همچنان window.buildInvoices/renderInvoices را بازنویسی میکند (قراردادِ وابسته)',
    /window\.buildInvoices\s*=/.test(fs.readFileSync(path.join(CRM, 'official-invoice-v2.js'), 'utf8')));
  T('۵.۵ در index.html، official-invoice-v2.js بعد از perms.js میآید (همان توالیِ منشأ ریس)',
    HTML.indexOf('perms.js?v=') > -1 && HTML.indexOf('perms.js?v=') < HTML.indexOf('official-invoice-v2.js?v='));
  T('۵.۶ گارد تهی در سه خوانشِ سطرِ «مبلغ CO» نشسته است',
    ((RBAC.match(/\(o\.currency \|\| \(inv && inv\.offerCurrency\)\)/g) || []).length >= 3),
    String((RBAC.match(/\(o\.currency \|\| \(inv && inv\.offerCurrency\)\)/g) || []).length));
  T('۵.۷ کامنت بازنشستگی rbac.js به گاردِ جدید ارجاع دارد (مستندِ درخت)',
    /INV-LEGACY-NULLGUARD/.test(RBAC));
}

console.log('\n— tester601 (v34.37.8: دیرهنگامِ بازدر مسیر allow-override + گارد تهی در رندر بازنشسته) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);

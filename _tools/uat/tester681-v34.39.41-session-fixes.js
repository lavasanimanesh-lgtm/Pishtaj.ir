/* tester681 — v34.39.43 — رگرسیون کامل همهٔ اصلاحات این نشست
   A) فوتر سایت پنج‌ستونه (site-shell.css / overrides.css + cache-bust همهٔ صفحات)
   B) حذف فوتر تماس از صفحات CRM (به‌جز قالب سربرگ)
   C) مشتری جدید در صدر فهرست (ptfCustSortNewest + renderCustomers2 واقعی)
   D) کادر سبز نسخه ارزی زیر پیشنهاد ریالی (IRR→FX) — commit واقعی + renderOffers واقعی
   E) تب‌های «ارجاع به من / با مسئول» درخواست‌ها — کد واقعی bridge.js با select شبیه‌سازی‌شده
   F) اعلان پیامک/بات ثبت استعلام و تامین‌کننده (قرارداد سورس؛ اجرای PHP در e2e-site-alert-v34.39.41.js)
   G) قرارداد بامپ نسخه v34.39.43 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var CRM = path.join(ROOT, 'crm');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
var R = { pass: 0, fail: 0 };
function T(name, cond, detail) {
  if (cond) { R.pass++; console.log('  ✔ ' + name); }
  else { R.fail++; console.log('  ✘ FAIL: ' + name + (detail !== undefined ? ' — ' + String(detail).slice(0, 240) : '')); }
}
function sliceFn(src, head) {
  var a = src.indexOf(head);
  if (a < 0) throw new Error('not found: ' + head);
  var b = src.indexOf('\n}\n', a);
  return src.slice(a, b + 2);
}

/* ================= A) فوتر پنج‌ستونه ================= */
console.log('\n[A] فوتر سایت پنج‌ستونه');
(function () {
  var shell = read('assets/css/site-shell.css');
  var ovr = read('_tools/site-shell/overrides.css');
  var R5 = '@media (min-width:1100px){#ptf-site-footer>.container:first-child{grid-template-columns:1.3fr 1fr 1fr 1fr 1.2fr!important;gap:28px!important}}';
  var R3 = '@media (min-width:791px) and (max-width:1099px){#ptf-site-footer>.container:first-child{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:28px!important}}';
  T('site-shell.css: قاعدهٔ ۵ ستون دسکتاپ', shell.indexOf(R5) > -1);
  T('site-shell.css: قاعدهٔ ۳ ستون تبلت', shell.indexOf(R3) > -1);
  T('overrides.css (منبع پوسته) با site-shell.css هم‌خوان است', ovr.indexOf(R5) > -1 && ovr.indexOf(R3) > -1);
  T('قاعدهٔ ۵ ستون پس از قاعدهٔ پایهٔ auto-fit آمده (ترتیب آبشار)', shell.lastIndexOf(R5) > shell.indexOf('#ptf-site-footer>.container:first-child{display:grid'));
  /* ریاضی چیدمان: عرض کانتینر = min(1200, vw-34)؛ قبلاً با minmax(220px) و gap 35 فقط ۴ ستون جا می‌شد */
  function autoFitCols(w, min, gap) { return Math.max(1, Math.floor((w + gap) / (min + gap))); }
  T('ریشه تأیید شد: در ۱۲۰۰px با قاعدهٔ قدیمی فقط ۴ ستون جا می‌شد', autoFitCols(1200, 220, 35) === 4, autoFitCols(1200, 220, 35));
  [1100, 1280, 1440, 1920].forEach(function (vw) {
    var cw = Math.min(1200, vw - 34), fr = [1.3, 1, 1, 1, 1.2], sum = fr.reduce(function (s, x) { return s + x; }, 0);
    var narrow = (cw - 4 * 28) / sum; /* عرض یک fr */
    T('vw=' + vw + ': پنج ستون در یک ردیف، باریک‌ترین ستون ≥ ۱۵۰px', narrow >= 150, Math.round(narrow));
  });
  (function () { var cw = 791 - 34, col = (cw - 2 * 28) / 3; T('vw=791: سه ستون، هر ستون ≥ ۲۰۰px', col >= 200, Math.round(col)); })();
  /* رقبای !important فقط در موبایل فعال‌اند */
  var mob = shell.match(/@media\s+\(max-width:790px\)\{#ptf-site-footer \.container\[style\*="grid"\]\{grid-template-columns:1fr!important/);
  T('قاعدهٔ موبایل (≤۷۹۰) تک‌ستونه دست‌نخورده مانده', !!mob);
  /* فوتر صفحه اصلی دقیقاً ۵ ستون فرزند دارد */
  var idx = read('index.html');
  var a = idx.indexOf('id="ptf-site-footer"'), seg = idx.slice(a, idx.indexOf('</footer>', a));
  var j = seg.indexOf('>', seg.indexOf('<div class="container"')) + 1, depth = 0, cnt = 0, re = /<(\/?)div\b/g, m;
  re.lastIndex = j;
  while ((m = re.exec(seg))) { if (!m[1]) { if (!depth) cnt++; depth++; } else { if (!depth) break; depth--; } }
  T('index.html: ردیف اول فوتر ۵ ستون دارد (تماس با ما آخرین ستون)', cnt === 5, cnt);
  T('grid-template-columns درون‌خطی فوتر !important ندارد (قاعدهٔ CSS برنده می‌شود)', !/grid-template-columns:[^;"]*!important/.test(seg.slice(0, 400)));
  /* آدرس در ستون تماس: خط مستقل و هم‌تراز با متن عنوان (آیکون ۲۲ + فاصله ۸ + gap ۴ = ۳۴px) */
  var ADDR = '#ptf-site-footer div>span[style*="inline-flex"]+span{display:block;padding-inline-start:34px;margin-top:2px;text-align:start}';
  T('آدرس: قاعدهٔ خط مستقل + تورفتگی ۳۴px در site-shell.css و overrides.css', shell.indexOf(ADDR) > -1 && ovr.indexOf(ADDR) > -1);
  T('آدرس موبایل (≤۶۰۰، آیکون ۲۶px): تورفتگی ۳۸px', /@media \(max-width:600px\)\{#ptf-site-footer div>span\[style\*="inline-flex"\]\+span\{padding-inline-start:38px\}\}/.test(shell));
  T('ریاضی تورفتگی با اندازهٔ آیکون فعلی می‌خواند (۲۲+۸+۴ / ۲۶+۸+۴)', /ptf-line-icon\{width:22px;height:22px/.test(shell) && /ptf-line-icon\{display:inline-grid[^}]*margin-left:8px/.test(shell) && /width:26px !important/.test(shell) && seg.indexOf('gap:4px') > -1);
  var addrRow = seg.match(/<div><span style="display:inline-flex[^"]*">[\s\S]*?<\/svg><\/span>([^<]*)<\/span><span style="([^"]*)">([^<]*)<\/span><\/div>/);
  T('index.html: ردیف آدرس = عنوان inline-flex + span آدرس هم‌سطح (هدف دقیق انتخابگر)', !!addrRow && addrRow[1].trim() === 'آدرس دفتر مرکزی' && addrRow[3].indexOf('تهران') === 0, addrRow && addrRow[1]);
  T('span آدرس display درون‌خطی ندارد که قاعده را خنثی کند', !!addrRow && !/display\s*:/.test(addrRow[2]));
  (function () {
    var only = {}, n = 0;
    (function walk(d) {
      fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
        if (e.name === '.git' || e.name === 'node_modules') return;
        var p = path.join(d, e.name);
        if (e.isDirectory()) return walk(p);
        if (!/\.html$/.test(e.name)) return;
        var s = fs.readFileSync(p, 'utf8'), a = s.indexOf('id="ptf-site-footer"');
        if (a < 0) return;
        var sg = s.slice(a, s.indexOf('</footer>', a)), re = /<div><span style="display:inline-flex/g, m;
        while ((m = re.exec(sg))) { var lab = sg.slice(m.index, m.index + 4000).match(/<\/svg><\/span>([^<]*)<\/span><span/); only[lab ? lab[1].trim() : '-'] = 1; n++; }
      });
    })(ROOT);
    T('در همهٔ صفحات، انتخابگر فقط ردیف آدرس را هدف می‌گیرد (' + n + ' ردیف)', Object.keys(only).join('|') === 'آدرس دفتر مرکزی' && n > 600, Object.keys(only).join('|'));
  })();
  /* cache-bust همهٔ صفحات */
  var stale = [], fresh = 0;
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      if (e.name === '.git' || e.name === 'node_modules') return;
      var p = path.join(d, e.name);
      if (e.isDirectory()) return walk(p);
      if (!/\.(html|inc|php)$/.test(e.name)) return;
      var s = fs.readFileSync(p, 'utf8');
      if (s.indexOf('site-shell.css?v=20260926-5') > -1) stale.push(path.relative(ROOT, p));
      if (s.indexOf('site-shell.css?v=20260930-1') > -1) fresh++;
    });
  })(ROOT);
  T('هیچ صفحه‌ای نسخهٔ قدیمی site-shell.css (20260926-5) را لینک نمی‌کند', stale.length === 0, stale.slice(0, 5).join(', '));
  T('صفحات با نسخهٔ تازهٔ site-shell.css (20260930-1) — ≥ ۶۰۰', fresh >= 600, fresh);
})();

/* ================= B) فوتر CRM ================= */
console.log('\n[B] حذف فوتر تماس از CRM');
(function () {
  ['index.html', 'clear-cache.html', 'device-reconnect.html', 'financial-user-guide.html', 'force-restore.html', 'recover.html', 'sync-diagnostics.html'].forEach(function (f) {
    var s = fs.readFileSync(path.join(CRM, f), 'utf8');
    T('crm/' + f + ': فوتر حذف شده و ساختار صفحه سالم است', s.indexOf('<footer') < 0 && s.indexOf('tel:02191099242') < 0 && /<\/body>\s*<\/html>\s*$/i.test(s));
  });
  var lh = fs.readFileSync(path.join(CRM, 'letterhead-template.html'), 'utf8');
  T('crm/letterhead-template.html: فوتر سربرگ نامه عمداً حفظ شده', lh.indexOf('<footer') > -1);
  var js = fs.readdirSync(CRM).filter(function (f) { return /\.js$/.test(f); }).filter(function (f) { return /<footer|createElement\(['"]footer/.test(fs.readFileSync(path.join(CRM, f), 'utf8')); });
  T('هیچ ماژول JS در CRM فوتر را دوباره تزریق نمی‌کند', js.length === 0, js.join(','));
})();

/* ================= C) مشتری جدید در صدر ================= */
console.log('\n[C] مشتری جدید در صدر فهرست');
(function () {
  var idx = fs.readFileSync(path.join(CRM, 'index.html'), 'utf8');
  eval.call(global, sliceFn(idx, 'function ptfCustSortNewest(list) {').replace('function ptfCustSortNewest', 'global.ptfCustSortNewest = function'));
  var cds = function (l) { return l.map(function (x) { return x.cd; }).join(','); };
  T('ترتیب نزولی بر اساس شمارهٔ کد', cds(ptfCustSortNewest([{ cd: 'CUST-1405-0002' }, { cd: 'CUST-1405-0010' }, { cd: 'CUST-1405-0001' }])) === 'CUST-1405-0010,CUST-1405-0002,CUST-1405-0001');
  T('سال در کد لحاظ می‌شود (۱۴۰۵-۰۰۰۱ بالاتر از ۱۴۰۴-۰۹۹۹)', cds(ptfCustSortNewest([{ cd: 'CUST-1404-0999' }, { cd: 'CUST-1405-0001' }])) === 'CUST-1405-0001,CUST-1404-0999');
  T('کد هم‌شماره ⇒ زمان ثبت جدیدتر بالاتر', cds(ptfCustSortNewest([{ cd: 'A-5', crAt: '2026-01-01' }, { cd: 'B-5', crAt: '2026-05-01' }])) === 'B-5,A-5');
  T('رکورد بدون کد پایین فهرست و ترتیب پایدار', cds(ptfCustSortNewest([{ cd: 'X' }, { cd: 'C-3' }, { cd: 'Y' }])) === 'C-3,X,Y');
  var orig = [{ cd: 'C-1' }, { cd: 'C-2' }];
  ptfCustSortNewest(orig);
  T('آرایهٔ ورودی تغییر نمی‌کند (کپی مرتب می‌شود)', cds(orig) === 'C-1,C-2');
  T('ورودی null امن است', Array.isArray(ptfCustSortNewest(null)) && ptfCustSortNewest(null).length === 0);

  /* renderCustomers2 واقعی از offers.js */
  var off = fs.readFileSync(path.join(CRM, 'offers.js'), 'utf8');
  var els = { cTb: { innerHTML: '' }, cSrch: { value: '' }, dCust: { textContent: '' } };
  document.getElementById = function (id) { return els[id] || null; };
  global.migrateContacts = function () {};
  global.ptfCustContactCell = function () { return '-'; };
  ['primaryPerson', 'entityMatches'].forEach(function (n) {
    eval.call(global, sliceFn(off, 'function ' + n + '(').replace('function ' + n, 'global.' + n + ' = function'));
  });
  eval.call(global, sliceFn(off, 'function renderCustomers2() {').replace('function renderCustomers2', 'global.renderCustomers2 = function'));
  /* داده به ترتیب ذخیره (قدیمی→جدید) — همان علت گزارش: جدید ته آرایه/فهرست */
  setData('ptf_crm_customers', [
    { cd: 'CUST-1404-0100', co: 'قدیمی', people: [] },
    { cd: 'CUST-1405-0003', co: 'میانی', people: [] },
    { cd: 'CUST-1405-0004', co: 'تازه‌ثبت', people: [] }
  ]);
  renderCustomers2();
  var rows = els.cTb.innerHTML.match(/data-cust-cd="([^"]+)"/g) || [];
  T('renderCustomers2: مشتری تازه‌ثبت ردیف اول است', rows[0] === 'data-cust-cd="CUST-1405-0004"', rows.join(' '));
  T('renderCustomers2: قدیمی‌ترین ردیف آخر است', rows[rows.length - 1] === 'data-cust-cd="CUST-1404-0100"');
  els.cSrch.value = 'CUST-1405';
  renderCustomers2();
  rows = els.cTb.innerHTML.match(/data-cust-cd="([^"]+)"/g) || [];
  T('با جستجو هم ترتیب «جدیدترین اول» حفظ می‌شود', rows.length === 2 && rows[0].indexOf('0004') > -1, rows.join(' '));
  T('شمارندهٔ داشبورد = کل مشتریان', String(els.dCust.textContent) === '3');
})();

/* ================= D) کادر سبز نسخه ارزی ================= */
console.log('\n[D] کادر نسخه ارزی (IRR→FX)');
(function (done) {
  global.curSession = function () { return { user: 'admin', role: 'admin', name: 'مدیر' }; };
  global.isSenior = function () { return true; };
  global.ptfToast = function () {};
  global.offerSerial = function () { return 'CO-1405-0900'; };
  delete global.ptfUnifiedCodeAsync;
  eval.call(global, fs.readFileSync(path.join(CRM, 'offer-fx-convert.js'), 'utf8'));
  var src = { no: 'CO-1405-0100', kind: 'CO', currency: 'IRR', st: 'sent', buyerCo: 'خریدار', inqNo: 'RFQ-1', items: [{ qty: 2, price: 1000000 }], terms: [] };
  setData('ptf_crm_offers', [src]);
  setData('ptf_crm_deals', []);
  var res = ptfOfferFxConvertCommit(src.no, 500000, 'USD', '2026-09-29');
  T('commit: نسخه ارزی ساخته شد', res && res.ok && res.no === 'CO-1405-0900', JSON.stringify(res));
  var all = getData('ptf_crm_offers');
  var comp = all.filter(function (o) { return o.no === 'CO-1405-0900'; })[0];
  T('نسخه ارزی: fxOf به پیشنهاد مبدأ، ارز USD، مبلغ = ریالی ÷ نرخ', comp && comp.fxOf === src.no && comp.currency === 'USD' && comp.items[0].price === 2);
  T('پیشنهاد اصلی ریالی دست‌نخورده ماند', JSON.stringify(all.filter(function (o) { return o.no === src.no; })[0].items) === JSON.stringify(src.items));
  T('ptfFxCompanionsOf نسخه را می‌یابد', ptfFxCompanionsOf(src.no).length === 1);
  var box = ptfIrrOfferFxInlineHtml(all.filter(function (o) { return o.no === src.no; })[0]);
  T('کادر زیر پیشنهاد سبز است (#ecfdf5 / #a7f3d0)', /background:#ecfdf5;border:1px solid #a7f3d0/.test(box), box.slice(0, 160));
  T('کادر: دکمهٔ نمایش نسخه ارزی', box.indexOf("offerQuickPreview('CO-1405-0900')") > -1);
  T('کادر: دکمهٔ چاپ/PDF (دریافت فایل) نسخه ارزی', box.indexOf("offerPrint('CO-1405-0900')") > -1);
  T('کادر: دکمهٔ شرایط ارزی', box.indexOf("ptfOfferFxTermsOpen('CO-1405-0900')") > -1);
  /* نسخهٔ دوم با ارز دیگر در همان کادر */
  global.offerSerial = function () { return 'CO-1405-0901'; };
  ptfOfferFxConvertCommit(src.no, 600000, 'EUR', '2026-09-29');
  box = ptfIrrOfferFxInlineHtml(src);
  T('دو نسخه (USD و EUR) هر دو در همان کادر', box.indexOf('CO-1405-0900 (USD)') > -1 && box.indexOf('CO-1405-0901 (EUR)') > -1);
  /* خودترمیمی: fxOf در همگام‌سازی گم شده */
  var healed = getData('ptf_crm_offers').map(function (o) { if (o.no === 'CO-1405-0900') { o = JSON.parse(JSON.stringify(o)); delete o.fxOf; } return o; });
  setData('ptf_crm_offers', healed);
  T('نسخهٔ بدون fxOf از fxConvert.from بازیابی می‌شود', ptfFxCompanionsOf(src.no).map(function (o) { return o.no; }).sort().join(',') === 'CO-1405-0900,CO-1405-0901');
  T('نسخهٔ ریالیِ همراه (rialOf) با fxConvert.from اشتباهاً نسخه ارزی شمرده نمی‌شود', (function () {
    setData('ptf_crm_offers', [src, { no: 'CO-R', kind: 'CO', currency: 'IRR', rialOf: 'CO-FX', fxConvert: { from: src.no } }]);
    return ptfFxCompanionsOf(src.no).length === 0;
  })());
  setData('ptf_crm_offers', healed);

  /* renderOffers واقعی */
  var off = fs.readFileSync(path.join(CRM, 'offers.js'), 'utf8');
  var els = { oTb: { innerHTML: '' } };
  document.getElementById = function (id) { return els[id] || null; };
  global.offerValidState = function () { return null; };
  eval.call(global, sliceFn(off, 'function renderOffers() {').replace('function renderOffers', 'global.renderOffers = function'));
  window._offKindTab = 'ALL'; window._offCustFilter = '';
  var stubbed = [];
  for (var i = 0; i < 40; i++) {
    try { renderOffers(); break; }
    catch (e) { var m = String(e.message).match(/^(\w+) is not defined/); if (!m) { T('renderOffers اجرا شد', false, e.stack); break; } stubbed.push(m[1]); global[m[1]] = function () { return ''; }; }
  }
  var html = els.oTb.innerHTML;
  var trs = html.match(/<tr[\s>]/g) || [];
  T('renderOffers: نسخه‌های ارزی ردیف مستقل نمی‌سازند (فقط ۱ ردیف)', trs.length === 1, trs.length + ' stubs=' + stubbed.join(','));
  T('renderOffers: کادر سبز نسخه ارزی زیر ردیف پیشنهاد ریالی رندر شد', /background:#ecfdf5;border:1px solid #a7f3d0[^"]*" title="نسخه ارزی همین پیشنهاد"/.test(html));
  T('renderOffers: نسخهٔ بازیابی‌شده (بدون fxOf) هم در کادر است', html.indexOf('CO-1405-0900 (USD)') > -1 && html.indexOf('CO-1405-0901 (EUR)') > -1);
  /* پرونده فروش */
  var sf = fs.readFileSync(path.join(CRM, 'salesfiles.js'), 'utf8');
  T('پرونده فروش: برچسب «ارزی از …» کنار سند', sf.indexOf("window.ptfFxCompanionBadge(o)") > -1);
  T('ptfFxCompanionBadge برای نسخه ارزی برچسب می‌سازد', /💱 ارزی از CO-1405-0100 \(USD\)/.test(ptfFxCompanionBadge({ fxOf: 'CO-1405-0100', currency: 'USD', fxConvert: { rate: 1 } })));
})();

/* ================= E) تب‌های ارجاع درخواست‌ها ================= */
console.log('\n[E] تب‌های «ارجاع به من» و «با مسئول»');
(function () {
  var br = fs.readFileSync(path.join(CRM, 'bridge.js'), 'utf8');
  var selHtml = br.slice(br.indexOf('<select id="rOfferFlt"'), br.indexOf("'</select>'", br.indexOf('<select id="rOfferFlt"')));
  function optsFrom(h) { var o = [], m, re = /<option value="([^"]*)"/g; while ((m = re.exec(h))) o.push(m[1]); return o; }
  var opts = optsFrom(selHtml);
  T('select #rOfferFlt شامل گزینه‌های mine و assigned است', opts.indexOf('mine') > -1 && opts.indexOf('assigned') > -1, opts.join('|'));
  /* select با رفتار واقعی مرورگر: مقدار ناموجود ⇒ '' */
  function makeSelect(options) { var v = ''; return { get value() { return v; }, set value(x) { v = options.indexOf(String(x)) > -1 ? String(x) : ''; } }; }
  function row(has, asg, mine, q) {
    var at = { 'data-has-offer': has ? '1' : '0', 'data-assignee': asg ? '1' : '0', 'data-assignee-mine': mine ? '1' : '0', 'data-search': q };
    return { visible: true, getAttribute: function (k) { return at[k]; } };
  }
  function boot(options) {
    var rows = [row(1, 1, 1, 'rfq-a'), row(0, 1, 0, 'rfq-b'), row(0, 0, 0, 'rfq-c'), row(1, 0, 0, 'rfq-d')];
    var chips = ['', 'none', 'has', 'mine', 'assigned'].map(function (v) { return { v: v, on: false, textContent: '', getAttribute: function () { return v; }, classList: { toggle: function (c, b) { this.o.on = b; }, o: null } }; });
    chips.forEach(function (c) { c.classList.o = c; });
    var tb = {
      querySelector: function (s) { return s === 'tr[data-has-offer]' ? rows[0] : null; },
      querySelectorAll: function () { return rows; }, appendChild: function () {}
    };
    var els = { rTb: tb, rSrch: { value: '' }, rOfferFlt: makeSelect(options), ptfRfqUiCss: { textContent: 'rfq-row-hide' },
      rOfferBar: { querySelectorAll: function () { return chips; } } };
    global.document = { getElementById: function (id) { return els[id] || null; } };
    window.ptfSetRowVisible = function (tr, ok) { tr.visible = ok; };
    window._rOfferFlt = '';
    var a = br.indexOf('  function rfqPaintOfferChips('), b = br.indexOf('  window.ptfRfqWaitBadge');
    var code = br.slice(a, b);
    (new Function(code + '; window.__paint = rfqPaintOfferChips;'))();
    return { rows: rows, chips: chips };
  }
  function vis(env) { return env.rows.map(function (r) { return r.visible ? 1 : 0; }).join(''); }
  var env = boot(opts);
  ptfRfqOfferFlt('mine');
  T('«ارجاع به من»: فقط درخواست ارجاع‌شده به کاربر جاری', vis(env) === '1000', vis(env));
  T('«ارجاع به من»: تب فعال علامت می‌خورد', env.chips[3].on === true && env.chips[0].on === false);
  ptfRfqOfferFlt('assigned');
  T('«با مسئول»: همهٔ درخواست‌های دارای مسئول', vis(env) === '1100', vis(env));
  ptfRfqOfferFlt('none');
  T('«بدون پیشنهاد» همچنان درست کار می‌کند', vis(env) === '0110', vis(env));
  ptfRfqOfferFlt('');
  T('«همه»: همه نمایش', vis(env) === '1111', vis(env));
  document.getElementById('rSrch').value = 'rfq-b';
  ptfRfqOfferFlt('assigned');
  T('ترکیب جستجو + «با مسئول»', vis(env) === '0100', vis(env));
  document.getElementById('rSrch').value = '';
  filterRfq();
  T('filterRfq (تغییر جستجو) فیلتر تب را حفظ می‌کند', vis(env) === '1100', vis(env));
  /* اثبات ریشه: با گزینه‌های قدیمی همین کد تب را نادیده می‌گرفت */
  var envOld = boot(['', 'none', 'has']);
  ptfRfqOfferFlt('mine');
  T('ریشه تأیید شد: با select قدیمی (بدون mine) فیلتر به «همه» برمی‌گشت', vis(envOld) === '1111', vis(envOld));

  /* ptfRfqIsAssignedToMe */
  var a2 = br.indexOf('  window.ptfRfqIsAssignedToMe = function'), b2 = br.indexOf('  window.renderRfq = function');
  (new Function(br.slice(a2, b2)))();
  global.curSession = function () { return { user: 'ali', name: 'علی رضایی' }; };
  T('ارجاع با user یکسان ⇒ مال من', ptfRfqIsAssignedToMe({ assignee: { user: 'ali', name: 'x' } }) === true);
  T('ارجاع به کاربر دیگر ⇒ مال من نیست', ptfRfqIsAssignedToMe({ assignee: { user: 'reza', name: 'علی رضایی' } }) === false);
  T('ارجاع قدیمی فقط با نام ⇒ مال من', ptfRfqIsAssignedToMe({ assignee: { name: 'علی رضایی' } }) === true);
  T('ارجاع قدیمی رشته‌ای (نام کاربری) ⇒ مال من', ptfRfqIsAssignedToMe({ assignee: 'ali' }) === true);
  T('بدون ارجاع ⇒ false', ptfRfqIsAssignedToMe({}) === false && ptfRfqIsAssignedToMe(null) === false);
})();

/* ================= F) اعلان ثبت از سایت (قرارداد سورس) ================= */
console.log('\n[F] پیامک/بات ثبت استعلام و تامین‌کننده');
(function () {
  var php = read('api/crm.php');
  function caseBody(name) { var a = php.indexOf("case '" + name + "':"); return php.slice(a, php.indexOf("\n    case '", a + 10)); }
  ['add_rfq_site', 'add_supplier'].forEach(function (c) {
    var b = caseBody(c);
    var iSave = b.indexOf('save_data('), iAlert = b.indexOf('ptf_site_alert('), iEcho = b.lastIndexOf("echo json_encode(['ok' => true");
    T(c + ': اعلان پس از ذخیرهٔ موفق و پیش از پاسخ فراخوانده می‌شود', iSave > -1 && iAlert > iSave && iEcho > iAlert, [iSave, iAlert, iEcho].join(','));
    T(c + ': اعلان پس از کپچا (اسپم پیامک نمی‌سازد)', b.indexOf('require_captcha()') > -1 && b.indexOf('require_captcha()') < iAlert);
  });
  T('شمارهٔ پیش‌فرض گیرنده 09126473290', /\['09126473290'\]/.test(php));
  T('ارسال پس از پاسخ (register_shutdown_function + fastcgi_finish_request)', /register_shutdown_function\(function \(\) \{\s*if \(empty\(\$GLOBALS\['__ptf_site_alerts'\]\)\) return;\s*if \(function_exists\('fastcgi_finish_request'\)\)/.test(php) && php.indexOf('fastcgi_finish_request') > -1);
  T('هر سه تابع کمکی یک‌بار تعریف شده‌اند', ['ptf_bot_cfg', 'ptf_bot_group_send', 'ptf_site_alert', 'ptf_site_alert_flush'].every(function (n) { return (php.match(new RegExp('function ' + n + '\\(', 'g')) || []).length === 1; }));
  T('تست اجرایی PHP موجود است (e2e-site-alert-v34.39.41.js)', fs.existsSync(path.join(__dirname, 'e2e-site-alert-v34.39.41.js')));
})();

/* ================= G) نسخه ================= */
console.log('\n[G] قرارداد نسخه v34.39.43');
(function () {
  var V = '34.39.43';
  var ver = JSON.parse(read('VERSION.json'));
  var idx = read('crm/index.html'), sw = read('crm/sw.js');
  T('VERSION.json', ver.crm_version === 'v' + V && ver.version === V && ver.release === 'v' + V);
  T('index.html: PTF_CRM_RELEASE', idx.indexOf("window.PTF_CRM_RELEASE = 'v" + V + "'") > -1);
  T('sw.js: RELEASE/ASSET_VERSION/CACHE', sw.indexOf("var RELEASE = 'v" + V + "'") > -1 && sw.indexOf("var ASSET_VERSION = '" + V + "'") > -1 && sw.indexOf("var CACHE = 'ptf-crm-v" + V + "'") > -1);
  T('manifest.json', JSON.parse(read('crm/manifest.json')).version === V);
  var pins = idx.match(/\?v=(\d+\.\d+\.\d+)/g) || [];
  var bad = pins.filter(function (p) { return p !== '?v=' + V; });
  T('همهٔ پین‌های ?v= در crm/index.html = ' + V + ' (' + pins.length + ')', pins.length > 100 && bad.length === 0, bad.slice(0, 5).join(','));
  ['offers.js', 'offer-fx-convert.js', 'salesfiles.js', 'bridge.js'].forEach(function (f) {
    T('فایل تغییر‌یافته با cache-buster تازه بارگذاری می‌شود: ' + f, idx.indexOf(f + '?v=' + V) > -1);
  });
  T('clear-cache / device-reconnect / shell / cms', read('crm/clear-cache.html').indexOf("window.VER = 'v" + V + "'") > -1 && read('crm/device-reconnect.html').indexOf("var VER = 'v" + V + "'") > -1 && read('crm/shell.js').indexOf("'v" + V + "'") > -1 && read('crm/cms.js').indexOf("PTF_CMS_JS_VER = 'v" + V + "'") > -1);
  T('SD_SERVICE_VERSION', read('api/sales-domain.php').indexOf("SD_SERVICE_VERSION = '" + V + "'") > -1);
  T('ریلیزنوت v34.39.43 موجود است', fs.existsSync(path.join(ROOT, 'RELEASE-NOTES-v' + V + '.md')));
})();

/* ================= H) استقرار استیجینگ فقط دستی ================= */
console.log('\n[H] استقرار استیجینگ اختیاری (فقط دستی)');
(function () {
  var wf = read('.github/workflows/deploy-staging.yml');
  var on = wf.slice(wf.indexOf('\non:'), wf.indexOf('\nconcurrency:'));
  var active = on.split('\n').filter(function (l) { return !/^\s*#/.test(l); }).join('\n');
  T('deploy-staging: workflow_dispatch (اجرای دستی) باقی است', /^\s{2}workflow_dispatch:/m.test(active));
  T('deploy-staging: تریگر push خودکار حذف شد', !/^\s{2}push:/m.test(active), active);
  T('deploy-staging: تریگر pull_request ندارد', !/^\s{2}pull_request:/m.test(active));
  T('deploy-staging: cron هفتگی حذف شد', !/^\s{2}schedule:/m.test(active));
  T('گزینهٔ full برای همگام‌سازی کامل دستی حفظ شد', /full:[\s\S]*type: boolean/.test(active) && wf.indexOf('github.event.inputs.full') > -1);
  T('پروداکشن همچنان فقط دستی با تأیید DEPLOY است', /^\s{2}workflow_dispatch:/m.test(read('.github/workflows/deploy-production.yml')) && !/^\s{2}push:/m.test(read('.github/workflows/deploy-production.yml')));
})();

console.log('\n=== tester681 — v34.39.43 session fixes: ' + R.pass + ' PASS / ' + R.fail + ' FAIL ===');
process.exit(R.fail ? 1 : 0);

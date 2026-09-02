#!/usr/bin/env node
'use strict';
/* tester578 — v34.29.5: ریشه‌کنی واقعی «تب‌های خالی» مدیریت سایت — برخورد نام کلاس CSS
   RCA (بوت کامل jsdom + سنجش getComputedStyle، نه طول innerHTML):
     تب «📄 صفحهٔ جدید» و «🛠 کیفیت» درست رندر می‌شدند (۱۰٬۳۹۷ و ۹٬۵۱۰ کاراکتر) ولی
     همهٔ فرم‌ها داخل <div class="pn"> بودند و index.html قاعدهٔ سراسری
     «.pn{…display:none} / .pn.act{display:block}» (سوئیچ پنل قدیمی) دارد → ۲۹/۲۹ کنترل
     تب صفحه و ۵/۵ کنترل تب کیفیت با computed display:none؛ کاربر فقط پاراگراف معرفی را می‌دید.
     برخورد دوم: <table class="tb"> در cms.js/gsc.js با «.tb» نوار بالای چسبان
     (display:flex; position:sticky; z-index:40؛ در موبایل height:56px + overflow:hidden).
   چهار رفع قبلی (TAB-GUARD/بنر کش/TAB-DIRECT/VER-SHIELD) به این نقطه نرسیدند چون همه
   «طول HTML» را می‌سنجیدند نه «دیده‌شدن». این تستر همان حفره را می‌بندد:
     ۱) هیچ کلاسِ خروجی ماژول مدیریت سایت نباید با قاعدهٔ تک‌کلاسیِ display:none برخورد کند
        (مگر با display اینلاین صریح — مثل مودال‌های md-b)؛
     ۲) <table class="tb"> ممنوع؛
     ۳) در صورت وجود jsdom، اثبات رفتاری با computed style. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var MODULE_FILES = ['crm/cms.js', 'crm/gsc.js', 'crm/careers.js']; /* سه زیربخش «مدیریت سایت» */
var idx = read('crm/index.html'), cms = read('crm/cms.js'), gsc = read('crm/gsc.js');

/* ── ۰) مستندسازی برخورد: قاعدهٔ سراسری هنوز هست (حذف نشده؛ فقط دیگر به آن تکیه نمی‌کنیم) ── */
T('CTX: قاعدهٔ سراسری .pn{display:none}/.pn.act هنوز در index.html است (سوئیچ پنل قدیمی)',
  /\.pn\{[^}]*display:none[^}]*\}/.test(idx) && /\.pn\.act\{display:block\}/.test(idx));
T('CTX: قاعدهٔ .tb نوار بالا (flex + sticky) هنوز در index.html است',
  /\.tb\{[^}]*display:flex[^}]*position:sticky[^}]*\}/.test(idx));

/* ── ۱) رفع مستقیم ── */
T('FIX: cms.js هیچ class="pn" ندارد (۸ قاب صفحهٔ جدید/کیفیت → cms-card)', !/class=\\?"pn\\?"/.test(cms) && (cms.match(/class="cms-card"/g) || []).length >= 8, (cms.match(/class="pn"/g) || []).length);
T('FIX: قاب‌های cms-card پس‌زمینهٔ کارت را اینلاین دارند (قبلاً از .pn می‌آمد)',
  (cms.match(/class="cms-card" style="background:var\(--crd\);/g) || []).length >= 8);
T('FIX: فرم جایگزین v34.26.1 هم دیگر داخل .pn نیست (fallback نامرئی نمی‌شود)', (function () {
  var i = cms.indexOf('function renderCmsPageNew(el)'); var j = cms.indexOf('function renderCmsPageNewFull(el)');
  var seg = cms.slice(i, j); return seg.indexOf('class="cms-card"') > -1 && seg.indexOf('class="pn"') < 0;
})());
T('FIX: هیچ <table class="tb"> در cms.js/gsc.js (برخورد با نوار بالای چسبان)',
  !/<table class="tb"/.test(cms) && !/<table class="tb"/.test(gsc) && (cms.match(/<table class="cms-tbl"/g) || []).length >= 8);
T('FIX: PTF_CMS_JS_VER = v34.29.5 (سپر نسخهٔ کهنه، همسو با VER پوسته)', cms.indexOf("window.PTF_CMS_JS_VER = 'v34.29.5';") > -1);

/* ── ۲) نگهبان عمومی: هیچ کلاس خروجیِ ماژول با قاعدهٔ تک‌کلاسیِ display:none برخورد نکند ── */
function cssSources() {
  var out = [idx];
  fs.readdirSync(path.join(ROOT, 'crm')).filter(function (n) { return /\.js$/.test(n); })
    .forEach(function (n) { out.push(read('crm/' + n)); });
  return out.join('\n');
}
var ALLCSS = cssSources();
function singleClassHidden(cls) { /* قاعده‌ای که «کل سلکتورش» فقط .cls باشد (بدون والد/ترکیب) و display:none داشته باشد؛
     سلکتورهای محدود مثل «#rTb td:last-child .bd{display:none}» برخورد نیستند. */
  var esc = cls.replace(/[-]/g, '\\-');
  /* مرز شروع سلکتور: ابتدای رشته/خط، پایان قاعدهٔ قبلی «}»، شروع بلاک «{»، کوتیشن/پلاس (رشته‌های JS)، یا ویرگول (فهرست سلکتور) */
  var re = new RegExp('(^|[{}\'"+,\\n])\\s*\\.' + esc + '\\s*(,[^{]*)?\\{[^}]*display\\s*:\\s*none[^}]*\\}', 'm');
  return re.test(ALLCSS);
}
var collisions = [];
MODULE_FILES.forEach(function (rel) {
  var s = read(rel);
  var re = /<(div|span|table|section|form|ul|p)\s+class=\\?"([^"\\]+)\\?"([^>]*)>/g, m;
  while ((m = re.exec(s))) {
    var classes = m[2].split(/\s+/), attrs = m[3];
    classes.forEach(function (c) {
      if (!c) return;
      if (singleClassHidden(c)) {
        /* برخورد فقط وقتی مجاز است که همان تگ display اینلاین صریح داشته باشد (مودال md-b) */
        if (!/style=\\?"[^"\\]*display\s*:/.test(attrs)) collisions.push(rel + ': .' + c + ' ← ' + m[0].slice(0, 70));
      }
    });
  }
});
T('GUARD: هیچ عنصر خروجی cms/gsc/careers با قاعدهٔ تک‌کلاسیِ display:none برخورد ندارد (مگر display اینلاین)', collisions.length === 0, collisions.slice(0, 6).join('\n  '));
T('GUARD: هیچ <table class="tb…"> در ماژول‌های مدیریت سایت', MODULE_FILES.every(function (rel) { return !/<table class=\\?"tb[\s"\\]/.test(read(rel)); }));

/* ── ۳) گیت و نسخه ── */
T('GATE: tester578 در run-ci-gate.js ثبت است', read('_tools/uat/run-ci-gate.js').indexOf('tester578-v34.29.5-cms-css-visibility.js') > -1);
T('VER: VERSION.json = v34.29.5', JSON.parse(read('VERSION.json')).crm_version === 'v34.29.5');
T('VER: RELEASE-NOTES-v34.29.5.md موجود و RCA را توضیح می‌دهد', fs.existsSync(path.join(ROOT, 'RELEASE-NOTES-v34.29.5.md')) && /display:none/.test(read('RELEASE-NOTES-v34.29.5.md')));

/* ── ۴) اثبات رفتاری (اختیاری — فقط اگر jsdom نصب باشد؛ بوت کامل اپ + computed style) ── */
var jsdomPath = null;
try { jsdomPath = require.resolve('jsdom'); } catch (e1) { try { jsdomPath = require.resolve(path.join(ROOT, 'node_modules/jsdom')); } catch (e2) {} }
if (!jsdomPath) {
  console.log('SKIP  اثبات رفتاری jsdom (ماژول jsdom نصب نیست) — سنجه‌های ایستا کافی‌اند؛ برای اجرای کامل: npm i jsdom');
  finish();
} else {
  behavioral(require(jsdomPath)).then(finish, function (e) { T('BEHAV: هارنس jsdom اجرا شد', false, e && e.message); finish(); });
}

function behavioral(jsdomMod) {
  var JSDOM = jsdomMod.JSDOM, VirtualConsole = jsdomMod.VirtualConsole, http = require('http');
  var MIME = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
  var srv = http.createServer(function (req, res) {
    var fp = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(fp, function (err, buf) { if (err) { res.writeHead(404); res.end(''); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(buf); });
  });
  return new Promise(function (resolve) {
    srv.listen(0, '127.0.0.1', function () {
      var PORT = srv.address().port;
      var vc = new VirtualConsole(); vc.on('jsdomError', function () {}); vc.on('error', function () {});
      var dom = new JSDOM(idx, {
        url: 'http://127.0.0.1:' + PORT + '/crm/index.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
        beforeParse: function (window) {
          var sess = JSON.stringify({ user: 'admin', name: 'x', role: 'admin', roleId: 'admin', ts: Date.now() });
          window.sessionStorage.setItem('ptf_crm_session', sess); window.localStorage.setItem('ptf_crm_session', sess); window.localStorage.setItem('ptf_crm_token', 'x');
          window.fetch = function (url) {
            var body = { ok: true, items: [{ id: 'a1', title: 'نمونه', rel: 'services/x.html', at: 1700000000, st: 'pending', author: 'u' }], files: [], articles: [], pages: [], writable: true, version: 'x' };
            if (/news\/index\.html/.test(String(url))) return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('const news = [\n];'); } });
            return Promise.resolve({ ok: true, status: 200, headers: { get: function () { return 'application/json'; } }, text: function () { return Promise.resolve(JSON.stringify(body)); }, json: function () { return Promise.resolve(body); } });
          };
          window.alert = function () {}; window.confirm = function () { return true; }; window.scrollTo = function () {};
          window.matchMedia = window.matchMedia || function () { return { matches: false, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} }; };
          window.requestIdleCallback = function (cb) { return setTimeout(cb, 1); };
          if (!window.navigator.serviceWorker) Object.defineProperty(window.navigator, 'serviceWorker', { value: { register: function () { return Promise.resolve({}); }, getRegistrations: function () { return Promise.resolve([]); }, addEventListener: function () {} } });
        }
      });
      var window = dom.window, document = window.document;
      function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
      function hidden(el) { var n = el; while (n && n.nodeType === 1) { if (window.getComputedStyle(n).display === 'none') return true; n = n.parentElement; } return false; }
      function visibleControls() { var w = document.getElementById('cmsWrap'); if (!w) return { total: 0, visible: 0 }; var all = w.querySelectorAll('input,textarea,select,button'), v = 0; Array.prototype.forEach.call(all, function (el) { if (!hidden(el)) v++; }); return { total: all.length, visible: v }; }
      function clickTab(label) { var b = Array.prototype.slice.call(document.querySelectorAll('#panels button')).filter(function (x) { return (x.textContent || '').indexOf(label) > -1; })[0]; if (b) b.click(); return wait(900); }
      (async function () {
        await new Promise(function (r) { window.addEventListener('load', r); setTimeout(r, 15000); });
        await wait(2500);
        var cmsBtn = Array.prototype.slice.call(document.querySelectorAll('.sb-i')).filter(function (b) { return (b.getAttribute('onclick') || '').indexOf("'cms'") > -1; })[0];
        if (cmsBtn) cmsBtn.click(); else window.goPanel('cms');
        await wait(600);
        await clickTab('صفحهٔ جدید'); var pg = visibleControls(); var topic = document.getElementById('pgTopic');
        T('BEHAV: تب «صفحهٔ جدید» — همهٔ کنترل‌ها با computed style دیده می‌شوند (' + pg.visible + '/' + pg.total + ')', pg.total >= 20 && pg.visible === pg.total, JSON.stringify(pg));
        T('BEHAV: فیلد pgTopic واقعاً قابل‌دیدن است', !!topic && !hidden(topic));
        await clickTab('کیفیت'); var q = visibleControls(); var qs = document.getElementById('qSched'); var tbl = document.querySelector('#cmsWrap table');
        T('BEHAV: تب «کیفیت» — همهٔ کنترل‌ها دیده می‌شوند (' + q.visible + '/' + q.total + ')', q.total >= 5 && q.visible === q.total, JSON.stringify(q));
        T('BEHAV: صف زمان‌بندی (qSched) قابل‌دیدن است', !!qs && !hidden(qs));
        T('BEHAV: جدول صف با display:table رندر می‌شود، نه flex/sticky نوار بالا', !!tbl && window.getComputedStyle(tbl).display === 'table' && window.getComputedStyle(tbl).position !== 'sticky', tbl ? window.getComputedStyle(tbl).display + '/' + window.getComputedStyle(tbl).position : 'no table');
        srv.close(); resolve();
      })().catch(function (e) { T('BEHAV: اجرای هارنس', false, e && e.message); srv.close(); resolve(); });
    });
  });
}

function finish() {
  console.log('=== tester578: ' + p + ' PASS / ' + f + ' FAIL ===');
  process.exit(f ? 1 : 0);
}

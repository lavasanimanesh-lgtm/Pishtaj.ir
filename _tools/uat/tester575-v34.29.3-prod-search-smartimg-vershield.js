#!/usr/bin/env node
'use strict';
/* tester575 — v34.29.8: جستجوی فهرست محصولات CMS + عکس پیش‌فرض هوشمند + اصلاح لینک‌های
   نسبی قالب + سپر نسخهٔ کهنه (VER-SHIELD) + بازسازی دو صفحهٔ محصول جدید در قالب استاندارد */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf8');
var php = fs.readFileSync(path.join(ROOT, 'api/cms.php'), 'utf8');

/* ── ۱) جستجوی زنده در تب محصولات ── */
T('SEARCH: فیلد جستجوی prodQ با oninput زنده در renderCmsProducts هست', cms.indexOf('id="prodQ"') > -1 && cms.indexOf('oninput="cmsProdSearch(this.value)"') > -1);
T('SEARCH: cmsProdSearch سراسری است و _prodDraw را صدا می‌زند', cms.indexOf('window.cmsProdSearch = function') > -1 && cms.indexOf('_prodDraw();') > -1);
T('SEARCH: جستجو روی نام/انگلیسی/برند/مدل/کد اعمال می‌شود (هر ۵ فیلد)', (function () {
  var i = cms.indexOf('function _prodDraw');
  var seg = cms.slice(i, cms.indexOf('function renderCmsProducts', i));
  return ['r.nm', 'r.en', 'r.br', 'r.md', 'r.cd'].every(function (k) { return seg.indexOf(k) > -1; });
})());
T('SEARCH: سقف ۲۰۰ بدون جستجو و ۴۰۰ با جستجو (نه حذف کامل سقف کارایی)', /var cap = q \? 400 : 200;/.test(cms));
T('SEARCH: شمارندهٔ نتایج (prodCnt) و پیام «یافت نشد» وجود دارد', cms.indexOf('id="prodCnt"') > -1 && cms.indexOf('کالایی مطابق جستجو یافت نشد') > -1);
T('SEARCH: کوئری در بازرندر (بعد از انتشار) حفظ می‌شود (value=escP(_prodQ))', cms.indexOf("value=\"' + escP(_prodQ) + '\"") > -1);

/* ── ۲) رفتاری: فیلتر و عکس هوشمند با eval برش خالص ── */
T('BEHAV: فیلتر واقعی روی ۳۰۰۰ کالا — کوئری «gate 16» فقط ردیف‌های منطبق', (function () {
  var slice = cms.slice(cms.indexOf('var CMS_PROD_IMG_RULES'), cms.indexOf('window.cmsProdForm = function'));
  var st = { tbl: { innerHTML: '' }, cnt: { textContent: '' } };
  global.window = {};
  global.document = { getElementById: function (id) { return id === 'prodTbl' ? st.tbl : id === 'prodCnt' ? st.cnt : null; } };
  global.escP = function (x) { return String(x == null ? '' : x); };
  global.ptfOnClickArg = function (x) { return String(x); };
  global._prodSite = {};
  try { eval(slice + ';window.__setAll=function(a){_prodAll=a;};'); } catch (e) { return false; }
  var prds = [];
  for (var i = 1; i <= 3000; i++) prds.push({ cd: 'P' + i, nm: (i % 50 === 0 ? 'شیر کشویی GATE 16 اینچ ' : 'کالای عادی ') + i, en: '', br: '', md: '' });
  window.__setAll(prds);
  window.cmsProdSearch('');
  var rowsAll = (st.tbl.innerHTML.match(/cmsProdForm\(/g) || []).length;
  window.cmsProdSearch('gate 16');
  var rowsQ = (st.tbl.innerHTML.match(/cmsProdForm\(/g) || []).length;
  return rowsAll === 200 && rowsQ > 0 && rowsQ < 100 && st.cnt.textContent.indexOf('نتیجه') > -1;
})());
T('SMART-IMG: cmsProdImgGuess برای شیر کشویی → عکس gate از آرشیو generated', (function () {
  return typeof window.cmsProdImgGuess === 'function' && window.cmsProdImgGuess({ nm: 'شیر کشویی 16 اینچ', en: 'Gate Valve CL600' }) === 'assets/images/products/generated/gate-valve-api600-realistic.jpg';
})());
T('SMART-IMG: حدس زانویی/فیتینگ → butt-weld-fittings', typeof window.cmsProdImgGuess === 'function' && window.cmsProdImgGuess({ nm: 'زانویی 42 اینچ', en: 'Elbow WPB' }).indexOf('butt-weld-fittings-realistic.jpg') > -1);
T('SMART-IMG: فرم محصول عکس را از حدس پر می‌کند نه لوگوی ثابت', cms.indexOf("escP(cmsProdImgGuess(r) || 'assets/images/ptf-logo.png')") > -1);

/* ── ۳) سمت سرور: عکس هوشمند + لینک نسبی ── */
T('PHP: cms_prod_img_guess سمت سرور فقط وقتی عکس خالی/لوگو است فعال می‌شود', php.indexOf('function cms_prod_img_guess') > -1 && php.indexOf("substr($img, -12) === 'ptf-logo.png'") > -1);
T('PHP: cta/footer محصول با cms_rel_links_fix اصلاح می‌شوند (لینک مرده → knowledge-center)', php.indexOf('function cms_rel_links_fix') > -1 && php.indexOf('cms_rel_links_fix(substr($skel, $pCta') > -1 && php.indexOf('cms_rel_links_fix(substr($skel, $pFoot') > -1);
T('PHP: مسیرهای ../ و http و // و tel: از قاعدهٔ بازنویسی مستثنا هستند', php.indexOf("strpos($u, '../') === 0") > -1 && php.indexOf('(https?:)?') > -1 && php.indexOf("stripos($u, 'tel:')") > -1);

/* ── ۴) سپر نسخهٔ کهنه ── */
T('SHIELD: کاوش manifest با cache:no-store و مقایسه با PTF_CRM_RELEASE', idx.indexOf("fetch('manifest.json?v=' + Date.now(), { cache: 'no-store' })") > -1 && idx.indexOf('ptfVerShield') > -1);
T('SHIELD: بنر فقط یک‌بار برای هر نسخهٔ سرور (sessionStorage ptf_ver_shown)', idx.indexOf("sessionStorage.getItem('ptf_ver_shown')") > -1);
T('SHIELD: دکمهٔ بارگذاری مجدد دارد', idx.indexOf('بارگذاری نسخهٔ جدید') > -1);

/* ── ۵) دو صفحهٔ محصول بازسازی‌شده ── */
['gate-valve-16-inch-cl600.html', '42-inch-wpb-wphy-elbow.html'].forEach(function (sl) {
  var fp = path.join(ROOT, 'products', sl);
  var ok = fs.existsSync(fp);
  var s = ok ? fs.readFileSync(fp, 'utf8') : '';
  T('PAGE: products/' + sl + ' در قالب استاندارد (هیرو با عکس + اسکیما + بدون مسیرعمیق)', ok &&
    s.indexOf('ptf-product-hero') > -1 && s.indexOf('ptf-hero-card') > -1 &&
    s.indexOf('assets/images/products/generated/') > -1 &&
    s.indexOf('"@type": "Product"') > -1 && s.indexOf('"@type": "FAQPage"') > -1 &&
    s.indexOf('../../') === -1);
});

console.log('=== tester575: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);

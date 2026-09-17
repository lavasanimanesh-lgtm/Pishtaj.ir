#!/usr/bin/env node
'use strict';
/* PR #40 deployment hotfix contract: keep the public-site release independent
   from CRM, preserve the critical CSS budgets, and retain mobile/desktop theme
   ownership while shipping the v34.39.12/13 homepage presentation changes. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var pass = 0, fail = 0;
function T(name, ok) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.error('FAIL ' + name); }
}

var idx = read('index.html');
var home = read('assets/css/home.css');
var extra = read('assets/css/home-enhancements.css');
var motion = read('assets/js/ptf-motion.js');
var discover = read('assets/js/ptf-discover.js');
var version = JSON.parse(read('VERSION.json'));

console.log('\n── نسخه و کش ──');
T('نسخه عمومی v34.39.14 و نسخه CRM بدون تغییر v34.39.11 است',
  version.site_public_version === 'v34.39.14' && version.crm_version === 'v34.39.11');
T('هر چهار دارایی تغییرکرده cache-bust یکسان v34.39.14 دارند',
  /home\.css\?v=34\.39\.14/.test(idx) &&
  /home-enhancements\.css\?v=34\.39\.14/.test(idx) &&
  /ptf-motion\.js\?v=34\.39\.14" defer/.test(idx) &&
  /ptf-discover\.js\?v=34\.39\.14" defer/.test(idx));

console.log('\n── بودجه و ماژول‌بندی CSS ──');
T('home.css حیاتی زیر ۴۰K و لایه افزایشی زیر ۸K است', home.length < 40000 && extra.length < 8000);
T('ptf-motion زیر ۱۲K باقی مانده است', motion.length < 12000);
T('آکولاد هر دو فایل CSS متوازن است',
  home.split('{').length === home.split('}').length && extra.split('{').length === extra.split('}').length);
T('لایه افزایشی فقط یک مارکر hotfix و قابلیت‌های ۱۲/۱۳ را دارد',
  (extra.match(/v34\.39\.14 — HOME-DEPLOY-HOTFIX/g) || []).length === 1 &&
  /\.hdr-actions\{display:flex/.test(extra) && /\.ptf-record-card\{/.test(extra) && /\.ptf-finder button svg\{/.test(extra));

console.log('\n── مالکیت واکنش‌گرای کلید تم ──');
var navBlock = (idx.match(/<nav class="main-nav" id="mainNav"[\s\S]*?<\/nav>/) || [''])[0];
var actionsBlock = (idx.match(/<div class="hdr-actions">[\s\S]*?<\/div>/) || [''])[0];
T('HTML پایه کلید تم را برای شیت موبایل داخل mainNav نگه می‌دارد',
  navBlock.indexOf('id="ptfThemeToggle"') > -1 && (idx.match(/id="ptfThemeToggle"/g) || []).length === 1);
T('ذره‌بین و زبان دو همسایه مستقیم در hdr-actions هستند',
  /class="hdr-search"[\s\S]*?<\/a>\s*<a href="en\/" class="lang-switch"/.test(actionsBlock));
T('دسکتاپ همان گره تم را ابتدای hdr-actions می‌برد و موبایل به nav برمی‌گرداند',
  /matchMedia\("\(min-width:791px\)"\)/.test(discover) &&
  /actions\.insertBefore\(theme, actions\.firstChild\)/.test(discover) &&
  /nav\.appendChild\(theme\)/.test(discover) &&
  /addEventListener\("change", syncHeaderActions\)/.test(discover));
T('CSS کلید گروهی فقط در دسکتاپ است و CSS موبایل nav همچنان صاحب کلید است',
  /@media\(min-width:791px\)\{\.hdr-actions \.theme-toggle/.test(extra) &&
  /@media\(max-width:790px\)\{ #mainNav \.theme-toggle\{position:absolute/.test(home));

console.log('\n── قابلیت‌های PR #40 ──');
var finder = (idx.match(/<form class="ptf-finder"[\s\S]*?<\/form>/) || [''])[0];
T('دکمه finder فقط SVG دارد و نام دسترس‌پذیر جستجو حفظ شده است',
  /<button type="submit" aria-label="جستجو" title="جستجو"><svg/.test(finder) && !/>جستجو<\/button>/.test(finder));
T('دو کارت سوابق معنایی و بدون hover اینلاین هستند',
  (idx.match(/<article class="ptf-record-card">/g) || []).length === 2 &&
  idx.indexOf('onmouseover="this.style.transform') === -1);
T('spotlight کارت‌های سوابق به موتور حرکت متصل است',
  /#why-ptf \.reveal,\.ptf-record-card/.test(motion));
T('لینک متنی جستجو در حضور ذره‌بین تزریق نمی‌شود',
  /document\.querySelector\("\.site-header \.hdr-search"\)/.test(discover) &&
  idx.indexOf('class="nav-search"') === -1);
T('JSهای تغییرکرده از نظر syntax معتبرند', (function () {
  try { new Function(motion); new Function(discover); return true; } catch (e) { return false; }
})());

DONE('tester673-v34.39.14-home-deploy-hotfix');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);

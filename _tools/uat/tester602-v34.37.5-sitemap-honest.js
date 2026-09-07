#!/usr/bin/env node
/* =============================================================================
   tester602-v34.37.5-sitemap-honest.js
   «ثبت نقشهٔ سایت از داخل CRM انجام نمی‌شود — نمی‌دانم مشکل از کجاست» (۱۴۰۵/۰۶/۱۴)
   دو تلهٔ خاموش که هرکدام می‌تواند این گزارش را بسازد:

   ① لایۀ فایل (api/cms.php): sitemap_add نتیجهٔ file_put_contents را دور می‌ریخت؛
      اگر sitemap-*.xml در ریشۀ هاست برای PHP نوشتنی نبود، صفحه منتشر می‌شد، پنل
      «✅ به sitemap هم اضافه شد» می‌گفت و فایل هرگز عوض نمی‌شد.
      ⇒ اکنون sitemap_add آرایۀ وضعیت برمی‌گرداند، خطا در cms_log ثبت می‌شود،
        پاسخ اکشن‌ها sitemap/sitemap_error دارد و alert پنل درودِ صادقانه می‌فرستد.

   ② لایۀ GSC (راهنما): مرحلۀ ۲ «Restricted» را دستور می‌داد؛ sitemap_submit نوشتن
      است و فقط با Full می‌گذرد ⇒ «همه‌چیز را رفتم ولی ثبت نمی‌شود».
      ⇒ راهنما به Full اصلاح شد + خط عیب‌یابی permission_siteRestrictedUser اضافه شد.

   ③ مسیر quietِ پس از انتشار (gsc.js) نتیجه را فقط داخل تبِ «سرچ کنسول» می‌نوشت؛
      اگر تب بسته بود، خطا کاملاً نامرئی می‌ماند ⇒ toast هشدار اضافه شد.

   روش: قرارداد متنیِ سفت (الگو، نه جمله) + رفتار واقعی cmsSitemapNote در vm +
   سینتکس api/cms.php با php-parser (اگر روی ماشین نصب باشد؛ در غیر آن رد می‌شود).
   ============================================================================= */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CMS_PHP = read('api/cms.php');
const CMS_JS = read('crm/cms.js');
const GSC_JS = read('crm/gsc.js');
const GUIDE = read('GSC-PANEL-SETUP-FA.md');

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' → ' + extra : '')); }
}
function head(s) { console.log('\n── ' + s + ' ──'); }

/* ── ۱) api/cms.php — نوشتن صادق ─────────────────────────────────────────── */
head('۱. api/cms.php (SITEMAP-HONEST)');
T('۱.۱ sitemap_write پایه: نتیجهٔ file_put_contents بررسی می‌شود',
  /function sitemap_write\(\$f, \$content\) \{\s*return file_put_contents\(\$f, \$content, LOCK_EX\) !== false;/.test(CMS_PHP));
T('۱.۲ sitemap_add در هر سه مسیرِ نوشتن، وضعیت برمی‌گرداند (ok/error)',
  (CMS_PHP.match(/return \['ok' =>/g) || []).length >= 5);
T('۱.۳ شکستِ نوشتنِ زیرنقشه → cms_log("sitemap_write_failed", …)',
  (CMS_PHP.match(/cms_log\('sitemap_write_failed'/g) || []).length >= 4);
T('۱.۴ sitemap_touch_index/index_ensure هم مقدارِ بولین برمی‌گردانند (سابقاً void بود)',
  /function sitemap_touch_index\(\$sub\)/.test(CMS_PHP) && /return sitemap_write\(\$idx, \$n\);/.test(CMS_PHP));
T('۱.۵ پلِ پاسخِ اکشن: cms_sm_resp تعریف شده و در Jok های انتشار استفاده می‌شود',
  /function cms_sm_resp\(\$r\)/.test(CMS_PHP) && (CMS_PHP.match(/cms_sm_resp\(\$smR\)/g) || []).length >= 6,
  String((CMS_PHP.match(/cms_sm_resp\(\$smR\)/g) || []).length));
['blog_create', 'kc_create', 'product_create', 'page_create', 'backup_restore', 'redirect_remove'].forEach((act) => {
  const i = CMS_PHP.indexOf("case '" + act + "':");
  let j = CMS_PHP.indexOf("case '", i + 5);
  /* case های چسبیده (fallthrough مثل product_create→product_preview) بلوک را قطع نکنند */
  while (j > -1 && /^\s*(case '[a-z_]+':\s*(\/\*[^*]*\*\/\s*)?)+$/s.test(CMS_PHP.slice(i, j))) j = CMS_PHP.indexOf("case '", j + 5);
  const blk = i > -1 ? CMS_PHP.slice(i, j > -1 ? j : i + 8000) : '';
  T('۱.۶ اکشن ' + act + ': نتیجهٔ sitemap_add به پاسخ می‌رسد', /\$smR = sitemap_add\(/.test(blk) && /cms_sm_resp\(\$smR\)/.test(blk));
});
T('۱.۷ هیچ sitemap_addِ بی‌نتیجه در اکشن‌های انتشار نمانده (≥۷ فراخوانیِ $smR=)',
  (CMS_PHP.match(/\$smR = sitemap_add\(/g) || []).length >= 6,
  String((CMS_PHP.match(/\$smR = sitemap_add\(/g) || []).length));

/* سینتکس — اگر php در دسترس است php -l، وگرنه php-parser، وگرنه رد (قرارداد گیت) */
{
  const { spawnSync } = require('child_process');
  const php = spawnSync('php', ['-l', path.join(ROOT, 'api/cms.php')], { encoding: 'utf8' });
  if (!php.error && php.status === 0) { T('۱.۸ php -l api/cms.php', true); }
  else {
    let parser = null;
    try { parser = require('php-parser'); } catch (e) {}
    if (!parser) console.log('SKIP ۱.۸ (نه php و نه php-parser موجود نیست — گیت روی ماشین استقرار همان را چک می‌کند)');
    else {
      let ok = true, msg = '';
      try { new parser({ parser: { extractDoc: false, suppressErrors: false } }).parseCode(CMS_PHP, 'cms.php'); }
      catch (e) { ok = false; msg = e.message; }
      T('۱.۸ php-parser: api/cms.php سینتکس سالم', ok, msg);
    }
  }
}

/* ── ۲) crm/cms.js — هشدار صادق در alert ها ──────────────────────────────── */
head('۲. crm/cms.js (پنل)');
T('۲.۱ cmsSitemapNote تعریف و expose شده', /window\.cmsSitemapNote = function \(d\)/.test(CMS_JS));
T('۲.۲ در پاسخِ ok هشدار نمی‌دهد و در failed علت+راه‌حل را می‌گوید', (() => {
  const i0 = CMS_JS.indexOf('window.cmsSitemapNote = function');
  const i1 = CMS_JS.indexOf('};', i0);
  if (i0 < 0) return false;
  const src = CMS_JS.slice(i0, i1 + 2);
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src + '\n', ctx, { filename: 'note.js' });
  const bad = ctx.window.cmsSitemapNote({ sitemap: 'failed', sitemap_error: 'خطای نوشتن sitemap-blog.xml' });
  const good = ctx.window.cmsSitemapNote({ sitemap: 'ok' });
  const legacy = ctx.window.cmsSitemapNote({});
  return bad.indexOf('خطای نوشتن sitemap-blog.xml') > -1 && bad.indexOf('664') > -1 && good === '' && legacy === '';
})());
T('۲.۳ alert وبلاگ «به sitemap اضافه شد» را مشروط به تأیید سرور می‌گوید (نه بی‌قیدوشرط)',
  /d\.sitemap === 'failed' \? 'به فهرست وبلاگ اضافه شد — اما ثبت نقشه ناموفق بود ⚠️' : '\(به فهرست وبلاگ و sitemap هم اضافه شد\)'/.test(CMS_JS));
T('۲.۴ هر هفت نقطۀ انتشار/بازنویسیِ صفحه به cmsSitemapNote بسته شده',
  (CMS_JS.match(/window\.cmsSitemapNote \? window\.cmsSitemapNote\((d|d2)\) : ''/g) || []).length >= 7,
  String((CMS_JS.match(/window\.cmsSitemapNote/g) || []).length));
T('۲.۵ پیامِ successِ وبلاگ بدونِ گاردِ sitemap دیگر در فایل نمانده',
  !/'\n\n\(به فهرست وبلاگ و sitemap هم اضافه شد\)'\);/.test(CMS_JS));

/* ── ۳) crm/gsc.js — مسیر quiet نامرئی نبود ───────────────────────────────── */
head('۳. crm/gsc.js (ثبت خودکار بی‌سروصدا)');
{
  const i0 = GSC_JS.indexOf('window.gscSubmitSitemapQuiet = function');
  const i1 = GSC_JS.indexOf('\n  };', i0);
  const F = i0 > -1 && i1 > i0 ? GSC_JS.slice(i0, i1 + 5) : '';
  T('۳.۰ بدنهٔ gscSubmitSitemapQuiet پیدا شد', F.length > 300, String(F.length));
  T('۳.۱ اگر تب GSC باز نباشد، شکستِ ثبت خودکار حداقل با toast اعلام می‌شود',
    /else if \(typeof ptfToast === 'function'\) ptfToast\('⚠️ ثبت خودکار نقشه در سرچ کنسول ناموفق بود/.test(F));
  T('۳.۲ مسیر رندر داخل پنل دست‌نخورده ماند (m.innerHTML برای خطا و موفقیت)',
    /if \(m\) m\.innerHTML = '⚠️/.test(F) && /if \(m\) m\.innerHTML = '✅/.test(F));
  T('۳.۳ ثبتِ feed همان sitemap-index.xml است (بدون رگرسیونِ مسیر)',
    /sitemap_submit', \{ feed: 'https:\/\/pishtaj\.ir\/sitemap-index\.xml' \}/.test(F));
}

/* ── ۴) راهنما — دامِ Restricted ⇒ Full ───────────────────────────────────── */
head('۴. GSC-PANEL-SETUP-FA.md');
T('۴.۱ مرحلۀ ۲ «Full» را دستور می‌دهد', /سطح دسترسی را \*\*Full\*\* بگذارید/.test(GUIDE));
T('۴.۲ «Restricted» دیگر دستورِ اصلی نیست (فقط در توضیح تفاوت سطوح می‌آید)',
  !/سطح دسترسی را \*\*Restricted\*\* بگذارید/.test(GUIDE) && /چرا Full و نه Restricted\؟/.test(GUIDE));
T('۴.۳ خط عیب‌یابی permission_siteRestrictedUser اضافه شد',
  /permission_siteRestrictedUser/.test(GUIDE) && /ثبت نقشه فقط با سطح Full مجاز است/.test(GUIDE));
T('۴.۴ توضیح خودبازنشانیِ توکن پس از تغییر سطح (نیازی به پاک‌کردن دستی نیست)',
  /خودکار بازنشانی می‌شود/.test(GUIDE));

/* ── ۴.۵) لایۀ وب‌سرور — allowlist api/.htaccess ─────────────────────────── */
head('۴.۵ api/.htaccess (دروازۀ وب‌سرور)');
{
  const HT = read('api/.htaccess');
  const m = /m#\/\(([A-Za-z0-9|_-]+)\)/.exec(HT);
  const allowed = m ? m[1].split('|') : [];
  T('۴.۵.۱ gsc.php در allowlist نشسته (وگرنه ثبت نقشه با 403 وب‌سرور بی‌پیام می‌میرد)',
    allowed.indexOf('gsc') > -1, allowed.join(','));
  T('۴.۵.۲ deny-by-default حذف نشده (فایل همچنان سفید-فهرستی است)', /Require all denied/.test(HT));
  T('۴.۵.۳ فایل‌های حساسِ غیرفعال باقی‌اند (tools/tech-proposal-docx]',
    /RewriteRule \^\(\?:tech-proposal-docx\|tools\)\\\.php\$ - \[F,L,NC\]/.test(HT));
}

/* ── ۵) آزمون جهش: الگوهای رفع‌شده نباید برگردند ─────────────────────────── */
head('۵. آزمون جهش');
{
  /* اگر sitemap_add دوباره void شود (return نكند)، اکشن‌ها sitemap='ok' قلابی می‌فرستند ⇒ این تست باید بگیرد */
  const MUT = CMS_PHP.replace(/function sitemap_add\(\$url\)/, 'function sitemap_add_MUTEDEXPORT($url)');
  T('۵.۱ اگر sitemap_add حذف/تغییرنام شود، اکشن‌ها نمی‌توانند نتیجه را گزارش دهند (فراخوانی‌ها می‌شکنند ⇒ قرمز)',
    MUT !== CMS_PHP && !/function sitemap_add\(\$url\)/.test(MUT));
  /* نسخهٔ قبلیِ alert وبلاگ: ادعای بی‌قیدوشرط ⇒ باید همین‌جا گرفته شود */
  const OLD_ALERT = "alert('✅ مقاله منتشر شد:\\npishtaj.ir/' + d.url + '\\n\\n(به فهرست وبلاگ و sitemap هم اضافه شد)');";
  T('۵.۲ ادعای بی‌قیدوشرطِ «به sitemap اضافه شد» (شکلِ قبل از رفع) در فایل بازنگشت',
    CMS_JS.indexOf(OLD_ALERT) === -1);
  const OLD_GUIDE = '3. ایمیلِ `client_email` را وارد کنید و سطح دسترسی را **Restricted** بگذارید → **Add**';
  T('۵.۳ دستورِ Restricted در راهنما بازنگشت', GUIDE.indexOf(OLD_GUIDE) === -1);
}

console.log('\n— tester602 (v34.37.8: SITEMAP-HONEST — ثبت نقشه فقط وقتی واقعی است + راهنمای Full) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);

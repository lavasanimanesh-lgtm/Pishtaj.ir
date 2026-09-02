#!/usr/bin/env node
'use strict';
/* tester555 — v34.29.3 (فاز S1 سئو): بستن حلقه‌ها
   ۱) صف متای AI (سرور: add/list/propose/apply/clear + محافظ‌ها؛ کلاینت: اجرا/دیف/تأیید)
   ۲) حلقهٔ ایندکس: ثبت تاریخچهٔ inspect + نمایش وضعیت قبلی
   ۳) نقشهٔ خودکار پس از انتشار + گزارش انحراف
   ۴) پیش‌نویس ماندگار فرم‌های KC/بلاگ
   ۵) گزارش یتیم‌ها (inlinks در اسکن) + پیشنهاد لینک AI (seo_intlinks) */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var cmsPhp = read('api/cms.php');
var llmPhp = read('api/llm.php');
var gscPhp = read('api/gsc.php');
var cmsJs = read('crm/cms.js');
var gscJs = read('crm/gsc.js');

/* ═══ ۱) صف متای AI — سرور ═══ */
T('S1: پنج اکشن صف در cms.php', ['seo_queue_add', 'seo_queue_list', 'seo_queue_propose', 'seo_queue_apply', 'seo_queue_clear'].every(function (a) { return cmsPhp.indexOf("case '" + a + "'") > -1; }));
T('S1: مسیرهای آرایه‌ای به‌صورت JSON-string پذیرفته می‌شوند (FormData)', cmsPhp.indexOf("json_decode($paths, true)") > -1 && cmsPhp.indexOf("json_decode($ids, true)") > -1);
T('S1: propose مسیر را validate می‌کند (ضد path-traversal)', cmsPhp.indexOf("seo_queue_valid_path($ROOT, $_POST['path'] ?? '')") > -1);
T('S1: اعمال = همان موتور page_meta_save با بک‌آپ', cmsPhp.indexOf('function seo_queue_apply_one') > -1 && cmsPhp.indexOf("cms_backup($DATA, $ROOT, $file);", cmsPhp.indexOf('function seo_queue_apply_one')) > -1);
T('S1: محافظ جهش حجم و ابطال کش اسکن در اعمال', /function seo_queue_apply_one[\s\S]*?1\.2 \+ 5000[\s\S]*?cms-seo-scan\.json[\s\S]*?unlink/.test(cmsPhp));
T('S1: سقف batch ۶۰ و سقف کل صف ۵۰۰', cmsPhp.indexOf('count($paths) > 60') > -1 && cmsPhp.indexOf('count($q[\'items\']) > 500') > -1);
T('S1: خطای AI = وضعیت error بدون پیشنهادِ بی‌تغییر', /seo_queue_propose'[\s\S]{0,900}\$_POST\['fail'\]/.test(cmsPhp));
T('S1: اعمال فقط برای proposed (نه pending/done)', /seo_queue_apply'[\s\S]{0,700}\$it\['st'\] !== 'proposed'/.test(cmsPhp));
T('S1: صف در crm/data (خارج از webroot عمومی؟ نه — ولی Deny از قبل)', cmsPhp.indexOf("seo_queue_file") > -1);

/* ═══ ۱) صف متای AI — کلاینت ═══ */
T('S1: جعبهٔ صف + دکمه‌های افزودن/اجرا/رفرش', cmsJs.indexOf('id="seoQueue"') > -1 && cmsJs.indexOf('cmsSeoQueueAdd') > -1 && cmsJs.indexOf('cmsSeoQueueRun') > -1);
T('S1: اجرای گروهی از متن واقعی صفحه (cmsPageText → seo_meta → propose)', /cmsSeoQueueRun[\s\S]{0,1200}cmsPageText\(it\.path[\s\S]{0,400}cmsLLM\('seo_meta'/.test(cmsJs));
T('S1: فاصلهٔ ۱.۲ ثانیه بین فراخوانی‌های AI (مهار نرخ)', cmsJs.indexOf('setTimeout(step, 1200)') > -1);
T('S1: دکمهٔ توقف در حین اجرا', cmsJs.indexOf('_q.stop = true') > -1 && cmsJs.indexOf('_q.running = true') > -1);
T('S1: دیف قدیم→جدید با خط‌خوردگی در بازبینی', cmsJs.indexOf('text-decoration:line-through') > -1 && cmsJs.indexOf('→ <b style="color:#065f46">') > -1);
T('S1: اعمال فقط تیک‌خورده‌ها + confirm + گزینهٔ ثبت نقشه پس از اعمال', cmsJs.indexOf('.seoQChk') > -1 && /cmsSeoQueueApply[\s\S]{0,700}confirm\(/.test(cmsJs) && cmsJs.indexOf('seoQResubmit') > -1);

/* ═══ ۲) حلقهٔ ایندکس ═══ */
T('IDX: تاریخچهٔ inspect در gsc.php (gsc_hist_add/load)', gscPhp.indexOf('function gsc_hist_add') > -1 && gscPhp.indexOf('function gsc_hist_load') > -1);
T('IDX: case inspect با log=1 قبلی را برمی‌گرداند', gscPhp.indexOf("'prev'        => $prevEntry") > -1 && gscPhp.indexOf("$_REQUEST['log']") > -1);
T('IDX: اکشن inspect_log (تاریخ یا آخرین وضعیت همه)', gscPhp.indexOf("case 'inspect_log'") > -1);
T('IDX: سقف ۵ ورودی هر URL و ۴۰۰ URL', gscPhp.indexOf('> 5') > -1 && gscPhp.indexOf('> 400') > -1);
T('IDX: کلاینت inspect با log=1 و نمایش سابقه + تغییر وضعیت', gscJs.indexOf("{ url: url, log: 1 }") > -1 && gscJs.indexOf('وضعیت تغییر کرده') > -1);

/* ═══ ۳) نقشهٔ خودکار + انحراف ═══ */
T('MAP: ثبت بی‌صدا (gscSubmitSitemapQuiet) بدون confirm/alert', gscJs.indexOf('window.gscSubmitSitemapQuiet') > -1 && /gscSubmitSitemapQuiet[\s\S]{0,700}!confirm/.test(gscJs) === false);
T('MAP: سوییچ از لایهٔ داده ptfDevKv (اصل A10 — بدون LS مستقیم)', cmsJs.indexOf("cms.sitemap.auto") > -1 && cmsJs.indexOf("cmsSitemapAutoOn") > -1 && /localStorage\s*\./.test(cmsJs) === false); /* واژه در کامنت مجاز؛ فراخوانی ممنوع */
T('MAP: پس از انتشار KC/بلاگ خودکار ثبت می‌شود (هر دو شاخه)', cmsJs.indexOf('cmsSitemapAfterPublish(); cmsDraftClear') === -1 && (cmsJs.match(/cmsSitemapAfterPublish\(\)/g) || []).length >= 4);
T('MAP: اکشن انحراف نقشه (روح/بدون‌نقشه)', cmsPhp.indexOf("case 'sitemap_drift'") > -1 && cmsPhp.indexOf("'ghost'") > -1 && cmsPhp.indexOf("'missing'") > -1);
T('MAP: دکمهٔ انحراف و سوییچ در تول‌بار سئو', cmsJs.indexOf('🧭 انحراف نقشه') > -1 && cmsJs.indexOf('ثبت خودکار نقشه: روشن') > -1);

/* ═══ ۴) پیش‌نویس ماندگار ═══ */
T('DRF: ذخیره/بازیابی/پاک پیش‌نویس از ptfDevKv با debounce ۷۰۰ms', cmsJs.indexOf('function cmsDraftSave') > -1 && /cmsDraftSave[\s\S]{0,300}ptfDevKv\.set/.test(cmsJs) && /cmsDraftClear[\s\S]{0,200}ptfDevKv\.remove/.test(cmsJs) && cmsJs.indexOf('setTimeout(function () { cmsDraftSave(fields); }, 700)') > -1);
T('DRF: فرم KC سیم‌کشی شده (restore+bind)', /cmsKcNew[\s\S]{0,4000}cmsDraftRestore\(KC_FIELDS, 'kcAiSt'\); cmsDraftBind\(KC_FIELDS\)/.test(cmsJs));
T('DRF: فرم بلاگ سیم‌کشی شده', cmsJs.indexOf("cmsDraftRestore(CB_FIELDS, 'cbAiSt'); cmsDraftBind(CB_FIELDS);") > -1);
T('DRF: انتشار موفق (هر دو شاخهٔ KC + بلاگ) پیش‌نویس را پاک می‌کند', (cmsJs.match(/cmsDraftClear\(KC_FIELDS\)/g) || []).length >= 2 && (cmsJs.match(/cmsDraftClear\(CB_FIELDS\)/g) || []).length >= 2);
T('DRF: دکمهٔ «پاک‌کردن پیش‌نویس» در نوار بازیابی', cmsJs.indexOf('پاک‌کردن پیش‌نویس') > -1 && cmsJs.indexOf('window.cmsDraftWipe') > -1);

/* ═══ ۵) یتیم‌ها + لینک‌سازی AI ═══ */
T('ORF: شمارش لینک ورودی در اسکن با نرمال‌سازی مسیر', cmsPhp.indexOf('&$inlinks') > -1 && cmsPhp.indexOf("elseif (substr($href, -1) === '/') \$href .= 'index.html';") > -1);
T('ORF: خودلینک (breadcrumb) شمرده نمی‌شود', cmsPhp.indexOf("if (\$href === \$rel) continue") > -1);
T('ORF: ایراد orphan + کلید آمار (404 مستثنا)', cmsPhp.indexOf("!== '404.html'") > -1 && cmsPhp.indexOf("'orphan' => 0") > -1);
T('ORF: برچسب و chip یتیم در کلاینت', cmsJs.indexOf("'orphan': ['یتیم (بدون لینک ورودی)', 'warn']") > -1 && cmsJs.indexOf("chip('یتیم (بدون لینک)', st['orphan']") > -1);
T('ORF: دکمهٔ 💡 لینک‌سازی روی ردیف یتیم', cmsJs.indexOf('cmsSeoLinkSuggest(') > -1 && cmsJs.indexOf('💡 لینک‌سازی') > -1);
T('ORF: اکشن seo_intlinks زیر گیت نقش سئو (admin/chairman/ceo/commercial)', llmPhp.indexOf("case 'seo_intlinks'") > -1 && /case 'seo_intlinks':[\s\S]{0,200}\$llmRole, \['admin', 'chairman', 'ceo', 'commercial'\]/.test(llmPhp));
T('ORF: llm seo_intlinks فقط JSON لینک می‌خواهد (from/anchor/how)', llmPhp.indexOf('{"links":[{"from":"<candidate path>","anchor":"...","how":"..."}]}') > -1);
T('ORF: کاندیدها سمت کلاینت فیلتر می‌شوند (هم‌پوشه/پربازدید) و ۴۰ تا سقف سرور', cmsJs.indexOf('x.folder === folder') > -1 && llmPhp.indexOf('count($cands) > 40') > -1);

/* ═══ بهداشت ═══ */
T('SEC: cms.php توکنی است (نقش از identity نه هدر)', cmsPhp.indexOf("auth_verify_token($token)") > -1 && cmsPhp.indexOf("$identity['role']") > -1 && cmsPhp.indexOf("$_SERVER['HTTP_X_CRM_ROLE']") === -1);
T('SEC: صف/تاریخچه داخل crm/data با htaccess Deny', cmsPhp.indexOf('Deny from all') > -1 && gscPhp.indexOf('gsc-inspect-history.json') > -1);
T('HYG: هیچ متن غیرفارسی جاافتاده در کامنت‌ها', [cmsPhp, cmsJs, gscJs, llmPhp, gscPhp].every(function (t) { return !/[а-яА-Я]{3}/.test(t); }));

console.log('=== tester555: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);

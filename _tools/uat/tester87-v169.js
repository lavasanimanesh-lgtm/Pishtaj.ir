/* tester87 — v16.9 (اسپرینت «تجربه ورود»: BUG-020 پرش تم + BUG-021 داشبورد کامل از ابتدا + تشخیص سنا) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var pm = fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v16.9+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=16.9;})());
T('کش sw >= v16.9', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=16.9;})());
(function () { var m = idx.match(/fx\.js\?v=([0-9.]+)/); T('cache-bust fx >= 16.9', m && parseFloat(m[1]) >= 16.9); })();

SECTION('BUG-020 (کد): پرش تم');
T('اسکریپت تم بلافاصله بعد از <body> (اولین فرزند)', /<body>\s*<script>\s*\/\* v16\.9 \(BUG-020\)/.test(idx));
T('کلاس ptf-dark همان لحظه + پوشش حالت auto', idx.indexOf("if (_thm === 'dark') document.body.classList.add('ptf-dark');") > -1 && idx.indexOf("if (_thm === 'auto')") > -1);
T('بلاک ضد FOUC هد (متغیرهای ریشه) پابرجا', idx.indexOf('BUG-003 Fix') > -1 && idx.indexOf("r.style.setProperty('--bg', '#0f172a')") > -1);
T('perms.js دست‌نخورده (سوییچ دستی/خودکار سالم)', pm.indexOf('window.ptfSetTheme = function (mode)') > -1 && pm.indexOf("matchMedia('(prefers-color-scheme: dark)').addEventListener") > -1);

SECTION('BUG-021 (کد): داشبورد کامل از ابتدا');
T('ناظر بعد از اولین goPanel(dash) در loadAll', idx.indexOf("goPanel('dash', document.querySelector('.sb-i'));\n  ptfDashEnsureFull();") > -1);
T('شرط تکمیل زنجیره hook (launcher/insights/fx/myday — TD-007 آگاه)', idx.indexOf('window._lchHooked && window._insDashHooked && window._fxDashHooked && window._mydayHooked') > -1);
T('گارد سه‌گانه: پنل dash فعال + ویجت غایب + بدون تعامل کاربر', idx.indexOf('onDash && missing && !window._ptfDashUserTouched') > -1);
T('تشخیص غایب: fxTicker/mydayBox/lchGrid', idx.indexOf("!document.getElementById('fxTicker') || !document.getElementById('mydayBox') || !document.getElementById('lchGrid')") > -1);
T('پرچم تعامل با اولین pointerdown (once)', idx.indexOf("document.addEventListener('pointerdown', function () { window._ptfDashUserTouched = true; }, { once: true, capture: true });") > -1);
T('سقف تلاش (بن‌بست ندارد)', idx.indexOf('tries > 25') > -1);

SECTION('تشخیص سنا (کد)');
T('برچسب «سنا: منبع پاسخ نداد» به‌جای حذف بی‌صدا', fx.indexOf('سنا: منبع پاسخ نداد') > -1 && fx.indexOf('var sanaMissing = (R.usd_free > 0)') > -1);
T('دکمه تست منبع فقط admin/chairman', fx.indexOf("['admin', 'chairman'].indexOf(curRole()) > -1") > -1);
T('ptfFxDiag: پاسخ خام force بدون کش + راهنمای هاست', fx.indexOf('window.ptfFxDiag = function') > -1 && fx.indexOf('action=rates&force=1') > -1 && fx.indexOf('outbound') > -1 && fx.indexOf('tgju.org') > -1);
T('sanaDiag در نوار درج می‌شود', fx.indexOf('sanaUsd + sanaEur + sanaDiag +') > -1);

SECTION('رفتاری: منطق تشخیص سنا');
(function () {
  /* بازسازی شرط sanaMissing */
  function missing(R) { return (R.usd_free > 0) && !R.usd_sana_buy && !R.usd_sana_sell && !R.eur_sana_buy && !R.eur_sana_sell; }
  T('آزاد آمده + سنا صفر → تشخیص فعال', missing({ usd_free: 130000, usd_sana_buy: 0, usd_sana_sell: 0, eur_sana_buy: 0, eur_sana_sell: 0 }) === true);
  T('سنا موجود → تشخیص خاموش', missing({ usd_free: 130000, usd_sana_buy: 110000, usd_sana_sell: 0, eur_sana_buy: 0, eur_sana_sell: 0 }) === false);
  T('کل منبع قطع (آزاد هم صفر) → تشخیص خاموش (پیام قطعی کلی جدا است)', missing({ usd_free: 0, usd_sana_buy: 0, usd_sana_sell: 0, eur_sana_buy: 0, eur_sana_sell: 0 }) === false);
})();

SECTION('رگرسیون');
T('زنجیره hook داشبورد دست‌نخورده (launcher/insights/fx/myday)', fs.readFileSync(path.join(BASE, 'launcher.js'), 'utf-8').indexOf('window._lchHooked = true;') > -1 && fs.readFileSync(path.join(BASE, 'myday.js'), 'utf-8').indexOf('window._mydayHooked = true;') > -1);
T('نوار ارز بالاترین نقطه (v16.3) + سلول‌های یوآن v16.7 پابرجا', fx.indexOf('return w + h;') > -1 && fx.indexOf("fxCell('یوان آزاد 🇨🇳'") > -1);
T('سلول‌های سنا (خرید/فروش v16.7) پابرجا', fx.indexOf('دلار سنا 🏦') > -1);
T('loadAll: تنظیمات ایمیل/پیامک مثل قبل', idx.indexOf("if (s.email) { var el = document.getElementById('sEmail')") > -1);
T('ptfProjectProfitIRR/ptfFxPayDialog دست‌نخورده', fx.indexOf('window.ptfProjectProfitIRR') > -1 && fx.indexOf('ptfFxPayDialog') > -1);
T('اسکریپت body تم قبل از هر اسکریپت src (صفر وابستگی)', idx.indexOf('/* v16.9 (BUG-020)') < idx.indexOf('<script src='));

DONE('tester87-v169');

/* tester77 — v15.9 (US-389: نظام واحد کالا — مدل + دسته فارسی استاندارد + جستجوی دوزبانه) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var dd = fs.readFileSync(path.join(BASE, 'dedup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var st = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var iq = fs.readFileSync(path.join(BASE, 'inqreader.js'), 'utf-8');
var rq = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('① فیلد مدل در فرم کالا');
T('فیلد nPMd در فرم ثبت/ویرایش', idx.indexOf('id="nPMd"') > -1 && idx.indexOf('مدل / پارت‌نامبر') > -1);
T('md در رکورد ذخیره می‌شود', idx.indexOf("md: (document.getElementById('nPMd')||{value:''}).value.trim()") > -1);
T('نمایش مدل در جدول کالاها (زیر برند)', idx.indexOf("(p.md?'<br><small style=\"color:#7c3aed") > -1);
T('خروجی اکسل شامل ستون مدل', idx.indexOf("'برند','مدل','واحد'") > -1);
T('ایمپورت اکسل: ستون F=برند و G=مدل', idx.indexOf('var br = String(row[5]') > -1 && idx.indexOf('var md = String(row[6]') > -1);
T('راهنمای اکسل به‌روز (F/G)', idx.indexOf("'ستون F', n: 'برند'") > -1 && idx.indexOf("'ستون G', n: 'مدل / پارت‌نامبر'") > -1);
T('ویرایش کالا فیلدهای سیستمی را حفظ می‌کند (tp/srcInq/refPrice)', idx.indexOf('rec.tp=items[i].tp; rec.srcInq=items[i].srcInq;') > -1);

SECTION('② نظام واحد دسته: ca فارسی استاندارد + tp خام');
T('ptfNormCat در dedup.js (اولین فایل لودشده)', dd.indexOf('window.ptfNormCat = function (raw)') > -1);
T('نگاشت Electrical→برق صنعتی و ۱۸ تایپ دیگر', dd.indexOf("'electrical': 'برق صنعتی'") > -1 && dd.indexOf("'valve': 'شیرآلات'") > -1 && dd.indexOf("'instrument': 'ابزار دقیق'") > -1);
T('هر ۶ نقطه ثبت خودکار نرمال می‌کنند', [of, st, ai, iq, rq].every(function (src) { return src.indexOf('ptfNormCat') > -1; }) && idx.indexOf("ca = ptfNormCat(ca)") > -1);
T('saveProd هم نرمال می‌کند (دفاع عمقی)', idx.indexOf("rec.ca = (typeof ptfNormCat === 'function') ? ptfNormCat(rec.ca) : rec.ca;") > -1);
T('مهاجرت نرم بوت: دسته انگلیسی موجود → فارسی + حفظ tp', idx.indexOf('if (fa2 !== p.ca) { if (!p.tp && p.ca) p.tp = p.ca; p.ca = fa2; caMig = true; }') > -1);
T('فیلتر دسته با نرمال‌سازی (Electrical قدیمی زیر «برق صنعتی» می‌آید)', idx.indexOf("var pCa = (typeof ptfNormCat === 'function') ? ptfNormCat(p.ca) : p.ca;") > -1);
T('AI/tripleGo: tp خام حفظ + srcInq', ai.indexOf("tp:r.tp||'Other',srcInq:inqNo||''") > -1);

SECTION('③ جستجوی دوزبانه');
T('موتور مشترک ptfProdSearchMatch با مترادف‌های دوزبانه', dd.indexOf('window.ptfProdSearchMatch = function (p, q)') > -1 && dd.indexOf("['برق', 'برق صنعتی', 'electrical', 'cable', 'کابل', 'الکتریکال']") > -1);
T('ماژول کالا از موتور مشترک استفاده می‌کند', idx.indexOf('return ptfProdSearchMatch(p, q);') > -1);
T('جستجوی فرم پیشنهاد (offerlock) هم', ol.indexOf('return all.filter(function (p) { return ptfProdSearchMatch(p, q); }).slice(0, 12);') > -1);
T('offPickProd مدل کالا را هم می‌نشاند', ol.indexOf('if (!it.model && p.md) it.model = p.md;') > -1);

SECTION('④ پرامپت AI: مدل از دل شرح + برند فقط با قطعیت');
T('مدل از هر جای شرح استخراج شود', llm.indexOf('EXTRACTED FROM ANYWHERE in the item description') > -1);
T('برند: صریح یا ۱۰۰٪ قطعی از کد مدل — هرگز حدس نزن', llm.indexOf('unambiguously (100%) implied by a model/part code') > -1 && llm.indexOf('never guess') > -1);

SECTION('رفتار اجرایی: نگاشت دسته + جستجو');
(function () {
  global.window = global;
  var mNorm = dd.match(/var PTF_CAT_MAP = \{[\s\S]*?window\.ptfProdSearchMatch = function \(p, q\) \{[\s\S]*?\n\};/);
  T('بلوک کامل استخراج شد', !!mNorm);
  if (!mNorm) return;
  global.dedupNorm = function (s) {
    s = String(s == null ? '' : s);
    var fa = '۰۱۲۳۴۵۶۷۸۹';
    var out = '';
    for (var i = 0; i < s.length; i++) { var c = s.charAt(i), f = fa.indexOf(c); out += f > -1 ? String(f) : c; }
    return out.replace(/[\u200c\s\-_.،,;()\/\\]/g, '').toLowerCase();
  };
  eval(mNorm[0]);
  T('Electrical → برق صنعتی', ptfNormCat('Electrical') === 'برق صنعتی');
  T('Cable → برق صنعتی', ptfNormCat('Cable') === 'برق صنعتی');
  T('Valve → شیرآلات', ptfNormCat('Valve') === 'شیرآلات');
  T('Instrument → ابزار دقیق', ptfNormCat('Instrument') === 'ابزار دقیق');
  T('Pipe → پایپینگ', ptfNormCat('Pipe') === 'پایپینگ');
  T('Flange/Gasket/Bolt & Nut → فلنج و اتصالات', ptfNormCat('Flange') === 'فلنج و اتصالات' && ptfNormCat('Gasket') === 'فلنج و اتصالات' && ptfNormCat('Bolt & Nut') === 'فلنج و اتصالات');
  T('Pump → پمپ و کمپرسور', ptfNormCat('Pump') === 'پمپ و کمپرسور');
  T('دسته فارسی استاندارد دست نمی‌خورد', ptfNormCat('برق صنعتی') === 'برق صنعتی' && ptfNormCat('ابزار دقیق') === 'ابزار دقیق');
  T('ناشناخته/خالی → سایر', ptfNormCat('XyzUnknown') === 'سایر' && ptfNormCat('') === 'سایر');
  T('دسته قدیمی «پایپینگ و شیرآلات» → پایپینگ', ptfNormCat('پایپینگ و شیرآلات') === 'پایپینگ');
  /* جستجوی دوزبانه */
  var pElec = { cd: 'P-1', nm: 'الکتروموتور ۷.۵ کیلووات', ca: 'Electrical', tp: 'Electrical' };
  T('کالای Electrical با جستجوی «برق» پیدا می‌شود', ptfProdSearchMatch(pElec, 'برق'));
  var pFa = { cd: 'P-2', nm: 'شیر توپی ۲ اینچ', ca: 'شیرآلات' };
  T('شرح فارسی با جستجوی «valve» پیدا می‌شود', ptfProdSearchMatch(pFa, 'valve'));
  T('جستجوی مدل کار می‌کند', ptfProdSearchMatch({ cd: 'P-3', nm: 'ترانسمیتر', md: '3051CD2A' }, '3051'));
  T('ارقام فارسی در جستجو («۲ اینچ»)', ptfProdSearchMatch(pFa, dedupNorm('۲اینچ') ? '۲ اینچ' : '2'));
  T('کوئری بی‌ربط → پیدا نمی‌شود', !ptfProdSearchMatch(pFa, 'کابل'));
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
T('cache-bust فایل‌های اسپرینت (>=15.9)', ['dedup.js', 'offers.js', 'storage.js', 'inqreader.js', 'ai-workbench.js', 'offerlock.js', 'rfqsmart.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 15 || (+m[1] === 15 && +m[2] >= 9));
}));

DONE('tester77-v159');

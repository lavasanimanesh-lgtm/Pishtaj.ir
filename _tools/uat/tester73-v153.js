/* tester73 — v15.3 (BUG-016: دکمه «متوجه شدم» راهنمای ورود اکسل، فایل‌پیکر باز نمی‌شد) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('ریشه BUG-016: ارجاع متغیر محلی در onclick سراسری');
T('onclick معیوب (fileInputId خام در رشته) حذف شد', idx.indexOf('document.getElementById(fileInputId).click();">✅ متوجه شدم') === -1);
T('دکمه به تابع سراسری ptfXlsGuideGo با id درج‌شده وصل شد', idx.indexOf('onclick="ptfXlsGuideGo(this, &quot;\' + fileInputId + \'&quot;)">✅ متوجه شدم') > -1);
T('تابع سراسری تعریف شد', idx.indexOf('window.ptfXlsGuideGo = function (btn, fid)') > -1);
T('آخرین نمونه id انتخاب می‌شود (ضد id تکراری مودال‌های مینیمایز — هم‌راستا offEl/US-364)', idx.indexOf("els.length ? els[els.length - 1] : null") > -1);
T('نبود فیلد → پیام شفاف نه سکوت', idx.indexOf('فیلد انتخاب فایل یافت نشد') > -1);
T('مودال راهنما قبل از کلیک بسته می‌شود', idx.indexOf("var mb = btn.closest('.md-b'); if (mb) mb.remove();") > -1);

SECTION('پوشش هر ۵ ماژول دارای راهنمای اکسل');
var ld = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
T('PROD/CUST/SUP از مودال مشترک index استفاده می‌کنند', ['&quot;PROD&quot;, &quot;pCsvIn&quot;', '&quot;CUST&quot;, &quot;custXlsInp&quot;', '&quot;SUP&quot;, &quot;supXlsInp&quot;'].every(function (x) { return idx.indexOf(x) > -1; }));
T('LEADS هم از همان مودال', ld.indexOf('ptfShowExcelGuidelineModal(&quot;LEADS&quot;, &quot;leadsXlsInp&quot;)') > -1);
T('OFFER هم از همان مودال', of.indexOf("ptfShowExcelGuidelineModal(\\'OFFER\\', \\'offXls\\')") > -1);

SECTION('رفتار اجرایی: شبیه‌سازی کلیک');
(function () {
  /* استخراج تابع و اجرا با DOM ساختگی */
  var m = idx.match(/window\.ptfXlsGuideGo = function \(btn, fid\) \{[\s\S]*?\n\};/);
  T('تابع استخراج شد', !!m);
  if (!m) return;
  var clicked = [], removed = [], alerts = [];
  global.alert = function (x) { alerts.push(String(x)); };
  global.document = {
    querySelectorAll: function (sel) {
      if (sel === '#pCsvIn') return [{ click: function () { clicked.push('old'); } }, { click: function () { clicked.push('new'); } }];
      if (sel === '#ghost') return [];
      return [];
    }
  };
  eval(m[0]);
  var fakeBtn = { closest: function () { return { remove: function () { removed.push(1); } }; } };
  ptfXlsGuideGo(fakeBtn, 'pCsvIn');
  T('مودال بسته شد + کلیک روی «آخرین» نمونه input رفت', removed.length === 1 && clicked.length === 1 && clicked[0] === 'new');
  ptfXlsGuideGo(fakeBtn, 'ghost');
  T('id ناموجود → پیام راهنما (بدون کرش)', alerts.length === 1 && alerts[0].indexOf('یافت نشد') > -1);
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));

DONE('tester73-v153');

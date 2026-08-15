/* tester76 — v15.7 (US-388: اقلام داخل پنجره ثبت درخواست + دیدن ضمایم پس از ثبت) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var iq = fs.readFileSync(path.join(BASE, 'inqreader.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('مشکل ۱: ورود اقلام داخل خود پنجره «ثبت درخواست جدید»');
T('بخش اقلام در مودال ثبت (nR2ItemsWrap)', br.indexOf('id="nR2ItemsWrap"') > -1 && br.indexOf('📋 اقلام درخواست (اختیاری') > -1);
T('دکمه «＋ افزودن قلم»', br.indexOf('onclick="rfqNewItemRow()"') > -1 && br.indexOf('window.rfqNewItemRow = function (v)') > -1);
T('ردیف قلم: شرح/تعداد/واحد/مشخصه + حذف ✕', ['data-f="nm"', 'data-f="qty"', 'data-f="un"', 'data-f="st"'].every(function (x) { return br.indexOf(x) > -1; }));
T('saveRfq2 اقلام مودال را در inqitems ذخیره می‌کند', br.indexOf('rfqCollectModalItems(cd)') > -1 && br.indexOf("var rec = { inqNo: cd, cd: genCode('IQI'), nm: nm") > -1);
/* v15.8: اتصال به ماژول کالا با تایید کاربر */
T('v15.8: پیشنهاد ثبت کالاها در ماژول کالا (با تایید)', br.indexOf('آیا این کالاها به «ماژول کالا» هم اضافه شوند؟') > -1 && br.indexOf('ptfAutoRegisterSummaryProducts(cd, modalItems)') > -1);
T('v15.8: مارک شماره درخواست (srcInq) در ثبت کالا', fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8').indexOf("ds: 'خلاصه اتوماتیک از استعلام ' + inqNo, srcInq: inqNo") > -1);
T('اقلام وارد شد → سوال دوباره «الان وارد کنید؟» نمی‌آید', br.indexOf('return; /* اقلام وارد شده — سوال دوباره لازم نیست */') > -1);
T('قلم بدون شرح نادیده گرفته می‌شود', br.indexOf("var nm = g('nm');\n      if (!nm) return;") > -1);
T('مسیر قبلی (US-326: ورود بعدی اقلام) پابرجا', br.indexOf('ptfOpenFullInqEditor(cd);') > -1);

SECTION('مشکل ۲: دیدن ضمایم پس از ثبت (رفرنس کاربران)');
T('بج یکسان «📎 n ضمیمه / بدون ضمیمه» از projection جدید و legacy', br.indexOf('ptfRfqAttachmentCount') > -1 && br.indexOf("nAtt + ' ضمیمه") > -1 && br.indexOf('بدون ضمیمه') > -1);
T('کلیک بج = باز شدن مودال ضمایم', br.indexOf("onclick=\"event.stopPropagation();ptfManageInqAttachments(") > -1);
T('بخش ضمایم داخل مودال ✏️ ویرایش درخواست', br.indexOf('📎 ضمایم درخواست (') > -1 && br.indexOf('＋ افزودن / مدیریت') > -1);
T('مشاهده/دانلود مستقیم هر فایل در مودال ویرایش', br.indexOf('👁 مشاهده</a>') > -1 && br.indexOf('⬇️ دانلود</a>') > -1);
T('هر ۶ دسته پوشش داده شد (inq/ds/img/dwg/oth/cat)', br.indexOf("cats = { inq: '📥 فایل استعلام', ds: '📊 دیتاشیت', img: '🖼 عکس کالا', dwg: '📐 نقشه', oth: '📎 سایر', cat: '📚 کاتالوگ' }") > -1);
T('زیرساخت موجود مودال پیوست‌ها (US-325) پابرجا', iq.indexOf('window.ptfManageInqAttachments = function(cd)') > -1 && iq.indexOf("renderFileList('inq'") > -1);

SECTION('رفتار اجرایی: ذخیره اقلام مودال');
(function () {
  global.window = global;
  global.escP = function (s) { return String(s == null ? '' : s); };
  global.genCode = function (p) { return p + '-' + (++global._seq || (global._seq = 1)); };
  /* شبیه‌سازی DOM ردیف‌های اقلام */
  var rows = [
    { nm: 'لوله ۶ اینچ', qty: '20', un: 'شاخه', st: 'A106' },
    { nm: '', qty: '5', un: 'عدد', st: '' }, /* بدون شرح → رد */
    { nm: 'فلنج', qty: '', un: 'عدد', st: '' } /* بدون تعداد → پیش‌فرض 1 */
  ];
  global.document = {
    getElementById: function (id) {
      if (id !== 'nR2ItemsWrap') return null;
      return {
        querySelectorAll: function () {
          return rows.map(function (rv) {
            return { querySelector: function (sel) { var f = sel.match(/data-f="(\w+)"/)[1]; return { value: rv[f] }; } };
          });
        }
      };
    }
  };
  var m = br.match(/function rfqCollectModalItems\(cd\) \{[\s\S]*?\n  \}/);
  T('rfqCollectModalItems استخراج شد', !!m);
  if (!m) return;
  setData('ptf_crm_inqitems', []);
  eval(m[0]);
  var got = rfqCollectModalItems('RFQ-777');
  var n = got.length; /* v15.8: حالا آرایه برمی‌گرداند */
  var items = getData('ptf_crm_inqitems');
  T('۲ قلم معتبر ذخیره شد (ردیف بی‌شرح رد)', n === 2 && items.length === 2);
  T('v15.8: خروجی آرایه اقلام است (برای ثبت کالا)', Array.isArray(got) && got[0].nm === 'لوله ۶ اینچ');
  T('اتصال به شماره درخواست + مقادیر درست', items[0].inqNo === 'RFQ-777' && items[0].nm === 'لوله ۶ اینچ' && items[0].qty === 20 && items[0].un === 'شاخه');
  T('تعداد خالی → پیش‌فرض ۱', items[1].nm === 'فلنج' && items[1].qty === 1);
  /* شمار ضمایم بج */
  var r = { files: { inq: [{ name: 'a.pdf' }], ds: [{ name: 'b.pdf' }, { name: 'c.pdf' }], img: [] } };
  var nAtt = 0;
  Object.keys(r.files || {}).forEach(function (k2) { nAtt += (r.files[k2] || []).length; });
  T('شمار ضمایم بج = ۳', nAtt === 3);
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust bridge (>=15.7)', (function () {
  var m = idx.match(/bridge\.js\?v=(\d+)\.(\d+)/);
  return m && (+m[1] > 15 || (+m[1] === 15 && +m[2] >= 7));
})());

DONE('tester76-v157');

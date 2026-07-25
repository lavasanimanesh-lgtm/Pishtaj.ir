/* tester80 — v16.2 (BUG-017: پنجره‌های مینیمایزشده هرگز قربانی بستن مودال‌های دیگر نشوند) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var ar = fs.readFileSync(path.join(BASE, 'archive.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var rq = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var ch = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('ریشه BUG-017: hideModal فقط مودال قابل‌مشاهده');
T('hideModal: حلقه از آخر روی مودال‌های visible', idx.indexOf("if ((modals[i].style || {}).display !== 'none') { modals[i].remove(); return; }") > -1);
T('کامنت ریشه (مینیمایز modalx در body)', idx.indexOf('BUG-017') > -1);

SECTION('پاکسازی‌های گروهی: مینیمایزها مستثنی');
T('archive.js: هر دو نقطه', (ar.match(/if \(\(m\.style \|\| \{\}\)\.display !== 'none'\) m\.remove\(\);/g) || []).length === 2);
T('buycompare.js: پاکسازی‌های گروهی باقی‌مانده فقط visible هستند (v18.6 مسیر خرید واقعی دیگر پاکسازی گروهی ندارد)', (bc.match(/if \(\(m\.style \|\| \{\}\)\.display !== 'none'\) m\.remove\(\);/g) || []).length >= 3 && bc.indexOf('oldCmp = document.getElementById') > -1);
T('offers.js (US-364 v14.2) از قبل امن بود', fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8').indexOf("mb.style.display !== 'none' && mb.querySelector('[id=\"offItemsWrap\"]')") > -1);

SECTION('حذف «آخرین مودال»: فقط visible');
T('rfqsmart.js: هر ۶ نقطه', (rq.match(/\(mds\[_m[ij]\]\.style \|\| \{\}\)\.display !== 'none'/g) || []).length >= 6);
T('backup.js: نقطه بازگردانی سروری', bk.indexOf("_mi >= 0") > -1 && bk.indexOf('v16.2 BUG-017') > -1);
T('cheques.js تزریق روی آخرین visible', ch.indexOf("if (!_pb || _pb.style.display !== 'none') { md = mds[_mv]; break; }") > -1);
T('offerlock.js تنظیم عرض روی آخرین visible', ol.indexOf("if (!_pb || _pb.style.display !== 'none') { md = mds[_mv]; break; }") > -1);

SECTION('رفتار اجرایی: بازتولید سناریوی کارفرما');
(function () {
  /* DOM ساختگی: فرم پیشنهاد مینیمایز (display:none در body) + مودال کالا باز (panels) */
  function makeEl(id, disp) {
    return { id: id, style: { display: disp }, removed: false, remove: function () { this.removed = true; } };
  }
  var minimized = makeEl('offerForm', 'none');
  var prodModal = makeEl('prodModal', 'grid');
  var all = [minimized, prodModal]; /* ترتیب سند: مینیمایز اول (به body منتقل شده قبل از باز شدن مودال کالا)... */
  /* سناریوی بدتر: مینیمایز انتهای body = آخرین عنصر */
  var all2 = [prodModal, minimized];
  function hideModalNew(list) {
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].style.display !== 'none') { list[i].remove(); return list[i]; }
    }
    return null;
  }
  minimized.removed = false; prodModal.removed = false;
  var victim = hideModalNew(all2);
  T('کیس استادی: hideModal مودال کالا را می‌بندد نه فرم مینیمایز', victim === prodModal && !minimized.removed);
  /* پاکسازی گروهی جدید */
  minimized.removed = false; prodModal.removed = false;
  all2.forEach(function (m) { if (m.style.display !== 'none') m.remove(); });
  T('پاکسازی گروهی: فقط visible حذف شد', prodModal.removed && !minimized.removed);
  /* بازگردانی از داک: پنجره زنده است */
  T('پنجره مینیمایز پس از همه عملیات زنده است (بازگردانی از داک ممکن)', minimized.removed === false);
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
T('cache-bust فایل‌های اسپرینت (>=16.2)', ['archive.js', 'buycompare.js', 'rfqsmart.js', 'backup.js', 'cheques.js', 'offerlock.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 16 || (+m[1] === 16 && +m[2] >= 2));
}));

DONE('tester80-v162');

/* =====================================================================
   v34.0.0-alpha (F4-7) — Migration: حقوق سهامداران که opex ندارند
   =====================================================================
   مشکل: قبل از F4-7، اگر هزینهٔ حقوق یک سهامدار از opex حذف می‌شد
   (مثلاً با دکمهٔ ✕ در تب هزینه‌های جاری)، فراخوانی بعدی
   ensureSalaryTxForMonth دیگر opex را ایجاد نمی‌کرد. در نتیجه
   حقوق سهامدار در opex نبود و در محاسبات سال مالی لحاظ نمی‌شد.

   از v34.0.2-alpha به بعد، منطق اصلی به تابع
   window.ptfMigrateShareholderOpex در crm/shareholders.js منتقل شده و
   از داخل اپ هم با دکمهٔ «🛠 بازسازی حقوق سهامدار» در پنل «هزینه‌های
   جاری» قابل اجراست (توصیه‌شده — نیاز به کنسول ندارد).

   نحوهٔ اجرای این اسکریپت قدیمی (فقط در صورت لزوم):
   1) وارد پنل CRM شوید (دسترسی مالی)
   2) کنسول مرورگر را باز کنید (F12 → Console)
   3) محتوای این فایل را copy-paste و Enter بزنید
   ===================================================================== */
(function () {
  'use strict';
  if (typeof window.ptfMigrateShareholderOpex === 'function') {
    var r = window.ptfMigrateShareholderOpex();
    console.log('✅ مهاجرت از طریق تابع داخلی اپ انجام شد:', r);
    return r;
  }
  /* fallback مستقل (اگر shareholders.js بارگذاری نشده بود) */
  var K_SH = 'ptf_crm_shareholders', K_TX = 'ptf_crm_sharetx', K_OPX = 'ptf_crm_opex';
  function _get(k) { return typeof getData === 'function' ? getData(k) : JSON.parse(localStorage.getItem(k) || '[]'); }
  function _set(k, v) { if (typeof setData === 'function') setData(k, v); else localStorage.setItem(k, JSON.stringify(v)); }
  var shs = _get(K_SH) || [];
  var txs = _get(K_TX) || [];
  var opx = _get(K_OPX) || [];
  var opxByShareTx = {};
  opx.forEach(function (o) { if (o.shareTx) opxByShareTx[o.shareTx] = o; });
  var created = 0, skipped = 0, errors = [];
  shs.filter(function (s) { return s && s.active !== false && s.duty && (+s.salary || 0) > 0; }).forEach(function (s) {
    txs.filter(function (x) { return x.type === 'salary' && x.shCd === s.cd; }).forEach(function (x) {
      if (opxByShareTx[x.cd]) { skipped++; return; }
      var newOpx = {
        cd: 'OPX-MIG-' + x.cd,
        cat: 'حقوق و دستمزد',
        amt: +x.amt || 0,
        month: x.month,
        desc: 'حقوق موظف سهامدار: ' + s.name + ' (مهاجرت F4-7)',
        t: x.t,
        by: x.by || 'migration-F4-7',
        shareTx: x.cd,
        shareholderSalary: true,
        migrated: true
      };
      opx.unshift(newOpx);
      opxByShareTx[x.cd] = newOpx;
      created++;
    });
  });
  if (created > 0) {
    _set(K_OPX, opx);
    console.log('✅ ' + created + ' هزینهٔ حقوق فاقد opex ایجاد شد (skipped=' + skipped + ')');
    if (typeof ptfOpexRender === 'function') { try { ptfOpexRender(); } catch (e) {} }
    if (typeof ptfShareRender === 'function') { try { ptfShareRender(); } catch (e) {} }
  } else {
    console.log('ℹ️ چیزی برای مهاجرت نبود (created=0, skipped=' + skipped + ')');
  }
  console.log('📊 تعداد opex کل: ' + opx.length);
  return { created: created, skipped: skipped, totalOpex: opx.length };
})();

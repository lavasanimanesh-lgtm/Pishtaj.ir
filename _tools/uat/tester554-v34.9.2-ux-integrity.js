#!/usr/bin/env node
'use strict';
/* tester554 — v34.20.0: اصلاحات یکپارچگی داده + UX (درخواست مالک ۲۰۲۶-۰۸-۳۱)
   A) اتحاد ضمایم شیءدسته‌ای در merge (RCA ضمایم گم‌شده)
   B) مشتریان: sort جدیدترین‌اول + گارد برخورد کد + expectCreate سروری (RCA ثبت‌کنندهٔ اشتباه)
   C) خزانه: نرمال‌سازی تاریخ + مرتب‌سازی زمانی
   D) نام دوگانهٔ مشتری (فارسی+انگلیسی) در مشتریان/فاکتورها/پیشنهادات/مطالبات
   E) جستجوی فاکتورها · F) typeahead مشتری در فرم پیشنهاد
   G) مکاتبات: فالبک امضای نام‌نمایشی + کپی نامه به پیش‌نویس
   H) سپر shared-union + محافظ opexTpl + دکمهٔ انتقال داخل بنر */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var ih = read('crm/index.html');
var sy = read('crm/sync.js');
var of = read('crm/offers.js');
var rb = read('crm/rbac.js');
var bk = read('crm/backup.js');
var lt = read('crm/letters.js');
var tr = read('crm/treasury.js');
var cf = read('crm/customer-finance.js');
var sdv = read('crm/sales-domain-v2.js');
var php = read('api/sales-domain.php');
var crmPhp = read('api/crm.php');

function fnSrc(src, header) {
  var i = src.indexOf(header);
  if (i < 0) throw new Error('anchor-missing: ' + header);
  var depth = 0, seen = false;
  for (var j = i; j < Math.min(i + 20000, src.length); j++) {
    var c = src[j];
    if (c === '{') { depth++; seen = true; }
    else if (c === '}') { depth--;
      if (seen && depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error('fn-end-missing: ' + header);
}

/* ═══ A) اتحاد ضمایم دسته‌ای ═══ */
T('A: مسیر شیءدسته‌ای در ptfMergeAttachmentFields اضافه شد', sy.indexOf('RCA ضمایم گم‌شده') > -1 && sy.indexOf('var aObj = a.files && typeof a.files === \'object\' && !Array.isArray(a.files);') > -1);
T('A: union per-category با احترام به _deletedFileKeys', sy.indexOf('delC[k]') > -1 && sy.indexOf('mergedCats[cat] = catOut;') > -1);
T('A: مسیر آرایه‌ای قبلی دست‌نخورده ماند', sy.indexOf('(b.files || []).forEach(addFile);') > -1);
(function () { /* رفتاری: winner فقط files خودش را ندارد؛ loser هم می‌ماند */
  try {
    var ctx = { window: {} };
    vm.runInNewContext(fnSrc(sy, 'function ptfMergeAttachmentFields'), ctx);
    var out = vm.runInNewContext('var out={}; ptfMergeAttachmentFields(out, {files:{inq:[{key:"a",name:"A"}]}}, {files:{inq:[{key:"b",name:"B"}], ds:[{key:"c",name:"C"}]}}); out;', ctx);
    T('A/رفتاری: هر دو طرف در اتحاد می‌مانند', out.files && out.files.inq.length === 2 && out.files.ds.length === 1);
    var out2 = vm.runInNewContext('var out={}; ptfMergeAttachmentFields(out, {files:{inq:[{key:"x",name:"X"}]}, _deletedFileKeys:["y"]}, {files:{inq:[{key:"y",name:"Y"}]}}); out;', ctx);
    T('A/رفتاری: فایل حذف‌شدهٔ عمدی زنده نمی‌شود', out2.files.inq.length === 1 && out2.files.inq[0].key === 'x');
  } catch (e) { T('A/رفتاری اجرا شد', false, String(e)); }
})();

/* ═══ B) مشتریان ═══ */
T('B: مرتب‌سازی جدیدترین‌اول (ptfCustSortNewest)', ih.indexOf('function ptfCustSortNewest') > -1 && ih.indexOf('var list = ptfCustSortNewest(items).filter') > -1);
T('B: گارد برخورد کد محلی در saveCust (کد پسونددار، نه آپدیت هم‌کد)', ih.indexOf("items.some(function (x) { return x && x.cd === recC.cd; })") > -1 && ih.indexOf("recC.cd + '-' + Date.now().toString(36)") > -1);
T('B: فرم مشتری فیلد نام انگلیسی (nCEn) دارد', ih.indexOf('id="nCEn"') > -1);
T('B: saveCust مقدار coEn را ذخیره می‌کند', ih.indexOf("coEn:(document.getElementById('nCEn')||{}).value || ''") > -1);
T('B: سرور expectCreate برخورد را 409 می‌دهد (entity_id_exists)', php.indexOf("entity_id_exists") > -1 && php.indexOf("'hint'=>'regenerate_client_code'") > -1);
T('B: روتر entity رکوردهای جدید را با expectCreate می‌فرستد', sdv.indexOf('newCds[cd] = 1; ups.push(nx); return;') > -1 && sdv.indexOf('expectCreate: !!newCds[r.cd]') > -1);
T('B: پیام فارسی برخورد کد در ptfEntityCommandMessage', sdv.indexOf('کد تولیدی تکراری بود') > -1);
(function () {
  try {
    var ctx = { window: {} };
    vm.runInNewContext(fnSrc(ih, 'function ptfCustSortNewest'), ctx);
    var sorted = vm.runInNewContext('ptfCustSortNewest([{cd:"CUST-8",createdAtISO:"2026-01-01"},{cd:"CUST-230",createdAtISO:"2026-08-31"},{cd:"CUST-99"}]);', ctx);
    T('B/رفتاری: جدیدترین (۲۳۰) اول و قدیمی‌ترین (۸) آخر', sorted[0].cd === 'CUST-230' && sorted[2].cd === 'CUST-8');
  } catch (e) { T('B/رفتاری sort اجرا شد', false, String(e)); }
})();

/* ═══ C) خزانه ═══ */
T('C: نرمال‌ساز تاریخ (treasuryDateKey/Label) اضافه شد', tr.indexOf('function treasuryDateKey') > -1 && tr.indexOf('function treasuryDateLabel') > -1);
T('C: جدول بر اساس کلید ISO مرتب می‌شود', tr.indexOf('treasuryDateKey(b).localeCompare(treasuryDateKey(a))') > -1);
T('C: ردیف فقط-ماه با نشانگر (ماه)', tr.indexOf("مهم نیست") === -1 && tr.indexOf("return fm[1] + '/' + p2(fm[2]) + ' (ماه)';") > -1);
T('C: نمایش با برچسب نرمال نه خام', tr.indexOf("esc(treasuryDateLabel(m))") > -1);
(function () {
  try {
    var ctx = { window: {} };
    vm.runInNewContext(fnSrc(tr, 'function p2') + fnSrc(tr, 'function treasuryDateKey') + fnSrc(tr, 'function treasuryDateLabel'), ctx);
    var k1 = vm.runInNewContext('treasuryDateKey({dateFa:"1405/06/08 14:30"});', ctx);
    var k2 = vm.runInNewContext('treasuryDateKey({dateISO:"2026-08-20"});', ctx);
    var lab = vm.runInNewContext('treasuryDateLabel({dateFa:"1405/05"});', ctx);
    T('C/رفتاری: کلید ISO از تاریخ فارسی + برچسب (ماه)', k1 === '1405-06-08' && k2 === '2026-08-20' && lab.indexOf('(ماه)') > -1);
  } catch (e) { T('C/رفتاری نرمال‌ساز اجرا شد', false, String(e)); }
})();

/* ═══ D) نام دوگانه ═══ */
T('D: هلپر ptfCustDualName + ptfCustEnByCd تعریف شد', ih.indexOf('function ptfCustDualName') > -1 && ih.indexOf('function ptfCustEnByCd') > -1);
T('D: لیست مشتریان نام انگلیسی را نشان می‌دهد', ih.indexOf("escP(ptfCustDualName(c))") > -1);
T('D: جستجوی مشتری شامل coEn', ih.indexOf("(c.coEn||'')+' '+(c.ind||'')") > -1);
T('D: فاکتورها نام دوگانه + coEn در جستجو', rb.indexOf('ptfCustEnByCd(o.buyerCd)') > -1 && rb.indexOf('id="invSrch"') > -1);
T('D: ردیف پیشنهاد نام انگلیسی زیر خریدار', of.indexOf('ptfCustNamePair(o.buyerCd, o.buyerCo)') > -1 && of.indexOf('ptfCustCellHtml(p.fa, p.en, o.buyerCd)') > -1); /* v34.20.0: سلول دوگانه فارسی+انگلیسی */
T('D: مطالبات (customer-finance) نام انگلیسی زیر نام', cf.indexOf("ptfCustEnByCd(r.cd):''") > -1);

/* ═══ E) جستجوی فاکتورها ═══ */
T('E: ورودی جستجو + فیلتر روی refd', rb.indexOf('oninput="renderInvoices()"') > -1 && rb.indexOf("((o.no||'')+' '+(o.buyerCo||'')+' '+(en||'')+' '+(o.inqNo||'')+' '+((inv&&inv.no)||''))") > -1);

/* ═══ F) typeahead مشتری پیشنهاد ═══ */
T('F: توابع offerBuyerAc* تعریف شدند', of.indexOf('window.offerBuyerAcSearch') > -1 && of.indexOf('window.offerBuyerAcPick') > -1 && of.indexOf('window.offerBuyerToggleFull') > -1);
T('F: input تایپی + دکمهٔ لیست کامل + select مخفی', of.indexOf('id="ofBuyerAc"') > -1 && of.indexOf('📋 لیست کامل') > -1 && of.indexOf('<select id="ofBuyer" onchange="offerPickBuyer(this.value)" style="display:none') > -1);
T('F: جستجو در نام فارسی/انگلیسی/کد', of.indexOf("((c.co||'')+' '+(c.coEn||'')+' '+(c.cd||''))") > -1);
T('F: انتخاب از فهرست همان offerPickBuyer رسمی را صدا می‌زند', of.indexOf('offerPickBuyer(cd);') > -1);
T('F: بستن فهرست با کلیک بیرون', of.indexOf("e.target.closest && e.target.closest('#ofBuyerAcBox')") > -1);

/* ═══ G) مکاتبات ═══ */
T('G: فالبک امضا با نام نمایشی (letResolveSignerProfile)', lt.indexOf('function letResolveSignerProfile') > -1 && lt.indexOf("(l.signatureSnapshot || letResolveSignerProfile(l) || signerProfile)") > -1);
T('G: تطبیق nm/nmEn پروفایل‌ها', lt.indexOf("String(p.nm || '').trim() === nm") > -1);
T('G: letCopyAsDraft تعریف شد', lt.indexOf('window.letCopyAsDraft') > -1);
T('G: کپی = پیش‌نویس بدون امضا/شماره', lt.indexOf("copy.st = 'draft';") > -1 && lt.indexOf('delete copy.signatureSnapshot;') > -1 && lt.indexOf("copy.no = '';") > -1);
T('G: دکمهٔ «کپی به پیش‌نویس» برای امضاشده‌ها', lt.indexOf('📋 کپی به پیش‌نویس') > -1 && lt.indexOf("letCopyAsDraft(\\'' + l.cd + '\\')") > -1);

/* ═══ H) صف قبلی ═══ */
T('H: سپر داده‌صفر برای کلیدهای shared-union غیرفعال شد', crmPhp.indexOf('!$allow_wipe && !$restore && !$isSharedUnion') > -1);
T('H: محافظ opexTpl در data_push', crmPhp.indexOf('RCA حذف بی‌صدای opexTpl') > -1 && crmPhp.indexOf("empty($incSettings['opexTpl'])") > -1);
T('H: دکمهٔ انتقال مستقیم داخل بنر مهاجرت', ih.indexOf("if(typeof ptfBConfirmFlush===\\'function\\')ptfBConfirmFlush()") > -1);
T('H: عنوان ردیف شامل «وضعیت دستگاه» شد (پین تستر8 حفظ)', bk.indexOf('🗄 بک‌آپ و بازگردانی + وضعیت دستگاه') > -1);

console.log('=== tester554: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);

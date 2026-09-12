#!/usr/bin/env node
'use strict';
/* tester653 — v34.38.20 (RFQ-APPROVE-VANISH): رفع «تایید زده ولی درخواست ناپدید می‌شود».
   گزارش کارفرما: یک استعلام هوشمند از سایت ثبت می‌شود؛ نوتیفیکیشنش هست، اما پس از
   «تایید و ورود» هیچ رکوردی در درخواست‌ها پیدا نمی‌شود.
   ریشه: rfqApprove وضعیت سایت را فوراً approved می‌کرد (ناپدید شدن از صندوقِ
   «در انتظار تایید») در حالی که درج رکورد ptf_crm_rfqs (entity_upsert) هنوز قطعی
   نشده بود؛ اگر آن فرمان رد می‌شد، رکورد فقط در silent-write محلی می‌ماند و اولین
   pull سرور آن را می‌شست.
   اصلاح ۱: approve واقعی (set_status) فقط پس از ACK درج رکورد اجرا می‌شود؛ در شکست،
   درخواست در صندوق می‌ماند + خطای دقیق.
   اصلاح ۲: صندوق، استعلام‌های «تاییدشدهٔ سایت ولی وارد چرخه‌نشده» را جدا با دکمهٔ
   «ورود به چرخه» نشان می‌دهد تا رکوردهای گیرکردهٔ قبلی قابل بازیابی باشند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function rd(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }

var brg = rd('crm/bridge.js');
var APPROVE = blk(brg, 'window.rfqApprove = function (code)', 'window.rfqReject = function');
var PENDING = blk(brg, 'window.renderRfqPending = function ()', 'window.rfqSiteDetail = function');

/* ── ۱) اصلاح ریشه‌ای rfqApprove ── */
T('APPROVE: بدنهٔ تایید به finishApprove منتقل شده (set_status بدون قید اولیه اجرا نمی‌شود)',
  APPROVE.indexOf('var finishApprove = function ()') > -1);
T('APPROVE: set_status داخل finishApprove است (نه قبل از درج رکورد)',
  blk(APPROVE, 'var finishApprove = function ()', '};').indexOf("action') === -1") < 0 ||
  (function () {
    var i = APPROVE.indexOf('var finishApprove = function ()');
    var setI = APPROVE.indexOf("api('set_status'", i);
    var endI = APPROVE.indexOf('};', setI);
    return setI > i && endI > setI && APPROVE.slice(setI, endI).indexOf('approved') > -1;
  })());
T('APPROVE: تابع set_status از بلوک پیش‌از-درج حذف شده (جابه‌جایی کامل)',
  (function () {
    var beforeFinish = APPROVE.slice(0, APPROVE.indexOf('var finishApprove = function ()'));
    return beforeFinish.indexOf("api('set_status'") === -1;
  })());
T('APPROVE: فقط بعد از ACK یا مسیر legacy، finishApprove صدا زده می‌شود (doneOnce ضد دوباره‌اجرا)',
  APPROVE.indexOf('var doneOnce = false;') > -1 && APPROVE.indexOf('if (doneOnce) return;') > -1 && APPROVE.indexOf('if (ok) { finishApprove(); return; }') > -1);
T('APPROVE: مسیر شکست، درخواست را در صندوق نگه می‌دارد و خطای دقیق می‌دهد (نه ناپدید شدن بی‌صدا)',
  APPROVE.indexOf('⛔ درخواست سایت هنوز وارد چرخه نشد') > -1 && blk(APPROVE, 'if (ok) { finishApprove(); return; }', 'window.ptfEntitySaveCollection').indexOf('renderRfq()') > -1);
T('APPROVE: reason=site-approve (بدون حذف تصادفی از روی پایهٔ کهنه) و نه w2',
  APPROVE.indexOf("reason: 'site-approve'") > -1 && blk(APPROVE, "reason: 'site-approve'", '});').indexOf("'w2'") === -1);
T('APPROVE: نتیجهٔ sync روتر خوانده می‌شود و mode=legacy هم approve را ادامه می‌دهد',
  APPROVE.indexOf('var saveRes = window.ptfEntitySaveCollection(') > -1 && APPROVE.indexOf("saveRes.mode === 'legacy'") > -1 && APPROVE.indexOf('onImported(true)') > -1);
T('APPROVE: مسیر بدون ptfEntitySaveCollection همچنان setData + ادامهٔ امن دارد',
  APPROVE.indexOf("setData('ptf_crm_rfqs', rfqs), onImported(true);") > -1);

/* ── ۲) صندوق: بازیابی تاییدشدهٔ واردچرخه‌نشده ── */
T('PENDING: درخواست‌های approve‌شده‌ای که در ptf_crm_rfqs نیستند جدا تشخیص داده می‌شوند (orphan)',
  PENDING.indexOf("r.status === 'approved' && imported.indexOf(r.code) < 0") > -1 && PENDING.indexOf('var orphan =') > -1);
T('PENDING (ORPHAN-SCOPE-FIX): استعلام‌های rejected (مختومه) در بخش orphan نمایش داده نمی‌شوند — شرط status!=="pending" دیگر استفاده نمی‌شود',
  PENDING.indexOf("r.status !== 'pending' && imported.indexOf(r.code) < 0") < 0);
T('PENDING: بخش بازیابی با عنوان تاییدشده-ولی-واردچرخه‌نشده و دکمهٔ «ورود به چرخه» دارد',
  PENDING.indexOf('استعلام‌های تاییدشدهٔ سایت که هنوز وارد چرخه نشده‌اند') > -1 && PENDING.indexOf('↩ ورود به چرخه') > -1 && PENDING.indexOf("onclick=\"rfqApprove(") > -1);
T('PENDING: بخش قدیمی «در انتظار تایید» و دکمهٔ «تایید و ورود» دست‌نخورده است',
  PENDING.indexOf('در انتظار تایید مدیران') > -1 && PENDING.indexOf('✅ تایید و ورود') > -1);

/* ── ۳) قراردادهای قفل‌شدهٔ قبلی (ضد رگرسیون tester568/205/315/67) ── */
T('LOCK: فراخوانی خودترمیمی ضمیمه در ابتدای approve حفظ شد',
  APPROVE.indexOf('ptfRfqHealSiteFiles(); } catch (eHl2)') > -1);
T('LOCK: ایمپورت پیوست و metadata سایت حفظ شد',
  APPROVE.indexOf('files: importedFiles') > -1 && APPROVE.indexOf('siteAttachment: r.attachment') > -1 && APPROVE.indexOf('subj: r.subject') > -1 && APPROVE.indexOf('inqText: r.message') > -1);
T('LOCK: ساخت/اتصال خودکار مشتری و src=site حفظ شد',
  APPROVE.indexOf('rfqSiteEnsureCustomer(r)') > -1 && APPROVE.indexOf("src: 'site'") > -1);
T('LOCK: پیامک ثبت درخواست به مشتری حفظ شد',
  APPROVE.indexOf('پیامک ثبت درخواست') > -1 && APPROVE.indexOf('smsSendSingle(_rfqMob') > -1);

console.log('=== tester653: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);

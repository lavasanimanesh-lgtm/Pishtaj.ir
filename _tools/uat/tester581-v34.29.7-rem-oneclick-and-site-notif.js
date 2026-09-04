#!/usr/bin/env node
'use strict';
/* tester581 — v34.36.4: دو گزارش کارفرما:
 * ① «یادآور: هرچه انجام شد را می‌زنم بلافاصله دوباره می‌آید، اصلاً پاک نمی‌شود؛
 *    باید با یک کلیک تمام شود» — ریشه: در مسیر فرمان اتمیک (v34.8.13+) هیچ نوشت
 *    محلی انجام نمی‌شد؛ تا ACK سرور ردیف باز می‌ماند (و با کش ۳۰ثانیه‌ای getData
 *    فاز B حتی رندر بعدی هم کهنه می‌داد). + مسیر دوم بازگشت: نوتیفایر
 *    checkDueReminders کل ردیف کهنه (st:'open') را upsert می‌کرد و روی سرور
 *    «انجام شد» تازه را زنده می‌کرد.
 * ② «درخواست‌هایی که از سایت ثبت می‌شوند اعلان نمی‌آید» — رویداد‌های supplier_site/
 *    rfq_site فقط syncServerInbox بی‌صداست؛ حالا کارت اعلان یک‌بارهٔ site_req
 *    (سپر dkey + resolve با تعیین وضعیت) ساخته می‌شود.
 * تأیید رفتاری کامل (بوت jsdom + فاز B فعال + سرور جعلی با merge سرور عین
 * api/sales-domain.php): ۱۳/۱۳ — این تستر همان قراردادها را ایستا نگه می‌دارد. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var leads = fs.readFileSync(path.join(ROOT, 'crm/leads.js'), 'utf8');
var bridge = fs.readFileSync(path.join(ROOT, 'crm/bridge.js'), 'utf8');
var rbac = fs.readFileSync(path.join(ROOT, 'crm/rbac.js'), 'utf8');

function fn(src, name) { /* برش بدنهٔ تابع تا } خط اول سطح */
  var i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  var j = src.indexOf('\n}', i);
  return src.slice(i, j < 0 ? src.length : j + 2);
}

/* ── ① یک‌کلیکی‌شدن یادآور ── */
var remDoneSrc = fn(leads, 'remDone');
T('ONE-CLICK: remDone نوشتن محلی بی‌درنگ دارد (ptfEntitySaveCollection با reason rem-done)', remDoneSrc.indexOf("ptfEntitySaveCollection('ptf_crm_reminders', rems, { reason: 'rem-done' })") > -1);
T('ONE-CLICK: remDone دیگر مسیر «فقط فرمان بدون نوشت محلی» ندارد', remDoneSrc.indexOf('ptfEntityUpsert') === -1);
T('ONE-CLICK: remDone هنوز اعلان مرتبط را resolve و لیست را رندر می‌کند', remDoneSrc.indexOf('ntfResolveByRef') > -1 && remDoneSrc.indexOf('renderReminders();') > -1);
T('ONE-CLICK: remDel حذف محلی بی‌درنگ (ptfSilentWrite روی فهرست بدون ردیف) + سپر dirty در خطای فرمان', (function () {
  var s = fn(leads, 'remDel');
  return s.indexOf('filter(function(r){ return r.cd !== cd; })') > -1 && s.indexOf('ptfSilentWrite') > -1 && s.indexOf('ptfSyncNotifyDirty') > -1 && s.indexOf("ptfEntityDelete('ptf_crm_reminders'") > -1;
})());
T('ONE-CLICK: remSnooze هم نوشتن محلی بی‌درنگ دارد (reason rem-snooze)', fn(leads, 'remSnooze').indexOf("{ reason: 'rem-snooze' }") > -1);
T('ONE-CLICK: addReminder هم مسیر یکپارچه (reason rem-new؛ بدون شاخهٔ فقط-فرمان)', fn(leads, 'addReminder').indexOf("{ reason: 'rem-new' }") > -1 && fn(leads, 'addReminder').indexOf('ptfEntityUpsert') === -1);

/* ── ①-ب: ضدبازگشتی‌کردن نوتیفایر ── */
T('ANTI-RESURRECT: checkDueReminders پچ مینیمال می‌فرستد (cd + notifiedUsers + msgSent — نه کل ردیف)', bridge.indexOf("window.ptfEntityUpsert('ptf_crm_reminders', { cd: pr.cd, notifiedUsers: pr.notifiedUsers || {}, msgSent: !!pr.msgSent }") > -1);
T('ANTI-RESURRECT: فراخوانی قدیمی upsert کل‌ردیفی حذف شده', bridge.indexOf('ptfEntityUpsert(\'ptf_crm_reminders\', changedRows[changedRows.length - 1]') === -1);

/* ── ② اعلان درخواست‌های سایت ── */
T('SITE-REQ: kind جدید site_req در NTF_ACTION_KINDS ثبت شده (کارتی با حق ورود به کارتابل)', /NTF_ACTION_KINDS = \[[^\]]*'site_req'/.test(rbac));
T('SITE-REQ: هر دو رویداد supplier_site و rfq_site در یک مسیر کارت‌ساز دارند', (function () {
  var i = bridge.indexOf("ev.kind === 'supplier_site' || ev.kind === 'rfq_site'");
  return i > -1 && bridge.indexOf("kind: 'site_req'", i) > -1;
})());
T('SITE-REQ: کارت یک‌باره است — سپر dkey پایدار site-req|… شامل کاربر', /dkey: 'site-req\|' \+ ev\.kind \+ '\|' \+ \(d\.code \|\| ev\.id \|\| ''\) \+ '\|' \+ me\.user/.test(bridge));
T('SITE-REQ: لینک پنل درست — تامین‌کننده → sup، استعلام → rfq', /ev\.kind === 'supplier_site' \? 'sup' : 'rfq'/.test(bridge));
T('SITE-REQ: گیرنده منطقی — ثبت‌نام تامین‌کننده فقط ارشد؛ استعلام ارشد+فروش', /var relevantEvt = ev\.kind === 'supplier_site' \? seniorEvt : \(seniorEvt \|\| salesEvt\);/.test(bridge));
T('SITE-REQ: syncServerInbox در همان مسیر حفظ شده (تازه‌سازی پنل در انتظار تایید)', (function () {
  var i = bridge.indexOf("ev.kind === 'supplier_site' || ev.kind === 'rfq_site'");
  var j = bridge.indexOf('function processEvent');
  var seg = bridge.slice(i, bridge.indexOf('if (ev.kind ===', i + 10));
  return j > -1 && seg.indexOf('syncServerInbox()') > -1;
})());
T('SITE-REQ: تعیین وضعیت کارت را می‌بندد — ntfResolveByRef(code) در تایید/رد تامین‌کننده، حذف ثبت‌نام و تایید استعلام', (function () {
  var ok = ['supApproveCommit', 'supRejectCommit', 'supSiteDelete', 'rfqApprove'];
  return ok.every(function (n) {
    var i = bridge.indexOf('function ' + n) > -1 ? bridge.indexOf('function ' + n) : bridge.indexOf('window.' + n + ' =');
    if (i < 0) return false;
    return bridge.slice(i, i + 4000).indexOf('ntfResolveByRef(code)') > -1;
  });
})());

/* ── سلامت ویرایش ── */
T('REGRESSION: remDone همچنان st/doneFa/doneBy را ست می‌کند', /r\.st = 'done'; r\.doneFa = faDate\(\); r\.doneBy = currentUserName\(\);/.test(leads));
T('REGRESSION: هیچ فراخوانی ptfEntityUpsert با changedRows در bridge نمانده', bridge.indexOf('changedRows[changedRows.length - 1], { cb: function () { _remUpsertInFlight = false; } }') === -1);
T('REGRESSION: گارد in-flight نوتیفایر حفظ شده', bridge.indexOf('_remUpsertInFlight') > -1);

console.log('=== tester581: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);

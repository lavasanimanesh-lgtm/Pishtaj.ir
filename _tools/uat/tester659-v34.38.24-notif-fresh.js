/* tester659 — v34.39.32 (NOTIF-FRESH — گزارش کارفرما: «اعلانات و کارتابل اصلاً به‌روز
 * نیست؛ کارها/اعلانات بسیار قدیمی می‌مانند؛ خواندم موقت پاک می‌کند و پس از هارد
 * رفرش همان اعلانات قدیمی برمی‌گردد. باید سیستمی طراحی شود که اعلانات مهم و به‌روز
 * دیده شوند و با گزینهٔ خواندم از بین بروند.»)
 *
 * چهار ریشه و چهار سپر:
 *  ① notify/addMsg: کارت خوانده‌شده با dkey صریح (هویت پایدار) دیگر با cd تازه و
 *     readBy خالی بازتولید نمی‌شود (چسبنده) + کارت بایگانیِ سنی suppress می‌شود.
 *  ② سیاست سنی ptfPruneStaleNotifs: مهمِ خوانده‌نشدهٔ >۳۰ روز → done+ageArchived؛
 *     خوانده‌شدهٔ >۶۰ روز و بایگانیِ >۹۰ روز → سخت حذف؛ merge اتحاد (کلاینت+سرور)
 *     پرچم بایگانی را حفظ می‌کند.
 *  ③ pull در sync.js برای notifs هرگز جایگزینی خام نمی‌کند — union (readBy/done) +
 *     tombstone پس از merge + dirty برای همگرایی خواندِ commitنشده.
 *  ④ ژورنال فرمان‌های در حال پرواز (sales-domain-v2.js): pagehide → localStorage →
 *     بازپخش پس از bootstrap با همان idempotencyKey (هارد رفرش mid-flight = بی‌اثر).
 * همچنین: STALE-BOOT-GUARD روی چهار سازندهٔ کارت (bridge.js) و union readBy/done در
 * entity_upsert سرور (api/sales-domain.php). روی کد قبل از اصلاح قرمز است. */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var sd = fs.readFileSync(path.join(BASE, 'sales-domain-v2.js'), 'utf-8');
var phpSd = fs.readFileSync(path.resolve(__dirname, '../../api/sales-domain.php'), 'utf-8');
var phpCrm = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');

var HAS_STICKY = rb.indexOf('stickyDkey') > -1;
var HAS_AGING = rb.indexOf('NTF_STALE_ARCHIVE_DAYS') > -1 && rb.indexOf('ntfAgeDays') > -1;
var HAS_JOURNAL = sd.indexOf('ptfSyncInflightJournalWrite') > -1 && sd.indexOf('ptfSalesDomainReplayInflight') > -1;

SECTION('قرارداد ایستا — وجود سپرها در منبع');
T('rbac: dedupe چسبندهٔ dkey صریح (stickyDkey) در notify', HAS_STICKY && /var stickyDkey = persistentTask \|\| !!opt\.dkey;/.test(rb));
T('rbac: suppress بازتولید کارت بایگانیِ سنی در notify', rb.indexOf('dn.ageArchived') > -1 && /opt\.dkey && String\(dn\.dkey/.test(rb));
T('rbac: ثابت‌های سیاست سنی (۳۰/۶۰/۹۰ روز)', /var NTF_STALE_ARCHIVE_DAYS = 30;/.test(rb) && /var NTF_READ_DELETE_DAYS = 60;/.test(rb) && /var NTF_ARCHIVED_DELETE_DAYS = 90;/.test(rb));
T('bridge: addMsg هم کارت بایگانیِ سنی با dkey پایدار را suppress می‌کند', br.indexOf('priorArchived') > -1);
T('bridge: STALE-BOOT-GUARD روی چهار سازندهٔ کارت', (br.match(/STALE-BOOT-GUARD/g) || []).length >= 4 && (br.match(/!window\._ptfSyncBootstrapped\) return false;/g) || []).length >= 4);
T('bridge: prune سیاست سنی در بوت (با گارد bootstrap)', /ptfPruneStaleNotifs/.test(br) && br.indexOf('ePruneBoot') > -1);
var syUnionIdx = sy.indexOf("k === 'ptf_crm_notifs' && curStr && typeof window.ptfSmartMerge");
var syRawIdx = sy.indexOf('pullWrite(k, newStr);');
T('sync: شاخهٔ union برای notifs پیش از جایگزینی خامِ pull', syUnionIdx > -1 && syRawIdx > -1 && syUnionIdx < syRawIdx);
T('sync: شاخهٔ union پس از merge tombstone می‌زند و dirty همگرا می‌سازد', /unionStr = window\.ptfApplyDeletionTombstones\(k, unionStr/.test(sy) && /if \(unionStr !== newStr\) \{ state\.dirty\[k\] = true;/.test(sy));
T('sync: بازپخش ژورنال پس از هر دو نقطهٔ bootstrapped', (sy.match(/ptfSalesDomainReplayInflight/g) || []).length >= 2);
T('sync: merge اتحاد پرچم ageArchived را حفظ می‌کند (هر دو حلقه)', (sy.match(/ageArchived = 1; if \(item\.ageArchivedAt\)/g) || []).length >= 1 && (sy.match(/item\.ageArchived && !ex\.ageArchived|item\.ageArchived && !keep\.ageArchived/g) || []).length === 2);
T('sales-domain-v2: ژورنال in-flight (pagehide/beforeunload + ذخیره از لایهٔ sync)', HAS_JOURNAL && /addEventListener\('pagehide', inflightPersist\)/.test(sd) && /addEventListener\('beforeunload', inflightPersist\)/.test(sd) && sd.indexOf('journalWrite(JSON.stringify(rows.slice(0, 40)))') > -1);
T('sync: مالکِ ذخیرهٔ ژورنال لایهٔ داده است (کلید پایدار ptf_sd_inflight — اصل A10/E2)', sy.indexOf("'ptf_sd_inflight'") > -1 && sy.indexOf('ptfSyncInflightJournalWrite') > -1 && sy.indexOf('ptfSyncInflightJournalRead') > -1 && sy.indexOf('ptfSyncInflightJournalClear') > -1);
T('sales-domain-v2 نازک ماند: هیچ localStorage تازه‌ای در diff ژورنال نیست', sd.indexOf('INFLIGHT_JOURNAL_KEY') < 0);
T('sales-domain-v2: api() فرمان در پرواز را ثبت و در پاسخ قطعی تسویه می‌کند (uncertain در ژورنال می‌ماند)', /inflightRegister\(action, payload\); \/\* v34\.38\.24/.test(sd) && sd.indexOf("out.then(function(){inflightSettle(payload);},function(e){if(!(e&&e.commitOutcome==='uncertain'))inflightSettle(payload);});") > -1);
T('سرور: entity_upsert برای notifs اتحاد readBy و OR شدن done', phpSd.indexOf("\$collection === 'ptf_crm_notifs'") > -1 && phpSd.indexOf('$rbU') > -1 && /!empty\(\$prev\['done'\]\)/.test(phpSd));
T('سرور: merge کانونیک data_push هم پرچم ageArchived را اتحاد می‌کند', (phpCrm.match(/ageArchived/g) || []).length >= 4);

/* ═══════════ رفتاری: notify — دکلایپه چسبنده ═══════════ */
SECTION('رفتاری: notify — خواندم با شلیک دوبارهٔ سازنده برنمی‌گردد');
global.curSession = function () { return { user: 'u1', name: 'کاربر یک' }; };
global.curRole = function () { return 'admin'; };
global.roleDef = function () { return { lb: 'ادمین' }; };
global.ROLES = { admin: { lb: 'ادمین' } };
global.updateCartBadge = function () {};
global.updateInboxBadge = function () {};
global.renderCartable = function () {};
var audits = [];
global.audit = function (m, a, r) { audits.push({ m: m, a: a, r: r }); };
global.ptfToast = function () {};

function ex(re, src, name) {
  var m = (src || rb).match(re);
  if (!m) { T('استخراج ' + name + ' از منبع', false); return false; }
  /* الگوی loadFns هارنس: تبدیل به global.NAME = function تا هم stub هارنس
     (global.notify) جایگزین شود و هم ارجاعات free تابع در scope جهانی حل شوند. */
  eval.call(global, m[0].replace('function ' + name, 'global.' + name + ' = function'));
  return true;
}
/* ترتیب: ثابت‌ها → ntfNeedsAction → ntfAgeDays → ntfCommitRemoval → prune → notify → myNotifs */
var ntfKindsM = rb.match(/var NTF_ACTION_KINDS = (\[[^\]]*\])/);
if (ntfKindsM) eval.call(global, 'global.NTF_ACTION_KINDS = ' + ntfKindsM[1] + ';');
else T('استخراج NTF_ACTION_KINDS از منبع', false);
var okFns = ex(/function ntfNeedsAction\(n\) \{[\s\S]*?\n\}/, rb, 'ntfNeedsAction');
if (HAS_AGING) {
  eval.call(global, 'global.NTF_STALE_ARCHIVE_DAYS = 30; global.NTF_READ_DELETE_DAYS = 60; global.NTF_ARCHIVED_DELETE_DAYS = 90;');
  okFns = ex(/function ntfAgeDays\(isoLike\) \{[\s\S]*?\n\}/, rb, 'ntfAgeDays') && okFns;
}
okFns = ex(/function ntfCommitRemoval\(notifs, kept\) \{[\s\S]*?\n\}/, rb, 'ntfCommitRemoval') && okFns;
if (HAS_AGING) {
  var pruneM = rb.match(/window\.ptfPruneStaleNotifs = function \(\) \{[\s\S]*?\n\};/);
  if (pruneM) eval.call(global, pruneM[0]);
  else { T('استخراج ptfPruneStaleNotifs از منبع', false); okFns = false; }
} else global.ptfPruneStaleNotifs = function () { return 0; };
var okNotify = ex(/function notify\(opt\) \{[\s\S]*?\n\}/, rb, 'notify');
okFns = ex(/function myNotifs\(\) \{[\s\S]*?\n\}/, rb, 'myNotifs') && okFns;
T('پیش‌شرط: توابع هستهٔ اعلان از منبع واقعی استخراج شدند', okFns && okNotify);

function seedNotifs(rows) { setData('ptf_crm_notifs', rows); }
function notifsNow() { return getData('ptf_crm_notifs'); }
function isoDaysAgo(d) { return new Date(Date.now() - d * 86400000).toISOString(); }

/* ① dkey صریح + خوانده‌شده + شلیک دوباره → همان کارت (چسبنده) */
seedNotifs([]);
var d1 = notify({ toUsers: ['u1'], title: '🔴 چک ۱۲۳ — ۲ روز تا سررسید', kind: 'cheque', channels: ['cart'], actionable: true, dkey: 'chq-due-CH1', refCd: 'CH1' });
var n1 = notifsNow(); n1.forEach(function (n) { n.readBy = ['u1']; }); seedNotifs(n1);
var d2 = notify({ toUsers: ['u1'], title: '🔴 چک ۱۲۳ — امروز سررسید است!', kind: 'cheque', channels: ['cart'], actionable: true, dkey: 'chq-due-CH1', refCd: 'CH1' });
var after = notifsNow();
T('دکلایپه چسبنده: کارت خوانده‌شده با dkey صریح بازتولید نمی‌شود (cd همان است)', HAS_STICKY && d1 === d2 && after.length === 1, 'cd1=' + d1 + ' cd2=' + d2 + ' n=' + after.length);
T('readBy کاربر پس از شلیق دوباره حفظ شد (خواندم برنمی‌گردد)', after.length === 1 && (after[0].readBy || []).indexOf('u1') > -1);
T('محتوای کارتِ چسبنده تازه شد (title/repeat) و _ptfNotifySuppressed اطلاع‌رسانی شد', after.length === 1 && after[0].title.indexOf('امروز') > -1 && after[0].repeat === 2 && window._ptfNotifySuppressed === true);

/* ② dkey خودکار (عنوان‌محور) + خوانده‌شده + وقوع تازه → کارت تازه (قرارداد v31.7.10 تستر۱۸۵) */
seedNotifs([]);
notify({ toRoles: ['admin'], title: 'هشدار X', body: 'متن', kind: 'inv_ref', actionable: true });
var a2 = notifsNow(); a2.forEach(function (n) { n.readBy = ['u1']; }); seedNotifs(a2);
notify({ toRoles: ['admin'], title: 'هشدار X', body: 'متن', kind: 'inv_ref', actionable: true });
T('dkey خودکار: وقوعِ تازه پس از خواندن، کارت تازه می‌سازد (قرارداد تستر۱۸۵ دست‌نخورد)', notifsNow().length === 2);

/* ③ کارت بایگانیِ سنی (done+ageArchived) + dkey صریح → suppress */
seedNotifs([{ cd: 'NTF-ARCH', title: 'اقدام مدیریتی قدیمی', kind: 'management_action', actionable: true, channels: ['cart'], readBy: [], done: true, ageArchived: 1, ageArchivedAt: isoDaysAgo(5), iso: isoDaysAgo(40), t: '', dkey: 'management-action|M1', repeat: 1 }]);
var dArch = notify({ toUsers: ['u2'], title: '📌 اقدام مدیریتی: قدیمی', kind: 'management_action', channels: ['cart'], actionable: true, dkey: 'management-action|M1' });
T('کارت بایگانیِ سنی با dkey صریح زنده نمی‌شود (suppress + همان cd)', HAS_STICKY && dArch === 'NTF-ARCH' && notifsNow().length === 1 && window._ptfNotifySuppressed === true);

/* ④ done معمولی (حل‌شده) + dkey صریح + شلیک واقعیِ دوباره → کارت تازه مجاز است
     (prune واقعی کارت done را از داده حذف می‌کند؛ dkey آزاد می‌شود و شلیق تازه کارت می‌سازد) */
seedNotifs([{ cd: 'NTF-DONE', title: 'مهلت RFQ', kind: 'delivery_next', actionable: true, channels: ['cart'], readBy: ['u1'], done: true, iso: isoDaysAgo(3), t: '', dkey: 'rfq-due-R1', repeat: 1 }]);
var dNew = notify({ toRoles: ['commercial'], title: 'مهلت RFQ (دوباره)', kind: 'delivery_next', channels: ['cart'], actionable: true, dkey: 'rfq-due-R1' });
var afterNew = notifsNow();
T('done حل‌شده (غیر بایگانی) دکلایپه را نمی‌بندد — وقوع واقعاً تازه کارت می‌گیرد',
  dNew !== 'NTF-DONE' && afterNew.length === (HAS_AGING ? 1 : 2) && afterNew.filter(function (n) { return n.cd === dNew; })[0].done !== true);

/* ⑤ referral پایدار (persistentTask) — رفتار قبلی حفظ شد */
seedNotifs([]);
var r1 = notify({ toUsers: ['u1'], title: 'ارجاع A', kind: 'referral', actionable: true, dkey: 'referral|CD1|u1|create_offer', taskType: 'create_offer' });
var rn = notifsNow(); rn.forEach(function (n) { n.readBy = ['u1']; }); seedNotifs(rn);
var r2 = notify({ toUsers: ['u1'], title: 'ارجاع A', kind: 'referral', actionable: true, dkey: 'referral|CD1|u1|create_offer', taskType: 'create_offer' });
T('referral پایدار: خوانده‌شده هم بازاستفاده می‌شود (بدون تغییر قرارداد)', r1 === r2 && notifsNow().length === 1);

/* ═══════════ رفتاری: سیاست سنی prune ═══════════ */
SECTION('رفتاری: سیاست سنی — بایگانی ۳۰ روز، حذف خواندهٔ ۶۰ روز، حذف بایگانی ۹۰ روز');
if (HAS_AGING) {
  seedNotifs([
    { cd: 'A', title: 'یادآور کهنه', kind: 'reminder', remCd: 'R1', actionable: true, channels: ['cart'], readBy: [], done: false, iso: isoDaysAgo(45), t: '', dkey: 'rem-due-R1:u1', repeat: 1 },
    { cd: 'B', title: 'یادآور تازه', kind: 'reminder', remCd: 'R2', actionable: true, channels: ['cart'], readBy: [], done: false, iso: isoDaysAgo(5), t: '', dkey: 'rem-due-R2:u1', repeat: 1 },
    { cd: 'C', title: 'ارجاع خوانده‌شدهٔ کهنه', kind: 'inv_ref', actionable: true, channels: ['cart'], readBy: ['u1'], done: false, iso: isoDaysAgo(70), t: '', repeat: 1 },
    { cd: 'D', title: 'ارجاع خوانده‌شدهٔ تازه', kind: 'inv_ref', actionable: true, channels: ['cart'], readBy: ['u1'], done: false, iso: isoDaysAgo(10), t: '', repeat: 1 },
    { cd: 'E', title: 'بایگانیِ خیلی قدیمی', kind: 'cheque', actionable: true, channels: ['cart'], readBy: [], done: true, ageArchived: 1, ageArchivedAt: isoDaysAgo(100), iso: isoDaysAgo(140), t: '', repeat: 1 },
    { cd: 'F', title: 'بایگانیِ اخیر', kind: 'cheque', actionable: true, channels: ['cart'], readBy: [], done: true, ageArchived: 1, ageArchivedAt: isoDaysAgo(10), iso: isoDaysAgo(50), t: '', repeat: 1 },
    { cd: 'G', title: 'خبر عادی', kind: 'info', actionable: false, channels: ['cart'], readBy: [], done: false, iso: isoDaysAgo(1), t: '', repeat: 1 },
    { cd: 'H', title: 'بدون تاریخ قابل تشخیص', kind: 'sign_req', actionable: true, channels: ['cart'], readBy: [], done: false, iso: '', t: '', repeat: 1 },
    { cd: 'I', title: 'حل‌شدهٔ معمولی', kind: 'reminder', remCd: 'R9', actionable: true, channels: ['cart'], readBy: ['u1'], done: true, iso: isoDaysAgo(2), t: '', repeat: 1 }
  ]);
  audits = [];
  window.ptfPruneStaleNotifs();
  var kept = {}; notifsNow().forEach(function (n) { kept[n.cd] = n; });
  T('① مهمِ خوانده‌نشدهٔ >۳۰ روز → done+ageArchived (داده می‌ماند، از نما خارج)', !!kept.A && kept.A.done === true && kept.A.ageArchived === 1 && !!kept.A.ageArchivedAt);
  T('① مهمِ خوانده‌نشدهٔ تازه دست‌نخورده', !!kept.B && !kept.B.done);
  T('② مهمِ خوانده‌شدهٔ >۶۰ روز → سخت حذف', !kept.C);
  T('② مهمِ خوانده‌شدهٔ تازه نگه داشته می‌شود (و بایگانی نمی‌شود)', !!kept.D && !kept.D.done && !kept.D.ageArchived);
  T('③ بایگانیِ >۹۰ روز → سخت حذف', !kept.E);
  T('③ بایگانیِ اخیر نگه داشته می‌شود', !!kept.F && kept.F.ageArchived === 1);
  T('خبر غیرمهم حذف شد (رفتار قبلی)', !kept.G);
  T('کارت بدون iso/t قابل تشخیص → محافظه‌کارانه نگه داشته می‌شود', !!kept.H && !kept.H.done);
  T('done معمولی حذف شد (رفتار قبلی)', !kept.I);
  T('بایگانی سنی در audit ثبت شد', audits.some(function (a) { return String(a.a || '').indexOf('بایگانی سنی') > -1; }));
  /* حذف‌های سخت باید تک‌رکوردی/قابل‌commit باشند — مسیر ntfCommitRemoval (setData در هارنس) */
  T('خروجی prune = شمار موارد حذف‌شدهٔ سخت', notifsNow().length === 5);
} else {
  T('سیاست سنی در ptfPruneStaleNotifs پیاده‌سازی شده است', false);
}

/* ═══════════ رفتاری: merge اتحاد — readBy/done/ageArchived ═══════════ */
SECTION('رفتاری: ptfSmartMerge notifs — خوانده/بایگانی محلی در pull گم نمی‌شود');
eval('var ptfMergeNoCollapse = function(){};\n' + sy.match(/window\.ptfSmartMerge = function[\s\S]*?\n  \};/)[0]);
var locN = JSON.stringify([
  { cd: 'NTF-1', title: 'a', iso: '2026-01-01T00:00:00.000Z', readBy: ['u1'], done: false, channels: ['cart'] },
  { cd: 'NTF-2', title: 'b', iso: '2026-01-02T00:00:00.000Z', readBy: [], done: true, ageArchived: 1, ageArchivedAt: '2026-02-01T00:00:00.000Z', channels: ['cart'] }
]);
var remN = JSON.stringify([
  { cd: 'NTF-1', title: 'a', iso: '2026-01-01T00:00:00.000Z', readBy: [], done: false, channels: ['cart'] },
  { cd: 'NTF-2', title: 'b', iso: '2026-01-02T00:00:00.000Z', readBy: [], done: false, channels: ['cart'] },
  { cd: 'NTF-3', title: 'c', iso: '2026-01-03T00:00:00.000Z', readBy: [], done: false, channels: ['cart'] }
]);
var mg = JSON.parse(window.ptfSmartMerge('ptf_crm_notifs', locN, remN));
var m1 = mg.filter(function (x) { return x.cd === 'NTF-1'; })[0];
var m2 = mg.filter(function (x) { return x.cd === 'NTF-2'; })[0];
T('readBy محلی روی نسخهٔ نخواندهٔ سرور اتحاد می‌شود (ریشهٔ احیا)', m1 && m1.readBy.indexOf('u1') > -1);
T('done+ageArchived محلی روی نسخهٔ خام سرور حفظ می‌شود', m2 && m2.done === true && m2.ageArchived === 1 && m2.ageArchivedAt === '2026-02-01T00:00:00.000Z');
T('رکورد تازهٔ سرور هم می‌آید (union دوطرفه)', mg.length === 3 && mg.some(function (x) { return x.cd === 'NTF-3'; }));

/* ═══════════ رفتاری: ژورنال فرمان در پرواز ═══════════ */
SECTION('رفتاری: ژورنال in-flight — هارد رفرش mid-flight فرمان «خواندم» را گم نمی‌کند');
if (HAS_JOURNAL) {
  var inflightCmds = {};
  var INFLIGHT_TTL_MS = 60000;
  function actionIsReadOnly(a) { return a === 'command_status'; }
  var apiLog = [];
  function api(a, p) { apiLog.push({ a: a, p: p }); return p.__fail ? Promise.reject(new Error('network')) : Promise.resolve({ state: 'acked' }); }
  /* مالکِ واقعیِ ذخیره sync.js است (A10)؛ در هارنس، همان سه تابع پنجره‌ای روی
     localStorage هارنس stub می‌شوند و helperهای نازکِ sd از منبع eval می‌شوند. */
  global.ptfSyncInflightJournalWrite = function (v) { localStorage.setItem('ptf_sd_inflight', String(v)); };
  global.ptfSyncInflightJournalRead = function () { return localStorage.getItem('ptf_sd_inflight'); };
  global.ptfSyncInflightJournalClear = function () { localStorage.removeItem('ptf_sd_inflight'); };
  eval(sd.match(/function journalWrite\(str\) \{[\s\S]*?\n  \}/)[0]);
  eval(sd.match(/function journalRead\(\) \{[\s\S]*?\n  \}/)[0]);
  eval(sd.match(/function journalClear\(\) \{[\s\S]*?\n  \}/)[0]);
  eval(sd.match(/function inflightRegister\(action, payload\) \{[\s\S]*?\n  \}/)[0]);
  eval(sd.match(/function inflightSettle\(payload\) \{[\s\S]*?\n  \}/)[0]);
  eval(sd.match(/function inflightPersist\(\) \{[\s\S]*?\n  \}/)[0]);
  eval(sd.match(/window\.ptfSalesDomainReplayInflight = function \(\) \{[\s\S]*?\n  \};/)[0]);

  /* ثبت/تسویه/پایداری */
  inflightRegister('entity_upsert', { idempotencyKey: 'K0', collection: 'ptf_crm_notifs' });
  inflightRegister('command_status', { idempotencyKey: 'KRO' }); /* read-only → ژورنال نمی‌شود */
  inflightPersist();
  var j1 = JSON.parse(localStorage.getItem('ptf_sd_inflight') || '[]');
  T('فرمان در پرواز روی pagehide پایدار می‌شود؛ read-only نه', j1.length === 1 && j1[0].payload.idempotencyKey === 'K0');
  inflightSettle({ idempotencyKey: 'K0' });
  inflightPersist();
  T('پس از ACK/خطای قطعی، ژورنال پاک می‌شود', !localStorage.getItem('ptf_sd_inflight'));

  /* بازپخش بوت: تازه + کهنه + ناقص */
  localStorage.setItem('ptf_sd_inflight', JSON.stringify([
    { action: 'entity_upsert', payload: { idempotencyKey: 'K1', collection: 'ptf_crm_notifs', record: { cd: 'NTF-9', readBy: ['u1'] } }, at: Date.now() - 5000 },
    { action: 'entity_upsert', payload: { idempotencyKey: 'K-OLD', collection: 'ptf_crm_notifs' }, at: Date.now() - (INFLIGHT_TTL_MS + 10000) },
    { action: null }
  ]));
  var replayed = window.ptfSalesDomainReplayInflight();
  T('بازپخش: فقط فرمان تازه و معتبر (۱ از ۳)', replayed === 1 && apiLog.length === 1 && apiLog[0].p.idempotencyKey === 'K1');
  T('بازپخش عیناً همان idempotencyKey نشست قبل است (اثر دوباره ندارد)', apiLog[0].p.idempotencyKey === 'K1' && !localStorage.getItem('ptf_sd_inflight'));

  /* مسیر شکست: فرمان هنوز قطعی نشده → برای بوت بعدی نگه داشته می‌شود */
  apiLog = [];
  localStorage.setItem('ptf_sd_inflight', JSON.stringify([
    { action: 'entity_upsert', payload: { idempotencyKey: 'K2', __fail: true }, at: Date.now() }
  ]));
  window.ptfSalesDomainReplayInflight();
  setTimeout(function () {
    var j2 = [];
    try { j2 = JSON.parse(localStorage.getItem('ptf_sd_inflight') || '[]'); } catch (eJ2) {}
    T('فرمانِ بی‌پاسخِ بازپخش‌شده برای نشست بعدی نگه داشته می‌شود', j2.length === 1 && j2[0].payload.idempotencyKey === 'K2');
    DONE('tester659-v34.38.24-notif-fresh');
  }, 10);
} else {
  T('ژورنال فرمان‌های در حال پرواز پیاده‌سازی شده است', false);
  DONE('tester659-v34.38.24-notif-fresh');
}

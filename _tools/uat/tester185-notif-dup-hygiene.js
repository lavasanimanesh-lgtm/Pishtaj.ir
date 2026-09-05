/* tester185 — v31.7.10 (BUG-NTF-001/002/003 + BUG-DUP-NAG-001: بهداشت اعلان‌ها و هشدار کد تکراری)
 * رفتاری: notify ضدتکرار، بقای readBy در merge، خواندم‌همه، تفکیک مهم/عادی، خاموشی هشدار duplicate پس از ack */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var cg = fs.readFileSync(path.join(BASE, 'codegen.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('notify دارای منطق ضدتکرار dkey/repeat است', rb.indexOf('BUG-NTF-001') > -1 && rb.indexOf('dn.repeat') > -1);
T('merge مخصوص ptf_crm_notifs با اجتماع readBy در sync.js', sy.indexOf('BUG-NTF-002') > -1 && /key === 'ptf_crm_notifs'/.test(sy));
T('کارتابل تفکیک مهم/عادی دارد', rb.indexOf('ntfIsImportant') > -1 && rb.indexOf('NTF_IMPORTANT_KINDS') > -1);
T('دکمه «خواندم همه» موجود است', rb.indexOf('ntfReadAll') > -1 && rb.indexOf('خواندم همه') > -1);
T('هشدار duplicate فقط با تغییر fingerprint (BUG-DUP-NAG-001)', cg.indexOf('ptfDupPlanFingerprint') > -1 && cg.indexOf('ptf_code_duplicate_ack') > -1);
T('دکمه ack در دیالوگ duplicate', cg.indexOf('ptfDuplicateRepairAck') > -1 && cg.indexOf('دیگر هشدار نده') > -1);
T('plan خالی ack را پاک می‌کند (خودترمیمی)', /devCacheRemove\('ptf_code_duplicate_ack'\)/.test(cg)); /* v34.37.4 (R2): ack در Dev-KV است */

SECTION('رفتاری: notify ضدتکرار');
global.window = global;
global.curSession = function () { return { user: 'u1', name: 'کاربر یک' }; };
global.curRole = function () { return 'admin'; };
global.roleDef = function () { return { lb: 'ادمین' }; };
global.ROLES = { admin: { lb: 'ادمین' } };
global.updateCartBadge = function () {};
global.document = { getElementById: function () { return null; }, querySelectorAll: function () { return []; } };
global.ptfToast = function (m) { global._toasts = (global._toasts || []).concat([m]); };
// استخراج notify و ntfReadAll و myNotifs از source
eval(rb.match(/var NTF_ACTION_KINDS[\s\S]*?function ntfIsImportant\(n\) \{[\s\S]*?\n\}/)[0]);
eval(rb.match(/function notify\(opt\) \{[\s\S]*?\n\}/)[0]);
eval(rb.match(/function myNotifs\(\) \{[\s\S]*?\n\}/)[0]);
eval(rb.match(/function ntfReadAll\(\) \{[\s\S]*?\n\}/)[0]);

setData('ptf_crm_notifs', []);
var c1 = notify({ toRoles: ['admin'], title: 'هشدار X', body: 'متن', kind: 'referral', actionable: true });
var c2 = notify({ toRoles: ['admin'], title: 'هشدار X', body: 'متن', kind: 'referral', actionable: true });
var c3 = notify({ toRoles: ['admin'], title: 'هشدار X', body: 'متن', kind: 'referral', actionable: true });
var nfs = getData('ptf_crm_notifs');
T('سه notify یکسان → فقط ۱ رکورد', nfs.length === 1);
T('شمارنده تکرار = ۳ و کد ثابت', nfs[0].repeat === 3 && c1 === c2 && c2 === c3);
notify({ toRoles: ['admin'], title: 'هشدار Y', body: 'متفاوت', kind: 'inv_ref', actionable: true });
T('اعلان متفاوت رکورد جدید می‌سازد', getData('ptf_crm_notifs').length === 2);
// پس از خوانده‌شدن، وقوع جدید باید رکورد جدید بسازد (نه اینکه گم شود)
nfs = getData('ptf_crm_notifs');
nfs.forEach(function (n) { if (n.title === 'هشدار X') n.readBy = ['u1']; });
setData('ptf_crm_notifs', nfs);
notify({ toRoles: ['admin'], title: 'هشدار X', body: 'متن', kind: 'referral', actionable: true });
T('پس از خواندن، وقوع جدید اعلان جدید می‌سازد', getData('ptf_crm_notifs').length === 3);

SECTION('رفتاری: خواندم همه');
var cnt = getData('ptf_crm_notifs').filter(function (n) { return (n.readBy || []).indexOf('u1') < 0; }).length;
T('پیش‌شرط: اعلان خوانده‌نشده وجود دارد', cnt > 0);
global.renderCartable = function () {};
ntfReadAll();
T('پس از خواندم‌همه هیچ خوانده‌نشده‌ای نیست', getData('ptf_crm_notifs').every(function (n) { return (n.readBy || []).indexOf('u1') > -1; }));

SECTION('رفتاری: merge اعلان‌ها — readBy گم نمی‌شود');
eval("var ptfMergeNoCollapse = function(){};\n" + sy.match(/window\.ptfSmartMerge = function[\s\S]*?\n  \};/)[0]);
var locN = JSON.stringify([{ cd: 'NTF-1', title: 'a', iso: '2026-01-01', readBy: ['u1'], repeat: 2, channels: ['cart'] }]);
var remN = JSON.stringify([{ cd: 'NTF-1', title: 'a', iso: '2026-01-01', readBy: ['u2'], repeat: 1, channels: ['cart'] }, { cd: 'NTF-2', title: 'b', iso: '2026-01-02', readBy: [], channels: ['cart'] }]);
var mg = JSON.parse(window.ptfSmartMerge('ptf_crm_notifs', locN, remN));
var m1 = mg.filter(function (x) { return x.cd === 'NTF-1'; })[0];
T('merge: readBy اجتماع دو طرف است (خوانده‌شده برنمی‌گردد)', m1 && m1.readBy.indexOf('u1') > -1 && m1.readBy.indexOf('u2') > -1);
T('merge: repeat حداکثری و رکورد سرور حفظ شد', m1.repeat === 2 && mg.length === 2);

SECTION('رفتاری: تفکیک مهم/عادی');
T('ارجاع/actionable مهم است، info عادی', ntfIsImportant({ kind: 'referral' }) && ntfIsImportant({ kind: 'info', actionable: true }) && !ntfIsImportant({ kind: 'info' }) && !ntfIsImportant({ kind: 'system' }));

SECTION('رفتاری: خاموشی هشدار duplicate پس از ack');
eval(cg.match(/function ptfDupPlanFingerprint[\s\S]*?\n\}/)[0]);
var planA = [{ key: 'ptf_crm_rfqs', code: 'RFQ-1001', reason: 'referenced-ambiguous' }];
var fpA = ptfDupPlanFingerprint(planA);
T('fingerprint پایدار و مرتب است', fpA === ptfDupPlanFingerprint(planA.slice()) && fpA.indexOf('RFQ-1001') > -1);
var planB = planA.concat([{ key: 'ptf_crm_offers', code: 'CO-2001', reason: 'referenced-ambiguous' }]);
T('تغییر plan → تغییر fingerprint (هشدار مجدد مجاز)', ptfDupPlanFingerprint(planB) !== fpA);
// شبیه‌سازی جریان: ack ثبت شده و plan همان → نباید toast جدید بیاید
localStorage.setItem('ptf_code_duplicate_plan', JSON.stringify(planA));
localStorage.setItem('ptf_code_duplicate_ack', fpA);
T('گارد fp!==ack در auto-repair وجود دارد', /fp!==ack/.test(cg.replace(/\s/g, '')) || cg.indexOf('fp!==ack') > -1);

DONE('tester185-notif-dup-hygiene');

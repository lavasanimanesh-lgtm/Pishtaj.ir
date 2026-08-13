/* tester203 — روز من: فقط اقدام شخصی، بدون انقضای پیشنهاد */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var md = fs.readFileSync(path.join(ROOT, 'crm/myday.js'), 'utf-8');

SECTION('قرارداد جدید روز من');
T('پیشنهادهای رو به انقضا/منقضی دیگر منبع روز من نیستند', md.indexOf('CO های رو به انقضا') === -1 && md.indexOf('پیشنهاد منقضی:') === -1);
T('فقط اعلان actionable مستقیم کاربر به روز من افزوده می‌شود', md.indexOf('ntfNeedsAction(n)') > -1 && md.indexOf('var forMe = (n.toUsers || []).indexOf(me.user) > -1') > -1 && md.indexOf('if (!forMe) return;') > -1); /* 2026-08-13: گیت اقدام ntfNeedsAction + منطق forMe */
T('سقف روز من پنج اولویت واقعی است', md.indexOf('out.slice(0, 5)') > -1);
T('dedup با امضای panel+tx پابرجاست', /var k = it\.panel \+ '\|' \+ it\.tx;/.test(md));

SECTION('رفتاری: فقط اقدام‌های شخصی نمایش داده می‌شوند');
global.window = global;
global.curSession = function () { return { user: 'u1', name: 'کاربر' }; };
setData('ptf_crm_reminders', []);
setData('ptf_crm_rfqs', [{ cd:'RFQ-OLD', dueISO:'2020-01-01' }]);
setData('ptf_crm_deals', [{ cd:'D-OLD', dueISO:'2020-01-01' }]);
setData('ptf_crm_cheques', [{ cd:'C-OLD', dueISO:'2020-01-01' }]);
setData('ptf_crm_offers', [{ no:'CO-EXP', kind:'CO', validUntil:'2020-01-01', buyerCo:'X' }]);
setData('ptf_crm_leads', [{ co:'Lead', stage:'new', createdISO:'2020-01-01' }]);
setData('ptf_crm_notifs', [
  { cd:'N1', title:'اقدام شما لازم است: ثبت CO', actionable:true, toUsers:['u1'], readBy:[], link:{panel:'rfq'}, t:'1405/01/01' },
  { cd:'N2', title:'اقدام شخص دیگر', actionable:true, toUsers:['u2'], readBy:[], link:{panel:'rfq'}, t:'1405/01/01' },
  { cd:'N3', title:'خبر عمومی', actionable:false, toUsers:['u1'], readBy:[], link:{panel:'rfq'}, t:'1405/01/01' }
]);
global.todayISO2 = function () { return '2026-01-01'; };
eval(md.match(/window\.ptfMyDayItems = function \(\) \{[\s\S]*?\n  \};/)[0].replace(/todayISO2\(\)/g, 'global.todayISO2()'));
var items = window.ptfMyDayItems();
T('فقط اقدام مستقیم u1 دیده می‌شود', items.length === 1 && items[0].tx.indexOf('ثبت CO') > -1);
T('پیشنهاد منقضی و موعدهای عمومی وارد روز من نمی‌شوند', !items.some(function(x){ return /CO-EXP|RFQ-OLD|D-OLD|C-OLD|Lead/.test(x.tx); }));

setData('ptf_crm_notifs', Array.from({length:8}, function(_,i){ return { cd:'N'+i, title:'کار '+i, actionable:true, toUsers:['u1'], readBy:[], link:{panel:'rfq'}, t:'1405/01/01' }; }));
items = window.ptfMyDayItems();
T('از هشت اقدام شخصی فقط پنج اولویت نمایش داده می‌شود', items.length === 5);

DONE('tester203-myday-dedup');

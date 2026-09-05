#!/usr/bin/env node
'use strict';
/* ═══ v34.36.5 (CUST-RFQ-ORPHAN) — گزارش کارفرما:
   مشتری ثبت شد، سپس درخواست به نام همان مشتری؛ درخواست نام را دارد، رکورد در فهرست مشتریان نیست.
   ① گارد کد یکتای محلی در saveCust2 (مثل saveCust v34.9.2)
   ② بازسازی stub از snapshot درخواست اگر custCd در مشتریان نیست
   ③ فیلتر «مشتریان من»: RFQهای خود کاربر مشتری را پنهان نکنند
   ④ data-cust-cd روی ردیف + راهنمای فهرست خالیِ فیلترشده ═══ */
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
var failed = [];
function T(name, ok) { if (!ok) failed.push(name); console.log((ok ? '✔ ' : '✘ ') + name); }

var offers = read('crm/offers.js');
var bridge = read('crm/bridge.js');
var filter = read('crm/my-customers-filter.js');
var idx = read('crm/index.html');

/* ① گارد کد یکتا */
T('ptfAllocCustCode تعریف شده است', offers.indexOf('window.ptfAllocCustCode = function') > -1);
T('saveCust2 از ptfAllocCustCode برای مشتری تازه استفاده می‌کند', /cd: cd \|\| \(typeof window\.ptfAllocCustCode === 'function' \? window\.ptfAllocCustCode\(items\) : genCode\('CUST'\)\)/.test(offers));
T('گارد پسوند Date.now در تخصیص کد هست', offers.indexOf("cd = cd + '-' + Date.now().toString(36)") > -1);
T('ساخت مشتری از درخواست سایت هم از ptfAllocCustCode استفاده می‌کند', bridge.indexOf("typeof window.ptfAllocCustCode === 'function' ? window.ptfAllocCustCode(custs)") > -1);
T('saveCust قدیمی گارد v34.9.2 را حفظ کرده', idx.indexOf("recC.cd = recC.cd + '-' + Date.now().toString(36)") > -1);

/* ② heal از snapshot درخواست */
T('ptfHealMissingCustomersFromRfqs تعریف شده است', offers.indexOf('window.ptfHealMissingCustomersFromRfqs = function') > -1);
T('heal صندوق بازیافت را دست نمی‌زند', offers.indexOf("a.kind === 'recycle' && a.collection === 'ptf_crm_customers'") > -1);
T('heal هر کد را در جلسه فقط یک‌بار می‌آزماید', offers.indexOf('window._ptfCustHealTried') > -1);
T('رندر فهرست مشتریان heal را صدا می‌زند', offers.indexOf('window.ptfHealMissingCustomersFromRfqs()') > -1);
T('رندر درخواست‌ها هم heal را صدا می‌زند', bridge.indexOf('window.ptfHealMissingCustomersFromRfqs()') > -1);
T('stub از نام/رابط درخواست پر می‌شود', offers.indexOf("co: String(r.co || '').trim() || cd") > -1 && offers.indexOf('healedFromRfq:') > -1);

/* ③ فیلتر RFQ-linked */
T('rfqLinkedMine در فیلتر مشتریان من هست', filter.indexOf('function rfqLinkedMine()') > -1);
T('applyFilter مشتریِ درخواست خود کاربر را نشان می‌دهد', filter.indexOf('linkedOwn[c.cd]') > -1);
T('مالک خالی برای own همچنان مخفی است مگر RFQ-linked', filter.indexOf('return !!own && own === myUser') > -1);
T('rfqLinkedMine در API تست export شده', filter.indexOf('rfqLinkedMine: rfqLinkedMine') > -1);

/* ④ DOM */
T('ردیف مشتری data-cust-cd دارد', offers.indexOf('data-cust-cd="') > -1);
T('applyDomFilter اول data-cust-cd را می‌خواند', filter.indexOf("tr.getAttribute('data-cust-cd')") > -1);
T('راهنمای فهرست خالیِ فیلترشده هست', filter.indexOf('ptfMyCustHiddenHint') > -1);

if (failed.length) {
  console.log(failed.map(function (f) { return ' • ' + f; }).join('\n'));
  process.exit(1);
}
console.log('PASS tester588: مشتری یتیم درخواست — کد یکتا + heal + فیلتر');

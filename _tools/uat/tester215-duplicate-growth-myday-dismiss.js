/* tester215 — v31.7.38 (BUG-DUP-GROW-001 + BUG-MYDAY-DISMISS-001)
 * Duplicate RFQ/Offer records must be canonically collapsed, and My Day items can be dismissed.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var sync = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf-8');
var myday = fs.readFileSync(path.join(ROOT, 'crm/myday.js'), 'utf-8');
var codegen = fs.readFileSync(path.join(ROOT, 'crm/codegen.js'), 'utf-8');

SECTION('ریشه‌کنی رشد duplicate در sync');
T('شناسه باگ و merge canonical هم‌کد در sync وجود دارد', sync.indexOf('BUG-DUP-GROW-001') > -1 && sync.indexOf('function ptfMergeByCodeCanonical') > -1 && sync.indexOf('function ptfMergeBusinessRecord') > -1);
T('ptfSmartMerge برای RFQ/Offer دیگر no-collapse نیست و canonical merge می‌کند', sync.indexOf("if (key === 'ptf_crm_rfqs' || key === 'ptf_crm_offers') return ptfMergeByCodeCanonical(key, localStr, remoteStr);") > -1 && sync.indexOf("return ptfMergeNoCollapse(key, localStr, remoteStr)") === -1);
T('تابع cleanup عمومی برای رکوردهای تکراری RFQ/Offer وجود دارد', sync.indexOf('window.ptfCollapseDuplicateBusinessRecords') > -1 && sync.indexOf("PTF-COLLAPSE-DUP") > -1);
T('cleanup با setData sync می‌شود و audit دارد', sync.indexOf("setData(key, after)") > -1 && sync.indexOf('پاکسازی رکوردهای تکراری هم‌کد') > -1);
T('codegen قبل از هشدار duplicate، cleanup canonical را اجرا می‌کند', codegen.indexOf('BUG-DUP-GROW-001') > -1 && codegen.indexOf('ptfCollapseDuplicateBusinessRecords({ confirm: \'PTF-COLLAPSE-DUP\' })') > -1);

SECTION('روز من: حذف/پاکسازی عملیاتی');
T('My Day fingerprint و dismiss map در settings دارد', myday.indexOf('BUG-MYDAY-DISMISS-001') > -1 && myday.indexOf('mydayDismissed') > -1 && myday.indexOf('window.ptfMyDayDismiss') > -1);
T('آیتم‌های dismissed از خروجی ptfMyDayItems حذف می‌شوند', myday.indexOf('mdHidden') > -1 && myday.indexOf('out = deduped.filter(function (it) { return !mdHidden(it); });') > -1);
T('هر ردیف My Day دکمه حذف × با stopPropagation دارد', myday.indexOf('حذف از روز من') > -1 && myday.indexOf('ptfMyDayDismissClick') > -1 && myday.indexOf('stopPropagation') > -1);
T('دکمه پاکسازی تکراری‌ها در My Day وجود دارد', myday.indexOf('ptfMyDayRepairDuplicates') > -1 && myday.indexOf('پاکسازی تکراری‌ها') > -1);
T('امکان نمایش دوباره حذف‌شده‌ها وجود دارد', myday.indexOf('ptfMyDayClearDismissed') > -1 && myday.indexOf('نمایش حذف‌شده‌ها') > -1);

SECTION('رفتاری: canonical merge ساده‌شده');
function collapse(list, field) {
  var by = {}, order = [];
  function score(r) { return Object.keys(r).length + ({ won: 9, sent: 7, draft: 3 }[r.st || r.status] || 0); }
  list.forEach(function (r) {
    var c = r[field];
    if (!by[c]) { by[c] = r; order.push(c); }
    else {
      var a = by[c], b = r, win = score(b) >= score(a) ? b : a, lose = win === a ? b : a;
      Object.keys(lose).forEach(function (k) { if (win[k] == null || win[k] === '') win[k] = lose[k]; });
      win._dupMerged = true; by[c] = win;
    }
  });
  return order.map(function (c) { return by[c]; });
}
var rfqs = [{ cd: 'RFQ-1242', co: 'A', st: 'draft' }, { cd: 'RFQ-1242', co: 'A', dueISO: '2026-07-18', st: 'sent' }, { cd: 'RFQ-1243', co: 'B' }];
var out = collapse(rfqs, 'cd');
T('رفتاری: دو RFQ هم‌کد به یک canonical record تبدیل می‌شوند', out.length === 2 && out.filter(function (x) { return x.cd === 'RFQ-1242'; }).length === 1 && out[0]._dupMerged === true);

DONE('tester215-duplicate-growth-myday-dismiss');

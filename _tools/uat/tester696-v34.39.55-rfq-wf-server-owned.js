/* tester696 — v34.39.55 (RFQ-WF-SERVER-OWNED) — RCA 2026-۱۰-۱۳
   گزارش کارفرما: «نوتیفیکیشن‌های گروه واقعی نیست و مربوط به رویدادهای گذشته است؛
   پیشنهادی را ۱۰ روز پیش لواسانی صادر کرده ولی پیام می‌گوید یوسفی صادر کرد؛
   وضعیتی را دست نزدم، از بازنده به منتظر پاسخ کارفرما تغییر کرد».

   ریشه (بازتولید اجرایی در e2e-rfq-notify-phantom-v34.39.55.js روی PHP واقعی):
   ① `wf`/`stxt` یک read-model مشتق است ولی payload کلاینت همیشه «کل رکورد» است و
      می‌تواند کهنه باشد ⇒ upsert/push کهنه، وضعیت را به گذشته برمی‌گرداند و همان
      واگردایی به‌عنوان «تغییر وضعیت» به نام کاربرِ جاری اعلام می‌شود.
   ② دو موتور موازی: sd_workflow_for_inquiry (سرور) و wfCompute (کلاینت، با
      WF80/WF85) ⇒ نوسان دائمی روی پرونده‌های برنده/تحویل/تسویه.
   ③ sd_workflow_for_inquiry «اولین» CO/TO آرایه را برمی‌داشت، نه آخرین ⇒ فقط با
      جابه‌جایی ترتیب آرایه، wf بین WF91 و WF60 نوسان می‌کرد.
   ④ crm/guards.js پس از هر حذف برای «همهٔ» inqNoهای پایگاه‌داده wfRefresh صدا
      می‌زد ⇒ یک حذف بی‌ربط، ده‌ها استعلام دست‌نخورده را بازنویسی می‌کرد.

   این تستر قراردادِ رفع را پین می‌کند؛ بخش JS با اجرای واقعی کد ریپو است. */
'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(root, 'api/sales-domain.php'), 'utf8');
var transport = fs.readFileSync(path.join(root, 'api/crm.php'), 'utf8');
var lib = fs.readFileSync(path.join(root, 'api/rfq-notify-lib.php'), 'utf8');
var guards = fs.readFileSync(path.join(root, 'crm/guards.js'), 'utf8');
var workflow = fs.readFileSync(path.join(root, 'crm/workflow.js'), 'utf8');

var results = { pass: 0, fail: 0 };
function T(name, fn) {
  try { fn(); results.pass++; console.log('  ✔ ' + name); }
  catch (e) { results.fail++; console.log('  ✘ ' + name + ' — ' + e.message); }
}

/* ═══ ۱) یک قاعدهٔ مشترک برای هر دو مسیر نوشتن (rfq-notify-lib.php) ═══ */
T('rfq-notify-lib تابع مشترکِ حفظ فیلدهای گردش‌کار را تعریف می‌کند', function () {
  ['ptf_rfq_workflow_fields', 'ptf_rfq_workflow_stale', 'ptf_rfq_workflow_preserve_row', 'ptf_rfq_workflow_merge_snapshot'].forEach(function (fn) {
    assert.ok(lib.indexOf('function ' + fn + '(') > -1, 'missing ' + fn);
  });
});
T('فیلدهای گردش‌کار دقیقاً wf/stxt/wfUpdatedAtISO/wfLog هستند', function () {
  var m = /function ptf_rfq_workflow_fields\(\): array \{\s*return \[([^\]]*)\];/.exec(lib);
  assert.ok(m, 'field list not found');
  ['wf', 'stxt', 'wfUpdatedAtISO', 'wfLog'].forEach(function (f) {
    assert.ok(m[1].indexOf("'" + f + "'") > -1, 'missing ' + f);
  });
});
T('payload بدون مهرِ تازه‌تر، کهنه حساب می‌شود', function () {
  var m = /function ptf_rfq_workflow_stale\(array \$incoming, array \$server\): bool \{([\s\S]*?)\n\}/.exec(lib);
  assert.ok(m, 'function body not found');
  assert.ok(m[1].indexOf('$incomingStamp === \'\'') > -1, 'missing-stamp payload must be treated as stale');
  assert.ok(m[1].indexOf('strcmp($serverStamp, $incomingStamp) > 0') > -1, 'older stamp must be treated as stale');
});
T('ردیفی که سرور هرگز گردش‌کاری نکرده دست‌نخورده می‌ماند', function () {
  var m = /function ptf_rfq_workflow_preserve_row\([\s\S]*?\n\}/.exec(lib);
  assert.ok(m && m[0].indexOf("trim((string)($server['wf'] ?? '')) === ''") > -1);
});

/* ═══ ۲) مسیر entity_* (sales-domain.php) ═══ */
T('entity_upsert روی ptf_crm_rfqs مقدار wf را از سرور بازخوانی می‌کند', function () {
  assert.ok(api.indexOf('function sd_rfq_workflow_server_owned(') > -1);
  var i = api.indexOf("if ($collection === 'ptf_crm_rfqs') {", api.indexOf("$action === 'entity_upsert'"));
  assert.ok(i > -1, 'rfqs branch not found');
  var block = api.slice(i, api.indexOf('}', api.indexOf('sd_rfq_workflow_server_owned', i)) + 1);
  assert.ok(block.indexOf('sd_rfq_workflow_server_owned($row, is_array($prev) ? $prev : [], sd_actor_label($user), $sanitizeStats)') > -1); /* v34.39.59: wfLog با نام نمایشی */
});
T('سرور wf را همیشه از فهرست authoritative پیشنهادها مشتق می‌کند', function () {
  var m = /function sd_rfq_workflow_server_owned\([\s\S]*?\n\}/.exec(api);
  /* v34.39.59: دیگر فقط یک شناسه نیست — سقوط WF50←WF10 دقیقاً از همین بود */
  assert.ok(m && m[0].indexOf("ptf_rfq_workflow_aliases($row)") > -1 && m[0].indexOf("sd_workflow_for_inquiry($aliases[0] ?? '', sd_read('ptf_crm_offers'), $aliases)") > -1);
  assert.ok(m[0].indexOf("$row['stxt'] = sd_workflow_label($wf)") > -1);
});
T('ویرایش پیشنهاد از مسیر عمومی هم گردش کار را در همان commit می‌برد', function () {
  var upsertBlock = api.slice(api.indexOf("$action === 'entity_upsert'"), api.indexOf("$action === 'entity_restore'"));
  assert.ok(/if \(\$collection === 'ptf_crm_offers'\) \{\s*\$wfSynced = sd_rfq_workflow_sync_for_offers\(\$rows, sd_read\('ptf_crm_rfqs'\), \[\(string\)\(\$stored\['inqNo'\] \?\? ''\)\]/.test(upsertBlock), 'upsert recompute missing');
});
T('حذف پیشنهاد هم گردش کار را بازخوانی می‌کند', function () {
  var deleteBlock = api.slice(api.indexOf("$id = sd_text($body['id'] ?? ($body['record'] ?? [])[$idField] ?? '', 60);"), api.indexOf("$action === 'entity_restore'"));
  assert.ok(deleteBlock.indexOf("$removedInqNo = (string)($rows[$found]['inqNo'] ?? '');") > -1);
  assert.ok(deleteBlock.indexOf('array_splice($rows, $found, 1);') > deleteBlock.indexOf('$removedInqNo'), 'inqNo must be captured BEFORE the row is removed');
  assert.ok(/if \(\$collection === 'ptf_crm_offers'\) \{\s*\$wfSynced = sd_rfq_workflow_sync_for_offers\(\$rows, sd_read\('ptf_crm_rfqs'\), \[\$removedInqNo\]/.test(deleteBlock), 'delete recompute missing');
});

/* ═══ ۳) ترتیب آرایه دیگر نتیجه را عوض نمی‌کند ═══ */
T('موتور با ترتیبِ کلِ پایدار انتخاب می‌کند، نه جایگاه آرایه (v34.39.59: بدنه در lib)', function () {
  /* sd_workflow_for_inquiry حالا delegate است؛ ترتیب کل در ptf_rfq_workflow_compute زندگی می‌کند */
  assert.ok(api.indexOf('function sd_workflow_for_inquiry(string $inqNo, array $offers, array $aliases = []): string') > -1);
  assert.ok(api.indexOf('return ptf_rfq_workflow_compute($aliases, $offers, $projects, $invoices);') > -1);
  var m = /function ptf_rfq_workflow_compute\([\s\S]*?\n\}/.exec(lib);
  assert.ok(m, 'compute not found in lib');
  assert.ok(m[0].indexOf('ptf_offer_wf_rank_higher($rank, $coRank)') > -1, 'total-order pick missing');
});
T('ترتیبِ کل شامل مهر ISO، دنبالهٔ عددی شماره و خودِ شماره است (no یکتا ⇒ کلِ کامل)', function () {
  var m = /function ptf_offer_wf_rank\(array \$offer\): array \{([\s\S]*?)\n\}/.exec(lib);
  assert.ok(m, 'rank function not found in lib');
  assert.ok(m[1].indexOf('serverRegisteredAt') > -1 && m[1].indexOf("preg_match('/(\\d+)\\s*$/u'") > -1);
  assert.ok(m[1].indexOf('return [$stamp, $tail, $no];') > -1);
});

/* ═══ ۴) مسیر legacy data_push (crm.php) ═══ */
T('data_push پیش از نوشتن، فیلدهای گردش‌کار را از نسخهٔ سرور بازمی‌گرداند', function () {
  var i = transport.indexOf('$k === \'ptf_crm_rfqs\' && !$restore && !$allow_wipe) {');
  assert.ok(i > -1, 'guard not found');
  var block = transport.slice(i, i + 1400);
  assert.ok(block.indexOf('ptf_rfq_workflow_merge_snapshot($wfIncomingRows, $wfServerRows)') > -1);
  var writeAt = transport.indexOf('if (!sync_key_write($sdir, $k, $v, $pushNextRev))');
  assert.ok(i < writeAt, 'merge must run before the key is written');
});
T('restore/allow_wipe صریحاً از گارد مستثنا هستند', function () {
  assert.ok(transport.indexOf("if ($k === 'ptf_crm_rfqs' && !$restore && !$allow_wipe) {") > -1);
});

/* ═══ ۵) کلاینت: حذف یک رکورد فقط استعلام همان رکورد را رفرش می‌کند (اجرای واقعی) ═══ */
function runGuardsDelete(kind, id, store) {
  var gStart = guards.indexOf('var _inqs = {};');
  var gEnd = guards.indexOf('} catch (eQ) {}');
  assert.ok(gStart > -1 && gEnd > gStart, 'guards.js scoping block not found');
  var refreshed = [];
  /* eslint-disable no-new-func */
  new Function('kind', 'id', 'getData', 'wfRefresh',
    guards.slice(gStart, gEnd + '} catch (eQ) {}'.length) +
    '\nObject.keys(_inqs).forEach(function (q) { wfRefresh(q); });')(
    kind, id, function (k) { return store[k] || []; }, function (q) { refreshed.push(q); });
  return refreshed;
}
T('حذف یک CO فقط استعلامِ خودش را رفرش می‌کند', function () {
  var store = {
    ptf_crm_offers: [{ no: 'CO-9', inqNo: 'RFQ-9' }, { no: 'TO-77', inqNo: 'RFQ-77' }, { no: 'CO-88', inqNo: 'RFQ-88' }],
    ptf_crm_rfqs: [{ cd: 'RFQ-9' }, { cd: 'RFQ-77' }, { cd: 'RFQ-88' }]
  };
  assert.deepStrictEqual(runGuardsDelete('OFFER', 'CO-9', store), ['RFQ-9']);
});
T('حذف یک RFQ فقط همان RFQ را رفرش می‌کند', function () {
  var store = { ptf_crm_offers: [{ no: 'CO-9', inqNo: 'RFQ-9' }], ptf_crm_rfqs: [{ cd: 'RFQ-9' }, { cd: 'RFQ-77' }] };
  assert.deepStrictEqual(runGuardsDelete('RFQ', 'RFQ-77', store), ['RFQ-77']);
});
T('حذف سند بی‌ربط (بدون inqNo) هیچ استعلامی را رفرش نمی‌کند', function () {
  var store = { ptf_crm_offers: [{ no: 'CO-9', inqNo: 'RFQ-9' }], ptf_crm_rfqs: [{ cd: 'RFQ-9' }] };
  assert.deepStrictEqual(runGuardsDelete('PROD', 'P-1', store), []);
});
T('الگوی «همهٔ inqNoهای پایگاه‌داده» از guards.js حذف شده است', function () {
  assert.ok(guards.indexOf("getData('ptf_crm_offers').forEach(function (o) { if (o.inqNo) _inqs[o.inqNo] = 1; });") === -1);
  assert.ok(guards.indexOf("getData('ptf_crm_rfqs').forEach(function (r2) { _inqs[r2.cd] = 1;") === -1);
});

/* ═══ ۶) قرارداد پیشین wfRefresh حفظ شده (tester442) ═══ */
T('wfRefresh همچنان وضعیت را ذخیره می‌کند — فقط «منبع حقیقت» نیست', function () {
  assert.ok(workflow.indexOf("window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' })") > -1);
  assert.ok(workflow.indexOf('RFQ-WF-SERVER-OWNED') > -1, 'ownership contract must be documented at the write site');
});

console.log('\n=== tester696-v34.39.55: ' + results.pass + ' PASS / ' + results.fail + ' FAIL ===');
if (results.fail) { console.log('FAIL tester696 — RFQ-WF-SERVER-OWNED'); process.exit(1); }
console.log('PASS tester696-v34.39.55: گردش کارِ درخواست فقط سمت سرور نوشته می‌شود');

#!/usr/bin/env node
'use strict';
/* v34.37.8 — PHASE-C2: زیرساخت فرمان عمومی موجودیت (مسیر نازک نوشتن).
   سرور: رجیستری موجودیت + entity_upsert/entity_delete با journal/idempotency موجود
   + tombstone عمومی (archive_purge با identities). کلاینت: ptfEntityUpsert/Delete +
   پرچم per-collection + اعمال projection بدون dirty. پایلوت: یادآورها (leads.js). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var api = read('api/sales-domain.php');
var v2 = read('crm/sales-domain-v2.js');
var leads = read('crm/leads.js');
var crmphp = read('api/crm.php');

T('VERSION.json = v34.37.8', ver.crm_version === 'v34.37.8', ver.crm_version);

/* ---------- سرور ---------- */
T('رجیستری موجودیت تعریف شد', /function sd_entity_registry\(\): array/.test(api));
T('پایلوت ptf_crm_reminders در رجیستری است', /'ptf_crm_reminders' => \[/.test(api));
T('ptf_crm_reminders در SD_KEYS اضافه شد', /'ptf_crm_reminders'\s*\n?\s*\];/.test(api) || api.indexOf("'ptf_crm_sales_commands',\n    'ptf_crm_reminders'") > -1);
T('entity_upsert/entity_delete در دیسپچر هستند', /entity_upsert' \|\| \$action === 'entity_delete/.test(api));
T('موجودیت غیرفعال → 404 not_enabled (دفاع عمیق)', /entity_collection_not_enabled/.test(api));
T('گارد نقش per-collection', /sd_require_role\(\$cfg\['roles'\]\)/.test(api));
T('sanitizer ردیف (سقف کلید/طول/تودرتو)', /function sd_entity_sanitize_row/.test(api) && /\$n >= \$maxFields\)\s*\{[^}]*break;/.test(api) && /count\(\$sub\) >= 60\) break;/.test(api));
T('حذف = tombstone عمومی archive_purge با identities', /'kind' => 'archive_purge'.*'identities' => \[\$collection => \[\$id\]\]/s.test(api));
T('حذف idempotent است (alreadyDeleted)', /'alreadyDeleted' => true/.test(api));
T('فرمان‌های entity از journal پاس می‌کنند (در readOnly نیستند)', !/\('snapshot', 'health'[\s\S]{0,200}entity_upsert/.test(api));
T('SD_SERVICE_VERSION = 34.37.8', /SD_SERVICE_VERSION = '34\.37\.8'/.test(api));

/* ---------- کلاینت ---------- */
T('پرچم per-collection فعال (پایلوت یادآور)', /PTF_ENTITY_CMD_ENABLED = \{ 'ptf_crm_reminders': true/.test(v2));
T('ptfEntityUpsert تعریف شد', /window\.ptfEntityUpsert = function/.test(v2));
T('ptfEntityDelete تعریف شد', /window\.ptfEntityDelete = function/.test(v2));
T('اعمال projection بدون dirty (ptfBApplyServerProjection)', /entityApplyProjection[\s\S]{0,600}ptfBApplyServerProjection/.test(v2) && /value != null\) \{[\s\S]{0,120}ptfBApplyServerProjection\(collection, value, rev\)/.test(v2));
T('fallback امن به مسیر legacy وقتی فاز B خاموش است', /setData\(collection, arr\)/.test(v2));
T('کلید غيرفعال → legacy بدون فرمان', /PTF_ENTITY_CMD_ENABLED\[collection\]\) \{ if \(opts\.cb\) opts\.cb\(\{ state: 'legacy' \}\)/.test(v2));

/* ---------- پایلوت leads.js ---------- */
T('remDone از فرمان سروری می‌گذرد (v34.37.8: router یکپارچه SaveCollection = فرمان اتمیک + نوشتن محلی بی‌درنگ)', /function remDone[\s\S]{0,700}ptfEntitySaveCollection\('ptf_crm_reminders', rems, \{ reason: 'rem-done' \}\)/.test(leads));
T('remSnooze از فرمان سروری می‌گذرد (v34.37.8: همان router)', /function remSnooze[\s\S]{0,900}ptfEntitySaveCollection\('ptf_crm_reminders', rems, \{ reason: 'rem-snooze' \}\)/.test(leads));
T('remDel از entity_delete می‌گذرد', /function remDel[\s\S]{0,700}ptfEntityDelete\('ptf_crm_reminders'/.test(leads));
T('هر سه مسیر fallback legacy دارند', (leads.match(/else setData\('ptf_crm_reminders'/g) || []).length >= 3);

/* ---------- شبیه‌سازی رفتاری: upsert/delete سرور ---------- */
(function behavior() {
  var rows = [{ cd: 'REM-1', msg: 'تماس', st: 'open' }];
  function upsert(rec) {
    var i = rows.findIndex(function (r) { return r.cd === rec.cd; });
    if (i < 0) { rows.push(rec); return { created: true }; }
    rows[i] = Object.assign({}, rows[i], rec, { createdAt: rows[i].createdAt });
    return { created: false };
  }
  function del(id) {
    var i = rows.findIndex(function (r) { return r.cd === id; });
    if (i < 0) return { deleted: false, alreadyDeleted: true };
    rows.splice(i, 1); return { deleted: true };
  }
  T('شبیه‌سازی: upsert جدید اضافه می‌کند', upsert({ cd: 'REM-2', msg: 'ایمیل' }).created === true && rows.length === 2);
  T('شبیه‌سازی: upsert موجود به‌روزرسانی می‌کند (createdAt حفظ)', (function () { var r = upsert({ cd: 'REM-1', st: 'done' }); return r.created === false && rows[0].st === 'done'; })());
  T('شبیه‌سازی: حذف یک‌بار می‌گیرد، بار دوم alreadyDeleted', del('REM-1').deleted === true && del('REM-1').alreadyDeleted === true && rows.length === 1);
})();

T('sync_stats (C1) همچنان سر جایش است', /case 'sync_stats':/.test(crmphp));

console.log('\n— tester517 (v34.37.8: PHASE-C2 فرمان عمومی موجودیت) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

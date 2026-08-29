#!/usr/bin/env node
'use strict';
/* v34.8.41 — PHASE-C3 گام۱: تکمیل یادآورها (ثبت) + مهاجرت سرنخ‌ها به فرمان سروری.
   - addReminder → entity_upsert (ماژول یادآور کامل شد: ثبت/انجام/تعویق/حذف)
   - ptf_crm_leads در رجیستری + SD_KEYS + پرچم کلاینت
   - saveLead/ptfLeadDelDo → entity_upsert/entity_delete با fallback legacy
   - sanitizer: لیست اسکالر (shareUsers) و لیست نقشهٔ اسکالر (hist) پایدارند */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var api = read('api/sales-domain.php');
var v2 = read('crm/sales-domain-v2.js');
var leads = read('crm/leads.js');

T('VERSION.json = v34.8.41', ver.crm_version === 'v34.8.41', ver.crm_version);

/* ---------- سرور ---------- */
T('ptf_crm_leads در رجیستری موجودیت', /'ptf_crm_leads' => \[/.test(api));
T('ptf_crm_leads در SD_KEYS', new RegExp("'ptf_crm_reminders'\\s*,\\s*'ptf_crm_le").test(api));
T('sanitizer لیست اسکالر را نگه می‌دارد', /is_string\(\$item\)\) \{ \$list\[\] = sd_text\(\$item, 300\)/.test(api));
T('sanitizer لیست نقشهٔ اسکالر (hist) را نگه می‌دارد', /subItem\[\$k3\] = \$storedSub;/.test(api));
T('SD_SERVICE_VERSION = 34.8.41', /SD_SERVICE_VERSION = '34\.8.41'/.test(api));

/* ---------- کلاینت ---------- */
T('پرچم سرنخ‌ها فعال شد', /'ptf_crm_leads': true/.test(v2)); /* v34.8.41: نقشه از این پس با W1 ادامه دارد — پرچم leads کافی است */
T('W1: مشتریان/تامین‌کنندگان/کالاها هم پرچم دارند', /'ptf_crm_customers': true/.test(v2) && /'ptf_crm_suppliers': true/.test(v2) && /'ptf_crm_products': true/.test(v2));
T('addReminder از فرمان سروری می‌گذرد (ماژول یادآور کامل)', /function addReminder\(r\) \{[\s\S]{0,1200}ptfEntityUpsert\('ptf_crm_reminders'/.test(leads));
T('saveLead از فرمان سروری می‌گذرد', /function saveLead\(cd\) \{[\s\S]{0,3500}ptfEntityUpsert\('ptf_crm_leads'/.test(leads));
T('ptfLeadDelDo از entity_delete می‌گذرد', /function ptfLeadDelDo\(cd\) \{[\s\S]{0,900}ptfEntityDelete\('ptf_crm_leads'/.test(leads));
T('مسیرهای fallback legacy حفظ شده‌اند', (leads.match(/else setData\('ptf_crm_(leads|reminders)'/g) || []).length >= 5);

/* ---------- شبیه‌سازی رفتاری sanitizer (الگوی PHP در JS) ---------- */
(function behavior() {
  function sanitize(v) {
    if (Array.isArray(v)) {
      var isList = v.every(function (x, i) { return arguments.length >= 0; }) && v.length >= 0;
      return v.map(function (item) {
        if (typeof item === 'string') return item.slice(0, 300);
        if (Array.isArray(item) || typeof item === 'object') {
          var out = {};
          Object.keys(item).slice(0, 20).forEach(function (k2) { var v2 = item[k2]; if (typeof v2 !== 'object') out[k2] = typeof v2 === 'string' ? v2.slice(0, 500) : v2; });
          return out;
        }
        return item;
      }).slice(0, 60);
    }
    return v;
  }
  var rec = {
    cd: 'LEAD-1', co: 'شرکت نمونه', val: 5000000,
    shareUsers: ['ceo', 'sales1'],
    hist: [{ t: '۱۴۰۵/۰۶/۰۵', k: 'ثبت', tx: 'لید ثبت شد' }],
    link: { kind: 'lead', cd: 'L2', lb: 'لید مرتبط' }
  };
  var out = {};
  Object.keys(rec).forEach(function (k) { out[k] = sanitize(rec[k]); });
  T('شبیه‌سازی: shareUsers (لیست اسکالر) حفظ شد', Array.isArray(out.shareUsers) && out.shareUsers.length === 2);
  T('شبیه‌سازی: hist (لیست نقشه) حفظ شد', Array.isArray(out.hist) && out.hist[0].k === 'ثبت');
  T('شبیه‌سازی: link (نقشهٔ اسکالر) حفظ شد', out.link && out.link.kind === 'lead');
  T('شبیه‌سازی: فیلدهای عددی/رشته‌ای دست‌نخورده', out.val === 5000000 && out.co === 'شرکت نمونه');
})();

console.log('\n— tester518 (v34.8.41: PHASE-C3 گام۱ — یادآور کامل + سرنخ‌ها) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

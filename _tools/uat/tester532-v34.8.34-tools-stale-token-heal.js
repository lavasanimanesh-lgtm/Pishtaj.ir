#!/usr/bin/env node
'use strict';
/* tester532 — v34.38.0 (STALE-TOKEN-HEAL): پایان حلقهٔ 403 بی‌پایان پنل ابزارها.
   گزارش کارفرما: admin_list/admin_report_drafts/... همه 403. ریشه: نقشِ توکن
   کهنه با نقش فعلی کاربر فرق دارد (تغییر نقش بعد از صدور). فیکس: اگر نقش فعلیِ
   همان کاربر در مخزن کاربران admin/chairman است، 401/needLogin برگردانده می‌شود
   تا کلاینت دوباره وارد شود (توکن تازه با نقش درست)؛ در غیر این صورت 403 عادی. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var t = read('api/tools.php');
T('stale-token heal در tools_admin_require', /STALE-TOKEN-HEAL/.test(t) && /stale_token_role_changed/.test(t));
T('چک نقش فعلی از مخزن کاربران (سه منبع)', /users\.json/.test(t) && /crm_users\.json/.test(t) && /sync\/ptf_crm_users\.json/.test(t));
T('نقش فعلی ادمین → 401 needLogin (نه 403)', /in_array\(\$currentRole, \['admin', 'chairman'\], true\)\) \{\s*http_response_code\(401\);[\s\S]{0,120}needLogin' => true/.test(t));
T('نقش واقعاً غیرادمین → 403 admin_required باقی است', /'error' => 'admin_required'/.test(t));
['crm/tool-feedback.js', 'crm/tool-licenses.js', 'crm/tool-report-drafts.js'].forEach(function (f) {
  T(f + ': needLogin → توست ورود مجدد', /_ptfToolsReloginPrompted/.test(read(f)));
});

var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.38.0', ver.crm_version === 'v34.38.0', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.38.0', /window\.PTF_CRM_RELEASE = 'v34\.38\.0'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.38\.0'/.test(read('crm/sw.js')));

console.log('\n— tester532 (v34.38.0: STALE-TOKEN-HEAL) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

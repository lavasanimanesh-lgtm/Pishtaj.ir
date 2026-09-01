#!/usr/bin/env node
'use strict';
/* tester541 — v34.19.0 (R2/T5-2c — DEV→IDB گام دوم): پیش‌نویس‌ها، آینهٔ پروفایل
   امضا و صف/پلن کدینگ دیگر مستقیم در localStorage نوشته نمی‌شوند؛ همه از نمای
   ptfDevKv (IndexedDB، ساخت v34.19.0) عبور می‌کنند و الگوی «کش سنکرون + پایدارسازی
   async» جریان‌های سنکرون (تخصیص کد، lookup امضا) را بدون تغییر نگه می‌دارد.
   پوشش:
     ۱) offers.js — ذخیره/حذف/بازیابی پیش‌نویس (بازیابی async پس از باز شدن فرم)
     ۲) sales-domain-v2.js — پیش‌نویس reject → Dev-KV + مهاجرت boot برای ۸ پیشوند
     ۳) case-revision.js — پاک‌سازی پیش‌نویس بازنگری از Dev-KV
     ۴) letters.js — helpers کش + hydrate یک‌بار + بازنویسی سه نقطهٔ LS
     ۵) codegen.js — devCache برای tmp_queue/duplicate_plan/ack (صفر LS مستقیم)
     ۶) golive.js — پاک‌سازی Dev-KV در go-live + پیشوند بازنگری
     ۷) key-registry.js — دستهٔ DEV دقیق شد (رفتاری در vm) */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var offers = read('crm/offers.js');
var sd = read('crm/sales-domain-v2.js');
var cr = read('crm/case-revision.js');
var letters = read('crm/letters.js');
var codegen = read('crm/codegen.js');
var golive = read('crm/golive.js');

/* ═══ ۱) offers.js ═══ */
T('offers: صفر localStorage نگه‌بان‌نشده برای پیش‌نویس‌ها (fallback بدون-IDB مجاز)', !/localStorage\s*\.\s*(setItem|getItem)\s*\([^)]*ptf_autodraft/.test(offers) && !/[^)]localStorage\s*\.\s*removeItem\s*\([^)]*ptf_autodraft/.test(offers.replace(/else localStorage\./g, 'GUARDED ')), 'ارجاع مستقیم بی‌گارد باقی است');
T('offers: ذخیرهٔ پیش‌نویس از ptfDevKv', /ptfTriggerAutoDraftSave[\s\S]{0,700}window\.ptfDevKv\.set\(key, JSON\.stringify\(_offState\)\)/.test(offers));
T('offers: بدون IDB → fallback به LS (قرارداد رودمپ)', /else \{ try \{ localStorage\.setItem\(key, JSON\.stringify\(_offState\)\); \} catch \(eL\) \{\} \}/.test(offers));
T('offers: بازیابی پیش‌نویس async است (فرم فوراً باز، سپس confirm در cb)', /window\.ptfDevKv\.get\('ptf_autodraft_offer_' \+ kind, function \(raw\)/.test(offers) && /آیا مایل به بازیابی آن هستید؟'\)\) \{[\s\S]{0,400}ptfSetOffState\(draft\);[\s\S]{0,120}offerForm\(\)/.test(offers));
T('offers: انصراف از بازیابی → حذف پیش‌نویس از Dev-KV', /window\.ptfDevKv\.remove\('ptf_autodraft_offer_' \+ kind\)/.test(offers));
T('offers: پس از ثبت موفق، پیش‌نویس از Dev-KV پاک می‌شود', /window\.ptfDevKv\.remove\('ptf_autodraft_offer_' \+ o\.kind\)/.test(offers));

/* ═══ ۲) sales-domain-v2.js ═══ */
T('sales: پیش‌نویس فرم رد‌شده → Dev-KV (نه LS)', /devKvSet\('ptf_autodraft_offer_'\+\(st\.kind\|\|'CO'\),JSON\.stringify\(st\)\)/.test(sd));
T('sales: مهاجرت boot هر ۸ پیشوند R1+R2 را پوشش می‌دهد', (function () {
  var need = ['ptf_sales_command_', 'ptf_offer_post_ack_warning_', 'ptf_autodraft_offer_', 'ptf_autodraft_award_revision_', 'ptf_sig_profile_recovery_v1_', 'ptf_code_tmp_queue', 'ptf_code_duplicate_plan', 'ptf_code_duplicate_ack'];
  var seg = sd.slice(sd.indexOf('ptfDevKvMigratePrefixes'), sd.indexOf('ptfDevKvMigratePrefixes') + 700);
  return need.every(function (k) { return seg.indexOf("'" + k + "'") > -1; });
})());

/* ═══ ۳) case-revision.js ═══ */
T('case-revision: پاک‌سازی پیش‌نویس بازنگری از Dev-KV', /clearRevisionDraft\(ctx\)\{var key=revisionDraftKey\(ctx\);if\(key\)try\{if\(window\.ptfDevKv\)window\.ptfDevKv\.remove\(key\);else localStorage\.removeItem\(key\);/.test(cr));

/* ═══ ۴) letters.js ═══ */
T('letters: helpers کش/نوشتن/hydrate تعریف شدند', /var _sigRecoveryCache = \{\};/.test(letters) && /function sigRecoveryWrite\(user, obj\)/.test(letters) && /function sigRecoveryHydrate\(user, cb\)/.test(letters));
T('letters: نوشتن آینه از sigRecoveryWrite (صفر LS مستقیم برای sigRecoveryKey)', !/localStorage\s*\.\s*setItem\([^)]*sigRecoveryKey/.test(letters), 'نوشتن مستقیم باقی است');
T('letters: خواندن آینه از کش (با fallback LS تا مهاجرت)', /JSON\.parse\(sigRecoveryRead\(canonical\) \|\| 'null'\)/.test(letters));
T('letters: hydrate فقط یک‌بار برای هر کلید (فلگ checked)', /_sigRecoveryChecked\[canonical\] = 1;/.test(letters) && /!_sigRecoveryChecked\[canonical\]/.test(letters));
T('letters: پس از hydrate، resolve یک‌بار تکرار می‌شود (تعمیر نسخهٔ جدیدتر)', /sigRecoveryHydrate\(canonical, function \(v\) \{ if \(v != null\) \{ try \{ sigProfileFor\(user\); \} catch/.test(letters));
T('letters: mirror پس از ذخیرهٔ پروفایل از Dev-KV', /try \{ sigRecoveryWrite\(me, p\); \} catch \(eMir\) \{\}/.test(letters));

/* ═══ ۵) codegen.js ═══ */
T('codegen: devCache (get/set/remove) + hydrate بوت تعریف شد', /var _devCache = \{\};/.test(codegen) && /function devCacheGet\(k, def\)/.test(codegen) && /function devCacheSet\(k, v\)/.test(codegen) && /function devCacheRemove\(k\)/.test(codegen) && /DEVKV_CODE_KEYS\.forEach/.test(codegen));
T('codegen: صفر localStorage برای سه کلید DEV (صف/پلن/ack)', !/localStorage\s*\.\s*(setItem|getItem|removeItem)\s*\([^)]*ptf_code_(tmp_queue|duplicate_plan|duplicate_ack)/.test(codegen), 'ارجاع مستقیم باقی است');
T('codegen: هر دو نقطهٔ صف TMP از devCache', (codegen.match(/devCacheGet\('ptf_code_tmp_queue','\[\]'\)/g) || []).length >= 3);
T('codegen: ack خواندن/نوشتن از devCache', /devCacheGet\('ptf_code_duplicate_ack',''\)/.test(codegen) && /devCacheSet\('ptf_code_duplicate_ack', fp\)/.test(codegen));
T('codegen: پلن duplicate از devCache (نوشتن/حذف/۳ خوانده)', /devCacheSet\('ptf_code_duplicate_plan'/.test(codegen) && /devCacheRemove\('ptf_code_duplicate_plan'\)/.test(codegen) && (codegen.match(/devCacheGet\('ptf_code_duplicate_plan','\[\]'\)/g) || []).length === 3);
T('codegen: جریان سنکرون تخصیص کد بدون تغییر (fallback LS تا hydrate)', /var lv = null; try \{ lv = localStorage\.getItem\(k\); \} catch \(eL\) \{\}\s*\n  return lv != null \? lv : def;/.test(codegen));

/* ═══ ۶) golive.js ═══ */
T('golive: پاک‌سازی Dev-KV در go-live (پیش‌نویس‌ها دیگر در LS نیستند)', /window\.ptfDevKv\.keys\(pre, function \(ks\)/.test(golive) && -1 === golive.indexOf('ptf_backup_local$|^ptf_backup_prerestore$/test') === false || /ptf_autodraft_award_revision_'\]\.forEach/.test(golive));
T('golive: پاک‌سازی legacy LS حفظ شد', /\/\^ptf_ai_hist_\|\^ptf_autodraft_offer_\|\^ptf_backup_local\$\|\^ptf_backup_prerestore\$\/\.test\(k\)/.test(golive));

/* ═══ ۷) key-registry.js — رفتاری در vm ═══ */
var kr = read('crm/key-registry.js');
var sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(kr, sandbox);
T('registry: پیشوند بازنگری جایزه دستهٔ DEV', sandbox.window.ptfKeyCategory('ptf_autodraft_award_revision_OFR-1') === 'DEV');
T('registry: پیشوند واقعی آینهٔ امضا دستهٔ DEV', sandbox.window.ptfKeyCategory('ptf_sig_profile_recovery_v1_ali') === 'DEV');
T('registry: پیشوند کهنهٔ sigRecovery_ حذف شد', sandbox.window.ptfKeyCategory('sigRecovery_ali') !== 'DEV');
T('registry: autodraft_offer همچنان DEV', sandbox.window.ptfKeyCategory('ptf_autodraft_offer_CO') === 'DEV');

/* ═══ انتها ═══ */
console.log('\n— tester541 (v34.19.0: R2/T5-2c — پیش‌نویس‌ها/امضا/کدینگ در Dev-KV) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

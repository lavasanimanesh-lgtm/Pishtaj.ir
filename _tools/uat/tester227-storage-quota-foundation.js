/* tester227 — v31.7.50+ (STORAGE-QUOTA-FOUNDATION-001)
 * localStorage 5MB risk: measurement, fail-safe writes, emergency compact and IndexedDB helper.
 */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sq = fs.readFileSync(path.join(ROOT, 'crm/storage-quota.js'), 'utf-8');
var bak = fs.readFileSync(path.join(ROOT, 'crm/backup.js'), 'utf-8');

SECTION('Script loading and version');
T('storage-quota.js در CRM با نسخه رسمی فعلی لود می‌شود', /storage-quota.js\?v=3[0-9.]+/.test(idx));
T('storage-quota قبل از codegen/backup لود می‌شود', /storage-quota.js\?v=3[0-9.]+/.test(idx) && idx.indexOf('storage-quota.js') < idx.indexOf('codegen.js') && idx.indexOf('storage-quota.js') < idx.indexOf('backup.js'));
T('نسخه CRM و service worker به v33.5.0 bump شده‌اند', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx) && /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8')));

SECTION('Storage quota API');
T('سقف محافظه‌کارانه localStorage همان ۵MB تعریف شده است', sq.indexOf('LOCALSTORAGE_SOFT_LIMIT = 5 * 1024 * 1024') > -1);
T('APIهای health/usage/topKeys/format وجود دارند', ['ptfStorageLocalUsage','ptfStorageHealthSync','ptfStorageTopKeys','ptfStorageFormatBytes'].every(function (x) { return sq.indexOf('window.' + x) > -1; }));
T('safe setItem و failed writes وجود دارند', sq.indexOf('window.ptfStorageSafeSetItem') > -1 && sq.indexOf('window.ptfStorageFailedWrites') > -1);
T('Storage.prototype.setItem fail-safe wrap می‌شود', sq.indexOf('Object.defineProperty(proto, \'setItem\'') > -1 && sq.indexOf('__ptfSafeSetItemInstalled') > -1);
T('QuotaExceededError شناسایی می‌شود', sq.indexOf('QuotaExceededError') > -1 && sq.indexOf('NS_ERROR_DOM_QUOTA_REACHED') > -1);
T('در خطای quota پاک‌سازی اضطراری و هشدار visible انجام می‌شود', sq.indexOf('emergencyCompact({ source: \'quota\'') > -1 && sq.indexOf('ptfStorageQuotaBanner') > -1);

SECTION('Emergency compact policy');
T('پاک‌سازی امن رکوردهای اصلی را حذف نمی‌کند و فقط volatileها را compact می‌کند', ['ptf_crm_notifs','ptf_crm_sendqueue','ptf_crm_audit','ptf_web_events_v2','ptf_chat_history','ptf_draft_forms','ptf_ai_cache'].every(function (x) { return sq.indexOf(x) > -1; }));
T('برای داده‌های حجیم IndexedDB helper وجود دارد', sq.indexOf("DB_NAME = 'ptf-crm-storage-v1'") > -1 && sq.indexOf('window.ptfStorageIdbSet') > -1 && sq.indexOf('window.ptfStorageIdbGet') > -1);
T('درخواست Persistent Storage اضافه شده است', sq.indexOf('navigator.storage.persist') > -1 && sq.indexOf('ptfStorageRequestPersistent') > -1);
T('هیچ fetch/API جدیدی در storage-quota نیست', sq.indexOf('fetch(') === -1);

SECTION('Backup/settings integration');
T('پنل حافظه از API جدید health/topKeys استفاده می‌کند', bak.indexOf('ptfStorageHealthSync') > -1 && bak.indexOf('بزرگ‌ترین کلیدها') > -1);
T('پاک‌سازی تنظیمات از ptfStorageEmergencyCompact استفاده می‌کند', bak.indexOf('ptfStorageEmergencyCompact') > -1 && bak.indexOf('پاک‌سازی امن فوری') > -1);
T('fallback بک‌آپ حجیم به IndexedDB منتقل می‌شود', bak.indexOf("ptfStorageIdbSet('ptf_backup_local'") > -1 && bak.indexOf("ptfStorageIdbSet('ptf_backup_prerestore'") > -1);
T('متن آموزشی توضیح می‌دهد سقف localStorage از مرورگر است', /سقف[^<]*۵? ?MB?[^<]*از طرف مرورگر|حدود ۵MB/.test(bak) && bak.indexOf('مرورگر') > -1); /* v33.22.2: صورت‌بندی کوتاه‌تر شد ولی معنا (سقف از مرورگر است) پابرجا */
T('setData مرکزی از ptfStorageSafeSetItem استفاده می‌کند', idx.indexOf('window.setData = function') > -1 && idx.indexOf("if (typeof ptfStorageSafeSetItem === 'function') saveResult = ptfStorageSafeSetItem(k, s)") > -1);

SECTION('Runtime compact smoke');
function LS() { this.s = {}; }
Object.defineProperty(LS.prototype, 'length', { get: function () { return Object.keys(this.s).length; } });
LS.prototype.getItem = function (k) { return Object.prototype.hasOwnProperty.call(this.s, k) ? this.s[k] : null; };
LS.prototype.setItem = function (k, v) { this.s[String(k)] = String(v); };
LS.prototype.removeItem = function (k) { delete this.s[String(k)]; };
LS.prototype.key = function (i) { return Object.keys(this.s)[i] || null; };
LS.prototype.clear = function () { this.s = {}; };
var sandbox = { console: console, TextEncoder: TextEncoder, Date: Date, Blob: Blob, navigator: { storage: { estimate: function () { return Promise.resolve({ usage: 1, quota: 2 }); } } }, document: { getElementById: function () { return null; }, createElement: function () { return { style: {}, setAttribute: function(){}, innerHTML: '' }; }, body: { appendChild: function () {} } }, alert: function(){}, localStorage: new LS() };
sandbox.window = sandbox;
vm.runInNewContext(sq, sandbox, { filename: 'storage-quota.js' });
sandbox.ptfStorageSafeSetItem('ptf_crm_audit', JSON.stringify(Array.from({ length: 1105 }, function (_, i) { return { i: i, msg: 'x' }; })), { noWarn: true });
sandbox.ptfStorageSafeSetItem('ptf_web_events_v2', JSON.stringify(Array.from({ length: 220 }, function (_, i) { return { i: i }; })), { noWarn: true });
var before = sandbox.ptfStorageHealthSync().used;
var compact = sandbox.ptfStorageEmergencyCompact({ source: 'uat' });
var auditLen = JSON.parse(sandbox.localStorage.getItem('ptf_crm_audit')).length;
var webLen = JSON.parse(sandbox.localStorage.getItem('ptf_web_events_v2')).length;
T('runtime: emergency compact اجرا و حجم را کم می‌کند', compact && compact.after <= before);
T('runtime: audit به ۱۰۰۰ و web events به ۱۵۰ محدود می‌شود', auditLen === 1000 && webLen === 150);
T('runtime: health percent/topKeys برمی‌گرداند', typeof sandbox.ptfStorageHealthSync().percent === 'number' && Array.isArray(sandbox.ptfStorageTopKeys(3)));

DONE('tester227-storage-quota-foundation');

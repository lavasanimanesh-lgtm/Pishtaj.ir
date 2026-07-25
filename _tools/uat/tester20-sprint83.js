/* tester20 — اسپرینت ۸۳: US-179 (عکس پروفایل) + US-180 (عرض ثابت v83.1) + US-181 (مجاز/غیرمجاز) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var theme = fs.readFileSync(path.join(BASE, 'theme.js'), 'utf-8');
var perms = fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8');
var sync = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bkp = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var api = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');

SECTION('US-179: عکس پروفایل');
T('ptfAvatarUpload با فشرده‌سازی ۱۲۸px', theme.indexOf('ptfAvatarUpload') > -1 && theme.indexOf('var S = 128') > -1);
T('اعمال روی navAv', theme.indexOf('ptfApplyAvatar') > -1 && theme.indexOf('navAv') > -1);
T('حذف و دیالوگ', theme.indexOf('ptfAvatarRemove') > -1 && theme.indexOf('ptfAvatarDialog') > -1);
T('بخش تنظیمات', theme.indexOf('ptfAvatarSection') > -1 && idx.indexOf('ptfAvatarSection') > -1);
T('سینک+بک‌آپ+whitelist', sync.indexOf('ptf_crm_avatars') > -1 && bkp.indexOf('ptf_crm_avatars') > -1 && api.indexOf('ptf_crm_avatars') > -1);

SECTION('US-180: عرض ثابت فضای کاری');
T('scrollbar-gutter رزرو', theme.indexOf('scrollbar-gutter:stable') > -1);
T('پنل تا منتها الیه چپ', theme.indexOf('.pn{width:100%;max-width:none}') > -1);
// v83.1: ریشه پرش (اسکرین‌شات کارفرما) — .mn باید همیشه کل عرض باقیمانده را بگیرد
T('v83.1: .mn flex:1 + عرض ثابت', theme.indexOf('.mn{flex:1 1 auto') > -1 && theme.indexOf('calc(100% - var(--sw))') > -1);
T('v83.1: موبایل هم عرض ثابت', theme.indexOf('calc(100% - 56px)') > -1);
T('v83.1: جدول عریض اسکرول داخلی', theme.indexOf('.tb2{overflow-x:auto}') > -1);

SECTION('US-181: فقط مجاز/غیرمجاز');
T('ستون پیش‌فرض حذف شد', perms.indexOf('<th>ماژول</th><th>مجاز</th><th>غیرمجاز</th>') > -1);
T('roleDefaultFor + ptfEffectiveAccess', perms.indexOf('function roleDefaultFor') > -1 && perms.indexOf('ptfEffectiveAccess') > -1);
T('ذخیره فقط تفاوت با نقش', perms.indexOf('if (want !== def) mine[p.id]') > -1);
T('دکمه‌های کمکی', perms.indexOf('permsSetAll') > -1 && perms.indexOf('permsResetRole') > -1);
T('برچسب شخصی', perms.indexOf('شخصی') > -1);

// منطق roleDefaultFor با ROLES شبیه‌سازی‌شده
global.ROLES = {
  sales: { panels: ['dash', 'rfq', 'cust'], users: false, finance: false },
  admin: { panels: '*', users: true, finance: true },
  accountant: { panels: ['inv', 'recv', 'cart'], users: false, finance: false }
};
global.curRole = () => 'admin';
global.curSession = () => ({ user: 'admin', name: 'ادمین' });
var m = perms.match(/function roleDefaultFor[\s\S]*?\n  \}/);
if (!m) throw new Error('roleDefaultFor not found');
eval('global.roleDefaultFor = ' + m[0].replace('function roleDefaultFor', 'function '));
T('sales → rfq مجاز', roleDefaultFor('sales', 'rfq') === true);
T('sales → inv غیرمجاز', roleDefaultFor('sales', 'inv') === false);
T('sales → petty مجاز (استثنا)', roleDefaultFor('sales', 'petty') === true);
T('admin → همه مجاز', roleDefaultFor('admin', 'rep') === true && roleDefaultFor('admin', 'orders') === true);
T('sales → orders غیرمجاز (finance)', roleDefaultFor('sales', 'orders') === false);

SECTION('نسخه');
T('VER نسخه‌دار', idx.indexOf("var VER = 'v") > -1);
T('SW کش نسخه‌دار', sw.indexOf("'ptf-crm-v") > -1);

DONE('tester20-sprint83');

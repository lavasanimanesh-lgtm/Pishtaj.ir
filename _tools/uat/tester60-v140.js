/* tester60 — v14.0 (اسپرینت ۱): US-260/263/264 + BUG-014 + US-353 */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var gd = fs.readFileSync(path.join(BASE, 'guards.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');

SECTION('US-260: حذف → رفرش گردش کار');
T('پس از حذف، wfRefresh صدا زده می‌شود', gd.indexOf("wfRefresh(q, 'حذف سند (' + kind") > -1);
T('پوشش همه شماره‌های مرتبط (rfqs + offers)', gd.indexOf("getData('ptf_crm_offers').forEach") > -1 && gd.indexOf("getData('ptf_crm_rfqs').forEach") > -1);
T('ایزوله با try (حذف اصلی نمی‌شکند)', gd.indexOf('} catch (eW) {}') > -1);

SECTION('US-263: هرس صف‌ها');
T('sendqueue ارسال‌شده >۳۰ روز حذف', bk.indexOf("x.st === 'sent' && (x.iso || x.t || '') < cutoff") > -1);
T('wfLog حداکثر ۵۰ per درخواست', bk.indexOf('r.wfLog.length > 50') > -1 && bk.indexOf('r.wfLog.slice(-50)') > -1);
T('همراه چرخه بک‌آپ (بدون polling جدید)', (bk.match(/pruneQueues\(\);/g) || []).length >= 2 && bk.indexOf('function pruneQueues()') > -1);
T('سقف‌های notifs/audit قبلی پابرجا', (function(){ var c=fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8'); return /logs\.slice\(0,\s*\d+\)/.test(c) && /notifs\.slice\(0,\s*\d+\)/.test(c); })());

SECTION('US-264: سینک deleted_archive');
T('در SYNC_KEYS', sy.indexOf('ptf_crm_deleted_archive') > -1);
T('در کلیدهای بک‌آپ', bk.indexOf('ptf_crm_deleted_archive') > -1);
T('در whitelist سرور', php.indexOf('ptf_crm_deleted_archive') > -1);
T('هرس ۵۰۰تایی آرشیو', gd.indexOf('arc.length > 500') > -1 && gd.indexOf('arc.slice(0, 500)') > -1);

SECTION('BUG-014/US-272: حذف «مالی» قدیمی');
T('از سایدبار حذف شد', idx.indexOf('goPanel(\'fin\',this)') === -1);
T('از گروه مالی حذف شد', sh.indexOf("['inv', 'recv', 'petty', 'anl']") > -1);
T('توابع legacy محفوظ (لینک قدیمی نمی‌شکند)', idx.indexOf('function buildFinance()') > -1);
T('فاکتورها/مطالبات/تنخواه/تحلیلگر سرجایشان', idx.indexOf("goPanel('inv'") > -1 && idx.indexOf("goPanel('recv'") > -1);

SECTION('US-353: ادمین محل ارجاع فرآیندها نیست');
T('salesUsers دیگر ادمین را اضافه نمی‌کند', br.indexOf("users.unshift({ username: 'admin'") === -1);
T('کاندیداهای ارجاع بدون ادمین', br.indexOf("u.username !== 'admin' && (u.roleId || '') !== 'admin'") > -1);
T('استثنا: تیک «مسئله خاص فنی/پشتیبانی سیستم»', br.indexOf('refToAdmin') > -1 && br.indexOf('پشتیبانی فنی') > -1);
T('برگشت از حالت فنی به فهرست عادی', br.indexOf('_refUOpts') > -1);
DONE('tester60-v140');

/* tester54 — v13.4 (US-327..331 + بررسی‌ها): چک‌ها، تغییرنام‌ها، متن‌های آماده، تب تامین‌کنندگان */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ch = fs.readFileSync(path.join(BASE, 'cheques.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var rf = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-327: چک‌های صادره در ماژول شخصی');
T('ماژول cheques ثبت شده', idx.indexOf('cheques.js') > -1 && sw.indexOf('./cheques.js') > -1);
T('باکس چک‌ها به پنل یادآورها هوک شد', ch.indexOf('window.buildReminders = function () {') > -1 && ch.indexOf('chqBox') > -1);
T('فرم ثبت: شماره/مبلغ/در وجه/بانک/سررسید/بابت', ['chNo', 'chAmt', 'chTo', 'chBank', 'chDueJ', 'chNote'].every(function (k) { return ch.indexOf('id="' + k + '"') > -1; }));
T('یادآور روزانه از ۷ روز قبل (پنجره d<=7)', ch.indexOf('if (d > 7) return;') > -1);
T('هر روز فقط یک اعلان (notified[today])', ch.indexOf('if (c.notified[today]) return;') > -1);
T('اعلان به کارتابل ثبت‌کننده', ch.indexOf('toUsers: [c.by || s.user]') > -1 && ch.indexOf("kind: 'cheque'") > -1);
T('پاس شدن + حذف + audit', ch.indexOf('chClear') > -1 && ch.indexOf('chDel') > -1 && ch.indexOf("audit('چک‌ها'") > -1);
T('کلید در sync/backup/whitelist سرور', sy.indexOf('ptf_crm_cheques') > -1 && bk.indexOf('ptf_crm_cheques') > -1 && php.indexOf('ptf_crm_cheques') > -1);

SECTION('US-328/329: تغییرنام‌ها');
T('سایدبار: درخواست‌ها', idx.indexOf('<span class="lb">درخواست‌ها</span>') > -1 && idx.indexOf('<span class="lb">استعلامات</span>') === -1);
T('عنوان پنل rfq', idx.indexOf("rfq:'📋 درخواست‌ها'") > -1);
T('h3 پنل (هر دو نسخه build)', fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8').indexOf('<h3>📋 درخواست‌ها</h3>') > -1);
T('سایدبار: درخواست تامین', idx.indexOf('<span class="lb">درخواست تامین</span>') > -1);
T('rfqsmart: عنوان و دکمه', rf.indexOf('<h3>🛒 درخواست تامین</h3>') > -1 && rf.indexOf('+ درخواست تامین جدید') > -1 && rf.indexOf("textContent = '🛒 درخواست تامین'") > -1);
T('دسترسی‌ها (perms) همگام', fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8').indexOf("lb: 'درخواست تامین'") > -1);

SECTION('US-330: متن‌های آماده با متغیر نام');
T('۸ متن پیش‌فرض در ۳ دسته', ch.indexOf("aud: 'مشتری'") > -1 && ch.indexOf("aud: 'تامین‌کننده'") > -1 && ch.indexOf("aud: 'سایر'") > -1);
T('متغیر {نام} جایگذاری می‌شود', ch.indexOf("replace(/\\{نام\\}/g, name") > -1);
T('دیالوگ انتخاب + کپی برای پیام‌رسان', ch.indexOf('ptfTplPick') > -1 && ch.indexOf('navigator.clipboard.writeText(txt)') > -1);
T('دکمه روی کارت مشتری/تامین‌کننده', ch.indexOf('متن‌های آماده پیام') > -1 && ch.indexOf('_tplCardHooked') > -1);

SECTION('US-331: تب تامین‌کنندگان داخلی/خارجی');
T('سه تب: همه/داخلی/خارجی', ch.indexOf('supTabAll') > -1 && ch.indexOf("ptfSupTab(\\'داخلی\\')") > -1 && ch.indexOf("ptfSupTab(\\'خارجی\\')") > -1);
T('فیلد داخلی/خارجی در فرم تامین‌کننده', ch.indexOf('nS2Origin') > -1);
T('پیش‌فرض داخلی برای رکوردهای قدیمی', ch.indexOf("c.origin || 'داخلی'") > -1);

SECTION('بررسی‌های کارشناسی');
T('سند پیام‌رسان + APK موجود', fs.existsSync(path.resolve(__dirname, '../../ASSESSMENT-MESSAGING-APK-v134.md')));
T('سند شامل US-332..334', (function () { var d = fs.readFileSync(path.resolve(__dirname, '../../ASSESSMENT-MESSAGING-APK-v134.md'), 'utf-8'); return d.indexOf('US-332') > -1 && d.indexOf('US-334') > -1 && d.indexOf('Bubblewrap') > -1 && d.indexOf('wa.me') > -1; })());
DONE('tester54-v134');

/* tester38 — v122.3 (US-281/282/283): حذف ریشه‌ای دکمه‌های قدیمی + بک‌آپ چرخشی کم‌حجم + یادآور ماهانه */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var st = fs.readFileSync(path.join(BASE, 'storage.js'), 'utf-8');
var mx = fs.readFileSync(path.join(BASE, 'modalx.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var crmphp = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
var stphp = fs.readFileSync(path.resolve(__dirname, '../../api/storage.php'), 'utf-8');

SECTION('US-281: ریشه‌کنی دکمه‌های قدیمی مودال (نسل سوم — storage.js)');
T('تزریق 🗖💾✕ از MutationObserver حذف شد', st.indexOf('🗖</button>') === -1 && st.indexOf('💾✕</button>') === -1);
T('پاکسازی دفاعی نسل قدیم در observer', st.indexOf('oldCtrls.remove()') > -1);
T('CSS: .ptf-win-ctrls مخفی', idx.indexOf('.ptf-win-ctrls') > -1 && /\.ptf-win-ctrls[^{]*\{[^}]*display:\s*none/.test(idx.replace(/\n/g,' ').replace(/,\s*/g,'')) || idx.indexOf('.md .md-ctrls, .ptf-win-ctrls') > -1);
T('modalx دیالوگ‌های ptfdlg را هم تجهیز می‌کند', mx.indexOf(".querySelector('.ptfdlg')") > -1 && mx.indexOf("'.md-b, .ptfdlg-b'") > -1);
T('modalx پاکسازی دفاعی ptf-win-ctrls/md-ctrls', mx.indexOf('.ptf-win-ctrls, .md-ctrls') > -1);
T('MutationObserver مودال‌های ptfdlg-b جدید را می‌گیرد', mx.indexOf("classList.contains('ptfdlg-b')") > -1);

SECTION('US-282: بک‌آپ چرخشی با حداقل فضای ابری');
T('فشرده‌سازی gzip در save_backup', crmphp.indexOf('gzencode($raw') > -1);
T('ساعتی جایگزین (hourly-latest)', crmphp.indexOf("'/hourly-latest' . $ext") > -1);
T('روزانه فقط ۳ نسخه', crmphp.indexOf('count($files) - 3') > -1 && crmphp.indexOf('count($files) > 3') > -1);
T('هفتگی فقط با تغییر هفته جایگزین', crmphp.indexOf("date('oW', filemtime($wk)) !== date('oW')") > -1);
T('ماهانه فقط با تغییر ماه جایگزین', crmphp.indexOf("date('Y-m', filemtime($mo)) !== date('Y-m')") > -1);
T('ابری: کلید ثابت جایگزین‌شونده (بدون uniqid انباشتی)', stphp.indexOf("case 'presign_put_backup'") > -1 && stphp.indexOf("'backups/' . $name") > -1);
T('نام بک‌آپ ابری فقط ۲ کلید مجاز', stphp.indexOf('crm-backup-(latest|monthly)') > -1);
T('هرس ابری backup_prune (حذف انباشت قدیمی)', stphp.indexOf("case 'backup_prune'") > -1 && stphp.indexOf('in_array($k, $keep, true)') > -1);
T('backup_prune در فهرست اکشن‌های حساس', stphp.indexOf("'backup_prune']") > -1);
T('save_backup بعد از آپلود موفق هرس را صدا می‌زند', crmphp.indexOf('backup_prune') > -1);
T('get_backup فایل gz را شفاف باز می‌کند', crmphp.indexOf('readgzfile($f)') > -1);
T('get_backup نام‌های weekly/monthly را می‌پذیرد', crmphp.indexOf('weekly-latest|monthly-latest') > -1);
T('list_backups فایل‌های gz را هم می‌بیند', crmphp.indexOf("glob($bdir . '/*.json.gz')") > -1);

SECTION('US-283: یادآور ماهانه ذخیره بک‌آپ برای رییس هیات مدیره و ادمین');
T('چک یادآور در بوت و بعد از لاگین', bk.indexOf('checkMonthlyBackupReminder(); clearInterval(t)') > -1 && (bk.match(/checkMonthlyBackupReminder\(\)/g) || []).length >= 3);
/* v14.9 (US-383): یادآور بک‌آپ ماهانه به مدیران ارشد (چهار نقش) گسترش یافت */
T('فقط نقش‌های مدیران ارشد', bk.indexOf("['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) < 0) return;") > -1);
T('اعلان به کارتابل هر دو نقش', bk.indexOf("toRoles: ['admin', 'chairman']") > -1 && bk.indexOf('یادآور ماهانه بک‌آپ') > -1);
T('هر ماه فقط یک اعلان (bakMonthlyNotified)', bk.indexOf('bakMonthlyNotified === mk') > -1);
T('دانلود = ثبت انجام وظیفه ماه (bakMonthlySaved)', bk.indexOf('markMonthlySaved') > -1 && bk.indexOf('bakMonthlySaved === mk') > -1);
T('دکمه دانلود بک‌آپ ماهانه سرور', bk.indexOf('ptfDownloadMonthly') > -1 && bk.indexOf('دانلود بک‌آپ ماهانه سرور') > -1);
T('دانلود ماهانه در audit ثبت می‌شود', bk.indexOf('ذخیره ماهانه فایل بک‌آپ انجام شد') > -1);
T('متن باکس تنظیمات به‌روز (چرخشی + وظیفه ماهانه)', bk.indexOf('US-282') > -1 && bk.indexOf('وظیفه ماهانه') > -1);

SECTION('نسخه');
T('VER v12x', /var VER = 'v\d/.test(idx));
T('sw.js cache v12x', /ptf-crm-v\d/.test(sw));
DONE('tester38-v1223');

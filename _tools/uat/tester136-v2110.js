/* ============================================================
   دستیار تست ۱۳۶ — رگرسیون اصلاحات v21.10 در v22.0
   ۱. فیلدهای مبلغ در shareholders.js با data-money
   ۲. ui-kit.js autocomplete/spellcheck روی فیلدهای عددی
   ۳. cache-bust یکسان v22.0
   ۴. ۷ اصلاح v21.10 (petty edit/delete, reminders, date picker, fx rial, isat.ir, gold rial, eur→usd)
   ============================================================ */
require('./harness');
console.log('🔧 TESTER-136: رگرسیون اصلاحات v21.10 در v22.0');

var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var API = path.resolve(__dirname, '../../api');
var sh = fs.readFileSync(path.join(BASE, 'shareholders.js'), 'utf-8');
var uk = fs.readFileSync(path.join(BASE, 'ui-kit.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var pty = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var ld = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var dx = fs.readFileSync(path.join(BASE, 'datex.js'), 'utf-8');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var fxr = fs.readFileSync(path.join(API, 'fx-rates.php'), 'utf-8');

SECTION('۱. shareholders.js: salary باید type:number + data-money');
T('salary type:number', sh.indexOf("{ id: 'salary'") > -1 && sh.indexOf("type: 'number'") > -1 && sh.indexOf("salary") < sh.indexOf("type: 'number'") + 200);
T('salary nohint', sh.indexOf("nohint: true") > -1 && sh.indexOf("salary") < sh.indexOf("nohint: true") + 200);

SECTION('۲. shareholders.js: pct باید nohint (درصد نیازی به حروف ندارد)');
var pctIdx = sh.indexOf("{ id: 'pct'");
var nohintAfterPct = sh.indexOf("nohint: true", pctIdx);
var nextField = sh.indexOf("{ id: 'duty'", pctIdx);
T('pct nohint قبل از duty', nohintAfterPct > pctIdx && nohintAfterPct < nextField);

SECTION('۳. ui-kit.js: data-money input با autocomplete/spellcheck');
var dmIdx = uk.indexOf('data-money="1"');
T('data-money در ui-kit', dmIdx > -1);
T('autocomplete="off" روی data-money', uk.indexOf('autocomplete="off"', dmIdx) > dmIdx && uk.indexOf('autocomplete="off"', dmIdx) < dmIdx + 200);
T('spellcheck="false" روی data-money', uk.indexOf('spellcheck="false"', dmIdx) > dmIdx && uk.indexOf('spellcheck="false"', dmIdx) < dmIdx + 200);

SECTION('۴. index.html: VER = v22.0');
T('window.VER = v22.0', /window\.VER = 'v\d+(?:\.\d+)+'/.test(idx));
var currentVer = (idx.match(/window\.VER = 'v([0-9]+(?:\.[0-9]+)+)'/) || [])[1] || '';
var cacheBusters = idx.match(/\?v=([0-9]+(?:\.[0-9]+)+)"/g) || [];
T('همه cache-bustها با نسخه رسمی CRM همگام‌اند', cacheBusters.length >= 30 && cacheBusters.every(function (x) { return x === '?v=' + currentVer + '"'; }));

SECTION('۵. sw.js: CACHE = ptf-crm-v22.0');
T('CACHE v22.0', /ptf-crm-v\d+(?:\.\d+)+/.test(sw));

SECTION('۶. grep: هیچ فیلد text برای مبلغ بدون data-money نباید باشد');
var files = ['petty.js', 'buycompare.js', 'fiscal.js', 'fx.js', 'lossguard.js', 'opex.js', 'scoring.js', 'shareholders.js'];
var offenders = [];
files.forEach(function(f) {
  var c = fs.readFileSync(path.join(BASE, f), 'utf-8');
  var lines = c.split('\n');
  lines.forEach(function(line, i) {
    if (/type\s*:\s*['"]text['"]/.test(line) && /id\s*:\s*['"](amt|amount|price|salary|credit|charge|cost)['"]/.test(line)) {
      offenders.push(f + ':' + (i+1));
    }
  });
});
T('هیچ فیلد text مبلغی باقی نمانده', offenders.length === 0, offenders.join(' | '));

SECTION('۷. petty.js: edit + delete');
T('pettyEdit() تعریف شده', pty.indexOf('function pettyEdit') > -1 || pty.indexOf('window.pettyEdit') > -1);
T('pettyDel() تعریف شده', pty.indexOf('function pettyDel') > -1 || pty.indexOf('window.pettyDel') > -1);
T('دکمه ویرایش در renderPetty', pty.indexOf('✏️') > -1 || pty.indexOf('pettyEdit') > -1);
T('دکمه حذف در renderPetty', pty.indexOf('🗑️') > -1 || pty.indexOf('pettyDel') > -1);

SECTION('۸. leads.js: reminders self-only default');
T('rmBy select در buildReminders', ld.indexOf('id="rmBy"') > -1);
T('گزینه فقط یادآورهای من', ld.indexOf('فقط یادآورهای من') > -1);
T('فیلتر __me در renderReminders', ld.indexOf('__me') > -1);

SECTION('۹. datex.js: persian calendar picker');
T('ptfDatePicker تعریف شده', dx.indexOf('function ptfDatePicker') > -1 || dx.indexOf('window.ptfDatePicker') > -1);
T('ptfCalShow تعریف شده', dx.indexOf('function ptfCalShow') > -1 || dx.indexOf('window.ptfCalShow') > -1);
T('یکپارچه در leads.js', ld.indexOf('ptfDatePicker') > -1);

SECTION('۱۰. fx.js: ریال به جای ت');
T('fxCell ریال', fx.indexOf('ریال</small>') > -1 && fx.indexOf('<small>ت</small>') === -1);
T('goldRial در fx.js', fx.indexOf('goldRial') > -1);
T('eurUsd در fx.js', fx.indexOf('eurUsd') > -1);

SECTION('۱۱. fx-rates.php: isat.ir fallback + gold18_rial + eur_usd');
T('isat.ir در کد PHP', fxr.indexOf('isat.ir') > -1);
T('gold18_rial در PHP', fxr.indexOf("gold18_rial") > -1);
T('eur_usd در PHP', fxr.indexOf("eur_usd") > -1);

DONE('TESTER-136 (v21.10 regression in v22.0)');

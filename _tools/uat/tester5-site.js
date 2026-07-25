/* ============================================================
   دستیار تست ۵ — «وب‌سایت و ابزارهای عمومی» (نگاه کاربر نهایی)
   چت، مشاور متریال، ابزارهای مهندسی، PWA، ساختار صفحات
   ============================================================ */
require('./harness');
console.log('🌐 TESTER-5: وب‌سایت، چت، مشاور، ابزارها، PWA');

var fs = require('fs');
var path = require('path');
var BASE = path.join(__dirname, '../../') + '/';

SECTION('۱. منشی چت: موتور پاسخ (۱۲ سناریو)');
var chatCode = fs.readFileSync(BASE + 'assets/js/ptf-chat.js', 'utf-8');
eval('var KB = ' + chatCode.match(/var KB = \{[\s\S]*?\n  \};/)[0].slice(9) );
eval(chatCode.match(/function norm\(t\)[\s\S]*?\n  \}/)[0]);
eval(chatCode.match(/function hasAny\(t, keys\)[\s\S]*?\n  \}/)[0]);
eval(chatCode.match(/function answer\(q\)[\s\S]*?\n  \}\n\n  \/\* ----------/)[0].replace(/\n\n  \/\* ----------$/, ''));

[
  ['سلام خسته نباشید', 'دستیار هوشمند'],
  ['بال ولو کلاس ۳۰۰ دارید؟', 'شیرآلات'],
  ['هم کابل میخوام هم پمپ', 'همه این موارد'],
  ['زمان تحویل چقدره', 'زمان تحویل'],
  ['گارانتی چی', 'گارانتی'],
  ['جنس فیک نمیدید؟', 'اصالت'],
  ['ابزار محاسبه سایزینگ دارید', 'ابزارهای مهندسی'],
  ['چه گریدی برای گاز ترش', 'مشاور'],
  ['آدرس دفتر', 'کوهک'],
  ['ساعت کاری', 'شنبه'],
  ['xyz نامفهوم 123', 'کارشناس'],
  ['ممنون خداحافظ', 'خواهش']
].forEach(function (c) {
  var r = answer(c[0]);
  T('چت: «' + c[0].slice(0, 25) + '»', JSON.stringify(r).indexOf(c[1]) > -1, 'انتظار: ' + c[1]);
});

SECTION('۲. مشاور متریال: ۸ خانواده');
require(BASE + 'assets/js/ptf-advisor.js');
var A = global.PTF_ADVISOR;
T('۸ خانواده', A.families.length === 8);
A.families.forEach(function (f) {
  var tree = A.trees[f.id];
  var ans = {};
  tree.qs.forEach(function (q) { ans[q.id] = q.opts[0]; });
  var r = A.decide(f.id, ans);
  T('مشاور ' + f.id + ' خروجی کامل', !!(r && r.grade && r.std && r.note), f.id);
});
// عمق: هر گزینه هر سوال pipe جواب بدهد (پوشش کامل درخت)
var pipe = A.trees.pipe;
var combos = 0, ok = 0;
pipe.qs[0].opts.forEach(function (o1) {
  pipe.qs[1].opts.forEach(function (o2) {
    pipe.qs[2].opts.forEach(function (o3) {
      combos++;
      var r = A.decide('pipe', { fluid: o1, temp: o2, press: o3 });
      if (r && r.grade) ok++;
    });
  });
});
T('پوشش کامل درخت pipe (' + combos + ' ترکیب)', ok === combos);

SECTION('۳. ابزارهای مهندسی: صحت‌سنجی متقاطع');
require(BASE + 'assets/js/ptf-tools.js');
var TL = global.PTF_TOOLS;
// صحت متقاطع: MAWP لوله باید از فشار کلاس فلنج 600 در همان شرایط بیشتر باشد (لوله S80 معمولاً قوی‌تر است)
var mawp = TL.pipePressure({ nps: '4', sch: 'S80', mat: 'cs', T: 38, E: 1, CA: 0 });
T('MAWP لوله 4"S80 > 102bar (کلاس 600)', mawp.P_bar > 102);
// جدول PT فلنج در مشاور و ابزار سازگارند
T('PT 600# در 38C = 102.1 (مطابق مشاور)', A.refs.flangePT.rows[2][1] === '102.1');
// ترک‌تیبل: مجموع منطقی
var tt = TL.trackTable(200, 'linear', 400);
T('ترک‌تیبل ۱۱ ردیف و ۱۰۰٪=Cv کامل', tt.length === 11 && tt[10].cv === 200 && tt[10].q === 400);

SECTION('۴. PWA: فایل‌ها و اتصالات');
T('manifest موجود و معتبر', (function(){ try { var m = JSON.parse(fs.readFileSync(BASE+'crm/manifest.json','utf-8')); return m.display==='standalone'; } catch(e){ return false; } })());
var idx = fs.readFileSync(BASE + 'crm/index.html', 'utf-8');
T('لینک manifest در index', idx.indexOf('rel="manifest"') > -1);
T('apple-touch-icon', idx.indexOf('apple-touch-icon') > -1);
T('باکس نصب', idx.indexOf('pwaInstallBox') > -1);
T('هر ۱۰ اسکریپت CRM لود می‌شوند', ['offers.js','leads.js','rbac.js','storage.js','projects.js','letters.js','analyzer.js','contracts.js','shell.js','xlsx.min.js'].every(function(f){ return idx.indexOf(f) > -1; }));
var sw = fs.readFileSync(BASE + 'crm/sw.js', 'utf-8');
T('SW ثبت می‌شود (shell.js)', fs.readFileSync(BASE+'crm/shell.js','utf-8').indexOf("register('sw.js')") > -1);

SECTION('۵. صفحات کلیدی سایت: ساختار');
[['index.html','پیشرو تجهیز'], ['tools/index.html','ابزارهای مهندسی'], ['assistant/index.html','مشاور'], ['rfq/index.html','استعلام'], ['about/why-ptf/index.html','تایم‌لاین']].forEach(function (p) {
  var h = fs.readFileSync(BASE + p[0], 'utf-8');
  T(p[0] + ' سالم و شامل «' + p[1] + '»', h.indexOf(p[1]) > -1 && h.indexOf('</html>') > -1);
});
T('RFQ پیش‌پرشونده (?item=)', fs.readFileSync(BASE+'rfq/index.html','utf-8').indexOf('URLSearchParams') > -1);
T('چت در صفحه اصلی', fs.readFileSync(BASE+'index.html','utf-8').indexOf('ptf-chat.js') > -1);
T('sitemap شامل tools', fs.readFileSync(BASE+'sitemap.xml','utf-8').indexOf('pishtaj.ir/tools/') > -1);
DONE('TESTER-5 (Site/Public)');

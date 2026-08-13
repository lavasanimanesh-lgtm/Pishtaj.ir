/* tester50 — v13.0 (US-319): نوار موبایل — ترتیب جدید + FAB پیشنهاد + کشوی «سایر» رنگی بدون اسکرول افقی */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mn = fs.readFileSync(path.join(BASE, 'mobilenav.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('ترتیب و ترکیب تب‌ها');
T('ترتیب: داشبورد، کارتابل، پیشنهاد، دستیار، سایر', (function () {
  var i1 = mn.indexOf("id: 'dash'"), i2 = mn.indexOf("id: 'cart'"), i3 = mn.indexOf("id: 'off'"), i4 = mn.indexOf("id: 'ai'"), i5 = mn.indexOf("id: '_more'");
  return i1 > -1 && i1 < i2 && i2 < i3 && i3 < i4 && i4 < i5;
})());
T('برچسب «سایر» (نه بیشتر)', mn.indexOf("lb: 'سایر'") > -1);
T('تب‌های فروش/تامین قدیمی حذف شدند', mn.indexOf("lb: 'فروش'") === -1 && mn.indexOf("lb: 'تامین'") === -1);
T('TAB_OF با ترکیب جدید', mn.indexOf("off: 'off', ai: 'ai'") > -1);

SECTION('FAB پیشنهاد — دایره نیم‌بیرون‌زده');
T('تب off با پرچم fab', mn.indexOf('fab: true') > -1);
T('رندر جدا: mnv-fab + mnv-fabwrap', mn.indexOf('mnv-fabwrap') > -1 && mn.indexOf("class=\"mnv-fab\"") > -1);
T('نیم‌دایره وارد فضای پنل (top:-26px + overflow:visible روی نوار)', mn.indexOf('top:-26px') > -1 && mn.indexOf('#mnvBar{overflow:visible}') > -1);
T('برجسته: گرادیان برند + حلقه سفید + سایه', mn.indexOf('linear-gradient(135deg,var(--pri,#ef4b1a),var(--org,#f79400))') > -1 && mn.indexOf('0 0 0 5px var(--crd,#fff)') > -1);
T('برچسب FAB بولدتر و رنگی', mn.indexOf('mnv-fablb') > -1 && mn.indexOf('font-weight:900!important') > -1);
T('حالت شب FAB (حلقه تیره)', mn.indexOf('body.ptf-dark .mnv-fab') > -1);

SECTION('کشوی «سایر»');
T('آیکون‌های رنگی — پالت چرخشی هماهنگ لانچر', mn.indexOf("var PAL = ['#0ea5e9'") > -1 && mn.indexOf('PAL[i % PAL.length]') > -1);
T('قفل اسکرول افقی شیت', mn.indexOf('overflow-x:hidden;touch-action:pan-y') > -1);
T('گرید بدون سرریز (min-width:0)', mn.indexOf('.mnv-mi{min-width:0}') > -1 && mn.indexOf('max-width:100%;overflow-x:hidden') > -1);

SECTION('نسخه');
T('VER vXX', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('sw cache vXX', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
DONE('tester50-v130');

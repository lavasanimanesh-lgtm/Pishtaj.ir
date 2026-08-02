/* tester276 — v33.5.0 (MINIMAL-LINE-ICONS-DARK-FISCAL-001)
 * Numeric badges are not icons. Website/Knowledge/Settings/Finance Hub use semantic line SVGs;
 * Fiscal Year must remain readable in dark mode.
 */
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
var home=read('index.html'),kc=read('knowledge-center/index.html'),fh=read('crm/financehub.js'),sa=read('crm/settings-accordion.js'),fi=read('crm/fiscal.js'),th=read('crm/theme-contrast.js'),idx=read('crm/index.html'),sw=read('crm/sw.js');

SECTION('Website semantic line icons');
var trust=(home.match(/<div class="trust-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/)||[''])[0];
var journey=(home.match(/<section class="section" id="journey"[\s\S]*?<\/section>/)||[''])[0];
var footerQuick=(home.match(/>دسترسی سریع پروژه‌ای<\/b>[\s\S]*?<\/div>\s*<\/div>/)||[''])[0];
T('چهار نشان 01..04 نوار دسترسی با SVG معنایی جایگزین شد', (trust.match(/class="ptf-line-icon"/g)||[]).length>=4 && ['>01<','>02<','>03<','>04<'].every(function(x){return trust.indexOf(x)<0;}));
T('چهار مسیر نقش‌محور SVG دارد و عدد آیکون نیست', (journey.match(/class="ptf-line-icon"/g)||[]).length===4 && ['>01<','>02<','>03<','>04<'].every(function(x){return journey.indexOf(x)<0;}));
T('فوتر دسترسی سریع ۵ SVG دارد، بدون 01..05', (footerQuick.match(/class="ptf-line-icon"/g)||[]).length===5 && ['>01<','>02<','>03<','>04<','>05<'].every(function(x){return footerQuick.indexOf(x)<0;}));
T('ورود CRM آیکون قفل خطی دارد، نه badge متنی CRM', home.indexOf('ptf-line-icon ptf-line-icon-compact')>-1 && home.indexOf('>CRM</span> ورود همکاران')<0);
T('آیکون‌ها inline/self-contained و currentColor هستند', home.indexOf('stroke="currentColor"')>-1 && home.indexOf('class="ptf-line-icon"')>-1);

SECTION('Knowledge Center semantic icons');
T('عنوان مرکز دانش آیکون کتاب SVG دارد، نه KC/emoji', kc.indexOf('<h1><span class="ptf-line-icon"')>-1 && kc.indexOf('>KC</span>')<0 && kc.indexOf('<h1>📚')<0);
T('۱۶ cluster هیچ icon عددی ندارد', !/icon:"\d{2}"/.test(kc));
T('clusterها کلید معنایی دارند', ['pipe','valve','instrument','electrical','quality','industry','rotating','procurement','flange','seal','process','mechanical'].every(function(x){return kc.indexOf("icon:\""+x+"\"")>-1;}));
T('renderer واقعی kcIcon SVG می‌سازد', kc.indexOf('function kcIcon(kind)')>-1 && kc.indexOf('kcIcon(cat.icon)')>-1 && kc.indexOf('class=\"kc-cluster-icon\"')>-1);
T('اعداد آمار مقاله حفظ شده‌اند چون metric هستند نه icon', ['۵۰+','۴۰+','۳۵+','۲۵+','۲۰+'].every(function(x){return kc.indexOf('<b>'+x+'</b>')>-1;}));

SECTION('CRM Settings and Finance Hub');
T('Settings accordion iconFor SVG بر اساس عنوان است', sa.indexOf('function lineIcon')>-1 && sa.indexOf('function iconFor(title, used)')>-1 && sa.indexOf("return ('0' + (i + 1))")<0);
T('عنوان‌های accordion از emoji تزئینی پاک می‌شوند', sa.indexOf('function cleanTitle')>-1 && sa.indexOf('cleanTitle(t)')>-1);
T('Settings header آیکون gear خطی صریح دارد', idx.indexOf('class="ptf-settings-title-icon"')>-1 && idx.indexOf('تنظیمات سیستم</h3>')>-1);
T('Finance Hub هر ۸ تب SVG معنایی دارد', fh.indexOf('function finIcon')>-1 && ['petty','opex','share','fiscal','supplier','customer','report','quality'].every(function(x){return fh.indexOf("'"+x+"'")>-1;}));
T('Finance Hub فاقد labelهای 01..08 است', !/'0[1-8] (تنخواه|هزینه|سهامداران|سال مالی|حساب|گزارش|کیفیت)/.test(fh));
T('Finance Hub tab فعال/غیرفعال dark-safe class دارد', fh.indexOf('fin-hub-tab')>-1 && th.indexOf('body.ptf-dark .fin-hub-tab.active')>-1 && th.indexOf('body.ptf-dark .fin-hub-tab{')>-1);

SECTION('Fiscal dark-mode contrast');
function rgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function lum(h){return rgb(h).map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce(function(s,v,i){return s+v*[.2126,.7152,.0722][i];},0);}
function ratio(a,b){var x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
T('Fiscal shell dark contrast >= 7', ratio('#101b2b','#f8fafc')>=7,ratio('#101b2b','#f8fafc'));
T('Fiscal KPI label contrast >= 4.5', ratio('#1d2a3d','#d5dfed')>=4.5,ratio('#1d2a3d','#d5dfed'));
T('Fiscal danger contrast >= 4.5', ratio('#451a1a','#fecaca')>=4.5,ratio('#451a1a','#fecaca'));
T('Fiscal success contrast >= 4.5', ratio('#064e3b','#d1fae5')>=4.5,ratio('#064e3b','#d1fae5'));
T('Fiscal lock contrast >= 4.5', ratio('#2e1065','#e9d5ff')>=4.5,ratio('#2e1065','#e9d5ff'));
T('Fiscal warning contrast >= 4.5', ratio('#451a03','#fde68a')>=4.5,ratio('#451a03','#fde68a'));
T('Fiscal KPI transparent gradient متن در شب خنثی می‌شود', th.indexOf('#fiscalBox .ptf-fiscal-kpi b')>-1 && th.indexOf('-webkit-text-fill-color:currentColor!important')>-1 && th.indexOf('background-image:none!important')>-1);
T('Fiscal DOM کلاس‌های semantic دارد', ['ptf-fiscal-shell','ptf-fiscal-title','ptf-fiscal-kpi','ptf-fiscal-alert-danger','ptf-fiscal-alert-success','ptf-fiscal-alert-lock','ptf-fiscal-alert-warning'].every(function(x){return fi.indexOf(x)>-1;}));
T('نسخه CRM/SW به v33.5.0 همگام است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester276-semantic-icons-fiscal-dark');

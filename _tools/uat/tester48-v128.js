/* tester48 — v12.8 (US-316..318): آیکون‌های رنگی + رفع درگ لانچر، اعلانات قرمز اقدام‌محور، فارسی‌سازی UI */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var lc = fs.readFileSync(path.join(BASE, 'launcher.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var ld = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');

SECTION('US-316: لانچر — آیکون‌های رنگی + رفع درگ');
T('پالت ۱۲ رنگی چرخشی', lc.indexOf("var PAL = ['#0ea5e9'") > -1 && lc.indexOf('PAL[i % PAL.length]') > -1);
T('رنگ روی .lch-ic (SVG با currentColor رنگ می‌گیرد)', lc.indexOf('style="color:\' + col + \'"') > -1);
T('v12.9: موتور درگ ghost+FLIP جایگزین شد', lc.indexOf('lch-ghost') > -1 && lc.indexOf('function flip(') > -1);
T('شنونده‌ها روی document (مقاوم به جابجایی DOM)', lc.indexOf("document.addEventListener('pointermove', mv") > -1);
T('لمس: long-press 300ms', lc.indexOf('}, 300)') > -1 && lc.indexOf("pointerType === 'touch'") > -1);

SECTION('US-317: بج قرمز فقط اقدام‌خواه');
T('بج استعلامات: فقط «دریافت اولیه» (نه شمار کل)', idx.indexOf("(i.st||'st1') === 'st1'") > -1 && idx.indexOf("document.getElementById('rBadge').textContent = rfqs.length") === -1);
T('بج استعلامات: صفر = مخفی', idx.indexOf("rB.style.display = rNeedAct ? '' : 'none'") > -1);
T('بج سرنخ‌ها: فقط جدیدِ بدون اقدام', ld.indexOf("l.stage === 'new' && !(l.hist && l.hist.length)") > -1);
T('بج یادآورها اقدام‌محور بود و ماند (سررسید گذشته)', ld.indexOf("r.st === 'open' && r.dueISO <= todayISO()") > -1);
T('بج کارتابل اقدام‌محور بود و ماند (نخوانده‌ها)', fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8').indexOf('readBy || []).indexOf(me) < 0') > -1);

SECTION('US-318: فارسی‌سازی UI (سند چاپی انگلیسی — مصوبه تیم)');
T('دکمه‌ها: فنی/مالی + قالب چاپ فنی-مالی (v20.1 US-442)', of.indexOf('+ پیشنهاد فنی<') > -1 && of.indexOf('+ پیشنهاد مالی<') > -1 && of.indexOf('Techno-Commercial Offer (فنی-مالی)') > -1);
T('هیچ "+ Technical Offer" در تب‌ها نمانده', of.indexOf('+ Technical Offer') === -1 && of.indexOf('+ Commercial Offer') === -1);
T('عنوان مودال فارسی', of.indexOf("'🔧 پیشنهاد فنی' : o.kind === 'TC' ? '🤝 پیشنهاد فنی-مالی' : '💰 پیشنهاد مالی'") > -1);
T('برچسب‌ها: خریدار / شماره درخواست / اقلام', of.indexOf('کارفرما (خریدار) *') > -1 && of.indexOf('شماره درخواست کارفرما * —') > -1 && of.indexOf('>اقلام</h4>') > -1);
T('ستون نوع فهرست: TC = فنی-مالی', of.indexOf("'🤝 فنی-مالی'") > -1);
T('ستون‌های فرم: برچسب فارسی fa', op.indexOf("fa: 'شرح کالا'") > -1 && op.indexOf("fa: 'تعداد'") > -1);
T('فرم داخلی از fa استفاده می‌کند', ol.indexOf('(c.fa || c.lb)') > -1 && ol.indexOf('(cols[c].fa || cols[c].lb)') > -1);
T('قیمت واحد/جمع فارسی در فرم CO', ol.indexOf('قیمت واحد (') > -1 && ol.indexOf('<th>جمع</th>') > -1);
T('سرنخ‌ها بدون (Leads)', ld.indexOf('<h3>🎯 سرنخ‌ها</h3>') > -1);
T('مصوبه تیم: سند چاپی انگلیسی ماند (Item Name/Qty در lb)', op.indexOf("lb: 'Item Name'") > -1 && op.indexOf("return '<th>' + c.lb + '</th>'") > -1);
T('عناوین رسمی اسناد چاپی انگلیسی ماند (v20.1: از printAs)', of.indexOf("_pAs === 'TC' ? 'Techno-Commercial Offer'") > -1);
DONE('tester48-v128');

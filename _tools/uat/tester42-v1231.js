/* tester42 — v123.1: تغییر نام «مشتریان بالقوه»→«سرنخ‌ها» + فیلد سمت گیرنده نامه (US-295/296) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ld = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var lt = fs.readFileSync(path.join(BASE, 'letters.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-295: تغییر نام به «سرنخ‌ها»');
T('عنوان پنل leads', ld.indexOf('سرنخ‌ها (Leads)') > -1);
T('مودال ثبت: «سرنخ جدید»', ld.indexOf('سرنخ جدید') > -1 && ld.indexOf('مشتری بالقوه جدید') === -1);
T('برچسب سایدبار', idx.indexOf('<span class="ic">🎯</span><span class="lb">سرنخ‌ها</span>') > -1);
T('عنوان goPanel', idx.indexOf("leads:'🎯 سرنخ‌ها'") > -1);
T('هیچ «مشتریان بالقوه» باقی نمانده (crm)', ld.indexOf('مشتریان بالقوه') === -1 && idx.indexOf('مشتریان بالقوه') === -1);
T('راهنمای اکسل LEADS به‌روز', idx.indexOf('دستورالعمل ورود اکسل سرنخ‌ها (LEADS)') > -1);

SECTION('US-296: فیلد سمت گیرنده در نامه صادره');
T('فیلد ltToRole در مودال ثبت نامه', lt.indexOf('id="ltToRole"') > -1 && lt.indexOf('سمت گیرنده') > -1);
T('جمع‌آوری toRole در _collectLetter', lt.indexOf("l.toRole = ((document.getElementById('ltToRole')") > -1);
T('رندر: سمت دقیقا زیر نام گیرنده', lt.indexOf("escP(l.to) + '</div>' +") > -1 && /to\) \+ '<\/div>' \+\s*\n?\s*\(l\.toRole \? '<div class="torl">'/.test(lt));
T('نامه بدون سمت: div اضافه چاپ نمی‌شود', lt.indexOf("(l.toRole ? '<div class=\"torl\">'") > -1);
T('CSS سمت: ظریف‌تر از نام + چسبیده به آن', lt.indexOf(".to{font-weight:700;font-size:' + tfs + 'pt;margin-bottom:0.5mm}") > -1 && lt.indexOf('.torl{font-weight:600') > -1);
T('سازگاری عقب‌رو: نامه‌های قدیمی (بدون toRole) سالم', lt.indexOf("l ? escP(l.toRole || '')") > -1);

SECTION('نسخه');
T('VER v12x', /var VER = 'v\d/.test(idx));
T('sw cache v12x', /ptf-crm-v\d/.test(sw));
DONE('tester42-v1231');

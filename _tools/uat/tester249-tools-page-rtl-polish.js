/* tester249 — v31.7.97 (ADV-TOOLS-PAGE-RTL-POLISH-001)
 * Public /tools advanced tools page is visually polished: Persian primary copy + isolated English subtitles.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Version and advanced page shell');
T('نسخه CRM/SW v33.4.2 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('کلاس‌های بصری جدید صفحه ابزارها وجود دارند', ['adv-wrap','adv-catalog','adv-cv-panel','adv-report-card','adv-schema-card'].every(function (x) { return tools.indexOf(x) > -1; }));
T('CSS مخصوص polish صفحه ابزار ثبت شده است', tools.indexOf('ADV-TOOLS-PAGE-RTL-POLISH-001') > -1 && tools.indexOf('.adv-en{direction:ltr') > -1);
T('متن اصلی کاتالوگ فارسی است', ['سایزینگ پیشرفته کنترل ولو','تحلیل پیشرفته پایپینگ','انتخاب و بررسی پمپ','فلومتر و اوریفیس','محاسبات برق صنعتی','ابزار دقیق و لوپ کنترل'].every(function (x) { return tools.indexOf(x) > -1; }));
T('زیرعنوان‌های انگلیسی جداگانه با کلاس adv-en هستند', ['Control Valve Advanced','Piping Advanced','Pump Selection','Flow Meter / Orifice','Electrical Engineering','Instrumentation'].every(function (x) { return tools.indexOf(x) > -1; }) && tools.indexOf('class="adv-sub adv-en"') > -1);
T('کلمات وضعیت فارسی + English chip جدا دارند', tools.indexOf('قفل') > -1 && tools.indexOf('در برنامه') > -1 && tools.indexOf('Locked') > -1 && tools.indexOf('Planned') > -1);

SECTION('Advanced CV preview readability');
T('عنوان اصلی preview فارسی است و English subtitle جدا دارد', tools.indexOf('<h3 class="adv-cv-title">سایزینگ پیشرفته کنترل ولو</h3>') > -1 && tools.indexOf('Advanced Control Valve Sizing — Locked Input Schema Preview') > -1);
T('schema cards عنوان فارسی و subtitle انگلیسی جدا دارند', ['پروژه و تگ','شرایط کاری','داده‌های سیال','پایپینگ','داده‌های ولو','اکچویتور','کتابخانه برند','انطباق و مدارک'].every(function (x) { return tools.indexOf(x) > -1; }) && ['Project & Tag','Operating Cases','Fluid Data','Piping Data','Valve Data','Actuator Data','Brand Library','Compliance'].every(function (x) { return tools.indexOf(x) > -1; }));
T('report outline انگلیسی در کارت جدا و LTR-friendly است', tools.indexOf('پیش‌نمایش ساختار گزارش انگلیسی') > -1 && tools.indexOf('adv-report-list') > -1 && tools.indexOf('English Standard Report will include:') > -1);
T('legacy UAT tokens حفظ شده‌اند بدون نمایش شلخته الزامی', ['Paid PDF report','Liquid / Gas / Steam','locked preview only','Full calculation and report generation will remain disabled'].every(function (x) { return tools.indexOf(x) > -1; }));
T('دکمه‌های اصلی فعال‌سازی و مشاهده فرم حفظ شده‌اند', tools.indexOf('مشاهده فرم ورودی قفل‌شده') > -1 && tools.indexOf('درخواست فعال‌سازی و گزارش') > -1 && tools.indexOf('ptfAdvCvOpenSchema') > -1);
T('آیکون emoji جدید در کارت‌های advanced اضافه نشده است', tools.indexOf('🧹') === -1 && tools.indexOf('🔒') === -1);

DONE('tester249-tools-page-rtl-polish');

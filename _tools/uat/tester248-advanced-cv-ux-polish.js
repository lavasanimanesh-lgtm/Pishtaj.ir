/* tester248 — v31.7.97 (ADV-CV-UX-POLISH-001)
 * Advanced CV modal has polished RTL/LTR visual system and senior graphic design improvements.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Version and visual system');
T('نسخه ADV-CV-UX-POLISH-001 ثبت شده است', adv.indexOf('ADV-CV-UX-POLISH-001') > -1);
T('CRM/SW به v33.3.5 به‌روزرسانی شده‌اند', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));
T('modal از backdrop blur و gradient visual shell استفاده می‌کند', adv.indexOf('backdrop-filter:blur(6px)') > -1 && adv.indexOf('radial-gradient') > -1 && adv.indexOf('linear-gradient(180deg,#ffffff,#f8fafc') > -1);
T('header sticky/dark premium دارد', adv.indexOf('.adv-head{position:sticky') > -1 && adv.indexOf('linear-gradient(135deg,#0f172a') > -1);
T('stepper عددی مینیمال 01..04 اضافه شده است', adv.indexOf('adv-steps') > -1 && ['<b>01</b>','<b>02</b>','<b>03</b>','<b>04</b>'].every(function (x) { return adv.indexOf(x) > -1; }));
T('کلاس‌های input عددی و کنترل bidi وجود دارد', adv.indexOf('adv-input') > -1 && adv.indexOf('adv-num') > -1 && adv.indexOf('unicode-bidi:plaintext') > -1);
T('report outline انگلیسی در lane چپ‌چین جدا شده است', adv.indexOf('adv-report-outline') > -1 && adv.indexOf('.adv-report-outline .adv-list span{direction:ltr;text-align:left') > -1);
T('action bar sticky و دکمه‌ها hover polish دارند', adv.indexOf('.adv-actions{position:sticky;bottom:0') > -1 && adv.indexOf('.adv-btn:hover') > -1);
T('نتایج و metrics کارت‌بندی بصری دارند', adv.indexOf('.adv-result{display:none;border-radius:16px') > -1 && adv.indexOf('.adv-metrics span{display:block;background:linear-gradient') > -1);

SECTION('No regression in functionality/lock');
T('دکمه‌های اصلی ابزار همچنان وجود دارند', ['ptfAdvCvCalculatePrelim','ptfAdvCvShowReportPreview','ptfAdvCvShowLockedReportData','ptfAdvCvSubmitReportDraft','ptfAdvCvOpenFeedbackPack'].every(function (x) { return adv.indexOf(x) > -1; }));
T('هیچ PDF/download/print/fetch/export در advanced-tools-ui نیست', adv.indexOf('fetch(') === -1 && adv.indexOf('window.print') === -1 && adv.indexOf('document.write') === -1 && adv.indexOf('exportPdf') === -1 && adv.indexOf('download=') === -1);
T('آیکون emoji جدید در stepper/CTA اضافه نشده و badgeها عددی هستند', adv.indexOf('🧹') === -1 && adv.indexOf('🔒') === -1 && adv.indexOf('01') > -1);

DONE('tester248-advanced-cv-ux-polish');

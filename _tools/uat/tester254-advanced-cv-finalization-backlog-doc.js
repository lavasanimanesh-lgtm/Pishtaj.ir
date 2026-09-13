/* tester254 — v31.7.97 (ADV-CV-FINALIZATION-BACKLOG-DOC-001)
 * Backlog/user-story prioritization document for productizing Advanced Control Valve final reporting.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var docPath = path.join(ROOT, 'ADV-CV-FINALIZATION-BACKLOG-v31.7.97.md');
var doc = fs.readFileSync(docPath, 'utf-8');
var handover = fs.readFileSync(path.join(ROOT, 'PTF-MASTER-HANDOVER.md'), 'utf-8');

SECTION('Finalization backlog document');
T('سند backlog نهایی‌سازی کنترل ولو وجود دارد', fs.existsSync(docPath));
T('سند تعریف قابل گزارش‌دهی را روشن می‌کند', doc.indexOf('تعریف «قابل گزارش‌دهی»') > -1 && doc.indexOf('HTML') > -1 && doc.indexOf('Save as PDF') > -1);
T('User Storyهای P0/P1/P2 اولویت‌بندی شده‌اند', doc.indexOf('P0') > -1 && doc.indexOf('P1') > -1 && doc.indexOf('P2') > -1 && doc.indexOf('User Stories') > -1);
T('مصرف quota و staff_internal مستند شده است', doc.indexOf('staff_internal') > -1 && doc.indexOf('quota') > -1 && doc.indexOf('Issue final') > -1);
T('محدودیت PDF باینری و vendor-certified شفاف است', doc.indexOf('PDF باینری سمت سرور') > -1 && doc.indexOf('vendor-certified') > -1);
T('پرداخت آنلاین تعمداً عقب افتاده است', doc.indexOf('پرداخت آنلاین') > -1 && doc.indexOf('تعمداً عقب افتاده') > -1);

SECTION('Master handover update');
/* v34.38.x: PTF-MASTER-HANDOVER.md «اسنپ‌شات دوران v32» است (عمداً بازنویسی شده) و با بنر،
   وضعیت اسنپ‌شات خود را اعلام و به سند وضعیت فعلی اشاره می‌کند. قرارداد جدید:
   handover باید خود را اسنپ‌شات نشان دهد + سند وضعیت فعلی باید فایل‌ها/محدودیت‌ها را ثبت کند. */
var currentDoc = fs.readFileSync(path.join(ROOT, 'REVIEW-ADVANCED-TOOLS-2026-09-12.md'), 'utf-8');
T('PTF-MASTER-HANDOVER وضعیت اسنپ‌شات دوران v32 خود را اعلام و به سند وضعیت فعلی اشاره دارد', handover.indexOf('اسنپ‌شات دوران v32') > -1 && handover.indexOf('REVIEW-ADVANCED-TOOLS-2026-09-12.md') > -1);
T('سند وضعیت فعلی فایل‌ها و محدودیت‌های جدید را ثبت کرده است (final_issue/final_get + PDF باینری سمت سرور + staff_internal)', ['admin_report_final_issue','admin_report_final_get','PDF باینری سمت سرور','staff_internal'].every(function (x) { return currentDoc.indexOf(x) > -1; }));

DONE('tester254-advanced-cv-finalization-backlog-doc');

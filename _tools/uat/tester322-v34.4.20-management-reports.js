/* tester322 — گزارش‌های دوره‌ای مدیریت */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var mi=fs.readFileSync(path.join(BASE,'management-intelligence.js'),'utf8');
var sy=fs.readFileSync(path.join(BASE,'sync.js'),'utf8');
var api=fs.readFileSync(path.resolve(__dirname,'../../api/crm.php'),'utf8');
var bk=fs.readFileSync(path.join(BASE,'backup.js'),'utf8');
SECTION('گزارش‌های دوره‌ای');
T('کلید مستقل history گزارش تعریف شده', mi.indexOf("REPORT_KEY = 'ptf_crm_management_reports'")>-1);
T('تولید گزارش هفتگی/ماهانه و PDF snapshot وجود دارد', mi.indexOf('ptfManagementReportGenerate')>-1 && mi.indexOf('ptfManagementReportPdf')>-1 && mi.indexOf("kind==='monthly'")>-1);
T('تنظیم برنامه و check روز مقرر وجود دارد', mi.indexOf('ptfManagementReportScheduleOpen')>-1 && mi.indexOf('ptfManagementReportCheck')>-1 && mi.indexOf('management_report')>-1);
T('تاریخچه گزارش در تصمیم‌یار نمایش داده می‌شود', mi.indexOf('mgmtReportHistory')>-1 && mi.indexOf('reportHistoryHtml')>-1);
SECTION('ماندگاری');
T('گزارش‌ها در sync و allowlist سرور هستند', sy.indexOf('ptf_crm_management_reports')>-1 && api.indexOf('ptf_crm_management_reports')>-1);
T('گزارش‌ها در backup هستند', bk.indexOf('ptf_crm_management_reports')>-1);
DONE('tester322-v34.4.20-management-reports');

/* tester261 — v31.7.97 (ADV-CV-GTM-FEEDBACK-SALES-PLAN-001)
 * GTM, feedback and fair sales plan for Advanced Control Valve.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var docPath = path.join(ROOT, 'ADV-CV-GTM-FEEDBACK-SALES-PLAN-v31.7.97.md');
var doc = fs.readFileSync(docPath, 'utf-8');
var handover = fs.readFileSync(path.join(ROOT, 'PTF-MASTER-HANDOVER.md'), 'utf-8');

SECTION('GTM and fair sales plan');
T('سند GTM/feedback/sales plan وجود دارد', fs.existsSync(docPath));
T('پلن جذب کاربر و feedback دارد', ['جذب کاربران','feedback','فاز ۱','فاز ۲','KPI'].every(function(x){ return doc.indexOf(x) > -1; }));
T('پلن فروش منصفانه tier دارد', ['Free Preview','Single Final Report','5-Report Pack','Monthly Engineering Access','Enterprise','Staff/Internal'].every(function(x){ return doc.indexOf(x) > -1; }));
T('سیاست منصفانه quota/final gate را توضیح می‌دهد', doc.indexOf('اگر final gate مسدود شد، گزارش فروخته‌شده محسوب نشود') > -1 && doc.indexOf('محاسبه پایه و آموزش رایگان') > -1);
T('roadmap دیتاشیت upload/OCR دارد', ['Datasheet Upload','TXT/CSV/JSON','PDF text extraction','OCR','LLM-assisted extraction'].every(function(x){ return doc.indexOf(x) > -1; }));
T('Search Console action ذکر شده است', doc.indexOf('Google Search Console') > -1 && doc.indexOf('request indexing') > -1);
T('handover نسخه v31.7.97 را ثبت کرده است', handover.indexOf('v31.7.97 — BUG-FISCAL-PROFIT-ICON-UX-001') > -1);

DONE('tester261-advanced-cv-gtm-sales-plan');

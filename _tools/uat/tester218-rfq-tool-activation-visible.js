/* tester218 — v31.7.41 (ADV-TOOLS-RFQ-ACTIVATION-001)
 * Activation requests from advanced tools must be visibly represented inside smart RFQ.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var rfq = fs.readFileSync(path.join(ROOT, 'rfq/index.html'), 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'tools/tools-ui.js'), 'utf-8');

SECTION('RFQ activation mode');
T('RFQ query parser پارامتر activation/tool/item را می‌خواند', rfq.indexOf("params.get('activation')") > -1 && rfq.indexOf("params.get('tool')") > -1 && rfq.indexOf("params.get('item')") > -1);
T('درخواست فعال‌سازی ابزار در RFQ با بنر واضح نمایش داده می‌شود', rfq.indexOf('ADV-TOOLS-RFQ-ACTIVATION-001') > -1 && rfq.indexOf('درخواست فعال‌سازی ابزارهای پیشرفته') > -1 && rfq.indexOf('صدور/فعال‌سازی کد لایسنس') > -1);
T('category مخفی به فعال‌سازی ابزار تغییر می‌کند', rfq.indexOf("hiddenCategory').value = 'فعال‌سازی ابزارهای پیشرفته مهندسی'") > -1);
T('subject اختصاصی فعال‌سازی ساخته و انتخاب می‌شود', rfq.indexOf('درخواست فعال‌سازی ابزارهای پیشرفته PTF') > -1 && rfq.indexOf('subj.insertBefore') > -1);
T('فیلدهای technical/vendor/message برای درخواست لایسنس پر می‌شوند', rfq.indexOf('ADV-TOOLS-LICENSE | Manual activation') > -1 && rfq.indexOf('Tool: ') > -1 && rfq.indexOf('Requested item: ') > -1);
T('در activation mode دسته‌های تجهیز قفل می‌شوند تا کاربر دنبال گزینه کالایی نگردد', rfq.indexOf("i.classList.add('locked-out')") > -1);

SECTION('Tools activation links');
T('لینک اصلی فعال‌سازی ابزارها پارامتر activation=tools دارد', tools.indexOf('../rfq/?activation=tools&tool=all&item=Advanced%20Engineering%20Tools%20License') > -1);
T('Paywall ابزارها لینک فعال‌سازی RFQ را با activation=tools می‌سازد', ui.indexOf("../rfq/?activation=tools&tool=advanced_report&item=") > -1);
T('متن CTA فعال‌سازی در ابزارها حفظ شده است', tools.indexOf('درخواست فعال‌سازی') > -1 && ui.indexOf('درخواست فعال‌سازی از طریق RFQ') > -1);

DONE('tester218-rfq-tool-activation-visible');

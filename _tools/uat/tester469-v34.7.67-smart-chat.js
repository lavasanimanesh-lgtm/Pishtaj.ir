#!/usr/bin/env node
'use strict';
/* v34.8.7 — چت هوشمند ارتقایافته.
   قرارداد: (۱) وضعیت درخواست/سفارش داخل چت از track خوانده می‌شود (بدون توکن)؛
   (۲) سهمیهٔ توکن مجزای چت عمومی (ptf_chat_public_quota.json) — نه ai_quota.json؛
   (۳) RAG از search-index.json + چندزبانه fa/en/ar؛ (۴) «ارسال به کارشناس» → chat_lead
   عمومی واقعی در crm.php؛ (۵) وضعیت سفارش در track بدون نشت محرمانگی. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var chat = read('assets/js/ptf-chat.js');
var llm = read('api/chat-llm.php');
var crm = read('api/crm.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.7', ver.crm_version === 'v34.8.7', ver.crm_version);

/* سهمیهٔ توکن مجزای چت عمومی */
T('سهمیهٔ جدا (ptf_chat_public_quota.json)', llm.indexOf('ptf_chat_public_quota.json') > -1);
T('سهمیهٔ CRM (ai_quota.json) مصرف نمی‌شود', !/\$quotaFile\s*=.*ai_quota/.test(llm));
T('سقف روزانهٔ سراسری + per-IP', llm.indexOf('GLOBAL_DAILY') > -1 && llm.indexOf('IP_DAILY') > -1);

/* RAG + چندزبانه */
T('بازیابی از search-index.json', llm.indexOf('search-index.json') > -1);
T('تشخیص زبان fa/en/ar در سرور', llm.indexOf("'ar'") > -1 && llm.indexOf('$langName') > -1);
T('پشتیبانی Gemini + OpenAI', llm.indexOf("'gemini'") > -1 && llm.indexOf('chat/completions') > -1);

/* وضعیت داخل چت (بدون توکن) */
T('تشخیص کد رهگیری در کلاینت', chat.indexOf('function trackingCode(q)') > -1);
T('پرسش وضعیت (isStatusAsk)', chat.indexOf('function isStatusAsk(q)') > -1);
T('دریافت وضعیت از track', chat.indexOf("api/crm.php?action=track&code=") > -1);
T('نمایش مراحل سفارش (order.stages)', chat.indexOf('d.order.stages') > -1);
T('تشخیص زبان در کلاینت (عربی)', chat.indexOf('function detectLang(q)') > -1 && chat.indexOf("return 'ar'") > -1);
T('عربی در موتور محلی (بدون توکن)', chat.indexOf('مرحبا') > -1 && chat.indexOf('isAr') > -1);

/* لید واقعی به CRM */
T('ارسال به کارشناس → chat_lead', chat.indexOf('action=chat_lead') > -1);
T('chat_lead در اکشن‌های عمومی crm.php', crm.indexOf("'chat_lead'") > -1);
T('chat_lead rate-limited', crm.indexOf("'chat_lead' => 10") > -1);
T('chat_lead لید در ptf_crm_leads ذخیره می‌کند', crm.indexOf("save_data('ptf_crm_leads'") > -1);

/* وضعیت سفارش بدون محرمانگی */
T('track وضعیت سفارش را برمی‌گرداند (order)', crm.indexOf("'order' => $order") > -1);
T('مراحل عمومی سفارش بدون مبلغ', crm.indexOf("'won' => 'سفارش شما ابلاغ شد") > -1 && crm.indexOf("'settle' => 'تحویل و تسویه") > -1);

T('tester469 در گیت CI', gate.indexOf('tester469-v34.7.67-smart-chat.js') > -1);

console.log('\n— tester469 (v34.8.7: چت هوشمند ارتقایافته) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

#!/usr/bin/env node
'use strict';
/* v34.8.3 — چت هوشمند فاز ۴.
   قرارداد: کارت‌های غنی (مقاله/پیشرفت)، استریم پاسخ با fallback، هنداف واتس‌اپ/تلگرام،
   ثبت تحلیلی نیت، و سهمیهٔ توکن مجزا (بدون مصرف ai_quota). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var chat = read('assets/js/ptf-chat.js');
var llm = read('api/chat-llm.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.3', ver.crm_version === 'v34.8.3', ver.crm_version);

/* کارت‌های غنی */
T('رندر کارت مقاله', chat.indexOf("c.type === 'article'") > -1);
T('رندر کارت پیشرفت سفارش', chat.indexOf("c.type === 'progress'") > -1);
T('کارت پیشرفت وضعیت در botReply', chat.indexOf("{ type: 'progress', stages: d.order.stages") > -1);
T('CSS کارت‌ها', chat.indexOf('.ptfc-card-art') > -1 && chat.indexOf('.ptfc-step.done') > -1);
T('addCards پیوست کارت‌ها را می‌افزاید', chat.indexOf('function addCards(el, cards)') > -1);

/* استریم + fallback */
T('تابع استریم (askLLMStream)', chat.indexOf('function askLLMStream(') > -1);
T('استریم از streamGenerateContent یا stream:true', llm.indexOf('streamGenerateContent') > -1 || llm.indexOf("'stream' => true") > -1);
T('fallback به غیراستریم', chat.indexOf('fallback به مسیر غیراستریم') > -1);
T('پروکسی حالت stream=1 را می‌پذیرد', llm.indexOf('$stream = !empty($in[\'stream\'])') > -1);

/* هنداف واتس‌اپ/تلگرام */
T('هنداف واتس‌اپ', chat.indexOf('wa.me/989925868479') > -1);
T('هنداف تلگرام', chat.indexOf('t.me/') > -1);
T('تابع addHandoff', chat.indexOf('function addHandoff(el)') > -1);

/* ثبت تحلیلی */
T('ثبت تحلیلی نیت (ptf_chat_analytics.json)', llm.indexOf('ptf_chat_analytics.json') > -1);
T('نیت‌ها: status/kb/chat', llm.indexOf("'status' : (count($cards) ? 'kb' : 'chat')") > -1);
T('بدون دادهٔ شخصی (فقط متن کوتاه)', llm.indexOf('mb_substr($q, 0, 120)') > -1);

/* کارت‌ها از RAG در پاسخ غیراستریم */
T('پاسخ غیراستریم کارت مقاله برمی‌گرداند', llm.indexOf("'cards' => $cards") > -1);
T('CTA استعلام در پاسخ', llm.indexOf("['label' => 'ثبت استعلام'") > -1);

/* سهمیهٔ مجزا حفظ شده */
T('سهمیهٔ جدا (ptf_chat_public_quota.json)', llm.indexOf('ptf_chat_public_quota.json') > -1);
T('سهمیهٔ CRM مصرف نمی‌شود', !/\$quotaFile\s*=.*ai_quota/.test(llm));

T('tester470 در گیت CI', gate.indexOf('tester470-v34.7.68-smart-chat-phase4.js') > -1);

console.log('\n— tester470 (v34.8.3: چت فاز ۴ — کارت/استریم/هنداف/تحلیل) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

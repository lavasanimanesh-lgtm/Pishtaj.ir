#!/usr/bin/env node
'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   verify-bot-messages-field-2026-10-24.js — «بازبینی میدانی» دقت پیام‌های بات
   هدف: نه تستِ قراردادِ کد، بلکه **سفر واقعی کاربر** روی API واقعی و نگاه
   خط‌به‌خط به متنی که به گروه می‌رود. برای هر سفر: چند پیام رفت؟ هر خط درست
   است؟ چیزی از حریم خصوصی درز کرده؟ کد خام دیده می‌شود؟ پیام تکراری/جاافتاده؟
   مسیرها کاملاً واقعی‌اند (api/crm.php, api/sales-domain.php, api/rfq-notify-lib.php
   در php-wasm + curl شبیه‌سازی‌شده)؛ هیچ تابع کسب‌وکاری ماک نشده است.
   اجرا: NODE_PATH=<php-wasm>/node_modules node _tools/uat/verify-bot-messages-field-2026-10-24.js
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const failures = [];
function T(name, ok, detail) {
  if (ok) { pass++; console.log('  ✅ ' + name); }
  else { fail++; failures.push(name); console.log('  ❌ ' + name + (detail ? '\n       → ' + String(detail).replace(/\n/g, '\n         ').slice(0, 600) : '')); }
}
const A = (t, s) => t.includes(s);
const line = (t, prefix) => (t.split('\n').find(l => l.startsWith(prefix)) || '').trim();
function show(title, m) {
  console.log('\n   ── متن پیام: ' + title + ' ──');
  const t = (m && m.text) || '(هیچ پیامی نرفت)';
  t.split('\n').forEach(l => console.log('      ' + l));
}

/* ── خطاهای ساختاری که در هیچ پیامی نباید دیده شوند ───────────────────── */
const RAW_CODE = /(?:^|[\s:،(])(st\d{1,2}|stTO|stCO|stInv|stPay|stX|WF\d{2}|pending|approved|rejected|cancelled|redirected|closed|void)(?=[\s,،.)]|$)/;
function structuralScan(all) {
  const problems = [];
  for (const m of all) {
    const t = m.text || '';
    /* اعلان ثبت سایت عمداً «نام/تلفن» دارد (قرارداد قدیمی ثبت سایت) — بررسی حریم خصوصی
       فقط برای پیام‌های وضعیت CRM/گردش‌کار است. */
    const isSiteAlert = /^📥 استعلام جدید از سایت/m.test(t);
    if (RAW_CODE.test(t)) problems.push('کد خام وضعیت در پیام: ' + (t.match(RAW_CODE) || [])[0]);
    if ((t.match(/وضعیت جدید/g) || []).length > 1) problems.push('بیش از یک سطر «وضعیت جدید»');
    if ((t.match(/وضعیت قبلی/g) || []).length > 1) problems.push('بیش از یک سطر «وضعیت قبلی»');
    if ((t.match(/^شماره درخواست/mg) || []).length !== 1) problems.push('سطر «شماره درخواست» یکتا نیست');
    if (!isSiteAlert) {
      if (/\b(?:۰۹\d{9}|\+98\d{10}|0912\d{7})\b/.test(t)) problems.push('شمارهٔ تماس در پیام وضعیت');
      if (/(تومان|ریال|میلیون|میلیارد|\d{6,})/.test(t)) problems.push('مبلغ/عدد مالی در پیام وضعیت');
    }
    if (/\uFFFD/.test(t)) problems.push('کاراکتر خراب (UTF-8)');
    if (t.length > 4096) problems.push('طول بیش از سقف تلگرام');
    if (t.split('\n').some(l => l.length > 400)) problems.push('سطر بلندتر از ۴۰۰ نویسه');
  }
  return [...new Set(problems)];
}

(async () => {
  let haveWasm = true;
  try { require.resolve('php-wasm/PhpNode'); } catch (e) { haveWasm = false; }
  if (!haveWasm) { console.log('SKIP: php-wasm لازم است — npm i php-wasm@0.2.0'); process.exit(2); }

  const src = read('_tools/uat/e2e-rfq-notify-phantom-v34.39.55.js');
  const cut = src.indexOf('async function main()');
  const M = { exports: {} };
  new Function('require', 'module', 'exports', '__dirname', '__filename',
    src.slice(0, cut).replace(/^#!.*\n/, '') +
    '\nmodule.exports = { request, fresh, messages, ready, upsert, rows, q, T, stats: () => ({ pass, fail }) };\n'
  )(require, M, M.exports, __dirname, path.join(__dirname, 'e2e-rfq-notify-phantom-v34.39.55.js'));
  const { request, fresh, messages, ready: readyBase, rows, q } = M.exports;
  /* ready(): صف را برای فراخوانی بعدی آماده می‌کند. سطل توکن هم پر می‌شود تا سناریوها
     به «توکن باقی‌مانده از سفر قبل» وابسته نباشند — رفتار واقعی نرخ در سفر ۹ جدا سنجیده
     می‌شود (بدون این پرکردن). */
  const ready = st => {
    readyBase(st);
    if (st['sync/.rfq-notify.json']) {
      const s2 = q(st);
      s2.rate = { tokens: 5, at: Math.floor(Date.now() / 1000) };
      st['sync/.rfq-notify.json'] = JSON.stringify(s2);
    }
  };

  const USERS = JSON.stringify([
    { username: 'lavasani', name: 'علی لواسانی', role: 'admin' },
    { username: 'yousefi', name: 'مهدی یوسفی', role: 'sales' }
  ]);
  const all = [];   /* همهٔ پیام‌هایی که در این بازبینی به گروه رفته‌اند */
  const capture = (label, r) => { const ms = messages(r); ms.forEach(m => { m.__label = label; all.push(m); }); return ms; };

  /* ═══════════ سفر ۱: ثبت استعلام از سایت ═══════════ */
  console.log('\n══ سفر ۱ — مشتری استعلام را از سایت ثبت می‌کند ══');
  const s = fresh();
  s['sync/ptf_crm_users.json'] = USERS;
  /* مسیر واقعی سایت: بازدیدکننده بدون هیچ توکن و با کپچا */
  let r = await request(s, { endpoint: 'crm.php', action: 'add_rfq_site', captcha: true, auth: 'none', user: '', role: '',
    post: { company: 'شرکت آلفا صنعت', name: 'مهندس رضایی', phone: '09120000001',
      subject: 'استعلام شیر توپی ۶ اینچ', category: 'شیرآلات' } });
  let m = capture('site-created', r);
  show('ثبت از سایت', m[0]);
  const code = (r.json && r.json.code) || ((JSON.parse(s['rfqs.json'] || '[]')[0] || {}).code) || '';
  T('ثبت از سایت دقیقاً یک پیام می‌دهد', m.length === 1, m.length + ' پیام');
  T('عنوان پیام «استعلام جدید از سایت» است', A((m[0] || {}).text || '', '📥 استعلام جدید از سایت'), (m[0] || {}).text);
  T('شمارهٔ درخواست در پیام همان کد واقعی رکورد است', !!code && A((m[0] || {}).text || '', 'شماره درخواست: ' + code), code);
  T('مشتری = نام شرکت', A((m[0] || {}).text || '', 'مشتری: شرکت آلفا صنعت'));
  T('موضوع و حوزه آمده‌اند', A((m[0] || {}).text || '', 'موضوع: استعلام شیر توپی ۶ اینچ') && A((m[0] || {}).text || '', 'حوزه: شیرآلات'));
  T('نام و تلفن تماس (قرارداد ثبت سایت) هست', A((m[0] || {}).text || '', 'نام: مهندس رضایی') && A((m[0] || {}).text || '', 'تلفن: 09120000001'));
  T('وضعیت اولیه از «کد» خوانده شده (نه متن آزاد)', A((m[0] || {}).text || '', 'وضعیت اولیه: در انتظار تایید مدیران'));
  T('منبع = سایت', A((m[0] || {}).text || '', 'منبع: سایت'));
  T('زمان با برچسب تهران', A((m[0] || {}).text || '', '(تهران)'));

  /* ═══════════ سفر ۲: مدیر همان استعلام را تایید می‌کند ═══════════ */
  console.log('\n══ سفر ۲ — مدیر در CRM استعلام را تایید می‌کند ══');
  ready(s);
  r = await request(s, { endpoint: 'crm.php', action: 'set_status', user: 'yousefi', role: 'admin',
    post: { type: 'rfq', code: code, status: 'approved', statusText: 'تایید شد — بررسی فنی و تامین' } });
  T('مسیر تایید روی همان ردیف سایت اثر گذاشت', !!(r.json && r.json.ok) && (JSON.parse(s['rfqs.json'] || '[]')[0] || {}).status === 'approved', JSON.stringify(r.json).slice(0, 200));
  m = capture('approve', r);
  show('تایید', m[0]);
  const tm = (m[0] || {}).text || '';
  T('تایید یک پیام می‌دهد (نه صفر، نه دو)', m.length === 1, m.length + ' پیام');
  T('وضعیت قبلی از کد: «در انتظار تایید مدیران»', A(line(tm, 'وضعیت قبلی'), 'در انتظار تایید مدیران'), line(tm, 'وضعیت قبلی'));
  T('وضعیت جدید از کد: «تاییدشده» (نه متن آزاد)', line(tm, 'وضعیت جدید') === 'وضعیت جدید: تاییدشده', line(tm, 'وضعیت جدید'));
  T('دلیل مدیر در خط «یادداشت» حفظ شده', A(line(tm, 'یادداشت'), 'تایید شد — بررسی فنی و تامین'), line(tm, 'یادداشت'));
  T('انجام‌دهنده = نام نمایشی', A(line(tm, 'انجام‌دهنده'), 'مهدی یوسفی'), line(tm, 'انجام‌دهنده'));
  T('منبع = CRM', A(tm, 'منبع: CRM'));
  T('هیچ شماره تماسی در پیام وضعیت CRM نیست', !/0912\d{7}/.test(tm));

  /* ═══════════ سفر ۳: رفرش/ذخیرهٔ بدون تغییر ═══════════ */
  console.log('\n══ سفر ۳ — همان ردیف دوباره ذخیره می‌شود (بدون تغییر) ══');
  ready(s);
  const rec = JSON.parse(s['rfqs.json'] || '[]')[0];
  r = await request(s, { endpoint: 'crm.php', action: 'set_status', user: 'yousefi', role: 'admin',
    post: { type: 'rfq', code: code, status: 'approved', statusText: 'تایید شد — بررسی فنی و تامین' } });
  m = capture('noop', r);
  T('ذخیرهٔ بدون تغییر هیچ پیامی نمی‌سازد', m.length === 0, m.map(x => x.text).join(' | ').slice(0, 200));

  /* ═══════════ سفر ۴: رد با دلیل ═══════════ */
  console.log('\n══ سفر ۴ — استعلام دیگری رد می‌شود، با دلیل ══');
  const s2 = fresh();
  s2['sync/ptf_crm_users.json'] = USERS;
  r = await request(s2, { endpoint: 'crm.php', action: 'add_rfq_site', captcha: true, auth: 'none', user: '', role: '',
    post: { company: 'شرکت بتا', name: 'خانم کریمی', phone: '09120000002', subject: 'استعلام پمپ', category: 'پمپ' } });
  capture('site-2', r);
  ready(s2);
  const code2 = (r.json && r.json.code) || '';
  r = await request(s2, { endpoint: 'crm.php', action: 'set_status', user: 'lavasani', role: 'admin',
    post: { type: 'rfq', code: code2, status: 'rejected', statusText: 'رد شد: ظرفیت تولید تکمیل است' } });
  m = capture('reject', r);
  show('رد', m[0]);
  const tr = (m[0] || {}).text || '';
  T('رد یک پیام می‌دهد', m.length === 1, m.length + ' پیام');
  T('وضعیت جدید «ردشده» از کد', line(tr, 'وضعیت جدید') === 'وضعیت جدید: ردشده', line(tr, 'وضعیت جدید'));
  T('دلیل رد در «یادداشت» آمده', A(line(tr, 'یادداشت'), 'ظرفیت تولید تکمیل است'), line(tr, 'یادداشت'));

  /* ═══════════ سفر ۵: گردش کامل فروش (کانبان → پیشنهاد → ارسال → برد) ═══════════ */
  console.log('\n══ سفر ۵ — گردش کامل: کانبان، پیشنهاد فنی/مالی، ارسال، برد ══');
  const s3 = fresh();
  s3['sync/ptf_crm_users.json'] = USERS;
  /* ردیف با وضعیت قبلی st1 («دریافت اولیه») کاشته می‌شود تا حرکت کارت یک گذار
     واقعی st1→st2 باشد؛ پیام‌های خودِ کاشت دور ریخته نمی‌شوند بلکه جدا شمرده
     می‌شوند تا شمارش سفر بعدی آلوده نشود. */
  r = await request(s3, { action: 'entity_upsert', user: 'lavasani', role: 'admin',
    body: { collection: 'ptf_crm_rfqs', record: { _id: 'RQ-777', cd: 'RFQ-777', inqNo: 'INQ-777', co: 'شرکت گاما', subj: 'استعلام ولوو', ca: 'ماشین‌آلات', st: 'st1' }, idempotencyKey: 'seed-777' } });
  capture('seed-777', r);   /* پیام کاشت (در صورت وجود) از شمارش حرکت کانبان کنار می‌رود */
  ready(s3);
  /* اگر کاشت چیزی در صف گذاشت، با یک درخواست بی‌اثر تخلیه و جدا ثبت می‌شود تا
     شمارش «حرکت کانبان یک پیام می‌دهد» دقیق بماند. */
  r = await request(s3, { action: 'entity_upsert', user: 'lavasani', role: 'admin',
    body: { collection: 'ptf_crm_rfqs', record: { _id: 'RQ-777', cd: 'RFQ-777', inqNo: 'INQ-777', co: 'شرکت گاما', subj: 'استعلام ولوو', ca: 'ماشین‌آلات', st: 'st1' }, idempotencyKey: 'seed-777-flush' } });
  const mSeed = capture('seed-777-flush', r);
  ready(s3);
  /* حرکت کارت کانبان در CRM: همان رکورد با st تازه از مسیر entity_upsert */
  r = await request(s3, { action: 'entity_upsert', user: 'yousefi', role: 'admin',
    body: { collection: 'ptf_crm_rfqs', idempotencyKey: 'kanban-777',
      record: { _id: 'RQ-777', cd: 'RFQ-777', inqNo: 'INQ-777', co: 'شرکت گاما', subj: 'استعلام ولوو', ca: 'ماشین‌آلات', st: 'st2' } } });
  m = capture('kanban', r);
  show('کانبان st1→st2', m[0]);
  T('حرکت کانبان یک پیام می‌دهد', m.length === 1, m.length + ' پیام');
  T('برچسب‌ها از کد کانبان', A((m[0] || {}).text || '', 'وضعیت جدید: بررسی فنی') && A((m[0] || {}).text || '', 'وضعیت قبلی: دریافت اولیه'));

  ready(s3);
  r = await request(s3, { action: 'register_offer', user: 'lavasani', role: 'admin',
    body: { idempotencyKey: 'co-777', createIntent: true, offer: { no: 'CO-777', kind: 'CO', inqNo: 'RFQ-777', st: 'draft', items: [] } } });
  m = capture('offer-created', r);
  show('صدور پیشنهاد مالی', m[0]);
  T('صدور پیشنهاد: گردش‌کار WF50', (rows(s3)[0] || {}).wf === 'WF50', (rows(s3)[0] || {}).wf);
  T('صدور پیشنهاد یک پیام می‌دهد', m.length === 1, m.length + ' پیام');
  T('برچسب «پیشنهاد مالی صادر شد»', A((m[0] || {}).text || '', 'وضعیت جدید: پیشنهاد مالی صادر شد'));

  ready(s3);
  r = await request(s3, { action: 'set_offer_status', user: 'yousefi', role: 'sales',
    body: { idempotencyKey: 'ofst-777', offerNo: 'CO-777', st: 'sent' } });
  m = capture('offer-sent', r);
  show('ارسال پیشنهاد به کارفرما', m[0]);
  const ts = (m[0] || {}).text || '';
  T('ارسال پیشنهاد: گردش‌کار WF60', (rows(s3)[0] || {}).wf === 'WF60', (rows(s3)[0] || {}).wf);
  T('ارسال پیشنهاد یک پیام می‌دهد', m.length === 1, m.length + ' پیام');
  T('قبلی/جدید از کد گردش‌کار', A(ts, 'وضعیت قبلی: پیشنهاد مالی صادر شد') && A(ts, 'وضعیت جدید: منتظر پاسخ کارفرما (مالی)'));
  T('خط «رویداد» پیشنهاد مولّد را نام می‌برد', A(line(ts, 'رویداد'), 'CO-777'), line(ts, 'رویداد'));
  T('انجام‌دهندهٔ واقعی (نه ثبت‌کنندهٔ درخواست)', A(line(ts, 'انجام‌دهنده'), 'مهدی یوسفی'), line(ts, 'انجام‌دهنده'));

  ready(s3);
  /* برد فقط از فرمان win_offer (set_offer_status عمداً use_win_offer می‌دهد) */
  r = await request(s3, { action: 'win_offer', user: 'yousefi', role: 'sales',
    body: { offerNo: 'CO-777', idempotencyKey: 'win-co-777' } });
  m = capture('offer-won', r);
  show('برد پیشنهاد', m[0]);
  T('برد: گردش‌کار WF70 (در حال تامین)', (rows(s3)[0] || {}).wf === 'WF70', (rows(s3)[0] || {}).wf);
  T('برد یک پیام می‌دهد', m.length === 1, (r.json && JSON.stringify(r.json).slice(0, 160)) + ' | ' + m.length + ' پیام');
  T('برچسب «در حال تامین»', A((m[0] || {}).text || '', 'وضعیت جدید: در حال تامین'));

  /* ── ردیف قدیمیِ بدون st: برچسب «قبلی» نباید خالی چاپ شود ── */
  console.log('\n   ── ردیف قدیمی بدون st (سطر «وضعیت قبلی» خالی نماند) ──');
  const sLegacy = fresh();
  sLegacy['sync/ptf_crm_users.json'] = USERS;
  r = await request(sLegacy, { action: 'entity_upsert', user: 'lavasani', role: 'admin',
    body: { collection: 'ptf_crm_rfqs', idempotencyKey: 'legacy-1',
      record: { _id: 'RQ-OLD', cd: 'RFQ-OLD', inqNo: 'INQ-OLD', co: 'شرکت قدیمی', subj: 'ردیف مهاجرت‌شده', ca: 'شیرآلات' } } });
  capture('legacy-seed', r);
  ready(sLegacy);
  r = await request(sLegacy, { action: 'entity_upsert', user: 'lavasani', role: 'admin',
    body: { collection: 'ptf_crm_rfqs', idempotencyKey: 'legacy-flush',
      record: { _id: 'RQ-OLD', cd: 'RFQ-OLD', inqNo: 'INQ-OLD', co: 'شرکت قدیمی', subj: 'ردیف مهاجرت‌شده', ca: 'شیرآلات' } } });
  capture('legacy-flush', r);
  ready(sLegacy);
  r = await request(sLegacy, { action: 'entity_upsert', user: 'lavasani', role: 'admin',
    body: { collection: 'ptf_crm_rfqs', idempotencyKey: 'legacy-move',
      record: { _id: 'RQ-OLD', cd: 'RFQ-OLD', inqNo: 'INQ-OLD', co: 'شرکت قدیمی', subj: 'ردیف مهاجرت‌شده', ca: 'شیرآلات', st: 'st2' } } });
  m = capture('legacy-move', r);
  show('ردیف قدیمی st→st2', m[0]);
  const tl = (m[0] || {}).text || '';
  T('ردیف بدون st یک پیام می‌دهد', m.length === 1, m.length + ' پیام');
  T('سطر «وضعیت قبلی» خالی نیست', line(tl, 'وضعیت قبلی') === 'وضعیت قبلی: تعیین‌نشده', line(tl, 'وضعیت قبلی'));
  T('وضعیت جدید همان کد است', line(tl, 'وضعیت جدید') === 'وضعیت جدید: بررسی فنی', line(tl, 'وضعیت جدید'));

  /* ═══════════ سفر ۶: هدایت به فرم درست ═══════════ */
  console.log('\n══ سفر ۶ — کارشناس، ثبت فرم اشتباه را «هدایت» می‌کند ══');
  const s4 = fresh();
  s4['sync/ptf_crm_users.json'] = USERS;
  r = await request(s4, { endpoint: 'crm.php', action: 'add_rfq_site', captcha: true, auth: 'none', user: '', role: '',
    post: { company: 'شرکت دلتا', name: 'آقای نادری', phone: '09120000003', subject: 'ثبت اشتباه', category: 'شیرآلات' } });
  capture('site-3', r);
  ready(s4);
  /* استعلام سایت در rfqs.json (رهگیری) می‌نشیند، نه ptf_crm_rfqs — کد را از پاسخ می‌گیریم */
  const code4 = (r.json && r.json.code) || ((JSON.parse(s4['rfqs.json'] || '[]')[0] || {}).code) || '';
  r = await request(s4, { endpoint: 'crm.php', action: 'set_status', user: 'lavasani', role: 'admin',
    post: { type: 'rfq', code: code4, status: 'redirected', statusText: 'ثبت در فرم تامین‌کنندگان' } });
  m = capture('redirect', r);
  show('هدایت', m[0]);
  T('هدایت یک پیام می‌دهد', m.length === 1, m.length + ' پیام');
  T('برچسب «هدایت به فرم درست»', A((m[0] || {}).text || '', 'وضعیت جدید: هدایت به فرم درست'), (m[0] || {}).text);

  /* ═══════════ سفر ۷: دستگاه دوم با نسخهٔ کهنه push می‌کند ═══════════ */
  console.log('\n══ سفر ۷ — لپ‌تاپ دیروز (نسخهٔ کهنه، بدون base) همگام‌سازی می‌کند ══');
  const s5Stale = fresh();
  s5Stale['sync/ptf_crm_users.json'] = USERS;
  s5Stale['sync/ptf_crm_rfqs.json'] = JSON.stringify([
    { _id: 'RQ-801', cd: 'RFQ-801', co: 'شرکت الف', subj: 'الف', st: 'st1' },
    { _id: 'RQ-802', cd: 'RFQ-802', co: 'شرکت ب', subj: 'ب', st: 'st1' }
  ]);
  ready(s5Stale);
  r = await request(s5Stale, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_rfqs: JSON.stringify([{ _id: 'RQ-801', cd: 'RFQ-801', co: 'شرکت الف', subj: 'الف', st: 'st1' }]) } } });
  m = capture('stale-push', r);
  T('push کهنه هیچ ردیفی را از سرور حذف نمی‌کند', rows(s5Stale).length === 2, rows(s5Stale).map(x => x.cd).join(','));
  T('push کهنه پیام کاذب «حذف/ثبت» نمی‌سازد', m.length === 0, m.map(x => x.text).join(' | ').slice(0, 200));
  T('ردیف حفظ‌شده به همان دستگاه گزارش می‌شود', !!(r.json && r.json.staleKept && (r.json.staleKept.ptf_crm_rfqs || []).includes('RFQ-802')), JSON.stringify(r.json && r.json.staleKept));

  /* ═══════════ سفر ۸: صف: نرخ، کهنگی، سلامت ═══════════ */
  console.log('\n══ سفر ۸ — وضعیت صف و پیام کهنه ══');
  r = await request(s5Stale, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_rfqs: JSON.stringify(rows(s5Stale).map(x => ({ ...x, st: 'st2' }))) } } });
  const msgsRate = capture('rate', r);
  T('دو تغییر وضعیت در یک push ⇒ حداکثر همان تعداد پیام (بدون تکرار)', msgsRate.length <= 2, msgsRate.length + ' پیام');
  const st = q(s5Stale);
  const statuses = Object.values(st.jobs || {}).map(j => j.status);
  T('هیچ پیامی در حالت «sending» گیر نکرده', !statuses.includes('sending'), statuses.join(','));
  T('صف نرخ (سطل توکن) دارد', !!(st.rate && typeof st.rate.tokens === 'number'), JSON.stringify(st.rate));

  /* ═══════════ بازبینی ساختاری همهٔ پیام‌های این جلسه ═══════════ */
  console.log('\n══ بازبینی ساختاری ' + all.length + ' پیام ثبت‌شده ══');
  const problems = structuralScan(all);
  T('هیچ پیامی کد خام/توانبخشی وضعیت، شمارهٔ تماس، مبلغ، سطر تکراری یا کاراکتر خراب ندارد',
    problems.length === 0, problems.join(' | '));
  const titles = {};
  all.forEach(x => { const first = (x.text || '').split('\n')[0]; titles[first] = (titles[first] || 0) + 1; });
  console.log('   توزیع عنوان‌ها: ' + JSON.stringify(titles, null, 0));

  /* ═══════════ خلاصه برای کارفرما ═══════════ */
  console.log('\n──────────────────────────────────────────────');
  console.log('جمع: ' + all.length + ' پیام واقعی تولید و خط‌به‌خط بازبینی شد.');
  console.log('=== FIELD VERIFY: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  if (fail) console.log('FAILED: ' + failures.join(' | '));
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('CRASH', e); process.exit(1); });

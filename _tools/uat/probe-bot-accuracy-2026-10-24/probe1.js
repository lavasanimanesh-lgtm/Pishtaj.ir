'use strict';
/* PROBE 1 — دقت «محتوا»ی پیام بات (بدون تغییر هیچ کدی در ریپو) */
const path = require('path');
const baseSrc = require('fs').readFileSync('/tmp/probe/base.js', 'utf8');
// base.js به ROOT خودش اشاره دارد؛ اینجا همان مسیر ریپو است.
const M = { exports: {} };
const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', baseSrc.replace(/^#!.*\n/, '') + `
module.exports = { request, fresh, messages, ready, upsert, rows, q, T, stats: () => ({pass, fail}) };
`);
fn(require, M, M.exports, '/home/user/Pishtaj.ir/_tools/uat', '/home/user/Pishtaj.ir/_tools/uat/e2e.js');
const { request, fresh, messages, ready, upsert, rows, q, T } = M.exports;

const USERS = JSON.stringify([
  { username: 'yousefi', name: 'مهدی یوسفی', role: 'sales' },
  { username: 'lavasani', name: 'علی لواسانی', role: 'admin' }
]);

(async () => {
  /* ═══ A — تغییر وضعیت دستی از خود CRM: منبع و انجام‌دهنده چه می‌گویند؟ ═══ */
  console.log('\n══ A — set_status (دراپ‌داون/کانبان)، کاربر CRM با نام نمایشی ══');
  const s = fresh();
  s['sync/ptf_crm_users.json'] = USERS;
  let r = await request(s, { endpoint: 'crm.php', action: 'add_rfq_site', captcha: true,
    post: { company: 'شرکت نمونه', name: 'مهندس رضایی', phone: '09120000001', subject: 'استعلام شیر توپی', category: 'شیرآلات' } });
  const createMsgs = messages(r);
  console.log('   پیام ثبت سایت: ' + JSON.stringify(createMsgs[0] && createMsgs[0].text));
  T('A1: ثبت از سایت یک پیام دارد', createMsgs.length === 1, JSON.stringify(createMsgs.map(m => m.text)));
  const siteCode = rows({}).length; // placeholder
  const siteRows = JSON.parse(s['rfqs.json'] || '[]');
  const code = siteRows[0] && (siteRows[0].code || siteRows[0].cd);
  console.log('   کد رهگیری سایت: ' + code + ' | ردیف: ' + JSON.stringify(siteRows[0] && Object.keys(siteRows[0])));
  ready(s);
  r = await request(s, { endpoint: 'crm.php', action: 'set_status', user: 'yousefi', role: 'admin',
    post: { type: 'rfq', code: String(code), status: 'approved', statusText: 'تایید شد — در حال بررسی فنی و تامین' } });
  const m1 = messages(r);
  console.log('   پیام تغییر وضعیت: ' + JSON.stringify(m1[0] && m1[0].text));
  T('A2: تغییر وضعیت یک پیام دارد', m1.length === 1, JSON.stringify(m1.map(m => m.text)));
  const txt = (m1[0] && m1[0].text) || '';
  T('A3 [انتظار: انجام‌دهنده = نام نمایشی «مهدی یوسفی»]', txt.includes('انجام‌دهنده: مهدی یوسفی'), txt.split('\n').filter(l => l.startsWith('انجام‌دهنده')).join());
  T('A4 [انتظار: منبع = CRM چون کاربر CRM انجام داده]', txt.includes('منبع: CRM'), txt.split('\n').filter(l => l.startsWith('منبع')).join());

  /* statusText دلخواه کلاینت، بی‌هیچ اعتبارسنجی، داخل پیام گروه */
  ready(s);
  r = await request(s, { endpoint: 'crm.php', action: 'set_status', user: 'yousefi', role: 'admin',
    post: { type: 'rfq', code: String(code), status: 'st2', statusText: 'هر متن دلخواه — ۱۲۳ تومان تخفیف' } });
  const m2 = messages(r);
  console.log('   پیام برچسب دلخواه: ' + JSON.stringify(m2[0] && m2[0].text));
  T('A5 [انتظار: برچسب از «کد وضعیت» نه متن آزاد کلاینت]', m2.length === 1 && !((m2[0].text || '').includes('هر متن دلخواه')),
    (m2[0] && m2[0].text || '').split('\n').filter(l => l.startsWith('وضعیت')).join(' | '));

  /* کد وضعیت ناشناخته (redirected / stInv) */
  ready(s);
  r = await request(s, { endpoint: 'crm.php', action: 'set_status', user: 'yousefi', role: 'admin',
    post: { type: 'rfq', code: String(code), status: 'redirected', statusText: 'ثبت در فرم اشتباه' } });
  const m3 = messages(r);
  const t3 = (m3[0] && m3[0].text) || '';
  console.log('   پیام کد ناشناخته: ' + JSON.stringify(t3));
  T('A6 [انتظار: برچسب فارسی برای کد ناشناخته]', m3.length === 1 && !/وضعیت (جدید|قبلی): (redirected|stInv)/.test(t3), t3.split('\n').filter(l => l.startsWith('وضعیت')).join(' | '));

  /* ═══ B — گذار تکراری: WF50→WF60→WF55→WF60 ═══ */
  console.log('\n══ B — گذار یکسان برای بار دوم (مسیر CRM/sales-domain) ══');
  const s2 = fresh();
  s2['sync/ptf_crm_users.json'] = USERS;
  r = await upsert(s2, { _id: 'RQ-301', cd: 'RFQ-301', inqNo: 'INQ-301', co: 'شرکت ب', subj: 'استعلام', ca: 'شیرآلات' }, 'seed-301', { user: 'lavasani', role: 'admin' });
  ready(s2);
  r = await request(s2, { action: 'register_offer', body: { idempotencyKey: 'co-301', createIntent: true, offer: { no: 'CO-301', kind: 'CO', inqNo: 'RFQ-301', st: 'draft', items: [] } }, user: 'lavasani', role: 'admin' });
  ready(s2);
  r = await request(s2, { action: 'set_offer_status', body: { idempotencyKey: 'ofst-301', offerNo: 'CO-301', st: 'sent' }, user: 'yousefi', role: 'sales' });
  const b1 = messages(r); console.log('   WF50→WF60: ' + b1.length + ' پیام');
  ready(s2);
  r = await request(s2, { action: 'set_offer_status', body: { idempotencyKey: 'ofst-302', offerNo: 'CO-301', st: 'revise' }, user: 'yousefi', role: 'sales' });
  const b2 = messages(r); console.log('   WF60→WF55: ' + b2.length + ' پیام');
  ready(s2);
  r = await request(s2, { action: 'set_offer_status', body: { idempotencyKey: 'ofst-303', offerNo: 'CO-301', st: 'sent' }, user: 'yousefi', role: 'sales' });
  const b3 = messages(r); console.log('   WF55→WF60 (بار دوم): ' + b3.length + ' پیام');
  T('B1: گذار اول اعلام می‌شود', b1.length === 1, b1.length);
  T('B2: گذار به «نیاز به اصلاح» اعلام می‌شود', b2.length === 1, b2.length);
  T('B3 [انتظار: گذار دوم به WF60 هم اعلام شود]', b3.length === 1, 'پیام‌ها=' + b3.length + ' | وضعیت فعلی wf=' + rows(s2)[0].wf);

  /* ═══ C — دو ردیف با شناسهٔ یکسان (تکرار/ادغام ناقص) ═══ */
  console.log('\n══ C — شناسهٔ تکراری بین دو ردیف ══');
  const s3 = fresh();
  s3['sync/ptf_crm_users.json'] = USERS;
  s3['sync/ptf_crm_rfqs.json'] = JSON.stringify([
    { _id: 'RQ-A', cd: 'RFQ-DUP', inqNo: 'INQ-DUP', co: 'شرکت الف', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' },
    { _id: 'RQ-B', cd: 'RFQ-DUP', inqNo: 'INQ-DUP2', co: 'شرکت ب', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' }
  ]);
  ready(s3);
  r = await upsert(s3, { _id: 'RQ-A', cd: 'RFQ-DUP', inqNo: 'INQ-DUP', co: 'شرکت الف', subj: 'استعلام', st: 'st2', stxt: 'بررسی فنی' }, 'dup-1', { user: 'yousefi', role: 'admin' });
  const c1 = messages(r);
  console.log('   پیام: ' + JSON.stringify(c1.map(m => m.text)));
  T('C1 [انتظار: تغییر وضعیت ردیف تکراری اعلام شود]', c1.length === 1, 'پیام‌ها=' + c1.length);

  /* ═══ D — ردیفی بدون «شرکت» ولی با نام شخص ═══ */
  console.log('\n══ D — ردیف سایت بدون نام شرکت ══');
  const s4 = fresh();
  s4['sync/ptf_crm_users.json'] = USERS;
  r = await request(s4, { endpoint: 'crm.php', action: 'add_rfq_site', captcha: true,
    post: { company: '', name: 'مهندس رضایی', phone: '09120000001', subject: 'استعلام', category: 'شیرآلات' } });
  const d1 = messages(r);
  console.log('   پیام: ' + JSON.stringify(d1[0] && d1[0].text));
  const dt = (d1[0] && d1[0].text) || '';
  T('D1 [انتظار: مشتری از نام تماس پر شود یا خالی نماند]', !dt.includes('مشتری: نامشخص'), dt.split('\n').filter(l => l.startsWith('مشتری')).join());

  const st = M.exports.stats();
  console.log('\n=== PROBE1: ' + st.pass + ' PASS / ' + st.fail + ' FAIL ===');
})().catch(e => { console.error('PROBE CRASH', e); process.exit(1); });

'use strict';
/* PROBE 4 — نوشتن کهنه از دستگاه قدیمی (بدون base) و اثرش روی پیام گروه */
const baseSrc = require('fs').readFileSync('/tmp/probe/base.js', 'utf8');
const M = { exports: {} };
new Function('require', 'module', 'exports', '__dirname', '__filename', baseSrc.replace(/^#!.*\n/, '') + `
module.exports = { request, fresh, messages, ready, upsert, rows, q, T, stats: () => ({pass, fail}) };
`)(require, M, M.exports, '/home/user/Pishtaj.ir/_tools/uat', '/home/user/Pishtaj.ir/_tools/uat/e2e.js');
const { request, fresh, messages, ready, upsert, rows, T } = M.exports;

const USERS = JSON.stringify([
  { username: 'yousefi', name: 'مهدی یوسفی', role: 'sales' },
  { username: 'lavasani', name: 'علی لواسانی', role: 'admin' }
]);
const offers = s => { try { return JSON.parse(s['sync/ptf_crm_offers.json'] || '[]'); } catch (e) { return []; } };

(async () => {
  /* ═══ A — data_push با انجام‌دهندهٔ دارای نام نمایشی ═══ */
  console.log('\n══ A — نام انجام‌دهنده در مسیر data_push ══');
  const s = fresh();
  s['sync/ptf_crm_users.json'] = USERS;
  let r = await request(s, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_rfqs: JSON.stringify([{ _id: 'R-1', cd: 'RFQ-1', co: 'شرکت', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' }]) } } });
  const a1 = messages(r);
  console.log('   پیام: ' + JSON.stringify(a1[0] && a1[0].text));
  T('A1: push یک پیام «ثبت درخواست جدید» می‌دهد', a1.length === 1, JSON.stringify(r.json).slice(0, 200));
  T('A2: انجام‌دهنده با نام نمایشی', (a1[0]?.text || '').includes('انجام‌دهنده: مهدی یوسفی'), (a1[0]?.text || '').split('\n').filter(l => l.startsWith('انجام‌دهنده')).join());

  /* ═══ B — push کهنه (بدون base) که یک پیشنهاد را حذف می‌کند ═══ */
  console.log('\n══ B — push دستگاه قدیمی بدون base: فهرست پیشنهادهای کهنه ══');
  const s2 = fresh();
  s2['sync/ptf_crm_users.json'] = USERS;
  r = await upsert(s2, { _id: 'RQ-401', cd: 'RFQ-401', co: 'شرکت پ', subj: 'استعلام', ca: 'شیرآلات' }, 'seed-401', { user: 'lavasani', role: 'admin' });
  ready(s2);
  r = await request(s2, { action: 'register_offer', body: { idempotencyKey: 'co-401', createIntent: true, offer: { no: 'CO-401', kind: 'CO', inqNo: 'RFQ-401', st: 'sent', items: [] } }, user: 'lavasani', role: 'admin' });
  console.log('   پس از ثبت CO ارسال‌شده: offers=' + offers(s2).length + ' wf=' + rows(s2)[0].wf);
  ready(s2);
  /* دستگاه قدیمی: فهرست پیشنهادها را قبل از ثبت CO گرفته بود (خالی) + فهرست rfqs خودش */
  const staleRfqs = rows(s2).map(x => ({ ...x, wf: 'WF50', stxt: 'پیشنهاد مالی صادر شد', wfUpdatedAtISO: '' }));
  r = await request(s2, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_offers: JSON.stringify([]), ptf_crm_rfqs: JSON.stringify(staleRfqs) } } });
  const b1 = messages(r);
  console.log('   پاسخ: ' + JSON.stringify(r.json).slice(0, 300));
  console.log('   پس از push کهنه: offers=' + offers(s2).length + ' | wf=' + (rows(s2)[0] || {}).wf);
  console.log('   پیام‌ها: ' + JSON.stringify(b1.map(m => m.text)));
  T('B1: push خالیِ پیشنهادها پذیرفته نمی‌شود', offers(s2).length === 1, 'offers=' + offers(s2).length);
  T('B2: گردش‌کار به عقب برنمی‌گردد', (rows(s2)[0] || {}).wf === 'WF60', (rows(s2)[0] || {}).wf);
  T('B3: پیام گمراه‌کنندهٔ بازگشت وضعیت ساخته نمی‌شود', b1.length === 0, JSON.stringify(b1.map(m => m.text)));

  /* ═══ C — همین سنجه با یک فهرست غیرخالیِ کهنه (حذف یک CO از میان دو) ═══ */
  console.log('\n══ C — فهرست پیشنهادهای کهنهٔ غیرخالی (حذف CO تازه از میان دو) ══');
  const s3 = fresh();
  s3['sync/ptf_crm_users.json'] = USERS;
  r = await upsert(s3, { _id: 'RQ-501', cd: 'RFQ-501', co: 'شرکت ج', subj: 'استعلام' }, 'seed-501', { user: 'lavasani', role: 'admin' });
  ready(s3);
  r = await request(s3, { action: 'register_offer', body: { idempotencyKey: 'co-501a', createIntent: true, offer: { no: 'CO-501A', kind: 'CO', inqNo: 'RFQ-501', st: 'lost', items: [] } }, user: 'lavasani', role: 'admin' });
  ready(s3);
  r = await request(s3, { action: 'register_offer', body: { idempotencyKey: 'co-501b', createIntent: true, offer: { no: 'CO-501B', kind: 'CO', inqNo: 'RFQ-501', st: 'sent', items: [] } }, user: 'lavasani', role: 'admin' });
  const wfBefore = rows(s3)[0].wf;
  const onlyFirst = offers(s3).filter(o => o.no === 'CO-501A');
  ready(s3);
  r = await request(s3, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_offers: JSON.stringify(onlyFirst) } } });
  const c1 = messages(r);
  console.log('   پیش از push: wf=' + wfBefore + ' offers=' + offers(s3).length + ' | پس از push: wf=' + (rows(s3)[0] || {}).wf + ' offers=' + offers(s3).length);
  console.log('   پاسخ: ' + JSON.stringify(r.json).slice(0, 300));
  console.log('   پیام‌ها: ' + JSON.stringify(c1.map(m => m.text)));
  T('C1: حذف پیشنهاد تازه با snapshot کهنه رد می‌شود', offers(s3).length === 2, 'offers=' + offers(s3).length);

  /* ═══ D — حذف یک درخواست با push کهنه (بدون base) ═══ */
  console.log('\n══ D — push کهنه که یک درخواست را کامل حذف می‌کند ═══');
  const s4 = fresh();
  s4['sync/ptf_crm_users.json'] = USERS;
  s4['sync/ptf_crm_rfqs.json'] = JSON.stringify([
    { _id: 'RQ-601', cd: 'RFQ-601', co: 'شرکت د۱', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' },
    { _id: 'RQ-602', cd: 'RFQ-602', co: 'شرکت د۲', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' }
  ]);
  ready(s4);
  r = await request(s4, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_rfqs: JSON.stringify([{ _id: 'RQ-601', cd: 'RFQ-601', co: 'شرکت د۱', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' }]) } } });
  console.log('   ردیف‌های سرور پس از push: ' + rows(s4).map(x => x.cd).join(',') + ' | پیام‌ها=' + messages(r).length);
  /* دستگاه دوم همان درخواست را دوباره push می‌کند */
  ready(s4);
  r = await request(s4, { endpoint: 'crm.php', action: 'data_push', user: 'lavasani', role: 'admin',
    body: { by: 'lavasani', data: { ptf_crm_rfqs: JSON.stringify([
      { _id: 'RQ-601', cd: 'RFQ-601', co: 'شرکت د۱', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' },
      { _id: 'RQ-602', cd: 'RFQ-602', co: 'شرکت د۲', subj: 'استعلام', st: 'st1', stxt: 'دریافت اولیه' }
    ]) } } });
  const d2 = messages(r);
  console.log('   پیام بازگشت ردیف: ' + JSON.stringify(d2.map(m => m.text)));
  T('D2 [انتظار: بازگشت ردیف حذف‌شده «ثبت جدید» اعلام نشود]', !d2.some(m => m.text.includes('ثبت درخواست جدید')),
    JSON.stringify(d2.map(m => m.text)));

  const st = M.exports.stats();
  console.log('\n=== PROBE4: ' + st.pass + ' PASS / ' + st.fail + ' FAIL ===');
})().catch(e => { console.error('CRASH', e); process.exit(1); });

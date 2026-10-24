'use strict';
/* PROBE 5 — P2-9: push ای که فقط «پیشنهادها» را می‌آورد، گردش‌کار درخواست را بازخوانی می‌کند؟
   سناریو: یک درخواست با دو CO (بازنده + ارسال‌شده) ⇒ wf=WF60.
   سپس وضعیت CO ارسال‌شده با یک push پیشنهادها (بدون ptf_crm_rfqs) به lost می‌رود. */
const baseSrc = require('fs').readFileSync('/tmp/probe/base.js', 'utf8');
const M = { exports: {} };
new Function('require', 'module', 'exports', '__dirname', '__filename', baseSrc.replace(/^#!.*\n/, '') + `
module.exports = { request, fresh, messages, ready, upsert, rows, T, stats: () => ({pass, fail}) };
`)(require, M, M.exports, '/home/user/Pishtaj.ir/_tools/uat', '/home/user/Pishtaj.ir/_tools/uat/e2e.js');
const { request, fresh, messages, ready, upsert, rows, T } = M.exports;

const USERS = JSON.stringify([
  { username: 'yousefi', name: 'مهدی یوسفی', role: 'sales' },
  { username: 'lavasani', name: 'علی لواسانی', role: 'admin' }
]);
const offers = s => { try { return JSON.parse(s['sync/ptf_crm_offers.json'] || '[]'); } catch (e) { return []; } };

(async () => {
  const s = fresh();
  s['sync/ptf_crm_users.json'] = USERS;
  await upsert(s, { _id: 'RQ-501', cd: 'RFQ-501', co: 'شرکت ج', subj: 'استعلام' }, 'seed-501', { user: 'lavasani', role: 'admin' });
  ready(s);
  await request(s, { action: 'register_offer', body: { idempotencyKey: 'co-501a', createIntent: true, offer: { no: 'CO-501A', kind: 'CO', inqNo: 'RFQ-501', st: 'lost', items: [] } }, user: 'lavasani', role: 'admin' });
  ready(s);
  await request(s, { action: 'register_offer', body: { idempotencyKey: 'co-501b', createIntent: true, offer: { no: 'CO-501B', kind: 'CO', inqNo: 'RFQ-501', st: 'sent', items: [] } }, user: 'lavasani', role: 'admin' });
  ready(s);
  const wfBefore = (rows(s)[0] || {}).wf;
  console.log('\nپیش از push: wf=' + wfBefore + ' offers=' + offers(s).map(o => o.no + ':' + o.st).join(','));
  T('پایه: دو پیشنهاد و WF60 (منتظر پاسخ کارفرما)', offers(s).length === 2 && wfBefore === 'WF60', wfBefore);

  /* ═══ A — push فقط-پیشنهادها: CO ارسال‌شده بازنده می‌شود (بدون ptf_crm_rfqs) ═══ */
  const next = offers(s).map(o => (o.no === 'CO-501B' ? Object.assign({}, o, { st: 'lost' }) : o));
  const r = await request(s, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_offers: JSON.stringify(next) } } });
  const wfAfter = (rows(s)[0] || {}).wf;
  const msgs = messages(r);
  console.log('پس از push فقط-پیشنهادها: wf=' + wfAfter + ' | پیام‌ها=' + msgs.length);
  msgs.forEach(m => console.log('   ' + JSON.stringify(m.text)));
  T('A1: wf پس از push فقط-پیشنهادها بازخوانی می‌شود (WF91)', wfAfter === 'WF91', 'wf=' + wfAfter);
  T('A2: تغییر وضعیت اعلام می‌شود', msgs.length === 1, JSON.stringify(msgs.map(m => m.text)));
  T('A3: «وضعیت قبلی» از مقدار تازهٔ سرور است، نه WF60 کهنه',
    (msgs[0] && msgs[0].text || '').includes('منتظر پاسخ کارفرما (مالی)'), (msgs[0] && msgs[0].text || '').split('\n').filter(l => l.startsWith('وضعیت')).join(' | '));

  /* ═══ B — پیام بعدی: «وضعیت قبلی» باید از wf تازه باشد، نه WF60 کهنه ═══ */
  ready(s);
  const back = offers(s).map(o => (o.no === 'CO-501B' ? Object.assign({}, o, { st: 'sent' }) : o));
  const r2 = await request(s, { endpoint: 'crm.php', action: 'data_push', user: 'yousefi', role: 'admin',
    body: { by: 'yousefi', data: { ptf_crm_offers: JSON.stringify(back) } } });
  const m2 = messages(r2);
  const prev = (m2[0] && m2[0].text || '').split('\n').filter(l => l.startsWith('وضعیت قبلی')).join();
  console.log('پیام بعدی: ' + JSON.stringify(m2.map(m => m.text)));
  T('B1: پیام بعدی «وضعیت قبلی» را از wf تازه می‌خواند (نه WF60 کهنه)',
    m2.length === 1 && prev.includes('بایگانی — بازنده مالی'), prev || JSON.stringify(m2.map(m => m.text)));

  const st = M.exports.stats();
  console.log('\n=== PROBE5: ' + st.pass + ' PASS / ' + st.fail + ' FAIL ===');
})().catch(e => { console.error('CRASH', e); process.exit(1); });

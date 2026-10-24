'use strict';
const baseSrc = require('fs').readFileSync('/tmp/probe/base.js', 'utf8');
const M = { exports: {} };
new Function('require','module','exports','__dirname','__filename', baseSrc.replace(/^#!.*\n/,'') + `
module.exports = { request, fresh, messages, ready, upsert, rows, T, stats: () => ({pass, fail}) };
`)(require, M, M.exports, '/home/user/Pishtaj.ir/_tools/uat', '/home/user/Pishtaj.ir/_tools/uat/e2e.js');
const { request, fresh, messages, ready, upsert, rows, T } = M.exports;
const USERS = JSON.stringify([{username:'lavasani',name:'علی لواسانی',role:'admin'},{username:'yousefi',name:'مهدی یوسفی',role:'sales'}]);
const show = m => JSON.stringify(m.map(x => x.text));

(async () => {
  /* ۱) ردیف سایت که st دارد: تایید/رد از صف → پیام؟ */
  console.log('\n══ ۱ — ردیف سایت با st پرشده: تغییر status/statusText ══');
  const s = fresh(); s['sync/ptf_crm_users.json'] = USERS;
  s['rfqs.json'] = JSON.stringify([{ code:'PTF-RFQ-T1', src:'site', company:'شرکت س', contact:'رضایی', phone:'09120000001',
    subject:'استعلام', category:'شیرآلات', status:'pending', statusText:'در انتظار تایید مدیران', st:'st2', date:'2026-10-01' }]);
  ready(s);
  let r = await request(s, { endpoint:'crm.php', action:'set_status', user:'yousefi', role:'admin',
    post:{ type:'rfq', code:'PTF-RFQ-T1', status:'rejected', statusText:'مختومه' } });
  console.log('   پیام‌ها: ' + show(messages(r)));
  T('۱: رد/تایید درخواست سایت (ردیف دارای st) اعلام می‌شود', messages(r).length === 1, show(messages(r)));

  /* ۲) همان ردیف با st خالی */
  console.log('\n══ ۲ — همان تغییر با st خالی ══');
  const s2 = fresh(); s2['sync/ptf_crm_users.json'] = USERS;
  s2['rfqs.json'] = JSON.stringify([{ code:'PTF-RFQ-T2', src:'site', company:'شرکت س', contact:'رضایی', phone:'09120000001',
    subject:'استعلام', category:'شیرآلات', status:'pending', statusText:'در انتظار تایید مدیران', date:'2026-10-01' }]);
  ready(s2);
  r = await request(s2, { endpoint:'crm.php', action:'set_status', user:'yousefi', role:'admin',
    post:{ type:'rfq', code:'PTF-RFQ-T2', status:'rejected', statusText:'مختومه' } });
  console.log('   پیام‌ها: ' + show(messages(r)));
  T('۲: با st خالی اعلام می‌شود', messages(r).length === 1, show(messages(r)));

  /* ۳) دو مسیرِ یک عمل: entity_upsert (است) + set_status (status) */
  console.log('\n══ ۳ — یک اقدام کاربر، دو نوشتن (ptfRfqSetStatus) ══');
  for (const order of ['entity-first', 'api-first']) {
    const s3 = fresh(); s3['sync/ptf_crm_users.json'] = USERS;
    s3['sync/ptf_crm_rfqs.json'] = JSON.stringify([{ _id:'S-1', cd:'PTF-RFQ-T3', code:'PTF-RFQ-T3', src:'site',
      co:'شرکت س', con:'رضایی', subj:'استعلام', st:'st1', stxt:'دریافت اولیه', status:'pending', statusText:'در انتظار تایید مدیران' }]);
    s3['rfqs.json'] = JSON.stringify([{ code:'PTF-RFQ-T3', src:'site', company:'شرکت س', subject:'استعلام', status:'pending', statusText:'در انتظار تایید مدیران' }]);
    ready(s3);
    const rec = { _id:'S-1', cd:'PTF-RFQ-T3', code:'PTF-RFQ-T3', src:'site', co:'شرکت س', con:'رضایی', subj:'استعلام',
      st:'st2', stxt:'دریافت اولیه', stUpdatedAtISO:new Date().toISOString(), status:'pending', statusText:'در انتظار تایید مدیران' };
    let all = [];
    if (order === 'entity-first') {
      r = await request(s3, { action:'entity_upsert', body:{ collection:'ptf_crm_rfqs', record:rec, idempotencyKey:'e-1' }, user:'yousefi', role:'admin' });
      all = all.concat(messages(r));
      ready(s3);
      r = await request(s3, { endpoint:'crm.php', action:'set_status', user:'yousefi', role:'admin', post:{ type:'rfq', code:'PTF-RFQ-T3', status:'st2', statusText:'🔵 بررسی فنی' } });
      all = all.concat(messages(r));
    } else {
      r = await request(s3, { endpoint:'crm.php', action:'set_status', user:'yousefi', role:'admin', post:{ type:'rfq', code:'PTF-RFQ-T3', status:'st2', statusText:'🔵 بررسی فنی' } });
      all = all.concat(messages(r));
      ready(s3);
      r = await request(s3, { action:'entity_upsert', body:{ collection:'ptf_crm_rfqs', record:rec, idempotencyKey:'e-1' }, user:'yousefi', role:'admin' });
      all = all.concat(messages(r));
    }
    console.log('   ' + order + ' → ' + all.length + ' پیام');
    all.forEach((m, i) => console.log('     [' + (i + 1) + '] ' + JSON.stringify(m.text)));
  }
})();

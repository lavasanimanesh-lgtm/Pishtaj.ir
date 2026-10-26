'use strict';
const baseSrc = require('fs').readFileSync('/tmp/probe/base.js', 'utf8');
const M = { exports: {} };
new Function('require','module','exports','__dirname','__filename', baseSrc.replace(/^#!.*\n/,'') + `
module.exports = { request, fresh, messages, ready, upsert, rows, T, stats: () => ({pass, fail}) };
`)(require, M, M.exports, '/home/user/Pishtaj.ir/_tools/uat', '/home/user/Pishtaj.ir/_tools/uat/e2e.js');
const { request, fresh, messages, ready, rows } = M.exports;
const USERS = JSON.stringify([{username:'lavasani',name:'علی لواسانی',role:'admin'},{username:'yousefi',name:'مهدی یوسفی',role:'sales'}]);
(async () => {
  for (const order of ['entity-first','api-first']) {
    const s = fresh(); s['sync/ptf_crm_users.json'] = USERS;
    const base = { _id:'S-1', cd:'PTF-RFQ-T4', code:'PTF-RFQ-T4', src:'site', co:'شرکت س', con:'رضایی', subj:'استعلام',
      st:'st1', stxt:'دریافت اولیه', status:'pending', statusText:'در انتظار تایید مدیران' };
    s['sync/ptf_crm_rfqs.json'] = JSON.stringify([base]);
    s['rfqs.json'] = JSON.stringify([{ code:'PTF-RFQ-T4', src:'site', company:'شرکت س', subject:'استعلام', status:'pending', statusText:'در انتظار تایید مدیران' }]);
    ready(s);
    // دقیقاً همان کاری که ptfRfqSetStatus می‌کند: st + stxt + مهر، سپس api set_status
    const rec = Object.assign({}, base, { st:'st2', stxt:'🔵 بررسی فنی', stUpdatedAtISO:new Date().toISOString() });
    let all = [];
    const doEntity = async () => { const rr = await request(s, { action:'entity_upsert', body:{ collection:'ptf_crm_rfqs', record:rec, idempotencyKey:'e-'+order }, user:'yousefi', role:'admin' }); all = all.concat(messages(rr)); return rr; };
    const doApi = async () => { const rr = await request(s, { endpoint:'crm.php', action:'set_status', user:'yousefi', role:'admin', post:{ type:'rfq', code:'PTF-RFQ-T4', status:'st2', statusText:'🔵 بررسی فنی' } }); all = all.concat(messages(rr)); return rr; };
    let rr;
    if (order === 'entity-first') { rr = await doEntity(); console.log('  entity resp: ' + JSON.stringify(rr.json).slice(0,160)); ready(s); rr = await doApi(); console.log('  api resp: ' + JSON.stringify(rr.json).slice(0,160)); }
    else { rr = await doApi(); console.log('  api resp: ' + JSON.stringify(rr.json).slice(0,160)); ready(s); rr = await doEntity(); console.log('  entity resp: ' + JSON.stringify(rr.json).slice(0,160)); }
    console.log('\n' + order + ' → ' + all.length + ' پیام');
    all.forEach((m,i)=>console.log('   ['+(i+1)+'] '+JSON.stringify(m.text)));
  }
})();

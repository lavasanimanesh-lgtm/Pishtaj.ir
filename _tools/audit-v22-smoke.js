const fs = require('fs');
const vm = require('vm');

function load(file, ctx) {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, ctx, { filename: file });
}

function makeContext() {
  const store = {};
  const ctx = {
    console,
    window: null,
    localStorage: {
      _d: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; }
    },
    document: {
      head: { appendChild(){} },
      body: { appendChild(){}, insertAdjacentHTML(){} },
      createElement() { return { style:{}, appendChild(){}, set textContent(v){}, addEventListener(){}, remove(){} }; },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      getElementById(){ return null; },
      addEventListener(){}
    },
    setTimeout(fn){ /* no async in smoke */ return 0; },
    clearTimeout(){},
    setInterval(){ return 0; },
    clearInterval(){},
    caches: { keys: async()=>[], delete: async()=>true },
    navigator: { serviceWorker: { getRegistrations: async()=>[] } },
    getData(k){ return store[k] ? JSON.parse(JSON.stringify(store[k])) : []; },
    setData(k,v){ store[k] = JSON.parse(JSON.stringify(v)); },
    curSession(){ return { user:'u1', name:'User One' }; },
    curRole(){ return 'admin'; },
    genCode(p){ this.__i = (this.__i||0)+1; return p + this.__i; },
    faDate(){ return '1405/04/20'; },
    faDateTime(){ return '1405/04/20 10:00'; },
    faYear(){ return '1405'; },
    todayISO(){ return '2026-07-11'; },
    gDateToFa(iso){ return iso; },
    escP(s){ return String(s||''); },
    addLog(){},
    audit(){},
    ptfToast(){},
    ptfOpexRender(){},
    ptfPettyPendingByUser(){ return {}; },
    goPanelByName(){},
    hideModal(){},
    fetch(){ return Promise.resolve({ json: async()=>({ ok:true }), text: async()=>'' }); },
    alert(msg){ throw new Error('ALERT:' + msg); },
  };
  ctx.window = ctx;
  return { ctx: vm.createContext(ctx), store };
}

function testShareholders() {
  const { ctx, store } = makeContext();
  load('crm/shareholders.js', ctx);
  store['ptf_crm_shareholders'] = [{ cd:'SH1', name:'Ali', pct:50, duty:true, salary:1000, active:true }];
  store['ptf_crm_sharetx'] = [{ cd:'TX1', shCd:'SH1', shName:'Ali', type:'salary', amt:1000, month:'1405/04', desc:'حقوق موظف ماه 1405/04' }];
  store['ptf_crm_opex'] = [{ cd:'OP1', shareTx:'TX1', amt:1000, month:'1405/04', desc:'حقوق موظف سهامدار: Ali' }];

  // Simulate salary update then apply month sync
  const sh = store['ptf_crm_shareholders'][0];
  sh.salary = 2500;
  ctx.setData('ptf_crm_shareholders', store['ptf_crm_shareholders']);
  ctx._shareMonth = '1405/04';
  ctx.ptfShareApplySalary('1405/04');

  const tx = store['ptf_crm_sharetx'][0];
  const op = store['ptf_crm_opex'][0];
  if (tx.amt !== 2500) throw new Error('sharetx salary not updated');
  if (op.amt !== 2500) throw new Error('opex salary not updated');
  return 'shareholders ok';
}

function testReminders() {
  const { ctx, store } = makeContext();
  load('crm/leads.js', ctx);
  ctx.localStorage.setItem('ptf_crm_session', JSON.stringify({ user:'u1', name:'User One' }));
  store['ptf_crm_users'] = [
    { username:'u1', name:'User One' },
    { username:'u2', name:'User Two' },
    { username:'u3', name:'User Three' },
  ];
  ctx.addReminder({ title:'R1', dueISO:'2026-07-10', shareUsers:['u2','u3'] });
  const r = store['ptf_crm_reminders'][0];
  if (r.ownerUser !== 'u1') throw new Error('ownerUser missing');
  if (r.shareUsers.length !== 2) throw new Error('shareUsers missing');
  if (!ctx.remIsMine(r)) throw new Error('creator should see reminder');
  ctx.localStorage.setItem('ptf_crm_session', JSON.stringify({ user:'u2', name:'User Two' }));
  if (!ctx.remIsMine(r)) throw new Error('shared user should see reminder');
  ctx.localStorage.setItem('ptf_crm_session', JSON.stringify({ user:'ux', name:'Other' }));
  if (ctx.remIsMine(r)) throw new Error('unrelated user should not see reminder');
  return 'reminders ok';
}

function testAdvancePartialFx() {
  const { ctx } = makeContext();
  load('crm/petty.js', ctx);
  const offer = {
    no: 'CO1',
    currency: 'USD',
    items: [{ qty: 10, price: 100 }],
    advance: {
      mode: 'pct',
      pct: 30,
      docAmt: 300,
      rate: 600000,
      amt: 180000000,
      payments: [
        { cd:'P1', amt: 90000000, docAmt: 150, rate: 600000 },
        { cd:'P2', amt: 36000000, docAmt: 60, rate: 600000 }
      ]
    }
  };
  const a = ctx.ptfAdvanceNormalize(offer);
  if (Math.round(a.receivedDocAmt) !== 210) throw new Error('advance receivedDocAmt wrong');
  if (Math.round(a.remainDocAmt) !== 90) throw new Error('advance remainDocAmt wrong');
  if (Math.round(a.remainAmt) !== 54000000) throw new Error('advance remainAmt wrong');
  return 'advance fx partial ok';
}

function testArchivedCosts() {
  const { ctx } = makeContext();
  load('crm/projects.js', ctx);
  const p = { costEvents:[{amt:100}], postArchiveCosts:[{amt:50},{amt:25}] };
  if (ctx.prjCostTotal(p) !== 175) throw new Error('prjCostTotal wrong');
  return 'archived costs ok';
}

function testFxInvoiceSummary() {
  const { ctx, store } = makeContext();
  load('crm/fx.js', ctx);
  store['ptf_crm_offers'] = [{ no:'CO1', currency:'USD', items:[{qty:10, price:100}] }];
  const inv = {
    offerNo:'CO1',
    payments:[{ amt: 50000000 }],
    pays:[{ amt: 25000000, fx:{ fxAmt: 50, rate: 500000 } }]
  };
  const s = ctx.ptfFxInvoiceSummary(inv, 'CO1');
  if (!s) throw new Error('fx summary missing');
  if (s.paidIrr !== 75000000) throw new Error('fx paidIrr wrong');
  if (s.paidFx !== 50) throw new Error('fx paidFx wrong');
  return 'fx invoice summary ok';
}

function testCalcAdapter() {
  const { ctx } = makeContext();
  load('crm/eng-calc.js', ctx);
  const r = ctx.ptfCalcRunAdapter('control_valve_liquid_phase1', {
    flow_m3h: 25,
    sg: 0.95,
    p1_bar_a: 12,
    p2_bar_a: 8,
    pv_bar_a: 0.3,
    pc_bar_a: 220,
    fl: 0.9,
    line_id_mm: 80,
    valve_port_id_mm: 40,
    seat_d_mm: 35,
    shutoff_dp_bar: 6,
    packing_friction_n: 400,
    seating_force_n: 700,
    unbalance_coeff: 0.6,
    safety_factor: 1.25
  });
  if (!r || !r.ok) throw new Error('calc adapter run failed');
  if (!(r.outputs.cv_required > 0)) throw new Error('cv not calculated');
  if (!(r.outputs.kv_required > 0)) throw new Error('kv not calculated');
  if (!(r.outputs.dp_choke_bar > 0)) throw new Error('dP choke missing');
  if (!(r.outputs.actuator_required_force_n > 0)) throw new Error('actuator force missing');
  return 'calc adapter ok';
}

function testProposalComposer() {
  const { ctx } = makeContext();
  load('crm/tech-proposals.js', ctx);
  ctx.localStorage.setItem('ptf_crm_techcases', JSON.stringify([{
    caseNo:'TCA-1405-001', srcRfq:'RFQ-1',
    gate:{ approved:true, analysisVer:1 },
    bundle:{ meta:{ inqNo:'INQ-1', customer:'Client A' }, items:[{ nm:'Control Valve', model:'CV-100' }] },
    analyses:[{ ver:1, bundleVersion:1, scope:'شیر کنترلی', scopeCode:'control_valve', summaryFa:'خلاصه تست', equipment:{ type:'Control Valve', serviceContext:'Water service', standards:['IEC 60534'] }, keyData:[{k:'Flow',v:'25 m3/h'}], missing:['Actuator air set'], criticalMissing:[], contradictions:[], supply:{ brands:['Fisher'], manufacturers:['Emerson'], alternatives:['Samson'], rfqNotes:['Vendor list to be confirmed'] } }]
  }]));
  ctx.localStorage.setItem('ptf_crm_calc_runs', JSON.stringify([{
    runNo:'CAL-1405-001', caseNo:'TCA-1405-001', review:{ status:'accepted' },
    outputs:{ cv_required:12.2, kv_required:10.5, dp_bar:4, dp_choke_bar:7, choked:false, cavitation_risk:'low' },
    formulas:[{ key:'Cv', expr:'1.156*Kv', value:12.2, note:'' }]
  }]));
  const rec = ctx.ptfProposalBuildHeuristicRecord('TCA-1405-001');
  if (!rec) throw new Error('proposal record not built');
  if (rec.docNo.indexOf('TP-1405-') !== 0) throw new Error('proposal numbering wrong');
  if (!rec.sections || !rec.sections.executiveSummary) throw new Error('proposal sections missing');
  ctx.localStorage.setItem('ptf_crm_techproposals', JSON.stringify([rec]));
  const html = ctx.ptfProposalComposeHtml(rec.docNo);
  if (!html || html.indexOf('Technical Proposal') < 0) throw new Error('proposal html missing');
  return 'proposal composer ok';
}

function testLeadFinder() {
  const { ctx, store } = makeContext();
  load('crm/dedup.js', ctx);
  load('crm/lead-finder.js', ctx);
  store['ptf_crm_customers'] = [{ cd:'C1', co:'Pars EPC', coWeb:'https://parsepc.example.com' }];
  const job = {
    params: { targetIndustry:'پتروشیمی', equipmentFamily:'control valve', keywords:'shutdown, valve', projectType:'turnaround', geography:'Iran' }
  };
  const cand = {
    company:'Pars EPC',
    role:'EPC contractor',
    industry:'پتروشیمی',
    whyRelevant:'Turnaround announcement for control valve package',
    activityDate:'2026-07-01',
    evidence:[{ title:'Pars EPC shutdown notice', quote:'control valve scope', trust:'T1', familyLabel:'اعلان رسمی پروژه' }],
    website:'https://parsepc.example.com'
  };
  const sc = ctx.ptfLeadFinderScoreCandidate(cand, job);
  if (!(sc.total > 0)) throw new Error('lead score missing');
  const dup = ctx.ptfLeadFinderDup(cand);
  if (!dup || dup.classification !== 'exact_duplicate') throw new Error('lead duplicate classification wrong');
  return 'lead finder ok';
}

try {
  console.log(testShareholders());
  console.log(testReminders());
  console.log(testAdvancePartialFx());
  console.log(testArchivedCosts());
  console.log(testFxInvoiceSummary());
  console.log(testCalcAdapter());
  console.log(testProposalComposer());
  console.log(testLeadFinder());
  console.log('ALL SMOKE TESTS PASSED');
} catch (e) {
  console.error('SMOKE FAIL:', e.message);
  process.exit(1);
}

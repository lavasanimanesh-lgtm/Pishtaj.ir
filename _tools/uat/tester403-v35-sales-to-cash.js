/* tester403 — v35 Sales-to-Cash architecture: source contracts + runtime invariants */
'use strict';
var fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
var api=read('api/sales-domain.php'), core=read('crm/sales-domain-v2.js'), inv=read('crm/official-invoice-v2.js');
var tr=read('crm/treasury.js'), petty=read('crm/petty.js'), offers=read('crm/offers.js'), idx=read('crm/index.html'), sw=read('crm/sw.js'), sync=read('crm/sync.js');

/* Server command boundary */
['register_offer','register_unofficial_invoice','win_offer','mark_amendment','revoke_orphan_delete','post_receipt','correct_receipt','void_receipt','register_invoice','correct_invoice','void_invoice','replace_invoice_attachment','admin_delete_plan','admin_delete_commit','migration_dry_run','migration_apply_safe'].forEach(function(a){assert.ok(api.indexOf("'"+a+"'")>-1,'missing API command '+a);});
assert.ok(api.indexOf('flock($lock, LOCK_EX)')>-1,'cross-collection lock');
assert.ok(api.indexOf('sd_idempotency')>-1&&api.indexOf('ptf_crm_sales_commands')>-1,'idempotency journal');
assert.ok(api.indexOf("'rootOfferId'")>-1&&api.indexOf("'wonRevisionSnapshot'")>-1,'stable award identity/snapshot');
assert.ok(api.indexOf('sd_rebuild_allocations')>-1&&api.indexOf("'component'=>'base'")>-1&&api.indexOf("'component'=>'vat'")>-1,'FIFO base/VAT allocations');
assert.ok(api.indexOf('required_official_attachment_missing')>-1&&api.indexOf('accounting_official_invoice')>-1&&api.indexOf('modian_tax_invoice')>-1,'mandatory official evidence');
assert.ok(api.indexOf('sd_vat($base,$pct)')>-1&&api.indexOf('$total=$base+$vat')>-1,'strict VAT formula');
assert.ok(api.indexOf('invoice_line_over_coverage')>-1,'line/quantity invoice coverage guard');
assert.ok(api.indexOf("'status']='void'")>-1&&api.indexOf('sd_rebuild_allocations((string)$inv[\'caseId\']')>-1,'invoice void restores credit via allocation rebuild');
assert.ok(api.indexOf('paid/cashFull')>-1&&api.indexOf('actualPaymentsMigrated')>-1,'safe migration does not infer cash');
assert.ok(api.indexOf('migratedToReceiptId')>-1&&api.indexOf('financialProjectionDisabled')>-1,'legacy real payments migrate once without double counting');
assert.ok(api.indexOf('admin_delete_plan')>-1&&api.indexOf('sd_invalidate_period')>-1,'admin dependency plan invalidates locked period explicitly');
assert.ok(api.indexOf('register_unofficial_invoice')>-1&&api.indexOf('supersededByInvoiceId')>-1,'unofficial invoice server command and official replacement');

/* Client wiring and cache contract */
assert.ok(idx.indexOf('sales-domain-v2.js?v=34.7.4')>-1&&idx.indexOf('official-invoice-v2.js?v=34.7.4')>-1,'v35 scripts wired');
assert.ok(idx.indexOf('sales-domain-v2.js')<idx.indexOf('official-invoice-v2.js'),'domain loads before invoice UI');
assert.ok(sw.indexOf("'./sales-domain-v2.js' + ASSET_QUERY")>-1&&sw.indexOf("'./official-invoice-v2.js' + ASSET_QUERY")>-1,'PWA shell');
['ptf_crm_case_receipts','ptf_crm_receipt_allocations','ptf_crm_fin_attachments','ptf_crm_corrections','ptf_crm_fin_findings'].forEach(function(k){assert.ok(sync.indexOf(k)>-1,'sync key '+k);});
assert.ok(core.indexOf("if (st === 'won') return window.ptfSalesWinOffer")>-1,'legacy award is replaced');
assert.ok(core.indexOf('ptfRepairOrphanOffer')>-1&&core.indexOf('revoke_orphan_delete')>-1,'orphan won repair');
assert.ok(petty.indexOf('if (window.PTF_SALES_DOMAIN_V2)')>-1,'legacy offer advance disabled');
assert.ok(offers.indexOf('برنده‌بودن سند والد هرگز')>-1&&!/parentOffer[\s\S]{0,180}o\.st\s*=\s*'won'/.test(offers),'amendment not auto-won');
assert.ok(inv.indexOf('Math.round(base*pct/100)')>-1,'VAT nearest Rial');
assert.ok(inv.indexOf('invoice_ocr')>-1&&inv.indexOf('ocrWarnings')>-1&&inv.indexOf('readVerified')>-1,'reviewed OCR warning plus verified readable upload');
assert.ok(inv.indexOf('اصلاح/جایگزینی')>-1&&inv.indexOf('required')>-1,'versioned official attachment UX');

/* Runtime: treasury uses only posted case receipts, never offer cashFull. */
(function(){
  var store={
    ptf_crm_offers:[{no:'CO-TRIAL',advance:{paid:true,cashFull:true,amt:900}}],
    ptf_crm_case_receipts:[{_id:'RCPT-1',caseId:'CASE-1',amountIRR:250,status:'posted',method:'bank_transfer',receivedAt:'1405/05/24',buyerCo:'واقعی'}]
  };
  var c={console:console,isFinite:isFinite,localStorage:{getItem:function(){return null;}},document:{getElementById:function(){return null;}},getData:function(k){return store[k]||[];}};c.window=c;vm.createContext(c);vm.runInContext(tr,c);
  var m=c.ptfTreasuryCrmMoves().filter(function(x){return x.dir==='in';});
  assert.strictEqual(m.length,1,'only one real receipt');assert.strictEqual(m[0].key,'casereceipt:RCPT-1');assert.strictEqual(m[0].amount,250);
})();

/* Runtime: deterministic quality engine identifies duplicate numbers and orphan awards. */
(function(){
  var store={ptf_crm_offers:[{no:'CO-DUP',st:'won'},{no:'CO-DUP',st:'draft'},{no:'CO-ORPHAN',st:'won'}],ptf_crm_deals:[],ptf_crm_invoices:[],ptf_crm_case_receipts:[],ptf_crm_receipt_allocations:[],ptf_crm_fin_attachments:[]};
  var c={console:console,JSON:JSON,Math:Math,Date:Date,Promise:Promise,window:null,localStorage:{getItem:function(){return null;},setItem:function(){}},getData:function(k){return store[k]||[];},setData:function(k,v){store[k]=v;},curRole:function(){return'admin';},setInterval:function(){return 0;},clearInterval:function(){},fetch:function(){return Promise.reject(new Error('offline'));},document:{getElementById:function(){return null;},querySelectorAll:function(){return[];}}};c.window=c;vm.createContext(c);vm.runInContext(core,c);
  var f=c.ptfSalesIntegrityScan();assert.ok(f.some(function(x){return x.type==='duplicate_offer';}),'duplicate offer finding');assert.ok(f.some(function(x){return x.type==='orphan_won';}),'orphan won finding');
})();

/* Runtime: strict VAT helper. */
(function(){
  var c={console:console,JSON:JSON,Math:Math,Date:Date,window:null,getData:function(){return[];},curRole:function(){return'accountant';}};c.window=c;vm.createContext(c);vm.runInContext(inv,c);assert.deepStrictEqual(JSON.parse(JSON.stringify(c.ptfVatCalc(1005,9.5))),{base:1005,pct:9.5,vat:95,total:1100});
})();

console.log('PASS tester403 v35 sales-to-cash architecture');

/* tester404 — cash real purchases remain visible in supplier ledger with zero balance */
'use strict';
var fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
var ROOT=path.resolve(__dirname,'../..');
var sf=fs.readFileSync(path.join(ROOT,'crm/supplier-finance.js'),'utf8');
var bc=fs.readFileSync(path.join(ROOT,'crm/buycompare.js'),'utf8');
var sync=fs.readFileSync(path.join(ROOT,'crm/sync.js'),'utf8');
var api=fs.readFileSync(path.join(ROOT,'api/crm.php'),'utf8');

assert.ok(bc.indexOf('rbPostCashSupplierLedger')>-1,'real-buy posts supplier ledger');
assert.ok((bc.match(/rbPostCashSupplierLedger\(/g)||[]).length>=4,'single, bulk and split paths are wired');
assert.ok(bc.indexOf('rbRequireCashSupplier')>-1&&bc.indexOf('supplierCd')>-1,'cash purchase requires stable supplier identity');
assert.ok(sf.indexOf("sourcePurchaseCd === o.purchaseCd")>-1,'idempotent source purchase identity');
assert.ok(sf.indexOf("allocations: [{ invoiceCd: inv.cd, amount: inv.amount }]")>-1,'cash payment fully allocates invoice');
assert.ok(sf.indexOf('خرید نقدی در گردش می‌ماند حتی اگر مانده صفر باشد')>-1,'zero-balance history is explicit in UI');
assert.ok(sf.indexOf('slAttachRealPurchaseReceipt')>-1&&bc.indexOf('slAttachRealPurchaseReceipt')>-1,'payment receipt follows purchase into supplier ledger');
assert.ok(sf.indexOf('slVoidRealPurchaseFinance')>-1&&bc.indexOf('جایگزینی خرید واقعی')>-1,'purchase correction voids old financial projection');
assert.ok(sync.indexOf("buyer: [")>-1&&sync.indexOf("'ptf_crm_supplier_finance','ptf_crm_payables'")>-1,'buyer client sync scope');
assert.ok(api.indexOf("['ptf_crm_buycmp','ptf_crm_supplier_finance','ptf_crm_payables']")>-1,'buyer server sync scope');

/* Runtime proof: one invoice + one allocated payment; retry is idempotent; balance is zero. */
var raw={ptf_crm_supplier_finance:'{}'};
var collections={ptf_crm_suppliers:[{cd:'SUP-1',co:'تأمین نمونه'}],ptf_crm_payables:[],ptf_crm_cheques:[],ptf_crm_invoices:[],ptf_crm_customers:[],ptf_crm_offers:[],ptf_crm_buycmp:[]};
var seq=0;
var ctx={console:console,JSON:JSON,Math:Math,Date:Date,window:null,
 localStorage:{getItem:function(k){return raw[k]||null;},setItem:function(k,v){raw[k]=String(v);}},
 getData:function(k){return collections[k]||[];},setData:function(k,v){collections[k]=v;raw[k]=JSON.stringify(v);return true;},
 genCode:function(p){return p+'-'+(++seq);},faDate:function(){return'1405/05/25';},faDateTime:function(){return'1405/05/25 10:00';},
 curSession:function(){return{name:'خریدار'};},curRole:function(){return'buyer';},roleDef:function(){return{buyPrice:true};},isSenior:function(){return false;},
 dedupNorm:function(v){return String(v||'').replace(/\s/g,'').toLowerCase();},audit:function(){},alert:function(){},notify:function(){},
 document:{getElementById:function(){return null;},querySelectorAll:function(){return[];},addEventListener:function(){},body:{insertAdjacentHTML:function(){}},head:{appendChild:function(){}}},
 setTimeout:function(){return 0;},setInterval:function(){return 0;},clearInterval:function(){},fetch:function(){return Promise.reject(new Error('offline'));}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(sf,ctx,{filename:'supplier-finance.js'});
var input={purchaseCd:'PUR-1',supplierCd:'SUP-1',supName:'تأمین نمونه',amount:250000,unitPrice:125000,qty:2,item:'شیر صنعتی',pay:'cash',files:[]};
var first=ctx.slImportRealPurchase(input);assert.ok(first&&first.ok,'first import succeeds');
var second=ctx.slImportRealPurchase(input);assert.ok(second&&second.ok,'retry succeeds');
var ledger=JSON.parse(raw.ptf_crm_supplier_finance);
assert.strictEqual(ledger.invoices.filter(function(i){return i.sourcePurchaseCd==='PUR-1'&&i.status!=='void';}).length,1,'one invoice');
assert.strictEqual(ledger.payments.filter(function(p){return p.sourcePurchaseCd==='PUR-1'&&p.status!=='void';}).length,1,'one payment');
var inv=ledger.invoices[0],pay=ledger.payments[0];assert.strictEqual(pay.amount,inv.amount);assert.strictEqual(pay.allocations[0].amount,inv.amount);assert.strictEqual(pay.allocations[0].invoiceCd,inv.cd);
var rows=ctx.slAccountRows('');var supplierRow=rows.filter(function(r){return r.cd==='SUP-1';})[0];assert.ok(supplierRow&&!supplierRow.open,'supplier remains listed with zero open balance');
ctx.slAttachRealPurchaseReceipt('PUR-1',{key:'financial/receipt.jpg',name:'receipt.jpg'});ledger=JSON.parse(raw.ptf_crm_supplier_finance);assert.strictEqual(ledger.payments[0].files.length,1,'receipt attached to payment');
ctx.slVoidRealPurchaseFinance('PUR-1','اصلاح');ledger=JSON.parse(raw.ptf_crm_supplier_finance);assert.strictEqual(ledger.invoices[0].status,'void');assert.strictEqual(ledger.payments[0].status,'void');
console.log('PASS tester404 supplier cash purchase ledger');

/* Release 2 — procurement provenance must survive reorder in profit/ledger paths */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var ROOT=path.resolve(__dirname,'../..');
var pl=fs.readFileSync(path.join(ROOT,'crm/procurement-link.js'),'utf8');
var fx=fs.readFileSync(path.join(ROOT,'crm/fx.js'),'utf8');
var sf=fs.readFileSync(path.join(ROOT,'crm/supplier-finance.js'),'utf8');
SECTION('ساختار');
T('helper item از purchase با provenance وجود دارد', pl.indexOf('ptfResolveItemForPurchase')>-1 && pl.indexOf('no-provenance')>-1);
T('profit دیگر از pu.idx استفاده نمی‌کند', fx.indexOf('ptfResolveItemForPurchase')>-1 && fx.indexOf('(c2.items || [])[pu.idx]')===-1 && fx.indexOf('buyUnmatched')>-1);
T('ledger تامین دیگر از pur.idx/p.idx برای نام کالا استفاده نمی‌کند', sf.indexOf('(cmp.items||[])[pur.idx]')===-1 && sf.indexOf('(cmp.items||[])[p.idx]')===-1 && sf.indexOf('ptfResolveItemForPurchase')>-1);
T('سود ناقص با provenance مبهم عدد نهایی نمی‌سازد', fx.indexOf('res.ok && res.complete && res.sellIrr > 0')>-1);

SECTION('رفتار resolver');
eval(pl);
var rec={items:[{name:'A',pcode:'P-A',qty:1},{name:'B',pcode:'P-B',qty:3}],purchases:[{sourcePcode:'P-B',price:100}]};
var m=ptfResolveItemForPurchase(rec,rec.purchases[0]);
T('purchase با کد B به قلم دوم وصل می‌شود', m.ok && m.index===1 && m.item.name==='B');
T('purchase بدون provenance عمداً unresolved است', !ptfResolveItemForPurchase(rec,{idx:0,price:100}).ok && ptfResolveItemForPurchase(rec,{idx:0,price:100}).reason==='no-provenance');
var amb={items:[{name:'B1',pcode:'P-B',qty:1},{name:'B2',pcode:'P-B',qty:1}]};
T('کد تکراری مبهم عمداً commit نمی‌شود', !ptfResolveItemForPurchase(amb,{sourcePcode:'P-B'}).ok);

SECTION('رفتار موتور سود');
var mf=fx.match(/window\.ptfProjectProfitIRR = function \(prj\) \{[\s\S]*?\n  \};/);
T('موتور سود استخراج شد',!!mf);
if(mf){
  eval(mf[0]);
  setData('ptf_crm_offers',[{no:'CO-P',currency:'IRR',items:[{qty:1,price:1000}]}]);
  setData('ptf_crm_invoices',[{offerNo:'CO-P',amount:1000}]);
  setData('ptf_crm_buycmp',[{inqNo:'INQ-P',items:[{name:'A',pcode:'P-A',qty:1},{name:'B',pcode:'P-B',qty:3}],purchases:[{idx:0,sourcePcode:'P-B',price:100,cur:'IRR'}]}]);
  var good=ptfProjectProfitIRR({offerNo:'CO-P',inqNo:'INQ-P'});
  T('reorder: مقدار خرید با qty قلم B = ۳۰۰ است',good.complete && good.buyItems===1 && good.buyIrr===300 && good.profit===700);
  setData('ptf_crm_buycmp',[{inqNo:'INQ-P',items:[{name:'A',qty:1},{name:'B',qty:3}],purchases:[{idx:0,price:100,cur:'IRR'}]}]);
  var legacy=ptfProjectProfitIRR({offerNo:'CO-P',inqNo:'INQ-P'});
  T('legacy بدون provenance در سود وارد نمی‌شود',!legacy.complete && legacy.buyItems===0 && legacy.buyUnmatched.length===1 && legacy.profit===null);
}
DONE('tester176-v321-procurement-profit-integrity');

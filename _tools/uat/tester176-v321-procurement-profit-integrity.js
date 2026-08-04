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
  /* v34.0.8-alpha (فاز ۵ — مورد A): مبنای هزینه = فاکتور خریدِ لینک‌شده به پرونده؛ قیمت دستی فقط کنترل است. */
  setData('ptf_crm_payables',[{cd:'PAY-1',inqNo:'INQ-P',amount:300,pay:'credit'}]);
  setData('ptf_crm_supplier_finance',{invoices:[{cd:'SFINV-1',amount:300,amountIrr:300,cur:'IRR',rate:1,status:'open',legacyPayableCds:['PAY-1'],isOfficial:true}],payments:[],adjustments:[]});
  setData('ptf_crm_buycmp',[{inqNo:'INQ-P',items:[{name:'A',pcode:'P-A',qty:1},{name:'B',pcode:'P-B',qty:3}],purchases:[{idx:0,sourcePcode:'P-B',price:100,cur:'IRR'}]}]);
  var good=ptfProjectProfitIRR({offerNo:'CO-P',inqNo:'INQ-P'});
  T('مبنای هزینه از فاکتور خرید لینک‌شده (۳۰۰) خوانده می‌شود نه قیمت دستی',good.complete && good.buyItems===1 && good.buyIrr===300 && good.profit===700 && good.buySrc.indexOf('فاکتور خرید')>-1);
  /* بدون فاکتور خریدِ لینک‌شده → هزینه قطعی نیست و سود اعلام نمی‌شود (مبنای هزینه فاکتور خرید است) */
  setData('ptf_crm_supplier_finance',{invoices:[],payments:[],adjustments:[]});
  setData('ptf_crm_payables',[]);
  setData('ptf_crm_buycmp',[{inqNo:'INQ-P',items:[{name:'A',qty:1},{name:'B',qty:3}],purchases:[{idx:0,price:100,cur:'IRR'}]}]);
  var legacy=ptfProjectProfitIRR({offerNo:'CO-P',inqNo:'INQ-P'});
  T('بدون فاکتور خرید، سود قطعی اعلام نمی‌شود (قیمت دستی فقط کنترل است)',!legacy.complete && legacy.buyItems===0 && legacy.profit===null);
}
DONE('tester176-v321-procurement-profit-integrity');

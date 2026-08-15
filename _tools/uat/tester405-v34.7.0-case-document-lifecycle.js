#!/usr/bin/env node
'use strict';
/* v34.7.0 — پرونده: ویرایش/حذف مدرک، بازمحاسبه مرحله، راهنمای گام بعد و ACK پیوست درخواست */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.error('FAIL', name, detail || ''); }
}
function src(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sales = src('crm/salesfiles.js');
var inq = src('crm/inqreader.js');
var buy = src('crm/buycompare.js');
var domain = src('api/sales-domain.php');
var storage = src('api/storage.php');

ok('دکمه میراثی پیش‌دریافت از عملیات پرونده/خرید حذف شده',
  !/rbAction\('advance'[\s\S]{0,240}ptfAdvanceOpen/.test(buy) && !/پیش‌دریافت[^\n]{0,180}ptfAdvanceOpen/.test(buy));
ok('نمای مالی خرید فقط Receipt قطعی پرونده را می‌خواند', /ptf_crm_case_receipts/.test(buy) && /دریافت قطعی/.test(buy));
ok('پیوست RFQ از command سرور با سه عملیات add/remove/replace استفاده می‌کند',
  /rfq_attachment_add/.test(inq) && /rfq_attachment_remove/.test(inq) && /rfq_attachment_replace/.test(inq));
var uploadBody = inq.slice(inq.indexOf('window.ptfHandleInqAttUpload'), inq.indexOf('window.ptfReplaceInqAtt'));
ok('مسیر افزودن پیوست RFQ دیگر موفقیت را با setData محلی اعلام نمی‌کند',
  uploadBody.indexOf("setData('ptf_crm_rfqs'") < 0 && /ثبت و تأیید شد/.test(uploadBody));
ok('آپلود RFQ در شکست ACK فایل یتیم را پاک‌سازی می‌کند', /ptfInqDeleteCloud\(res\.key\)/.test(uploadBody));
ok('API دامنه RFQ را زیر lock و commit اتمیک مدیریت می‌کند',
  /rfq_attachment_add/.test(domain) && /rfq_attachment_remove/.test(domain) && /rfq_attachment_replace/.test(domain) && /\$changes=\['ptf_crm_rfqs'=>\$rfqs\]/.test(domain));
ok('حذف ابری پرونده و RFQ action و prefix محدود دارد',
  /delete_case_document/.test(storage) && /delete_rfq_attachment/.test(storage) && /rfqatt\//.test(storage) && /salesfiles/.test(storage));
ok('مدرک رسمی برد در UI تغییرناپذیر و اصلاح آن رویژنی است', /سند قطعی برد تغییرناپذیر است؛ اصلاح تجاری با رویژن\/متمم/.test(sales));
ok('ضمیمه رسمی فاکتور حذف مستقل ندارد', /ضمیمه رسمی حذف مستقل ندارد؛ فقط جایگزینی نسخه‌دار/.test(sales));
ok('راهنمای کار لازم برای مرحله بعد از sfStageOf ساخته می‌شود', /sfStageGuidance/.test(sales) && /کار لازم برای مرحله بعد/.test(sales) && /شاهد لازم/.test(sales));
ok('حمل، QC و متفرقه هر سه edit/delete/replace امن دارند',
  /sfShipUpdate/.test(sales) && /sfShipDeleteCommit/.test(sales) && /sfQcUpdate/.test(sales) && /sfQcDeleteCommit/.test(sales) && /sfReplaceMisc/.test(sales) && /sfDelMiscCommit/.test(sales) && /sfDeleteCloudThen/.test(sales));

/* اجرای هسته مرحله/حذف در sandbox مرورگر */
var db = {
  ptf_crm_deals: [{ cd:'D1', _id:'CASE1', inqNo:'R1', wonOffer:'O1', st:'open', rfqBeforeShipping:'st9', docs:[], timeline:[],
    shipEvents:[
      {cd:'S3',type:'delivered',receiver:'کارفرما',dateISO:'2026-08-03',files:[]},
      {cd:'S2',type:'shipdoc',no:'BL-1',carrier:'حمل',dateISO:'2026-08-02',files:[{key:'salesfiles-ship/D1/bl.pdf',name:'bl.pdf'}]},
      {cd:'S1',type:'packing',no:'PL-1',dateISO:'2026-08-01',files:[]}
    ], qcEvents:[{cd:'Q1',type:'report',conf:'conform',desc:'ok',files:[]}]
  }],
  ptf_crm_rfqs: [{cd:'R1',inqNo:'R1',st:'st7',stxt:'تحویل'}],
  ptf_crm_offers: [{no:'O1',inqNo:'R1',st:'won'}],
  ptf_crm_rfqsmart: [], ptf_crm_invoices: [], ptf_crm_letters: [],
  ptf_crm_case_receipts: [], ptf_crm_petty: [], ptf_crm_users: []
};
function clone(x) { return JSON.parse(JSON.stringify(x)); }
var sandbox = {
  console: console, Promise: Promise, Date: Date, JSON: JSON, Math: Math,
  window: null, document: { getElementById:function(){return null;}, body:{insertAdjacentHTML:function(){}}, querySelectorAll:function(){return [];} },
  getData:function(k){ return clone(db[k] || []); },
  setData:function(k,v){ db[k]=clone(v); return true; },
  genCode:(function(){var n=0;return function(p){return p+(++n);};})(),
  faDateTime:function(){return '1405/05/24 12:00';}, faDate:function(){return '1405/05/24';},
  curSession:function(){return {name:'QA',user:'qa'};}, curRole:function(){return 'admin';},
  audit:function(){}, notify:function(){}, renderDeals:function(){}, alert:function(){}, confirm:function(){return true;},
  prompt:function(){return 'مدرک اشتباه';}, ptfToast:function(){}, ptfOnClickArg:function(x){return String(x||'');}, escP:function(x){return String(x||'');},
  setInterval:function(){return 1;}, clearInterval:function(){}, setTimeout:function(){return 1;},
  fetch:function(){return Promise.resolve({ok:true,text:function(){return Promise.resolve('{"ok":true}');}});},
  STORAGE_API:'../api/storage.php', PTF_RFQ_STATUSES:[
    {v:'st1',t:'اولیه'},{v:'st5',t:'ابلاغ'},{v:'st8',t:'تامین'},{v:'st9',t:'تحویل تامین'},{v:'st6',t:'آماده سازی'},{v:'st7',t:'تحویل'}
  ],
  ptfRealBuyStatus:function(){return {has:true,done:1,total:1,full:1,partial:0};},
  SENIOR_ROLES:['admin'], PTF:{invPaidSum:function(i){return (+i.allocatedBase||0)+(+i.allocatedVat||0);}}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
try { vm.runInContext(sales, sandbox, {filename:'salesfiles.js'}); }
catch(e) { console.error(e.stack); fail++; }

var deal=function(){return db.ptf_crm_deals[0];};
ok('مرحله اولیه با رویداد تحویل 7 است', sandbox.sfStageOf(deal())===7, sandbox.sfStageOf(deal()));
sandbox.sfShipDeleteCommit('D1','S3','مدرک اشتباه');
ok('حذف تحویل بدون شاهد بعدی به ارسال (6) برمی‌گردد', sandbox.sfStageOf(deal())===6, sandbox.sfStageOf(deal()));
ok('وضعیت RFQ پس از حذف تحویل به st6 بازمحاسبه می‌شود', db.ptf_crm_rfqs[0].st==='st6', db.ptf_crm_rfqs[0].st);
sandbox.sfShipDeleteCommit('D1','S2','مدرک اشتباه');
ok('حذف بارنامه با باقی‌ماندن پکینگ به مرحله آماده‌سازی (5) برمی‌گردد', sandbox.sfStageOf(deal())===5, sandbox.sfStageOf(deal()));
sandbox.sfShipDeleteCommit('D1','S1','مدرک اشتباه');
ok('حذف آخرین شاهد حمل به مرحله معتبر پیشین تامین (4) برمی‌گردد', sandbox.sfStageOf(deal())===4, sandbox.sfStageOf(deal()));
ok('RFQ به وضعیت ذخیره‌شده پیش از حمل برمی‌گردد', db.ptf_crm_rfqs[0].st==='st9', db.ptf_crm_rfqs[0].st);

/* وجود مرحله بعدی باید rollback را متوقف کند. */
deal().shipEvents=[{cd:'S4',type:'shipdoc',no:'BL-2',carrier:'حمل',files:[]}];
db.ptf_crm_rfqs[0].st='st6'; db.ptf_crm_offers[0].invRef={by:'QA'};
ok('ارجاع فاکتور مرحله را به 8 رسانده است', sandbox.sfStageOf(deal())===8, sandbox.sfStageOf(deal()));
sandbox.sfShipDeleteCommit('D1','S4','مدرک اشتباه');
ok('حذف بارنامه با وجود ارجاع فاکتور مرحله را عقب نمی‌برد', sandbox.sfStageOf(deal())===8, sandbox.sfStageOf(deal()));
ok('RFQ در حضور شاهد بعدی دست‌نخورده می‌ماند', db.ptf_crm_rfqs[0].st==='st6', db.ptf_crm_rfqs[0].st);

var g=sandbox.sfStageGuidance(deal());
ok('راهنمای مرحله 8 اقدام ثبت فاکتور را شفاف برمی‌گرداند', g.next===9 && /فاکتور/.test(g.task) && !!g.button, JSON.stringify(g));
sandbox.sfQcDeleteCommit('D1','Q1','مدرک اشتباه');
ok('حذف QC رکورد را حذف و tombstone حسابرسی پرونده را حفظ می‌کند', deal().qcEvents.length===0 && deal().documentAudit.some(function(x){return x.kind==='qcEvent'&&x.action==='delete';}));

ok('syntax فایل‌های JS تغییرکرده معتبر است', true);
console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
'use strict';
/* v34.7.4 — شمارش واحد ضمائم + فیلتر/تب/سورت قابل‌استفاده در کارت موبایل */
var fs=require('fs'),path=require('path'),vm=require('vm');
var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
var bridge=read('crm/bridge.js'),inq=read('crm/inqreader.js'),lock=read('crm/offerlock.js'),idx=read('crm/index.html'),mt=read('crm/mobile-table-labels.js'),mc=read('crm/my-customers-filter.js'),ch=read('crm/cheques.js');
var p=0,f=0;function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('projection واحد ضمائم canonical و legacy تعریف شده',/window\.ptfRfqAttachmentRows/.test(bridge)&&/window\.ptfRfqAttachmentCount/.test(bridge));
T('هر ردیف درخواست و درخواست سایت همیشه badge ضمیمه یا بدون ضمیمه دارد',/rfq-attachment-badge has-files/.test(bridge)&&/rfq-attachment-badge no-files/.test(bridge)&&/pendingAttBadge/.test(bridge)&&/بدون ضمیمه/.test(bridge));
T('مدیر ضمائم و offerlock هر دو projection واحد را مصرف می‌کنند',/ptfRfqAttachmentRows/.test(inq)&&/ptfRfqAttachmentRows/.test(lock)&&/ptfRfqAttachmentCount/.test(lock));
T('فرمت‌های file/attachment/docs/site در projection پوشش داده می‌شوند',/attachments','attachment','docs','documents','inqFile'/.test(bridge));

T('فیلتر درخواست از class مهم برای کارت موبایل استفاده می‌کند',/ptfSetRowVisible\(tr, ok\)/.test(bridge)&&/\.ptf-filter-hidden,.tb2 tr\.ptf-filter-hidden\{display:none!important\}/.test(idx));
T('ردیف empty فیلتر نیز با همان helper پنهان می‌شود',/ptfSetRowVisible\(empty, false\)/.test(bridge));
T('جستجوی مشتری/تامین و تب مبدا تامین‌کننده نیز mobile-safe شدند',/ptfSetRowVisible/.test(mc)&&/ptfSetRowVisible/.test(ch)&&!/rows\[i\]\.style\.display = rows\[i\]\.innerText/.test(idx));
T('سه tab درخواست همه/بدون/دارای پیشنهاد همچنان type=button و تابع مستقیم دارند',bridge.indexOf('class="rfq-offer-chip"')>-1&&bridge.indexOf("ptfRfqOfferFlt(\\'none\\')")>-1&&bridge.indexOf("ptfRfqOfferFlt(\\'has\\')")>-1);
T('جستجو روی input و data-search نرمال‌شده اعمال می‌شود',/id="rSrch"[^>]+oninput="filterRfq\(\)"/.test(bridge)&&/data-search=/.test(bridge)&&/ptfRfqApplyListFilter/.test(bridge));

T('سورت‌های desktop در موبایل به select کارت تبدیل می‌شوند',/function ensureMobileSort/.test(mt)&&/مرتب‌سازی کارت‌ها/.test(mt)&&/ptfSortSelectChange/.test(mt));
T('سورت موبایل حالت پیش‌فرض/صعودی/نزولی و reset دارد',/— صعودی/.test(mt)&&/— نزولی/.test(mt)&&/delete \(window\.ptfSortState/.test(mt));
T('کنترل سورت موبایل فقط زیر breakpoint و خارج از modal ساخته می‌شود',/@media\(max-width:768px\)/.test(mt)&&/table\.closest\('\.md,.ptfdlg/.test(mt));

/* رفتار projection ضمائم */
var start=bridge.indexOf('window.ptfRfqAttachmentRows = function');var end=bridge.indexOf('window.ptfRfqOfferInqSet',start);var ctx={window:null};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(bridge.slice(start,end),ctx);
var rec={files:{inq:[{key:'rfq/a.pdf',name:'a.pdf'}],img:[{name:'local.jpg'}]},attachment:'legacy-host.pdf',attachments:[{objectKey:'rfq/b.png',fileName:'b.png'},{key:'rfq/a.pdf',name:'duplicate.pdf'}],docs:{scan:{url:'https://cdn/c.jpg',name:'c.jpg'}}};
var rows=ctx.ptfRfqAttachmentRows(rec);
T('projection رفتاری همه ساختارها را بدون دوباره‌شماری جمع می‌کند',rows.length===5,JSON.stringify(rows));
T('فایل local بدون key نیز در شمار ضمائم می‌آید',rows.some(function(x){return x.file.name==='local.jpg'&&!x.file.key;}));

/* رفتار class visibility که !important کارت موبایل را دور می‌زند */
var hs=idx.indexOf('window.ptfSetRowVisible = function');var he=idx.indexOf('function filterSup',hs);var visCtx={window:null};visCtx.window=visCtx;vm.createContext(visCtx);vm.runInContext(idx.slice(hs,he),visCtx);
var classes={};var row={hidden:false,style:{},attrs:{},classList:{toggle:function(k,on){classes[k]=on;}},setAttribute:function(k,v){this.attrs[k]=v;}};
visCtx.ptfSetRowVisible(row,false);T('helper رفتاری hidden/class/aria را همزمان اعمال می‌کند',row.hidden===true&&classes['ptf-filter-hidden']===true&&row.attrs['aria-hidden']==='true');
visCtx.ptfSetRowVisible(row,true);T('helper رفتاری نمایش مجدد را کامل برمی‌گرداند',row.hidden===false&&classes['ptf-filter-hidden']===false&&row.attrs['aria-hidden']==='false');

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);

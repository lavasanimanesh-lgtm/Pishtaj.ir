/* tester326 — ثبت اختیاری چک چاپ‌شده در هاب مالی */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var prt=fs.readFileSync(path.join(BASE,'cheque-print.js'),'utf8');
var mod=fs.readFileSync(path.join(BASE,'cheque-module.js'),'utf8');
SECTION('چاپ → ثبت مالی');
T('پس از چاپ تکی، از کاربر برای ثبت در هاب مالی سوال می‌شود', prt.indexOf('آیا این چک چاپ‌شده در «چک‌های هاب مالی» هم ثبت شود؟')>-1);
T('فرم تکمیلی شماره چک، بانک، تامین‌کننده، شناسه و بابت دارد', ['id: \'no\'','id: \'bank\'','id: \'supplierCd\'','id: \'nid\'','id: \'note\''].every(function(x){return prt.indexOf(x)>-1;}));
T('رکورد ثبت‌شده به عنوان چک صادره مالی و با metadata چاپ ساخته می‌شود', prt.indexOf("ptfChequeCreate('issued', rec)")>-1 && prt.indexOf("kind: 'finance'")>-1 && prt.indexOf("printedFrom: 'chqprint'")>-1);
T('تامین‌کننده از گزینه‌های بدهکار هاب مالی انتخاب می‌شود', prt.indexOf('ptfChequeSupOptions')>-1);
T('اثر مالی توسط موتور رسمی چک اعمال می‌شود', mod.indexOf('window.ptfChequeApplyFinancial(rec)')>-1 && mod.indexOf('ptfChequeApplyIssued')>-1);
T('چاپ چندتایی عمداً ثبت مالی گروهی خودکار نمی‌کند', prt.indexOf('ثبت گروهی مالی عمداً خودکار نیست')>-1);
DONE('tester326-v34.4.25-printed-cheque-finance');

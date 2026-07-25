/* tester56 — v13.6: تکمیل نقش بایگانی — حذف تشکیل دستی/خودکار پرونده در بایگانی (گزارش کارفرما) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var pj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');

SECTION('بایگانی = فقط مقصد مختومه‌سازی');
T('دکمه «+ تشکیل پرونده از CO» حذف شد', pj.indexOf('+ تشکیل پرونده از CO') === -1 && pj.indexOf('onclick="showPrjCreate()"') === -1);
T('بنر توضیح نقش جدید بایگانی', pj.indexOf('مقصد پرونده‌های <b>مختومه</b>') > -1);
T('استاب امن showPrjCreate/savePrj (ارجاع قدیمی نمی‌شکند)', pj.indexOf('بایگانی محل تشکیل پرونده نیست') > -1 && pj.indexOf('function savePrj() { showPrjCreate(); }') > -1);
T('فرم قدیمی تشکیل پرونده حذف شد', pj.indexOf('<h3>📁 تشکیل پرونده پروژه</h3>') === -1);

SECTION('CO برنده → پرونده فروش (نه بایگانی)');
T('autoCreateProjectFromCO دیگر در projects نمی‌نویسد', of.indexOf("prjs.unshift({") === -1 || of.indexOf('autoCreateProjectFromCO') === -1 || (function(){ var i=of.indexOf('function autoCreateProjectFromCO'); var j=of.indexOf('function offerNew(kind)'); var body=of.slice(i,j); return body.indexOf("ptf_crm_projects") === -1; })());
T('مدارک به پرونده فروش منضم می‌شود (ptfSF_ensure)', of.indexOf('ptfSF_ensure(o.inqNo || o.no, o.buyerCo)') > -1);
T('ضمائم RFQ به docs پرونده فروش', of.indexOf("note: 'ضمیمه درخواست (' + k + ')'") > -1);
T('ضدتکرار ضمیمه (بر اساس key)', of.indexOf('!rec.docs.some(function (d) { return d.key === f.key; })') > -1);
T('wonOffer/wonAt روی پرونده فروش', of.indexOf('rec.wonOffer = o.no') > -1);
T('متن confirm برنده به‌روز (پرونده فروش، نه پرونده‌های پروژه)', of.indexOf('به «پرونده فروش» همین درخواست منضم') > -1 && of.indexOf('در ماژول «پرونده‌های پروژه» ساخته می‌شود') === -1);
T('اعلان به پنل deals لینک می‌دهد', of.indexOf("link: { panel: 'deals' }") > -1);

SECTION('پکینگ‌لیست و پرونده‌های موجود دست‌نخورده');
T('plCreate/plRemaining سالم', pj.indexOf('function plCreate(offerNo)') > -1 && pj.indexOf('function plRemaining(offerNo)') > -1);
T('مسیر مختومه‌سازی salesfiles پابرجا', fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8').indexOf("state: 'archived'") > -1);
DONE('tester56-v136');

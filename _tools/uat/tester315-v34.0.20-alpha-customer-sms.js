/* tester315 — v34.0.20-alpha (فاز ۱۷: اطلاع‌رسانی پیامکی به مشتری در مراحل کلیدی)
   پوشش: helper ptfSmsCustomer (استخراج موبایل مشتری + ارسال)؛ پیامک هنگام صدور
   پیشنهاد مالی (offerSave با ذکر شماره درخواست)؛ پیامک هنگام ثبت درخواست (rfqApprove). */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sms = fs.readFileSync(path.join(BASE, 'sms.js'), 'utf-8');
var offers = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var bridge = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v[0-9.]+-alpha$/.test(vjson.crm_version));

SECTION('helper: ptfSmsCustomer');
T('ptfSmsCustomer تعریف شده', sms.indexOf('window.ptfSmsCustomer = function') > -1);
T('ptfCustomerMobile (استخراج موبایل از people.mobs/phones/ph) تعریف شده', sms.indexOf('window.ptfCustomerMobile = ptfCustomerMobile') > -1 && sms.indexOf('ptfCustomerMobile(c)') > -1);

SECTION('پیامک هنگام صدور پیشنهاد مالی (offerSave)');
T('offerSave هنگام ذخیره پیامک به مشتری می‌فرستد', offers.indexOf('ptfSmsCustomer(o.buyerCd') > -1);
T('متن پیامک شامل شماره پیشنهاد و شماره درخواست (o.inqNo) است', offers.indexOf("درخواست شمارهٔ ' + o.inqNo") > -1 && offers.indexOf("o.no || ''") > -1);

SECTION('پیامک هنگام ثبت درخواست (rfqApprove)');
T('rfqApprove هنگام تأیید درخواست پیامک به مشتری می‌فرستد', bridge.indexOf('پیامک ثبت درخواست') > -1 && bridge.indexOf('smsSendSingle(_rfqMob') > -1);
T('متن شامل شماره درخواست (code) است', bridge.indexOf("شمارهٔ ' + (code || '')") > -1);

DONE('tester315-v34.0.20-alpha');

/* tester289 — v33.9.0 (UI-MINIMAL + MONEY-FIELDS):
 * 1) گزینه‌های مقابل درخواست‌ها مثل پیشنهادات مینیمال شد (آیکون ۳۲px با tooltip)
 * 2) فیلدهای مبلغ: جداکننده + مبلغ به حروف + پذیرش ارقام فارسی/انگلیسی + تبدیل دوجهته
 *    (moneyx: ptfEnDigits/ptfFaDigits + blur auto-format برای فیلدهای مبلغ‌مانند بدون data-money)
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var bridge = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var moneyx = fs.readFileSync(path.join(BASE, 'moneyx.js'), 'utf-8');
var prt = fs.readFileSync(path.join(BASE, 'cheque-print.js'), 'utf-8');

SECTION('UI مینیمال: گزینه‌های درخواست‌ها مثل پیشنهادات');
T('دکمه‌های اکشن درخواست: آیکون ۳۲px با tooltip (نه دکمه متنی بلند)', (function () {
  return bridge.indexOf('width:32px;height:32px;padding:0;font-size:13px') > -1 &&
    bridge.indexOf('مشاهده درخواست') > -1 &&
    bridge.indexOf('ویرایش / حذف') > -1 &&
    bridge.indexOf('ارجاع') > -1 &&
    bridge.indexOf('>👁 مشاهده</button>') === -1;
})());

SECTION('فیلدهای مبلغ: جداکننده + به‌حروف + ارقام دوجهته');
eval.call(global, moneyx);
T('ptfEnDigits: فارسی/عربی → انگلیسی', ptfEnDigits('۱۲۳۴۵۶') === '123456' && ptfEnDigits('٠١٢') === '012');
T('ptfFaDigits: انگلیسی → فارسی', ptfFaDigits('123456') === '۱۲۳۴۵۶');
T('moneyx: تشخیص فیلد مبلغ‌مانند (moneyLike) + blur auto-format', moneyx.indexOf('moneyLike') > -1 && moneyx.indexOf('focusout') > -1 && moneyx.indexOf('data-nomoney') > -1 && moneyx.indexOf("/(مبلغ|قیمت|هزینه|حقوق|اعتبار|پرداخت|دریافت|مانده|پیش‌پرداخت|پورسانت|بستانکاری|بدهی)/") > -1);
T('خروج امن: نرخ/درصد/تعداد/روز/تاریخ در moneyLike فرمت نمی‌شوند', moneyx.indexOf("/(rate|pct|percent|qty|count|days|delivery|date|month|year|tel|phone|share|margin|refprice|duration|hours?)/") > -1);
T('فیلدهای چک (تکی/چندتایی/AI) data-money دارند', (function () {
  var panel = fs.readFileSync(path.join(BASE, 'cheque-panel.js'), 'utf-8');
  return prt.indexOf('id="chqpAmt"') > -1 && prt.indexOf('data-money="1"') > -1 &&
    prt.indexOf('class="chqpM_amt"') > -1 &&
    panel.indexOf('id="ptfChNAmt"') > -1 && panel.indexOf('id="ptfChAiAmt"') > -1 &&
    panel.indexOf('data-money="1"') > -1;
})());

SECTION('سند تحلیل سود/تقسیم');
var doc = fs.readFileSync(path.join(BASE, 'ANALYSIS-PROFIT-DIVIDEND-2026-08-02.md'), 'utf-8');
T('سند تحلیل سود/تقسیم موجود و کامل است', doc.indexOf('BUG-P-1') > -1 && doc.indexOf('BUG-P-7') > -1 && doc.indexOf('پیشنهاد ۱') > -1 && doc.indexOf('پیشنهاد ۵') > -1 && doc.indexOf('قابل تقسیم') > -1);

DONE('tester289-ui-minimal-money');

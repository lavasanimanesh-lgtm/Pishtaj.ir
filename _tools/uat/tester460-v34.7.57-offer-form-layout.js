#!/usr/bin/env node
'use strict';
/* v34.7.96 — نظم بصری فرم پیشنهاد (فنی/مالی/فنی-مالی):
   ترتیب طبیعی فیلدها (هویت سند → چاپ/اعتبار → امضا → اقلام)، حذف ستون خالی،
   نوار ابزار اقلام یکدست، رفع غلط تایپی، فوتر چسبان — با حفظ قراردادهای
   case-revision (h3 / #offSaveBtn / دکمهٔ اول = انصراف). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var off = read('crm/offers.js');
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var theme = read('crm/theme-contrast.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.7.96', ver.crm_version === 'v34.7.96', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.7.96', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.7.96'") > -1);
T('sw RELEASE = v34.7.96', sw.indexOf("RELEASE = 'v34.7.96'") > -1);
T('offers.js cache-bust 34.7.96', idx.indexOf('offers.js?v=34.7.96') > -1);

/* ---------- ترتیب فیلدها ---------- */
var iBuyer = off.indexOf('id="ofBuyer"');
var iInq = off.indexOf('id="ofInq"');
var iPrint = off.indexOf('id="ofPrintAs"');
var iValid = off.indexOf('id="ofValidJ"') > -1 ? off.indexOf('ofValidJ') : off.indexOf("ptfDatePicker('ofValidJ'");
var iSeller = off.indexOf('offer-seller-row');
var iSig = off.indexOf('signatureHtml +');
var iItems = off.indexOf('offer-items-toolbar');
T('کارفرما پیش از قالب چاپ', iBuyer > -1 && iPrint > -1 && iBuyer < iPrint, iBuyer + '/' + iPrint);
T('درخواست پیش از قالب چاپ', iInq > -1 && iInq < iPrint);
T('قالب چاپ و اعتبار در یک ردیف متوازن', /ofPrintAs[\s\S]{0,1200}ofValidJ/.test(off));
T('ستون خالی حذف شد', off.indexOf('<div class="fld"></div></div>') === -1);
T('امضا بعد از رابط فروشنده و قبل از اقلام', iSeller > -1 && iSig > iSeller && iSig < iItems, iSeller + '/' + iSig + '/' + iItems);

/* ---------- نوار ابزار اقلام ---------- */
T('نوار ابزار کلاس‌بندی شد', off.indexOf('offer-items-toolbar') > -1 && off.indexOf('offer-toolbar-sep') > -1);
T('غلط تایپی «ستون‌های تکمیلی ستون‌ها» رفع شد', off.indexOf('ستون‌های تکمیلی ستون‌ها') === -1 && off.indexOf('⛭ ستون‌های تکمیلی') > -1);
T('هر ۶ دکمه ابزار مانده‌اند', ['offLoadInqItems()', 'offLoadOtherInqItems()', 'offOpenProductMultiPicker()', 'ptfShowExcelGuidelineModal', 'offPriceXlsOpen()', 'offShowAdvCols()'].every(function (h) { return off.indexOf(h) > -1; }));
T('سرتیترهای بخش یکدست شدند', (off.match(/offer-sec-title/g) || []).length >= 2 && off.indexOf('📦 اقلام') > -1 && off.indexOf('📜 شرایط و ضوابط') > -1);

/* ---------- فوتر چسبان + قرارداد case-revision ---------- */
var iFooter = off.indexOf('offer-form-footer');
T('فوتر کلاس‌بندی شد', iFooter > -1 && off.indexOf('offer-footer-btns') > -1);
var footBlock = off.slice(iFooter, iFooter + 700);
T('ترتیب دکمه‌های فوتر: انصراف ← پیش‌نمایش ← ذخیره (قرارداد case-revision)',
  footBlock.indexOf('انصراف') > -1 && footBlock.indexOf('انصراف') < footBlock.indexOf('offerPreview()') && footBlock.indexOf('offerPreview()') < footBlock.indexOf('id="offSaveBtn"'));
T('offSaveBtn داخل گروه دکمه‌ها (والدِ والد = کانتینر اکشن‌ها)', /offer-footer-btns[^>]*>[\s\S]{0,400}id="offSaveBtn"/.test(footBlock) || (footBlock.indexOf('offer-footer-btns') > -1 && footBlock.indexOf('id="offSaveBtn"') > footBlock.indexOf('offer-footer-btns')));
T('div خالی جای‌گیر حذف شد', off.indexOf("'<div></div>' +") === -1);

/* ---------- CSS ---------- */
T('CSS سرتیتر بخش', idx.indexOf('.offer-form-modal .offer-sec-title') > -1);
T('CSS نوار ابزار', idx.indexOf('.offer-form-modal .offer-items-toolbar') > -1);
T('CSS فوتر چسبان', idx.indexOf('.offer-form-modal .offer-form-footer{position:sticky;bottom:0') > -1);
T('CSS موبایل نوار/فوتر', idx.indexOf('.offer-form-modal .offer-footer-btns .bt{flex:1}') > -1);
T('حالت تیره برای نوار/فوتر', theme.indexOf('body.ptf-dark .offer-form-modal .offer-form-footer') > -1);

/* ---------- رگرسیون قراردادهای قبلی ---------- */
T('tester117: ofPrintAs و برچسب TC مانده', off.indexOf('id="ofPrintAs"') > -1 && off.indexOf('Techno-Commercial Offer (فنی-مالی)') > -1);
T('tester449: هر دو دکمه بارگذاری مانده', off.indexOf('id="offInqBtn"') > -1 && off.indexOf('id="offOtherInqBtn"') > -1 && off.indexOf('بارگذاری از درخواست دیگر') > -1);
T('MOB-041: امضا همچنان قبل از اقلام', iSig > -1 && iSig < iItems);
T('tester460 در گیت CI', gate.indexOf('tester460-v34.7.57-offer-form-layout.js') > -1);

console.log('\n— tester460 (v34.7.96: نظم بصری فرم پیشنهاد) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

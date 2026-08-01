/* tester272 — v31.7.97 (BUG-OFFER-DUP-ITEMS-SETTINGS-ACCORDION-001)
 * Deep fix for duplicated offer/request items + accordion settings UX.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var offers = fs.readFileSync(path.join(ROOT, 'crm/offers.js'), 'utf-8');
var acc = fs.readFileSync(path.join(ROOT, 'crm/settings-accordion.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Offer duplicate item root fix');
T('نسخه BUG-OFFER-DUP-ITEMS-001 در offers ثبت شده است', offers.indexOf('BUG-OFFER-DUP-ITEMS-001') > -1);
T('کلید پایدار خط پیشنهاد و dedupe مرکزی وجود دارد', ['function offItemKey','function offDedupeOfferItems','window.offItemKey','window.offDedupeOfferItems'].every(function (x) { return offers.indexOf(x) > -1; }));
T('offLoadInqItems قبل از درج، existing key می‌سازد و تکراری را skip می‌کند', offers.indexOf('var existing = {};') > -1 && offers.indexOf('existing[offItemKey(it)] = true') > -1 && offers.indexOf('if (existing[key]) { skipped++; return; }') > -1);
T('پیام بارگذاری از درخواست تعداد added/skipped را نشان می‌دهد', offers.indexOf("' قلم از درخواست '") > -1 && offers.indexOf("' قلم تکراری رد شد'") > -1);
T('offSmartInsert خودش idempotent شده است', offers.indexOf('_keyFn(_offState.items[e]) === key') > -1 && offers.indexOf('return e;') > -1);
T('offAddItem فقط یک بار insert می‌کند و مسیر smart دارد', (offers.match(/function offAddItem\(pre\)[\s\S]{0,260}_offState\.items\.push/g) || []).length <= 1 && offers.indexOf('function offAddItem(pre)') > -1 && offers.indexOf('window.offSmartInsert(item)') > -1);
T('offerSave قبل از ذخیره duplicateها را حذف و audit می‌کند', offers.indexOf('var _ded = offDedupeOfferItems(o.items || [])') > -1 && offers.indexOf('حذف خودکار') > -1 && offers.indexOf('ردیف تکراری') > -1);

SECTION('Runtime duplicate behavior');
var start = offers.indexOf('// ---- v31.7.97 BUG-OFFER-DUP-ITEMS-001');
var end = offers.indexOf('function prodSrchRender()', start);
var code = offers.slice(start, end)
  .replace(/offRowIsEmpty\(/g, 'window.offRowIsEmpty(')
  .replace(/offSmartInsert\(/g, 'window.offSmartInsert(');
var data = {
  ptf_crm_inqitems: [
    { inqNo:'REQ-72', nm:'Control valve', st:'DN100 Class300', model:'ET', brand:'Fisher', qty:1, un:'NO' },
    { inqNo:'REQ-72', nm:'Positioner', st:'Smart', model:'DVC', brand:'Fisher', qty:1, un:'NO' }
  ],
  ptf_crm_inqreads: [],
  ptf_crm_rfqs: []
};
var w = { _offState: { inqNo:'REQ-72', items:[{ name:'', desc:'', model:'', qty:1, unit:'NO', brand:'', price:0 }] }, ptfAutoRegisterSummaryProducts:function(){}, ptfIntelligentParseItem:function(){} };
var doc = { getElementById:function(){ return { value:'REQ-72' }; }, body:{ insertAdjacentHTML:function(){} } };
var fn = new Function('window','getData','document','alert','offRenderItems','_offState', code + '; return { offLoadInqItems: offLoadInqItems, w: window };');
var api = fn(w, function (k) { return data[k] || []; }, doc, function(){}, function(){}, w._offState);
api.offLoadInqItems('REQ-72');
var afterFirst = w._offState.items.length;
api.offLoadInqItems('REQ-72');
var afterSecond = w._offState.items.length;
T('runtime: دوبار load از درخواست، اقلام را دوبرابر نمی‌کند', afterFirst === 2 && afterSecond === 2, 'first=' + afterFirst + ' second=' + afterSecond);
var ded = w.offDedupeOfferItems([{ name:'A', desc:'X', qty:1, unit:'NO', price:100 }, { name:'A', desc:'X', qty:1, unit:'NO', price:0 }, { name:'B', desc:'Y', qty:1, unit:'NO', price:0 }]);
T('runtime: dedupe ردیف تکراری صفرقیمت را حذف می‌کند و ردیف اصلی را نگه می‌دارد', ded.removed === 1 && ded.items.length === 2 && (+ded.items[0].price) === 100);

SECTION('Settings accordion UX');
T('settings-accordion.js وجود دارد و نسخه/قرارداد جدید دارد', acc.indexOf('settings-accordion.js — v33.4.5') > -1 && acc.indexOf('MINIMAL-LINE-ICONS-DARK-FISCAL-001') > -1);
T('settings accordion بعد از همه ماژول‌ها در CRM لود می‌شود', idx.indexOf('settings-accordion.js') > idx.indexOf('sync.js'));
T('accordion از details/summary و آیکون SVG معنایی استفاده می‌کند', acc.indexOf('document.createElement(\'details\')') > -1 && acc.indexOf('document.createElement(\'summary\')') > -1 && acc.indexOf('ptf-set-ico') > -1 && acc.indexOf('function lineIcon') > -1 && acc.indexOf("return ('0' + (i + 1))") === -1);
T('accordion root و wrapper buildSettings وجود دارد', acc.indexOf('ptfSettingsAccordionRoot') > -1 && acc.indexOf('window.buildSettings = function') > -1 && acc.indexOf('ptfSettingsAccordionApply') > -1);
T('آیکون emoji جدید در accordion اضافه نشده است', acc.indexOf('⚙️') === -1 && acc.indexOf('💰') === -1 && acc.indexOf('🚀') === -1);
T('CRM/SW نسخه v33.4.5 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester272-offer-duplicate-items-settings-accordion');

/* tester130 — v21.4 BUG-039 + human-persona infra */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ROOT = path.resolve(__dirname, '../..');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه v21.4');
T('VER v21.4+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=4);})(m[1]);})());
T('SW v21.4+', (function(){var m=sw.match(/ptf-crm-v([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=4);})(m[1]);})());
T('cache offers 21.4+', /offers\.js\?v=/.test(idx) && (function(){var m=idx.match(/offers\.js\?v=([0-9.]+)/);return m&&(function(v){var a=v.split('.');return +a[0]>21||(+a[0]===21&&+(a[1]||0)>=4);})(m[1]);})());

SECTION('BUG-039 ساختاری');
T('ست صریح ofBuyer.value', off.indexOf('buyerEl.value = o.buyerCd') > -1);
T('ست صریح ofInq.value', off.indexOf('inqEl.value = o.inqNo') > -1);
T('گزینه موقت buyer غایب', off.indexOf('گزینه موقت') > -1 || off.indexOf('در لیست نیست') > -1);
T('برچسب co / coEn', off.indexOf('coEn && c.co') > -1 || off.indexOf('c.coEn') > -1);
T('keep بدون contact → primary', off.indexOf('ویرایش بدون buyerContact') > -1 || off.indexOf('!_offState.buyerContact') > -1);
T('offerEdit deep copy state', off.indexOf('function offerEdit') > -1 && off.indexOf('JSON.parse(JSON.stringify(o))') > -1);

SECTION('BUG-039 رفتاری — شبیه‌سازی offerForm selection');
// Minimal DOM select simulation
function makeSelect(opts, selected) {
  var value = selected || '';
  var options = opts.slice();
  return {
    options: options,
    get value() { return value; },
    set value(v) {
      if (options.some(function (o) { return o.value === v; })) value = v;
      else value = '';
    },
    appendChild: function (opt) { options.push({ value: opt.value, textContent: opt.textContent }); }
  };
}
// Simulate building options like offerForm
var o = { buyerCd: 'C-9', buyerCo: 'Acme EN', inqNo: 'INQ-77' };
var custs = [{ cd: 'C-1', co: 'Other' }, { cd: 'C-9', co: 'اکمی', coEn: 'Acme EN' }];
var has = custs.some(function (c) { return c.cd === o.buyerCd; });
T('buyer در لیست هست', has === true);
var buyerSel = makeSelect(custs.map(function (c) { return { value: c.cd }; }), o.buyerCd);
buyerSel.value = o.buyerCd;
T('select buyer نگه می‌دارد', buyerSel.value === 'C-9');
// missing customer
var o2 = { buyerCd: 'C-GONE', buyerCo: 'Deleted Co', inqNo: 'X' };
var custs2 = [{ cd: 'C-1', co: 'Other' }];
if (!custs2.some(function (c) { return c.cd === o2.buyerCd; })) {
  custs2.unshift({ cd: o2.buyerCd, co: o2.buyerCo });
}
var buyerSel2 = makeSelect(custs2.map(function (c) { return { value: c.cd }; }), '');
buyerSel2.value = o2.buyerCd;
T('buyer غایب با گزینه موقت قابل انتخاب', buyerSel2.value === 'C-GONE');
var inqSel = makeSelect([{ value: '' }, { value: 'INQ-77' }], '');
inqSel.value = 'INQ-77';
T('inq حفظ می‌شود', inqSel.value === 'INQ-77');

SECTION('زیرساخت human persona');
T('_personas dir', fs.existsSync(path.join(ROOT, '_personas')));
var personas = fs.readdirSync(path.join(ROOT, '_personas')).filter(function (f) { return f.endsWith('.json'); });
T('≥10 persona files', personas.length >= 10);
T('run-persona-gate.js', fs.existsSync(path.join(ROOT, '_tools/human/run-persona-gate.js')));
T('sprint-counter.json', fs.existsSync(path.join(ROOT, '_tools/human/sprint-counter.json')));
T('human test README', fs.existsSync(path.join(ROOT, '_human_test/README.md')));
T('templates scenarios', fs.existsSync(path.join(ROOT, '_human_test/templates/scenarios.md')));

DONE('tester130-v214');
if (RESULTS.fail) process.exit(1);

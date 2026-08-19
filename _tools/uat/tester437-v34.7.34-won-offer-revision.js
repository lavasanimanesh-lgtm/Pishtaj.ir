#!/usr/bin/env node
'use strict';
/* v34.7.34 — رویژن همان شماره + فیلتر نشت awardDocs + ابطال اختیاری فاکتور */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var php = read('api/sales-domain.php');
var sf = read('crm/salesfiles.js');
var off = read('crm/offers.js');
var rev = read('crm/case-revision.js');

T('سرور: شماره ثابت + rev', /sameOffer/.test(php) && /\$parent\['rev'\] = \$seq/.test(php));
T('سرور: voidInvoices + fiscal lock', /voidInvoices/.test(php) && /fiscal_period_locked/.test(php));
T('سرور: متمم در مبلغ مؤثر', /relationType/.test(php) && /amendmentSum/.test(php));
T('سرور: lineId حفظ می‌شود', /lineId/.test(php));
T('سرور: تجمیعی مسدود', /consolidated_invoice_blocks_revision/.test(php));
T('UI: افزودن قلم', /ptfAwardReviseAddLine/.test(rev));
T('UI: تیک ابطال فاکتور', /ptfRevVoidInv/.test(rev) && /voidInvoices: voidInv/.test(rev));
T('UI: هنوز فقط revise_award سرور', /ptfSalesDomainApi\('revise_award'/.test(rev));
T('نشت: sfAwardEnsure دیگر inqNo برای TO ندارد',
  /ptfAwardRelatedTo/.test(sf) && !/x\.inqNo === o\.inqNo/.test(sf.match(/window\.sfAwardEnsure[\s\S]{0,1800}/)[0]));
T('نشت: autoCreateProjectFromCO بدون inqNo TO',
  /ptfAwardRelatedTo/.test(off) && !/o\.inqNo && x\.inqNo === o\.inqNo/.test(off.match(/autoCreateProjectFromCO[\s\S]{0,2500}/)[0] || ''));
T('قفل برد دیگر همهٔ inqNo را قفل نمی‌کند',
  /d\.wonOffer === o\.no \|\| d\.offerNo === o\.no/.test(off) &&
  !/o\.inqNo && d\.inqNo === o\.inqNo/.test(off.match(/function offerPostAwardLocked[\s\S]{0,400}/)[0]));

function sandbox() {
  var sb = {
    getData: function (k) { return sb._db[k] || []; },
    faDateTime: function () { return 't'; },
    curSession: function () { return { name: 't' }; },
    audit: function () {},
    sfAll: function () { return sb._db.ptf_crm_deals; },
    sfSave: function () {},
    window: null, console: console, JSON: JSON, Array: Array, Object: Object, String: String
  };
  sb.window = sb;
  sb._db = {
    ptf_crm_offers: [
      { no: 'CO-A', kind: 'CO', srcToNo: 'TO-A', inqNo: 'INQ-1', items: [{ name: 'x', qty: 1, price: 1 }] },
      { no: 'TO-A', kind: 'TO', coNo: 'CO-A', inqNo: 'INQ-1', rev: 1 },
      { no: 'TO-B', kind: 'TO', coNo: 'CO-B', inqNo: 'INQ-1', rev: 9 }
    ],
    ptf_crm_deals: [{ cd: 'D1', wonOffer: 'CO-A', awardDocs: [] }]
  };
  vm.createContext(sb);
  var chunk = sf.match(/window\.ptfAwardRelatedTo = function[\s\S]*?window\.sfAwardEnsure = function[\s\S]*?catch \(e\) \{ return window\.ptfAwardDocsDisplay\(r, r\.awardDocs \|\| \[\]\); \}\n  \};/);
  T('استخراج helper نشت', !!chunk, 'no match');
  if (chunk) vm.runInContext(chunk[0], sb);
  var to = sb.ptfAwardRelatedTo(sb._db.ptf_crm_offers[0], sb._db.ptf_crm_offers);
  T('TO مرتبط فقط srcToNo/coNo است نه TO-B هم‌استعلام', to && to.no === 'TO-A', to && to.no);
  var shown = sb.ptfAwardDocsDisplay({ wonOffer: 'CO-A', awardDocs: [
    { role: 'commercial', no: 'CO-A', snap: {} },
    { role: 'technical', no: 'TO-B', kind: 'TO', snap: { coNo: 'CO-B' } }
  ]});
  T('نمایش جعبه زرد TO پرونده دیگر را حذف می‌کند', shown.length === 1 && shown[0].no === 'CO-A', JSON.stringify(shown));
}
sandbox();

console.log('\n— tester437 (رویژن همان شماره + نشت awardDocs) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);

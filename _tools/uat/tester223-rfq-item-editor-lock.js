/* tester223 — v31.7.46 (BUG-INQ-EDIT-LOCK-001)
 * RFQ item editor must not be falsely locked when no offer has actually been issued.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var inq = fs.readFileSync(path.join(ROOT, 'crm/inqreader.js'), 'utf-8');

SECTION('Source guard');
T('BUG marker exists', inq.indexOf('BUG-INQ-EDIT-LOCK-001') > -1);
T('hasOffer uses aliases and non-empty offer identity', inq.indexOf('aliasesForOffer = irRfqAliases') > -1 && inq.indexOf('return !!v && aliasesForOffer.indexOf(v) > -1') > -1);
T('old undefined equality guard removed', inq.indexOf('o.inqNo === cd || o.inqNo === r.inqNo') === -1);
T('lock alert no longer uses large lock emoji', inq.indexOf('🔒 مشخصات اصلی به دلیل صدور پیشنهاد') === -1);

SECTION('Behavioral guard simulation');
function hasOfferOld(r, cd, offers) { return offers.some(function(o){ return o.inqNo === cd || o.inqNo === r.inqNo; }); }
function aliases(r, fallback) { var out=[], seen={}; [fallback, r&&r.cd, r&&r.inqNo].forEach(function(v){ v=String(v||'').trim(); if(v&&!seen[v]){seen[v]=1;out.push(v);} }); return out; }
function hasOfferNew(r, cd, offers) { var a=aliases(r, cd); return offers.some(function(o){ var v=String((o&&(o.inqNo||o.srcRfq||''))||'').trim(); return !!v && a.indexOf(v)>-1; }); }
var rfqNoClient = { cd:'RFQ-777', co:'Test' };
var unrelatedOfferNoInq = [{ no:'CO-X', kind:'CO', st:'draft' }];
T('old guard falsely locked when both inqNo undefined', hasOfferOld(rfqNoClient, 'RFQ-777', unrelatedOfferNoInq) === true);
T('new guard does not lock without real inqNo/srcRfq match', hasOfferNew(rfqNoClient, 'RFQ-777', unrelatedOfferNoInq) === false);
var related = [{ no:'CO-1', inqNo:'RFQ-777' }];
T('new guard still locks when a real related offer exists', hasOfferNew(rfqNoClient, 'RFQ-777', related) === true);
var rfqClientNo = { cd:'RFQ-777', inqNo:'CLIENT-55' };
T('new guard matches customer inquiry aliases too', hasOfferNew(rfqClientNo, 'RFQ-777', [{ no:'CO-2', inqNo:'CLIENT-55' }]) === true);

DONE('tester223-rfq-item-editor-lock');

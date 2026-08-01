/* tester278 — v33.4.8 BUG-OFFER-SYNC-INTEGRITY-001 */
require('./harness');
var fs=require('fs'),path=require('path'); var R=path.resolve(__dirname,'../..');
var sync=fs.readFileSync(path.join(R,'crm/sync.js'),'utf8');
var offers=fs.readFileSync(path.join(R,'crm/offers.js'),'utf8');
var api=fs.readFileSync(path.join(R,'api/crm.php'),'utf8');
SECTION('Offer Sync Integrity');
T('lineId پایدار برای اقلام پیشنهاد در save ایجاد می‌شود', offers.indexOf('function offEnsureOfferLineIds')>-1 && offers.indexOf('offEnsureOfferLineIds(o.items, o.no)')>-1);
T('ویرایش پیشنهاد timestamp نسخه دارد', offers.indexOf('o.updatedAtISO = new Date().toISOString()')>-1);
T('sync برای offer.items snapshot اتمیک نگه می‌دارد', sync.indexOf('function ptfNormalizeOfferSnapshot')>-1 && sync.indexOf('out.items = clean.items')>-1 && sync.indexOf('never union winner/loser offer lines')>-1);
T('sync از lineId برای هویت اقلام استفاده می‌کند', sync.indexOf("String(it.lineId || '').trim()")>-1);
T('سرور افزایش duplicate line را تشخیص می‌دهد', api.indexOf('function sync_offer_duplicate_count')>-1 && api.indexOf('sync_offers_payload_introduces_duplicates')>-1);
T('سرور payload بدترکننده را reject و snapshot سرور را conflict برمی‌گرداند', api.indexOf("$rejected[] = $k;")>-1 && api.indexOf("$conflictData[$k] = $serverOffersJson;")>-1);
DONE('tester278-offer-sync-integrity');

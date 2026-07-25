/* tester206 — v31.7.31 (BUG-OFF-REV-001)
 * ویرایش مستقیم پیشنهاد نباید Rev جدید یا شماره جدید بسازد.
 * فقط دکمه «نگارش جدید» مجاز است Rev همان شماره پیشنهاد را افزایش دهد. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var of = fs.readFileSync(path.join(ROOT, 'crm/offers.js'), 'utf-8');

SECTION('کد: تفکیک ویرایش مستقیم از نگارش جدید');
T('شناسه باگ و helperهای هویت ذخیره وجود دارد', of.indexOf('BUG-OFF-REV-001') > -1 && of.indexOf('function ptfOfferResolveSaveIdentity') > -1 && of.indexOf('function ptfOfferPrepareEditState') > -1);
T('offerEdit همیشه editMode=direct و baseNo را ثبت می‌کند', /ptfSetOffState\(ptfOfferPrepareEditState\(JSON\.parse\(JSON\.stringify\(o\)\), 'direct', no\)\)/.test(of));
T('offerReviseClone همیشه editMode=revision و همان شماره پایه را ثبت می‌کند', /ptfSetOffState\(ptfOfferPrepareEditState\(JSON\.parse\(JSON\.stringify\(o\)\), 'revision', no\)\)/.test(of));
T('پیام نگارش جدید تصریح می‌کند شماره پیشنهاد تغییر نمی‌کند', of.indexOf('شماره پیشنهاد تغییر نمی‌کند؛ فقط Rev همان سند افزایش می‌یابد') > -1);
T('منطق save دیگر وضعیت sent/approved را به‌صورت خودکار Rev نمی‌کند', of.indexOf('var afterSent =') === -1 && of.indexOf('madeRevision = !!forceRev;') > -1);
T('regen شماره فقط برای پیشنهاد جدید باقی مانده است', of.indexOf("if (idx > -1 && o.editMode === 'new')") > -1);
T('فرم stale مسیر ویرایش به جای ساخت پیشنهاد جدید block می‌شود', of.indexOf('missing-edit-target') > -1 && of.indexOf('برای جلوگیری از ایجاد پیشنهاد جدید/شماره جدید از مسیر ویرایش') > -1);
T('فیلدهای موقت _baseNo/_origNo قبل از ذخیره پاک می‌شوند', of.indexOf('delete o._baseNo; delete o._origNo; delete o.baseNo;') > -1);

SECTION('رفتاری: helper هویت ذخیره');
global.window = global;
var s = of.slice(of.indexOf('function ptfOfferPrepareEditState'), of.indexOf('function offerEdit'));
T('بلاک helper قابل استخراج است', s.indexOf('function ptfOfferResolveSaveIdentity') > -1);
eval(s);

var offers = [{ no: 'PTF-CO-1405-0100', kind: 'CO', rev: 2, st: 'sent', items: [] }];
var direct = ptfOfferPrepareEditState(JSON.parse(JSON.stringify(offers[0])), 'direct', offers[0].no);
direct.no = 'PTF-CO-1405-9999'; // شبیه خرابی فرم/درفت: شماره نباید عوض بماند
var r1 = ptfOfferResolveSaveIdentity(direct, offers);
T('ویرایش مستقیم حتی اگر شماره فرم خراب شده باشد به شماره اصلی برمی‌گردد', r1.ok && r1.idx === 0 && !r1.explicitRevision && direct.no === 'PTF-CO-1405-0100');

var rev = ptfOfferPrepareEditState(JSON.parse(JSON.stringify(offers[0])), 'revision', offers[0].no);
var r2 = ptfOfferResolveSaveIdentity(rev, offers);
T('نگارش جدید همان رکورد را هدف می‌گیرد و فقط explicitRevision=true دارد', r2.ok && r2.idx === 0 && r2.explicitRevision && rev.no === 'PTF-CO-1405-0100');

var stale = ptfOfferPrepareEditState({ no: 'PTF-CO-1405-404', kind: 'CO', rev: 0 }, 'direct', 'PTF-CO-1405-404');
var r3 = ptfOfferResolveSaveIdentity(stale, offers);
T('ویرایش stale بدون رکورد اصلی block می‌شود نه اینکه پیشنهاد جدید بسازد', !r3.ok && r3.reason === 'missing-edit-target');

var fresh = { no: 'PTF-CO-1405-0100', kind: 'CO', editMode: 'new' };
var r4 = ptfOfferResolveSaveIdentity(fresh, offers);
T('پیشنهاد جدید با شماره تکراری همچنان برای گارد duplicate قابل تشخیص است', r4.ok && r4.idx === 0 && !r4.explicitRevision);

DONE('tester206-offer-edit-revision-identity');

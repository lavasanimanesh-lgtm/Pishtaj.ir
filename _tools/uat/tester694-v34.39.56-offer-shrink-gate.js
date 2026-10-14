/* tester694 — v34.39.56 (OFFER-SHRINK-GATE / SHRINK-SELF-HEAL)
   RCA 2026-10-14: «تمامی پیشنهادات مربوط به پنج شش روز گذشته از روی سرور پاک شده است».

   ریشه (خلاصهٔ سند ARENA-OFFER-RECENT-WIPE-RCA-2026-10-14.md):
     • رجیستری فرمان سرور برای ptf_crm_offers شناسه را «cd» گرفته (api/sales-domain.php:174)
       ولی ردیف‌های پیشنهاد با «no» ساخته می‌شوند ⇒ روتر کلاینت هر نوشتنِ پیشنهاد را به
       legacy (بازنویسی کل آرایه) تنزل می‌دهد و هیچ سنگ‌قبری ساخته نمی‌شود.
     • تنها نگهبان سرور، سپر حذف انبوه با سقف «۱ تا ۳ ردیف همیشه مجاز» و «افت زیر ۲۵٪ مجاز» بود.
     • سپر کلاینت هم در حالت فعال‌شدن به legacy تنزل می‌کرد ⇒ حذف واقعاً انجام می‌شد.
     • هیچ لاگی برای افت آرایه نبود؛ دستگاهِ «krevs تازه + دادهٔ کهنه» هم هرگز نمی‌فهمید
       کپی محلی‌اش کوتاه است.
   چه چیزی در v34.39.56 قفل می‌شود:
     ① سرور: برای ptf_crm_offers هر ردیف غایبِ بدون سنگ‌قبر = تعارض (نه ذخیره)
     ② سرور: لاگ key_shrink.log برای هر افت (مسدود/مجاز) + شمار رکورد در meta[key].n
     ③ کلاینت: سپر حذف انبوه رکوردها را از base برمی‌گرداند (بدون legacy، بدون حذف)
     ④ کلاینت: مسیرهای حذف آبشاری/پاک‌سازی یتیم/بازگردانی دستیار سنگ‌قبر OFFER می‌نویسند
     ⑤ کلاینت: ترمیم خودکار «کپی محلی کوتاه‌تر از سرور» با مقایسهٔ meta[key].n

   تست‌های ①–⑤ ترکیبی‌اند: بخش‌های اجرایی با «برش واقعی کد» در vm و بخش‌های سروری/پیوندی
   با پین متنی (php در گیت نیست — همان رویهٔ tester595 بند ۳). */
require('./harness');
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sdSrc = read('crm/sales-domain-v2.js');
var syncSrc = read('crm/sync.js');
var bridgeSrc = read('crm/bridge.js');
var offersSrc = read('crm/offers.js');
var aiSrc = read('crm/ai-workbench.js');
var apiSrc = read('api/crm.php');
var sdApiSrc = read('api/sales-domain.php');

var pass = 0, fail = 0;
function T(name, cond, detail) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ FAIL: ' + name + (detail ? ' — ' + detail : '')); }
}

/* ───────────── ① روتر: حذف انبوه، رکوردها را حفظ می‌کند (اجرای واقعی) ───────────── */
SECTION('① روتر ptfEntitySaveCollection — حذف انبوه/تهی‌شدن دیگر رکورد نمی‌سوزاند');
(function () {
  var a = sdSrc.indexOf('window.ptfEntitySaveCollection = function');
  var b = sdSrc.indexOf('window.ptfSalesCommandErrorIsAmbiguous', a);
  T('①.۰ برش واقعی روتر پیدا شد', a > -1 && b > a);
  var routerSrc = sdSrc.slice(a, b);
  T('①.۱ تنزل legacy مخصوص «delete-burst-blocked» حذف شده است',
    routerSrc.indexOf("legacyFallback('delete-burst-blocked") < 0);
  T('①.۲ شاخهٔ «حفظ رکوردهای غایب از base» اضافه شده است',
    routerSrc.indexOf('var heldBack = dels.length') > -1 && routerSrc.indexOf('keepList.push') > -1);
  T('①.۳ ptf_crm_offers همچنان در فهرست مجموعه‌های سپردار است',
    /DELETE_BURST_GUARDED = \{[\s\S]{0,600}'ptf_crm_offers': 1/.test(routerSrc));

  function bootRouter() {
    var calls = { ups: [], dels: [], legacy: [] };
    var ctx = {
      console: { warn: function () {}, error: function () {} },
      JSON: JSON, Array: Array, Object: Object, String: String, Date: Date, Number: Number,
      window: {
        PTF_ENTITY_CMD_ENABLED: { ptf_crm_deals: true },
        ptfEntityUpsert: function (c, r, o) { calls.ups.push(r.cd); if (o && o.cb) o.cb({ state: 'acked' }); },
        ptfEntityDelete: function (c, id, o) { calls.dels.push(id); if (o && o.cb) o.cb({ state: 'acked' }); },
        ptfSilentWrite: function () {},
        ptfSyncAcknowledgeKeys: function () {}
      },
      setData: function (k, v) { calls.legacy.push({ k: k, n: v.length }); },
      getData: function () { return []; },
      audit: function () {}, ptfToast: function () {}
    };
    vm.createContext(ctx);
    vm.runInContext(routerSrc, ctx, { filename: 'router-slice.js' });
    return { save: ctx.window.ptfEntitySaveCollection, ctx: ctx, calls: calls };
  }
  var mk = function (n) { var a = []; for (var i = 0; i < n; i++) a.push({ cd: 'DEAL-' + (1000 + i) }); return a; };

  var h1 = bootRouter(), base = mk(12);
  var r1 = h1.save('ptf_crm_deals', base.slice(0, 2), { prevArr: base });
  var kept1 = (h1.ctx.window._ptfEntityLastKnown || {})['ptf_crm_deals'] || [];
  T('①.۴ افت ۱۰ ردیفی: هیچ حذفی صادر نشد', h1.calls.dels.length === 0, 'dels=' + h1.calls.dels.length);
  T('①.۵ افت ۱۰ ردیفی: مسیر legacy اجرا نشد (نه setData خارج از روتر)', h1.calls.legacy.length === 0, JSON.stringify(h1.calls.legacy));
  T('①.۶ افت ۱۰ ردیفی: فهرست نهایی همان ۱۲ ردیف کامل است (رکوردها حفظ شدند)',
    kept1.length === 12, 'kept=' + kept1.length);
  T('①.۷ خروجی روتر «commands» است، نه legacy', r1 && r1.mode === 'commands' && r1.deletes === 0, JSON.stringify(r1));

  var h2 = bootRouter();
  var r2 = h2.save('ptf_crm_deals', [], { prevArr: mk(12) });
  var kept2 = (h2.ctx.window._ptfEntityLastKnown || {})['ptf_crm_deals'] || [];
  T('①.۸ «فهرست تهی شد»: کل ۱۲ ردیف از base بازگشتند و legacy اجرا نشد',
    kept2.length === 12 && h2.calls.legacy.length === 0 && r2 && r2.mode === 'commands',
    'kept=' + kept2.length + ' legacy=' + h2.calls.legacy.length);

  var h3 = bootRouter(), base3 = mk(3);
  var r3 = h3.save('ptf_crm_deals', base3.slice(0, 2), { prevArr: base3 });
  T('①.۹ حذف تک‌رکوردیِ واقعی کاربر همچنان کار می‌کند (بدون رگرسیون)',
    r3 && r3.mode === 'commands' && r3.deletes === 1 && h3.calls.dels[0] === 'DEAL-1002',
    JSON.stringify(r3) + ' ' + JSON.stringify(h3.calls.dels));
})();

/* ───────────── ② سنگ‌قبرنویسِ مسیرهای حذف پیشنهاد (پین پیوندی) ───────────── */
SECTION('② هر مسیر حذف پیشنهاد، سنگ‌قبر بازیافت‌پذیر می‌نویسد');
T('②.۱ تابع مشترک ptfOfferWriteTombstones در offers.js تعریف شده است',
  offersSrc.indexOf('window.ptfOfferWriteTombstones = function') > -1 &&
  offersSrc.indexOf("kind: 'OFFER'") > -1);
T('②.۲ حذف آبشاری درخواست، پیش از حذف، سنگ‌قبر می‌نویسد',
  bridgeSrc.indexOf("window.ptfOfferWriteTombstones(_cascRemoved, 'حذف آبشاری درخواست ' + cd)") > -1 &&
  bridgeSrc.indexOf("reason: 'rfq-cascade-offers'") > -1);
T('②.۳ پاک‌سازی یتیم‌ها: سنگ‌قبر + ذخیره از مسیر روتر (نه setData خام)',
  bridgeSrc.indexOf("window.ptfOfferWriteTombstones(removed, 'پاک‌سازی یتیم‌ها')") > -1 &&
  /storeKey === 'ptf_crm_offers'[\s\S]{0,400}ptfEntitySaveCollection\(storeKey, b/.test(bridgeSrc) &&
  bridgeSrc.indexOf("reason: 'orphan-purge'") > -1);
T('②.۴ پاک‌سازی یتیم‌ها فقط ردیف‌های واقعاً حذف‌شده را ثبت می‌کند (ردیف قرنطینه‌شده حذف نمی‌شود)',
  /function purge\(storeKey, pred\)[\s\S]{0,900}removed\.push\(x\);[\s\S]{0,80}return false;/.test(bridgeSrc));
T('②.۵ بازگردانی اجرای دستیار هم سنگ‌قبر می‌زند',
  aiSrc.indexOf('ptfOfferWriteTombstones(_remOf') > -1 && aiSrc.indexOf('ai-wb-rollback') > -1);
T('②.۶ حذف دستی تک‌رکوردی دست‌نخورده مانده (بدون رگرسیون)',
  offersSrc.indexOf('function ptfOfferDelDo(no)') > -1 && offersSrc.indexOf("kind: 'OFFER'") > -1);

/* ───────────── ③ سرور: دروازهٔ سختِ پیشنهاد + لاگ افت + meta.n ───────────── */
SECTION('③ دروازهٔ سرور api/crm.php — افتِ بی‌سنگ‌قبرِ پیشنهاد پذیرفته نمی‌شود');
T('③.۱ شاخهٔ سخت‌گیرانه برای ptf_crm_offers اضافه شده است',
  apiSrc.indexOf("$strictShrink = ($key === 'ptf_crm_offers');") > -1 &&
  apiSrc.indexOf('if ($srvCount < 4 && !$strictShrink) return null;') > -1);
T('③.۲ در شاخهٔ سخت، «۱ ردیف غایب» هم تعارض است (سقف ۳ و ۲۵٪ دور زده شده)',
  /if \(\$strictShrink\) \{\s*if \(\$lost <= 0\) return null;\s*return \[[\s\S]{0,240}'strict' => true\];/.test(apiSrc));
T('③.۳ سقف قدیمی برای کلیدهای دیگر دست‌نخورده مانده (بدون رگرسیون گسترده)',
  apiSrc.indexOf('if ($lost <= 3 || $lost < $srvCount * 0.25) return null;') > -1);
T('③.۴ ابزارهای لاگ افت (sync_shrink_watch_keys/missing_ids/log_key_shrink) تعریف شده‌اند',
  apiSrc.indexOf('function sync_shrink_watch_keys()') > -1 &&
  apiSrc.indexOf('function sync_shrink_missing_ids(') > -1 &&
  apiSrc.indexOf('function sync_log_key_shrink(') > -1);
T('③.۵ لاگ افت در هر دو حالت «مسدود» و «مجاز» نوشته می‌شود',
  apiSrc.indexOf("(string)($j['by'] ?? ''), 'blocked')") > -1 &&
  apiSrc.indexOf("(string)($j['by'] ?? ''), 'accepted')") > -1);
T('③.۶ پیامد در سرور تشخیص‌پذیر است: پاسخ massDeletionBlocked همان کلید را conflict می‌کند',
  /if \(\$mdReport !== null\) \{[\s\S]{0,700}\$rejected\[\] = \$k;/.test(apiSrc));
T('③.۷ شمار رکورد هر کلید در meta.json ثبت می‌شود (منبع ترمیم خودکار کلاینت)',
  apiSrc.indexOf('function sync_meta_record_count(') > -1 &&
  apiSrc.indexOf("'n' => sync_meta_record_count(\$k, \$v)") > -1);
T('③.۸ مسیر فرمان سرور (sales-domain) هم n را ثبت می‌کند',
  sdApiSrc.indexOf("'by'=>'sales-domain-v35','n'=>\$_n") > -1);
T('③.۹ sync_stats خلاصهٔ key_shrink.log را برمی‌گرداند',
  apiSrc.indexOf("'/sync/key_shrink.log'") > -1 && apiSrc.indexOf("'shrink' => \$shrink") > -1);
T('③.۱۰ مسیرهای مجاز (restore/allow_wipe/union) از دروازه مستثنی مانده‌اند',
  apiSrc.indexOf('if (!$restore && !$allow_wipe && !$isSharedUnion) {') > -1);

/* ───────────── ④ کلاینت: ترمیم خودکار «کپی کوتاه‌تر از سرور» (اجرای واقعی) ───────────── */
SECTION('④ ptfSyncDetectMissingRows — تشخیص و ترمیم دادهٔ کهنهٔ دستگاه');
(function () {
  function braceSlice(src, mark) {
    var i = src.indexOf(mark);
    if (i < 0) return '';
    var open = src.indexOf('{', i), depth = 0, j = open;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(i, j + 1);
  }
  var i0 = syncSrc.indexOf('var SHRINK_WATCH = [');
  var i1 = syncSrc.indexOf('window.ptfSyncDetectMissingRows = function');
  var detSrc = (i0 > -1 && i1 > i0) ? (syncSrc.slice(i0, i1) + braceSlice(syncSrc, 'window.ptfSyncDetectMissingRows = function') + ';') : '';
  T('④.۰ برش واقعی ترمیم‌گر پیدا شد', detSrc.length > 200 && detSrc.indexOf('SHRINK_WATCH') > -1);
  T('④.۱ ترمیم‌گر بعد از هر meta معتبر سرور صدا زده می‌شود (applyServerMeta)',
    /saveKrevs\(m\);\s*if \(gr > current\) setRev\(gr\);[\s\S]{0,400}ptfSyncDetectMissingRows\(meta\)/.test(syncSrc));

  function boot(localMap, krevsMap) {
    var calls = { audit: [], pushes: 0, saved: null, badge: [] };
    var ctx = {
      console: console, JSON: JSON, Date: Date, Object: Object, Array: Array, String: String, Number: Number,
      state: { bootstrapped: true, dirty: {} },
      SYNC_KEYS: ['ptf_crm_offers', 'ptf_crm_rfqs', 'ptf_crm_customers'],
      rd: function (k) { return Object.prototype.hasOwnProperty.call(localMap, k) ? localMap[k] : null; },
      krevs: function () { return JSON.parse(JSON.stringify(krevsMap)); },
      saveKrevs: function (m) { calls.saved = m; },
      saveDirty: function () {},
      audit: function (a, b, c) { calls.audit.push([a, b, c]); },
      schedulePush: function () { calls.pushes++; },
      setSyncBadge: function (b) { calls.badge.push(b); },
      setTimeout: setTimeout, clearTimeout: clearTimeout
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(detSrc, ctx, { filename: 'shrink-heal-slice.js' });
    return { fn: ctx.ptfSyncDetectMissingRows, ctx: ctx, calls: calls };
  }
  var offers5 = JSON.stringify([{ no: 'PTF-CO-1405-0001' }, { no: 'PTF-CO-1405-0002' }, { no: 'PTF-CO-1405-0003' }, { no: 'PTF-CO-1405-0004' }, { no: 'PTF-CO-1405-0005' }]);

  var hA = boot({ ptf_crm_offers: offers5 }, { ptf_crm_offers: 812, ptf_crm_rfqs: 40 });
  var rA = hA.fn({ ptf_crm_offers: { rev: 812, n: 9 }, ptf_crm_rfqs: { rev: 40, n: 40 } });
  T('④.۲ کپی محلی کوتاه (۵ در برابر ۹) تشخیص داده شد', rA.length === 1 && rA[0].key === 'ptf_crm_offers' && rA[0].local === 5 && rA[0].server === 9, JSON.stringify(rA));
  T('④.۳ کلید dirty شد تا pull بعدی با merge اجتماع بیاید (نه جایگزینی)', hA.ctx.state.dirty['ptf_crm_offers'] === true);
  T('④.۴ watermark همان کلید پایین آمد (بقیهٔ کلیدها دست‌نخورده)', hA.calls.saved && hA.calls.saved.ptf_crm_offers === undefined && hA.calls.saved.ptf_crm_rfqs === 40, JSON.stringify(hA.calls.saved));
  T('④.۵ push و pull فوری زمان‌بندی شد', hA.calls.pushes === 1);
  T('④.۶ ردّ حسابرسی (audit) برای شفافیت ثبت شد', hA.calls.audit.length === 1 && /SHRINK-HEAL/.test(String(hA.calls.audit[0][2])));
  T('④.۷ سقف اسکن (throttle) فعال است: فراخوانی دوم بی‌درنگ چیزی ترمیم نمی‌کند', hA.fn({ ptf_crm_offers: { rev: 812, n: 9 } }).length === 0);

  var hB = boot({ ptf_crm_offers: offers5 }, { ptf_crm_offers: 5 });
  T('④.۸ وقتی شمار محلی برابر/بیشتر از سرور است هیچ ترمیمی رخ نمی‌دهد', hB.fn({ ptf_crm_offers: { rev: 5, n: 5 } }).length === 0 && !hB.ctx.state.dirty['ptf_crm_offers']);

  var hC = boot({ ptf_crm_offers: '[]' }, {});
  T('④.۹ دستگاه تازه (کپی خالی) ترمیم نمی‌شود — pull عادی مسئول است', hC.fn({ ptf_crm_offers: { rev: 9, n: 9 } }).length === 0);

  var hD = boot({ ptf_crm_offers: offers5 }, {});
  T('④.۱۰ سرورِ قدیمی بدون فیلد n ⇒ fail-open (هیچ ترمیم/تغییری)', hD.fn({ ptf_crm_offers: { rev: 9 } }).length === 0 && hD.calls.saved === null);

  var hE = (function () { var x = boot({ ptf_crm_offers: offers5 }, {}); x.ctx.state.bootstrapped = false; return x; })();
  T('④.۱۱ پیش از bootstrap شدن سینک هیچ ترمیمی انجام نمی‌شود', hE.fn({ ptf_crm_offers: { rev: 9, n: 9 } }).length === 0);

  var hF = boot({ ptf_crm_offers: offers5 }, {});
  T('④.۱۲ کپی محلیِ بیشتر از سرور (ردیف ارسال‌نشدهٔ محلی) ترمیم نمی‌شود — هیچ ردیفی نمی‌سوزد',
    hF.fn({ ptf_crm_offers: { rev: 9, n: 3 } }).length === 0 && !hF.ctx.state.dirty['ptf_crm_offers']);
  var hG = boot({ ptf_crm_rfqs: '{"a":1}' }, {});
  T('④.۱۳ اگر مقدار محلی JSON آبجکتی باشد (نه آرایه) ترمیم نمی‌شود', hG.fn({ ptf_crm_rfqs: { rev: 2, n: 5 } }).length === 0);
})();

console.log('\n— tester694 (v34.39.56: دروازهٔ افت پیشنهاد + ترمیم خودکار) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
if (fail) process.exit(1);

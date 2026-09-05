/* =====================================================================
   tester588 — v34.37.5 (MIGRATION-CONVERGENCE / RCA بن‌بست «۴۸ از ۴۹ کلید»)
   ---------------------------------------------------------------------
   این تستر «رفتاری» است: sync.js + client-server.js را در یک VM با سرورِ
   ساختگی (fetch اسکریپت‌شده) اجرا می‌کند و همان سناریوی واقعی دستگاهِ
   گیرکرده را بازسازی می‌کند:

     R5  — protectedConflicts از ptfBPushBatch به مصرف‌کننده می‌رسد
           (پیش از این می‌افتاد ⇒ شاخهٔ نجاتِ کلید مالی کدِ مرده بود).
     R3  — watermark پس از ACK جلو می‌رود، ولی برای کلیدهای union
           (audit/avatars/notifs) هرگز (وگرنه ردیف سایر دستگاه‌ها گم می‌شود).
     P0-1— «انتقال یک‌باره» با همان موتور نجات/تلاش‌مجددِ صف همگرا می‌شود و
           معیارِ پایان، تأییدِ تک‌تک کلیدهاست (نه موفقیتِ یک تیر).
     P0-2— ptfBConfirmFlush نشانگرها را پیش از تلاش پاک نمی‌کند.
     P0-3— شکستِ مهاجرت با کد/علت/کلیدها ثبت و در جعبهٔ تشخیص نشان داده می‌شود.
     F5/F6/F7 — صف فاز B در تشخیص دیده می‌شود؛ برابری فهرست کلیدها؛
           مهرِ زمانیِ dirty بازنشانی نمی‌شود.

   هیچ فایل مخزنی را تغییر نمی‌دهد؛ فقط fixture در حافظه.
   ===================================================================== */
'use strict';
var fs = require('fs');
var vm = require('vm');

var syncSrc = fs.readFileSync('crm/sync.js', 'utf8');
var csSrc = fs.readFileSync('crm/client-server.js', 'utf8');
var apiSrc = fs.readFileSync('api/crm.php', 'utf8');
var bakSrc = fs.readFileSync('crm/backup.js', 'utf8');

var p = 0, f = 0;
function T(name, cond, extra) {
  if (cond) { p++; console.log('PASS ' + name); }
  else { f++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

/* ---------- ابزارهای fixture ---------- */
function storage() {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
    key: function (i) { return Object.keys(data)[i]; },
    get length() { return Object.keys(data).length; },
    _dump: function () { return data; }
  };
}
function parseLocal(ls, key) { try { return JSON.parse(ls.getItem(key) || '{}'); } catch (e) { return {}; } }

/* پاسخ‌های اسکریپت‌شدهٔ data_push: هر فراخوانی یک پاسخ را مصرف می‌کند. */
function makeContext(opts) {
  opts = opts || {};
  var ls = storage();
  var pushes = [];          /* بدنهٔ هر data_push که واقعاً ارسال شد */
  var script = (opts.script || []).slice();
  var alerts = [], audits = [], ackCalls = [], enableCalls = 0, reloads = 0;
  var diagEl = { innerHTML: '', insertAdjacentHTML: function () {} };

  var c = {
    window: null, console: console, localStorage: ls,
    getData: function (k) { try { return JSON.parse(ls.getItem(k) || '[]'); } catch (e) { return []; } },
    setData: function (k, v) { ls.setItem(k, JSON.stringify(v)); return true; },
    curRole: function () { return opts.role || 'admin'; },
    curSession: function () { return { user: 'admin', name: 'UAT Admin' }; },
    ptfAuthToken: function () { return 'tok-uat'; },
    ptfToast: function () {}, notify: function () {},
    audit: function (who, msg, tag) { audits.push(String(msg || '')); },
    alert: function (m) { alerts.push(String(m || '')); if (opts.onAlert) opts.onAlert(String(m || '')); },
    confirm: function () { return opts.confirm === undefined ? true : !!opts.confirm; },
    ptfSmartMerge: function (k, local, remote) { return remote; },
    ptfApplyDeletionTombstones: function (k, str) { return str; },
    faDateTime: function () { return '۱۴۰۵/۰۶/۱۳ ۱۰:۰۰'; },
    escP: function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    /* IDB کوچک: صف آفلاین و آینهٔ داده */
    _idb: {},
    ptfStorageSafeSetItem: function (k, v) { ls.setItem(k, v); return true; },
    ptfStorageIdbSet: function (id, v, cb) { this._idb[id] = v; if (cb) cb(true); },
    ptfStorageIdbGet: function (id, cb) { cb(this._idb[id] !== undefined ? { value: this._idb[id] } : null); },
    ptfStorageIdbDel: function (id, cb) { delete this._idb[id]; if (cb) cb(true); },
    ptfStorageIdbKeys: function (cb) { cb(Object.keys(this._idb || {})); },
    ptfIdbStats: function (cb) { cb && cb({ ok: true, count: 0, bytes: 0 }); },
    document: {
      hidden: true, hasFocus: function () { return true; }, activeElement: null,
      getElementById: function (id) { return id === 'ptfSyncDiagBody' ? diagEl : null; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
      head: { appendChild: function () {} }, body: { appendChild: function () {} },
      addEventListener: function () {}, documentElement: { style: { setProperty: function () {} } }
    },
    navigator: { onLine: true },
    location: { reload: function () { reloads++; } },
    setInterval: function () { return 1; }, clearInterval: function () {},
    /* تایمرهای بلند (debounce/poll) بلعیده می‌شوند تا موتور legacy وسط تست
       push نکند؛ تایمرهای کوتاه (تلاش مجدد ۹۰۰ms) سریع اجرا می‌شوند. */
    setTimeout: function (fn, ms) { if ((ms || 0) > 1000) return 0; return setTimeout(fn, 5); },
    clearTimeout: function (id) { try { clearTimeout(id); } catch (e) {} },
    addEventListener: function () {}, removeEventListener: function () {},
    fetch: function (url, options) {
      url = String(url || '');
      if (url.indexOf('data_push') < 0) {
        return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ ok: true, fresh: true, rev: 1, meta: {} }); } });
      }
      var body = JSON.parse(options.body);
      pushes.push(body);
      var response = script.length ? script.shift() : defaultOk(body);
      return Promise.resolve({ status: 200, json: function () { return Promise.resolve(response); } });
    },
    Promise: Promise, Date: Date, JSON: JSON, Math: Math, Object: Object, Array: Array,
    String: String, Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error,
    isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, encodeURIComponent: encodeURIComponent
  };
  function defaultOk(body) {
    var ks = Object.keys(body.data || {}), kr = {};
    ks.forEach(function (k) { kr[k] = 5; });
    return { ok: true, saved: ks.length, savedKeys: ks, rejected: [], skipped: [], forbidden: [], conflicts: [], protectedConflicts: [], serverData: {}, krevs: kr, rev: 5, role: 'admin' };
  }
  c.window = c;
  if (opts.phaseB) ls.setItem('ptf_b_phase', '1');
  vm.createContext(c);
  vm.runInContext(syncSrc, c, { filename: 'sync-uat588.js' });
  vm.runInContext(csSrc, c, { filename: 'client-server-uat588.js' });

  /* جاسوس‌ها (بدون تغییر رفتار واقعی) */
  var realAck = c.ptfSyncAcknowledgeKeys;
  c.ptfSyncAcknowledgeKeys = function (keys, submitted) { ackCalls.push((keys || []).slice()); return realAck ? realAck(keys, submitted) : undefined; };
  c.ptfBEnableAfterConvergence = function () { enableCalls++; ls.setItem('ptf_b_phase', '1'); return { moved: 0 }; };

  return {
    c: c, ls: ls, pushes: pushes, alerts: alerts, audits: audits, ackCalls: ackCalls, diagEl: diagEl,
    enableCalls: function () { return enableCalls; },
    reloads: function () { return reloads; },
    status: function () { return c.ptfBStatus(); }
  };
}
function waitFor(fn, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var started = Date.now();
    (function poll() {
      var v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return resolve(v);
      if (Date.now() - started > (timeoutMs || 4000)) return reject(new Error('timeout waiting for condition'));
      setTimeout(poll, 5);
    })();
  });
}

(async function () {

  /* ==================== 1) R5 — عبور protectedConflicts ==================== */
  console.log('\n── R5: protectedConflicts از ptfBPushBatch عبور می‌کند ──');
  await (async function () {
    var canonical = '[{"id":"srv-1","amt":400,"recurringKey":"salary:SH1:1405/06"}]';
    var h = makeContext({
      script: [{
        ok: true, saved: 0, savedKeys: ['ptf_crm_opex'], /* پاسخ بدشکل: کلیدِ در تعارض را saved هم اعلام می‌کند */
        rejected: [], skipped: [], forbidden: [],
        conflicts: ['ptf_crm_opex'], protectedConflicts: ['ptf_crm_opex'],
        serverData: { ptf_crm_opex: canonical }, krevs: { ptf_crm_opex: 12 }, rev: 12, role: 'admin'
      }]
    });
    await new Promise(function (res) {
      h.c.ptfBPushBatch({ ptf_crm_opex: '[{"id":"loc-1","amt":1}]' }, function (d) {
        T('R5: protectedConflicts به مصرف‌کننده می‌رسد', Array.isArray(d.protectedConflicts) && d.protectedConflicts.indexOf('ptf_crm_opex') >= 0, JSON.stringify(d.protectedConflicts));
        T('R5: کلیدِ در تعارض، saved/fail-closed نیست', d.savedKeys.length === 0 && d.ok === false);
        T('R5: serverData (نسخهٔ معتبر سرور) همراه پاسخ است', d.serverData && d.serverData.ptf_crm_opex === canonical);
        T('R5: krevs/rev پاسخ برای watermark در دسترس است', d.krevs.ptf_crm_opex === 12 && d.rev === 12);
        res();
      });
    });
  })();

  (function () {
    /* مسیرهای بازگشت زودهنگام هم باید فیلد را داشته باشند (contract یکنواخت) */
    var h = makeContext({});
    var seen = null;
    h.c.ptfSyncCommandKeyHeld = function () { return true; }; /* همهٔ کلیدها blocked ⇒ !keys.length */
    h.c.ptfBPushBatch({ ptf_crm_offers: '[]' }, function (d) { seen = d; });
    T('R5: مسیر «همه blocked» هم protectedConflicts می‌دهد', seen && Array.isArray(seen.protectedConflicts) && seen.protectedConflicts.length === 0);
  })();

  /* منبع: تجمع و فیلتر fail-closed */
  T('R5 (منبع): تجمع protectedConflicts در ptfBPushBatch', csSrc.indexOf('var protectedConflicts = [];') > -1 && csSrc.indexOf('addUnique(protectedConflicts, dProtected);') > -1);
  T('R5 (منبع): savedKeys کلید محافظت‌شدهٔ در تعارض را کنار می‌گذارد', /dProtected\.indexOf\(k\) < 0/.test(csSrc));
  T('R5 (منبع): سرور protectedConflicts را منتشر می‌کند', apiSrc.indexOf("'protectedConflicts' => array_values(array_unique($protectedConflicts))") > -1);

  /* ==================== 2) R3 — watermark پس از ACK ==================== */
  console.log('\n── R3: watermark پس از ACK (و استثنا برای کلیدهای union) ──');
  await (async function () {
    var h = makeContext({
      phaseB: true,
      script: [{
        ok: true, saved: 2, savedKeys: ['ptf_crm_settings', 'ptf_crm_audit'], rejected: [], skipped: [], forbidden: [],
        conflicts: [], protectedConflicts: [], serverData: {},
        krevs: { ptf_crm_settings: 9, ptf_crm_audit: 7, ptf_crm_avatars: 4 }, rev: 9, role: 'admin'
      }]
    });
    h.ls.setItem('ptf_sync_krevs', JSON.stringify({ ptf_crm_settings: 3, ptf_crm_audit: 2, ptf_crm_avatars: 2 }));
    h.ls.setItem('ptf_crm_settings', '{"gen":1}');
    h.ls.setItem('ptf_crm_audit', '[{"t":"a"}]');
    h.c.ptfBEnqueueKeys(['ptf_crm_settings', 'ptf_crm_audit']);
    await new Promise(function (res) { h.c.ptfBFlushQueue(res); });
    var kr = parseLocal(h.ls, 'ptf_sync_krevs');
    T('R3: کلید ACK‌شده watermark را جلو می‌برد (3 → 9)', kr.ptf_crm_settings === 9, JSON.stringify(kr));
    T('R3: کلید union (audit) با ACK جلو نمی‌رود', kr.ptf_crm_audit === 2, JSON.stringify(kr));
    T('R3: کلید union (avatars) که ارسال هم نشده تکان نمی‌خورد', kr.ptf_crm_avatars === 2, JSON.stringify(kr));
    T('R3: rev سراسری از پاسخ push ثبت می‌شود', h.ls.getItem('ptf_sync_rev') === '9');
  })();
  await (async function () {
    /* سرور برای کلیدِ «در تعارض/رد شده» هم krevs می‌فرستد؛ اگر watermark آن‌ها جلو
       برود، push بعدی با base برابرِ سرور دیگر conflict نمی‌دهد ⇒ کپی محلیِ
       همگرانشده نسخهٔ معتبر سرور را کورکورانه بازنویسی می‌کند. فقط ACK واقعی. */
    var h = makeContext({
      phaseB: true,
      script: [{
        ok: true, saved: 1, savedKeys: ['ptf_crm_settings'],
        rejected: ['ptf_crm_trash'], skipped: [], forbidden: [],
        conflicts: ['ptf_crm_opex'], protectedConflicts: ['ptf_crm_opex'],
        serverData: {}, /* نجات ناممکن */
        krevs: { ptf_crm_settings: 50, ptf_crm_opex: 51, ptf_crm_trash: 52 }, rev: 52, role: 'admin'
      }]
    });
    h.ls.setItem('ptf_sync_krevs', JSON.stringify({ ptf_crm_settings: 40, ptf_crm_opex: 41, ptf_crm_trash: 42 }));
    h.ls.setItem('ptf_crm_settings', '{"gen":1}');
    h.ls.setItem('ptf_crm_opex', '[{"id":"loc"}]');
    h.ls.setItem('ptf_crm_trash', '[{"id":"t"}]');
    h.c.ptfBEnqueueKeys(['ptf_crm_settings', 'ptf_crm_opex', 'ptf_crm_trash']);
    await new Promise(function (res) { h.c.ptfBFlushQueue(res); });
    var kr = parseLocal(h.ls, 'ptf_sync_krevs');
    T('R3: کلید ACK‌شده جلو می‌رود', kr.ptf_crm_settings === 50, JSON.stringify(kr));
    T('R3: کلیدِ در تعارضِ نجات‌ناپذیر جلو نمی‌رود (ضد بازنویسی کورکورانه)', kr.ptf_crm_opex === 41, JSON.stringify(kr));
    T('R3: کلیدِ ردشده جلو نمی‌رود (pull بعدی نسخهٔ سرور را می‌آورد)', kr.ptf_crm_trash === 42, JSON.stringify(kr));
    T('R3: کلید در تعارض، dirty/صفش پاک نشد (fail-closed)', h.c.ptfSyncPendingKeys().indexOf('ptf_crm_opex') >= 0, JSON.stringify(h.c.ptfSyncPendingKeys()));
  })();
  T('R3 (منبع): استثنا با پیش‌بینی مشترکِ union تعریف شده', csSrc.indexOf('window.ptfSyncIsSharedUnionKey') > -1 && syncSrc.indexOf('window.ptfSyncIsSharedUnionKey = isSharedUnionKey;') > -1);
  T('R3 (منبع): فهرست union کلاینت = فهرست سرور', (function () {
    var m = syncSrc.match(/function isSharedUnionKey\(k\) \{ return \[([^\]]*)\]/);
    var cli = m ? m[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); }) : [];
    var srv = apiSrc.match(/function sync_shared_union_key\(\$key\)\s*\{[\s\S]{0,700}?in_array\(\$key,\s*\[([^\]]*)\]/);
    var serverKeys = srv ? srv[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); }) : [];
    return cli.length === 3 && serverKeys.length === 3 && cli.every(function (k) { return serverKeys.indexOf(k) >= 0; });
  })(), 'client/server union list mismatch');

  /* ==================== 3) P0-1 — همگرایی انتقال یک‌باره ==================== */
  console.log('\n── P0-1: «انتقال یک‌باره» با نجات/تلاش مجدد همگرا می‌شود ──');
  await (async function () {
    var canonicalOpex = '[{"id":"srv-1","type":"salary","amt":400,"recurringKey":"salary:SH1:1405/06"}]';
    var h = makeContext({
      script: [
        /* نوبت ۰: settings و fin_events تأیید، opex در تعارضِ محافظت‌شده */
        {
          ok: true, saved: 2, savedKeys: ['ptf_crm_settings', 'ptf_crm_fin_events'],
          rejected: [], skipped: [], forbidden: [],
          conflicts: ['ptf_crm_opex'], protectedConflicts: ['ptf_crm_opex'],
          serverData: { ptf_crm_opex: canonicalOpex },
          krevs: { ptf_crm_settings: 20, ptf_crm_fin_events: 20, ptf_crm_opex: 21 }, rev: 21, role: 'admin'
        },
        /* نوبت ۱: همان opex با نسخهٔ canonical ⇒ ACK */
        {
          ok: true, saved: 1, savedKeys: ['ptf_crm_opex'], rejected: [], skipped: [], forbidden: [],
          conflicts: [], protectedConflicts: [], serverData: {},
          krevs: { ptf_crm_opex: 22 }, rev: 22, role: 'admin'
        }
      ]
    });
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    h.ls.setItem('ptf_crm_fin_events', '[{"id":"fe-1"}]');
    h.ls.setItem('ptf_crm_opex', '[{"id":"loc-1","type":"misc","amt":1}]');
    h.ls.setItem('ptf_sync_krevs', JSON.stringify({ ptf_crm_opex: 3 }));
    h.c.ptfSyncMarkPendingKeys(['ptf_crm_settings', 'ptf_crm_fin_events', 'ptf_crm_opex']);

    h.c.ptfBFinalize();
    await waitFor(function () { return h.alerts.length ? h.alerts[h.alerts.length - 1] : null; });

    T('P0-1: دقیقاً دو نوبت ارسال شد (بدون حلقهٔ بی‌پایان)', h.pushes.length === 2, 'pushes=' + h.pushes.length);
    T('P0-1: نوبت دوم فقط کلیدِ نجات‌یافته را برد', Object.keys(h.pushes[1].data).join(',') === 'ptf_crm_opex', JSON.stringify(Object.keys(h.pushes[1].data)));
    T('P0-1: VERBATIM-CONVERGENCE — نوبت دوم عینِ نسخهٔ سرور است', h.pushes[1].data.ptf_crm_opex === canonicalOpex);
    T('P0-1: نشانگر flushed فقط پس از ACK کامل ثبت شد', h.ls.getItem('ptf_b_flushed_admin') === '1');
    T('P0-1: نشانگر synced ثبت شد', h.ls.getItem('ptf_b_synced_admin') === '1');
    T('P0-1: فاز B پس از همگرایی فعال شد', h.enableCalls() === 1 && h.status().enabled === true && h.status().synced === true);
    T('P0-1: پیام موفقیت و رفرش', h.alerts[0].indexOf('✅ هم‌گرایی انجام شد') === 0 && h.reloads() === 1);
    T('P0-1: همهٔ سه کلید ACK شدند (dirty پاک)', h.ackCalls.length >= 1 && ['ptf_crm_settings', 'ptf_crm_fin_events', 'ptf_crm_opex'].every(function (k) {
      return h.ackCalls.some(function (list) { return list.indexOf(k) >= 0; });
    }), JSON.stringify(h.ackCalls));
    T('P0-1: کپی محلی opex با نسخهٔ سرور جایگزین شد', h.ls.getItem('ptf_crm_opex') === canonicalOpex);
    T('P0-1: watermark opex از همان پاسخ جلو رفت', parseLocal(h.ls, 'ptf_sync_krevs').ptf_crm_opex === 22);
    T('P0-1: audit موفقیت ثبت شد', h.audits.some(function (m) { return m.indexOf('انتقال یک‌باره کامل شد') > -1; }), JSON.stringify(h.audits));
    T('P0-1: صف آفلاین پس از ACK خالی است', Object.keys(parseLocal(h.ls, 'ptf_b_queue')).length === 0 && (h.c._idb['q:ptf_b_queue'] === undefined || Object.keys(JSON.parse(h.c._idb['q:ptf_b_queue'])).length === 0));
  })();

  /* ---------- معیارِ منصفانه: بن‌بستِ قبلی (تعارض دائمی) باید گزارش شود نه اینکه ساکت بماند ---------- */
  console.log('\n── P0-3: شکستِ مهاجرت دقیق و قابل تشخیص است ──');
  await (async function () {
    var h = makeContext({
      script: [
        /* سرور هر بار opex را در تعارض می‌دهد ولی serverData نمی‌فرستد ⇒ نجات ناممکن */
        {
          ok: true, saved: 1, savedKeys: ['ptf_crm_settings'], rejected: [], skipped: [],
          forbidden: ['ptf_crm_personal_cheques'], conflicts: ['ptf_crm_opex'], protectedConflicts: ['ptf_crm_opex'],
          serverData: {}, krevs: { ptf_crm_settings: 30 }, rev: 30, role: 'admin'
        },
        {
          ok: true, saved: 0, savedKeys: [], rejected: [], skipped: [],
          forbidden: ['ptf_crm_personal_cheques'], conflicts: ['ptf_crm_opex'], protectedConflicts: ['ptf_crm_opex'],
          serverData: {}, krevs: {}, rev: 30, role: 'admin'
        },
        {
          ok: true, saved: 0, savedKeys: [], rejected: [], skipped: [],
          forbidden: ['ptf_crm_personal_cheques'], conflicts: ['ptf_crm_opex'], protectedConflicts: ['ptf_crm_opex'],
          serverData: {}, krevs: {}, rev: 30, role: 'admin'
        },
        {
          ok: true, saved: 0, savedKeys: [], rejected: [], skipped: [],
          forbidden: ['ptf_crm_personal_cheques'], conflicts: ['ptf_crm_opex'], protectedConflicts: ['ptf_crm_opex'],
          serverData: {}, krevs: {}, rev: 30, role: 'admin'
        }
      ]
    });
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    h.ls.setItem('ptf_crm_opex', '[{"id":"loc-1","amt":1}]');
    h.ls.setItem('ptf_crm_personal_cheques', '[{"id":"pc-1"}]');
    h.c.ptfBFinalize();
    await waitFor(function () { return h.alerts.length ? h.alerts[h.alerts.length - 1] : null; });
    var msg = h.alerts[h.alerts.length - 1];

    T('P0-3: تعارضِ نجات‌ناپذیر تلاشِ بیهوده نمی‌کند (یک درخواست، سپس گزارش)', h.pushes.length === 1, 'pushes=' + h.pushes.length);
    T('P0-3: پیام، شمارِ دقیق تأییدشده‌ها را می‌گوید (مبنای تجمعی)', msg.indexOf('1 از 3 کلید روی سرور تأیید شد') > -1, msg);
    T('P0-3: کلاسِ «تعارض» با نام کلید گزارش شد', msg.indexOf('تعارض داده با نسخهٔ سرور') > -1 && msg.indexOf('opex') > -1, msg);
    T('P0-3: کلاسِ «خارج از allowlist نقش» با نام کلید گزارش شد', msg.indexOf('خارج از allowlist نقش فعلی') > -1 && msg.indexOf('personal_cheques') > -1, msg);
    T('P0-3: راهنمای عملیِ هر کلاس در پیام هست', msg.indexOf('تلاش مجدد ارسال') > -1 && msg.indexOf('allowlist') > -1);
    T('P0-2: نشانگرها پس از شکست پاک/خراب نشدند', h.ls.getItem('ptf_b_flushed_admin') !== '1' && h.ls.getItem('ptf_b_synced_admin') !== '1');
    T('P0-2: فاز B بدون همگرایی فعال نشد', h.enableCalls() === 0 && h.reloads() === 0);
    var last = JSON.parse(h.ls.getItem('ptf_sync_last_error') || 'null');
    T('P0-3: خطای دائمی با scope=migration ثبت شد', !!last && last.scope === 'migration' && last.status === 'conflicts', JSON.stringify(last));
    T('P0-3: علت، شمارهٔ نوبت و خطای سرور را دارد', !!last && /^انتقال یک‌باره ناتمام ماند \(نوبت \d/.test(last.reason || ''), JSON.stringify(last && last.reason));
    T('P0-3: detail فقط «کلاس:کلید» است (قابل رندر در UI)', !!last && /^[a-z]+:ptf_crm_[a-z_]+(\|[a-z_]+)*( ; [a-z]+:ptf_crm_[a-z_|]+)*$/.test(last.detail || ''), JSON.stringify(last && last.detail));
    T('P0-3: audit شکست ثبت شد', h.audits.some(function (m) { return m.indexOf('انتقال یک‌باره ناتمام') > -1; }), JSON.stringify(h.audits));
  })();

  /* ---------- P0-2: ptfBConfirmFlush روی دستگاهِ سبز ---------- */
  console.log('\n── P0-2: «تکمیل انتقال» نشانگرها را پیش از تلاش پاک نمی‌کند ──');
  await (async function () {
    var busy = function () { return { ok: false, error: 'server_busy' }; };
    var h = makeContext({
      script: [busy(), busy(), busy(), busy()], /* ۱ تلاش + ۳ نوبتِ تلاش مجدد */
      phaseB: true
    });
    h.ls.setItem('ptf_b_flushed_admin', '1');
    h.ls.setItem('ptf_b_synced_admin', '1');
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    var before = { f: h.ls.getItem('ptf_b_flushed_admin'), s: h.ls.getItem('ptf_b_synced_admin') };
    h.c.ptfBConfirmFlush();
    await waitFor(function () { return h.alerts.length ? h.alerts[h.alerts.length - 1] : null; });
    T('P0-2: نشانگر flushed پس از تلاشِ ناموفق باقی است', h.ls.getItem('ptf_b_flushed_admin') === before.f && before.f === '1');
    T('P0-2: نشانگر synced پس از تلاشِ ناموفق باقی است', h.ls.getItem('ptf_b_synced_admin') === before.s && before.s === '1');
    T('P0-2: دستگاه سبز، کهربایی نشد (enabled+synced)', h.status().enabled === true && h.status().synced === true, JSON.stringify(h.status()));
    T('P0-2: شکستِ ارسال با کدِ سرور گزارش شد', h.alerts[0].indexOf('شکست ارسال/تایم‌اوت') > -1 && h.alerts[0].indexOf('server_busy') > -1, h.alerts[0]);
    T('P0-2: تلاشِ مجدد محدود به سقف نوبت‌ها بود', h.pushes.length === 4, 'pushes=' + h.pushes.length);
    T('P0-2 (منبع): حذف نشانگرها از ptfBConfirmFlush برداشته شد', /window\.ptfBConfirmFlush = function \(\) \{[\s\S]{0,900}?window\.ptfBFinalize\(\{ force: true \}\);/.test(csSrc) && csSrc.indexOf('localStorage.removeItem(flushKey()); localStorage.removeItem(syncedKey());') === -1);
  })();

  /* ---------- «ردِ بی‌ضرر»: کپی محلی خالی ≠ از دست رفتن داده ---------- */
  console.log('\n── P0-1: ردِ بی‌ضرر (کپی محلی خالی) مانعِ پایان نیست ──');
  await (async function () {
    var h = makeContext({
      script: [{
        ok: true, saved: 1, savedKeys: ['ptf_crm_settings'], rejected: ['ptf_crm_trash'], skipped: [], forbidden: [],
        conflicts: [], protectedConflicts: [], serverData: {}, krevs: { ptf_crm_settings: 40 }, rev: 40, role: 'admin'
      }]
    });
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    h.ls.setItem('ptf_crm_trash', '[]'); /* سپر ضد داده‌صفر سرور این را رد می‌کند */
    h.c.ptfBFinalize();
    await waitFor(function () { return h.alerts.length ? h.alerts[h.alerts.length - 1] : null; });
    T('P0-1: کلید با کپی محلیِ خالی، همگرایی را نمی‌بندد', h.pushes.length === 1 && h.alerts[0].indexOf('✅ هم‌گرایی انجام شد') === 0, h.alerts[0]);
    T('P0-1: نشانگرها ثبت و فاز B فعال شد', h.ls.getItem('ptf_b_flushed_admin') === '1' && h.enableCalls() === 1);
    T('P0-1: audit شفاف می‌گوید آن کلید از سرور بازخوانی می‌شود', h.audits.some(function (m) { return m.indexOf('trash') > -1 && m.indexOf('بازخوانی') > -1; }), JSON.stringify(h.audits));
  })();

  await (async function () {
    var h = makeContext({
      script: [{
        ok: true, saved: 1, savedKeys: ['ptf_crm_settings'], rejected: ['ptf_crm_trash'], skipped: [], forbidden: [],
        conflicts: [], protectedConflicts: [], serverData: {}, krevs: { ptf_crm_settings: 41 }, rev: 41, role: 'admin'
      }]
    });
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    h.ls.setItem('ptf_crm_trash', '[{"id":"t-1"}]'); /* رد شده با دادهٔ واقعی ⇒ fail-closed */
    h.c.ptfBFinalize();
    await waitFor(function () { return h.alerts.length ? h.alerts[h.alerts.length - 1] : null; });
    T('P0-1: کلیدِ ردشده با دادهٔ واقعی همچنان fail-closed است', h.alerts[0].indexOf('⚠️ انتقال یک‌باره کامل نشد') === 0 && h.alerts[0].indexOf('سپر داده') > -1, h.alerts[0]);
    T('P0-1: در این حالت نشانگر ثبت نمی‌شود', h.ls.getItem('ptf_b_flushed_admin') !== '1' && h.enableCalls() === 0);
  })();

  /* ---------- needLogin ---------- */
  console.log('\n── نیاز به ورود: پیام اختصاصی و دادهٔ محلی محفوظ ──');
  await (async function () {
    var h = makeContext({ script: [{ ok: false, needLogin: true, error: 'authentication_required' }] });
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    h.c.ptfBFinalize();
    await waitFor(function () { return h.alerts.length ? h.alerts[h.alerts.length - 1] : null; });
    T('needLogin: پیامِ نشستِ منقضی (نه «network» مبهم)', h.alerts[0].indexOf('نشست شما منقضی شده') > -1, h.alerts[0]);
    T('needLogin: نشانگرها ثبت نشد و داده محفوظ است', h.ls.getItem('ptf_b_flushed_admin') !== '1' && h.ls.getItem('ptf_crm_settings') === '{"gen":"local"}');
    T('needLogin: خطا ثبت شد', (JSON.parse(h.ls.getItem('ptf_sync_last_error') || 'null') || {}).status === 'needLogin');
  })();

  /* ---------- انصراف کاربر ---------- */
  await (async function () {
    var h = makeContext({ confirm: false });
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    h.c.ptfBFinalize();
    await new Promise(function (r) { setTimeout(r, 40); });
    T('انصراف: هیچ درخواستی ارسال نمی‌شود', h.pushes.length === 0);
    T('انصراف: راهنمای مسیرِ درستِ UI (بک‌آپ و بازگردانی ← وضعیت دستگاه)', h.alerts.length === 1 && h.alerts[0].indexOf('بک‌آپ و بازگردانی') > -1 && h.alerts[0].indexOf('هم‌گرایی داده»') === -1, h.alerts[0]);
  })();

  /* ---------- دستگاه تازه (مسیر خالی) دست‌نخورده ---------- */
  await (async function () {
    var h = makeContext({});
    h.c.ptfBFinalize();
    await new Promise(function (r) { setTimeout(r, 40); });
    T('مسیر خالی: بدون push، نشانگرها ثبت و فاز B فعال می‌شود', h.pushes.length === 0 && h.ls.getItem('ptf_b_flushed_admin') === '1' && h.enableCalls() === 1);
  })();
  await (async function () {
    var h = makeContext({});
    h.ls.setItem('ptf_crm_settings', '{"gen":"local"}');
    h.ls.setItem('ptf_crm_customers', '[{"id":"cust-1"}]');
    var r = h.c.ptfBFinalize({ auto: true });
    await new Promise(function (res) { setTimeout(res, 40); });
    T('حالت خودکار: دادهٔ موجود هرگز بی‌تأیید push نمی‌شود (fail-closed)', h.pushes.length === 0 && !!r && r.reason === 'local_data_requires_review');
  })();

  /* ==================== F5 — صف فاز B در تشخیص ==================== */
  console.log('\n── F5: صفِ IDB-محورِ فاز B در «تشخیص همگام‌سازی» دیده می‌شود ──');
  await (async function () {
    var h = makeContext({ phaseB: true });
    h.ls.setItem('ptf_crm_customers', '[{"id":"c-1"}]');
    h.c.ptfBEnqueueKeys(['ptf_crm_customers']);
    /* queueRead صف را از LS به IDB منتقل و LS را پاک می‌کند (v34.8.34/W1) */
    h.c.ptfBPendingKeys();
    T('F5: صف از localStorage بیرون رفته (شرطِ بازتولیدِ باگ)', h.ls.getItem('ptf_b_queue') === null);
    h.c.ptfSyncDiagnosticsRefresh();
    var html = h.diagEl.innerHTML;
    T('F5: باکس تشخیص، کلیدِ در صف را نشان می‌دهد', html.indexOf('ptf_crm_customers') > -1 && html.indexOf('کلید در صف آفلاین (فاز B)') > -1, html.slice(0, 400));
    T('F5: پیام گمراه‌کنندهٔ «صف خالی» نشان داده نمی‌شود', html.indexOf('صف آفلاین فاز B خالی است') === -1);
    T('F5: snapshot تشخیص هم همان union را دارد', h.c.ptfSyncDiagnosticsSnapshot().queueKeys.indexOf('ptf_crm_customers') >= 0);
  })();

  /* ==================== F6 — برابری فهرست کلیدها ==================== */
  console.log('\n── F6: فهرست کلیدهای فاز B = فهرست مرجع sync.js ──');
  await (async function () {
    var h = makeContext({ script: [] });
    var ref = h.c._ptfSyncKeys || [];
    T('F6: sync.js فهرست مرجع را صادر می‌کند', ref.length === 66, 'len=' + ref.length);
    var ks = h.c.ptfBKeysForTest ? h.c.ptfBKeysForTest() : null;
    /* bKeys داخلی است؛ از طریق مسیر واقعی مهاجرت بررسی می‌کنیم */
    h.ls.setItem('ptf_crm_fin_events', '[{"id":"fe-9"}]');
    h.ls.setItem('ptf_crm_personal_cheques', '[{"id":"pc-9"}]');
    h.c.ptfBFinalize();
    await waitFor(function () { return h.pushes.length ? h.pushes[0] : null; });
    var sent = Object.keys(h.pushes[0].data);
    T('F6: ptf_crm_fin_events در payload انتقال هست', sent.indexOf('ptf_crm_fin_events') >= 0, sent.join(','));
    T('F6: ptf_crm_personal_cheques در payload انتقال هست', sent.indexOf('ptf_crm_personal_cheques') >= 0, sent.join(','));
    T('F6: fallback دست‌نویس هم هر دو کلید را دارد', /'ptf_crm_fin_events','ptf_crm_personal_cheques'/.test(csSrc.replace(/\s+/g, '')));
    T('F6: فهرست ناقص cache نمی‌شود (ترتیب بارگیری)', csSrc.indexOf('window.__ptfBKeys = known;') === -1);
    void ks;
  })();

  /* ==================== F7 — سنِ کلیدِ dirty ==================== */
  console.log('\n── F7: مهرِ زمانیِ «در انتظار ارسال» بازنشانی نمی‌شود ──');
  await (async function () {
    var h = makeContext({});
    h.c.ptfSyncMarkPendingKeys(['ptf_crm_opex']);
    var first = parseLocal(h.ls, 'ptf_sync_dirty').ptf_crm_opex;
    await new Promise(function (r) { setTimeout(r, 25); });
    h.c.ptfSyncMarkPendingKeys(['ptf_crm_opex']);
    h.c.ptfSyncMarkPendingKeys(['ptf_crm_opex']);
    var second = parseLocal(h.ls, 'ptf_sync_dirty').ptf_crm_opex;
    T('F7: تلاش‌های پیاپی سنِ کلید را صفر نمی‌کنند', first === second && first > 0, first + ' vs ' + second);
    var info = h.c.ptfSyncDirtyInfo();
    T('F7: سن در UI قابل نمایش است', info.length === 1 && info[0].k === 'ptf_crm_opex' && info[0].ageSec >= 0);
  })();

  /* ==================== برچسب دامنه در جعبهٔ تشخیص ==================== */
  console.log('\n── P0-3: برچسب دامنهٔ «انتقال یک‌باره» در جعبهٔ تشخیص ──');
  await (async function () {
    var h = makeContext({});
    h.c.ptfSyncNoteError('migration', 'conflicts', 'انتقال یک‌باره ناتمام ماند', 'conflicts:ptf_crm_opex (round 1)');
    h.c.ptfSyncDiagnosticsRefresh();
    var html = h.diagEl.innerHTML;
    T('P0-3: دامنهٔ migration با برچسب درست نشان داده می‌شود', html.indexOf('انتقال یک‌باره') > -1 && html.indexOf('دریافت (pull)') === -1, html.slice(0, 300));
    T('P0-3: علت و کلیدها در جعبهٔ تشخیص هست', html.indexOf('conflicts:ptf_crm_opex') > -1);
  })();

  /* ==================== جعبهٔ وضعیت دستگاه (backup.js) ==================== */
  console.log('\n── UI: جعبهٔ وضعیت دستگاه علتِ آخرین شکست را نشان می‌دهد ──');
  T('UI: منبعِ جعبه، خطای مهاجرت را رندر می‌کند', bakSrc.indexOf("mLast.scope === 'migration'") > -1 && bakSrc.indexOf('آخرین تلاشِ انتقال ناتمام ماند') > -1);
  T('UI: برچسب‌های کلاسِ علت در جعبه هست', ['تعارض داده با نسخهٔ سرور', 'خارج از allowlist نقش فعلی', 'بزرگ‌تر از سقف ۸MB'].every(function (x) { return bakSrc.indexOf(x) > -1; }));
  T('UI: جعبه فقط در حالت غیرسبز علت را نشان می‌دهد', /if \(!green && mLast && mLast\.scope === 'migration'\)/.test(bakSrc));
  T('UI: ارجاعِ منسوخِ «تنظیمات → هم‌گرایی داده» در client-server نمانده', csSrc.indexOf('تنظیمات → هم‌گرایی داده') === -1);

  /* ==================== جعبهٔ وضعیت دستگاه: رندر واقعی ==================== */
  console.log('\n── UI: رندر واقعیِ جعبهٔ وضعیت دستگاه (VM) ──');
  (function () {
    /* بلوک IIFE جعبه از backup.js برش و با stubها اجرا می‌شود تا رندرِ واقعیِ
       «علتِ آخرین شکست» دیده شود (نه فقط وجودِ رشته در منبع). */
    var start = bakSrc.indexOf("(function () {\n        var st = (typeof window.ptfBStatus");
    var boxSrc = null;
    if (start > -1) {
      var end = bakSrc.indexOf('\n      })();', start);
      if (end > -1) boxSrc = bakSrc.slice(start, end + '\n      })();'.length);
    }
    T('UI: بلوک جعبهٔ وضعیت دستگاه قابل برش است', !!boxSrc);
    if (!boxSrc) return;
    function renderBox(st, lastErr, dirtyInfo) {
      var ctx = {
        window: {
          ptfBStatus: function () { return st; },
          ptfSyncDirtyInfo: function () { return dirtyInfo || []; },
          ptfSyncLastError: function () { return lastErr; },
          ptfSyncDropDirtyKey: function () { return true; }
        },
        escP: function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      };
      vm.createContext(ctx);
      return vm.runInContext('var __h = ' + boxSrc + '; __h;', ctx, { filename: 'device-box-uat588.js' });
    }
    var migErr = {
      scope: 'migration', status: 'conflicts', reason: 'انتقال یک‌باره ناتمام ماند',
      detail: 'conflicts:ptf_crm_opex ; forbidden:ptf_crm_personal_cheques',
      fa: '۱۴۰۵/۰۶/۱۳ ۱۰:۰۰'
    };
    var amber = renderBox({ enabled: true, synced: false, queue: 1 }, migErr, [{ k: 'ptf_crm_opex', since: 1, ageSec: 600 }]);
    T('UI: جعبهٔ کهربایی علتِ آخرین شکست را نشان می‌دهد', amber.indexOf('آخرین تلاشِ انتقال ناتمام ماند') > -1 && amber.indexOf('تعارض داده با نسخهٔ سرور') > -1);
    T('UI: نام کلیدها بدون پیشوند و بدون نویز فنی رندر می‌شود', amber.indexOf('opex') > -1 && amber.indexOf('personal_cheques') > -1 && amber.indexOf('ptf_crm_') === -1 && amber.indexOf('round 3') === -1, amber.slice(-380));
    T('UI: دکمهٔ «تکمیل انتقال یک‌باره» در حالت کهربایی باقی است', amber.indexOf('ptfBConfirmFlush()') > -1 && amber.indexOf('تکمیل انتقال یک‌باره') > -1);
    T('UI: کلیدهای در انتظار ارسال با سن نشان داده می‌شوند', amber.indexOf('در انتظار ارسال به سرور') > -1 && amber.indexOf('۱۰ دقیقه') === -1 && amber.indexOf('دقیقه') > -1);
    var green = renderBox({ enabled: true, synced: true, queue: 0 }, migErr, []);
    T('UI: جعبهٔ سبز خطای مهاجرت را نشان نمی‌دهد', green.indexOf('آخرین تلاشِ انتقال ناتمام ماند') === -1 && green.indexOf('پاک‌سازی کش محلی') > -1);
    var amberNoErr = renderBox({ enabled: false, synced: false, queue: 0 }, null, []);
    T('UI: بدون خطای ثبت‌شده، بخشِ علت رندر نمی‌شود', amberNoErr.indexOf('آخرین تلاشِ انتقال ناتمام ماند') === -1 && amberNoErr.indexOf('انتقال یک‌بارهٔ داده‌های این دستگاه') > -1);
    var pushErr = renderBox({ enabled: true, synced: false, queue: 1 }, { scope: 'push', status: 'error', reason: 'network' }, []);
    T('UI: خطای غیرمهاجرتی (push) در جعبهٔ دستگاه نشان داده نمی‌شود', pushErr.indexOf('آخرین تلاشِ انتقال ناتمام ماند') === -1);
  })();

  /* ==================== محافظت از گاردهای موجود ==================== */
  console.log('\n── سازگاری: گاردهای ایمنی موجود دست‌نخورده ──');
  T('سازگاری: بوتِ خودکار destructive نیست', csSrc.indexOf("if (hasLocalBusinessPayload() || Object.keys(queueRead()).length) return { ok: false, reason: 'existing_local_data' };") > -1);
  T('سازگاری: مسیر خالی همچنان فاز B را فعال می‌کند', csSrc.indexOf('مسیر خالی هم (دستگاه بدون دادهٔ محلی) فاز B را فعال می‌کند') > -1);
  T('سازگاری: flushRequired هر دو نشانگر را می‌خواهد', csSrc.indexOf("return localStorage.getItem(flushKey()) !== '1' || localStorage.getItem(syncedKey()) !== '1';") > -1);
  T('سازگاری: صفِ آفلاین روی IDB پایدار است', csSrc.indexOf('OFFLINE-OUTBOX-IDB') > -1);
  T('سازگاری: merge محافظت‌شدهٔ سرور (recurring-owned) دست‌نخورده', apiSrc.indexOf('function sync_merge_protected_finance_snapshot') > -1);
  T('سازگاری: رهایش امن فقط برای whitelist لاگ/اعلان', syncSrc.indexOf("window.ptfSyncDropDirtyKey = function (k)") > -1 && syncSrc.indexOf("['ptf_crm_audit', 'ptf_crm_notifs', 'ptf_crm_avatars']") > -1);

  console.log('\n— tester588 (v34.37.5: همگراییِ انتقال یک‌باره — MIGRATION-CONVERGENCE) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  process.exit(f ? 1 : 0);
})().catch(function (e) {
  console.error('\nERROR tester588: ' + (e && e.stack || e));
  process.exit(1);
});

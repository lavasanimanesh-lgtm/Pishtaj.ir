#!/usr/bin/env node
'use strict';
/* tester545 — v34.17.0 (R5/T4-3b — AVATARS-TO-S3): عکس پروفایل به فضای ابری
   قرارداد: تصویر کامل آواتار (۱۲۸px) با الگوی چک‌پرینت v34.8.28 به آروان S3 (پوشهٔ avatars)
   می‌رود؛ در نقشهٔ سینک‌شوندهٔ ptf_crm_avatars فقط کلید ابری + پیش‌نمایش ریز ۶۴px (~۳KB)
   می‌ماند — سهم LS و پهنای باند سینک per کاربر ~۲۰KB → ~۳KB می‌شود. سه شکل مقدار
   پشتیبانی می‌شود: legacy رشته | {v,ts} | جدید {k,t,ts}؛ حذف همچنان tombstone {v:null,ts}
   (merge سینک per-user با ts برنده می‌ماند). fallback بدون ابر = dataURL کامل (رفتار قبل).
   مهاجرت نرم مقادیر سنگین قدیمی با گارد ۶ساعته؛ ارتقای نرم رندر به کیفیت کامل با
   presign (کش ۴۵دقیقه‌ای).
   پوشش: قرارداد منبع (theme.js/sync.js/storage.php/key-registry/sw.js) + رفتاری (vm). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var th = read('crm/theme.js');
var sy = read('crm/sync.js');
var sto = read('api/storage.php');
var kr = read('crm/key-registry.js');
var sw = read('crm/sw.js');

/* ═══ ۱) قرارداد منبع — theme.js ═══ */
T('آپلود آواتار به پوشهٔ avatars (الگوی چک‌پرینت)', /uploadFile\(blob, 'avatars', function \(up\)/.test(th));
T('فرمت جدید {k, t, ts} در نقشه نوشته می‌شود', /persist\(\{ k: up\.key, t: tiny, ts: new Date\(\)\.toISOString\(\) \}, true\)/.test(th));
T('fallback بدون ابر = dataURL کامل (رفتار قبل)', /else persist\(\{ v: data, ts: new Date\(\)\.toISOString\(\) \}, false\);/.test(th) && /if \(blob && tiny && typeof uploadFile === 'function'\)/.test(th));
T('avatarVal سه شکل را می‌فهمد (رشته | {v} | {k,t})', /if \(e\.t && e\.k\) return e\.t;/.test(th) && /if \(typeof e === 'string'\) return e \|\| null;/.test(th) && /return e\.v \|\| null;/.test(th));
T('حذف همچنان tombstone نسخه‌دار است', /all\[curSession\(\)\.user\] = \{ v: null, ts: new Date\(\)\.toISOString\(\) \};/.test(th));
T('پیش‌نمایش ریز = ۶۴px/jpeg 0.72', /var S = 64;/.test(th) && /cv\.toDataURL\('image\/jpeg', 0\.72\)/.test(th));
T('ptfAvatarUrl: presign_get با کش ۴۵دقیقه‌ای', /action=presign_get/.test(th) && /45 \* 60000/.test(th));
T('رندر: ریز فوری + ارتقای نرم به کیفیت کامل', /window\.ptfAvatarUrl\(s\.user, function \(u\)/.test(th) && /im\.src = u;/.test(th));
T('مهاجرت نرم مقادیر >۴KB با آستانه', /e\.v\.length > 4096/.test(th) && /typeof e === 'string'\) return e\.length > 4096;/.test(th));
T('گارد مهاجرت ۶ساعته در ptfCache (بدون کلید LS جدید)', /ptfCacheRead\('ptf_avatars_cloud_mig'/.test(th) && /ptfCacheWrite\('ptf_avatars_cloud_mig', '1', 6 \* 3600\)/.test(th));
T('dataURL→Blob بدون fetch (تست‌پذیر/آفلاین)', /var bin = atob\(parts\[1\] \|\| ''\);/.test(th));
T('متن راهنمای جدید (ذخیره در فضای ابری)', /ذخیره در فضای ابری \(آروان\)/.test(th) && !/۱۲۸×۱۲۸ فشرده/.test(th));

/* ═══ ۲) قفل رگرسیون — سینک و سرور ═══ */
T('sync.js: merge آواتار همچنان per-user با ts برنده است', /key === 'ptf_crm_avatars'/.test(sy) && /function avTs\(e\) \{ return \(e && typeof e === 'object' && e\.ts\) \? String\(e\.ts\) : ''; \}/.test(sy) && /winner = \(avTs\(lv\) >= avTs\(rv\)\) \? lv : rv;/.test(sy));
T('sync.js: tombstone (v==null) در merge محترم است + هرس ۳۰روزه', /winner\.v == null\) \{[\s\S]{0,140}30 \* 864e5/.test(sy));
T('storage.php: پوشهٔ avatars از safe_folder می‌گذرد (A-Za-z0-9_-)', sto.indexOf("preg_replace('/[^A-Za-z0-9_-]/', '', $part)") > -1);
T('key-registry: MEDIA → s3-with-local-pointer', /MEDIA: \{ store: 's3-with-local-pointer'/.test(kr));
T('theme.js در sw.js precache است', /'\.\/theme\.js' \+ ASSET_QUERY/.test(sw));

/* ═══ ۳) رفتاری — vm ═══ */
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function mkStore() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[String(k)] = String(v); },
    removeItem: function (k) { delete m[String(k)]; },
    _m: m
  };
}
function extractAvatarBlock(src) {
  var a = src.indexOf('/* ============ US-179');
  var b = src.indexOf('window.ptfAvatarSection');
  if (a < 0 || b < 0) throw new Error('avatar block not found');
  return src.slice(a, b);
}
(async function () {
  try {
    var LS = mkStore();
    var uploads = [];
    var entitySaves = [];
    var audits = [];
    var presignCalls = [];
    var TINY = 'data:image/jpeg;base64,TINY64';
    class FakeImage {
      set src(v) { this._src = v; var self = this; setTimeout(function () { if (self.onload) self.onload(); }, 0); }
      get src() { return this._src; }
    }
    var navAv = { innerHTML: '', querySelector: function (s) { return s === 'img' ? (this._im || (this._im = { src: '' })) : null; } };
    var ctx = {
      console: console, atob: atob, Blob: Blob, Uint8Array: Uint8Array, Image: FakeImage,
      localStorage: LS, sessionStorage: mkStore(),
      document: {
        cookie: '',
        getElementById: function (id) { return id === 'navAv' ? navAv : null; },
        createElement: function (tag) {
          if (tag === 'canvas') return { width: 0, height: 0, getContext: function () { return { drawImage: function () {} }; }, toDataURL: function () { return TINY; } };
          return { style: {}, setAttribute: function () {}, appendChild: function () {} };
        }
      },
      curSession: function () { return { user: 'u1', name: 'کاربر یک' }; },
      escP: function (x) { return String(x == null ? '' : x); },
      getData: function (k) { try { return JSON.parse(LS.getItem(k) || '{}'); } catch (e) { return {}; } },
      setData: function (k, v) { LS.setItem(k, JSON.stringify(v)); },
      ptfEntitySaveCollection: function (k, v) { entitySaves.push({ k: k, v: v }); LS.setItem(k, JSON.stringify(v)); },
      uploadFile: function (blob, folder, cb) {
        uploads.push({ folder: folder, size: blob.size });
        setTimeout(function () { cb({ ok: true, key: 'avatars/2026-08/' + uploads.length + '-avatar.jpg' }); }, 0);
      },
      fetch: function (url) {
        presignCalls.push(String(url));
        return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, url: 'https://s3.example/presigned-' + presignCalls.length }); } });
      },
      audit: function (m, a) { audits.push(a); },
      ptfToast: function () {}, alert: function () {},
      setTimeout: setTimeout, clearTimeout: clearTimeout
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(extractAvatarBlock(th), ctx, { filename: 'theme-avatars.js' });

    /* ۱ — سه شکل avatarVal */
    LS.setItem('ptf_crm_avatars', JSON.stringify({
      legacyStr: 'data:image/jpeg;base64,OLD',
      ver: { v: 'data:image/jpeg;base64,VER', ts: '2026-01-01T00:00:00Z' },
      cloud: { k: 'avatars/x.jpg', t: TINY, ts: '2026-02-01T00:00:00Z' },
      gone: { v: null, ts: '2026-03-01T00:00:00Z' }
    }));
    T('vm: رشتهٔ legacy برگردانده می‌شود', ctx.ptfAvatarOf('legacyStr') === 'data:image/jpeg;base64,OLD');
    T('vm: {v,ts} برگردانده می‌شود', ctx.ptfAvatarOf('ver') === 'data:image/jpeg;base64,VER');
    T('vm: {k,t} → پیش‌نمایش ریز', ctx.ptfAvatarOf('cloud') === TINY);
    T('vm: tombstone → null (حرف اول)', ctx.ptfAvatarOf('gone') === null);

    /* ۲ — ptfAvatarUrl: presign + کش */
    var u1 = await new Promise(function (res) { ctx.ptfAvatarUrl('cloud', res); });
    T('vm: ptfAvatarUrl URL ابری می‌دهد', u1 === 'https://s3.example/presigned-1');
    var u2 = await new Promise(function (res) { ctx.ptfAvatarUrl('cloud', res); });
    T('vm: کش ۴۵دقیقه‌ای — fetch دوم زده نمی‌شود', u2 === u1 && presignCalls.length === 1);
    var uNo = await new Promise(function (res) { ctx.ptfAvatarUrl('legacyStr', res); });
    T('vm: بدون کلید ابری → null', uNo === null);

    /* ۳ — رندر: ریز فوری + ارتقای نرم */
    LS.setItem('ptf_crm_avatars', JSON.stringify({ u1: { k: 'avatars/x.jpg', t: TINY, ts: '2026-02-01T00:00:00Z' } }));
    ctx.ptfApplyAvatar();
    await wait(30);
    T('vm: رندر اولیه از پیش‌نمایش ریز', navAv.innerHTML.indexOf(TINY) > -1);
    T('vm: ارتقای نرم به URL ابری انجام شد', navAv._im && navAv._im.src.indexOf('https://s3.example/presigned-') === 0);

    /* ۴ — حذف: tombstone */
    ctx.ptfAvatarRemove();
    var after = JSON.parse(LS.getItem('ptf_crm_avatars'));
    T('vm: حذف = tombstone {v:null,ts}', after.u1 && after.u1.v === null && !!after.u1.ts);

    /* ۵ — مهاجرت سنگین → ابر */
    var heavy = 'data:image/jpeg;base64,' + new Array(5200).join('A');
    LS.setItem('ptf_crm_avatars', JSON.stringify({
      heavyStr: heavy,
      heavyObj: { v: heavy, ts: '2026-01-02T00:00:00Z' },
      lightObj: { v: 'data:image/jpeg;base64,SMALL', ts: '2026-01-03T00:00:00Z' }
    }));
    var mig = await new Promise(function (res) { ctx.ptfAvatarsMigrateCloud(res); });
    var migrated = JSON.parse(LS.getItem('ptf_crm_avatars'));
    T('vm: دو مقدار سنگین به ابر رفتند', mig.moved === 2 && uploads.length === 2 && uploads.every(function (u) { return u.folder === 'avatars'; }));
    T('vm: مقدار مهاجرت‌یافته {k,t} با ts حفظ‌شده', migrated.heavyObj && migrated.heavyObj.k && migrated.heavyObj.k.indexOf('avatars/') === 0 && migrated.heavyObj.t === TINY && migrated.heavyObj.ts === '2026-01-02T00:00:00Z');
    T('vm: رشتهٔ legacy هم مهاجرت کرد', migrated.heavyStr && migrated.heavyStr.k && migrated.heavyStr.t === TINY);
    T('vm: مقدار سبک دست‌نخورده ماند', migrated.lightObj && migrated.lightObj.v === 'data:image/jpeg;base64,SMALL' && !migrated.lightObj.k);
    T('vm: ذخیره از مسیر entity (سینک سبک) انجام شد', entitySaves.length >= 2);
    T('vm: خلاصهٔ مهاجرت در audit ثبت شد', audits.some(function (a) { return String(a).indexOf('مهاجرت 2 عکس') > -1; }));

    /* ۶ — مهاجرت بدون مقدار سنگین: no-op */
    var upBefore = uploads.length;
    var mig2 = await new Promise(function (res) { ctx.ptfAvatarsMigrateCloud(res); });
    T('vm: نقشهٔ سبک → مهاجرت no-op', mig2.moved === 0 && uploads.length === upBefore);
  } catch (e) {
    T('زنجیرهٔ رفتاری vm بدون خطا', false, String(e && e.stack || e));
  }
  finish();
})().catch(function (e) { T('زنجیرهٔ بیرونی', false, String(e && e.stack || e)); finish(); });

function finish() {
  console.log('\n— tester545 (v34.17.0: R5/T4-3b — عکس پروفایل به فضای ابری؛ نقشهٔ سبک {k,t,ts}) —');
  console.log('PASS: ' + p + ' | FAIL: ' + f);
  if (f > 0) process.exit(1);
}

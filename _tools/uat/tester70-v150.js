/* tester70 — v15.0 (US-384: ریشه‌کنی Lost Update سینک + سپر بک‌آپ — کیس استادی کارفرما) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var gl = fs.readFileSync(path.join(BASE, 'golive.js'), 'utf-8');
var php = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

/* ============ ریشه ۱: Lost Update (کیس استادی: رفرش کاربر دوم پیش‌نویس کاربر اول را پاک کرد) ============ */
SECTION('سرور: کنترل همزمانی per-key (base rev)');
T('کلاینت base هر کلید را می‌فرستد و سرور می‌خواند', php.indexOf("$base = (isset($j['base']) && is_array($j['base'])) ? $j['base'] : null;") > -1);
T('نوشتن روی نسخه جدیدتر رد می‌شود (Lost Update ناممکن)', php.indexOf('(int)$base[$k] < $curRev') > -1 && php.indexOf('$conflicts[] = $k;') > -1);
T('نسخه فعلی سرور در پاسخ تعارض برمی‌گردد (برای ادغام)', php.indexOf('$conflictData[$k] = file_get_contents($cf);') > -1);
T('krevs (نسخه per-key) در پاسخ push', php.indexOf("'krevs' => $krevs") > -1);
T('سازگاری عقب‌رو: کلاینت قدیمی بدون base مثل قبل پذیرفته', php.indexOf('$base !== null && array_key_exists($k, $base)') > -1);
T('فلگ restore سپر داده‌صفر را برای بازگردانی ادمین کنار می‌زند', php.indexOf("$restore = !empty($j['restore']);") > -1 && php.indexOf('if (!$allow_wipe && !$restore) {') > -1);
T('مسیر Go-Live (allow_wipe) از چک تعارض معاف', php.indexOf('!$restore && !$allow_wipe && $base !== null') > -1);

SECTION('کلاینت: گیت بوت + مبنای نسخه + ادغام تعارض');
T('push تا پایان سینک اولیه ممنوع (ریشه دقیق کیس استادی)', sy.indexOf('bootstrapped') > -1 && sy.indexOf('if (!state.bootstrapped) { schedulePush(); return; }') > -1);
T('initialSync: اول pull کامل بعد اجازه push', sy.indexOf('state.initialReconcile = true;') > -1 && sy.indexOf('state.bootstrapped = true; window._ptfSyncBootstrapped = true;') > -1);
T('سرور خالی (seed) و حالت به‌روز → bootstrapped فوری', (sy.match(/state\.bootstrapped = true/g) || []).length >= 4);
T('آفلاین/خطا → قفل نمی‌ماند (کار محلی آزاد)', /\.catch\(function \(\) \{ state\.bootstrapped = true;[^\n]*setSyncBadge\('offline'\);/.test(sy)); /* v16.7: فلگ عمومی BUG-018 به همین خط اضافه شد — چک معادل */
T('krevs per-key در push ارسال می‌شود', sy.indexOf("body: JSON.stringify({ by: curSession().name, data: data, base: base })") > -1);
/* v33.20.0 (آینهٔ خالدار): مبنای merge تعارضی از rd(k) می‌آید (حافظه/IDB → fallback localStorage) — معنای چک ثابت: مقدار فعلی این دستگاه با نسخه سرور ادغام می‌شود */
T('پاسخ تعارض → ptfSmartMerge + ارسال مجدد (رکورد هیچ‌کس گم نمی‌شود)', sy.indexOf('d.conflicts || []') > -1 && /window\.ptfSmartMerge\(k, (localStorage\.getItem\(k\)|rd\(k\)), srvStr\)/.test(sy) && sy.indexOf("state.dirty[k] = true; /* نتیجه ادغام دوباره push می‌شود") > -1);
T('کلیدهای موفق پاک، کلیدهای متعارض dirty می‌مانند', sy.indexOf('if (confl.indexOf(k) < 0) delete state.dirty[k];') > -1);
T('krevs بعد از pull از meta سرور به‌روز می‌شود', sy.indexOf("mm[k].rev != null) km2[k] = +mm[k].rev || 0;") > -1);
T('beacon خروج هم با base (بازنویسی هنگام بستن تب ناممکن)', sy.indexOf('navigator.sendBeacon') > -1 && sy.indexOf('data: data, base: bb') > -1);
T('audit تعارض ثبت می‌شود', sy.indexOf('تعارض همزمانی سینک') > -1);

SECTION('رفتار اجرایی: شبیه‌سازی دقیق کیس استادی (دو دستگاه + سرور)');
/* شبیه‌ساز سرور data_push با منطق جدید per-key rev */
function makeServer() {
  var files = {}, meta = { _global: { rev: 0 } };
  return {
    push: function (payload) {
      var conflicts = [], serverData = {}, krevs = {}, saved = 0;
      var base = payload.base || null;
      Object.keys(payload.data).forEach(function (k) {
        var curRev = (meta[k] || {}).rev || 0;
        if (!payload.restore && !payload.allow_wipe && base !== null && (k in base) && base[k] < curRev) {
          conflicts.push(k); serverData[k] = files[k]; krevs[k] = curRev; return;
        }
        if (!payload.allow_wipe && !payload.restore) {
          var arr = JSON.parse(payload.data[k]);
          if (Array.isArray(arr) && arr.length === 0 && files[k] && JSON.parse(files[k]).length > 0) return; /* rejected */
        }
        files[k] = payload.data[k];
        meta[k] = { rev: curRev + 1 };
        krevs[k] = curRev + 1;
        saved++;
      });
      meta._global.rev++;
      return { ok: true, saved: saved, rev: meta._global.rev, conflicts: conflicts, serverData: serverData, krevs: krevs };
    },
    pull: function () { return { data: files, meta: meta, rev: meta._global.rev }; },
    filesRef: files
  };
}
var loadFnsCode = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var mMerge = loadFnsCode.match(/window\.ptfSmartMerge = function[\s\S]*?\n  \};/);
T('ptfSmartMerge استخراج شد', !!mMerge);
if (mMerge) {
  eval(mMerge[0]);
  var srv = makeServer();
  /* گام ۰: هر دو دستگاه سینک‌اند — ۲ پیش‌نویس نامه روی سرور */
  var seed = JSON.stringify([{ cd: 'LET-1', subject: 'الف', ts: '2026-07-08T08:00' }]);
  srv.push({ data: { ptf_crm_letters: seed }, base: { ptf_crm_letters: 0 } });
  /* گام ۱: کاربر A (شما) از دستیار پیش‌نویس جدید ثبت می‌کند و push می‌کند (base=1) */
  var afterA = JSON.stringify([
    { cd: 'LET-1', subject: 'الف', ts: '2026-07-08T08:00' },
    { cd: 'LET-2', subject: 'پیش‌نویس دستیار من', ts: '2026-07-08T09:00' }
  ]);
  var rA = srv.push({ data: { ptf_crm_letters: afterA }, base: { ptf_crm_letters: 1 } });
  T('گام۱: push کاربر A پذیرفته شد (rev کلید=2)', rA.conflicts.length === 0 && rA.krevs.ptf_crm_letters === 2);
  /* گام ۲: کاربر B رفرش می‌کند — localStorage کهنه (بدون LET-2) دارد و
     در نسخه معیوب قبلی، حین رندر setData می‌زد و همان لیست کهنه را با موفقیت push می‌کرد.
     حالا با base کهنه (=1) push می‌کند → سرور باید رد کند. */
  var staleB = seed; /* داده کهنه دستگاه B */
  var rB = srv.push({ data: { ptf_crm_letters: staleB }, base: { ptf_crm_letters: 1 } });
  T('گام۲ (کیس استادی): push کهنه کاربر B رد شد — پیش‌نویس A روی سرور ماند', rB.conflicts.indexOf('ptf_crm_letters') > -1 && JSON.parse(srv.filesRef.ptf_crm_letters).length === 2);
  /* گام ۳: کلاینت B طبق منطق جدید ادغام می‌کند و با base جدید می‌فرستد */
  var mergedB = window.ptfSmartMerge('ptf_crm_letters', staleB, rB.serverData.ptf_crm_letters);
  T('گام۳: ادغام هوشمند LET-2 را حفظ کرد', JSON.parse(mergedB).some(function (x) { return x.cd === 'LET-2'; }));
  var rB2 = srv.push({ data: { ptf_crm_letters: mergedB }, base: { ptf_crm_letters: rB.krevs.ptf_crm_letters } });
  T('گام۴: push ادغام‌شده پذیرفته شد — هر دو رکورد سالم', rB2.conflicts.length === 0 && JSON.parse(srv.filesRef.ptf_crm_letters).length === 2);
  /* سناریوی مکمل: نوشتن همزمان دو دستگاه روی یک کلید — دومی نباید اولی را له کند */
  var c1 = srv.push({ data: { ptf_crm_customers: JSON.stringify([{ cd: 'C-1' }]) }, base: { ptf_crm_customers: 0 } });
  var cA = srv.push({ data: { ptf_crm_customers: JSON.stringify([{ cd: 'C-1' }, { cd: 'C-2' }]) }, base: { ptf_crm_customers: 1 } });
  var cB = srv.push({ data: { ptf_crm_customers: JSON.stringify([{ cd: 'C-1' }, { cd: 'C-3' }]) }, base: { ptf_crm_customers: 1 } });
  T('همزمانی مشتریان: نویسنده دوم تعارض گرفت (C-2 محفوظ)', cB.conflicts.length === 1 && JSON.parse(srv.filesRef.ptf_crm_customers).some(function (x) { return x.cd === 'C-2'; }));
  var mergedC = window.ptfSmartMerge('ptf_crm_customers', JSON.stringify([{ cd: 'C-1' }, { cd: 'C-3' }]), cB.serverData.ptf_crm_customers);
  var cB2 = srv.push({ data: { ptf_crm_customers: mergedC }, base: { ptf_crm_customers: cB.krevs.ptf_crm_customers } });
  T('پس از ادغام: هر سه مشتری روی سرور', cB2.conflicts.length === 0 && JSON.parse(srv.filesRef.ptf_crm_customers).length === 3);
}

/* ============ ریشه ۲: مسموم شدن بک‌آپ چرخشی («بک‌آپ قبلی هم خراب بود») ============ */
SECTION('سرور: سپر بک‌آپ — قرنطینه نسخه مشکوک');
T('مقایسه counts کلیدهای حیاتی با hourly-latest موجود', php.indexOf("$allow_shrink = !empty($j['allow_shrink']);") > -1 && php.indexOf('$pv >= 4 && $nv < $pv / 2') > -1);
T('نسخه مشکوک قرنطینه می‌شود نه جایگزین (suspect-*)', php.indexOf("'/suspect-' . date('Y-m-d-His') . $ext") > -1 && php.indexOf("'mode' => 'quarantined'") > -1);
T('بک‌آپ‌های چرخشی سالم دست نمی‌خورند (break قبل از hourly)', php.indexOf("echo json_encode(['ok' => true, 'mode' => 'quarantined'") > -1);
T('حداکثر ۳ فایل قرنطینه (هرس)', php.indexOf("glob($bdir . '/suspect-*.json')") > -1);
T('get_backup: فایل suspect برای بررسی ادمین قابل دریافت', php.indexOf('suspect-\\d{4}-\\d{2}-\\d{2}-\\d{6}') > -1);
T('gz بک‌آپ موجود برای مقایسه شفاف باز می‌شود', php.indexOf('@gzdecode(@file_get_contents($exF))') > -1);

/* ============ ریشه ۳: بازگردانی که «اثر نکرد» ============ */
SECTION('کلاینت: بازگردانی = محلی + سرور سینک (ریشه «مشتریان دوباره برنگشتند»)');
T('doRestore داده بازگردانده را با فلگ restore به سرور سینک push می‌کند', bk.indexOf("restore: true, data: syncData") > -1 && bk.indexOf("(RESTORE)") > -1);
T('rev و krevs بعد از بازگردانی نو می‌شوند', bk.indexOf("localStorage.setItem('ptf_sync_rev', String(d.rev))") > -1 && bk.indexOf("localStorage.setItem('ptf_sync_krevs', JSON.stringify(d.krevs))") > -1);
T('baseline سپر داده‌صفر نو می‌شود', bk.indexOf("localStorage.removeItem('ptf_guard_counts'); /* baseline نو از داده سالم */") > -1);
T('خطای سرور → پیام شفاف به ادمین (بازگردانی محلی معتبر می‌ماند)', bk.indexOf('سرور سینک در دسترس نبود') > -1);
T('users و صف storage به سینک نمی‌روند (خارج از SYNC_KEYS)', bk.indexOf("k !== 'ptf_crm_users' && k !== 'ptf_storage_queue'") > -1);
T('golive: krevs هم ریست می‌شود', gl.indexOf("localStorage.removeItem('ptf_sync_krevs')") > -1);

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust فایل‌های اسپرینت (>=15.0)', ['sync.js', 'backup.js', 'golive.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] >= 15);
}));

DONE('tester70-v150');

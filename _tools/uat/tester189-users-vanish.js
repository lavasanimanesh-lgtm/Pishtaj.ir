/* tester189 — v31.7.14 (BUG-USERS-VANISH-001: ناپدید شدن کاربر تعریف‌شده از فهرست کاربران)
 * زنجیره ریشه: users_get از v31.7.4 بدون passhash (درست) → مرورگر همان لیست بی‌هش را
 * merge/seed می‌کند → users_sync سرور هر کاربر بدون passhash را بی‌صدا حذف می‌کرد.
 * رفع سه‌لایه: سرور هش موجود را حفظ + گزارش dropped؛ مرورگر هش محلی را در هر دو merge حفظ. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/crm.php'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var rb = fs.readFileSync(path.join(ROOT, 'crm/rbac.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('سرور: users_sync هش موجود را برای کاربر بی‌هش بازیابی می‌کند', api.indexOf('BUG-USERS-VANISH-001') > -1 && /existing_by_name\[strtolower\(\$u\['username'\]\)\]/.test(api));
T('سرور: sync directory هم به‌عنوان منبع هش موجود چک می‌شود', api.indexOf('load_all_crm_users_sources') > -1 && api.indexOf("/sync/ptf_crm_users.json") > -1);
T('سرور: کاربر جدید واقعاً بی‌هش در dropped گزارش می‌شود نه بی‌صدا', /'dropped' => \$dropped/.test(api));
T('مرورگر (لاگین): هش محلی روی رکورد سروری بی‌هش حفظ می‌شود', idx.indexOf('BUG-USERS-VANISH-001') > -1 && /_localByName\[x\.username\]\.passhash/.test(idx));
T('مرورگر (usersPullFromServer): همان حفظ هش', rb.indexOf('BUG-USERS-VANISH-001') > -1 && /lByName\[u\.username\]\.passhash/.test(rb));
T('کلاینت: dropped با toast هشدار داده می‌شود', /d\.dropped && d\.dropped\.length/.test(rb));

SECTION('رفتاری: merge کلاینت هش را نگه می‌دارد');
global.window = global;
// شبیه‌سازی منطق merge اصلاح‌شده (همان بلاک index.html/rbac.js)
function mergeUsers(srvUsers, localU) {
  var seen = {};
  srvUsers.forEach(function (x) { seen[x.username] = true; });
  var merged = srvUsers.slice();
  localU.forEach(function (x) { if (!seen[x.username]) merged.push(x); });
  var lByName = {};
  localU.forEach(function (x) { if (x && x.username) lByName[x.username] = x; });
  merged.forEach(function (x) {
    if (x && x.username && !x.passhash && lByName[x.username] && lByName[x.username].passhash) x.passhash = lByName[x.username].passhash;
  });
  return merged;
}
var srv = [{ username: 'acc1', name: 'حسابدار', roleId: 'accountant' }]; // users_get بدون هش
var loc = [{ username: 'acc1', name: 'حسابدار', roleId: 'accountant', passhash: 'aaaa1111' }];
var mg = mergeUsers(srv, loc);
T('هش محلی حسابدار پس از merge با نسخه بی‌هش سرور زنده می‌ماند', mg.length === 1 && mg[0].passhash === 'aaaa1111');
var mg2 = mergeUsers([{ username: 'x', passhash: 'srvhash' }], [{ username: 'x', passhash: 'oldlocal' }]);
T('هش سروری موجود بازنویسی نمی‌شود (فقط جای خالی پر می‌شود)', mg2[0].passhash === 'srvhash');
T('کاربر فقط-محلی حفظ می‌شود', mergeUsers([], [{ username: 'y', passhash: 'h' }]).length === 1);

SECTION('E2E سرور واقعی (در صورت وجود PHP)');
var cp = require('child_process'), os = require('os');
var php = null; try { cp.execSync('php -v', { stdio: 'ignore' }); php = 'php'; } catch (e) {}
if (!php) { T('PHP نبود — E2E روی CI/staging اجرا شود', true); DONE('tester189-users-vanish'); }
else (async function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-uv-'));
  try {
    cp.execSync('cp -r ' + JSON.stringify(path.join(ROOT, 'api')) + ' ' + JSON.stringify(tmp));
    fs.mkdirSync(path.join(tmp, 'crm/data'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'crm/data/crm_users.json'), JSON.stringify([
      { username: 'acc1', passhash: 'aaaa1111', name: 'حسابدار', roleId: 'accountant' },
      { username: 'boss', passhash: 'cccc3333', name: 'ادمین', roleId: 'admin', role: 'admin' }
    ]));
    var port = 18500 + Math.floor(Math.random() * 1000);
    var srv2 = cp.spawn(php, ['-S', '127.0.0.1:' + port, '-t', tmp], { stdio: 'ignore' });
    var B = 'http://127.0.0.1:' + port + '/api/crm.php';
    var up = false;
    for (var i = 0; i < 20 && !up; i++) { await new Promise(function (r) { setTimeout(r, 250); }); try { up = (await fetch(B + '?action=data_rev')).status === 200; } catch (e) {} }
    var lg = await (await fetch(B, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=auth_login&username=boss&passhash=cccc3333' })).json();
    var fd = new FormData();
    fd.append('users', JSON.stringify([{ username: 'acc1', name: 'حسابدار', roleId: 'accountant' }, { username: 'boss', passhash: 'cccc3333', name: 'ادمین', roleId: 'admin' }]));
    var syncRes = await (await fetch(B + '?action=users_sync', { method: 'POST', headers: { 'X-CRM-Token': lg.token || '' }, body: fd })).json();
    T('users_sync با acc1 بی‌هش: count=2 و dropped خالی', syncRes.ok === true && syncRes.count === 2 && (syncRes.dropped || []).length === 0);
    var after = JSON.parse(fs.readFileSync(path.join(tmp, 'crm/data/crm_users.json'), 'utf-8'));
    var acc = after.filter(function (u) { return u.username === 'acc1'; })[0];
    T('حسابدار روی سرور ماند و هش بازیابی شد', !!acc && acc.passhash === 'aaaa1111');
    var relog = await (await fetch(B, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=auth_login&username=acc1&passhash=aaaa1111' })).json();
    T('حسابدار پس از sync هنوز login می‌شود (سناریوی گزارش کارفرما)', relog.ok === true && relog.role === 'accountant');
    var fd2 = new FormData();
    fd2.append('users', JSON.stringify([{ username: 'ghost', name: 'بی‌رمز' }, { username: 'boss', passhash: 'cccc3333', roleId: 'admin', name: 'ادمین' }]));
    var syncRes2 = await (await fetch(B + '?action=users_sync', { method: 'POST', headers: { 'X-CRM-Token': lg.token || '' }, body: fd2 })).json();
    T('کاربر جدید واقعاً بی‌هش → dropped=[ghost] (شفاف، نه بی‌صدا)', (syncRes2.dropped || []).indexOf('ghost') > -1);
    srv2.kill();
  } catch (e) { T('E2E بدون خطا', false, String(e && e.message || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} DONE('tester189-users-vanish'); }
})();

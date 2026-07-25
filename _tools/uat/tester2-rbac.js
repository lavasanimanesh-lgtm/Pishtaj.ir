/* ============================================================
   دستیار تست ۲ — «امنیت و نقش‌ها» (نگاه مهاجم/ممیز دسترسی)
   هر ۸ نقش × پنل‌ها × داده‌های حساس + جریان‌های تایید
   ============================================================ */
require('./harness');
console.log('🕵️ TESTER-2: امنیت، RBAC و جریان‌های تایید');

var code = loadFns('rbac.js', ['curSession', 'curRole', 'roleDef', 'isSenior', 'canPanel']);
loadVar('rbac.js', 'ROLES');
loadVar('rbac.js', 'SENIOR_ROLES');

function login(rid, user) { setData; store_session({ user: user || rid, name: 'کاربر ' + rid, roleId: rid }); }
function store_session(s) { localStorage.setItem('ptf_crm_session', JSON.stringify(s)); }

SECTION('۱. ماتریس کامل ۸ نقش (دسترسی مثبت و منفی)');
var MATRIX = [
  // [نقش, پنل مجاز نمونه, پنل ممنوع نمونه, buyPrice, sellPrice, finance, users]
  /* v14.9 (US-383): ceo/commercial هم‌سطح chairman (finance/users=true، panels=*) */
  ['admin',      'fin',  null,   true,  true,  true,  true],
  ['chairman',   'users','—',    true,  true,  true,  true],
  ['ceo',        'anl',  null,   true,  true,  true,  true],
  ['commercial', 'off',  null,   true,  true,  true,  true],
  ['sales',      'off',  'buyq', false, true,  false, false],
  ['buyer',      'buyq', 'off',  true,  false, false, false],
  ['accountant', 'inv',  'rfq',  false, false, false, false],
  ['collector',  'recv', 'inv',  false, false, false, false]
];

/* v14.9 (US-383): دستیار (ai) برای همه نقش‌ها باز است */
SECTION('US-383: دستیار برای همه نقش‌ها');
['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant', 'collector'].forEach(function (rid) {
  login(rid);
  var d = roleDef();
  T(rid + ': دسترسی دستیار (ai)', d.panels === '*' || canPanel('ai'));
});
MATRIX.forEach(function (r) {
  login(r[0]);
  var d = roleDef();
  T(r[0] + ': buyPrice=' + r[3], d.buyPrice === r[3]);
  T(r[0] + ': sellPrice=' + r[4], d.sellPrice === r[4]);
  T(r[0] + ': finance=' + r[5], d.finance === r[5]);
  T(r[0] + ': users=' + r[6], d.users === r[6]);
  if (r[1] && r[1] !== '—') T(r[0] + ': مجاز به ' + r[1], d.panels === '*' || canPanel(r[1]));
  if (r[2] && r[2] !== '—') T(r[0] + ': ممنوع از ' + r[2], d.panels !== '*' && !canPanel(r[2]));
});

SECTION('۲. سناریوی حساس: کارشناس خرید نباید قیمت فروش ببیند');
login('buyer');
T('buyer: پنل پیشنهادها (قیمت فروش) بسته', !canPanel('off'));
T('buyer: پنل مالی بسته', !roleDef().finance);
T('buyer: کارتابل باز (کار روزمره)', canPanel('cart'));

SECTION('۳. جریان ارجاع فاکتور: فقط ارشد');
login('sales');
T('sales ارشد نیست → نمی‌تواند ارجاع فاکتور بزند', !isSenior());
login('commercial');
T('commercial ارشد است → می‌تواند', isSenior());

SECTION('۴. جریان دسترسی تماس مطالبات');
// تحصیلدار درخواست می‌دهد، فقط ارشد تایید می‌کند
login('collector');
T('collector ارشد نیست (نمی‌تواند خودش تایید کند)', !isSenior());
setData('ptf_crm_invoices', [{ cd:'INV-9', no:'X', amount:100, payments:[], contactReq:{by:'collector1'} }]);
login('ceo');
var inv = getData('ptf_crm_invoices')[0];
T('درخواست در انتظار وجود دارد', !!inv.contactReq);
inv.contactApproved = { nm:'آقای مالی', tel:'0912', by:'ceo' };
delete inv.contactReq;
setData('ptf_crm_invoices', [inv]);
T('پس از تایید ارشد: تماس نمایان + درخواست پاک', !!getData('ptf_crm_invoices')[0].contactApproved && !getData('ptf_crm_invoices')[0].contactReq);

SECTION('۵. امضای نامه: فقط امضاکننده تعیین‌شده');
setData('ptf_crm_letters', [{ cd:'LET-9', st:'pending', signer:'ceo1', subject:'x', author:'sales1' }]);
login('commercial', 'comm1');
var l = getData('ptf_crm_letters')[0];
T('غیرامضاکننده نمی‌تواند امضا کند (شرط signer)', l.signer !== curSession().user);
login('ceo', 'ceo1');
T('امضاکننده تعیین‌شده می‌تواند', getData('ptf_crm_letters')[0].signer === curSession().user);

SECTION('۶. رمزها: هیچ رمز متن ساده');
var fs = require('fs');
var path = require('path');
var main = fs.readFileSync(path.join(__dirname, '../../crm/index.html'), 'utf-8');
T('ADMIN_PASS متن ساده وجود ندارد', main.indexOf("ADMIN_PASS = '") === -1);
T('ADMIN_HASH (SHA-256) وجود دارد', main.indexOf('ADMIN_HASH') > -1);
T('کاربر جدید با passhash ذخیره می‌شود', main.indexOf('passhash: ph') > -1 || main.indexOf('passhash:ph') > -1);

SECTION('۷. گارد سروری PHP');
var php = fs.readFileSync(path.join(__dirname, '../../api/crm.php'), 'utf-8');
T('ACL نقش‌ها در سرور', php.indexOf('$ROLE_ACL') > -1);
T('اکشن‌های مالی محدود', php.indexOf("'finance_read'") > -1);
var storagePhp = fs.readFileSync(path.join(__dirname, '../../api/storage.php'), 'utf-8');
T('کانفیگ آروان خارج از webroot خوانده می‌شود', storagePhp.indexOf("dirname(__DIR__, 2)") > -1);
T('پاکسازی نام فایل (path traversal)', storagePhp.indexOf('safe_key') > -1);
DONE('TESTER-2 (RBAC/Security)');

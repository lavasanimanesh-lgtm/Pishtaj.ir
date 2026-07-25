/* tester186 — v31.7.11 (BUG-AVATAR-001: بازگشت عکس پروفایل حذف‌شده پس از رفرش)
 * ریشه: ptf_crm_avatars آبجکت map است؛ مسیر عمومی ptfSmartMerge برای غیرآرایه‌ها
 * server-wins بود و delete محلی بعد از merge با نسخه سرور گم می‌شد.
 * رفع: tombstone نسخه‌دار {v:null,ts} + merge per-user با timestamp. */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var th = fs.readFileSync(path.join(BASE, 'theme.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('حذف آواتار tombstone می‌گذارد نه delete', th.indexOf('BUG-AVATAR-001') > -1 && /ptfAvatarRemove[\s\S]{0,400}\{ v: null, ts:/.test(th) && !/ptfAvatarRemove[\s\S]{0,300}delete all\[/.test(th));
T('آپلود آواتار نسخه‌دار {v,ts} ذخیره می‌کند', /\{ v: data, ts: new Date\(\)\.toISOString\(\) \}/.test(th));
T('خواننده‌ها از avatarVal استفاده می‌کنند (legacy رشته‌ای هم پشتیبانی)', th.indexOf('function avatarVal') > -1 && (th.match(/avatarVal\(avatarsAll\(\)/g) || []).length >= 4);
T('merge اختصاصی ptf_crm_avatars در sync.js', sy.indexOf('BUG-AVATAR-001') > -1 && /key === 'ptf_crm_avatars'/.test(sy));
T('merge آواتار قبل از گارد آرایه‌ای داخل ptfSmartMerge قرار دارد (وگرنه هرگز اجرا نمی‌شود)', (function(){ var start=sy.indexOf('window.ptfSmartMerge = function'); var end=sy.indexOf("if (key === 'ptf_crm_rfqs'", start); var seg=sy.slice(start, end); var av=seg.indexOf("key === 'ptf_crm_avatars'"); var guard=seg.indexOf('if (!Array.isArray(loc) || !Array.isArray(rem)) return remoteStr'); return av > -1 && (guard === -1 || av < guard); })());

SECTION('رفتاری: merge واقعی آواتار');
global.window = global;
eval('var ptfMergeNoCollapse=function(){};' + sy.match(/window\.ptfSmartMerge = function[\s\S]*?\n  \};/)[0]);
function mg(l, r) { return JSON.parse(window.ptfSmartMerge('ptf_crm_avatars', JSON.stringify(l), JSON.stringify(r))); }

var out = mg({ u1: { v: null, ts: '2026-07-19T10:00:00Z' } }, { u1: { v: 'OLD', ts: '2026-07-01T10:00:00Z' } });
T('سناریوی گزارش‌شده: حذف محلی جدیدتر بر عکس کهنه سرور برنده — عکس برنمی‌گردد', out.u1 && out.u1.v === null);
out = mg({ u1: { v: null, ts: '2026-07-01T10:00:00Z' } }, { u1: { v: 'NEW', ts: '2026-07-19T10:00:00Z' } });
T('عکس جدیدترِ دستگاه دیگر بر tombstone قدیمی برنده', out.u1 && out.u1.v === 'NEW');
out = mg({ u1: { v: 'MINE', ts: '2026-07-19T10:00:00Z' } }, { u1: 'legacy', u2: 'other' });
T('نسخه‌دار بر legacy برنده و آواتار سایر کاربران حفظ می‌شود', out.u1 && out.u1.v === 'MINE' && out.u2 === 'other');
out = mg({ u1: { v: null, ts: '2026-05-01T10:00:00Z' } }, {});
T('tombstone کهنه‌تر از ۳۰ روز هرس می‌شود', !('u1' in out));
out = mg({}, { u3: 'srvpic' });
T('ورودی فقط-سروری دست‌نخورده می‌ماند', out.u3 === 'srvpic');

SECTION('رفتاری: خواندن مقدار (avatarVal)');
eval(th.match(/function avatarVal\(e\)[\s\S]*?\n/)[0]);
T('legacy رشته‌ای → همان رشته', avatarVal('data:x') === 'data:x');
T('نسخه‌دار → v', avatarVal({ v: 'pic', ts: 't' }) === 'pic');
T('tombstone → null (آواتار نمایش داده نمی‌شود)', avatarVal({ v: null, ts: 't' }) === null && avatarVal(undefined) === null);

SECTION('رگرسیون');
T('ptf_crm_avatars همچنان در SYNC_KEYS و همه نقش‌ها', /'ptf_crm_avatars'/.test(sy.match(/var SYNC_KEYS = \[[\s\S]*?\];/)[0]));
T('merge اعلان‌ها (v31.7.10) دست‌نخورده', sy.indexOf('BUG-NTF-002') > -1);

DONE('tester186-avatar-delete-sync');

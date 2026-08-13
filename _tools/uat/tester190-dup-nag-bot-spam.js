/* tester190 — v31.7.15 (BUG-DUP-NAG-002 + BUG-BOT-SPAM-001)
 * گزارش کارفرما: هر رفرش موبایل → پیام کد تکراری + پیام همزمان بات تلگرام در گروه.
 * ریشه ۱: ack هشدار duplicate در localStorage تک‌دستگاهی بود (v31.7.10) — موبایل ack دسکتاپ را نمی‌دید.
 * ریشه ۲: هوک بات در messengers.js قبل از dedup چک می‌شد — حتی notify سرکوب‌شده هم به گروه می‌رفت.
 * رفع: ack سراسری در ptf_crm_settings (sync بین دستگاه‌ها) + پرچم _ptfNotifySuppressed برای بات. */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cg = fs.readFileSync(path.join(BASE, 'codegen.js'), 'utf-8');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var ms = fs.readFileSync(path.join(BASE, 'messengers.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('ack در ptf_crm_settings ذخیره می‌شود (sync بین دستگاه‌ها) با setData', cg.indexOf('BUG-DUP-NAG-002') > -1 && /st\.dupCodeAck=fp/.test(cg) && /setData\('ptf_crm_settings', st\)/.test(cg));
T('خواندن ack: settings مقدم، localStorage به‌عنوان سازگاری عقب‌رو', /function ptfDupAckGet/.test(cg) && /st\.dupCodeAck\|\|''/.test(cg) && /ptf_code_duplicate_ack/.test(cg));
T('auto-repair از ptfDupAckGet استفاده می‌کند نه localStorage مستقیم', /ack=ptfDupAckGet\(\)/.test(cg));
T('حل شدن duplicateها ack سراسری را پاک می‌کند', /ptfDupAckSet\(''\)/.test(cg));
T('دکمه «دیدم» ack سراسری می‌نویسد', /ptfDuplicateRepairAck[\s\S]{0,300}ptfDupAckSet\(ptfDupPlanFingerprint\(plan\)\)/.test(cg));
T('notify پرچم سرکوب ست می‌کند', rb.indexOf('BUG-BOT-SPAM-001') > -1 && /_ptfNotifySuppressed = true/.test(rb) && /_ptfNotifySuppressed = false/.test(rb));
T('هوک بات، notify سرکوب‌شده را نمی‌فرستد', ms.indexOf('BUG-BOT-SPAM-001') > -1 && /if \(window\._ptfNotifySuppressed\) return r;/.test(ms));
T('ptf_crm_settings در SYNC_KEYS است (پیش‌نیاز ack سراسری)', /var SYNC_KEYS = \[[\s\S]*?'ptf_crm_settings'/.test(sy));

SECTION('رفتاری: ack سراسری بین دستگاه‌ها');
global.window = global;
global.curRole = function () { return 'admin'; };
global.curSession = function () { return { user: 'u1', name: 'ادمین' }; };
global.roleDef = function () { return { lb: 'ادمین' }; };
global.ROLES = { admin: { lb: 'ادمین' } };
global.updateCartBadge = function () {};
global.faDateTime = function () { return '1405/04/28 12:00'; };
global.audit = function () {};
var toasts = [];
global.ptfToast = function (m) { toasts.push(m); };
// استخراج توابع
eval(cg.match(/function ptfDupPlanFingerprint[\s\S]*?\n\}/)[0]);
eval(cg.match(/function ptfDupAckGet\(\)\{[\s\S]*?\n\}/)[0]);
eval(cg.match(/function ptfDupAckSet\(fp\)\{[\s\S]*?\n\}/)[0]);
var plan = [{ key: 'ptf_crm_rfqs', code: 'RFQ-1001', reason: 'referenced-ambiguous' }];
var fp = ptfDupPlanFingerprint(plan);
// «دستگاه ۱»: ack ثبت می‌شود
ptfDupAckSet(fp);
var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
T('ack در settings نشست (کلید sync‌شونده)', st.dupCodeAck === fp);
// «دستگاه ۲»: فقط settings از sync رسیده — localStorage محلی ack ندارد
localStorage.removeItem('ptf_code_duplicate_ack');
T('دستگاه دوم ack را از settings می‌خواند (بدون localStorage محلی)', ptfDupAckGet() === fp);
// سازگاری عقب‌رو: فقط localStorage قدیمی
localStorage.removeItem('ptf_crm_settings');
localStorage.setItem('ptf_code_duplicate_ack', 'legacy-fp');
T('سازگاری عقب‌رو با ack قدیمی localStorage', ptfDupAckGet() === 'legacy-fp');
// پاک‌سازی سراسری
ptfDupAckSet('');
T('پاک‌سازی، هر دو محل را خالی می‌کند', ptfDupAckGet() === '' && !JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}').dupCodeAck);

SECTION('رفتاری: بات برای notify تکراری فرستاده نمی‌شود');
eval(rb.match(/function notify\(opt\) \{[\s\S]*?\n\}/)[0]);
eval(rb.match(/function myNotifs\(\) \{[\s\S]*?\n\}/)[0]);
eval(rb.match(/function ntfNeedsAction\([\s\S]*?\n\}/)[0]);
eval(rb.match(/var NTF_ACTION_KINDS = \[[^\]]*\];/)[0] + '; global.NTF_ACTION_KINDS = NTF_ACTION_KINDS;');
window.notify = notify;
var botSent = [];
global.ptfBotSend = function (t) { botSent.push(t); };
global.ptfBotSendPersonal = function () {};
localStorage.setItem('ptf_bot_enabled', '1');
setData('ptf_crm_notifs', []);
// شبیه‌سازی هوک messengers (همان بلاک اصلاح‌شده)
var hookSrc = ms.match(/var _n = window\.notify;[\s\S]*?return true;\n  \}/)[0].replace(/return true;\n  \}$/, '');
eval(hookSrc);
/* پس از هوک، مثل کد واقعی محصول از window.notify (wrapper) استفاده می‌شود */
window.notify({ toRoles: ['admin'], title: 'کد تکراری X', body: 'b', kind: 'system' });
T('اولین notify → بات یک‌بار می‌فرستد', botSent.length === 1);
window.notify({ toRoles: ['admin'], title: 'کد تکراری X', body: 'b', kind: 'system' });
window.notify({ toRoles: ['admin'], title: 'کد تکراری X', body: 'b', kind: 'system' });
T('رفرش‌های بعدی (dedup) → بات دیگر نمی‌فرستد (قبلاً هر بار می‌رفت)', botSent.length === 1);
T('کارتابل همچنان فقط ۱ رکورد با شمارنده دارد', getData('ptf_crm_notifs').length === 1 && getData('ptf_crm_notifs')[0].repeat === 3);
window.notify({ toRoles: ['admin'], title: 'رویداد جدید Y', kind: 'system' });
T('notify واقعاً جدید → بات می‌فرستد (سرکوب کور نیست)', botSent.length === 2);

DONE('tester190-dup-nag-bot-spam');

/* =====================================================================
   PTF CRM — Sprint 58
   US-122: نقش‌ها و سطوح دسترسی (RBAC)
   US-123: مرکز اعلانات و کارتابل
   ===================================================================== */

/* ============ تعریف نقش‌ها و ماتریس دسترسی ============ */
var ROLES = {
  /* v14.9 (US-383 — دستور کارفرما): ① دستیار (ai) برای همه نقش‌ها باز شد
     ② مدیرعامل و مدیر بازرگانی دسترسی کامل هم‌سطح رییس هیات مدیره گرفتند (panels:*، users، finance)
     Phase 2 / Step 4 (ر.ک: crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md):
     ledgerScope مشخص می‌کند این نقش کدام دفتر را می‌بیند:
       'all'      → هر دو دفتر رسمی و غیررسمی (نقش‌های ارشد؛ collector هم چون به
                    پنل recv دسترسی دارد و رفتار قبلی‌اش دیدن همه‌ی فاکتورها بود)
       'official' → فقط دفتر رسمی (حسابدار — دقیقاً همان رفتار قبلی، فقط اکنون صریح است)
       'none'     → این نقش اصلاً به پنل‌های دارای فاکتور (inv/recv/petty) دسترسی
                    ندارد (sales/buyer) — مقدار فقط برای مستندسازی صریح است، رفتار
                    واقعی هرگز از این طریق بررسی نمی‌شود چون پنل‌شان اصلاً باز نیست */
  admin:      { lb: 'ادمین (مدیر کل سیستم)',  users: true,  panels: '*',                                                              buyPrice: true,  sellPrice: true,  finance: true,  ledgerScope: 'all'      },
  chairman:   { lb: 'رییس هیات مدیره',         users: true,  panels: '*',                                                              buyPrice: true,  sellPrice: true,  finance: true,  ledgerScope: 'all'      },
  ceo:        { lb: 'مدیرعامل',                users: true,  panels: '*',                                                              buyPrice: true,  sellPrice: true,  finance: true,  ledgerScope: 'all'      },
  commercial: { lb: 'مدیر بازرگانی',           users: true,  panels: '*',                                                              buyPrice: true,  sellPrice: true,  finance: true,  ledgerScope: 'all'      },
  sales:      { lb: 'کارشناس فروش',            users: false, panels: ['dash','rfq','cust','leads','rem','prod','surplus','off','cart','inqs','deals','ai'],      buyPrice: false, sellPrice: true,  finance: false, ledgerScope: 'none'     },
  buyer:      { lb: 'کارشناس خرید',            users: false, panels: ['dash','sup','prod','surplus','rem','buyq','cart','ai'],                    buyPrice: true,  sellPrice: false, finance: false, ledgerScope: 'none'     },
  accountant: { lb: 'حسابدار',                 users: false, panels: ['inv','recv','petty','chqprint','ai'],                            buyPrice: false, sellPrice: false, finance: false, ledgerScope: 'official' },
  collector:  { lb: 'تحصیلدار',                users: false, panels: ['recv','cart','ai'],                                             buyPrice: false, sellPrice: false, finance: false, ledgerScope: 'all'      }
};
// نقش‌های ارشد (تایید/ارجاع/ثبت قیمت فروش)
var SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];

function curSession() {
  try { return JSON.parse(localStorage.getItem('ptf_crm_session')) || {}; } catch (e) { return {}; }
}
function curRole() {
  var s = curSession();
  if (s.user === 'admin') return 'admin';
  return s.roleId && ROLES[s.roleId] ? s.roleId : 'sales';
}
function roleDef() { return ROLES[curRole()] || ROLES.sales; }
function isSenior() { return SENIOR_ROLES.indexOf(curRole()) > -1; }
/* Phase 2 / Step 4: تابع عمومی جایگزین شرط‌های هاردکد پراکنده در
   renderInvoices/renderReceivables (rbac.js) و customer-finance.js.
   ledgerKind: 'official' | 'unofficial' — آیا نقش فعلی اجازه‌ی دیدن این دفتر را دارد؟
   رفتار قبلی (فقط accountant از unofficial محروم بود) کاملاً حفظ می‌شود؛
   نقش‌های 'none' هم به‌طور طبیعی هر دو نوع را نمی‌بینند چون پنل مالی/فاکتور ندارند. */
function ptfCanSeeLedger(ledgerKind) {
  var scope = (roleDef() || {}).ledgerScope || 'all';
  if (scope === 'all') return true;
  if (scope === 'none') return false;
  /* scope === 'official' */
  return ledgerKind !== 'unofficial';
}
function canPanel(id) {
  var r = roleDef();
  if (r.panels === '*') return true;
  return r.panels.indexOf(id) > -1;
}

/* ============ رد پا (Audit Trail — AC5) ============ */

window.ptfPruneSystemLogs = function () {
  try {
    var logs = getData('ptf_crm_audit');
    if (logs.length > 1000) setData('ptf_crm_audit', logs.slice(0, 1000));
    var q = getData('ptf_crm_sendqueue');
    if (q.length > 300) setData('ptf_crm_sendqueue', q.slice(0, 300));
    var nf = getData('ptf_crm_notifs');
    if (nf.length > 500) setData('ptf_crm_notifs', nf.slice(0, 500));
  } catch (ePrune) {}
};

/* v33.4.1 (بازنگری استاندارد اعلانات — دستور کارفرما): اعلانات «اطلاعی» (غیرمهم —
   ر.ک ntfIsImportant) با استانداردهای CRM معروف باید خودمحوشونده باشند: حتی اگر
   دیده/خوانده نشوند، بعد از یک بازه‌ی کوتاه کلاً حذف می‌شوند تا کارتابل/روزمن شلوغ نشود.
   اعلانات «مهم» (ارجاع، سررسید چک، یادآور واقعی — ر.ک ntfIsImportant) هرگز با گذر زمان
   خودکار حذف نمی‌شوند؛ فقط با «خواندم» یا با تکمیل رویداد پشتیبان (چک/یادآور) از دید
   کاربر مخفی می‌شوند (رفتار موجود renderCartable). این تابع صرفاً رکوردهای «اطلاعی»
   قدیمی‌تر از NTF_INFO_TTL_DAYS روز را از داده حذف می‌کند — بدون اثر روی اعلانات مهم. */
var NTF_INFO_TTL_DAYS = 2;
window.ptfPruneStaleNotifs = function () {
  try {
    var notifs = getData('ptf_crm_notifs');
    if (!notifs.length) return 0;
    var cutoff = Date.now() - NTF_INFO_TTL_DAYS * 86400000;
    var kept = notifs.filter(function (n) {
      if (!n) return false;
      if (typeof ntfIsImportant === 'function' && ntfIsImportant(n)) return true; /* مهم‌ها هرگز با گذر زمان حذف نمی‌شوند */
      if ((n.readBy || []).length > 0) return true; /* خوانده‌شده — از قبل در کارتابل/صندوق پیام پیش‌فرض مخفی است؛ نیازی به حذف اجباری نیست */
      var t = 0;
      try { t = n.iso ? new Date(n.iso).getTime() : 0; } catch (eT) { t = 0; }
      if (!t) return true; /* بدون timestamp قابل‌فهم — برای ایمنی نگه داشته می‌شود */
      return t >= cutoff;
    });
    if (kept.length !== notifs.length) setData('ptf_crm_notifs', kept);
    return notifs.length - kept.length;
  } catch (ePruneN) { return 0; }
};

function audit(module, action, ref) {
  if (Math.random() < 0.1) ptfPruneSystemLogs();
  var logs = getData('ptf_crm_audit');
  logs.unshift({ t: faDateTime(), user: curSession().name || '?', role: roleDef().lb, m: module, a: action, ref: ref || '' });
  if (logs.length > 1000) logs = logs.slice(0, 1000);
  setData('ptf_crm_audit', logs);
}

/* ============ US-123: اعلانات ============ */
// notify({toRoles:['accountant'], toUsers:[], title, body, kind, channels:['cart','sms','email'], link, refCd, tier})
function notify(opt) {
  window._ptfNotifySuppressed = false; /* v31.7.15 BUG-BOT-SPAM-001: مصرف‌کننده‌های پایین‌دستی (بات تلگرام) باید از dedup باخبر شوند */
  try { ptfPruneStaleNotifs(); } catch (ePr0) {} /* v33.4.1: قبل از افزودن رکورد جدید، اعلانات اطلاعیِ منقضی‌شده حذف شوند */
  var notifs = getData('ptf_crm_notifs');
  /* v31.7.10 BUG-NTF-001: ضدتکرار اعلان — اگر همین اعلان (عنوان+متن+گیرندگان) هنوز
     توسط هیچ‌کس خوانده نشده، رکورد جدید ساخته نمی‌شود؛ فقط شمارنده تکرار و زمان
     آخرین وقوع به‌روز می‌شود تا کارتابل از اعلان‌های یکسان انباشته نشود. */
  var dkey = opt.dkey || (String(opt.title || '') + '|' + String(opt.body || '') + '|' +
    (opt.toRoles || []).join(',') + '|' + (opt.toUsers || []).join(','));
  for (var di = 0; di < notifs.length; di++) {
    var dn = notifs[di];
    if (!dn || dn.done) continue;
    var dnk = dn.dkey || (String(dn.title || '') + '|' + String(dn.body || '') + '|' +
      (dn.toRoles || []).join(',') + '|' + (dn.toUsers || []).join(','));
    if (dnk === dkey && (dn.readBy || []).length === 0) {
      dn.repeat = (dn.repeat || 1) + 1;
      dn.lastT = faDateTime(); dn.lastISO = new Date().toISOString();
      /* v33.4.1: اگر dkey صریح داده شده (مثلاً یادآور روزانه چک با شمارش روز تغییرپذیر)،
         عنوان/متن/لینک/refCd کارت موجود هم به‌روز می‌شود تا کاربر آخرین وضعیت را ببیند
         نه یک کارت بایگانی‌شده با متن قدیمی؛ برای dkey خودکار (بر پایه‌ی عنوان) تغییری
         لازم نیست چون عنوان از قبل یکسان است. */
      if (opt.dkey) {
        dn.title = opt.title; dn.body = opt.body || ''; dn.link = opt.link || dn.link;
        if (opt.refCd) dn.refCd = opt.refCd;
      }
      setData('ptf_crm_notifs', notifs);
      updateCartBadge();
      window._ptfNotifySuppressed = true; /* v31.7.15: تکرار — کانال‌های خارجی نفرستند */
      return dn.cd;
    }
  }
  var rec = {
    cd: genCode('NTF'), t: faDateTime(), iso: new Date().toISOString(),
    from: curSession().name || 'سیستم', fromRole: roleDef().lb,
    toRoles: opt.toRoles || [], toUsers: opt.toUsers || [],
    title: opt.title, body: opt.body || '', kind: opt.kind || 'info',
    channels: opt.channels || ['cart'], link: opt.link || null,
    readBy: [], actionable: !!opt.actionable, done: false, dkey: dkey, repeat: 1,
    tier: opt.tier || null, /* v33.4.1: override صریح دسته‌بندی مهم/اطلاعی (ر.ک ntfIsImportant) */
    refCd: opt.refCd || null, /* v33.4.1: کد رکورد منبع (مثلاً چک/نامه) — با حل‌شدن آن رویداد، اعلان کاملاً حذف می‌شود (ر.ک ntfResolveByRef) */
    remCd: opt.remCd || null /* v33.4.1: کد یادآور منبع (سازگار با addMsg در bridge.js) — همان مکانیزم resolve */
  };
  notifs.unshift(rec);
  if (notifs.length > 1000) notifs = notifs.slice(0, 1000);
  setData('ptf_crm_notifs', notifs);
  // کانال‌های خارجی → صف ارسال (پیامک/ایمیل — نیازمند کلید API سمت سرور)
  var q = getData('ptf_crm_sendqueue');
  ['sms', 'email'].forEach(function (ch) {
    if (rec.channels.indexOf(ch) > -1) {
      q.unshift({ cd: genCode('SND'), ch: ch, ntf: rec.cd, title: rec.title, toRoles: rec.toRoles, toUsers: rec.toUsers, st: 'queued', t: rec.t });
    }
  });
  if (q.length > 300) q = q.slice(0, 300);
  setData('ptf_crm_sendqueue', q);
  audit('اعلانات', 'ارسال اعلان: ' + rec.title + ' → ' + (rec.toRoles.map(function(r){ return ROLES[r] ? ROLES[r].lb : r; }).join('، ') || rec.toUsers.join('، ')) + ' [' + rec.channels.join('+') + ']', rec.cd);
  updateCartBadge();
  return rec.cd;
}

function myNotifs() {
  var me = curSession();
  var myRole = curRole();
  return getData('ptf_crm_notifs').filter(function (n) {
    return (n.toRoles || []).indexOf(myRole) > -1 || (n.toUsers || []).indexOf(me.user) > -1 ||
           ((n.toRoles || []).length === 0 && (n.toUsers || []).length === 0);
  });
}

function updateCartBadge() {
  var me = curSession().user;
  var unread = myNotifs().filter(function (n) { return (n.readBy || []).indexOf(me) < 0; }).length;
  var b = document.getElementById('ctBadge');
  if (b) { b.textContent = unread; b.style.display = unread ? '' : 'none'; }
}

/* ---- کارتابل ---- */
function buildCartable() {
  return '<div class="ph"><h3>🗂 کارتابل من</h3>' +
    '<div class="sb2"><label style="font-size:12px;display:flex;align-items:center;gap:4px"><input type="checkbox" id="ctAll" onchange="renderCartable()"> نمایش خوانده‌شده‌ها</label>' +
    '<button class="bt bt-o" style="color:#0e7490;border-color:#bae6fd" onclick="ntfReadAll()">✓✓ خواندم همه</button>' +
    '<button class="bt bt-o" onclick="showNotifPrefs()">⚙️ ترجیحات اعلان</button></div></div>' +
    '<div id="ctWrap"></div>';
}

/* v31.7.10 BUG-NTF-003 / v33.4.1 (بازنگری استاندارد اعلانات — دستور کارفرما):
   تفکیک اعلان «مهم» (پایدار تا اقدام کاربر یا تکمیل رویداد پشتیبان — هرگز با گذر
   زمان محو نمی‌شود) از «اطلاعی» (خودمحوشونده — ر.ک ptfPruneStaleNotifs).
   مهم = ارجاعات به شخص معین، سررسید چک، یادآورهای دستی واقعی کاربر (remCd)،
   و رویدادهای مالی/سیستمی حیاتی. بقیه (هشدارهای خودکار تکرارشونده مثل انقضای
   پیش‌فاکتور/مهلت درخواست/تحویل تعهدی، وضعیت‌های عمومی و...) اطلاعی‌اند —
   این‌ها از قبل به‌صورت زنده در «☀️ روز من» (myday.js) هم دیده می‌شوند. */
var NTF_IMPORTANT_KINDS = ['system', 'warn', 'error', 'finance', 'cheque', 'inv_ref', 'contact_req', 'sign_req'];
function ntfIsImportant(n) {
  if (!n) return false;
  if (n.tier === 'important') return true;
  if (n.tier === 'info') return false;
  if (NTF_IMPORTANT_KINDS.indexOf(n.kind || '') > -1) return true;
  if (n.kind === 'referral') return true; /* ارجاع به شخص معین */
  if (n.kind === 'reminder' && n.remCd) return true; /* یادآور دستی واقعی کاربر (نه هشدار خودکار CO/RFQ/Deal) */
  return false;
}

function ntfCard(n, me) {
  var unread = (n.readBy || []).indexOf(me) < 0;
  var imp = ntfIsImportant(n);
  var rep = (n.repeat || 1) > 1 ? ' <span style="background:#fef3c7;color:#92400e;border-radius:10px;padding:1px 7px;font-size:11px">×' + n.repeat + ' تکرار — آخرین: ' + escP(n.lastT || n.t) + '</span>' : '';
  return '<div style="background:' + (unread ? (imp ? '#fef2f2' : '#fff8f5') : '#fff') + ';border:1px solid var(--brd);border-right:4px solid ' + (unread ? (imp ? '#dc2626' : 'var(--pri)') : '#cbd5e1') + ';border-radius:12px;padding:10px 12px;margin-bottom:8px">' +
    '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">' +
    '<div style="font-size:13px">' + (imp ? '<span style="color:#dc2626;font-size:11px;font-weight:bold">● مهم</span> ' : '') + '<b>' + escP(n.title) + '</b>' + rep +
    '<div style="font-size:11.5px;color:#64748b;margin-top:2px">' + escP(n.t) + ' — از: ' + escP(n.from) + ' (' + escP(n.fromRole) + ')' +
    (n.channels.length > 1 ? ' | کانال‌ها: ' + n.channels.join('، ') : '') + '</div>' +
    (n.body ? '<div style="font-size:12px;color:#475569;margin-top:4px">' + escP(n.body) + '</div>' : '') + '</div>' +
    '<div style="display:flex;gap:5px">' +
    (unread ? '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="ntfRead(\'' + n.cd + '\')">✓ خواندم</button>' : '') +
    (n.link && n.link.panel ? '<button class="bt" style="padding:4px 10px;font-size:12px" onclick="ntfGo(\'' + n.cd + '\')">↗ برو</button>' : '') +
    '</div></div></div>';
}

function renderCartable() {
  var el = document.getElementById('ctWrap');
  if (!el) return;
  var me = curSession().user;
  var showAll = (document.getElementById('ctAll') || {}).checked;
  var list = myNotifs().filter(function (n) { return showAll || (n.readBy || []).indexOf(me) < 0; });
  var impList = list.filter(function (n) { return ntfIsImportant(n); });
  var normList = list.filter(function (n) { return !ntfIsImportant(n); });
  var h = '';
  if (impList.length) {
    h += '<div style="font-size:12.5px;font-weight:bold;color:#dc2626;margin:2px 0 8px">🔴 اعلان‌های مهم (' + impList.length + ')</div>';
    impList.forEach(function (n) { h += ntfCard(n, me); });
  }
  if (normList.length) {
    h += (impList.length ? '<div style="font-size:12.5px;font-weight:bold;color:#64748b;margin:14px 0 8px">🔵 سایر اعلان‌ها (' + normList.length + ')</div>' : '');
    normList.forEach(function (n) { h += ntfCard(n, me); });
  }
  el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">اعلانی ندارید</div>';
  updateCartBadge();
}

/* v31.7.10: خواندم همه — فقط اعلان‌های قابل مشاهده کاربر فعلی */
function ntfReadAll() {
  var me = curSession().user;
  var mine = {};
  myNotifs().forEach(function (n) { mine[n.cd] = 1; });
  var notifs = getData('ptf_crm_notifs');
  var cnt = 0;
  notifs.forEach(function (n) {
    if (mine[n.cd] && (n.readBy || []).indexOf(me) < 0) { n.readBy = n.readBy || []; n.readBy.push(me); cnt++; }
  });
  if (cnt) { setData('ptf_crm_notifs', notifs); if (typeof ptfToast === 'function') ptfToast('✓ ' + cnt + ' اعلان خوانده‌شده علامت خورد', 'ok'); }
  renderCartable();
}

function ntfRead(cd) {
  var me = curSession().user;
  var notifs = getData('ptf_crm_notifs');
  notifs.forEach(function (n) { if (n.cd === cd && (n.readBy || []).indexOf(me) < 0) { n.readBy = n.readBy || []; n.readBy.push(me); } });
  setData('ptf_crm_notifs', notifs);
  renderCartable();
}

/* v33.4.1 (بازنگری استاندارد اعلانات — دستور کارفرما): وقتی رویداد پشتیبان یک اعلان
   «مهم» به‌طور کامل حل شد (مثلاً چک پاس/باطل شد، یادآور انجام شد)، اعلان مرتبط برای
   همه‌ی گیرندگان (نه فقط کاربر جاری) کاملاً حذف می‌شود — چون دیگر برای هیچ‌کس موضوعیت
   ندارد. این با «خواندم» (per-user) متفاوت است. صدا زده می‌شود از: chClear/chDel/void
   (cheques.js با refCd=چک.cd) و remDone/remDel (leads.js، bridge.js با refCd=یادآور.cd). */
window.ntfResolveByRef = function (refCd) {
  if (!refCd) return 0;
  var notifs = getData('ptf_crm_notifs');
  var kept = notifs.filter(function (n) { return !(n && (n.refCd === refCd || n.remCd === refCd)); });
  var removed = notifs.length - kept.length;
  if (removed) { setData('ptf_crm_notifs', kept); try { updateCartBadge(); } catch (eB) {} try { if (typeof updateInboxBadge === 'function') updateInboxBadge(); } catch (eB2) {} }
  return removed;
};


function ntfGo(cd) {
  var n = getData('ptf_crm_notifs').filter(function (x) { return x.cd === cd; })[0];
  if (!n || !n.link) return;
  ntfRead(cd);
  goPanelByName(n.link.panel);
}

/* ---- ترجیحات اعلان هر کاربر (AC3) ---- */
var NOTIF_EVENTS = [
  { id: 'offer_ready', lb: 'آماده شدن پیشنهاد (TO/CO)' },
  { id: 'inv_ref',     lb: 'ارجاع پیش‌فاکتور برای فاکتور' },
  { id: 'payment',     lb: 'ثبت وصولی / تسویه' },
  { id: 'lead',        lb: 'رویدادهای لید و پیگیری' }
];
function showNotifPrefs() {
  var me = curSession().user;
  var prefs = JSON.parse(localStorage.getItem('ptf_crm_prefs_' + me) || '{}');
  var rows = NOTIF_EVENTS.map(function (e) {
    var p = prefs[e.id] || {};
    return '<tr><td style="text-align:right">' + e.lb + '</td>' +
      '<td>✅ همیشه</td>' +
      '<td><input type="checkbox" data-ev="' + e.id + '" data-ch="sms"' + (p.sms ? ' checked' : '') + '></td>' +
      '<td><input type="checkbox" data-ev="' + e.id + '" data-ch="email"' + (p.email ? ' checked' : '') + '></td></tr>';
  }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:520px">' +
    '<h3>⚙️ ترجیحات دریافت اعلان</h3>' +
    '<p style="font-size:12px;color:#64748b">کارتابل همیشه فعال است؛ کانال‌های اضافه را برای هر رویداد انتخاب کنید. (پیامک/ایمیل نیازمند پیکربندی سرور است)</p>' +
    '<div class="tb2"><table><thead><tr><th>رویداد</th><th>کارتابل</th><th>پیامک</th><th>ایمیل</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveNotifPrefs()">ذخیره</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}
function saveNotifPrefs() {
  var me = curSession().user;
  var prefs = {};
  document.querySelectorAll('input[data-ev]').forEach(function (i) {
    var ev = i.getAttribute('data-ev'), ch = i.getAttribute('data-ch');
    prefs[ev] = prefs[ev] || {};
    prefs[ev][ch] = i.checked;
  });
  localStorage.setItem('ptf_crm_prefs_' + me, JSON.stringify(prefs));
  hideModal();
  addLog('ترجیحات اعلان ذخیره شد');
}

/* ============ US-122: مدیریت کاربران با نقش‌های جدید (AC1) ============ */
/* v14.5 (US-368 — دستور کارفرما): نقش‌های اصلی سازمان فقط یک‌بار قابل ایجادند */
var UNIQUE_ROLES = ['chairman', 'ceo', 'commercial'];
window.ptfRoleHolder = function (rl) {
  if (UNIQUE_ROLES.indexOf(rl) < 0) return null;
  var u = getData('ptf_crm_users').filter(function (x) { return x.roleId === rl; })[0];
  return u || null;
};
function showUserModal2() {
  if (!roleDef().users) { alert('فقط ادمین و رییس هیات مدیره می‌توانند کاربر تعریف کنند'); return; }
  var roleOpts = Object.keys(ROLES).filter(function (r) { return r !== 'admin'; }).map(function (r) {
    /* v14.5 (US-368): نقش یکتای اشغال‌شده غیرفعال + نام دارنده فعلی */
    var holder = (typeof ptfRoleHolder === 'function') ? ptfRoleHolder(r) : null;
    if (holder) return '<option value="' + r + '" disabled>' + ROLES[r].lb + ' — اشغال‌شده توسط ' + escP(holder.name) + '</option>';
    return '<option value="' + r + '">' + ROLES[r].lb + '</option>';
  }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:540px">' +
    '<h3>👤 کاربر جدید</h3>' +
    '<div class="fr"><div class="fld"><label>نام و نام خانوادگی *</label><input type="text" id="nU2Nm"></div>' +
    '<div class="fld"><label>نقش *</label><select id="nU2Rl">' + roleOpts + '</select></div></div>' +
    '<div class="fr"><div class="fld"><label>نام کاربری *</label><input type="text" id="nU2Lg" style="direction:ltr"></div>' +
    '<div class="fld"><label>رمز عبور * (حداقل ۶)</label><input type="password" id="nU2Pw"></div></div>' +
    '<div class="fr"><div class="fld"><label>موبایل * (برای پیامک)</label><input type="text" id="nU2Mob" placeholder="0912xxxxxxx" style="direction:ltr"></div>' +
    '<div class="fld"><label>ایمیل * (برای اعلان)</label><input type="email" id="nU2Ml" style="direction:ltr"></div></div>' +
    '<div class="fr"><div class="fld"><label>اختصاری انگلیسی * (Contact Person روی اسناد TO/CO)</label><input type="text" id="nU2En" placeholder="Mr. Lavasani / Ms. Karimi" style="direction:ltr"></div><div class="fld"></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveUser2()">تعریف کاربر</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

function saveUser2() {
  var nm = document.getElementById('nU2Nm').value.trim();
  var u = document.getElementById('nU2Lg').value.trim().toLowerCase();
  var p = document.getElementById('nU2Pw').value.trim();
  var mob = document.getElementById('nU2Mob').value.trim();
  var ml = document.getElementById('nU2Ml').value.trim();
  var nmEn = (document.getElementById('nU2En') || { value: '' }).value.trim();
  var rl = document.getElementById('nU2Rl').value;
  if (!nm || !u || !p) { alert('نام، نام کاربری و رمز الزامی است'); return; }
  if (!nmEn) { alert('اختصاری انگلیسی الزامی است (روی اسناد TO/CO به‌عنوان Contact Person درج می‌شود)'); return; }
  if (!mob || !ml) { alert('موبایل و ایمیل الزامی است (پایه اعلانات پیامکی/ایمیلی)'); return; }
  if (p.length < 6) { alert('رمز حداقل ۶ کاراکتر'); return; }
  if (u === 'admin') { alert('admin رزرو است'); return; }
  var users = getData('ptf_crm_users');
  for (var i = 0; i < users.length; i++) if (users[i].username === u) { alert('نام کاربری تکراری'); return; }
  /* v14.5 (US-368): سد دوم — نقش یکتای اشغال‌شده حتی اگر دراپ‌داون دور زده شود */
  var _holder = (typeof ptfRoleHolder === 'function') ? ptfRoleHolder(rl) : null;
  if (_holder) {
    alert('⛔ نقش «' + ROLES[rl].lb + '» فقط یک‌بار قابل ایجاد است.\nدارنده فعلی: ' + _holder.name + ' (' + _holder.username + ')\n\nبرای تغییر، ابتدا کاربر فعلی حذف/غیرفعال شود.');
    return;
  }
  sha256Hex(p).then(function (ph) {
    users.push({ username: u, passhash: ph, name: nm, nameEn: nmEn, role: ROLES[rl].lb, roleId: rl, mobile: mob, email: ml, createdFa: faDate(), createdBy: curSession().name });
    setData('ptf_crm_users', users);
    usersSyncToServer(function (d) {
      // v33.2.1 HOTFIX: همگام‌سازی کاربر جدید با سرور — اگر ناموفق باشد، هشدار داده شود
      if (!d || !d.ok) {
        alert('⚠️ کاربر در این مرورگر تعریف شد اما همگام‌سازی با سرور ناموفق بود.\nاین کاربر فقط از همین مرورگر قابل ورود است.\n\nخطا: ' + ((d && d.error) || 'سرور در دسترس نیست'));
      }
    });
    hideModal(); renderUsers();
    audit('کاربران', 'تعریف کاربر ' + nm + ' با نقش ' + ROLES[rl].lb, u);
    // US-150 AC7: پیامک خودکار اطلاعات ورود به کاربر جدید
    if (typeof smsWelcomeUser === 'function') smsWelcomeUser(nm, ROLES[rl].lb, u, p, mob);
    alert('✅ کاربر ' + nm + ' (' + ROLES[rl].lb + ') تعریف شد' + (typeof smsWelcomeUser === 'function' ? '\n📱 پیامک اطلاعات ورود به ' + mob + ' ارسال شد' : ''));
  });
}

function delUser2(u) {
  if (!roleDef().users) { alert('دسترسی ندارید'); return; }
  if (!confirm('کاربر ' + u + ' حذف شود؟')) return;
  setData('ptf_crm_users', getData('ptf_crm_users').filter(function (x) { return x.username !== u; }));
  usersSyncToServer(); // US-151: حذف در همه دستگاه‌ها اثر کند
  renderUsers();
  audit('کاربران', 'حذف کاربر', u);
}

function ptfRbacAuthHeaders(json) {
  var h = json ? { 'Content-Type': 'application/json' } : {};
  try { h['X-CRM-Role'] = curRole(); var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {}
  return h;
}

/* ============ US-151 فاز ۱: سینک کاربران با سرور ============ */
// رفع باگ گزارش‌شده: کاربرِ تعریف‌شده در کروم، از فایرفاکس/موبایل خطای «یوزر اشتباه» می‌گرفت
// چون کاربران فقط در localStorage همان مرورگر بودند. حالا سرور مرجع است.
function usersSyncToServer(cb) {
  var users = getData('ptf_crm_users');
  var fd = new FormData();
  fd.append('users', JSON.stringify(users));
  fetch('../api/crm.php?action=users_sync', { method: 'POST', headers: ptfRbacAuthHeaders(false), body: fd })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.ok) {
        if (typeof addLog === 'function') addLog('کاربران با سرور همگام شدند (' + d.count + ')');
        /* v31.7.14: اگر سرور کاربری را کنار گذاشت، بی‌صدا نماند */
        if (d.dropped && d.dropped.length && typeof ptfToast === 'function') ptfToast('⚠️ ' + d.dropped.length + ' کاربر بدون رمز قابل همگام‌سازی نبود: ' + d.dropped.join('، ') + ' — رمز آن‌ها باید دوباره تعریف شود', 'warn');
      }
      else if (typeof ptfToast === 'function') ptfToast('همگام‌سازی کاربران با سرور ناموفق: ' + (d.error || ''), 'warn');
      cb && cb(d);
    })
    .catch(function () {
      if (typeof ptfToast === 'function') ptfToast('سرور در دسترس نیست — کاربر فعلاً فقط در این مرورگر است', 'warn');
      cb && cb({ ok: false });
    });
}
// seed خودکار: با ورود ادمین/رییس، کاربران موجود این مرورگر یک بار به سرور منتقل می‌شوند
(function () {
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) {
      clearInterval(t);
      try {
        if (roleDef().users && getData('ptf_crm_users').length && !sessionStorage.getItem('ptf_users_seeded')) {
          sessionStorage.setItem('ptf_users_seeded', '1');
          usersSyncToServer();
        }
      } catch (e) {}
    }
    if (tries > 40) clearInterval(t);
  }, 500);
})();

// دریافت کاربران سروری (برای مرورگر/دستگاه جدید — پیش از لاگین هم قابل فراخوانی)
function usersPullFromServer(cb) {
  fetch('../api/crm.php?action=users_get', { headers: ptfRbacAuthHeaders(false) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.ok && Array.isArray(d.users) && d.users.length) {
        var local = getData('ptf_crm_users');
        var seen = {};
        d.users.forEach(function (u) { seen[u.username] = true; });
        var merged = d.users.slice();
        local.forEach(function (u) { if (!seen[u.username]) merged.push(u); });
        /* v31.7.14 BUG-USERS-VANISH-001: هش محلی روی رکورد سروری بی‌هش حفظ شود */
        var lByName = {};
        local.forEach(function (u) { if (u && u.username) lByName[u.username] = u; });
        merged.forEach(function (u) {
          if (u && u.username && !u.passhash && lByName[u.username] && lByName[u.username].passhash) u.passhash = lByName[u.username].passhash;
        });
        setData('ptf_crm_users', merged);
      }
      cb && cb(d);
    })
    .catch(function () { cb && cb({ ok: false }); });
}

/* v33.2.1: تطبیق نقش محلی با سرور — جلوگیری از ویرایش با نقش منقضی/اشتباه
   اگر نقش سرور با محلی متفاوت باشد، session آپدیت و UI رفرش می‌شود. */
function verifyRoleFromServer(cb) {
  var t = localStorage.getItem('ptf_crm_token');
  if (!t) { cb && cb(); return; }
  fetch('../api/crm.php?action=role_verify', { headers: { 'X-CRM-Token': t }, cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.ok && d.role) {
        var cur = curRole();
        if (d.role !== cur) {
          var s = JSON.parse(localStorage.getItem('ptf_crm_session') || '{}');
          s.roleId = d.role;
          s.role = d.role;
          localStorage.setItem('ptf_crm_session', JSON.stringify(s));
          localStorage.setItem('ptf_crm_token_role', d.role);
          if (typeof ptfToast === 'function') ptfToast('🔄 نقش شما از سرور به‌روز شد: ' + (ROLES[d.role] ? ROLES[d.role].lb : d.role), 'info');
          if (typeof renderUsers2 === 'function') renderUsers2();
        }
      }
      cb && cb(d);
    })
    .catch(function () { cb && cb(); });
}

// بازنویسی renderUsers با نقش‌ها و عملیات
function renderUsers2() {
  var users = getData('ptf_crm_users');
  var tb = document.getElementById('uTb');
  if (!tb) return;
  var canManage = roleDef().users;
  var h = '<tr><td><strong>admin</strong></td><td>مدیر ارشد</td><td><span class="bd b-ad">ادمین</span></td><td>—</td><td><span class="bd b-st4">✔ فعال</span></td><td></td></tr>';
  users.forEach(function (us) {
    h += '<tr><td><strong>' + escP(us.username) + '</strong></td><td>' + escP(us.name) + '</td>' +
      '<td><span class="bd ' + (us.roleId === 'chairman' ? 'b-ad' : 'b-op') + '">' + escP(ROLES[us.roleId] ? ROLES[us.roleId].lb : (us.role || us.roleId)) + '</span></td>' +
      '<td style="direction:ltr;font-size:11.5px">' + escP(us.mobile || '-') + '<br>' + escP(us.email || '-') + '</td>' +
      '<td><span class="bd b-st4">✔ فعال</span></td>' +
      '<td>' + (canManage
        ? '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;color:#0e7490" title="ارسال مجدد پیامک اطلاعات ورود — رمز موقت جدید (US-376)" onclick="smsResendLogin(\'' + escP(us.username) + '\')">📱 ارسال مجدد</button> ' +
          '<button class="bt bt-o" style="padding:3px 9px;font-size:12px;color:#dc2626" onclick="delUser2(\'' + escP(us.username) + '\')">🗑️</button>'
        : '') + '</td></tr>';
  });
  tb.innerHTML = h;
  if (document.getElementById('dUser')) document.getElementById('dUser').textContent = users.length + 1;
}

/* ============ AC2: قیمت‌های خرید (کارشناس خرید) ============ */
function buildBuyQuotes() {
  return '<div class="ph"><h3>🛒 قیمت‌های خرید (استعلام از تامین‌کنندگان)</h3>' +
    '<div class="sb2"><input type="text" id="bqSrch" placeholder="جستجو..." oninput="renderBuyQuotes()">' +
    '<button class="bt" onclick="showBuyQModal()">+ ثبت قیمت خرید</button></div></div>' +
    '<div class="tb2"><table><thead><tr><th>کد</th><th>مرجع (RFQ/پرونده)</th><th>تامین‌کننده</th><th>شرح</th><th>قیمت خرید</th><th>تاریخ</th><th>ثبت‌کننده</th></tr></thead><tbody id="bqTb"></tbody></table></div>';
}
function renderBuyQuotes() {
  var tb = document.getElementById('bqTb');
  if (!tb) return;
  if (!roleDef().buyPrice) { tb.innerHTML = '<tr><td colspan="7" style="color:#dc2626;padding:20px;text-align:center">⛔ شما به قیمت‌های خرید دسترسی ندارید</td></tr>'; return; }
  var q = ((document.getElementById('bqSrch') || {}).value || '').toLowerCase();
  var list = getData('ptf_crm_buyquotes').filter(function (b) {
    return !q || ((b.ref || '') + ' ' + (b.sup || '') + ' ' + (b.desc || '')).toLowerCase().indexOf(q) > -1;
  });
  tb.innerHTML = list.map(function (b) {
    return '<tr><td>' + escP(b.cd) + '</td><td>' + escP(b.ref || '-') + '</td><td>' + escP(b.sup) + '</td><td>' + escP(b.desc) + '</td>' +
      '<td>' + (+b.price).toLocaleString('fa-IR') + ' ریال</td><td>' + escP(b.t) + '</td><td>' + escP(b.by) + '</td></tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">قیمتی ثبت نشده</td></tr>';
}
function showBuyQModal() {
  var sups = getData('ptf_crm_suppliers');
  var supOpts = sups.map(function (s) { return '<option>' + escP(s.co) + '</option>'; }).join('') || '<option>—</option>';
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:520px">' +
    '<h3>🛒 ثبت قیمت خرید</h3>' +
    '<div class="fr"><div class="fld"><label>مرجع (شماره RFQ/پرونده)</label><input type="text" id="nBqRef" style="direction:ltr"></div>' +
    '<div class="fld"><label>تامین‌کننده</label><select id="nBqSup">' + supOpts + '</select></div></div>' +
    '<div class="fld"><label>شرح کالا/خدمت *</label><input type="text" id="nBqDesc"></div>' +
    '<div class="fld"><label>قیمت خرید (ریال) *</label><input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="nBqPr" style="direction:ltr"></div>' +
    '<div class="fld"><label>یادداشت (شرایط تامین‌کننده)</label><textarea id="nBqNote" rows="2"></textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveBuyQ()">ثبت</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}
function saveBuyQ() {
  var desc = document.getElementById('nBqDesc').value.trim();
  var pr = ptfNum(document.getElementById('nBqPr').value);
  if (!desc || !pr) { alert('شرح و قیمت الزامی است'); return; }
  var list = getData('ptf_crm_buyquotes');
  list.unshift({ cd: genCode('BQ'), ref: document.getElementById('nBqRef').value.trim(), sup: document.getElementById('nBqSup').value,
    desc: desc, price: pr, note: document.getElementById('nBqNote').value.trim(), t: faDate(), by: curSession().name, byRole: roleDef().lb });
  setData('ptf_crm_buyquotes', list);
  hideModal(); renderBuyQuotes();
  audit('قیمت خرید', 'ثبت قیمت خرید: ' + desc, '');
  // اعلان به نقش‌های ارشد
  notify({ toRoles: SENIOR_ROLES, title: 'قیمت خرید جدید ثبت شد: ' + desc, kind: 'buyq', channels: ['cart'], link: { panel: 'buyq' } });
}

/* ============ AC3: ارجاع فاکتور + پنل حسابدار ============ */
function refToInvoice(offerNo) {
  if (!isSenior()) { alert('فقط نقش‌های ارشد می‌توانند برای صدور فاکتور ارجاع دهند'); return; }
  var offers = getData('ptf_crm_offers');
  var o = offers.filter(function (x) { return x.no === offerNo; })[0];
  if (!o) return;
  if (o.kind !== 'CO') { alert('فقط پیشنهاد مالی (CO) قابل ارجاع برای فاکتور است'); return; }
  // v18.9 (US-431 فاز۱): پس از برد و تشکیل پرونده فروش، ارجاع فاکتور از ماژول پیشنهادها ممنوع است.
  if (o.st === 'won') {
    alert('🔒 این پیشنهاد برنده و پرونده فروش آن تشکیل شده است.\nارجاع فاکتور رسمی باید فقط از داخل پرونده فروش و پس از تحویل به کارفرما انجام شود.');
    try { if (typeof goPanelByName === 'function') goPanelByName('deals'); } catch(e) {}
    return;
  }
  alert('🔒 فقط پیش‌فاکتور برنده قابل ارجاع بود؛ در معماری جدید پس از برد، ارجاع فاکتور فقط از داخل پرونده فروش انجام می‌شود.');
  return;
  o.invRef = { by: curSession().name, role: roleDef().lb, t: faDate() };
  setData('ptf_crm_offers', offers);
  audit('فاکتور', 'ارجاع ' + offerNo + ' برای صدور فاکتور', offerNo);
  // استثنا (AC4 اعلانات): فقط حسابدار
  notify({ toRoles: ['accountant'], title: 'پیش‌فاکتور ' + offerNo + ' برای صدور فاکتور ارجاع شد',
    body: 'خریدار: ' + (o.buyerCo || '-'), kind: 'inv_ref', channels: ['cart'], link: { panel: 'inv' }, actionable: true });
  // US-150 AC6: پیامک خودکار به حسابدار(ان)
  if (typeof smsSendSingle === 'function' && confirm('📱 پیامک اطلاع‌رسانی هم برای حسابدار ارسال شود؟')) {
    var accs = getData('ptf_crm_users').filter(function (u) { return u.roleId === 'accountant' && u.mobile; });
    if (!accs.length) alert('⚠️ کاربری با نقش حسابدار و شماره موبایل ثبت نشده');
    accs.forEach(function (u) {
      smsSendSingle(u.mobile,
        'حسابدار محترم شرکت پیشرو تجهیز فرتاک،\n' +
        'یک پیش‌فاکتور (' + offerNo + ') جهت صدور فاکتور رسمی به کارتابل شما ارجاع شد. لطفاً پس از صدور فاکتور، فایل PDF آن را در سامانه بارگذاری نمایید.\nhttps://pishtaj.ir/crm/',
        function (d) { addLog(d.ok && d.sent ? 'پیامک ارجاع فاکتور به ' + u.name + ' ارسال شد' : 'پیامک ارجاع فاکتور در صف قرار گرفت'); });
    });
  }
  alert('✅ برای حسابدار ارسال شد (فقط حسابدار مطلع می‌شود)');
  if (typeof renderOffers === 'function') renderOffers();
}

function buildInvoices() {
  var taxHtml = (typeof window.ptfTaxReturnsHtml === 'function') ? window.ptfTaxReturnsHtml() : '';
  return '<div class="ph"><h3>🧾 فاکتورها (پیش‌فاکتورهای ارجاع‌شده)</h3></div><div id="invWrap"></div>' + taxHtml;
}
function renderInvoices() {
  var el = document.getElementById('invWrap');
  if (!el) return;
  var refd = getData('ptf_crm_offers').filter(function (o) { return o.invRef; });
  var invs = getData('ptf_crm_invoices').filter(function (i) { return i.status !== 'void' && i.st !== 'void' && i.void !== true; });
  if (!ptfCanSeeLedger('unofficial')) {
    invs = invs.filter(function (i) { return !i.isUnofficial; });
  }
  var h = '';
  refd.forEach(function (o) {
    var inv = invs.filter(function (i) { return i.offerNo === o.no; })[0];
    var total = (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
    var invPaidSum = inv ? ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0) : 0;
    h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<div style="font-size:13px"><b>' + escP(o.no) + '</b> — ' + escP(o.buyerCo || '-') +
      '<div style="font-size:11.5px;color:#64748b">مبلغ CO: ' + (typeof ptfMoney === 'function' ? ptfMoney(total, o.currency) : total.toLocaleString('fa-IR') + ' ریال') + (((o.currency || inv.offerCurrency) && (o.currency || inv.offerCurrency) !== 'IRR') ? ' <span style="color:#0e7490">| مبنا: ' + escP(o.currency || inv.offerCurrency) + (o.fxBasis ? ' / ' + escP(o.fxBasis === 'sana' ? 'سنا' : o.fxBasis === 'free' ? 'آزاد' : 'توافقی') : '') + (o.fxRateRef ? ' / ' + (+o.fxRateRef).toLocaleString('fa-IR') + ' ریال' : '') + '</span>' : '') + ' | ارجاع: ' + escP(o.invRef.t) + ' توسط ' + escP(o.invRef.by) + ' (' + escP(o.invRef.role) + ')</div>' + /* v17.4 US-416 */
      (inv ? '<div style="font-size:12px;color:#10b981;margin-top:3px">🧾 فاکتور ' + escP(inv.no) + ' — ' + escP(inv.t) + ' — ' + (+inv.amount).toLocaleString('fa-IR') + ' ریال' +
        (((o.currency || inv.offerCurrency) && (o.currency || inv.offerCurrency) !== 'IRR') ? ' <small style="color:#0e7490">| فاکتور ریالیِ درخواست ' + escP(o.currency || inv.offerCurrency) + '</small>' : '') +
        ((inv.files||[]).length ? ' | ' + inv.files.map(function(f,fi){ return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + escP(f.key||'') + '\')" style="color:#0e7490">📎' + escP(f.name) + '</a>'; }).join(' ') : '') +
        (inv.editedAt ? ' <small style="color:#0e7490">✏️ ویرایش: ' + escP(inv.editedAt) + ' — ' + escP(inv.editedBy || '') + '</small>' : '') +
        /* AUD-12 (گزارش کارفرما ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
           این هشدار قدیمی «مغایرت با CO» مقدار inv.amount (همیشه ریالی) را
           مستقیم با total (جمع اقلام CO به ارز خام، بدون ×نرخ تسعیر) مقایسه
           می‌کرد. برای سند ارزی، این دو عدد به‌طور طبیعی واحد متفاوت دارند؛
           یعنی وقتی حسابدار عدد ارزی خام را در فیلد ریالی وارد می‌کرد (باگ
           واقعی کشف‌شده)، این دو مقدار برابر می‌شدند و هیچ هشداری نشان داده
           نمی‌شد — دقیقاً برعکسِ هدف این سد ایمنی. اکنون برای سند ارزی از
           همان تابع خالص ptfLedgerOfficialFxSanity استفاده می‌شود که total
           را در نرخ تسعیر مرجع ضرب می‌کند. */
        (function () {
          var curOfInv = o.currency || inv.offerCurrency;
          if (curOfInv && curOfInv !== 'IRR') {
            var fxSanity = (typeof window.ptfLedgerOfficialFxSanity === 'function') ? window.ptfLedgerOfficialFxSanity(o, inv.amount) : { applicable: false, ok: true };
            if (fxSanity.applicable && !fxSanity.ok) {
              return ' <span style="color:#dc2626;font-weight:900">⚠️ مغایرت شدید با پیش‌فاکتور ارزی — انتظار ~' + fxSanity.expectedIrr.toLocaleString('fa-IR') + ' ریال بود</span>';
            }
            return '';
          }
          return (Math.abs(inv.amount - total) > 0.5 && total ? ' <span style="color:#dc2626">⚠️ مغایرت با CO: ' + Math.round(Math.abs(inv.amount - total) * 100 / total) + '٪</span>' : '');
        })() + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
      /* v19.3 (US-436 AC3/US-435 AC3): اگر ارجاع از پرونده فروش آمده، سند ضمیمه = snapshot قطعی برد (US-432) */
      (o.invRef && o.invRef.fromFile && typeof sfAwardPrint === 'function'
        ? '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#b45309;border-color:#fde68a" title="نسخه تغییرناپذیر لحظه ابلاغ سفارش — مبنای فاکتور رسمی" onclick="sfAwardPrint(\'' + escP(o.invRef.fromFile) + '\',\'' + o.no + '\')">🏆 سند قطعی برد (PDF)</button>'
        : '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="offerPrint(\'' + o.no + '\')">⬇️ دانلود CO</button>') +
      (!inv ? '<button class="bt" style="padding:4px 10px;font-size:12px" onclick="showInvModal(\'' + o.no + '\')">+ ثبت فاکتور صادره</button>' : '') +
      /* فاز ۲ / گام ۷: ویرایش/ابطال فاکتور فروش رسمی — فقط پیش از اولین وصولی، فقط نقش‌های ارشد */
      (inv && isSenior() ? '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="showInvModal(\'' + o.no + '\',\'' + escP(inv.cd) + '\')" title="' + (invPaidSum > 0 ? 'دارای وصولی — از سند اصلاحی استفاده کنید' : 'ویرایش') + '">✏️ ویرایش</button>' : '') +
      (inv && isSenior() ? '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#dc2626;border-color:#fecaca" onclick="ptfInvoiceVoid(\'' + escP(inv.cd) + '\')" title="' + (invPaidSum > 0 ? 'دارای وصولی — از سند اصلاحی استفاده کنید' : 'ابطال') + '">🗑 ابطال</button>' : '') +
      '</div></div></div>';
  });
  el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">پیش‌فاکتور ارجاع‌شده‌ای وجود ندارد.<br><small>فقط پیش‌فاکتورهایی که نقش‌های ارشد ارجاع داده‌اند اینجا دیده می‌شوند.</small></div>';
  if (typeof window.ptfTaxReturnsRender === 'function') {
    window.ptfTaxReturnsRender();
  }
}
function showInvModal(offerNo, editCd) {
  /* v19.3 (US-436 AC2): پنجره کامل حسابدار — مبلغ، ارزش افزوده، شماره، تاریخ، PDF
     فاز ۲ / گام ۷: اگر editCd داده شود، همین دیالوگ در حالت ویرایش باز می‌شود
     (فیلدها پیش‌پر با رکورد فعلی؛ فقط برای فاکتورهایی که هنوز وصولی ندارند). */
  window._invEditCd = '';
  var editRec = null;
  if (editCd) {
    editRec = getData('ptf_crm_invoices').filter(function (x) { return x.cd === editCd; })[0];
    if (!editRec) { alert('⛔ فاکتور یافت نشد'); return; }
    var paidCheck = ((editRec.payments || []).concat(editRec.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    if (paidCheck > 0) { alert('⛔ این فاکتور دارای وصولی است؛ ویرایش مستقیم مجاز نیست. ابتدا وصولی را ابطال کنید یا از سند اصلاحی سال مالی استفاده کنید.'); return; }
    window._invEditCd = editCd;
  }
  var _advTxt = '';
  try {
    var _o = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
    if (_o && typeof ptfAdvanceNormalize === 'function') {
      var _a = ptfAdvanceNormalize(_o);
      if (_a && _a.mode !== 'none' && (+_a.amt || 0) > 0) _advTxt = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:7px 11px;font-size:11.5px;color:#92400e;margin-bottom:8px">💰 این پیشنهاد پیش‌پرداخت ' + (typeof ptfAdvanceLabel === 'function' ? ptfAdvanceLabel(_o) : '') + ' دارد — ' + (_a.cashFull ? 'پرداخت کامل/نقدی: فاکتور تسویه‌شده ثبت می‌شود (US-436)' : _a.paid ? 'مبلغ وصول‌شده خودکار از مانده مطالبات کسر می‌شود (US-436)' : 'هنوز وصول نشده — کل مبلغ به مطالبات می‌رود') + '</div>';
    }
  } catch (eAdv) {}
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:520px">' +
    '<h3>🧾 ' + (editRec ? 'ویرایش فاکتور رسمی — ' + escP(editRec.no) : 'ثبت فاکتور رسمی صادره') + ' — ' + escP(offerNo) + '</h3>' +
    '<p style="font-size:12px;color:#64748b">' + (editRec ? 'فقط تا قبل از ثبت اولین وصولی قابل‌ویرایش است؛ پس از آن از سند اصلاحی سال مالی استفاده کنید.' : 'فاکتور در سیستم حسابداری صادر شده؛ مشخصات و PDF آن اینجا ثبت و مستقیم در پرونده فروش می‌نشیند (US-436).') + '</p>' + _advTxt +
    '<div class="fr"><div class="fld"><label>شماره فاکتور حسابداری *</label><input type="text" id="nInvNo" value="' + escP(editRec ? editRec.no : '') + '" style="direction:ltr"></div>' +
    '<div class="fld"><label>تاریخ فاکتور *</label><input type="text" id="nInvDate" value="' + escP(editRec ? (editRec.invDate || faDate()) : faDate()) + '" placeholder="1405/04/21"></div></div>' +
    '<div class="fr"><div class="fld"><label>مبلغ فاکتور بدون ارزش افزوده (ریال) *</label><input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="nInvAmt" value="' + (editRec ? (+editRec.base || 0) : '') + '" style="direction:ltr" oninput="invVatCalc()"></div>' +
    '<div class="fld"><label>ارزش افزوده (ریال)</label><input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="nInvVat" value="' + (editRec ? (+editRec.vat || 0) : '') + '" style="direction:ltr" oninput="invVatCalc(true)"></div></div>' +
    '<div id="nInvSum" style="font-size:12px;color:#0e7490;font-weight:800;margin-bottom:8px"></div>' +
    '<div class="fld"><label>' + (editRec ? 'افزودن فایل جدید (اختیاری — فایل‌های قبلی حفظ می‌شوند)' : 'فایل فاکتور (PDF/عکس)') + '</label><div id="invUpWrap"></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveInv(\'' + escP(offerNo) + '\')">' + (editRec ? '💾 ذخیره تغییرات' : 'ثبت فاکتور') + '</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  window._invFiles = [];
  if (typeof attachUploadWidget === 'function')
    attachUploadWidget('invUpWrap', 'invoices', function (f) { window._invFiles.push(f); });
  if (editRec) invVatCalc();
}
/* v19.3 (US-436): محاسبه زنده جمع فاکتور — پیشنهاد ۱۰٪ ارزش افزوده با اولین ورود مبلغ */
function invVatCalc(fromVat) {
  var amtEl = document.getElementById('nInvAmt'), vatEl = document.getElementById('nInvVat'), sumEl = document.getElementById('nInvSum');
  if (!amtEl || !vatEl || !sumEl) return;
  var amt = ptfNum(amtEl.value), vat = ptfNum(vatEl.value);
  if (!fromVat && amt && vatEl.value === '' ) { vat = Math.round(amt * 0.1); vatEl.value = vat; } /* پیش‌فرض ۱۰٪ — قابل اصلاح حسابدار */
  sumEl.textContent = amt ? 'جمع کل فاکتور با ارزش افزوده: ' + (amt + vat).toLocaleString('fa-IR') + ' ریال' : '';
}
function saveInv(offerNo) {
  var no = document.getElementById('nInvNo').value.trim();
  var amt = ptfNum(document.getElementById('nInvAmt').value);
  if (!no || !amt) { alert('شماره و مبلغ فاکتور الزامی است'); return; }
  /* AUD-10 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
     فاکتور خرید تأمین‌کننده (supplier-finance.js#slInvoiceSave) گارد صریح
     یکتایی شماره‌ی سند دارد (FIN-EX-01)؛ فاکتور فروش رسمی هرگز نداشت —
     یعنی می‌شد دو پیش‌فاکتور متفاوت را با یک شماره‌ی فاکتور یکسان (اما
     مبلغ متفاوت) ثبت کرد، که برای شماره‌ی فاکتور رسمی/مالیاتی مسئله‌ساز
     است. بررسی روی همه‌ی فاکتورهای غیرباطل انجام می‌شود (نه فقط همین
     offerNo) چون شماره‌ی فاکتور حسابداری باید در کل شرکت یکتا باشد؛ رکورد
     خودِ در-حال-ویرایش (editCd) از این بررسی مستثنی می‌شود. */
  var editCdCheck = window._invEditCd || '';
  var dupInv = getData('ptf_crm_invoices').filter(function (x) {
    return x.cd !== editCdCheck && x.status !== 'void' && x.st !== 'void' && x.void !== true && String(x.no || '').trim().toLowerCase() === no.toLowerCase();
  })[0];
  if (dupInv) { alert('⛔ فاکتور با شماره «' + no + '» قبلاً برای پیش‌فاکتور ' + (dupInv.offerNo || '-') + ' ثبت شده — شماره تکراری مجاز نیست'); return; }
  /* v19.3 (US-436 AC2): ارزش افزوده + تاریخ فاکتور — مبلغ ثبتی = جمع کل با ارزش افزوده */
  var vat = ptfNum((document.getElementById('nInvVat') || {}).value);
  var invDate = ((document.getElementById('nInvDate') || {}).value || '').trim() || faDate();
  var invYear = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(invDate) : ((String(invDate).match(/(13|14)\d{2}/) || [])[0] || '');
  if (invYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(invYear)) { alert('🔒 سال مالی ' + invYear + ' قفل است؛ ثبت فاکتور در آن سال مجاز نیست. از سند اصلاحی استفاده کنید.'); return; }
  var grand = amt + vat;
  var files = window._invFiles || [];

  /* AUD-12 (گزارش کارفرما ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
     فرم فاکتور رسمی صادره عمداً فقط ریالی است (طبق تصمیم کارفرما: فاکتور
     رسمی همیشه از سیستم حسابداری/سپیدار به ریال صادر می‌شود، هیچ فاکتور
     رسمی مبلغ ارزی ندارد) — اما وقتی پیش‌فاکتور مبنا ارزی است، مبلغ ریالی
     واردشده باید معادل واقعی همان مبلغ ارزی (× نرخ تسعیر مرجع پیش‌فاکتور)
     باشد. سناریوی واقعی کشف‌شده: پیش‌فاکتور ۱۵۰۰ دلاری، حسابدار عدد خام
     «۱۵۰۰» را در فیلد ریالی وارد کرده (باید ~۳ میلیارد ریال می‌بود) — این
     اشتباه بدون هیچ هشداری ثبت و بعداً وارد داشبورد موازنه فصلی هم شده و
     محاسبات مالیاتی را کاملاً منحرف کرده بود. */
  try {
    var _fxOfferForSanity = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
    var _fxSanity = (typeof window.ptfLedgerOfficialFxSanity === 'function') ? window.ptfLedgerOfficialFxSanity(_fxOfferForSanity, grand) : { applicable: false, ok: true };
    if (_fxSanity.applicable && !_fxSanity.ok) {
      var _fxWarnMsg = '⚠️ هشدار مغایرت شدید با پیش‌فاکتور ارزی!\n\n' +
        'پیش‌فاکتور مبنای ' + (_fxOfferForSanity.currency || '') + ' ' + _fxSanity.rawForeignTotal.toLocaleString('en-US') + ' است (نرخ مرجع ' + _fxSanity.fxRateRef.toLocaleString('fa-IR') + ' ریال) — یعنی معادل ریالی مورد انتظار حدود ' + _fxSanity.expectedIrr.toLocaleString('fa-IR') + ' ریال است.\n\n' +
        'مبلغ واردشده (' + grand.toLocaleString('fa-IR') + ' ریال) خیلی کمتر از این مقدار است — احتمالاً رقم ارزی خام به‌جای معادل ریالی وارد شده.\n\n' +
        'اگر این تخفیف واقعی و آگاهانه است، OK را بزنید. اگر اشتباه است، Cancel را بزنید و مبلغ صحیح ریالی را وارد کنید.';
      if (!confirm(_fxWarnMsg)) return;
    }
  } catch (eFxSanity) {}

  /* فاز ۲ / گام ۷ (crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md بند ۱۱):
     حالت ویرایش — اگر window._invEditCd ست شده باشد، رکورد موجود اصلاح می‌شود
     (بدون تغییر offerNo/cd/payments و بدون امکان ویرایش پس از وصولی). */
  var editCd = window._invEditCd || '';
  var invs = getData('ptf_crm_invoices');
  if (editCd) {
    var existing = invs.filter(function (x) { return x.cd === editCd; })[0];
    if (!existing) { alert('⛔ فاکتور برای ویرایش یافت نشد'); return; }
    var paidSoFar = ((existing.payments || []).concat(existing.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    if (paidSoFar > 0) { alert('⛔ این فاکتور دارای وصولی است؛ برای اصلاح مبلغ ابتدا وصولی‌ها را ابطال کنید یا از سند اصلاحی سال مالی استفاده کنید.'); return; }
    var oldExistYear = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(existing.invDate || '') : '';
    if (oldExistYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(oldExistYear)) { alert('🔒 سال مالی ' + oldExistYear + ' قفل است؛ ویرایش فاکتور در آن سال مجاز نیست.'); return; }
    var oldNo = existing.no, oldAmt = existing.amount;
    existing.no = no; existing.amount = grand; existing.base = amt; existing.vat = vat; existing.invDate = invDate;
    if (files.length) { existing.files = (existing.files || []).concat(files); existing.file = existing.files[0] ? existing.files[0].name : existing.file; }
    existing.editedAt = faDateTime(); existing.editedBy = curSession().name;
    setData('ptf_crm_invoices', invs);
    hideModal(); renderInvoices();
    audit('فاکتور', 'ویرایش فاکتور ' + oldNo + ' → ' + no + ' (' + oldAmt.toLocaleString('fa-IR') + ' → ' + grand.toLocaleString('fa-IR') + ' ریال) برای ' + offerNo, no);
    if (typeof ptfToast === 'function') ptfToast('✅ فاکتور ویرایش شد', 'ok');
    window._invEditCd = '';
    return;
  }

  var _offerMeta = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0] || {};
  /* v31.7.3 BUG-AUDIT-002-FINANCIAL-CODEGEN: فاکتور با کد TMP ذخیره نمی‌شود —
     شماره رسمی فقط از سرور. اگر pool خالی باشد، کاربر باید refresh/ورود مجدد کند. */
  var _newInvCd = genCode('INV');
  if (/^TMP-(INV)-/.test(String(_newInvCd))) {
    alert('⛔ شماره رسمی فاکتور از سرور دریافت نشده است. اتصال/ورود را برقرار کنید و دوباره تلاش کنید.');
    return;
  }
  var newInv = { cd: _newInvCd, offerNo: offerNo, no: no, amount: grand, base: amt, vat: vat, invDate: invDate,
    buyerCo: _offerMeta.buyerCo || '', offerCurrency: _offerMeta.currency || 'IRR', offerFxBasis: _offerMeta.fxBasis || '', offerFxRateRef: +_offerMeta.fxRateRef || 0,
    files: files, file: files.length ? files[0].name : '', t: faDate(), by: curSession().name, payments: [] };
  /* v19.3 (US-436 AC5/AC6): پیش‌پرداخت ساختاریافته (v18.2) — نقدی/کامل=تسویه فوری؛ وصول‌شده=کسر خودکار از مطالبات */
  try {
    var _oAdv = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
    var _a = (_oAdv && typeof ptfAdvanceNormalize === 'function') ? ptfAdvanceNormalize(_oAdv) : null;
    if (_a && _a.mode !== 'none' && (+_a.amt || 0) > 0) {
      var received = Math.round(+(_a.receivedAmt != null ? _a.receivedAmt : (_a.paid || _a.cashFull ? _a.amt : 0)) || 0);
      /* v24.5 BUG-126-02: کسر از فاکتور = مبلغ وصول‌شده (نه کل پیش‌پرداخت تعریف‌شده) */
      var advPay = _a.cashFull ? grand : Math.min(grand, Math.max(0, received));
      if (advPay > 0) {
        var advPayRec = { amt: advPay, how: _a.cashFull ? 'پرداخت کامل/نقدی هنگام سفارش (US-436)' : 'کسر مبالغ وصول‌شده پیش‌پرداخت (US-436)', t: faDate(), by: curSession().name, fromAdvance: true };
        /* فاز ۲ / گام ۹ (رفع باگ ریشه‌یابی‌شده — کارفرما): برای اسناد ارزی، معادل
           ارزی وصولی باید ثبت شود وگرنه ptfFxInvoiceSummary (fx.js) آن را «صفر»
           می‌بیند و مانده ارزی را برابر کل فاکتور نشان می‌دهد؛ الگو دقیقاً از
           همان روش unofficial-invoice.js (پیش‌پرداخت فاکتور غیررسمی) گرفته شده:
           نرخ = همان نرخی که هنگام ثبت پیش‌پرداخت وارد شده (_a.rate از petty.js). */
        if (_oAdv.currency && _oAdv.currency !== 'IRR' && +_a.rate > 0) {
          advPayRec.fx = { fxAmt: +(advPay / (+_a.rate)).toFixed(2), rate: +_a.rate, cur: _oAdv.currency };
        }
        newInv.payments.push(advPayRec);
        newInv.advApplied = advPay;
      }
    }
  } catch (eAdv2) {}
  invs.unshift(newInv);
  setData('ptf_crm_invoices', invs);
  /* v19.3 (US-436 AC3): PDF و مشخصات فاکتور مستقیم در پرونده فروش می‌نشیند — مرحله خودکار ۹/۱۰/۱۱ (sfStageOf) */
  try {
    var _deals = getData('ptf_crm_deals');
    var _d = _deals.filter(function (x) { return x.wonOffer === offerNo || x.offerNo === offerNo; })[0];
    if (_d) {
      _d.docs = _d.docs || [];
      if (files.length && files[0].key && !_d.docs.some(function (x) { return x.key === files[0].key; }))
        _d.docs.push({ name: 'فاکتور رسمی ' + no + ' — ' + files[0].name, key: files[0].key, size: files[0].size || 0, t: faDate(), by: curSession().name, note: 'صادره حسابدار (US-436)' });
      _d.timeline = _d.timeline || [];
      _d.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🧾 فاکتور رسمی ' + no + ' صادر شد — مبلغ کل ' + grand.toLocaleString('fa-IR') + ' ریال (ارزش افزوده: ' + vat.toLocaleString('fa-IR') + ' ت)' + (newInv.advApplied ? ' — کسر پیش‌پرداخت: ' + newInv.advApplied.toLocaleString('fa-IR') + ' ریال' : '') });
      setData('ptf_crm_deals', _deals);
    }
  } catch (eD) {}
  // US-141 AC4: نسخه فاکتور به پوشه اسناد مالی پرونده مرتبط (اگر موجود باشد) منتقل می‌شود
  var prjs = getData('ptf_crm_projects');
  var prj = prjs.filter(function (p) { return p.offerNo === offerNo; })[0];
  if (prj) {
    prj.docs = prj.docs || [];
    prj.docs.push({ folder: 'fin', name: 'فاکتور ' + no + (files.length ? ' — ' + files[0].name : ' (سیستمی)'), key: files.length ? files[0].key : null, t: faDate(), by: curSession().name, note: 'ثبت خودکار از ماژول فاکتورها' });
    prj.timeline = prj.timeline || [];
    prj.timeline.push({ t: faDateTime(), by: curSession().name, tx: 'فاکتور ' + no + ' به‌صورت خودکار به پوشه اسناد مالی افزوده شد' });
    setData('ptf_crm_projects', prjs);
  }
  hideModal(); renderInvoices();
  audit('فاکتور', 'ثبت فاکتور ' + no + ' برای ' + offerNo, no);
  // US-150 AC6: پیامک «انجام شد» به ارجاع‌دهنده
  var refOffer = getData('ptf_crm_offers').filter(function (x) { return x.no === offerNo; })[0];
  if (refOffer && refOffer.invRef && typeof smsSendSingle === 'function' && confirm('📱 پیامک اطلاع «فاکتور صادر شد» برای ارجاع‌دهنده (' + refOffer.invRef.by + ') ارسال شود؟')) {
    var refMob = typeof smsUserMobileByName === 'function' ? smsUserMobileByName(refOffer.invRef.by) : '';
    if (refMob) {
      smsSendSingle(refMob,
        (refOffer.invRef.role || '') + ' محترم شرکت پیشرو تجهیز فرتاک،\n' +
        'درخواست شما جهت صدور فاکتور رسمی (' + offerNo + ') انجام شد. می‌توانید فاکتور را از طریق سامانه مدیریت یکپارچه دانلود نمایید.\nhttps://pishtaj.ir/crm/',
        function (d) { addLog(d.ok && d.sent ? 'پیامک صدور فاکتور به ' + refOffer.invRef.by + ' ارسال شد' : 'پیامک صدور فاکتور در صف قرار گرفت'); });
    } else alert('⚠️ شماره موبایل ارجاع‌دهنده در کاربران ثبت نشده');
  }
  notify({ toRoles: SENIOR_ROLES, title: 'فاکتور ' + no + ' برای ' + offerNo + ' ثبت شد', kind: 'payment', channels: ['cart'], link: { panel: 'recv' } });
}

/* ============ AC4: مطالبات و وصولی‌ها (تحصیلدار/حسابدار) ============ */
function buildReceivables() {
  return '<div class="ph"><h3>💰 مطالبات و وصولی‌ها</h3></div><div id="rcWrap"></div>';
}
function renderReceivables() {
  var el = document.getElementById('rcWrap');
  if (!el) return;
  var invs = getData('ptf_crm_invoices');
  if (!ptfCanSeeLedger('unofficial')) {
    invs = invs.filter(function (i) { return !i.isUnofficial; });
  }
  var offers = getData('ptf_crm_offers');
  var h = '';
  var totalOpen = 0;
  invs.forEach(function (inv) {
    var payRows = (inv.payments || []).concat(inv.pays || []);
    var paid = payRows.reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    var remain = Math.max(0, inv.amount - paid);
    var pct = inv.amount ? Math.min(100, Math.round(paid * 100 / inv.amount)) : 0;
    var o = offers.filter(function (x) { return x.no === inv.offerNo; })[0] || {};
    var fxInfo = '';
    try {
      var sumFx = (typeof ptfFxInvoiceSummary === 'function') ? ptfFxInvoiceSummary(inv, inv.offerNo) : null;
      if (sumFx && sumFx.cur) {
        fxInfo = '<div style="font-size:11px;color:#0e7490;margin-top:4px">📘 منشا سند: ' + escP(sumFx.cur) + ' | وصول ریالی ملاک است' + (sumFx.paidFx ? ' | معادل وصول‌شده: ' + (+sumFx.paidFx).toLocaleString('en-US') + ' ' + escP(sumFx.cur) : '') + (sumFx.remainFx > 0 ? ' | مانده ارزی تقریبی: ' + (+sumFx.remainFx).toLocaleString('en-US') + ' ' + escP(sumFx.cur) : '') + '</div>';
      }
    } catch (eFx) {}
    if (remain > 0) totalOpen += remain;
    var isOverdue = false;
    if (remain > 0 && inv.dueISO && inv.dueISO < new Date().toISOString().slice(0,10)) isOverdue = true;
    var dueBadge = inv.dueFa
      ? '<span class="bd" style="' + (isOverdue ? 'background:#fee2e2;color:#b91c1c;font-weight:bold' : 'background:#e0f2fe;color:#0369a1') + '">📅 سررسید وصول: ' + escP(inv.dueFa) + (isOverdue ? ' (🔴 سررسید گذشته — US-268)' : '') + '</span>'
      : '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#0e7490" onclick="ptfSetInvoiceDue(\'' + inv.cd + '\')">📅 تعیین سررسید وصول</button>';
    var contact = inv.contactApproved
      ? '<div style="font-size:12px;color:#0e7490;margin-top:4px">📞 مسئول پیگیری: ' + escP(inv.contactApproved.nm) + ' — <a href="tel:' + escP(inv.contactApproved.tel) + '" style="direction:ltr">' + escP(inv.contactApproved.tel) + '</a> <small style="color:#94a3b8">(تایید: ' + escP(inv.contactApproved.by) + ')</small></div>'
      : (inv.contactReq
        ? (isSenior()
          ? '<button class="bt" style="padding:3px 9px;font-size:11.5px;margin-top:4px;background:#7c3aed" onclick="approveContact(\'' + inv.cd + '\')">✅ تایید دسترسی تماس (درخواست: ' + escP(inv.contactReq.by) + ')</button>'
          : '<div style="font-size:11.5px;color:#d97706;margin-top:4px">⏳ درخواست دسترسی به اطلاعات تماس در انتظار تایید نقش ارشد</div>')
        : (isSenior() ? '' : '<button class="bt bt-o" style="padding:3px 9px;font-size:11.5px;margin-top:4px" onclick="reqContact(\'' + inv.cd + '\')">🔐 درخواست اطلاعات تماس برای پیگیری</button>'));
    h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
      '<div style="font-size:13px;flex:1;min-width:250px"><b>' + escP(o.buyerCo || inv.buyerCo || '-') + '</b> — فاکتور ' + escP(inv.no) + ' (' + escP(inv.offerNo) + ')' +
      '<div style="margin:6px 0;background:#f1f5f9;border-radius:8px;height:16px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;right:0;top:0;bottom:0;width:' + pct + '%;background:linear-gradient(90deg,#10b981,#34d399)"></div>' +
      '<span style="position:absolute;inset:0;display:grid;place-items:center;font-size:10.5px;font-weight:bold">' + pct + '٪ وصول شد</span></div>' +
      '<div style="font-size:11.5px;color:#64748b">مبلغ فاکتور: ' + (+inv.amount).toLocaleString('fa-IR') + ' ریال | وصولی: ' + paid.toLocaleString('fa-IR') + ' ریال | <b style="color:' + (remain ? '#dc2626' : '#10b981') + '">مانده: ' + remain.toLocaleString('fa-IR') + ' ریال</b>' + ((((o.currency || inv.offerCurrency) && (o.currency || inv.offerCurrency) !== 'IRR')) ? ' <span style="color:#0e7490">| سند مبنا: ' + escP(o.currency || inv.offerCurrency) + ' اما فاکتور ریالی ملاک وصول است</span>' : '') + '</div>' + fxInfo + '<div style="margin-top:5px">' + dueBadge + '</div>' +
      contact + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:5px">' +
      (remain > 0 ? '<button class="bt" style="padding:4px 10px;font-size:12px" onclick="showPayModal(\'' + inv.cd + '\')">+ ثبت وصولی</button>' : '<span class="bd b-st4">✔ تسویه کامل</span>') +
      '</div></div>' +
      (payRows.length ? '<div style="margin-top:6px;font-size:11.5px;color:#475569">' + payRows.map(function (p, pi) {
        var payLabel = p.status === 'reversal' ? '↩ ابطال وصولی' : (p.voided ? '⛔ وصولی ابطال‌شده' : (p.how || (p.fx ? 'تسعیر ارزی' : '-')));
        var payAction = (!p.voided && p.status !== 'reversal' && typeof window.ptfCanInvoicePayVoid === 'function' && window.ptfCanInvoicePayVoid())
          ? ' <button class="bt bt-o" style="padding:1px 6px;font-size:10px;color:#dc2626" onclick="ptfInvoicePayVoidPrompt(\'' + escP(inv.cd) + '\',\'' + escP(p.cd || pi) + '\')">ابطال</button>' : '';
        return '◽ ' + escP(p.t) + ' — ' + (+p.amt).toLocaleString('fa-IR') + ' ریال (' + escP(payLabel) + ') ثبت: ' + escP(p.by) + payAction + (p.voidReason ? ' <small>— دلیل: ' + escP(p.voidReason) + '</small>' : '') + (p.fx && p.fx.cur ? ' <small style="color:#0e7490">| معادل ' + (+p.fx.fxAmt || 0).toLocaleString('en-US') + ' ' + escP(p.fx.cur) + ' @ ' + (+p.fx.rate || 0).toLocaleString('fa-IR') + '</small>' : '');
      }).join('<br>') + '</div>' : '') +
      '</div>';
  });
  var totalOverdue = 0;
  invs.forEach(function(x){ var _p = ((x.payments||[]).concat(x.pays||[])).reduce(function(s,p){return s+(+p.amt||0);},0); if (x.amount-_p > 0 && x.dueISO && x.dueISO < new Date().toISOString().slice(0,10)) totalOverdue += (x.amount-_p); });
  var head = '<div style="background:#fff8f5;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:13.5px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><span>جمع مطالبات باز: <b style="color:#dc2626">' + totalOpen.toLocaleString('fa-IR') + ' ریال</b></span>' + (totalOverdue ? '<span style="color:#b91c1c;font-weight:bold">🔴 سررسید گذشته: ' + totalOverdue.toLocaleString('fa-IR') + ' ریال</span>' : '') + '</div>';
  el.innerHTML = (invs.length ? head : '') + (h || '<div style="text-align:center;color:#94a3b8;padding:24px">فاکتوری ثبت نشده</div>');
}
function showPayModal(invCd) {
  var inv = getData('ptf_crm_invoices').filter(function (i) { return i.cd === invCd; })[0] || {};
  var ofr = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {};
  var invCur = ofr.currency || inv.offerCurrency || 'IRR';
  var fxMsg = (invCur && invCur !== 'IRR') ? '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:7px 11px;font-size:11.5px;color:#1e40af;margin-bottom:8px">💱 این درخواست ماهیتاً ' + escP(invCur) + ' داشته، اما بعد از صدور فاکتور <b>ملاک وصول = مبلغ ریالی فاکتور</b> است.</div>' : '';
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:460px">' +
    '<h3>💵 ثبت وصولی</h3>' + fxMsg +
    '<div class="fr"><div class="fld"><label>مبلغ (ریال) *</label><input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="nPayAmt" style="direction:ltr"></div>' +
    '<div class="fld"><label>روش</label><select id="nPayHow" onchange="var w=document.getElementById(\'nPayChWrap\');if(w)w.style.display=this.value===\'چک\'?\'block\':\'none\'"><option>حواله بانکی</option><option>چک</option><option>نقد</option><option>سایر</option></select></div></div>' +
    '<div id="nPayChWrap" style="display:none;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 10px;margin-top:6px">' +
    '<div class="fr"><div class="fld"><label>شماره / صیادی چک *</label><input id="nPayChNo" dir="ltr" style="direction:ltr"></div>' +
    '<div class="fld"><label>سررسید (شمسی یا میلادی)</label><input id="nPayChDue" dir="ltr" style="direction:ltr" placeholder="1405/06/30"></div></div>' +
    '<div class="fld"><label>بانک / شعبه</label><input id="nPayChBank"></div>' +
    '<small style="color:#0369a1">این چک به‌عنوان «چک وارده» در ماژول چک ثبت و پیگیری می‌شود.</small></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="savePay(\'' + invCd + '\')">ثبت</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}
function savePay(invCd) {
  var amt = ptfNum(document.getElementById('nPayAmt').value);
  if (!amt) { alert('مبلغ الزامی است'); return; }
  var invs = getData('ptf_crm_invoices');
  var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
  if (!inv) return;
  var invYear = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(inv.invDate || inv.dateISO || inv.t || '') : ((String(inv.invDate || inv.dateISO || inv.t || '').match(/(13|14)\d{2}/) || [])[0] || '');
  if (invYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(invYear)) { alert('🔒 سال مالی ' + invYear + ' قفل است؛ ثبت وصولی مستقیم در آن سال مجاز نیست.'); return; }
  var paid = ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
  if (paid + amt > inv.amount) { alert('مبلغ از مانده فاکتور بیشتر است (مانده: ' + (inv.amount - paid).toLocaleString('fa-IR') + ')'); return; }
  inv.payments = inv.payments || [];
  var payRec = { cd: genCode('RPAY'), amt: amt, how: document.getElementById('nPayHow').value, t: faDate(), by: curSession().name, status: 'posted' };
  /* CHQ-MOD-001 (گام ۴): اگر روش «چک» است، چک وارده ساخته و به وصولی لینک می‌شود */
  if (payRec.how === 'چک' && typeof window.ptfChequeCreate === 'function') {
    var chNo = ((document.getElementById('nPayChNo') || {}).value || '').trim();
    if (!chNo) { alert('⚠️ برای وصول با چک، شماره/شناسه صیادی الزامی است.'); return; }
    var due = ((document.getElementById('nPayChDue') || {}).value || '').trim();
    var buyerCo = ofr.buyerCo || '';
    var ch = window.ptfChequeCreate('received', {
      no: chNo, sayad: chNo, amt: amt, bank: ((document.getElementById('nPayChBank') || {}).value || '').trim(),
      dueISO: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '',
      dueFa: /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(due) ? due : '',
      payerName: buyerCo || ofr.buyerCd || '', sourceCustomerCd: ofr.buyerCd || '', sourceInvoiceCd: invCd,
      invoiceCd: invCd, receiptCd: payRec.cd, kind: 'finance', ownership: 'received', st: 'open'
    });
    payRec.chequeCd = ch.cd;
  }
  inv.payments.push(payRec);
  setData('ptf_crm_invoices', invs);
  hideModal(); renderReceivables();
  audit('وصولی', 'ثبت وصولی ' + amt.toLocaleString('fa-IR') + ' برای فاکتور ' + inv.no, inv.no);
  var newPaid = paid + amt;
  if (newPaid >= inv.amount) notify({ toRoles: SENIOR_ROLES, title: '✅ فاکتور ' + inv.no + ' تسویه کامل شد', kind: 'payment', channels: ['cart'] });
}

/* FIN-WF-006 / FIN-EX-03: ابطال وصولی مشتری بدون حذف فاکتور.
   اصلاح به‌صورت یک رویداد منفی ثبت می‌شود تا مانده و تاریخچه هر دو قابل ردیابی بمانند. */
window.ptfCanInvoicePayVoid = function () {
  var r = typeof curRole === 'function' ? curRole() : '';
  return ['admin', 'chairman', 'ceo', 'commercial', 'accountant', 'collector'].indexOf(r) > -1;
};
window.ptfInvoicePayVoid = function (invCd, payRef, reason) {
  if (!ptfCanInvoicePayVoid()) return { ok: false, why: 'role' };
  var invs = getData('ptf_crm_invoices');
  var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
  if (!inv) return { ok: false, why: 'invoice' };
  var rawDate = String(inv.invDate || inv.dateISO || inv.t || '');
  var ym = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(rawDate) : ((rawDate.match(/(13|14)\d{2}/) || [])[0] || '');
  if (ym && (getData('ptf_crm_fiscal_snapshots') || []).some(function (s) { return s && s.locked && String(s.year) === ym; })) return { ok: false, why: 'locked', year: ym };
  var rows = (inv.payments || []).concat(inv.pays || []);
  var idx = -1;
  rows.some(function (p, i) {
    if (String(p.cd || '') === String(payRef) || String(i) === String(payRef)) { idx = i; return true; }
    return false;
  });
  if (idx < 0) return { ok: false, why: 'payment' };
  var p = rows[idx];
  if (p.status === 'reversal' || p.voided) return { ok: false, why: 'already' };
  reason = String(reason || '').trim();
  if (!reason) return { ok: false, why: 'reason' };
  var realPayments = inv.payments || [];
  var realIdx = realPayments.indexOf(p);
  if (realIdx < 0) return { ok: false, why: 'legacy' };
  var reversal = { cd: genCode('RPVOID'), amt: -(+p.amt || 0), how: 'ابطال وصولی', t: faDate(), by: curSession().name, status: 'reversal', voidRef: p.cd || String(payRef), voidReason: reason };
  p.voided = true; p.voidedAt = faDateTime(); p.voidedBy = curSession().name; p.voidReason = reason; p.reversalCd = reversal.cd;
  realPayments.push(reversal);
  setData('ptf_crm_invoices', invs);
  try { audit('وصولی', 'ابطال وصولی ' + (p.cd || payRef) + ' برای فاکتور ' + inv.no + ' — دلیل: ' + reason, reversal.cd); } catch (e) {}
  return { ok: true, reversalCd: reversal.cd };
};
window.ptfInvoicePayVoidPrompt = function (invCd, payRef) {
  var reason = prompt('دلیل ابطال این وصولی را وارد کنید:', 'اشتباه ثبت');
  if (reason === null) return;
  var res = ptfInvoicePayVoid(invCd, payRef, reason);
  var msg = { role: '⛔ نقش شما مجاز به ابطال وصولی نیست.', invoice: '⛔ فاکتور پیدا نشد.', payment: '⛔ وصولی پیدا نشد.', already: '⛔ این وصولی قبلاً ابطال شده است.', reason: '⛔ دلیل ابطال الزامی است.', legacy: '⛔ رکورد legacy بدون آرایهٔ قابل اصلاح است.', locked: '🔒 سال مالی ' + (res.year || '') + ' قفل است؛ ابطال مستقیم مجاز نیست.' };
  if (!res.ok) { alert(msg[res.why] || '⛔ ابطال انجام نشد'); return; }
  renderReceivables();
  if (typeof ptfToast === 'function') ptfToast('ابطال وصولی ثبت شد و ماندهٔ فاکتور بازسازی شد', 'ok');
};

/* فاز ۲ / گام ۷ (crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md بند ۱۱):
   ابطال فاکتور فروش رسمی — نرم (status:'void')، نه حذف فیزیکی؛ رکورد برای
   ردپای audit حفظ می‌شود اما در همه‌ی گزارش‌ها/لیست‌ها (renderInvoices،
   renderReceivables، customer-finance.js، fiscal.js، working-capital.js،
   commission.js، ...) فیلتر می‌شود چون همگی status!=='void' را چک می‌کنند. */
window.ptfInvoiceVoid = function (invCd) {
  if (!isSenior()) { alert('⛔ ابطال فاکتور فروش رسمی فقط برای مدیران ارشد مجاز است'); return; }
  var invs = getData('ptf_crm_invoices');
  var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
  if (!inv) { alert('⛔ فاکتور یافت نشد'); return; }
  if (inv.status === 'void') { alert('این فاکتور قبلاً ابطال شده است'); return; }
  var paidSum = ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
  if (paidSum > 0) { alert('⛔ این فاکتور دارای وصولی است؛ ابتدا وصولی‌ها را ابطال کنید یا از سند اصلاحی سال مالی استفاده کنید.'); return; }
  var invYear = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(inv.invDate || inv.t || '') : ((String(inv.invDate || inv.t || '').match(/(13|14)\d{2}/) || [])[0] || '');
  if (invYear && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(invYear)) { alert('🔒 سال مالی ' + invYear + ' قفل است؛ ابطال فاکتور در آن سال مجاز نیست. از سند اصلاحی استفاده کنید.'); return; }
  var reason = prompt('دلیل ابطال فاکتور «' + inv.no + '» را وارد کنید:', 'اشتباه ثبت');
  if (reason === null) return;
  if (!reason.trim()) { alert('⛔ دلیل ابطال الزامی است'); return; }
  inv.status = 'void'; inv.voidAt = faDateTime(); inv.voidBy = curSession().name; inv.voidReason = reason.trim();
  setData('ptf_crm_invoices', invs);
  try { audit('فاکتور', 'ابطال فاکتور ' + inv.no + ' — ' + (inv.amount || 0).toLocaleString('fa-IR') + ' ریال — دلیل: ' + reason.trim(), inv.cd); } catch (e) {}
  renderInvoices();
  if (typeof ptfToast === 'function') ptfToast('فاکتور ابطال شد', 'ok');
};

// درخواست/تایید دسترسی تماس (AC4)
function reqContact(invCd) {
  var invs = getData('ptf_crm_invoices');
  invs.forEach(function (i) { if (i.cd === invCd) i.contactReq = { by: curSession().name, t: faDate() }; });
  setData('ptf_crm_invoices', invs);
  renderReceivables();
  notify({ toRoles: SENIOR_ROLES, title: 'درخواست دسترسی به اطلاعات تماس برای پیگیری مطالبات', body: 'درخواست‌کننده: ' + curSession().name, kind: 'contact_req', channels: ['cart'], link: { panel: 'recv' }, actionable: true });
  audit('مطالبات', 'درخواست دسترسی اطلاعات تماس', invCd);
}
function approveContact(invCd) {
  if (!isSenior()) { alert('فقط نقش‌های ارشد می‌توانند تایید کنند'); return; }
  var invs = getData('ptf_crm_invoices');
  var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
  if (!inv || !inv.contactReq) return;
  var o = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0];
  var cust = o ? getData('ptf_crm_customers').filter(function (c) { return c.cd === o.buyerCd; })[0] : null;
  var pp = cust ? primaryPerson(cust) : null;
  var nm = prompt('نام شخص مجاز برای پیگیری:', pp ? pp.nm : '');
  if (!nm) return;
  var tel = prompt('شماره تماس:', pp && pp.tels && pp.tels.length ? pp.tels[0].n : (pp && pp.mobs && pp.mobs.length ? pp.mobs[0].n : ''));
  if (!tel) return;
  inv.contactApproved = { nm: nm, tel: tel, by: curSession().name, t: faDate() };
  delete inv.contactReq;
  setData('ptf_crm_invoices', invs);
  renderReceivables();
  audit('مطالبات', 'تایید دسترسی تماس (' + nm + ') برای فاکتور ' + inv.no, invCd);
  notify({ toRoles: ['accountant', 'collector'], title: 'دسترسی تماس برای پیگیری فاکتور ' + inv.no + ' تایید شد', kind: 'contact_ok', channels: ['cart'], link: { panel: 'recv' } });
}


/* ============ US-124 AC6: نمای درخواست‌های دارای اقلام ============ */
function buildInquiries() {
  return '<div class="ph"><h3>📋 درخواست‌های دارای اقلام (Inquiry)</h3></div><div id="inqWrap"></div>';
}
function renderInquiries() {
  var el = document.getElementById('inqWrap');
  if (!el) return;
  var iq = getData('ptf_crm_inqitems');
  var offers = getData('ptf_crm_offers');
  var groups = {};
  iq.forEach(function (r) {
    groups[r.inqNo] = groups[r.inqNo] || { items: 0, t: r.t };
    groups[r.inqNo].items++;
  });
  var keys = Object.keys(groups);
  if (!keys.length) { el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px">درخواستی ثبت نشده — در ماژول کالاها، اکسل را با شماره درخواست ایمپورت کنید</div>'; return; }
  var h = '<div class="tb2"><table><thead><tr><th>شماره درخواست</th><th>اقلام</th><th>تاریخ ایمپورت</th><th>وضعیت پیشنهاد</th></tr></thead><tbody>';
  keys.forEach(function (k) {
    var to = offers.filter(function (o) { return o.inqNo === k && o.kind === 'TO'; })[0];
    var co = offers.filter(function (o) { return o.inqNo === k && o.kind === 'CO'; })[0];
    var st = co ? '💰 CO صادر شده (' + co.no + ')' : to ? '🔧 TO صادر شده (' + to.no + ')' : '<span style="color:#d97706">⏳ بدون پیشنهاد</span>';
    h += '<tr><td><b>' + escP(k) + '</b></td><td>' + groups[k].items + '</td><td>' + escP(groups[k].t || '-') + '</td><td>' + st + '</td></tr>';
  });
  el.innerHTML = h + '</tbody></table></div>';
}

/* ============ US-116: پرونده فروش (Deal) — چرخه پس از فروش ============ */
function buildDeals() {
  return '<div class="ph"><h3>📁 پرونده‌های فروش (پس از ابلاغ سفارش)</h3>' +
    '<div class="sb2"><button class="bt" onclick="showDealModal()">+ پرونده از CO برنده</button></div></div>' +
    '<div id="dealWrap"></div>';
}
function renderDeals() {
  var el = document.getElementById('dealWrap');
  if (!el) return;
  var deals = getData('ptf_crm_deals');
  var h = '';
  deals.forEach(function (d) {
    var steps = ['won', 'ship', 'invoice', 'settle'];
    var stepLb = { won: 'ابلاغ سفارش', ship: 'تحویل/ارسال', invoice: 'فاکتور', settle: 'تسویه' };
    var flow = steps.map(function (s) {
      var ev = (d.events || []).filter(function (e) { return e.step === s; })[0];
      return '<span style="padding:3px 10px;border-radius:9px;font-size:11px;' +
        (ev ? 'background:#ecfdf5;color:#047857;border:1px solid #10b981' : 'background:#f1f5f9;color:#94a3b8') + '">' +
        (ev ? '✓ ' : '') + stepLb[s] + (ev ? ' — ' + ev.t : '') + '</span>';
    }).join(' ← ');
    h += '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<div style="font-size:13px"><b>' + escP(d.cd) + '</b> — ' + escP(d.buyerCo || '-') +
      (d.formal === false ? ' <span class="bd" style="background:#fef3c7;color:#b45309">غیررسمی</span>' : '') +
      '<div style="font-size:11px;color:#64748b;margin:4px 0">CO مبدا: ' + escP(d.offerNo || '-') + ' | ایجاد: ' + escP(d.t) + '</div>' +
      '<div style="margin-top:6px">' + flow + '</div></div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
      '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="dealAddEvent(\'' + d.cd + '\',\'ship\')">🚚 ثبت ارسال</button>' +
      (d.formal !== false ? '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="dealAddEvent(\'' + d.cd + '\',\'invoice\')">🧾 فاکتور</button>' : '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="dealAddEvent(\'' + d.cd + '\',\'invoice\')">🧾 رسید داخلی</button>') +
      '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="dealAddEvent(\'' + d.cd + '\',\'settle\')">💵 تسویه</button>' +
      '</div></div>' +
      ((d.events || []).length ? '<div style="margin-top:8px;font-size:11.5px;color:#475569;border-top:1px dashed var(--brd);padding-top:6px">' +
        d.events.map(function (e) {
          return '◽ <b>' + (e.step === 'ship' ? '🚚 ارسال' : e.step === 'invoice' ? '🧾 ' + (d.formal === false ? 'رسید ' + escP(e.intNo || '') : 'فاکتور ' + escP(e.no || '')) : e.step === 'settle' ? '💵 تسویه' : 'ابلاغ') + '</b> — ' + escP(e.t) + ' — ' + escP(e.by || '') +
            (e.note ? ' | ' + escP(e.note) : '') +
            (e.waybill ? ' | بیجک/بارنامه: ' + escP(e.waybill) + (e.carrier ? ' (' + escP(e.carrier) + ')' : '') : '') +
            ((e.files || []).length ? ' | ' + e.files.map(function (f) { return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + escP(f.key || '') + '\')" style="color:#0e7490">📎' + escP(f.name) + '</a>'; }).join(' ') : '');
        }).join('<br>') + '</div>' : '') +
      '</div>';
  });
  el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">پرونده‌ای نیست — از CO برنده پرونده بسازید</div>';
}

function showDealModal() {
  var cos = getData('ptf_crm_offers').filter(function (o) { return o.kind === 'CO' && o.st === 'won'; });
  if (!cos.length) { alert('هیچ CO برنده‌ای وجود ندارد.\nابتدا در ماژول پیشنهادها وضعیت CO را «برنده» کنید.'); return; }
  var opts = cos.map(function (o) { return '<option value="' + escP(o.no) + '">' + escP(o.no) + ' — ' + escP(o.buyerCo || '') + '</option>'; }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:480px">' +
    '<h3>📁 تشکیل پرونده فروش</h3>' +
    '<div class="fld"><label>CO برنده</label><select id="nDlCo">' + opts + '</select></div>' +
    '<div class="fld"><label>نوع فروش</label><select id="nDlFormal"><option value="1">رسمی (با فاکتور)</option><option value="0">غیررسمی (بدون فاکتور — رسید داخلی)</option></select></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveDeal()">تشکیل پرونده</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}
function saveDeal() {
  var no = document.getElementById('nDlCo').value;
  var formal = document.getElementById('nDlFormal').value === '1';
  var o = getData('ptf_crm_offers').filter(function (x) { return x.no === no; })[0];
  var deals = getData('ptf_crm_deals');
  if (deals.filter(function (d) { return d.offerNo === no; }).length) { alert('برای این CO قبلاً پرونده ساخته شده'); return; }
  deals.unshift({ cd: genCode('DEAL'), offerNo: no, buyerCo: o ? o.buyerCo : '', formal: formal,
    t: faDate(), by: curSession().name, events: [{ step: 'won', t: faDate(), by: curSession().name }] });
  setData('ptf_crm_deals', deals);
  hideModal(); renderDeals();
  audit('پرونده فروش', 'تشکیل پرونده برای ' + no + (formal ? ' (رسمی)' : ' (غیررسمی)'), no);
}

function dealAddEvent(cd, step) {
  var deals = getData('ptf_crm_deals');
  var d = deals.filter(function (x) { return x.cd === cd; })[0];
  if (!d) return;
  function commit(ev) {
    d.events = d.events || [];
    d.events.push(ev);
    setData('ptf_crm_deals', deals);
    renderDeals();
    audit('پرونده فروش', 'ثبت مرحله ' + step + ' برای ' + cd, cd);
    if (typeof ptfToast === 'function') ptfToast('مرحله ثبت شد', 'ok');
  }
  var base = { step: step, t: faDate(), by: curSession().name };
  // US-153: مودال استاندارد به‌جای prompt های زنجیره‌ای
  if (typeof ptfDialog !== 'function') { commit(base); return; }
  if (step === 'ship') {
    ptfDialog({
      title: '🚚 ثبت ارسال / تحویل',
      fields: [
        { id: 'wtype', label: 'نوع ارسال', type: 'select', options: [
          { v: '1', lb: 'ارسال توسط ما (بیجک/بارنامه)' }, { v: '2', lb: 'تحویل درب انبار' }, { v: '3', lb: 'حمل توسط خریدار' }] },
        { id: 'waybill', label: 'شماره بیجک/بارنامه (برای ارسال توسط ما)', dir: 'ltr' },
        { id: 'carrier', label: 'نام باربری (اختیاری)' }
      ],
      onOk: function (v) {
        var ev = base;
        if (v.wtype === '1') { ev.waybill = v.waybill; ev.carrier = v.carrier; ev.note = 'ارسال توسط شرکت'; }
        else ev.note = v.wtype === '2' ? 'تحویل درب انبار' : 'حمل توسط خریدار';
        commit(ev);
      }
    });
  } else if (step === 'invoice') {
    if (d.formal === false) {
      base.intNo = 'PTF-INT-' + Math.floor(100 + Math.random() * 900);
      base.note = 'رسید فروش داخلی (غیررسمی)';
      commit(base);
    } else {
      ptfDialog({
        title: '🧾 ثبت فاکتور پرونده',
        fields: [{ id: 'no', label: 'شماره فاکتور حسابداری', required: true, dir: 'ltr' }],
        onOk: function (v) { base.no = v.no; commit(base); }
      });
    }
  } else if (step === 'settle') {
    ptfDialog({
      title: '💵 ثبت تسویه',
      fields: [{ id: 'note', label: 'توضیح تسویه (اختیاری)', type: 'textarea', rows: 2 }],
      onOk: function (v) { base.note = v.note; commit(base); }
    });
  } else commit(base);
}

/* ============ اعمال RBAC روی UI ============ */
var PANEL_IDS = ['dash', 'rfq', 'sup', 'cust', 'leads', 'rem', 'prod', 'off', 'orders', 'fin', 'users', 'set', 'buyq', 'inv', 'recv', 'cart'];
function applyRbac() {
  var r = roleDef();
  document.querySelectorAll('.sb-i').forEach(function (btn) {
    var oc = btn.getAttribute('onclick') || '';
    var m = oc.match(/goPanel\('([a-z]+)'/);
    if (!m) return;
    var id = m[1];
    // orders و fin = گزارش مالی/سود
    var allowed;
    if (id === 'orders' || id === 'fin') allowed = r.finance;
    else if (id === 'users' || id === 'set') allowed = r.users || (r.panels === '*' && id === 'set');
    else allowed = canPanel(id);
    btn.style.display = allowed ? '' : 'none';
  });
  // پنل پیش‌فرض نقش‌های محدود
  if (r.panels !== '*' && r.panels.indexOf('dash') < 0) {
    setTimeout(function () { goPanelByName(r.panels[0]); }, 200);
  }
}

/* ============ اتصال به روتینگ اصلی ============ */
(function () {
  // پنل‌های جدید به goPanel اضافه می‌شوند (منکی‌پچ)
  var _goPanel = window.goPanel;
  window.goPanel = function (id, btn) {
    // گارد دسترسی (AC6 سمت کلاینت؛ گارد سرور در api/crm.php فاز بعد)
    var r = roleDef();
    var allowed;
    if (id === 'orders' || id === 'fin') allowed = r.finance;
    else if (id === 'users') allowed = r.users;
    else allowed = canPanel(id) || id === 'set';
    if (!allowed) { alert('⛔ نقش «' + r.lb + '» به این بخش دسترسی ندارد'); return; }
    if (id === 'cart' || id === 'buyq' || id === 'inv' || id === 'recv' || id === 'inqs' || id === 'deals') {
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      var titles = { cart: '🗂 کارتابل', buyq: '🛒 قیمت‌های خرید', inv: '🧾 فاکتورها', recv: '💰 مطالبات', inqs: '🧾 اقلام درخواست‌ها', deals: '📁 پرونده‌های فروش' };
      document.getElementById('pgTitle').textContent = titles[id];
      /* v13.2 (US-322): پرونده‌های فروش v2 در salesfiles.js — override پنجره‌ای مقدم است */
      var builders = { cart: buildCartable, buyq: buildBuyQuotes, inv: buildInvoices, recv: buildReceivables, inqs: buildInquiries, deals: (window.buildDeals || buildDeals) };
      document.getElementById('panels').innerHTML = builders[id]();
      var renders = { cart: renderCartable, buyq: renderBuyQuotes, inv: renderInvoices, recv: renderReceivables, inqs: renderInquiries, deals: (window.renderDeals || renderDeals) };
      renders[id]();
      return;
    }
    _goPanel(id, btn);
  };
  // بازنویسی مدیریت کاربران
  if (typeof renderUsers === 'function') window.renderUsers = renderUsers2;
  // دکمه + کاربر جدید → مودال جدید
  var _showModal = window.showModal;
  window.showModal = function (id) {
    if (id === 'uMd') { showUserModal2(); return; }
    _showModal(id);
  };
  // اعمال دسترسی پس از ورود
  var _showCrm = window.showCrm;
  window.showCrm = function () {
    _showCrm();
    setTimeout(function () { applyRbac(); updateCartBadge(); }, 300);
  };
  // اگر از قبل لاگین است
  setTimeout(function () {
    if (document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none') {
      applyRbac(); updateCartBadge();
    }
  }, 500);
})();


window.ptfSetInvoiceDue = function (invCd) {
  var invs = getData('ptf_crm_invoices');
  var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
  if (!inv) return;
  ptfDialog({
    title: '📅 تعیین تاریخ سررسید وصول مطالبات — فاکتور ' + escP(inv.no),
    fields: [
      { id: 'dueFa', label: 'تاریخ سررسید (شمسی) *', type: 'text', value: inv.dueFa || '', placeholder: 'مثلا: 1405/05/15', dir: 'ltr', required: true },
      { id: 'dueISO', label: 'تاریخ میلادی معادل (اختیاری)', type: 'date', value: inv.dueISO || '', dir: 'ltr' }
    ],
    okText: 'ثبت سررسید',
    onOk: function (v) {
      var dueFa = (v.dueFa || '').trim();
      if (!dueFa) { alert('تاریخ سررسید الزامی است'); return; }
      inv.dueFa = dueFa;
      inv.dueISO = (v.dueISO || '').trim() || (typeof ptfJToISO === 'function' ? ptfJToISO(dueFa) : '');
      setData('ptf_crm_invoices', invs);
      audit('مطالبات', 'ثبت سررسید وصول فاکتور ' + inv.no + ' برای تاریخ ' + dueFa, inv.cd);
      if (typeof ptfToast === 'function') ptfToast('📅 تاریخ سررسید وصول مطالبات ثبت شد', 'ok');
      renderReceivables();
    }
  });
};

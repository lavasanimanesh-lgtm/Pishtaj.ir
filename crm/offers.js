/* =====================================================================
   PTF CRM — Sprint 56
   US-117: دفترچه تماس چندنفره (کارفرمایان + تامین‌کنندگان)
   US-110v2: Technical / Commercial Offer (فاز ۱)
   ===================================================================== */

/* ---------- US-117: CONTACTS BOOK ---------- */

// مهاجرت خودکار داده قدیمی (AC6): con/ph تکی → اولین شخص رابط
function migrateContacts() {
  ['ptf_crm_customers', 'ptf_crm_suppliers'].forEach(function(key) {
    var items = getData(key), changed = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.people) {
        it.people = [];
        var legacyName = it.con || it.nm || '';
        var legacyPhone = it.ph || '';
        if (legacyName || legacyPhone) {
          it.people.push({ nm: legacyName || '—', role: 'رابط اصلی', dept: '',
            tels: legacyPhone ? [{ n: legacyPhone, ext: '', lb: '' }] : [],
            mobs: [], mails: [], note: '', primary: true });
        }
        it.coTels = it.coTels || [];
        it.coMail = it.coMail || '';
        it.coWeb = it.coWeb || '';
        it.coAddr = it.coAddr || '';
        changed = true;
      }
    }
    if (changed) setData(key, items);
  });
}

function primaryPerson(entity) {
  if (!entity || !entity.people || !entity.people.length) return null;
  for (var i = 0; i < entity.people.length; i++)
    if (entity.people[i].primary) return entity.people[i];
  return entity.people[0];
}

function fmtTel(t) { return t.n + (t.ext ? ' داخلی ' + t.ext : ''); }
function telHref(t) { return 'tel:' + t.n.replace(/[^+\d]/g, '') + (t.ext ? ',' + t.ext : ''); }

// ---- UI دفترچه اشخاص (داخل مودال کارفرما/تامین‌کننده) ----
var _cbState = null; // {people:[...]} حالت موقت فرم

/* v34.37.7 (CONTACT-WIPE): دفترچه تماس بدون آرایهٔ tels/mobs/mails نباید رندر را
   بترکاند و شخص بی‌نام با شماره نباید هنگام جمع‌آوری دور ریخته شود. */
function cbEnsurePerson(p) {
  p = p || {};
  if (!Array.isArray(p.tels)) p.tels = [];
  if (!Array.isArray(p.mobs)) p.mobs = [];
  if (!Array.isArray(p.mails)) p.mails = [];
  return p;
}
function cbPersonHasContact(p) {
  if (!p) return false;
  if (p.nm && String(p.nm).trim()) return true;
  function has(arr) {
    return (arr || []).some(function (x) { return x && String(x.n || '').trim(); });
  }
  return has(p.tels) || has(p.mobs) || has(p.mails);
}
function ptfMergeExtraCoTels(oldRec, tel) {
  var extra = ((oldRec && Array.isArray(oldRec.coTels)) ? oldRec.coTels : []).slice(1);
  var first = oldRec && oldRec.coTels && oldRec.coTels[0] ? oldRec.coTels[0] : null;
  return (tel ? [{ n: tel, ext: (first && first.ext) || '', lb: (first && first.lb) || 'تلفنخانه' }] : []).concat(extra);
}
window.cbEnsurePerson = cbEnsurePerson;
window.cbPersonHasContact = cbPersonHasContact;
window.ptfMergeExtraCoTels = ptfMergeExtraCoTels;

function cbInit(people) {
  _cbState = { people: JSON.parse(JSON.stringify(people || [])) };
  _cbState.people.forEach(cbEnsurePerson);
  if (!_cbState.people.length) cbAddPerson();
}

function cbAddPerson() {
  _cbState.people.push({ nm: '', nmEn: '', role: '', dept: '', tels: [], mobs: [], mails: [], note: '', primary: _cbState.people.length === 0 });
  cbRender();
}

function cbDelPerson(pi) {
  _cbState.people.splice(pi, 1);
  if (_cbState.people.length && !_cbState.people.some(function(p){return p.primary}))
    _cbState.people[0].primary = true;
  cbRender();
}

function cbSetPrimary(pi) {
  _cbState.people.forEach(function(p, i) { p.primary = (i === pi); });
  cbRender();
}

function cbAddCh(pi, kind) {
  var p = _cbState && _cbState.people && _cbState.people[pi];
  if (!p) return;
  cbEnsurePerson(p);
  p[kind].push(kind === 'tels' ? { n: '', ext: '', lb: '' } : { n: '', lb: '' });
  cbRender();
}
function cbDelCh(pi, kind, ci) {
  var p = _cbState && _cbState.people && _cbState.people[pi];
  if (!p) return;
  cbEnsurePerson(p);
  (p[kind] || []).splice(ci, 1);
  cbRender();
}
function cbUpd(pi, field, val) { if (_cbState && _cbState.people && _cbState.people[pi]) _cbState.people[pi][field] = val; }
function cbUpdCh(pi, kind, ci, field, val) {
  var p = _cbState && _cbState.people && _cbState.people[pi];
  if (!p) return;
  cbEnsurePerson(p);
  if (p[kind] && p[kind][ci]) p[kind][ci][field] = val;
}

function cbRender() {
  var el = document.getElementById('cbWrap');
  if (!el) return;
  var h = '';
  var ROLES = ['مدیر خرید','کارشناس خرید','مدیر فنی','کارشناس فنی','مدیر بازرگانی','مالی','مدیرعامل','رابط اصلی','سایر'];
  _cbState.people.forEach(function(p, pi) {
    cbEnsurePerson(p);
    var roleOpts = ROLES.map(function(r){ return '<option'+(p.role===r?' selected':'')+'>'+r+'</option>'; }).join('');
    h += '<div style="border:1px solid var(--brd);border-radius:14px;padding:12px;margin-bottom:10px;background:'+(p.primary?'#fff8f5':'#fafbfc')+'">' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">' +
      '<input type="text" placeholder="نام شخص *" value="'+escP(p.nm)+'" oninput="cbUpd('+pi+',\'nm\',this.value)" style="flex:1;min-width:110px;padding:7px;border:1px solid var(--brd);border-radius:8px">' +
      '<input type="text" placeholder="Mr./Ms. English" value="'+escP(p.nmEn||'')+'" oninput="cbUpd('+pi+',\'nmEn\',this.value)" style="flex:1;min-width:100px;padding:7px;border:1px solid var(--brd);border-radius:8px;direction:ltr">' +
      '<select onchange="cbUpd('+pi+',\'role\',this.value)" style="padding:7px;border:1px solid var(--brd);border-radius:8px">'+roleOpts+'</select>' +
      '<input type="text" placeholder="واحد" value="'+escP(p.dept)+'" oninput="cbUpd('+pi+',\'dept\',this.value)" style="width:90px;padding:7px;border:1px solid var(--brd);border-radius:8px">' +
      '<label style="font-size:11px;white-space:nowrap;cursor:pointer"><input type="radio" name="cbPrim" '+(p.primary?'checked':'')+' onclick="cbSetPrimary('+pi+')"> اصلی</label>' +
      (_cbState.people.length > 1 ? '<button type="button" onclick="cbDelPerson('+pi+')" style="border:0;background:none;color:#dc2626;cursor:pointer;font-size:15px">🗑️</button>' : '') +
      '</div>';
    // تلفن‌های ثابت با داخلی
    (p.tels || []).forEach(function(t, ci) {
      h += '<div style="display:flex;gap:6px;margin-bottom:5px;align-items:center">' +
        '<span style="font-size:13px">☎️</span>' +
        '<input type="text" placeholder="تلفن ثابت" value="'+escP(t.n)+'" oninput="cbUpdCh('+pi+',\'tels\','+ci+',\'n\',this.value)" style="flex:1;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr">' +
        '<input type="text" placeholder="داخلی" value="'+escP(t.ext)+'" oninput="cbUpdCh('+pi+',\'tels\','+ci+',\'ext\',this.value)" style="width:64px;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr">' +
        '<input type="text" placeholder="برچسب" value="'+escP(t.lb)+'" oninput="cbUpdCh('+pi+',\'tels\','+ci+',\'lb\',this.value)" style="width:84px;padding:6px;border:1px solid var(--brd);border-radius:8px">' +
        '<button type="button" onclick="cbDelCh('+pi+',\'tels\','+ci+')" style="border:0;background:none;color:#94a3b8;cursor:pointer">✕</button></div>';
    });
    (p.mobs || []).forEach(function(t, ci) {
      h += '<div style="display:flex;gap:6px;margin-bottom:5px;align-items:center"><span style="font-size:13px">📱</span>' +
        '<input type="text" placeholder="موبایل" value="'+escP(t.n)+'" oninput="cbUpdCh('+pi+',\'mobs\','+ci+',\'n\',this.value)" style="flex:1;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr">' +
        '<input type="text" placeholder="برچسب" value="'+escP(t.lb)+'" oninput="cbUpdCh('+pi+',\'mobs\','+ci+',\'lb\',this.value)" style="width:84px;padding:6px;border:1px solid var(--brd);border-radius:8px">' +
        '<button type="button" onclick="cbDelCh('+pi+',\'mobs\','+ci+')" style="border:0;background:none;color:#94a3b8;cursor:pointer">✕</button></div>';
    });
    (p.mails || []).forEach(function(t, ci) {
      h += '<div style="display:flex;gap:6px;margin-bottom:5px;align-items:center"><span style="font-size:13px">📧</span>' +
        '<input type="email" placeholder="ایمیل" value="'+escP(t.n)+'" oninput="cbUpdCh('+pi+',\'mails\','+ci+',\'n\',this.value)" style="flex:1;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr">' +
        '<input type="text" placeholder="برچسب" value="'+escP(t.lb)+'" oninput="cbUpdCh('+pi+',\'mails\','+ci+',\'lb\',this.value)" style="width:84px;padding:6px;border:1px solid var(--brd);border-radius:8px">' +
        '<button type="button" onclick="cbDelCh('+pi+',\'mails\','+ci+')" style="border:0;background:none;color:#94a3b8;cursor:pointer">✕</button></div>';
    });
    h += '<div style="display:flex;gap:6px;margin-top:6px">' +
      '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="cbAddCh('+pi+',\'tels\')">+ تلفن</button>' +
      '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="cbAddCh('+pi+',\'mobs\')">+ موبایل</button>' +
      '<button type="button" class="bt bt-o" style="padding:3px 9px;font-size:11.5px" onclick="cbAddCh('+pi+',\'mails\')">+ ایمیل</button>' +
      '</div></div>';
  });
  h += '<button type="button" class="bt bt-o" style="width:100%" onclick="cbAddPerson()">+ افزودن شخص رابط</button>';
  el.innerHTML = h;
}

function cbCollect() {
  return (_cbState && _cbState.people ? _cbState.people : []).filter(cbPersonHasContact);
}

// نمای کارت اشخاص یک شرکت (AC5 — کلیک‌تو‌کال)
function contactsCardHtml(entity) {
  if (!entity.people || !entity.people.length) return '<em style="color:#94a3b8">شخصی ثبت نشده</em>';
  var h = '';
  entity.people.forEach(function(p) {
    h += '<div style="padding:8px 10px;border:1px solid var(--brd);border-radius:10px;margin-bottom:6px' + (p.primary ? ';background:#fff8f5' : '') + '">' +
      '<b>' + escP(p.nm) + '</b> <span style="color:#94a3b8;font-size:12px">' + escP(p.role || '') + (p.dept ? ' — ' + escP(p.dept) : '') + (p.primary ? ' ⭐' : '') + '</span><br>';
    (p.tels||[]).forEach(function(t){ h += '<a href="'+telHref(t)+'" style="font-size:12.5px;margin-left:10px">☎️ '+escP(fmtTel(t))+(t.lb?' ('+escP(t.lb)+')':'')+'</a>'; });
    (p.mobs||[]).forEach(function(t){ h += '<a href="tel:'+escP(t.n)+'" style="font-size:12.5px;margin-left:10px">📱 '+escP(t.n)+'</a>'; });
    (p.mails||[]).forEach(function(t){ h += '<a href="mailto:'+escP(t.n)+'" style="font-size:12.5px;margin-left:10px;direction:ltr">📧 '+escP(t.n)+'</a>'; });
    h += '</div>';
  });
  return h;
}

// جستجوی عمیق (AC7)
function entityMatches(entity, q) {
  var hay = (entity.cd||'')+' '+(entity.co||'')+' '+(entity.ind||'')+' '+(entity.ca||'');
  (entity.people||[]).forEach(function(p) {
    hay += ' ' + (p.nm||'') + ' ' + (p.role||'');
    (p.tels||[]).forEach(function(t){ hay += ' ' + t.n; });
    (p.mobs||[]).forEach(function(t){ hay += ' ' + t.n; });
    (p.mails||[]).forEach(function(t){ hay += ' ' + t.n; });
  });
  return hay.toLowerCase().indexOf(q.toLowerCase()) > -1;
}

/* ---------- US-110v2: OFFERS (TO / CO) ---------- */

// US-157: اعتبار پیش‌فرض CO = ۷ روز پس از تاریخ سند
function defaultValidity(dateEn) {
  try {
    var d = dateEn ? new Date(dateEn) : new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  } catch (e) { return ''; }
}
// US-157: وضعیت اعتبار CO → {cl, lb} یا null
function offerValidState(o) {
  if (o.kind !== 'CO' || !o.validUntil || o.st === 'won' || o.st === 'lost') return null;
  var today = new Date().toISOString().slice(0, 10);
  var warn = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  if (o.validUntil < today) return { cl: '#fee2e2;color:#b91c1c', lb: '⛔ منقضی ' + o.validUntil };
  if (o.validUntil <= warn) return { cl: '#fef3c7;color:#b45309', lb: '⏳ تا ' + o.validUntil };
  return { cl: '#ecfdf5;color:#047857', lb: '✓ تا ' + o.validUntil };
}

// US-148: آیا کاربر جاری پروفایل امضا دارد؟
function mySigReady() {
  try {
    var p = typeof window.ptfSigProfileFor === 'function' ? window.ptfSigProfileFor(curSession().user) : ((getData('ptf_crm_sigprofiles') || {})[curSession().user]);
    return !!(p && (p.sig || p.stamp));
  } catch (e) { return false; }
}
/* v13.1 (US-321): امضای نیابتی — رییس هیات مدیره و ادمین
   v14.9 (US-383): مدیرعامل و مدیر بازرگانی هم‌سطح رییس هیات مدیره (دسترسی کامل) */
function ptfCanDelegateSig() {
  try { var r = curRole(); return r === 'chairman' || r === 'admin' || r === 'ceo' || r === 'commercial'; } catch (e) { return false; }
}
function ptfSignAsOptions(cur) {
  var me = curSession().user;
  var opts = [{ u: me, lb: 'امضای خودم (' + (curSession().name || me) + ')' }];
  /* گزینه‌های مجاز نیابت (دستور کارفرما): عباس یوسفی و شیوا کریمی */
  var DELEGATES = [{ u: 'yousefi', lb: 'عباس یوسفی' }, { u: 'karimi', lb: 'شیوا کریمی' }];
  var users = getData('ptf_crm_users');
  DELEGATES.forEach(function (d) {
    var real = users.filter(function (x) { return x.username === d.u; })[0];
    if (d.u !== me) opts.push({ u: d.u, lb: 'به نیابت: ' + (real ? real.name : d.lb) });
  });
  return opts.map(function (o2) {
    return '<option value="' + escP(o2.u) + '"' + (cur === o2.u ? ' selected' : '') + '>' + escP(o2.lb) + '</option>';
  }).join('');
}

// US-142 AC3: اختصاری انگلیسی کاربر جاری (از پروفایل کاربران؛ برای admin از پروفایل امضا یا پیش‌فرض)
function myEnName() {
  var s = curSession();
  var u = getData('ptf_crm_users').filter(function (x) { return x.username === s.user; })[0];
  if (u && u.nameEn) return u.nameEn;
  try {
    var p = typeof window.ptfSigProfileFor === 'function' ? window.ptfSigProfileFor(s.user) : ((getData('ptf_crm_sigprofiles') || {})[s.user]);
    if (p && p.nmEn) return p.nmEn;
  } catch (e) {}
  if (typeof ptfNameToEn === 'function' && s.name) {
    try { return ptfNameToEn(s.name); } catch (e2) {}
  }
  return s.user === 'admin' ? 'Sales Department' : (s.name || 'Sales Department');
}

var SELLER_INFO = {
  company: 'Pishro Tajhiz Fartak Co.',
  nationalId: '14010077558',
  contact: 'Sales Department',
  tel: '+98 (21) 4608 7679',
  email: 'info@pishtaj.ir',
  address: 'Unit 1, 16th Floor, Administrative Block A, Tooba Commercial-Administrative Complex, Kouhak Blvd, Tehran, Iran',
  logo: '../assets/images/ptf-logo.png'
};

var TC_LIBRARY = [
  'Prices are in IRR (Iranian Rial). 10% VAT will be added to the prices.',
  'Delivery Time: ____ working days after receipt of official purchase order.',
  'Payment Terms: ____% advance payment, balance before delivery.',
  'Place of Delivery: Seller\'s warehouse, Tehran.',
  'Offer Validity: ____ days from the date of this offer.',
  'Inspection: Material Test Certificates (MTC) will be provided upon request.',
  'Warranty: 12 months after delivery against manufacturing defects.'
];

function offerSerial(kind) { // server-reserved offer code; no local max fallback
  var k = String(kind || 'CO').toUpperCase();
  if (typeof window.ptfUnifiedCode === 'function') return window.ptfUnifiedCode(k);
  return 'TMP-' + k + '-' + Date.now();
}

// تبدیل عدد به حروف انگلیسی (AC5)
function numToWords(n) {
  if (n === 0) return 'Zero';
  var ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function chunk(x) {
    var s = '';
    if (x >= 100) { s += ones[Math.floor(x/100)] + ' Hundred'; x %= 100; if (x) s += ' '; }
    if (x >= 20) { s += tens[Math.floor(x/10)]; x %= 10; if (x) s += '-' + ones[x]; }
    else if (x > 0) s += ones[x];
    return s;
  }
  var scales = [[1e12,'Trillion'],[1e9,'Billion'],[1e6,'Million'],[1e3,'Thousand'],[1,'']];
  var out = [];
  n = Math.round(n);
  scales.forEach(function(sc) {
    if (n >= sc[0]) {
      var q = Math.floor(n / sc[0]); n %= sc[0];
      out.push(chunk(q) + (sc[1] ? ' ' + sc[1] : ''));
    }
  });
  return out.join(' ');
}

var _offState = null; window._offState = _offState; /* OPS-SAVE: global sync */

function ptfSetOffState(v) { _offState = v; window._offState = v; return v; }
window.ptfSetOffState = ptfSetOffState;


function buildOffers() {
  // US-142 AC2: تب‌های جدا برای پیشنهاد فنی و مالی
  var tab = window._offKindTab || 'TO';
  function tbtn(id, lb, cl) {
    var on = tab === id;
    return '<button type="button" id="offTab' + id + '" onclick="offSetTab(\'' + id + '\')" style="border:0;border-radius:10px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;' +
      (on ? 'background:' + cl + ';color:#fff' : 'background:#f1f5f9;color:#475569') + '">' + lb + '</button>';
  }
  /* v21.3 US-450: فیلتر پیشنهادات بر حسب مشتری — جدول و کانبان */
  var custOpts = '<option value="">🏢 همه مشتریان</option>';
  try {
    var custs = getData('ptf_crm_customers').slice().sort(function (a, b) {
      return String(a.co || '').localeCompare(String(b.co || ''), 'fa');
    });
    var curC = window._offCustFilter || '';
    custs.forEach(function (c) {
      custOpts += '<option value="' + escP(c.cd) + '"' + (curC === c.cd ? ' selected' : '') + '>' + escP(c.co || c.cd) + '</option>';
    });
  } catch (eC) {}
  var procAuditBtn = '';
  try { if ((roleDef() || {}).buyPrice) procAuditBtn = '<button class="bt bt-o" style="color:#b45309" onclick="ptfOpenProcurementGlobalAudit()">🔎 تطبیق سراسری خرید</button>'; } catch (ePA) {}
  return '<div class="ph"><h3>📄 پیشنهاد</h3>' +
    '<div class="sb2">' +
    '<input type="text" id="oFsrch" placeholder="جستجو: شماره، خریدار، شماره درخواست کارفرما..." oninput="renderOffers()">' +
    '<select id="oFcust" onchange="offSetCustFilter(this.value)" style="min-width:180px;max-width:260px;padding:8px 10px;border:1px solid var(--brd);border-radius:10px;font-family:inherit;font-size:12.5px;background:var(--crd,#fff)" title="فیلتر بر حسب مشتری — رهگیری همه پیشنهادهای یک کارفرما">' +
    custOpts + '</select>' +
    '<button class="bt" onclick="offerNew(\'TO\')">+ پیشنهاد فنی</button>' +
    '<button class="bt" style="background:#0e7490" onclick="offerNew(\'CO\')">+ پیشنهاد مالی</button>' + procAuditBtn +
    /* v20.1 (US-442 — ابلاغ کارفرما): «فنی-مالی ماهیتا همان مالی است» — دکمه TC حذف شد؛
       قالب چاپ فنی-مالی داخل فرم پیشنهاد مالی انتخاب می‌شود. اسناد TC قدیمی در تب مالی دیده می‌شوند. */
    '</div></div>' +
    '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">' +
    tbtn('TO', '🔧 پیشنهادهای فنی (TO)', '#7c3aed') + tbtn('CO', '💰 پیشنهادهای مالی (CO)', '#0e7490') + tbtn('ALL', 'همه', '#334155') +
      '<button class="bt bt-o" style="padding:6px 10px;font-size:12px;color:#b45309" title="رکوردهای حذف‌شده را ببین و بازگردان" onclick="ptfRecycleBin(&#39;ptf_crm_offers&#39;)">🗑 سطل بازیافت</button>' +
    '<span id="oFcustHint" style="font-size:11.5px;color:#64748b;margin-right:auto"></span>' +
    '</div>' +
    '<div id="oCustTimeline" style="display:none;margin-bottom:12px"></div>' +
    '<div class="tb2"><table><thead><tr>' +
    (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('off', 'no', 'شماره') : '<th>شماره</th>') + '<th>نوع</th>' +
    (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('off', 'buyerCo', 'خریدار') : '<th>خریدار</th>') + '<th>شماره درخواست</th>' +
    (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('off', 'dateFa', 'تاریخ') : '<th>تاریخ</th>') + '<th>اقلام</th>' +
    (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('off', 'amount', 'مبلغ کل') : '<th>مبلغ کل</th>') +
    (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('off', 'st', 'وضعیت') : '<th>وضعیت</th>') + '<th>عملیات</th>' +
    '</tr></thead>' +
    '<tbody id="oTb"></tbody></table></div>';
}

/* v21.5 US-HT-v214-3 / US-451: تایم‌لاین یک‌صفحه‌ای پیشنهادهای یک مشتری */
window.ptfCustOfferTimelineHtml = function (custCd) {
  if (!custCd) return '';
  var cust = null;
  try { cust = getData('ptf_crm_customers').filter(function (c) { return c.cd === custCd; })[0]; } catch (e) {}
  var name = cust ? (cust.co || custCd) : custCd;
  var offers = getData('ptf_crm_offers').filter(function (o) {
    return typeof ptfOfferMatchCust === 'function' ? ptfOfferMatchCust(o, custCd) : (o.buyerCd === custCd);
  });
  offers.sort(function (a, b) {
    var da = a.dateEn || a.t || a.dateFa || '';
    var db = b.dateEn || b.t || b.dateFa || '';
    return String(db).localeCompare(String(da));
  });
  var ST = { draft: 'پیش‌نویس', registered: 'ثبت‌شده', sent: 'ارسال', approved: 'تایید', rejected: 'عدم تایید', revise: 'اصلاح', won: 'برنده', lost: 'بازنده' };
  var rows = offers.map(function (o, i) {
    var total = (o.kind === 'CO' || o.kind === 'TC') ? (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0) : 0;
    var kind = o.kind === 'TO' ? '🔧 TO' : o.kind === 'TC' ? '🤝 TC' : '💰 CO';
    var st = o.kind === 'TO' && o.st === 'won' ? 'approved' : o.kind === 'TO' && o.st === 'lost' ? 'rejected' : (o.st || 'draft');
    return '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed var(--brd);font-size:12.5px;align-items:flex-start">' +
      '<div style="min-width:22px;height:22px;border-radius:50%;background:#e0e7ff;color:#3730a3;display:grid;place-items:center;font-size:10px;font-weight:800">' + (i + 1) + '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<b dir="ltr">' + escP(o.no) + '</b> ' + kind +
      ' <span class="bd" style="font-size:10.5px">' + escP(ST[st] || st) + '</span>' +
      (o.inqNo ? ' <small style="color:#64748b" dir="ltr">inq: ' + escP(o.inqNo) + '</small>' : '') +
      '<div style="color:#64748b;margin-top:2px">' + escP(o.dateFa || o.dateEn || '—') +
      (total ? ' — ' + (typeof ptfMoney === 'function' ? ptfMoney(total, o.currency) : total.toLocaleString('fa-IR') + ' ریال') : '') +
      '</div></div>' +
      (o.st === 'won' && o.kind !== 'TO'
        ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="if(typeof ptfGoSalesFileForOffer===\'function\')ptfGoSalesFileForOffer(\'' + ptfOnClickArg(o.no) + '\')">📁 پرونده</button>'
        : '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" onclick="offerEdit(\'' + ptfOnClickArg(o.no) + '\')">✏️</button>') +
      '</div>';
  }).join('');
  return '<div style="background:linear-gradient(135deg,#f8fafc,#eff6ff);border:1px solid #bfdbfe;border-radius:14px;padding:12px 14px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
    '<div style="font-size:13px;font-weight:800;color:#1e40af">📅 تایم‌لاین پیشنهادهای «' + escP(name) + '» <small style="font-weight:600;color:#64748b">(' + offers.length + ')</small></div>' +
    '<button type="button" class="bt bt-o" style="padding:3px 10px;font-size:11.5px" onclick="offSetCustFilter(\'\')">✕ برداشتن فیلتر</button></div>' +
    (rows || '<div style="color:#94a3b8;text-align:center;padding:12px">پیشنهادی برای این مشتری نیست</div>') +
    '</div>';
};


window.offSetCustFilter = function (cd) {
  window._offCustFilter = cd || '';
  try {
    if (cd) localStorage.setItem('ptf_off_cust_filter', cd);
    else localStorage.removeItem('ptf_off_cust_filter');
  } catch (e) {}
  if (typeof renderOffers === 'function') renderOffers();
};
window.ptfOfferMatchCust = function (o, custCd) {
  if (!custCd) return true;
  if (!o) return false;
  if (o.buyerCd && o.buyerCd === custCd) return true;
  /* fallback نام برای اسناد قدیمی بدون buyerCd */
  try {
    var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === custCd; })[0];
    if (!c) return false;
    if (o.buyerCd) return false; /* buyerCd هست ولی match نیست */
    var names = [c.co, c.coEn].filter(Boolean);
    var bo = o.buyerCo || '';
    if (!bo) return false;
    if (names.indexOf(bo) > -1) return true;
    if (typeof dedupNorm === 'function') {
      var nb = dedupNorm(bo);
      return names.some(function (n) { return dedupNorm(n) === nb; });
    }
    return false;
  } catch (e) { return false; }
};
/* بازیابی فیلتر مشتری از localStorage یک‌بار */
try {
  if (window._offCustFilter == null) {
    window._offCustFilter = localStorage.getItem('ptf_off_cust_filter') || '';
  }
} catch (e0) { window._offCustFilter = window._offCustFilter || ''; }


function offSetTab(t) {
  window._offKindTab = t;
  var colors = { TO: '#7c3aed', CO: '#0e7490', ALL: '#334155' };
  ['TO', 'CO', 'ALL'].forEach(function (k) {
    var b = document.getElementById('offTab' + k);
    if (!b) return;
    var on = k === t;
    b.style.background = on ? colors[k] : '#f1f5f9';
    b.style.color = on ? '#fff' : '#475569';
  });
  renderOffers();
}


/* v14.3 / BUG-TO-SAVE-282: helper وضعیت TO باید global باشد.
   renderOffers و offerSave هر دو از آن استفاده می‌کنند؛ تعریف درون renderOffers
   باعث می‌شد ویرایش TO موجود، هنگام ساخت Revision با ReferenceError متوقف شود. */
function toStMigrate(o) {
  o = o || {};
  if (o.kind !== 'TO') return o.st;
  if (o.st === 'won') return 'approved';
  if (o.st === 'lost') return 'rejected';
  return o.st || 'draft';
}
window.ptfToStMigrate = toStMigrate;

/* v18.9 (US-431 فاز۱): بعد از تشکیل پرونده فروش، پیشنهاد برنده فقط read-only است */
function offerPostAwardLocked(o) {
  if (!o || o.kind === 'TO' || o.st !== 'won') return false;
  try { return getData('ptf_crm_deals').some(function (d) { return d && (d.wonOffer === o.no || d.offerNo === o.no); }); } catch(e) { return true; }
}
window.ptfOfferPostAwardLocked = offerPostAwardLocked;
window.ptfGoSalesFileForOffer = function (no) {
  var dealCd = '';
  try {
    var deals = getData('ptf_crm_deals') || [];
    var o = (getData('ptf_crm_offers') || []).filter(function (x) { return x.no === no; })[0];
    var hit = deals.filter(function (d) {
      return d.wonOffer === no || d.offerNo === no || (o && o.inqNo && d.inqNo === o.inqNo);
    })[0];
    if (hit) dealCd = hit.cd;
  } catch (eF) {}
  if (dealCd && typeof window.ptfGoSalesFile === 'function') window.ptfGoSalesFile(dealCd);
  else {
    try { if (typeof goPanelByName === 'function') goPanelByName('deals'); else if (typeof goPanel === 'function') goPanel('deals'); } catch (e) {}
  }
  if (typeof ptfToast === 'function') ptfToast('ادامه فرایند پیشنهاد برنده فقط از پرونده فروش انجام می‌شود', 'info');
};

function renderOffers() {
  var tb = document.getElementById('oTb');
  if (!tb) return;
  var q = ((document.getElementById('oFsrch')||{}).value || '').trim().toLowerCase();
  var tab = window._offKindTab || 'TO';
  var all = getData('ptf_crm_offers');
  var custF = window._offCustFilter || ((document.getElementById('oFcust') || {}).value) || '';
  window._offCustFilter = custF;
  var offers = all.filter(function(o) {
    if (o.rialOf) return false; /* US-FX2RIAL: نسخه ریالی (همراه) ردیف مستقل نمی‌سازد — در همان ردیف پیشنهاد ارزی مبدأ نمایش داده می‌شود */
    if (tab !== 'ALL' && o.kind !== tab && !(tab === 'CO' && o.kind === 'TC')) return false; /* v20.1 US-442: TC قدیمی زیر تب مالی */
    if (custF && typeof ptfOfferMatchCust === 'function' && !ptfOfferMatchCust(o, custF)) return false; /* v21.3 US-450 */
    // US-142 AC1: جستجو شامل شماره درخواست کارفرما (inqNo)
    return !q || ((o.no||'')+' '+(o.buyerCo||'')+' '+((typeof ptfCustFaByCd==='function'&&o.buyerCd)?ptfCustFaByCd(o.buyerCd):'')+' '+(o.inqNo||'')).toLowerCase().indexOf(q) > -1; /* v34.18.0: جستجو با نام فارسی هم */
  });
  /* UR-2026-08-01-07: سورت ستون‌ها (شماره/خریدار/تاریخ/مبلغ/وضعیت) */
  if (window.ptfRegisterSortable) window.ptfRegisterSortable('off', {
    getters: {
      no: function (o) { return o.no || ''; },
      buyerCo: function (o) { return o.buyerCo || ''; },
      dateFa: function (o) { return o.dateFa || ''; },
      amount: function (o) { return (o.kind === 'CO' || o.kind === 'TC') ? (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0) : 0; },
      st: function (o) { return o.st || ''; }
    },
    render: renderOffers
  });
  offers = (typeof window.ptfSorted === 'function') ? window.ptfSorted('off', offers) : offers;
  try {
    var hint = document.getElementById('oFcustHint');
    if (hint) {
      if (custF) {
        var cn = '';
        try { var cc = getData('ptf_crm_customers').filter(function(x){return x.cd===custF;})[0]; cn = cc ? (cc.co || '') : custF; } catch(eH) {}
        hint.innerHTML = '🎯 فیلتر مشتری: <b>' + escP(cn) + '</b> — ' + offers.length + ' پیشنهاد (جدول و کانبان)';
        hint.style.color = '#0e7490';
      } else { hint.textContent = ''; }
    }
    var tl = document.getElementById('oCustTimeline');
    if (tl) {
      if (custF && typeof ptfCustOfferTimelineHtml === 'function') {
        tl.style.display = '';
        tl.innerHTML = ptfCustOfferTimelineHtml(custF);
      } else {
        tl.style.display = 'none';
        tl.innerHTML = '';
      }
    }
  } catch (eH2) {}
  var ST = { draft: '📝 پیش‌نویس', sent: '📤 ارسال‌شده', revise: '✏️ در حال اصلاح', won: '🏆 برنده', lost: '❌ بازنده' }; // v89: revise برای گردش کار
  /* v14.3 (US-367 — دستور کارفرما): پیشنهاد فنی برنده/بازنده و قفل ندارد — ۶ وضعیت:
     پیش‌نویس → ثبت‌شده → ارسال‌شده → تاییدشده | عدم تایید (بسته؛ به CO نمی‌رسد) | درخواست اصلاح */
  var ST_TO = { draft: '📝 پیش‌نویس', registered: '📋 ثبت‌شده', sent: '📤 ارسال‌شده', approved: '✅ تاییدشده', rejected: '⛔ عدم تایید', revise: '✏️ درخواست اصلاح' };
  window.PTF_ST_TO = ST_TO;
  /* UI-03 (v34.7.20): تعریف تکراری `offerPostAwardLocked` از این‌جا حذف شد.
     پیش از این، همین تابع هم در سطح ماژول (بالای همین فایل) و هم این‌جا داخل renderOffers
     تعریف شده بود و هر بار رندر، `window.ptfOfferPostAwardLocked` دوباره ست می‌شد. بدنه‌ها
     یکسان بودند، پس رفتار امروز درست بود؛ ولی هر اصلاح آیندهٔ فقط‌یکی‌از‌آن‌ها به‌صورت خاموش
     بی‌اثر می‌شد. تعریف واحد اکنون در سطح ماژول است و همین‌جا هم در دسترس است.
     مرجع: ARENA-INDEPENDENT-VERIFICATION-AWARD-CHANGE-2026-08-17.md (یافتهٔ N3) | گام B3 */
  /* UI-03 (v34.7.20): تعریف تکراری `window.ptfGoSalesFileForOffer` هم از همین‌جا حذف شد؛
     نسخهٔ واحد آن در سطح ماژول (کنار offerPostAwardLocked) تعریف شده و رفتار یکسان دارد. */
  var h = '';
  var _canSeeMargin = false; try { _canSeeMargin = !!(roleDef() || {}).buyPrice; } catch (eRM) {} /* v31.7.13: حاشیه کل فقط برای نقش دارای قیمت خرید */
  /* دکمه اصلاح برد بخشی از رندر اصلی است، نه تزریق دیرهنگام backup.js؛ به این
     ترتیب production/staging و desktop/mobile قرارداد یکسان دارند. */
  var _canRepairWin = false; try { _canRepairWin = ['admin', 'chairman'].indexOf(curRole()) > -1; } catch (eRW) {}
  offers.forEach(function(o) {
    var total = (o.kind === 'CO' || o.kind === 'TC') ? o.items.reduce(function(s, it){ return s + (+it.qty||0)*(+it.price||0); }, 0) : 0; /* v17.4 US-416: TC هم مبلغ دارد */
    /* v31.7.13 US-OFF-MARGIN: بج حاشیه سود کلی صورت در همان ردیف */
    var marginBadge = '';
    if (_canSeeMargin && (o.kind === 'CO' || o.kind === 'TC')) {
      try {
        var _om = (typeof window.ptfOfferOverallMargin === 'function') ? window.ptfOfferOverallMargin(o) : null;
        if (_om && _om.marginPct != null) {
          var _neg = _om.marginPct < 0;
          marginBadge = '<div style="font-size:10.5px;margin-top:3px;color:' + (_neg ? '#dc2626' : '#047857') + '" title="حاشیه سود کلی صورت: جمع فروش نسبت به جمع خرید مرجع' + (_om.coverage < _om.totalItems ? ' — فقط ' + _om.coverage + ' از ' + _om.totalItems + ' قلم نرخ مرجع دارند' : '') + '">' +
            (_neg ? '⚠️' : '📈') + ' حاشیه کل: <b>' + _om.marginPct + '٪</b>' + (_om.coverage < _om.totalItems ? ' <span style="color:#b45309">(' + _om.coverage + '/' + _om.totalItems + ')</span>' : '') + '</div>';
        } else if (_om && _om.totalItems > 0) {
          marginBadge = '<div style="font-size:10px;margin-top:3px;color:#94a3b8" title="هیچ قلمی نرخ مرجع خرید ندارد">حاشیه کل: —</div>';
        }
      } catch (eMB) {}
    }
    var isTO = o.kind === 'TO';
    var isWon = !isTO && o.st === 'won'; /* v14.3 US-367: TO هرگز برنده/قفل ندارد */
    var stCell;
    if (isTO) {
      /* v14.3 (US-367): ۶ وضعیت TO — بدون قفل؛ عدم تایید فقط مسیر CO را می‌بندد */
      var tSt = toStMigrate(o);
      stCell = '<select onchange="offerSetSt(\'' + o.no + '\',this.value,this)" style="padding:4px;border:1px solid var(--brd);border-radius:8px;font-size:12px' + (tSt === 'rejected' ? ';border-color:#fecaca;background:#fef2f2' : tSt === 'approved' ? ';border-color:#a7f3d0;background:#ecfdf5' : '') + '">' +
        Object.keys(ST_TO).map(function(k){ return '<option value="'+k+'"'+(tSt===k?' selected':'')+'>'+ST_TO[k]+'</option>'; }).join('') + '</select>';
    } else {
      // US-141 AC2 (فقط CO/TC): برنده = قفل؛ کنترل وضعیت به بج تبدیل می‌شود
      stCell = isWon
        ? '<span class="bd" style="background:#d1fae5;color:#065f46" title="وضعیت برنده قفل است؛ بازگشت فقط با نقش مجاز و پیش‌بررسی وابستگی‌های سرور انجام می‌شود">🏆 برنده 🔒</span>'
        : '<select onchange="offerSetSt(\'' + o.no + '\',this.value,this)" style="padding:4px;border:1px solid var(--brd);border-radius:8px;font-size:12px">' +
          Object.keys(ST).map(function(k){ return '<option value="'+k+'"'+(o.st===k?' selected':'')+'>'+ST[k]+'</option>'; }).join('') + '</select>';
    }
    /* v14.3 (US-367): تبدیل TO→CO در هر وضعیتی آزاد است — تنها «عدم تایید» مسیر مالی را می‌بندد.
       قید یک‌باره US-142 AC5 (CO زنده) پابرجا. */
    var toCoBtn = '';
    if (isTO) {
      var coAlive = o.coNo && all.some(function(x){ return x.no === o.coNo; });
      if (toStMigrate(o) === 'rejected') {
        toCoBtn = ' <span class="bd" style="background:#fef2f2;color:#b91c1c;font-size:11px" title="عدم تایید کارفرما — این درخواست همین‌جا بسته شده و به پیشنهاد مالی نمی‌رسد">→CO ⛔</span>';
      } else if (coAlive) {
        toCoBtn = ' <button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px;color:#7c3aed;border-color:#ddd6fe" title="قبلاً به ' + escP(o.coNo) + ' تبدیل شده — ساخت پیشنهاد مالی جایگزین (گزینه ۲)" onclick="offerToCo(\''+o.no+'\')">⑂</button>';
      } else {
        toCoBtn = ' <button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px;color:#0e7490;border-color:#bae6fd" title="تبدیل به پیشنهاد مالی (→CO)" onclick="offerToCo(\''+o.no+'\')">💸</button>';
      }
    }
    // US-141 AC5: وضعیت فاکتور، نشانگر اطلاعاتی است نه action؛ در ستون وضعیت می‌نشیند.
    // قبلاً در کنار دکمه‌ها فقط دو آیکون خاکستری دیده می‌شد و با یک کنترل اشتباه گرفته می‌شد.
    var invBadge = '';
    if (o.kind === 'CO') {
      if (o.invRef) invBadge = ' <span class="bd b-st4" style="font-size:10px" title="ارجاع‌شده برای فاکتور رسمی">🧾 ارجاع فاکتور</span>';
      else if (isWon) invBadge = ' <span class="bd" style="background:#f5f3ff;color:#6d28d9;font-size:10px" title="پس از تشکیل پرونده فروش، ارجاع فاکتور فقط از داخل پرونده مجاز است">🔒 فاکتور از پرونده</span>';
      else invBadge = ' <span class="bd" style="background:#f1f5f9;color:#64748b;font-size:10px" title="فقط پیش‌فاکتور برنده قابل ارجاع برای فاکتور است">🔒 فاکتور پس از برد</span>';
    }
    // US-157 AC1: بج اعتبار
    var vst = offerValidState(o);
    /* US-FX2RIAL: نسخه ریالی این پیشنهاد (اگر ساخته شده) — درون همان ردیف و با همان شماره،
       نه به‌صورت ردیف مستقل. رکورد پشت‌صحنه جدا می‌ماند (برای چاپ/audit/مالی) ولی نمایش هم‌ردیف است. */
    var rialInline = '';
    try {
      if ((o.kind === 'CO' || o.kind === 'TC') && o.currency && o.currency !== 'IRR' && typeof window.ptfRialCompanionOf === 'function') {
        var _comp = window.ptfRialCompanionOf(o.no);
        if (_comp) {
          var _rt = (_comp.fxConvert && +_comp.fxConvert.rate) || 0;
          rialInline = '<div style="margin-top:6px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:5px 8px;font-size:10.5px;color:#047857;display:flex;flex-wrap:wrap;align-items:center;gap:6px" title="نسخه ریالی همین پیشنهاد — ساخته‌شده با نرخ ' + (_rt ? _rt.toLocaleString('fa-IR') : '') + ' ریال">' +
            '<span>💱 نسخه ریالی (همان شماره)</span>' +
            (_rt ? '<span style="font-size:10px;opacity:.85">نرخ ' + _rt.toLocaleString('fa-IR') + ' ریال</span>' : '') +
            '<span style="margin-left:auto;display:inline-flex;gap:4px">' +
              '<button class="bt bt-o" style="width:24px;height:24px;padding:0;font-size:11px;color:#0e7490" onclick="offerQuickPreview(\'' + ptfOnClickArg(_comp.no) + '\')" title="نمایش نسخه ریالی">👁</button>' +
              '<button class="bt bt-o" style="width:24px;height:24px;padding:0;font-size:11px;color:#0e7490" onclick="offerPrint(\'' + ptfOnClickArg(_comp.no) + '\')" title="چاپ/PDF نسخه ریالی">🖨</button>' +
              '<button class="bt bt-o" style="width:24px;height:24px;padding:0;font-size:11px;color:#b45309" onclick="ptfOfferRialTermsOpen(\'' + ptfOnClickArg(_comp.no) + '\')" title="شرایط و ضوابط + نرخ تسعیر نسخه ریالی">🔧</button>' +
            '</span></div>';
        }
      }
    } catch (eRi) { rialInline = ''; }
    h += '<tr><td><strong>' + escP(o.no) + '</strong>' + (o.rev ? ' <small>Rev.' + o.rev + '</small>' : '') +
      (o.altOf ? '<br><span class="bd" style="background:#f5f3ff;color:#6d28d9;font-size:10px" title="پیشنهاد جایگزین برای همین درخواست — در کنار ' + escP(o.altOf) + '">⑂ گزینه جایگزین</span>' : '') +
      (vst ? '<br><span class="bd" style="background:' + vst.cl + ';font-size:10px">' + vst.lb + '</span>' : '') + rialInline + '</td>' +
      '<td>' + (o.kind === 'TO' ? '🔧 فنی' : o.kind === 'TC' ? '🤝 فنی-مالی' : '💰 مالی') + '</td>' /* v12.8 */ +
      '<td>' + (function () { /* v34.18.0: نام فارسی + انگلیسی زیر هم (هم‌شکل فهرست مشتریان) */
        var p = (typeof ptfCustNamePair === 'function') ? ptfCustNamePair(o.buyerCd, o.buyerCo) : { fa: o.buyerCo || '-', en: '' };
        return (typeof ptfCustCellHtml === 'function') ? ptfCustCellHtml(p.fa, p.en, o.buyerCd) : escP(p.fa);
      })() + '</td>' +
      '<td style="direction:ltr;font-size:12px">' + escP(o.inqNo || '—') + '</td>' +
      '<td>' + escP(o.dateFa || '') + '</td>' +
      '<td>' + o.items.length + '</td>' +
      '<td>' + ((o.kind === 'CO' || o.kind === 'TC') && total ? (typeof ptfMoney === 'function' ? ptfMoney(total, o.currency) : (o.currency && o.currency !== 'IRR' ? total.toLocaleString('en-US') + ' ' + o.currency : total.toLocaleString('fa-IR') + ' ریال')) : '—') + (((o.currency && o.currency !== 'IRR') && (o.fxBasis || o.fxRateRef)) ? '<div style="font-size:10px;color:#64748b">مرجع: ' + escP(o.fxBasis === 'sana' ? 'سنا' : o.fxBasis === 'free' ? 'آزاد' : 'توافقی') + (o.fxRateRef ? ' | ' + (+o.fxRateRef).toLocaleString('fa-IR') + ' ریال' : '') + '</div>' : '') + marginBadge + '</td>' + /* v17.4 US-416: ارز سند */
      '<td>' + stCell + invBadge + '</td>' +
      '<td>' + (isWon ? '<span class="bd" style="background:#f5f3ff;color:#6d28d9;font-size:11px" title="پیشنهاد برنده قفل است؛ ادامه از پرونده فروش">🔒 برنده</span> ' : '<button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px" onclick="offerEdit(\''+o.no+'\')" title="ویرایش پیش‌فاکتور">✏️</button> ') +
      (isWon ? '<button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px;color:#7c3aed;border-color:#ddd6fe" onclick="ptfGoSalesFileForOffer(\''+o.no+'\')" title="مشاهده پرونده فروش">📁</button> ' : '<button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px;color:#0e7490;border-color:#bae6fd" onclick="offerReviseClone(\''+o.no+'\')" title="ایجاد نگارش جدید (Revise)">📑</button> ') +
      (isWon && _canRepairWin ? '<button class="bt bt-o adm-unwin" data-offer-action="unwin" style="width:32px;height:32px;padding:0;font-size:13px;color:#dc2626;border-color:#fecaca" onclick="ptfRevokeOfferWin(\''+ptfOnClickArg(o.no)+'\')" title="بازگرداندن کنترل‌شده از برنده؛ فقط پس از پیش‌بررسی وابستگی‌های سرور">⏪</button> ' : '') +
      '<button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px" onclick="offerQuickPreview(\''+o.no+'\')" title="نمایش سریع اقلام">👁️</button> ' +
      '<button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px" onclick="offerPrint(\''+o.no+'\')" title="قالب‌های چاپ و دانلود سند">🖨️</button> ' +
      ((o.kind === 'CO' || o.kind === 'TC') && isWon ? '<button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px;color:#d97706;border-color:#f59e0b" onclick="unofficialInvoicePrint(\''+o.no+'\')" title="صدور صورتحساب پرداخت (غیررسمی)">🧾</button> ' : '') +
      '<button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px" onclick="offerCsv(\''+o.no+'\')" title="دانلود اکسل اقلام">⬇️</button>' +
      (o.kind === 'CO' ? ' <button class="bt" style="width:32px;height:32px;padding:0;font-size:13px;background:#059669;color:#fff" onclick="offOpenProfitOptimizer(\''+o.no+'\')" title="ماتریس بهینه‌سازی سود">📊</button> ' : '') +
      toCoBtn +
      ((o.kind === 'CO' || o.kind === 'TC') ? ' <button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px;color:#0f766e" title="بررسی سلامت و پیش‌نمایش اقلام" onclick="ptfOfferIntegrityDialog(\''+o.no+'\')">🔎</button>' : '') +
      ((o.rialOf ? ' <button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:12px;color:#b45309;border-color:#fcd34d" onclick="ptfOfferRialTermsOpen(\''+o.no+'\')" title="پیش‌نمایش/ویرایش شرایط و ضوابط نسخه ریالی">🔧</button> <button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="offerQuickPreview(\''+o.rialOf+'\')" title="دیدن پیشنهاد ارزی قبلی">👁 ارزی</button> ' : '') +
       ((o.kind === 'CO' || o.kind === 'TC') && !o.rialOf && !isWon && (o.currency && o.currency !== 'IRR') && !(typeof window.ptfRialCompanionOf === 'function' && window.ptfRialCompanionOf(o.no)) ? ' <button class="bt" style="width:32px;height:32px;padding:0;font-size:12px;background:#0e7490;color:#fff" onclick="ptfOfferRialConvertOpenByNo(\''+o.no+'\')" title="تبدیل به پیشنهاد ریالی">💱</button> ' : '')) +
      ((!isWon && (o.kind === 'CO' || o.kind === 'TC') && !o.rialOf) ? ' <button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:12px;color:#9a3412;border-color:#fdba74" onclick="ptfMarkOfferAmendment(\''+o.no+'\')" title="علامت‌گذاری به‌عنوان متمم مستقل یک پرونده موجود">➕</button>' : '') +
      (isWon ? '' : ' <button class="bt bt-o" style="width:32px;height:32px;padding:0;font-size:13px;color:#dc2626" onclick="offerDel(\''+o.no+'\')" title="حذف">🗑️</button>') + '</td></tr>';
  });
  tb.innerHTML = h || '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:26px">پیشنهادی در این تب ثبت نشده</td></tr>';
}

// US-223: ایجاد یک‌کلیکی نسخه جدید و اصلاحیه (Rev. +1)
window.offerReviseClone = function(no) {
  var offers = getData('ptf_crm_offers');
  var o = offers.filter(function(x){ return x.no === no; })[0];
  if (!o) return;
  if (offerPostAwardLocked(o)) { alert('🔒 پیشنهاد برنده پس از تشکیل پرونده فروش read-only است. نگارش/اصلاح بعدی باید از داخل پرونده فروش ثبت شود.'); if (typeof ptfGoSalesFileForOffer === 'function') ptfGoSalesFileForOffer(no); return; }
  if (!confirm('📑 آیا مایل به ایجاد نگارش جدید (Rev. ' + ((o.rev||0) + 1) + ') از پیشنهاد ' + no + ' هستید؟\n\nشماره پیشنهاد تغییر نمی‌کند؛ فقط Rev همان سند افزایش می‌یابد.')) return;
  ptfSetOffState(ptfOfferPrepareEditState(JSON.parse(JSON.stringify(o)), 'revision', no));
  _offState.rev = (_offState.rev || 0) + 1;
  _offState.st = 'revise';
  _offState.dateFa = faDate();
  _offState.dateEn = new Date().toISOString().slice(0, 10);
  offerForm();
  if (typeof ptfToast === 'function') ptfToast('📑 نگارش Rev. ' + _offState.rev + ' آماده ویرایش و صدور شد', 'ok');
};

// US-220 / v18.6: ماتریس سود پس از برد — ارزآگاه و مبتنی بر خرید واقعی
window.offOpenProfitOptimizer = function(no) {
  var o = getData('ptf_crm_offers').filter(function(x){ return x.no === no; })[0];
  if (!o) return;
  var saleCur = o.currency || 'IRR';
  function fm(v, cur) {
    if (typeof ptfMoney === 'function') return ptfMoney(v, cur || 'IRR');
    return cur && cur !== 'IRR' ? (+v || 0).toLocaleString('en-US') + ' ' + cur : (+v || 0).toLocaleString('fa-IR') + ' ریال';
  }
  /* BUG-PROC-LINK-287: CO item position is not an identity. Previous code used
     positional purchase/RFQ access; reordering/deletion could therefore show
     another item's purchase/reference. Use only an unambiguous identity
     resolver; unknown mappings are deliberately excluded from profit totals. */
  var aliases = [o.inqNo, o.no].filter(Boolean);
  var cmps = getData('ptf_crm_buycmp').filter(function(c){ return aliases.indexOf(c.inqNo) > -1; });
  var rfqs = getData('ptf_crm_rfqsmart').filter(function(x){ return aliases.indexOf(x.srcRfq) > -1 || aliases.indexOf(x.no) > -1; });
  var resolverReady = typeof window.ptfResolveProcurementAcross === 'function';
  var totalSelling = 0, totalBuyingIRR = 0, rowsHtml = '', mappingIssues = [];
  (o.items || []).forEach(function(it, i) {
    var qty = +it.qty || 1;
    var sellP = +it.price || 0;
    var sellTotal = sellP * qty;
    totalSelling += sellTotal;
    var cmpLink = resolverReady ? window.ptfResolveProcurementAcross(it, cmps, { offerNo: o.no }) : { ok:false, reason:'resolver' };
    var purchaseLink = (cmpLink.ok && typeof window.ptfResolvePurchaseForLine === 'function') ? window.ptfResolvePurchaseForLine(cmpLink.record, cmpLink.line) : { ok:false, reason:'purchase-resolver' };
    var pu = purchaseLink.ok ? purchaseLink.purchase : null;
    var buyIRR = pu ? (+pu.price || 0) * qty : 0;
    totalBuyingIRR += buyIRR;
    var buyDisplay = '—', profitDisplay = '—', profitColor = '#64748b';
    if (pu) {
      buyDisplay = '<b>' + fm((+pu.price || 0) * qty, 'IRR') + '</b> <small>(' + escP(pu.sup || '-') + ')</small>' +
        '<br><small style="color:#64748b">تطبیق: ' + escP(cmpLink.mode || cmpLink.line.mode || 'قطعی') + '</small>' +
        (pu.srcCur ? '<br><small dir="ltr">' + (+pu.priceFx || 0).toLocaleString('en-US') + ' ' + escP(pu.srcCur) + ' × ' + (+pu.rate || 0).toLocaleString('fa-IR') + ' = IRR</small>' : '') +
        ((pu.files || []).length ? '<br><small>📎 رسید پرداخت ثبت شده</small>' : '');
      if (saleCur === 'IRR') {
        var profit = sellTotal - buyIRR;
        var margin = sellTotal > 0 ? ((profit / sellTotal) * 100).toFixed(1) + '٪' : '0٪';
        profitDisplay = fm(profit, 'IRR') + ' (' + margin + ')';
        profitColor = profit >= 0 ? '#059669' : '#dc2626';
      } else {
        profitDisplay = 'فروش ' + fm(sellTotal, saleCur) + '<br><small>سود ریالی پس از وصول/تسعیر فروش در موتور سود محاسبه می‌شود</small>';
        profitColor = '#0e7490';
      }
    } else {
      var rfqLink = resolverReady ? window.ptfResolveProcurementAcross(it, rfqs, { offerNo: o.no }) : { ok:false, reason:'resolver' };
      var q = rfqLink.ok ? rfqLink.line.item : null;
      if (q && +q.bestBuyPrice > 0) {
        buyDisplay = '<span style="color:#b45309">استعلامی: ' + fm(q.bestBuyPrice, q.quoteCur || (rfqLink.record || {}).quoteCur || 'IRR') + '</span><br><small>خرید واقعی هنوز ثبت نشده — تطبیق: ' + escP(rfqLink.mode || rfqLink.line.mode || 'قطعی') + '</small>';
      } else {
        var why = (!resolverReady ? 'موتور تطبیق بارگذاری نشده' : (cmpLink.reason === 'ambiguous' || cmpLink.reason === 'ambiguous-record' || rfqLink.reason === 'ambiguous' || rfqLink.reason === 'ambiguous-record') ? 'تطبیق مبهم' : 'بدون تطبیق قطعی');
        buyDisplay = '<span style="color:#b45309">⚠️ ' + why + '</span><br><small>برای جلوگیری از انتساب اشتباه، عدد خرید/استعلامی نمایش داده نشد.</small>';
        mappingIssues.push({ index:i, why:why });
      }
    }
    rowsHtml += '<tr><td>' + (i+1) + '</td><td><b>' + escP(it.name || it.desc || '') + '</b></td>' +
      '<td>' + qty + ' ' + escP((typeof ptfOfferUnitEn==='function'?ptfOfferUnitEn(it.unit): (it.unit||'NO'))) + '</td>' +
      '<td>' + fm(sellP, saleCur) + '</td>' +
      '<td style="background:#ecfdf5;color:#047857;font-weight:bold">' + buyDisplay + '</td>' +
      '<td style="color:' + profitColor + ';font-weight:bold">' + profitDisplay + '</td></tr>';
  });
  var netBox = saleCur === 'IRR'
    ? '<div>سود ناخالص فقط از خریدهای واقعیِ دارای تطبیق قطعی: <b style="color:#059669;font-size:14px">' + fm(totalSelling - totalBuyingIRR, 'IRR') + '</b></div>'
    : '<div style="color:#0e7490">سود ریالی نهایی: در گزارش سود پس از وصول/تسعیر فروش محاسبه می‌شود</div>';
  var mapBox = mappingIssues.length
    ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;font-size:12px;color:#9a3412;margin-bottom:10px">⚠️ ' + mappingIssues.length + ' قلم تطبیق قطعی خرید/استعلام ندارد و عمداً از محاسبه خرید واقعی کنار گذاشته شد. <button class="bt bt-o" style="font-size:11px" onclick="ptfOpenProcurementLinkAudit(\'' + ptfOnClickArg(o.no) + '\')">🔎 گزارش تطبیق اقلام</button></div>'
    : '<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;font-size:12px;color:#065f46;margin-bottom:10px">✅ همه اقلام این ماتریس با شناسه/مشخصات قطعی تطبیق داده شدند. <button class="bt bt-o" style="font-size:11px" onclick="ptfOpenProcurementLinkAudit(\'' + ptfOnClickArg(o.no) + '\')">🔎 گزارش تطبیق اقلام</button></div>';
  var adv = (typeof ptfAdvanceLabel === 'function') ? ptfAdvanceLabel(o) : '—';
  var html = '<div class="md-b" id="ptfOptModal" style="display:grid;z-index:99999" onclick="if(event.target===this)this.remove()">' +
    '<div class="md" style="max-width:980px;max-height:94vh;overflow:auto">' +
    '<div style="border-bottom:2px solid #0e7490;padding-bottom:10px;margin-bottom:12px">' +
    '<h3 style="margin:0;color:#0e7490">📊 ماتریس تخصیص خرید و حداکثرسازی سود (Post-Award Optimizer) — ' + escP(o.no) + '</h3></div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:12px;margin-bottom:14px">' +
    '<div>مجموع فروش کارفرما: <b style="color:#1d4ed8">' + fm(totalSelling, saleCur) + '</b></div>' +
    '<div>مجموع خرید واقعیِ تطبیق‌شده: <b style="color:#047857">' + fm(totalBuyingIRR, 'IRR') + '</b></div>' +
    '<div>پیش‌پرداخت: <b style="color:#b45309">' + escP(adv) + '</b></div>' + netBox + '</div>' +
    mapBox +
    '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;font-size:12px;color:#9a3412;margin-bottom:10px">⚠️ این ماتریس ارزها را مخلوط نمی‌کند؛ استعلامی فقط برای اطلاع است و سود فقط با خرید واقعیِ تطبیق‌شده محاسبه می‌شود.</div>' +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead style="background:#f1f5f9"><tr><th>#</th><th>کالا</th><th>تعداد</th><th>قیمت فروش واحد (' + escP(saleCur) + ')</th><th>خرید واقعی / تامین‌کننده</th><th>سود/وضعیت</th></tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody></table></div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="bt" onclick="document.getElementById(\'ptfOptModal\').remove()">بستن</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

function offerSetSt(no, st, selEl) {
  var offers = getData('ptf_crm_offers');
  var o = offers.filter(function(x){ return x.no === no; })[0];
  if (!o) return;
  if (((typeof offerPostAwardLocked === 'function' ? offerPostAwardLocked(o) : (typeof window.ptfOfferPostAwardLocked === 'function' ? window.ptfOfferPostAwardLocked(o) : false))) && st !== 'won') { alert('🔒 وضعیت پیشنهاد برنده قفل است. ادامه فرایند از پرونده فروش انجام می‌شود.'); if (selEl) selEl.value = o.st; return; }
  /* v14.3 (US-367): چرخه ۶وضعیتی TO — بدون برنده/قفل */
  if (o.kind === 'TO') {
    if (st === 'rejected' && !confirm('⛔ ثبت «عدم تایید» کارفرما برای ' + no + '\n\nبا این وضعیت، درخواست همین‌جا بسته می‌شود و به مرحله پیشنهاد مالی نمی‌رسد.\n(در صورت نیاز بعدا قابل تغییر است — قفل نمی‌شود)\n\nادامه می‌دهید؟')) {
      if (selEl) selEl.value = o.st || 'draft';
      return;
    }
    o.st = st;
    o.tst = st === 'approved' ? 'approved' : st === 'rejected' ? 'rejected' : st === 'revise' ? 'revise' : (st === 'sent' ? 'sent' : o.tst); /* سازگاری گردش کار workflow.js */
    o.stAt = faDateTime(); o.stBy = curSession().name;
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_offers', offers, { reason: 'w4' }); else setData('ptf_crm_offers', offers);
    audit('پیشنهادها', 'وضعیت پیشنهاد فنی ' + no + ' → ' + ((window.PTF_ST_TO || {})[st] || st), no);
    addLog('وضعیت ' + no + ' → ' + st);
    if (typeof wfRefresh === 'function' && o.inqNo) { try { wfRefresh(o.inqNo, 'وضعیت TO: ' + st); } catch (eW) {} }
    renderOffers();
    return;
  }
  // US-141 AC1 (فقط CO/TC): برنده شدن نیازمند تایید صریح + هشدار غیرقابل بازگشت
  if (st === 'won') {
    var ok = confirm('⚠️ هشدار مهم\n\nبا تایید وضعیت «برنده» برای ' + no + ':\n' +
      '• دیگر امکان بازگشت به مرحله قبل وجود ندارد و وضعیت قفل می‌شود\n' +
      (o.kind === 'CO' ? '• مدارک معامله (درخواست، ضمائم، پیشنهادهای فنی/مالی) به «پرونده فروش» همین درخواست منضم می‌شود\n' : '') +
      '\nآیا تایید می‌کنید؟');
    if (!ok) { if (selEl) selEl.value = o.st || 'draft'; return; }
    o.st = 'won';
    o.wonAt = faDateTime();
    o.wonBy = curSession().name;
    /* v31.7.13 US-OFF-MARGIN-ANL: انجماد حاشیه لحظه بسته‌شدن — ویرایش بعدی آمار تحلیلگر را خراب نکند */
    try { o.marginAtClose = (typeof window.ptfOfferOverallMargin === 'function') ? window.ptfOfferOverallMargin(o) : null; } catch (eMC) {}
    /* v31.7.21 US-OFF-ALT: گزینه‌های موازی همین درخواست (اروپایی/چینی و…) با برد یکی، با تایید کاربر بازنده می‌شوند */
    try {
      if (o.inqNo) {
        var _sib = offers.filter(function (x) { return x !== o && x.kind !== 'TO' && x.inqNo === o.inqNo && ['won', 'lost'].indexOf(x.st) < 0; });
        if (_sib.length && confirm('⑂ ' + _sib.length + ' پیشنهاد موازی دیگر برای همین درخواست باز است (' + _sib.map(function (x) { return x.no; }).join('، ') + ').\n\nآیا همه به وضعیت «بازنده» بروند؟ (آمار تحلیلگر دقیق می‌ماند)')) {
          _sib.forEach(function (x) {
            x.st = 'lost'; x.lostAt = faDateTime();
            try { x.marginAtClose = (typeof window.ptfOfferOverallMargin === 'function') ? window.ptfOfferOverallMargin(x) : null; } catch (eML2) {}
          });
          try { audit('پیشنهادها', 'بازنده‌شدن خودکار ' + _sib.length + ' گزینه موازی پس از برد ' + o.no, o.no); } catch (eAu) {}
        }
      }
    } catch (eSib) {}
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_offers', offers, { reason: 'w4' }); else setData('ptf_crm_offers', offers);
    audit('پیشنهادها', 'تایید وضعیت برنده (قفل شد)', no);
    addLog('پیشنهاد ' + no + ' برنده شد 🏆 (قفل)');
    if (o.kind === 'CO') autoCreateProjectFromCO(o);
    renderOffers();
    return;
  }
  o.st = st;
  /* v31.7.13: باخت هم لحظه بسته‌شدن snapshot می‌گیرد */
  if (st === 'lost') { try { o.marginAtClose = (typeof window.ptfOfferOverallMargin === 'function') ? window.ptfOfferOverallMargin(o) : null; o.lostAt = faDateTime(); } catch (eML) {} }
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_offers', offers, { reason: 'w4' }); else setData('ptf_crm_offers', offers);
  addLog('وضعیت ' + no + ' → ' + st);
}

/* ===== v13.6 (US-322 تکمیلی): CO برنده → دیگر پرونده در «بایگانی» نمی‌سازد.
   مدارک سیستمی به «پرونده فروش» همان درخواست (salesfiles) منضم می‌شود؛
   بایگانی فقط مقصد مختومه‌سازی است. ===== */
function autoCreateProjectFromCO(o) {
  try {
    var r = (typeof ptfSF_ensure === 'function') ? ptfSF_ensure(o.inqNo || o.no, o.buyerCo) : null;
    if (!r) return;
    var deals = getData('ptf_crm_deals');
    var rec = deals.filter(function (x) { return x.cd === r.cd; })[0];
    if (!rec) return;
    rec.docs = rec.docs || [];
    rec.wonOffer = o.no;
    rec.wonAt = faDateTime();
    /* ضمائم درخواست مرتبط (فایل‌های آپلودی RFQ) به اسناد پرونده فروش */
    var rfq = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === o.inqNo || x.inqNo === o.inqNo; })[0];
    var added = 0;
    if (rfq && rfq.files) {
      Object.keys(rfq.files).forEach(function (k) {
        (rfq.files[k] || []).forEach(function (f) {
          if (f.key && !rec.docs.some(function (d) { return d.key === f.key; })) {
            rec.docs.push({ name: f.name, key: f.key, size: f.size || 0, t: faDate(), by: curSession().name, note: 'ضمیمه درخواست (' + k + ')' });
            added++;
          }
        });
      });
    }
    /* v17.1 (US-404 فاز ۲ — مصوب کارفرما): خلاصه انضمام خودکار «اسناد چهارگانه» لحظه تشکیل پرونده:
       ① ضمایم درخواست (بالا — added) ② TO/CO با آخرین رویژن (نمایش زنده sfDocsOf) ③ استعلام‌های تامین
       (sfDocsOf.supply — با هر دو شناسه US-386) ④ جدول خرید واقعی (hook v16.3). شمارش برای audit/notify: */
    var nOff = 0, nSup = 0;
    try {
      var _als = [o.inqNo];
      if (rfq) { if (_als.indexOf(rfq.cd) < 0) _als.push(rfq.cd); if (rfq.inqNo && _als.indexOf(rfq.inqNo) < 0) _als.push(rfq.inqNo); }
      nOff = getData('ptf_crm_offers').filter(function (x) { return x.inqNo === o.inqNo; }).length;
      nSup = getData('ptf_crm_rfqsmart').filter(function (q) { return q.srcRfq && _als.indexOf(q.srcRfq) > -1; }).length;
    } catch (e4) {}
    rec.docsSummary = { attachments: added, offers: nOff, supply: nSup, t: faDateTime() };
    /* v19.1 (US-432): «سند قطعی برد» — snapshot تغییرناپذیر پیشنهاد مالی برنده + آخرین پیشنهاد فنی مرتبط،
       لحظه ابلاغ سفارش داخل خود پرونده فروش ذخیره می‌شود (پوشه اسناد برد). چاپ/PDF از پرونده: sfAwardPrint.
       اگر بعدها پیشنهاد از سیستم حذف شود، snapshot همچنان سند برد را بازتولید می‌کند (AC4). */
    try {
      rec.awardDocs = [{ kind: o.kind, no: o.no, rev: o.rev || 0, role: 'commercial', t: faDateTime(), by: curSession().name, snap: JSON.parse(JSON.stringify(o)) }];
      var _allOff = getData('ptf_crm_offers');
      var _toRel = null;
      if (typeof window.ptfAwardRelatedTo === 'function') _toRel = window.ptfAwardRelatedTo(o, _allOff);
      else {
        if (o.srcToNo) _toRel = _allOff.filter(function (x) { return x.no === o.srcToNo; })[0];
        if (!_toRel) _toRel = _allOff.filter(function (x) { return x.kind === 'TO' && x.coNo === o.no; }).sort(function (a, b) { return (b.rev || 0) - (a.rev || 0); })[0];
      }
      if (_toRel) rec.awardDocs.push({ kind: 'TO', no: _toRel.no, rev: _toRel.rev || 0, role: 'technical', t: faDateTime(), by: curSession().name, snap: JSON.parse(JSON.stringify(_toRel)) });
    } catch (eAw) {}
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_deals', deals, { reason: 'w2' }); else setData('ptf_crm_deals', deals);
    audit('پرونده‌های فروش', 'CO برنده ' + o.no + ' — پرونده ' + (r.inqNo || r.cd) + ' تشکیل و اسناد منضم شد (' + added + ' ضمیمه، ' + nOff + ' پیشنهاد، ' + nSup + ' استعلام تامین)', r.cd);
    if (typeof notify === 'function') notify({ toRoles: SENIOR_ROLES, title: '🏆 ' + o.no + ' برنده شد — پرونده فروش ' + (r.inqNo || '') + ' با اسناد کامل تشکیل شد', kind: 'info', channels: ['cart'], link: { panel: 'deals' } });
    /* v16.3 (US-392 AC1): هدایت به ثبت خرید واقعی — جدا از قیمت استعلامی */
    if (confirm('🏆 وضعیت برنده ثبت شد — پرونده فروش با اسناد کامل تشکیل شد:\n• ' + added + ' ضمیمه درخواست\n• ' + nOff + ' پیشنهاد (آخرین رویژن)\n• ' + nSup + ' استعلام تامین\n\n🛒 گام بعدی فرآیند: ثبت «قیمت خرید واقعی» اقلام این پروژه (تامین‌کننده نهایی + قیمت + ارز).\n\nهمین حالا جدول خرید واقعی باز شود؟')) {
      if (typeof ptfRealBuyOpen === 'function') ptfRealBuyOpen(o.inqNo || o.no);
    }
  } catch (e) {}
}

function offerNew(kind) {
  /* v34.8.40 (R2/T5-2c — DEV→IDB): پیش‌نویس‌ها در Dev-KV (IndexedDB) هستند؛ فرم
     فوراً با وضعیت تازه باز می‌شود و بررسیِ async پیش‌نویس ذخیره‌شده بلافاصله بعد
     انجام می‌شود (تا قبل از مهاجرت، devKv.get از legacy LS هم می‌خواند). */
  ptfSetOffState({
    no: offerSerial(kind), kind: kind, rev: 0, editMode: 'new',
    dateFa: new Date().toLocaleDateString('fa-IR'),
    dateEn: new Date().toISOString().slice(0, 10),
    buyerCd: '', buyerCo: '', buyerContact: '', buyerTel: '', inqNo: '',
    items: [{ name: '', desc: '', model: '', qty: 1, unit: 'NO', brand: '', dlv: '', price: 0 }], /* v122 US-278: ردیف پیش‌فرض */ terms: [], st: 'draft', vatNote: true
  });
  offerForm();
  try {
    if (window.ptfDevKv) window.ptfDevKv.get('ptf_autodraft_offer_' + kind, function (raw) {
      var draft = null;
      try { draft = JSON.parse(raw || 'null'); } catch (eP) {}
      if (!draft || !draft.items || !draft.items.length) return;
      if (confirm('⚡ یک فرم پیش‌نویس ذخیره‌شده از قبل (حاوی ' + draft.items.length + ' قلم کالا) موجود است.\nآیا مایل به بازیابی آن هستید؟')) {
        try {
          ptfSetOffState(draft);
          offerForm();
          if (typeof ptfToast === 'function') ptfToast('⚡ فرم پیش‌نویس با موفقیت بازیابی شد', 'ok');
        } catch (eRes) {}
      } else {
        try { window.ptfDevKv.remove('ptf_autodraft_offer_' + kind); } catch (eR) {}
      }
    });
  } catch (eKv) {}
}

function ptfTriggerAutoDraftSave() {
  if (_offState && _offState.kind) {
    try {
      /* v34.7.45: فرم رویژن از offerForm مشترک استفاده می‌کند، اما draft آن نباید
         جای draft «پیشنهاد مالی جدید» را بگیرد و بعداً به‌اشتباه restore شود. */
      var revCtx = window._ptfAwardRevisionContext;
      var key = revCtx && revCtx.operationId
        ? ('ptf_autodraft_award_revision_' + String(revCtx.operationId).replace(/[^A-Za-z0-9_.|:-]/g, '_'))
        : ('ptf_autodraft_offer_' + _offState.kind);
      /* v34.8.40 (R2/T5-2c — DEV→IDB): پیش‌نویس در Dev-KV (IndexedDB) ذخیره می‌شود
         (اصل E3 — LS سبک)؛ بدون IDB fallback به LS (قرارداد رودمپ). */
      if (window.ptfDevKv) window.ptfDevKv.set(key, JSON.stringify(_offState));
      else { try { localStorage.setItem(key, JSON.stringify(_offState)); } catch (eL) {} }
    } catch(e){}
  }
}

/* v31.7.31 BUG-OFF-REV-001:
   هویت پیشنهاد هنگام save باید از مسیر ورود فرم بیاید، نه از حدس وضعیت سند.
   - ویرایش مستقیم (editMode=direct) هرگز Rev جدید یا شماره جدید نمی‌سازد.
   - نگارش جدید (editMode=revision) فقط Rev را روی همان شماره افزایش می‌دهد.
   - اگر فرم stale/autodraft باشد و رکورد اصلی پیدا نشود، ذخیره مسدود می‌شود تا
     پیشنهاد جدید با شماره اشتباه ساخته نشود. */
function ptfOfferPrepareEditState(o, mode, baseNo) {
  if (!o) return o;
  o.editMode = mode || 'direct';
  o._baseNo = baseNo || o.no || '';
  o._origNo = o._baseNo;
  return o;
}
window.ptfOfferPrepareEditState = ptfOfferPrepareEditState;

function ptfOfferResolveSaveIdentity(o, offers) {
  offers = Array.isArray(offers) ? offers : [];
  if (!o) return { ok: false, reason: 'no-state', idx: -1, originalNo: '' };
  var mode = o.editMode || 'new';
  var isEditLike = mode === 'direct' || mode === 'revision';
  var originalNo = isEditLike ? (o._baseNo || o._origNo || o.baseNo || o.no || '') : (o.no || '');
  var idx = -1;
  offers.forEach(function (x, i) { if (x && x.no === originalNo) idx = i; });
  if (isEditLike) {
    if (!originalNo || idx < 0) return { ok: false, reason: 'missing-edit-target', idx: -1, originalNo: originalNo, mode: mode };
    if (o.no !== originalNo) o.no = originalNo; /* شماره سند در ویرایش/نگارش immutable است */
  } else {
    offers.forEach(function (x, i) { if (x && x.no === o.no) idx = i; });
  }
  return { ok: true, idx: idx, originalNo: originalNo, mode: mode, explicitRevision: mode === 'revision' };
}
window.ptfOfferResolveSaveIdentity = ptfOfferResolveSaveIdentity;

function offerEdit(no) {
  var offers = getData('ptf_crm_offers');
  var o = offers.filter(function(x){ return x.no === no; })[0];
  if (!o) return;
  if (offerPostAwardLocked(o)) { alert('🔒 پیشنهاد برنده پس از تشکیل پرونده فروش قابل ویرایش نیست. ادامه فرایند از پرونده فروش انجام می‌شود.'); if (typeof ptfGoSalesFileForOffer === 'function') ptfGoSalesFileForOffer(no); return; }
  ptfSetOffState(ptfOfferPrepareEditState(JSON.parse(JSON.stringify(o)), 'direct', no));
  offerForm();
}

function offerToCo(no) { // AC12 + US-142 AC5: فقط یک بار | v14.3 US-367: در هر وضعیت مجاز جز «عدم تایید»
  var offers = getData('ptf_crm_offers');
  var o = offers.filter(function(x){ return x.no === no; })[0];
  if (!o) return;
  if (o.kind === 'TO' && (o.st === 'rejected' || (o.st === 'lost'))) {
    alert('⛔ این پیشنهاد فنی «عدم تایید» خورده و درخواست همین‌جا بسته شده است.\nطبق فرآیند مصوب، به مرحله پیشنهاد مالی نمی‌رسد.\n(اگر کارفرما نظرش برگشت، ابتدا وضعیت TO را تغییر دهید)');
    return;
  }
  /* v31.7.21 US-OFF-ALT (گزارش کارفرما): مشتری برای یک درخواست چند پیشنهاد موازی می‌خواهد
     (مثلاً گزینه کالای اروپایی و گزینه چینی). قفل یک‌باره US-142 AC5 مانع می‌شد.
     اکنون: تبدیل دوم به بعد با تایید صریح، به‌عنوان «پیشنهاد جایگزین» مجاز است؛
     لینک coNo اول برای ردیابی حفظ می‌شود و پیشنهاد جدید مارک altOf می‌گیرد. */
  var _isAlt = false;
  if (o.coNo && offers.some(function(x){ return x.no === o.coNo; })) {
    var _altCount = offers.filter(function(x){ return x.kind !== 'TO' && x.srcToNo === no; }).length;
    if (!confirm('ℹ️ برای این پیشنهاد فنی قبلاً «' + o.coNo + '» صادر شده است.\n\nآیا می‌خواهید یک «پیشنهاد مالی جایگزین» (گزینه ' + (_altCount + 1) + ' — مثلاً برند/مبدأ دیگر) برای همین درخواست بسازید؟\n\n• هر پیشنهاد شماره مستقل خودش را می‌گیرد\n• هر دو در فهرست با برچسب «گزینه» دیده می‌شوند\n• با برنده شدن یکی، بقیه را بازنده کنید')) {
      return;
    }
    _isAlt = true;
  }
  ptfSetOffState(JSON.parse(JSON.stringify(o)));
  _offState.no = offerSerial('CO');
  _offState.kind = 'CO';
  _offState.st = 'draft';
  _offState.rev = 0;
  _offState.srcToNo = no; // برای قفل کردن دکمه تبدیل پس از ذخیره
  if (_isAlt) { _offState.altOf = o.coNo; _offState.altLabel = 'گزینه جایگزین'; } /* v31.7.21 US-OFF-ALT */
  delete _offState.coNo;
  /* v15.4 (US-386): TOهای قدیمی/وارداتی که buyerCd ندارند → حل از روی نام تا کارفرما در فرم CO عینا بنشیند */
  if (!_offState.buyerCd && _offState.buyerCo) {
    try {
      var _mc2 = getData('ptf_crm_customers').filter(function (c2) {
        return c2.co === _offState.buyerCo || (c2.coEn && c2.coEn === _offState.buyerCo) ||
          (typeof dedupNorm === 'function' && (dedupNorm(c2.co) === dedupNorm(_offState.buyerCo) || (c2.coEn && dedupNorm(c2.coEn) === dedupNorm(_offState.buyerCo))));
      })[0];
      if (_mc2) _offState.buyerCd = _mc2.cd;
    } catch (eM2) {}
  }
  _offState.items.forEach(function(it){ it.price = it.price || 0; });
  offerForm();
}

function offerDel(no) {
  var _targetDel = getData('ptf_crm_offers').filter(function(o){ return o.no === no; })[0];
  if (offerPostAwardLocked(_targetDel)) { alert('🔒 پیشنهاد برنده و پرونده فروش آن قابل حذف از ماژول پیشنهادها نیست. ادامه فرایند از پرونده فروش انجام می‌شود.'); if (typeof ptfGoSalesFileForOffer === 'function') ptfGoSalesFileForOffer(no); return; }
  /* v16.4 (US-372 AC3): confirm حیاتی حذف — هم‌تم dialogx با fallback بومی؛ رفتار عینا حفظ شده */
  if (window.dialogx) {
    dialogx.confirm('پیشنهاد ' + no + ' حذف شود؟', { icon: '🗑', title: 'حذف پیشنهاد', danger: true, okLabel: 'حذف شود' }).then(function (ok) { if (ok) ptfOfferDelDo(no); });
    return;
  }
  if (!confirm('پیشنهاد ' + no + ' حذف شود؟')) return;
  ptfOfferDelDo(no);
}
function ptfOfferDelDo(no) {
  var offers = getData('ptf_crm_offers');
  var target = offers.filter(function(o){ return o.no === no; })[0];
  var rem = offers.filter(function(o){ return o.no !== no; });
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_offers', rem, { reason: 'w4' }); else setData('ptf_crm_offers', rem);
  try {
    if (target) {
      var arc = getData('ptf_crm_deleted_archive');
      arc.unshift({ id: no, kind: 'OFFER', label: target.kind + ' — ' + (target.buyerCo || '?'), reason: 'حذف دستی پیشنهاد', by: (typeof curSession === 'function' && curSession().name) ? curSession().name : 'کاربر', t: (typeof faDateTime === 'function') ? faDateTime() : '', iso: new Date().toISOString() });
      if (arc.length > 500) arc = arc.slice(0, 500);
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_deleted_archive', arc, { reason: 'w4' }); else setData('ptf_crm_deleted_archive', arc);
    }
  } catch (eArc) {}
  if (target && target.inqNo) {
    var inqNo = target.inqNo;
    var otherOffs = rem.filter(function(o){ return o.inqNo === inqNo; });
    if (!otherOffs.length) {
      var rfqs = getData('ptf_crm_rfqs');
      var r = rfqs.filter(function(x){ return x.cd === inqNo || x.inqNo === inqNo; })[0];
      if (r) { r.st = 'st1'; r.stxt = '🔴 دریافت اولیه'; if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs); }
    }
  }
  renderOffers();
  if (typeof renderRfq === 'function') renderRfq();
  addLog('پیشنهاد ' + no + ' حذف شد');
  if (typeof wfRefresh === 'function' && target && target.inqNo) try { wfRefresh(target.inqNo, 'حذف پیشنهاد ' + no); } catch (eWf) {}
}


/* v21.8 US-453 / US-HT-v214-1: برچسب خوانای کارفرما (نام + کد) در فرم پیشنهاد */
window.ptfOfferBuyerLabel = function (c, fallbackCo) {
  if (!c) {
    var fb = fallbackCo || '';
    return { title: fb || '— انتخاب کارفرما —', code: '', fa: fb, en: '', html: escP(fb || '—') };
  }
  var fa = c.co || '';
  var en = c.coEn || '';
  var code = c.cd || '';
  var title = fa || en || code || '—';
  if (fa && en && fa !== en) title = fa + ' / ' + en;
  var html = '<span style="font-weight:800;color:#0f172a">' + escP(title) + '</span>';
  if (code) html += ' <span dir="ltr" style="display:inline-block;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:800;margin-right:4px">' + escP(code) + '</span>';
  if (fa && en && fa !== en) {
    html += '<div style="font-size:11px;color:#64748b;margin-top:2px">FA: ' + escP(fa) + ' <span style="color:#cbd5e1">|</span> EN: <span dir="ltr">' + escP(en) + '</span></div>';
  } else if (en && !fa) {
    html += '<div style="font-size:11px;color:#64748b;margin-top:2px" dir="ltr">EN: ' + escP(en) + '</div>';
  }
  return { title: title, code: code, fa: fa, en: en, html: html };
};
window.ptfOfferRefreshBuyerChip = function (cd) {
  try {
    var box = (typeof offEl === 'function') ? offEl('ofBuyerChip') : document.getElementById('ofBuyerChip');
    if (!box) return;
    cd = cd || ((typeof offEl === 'function' ? offEl('ofBuyer') : document.getElementById('ofBuyer')) || {}).value || (_offState && _offState.buyerCd) || '';
    var c = null;
    if (cd) c = getData('ptf_crm_customers').filter(function (x) { return x.cd === cd; })[0];
    if (!c && _offState && (_offState.buyerCo || _offState.buyerCd)) {
      c = { cd: _offState.buyerCd || cd, co: _offState.buyerCo || '', coEn: '' };
    }
    if (!cd) {
      box.innerHTML = '<span style="color:#94a3b8">هنوز کارفرما انتخاب نشده</span>';
      box.style.display = '';
      return;
    }
    var lb = ptfOfferBuyerLabel(c, _offState && _offState.buyerCo);
    box.innerHTML = '🏢 کارفرما انتخاب‌شده: ' + lb.html;
    box.style.display = '';
  } catch (e) {}
};

// ---- فرم صدور/ویرایش ----
/* v34.9.2 (TYPEAHEAD): جستجوی تایپی مشتری در فرم پیشنهاد — به‌جای اسکرول لیست کشویی بلند،
   کاربر بخشی از نام (فارسی/انگلیسی/کد) را می‌نویسد و از فهرست فیلترشده انتخاب می‌کند؛
   دکمهٔ «لیست کامل» همان select قبلی را باز می‌کند. */
window.offerBuyerAcLabel = function (c) {
  if (!c) return '';
  var l = c.co || c.coEn || c.cd || '';
  if (c.coEn && c.co && c.coEn !== c.co) l = c.co + ' / ' + c.coEn;
  return l;
};
window.offerBuyerAcSearch = function () {
  var inp = document.getElementById('ofBuyerAc'), box = document.getElementById('ofBuyerAcBox');
  if (!inp || !box) return;
  var q = String(inp.value || '').trim().toLowerCase();
  var custs = [];
  try { custs = getData('ptf_crm_customers') || []; } catch (eC) {}
  var hits = custs.filter(function (c) {
    if (!q) return true;
    return ((c.co||'')+' '+(c.coEn||'')+' '+(c.cd||'')).toLowerCase().indexOf(q) > -1;
  }).slice(0, 40);
  box.innerHTML = hits.length
    ? hits.map(function (c) {
        return '<div role="button" tabindex="0" style="padding:8px 10px;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:12.5px" onclick="offerBuyerAcPick(\'' + ptfOnClickArg(c.cd) + '\')" onkeydown="if(event.key===\'Enter\')offerBuyerAcPick(\'' + ptfOnClickArg(c.cd) + '\')">' +
          '<b>' + escP(c.co || c.coEn || c.cd) + '</b>' + (c.coEn && c.co ? ' <span dir="ltr" style="color:#64748b">' + escP(c.coEn) + '</span>' : '') +
          ' <span dir="ltr" style="color:#0e7490;font-size:11px">' + escP(c.cd) + '</span></div>';
      }).join('')
    : '<div style="padding:10px;color:#94a3b8;font-size:12px">مشتری‌ای با این عبارت پیدا نشد</div>';
  box.style.display = 'block';
};
window.offerBuyerAcPick = function (cd) {
  var sel = document.getElementById('ofBuyer'), inp = document.getElementById('ofBuyerAc'), box = document.getElementById('ofBuyerAcBox');
  if (sel) sel.value = cd;
  if (box) box.style.display = 'none';
  var c = null;
  try { c = getData('ptf_crm_customers').filter(function (x) { return x.cd === cd; })[0]; } catch (eC2) {}
  if (inp) inp.value = window.offerBuyerAcLabel(c) || cd;
  offerPickBuyer(cd);
};
window.offerBuyerToggleFull = function () {
  var sel = document.getElementById('ofBuyer'), box = document.getElementById('ofBuyerAcBox');
  if (box) box.style.display = 'none';
  if (!sel) return;
  sel.style.display = sel.style.display === 'none' ? '' : 'none';
  if (sel.style.display !== 'none') sel.focus();
};
document.addEventListener('click', function (e) {
  var box = document.getElementById('ofBuyerAcBox');
  if (!box || box.style.display === 'none') return;
  if (e.target && (e.target.id === 'ofBuyerAc' || (e.target.closest && e.target.closest('#ofBuyerAcBox')))) return;
  box.style.display = 'none';
});
function offerForm() {
  /* v14.2 (US-364): فقط یک فرم پیشنهادِ قابل‌مشاهده — فرم‌های باز قبلی بسته می‌شوند
     (مینیمایزشده‌های modalx با display:none دست نمی‌خورند) */
  try {
    document.querySelectorAll('.md-b').forEach(function (mb) {
      if (mb.style.display !== 'none' && mb.querySelector('[id="offItemsWrap"]')) mb.remove();
    });
  } catch (eF) {}
  var o = _offState;
  /* v15.5 (US-386 تکمیلی — گزارش کارفرما: «ویرایش» و «نگارش جدید» هم کارفرما را خالی می‌آوردند):
     حل مرکزی buyerCd از نام کارفرما — یک‌جا برای همه مسیرهای ورود به فرم
     (ویرایش/نگارش جدید/→CO/صف انتظار/پیش‌نویس دستیار/بازیابی autodraft) */
  if (o && !o.buyerCd && o.buyerCo) {
    try {
      var _bMc = getData('ptf_crm_customers').filter(function (c2) {
        return c2.co === o.buyerCo || (c2.coEn && c2.coEn === o.buyerCo) ||
          (typeof dedupNorm === 'function' && (dedupNorm(c2.co) === dedupNorm(o.buyerCo) || (c2.coEn && dedupNorm(c2.coEn) === dedupNorm(o.buyerCo))));
      })[0];
      if (_bMc) o.buyerCd = _bMc.cd;
    } catch (eBc) {}
  }
  var custs = getData('ptf_crm_customers');
  /* v21.4 BUG-039: اگر buyerCd روی سند هست ولی در لیست نیست (ادغام/حذف نرم)، گزینه موقت بساز تا انتخاب خالی نشود */
  if (o.buyerCd && !custs.some(function (c) { return c.cd === o.buyerCd; })) {
    custs = custs.slice();
    custs.unshift({ cd: o.buyerCd, co: o.buyerCo || o.buyerCd, coEn: o.buyerCo || '' });
  }
  var custOpts = '<option value="">— انتخاب کارفرما —</option>';
  custs.forEach(function(c) {
    /* v21.8 US-453: نام خوانا + کد در لیست کشویی */
    var label = c.co || c.coEn || c.cd || '';
    if (c.coEn && c.co && c.coEn !== c.co) label = c.co + ' / ' + c.coEn;
    if (c.cd) label = label + '  ·  ' + c.cd;
    custOpts += '<option value="' + escP(c.cd) + '"' + (o.buyerCd === c.cd ? ' selected' : '') + '>' + escP(label) + '</option>';
  });
  /* MOB-041 + v34.7.57: کارت امضا پیش از «اقلام» می‌آید تا در موبایل کامل دیده شود؛
     از v34.7.57 پس از فیلدهای هویت سند (کارفرما/درخواست/تاریخ) قرار می‌گیرد تا ترتیب
     پرکردن فرم طبیعی باشد — همچنان قبل از ورود اقلام و در دید. */
  var signatureHtml = '<section class="offer-signature-card" aria-labelledby="offSignatureTitle"><div class="offer-signature-head"><span class="offer-signature-icon" aria-hidden="true">✍️</span><span><b id="offSignatureTitle">مهر و امضا</b><small>امضای انتخابی فقط هنگام پیش‌نمایش/صدور روی سند درج می‌شود.</small></span></div>' +
    '<label class="offer-signature-toggle"><input type="checkbox" id="ofUseSig"' + (o.useSig ? ' checked' : '') + (mySigReady() || ptfCanDelegateSig() ? '' : ' disabled') + '><span>درج مهر و امضا روی سند</span>' +
    (mySigReady() || ptfCanDelegateSig() ? '' : '<small>ابتدا در مکاتبات → «امضای من» پروفایل امضا را ثبت کنید.</small>') + '</label>' +
    (ptfCanDelegateSig() ? '<label class="offer-signature-select"><span>امضاکننده</span><select id="ofSignAs">' + ptfSignAsOptions(o.signAs) + '</select></label>' : '') +
    '</section>';
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md offer-form-modal" style="max-width:min(96vw,1700px);max-height:92vh;overflow:auto">' +
    '<h3>' + (o.kind === 'TO' ? '🔧 پیشنهاد فنی' : o.kind === 'TC' ? '🤝 پیشنهاد فنی-مالی' : '💰 پیشنهاد مالی') +
    ' — <span style="direction:ltr;display:inline-block">' + escP(o.no) + '</span>' +
    (o.buyerCo || o.buyerCd ? ' <small style="font-weight:700;color:#0e7490;font-size:12px">| 🏢 ' + escP(o.buyerCo || o.buyerCd) + (o.buyerCd ? ' <span dir="ltr" style="opacity:.75">(' + escP(o.buyerCd) + ')</span>' : '') + '</small>' : '') +
    '</h3>' +
    /* v34.7.57: نظم بصری فرم — اول هویت سند (کارفرما/درخواست/تاریخ)، بعد تنظیمات چاپ و
       اعتبار در یک ردیف متوازن، بعد امضا (طبق MOB-041 همچنان پیش از اقلام)، بعد اقلام. */
    '<div class="fr">' +
    '<div class="fld"><label>کارفرما (خریدار) *</label><div style="position:relative;display:flex;gap:6px;align-items:flex-start">' +
      '<input type="text" id="ofBuyerAc" autocomplete="off" placeholder="نام مشتری… (تایپ کنید و از فهرست انتخاب کنید)" oninput="offerBuyerAcSearch()" onfocus="offerBuyerAcSearch()" style="flex:1;min-width:0;padding:8px 10px;border:1px solid var(--brd);border-radius:10px;font-family:inherit;font-size:12.5px"' +
        (o.buyerCd || o.buyerCo ? ' value="' + escP((function () { try { var cc = getData('ptf_crm_customers').filter(function (x) { return x.cd === o.buyerCd; })[0]; return (cc && window.offerBuyerAcLabel(cc)) || o.buyerCo || ''; } catch (eV) { return o.buyerCo || ''; } })()) + '"' : '') + '>' +
      '<button type="button" class="bt bt-o" style="padding:8px 10px;white-space:nowrap;font-size:11.5px" onclick="offerBuyerToggleFull()" title="نمایش لیست کشویی کامل مشتریان">📋 لیست کامل</button>' +
      '<div id="ofBuyerAcBox" dir="rtl" style="position:absolute;top:100%;right:0;left:76px;z-index:3000;background:#fff;border:1px solid var(--brd);border-radius:10px;box-shadow:0 10px 24px rgba(15,23,42,.16);max-height:240px;overflow:auto;display:none"></div>' +
    '</div>' +
    '<select id="ofBuyer" onchange="offerPickBuyer(this.value)" style="display:none;margin-top:6px">' + custOpts + '</select>' +
    '<div id="ofBuyerChip" style="margin-top:8px;padding:8px 10px;border-radius:12px;background:#f8fafc;border:1px solid var(--brd);font-size:12.5px;line-height:1.6">' +
    (o.buyerCd || o.buyerCo
      ? ('🏢 کارفرما انتخاب‌شده: ' + (typeof ptfOfferBuyerLabel === 'function'
          ? ptfOfferBuyerLabel(
              (function(){ try { return getData('ptf_crm_customers').filter(function(x){return x.cd===o.buyerCd;})[0]; } catch(e){ return null; } })(),
              o.buyerCo
            ).html
          : escP(o.buyerCo || o.buyerCd)))
      : '<span style="color:#94a3b8">هنوز کارفرما انتخاب نشده</span>') +
    '</div></div>' +
    '<div class="fld"><label>شخص رابط خریدار</label><select id="ofContact" onchange="offerPickContact(this.value)"><option>—</option></select></div>' +
    '</div>' +
    '<div id="ofCreditBox"></div>' + /* v14.6 US-352: مانده باز + سقف اعتبار مشتری */
    '<div class="fr">' +
    // US-175 AC1: فقط انتخاب از شماره‌های ثبت‌شده در «استعلامات» / اقلام درخواست
    '<div class="fld"><label>شماره درخواست کارفرما * — فقط از استعلام‌های ثبت‌شده</label><select id="ofInq" style="direction:ltr" onchange="offerPickInq(this.value)"' + (typeof ptfInqNoOptions === 'function' ? '>' + ptfInqNoOptions(o.inqNo, o.buyerCd) : '>') + '</select>' +
    '<small style="color:#94a3b8;font-size:11px">فقط درخواست‌های کارفرمای انتخاب‌شده. شماره‌ای نیست؟ ابتدا در «استعلامات» ثبتش کنید.</small>' +
    /* FC-7 (v34.7.30 — تصمیم کارفرما): نرخ مرجع ویرایش‌شده همیشه روی «قلم درخواست» می‌نشیند؛
       نشستن روی «بانک کالا» فقط با همین تیک صریح انجام می‌شود. */
    '<label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#5b21b6;margin-top:4px" title="در صورت تیک، نرخ مرجع ویرایش‌شدهٔ اقلام روی نرخ مرجع کالا در بانک کالا هم ثبت می‌شود">' +
    '<input type="checkbox" id="ofRefToCatalog"> نرخ مرجع اصلاح‌شده در بانک کالا هم ثبت شود</label></div>' +
    '<div class="fld"><label>تاریخ سند (شمسی) — ذخیره سیستمی به میلادی</label>' + (typeof ptfDatePicker==='function' ? ptfDatePicker('ofDateJ', (o.dateEn || new Date().toISOString().slice(0, 10))) : '<input type="text" id="ofDateJ" style="direction:ltr;color:#0e7490" value="' + escP((typeof ptfISOToJ==='function' ? ptfISOToJ(o.dateEn || new Date().toISOString().slice(0, 10)) : (o.dateEn || ''))) + '">') + '</div>' +
    '</div>' +
    /* v20.1: TC در CO ادغام شد — تفاوت فقط قالب/عنوان چاپ.
       v34.7.57: قالب چاپ + اعتبار پیشنهاد (US-157) در یک ردیف متوازن (قبلاً ستون خالی داشت). */
    (o.kind !== 'TO'
      ? '<div class="fr">' +
        '<div class="fld offer-print-layout"><label>🖨 قالب چاپ سند</label><select id="ofPrintAs"><option value="CO"' + ((o.printAs || (o.kind === 'TC' ? 'TC' : 'CO')) === 'CO' ? ' selected' : '') + '>💰 Commercial Offer (مالی)</option><option value="TC"' + ((o.printAs || (o.kind === 'TC' ? 'TC' : 'CO')) === 'TC' ? ' selected' : '') + '>🤝 Techno-Commercial Offer (فنی-مالی)</option></select></div>' +
        '<div class="fld"><label>اعتبار پیشنهاد تا (شمسی) — یادآور خودکار ۳ روز قبل</label>' + (typeof ptfDatePicker==='function' ? ptfDatePicker('ofValidJ', (o.validUntil || defaultValidity(o.dateEn))) : '<input type="text" id="ofValidJ" style="direction:ltr;color:#0e7490" value="' + escP((typeof ptfISOToJ==='function' ? ptfISOToJ(o.validUntil || defaultValidity(o.dateEn)) : (o.validUntil || ''))) + '">') + '</div>' +
        '</div>'
      : '') +
    '<div class="fr offer-seller-row">' +
    // Contact Person = اختصاری انگلیسی کاربر جاری — غیرقابل تغییر
    '<div class="fld offer-seller-field"><label>رابط فروشنده — روی سند: Contact Person (کاربر جاری — قفل 🔒)</label><input type="text" id="ofSeller" value="' + escP(myEnName()) + '" readonly style="direction:ltr;background:#f1f5f9;color:#475569;cursor:not-allowed"></div>' +
    '</div>' +
    signatureHtml +
    '<h4 class="offer-sec-title">📦 اقلام</h4>' +
    '<div class="offer-items-toolbar">' +
    '<button type="button" id="offInqBtn" class="bt" style="font-size:12px;background:#7c3aed" onclick="offLoadInqItems()">🗂 بارگذاری از درخواست</button>' +
    '<button type="button" id="offOtherInqBtn" class="bt" style="font-size:12px;background:#0f766e" title="اقلام یک درخواست دیگر را به همین پیشنهاد اضافه می‌کند؛ شماره درخواست فعلی تغییر نمی‌کند" onclick="offLoadOtherInqItems()">📂 بارگذاری از درخواست دیگر</button>' +
    '<span class="offer-toolbar-sep" aria-hidden="true"></span>' +
    '<button type="button" class="bt bt-o" style="font-size:12px" onclick="offOpenProductMultiPicker()">➕ از ماژول کالا</button>' +
    '<button type="button" class="bt bt-o" style="font-size:12px" onclick="ptfShowExcelGuidelineModal(\'OFFER\', \'offXls\')">📥 ورود اکسل</button>' +
    '<button type="button" class="bt bt-o" style="font-size:12px" onclick="offPriceXlsOpen()" title="نرخ مرجع و قیمت واحد اقلام فعلی را از فایل اکسل پر می‌کند — برای فهرست‌های بلند">💰 قیمت از اکسل</button>' +
    '<button type="button" class="bt bt-o" style="font-size:12px;margin-inline-start:auto" onclick="offShowAdvCols()">⛭ ستون‌های تکمیلی</button>' +
    '<input type="file" id="offXls" accept=".csv,.xlsx,.xls" style="display:none" onchange="offImportFile(this)">' +
    '</div>' +
    '<div id="offItemsWrap" style="overflow-x:auto"></div>' +
    '<h4 class="offer-sec-title">📜 شرایط و ضوابط (Terms &amp; Conditions)</h4>' +
    '<div id="offTermsWrap"></div>' +
    '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' +
    '<select id="offTcLib" style="flex:1;padding:7px;border:1px solid var(--brd);border-radius:8px;direction:ltr;font-size:12px">' +
    TC_LIBRARY.map(function(t, i){ return '<option value="' + i + '">' + escP(t.slice(0, 80)) + '</option>'; }).join('') +
    '</select>' +
    '<button type="button" class="bt bt-o" style="font-size:12px" onclick="offAddTermLib()">+ از کتابخانه</button>' +
    '<button type="button" class="bt bt-o" style="font-size:12px" onclick="offAddTerm(\'\')">+ بند دلخواه</button>' +
    '</div>' +
    /* v34.7.57: فوتر چسبان — در فهرست‌های بلند دکمه ذخیره همیشه در دید است.
       قرارداد case-revision حفظ شده: h3 عنوان، #offSaveBtn داخل گروه دکمه‌ها،
       والدِ والد = کانتینر اکشن‌ها و دکمهٔ اول همان «انصراف» است. */
    '<div class="offer-form-footer">' +
    '<div class="offer-footer-btns">' +
    '<button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt bt-o" onclick="offerPreview()">👁️ پیش‌نمایش</button>' +
    '<button type="button" class="bt bt-o" style="color:#047857;border-color:#6ee7b7" onclick="offerPrintCurrent()" title="خروجی رسمی بدون watermark پیش‌نمایش — از وضعیت فعلی فرم">🖨 چاپ / PDF رسمی</button>' +
    '<button type="button" class="bt" id="offSaveBtn" onclick="window.offerSave()">💾 ذخیره</button>' +
    '</div></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  offRenderItems(); offRenderTerms(); offSyncTcLib();
  /* v21.4 BUG-039: ست صریح .value بعد از insert (selected attribute در برخی مرورگرها/مودال‌های مک‌استایل کافی نیست)
     + پر کردن رابط/تلفن و حفظ inqNo بدون اجبار انتخاب مجدد */
  try {
    var buyerEl = (typeof offEl === 'function') ? offEl('ofBuyer') : document.getElementById('ofBuyer');
    var inqEl = (typeof offEl === 'function') ? offEl('ofInq') : document.getElementById('ofInq');
    if (buyerEl && o.buyerCd) {
      buyerEl.value = o.buyerCd;
      if (buyerEl.value !== o.buyerCd) {
        /* option نبود — اضافه کن */
        var opt = document.createElement('option');
        opt.value = o.buyerCd;
        opt.textContent = o.buyerCo || o.buyerCd;
        opt.selected = true;
        buyerEl.appendChild(opt);
        buyerEl.value = o.buyerCd;
      }
    }
    if (inqEl && o.inqNo) {
      inqEl.value = o.inqNo;
      if (inqEl.value !== o.inqNo) {
        var opt2 = document.createElement('option');
        opt2.value = o.inqNo;
        opt2.textContent = o.inqNo + ' (سند)';
        opt2.selected = true;
        inqEl.appendChild(opt2);
        inqEl.value = o.inqNo;
      }
    }
  } catch (eSet) {}
  if (o.buyerCd) {
    try { offerPickBuyer(o.buyerCd, true); } catch (ePB) {}
    try { if (typeof ptfOfferRefreshBuyerChip === 'function') ptfOfferRefreshBuyerChip(o.buyerCd); } catch (eCh2) {}
    /* keep=true گاهی رابط را خالی می‌گذارد اگر نام match نشود — بازیابی صریح */
    try {
      if (o.buyerContact) {
        var cEl = (typeof offEl === 'function') ? offEl('ofContact') : document.getElementById('ofContact');
        var cRec = getData('ptf_crm_customers').filter(function (x) { return x.cd === o.buyerCd; })[0];
        if (cEl && cRec && cRec.people && cRec.people.length) {
          var pi = -1;
          cRec.people.forEach(function (p, i) {
            if (p.nm === o.buyerContact || p.nmEn === o.buyerContact) pi = i;
          });
          if (pi < 0) pi = 0;
          cEl.value = String(pi);
        }
      }
    } catch (eCt) {}
  } else {
    try { if (typeof ptfOfferRefreshBuyerChip === 'function') ptfOfferRefreshBuyerChip(''); } catch (eCh3) {}
  }
}

/* ===== v14.6 (US-352 — نقشه راه مصوب): مانده مطالبات باز مشتری =====
   مانده = مجموع (مبلغ فاکتور − وصولی‌ها) روی فاکتورهای CO های همین مشتری */
window.ptfCustOpenBalance = function (custCd) {
  var offers = getData('ptf_crm_offers');
  var invs = getData('ptf_crm_invoices');
  var myCOs = {};
  offers.forEach(function (o) { if (o.buyerCd === custCd && (o.kind === 'CO' || o.kind === 'TC')) myCOs[o.no] = 1; });
  var open = 0, cnt = 0;
  invs.forEach(function (inv) {
    if (!myCOs[inv.offerNo] || inv.status === 'void' || inv.st === 'void' || inv.status === 'superseded') return;
    var payRows = (inv.payments || []).concat(inv.pays || []).filter(window.PTF && window.PTF.isPaymentActive ? window.PTF.isPaymentActive : function(){return true});
    var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(inv) : payRows.reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
    var remain = Math.max(0, (+inv.amount || 0) - paid);
    if (remain > 0) { open += remain; cnt++; }
  });
  return { open: open, cnt: cnt };
};
/* نمایش باکس مانده/سقف زیر انتخاب کارفرما در فرم CO/TC */
window.ptfRenderCreditBox = function (custCd) {
  var box = (typeof offEl === 'function') ? offEl('ofCreditBox') : document.getElementById('ofCreditBox');
  if (!box) return;
  if (!custCd || !window._offState || (_offState.kind !== 'CO' && _offState.kind !== 'TC')) { box.innerHTML = ''; return; }
  if (typeof roleDef === 'function' && !(roleDef() || {}).sellPrice) { box.innerHTML = ''; return; }
  var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === custCd; })[0];
  if (!c) { box.innerHTML = ''; return; }
  var bal = ptfCustOpenBalance(custCd);
  var limit = +c.creditLimit || 0;
  var overNow = limit > 0 && bal.open > limit;
  box.innerHTML = '<div data-noix style="font-size:12px;border-radius:10px;padding:8px 12px;margin:4px 0 8px;line-height:1.9;background:' + (overNow ? '#fef2f2;border:1px solid #fecaca' : bal.open > 0 ? '#fffbeb;border:1px solid #fcd34d' : '#f0fdf4;border:1px solid #bbf7d0') + '">' +
    '💰 مانده مطالبات باز این مشتری: <b style="color:' + (bal.open > 0 ? '#b45309' : '#047857') + '">' + bal.open.toLocaleString('fa-IR') + ' ریال</b>' + (bal.cnt ? ' <small>(' + bal.cnt + ' فاکتور باز)</small>' : '') +
    (limit > 0 ? ' | سقف اعتبار: <b>' + limit.toLocaleString('fa-IR') + '</b>' + (overNow ? ' — <b style="color:#dc2626">⛔ از سقف عبور کرده!</b>' : '') : ' | <small style="color:#94a3b8">سقف اعتبار تعیین نشده (فرم مشتری)</small>') + '</div>';
};

// v121: بازگردانی offerPickBuyer — در ریفکتور v90..v120 حذف شده بود ولی ۳ نقطه
// (onchange کشویی کارفرما، offerForm، offerPickInq) هنوز آن را صدا می‌زنند → ReferenceError
function offerPickBuyer(cd, keep) {
  var c = getData('ptf_crm_customers').filter(function(x){ return x.cd === cd; })[0];
  _offState.buyerCd = cd;
  try { ptfRenderCreditBox(cd); } catch (eCB) {} /* v14.6 US-352 */
  try { if (typeof window.offRefreshInqOptions === 'function') window.offRefreshInqOptions(cd, keep); } catch (eInqRef) {}
  var sel = document.getElementById('ofContact');
  if (!c) { if (sel) sel.innerHTML = '<option>—</option>'; return; }
  _offState.buyerCo = c.coEn || c.co;
  var people = c.people || [];
  var pp = primaryPerson(c);
  if (sel) {
    sel.innerHTML = people.map(function(p, i) {
      return '<option value="' + i + '"' + ((keep && (_offState.buyerContact === p.nm || _offState.buyerContact === p.nmEn)) || (!keep && p === pp) ? ' selected' : '') + '>' + escP(p.nm) + (p.nmEn ? ' / ' + escP(p.nmEn) : '') + ' (' + escP(p.role || '') + ')</option>';
    }).join('') || '<option>—</option>';
  }
  if (!keep && pp) {
    _offState.buyerContact = pp.nmEn || pp.nm;
    _offState.buyerTel = pp.tels && pp.tels.length ? fmtTel(pp.tels[0]) : (pp.mobs && pp.mobs.length ? pp.mobs[0].n : '');
  } else if (keep && pp && !_offState.buyerContact) {
    /* v21.4 BUG-039: ویرایش بدون buyerContact ذخیره‌شده → حداقل رابط اصلی */
    _offState.buyerContact = pp.nmEn || pp.nm;
    if (!_offState.buyerTel) {
      _offState.buyerTel = pp.tels && pp.tels.length ? fmtTel(pp.tels[0]) : (pp.mobs && pp.mobs.length ? pp.mobs[0].n : '');
    }
  }
  /* اطمینان: select کارفرما مقدار buyerCd را دارد */
  try {
    var bSel = document.getElementById('ofBuyer');
    if (bSel && cd && bSel.value !== cd) bSel.value = cd;
  } catch (eBS) {}
  try { if (typeof ptfOfferRefreshBuyerChip === 'function') ptfOfferRefreshBuyerChip(cd); } catch (eChip) {}
}

/* v15.4 (US-386 — کیس استادی کارفرما): هر درخواست دو شناسه دارد (کد سیستمی r.cd + شماره کارفرما r.inqNo).
   TO ممکن است با یکی ثبت شده باشد و کاربر در فرم CO دیگری را انتخاب کند → مقایسه exact شکست می‌خورد
   و پیغام غلط «پیشنهاد فنی ثبت نشده» می‌آمد. این تابع همه نام‌های مستعار یک شماره را برمی‌گرداند. */
window.offRefreshInqOptions = function (buyerCd, keepCur) {
  var inqEl = (typeof offEl === 'function') ? offEl('ofInq') : document.getElementById('ofInq');
  if (!inqEl || String(inqEl.tagName || '').toUpperCase() !== 'SELECT') return;
  var cur = String(inqEl.value || (_offState && _offState.inqNo) || '').trim();
  var belongs = !cur || (typeof window.ptfInqBelongsToCustomer !== 'function') || window.ptfInqBelongsToCustomer(cur, buyerCd);
  var keepVal = (keepCur || belongs) ? cur : '';
  if (typeof ptfInqNoOptions === 'function') inqEl.innerHTML = ptfInqNoOptions(keepVal, buyerCd || '');
  if (keepVal) {
    inqEl.value = keepVal;
    if (inqEl.value !== keepVal) {
      var opt = document.createElement('option');
      opt.value = keepVal; opt.textContent = keepVal + ' (سند)'; opt.selected = true;
      inqEl.appendChild(opt); inqEl.value = keepVal;
    }
  }
  if (_offState && !keepCur && !belongs) _offState.inqNo = inqEl.value || '';
};

window.ptfInqAliases = function (v) {
  var out = [];
  if (v) out.push(v);
  try {
    getData('ptf_crm_rfqs').forEach(function (r) {
      if (r.cd === v || (r.inqNo && r.inqNo === v)) {
        if (r.cd && out.indexOf(r.cd) < 0) out.push(r.cd);
        if (r.inqNo && out.indexOf(r.inqNo) < 0) out.push(r.inqNo);
      }
    });
  } catch (e) {}
  return out;
};

// US-209 & US-235: قفل دوطرفه + پیشنهاد جامع فنی-مالی (TC)
window.offerPickInq = function(inqNo) {
  _offState.inqNo = inqNo;
  /* FB-3 (v34.7.30): انتخاب درخواست = بارگذاری خودکار اقلام همان درخواست.
     پیش از این کاربر باید دکمهٔ جداگانه می‌زد و آن مسیر (به‌دلیل FB-1/FB-2) بی‌اثر بود.
     فقط وقتی جدول اقلام هنوز خالی است بارگذاری خودکار انجام می‌شود تا کار کاربر پاک نشود؛
     در غیر این‌صورت دکمهٔ 🗂 با همان منطق ضدتکرار در اختیار اوست. */
  try {
    if (inqNo && typeof window.offLoadInqItems === 'function') {
      var _busy = (_offState.items || []).some(function (it) { return typeof offRowIsEmpty === 'function' ? !offRowIsEmpty(it) : false; });
      if (!_busy) window.offLoadInqItems(inqNo);
    }
  } catch (eAuto) {}
  var buyerSel = document.getElementById('ofBuyer');
  if (!buyerSel) return;
  if (!inqNo) {
    buyerSel.disabled = false;
    buyerSel.style.background = '#fff';
    return;
  }
  var rfqs = getData('ptf_crm_rfqs');
  var r = rfqs.filter(function(x){ return x.cd === inqNo || x.inqNo === inqNo; })[0];
  if (r && r.co) {
    var custs = getData('ptf_crm_customers');
    var matchedCust = custs.filter(function(c){
      return c.co === r.co || (c.coEn && c.coEn === r.co) || r.co.indexOf(c.co) > -1 || c.co.indexOf(r.co) > -1;
    })[0];
    if (matchedCust) {
      buyerSel.value = matchedCust.cd;
      offerPickBuyer(matchedCust.cd, true);
      buyerSel.disabled = false; // اسپرینت ۱۰۲: قفل مشتری برداشته شد
      buyerSel.style.background = '#f1f5f9';
    }
  }
  
  // US-235: بررسی وجود پیشنهاد فنی قبل از مالی — پیشنهاد جامع TC
  /* v15.4 (US-386): ① مقایسه با همه نام‌های مستعار شماره درخواست (رفع پیغام غلط «TO ثبت نشده»)
     ② اگر TO موجود بود و فرم CO خالی است → انتقال عینی کارفرما/رابط/اقلام/بندها از TO با تایید کاربر */
  if (_offState.kind === 'CO') {
    var offers = getData('ptf_crm_offers');
    var aliases = (typeof ptfInqAliases === 'function') ? ptfInqAliases(inqNo) : [inqNo];
    var tos = offers.filter(function(o){ return o.kind === 'TO' && aliases.indexOf(o.inqNo) > -1; });
    if (!tos.length) {
      /* v20.1: سند همان CO می‌ماند — فقط قالب چاپ فنی-مالی پیشنهاد می‌شود */
      if (confirm('ℹ️ برای این استعلام قبلاً پیشنهاد فنی (TO) صادر نشده است.\nآیا مایلید این پیشنهاد مالی با «قالب چاپ فنی-مالی (Techno-Commercial)» صادر شود؟')) {
        _offState.printAs = 'TC';
        var pSel = document.getElementById('ofPrintAs');
        if (pSel) pSel.value = 'TC';
        if (typeof ptfToast === 'function') ptfToast('🤝 قالب چاپ سند: فنی-مالی (Techno-Commercial) — ماهیت سند همان پیشنهاد مالی است', 'ok');
      }
    } else if (!_offState.srcToNo) {
      var to = tos[tos.length - 1]; /* آخرین TO این درخواست */
      var blank = !(_offState.items || []).some(function(it){ return (it.name || it.desc || it.pcode); });
      if (blank && confirm('📋 پیشنهاد فنی «' + to.no + '» برای همین درخواست ثبت شده است.\n\nمشخصات کارفرما و اقلام آن عینا در این پیشنهاد مالی بنشیند؟ (توصیه می‌شود — فقط قیمت‌ها را وارد می‌کنید)')) {
        _offState.srcToNo = to.no; /* پس از ذخیره، دکمه →CO روی TO قفل می‌شود (US-142 AC5) */
        _offState.buyerCd = to.buyerCd || _offState.buyerCd;
        _offState.buyerCo = to.buyerCo || _offState.buyerCo;
        _offState.buyerContact = to.buyerContact || _offState.buyerContact;
        _offState.buyerTel = to.buyerTel || _offState.buyerTel;
        if (to.subject && !_offState.subject) _offState.subject = to.subject;
        try {
          if (to.extraCols && to.extraCols.length) _offState.extraCols = JSON.parse(JSON.stringify(to.extraCols));
          if (to.terms && to.terms.length && !(_offState.terms || []).length) _offState.terms = JSON.parse(JSON.stringify(to.terms));
          _offState.items = JSON.parse(JSON.stringify(to.items || []));
        } catch (eCp) {}
        _offState.items.forEach(function(it){ it.price = it.price || 0; });
        if (buyerSel && _offState.buyerCd) { buyerSel.value = _offState.buyerCd; }
        if (_offState.buyerCd) { try { offerPickBuyer(_offState.buyerCd, true); } catch (ePB) {} }
        if (typeof offRenderItems === 'function') try { offRenderItems(); } catch (eRI) {}
        if (typeof offRenderTerms === 'function') try { offRenderTerms(); } catch (eRT) {}
        if (typeof ptfToast === 'function') ptfToast('📋 مشخصات و اقلام از ' + to.no + ' عینا منتقل شد — فقط قیمت‌ها را وارد کنید', 'ok');
      }
    }
  }
};

function offerPickContact(idx) {
  var c = getData('ptf_crm_customers').filter(function(x){ return x.cd === _offState.buyerCd; })[0];
  if (!c || !c.people || !c.people[idx]) return;
  var p = c.people[idx];
  _offState.buyerContact = p.nmEn || p.nm;
  _offState.buyerTel = p.tels && p.tels.length ? fmtTel(p.tels[0]) : (p.mobs && p.mobs.length ? p.mobs[0].n : '');
}

// ---- فاز ۲ AC7: ستون‌های داینامیک با عرض هوشمند ----
var MAX_EXTRA_COLS = 99; // US-183: بدون محدودیت (فونت پلکانی کوچک می‌شود)
window.offShowAdvCols = function() {
  var html = '<div class="md-b" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px">' +
    '<h3>⛭ ستون‌های تکمیلی</h3>' +
    '<p style="font-size:12.5px;color:#475569">شما می‌توانید ستون‌های دلخواه (مانند Country of Origin، Warranty و غیره) به جدول اقلام اضافه کنید. توجه: افزودن ستون‌های متعدد باعث کوچک شدن پلکانی فونت چاپ سند می‌شود.</p>' +
    '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button type="button" class="bt" onclick="offAddColumn();this.closest(\'.md-b\').remove()">＋ افزودن ستون جدید</button>' +
    '<button type="button" class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button>' +
    '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};
function offAddColumn() {
  _offState.extraCols = _offState.extraCols || [];
  if (_offState.extraCols.length >= MAX_EXTRA_COLS) {
    alert('حداکثر ' + MAX_EXTRA_COLS + ' ستون اضافه مجاز است تا خروجی از عرض A4 لنداسکیپ خارج نشود.\nپیشنهاد: ستون‌های کم‌اهمیت را حذف یا در Description ادغام کنید.');
    return;
  }
  var name = prompt('نام ستون جدید (انگلیسی — روی سند چاپ می‌شود):', '');
  if (!name || !name.trim()) return;
  _offState.extraCols.push(name.trim());
  _offState.items.forEach(function (it) { it.extra = it.extra || {}; });
  offRenderItems();
}
function offDelColumn(ci) {
  if (!confirm('ستون «' + _offState.extraCols[ci] + '» حذف شود؟')) return;
  var name = _offState.extraCols[ci];
  _offState.extraCols.splice(ci, 1);
  _offState.items.forEach(function (it) { if (it.extra) delete it.extra[name]; });
  offRenderItems();
}
// عرض هوشمند: با افزایش ستون‌ها فونت سند پلکانی کوچک می‌شود (در offerPrintObj اعمال می‌شود)
function offSmartFont() {
  var n = (_offState && _offState.extraCols ? _offState.extraCols.length : 0);
  return n === 0 ? 10 : n === 1 ? 9.5 : n === 2 ? 9 : n <= 4 ? 8.5 : n <= 6 ? 8 : 7.5; // px پایه جدول چاپ
}

// US-208: ثبت خلاصه اقلام در کالا و تفکیک هوشمند برند و مدل
window.ptfAutoRegisterSummaryProducts = function(inqNo, rows) {
  if (!rows || !rows.length) return 0;
  var prods = getData('ptf_crm_products');
  var added = 0;
  rows.forEach(function(r) {
    var desc = (r.nm || r.name || '').trim();
    if (!desc) return;
    var dup = prods.some(function(p) { return p.nm === desc || (p.st && p.st === (r.spec||r.desc||'')); });
    if (dup) return;
    var cd = (typeof prodAutoCode === 'function') ? prodAutoCode() : 'P-' + (1000 + prods.length + 1);
    var concise = desc;
    if (concise.length > 68) concise = concise.slice(0, 66) + '..';
    prods.push({
      cd: cd, nm: concise, en: '', ca: (typeof ptfNormCat === 'function' ? ptfNormCat(r.tp) : (r.tp || 'سایر')), /* v15.9 US-389: دسته فارسی استاندارد */
      st: r.spec || r.desc || desc, br: r.brand || '', md: r.model || r.md || '', /* v15.9: مدل حفظ می‌شود */
      un: r.un || r.unit || 'عدد', pr: 0,
      ds: 'خلاصه اتوماتیک از استعلام ' + inqNo, srcInq: inqNo, tp: r.tp || 'Other', ts: new Date().toISOString()
    });
    added++;
  });
  if (added > 0) {
    /* v34.8.23 (W1-iterate): از مسیر فرمان اتمیک */
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', prods, { reason: 'offer-auto-products' });
    else setData('ptf_crm_products', prods);
    if (typeof addLog === 'function') addLog('ثبت اتوماتیک ' + added + ' کالای خلاصه در ماژول کالا');
  }
  return added;
};

window.ptfIntelligentParseItem = function(it) {
  var desc = ((it.desc || '') + ' ' + (it.name || '')).trim();
  var brand = (it.brand || '').trim();
  var model = (it.model || '').trim();
  if (!brand) {
    var brands = ['Rosemount','WIKA','Yokogawa','Endress+Hauser','Siemens','ABB','Honeywell','Samson','Fisher','Swagelok','Flowserve','KROHNE','FOXBORO','Masoneilan','Ashcroft','Vega','Danfoss','Spirax Sarco','Rotork','Cameron'];
    for (var bi=0; bi<brands.length; bi++) {
      if (new RegExp('\\b' + brands[bi] + '\\b', 'i').test(desc)) { brand = brands[bi]; break; }
    }
  }
  if (!model) {
    var mMatch = desc.match(/\b(3051[A-Z0-9]+|232\.[0-9]+[A-Z0-9]*|EJA[A-Z0-9]+|PMP[0-9]+[A-Z0-9]*|SITRANS\s+[A-Z0-9]+|[A-Z0-9]{5,}-[A-Z0-9-]+)\b/i);
    if (mMatch) {
      model = mMatch[1];
      if (!brand) {
        if (/^3051/i.test(model)) brand = 'Rosemount';
        else if (/^232\./i.test(model)) brand = 'WIKA';
        else if (/^EJA/i.test(model)) brand = 'Yokogawa';
        else if (/^PMP/i.test(model)) brand = 'Endress+Hauser';
      }
    }
  }
  it.brand = brand;
  it.model = model;
  if (!it.name || it.name === it.desc) {
    var concise = it.name || it.desc;
    if (concise.length > 60) concise = concise.slice(0, 58) + '..';
    it.name = concise;
  }
  return it;
};

// ---- v31.7.97 BUG-OFFER-DUP-ITEMS-001: ریشه‌کنی تکرار اقلام پیشنهاد ----
function offNormLine(v) {
  v = String(v == null ? '' : v);
  try { if (typeof dedupNorm === 'function') return dedupNorm(v); } catch (e) {}
  return v.toLowerCase().replace(/\s+/g, ' ').trim();
}
function offItemKey(it) {
  it = it || {};
  return [
    offNormLine(it.pcode || it.prodCd || ''),
    offNormLine(it.name || it.nm || it.en || ''),
    offNormLine(it.desc || it.st || it.spec || ''),
    offNormLine(it.model || it.md || ''),
    offNormLine(it.brand || it.br || ''),
    String(+it.qty || 1),
    offNormLine(it.unit || it.un || 'NO')
  ].join('|');
}
function offItemHasCommercialValue(it) {
  return !!(it && (+it.price > 0 || +it.refBuyPrice > 0 || it.refPriceEdited || it.pcode || it.prodCd));
}
function offDedupeOfferItems(items) {
  items = Array.isArray(items) ? items : [];
  var out = [], seen = {}, removed = 0;
  items.forEach(function (it) {
    if (!it) return;
    var key = offItemKey(it);
    var empty = !it.pcode && !String(it.name || '').trim() && !String(it.desc || '').trim() && !String(it.model || '').trim();
    if (!key || empty) { out.push(it); return; }
    /* v34.7.56 (BUG-OFFER-DUP-SKIP-267): ردیف‌های هم‌محتوا ولی با هویت خط متمایز
       (id ذخیره‌شده یا مبدأ+نوبت تکرار) مشروع‌اند و نباید هنگام ذخیره حذف شوند.
       فقط تکرارهای واقعاً بی‌هویتِ هم‌محتوا (دستی/legacy) مثل قبل جمع می‌شوند. */
    var ident = it.id ? 'id:' + it.id
      : ((it.sourceInq && it.sourceItemKey) ? 'src:' + it.sourceInq + '|' + it.sourceItemKey + '|' + (+it.dupOrdinal || 0) : 'manual');
    key = key + '||' + ident;
    var prevIdx = seen[key];
    if (prevIdx == null) { seen[key] = out.length; out.push(it); return; }
    var prev = out[prevIdx];
    /* اگر یکی از دو ردیف قیمت/کد/داده تجاری دارد، همان نگه داشته شود و صفر/تکراری حذف شود. */
    if (!offItemHasCommercialValue(prev) && offItemHasCommercialValue(it)) out[prevIdx] = it;
    removed++;
  });
  return { items: out, removed: removed };
}
window.offItemKey = offItemKey;
window.offDedupeOfferItems = offDedupeOfferItems;

/* v31.8 BUG-OFFER-SYNC-INTEGRITY-001: offer line identity must survive a
   price/quantity edit and cross-device sync. A price change is an update to
   the same business line, never a new line. Legacy lines receive an ID only
   at a normal, explicit offer save (not while merely rendering a document). */
function offEnsureOfferLineIds(items, offerNo) {
  var used = {};
  (Array.isArray(items) ? items : []).forEach(function (it, index) {
    if (!it || offRowIsEmpty(it)) return;
    var id = String(it.lineId || '').trim();
    if (!id || used[id]) {
      var rnd = (typeof crypto !== 'undefined' && crypto.getRandomValues)
        ? Array.prototype.map.call(crypto.getRandomValues(new Uint32Array(2)), function (n) { return n.toString(36); }).join('')
        : (Date.now().toString(36) + '-' + index + '-' + Math.random().toString(36).slice(2, 8));
      id = 'OL-' + String(offerNo || 'NEW').replace(/[^A-Za-z0-9-]/g, '') + '-' + rnd;
      it.lineId = id;
    }
    used[id] = true;
  });
  return items;
}
window.offEnsureOfferLineIds = offEnsureOfferLineIds;

/* v31.8: explicit, exact-only repair preview. It never runs during sync and
   never removes semantically similar but non-identical commercial lines. */
function offExactDuplicatePreview(items) {
  var seen = {}, kept = [], duplicates = [], before = 0, after = 0;
  (Array.isArray(items) ? items : []).forEach(function (it, index) {
    before += (+((it || {}).qty) || 0) * (+((it || {}).price) || 0);
    var sig; try { sig = JSON.stringify(it || {}); } catch (e) { sig = String(it || ''); }
    if (seen[sig] != null) { duplicates.push({ index: index, originalIndex: seen[sig], item: it }); return; }
    seen[sig] = index; kept.push(it); after += (+((it || {}).qty) || 0) * (+((it || {}).price) || 0);
  });
  return { items: kept, duplicates: duplicates, beforeCount: (items || []).length, afterCount: kept.length, beforeTotal: before, afterTotal: after, delta: before - after };
}
window.ptfOfferIntegrityPreview = function (no) {
  var offer = (getData('ptf_crm_offers') || []).filter(function (x) { return x.no === no; })[0];
  if (!offer) return { ok:false, error:'offer-not-found' };
  var p = offExactDuplicatePreview(offer.items || []); p.ok = true; p.no = no; return p;
};
window.ptfOfferIntegrityDialog = function (no) {
  var p = window.ptfOfferIntegrityPreview(no);
  if (!p.ok) return;
  var money = function (n) { return (+n || 0).toLocaleString('fa-IR') + ' ریال'; };
  var body = '<div style="line-height:2;font-size:13px"><b dir="ltr">'+escP(no)+'</b><br>'+
    '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px;margin-top:8px">وضعیت فعلی: <b>'+p.beforeCount+' آیتم</b> — <b>'+money(p.beforeTotal)+'</b><br>پس از تعمیر: <b>'+p.afterCount+' آیتم</b> — <b>'+money(p.afterTotal)+'</b><br>ردیف تکراری کاملاً یکسان: <b>'+p.duplicates.length+'</b></div>'+
    (p.duplicates.length ? '<p style="color:#9a3412">این پیش‌نمایش هیچ داده‌ای را تغییر نمی‌دهد. فقط ردیف‌های JSON کاملاً یکسان در صورت تأیید حذف می‌شوند.</p>' : '<p style="color:#047857">✅ ردیف تکراری کاملاً یکسان پیدا نشد.</p>')+'</div>';
  if (typeof ptfDialog === 'function') ptfDialog({ title:'🔎 بررسی سلامت اقلام پیشنهاد', body:body, okText:p.duplicates.length?'اعمال تعمیر کنترل‌شده':'بستن', cancelText:'انصراف', onOk:function(){ if(p.duplicates.length) window.ptfOfferIntegrityApply(no); } });
  else alert('بررسی سلامت '+no+'\n'+p.beforeCount+' → '+p.afterCount+' آیتم\n'+money(p.beforeTotal)+' → '+money(p.afterTotal));
};
window.ptfOfferIntegrityApply = function (no) {
  var p = window.ptfOfferIntegrityPreview(no);
  if (!p.ok || !p.duplicates.length) return p;
  if (!confirm('⚠️ تعمیر پیشنهاد '+no+'\n\nتعداد: '+p.beforeCount+' → '+p.afterCount+'\nمبلغ: '+p.beforeTotal.toLocaleString('fa-IR')+' → '+p.afterTotal.toLocaleString('fa-IR')+' ریال\n\nفقط '+p.duplicates.length+' ردیف کاملاً یکسان حذف می‌شود. ادامه می‌دهید؟')) return { ok:false, cancelled:true };
  var offers = getData('ptf_crm_offers') || [], target = offers.filter(function (x) { return x.no === no; })[0];
  if (!target) return { ok:false, error:'offer-not-found' };
  target.items = p.items; offEnsureOfferLineIds(target.items, target.no); target.updatedAtISO = new Date().toISOString();
  target._integrityRepair = { at: target.updatedAtISO, exactDuplicatesRemoved: p.duplicates.length, beforeCount:p.beforeCount, afterCount:p.afterCount, beforeTotal:p.beforeTotal, afterTotal:p.afterTotal, policy:'exact-only-v31.8' };
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_offers', offers, { reason: 'w4' }); else setData('ptf_crm_offers', offers);
  try { audit('پیشنهادها', 'تعمیر کنترل‌شده پیشنهاد '+no+': '+p.beforeCount+' → '+p.afterCount+' ردیف؛ حذف '+p.duplicates.length+' duplicate دقیق', no); } catch(e) {}
  if (typeof renderOffers === 'function') renderOffers();
  return Object.assign({ ok:true }, p);
};

// ---- US-124 AC2: بارگذاری اقلام درخواست از ایمپورت‌های قبلی ----
/* ============================================================================
   FB-2 / FC-2 (v34.7.30) — حل واحد «درخواست» و اقلام آن
   ریشهٔ باگ: کشویی فرم پیشنهاد مقدارش «کد سیستمی RFQ» است (dedup.js: ptfKnownInqList)
   ولی اقلام در ptf_crm_inqitems با «شمارهٔ درخواست کارفرما» (inqNo) ذخیره می‌شوند و
   شرط قبلی `r.cd === inq` کد خود قلم (IQI-…) را می‌سنجید. نتیجه: «اقلامی یافت نشد».
   قاعده: همهٔ نام‌های مستعار یک درخواست (cd و inqNo) با هم دیده می‌شوند — هم‌راستا با
   قرارداد هویت رکورد (ARCHITECTURE-GUARDRAILS.md).
   ========================================================================== */
window.ptfResolveInqRequest = function (key) {
  var k = String(key == null ? '' : key).trim();
  var out = { key: k, rfq: null, aliases: [], rows: [], source: '' };
  if (!k) return out;
  var rfq = (getData('ptf_crm_rfqs') || []).filter(function (r) {
    return r && (String(r.cd || '') === k || String(r.inqNo || '') === k);
  })[0] || null;
  out.rfq = rfq;
  var als = {};
  [k, rfq && rfq.cd, rfq && rfq.inqNo].forEach(function (v) { var x = String(v || '').trim(); if (x) als[x] = true; });
  out.aliases = Object.keys(als);
  function hit(v) { return !!als[String(v || '').trim()]; }
  var rows = (getData('ptf_crm_inqitems') || []).filter(function (r) { return r && hit(r.inqNo); });
  if (rows.length) out.source = 'inqitems';
  if (!rows.length) {
    var rd = (getData('ptf_crm_inqreads') || []).filter(function (r) { return r && (hit(r.inqNo) || hit(r.cd)); })[0];
    if (rd && (rd.rows || []).length) { rows = rd.rows; out.source = 'inqreads'; }
  }
  if (!rows.length && rfq && (rfq.items || []).length) { rows = rfq.items; out.source = 'rfq.items'; }
  out.rows = rows || [];
  return out;
};

/* FC-2 (v34.7.30) — نرخ مرجع مؤثر یک قلم: زنجیرهٔ قطعی و قابل توضیح.
   ۱) نرخ دستی همان قلم در پیشنهاد  ۲) نرخ مرجع قلم درخواست  ۳) بهترین قیمت استعلام تامین
   ۴) نرخ مرجع بانک کالا. خروجی: {price, cur, src, at, from} — نبود مرجع ⇒ price=0 */
window.ptfItemRefPrice = function (item, opt) {
  opt = opt || {};
  var res = { price: 0, cur: 'IRR', src: '', at: '', from: '' };
  if (!item) return res;
  if (item.refPriceEdited && +item.refPrice > 0) {
    return { price: +item.refPrice, cur: item.refCur || 'IRR', src: 'offer', at: item.refAt || '', from: 'دستی در پیشنهاد' };
  }
  /* ۲) قلم درخواست */
  try {
    var reqRows = opt.reqRows;
    if (!reqRows && opt.inqNo && typeof window.ptfResolveInqRequest === 'function') reqRows = window.ptfResolveInqRequest(opt.inqNo).rows;
    if (reqRows && reqRows.length && typeof window.ptfResolveProcurementLine === 'function') {
      var m = window.ptfResolveProcurementLine(item, reqRows);
      if (m.ok && +m.item.refPrice > 0) {
        return { price: +m.item.refPrice, cur: m.item.refCur || 'IRR', src: 'request', at: m.item.refAt || '', from: 'قلم درخواست' };
      }
    }
  } catch (e1) {}
  /* ۳) استعلام تامین */
  try {
    var best = (typeof window.ptfOfferBestBuyRef === 'function') ? +window.ptfOfferBestBuyRef(item) || 0 : 0;
    if (best > 0) return { price: best, cur: opt.quoteCur || 'IRR', src: 'rfqsmart', at: '', from: 'استعلام تامین' };
  } catch (e2) {}
  /* ۴) بانک کالا */
  try {
    var prods = getData('ptf_crm_products') || [];
    if (prods.length && typeof window.ptfResolveProcurementLine === 'function') {
      var pm = window.ptfResolveProcurementLine(item, prods);
      if (pm.ok && +pm.item.pr > 0) {
        return { price: +pm.item.pr, cur: pm.item.prCur || 'IRR', src: 'catalog', at: pm.item.refPriceAt || '', from: 'بانک کالا' };
      }
    }
  } catch (e3) {}
  return res;
};

/* v34.7.47: پارس امن مبلغ (ارقام فارسی/عربی + جداکننده هزارگان) — منبع واحد فرم پیشنهاد */
window.offParseMoney = function (v) {
  if (typeof ptfNum === 'function') return ptfNum(v);
  return +String(v == null ? '' : v)
    .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
    .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
    .replace(/[^\d.-]/g, '') || 0;
};
window.offMoneyText = function (v, cur) {
  var n = window.offParseMoney(v);
  if (typeof offerFmtMoney === 'function') {
    return offerFmtMoney(n, cur || (typeof offerCurrency === 'function' && window._offState ? offerCurrency(window._offState) : { id: 'IRR' }));
  }
  return n ? n.toLocaleString('en-US') : '';
};
window.offPriceWordsText = function (v, cur) {
  var n = Math.round(window.offParseMoney(v));
  if (!n) return '';
  var unit = (cur && cur.id === 'EUR') ? 'یورو' : (cur && cur.id === 'USD') ? 'دلار' : 'ریال';
  if (typeof ptfNumWordsFa !== 'function') return '';
  return '✍️ ' + ptfNumWordsFa(n) + ' ' + unit;
};
window.offPrintAmount = function (v, cur) {
  var s = window.offMoneyText(v, cur);
  return (typeof ptfEnDigits === 'function') ? ptfEnDigits(s) : s;
};

/* فهرست درخواست‌های دارای اقلام — هر درخواست یک‌بار (cd سیستمی)، بدون تکرار alias */
window.offListLoadableInquiries = function (opt) {
  opt = opt || {};
  var buyerCd = (opt.buyerCd != null) ? String(opt.buyerCd).trim() : '';
  var filterBuyer = Object.prototype.hasOwnProperty.call(opt, 'buyerCd');
  var exclude = {};
  (opt.exclude || []).forEach(function (k) {
    k = String(k || '').trim();
    if (!k) return;
    exclude[k] = true;
    try {
      if (typeof window.ptfResolveInqRequest === 'function') {
        (window.ptfResolveInqRequest(k).aliases || []).forEach(function (a) { if (a) exclude[String(a)] = true; });
      }
    } catch (eEx) {}
  });
  var seen = {}, out = [];
  function push(key, buyer) {
    key = String(key || '').trim();
    if (!key || seen[key] || exclude[key]) return;
    var resolved = (typeof window.ptfResolveInqRequest === 'function')
      ? window.ptfResolveInqRequest(key)
      : { rows: [], aliases: [key] };
    (resolved.aliases || []).forEach(function (a) { if (a) seen[String(a)] = true; });
    seen[key] = true;
    if (exclude[key]) return;
    if (filterBuyer) {
      var rfqHit = resolved.rfq || null;
      if (typeof window.ptfInqBelongsToCustomer === 'function') {
        if (!window.ptfInqBelongsToCustomer(rfqHit || key, buyerCd)) return;
      } else if (buyerCd && rfqHit && rfqHit.custCd && String(rfqHit.custCd) !== buyerCd) return;
      else if (filterBuyer && !buyerCd) return;
    }
    var n = (resolved.rows || []).length;
    if (!n) return;
    var rfq = resolved.rfq || {};
    var clientNo = rfq.inqNo && rfq.inqNo !== key ? rfq.inqNo : '';
    out.push({
      key: key,
      label: key + (clientNo ? ' ⇐ ' + clientNo : ''),
      buyer: buyer || rfq.co || '',
      count: n,
      rows: resolved.rows
    });
  }
  (getData('ptf_crm_rfqs') || []).forEach(function (r) {
    if (!r) return;
    push(r.cd || r.inqNo, r.co || '');
  });
  (getData('ptf_crm_inqitems') || []).forEach(function (r) { if (r && r.inqNo) push(r.inqNo, ''); });
  (getData('ptf_crm_inqreads') || []).forEach(function (r) {
    if (r && (r.inqNo || r.cd) && (r.rows || []).length) push(r.inqNo || r.cd, '');
  });
  out.sort(function (a, b) { return String(b.key).localeCompare(String(a.key)); });
  return out;
};

window.offBuildItemFromInqRow = function (r, inq) {
  r = r || {};
  var item = {
    name: r.nm || r.name || r.en || '',
    desc: r.st || r.spec || r.desc || r.nm || '',
    model: r.model || r.md || '',
    qty: r.qty || 1,
    unit: r.un || r.unit || 'عدد',
    brand: r.brand || '',
    dlv: '', price: 0,
    pcode: r.pcode || r.prodCd || r.productCd || '',
    sourceItemKey: (typeof window.ptfProcLineKey === 'function') ? window.ptfProcLineKey(r) : '',
    sourceInq: inq
  };
  if (r.tp) { item.extra = item.extra || {}; item.extra.Type = r.tp; }
  try {
    var _ref = window.ptfItemRefPrice(item, { inqNo: inq, reqRows: [r] });
    if (_ref && _ref.price > 0) {
      item.refPrice = _ref.price; item.refCur = _ref.cur;
      item.refSrc = _ref.src; item.refAt = _ref.at || '';
      item.refFrom = _ref.from;
    }
  } catch (eRef) {}
  if (typeof window.ptfIntelligentParseItem === 'function') window.ptfIntelligentParseItem(item);
  return item;
};

window.offAppendInqRows = function (inq, rows, opt) {
  opt = opt || {};
  rows = Array.isArray(rows) ? rows : [];
  if (!window._offState) return { added: 0, skipped: 0, withRef: 0 };
  if (typeof window.ptfAutoRegisterSummaryProducts === 'function') {
    try { window.ptfAutoRegisterSummaryProducts(inq, rows); } catch (eReg) {}
  }
  /* v34.7.56 (BUG-OFFER-DUP-SKIP-267): تشخیص تکراری هویت‌محور به‌جای محتوامحور.
     یک درخواست واقعی می‌تواند چند ردیف با نام/شرح/تعداد یکسان داشته باشد (مثلاً برای
     ساب‌پروژه/تگ‌های مختلف)؛ آن‌ها قلم تکراری نیستند. «تکراری» یعنی همان ردیفِ مبدأ
     (sourceInq + sourceItemKey + نوبت تکرار) قبلاً به این پیشنهاد اضافه شده باشد —
     مثل دوبار زدن دکمه بارگذاری. برای پیشنهادهای قدیمی بدون هویت مبدأ، امضای محتوایی
     به‌عنوان fallback مصرف می‌شود تا بارگذاری مجدد دوبله نسازد. */
  var srcCount = {};  /* هویت مبدأ ← تعداد موجود در پیشنهاد */
  var sigCount = {};  /* امضای محتوایی ردیف‌های بدون هویت مبدأ (legacy/دستی) */
  (_offState.items || []).forEach(function (it) {
    var nonEmpty = typeof offRowIsEmpty === 'function' ? !offRowIsEmpty(it) : (it && (it.name || it.desc));
    if (!nonEmpty) return;
    if (it.sourceInq && it.sourceItemKey) {
      var b0 = it.sourceInq + '|' + it.sourceItemKey;
      srcCount[b0] = (srcCount[b0] || 0) + 1;
    } else {
      var s0 = offItemKey(it);
      sigCount[s0] = (sigCount[s0] || 0) + 1;
    }
  });
  var seenBatch = {};
  var added = 0, skipped = 0;
  rows.forEach(function (r) {
    var item = window.offBuildItemFromInqRow(r, inq);
    var base = (item.sourceInq && item.sourceItemKey) ? item.sourceInq + '|' + item.sourceItemKey : '';
    if (base) {
      var have = srcCount[base] || 0;
      var seen = seenBatch[base] || 0;
      seenBatch[base] = seen + 1;
      if (seen < have) { skipped++; return; } /* همین ردیف مبدأ قبلاً در پیشنهاد هست */
      var sigL = offItemKey(item);
      if (!have && sigCount[sigL] > 0) { sigCount[sigL]--; skipped++; return; } /* تطبیق با ردیف legacy بدون هویت */
      item.dupOrdinal = seen; /* تفکیک ردیف‌های هم‌محتوای یک درخواست برای dedupe ذخیره */
    } else {
      var sig2 = offItemKey(item);
      if (sigCount[sig2] > 0) { skipped++; return; }
      sigCount[sig2] = 1;
    }
    if (typeof offSmartInsert === 'function') offSmartInsert(item, true);
    else { _offState.items = _offState.items || []; _offState.items.push(item); }
    added++;
  });
  if (!opt.keepInq) {
    _offState.inqNo = inq;
    var inqEl = document.getElementById('ofInq');
    if (inqEl && !inqEl.value) {
      var hasOpt = false;
      for (var oi = 0; oi < (inqEl.options || []).length; oi++) if (inqEl.options[oi].value === inq) hasOpt = true;
      if (!hasOpt && inqEl.tagName === 'SELECT') {
        var op = document.createElement('option'); op.value = inq; op.textContent = inq + ' (اقلام ایمپورت‌شده)';
        inqEl.appendChild(op);
      }
      inqEl.value = inq;
    }
  }
  if (typeof offRenderItems === 'function') offRenderItems();
  var withRef = 0;
  (_offState.items || []).forEach(function (x) { if (+x.refPrice > 0) withRef++; });
  return { added: added, skipped: skipped, withRef: withRef };
};

function offLoadInqItems(pickedInq, opt) {
  /* US-303: pickedInq از دیالوگ انتخاب می‌آید؛ وگرنه شماره انتخاب‌شده فرم
     v34.7.47: opt.keepInq = افزودن از درخواست دیگر بدون تغییر شماره این پیشنهاد */
  opt = opt || {};
  if (opt === true) opt = { keepInq: true };
  if (opt.keepInq && !pickedInq) { window.offLoadOtherInqItems(); return; }
  var inq = pickedInq || (document.getElementById('ofInq') || {}).value || _offState.inqNo || '';
  inq = String(inq).trim();
  if (!inq) {
    var buyerCdPick = String((_offState && _offState.buyerCd) || (document.getElementById('ofBuyer') || {}).value || '').trim();
    if (!buyerCdPick) {
      alert('ابتدا کارفرما را از منوی کشویی انتخاب کنید تا فقط درخواست‌های همان مشتری فهرست شوند.');
      return;
    }
    var loadable = (typeof window.offListLoadableInquiries === 'function')
      ? window.offListLoadableInquiries({ buyerCd: buyerCdPick })
      : [];
    if (!loadable.length) {
      /* US-303: راهنمای شفاف — اقلام درخواست باید هنگام ثبت استعلام وارد شده باشد */
      alert('برای این کارفرما درخواستی با اقلام ثبت‌شده وجود ندارد.\n\nاقلام درخواست را از یکی از این مسیرها وارد کنید:\n• استعلامات → دکمه «اقلام» روی ردیف درخواست (دستی یا اکسل)\n• هنگام ثبت استعلام جدید (پنجره اقلام خودکار باز می‌شود)\n• دستیار → خواندن فایل استعلام');
      return;
    }
    /* US-303: انتخاب از فهرست به‌جای prompt متنی — فقط درخواست‌های همین کارفرما */
    var pick = '<div class="md-b" id="offInqPick" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px">' +
      '<h3>🗂 انتخاب درخواست همین کارفرما</h3>' +
      loadable.map(function (g) {
        return '<button type="button" class="bt bt-o" style="width:100%;justify-content:space-between;display:flex;margin-bottom:6px" ' +
          'onclick="document.getElementById(\'offInqPick\').remove();offLoadInqItems(\'' + ptfOnClickArg(g.key) + '\')">' +
          '<span style="direction:ltr">' + escP(g.label || g.key) + '</span><span style="color:#7c3aed;font-weight:800">' + g.count + ' قلم</span></button>';
      }).join('') +
      '<div style="text-align:left;margin-top:6px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', pick);
    return;
  }
  /* FB-2 (v34.7.30): حل درخواست با همهٔ نام‌های مستعار (کد سیستمی RFQ + شمارهٔ کارفرما) */
  var _resolved = window.ptfResolveInqRequest(inq);
  var rows = (opt.rows && opt.rows.length) ? opt.rows : _resolved.rows;
  if (!rows.length) {
    /* FB-4: پیام دقیق به‌جای سکوت یا باز شدن دوبارهٔ فهرست */
    alert('برای درخواست «' + inq + '» هیچ قلمی ثبت نشده است.\n\nاقلام را از یکی از این مسیرها وارد کنید:\n• استعلامات ← ویرایش استعلام و اقلام\n• درخواست تامین ← ثبت اقلام\nسپس دوباره همین دکمه را بزنید.');
    return;
  }
  var result = window.offAppendInqRows(inq, rows, opt);
  var added = result.added, skipped = result.skipped, _withRef = result.withRef;
  var keepNote = opt.keepInq ? '\n📌 شماره درخواست این پیشنهاد تغییر نکرد.' : '';
  alert('✅ ' + added + ' قلم از درخواست ' + inq + (opt.keepInq ? ' به پیشنهاد افزوده شد' : ' بارگذاری شد') + (skipped ? ' — ' + skipped + ' قلم تکراری رد شد' : '') +
    (_withRef ? '\n💰 نرخ مرجع ' + _withRef + ' قلم از ' + (_resolved.source === 'inqitems' ? 'اقلام درخواست' : 'منابع پرونده') + ' بارگذاری شد.' : '\nℹ️ برای این اقلام نرخ مرجعی ثبت نشده است (اقلام درخواست / استعلام تامین / بانک کالا).') +
    keepNote + '\nبرند و قیمت فروش را در همین جدول تکمیل کنید.');
}
window.offLoadInqItems = offLoadInqItems;

/* v34.7.47: بارگذاری اقلام از درخواست دیگر — بدون تغییر شماره درخواست فعلی */
window.offLoadOtherInqItems = function () {
  if (!window._offState) { alert('⛔ فرم پیشنهاد باز نیست'); return; }
  var current = (_offState.inqNo || (document.getElementById('ofInq') || {}).value || '').trim();
  var buyerCd = String(_offState.buyerCd || (document.getElementById('ofBuyer') || {}).value || '').trim();
  if (!buyerCd) {
    alert('ابتدا کارفرما را از منوی کشویی انتخاب کنید تا فقط درخواست‌های همان مشتری فهرست شوند.');
    return;
  }
  var list = window.offListLoadableInquiries({ exclude: current ? [current] : [], buyerCd: buyerCd });
  if (!list.length) {
    alert('برای این کارفرما درخواست دیگری با اقلام ثبت‌شده پیدا نشد.\n\nابتدا اقلام درخواست مبدأ را در «استعلامات» وارد کنید، سپس دوباره این دکمه را بزنید.');
    return;
  }
  var old = document.getElementById('offOtherInqDlg');
  if (old) old.remove();
  var rows = list.map(function (g) {
    return '<button type="button" class="bt bt-o off-other-inq-btn" data-inq="' + escP(g.key) + '" style="width:100%;justify-content:space-between;display:flex;margin-bottom:6px;align-items:center;gap:8px" ' +
      'onclick="offLoadOtherInqReview(\'' + ptfOnClickArg(g.key) + '\')">' +
      '<span style="text-align:right"><b dir="ltr">' + escP(g.label) + '</b>' +
      (g.buyer ? '<br><small style="color:#64748b">' + escP(g.buyer) + '</small>' : '') + '</span>' +
      '<span style="color:#0f766e;font-weight:800;white-space:nowrap">' + g.count + ' قلم</span></button>';
  }).join('');
  var html = '<div class="md-b" id="offOtherInqDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px;max-height:90vh;overflow:auto">' +
    '<h3>📂 افزودن اقلام از درخواست دیگر</h3>' +
    '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;font-size:12px;color:#065f46;margin-bottom:10px">فقط درخواست‌های <b>همین کارفرما</b> دیده می‌شوند. شماره درخواست این پیشنهاد <b>تغییر نمی‌کند</b>. اقلام انتخاب‌شده به جدول فعلی اضافه می‌شوند (تکراری‌ها رد می‌شوند).</div>' +
    (current ? '<div style="font-size:12px;color:#64748b;margin-bottom:8px">درخواست فعلی پیشنهاد: <b dir="ltr">' + escP(current) + '</b></div>' : '') +
    '<input type="search" id="offOtherInqSrch" placeholder="جستجوی شماره / کارفرما..." oninput="offFilterOtherInqList(this.value)" style="width:100%;padding:8px 10px;border:1px solid var(--brd);border-radius:10px;margin-bottom:10px">' +
    '<div id="offOtherInqList">' + rows + '</div>' +
    '<div style="text-align:left;margin-top:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};
window.offFilterOtherInqList = function (q) {
  q = String(q || '').trim().toLowerCase();
  document.querySelectorAll('#offOtherInqList .off-other-inq-btn').forEach(function (b) {
    var hay = (b.textContent || '').toLowerCase();
    b.style.display = !q || hay.indexOf(q) > -1 ? '' : 'none';
  });
};
window.offLoadOtherInqReview = function (inq) {
  inq = String(inq || '').trim();
  var resolved = (typeof window.ptfResolveInqRequest === 'function') ? window.ptfResolveInqRequest(inq) : { rows: [] };
  var rows = resolved.rows || [];
  if (!rows.length) { alert('برای این درخواست قلمی ثبت نشده است.'); return; }
  var dlg = document.getElementById('offOtherInqDlg');
  if (dlg) dlg.remove();
  window._offOtherInqPick = { inq: inq, rows: rows };
  var body = rows.map(function (r, i) {
    var nm = r.nm || r.name || r.en || '—';
    var spec = r.st || r.spec || r.desc || '';
    return '<label style="display:flex;gap:8px;align-items:flex-start;padding:8px 6px;border-bottom:1px dashed var(--brd);cursor:pointer">' +
      '<input type="checkbox" class="off-other-inq-row" value="' + i + '" checked style="margin-top:3px">' +
      '<span style="flex:1"><b>' + escP(nm) + '</b>' +
      (spec && spec !== nm ? '<br><small style="color:#64748b">' + escP(spec) + '</small>' : '') +
      '<br><small style="color:#0f766e">' + escP(r.qty || 1) + ' ' + escP(r.un || r.unit || 'عدد') + '</small></span></label>';
  }).join('');
  var html = '<div class="md-b" id="offOtherInqDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:90vh;overflow:auto">' +
    '<h3>📂 انتخاب اقلام — <span dir="ltr">' + escP(inq) + '</span></h3>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px">' +
    '<button type="button" class="bt bt-o" style="font-size:11.5px" onclick="document.querySelectorAll(\'#offOtherInqDlg .off-other-inq-row\').forEach(function(c){c.checked=true})">☑ همه</button>' +
    '<button type="button" class="bt bt-o" style="font-size:11.5px" onclick="document.querySelectorAll(\'#offOtherInqDlg .off-other-inq-row\').forEach(function(c){c.checked=false})">☐ هیچ‌کدام</button></div>' +
    '<div style="max-height:50vh;overflow:auto;border:1px solid var(--brd);border-radius:10px;padding:4px 10px">' + body + '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
    '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove();offLoadOtherInqItems()">بازگشت</button>' +
    '<button class="bt" style="background:#0f766e;color:#fff" onclick="offLoadOtherInqApply(\'' + ptfOnClickArg(inq) + '\')">➕ افزودن اقلام انتخاب‌شده</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};
window.offLoadOtherInqApply = function (inq) {
  var pick = window._offOtherInqPick || {};
  var srcRows = pick.rows || ((typeof window.ptfResolveInqRequest === 'function') ? window.ptfResolveInqRequest(inq).rows : []);
  var selected = [];
  document.querySelectorAll('#offOtherInqDlg .off-other-inq-row:checked').forEach(function (el) {
    var row = srcRows[+el.value];
    if (row) selected.push(row);
  });
  var dlg = document.getElementById('offOtherInqDlg');
  if (dlg) dlg.remove();
  window._offOtherInqPick = null;
  if (!selected.length) { alert('حداقل یک قلم را تیک بزنید.'); return; }
  window.offLoadInqItems(inq, { keepInq: true, rows: selected });
};

// ---- اقلام ----
/* v12.6 (US-310): درج هوشمند — کالای جدید در اولین ردیف خالی می‌نشیند، نه انتهای لیست.
   ردیف خالی = بدون کد قفل و بدون شرح (ردیف پیش‌فرض US-278 که کاربر پرش نکرده). */
window.offRowIsEmpty = function (it) {
  return !it.pcode && !String(it.name || '').trim() && !String(it.desc || '').trim() && !String(it.model || '').trim();
};
window.offSmartInsert = function (item, force) {
  if (!window._offState) return;
  if (!_offState.items) _offState.items = [];
  function _fallbackKey(x) { return [String((x&&x.pcode)||''), String((x&&x.name)||''), String((x&&x.desc)||''), String((x&&x.model)||''), String((x&&x.brand)||''), String(+(x&&x.qty)||1), String((x&&x.unit)||'NO')].join('|').toLowerCase().replace(/\s+/g, ' ').trim(); }
  var _keyFn = (typeof window.offItemKey === 'function') ? window.offItemKey : _fallbackKey;
  var key = _keyFn(item);
  /* v34.7.56: force = تصمیم تکراری‌بودن قبلاً با هویت مبدأ گرفته شده (offAppendInqRows)؛
     ردیف هم‌محتوای مشروع از یک درخواست نباید این‌جا بی‌صدا حذف شود. */
  if (!force) {
    for (var e = 0; e < _offState.items.length; e++) {
      if (!offRowIsEmpty(_offState.items[e]) && _keyFn(_offState.items[e]) === key) return e;
    }
  }
  for (var i = 0; i < _offState.items.length; i++) {
    if (offRowIsEmpty(_offState.items[i])) { _offState.items[i] = item; return i; }
  }
  _offState.items.push(item);
  return _offState.items.length - 1;
};
function offAddItem(pre) {
  var item = pre || { name: '', desc: '', model: '', qty: 1, unit: 'NO', brand: '', dlv: '', price: 0 };
  if (typeof window !== 'undefined' && typeof window.offSmartInsert === 'function') window.offSmartInsert(item);
  else _offState.items.push(item);
  offRenderItems();
}

function prodSrchRender() {
  var el = document.getElementById('prodSrchList');
  if (!el) return;
  var q = ((document.getElementById('prodSrchInp')||{}).value || '').trim().toLowerCase();
  var prods = getData('ptf_crm_products').filter(function(p) {
    return !q || ((p.nm||'')+' '+(p.en||'')+' '+(p.cd||'')+' '+(p.st||'')+' '+(p.br||'')).toLowerCase().indexOf(q) > -1;
  }).slice(0, 40);
  el.innerHTML = prods.map(function(p) {
    return '<div onclick="prodSrchPick(\'' + ptfOnClickArg(p.cd) + '\')" style="padding:9px 12px;border:1px solid var(--brd);border-radius:10px;margin-bottom:5px;cursor:pointer;font-size:12.5px" onmouseover="this.style.background=\'#fff8f5\'" onmouseout="this.style.background=\'#fff\'">' +
      '<b>' + escP(p.nm) + '</b>' + (p.en ? ' <span style="color:#64748b;direction:ltr;display:inline-block">/ ' + escP(p.en) + '</span>' : '') +
      '<div style="font-size:11px;color:#94a3b8;margin-top:2px">' + escP(p.cd) + (p.st ? ' | ' + escP(p.st) : '') + (p.br ? ' | ' + escP(p.br) : '') + ' | واحد: ' + escP(p.un||'-') + '</div></div>';
  }).join('') || '<div style="text-align:center;color:#94a3b8;padding:16px;font-size:12.5px">کالایی با این جستجو یافت نشد</div>';
}

function prodSrchPick(cd) {
  var p = getData('ptf_crm_products').filter(function(x){ return x.cd === cd; })[0];
  if (!p) return;
  offAddItem({ name: p.en || p.nm, desc: p.ds || p.st || '', model: p.st || '', qty: 1, unit: p.un && PRODUCT_EN_UNITS.indexOf(p.un) > -1 ? p.un : 'NO', brand: p.br || '', dlv: '', price: p.pr || 0 });
  var mds = document.querySelectorAll('.md-b');
  if (mds.length) mds[mds.length-1].remove();
}
var PRODUCT_EN_UNITS = ['No','PCS','Set','Meter','Branch','KG','Pack','EA','NO'];

/* v25.5: واحد انگلیسی یکسان برای اسناد چاپی (جلوگیری از «عدد» فارسی روی CO/TO) */
window.ptfOfferUnitEn = function (u) {
  u = String(u == null ? '' : u).trim();
  if (!u) return 'NO';
  var map = {
    'عدد': 'NO', 'عددی': 'NO', 'عدد.': 'NO', 'no': 'NO', 'No': 'NO', 'NO': 'NO', 'pcs': 'PCS', 'PCS': 'PCS',
    'دستگاه': 'Set', 'ست': 'Set', 'set': 'Set', 'Set': 'Set',
    'متر': 'Meter', 'm': 'Meter', 'Meter': 'Meter', 'meter': 'Meter',
    'کیلوگرم': 'KG', 'kg': 'KG', 'KG': 'KG',
    'بسته': 'Pack', 'pack': 'Pack', 'Pack': 'Pack',
    'شاخه': 'Branch', 'branch': 'Branch', 'Branch': 'Branch',
    'ea': 'EA', 'EA': 'EA'
  };
  if (map[u]) return map[u];
  // اگر از قبل انگلیسی/لاتین است نگه دار
  if (/^[A-Za-z]{1,12}$/.test(u)) return u.toUpperCase() === 'NO' ? 'NO' : (u.length <= 3 ? u.toUpperCase() : u);
  return 'NO';
};


function offUpdExtra(i, col, v) { _offState.items[i].extra = _offState.items[i].extra || {}; _offState.items[i].extra[col] = v; ptfTriggerAutoDraftSave(); }
function offDelItem(i) { _offState.items.splice(i, 1); offRenderItems(); ptfTriggerAutoDraftSave(); }
function ptfOfferBestBuyRef(it) {
  var best = +((it || {}).bestBuyPrice || 0);
  try {
    var st = window._offState || {};
    if (!best && st.inqNo && typeof window.ptfResolveProcurementAcross === 'function') {
      /* FC-5 (v34.7.30): استعلام تامین ممکن است با «کد سیستمی RFQ» ساخته شده باشد و
         پیشنهاد «شمارهٔ کارفرما» را داشته باشد (یا برعکس). تطبیق تک‌کلیدی قبلی در این حالت
         خالی برمی‌گشت و bestBuyPrice هرگز خوانده نمی‌شد. */
      var _als = {}; _als[String(st.inqNo)] = true;
      try {
        if (typeof window.ptfResolveInqRequest === 'function') {
          (window.ptfResolveInqRequest(st.inqNo).aliases || []).forEach(function (a) { if (a) _als[a] = true; });
        }
      } catch (eAls) {}
      var rfqs = getData('ptf_crm_rfqsmart').filter(function (r) {
        return r && (_als[String(r.srcRfq || '')] || _als[String(r.no || '')] || _als[String(r.inqNo || '')]);
      });
      var link = window.ptfResolveProcurementAcross(it, rfqs, { offerNo: st.no });
      if (link.ok && link.line && link.line.item) best = +link.line.item.bestBuyPrice || 0;
    }
  } catch (e) {}
  return best;
}
window.ptfOfferBestBuyRef = ptfOfferBestBuyRef;

/* ===== v31.7.13 US-OFF-MARGIN: حاشیه سود کلی پیشنهاد (جمع خرید نسبت به جمع فروش) =====
   هر قلم درصد سود خودش را دارد؛ این helper حاشیه «کل صورت» را برمی‌گرداند.
   فقط اقلامی که نرخ مرجع خرید دارند در محاسبه می‌آیند (coverage گزارش می‌شود). */
function ptfOfferOverallMargin(o) {
  if (!o || !(o.kind === 'CO' || o.kind === 'TC') || !Array.isArray(o.items)) return null;
  var buy = 0, sell = 0, covered = 0, totalItems = 0;
  /* BUG-OFFER-FX-MARGIN-001: در نسخهٔ ریالی، فروش به ریال است. نسخه‌های
     قدیمی قبل از اصلاح، refPrice ارزی را بدون تسعیر کپی کرده‌اند؛ نرخ تبدیل
     ثبت‌شده را فقط برای همان legacy-row اعمال می‌کنیم. نسخه‌های جدید metadata
     fxConvertedCosts دارند و refPrice آنها از قبل ریالی است. */
  var legacyRialRate = (o.currency === 'IRR' && o.rialOf && o.fxConvert && +o.fxConvert.rate > 0) ? +o.fxConvert.rate : 0;
  o.items.forEach(function (it) {
    if (!it) return;
    var qty = +it.qty || 0, price = +it.price || 0;
    if (!qty || !price) return;
    totalItems++;
    var refP = +it.refPrice || +it.refBuyPrice || 0;
    if (refP > 0 && legacyRialRate && !(it.fxConvertedCosts && +it.fxConvertedCosts.rate > 0)) refP = Math.round(refP * legacyRialRate);
    if (refP > 0) { buy += qty * refP; sell += qty * price; covered++; }
  });
  if (!covered || buy <= 0) return { marginPct: null, coverage: covered, totalItems: totalItems, buyTotal: 0, sellTotal: 0 };
  return {
    marginPct: Math.round(((sell - buy) / buy) * 1000) / 10,
    coverage: covered, totalItems: totalItems,
    buyTotal: buy, sellTotal: sell
  };
}
window.ptfOfferOverallMargin = ptfOfferOverallMargin;
function offUpdItem(i, f, v) {
  _offState.items[i][f] = (f === 'qty' || f === 'price') ? ((typeof window.offParseMoney === 'function') ? window.offParseMoney(v) : ((typeof ptfNum === 'function') ? ptfNum(v) : +String(v).replace(/[^\d.-]/g, '') || 0)) : v; /* v19.6 US-438 + v34.7.47 ارقام فارسی */
  /* v17.0 (US-409 — گزارش کارفرما): TC هم مالی است؛ جمع ردیف + جمع کل هر دو لحظه‌ای — بدون رندر کامل (فوکوس نمی‌پرد) */
  if ((_offState.kind === 'CO' || _offState.kind === 'TC') && (f === 'qty' || f === 'price')) offRenderTotals(i);
  ptfTriggerAutoDraftSave();
}


/* ============ US-289 (Sprint 236): حاشیه سود پیش‌فرض و نرخ مرجع کالا برای تک‌تک اقلام پیشنهاد مالی ============ */
window.offApplyGlobalMargin = function () {
  var o = window._offState;
  if (!o || !o.items) return;
  var gmEl = document.getElementById('ofGlobalMargin');
  var margin = gmEl ? (+gmEl.value || 0) : 30;
  var prods = getData('ptf_crm_products');
  var updatedCount = 0;
  o.items.forEach(function (it, i) {
    var bPrice = typeof ptfOfferBestBuyRef === 'function' ? ptfOfferBestBuyRef(it) : 0;
    var refP = bPrice || +it.refBuyPrice || +it.refPrice || 0;
    if (!refP) {
      var pMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false };
      var p = pMatch.ok ? pMatch.item : null;
      if (p && +p.pr > 0) refP = +p.pr;
    }
    if (refP > 0) {
      it.refPrice = refP;
      it.marginPct = margin;
      it.price = Math.round(refP * (1 + margin / 100));
      updatedCount++;
    } else if (!it.marginPct) {
      it.marginPct = margin;
    }
  });
  offRenderItems();
  if (typeof ptfToast === 'function') ptfToast('⚡ حاشیه سود ' + margin + '٪ برای ' + updatedCount + ' قلم دارای نرخ مرجع محاسبه و اعمال شد', 'ok');
};

window.offUpdRefPrice = function (i, val) {
  var o = window._offState;
  if (!o || !o.items || !o.items[i]) return;
  var it = o.items[i];
  it.refPrice = (typeof window.offParseMoney === 'function') ? window.offParseMoney(val) : ((typeof ptfNum === 'function') ? ptfNum(val) : +String(val==null?'':val).replace(/[^\d.-]/g,'') || 0);
  it.refPriceEdited = true; /* v31.7.12: با ذخیره، روی نرخ مرجع کالا در ماژول کالا هم می‌نشیند */
  if (it.refPrice > 0 && typeof it.marginPct === 'number') {
    it.price = Math.round(it.refPrice * (1 + it.marginPct / 100));
  } else if (it.refPrice > 0 && +it.price > 0) {
    it.marginPct = Math.round(((+it.price / it.refPrice) - 1) * 1000) / 10;
  }
  offSyncRowInputs(i, 'ref'); /* v31.7.12 BUG-OFF-FOCUS-001: به‌جای رندر کامل — فوکوس نمی‌پرد */
};

window.offUpdMarginPct = function (i, val) {
  var o = window._offState;
  if (!o || !o.items || !o.items[i]) return;
  var it = o.items[i];
  it.marginPct = +val || 0;
  var bPrice = typeof ptfOfferBestBuyRef === 'function' ? ptfOfferBestBuyRef(it) : 0;
  var refP = bPrice || +it.refBuyPrice || +it.refPrice || 0;
  if (!refP) {
    var prods = getData('ptf_crm_products');
    var pMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false };
    var p = pMatch.ok ? pMatch.item : null;
    if (p && +p.pr > 0) refP = +p.pr;
    if (refP > 0) it.refPrice = refP;
  }
  if (refP > 0) {
    it.price = Math.round(refP * (1 + it.marginPct / 100));
  }
  offSyncRowInputs(i, 'margin'); /* v31.7.12 BUG-OFF-FOCUS-001: به‌جای رندر کامل — فوکوس نمی‌پرد */
};

/* ============ US-289 (Sprint 236): حاشیه سود پیش‌فرض و نرخ مرجع کالا برای تک‌تک اقلام پیشنهاد مالی ============ */
window.offApplyGlobalMargin = function () {
  var o = window._offState;
  if (!o || !o.items) return;
  var gmEl = document.getElementById('ofGlobalMargin');
  var margin = gmEl ? (+gmEl.value || 0) : 30;
  var prods = getData('ptf_crm_products');
  var updatedCount = 0;
  o.items.forEach(function (it, i) {
    var bPrice = typeof ptfOfferBestBuyRef === 'function' ? ptfOfferBestBuyRef(it) : 0;
  var refP = bPrice || +it.refBuyPrice || +it.refPrice || 0;
    if (!refP) {
      var pMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false };
      var p = pMatch.ok ? pMatch.item : null;
      if (p && +p.pr > 0) refP = +p.pr;
    }
    if (refP > 0) {
      it.refPrice = refP;
      it.marginPct = margin;
      it.price = Math.round(refP * (1 + margin / 100));
      updatedCount++;
    } else if (!it.marginPct) {
      it.marginPct = margin;
    }
  });
  offRenderItems();
  if (typeof ptfToast === 'function') ptfToast('⚡ حاشیه سود ' + margin + '٪ برای ' + updatedCount + ' قلم دارای نرخ مرجع محاسبه و اعمال شد', 'ok');
};

window.offUpdRefPrice = function (i, val) {
  var o = window._offState;
  if (!o || !o.items || !o.items[i]) return;
  var it = o.items[i];
  it.refPrice = (typeof window.offParseMoney === 'function') ? window.offParseMoney(val) : ((typeof ptfNum === 'function') ? ptfNum(val) : +String(val==null?'':val).replace(/[^\d.-]/g,'') || 0);
  it.refPriceEdited = true; /* v31.7.12: با ذخیره، روی نرخ مرجع کالا در ماژول کالا هم می‌نشیند */
  if (it.refPrice > 0 && typeof it.marginPct === 'number') {
    it.price = Math.round(it.refPrice * (1 + it.marginPct / 100));
  } else if (it.refPrice > 0 && +it.price > 0) {
    it.marginPct = Math.round(((+it.price / it.refPrice) - 1) * 1000) / 10;
  }
  offSyncRowInputs(i, 'ref'); /* v31.7.12 BUG-OFF-FOCUS-001: به‌جای رندر کامل — فوکوس نمی‌پرد */
};

window.offUpdMarginPct = function (i, val) {
  var o = window._offState;
  if (!o || !o.items || !o.items[i]) return;
  var it = o.items[i];
  it.marginPct = +val || 0;
  var bPrice = typeof ptfOfferBestBuyRef === 'function' ? ptfOfferBestBuyRef(it) : 0;
  var refP = bPrice || +it.refBuyPrice || +it.refPrice || 0;
  if (!refP) {
    var prods = getData('ptf_crm_products');
    var pMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false };
    var p = pMatch.ok ? pMatch.item : null;
    if (p && +p.pr > 0) refP = +p.pr;
    if (refP > 0) it.refPrice = refP;
  }
  if (refP > 0) {
    it.price = Math.round(refP * (1 + it.marginPct / 100));
  }
  offSyncRowInputs(i, 'margin'); /* v31.7.12 BUG-OFF-FOCUS-001: به‌جای رندر کامل — فوکوس نمی‌پرد */
};
function offRenderItems() {
  var el = (typeof offEl === 'function') ? offEl('offItemsWrap') : document.getElementById('offItemsWrap');
  if (!el || !_offState) return;
  var isCO = _offState.kind === 'CO' || _offState.kind === 'TC';
  var ec = _offState.extraCols || [];
  var ecHead = ec.map(function(c, ci){ return '<th>' + escP(c) + ' <a href="javascript:void(0)" onclick="offDelColumn(' + ci + ')" style="color:#dc2626;font-size:10px">✕</a></th>'; }).join('');
  var head = isCO
    ? '<tr><th>#</th><th>نام کالا (English Item Name)</th><th>شرح تکمیلی</th><th>مدل</th><th>تعداد</th><th>واحد</th><th>برند</th>' + ecHead + '<th style="background:#f5f3ff;color:#5b21b6" title="نرخ مرجع خرید از بانک کالا">نرخ مرجع خرید</th><th style="background:#fef3c7;color:#92400e" title="درصد حاشیه سود">(٪) سود</th><th>قیمت واحد (IRR)</th><th>جمع</th><th>✕</th></tr>'
    : '<tr><th>#</th><th>نام کالا (English Item Name)</th><th>شرح تکمیلی</th><th>تعداد</th><th>واحد</th><th>برند</th>' + ecHead + '<th>✕</th></tr>';

  var rows = '';
  _offState.items.forEach(function(it, i) {
    var inp = function(f, w, type) {
      var moneyAttr = f === 'price' ? ' id="off_price_' + i + '" data-money="1" data-words="1" data-unit="ریال" inputmode="numeric" autocomplete="off"' : '';
      var inputType = f === 'price' ? 'text' : (type || 'text');
      var shown = (f === 'price' && it[f]) ? ((typeof window.offMoneyText === 'function') ? window.offMoneyText(it[f]) : it[f]) : (it[f]||'');
      return '<input type="' + inputType + '" value="' + escP(shown) + '"' + moneyAttr + ' oninput="offUpdItem(' + i + ',\'' + f + '\',this.value)" style="width:' + w + ';padding:5px;border:1px solid var(--brd);border-radius:6px;direction:' + ((type==='number' || f==='price')?'ltr':'') + ';font-size:12px">';
    };
    var ecCells = ec.map(function(c){
      return '<td><input type="text" value="' + escP((it.extra||{})[c]||'') + '" oninput="offUpdExtra(' + i + ',\'' + ptfOnClickArg(c) + '\',this.value)" style="width:76px;padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px"></td>';
    }).join('');
    
    var bestBuyHtml = '';
    if (isCO && it.inqNo && it.itemIdx != null) {
      try {
        var buys = getData('ptf_crm_order_prices').filter(function (bp) { return bp.inqNo === it.inqNo && bp.itemIdx === it.itemIdx; });
        if (buys.length) {
          var minB = buys.reduce(function (min, b) { return (min === null || +b.irr < +min.irr) ? b : min; }, null);
          if (minB) bestBuyHtml = '<div style="font-size:10px;color:#059669;margin-top:2px">کمترین خرید: ' + (+minB.irr).toLocaleString('fa-IR') + ' ریال (' + escP(minB.sup) + ')</div>';
        }
      } catch (eB) {}
    }

    if (isCO) {
      var _bestBuy = typeof ptfOfferBestBuyRef === 'function' ? ptfOfferBestBuyRef(it) : 0;
      var _refP = _bestBuy || +it.refBuyPrice || +it.refPrice || 0;
      if (!_refP) {
        try {
          var prods = getData('ptf_crm_products');
          var refMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false };
          var pMatch = refMatch.ok ? refMatch.item : null;
          if (pMatch && +pMatch.pr > 0) _refP = +pMatch.pr;
        } catch(ePr) {}
      }
      var _mPct = (typeof it.marginPct === 'number') ? it.marginPct : (_refP > 0 && +it.price > 0 ? Math.round(((+it.price / _refP) - 1) * 1000) / 10 : '');
      rows += '<tr><td>' + (i + 1) + '</td><td>' + inp('name', '100%') + '</td><td>' + inp('desc', '100%') + '</td>' +
        '<td>' + inp('model', '86px') + '</td>' +
        '<td>' + inp('qty', '54px', 'number') + '</td><td>' + inp('unit', '50px') + '</td><td>' + inp('brand', '86px') + '</td>' + ecCells +
        '<td style="background:#fcfaff"><input type="text" inputmode="numeric" data-money="1" data-nohint="1" autocomplete="off" id="offRef' + i + '" value="' + escP(_refP ? ((typeof window.offMoneyText === 'function') ? window.offMoneyText(_refP) : _refP) : '') + '" oninput="offUpdRefPrice(' + i + ',this.value)" placeholder="نرخ مرجع" style="width:110px;direction:ltr;background:#f5f3ff;border:1px solid #ddd6fe;font-weight:bold;color:#5b21b6;padding:5px;border-radius:6px"></td>' +
        '<td style="background:#fffef0"><input type="number" id="offMg' + i + '" value="' + (_mPct) + '" oninput="offUpdMarginPct(' + i + ',this.value)" placeholder="30%" style="width:55px;direction:ltr;background:#fefce8;border:1px solid #fde047;font-weight:bold;color:#b45309;padding:5px;border-radius:6px"></td>' +
        '<td>' + inp('price', '92px', 'number') + bestBuyHtml + (_refP > 0 ? '<small style="display:block;color:#b45309;margin-top:2px">📈 حاشیه فعلی: ' + escP(_mPct === '' ? '—' : _mPct) + '٪</small>' : '') + '</td><td id="offRT' + i + '" class="off-money-total" style="white-space:nowrap;font-size:12px;font-weight:bold;font-variant-numeric:tabular-nums">' + ((typeof window.offPrintAmount === 'function') ? window.offPrintAmount((+it.qty||0)*(+it.price||0)) : ((+it.qty||0)*(+it.price||0)).toLocaleString('en-US')) + '</td>' +
        '<td><button type="button" onclick="offDelItem(' + i + ')" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td></tr>';
    } else {
      rows += '<tr><td>' + (i + 1) + '</td><td>' + inp('name', '100%') + '</td><td>' + inp('desc', '100%') + '</td>' +
        '<td>' + inp('qty', '54px', 'number') + '</td><td>' + inp('unit', '50px') + '</td><td>' + inp('brand', '86px') + '</td>' + ecCells +
        '<td><button type="button" onclick="offDelItem(' + i + ')" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td></tr>';
    }
  });

  var totalRow = '';
  if (isCO) {
    var total = _offState.items.reduce(function(s, it){ return s + (+it.qty||0)*(+it.price||0); }, 0);
    totalRow = '<tr style="font-weight:bold;background:#fff8f5"><td colspan="' + (8 + ec.length) + '" style="direction:ltr">GRAND TOTAL</td><td id="offGT" style="white-space:nowrap">' + ((typeof window.offPrintAmount === 'function') ? window.offPrintAmount(total) : total.toLocaleString('en-US')) + '</td><td></td></tr>';
  }

  var globalMarginBar = isCO ? '<div style="display:flex;justify-content:space-between;align-items:center;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 14px;margin-bottom:10px;flex-wrap:wrap;gap:10px">' +
    '<span style="font-size:12.5px;color:#5b21b6">📈 <b>حاشیه سود پیش‌فرض و نرخ مرجع کالا:</b><br><small style="color:#64748b">درصد سود دلخواه را وارد کرده و دکمه محاسبه را بزنید؛ سیستم قیمت واحد فروش را برای تمام اقلام دارای نرخ مرجع محاسبه می‌کند.</small></span>' +
    '<span style="display:flex;align-items:center;gap:6px"><input type="number" id="ofGlobalMargin" value="30" placeholder="30" style="width:65px;padding:6px;border:1.5px solid #8b5cf6;border-radius:8px;direction:ltr;font-weight:bold;text-align:center"> <b>٪</b> ' +
    '<button type="button" class="bt" style="background:#7c3aed;padding:6px 14px;font-size:12px" onclick="offApplyGlobalMargin()">⚡ محاسبه خودکار قیمت فروش تمام اقلام</button></span></div>' : '';

  el.innerHTML = globalMarginBar + '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead style="background:#f1f5f9">' + head + '</thead><tbody>' + rows + totalRow + '</tbody></table>' +
    (_offState.items.length ? '' : '<div style="color:#94a3b8;text-align:center;padding:14px;font-size:12px">ردیفی ثبت نشده</div>');
  if (typeof ptfMoneyRefresh === 'function') {
    try { ptfMoneyRefresh(el); } catch (eMoneyFb) {}
  }
}

window.offSetRefPrice = function(i, v) {
  if (!_offState || !_offState.items[i]) return;
  _offState.items[i].refBuyPrice = (typeof ptfNum === 'function') ? ptfNum(v) : (+String(v).replace(/[^\d.-]/g, '') || 0);
  ptfTriggerAutoDraftSave();
};
window.offStepProfitMargin = function(i, basePrice) {
  if (!_offState || !_offState.items[i]) return;
  var it = _offState.items[i];
  if (typeof it.profitMarginPct === 'undefined') {
    it.profitMarginPct = 15;
  } else {
    it.profitMarginPct += 5; // افزایش ۵ درصدی با هر کلیک
  }
  offApplyProfitMarginToRow(i, basePrice, it.profitMarginPct);
};

window.offCustomProfitMargin = function(i, basePrice) {
  if (!_offState || !_offState.items[i]) return;
  var it = _offState.items[i];
  var cur = typeof it.profitMarginPct !== 'undefined' ? it.profitMarginPct : 15;
  var ans = prompt('درصد ضریب سود مورد نظر را وارد کنید (مثلاً 15 یا 22.5):', cur);
  if (ans === null || ans.trim() === '') return;
  var val = parseFloat(ans);
  if (isNaN(val) || val < 0) { alert('درصد نامعتبر است'); return; }
  it.profitMarginPct = val;
  offApplyProfitMarginToRow(i, basePrice, it.profitMarginPct);
};

window.offApplyProfitMarginToRow = function(i, basePrice, pct) {
  var it = _offState.items[i];
  it.profitMarginPct = pct;
  it.price = Math.round(basePrice * (1 + pct / 100));
  
  var cascadedCount = 0;
  if (i === 0 && _offState.items.length > 1) {
    var rfqsList = getData('ptf_crm_rfqsmart');
    var aliases = [_offState.inqNo, _offState.no].filter(Boolean);
    var matchedRfqs = rfqsList.filter(function(x){ return aliases.indexOf(x.srcRfq) > -1 || aliases.indexOf(x.no) > -1; });
    
    for (var j = 1; j < _offState.items.length; j++) {
      var row = _offState.items[j];
      var bP = row.bestBuyPrice || 0;
      /* BUG-PROC-LINK-287: do not inherit RFQ price by the same array index. */
      if (!bP && typeof window.ptfResolveProcurementAcross === 'function') {
        var link = window.ptfResolveProcurementAcross(row, matchedRfqs, { offerNo: _offState.no });
        if (link.ok && link.line && +link.line.item.bestBuyPrice > 0) bP = +link.line.item.bestBuyPrice;
      }
      if (!bP) bP = +row.refBuyPrice || 0; /* v19.6 US-439: مرجع دستی هم در اعمال گروهی */
      if (bP > 0) {
        row.profitMarginPct = pct;
        row.price = Math.round(bP * (1 + pct / 100));
        cascadedCount++;
      }
    }
  }
  
  offRenderItems();
  if (i === 0 && cascadedCount > 0) {
    if (typeof ptfToast === 'function') ptfToast('⚡ ضریب سود +' + pct + '٪ به ردیف ۱ و به‌طور خودکار به ' + cascadedCount + ' قلم دیگر اعمال شد', 'ok');
  } else {
    if (typeof ptfToast === 'function') ptfToast('📈 ضریب سود +' + pct + '٪ روی این ردیف اعمال شد', 'ok');
  }
};

/* v31.7.12 BUG-OFF-FOCUS-001: به‌روزرسانی input های همان ردیف بدون رندر کامل جدول.
   ریشه باگ: oninput → offRenderItems() کل جدول را innerHTML می‌کرد و فیلد در حال تایپ
   (نرخ مرجع/درصد سود) نابود می‌شد → «با تایپ هر عدد به بیرون می‌پرد».
   الگو همان v17.0 US-409 است که برای qty/price حل شده بود؛ حالا ref/margin هم. */
function offSyncRowInputs(i, src) {
  var it = (_offState.items || [])[i]; if (!it) return;
  function setMoney(id, v) {
    var el = document.getElementById(id);
    if (!el || el === document.activeElement) return;
    el.value = v ? ((typeof window.offMoneyText === 'function') ? window.offMoneyText(v) : v) : '';
    if (typeof ptfMoneyRefresh === 'function') ptfMoneyRefresh(el);
  }
  function setV(id, v) {
    var el = document.getElementById(id);
    if (el && el !== document.activeElement) el.value = (v == null ? '' : v);
  }
  if (src !== 'ref') setMoney('offRef' + i, it.refPrice || '');
  if (src !== 'margin') setV('offMg' + i, (typeof it.marginPct === 'number' ? it.marginPct : ''));
  setMoney('off_price_' + i, it.price || '');
  if (typeof offRenderTotals === 'function') offRenderTotals(i);
  if (typeof ptfTriggerAutoDraftSave === 'function') ptfTriggerAutoDraftSave();
}
window.offSyncRowInputs = offSyncRowInputs;

function offRenderTotals(rowIdx) {
  /* v17.0 (US-409): فرمت ارز-آگاه (US-366) — قبلا toLocaleString ساده بود و با GT فرم فعال ناهماهنگ می‌شد */
  var cur = (typeof offerCurrency === 'function') ? offerCurrency(_offState) : null;
  var fmt = function (v) { return (typeof window.offPrintAmount === 'function') ? window.offPrintAmount(v, cur) : ((typeof offerFmtMoney === 'function') ? offerFmtMoney(v, cur) : (+v || 0).toLocaleString('en-US')); };
  /* جمع ردیف تغییرکرده — سلول id ردیفی (offerlock v17.0)؛ اگر نبود (فرم قدیمی) فقط GT */
  if (rowIdx != null) {
    var rt = document.getElementById('offRT' + rowIdx);
    if (rt) {
      var it = _offState.items[rowIdx] || {};
      rt.textContent = fmt((+it.qty || 0) * (+it.price || 0));
    }
    var priceEl = document.getElementById('off_price_' + rowIdx);
    if (priceEl && typeof ptfMoneyRefresh === 'function') ptfMoneyRefresh(priceEl);
  }
  var el = document.getElementById('offGT');
  if (el) {
    var total = _offState.items.reduce(function(s, it){ return s + (+it.qty||0)*(+it.price||0); }, 0);
    el.textContent = fmt(total);
  }
}

// ---- ایمپورت Excel/CSV (AC6) ----
function offImportFile(inp) {
  var f = inp.files[0]; if (!f) return;
  var isXlsx = /\.xlsx?$/i.test(f.name);
  if (isXlsx && typeof XLSX !== 'undefined') {
    var rdx = new FileReader();
    rdx.onload = function() {
      try {
        var wb = XLSX.read(new Uint8Array(rdx.result), { type: 'array' });
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
        offImportRows(rows.map(function(r){ return r.map(function(c){ return String(c==null?'':c).trim(); }); }));
      } catch (e) { alert('خطا در خواندن اکسل: ' + e.message); }
    };
    rdx.readAsArrayBuffer(f);
    inp.value = ''; return;
  }
  var rd = new FileReader();
  rd.onload = function() {
    var lines = rd.result.replace(/^\uFEFF/, '').split(/\r?\n/).filter(function(l){ return l.trim(); });
    if (lines.length < 2) { alert('فایل خالی است'); return; }
    var parseRow = function(l) {
      return (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(function(x){ return x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim(); });
    };
    offImportRows(lines.map(parseRow));
  };
  rd.readAsText(f, 'utf-8');
  inp.value = '';
}

function offImportRows(allRows) {
  if (!allRows || allRows.length < 2) { alert('فایل خالی است'); return; }
  var head = allRows[0].map(function(h){ return String(h).toLowerCase(); });
    // تشخیص خودکار ستون‌ها
    var find = function(cands) {
      for (var i = 0; i < head.length; i++)
        for (var j = 0; j < cands.length; j++)
          if (head[i].indexOf(cands[j]) > -1) return i;
      return -1;
    };
    var map = {
      name: find(['item name', 'item', 'نام کالا', 'نام', 'کالا']),
      desc: find(['desc', 'شرح', 'توضیح', 'specification', 'spec']),
      model: find(['model', 'مدل', 'type', 'تیپ']),
      qty: find(['qty', 'تعداد', 'quantity', 'مقدار']),
      unit: find(['unit', 'واحد', 'uom']),
      brand: find(['brand', 'برند', 'سازنده', 'maker']),
      price: find(['price', 'قیمت', 'فی'])
    };
    if (map.name < 0 && map.desc < 0) map.name = 0;
    var msg = 'نگاشت ستون‌های تشخیص داده شده:\n' +
      (map.name > -1 ? 'Item Name ← ستون ' + (map.name + 1) + '\n' : '') +
      (map.desc > -1 ? 'Description ← ستون ' + (map.desc + 1) : '') + (map.qty > -1 ? '\nQty ← ستون ' + (map.qty + 1) : '') +
      (map.unit > -1 ? '\nUnit ← ستون ' + (map.unit + 1) : '') + (map.brand > -1 ? '\nBrand ← ستون ' + (map.brand + 1) : '') +
      (map.price > -1 ? '\nPrice ← ستون ' + (map.price + 1) : '') + '\n\nادامه می‌دهید؟';
    if (!confirm(msg)) { return; }
    var added = 0;
    for (var i = 1; i < allRows.length; i++) {
      var c = allRows[i];
      if (!(c[map.name] || c[map.desc])) continue;
      offSmartInsert({ /* v12.6 US-310 */
        name: map.name > -1 ? c[map.name] || '' : (c[map.desc] || ''),
        desc: map.desc > -1 && map.name > -1 ? c[map.desc] || '' : '',
        model: map.model > -1 ? c[map.model] || '' : '',
        qty: map.qty > -1 ? +String(c[map.qty]).replace(/[^\d.]/g, '') || 1 : 1,
        unit: map.unit > -1 ? c[map.unit] || 'EA' : 'EA',
        brand: map.brand > -1 ? c[map.brand] || '' : '', dlv: '',
        price: map.price > -1 ? +String(c[map.price]).replace(/[^\d.]/g, '') || 0 : 0
      });
      added++;
    }
    offRenderItems();
    alert('✅ ' + added + ' ردیف از فایل اضافه شد');
}

/* ==== v34.7.56: ورود قیمت (نرخ مرجع / قیمت واحد) از اکسل برای اقلام موجود ====
   برای فهرست‌های بلند (مثلاً ۲۶۷ ردیف): قالب با اقلام فعلی دانلود می‌شود، قیمت‌ها در
   اکسل پر و برگردانده می‌شوند. اقلام جدید نمی‌سازد — فقط قیمت ردیف‌های موجود را پر می‌کند.
   تطبیق: ۱) شماره ردیف قالب  ۲) کد کالا  ۳) نام+مدل (به ترتیب رخداد). */
window.offPriceXlsOpen = function () {
  if (!window._offState || !(_offState.items || []).filter(function (x) { return !offRowIsEmpty(x); }).length) {
    alert('ابتدا اقلام را بارگذاری کنید (بارگذاری از درخواست / ورود اکسل)؛ بعد قیمت‌ها را از فایل بدهید.');
    return;
  }
  var html = '<div class="md-b" id="offPriceXlsModal" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px">' +
    '<h3>💰 ورود قیمت از اکسل</h3>' +
    '<ol style="font-size:13px;line-height:2;padding-right:18px;margin:8px 0">' +
    '<li>قالب را دانلود کنید — همهٔ اقلام فعلی با شماره ردیف داخل آن است.</li>' +
    '<li>ستون «نرخ مرجع» و/یا «قیمت واحد» را به ریال پر کنید (ارقام فارسی و جداکننده مشکلی ندارد؛ خالی = بدون تغییر).</li>' +
    '<li>همان فایل را این‌جا بدهید.</li></ol>' +
    '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:8px 12px;font-size:12px;color:#92400e;margin-bottom:10px">ستون «ردیف» را تغییر ندهید — مبنای تطبیق است. اگر فایل از جای دیگری می‌آید، وجود ستون «کد کالا» یا «نام کالا» برای تطبیق کافی است.</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button type="button" class="bt bt-o" style="color:#047857;border-color:#a7f3d0" onclick="offPriceXlsTemplate()">⬇️ دانلود قالب با اقلام فعلی</button>' +
    '<button type="button" class="bt" style="background:#b45309" onclick="document.getElementById(\'offPriceXlsFile\').click()">📂 انتخاب فایل قیمت</button>' +
    '<input type="file" id="offPriceXlsFile" accept=".csv,.xlsx,.xls" style="display:none" onchange="offPriceXlsImport(this)">' +
    '</div>' +
    '<div style="text-align:left;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
    '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

window.offPriceXlsTemplate = function () {
  if (typeof XLSX === 'undefined') { alert('کتابخانه اکسل هنوز بارگذاری نشده؛ چند لحظه بعد دوباره بزنید.'); return; }
  var aoa = [['ردیف', 'کد کالا', 'نام کالا', 'شرح', 'مدل', 'تعداد', 'واحد', 'نرخ مرجع (ریال)', 'قیمت واحد (ریال)']];
  (_offState.items || []).forEach(function (it, i) {
    if (offRowIsEmpty(it)) return;
    aoa.push([i + 1, it.pcode || '', it.name || '', it.desc || '', it.model || '', +it.qty || 1, it.unit || '',
      +it.refPrice > 0 ? +it.refPrice : '', +it.price > 0 ? +it.price : '']);
  });
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 32 }, { wch: 32 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 18 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prices');
  XLSX.writeFile(wb, 'PTF-Prices-' + ((_offState.no || 'offer').replace(/[^\w\-]/g, '_')) + '.xlsx');
};

window.offPriceXlsImport = function (inp) {
  var f = inp.files && inp.files[0];
  if (!f) return;
  inp.value = '';
  var isCsv = /\.csv$/i.test(f.name);
  if (!isCsv && typeof XLSX === 'undefined') { alert('کتابخانه اکسل هنوز بارگذاری نشده؛ چند لحظه بعد دوباره تلاش کنید.'); return; }
  var rd = new FileReader();
  rd.onload = function () {
    try {
      var wb = isCsv && typeof XLSX !== 'undefined'
        ? XLSX.read(String(rd.result || '').replace(/^\uFEFF/, ''), { type: 'string' })
        : XLSX.read(new Uint8Array(rd.result), { type: 'array' });
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      offPriceXlsApply(rows.map(function (r) { return (r || []).map(function (c) { return String(c == null ? '' : c).trim(); }); }));
    } catch (e) { alert('خطا در خواندن فایل: ' + (e && e.message || e)); }
  };
  if (isCsv && typeof XLSX !== 'undefined') rd.readAsText(f, 'utf-8'); else rd.readAsArrayBuffer(f);
};

function offPriceXlsApply(allRows) {
  allRows = allRows || [];
  /* پیدا کردن ردیف سرستون: اولین ردیفی که «نرخ مرجع» یا «قیمت» دارد */
  var headIdx = -1, head = [];
  for (var h = 0; h < Math.min(allRows.length, 10); h++) {
    var joined = (allRows[h] || []).join('|');
    if (/نرخ\s*مرجع|قیمت|price|ref/i.test(joined)) { headIdx = h; head = allRows[h].map(function (x) { return String(x).toLowerCase(); }); break; }
  }
  if (headIdx < 0) { alert('سرستون پیدا نشد. فایل باید ستون «نرخ مرجع» یا «قیمت واحد» داشته باشد (قالب را دانلود کنید).'); return; }
  function findCol(res, avoid) {
    for (var i = 0; i < head.length; i++) {
      if (avoid && avoid.test(head[i])) continue;
      if (res.test(head[i])) return i;
    }
    return -1;
  }
  var cRow = findCol(/^ردیف|^row|^#$/i);
  var cCode = findCol(/کد|code/i);
  var cName = findCol(/نام|name|شرح کالا/i);
  var cRef = findCol(/نرخ\s*مرجع|مرجع|ref/i);
  var cPrice = findCol(/قیمت\s*واحد|قیمت\s*فروش|unit\s*price|^price/i, /نرخ|مرجع|ref/i);
  if (cPrice < 0) cPrice = findCol(/^قیمت/i, /نرخ|مرجع|ref/i);
  if (cRef < 0 && cPrice < 0) { alert('ستون «نرخ مرجع» یا «قیمت واحد» در فایل نیست.'); return; }
  var items = _offState.items || [];
  /* اشاره‌گر رخداد برای تطبیق کد/نام تکراری به ترتیب */
  var usedIdx = {};
  function nextByPredicate(pred) {
    for (var i = 0; i < items.length; i++) {
      if (usedIdx[i]) continue;
      if (!offRowIsEmpty(items[i]) && pred(items[i])) return i;
    }
    return -1;
  }
  var refN = 0, priceN = 0, matched = 0, misses = [];
  for (var r = headIdx + 1; r < allRows.length; r++) {
    var row = allRows[r] || [];
    var refV = cRef > -1 ? window.offParseMoney(row[cRef]) : 0;
    var priceV = cPrice > -1 ? window.offParseMoney(row[cPrice]) : 0;
    if (!(refV > 0) && !(priceV > 0)) continue; /* ردیف بدون قیمت = بدون تغییر */
    var ti = -1;
    var rowNo = cRow > -1 ? Math.floor(window.offParseMoney(row[cRow])) : 0;
    if (rowNo >= 1 && rowNo <= items.length && !usedIdx[rowNo - 1] && !offRowIsEmpty(items[rowNo - 1])) ti = rowNo - 1;
    if (ti < 0 && cCode > -1 && String(row[cCode] || '').trim()) {
      var codeV = String(row[cCode]).trim().toLowerCase();
      ti = nextByPredicate(function (it) { return String(it.pcode || '').trim().toLowerCase() === codeV; });
    }
    if (ti < 0 && cName > -1 && String(row[cName] || '').trim()) {
      var nameV = offNormLine(row[cName]);
      ti = nextByPredicate(function (it) { return offNormLine(it.name || '') === nameV || offNormLine(it.desc || '') === nameV; });
    }
    if (ti < 0) { misses.push(rowNo > 0 ? ('ردیف ' + rowNo) : (String(row[cName > -1 ? cName : 0] || '').slice(0, 30) || ('سطر ' + (r + 1)))); continue; }
    usedIdx[ti] = true;
    matched++;
    var it2 = items[ti];
    if (refV > 0) {
      it2.refPrice = refV;
      it2.refPriceEdited = true;
      it2.refCur = it2.refCur || 'IRR';
      it2.refSrc = 'excel';
      refN++;
    }
    if (priceV > 0) {
      it2.price = priceV;
      priceN++;
    }
    /* هم‌راستایی درصد سود مثل offUpdRefPrice/offUpdItem */
    if (+it2.refPrice > 0 && +it2.price > 0) it2.marginPct = Math.round(((+it2.price / +it2.refPrice) - 1) * 1000) / 10;
    else if (refV > 0 && !(+it2.price > 0) && typeof it2.marginPct === 'number') it2.price = Math.round(refV * (1 + it2.marginPct / 100));
  }
  if (typeof offRenderItems === 'function') offRenderItems();
  if (typeof ptfTriggerAutoDraftSave === 'function') { try { ptfTriggerAutoDraftSave(); } catch (eDs) {} }
  var md = document.getElementById('offPriceXlsModal');
  if (md && matched) md.remove();
  alert('💰 ورود قیمت از اکسل:\n' +
    '✅ ' + matched + ' ردیف تطبیق داده شد (' + refN + ' نرخ مرجع، ' + priceN + ' قیمت واحد)' +
    (misses.length ? '\n⚠️ ' + misses.length + ' سطر تطبیق نشد: ' + misses.slice(0, 8).join('، ') + (misses.length > 8 ? ' …' : '') : '') +
    '\nجدول را بازبینی و سپس ذخیره کنید.');
}
window.offPriceXlsApply = offPriceXlsApply;

// ---- Terms ----
// US-142 AC6: بند انتخاب‌شده از کتابخانه قفل می‌شود (انتخاب تکراری ممنوع؛ با حذف بند آزاد می‌شود)
function offTcUsed() { return _offState.tcUsed = _offState.tcUsed || []; }
function offSyncTcLib() {
  var sel = (typeof offEl === 'function') ? offEl('offTcLib') : document.getElementById('offTcLib');
  if (!sel) return;
  var used = offTcUsed();
  for (var i = 0; i < sel.options.length; i++) {
    var idx = +sel.options[i].value;
    var lock = used.indexOf(idx) > -1;
    sel.options[i].disabled = lock;
    sel.options[i].text = (lock ? '🔒 ' : '') + TC_LIBRARY[idx].slice(0, 80);
  }
  // اگر گزینه انتخابی قفل شد، برو روی اولین آزاد
  if (sel.selectedIndex > -1 && sel.options[sel.selectedIndex].disabled) {
    for (var j = 0; j < sel.options.length; j++) if (!sel.options[j].disabled) { sel.selectedIndex = j; break; }
  }
}
function offAddTermLib() {
  var i = +((typeof offEl === 'function') ? offEl('offTcLib') : document.getElementById('offTcLib')).value;
  if (offTcUsed().indexOf(i) > -1) { alert('🔒 این بند قبلاً انتخاب شده است'); return; }
  offTcUsed().push(i);
  _offState.terms.push(TC_LIBRARY[i]);
  _offState.termLib = _offState.termLib || {};
  _offState.termLib[_offState.terms.length - 1] = i;
  offRenderTerms();
  offSyncTcLib();
}
function offAddTerm(txt) { _offState.terms.push(txt || ''); offRenderTerms(); }
function offDelTerm(i) {
  // آزادسازی بند کتابخانه‌ای متناظر
  var lib = _offState.termLib || {};
  if (lib[i] != null) {
    var u = offTcUsed();
    var pos = u.indexOf(lib[i]);
    if (pos > -1) u.splice(pos, 1);
  }
  // بازچینی نگاشت اندیس‌ها پس از حذف
  var newLib = {};
  Object.keys(lib).forEach(function (k) {
    k = +k;
    if (k < i) newLib[k] = lib[k];
    else if (k > i) newLib[k - 1] = lib[k];
  });
  _offState.termLib = newLib;
  _offState.terms.splice(i, 1);
  offRenderTerms();
  offSyncTcLib();
}
function offUpdTerm(i, v) { _offState.terms[i] = v; }

/* v14.2 (US-364): چند مودال هم‌شناسه (مینیمایز modalx / فرم روی فرم) — همیشه آخرین نمونه قابل‌مشاهده هدف رندر است */
window.offEl = function (id) {
  var list = document.querySelectorAll('[id="' + id + '"]');
  if (!list.length) return null;
  var vis = [];
  for (var i = 0; i < list.length; i++) {
    var mb = list[i].closest ? list[i].closest('.md-b') : null;
    if (!mb || mb.style.display !== 'none') vis.push(list[i]);
  }
  var arr = vis.length ? vis : list;
  return arr[arr.length - 1];
};

function offRenderTerms() {
  var el = (typeof offEl === 'function') ? offEl('offTermsWrap') : document.getElementById('offTermsWrap');
  if (!el) return;
  el.innerHTML = _offState.terms.map(function(t, i) {
    return '<div style="display:flex;gap:6px;margin-bottom:5px;align-items:center"><span style="font-size:12px;color:#94a3b8;min-width:18px">' + (i + 1) + '.</span>' +
      '<input type="text" value="' + escP(t) + '" oninput="offUpdTerm(' + i + ',this.value)" style="flex:1;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr;font-size:12px">' +
      '<button type="button" onclick="offDelTerm(' + i + ')" style="border:0;background:none;color:#94a3b8;cursor:pointer">✕</button></div>';
  }).join('') || '<div style="color:#94a3b8;font-size:12px">بندی ثبت نشده — از کتابخانه اضافه کنید</div>';
}

// ---- پیش‌نمایش (بدون ذخیره) ----
/* v34.7.58 OFFICIAL-OFFER-OUTPUT-001 (بازپیاده‌سازی PR #57 روی main):
   ساخت سند از وضعیت فعلی فرم، جدا از مسیر پیش‌نمایش — بدون ذخیره و بدون mutation اضافه. */
function offMaterializeCurrentDocument() {
  var o = _offState;
  o.buyerCd = (document.getElementById('ofBuyer')||{}).value || o.buyerCd;
  o.inqNo = (document.getElementById('ofInq')||{}).value || '';
  o.dateEn = (typeof ptfJToISO==='function' ? ptfJToISO(((document.getElementById('ofDateJ')||{}).value || '')) : '') || o.dateEn || new Date().toISOString().slice(0, 10); /* v22 audited: انتخاب شمسی، ذخیره ISO */
  if (o.kind === 'CO' || o.kind === 'TC') o.validUntil = (typeof ptfJToISO==='function' ? ptfJToISO(((document.getElementById('ofValidJ')||{}).value || '')) : '') || o.validUntil || defaultValidity(o.dateEn);
  o.sellerContact = ((document.getElementById('ofSeller')||{}).value || '').trim();
  if (o.kind !== 'TO') o.printAs = ((document.getElementById('ofPrintAs') || {}).value) || o.printAs || (o.kind === 'TC' ? 'TC' : 'CO');
  // US-148 AC3: مهر و امضا پیش از ثبت نهایی هم روی خروجی اعمال می‌شود
  o.useSig = !!(document.getElementById('ofUseSig') || {}).checked;
  var _sa = document.getElementById('ofSignAs'); if (_sa && _sa.value) o.signAs = _sa.value; /* v13.1 US-321 */
  if (!o.issuedBy) o.issuedBy = curSession().user;
  var c = getData('ptf_crm_customers').filter(function(x){ return x.cd === o.buyerCd; })[0];
  if (c) o.buyerCo = c.coEn || c.co;
  return o;
}

function offerPreview() {
  var o = offMaterializeCurrentDocument();
  /* پیش‌نمایش عمداً می‌تواند watermark داخلی PREVIEW داشته باشد. */
  var tmpKey = '_preview_' + o.no;
  localStorage.setItem(tmpKey, JSON.stringify(o));
  offerPrintObj(o);
  localStorage.removeItem(tmpKey);
}

/* v34.7.58 OFFICIAL-OFFER-OUTPUT-001: خروجی قابل ارسال مستقیماً با isPreview=false
   ساخته می‌شود؛ نه watermark «PREVIEW» دارد و نه کاربر برای رسیدن به PDF رسمی
   مجبور است از پیش‌نمایش داخلی عبور کند. */
function offerPrintCurrent() {
  var o = offMaterializeCurrentDocument();
  var tpl = localStorage.getItem('ptf_offer_tpl') || 'letterhead';
  if (typeof window.offerPrintTpl === 'function') {
    window.offerPrintTpl(o, tpl, false);
    return;
  }
  /* fallback قدیمی فقط انتخاب‌گر قالب را باز می‌کند؛ ذخیره/رویژن انجام نمی‌دهد. */
  if (typeof window.offerPickTemplate === 'function') window.offerPickTemplate(o);
  else offerPrintObj(o);
}
window.offerPrintCurrent = offerPrintCurrent;

// ---- ذخیره ----
/* ============================================================================
   FC-6 / FC-7 (v34.7.30) — نوشتن بازگشتی نرخ مرجع
   خواستهٔ کارفرما: «در صورت تغییر نرخ در پیشنهاد، نرخ مرجع قبلی به مقدار جدید تغییر کند».
   قواعد ایمنی:
     • فقط قلم‌هایی که کاربر صراحتاً نرخ مرجعشان را در پیشنهاد ویرایش کرده (refPriceEdited)
     • تطبیق قلم فقط با قاعدهٔ یکتای procurement-link (کد کالا/شناسهٔ پایدار/نام+مدل+واحد)
     • مقدار قبلی حذف نمی‌شود؛ در refHistory با شمارهٔ پیشنهاد، کاربر و تاریخ می‌ماند
     • بانک کالا فقط با تیک صریح کاربر به‌روز می‌شود (تصمیم کارفرما ۱۴۰۵/۰۵/۲۶)
   ========================================================================== */
window.ptfSyncRefPriceBack = function (offer, opt) {
  opt = opt || {};
  var out = { request: 0, catalog: 0, skipped: 0 };
  try {
    if (!offer || !Array.isArray(offer.items)) return out;
    var edited = offer.items.filter(function (it) { return it && it.refPriceEdited && +it.refPrice > 0; });
    if (!edited.length) return out;
    var now = (typeof faDate === 'function') ? faDate() : '';
    var who = (typeof curSession === 'function' ? (curSession().name || '') : '');
    var resolved = (typeof window.ptfResolveInqRequest === 'function') ? window.ptfResolveInqRequest(offer.inqNo) : { rows: [], source: '' };

    function stamp(target, price, cur) {
      var prev = +target.refPrice || 0;
      if (prev === price && String(target.refCur || 'IRR') === String(cur)) return false;
      target.refHistory = Array.isArray(target.refHistory) ? target.refHistory : [];
      if (prev > 0) target.refHistory.push({ price: prev, cur: target.refCur || 'IRR', src: target.refSrc || '', at: target.refAt || '', by: target.refBy || '' });
      if (target.refHistory.length > 20) target.refHistory = target.refHistory.slice(-20);
      target.refPrice = price; target.refCur = cur; target.refSrc = 'offer';
      target.refAt = now; target.refBy = who; target.refOfferNo = offer.no || '';
      return true;
    }

    /* ۱) قلم درخواست — منبع اصلی نرخ مرجع */
    if (resolved.source === 'inqitems') {
      var all = getData('ptf_crm_inqitems') || [], touched = 0;
      edited.forEach(function (it) {
        var m = (typeof window.ptfResolveProcurementLine === 'function') ? window.ptfResolveProcurementLine(it, resolved.rows) : { ok: false };
        if (!m.ok) { out.skipped++; return; }
        var target = null;
        for (var i = 0; i < all.length; i++) if (all[i] === m.item) { target = all[i]; break; }
        if (!target) { out.skipped++; return; }
        if (stamp(target, +it.refPrice, it.refCur || offer.currency || 'IRR')) touched++;
      });
      if (touched) { if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_inqitems', all, { reason: 'w2' }); else setData('ptf_crm_inqitems', all); out.request = touched; }
    } else if (resolved.source === 'rfq.items' && resolved.rfq) {
      var rfqs = getData('ptf_crm_rfqs') || [], rec = null, t2 = 0;
      for (var j = 0; j < rfqs.length; j++) if (rfqs[j] && String(rfqs[j].cd || '') === String(resolved.rfq.cd || '')) { rec = rfqs[j]; break; }
      if (rec && Array.isArray(rec.items)) {
        edited.forEach(function (it) {
          var m2 = (typeof window.ptfResolveProcurementLine === 'function') ? window.ptfResolveProcurementLine(it, rec.items) : { ok: false };
          if (!m2.ok) { out.skipped++; return; }
          if (stamp(m2.item, +it.refPrice, it.refCur || offer.currency || 'IRR')) t2++;
        });
        if (t2) { if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs); out.request = t2; }
      }
    }

    /* ۲) بانک کالا — فقط با تیک صریح (FC-7) */
    if (opt.toCatalog) {
      var prods = getData('ptf_crm_products') || [], t3 = 0;
      edited.forEach(function (it) {
        var pm = (typeof window.ptfResolveProcurementLine === 'function') ? window.ptfResolveProcurementLine(it, prods) : { ok: false };
        if (!pm.ok) { out.skipped++; return; }
        var p = pm.item, price = +it.refPrice, cur = it.refCur || offer.currency || 'IRR';
        if (+p.pr === price && String(p.prCur || 'IRR') === String(cur)) return;
        p.prHistory = Array.isArray(p.prHistory) ? p.prHistory : [];
        if (+p.pr > 0) p.prHistory.push({ pr: +p.pr, cur: p.prCur || 'IRR', at: p.refPriceAt || '', src: p.refPriceSrc || '' });
        p.pr = price; p.prCur = cur; p.refPriceAt = now;
        p.refPriceSrc = 'نرخ مرجع پیشنهاد ' + (offer.no || '') + ' — ' + who;
        t3++;
      });
      if (t3) { /* v34.8.23 (W1-iterate): از مسیر فرمان اتمیک */
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', prods, { reason: 'offer-refprice' });
        else setData('ptf_crm_products', prods); out.catalog = t3; }
    }

    if ((out.request || out.catalog) && typeof audit === 'function') {
      audit('نرخ مرجع', 'به‌روزرسانی نرخ مرجع از پیشنهاد ' + (offer.no || '') +
        ' — اقلام درخواست: ' + out.request + (out.catalog ? ' | بانک کالا: ' + out.catalog : ''), offer.no || '');
    }
  } catch (e) { try { console.error('ptfSyncRefPriceBack', e); } catch (e2) {} }
  return out;
};

/* v34.7.39: همهٔ آثار «صدور قطعی» فقط پس از ACK فرمان register_offer اجرا می‌شوند؛
   مسیر fallback محلی عمداً وجود ندارد. */
window.ptfOfferAfterServerCommit = function (o, meta) {
  meta = meta || {};
  /* fail-closed: هیچ caller قدیمی/مستقیمی بدون receipt قطعی سرور حق اجرای
     referral، پاک‌سازی draft، SMS یا log «صادر شد» را ندارد. */
  if (!o || meta.serverConfirmed !== true) return { ok: false, reason: 'server_ack_required' };
  try {
    if (o.inqNo && typeof window.ptfResolveRfqReferral === 'function') {
      if (o.kind === 'CO' || o.kind === 'TC') window.ptfResolveRfqReferral(o.inqNo, 'create_offer');
      else if (o.kind === 'TO') window.ptfResolveRfqReferral(o.inqNo, 'create_technical_offer');
    }
  } catch (eResolveRef) {}
  try { if (typeof window.ptfSalesFileOfferAfterServerCommit === 'function') window.ptfSalesFileOfferAfterServerCommit(o); } catch (eSalesFile) {}
  /* v34.8.40 (R2/T5-2c): حذف پیش‌نویس از Dev-KV (حذف legacy LS هم داخل همان نمای انجام می‌شود) */
  try { if (window.ptfDevKv) window.ptfDevKv.remove('ptf_autodraft_offer_' + o.kind); else localStorage.removeItem('ptf_autodraft_offer_' + o.kind); } catch (eDraft) {}
  try {
    var toCatalog = !!meta.toCatalog;
    var rb = window.ptfSyncRefPriceBack(o, { toCatalog: toCatalog });
    if ((rb.request || rb.catalog) && typeof ptfToast === 'function') {
      ptfToast('💰 نرخ مرجع به‌روز شد — اقلام درخواست: ' + rb.request + (rb.catalog ? ' | بانک کالا: ' + rb.catalog : ''), 'ok');
    }
  } catch (eRb) {}
  try {
    var productNotes = Array.isArray(meta.productSyncNotes) ? meta.productSyncNotes.filter(Boolean) : [];
    if (productNotes.length) {
      if (typeof ptfToast === 'function') ptfToast('📦 ' + productNotes.join(' | '), 'ok');
      if (typeof audit === 'function') audit('کالاها', 'همگام‌سازی تأییدشده از پیشنهاد ' + o.no + ': ' + productNotes.join('، '), o.no);
      if (typeof addLog === 'function') addLog('📦 همگام‌سازی دایرکتوری کالا پس از تأیید پیشنهاد ' + o.no);
    }
  } catch (eProductEffects) {}
  try { hideModal(); } catch (eHide) {}
  try { renderOffers(); } catch (eRender) {}
  try {
    if ((o.kind === 'CO' || o.kind === 'TC') && o.buyerCd && typeof window.ptfSmsNotifyDialog === 'function') {
      var cust = getData('ptf_crm_customers').filter(function (x) { return x.cd === o.buyerCd; })[0];
      if (cust) {
        var inqRef = o.inqNo ? (' (درخواست ' + o.inqNo + ')') : '';
        var totalAmt = (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
        var amtStr = totalAmt ? ('\nمبلغ کل: ' + totalAmt.toLocaleString('fa-IR') + ' ' + (o.currency === 'EUR' ? 'یورو' : o.currency === 'USD' ? 'دلار' : 'ریال')) : '';
        var smsText = 'پیشرو تجهیز فرتاک\nپیشنهاد مالی ' + (o.no || '') + inqRef + ' صادر شد.' + amtStr + '\n' +
          (o.validUntil ? 'اعتبار: ' + o.validUntil + '\n' : '') + 'جهت بررسی با کارشناس فروش تماس بگیرید.\n021-46087679\npishtaj.ir';
        window.ptfSmsNotifyDialog(cust, smsText, 'صدور پیشنهاد مالی ' + o.no);
      }
    }
  } catch (eSms) {}
  var editLbl = meta.idx > -1 ? (meta.madeRevision ? ' ویرایش (Rev.' + o.rev + ')' : ' اصلاح شد (بدون رویژن جدید)') : ' صادر';
  try { addLog('پیشنهاد ' + o.no + editLbl + ' شد (تأیید سرور)'); } catch (eLog) {}
  return { ok: true };
};

function offerSave() {
  try {
  /* sales-domain-v2 باید این تابع legacy را داخل command فعال کند. اگر asset یا
     wrapper بارگذاری نشده باشد، local-only save به‌جای fallback ناامن متوقف می‌شود. */
  if (!window.PTF_OFFER_COMMAND_SAVE_ACTIVE) {
    alert('⛔ سرویس ثبت اتمیک پیشنهاد آماده نیست؛ صفحه را آنلاین تازه‌سازی کنید. هیچ پیشنهادی یا وضعیت درخواستی ذخیره نشد.');
    return { ok: false, reason: 'offer_command_unavailable' };
  }
  var o = window._offState || _offState;
  if (!o) { alert('⛔ اطلاعات پیشنهاد در حافظه یافت نشد — فرم را ببندید و دوباره باز کنید'); return; }
  /* v31.6.27 CODEGEN-OFFER-SERVER: official TO/CO/TC numbers must come
     from server reservation; a TMP offer cannot be saved as an official offer. */
  if ((o.kind === 'TO' || o.kind === 'CO' || o.kind === 'TC') && /^TMP-(TO|CO|TC)-/.test(String(o.no || ''))) {
    alert('⛔ شماره رسمی پیشنهاد از سرور دریافت نشده است. اتصال/ورود را برقرار کنید و فرم را دوباره باز کنید.');
    return;
  }
  try {
    if (o.items && o.items.length) {
      o.items.forEach(function (it) {
        if (!it) return;
        if (!String(it.unit || '').trim()) it.unit = 'NO';
        if (typeof ptfOfferUnitEn === 'function') it.unit = ptfOfferUnitEn(it.unit);
        if (it.name == null) it.name = '';
        if (it.qty == null || it.qty === '') it.qty = 1;
      });
    }
    if (typeof ptfSetOffState === 'function') ptfSetOffState(o);
    else { _offState = o; window._offState = o; }
  } catch (eSync) {}
  var _savedLock = getData('ptf_crm_offers').filter(function (x) { return x.no === o.no; })[0];
  if (offerPostAwardLocked(_savedLock)) { alert('🔒 پیشنهاد برنده پس از تشکیل پرونده فروش قابل ذخیره/ویرایش نیست. ادامه فرایند از پرونده فروش انجام می‌شود.'); if (typeof ptfGoSalesFileForOffer === 'function') ptfGoSalesFileForOffer(o.no); return; }
  
  var buyerEl = document.getElementById('ofBuyer');
  o.buyerCd = buyerEl ? buyerEl.value : (o.buyerCd || '');
  var _legacyInq = (getData('ptf_crm_offers').filter(function (x) { return x.no === o.no; })[0] || {}).inqNo || '';
  var inqEl = document.getElementById('ofInq');
  o.inqNo = inqEl ? inqEl.value.trim() : (o.inqNo || '');
  
  // US-175 / US-289: ثبت خودکار شماره استعلام در صورت وارد شدن دستی تا دکمه ذخیره هرگز متوقف نشود
  if (o.inqNo && typeof ptfInqNoValid === 'function' && !ptfInqNoValid(o.inqNo, _legacyInq)) {
    try {
      var rfqs = getData('ptf_crm_rfqs');
      if (!rfqs.some(function(x){ return x.cd === o.inqNo || x.inqNo === o.inqNo; })) {
        rfqs.unshift({ cd: o.inqNo, inqNo: o.inqNo, co: o.buyerCo || 'مشتری استعلام', st: 'st1', stxt: '🔴 دریافت اولیه', dt: (typeof faDate === 'function' ? faDate() : '') });
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs);
      }
    } catch(eInqAuto) {}
  }
  o.dateEn = (typeof ptfJToISO==='function' ? ptfJToISO(((document.getElementById('ofDateJ')||{}).value || '')) : '') || new Date().toISOString().slice(0, 10); /* v22 audited: انتخاب شمسی، ذخیره ISO */
  // US-157: اعتبار پیشنهاد
  if (o.kind === 'CO' || o.kind === 'TC') o.validUntil = (typeof ptfJToISO==='function' ? ptfJToISO(((document.getElementById('ofValidJ') || {}).value || '')) : '') || defaultValidity(o.dateEn);
  o.sellerContact = (document.getElementById('ofSeller')||{value:''}).value.trim();
  if (o.kind !== 'TO') o.printAs = ((document.getElementById('ofPrintAs') || {}).value) || o.printAs || (o.kind === 'TC' ? 'TC' : 'CO'); /* v20.1 US-442 */
  if (!o.buyerCd) { alert('کارفرما را انتخاب کنید'); return; }
  var _c = getData('ptf_crm_customers').filter(function(x){ return x.cd === o.buyerCd; })[0];
  if (_c && !_c.coEn) {
    if (!confirm('⚠️ نام انگلیسی این کارفرما ثبت نشده و نام فارسی روی سند انگلیسی درج می‌شود.\nادامه می‌دهید؟ (توصیه: ابتدا در ماژول کارفرمایان، نام انگلیسی را ثبت کنید)')) return;
  }
  var _ded = offDedupeOfferItems(o.items || []);
  if (_ded.removed) {
    o.items = _ded.items;
    try { audit('پیشنهادها', 'حذف خودکار ' + _ded.removed + ' ردیف تکراری از پیشنهاد ' + (o.no || '') + ' هنگام ذخیره (BUG-OFFER-DUP-ITEMS-001)', o.no || ''); } catch (eDed) {}
    if (typeof ptfToast === 'function') ptfToast('🧹 ' + _ded.removed + ' ردیف تکراری پیشنهاد حذف شد', 'warn');
  }
  if (!o.items.length) { alert('حداقل یک ردیف کالا لازم است'); return; }
  offEnsureOfferLineIds(o.items, o.no);
  o.updatedAtISO = new Date().toISOString();
  var c = getData('ptf_crm_customers').filter(function(x){ return x.cd === o.buyerCd; })[0];
  if (c) o.buyerCo = c.coEn || c.co;

  /* v35: پیشنهاد متمم/جایگزین یک سند مستقل است. برنده‌بودن سند والد هرگز
     وضعیت این پیشنهاد را خودکار تغییر نمی‌دهد؛ برد باید صریح و سروری باشد و کاربر
     همان لحظه اتصال به پرونده قبلی یا تشکیل پرونده مستقل را انتخاب کند. */

  /* v14.6: هشدار عبور از سقف اعتبار — مانده باز + مبلغ CO جدید */
  if ((o.kind === 'CO' || o.kind === 'TC') && c && +c.creditLimit > 0 && typeof ptfCustOpenBalance === 'function') {
    var _bal = ptfCustOpenBalance(o.buyerCd);
    var _newTotal = (o.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
    if (_bal.open + _newTotal > +c.creditLimit) {
      if (!confirm('⛔ هشدار سقف اعتبار مشتری\n\nمانده مطالبات باز: ' + _bal.open.toLocaleString('fa-IR') + ' ریال\nمبلغ این پیشنهاد: ' + _newTotal.toLocaleString('fa-IR') + ' ریال\nجمع: ' + (_bal.open + _newTotal).toLocaleString('fa-IR') + ' ریال\nسقف اعتبار: ' + (+c.creditLimit).toLocaleString('fa-IR') + ' ریال\n\nجمع از سقف اعتبار تعیین‌شده عبور می‌کند. با مسئولیت خود ادامه می‌دهید؟')) return;
      try { audit('پیشنهادها', 'تلاش ثبت ' + o.no + ' با تأیید عبور از سقف اعتبار مشتری ' + (c.co || '') + ' (مانده ' + _bal.open + ' + جدید ' + _newTotal + ' > سقف ' + c.creditLimit + ')', o.no); } catch (eCL) {}
    }
  }
  o.extraCols = _offState.extraCols || [];
  // US-142 AC3/AC7: صادرکننده = کاربر جاری (برای امضا و Contact Person)
  if (!o.issuedBy) o.issuedBy = curSession().user;
  o.sellerContact = myEnName();
  // US-148 AC2: وضعیت چک‌باکس مهر و امضا
  o.useSig = !!(document.getElementById('ofUseSig') || {}).checked;
  var _sa = document.getElementById('ofSignAs'); if (_sa && _sa.value) o.signAs = _sa.value; /* v13.1 US-321 */
  var offers = getData('ptf_crm_offers');
  var saveIdentity = ptfOfferResolveSaveIdentity(o, offers);
  if (!saveIdentity.ok) {
    alert('⛔ رکورد اصلی پیشنهاد برای ویرایش پیدا نشد (' + (saveIdentity.originalNo || o.no || '—') + ').\n\nبرای جلوگیری از ایجاد پیشنهاد جدید/شماره جدید از مسیر ویرایش، ذخیره متوقف شد. لطفاً فهرست پیشنهادها را به‌روزرسانی و دوباره ویرایش را باز کنید.');
    try { audit('پیشنهادها', '⛔ توقف ذخیره ویرایش stale برای جلوگیری از شماره/Rev اشتباه: ' + (saveIdentity.originalNo || o.no || ''), o.no || ''); } catch (eStale) {}
    return;
  }
  var idx = saveIdentity.idx, madeRevision = false;
  /* v31.7.24 BUG-CODE-DUP-003 (شکایت کاربر): پیشنهاد «جدید» با شماره‌ای که قبلاً وجود دارد
     (counter عقب سرور) بی‌صدا آفر قدیمی را overwrite می‌کرد → کاربر «ذخیره» می‌زد ولی
     رکورد جدیدی در فهرست ظاهر نمی‌شد. اکنون: شماره جدید از سرور گرفته می‌شود؛ اگر نشد، ثبت مسدود. */
  if (idx > -1 && o.editMode === 'new') {
    var _regenTry = 0, _newNo = o.no;
    while (_regenTry < 5 && offers.some(function (x) { return x.no === _newNo; })) {
      _newNo = offerSerial(o.kind); _regenTry++;
    }
    if (offers.some(function (x) { return x.no === _newNo; }) || /^TMP-/.test(String(_newNo || ''))) {
      alert('⛔ شماره پیشنهاد تولیدی (' + o.no + ') قبلاً برای پیشنهاد دیگری استفاده شده و شماره جدید از سرور در دسترس نیست.\n\nبرای جلوگیری از بازنویسی پیشنهاد قبلی، ذخیره متوقف شد — اتصال را بررسی و دوباره تلاش کنید. (متن فرم به‌صورت پیش‌نویس محفوظ است)');
      try { audit('پیشنهادها', '⛔ جلوگیری از overwrite پیشنهاد موجود با شماره تکراری ' + o.no + ' (BUG-CODE-DUP-003)', o.no); } catch (eA3) {}
      return;
    }
    try { audit('پیشنهادها', 'شماره تکراری ' + o.no + ' → شماره جدید ' + _newNo + ' (BUG-CODE-DUP-003)', _newNo); } catch (eA4) {}
    o.no = _newNo;
    if (typeof ptfToast === 'function') ptfToast('ℹ️ شماره پیشنهاد به ' + _newNo + ' اصلاح شد (شماره قبلی متعلق به پیشنهاد دیگری بود)', 'info');
    idx = -1; /* رکورد جدید — نه ویرایش */
  }
  /* v14.3 (US-367): TO پس از ذخیره از «پیش‌نویس» به «ثبت‌شده» می‌رود (تغییرات نسخه پیش‌نویس هم ثبت‌شده می‌ماند) */
  if (o.kind === 'TO' && (!o.st || o.st === 'draft')) o.st = 'registered';
  if (idx > -1) {
    var prev = offers[idx] || {};
    var forceRev = !!(saveIdentity && saveIdentity.explicitRevision);
    madeRevision = !!forceRev;
    o.rev = madeRevision ? ((prev.rev || 0) + 1) : (prev.rev || 0);
    /* v35: هر Revision یک Snapshot تغییرناپذیر دارد؛ شماره تجاری ثابت می‌ماند. */
    var _revHist = Array.isArray(prev.revisionHistory) ? prev.revisionHistory.slice() : [];
    if (madeRevision) {
      var _prevSnap = JSON.parse(JSON.stringify(prev));
      delete _prevSnap.revisionHistory; delete _prevSnap.editHistory;
      _revHist.push({ rev: +prev.rev || 0, at: new Date().toISOString(), by: (curSession() || {}).name || '', snapshot: _prevSnap });
    }
    o.revisionHistory = _revHist;
    if (!madeRevision) {
      o.editHistory = Array.isArray(prev.editHistory) ? prev.editHistory.slice(-19) : [];
      o.editHistory.push({ at: new Date().toISOString(), by: (curSession() || {}).name || '', rev: +prev.rev || 0, reason: 'اصلاح پیش از برد' });
    }
    delete o._baseNo; delete o._origNo; delete o.baseNo;
    /* direct edit intentionally keeps the previous status and revision number;
       only the explicit «نگارش جدید» button is allowed to increase Rev. */
    offers[idx] = o;
  } else {
    delete o._baseNo; delete o._origNo; delete o.baseNo;
    offers.unshift(o);
  }
  // US-142 AC5 + v31.7.21 US-OFF-ALT: لینک TO→CO اول حفظ می‌شود؛ پیشنهادهای جایگزین آن را بازنویسی نمی‌کنند
  if (o.kind === 'CO' && o.srcToNo) {
    offers.forEach(function (x) { if (x.no === o.srcToNo && (!x.coNo || !offers.some(function(y){ return y.no === x.coNo; }))) x.coNo = o.no; });
  }
  var productSyncNotes = [];
  var _toCatalogRequested = !!(document.getElementById('ofRefToCatalog') || {}).checked;
  // US-214: همگام‌سازی مستقیم مشخصات با دایرکتوری کالا؛ پیام/audit آن فقط post-ACK صادر می‌شود.
  if (o.kind === 'CO') {
    var prods = getData('ptf_crm_products');
    var prodsChanged = false;
    o.items.forEach(function(it) {
      var desc = (it.name || '').trim();
      if (!desc) return;
      var p = prods.filter(function(x){ return (it.prodCd && x.cd === it.prodCd) || x.nm === desc; })[0];
      if (p) {
        var catalogRecordChanged = false;
        if (it.desc && p.st !== it.desc) {
          p.history = p.history || [];
          p.history.push({ t: faDate(), note: 'به‌روزرسانی مشخصات از پیش‌فاکتور ' + o.no });
          p.st = it.desc;
          prodsChanged = true; catalogRecordChanged = true;
        }
        if (it.model && p.model !== it.model) { p.model = it.model; prodsChanged = true; catalogRecordChanged = true; }
        if (it.brand && p.br !== it.brand) { p.br = it.brand; prodsChanged = true; catalogRecordChanged = true; }
        if (catalogRecordChanged) p.ts = new Date().toISOString();
      }
    });
    if (prodsChanged) {
      /* v34.8.23 (W1-iterate): از مسیر فرمان اتمیک */
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', prods, { reason: 'inv-prodsync' });
      else setData('ptf_crm_products', prods);
      productSyncNotes.push('مشخصات دایرکتوری کالا بر اساس پیش‌فاکتور همگام‌سازی شد');
    }
  }
  /* ===== v31.7.12 US-OFF-REF: همگام‌سازی نرخ مرجع و ثبت خودکار کالاهای دستی/اکسلی ===== */
  try {
    var _prods2 = getData('ptf_crm_products');
    var _pChanged = false, _pAdded = 0, _refSynced = 0;
    (o.items || []).forEach(function (it) {
      if (!it) return;
      var nm = String(it.name || '').trim();
      if (!nm) return;
      /* یافتن کالای متناظر: اول pcode/prodCd قفل‌شده، بعد resolver امن، بعد تطبیق نام نرمال */
      var p = null;
      var pcd = it.pcode || it.prodCd || '';
      if (pcd) p = _prods2.filter(function (x) { return x.cd === pcd; })[0];
      if (!p && typeof window.ptfResolveProcurementLine === 'function') {
        var rm = window.ptfResolveProcurementLine(it, _prods2);
        if (rm.ok) p = rm.item;
      }
      if (!p && typeof dedupNorm === 'function') p = _prods2.filter(function (x) { return dedupNorm(x.nm) === dedupNorm(nm); })[0];
      if (p) {
        /* write-back نرخ مرجع ویرایش‌شده در فرم → ماژول کالا (فقط تغییر واقعی + history) */
        if (_toCatalogRequested && it.refPriceEdited && +it.refPrice > 0 && +p.pr !== +it.refPrice) {
          p.history = p.history || [];
          p.history.push({ t: (typeof faDate === 'function' ? faDate() : ''), note: 'به‌روزرسانی نرخ مرجع از پیشنهاد ' + o.no + ': ' + (+p.pr || 0).toLocaleString('en-US') + ' → ' + (+it.refPrice).toLocaleString('en-US') });
          p.pr = +it.refPrice;
          p.refPriceAt = (typeof faDate === 'function' ? faDate() : '');
          p.refPriceSrc = 'پیشنهاد ' + o.no;
          p.ts = new Date().toISOString();
          _pChanged = true; _refSynced++;
        }
      } else if (_toCatalogRequested) {
        /* کالای دستی/اکسلی فقط با تیک صریح بانک کالا ثبت می‌شود. */
        var dup = (typeof ptfCheckDup === 'function') ? ptfCheckDup('product', { nm: nm }, null) : [];
        if (!dup.length) {
          var _cd2 = (typeof prodAutoCode === 'function') ? prodAutoCode() : 'P-' + (1000 + _prods2.length + 1);
          if (_cd2 && !/^TMP-/.test(String(_cd2))) {
            _prods2.push({ cd: _cd2, nm: nm, en: '', ca: 'سایر', st: it.desc || '', br: it.brand || '', md: it.model || '',
              un: it.unit || 'NO', pr: (it.refPriceEdited && +it.refPrice > 0) ? +it.refPrice : 0,
              refPriceAt: (it.refPriceEdited && +it.refPrice > 0) ? (typeof faDate === 'function' ? faDate() : '') : '',
              refPriceSrc: (it.refPriceEdited && +it.refPrice > 0) ? ('پیشنهاد ' + o.no) : '',
              srcRef: { kind: 'offer', no: o.no || '', inqNo: o.inqNo || '', at: new Date().toISOString(), by: (typeof curSession === 'function' ? (curSession().user || '') : '') },
              ds: 'ثبت خودکار از پیشنهاد ' + o.no, ts: new Date().toISOString(), ts0: new Date().toISOString() });
            it.pcode = _cd2; /* قفل ردیف به کالای جدید */
            _pChanged = true; _pAdded++;
          }
        }
      }
    });
    if (_pChanged) {
      /* v34.8.23 (W1-iterate): از مسیر فرمان اتمیک */
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', _prods2, { reason: 'inv-products' });
      else setData('ptf_crm_products', _prods2);
      var _msg = [];
      if (_refSynced) _msg.push(_refSynced + ' نرخ مرجع در ماژول کالا به‌روز شد');
      if (_pAdded) _msg.push(_pAdded + ' کالای جدید با مارک منبع ' + o.no + ' ثبت شد');
      productSyncNotes = productSyncNotes.concat(_msg);
    }
  } catch (eProdSync) { try { console.error('prod sync from offer', eProdSync); } catch (e0) {} }
  if (setData('ptf_crm_offers', offers) === false) {
    alert('⛔ پیشنهاد روی حافظهٔ پایدار این دستگاه ذخیره نشد. تب را نبندید؛ فضای مرورگر/دسترسی را بررسی و دوباره ثبت کنید.');
    return;
  }
  return { ok: true, offerNo: o.no, updatedAtISO: o.updatedAtISO, idx: idx, madeRevision: madeRevision, commandManaged: true, productSyncNotes: productSyncNotes, toCatalog: _toCatalogRequested };
  } catch (eSave) {
    try { console.error('offerSave error', eSave); } catch (e0) {}
    alert('⛔ خطا در ذخیره پیشنهاد: ' + (eSave && eSave.message ? eSave.message : eSave));
    return { ok: false, error: eSave && eSave.message ? eSave.message : String(eSave || 'save_failed') };
  }
}
window.offerSave = offerSave;
window.offerEdit = offerEdit;
window.offerNew = offerNew;
window.offerForm = offerForm;
window.offerPreview = offerPreview;


// ---- خروجی CSV ----
function offerCsv(no) {
  var o = getData('ptf_crm_offers').filter(function(x){ return x.no === no; })[0];
  if (!o) return;
  var isCO = o.kind === 'CO';
  var rows = [[o.kind === 'TO' ? 'TECHNICAL OFFER' : 'COMMERCIAL OFFER'], ['No: ' + o.no, 'Date: ' + o.dateEn], []];
  rows.push(isCO ? ['No', 'Description', 'Qty', 'Unit', 'Unit Price', 'Total'] : ['No', 'Description', 'Qty', 'Unit', 'Brand', 'Delivery']);
  o.items.forEach(function(it, i) {
    rows.push(isCO ? [i + 1, it.desc, it.qty, it.unit, it.price, (+it.qty||0)*(+it.price||0)]
                   : [i + 1, it.desc, it.qty, it.unit, it.brand, it.dlv]);
  });
  if (isCO) {
    var total = o.items.reduce(function(s, it){ return s + (+it.qty||0)*(+it.price||0); }, 0);
    rows.push(['', 'GRAND TOTAL', '', '', '', total]);
    rows.push(['', 'In Words: ' + numToWords(total) + ' Rials']);
  }
  var csv = '\uFEFF' + rows.map(function(r){ return r.map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = o.no + '.csv';
  a.click();
}

// ---- خروجی PDF: صفحه چاپ A4 لنداسکیپ (AC1, AC10) ----
function offerPrint(no) {
  var o = getData('ptf_crm_offers').filter(function(x){ return x.no === no; })[0];
  if (!o) return;
  offerPrintObj(o);
}

function offerPrintObj(o) {
  var isCO = o.kind === 'CO' || o.kind === 'TC';
  var ec = o.extraCols || [];
  var baseFont = ec.length === 0 ? 10 : ec.length === 1 ? 9.5 : ec.length === 2 ? 9 : 8.5;
  var _pAs = (o.kind !== 'TO') ? (o.printAs || (o.kind === 'TC' ? 'TC' : 'CO')) : ''; /* v20.1 US-442 */
  var title = _pAs === 'TC' ? 'Techno-Commercial Offer' : (o.kind === 'TO' ? 'Technical Offer' : 'Commercial Offer');
  var pdfFileName = typeof ptfOfferPdfFileName === 'function' ? ptfOfferPdfFileName(o) : o.no;
  var total = o.items.reduce(function(s, it){ return s + (+it.qty||0)*(+it.price||0); }, 0);
  var printCur = (typeof offerCurrency === 'function') ? offerCurrency(o) : { id: o.currency || 'IRR' };
  var moneyPrint = function (v) {
    if (typeof window.offPrintAmount === 'function') return window.offPrintAmount(v, printCur);
    if (typeof offerFmtMoney === 'function') return offerFmtMoney(v, printCur);
    var n = (typeof window.offParseMoney === 'function') ? window.offParseMoney(v) : (+v || 0);
    var s = n.toLocaleString('en-US');
    return (typeof ptfEnDigits === 'function') ? ptfEnDigits(s) : s;
  };
  var pageCount = Math.max(1, Math.ceil(o.items.length / (isCO ? 8 : 5)));

  // ---- جدول اقلام: ستون‌ها مطابق فرمت رسمی شرکت ----
  var ecTh = ec.map(function(c){ return '<th>' + escP(c) + '</th>'; }).join('');
  // US-208: نمایش ستون Model در خروجی چاپی و PDF هر دو پیشنهاد فنی و مالی
  var thead = isCO
    ? '<tr><th style="width:5%">Sr. No.</th><th>Item Name</th><th style="width:6%">Unit</th><th style="width:6%">QTY</th><th style="width:9%">Brand</th><th style="width:9%">Model</th>' + ecTh + '<th style="width:14%">Unit Price (IRR)</th><th style="width:15%">Total Price (IRR)</th></tr>'
    : '<tr><th style="width:5%">Sr. No.</th><th style="width:14%">Item Name</th><th style="width:5%">Unit</th><th style="width:5%">QTY</th><th style="width:9%">Brand</th><th style="width:11%">Model</th>' + ecTh + '<th>Description</th></tr>';

  var tbody = '';
  o.items.forEach(function(it, i) {
    var nm = escP(it.name || it.desc || '');
    var ecTd = ec.map(function(c){ return '<td>' + escP((it.extra||{})[c] || '—') + '</td>'; }).join('');
    if (isCO) {
      var full = nm + (it.desc && it.name ? '<div class="idesc">' + escP(it.desc) + '</div>' : '');
      tbody += '<tr><td>' + (i+1) + '</td><td class="lft"><b>' + full + '</b></td><td>' + escP((typeof ptfOfferUnitEn==='function'?ptfOfferUnitEn(it.unit): (it.unit||'NO'))) + '</td><td>' + (it.qty||0) + '</td><td>' + escP(it.brand||'—') + '</td><td>' + escP(it.model||'—') + '</td>' + ecTd +
        '<td class="num">' + moneyPrint(it.price) + '</td><td class="num">' + moneyPrint((+it.qty||0)*(+it.price||0)) + '</td></tr>';
    } else {
      tbody += '<tr><td>' + (i+1) + '</td><td class="lft"><b>' + nm + '</b></td><td>' + escP((typeof ptfOfferUnitEn==='function'?ptfOfferUnitEn(it.unit): (it.unit||'NO'))) + '</td><td>' + (it.qty||0) + '</td><td>' + escP(it.brand||'—') + '</td><td>' + escP(it.model||'—') + '</td>' + ecTd +
        '<td class="lft desc">' + escP(it.desc||'').replace(/;\s*/g, '<br>') + (it.dlv ? '<br><i>Delivery: ' + escP(it.dlv) + '</i>' : '') + '</td></tr>';
    }
  });
  if (isCO) {
    tbody += '<tr class="total"><td colspan="' + (8 + ec.length) + '" class="lft"><b>Total</b> &nbsp;<span class="words">' + numToWords(total) + ' Iranian Rials</span></td>' +
      '<td colspan="2" class="num big">' + moneyPrint(total) + ' IRR</td></tr>';
  }

  var _termsArr = (o.terms || []).slice();
  if (typeof ptfAdvanceLabel === 'function' && o.advance && o.advance.mode && o.advance.mode !== 'none') {
    _termsArr.unshift('Payment / Advance Payment: ' + ptfAdvanceLabel(o, { en: true }));
  }
  var terms = _termsArr.length
    ? '<div class="terms"><b>Terms &amp; Conditions:</b><ol>' + _termsArr.map(function(t){ return '<li>' + escP(t) + '</li>'; }).join('') + '</ol></div>' : '';

  // US-142 AC7 + US-148: مهر و امضای صادرکننده — روی CO همیشه (در صورت وجود پروفایل)، روی TO فقط با تیک useSig
  var sigImgs = '';
  if (isCO || o.useSig) {
    try {
      var sigUser = o.signAs || o.issuedBy || (typeof curSession === 'function' ? curSession().user : '');
      var sp = typeof window.ptfSigProfileFor === 'function' ? (window.ptfSigProfileFor(sigUser) || {}) : ((getData('ptf_crm_sigprofiles') || {})[sigUser] || {}); /* v13.1: امضای نیابتی */
      if (isCO && o.useSig === false) sp = {}; // CO با تیک برداشته → بدون امضا
      if (sp.sig) sigImgs += '<img src="' + sp.sig + '" style="max-height:52px;max-width:150px;margin:0 4px">';
      if (sp.stamp) sigImgs += '<img src="' + sp.stamp + '" style="max-height:64px;max-width:110px;margin:0 4px;opacity:.9">';
    } catch (e) {}
  }
  var sigBlock = '<div class="sig"><div class="box">' +
    (sigImgs ? '<div style="display:flex;justify-content:center;align-items:flex-end;min-height:42px">' + sigImgs + '</div>' : '') +
    '<div class="line"' + (sigImgs ? ' style="margin-top:3px"' : '') + '>Authorized Signature &amp; Stamp<br>' + SELLER_INFO.company + '</div></div></div>';
    var tailBlock = '<div class="tail">' + terms + sigBlock + '</div>';

  var fullDocHtml = '<!doctype html><html><head><meta charset="utf-8"><title>' + escP(pdfFileName) + '</title><style>' +
    '@page{size:A4 landscape;margin:10mm 12mm 16mm 12mm}' +
    ':root{--brand:#ef4b1a;--gold:#f79400;--ink:#1f2328}' +
    '*{box-sizing:border-box}' +
    'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:10.5px;color:var(--ink);margin:0;padding-bottom:40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.hdr{display:grid;grid-template-columns:120px 1fr 190px;align-items:start;gap:10px;padding-bottom:6px;border-bottom:2.5px solid var(--brand);margin-bottom:10px}' +
    '.hdr img{height:64px}' +
    '.hdr .mid{text-align:center;padding-top:2px}' +
    '.hdr .co{font-size:21px;font-weight:700;color:var(--brand);letter-spacing:.3px;font-family:Georgia,"Times New Roman",serif}' +
    '.hdr .sub{font-size:13px;color:var(--gold);font-weight:600;margin-top:6px;letter-spacing:1.2px;text-transform:uppercase}' +
    '.hdr .meta{text-align:right;font-size:10px;line-height:1.9;color:#333;padding-top:4px}' +
    '.hdr .meta b{color:#c0392b}' +
    '.hdr .meta .no{font-size:11px;font-weight:700;color:#c0392b}' +
    '.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:10px}' +
    '.party{border:1px solid #e3e5e8;border-radius:6px;padding:8px 12px;font-size:10px;line-height:1.9;background:#fcfcfc}' +
    '.party .pt{font-size:12.5px;font-weight:700;color:var(--gold);margin-bottom:3px;font-family:Georgia,serif}' +
    '.party b{color:var(--gold);font-weight:600}' +
    'table{width:100%;border-collapse:collapse;font-size:' + baseFont + 'px;page-break-inside:auto}' +
    'tr{page-break-inside:avoid}' +
    'th{background:var(--gold);color:#fff;border:1px solid #d98700;padding:5px 6px;font-size:10px;letter-spacing:.2px}' +
    'td{border:1px solid #9aa0a6;padding:5px 6px;text-align:center;vertical-align:middle}' +
    'td.lft{text-align:left}td.num{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    'td.desc{font-size:9.5px;line-height:1.55;color:#2c3136}' +
    '.idesc{font-weight:400;font-size:9px;color:#555;margin-top:2px}' +
    'tr.total td{background:#fdf1e7;border-top:2px solid var(--gold)}' +
    'tr.total .words{font-weight:400;font-style:italic;font-size:9.5px;color:#444}' +
    'tr.total .big{font-size:11.5px;font-weight:700}' +
    'thead{display:table-header-group}' +
    '.tail{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:8px;page-break-inside:auto;break-inside:auto}' +
    '.terms{flex:1;min-width:320px;font-size:10px;page-break-inside:auto}' +
    '.terms b{color:#c0392b;font-family:Georgia,serif;font-size:11.5px;display:block;page-break-after:avoid}' +
    '.terms ol{margin:4px 0 0 18px;padding:0}.terms li{margin-bottom:2px;line-height:1.5;page-break-inside:avoid;page-break-after:auto}' +
    '.sig{flex:0 0 220px;margin-top:0;margin-bottom:18px;display:flex;justify-content:flex-end;page-break-inside:avoid}' +
    '.sig .box{width:220px;text-align:center;font-size:9.5px;color:#555}' +
    '.sig .line{border-top:1px solid #999;margin-top:36px;padding-top:3px}' +
    '.ftr{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9px;color:var(--gold);line-height:1.7;border-top:1px solid #f0d9b8;padding-top:3px;background:#fff}' +
    '</style></head><body>' +
    '<div class="ftr">Address: ' + SELLER_INFO.address + '<br>Tel: ' + SELLER_INFO.tel + ' &nbsp;|&nbsp; ' + SELLER_INFO.email + ' &nbsp;|&nbsp; www.pishtaj.ir</div>' +
    '<div class="hdr">' +
    '<img src="' + SELLER_INFO.logo + '" alt="PTF">' +
    '<div class="mid"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="sub">' + title + '</div></div>' +
    '<div class="meta"><span class="no">' + (isCO ? 'CO' : 'TO') + ' No.: ' + escP(o.no) + (o.rev ? ' (Rev.' + String(o.rev).padStart(2, '0') + ')' : '') + '</span><br>' +
    '<b>Date:</b> ' + escP(o.dateEn) + '<br><span style="color:#888">Page 1 of ' + pageCount + '</span></div>' +
    '</div>' +
    '<div class="parties">' +
    '<div class="party"><div class="pt">Vendor</div>' +
    '<b>Name:</b> ' + SELLER_INFO.company + '<br>' +
    '<b>National ID:</b> ' + SELLER_INFO.nationalId + '<br>' +
    '<b>Contact Person:</b> ' + escP(o.sellerContact || SELLER_INFO.contact) + '<br>' +
    '<b>Tel:</b> ' + SELLER_INFO.tel + '</div>' +
    '<div class="party"><div class="pt">Client</div>' +
    '<b>Name:</b> ' + escP(o.buyerCo || '—') + '<br>' +
    '<b>Request No:</b> ' + escP((typeof ptfInqClientNo === 'function' ? ptfInqClientNo(o.inqNo) : o.inqNo) || '—') + '<br>' +
    '<b>Attention:</b> ' + escP(o.buyerContact || '—') + '<br>' +
    '<b>Tel:</b> ' + escP((o.buyerTel && typeof ptfPhoneNorm === 'function') ? (ptfPhoneNorm(o.buyerTel, 'print') || o.buyerTel) : (o.buyerTel || '—')) + '</div>' +
    '</div>' +
    '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>' +
    tailBlock +
    '<script>window.onload=function(){setTimeout(function(){window.print()},450)}<\/script>' +
    '</body></html>';

  if (typeof ptfPreviewPrintableDoc === 'function' && !window._inUatTestMock) {
    ptfPreviewPrintableDoc(title + ' — ' + escP(o.no), fullDocHtml, pdfFileName);
    return;
  }

  var w = window.open('', '_blank');
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + escP(pdfFileName) + '</title><style>' +
    '@page{size:A4 landscape;margin:10mm 12mm 16mm 12mm}' +
    ':root{--brand:#ef4b1a;--gold:#f79400;--ink:#1f2328}' +
    '*{box-sizing:border-box}' +
    'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:10.5px;color:var(--ink);margin:0;padding-bottom:40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    /* ---- هدر: لوگو چپ، عنوان وسط، متادیتا راست ---- */
    '.hdr{display:grid;grid-template-columns:120px 1fr 190px;align-items:start;gap:10px;padding-bottom:6px;border-bottom:2.5px solid var(--brand);margin-bottom:10px}' +
    '.hdr img{height:64px}' +
    '.hdr .mid{text-align:center;padding-top:2px}' +
    '.hdr .co{font-size:21px;font-weight:700;color:var(--brand);letter-spacing:.3px;font-family:Georgia,"Times New Roman",serif}' +
    '.hdr .sub{font-size:13px;color:var(--gold);font-weight:600;margin-top:6px;letter-spacing:1.2px;text-transform:uppercase}' +
    '.hdr .meta{text-align:right;font-size:10px;line-height:1.9;color:#333;padding-top:4px}' +
    '.hdr .meta b{color:#c0392b}' +
    '.hdr .meta .no{font-size:11px;font-weight:700;color:#c0392b}' +
    /* ---- طرفین ---- */
    '.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:10px}' +
    '.party{border:1px solid #e3e5e8;border-radius:6px;padding:8px 12px;font-size:10px;line-height:1.9;background:#fcfcfc}' +
    '.party .pt{font-size:12.5px;font-weight:700;color:var(--gold);margin-bottom:3px;font-family:Georgia,serif}' +
    '.party b{color:var(--gold);font-weight:600}' +
    /* ---- جدول ---- */
    'table{width:100%;border-collapse:collapse;font-size:' + baseFont + 'px;page-break-inside:auto}' +
    'tr{page-break-inside:avoid}' +
    'th{background:var(--gold);color:#fff;border:1px solid #d98700;padding:5px 6px;font-size:10px;letter-spacing:.2px}' +
    'td{border:1px solid #9aa0a6;padding:5px 6px;text-align:center;vertical-align:middle}' +
    'td.lft{text-align:left}td.num{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}' + /* v17.0 US-409 */
    'td.desc{font-size:9.5px;line-height:1.55;color:#2c3136}' +
    '.idesc{font-weight:400;font-size:9px;color:#555;margin-top:2px}' +
    'tr.total td{background:#fdf1e7;border-top:2px solid var(--gold)}' +
    'tr.total .words{font-weight:400;font-style:italic;font-size:9.5px;color:#444}' +
    'tr.total .big{font-size:11.5px;font-weight:700}' +
    'thead{display:table-header-group}' +
    /* ---- شرایط + امضا ---- */
    '.tail{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:8px;page-break-inside:auto;break-inside:auto}' +
    '.terms{flex:1;min-width:320px;font-size:10px;page-break-inside:auto}' +
    '.terms b{color:#c0392b;font-family:Georgia,serif;font-size:11.5px;display:block;page-break-after:avoid}' +
    '.terms ol{margin:4px 0 0 18px;padding:0}.terms li{margin-bottom:2px;line-height:1.5;page-break-inside:avoid;page-break-after:auto}' +
    '.sig{flex:0 0 220px;margin-top:0;margin-bottom:18px;display:flex;justify-content:flex-end;page-break-inside:avoid}' +
    '.sig .box{width:220px;text-align:center;font-size:9.5px;color:#555}' +
    '.sig .line{border-top:1px solid #999;margin-top:36px;padding-top:3px}' +
    /* ---- فوتر ثابت هر صفحه ---- */
    '.ftr{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9px;color:var(--gold);line-height:1.7;border-top:1px solid #f0d9b8;padding-top:3px;background:#fff}' +
    '</style></head><body>' +
    '<div class="ftr">Address: ' + SELLER_INFO.address + '<br>Tel: ' + SELLER_INFO.tel + ' &nbsp;|&nbsp; ' + SELLER_INFO.email + ' &nbsp;|&nbsp; www.pishtaj.ir</div>' +
    '<div class="hdr">' +
    '<img src="' + SELLER_INFO.logo + '" alt="PTF">' +
    '<div class="mid"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="sub">' + title + '</div></div>' +
    '<div class="meta"><span class="no">' + (isCO ? 'CO' : 'TO') + ' No.: ' + escP(o.no) + (o.rev ? ' (Rev.' + String(o.rev).padStart(2, '0') + ')' : '') + '</span><br>' +
    '<b>Date:</b> ' + escP(o.dateEn) + '<br><span style="color:#888">Page 1 of ' + pageCount + '</span></div>' +
    '</div>' +
    '<div class="parties">' +
    '<div class="party"><div class="pt">Vendor</div>' +
    '<b>Name:</b> ' + SELLER_INFO.company + '<br>' +
    '<b>National ID:</b> ' + SELLER_INFO.nationalId + '<br>' +
    '<b>Contact Person:</b> ' + escP(o.sellerContact || SELLER_INFO.contact) + '<br>' +
    '<b>Tel:</b> ' + SELLER_INFO.tel + '</div>' +
    '<div class="party"><div class="pt">Client</div>' +
    '<b>Name:</b> ' + escP(o.buyerCo || '—') + '<br>' +
    '<b>Request No:</b> ' + escP((typeof ptfInqClientNo === 'function' ? ptfInqClientNo(o.inqNo) : o.inqNo) || '—') + '<br>' +
    '<b>Attention:</b> ' + escP(o.buyerContact || '—') + '<br>' +
    '<b>Tel:</b> ' + escP((o.buyerTel && typeof ptfPhoneNorm === 'function') ? (ptfPhoneNorm(o.buyerTel, 'print') || o.buyerTel) : (o.buyerTel || '—')) + '</div>' /* v14.2 US-357 */ +
    '</div>' +
    '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>' +
    tailBlock +
    '<script>window.onload=function(){setTimeout(function(){window.print()},450)}<\/script>' +
    '</body></html>');
  w.document.close();
}

/* ---------- بازنویسی مودال‌ها و رندر کارفرما/تامین‌کننده با دفترچه تماس ---------- */

function showCustModal(cd) {
  var c = null;
  if (cd) c = getData('ptf_crm_customers').filter(function(x){ return x.cd === cd; })[0];
  cbInit(c ? c.people : []);
  indivPhonesInit(c ? c.phones : []);
  var INDS = ['نفت و گاز','پتروشیمی','نیروگاه','فولاد','سیمان','آب','سایر'];
  var indOpts = INDS.map(function(x){ return '<option' + (c && c.ind === x ? ' selected' : '') + '>' + x + '</option>'; }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:640px;max-height:92vh;overflow:auto">' +
    '<h3>' + (c ? '✏️ ویرایش مشتری' : '🤝 مشتری جدید') + '</h3>' +
    '<div class="fr"><div class="fld"><label>نام شرکت / شخص (فارسی) *</label><input type="text" id="nC2Comp" value="' + (c ? escP(c.co) : '') + '"></div>' +
    '<div class="fld"><label>نام انگلیسی شرکت (روی اسناد TO/CO)</label><input type="text" id="nC2CoEn" value="' + (c ? escP(c.coEn||'') : '') + '" placeholder="e.g. Sadaf Petrochemical Co." style="direction:ltr">' +
    '<a href="javascript:void(0)" onclick="ptfGenCoEn()" style="font-size:11px;color:#7c3aed">🤖 تولید نام انگلیسی با AI</a></div></div>' +
    /* v14.6 (US-352 — نقشه راه مصوب): سقف اعتبار مشتری — هنگام صدور CO با مانده باز مقایسه می‌شود */
    ((typeof roleDef === 'function' && (roleDef() || {}).sellPrice) ? '<div class="fr"><div class="fld"><label>💳 سقف اعتبار مشتری (ریال — خالی = بدون سقف)</label><input type="text" inputmode="numeric" data-money="1" id="nC2Credit" value="' + (c && c.creditLimit ? (+c.creditLimit).toLocaleString('en-US') : '') + '" style="direction:ltr" placeholder="مثال: 5,000,000,000" autocomplete="off"></div><div class="fld"><small style="color:#94a3b8;font-size:11px;display:block;padding-top:26px">هنگام صدور پیشنهاد مالی، اگر مانده مطالبات باز + مبلغ جدید از سقف عبور کند هشدار داده می‌شود.</small></div></div>' : '') +
    '<div class="fr"><div class="fld"><label>نوع مشتری *</label><select id="nC2Kind" onchange="custKindToggle()">' +
      '<option value="حقوقی"' + (!c || c.kind !== 'حقیقی' ? ' selected' : '') + '>🏢 حقوقی (شرکت / سازمان)</option>' +
      '<option value="حقیقی"' + (c && c.kind === 'حقیقی' ? ' selected' : '') + '>👤 حقیقی (شخص)</option></select></div>' +
    '<div class="fld"><label>صنعت</label><select id="nC2Ind">' + indOpts + '</select></div></div>' +
    /* v21.5 US-411ف1: کارشناس فروش مسئول (owner) — تغییر فقط ارشد */
    (function () {
      var isSen = false;
      try { isSen = ['admin','chairman','ceo','commercial'].indexOf(typeof curRole==='function'?curRole():'') > -1; } catch (e) {}
      var owner = (c && (c.owner || c.crBy)) || '';
      var opts = '<option value="">— تعیین‌نشده —</option>';
      try {
        (getData('ptf_crm_users') || []).forEach(function (u) {
          var un = u.username || u.user || '';
          if (!un) return;
          var rl = u.roleId || u.role || '';
          /* مالک پورسانت ممکن است هر کاربر عملیاتی باشد؛ فهرست را بر اساس نقش
             محدود نکنید. مدیر انتخاب می‌کند آیا این مشتری به فروش، خرید، حسابداری
             یا کاربر دیگری تعلق دارد. */
          opts += '<option value="' + escP(un) + '"' + (owner === un ? ' selected' : '') + '>' + escP(u.name || u.nm || un) + (rl ? ' (' + rl + ')' : '') + '</option>';
        });
      } catch (eO) {}
      if (!isSen) {
        var label = owner || '—';
        try {
          var uo = (getData('ptf_crm_users')||[]).filter(function(x){return (x.username||x.user)===owner;})[0];
          if (uo) label = uo.name || uo.nm || owner;
        } catch (eL) {}
        return '<div class="fld"><label>👤 کارشناس مسئول / مالک پورسانت</label><input type="text" value="' + escP(label) + '" readonly style="background:#f1f5f9;color:#475569" title="تغییر مالک فقط توسط مدیران ارشد">' +
          (c && c.crBy ? '<small style="color:#94a3b8;font-size:11px">ثبت‌کننده اولیه: ' + escP(c.crBy) + (c.crAt ? ' — ' + escP(c.crAt) : '') + '</small>' : '') + '</div>';
      }
      return '<div class="fr"><div class="fld"><label>👤 کارشناس مسئول / مالک پورسانت</label><select id="nC2Owner">' + opts + '</select>' +
        (c && c.crBy ? '<small style="color:#94a3b8;font-size:11px">ثبت‌کننده: ' + escP(c.crBy) + (c.crAt ? ' — ' + escP(c.crAt) : '') + '</small>' : '') +
        '</div><div class="fld"><small style="color:#94a3b8;font-size:11px;display:block;padding-top:26px">تغییر مالک فقط برای admin/chairman/ceo/commercial — با audit</small></div></div>';
    })() +
    /* US-267 (v23.0 مصوب کارفرما): تایم‌لاین ۶مرحله‌ای عضویت PTF در وندور لیست کارفرما (AVL) */
    '<div class="fr"><div class="fld"><label>وضعیت عضویت PTF در وندور لیست کارفرما (AVL)</label><select id="nC2VenSt">' +
      '<option value="unreg"' + (!c || (c.venSt||'unreg') === 'unreg' ? ' selected' : '') + '>⚪ ۱. ثبت‌نشده / بدون اقدام</option>' +
      '<option value="prep"' + (c && c.venSt === 'prep' ? ' selected' : '') + '>🟠 ۲. در حال تکمیل اسناد ارزیابی و رزومه</option>' +
      '<option value="sent"' + (c && c.venSt === 'sent' ? ' selected' : '') + '>📤 ۳. مدارک ارزیابی ارسال شد (در انتظار بررسی)</option>' +
      '<option value="eval"' + (c && (c.venSt === 'eval' || c.venSt === 'pending') ? ' selected' : '') + '>⏳ ۴. در حال ارزیابی در کمیته فنی کارفرما</option>' +
      '<option value="approved"' + (c && c.venSt === 'approved' ? ' selected' : '') + '>🏆 ۵. تاییدشده / عضو رسمی وندور لیست (AVL)</option>' +
      '<option value="rejected"' + (c && c.venSt === 'rejected' ? ' selected' : '') + '>🔴 ۶. ردشده توسط کارفرما / نیازمند رفع نقص</option></select></div>' +
    '<div class="fld"><label>شماره وندور (در صورت تایید)</label><input type="text" id="nC2VenNo" value="' + (c ? escP(c.venNo||'') : '') + '" style="direction:ltr" placeholder="مثلا: AVL-9088"></div></div>' +
    '<div class="fr"><div class="fld"><label>تاریخ سررسید پیگیری بعدی وندور (شمسی)</label>' + (typeof ptfDatePicker === 'function' ? ptfDatePicker('nC2VenDue', c ? (c.venDueFa || c.venDueISO || '') : '') : '<input type="text" id="nC2VenDue" value="' + (c ? escP(c.venDueFa || c.venDueISO || '') : '') + '">') + '</div>' +
    '<div class="fld"><label>یادداشت آخرین اقدام / پرونده وندور</label><input type="text" id="nC2VenNote" value="' + (c ? escP(c.venNote||'') : '') + '" placeholder="مثلا: رزومه به ایمیل کمیته فنی نفت ارسال شد"></div></div>' +
    '<div class="fr"><div class="fld"><label>تلفنخانه شرکت</label><input type="text" id="nC2Tel" value="' + (c && (c.coTels||[])[0] ? escP(c.coTels[0].n) : '') + '" placeholder="مثال: 021-88000000" style="direction:ltr"></div>' +
    '<div class="fld"><label>وب‌سایت / ایمیل عمومی</label><input type="text" id="nC2Web" value="' + (c ? escP(c.coWeb || c.coMail || '') : '') + '" style="direction:ltr"></div></div>' +
    '<div class="fr"><div class="fld" id="natIdFld"><label>شناسه ملی (حقوقی)</label><input type="text" id="nC2NatId" value="' + (c ? escP(c.natId || '') : '') + '" placeholder="14010077558" style="direction:ltr" maxlength="11"></div>' +
    '<div class="fld" id="melliFld" style="display:none"><label>کد ملی (حقیقی)</label><input type="text" id="nC2Melli" value="' + (c ? escP(c.melli || '') : '') + '" placeholder="0012345678" style="direction:ltr" maxlength="10"></div></div>' + indivPhonesHtml('indivPhBox') +
    '<div class="fld"><label>آدرس</label><input type="text" id="nC2Addr" value="' + (c ? escP(c.coAddr || '') : '') + '"></div>' +
    '<div id="corpOnlyWrap"><h4 style="margin:12px 0 8px">👥 اشخاص رابط</h4><div id="cbWrap"></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
    '<button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveCust2(' + (c ? "'" + escP(c.cd) + "'" : 'null') + ')">' + (c ? 'ذخیره' : 'ثبت') + '</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  cbRender();
  custKindToggle();
}

// US-168: نمایش داینامیک فیلدها بر اساس حقیقی/حقوقی

// v80.2: تلفن/موبایل‌های شخص حقیقی — افزودن نامحدود (مشترک مشتری/تامین‌کننده)
var _indivPhones = [];
function indivPhonesInit(list) { _indivPhones = (list || []).slice(); }
function indivPhonesHtml(boxId) {
  return '<div class="fld" id="' + boxId + '" style="display:none"><label>📞 تلفن‌ها و موبایل‌های شخص</label>' +
    '<div id="' + boxId + '_rows"></div>' +
    '<div style="display:flex;gap:6px;margin-top:4px">' +
    '<button type="button" class="bt bt-o" style="padding:4px 11px;font-size:12px" onclick="indivPhoneAdd(\'mob\')">+ موبایل</button>' +
    '<button type="button" class="bt bt-o" style="padding:4px 11px;font-size:12px" onclick="indivPhoneAdd(\'tel\')">+ تلفن ثابت</button></div></div>';
}
function indivPhonesRender() {
  var rows = document.querySelector('[id$="_rows"]');
  // پیدا کردن باکس فعال (مشتری یا تامین‌کننده)
  var box = document.getElementById('indivPhBox') || document.getElementById('supIndivPhBox');
  if (!box) return;
  var el = box.querySelector('[id$="_rows"]');
  if (!el) return;
  el.innerHTML = _indivPhones.map(function (p, i) {
    return '<div style="display:flex;gap:6px;margin-bottom:5px;align-items:center">' +
      '<span style="font-size:12px;color:#94a3b8;min-width:52px">' + (p.k === 'mob' ? '📱 موبایل' : '☎️ ثابت') + '</span>' +
      '<input type="text" value="' + escP(p.n) + '" oninput="_indivPhones[' + i + '].n=this.value" placeholder="' + (p.k === 'mob' ? '0912xxxxxxx' : '021xxxxxxxx') + '" style="flex:1;padding:7px;border:1px solid var(--brd);border-radius:8px;direction:ltr">' +
      '<input type="text" value="' + escP(p.lb || '') + '" oninput="_indivPhones[' + i + '].lb=this.value" placeholder="برچسب (کاری/شخصی)" style="width:110px;padding:7px;border:1px solid var(--brd);border-radius:8px">' +
      '<button type="button" onclick="_indivPhones.splice(' + i + ',1);indivPhonesRender()" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></div>';
  }).join('') || '<div style="color:#94a3b8;font-size:12px">شماره‌ای ثبت نشده — با دکمه‌های زیر اضافه کنید</div>';
}
function indivPhoneAdd(k) { _indivPhones.push({ k: k, n: '', lb: '' }); indivPhonesRender(); }
function indivPhonesCollect() { return _indivPhones.filter(function (p) { return p.n && p.n.trim(); }); }

function custKindToggle() {
  var kind = (document.getElementById('nC2Kind') || { value: 'حقوقی' }).value;
  var isCorp = kind === 'حقوقی';
  var natF = document.getElementById('natIdFld');
  var melF = document.getElementById('melliFld');
  var corpWrap = document.getElementById('corpOnlyWrap');
  if (natF) natF.style.display = isCorp ? '' : 'none';
  if (melF) melF.style.display = isCorp ? 'none' : '';
  if (corpWrap) corpWrap.style.display = isCorp ? '' : 'none';
  var phBox = document.getElementById('indivPhBox');
  if (phBox) { phBox.style.display = isCorp ? 'none' : ''; if (!isCorp) indivPhonesRender(); }
  var telInp = document.getElementById('nC2Tel');
  if (telInp && telInp.closest) {
    var telFld = telInp.closest('.fld');
    if (telFld) telFld.style.display = isCorp ? '' : 'none';
  }
}

/* v34.36.5 (CUST-RFQ-ORPHAN): کد مشتری تازه باید محلاً یکتا باشد — همان گارد v34.9.2 در saveCust.
   بدون این، genCode تکراری دو رکورد با یک cd می‌سازد؛ nextByCd آخری را نگه می‌دارد و مشتری
   جدید در سینک گم می‌شود در حالی که نامش به‌صورت snapshot روی درخواست می‌ماند.
   v34.37.0 (CODE-RETIRED): «یکتا در فهرست زنده» کافی نبود — کدِ مشتریِ حذف‌شده هم باید
   مصرف‌شده حساب شود، وگرنه سنگ‌قبرِ دائمیِ آن کد مشتری تازه را در اولین سینک پاک می‌کند. */
window.ptfAllocCustCode = function (items) {
  var list = items || [];
  var retired = (typeof window.ptfCodeIsRetired === 'function')
    ? function (c) { return window.ptfCodeIsRetired(c, 'ptf_crm_customers'); }
    : function () { return false; };
  var taken = function (c) {
    return list.some(function (x) { return x && String(x.cd) === String(c); }) || retired(c);
  };
  var cd = (typeof genCode === 'function') ? genCode('CUST') : ('CUST-' + Date.now());
  var n = 0;
  while (taken(cd) && n < 8) {
    cd = (typeof genCode === 'function') ? genCode('CUST') : (cd + '-' + Date.now().toString(36));
    n++;
  }
  if (taken(cd)) cd = cd + '-' + Date.now().toString(36);
  return cd;
};

function saveCust2(cd) {
  var comp = document.getElementById('nC2Comp').value.trim();
  if (!comp) { (window.ptfDlgAlert || alert)('نام شرکت را وارد کنید', { icon: '⚠️', title: 'اعتبارسنجی فرم' }); return; } /* v16.4 US-372 */
  var people = cbCollect();
  var items = getData('ptf_crm_customers');
  var tel = document.getElementById('nC2Tel').value.trim();
  var oldRecPre = null;
  if (cd) {
    for (var oiC = 0; oiC < items.length; oiC++) if (items[oiC] && items[oiC].cd === cd) { oldRecPre = items[oiC]; break; }
  }
  var rec = {
    cd: cd || (typeof window.ptfAllocCustCode === 'function' ? window.ptfAllocCustCode(items) : genCode('CUST')), co: comp,
    coEn: (document.getElementById('nC2CoEn')||{value:''}).value.trim(),
    creditLimit: (typeof ptfNum === 'function' ? ptfNum((document.getElementById('nC2Credit')||{value:''}).value) : +((document.getElementById('nC2Credit')||{value:''}).value)) || 0, /* v14.6 US-352 + v19.6 کامادار */
    kind: (document.getElementById('nC2Kind')||{value:'حقوقی'}).value,
    venSt: (document.getElementById('nC2VenSt')||{value:'unreg'}).value, // v121.1: US-109
    venNo: ((document.getElementById('nC2VenNo')||{value:''}).value || '').trim(),
    natId: (document.getElementById('nC2NatId')||{value:''}).value.trim(),
    melli: (document.getElementById('nC2Melli')||{value:''}).value.trim(),
    ind: document.getElementById('nC2Ind').value,
    people: people,
    coTels: ptfMergeExtraCoTels(oldRecPre, tel),
    coWeb: document.getElementById('nC2Web').value.trim(),
    coAddr: document.getElementById('nC2Addr').value.trim()
  };
  /* v21.5 US-411ف1: owner — پیش‌فرض سازنده؛ تغییر فقط اگر فیلد nC2Owner هست (ارشد) */
  try {
    var ownEl = document.getElementById('nC2Owner');
    var prev = null;
    if (cd) {
      var oldC = items.filter(function (x) { return x.cd === cd; })[0];
      if (oldC) prev = oldC.owner || oldC.crBy || '';
    }
    if (ownEl) {
      rec.owner = (ownEl.value || '').trim();
      if (prev && rec.owner && prev !== rec.owner && typeof audit === 'function') {
        audit('مشتریان', 'تغییر مالک مشتری ' + comp + ': ' + prev + ' → ' + rec.owner, rec.cd);
      }
    } else if (cd) {
      rec.owner = prev || '';
    } else {
      rec.owner = (typeof curSession === 'function' && curSession()) ? (curSession().user || '') : '';
    }
    if (!rec.owner && !cd) {
      rec.owner = (typeof curSession === 'function' && curSession()) ? (curSession().user || '') : '';
    }
  } catch (eOwn) {}
  // v80.2: حقیقی → تلفن‌های خود شخص
  if (rec.kind === 'حقیقی') {
    rec.phones = indivPhonesCollect();
    rec.people = [];
    rec.coTels = [];
    rec.con = rec.co;
    var mob0 = rec.phones.filter(function (p) { return p.k === 'mob'; })[0];
    rec.ph = mob0 ? mob0.n : (rec.phones[0] ? rec.phones[0].n : '');
  } else {
    /* v34.37.7: phones[] را خالی نفرست — merge سرور کلید حاضر را بازنویسی می‌کند
       و شماره‌های وارداتی/قدیمی حقوقی پاک می‌شد. */
    var pp = primaryPerson(rec);
    rec.con = pp ? pp.nm : '';
    rec.ph = pp && pp.tels && pp.tels.length ? pp.tels[0].n : (pp && pp.mobs && pp.mobs.length ? pp.mobs[0].n : tel);
  }
  // US-174: جلوگیری از ثبت تکراری (نام/شناسه ملی/کد ملی/هر شماره تماس)
  if (typeof ptfDupBlock === 'function' && ptfDupBlock('customer', rec, cd)) return;
  if (cd) {
    for (var i = 0; i < items.length; i++) if (items[i].cd === cd) {
      /* v34.29.7 (SITE-PARITY): فیلدهایی که فرم ویرایش مدیریت نمی‌کند (files/پیوست
         ابری، src، srcSite، ds، approvedBy/At، پیام فرم سایت، مهرهای dedup و…)
         از رکورد قبلی حفظ می‌شوند — همان merge semantics سرور. قبلاً بازسازی کامل
         rec این‌ها را بی‌صدا پاک می‌کرد و مثلاً مشتریِ درخواست‌دهندهٔ سایت پس از یک
         ویرایش، ردّپای خود را از دست می‌داد. */
      var oldC2 = items[i];
      for (var ok2 in oldC2) {
        if (Object.prototype.hasOwnProperty.call(oldC2, ok2) && !(ok2 in rec)) rec[ok2] = oldC2[ok2];
      }
      rec.crAt = items[i].crAt; rec.crBy = items[i].crBy;
      if (!document.getElementById('nC2Owner')) rec.owner = items[i].owner || items[i].crBy || rec.owner || '';
      /* v14.6: اگر فیلد سقف اعتبار برای این نقش نمایش داده نشده، مقدار قبلی حفظ شود */
      if (!document.getElementById('nC2Credit')) rec.creditLimit = items[i].creditLimit || 0;
      /* v34.29.7: رکورد قدیمیِ سایت بدون اشخاص رابط — ph/con اسکالر نباید در اولین
         ویرایش پاک شود (فرم چیزی برای ویرایشش نشان نمی‌داد). اگر شخص/کانالی هست،
         مقدار مشتق‌شده از فرم معتبر است. */
      if (!rec.ph && !(rec.coTels || []).length && !primaryPerson(rec) && oldC2.ph) rec.ph = oldC2.ph;
      if (!rec.con && !primaryPerson(rec) && oldC2.con) rec.con = oldC2.con;
      items[i] = rec;
    }
  } else { if (typeof dedupStamp === 'function') dedupStamp(rec); items.unshift(rec); }
  /* v34.8.22 (W1): ثبت/ویرایش مشتری از پیشنهاد با فرمان اتمیک سروری. */
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', items, { reason: 'offer-cust' });
  else setData('ptf_crm_customers', items);
  window._ptfLastSavedCustCd = rec.cd;
  hideModal(); renderCustomers();
  addLog('کارفرما ' + comp + (cd ? ' ویرایش' : ' ثبت') + ' شد');
}

function showSupModal2(cd) {
  var c = null;
  if (cd) c = getData('ptf_crm_suppliers').filter(function(x){ return x.cd === cd; })[0];
  cbInit(c ? c.people : []);
  indivPhonesInit(c ? c.phones : []);
  var CATS = ['پایپینگ','شیرآلات','برق','ابزار دقیق','پمپ','سایر'];
  var catOpts = CATS.map(function(x){ return '<option' + (c && c.ca === x ? ' selected' : '') + '>' + x + '</option>'; }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:640px;max-height:92vh;overflow:auto">' +
    '<h3>' + (c ? '✏️ ویرایش تامین‌کننده' : '🏭 تامین‌کننده جدید') + '</h3>' +
    '<div class="fr"><div class="fld"><label>نام شرکت / شخص (فارسی) *</label><input type="text" id="nS2Comp" value="' + (c ? escP(c.co) : '') + '"></div>' +
    '<div class="fld"><label>نام انگلیسی</label><input type="text" id="nS2CoEn" value="' + (c ? escP(c.coEn||'') : '') + '" style="direction:ltr"></div></div>' +
    '<div class="fr"><div class="fld"><label>نوع تامین‌کننده *</label><select id="nS2Kind" onchange="supKindToggle()">' +
      '<option value="حقوقی"' + (!c || c.kind !== 'حقیقی' ? ' selected' : '') + '>🏢 حقوقی (شرکت / فروشگاه)</option>' +
      '<option value="حقیقی"' + (c && c.kind === 'حقیقی' ? ' selected' : '') + '>👤 حقیقی (شخص)</option></select></div>' +
    '<div class="fld"><label>دسته</label><select id="nS2Cat">' + catOpts + '</select></div></div>' +
    '<div class="fr"><div class="fld" id="supNatIdFld"><label>شناسه ملی (حقوقی)</label><input type="text" id="nS2NatId" value="' + (c ? escP(c.natId || '') : '') + '" placeholder="14010077558" style="direction:ltr" maxlength="11"></div>' +
    '<div class="fld" id="supMelliFld" style="display:none"><label>کد ملی (حقیقی)</label><input type="text" id="nS2Melli" value="' + (c ? escP(c.melli || '') : '') + '" placeholder="0012345678" style="direction:ltr" maxlength="10"></div></div>' + indivPhonesHtml('supIndivPhBox') +
    '<div class="fr"><div class="fld" id="supTelFld"><label>تلفنخانه شرکت</label><input type="text" id="nS2Tel" value="' + (c && (c.coTels||[])[0] ? escP(c.coTels[0].n) : '') + '" style="direction:ltr"></div>' +
    '<div class="fld"><label>وب‌سایت / ایمیل عمومی</label><input type="text" id="nS2Web" value="' + (c ? escP(c.coWeb || '') : '') + '" style="direction:ltr"></div></div>' +
    '<div id="supCorpWrap"><h4 style="margin:12px 0 8px">👥 اشخاص رابط</h4><div id="cbWrap"></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
    '<button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveSup2(' + (c ? "'" + escP(c.cd) + "'" : 'null') + ')">' + (c ? 'ذخیره' : 'ثبت') + '</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  cbRender();
  supKindToggle();
}

// US-168 توسعه: نمایش داینامیک فیلدهای تامین‌کننده بر اساس حقیقی/حقوقی
function supKindToggle() {
  var kind = (document.getElementById('nS2Kind') || { value: 'حقوقی' }).value;
  var isCorp = kind === 'حقوقی';
  var natF = document.getElementById('supNatIdFld');
  var melF = document.getElementById('supMelliFld');
  var corpWrap = document.getElementById('supCorpWrap');
  var telF = document.getElementById('supTelFld');
  if (natF) natF.style.display = isCorp ? '' : 'none';
  if (melF) melF.style.display = isCorp ? 'none' : '';
  if (corpWrap) corpWrap.style.display = isCorp ? '' : 'none';
  if (telF) telF.style.display = isCorp ? '' : 'none';
  var phBoxS = document.getElementById('supIndivPhBox');
  if (phBoxS) { phBoxS.style.display = isCorp ? 'none' : ''; if (!isCorp) indivPhonesRender(); }
}

function saveSup2(cd) {
  var comp = document.getElementById('nS2Comp').value.trim();
  var compEn = (document.getElementById('nS2CoEn')||{value:''}).value.trim();
  /* v17.5 (US-415 — گزارش کارفرما): تامین‌کننده خارجی نام فارسی ندارد —
     خارجی: نام انگلیسی اجباری، فارسی اختیاری؛ co = EN تا نمایش/جستجو/dedup سالم بماند. داخلی مثل قبل. */
  var isForeign = ((document.getElementById('nS2Origin') || {}).value || 'داخلی') === 'خارجی';
  if (isForeign) {
    if (!compEn) { (window.ptfDlgAlert || alert)('برای تامین‌کننده خارجی، نام انگلیسی (English Name) الزامی است', { icon: '🌍', title: 'اعتبارسنجی فرم' }); return; }
    if (!comp) comp = compEn; /* co = نام EN — فارسی اختیاری */
  } else if (!comp) { (window.ptfDlgAlert || alert)('نام شرکت را وارد کنید', { icon: '⚠️', title: 'اعتبارسنجی فرم' }); return; } /* v16.4 US-372 */
  var people = cbCollect();
  var items = getData('ptf_crm_suppliers');
  var tel = document.getElementById('nS2Tel').value.trim();
  var oldSupPre = null;
  if (cd) {
    for (var oiS = 0; oiS < items.length; oiS++) if (items[oiS] && items[oiS].cd === cd) { oldSupPre = items[oiS]; break; }
  }
  var rec = {
    cd: cd || genCode('SUP'), co: comp,
    coEn: compEn,
    kind: (document.getElementById('nS2Kind')||{value:'حقوقی'}).value,
    natId: (document.getElementById('nS2NatId')||{value:''}).value.trim(),
    melli: (document.getElementById('nS2Melli')||{value:''}).value.trim(),
    ca: document.getElementById('nS2Cat').value,
    people: people,
    coTels: ptfMergeExtraCoTels(oldSupPre, tel),
    coWeb: document.getElementById('nS2Web').value.trim()
  };
  // v80.2: حقیقی → تلفن‌های خود شخص
  if (rec.kind === 'حقیقی') {
    rec.phones = indivPhonesCollect();
    rec.people = [];
    rec.coTels = [];
    rec.nm = rec.co;
    var mob0s = rec.phones.filter(function (p) { return p.k === 'mob'; })[0];
    rec.ph = mob0s ? mob0s.n : (rec.phones[0] ? rec.phones[0].n : '');
  } else {
    /* v34.37.7: phones[] را خالی نفرست — merge سرور کلید حاضر را بازنویسی می‌کند
       و شماره‌های وارداتی/قدیمی حقوقی پاک می‌شد. */
    var pp = primaryPerson(rec);
    rec.nm = pp ? pp.nm : '';
    rec.ph = pp && pp.tels && pp.tels.length ? pp.tels[0].n : (pp && pp.mobs && pp.mobs.length ? pp.mobs[0].n : tel);
  }
  // US-174: جلوگیری از ثبت تکراری (نام/شناسه ملی/کد ملی/هر شماره تماس)
  if (typeof ptfDupBlock === 'function' && ptfDupBlock('supplier', rec, cd)) return;
  if (cd) {
    for (var i = 0; i < items.length; i++) if (items[i].cd === cd) {
      /* v34.29.7 (SITE-PARITY): حفظ فیلدهای خارج از فرم (files، src، srcSite،
         payTerms/creditRange/payScore، پیام و یادداشت تایید و…) — merge مثل سرور. */
      var oldS2 = items[i];
      for (var okS2 in oldS2) {
        if (Object.prototype.hasOwnProperty.call(oldS2, okS2) && !(okS2 in rec)) rec[okS2] = oldS2[okS2];
      }
      rec.crAt = items[i].crAt; rec.crBy = items[i].crBy; items[i] = rec;
      /* v34.29.7: مثل مشتری — رکورد قدیمیِ سایت بدون people، nm/ph اسکالر را در
         اولین ویرایش از دست نمی‌دهد. */
      if (!rec.nm && oldS2.nm) rec.nm = oldS2.nm;
      if (!rec.ph && !(rec.coTels || []).length && !primaryPerson(rec) && oldS2.ph) rec.ph = oldS2.ph;
    }
  } else { if (typeof dedupStamp === 'function') dedupStamp(rec); items.unshift(rec); }
  /* v34.8.22 (W1): ثبت/ویرایش تامین‌کننده از پیشنهاد با فرمان اتمیک سروری. */
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_suppliers', items, { reason: 'offer-sup' });
  else setData('ptf_crm_suppliers', items);
  window._supLastSaved = rec.cd; /* v19.0 (پورت BUG-022 از v17.8): فلگ موفقیت — wrapper ها فقط روی همین رکورد */
  window._ptfLastSavedSupCd = rec.cd;
  hideModal(); renderSuppliers();
  addLog('تامین‌کننده ' + comp + (cd ? ' ویرایش' : ' ثبت') + ' شد');
}

/* v34.36.5 (CUST-RFQ-ORPHAN): اگر درخواستی custCd دارد ولی رکورد مشتری نیست
   (برخورد expectCreate / pull بعد از silent-write / مهاجرت ناقص)، stub را از
   snapshot نام درخواست بازسازی کن. صندوق بازیافت را دست نمی‌زند. هر کد در هر جلسه یک‌بار. */
window.ptfHealMissingCustomersFromRfqs = function () {
  var tried = window._ptfCustHealTried = window._ptfCustHealTried || {};
  var custs = [];
  try { custs = (typeof getData === 'function' ? getData('ptf_crm_customers') : []) || []; } catch (eG) { return 0; }
  var byCd = {};
  custs.forEach(function (c) { if (c && c.cd) byCd[String(c.cd)] = c; });
  var recycled = {};
  try {
    ((typeof getData === 'function' ? getData('ptf_crm_deleted_archive') : []) || []).forEach(function (a) {
      if (a && a.kind === 'recycle' && a.collection === 'ptf_crm_customers' && !a.restoredAt) {
        /* v34.37.0 (ARCH-A3): کلید تهی هرگز وارد نقشه نشود — وگرنه هر مشتریِ بدون cd
           «در سطل بازیافت» فرض می‌شد و heal آن را نادیده می‌گرفت. */
        var rid = String(a.id || a.cd || '').trim();
        if (rid) recycled[rid] = 1;
      }
    });
  } catch (eA) {}
  var rfqs = [];
  try { rfqs = (typeof getData === 'function' ? getData('ptf_crm_rfqs') : []) || []; } catch (eR) { return 0; }
  var added = 0;
  rfqs.forEach(function (r) {
    if (!r) return;
    var cd = String(r.custCd || '').trim();
    if (!cd || byCd[cd] || recycled[cd] || tried[cd]) return;
    tried[cd] = 1;
    var stub = {
      cd: cd,
      co: String(r.co || '').trim() || cd,
      kind: 'حقوقی',
      venSt: 'unreg',
      people: [],
      con: r.con || '',
      ph: r.ph || '',
      ds: 'بازسازی از درخواست ' + (r.cd || ''),
      healedFromRfq: r.cd || '',
      owner: r.crBy || r.owner || ''
    };
    if (r.con) {
      stub.people = [{ nm: r.con, role: 'رابط', primary: true, tels: [], mobs: r.ph ? [{ n: r.ph, lb: '' }] : [] }];
    }
    if (typeof dedupStamp === 'function') dedupStamp(stub);
    if (r.crBy) stub.crBy = r.crBy;
    if (!stub.owner) stub.owner = stub.crBy || '';
    custs.unshift(stub);
    byCd[cd] = stub;
    added++;
  });
  if (!added) return 0;
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custs, { reason: 'rfq-cust-heal', allowDelete: false });
  else setData('ptf_crm_customers', custs);
  try { if (typeof audit === 'function') audit('مشتریان', 'بازسازی ' + added + ' مشتری گم‌شده از روی درخواست', 'heal'); } catch (eAu) {}
  return added;
};

// رندر جدید جدول‌ها با ستون اشخاص + دکمه ویرایش/نمایش
function renderCustomers2() {
  migrateContacts();
  try { if (typeof window.ptfHealMissingCustomersFromRfqs === 'function') window.ptfHealMissingCustomersFromRfqs(); } catch (eHeal) {}
  var items = getData('ptf_crm_customers');
  var tb = document.getElementById('cTb');
  if (!tb) return;
  var q = ((document.getElementById('cSrch')||{}).value || '').trim();
  var list = q ? items.filter(function(e){ return entityMatches(e, q); }) : items;
  var h = '';
  list.forEach(function(c) {
    var pp = primaryPerson(c);
    // v121.1: بج وندور (US-109 v120) — در override گم شده بود
    var venBadge = (typeof ptfVendorStatusBadge === 'function') ? ptfVendorStatusBadge(c) : '';
    var own = c.owner || c.crBy || '';
    var ownLb = own;
    try {
      if (own) {
        var uo = (getData('ptf_crm_users')||[]).filter(function(x){return (x.username||x.user)===own;})[0];
        if (uo) ownLb = uo.name || uo.nm || own;
      }
    } catch (eOw) {}
    h += '<tr data-cust-cd="' + escP(c.cd) + '"><td><strong>' + escP(c.cd) + '</strong>' + venBadge +
      (own ? '<div style="font-size:10.5px;color:#64748b;margin-top:2px">👤 ' + escP(ownLb) + '</div>' : '') +
      '</td><td>' + escP(c.co) +
      ' <span style="background:' + (c.kind === 'حقیقی' ? '#fef3c7;color:#b45309' : '#e0e7ff;color:#4338ca') + ';border-radius:8px;padding:1px 7px;font-size:10.5px">' + escP(c.kind || 'حقوقی') + '</span></td><td>' + escP(c.ind||'-') + '</td>' +
      '<td>' + (pp ? escP(pp.nm) + ' <small style="color:#94a3b8">(' + escP(pp.role||'') + ')</small>' : '-') +
      ((c.people||[]).length > 1 ? ' <span style="background:#f1f5f9;border-radius:8px;padding:1px 7px;font-size:11px">+' + (c.people.length - 1) + '</span>' : '') + '</td>' +
      '<td>' + ((c.phones||[]).length ? '<a href="tel:' + escP(c.phones[0].n) + '" style="direction:ltr">' + escP(c.phones[0].n) + '</a>' + (c.phones.length > 1 ? ' <small style="color:#94a3b8">+' + (c.phones.length - 1) + '</small>' : '') : (pp && pp.tels && pp.tels.length ? '<a href="' + telHref(pp.tels[0]) + '">' + escP(fmtTel(pp.tels[0])) + '</a>' : escP(c.ph||'-'))) + '</td>' +
      '<td><button class="bt bt-o entity-row-action" data-entity-action="view" style="padding:4px 9px;font-size:12px" title="مشاهده مشتری" aria-label="مشاهده مشتری" onclick="showEntityCard(\'ptf_crm_customers\',\'' + ptfOnClickArg(c.cd) + '\')">👁️</button> ' +
      '<button class="bt bt-o entity-row-action" data-entity-action="edit" style="padding:4px 9px;font-size:12px" title="ویرایش مشتری" aria-label="ویرایش مشتری" onclick="showCustModal(\'' + ptfOnClickArg(c.cd) + '\')">✏️</button></td></tr>';
  });
  tb.innerHTML = h || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:22px">مشتری‌ای ثبت نشده</td></tr>';
  if (document.getElementById('dCust')) document.getElementById('dCust').textContent = items.length;
}

function renderSuppliers2() {
  migrateContacts();
  var items = getData('ptf_crm_suppliers');
  var tb = document.getElementById('sTb');
  if (!tb) return;
  var q = ((document.getElementById('sSrch')||{}).value || '').trim();
  var list = q ? items.filter(function(e){ return entityMatches(e, q); }) : items;
  /* v34.7.91 (SUP-PERF-002): صفحه‌بندی فهرست تاییدشده — ۵۰ رکورد در هر گام.
     در مقیاس صدها/هزاران تامین‌کننده، رندر همزمان همه‌ی ردیف‌ها باعث کندی باز شدن
     پنل و جستجو می‌شد. جستجو/تب‌ها/داده بدون تغییر می‌مانند؛ فقط دید ردیف‌ها گام‌به‌گام
     می‌شود. */
  var per = 50;
  if (q !== (window._supApprovedSearchQ || '')) {
    window._supApprovedPage = 0;
    window._supApprovedSearchQ = q;
  }
  var page = window._supApprovedPage || 0;
  if (page > 0 && page * per >= list.length) page = Math.max(0, Math.ceil(list.length / per) - 1);
  window._supApprovedPage = page;
  var shown = list.slice(0, (page + 1) * per);
  var h = '';
  shown.forEach(function(c) {
    var pp = primaryPerson(c);
    var nFiles = ptfEntityFiles(c).length;
    var fileBtn = nFiles
      ? '<button class="bt bt-o entity-row-action" style="padding:4px 9px;font-size:12px;color:#6d28d9;border-color:#ddd6fe" title="فایل‌های پیوست (' + nFiles + ')" aria-label="فایل‌های پیوست" onclick="ptfSupFilesOpen(\'' + ptfOnClickArg(c.cd) + '\')">📎' + nFiles + '</button> '
      : '';
    h += '<tr><td><strong>' + escP(c.cd) + '</strong></td><td>' + escP(c.co) +
      ' <span style="background:' + (c.kind === 'حقیقی' ? '#fef3c7;color:#b45309' : '#e0e7ff;color:#4338ca') + ';border-radius:8px;padding:1px 7px;font-size:10.5px">' + escP(c.kind || 'حقوقی') + '</span>' +
      ((c.payTerms && typeof window.ptfSupPayBadge === 'function') ? ' ' + window.ptfSupPayBadge(c) : '') + '</td>' +
      '<td>' + (pp ? escP(pp.nm) : '-') + ((c.people||[]).length > 1 ? ' <span style="background:#f1f5f9;border-radius:8px;padding:1px 7px;font-size:11px">+' + (c.people.length - 1) + '</span>' : '') + '</td>' +
      '<td>' + (pp && pp.tels && pp.tels.length ? '<a href="' + telHref(pp.tels[0]) + '">' + escP(fmtTel(pp.tels[0])) + '</a>' : escP(c.ph||'-')) + '</td>' +
      '<td>' + escP(c.ca||'-') + '</td>' +
      '<td>' + fileBtn + '<button class="bt bt-o entity-row-action" data-entity-action="view" style="padding:4px 9px;font-size:12px" title="مشاهده تأمین‌کننده" aria-label="مشاهده تأمین‌کننده" onclick="showEntityCard(\'ptf_crm_suppliers\',\'' + ptfOnClickArg(c.cd) + '\')">👁️</button> ' +
      '<button class="bt bt-o entity-row-action" data-entity-action="edit" style="padding:4px 9px;font-size:12px" title="ویرایش تأمین‌کننده" aria-label="ویرایش تأمین‌کننده" onclick="showSupModal2(\'' + ptfOnClickArg(c.cd) + '\')">✏️</button></td></tr>';
  });
  if (list.length > shown.length) {
    h += '<tr><td colspan="6" style="text-align:center;padding:10px;background:#fffbeb">' +
      '<button class="bt bt-o" style="font-size:12px;color:#b45309;border-color:#fde68a" onclick="ptfSupApprovedMore()">⬇ نمایش ' +
      Math.min(per, list.length - shown.length) + ' مورد دیگر (' + shown.length + ' از ' + list.length + ')</button></td></tr>';
  }
  tb.innerHTML = h || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:22px">تامین‌کننده‌ای ثبت نشده</td></tr>';
  if (document.getElementById('dSup')) document.getElementById('dSup').textContent = items.length;
}
window.ptfSupApprovedMore = function () {
  window._supApprovedPage = (window._supApprovedPage || 0) + 1;
  if (typeof renderSuppliers2 === 'function') renderSuppliers2();
};

/* ===== v34.7.69: نمایش فایل‌های پیوست تامین‌کننده/مشتری (ثبت‌نام سایت یا دستی) ===== */
function ptfEntityFiles(c) {
  if (!c) return [];
  var out = [], seen = {};
  function add(f) {
    if (!f) return;
    if (Array.isArray(f)) { f.forEach(add); return; }
    if (typeof f === 'string') {
      if (f.charAt(0) === '[' || f.charAt(0) === '{') { try { add(JSON.parse(f)); } catch (e) {} return; }
      f = /^(data:|blob:|https?:\/\/)/i.test(f) ? { url: f, name: f.split('/').pop() || 'پیوست' } : { key: f, name: f.split('/').pop() || 'پیوست' };
    }
    if (!f || typeof f !== 'object') return;
    var key = (typeof ptfFileStorageKey === 'function') ? ptfFileStorageKey(f) : (f.key || f.objectKey || f.path || '');
    var url = f.url || f.src || f.dataUrl || '';
    var name = f.name || f.fileName || f.filename || f.originalName || (key ? String(key).split('/').pop() : 'فایل');
    if (!key && !url) return;
    var id = key || url;
    if (seen[id]) return;
    seen[id] = true;
    out.push({ key: key, url: url, name: name, size: +f.size || 0 });
  }
  var files = c.files;
  if (Array.isArray(files)) add(files);
  else if (files && typeof files === 'object') Object.keys(files).forEach(function (k) { add(files[k]); });
  return out;
}

window.ptfSupFilesOpen = function (cd) {
  /* v34.7.94 (A7-FIX): بازخورد صریح در شکست — نگهبان A7 (شکست خاموش) دیگر
     تخلف نمی‌شمارد و کاربر می‌فهمد چرا پنجره باز نشد. */
  var c = getData('ptf_crm_suppliers').filter(function (x) { return x.cd === cd; })[0];
  if (!c) {
    if (typeof ptfToast === 'function') ptfToast('❌ تامین‌کننده با این کد پیدا نشد', 'err');
    else if (typeof alert === 'function') alert('تامین‌کننده با این کد پیدا نشد');
    return;
  }
  var files = ptfEntityFiles(c);
  var rows = files.length ? files.map(function (f) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px dashed var(--brd);flex-wrap:wrap">' +
      '<span style="font-size:12.5px">📎 ' + escP(f.name) + (f.size ? ' <small style="color:#94a3b8">(' + (+f.size).toLocaleString('fa-IR') + ' بایت)</small>' : '') + '</span>' +
      '<button class="bt bt-o" style="padding:4px 10px;font-size:11.5px" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\',\'' + ptfOnClickArg(f.name) + '\')">👁 مشاهده / دانلود</button></div>';
  }).join('') : '<div style="color:#94a3b8;padding:10px 0">فایلی ثبت نشده است.</div>';
  var html = '<div class="md-b" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:88vh;overflow:auto">' +
    '<h3>📎 فایل‌های تامین‌کننده — ' + escP(c.co || '') + '</h3>' + rows +
    '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
};

function showEntityCard(key, cd) {
  var c = getData(key).filter(function(x){ return x.cd === cd; })[0];
  if (!c) return;
  var venBox = '';
  if (key === 'ptf_crm_customers') {
    var stMap = { unreg: '⚪ ثبت‌نشده / بدون اقدام', prep: '🟠 در حال تکمیل مدارک ارزیابی', sent: '📤 مدارک ارزیابی ارسال شد', eval: '⏳ در حال بررسی در کمیته فنی', pending: '⏳ در حال بررسی در کمیته فنی', approved: '🏆 عضو رسمی وندور لیست (AVL)', rejected: '🔴 ردشده / نیازمند رفع نقص' };
    var stLb = stMap[c.venSt || 'unreg'] || '⚪ ثبت‌نشده';
    var isOv = c.venDueISO && c.venDueISO < new Date().toISOString().slice(0, 10);
    venBox = '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-right:4px solid #7c3aed;border-radius:12px;padding:10px 14px;margin:10px 0;font-size:12.5px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<span><b style="color:#5b21b6">🏆 وضعیت عضویت PTF در وندور لیست (AVL):</b><br><span style="font-size:13px;font-weight:bold">' + stLb + '</span>' + (c.venNo ? ' | شماره وندور: <b dir="ltr" style="color:#059669">' + escP(c.venNo) + '</b>' : '') + '</span>' +
      '<button class="bt bt-o" style="padding:4px 10px;font-size:11.5px;color:#7c3aed;border-color:#ddd6fe" onclick="ptfCustVendorFollowup(\'' + ptfOnClickArg(c.cd) + '\')">📅 ثبت پیگیری و یادآور وندور</button></div>' +
      (c.venNote ? '<div style="margin-top:6px;font-size:11.5px;color:#475569">📝 آخرین اقدام: ' + escP(c.venNote) + '</div>' : '') +
      (c.venDueFa || c.venDueISO ? '<div style="margin-top:4px;font-size:11.5px;color:' + (isOv ? '#dc2626;font-weight:bold' : '#0e7490') + '">📅 سررسید پیگیری بعدی وندور: ' + escP(c.venDueFa || c.venDueISO) + (isOv ? ' (🔴 تاخیر در پیگیری — US-267)' : '') + '</div>' : '') +
      '</div>';
  }
  var entFiles = ptfEntityFiles(c);
  var filesBox = entFiles.length
    ? '<h4 style="margin:12px 0 8px">📎 فایل‌های پیوست</h4>' + entFiles.map(function (f) {
        return '<button class="bt bt-o" style="display:block;width:100%;margin-bottom:5px;font-size:12px;text-align:right;color:#6d28d9;border-color:#ddd6fe" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\',\'' + ptfOnClickArg(f.name) + '\')">📎 ' + escP(f.name) + (f.size ? ' <small style="color:#94a3b8">(' + (+f.size).toLocaleString('fa-IR') + ' بایت)</small>' : '') + '</button>';
      }).join('')
    : '';
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px;max-height:90vh;overflow:auto">' +
    '<h3>' + escP(c.co) + ' <small style="color:#94a3b8;font-size:12px">' + escP(c.cd) + '</small></h3>' + venBox +
    ((c.coTels||[]).length ? '<div style="font-size:13px;margin-bottom:4px">☎️ تلفنخانه: <a href="tel:' + escP(c.coTels[0].n) + '">' + escP(c.coTels[0].n) + '</a></div>' : '') +
    (c.coWeb ? '<div style="font-size:13px;margin-bottom:4px;direction:ltr;text-align:right">🌐 ' + escP(c.coWeb) + '</div>' : '') +
    (c.coAddr ? '<div style="font-size:13px;margin-bottom:10px">📍 ' + escP(c.coAddr) + '</div>' : '') +
    filesBox +
    ((c.phones||[]).length ? '<h4 style="margin:10px 0 8px">📞 تلفن‌های شخص</h4>' + c.phones.map(function(p){ return '<div style="font-size:13px;margin-bottom:4px">' + (p.k === 'mob' ? '📱' : '☎️') + ' <a href="tel:' + escP(p.n) + '" style="direction:ltr">' + escP(p.n) + '</a>' + (p.lb ? ' <small style="color:#94a3b8">(' + escP(p.lb) + ')</small>' : '') + '</div>'; }).join('') : '<h4 style="margin:10px 0 8px">👥 اشخاص رابط</h4>' + contactsCardHtml(c)) +
    '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="hideModal()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

// override رندرهای قدیمی + مهاجرت در لود
renderCustomers = renderCustomers2;
renderSuppliers = renderSuppliers2;
try { migrateContacts(); } catch (e) {}


/* ===== v14.4 (US-362 AC4): تولید نام انگلیسی شرکت با AI در فرم مشتری =====
   AI فعال → ترجمه دقیق llm؛ در غیر این صورت ترانویسی اصلاح‌شده US-360. */
window.ptfGenCoEn = function () {
  var fa = ((document.getElementById('nC2Comp') || {}).value || '').trim();
  var out = document.getElementById('nC2CoEn');
  if (!fa || !out) { alert('ابتدا نام فارسی شرکت را وارد کنید'); return; }
  var fallback = (typeof ptfCoToEn === 'function') ? ptfCoToEn(fa) : fa;
  out.value = fallback;
  if (typeof ptfLlmTranslate === 'function') {
    out.style.opacity = '.5';
    ptfLlmTranslate(fa, 'fa2en', function (d) {
      out.style.opacity = '1';
      if (d && d.ok && d.data && d.data.t) { out.value = d.data.t; if (typeof ptfToast === 'function') ptfToast('نام انگلیسی با AI تولید شد ✅', 'ok'); }
      else if (typeof ptfToast === 'function') ptfToast('AI در دسترس نبود — ترانویسی هوشمند درج شد', 'warn');
    });
  } else if (typeof ptfToast === 'function') ptfToast('ترانویسی هوشمند درج شد (AI فعال نیست)', 'ok');
};


window.ptfCustVendorFollowup = function (cd) {
  var custs = getData('ptf_crm_customers');
  var c = custs.filter(function (x) { return x.cd === cd; })[0];
  if (!c) return;
  ptfDialog({
    title: '🏆 پیگیری وضعیت عضویت در وندور لیست کارفرما (' + escP(c.co) + ')',
    body: 'وضعیت کنونی و اقدام انجام‌شده جهت حضور PTF در وندور لیست (AVL) این کارفرما را ثبت کنید. در صورت تعیین تاریخ سررسید، یادآور خودکار در کارتابل مسئول فروش ساخته می‌شود.',
    fields: [
      { id: 'venSt', label: 'مرحله وندور لیست *', type: 'select', value: c.venSt || 'unreg', options: [
        { v: 'unreg', lb: '⚪ ۱. ثبت‌نشده / بدون اقدام' }, { v: 'prep', lb: '🟠 ۲. در حال تکمیل اسناد ارزیابی و رزومه' },
        { v: 'sent', lb: '📤 ۳. رزومه و مدارک ارزیابی ارسال شد' }, { v: 'eval', lb: '⏳ ۴. در حال بررسی در کمیته فنی کارفرما' },
        { v: 'approved', lb: '🏆 ۵. تاییدشده / عضو رسمی وندور لیست (AVL)' }, { v: 'rejected', lb: '🔴 ۶. ردشده توسط کارفرما / نیازمند رفع نقص' }
      ]},
      { id: 'venNo', label: 'شماره وندور (در صورت تایید)', type: 'text', value: c.venNo || '', dir: 'ltr' },
      { id: 'venDue', label: 'تاریخ سررسید پیگیری بعدی (شمسی)', datePicker: true, value: c.venDueFa || c.venDueISO || '' },
      { id: 'venNote', label: 'شرح آخرین اقدام انجام‌شده *', type: 'text', value: c.venNote || '', placeholder: 'مثلا: اسناد ارزیابی مالی و فنی به کارشناس کمیته تحویل داده شد', required: true }
    ],
    okText: 'ثبت اقدام و یادآور',
    onOk: function (v) {
      c.venSt = v.venSt || 'unreg';
      c.venNo = (v.venNo || '').trim();
      c.venNote = (v.venNote || '').trim();
      var due = (v.venDue || '').trim();
      c.venDueFa = due;
      c.venDueISO = due ? (typeof ptfJToISO === 'function' ? ptfJToISO(due) : due) : '';
      
      // Auto-upsert into reminders (`ptf_crm_reminders`) for the customer's owner
      if (due && typeof chUpsertReminder === 'function') {
        try {
          var rems = getData('ptf_crm_reminders');
          var rem = { cd: genCode('REM'), title: '🏆 پیگیری وندور لیست کارفرما: ' + c.co, note: c.venNote, dueFa: due, dueISO: c.venDueISO, st: 'open', owner: c.owner || curSession().user || 'admin', t: faDateTime(), by: curSession().name };
          rems.unshift(rem);
          /* v34.8.27 (W4) */
          if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_reminders', rems, { reason: 'w4' });
          else setData('ptf_crm_reminders', rems);
        } catch (eRem) {}
      }
      /* v34.8.23 (W1-iterate): از مسیر فرمان اتمیک */
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custs, { reason: 'vendorlist' });
      else setData('ptf_crm_customers', custs);
      audit('مشتریان', 'ثبت پیگیری وندور لیست کارفرما ' + c.co + ' — مرحله: ' + c.venSt + ' (' + c.venNote + ')', cd);
      if (typeof ptfToast === 'function') ptfToast('🏆 وضعیت وندور لیست و یادآور کارتابل ثبت شد', 'ok');
      var md = document.querySelector('#panels .md-b:last-child');
      if (md && (md.style || {}).display !== 'none') md.remove();
      showEntityCard('ptf_crm_customers', cd);
      renderCustomers();
    }
  });
};

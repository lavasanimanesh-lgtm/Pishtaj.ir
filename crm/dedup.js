/* ============================================================
   PTF CRM — dedup.js — US-174 (اسپرینت ۸۱)
   سیستم جلوگیری از ثبت تکراری اطلاعات در همه ماژول‌ها
   - نرمال‌سازی فارسی/عربی/ارقام برای مقایسه دقیق
   - چک نام / شناسه ملی / کد ملی / شماره تماس قبل از ثبت
   - پیام خطا با ذکر رکورد قبلی + تاریخ ثبت + کاربر ثبت‌کننده
   استفاده: ptfDupBlock(kind, rec, excludeCd) → true یعنی تکراری است و ثبت نشود
   kinds: customer | supplier | lead | product | rfq | inqitem
   ============================================================ */

// نرمال‌سازی متن: ی/ک عربی → فارسی، ارقام فا/عربی → EN، حذف فاصله/نیم‌فاصله/علائم
function dedupNorm(s) {
  s = String(s == null ? '' : s);
  var fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩', out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i), fi = fa.indexOf(ch), ai = ar.indexOf(ch);
    if (fi > -1) ch = String(fi); else if (ai > -1) ch = String(ai);
    out += ch;
  }
  return out.replace(/[يئى]/g, 'ی').replace(/ك/g, 'ک').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
    .replace(/[\u200c\u200f\u200e\u064b-\u0652]/g, '')
    .replace(/[\s\-_.،,؛;()\/\\]/g, '').toLowerCase();
}

// نرمال‌سازی شماره تماس: فقط رقم؛ +98/0098 → 0
function dedupNormPhone(s) {
  var d = dedupNorm(s).replace(/\D/g, '');
  if (d.indexOf('0098') === 0) d = '0' + d.slice(4);
  else if (d.indexOf('98') === 0 && d.length === 12) d = '0' + d.slice(2);
  return d;
}

// همه شماره‌های یک رکورد (تلفن‌های شخص حقیقی، تلفنخانه، اشخاص رابط، tel/mob لید)
function dedupPhones(rec) {
  var out = [];
  function push(n) {
    var p = dedupNormPhone(n);
    if (p && p.length >= 7 && out.indexOf(p) < 0) out.push(p);
  }
  (rec.phones || []).forEach(function (x) { push(x.n); });
  (rec.coTels || []).forEach(function (x) { push(x.n); });
  if (rec.ph) push(rec.ph);
  if (rec.tel) push(rec.tel);
  if (rec.mob) push(rec.mob);
  (rec.people || []).forEach(function (p) {
    (p.tels || []).forEach(function (t) { push(t.n); });
    (p.mobs || []).forEach(function (m) { push(m.n); });
  });
  return out;
}

// «در تاریخ ... توسط کاربر ...» برای پیام خطا
function dedupWho(x) {
  var t = x.crAt || x.createdFa || x.t || x.dt || '';
  var by = x.crBy || '';
  var s = '';
  if (t) s += ' در تاریخ ' + t;
  if (by) s += ' توسط کاربر «' + by + '»';
  return s;
}

function dedupConflict(f, v, x, label) {
  return { f: f, v: v, cd: x.cd || '', name: x.co || x.nm || '', who: dedupWho(x), label: label };
}

// چک مشترک مشتری/تامین‌کننده: نام + شناسه ملی + کد ملی + هر شماره تماس
function dedupEntityConflicts(listKey, rec, excludeCd, label) {
  var out = [];
  var nm = dedupNorm(rec.co), nat = dedupNorm(rec.natId), mel = dedupNorm(rec.melli);
  var phs = dedupPhones(rec);
  getData(listKey).forEach(function (x) {
    if (excludeCd && x.cd === excludeCd) return;
    if (nm && dedupNorm(x.co) === nm) out.push(dedupConflict('نام «' + rec.co + '»', rec.co, x, label));
    if (nat && dedupNorm(x.natId || '') === nat) out.push(dedupConflict('شناسه ملی', rec.natId, x, label));
    if (mel && dedupNorm(x.melli || '') === mel) out.push(dedupConflict('کد ملی', rec.melli, x, label));
    var xp = dedupPhones(x);
    for (var i = 0; i < phs.length; i++)
      if (xp.indexOf(phs[i]) > -1) { out.push(dedupConflict('شماره تماس', phs[i], x, label)); break; }
  });
  return out;
}

// نقطه ورود اصلی: فهرست تعارض‌ها را برمی‌گرداند
function ptfCheckDup(kind, rec, excludeCd) {
  if (kind === 'customer') return dedupEntityConflicts('ptf_crm_customers', rec, excludeCd, 'مشتری');
  if (kind === 'supplier') return dedupEntityConflicts('ptf_crm_suppliers', rec, excludeCd, 'تامین‌کننده');
  if (kind === 'lead') {
    var outL = [], coL = dedupNorm(rec.co), phL = dedupPhones(rec);
    getData('ptf_crm_leads').forEach(function (x) {
      if (excludeCd && x.cd === excludeCd) return;
      if (coL && dedupNorm(x.co) === coL) outL.push(dedupConflict('نام شرکت', rec.co, x, 'لید'));
      var xp = dedupPhones(x);
      for (var i = 0; i < phL.length; i++)
        if (xp.indexOf(phL[i]) > -1) { outL.push(dedupConflict('شماره تماس', phL[i], x, 'لید')); break; }
    });
    return outL;
  }
  if (kind === 'product') {
    var outP = [], nmP = dedupNorm(rec.nm), enP = dedupNorm(rec.en);
    getData('ptf_crm_products').forEach(function (x) {
      if (excludeCd && x.cd === excludeCd) return;
      if (nmP && dedupNorm(x.nm) === nmP) outP.push(dedupConflict('شرح کالا', rec.nm, x, 'کالا'));
      else if (enP && dedupNorm(x.en || '') === enP) outP.push(dedupConflict('نام انگلیسی', rec.en, x, 'کالا'));
    });
    return outP;
  }
  if (kind === 'rfq') {
    var outR = [], sj = dedupNorm(rec.subj), inq = dedupNorm(rec.inqNo);
    getData('ptf_crm_rfqs').forEach(function (x) {
      if (excludeCd && x.cd === excludeCd) return;
      if (sj && rec.custCd && x.custCd === rec.custCd && dedupNorm(x.subj || '') === sj)
        outR.push(dedupConflict('موضوع درخواست', rec.subj, x, 'استعلام'));
      if (inq && dedupNorm(x.inqNo || '') === inq)
        outR.push(dedupConflict('شماره درخواست کارفرما', rec.inqNo, x, 'استعلام'));
    });
    return outR;
  }
  if (kind === 'inqitem') {
    var outI = [], nmI = dedupNorm(rec.nm);
    if (!nmI) return outI;
    getData('ptf_crm_inqitems').forEach(function (x) {
      if (x.inqNo === rec.inqNo && dedupNorm(x.nm) === nmI)
        outI.push(dedupConflict('قلم', rec.nm, x, 'درخواست ' + rec.inqNo));
    });
    return outI;
  }
  return [];
}

/* ===== v15.9 (US-389 — مصوبه تیم متخصص): نظام واحد دسته کالا =====
   ریشه باگ: PROD_CATS فارسی است ولی مسیرهای خودکار (AI/دستیار/استعلام‌خوان) tp انگلیسی
   (Electrical/Pipe/...) را مستقیم در ca می‌گذاشتند → فیلتر دسته فارسی آن‌ها را نمی‌دید.
   قاعده جدید: ca همیشه یکی از PROD_CATS فارسی؛ tp خام انگلیسی در فیلد جدا (p.tp) حفظ می‌شود. */
var PTF_CAT_MAP = {
  'pipe': 'پایپینگ',
  'elbow': 'فلنج و اتصالات', 'tee': 'فلنج و اتصالات', 'reducer': 'فلنج و اتصالات', 'cap': 'فلنج و اتصالات',
  'flange': 'فلنج و اتصالات', 'fitting': 'فلنج و اتصالات', 'gasket': 'فلنج و اتصالات', 'bolt & nut': 'فلنج و اتصالات',
  'valve': 'شیرآلات',
  'electrical': 'برق صنعتی', 'cable': 'برق صنعتی',
  'instrument': 'ابزار دقیق',
  'pump': 'پمپ و کمپرسور',
  'plate/sheet': 'سایر', 'beam/profile': 'سایر', 'strainer': 'سایر', 'hose': 'سایر', 'other': 'سایر',
  /* دسته‌های قدیمی راهنمای اکسل */
  'پایپینگ و شیرآلات': 'پایپینگ'
};
window.ptfNormCat = function (raw) {
  var v = String(raw == null ? '' : raw).trim();
  if (!v) return 'سایر';
  var FA_CATS = ['پایپینگ', 'فلنج و اتصالات', 'شیرآلات', 'برق صنعتی', 'ابزار دقیق', 'پمپ و کمپرسور', 'سایر'];
  if (FA_CATS.indexOf(v) > -1) return v; /* از قبل فارسی استاندارد */
  return PTF_CAT_MAP[v.toLowerCase()] || 'سایر';
};
/* جستجوی دوزبانه کالا: کوئری «برق» باید Electrical مهاجرت‌نشده/tp را هم بگیرد و برعکس */
var PTF_CAT_ALIASES = [
  ['پایپینگ', 'pipe', 'piping'],
  ['فلنج', 'اتصالات', 'flange', 'fitting', 'elbow', 'tee', 'gasket', 'گسکت', 'زانو', 'سه راه'],
  ['شیرآلات', 'شیر', 'valve', 'ولو'],
  ['برق', 'برق صنعتی', 'electrical', 'cable', 'کابل', 'الکتریکال'],
  ['ابزار دقیق', 'instrument', 'transmitter', 'gauge', 'ترانسمیتر', 'گیج'],
  ['پمپ', 'pump', 'کمپرسور', 'compressor'],
  ['لوله'], ['pipe']
];
window.ptfProdSearchBlob = function (p) {
  /* متن جستجوی هر کالا: همه فیلدها + مترادف‌های دوزبانه دسته/تایپ + نرمال‌سازی dedupNorm */
  var parts = [p.cd, p.nm, p.en, p.br, p.st, p.md, p.ca, p.tp, p.ds];
  var caN = String(p.ca || '').toLowerCase(), tpN = String(p.tp || '').toLowerCase();
  PTF_CAT_ALIASES.forEach(function (grp) {
    var hit = grp.some(function (w) { return caN.indexOf(w.toLowerCase()) > -1 || tpN.indexOf(w.toLowerCase()) > -1; });
    if (hit) parts = parts.concat(grp);
  });
  var raw = parts.join(' ');
  return (raw + ' ' + dedupNorm(raw)).toLowerCase();
};
window.ptfProdSearchMatch = function (p, q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return true;
  var blob = ptfProdSearchBlob(p);
  /* هم متن خام هم نرمال‌شده (ارقام فا/EN، فاصله/نیم‌فاصله) */
  return blob.indexOf(q) > -1 || blob.indexOf(dedupNorm(q)) > -1;
};

// ساخت پیام خطای کامل با مشخصات رکورد قبلی
function dedupMsg(conflicts) {
  var lines = conflicts.map(function (c) {
    return '• ' + c.f + (c.f.indexOf('«') < 0 ? ' «' + c.v + '»' : '') + ' قبلاً برای ' + c.label +
      (c.name ? ' «' + c.name + '»' : '') + (c.cd ? ' (' + c.cd + ')' : '') + c.who + ' ثبت شده است.';
  });
  return '⛔ امکان ثبت وجود ندارد — اطلاعات تکراری است:\n\n' + lines.join('\n') +
    '\n\nدر صورت نیاز، همان رکورد قبلی را جستجو و ویرایش کنید.';
}

// اگر تکراری بود پیام بده و true برگردان (= ثبت متوقف شود)
function ptfDupBlock(kind, rec, excludeCd) {
  var c = ptfCheckDup(kind, rec, excludeCd);
  if (!c.length) return false;
  if (typeof ptfToast === 'function' && false) ptfToast(dedupMsg(c));
  if (typeof ptfDlgAlert === 'function') ptfDlgAlert(dedupMsg(c), { icon: '♻️', title: 'جلوگیری از ثبت تکراری (US-174)' }); else alert(dedupMsg(c)); /* v16.4 US-372 */
  if (typeof audit === 'function') audit('ضد تکرار', 'جلوگیری از ثبت تکراری (' + kind + '): ' + (c[0].v || ''), c[0].cd || '');
  return true;
}

/* ============ US-175: شماره درخواست کارفرما فقط انتخابی در TO/CO ============ */
// فهرست شماره‌های درخواست معتبر: ثبت‌شده در استعلامات (inqNo یا کد استعلام) + درخواست‌های دارای اقلام ایمپورت‌شده
function ptfKnownInqList() {
  /* v31.7.27 US-INQ-ONE-OPTION (دستور کارفرما): هر درخواست فقط «یک» گزینه در کشویی —
     شناسه انتخاب = کد RFQ سیستم؛ شماره درخواست کارفرما فقط در لیبل نمایش داده می‌شود
     و هنگام چاپ پیشنهاد در Ref (Inquiry) می‌نشیند (ptfInqClientNo). */
  var seen = {}, list = [];
  function add(v, lb, co) { if (v && !seen[v]) { seen[v] = 1; list.push({ v: v, lb: lb, co: co || '' }); } }
  var _hasRfq = {};
  getData('ptf_crm_rfqs').forEach(function (r) {
    var sysCd = r.cd || r.inqNo; /* رکورد خیلی قدیمی بدون cd → همان inqNo */
    if (!sysCd) return;
    _hasRfq[sysCd] = 1; if (r.inqNo) _hasRfq[r.inqNo] = 1;
    add(sysCd, sysCd + (r.inqNo && r.inqNo !== sysCd ? ' ⇐ شماره کارفرما: ' + r.inqNo : '') + ' — ' + (r.co || ''), r.co);
  });
  getData('ptf_crm_inqitems').forEach(function (r) { if (r.inqNo && !_hasRfq[r.inqNo]) add(r.inqNo, r.inqNo + ' (اقلام ایمپورت‌شده)', ''); });
  return list;
}

/* v31.7.27 US-INQ-ONE-OPTION: شماره درخواست کارفرما برای چاپ —
   ورودی هر شناسه (cd سیستمی یا inqNo)، خروجی شماره کارفرما اگر ثبت شده؛ وگرنه همان ورودی. */
function ptfInqClientNo(v) {
  if (!v) return '';
  try {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === v || x.inqNo === v; })[0];
    if (r && r.inqNo) return r.inqNo;
  } catch (e) {}
  return v;
}
window.ptfInqClientNo = ptfInqClientNo;

// HTML گزینه‌های کشویی Inquiry No — مقدار فعلی سند قدیمی حفظ می‌شود (AC4)
function ptfInqNoOptions(cur) {
  var list = ptfKnownInqList();
  var has = list.some(function (o) { return o.v === cur; });
  if (cur && !has) list.unshift({ v: cur, lb: cur + ' (سند قدیمی)' });
  var h = '<option value="">— انتخاب شماره درخواست ثبت‌شده —</option>';
  list.forEach(function (o) {
    h += '<option value="' + escP(o.v) + '"' + (cur === o.v ? ' selected' : '') + '>' + escP(o.lb) + '</option>';
  });
  return h;
}

// آیا این شماره درخواست ثبت‌شده است؟
function ptfInqNoValid(v, legacy) {
  if (!v) return false;
  if (legacy && v === legacy) return true; // سند قدیمی
  if (ptfKnownInqList().some(function (o) { return o.v === v; })) return true;
  /* v31.7.27 US-INQ-ONE-OPTION: اسناد قدیمی با «شماره کارفرما» ذخیره شده‌اند؛
     هرچند دیگر گزینه کشویی نیست، همچنان معتبر است (وگرنه ویرایش سند قدیمی rfq استاب تکراری می‌ساخت) */
  try { return getData('ptf_crm_rfqs').some(function (r) { return r.inqNo === v || r.cd === v; }); } catch (e) { return false; }
}

// امضاکننده رکورد جدید: تاریخ + کاربر جاری (برای پیام‌های آینده)
function dedupStamp(rec) {
  try {
    rec.crAt = typeof faDateTime === 'function' ? faDateTime() : new Date().toLocaleDateString('fa-IR');
    rec.crBy = (typeof curSession === 'function' && curSession()) ? curSession().user : '';
  } catch (e) { rec.crAt = rec.crAt || ''; rec.crBy = rec.crBy || ''; }
  return rec;
}

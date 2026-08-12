/* =====================================================================
   PTF CRM — Sprint 64 — US-121
   اتوماسیون مکاتبات: نامه صادره/وارده + سربرگ + امضا + اندیکاتور
   فونت نامه: یاقوت (Yaghut) — فال‌بک وزیرمتن
   ===================================================================== */

var LETTER_FONT_FA = "'Geeza Pro','Baghdad','DecoType Naskh','B Yaghut','BYaghut','B Yagut','Yaghut','Yaqut','Amiri',Vazirmatn,Tahoma,serif"; /* v97: پشتیبانی کامل مک و ویندوز از فونت رسمی یاقوت و سریف */
var LETTER_FONT_EN = "'Segoe UI',Arial,Helvetica,sans-serif";

/* v87: نام انگلیسی امضاکننده (nameEn کاربر یا ترجما نام) */
function letSignerEn(l) {
  try {
    var users = getData('ptf_crm_users');
    var u = users.filter(function (x) { return x.username === l.signer; })[0];
    if (u && u.nameEn) return u.nameEn;
    var sp = (typeof sigProfiles === 'function' ? sigProfiles() : {})[l.signer] || {};
    if (sp.nmEn) return sp.nmEn;
  } catch (e) {}
  return l.signerNmEn || l.signerNm || '';
}

// US-210: سمت انگلیسی امضاکننده
function letRoleEn(l) {
  try {
    var users = getData('ptf_crm_users');
    var u = users.filter(function (x) { return x.username === l.signer; })[0];
    if (u && u.roleEn) return u.roleEn;
    var role = u ? u.role : (l.signerRole || '');
    if (role.indexOf('مدیر کل') > -1 || role.indexOf('مدیر ارشد') > -1 || role.indexOf('عامل') > -1) return 'Managing Director';
    if (role.indexOf('فروش') > -1) return 'Senior Sales Engineer';
    if (role.indexOf('بازرگانی') > -1) return 'Commercial Manager';
    if (role.indexOf('تامین') > -1) return 'Procurement Specialist';
  } catch (e) {}
  return l.signerRoleEn || 'Commercial Dept.';
}

/* ---------- شماره اندیکاتور (فقط پس از امضای نهایی) ----------
   v85.3: شماره‌گذاری فارسی بدون حروف انگلیسی (خواسته کارفرما):
   فارسی: {سال شمسی}/پ/{ص|و}/{سریال}  ← پ = پیشرو تجهیز فرتاک، ص = صادره، و = وارده
          نمایش روی سربرگ با ارقام فارسی: ۱۴۰۵/پ/ص/۰۰۰۸
   انگلیسی: سری میلادی مستقل PTF-OUT-2026-XXXX (لاتین)
   سریال فارسی ادامه سری قدیمی PTF-OUT-1405-XXXX است (شماره‌ای گم نمی‌شود) */
function letSerial(kind, lang) { // 'OUT' | 'IN'
  var ls = getData('ptf_crm_letters');
  var max = 0;
  if (lang === 'en') {
    var gy = String(new Date().getFullYear());
    ls.forEach(function (l) {
      var m = (l.no || '').match(new RegExp('^PTF-' + kind + '-' + gy + '-(\\d+)$'));
      if (m && +m[1] > max) max = +m[1];
    });
    return 'PTF-' + kind + '-' + gy + '-' + String(max + 1).padStart(4, '0');
  }
  // فارسی: فرمت جدید + ادامه سری قدیمی همان سال
  var yr = faYear();
  var k = kind === 'IN' ? 'و' : 'ص';
  ls.forEach(function (l) {
    var no = l.no || '';
    var m = no.match(new RegExp('^' + yr + '/پ/' + k + '/(\\d+)$')) ||
            no.match(new RegExp('^PTF-' + kind + '-' + yr + '-(\\d+)$'));
    if (m && +m[1] > max) max = +m[1];
  });
  return yr + '/پ/' + k + '/' + String(max + 1).padStart(4, '0');
}

// تبدیل ارقام لاتین به فارسی (برای نمایش اندیکاتور/تاریخ روی سربرگ فارسی)
function letFaDigits(s) {
  var fa = '۰۱۲۳۴۵۶۷۸۹';
  return String(s == null ? '' : s).replace(/\d/g, function (d) { return fa[+d]; });
}

/* ---------- فونت تطبیقی: عادی ۱۴ — حداقل ۱۲ ---------- */
function letAutoSize(text) {
  var n = (text || '').length;
  if (n <= 1500) return 14;
  if (n <= 2100) return 13.5;
  if (n <= 2700) return 13;
  if (n <= 3300) return 12.5;
  return 12; // هرگز کوچکتر از ۱۲ (AC کارفرما)
}

/* ---------- خلاصه‌سازی و کلیدواژه (AC6b — rule-based محلی) ---------- */
function letNorm(t) {
  return (t || '').replace(/[يی]/g, 'ی').replace(/[كک]/g, 'ک')
    .replace(/[۰-۹]/g, function (d) { return '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]; }).toLowerCase();
}
var LET_STOP = ['است','این','که','با','از','در','به','را','و','برای','یک','آن','های','می','شود','شد','خود','هم','تا','بر','یا','نامه','احترام','جناب','سرکار','شرکت','مورد','لطفا','لطفاً','باشد','گردد','مربوط','اعلام','بدینوسیله','the','and','for','with','this','that','from'];
function letExtract(subject, body) {
  var t = letNorm(subject + ' ' + body);
  var kws = {};
  // شماره‌های ارجاع (PTF-XX، اعداد بلند)
  (t.match(/ptf-[a-z]+-\d{4}-\d+/g) || []).forEach(function (m) { kws[m] = 9; });
  (t.match(/\b\d{5,}\b/g) || []).forEach(function (m) { kws[m] = 6; });
  // مبالغ
  (t.match(/[\d,]+\s*(ریال|ریال|irr)/g) || []).forEach(function (m) { kws[m.trim()] = 7; });
  // واژه‌های معنادار پرتکرار
  (t.match(/[\u0600-\u06FFa-z0-9]{3,}/g) || []).forEach(function (w) {
    if (LET_STOP.indexOf(w) > -1 || /^\d{1,4}$/.test(w)) return;
    kws[w] = (kws[w] || 0) + 1;
  });
  var sorted = Object.keys(kws).sort(function (a, b) { return kws[b] - kws[a]; }).slice(0, 12);
  // خلاصه: جمله اول + جمله حاوی بیشترین کلیدواژه
  var sents = (body || '').split(/[.।؟?!\n]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 15; });
  var best = sents[0] || '';
  var bestScore = -1;
  sents.slice(0, 8).forEach(function (s) {
    var sc = sorted.filter(function (k) { return letNorm(s).indexOf(k) > -1; }).length;
    if (sc > bestScore) { bestScore = sc; best = s; }
  });
  return { keywords: sorted, summary: (sents[0] === best ? best : (sents[0] ? sents[0] + ' … ' + best : best)).slice(0, 220) };
}

/* ---------- پروفایل امضا (AC2) ---------- */
function sigProfiles() { return JSON.parse(localStorage.getItem('ptf_crm_sigprofiles') || '{}'); }
function mySigProfile() { return sigProfiles()[curSession().user] || null; }

function showSigProfile() {
  var p = mySigProfile() || {};
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:480px">' +
    '<h3>✍️ پروفایل امضای من</h3>' +
    '<div class="fr"><div class="fld"><label>نام رسمی (روی نامه)</label><input type="text" id="sgNm" value="' + escP(p.nm || curSession().name || '') + '"></div>' +
    '<div class="fld"><label>سمت</label><input type="text" id="sgRole" value="' + escP(p.role || (typeof roleDef === 'function' ? roleDef().lb : '')) + '"></div></div>' +
    '<div class="fr"><div class="fld"><label>تصویر امضا</label><input type="file" id="sgSig" accept="image/*">' + (p.sig ? '<small style="color:#10b981">✔ ثبت شده</small>' : '') + '</div>' +
    '<div class="fld"><label>تصویر مهر</label><input type="file" id="sgStamp" accept="image/*">' + (p.stamp ? '<small style="color:#10b981">✔ ثبت شده</small>' : '') + '</div></div>' +
    '<small style="color:#94a3b8">تصاویر به‌صورت فشرده و امن فقط در سیستم ذخیره می‌شوند و در نامه‌های امضاشده شما درج خواهند شد.</small>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveSigProfile()">ذخیره</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

function _imgToDataUrl(file, maxW, cb) {
  var img = new Image();
  var url = URL.createObjectURL(file);
  img.onload = function () {
    var k = Math.min(1, maxW / img.width);
    var cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    // US-148 AC1: حذف خودکار پس‌زمینه روشن → PNG شفاف
    try {
      var im = ctx.getImageData(0, 0, cv.width, cv.height);
      var d = im.data;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var lum = 0.299 * r + 0.587 * g + 0.114 * b;
        var sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (lum > 235 && sat < 40) d[i + 3] = 0;                    // سفید/روشن → کاملاً شفاف
        else if (lum > 200 && sat < 40) d[i + 3] = Math.round(255 * (235 - lum) / 35); // لبه‌ها → محو نرم
      }
      ctx.putImageData(im, 0, 0);
    } catch (e) { /* در صورت خطای canvas، تصویر اصلی حفظ می‌شود */ }
    URL.revokeObjectURL(url);
    cb(cv.toDataURL('image/png'));
  };
  img.src = url;
}

function saveSigProfile() {
  var profiles = sigProfiles();
  var me = curSession().user;
  var p = profiles[me] || {};
  p.nm = document.getElementById('sgNm').value.trim();
  p.role = document.getElementById('sgRole').value.trim();
  var fs = document.getElementById('sgSig').files[0];
  var fst = document.getElementById('sgStamp').files[0];
  var pending = (fs ? 1 : 0) + (fst ? 1 : 0);
  function done() {
    p.updatedAtISO = new Date().toISOString();
    profiles[me] = p;
    /* setData به‌جای localStorage مستقیم: تغییر باید وارد صف sync شود تا پروفایل
       امضا روی موبایل/دستگاه‌های دیگر هم باقی بماند. */
    setData('ptf_crm_sigprofiles', profiles);
    hideModal();
    audit('مکاتبات', 'به‌روزرسانی پروفایل امضا', me);
    alert('✅ پروفایل امضا ذخیره شد');
  }
  if (!pending) { done(); return; }
  if (fs) _imgToDataUrl(fs, 400, function (d) { p.sig = d; if (--pending === 0) done(); });
  if (fst) _imgToDataUrl(fst, 420, function (d) { p.stamp = d; if (--pending === 0) done(); });
}

/* ---------- پنل مکاتبات ---------- */
function buildLetters() {
  return '<div class="ph"><h3>✉️ مکاتبات (اندیکاتور)</h3>' +
    '<div class="sb2">' +
    '<input type="text" id="ltSrch" placeholder="جستجو: شماره، موضوع، کلیدواژه..." oninput="renderLetters()">' +
    '<select id="ltFk" onchange="renderLetters()" style="padding:9px;border:1px solid var(--brd);border-radius:10px"><option value="">همه</option><option value="OUT">صادره</option><option value="IN">وارده</option></select>' +
    '<button class="bt" onclick="showLetterModal()">+ نامه صادره</button>' +
    '<button class="bt" style="background:#0e7490" onclick="showInboundModal()">+ ثبت نامه وارده</button>' +
    '<button class="bt bt-o" onclick="showSigProfile()">✍️ امضای من</button>' +
    '</div></div><div id="ltWrap"></div>';
}

function renderLetters() {
  var el = document.getElementById('ltWrap');
  if (!el) return;
  var q = letNorm(((document.getElementById('ltSrch') || {}).value || '').trim());
  var fk = (document.getElementById('ltFk') || {}).value || '';
  var ls = getData('ptf_crm_letters').filter(function (l) {
    if (fk && l.kind !== fk) return false;
    if (!q) return true;
    var hay = letNorm((l.no || '') + ' ' + (l.subject || '') + ' ' + (l.to || '') + ' ' + (l.from || '') + ' ' + (l.summary || '') + ' ' + (l.keywords || []).join(' '));
    return hay.indexOf(q) > -1;
  });
  var ST = { draft: '<span class="bd" style="background:#f1f5f9;color:#64748b">پیش‌نویس</span>',
    pending: '<span class="bd" style="background:#fef3c7;color:#b45309">در انتظار امضا</span>',
    signed: '<span class="bd b-st4">امضا شد</span>',
    rejected: '<span class="bd" style="background:#fee2e2;color:#b91c1c">رد شد</span>',
    registered: '<span class="bd b-st4">ثبت شد</span>' };
  var h = '<div class="tb2"><table><thead><tr><th>شماره</th><th>نوع</th><th>موضوع</th><th>طرف</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>';
  ls.forEach(function (l) {
    var canSign = l.st === 'pending' && l.signer === curSession().user;
    h += '<tr><td><b dir="' + (/^PTF-/.test(l.no || '') ? 'ltr' : 'rtl') + '">' + escP(l.no || '—') + '</b></td>' + /* v85.3: شماره فارسی RTL در فهرست */
      '<td>' + (l.kind === 'OUT' ? '📤 صادره' : '📥 وارده') + '</td>' +
      '<td>' + escP(l.subject || '-') + (l.summary ? '<br><small style="color:#94a3b8">' + escP(l.summary.slice(0, 70)) + '…</small>' : '') + '</td>' +
      '<td>' + escP(l.kind === 'OUT' ? (l.to || '-') : (l.from || '-')) + '</td>' +
      '<td>' + escP(l.t || '-') + '</td>' +
      '<td>' + (ST[l.st] || '') + (l.st === 'pending' ? '<br><small style="color:#94a3b8">امضاکننده: ' + escP(l.signerNm || l.signer) + '</small>' : '') + (l.rejectWhy ? '<br><small style="color:#b91c1c">' + escP(l.rejectWhy) + '</small>' : '') + '</td>' +
      '<td>' +
      /* v12.5 (US-308): پیش‌نویس‌های دستیار (src=ai-workbench) هم قابل ویرایش‌اند — نامه‌های قدیمی دستیار kind/author نداشتند */
      (((l.kind === 'OUT' && l.author === curSession().user) || l.src === 'ai-workbench') && (l.st === 'draft' || l.st === 'rejected') ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11.5px" onclick="showLetterModal(\'' + l.cd + '\')">✏️</button> ' : '') +
      (canSign ? '<button class="bt" style="padding:3px 8px;font-size:11.5px;background:#10b981" onclick="letSign(\'' + l.cd + '\')">✅ امضا</button> <button class="bt bt-o" style="padding:3px 8px;font-size:11.5px;color:#dc2626" onclick="letReject(\'' + l.cd + '\')">رد</button> ' : '') +
      (l.st === 'signed' || l.st === 'registered' ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11.5px" onclick="letPrint(\'' + l.cd + '\',false)">🖨️ PDF</button> ' : '') +
      (l.kind === 'OUT' && l.st !== 'signed' ? '<button class="bt bt-o" style="padding:3px 8px;font-size:11.5px" onclick="letPrint(\'' + l.cd + '\',true)">👁️</button> ' : '') +
      '<button class="bt bt-o" style="padding:3px 8px;font-size:11.5px;color:#dc2626" onclick="letDel(\'' + l.cd + '\')">🗑️</button>' +
      '</td></tr>';
  });
  el.innerHTML = h + '</tbody></table></div>' + (ls.length ? '' : '<div style="text-align:center;color:#94a3b8;padding:20px">نامه‌ای ثبت نشده</div>');
}

/* ---------- فرم نامه صادره ---------- */
/* ---------- ویرایشگر غنی نامه (جدول و تصویر داخل متن) ---------- */
function letEscHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function letSafeBodyHtml(html) {
  var box = document.createElement('div');
  box.innerHTML = String(html || '');
  var allowed = { P:1, DIV:1, BR:1, B:1, STRONG:1, I:1, EM:1, U:1, UL:1, OL:1, LI:1, TABLE:1, THEAD:1, TBODY:1, TR:1, TH:1, TD:1, IMG:1, A:1, H1:1, H2:1, H3:1, BLOCKQUOTE:1, SPAN:1 };
  Array.prototype.slice.call(box.querySelectorAll('*')).forEach(function (el) {
    if (!allowed[el.tagName]) { el.replaceWith(document.createTextNode(el.textContent || '')); return; }
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      var n = a.name.toLowerCase(), v = a.value || '';
      var keep = n === 'colspan' || n === 'rowspan' || n === 'alt' || n === 'title' ||
        (n === 'href' && /^(https?:|mailto:|#)/i.test(v)) ||
        (n === 'src' && (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(v) || /^https:\/\//i.test(v)));
      if (!keep) el.removeAttribute(a.name);
    });
  });
  return box.innerHTML;
}
function letEditorExec(cmd, value) {
  var ed = document.getElementById('ltBodyEditor'); if (!ed) return;
  ed.focus(); try { document.execCommand(cmd, false, value || null); } catch (e) {}
}
window.ptfLetEditorCmd = function (cmd) { letEditorExec(cmd); };
window.ptfLetEditorTable = function () {
  var ed = document.getElementById('ltBodyEditor'); if (!ed) return;
  var rows = Math.max(1, Math.min(12, +(prompt('تعداد سطر جدول:', '2') || 0)));
  var cols = Math.max(1, Math.min(10, +(prompt('تعداد ستون جدول:', '2') || 0)));
  if (!rows || !cols) return;
  var h = '<table><tbody>';
  for (var r = 0; r < rows; r++) { h += '<tr>'; for (var c = 0; c < cols; c++) h += (r === 0 ? '<th>عنوان</th>' : '<td>&nbsp;</td>'); h += '</tr>'; }
  h += '</tbody></table><p><br></p>';
  letEditorExec('insertHTML', h);
};
window.ptfLetEditorImagePick = function () { var i = document.getElementById('ltInlineImg'); if (i) i.click(); };
function letEditorInsertImageFile(f) {
  if (!f || !/^image\//.test(f.type)) { alert('فقط فایل تصویری قابل درج است'); return; }
  var img = new Image(), url = URL.createObjectURL(f);
  img.onload = function () {
    var max = 1100, k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    var data = cv.toDataURL('image/jpeg', .84);
    if (data.length > 450000) { alert('تصویر پس از فشرده‌سازی بزرگ است؛ تصویر کوچک‌تری انتخاب کنید.'); return; }
    letEditorExec('insertHTML', '<img src="' + data + '" alt="تصویر نامه">');
  };
  img.onerror = function () { URL.revokeObjectURL(url); alert('خواندن تصویر ناموفق بود'); };
  img.src = url;
}
window.ptfLetEditorImage = function (inp) {
  var f = (inp.files || [])[0]; inp.value = ''; letEditorInsertImageFile(f);
};
function letEditorWirePasteAndDrop(editor) {
  if (!editor || editor.dataset.richWire) return;
  editor.dataset.richWire = '1';
  editor.addEventListener('paste', function (ev) {
    var cb = ev.clipboardData, file = cb && Array.prototype.slice.call(cb.files || []).filter(function (f) { return /^image\//.test(f.type); })[0];
    if (file) { ev.preventDefault(); letEditorInsertImageFile(file); return; }
    /* Word/Excel معمولاً HTML table را در clipboard می‌گذارند؛ ساختار مجاز آن
       حفظ می‌شود اما style/script خارجی و ناسالم پیش از ورود حذف می‌گردد. */
    var html = cb && cb.getData && cb.getData('text/html');
    if (html && /<(table|tr|td|th|img)\b/i.test(html)) {
      ev.preventDefault(); letEditorExec('insertHTML', letSafeBodyHtml(html));
    }
  });
  editor.addEventListener('dragover', function (ev) { ev.preventDefault(); editor.classList.add('is-dragover'); });
  editor.addEventListener('dragleave', function () { editor.classList.remove('is-dragover'); });
  editor.addEventListener('drop', function (ev) {
    ev.preventDefault(); editor.classList.remove('is-dragover');
    var files = Array.prototype.slice.call((ev.dataTransfer || {}).files || []), image = files.filter(function (f) { return /^image\//.test(f.type); })[0];
    if (image) { letEditorInsertImageFile(image); return; }
    var html = (ev.dataTransfer || {}).getData && ev.dataTransfer.getData('text/html');
    if (html) letEditorExec('insertHTML', letSafeBodyHtml(html));
  });
}

function showLetterModal(cd) {
  var l = cd ? getData('ptf_crm_letters').filter(function (x) { return x.cd === cd; })[0] : null;
  var custs = getData('ptf_crm_customers'), sups = getData('ptf_crm_suppliers');
  var toOpts = '<option value="">— انتخاب یا تایپ آزاد —</option>' +
    custs.map(function (c) { return '<option' + (l && l.to === c.co ? ' selected' : '') + '>' + escP(c.co) + '</option>'; }).join('') +
    sups.map(function (s) { return '<option' + (l && l.to === s.co ? ' selected' : '') + '>' + escP(s.co) + '</option>'; }).join('');
  var users = getData('ptf_crm_users');
  var signOpts = '<option value="__me__">خودم (' + escP(curSession().name) + ')</option>' +
    users.filter(function (u) { return u.username !== curSession().user; })
      .map(function (u) { return '<option value="' + escP(u.username) + '"' + (l && l.signer === u.username ? ' selected' : '') + '>' + escP(u.name) + ' — ' + escP(u.role) + '</option>'; }).join('');
  var s = (l && l.style) || {};
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:760px;max-height:94vh;overflow:auto">' +
    '<style>.let-editor-tools{display:flex;gap:5px;flex-wrap:wrap;padding:7px;background:#f8fafc;border:1px solid var(--brd);border-bottom:0;border-radius:10px 10px 0 0}.let-editor-tools .bt{padding:4px 8px;font-size:11px}.let-rich-editor{min-height:230px;padding:12px;border:1px solid var(--brd);border-radius:0 0 10px 10px;line-height:2;background:#fff;outline:none;font-size:14px}.let-rich-editor:focus{border-color:#0e7490;box-shadow:0 0 0 2px #bae6fd}.let-rich-editor.is-dragover{border:2px dashed #0e7490;background:#f0f9ff}.let-rich-editor p{margin:0 0 8px}.let-rich-editor table{width:100%;border-collapse:collapse;margin:10px 0}.let-rich-editor td,.let-rich-editor th{border:1px solid #64748b;padding:6px;min-width:55px}.let-rich-editor th{background:#f1f5f9}.let-rich-editor img{display:block;max-width:100%;max-height:360px;margin:10px auto;resize:both}</style>' +
    '<h3>📤 نامه صادره' + (l ? ' — ویرایش' : '') + '</h3>' +
    '<div class="fr"><div class="fld"><label>زبان نامه</label><select id="ltLang"><option value="fa"' + (l && l.lang === 'fa' ? ' selected' : '') + '>فارسی</option><option value="en"' + (l && l.lang === 'en' ? ' selected' : '') + '>English</option></select></div>' +
    '<div class="fld"><label>گیرنده (شرکت/سازمان)</label><select id="ltToSel" onchange="document.getElementById(\'ltTo\').value=this.value">' + toOpts + '</select></div></div>' +
    '<div class="fr"><div class="fld"><label>گیرنده — متن روی نامه *</label><input type="text" id="ltTo" value="' + (l ? escP(l.to || '') : '') + '" placeholder="جناب آقای مهندس محمدی / مدیریت محترم بازرگانی ..."></div>' +
    /* v123.1: سمت گیرنده — در متن نامه دقیقا زیر نام چاپ می‌شود */
    '<div class="fld"><label>سمت گیرنده (زیر نام چاپ می‌شود)</label><input type="text" id="ltToRole" value="' + (l ? escP(l.toRole || '') : '') + '" placeholder="مدیر محترم بازرگانی شرکت ..."></div></div>' +
    '<div class="fld"><label>موضوع *</label><input type="text" id="ltSub" value="' + (l ? escP(l.subject || '') : '') + '"></div>' +
    '<div class="fld"><label>متن نامه *</label><div class="let-editor-tools" role="toolbar" aria-label="ابزار ویرایش متن">' +
    '<button type="button" class="bt bt-o" onmousedown="event.preventDefault()" onclick="ptfLetEditorCmd(\'bold\')"><b>Bold</b></button><button type="button" class="bt bt-o" onmousedown="event.preventDefault()" onclick="ptfLetEditorCmd(\'italic\')"><i>Italic</i></button><button type="button" class="bt bt-o" onmousedown="event.preventDefault()" onclick="ptfLetEditorCmd(\'insertUnorderedList\')">• فهرست</button><button type="button" class="bt bt-o" onmousedown="event.preventDefault()" onclick="ptfLetEditorTable()">▦ جدول</button><button type="button" class="bt bt-o" onmousedown="event.preventDefault()" onclick="ptfLetEditorImagePick()">🖼 تصویر در متن</button></div>' +
    '<input type="file" id="ltInlineImg" accept="image/*" style="display:none" onchange="ptfLetEditorImage(this)">' +
    '<div id="ltBodyEditor" class="let-rich-editor" contenteditable="true" role="textbox" aria-multiline="true"></div>' +
    '<small style="color:#94a3b8">جدول را از Word/Excel در محل نشانگر Paste کنید؛ همچنین می‌توانید فایل تصویر را داخل متن Drag &amp; Drop کنید. اندازه فونت چاپ خودکار تنظیم می‌شود.</small></div>' +
    /* v31.7.22 US-LTR-IMG: تصاویر داخل متن نامه — حداکثر ۳ تصویر فشرده، بعد از متن چاپ می‌شوند */
    '<div class="fld"><label>🖼 تصاویر نامه (اختیاری — حداکثر ۳؛ بعد از متن چاپ می‌شوند)</label>' +
    '<input type="file" id="ltImgFile" accept="image/*" multiple style="display:none" onchange="ptfLtImgAdd(this)">' +
    '<div id="ltImgThumbs" style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0"></div>' +
    '<button type="button" class="bt bt-o" style="font-size:12px" onclick="document.getElementById(\'ltImgFile\').click()">📤 افزودن تصویر</button>' +
    '<small style="color:#94a3b8;display:block">تصویر خودکار فشرده می‌شود (حداکثر ۹۰۰px) — روی نامه وسط‌چین و متناسب صفحه چاپ می‌شود</small></div>' +
    '<div class="fr"><div class="fld"><label>پیوست</label><select id="ltAtt"><option' + (l && l.att === 'ندارد' ? ' selected' : '') + '>ندارد</option><option' + (l && l.att === 'دارد' ? ' selected' : '') + '>دارد</option></select></div>' +
    '<div class="fld"><label>امضاکننده</label><select id="ltSigner">' + signOpts + '</select></div></div>' +
    '<div class="fr"><div class="fld"><label style="font-size:11.5px">درج «بسمه تعالی» <input type="checkbox" id="ltBsm" ' + (!l || l.bsm !== false ? 'checked' : '') + '></label></div>' +
    '<div class="fld"><label>لینک به پرونده (اختیاری)</label><select id="ltPrj"><option value="">— بدون پرونده —</option>' + getData('ptf_crm_projects').map(function(pp){ return '<option value="' + escP(pp.no) + '"' + (l && l.prjNo === pp.no ? ' selected' : '') + '>' + escP(pp.no) + ' — ' + escP(pp.buyerCo || '') + '</option>'; }).join('') + '</select></div></div>' +
    '<details style="margin:8px 0"><summary style="cursor:pointer;font-size:12.5px;color:#0e7490">🎛 تنظیمات دستی قالب (اختیاری)</summary>' +
    '<div class="fr" style="margin-top:8px"><div class="fld"><label>اندازه فونت متن (خالی = خودکار)</label><select id="ltFs"><option value="">خودکار</option>' +
    [12,12.5,13,13.5,14,15,16].map(function (f) { return '<option' + (s.fs == f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label>چینش متن</label><select id="ltAlign"><option value="">پیش‌فرض (فا: راست / EN: چپ)</option><option value="justify"' + (s.align === 'justify' ? ' selected' : '') + '>تراز دوطرفه</option><option value="center"' + (s.align === 'center' ? ' selected' : '') + '>وسط</option></select></div></div>' +
    '<div class="fr"><div class="fld"><label style="font-size:12px">متن بولد <input type="checkbox" id="ltB" ' + (s.bold ? 'checked' : '') + '></label></div>' +
    '<div class="fld"><label style="font-size:12px">متن ایتالیک <input type="checkbox" id="ltI" ' + (s.italic ? 'checked' : '') + '></label></div></div></details>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
    '<button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt bt-o" onclick="letPreviewDraft(' + (l ? "'" + l.cd + "'" : 'null') + ')">👁️ پیش‌نمایش</button>' +
    '<button class="bt" onclick="letSubmit(' + (l ? "'" + l.cd + "'" : 'null') + ')">✅ تایید و ثبت</button></div>' +
    '<small style="color:#94a3b8;display:block;margin-top:6px">پیش‌نمایش را ببینید؛ اگر تایید بود «تایید و ثبت» بزنید، وگرنه از تنظیمات دستی بالا اصلاح کنید.</small>' +
    '</div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  /* v31.7.22 US-LTR-IMG */
  window._ltImgs = (l && Array.isArray(l.images)) ? JSON.parse(JSON.stringify(l.images)) : [];
  var editor = document.getElementById('ltBodyEditor');
  if (editor) { editor.innerHTML = letSafeBodyHtml((l && l.bodyHtml) || letEscHtml((l && l.body) || '').replace(/\n/g, '<br>')); letEditorWirePasteAndDrop(editor); }
  ptfLtImgRender();
}

/* ===== v31.7.22 US-LTR-IMG: مدیریت تصاویر نامه ===== */
window.ptfLtImgRender = function () {
  var box = document.getElementById('ltImgThumbs');
  if (!box) return;
  var arr = window._ltImgs || [];
  box.innerHTML = arr.map(function (im, i) {
    return '<div style="position:relative;border:1px solid var(--brd);border-radius:10px;padding:4px;background:#f8fafc">' +
      '<img src="' + im.src + '" style="width:84px;height:64px;object-fit:cover;border-radius:7px;display:block">' +
      '<input type="text" value="' + escP(im.cap || '') + '" placeholder="شرح (اختیاری)" oninput="window._ltImgs[' + i + '].cap=this.value" style="width:84px;font-size:10px;margin-top:3px;padding:2px 4px;border:1px solid var(--brd);border-radius:5px">' +
      '<button type="button" onclick="window._ltImgs.splice(' + i + ',1);ptfLtImgRender()" style="position:absolute;top:-7px;left:-7px;width:20px;height:20px;border-radius:50%;border:0;background:#dc2626;color:#fff;cursor:pointer;font-size:11px;line-height:1">✕</button></div>';
  }).join('');
};
window.ptfLtImgAdd = function (inp) {
  var files = Array.prototype.slice.call(inp.files || []);
  inp.value = '';
  files.forEach(function (f) {
    if (!/^image\//.test(f.type)) { alert('فقط فایل تصویری انتخاب کنید'); return; }
    if ((window._ltImgs || []).length >= 3) { alert('حداکثر ۳ تصویر برای هر نامه'); return; }
    var img = new Image();
    var url = URL.createObjectURL(f);
    img.onload = function () {
      var MAX = 900;
      var k = Math.min(1, MAX / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      var data = cv.toDataURL('image/jpeg', 0.82);
      if (data.length > 350000) { alert('تصویر پس از فشرده‌سازی هم بزرگ است — تصویر ساده‌تری انتخاب کنید'); return; }
      window._ltImgs = window._ltImgs || [];
      window._ltImgs.push({ src: data, cap: '' });
      ptfLtImgRender();
    };
    img.onerror = function () { URL.revokeObjectURL(url); alert('خطا در خواندن تصویر'); };
    img.src = url;
  });
};

function _collectLetter(cd) {
  var l = cd ? getData('ptf_crm_letters').filter(function (x) { return x.cd === cd; })[0] : {};
  l = l || {};
  l.cd = l.cd || genCode('LET');
  l.kind = 'OUT';
  l.lang = document.getElementById('ltLang').value;
  l.to = document.getElementById('ltTo').value.trim();
  l.toRole = ((document.getElementById('ltToRole') || {}).value || '').trim(); // v123.1: سمت گیرنده
  l.subject = document.getElementById('ltSub').value.trim();
  var editor = document.getElementById('ltBodyEditor');
  l.bodyHtml = letSafeBodyHtml(editor ? editor.innerHTML : '');
  l.body = editor ? (editor.innerText || '').trim() : '';
  l.att = document.getElementById('ltAtt').value;
  l.bsm = document.getElementById('ltBsm').checked;
  l.prjNo = document.getElementById('ltPrj').value;
  l.signer = document.getElementById('ltSigner').value;
  l.images = (window._ltImgs || []).slice(0, 3); /* v31.7.22 US-LTR-IMG */
  l.style = {
    fs: +document.getElementById('ltFs').value || '',
    align: document.getElementById('ltAlign').value,
    bold: document.getElementById('ltB').checked,
    italic: document.getElementById('ltI').checked
  };
  l.author = curSession().user;
  l.authorNm = curSession().name;
  return l;
}

function letPreviewDraft(cd) {
  var l = _collectLetter(cd);
  if (!l.to || !l.subject || !l.body.trim()) { alert('گیرنده، موضوع و متن الزامی است'); return; }
  letPrintObj(l, true);
}

function letSubmit(cd) {
  var l = _collectLetter(cd);
  if (!l.to || !l.subject || !l.body.trim()) { alert('گیرنده، موضوع و متن الزامی است'); return; }
  var ex = letExtract(l.subject, l.body);
  l.keywords = ex.keywords; l.summary = ex.summary;
  l.t = faDate();
  var ls = getData('ptf_crm_letters');
  var idx = -1;
  ls.forEach(function (x, i) { if (x.cd === l.cd) idx = i; });
  if (l.signer === '__me__') {
    // خودامضا: شماره قطعی + امضای پروفایل خودم
    var p = mySigProfile();
    if (!p || !p.sig) { alert('ابتدا در «✍️ امضای من» تصویر امضای خود را ثبت کنید'); return; }
    l.no = letSerial('OUT', l.lang);
    l.st = 'signed';
    l.signer = curSession().user;
    l.signerNm = p.nm; l.signerRole = p.role;
    l.signatureSnapshot = { sig: p.sig || '', stamp: p.stamp || '', nm: p.nm || '', role: p.role || '', at: faDateTime() };
    l.signedT = faDateTime(); l.tEn = l.tEn || new Date().toISOString().slice(0, 10);
  } else {
    l.st = 'pending';
    var u = getData('ptf_crm_users').filter(function (x) { return x.username === l.signer; })[0];
    l.signerNm = u ? u.name : l.signer;
    notify({ toUsers: [l.signer], title: '✍️ درخواست امضای نامه: ' + l.subject, body: 'نویسنده: ' + l.authorNm, kind: 'sign_req', channels: ['cart'], link: { panel: 'let' }, actionable: true, refCd: l.cd });
  }
  if (idx > -1) ls[idx] = l; else ls.unshift(l);
  setData('ptf_crm_letters', ls);
  // ثبت در پرونده
  if (l.prjNo) _letAttachToPrj(l);
  hideModal(); renderLetters();
  audit('مکاتبات', (l.st === 'signed' ? 'صدور نامه ' + l.no : 'ارسال نامه برای امضای ' + l.signerNm) + ' — ' + l.subject, l.no || l.cd);
  if (l.st === 'signed') { if (confirm('✅ نامه ' + l.no + ' صادر شد.\nخروجی PDF باز شود؟')) letPrint(l.cd, false); }
  else alert('📨 نامه در انتظار امضای ' + l.signerNm + ' — به کارتابل ایشان اعلان رفت');
}

function _letAttachToPrj(l) {
  var prjs = getData('ptf_crm_projects');
  var p = prjs.filter(function (x) { return x.no === l.prjNo; })[0];
  if (!p) return;
  p.docs = p.docs || [];
  if (!p.docs.filter(function (d) { return d.letCd === l.cd; }).length) {
    p.docs.push({ folder: 'corr', name: (l.no || 'پیش‌نویس') + ' — ' + l.subject, letCd: l.cd, t: faDate(), by: curSession().name });
    p.timeline.push({ t: faDateTime(), by: curSession().name, tx: 'نامه «' + l.subject + '» به پرونده لینک شد' });
    setData('ptf_crm_projects', prjs);
  }
}

/* ---------- جریان امضا (AC2b) ---------- */
function letSign(cd) {
  var ls = getData('ptf_crm_letters');
  var l = ls.filter(function (x) { return x.cd === cd; })[0];
  if (!l || l.signer !== curSession().user) return;
  var p = mySigProfile();
  if (!p || !p.sig) { alert('ابتدا در «✍️ امضای من» تصویر امضای خود را ثبت کنید'); showSigProfile(); return; }
  if (!confirm('نامه «' + l.subject + '» با نام و امضای شما نهایی شود؟')) return;
  l.no = letSerial('OUT', l.lang);
  l.st = 'signed';
  l.signerNm = p.nm; l.signerRole = p.role;
  l.signatureSnapshot = { sig: p.sig || '', stamp: p.stamp || '', nm: p.nm || '', role: p.role || '', at: faDateTime() };
  l.signedT = faDateTime(); l.tEn = l.tEn || new Date().toISOString().slice(0, 10);
  setData('ptf_crm_letters', ls);
  if (l.prjNo) _letAttachToPrj(l);
  try { if (typeof window.ntfResolveByRef === 'function') window.ntfResolveByRef(l.cd); } catch (eNR) {} /* v33.4.1: امضا شد — درخواست امضای مرتبط برای همه حذف شود */
  notify({ toUsers: [l.author], title: '✅ نامه «' + l.subject + '» امضا شد — ' + l.no, kind: 'sign_ok', channels: ['cart'], link: { panel: 'let' } });
  audit('مکاتبات', 'امضای نامه ' + l.no, l.no);
  renderLetters();
  if (confirm('✅ ' + l.no + ' صادر شد. PDF باز شود؟')) letPrint(cd, false);
}

function letReject(cd) {
  var why = prompt('دلیل رد نامه؟ (الزامی — به نویسنده اعلام می‌شود)');
  if (!why || !why.trim()) return;
  var ls = getData('ptf_crm_letters');
  var l = ls.filter(function (x) { return x.cd === cd; })[0];
  if (!l) return;
  l.st = 'rejected';
  l.rejectWhy = why.trim();
  setData('ptf_crm_letters', ls);
  try { if (typeof window.ntfResolveByRef === 'function') window.ntfResolveByRef(l.cd); } catch (eNR) {} /* v33.4.1: رد شد — درخواست امضای مرتبط برای همه حذف شود */
  notify({ toUsers: [l.author], title: '❌ نامه «' + l.subject + '» رد شد', body: 'دلیل: ' + why, kind: 'sign_no', channels: ['cart'], link: { panel: 'let' }, actionable: true, refCd: l.cd });
  audit('مکاتبات', 'رد امضای نامه: ' + why, l.cd);
  renderLetters();
}

function letDel(cd) {
  var l = getData('ptf_crm_letters').filter(function (x) { return x.cd === cd; })[0];
  if (l && (l.st === 'signed' || l.st === 'registered') && !isSenior()) { alert('نامه ثبت‌شده را فقط نقش ارشد می‌تواند حذف کند'); return; }
  if (!confirm('حذف شود؟')) return;
  setData('ptf_crm_letters', getData('ptf_crm_letters').filter(function (x) { return x.cd !== cd; }));
  audit('مکاتبات', 'حذف نامه', cd);
  renderLetters();
}

/* ---------- نامه وارده (AC4) ---------- */
function showInboundModal() {
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px;max-height:92vh;overflow:auto">' +
    '<h3>📥 ثبت نامه وارده</h3>' +
    '<div class="fr"><div class="fld"><label>فرستنده *</label><input type="text" id="inFrom"></div>' +
    '<div class="fld"><label>تاریخ دریافت</label><input type="text" id="inT" value="' + faDate() + '"></div></div>' +
    '<div class="fld"><label>موضوع *</label><input type="text" id="inSub"></div>' +
    '<div class="fld"><label>خلاصه/متن نامه (برای جستجوی موضوعی — تایپ یا Paste کنید)</label><textarea id="inBody" rows="4"></textarea></div>' +
    '<div class="fr"><div class="fld"><label>مهلت پاسخ (شمسی/اختیاری)</label>' + (typeof ptfDatePicker==='function' ? ptfDatePicker('inDueJ','') : '<input type="text" id="inDueJ" placeholder="1405/04/19" style="direction:ltr">') + '</div>' +
    '<div class="fld"><label>لینک به پرونده</label><select id="inPrj"><option value="">— بدون پرونده —</option>' + getData('ptf_crm_projects').map(function(pp){ return '<option value="' + escP(pp.no) + '">' + escP(pp.no) + ' — ' + escP(pp.buyerCo || '') + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="fld"><label>اسکن نامه (PDF/عکس)</label><div id="inUpWrap"></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveInbound()">ثبت با شماره اندیکاتور</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  window._inFiles = [];
  if (typeof attachUploadWidget === 'function')
    attachUploadWidget('inUpWrap', 'letters/in', function (f) { window._inFiles.push(f); });
}

function saveInbound() {
  var from = document.getElementById('inFrom').value.trim();
  var sub = document.getElementById('inSub').value.trim();
  if (!from || !sub) { alert('فرستنده و موضوع الزامی است'); return; }
  var body = document.getElementById('inBody').value;
  var ex = letExtract(sub, body);
  var due = (typeof ptfJToISO === 'function') ? ptfJToISO(((document.getElementById('inDueJ') || {}).value || '')) : (((document.getElementById('inDueJ') || {}).value || ''));
  var l = { cd: genCode('LET'), kind: 'IN', no: letSerial('IN'), from: from, subject: sub, body: body,
    summary: ex.summary, keywords: ex.keywords, t: document.getElementById('inT').value || faDate(),
    prjNo: document.getElementById('inPrj').value, files: window._inFiles || [],
    st: 'registered', by: curSession().name };
  var ls = getData('ptf_crm_letters');
  ls.unshift(l);
  setData('ptf_crm_letters', ls);
  if (l.prjNo) _letAttachToPrj(l);
  // مهلت پاسخ → یادآور (اتصال به US-113)
  if (due && typeof addReminder === 'function') {
    addReminder({ title: 'پاسخ به نامه ' + l.no + ' — ' + sub, topic: 'سایر', dueISO: due, pri: 'متوسط' });
  }
  hideModal(); renderLetters();
  audit('مکاتبات', 'ثبت نامه وارده ' + l.no + ' از ' + from, l.no);
  alert('✅ ثبت شد: ' + l.no);
}

/* ---------- چاپ روی سربرگ (قالب تاییدشده کارفرما) ---------- */
function letPrint(cd, isPreview) {
  var l = getData('ptf_crm_letters').filter(function (x) { return x.cd === cd; })[0];
  if (!l) return;
  letPrintObj(l, isPreview);
}

function letPrintObj(l, isPreview) {
  var isEn = l.lang === 'en';
  var s = l.style || {};
  var fs = s.fs || letAutoSize(l.body);           // عادی ۱۴ — حداقل ۱۲
  var tfs = fs + 1;                               // عناوین: یک واحد بزرگتر (AC)
  var align = s.align || (isEn ? 'left' : 'right');
  var font = isEn ? LETTER_FONT_EN : LETTER_FONT_FA;
  var dir = isEn ? 'ltr' : 'rtl';
  /* نامهٔ امضاشده snapshot دارد تا تغییر/همگام‌سازی بعدی پروفایل، امضای سند تاریخی را پاک نکند. */
  var sigP = l.st === 'signed' ? (l.signatureSnapshot || sigProfiles()[l.signer] || {}) : {};
  var fullHtml = '<!doctype html><html lang="' + (isEn ? 'en' : 'fa') + '" dir="' + dir + '"><head><meta charset="utf-8"><title>' + escP(l.no || 'پیش‌نمایش') + '</title><style>' +
    '@page{size:A4 portrait;margin:0}' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:' + font + ';color:#26282c;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.bar-top{position:fixed;top:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#e87200 0%,#ee8100 35%,#ecb003 70%,#ecc506 100%)}' +
    /* US-184: خطوط مورب سفید حاشیه — مطابق سربرگ اصلی تاییدشده کارفرما */
    '.bar-top i,.bar-bot i{position:fixed;height:9mm;width:1.4mm;background:#fff;transform:skewX(-35deg)}' +
    '.bar-top i{top:-1mm}.bar-top .s1{left:34.2%}.bar-top .s2{left:35.8%}.bar-top .s3{left:37.4%}' +
    '.bar-bot{position:fixed;bottom:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#ecc506 0%,#ecb003 30%,#ee8100 65%,#e87200 100%)}' +
    '.bar-bot i{bottom:-1mm}.bar-bot .s1{right:34.2%}.bar-bot .s2{right:35.8%}.bar-bot .s3{right:37.4%}' +
    /* v85.2: سربرگ بر اساس زبان — فا: لوگو راست، فیلدها چپِ صفحه ولی راست‌چینِ زیر هم | EN: آینه‌ای */
    '.hd{padding:12mm 14mm 0;display:flex;justify-content:space-between;align-items:center;direction:' + dir + '}' +
    '.hd img{height:22mm}' +
    '.flds{font-size:11pt;color:#4b5057;line-height:2.3;direction:' + dir + '}' +
    '.flds .row{display:flex;align-items:baseline;gap:1.5mm;justify-content:flex-start}' +
    '.flds .lb{white-space:nowrap;min-width:' + (isEn ? '22mm' : '16mm') + '}' +
    '.flds b{color:#26282c}' +
    '.content{padding:8mm 16mm 0;min-height:170mm}' +
    /* v31.7.22 BUG-LTR-FONT-001 (گزارش کارفرما): بسمه تعالی/گیرنده/سمت/موضوع فونت یاقوت نداشتند.
       ریشه: فونت یاقوت وزن Bold مستقل ندارد؛ برخی مرورگرها برای weight:700 به‌جای ضخیم‌سازی
       مصنوعی همان فونت، به فونت دیگری از پشته (Tahoma بولد‌دار) می‌رفتند.
       رفع: font-family صریح + font-synthesis تا بولد از همان یاقوت ساخته شود. */
    '.bsm,.to,.torl,.sub{font-family:' + font + ';font-synthesis:weight style}' +
    '.bsm{text-align:center;font-size:' + (fs) + 'pt;margin-bottom:6mm}' +
    '.to{font-weight:700;font-size:' + tfs + 'pt;margin-bottom:0.5mm}' +
    '.torl{font-weight:600;font-size:' + fs + 'pt;margin-bottom:2mm}' + /* v123.1: سمت گیرنده زیر نام */          /* مخاطب: بولد +۱ */
    '.sub{font-weight:700;font-size:' + tfs + 'pt;margin-bottom:6mm}' +          /* موضوع: بولد +۱ */
    '.body{font-size:' + fs + 'pt;line-height:2.1;text-align:' + align + ';white-space:normal;' +
      (s.bold ? 'font-weight:700;' : '') + (s.italic ? 'font-style:italic;' : '') + '}' +
    '.body p{margin:0 0 3mm}.body table{width:100%;border-collapse:collapse;margin:4mm 0;page-break-inside:avoid}.body td,.body th{border:1px solid #64748b;padding:2mm;text-align:' + align + '}.body th{background:#f1f5f9}.body img{display:block;max-width:100%;max-height:110mm;margin:4mm auto;page-break-inside:avoid}' +
    /* v31.7.22 US-LTR-IMG: تصاویر متن نامه — وسط‌چین، متناسب صفحه، بدون شکستن وسط تصویر */
    '.limgs{margin-top:5mm}' +
    '.limgs figure{margin:4mm auto;text-align:center;page-break-inside:avoid}' +
    '.limgs img{max-width:100%;max-height:110mm;border-radius:1.5mm}' +
    '.limgs figcaption{font-size:' + (fs - 2) + 'pt;color:#4b5057;margin-top:1.5mm}' +
    '.sig{margin-top:12mm;display:flex;justify-content:flex-end;direction:' + dir + '}' +
    '.sigbox{text-align:center;position:relative;min-width:60mm;padding-top:2mm}' +
    '.sigbox .salute{font-size:' + fs + 'pt;font-weight:700;margin-bottom:6mm;color:#1e293b}' +
    '.sigbox .nm{font-weight:800;font-size:' + (fs + 1) + 'pt;position:relative;z-index:5}' +
    '.sigbox .rl{font-weight:700;font-size:' + (fs - 1) + 'pt;color:#4b5057;position:relative;z-index:5}' +
    '.sigbox img.s{height:25mm;width:auto;margin:-6mm auto -3mm;display:block;position:relative;z-index:4;transform:scale(1.4)}' +
    '.sigbox img.st{position:absolute;height:30mm;width:auto;top:14mm;left:50%;transform:translateX(-50%);opacity:.92;z-index:3;mix-blend-mode:multiply}' +
    '.ft{position:fixed;bottom:9mm;left:0;right:0;text-align:center;font-size:9pt;color:#4b5057;line-height:1.9;font-family:Vazirmatn,Tahoma,sans-serif}' +
    '.ft .ln{display:flex;justify-content:center;align-items:center;gap:2mm;direction:rtl}' +
    '.ft .en{direction:ltr;gap:8mm}.ft svg{width:3.8mm;height:3.8mm}' +
    (isPreview ? 'body:before{content:"پیش‌نویس / PREVIEW";position:fixed;top:45%;left:10%;right:10%;text-align:center;font-size:42pt;color:rgba(220,40,40,.12);transform:rotate(-18deg);font-weight:900;z-index:99}' : '') +
    '</style></head><body>' +
    /* v84.1: راهنمای تنظیم چاپ — نوارها فقط با Margins:None سرتاسر می‌شوند و «1/1» مرورگر با خاموش کردن Headers می‌رود */
    '<div class="prnhint" style="position:fixed;top:8mm;left:0;right:0;background:#0c4a6e;color:#fff;font-family:Tahoma;font-size:12px;padding:8px 14px;text-align:center;direction:rtl;z-index:9999">⚙️ در پنجره چاپ: <b>Margins = None</b> و <b>Headers and footers = خاموش</b> — تا نوارهای رنگی سرتاسر لبه‌ها بیفتند و شماره صفحه مرورگر حذف شود</div>' +
    '<style>@media print{.prnhint{display:none}}</style>' +
    '<div class="bar-top"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>' +
    '<div class="hd">' +
    /* v87: نامه EN → لوگوی انگلیسی (بدون متن فارسی) */
    '<img src="../assets/images/' + (isEn ? 'ptf-logo.png' : 'ptf-logo-full.png') + '" alt="PTF">' +
    // v85.2: سه فیلد دقیقاً زیر هم و هم‌راستا (فا: راست‌چین / EN: چپ‌چین) + ارقام مطابق زبان
    (isEn
      ? '<div class="flds">' +
        '<div class="row"><span class="lb">Date:</span><b dir="ltr">' + escP(l.tEn || new Date().toISOString().slice(0, 10)) + '</b></div>' +
        '<div class="row"><span class="lb">Ref No.:</span><b dir="ltr">' + escP(l.no || (isPreview ? '— after signing —' : '')) + '</b></div>' +
        '<div class="row"><span class="lb">Encl.:</span><b>' + escP((!l.att || l.att === 'ندارد') ? 'None' : l.att) + '</b></div></div>'
      : '<div class="flds">' +
        '<div class="row"><span class="lb">تاریـخ :</span><b>' + letFaDigits(escP(l.t || faDate())) + '</b></div>' +
        '<div class="row"><span class="lb">شمـاره :</span><b>' + letFaDigits(escP(l.no || (isPreview ? '— پس از ثبت —' : ''))) + '</b></div>' + /* v85.3: شماره فارسی RTL */
        '<div class="row"><span class="lb">پیوست :</span><b>' + escP(l.att || 'ندارد') + '</b></div></div>') +
    /* v87: سربرگ EN → لوگوی انگلیسی */
    '</div>' +
    '<div class="content">' +
    (l.bsm !== false && !isEn ? '<div class="bsm">بسمه تعالی</div>' : '') +
    '<div class="to">' + (isEn ? 'To: ' : '') + escP(l.to) + '</div>' +
    (l.toRole ? '<div class="torl">' + escP(l.toRole) + '</div>' : '') + /* v123.1: سمت — دقیقا زیر نام */
    '<div class="sub">' + (isEn ? 'Subject: ' : 'موضوع: ') + escP(l.subject) + '</div>' +
    '<div class="body">' + (l.bodyHtml ? letSafeBodyHtml(l.bodyHtml) : escP(l.body).replace(/\n/g, '<br>')) + '</div>' +
    ((l.images && l.images.length) ? '<div class="limgs">' + l.images.map(function (im) {
      return '<figure><img src="' + im.src + '" alt="">' + (im.cap ? '<figcaption>' + escP(im.cap) + '</figcaption>' : '') + '</figure>';
    }).join('') + '</div>' : '') +
    '<div class="sig"><div class="sigbox">' +
    '<div class="salute">' + (isEn ? 'Yours Sincerely,' : 'با تجدید احترام') + '</div>' +
    /* v93: نامه EN → نام و سمت امضاکننده به انگلیسی */
    '<div class="nm">' + escP(isEn ? letSignerEn(l) : (l.signerNm || (sigProfiles()[curSession().user] || {}).nm || curSession().name || '')) + '</div>' +
    '<div class="rl">' + escP(isEn ? (l.signerRoleEn || letRoleEn(l)) : (l.signerRole || (sigProfiles()[curSession().user] || {}).role || '')) + '</div>' +
    (sigP.sig ? '<img class="s" src="' + sigP.sig + '" alt="امضا">' : '') +
    (sigP.stamp ? '<img class="st" src="' + sigP.stamp + '" alt="مهر">' : '') +
    '</div></div></div>' +
    '<div class="ft">' +
    // v85.2: فوتر مطابق زبان سربرگ
    (isEn
      ? '<div class="ln en"><svg viewBox="0 0 24 24" fill="none" stroke="#4b5057" stroke-width="1.8"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><span dir="ltr">Unit 1, 16th Floor, Block A, Tooba Complex, Koohak Blvd., Tehran, Iran</span></div>' +
        '<div class="ln en"><svg viewBox="0 0 24 24" fill="none" stroke="#4b5057" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg><span dir="ltr">+98 21 4608 7679</span></div>'
      : '<div class="ln"><svg viewBox="0 0 24 24" fill="none" stroke="#4b5057" stroke-width="1.8"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><span>تهـــران، بلـوار کوهــک، مجتمــع تجــاری اداری طوبـــی، بلــوک A اداری، طبقــه ۱۶، واحــد ۱</span></div>' +
        /* v87: آیکون تلفن به سمت چپِ شماره (بعد از span در RTL) */
        '<div class="ln"><span dir="ltr">(+۹۸)۲۱ ۴۶۰۸۷۶۷۹</span><svg viewBox="0 0 24 24" fill="none" stroke="#4b5057" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z"/></svg></div>') +
    '<div class="ln en"><span style="display:flex;align-items:center;gap:2mm"><svg viewBox="0 0 24 24" fill="none" stroke="#4b5057" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg><span dir="ltr">www.pishtaj.ir</span></span>' +
    '<span style="display:flex;align-items:center;gap:2mm"><svg viewBox="0 0 24 24" fill="none" stroke="#4b5057" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg><span dir="ltr">info@pishtaj.ir</span></span></div>' +
    '</div>' +
    '<div class="bar-bot"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>' +
    '</body></html>';
  if (typeof ptfPreviewPrintableDoc === 'function') ptfPreviewPrintableDoc((isEn ? 'Letter' : 'نامه') + ' — ' + escP(l.no || 'preview'), fullHtml, l.no || 'letter');
  else {
    var w = window.open('', '_blank');
    w.document.write(fullHtml);
    w.document.close();
  }
}

/* ---------- روتینگ ---------- */
(function () {
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'let') {
      var r = roleDef();
      if (!(r.panels === '*' || r.panels.indexOf('deals') > -1 || r.panels.indexOf('cart') > -1)) { alert('⛔ دسترسی ندارید'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '✉️ مکاتبات';
      document.getElementById('panels').innerHTML = buildLetters();
      renderLetters();
      return;
    }
    _go(id, btn);
  };
})();

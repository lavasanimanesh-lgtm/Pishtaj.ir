window.ptfOnClickArg = function (v) {
  /* SEC-01 (v34.0.6-alpha): escape امن براي آرگومان‌هاي رشتهٔ JS درون هندلرهاي inline.
     escP() فقط HTML-escape مي‌کند و تک‌کوتيشن را در لابهٔ JS مي‌سازد؛ چون HTML-entityها
     پيش از پارسِ JS ديکد مي‌شوند، XSS ذخيره‌شده در onclick="fn(...)" را نمي‌بندد.
     اين تابع در لابهٔ JS (بک‌اسلش و تک‌کوتيشن ← با HTML-decode حفظ مي‌شوند) و سپس در
     لابهٔ HTML-attribute (& < > ") escape مي‌کند؛ جايگزين امن escP در آرگومان هندلرهاست. */
  return String(v == null ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
/* =====================================================================
   PTF CRM — Sprint 77 (ui-kit.js)
   US-153: کامپوننت‌های استاندارد تعامل — جایگزین prompt/alert
   API:
     ptfDialog({title, fields:[{id,label,type,value,placeholder,options,required}], okText, danger, onOk(values)})
     ptfAsk(title, fields, cb)              — میانبر
     ptfToast(msg, kind)                    — kind: ok|warn|err|info
     ptfConfirm(title, body, onYes, danger) — تایید استاندارد
   ===================================================================== */
(function () {
  'use strict';

  var css = document.createElement('style');
  css.textContent =
    '.ptfdlg-b{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:3200;display:grid;place-items:center;padding:16px;animation:ptffade .15s}' +
    '@keyframes ptffade{from{opacity:0}to{opacity:1}}' +
    '.ptfdlg{background:#fff;border-radius:18px;padding:20px 22px;width:min(460px,94vw);max-height:90vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.3);animation:ptfpop .18s}' +
    '@keyframes ptfpop{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}' +
    '.ptfdlg h3{margin:0 0 12px;font-size:15.5px;color:#1e293b}' +
    '.ptfdlg .fld{margin-bottom:10px}' +
    '.ptfdlg label{display:block;font-size:12.5px;font-weight:800;color:#475569;margin-bottom:4px}' +
    '.ptfdlg input,.ptfdlg select,.ptfdlg textarea{width:100%;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:13.5px;box-sizing:border-box}' +
    '.ptfdlg input:focus,.ptfdlg select:focus,.ptfdlg textarea:focus{outline:none;border-color:#f79400}' +
    '.ptfdlg .err{color:#dc2626;font-size:11.5px;margin-top:3px;display:none}' +
    '.ptfdlg .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}' +
    '.ptfdlg button{font-family:inherit;font-weight:800;font-size:13px;border:0;border-radius:11px;padding:9px 18px;cursor:pointer}' +
    '.ptfdlg .ok{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff}' +
    '.ptfdlg .ok.danger{background:#dc2626}' +
    '.ptfdlg .cancel{background:#f1f5f9;color:#334155}' +
    '.ptftoast{position:fixed;bottom:calc(20px + var(--ptf-unsaved-banner-offset,0px));left:50%;transform:translateX(-50%);z-index:10000;background:#1e293b;color:#fff;border-radius:14px;padding:11px 20px;font-size:13.5px;font-weight:800;box-shadow:0 12px 34px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px;animation:ptfup .25s;max-width:90vw;box-sizing:border-box}' +
    /* MOB-004: toast پایین در 320px مستقیماً روی bottom-nav می‌افتاد. offset
       بنر پایدار sync از CSS variable می‌آید تا در صورت نمایش هم‌زمان، دو notice
       روی هم هم قرار نگیرند. toast عملیاتی نیست؛ لمس باید به کنترل زیر آن برسد. */
    '@media(max-width:768px), (max-width:900px) and (max-height:600px) and (orientation:landscape){.ptftoast{bottom:calc(74px + env(safe-area-inset-bottom,0px) + 12px + var(--ptf-unsaved-banner-offset,0px));max-width:calc(100vw - 24px);pointer-events:none}}' +
    '@media(max-width:900px) and (max-height:600px) and (orientation:landscape){.ptftoast{bottom:calc(52px + env(safe-area-inset-bottom,0px) + 12px + var(--ptf-unsaved-banner-offset,0px))}}' +
    /* animation عمودی نباید notice تازه را موقتاً به سمت bottom-nav هل بدهد. */
    '@keyframes ptfup{from{opacity:0}to{opacity:1}}' +
    '.ptftoast.ok{background:#059669}.ptftoast.err{background:#dc2626}.ptftoast.warn{background:#d97706}';
  document.head.appendChild(css);

  window.ptfDialog = function (opt) {
    var old = document.querySelector('.ptfdlg-b');
    if (old) old.remove();
    var b = document.createElement('div');
    b.className = 'ptfdlg-b';
    var fieldsHtml = (opt.fields || []).map(function (f, i) {
      var inner;
      var v = f.value != null ? String(f.value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') : '';
      if (f.type === 'select' && f.optionsHtml) {
        // v84: گزینه‌های آماده HTML (برای مقایسه قیمت خرید)
        inner = '<select id="ptfF' + i + '">' + f.optionsHtml + '</select>';
      } else if (f.type === 'select') {
        inner = '<select id="ptfF' + i + '">' + (f.options || []).map(function (o) {
          var val = typeof o === 'object' ? o.v : o;
          var lb = typeof o === 'object' ? o.lb : o;
          return '<option value="' + String(val).replace(/"/g, '&quot;') + '"' + (val === f.value ? ' selected' : '') + '>' + lb + '</option>';
        }).join('') + '</select>';
      } else if (f.type === 'textarea') {
        inner = '<textarea id="ptfF' + i + '" rows="' + (f.rows || 3) + '" placeholder="' + (f.placeholder || '') + '">' + v + '</textarea>';
      } else if (f.type === 'number') {
        /* v19.6 (US-438): پیش‌فرض فیلد عددی در دیالوگ = money formatter.
           اما چند باگ واقعی کارفرما نشان داد بعضی فیلدهای عددی کوتاه/درصدی/نرخی
           در بعضی موبایل‌ها با formatter دچار caret-reverse می‌شوند (مثل 15 → 51).
           بنابراین از این پس می‌توان روی هر فیلد عددی، money=false گذاشت تا ورودی plain numeric
           بدون data-money رندر شود ولی در onOk همچنان با ptfNum پارس شود. */
        if (f.money === false) {
          inner = '<input id="ptfF' + i + '" type="text" inputmode="numeric" value="' + v + '" placeholder="' + (f.placeholder || '') + '" autocomplete="off" spellcheck="false" style="direction:ltr' + (f.dir && f.dir !== 'ltr' ? ';direction:' + f.dir : '') + '">';
        } else {
          inner = '<input id="ptfF' + i + '" type="text" inputmode="numeric" data-money="1"' + (f.nohint ? ' data-nohint="1"' : '') + ' value="' + v + '" placeholder="' + (f.placeholder || '') + '" autocomplete="off" spellcheck="false" style="direction:ltr' + (f.dir && f.dir !== 'ltr' ? ';direction:' + f.dir : '') + '">';
        }
      } else if ((f.datePicker || (f.type === 'date' && f.gregorian !== true)) && typeof window.ptfDatePicker === 'function') {
        /* قرارداد تاریخ دیالوگ:
           - datePicker:true مقدار شمسی legacy را برمی‌گرداند.
           - type:date در UI فارسی/شمسی است ولی هنگام onOk به ISO تبدیل می‌شود.
           - gregorian:true opt-out صریح و تنها مسیر native میلادی است. */
        inner = window.ptfDatePicker('ptfF' + i, f.value || '', f.placeholder || '۱۴۰۵/۰۴/۰۱');
      } else if (f.type === 'month' && window.DateKit && typeof window.DateKit.monthPicker === 'function') {
        inner = window.DateKit.monthPicker('ptfF' + i, f.value || '', { allowEmpty: !!f.allowEmpty });
      } else if (f.type === 'year' && window.DateKit && typeof window.DateKit.yearPicker === 'function') {
        inner = window.DateKit.yearPicker('ptfF' + i, f.value || '', { allowEmpty: !!f.allowEmpty });
      } else if (f.upload || f.type === 'upload') {
        /* آپلود فایل داخل دیالوگ (مثل پیوست گردش حساب بانک در ارجاع تنخواه) — ویجت بعد از append ساخته می‌شود */
        inner = '<div id="ptfF' + i + '" style="min-height:44px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div>';
      } else {
        inner = '<input id="ptfF' + i + '" type="' + (f.type || 'text') + '" value="' + v + '" placeholder="' + (f.placeholder || '') + '"' + (f.dir ? ' style="direction:' + f.dir + '"' : '') + '>';
      }
      return '<div class="fld"><label>' + f.label + (f.required ? ' *' : '') + '</label>' + inner + '<div class="err" id="ptfE' + i + '">این فیلد الزامی است</div></div>';
    }).join('');
    b.innerHTML = '<div class="ptfdlg">' +
      '<h3>' + opt.title + '</h3>' +
      (opt.body ? '<div style="font-size:13px;color:#475569;line-height:1.9;margin-bottom:10px">' + opt.body + '</div>' : '') +
      fieldsHtml +
      '<div class="acts"><button class="cancel">انصراف</button>' +
      '<button class="ok' + (opt.danger ? ' danger' : '') + '">' + (opt.okText || 'تایید') + '</button></div></div>';
    document.body.appendChild(b);
    /* مقدار اولیه داخل خود DateKit نرمال می‌شود؛ overwrite مستقیم اینجا ممنوع است چون
       مقدار ISO را دوباره روی input شمسی می‌نوشت و ظاهر/قرارداد را ناسازگار می‌کرد. */
    /* آپلودهای داخل دیالوگ: ویجت attachUploadWidget را روی هر فیلد upload سوار کن */
    var dlgUploads = {};
    (opt.fields || []).forEach(function (f, i) {
      if (f.upload || f.type === 'upload') {
        var files = [];
        dlgUploads[f.id] = files;
        try {
          if (typeof attachUploadWidget === 'function') {
            attachUploadWidget('ptfF' + i, f.uploadFolder || 'uploads/', function (fr) { if (fr) files.push(fr); });
          }
        } catch (eU) { console.error('ptfDialog upload', eU); }
      }
    });
    b.addEventListener('click', function (e) { if (e.target === b) b.remove(); });
    b.querySelector('.cancel').onclick = function () { b.remove(); if (opt.onCancel) opt.onCancel(); };
    b.querySelector('.ok').onclick = function () {
      var values = {}, valid = true;
      (opt.fields || []).forEach(function (f, i) {
        var el = document.getElementById('ptfF' + i);
        var val = (el.value || '').trim();
        var errEl = document.getElementById('ptfE' + i);
        if (f.required && !val) { errEl.style.display = 'block'; valid = false; }
        else errEl.style.display = 'none';
        if (f.type === 'number') val = (typeof ptfNum === 'function') ? ptfNum(val) : (+String(val).replace(/[^\d.-]/g, '') || 0);
        /* type:date فقط قرارداد ذخیرهٔ ISO را حفظ می‌کند؛ UI و دریافت کاربر شمسی است.
           datePicker:true عمداً شمسی باقی می‌ماند تا callerهای قدیمی نشکنند. */
        if (f.type === 'date' && f.gregorian !== true && !f.datePicker && val) {
          if (window.DateKit && typeof window.DateKit.jNormalize === 'function' && window.DateKit.jNormalize(val)) val = window.DateKit.jToIso(val) || val;
          else if (typeof window.ptfJToISO === 'function' && /^\s*(?:13|14)\d{2}[\/-]/.test(val)) val = window.ptfJToISO(val) || val;
        }
        if (f.upload || f.type === 'upload') val = dlgUploads[f.id] || [];
        values[f.id] = val;
      });
      if (!valid) return;
      b.remove();
      if (opt.onOk) opt.onOk(values);
    };
    // فوکوس فیلد اول + Enter=تایید
    var first = b.querySelector('input:not([type="hidden"]),select,textarea,button.ptf-period-trigger');
    if (first) setTimeout(function () { first.focus(); }, 60);
    b.addEventListener('keydown', function (e) {
      /* Enter روی دکمه‌های picker باید همان picker را باز/هدایت کند، نه اینکه
         دیالوگ را زودتر از انتخاب تاریخ submit کند. */
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') b.querySelector('.ok').click();
      if (e.key === 'Escape') b.remove();
    });
  };

  window.ptfAsk = function (title, fields, cb) {
    ptfDialog({ title: title, fields: fields, onOk: cb });
  };

  window.ptfConfirm = function (title, body, onYes, danger) {
    ptfDialog({ title: title, body: body, okText: danger ? 'بله، انجام بده' : 'تایید', danger: !!danger, onOk: onYes });
  };

  window.ptfToast = function (msg, kind) {
    var old = document.querySelector('.ptftoast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'ptftoast ' + (kind || 'info');
    /* toast فقط اطلاع‌رسانی است؛ به‌خصوص در موبایل نباید لمس bottom-nav را ببلعد. */
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', kind === 'err' || kind === 'warn' ? 'assertive' : 'polite');
    t.setAttribute('aria-atomic', 'true');
    var icons = { ok: '✅', err: '❌', warn: '⚠️', info: 'ℹ️' };
    t.innerHTML = '<span>' + (icons[kind] || icons.info) + '</span><span>' + msg + '</span>';
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 450); }, 3600);
  };
})();

/* v34.4.41: قرارداد سراسری نام خروجی چاپ/PDF. مرورگر نام پیش‌فرض Save as PDF
   را از document.title می‌گیرد؛ پس همهٔ پیش‌نمایش‌ها باید یک نام امن و سندمحور داشته باشند. */
window.ptfPdfFileName = function (parts) {
  var raw = Array.isArray(parts) ? parts : [parts];
  var name = raw.map(function (v) { return String(v == null ? '' : v).trim(); }).filter(Boolean).join('__');
  name = name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, '_');
  name = name.replace(/_{3,}/g, '__').replace(/-{2,}/g, '-').replace(/^[._-]+|[._-]+$/g, '');
  return (name || 'document').slice(0, 180);
};
window.ptfPdfHtmlWithTitle = function (html, fileName) {
  var out = String(html || ''), name = window.ptfPdfFileName(fileName);
  var safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  if (/<title[\s>]/i.test(out)) return out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '<title>' + safe + '</title>');
  if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, '<title>' + safe + '</title></head>');
  if (/<html[^>]*>/i.test(out)) return out.replace(/<html([^>]*)>/i, '<html$1><head><title>' + safe + '</title></head>');
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + safe + '</title></head><body>' + out + '</body></html>';
};
window.ptfOfferPdfFileName = function (offer) {
  offer = offer || {};
  var parts = [offer.no || (offer.kind === 'TO' ? 'technical-offer' : 'commercial-offer')];
  var requestNo = '', linkedRequest = null;
  try {
    if (offer.inqNo && typeof getData === 'function') {
      linkedRequest = (getData('ptf_crm_rfqs') || []).filter(function (r) { return r && (r.cd === offer.inqNo || r.inqNo === offer.inqNo); })[0] || null;
    }
    /* رکورد جاری: فقط شمارهٔ واقعی کارفرما (متفاوت از cd سیستمی)؛
       سند legacy بدون رکورد والد: همان ref ذخیره‌شده حفظ می‌شود. */
    if (linkedRequest) requestNo = linkedRequest.inqNo && linkedRequest.inqNo !== linkedRequest.cd ? linkedRequest.inqNo : '';
    else requestNo = typeof ptfInqClientNo === 'function' ? ptfInqClientNo(offer.inqNo) : (offer.inqNo || '');
  } catch (eReq) { requestNo = offer.inqNo || ''; }
  if (requestNo && parts.indexOf(requestNo) < 0) parts.push(requestNo);
  return window.ptfPdfFileName(parts);
};

/* v31.7.19 US-PDF-NAME: چاپ با عنوان سنددار — نام پیش‌فرض PDF مرورگر از document.title می‌آید.
   قبلاً چاپ‌های داخل صفحه اصلی با عنوان «CRM | سامانه مدیریت | پیشرو تجهیز فرتاک» ذخیره می‌شدند
   و اسناد قابل تمایز نبودند. این helper عنوان را موقتاً به شناسه سند تغییر می‌دهد و برمی‌گرداند. */
window.ptfPrintWithTitle = function (docTitle) {
  var prev = document.title;
  try { if (docTitle) document.title = window.ptfPdfFileName(docTitle); } catch (e) {}
  var restore = function () { try { document.title = prev; } catch (e2) {} window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  setTimeout(restore, 4000); /* fallback مرورگرهایی که afterprint نمی‌دهند */
  try { window.print(); } catch (e3) { restore(); }
};

/* ===== v31.7.25 BUG-AUTH-007 (گزارش کارفرما: پیامک → Authentication required) =====
   بازمانده incident v31.7.4: هات‌فیکس JWT فقط bridge.js/sync.js را پوشش داد؛
   sms.js/backup.js/golive.js/rbac.js هنوز بدون X-CRM-Token می‌فرستادند → 401.
   رفع ریشه‌ای (پایان این خانواده باگ): wrapper سراسری fetch — هر درخواست به api/crm.php
   که X-CRM-Token ندارد، توکن JWT جاری را خودکار می‌گیرد. ماژول‌های آینده هم ایمن‌اند. */
(function () {
  if (window._ptfFetchTokWrapped || typeof window.fetch !== 'function') return;
  window._ptfFetchTokWrapped = true;
  var _fetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      if (url.indexOf('api/crm.php') > -1) {
        var tok = localStorage.getItem('ptf_crm_token');
        if (tok) {
          init = init || {};
          var h = init.headers;
          if (h && typeof Headers !== 'undefined' && h instanceof Headers) {
            if (!h.has('X-CRM-Token')) h.set('X-CRM-Token', tok);
          } else {
            h = h || {};
            if (!h['X-CRM-Token'] && !h['x-crm-token']) h['X-CRM-Token'] = tok;
            init.headers = h;
          }
        }
      }
    } catch (e) {}
    return _fetch.call(this, input, init);
  };
})();

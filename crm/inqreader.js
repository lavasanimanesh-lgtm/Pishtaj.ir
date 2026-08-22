/* =====================================================================
   PTF CRM — inqreader.js — Sprint 86
   US-193: تغییر رمز عبور کاربران (+ادمین) | US-194: انقضای نشست ۸ ساعت
   US-195: خواندن فایل استعلام درخواست + تشخیص تایپ + خروجی قالب شرکت
           + ورود به ماژول کالا با مارک مخفی + فراخوانی هوشمند در TO/CO
   ===================================================================== */
(function () {
  'use strict';

  /* ============ US-194: انقضای نشست پس از ۸ ساعت عدم فعالیت ============ */
  var IDLE_MAX = 8 * 3600 * 1000;
  function touch() { try { localStorage.setItem('ptf_last_activity', String(Date.now())); } catch (e) {} }
  function idleCheck() {
    try {
      if (!localStorage.getItem('ptf_crm_session')) return;
      var last = +localStorage.getItem('ptf_last_activity') || Date.now();
      if (Date.now() - last > IDLE_MAX) {
        localStorage.removeItem('ptf_crm_session');
        /* v34.7.89 (AUTH-TOKEN-REQUIRED): همراه نشست، توکن و نقش هم حذف شوند تا
           حالت ناهماهنگ «session نیست ولی token هست» باقی نماند و ورود مجدد به
           «توکن معتبر وجود ندارد» نخورد. */
        localStorage.removeItem('ptf_crm_token');
        localStorage.removeItem('ptf_crm_token_role');
        alert('⏳ نشست شما به دلیل ۸ ساعت عدم فعالیت منقضی شد.\nلطفاً دوباره وارد شوید.');
        location.reload();
      }
    } catch (e) {}
  }
  ['click', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, touch, { passive: true }); });
  touch();
  idleCheck();                       // هنگام باز شدن صفحه
  setInterval(idleCheck, 5 * 60000); // هر ۵ دقیقه

  /* ============ US-193: تغییر رمز عبور ============ */
  window.ptfChangePassDialog = function () {
    ptfDialog({
      title: '🔑 تغییر رمز عبور',
      fields: [
        { id: 'cur', label: 'رمز فعلی', type: 'password', required: true },
        { id: 'n1', label: 'رمز جدید (حداقل ۶ کاراکتر)', type: 'password', required: true },
        { id: 'n2', label: 'تکرار رمز جدید', type: 'password', required: true }
      ],
      okText: 'تغییر رمز',
      onOk: function (v) {
        if (v.n1.length < 6) { alert('رمز جدید حداقل ۶ کاراکتر'); return; }
        if (v.n1 !== v.n2) { alert('تکرار رمز مطابقت ندارد'); return; }
        var me = curSession().user;
        sha256Hex(v.cur).then(function (curH) {
          sha256Hex(v.n1).then(function (newH) {
            if (me === 'admin') {
              // ادمین: هش override در settings (سینک‌شونده بین دستگاه‌ها)
              var st = {};
              try { st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}'); } catch (e) {}
              var effective = st.adminHash || (typeof ADMIN_HASH !== 'undefined' ? ADMIN_HASH : '');
              if (curH !== effective) { alert('❌ رمز فعلی اشتباه است'); return; }
              st.adminHash = newH;
              setData('ptf_crm_settings', st);
            } else {
              var users = getData('ptf_crm_users');
              var u = users.filter(function (x) { return x.username === me; })[0];
              if (!u) { alert('کاربر یافت نشد'); return; }
              if (u.passhash !== curH) { alert('❌ رمز فعلی اشتباه است'); return; }
              u.passhash = newH;
              delete u.mustChangePass; /* v14.5 (US-376): رمز موقت تغییر کرد — الزام برداشته شد */
              setData('ptf_crm_users', users);
              if (typeof usersSyncToServer === 'function') usersSyncToServer(); // ورود از همه دستگاه‌ها
            }
            audit('کاربران', 'تغییر رمز عبور توسط خود کاربر', me);
            if (typeof ptfToast === 'function') ptfToast('✅ رمز عبور تغییر کرد', 'ok');
          });
        });
      }
    });
  };
  // US-299 (v123.2): دکمه از پایین سایدبار حذف شد — باکس «امنیت حساب» در منوی تنظیمات
  (function injectPassBox() {
    function box() {
      return '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
        '<h4 style="margin:0 0 8px">🔐 امنیت حساب (US-193)</h4>' +
        '<div style="background:var(--crd,#f8fafc);border:1px solid var(--brd);border-radius:12px;padding:12px 14px;font-size:12.5px;margin-bottom:10px">رمز عبور فقط برای حساب خودتان تغییر می‌کند و بلافاصله روی همه دستگاه‌ها اعمال می‌شود.</div>' +
        '<button class="bt bt-o" onclick="ptfChangePassDialog()">🔑 تغییر رمز عبور</button>';
    }
    function hook() {
      var _bs = window.buildSettings;
      if (typeof _bs !== 'function') { setTimeout(hook, 500); return; }
      window.buildSettings = function () { return _bs() + '<div style="max-width:560px">' + box() + '</div>'; };
    }
    hook();
  })();

  /* ============ US-195: تشخیص تایپ کالا از شرح ============ */
  // توجه: \b جاوااسکریپت با حروف فارسی کار نمی‌کند → واژه‌های فارسی بدون \b
  var TYPE_RULES = [
    ['Pipe', /(\bpipe\b|لوله)/i], ['Elbow', /(\belbow\b|زانو)/i], ['Tee', /(\btee\b|سه ?راه)/i],
    ['Reducer', /(\breducer\b|تبدیل)/i], ['Cap', /(\bcap\b|درپوش)/i], ['Flange', /(\bflange\b|فلنج)/i],
    ['Gasket', /(\bgasket\b|گسکت|واشر)/i], ['Bolt & Nut', /(\bbolt\b|\bnut\b|\bstud\b|پیچ|مهره)/i],
    ['Instrument', /(\btransmitter\b|\bgauge\b|\bindicator\b|\bmanometer\b|ترانسمیتر|گیج|ابزار ?دقیق|فشارسنج|دماسنج)/i],
    ['Valve', /(\bvalve\b|شیر|ولو)/i], ['Pump', /(\bpump\b|پمپ)/i],
    ['Cable', /(\bcable\b|کابل|سیم)/i], ['Electrical', /(\bmotor\b|\bpanel\b|الکتروموتور|تابلو|برق)/i],
    ['Plate/Sheet', /(\bplate\b|\bsheet\b|ورق)/i], ['Beam/Profile', /(\bbeam\b|\bprofile\b|تیرآهن|نبشی|ناودانی|قوطی)/i],
    ['Fitting', /(\bfitting\b|\bcoupling\b|\bunion\b|\bnipple\b|بوشن|مغزی|اتصال)/i],
    ['Strainer', /(\bstrainer\b|صافی|فیلتر)/i], ['Hose', /(\bhose\b|شیلنگ)/i]
  ];
  window.ptfDetectType = function (desc) {
    var s = String(desc || '');
    for (var i = 0; i < TYPE_RULES.length; i++) if (TYPE_RULES[i][1].test(s)) return TYPE_RULES[i][0];
    return 'Other';
  };

  /* ============ US-196 فاز۲: اتصال LLM (llm.php) ============ */
  var LLM_API = '../api/llm.php';
  var _llmOk = null, _llmOkAt = 0;
  /* ptfApiAuthHeaders در build واقعی تعریف نشده بود و fallback قبلی درخواست‌های
     llm.php/attachment-read.php را بدون JWT می‌فرستاد؛ نتیجه 401 برای «برخی فایل‌ها»
     و مخفی ماندن دکمه AI بود. این helper مستقل همیشه توکن نشست را می‌فرستد. */
  function irAuthHeaders(json) {
    if (typeof ptfStorageAuthHeaders === 'function') return ptfStorageAuthHeaders(!!json);
    var h = json ? { 'Content-Type': 'application/json' } : {};
    try { var token = localStorage.getItem('ptf_crm_token'); if (token) h['X-CRM-Token'] = token; } catch (e) {}
    return h;
  }
  window.ptfLlmStatus = function (cb) {
    // v88: کش فقط ۲ دقیقه — تا «سبز شدن تنظیمات» سریع در دکمه‌ها اثر کند
    if (_llmOk !== null && Date.now() - _llmOkAt < 120000) { cb(_llmOk); return; }
    fetch(LLM_API + '?action=status', { headers: irAuthHeaders(false) }).then(function (r) {
      return r.text().then(function (txt) { var d = {}; try { d = JSON.parse(txt); } catch (e) {} if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d; });
    }).then(function (d) { _llmOk = !!d.ok; _llmOkAt = Date.now(); cb(_llmOk); })
      .catch(function () { _llmOk = false; _llmOkAt = Date.now(); cb(false); });
  };
  function llmPost(action, body, cb) {
    fetch(LLM_API + '?action=' + action, {
      method: 'POST', headers: irAuthHeaders(true), body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (txt) { var d = {}; try { d = JSON.parse(txt); } catch (e) { d = { ok: false, error: 'پاسخ نامعتبر سرور AI' }; } if (!r.ok && !d.error) d.error = 'HTTP ' + r.status; return d; });
    }).then(cb).catch(function (e) { cb({ ok: false, error: (e && e.message) || 'عدم دسترسی به سرور' }); });
  }

  // ترجمه فنی (برای فرم TO/CO و هر جای دیگر)
  window.ptfLlmTranslate = function (text, dir, cb) { llmPost('translate', { text: text, dir: dir }, cb); };
  // شناسایی کالا (تایپ + برند «🤖 پیشنهادی»)
  window.ptfLlmIdentify = function (desc, cb) { llmPost('identify', { desc: desc }, cb); };

  /* ---------- OCR فایل استعلام در ویزارد 📖 ---------- */
  window.irOcrFile = function (inp) {
    var f = inp.files[0]; if (!f) return;
    if (typeof ptfToast === 'function') ptfToast('🤖 در حال خواندن فایل با هوش مصنوعی... (ممکن است تا یک دقیقه طول بکشد)', 'info');
    window.ptfExtractRfqFileWithAi(f, function (err, result) {
      if (err) { alert('❌ خواندن فایل ناموفق بود:\n' + err.message + '\n\nمی‌توانید از «ورود اکسل با راهنما»، پرامپت آماده یا ورود دستی استفاده کنید.'); return; }
      result.rows.forEach(function (row) { _ir.rows.push(row); });
      if (_ir.rows.length > 1 && !_ir.rows[0].nm) _ir.rows.shift();
      irRerender();
      alert('🤖 ' + result.rows.length + ' قلم با هوش مصنوعی خوانده شد.\n\n⚠️ حتماً همه ردیف‌ها را بازبینی و سپس ذخیره کنید.');
      try { audit('استعلامات', 'خواندن هوشمند فایل دستگاه برای ' + _ir.inqNo, result.rows.length + ' قلم'); } catch (e) {}
    });
    inp.value = '';
  };



  /* ============ v25.9: خواندن ضمیمه‌های همان درخواست با AI ============ */
  var _irAttPick = null;
  var IR_ATT_CATS = { inq: 'فایل‌های اولیه استعلام', ds: 'دیتاشیت فنی', img: 'عکس کالا', dwg: 'نقشه مهندسی', oth: 'سایر مدارک', cat: 'کاتالوگ سازنده' };

  function irFileExt(name) {
    var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
    return m ? m[1] : '';
  }
  function irFileSize(size) {
    size = +size || 0;
    if (!size) return '';
    return size < 1048576 ? Math.ceil(size / 1024) + 'KB' : (size / 1048576).toFixed(1) + 'MB';
  }
  function irAiKind(file) {
    var ext = irFileExt(file && file.name);
    var mime = String((file && (file.contentType || file.mimeType || file.type)) || '').toLowerCase();
    if (['pdf', 'jpg', 'jpeg', 'png', 'webp'].indexOf(ext) > -1 || ['application/pdf','image/jpeg','image/png','image/webp'].indexOf(mime) > -1) return 'vision';
    if (['xlsx', 'xls'].indexOf(ext) > -1 || /spreadsheet|excel/.test(mime)) return 'sheet';
    if (['docx', 'csv', 'txt', 'md'].indexOf(ext) > -1 || /^text\//.test(mime)) return 'text';
    return '';
  }
  function irAiKindLabel(kind) {
    return kind === 'vision' ? 'PDF/تصویر' : kind === 'sheet' ? 'Excel' : kind === 'text' ? 'متنی' : 'پشتیبانی‌نشده';
  }
  function irMimeFor(file, blob) {
    if (blob && blob.type) return blob.type;
    var ext = irFileExt(file && file.name);
    return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  }
  function irAllRequestAttachments(r) {
    var rows = typeof window.ptfRfqAttachmentRows === 'function' ? window.ptfRfqAttachmentRows(r) : [];
    if (!rows.length && r && r.files) {
      Object.keys(r.files).forEach(function (cat) { (Array.isArray(r.files[cat]) ? r.files[cat] : []).forEach(function (file) { rows.push({ cat: cat, source: 'files.' + cat, file: file }); }); });
    }
    return rows.map(function (row, index) {
      var cat = row.cat === 'root' ? 'legacy' : (row.cat || 'legacy'), file = row.file || {};
      return { cat: cat, catLabel: IR_ATT_CATS[cat] || (cat === 'legacy' ? 'پیوست قدیمی / سایت' : cat), index: index, source: row.source || '', file: file, kind: irAiKind(file) };
    });
  }
  function irAiSetStatus(html) {
    var el = document.getElementById('irAiAttachmentStatus');
    if (el) el.innerHTML = html || '';
  }
  function irFetchStoredBlob(file, cb) {
    if (!file || !file.key) { cb(new Error('این پیوست هنوز در صف محلی است یا کلید فضای ابری ندارد')); return; }
    fetch(STORAGE_API + '?action=presign_get', { method: 'POST', headers: irAuthHeaders(true), body: JSON.stringify({ key: file.key }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !d.url) throw new Error(d.error || 'لینک خواندن فایل دریافت نشد');
        return fetch(d.url);
      })
      .then(function (r) {
        if (!r.ok) throw new Error('دریافت فایل از فضای ابری ناموفق بود (HTTP ' + r.status + ')');
        return r.blob();
      })
      .then(function (blob) { cb(null, blob); })
      .catch(function (e) { cb(e || new Error('دریافت فایل ناموفق بود')); });
  }
  function irReadAttachmentText(file, cb) {
    if (!file || !file.key) { cb(new Error('این پیوست کلید فضای ابری ندارد')); return; }
    fetch('../api/attachment-read.php', { method: 'POST', headers: irAuthHeaders(true), body: JSON.stringify({ key: file.key, name: file.name }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !String(d.text || '').trim()) throw new Error(d.error || 'متن قابل خواندن از فایل دریافت نشد');
        cb(null, String(d.text));
      })
      .catch(function (e) { cb(e || new Error('خواندن متن پیوست ناموفق بود')); });
  }
  function irReadAttachmentBase64(file, cb) {
    if (!file || !file.key) { cb(new Error('این پیوست کلید فضای ابری ندارد')); return; }
    fetch('../api/attachment-read.php', { method: 'POST', headers: irAuthHeaders(true), body: JSON.stringify({ key: file.key, name: file.name, mode: 'base64' }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !d.b64) throw new Error(d.error || 'دادهٔ فایل برای AI دریافت نشد');
        cb(null, d);
      })
      .catch(function (e) { cb(e || new Error('دریافت امن فایل پیوست ناموفق بود')); });
  }
  function irBase64Blob(b64, mime) {
    var raw = atob(String(b64 || ''));
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'application/octet-stream' });
  }
  function irSpreadsheetToText(blob, file, cb) {
    var rd = new FileReader();
    rd.onerror = function () { cb(new Error('خواندن فایل اکسل ناموفق بود')); };
    rd.onload = function () {
      try {
        var wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
        var lines = [];
        wb.SheetNames.slice(0, 3).forEach(function (sheetName) {
          lines.push('Sheet: ' + sheetName);
          var rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' });
          rows.slice(0, 250).forEach(function (row) { lines.push((row || []).slice(0, 20).map(function (v) { return String(v || '').trim(); }).join(' | ')); });
        });
        var text = lines.filter(Boolean).join('\n').slice(0, 24000);
        if (!text.trim()) throw new Error('فایل اکسل دادهٔ قابل خواندن ندارد');
        cb(null, text);
      } catch (e) { cb(e instanceof Error ? e : new Error('پردازش فایل اکسل ناموفق بود')); }
    };
    rd.readAsArrayBuffer(blob);
  }
  function irNormalizeAiRows(data, sourceName) {
    var out = [];
    ((data && data.rows) || []).forEach(function (row) {
      var name = String(row.nm || row.name || '').trim();
      var spec = String(row.spec || row.st || '').trim();
      if (!name && spec.length < 3) return;
      out.push({ tp: row.tp || ptfDetectType(name + ' ' + spec), nm: name || spec, un: row.un || row.unit || 'عدد', qty: +row.qty || 1, spec: spec, brand: row.brand || '', model: row.model || '', aiSource: sourceName || '' });
    });
    return out;
  }
  function irAppendAiRows(data, sourceName) {
    var rows = irNormalizeAiRows(data, sourceName);
    rows.forEach(function (row) { _ir.rows.push(row); });
    if (_ir.rows.length > 1 && !_ir.rows[0].nm) _ir.rows.shift();
    return rows.length;
  }

  /* API واحد خواندن فایل از دستگاه برای درخواست فروش و درخواست تامین.
     MIME بعضی مرورگرها خالی/octet-stream است؛ نوع واقعی از پسوند نرمال می‌شود. */
  window.ptfExtractRfqFileWithAi = function (file, cb) {
    if (!file) { cb(new Error('فایلی انتخاب نشده است')); return; }
    var ext = irFileExt(file.name);
    var source = { name: file.name || 'file' };
    function doneFromResponse(d) {
      if (!d || !d.ok) { cb(new Error((d && d.error) || 'خواندن فایل با AI ناموفق بود')); return; }
      var rows = irNormalizeAiRows(d.data, source.name);
      if (!rows.length) { cb(new Error('AI هیچ قلم قابل ثبت از این فایل تشخیص نداد')); return; }
      cb(null, { rows: rows, meta: d.data || {}, sourceName: source.name });
    }
    if (['pdf', 'jpg', 'jpeg', 'png', 'webp'].indexOf(ext) > -1) {
      if (+file.size > 6 * 1048576) { cb(new Error('حجم PDF/تصویر برای AI بیش از ۶ مگابایت است؛ فایل را فشرده یا از اکسل راهنمادار استفاده کنید')); return; }
      var mimeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
      var visionReader = new FileReader();
      visionReader.onerror = function () { cb(new Error('خواندن فایل از دستگاه ناموفق بود')); };
      visionReader.onload = function () {
        var b64 = String(visionReader.result || '').split(',')[1] || '';
        if (!b64) { cb(new Error('داده فایل برای AI خالی است')); return; }
        llmPost('ocr', { mime: mimeMap[ext] || file.type || 'application/octet-stream', b64: b64 }, doneFromResponse);
      };
      visionReader.readAsDataURL(file);
      return;
    }
    if (['xlsx', 'xls'].indexOf(ext) > -1) {
      irSpreadsheetToText(file, source, function (err, text) {
        if (err) { cb(err); return; }
        llmPost('ocr_text', { text: String(text).slice(0, 24000), sourceName: source.name }, doneFromResponse);
      });
      return;
    }
    if (['csv', 'txt', 'md'].indexOf(ext) > -1) {
      var textReader = new FileReader();
      textReader.onerror = function () { cb(new Error('خواندن فایل متنی ناموفق بود')); };
      textReader.onload = function () {
        var text = String(textReader.result || '').trim();
        if (!text) { cb(new Error('فایل متنی خالی است')); return; }
        llmPost('ocr_text', { text: text.slice(0, 24000), sourceName: source.name }, doneFromResponse);
      };
      textReader.readAsText(file, 'utf-8');
      return;
    }
    cb(new Error('فرمت «' + (ext || 'نامشخص') + '» برای خواندن مستقیم AI پشتیبانی نمی‌شود؛ PDF، تصویر، Excel، CSV یا TXT انتخاب کنید'));
  };
  function irAiReadText(text, file, cb) {
    text = String(text || '').trim();
    if (!text) { cb(new Error('متن قابل خواندن برای AI خالی است')); return; }
    llmPost('ocr_text', { text: text.slice(0, 24000), sourceName: file.name || '' }, function (d) {
      if (!d.ok) { cb(new Error(d.error || 'خطا در تحلیل AI')); return; }
      var added = irAppendAiRows(d.data, file.name);
      cb(added ? null : new Error('AI قلم قابل ثبت از متن این فایل تشخیص نداد'), added);
    });
  }
  function irAiReadOneAttachment(choice, cb) {
    var file = choice.file;
    var kind = choice.kind;
    if (kind === 'vision') {
      irReadAttachmentBase64(file, function (err, data) {
        if (err) { cb(err); return; }
        llmPost('ocr', { mime: data.mime || irMimeFor(file), b64: data.b64 }, function (d) {
          if (!d.ok) { cb(new Error(d.error || 'خطا در خواندن AI')); return; }
          var added = irAppendAiRows(d.data, file.name);
          cb(added ? null : new Error('AI قلم قابل ثبت از این فایل تشخیص نداد'), added);
        });
      });
      return;
    }
    if (kind === 'sheet') {
      irReadAttachmentBase64(file, function (err, data) {
        if (err) { cb(err); return; }
        var blob;
        try { blob = irBase64Blob(data.b64, data.mime); } catch (e) { cb(new Error('تبدیل دادهٔ اکسل ناموفق بود')); return; }
        irSpreadsheetToText(blob, file, function (textErr, text) {
          if (textErr) { cb(textErr); return; }
          irAiReadText(text, file, cb);
        });
      });
      return;
    }
    if (kind === 'text') {
      irReadAttachmentText(file, function (err, text) {
        if (err) { cb(err); return; }
        irAiReadText(text, file, cb);
      });
      return;
    }
    cb(new Error('فرمت این فایل برای خواندن AI پشتیبانی نمی‌شود'));
  }
  /* onclickهای HTML پویا فقط به window دسترسی دارند؛ _ir داخل closure است. */
  window.irAiReadCurrentAttachments = function () {
    if (!_ir || !_ir.cd) { alert('ابتدا پنجره «خواندن فایل» همین درخواست را باز کنید'); return; }
    window.inqReadAttachmentAsk(_ir.cd);
  };
  window.inqReadAttachmentAsk = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var all = irAllRequestAttachments(r);
    var readable = all.filter(function (x) { return !!x.kind && !!x.file.key; });
    if (!readable.length) {
      alert(all.length ? 'هیچ‌یک از ضمایم کلید قابل خواندن در فضای ابری یا فرمت پشتیبانی‌شده ندارند. برای فایل‌های صف محلی ابتدا آپلود کامل شود.' : 'برای این درخواست ضمیمهٔ قابل خواندن ثبت نشده است.');
      return;
    }
    if (readable.length === 1) { window.inqReadAttachmentsByAi(cd, readable); return; }
    _irAttPick = { cd: cd, list: readable };
    var rows = all.map(function (x) {
      var pos = readable.indexOf(x);
      var enabled = pos > -1;
      return '<label style="display:flex;gap:8px;align-items:flex-start;padding:9px 6px;border-bottom:1px dashed var(--brd);cursor:' + (enabled ? 'pointer' : 'not-allowed') + ';opacity:' + (enabled ? '1' : '.55') + '">' +
        (enabled ? '<input type="checkbox" class="irAiAttChoice" value="' + pos + '" style="margin-top:3px">' : '<span style="width:13px"></span>') +
        '<span style="flex:1"><b>📄 ' + escP(x.file.name) + '</b><br><small style="color:#64748b">' + escP(x.catLabel) + ' · ' + irAiKindLabel(x.kind) + (irFileSize(x.file.size) ? ' · ' + irFileSize(x.file.size) : '') + (x.file.key ? '' : ' · در صف محلی') + '</small></span></label>';
    }).join('');
    var old = document.getElementById('irAiAttPick'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', '<div class="md-b" id="irAiAttPick" style="display:grid;z-index:' + (typeof window.ptfTopZIndex === 'function' ? window.ptfTopZIndex(3400) : 3400) + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:610px"><h3>🤖 انتخاب ضمیمه برای خواندن با AI</h3><div style="font-size:12.5px;line-height:1.9;color:#475569;margin-bottom:8px">چند ضمیمه موجود است. یک یا چند فایل را انتخاب کنید؛ فایل‌ها به‌ترتیب خوانده و اقلام استخراج‌شده برای بازبینی به جدول اضافه می‌شوند.</div><div style="max-height:48vh;overflow:auto;border:1px solid var(--brd);border-radius:10px;padding:4px 10px">' + rows + '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="document.getElementById(\'irAiAttPick\').remove()">انصراف</button><button class="bt" onclick="irAiAttachmentSelectionCommit()">🤖 خواندن فایل‌های انتخاب‌شده</button></div></div></div>');
  };
  window.irAiAttachmentSelectionCommit = function () {
    if (!_irAttPick) return;
    var selected = [];
    document.querySelectorAll('#irAiAttPick .irAiAttChoice:checked').forEach(function (el) { var i = +el.value; if (_irAttPick.list[i]) selected.push(_irAttPick.list[i]); });
    if (!selected.length) { alert('حداقل یک فایل را انتخاب کنید'); return; }
    var cd = _irAttPick.cd;
    var modal = document.getElementById('irAiAttPick'); if (modal) modal.remove();
    _irAttPick = null;
    window.inqReadAttachmentsByAi(cd, selected);
  };
  window.inqReadAttachmentsByAi = function (cd, choices) {
    if (!_ir || _ir.cd !== cd) { window.inqReadOpen(cd); }
    choices = (choices || []).filter(function (x) { return x && x.kind; });
    if (!choices.length) return;
    var done = [], failed = [];
    irAiSetStatus('<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:9px;padding:8px;color:#1d4ed8">⏳ آماده‌سازی ' + choices.length + ' ضمیمه برای خواندن با AI...</div>');
    (function next(i) {
      if (i >= choices.length) {
        irRerender();
        var msg = '🤖 خواندن ضمایم پایان یافت: ' + done.length + ' فایل موفق، ' + failed.length + ' فایل ناموفق؛ ' + done.reduce(function (n, x) { return n + x.count; }, 0) + ' قلم برای بازبینی اضافه شد.';
        if (failed.length) msg += '\n\nفایل‌های ناموفق:\n' + failed.map(function (x) { return '• ' + x.name + ': ' + x.error; }).join('\n');
        alert(msg);
        if (typeof audit === 'function') audit('استعلامات', 'خواندن AI ضمایم درخواست ' + (_ir.inqNo || cd), done.map(function (x) { return x.name; }).join('، '));
        return;
      }
      var choice = choices[i];
      irAiSetStatus('<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:9px;padding:8px;color:#1d4ed8">⏳ در حال خواندن فایل ' + (i + 1) + ' از ' + choices.length + ': <b>' + escP(choice.file.name) + '</b></div>');
      irAiReadOneAttachment(choice, function (err, count) {
        if (err) failed.push({ name: choice.file.name, error: err.message || String(err) });
        else done.push({ name: choice.file.name, count: count || 0 });
        next(i + 1);
      });
    })(0);
  };

  function rfqHasReadable(r) {
    return irAllRequestAttachments(r).some(function (x) { return !!x.kind && !!x.file.key; });
  }

  /* داده‌های قدیمی گاهی با شماره کارفرما (inqNo) و گاهی با کد داخلی (cd) ذخیره شده‌اند.
     تمام خواندن/نوشتن اقلام باید هر دو شناسه را یک درخواست واحد بداند. */
  function irRfqAliases(r, fallback) {
    var seen = {}, out = [];
    [fallback, r && r.cd, r && r.inqNo].forEach(function (v) {
      v = String(v || '').trim();
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    });
    return out;
  }
  function irAliasMatch(row, aliases) {
    if (!row) return false;
    return aliases.indexOf(String(row.inqNo || '').trim()) > -1 || aliases.indexOf(String(row.cd || '').trim()) > -1;
  }
  function irItemsForRfq(r, cd) {
    var aliases = irRfqAliases(r, cd);
    return getData('ptf_crm_inqitems').filter(function (x) { return irAliasMatch(x, aliases); });
  }
  function irClearReadSnapshots(aliases) {
    var all = getData('ptf_crm_inqreads');
    var kept = all.filter(function (x) { return !irAliasMatch(x, aliases); });
    if (kept.length !== all.length) setData('ptf_crm_inqreads', kept);
    return all.length - kept.length;
  }

  /* v31.7.44 BUG-INQ-ITEMS-001: اگر AI فایل ضمیمه را نخواند، کاربر باید بتواند
     هر زمان بعد از ثبت درخواست، اقلام را دستی یا با اکسل راهنمادار وارد کند. */
  window.ptfDownloadInqItemsTemplate = function () {
    var rows = [
      ['Description','Specification / Standard','Qty','Unit','Type','Brand','Model'],
      ['Control Valve 2 inch, Class 300','Body WCB, Trim SS316, Air to Close, IEC 60534',2,'NO','Valve','Fisher','ET'],
      ['Seamless Pipe 4 inch Sch 40','ASTM A106 Gr.B, ASME B36.10',12,'Meter','Pipe','','']
    ];
    var csv = '\uFEFF' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ptf-inquiry-items-template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 1000);
  };
  function irXlsRowToItem(c, idx) {
    c = (c || []).map(function (x) { return String(x == null ? '' : x).trim(); });
    if (idx === 0 && c.join(' ').toLowerCase().match(/description|شرح|qty|تعداد|spec/)) return null;
    var desc = c[0] || '';
    var spec = c[1] || '';
    var qty = +String(c[2] || '').replace(/[^\d.]/g, '') || 1;
    var un = c[3] || 'عدد';
    var tp = c[4] || (typeof ptfDetectType === 'function' ? ptfDetectType(desc + ' ' + spec) : 'Other');
    var brand = c[5] || '';
    var model = c[6] || '';
    if (!desc || desc.length < 2) return null;
    return { tp: tp, nm: desc, en: desc, st: spec, spec: spec, qty: qty, un: un, brand: brand, model: model };
  }
  window.ptfViewRfq = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var items = irItemsForRfq(r, cd);
    if (!items.length && r.items) items = r.items;
    var files = r.files || {};
    var fsum = Object.keys(files).map(function (k) { return (files[k] || []).length ? ('• ' + k + ': ' + (files[k] || []).length + ' فایل') : ''; }).filter(Boolean).join('<br>') || 'فایلی ثبت نشده';
    var itemRows = items.length ? items.slice(0, 12).map(function (it, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + escP(it.nm || it.name || '') + '</td><td>' + escP(it.st || it.spec || '') + '</td><td>' + escP(it.qty || 1) + '</td><td>' + escP(it.un || it.unit || 'عدد') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#94a3b8">قلمی ثبت نشده</td></tr>';
    var html = '<div class="md-b" style="display:grid;z-index:' + (typeof window.ptfTopZIndex === 'function' ? window.ptfTopZIndex() : 2600) + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>👁 مشاهده درخواست — ' + escP(r.cd) + '</h3>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:12px;font-size:12.5px;line-height:2;margin-bottom:12px">' +
      '<b>شرکت / مشتری:</b> ' + escP(r.co || '-') + '<br>' +
      '<b>رابط:</b> ' + escP(r.con || '-') + '<br>' +
      '<b>شماره RFQ داخلی:</b> <span dir="ltr">' + escP(r.cd || '-') + '</span>' +
      ((r.inqNo && String(r.inqNo).trim() !== String(r.cd || '').trim()) ? '<br><b>شماره درخواست کارفرما:</b> <span dir="ltr">' + escP(r.inqNo) + '</span>' : '') + '<br>' +
      '<b>حوزه:</b> ' + escP(r.ca || '-') + '<br>' +
      '<b>موضوع:</b> ' + escP(r.subj || '-') + '<br>' +
      '<b>تاریخ ثبت:</b> ' + escP(r.dt || '-') + '<br>' +
      '<b>وضعیت:</b> ' + escP(r.stxt || r.st || '-') +
      '</div>' +
      ((r.inqText || r.message || r.standard || r.vendors) ? '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;font-size:12.5px;line-height:2;margin-bottom:12px">' +
        (r.inqText ? '<div><b>شرح درخواست:</b><br>' + escP(r.inqText) + '</div>' : '') +
        (r.standard ? '<div style="margin-top:8px"><b>استاندارد / مشخصات:</b><br>' + escP(r.standard) + '</div>' : '') +
        (r.vendors ? '<div style="margin-top:8px"><b>برندها / سازندگان مطلوب:</b><br>' + escP(r.vendors) + '</div>' : '') +
        (r.message ? '<div style="margin-top:8px"><b>یادداشت تکمیلی:</b><br>' + escP(r.message) + '</div>' : '') +
      '</div>' : '') +
      '<div style="display:grid;grid-template-columns:1.3fr .7fr;gap:12px">' +
        '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><b style="display:block">اقلام درخواست (' + items.length + ')</b><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" style="font-size:11.5px;color:#7c3aed;border-color:#ddd6fe" onclick="this.closest(\'.md-b\').remove();ptfOpenFullInqEditor(\'' + ptfOnClickArg(cd) + '\')">افزودن/ویرایش اقلام</button><button class="bt bt-o" style="font-size:11.5px;color:#0e7490;border-color:#bae6fd" onclick="ptfDownloadInqItemsTemplate()">نمونه اکسل</button></span></div>' +
        (!items.length ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 10px;font-size:12px;color:#92400e;margin-bottom:8px">قلمی ثبت نشده است. اگر خواندن فایل با AI موفق نبود، از «افزودن/ویرایش اقلام» می‌توانید دستی یا با اکسل راهنمادار اقلام را وارد کنید.</div>' : '') +
        '<div class="tb2"><table><thead><tr><th>#</th><th>شرح</th><th>مشخصات</th><th>تعداد</th><th>واحد</th></tr></thead><tbody>' + itemRows + '</tbody></table></div>' + (items.length > 12 ? '<div style="font-size:11px;color:#94a3b8;margin-top:6px">فقط ۱۲ قلم اول نمایش داده شد</div>' : '') + '</div>' +
        '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px"><b style="display:block;margin-bottom:8px">📎 ضمایم</b><div style="font-size:12px;color:#475569;line-height:2">' + fsum + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="bt bt-o" style="font-size:11.5px" onclick="ptfManageInqAttachments(\'' + ptfOnClickArg(cd) + '\')">مدیریت ضمایم</button>' +
        (rfqHasReadable(r) ? '<button class="bt bt-o" style="font-size:11.5px;color:#7c3aed" onclick="inqReadOpen(\'' + ptfOnClickArg(cd) + '\')">خواندن فایل</button>' : '') + '</div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button><button class="bt" onclick="this.closest(\'.md-b\').remove();ptfOpenFullInqEditor(\'' + ptfOnClickArg(cd) + '\')">✏️ ویرایش</button></div>' +
    '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  // US-228 / OPS-003: پچ رندر استعلامات — HTML دکمه‌ها با DOM API (ضد quote-break)
  var _renderRfqOld = null;
  /* ساخت امن دکمه action در جدول درخواست — بدون الحاق شکنندهٔ onclick در رشته */
  function ptfRfqActionBtn(label, onClickName, cd, extraStyle, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ba rfq-ico-btn' + (extraClass ? (' ' + extraClass) : '');
    if (extraStyle) btn.setAttribute('style', extraStyle);
    var icos = { ptfViewRfq: '👁', editRfq: '✏️', ptfManageInqAttachments: '📎', inqReadOpen: '📖', ptfGoSalesFileForRfq: '📁', rfqShowFiles: '📎', rfqShowText: '📝', rfqEditText: '📝' };
    btn.textContent = icos[onClickName] || '•';
    /* در موبایل متن action پنهان و فقط آیکون نمایش داده می‌شود؛ نام قابل‌خواندن
       برای tooltip و screen reader باید روی خود دکمه بماند. */
    btn.setAttribute('title', label || 'عملیات درخواست');
    btn.setAttribute('aria-label', label || 'عملیات درخواست');
    btn.setAttribute('data-rfq-cd', cd || '');
    btn.setAttribute('data-rfq-action', onClickName || '');
    btn.addEventListener('click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var fn = window[onClickName];
      if (typeof fn === 'function') fn(cd);
    });
    return btn;
  }
  function ptfRfqEnsureViewBtn(tdEl, cd) {
    if (!tdEl) return;
    if (tdEl.querySelector('[data-rfq-action="ptfViewRfq"]') || (tdEl.innerHTML && tdEl.innerHTML.indexOf('ptfViewRfq') > -1)) return;
    var viewBtn = ptfRfqActionBtn('👁 مشاهده', 'ptfViewRfq', cd, 'color:#0f172a;font-weight:bold', '');
    if (tdEl.firstChild) tdEl.insertBefore(viewBtn, tdEl.firstChild);
    else tdEl.appendChild(viewBtn);
    // فاصله بصری بعد از دکمه مشاهده
    if (viewBtn.nextSibling) tdEl.insertBefore(document.createTextNode(' '), viewBtn.nextSibling);
    else tdEl.appendChild(document.createTextNode(' '));
  }
  function patchRenderRfq() {
    if (_renderRfqOld || typeof window.renderRfq !== 'function') return false;
    _renderRfqOld = window.renderRfq;
    window.renderRfq = function () {
      _renderRfqOld();
      try {
        var tb = document.getElementById('rTb');
        if (!tb) return;
        var rfqs = getData('ptf_crm_rfqs');
        var offers = getData('ptf_crm_offers');
        tb.querySelectorAll('tr').forEach(function (tr) {
          var strong = tr.querySelector('td strong');
          if (!strong) return;
          var cd = strong.textContent.trim();
          var r = rfqs.filter(function (x) { return x.cd === cd; })[0];
          if (!r) return;

          var offerAliases = irRfqAliases(r, cd);
          function offerMatchesRfq(o) { var v = String((o && (o.inqNo || o.srcRfq || '')) || '').trim(); return !!v && offerAliases.indexOf(v) > -1; }
          var hasOffer = offers.some(offerMatchesRfq);
          var wonOffer = offers.filter(function (o) { return offerMatchesRfq(o) && o.st === 'won'; })[0];
          var lastTd = tr.querySelectorAll('td');
          var tdEl = lastTd[lastTd.length - 1];
          if (!tdEl) return;

          // همیشه اول دکمه مشاهده را تضمین کن (عادی / دارای پیشنهاد / برنده)
          ptfRfqEnsureViewBtn(tdEl, cd);

          if (wonOffer) {
            // badges + actions تکمیلی بدون دست زدن به دکمه مشاهده
            if (tdEl.innerHTML.indexOf('منتقل') === -1 && tdEl.innerHTML.indexOf('قفل کامل') === -1) {
              var badge = document.createElement('span');
              badge.className = 'bd';
              badge.setAttribute('style', 'background:#fef3c7;color:#b45309;font-size:11px');
              badge.textContent = '🏆 منتقل‌شده به پروژه (قفل کامل)';
              tdEl.appendChild(document.createTextNode(' '));
              tdEl.appendChild(badge);
            }
            if (tdEl.innerHTML.indexOf("goPanel('prj')") === -1 && tdEl.innerHTML.indexOf('goPanel("prj")') === -1 && !tdEl.querySelector('[data-rfq-action="goPanelPrj"]') && !tdEl.querySelector('[data-rfq-action="ptfGoSalesFileForRfq"]')) {
              var prjBtn = document.createElement('button');
              prjBtn.type = 'button';
              prjBtn.className = 'ba';
              prjBtn.setAttribute('style', 'background:#7c3aed;color:#fff');
              prjBtn.setAttribute('title', 'مشاهده پرونده فروش');
              prjBtn.setAttribute('aria-label', 'مشاهده پرونده فروش');
              prjBtn.setAttribute('data-rfq-action', 'ptfGoSalesFileForRfq');
              prjBtn.textContent = '📁';
              prjBtn.addEventListener('click', function (ev) {
                if (ev && ev.stopPropagation) ev.stopPropagation();
                if (typeof window.ptfGoSalesFileForRfq === 'function') window.ptfGoSalesFileForRfq(cd);
                else if (typeof goPanel === 'function') goPanel('deals');
              });
              tdEl.appendChild(document.createTextNode(' '));
              tdEl.appendChild(prjBtn);
            }
            if (!tdEl.querySelector('[data-rfq-action="editRfq"]') && tdEl.innerHTML.indexOf('editRfq') === -1) {
              tdEl.appendChild(document.createTextNode(' '));
              tdEl.appendChild(ptfRfqActionBtn('✎ ویرایش', 'editRfq', cd, '', ''));
            }
          } else if (hasOffer) {
            if (tdEl.innerHTML.indexOf('مشخصات قفل') === -1) {
              var lockBadge = document.createElement('span');
              lockBadge.className = 'bd';
              lockBadge.setAttribute('style', 'background:#f1f5f9;color:#64748b;font-size:10.5px');
              lockBadge.textContent = '🔒 مشخصات قفل شد (پیشنهاد صادر شده)';
              tdEl.appendChild(document.createTextNode(' '));
              tdEl.appendChild(lockBadge);
            }
            if (!tdEl.querySelector('[data-rfq-action="editRfq"]') && tdEl.innerHTML.indexOf('editRfq') === -1) {
              tdEl.appendChild(document.createTextNode(' '));
              tdEl.appendChild(ptfRfqActionBtn('✎ ویرایش', 'editRfq', cd, '', ''));
            }
          } else {
            if (rfqHasReadable(r) && !tdEl.querySelector('[data-rfq-action="inqReadOpen"]') && tdEl.innerHTML.indexOf('inqReadOpen') === -1) {
              tdEl.appendChild(document.createTextNode(' '));
              tdEl.appendChild(ptfRfqActionBtn('📖 خواندن فایل استعلام', 'inqReadOpen', cd, 'color:#7c3aed', 'inqrd-btn'));
            }
          }
        });
      } catch (e) {}
    };
    return true;
  }
  var pt = 0;
  var pi = setInterval(function () { pt++; if (patchRenderRfq() || pt > 40) clearInterval(pi); }, 400);

  window.ptfDownloadStoredFile = function(key, fname) {
    if (!key) return;
    fetch(STORAGE_API + '?action=presign_get', { method: 'POST', headers: irAuthHeaders(true), body: JSON.stringify({ key: key }) })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d.ok && d.url) {
          var a = document.createElement('a'); a.href = d.url; a.download = fname || 'download';
          a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove();
        } else alert('خطا در دریافت لینک دانلود: ' + (d.error || ''));
      }).catch(function(){ alert('عدم دسترسی به سرور'); });
  };

  /* v34.7.77 (RFQ-ZIP-DL): فهرست فایل‌های ابریِ قابل‌زیپ‌کردن یک درخواست
     (کلیدهای rfqatt/ + rfq/ (فرم ثبت درخواست) + site-rfq/ (فرم سایت) — هم‌راستا با allowlist سرور).
     v34.7.78 (RFQ-ZIP-PREFIX): فرم «ثبت درخواست جدید» فایل‌ها را با پوشهٔ rfq/<cat> آپلود می‌کند؛
     بدون این پیشوند، درخواست‌های دارای ضمیمهٔ زمانِ ثبت، «فایل ابری یافت نشد» می‌گرفتند. */
  window.ptfRfqZipEntries = function (r) {
    if (!r) return [];
    var out = [], seen = {};
    var rows = typeof window.ptfRfqAttachmentRows === 'function' ? window.ptfRfqAttachmentRows(r) : [];
    rows.forEach(function (row) {
      var f = row && row.file;
      if (!f) return;
      var key = String(f.key || f.objectKey || f.storageKey || '').trim();
      if (key.indexOf('rfqatt/') !== 0 && key.indexOf('rfq/') !== 0 && key.indexOf('site-rfq/') !== 0) return;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ key: key, name: f.name || f.fileName || f.filename || key.split('/').pop() || 'پیوست' });
    });
    return out;
  };
  window.ptfDownloadRfqZip = function (cd) {
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var files = window.ptfRfqZipEntries(r);
    if (!files.length) { alert('فایل ابری قابل دانلود گروهی برای این درخواست یافت نشد.'); return; }
    if (typeof ptfToast === 'function') ptfToast('⏳ در حال ساخت ZIP از ' + files.length + ' ضمیمه…', 'info');
    fetch('../api/zip-attachments.php', {
      method: 'POST',
      headers: irAuthHeaders(true),
      body: JSON.stringify({ files: files, base: 'RFQ-' + cd + '-ضمائم' })
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.text().then(function (t) {
          var msg = '';
          try { var d = JSON.parse(t); msg = d.error || ''; } catch (e) {}
          if (typeof ptfToast === 'function') ptfToast('⛔ دانلود ZIP ناموفق: ' + (msg || ('HTTP ' + resp.status)), 'err');
          else alert('⛔ دانلود ZIP ناموفق: ' + (msg || ('HTTP ' + resp.status)));
        });
      }
      return resp.blob().then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'RFQ-' + cd + '-ضمائم.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        if (typeof ptfToast === 'function') ptfToast('✅ ZIP شامل ' + files.length + ' ضمیمه دانلود شد', 'ok');
      });
    }).catch(function () {
      if (typeof ptfToast === 'function') ptfToast('⛔ عدم دسترسی به سرور برای ساخت ZIP', 'err');
      else alert('⛔ عدم دسترسی به سرور برای ساخت ZIP');
    });
  };

  window.ptfManageInqAttachments = function(cd) {
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function(x){ return x.cd === cd; })[0];
    if (!r) return;
    r.files = r.files || {};
    var projectedAttachments = typeof window.ptfRfqAttachmentRows === 'function' ? window.ptfRfqAttachmentRows(r) : [];
    var legacyAttachments = projectedAttachments.filter(function (x) { return !/^files\.(inq|ds|img|dwg|oth|cat)(?:\[|\.|$)/.test(String(x.source || '')); });
    var renderFileList = function(catKey, catName) {
      var arr = Array.isArray(r.files[catKey]) ? r.files[catKey] : [];
      var items = arr.map(function(f, idx){
        return '<div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;margin-bottom:4px;font-size:12px">' +
          '<span>📄 ' + escP(f.name) + ' <small style="color:#64748b">(' + (f.t||'') + ')</small></span>' +
          '<div style="display:flex;gap:4px">' +
          (f.key ? '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#0e7490;text-decoration:none">👁️ مشاهده</a> <a href="javascript:void(0)" onclick="ptfDownloadStoredFile(\'' + ptfOnClickArg(f.key) + '\',\'' + ptfOnClickArg(f.name) + '\')" class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#059669;text-decoration:none">⬇️ دانلود</a>' : '<span style="color:#94a3b8">صف محلی</span>') +
          '<input type="file" id="attRep_' + catKey + '_' + idx + '" style="display:none" onchange="ptfReplaceInqAtt(\'' + ptfOnClickArg(cd) + '\',\'' + catKey + '\',' + idx + ',this)"><label for="attRep_' + catKey + '_' + idx + '" class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#7c3aed;cursor:pointer">♻️ جایگزینی</label>' +
          '<button onclick="ptfDelInqAtt(\'' + ptfOnClickArg(cd) + '\',\'' + catKey + '\',' + idx + ')" style="border:0;background:none;color:#dc2626;cursor:pointer" title="حذف از سرور و فضای ابری">✕</button></div></div>';
      }).join('');
      return '<div style="margin-bottom:12px"><b style="color:#1e293b;font-size:13px">' + catName + ' (' + arr.length + ')</b>' +
        '<div style="margin-top:4px">' + (items || '<small style="color:#94a3b8">هیچ فایلی پیوست نشده</small>') + '</div>' +
        '<div style="margin-top:6px"><input type="file" id="attInp_' + catKey + '" style="display:none" onchange="ptfHandleInqAttUpload(\'' + ptfOnClickArg(cd) + '\',\'' + catKey + '\',this)"><label for="attInp_' + catKey + '" class="bt bt-o" style="font-size:11px;padding:3px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">+ 📎 انتخاب و آپلود فایل</label></div></div>';
    };
    var legacyHtml = legacyAttachments.length ? '<div style="margin-bottom:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px"><b style="color:#92400e;font-size:13px">📦 ضمائم قدیمی / ثبت‌شده از سایت (' + legacyAttachments.length + ')</b>' + legacyAttachments.map(function (row) {
      var f = row.file || {}, action = '';
      if (f.key && !f.legacyHost) action = '<button class="bt bt-o" style="font-size:11px" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')">مشاهده</button>';
      else if (f.url && /^(https?:\/\/|blob:|data:image\/|data:application\/pdf)/i.test(f.url)) action = '<a class="bt bt-o" style="font-size:11px;text-decoration:none" target="_blank" rel="noopener" href="' + escP(f.url) + '">مشاهده</a>';
      else action = '<small style="color:#b45309">مرجع قدیمی؛ فایل ابری قابل بازکردن نیست</small>';
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed #fed7aa"><span>📎 ' + escP(f.name || 'پیوست') + '</span>' + action + '</div>';
    }).join('') + '</div>' : '';
    var html = '<div class="md-b" id="ptfAttModal" style="display:grid;z-index:' + ((typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2000) : 2000) + '" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:680px;max-height:92vh;overflow:auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<h3 style="margin:0">📎 مدیریت پیوست‌های فنی استعلام — ' + escP(cd) + '</h3>' +
      '<button class="bt" style="font-size:12px;background:#7c3aed;color:#fff" onclick="ptfDownloadRfqZip(\'' + ptfOnClickArg(cd) + '\')" title="دانلود همهٔ ضمایم ابری این درخواست به‌صورت یک فایل ZIP">⬇️ دانلود همه (ZIP)</button></div>' +
      '<p style="font-size:12px;color:#475569;margin-bottom:14px">حتی پس از صدور پیشنهاد مالی یا فنی، شما می‌توانید دیتاشیت، کاتالوگ سازنده، نقشه‌های مهندسی و سایر اسناد تکمیلی را به این استعلام اضافه یا از آن دانلود کنید. برای دانلود یک‌جای ضمایم از دکمهٔ «⬇️ دانلود همه (ZIP)» استفاده کنید.</p>' +
      /* v13.3 (US-325): دسته‌ها با کلیدهای فرم ثبت (saveRfq2) یکسان شد — پیوست‌های زمان ایجاد حالا دیده می‌شوند */
      renderFileList('inq', '📥 فایل‌های اولیه استعلام') +
      renderFileList('ds', '📊 دیتاشیت‌های فنی (Datasheets)') +
      renderFileList('img', '🖼 عکس کالا') +
      renderFileList('dwg', '📐 نقشه‌های مهندسی (Drawings)') +
      renderFileList('oth', '📎 سایر مدارک') +
      ((Array.isArray(r.files['cat']) && r.files['cat'].length) ? renderFileList('cat', '📚 کاتالوگ‌های سازنده (قدیمی)') : '') + legacyHtml +
      '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="bt" onclick="document.getElementById(\'ptfAttModal\').remove()">بستن</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    try { var _am = document.getElementById('ptfAttModal'); if (_am && window.ptfElevateModal) window.ptfElevateModal(_am); } catch (eA) {}
  };

  function ptfInqAttachmentError(err) {
    var code = String((err && err.payload && err.payload.error) || (err && err.message) || 'server_unavailable');
    var map = {
      permission_denied: 'نقش کاربری شما مجوز مدیریت پیوست این درخواست را ندارد.',
      rfq_not_found: 'درخواست روی سرور پیدا نشد؛ ابتدا صفحه را همگام‌سازی/بازخوانی کنید.',
      rfq_attachment_not_found: 'این پیوست قبلاً حذف یا جایگزین شده است؛ فهرست را بازخوانی کنید.',
      invalid_rfq_attachment_file: 'کلید فایل آپلودشده معتبر نیست.',
      payload_too_large: 'اطلاعات ارسالی بیش از سقف سرور است.',
      lock_unavailable: 'سرور در حال ثبت عملیات دیگری است؛ چند لحظه بعد دوباره تلاش کنید.'
    };
    return map[code] || ('ذخیره قطعی روی سرور ناموفق بود (' + code + ').');
  }

  function ptfInqAttachmentCommand(action, payload, handlers) {
    if (typeof window.ptfSalesDomainCommand !== 'function') {
      var e=new Error('ماژول ثبت قطعی سرور بارگذاری نشده است؛ صفحه را بازخوانی کنید.');
      if(handlers&&typeof handlers.onReject==='function')handlers.onReject(e);
      return Promise.resolve({state:'rejected',error:e});
    }
    return window.ptfSalesDomainCommand(action, payload, handlers||{});
  }

  function ptfInqDeleteCloud(key) {
    if (!key) return Promise.resolve({ ok: true });
    return fetch(STORAGE_API + '?action=delete_rfq_attachment', {
      method: 'POST', headers: (typeof ptfStorageAuthHeaders === 'function' ? ptfStorageAuthHeaders(true) : (function(){ var h={'Content-Type':'application/json'}; try { var t=localStorage.getItem('ptf_crm_token'); if(t)h['X-CRM-Token']=t; } catch(e){} return h; })()),
      body: JSON.stringify({ key: key })
    }).then(function(r){ return r.text().then(function(txt){ var d = {}; try { d = JSON.parse(txt); } catch(e) {} if (!r.ok || !d.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d; }); });
  }

  function ptfInqAttachmentRefresh(cd) {
    var m = document.getElementById('ptfAttModal'); if (m) m.remove();
    ptfManageInqAttachments(cd);
  }

  window.ptfHandleInqAttUpload = function(cd, catKey, inp) {
    var f = inp.files[0]; if (!f) return;
    if (typeof uploadFile !== 'function') { if (typeof ptfToast === 'function') ptfToast('⛔ ماژول آپلود در دسترس نیست', 'err'); return; }
    if (typeof ptfToast === 'function') ptfToast('⏳ در حال آپلود و ثبت قطعی پیوست...', 'info');
    uploadFile(f, 'rfqatt', function(res){
      if (!res || !res.ok || !res.key) { if (typeof ptfToast === 'function') ptfToast('⛔ پیوست آپلود نشد: ' + ((res || {}).error || 'فضای ابری در دسترس نیست'), 'err'); return; }
      var fileMeta = { name: res.name || f.name, key: res.key, size: f.size, mode: res.mode, contentType: f.type || '', t: typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString() };
      ptfInqAttachmentCommand('rfq_attachment_add', { rfqId: cd, category: catKey, file: fileMeta },{
        onAck:function(){
          ptfInqAttachmentRefresh(cd);
          if (typeof ptfToast === 'function') ptfToast('✅ پیوست روی سرور ثبت و تأیید شد', 'ok');
        },onReject:function(err){
          /* فقط رد قطعی metadata اجازه پاک‌سازی فایل تازه را می‌دهد. */
          ptfInqDeleteCloud(res.key).then(function(){
            if (typeof ptfToast === 'function') ptfToast('⛔ ' + ptfInqAttachmentError(err) + ' فایل آپلودشده پاک‌سازی شد.', 'err');
          }).catch(function(cleanErr){
            if (typeof ptfToast === 'function') ptfToast('⛔ ' + ptfInqAttachmentError(err) + ' پاک‌سازی فایل یتیم نیز ناموفق بود: ' + cleanErr.message, 'err');
          });
        },onUncertain:function(err){if(typeof ptfToast==='function')ptfToast('⚠️ نتیجه ثبت پیوست نامشخص است؛ فایل برای بازیابی پاک نشد. شناسه: '+err.operationId,'warn');}
      });
    });
  };

  window.ptfReplaceInqAtt = function(cd, catKey, idx, inp) {
    var f = inp.files[0]; if (!f || typeof uploadFile !== 'function') return;
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function(x){ return x.cd === cd || x._id === cd || x.inqNo === cd; })[0];
    var oldFile = r && r.files && r.files[catKey] && r.files[catKey][idx];
    if (!oldFile) { if (typeof ptfToast === 'function') ptfToast('⛔ پیوست قبلی پیدا نشد؛ فهرست را بازخوانی کنید', 'err'); return; }
    if (typeof ptfToast === 'function') ptfToast('⏳ در حال آپلود نسخه جایگزین...', 'info');
    uploadFile(f, 'rfqatt', function(res){
      if (!res || !res.ok || !res.key) { if (typeof ptfToast === 'function') ptfToast('⛔ فایل جایگزین آپلود نشد: ' + ((res || {}).error || ''), 'err'); return; }
      var fileMeta = { name: res.name || f.name, key: res.key, size: f.size, mode: res.mode, contentType: f.type || '', t: typeof faDateTime === 'function' ? faDateTime() : new Date().toISOString() };
      ptfInqAttachmentCommand('rfq_attachment_replace', { rfqId: cd, category: catKey, attachmentId: oldFile._id || oldFile.key, file: fileMeta },{
        onAck:function(){
          return ptfInqDeleteCloud(oldFile.key).then(function(){
            ptfInqAttachmentRefresh(cd);if(typeof ptfToast==='function')ptfToast('✅ نسخه جایگزین روی سرور ثبت و فایل قدیمی پاک شد','ok');
          }).catch(function(err){ptfInqAttachmentRefresh(cd);if(typeof ptfToast==='function')ptfToast('⚠️ نسخه جدید ثبت شد؛ پاک‌سازی فایل قدیمی نیاز به بررسی دارد: '+err.message,'warn');});
        },onReject:function(err){
          ptfInqDeleteCloud(res.key).catch(function(){});
          if (typeof ptfToast === 'function') ptfToast('⛔ ' + ptfInqAttachmentError(err), 'err');
        },onUncertain:function(err){if(typeof ptfToast==='function')ptfToast('⚠️ نتیجه جایگزینی نامشخص است؛ هیچ‌یک از فایل‌ها پاک نشد. شناسه: '+err.operationId,'warn');}
      });
    });
  };

  window.ptfDelInqAtt = function(cd, catKey, idx) {
    if (!confirm('فایل پیوست از درخواست و فضای ابری حذف شود؟ سابقه حذف برای حسابرسی نگه‌داری می‌شود.')) return;
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function(x){ return x.cd === cd || x._id === cd || x.inqNo === cd; })[0];
    var file = r && r.files && r.files[catKey] && r.files[catKey][idx];
    if (!file) return;
    if (typeof ptfToast === 'function') ptfToast('⏳ در حال ثبت حذف روی سرور...', 'info');
    ptfInqAttachmentCommand('rfq_attachment_remove', { rfqId: cd, category: catKey, attachmentId: file._id || file.key },{
      onAck:function(){return ptfInqDeleteCloud(file.key).then(function(){ptfInqAttachmentRefresh(cd);if(typeof ptfToast==='function')ptfToast('✅ حذف پیوست روی سرور و فضای ابری تأیید شد','ok');}).catch(function(err){ptfInqAttachmentRefresh(cd);if(typeof ptfToast==='function')ptfToast('⚠️ حذف از درخواست ثبت شد، اما پاک‌سازی فایل ابری ناموفق بود: '+err.message,'warn');});},
      onReject:function(err){if(typeof ptfToast==='function')ptfToast('⛔ '+ptfInqAttachmentError(err),'err');},
      onUncertain:function(err){if(typeof ptfToast==='function')ptfToast('⚠️ نتیجه حذف پیوست نامشخص است؛ فایل ابری عمداً پاک نشد. شناسه: '+err.operationId,'warn');}
    });
  };

  window.ptfOpenFullInqEditor = function(cd) {
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function(x){ return x.cd === cd; })[0];
    if (!r) return;
    var offers = getData('ptf_crm_offers');
    var aliasesForOffer = irRfqAliases(r, cd);
    /* v31.7.46 BUG-INQ-EDIT-LOCK-001:
       گارد قبلی اگر r.inqNo و o.inqNo هر دو undefined/خالی بودند، false-positive می‌داد
       و ویرایش اقلام را حتی بدون پیشنهاد صادرشده قفل می‌کرد. فقط aliasهای غیرخالی و
       رکوردهای دارای inqNo معتبر باید گارد شوند. */
    var hasOffer = offers.some(function(o){
      var v = String((o && (o.inqNo || o.srcRfq || '')) || '').trim();
      return !!v && aliasesForOffer.indexOf(v) > -1;
    });
    /* پس از صدور پیشنهاد، هویت مشتری/موضوع قفل می‌ماند اما خطای انسانی اقلام باید
       قابل اصلاح باشد. پیشنهادهای صادرشده snapshot مستقل‌اند و با این اصلاح تغییر نمی‌کنند. */
    window._inqEditHasOffer = hasOffer;
    window._inqEditCd = cd;
    var items = irItemsForRfq(r, cd);
    if (!items.length) {
      var rds = getData('ptf_crm_inqreads').filter(function(x){ return x.cd === cd || x.inqNo === cd; })[0];
      if (rds && rds.rows) items = rds.rows.map(function(rw){ return { nm: rw.nm, st: rw.spec, qty: rw.qty, un: rw.un, model: rw.model, brand: rw.brand }; });
    }
    if (!items.length && r.items) items = r.items;
    window._inqEditItems = (items && items.length) ? JSON.parse(JSON.stringify(items)) : [{ nm: '', st: '', qty: 1, un: 'عدد' }];

    var renderItemsRows = function() {
      return window._inqEditItems.map(function(it, idx) {
        return '<tr>' +
          '<td>' + (idx+1) + '</td>' +
          '<td><input type="text" value="' + escP(it.nm||it.name||'') + '" oninput="_inqEditItems['+idx+'].nm=this.value" style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px"></td>' +
          '<td><input type="text" value="' + escP(it.st||it.spec||'') + '" oninput="_inqEditItems['+idx+'].st=this.value" style="width:100%;padding:4px;border:1px solid #cbd5e1;border-radius:4px"></td>' +
          '<td><input type="number" value="' + (it.qty||1) + '" oninput="_inqEditItems['+idx+'].qty=+this.value" style="width:50px;padding:4px;border:1px solid #cbd5e1;border-radius:4px"></td>' +
          '<td><input type="text" value="' + escP(it.un||it.unit||'عدد') + '" oninput="_inqEditItems['+idx+'].un=this.value" style="width:50px;padding:4px;border:1px solid #cbd5e1;border-radius:4px"></td>' +
          '<td><input type="text" value="' + escP(it.tp||'') + '" oninput="_inqEditItems['+idx+'].tp=this.value" style="width:82px;padding:4px;border:1px solid #cbd5e1;border-radius:4px"></td>' +
          '<td><input type="text" value="' + escP(it.brand||it.br||'') + '" oninput="_inqEditItems['+idx+'].brand=this.value" style="width:82px;padding:4px;border:1px solid #cbd5e1;border-radius:4px"></td>' +
          '<td><input type="text" value="' + escP(it.model||it.md||'') + '" oninput="_inqEditItems['+idx+'].model=this.value" style="width:82px;padding:4px;border:1px solid #cbd5e1;border-radius:4px"></td>' +
          '<td style="white-space:nowrap"><button type="button" class="bt bt-o" onclick="ptfDuplicateInqEditRow('+idx+')" style="padding:2px 5px;font-size:10px;color:#0e7490" title="کپی ردیف">＋ کپی</button> <button type="button" class="bt bt-o" onclick="_inqEditItems.splice('+idx+',1);if(!_inqEditItems.length)_inqEditItems.push({nm:\'\',st:\'\',qty:1,un:\'عدد\'});ptfRefreshInqEditItems();" style="padding:2px 5px;font-size:10px;color:#dc2626" title="حذف ردیف">🗑 حذف</button></td></tr>';
      }).join('');
    };

    window.ptfRefreshInqEditItems = function() {
      var tb = document.getElementById('inqEditTbBody');
      if (tb) tb.innerHTML = renderItemsRows();
    };
    window.ptfDuplicateInqEditRow = function (idx) {
      if (!window._inqEditItems[idx]) return;
      window._inqEditItems.splice(idx + 1, 0, JSON.parse(JSON.stringify(window._inqEditItems[idx])));
      window.ptfRefreshInqEditItems();
    };

    var custs = getData('ptf_crm_customers');
    var custOpts = custs.map(function(c){ return '<option value="' + escP(c.cd) + '"' + (r.custCd === c.cd || r.co === c.co ? ' selected' : '') + '>' + escP(c.co) + '</option>'; }).join('');

    var html = '<div class="md-b" id="ptfInqEditMd" style="display:grid;z-index:' + ((typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2000) : 2000) + '" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:820px;max-height:94vh;overflow:auto">' +
      '<h3>✏️ ویرایش استعلام و اقلام — ' + escP(cd) + '</h3>' +
      (hasOffer ? '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:8px 10px;font-size:12px;color:#9a3412">🔒 برای حفظ اسناد صادرشده، مشتری و موضوع قفل‌اند؛ اقلام درخواست قابل اصلاح هستند و پیشنهادهای قبلی تغییر نمی‌کنند.</div>' : '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">' +
      '<div><label style="font-size:12px;color:#475569">مشتری / شرکت</label><select id="inqEdCust"' + (hasOffer ? ' disabled' : '') + ' style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:6px">' + custOpts + '</select></div>' +
      '<div><label style="font-size:12px;color:#475569">موضوع درخواست</label><input type="text" id="inqEdSubj"' + (hasOffer ? ' disabled' : '') + ' value="' + escP(r.subj||r.ca||'') + '" style="width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:6px"></div></div>' +
      '<h4 style="margin:14px 0 6px">اقلام درخواستی</h4>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" style="font-size:11px" onclick="_inqEditItems.push({nm:\'\',st:\'\',qty:1,un:\'عدد\'}); ptfRefreshInqEditItems();">+ افزودن ردیف</button>' +
      '<button type="button" class="bt" style="background:#7c3aed;color:#fff;font-size:11px" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'inqEdXlsInp\');else document.getElementById(\'inqEdXlsInp\').click()">📥 ورود اکسل با راهنما</button>' +
      '<button type="button" class="bt bt-o" style="font-size:11px;color:#6d28d9;border-color:#ddd6fe" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'inqEdXlsInp\')">🤖 پرامپت آماده تبدیل فایل</button>' +
      '<button type="button" class="bt bt-o" style="font-size:11px;color:#0e7490;border-color:#bae6fd" onclick="document.getElementById(\'inqEdAiInp\').click()">🤖 خواندن فایل با AI</button>' +
      '<button type="button" class="bt bt-o" style="font-size:11px;color:#0e7490;border-color:#bae6fd" onclick="ptfDownloadInqItemsTemplate()">دانلود نمونه CSV</button>' +
      '<input type="file" id="inqEdXlsInp" accept=".xlsx,.xls,.csv" style="display:none" onchange="ptfImportInqEditXls(\'' + ptfOnClickArg(cd) + '\',this)">' +
      '<input type="file" id="inqEdAiInp" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md" style="display:none" onchange="ptfReadInqEditFileAi(\'' + ptfOnClickArg(cd) + '\',this)">' +
      '</div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead style="background:#f1f5f9"><tr><th>#</th><th>شرح کالا</th><th>مشخصات فنی</th><th>تعداد</th><th>واحد</th><th>نوع</th><th>برند</th><th>مدل</th><th>عملیات ردیف</th></tr></thead>' +
      '<tbody id="inqEditTbBody">' + renderItemsRows() + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'ptfInqEditMd\').remove()">انصراف</button>' +
      '<button type="button" class="bt" style="background:#059669;color:#fff" onclick="ptfSaveFullInqEdit(\'' + ptfOnClickArg(cd) + '\')">💾 ذخیره تغییرات استعلام و اقلام</button>' +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.ptfReadInqEditFileAi = function (cd, inp) {
    var f = (inp.files || [])[0]; if (!f) return;
    if (typeof ptfToast === 'function') ptfToast('🤖 در حال خواندن «' + f.name + '» و استخراج اقلام...', 'info');
    window.ptfExtractRfqFileWithAi(f, function (err, result) {
      if (err) { alert('❌ AI فایل را نخواند:\n' + err.message + '\n\nاز «ورود اکسل با راهنما»، پرامپت آماده یا افزودن ردیف استفاده کنید.'); return; }
      if (window._inqEditCd !== cd || !document.getElementById('ptfInqEditMd')) { if (typeof ptfToast === 'function') ptfToast('خواندن فایل پایان یافت ولی پنجره همان درخواست بسته شده است؛ دوباره فایل را انتخاب کنید.', 'warn'); return; }
      window._inqEditItems = window._inqEditItems || [];
      result.rows.forEach(function (row) { window._inqEditItems.push({ nm: row.nm, st: row.spec, qty: row.qty, un: row.un, tp: row.tp, brand: row.brand, model: row.model, aiSource: result.sourceName }); });
      if (window._inqEditItems.length > 1 && !String(window._inqEditItems[0].nm || '').trim()) window._inqEditItems.shift();
      ptfRefreshInqEditItems();
      if (typeof ptfToast === 'function') ptfToast('✅ ' + result.rows.length + ' قلم از فایل برای بازبینی اضافه شد؛ دکمه ذخیره را بزنید.', 'ok');
    });
    inp.value = '';
  };

  window.ptfSaveFullInqEdit = function(cd) {
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function(x){ return x.cd === cd; })[0];
    if (!r) return;
    var selCust = document.getElementById('inqEdCust');
    if (!window._inqEditHasOffer && selCust && selCust.value) {
      var cObj = getData('ptf_crm_customers').filter(function(x){ return x.cd === selCust.value; })[0];
      if (cObj) { r.custCd = cObj.cd; r.co = cObj.co; }
    }
    if (!window._inqEditHasOffer) r.subj = (document.getElementById('inqEdSubj')||{}).value || r.subj;

    /* منبع واحد و canonical: r.items + ptf_crm_inqitems با inqNo=کد داخلی RFQ. */
    var aliases = irRfqAliases(r, cd);
    var rawItems = Array.isArray(window._inqEditItems) ? window._inqEditItems : [];
    r.items = rawItems.map(function (rw) {
      var nm = String(rw.nm || rw.name || '').trim();
      if (!nm) return null;
      return {
        nm: nm,
        en: rw.en || nm,
        st: String(rw.st || rw.spec || '').trim(),
        qty: +rw.qty || 1,
        un: String(rw.un || rw.unit || 'عدد').trim() || 'عدد',
        tp: rw.tp || 'Other',
        brand: rw.brand || rw.br || '',
        model: rw.model || rw.md || ''
      };
    }).filter(Boolean);

    /* هر رکورد legacy با cd یا شماره کارفرما حذف می‌شود؛ سپس فقط نسخهٔ فعلی بازنویسی می‌گردد. */
    var allItems = getData('ptf_crm_inqitems');
    var removedItems = allItems.filter(function (x) { return irAliasMatch(x, aliases); }).length;
    var iq = allItems.filter(function (x) { return !irAliasMatch(x, aliases); });
    r.items.forEach(function(rw){
      iq.push({ inqNo: cd, cd: genCode('IQI'), nm: rw.nm, en: rw.en, st: rw.st, qty: rw.qty, un: rw.un, tp: rw.tp, brand: rw.brand, model: rw.model, t: faDate() });
    });

    /* snapshot خوانش AI قدیمی می‌تواند بعداً قلم حذف‌شده را دوباره نمایش دهد؛ هم‌زمان پاک می‌شود. */
    var removedReads = irClearReadSnapshots(aliases);
    setData('ptf_crm_rfqs', rfqs);
    setData('ptf_crm_inqitems', iq);
    try { audit('استعلامات', 'ویرایش اقلام درخواست ' + cd + ': ' + r.items.length + ' قلم فعلی، حذف ' + removedItems + ' رکورد قدیمی و ' + removedReads + ' snapshot خوانش', cd); } catch (eAudit) {}

    var addedProds = 0;
    if (typeof window.ptfAutoRegisterSummaryProducts === 'function' && r.items.length) {
      if (confirm('📦 آیا کالاهای این درخواست به «فهرست کالا» هم اضافه شوند؟\n(هر کالا کد یکتای خود را می‌گیرد؛ کالاهای مشابهِ قبلا ثبت‌شده تکرار نمی‌شوند)')) {
        addedProds = window.ptfAutoRegisterSummaryProducts(cd, r.items) || 0;
      }
    }

    var m = document.getElementById('ptfInqEditMd'); if (m) m.remove();
    window._inqEditHasOffer = false; window._inqEditCd = '';
    if (typeof renderRfq === 'function') renderRfq();
    if (typeof ptfToast === 'function') ptfToast('✅ استعلام و اقلام ذخیره شد' + (addedProds ? ' + ' + addedProds + ' کالای جدید با کد یکتا در فهرست کالا ثبت شد' : ''), 'ok');
  };

  window.ptfImportInqEditXls = function(cd, inp) {
    var f = inp.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function() {
      try {
        if (typeof XLSX === 'undefined') throw new Error('کتابخانه Excel بارگذاری نشده؛ صفحه را بازخوانی کنید');
        var isCsv = /\.csv$/i.test(f.name || '');
        var wb = isCsv ? XLSX.read(String(rd.result || '').replace(/^\uFEFF/, ''), { type: 'string' }) : XLSX.read(new Uint8Array(rd.result), { type: 'array' });
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
        var added = 0;
        rows.forEach(function(c, idx){
          var item = irXlsRowToItem(c, idx);
          if (!item) return;
          window._inqEditItems.push({ nm: item.nm, st: item.st || item.spec || '', qty: item.qty || 1, un: item.un || 'عدد', tp: item.tp || 'Other', brand: item.brand || '', model: item.model || '' });
          added++;
        });
        if (window._inqEditItems.length > 1 && !window._inqEditItems[0].nm) window._inqEditItems.shift();
        ptfRefreshInqEditItems();
        alert('✅ ' + added + ' ردیف از فایل اکسل وارد جدول اقلام استعلام شد. جهت تایید نهایی دکمه ذخیره را بزنید.');
      } catch(e) { alert('خطا در خواندن فایل اکسل: ' + e.message); }
    };
    if (/\.csv$/i.test(f.name || '')) rd.readAsText(f, 'utf-8'); else rd.readAsArrayBuffer(f);
    inp.value = '';
  };

  /* ============ ویزارد خواندن/بازبینی ============ */
  var _ir = null; // {cd, inqNo, rows:[{tp,nm,un,qty,spec}]}

  window.inqReadOpen = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var inqNo = r.inqNo || r.cd; /* فقط برچسب/خروجی قابل‌نمایش؛ کلید داده همیشه cd است. */
    var aliases = irRfqAliases(r, cd);
    // snapshot یا قلم legacy ممکن است با شماره کارفرما ذخیره شده باشد؛ همه aliasها بررسی می‌شوند.
    var saved = getData('ptf_crm_inqreads').filter(function (x) { return irAliasMatch(x, aliases); })[0];
    var rows = saved ? saved.rows : irItemsForRfq(r, cd)
      .map(function (x) { return { tp: x.tp || ptfDetectType(x.nm + ' ' + (x.st || '')), nm: x.en || x.nm, un: x.un || 'عدد', qty: x.qty || 1, spec: x.st || '', brand: x.brand || x.br || '', model: x.model || x.md || '' }; });
    _ir = { cd: cd, dataKey: cd, inqNo: inqNo, aliases: aliases, rows: rows.length ? rows : [{ tp: 'Other', nm: '', un: 'عدد', qty: 1, spec: '' }] };
    inqReadRender(r);
  };

  function inqReadRender(r) {
    var old = document.getElementById('irModal');
    if (old) old.remove();
    var files = irAllRequestAttachments(r).map(function (x) {
      var f = x.file;
      return f.key ? '<button class="bt bt-o" style="font-size:11.5px" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')">📄 ' + escP(f.name) + '</button>' : '<span class="bd" style="background:#f1f5f9;color:#64748b">📄 ' + escP(f.name) + ' (صف محلی)</span>';
    }).join(' ');
    var rowsHtml = _ir.rows.map(function (row, i) {
      var inp = function (f, w, type) {
        return '<input type="' + (type || 'text') + '" value="' + escP(row[f]) + '" oninput="irUpd(' + i + ',\'' + f + '\',this.value)" style="width:' + w + ';padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px">';
      };
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + inp('tp', '92px') + '</td>' +
        '<td>' + inp('nm', '100%') + '</td>' +
        '<td>' + inp('spec', '100%') + '</td>' +
        '<td>' + inp('qty', '52px', 'number') + '</td>' +
        '<td>' + inp('un', '56px') + '</td>' +
        '<td><button onclick="irDel(' + i + ')" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td></tr>';
    }).join('');
    var html = '<div class="md-b" id="irModal" style="display:grid;z-index:1500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:94vh;overflow:auto">' +
      '<h3>📖 خواندن فایل استعلام — <span style="direction:ltr;display:inline-block">' + escP(_ir.inqNo) + '</span></h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:8px">' +
      'فایل استعلام را باز کنید و اقلام را بازبینی/اصلاح کنید. اگر AI فایل پیوست را نخواند، از + ردیف یا «ورود اکسل با راهنما» استفاده کنید؛ اقلام بعد از ذخیره در درخواست و ماژول کالا ثبت می‌شوند. تایپ هر ردیف خودکار از شرح تشخیص داده می‌شود و اطلاعات کارفرما در خروجی‌ها حذف می‌شود.</div>' +
      (files ? '<div style="margin-bottom:8px">' + files + '</div>' : '') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
      '<button class="bt bt-o" style="font-size:12px" onclick="irAdd()">+ ردیف</button>' +
      '<button class="bt bt-o" style="font-size:12px;color:#7c3aed" onclick="irDetectAll()">🎯 تشخیص خودکار تایپ همه ردیف‌ها</button>' +
      '<button class="bt bt-o" style="font-size:12px" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'irXls\');else document.getElementById(\'irXls\').click()">📥 ورود اکسل با راهنما</button>' +
      '<button class="bt bt-o" style="font-size:12px;color:#6d28d9;border-color:#ddd6fe" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'irXls\')">🤖 پرامپت آماده تبدیل فایل</button>' +
      '<button class="bt bt-o" style="font-size:12px;color:#0e7490;border-color:#bae6fd" onclick="ptfDownloadInqItemsTemplate()">دانلود نمونه CSV</button>' +
      '<input type="file" id="irXls" accept=".xlsx,.xls,.csv" style="display:none" onchange="irImportXls(this)">' +
      '<button class="bt llm-only" style="font-size:12px;background:#0e7490;display:none" onclick="irAiReadCurrentAttachments()">🤖 خواندن ضمیمه‌های درخواست با AI</button>' +
      '<button class="bt bt-o llm-only" style="font-size:12px;color:#0e7490;display:none" onclick="document.getElementById(\'irOcr\').click()">🤖 خواندن فایل از دستگاه با AI</button>' +
      '<input type="file" id="irOcr" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md" style="display:none" onchange="irOcrFile(this)"></div>' +
      '<div id="irAiAttachmentStatus" style="margin-bottom:8px"></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead style="background:#f1f5f9">' +
      '<tr><th>#</th><th>تایپ 🎯</th><th style="min-width:180px">شرح کالا</th><th style="min-width:140px">مشخصات/استاندارد</th><th>تعداد</th><th>واحد</th><th></th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="document.getElementById(\'irModal\').remove()">بستن</button>' +
      '<button class="bt bt-o" style="color:#059669" onclick="irSave(true)">📗 دانلود اکسل (قالب شرکت)</button>' +
      '<button class="bt bt-o" onclick="irSave(\'pdf\')">🖨 دانلود PDF (قالب شرکت)</button>' +
      '<button class="bt" style="background:#7c3aed" onclick="irToProducts()">📦 تایید نهایی و ورود به ماژول کالا</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    // دکمه OCR فقط وقتی LLM کانفیگ شده
    ptfLlmStatus(function (ok) {
      if (ok) document.querySelectorAll('#irModal .llm-only').forEach(function (b) { b.style.display = ''; });
    });
  }

  window.irUpd = function (i, f, v) { _ir.rows[i][f] = f === 'qty' ? +v || 0 : v; };
  window.irAdd = function () { _ir.rows.push({ tp: 'Other', nm: '', un: 'عدد', qty: 1, spec: '' }); irRerender(); };
  window.irDel = function (i) { _ir.rows.splice(i, 1); irRerender(); };
  window.irDetectAll = function () {
    _ir.rows.forEach(function (r) { r.tp = ptfDetectType(r.nm + ' ' + r.spec); });
    irRerender();
    if (typeof ptfToast === 'function') ptfToast('🎯 تایپ همه ردیف‌ها از شرح تشخیص داده شد — در صورت خطا اصلاح کنید', 'ok');
  };
  function irRerender() {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === _ir.cd; })[0];
    inqReadRender(r);
  }
  window.irImportXls = function (inp) {
    var f = inp.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var rows = [];
      try {
        if (typeof XLSX === 'undefined') throw new Error('کتابخانه Excel بارگذاری نشده');
        var isCsv = /\.csv$/i.test(f.name || '');
        var wb = isCsv ? XLSX.read(String(rd.result || '').replace(/^\uFEFF/, ''), { type: 'string' }) : XLSX.read(new Uint8Array(rd.result), { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      } catch (e) { alert('خطا در خواندن فایل: ' + e.message); return; }
      var added = 0;
      rows.forEach(function (c, idx) {
        var item = irXlsRowToItem(c, idx);
        if (!item) return;
        _ir.rows.push({ tp: item.tp || ptfDetectType(item.nm + ' ' + (item.st || item.spec || '')), nm: item.nm, un: item.un || 'عدد', qty: item.qty || 1, spec: item.st || item.spec || '', brand: item.brand || '', model: item.model || '' });
        added++;
      });
      if (_ir.rows.length > 1 && !_ir.rows[0].nm) _ir.rows.shift();
      irPersist();
      irRerender();
      alert('✅ ' + added + ' ردیف از فایل پیوست خوانده شد و در اقلام و ماژول کالا ثبت گردید.');
    };
    if (/\.csv$/i.test(f.name)) rd.readAsText(f, 'utf-8'); else rd.readAsArrayBuffer(f);
    inp.value = '';
  };

  function irPersist() {
    var aliases = (_ir && _ir.aliases) || [_ir.cd, _ir.inqNo];
    var list = getData('ptf_crm_inqreads').filter(function (x) { return !irAliasMatch(x, aliases); });
    /* child data با RFQ داخلی ذخیره می‌شود؛ شماره کارفرما صرفاً برای نمایش نگهداری می‌شود. */
    list.unshift({ cd: _ir.cd, inqNo: _ir.dataKey || _ir.cd, customerInqNo: _ir.inqNo || '', rows: _ir.rows, t: faDate(), by: curSession().name });
    setData('ptf_crm_inqreads', list);
    if (typeof window.ptfAutoRegisterSummaryProducts === 'function' && _ir.rows) {
      window.ptfAutoRegisterSummaryProducts(_ir.dataKey || _ir.cd, _ir.rows);
    }
  }

  /* ---------- خروجی قالب استعلام قیمت شرکت (بدون اطلاعات کارفرما) ---------- */
  window.irSave = function (mode) {
    var rows = _ir.rows.filter(function (r) { return (r.nm || '').trim(); });
    if (!rows.length) { alert('ردیفی ثبت نشده'); return; }
    irPersist();
    if (mode === 'pdf') { ptfInqExportPdf(_ir.inqNo, rows); return; }
    ptfInqExportExcel(_ir.inqNo, rows);
  };

  // اکسل (CSV با BOM) به نام شماره استعلام — قالب PTF
  window.ptfInqExportExcel = function (inqNo, rows) {
    rows = rows || irRowsOf(inqNo);
    if (!rows.length) { alert('اقلامی برای این استعلام ثبت نشده'); return; }
    var data = [
      ['Pishro Tajhiz Fartak Co. — Request For Quotation'],
      ['RFQ No: ' + inqNo, 'Date: ' + new Date().toISOString().slice(0, 10)],
      [],
      ['No.', 'Type', 'Description', 'Specification / Standard', 'Qty', 'Unit', 'Unit Price', 'Total Price', 'Delivery', 'Remarks']
    ];
    rows.forEach(function (r, i) { data.push([i + 1, r.tp || '', r.nm, r.spec || '', r.qty || 1, r.un || '', '', '', '', '']); });
    data.push([]);
    data.push(['Please quote your best price, delivery time and validity. — Pishro Tajhiz Fartak Co. | www.pishtaj.ir | Info@pishtaj.ir | +98 21 46087679']);
    var csv = '\uFEFF' + data.map(function (row) { return row.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = String(inqNo).replace(/[^\w\-]/g, '_') + '.csv';
    a.click();
    audit('استعلامات', 'خروجی اکسل قالب شرکت از استعلام ' + inqNo, rows.length + ' قلم');
  };

  // PDF قالب رسمی PTF (نوار گرادیان + مورب — هم‌خانواده سربرگ)
  window.ptfInqExportPdf = function (inqNo, rows) {
    rows = rows || irRowsOf(inqNo);
    if (!rows.length) { alert('اقلامی برای این استعلام ثبت نشده'); return; }
    var tbody = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + escP(r.tp || '—') + '</td><td class="lft"><b>' + escP(r.nm) + '</b></td>' +
        '<td class="lft">' + escP(r.spec || '—') + '</td><td>' + (r.qty || 1) + '</td><td>' + escP(r.un || '') + '</td><td></td><td></td></tr>';
    }).join('');
    var w = window.open('', '_blank');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + escP(inqNo) + '</title><style>' +
      '@page{size:A4 portrait;margin:0}*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:"Segoe UI",Tahoma,sans-serif;color:#26282c;padding:13mm 14mm 24mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.bar-top{position:fixed;top:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#e87200 0%,#ee8100 35%,#ecb003 70%,#ecc506 100%)}' +
      '.bar-top i{position:fixed;top:-1mm;height:9mm;width:1.4mm;background:#fff;transform:skewX(-35deg)}' +
      '.bar-top .s1{left:34.2%}.bar-top .s2{left:35.8%}.bar-top .s3{left:37.4%}' +
      '.bar-bot{position:fixed;bottom:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#ecc506 0%,#ecb003 30%,#ee8100 65%,#e87200 100%)}' +
      '.bar-bot i{position:fixed;bottom:-1mm;height:9mm;width:1.4mm;background:#fff;transform:skewX(-35deg)}' +
      '.bar-bot .s1{right:34.2%}.bar-bot .s2{right:35.8%}.bar-bot .s3{right:37.4%}' +
      '.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:5mm}' +
      '.hd img{height:18mm}.hd .t{text-align:center}.hd .t .co{font-size:13pt;font-weight:700;color:#e87200;font-family:Georgia,serif}' +
      '.hd .t .s{font-size:10pt;color:#b45309;letter-spacing:2px;margin-top:1mm}' +
      '.hd .m{font-size:9pt;line-height:1.9;text-align:right}.hd .m b{color:#c0392b}' +
      'table{width:100%;border-collapse:collapse;font-size:8.6pt}thead{display:table-header-group}tr{page-break-inside:avoid}' +
      'th{background:linear-gradient(90deg,#e87200,#ecb003);color:#fff;border:.4pt solid #d98700;padding:2mm;font-size:8.2pt}' +
      'td{border:.4pt solid #cbb28a;padding:1.8mm;text-align:center;vertical-align:middle}td.lft{text-align:left}' +
      '.nt{margin-top:5mm;font-size:8.6pt;color:#4b5057;line-height:1.9}' +
      '.ftr{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:7.8pt;color:#4b5057}' +
      '<\/style></head><body>' +
      '<div class="prnhint" style="position:fixed;top:8mm;left:0;right:0;background:#0c4a6e;color:#fff;font-size:12px;padding:8px;text-align:center;direction:rtl;z-index:9999">⚙️ چاپ: Margins = None و Headers = خاموش</div><style>@media print{.prnhint{display:none}}<\/style>' +
      '<div class="bar-top"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>' +
      '<div class="bar-bot"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>' +
      '<div class="ftr">' + SELLER_INFO.address + '<br>Tel: ' + SELLER_INFO.tel + ' | ' + SELLER_INFO.email + ' | www.pishtaj.ir</div>' +
      '<div class="hd"><img src="' + SELLER_INFO.logo + '"><div class="t"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="s">REQUEST FOR QUOTATION</div></div>' +
      '<div class="m"><b>RFQ No.:</b> ' + escP(inqNo) + '<br><b>Date:</b> ' + new Date().toISOString().slice(0, 10) + '<br><b>Items:</b> ' + rows.length + '</div></div>' +
      '<table><thead><tr><th style="width:4%">No.</th><th style="width:9%">Type</th><th>Description</th><th style="width:22%">Specification</th><th style="width:6%">Qty</th><th style="width:6%">Unit</th><th style="width:11%">Unit Price</th><th style="width:12%">Total</th></tr></thead><tbody>' + tbody + '</tbody></table>' +
      '<div class="nt">Please quote your best price, delivery time and price validity for the above items.<br>Kindly send your quotation to <b>Info@pishtaj.ir</b> mentioning RFQ No.</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print()},450)}<\/script></body></html>');
    w.document.close();
    audit('استعلامات', 'خروجی PDF قالب شرکت از استعلام ' + inqNo, rows.length + ' قلم');
  };

  function irRowsOf(inqNo) {
    var rfq = getData('ptf_crm_rfqs').filter(function (r) { return r.cd === inqNo || r.inqNo === inqNo; })[0];
    var aliases = irRfqAliases(rfq, inqNo);
    var saved = getData('ptf_crm_inqreads').filter(function (x) { return irAliasMatch(x, aliases); })[0];
    if (saved) return (saved.rows || []).filter(function (r) { return (r.nm || '').trim(); });
    return getData('ptf_crm_inqitems').filter(function (x) { return irAliasMatch(x, aliases); })
      .map(function (x) { return { tp: x.tp || ptfDetectType(x.nm), nm: x.en || x.nm, un: x.un || '', qty: x.qty || 1, spec: x.st || '' }; });
  }

  /* ---------- ورود به ماژول کالا با مارک مخفی + ثبت اقلام درخواست ---------- */
  window.irToProducts = function () {
    var rows = _ir.rows.filter(function (r) { return (r.nm || '').trim(); });
    if (!rows.length) { alert('ردیفی ثبت نشده'); return; }
    if (!confirm('📦 ' + rows.length + ' قلم پس از تایید شما:\n\n۱) به «اقلام درخواست ' + _ir.inqNo + '» ثبت می‌شود (برای TO/CO و استعلام تامین)\n۲) با مارک غیرقابل مشاهده و تفکیک تایپ وارد ماژول کالا می‌شود\n\nتایید می‌کنید؟ (این تایید نهایی است)')) return;
    irPersist();
    // ۱) inqitems — حذف کامل aliasهای قدیمی، سپس ذخیره با کلید داخلی RFQ
    var aliases = (_ir && _ir.aliases) || [_ir.cd, _ir.inqNo];
    var iq = getData('ptf_crm_inqitems').filter(function (x) { return !irAliasMatch(x, aliases); });
    rows.forEach(function (r) {
      iq.push({ inqNo: _ir.dataKey || _ir.cd, cd: genCode('IQI'), nm: r.nm, en: r.nm, tp: r.tp, qty: r.qty || 1, un: r.un || 'عدد', st: r.spec || '', brand: r.brand || '', model: r.model || '', t: faDate() });
    });
    setData('ptf_crm_inqitems', iq);
    // ۲) products با مارک مخفی (hidden) و تایپ
    var prods = getData('ptf_crm_products');
    var added = 0;
    rows.forEach(function (r) {
      var dup = prods.some(function (p) { return (typeof dedupNorm === 'function' ? dedupNorm(p.nm) === dedupNorm(r.nm) : p.nm === r.nm); });
      if (dup) return;
      var cd = (typeof prodAutoCode === 'function') ? prodAutoCode() : 'P-' + (1000 + prods.length + 1);
      prods.push({ cd: cd, nm: r.nm, en: '', ca: (typeof ptfNormCat === 'function' ? ptfNormCat(r.tp) : (r.tp || 'سایر')), st: r.spec || '', br: r.brand || '', md: r.model || '', un: r.un || 'عدد', pr: 0, ds: 'از استعلام ' + (_ir.dataKey || _ir.cd),
        hidden: true, srcInq: (_ir.dataKey || _ir.cd), tp: r.tp, ts: new Date().toISOString(), ts0: new Date().toISOString() }); /* v15.9 US-389 */
      added++;
    });
    setData('ptf_crm_products', prods);
    audit('کالاها', 'ورود ' + added + ' قلم از استعلام ' + _ir.inqNo + ' با مارک مخفی و تفکیک تایپ', _ir.inqNo);
    document.getElementById('irModal').remove();
    alert('✅ ثبت شد:\n• ' + rows.length + ' قلم در اقلام درخواست ' + _ir.inqNo + '\n• ' + added + ' کالای جدید با مارک مخفی (تکراری‌ها اضافه نشدند)\n\nاین کالاها در فهرست عادی کالا دیده نمی‌شوند (چک‌باکس «نمایش کالاهای استعلامی» در ماژول کالا).');
    if (typeof renderInquiries === 'function') renderInquiries();
  };

  /* ---------- فیلتر کالاهای مخفی در فهرست کالا + چک‌باکس نمایش ---------- */
  var _renderProductsOld = null;
  function patchRenderProducts() {
    if (_renderProductsOld || typeof window.renderProducts !== 'function') return false;
    _renderProductsOld = window.renderProducts;
    window.renderProducts = function () {
      var showHidden = !!(document.getElementById('prodShowHidden') || {}).checked;
      // موقتاً کالاهای مخفی را از داده کنار بگذار، رندر کن، برگردان
      var all = getData('ptf_crm_products');
      var hiddenOnes = all.filter(function (p) { return p.hidden; });
      if (!showHidden && hiddenOnes.length) {
        localStorage.setItem('ptf_crm_products', JSON.stringify(all.filter(function (p) { return !p.hidden; })));
        try { _renderProductsOld(); } finally { localStorage.setItem('ptf_crm_products', JSON.stringify(all)); }
      } else {
        _renderProductsOld();
      }
      // چک‌باکس
      try {
        var srch = document.getElementById('pSrch');
        var extras = document.getElementById('prodFilterExtras');
        if (srch && !document.getElementById('prodShowHidden')) {
          (extras || srch.parentElement).insertAdjacentHTML('beforeend',
            '<label class="prod-hidden-toggle"><input type="checkbox" id="prodShowHidden" onchange="renderProducts()"> <span>نمایش کالاهای استعلامی (' + hiddenOnes.length + ')</span></label>');
        }
      } catch (e) {}
    };
    return true;
  }
  var pp = 0;
  var ppi = setInterval(function () { pp++; if (patchRenderProducts() || pp > 40) clearInterval(ppi); }, 400);

  /* ---------- US-195: فراخوانی هوشمند اقلام درخواست در TO/CO (با تایپ) ---------- */
  var _offLoadOld = null;
  function patchOffLoad() {
    if (_offLoadOld || typeof window.offLoadInqItems !== 'function') return false;
    _offLoadOld = window.offLoadInqItems;
    /* FB-1 (v34.7.30): این وصله آرگومان را دور می‌ریخت. دیالوگ انتخاب درخواست، شماره را
       با آرگومان می‌فرستد (offers.js: offLoadInqItems('RFQ-…')) ولی امضای بدون پارامتر و
       فراخوان بدون آرگومانِ زیر، آن را حذف می‌کرد؛ تابع اصلی دوباره «شماره‌ای ندارم» می‌دید
       و همان فهرست را باز می‌کرد ⇒ «انتخاب می‌کنم، هیچ اتفاقی نمی‌افتد».
       قاعدهٔ معماری: هر وصلهٔ زنجیره‌ای باید apply(this, arguments) کند (نگهبان A8).
       مرجع: ASSESSMENT-AWARD-REVISION-AND-REF-PRICE-2026-08-17.md §۱ */
    window.offLoadInqItems = function (pickedInq) {
      var before = _offState.items.length;
      var _ret = _offLoadOld.apply(this, arguments);
      // اگر اقلام تایپ دارند، ستون Type به extraCols اضافه و مقادیر پر شود
      try {
        var iq = getData('ptf_crm_inqitems').filter(function (r) { return r.inqNo === _offState.inqNo && r.tp; });
        if (!iq.length) return _ret;
        _offState.extraCols = _offState.extraCols || [];
        if (_offState.extraCols.indexOf('Type') < 0) _offState.extraCols.unshift('Type');
        _offState.items.forEach(function (it, i) {
          if (i < before) return;
          var src = iq.filter(function (r) { return (r.en || r.nm) === it.name; })[0];
          if (src) { it.extra = it.extra || {}; it.extra.Type = src.tp; }
        });
        if (typeof offRenderItems === 'function') offRenderItems();
      } catch (e) {}
      return _ret;
    };
    return true;
  }
  var po = 0;
  var poi = setInterval(function () { po++; if (patchOffLoad() || po > 40) clearInterval(poi); }, 400);

  /* ---------- US-196: دکمه‌های AI در فرم TO/CO (ترجمه + برند پیشنهادی) ---------- */
  function injectOfferAiBar() {}

  window.offAiTranslate = function (dir) {
    var items = (_offState.items || []).map(function (it, i) { return { i: i, t: (it.name || '') + (it.desc ? ' | ' + it.desc : '') }; })
      .filter(function (x) { return x.t.trim().length > 2; });
    if (!items.length) { alert('ردیفی برای ترجمه نیست'); return; }
    if (!confirm('🤖 شرح ' + items.length + ' ردیف ' + (dir === 'fa2en' ? 'فارسی → انگلیسی' : 'انگلیسی → فارسی') + ' ترجمه شود؟\n(نتیجه جایگزین می‌شود — قبل از ذخیره بازبینی کنید)')) return;
    var done = 0;
    (function next(k) {
      if (k >= items.length) {
        offRenderItems();
        if (typeof ptfToast === 'function') ptfToast('🤖 ' + done + ' ردیف ترجمه شد — بازبینی کنید', 'ok');
        return;
      }
      ptfLlmTranslate(items[k].t, dir, function (d) {
        if (d.ok && d.data && d.data.t) {
          var parts = String(d.data.t).split('|');
          _offState.items[items[k].i].name = (parts[0] || '').trim();
          if (parts[1]) _offState.items[items[k].i].desc = parts[1].trim();
          done++;
        }
        next(k + 1);
      });
    })(0);
  };

  window.offAiBrands = function () {
    var items = (_offState.items || []).map(function (it, i) { return { i: i, it: it }; })
      .filter(function (x) { return !(x.it.brand || '').trim() && ((x.it.name || '') + (x.it.desc || '')).length > 3; });
    if (!items.length) { alert('همه ردیف‌ها برند دارند یا شرح ندارند'); return; }
    var done = 0;
    if (typeof ptfToast === 'function') ptfToast('🤖 در حال بررسی ' + items.length + ' ردیف...', 'ok');
    (function next(k) {
      if (k >= items.length) {
        offRenderItems();
        alert('🤖 برند ' + done + ' ردیف از روی کد/مدل تشخیص داده شد (با پسوند «(AI?)»).\n\n⚠️ طبق سیاست شرکت، این فقط «پیشنهاد» است — پیش از ذخیره سند، برندها را بررسی و پسوند را حذف/اصلاح کنید.');
        return;
      }
      var x = items[k];
      ptfLlmIdentify((x.it.name || '') + ' ' + (x.it.desc || '') + ' ' + (x.it.model || ''), function (d) {
        if (d.ok && d.data && d.data.brand && (+d.data.conf || 0) >= 70) {
          _offState.items[x.i].brand = d.data.brand + ' (AI?)';
          done++;
        }
        next(k + 1);
      });
    })(0);
  };

  /* ============ v12.7 (US-313 — دستور کارفرما): سیستم «خلاصه AI» حذف شد ============
     دلیل: ناکارآمد بود و با هر ثبت درخواست، خودکار توکن AI می‌سوزاند (هوک saveRfq2 + polling دکمه‌ها).
     تحلیل سند از این پس فقط در «دستیار» و به اراده کاربر انجام می‌شود (US-269 مصوب هیئت).
     استاب‌های خنثی برای سازگاری با ارجاع‌های قدیمی/داده‌های aiSum موجود: */
  window.rfqAiSummarize = function () { if (typeof ptfToast === 'function') ptfToast('این قابلیت حذف شد — از «دستیار» استفاده کنید', 'ok'); };
  window.rfqAiShow = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r || !r.aiSum) return;
    alert('خلاصه قدیمی (آرشیو):\n\n' + r.aiSum);
  };

  /* ---------- دکمه دانلود قالب شرکت در ویزارد استعلام تامین (rfqsmart) ---------- */
  window.ptfInqQuickExport = function () {
    var iq = getData('ptf_crm_inqitems');
    var nos = {};
    iq.forEach(function (x) { nos[x.inqNo] = 1; });
    getData('ptf_crm_inqreads').forEach(function (x) { nos[x.inqNo] = 1; });
    var keys = Object.keys(nos);
    if (!keys.length) { alert('درخواستی با اقلام ثبت نشده'); return; }
    ptfDialog({
      title: '📤 دانلود فایل استعلام (قالب شرکت)',
      fields: [
        { id: 'inq', label: 'شماره درخواست', type: 'select', options: keys },
        { id: 'fmt', label: 'قالب خروجی', type: 'select', options: [{ v: 'xls', lb: 'Excel (CSV)' }, { v: 'pdf', lb: 'PDF' }] }
      ],
      okText: 'دانلود',
      onOk: function (v) {
        if (v.fmt === 'pdf') ptfInqExportPdf(v.inq); else ptfInqExportExcel(v.inq);
      }
    });
  };
  // دکمه در پنل استعلام هوشمند تامین
  setInterval(function () {
    try {
      var panel = document.querySelector('#panels .ph h3');
      if (panel && (panel.textContent.indexOf('استعلام هوشمند') > -1 || panel.textContent.indexOf('درخواست تامین') > -1)) {
        var bar = panel.closest('.ph').querySelector('.sb2');
        if (bar && !bar.querySelector('.iq-exp-btn')) {
          bar.insertAdjacentHTML('beforeend', '<button class="bt bt-o iq-exp-btn" style="font-size:12px" onclick="ptfInqQuickExport()">📤 دانلود استعلام (قالب شرکت)</button>');
        }
      }
    } catch (e) {}
  }, 1500);
})();

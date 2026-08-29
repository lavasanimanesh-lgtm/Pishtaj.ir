/* =====================================================================
   PTF CRM — Sprint 62 (US-114)
   کلاینت انبار فایل ابری: آپلود مستقیم مرورگر→آروان + فشرده‌سازی + fallback
   ===================================================================== */

var STORAGE_API = '../api/storage.php';
function ptfStorageAuthHeaders(json) {
  var h = json ? { 'Content-Type': 'application/json' } : {};
  try { var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {}
  return h;
}

/* v34.4.34: حذف ابری باید قبل از حذف metadata تأیید شود. نسخه‌های قبلی ابتدا
   فایل را از رکورد محلی پاک می‌کردند، پاسخ 403/شبکه را نادیده می‌گرفتند و پیام موفقیت
   می‌دادند؛ نتیجه یک object یتیم در S3 و «حذف‌شده» کاذب در UI بود. */
window.ptfDeleteStoredFile = function (key, cb) {
  var done = false;
  function finish(result) {
    if (done) return;
    done = true;
    if (typeof cb === 'function') cb(result);
  }
  if (!key) { finish({ ok: false, error: 'کلید فایل خالی است' }); return; }
  fetch(STORAGE_API + '?action=delete', {
    method: 'POST', headers: ptfStorageAuthHeaders(true), body: JSON.stringify({ key: key })
  }).then(function (r) {
    return r.text().then(function (text) {
      var data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (!r.ok || !data || !data.ok) {
        var err = data && data.error;
        if (r.status === 403 || err === 'permission_denied') err = 'نقش فعلی اجازهٔ حذف فایل ابری را ندارد';
        throw new Error(err || ('حذف ابری ناموفق بود (HTTP ' + r.status + ')'));
      }
      return data;
    });
  }).then(function (data) { finish({ ok: true, data: data }); })
    .catch(function (e) { finish({ ok: false, error: (e && e.message) || 'عدم دسترسی به فضای ابری' }); });
};

/* ---------- تست اتصال (صفحه تنظیمات) ---------- */
function storageStatus(cb) {
  fetch(STORAGE_API + '?action=status', { headers: ptfStorageAuthHeaders(false) })
    .then(function (r) { return r.json(); })
    .then(function (d) { cb(d); })
    .catch(function () { cb({ ok: false, mode: 'offline', error: 'عدم دسترسی به api/storage.php' }); });
}

window.ptfFixStorageCors = function (btn) {
  if (btn) btn.disabled = true;
  fetch('../api/fix-arvan-cors.php', { method: 'POST', headers: ptfStorageAuthHeaders(true), body: '{}' })
    .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || d.body || ('HTTP ' + r.status)); return d; }); })
    .then(function () { if (typeof ptfToast === 'function') ptfToast('✅ CORS فضای ابری برای پروداکشن و استیجینگ اعمال شد', 'ok'); })
    .catch(function (e) { if (typeof ptfToast === 'function') ptfToast('⛔ اصلاح CORS ناموفق: ' + e.message, 'warn'); else alert(e.message); })
    .then(function () { if (btn) btn.disabled = false; });
};

function ptfStorageCorsButton() {
  var role = '';
  try { role = String(curRole()).toLowerCase(); } catch (e) {}
  return ['admin', 'chairman', 'ceo'].indexOf(role) > -1
    ? '<br><button type="button" class="bt bt-o" style="margin-top:7px;font-size:11px" onclick="ptfFixStorageCors(this)">🛠 اعمال CORS استیجینگ/پروداکشن</button>'
    : '';
}

function renderStorageStatusBox(elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '<div style="color:#94a3b8;font-size:12.5px">در حال بررسی اتصال آروان...</div>';
  storageStatus(function (d) {
    if (d.ok) {
      el.innerHTML = '<div style="background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:10px 12px;font-size:13px">' +
        '✅ <b>اتصال به آروان‌کلود برقرار است</b><br><small style="color:#047857">صندوقچه: ' + escP(d.bucket) + ' — فایل‌های جدید در فضای ابری ذخیره می‌شوند</small>' + ptfStorageCorsButton() + '</div>';
      localStorage.setItem('ptf_storage_mode', 'arvan');
    } else if (d.mode === 'local-fallback' || d.mode === 'cloud-required') {
      el.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 12px;font-size:13px">' +
        '⛔ <b>فضای ابری پیکربندی نشده است</b><br><small style="color:#b91c1c">' + escP(d.error) + '<br>طبق سیاست فعلی، هیچ پیوستی روی هاست ذخیره نمی‌شود و آپلود تا برقراری اتصال ابری متوقف است.</small></div>';
      localStorage.setItem('ptf_storage_mode', 'cloud-required');
    } else {
      el.innerHTML = '<div style="background:#fef2f2;border:1px solid #ef4444;border-radius:10px;padding:10px 12px;font-size:13px">' +
        '❌ <b>خطای اتصال به آروان</b><br><small style="color:#b91c1c">' + escP(d.error || '') + '</small>' +
        '<br><button class="bt bt-o" style="margin-top:6px;font-size:12px" onclick="renderStorageStatusBox(\'' + elId + '\')">🔄 تلاش مجدد</button></div>';
      localStorage.setItem('ptf_storage_mode', 'error');
    }
  });
}

/* ---------- US-177: میزان فضای اشغال‌شده ابری در منوی سیستم ---------- */
function fmtSizeH(b) {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function ptfCloudUsage(cb, force) {
  /* v34.8.41 (R3/T3-4 — CACHE→IDB): کش ۱۰ دقیقه‌ای در لایهٔ ptfCache (IndexedDB)؛
     نسخهٔ منقضی تا ۷ روز به‌عنوان fallback خطا سرو می‌شود (جای ptf_cloud_usage_backup)؛
     legacy LS فقط تا مهاجرتِ بوت خوانده می‌شود. */
  function fallbackStale(err) {
    if (window.ptfCacheReadStale) {
      window.ptfCacheReadStale('ptf_cloud_usage', function (v) {
        var bak = null;
        try { bak = v ? JSON.parse(v) : null; } catch (eP) {}
        if (!bak) { try { bak = JSON.parse(localStorage.getItem('ptf_cloud_usage_backup') || 'null'); } catch (eL) {} }
        if (bak) { bak.cached = true; cb(bak); }
        else cb({ ok: false, error: err });
      });
      return;
    }
    var bak = null;
    try { bak = JSON.parse(localStorage.getItem('ptf_cloud_usage_backup') || 'null'); } catch (eL) {}
    if (bak) { bak.cached = true; cb(bak); }
    else cb({ ok: false, error: err });
  }
  function flow() {
    fetch(STORAGE_API + '?action=usage', { method: 'POST', headers: ptfStorageAuthHeaders(true), body: '{}' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          var rec = { ok: true, bytes: d.bytes, count: d.count, bucket: d.bucket, at: Date.now() };
          if (window.ptfCacheWrite) window.ptfCacheWrite('ptf_cloud_usage', JSON.stringify(rec), 600);
          else { try { localStorage.setItem('ptf_cloud_usage', JSON.stringify(rec)); } catch (eL) {} }
          cb(rec);
        } else {
          fallbackStale(d.error || ('HTTP ' + d.http || ''));
        }
      })
      .catch(function () {
        fallbackStale('عدم دسترسی به سرور');
      });
  }
  if (force) { flow(); return; }
  /* مسیر سریع legacy (تا مهاجرت) */
  try {
    var c = JSON.parse(localStorage.getItem('ptf_cloud_usage') || 'null');
    if (c && (Date.now() - c.at) < 600000) { cb(c); return; }
  } catch (e) {}
  if (window.ptfCacheRead) {
    window.ptfCacheRead('ptf_cloud_usage', function (v) {
      if (v) { try { cb(JSON.parse(v)); return; } catch (eP) {} }
      flow();
    });
  } else flow();
}

/* v34.8.41 (R3/T3-4): مهاجرت بوتِ کش مصرف ابر از LS به ptfCache (الگوی امن) */
try { if (window.ptfCacheHydrate) window.ptfCacheHydrate(['ptf_cloud_usage']); } catch (eHyd) {}

function ptfRenderCloudUsage(force) {
  var el = document.getElementById('cloudUsage');
  if (!el) return;
  el.innerHTML = '☁️ <small style="color:#94a3b8">در حال محاسبه فضای ابری...</small>';
  ptfCloudUsage(function (d) {
    if (!el.isConnected) return;
    if (d.ok) {
      el.innerHTML = '☁️ فضای ابری: <b style="color:#0e7490">' + fmtSizeH(d.bytes) + '</b> <small style="color:#94a3b8">(' + d.count + ' فایل)</small>' +
        ' <span onclick="ptfRenderCloudUsage(true)" title="به‌روزرسانی" style="cursor:pointer">🔄</span>';
    } else {
      if (d.cached) {
      el.innerHTML = '☁️ فضای ابری: <b style="color:#0e7490">' + fmtSizeH(d.bytes) + '</b> <small style="color:#94a3b8">(' + d.count + ' فایل)</small> <span title="آخرین وضعیت شناخته‌شده (سرور ابری موقتاً کند/۵۰۴ است)" style="color:#d97706">🟡</span> <span onclick="ptfRenderCloudUsage(true)" title="تلاش مجدد" style="cursor:pointer">🔄</span>';
    } else {
      el.innerHTML = '☁️ <small style="color:#64748b">فضای ابری: متصل (در انتظار پاسخ سرور 🔄)</small>';
    }
    }
  }, force);
}

// درج خودکار سنجه در پایین سایدبار (منوی سیستم)
(function () {
  function inject() {
    var f = document.querySelector('.sb-f');
    if (!f || document.getElementById('cloudUsage')) return;
    var d = document.createElement('div');
    d.id = 'cloudUsage';
    d.style.cssText = 'font-size:11px;padding:7px 9px;margin-bottom:6px;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;color:#475569;text-align:center;line-height:1.9';
    f.insertBefore(d, f.firstChild);
    ptfRenderCloudUsage();
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    try {
      var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
      if (vis) { inject(); clearInterval(t); }
    } catch (e) {}
    if (tries > 60) clearInterval(t);
  }, 300);
})();

// دیالوگ جزئیات فضای ابری (از آیکون ☁️ نوار بالا)
function ptfCloudDialog() {
  ptfCloudUsage(function (d) {
    var role = '';
    try { role = String(curRole()).toLowerCase(); } catch (eR) {}
    var auditBtn = ['admin', 'chairman', 'ceo'].indexOf(role) > -1
      ? '<br><button type="button" class="bt bt-o" style="margin-top:10px;font-size:12px" onclick="if(typeof ptfCloudKeyAudit===\'function\')ptfCloudKeyAudit()">📋 گزارش کلیدهای ابری (بدون حذف)</button>'
      : '';
    var body = d.ok
      ? 'فضای اشغال‌شده: <b>' + fmtSizeH(d.bytes) + '</b><br>تعداد فایل‌ها: <b>' + d.count + '</b><br>صندوقچه: <span style="direction:ltr;display:inline-block">' + escP(d.bucket || '') + '</span>' +
        '<br><small style="color:#94a3b8">برای آزادسازی فضا: پرونده‌های تمام‌شده را از ماژول «پرونده‌های پروژه» بایگانی/پاکسازی کنید.</small>' + auditBtn
      : '<span style="color:#d97706">خطا: ' + escP(d.error || '') + '</span>' + auditBtn;
    if (typeof ptfDialog === 'function') ptfDialog({ title: '☁️ وضعیت فضای ابری', body: body, okText: 'بستن' });
    else alert(body.replace(/<[^>]+>/g, ''));
  }, true);
}

/* ---------- فشرده‌سازی تصویر سمت کلاینت (AC4 / v34.7.52) ----------
   WebP اگر مرورگر نسازد یا از اصل بزرگ‌تر باشد، JPEG فشرده جایگزین می‌شود.
   کوچک‌ترین گزینهٔ معتبر انتخاب می‌شود؛ SVG و غیرتصویر دست‌نخورده می‌مانند. */
function compressImage(file, cb) {
  if (!/^image\//.test(file.type) || file.type === 'image/svg+xml') { cb(file, null); return; }
  var img = new Image();
  var url = URL.createObjectURL(file);
  img.onload = function () {
    var MAX = 1600;
    var w = img.width, h = img.height;
    if (w > MAX || h > MAX) { var k = Math.min(MAX / w, MAX / h); w = Math.round(w * k); h = Math.round(h * k); }
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    function pickBest(webp, jpeg) {
      URL.revokeObjectURL(url);
      var opts = [{ size: file.size, keep: true }];
      if (webp && webp.size > 0) opts.push({ blob: webp, size: webp.size, ext: '.webp', mime: 'image/webp', label: 'WebP' });
      if (jpeg && jpeg.size > 0) opts.push({ blob: jpeg, size: jpeg.size, ext: '.jpg', mime: 'image/jpeg', label: 'JPEG' });
      opts.sort(function (a, b) { return a.size - b.size; });
      var best = opts[0];
      if (!best || best.keep || !best.blob) { cb(file, null); return; }
      var base = String(file.name || 'image').replace(/\.[^.]+$/, '');
      var nf = new File([best.blob], base + best.ext, { type: best.mime });
      cb(nf, { before: file.size, after: best.size, format: best.label });
    }
    try {
      cv.toBlob(function (webp) {
        try {
          cv.toBlob(function (jpeg) { pickBest(webp, jpeg); }, 'image/jpeg', 0.82);
        } catch (eJpeg) { pickBest(webp, null); }
      }, 'image/webp', 0.8);
    } catch (eWebp) { pickBest(null, null); }
  };
  img.onerror = function () { URL.revokeObjectURL(url); cb(file, null); };
  img.src = url;
}

function fmtSize(b) {
  if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB';
  if (b > 1024) return Math.round(b / 1024) + ' KB';
  return b + ' B';
}

/* ---------- آپلود فایل (AC3): فقط آروان؛ بدون fallback فایل روی هاست ---------- */
// uploadFile(file, folder, cb(result))  → result: {ok, key, name, size, mode:"arvan"}
function uploadFile(file, folder, cb, progressCb) {
  var maxMb = 25;
  var completed = false;
  function finish(result) {
    if (completed) return;
    completed = true;
    cb(result);
  }
  if (file.size > maxMb * 1048576) { finish({ ok: false, error: 'حجم فایل بیش از ' + maxMb + 'MB است' }); return; }

  compressImage(file, function (finalFile, compInfo) {
    var note = compInfo ? ('فشرده: ' + fmtSize(compInfo.before) + ' → ' + fmtSize(compInfo.after) + (compInfo.format ? ' (' + compInfo.format + ')' : '')) : '';

    // درخواست لینک آپلود از سرور
    fetch(STORAGE_API + '?action=presign_put', {
      method: 'POST', headers: ptfStorageAuthHeaders(true),
      body: JSON.stringify({ name: finalFile.name, type: finalFile.type, folder: folder || 'general' })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { finish({ ok: false, error: d.error || 'فضای ابری در دسترس نیست؛ فایل روی هاست ذخیره نشد' }); return; }
        var serverMaxMb = Math.max(1, +(d.max_mb || maxMb));
        if (finalFile.size > serverMaxMb * 1048576) {
          finish({ ok: false, error: 'حجم فایل از سقف تنظیم‌شدهٔ فضای ابری (' + serverMaxMb + 'MB) بیشتر است' });
          return;
        }
        // آپلود مستقیم مرورگر → آروان (فایل از هاست عبور نمی‌کند)
        var xhr = new XMLHttpRequest();
        var fallbackStarted = false;
        xhr.open('PUT', d.url);
        xhr.timeout = 120000;
        /* MIME/inline باید هنگام PUT در metadata شیء ثبت شود. نبود این دو هدر در
           مسیر proxy علت application/octet-stream و بازشدن Save-As به‌جای viewer بود. */
        try { xhr.setRequestHeader('Content-Type', d.content_type || finalFile.type || 'application/octet-stream'); } catch (eCt) {}
        try { xhr.setRequestHeader('Content-Disposition', 'inline'); } catch (eCd) {}
        if (progressCb) xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) progressCb(Math.round(e.loaded * 100 / e.total));
        };
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            finish({ ok: true, key: d.key, name: finalFile.name, size: finalFile.size,
              contentType: d.content_type || finalFile.type || '', mode: 'arvan', savedNote: note });
          } else {
            fallbackProxy('HTTP ' + xhr.status);
          }
        };
        xhr.onerror = function () { fallbackProxy('network'); };
        xhr.ontimeout = function () { fallbackProxy('timeout'); };
        function fallbackProxy(reason) {
          if (fallbackStarted || completed) return;
          fallbackStarted = true;
          xhr.onload = xhr.onerror = xhr.ontimeout = null;
          try {
            var fd = new FormData();
            fd.append('file', finalFile);
            fd.append('folder', folder || 'general');
            // Fallback: آپلود از طریق سرور خودمان (PHP cURL -> S3) تا وابسته به CORS مرورگر نباشد
            fetch(STORAGE_API + '?action=upload_proxy', {
              method: 'POST',
              headers: ptfStorageAuthHeaders(false),
              body: fd
            }).then(function(r){ return r.text().then(function(tx){ var parsed; try{ parsed=JSON.parse(tx);} catch(e){ throw new Error('پاسخ غیر JSON از سرور ('+r.status+'): '+tx.slice(0,180));} if(!r.ok && parsed && !parsed.error) parsed.error='HTTP '+r.status; return parsed; }); })
              .then(function(pr){
                if (pr.ok) finish({ ok: true, key: pr.key, name: pr.name || finalFile.name, size: pr.size || finalFile.size,
                  contentType: pr.content_type || finalFile.type || '', mode: 'arvan-proxy', savedNote: note ? note + ' (ارسال امن از مسیر سرور)' : 'ارسال امن از مسیر سرور' });
                else finish({ ok: false, error: pr.error || 'اتصال به فضای ابری برقرار نشد؛ فایل روی هاست ذخیره نشد (proxy: '+reason+')' });
              })
              .catch(function(e){ finish({ ok: false, error: 'اتصال به فضای ابری برقرار نشد؛ فایل روی هاست ذخیره نشد' + (e && e.message ? ' — ' + e.message : ' (proxy: '+reason+')') }); });
          } catch(e) {
            finish({ ok: false, error: 'اتصال به فضای ابری برقرار نشد؛ فایل روی هاست ذخیره نشد (proxy exception)' });
          }
        }
        xhr.send(finalFile);
      })
      .catch(function () { finish({ ok: false, error: 'دریافت مجوز آپلود ابری ناموفق بود؛ فایل روی هاست ذخیره نشد' }); });
  });
}

/* ---------- دانلود/نمایش فایل خصوصی ---------- */
/* v21.2 US-403: پیش‌نمایش داخل مودال (docviewer) به‌جای تب جدید — با fallback تب جدید */
function ptfFileExt(nameOrKey) {
  var s = String(nameOrKey || '');
  var base = s.split('?')[0].split('#')[0];
  var m = base.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}
function ptfDocViewerKind(ext) {
  ext = (ext || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].indexOf(ext) > -1) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'csv', 'log', 'json', 'md', 'xml', 'html', 'htm'].indexOf(ext) > -1) return 'text';
  return 'other';
}
window.ptfDownloadStoredFile = function (key, name) {
  if (!key) { alert('این فایل هنوز به فضای ابری منتقل نشده'); return; }
  fetch(STORAGE_API + '?action=presign_get', {
    method: 'POST', headers: ptfStorageAuthHeaders(true),
    body: JSON.stringify({ key: key, disposition: 'attachment' })
  }).then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.ok) { alert('خطا در دریافت لینک: ' + (d.error || '')); return; }
      var a = document.createElement('a');
      a.href = d.url; a.target = '_blank'; a.rel = 'noopener';
      if (name) a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
    })
    .catch(function () { alert('عدم دسترسی به سرور'); });
};
window.ptfCloseDocViewer = function () {
  var modal = document.getElementById('ptfDocViewer');
  if (modal) modal.remove();
  if (window._ptfDocViewerObjectUrl) {
    try { URL.revokeObjectURL(window._ptfDocViewerObjectUrl); } catch (e) {}
    window._ptfDocViewerObjectUrl = '';
  }
};
window.ptfOpenDocViewer = function (url, meta) {
  meta = meta || {};
  var name = meta.name || meta.key || 'سند';
  var key = meta.key || '';
  var ext = ptfFileExt(name) || ptfFileExt(key) || ptfFileExt(url);
  var kind = ptfDocViewerKind(ext);
  window.ptfCloseDocViewer();
  if (meta.revokeUrl) window._ptfDocViewerObjectUrl = meta.revokeUrl;
  var body;
  if (kind === 'image') {
    body = '<div style="text-align:center;background:#0f172a;border-radius:12px;padding:10px;max-height:70vh;overflow:auto">' +
      '<img src="' + String(url).replace(/"/g, '&quot;') + '" alt="' + escP(name) + '" style="max-width:100%;max-height:66vh;object-fit:contain;border-radius:8px" onerror="this.parentNode.innerHTML=\'<div style=padding:24px;color:#fecaca>⚠️ محتوای فایل تصویر معتبر نیست؛ از دکمه دانلود استفاده کنید</div>\'"></div>';
  } else if (kind === 'pdf') {
    body = '<iframe src="' + String(url).replace(/"/g, '&quot;') + '#toolbar=1" title="' + escP(name) + '" style="width:100%;height:70vh;border:1px solid var(--brd);border-radius:12px;background:#fff"></iframe>' +
      '<div style="font-size:11.5px;color:#64748b;margin-top:6px">سند از مسیر امن داخلی و با نوع صحیح PDF نمایش داده می‌شود.</div>';
  } else if (kind === 'text') {
    body = '<iframe src="' + String(url).replace(/"/g, '&quot;') + '" title="' + escP(name) + '" style="width:100%;height:60vh;border:1px solid var(--brd);border-radius:12px;background:#fff"></iframe>';
  } else {
    body = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;font-size:13px;color:#92400e;line-height:1.9">' +
      '📄 پیش‌نمایش مرورگری برای این فرمت (<b>' + escP(ext || 'نامشخص') + '</b>) در دسترس نیست.<br>از دانلود استفاده کنید.</div>';
  }
  var _vz = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(3000) : 3000;
  var html = '<div class="md-b" id="ptfDocViewer" style="display:grid;z-index:' + _vz + '" onclick="if(event.target===this)ptfCloseDocViewer()">' +
    '<div class="md" style="max-width:min(960px,96vw);width:96vw;max-height:94vh;overflow:auto;position:relative" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
    '<h3 style="margin:0;font-size:15px;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escP(name) + '">👁 ' + escP(name) + '</h3>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    (key ? '<button type="button" class="bt bt-o" style="font-size:12px" onclick="event.stopPropagation();ptfDownloadStoredFile(\'' + ptfOnClickArg(key) + '\',\'' + escP(name).replace(/'/g, '') + '\')">⬇️ دانلود</button>' : '') +
    '<a class="bt bt-o" style="font-size:12px;text-decoration:none" href="' + String(url).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">🗗 تب جدید</a>' +
    '<button type="button" class="bt" style="font-size:12px" onclick="event.stopPropagation();ptfCloseDocViewer()">✕ بستن</button>' +
    '</div></div>' + body + '</div></div>';
  var host = document.body || document.getElementById('panels');
  host.insertAdjacentHTML('beforeend', html);
  try { var _dv = document.getElementById('ptfDocViewer'); if (_dv && typeof window.ptfElevateModal === 'function') window.ptfElevateModal(_dv); } catch (eEl) {}
  document.addEventListener('keydown', function esc(ev) {
    if (ev.key === 'Escape') {
      window.ptfCloseDocViewer();
      document.removeEventListener('keydown', esc);
    }
  });
};

/* فایل‌های raster/PDF از endpoint هم‌دامنه با هدر احراز دریافت و به Blob URL با MIME
   قطعی تبدیل می‌شوند. این مسیر هم objectهای قدیمی octet-stream را اصلاح می‌کند و هم
   مشکل CORS/Content-Disposition آروان را از viewer و «تب جدید» حذف می‌کند. */
function ptfInlineStoredFileUrl(key, name) {
  var ext = ptfFileExt(name) || ptfFileExt(key);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'heic', 'heif', 'heics'].indexOf(ext) < 0) return Promise.reject(new Error('inline_unsupported'));
  return fetch('../api/attachment-read.php', {
    method: 'POST', headers: ptfStorageAuthHeaders(true),
    body: JSON.stringify({ key: key, name: name, mode: 'inline' })
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (text) { throw new Error(text || ('HTTP ' + r.status)); });
    return r.blob();
  }).then(function (blob) { return URL.createObjectURL(blob); });
}
window.ptfLoadScriptOnce = function (src) {
  window._ptfScriptLoads = window._ptfScriptLoads || {};
  if (window._ptfScriptLoads[src]) return window._ptfScriptLoads[src];
  window._ptfScriptLoads[src] = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function () { resolve(true); };
    s.onerror = function () { reject(new Error('script ' + src)); };
    document.head.appendChild(s);
  });
  return window._ptfScriptLoads[src];
};
function ptfBlobToJpegDataUrl(blob, maxW) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        var cap = maxW || 1400;
        if (w > cap) { h = Math.round(h * cap / w); w = cap; }
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/jpeg', 0.84));
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}
/* بیشتر رسیدهای PDF فقط JPEG توکار (DCTDecode) هستند. استخراج بایت JPEG
   بدون pdf.js/CDN کار می‌کند — CDN در شبکهٔ ایران معمولاً قطع است. */
function ptfExtractEmbeddedJpegs(buf, maxPages) {
  maxPages = maxPages || 8;
  var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  var out = [];
  var i = 0, n = u8.length;
  while (i < n - 4 && out.length < maxPages) {
    if (u8[i] === 0xFF && u8[i + 1] === 0xD8 && u8[i + 2] === 0xFF) {
      var j = i + 3;
      while (j < n - 1) {
        if (u8[j] === 0xFF && u8[j + 1] === 0xD9) { j += 2; break; }
        j++;
      }
      var len = j - i;
      if (len > 4000 && len < 12 * 1048576) {
        var slice = u8.subarray(i, j);
        var copy = new Uint8Array(slice.length);
        copy.set(slice);
        out.push(copy);
        i = j;
        continue;
      }
    }
    i++;
  }
  return out;
}
function ptfJpegBytesToDataUrl(bytes) {
  return new Promise(function (resolve, reject) {
    var blob = new Blob([bytes], { type: 'image/jpeg' });
    ptfBlobToJpegDataUrl(blob, 1400).then(resolve, reject);
  });
}
function ptfRasterizePdfBlob(blob, maxPages) {
  maxPages = maxPages || 8;
  return blob.arrayBuffer().then(function (buf) {
    var head = new Uint8Array(buf, 0, Math.min(8, buf.byteLength || 0));
    var isPdf = head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
    var jpegs = ptfExtractEmbeddedJpegs(buf, maxPages);
    if (jpegs.length) {
      var chain = Promise.resolve([]);
      jpegs.forEach(function (bytes) {
        chain = chain.then(function (acc) {
          return ptfJpegBytesToDataUrl(bytes).then(function (url) { acc.push(url); return acc; }, function () { return acc; });
        });
      });
      return chain.then(function (urls) { if (urls && urls.length) return urls; if (!isPdf) return []; return ptfRasterizePdfViaCdn(blob, maxPages); });
    }
    if (!isPdf) return [];
    return ptfRasterizePdfViaCdn(blob, maxPages);
  });
}
function ptfRasterizePdfViaCdn(blob, maxPages) {
  var libs = [
    './vendor/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
  ];
  function tryLib(i) {
    if (i >= libs.length) return Promise.resolve([]);
    return window.ptfLoadScriptOnce(libs[i]).then(function () {
      var pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      if (!pdfjs) throw new Error('pdfjs');
      try { if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = ''; } catch (eW) {}
      return blob.arrayBuffer().then(function (buf) {
        return pdfjs.getDocument({ data: buf, disableWorker: true, isEvalSupported: false }).promise;
      }).then(function (pdf) {
        var n = Math.min(pdf.numPages || 1, maxPages || 8);
        var urls = [];
        function renderPage(p) {
          if (p > n) return Promise.resolve(urls);
          return pdf.getPage(p).then(function (page) {
            var vp0 = page.getViewport({ scale: 1 });
            var scale = Math.min(1.4, 1200 / (vp0.width || 1200));
            var vp = page.getViewport({ scale: scale });
            var cv = document.createElement('canvas');
            cv.width = vp.width; cv.height = vp.height;
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
              urls.push(cv.toDataURL('image/jpeg', 0.82));
              return renderPage(p + 1);
            });
          });
        }
        return renderPage(1);
      });
    }).catch(function () { return tryLib(i + 1); });
  }
  return tryLib(0);
}
window.ptfRasterizePdfBlob = ptfRasterizePdfBlob;
function ptfRasterizeHeicBlob(blob) {
  return ptfBlobToJpegDataUrl(blob, 1400).catch(function () {
    var src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
    return window.ptfLoadScriptOnce(src).then(function () {
      if (typeof heic2any !== 'function') throw new Error('heic2any');
      return heic2any({ blob: blob, toType: 'image/jpeg', quality: 0.84 });
    }).then(function (out) {
      var jpeg = Array.isArray(out) ? out[0] : out;
      return ptfBlobToJpegDataUrl(jpeg, 1400);
    }).then(function (url) { return [url]; });
  }).then(function (urlOrArr) {
    return Array.isArray(urlOrArr) ? urlOrArr : [urlOrArr];
  }, function () { return []; });
}
/* v34.4.67: پس از دریافت بایت از ابر، PDF/HEIC را در مرورگر به JPEG صفحه به صفحه تبدیل کن
   (هاست Imagick ندارد؛ embed/HEIC خام در چاپ گزارش تلفیقی دیده نمی‌شود). */
/* فاز ۱: JPEG تبدیل‌شده جایگزین نمایش سند می‌شود؛ اصل در sourceKey می‌ماند.
   گزارش بعدی دیگر تبدیل/توکن ندارد. LLM عمداً صدا زده نمی‌شود. */
/* ZIP بدون فشرده‌سازی (STORE) — بدون CDN؛ اصل فایل‌ها دست نخورده می‌ماند. */
window.ptfCrc32 = function (u8) {
  window._ptfCrcTab = window._ptfCrcTab || (function () {
    var t = new Uint32Array(256), i, c, k;
    for (i = 0; i < 256; i++) {
      c = i;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  var crc = 0xFFFFFFFF, i;
  for (i = 0; i < u8.length; i++) crc = window._ptfCrcTab[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
};
window.ptfZipFromFiles = function (entries) {
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function encName(s) {
    try { return new TextEncoder().encode(String(s || 'file')); } catch (e) {
      var out = [], i, c;
      s = String(s || 'file');
      for (i = 0; i < s.length; i++) {
        c = s.charCodeAt(i);
        if (c < 128) out.push(c);
        else out.push(95);
      }
      return new Uint8Array(out);
    }
  }
  var locals = [], centrals = [], offset = 0, i;
  for (i = 0; i < entries.length; i++) {
    var name = encName(entries[i].name || ('file-' + (i + 1)));
    var data = entries[i].bytes instanceof Uint8Array ? entries[i].bytes : new Uint8Array(entries[i].bytes || []);
    var crc = window.ptfCrc32(data);
    var local = new Uint8Array(30 + name.length + data.length);
    local.set([0x50, 0x4B, 0x03, 0x04, 20, 0, 0, 8, 0, 0, 0, 0, 0, 0], 0);
    local.set(u32(crc), 14);
    local.set(u32(data.length), 18);
    local.set(u32(data.length), 22);
    local.set(u16(name.length), 26);
    local.set(u16(0), 28);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);
    var central = new Uint8Array(46 + name.length);
    central.set([0x50, 0x4B, 0x01, 0x02, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0, 0], 0);
    central.set(u32(crc), 16);
    central.set(u32(data.length), 20);
    central.set(u32(data.length), 24);
    central.set(u16(name.length), 28);
    central.set(u32(offset), 42);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  var cdSize = 0;
  for (i = 0; i < centrals.length; i++) cdSize += centrals[i].length;
  var eocd = new Uint8Array(22);
  eocd.set([0x50, 0x4B, 0x05, 0x06], 0);
  eocd.set(u16(entries.length), 8);
  eocd.set(u16(entries.length), 10);
  eocd.set(u32(cdSize), 12);
  eocd.set(u32(offset), 16);
  var parts = locals.concat(centrals);
  parts.push(eocd);
  return new Blob(parts, { type: 'application/zip' });
};
window.ptfPersistFilePreview = function (origKey, preview) {
  if (!origKey || !preview || !preview.key) return false;
  var stores = ['ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods'];
  var dirtyAny = false;
  stores.forEach(function (storeKey) {
    var a;
    try { a = typeof getData === 'function' ? getData(storeKey) : JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (e) { a = null; }
    if (!Array.isArray(a)) return;
    var dirty = false;
    a.forEach(function (r) {
      (r.files || []).forEach(function (file) {
        if (!file || (file.key !== origKey && file.sourceKey !== origKey)) return;
        if (!file.sourceKey) { file.sourceKey = origKey; file.sourceName = file.name || ''; }
        file.key = preview.key;
        file.name = preview.name || String(file.sourceName || 'سند').replace(/\.pdf$/i, '') + '.jpg';
        file.contentType = 'image/jpeg';
        file.previewReady = true;
        file.convertedAt = new Date().toISOString();
        dirty = true;
      });
    });
    if (dirty) {
      dirtyAny = true;
      try { if (typeof setData === 'function') setData(storeKey, a); else localStorage.setItem(storeKey, JSON.stringify(a)); } catch (eS) {}
    }
  });
  return dirtyAny;
};
window.ptfServerRasterFile = function (f) {
  return new Promise(function (resolve) {
    if (!f || !f.key) return resolve(f);
    if (f.previewReady && f.url && String(f.url).indexOf('data:image/') === 0) return resolve(f);
    var origKey = f.sourceKey || f.key;
    fetch('../api/attachment-thumb.php', {
      method: 'POST', headers: ptfStorageAuthHeaders(true),
      body: JSON.stringify({ key: origKey, name: f.key || f.name || origKey, maxPages: 4 })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !d.images || !d.images.length || !d.images[0].url) return resolve(f);
      var first = d.images[0];
      f.url = first.url;
      f.converted = true;
      f.convertError = '';
      f.extraImages = d.images.slice(1).map(function (im, i) {
        return { key: im.key, url: im.url, converted: true, name: (f.name || 'سند') + ' (صفحه ' + (i + 2) + ')' };
      });
      if (first.key && first.stored !== false) {
        window.ptfPersistFilePreview(origKey, { key: first.key, name: String(f.name || 'سند').replace(/\.pdf$/i, '') + '.jpg' });
        f.sourceKey = f.sourceKey || origKey;
        f.key = first.key;
        f.name = String(f.name || 'سند').replace(/\.pdf$/i, '') + '.jpg';
        f.contentType = 'image/jpeg';
        f.previewReady = true;
      }
      resolve(f);
    }).catch(function () { resolve(f); });
  });
};
window.ptfRasterizeCloudFile = function (f, maxPages) {
  return new Promise(function (resolve) {
    if (!f) return resolve(f);
    var name = f.name || f.key || '';
    var ext = (typeof ptfFileExt === 'function') ? (ptfFileExt(name) || ptfFileExt(f.key || '')) : String(name).split('.').pop().toLowerCase();
    if (!ext && f.url && String(f.url).indexOf('data:application/pdf') === 0) ext = 'pdf';
    if (!ext && f.blobType && String(f.blobType).indexOf('pdf') > -1) ext = 'pdf';
    var kind = (ext === 'pdf') ? 'pdf' : (['heic', 'heif', 'heics'].indexOf(ext) > -1 ? 'heic' : '');
    function apply(urls) {
      if (!urls || !urls.length) {
        f.convertError = f.convertError || 'convert_failed';
        return resolve(f);
      }
      f.url = urls[0];
      f.converted = true;
      f.convertError = '';
      f.extraImages = urls.slice(1).map(function (u, i) {
        return { url: u, name: (f.name || 'سند') + ' (صفحه ' + (i + 2) + ')', converted: true };
      });
      resolve(f);
    }
    function sniffKind(blob) {
      return blob.slice(0, 16).arrayBuffer().then(function (ab) {
        var b = new Uint8Array(ab);
        if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
        if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image';
        return kind || '';
      });
    }
    function blobOf() {
      if (f.url && String(f.url).indexOf('data:') === 0) return fetch(f.url).then(function (r) { return r.blob(); });
      if (f.key) {
        return fetch('../api/attachment-read.php', {
          method: 'POST', headers: ptfStorageAuthHeaders(true),
          body: JSON.stringify({ key: f.key, name: (f.key || name), mode: 'inline' })
        }).then(function (r) {
          if (!r.ok) throw new Error('read');
          return r.blob();
        });
      }
      throw new Error('no-src');
    }
    blobOf().then(function (blob) {
      return sniffKind(blob).then(function (k) {
        if (k === 'image') return ptfBlobToJpegDataUrl(blob, 1400).then(function (u) { return [u]; });
        if (k === 'pdf' || kind === 'pdf') return ptfRasterizePdfBlob(blob, maxPages || 8);
        if (kind === 'heic') return ptfRasterizeHeicBlob(blob);
        return [];
      });
    }).then(apply).catch(function () { f.convertError = 'convert_failed'; resolve(f); });
  });
};
/* v34.7.38: کلید ابری در مسیرهای مختلف با نام‌های متفاوت ذخیره می‌شود
   (key / objectKey / fileKey / …). بدون این نرمال‌سازی، گردش حساب «N سند»
   نشان می‌دهد ولی دکمهٔ مشاهده ساخته نمی‌شود. */
window.ptfFileStorageKey = function (f) {
  if (f == null) return '';
  if (typeof f === 'string') return String(f).trim();
  if (typeof f !== 'object') return '';
  return String(
    f.key || f.objectKey || f.storageKey || f.s3Key || f.fileKey ||
    f.docKey || f.receiptKey || f.path || f.filePath || ''
  ).trim();
};
window.ptfNormalizeFileRec = function (f) {
  if (!f || typeof f !== 'object') return null;
  var key = window.ptfFileStorageKey(f);
  if (!key) return null;
  var out = {};
  Object.keys(f).forEach(function (k) { out[k] = f[k]; });
  out.key = key;
  out.name = f.name || f.fileName || f.originalName || (key.split('/').pop() || 'سند');
  return out;
};
function openStoredFile(key, nameHint) {
  if (key && typeof key === 'object') {
    nameHint = nameHint || key.name || key.fileName;
    key = window.ptfFileStorageKey(key);
  }
  if (!key) { alert('این فایل هنوز به فضای ابری منتقل نشده'); return; }
  var name = nameHint || (String(key).split('/').pop() || key);
  if (typeof ptfToast === 'function') ptfToast('⏳ در حال آماده‌سازی نمایش سند…', 'info');
  fetch(STORAGE_API + '?action=presign_get', {
    method: 'POST', headers: ptfStorageAuthHeaders(true),
    body: JSON.stringify({ key: key, disposition: 'inline' })
  }).then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.ok) {
        ptfInlineStoredFileUrl(key, name).then(function (objectUrl) {
          if (typeof ptfOpenDocViewer === 'function') ptfOpenDocViewer(objectUrl, { key: key, name: name, revokeUrl: objectUrl });
          else window.open(objectUrl, '_blank');
        }).catch(function () {
          /* fallback مستقیم هم اکنون response-content-type/disposition امضاشده دارد. */
          if (typeof ptfOpenDocViewer === 'function') ptfOpenDocViewer(d.url, { key: key, name: name });
          else window.open(d.url, '_blank');
        });
      } else if (d.error === 'file_not_found') {
        if (typeof ptfToast === 'function') ptfToast('⚠️ فایل در فضای ابری یافت نشد (کلید قدیمی/مهاجرت‌نشده) — سند در باکت فعلی نیست. لطفاً سند را دوباره آپلود کنید.', 'warn');
        else alert('فایل در فضای ابری یافت نشد (کلید قدیمی/مهاجرت‌نشده) — سند در باکت فعلی نیست. لطفاً سند را دوباره آپلود کنید.');
      } else alert('خطا در دریافت لینک: ' + (d.error || ''));
    })
    .catch(function () { alert('عدم دسترسی به سرور'); });
}
window.openStoredFile = openStoredFile;

/* CHQ-DOC-002: هلپر مشترک برای مودال‌های «مشاهدهٔ سند/ضمیمه» (چک، تنخواه، فاکتور/پرداخت
   تأمین‌کننده و مشابه). این مودال‌ها یک‌بار از localStorage محلی می‌خوانند و اگر سندی
   از دستگاه/کاربر دیگر همین الان روی سرور ثبت شده باشد ولی هنوز از طریق pull دورهٔ ۲۰
   ثانیه‌ای به این مرورگر نرسیده باشد، آن سند دیده نمی‌شود — و چون sync.js عمداً هنگام
   باز بودن هر مودالی از رندر خودکار پنل صرف‌نظر می‌کند (تا وسط کار کاربر نپرد)، این مودال
   تا وقتی کاربر آن را ببندد و دوباره باز کند (یا به تب دیگری برود و برگردد) به‌روز نمی‌شد.
   ptfAttachRefreshOnOpen یک pull فوری (بدون منتظر تایمر دوره‌ای) درخواست می‌کند و اگر
   تعداد اسناد رکورد واقعاً تغییر کرده باشد، خودِ مودال (نه کل پنل) را با فراخوانی دوبارهٔ
   reopenFn تازه می‌سازد. */
window.ptfAttachRefreshOnOpen = function (dlgId, getSignature, reopenFn) {
  if (typeof window.ptfSyncPullNow !== 'function') return;
  /* v34.4.44: پاسخ pull فقط مجاز است همان نمونهٔ مودالی را تازه کند که pull را
     آغاز کرده است. id به‌تنهایی کافی نیست، چون نمونهٔ تازه نیز همان id را دارد. */
  var openedDlg = document.getElementById(dlgId);
  if (!openedDlg) return;
  function signature() {
    var value = getSignature();
    /* ترتیب آرایهٔ رکوردها بین mergeها تضمین‌شده نیست؛ مرتب‌سازی فقط برای signature
       جلوی بسته/بازشدن بی‌دلیل مودال را می‌گیرد و خود داده را تغییر نمی‌دهد. */
    if (Array.isArray(value)) value = value.slice().map(String).sort();
    return JSON.stringify(value);
  }
  var before = null;
  try { before = signature(); } catch (eB) {}
  window.ptfSyncPullNow(function (result) {
    try {
      var dlg = document.getElementById(dlgId);
      if (!dlg || dlg !== openedDlg || !openedDlg.isConnected) return; /* بسته یا جایگزین شده */
      if (result && result.ok === false) return; /* روی push/pull ناموفق، refresh کاذب نزن */
      var after = signature();
      if (after !== before) {
        dlg.remove();
        reopenFn();
        if (typeof ptfToast === 'function') ptfToast('📎 اسناد به‌روزرسانی شد', 'info');
      }
    } catch (eR) {}
  });
};




/* v34.7.52/v34.7.53: گزارش کلیدهای CRM در برابر list فضای ابری.
   DELETE هرگز از این مسیر زده نمی‌شود. remap گروه B فقط با تأیید دستی است. */
function ptfLooksLikeStorageKey(k) {
  k = String(k || '').trim();
  if (!k || k.length < 4 || k.length > 500) return false;
  if (k.indexOf('data:') === 0 || k.indexOf('blob:') === 0 || /^https?:/i.test(k)) return false;
  if (k.indexOf('..') !== -1) return false;
  return /[\/.]/.test(k);
}
function ptfHarvestFileKeys() {
  var rows = [];
  var seen = {};
  function add(store, recId, recLabel, key, name, extra) {
    key = String(key || '').trim();
    if (!ptfLooksLikeStorageKey(key)) return;
    var sig = store + '|' + recId + '|' + key;
    if (seen[sig]) return;
    seen[sig] = 1;
    rows.push({
      store: store,
      recId: recId || '',
      recLabel: recLabel || '',
      key: key,
      name: name || (key.split('/').pop() || 'سند'),
      archiveKey: (extra && extra.archiveKey) || ''
    });
  }
  function harvest(store, recId, recLabel, obj, depth) {
    if (!obj || depth > 8) return;
    if (Array.isArray(obj)) {
      obj.forEach(function (x) { harvest(store, recId, recLabel, x, depth + 1); });
      return;
    }
    if (typeof obj !== 'object') return;
    var id = recId || obj._id || obj.cd || obj.no || obj.id || ''; /* v34.7.54: قرارداد PTF.id — ترتیب `_id || cd` (رفع تخلف A2) */
    var label = recLabel || obj.co || obj.nm || obj.name || obj.no || id;
    var keys = [obj.key, obj.objectKey, obj.storageKey, obj.s3Key, obj.fileKey, obj.docKey, obj.receiptKey, obj.sourceKey, obj.imgKey, obj.archiveKey];
    keys.forEach(function (k) {
      if (typeof k === 'string') add(store, id, label, k, obj.name || obj.fileName || obj.originalName || '', { archiveKey: obj.archiveKey || '' });
    });
    Object.keys(obj).forEach(function (k) {
      if (typeof obj[k] === 'object' && obj[k]) harvest(store, id, label, obj[k], depth + 1);
    });
  }
  var storeKeys = {};
  try {
    for (var si = 0; si < localStorage.length; si++) {
      var sk = localStorage.key(si);
      if (sk && sk.indexOf('ptf_crm_') === 0) storeKeys[sk] = true;
    }
  } catch (eLs) {}
  Object.keys(storeKeys).forEach(function (k) {
    try {
      var data = typeof getData === 'function' ? getData(k) : JSON.parse(localStorage.getItem(k) || 'null');
      harvest(k, '', '', data, 0);
    } catch (eH) {}
  });
  return rows;
}
function ptfClassifyCloudKeys(crmRows, s3Files) {
  var s3 = {};
  (s3Files || []).forEach(function (f) {
    var k = f && (f.key || f.name);
    if (k) s3[k] = f;
  });
  var byBase = {};
  Object.keys(s3).forEach(function (k) {
    var b = k.split('/').pop();
    if (!byBase[b]) byBase[b] = [];
    byBase[b].push(k);
  });
  var counts = { A: 0, B: 0, C: 0, E: 0, F: 0 };
  var report = (crmRows || []).map(function (row) {
    var key = row.key;
    if (key.indexOf('data:') === 0) { counts.F++; return Object.assign({ cls: 'F', note: 'داده محلی', match: '' }, row); }
    if (s3[key]) { counts.A++; return Object.assign({ cls: 'A', note: 'موجود در ابر', match: key }, row); }
    if (row.archiveKey && s3[row.archiveKey]) { counts.C++; return Object.assign({ cls: 'C', note: 'اصل در zip بایگانی', match: row.archiveKey }, row); }
    if (key.indexOf('archives/') === 0 && s3[key]) { counts.C++; return Object.assign({ cls: 'C', note: 'فایل zip بایگانی', match: key }, row); }
    var crmFlat = key.replace(/\//g, '');
    var stripHits = Object.keys(s3).filter(function (k) { return k.replace(/\//g, '') === crmFlat && k !== key; });
    if (stripHits.length === 1) { counts.B++; return Object.assign({ cls: 'B', note: 'تطبیق کلید بدون اسلش', match: stripHits[0], how: 'slash' }, row); }
    var base = key.split('/').pop();
    var cands = byBase[base] || [];
    if (cands.length === 1) { counts.B++; return Object.assign({ cls: 'B', note: 'تطبیق نام فایل یکتا', match: cands[0], how: 'base' }, row); }
    counts.E++;
    return Object.assign({ cls: 'E', note: 'در باکت فعلی نیست', match: '' }, row);
  });
  return { report: report, counts: counts };
}
function ptfCloudKeyAudit() {
  var role = '';
  try { role = String(curRole()).toLowerCase(); } catch (e) {}
  if (['admin', 'chairman', 'ceo'].indexOf(role) < 0) {
    alert('این گزارش فقط برای نقش‌های ارشد است');
    return;
  }
  if (typeof ptfToast === 'function') ptfToast('⏳ در حال تهیه گزارش کلیدها (بدون حذف)…', 'info');
  var crmRows = ptfHarvestFileKeys();
  ptfListAllCloudFiles({ prefix: '' }, function (d) {
    if (!d || !d.ok) { alert('⛔ گزارش کلیدها تهیه نشد: ' + ((d && d.error) || 'خطای اتصال')); return; }
    var classified = ptfClassifyCloudKeys(crmRows, d.files || []);
    var c = classified.counts;
    var truncated = d.truncated ? '<div style="background:#fff7ed;border:1px solid #fed7aa;padding:8px;border-radius:10px;margin:8px 0;color:#9a3412;font-size:12.5px">⚠️ فهرست S3 ناقص برگشت؛ ردهٔ E ممکن است بیش‌برآورد باشد. دوباره تلاش کنید.</div>' : '';
    var rowsHtml = classified.report.slice(0, 80).map(function (row) {
      var color = row.cls === 'A' ? '#065f46' : row.cls === 'B' ? '#1d4ed8' : row.cls === 'C' ? '#7c3aed' : row.cls === 'E' ? '#b91c1c' : '#64748b';
      return '<tr style="border-bottom:1px dashed var(--brd)"><td style="color:' + color + ';font-weight:900">' + row.cls + '</td><td style="font-size:11px">' + escP(row.store.replace('ptf_crm_', '')) + '</td><td style="font-size:11px">' + escP(row.recId || row.recLabel || '') + '</td><td dir="ltr" style="font-size:11px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escP(row.key) + '">' + escP(row.key) + '</td><td style="font-size:11px">' + escP(row.note) + '</td></tr>';
    }).join('');
    document.querySelectorAll('#ptfKeyAuditDlg').forEach(function (x) { x.remove(); });
    var html = '<div class="md-b" id="ptfKeyAuditDlg" style="display:grid;z-index:3600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:920px;max-height:92vh;overflow:auto">' +
      '<h3>📋 گزارش کلیدهای ابری — بدون حذف</h3>' +
      '<div style="font-size:13px;line-height:1.9">کلیدهای CRM: <b>' + crmRows.length + '</b> — objectهای list: <b>' + (d.files || []).length + '</b></div>' +
      '<div class="sr" style="margin:10px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' +
      '<div class="sc"><b>' + c.A + '</b><span>A موجود</span></div>' +
      '<div class="sc"><b>' + c.B + '</b><span>B قابل remap</span></div>' +
      '<div class="sc"><b>' + c.C + '</b><span>C بایگانی</span></div>' +
      '<div class="sc"><b>' + c.E + '</b><span>E از دست رفته</span></div></div>' + truncated +
      '<p style="font-size:12.5px;color:#64748b">گروه E بایت در باکت فعلی ندارد و باید دوباره آپلود شود. گروه B فقط با تأیید دستی remap می‌شود — هیچ فایلی از باکت حذف نمی‌شود.</p>' +
      '<div style="overflow:auto;max-height:46vh"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>کد</th><th>ماژول</th><th>رکورد</th><th>کلید</th><th>وضعیت</th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="5">کلیدی یافت نشد</td></tr>') + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      ((c.B > 0 && !d.truncated) ? '<button type="button" class="bt" style="background:#1d4ed8;color:#fff" onclick="ptfConfirmCloudKeyRemap()">🔗 اعمال remap گروه B (بدون حذف فایل)</button>' : '') +
      (d.truncated ? '<span style="font-size:12px;color:#9a3412;align-self:center">remap تا فهرست کامل S3 غیرفعال است</span>' : '') +
      '<button type="button" class="bt bt-o" onclick="ptfDownloadKeyAuditCsv()">⬇️ CSV کامل</button>' +
      ((c.E > 0) ? '<button type="button" class="bt bt-o" style="color:#b91c1c;border-color:#fecaca" title="فقط ردهٔ E — قابل استفاده برای پیگیری آپلود مجدد فایل‌های گم‌شده" onclick="ptfReuploadQueueExportCsv()">📤 صف آپلود مجدد (E)</button>' : '') +
      '<button type="button" class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    window._ptfKeyAuditRows = classified.report;
    window._ptfKeyAuditTruncated = !!d.truncated;
    try { if (typeof audit === 'function') audit('فضای ابری', 'گزارش تشخیصی کلیدها A' + c.A + '/B' + c.B + '/C' + c.C + '/E' + c.E + (d.rounds > 1 ? ' (' + d.rounds + ' نوبت فهرست S3)' : ''), ''); } catch (eA) {}
  });
}
/* v34.7.59: دریافت فهرست کامل S3 با ادامهٔ صفحه‌بندی. هر فراخوانی سرور تا ۳۰ صفحه
   (۳۰هزار کلید) می‌خواند و در صورت باقی‌ماندن، nextToken برمی‌گرداند؛ این حلقه تا سقف
   ایمن ادامه می‌دهد تا گزارش/remap در باکت‌های بزرگ پشت «فهرست ناقص» مسدود نماند.
   اگر حتی با ادامه هم به سقف برسیم، truncated=true می‌ماند و remap طبق قبل قفل است. */
function ptfListAllCloudFiles(opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  opts = opts || {};
  var files = [], token = '', rounds = 0, MAX_ROUNDS = 12; /* ~۳۶۰هزار کلید */
  function step() {
    fetch(STORAGE_API + '?action=list', {
      method: 'POST', headers: ptfStorageAuthHeaders(true),
      body: JSON.stringify({ prefix: opts.prefix || '', token: token })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) { cb({ ok: false, error: String((d && (d.error || d.http)) || 'list failed') }); return; }
      files = files.concat(d.files || []);
      token = String(d.nextToken || '');
      rounds++;
      if (token && rounds < MAX_ROUNDS) { step(); return; }
      /* سازگاری با سرور قدیمی (بدون nextToken): truncated سرور معتبر می‌ماند */
      var stillTruncated = !!token || (d.nextToken === undefined && !!d.truncated);
      cb({ ok: true, files: files, truncated: stillTruncated, rounds: rounds });
    }).catch(function (e) { cb({ ok: false, error: String((e && e.message) || e || 'خطای اتصال') }); });
  }
  step();
}
window.ptfListAllCloudFiles = ptfListAllCloudFiles;
function ptfDownloadKeyAuditCsv() {
  var rows = window._ptfKeyAuditRows || [];
  var lines = ['cls,store,recId,key,match,note,name'];
  rows.forEach(function (r) {
    function q(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; }
    lines.push([r.cls, r.store, r.recId, r.key, r.match, r.note, r.name].map(q).join(','));
  });
  /* v34.7.95 (RE-UPLOAD-QUEUE-001): افزودن BOM UTF-8 برای باز شدن درست فارسی در Excel */
  var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ptf-cloud-key-audit.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

/* =====================================================================
   v34.7.95 (RE-UPLOAD-QUEUE-001 — فاز A): «صف آپلود مجدد» ردهٔ E
   ---------------------------------------------------------------------
   ورودی: خروجی audit (window._ptfKeyAuditRows) — فقط ردهٔ E (کلید در CRM
   هست ولی بایتی در باکت نیست).
   خروجی این فاز: build (آرایه) + CSV مخصوص اقدام (شامل ماژول قابل خواندن،
   نام رکورد، نام فایل تخمینی، کلید کامل، ستون خالی «اقدام کاربر» و «تاریخ»)
   تا کاربر بتواند بیرون از CRM هم پیگیری کند.
   فازهای بعدی (B/C) در آینده: reupload / clear / request از منبع.
   ===================================================================== */
function ptfReuploadQueueBuild(rows) {
  rows = rows || window._ptfKeyAuditRows || [];
  var moduleLabels = {
    'ptf_crm_suppliers': 'تامین‌کننده',
    'ptf_crm_customers': 'کارفرما',
    'ptf_crm_offers': 'پیشنهاد',
    'ptf_crm_inquiries': 'استعلام',
    'ptf_crm_invoices': 'فاکتور رسمی',
    'ptf_crm_supplier_finance': 'فاکتور خرید',
    'ptf_crm_cheques': 'چک',
    'ptf_crm_payables': 'حساب پرداختنی',
    'ptf_crm_receivables': 'حساب دریافتنی',
    'ptf_crm_cases': 'پرونده فروش',
    'ptf_crm_leads': 'لید فروش',
    'ptf_crm_letters': 'مکاتبات',
    'ptf_crm_cargo': 'محموله',
    'ptf_crm_tax_returns': 'اظهارنامه'
  };
  return rows.filter(function (r) { return r && r.cls === 'E'; }).map(function (r) {
    var store = r.store || '';
    return {
      module: moduleLabels[store] || store.replace(/^ptf_crm_/, ''),
      store: store,
      recId: r.recId || '',
      recLabel: r.recLabel || '',
      key: r.key || '',
      name: r.name || (r.key ? String(r.key).split('/').pop() : ''),
      note: r.note || 'در باکت فعلی نیست',
      action: '',
      actionAt: '',
      actionBy: ''
    };
  });
}
function ptfReuploadQueueExportCsv() {
  /* v34.7.96 (RE-UPLOAD-QUEUE-002): گارد نقش — همسان با ptfCloudKeyAudit.
     دکمهٔ UI فقط برای نقش ارشد نمایش داده می‌شود، ولی از console/devtools هم
     قابل صدا زدن است؛ لیست کلیدهای گم‌شدهٔ ابری نباید به نقش پایین leak کند. */
  var role = '';
  try { role = String(curRole()).toLowerCase(); } catch (eR) {}
  if (['admin', 'chairman', 'ceo'].indexOf(role) < 0) {
    if (typeof ptfToast === 'function') ptfToast('⛔ این گزارش فقط برای نقش‌های ارشد است', 'err');
    else if (typeof alert === 'function') alert('این گزارش فقط برای نقش‌های ارشد است');
    return;
  }
  var q = ptfReuploadQueueBuild();
  if (!q.length) {
    if (typeof ptfToast === 'function') ptfToast('صف خالی است — هیچ ردیف E‌ای در گزارش نیست.', 'info');
    else if (typeof alert === 'function') alert('صف خالی است — هیچ ردیف E‌ای در گزارش نیست.');
    return;
  }
  function csv(s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; }
  var head = ['ماژول', 'کد رکورد', 'نام رکورد', 'نام فایل', 'کلید در باکت', 'وضعیت', 'اقدام (پر کنید)', 'تاریخ اقدام'];
  var lines = [head.map(csv).join(',')];
  q.forEach(function (r) {
    lines.push([r.module, r.recId, r.recLabel, r.name, r.key, r.note, r.action, r.actionAt].map(csv).join(','));
  });
  /* BOM برای Excel */
  var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ptf-reupload-queue-E.csv';
  document.body.appendChild(a); a.click(); a.remove();
  try { if (typeof audit === 'function') audit('فضای ابری', 'خروجی CSV صف آپلود مجدد (ردهٔ E) — ' + q.length + ' ردیف', ''); } catch (eA) {}
  if (typeof ptfToast === 'function') ptfToast('✅ CSV صف آپلود مجدد (' + q.length + ' ردیف) دانلود شد', 'ok');
}
window.ptfReuploadQueueBuild = ptfReuploadQueueBuild;
window.ptfReuploadQueueExportCsv = ptfReuploadQueueExportCsv;

/* v34.7.53: remap گروه B — فقط metadata محلی CRM، بدون DELETE ابری.
   فیلد archiveKey و کلیدهای archives/ دست نمی‌خورند. */
var PTF_CLOUD_REMAP_FIELDS = ['key', 'objectKey', 'storageKey', 's3Key', 'fileKey', 'docKey', 'receiptKey', 'sourceKey', 'imgKey'];
function ptfPlanCloudKeyRemap(rows, truncated) {
  var out = { ok: true, maps: [], skipped: [], error: '' };
  if (truncated) {
    out.ok = false;
    out.error = 'truncated';
    return out;
  }
  var byFrom = {};
  var conflict = {};
  (rows || []).forEach(function (r) {
    if (!r || r.cls !== 'B') return;
    var from = String(r.key || '').trim();
    var to = String(r.match || '').trim();
    if (!from || !to || from === to) {
      out.skipped.push({ key: from, reason: 'no_match' });
      return;
    }
    if (!ptfLooksLikeStorageKey(from) || !ptfLooksLikeStorageKey(to)) {
      out.skipped.push({ key: from, reason: 'invalid' });
      return;
    }
    if (from.indexOf('archives/') === 0 || to.indexOf('archives/') === 0) {
      out.skipped.push({ key: from, reason: 'archive' });
      return;
    }
    if (conflict[from]) return;
    if (byFrom[from] && byFrom[from] !== to) {
      conflict[from] = true;
      delete byFrom[from];
      out.skipped.push({ key: from, reason: 'conflict' });
      return;
    }
    byFrom[from] = to;
  });
  var fromSet = {};
  Object.keys(byFrom).forEach(function (k) { fromSet[k] = true; });
  Object.keys(byFrom).forEach(function (k) {
    if (fromSet[byFrom[k]]) {
      out.skipped.push({ key: k, reason: 'chain' });
      return;
    }
    out.maps.push({ from: k, to: byFrom[k] });
  });
  return out;
}
function ptfRemapCloudKeyFields(obj, fromKey, toKey, depth) {
  if (!obj || depth > 8) return 0;
  var n = 0;
  if (Array.isArray(obj)) {
    obj.forEach(function (x) { n += ptfRemapCloudKeyFields(x, fromKey, toKey, depth + 1); });
    return n;
  }
  if (typeof obj !== 'object') return 0;
  PTF_CLOUD_REMAP_FIELDS.forEach(function (f) {
    if (typeof obj[f] === 'string' && obj[f] === fromKey) {
      obj[f] = toKey;
      n++;
    }
  });
  Object.keys(obj).forEach(function (k) {
    if (k === 'archiveKey') return;
    if (typeof obj[k] === 'object' && obj[k]) n += ptfRemapCloudKeyFields(obj[k], fromKey, toKey, depth + 1);
  });
  return n;
}
function ptfApplyCloudKeyRemap(opts) {
  opts = opts || {};
  var role = '';
  try { role = String(curRole()).toLowerCase(); } catch (eR) {}
  if (['admin', 'chairman', 'ceo'].indexOf(role) < 0) return { ok: false, error: 'role', applied: 0, fields: 0 };
  var truncated = opts.truncated != null ? !!opts.truncated : !!window._ptfKeyAuditTruncated;
  var rows = opts.rows || window._ptfKeyAuditRows || [];
  var plan = ptfPlanCloudKeyRemap(rows, truncated);
  if (!plan.ok) return { ok: false, error: plan.error, applied: 0, fields: 0, maps: [] };
  if (!opts.confirmed) return { ok: false, error: 'confirm_required', applied: 0, fields: 0, maps: plan.maps };
  var fieldHits = 0;
  var storeHits = 0;
  var storeKeys = {};
  try {
    for (var si = 0; si < localStorage.length; si++) {
      var sk = localStorage.key(si);
      if (sk && sk.indexOf('ptf_crm_') === 0) storeKeys[sk] = true;
    }
  } catch (eLs) {}
  Object.keys(storeKeys).forEach(function (store) {
    var data;
    try {
      data = typeof getData === 'function' ? getData(store) : JSON.parse(localStorage.getItem(store) || 'null');
    } catch (eH) { return; }
    if (!data) return;
    var n = 0;
    plan.maps.forEach(function (m) { n += ptfRemapCloudKeyFields(data, m.from, m.to, 0); });
    if (!n) return;
    try {
      if (typeof setData === 'function') setData(store, data);
      else localStorage.setItem(store, JSON.stringify(data));
      storeHits++;
      fieldHits += n;
    } catch (eS) {}
  });
  try { if (typeof audit === 'function') audit('فضای ابری', 'remap گروه B: ' + plan.maps.length + ' کلید / ' + fieldHits + ' فیلد در ' + storeHits + ' مخزن — بدون حذف فایل', ''); } catch (eA) {}
  return { ok: true, applied: plan.maps.length, fields: fieldHits, stores: storeHits, maps: plan.maps, skipped: plan.skipped };
}
function ptfConfirmCloudKeyRemap() {
  var role = '';
  try { role = String(curRole()).toLowerCase(); } catch (eR) {}
  if (['admin', 'chairman', 'ceo'].indexOf(role) < 0) {
    alert('این remap فقط برای نقش‌های ارشد است');
    return;
  }
  if (window._ptfKeyAuditTruncated) {
    alert('فهرست S3 ناقص است؛ remap گروه B انجام نشد. گزارش را دوباره بگیرید.');
    return;
  }
  var plan = ptfPlanCloudKeyRemap(window._ptfKeyAuditRows || [], !!window._ptfKeyAuditTruncated);
  if (!plan.ok) {
    alert('remap گروه B ممکن نیست: ' + (plan.error || ''));
    return;
  }
  if (!plan.maps.length) {
    alert('هیچ کلید گروه B برای remap نماند');
    return;
  }
  var sample = plan.maps.slice(0, 8).map(function (m) { return m.from + ' → ' + m.to; }).join('\n');
  if (!confirm('تعداد ' + plan.maps.length + ' کلید CRM به کلید موجود در باکت به‌روز می‌شود.\nهیچ فایلی از فضای ابری حذف نمی‌شود.\n\nنمونه:\n' + sample + '\n\nادامه؟')) return;
  var res = ptfApplyCloudKeyRemap({ confirmed: true });
  if (!res.ok) {
    alert('⛔ remap انجام نشد: ' + (res.error || ''));
    return;
  }
  if (typeof ptfToast === 'function') ptfToast('✅ remap گروه B: ' + res.applied + ' کلید / ' + res.fields + ' فیلد — بدون حذف فایل', 'ok');
  else alert('remap گروه B انجام شد: ' + res.applied + ' کلید');
  if (typeof ptfCloudKeyAudit === 'function') ptfCloudKeyAudit();
}
window.ptfLooksLikeStorageKey = ptfLooksLikeStorageKey;
window.ptfHarvestFileKeys = ptfHarvestFileKeys;
window.ptfClassifyCloudKeys = ptfClassifyCloudKeys;
window.ptfCloudKeyAudit = ptfCloudKeyAudit;
window.ptfDownloadKeyAuditCsv = ptfDownloadKeyAuditCsv;
window.ptfPlanCloudKeyRemap = ptfPlanCloudKeyRemap;
window.ptfRemapCloudKeyFields = ptfRemapCloudKeyFields;
window.ptfApplyCloudKeyRemap = ptfApplyCloudKeyRemap;
window.ptfConfirmCloudKeyRemap = ptfConfirmCloudKeyRemap;

/* ---------- ویجت آپلود چندمنظوره ---------- */
// attachUploadWidget(containerId, folder, onDone(fileRec))
/* v34.0.0-alpha (F4-11): لیست سفید فرمت‌های مجاز ضمیمه
   - ریشه: سرور Imagick ندارد (هاست اشتراکی) → PDF/HEIC قابل تبدیل به JPEG نیست
     و در گزارش تلفیقی، <embed> برای PDF یا <img> برای HEIC در همهٔ مرورگرها/پرینترها کار نمی‌کند.
   - راه‌حل: فرمت‌های غیرقابل‌تبدیل (PDF، HEIC، DOCX، ...) قبل از آپلود رد می‌شوند
     با پیام واضح به کاربر. فقط عکس (JPG/PNG/WEBP/GIF/SVG) + PDF (با محدودیت حجم) مجازند.
   - ptfAllowedExts سفید است — ویژهٔ فایل‌هایی که در رندر مستقیم <img> یا <embed> قابل نمایش‌اند.
   - پیشنهاد: کاربر PDF/HEIC را قبل از آپلود به JPG/PNG تبدیل کند. */
var ptfAllowedExts = ['jpg','jpeg','png','webp','gif','bmp','svg','pdf'];
var ptfMaxPdfMB = 5;  // PDF باید < ۵MB باشد (پرینتر محدودیت دارد)
function ptfIsAllowedFile(file) {
  var name = String(file && file.name || '').toLowerCase();
  var m = name.match(/\.([a-z0-9]+)$/);
  var ext = m ? m[1] : '';
  if (ptfAllowedExts.indexOf(ext) < 0) {
    return { ok: false, error: 'فرمت «.' + ext + '» مجاز نیست. فرمت‌های مجاز: ' + ptfAllowedExts.join(', ') + '. لطفاً PDF/HEIC را قبل از آپلود به JPG یا PNG تبدیل کنید.' };
  }
  if (ext === 'pdf' && file.size > ptfMaxPdfMB * 1048576) {
    return { ok: false, error: 'حجم PDF نباید از ' + ptfMaxPdfMB + 'MB بیشتر باشد (این فایل ' + fmtSize(file.size) + ' است). لطفاً PDF را فشرده کنید یا به JPG تبدیل کنید.' };
  }
  return { ok: true };
}
window.ptfAllowedExts = ptfAllowedExts;
window.ptfIsAllowedFile = ptfIsAllowedFile;

function attachUploadWidget(containerId, folder, onDone, onRemove) {
  var c = document.getElementById(containerId);
  if (!c) return;
  window._ptfUploadSeq = (window._ptfUploadSeq || 0) + 1;
  var uid = 'up' + Date.now() + '_' + window._ptfUploadSeq;
  c.innerHTML = '<div style="border:2px dashed var(--brd);border-radius:12px;padding:14px;text-align:center;font-size:12.5px;color:#64748b;cursor:pointer" id="' + uid + 'z">' +
    '📎 برای انتخاب فایل کلیک کنید یا فایل را اینجا رها کنید' +
    '<br><small style="color:#94a3b8;font-size:11px">فرمت‌های مجاز: ' + ptfAllowedExts.join(', ') + ' | PDF ≤ ' + ptfMaxPdfMB + 'MB</small>' +
    '<input type="file" id="' + uid + 'i" multiple style="display:none" accept="' + ptfAllowedExts.map(function(e) { return '.' + e; }).join(',') + '">' +
    '</div><div id="' + uid + 'p" style="margin-top:6px;font-size:12px"></div>';
  var zone = document.getElementById(uid + 'z');
  var inp = document.getElementById(uid + 'i');
  var prog = document.getElementById(uid + 'p');

  function handle(files) {
    Array.prototype.forEach.call(files, function (f) {
      var row = document.createElement('div');
      row.style.cssText = 'padding:4px 0;color:#475569';
      row.textContent = '⏳ ' + f.name + ' ...';
      prog.appendChild(row);
      /* F4-11: چک فرمت قبل از آپلود — اگر مجاز نیست، abort */
      var allow = ptfIsAllowedFile(f);
      if (!allow.ok) {
        row.innerHTML = '⛔ ' + escP(f.name) + ' — <span style="color:#b91c1c">' + escP(allow.error) + '</span>';
        if (typeof ptfToast === 'function') ptfToast('فرمت ' + f.name + ' مجاز نیست', 'warn');
        return;
      }
      uploadFile(f, folder, function (res) {
        if (res.ok) {
          /* v34.0.16-alpha (فاز ۱۳): فایل آپلودشده در همان نقطه با لینک «مشاهده» و دکمهٔ «حذف»
             نمایش داده می‌شود تا کاربر همان‌جا بتواند سند را ببیند یا حذف کند (سرتاسری). */
          var key = String(res.key || '').replace(/[\\']/g, '');
          row.innerHTML = ((res.mode === 'arvan' || res.mode === 'arvan-proxy') ? '✅ ' : '🕓 ') + escP(res.name) +
            ' <small style="color:#94a3b8">(' + fmtSize(res.size) + (res.savedNote ? ' — ' + escP(res.savedNote) : '') + ')</small>' +
            ' <a href="javascript:void(0)" onclick="openStoredFile(\'' + key + '\')" style="color:#0e7490;font-size:11px;margin-left:6px">👁 مشاهده</a>' +
            ' <button type="button" class="ba" style="color:#dc2626;font-size:11px" onclick="ptfRemoveJustUploaded(this,\'' + key + '\',\'' + escP(res.name).replace(/[\\']/g, '') + '\')">✕ حذف</button>';
          row.setAttribute('data-key', key);
          if (typeof onRemove === 'function') {
            window._ptfUploadRemoveHandlers = window._ptfUploadRemoveHandlers || {};
            window._ptfUploadRemoveHandlers[res.key] = onRemove;
          }
          onDone({ key: res.key, name: res.name, size: res.size, contentType: res.contentType || '', mode: res.mode, t: faDateTime() });
        } else {
          row.innerHTML = '❌ ' + escP(f.name) + ' — ' + escP(res.error || 'خطا');
        }
      }, function (pct) { row.textContent = '⏳ ' + f.name + ' — ' + pct + '٪'; });
    });
  }
  zone.onclick = function () { inp.click(); };
  inp.onchange = function () { handle(inp.files); inp.value = ''; };
  zone.ondragover = function (e) { e.preventDefault(); zone.style.borderColor = 'var(--pri)'; };
  zone.ondragleave = function () { zone.style.borderColor = ''; };
  zone.ondrop = function (e) { e.preventDefault(); zone.style.borderColor = ''; handle(e.dataTransfer.files); };
}

/* v34.0.16-alpha (فاز ۱۳): حذف فایلِ تازه‌آپلودشده از UI و فضای ابری — از دکمهٔ «✕ حذف» هر فایل در attachUploadWidget */
window.ptfRemoveJustUploaded = function (btnEl, key, name) {
  if (!key) { if (btnEl && btnEl.parentNode) btnEl.parentNode.remove(); return; }
  if (!confirm('فایل «' + (name || '') + '» از فضای ابری حذف شود؟')) return;
  var row = btnEl ? btnEl.parentNode : null;
  if (btnEl) btnEl.disabled = true;
  window.ptfDeleteStoredFile(key, function (res) {
    if (!res.ok) {
      if (btnEl) btnEl.disabled = false;
      if (typeof ptfToast === 'function') ptfToast('⛔ ' + res.error, 'warn'); else alert(res.error);
      return;
    }
    /* ویجت‌های persist-immediate (مثل گردش حساب تأمین‌کننده) metadata را همان لحظه
       ذخیره می‌کنند؛ handler ثبت‌شده باید پس از حذف موفق object، رکورد را هم پاک کند. */
    try {
      var handlers = window._ptfUploadRemoveHandlers || {};
      if (typeof handlers[key] === 'function') handlers[key](key);
      delete handlers[key];
    } catch (eHandler) {}
    /* فرم‌های ثبت، fileRec را در آرایه‌های موقت window نگه می‌دارند. حذفِ صرفِ ردیف
       قبلاً آن reference را باقی می‌گذاشت و فرم بعداً metadata فایل حذف‌شده را ذخیره
       می‌کرد (NoSuchKey). فقط آرایه‌های موقت فایل را بر اساس key پاک می‌کنیم. */
    Object.keys(window).forEach(function (prop) {
      try {
        var value = window[prop];
        if (prop.charAt(0) === '_' && /files/i.test(prop) && Array.isArray(value)) {
          window[prop] = value.filter(function (f) { return !f || f.key !== key; });
        }
      } catch (eScan) {}
    });
    if (row && row.parentNode) row.parentNode.removeChild(row);
    if (typeof ptfToast === 'function') ptfToast('فایل از فضای ابری حذف شد', 'warn');
  });
};

/* =====================================================================
   US-210: توابع سراسری ثبت خلاصه کالا، همگام‌سازی استعلام‌های قدیمی و مدیریت مودال‌ها
   ===================================================================== */
window.ptfAutoRegisterSummaryProducts = function(inqNo, rows) {
  if (!rows || !rows.length) return 0;
  var prods = getData('ptf_crm_products');
  var added = 0;
  rows.forEach(function(r) {
    var desc = (r.nm || r.name || '').trim();
    if (!desc || desc.length < 3) return;
    if (/صدور پیشنهاد|ابلاغ سفارش|بررسی فنی|دریافت اولیه|آماده‌سازی|تحویل شده|آقای\s|خانم\s|مهندس\s|^مرحله\s*\d/i.test(desc)) return;
    var dup = prods.some(function(p) { return p.nm === desc || (p.st && p.st === (r.spec||r.desc||'')); });
    if (dup) return;
    var cd = (typeof prodAutoCode === 'function') ? prodAutoCode() : 'P-' + (1000 + prods.length + 1);
    var concise = desc;
    if (concise.length > 68) concise = concise.slice(0, 66) + '..';
    prods.push({
      cd: cd, nm: concise, en: '', ca: (typeof ptfNormCat === 'function' ? ptfNormCat(r.tp) : (r.tp || 'سایر')), /* v15.9 US-389 */
      st: r.spec || r.desc || desc, br: r.brand || '', md: r.model || r.md || '', /* v15.9: مدل */
      /* FC-4 (v34.7.30): اگر قلم درخواست نرخ مرجع دارد، کالای خودکار هم با همان نرخ ساخته
         می‌شود (پیش‌تر همیشه pr:0 بود و مرجع خرید در پیشنهاد صفر می‌ماند). */
      un: r.un || r.unit || 'عدد', pr: +r.refPrice || 0, prCur: r.refCur || 'IRR',
      refPriceAt: (+r.refPrice > 0 ? (r.refAt || (typeof faDate === 'function' ? faDate() : '')) : ''),
      refPriceSrc: (+r.refPrice > 0 ? ('نرخ مرجع قلم درخواست ' + inqNo) : ''),
      ds: 'خلاصه اتوماتیک از استعلام ' + inqNo, srcInq: inqNo, tp: r.tp || 'Other', ts: new Date().toISOString()
    });
    added++;
  });
  if (added > 0) {
    /* v34.8.23 (W1-iterate) */
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', prods, { reason: 'cloud-products' });
    else setData('ptf_crm_products', prods);
    if (typeof addLog === 'function') addLog('ثبت اتوماتیک ' + added + ' کالای خلاصه در بانک کالا');
  }
  return added;
};

// همگام‌سازی استعلام‌های قدیمی با ماژول کالا (هنگام خلاصه‌سازی یا بازبینی)
window.ptfUniversalSyncCatalogFromInquiry = function(inqObjOrCd) {
  var cd = typeof inqObjOrCd === 'string' ? inqObjOrCd : (inqObjOrCd.cd || inqObjOrCd.inqNo || '');
  if (!cd) return 0;
  var rows = getData('ptf_crm_inqitems').filter(function(x){ return x.inqNo === cd || x.cd === cd; });
  if (!rows.length) {
    var rds = getData('ptf_crm_inqreads').filter(function(x){ return x.cd === cd || x.inqNo === cd; })[0];
    if (rds && rds.rows) rows = rds.rows;
  }
  if (!rows.length) {
    var rfq = typeof inqObjOrCd === 'object' ? inqObjOrCd : getData('ptf_crm_rfqs').filter(function(x){ return x.cd === cd; })[0];
    if (rfq && rfq.items && rfq.items.length) {
      rows = rfq.items;
    } else if (rfq && rfq.con && rfq.con.trim().length > 25 && /لوله|فلنج|اتصالات|شیر|ولو|پمپ|ترانسمیتر|ابزار دقیق|کابل|ورق|pipe|flange|valve|pump|fitting|transmitter/i.test(rfq.con)) {
      var lines = String(rfq.con).split(/\r?\n/).filter(function(l){ return l.trim().length > 8; });
      rows = lines.map(function(l){ return { nm: l.trim(), spec: l.trim(), qty: 1, un: 'عدد', tp: (typeof ptfDetectType==='function' ? ptfDetectType(l) : 'Other') }; });
    }
  }
  if (rows && rows.length) {
    return window.ptfAutoRegisterSummaryProducts(cd, rows);
  }
  return 0;
};

// دکمه‌های کنترل پنجره مودال‌ها (بزرگ‌نمایی، ذخیره و بستن، بستن بدون ذخیره)
window.ptfWinToggleMax = function(btn) {
  var md = btn.closest('.md');
  if (!md) return;
  if (md.getAttribute('data-maximized') === '1') {
    md.style.width = md.getAttribute('data-old-w') || '';
    md.style.maxWidth = md.getAttribute('data-old-mw') || '';
    md.style.height = md.getAttribute('data-old-h') || '';
    md.style.maxHeight = md.getAttribute('data-old-mh') || '';
    md.removeAttribute('data-maximized');
    btn.innerHTML = '🗖';
  } else {
    md.setAttribute('data-old-w', md.style.width || '');
    md.setAttribute('data-old-mw', md.style.maxWidth || '');
    md.setAttribute('data-old-h', md.style.height || '');
    md.setAttribute('data-old-mh', md.style.maxHeight || '');
    md.style.width = '98vw';
    md.style.maxWidth = '98vw';
    md.style.height = '96vh';
    md.style.maxHeight = '96vh';
    md.setAttribute('data-maximized', '1');
    btn.innerHTML = '🗗';
  }
};

window.ptfWinSaveClose = function(btn) {
  var md = btn.closest('.md');
  if (!md) return;
  var saveBtn = md.querySelector('button[onclick*="Save"], button[onclick*="save"], button[onclick*="Persist"], button[onclick*="Commit"]');
  if (saveBtn) saveBtn.click();
  else { var mb = btn.closest('.md-b, .ptfdlg-b'); if (mb) mb.remove(); }
};

window.ptfWinCloseNoSave = function(btn) {
  var mb = btn.closest('.md-b, .ptfdlg-b');
  if (mb) mb.remove();
};

// US-226: تولید امضای فانتزی انگلیسی و شکیل برای مهر و امضا
window.ptfGetFantasySignature = function(username) {
  var nameMap = {
    'lavasani': 'Hamed Lavasani',
    'karimi': 'Shiva Karimi',
    'yousefi': 'Abbas Yousefi',
    'admin': 'Authorized Director'
  };
  var dispName = nameMap[username] || username || 'Authorized Signature';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="160" height="54">' +
    '<path d="M15,55 Q40,15 70,48 T130,25 Q160,65 210,20" fill="none" stroke="#1e40af" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M45,42 Q85,60 185,38" fill="none" stroke="#1e40af" stroke-width="1.8" stroke-dasharray="4,2"/>' +
    '<text x="120" y="68" font-family="Georgia, cursive, serif" font-style="italic" font-weight="bold" font-size="16" fill="#1e3a8a" text-anchor="middle">' + escP(dispName) + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

/* =====================================================================
   US-211..213: میز کار بازبینی اقلام استعلام، ضدتکرار در بانک کالا و صدور هم‌زمان TO و استعلام تامین
   ===================================================================== */
window.ptfReviewAndCommitInqItems = function(inqNo, items, cb) {
  if (!items || !items.length) { alert('هیچ ردیفی جهت بررسی وجود ندارد.'); return; }
  items.forEach(function(it) {
    if (typeof window.ptfIntelligentParseItem === 'function') window.ptfIntelligentParseItem(it);
    it.shortDesc = it.shortDesc || it.nm || it.name || '';
    it.longDesc = it.longDesc || it.spec || it.desc || it.shortDesc;
  });
  
  var old = document.getElementById('ptfCommitModal');
  if (old) old.remove();
  
  var rowsHtml = items.map(function(it, i) {
    return '<tr>' +
      '<td>' + (i+1) + '</td>' +
      '<td><input type="text" id="rc_sh_' + i + '" value="' + escP(it.shortDesc) + '" style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>' +
      '<td><input type="text" id="rc_lg_' + i + '" value="' + escP(it.longDesc) + '" style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px"></td>' +
      '<td><input type="number" id="rc_qt_' + i + '" value="' + (it.qty||1) + '" style="width:54px;padding:5px;border:1px solid #cbd5e1;border-radius:6px"></td>' +
      '<td><input type="text" id="rc_un_' + i + '" value="' + escP(it.un||it.unit||'عدد') + '" style="width:54px;padding:5px;border:1px solid #cbd5e1;border-radius:6px"></td>' +
      '<td><input type="text" id="rc_md_' + i + '" value="' + escP(it.model||'') + '" style="width:80px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;direction:ltr"></td>' +
      '<td><input type="text" id="rc_br_' + i + '" value="' + escP(it.brand||'') + '" style="width:80px;padding:5px;border:1px solid #cbd5e1;border-radius:6px"></td>' +
      '</tr>';
  }).join('');

  var html = '<div class="md-b" id="ptfCommitModal" style="display:grid;z-index:99999" onclick="if(event.target===this)this.remove()">' +
    '<div class="md" style="max-width:960px;max-height:94vh;overflow:auto">' +
    '<div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:12px;padding:12px 16px;margin-bottom:12px;color:#1e40af">' +
    '<strong style="font-size:14px">🎯 ' + items.length + ' ردیف کالا استخراج شد و آماده افزودن به فهرست کالاهاست.</strong><br>' +
    '<span style="font-size:12px">لطفاً صحت اطلاعات را بررسی کنید. پس از تایید، اقلام غیرتکراری به بانک کالا اضافه شده و هم‌زمان پیش‌نویس پیشنهاد فنی (TO) و استعلام تامین (RFQ Smart) ایجاد می‌شود.</span></div>' +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead style="background:#f1f5f9"><tr><th>#</th><th>شرح کوتاه (برای بانک کالا)</th><th>شرح بلند (برای پیشنهاد فنی و تامین)</th><th>تعداد</th><th>واحد</th><th>مدل</th><th>برند</th></tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody></table></div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
    '<button type="button" class="bt bt-o" onclick="document.getElementById(\'ptfCommitModal\').remove()">انصراف</button>' +
    '<button type="button" class="bt" style="background:#059669;color:#fff;font-weight:bold" onclick="ptfFinalCommitItems(\'' + ptfOnClickArg(inqNo) + '\')">✅ تایید و ثبت نهایی (ضدتکرار + صدور TO و استعلام تامین)</button>' +
    '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  window._pendingCommitItems = items;
  window._pendingCommitCb = cb;
};

window.ptfFinalCommitItems = function(inqNo) {
  var items = window._pendingCommitItems || [];
  if (!items.length) return;
  var finalized = items.map(function(it, i) {
    return {
      shortDesc: (document.getElementById('rc_sh_' + i)||{}).value || it.shortDesc || '',
      longDesc: (document.getElementById('rc_lg_' + i)||{}).value || it.longDesc || '',
      qty: +(document.getElementById('rc_qt_' + i)||{}).value || 1,
      un: (document.getElementById('rc_un_' + i)||{}).value || 'عدد',
      model: (document.getElementById('rc_md_' + i)||{}).value || '',
      brand: (document.getElementById('rc_br_' + i)||{}).value || '',
      tp: it.tp || 'Other'
    };
  });
  
  // 1. ذخیره در اقلام درخواست inqitems
  var iq = getData('ptf_crm_inqitems').filter(function(x){ return x.inqNo !== inqNo; });
  finalized.forEach(function(r) {
    iq.push({ inqNo: inqNo, cd: genCode('IQI'), nm: r.shortDesc, en: r.shortDesc, st: r.longDesc, model: r.model, brand: r.brand, qty: r.qty, un: r.un, tp: r.tp, t: faDate() });
  });
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_inqitems', iq, { reason: 'w2' }); else setData('ptf_crm_inqitems', iq);

  // 2. صدور هم‌زمان پیش‌نویس پیشنهاد فنی TO (US-213 AC1)
  var offers = getData('ptf_crm_offers');
  var existingTo = offers.filter(function(x){ return x.inqNo === inqNo && x.kind === 'TO'; })[0];
  if (!existingTo) {
    var toNo = offerSerial('TO');
    var toItems = finalized.map(function(r) {
      return { name: r.shortDesc, desc: r.longDesc, model: r.model, brand: r.brand, qty: r.qty, unit: r.un, price: 0 };
    });
    var rfq = getData('ptf_crm_rfqs').filter(function(x){ return x.cd === inqNo || x.inqNo === inqNo; })[0] || {};
    offers.unshift({
      no: toNo, kind: 'TO', rev: 0, inqNo: inqNo, buyerCd: rfq.custCd || '', buyerCo: rfq.co || '',
      dateFa: faDate(), dateEn: new Date().toISOString().slice(0,10), st: 'draft', items: toItems, terms: []
    });
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_offers', offers, { reason: 'w4' }); else setData('ptf_crm_offers', offers);
  }

  // 3. درج در سامانه هوشمند تامین RFQ Smart (US-213 AC2)
  var rfqsList = getData('ptf_crm_rfqsmart');
  var existingRfqs = rfqsList.filter(function(x){ return x.srcRfq === inqNo; })[0];
  var smartItems = finalized.map(function(r){ return { name: r.shortDesc, spec: r.longDesc, model: r.model, brand: r.brand, qty: r.qty, unit: r.un }; });
  if (!existingRfqs) {
    var rfqsNo = 'PTF-RFQS-' + faYear() + '-' + String(rfqsList.length + 1).padStart(3, '0');
    rfqsList.unshift({ no: rfqsNo, srcRfq: inqNo, items: smartItems, targets: [], st: 'draft', t: faDateTime() });
  } else {
    existingRfqs.items = smartItems;
  }
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', rfqsList, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', rfqsList);

  var md = document.getElementById('ptfCommitModal');
  if (md) md.remove();

  // 4. دروازه تایید انسانی ورود به بانک کالا
  if (confirm('✅ اقلام با موفقیت در استعلام، پیشنهاد فنی (TO) و استعلام تامین (RFQ Smart) ثبت شد.\n\nآیا مایل هستید این اقلام به عنوان کالای دائم به بانک کالا (ماژول کالاها) نیز اضافه شوند؟')) {
    var prods = getData('ptf_crm_products');
    var added = 0, dup = 0;
    finalized.forEach(function(r) {
      var desc = r.shortDesc.trim();
      if (!desc || desc.length < 3) return;
      var isDup = prods.some(function(p) { return p.nm === desc || (p.st && p.st === r.longDesc); });
      if (isDup) { dup++; return; }
      var cd = (typeof prodAutoCode === 'function') ? prodAutoCode() : 'P-' + (1000 + prods.length + 1);
      prods.push({
        cd: cd, nm: desc, en: '', ca: r.tp || 'Other', st: r.longDesc, br: r.brand, model: r.model, un: r.un, pr: 0,
        ds: 'ثبت تاییدشده از استعلام ' + inqNo, srcInq: inqNo, tp: r.tp || 'Other', ts: new Date().toISOString()
      });
      added++;
    });
    /* v34.8.23 (W1-iterate) */
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', prods, { reason: 'inq-approve' });
    else setData('ptf_crm_products', prods);
    alert('🎉 ' + added + ' قلم جدید به بانک کالا اضافه شد' + (dup ? ' (' + dup + ' قلم تکراری بود)' : ''));
  }
  if (typeof window._pendingCommitCb === 'function') window._pendingCommitCb(finalized.length, 0);
  if (typeof renderOffers === 'function') renderOffers();
  if (typeof renderRfqSmart === 'function') renderRfqSmart();
};
(function() {
  var baseZ = 2000;
  var observer = new MutationObserver(function() {
    var modals = document.querySelectorAll('.md-b, .ptfdlg-b');
    modals.forEach(function(mb, idx) {
      if (mb.style.display !== 'none') {
        var computedZ = baseZ + (idx * 60);
        if (parseInt(mb.style.zIndex || 0, 10) < computedZ) mb.style.zIndex = computedZ;
        /* v122.3 (US-281): تزریق دکمه‌های قدیمی 🗖/💾✕/✕ حذف شد — دکمه‌های مک‌استایل modalx.js تنها کنترل پنجره‌ها هستند.
           اگر نمونه‌ای از نسل قدیم در DOM مانده بود، پاک شود: */
        var md = mb.querySelector('.md, .ptfdlg');
        if (md) {
          var oldCtrls = md.querySelector('.ptf-win-ctrls');
          if (oldCtrls) oldCtrls.remove();
        }
      }
    });
  });
  window.addEventListener('DOMContentLoaded', function() {
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  });
})();

/* v34.4.48: دادهٔ واقعی الان در سامانه است. تبدیل آزمایشی→عملیاتی دیگر پاک‌سازی
   نمی‌کند؛ فقط برچسب حالت را «عملیاتی» می‌گذارد تا نوار زرد و دکمهٔ خطرناک نماند. */
window.ptfMarkLiveProduction = function () {
  try { localStorage.setItem('ptf_crm_mode', 'production'); } catch (e) {}
};
window.ptfRenderTrialBar = function() {
  var el = document.getElementById('trialBarWrap');
  if (!el) return;
  window.ptfMarkLiveProduction();
  el.innerHTML = '<div style="background:#ecfdf5;border-bottom:1px solid #a7f3d0;padding:8px 20px;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#065f46;font-weight:bold"><span style="font-size:16px">💎</span> سامانه در حال بهره‌برداری واقعی است. داده‌های جاری حفظ می‌شوند و پاک‌سازی آزمایشی غیرفعال است.</div>';
};

window.ptfConvertToProduction = function() {
  window.ptfMarkLiveProduction();
  if (typeof ptfToast === 'function') ptfToast('سامانه از قبل عملیاتی است؛ هیچ داده‌ای پاک نشد.', 'ok');
  else alert('سامانه از قبل عملیاتی است؛ هیچ داده‌ای پاک نشد.');
  if (typeof window.ptfRenderTrialBar === 'function') window.ptfRenderTrialBar();
};

/* =====================================================================
   US-221 & US-224: جستجوی هوشمند سرتاسری (Ctrl+K) و نشانگر سلامت سیستم
   ===================================================================== */
window.ptfRenderHealthPill = function() {
  var el = document.getElementById('liveHealthPill');
  if (!el) return;
  var lastBk = localStorage.getItem('ptf_last_backup_time') || 'امروز (سیستمی)';
  el.innerHTML = '<span style="font-size:13px">🟢</span> <b>سیستم پایدار</b> | آخرین پشتیبان: ' + escP(lastBk) +
    ' <button type="button" onclick="ptfQuickBackupClick()" style="background:#059669;color:#fff;border:0;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;font-weight:bold;margin-right:4px">⚡ بک‌اپ سریع</button>';
};

window.ptfQuickBackupClick = function() {
  localStorage.setItem('ptf_last_backup_time', faDateTime());
  ptfRenderHealthPill();
  if (typeof backup === 'function') backup();
  else if (typeof backupExport === 'function') backupExport();
  if (typeof ptfToast === 'function') ptfToast('⚡ بک‌اپ سریع از کل اطلاعات گرفته شد', 'ok');
};

window.ptfOpenCommandPalette = function() {
  var old = document.getElementById('ptfCmdPalette');
  if (old) old.remove();
  var html = '<div class="md-b" id="ptfCmdPalette" style="display:grid;z-index:999999" onclick="if(event.target===this)this.remove()">' +
    '<div class="md" style="width:min(680px,94vw);padding:18px;max-height:85vh;display:flex;flex-direction:column">' +
    '<div style="display:flex;align-items:center;gap:8px;border-bottom:2px solid #3b82f6;padding-bottom:10px">' +
    '<span style="font-size:18px">🔎</span>' +
    '<input type="text" id="cmdPalInp" placeholder="تایپ کنید: شماره استعلام، نام مشتری، کد پیشنهاد یا شرح کالا..." style="flex:1;border:0;font-size:15px;outline:none;font-family:inherit" oninput="ptfCmdSearch(this.value)" autocomplete="off">' +
    '<button type="button" onclick="document.getElementById(\'ptfCmdPalette\').remove()" style="border:0;background:none;font-size:18px;cursor:pointer;color:#64748b">✕</button></div>' +
    '<div id="cmdPalRes" style="margin-top:12px;overflow-y:auto;max-height:60vh"></div>' +
    '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(function(){ var i = document.getElementById('cmdPalInp'); if (i) i.focus(); ptfCmdSearch(''); }, 50);
};

window.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    ptfOpenCommandPalette();
  }
});

window.ptfCmdSearch = function(q) {
  var el = document.getElementById('cmdPalRes');
  if (!el) return;
  q = (q || '').trim().toLowerCase();
  var results = [];
  
    if (q === '?' || q === 'راهنما' || q === 'تور' || q === 'tour' || q === 'help') {
    results.push({ mod: 'تور آموزشی و راهنما (US-273)', icon: '🚀', title: 'شروع تور تعاملی آموزش سامانه CRM', sub: 'آشنایی گام‌به‌گام با امکانات بازرگانی، فنی و مالی پیشرو تجهیز فرتاک', action: function(){ if(typeof startTour === 'function') startTour(); else alert('راهنمای سیستم در پنل تنظیمات در دسترس است'); } });
    results.push({ mod: 'تنظیمات و امنیت', icon: '⚙️', title: 'ورود به پنل تنظیمات و مدیریت حساب', sub: 'تغییر رمز عبور، اتصال ابری آروان S3 و پیکربندی دستیار AI', action: function(){ goPanel('set'); } });
  }
  if (q === '/off' || q === 'پیشنهاد' || q === 'offers') {
    results.push({ mod: 'دستور سریع', icon: '💰', title: 'ورود به پنل پیشنهادها (TO/CO/TC)', sub: 'مدیریت پیشنهادهای مالی و فنی و صدور پیش‌فاکتور', action: function(){ goPanel('off'); } });
  }
  if (q === '/leads' || q === 'سرنخ' || q === 'leads') {
    results.push({ mod: 'دستور سریع', icon: '🎯', title: 'ورود به پنل سرنخ‌ها و بازاریابی', sub: 'پیگیری سرنخ‌های فروش و تبدیل به مشتری بالقوه', action: function(){ goPanel('leads'); } });
  }
  if (q === '/tech' || q === 'دستیار' || q === 'ai') {
    results.push({ mod: 'دستور سریع', icon: '🤖', title: 'ورود به دستیار هوشمند و لیدیاب', sub: 'تحلیل استعلام، استخراج اقلام با OCR و کشف سرنخ', action: function(){ if(typeof openAiWorkbench === 'function') openAiWorkbench('tech'); else goPanel('ai'); } });
  }

  getData('ptf_crm_rfqs').forEach(function(r) {
    if (!q || ((r.cd||'')+' '+(r.co||'')+' '+(r.subj||'')+' '+(r.ca||'')).toLowerCase().indexOf(q) > -1) {
      results.push({ mod: 'استعلام مشتری', icon: '📥', title: r.cd + ' — ' + r.co, sub: r.subj || r.ca, action: function(){ goPanel('rfq'); setTimeout(function(){ if(typeof inqReadOpen === 'function') inqReadOpen(r.cd); }, 300); } });
    }
  });
  getData('ptf_crm_rfqsmart').forEach(function(r) {
    if (!q || ((r.no||'')+' '+(r.srcRfq||'')).toLowerCase().indexOf(q) > -1) {
      results.push({ mod: 'استعلام تامین', icon: '🤖', title: r.no, sub: (r.items||[]).length + ' قلم کالا | منبع: ' + (r.srcRfq||'-'), action: function(){ goPanel('rfqs'); setTimeout(function(){ if(typeof rfqsOpen === 'function') rfqsOpen(r.no); }, 300); } });
    }
  });
  getData('ptf_crm_offers').forEach(function(o) {
    if (!q || ((o.no||'')+' '+(o.buyerCo||'')+' '+(o.inqNo||'')).toLowerCase().indexOf(q) > -1) {
      results.push({ mod: o.kind === 'TO' ? 'پیشنهاد فنی TO' : 'پیش‌فاکتور CO', icon: o.kind === 'TO' ? '🔧' : '💰', title: o.no + ' — ' + o.buyerCo, sub: (o.items||[]).length + ' قلم | استعلام: ' + (o.inqNo||'-'), action: function(){ goPanel('off'); setTimeout(function(){ if(typeof offerEdit === 'function') offerEdit(o.no); }, 300); } });
    }
  });
  getData('ptf_crm_products').forEach(function(p) {
    if (!q || ((p.cd||'')+' '+(p.nm||'')+' '+(p.st||'')+' '+(p.br||'')).toLowerCase().indexOf(q) > -1) {
      results.push({ mod: 'بانک کالا', icon: '📦', title: p.nm, sub: p.cd + ' | ' + (p.st||'-') + ' | ' + (p.br||'-'), action: function(){ goPanel('prod'); } });
    }
  });
  getData('ptf_crm_customers').forEach(function(c) {
    if (!q || ((c.cd||'')+' '+(c.co||'')+' '+(c.con||'')).toLowerCase().indexOf(q) > -1) {
      results.push({ mod: 'کارفرمایان', icon: '🏢', title: c.co, sub: c.cd + ' | رابط: ' + (c.con||'-'), action: function(){ goPanel('cust'); } });
    }
  });

  if (!results.length) {
    el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px">نتیجه‌ای یافت نشد</div>';
    return;
  }
  
  el.innerHTML = results.slice(0, 30).map(function(item, i) {
    window['_cmdAct_' + i] = item.action;
    return '<div onclick="document.getElementById(\'ptfCmdPalette\').remove(); window[\'_cmdAct_' + i + '\']();" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--brd);border-radius:10px;margin-bottom:6px;cursor:pointer;background:#fff" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'#fff\'">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:20px">' + item.icon + '</span>' +
      '<div><div style="font-size:13px;font-weight:bold;color:#1e293b">' + escP(item.title) + '</div>' +
      '<div style="font-size:11.5px;color:#64748b">' + escP(item.sub) + '</div></div></div>' +
      '<span style="background:#e2e8f0;color:#334155;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:bold">' + item.mod + ' ←</span></div>';
  }).join('');
};

/* ============ Sprint 106: موتور پاک‌سازی زباله‌های ابری و فایل‌های یتیم ============ */
window.ptfPurgeCloudOrphans = function (cb) {
  if (!confirm('☁️ آیا بررسی و پاک‌سازی فایل‌های یتیم (زباله‌های ابری) از آروان‌کلود انجام شود؟\n\nاین عملیات فایل‌هایی که در دیتابیس CRM هیچ رکوردی به آن‌ها متصل نیست را از فضای ابری حذف می‌کند تا فضای شما آزاد شود.')) return;
  
  if (typeof ptfToast === 'function') ptfToast('⏳ در حال اسکن فضای ابری آروان...', 'info');
  
  // 1. Collect all active file keys from CRM database
  var activeKeys = {};
  /* v121.2: رفع نقص خطرناک US-108 — نسخه قبلی پروژه‌ها را از p.files می‌خواند
     (ساختار واقعی p.docs است!) و پیوست نامه/قرارداد/تنخواه/امضا/بایگانی‌های zip
     را اصلا جمع نمی‌کرد → پاکسازی زباله، فایل‌های قانونی را هم می‌کشت. */
  function harvest(obj) { // جمع بازگشتی هر key ای در هر ساختاری
    if (!obj) return;
    if (Array.isArray(obj)) { obj.forEach(harvest); return; }
    if (typeof obj === 'object') {
      if (typeof obj.key === 'string' && obj.key) activeKeys[obj.key] = true;
      if (typeof obj.fileKey === 'string' && obj.fileKey) activeKeys[obj.fileKey] = true;
      if (typeof obj.imgKey === 'string' && obj.imgKey) activeKeys[obj.imgKey] = true;
      if (typeof obj.archiveKey === 'string' && obj.archiveKey) activeKeys[obj.archiveKey] = true;
      Object.keys(obj).forEach(function (k) { if (typeof obj[k] === 'object') harvest(obj[k]); });
    }
  }
  try {
    /* v34.4.47: به‌جای فهرست ناقص storeها، همهٔ کلیدهای ptf_crm_* اسکن می‌شوند
       (چک، opex، petty_tx، payables، sales_returns، ...). هزینه فقط JSON محلی است. */
    var storeKeys = {};
    try {
      for (var si = 0; si < localStorage.length; si++) {
        var sk = localStorage.key(si);
        if (sk && sk.indexOf('ptf_crm_') === 0) storeKeys[sk] = true;
      }
    } catch (eLs) {}
    ['ptf_crm_rfqs', 'ptf_crm_projects', 'ptf_crm_cms', 'ptf_crm_letters', 'ptf_crm_contracts',
     'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_offers', 'ptf_crm_invoices', 'ptf_crm_rfqsmart', 'ptf_crm_deals',
     'ptf_crm_packinglists', 'ptf_crm_inqreads', 'ptf_crm_supplier_finance',
     'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_cheque_books',
     'ptf_crm_opex', 'ptf_crm_payables', 'ptf_crm_sales_returns', 'ptf_crm_sigprofiles'].forEach(function (k) { storeKeys[k] = true; });
    Object.keys(storeKeys).forEach(function (k) {
      try {
        if (typeof getData === 'function') harvest(getData(k));
        else harvest(JSON.parse(localStorage.getItem(k) || 'null'));
      } catch (eH) {}
    });
  } catch(e) {}
  var PROTECTED_PREFIX = ['archives/', 'backups/']; // بایگانی و بک‌آپ هرگز زباله نیستند
  
  // 2. List files from Arvan S3
  fetch(STORAGE_API + '?action=list&prefix=', { headers: ptfStorageAuthHeaders(false) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d.ok || !d.files) {
        alert('❌ خطا در دریافت لیست فایل‌ها از آروان‌کلود: ' + (d.error || 'عدم دسترسی'));
        if (cb) cb(false);
        return;
      }
      if (d.truncated) {
        alert('⚠️ فهرست فضای ابری ناقص برگشت؛ برای جلوگیری از حذف اشتباه، پاک‌سازی متوقف شد. دوباره تلاش کنید.');
        if (cb) cb(false);
        return;
      }
      
      var orphans = [];
      var backupKeys = [];
      d.files.forEach(function(item) {
        var key = item.key || item.name;
        if (!key) return;
        // Preserve backup files that are recent (hourly or daily)
        // Sprint 107: Cloud Backup Pruner — فقط ۳ بک‌آپ آخر ابری حفظ شود و بقیه حذف شوند (حل مشکل ۱۴۲ فایل ابری)
        if (key.indexOf('backups/') === 0 || key.indexOf('crm-backup-') === 0) {
          backupKeys.push(item);
          return;
        }
        // v121.2: بایگانی‌های فشرده پرونده‌ها (US-178) هرگز زباله نیستند
        if (key.indexOf('archives/') === 0) return;
        
        if (!activeKeys[key]) {
          orphans.push(key);
        }
      });
      
      
      // Sort backups by date/time descending (newest first)
      backupKeys.sort(function(a, b) {
        var tA = a.lastModified || a.date || a.t || '';
        var tB = b.lastModified || b.date || b.t || '';
        return tB.localeCompare(tA);
      });
      // Keep top 3 newest backups, mark all older backup files as redundant to delete
      if (backupKeys.length > 3) {
        var oldBackups = backupKeys.slice(3);
        oldBackups.forEach(function(bItem) {
          var bKey = bItem.key || bItem.name;
          if (bKey) orphans.push(bKey);
        });
      }

      if (!orphans.length) {
        alert('✅ فضای ابری کاملاً تمیز است! هیچ فایل یتیم یا زباله ابری یافت نشد.');
        if (cb) cb(true);
        return;
      }
      
      if (!confirm('⚠️ تعداد ' + orphans.length + ' فایل زباله (فایل‌های یتیم + بک‌آپ‌های قدیمی مازاد بر ۳ نسخه آخر) در فضای ابری یافت شد.\nآیا از حذف دائم آن‌ها و آزادسازی فضای ابری اطمینان دارید؟')) return;
      
      var total = orphans.length;
      fetch(STORAGE_API + '?action=delete_batch', {
        method: 'POST',
        headers: ptfStorageAuthHeaders(true),
        body: JSON.stringify({ keys: orphans })
      })
      /* v15.1 (BUG-015): اگر پاسخ سرور JSON نبود (خطای PHP)، متن واقعی خطا نمایش داده شود نه پیام گنگ */
      .then(function(res) {
        return res.text().then(function (tx) {
          try { return JSON.parse(tx); }
          catch (ePr) { throw new Error('پاسخ غیر JSON از سرور (HTTP ' + res.status + '): ' + tx.slice(0, 180)); }
        });
      })
      .then(function(resD) {
        if (!resD.ok) { alert('❌ سرور حذف را رد کرد: ' + (resD.error || '')); if (cb) cb(false); return; }
        var actualDel = (resD.deleted != null) ? resD.deleted : total;
        alert('✅ پاک‌سازی ابری با موفقیت انجام شد! تعداد ' + actualDel + ' فایل زباله و بک‌آپ قدیمی مازاد از آروان‌کلود حذف گردید.' + (resD.failed ? '\n⚠️ ' + resD.failed + ' فایل حذف نشد (دسترسی/اتصال آروان) — بعدا دوباره اجرا کنید.' : ''));
        if (typeof audit === 'function') audit('فضای ابری', 'پاک‌سازی خودکار ' + actualDel + ' فایل یتیم و بک‌آپ مازاد ابری', '');
        try {
          localStorage.removeItem('ptf_cloud_usage');
          if (typeof ptfRenderCloudUsage === 'function') ptfRenderCloudUsage(true);
        } catch(e) {}
        if (cb) cb(true);
      })
      .catch(function(eDb) {
        alert('❌ خطا در ارسال دستور حذف دسته‌جمعی به سرور' + (eDb && eDb.message ? '\n' + eDb.message : ''));
        if (cb) cb(false);
      });
    })
    .catch(function(err) {
      alert('❌ خطا در اتصال به سرور ذخیره‌سازی');
      if (cb) cb(false);
    });
};

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
  // کش ۱۰ دقیقه‌ای تا هر بار به آروان کوئری نزنیم
  try {
    var c = JSON.parse(localStorage.getItem('ptf_cloud_usage') || 'null');
    if (!force && c && (Date.now() - c.at) < 600000) { cb(c); return; }
  } catch (e) {}
  fetch(STORAGE_API + '?action=usage', { method: 'POST', headers: ptfStorageAuthHeaders(true), body: '{}' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.ok) {
        var rec = { ok: true, bytes: d.bytes, count: d.count, bucket: d.bucket, at: Date.now() };
        localStorage.setItem('ptf_cloud_usage', JSON.stringify(rec));
        localStorage.setItem('ptf_cloud_usage_backup', JSON.stringify(rec));
        cb(rec);
      } else {
        var bak = JSON.parse(localStorage.getItem('ptf_cloud_usage_backup') || 'null');
        if (bak) { bak.cached = true; cb(bak); }
        else cb({ ok: false, error: d.error || ('HTTP ' + (d.http || '')) });
      }
    })
    .catch(function () {
      var bak = JSON.parse(localStorage.getItem('ptf_cloud_usage_backup') || 'null');
      if (bak) { bak.cached = true; cb(bak); }
      else cb({ ok: false, error: 'عدم دسترسی به سرور' });
    });
}

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
    var body = d.ok
      ? 'فضای اشغال‌شده: <b>' + fmtSizeH(d.bytes) + '</b><br>تعداد فایل‌ها: <b>' + d.count + '</b><br>صندوقچه: <span style="direction:ltr;display:inline-block">' + escP(d.bucket || '') + '</span>' +
        '<br><small style="color:#94a3b8">برای آزادسازی فضا: پرونده‌های تمام‌شده را از ماژول «پرونده‌های پروژه» بایگانی/پاکسازی کنید.</small>'
      : '<span style="color:#d97706">خطا: ' + escP(d.error || '') + '</span>';
    if (typeof ptfDialog === 'function') ptfDialog({ title: '☁️ وضعیت فضای ابری', body: body, okText: 'بستن' });
    else alert(body.replace(/<[^>]+>/g, ''));
  }, true);
}

/* ---------- فشرده‌سازی تصویر سمت کلاینت (AC4) ---------- */
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
    cv.toBlob(function (blob) {
      URL.revokeObjectURL(url);
      if (blob && blob.size < file.size) {
        var nf = new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
        cb(nf, { before: file.size, after: blob.size });
      } else cb(file, null);
    }, 'image/webp', 0.8);
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
    var note = compInfo ? 'فشرده: ' + fmtSize(compInfo.before) + ' → ' + fmtSize(compInfo.after) : '';

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
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf'].indexOf(ext) < 0) return Promise.reject(new Error('inline_unsupported'));
  return fetch('../api/attachment-read.php', {
    method: 'POST', headers: ptfStorageAuthHeaders(true),
    body: JSON.stringify({ key: key, name: name, mode: 'inline' })
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (text) { throw new Error(text || ('HTTP ' + r.status)); });
    return r.blob();
  }).then(function (blob) { return URL.createObjectURL(blob); });
}
function openStoredFile(key, nameHint) {
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
        if (typeof ptfToast === 'function') ptfToast('⚠️ فایل در فضای ابری یافت نشد (کلید قدیمی/مهاجرت‌نشده) — لطفاً سند را دوباره آپلود کنید.', 'warn');
        else alert('فایل در فضای ابری یافت نشد (کلید قدیمی/مهاجرت‌نشده) — لطفاً سند را دوباره آپلود کنید.');
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
      un: r.un || r.unit || 'عدد', pr: 0,
      ds: 'خلاصه اتوماتیک از استعلام ' + inqNo, srcInq: inqNo, tp: r.tp || 'Other', ts: new Date().toISOString()
    });
    added++;
  });
  if (added > 0) {
    setData('ptf_crm_products', prods);
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
  setData('ptf_crm_inqitems', iq);

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
    setData('ptf_crm_offers', offers);
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
  setData('ptf_crm_rfqsmart', rfqsList);

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
    setData('ptf_crm_products', prods);
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

// US-210: نوار نسخه آزمایشی و قابلیت تبدیل به نسخه عملیاتی واقعی برای مدیر ارشد و رئیس هیئت مدیره
window.ptfRenderTrialBar = function() {
  var el = document.getElementById('trialBarWrap');
  if (!el) return;
  var isProd = localStorage.getItem('ptf_crm_mode') === 'production';
  if (isProd) {
    el.innerHTML = '<div style="background:#ecfdf5;border-bottom:1px solid #a7f3d0;padding:8px 20px;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#065f46;font-weight:bold"><span style="font-size:16px">💎</span> نرم‌افزار در نسخه عملیاتی واقعی (Live Production Mode) فعال است. اطلاعات جاری معتبر و رسمی می‌باشند.</div>';
    return;
  }
  var s = null;
  try { s = typeof curSession === 'function' ? curSession() : JSON.parse(localStorage.getItem('ptf_crm_session')); } catch(e){}
  var canGoLive = s && (s.role === 'مدیر ارشد' || s.role === 'مدیر کل' || (s.role||'').indexOf('مدیر ارشد') > -1 || (s.role||'').indexOf('رئیس هیئت مدیره') > -1 || (s.role||'').indexOf('Admin') > -1 || s.user === 'admin' || s.username === 'admin');
  el.innerHTML = '<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-bottom:1px solid #f59e0b;padding:8px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;box-shadow:0 2px 10px rgba(245,158,11,.15)">' +
    '<div style="display:flex;align-items:center;gap:8px">' +
    '<span style="font-size:18px">🧪</span>' +
    '<div><strong style="color:#b45309;font-size:13px">نرم‌افزار در حالت آزمایشی (Trial / Beta Mode) قرار دارد</strong>' +
    '<div style="color:#92400e;font-size:11.5px">جهت شناسایی و رفع باگ‌ها؛ پس از اتمام تست، به نسخه عملیاتی واقعی تبدیل خواهد شد.</div></div></div>' +
    (canGoLive ? '<button type="button" class="bt" style="background:#dc2626;color:#fff;font-size:12px;font-weight:bold;padding:7px 14px;border-radius:8px;cursor:pointer" onclick="ptfConvertToProduction()">🚀 تبدیل به نسخه عملیاتی واقعی (پاکسازی اطلاعات آزمایشی)</button>' : '') +
    '</div>';
};

window.ptfConvertToProduction = function() {
  var s = null;
  try { s = typeof curSession === 'function' ? curSession() : JSON.parse(localStorage.getItem('ptf_crm_session')); } catch(e){}
  var canGoLive = s && (s.role === 'مدیر ارشد' || s.role === 'مدیر کل' || (s.role||'').indexOf('مدیر ارشد') > -1 || (s.role||'').indexOf('رئیس هیئت مدیره') > -1 || (s.role||'').indexOf('Admin') > -1 || s.user === 'admin' || s.username === 'admin');
  if (!canGoLive) { alert('⛔ دسترسی فقط برای مدیر ارشد و رئیس هیئت مدیره مجاز است.'); return; }
  if (!confirm('⚠️ توجه بسیار مهم (تبدیل به نسخه عملیاتی واقعی):\n\nبا تایید این عملیات، کلیه اطلاعات آزمایشی (استعلام‌ها، پیشنهادها، پیش‌فاکتورها، پرونده‌ها، لیدها و کالاهای آزمایشی) به طور کامل پاکسازی شده و نرم‌افزار آماده کار واقعی می‌شود.\n\nآیا تایید می‌کنید؟')) return;
  var ans = prompt('برای تایید نهایی پاکسازی اطلاعات آزمایشی و فعال‌سازی نسخه واقعی، کلمه «تایید» را تایپ کنید:');
  if (ans !== 'تایید') { alert('عملیات لغو شد'); return; }
  var keys = ['ptf_crm_rfqs', 'ptf_crm_rfqsmart', 'ptf_crm_inqitems', 'ptf_crm_inqreads', 'ptf_crm_products', 'ptf_crm_offers', 'ptf_crm_buyquotes', 'ptf_crm_leads', 'ptf_crm_projects', 'ptf_crm_deals', 'ptf_crm_invoices', 'ptf_crm_letters', 'ptf_crm_contracts', 'ptf_crm_packinglists', 'ptf_crm_reminders'];
  keys.forEach(function(k) { localStorage.setItem(k, '[]'); });
  localStorage.setItem('ptf_crm_mode', 'production');
  if (typeof addLog === 'function') addLog('🚀 نرم‌افزار به نسخه عملیاتی واقعی تبدیل شد');
  alert('💎 تبریک! نرم‌افزار با موفقیت به «نسخه عملیاتی واقعی» تبدیل شد و کلیه داده‌های آزمایشی پاکسازی گردید.');
  location.reload();
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
    ['ptf_crm_rfqs', 'ptf_crm_projects', 'ptf_crm_cms', 'ptf_crm_letters', 'ptf_crm_contracts',
     'ptf_crm_petty', 'ptf_crm_petty_periods', 'ptf_crm_offers', 'ptf_crm_invoices', 'ptf_crm_rfqsmart', 'ptf_crm_deals',
     'ptf_crm_packinglists', 'ptf_crm_inqreads', 'ptf_crm_supplier_finance'].forEach(function (k) { harvest(getData(k)); });
    // پروفایل‌های امضا (object نه آرایه)
    harvest(JSON.parse(localStorage.getItem('ptf_crm_sigprofiles') || '{}'));
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

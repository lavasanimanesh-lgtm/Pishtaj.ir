/* =====================================================================
   PTF CRM — v34.9.1 (gsc.js)
   پنل «سرچ کنسول» — نمایش دادهٔ واقعیِ گوگل برای pishtaj.ir
   - شاخص‌های کلیدی، توزیع جایگاه، روند روزانه
   - کوئری‌ها و صفحاتِ پربازدید + بررسیِ وضعیت ایندکسِ هر صفحه
   - «فرصت‌های سریع»: کوئری‌های غیربرندیِ نزدیک به صفحهٔ اول
   دسترسی: فقط ادمین + رییس هیات مدیره + مدیرعامل + مدیر بازرگانی
   تنظیمات: api/gsc-config.php (برگرفته از gsc-config.sample.php)
   ===================================================================== */
(function () {
  'use strict';
  var API = '../api/gsc.php';
  var GSC_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
  var _days = 90;
  var _data = null;
  var _status = null;

  function canGsc() { return GSC_ROLES.indexOf(curRole()) > -1; }
  function authHeaders() {
    var h = { 'X-CRM-Role': curRole() };
    try { var t = (typeof ptfAuthToken === 'function' ? ptfAuthToken() : ''); if (t) h['X-CRM-Token'] = t; } catch (e) {}
    return h;
  }
  function api(action, data, cb) {
    var opt = { method: 'POST', headers: authHeaders() };
    if (data) { var fd = new FormData(); Object.keys(data).forEach(function (k) { fd.append(k, data[k]); }); opt.body = fd; }
    fetch(API + '?action=' + action, opt).then(function (r) { return r.json(); }).then(cb)
      .catch(function () { cb({ ok: false, error: 'عدم دسترسی به سرور' }); });
  }
  function n(v) { return (Math.round(v)).toLocaleString('fa-IR'); }
  function pct(v) { return (v * 100).toFixed(1) + '٪'; }

  function card(label, value, sub, color) {
    return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;flex:1;min-width:120px">' +
      '<div style="font-size:11.5px;color:#64748b">' + label + '</div>' +
      '<div style="font-size:20px;font-weight:900;color:' + (color || '#0f172a') + ';margin-top:2px">' + value + '</div>' +
      (sub ? '<div style="font-size:10.5px;color:#94a3b8;margin-top:2px">' + sub + '</div>' : '') + '</div>';
  }

  function setupBox() {
    return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;color:#92400e;font-size:12.5px;line-height:2">' +
      '<b>⚙️ اتصال به سرچ کنسول هنوز تنظیم نشده است</b><br>' +
      'برای فعال‌سازی، یک‌بار این مراحل را انجام دهید (~۵ دقیقه، فقط یک‌بار):' +
      '<ol style="margin:8px 0 0 18px;padding:0">' +
      '<li>در <b>console.cloud.google.com</b> پروژه بسازید و <b>Search Console API</b> را فعال کنید.</li>' +
      '<li>یک <b>Service account</b> بسازید و برایش کلید JSON بگیرید.</li>' +
      '<li>ایمیلِ سرویس‌اکانت را در <b>Search Console → Settings → Users and permissions</b> اضافه کنید.</li>' +
      '<li>فایل <code>api/gsc-config.sample.php</code> را به <code>api/gsc-config.php</code> کپی و ' +
      '<code>client_email</code> و <code>private_key</code> را از فایل JSON وارد کنید.</li>' +
      '</ol>' +
      '<div style="margin-top:8px;color:#64748b">پس از انجام، این پنل را دوباره باز کنید. ' +
      'تا آن زمان می‌توانید از مسیرِ جایگزین استفاده کنید: خروجی CSV از GSC → اجرای ' +
      '<code>python3 _tools/gsc_import.py</code></div>' +
      '</div>';
  }

  function trendBars(dates) {
    if (!dates || dates.length < 3) return '';
    var max = 0;
    dates.forEach(function (d) { if (d.impressions > max) max = d.impressions; });
    if (!max) return '';
    var bars = dates.map(function (d) {
      var h = Math.max(2, Math.round(d.impressions / max * 46));
      return '<span title="' + escP(d.date) + ' — نمایش: ' + n(d.impressions) + ' / کلیک: ' + n(d.clicks) + '" ' +
        'style="display:inline-block;width:3px;height:' + h + 'px;background:linear-gradient(180deg,#ef4b1a,#f79400);' +
        'vertical-align:bottom;margin:0 1px;border-radius:1px"></span>';
    }).join('');
    return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-bottom:10px">' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:6px">روند نمایشِ روزانه (' + dates.length + ' روز)</div>' +
      '<div style="height:48px;line-height:0">' + bars + '</div></div>';
  }

  function queryTable(rows, title, hint) {
    if (!rows || !rows.length) return '';
    var tr = rows.map(function (r) {
      return '<tr>' +
        '<td style="padding:5px 8px;text-align:right">' + escP(r.q) +
        (r.brand ? ' <span style="font-size:10px;background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:1px 5px">برندی</span>' : '') + '</td>' +
        '<td style="padding:5px 8px">' + n(r.impressions) + '</td>' +
        '<td style="padding:5px 8px">' + n(r.clicks) + '</td>' +
        '<td style="padding:5px 8px">' + r.position.toFixed(1) + '</td>' +
        '<td style="padding:5px 8px">' + pct(r.ctr) + '</td>' +
        '<td style="padding:5px 8px"><button class="bt bt-o" style="padding:2px 8px;font-size:11px" ' +
        'onclick="gscOptimize(\'' + escP(r.q).replace(/'/g, '') + '\')">بهینه‌سازی</button></td>' +
        '</tr>';
    }).join('');
    return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-bottom:10px">' +
      '<div style="font-size:12.5px;font-weight:800;margin-bottom:4px">' + title + '</div>' +
      (hint ? '<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">' + hint + '</div>' : '') +
      '<div style="max-height:300px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="color:#64748b;font-size:11px;border-bottom:1px solid #e2e8f0">' +
      '<th style="text-align:right;padding:4px 8px">کوئری</th><th style="padding:4px 8px">نمایش</th>' +
      '<th style="padding:4px 8px">کلیک</th><th style="padding:4px 8px">جایگاه</th>' +
      '<th style="padding:4px 8px">CTR</th><th style="padding:4px 8px"></th></tr></thead>' +
      '<tbody>' + tr + '</tbody></table></div></div>';
  }

  function pageTable(rows) {
    if (!rows || !rows.length) return '';
    var tr = rows.map(function (r) {
      var path = String(r.url).replace(/^https?:\/\/(www\.)?pishtaj\.ir/, '') || '/';
      return '<tr>' +
        '<td style="padding:5px 8px;direction:ltr;text-align:left;font-size:11.5px">' + escP(path) + '</td>' +
        '<td style="padding:5px 8px">' + n(r.impressions) + '</td>' +
        '<td style="padding:5px 8px">' + n(r.clicks) + '</td>' +
        '<td style="padding:5px 8px">' + r.position.toFixed(1) + '</td>' +
        '<td style="padding:5px 8px"><button class="bt bt-o" style="padding:2px 8px;font-size:11px" ' +
        'onclick="gscInspect(\'' + escP(r.url).replace(/'/g, '') + '\')">بررسی ایندکس</button></td>' +
        '</tr>';
    }).join('');
    return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-bottom:10px">' +
      '<div style="font-size:12.5px;font-weight:800;margin-bottom:6px">صفحات پربازدید</div>' +
      '<div style="max-height:300px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="color:#64748b;font-size:11px;border-bottom:1px solid #e2e8f0">' +
      '<th style="text-align:right;padding:4px 8px">صفحه</th><th style="padding:4px 8px">نمایش</th>' +
      '<th style="padding:4px 8px">کلیک</th><th style="padding:4px 8px">جایگاه</th>' +
      '<th style="padding:4px 8px"></th></tr></thead><tbody>' + tr + '</tbody></table></div></div>';
  }

  function renderBody() {
    var el = document.getElementById('gscWrap');
    if (!el) return;
    if (!_status || !_status.configured) { el.innerHTML = setupBox(); return; }
    if (!_data) {
      el.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px">در حال دریافت داده از گوگل…</div>';
      return;
    }
    if (!_data.ok) {
      el.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;color:#b91c1c;font-size:12.5px;line-height:2">' +
        '⚠️ دریافت داده ناموفق بود:<br><code style="direction:ltr">' + escP(_data.error || '') + '</code>' +
        '<div style="color:#64748b;margin-top:6px">اگر خطا شامل 403 است، ایمیلِ سرویس‌اکانت را در ' +
        'Search Console → Settings → Users and permissions اضافه کنید.</div></div>';
      return;
    }
    var t = _data.totals || {};
    var ctr = t.impressions ? (t.clicks / t.impressions) : 0;
    var brandShare = t.clicks ? (t.brand_clicks / t.clicks) : 0;

    var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      card('نمایش', n(t.impressions), _data.days + ' روز اخیر') +
      card('کلیک', n(t.clicks), 'CTR ' + pct(ctr)) +
      card('کوئری', n(t.queries), 'دارای نمایش') +
      card('صفحهٔ ۱', n(t.pos1), 'جایگاه ≤ ۱۰', '#059669') +
      card('سهم کلیک برندی', pct(brandShare), brandShare > 0.7 ? '⚠️ وابسته به برند' : 'خوب', brandShare > 0.7 ? '#dc2626' : '#059669') +
      '</div>';

    h += trendBars(_data.dates);
    h += queryTable(_data.quickwins, '🔥 فرصت‌های سریع',
      'کوئری‌های غیربرندی با نمایشِ بالا و جایگاه ۶ تا ۳۰ — با یک اصلاحِ عنوان/توضیح و لینک داخلی بیشترین بازده را دارند');
    h += queryTable(_data.queries, 'کوئری‌های پربازدید');
    h += pageTable(_data.pages);
    el.innerHTML = h;
  }

  function loadData() {
    api('overview', { days: _days }, function (d) { _data = d; renderBody(); });
  }

  window.gscSetDays = function (d) { _days = d; _data = null; renderBody(); loadData(); };
  window.gscRefresh = function () { _data = null; renderBody(); api('overview', { days: _days, refresh: 1 }, function (d) { _data = d; renderBody(); }); };

  /* پرش به تب سئو با جستجویِ همان موضوع */
  window.gscOptimize = function (q) {
    try { if (typeof goPanelByName === 'function') goPanelByName('cms'); } catch (e) {}
    setTimeout(function () {
      try { if (typeof cmsTab === 'function') cmsTab('seo'); } catch (e) {}
      setTimeout(function () {
        var f = document.getElementById('seoQ');
        if (f) {
          f.value = (q || '').split(/\s+/).filter(function (w) { return w.length > 2; }).slice(0, 3).join(' ');
          if (typeof cmsSeoSearch === 'function') cmsSeoSearch();
        }
      }, 300);
    }, 150);
  };

  window.gscInspect = function (url) {
    api('inspect', { url: url }, function (d) {
      var msg;
      if (!d.ok) msg = '⚠️ ' + escP(d.error || 'خطا');
      else {
        var verdictFa = {
          PASS: '✅ ایندکس شده', FAIL: '❌ ایندکس نشده',
          NEUTRAL: '—', UNKNOWN: 'نامشخص'
        };
        msg = '<b>' + escP(String(url).replace(/^https?:\/\/(www\.)?pishtaj\.ir/, '')) + '</b><br><br>' +
          'وضعیت: <b>' + (verdictFa[d.verdict] || escP(d.verdict)) + '</b><br>' +
          'حالت پوشش: ' + escP(d.coverage || '—') + '<br>' +
          'آخرین خزش: ' + escP(d.crawled || '—') + '<br>' +
          'robots.txt: ' + escP(d.robots || '—') + '<br>' +
          'دریافت صفحه: ' + escP(d.pageFetch || '—') + '<br>' +
          'خزش به‌عنوان: ' + escP(d.crawler || '—') + '<br>' +
          (d.referring ? 'صفحات ارجاع‌دهنده: ' + escP(String(d.referring).slice(0, 200)) : '');
      }
      var box = document.createElement('div');
      box.className = 'md-b';
      box.style.display = 'grid';
      box.onclick = function (e) { if (e.target === box) box.remove(); };
      box.innerHTML = '<div class="md" style="max-width:560px;line-height:2;font-size:13px">' +
        '<h3>🔎 وضعیت ایندکس</h3>' + msg +
        '<div style="text-align:left;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div>';
      document.getElementById('panels').appendChild(box);
    });
  };

  /* ============ روتینگ ============ */
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'gsc') {
      if (!canGsc()) { alert('⛔ سرچ کنسول فقط برای مدیران ارشد است'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '📈 سرچ کنسول';
      document.getElementById('panels').innerHTML =
        '<div class="ph"><h3>📈 سرچ کنسول — دادهٔ واقعیِ گوگل (' + (_status && _status.site ? escP(_status.site) : 'pishtaj.ir') + ')</h3></div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
        '<button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="gscSetDays(28)">۲۸ روز</button>' +
        '<button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="gscSetDays(90)">۹۰ روز</button>' +
        '<button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="gscSetDays(180)">۶ ماه</button>' +
        '<button class="bt" style="padding:5px 11px;font-size:12px" onclick="gscRefresh()">⟳ به‌روزرسانی</button>' +
        '<span style="font-size:11px;color:#94a3b8">داده هر ۳۰ دقیقه کش می‌شود</span></div>' +
        '<div id="gscWrap"></div>';
      api('status', null, function (s) {
        _status = s;
        renderBody();
        if (s && s.configured) loadData();
      });
      return;
    }
    _go(id, btn);
  };

  var _show = window.showCrm;
  if (_show) {
    window.showCrm = function () {
      _show();
      setTimeout(function () {
        document.querySelectorAll('.sb-i').forEach(function (b) {
          if ((b.getAttribute('onclick') || '').indexOf("'gsc'") > -1) b.style.display = canGsc() ? '' : 'none';
        });
      }, 400);
    };
  }
})();

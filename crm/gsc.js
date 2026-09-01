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
        '<td style="padding:5px 8px;white-space:nowrap"><button class="bt bt-o" style="padding:2px 8px;font-size:11px" ' +
        'onclick="gscOptimize(\'' + escP(r.q).replace(/'/g, '') + '\')">بهینه‌سازی</button> ' +
        '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#b45309" title="افزودن/حذف در واچ‌لیست جایگاه" ' +
        'onclick="gscWatchToggle(\'' + ptfOnClickArg(r.q) + '\')">⭐</button></td>' +
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

    h += '<div id="gscTrend"></div>'; /* v34.12.0 (S3): روند اسنپ‌شات‌ها */
    h += '<div id="gscWatch"></div>'; /* v34.16.0 (S3-id): واچ‌لیست جایگاه */
    h += '<div id="gscAi"></div>'; /* v34.17.0 (S3-id): صفحات AI در برابر بقیه */
    h += trendBars(_data.dates);
    h += '<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:10px 12px;margin-top:10px">' + /* v34.12.0 (S3) */
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:12.5px;color:#6b21a8">🧠 برنامهٔ محتوا با هوش مصنوعی</b>' +
      '<button class="bt" style="padding:5px 12px;font-size:12px;background:#7c3aed" onclick="gscContentPlan()">تحلیل فرصت‌ها و پیشنهاد</button>' +
      '<span style="font-size:11px;color:#94a3b8">خوشه‌بندی کلماتِ فرصت + تطبیق با صفحات موجود: صفحهٔ جدید بسازم یا همین را بهینه کنم؟</span></div>' +
      '<div id="gscPlan" style="margin-top:6px"></div></div>';
    h += queryTable(_data.quickwins, '🔥 فرصت‌های سریع',
      'کوئری‌های غیربرندی با نمایشِ بالا و جایگاه ۶ تا ۳۰ — با یک اصلاحِ عنوان/توضیح و لینک داخلی بیشترین بازده را دارند');
    h += queryTable(_data.queries, 'کوئری‌های پربازدید');
    h += pageTable(_data.pages);

    /* --- پوششِ ایندکس: صفحاتِ بدونِ داده + درخواستِ ایندکس --- */
    h += '<div style="margin-top:14px;background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px 14px">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<b>🗂 پوششِ ایندکس</b>' +
      '<button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="gscCoverage(0)">نمایش صفحاتِ بدونِ داده</button>' +
      '<span style="font-size:11px;color:#94a3b8">صفحاتِ نقشهٔ سایت که در این بازه هیچ نمایش/کلیک نداشته‌اند</span></div>' +
      '<div id="gscCov" style="margin-top:8px"></div></div>';

    el.innerHTML = h;
    gscTrendLoad(); /* v34.12.0 (S3) */
    gscWatchLoad(); /* v34.16.0 (S3-id) */
    gscAiLoad(); /* v34.17.0 (S3-id) */
  }

  /* پوششِ ایندکس — verify>0 یعنی تأییدِ قطعیِ چند مورد با URL Inspection (سهمیهٔ روزانه محدود است) */
  window.gscCoverage = function (verify) {
    var box = document.getElementById('gscCov');
    if (!box) return;
    box.innerHTML = '<div style="color:#94a3b8;font-size:12px">در حال مقایسهٔ نقشهٔ سایت با دادهٔ سرچ کنسول…</div>';
    var params = { days: (_data && _data.days) || 90 };
    if (verify) params.verify = verify;
    api('coverage', params, function (d) {
      if (!d || !d.ok) {
        box.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px;color:#b91c1c;font-size:12px">' +
          '⚠️ ' + escP((d && d.error) || 'خطا در دریافت پوشش ایندکس') + '</div>';
        return;
      }
      var h = '<div style="font-size:12px;line-height:2;color:#475569">' +
        'کلِ صفحاتِ نقشه: <b>' + n(d.sitemap_total) + '</b> · دارای داده: <b>' + n(d.with_data) + '</b> · ' +
        'بدونِ داده: <b style="color:#dc2626">' + n((d.no_data || []).length) + '</b>' +
        (d.cached ? ' <span style="color:#94a3b8">(کش)</span>' : '') + '</div>' +
        '<div style="font-size:11px;color:#94a3b8;line-height:1.9;margin:4px 0 8px">' + escP(d.note || '') + '</div>';

      var nd = d.no_data || [];
      if (!nd.length) {
        box.innerHTML = h + '<div style="color:#059669;font-size:12.5px">✅ همهٔ صفحاتِ نقشه در این بازه داده داشته‌اند.</div>';
        return;
      }
      h += '<div style="max-height:340px;overflow:auto"><table class="tb"><thead><tr>' +
        '<th>صفحه</th><th>عملیات</th></tr></thead><tbody>';
      nd.slice(0, 200).forEach(function (r) {
        h += '<tr><td style="direction:ltr;font-size:11.5px">' + escP(r.url.replace('https://pishtaj.ir/', '')) + '</td>' +
          '<td style="white-space:nowrap">' +
          '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px" onclick="gscInspect(\'' + escP(r.url) + '\')">🔎 بررسی ایندکس</button> ' +
          '<a class="bt bt-o" style="padding:4px 9px;font-size:11.5px;text-decoration:none" target="_blank" rel="noopener" href="' + escP(r.inspectLink) + '">↗ درخواست ایندکس</a>' +
          '</td></tr>';
      });
      h += '</tbody></table></div>';
      if (nd.length > 200) h += '<div style="font-size:11px;color:#94a3b8;margin-top:6px">فقط ۲۰۰ مورد نخست نمایش داده شد.</div>';
      h += '<div style="margin-top:8px"><button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="gscCoverage(10)">🔬 تأییدِ قطعیِ ۱۰ مورد نخست (URL Inspection)</button></div>';
      h += '<div id="gscCovV"></div>';
      box.innerHTML = h;

      var v = d.verified || [];
      if (v.length) {
        var vh = '<table class="tb" style="margin-top:8px"><thead><tr><th>صفحه</th><th>وضعیت</th><th>آخرین خزش</th></tr></thead><tbody>';
        v.forEach(function (r) {
          var col = r.verdict === 'PASS' ? '#059669' : (r.verdict === 'FAIL' ? '#dc2626' : '#d97706');
          vh += '<tr><td style="direction:ltr;font-size:11px">' + escP(r.url.replace('https://pishtaj.ir/', '')) + '</td>' +
            '<td style="font-size:11.5px;color:' + col + '"><b>' + escP(r.verdict) + '</b>' + (r.coverage ? ' — ' + escP(r.coverage) : '') + '</td>' +
            '<td style="font-size:11px;direction:ltr">' + escP((r.crawled || '—').slice(0, 10)) + '</td></tr>';
        });
        vh += '</tbody></table>';
        var vb = document.getElementById('gscCovV');
        if (vb) vb.innerHTML = vh;
      }
    });
  };

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
    api('inspect', { url: url, log: 1 }, function (d) { /* v34.10.0 (S1/INDEX-LOOP): ثبت در تاریخچه */
      var msg;
      if (!d.ok) msg = '⚠️ ' + escP(d.error || 'خطا');
      else {
        var verdictFa = {
          PASS: '✅ ایندکس شده', FAIL: '❌ ایندکس نشده',
          NEUTRAL: '—', UNKNOWN: 'نامشخص'
        };
        var prevLine = '';
        if (d.prev && d.prev.ts) {
          var chg = (d.prev.verdict !== d.verdict);
          prevLine = '<div style="margin-top:6px;padding:6px 9px;background:#f8fafc;border-radius:8px;font-size:11.5px">سابقه: ' +
            (verdictFa[d.prev.verdict] || escP(d.prev.verdict || '—')) + ' در ' + escP(String(d.prev.ts).slice(0, 16).replace('T', ' ')) +
            (chg ? ' → <b style="color:#059669">وضعیت تغییر کرده</b>' : ' (بدون تغییر)') + '</div>';
        }
        msg = '<b>' + escP(String(url).replace(/^https?:\/\/(www\.)?pishtaj\.ir/, '')) + '</b><br><br>' +
          'وضعیت: <b>' + (verdictFa[d.verdict] || escP(d.verdict)) + '</b><br>' +
          'حالت پوشش: ' + escP(d.coverage || '—') + '<br>' +
          'آخرین خزش: ' + escP(d.crawled || '—') + '<br>' +
          'robots.txt: ' + escP(d.robots || '—') + '<br>' +
          'دریافت صفحه: ' + escP(d.pageFetch || '—') + '<br>' +
          'خزش به‌عنوان: ' + escP(d.crawler || '—') + '<br>' +
          (d.referring ? 'صفحات ارجاع‌دهنده: ' + escP(String(d.referring).slice(0, 200)) : '') + prevLine;
      }
      // پیوندِ مستقیم به صفحهٔ URL Inspection همان نشانی در سرچ کنسول؛
      // «درخواست ایندکس» فقط در UI خودِ گوگل وجود دارد (Indexing API برای
      // صفحاتِ غیرِ JobPosting/BroadcastEvent مجاز نیست).
      var lnk = (d && d.ok && d.inspectLink) ? String(d.inspectLink) : '';
      var box = document.createElement('div');
      box.className = 'md-b';
      box.style.display = 'grid';
      box.onclick = function (e) { if (e.target === box) box.remove(); };
      box.innerHTML = '<div class="md" style="max-width:560px;line-height:2;font-size:13px">' +
        '<h3>🔎 وضعیت ایندکس</h3>' + msg +
        (lnk ? '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed #e2e8f0">' +
          '<a class="bt" href="' + escP(lnk) + '" target="_blank" rel="noopener" style="text-decoration:none">↗ درخواست ایندکس در سرچ کنسول</a>' +
          '<div style="font-size:11.5px;color:#94a3b8;margin-top:6px">گوگل برای این کار API عمومی ندارد؛ این پیوند شما را به صفحهٔ بازرسیِ همان نشانی می‌برد تا دکمهٔ Request Indexing را بزنید (سهمیهٔ روزانهٔ گوگل محدود است).</div></div>' : '') +
        '<div style="text-align:left;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div>';
      document.getElementById('panels').appendChild(box);
    });
  };

  /* ثبتِ نقشه در سرچ کنسول (اکشنِ sitemap_submit — نیازمندِ سطحِ Full) */
  /* v34.10.0 (S1/AUTO-SITEMAP): ثبت بی‌سروصدا — بدون confirm و بدون alert؛ فقط یک خط وضعیت.
     پس از هر انتشار CMS وقتی سوییچ «ثبت خودکار نقشه» روشن است صدا زده می‌شود. */
  window.gscSubmitSitemapQuiet = function () {
    var host = document.getElementById('gscWrap');
    var markId = 'gscSmQ' + Date.now();
    if (host) host.insertAdjacentHTML('afterbegin', '<div id="' + markId + '" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:7px 11px;font-size:11.5px;margin-bottom:8px">⏳ ثبت خودکار نقشهٔ سایت در سرچ کنسول…</div>');
    api('sitemap_submit', { feed: 'https://pishtaj.ir/sitemap-index.xml' }, function (d) {
      var m = document.getElementById(markId);
      if (!d || !d.ok) { if (m) m.innerHTML = '⚠️ ثبت خودکار نقشه ناموفق بود: ' + escP((d && d.error) || 'خطا'); return; }
      if (m) m.innerHTML = '✅ نقشهٔ سایت در سرچ کنسول ثبت/به‌روزرسانی شد (' + escP(d.state || '') + ' · خطا: ' + (d.errors || 0) + ')';
    });
  };

  /* ═══ v34.12.0 (S3): KPI روند از اسنپ‌شات‌ها + برنامهٔ محتوا با خوشه‌بندی AI ═══ */
  function gscLLM(action, body, cb) {
    var h = authHeaders(); h['Content-Type'] = 'application/json';
    fetch('../api/llm.php?action=' + action, { method: 'POST', headers: h, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(cb)
      .catch(function () { cb({ ok: false, error: 'عدم دسترسی به هوش مصنوعی' }); });
  }

  window.gscTrendLoad = function () {
    var box = document.getElementById('gscTrend'); if (!box) return;
    api('snaps', {}, function (d) {
      if (!d.ok || !(d.series || []).length) { box.innerHTML = ''; return; }
      var ser = d.series;
      var max = Math.max.apply(null, ser.map(function (x) { return x.clicks; })) || 1;
      var bars = ser.slice(-30).map(function (x) {
        var hp = Math.max(4, Math.round((x.clicks / max) * 46));
        return '<div title="' + escP(x.date) + ' — ' + n(x.clicks) + ' کلیک / ' + n(x.impressions) + ' نمایش" style="width:7px;height:' + hp + 'px;background:linear-gradient(180deg,#f79400,#ef4b1a);border-radius:2px"></div>';
      }).join('');
      var dl = d.delta;
      var dlH = dl ? '<span style="font-size:11.5px;margin-right:auto;color:#64748b">مقایسهٔ ' + escP(dl.from) + ' → ' + escP(dl.to) + ': ' +
        'کلیک <b style="color:' + (dl.clicks >= 0 ? '#059669' : '#dc2626') + '">' + (dl.clicks >= 0 ? '+' : '') + dl.clicks + '%</b> · ' +
        'نمایش <b style="color:' + (dl.impressions >= 0 ? '#059669' : '#dc2626') + '">' + (dl.impressions >= 0 ? '+' : '') + dl.impressions + '%</b></span>' : '';
      box.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:8px;background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px">' +
        '<div style="display:flex;gap:2px;align-items:flex-end;height:48px">' + bars + '</div>' +
        '<span style="font-size:11px;color:#94a3b8">' + ser.length + ' اسنپ‌شات روزانه</span>' + dlH + '</div>';
    });
  };

  /* ═══ v34.16.0 (S3-id/WATCH): واچ‌لیست جایگاه — روند از اسنپ‌شات‌های روزانه ═══ */
  window.gscWatchToggle = function (q) {
    api('watch_toggle', { q: q }, function (d) {
      if (!d.ok) { alert('⚠️ ' + (d.error || 'خطا')); return; }
      audit('GSC', (d.on ? 'افزودن به واچ‌لیست: ' : 'حذف از واچ‌لیست: ') + q, '');
      gscWatchLoad();
    });
  };
  function gscWatchPosColor(p) { return p <= 3 ? '#059669' : (p <= 10 ? '#b45309' : '#dc2626'); }
  window.gscWatchLoad = function () {
    var box = document.getElementById('gscWatch'); if (!box) return;
    api('watch_list', {}, function (d) {
      if (!box) return;
      if (!d.ok) { box.innerHTML = ''; return; }
      var items = d.items || [];
      if (!items.length) { box.innerHTML = ''; return; }
      var rows = items.map(function (it) {
        var last = it.last, prev = it.prev, ser = it.series || [];
        var posH = last ? '<b style="color:' + gscWatchPosColor(last.pos) + ';font-size:14px">' + last.pos.toFixed(1) + '</b>' : '<span style="color:#94a3b8">خارج از ۳۰تای برتر</span>';
        var dlH = '—';
        if (it.delta !== null && it.delta !== undefined) {
          var up = it.delta > 0, eq = it.delta === 0;
          dlH = eq ? 'بدون تغییر' : ('<b style="color:' + (up ? '#059669' : '#dc2626') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(it.delta).toFixed(1) + '</b> <small style="color:#94a3b8">' + (up ? 'بهبود' : 'افت') + '</small>');
        }
        /* میله‌های جایگاه: جایگاه بهتر = میلهٔ بلندتر */
        var bars = '';
        if (ser.length > 1) {
          var mx = Math.max.apply(null, ser.map(function (x) { return x.pos; })) || 1;
          bars = '<div style="display:flex;gap:1.5px;align-items:flex-end;height:26px" title="' + ser.map(function (x) { return x.d + ': ' + x.pos.toFixed(1); }).slice(-12).join(' | ') + '">' +
            ser.slice(-16).map(function (x) {
              var hp = Math.max(3, Math.round(((mx - x.pos) / mx) * 26) + 3);
              return '<div style="width:5px;height:' + hp + 'px;background:' + gscWatchPosColor(x.pos) + ';border-radius:1.5px;opacity:.75"></div>';
            }).join('') + '</div>';
        }
        return '<tr>' +
          '<td style="padding:5px 8px;text-align:right"><b>' + escP(it.q) + '</b></td>' +
          '<td style="padding:5px 8px">' + posH + (last ? '<br><small style="color:#94a3b8">' + escP(last.d) + '</small>' : '') + '</td>' +
          '<td style="padding:5px 8px">' + dlH + '</td>' +
          '<td style="padding:5px 8px">' + (last ? n(last.clicks) : '—') + '</td>' +
          '<td style="padding:5px 8px">' + (last ? n(last.imp) : '—') + '</td>' +
          '<td style="padding:5px 8px">' + bars + '</td>' +
          '<td style="padding:5px 8px"><button class="bt bt-o" style="padding:2px 8px;font-size:11px;color:#b91c1c" onclick="gscWatchToggle(&#39;' + ptfOnClickArg(it.q) + '&#39;)">✖</button></td>' +
          '</tr>';
      }).join('');
      box.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px">' +
        '<div style="font-size:12.5px;font-weight:800">⭐ واچ‌لیست جایگاه <span style="font-weight:400;color:#94a3b8;font-size:11px">(' + items.length + ')</span></div>' +
        '<span style="font-size:10.5px;color:#94a3b8">روند جایگاه از اسنپ‌شات‌های روزانه — با ⭐ کنار هر کوئری اضافه/حذف کنید</span></div>' +
        '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:6px 12px;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr style="color:#64748b;font-size:11px;border-bottom:1px solid #e2e8f0"><th style="text-align:right;padding:4px 8px">کلمه</th><th>آخرین جایگاه</th><th>دلتا</th><th>کلیک</th><th>نمایش</th><th>روند</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
    });
  };

  /* ═══ v34.17.0 (S3-id/AI-IMPACT): صفحات AI-لمس‌شده در برابر بقیه ═══ */
  window.gscAiLoad = function () {
    var box = document.getElementById('gscAi'); if (!box) return;
    api('ai_pages', {}, function (d) {
      if (!box) return;
      if (!d.ok || !(d.days || []).length) { box.innerHTML = ''; return; }
      var t = d.tot || {};
      if (!(d.aiTotal > 0)) {
        box.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;background:#fff;border:1px dashed var(--brd);border-radius:12px;padding:9px 12px;font-size:11.5px;color:#64748b">🤖 پس از اولین انتشارِ صفحهٔ هوشمند (مولد صفحه/محصول/متای AI)، مقایسهٔ عملکرد «AI در برابر بقیه» اینجا ظاهر می‌شود.</div>';
        return;
      }
      /* سهم کلیک AI در طول زمان — میله‌ها */
      var bars = (d.days || []).slice(-30).map(function (x) {
        var share = (x.aC + x.rC) > 0 ? (x.aC / (x.aC + x.rC)) : 0;
        var hp = Math.max(3, Math.round(share * 44));
        return '<div title="' + escP(x.d) + ' — AI: ' + n(x.aC) + ' کلیک / جایگاه ' + (x.aP || '—') + ' · بقیه: ' + n(x.rC) + ' کلیک / جایگاه ' + (x.rP || '—') + '" style="width:7px;height:' + hp + 'px;background:linear-gradient(180deg,#a855f7,#7c3aed);border-radius:2px"></div>';
      }).join('');
      var s1 = t.shareFirst, s2 = t.shareLast;
      var trend = (s1 !== null && s2 !== null && s1 !== s2)
        ? '<b style="color:' + (s2 > s1 ? '#059669' : '#dc2626') + '">' + (s2 > s1 ? '▲ ' : '▼ ') + Math.abs(s2 - s1).toFixed(1) + ' واحد</b> (از ' + s1 + '٪ به ' + s2 + '٪)'
        : 'بدون تغییر';
      var lastDay = (d.days || []).slice(-1)[0] || {};
      var posCmp = (lastDay.aP && lastDay.rP)
        ? 'AI: <b style="color:' + gscWatchPosColor(lastDay.aP) + '">' + lastDay.aP + '</b> در برابر بقیه: <b style="color:' + gscWatchPosColor(lastDay.rP) + '">' + lastDay.rP + '</b>'
        : '—';
      var rows = (d.pages || []).map(function (p) {
        return '<tr><td dir="ltr" style="padding:4px 8px;font-size:10.5px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escP(p.path) + '</td>' +
          '<td style="padding:4px 8px">' + n(p.clicks) + '</td><td style="padding:4px 8px">' + n(p.imp) + '</td>' +
          '<td style="padding:4px 8px"><b style="color:' + gscWatchPosColor(p.pos) + '">' + p.pos.toFixed(1) + '</b></td></tr>';
      }).join('');
      box.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px">' +
        '<div style="font-size:12.5px;font-weight:800">🤖 صفحات هوش مصنوعی <span style="font-weight:400;color:#94a3b8;font-size:11px">(' + d.aiTotal + ' صفحه)</span></div>' +
        '<span style="font-size:11.5px;color:#64748b">سهم از کلیک‌ها: <b style="color:#7c3aed">' + (t.share || 0) + '٪</b> · روند سهم: ' + trend + '</span>' +
        '<span style="font-size:11.5px;color:#64748b;margin-right:auto">میانگین جایگاه (آخرین روز): ' + posCmp + '</span></div>' +
        '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;background:#fff;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-top:6px">' +
        '<div style="display:flex;gap:2px;align-items:flex-end;height:46px">' + bars + '</div>' +
        '<span style="font-size:11px;color:#94a3b8">سهم کلیکِ صفحات AI از کل (۳۰ روز آخر)</span></div>' +
        (rows ? '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:6px 12px;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
          '<thead><tr style="color:#64748b;font-size:11px;border-bottom:1px solid #e2e8f0"><th style="text-align:right;padding:4px 8px">صفحهٔ هوشمند (در آخرین اسنپ‌شات)</th><th>کلیک</th><th>نمایش</th><th>جایگاه</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' : '') +
        '<div style="font-size:10.5px;color:#94a3b8;margin-top:4px">📌 ' + escP(d.note || '') + ' — منبع: رجیستری صفحات لمس‌شده (مولد صفحه/زمان‌بند/وبلاگ/مرکز دانش/محصول/متای AI/بینایی).</div>';
    });
  };

  window.gscContentPlan = function () {
    var box = document.getElementById('gscPlan'); if (!box) return;
    if (!_data || !_data.ok) return;
    var qs = (_data.quickwins || []).slice(0, 25).map(function (r) { return { q: r.q || r.query || '', impressions: r.impressions, clicks: r.clicks, position: r.position }; })
      .concat((_data.no_click || []).slice(0, 15).map(function (r) { return { q: r.q || r.query || '', impressions: r.impressions, clicks: 0, position: r.position }; }));
    var ps = (_data.pages || []).slice(0, 30).map(function (r) { return { path: String(r.p || r.page || '').replace('https://pishtaj.ir/', ''), impressions: r.impressions }; });
    if (!qs.length) { box.innerHTML = '<div style="font-size:12px;color:#b91c1c">کوئری مناسبی برای خوشه‌بندی نیست.</div>'; return; }
    box.innerHTML = '<div style="font-size:12px;color:#6b21a8">⏳ هوش مصنوعی در حال خوشه‌بندی ' + qs.length + ' کلمه و تطبیق با صفحات موجود…</div>';
    gscLLM('seo_clusters', { queries: qs, pages: ps }, function (d) {
      if (!d.ok || !d.data || !d.data.clusters) { box.innerHTML = '<div style="font-size:12px;color:#b91c1c">⚠️ ' + escP(d.error || 'خطا') + '</div>'; return; }
      var h = '';
      d.data.clusters.forEach(function (c, i) {
        var isNew = c.action === 'new';
        h += '<div style="border:1px solid ' + (isNew ? '#bbf7d0' : '#fde68a') + ';background:' + (isNew ? '#f0fdf4' : '#fffbeb') + ';border-radius:10px;padding:9px 12px;margin-top:7px">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<b style="font-size:12.5px">' + escP(c.topic || '') + '</b>' +
          '<span style="font-size:10.5px;padding:2px 8px;border-radius:8px;background:' + (isNew ? '#059669' : '#d97706') + ';color:#fff">' + (isNew ? 'صفحهٔ جدید' : 'بهینه‌سازی صفحهٔ موجود') + '</span></div>' +
          '<div style="font-size:11px;color:#475569;margin-top:4px;line-height:1.8">' + escP(c.why || '') + '<br>کلمات: ' + (c.queries || []).slice(0, 6).map(escP).join('، ') + (c.target ? '<br>هدف: <span dir="ltr">' + escP(c.target) + '</span>' : '') + '</div>' +
          (isNew
            ? '<button class="bt" style="padding:4px 11px;font-size:11.5px;margin-top:6px" onclick="gscClusterNew(\'' + ptfOnClickArg(String(c.topic || '').slice(0, 80)) + '\')">📝 ساخت مقالهٔ جدید</button>'
            : '<button class="bt bt-o" style="padding:4px 11px;font-size:11.5px;margin-top:6px" onclick="gscOptimize(\'' + ptfOnClickArg((c.queries || [])[0] || c.topic || '') + '\')">🔍 بهینه‌سازی در تب سئو</button>') +
          '</div>';
      });
      box.innerHTML = '<div style="font-size:11.5px;color:#64748b;margin-bottom:4px">برنامهٔ پیشنهادی — هر مورد را با قضاوت انسانی اجرا کنید:</div>' + h;
    });
  };

  window.gscClusterNew = function (topic) {
    try { if (typeof goPanelByName === 'function') goPanelByName('cms'); } catch (e) {}
    setTimeout(function () {
      try { if (typeof cmsTab === 'function') cmsTab('blog'); } catch (e) {}
      setTimeout(function () {
        try { if (typeof cmsKcNew === 'function') cmsKcNew(); } catch (e) {}
        setTimeout(function () {
          var te = document.getElementById('kcTitle');
          if (te && !te.value) te.value = topic;
          if (typeof cmsKcCount === 'function') { try { cmsKcCount(); } catch (e) {} }
        }, 250);
      }, 250);
    }, 150);
  };

  window.gscSubmitSitemap = function () {
    if (!confirm('نقشهٔ سایت (sitemap-index.xml) در سرچ کنسول ثبت/به‌روزرسانی شود؟\n\nاین کار فقط به گوگل می‌گوید نقشه کجاست؛ ایندکس‌شدنِ صفحات را تضمین نمی‌کند.')) return;
    var el = document.getElementById('gscWrap');
    var mark = '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;font-size:12.5px;margin-bottom:10px">⏳ در حال ثبت نقشه…</div>';
    if (el) el.insertAdjacentHTML('afterbegin', mark);
    api('sitemap_submit', { feed: 'https://pishtaj.ir/sitemap-index.xml' }, function (d) {
      var box = document.getElementById('gscWrap');
      if (box) { var f = box.firstElementChild; if (f && f.textContent.indexOf('در حال ثبت نقشه') > -1) f.remove(); }
      if (!d || !d.ok) {
        var em = String((d && d.error) || 'خطای نامشخص');
        /* v34.12.0: خطای سرور اکنون علت دقیق فارسی دارد (سطح دسترسی/پراپرتی)؛ فقط برای خطاهای خام راهنما اضافه کن */
        var hint = (/permission_|property_not_found|سطح|پراپرتی/.test(em)) ? '' :
          '\n\nاگر خطا 403 است، سطحِ سرویس‌اکانت در سرچ کنسول باید Full باشد (Settings ← Users and permissions).';
        alert('⚠️ ثبت ناموفق:\n' + em + hint);
        return;
      }
      var err = parseInt(d.errors || '0', 10), wrn = parseInt(d.warnings || '0', 10);
      var msg = '✅ نقشه ثبت شد\n\nوضعیت: ' + (d.state || '—') +
        '\nخطا: ' + err + ' · هشدار: ' + wrn +
        (d.lastDownload ? '\nآخرین دریافتِ گوگل: ' + String(d.lastDownload).slice(0, 10) : '') +
        '\n\nنکته: «pending» یعنی گوگل هنوز نقشه را نخوانده؛ معمولاً چند ساعت تا چند روز طول می‌کشد.';
      alert(msg);
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
        '<button class="bt bt-o" style="padding:5px 11px;font-size:12px" onclick="gscSubmitSitemap()">📤 ثبت نقشه در سرچ کنسول</button>' +
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

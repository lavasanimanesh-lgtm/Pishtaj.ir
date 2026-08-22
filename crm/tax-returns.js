/* =====================================================================
   PTF CRM — tax-returns.js — v34.7.81 (TAX-RETURNS-SEPARATION)
   پنل مستقل «📁 اظهارنامه‌ها» — ذخیره و نمایش اظهارنامه‌های مالیاتی:
     • عملکرد سالانه → به تفکیک هر سال مالی
     • ارزش افزوده فصلی → به تفکیک فصل (بهار/تابستان/پاییز/زمستان) و سال انتخابی
   پیش از این این بخش داخل «فاکتورها» (rbac.js) رندر می‌شد و پنل را بهم می‌ریخت؛
   حالا ماژول مستقل است و در گروه سایدبار «کالا و اسناد» قرار می‌گیرد.
   مدل داده: ptf_crm_tax_returns — {cd, kind:'performance'|'vat', year, season,
   type, file, t, by, status} — سازگار با رکوردهای قدیمی (kind از type استنتاج می‌شود).
   ===================================================================== */
(function () {
  'use strict';

  var KEY = 'ptf_crm_tax_returns';
  var SEASONS = ['بهار', 'تابستان', 'پاییز', 'زمستان'];
  var ALLOWED = ['admin', 'chairman', 'ceo', 'commercial', 'accountant'];

  function role() { try { return String(curRole() || '').toLowerCase(); } catch (e) { return ''; } }
  function allowed() { return ALLOWED.indexOf(role()) > -1; }
  function canWrite() { return allowed(); }
  function esc(v) { return typeof escP === 'function' ? escP(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function arg(v) { return typeof ptfOnClickArg === 'function' ? ptfOnClickArg(v) : String(v == null ? '' : v).replace(/[\\']/g, ''); }
  function fa(n) { try { return String(n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); } catch (e) { return String(n); } }
  function all() { try { var v = getData(KEY); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function save(list) { setData(KEY, list); }
  function nowYear() { return String(new Date().getFullYear() - 621); }
  function toast(m, k) { if (typeof ptfToast === 'function') ptfToast(m, k || 'ok'); else alert(m); }

  /* kind از رکورد — سازگاری با دادهٔ قدیمی (type فارسی) */
  function kindOf(r) {
    if (r && (r.kind === 'performance' || r.kind === 'vat')) return r.kind;
    var t = String((r && r.type) || '');
    if (/عملکرد/.test(t)) return 'performance';
    return 'vat'; /* ارزش افزوده، ماده ۱۶۹، اعتبار ارزش افزوده → فصلی */
  }
  window.ptfTaxReturnsKindOf = kindOf;

  var state = { tab: 'performance', year: '' };

  function baseHtml() {
    if (!allowed()) return '<div style="text-align:center;color:#94a3b8;padding:40px">⛔ این بخش فقط برای مدیران ارشد و حسابدار است.</div>';
    return '<div class="ph"><h3>📁 اظهارنامه‌های مالیاتی</h3>' +
      '<span style="display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<button class="bt bt-o" style="font-size:12px" onclick="ptfTaxReturnsAdd()">➕ بارگذاری اظهارنامه</button>' +
      '</span></div>' +
      '<div style="display:flex;gap:6px;margin:4px 0 12px;flex-wrap:wrap" id="taxRetTabs">' +
      '<button class="bt" id="taxTabPerf" style="font-size:12px" onclick="ptfTaxReturnsTab(\'performance\')">💼 عملکرد سالانه</button>' +
      '<button class="bt bt-o" id="taxTabVat" style="font-size:12px" onclick="ptfTaxReturnsTab(\'vat\')">🧾 ارزش افزوده فصلی</button>' +
      '</div>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px">اظهارنامهٔ عملکرد برای هر سال مالی و اظهارنامهٔ ارزش افزوده برای هر فصل و سال انتخابی در همین بخش بایگانی و نمایش داده می‌شود.</div>' +
      '<div id="taxRetWrap"></div>';
  }

  function tabBtnState() {
    var bPerf = document.getElementById('taxTabPerf');
    var bVat = document.getElementById('taxTabVat');
    if (bPerf) bPerf.className = state.tab === 'performance' ? 'bt' : 'bt bt-o';
    if (bVat) bVat.className = state.tab === 'vat' ? 'bt' : 'bt bt-o';
  }

  function fileLink(f) {
    if (!f) return '—';
    if (f.key) return '<a href="javascript:void(0)" onclick="openStoredFile(\'' + arg(f.key) + '\')" style="color:#0e7490;font-weight:bold;text-decoration:underline">📎 ' + esc(f.name || 'پیوست') + '</a>';
    if (f.url) return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener" style="color:#0e7490;font-weight:bold;text-decoration:underline">📎 ' + esc(f.name || 'پیوست') + '</a>';
    return esc(f.name || '—');
  }

  function rowHtml(r) {
    var del = canWrite() ? '<button class="bt bt-o" style="padding:2px 8px;font-size:11px;color:#dc2626;border-color:#fecaca" onclick="ptfTaxReturnsDel(\'' + arg(r.cd) + '\')" title="حذف اظهارنامه">🗑</button>' : '';
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--brd);border-radius:11px;margin-bottom:7px;background:#fff;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px;font-size:12.5px">' +
      '<b>' + esc(r.type || (kindOf(r) === 'performance' ? 'اظهارنامه عملکرد سالانه' : 'ارزش افزوده فصلی')) + '</b>' +
      (r.season && kindOf(r) === 'vat' ? ' — <span style="color:#0e7490">' + esc(r.season) + '</span>' : '') +
      '<div style="font-size:11px;color:#64748b">' + fileLink(r.file) + ' — ثبت: ' + esc(r.by || '-') + ' — ' + esc(r.t || '') + '</div></div>' +
      del + '</div>';
  }

  /* ---- عملکرد سالانه: گروه‌بندی بر اساس سال ---- */
  function renderPerformance(el) {
    var list = all().filter(function (r) { return kindOf(r) === 'performance'; });
    var years = {};
    list.forEach(function (r) { var y = String(r.year || ''); if (!years[y]) years[y] = []; years[y].push(r); });
    var ys = Object.keys(years).sort().reverse();
    if (!ys.length) {
      el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:26px">اظهارنامهٔ عملکردی ثبت نشده است.</div>';
      return;
    }
    var h = '';
    ys.forEach(function (y) {
      h += '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:13px;padding:12px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
        '<b style="font-size:13.5px">💼 عملکرد سال مالی ' + fa(y) + '</b>' +
        (canWrite() ? '<button class="bt bt-o" style="padding:3px 10px;font-size:11.5px" onclick="ptfTaxReturnsAdd(\'performance\',\'' + arg(y) + '\')">➕ ثبت عملکرد این سال</button>' : '') +
        '</div>' + years[y].map(rowHtml).join('') + '</div>';
    });
    el.innerHTML = h;
  }

  /* ---- ارزش افزوده فصلی: سال انتخابی + چهار فصل ---- */
  function renderVat(el) {
    var vat = all().filter(function (r) { return kindOf(r) === 'vat'; });
    var years = {};
    vat.forEach(function (r) { var y = String(r.year || ''); if (y) years[y] = true; });
    var ys = Object.keys(years).sort().reverse();
    var cur = nowYear();
    if (ys.indexOf(cur) === -1) ys.unshift(cur);
    if (!state.year || ys.indexOf(state.year) === -1) state.year = ys[0];

    var sel = '<div class="fld" style="max-width:220px"><label>سال مالی (برای ارزش افزوده فصلی)</label><select onchange="ptfTaxReturnsYear(this.value)">' +
      ys.map(function (y) { return '<option value="' + y + '"' + (y === state.year ? ' selected' : '') + '>' + fa(y) + '</option>'; }).join('') +
      '</select></div>';

    var h = sel + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">';
    SEASONS.forEach(function (s) {
      var rows = vat.filter(function (r) { return String(r.year || '') === state.year && String(r.season || '') === s; });
      h += '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:13px;padding:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px">' +
        '<b style="font-size:12.5px">' + (s === 'بهار' ? '🌸' : s === 'تابستان' ? '☀️' : s === 'پاییز' ? '🍁' : '❄️') + ' ' + esc(s) + '</b>' +
        (canWrite() ? '<button class="bt bt-o" style="padding:2px 8px;font-size:11px" onclick="ptfTaxReturnsAdd(\'vat\',\'' + arg(state.year) + '\',\'' + arg(s) + '\')">➕ افزودن</button>' : '') +
        '</div>' +
        (rows.length ? rows.map(rowHtml).join('') : '<div style="color:#94a3b8;font-size:11px;padding:6px 2px">ثبت نشده</div>') +
        '</div>';
    });
    h += '</div>';
    el.innerHTML = h;
  }

  window.ptfTaxReturnsTab = function (t) {
    state.tab = t === 'vat' ? 'vat' : 'performance';
    tabBtnState();
    window.renderTaxReturns();
  };
  window.ptfTaxReturnsYear = function (y) {
    state.year = String(y || '');
    window.renderTaxReturns();
  };

  window.buildTaxReturns = function () { return baseHtml(); };

  window.renderTaxReturns = function () {
    var el = document.getElementById('taxRetWrap');
    if (!el) return;
    tabBtnState();
    if (state.tab === 'vat') renderVat(el);
    else renderPerformance(el);
  };

  /* ---- دیالوگ بارگذاری (عملکرد سالانه / ارزش افزوده فصلی) ---- */
  window.ptfTaxReturnsAdd = function (kind, year, season) {
    if (!canWrite()) { alert('⛔ فقط مدیران ارشد و حسابدار می‌توانند اظهارنامه بارگذاری کنند.'); return; }
    kind = kind === 'vat' ? 'vat' : 'performance';
    if (typeof ptfDialog !== 'function') { alert('ماژول دیالوگ در دسترس نیست'); return; }
    var defaultYear = year || nowYear();
    ptfDialog({
      title: '➕ بارگذاری اظهارنامه مالیاتی',
      body: 'نوع اظهارنامه، سال مالی و (برای ارزش افزوده) فصل را مشخص و فایل PDF/تصویر را ضمیمه کنید.',
      fields: [
        { id: 'kind', label: 'نوع اظهارنامه', type: 'select', value: kind, options: [
          { v: 'performance', lb: '💼 اظهارنامه عملکرد سالانه' },
          { v: 'vat', lb: '🧾 اظهارنامه ارزش افزوده فصلی' }
        ]},
        { id: 'year', label: 'سال مالی (شمسی)', type: 'number', money: false, value: defaultYear, required: true, dir: 'ltr' },
        { id: 'season', label: 'فصل (فقط ارزش افزوده)', type: 'select', value: season || 'بهار', options: [
          { v: 'بهار', lb: '🌸 بهار' }, { v: 'تابستان', lb: '☀️ تابستان' },
          { v: 'پاییز', lb: '🍁 پاییز' }, { v: 'زمستان', lb: '❄️ زمستان' }
        ]},
        { id: 'file', label: 'فایل اظهارنامه (PDF/تصویر)', type: 'upload', uploadFolder: 'tax-returns' }
      ],
      okText: '💾 ثبت اظهارنامه',
      onOk: function (v) {
        var y = String(v.year || '').trim();
        var yNum = +y;
        if (!y || isNaN(yNum) || yNum < 1300 || yNum > 1500) { alert('سال مالی معتبر وارد کنید (مثلاً 1403).'); return; }
        var k = v.kind === 'vat' ? 'vat' : 'performance';
        var files = Array.isArray(v.file) ? v.file : [];
        if (!files.length || !files[0].key) { alert('بارگذاری فایل اظهارنامه الزامی است.'); return; }
        var rec = {
          cd: (typeof genCode === 'function' ? genCode('TAX') : ('TAX-' + Date.now())),
          kind: k,
          year: y,
          season: k === 'vat' ? (v.season || 'بهار') : '',
          type: k === 'performance' ? 'اظهارنامه عملکرد سالانه' : 'ارزش افزوده فصلی',
          file: files[0],
          t: (typeof faDate === 'function' ? faDate() : new Date().toISOString().slice(0, 10)),
          by: (curSession() || {}).name || '?',
          status: 'active'
        };
        var list = all();
        list.unshift(rec);
        save(list);
        if (k === 'vat') state.tab = 'vat'; else state.tab = 'performance';
        if (k === 'vat') state.year = y;
        if (typeof audit === 'function') { try { audit('اظهارنامه‌ها', 'بارگذاری ' + rec.type + ' — سال ' + y + (rec.season ? ' فصل ' + rec.season : ''), rec.cd); } catch (e) {} }
        toast('اظهارنامه با موفقیت بایگانی شد.', 'ok');
        window.renderTaxReturns();
      }
    });
  };

  window.ptfTaxReturnsDel = function (cd) {
    if (!canWrite()) { alert('⛔ دسترسی ندارید'); return; }
    var list = all();
    var r = list.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    if (!confirm('حذف کامل این اظهارنامه از بایگانی مالیاتی؟\n' + (r.type || '') + ' — سال ' + (r.year || '') + (r.season ? ' فصل ' + r.season : ''))) return;
    save(list.filter(function (x) { return x.cd !== cd; }));
    if (typeof audit === 'function') { try { audit('اظهارنامه‌ها', 'حذف اظهارنامه ' + (r.type || '') + ' — سال ' + (r.year || ''), cd); } catch (e) {} }
    toast('اظهارنامه حذف شد.', 'warn');
    window.renderTaxReturns();
  };

  /* ---- اتصال به روتینگ (الگوی منکی‌پچ ماژول‌ها) ---- */
  (function hook() {
    var _go = window.goPanel;
    window.goPanel = function (id, btn) {
      if (id === 'taxret') {
        if (!allowed()) { alert('⛔ این بخش فقط برای مدیران ارشد و حسابدار است.'); return; }
        var btns = document.querySelectorAll('.sb-i');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
        if (btn) btn.classList.add('act');
        document.getElementById('pgTitle').textContent = '📁 اظهارنامه‌ها';
        document.getElementById('panels').innerHTML = buildTaxReturns();
        renderTaxReturns();
        return;
      }
      _go(id, btn);
    };
  })();
})();

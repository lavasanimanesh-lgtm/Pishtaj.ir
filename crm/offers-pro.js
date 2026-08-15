/* =====================================================================
   PTF CRM — offers-pro.js — Sprint 84
   US-182: پیشنهاد مالی ارزی (IRR / EUR / USD)
   US-183: درگ سرستون‌ها + حذف/اضافه بدون محدودیت + Sr. no → شماره ردیف
   US-185: چند قالب PDF حرفه‌ای (شبیه سربرگ) با پیش‌نمایش و انتخاب کاربر
   ===================================================================== */
(function () {
  'use strict';

  /* ============ US-182: ارز سند ============ */
  var CURRENCIES = [
    { id: 'IRR', lb: 'ریال ایران (IRR)', sym: 'IRR', words: 'Iranian Rials' },
    { id: 'EUR', lb: 'یورو (EUR)', sym: '€', words: 'Euros' },
    { id: 'USD', lb: 'دلار آمریکا (USD)', sym: '$', words: 'US Dollars' }
  ];
  window.PTF_CURRENCIES = CURRENCIES;
  window.offerCurrency = function (o) {
    return CURRENCIES.filter(function (c) { return c.id === (o.currency || 'IRR'); })[0] || CURRENCIES[0];
  };
  // فرمت عدد بر اساس ارز: ریال بدون اعشار، ارزی با ۲ رقم اعشار
  window.offerFmtMoney = function (v, cur) {
    v = +v || 0;
    if (!cur || cur.id === 'IRR') return v.toLocaleString('en-US');
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // تزریق فیلد ارز به فرم‌های مالی: بعد از باز شدن فرم صدا زده می‌شود
  /* v15.6 (US-387 ① — گزارش کارفرما): قبلا فقط kind==='CO' و لنگر ofValid — فرم TC (پیشنهاد فنی-مالی)
     نه شرط را رد می‌کرد نه لنگر داشت → انتخاب ارز در TC ناممکن بود. حالا CO و TC هر دو + لنگر جایگزین. */
  /* v33.4.2 (دستور صریح کارفرما — «سنا کلا اشتباه است، کنار گذاشته شود»): گزینه‌ی
     نرخ سنا از انتخاب مرجع قیمت‌گذاری حذف شد؛ فقط «آزاد» و «توافقی» باقی ماندند.
     اسناد قدیمی که قبلاً fxBasis='sana' ثبت کرده‌اند دست‌نخورده می‌مانند (نمایش
     تاریخی در offers.js/rbac.js حفظ شده) — این تغییر فقط مسیر ثبت جدید را می‌بندد. */
  function fxRefRowHtml() {
    var cur = (_offState && _offState.currency) || 'IRR';
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var freeRate = cur === 'USD' ? (+L.usd_free || 0) : cur === 'EUR' ? (+L.eur_free || 0) : 0;
    var basis = (_offState && _offState.fxBasis) || 'free';
    if (basis === 'sana') basis = 'free'; /* رکورد قدیمی با مبنای منسوخ — به آزاد سوییچ شود */
    var rate = (_offState && +_offState.fxRateRef) || freeRate || '';
    var hide = cur === 'IRR' ? 'display:none;' : '';
    return '<div id="ofFxWrap" class="fr" style="' + hide + '">' +
      '<div class="fld"><label>مبنای نرخ مرجع ارزی</label><select id="ofFxBasis" onchange="offerFxBasisChanged(this.value)" style="direction:ltr">' +
        '<option value="free"' + (basis === 'free' ? ' selected' : '') + '>نرخ آزاد</option>' +
        '<option value="agreed"' + (basis === 'agreed' ? ' selected' : '') + '>توافقی / سفارشی</option>' +
      '</select><small style="color:#64748b">برای سند ارزی، مرجع قیمت‌گذاری را ثبت کنید تا در فرایند مالی شفاف بماند.</small></div>' +
      '<div class="fld"><label>نرخ مرجع (' + cur + ' → ریال)</label><input type="text" inputmode="numeric" data-money="1" data-nohint="1" autocomplete="off" id="ofFxRate" value="' + (rate ? (+rate).toLocaleString('en-US') : '') + '" style="direction:ltr"><small style="color:#64748b">آزاد: ' + (freeRate ? freeRate.toLocaleString('fa-IR') : '—') + '</small></div>' +
    '</div>';
  }

  function injectCurrencyField() {
    if (!window._offState || (_offState.kind !== 'CO' && _offState.kind !== 'TC')) return;
    if (document.getElementById('ofCurrency')) return;
    var curOpts = CURRENCIES.map(function (c) {
      return '<option value="' + c.id + '"' + ((_offState.currency || 'IRR') === c.id ? ' selected' : '') + '>' + c.lb + '</option>';
    }).join('');
    var selHtml = '<label>ارز پیشنهاد (Currency) — US-182</label><select id="ofCurrency" onchange="offerCurChanged(this.value)" style="direction:ltr">' + curOpts + '</select>';
    var anchor = document.getElementById('ofValidJ');
    if (anchor) {
      var wrap = anchor.closest('.fr');
      var fld = wrap ? wrap.querySelector('.fld:last-child') : null;
      if (fld && !fld.querySelector('select')) {
        fld.innerHTML = selHtml;
        wrap.insertAdjacentHTML('afterend', fxRefRowHtml());
        return;
      }
    }
    /* TC یا ساختار متفاوت: ردیف جدید بعد از ردیفِ تاریخ سند */
    var dt = document.getElementById('ofDateJ');
    var row = dt ? dt.closest('.fr') : null;
    if (row) row.insertAdjacentHTML('afterend', '<div class="fr"><div class="fld">' + selHtml + '</div><div class="fld"></div></div>' + fxRefRowHtml());
  }
  window.offerCurChanged = function (v) {
    _offState.currency = v;
    if (v === 'IRR') {
      _offState.fxBasis = '';
      _offState.fxRateRef = 0;
    }
    var old = document.getElementById('ofFxWrap');
    if (old) old.remove();
    var anchor = document.getElementById('ofCurrency');
    var row = anchor ? anchor.closest('.fr') : null;
    if (row) row.insertAdjacentHTML('afterend', fxRefRowHtml());
    if (typeof offRenderItems === 'function') offRenderItems();
    if (typeof ptfToast === 'function') ptfToast('ارز سند: ' + v + (v !== 'IRR' ? ' — قیمت‌ها را به ' + v + ' وارد کنید (اعشار مجاز)' : ''), 'ok');
  };
  window.offerFxBasisChanged = function (v) {
    if (!_offState) return;
    _offState.fxBasis = v;
    var cur = _offState.currency || 'IRR';
    var L = (window._ptfFxLive && window._ptfFxLive.rates) || {};
    var freeRate = cur === 'USD' ? (+L.usd_free || 0) : cur === 'EUR' ? (+L.eur_free || 0) : 0;
    var rateEl = document.getElementById('ofFxRate');
    if (rateEl && v !== 'agreed') rateEl.value = (freeRate || '').toLocaleString ? (freeRate || '').toLocaleString('en-US') : '';
  };


  // hook روی offerForm تا فیلد ارز و درگ ستون‌ها همیشه فعال شوند
  var _offerForm = window.offerForm;
  if (typeof _offerForm === 'function') {
    window.offerForm = function () {
      _offerForm();
      setTimeout(function () { injectCurrencyField(); }, 50);
    };
  }
  // ذخیره ارز و مبنای نرخ مرجع هنگام offerSave
  var _offerSave = window.offerSave;
  if (typeof _offerSave === 'function') {
    window.offerSave = function () {
      try {
        var st = window._offState;
        var sel = document.getElementById('ofCurrency');
        if (sel && st) st.currency = sel.value;
        var basis = document.getElementById('ofFxBasis');
        var rate = document.getElementById('ofFxRate');
        if (st) {
          st.fxBasis = basis ? basis.value : (st.currency === 'IRR' ? '' : (st.fxBasis || 'free'));
          st.fxRateRef = rate ? ((typeof ptfNum === 'function') ? ptfNum(rate.value) : (+String(rate.value||'').replace(/[^\d.-]/g,'')||0)) : (+st.fxRateRef || 0);
          if ((st.currency || 'IRR') !== 'IRR') {
            if (!st.fxBasis) { alert('⛔ برای پیشنهاد ارزی، مبنای نرخ (آزاد/سنا/توافقی) را مشخص کنید.'); return; }
            if (!(+st.fxRateRef > 0)) { alert('⛔ برای پیشنهاد ارزی، نرخ مرجع ارز به ریال الزامی است.'); return; }
          }
        }
        return _offerSave.apply(this, arguments);
      } catch (ePro) {
        try { console.error('offerSave/offers-pro', ePro); } catch (e2) {}
        alert('⛔ خطا هنگام ذخیره پیشنهاد: ' + (ePro && ePro.message ? ePro.message : ePro));
      }
    };
  }

  /* ============ US-183: درگ سرستون‌ها + مدیریت کامل ستون‌ها ============ */
  /* ترتیب ستون‌های اصلی در فرم: colOrder آرایه‌ای از کلیدها؛ extraCols طبق قبل.
     درگ روی سرستون‌های جدول فرم (نه سند چاپی) — ترتیب در o.colOrder ذخیره و
     در چاپ هم رعایت می‌شود. */
  /* v12.8 (US-318 — مصوبه تیم): fa = برچسب فارسی فرم داخلی | lb = برچسب انگلیسی سند چاپی (فرمت رسمی کارفرما) */
  var BASE_COLS_CO = [
    { k: 'name', lb: 'Item Name', fa: 'شرح کالا' }, { k: 'desc', lb: 'Description', fa: 'مشخصات' }, { k: 'model', lb: 'Model', fa: 'مدل' },
    { k: 'qty', lb: 'Qty', fa: 'تعداد' }, { k: 'unit', lb: 'Unit', fa: 'واحد' }, { k: 'brand', lb: 'Brand', fa: 'برند' }
  ];
  var BASE_COLS_TO = [
    { k: 'name', lb: 'Item Name', fa: 'شرح کالا' }, { k: 'desc', lb: 'Description', fa: 'مشخصات' }, { k: 'model', lb: 'Model', fa: 'مدل' },
    { k: 'qty', lb: 'Qty', fa: 'تعداد' }, { k: 'unit', lb: 'Unit', fa: 'واحد' }, { k: 'brand', lb: 'Brand', fa: 'برند' }
  ];
  window.offBaseCols = function (isCO) {
    var base = isCO ? BASE_COLS_CO : BASE_COLS_TO;
    var ord = (window._offState && _offState.colOrder) || null;
    var out;
    if (!ord) {
      out = base.slice();
    } else {
      out = [];
      ord.forEach(function (k) {
        var c = base.filter(function (b) { return b.k === k; })[0];
        if (c) out.push(c);
      });
      base.forEach(function (b) { if (out.indexOf(b) < 0) out.push(b); }); // ستون‌های جدید ته صف
    }
    /* v17.0 (BUG-019 — ریشه واقعی): فیلتر ستون‌های حذف‌شده باید همیشه اعمال شود.
       قبلا اگر colOrder خالی بود (کاربر هرگز درگ نکرده) زودخروجی می‌شد و ستون ✕خورده
       هم در فرم می‌ماند هم در اعتبارسنجی الزامی حساب می‌شد — ناسازگار با چاپ (docCols). */
    var hidden = (window._offState && _offState.hiddenCols) || [];
    return out.filter(function (c) { return hidden.indexOf(c.k) < 0; });
  };
  window.offToggleBaseCol = function (k) {
    _offState.hiddenCols = _offState.hiddenCols || [];
    var i = _offState.hiddenCols.indexOf(k);
    if (i > -1) _offState.hiddenCols.splice(i, 1); else _offState.hiddenCols.push(k);
    offRenderItems2();
  };
  var _dragCol = null;
  window.offColDragStart = function (ev, key) { _dragCol = key; ev.dataTransfer.effectAllowed = 'move'; };
  window.offColDragOver = function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; };
  window.offColDrop = function (ev, targetKey) {
    ev.preventDefault();
    if (!_dragCol || _dragCol === targetKey) return;
    var isCO = _offState.kind === 'CO' || _offState.kind === 'TC'; // v122: فرم TC = مالی با قیمت
    var cols = offBaseCols(isCO).map(function (c) { return c.k; });
    // extraCols هم قابل درگ‌اند: کلیدشان با پیشوند x: است
    var all = cols.concat((_offState.extraCols || []).map(function (c) { return 'x:' + c; }));
    var from = all.indexOf(_dragCol), to = all.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    all.splice(to, 0, all.splice(from, 1)[0]);
    // بازتفکیک
    _offState.colOrder = all.filter(function (k) { return k.indexOf('x:') !== 0; });
    _offState.extraCols = all.filter(function (k) { return k.indexOf('x:') === 0; }).map(function (k) { return k.slice(2); });
    _dragCol = null;
    offRenderItems2();
  };

  /* بازنویسی رندر اقلام فرم با: درگ سرستون + ارز + مدیریت ستون‌ها */
  window.offRenderItems2 = function () {
    var el = (typeof offEl === 'function') ? offEl('offItemsWrap') : document.getElementById('offItemsWrap'); /* v14.2 US-364 */
    if (!el || !window._offState) return;
    var isCO = _offState.kind === 'CO' || _offState.kind === 'TC'; // v122: فرم TC = مالی با قیمت
    var cur = offerCurrency(_offState);
    var cols = offBaseCols(isCO);
    var ec = _offState.extraCols || [];
    var dragAttr = function (key) {
      return ' draggable="true" ondragstart="offColDragStart(event,\'' + key + '\')" ondragover="offColDragOver(event)" ondrop="offColDrop(event,\'' + key + '\')" style="cursor:grab" title="برای جابجایی بکشید"';
    };
    var head = '<tr><th>#</th>' +
      cols.map(function (c) {
        return '<th' + dragAttr(c.k) + '>⠿ ' + c.lb + ' <a href="javascript:void(0)" onclick="offToggleBaseCol(\'' + c.k + '\')" style="color:#dc2626;font-size:10px" title="حذف ستون">✕</a></th>';
      }).join('') +
      ec.map(function (c, ci) {
        return '<th' + dragAttr('x:' + c) + '>⠿ ' + escP(c) + ' <a href="javascript:void(0)" onclick="offDelColumn(' + ci + ')" style="color:#dc2626;font-size:10px">✕</a></th>';
      }).join('') +
      (isCO ? '<th>Unit Price (' + cur.sym + ')</th><th>Total</th>' : '') + '<th></th></tr>';
    var rows = '';
    _offState.items.forEach(function (it, i) {
      var inp = function (f, w, type, step) {
        return '<input type="' + (type || 'text') + '"' + (step ? ' step="' + step + '"' : '') + ' value="' + escP(it[f]) + '" oninput="offUpdItem(' + i + ',\'' + f + '\',this.value)" style="width:' + w + ';padding:5px;border:1px solid var(--brd);border-radius:6px;direction:ltr;font-size:12px">';
      };
      var tds = cols.map(function (c) {
        if (c.k === 'qty') return '<td>' + inp('qty', '54px', 'number') + '</td>';
        if (c.k === 'unit') return '<td>' + inp('unit', '50px') + '</td>';
        if (c.k === 'model' || c.k === 'brand') return '<td>' + inp(c.k, '76px') + '</td>';
        return '<td>' + inp(c.k, '100%') + '</td>';
      }).join('');
      var ecCells = ec.map(function (c) {
        var v = (it.extra || {})[c] || '';
        return '<td><input type="text" value="' + escP(v) + '" oninput="offUpdExtra(' + i + ',\'' + ptfOnClickArg(c) + '\',this.value)" style="width:76px;padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px"></td>';
      }).join('');
      rows += '<tr><td>' + (i + 1) + '</td>' + tds + ecCells +
        (isCO
          ? '<td>' + inp('price', '92px', 'number', cur.id === 'IRR' ? '1' : '0.01') + '</td><td id="offRT' + i + '" style="white-space:nowrap;font-size:12px">' + offerFmtMoney((+it.qty || 0) * (+it.price || 0), cur) + '</td>' /* v17.0 US-409 */
          : '') +
        '<td><button type="button" onclick="offDelItem(' + i + ')" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td></tr>';
    });
    var totalRow = '';
    if (isCO) {
      var total = _offState.items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
      totalRow = '<tr style="font-weight:bold;background:#fff8f5"><td colspan="' + (2 + cols.length + ec.length) + '" style="text-align:left">GRAND TOTAL (' + cur.id + ')</td><td id="offGT" style="white-space:nowrap">' + offerFmtMoney(total, cur) + '</td><td></td></tr>';
    }
    var hidden = _offState.hiddenCols || [];
    var restoreBar = hidden.length
      ? '<div style="font-size:11px;color:#7c3aed;margin:4px 0">ستون‌های حذف‌شده: ' + hidden.map(function (k) {
          return '<a href="javascript:void(0)" onclick="offToggleBaseCol(\'' + k + '\')" style="color:#7c3aed;margin:0 3px">[+ ' + k + ']</a>';
        }).join('') + '</div>'
      : '';
    el.innerHTML = restoreBar + '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead style="background:#f1f5f9">' + head + '</thead><tbody>' + rows + totalRow + '</tbody></table>' +
      (_offState.items.length ? '' : '<div style="color:#94a3b8;text-align:center;padding:14px;font-size:12px">ردیفی ثبت نشده</div>');
  };
  // جایگزینی رندر اصلی
  window.offRenderItems = window.offRenderItems2;

  /* ============ US-185: قالب‌های PDF حرفه‌ای ============ */
  /* سه قالب: classic (فعلی بهبود یافته)، letterhead (روی سربرگ رسمی با نوار
     گرادیان و خطوط مورب — پرتره)، minimal (مدرن مینیمال). */
  window.PTF_OFFER_TEMPLATES = [
    { id: 'letterhead', lb: '🏢 سربرگ رسمی شرکت', desc: 'A4 افقی — نوار گرادیان نارنجی + خطوط مورب سفید، هم‌خانواده سربرگ مکاتبات' },
    { id: 'executive', lb: '🖤 اجرایی (Executive)', desc: 'A4 افقی — نوار جانبی زغالی + اکسنت نارنجی برند، مدرن و پخته — پیشنهاد تیم برندینگ' },
    { id: 'mono', lb: '⚫ مونوکروم الگانت', desc: 'A4 افقی — تک‌رنگ، تایپوگرافی سریف، خطوط دوتایی — عالی برای چاپ سیاه‌وسفید' },
    { id: 'minimal', lb: '⬜ مینیمال بین‌المللی', desc: 'A4 افقی — مشکی/طلایی، فضای سفید زیاد، سبک شرکت‌های اروپایی' },
    { id: 'classic', lb: '📊 کلاسیک', desc: 'A4 افقی — جدول عریض، مناسب اقلام زیاد یا ستون‌های اضافی' }
  ];

  // انتخاب قالب: دیالوگ با پیش‌نمایش
  window.offerPickTemplate = function (no) {
    var o = typeof no === 'string' ? getData('ptf_crm_offers').filter(function (x) { return x.no === no; })[0] : no;
    if (!o) return;
    // v85.1: سند ذخیره‌نشده (پیش‌نمایش داخل فرم) → برای offerTplGo نگه دار
    if (typeof no !== 'string') window._offPreviewObj = o;
    var saved = localStorage.getItem('ptf_offer_tpl') || 'letterhead';
    var cards = PTF_OFFER_TEMPLATES.map(function (t) {
      return '<label style="display:block;border:2px solid ' + (saved === t.id ? 'var(--pri)' : 'var(--brd)') + ';border-radius:12px;padding:10px 12px;margin-bottom:8px;cursor:pointer" onclick="this.parentElement.querySelectorAll(\'label\').forEach(l=>l.style.borderColor=\'var(--brd)\');this.style.borderColor=\'var(--pri)\'">' +
        '<input type="radio" name="offTpl" value="' + t.id + '"' + (saved === t.id ? ' checked' : '') + ' style="margin-left:6px">' +
        '<b style="font-size:13px">' + t.lb + '</b><div style="font-size:11.5px;color:#64748b;margin-top:3px;margin-right:22px">' + t.desc + '</div></label>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px">' +
      '<h3>🖨 انتخاب قالب سند ' + escP(o.no) + '</h3>' + cards +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt bt-o" onclick="offerTplGo(\'' + ptfOnClickArg(o.no) + '\', true)">👁 پیش‌نمایش</button>' +
      '<button class="bt bt-o" style="color:#059669;border-color:#86efac" onclick="offerTplGo(\'' + ptfOnClickArg(o.no) + '\', \'share\')">📤 پیام‌رسان</button>' +
      '<button class="bt" onclick="offerTplGo(\'' + ptfOnClickArg(o.no) + '\', false)">🖨 دریافت PDF</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.offerTplGo = function (no, isPreview) {
    var sel = document.querySelector('input[name="offTpl"]:checked');
    var tpl = sel ? sel.value : 'letterhead';
    localStorage.setItem('ptf_offer_tpl', tpl);
    var o = getData('ptf_crm_offers').filter(function (x) { return x.no === no; })[0] || window._offPreviewObj;
    if (!o) return;
    var share = isPreview === 'share';
    offerPrintTpl(o, tpl, share ? false : !!isPreview, share ? 'share' : '');
  };

  /* رشته‌های مشترک سند */
  function docCols(o) {
    var isCO = o.kind === 'CO' || o.kind === 'TC';
    var base = (isCO ? BASE_COLS_CO : BASE_COLS_TO).slice();
    if (o.colOrder) {
      var out = [];
      o.colOrder.forEach(function (k) { var c = base.filter(function (b) { return b.k === k; })[0]; if (c) out.push(c); });
      base.forEach(function (b) { if (out.indexOf(b) < 0) out.push(b); });
      base = out;
    }
    var hidden = o.hiddenCols || [];
    return base.filter(function (c) { return hidden.indexOf(c.k) < 0; });
  }

  /* v14.2 (US-356): عرض ستون آداپتیو از روی محتوای واقعی + colgroup — Description پهن، ستون کم‌محتوا باریک */
  function docColgroup(o, cols, ec, isCO) {
    var L = function (v) { return String(v == null ? '' : v).length; };
    var items = o.items || [];
    var stats = [];
    cols.forEach(function (c) {
      var mx = Math.max(6, Math.min(L(c.lb), 14));
      items.forEach(function (it) { var l = L(it[c.k]); if (l > mx) mx = l; });
      /* desc چندبخشی (;) — طول موثر = بلندترین بخش */
      if (c.k === 'desc') {
        mx = Math.max(6, Math.min(L(c.lb), 14));
        items.forEach(function (it) {
          String(it.desc == null ? '' : it.desc).split(';').forEach(function (seg) { var l = L(seg.trim()); if (l > mx) mx = l; });
        });
      }
      stats.push({ k: c.k, w: Math.sqrt(Math.min(Math.max(mx, 4), 70)) });
    });
    ec.forEach(function (c) {
      var mx = Math.max(4, L(c));
      items.forEach(function (it) { var l = L((it.extra || {})[c]); if (l > mx) mx = l; });
      stats.push({ k: 'x:' + c, w: Math.sqrt(Math.min(Math.max(mx, 4), 70)) });
    });
    var fixedNo = 4, fixedPrice = isCO ? 11 : 0, fixedTotal = isCO ? 12 : 0;
    var avail = 100 - fixedNo - fixedPrice - fixedTotal;
    var sum = stats.reduce(function (a, b) { return a + b.w; }, 0) || 1;
    var pcts = stats.map(function (st) { return Math.max(5, Math.round(st.w / sum * avail * 10) / 10); });
    /* نرمال‌سازی نهایی که جمع =avail بماند */
    var tot = pcts.reduce(function (a, b) { return a + b; }, 0);
    var k = avail / tot;
    pcts = pcts.map(function (p) { return Math.round(p * k * 10) / 10; });
    var cg = '<colgroup><col style="width:' + fixedNo + '%">' +
      pcts.map(function (p) { return '<col style="width:' + p + '%">'; }).join('') +
      (isCO ? '<col style="width:' + fixedPrice + '%"><col style="width:' + fixedTotal + '%">' : '') + '</colgroup>';
    return cg;
  }
  /* v14.2 (US-356): پله نرم فونت بر اساس تراکم محتوا (کف ۷pt) */
  window.ptfDocFsAdjust = function (o, fs) {
    var items = o.items || [];
    if (!items.length) return fs;
    var tot = 0;
    items.forEach(function (it) {
      tot += String(it.name || '').length + String(it.desc || '').length + String(it.model || '').length + String(it.brand || '').length;
    });
    var avg = tot / items.length;
    if (avg > 260) fs -= 1.0; else if (avg > 180) fs -= 0.6;
    return Math.max(7, fs);
  };

  function docTableHtml(o, opts) {
    var isCO = o.kind === 'CO' || o.kind === 'TC';
    var cur = offerCurrency(o);
    var cols = docCols(o);
    var ec = o.extraCols || [];
    /* v17.0 (BUG-019 AC2 — دستور کارفرما): ستون سراسر-خالی حتی بدون حذف دستی در چاپ نیاید.
       ستون‌های هویتی (شرح/تعداد) همیشه می‌مانند؛ بقیه اگر هیچ ردیفی مقدار ندارد حذف می‌شوند. */
    var ALWAYS = ['name', 'qty'];
    function colHasData(k) {
      return (o.items || []).some(function (it) { return String(it[k] == null ? '' : it[k]).trim() !== ''; });
    }
    cols = cols.filter(function (c) { return ALWAYS.indexOf(c.k) > -1 || colHasData(c.k); });
    ec = ec.filter(function (c) {
      return (o.items || []).some(function (it) { return String(((it.extra || {})[c]) == null ? '' : (it.extra || {})[c]).trim() !== ''; });
    });
    // US-183: Sr. no → No. (شماره ردیف انگلیسی)
    var thead = '<tr><th style="width:4%">No.</th>' +
      cols.map(function (c) { return '<th>' + c.lb + '</th>'; }).join('') +
      ec.map(function (c) { return '<th>' + escP(c) + '</th>'; }).join('') +
      (isCO ? '<th style="width:12%">Unit Price (' + cur.sym + ')</th><th style="width:13%">Total (' + cur.sym + ')</th>' : '') + '</tr>';
    var tbody = '';
    o.items.forEach(function (it, i) {
      var tds = cols.map(function (c) {
        var v = it[c.k];
        if (c.k === 'unit') v = (typeof ptfOfferUnitEn === 'function') ? ptfOfferUnitEn(v) : (v || 'NO');
        if (c.k === 'name') return '<td class="lft"><b>' + escP(v || it.desc || '') + '</b></td>';
        if (c.k === 'desc') return '<td class="lft dsc">' + escP(v || '').replace(/;\s*/g, '<br>') + '</td>';
        return '<td>' + escP(v || (c.k === 'qty' ? '0' : '—')) + '</td>';
      }).join('');
      var ecTd = ec.map(function (c) { return '<td>' + escP((it.extra || {})[c] || '—') + '</td>'; }).join('');
      tbody += '<tr><td>' + (i + 1) + '</td>' + tds + ecTd +
        (isCO ? '<td class="num">' + offerFmtMoney(+it.price, cur) + '</td><td class="num">' + offerFmtMoney((+it.qty || 0) * (+it.price || 0), cur) + '</td>' : '') + '</tr>';
    });
    if (isCO) {
      var total = o.items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
      var words = cur.id === 'IRR' ? numToWords(Math.round(total)) + ' ' + cur.words : numToWords(Math.floor(total)) + ' ' + cur.words;
      tbody += '<tr class="total"><td colspan="' + (1 + cols.length + ec.length) + '" class="lft"><b>Grand Total</b> <span class="words">' + words + '</span></td>' +
        '<td colspan="2" class="num big">' + offerFmtMoney(total, cur) + ' ' + cur.id + '</td></tr>';
    }
    return '<table' + (opts && opts.cls ? ' class="' + opts.cls + '"' : '') + ' style="table-layout:fixed">' + docColgroup(o, cols, ec, isCO) + '<thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>'; /* v14.2 US-356 */
  }

  function docSigHtml(o) {
    var sigImgs = '';
    if (o.kind === 'CO' || o.useSig) {
      try {
        var userKey = o.signAs || o.issuedBy || (typeof curSession === 'function' ? curSession().user : 'admin'); /* v13.1 US-321: امضای نیابتی رییس */
        var sp = typeof window.ptfSigProfileFor === 'function' ? (window.ptfSigProfileFor(userKey) || {}) : ((getData('ptf_crm_sigprofiles') || {})[userKey] || {});
        if (o.kind === 'CO' && o.useSig === false) sp = {};
        if (o.useSig || o.kind === 'CO') {
          var stampUrl = sp.stamp || '../assets/images/ptf-logo.png';
          var fantasySigUrl = typeof window.ptfGetFantasySignature === 'function' ? window.ptfGetFantasySignature(userKey) : sp.sig;
          sigImgs = '<div style="position:relative;width:148px;height:54px;margin:0 auto">' +
            '<img src="' + stampUrl + '" style="position:absolute;top:4px;left:26px;max-height:44px;opacity:.82;mix-blend-mode:multiply">' +
            '<img src="' + fantasySigUrl + '" style="position:absolute;top:0;left:6px;max-height:46px;z-index:10;transform:scale(1.08)">' +
            '</div>';
        }
      } catch (e) {}
    }
    return '<div class="sig"><div class="sbox">' +
      (sigImgs ? '<div class="simgs">' + sigImgs + '</div>' : '') +
      '<div class="sline">Authorized Signature &amp; Stamp<br>' + SELLER_INFO.company + '</div></div></div>';
  }

  function docTermsHtml(o) {
    var arr = (o.terms || []).slice();
    if (typeof ptfAdvanceLabel === 'function' && o.advance && o.advance.mode && o.advance.mode !== 'none') {
      arr.unshift('Payment / Advance Payment: ' + ptfAdvanceLabel(o, { en: true }));
    }
    return arr.length
      ? '<div class="terms"><b>Terms &amp; Conditions</b><ol>' + arr.map(function (t) { return '<li>' + escP(t) + '</li>'; }).join('') + '</ol></div>' : '';
  }
  function docTailHtml(o) {
    return '<div class="tail">' + docTermsHtml(o) + docSigHtml(o) + '</div>';
  }

  /* نوار سربرگ رسمی (US-184: با خطوط مورب سفید مطابق سربرگ تاییدشده) */
  function lhBars() {
    return '.bar-top{position:fixed;top:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#e87200 0%,#ee8100 35%,#ecb003 70%,#ecc506 100%)}' +
      '.bar-top .s{position:fixed;top:-1mm;height:9mm;width:1.4mm;background:#fff;transform:skewX(-35deg)}' +
      '.bar-top .s1{left:34.2%}.bar-top .s2{left:35.8%}.bar-top .s3{left:37.4%}' +
      '.bar-bot{position:fixed;bottom:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#ecc506 0%,#ecb003 30%,#ee8100 65%,#e87200 100%)}' +
      '.bar-bot .s{position:fixed;bottom:-1mm;top:auto;height:9mm;width:1.4mm;background:#fff;transform:skewX(-35deg)}' +
      '.bar-bot .s1{right:34.2%}.bar-bot .s2{right:35.8%}.bar-bot .s3{right:37.4%}';
  }
  function lhBarsHtml() {
    return '<div class="bar-top"><i class="s s1"></i><i class="s s2"></i><i class="s s3"></i></div>' +
      '<div class="bar-bot"><i class="s s1"></i><i class="s s2"></i><i class="s s3"></i></div>';
  }

  /* ---------- چاپ با قالب انتخابی ---------- */
  // نوار راهنمای چاپ — فقط روی صفحه، در چاپ مخفی (v84.1)
  function printHint() {
    return '<div class="prnhint" style="position:sticky;top:0;background:#0c4a6e;color:#fff;font-family:Tahoma;font-size:12px;padding:8px 14px;text-align:center;direction:rtl;z-index:999">' +
      '⚙️ برای خروجی دقیق در پنجره چاپ: <b>Margins = None</b> و <b>Headers and footers = خاموش</b> باشد (شماره صفحه مرورگر حذف می‌شود)</div>' +
      '<style>@media print{.prnhint{display:none}}</style>';
  }
  
  
  window.ptfOpenPreviewNewTab = function () {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var html = fr.srcdoc || (fr.contentWindow ? fr.contentWindow.document.documentElement.outerHTML : '');
    if (!html) return;
    var w = window.open('', '_blank');
    if (!w) {
      alert('⚠️ مرورگر شما باز شدن تب جدید (Popup) را مسدود کرده است. لطفاً Popup Blocker مرورگر را برای این سایت غیرفعال کنید یا از «⬇️ دانلود HTML» استفاده کنید.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (typeof ptfToast === 'function') ptfToast('🗗 سند در تب جدید مرورگر باز شد', 'ok');
  };

  
  window.ptfAdjustPreviewLayout = function (mode, val) {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var doc = fr.contentDocument || (fr.contentWindow ? fr.contentWindow.document : null);
    if (!doc) return;
    var st = doc.getElementById('ptfLayoutAdjustStyle');
    if (!st) {
      st = doc.createElement('style');
      st.id = 'ptfLayoutAdjustStyle';
      doc.head.appendChild(st);
    }
    window._ptfLayoutState = window._ptfLayoutState || { fsDiff: 0, pad: 'normal', margin: '10mm', sigMode: 'side' };
    if (mode === 'fs') window._ptfLayoutState.fsDiff += (val || 0);
    if (mode === 'pad') window._ptfLayoutState.pad = val;
    if (mode === 'margin') window._ptfLayoutState.margin = val;
    if (mode === 'sig') window._ptfLayoutState.sigMode = val;

    var css = '@page { margin: ' + window._ptfLayoutState.margin + ' !important; } ';
    if (window._ptfLayoutState.fsDiff !== 0) {
      css += 'table, .terms { font-size: calc(100% + ' + window._ptfLayoutState.fsDiff + 'px) !important; } ';
    }
    if (window._ptfLayoutState.pad === 'compact') {
      css += 'td, th { padding: 2px 4px !important; } .terms li { margin-bottom: 0 !important; } .sig .line { margin-top: 20px !important; } ';
    } else if (window._ptfLayoutState.pad === 'spacious') {
      css += 'td, th { padding: 7px 8px !important; } ';
    }
    if (window._ptfLayoutState.sigMode === 'side') {
      css += '.tail { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; flex-wrap: wrap !important; } .terms { flex: 1 !important; min-width: 300px !important; } .sig { flex: 0 0 220px !important; margin-top: 0 !important; } ';
    } else if (window._ptfLayoutState.sigMode === 'stack') {
      css += '.tail { display: block !important; } .terms { width: 100% !important; } .sig { width: 100% !important; margin-top: 10px !important; justify-content: flex-end !important; } ';
    } else if (window._ptfLayoutState.sigMode === 'page1') {
      css += '.sig { position: absolute !important; bottom: 25mm !important; right: 15mm !important; page-break-before: avoid !important; } ';
    } else if (window._ptfLayoutState.sigMode === 'break') {
      css += '.tail { page-break-before: always !important; display: flex !important; justify-content: space-between !important; } ';
    }
    st.innerHTML = css;
    if (typeof ptfToast === 'function') ptfToast('⚡ چیدمان صفحه به‌روزرسانی شد', 'info');
  };

  window.ptfToggleLayoutBar = function () {
    var bar = document.getElementById('ptfLayoutBarWrap');
    if (bar) bar.style.display = (bar.style.display === 'none') ? 'flex' : 'none';
  };

  window.ptfDownloadPreviewHtml = function (fileName) {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var html = fr.srcdoc || (fr.contentWindow ? fr.contentWindow.document.documentElement.outerHTML : '');
    if (!html) return;
    var clean = String(html).replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '');
    var blob = new Blob([clean], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (typeof ptfPdfFileName === 'function' ? ptfPdfFileName(fileName) : (fileName || 'document')) + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 1500);
    if (typeof ptfToast === 'function') ptfToast('⬇️ فایل HTML قابل چاپ دانلود شد', 'ok');
  };

  window.ptfShareHtmlToMessenger = function (html, fileName) {
    if (!html) { if (typeof ptfToast === 'function') ptfToast('سند آماده نیست', 'warn'); return false; }
    var clean = String(html).replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '');
    var name = typeof ptfPdfFileName === 'function' ? ptfPdfFileName(fileName) : (fileName || 'document');
    var fname = name + '.html';
    var blob = new Blob([clean], { type: 'text/html;charset=utf-8' });
    try {
      var file = new File([blob], fname, { type: 'text/html' });
      var payload = { files: [file], title: name, text: 'سند ' + name };
      if (navigator.share && (typeof navigator.canShare !== 'function' || navigator.canShare(payload))) {
        navigator.share(payload).then(function () {
          if (typeof ptfToast === 'function') ptfToast('سند به برنامهٔ پیام‌رسان داده شد — مخاطب را انتخاب کنید', 'ok');
        }).catch(function (err) {
          if (err && (err.name === 'AbortError' || /abort|cancel/i.test(String(err.message || '')))) return;
          if (typeof ptfToast === 'function') ptfToast('ارسال مستقیم پشتیبانی نشد. از موبایل Chrome/Safari استفاده کنید.', 'warn');
        });
        return true;
      }
    } catch (eShare) {}
    if (typeof ptfToast === 'function') ptfToast('این دستگاه/مرورگر اشتراک فایل با پیام‌رسان را ندارد. روی گوشی از دکمهٔ چاپ → پیام‌رسان استفاده کنید.', 'warn');
    return false;
  };
  window.ptfSharePreviewToMessenger = function () {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var html = fr.srcdoc || (fr.contentWindow ? fr.contentWindow.document.documentElement.outerHTML : '');
    var name = typeof ptfPdfFileName === 'function' ? ptfPdfFileName(window._ptfPrintFileName) : (window._ptfPrintFileName || 'document');
    window.ptfShareHtmlToMessenger(html, name);
  };

  window.ptfDownloadPreviewWord = function (fileName) {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var html = fr.srcdoc || (fr.contentWindow ? fr.contentWindow.document.documentElement.outerHTML : '');
    if (!html) return;
    var clean = String(html).replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '');
    var safeName = typeof ptfPdfFileName === 'function' ? ptfPdfFileName(fileName) : (fileName || 'document');
    var wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + escP(safeName) + '</title><style>@page { size: A4 landscape; margin: 12mm; }</style></head><body>' + clean + '</body></html>';
    var blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safeName + '.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 1500);
    if (typeof ptfToast === 'function') ptfToast('⬇️ فایل Word (.doc) دانلود شد', 'ok');
  };

  window.ptfPrintPreviewGo = function () {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr || !fr.contentWindow) return;
    ptfDialog({
      title: '💡 راهنمای دریافت خروجی PDF و چاپ رسمی',
      body: 'برای ذخیره فایل به صورت **PDF رسمی**، پس از فشردن دکمه زیر:<br><br>' +
        '۱. در پنجره چاپگر سیستم (Print)، قسمت **مقصد (Destination / Printer)** را روی گزینه **«Save as PDF»** (یا Microsoft Print to PDF) قرار دهید.<br>' +
        '۲. در تنظیمات صفحات، **Paper size** را روی **A4** و جهت صفحه (Orientation) را روی **Landscape (افقی)** تنظیم کنید.<br>' +
        '۳. دکمه **Save / ذخیره** را بزنید تا فایل PDF با حاشیه‌ها و فونت مصوب روی دستگاه شما ذخیره شود.<br><br>' +
        '<small style="color:#0e7490">همچنین در صورت نیاز به ویرایش یا اشتراک‌گذاری سریع، می‌توانید از دکمه‌های «⬇️ دانلود HTML» و «⬇️ دانلود Word» در بالای پنجره استفاده کنید.</small>',
      okText: '🖨️ باز کردن پنجره چاپ / ذخیره PDF',
      onOk: function () {
        var pdfTitle = typeof ptfPdfFileName === 'function' ? ptfPdfFileName(window._ptfPrintFileName) : (window._ptfPrintFileName || 'document');
        var previousPageTitle = document.title;
        var restorePageTitle = function () { try { document.title = previousPageTitle; } catch (eRestore) {} };
        try { document.title = pdfTitle; } catch (eTopTitle) {}
        setTimeout(restorePageTitle, 4000);
        try {
          var printDoc = fr.contentDocument || (fr.contentWindow ? fr.contentWindow.document : null);
          if (printDoc) printDoc.title = pdfTitle;
          try { fr.contentWindow.addEventListener('afterprint', restorePageTitle, { once: true }); } catch (eAfter) {}
          fr.contentWindow.focus(); fr.contentWindow.print();
        } catch (e) {
          try {
            var w = window.open('', '_blank');
            w.document.write(typeof ptfPdfHtmlWithTitle === 'function' ? ptfPdfHtmlWithTitle(fr.srcdoc, pdfTitle) : fr.srcdoc);
            w.document.close(); setTimeout(function(){ w.focus(); w.print(); }, 500);
          } catch (e2) { restorePageTitle(); }
        }
      }
    });
  };

  window.ptfPrintPreviewClose = function () {
    var modal = document.getElementById('ptfPrintPreview');
    if (modal) modal.remove();
  };

  window.ptfPreviewPrintableDoc = function (title, html, fileName) {
    var old = document.getElementById('ptfPrintPreview');
    if (old) old.remove();
    var safeTitle = escP(title || 'Preview');
    var printFileName = typeof ptfPdfFileName === 'function' ? ptfPdfFileName(fileName || title || 'document') : (fileName || title || 'document');
    window._ptfPrintFileName = printFileName;
    var modal = document.createElement('div');
    modal.id = 'ptfPrintPreview';
    modal.className = 'md-b';
    modal.style.display = 'grid';
    modal.style.zIndex = (typeof window.ptfTopZIndex === 'function' ? window.ptfTopZIndex(2800) : 2800);
    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
    /* MOB-042: پیش‌نمایش چاپ overlay اختصاصی است؛ toolbar باید actionهای واضح و
       keyboard-friendly داشته باشد، نه ردیف buttonهای بلند/ناهم‌اندازه. */
    function previewAction(kind, icon, label, title, onClick, primary) {
      return '<button type="button" class="bt' + (primary ? '' : ' bt-o') + ' ptf-print-action ptf-print-' + kind + '" data-print-action="' + kind + '" title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '"><span class="ptf-print-action-icon" aria-hidden="true">' + icon + '</span><span class="ptf-print-action-label">' + label + '</span></button>';
    }
    modal.innerHTML = '<div class="md ptf-print-preview-modal" style="max-width:min(1200px,96vw);width:96vw;max-height:94vh;overflow:auto">' +
      '<div class="ptf-print-preview-head">' +
      '<div><h3 id="ptfPrintPreviewTitle">👁 ' + safeTitle + '</h3><small style="display:block;color:#64748b;margin-top:3px">نام پیش‌فرض PDF: <b dir="ltr">' + escP(printFileName) + '.pdf</b></small></div>' +
      '<div class="ptf-print-actions" role="group" aria-label="عملیات پیش‌نمایش چاپ">' +
      previewAction('print', '🖨', 'چاپ / PDF', 'باز کردن چاپ یا ذخیره PDF', 'ptfPrintPreviewGo()', true) +
      previewAction('share', '📤', 'پیام‌رسان', 'ارسال سند به واتساپ/تلگرام/بله بدون ذخیره روی گوشی', 'ptfSharePreviewToMessenger()', false) +
      previewAction('layout', '🎛', 'چیدمان', 'تنظیم چیدمان و گنجایش صفحه', 'ptfToggleLayoutBar()', false) +
      previewAction('html', '⬇', 'HTML', 'دانلود HTML سند', 'ptfDownloadPreviewHtml(\'' + ptfOnClickArg(printFileName) + '\')', false) +
      previewAction('word', '⬇', 'Word', 'دانلود Word سند', 'ptfDownloadPreviewWord(\'' + ptfOnClickArg(printFileName) + '\')', false) +
      previewAction('newtab', '↗', 'تب جدید', 'باز کردن پیش‌نمایش در تب جدید', 'ptfOpenPreviewNewTab()', false) +
      previewAction('close', '×', 'بستن', 'بستن پیش‌نمایش چاپ', 'ptfPrintPreviewClose()', false) +
      '</div></div>' +
      '<div id="ptfLayoutBarWrap" class="ptf-print-layout-bar" style="display:none;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;margin-bottom:10px;gap:12px;align-items:center;flex-wrap:wrap;font-size:11.5px">' +
      '<span><b>🔤 فونت جدول:</b> <button class="bt bt-o" style="padding:2px 6px" onclick="ptfAdjustPreviewLayout(\'fs\',-1)">➖ کوچکتر</button> <button class="bt bt-o" style="padding:2px 6px" onclick="ptfAdjustPreviewLayout(\'fs\',1)">➕ بزرگتر</button></span>' +
      '<span><b>↕️ تراکم سطرها:</b> <button class="bt bt-o" style="padding:2px 7px" onclick="ptfAdjustPreviewLayout(\'pad\',\'compact\')">کم‌حجم (فشرده)</button> <button class="bt bt-o" style="padding:2px 7px" onclick="ptfAdjustPreviewLayout(\'pad\',\'normal\')">استاندارد</button></span>' +
      '<span><b>↔️ حاشیه صفحه:</b> <button class="bt bt-o" style="padding:2px 7px" onclick="ptfAdjustPreviewLayout(\'margin\',\'6mm\')">باریک (6mm)</button> <button class="bt bt-o" style="padding:2px 7px" onclick="ptfAdjustPreviewLayout(\'margin\',\'10mm\')">استاندارد</button> <button class="bt bt-o" style="padding:2px 7px" onclick="ptfAdjustPreviewLayout(\'margin\',\'14mm\')">جادار</button></span>' +
      '<span><b>💳 چیدمان مهر و امضا:</b> <select onchange="ptfAdjustPreviewLayout(\'sig\',this.value)" style="font-size:11px;padding:2px 6px;border-radius:6px"><option value="side">↔️ افقی کنار شرایط (Side-by-Side — بیشترین صرفه‌جویی فضا)</option><option value="stack">↕️ عمودی زیر شرایط (کلاسیک)</option><option value="page1">⚓ چسبیده به انتهای صفحه اول</option><option value="break">📄 انتقال به صفحه جدید</option></select></span>' +
      '</div>' +
      /* v34.0.3-alpha: حذف sandbox از iframe پیش‌نمایش چاپ — ترکیب allow-same-origin + allow-scripts
         هشدار امنیتی کروم «can escape its sandboxing» می‌دهد (و عملاً ایزولاسیونی ندارد).
         محتوای این iframe سند چاپیِ تولیدشدهٔ داخلی (escP شده) است؛ و توابع
         ptfAdjustPreviewLayout / ptfPrintPreviewGo به دسترسی same-origin
         (contentDocument / contentWindow.print) نیاز دارند. */
      '<iframe id="ptfPrintFrame" style="width:100%;height:78vh;border:1px solid var(--brd);border-radius:12px;background:#fff"></iframe></div>';
    document.body.appendChild(modal);
    var fr = document.getElementById('ptfPrintFrame');
    if (fr) {
      window._ptfLayoutState = null;
      var _cleanHtml = String(html || '').replace(/<script[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '').replace(/<\/iframe>/gi, '<\\/iframe>');
      fr.srcdoc = typeof ptfPdfHtmlWithTitle === 'function' ? ptfPdfHtmlWithTitle(_cleanHtml, printFileName) : _cleanHtml;
      fr.setAttribute('data-pdf-file-name', printFileName);
    }
  };

  window.offerPrintTpl = function (o, tpl, isPreview, dest) {
    var isCO = o.kind === 'CO' || o.kind === 'TC';
    var cur = offerCurrency(o);
    var _pAs = (o.kind !== 'TO') ? (o.printAs || (o.kind === 'TC' ? 'TC' : 'CO')) : ''; /* v20.1 US-442: قالب چاپ ملاک عنوان */
    var title = _pAs === 'TC' ? 'TECHNO-COMMERCIAL OFFER' : (o.kind === 'TO' ? 'TECHNICAL OFFER' : 'COMMERCIAL OFFER');
    var nCols = docCols(o).length + (o.extraCols || []).length + (isCO ? 2 : 0);
    var fs = nCols <= 7 ? 9 : nCols <= 9 ? 8.3 : 7.6; // pt
    fs = ptfDocFsAdjust(o, fs); /* v14.2 US-356: تعدیل بر اساس تراکم محتوا */
    var rowsPerPage = tpl === 'classic' ? (isCO ? 8 : 5) : (isCO ? 12 : 9);
    var pageCount = Math.max(1, Math.ceil((o.items || []).length / rowsPerPage));
    var docPrefix = o.kind === 'TO' ? 'TO' : (_pAs === 'TC' ? 'TC' : 'CO'); /* v20.1 US-442 */
    var meta = '<div class="dno">' + docPrefix + ' No.: <span class="acc">' + escP(o.no) + '</span>' + (o.rev ? ' <small>(Rev.' + String(o.rev).padStart(2, '0') + ')</small>' : '') + '</div>' +
      '<b>Date:</b> ' + escP(o.dateEn || new Date().toISOString().slice(0, 10)) + '<br><b>Ref (Inquiry):</b> ' + escP((typeof ptfInqClientNo === 'function' ? ptfInqClientNo(o.inqNo) : o.inqNo) || '—') +
      (isCO && o.validUntil ? '<br><b>Valid Until:</b> ' + escP(o.validUntil) : '') +
      (isCO ? '<br><b>Currency:</b> ' + cur.id : '') +
      '<br><span class="pgc">Page 1 of ' + pageCount + '</span>';
    var parties = '<div class="parties">' +
      '<div class="party"><div class="pt">From (Vendor)</div><b>' + SELLER_INFO.company + '</b><br>National ID: ' + SELLER_INFO.nationalId + '<br>Contact: ' + escP(o.sellerContact || SELLER_INFO.contact) + '<br>Tel: ' + SELLER_INFO.tel + '</div>' +
      '<div class="party"><div class="pt">To (Client)</div><b>' + escP(o.buyerCo || '—') + '</b><br>Attention: ' + escP(o.buyerContact || '—') + '<br>Request No: ' + escP((typeof ptfInqClientNo === 'function' ? ptfInqClientNo(o.inqNo) : o.inqNo) || '—') + '<br>Tel: ' + escP((o.buyerTel && typeof ptfPhoneNorm === 'function') ? (ptfPhoneNorm(o.buyerTel, 'print') || o.buyerTel) : (o.buyerTel || '—')) + '</div></div>'; /* v14.2 US-357: تلفن سند EN همیشه لاتین +98 */
    var wm = isPreview ? 'body:after{content:"PREVIEW";position:fixed;top:44%;left:0;right:0;text-align:center;font-size:46pt;color:rgba(220,40,40,.10);transform:rotate(-16deg);font-weight:900;letter-spacing:8px;z-index:99}' : '';
    var common =
      '*{box-sizing:border-box;margin:0;padding:0}' +
      'table{width:100%;border-collapse:collapse;font-size:' + fs + 'pt;page-break-inside:auto}' +
      'tr{page-break-inside:avoid}thead{display:table-header-group}' +
      'td.lft{text-align:left}td.num{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      'td.dsc{font-size:' + (fs - 0.7) + 'pt;line-height:1.55}' +
      'td,th{word-wrap:break-word;overflow-wrap:break-word}' +
      '.tail{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:4mm;page-break-inside:auto;break-inside:auto}' +
      '.terms{flex:1;min-width:320px;font-size:' + fs + 'pt;page-break-inside:auto}' +
      '.terms b{display:block;page-break-after:avoid}' +
      '.terms ol{margin:2mm 0 0 6mm}.terms li{margin-bottom:.8mm;line-height:1.55;page-break-inside:avoid}' +
      '.sig{flex:0 0 220px;margin-top:0;display:flex;justify-content:flex-end;page-break-inside:avoid}' +
      '.sbox{min-width:52mm;text-align:center;font-size:8.5pt;color:#555}' +
      '.simgs{display:flex;justify-content:center;align-items:flex-end;min-height:10mm}' +
      '.sline{border-top:.4pt solid #999;margin-top:1.5mm;padding-top:1.5mm}' +
      '.parties{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin:4mm 0}' +
      '.party{font-size:' + fs + 'pt;line-height:1.9}' +
      '.dno{font-size:10pt;font-weight:700;margin-bottom:1mm}' +
      '.pgc{color:#888;font-size:8pt}' +
      wm;
    var css = '', body = '';

    if (tpl === 'letterhead') {
      /* v84.1: مثل سربرگ رسمی — margin صفحه صفر تا نوارها دقیقاً سرتاسر لبه‌ها باشند؛
         فاصله محتوا با padding بدنه (شروع زیر نوار، بدون همپوشانی لوگو) */
      css = '@page{size:A4 landscape;margin:0}' + common + lhBars() +
        'body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#26282c;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:13mm 14mm 26mm}' +
        '.dno{font-size:10pt;font-weight:700;margin-bottom:1mm}' +
        '.pgc{color:#888;font-size:8pt}' +
        '.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:4mm}' +
        '.hd img{height:19mm}' +
        '.hd .ttl{text-align:center}.hd .ttl .co{font-size:14pt;font-weight:700;color:#e87200;font-family:Georgia,serif}' +
        '.hd .ttl .t{font-size:10pt;color:#b45309;letter-spacing:2.5px;font-weight:600;margin-top:1.5mm}' +
        '.hd .meta{font-size:8.5pt;line-height:1.9;text-align:left;direction:ltr}.acc{color:#c0392b;font-weight:700}' +
        '.party{border:.4pt solid #eadfce;border-radius:2mm;padding:3mm 4mm;background:#fffdf9}' +
        '.party .pt{color:#e87200;font-weight:700;font-size:' + (fs + 0.5) + 'pt;margin-bottom:1mm;font-family:Georgia,serif}' +
        'th{background:linear-gradient(90deg,#e87200,#ecb003);color:#fff;border:.4pt solid #d98700;padding:2mm;font-size:' + (fs - 0.3) + 'pt;letter-spacing:.2px}' +
        'td{border:.4pt solid #cbb28a;padding:1.8mm 2mm;text-align:center;vertical-align:middle}' +
        'tr.total td{background:#fdf3e3;border-top:1.2pt solid #e87200}.total .big{font-weight:700;font-size:' + (fs + 1) + 'pt}.total .words{font-style:italic;font-size:' + (fs - 0.6) + 'pt;color:#666}' +
        '.ftr{position:fixed;bottom:8.5mm;left:12mm;right:12mm;text-align:center;font-size:7.8pt;color:#4b5057;line-height:1.8}';
      body = lhBarsHtml() +
        '<div class="ftr">' + SELLER_INFO.address + '<br>Tel: ' + SELLER_INFO.tel + ' | ' + SELLER_INFO.email + ' | www.pishtaj.ir</div>' +
        '<div class="hd"><img src="' + SELLER_INFO.logo + '"><div class="ttl"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="t">' + title + '</div></div><div class="meta">' + meta + '</div></div>' +
        parties + docTableHtml(o) + docTailHtml(o);
    } else if (tpl === 'executive') {
      /* 🖤 اجرایی — طراحی تیم برندینگ: نوار جانبی زغالی + اکسنت نارنجی برند */
      css = '@page{size:A4 landscape;margin:0}' + common +
        'body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#23262b;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:12mm 12mm 24mm 20mm}' +
        '.sidebar{position:fixed;top:0;bottom:0;left:0;width:7mm;background:#2b2e33}' +
        '.sidebar:after{content:"";position:fixed;top:0;bottom:0;left:7mm;width:1.4mm;background:linear-gradient(180deg,#ef4b1a,#f79400)}' +
        '.dno{font-size:10.5pt;font-weight:700;margin-bottom:1mm}' +
        '.pgc{color:#9aa0a6;font-size:8pt}' +
        '.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6mm}' +
        '.hd img{height:17mm}' +
        '.hd .ttl .t{font-size:17pt;font-weight:800;color:#2b2e33;letter-spacing:1px}' +
        '.hd .ttl .t b{color:#ef4b1a}' +
        '.hd .ttl .co{font-size:8.5pt;color:#9aa0a6;letter-spacing:2.5px;text-transform:uppercase;margin-top:1.5mm}' +
        '.hd .meta{font-size:8.5pt;line-height:1.95;text-align:left;direction:ltr;background:#f6f7f9;border-radius:2mm;padding:3mm 4mm;min-width:52mm}' +
        '.acc{color:#ef4b1a;font-weight:800}' +
        '.party{background:#f6f7f9;border-radius:2mm;padding:3mm 4mm}' +
        '.party .pt{font-size:8pt;color:#ef4b1a;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:1.5mm}' +
        'th{background:#2b2e33;color:#fff;padding:2.2mm 2mm;font-size:' + (fs - 0.3) + 'pt;letter-spacing:.4px;border:0}' +
        'th:first-child{border-radius:0 1.5mm 1.5mm 0}th:last-child{border-radius:1.5mm 0 0 1.5mm}' +
        'td{border-bottom:.4pt solid #e4e6ea;padding:2mm;text-align:center;vertical-align:middle}' +
        'tbody tr:nth-child(even) td{background:#fafbfc}' +
        'tr.total td{background:#2b2e33;color:#fff;border:0}.total .big{font-weight:800;font-size:' + (fs + 1.2) + 'pt;color:#ffb033}.total .words{font-style:italic;font-size:' + (fs - 0.6) + 'pt;color:#cbd0d6}' +
        '.terms b{color:#ef4b1a}' +
        '.ftr{position:fixed;bottom:8mm;left:20mm;right:12mm;display:flex;justify-content:space-between;font-size:7.5pt;color:#9aa0a6;border-top:.4pt solid #e4e6ea;padding-top:2mm}' +
        wm;
      body = '<div class="sidebar"></div>' +
        '<div class="ftr"><span>' + SELLER_INFO.company + ' — National ID: ' + SELLER_INFO.nationalId + '</span><span>' + SELLER_INFO.tel + ' | ' + SELLER_INFO.email + ' | www.pishtaj.ir</span></div>' +
        '<div class="hd"><div><img src="' + SELLER_INFO.logo + '"><div class="ttl"><div class="t">' + title.split(' ')[0] + ' <b>' + title.split(' ').slice(1).join(' ') + '</b></div><div class="co">PISHRO TAJHIZ FARTAK CO.</div></div></div><div class="meta">' + meta + '</div></div>' +
        parties + docTableHtml(o) + docTailHtml(o);
    } else if (tpl === 'mono') {
      /* ⚫ مونوکروم الگانت — تک‌رنگ، سریف، خطوط دوتایی؛ برای چاپ سیاه‌وسفید */
      css = '@page{size:A4 landscape;margin:0}' + common +
        'body{font-family:Georgia,"Times New Roman",serif;color:#17191c;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:14mm 16mm 24mm}' +
        '.dno{font-size:10.5pt;font-weight:700;margin-bottom:1mm}' +
        '.pgc{color:#8a8f96;font-size:8pt}' +
        '.hd{text-align:center;border-bottom:2.2pt double #17191c;padding-bottom:4mm;margin-bottom:4mm;position:relative}' +
        '.hd img{height:15mm;position:absolute;right:0;top:0}' +
        '.hd .ttl .co{font-size:13pt;font-weight:700;letter-spacing:1px}' +
        '.hd .ttl .t{font-size:9.5pt;letter-spacing:5px;color:#4a4e54;margin-top:1.5mm;text-transform:uppercase}' +
        '.hd .meta{position:absolute;left:0;top:0;font-size:8.5pt;line-height:1.9;text-align:left;direction:ltr}' +
        '.acc{font-weight:800}' +
        '.party .pt{font-size:8pt;letter-spacing:2px;text-transform:uppercase;border-bottom:.6pt solid #17191c;display:inline-block;margin-bottom:1.5mm;padding-bottom:.6mm}' +
        'th{border-top:1.4pt solid #17191c;border-bottom:.6pt solid #17191c;padding:2.2mm 2mm;font-size:' + (fs - 0.3) + 'pt;letter-spacing:1px;text-transform:uppercase;text-align:center}' +
        'td{border-bottom:.35pt solid #c9ccd1;padding:2mm;text-align:center;vertical-align:middle}' +
        'tr.total td{border-top:1.4pt solid #17191c;border-bottom:2.2pt double #17191c;background:#fff}.total .big{font-weight:800;font-size:' + (fs + 1.2) + 'pt}.total .words{font-style:italic;font-size:' + (fs - 0.6) + 'pt;color:#5a5e64}' +
        '.ftr{position:fixed;bottom:8mm;left:16mm;right:16mm;text-align:center;font-size:7.5pt;color:#8a8f96;border-top:.4pt solid #c9ccd1;padding-top:2mm;letter-spacing:.5px;font-family:"Segoe UI",Tahoma,sans-serif}' +
        wm;
      body = '<div class="ftr">' + SELLER_INFO.company + ' · ' + SELLER_INFO.address + ' · ' + SELLER_INFO.tel + ' · www.pishtaj.ir</div>' +
        '<div class="hd"><img src="' + SELLER_INFO.logo + '"><div class="meta">' + meta + '</div><div class="ttl"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="t">' + title + '</div></div></div>' +
        parties + docTableHtml(o) + docTailHtml(o);
    } else if (tpl === 'minimal') {
      css = '@page{size:A4 landscape;margin:16mm 14mm 20mm 14mm}' + common +
        'body{font-family:Helvetica,Arial,sans-serif;color:#1a1c1f;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2pt solid #1a1c1f;padding-bottom:4mm;margin-bottom:5mm}' +
        '.hd img{height:16mm}' +
        '.hd .ttl .t{font-size:16pt;font-weight:300;letter-spacing:4px;color:#1a1c1f}' +
        '.hd .ttl .co{font-size:8.5pt;color:#b8860b;letter-spacing:1.5px;margin-top:1mm}' +
        '.hd .meta{font-size:8.5pt;line-height:1.9;text-align:left;direction:ltr}.acc{color:#b8860b;font-weight:700}' +
        '.party .pt{font-size:8pt;color:#b8860b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:1mm}' +
        'th{border-bottom:1.2pt solid #1a1c1f;padding:2mm;font-size:' + (fs - 0.3) + 'pt;text-transform:uppercase;letter-spacing:.5px;color:#1a1c1f;text-align:center}' +
        'td{border-bottom:.4pt solid #d8dadd;padding:2mm;text-align:center;vertical-align:middle}' +
        'tr.total td{border-top:1.2pt solid #1a1c1f;border-bottom:none;background:#faf8f4}.total .big{font-weight:700;font-size:' + (fs + 1) + 'pt}.total .words{font-style:italic;font-size:' + (fs - 0.6) + 'pt;color:#777}' +
        '.ftr{position:fixed;bottom:8mm;left:14mm;right:14mm;text-align:center;font-size:7.5pt;color:#8a8f96;letter-spacing:.5px}';
      body = '<div class="ftr">' + SELLER_INFO.company + ' — ' + SELLER_INFO.address + ' — ' + SELLER_INFO.tel + ' — www.pishtaj.ir</div>' +
        '<div class="hd"><img src="' + SELLER_INFO.logo + '"><div class="ttl"><div class="t">' + title + '</div><div class="co">PISHRO TAJHIZ FARTAK CO.</div></div><div class="meta">' + meta + '</div></div>' +
        parties + docTableHtml(o) + docTailHtml(o);
    } else { // classic — افقی (نسخه بهبود یافته فرمت قبلی)
      css = '@page{size:A4 landscape;margin:10mm 12mm 18mm 12mm}' + common + /* v14.2 US-358 */
        'body{font-family:"Segoe UI",Arial,sans-serif;color:#1f2328;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '.hd{display:grid;grid-template-columns:110px 1fr 190px;align-items:start;gap:8px;border-bottom:2.5px solid #ef4b1a;padding-bottom:3mm;margin-bottom:4mm}' +
        '.hd img{height:16mm}.hd .ttl{text-align:center}' +
        '.hd .ttl .co{font-size:15pt;font-weight:700;color:#ef4b1a;font-family:Georgia,serif}' +
        '.hd .ttl .t{font-size:10pt;color:#f79400;font-weight:600;letter-spacing:1.5px;margin-top:1.5mm}' +
        '.hd .meta{font-size:8.5pt;line-height:1.9;text-align:left;direction:ltr}.acc{color:#c0392b;font-weight:700}' +
        '.party{border:.4pt solid #e3e5e8;border-radius:1.5mm;padding:2.5mm 3.5mm;background:#fcfcfc}' +
        '.party .pt{color:#f79400;font-weight:700;font-family:Georgia,serif}' +
        'th{background:#f79400;color:#fff;border:.4pt solid #d98700;padding:1.8mm;font-size:' + (fs - 0.3) + 'pt}' +
        'td{border:.4pt solid #9aa0a6;padding:1.6mm 2mm;text-align:center;vertical-align:middle}' +
        'tr.total td{background:#fdf1e7;border-top:1.2pt solid #f79400}.total .big{font-weight:700;font-size:' + (fs + 1) + 'pt}.total .words{font-style:italic;font-size:' + (fs - 0.6) + 'pt;color:#555}' +
        '.ftr{position:fixed;bottom:8mm;left:12mm;right:12mm;text-align:center;font-size:7.5pt;color:#f79400;border-top:.4pt solid #f0d9b8;padding-top:1mm;background:#fff}';
      body = '<div class="ftr">Address: ' + SELLER_INFO.address + ' | Tel: ' + SELLER_INFO.tel + ' | ' + SELLER_INFO.email + ' | www.pishtaj.ir</div>' +
        '<div class="hd"><img src="' + SELLER_INFO.logo + '"><div class="ttl"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="t">' + title + '</div></div><div class="meta">' + meta + '</div></div>' +
        parties + docTableHtml(o) + docTailHtml(o);
    }

    var pdfFileName = typeof ptfOfferPdfFileName === 'function' ? ptfOfferPdfFileName(o) : o.no;
    var fullHtml = '<!doctype html><html><head><meta charset="utf-8"><title>' + escP(pdfFileName) + '</title><style>' + css + '</style></head><body>' + printHint() + body + '</body></html>';
    if (dest === 'share') {
      window.ptfShareHtmlToMessenger(fullHtml, pdfFileName);
      return;
    }
    window.ptfPreviewPrintableDoc(title + ' — ' + escP(o.no), fullHtml, pdfFileName);
  };

  window.offerQuickPreview = function (no) {
    var o = getData('ptf_crm_offers').filter(function (x) { return x.no === no; })[0];
    if (!o) return;
    var tpl = localStorage.getItem('ptf_offer_tpl') || 'letterhead';
    offerPrintTpl(o, tpl, true);
  };

  // offerPrint قدیمی → دیالوگ انتخاب قالب (US-185)
  window.offerPrint = function (no) { offerPickTemplate(no); };
  var _offerPrintObj = window.offerPrintObj;
  // v84.1: دکمه پیش‌نمایش داخل فرم هم اول قالب را می‌پرسد (خواسته صریح کارفرما)
  window.offerPrintObj = function (o) {
    window._offPreviewObj = o;
    offerPickTemplate(o);
  };
})();

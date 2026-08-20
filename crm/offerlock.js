/* =====================================================================
   PTF CRM — offerlock.js — Sprint 88 — US-201 + US-202
   US-201: ردیف دستی TO/CO فقط از کالاهای ثبت‌شده ماژول کالا:
     - جستجوی زنده با کد یا شرح (کشویی) + Enter با کد دقیق = درج فوری
     - شرح/واحد/کد قفل (readonly) — کد در فرم هست ولی در خروجی چاپ نمی‌آید
     - کالای جدید؟ ثبت سریع در ماژول کالا با کد یکتای خودکار
   US-202: فرم عریض‌تر (~۲ برابر)، شرح بلندتر، تعداد/واحد کوچکتر،
     تغییر عرض ستون‌ها با درگ، اعتبارسنجی «هیچ ستونی خالی نماند» (- مجاز)
   + US-203: نمایش پیوست‌های درخواست 📎
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- جستجوی کالا ---------- */
  /* v12.6 (BUG-008): کوئری خالی = حالت مرور (آخرین کالاهای ثبت‌شده نمایش داده می‌شوند تا کاربر ببیند)
     + جستجو روی استاندارد/برند/دسته هم انجام می‌شود */
  function prodSearch(q) {
    q = String(q || '').trim().toLowerCase();
    var all = getData('ptf_crm_products');
    if (!q) return all.slice(0, 12);
    /* v15.9 (US-389): جستجوی دوزبانه + مدل + نرمال‌سازی — همان موتور ماژول کالا */
    if (typeof ptfProdSearchMatch === 'function') return all.filter(function (p) { return ptfProdSearchMatch(p, q); }).slice(0, 12);
    return all.filter(function (p) {
      return ((p.cd || '') + ' ' + (p.nm || '') + ' ' + (p.en || '') + ' ' + (p.st || '') + ' ' + (p.br || '') + ' ' + (p.md || '') + ' ' + (p.ca || '')).toLowerCase().indexOf(q) > -1;
    }).slice(0, 12);
  }
  function prodByCode(cd) {
    cd = String(cd || '').trim().toLowerCase();
    return getData('ptf_crm_products').filter(function (p) { return (p.cd || '').toLowerCase() === cd; })[0];
  }

  window.offPickProd = function (i, cd) {
    var p = prodByCode(cd);
    if (!p) return;
    var it = _offState.items[i];
    it.pcode = p.cd;
    it.name = p.en || p.nm;
    it.desc = it.desc && it.desc !== '-' ? it.desc : (p.st || '-');
    it.unit = p.un || 'NO';
    if (!it.brand && p.br) it.brand = p.br;
    if (!it.model && p.md) it.model = p.md; /* v15.9 US-389: مدل کالا هم می‌نشیند */
    offRenderItems();
  };
  window.offUnpickProd = function (i) {
    var it = _offState.items[i];
    delete it.pcode;
    it.name = ''; it.unit = '';
    offRenderItems();
  };
  window.offProdSrchKey = function (i, ev, el) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      var p = prodByCode(el.value) || prodSearch(el.value)[0];
      if (p) offPickProd(i, p.cd);
      else alert('کالایی با این کد/شرح یافت نشد — از «+ ثبت سریع کالا» استفاده کنید');
      return;
    }
    offProdSrchInput(i, el);
  };
  window.offProdSrchInput = function (i, el) {
    var dd = document.getElementById('opdd' + i);
    if (!dd) return;
    var res = prodSearch(el.value);
    var browsing = !String(el.value || '').trim();
    dd.innerHTML = (browsing && res.length ? '<div style="padding:5px 10px;font-size:10.5px;color:#7c3aed;background:#f5f3ff;font-weight:800">📦 کالاهای ثبت‌شده (' + getData('ptf_crm_products').length + ') — تایپ کنید تا فیلتر شود</div>' : '') + res.map(function (p) {
      return '<div onclick="offPickProd(' + i + ',\'' + ptfOnClickArg(p.cd) + '\')" style="padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--brd);font-size:12px;display:flex;justify-content:space-between;gap:8px" onmouseover="this.style.background=\'#fff8f5\'" onmouseout="this.style.background=\'\'">' +
        '<span>' + escP(p.nm) + (p.en ? ' <small style="color:#94a3b8">' + escP(p.en) + '</small>' : '') + '</span>' +
        '<b style="direction:ltr;color:#7c3aed;white-space:nowrap">' + escP(p.cd) + '</b></div>';
    }).join('');
    dd.style.display = res.length ? 'block' : 'none';
  };
  // ثبت سریع کالای جدید (کد یکتای خودکار سیستم) و درج در ردیف
  window.offProdQuickAdd = function (i) {
    ptfDialog({
      title: '📦 ثبت سریع کالا (کد یکتا خودکار)',
      fields: [
        { id: 'nm', label: 'شرح کالا *', required: true },
        { id: 'un', label: 'واحد *', type: 'select', options: ['NO', 'PCS', 'Set', 'Meter', 'KG', 'عدد', 'شاخه', 'متر', 'ست'] },
        { id: 'st', label: 'استاندارد/مشخصه (اختیاری)' },
        { id: 'pr', label: 'نرخ مرجع خرید — ریال (اختیاری)', type: 'number' } /* v31.7.12 US-OFF-REF */
      ],
      okText: 'ثبت و درج در ردیف',
      onOk: function (v) {
        var prods = getData('ptf_crm_products');
        // ضد تکرار
        if (typeof ptfCheckDup === 'function' && ptfCheckDup('product', { nm: v.nm }, null).length) {
          var ex = prods.filter(function (p) { return typeof dedupNorm === 'function' && dedupNorm(p.nm) === dedupNorm(v.nm); })[0];
          if (ex) { offPickProd(i, ex.cd); ptfToast('کالا از قبل موجود بود — همان درج شد: ' + ex.cd, 'ok'); return; }
        }
        var cd = (typeof prodAutoCode === 'function') ? prodAutoCode() : 'P-' + (1000 + prods.length + 1);
        /* v31.7.12 US-OFF-REF: نرخ مرجع از فرم + مارک مخفی منبع (srcRef) */
        var _pr = +v.pr || 0;
        prods.push({ cd: cd, nm: v.nm, en: '', ca: 'سایر', st: v.st || '', br: '', un: v.un, pr: _pr,
          refPriceAt: _pr > 0 ? (typeof faDate === 'function' ? faDate() : '') : '', refPriceSrc: _pr > 0 ? 'ثبت سریع فرم پیشنهاد' : '',
          srcRef: (window._offState && (_offState.no || _offState.inqNo)) ? { kind: 'offer', no: _offState.no || '', inqNo: _offState.inqNo || '', at: new Date().toISOString(), by: (typeof curSession === 'function' ? (curSession().user || '') : '') } : null,
          ds: 'ثبت سریع از فرم پیشنهاد', ts: new Date().toISOString(), ts0: new Date().toISOString() });
        setData('ptf_crm_products', prods);
        audit('کالاها', 'ثبت سریع کالا از فرم پیشنهاد: ' + v.nm + (_pr > 0 ? ' (نرخ مرجع ' + _pr.toLocaleString('en-US') + ')' : ''), cd);
        offPickProd(i, cd);
        if (_pr > 0) { var _it = _offState.items[i]; if (_it && !+_it.refPrice) { _it.refPrice = _pr; offRenderItems(); } }
      }
    });
  };

  /* ---------- بازنویسی رندر اقلام: قفل کالا + عرض‌ها + ریسایز ---------- */
  var COL_W_KEY = 'ptf_off_colw';
  function colW() { try { return JSON.parse(localStorage.getItem(COL_W_KEY) || '{}'); } catch (e) { return {}; } }
    window.offColResizeStart = function (ev, key) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var target = ev.target || ev.srcElement;
    if (!target || !target.parentElement) return;
    var th = target.parentElement;
    var startX = ev.pageX || (ev.touches && ev.touches[0] ? ev.touches[0].pageX : 0) || ev.clientX || 0;
    var startW = th.offsetWidth;
    if (target.setPointerCapture && ev.pointerId !== undefined) {
      try { target.setPointerCapture(ev.pointerId); } catch(e){}
    }
    function mv(e2) {
      if (e2 && e2.buttons !== undefined && e2.buttons === 0) { up(e2); return; }
      var curX = e2.pageX || (e2.touches && e2.touches[0] ? e2.touches[0].pageX : 0) || e2.clientX || 0;
      if (!curX && curX !== 0) return;
      var w = Math.max(44, startW + (startX - curX));
      th.style.minWidth = th.style.width = w + 'px';
      var m = colW(); m[key] = w; localStorage.setItem(COL_W_KEY, JSON.stringify(m));
    }
    function up(e3) {
      if (target && target.releasePointerCapture && ev.pointerId !== undefined) {
        try { target.releasePointerCapture(ev.pointerId); } catch(e){}
      }
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('mouseleave', up);
      document.removeEventListener('visibilitychange', up);
      document.removeEventListener('dragend', up);
      document.removeEventListener('mouseout', viewportOut);
      window.removeEventListener('blur', up);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('dragend', up);
      window.removeEventListener('mouseout', viewportOut);
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    }
    function viewportOut(e4) {
      e4 = e4 || window.event;
      var to = e4.relatedTarget || e4.toElement;
      if (!to) up(e4); // Mouse left the browser window viewport!
    }
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
    document.addEventListener('mouseleave', up);
    document.addEventListener('visibilitychange', up);
    document.addEventListener('dragend', up);
    document.addEventListener('mouseout', viewportOut);
    window.addEventListener('blur', up);
    window.addEventListener('mouseup', up);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('dragend', up);
    window.addEventListener('mouseout', viewportOut);
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  };

  var _render1 = window.offRenderItems2 || window.offRenderItems;
  window.offRenderItems2 = window.offRenderItems = function () {
    var el = (typeof offEl === 'function') ? offEl('offItemsWrap') : document.getElementById('offItemsWrap'); /* v14.2 US-364 */
    if (!el || !window._offState) return;
    var isCO = _offState.kind === 'CO' || _offState.kind === 'TC'; // v122: فرم TC = مالی با قیمت
    var cur = offerCurrency(_offState);
    var cols = offBaseCols(isCO);
    var ec = _offState.extraCols || [];
    var ws = colW();
    // US-202: عرض پیش‌فرض — شرح بلند، تعداد/واحد کوچک
    var DEF_W = { name: 240, desc: 300, model: 90, qty: 52, unit: 52, brand: 100 };
    var dragAttr = function (key) {
      return ' draggable="true" ondragstart="offColDragStart(event,\'' + key + '\')" ondragover="offColDragOver(event)" ondrop="offColDrop(event,\'' + key + '\')"';
    };
    var thW = function (key) {
      var w = ws[key] || DEF_W[key] || 90;
      return ' style="cursor:grab;min-width:' + w + 'px;width:' + w + 'px;position:relative"';
    };
    var rz = function (key) { return '<span onpointerdown="offColResizeStart(event,\'' + key + '\')" onmousedown="if(event.pointerId===undefined)offColResizeStart(event,\'' + key + '\')" ondragstart="event.preventDefault();return false;" style="position:absolute;left:-3px;top:0;bottom:0;width:7px;cursor:col-resize;touch-action:none;user-select:none"></span>'; };
    var head = '<tr><th style="width:52px" data-noix>➕</th><th style="width:30px">#</th><th style="width:120px;position:relative">کد کالا 🔒' + rz('pcode') + '</th>' + /* v14.2 US-366: عملیات ابتدای ردیف */
      cols.map(function (c) {
        return '<th' + dragAttr(c.k) + thW(c.k) + '>⠿ ' + (c.fa || c.lb) + ' <a href="javascript:void(0)" onclick="offToggleBaseCol(\'' + c.k + '\')" style="color:#dc2626;font-size:10px" title="حذف ستون">✕</a>' + rz(c.k) + '</th>';
      }).join('') +
      ec.map(function (c, ci) {
        return '<th' + dragAttr('x:' + c) + ' style="position:relative;min-width:' + (ws['x:' + c] || 90) + 'px">⠿ ' + escP(c) + ' <a href="javascript:void(0)" onclick="offDelColumn(' + ci + ')" style="color:#dc2626;font-size:10px">✕</a>' + rz('x:' + c) + '</th>';
      }).join('') +
      (isCO ? ((typeof roleDef === 'function' && (roleDef() || {}).buyPrice)
        ? '<th style="min-width:112px;background:#fcfaff;color:#5b21b6" title="نرخ مرجع خرید از بانک کالا">نرخ مرجع خرید</th><th style="min-width:78px;background:#fffef0;color:#92400e" title="درصد حاشیه سود">(٪) سود</th>'
        : '') + '<th style="position:relative;min-width:' + (ws.price || 100) + 'px">قیمت واحد (' + cur.sym + ')' + rz('price') + '</th><th>جمع</th>' : '') + '</tr>';
    var rows = '';
    /* v14.6 (US-347): کش کاتالوگ برای قیمت خرید مرجع — یک بار per رندر */
    var _prodsRef = [];
    try { if (isCO && typeof roleDef === 'function' && (roleDef() || {}).buyPrice) _prodsRef = getData('ptf_crm_products'); } catch (ePR) {}
    /* BUG-CO-MARGIN-284: offerlock renderer جای renderer اصلی را می‌گرفت و کنترل
       حاشیه سود را حذف می‌کرد. فقط نقش دارای buyPrice نرخ مرجع/سود را می‌بیند. */
    var canMargin = isCO && _prodsRef.length > 0;
    _offState.items.forEach(function (it, i) {
      var inp = function (f, type, step, ro) {
        var unitWord = (cur && cur.id === 'EUR') ? 'یورو' : (cur && cur.id === 'USD') ? 'دلار' : 'ریال';
        var moneyAttr = f === 'price' ? ' data-money="1" data-words="1" data-unit="' + unitWord + '" inputmode="numeric" autocomplete="off"' : '';
        var inputType = f === 'price' ? 'text' : (type || 'text');
        var shown = (f === 'price' && it[f]) ? ((typeof window.offMoneyText === 'function') ? window.offMoneyText(it[f], cur) : it[f]) : (it[f] == null ? '' : it[f]);
        return '<input type="' + inputType + '"' + (step ? ' step="' + step + '"' : '') + (ro ? ' readonly' : '') + moneyAttr +
          ' id="off_' + f + '_' + i + '" value="' + escP(shown) + '" oninput="offUpdItem(' + i + ',\'' + f + '\',this.value)" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:6px;direction:ltr;font-size:12.5px' + (ro ? ';background:#f1f5f9;color:#475569;cursor:not-allowed' : '') + '">';
      };
      var locked = !!it.pcode;
      // US-201: سلول کد — جستجو یا نشان کد قفل‌شده
      var codeCell = locked
        ? '<td><b style="direction:ltr;display:inline-block;color:#7c3aed;font-size:11.5px">' + escP(it.pcode) + '</b> <a href="javascript:void(0)" onclick="offUnpickProd(' + i + ')" title="تغییر کالا" style="font-size:11px">🔁</a></td>'
        : '<td style="position:relative"><input type="text" placeholder="کلیک = مرور کالاها | تایپ = جستجو" onkeydown="offProdSrchKey(' + i + ',event,this)" oninput="offProdSrchInput(' + i + ',this)" onfocus="offProdSrchInput(' + i + ',this)" onblur="var d=document.getElementById(\'opdd' + i + '\');setTimeout(function(){if(d)d.style.display=\'none\'},250)" style="width:100%;padding:6px;border:1.5px dashed #7c3aed;border-radius:6px;font-size:11.5px" autocomplete="off">' +
          '<div id="opdd' + i + '" style="display:none;position:absolute;top:100%;right:0;left:-160px;background:#fff;border:1px solid var(--brd);border-radius:10px;box-shadow:0 10px 26px rgba(15,23,42,.18);z-index:50;max-height:220px;overflow:auto"></div>' +
          '<a href="javascript:void(0)" onclick="offProdQuickAdd(' + i + ')" style="font-size:10px;color:#059669;white-space:nowrap">+ ثبت سریع</a></td>';
      var tds = cols.map(function (c) {
        if (c.k === 'qty') return '<td>' + inp('qty', 'number') + '</td>';
        if (c.k === 'unit') return '<td>' + inp('unit', 'text', null, false) + '</td>'; // US-201: واحد آزاد شد (اسپرینت ۱۰۲)
        if (c.k === 'name') return '<td>' + inp('name', 'text', null, false) + '</td>'; // US-201: شرح آزاد شد (اسپرینت ۱۰۲)
        return '<td>' + inp(c.k) + '</td>';
      }).join('');
      var ecCells = ec.map(function (c) {
        var v = (it.extra || {})[c] || '';
        return '<td><input type="text" value="' + escP(v) + '" oninput="offUpdExtra(' + i + ',\'' + ptfOnClickArg(c) + '\',this.value)" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:6px;font-size:12px"></td>';
      }).join('');
      /* v14.6 (US-347 — نقشه راه مصوب): قیمت خرید مرجع (p.pr با تاریخ US-335) + درصد سود + هشدار سود منفی
         فقط برای نقش‌های دارای buyPrice — سایر نقش‌ها هیچ قیمتی خریدی نمی‌بینند */
      /* v31.7.12 US-OFF-REF: نرخ مرجع ویرایش‌شده توسط کاربر بر نرخ کاتالوگ مقدم است */
      var refHtml = '', rowRefPrice = (it.refPriceEdited && +it.refPrice > 0) ? +it.refPrice : ((typeof window.ptfOfferBestBuyRef === 'function' ? window.ptfOfferBestBuyRef(it) : 0) || +it.refBuyPrice || +it.refPrice || 0);
      if (isCO && _prodsRef.length) {
        try {
          /* BUG-PROC-LINK-287: product reference is usable only after a unique
             code/signature match; duplicate names never pick the first product. */
          var refMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, _prodsRef) : { ok:false };
          var pRef = refMatch.ok ? refMatch.item : null;
          var refP = pRef ? (+pRef.pr || 0) : 0;
          if (refP > 0) {
            if (!(it.refPriceEdited && +it.refPrice > 0)) rowRefPrice = refP; /* v31.7.12: دست کاربر برنده */
            /* v15.6 (US-387): ارز مرجع خرید — اگر با ارز سند فرق کند، درصد سود گمراه‌کننده است → فقط اطلاع */
            var refCur = (pRef.prCur || 'IRR');
            var docCur = (cur && cur.id) || 'IRR';
            var sameCur = refCur === docCur;
            var sellP = +it.price || 0;
            var mPct = (sameCur && sellP > 0) ? Math.round((sellP - refP) * 1000 / refP) / 10 : null;
            var neg = sameCur && sellP > 0 && sellP < refP;
            refHtml = '<div data-noix style="font-size:10.5px;line-height:1.7;margin-top:3px;padding:2px 6px;border-radius:6px;background:' + (neg ? '#fef2f2' : '#f0fdf4') + ';color:' + (neg ? '#dc2626' : '#047857') + '">' +
              (neg ? '⚠️ <b>سود منفی!</b> ' : '') + 'مرجع خرید: <b>' + refP.toLocaleString('en-US') + ' ' + escP(refCur) + '</b>' +
              (pRef.refPriceAt ? ' <span title="' + escP(pRef.refPriceSrc || '') + '">(' + escP(pRef.refPriceAt) + ')</span>' : '') +
              (sameCur
                ? (mPct !== null ? ' | 📈 حاشیه فعلی: <b>' + mPct + '٪</b>' : ' | قیمت فروش را وارد کنید')
                : ' | <span style="color:#b45309">⚠️ ارز سند ' + escP(docCur) + ' است — درصد سود بین دو ارز محاسبه نمی‌شود</span>') + '</div>';
          } else if (!refMatch.ok && refMatch.reason === 'ambiguous') {
            refHtml = '<div data-noix style="font-size:10px;color:#b45309;margin-top:2px">⚠️ مرجع خرید مبهم است؛ انتخاب خودکار نشد</div>';
          }
        } catch (eRf) {}
      }
      var marginPct = (typeof it.marginPct === 'number') ? it.marginPct : (rowRefPrice > 0 && +it.price > 0 ? Math.round(((+it.price / rowRefPrice) - 1) * 1000) / 10 : '');
      var marginCells = canMargin
        ? '<td style="background:#fcfaff"><input type="text" inputmode="numeric" data-money="1" data-nohint="1" autocomplete="off" id="offRef' + i + '" value="' + escP(rowRefPrice ? ((typeof window.offMoneyText === 'function') ? window.offMoneyText(rowRefPrice, cur) : rowRefPrice) : '') + '" oninput="offUpdRefPrice(' + i + ',this.value)" placeholder="نرخ مرجع" style="width:112px;direction:ltr;background:#f5f3ff;border:1px solid #ddd6fe;font-weight:bold;color:#5b21b6;padding:5px;border-radius:6px"></td>' +
          '<td style="background:#fffef0"><input type="number" id="offMg' + i + '" value="' + marginPct + '" oninput="offUpdMarginPct(' + i + ',this.value)" placeholder="30%" style="width:58px;direction:ltr;background:#fefce8;border:1px solid #fde047;font-weight:bold;color:#b45309;padding:5px;border-radius:6px"></td>'
        : '';
      /* v14.2 US-366: دکمه ➕ افزودن ردیف در ابتدای ردیف (سمت راست RTL) — دستور کارفرما */
      rows += '<tr><td style="white-space:nowrap" data-noix>' + (i === 0 ? '<button type="button" onclick="offAddItem()" title="افزودن ردیف" style="border:0;background:#059669;color:#fff;border-radius:7px;width:22px;height:22px;cursor:pointer;font-weight:900">＋</button> ' : '') + '<button type="button" onclick="offDelItem(' + i + ')" title="حذف ردیف" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td><td>' + (i + 1) + '</td>' + codeCell + tds + ecCells +
        (isCO
          ? marginCells + '<td>' + inp('price', 'number', cur.id === 'IRR' ? '1' : '0.01') + refHtml + '</td><td id="offRT' + i + '" class="off-money-total" style="white-space:nowrap;font-size:12px;font-variant-numeric:tabular-nums">' + ((typeof window.offPrintAmount === 'function') ? window.offPrintAmount((+it.qty || 0) * (+it.price || 0), cur) : offerFmtMoney((+it.qty || 0) * (+it.price || 0), cur)) + '</td>' /* v17.0 US-409 + v34.7.47 کاما انگلیسی */
          : '') + '</tr>';
    });
    var totalRow = '';
    if (isCO) {
      var total = _offState.items.reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0);
      totalRow = '<tr style="font-weight:bold;background:#fff8f5"><td colspan="' + (4 + cols.length + ec.length + (canMargin ? 2 : 0)) + '" style="text-align:left">GRAND TOTAL (' + cur.id + ')</td><td id="offGT" style="white-space:nowrap">' + ((typeof window.offPrintAmount === 'function') ? window.offPrintAmount(total, cur) : offerFmtMoney(total, cur)) + '</td></tr>'; /* v14.2 US-366 + v34.7.47 */
    }
    var hidden = _offState.hiddenCols || [];
    var restoreBar = hidden.length
      ? '<div style="font-size:11px;color:#7c3aed;margin:4px 0">ستون‌های حذف‌شده: ' + hidden.map(function (k) {
          return '<a href="javascript:void(0)" onclick="offToggleBaseCol(\'' + k + '\')" style="color:#7c3aed;margin:0 3px">[+ ' + k + ']</a>';
        }).join('') + '</div>'
      : '';
    var globalMarginBar = canMargin ? '<div style="display:flex;justify-content:space-between;align-items:center;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 14px;margin-bottom:10px;flex-wrap:wrap;gap:10px">' +
      '<span style="font-size:12.5px;color:#5b21b6">📈 <b>حاشیه سود پیش‌فرض و نرخ مرجع کالا:</b><br><small style="color:#64748b">درصد سود را وارد کنید؛ سپس قیمت واحد تمام اقلام دارای نرخ مرجع محاسبه می‌شود.</small></span>' +
      '<span style="display:flex;align-items:center;gap:6px"><input type="number" id="ofGlobalMargin" value="30" placeholder="30" style="width:65px;padding:6px;border:1.5px solid #8b5cf6;border-radius:8px;direction:ltr;font-weight:bold;text-align:center"> <b>٪</b> <button type="button" class="bt" style="background:#7c3aed;padding:6px 14px;font-size:12px" onclick="offApplyGlobalMargin()">⚡ اعمال سود و محاسبه قیمت فروش</button></span></div>' : '';
    el.innerHTML = restoreBar + globalMarginBar +
      '<div style="font-size:11px;color:#0c4a6e;background:#f0f9ff;border-radius:8px;padding:5px 10px;margin-bottom:6px">🔒 کالا فقط از ماژول کالا انتخاب می‌شود (کد/شرح را تایپ کنید) — کد کالا در خروجی PDF درج نمی‌شود. عرض ستون‌ها با درگ لبه سرستون قابل تغییر است.</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;table-layout:auto"><thead style="background:#f1f5f9">' + head + '</thead><tbody>' + rows + totalRow + '</tbody></table>' +
      (_offState.items.length ? '' : '<div style="color:#94a3b8;text-align:center;padding:14px;font-size:12px">ردیفی ثبت نشده — «+ ردیف دستی» و سپس کد/شرح کالا را جستجو کنید</div>');
    if (typeof ptfMoneyRefresh === 'function') {
      try { ptfMoneyRefresh(el); } catch (eMoney) {}
    }
  };

  /* ---------- US-202: فرم عریض ---------- */
  var _offerFormOld = window.offerForm;
  if (typeof _offerFormOld === 'function') {
    window.offerForm = function () {
      _offerFormOld();
      setTimeout(function () {
        var mds = document.querySelectorAll('.md-b .md');
        /* v16.2 (BUG-017): آخرین مودال قابل‌مشاهده — نه مینیمایزشده در body */
        var md = null;
        for (var _mv = mds.length - 1; _mv >= 0; _mv--) {
          var _pb = mds[_mv].closest ? mds[_mv].closest('.md-b') : null;
          if (!_pb || _pb.style.display !== 'none') { md = mds[_mv]; break; }
        }
        if (md && md.querySelector('#offItemsWrap')) md.style.maxWidth = 'min(96vw, 1700px)';
      }, 60);
    };
  }

  /* ---------- US-202: اعتبارسنجی «هیچ ستونی خالی نماند» ---------- */
  window.offValidateItems = function () {
    var st = window._offState || (typeof _offState !== 'undefined' ? _offState : null);
    if (!st) return 'فرم پیشنهاد در حافظه نیست — یک‌بار فرم را ببندید و دوباره باز کنید';
    if (!st.items || !st.items.length) return 'حداقل یک ردیف کالا لازم است';
    var isCO = st.kind === 'CO' || st.kind === 'TC'; // v122: فرم TC = مالی با قیمت
    var colsFn = (typeof window.offBaseCols === 'function') ? window.offBaseCols : (typeof offBaseCols === 'function' ? offBaseCols : null);
    if (!colsFn) return null; /* اگر موتور ستون‌ها لود نشده، اعتبارسنجی سخت‌گیرانه را رد نکن */
    var cols = colsFn(isCO); /* v17.0 BUG-019 */
    var ec = st.extraCols || [];
    /* v17.0 (BUG-019 AC2 — دستور کارفرما): ستون سراسر-خالی مانع ذخیره نیست — خودکار از چاپ هم حذف می‌شود.
       فقط ستون‌های کلیدی (شرح/تعداد و قیمت CO/TC) همیشه الزامی‌اند؛ ستون نیمه‌پُر همچنان کامل‌شدنی است. */
    var MUST = { name: 1, qty: 1 };
    function colAllEmpty(k) {
      return !st.items.some(function (x) { return String(x[k] == null ? '' : x[k]).trim() !== ''; });
    }
    function ecAllEmpty(c) {
      return !st.items.some(function (x) { return String(((x.extra || {})[c]) == null ? '' : (x.extra || {})[c]).trim() !== ''; });
    }
    for (var i = 0; i < st.items.length; i++) {
      var it = st.items[i];
      if (!String(it.unit || '').trim()) it.unit = 'NO';
      if (typeof ptfOfferUnitEn === 'function') it.unit = ptfOfferUnitEn(it.unit);
      for (var c = 0; c < cols.length; c++) {
        var k = cols[c].k;
        if (k === 'qty') {
          if (!(+it.qty > 0)) return 'ردیف ' + (i + 1) + ': «تعداد» باید عدد بزرگتر از صفر باشد';
          continue;
        }
        if (k === 'unit') continue; /* v25.6: واحد پیش‌فرض — مانع ذخیره نشود */
        var v = String(it[k] == null ? '' : it[k]).trim();
        if (v === '' && k === 'brand' && st.kind === 'TC') continue; // v122 US-277: برند در TC اختیاری
        if (v === '' && !MUST[k] && colAllEmpty(k)) continue; /* v17.0: سراسر-خالی = آزاد (در چاپ نمی‌آید) */
        if (v === '') return 'ردیف ' + (i + 1) + ': ستون «' + (cols[c].fa || cols[c].lb) + '» خالی است — مقدار بدهید یا خط تیره (-) بگذارید' + (MUST[k] ? '' : '\n(اگر کل ستون را نمی‌خواهید: همه ردیف‌هایش را خالی بگذارید یا با ✕ حذفش کنید — خودکار از چاپ حذف می‌شود)');
      }
      for (var e2 = 0; e2 < ec.length; e2++) {
        var ev = String(((it.extra || {})[ec[e2]]) == null ? '' : (it.extra || {})[ec[e2]]).trim();
        if (ev === '' && ecAllEmpty(ec[e2])) continue; /* v17.0: ستون سفارشی سراسر-خالی = آزاد */
        if (ev === '') return 'ردیف ' + (i + 1) + ': ستون «' + ec[e2] + '» خالی است — مقدار بدهید یا خط تیره (-) بگذارید';
      }
      if (isCO && String(it.price == null ? '' : it.price).trim() === '') return 'ردیف ' + (i + 1) + ': «قیمت واحد» خالی است';
    }
    return null;
  };
  var _offerSaveOld = window.offerSave;
  if (typeof _offerSaveOld === 'function') {
    window.offerSave = function () {
      try {
        var err = (typeof window.offValidateItems === 'function') ? window.offValidateItems() : null;
        if (err) { alert('⛔ ' + err); return; }
        return _offerSaveOld.apply(this, arguments);
      } catch (eLock) {
        try { console.error('offerSave/offerlock', eLock); } catch (e1) {}
        alert('⛔ خطا هنگام ذخیره پیشنهاد: ' + (eLock && eLock.message ? eLock.message : eLock));
      }
    };
  }

  /* ---------- US-203: نمایش پیوست‌های درخواست 📎 ---------- */
  window.rfqShowFiles = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    var GROUPS = { inq: '📄 فایل استعلام', ds: '📑 دیتاشیت', img: '🖼 عکس کالا', dwg: '📐 نقشه', oth: '📎 سایر', cat: '📚 کاتالوگ', legacy: '📦 قدیمی / سایت', root: '📎 سایر' };
    var rows = typeof window.ptfRfqAttachmentRows === 'function' ? window.ptfRfqAttachmentRows(r) : [];
    var byGroup = {};
    rows.forEach(function (x) { var g = GROUPS[x.cat] ? x.cat : 'legacy'; (byGroup[g] = byGroup[g] || []).push(x.file || {}); });
    var h = '', n = 0;
    Object.keys(byGroup).forEach(function (g) {
      var fl = byGroup[g]; if (!fl.length) return;
      h += '<div style="font-weight:800;font-size:12.5px;margin:10px 0 6px">' + (GROUPS[g] || GROUPS.legacy) + ' (' + fl.length + ')</div>';
      fl.forEach(function (f) {
        n++;
        var action = f.key && !f.legacyHost
          ? '<button class="bt" style="font-size:11px;padding:4px 12px" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')">مشاهده / دانلود</button>'
          : (f.url && /^(https?:\/\/|blob:|data:image\/|data:application\/pdf)/i.test(f.url) ? '<a class="bt bt-o" target="_blank" rel="noopener" href="' + escP(f.url) + '">مشاهده</a>' : '<small style="color:#d97706">مرجع قدیمی / در صف انتقال</small>');
        h += '<div style="display:flex;justify-content:space-between;align-items:center;border:1px solid var(--brd);border-radius:9px;padding:6px 10px;margin-bottom:5px;font-size:12px">' +
          '<span>' + escP(f.name || 'فایل') + ' <small style="color:#94a3b8">' + escP(f.t || '') + '</small></span>' + action + '</div>';
      });
    });
    var html = '<div class="md-b" style="display:grid;z-index:1500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:92vh;overflow:auto">' +
      '<h3>📎 پیوست‌های درخواست ' + escP(cd) + '</h3>' +
      (h || '<div style="color:#94a3b8;padding:16px;text-align:center">پیوستی ثبت نشده</div>') +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  /* ---------- US-206: مشاهده استعلام متنی ---------- */
  window.rfqShowText = function (cd) {
    var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
    if (!r || !r.inqText) return;
    var html = '<div class="md-b" style="display:grid;z-index:1500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:640px;max-height:92vh;overflow:auto">' +
      '<h3>📝 متن استعلام — ' + escP(cd) + '</h3>' +
      '<div style="font-size:11.5px;color:#94a3b8;margin-bottom:8px">' + escP(r.co || '') + (r.subj ? ' — ' + escP(r.subj) : '') + ' | ثبت: ' + escP(r.dt || '') + '</div>' +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:2.1;white-space:pre-wrap;max-height:55vh;overflow:auto">' + escP(r.inqText) + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.querySelector(\'#panels .md-b:last-child .md div[style*=pre-wrap]\').textContent).then(function(){ptfToast(\'کپی شد\',\'ok\')})">📋 کپی متن</button>' +
      '<button class="bt bt-o" style="color:#7c3aed" onclick="this.closest(\'.md-b\').remove();inqReadOpen(\'' + ptfOnClickArg(cd) + '\')">📖 استخراج اقلام از این متن</button>' +
      '<button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  // افزودن/ویرایش متن استعلام برای درخواست‌های موجود
  window.rfqEditText = function (cd) {
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function (x) { return x.cd === cd; })[0];
    if (!r) return;
    ptfDialog({
      title: '📝 متن استعلام — ' + cd,
      fields: [{ id: 'tx', label: 'متن کامل استعلام دریافتی', type: 'textarea', rows: 8, value: r.inqText || '' }],
      okText: 'ذخیره',
      onOk: function (v) {
        var rfqs2 = getData('ptf_crm_rfqs');
        var r2 = rfqs2.filter(function (x) { return x.cd === cd; })[0];
        r2.inqText = (v.tx || '').trim();
        setData('ptf_crm_rfqs', rfqs2);
        audit('استعلامات', 'ثبت/ویرایش متن استعلام ' + cd, '');
        if (typeof renderRfq === 'function') renderRfq();
        ptfToast('متن استعلام ذخیره شد ✅', 'ok');
      }
    });
  };

  // Sprint 104 Refactoring: جایگزینی تایمر اسکنر با Hook
  window.offInjectRfqButtons = function () {
    try {
      var tb = document.getElementById('rTb');
      if (!tb) return;
      var rfqs = getData('ptf_crm_rfqs');
      tb.querySelectorAll('tr').forEach(function (tr) {
        var strong = tr.querySelector('td strong');
        if (!strong || tr.querySelector('.rfq-att-btn')) return;
        var cd = strong.textContent.trim();
        var r = rfqs.filter(function (x) { return x.cd === cd; })[0];
        if (!r) return;
        var tds = tr.querySelectorAll('td');
        var h = '';
        var cnt = typeof window.ptfRfqAttachmentCount === 'function' ? window.ptfRfqAttachmentCount(r) : 0;
        if (cnt) h += ' <button class="ba rfq-att-btn" data-rfq-action="rfqShowFiles" title="مشاهده پیوست‌ها" aria-label="مشاهده پیوست‌های درخواست" onclick="rfqShowFiles(\'' + ptfOnClickArg(cd) + '\')">📎</button>';
        h += r.inqText
          ? ' <button class="ba rfq-att-btn" data-rfq-action="rfqShowText" style="color:#0e7490" title="مشاهده استعلام متنی" aria-label="مشاهده متن استعلام" onclick="rfqShowText(\'' + ptfOnClickArg(cd) + '\')">📝</button>'
          : ' <button class="ba rfq-att-btn" data-rfq-action="rfqEditText" style="color:#cbd5e1" title="افزودن متن استعلام" aria-label="افزودن متن استعلام" onclick="rfqEditText(\'' + ptfOnClickArg(cd) + '\')">📝</button>';
        if (!cnt && !h) return;
        tds[tds.length - 1].insertAdjacentHTML('beforeend', h);
      });
    } catch (e) {}
  };
  var _olOldRfq = window.renderRfq;
  window.renderRfq = function() { if(_olOldRfq) _olOldRfq(); if(typeof offInjectRfqButtons==='function') offInjectRfqButtons(); };
})();

/* ============ Sprint 115.1 / US-119: پنجره انتخاب چندگانه و نامحدود کالا از کاتالوگ برای پیشنهادها ============ */
window.offOpenProductMultiPicker = function () {
  var prods = getData('ptf_crm_products');
  if (!prods.length) { alert('ابتدا در ماژول کالاها، کالا ثبت کنید.'); return; }
  
  var html = '<div class="md-b" style="display:grid;z-index:1700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
    '<h3>📦 انتخاب چندگانه کالا از ماژول کالاها (کاتالوگ)</h3>' +
    '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px;font-size:12.5px;color:#475569;margin-bottom:12px">' +
    'شما می‌توانید به تعداد <b>نامحدود</b> کالا را با تیک زدن انتخاب کرده و با یک کلیک به جدول اقلام پیشنهاد اضافه کنید.</div>' +
    '<div class="sb2" style="margin-bottom:10px;display:flex;gap:8px">' +
    '<input type="text" id="pPickSrch" placeholder="جستجوی زنده (کد، شرح، دسته، برند، استاندارد)..." oninput="offFilterProductPicker()" style="flex:1;padding:8px 12px;border:1.5px solid var(--brd);border-radius:10px;font-size:13px">' +
    '<button class="bt bt-o" style="padding:6px 12px;font-size:11.5px" onclick="offToggleAllPick(true)">☑ انتخاب همه</button>' +
    '<button class="bt bt-o" style="padding:6px 12px;font-size:11.5px" onclick="offToggleAllPick(false)">☐ لغو انتخاب‌ها</button>' +
    '</div>' +
    '<div class="tb2" style="max-height:380px;overflow-y:auto"><table><thead><tr><th style="width:34px">#</th><th>کد کالا</th><th>شرح کالا</th><th>دسته</th><th>واحد</th><th>قیمت مرجع</th></tr></thead>' +
    '<tbody id="pPickTb"></tbody></table></div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;border-top:1px solid var(--brd);padding-top:12px">' +
    '<span id="pPickCount" style="font-size:12px;color:#0e7490;font-weight:bold">۰ کالا انتخاب شده</span>' +
    '<div style="display:flex;gap:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
    '<button class="bt" style="background:#059669;color:#fff" onclick="offInsertPickedProducts()">➕ درج کالاهای انتخاب‌شده در پیشنهاد</button></div></div></div></div>';
  
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  offRenderProductPicker();
};

window.offRenderProductPicker = function () {
  var prods = getData('ptf_crm_products');
  var tb = document.getElementById('pPickTb');
  if (!tb) return;
  var q = (document.getElementById('pPickSrch')||{}).value || '';
  q = q.trim().toLowerCase();
  
  var list = prods.filter(function(p) {
    if (!q) return true;
    return ((p.cd||'')+' '+(p.nm||'')+' '+(p.en||'')+' '+(p.br||'')+' '+(p.st||'')+' '+(p.ca||'')).toLowerCase().indexOf(q) > -1;
  });
  
  var h = '';
  list.forEach(function(p, idx) {
    var cd = p.cd || '';
    h += '<tr><td><input type="checkbox" class="p-pick-chk" value="' + escP(cd) + '" onchange="offUpdatePickCount()"></td>' +
      '<td><b style="color:#7c3aed;direction:ltr;display:inline-block">' + escP(cd) + '</b></td>' +
      '<td>' + escP(p.nm) + (p.st ? ' <small style="color:#64748b">[' + escP(p.st) + ']</small>' : '') + '</td>' +
      '<td>' + escP(p.ca||'-') + '</td>' +
      '<td>' + escP(p.un||'NO') + '</td>' +
      '<td>' + (+p.pr||0).toLocaleString('fa-IR') + '</td></tr>';
  });
  tb.innerHTML = h || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">کالایی یافت نشد</td></tr>';
  offUpdatePickCount();
};

window.offFilterProductPicker = function() { offRenderProductPicker(); };

window.offToggleAllPick = function(st) {
  document.querySelectorAll('.p-pick-chk').forEach(function(ch) { ch.checked = st; });
  offUpdatePickCount();
};

window.offUpdatePickCount = function() {
  var cnt = document.querySelectorAll('.p-pick-chk:checked').length;
  var el = document.getElementById('pPickCount');
  if (el) el.textContent = cnt.toLocaleString('fa-IR') + ' کالا انتخاب شده';
};

window.offInsertPickedProducts = function() {
  var checked = [];
  document.querySelectorAll('.p-pick-chk:checked').forEach(function(ch) { if (ch.value) checked.push(ch.value); });
  if (!checked.length) { alert('لطفاً حداقل یک کالا را تیک بزنید.'); return; }
  
  var prods = getData('ptf_crm_products');
  var added = 0;
  checked.forEach(function(cd) {
    var p = prods.filter(function(x){ return x.cd === cd; })[0];
    if (p) {
      if (!window._offState.items) window._offState.items = [];
      var newIt = { pcode: p.cd, name: p.nm, unit: p.un || 'NO', qty: 1, price: p.pr || 0, desc: p.st || '-', model: '', brand: p.br || '', dlv: '' };
      if (typeof offSmartInsert === 'function') offSmartInsert(newIt); /* v12.6 US-310: از اولین ردیف خالی */
      else window._offState.items.push(newIt);
      added++;
    }
  });
  
  var md = document.querySelector('#panels .md-b:last-child');
  if (md) md.remove();
  
  if (typeof offRenderItems === 'function') offRenderItems();
  if (typeof ptfToast === 'function') ptfToast('✅ تعداد ' + added + ' قلم کالا با موفقیت به جدول پیشنهاد اضافه شد', 'ok');
  else alert('✅ تعداد ' + added + ' قلم کالا به پیشنهاد اضافه شد');
};

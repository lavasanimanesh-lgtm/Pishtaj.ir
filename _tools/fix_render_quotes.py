import os

repo = "/home/user/pishtaj_project"
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f: of = f.read()

start_idx = of.find("function offRenderItems() {")
end_idx = of.find("function offSetRefPrice(", start_idx)
if start_idx != -1 and end_idx != -1:
    clean_render = """function offRenderItems() {
  var el = (typeof offEl === 'function') ? offEl('offItemsWrap') : document.getElementById('offItemsWrap');
  if (!el || !_offState) return;
  var isCO = _offState.kind === 'CO' || _offState.kind === 'TC';
  var ec = _offState.extraCols || [];
  var ecHead = ec.map(function(c, ci){ return '<th>' + escP(c) + ' <a href="javascript:void(0)" onclick="offDelColumn(' + ci + ')" style="color:#dc2626;font-size:10px">✕</a></th>'; }).join('');
  var head = isCO
    ? '<tr><th>#</th><th>نام کالا (English Item Name)</th><th>شرح تکمیلی</th><th>مدل</th><th>تعداد</th><th>واحد</th><th>برند</th>' + ecHead + '<th style="background:#f5f3ff;color:#5b21b6" title="نرخ مرجع خرید از بانک کالا">نرخ مرجع خرید</th><th style="background:#fef3c7;color:#92400e" title="درصد حاشیه سود">(٪) سود</th><th>قیمت واحد (IRR)</th><th>جمع</th><th>✕</th></tr>'
    : '<tr><th>#</th><th>نام کالا (English Item Name)</th><th>شرح تکمیلی</th><th>مدل</th><th>تعداد</th><th>واحد</th><th>برند</th>' + ecHead + '<th>✕</th></tr>';

  var rows = '';
  _offState.items.forEach(function(it, i) {
    var inp = function(f, w, type) {
      return '<input type="' + (type||'text') + '" value="' + escP(it[f]||'') + '" oninput="offUpdItem(' + i + ',\\\'' + f + '\\\',this.value)" style="width:' + w + ';padding:5px;border:1px solid var(--brd);border-radius:6px;direction:' + (type==='number'?'ltr':'') + ';font-size:12px">';
    };
    var ecCells = ec.map(function(c){
      return '<td><input type="text" value="' + escP((it.extra||{})[c]||'') + '" oninput="offUpdExtra(' + i + ',\\\'' + escP(c) + '\\\',this.value)" style="width:76px;padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px"></td>';
    }).join('');
    
    var bestBuyHtml = '';
    if (isCO && it.inqNo && it.itemIdx != null) {
      try {
        var buys = getData('ptf_crm_order_prices').filter(function (bp) { return bp.inqNo === it.inqNo && bp.itemIdx === it.itemIdx; });
        if (buys.length) {
          var minB = buys.reduce(function (min, b) { return (min === null || +b.irr < +min.irr) ? b : min; }, null);
          if (minB) bestBuyHtml = '<div style="font-size:10px;color:#059669;margin-top:2px">کمترین خرید: ' + (+minB.irr).toLocaleString('fa-IR') + ' ریال (' + escP(minB.sup) + ')</div>';
        }
      } catch (eB) {}
    }

    if (isCO) {
      var _refP = +it.refPrice || +it.refBuyPrice || 0;
      if (!_refP) {
        try {
          var prods = getData('ptf_crm_products');
          var pMatch = prods.filter(function(x){ return (it.prodCd && x.cd === it.prodCd) || x.nm === (it.name || it.desc); })[0];
          if (pMatch && +pMatch.pr > 0) _refP = +pMatch.pr;
        } catch(ePr) {}
      }
      var _mPct = (typeof it.marginPct === 'number') ? it.marginPct : (_refP > 0 && +it.price > 0 ? Math.round(((+it.price / _refP) - 1) * 1000) / 10 : '');
      rows += '<tr><td>' + (i + 1) + '</td><td>' + inp('name', '100%') + '</td><td>' + inp('desc', '100%') + '</td>' +
        '<td>' + inp('model', '86px') + '</td>' +
        '<td>' + inp('qty', '54px', 'number') + '</td><td>' + inp('unit', '50px') + '</td><td>' + inp('brand', '86px') + '</td>' + ecCells +
        '<td style="background:#fcfaff"><input type="number" value="' + (_refP || '') + '" oninput="offUpdRefPrice(' + i + ',this.value)" placeholder="نرخ مرجع" style="width:100px;direction:ltr;background:#f5f3ff;border:1px solid #ddd6fe;font-weight:bold;color:#5b21b6;padding:5px;border-radius:6px"></td>' +
        '<td style="background:#fffef0"><input type="number" value="' + (_mPct) + '" oninput="offUpdMarginPct(' + i + ',this.value)" placeholder="30%" style="width:55px;direction:ltr;background:#fefce8;border:1px solid #fde047;font-weight:bold;color:#b45309;padding:5px;border-radius:6px"></td>' +
        '<td>' + inp('price', '92px', 'number') + bestBuyHtml + '</td><td id="offRT' + i + '" style="white-space:nowrap;font-size:12px;font-weight:bold">' + ((+it.qty||0)*(+it.price||0)).toLocaleString('en-US') + '</td>' +
        '<td><button type="button" onclick="offDelItem(' + i + ')" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td></tr>';
    } else {
      rows += '<tr><td>' + (i + 1) + '</td><td>' + inp('name', '100%') + '</td><td>' + inp('desc', '100%') + '</td>' +
        '<td>' + inp('model', '86px') + '</td>' +
        '<td>' + inp('qty', '54px', 'number') + '</td><td>' + inp('unit', '50px') + '</td><td>' + inp('brand', '86px') + '</td>' + ecCells +
        '<td><button type="button" onclick="offDelItem(' + i + ')" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td></tr>';
    }
  });

  var totalRow = '';
  if (isCO) {
    var total = _offState.items.reduce(function(s, it){ return s + (+it.qty||0)*(+it.price||0); }, 0);
    totalRow = '<tr style="font-weight:bold;background:#fff8f5"><td colspan="' + (8 + ec.length) + '" style="direction:ltr">GRAND TOTAL</td><td id="offGT" style="white-space:nowrap">' + total.toLocaleString('en-US') + '</td><td></td></tr>';
  }

  var globalMarginBar = isCO ? '<div style="display:flex;justify-content:space-between;align-items:center;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 14px;margin-bottom:10px;flex-wrap:wrap;gap:10px">' +
    '<span style="font-size:12.5px;color:#5b21b6">📈 <b>حاشیه سود پیش‌فرض و نرخ مرجع کالا (US-289):</b><br><small style="color:#64748b">درصد سود دلخواه را وارد کرده و دکمه محاسبه را بزنید؛ سیستم قیمت واحد فروش را برای تمام اقلام دارای نرخ مرجع محاسبه می‌کند.</small></span>' +
    '<span style="display:flex;align-items:center;gap:6px"><input type="number" id="ofGlobalMargin" value="30" placeholder="30" style="width:65px;padding:6px;border:1.5px solid #8b5cf6;border-radius:8px;direction:ltr;font-weight:bold;text-align:center"> <b>٪</b> ' +
    '<button type="button" class="bt" style="background:#7c3aed;padding:6px 14px;font-size:12px" onclick="offApplyGlobalMargin()">⚡ محاسبه خودکار قیمت فروش تمام اقلام</button></span></div>' : '';

  el.innerHTML = globalMarginBar + '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead style="background:#f1f5f9">' + head + '</thead><tbody>' + rows + totalRow + '</tbody></table>' +
    (_offState.items.length ? '' : '<div style="color:#94a3b8;text-align:center;padding:14px;font-size:12px">ردیفی ثبت نشده</div>');
}\n\n"""
    of = of[:start_idx] + clean_render + of[end_idx:]
    with open(offers_path, "w", encoding="utf-8") as f: f.write(of)
    print("Updated offRenderItems with clean quotes!")

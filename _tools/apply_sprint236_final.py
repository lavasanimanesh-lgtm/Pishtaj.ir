import os, re

repo = "/home/user/pishtaj_project"

# 1. Update crm/index.html & crm/inqreader.js: Guarantee 👁 مشاهده on every request row
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()

start_rfq = idx.find("function renderRfq() {")
end_rfq = idx.find("updateStats();", start_rfq) + 16
if start_rfq != -1 and end_rfq != -1:
    clean_rfq = """function renderRfq() {
  var rfqs = getData('ptf_crm_rfqs');
  var tb = document.getElementById('rTb');
  if (!tb) return;
  tb.innerHTML = '';
  for (var i = 0; i < rfqs.length; i++) {
    var cdSafe = escP(rfqs[i].cd);
    tb.innerHTML += '<tr><td><strong>' + cdSafe + '</strong></td><td>' + escP(rfqs[i].co) + '</td>' +
      '<td>' + (rfqs[i].ca||'-') + '</td><td>' + (rfqs[i].dt||'—') + '</td>' +
      '<td><span class="bd b-' + (rfqs[i].st||'st1') + '">' + (rfqs[i].stxt||'دریافت اولیه') + '</span></td>' +
      '<td><button class="ba" style="color:#0f172a;font-weight:bold" onclick="ptfViewRfq(\'' + cdSafe + '\')">👁 مشاهده</button> <button class="ba" onclick="editRfq(\'' + cdSafe + '\')">✎ ویرایش/حذف</button></td></tr>';
  }
  updateStats();
}"""
    idx = idx[:start_rfq] + clean_rfq + idx[end_rfq:]
    with open(index_path, "w", encoding="utf-8") as f: f.write(idx)
    print("Updated crm/index.html: renderRfq() guarantees 👁 مشاهده right out of the box!")

inq_path = os.path.join(repo, "crm/inqreader.js")
with open(inq_path, "r", encoding="utf-8") as f: inq = f.read()

start_patch = inq.find("function patchRenderRfq() {")
end_patch = inq.find("return true;\n  }", start_patch) + 14
if start_patch != -1 and end_patch != -1:
    clean_patch = """function patchRenderRfq() {
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
          
          var hasOffer = offers.some(function(o){ return o.inqNo === cd || o.inqNo === r.inqNo; });
          var wonOffer = offers.filter(function(o){ return (o.inqNo === cd || o.inqNo === r.inqNo) && o.st === 'won'; })[0];
          var lastTd = tr.querySelectorAll('td');
          var tdEl = lastTd[lastTd.length - 1];
          if (!tdEl) return;
          
          var viewBtn = '<button class="ba" style="color:#0f172a;font-weight:bold" onclick="ptfViewRfq(\'' + escP(cd) + '\')">👁 مشاهده</button> ';
          var hasView = tdEl.innerHTML.indexOf('ptfViewRfq') > -1;
          
          if (wonOffer) {
            tdEl.innerHTML = (hasView ? '' : viewBtn) +
              '<span class="bd" style="background:#fef3c7;color:#b45309;font-size:11px">🏆 منتقل‌شده به پروژه (قفل کامل)</span> ' +
              '<button class="ba" style="background:#7c3aed;color:#fff" onclick="goPanel(\'prj\')">📁 مشاهده پروژه</button> ' +
              '<button class="ba" onclick="editRfq(\'' + escP(cd) + '\')">✎ ویرایش</button>';
          } else if (hasOffer) {
            tdEl.innerHTML = (hasView ? '' : viewBtn) +
              '<span class="bd" style="background:#f1f5f9;color:#64748b;font-size:10.5px">🔒 مشخصات قفل شد (پیشنهاد صادر شده)</span> ' +
              '<button class="ba inqrd-btn" style="color:#0e7490;font-weight:bold" onclick="ptfManageInqAttachments(\'' + escP(cd) + '\')">📎 مدیریت پیوست‌ها</button> ' +
              '<button class="ba" onclick="editRfq(\'' + escP(cd) + '\')">✎ ویرایش</button>';
          } else {
            if (!hasView) tdEl.insertAdjacentHTML('afterbegin', viewBtn);
            if (rfqHasReadable(r) && !tdEl.innerHTML.includes('inqReadOpen')) {
              tdEl.insertAdjacentHTML('beforeend', ' <button class="ba inqrd-btn" style="color:#7c3aed" onclick="inqReadOpen(\'' + escP(cd) + '\')">📖 خواندن فایل استعلام</button>');
            }
            if (!tdEl.innerHTML.includes('ptfManageInqAttachments')) {
              tdEl.insertAdjacentHTML('beforeend', ' <button class="ba" style="color:#0e7490" onclick="ptfManageInqAttachments(\'' + escP(cd) + '\')">📎 پیوست‌ها</button>');
            }
          }
        });
      } catch (e) {}
    };
    return true;
  }"""
    inq = inq[:start_patch] + clean_patch + inq[end_patch:]
    with open(inq_path, "w", encoding="utf-8") as f: f.write(inq)
    print("Updated crm/inqreader.js: safe view button patching!")

# 2. Update crm/offers.js: Non-blocking offerSave + Complete Profit Margin & Reference Price Item Columns + Global Margin Calculator
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f: of = f.read()

# Non-blocking offerSave check
start_save = of.find("function offerSave() {")
end_save = of.find("o.dateEn = (typeof ptfJToISO", start_save)
if start_save != -1 and end_save != -1:
    clean_save_hdr = """function offerSave() {
  var o = _offState;
  if (!o) { alert('⛔ اطلاعات پیشنهاد در حافظه یافت نشد'); return; }
  var _savedLock = getData('ptf_crm_offers').filter(function (x) { return x.no === o.no; })[0];
  if (offerPostAwardLocked(_savedLock)) { alert('🔒 پیشنهاد برنده پس از تشکیل پرونده فروش قابل ذخیره/ویرایش نیست. ادامه فرایند از پرونده فروش انجام می‌شود.'); if (typeof ptfGoSalesFileForOffer === 'function') ptfGoSalesFileForOffer(o.no); return; }
  
  var buyerEl = document.getElementById('ofBuyer');
  o.buyerCd = buyerEl ? buyerEl.value : (o.buyerCd || '');
  var _legacyInq = (getData('ptf_crm_offers').filter(function (x) { return x.no === o.no; })[0] || {}).inqNo || '';
  var inqEl = document.getElementById('ofInq');
  o.inqNo = inqEl ? inqEl.value.trim() : (o.inqNo || '');
  
  // US-175 / US-289: ثبت خودکار شماره استعلام در صورت وارد شدن دستی تا دکمه ذخیره هرگز متوقف نشود
  if (o.inqNo && typeof ptfInqNoValid === 'function' && !ptfInqNoValid(o.inqNo, _legacyInq)) {
    try {
      var rfqs = getData('ptf_crm_rfqs');
      if (!rfqs.some(function(x){ return x.cd === o.inqNo || x.inqNo === o.inqNo; })) {
        rfqs.unshift({ cd: o.inqNo, inqNo: o.inqNo, co: o.buyerCo || 'مشتری استعلام', st: 'st1', stxt: '🔴 دریافت اولیه', dt: (typeof faDate === 'function' ? faDate() : '') });
        setData('ptf_crm_rfqs', rfqs);
      }
    } catch(eInqAuto) {}
  }\n  """
    of = of[:start_save] + clean_save_hdr + of[end_save:]
    print("Updated offerSave with non-blocking inqNo and safe element checks!")

margin_funcs = """/* ============ US-289 (Sprint 236): حاشیه سود پیش‌فرض و نرخ مرجع کالا برای تک‌تک اقلام پیشنهاد مالی ============ */
window.offApplyGlobalMargin = function () {
  var o = window._offState;
  if (!o || !o.items) return;
  var gmEl = document.getElementById('ofGlobalMargin');
  var margin = gmEl ? (+gmEl.value || 0) : 30;
  var prods = getData('ptf_crm_products');
  var updatedCount = 0;
  o.items.forEach(function (it, i) {
    var refP = +it.refPrice || +it.refBuyPrice || 0;
    if (!refP) {
      var p = prods.filter(function (x) { return (it.prodCd && x.cd === it.prodCd) || x.nm === (it.name || it.desc); })[0];
      if (p && +p.pr > 0) refP = +p.pr;
    }
    if (refP > 0) {
      it.refPrice = refP;
      it.marginPct = margin;
      it.price = Math.round(refP * (1 + margin / 100));
      updatedCount++;
    } else if (!it.marginPct) {
      it.marginPct = margin;
    }
  });
  offRenderItems();
  if (typeof ptfToast === 'function') ptfToast('⚡ حاشیه سود ' + margin + '٪ برای ' + updatedCount + ' قلم دارای نرخ مرجع محاسبه و اعمال شد', 'ok');
};

window.offUpdRefPrice = function (i, val) {
  var o = window._offState;
  if (!o || !o.items || !o.items[i]) return;
  var it = o.items[i];
  it.refPrice = +val || 0;
  if (it.refPrice > 0 && typeof it.marginPct === 'number') {
    it.price = Math.round(it.refPrice * (1 + it.marginPct / 100));
  } else if (it.refPrice > 0 && +it.price > 0) {
    it.marginPct = Math.round(((+it.price / it.refPrice) - 1) * 1000) / 10;
  }
  offRenderItems();
};

window.offUpdMarginPct = function (i, val) {
  var o = window._offState;
  if (!o || !o.items || !o.items[i]) return;
  var it = o.items[i];
  it.marginPct = +val || 0;
  var refP = +it.refPrice || +it.refBuyPrice || 0;
  if (!refP) {
    var prods = getData('ptf_crm_products');
    var p = prods.filter(function (x) { return (it.prodCd && x.cd === it.prodCd) || x.nm === (it.name || it.desc); })[0];
    if (p && +p.pr > 0) refP = +p.pr;
    if (refP > 0) it.refPrice = refP;
  }
  if (refP > 0) {
    it.price = Math.round(refP * (1 + it.marginPct / 100));
    offRenderItems();
  }
};
"""

start_render_items = of.find("function offRenderItems() {")
end_render_items = of.find("window.offSetRefPrice = function", start_render_items)
if start_render_items != -1 and end_render_items != -1:
    clean_render_items = """function offRenderItems() {
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
      return '<input type="' + (type||'text') + '" value="' + escP(it[f]||'') + '" oninput="offUpdItem(' + i + ',\'' + f + '\',this.value)" style="width:' + w + ';padding:5px;border:1px solid var(--brd);border-radius:6px;direction:' + (type==='number'?'ltr':'') + ';font-size:12px">';
    };
    var ecCells = ec.map(function(c){
      return '<td><input type="text" value="' + escP((it.extra||{})[c]||'') + '" oninput="offUpdExtra(' + i + ',\'' + escP(c) + '\',this.value)" style="width:76px;padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px"></td>';
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
    of = of[:start_render_items] + margin_funcs + clean_render_items + of[end_render_items:]
    with open(offers_path, "w", encoding="utf-8") as f: f.write(of)
    print("Updated crm/offers.js: offRenderItems equipped with refPrice and marginPct columns + Global margin bar!")


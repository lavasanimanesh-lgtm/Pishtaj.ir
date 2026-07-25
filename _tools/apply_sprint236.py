import os, re

repo = "/home/user/pishtaj_project"

# 1. Update crm/index.html & crm/inqreader.js: Guarantee 👁 مشاهده on every request row
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()

old_rfq_block = re.search(r"function renderRfq\(\) \{[\s\S]*?updateStats\(\);\s*\}", idx)
if old_rfq_block:
    clean_rfq_block = """function renderRfq() {
  var rfqs = getData('ptf_crm_rfqs');
  var tb = document.getElementById('rTb');
  if (!tb) return;
  tb.innerHTML = '';
  for (var i = 0; i < rfqs.length; i++) {
    tb.innerHTML += '<tr><td><strong>' + escP(rfqs[i].cd) + '</strong></td><td>' + escP(rfqs[i].co) + '</td>' +
      '<td>' + (rfqs[i].ca||'-') + '</td><td>' + (rfqs[i].dt||'—') + '</td>' +
      '<td><span class="bd b-' + (rfqs[i].st||'st1') + '">' + (rfqs[i].stxt||'دریافت اولیه') + '</span></td>' +
      '<td><button class="ba" style="color:#0f172a;font-weight:bold" onclick="ptfViewRfq(\'' + escP(rfqs[i].cd) + '\')">👁 مشاهده</button> <button class="ba" onclick="editRfq(\'' + escP(rfqs[i].cd) + '\')">✎ ویرایش/حذف</button></td></tr>';
  }
  updateStats();
}"""
    idx = idx.replace(old_rfq_block.group(0), clean_rfq_block)
    with open(index_path, "w", encoding="utf-8") as f: f.write(idx)
    print("Updated crm/index.html: renderRfq() now guarantees 👁 مشاهده right out of the box!")

inq_path = os.path.join(repo, "crm/inqreader.js")
with open(inq_path, "r", encoding="utf-8") as f: inq = f.read()

patch_func_old = re.search(r"function patchRenderRfq\(\) \{[\s\S]*?return true;\s*\}", inq)
if patch_func_old:
    patch_func_new = """function patchRenderRfq() {
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
          if (!strong || tr.querySelector('.inqrd-btn')) return;
          var cd = strong.textContent.trim();
          var r = rfqs.filter(function (x) { return x.cd === cd; })[0];
          if (!r) return;
          
          var hasOffer = offers.some(function(o){ return o.inqNo === cd || o.inqNo === r.inqNo; });
          var wonOffer = offers.filter(function(o){ return (o.inqNo === cd || o.inqNo === r.inqNo) && o.st === 'won'; })[0];
          var lastTd = tr.querySelectorAll('td');
          var tdEl = lastTd[lastTd.length - 1];
          if (!tdEl) return;
          
          var viewBtn = '<button class="ba" style="color:#0f172a;font-weight:bold" onclick="ptfViewRfq(\\\'' + escP(cd) + '\\\')\">👁 مشاهده</button> ';
          var hasView = tdEl.innerHTML.indexOf('ptfViewRfq') > -1;
          
          if (wonOffer) {
            tdEl.innerHTML = (hasView ? '' : viewBtn) +
              '<span class="bd" style="background:#fef3c7;color:#b45309;font-size:11px">🏆 منتقل‌شده به پروژه (قفل کامل)</span> ' +
              '<button class="ba" style="background:#7c3aed;color:#fff" onclick="goPanel(\\\'prj\\\')">📁 مشاهده پروژه</button> ' +
              '<button class="ba" onclick="editRfq(\\\'' + escP(cd) + '\\\')\">✎ ویرایش</button>';
          } else if (hasOffer) {
            tdEl.innerHTML = (hasView ? '' : viewBtn) +
              '<span class="bd" style="background:#f1f5f9;color:#64748b;font-size:10.5px">🔒 مشخصات قفل شد (پیشنهاد صادر شده)</span> ' +
              '<button class="ba inqrd-btn" style="color:#0e7490;font-weight:bold" onclick="ptfManageInqAttachments(\\\'' + escP(cd) + '\\\')\">📎 پیوست‌ها</button> ' +
              '<button class="ba" onclick="editRfq(\\\'' + escP(cd) + '\\\')\">✎ ویرایش</button>';
          } else {
            if (!hasView) tdEl.insertAdjacentHTML('afterbegin', viewBtn);
            if (rfqHasReadable(r) && !tdEl.innerHTML.includes('inqReadOpen')) {
              tdEl.insertAdjacentHTML('beforeend', ' <button class="ba inqrd-btn" style="color:#7c3aed" onclick="inqReadOpen(\\\'' + escP(cd) + '\\\')\">📖 خواندن فایل استعلام</button>');
            }
            if (!tdEl.innerHTML.includes('ptfManageInqAttachments')) {
              tdEl.insertAdjacentHTML('beforeend', ' <button class="ba" style="color:#0e7490" onclick="ptfManageInqAttachments(\\\'' + escP(cd) + '\\\')\">📎 پیوست‌ها</button>');
            }
          }
        });
      } catch (e) {}
    };
    return true;
  }"""
    inq = inq.replace(patch_func_old.group(0), patch_func_new)
    with open(inq_path, "w", encoding="utf-8") as f: f.write(inq)
    print("Updated crm/inqreader.js: safe, non-wiping view button injection in patchRenderRfq!")

# 2. Update crm/offers.js: Null-safety and profit margin + refPrice columns
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f: of = f.read()

new_save_hdr = """function offerSave() {
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
  }"""

of = re.sub(r"function offerSave\(\) \{[\s\S]*?alert\('⛔ شماره درخواست کارفرما باید از فهرست انتخاب شود[\s\S]*?return;\s*\}", new_save_hdr, of)

margin_funcs = """
/* ============ US-289 (Sprint 236): حاشیه سود پیش‌فرض و نرخ مرجع کالا برای تک‌تک اقلام پیشنهاد مالی ============ */
window.offApplyGlobalMargin = function () {
  var o = window._offState;
  if (!o || !o.items) return;
  var gmEl = document.getElementById('ofGlobalMargin');
  var margin = gmEl ? (+gmEl.value || 0) : 30;
  var prods = getData('ptf_crm_products');
  var updatedCount = 0;
  o.items.forEach(function (it, i) {
    var refP = +it.refPrice || 0;
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
  var refP = +it.refPrice || 0;
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

if "window.offApplyGlobalMargin =" not in of:
    of = of.replace("function offRenderItems() {", margin_funcs + "\nfunction offRenderItems() {")

new_off_render_th = """var thead = isCO
    ? '<tr><th style="width:3%">#</th><th>شرح کالا (English Item Name)</th><th style="width:7%">واحد</th><th style="width:6%">تعداد</th><th style="width:10%">برند</th><th style="width:10%">مدل</th>' + ecTh + '<th style="width:13%;background:#f5f3ff;color:#5b21b6" title="نرخ خرید مرجع کالا از بانک کالا">نرخ مرجع خرید</th><th style="width:8%;background:#fef3c7;color:#92400e" title="درصد حاشیه سود">(٪) سود</th><th style="width:13%">قیمت واحد فروش (IRR)</th><th style="width:13%">جمع فروش (IRR)</th><th style="width:3%">✕</th></tr>'
    : '<tr><th style="width:3%">#</th><th style="width:16%">شرح کالا (English Item Name)</th><th style="width:7%">واحد</th><th style="width:7%">تعداد</th><th style="width:11%">برند</th><th style="width:13%">مدل</th>' + ecTh + '<th>مشخصات تکمیلی (Description)</th><th style="width:3%">✕</th></tr>';"""

of = re.sub(r"var thead = isCO[\s\S]*?<th style=\"width:3%\">✕</th></tr>';", new_off_render_th, of)

new_row_co = """if (isCO) {
      var _refP = +it.refPrice || 0;
      var _mPct = (typeof it.marginPct === 'number') ? it.marginPct : (_refP > 0 && +it.price > 0 ? Math.round(((+it.price / _refP) - 1) * 1000) / 10 : '');
      tbody += '<tr' + (_isE ? ' style="background:#fffbeb"' : '') + '><td class="num">' + (i+1) + _dragH + '</td>' +
        '<td><div style="display:flex;gap:4px">' + _pbtn + '<input type="text" value="' + escP(it.name||it.desc||'') + '" oninput="offUpd(' + i + ',\'name\',this.value)" placeholder="e.g. Gate Valve 4 inch CL1500" style="direction:ltr"></div>' +
        (it.desc && it.name ? '<input type="text" value="' + escP(it.desc) + '" oninput="offUpd(' + i + ',\'desc\',this.value)" placeholder="شرح تکمیلی" style="margin-top:3px;font-size:11px;color:#555">' : '') + '</td>' +
        '<td><input type="text" value="' + escP(it.unit||'NO') + '" oninput="offUpd(' + i + ',\'unit\',this.value)" style="width:50px"></td>' +
        '<td><input type="number" value="' + (it.qty||0) + '" oninput="offUpd(' + i + ',\'qty\',this.value)" style="width:55px;direction:ltr"></td>' +
        '<td><input type="text" value="' + escP(it.brand||'') + '" oninput="offUpd(' + i + ',\'brand\',this.value)" placeholder="برند" style="width:80px"></td>' +
        '<td><input type="text" value="' + escP(it.model||'') + '" oninput="offUpd(' + i + ',\'model\',this.value)" placeholder="مدل" style="width:80px"></td>' + ecTd +
        '<td style="background:#fcfaff"><input type="number" value="' + (_refP || '') + '" oninput="offUpdRefPrice(' + i + ',this.value)" placeholder="نرخ مرجع" style="width:100px;direction:ltr;background:#f5f3ff;border-color:#ddd6fe;font-weight:bold;color:#5b21b6"></td>' +
        '<td style="background:#fffef0"><input type="number" value="' + (_mPct) + '" oninput="offUpdMarginPct(' + i + ',this.value)" placeholder="30%" style="width:55px;direction:ltr;background:#fefce8;border-color:#fde047;font-weight:bold;color:#b45309"></td>' +
        '<td><input type="number" value="' + (+it.price||0) + '" oninput="offUpd(' + i + ',\'price\',this.value);var _rp=+(_offState.items[' + i + '].refPrice||0);if(_rp>0){_offState.items[' + i + '].marginPct=Math.round(((+this.value/_rp)-1)*1000)/10;}" style="width:105px;direction:ltr;font-weight:bold;color:#059669"></td>' +
        '<td class="num" style="font-weight:bold">' + ((+it.qty||0)*(+it.price||0)).toLocaleString('fa-IR') + ' ریال</td>' +
        '<td>' + _dbtn + '</td></tr>';"""

of = re.sub(r"if \(isCO\) \{\s*tbody \+= '<tr' \+ \(_isE \? ' style=\"background:#fffbeb\"' : ''\) \+ '<td class=\"num\">'[\s\S]*?'<td>' \+ _dbtn \+ '</td></tr>';", new_row_co, of)

of = of.replace("colspan=\"' + (6 + ec.length) + '\"", "colspan=\"' + (8 + ec.length) + '\"")

new_items_box_hdr = """(o.kind !== 'TO' ? '<div style="display:flex;justify-content:space-between;align-items:center;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 14px;margin-top:14px;flex-wrap:wrap;gap:10px">' +
      '<span style="font-size:12.5px;color:#5b21b6">📈 <b>حاشیه سود پیش‌فرض و نرخ مرجع کالا (US-289):</b><br><small style="color:#64748b">درصد سود دلخواه را وارد کرده و دکمه محاسبه را بزنید؛ سیستم قیمت واحد فروش را برای تمام اقلام دارای نرخ مرجع محاسبه می‌کند.</small></span>' +
      '<span style="display:flex;align-items:center;gap:6px"><input type="number" id="ofGlobalMargin" value="30" placeholder="30" style="width:65px;padding:6px;border:1.5px solid #8b5cf6;border-radius:8px;direction:ltr;font-weight:bold;text-align:center"> <b>٪</b> ' +
      '<button type="button" class="bt" style="background:#7c3aed;padding:6px 14px;font-size:12px" onclick="offApplyGlobalMargin()">⚡ محاسبه خودکار قیمت فروش تمام اقلام</button></span></div>' : '') +
    '<div class="tb2" style="margin-top:8px"><table><thead>' + thead + '</thead><tbody id="offItemsTb"></tbody></table></div>' +"""

of = re.sub(r"'<div class=\"tb2\" style=\"margin-top:14px\"><table><thead>' \+ thead \+ '</thead><tbody id=\"offItemsTb\"></tbody></table></div>' \+", new_items_box_hdr, of)

with open(offers_path, "w", encoding="utf-8") as f: f.write(of)
print("Updated crm/offers.js: US-289 Profit Margin & Reference Price columns + non-blocking offerSave!")


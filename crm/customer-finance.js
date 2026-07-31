/* =====================================================================
   PTF CRM — Sprint 283
   Customer accounts: derived read-only balances, searchable and ordered.
   No account balance is persisted here; invoices remain the source of truth.
   ===================================================================== */
(function () {
  'use strict';
  function m(v) { return (+v || 0).toLocaleString('fa-IR'); }
  function active(v) { return v && v.status !== 'void' && v.st !== 'void' && v.void !== true; }
  function cust(cd) { return getData('ptf_crm_customers').filter(function (c) { return c.cd === cd; })[0]; }
  function nameOf(c) { return (c && (c.co || c.name || c.cd)) || ''; }
  function invs(cd) {
    var offers = getData('ptf_crm_offers');
    return getData('ptf_crm_invoices').filter(function (i) {
      if (!active(i)) return false;
      if (typeof ptfCanSeeLedger === 'function' ? !ptfCanSeeLedger('unofficial') : (typeof curRole === 'function' && curRole() === 'accountant')) { if (i.isUnofficial) return false; }
      var o = offers.filter(function (x) { return x.no === i.offerNo; })[0] || {};
      return o.buyerCd === cd;
    });
  }
  function paid(i) {
    return (i.payments || []).concat(i.pays || []).filter(active).reduce(function (s, p) { return s + (+p.amt || +p.amount || 0); }, 0);
  }
  function salesReturnsForInvoice(invoiceCd) { return getData('ptf_crm_sales_returns').filter(function (r) { return r.invoiceCd === invoiceCd && r.status !== 'void'; }); }
  function returnedAmount(invoiceCd) { return salesReturnsForInvoice(invoiceCd).reduce(function (s, r) { return s + (+r.totalAmount || 0); }, 0); }
  function creditAmountForInvoice(invoice) { return Math.max(0, paid(invoice) + returnedAmount(invoice.cd) - (+invoice.amount || 0)); }
  function creditForCustomer(cd) { return invs(cd).reduce(function (s, i) { return s + creditAmountForInvoice(i); }, 0); }
  function bal(cd) { return invs(cd).reduce(function (s, i) { return s + Math.max(0, (+i.amount || 0) - paid(i) - returnedAmount(i.cd)); }, 0); }
  function norm(v) { return String(v || '').trim().toLowerCase(); }

  /* Useful to UI and deterministic tests; it never writes to localStorage. */
  window.cfAccountRows = function (query) {
    var q = norm(query == null ? window._cfSearch : query);
    return getData('ptf_crm_customers').map(function (c) {
      return { cd: c.cd, co: nameOf(c), balance: bal(c.cd), credit: creditForCustomer(c.cd) };
    }).filter(function (r) {
      return !q || norm(r.co).indexOf(q) > -1 || norm(r.cd).indexOf(q) > -1;
    }).sort(function (a, b) {
      var aOpen = Math.abs(a.balance) > 0.000001, bOpen = Math.abs(b.balance) > 0.000001;
      if (aOpen !== bOpen) return aOpen ? -1 : 1; /* non-zero accounts always first */
      if (aOpen && Math.abs(a.balance) !== Math.abs(b.balance)) return Math.abs(b.balance) - Math.abs(a.balance);
      return String(a.co).localeCompare(String(b.co), 'fa');
    });
  };

  window.cfSalesReturnPreview = function (invoiceCd) {
    var inv = getData('ptf_crm_invoices').filter(function (x) { return x.cd === invoiceCd; })[0];
    if (!inv) return;
    var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {}, items = offer.items || [];
    var priorReturns = salesReturnsForInvoice(inv.cd);
    function priorQty(idx) { return priorReturns.reduce(function (sum, r) { return sum + (r.items || []).filter(function (x) { return +x.idx === +idx; }).reduce(function (s, x) { return s + (+x.qty || 0); }, 0); }, 0); }
    if (!items.length) { alert('برای این فاکتور خطوط کالا پیدا نشد.'); return; }
    var rows = items.map(function (it, idx) { var totalQty=+it.qty||1, available=Math.max(0,totalQty-priorQty(idx)); return '<label style="display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px dashed #e2e8f0;opacity:' + (available ? '1' : '.55') + '"><input type="checkbox" class="cfReturnLine" value="' + idx + '"' + (available ? '' : ' disabled') + '><span style="flex:1"><b>' + escP(it.name || it.nm || it.desc || 'قلم ' + (idx + 1)) + '</b><small style="display:block;color:#64748b">فاکتور: ' + totalQty + ' ' + escP(it.unit || it.un || '') + ' | قابل مرجوعی: ' + available + '</small></span><input class="cfReturnQty" data-idx="' + idx + '" type="number" min="0" max="' + available + '" value="' + (available || 0) + '"' + (available ? '' : ' disabled') + ' style="width:90px;direction:ltr"></label>'; }).join('');
    var html = '<div class="md-b" id="cfReturnDlg" style="display:grid;z-index:3200" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px;max-height:90vh;overflow:auto"><h3>↩️ پیش‌نمایش مرجوعی فاکتور ' + escP(inv.no || inv.cd) + '</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 11px;font-size:12px;margin-bottom:9px">در این مرحله فقط خطوط قابل انتخاب و مقدار پیشنهادی نمایش داده می‌شود؛ هیچ سند یا مبلغی ذخیره نمی‌شود.</div><div>' + rows + '</div><div class="fr" style="margin-top:10px"><div class="fld"><label>دلیل مرجوعی *</label><select id="cfReturnReason"><option value="">— انتخاب کنید —</option><option>عدم تأیید مشتری</option><option>عدم نیاز مشتری</option><option>مغایرت فنی/کیفی</option><option>مقدار اضافی یا اشتباه</option><option>لغو یا تغییر پروژه</option><option>درخواست مشتری</option><option>سایر</option></select></div><div class="fld"><label>سرنوشت کالا</label><select id="cfReturnDisposition"><option value="stock">ورود به موجودی</option><option value="supplier">برگشت به تأمین‌کننده</option><option value="quarantine">قرنطینه/بازرسی</option><option value="scrap">ضایعات</option></select></div></div><div class="fld"><label>توضیح تکمیلی</label><textarea id="cfReturnNote" rows="2"></textarea></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button><button class="bt" onclick="cfSalesReturnPreviewSelected(\'' + escP(invoiceCd) + '\')">ثبت مرجوعی</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.cfSalesReturnPreviewSelected = function (invoiceCd) {
    var selected = [];
    document.querySelectorAll('#cfReturnDlg .cfReturnLine:checked').forEach(function (el) { var q = document.querySelector('#cfReturnDlg .cfReturnQty[data-idx="' + el.value + '"]'); selected.push({ idx: +el.value, qty: +(q && q.value) || 0 }); });
    var reason = ((document.getElementById('cfReturnReason') || {}).value || '').trim();
    var disposition = ((document.getElementById('cfReturnDisposition') || {}).value || 'stock');
    var note = ((document.getElementById('cfReturnNote') || {}).value || '').trim();
    if (!selected.length || selected.some(function (x) { return x.qty <= 0; }) || !reason) { alert('حداقل یک قلم، مقدار معتبر و دلیل مرجوعی الزامی است.'); return; }
    var inv = getData('ptf_crm_invoices').filter(function (x) { return x.cd === invoiceCd; })[0] || {};
    var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {};
    var gross = (offer.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0) || 1;
    if ((offer.items || []).length === 1) {
      var expectedBase = (+offer.items[0].qty || 1) * (+offer.items[0].price || 0);
      var recordedBase = inv.base != null ? (+inv.base || 0) : (+inv.amount || 0);
      if (expectedBase > 0 && Math.abs(recordedBase - expectedBase) > 1) {
        alert('⚠️ مبلغ فاکتور با خط فاکتور سازگار نیست.\nمبلغ ثبت‌شده: ' + recordedBase.toLocaleString('fa-IR') + ' ریال\nمجموع خط: ' + expectedBase.toLocaleString('fa-IR') + ' ریال\nابتدا فاکتور را اصلاح کنید؛ مرجوعی ثبت نشد.');
        return;
      }
    }
    var totalAmount = selected.reduce(function (sum, x) { var it = (offer.items || [])[x.idx] || {}; return sum + ((+inv.amount || 0) * (((+it.qty || 0) * (+it.price || 0)) / gross) * x.qty / (+it.qty || 1)); }, 0);
    var returns = getData('ptf_crm_sales_returns') || [];
    var deal = getData('ptf_crm_deals').filter(function (d) { return d.wonOffer === (offer.no || inv.offerNo); })[0] || {};
    var returnRecord = { cd: genCode('SRET'), invoiceCd: invoiceCd, customerCd: offer.buyerCd || '', dealCd: deal.cd || '', offerNo: offer.no || inv.offerNo || '', items: selected.map(function (x) { var it = (offer.items || [])[x.idx] || {}; return { idx: x.idx, lineKey: it.sourceItemKey || it.pcode || it.prodCd || '', productCd: it.pcode || it.prodCd || '', item: it.name || it.nm || it.desc || '', qty: x.qty }; }), totalAmount: Math.round(totalAmount), creditAmount: Math.max(0, paid(inv) + returnedAmount(invoiceCd) + Math.round(totalAmount) - (+inv.amount || 0)), reason: reason, disposition: disposition, note: note, status: 'approved', t: faDateTime(), by: curSession().name };
    returns.unshift(returnRecord);
    setData('ptf_crm_sales_returns', returns);
    if (disposition === 'stock') {
      var stockRefs = [], stockPending = [];
      returnRecord.items.forEach(function (item) {
        var productCd = item.productCd || '';
        if (!productCd) {
          var normProduct = function (v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase(); };
          var product = getData('ptf_crm_products').filter(function (p) { return normProduct(p.nm || p.name || p.cd) === normProduct(item.item); })[0];
          if (product) productCd = product.cd;
        }
        if (productCd && typeof ptfSurplusAdd === 'function') {
          var stock = ptfSurplusAdd(productCd, item.qty, 'انبار', returnRecord.dealCd || returnRecord.offerNo, 'ورود از مرجوعی فروش ' + returnRecord.cd + ' — ' + item.item);
          if (stock) stockRefs.push(stock.cd); else stockPending.push(item.item);
        } else stockPending.push(item.item);
      });
      returnRecord.stockRefs = stockRefs;
      returnRecord.stockStatus = stockPending.length ? 'pending_product_definition' : 'stocked';
      returnRecord.stockPendingItems = stockPending;
      setData('ptf_crm_sales_returns', returns);
    }
    try { audit('مرجوعی فروش', 'ثبت مرجوعی فاکتور ' + (inv.no || invoiceCd) + ' — ' + Math.round(totalAmount).toLocaleString('fa-IR') + ' ریال', invoiceCd); } catch (e) {}
    var dlg = document.getElementById('cfReturnDlg'); if (dlg) dlg.remove();
    var accountDlg = document.getElementById('cfAccountDlg'); if (accountDlg) accountDlg.remove();
    if (typeof ptfToast === 'function') ptfToast(returnRecord.stockPendingItems && returnRecord.stockPendingItems.length ? 'مرجوعی ثبت شد، اما برخی اقلام در کاتالوگ کالا پیدا نشدند و به موجودی نرفتند.' : 'مرجوعی ثبت شد؛ مطالبات مشتری و موجودی به‌روزرسانی شد.', returnRecord.stockPendingItems && returnRecord.stockPendingItems.length ? 'warn' : 'ok');
    var offerCustomer = offer.buyerCd; if (offerCustomer) cfOpen(offerCustomer);
  };
  window.cfSalesReturnStockRetry = function (returnCd) {
    var returns = getData('ptf_crm_sales_returns') || [], rtn = returns.filter(function (x) { return x.cd === returnCd; })[0];
    if (!rtn || rtn.disposition !== 'stock') return;
    var inv = getData('ptf_crm_invoices').filter(function (x) { return x.cd === rtn.invoiceCd; })[0] || {}, products = getData('ptf_crm_products') || [], stockRefs = rtn.stockRefs || [], pending = [];
    function normProduct(v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase(); }
    (rtn.items || []).forEach(function (item) {
      if (stockRefs.length && stockRefs.some(function (cd) { return String(cd).indexOf(returnCd) > -1; })) return;
      var productCd = item.productCd || '', product = products.filter(function (p) { return p.cd === productCd || normProduct(p.nm || p.name || p.cd) === normProduct(item.item); })[0];
      if (!product || typeof ptfSurplusAdd !== 'function') { pending.push(item.item); return; }
      var existing = (typeof ptfSurplusAll === 'function' ? ptfSurplusAll() : []).filter(function (s) { return String(s.note || '').indexOf(returnCd) > -1 && s.prodCd === product.cd; })[0];
      if (existing) { if (stockRefs.indexOf(existing.cd) < 0) stockRefs.push(existing.cd); return; }
      var stock = ptfSurplusAdd(product.cd, item.qty, 'انبار', rtn.dealCd || rtn.offerNo, 'ورود از مرجوعی فروش ' + returnCd + ' — ' + item.item);
      if (stock) stockRefs.push(stock.cd); else pending.push(item.item);
    });
    rtn.stockRefs = stockRefs; rtn.stockPendingItems = pending; rtn.stockStatus = pending.length ? 'pending_product_definition' : 'stocked';
    setData('ptf_crm_sales_returns', returns);
    if (typeof ptfToast === 'function') ptfToast(pending.length ? 'برخی اقلام هنوز کالا ندارند.' : 'ورود مرجوعی به موجودی تکمیل شد.', pending.length ? 'warn' : 'ok');
    if (inv.offerNo) { var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {}; if (offer.buyerCd) cfOpen(offer.buyerCd); }
  };
  window.cfOpen = function (cd) {
    var c = cust(cd); if (!c) return;
    var rows = invs(cd).map(function (i) {
      var ps = (i.payments || []).concat(i.pays || []).filter(active), r = Math.max(0, (+i.amount || 0) - paid(i) - returnedAmount(i.cd)), returns = salesReturnsForInvoice(i.cd);
      var typeBadge = i.isUnofficial ? '<span style="background:#fffbeb;color:#b45309;padding:2px 6px;border-radius:4px;font-size:10.5px;font-weight:bold;border:1px solid #fde68a;margin-left:4px">غیررسمی</span> ' : '<span style="background:#f0fdf4;color:#166534;padding:2px 6px;border-radius:4px;font-size:10.5px;font-weight:bold;border:1px solid #bbf7d0;margin-left:4px">رسمی</span> ';
      return '<tr><td>' + escP(i.invDate || i.t || '') + '</td><td>' + typeBadge + escP(i.no || i.cd) + '<br><button class="ba" style="margin-top:4px" onclick="cfSalesReturnPreview(\'' + escP(i.cd) + '\')">↩️ پیش‌نمایش مرجوعی</button></td><td>' + m(i.amount) + ' ریال</td><td>' + m(paid(i)) + ' ریال</td><td>' + m(r) + ' ریال</td></tr>' +
        ps.map(function (p) { return '<tr style="background:#f0fdf4"><td>' + escP(p.t || p.date || '') + '</td><td>وصولی</td><td>—</td><td>' + m(p.amt || p.amount) + ' ریال</td><td>—</td></tr>'; }).join('') +
        returns.map(function (rtn) { return '<tr style="background:#fff7ed"><td>' + escP(rtn.t || '') + '</td><td>↩️ مرجوعی فروش</td><td><b>' + escP(rtn.cd) + '</b><br><small>' + escP((rtn.items || []).map(function (x) { return (x.item || 'قلم') + ' × ' + x.qty; }).join('، ')) + '</small>' + (rtn.disposition === 'stock' ? '<br><small style="color:' + (rtn.stockStatus === 'stocked' ? '#047857' : '#b45309') + '">📦 ' + (rtn.stockStatus === 'stocked' ? 'وارد موجودی شد' : 'نیازمند تعریف کالا') + '</small>' + (rtn.stockStatus === 'pending_product_definition' ? '<br><button class="ba" onclick="cfSalesReturnStockRetry(\'' + escP(rtn.cd) + '\')">📦 تکمیل ورود به موجودی</button>' : '') : '') + '</td><td>—</td><td>' + m(rtn.totalAmount) + ' ریال کاهش' + (rtn.creditAmount ? '<br><small style="color:#047857">اعتبار: ' + m(rtn.creditAmount) + ' ریال</small>' : '') + '</td></tr>'; }).join('');
    }).join('');
    var h = '<div class="md-b" id="cfAccountDlg" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:92vh;overflow:auto"><h3>📘 حساب مشتری — ' + escP(nameOf(c)) + '</h3><div style="background:#fefce8;padding:10px;border-radius:10px">مطالبات باز: <b>' + m(bal(cd)) + ' ریال</b>' + (creditForCustomer(cd) ? ' | اعتبار نزد مشتری: <b style="color:#047857">' + m(creditForCustomer(cd)) + ' ریال</b>' : '') + '</div><div class="tb2"><table><thead><tr><th>تاریخ</th><th>سند</th><th>فاکتور</th><th>وصولی</th><th>مانده</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">گردشی نیست</td></tr>') + '</tbody></table></div><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', h);
  };

  window.cfFinanceHtml = function () {
    var q = String(window._cfSearch || ''), all = window.cfAccountRows(''), rows = window.cfAccountRows(q);
    var openN = all.filter(function (r) { return Math.abs(r.balance) > 0.000001; }).length;
    var table = rows.map(function (r) {
      var open = Math.abs(r.balance) > 0.000001;
      return '<tr' + (open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(r.co || r.cd) + '</b><br><small style="color:#94a3b8;direction:ltr">' + escP(r.cd || '') + '</small></td><td style="font-weight:' + (open ? '900' : '400') + ';color:' + (open ? '#b45309' : '#64748b') + '">' + m(r.balance) + ' ریال</td><td style="color:#047857">' + (r.credit ? m(r.credit) + ' ریال' : '—') + '</td><td><button class="ba" onclick="cfOpen(\'' + escP(r.cd) + '\')">📘 حساب</button></td></tr>';
    }).join('');
    return '<div id="cfFinanceHubBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">📘 حساب مشتریان</h4><small style="color:#64748b">' + openN.toLocaleString('fa-IR') + ' حساب با مانده غیرصفر، ابتدا نمایش داده می‌شود.</small></div><input id="cfSearch" value="' + escP(q) + '" oninput="cfFinanceSearch(this.value)" placeholder="جست‌وجوی نام یا کد مشتری" style="min-width:230px;direction:rtl"></div><div class="tb2" style="margin-top:10px"><table><thead><tr><th>مشتری</th><th>مطالبات باز</th><th>اعتبار نزد مشتری</th><th></th></tr></thead><tbody>' + (table || '<tr><td colspan="4">موردی مطابق جست‌وجو نیست</td></tr>') + '</tbody></table></div></div>';
  };
  window.cfFinanceSearch = function (v) {
    window._cfSearch = String(v || '');
    var el = document.getElementById('cfFinanceHubBox');
    if (el) el.outerHTML = window.cfFinanceHtml();
  };

  var old = window.buildPetty;
  if (typeof old === 'function') window.buildPetty = function () { return old() + window.cfFinanceHtml(); };
})();

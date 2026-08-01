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
    var offers = getData('ptf_crm_offers'), customer = cust(cd);
    var normalizeName = function (v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase(); };
    var customerNames = [customer && (customer.co || customer.name), customer && customer.coEn].filter(Boolean).map(normalizeName);
    return getData('ptf_crm_invoices').filter(function (i) {
      if (!active(i)) return false;
      if (typeof ptfCanSeeLedger === 'function' ? !ptfCanSeeLedger('unofficial') : (typeof curRole === 'function' && curRole() === 'accountant')) { if (i.isUnofficial) return false; }
      var o = offers.filter(function (x) { return x.no === i.offerNo; })[0] || {};
      var invoiceCustomerName = normalizeName(i.buyerCo || o.buyerCo);
      return (i.buyerCd || o.buyerCd) === cd || (invoiceCustomerName && customerNames.indexOf(invoiceCustomerName) > -1);
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
  function accountPosition(cd) {
    var open = bal(cd), credit = creditForCustomer(cd);
    /* BUG-2026-08-01-001: مقادیر ناخالص (باز و اعتبار) و خالص هر دو برگردانده می‌شوند —
       قبلاً netting باعث می‌شد مشتری با باز=اعتبار (مثل ۲۰۰/۲۰۰) «۰/۰» دیده شود و هر دو مقدار پنهان شوند. */
    return { balance: open, credit: credit, net: Math.max(0, open - credit), netCredit: Math.max(0, credit - open) };
  }
  function norm(v) { return String(v || '').trim().toLowerCase(); }

  /* Useful to UI and deterministic tests; it never writes to localStorage. */
  window.cfAccountRows = function (query) {
    var q = norm(query == null ? window._cfSearch : query);
    return getData('ptf_crm_customers').map(function (c) {
      var pos = accountPosition(c.cd);
      return { cd: c.cd, co: nameOf(c), balance: pos.balance, credit: pos.credit, net: pos.net, netCredit: pos.netCredit };
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
    document.querySelectorAll('#cfReturnDlg').forEach(function (el) { el.remove(); });
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
      var rawLineTotal = (+offer.items[0].qty || 1) * (+offer.items[0].price || 0);
      var offerCurrency = offer.currency || inv.offerCurrency || 'IRR';
      var fxRate = +offer.fxRateRef || +inv.offerFxRateRef || 0;
      var expectedBase = offerCurrency !== 'IRR' && fxRate > 0 ? Math.round(rawLineTotal * fxRate) : rawLineTotal;
      var recordedBase = inv.base != null ? (+inv.base || 0) : (+inv.amount || 0);
      if (expectedBase > 0 && Math.abs(recordedBase - expectedBase) > 1) {
        alert('⚠️ مبلغ فاکتور با خط فاکتور سازگار نیست.\nمبلغ ثبت‌شده: ' + recordedBase.toLocaleString('fa-IR') + ' ریال\nمجموع خط: ' + expectedBase.toLocaleString('fa-IR') + ' ریال\nابتدا فاکتور را اصلاح کنید؛ مرجوعی ثبت نشد.');
        return;
      }
    }
    var totalAmount = selected.reduce(function (sum, x) { var it = (offer.items || [])[x.idx] || {}; return sum + ((+inv.amount || 0) * (((+it.qty || 0) * (+it.price || 0)) / gross) * x.qty / (+it.qty || 1)); }, 0);
    var returns = getData('ptf_crm_sales_returns') || [];
    var deal = getData('ptf_crm_deals').filter(function (d) { return d.wonOffer === (offer.no || inv.offerNo); })[0] || {};
    var returnRecord = { cd: genCode('SRET'), invoiceCd: invoiceCd, customerCd: offer.buyerCd || '', dealCd: deal.cd || '', offerNo: offer.no || inv.offerNo || '', items: selected.map(function (x) { var it = (offer.items || [])[x.idx] || {}; return { idx: x.idx, lineKey: it.sourceItemKey || it.pcode || it.prodCd || '', productCd: it.pcode || it.prodCd || '', item: it.name || it.nm || it.desc || '', spec: it.spec || it.st || it.detail || '', model: it.model || it.md || '', brand: it.brand || it.br || '', unit: it.unit || it.un || '', qty: x.qty }; }), totalAmount: Math.round(totalAmount), creditAmount: Math.max(0, paid(inv) + returnedAmount(invoiceCd) + Math.round(totalAmount) - (+inv.amount || 0)), reason: reason, disposition: disposition, note: note, status: 'approved', t: faDateTime(), by: curSession().name };
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
  function cfReturnNorm(v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()\/\\]/g, '').toLowerCase(); }
  function cfReturnProductText(p) { return [p.nm || p.name || '', p.cd || '', p.en || '', p.st || '', p.br || '', p.md || ''].join(' '); }
  function cfReturnProductScore(p, query) {
    var q = cfReturnNorm(query), text = cfReturnNorm(cfReturnProductText(p)), name = cfReturnNorm(p.nm || p.name || ''), score = 0;
    if (!q) return 0;
    if (name === q) score += 1000; else if (name.indexOf(q) === 0) score += 500; else if (name.indexOf(q) > -1) score += 250;
    q.split(/\s+/).filter(Boolean).forEach(function (t) { if (text.indexOf(t) > -1) score += 30; });
    return score;
  }
  function cfReturnProductOptions(products, query, base) {
    var q = String(query || '').trim(), list = products.map(function (p, i) { return { p: p, i: i, score: cfReturnProductScore(p, q || base) }; });
    if (q) list = list.filter(function (x) { return x.score > 0; });
    list.sort(function (a, b) { return b.score - a.score || String(a.p.nm || a.p.cd).localeCompare(String(b.p.nm || b.p.cd), 'fa'); });
    return '<option value="">— انتخاب کالا از کاتالوگ —</option>' + list.slice(0, q ? 80 : 12).map(function (x, i) {
      return '<option value="' + escP(x.p.cd) + '">' + (i < 5 && !q ? '⭐ ' : '') + escP(x.p.nm || x.p.name || x.p.cd) + ' — ' + escP(x.p.cd) + '</option>';
    }).join('');
  }
  window.cfReturnProductFilter = function (returnCd, index) {
    var input = document.getElementById('cfRetSearch_' + index), select = document.getElementById('cfRetProd_' + index);
    if (!input || !select) return;
    var products = getData('ptf_crm_products') || [], current = select.value;
    select.innerHTML = cfReturnProductOptions(products, input.value, input.getAttribute('data-base') || '');
    if (products.some(function (p) { return p.cd === current; })) select.value = current;
  };
  window.cfSalesReturnProductPicker = function (returnCd, pending) {
    var returns = getData('ptf_crm_sales_returns') || [], rtn = returns.filter(function (x) { return x.cd === returnCd; })[0];
    if (!rtn) return;
    document.querySelectorAll('#cfReturnProductDlg').forEach(function (el) { el.remove(); });
    var products = getData('ptf_crm_products') || [];
    var rows = pending.map(function (name, i) {
      var opts = cfReturnProductOptions(products, '', name);
      return '<div style="display:grid;grid-template-columns:minmax(180px,1fr) minmax(240px,1fr);gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0"><b>' + escP(name) + '</b><div><input id="cfRetSearch_' + i + '" data-base="' + escP(name) + '" placeholder="جست‌وجوی نام، کد، مدل یا برند" oninput="cfReturnProductFilter(\'' + escP(returnCd) + '\',' + i + ')" style="width:100%;margin-bottom:4px;box-sizing:border-box"><select id="cfRetProd_' + i + '">' + opts + '</select></div></div>';
    }).join('');
    var html = '<div class="md-b" id="cfReturnProductDlg" style="display:grid;z-index:9999;position:fixed" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px;max-height:90vh;overflow:auto"><h3>📦 تکمیل ورود به موجودی</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px;margin-bottom:10px;font-size:12px">⭐ پنج پیشنهاد اول نزدیک‌ترین نتایج هستند. با جست‌وجوی نام، کد، مدل یا برند، فهرست را محدود کنید.</div>' + rows + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" onclick="cfSalesReturnAssignProducts(\'' + escP(returnCd) + '\')">تایید و ورود به موجودی</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.cfSalesReturnAssignProducts = function (returnCd) {
    var returns = getData('ptf_crm_sales_returns') || [], rtn = returns.filter(function (x) { return x.cd === returnCd; })[0];
    if (!rtn) return;
    var names = rtn.stockPendingItems || [], missing = false;
    names.forEach(function (name, i) {
      var select = document.getElementById('cfRetProd_' + i), value = select && select.value;
      var item = (rtn.items || []).filter(function (x) { return x.item === name && !x.productCd; })[0];
      if (!value || !item) { missing = true; return; }
      item.productCd = value;
    });
    if (missing) { alert('برای همه اقلام، کالای متناظر را انتخاب کنید.'); return; }
    setData('ptf_crm_sales_returns', returns);
    var dlg = document.getElementById('cfReturnProductDlg'); if (dlg) dlg.remove();
    cfSalesReturnStockRetry(returnCd);
  };

  window.cfSalesReturnStockRetry = function (returnCd) {
    var returns = getData('ptf_crm_sales_returns') || [], rtn = returns.filter(function (x) { return x.cd === returnCd; })[0];
    if (!rtn || rtn.disposition !== 'stock') return;
    var inv = getData('ptf_crm_invoices').filter(function (x) { return x.cd === rtn.invoiceCd; })[0] || {}, products = getData('ptf_crm_products') || [], stockRefs = rtn.stockRefs || [], pending = [];
    var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === (rtn.offerNo || inv.offerNo); })[0] || {};
    function normProduct(v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()\/\\]/g, '').toLowerCase(); }
    function identity(x) { return [normProduct(x.name || x.nm || x.desc), normProduct(x.model || x.md), normProduct(x.spec || x.st || x.detail), normProduct(x.unit || x.un)].join('|'); }
    (rtn.items || []).forEach(function (item) {
      /* Old return records did not retain all identity fields. Rehydrate them
         from the immutable offer line before trying the catalog match. */
      var source = (offer.items || [])[+item.idx];
      if (source) {
        item.spec = item.spec || source.spec || source.st || source.detail || '';
        item.model = item.model || source.model || source.md || '';
        item.brand = item.brand || source.brand || source.br || '';
        item.unit = item.unit || source.unit || source.un || '';
        item.productCd = item.productCd || source.pcode || source.prodCd || source.productCd || '';
      }
      var productCd = item.productCd || '';
      var candidates = products.filter(function (p) {
        return (productCd && p.cd === productCd) || (identity(item) !== '|||' && identity(p) === identity(item));
      });
      /* Name-only matching is allowed only when unique; never guess between
         duplicate catalog names. */
      if (!candidates.length) candidates = products.filter(function (p) { return normProduct(p.nm || p.name || p.cd) === normProduct(item.item); });
      var product = candidates.length === 1 ? candidates[0] : null;
      if (!product || typeof ptfSurplusAdd !== 'function') { pending.push(item.item); return; }
      var existing = (typeof ptfSurplusAll === 'function' ? ptfSurplusAll() : []).filter(function (s) { return String(s.note || '').indexOf(returnCd) > -1 && s.prodCd === product.cd; })[0];
      if (existing) { if (stockRefs.indexOf(existing.cd) < 0) stockRefs.push(existing.cd); return; }
      var stock = ptfSurplusAdd(product.cd, item.qty, 'انبار', rtn.dealCd || rtn.offerNo, 'ورود از مرجوعی فروش ' + returnCd + ' — ' + item.item);
      if (stock) stockRefs.push(stock.cd); else pending.push(item.item);
    });
    rtn.stockRefs = stockRefs; rtn.stockPendingItems = pending; rtn.stockStatus = pending.length ? 'pending_product_definition' : 'stocked';
    setData('ptf_crm_sales_returns', returns);
    if (typeof ptfToast === 'function') ptfToast(pending.length ? 'برخی اقلام هنوز کالا ندارند؛ پنجره انتخاب کالا باز شد.' : 'ورود مرجوعی به موجودی تکمیل شد.', pending.length ? 'warn' : 'ok');
    if (inv.offerNo) { var offer = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {}; if (offer.buyerCd) cfOpen(offer.buyerCd); }
    if (pending.length) window.cfSalesReturnProductPicker(returnCd, pending);
  };
  /* UR-2026-08-01-03/08: خروجی گردش حساب مشتری (PDF/اکسل/چاپ)
     الگو: supplier-finance.js (slEventRows/slCsv/slLedgerPrint). */
  window.cfLedgerRows = function (cd) {
    var out = [];
    invs(cd).forEach(function (i) {
      out.push({ date: i.invDate || i.t || '', type: 'فاکتور فروش' + (i.isUnofficial ? ' (غیررسمی)' : ''), no: i.no || i.cd, ref: i.offerNo || '', debit: +i.amount || 0, credit: 0, cur: 'IRR' });
      (i.payments || []).concat(i.pays || []).filter(active).forEach(function (p) {
        out.push({ date: p.t || p.date || '', type: 'وصولی', no: p.cd || p.rpay || '', ref: '', debit: 0, credit: +p.amt || +p.amount || 0, cur: 'IRR' });
      });
      salesReturnsForInvoice(i.cd).forEach(function (r) {
        var items = (r.items || []).map(function (x) { return (x.item || 'قلم') + ' × ' + x.qty; }).join('، ');
        out.push({ date: r.t || '', type: 'مرجوعی فروش', no: r.cd || '', ref: (r.reason ? r.reason + ' — ' : '') + items, debit: 0, credit: +r.totalAmount || 0, cur: 'IRR' });
      });
    });
    /* مرتب‌سازی صعودی بر اساس تاریخ (فرمت 1405/MM/DD مقایسهٔ رشته‌ای درست است)؛ بدون تاریخ آخر */
    out.sort(function (a, b) { var da = a.date || '9999/99/99', db = b.date || '9999/99/99'; return da < db ? -1 : da > db ? 1 : 0; });
    var bal = 0;
    out.forEach(function (r) { bal += (+r.debit || 0) - (+r.credit || 0); r.balance = bal; });
    return out;
  };
  window.cfLedgerCsv = function (cd) {
    var c = cust(cd), rows = cfLedgerRows(cd);
    var csv = '\uFEFF' + [['تاریخ', 'نوع', 'سند', 'مرجع', 'بدهکار', 'بستانکار', 'مانده']]
      .concat(rows.map(function (e) { return [e.date, e.type, e.no, e.ref, e.debit || '', e.credit || '', e.balance]; }))
      .map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'customer-ledger-' + cd + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };
  window.cfLedgerPrint = function (cd) {
    var c = cust(cd), rows = cfLedgerRows(cd);
    function rowHtml(e) {
      return '<tr><td>' + escP(e.date || '—') + '</td><td>' + escP(e.type) + '</td><td><b>' + escP(e.no || '—') + '</b>' + (e.ref ? '<br><small>' + escP(e.ref) + '</small>' : '') + '</td><td>' + (e.debit ? m(e.debit) : '—') + '</td><td>' + (e.credit ? m(e.credit) : '—') + '</td><td><b>' + m(e.balance) + '</b></td></tr>';
    }
    var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}</style></head><body><h2>گردش حساب مشتری — ' + escP(nameOf(c)) + '</h2><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>' + rows.map(rowHtml).join('') + '</tbody></table></body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گردش حساب مشتری — ' + escP(nameOf(c)), html, 'customer-ledger-' + cd); return; }
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.print();
  };

  window.cfOpen = function (cd) {
    /* Account dialogs are singleton: refresh in place, never stack overlays. */
    document.querySelectorAll('#cfAccountDlg').forEach(function (el) { el.remove(); });
    var c = cust(cd); if (!c) return;
    var rows = invs(cd).map(function (i) {
      var ps = (i.payments || []).concat(i.pays || []).filter(active), r = Math.max(0, (+i.amount || 0) - paid(i) - returnedAmount(i.cd)), returns = salesReturnsForInvoice(i.cd);
      var typeBadge = i.isUnofficial ? '<span style="background:#fffbeb;color:#b45309;padding:2px 6px;border-radius:4px;font-size:10.5px;font-weight:bold;border:1px solid #fde68a;margin-left:4px">غیررسمی</span> ' : '<span style="background:#f0fdf4;color:#166534;padding:2px 6px;border-radius:4px;font-size:10.5px;font-weight:bold;border:1px solid #bbf7d0;margin-left:4px">رسمی</span> ';
      return '<tr><td>' + escP(i.invDate || i.t || '') + '</td><td>' + typeBadge + escP(i.no || i.cd) + '<br><button class="ba" style="margin-top:4px" onclick="cfSalesReturnPreview(\'' + escP(i.cd) + '\')">↩️ پیش‌نمایش مرجوعی</button></td><td>' + m(i.amount) + ' ریال</td><td>' + m(paid(i)) + ' ریال</td><td>' + m(r) + ' ریال</td></tr>' +
        ps.map(function (p) { return '<tr style="background:#f0fdf4"><td>' + escP(p.t || p.date || '') + '</td><td>وصولی</td><td>—</td><td>' + m(p.amt || p.amount) + ' ریال</td><td>—</td></tr>'; }).join('') +
        returns.map(function (rtn) { return '<tr style="background:#fff7ed"><td>' + escP(rtn.t || '') + '</td><td>↩️ مرجوعی فروش</td><td><b>' + escP(rtn.cd) + '</b><br><small>' + escP((rtn.items || []).map(function (x) { return (x.item || 'قلم') + ' × ' + x.qty; }).join('، ')) + '</small>' + (rtn.disposition === 'stock' ? '<br><small style="color:' + (rtn.stockStatus === 'stocked' ? '#047857' : '#b45309') + '">📦 ' + (rtn.stockStatus === 'stocked' ? 'وارد موجودی شد' : 'نیازمند تعریف کالا') + '</small>' + (rtn.stockStatus === 'pending_product_definition' ? '<br><button class="ba" onclick="cfSalesReturnStockRetry(\'' + escP(rtn.cd) + '\')">📦 تکمیل ورود به موجودی</button>' : '') : '') + '</td><td>—</td><td>' + m(rtn.totalAmount) + ' ریال کاهش' + (rtn.creditAmount ? '<br><small style="color:#047857">اعتبار: ' + m(rtn.creditAmount) + ' ریال</small>' : '') + '</td></tr>'; }).join('');
    }).join('');
    var pos = accountPosition(cd);
    var h = '<div class="md-b" id="cfAccountDlg" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:92vh;overflow:auto"><h3>📘 حساب مشتری — ' + escP(nameOf(c)) + '</h3><div style="background:#fefce8;padding:10px;border-radius:10px">' +
      'مطالبات باز (ناخالص): <b>' + m(pos.balance) + ' ریال</b>' +
      (pos.credit ? ' | اعتبار نزد مشتری (ناخالص): <b style="color:#047857">' + m(pos.credit) + ' ریال</b>' : '') +
      '<br><small style="color:#475569">' + (pos.netCredit ? 'وضعیت خالص: <b style="color:#047857">' + m(pos.netCredit) + ' ریال بستانکار</b>' : 'وضعیت خالص: <b style="color:#b45309">' + m(pos.net) + ' ریال بدهکار</b>') + '</small></div><div class="tb2"><table><thead><tr><th>تاریخ</th><th>سند</th><th>فاکتور</th><th>وصولی</th><th>مانده</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">گردشی نیست</td></tr>') + '</tbody></table></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">__CF_ACTIONS__</div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', h.replace('__CF_ACTIONS__',
      '<button class="bt bt-o" style="background:#0e7490;color:#fff" onclick="cfLedgerPrint(\'' + escP(cd) + '\')">🖨 چاپ/PDF</button>' +
      '<button class="bt bt-o" onclick="cfLedgerCsv(\'' + escP(cd) + '\')">⬇ اکسل</button>' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button>'));
  };

  window.cfFinanceRowsRender = function () {
    var tbl = document.getElementById('cfFinanceTbl');
    if (tbl) tbl.innerHTML = window.cfFinanceRowsHtml();
  };
  window.cfFinanceRowsHtml = function () {
    var q = String(window._cfSearch || ''), all = window.cfAccountRows(''), rows = window.cfAccountRows(q);
    var openN = all.filter(function (r) { return Math.abs(r.balance) > 0.000001; }).length;
    /* UR-2026-08-01-07: سورت ستون‌ها (مشتری/مطالبات/اعتبار) */
    if (window.ptfRegisterSortable) window.ptfRegisterSortable('cf', {
      getters: { co: function (r) { return r.co || ''; }, balance: function (r) { return r.balance; }, credit: function (r) { return r.credit; } },
      render: window.cfFinanceRowsRender
    });
    rows = (typeof window.ptfSorted === 'function') ? window.ptfSorted('cf', rows) : rows;
    var table = rows.map(function (r) {
      var open = Math.abs(r.balance) > 0.000001;
      return '<tr' + (open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(r.co || r.cd) + '</b><br><small style="color:#94a3b8;direction:ltr">' + escP(r.cd || '') + '</small></td><td style="font-weight:' + (open ? '900' : '400') + ';color:' + (open ? '#b45309' : '#64748b') + '">' + m(r.balance) + ' ریال</td><td style="color:#047857">' + (r.credit ? m(r.credit) + ' ریال' : '—') + '</td><td><button class="ba" onclick="cfOpen(\'' + escP(r.cd) + '\')">📘 حساب</button></td></tr>';
    }).join('');
    return table || '<tr><td colspan="4">موردی مطابق جست‌وجو نیست</td></tr>';
  };
  window.cfFinanceHtml = function () {
    var q = String(window._cfSearch || ''), all = window.cfAccountRows(''), rows = window.cfAccountRows(q);
    var openN = all.filter(function (r) { return Math.abs(r.balance) > 0.000001; }).length;
    var table = rows.map(function (r) {
      var open = Math.abs(r.balance) > 0.000001;
      return '<tr' + (open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(r.co || r.cd) + '</b><br><small style="color:#94a3b8;direction:ltr">' + escP(r.cd || '') + '</small></td><td style="font-weight:' + (open ? '900' : '400') + ';color:' + (open ? '#b45309' : '#64748b') + '">' + m(r.balance) + ' ریال</td><td style="color:#047857">' + (r.credit ? m(r.credit) + ' ریال' : '—') + '</td><td><button class="ba" onclick="cfOpen(\'' + escP(r.cd) + '\')">📘 حساب</button></td></tr>';
    }).join('');
    return '<div id="cfFinanceHubBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">📘 حساب مشتریان</h4><small style="color:#64748b">' + openN.toLocaleString('fa-IR') + ' حساب با مانده غیرصفر، ابتدا نمایش داده می‌شود.</small></div><input id="cfSearch" value="' + escP(q) + '" oninput="cfFinanceSearch(this.value)" placeholder="جست‌وجوی نام یا کد مشتری" style="min-width:230px;direction:rtl"></div><div class="tb2" style="margin-top:10px"><table><thead><tr>' +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('cf', 'co', 'مشتری') : '<th>مشتری</th>') +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('cf', 'balance', 'مطالبات باز') : '<th>مطالبات باز</th>') +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('cf', 'credit', 'اعتبار نزد مشتری') : '<th>اعتبار نزد مشتری</th>') + '<th></th>' +
      '</tr></thead><tbody id="cfFinanceTbl">' + (table || '<tr><td colspan="4">موردی مطابق جست‌وجو نیست</td></tr>') + '</tbody></table></div></div>';
  };
  window.cfFinanceSearch = function (v) {
    window._cfSearch = String(v || '');
    /* فقط ناحیهٔ جدول به‌روز می‌شود تا فوکوس کادر جستجو حفظ شود (UR-2026-08-01-02). */
    var box = document.getElementById('cfFinanceHubBox');
    if (!box) return;
    var tbl = document.getElementById('cfFinanceTbl');
    if (tbl) tbl.innerHTML = window.cfFinanceRowsHtml();
  };

  var old = window.buildPetty;
  if (typeof old === 'function') window.buildPetty = function () { return old() + window.cfFinanceHtml(); };
})();

/* =====================================================================
   PTF CRM — Sprint 283
   Customer accounts: derived read-only balances, searchable and ordered.
   No account balance is persisted here; invoices remain the source of truth.
   ===================================================================== */
(function () {
  'use strict';
  function m(v) { return (+v || 0).toLocaleString('fa-IR'); }
  /* v34.7.18 (AR-INTEGRITY فاز ۱ / R8): تعریف «رکورد فعال» با پنل مطالبات و سرور یکی شد.
     پیش از این، فاکتور «superseded» (صورتحساب غیررسمیِ جایگزین‌شده با فاکتور رسمی) در این
     صفحه دوباره بدهی می‌ساخت و بدهی مشتری تقریباً دو برابر دیده می‌شد. */
  function active(v) {
    if (!v) return false;
    if (window.PTF && window.PTF.ar && typeof window.PTF.ar.activeInvoice === 'function') return window.PTF.ar.activeInvoice(v);
    var st = String(v.status || v.st || '').toLowerCase();
    return ['void', 'voided', 'cancelled', 'deleted', 'replaced', 'superseded'].indexOf(st) < 0 && v.void !== true && v.voided !== true;
  }
  function cust(cd) { return getData('ptf_crm_customers').filter(function (c) { return c.cd === cd; })[0]; }
  function nameOf(c) { return (c && (c.co || c.name || c.cd)) || ''; }
  /* v34.7.26 (S3 / نشت بین‌مشتری): دو گارد اضافه شد و بقیهٔ رفتار دست‌نخورده ماند.
     F2-D — یافتن پیشنهاد فقط با شمارهٔ ناتهی (قبلاً x.no===i.offerNo با دو مقدار
            undefined/'' صادق می‌شد و buyerCd یک پیشنهاد بی‌ربط خوانده می‌شد).
     F2-C — تطبیق مبتنی بر نام شرکت فقط وقتی مجاز است که آن نام نرمال‌شده به یک و
            تنها یک رکورد مشتری برسد؛ با مشتریان هم‌نام (رکورد تکراری) فاکتورهای یکی
            در حساب دیگری دیده می‌شد. مرجع: ASSESSMENT-SALESFILE-3ISSUES-2026-08-17.md §۳ */
  function cfNormalizeName(v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase(); }
  window.cfFindOfferByNo = function (offerNo, offers) {
    var no = String(offerNo == null ? '' : offerNo); if (!no) return null;
    return (offers || getData('ptf_crm_offers')).filter(function (x) { return x && String(x.no || '') === no; })[0] || null;
  };
  /* یک‌بار در هر فراخوانی invs ساخته می‌شود (نه به‌ازای هر نام) تا پیمایش تکراری فهرست
     مشتریان روی حساب‌های پرتعداد هزینه‌ساز نشود. */
  function cfNameOwners() {
    var map = {};
    (getData('ptf_crm_customers') || []).forEach(function (c) {
      if (!c) return;
      [c.co || c.name, c.coEn].filter(Boolean).forEach(function (n) {
        var k = cfNormalizeName(n); if (!k) return;
        map[k] = map[k] || {};
        map[k][String(c.cd || '')] = true;
      });
    });
    return map;
  }
  function invs(cd) {
    var offers = getData('ptf_crm_offers'), customer = cust(cd);
    var normalizeName = cfNormalizeName;
    var nameOwners = cfNameOwners();
    var customerNames = [customer && (customer.co || customer.name), customer && customer.coEn].filter(Boolean).map(normalizeName)
      .filter(function (n) { return n && Object.keys(nameOwners[n] || {}).length === 1; });
    return getData('ptf_crm_invoices').filter(function (i) {
      if (!active(i)) return false;
      if (typeof ptfCanSeeLedger === 'function' ? !ptfCanSeeLedger('unofficial') : (typeof curRole === 'function' && curRole() === 'accountant')) { if (i.isUnofficial) return false; }
      var o = window.cfFindOfferByNo(i.offerNo, offers) || {};
      var invoiceCustomerName = normalizeName(i.buyerCo || o.buyerCo);
      return (i.customerId || i.buyerCd || o.buyerCd) === cd || (invoiceCustomerName && customerNames.indexOf(invoiceCustomerName) > -1);
    });
  }
  function isMigratedLegacyPayment(p) { return !!(p && (p.migratedToReceiptId || p.financialProjectionDisabled)); }
  window.cfIsMigratedLegacyPayment = isMigratedLegacyPayment;
  function paid(i) {
    /* v34.7.18 (فاز ۳): منبع واحد مانده = PTF.ar (شامل بازسازی محلی تخصیص وقتی پروجکشن
       سرور نرسیده باشد). فرمول قبلی به‌عنوان fallback دست‌نخورده باقی مانده است. */
    if (window.PTF && window.PTF.ar && typeof window.PTF.ar.invoiceState === 'function') {
      try { return window.PTF.ar.invoiceState(i).paid; } catch (eAr) {}
    }
    var payActive = (window.PTF && typeof window.PTF.isPaymentActive === 'function') ? window.PTF.isPaymentActive : active;
    var legacy = (i.payments || []).concat(i.pays || []).filter(payActive).reduce(function (s, p) {
      return s + ((p.fromAdvance || isMigratedLegacyPayment(p)) ? 0 : (+p.amt || +p.amount || 0));
    }, 0);
    /* v35: تخصیص Receipt پرونده رابطه مستقل است و روی فاکتور Projection می‌شود. */
    return legacy + (+i.allocatedBase || 0) + (+i.allocatedVat || 0);
  }
  /* ---------- مرجوعی فروش — تطبیق مقاوم با فاکتور (v33.12.0)
     ریشهٔ «اعتبار مشتری از بین رفته»: مرجوعی‌های قدیمی/ثبت‌شده از مسیرهای دیگر
     ممکن است invoiceCd نداشته باشند (فقط offerNo + customerCd یا invoiceNo)؛
     تطبیق قبلی فقط r.invoiceCd===invoiceCd بود → returnedAmount=0 → اعتبار=0
     در حالی که کالای مرجوعی در موجودی هست.
     قواعد (بدون دوباره‌شماری):
       ۱) اگر r.invoiceCd دارد و برابر cd است → match.
       ۲) اگر r.invoiceCd ندارد: ابتدا invoiceNo برابر no فاکتور؛ سپس offerNo برابر
          offerNo فاکتور و (customerCd فاکتور یا مشتری یکتا) — فقط اگر همان offer
          فقط یک فاکتور غیرvoid داشته باشد (یکتایی). ---------- */
  function invoiceOfOffer(offerNo) {
    if (!offerNo) return null;
    var list = getData('ptf_crm_invoices').filter(function (i) { return active(i) && i.offerNo === offerNo; });
    return list.length === 1 ? list[0] : null;
  }
  function salesReturnsForInvoice(invoice) {
    var cd = invoice && invoice.cd;
    var no = invoice && invoice.no;
    var offerNo = invoice && invoice.offerNo;
    return getData('ptf_crm_sales_returns').filter(function (r) {
      if (!r || r.status === 'void') return false;
      if (cd && r.invoiceCd && r.invoiceCd === cd) return true;
      if (r.invoiceCd) return false; /* invoiceCd دارد ولی برای فاکتور دیگری است */
      /* fallback برای رکوردهای قدیمی بدون invoiceCd */
      if (no && r.invoiceNo && String(r.invoiceNo) === String(no)) return true;
      if (offerNo && r.offerNo && String(r.offerNo) === String(offerNo)) {
        var single = invoiceOfOffer(offerNo);
        return !!single && single.cd === cd;
      }
      return false;
    });
  }
  function returnedAmount(invoice) { return salesReturnsForInvoice(invoice).reduce(function (s, r) { return s + (+r.totalAmount || 0); }, 0); }
  function creditAmountForInvoice(invoice) { return Math.max(0, paid(invoice) + returnedAmount(invoice) - (+invoice.amount || 0)); }
  function creditForCustomer(cd) {
    var legacy = invs(cd).reduce(function (s, i) { return s + creditAmountForInvoice(i); }, 0);
    /* v34.7.26 (S3/F2-B): کلید تهی هرگز وارد نقشه نمی‌شود؛ قبلاً یک پروندهٔ بدون _id و cd
       کلید '' را true می‌کرد و هر رسیدِ بدون caseId (حتی از مشتری دیگر) در بستانکاری این
       مشتری شمرده می‌شد. رسید بدون caseId فقط با customerId صریح پذیرفته می‌شود. */
    var cases = {};
    (getData('ptf_crm_deals') || []).forEach(function (d) { if (!d || d.buyerCd !== cd) return; var k = String(d._id || d.cd || ''); if (k) cases[k] = true; });
    var caseCredit = (getData('ptf_crm_case_receipts') || []).reduce(function (s, r) {
      if (!r || r.status !== 'posted' || r.voided) return s;
      var rk = String(r.caseId || '');
      if (r.customerId !== cd && !(rk && cases[rk])) return s;
      return s + (+r.creditRemainIRR || 0);
    }, 0);
    return legacy + caseCredit;
  }
  function bal(cd) { return invs(cd).reduce(function (s, i) { return s + Math.max(0, (+i.amount || 0) - paid(i) - returnedAmount(i)); }, 0); }
  window.cfMigratedReceiptPairs=function(cd){
    var receipts=getData('ptf_crm_case_receipts')||[],byId={},byLegacy={};receipts.forEach(function(r){if(!r)return;byId[String(r._id||r.cd||'')]=r;if(r.legacyPaymentRef)byLegacy[String(r.legacyPaymentRef)]=r;});
    var out=[];invs(cd).forEach(function(inv){(inv.payments||[]).concat(inv.pays||[]).forEach(function(p){if(!isMigratedLegacyPayment(p))return;var receipt=byId[String(p.migratedToReceiptId||'')]||byLegacy[String(p.cd||'')];out.push({invoiceCd:inv.cd,legacyPaymentCd:p.cd||'',receiptId:receipt?String(receipt._id||receipt.cd||''):'',ok:!!(receipt&&receipt.status==='posted'&&!receipt.voided),amount:+p.amt||+p.amount||0});});});return out;
  };
  function accountPosition(cd) {
    var open = bal(cd), credit = creditForCustomer(cd);
    /* BUG-2026-08-01-001: مقادیر ناخالص (باز و اعتبار) و خالص هر دو برگردانده می‌شوند —
       قبلاً netting باعث می‌شد مشتری با باز=اعتبار (مثل ۲۰۰/۲۰۰) «۰/۰» دیده شود و هر دو مقدار پنهان شوند. */
    return { balance: open, credit: credit, net: Math.max(0, open - credit), netCredit: Math.max(0, credit - open) };
  }
  /* ---------- v33.12.0: تشخیص و ترمیم اعتبار مشتری (ریشه‌یابی «اعتبار از بین رفته») ----------
     گزارش اجزای اعتبار هر مشتری: فاکتور → (مبلغ، وصولی، مرجوعی متصل، اعتبار سهم).
     ترمیم: مرجوعی‌های بدون invoiceCd را با (invoiceNo یا offerNo یکتا) به فاکتور پیوند می‌زند. */
  window.cfCreditAudit = function (cd) {
    var out = { customerCd: cd, credit: 0, rows: [], unlinkedReturns: [], orphanReturns: [] };
    try {
      var invList = invs(cd);
      invList.forEach(function (i) {
        var pd = paid(i), rt = returnedAmount(i), cr = Math.max(0, pd + rt - (+i.amount || 0));
        out.credit += cr;
        out.rows.push({ invoiceCd: i.cd, no: i.no || '', offerNo: i.offerNo || '', amount: +i.amount || 0, paid: pd, returned: rt, credit: cr });
      });
      var myInv = {};
      invList.forEach(function (i) { myInv[i.cd] = 1; });
      var all = getData('ptf_crm_sales_returns') || [];
      all.forEach(function (r) {
        if (!r || r.status === 'void') return;
        var linked = (r.invoiceCd && myInv[r.invoiceCd]);
        if (!linked && !r.invoiceCd) out.unlinkedReturns.push({ cd: r.cd, offerNo: r.offerNo || '', invoiceNo: r.invoiceNo || '', customerCd: r.customerCd || '', totalAmount: +r.totalAmount || 0 });
        if (r.customerCd && r.customerCd !== cd && !r.invoiceCd) out.orphanReturns.push({ cd: r.cd, customerCd: r.customerCd, totalAmount: +r.totalAmount || 0 });
      });
    } catch (e) {}
    return out;
  };
  /* ترمیم: مرجوعی‌های بدون invoiceCd → اگر offerNo یکتاست به همان فاکتور پیوند بزن */
  window.cfRepairReturnLinks = function () {
    var returns = getData('ptf_crm_sales_returns') || [];
    var fixed = 0;
    returns.forEach(function (r) {
      if (!r || r.status === 'void' || r.invoiceCd) return;
      var inv = null;
      if (r.invoiceNo) {
        var byNo = getData('ptf_crm_invoices').filter(function (i) { return active(i) && String(i.no) === String(r.invoiceNo); });
        if (byNo.length === 1) inv = byNo[0];
      }
      if (!inv && r.offerNo) inv = invoiceOfOffer(r.offerNo);
      if (inv) { r.invoiceCd = inv.cd; r.repairedAt = faDateTime(); fixed++; }
    });
    if (fixed) { setData('ptf_crm_sales_returns', returns); try { audit('مرجوعی فروش', 'ترمیم خودکار لینک ' + fixed + ' مرجوعی بدون invoiceCd به فاکتور (ریشه‌یابی اعتبار مشتری)', 'SRET-REPAIR'); } catch (e) {} }
    return fixed;
  };
  /* اجرای خودکار ترمیم در بوت (idempotent) */
  try { window.cfRepairReturnLinks(); } catch (eR) {}

  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function accountIsOpen(r){return !!r&&(Math.abs(+r.balance||0)>0.000001||Math.abs(+r.credit||0)>0.000001);}
  window.cfAccountIsOpen=accountIsOpen;

  /* Useful to UI and deterministic tests; it never writes to localStorage. */
  window.cfAccountRows = function (query) {
    var q = norm(query == null ? window._cfSearch : query);
    return getData('ptf_crm_customers').map(function (c) {
      var pos = accountPosition(c.cd);
      return { cd: c.cd, co: nameOf(c), balance: pos.balance, credit: pos.credit, net: pos.net, netCredit: pos.netCredit };
    }).filter(function (r) {
      return !q || norm(r.co).indexOf(q) > -1 || norm(r.cd).indexOf(q) > -1;
    }).sort(function (a, b) {
      var aOpen = accountIsOpen(a), bOpen = accountIsOpen(b);
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
    var priorReturns = salesReturnsForInvoice(inv);
    function priorQty(idx) { return priorReturns.reduce(function (sum, r) { return sum + (r.items || []).filter(function (x) { return +x.idx === +idx; }).reduce(function (s, x) { return s + (+x.qty || 0); }, 0); }, 0); }
    if (!items.length) { alert('برای این فاکتور خطوط کالا پیدا نشد.'); return; }
    var rows = items.map(function (it, idx) { var totalQty=+it.qty||1, available=Math.max(0,totalQty-priorQty(idx)); return '<label style="display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px dashed #e2e8f0;opacity:' + (available ? '1' : '.55') + '"><input type="checkbox" class="cfReturnLine" value="' + idx + '"' + (available ? '' : ' disabled') + '><span style="flex:1"><b>' + escP(it.name || it.nm || it.desc || 'قلم ' + (idx + 1)) + '</b><small style="display:block;color:#64748b">فاکتور: ' + totalQty + ' ' + escP(it.unit || it.un || '') + ' | قابل مرجوعی: ' + available + '</small></span><input class="cfReturnQty" data-idx="' + idx + '" type="number" min="0" max="' + available + '" value="' + (available || 0) + '"' + (available ? '' : ' disabled') + ' style="width:90px;direction:ltr"></label>'; }).join('');
    var html = '<div class="md-b" id="cfReturnDlg" style="display:grid;z-index:3200" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px;max-height:90vh;overflow:auto"><h3>↩️ پیش‌نمایش مرجوعی فاکتور ' + escP(inv.no || inv.cd) + '</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 11px;font-size:12px;margin-bottom:9px">در این مرحله فقط خطوط قابل انتخاب و مقدار پیشنهادی نمایش داده می‌شود؛ هیچ سند یا مبلغی ذخیره نمی‌شود.</div><div>' + rows + '</div><div class="fr" style="margin-top:10px"><div class="fld"><label>دلیل مرجوعی *</label><select id="cfReturnReason"><option value="">— انتخاب کنید —</option><option>عدم تأیید مشتری</option><option>عدم نیاز مشتری</option><option>مغایرت فنی/کیفی</option><option>مقدار اضافی یا اشتباه</option><option>لغو یا تغییر پروژه</option><option>درخواست مشتری</option><option>سایر</option></select></div><div class="fld"><label>سرنوشت کالا</label><select id="cfReturnDisposition"><option value="stock">ورود به موجودی</option><option value="supplier">برگشت به تأمین‌کننده</option><option value="quarantine">قرنطینه/بازرسی</option><option value="scrap">ضایعات</option></select></div></div><div class="fld"><label>توضیح تکمیلی</label><textarea id="cfReturnNote" rows="2"></textarea></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button><button class="bt" onclick="cfSalesReturnPreviewSelected(\'' + ptfOnClickArg(invoiceCd) + '\')">ثبت مرجوعی</button></div></div></div>';
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
    var returnRecord = { cd: genCode('SRET'), invoiceCd: invoiceCd, customerCd: offer.buyerCd || '', dealCd: deal.cd || '', offerNo: offer.no || inv.offerNo || '', items: selected.map(function (x) { var it = (offer.items || [])[x.idx] || {}; return { idx: x.idx, lineKey: it.sourceItemKey || it.pcode || it.prodCd || '', productCd: it.pcode || it.prodCd || '', item: it.name || it.nm || it.desc || '', spec: it.spec || it.st || it.detail || '', model: it.model || it.md || '', brand: it.brand || it.br || '', unit: it.unit || it.un || '', qty: x.qty }; }), totalAmount: Math.round(totalAmount), creditAmount: Math.max(0, paid(inv) + returnedAmount(inv) + Math.round(totalAmount) - (+inv.amount || 0)), reason: reason, disposition: disposition, note: note, status: 'approved', t: faDateTime(), by: curSession().name };
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
      return '<div style="display:grid;grid-template-columns:minmax(180px,1fr) minmax(240px,1fr);gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0"><b>' + escP(name) + '</b><div><input id="cfRetSearch_' + i + '" data-base="' + escP(name) + '" placeholder="جست‌وجوی نام، کد، مدل یا برند" oninput="cfReturnProductFilter(\'' + ptfOnClickArg(returnCd) + '\',' + i + ')" style="width:100%;margin-bottom:4px;box-sizing:border-box"><select id="cfRetProd_' + i + '">' + opts + '</select></div></div>';
    }).join('');
    var html = '<div class="md-b" id="cfReturnProductDlg" style="display:grid;z-index:9999;position:fixed" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px;max-height:90vh;overflow:auto"><h3>📦 تکمیل ورود به موجودی</h3><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px;margin-bottom:10px;font-size:12px">⭐ پنج پیشنهاد اول نزدیک‌ترین نتایج هستند. با جست‌وجوی نام، کد، مدل یا برند، فهرست را محدود کنید.</div>' + rows + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" onclick="cfSalesReturnAssignProducts(\'' + ptfOnClickArg(returnCd) + '\')">تایید و ورود به موجودی</button></div></div></div>';
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
  /* =====================================================================
     UR-2026-08-14: گردش حساب کامل مشتری (الگو: supplier-finance.js)
     - فیلتر بازهٔ تاریخ (از/تا شمسی)، وضعیت و جستجوی سند/مرجع
     - ثبت / ابطال / حذف وصولی از داخل گردش حساب
     - اسناد (رسید/عکس) قابل ضمیمه روی فاکتور و وصولی + مشاهده/حذف
     - خروجی PDF با بازهٔ مشخص + مانده در تاریخ گزارش
     ===================================================================== */
  function cfIso(d) {
    var s = String(d || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (typeof ptfJToISO === 'function' && /^(1[34]\d{2})[\/-]\d{1,2}[\/-]\d{1,2}/.test(s)) { try { return ptfJToISO(s) || ''; } catch (e) { return ''; } }
    return '';
  }
  function cfRowPass(row, f) {
    f = f || {};
    if (f.from && row.iso && row.iso < f.from) return false;
    if (f.to && row.iso && row.iso > f.to) return false;
    if (f.status && f.status !== 'all' && row.status !== f.status) return false;
    if (f.ref) {
      var hay = ((row.no || '') + ' ' + (row.ref || '') + ' ' + (row.note || '')).toLowerCase();
      if (hay.indexOf(String(f.ref).toLowerCase()) < 0) return false;
    }
    return true;
  }
  window.cfLedgerRows = function (cd, f) {
    f = f || {};
    var out = [];
    invs(cd).forEach(function (i) {
      var iso = cfIso(i.invDate || i.t || '');
      var remain = Math.max(0, (+i.amount || 0) - paid(i) - returnedAmount(i));
      var row = { date: i.invDate || i.t || '', iso: iso, type: 'فاکتور فروش' + (i.isUnofficial ? ' (غیررسمی)' : ''), no: i.no || i.cd, ref: i.offerNo || '', debit: +i.amount || 0, credit: 0, cur: 'IRR', status: remain > 0.5 ? 'open' : 'settled', files: cfMergeOwnerFiles(i.files, 'invoice', i._id || i.cd), link: { kind: 'invoice', cd: i.cd } };
      if (cfRowPass(row, f)) out.push(row);
      (i.payments || []).concat(i.pays || []).forEach(function (p) {
        /* payment قدیمی پس از مهاجرت فقط metadata منبع است؛ Receipt قطعی پایین‌تر
           همان پول را نمایش می‌دهد. نمایش دوباره این ردیف، مانده گردش را دوبار کم می‌کرد. */
        if (!p || p.status === 'void' || isMigratedLegacyPayment(p)) return;
        var amt = +p.amt || +p.amount || 0;
        var isReversal = p.status === 'reversal';
        var isVoided = p.voided;
        var type = isReversal ? 'ابطال وصولی' : (isVoided ? 'وصولی (ابطال‌شده)' : 'وصولی');
        var prow = { date: p.dateFa || p.date || p.t || '', iso: cfIso(p.dateFa || p.date || p.t || ''), type: type, no: p.cd || '', ref: p.how || '', debit: isReversal ? Math.abs(amt) : 0, credit: isReversal ? 0 : amt, cur: 'IRR', status: 'payment', note: p.note || '', files: cfMergeOwnerFiles(p.files, 'payment', p.cd), voided: isVoided || isReversal, link: { kind: 'payment', cd: p.cd || '', invoiceCd: i.cd } };
        if (cfRowPass(prow, f)) out.push(prow);
      });
      salesReturnsForInvoice(i).forEach(function (r) {
        var items = (r.items || []).map(function (x) { return (x.item || 'قلم') + ' × ' + x.qty; }).join('، ');
        var rrow = { date: r.t || '', iso: cfIso(r.t || ''), type: 'مرجوعی فروش', no: r.cd || '', ref: (r.reason ? r.reason + ' — ' : '') + items, debit: 0, credit: +r.totalAmount || 0, cur: 'IRR', status: 'return', link: { kind: 'return', cd: r.cd || '' } };
        if (cfRowPass(rrow, f)) out.push(rrow);
      });
    });
    /* v35: دریافت قطعی پرونده یک بستانکار مستقل در دفتر مشتری است؛ تخصیص FIFO
       فقط مانده فاکتور را کم می‌کند و ردیف نقدی دوم تولید نمی‌کند. */
    try {
      var customerCases = {}, migratedSources = {};
      (getData('ptf_crm_deals') || []).forEach(function (d) {
        if (!d || d.buyerCd !== cd) return;
        /* v34.7.26 (S3/F2-B): کلید تهی وارد نقشه نمی‌شود (نشت رسیدهای بدون caseId). */
        var ck = String(d._id || d.cd || ''); if (ck) customerCases[ck] = true;
      });
      invs(cd).forEach(function(inv){(inv.payments||[]).concat(inv.pays||[]).forEach(function(lp){if(!isMigratedLegacyPayment(lp))return;var rid=String(lp.migratedToReceiptId||'');var legacy=String(lp.cd||'');if(rid)migratedSources[rid]=legacy;if(legacy)migratedSources['legacy:'+legacy]=legacy;});});
      (getData('ptf_crm_case_receipts') || []).forEach(function (p) {
        if (!p || p.status !== 'posted' || p.voided) return;
        var pk = String(p.caseId || '');
        if (p.customerId !== cd && !(pk && customerCases[pk])) return;
        var amt = +p.amountIRR || +p.amt || 0, receiptId = String(p._id || p.cd || '');
        var legacySource = String(p.legacyPaymentRef || migratedSources[receiptId] || '');
        var migrationNote = legacySource ? ('مهاجرت‌شده از وصولی ' + legacySource + '؛ ردیف قدیمی برای جلوگیری از دوباره‌شماری نمایش داده نمی‌شود.') : '';
        var prow = { date: p.receivedAt || p.dateISO || p.t || '', iso: cfIso(p.receivedAt || p.dateISO || p.t || ''), type: legacySource ? 'دریافت قطعی پرونده (مهاجرت‌شده)' : 'دریافت قطعی پرونده', no: receiptId, ref: p.referenceNo || p.method || '', debit: 0, credit: amt, cur: 'IRR', status: 'payment', note: [p.note || '', migrationNote].filter(Boolean).join(' — '), files: cfMergeOwnerFiles(p.files, 'receipt', receiptId), link: { kind: 'case-receipt', cd: receiptId, caseId: p.caseId || '', customerCd: cd, migratedFrom: legacySource } };
        if (cfRowPass(prow, f)) out.push(prow);
      });
    } catch (eCaseReceipt) {}
    /* CHQ-MOD-001: چک‌های وارده از این مشتری در گردش (بستانکار = مبلغ چک؛ تا وصول اثر نقدی ندارد) */
    try {
      var receivedChq = (typeof window.ptfChequeReceived === 'function') ? window.ptfChequeReceived() : [];
      receivedChq.forEach(function (c) {
        if (!c || (c.sourceCustomerCd && c.sourceCustomerCd !== cd)) return;
        if (c.st !== 'open' && c.st !== 'held' && c.st !== 'endorsed') return;
        var crow = { date: c.dueFa || c.dueISO || c.t || '', iso: cfIso(c.dueISO || c.t || ''), type: 'چک وارده (در گردش)', no: c.sayad || c.no || c.cd, ref: (c.bank || '') + (c.sourceInvoiceCd ? ' (فاکتور ' + c.sourceInvoiceCd + ')' : ''), debit: 0, credit: 0, cur: 'IRR', status: 'cheque', note: c.payerName || '', link: { kind: 'cheque', cd: c.cd || '' } };
        if (cfRowPass(crow, f)) out.push(crow);
      });
    } catch (eChq) {}
    out.sort(function (a, b) { var da = a.iso || '9999-99-99', db = b.iso || '9999-99-99'; return da < db ? -1 : da > db ? 1 : 0; });
    var bal = 0;
    out.forEach(function (r) { bal += (+r.debit || 0) - (+r.credit || 0); r.balance = bal; });
    return out;
  };
  /* ---------- اسناد/ضمیمه روی فاکتور و وصولی (persist همان لحظه) ---------- */
  function cfFileKey(f) {
    return (typeof window.ptfFileStorageKey === 'function') ? window.ptfFileStorageKey(f) : String((f && f.key) || '');
  }
  function cfMergeOwnerFiles(localFiles, ownerType, ownerId) {
    var out = [], seen = {};
    function push(f) {
      var rec = (typeof window.ptfNormalizeFileRec === 'function') ? window.ptfNormalizeFileRec(f) : (f && f.key ? f : null);
      if (!rec || !rec.key || seen[rec.key]) return;
      seen[rec.key] = true;
      out.push(rec);
    }
    (localFiles || []).forEach(push);
    try {
      var id = String(ownerId || '');
      if (id) {
        (getData('ptf_crm_fin_attachments') || []).forEach(function (a) {
          if (!a || String(a.ownerType || '') !== String(ownerType || '')) return;
          if (String(a.ownerId || '') !== id) return;
          var st = String(a.status || a.st || '').toLowerCase();
          if (['void', 'voided', 'deleted', 'cancelled', 'replaced', 'superseded'].indexOf(st) > -1 || a.voided || a.deleted) return;
          push({ key: a.objectKey || a.key, name: a.name || a.fileName || a.objectKey, size: a.size });
        });
      }
    } catch (eAtt) {}
    return out;
  }
  window.cfPersistFile = function (kind, invCd, payCd, f) {
    f = (typeof window.ptfNormalizeFileRec === 'function') ? window.ptfNormalizeFileRec(f) : f;
    if (!f || !f.key) return { ok: false, why: 'input' };
    var invs = getData('ptf_crm_invoices');
    var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
    if (!inv) return { ok: false, why: 'record' };
    var rec = inv;
    if (kind === 'payment') {
      rec = ((inv.payments || []).concat(inv.pays || [])).filter(function (p) { return p.cd === payCd; })[0];
      if (!rec) return { ok: false, why: 'record' };
    }
    rec.files = rec.files || [];
    if (!rec.files.some(function (x) { return x && x.key === f.key; })) rec.files.push(f);
    setData('ptf_crm_invoices', invs);
    return { ok: true, record: rec };
  };
  window.cfForgetFile = function (kind, invCd, payCd, key) {
    var invs = getData('ptf_crm_invoices');
    var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
    if (!inv) return { ok: false };
    var rec = inv;
    if (kind === 'payment') rec = ((inv.payments || []).concat(inv.pays || [])).filter(function (p) { return p.cd === payCd; })[0];
    if (!rec) return { ok: false };
    rec.files = (rec.files || []).filter(function (f) { return f.key !== key; });
    setData('ptf_crm_invoices', invs);
    return { ok: true };
  };
  function cfAttach(kind, invCd, payCd) {
    document.querySelectorAll('#cfAttachDlg').forEach(function (el) { el.remove(); });
    var folder = 'customer-finance/' + kind + '/' + (payCd || invCd);
    var html = '<div class="md-b" id="cfAttachDlg" style="display:grid;z-index:2900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 افزودن سند</h3><div style="font-size:11.5px;color:#047857;margin-bottom:7px">پس از تکمیل آپلود، سند همان لحظه در گردش حساب ذخیره می‌شود.</div><div id="cfAttachWrap"></div><div style="text-align:left;margin-top:9px"><button class="bt" onclick="this.closest(\'.md-b\').remove()">تمام</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget === 'function') attachUploadWidget('cfAttachWrap', folder, function (f) {
      var res = window.cfPersistFile(kind, invCd, payCd, f);
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ اتصال سند به رکورد ناموفق بود', 'warn'); return; }
      if (typeof audit === 'function') { try { audit('حساب مشتری', 'افزودن پیوست ' + kind, invCd); } catch (e) {} }
      if (typeof ptfToast === 'function') ptfToast('✅ پیوست در گردش حساب ذخیره شد', 'ok');
    }, function (key) { window.cfForgetFile(kind, invCd, payCd, key); });
  }
  window.cfInvoiceAddFile = function (cd) { cfAttach('invoice', cd, ''); };
  window.cfReceiptAddFile = function (invCd, payCd) { cfAttach('payment', invCd, payCd); };
  window.cfInvoiceRemoveFile = function (cd, key) {
    if (!confirm('این سند از فاکتور و فضای ابری حذف شود؟')) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      window.cfForgetFile('invoice', cd, '', key);
      var inv = getData('ptf_crm_invoices').filter(function (i) { return i.cd === cd; })[0];
      var ofr = inv ? getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] : null;
      var custCd = (ofr && ofr.buyerCd) || (inv && inv.buyerCd) || '';
      if (typeof ptfToast === 'function') ptfToast('سند از رکورد و فضای ابری حذف شد', 'warn');
      if (custCd) cfOpen(custCd);
    });
  };
  window.cfReceiptRemoveFile = function (invCd, payCd, key) {
    if (!confirm('این سند از وصولی و فضای ابری حذف شود؟')) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      window.cfForgetFile('payment', invCd, payCd, key);
      var inv = getData('ptf_crm_invoices').filter(function (i) { return i.cd === invCd; })[0];
      var ofr = inv ? getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] : null;
      var custCd = (ofr && ofr.buyerCd) || (inv && inv.buyerCd) || '';
      if (typeof ptfToast === 'function') ptfToast('سند از رکورد و فضای ابری حذف شد', 'warn');
      if (custCd) cfOpen(custCd);
    });
  };
  /* ---------- ثبت / ابطال / حذف وصولی از داخل گردش حساب ---------- */
  window.cfReceiptPick = function (cd) {
    var list = invs(cd).filter(function (i) { return (+i.amount || 0) - paid(i) - returnedAmount(i) > 0.5; });
    if (!list.length) { alert('فاکتور بازی برای ثبت وصولی نیست.'); return; }
    if (list.length === 1) { window.cfReceiptOpen(list[0].cd); return; }
    var opts = list.map(function (i) { var rem = Math.max(0, (+i.amount || 0) - paid(i) - returnedAmount(i)); return '<option value="' + escP(i.cd) + '">' + escP(i.no || i.cd) + ' — مانده ' + m(rem) + ' ریال</option>'; }).join('');
    ptfDialog({ title: '💵 انتخاب فاکتور برای ثبت وصولی', fields: [{ id: 'inv', label: 'فاکتور', type: 'select', optionsHtml: '<option value="">— انتخاب —</option>' + opts, required: true }], okText: 'ادامه', onOk: function (v) { if (!v.inv) { alert('فاکتور را انتخاب کنید'); return; } window.cfReceiptOpen(v.inv); } });
  };
  window.cfRecHowUi = function () {
    var h = (document.getElementById('cfRecHow') || {}).value;
    var w = document.getElementById('cfRecChWrap');
    if (w) w.style.display = (h === 'چک') ? '' : 'none';
  };
  window.cfReceiptOpen = function (invCd) {
    var inv = getData('ptf_crm_invoices').filter(function (i) { return i.cd === invCd || i._id === invCd; })[0];
    if (!inv) return;
    if (window.PTF_SALES_DOMAIN_V2 && inv.caseId) {
      alert('دریافت از پرونده ثبت می‌شود و سیستم آن را FIFO به فاکتورهای باز تخصیص می‌دهد.');
      if (typeof window.ptfCaseFinanceOpen === 'function') window.ptfCaseFinanceOpen(inv.caseId);
      return;
    }
    var ofr = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {};
    var remain = Math.max(0, (+inv.amount || 0) - paid(inv) - returnedAmount(inv));
    if (remain <= 0.5) { alert('این فاکتور تسویه شده است.'); return; }
    document.querySelectorAll('#cfReceiptDlg').forEach(function (el) { el.remove(); });
    window._cfReceiptFiles = [];
    var dateHtml = typeof ptfDatePicker === 'function' ? ptfDatePicker('cfRecDate', '', '1405/05/23') : '<input type="text" id="cfRecDate" placeholder="1405/05/23" style="direction:ltr">';
    var html = '<div class="md-b" id="cfReceiptDlg" style="display:grid;z-index:2900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:92vh;overflow:auto"><h3>💵 ثبت وصولی — فاکتور ' + escP(inv.no || inv.cd) + '</h3>' +
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 11px;font-size:12px;margin-bottom:9px">ماندهٔ فاکتور: <b>' + m(remain) + ' ریال</b></div>' +
      '<div class="fr"><div class="fld"><label>تاریخ وصول (شمسی) *</label>' + dateHtml + '</div><div class="fld"><label>مبلغ (ریال) *</label><input id="cfRecAmt" data-money="1" inputmode="numeric" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>روش</label><select id="cfRecHow" onchange="cfRecHowUi()"><option>حواله بانکی</option><option>چک</option><option>نقد</option><option>سایر</option></select></div><div class="fld"><label>یادداشت</label><input id="cfRecNote"></div></div>' +
      '<div id="cfRecChWrap" style="display:none;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 10px;margin-top:6px">' +
      '<div class="fr"><div class="fld"><label>شماره / صیادی چک *</label><input id="cfRecChNo" dir="ltr" style="direction:ltr"></div><div class="fld"><label>سررسید (شمسی یا میلادی)</label><input id="cfRecChDue" dir="ltr" style="direction:ltr" placeholder="1405/06/30"></div></div>' +
      '<div class="fld"><label>بانک / شعبه</label><input id="cfRecChBank"></div>' +
      '<small style="color:#0369a1">این چک به‌عنوان «چک وارده» در ماژول چک ثبت و پیگیری می‌شود.</small></div>' +
      '<div class="fld"><label>📎 رسید / سند وصول (اختیاری)</label><div id="cfRecFileWrap" style="min-height:38px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" onclick="cfReceiptSave(\'' + ptfOnClickArg(invCd) + '\')">💾 ثبت وصولی</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget === 'function') attachUploadWidget('cfRecFileWrap', 'customer-finance/receipt/' + invCd, function (f) { if (f) window._cfReceiptFiles.push(f); });
  };
  window.cfReceiptSave = function (invCd) {
    var invs = getData('ptf_crm_invoices');
    var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
    if (!inv) return;
    var amt = typeof ptfNum === 'function' ? ptfNum((document.getElementById('cfRecAmt') || {}).value) : (+(document.getElementById('cfRecAmt') || {}).value || 0);
    var how = ((document.getElementById('cfRecHow') || {}).value || 'حواله بانکی');
    var dateRaw = ((document.getElementById('cfRecDate') || {}).value || '').trim();
    var note = ((document.getElementById('cfRecNote') || {}).value || '').trim();
    if (!amt || amt <= 0) { alert('مبلغ الزامی است'); return; }
    if (!dateRaw) { alert('تاریخ وصول الزامی است'); return; }
    var year = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(dateRaw) : ((dateRaw.match(/(13|14)\d{2}/) || [])[0] || '');
    if (year && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(year)) { alert('🔒 سال مالی ' + year + ' قفل است؛ ثبت وصولی مستقیم در آن سال مجاز نیست.'); return; }
    var curPaid = paid(inv);
    if (curPaid + amt > (+inv.amount || 0) + 0.5) { alert('مبلغ از مانده فاکتور بیشتر است (مانده: ' + Math.max(0, (+inv.amount || 0) - curPaid).toLocaleString('fa-IR') + ')'); return; }
    var payRec = { cd: genCode('RPAY'), amt: amt, how: how, dateFa: dateRaw, note: note, t: faDateTime(), by: curSession().name, status: 'posted', files: (window._cfReceiptFiles || []).slice() };
    if (how === 'چک' && typeof window.ptfChequeCreate === 'function') {
      var chNo = ((document.getElementById('cfRecChNo') || {}).value || '').trim();
      if (!chNo) { alert('⚠️ برای وصول با چک، شماره/شناسه صیادی الزامی است.'); return; }
      var due = ((document.getElementById('cfRecChDue') || {}).value || '').trim();
      var ofr = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {};
      var ch = window.ptfChequeCreate('received', {
        no: chNo, sayad: chNo, amt: amt, bank: ((document.getElementById('cfRecChBank') || {}).value || '').trim(),
        dueISO: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '',
        dueFa: /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(due) ? due : '',
        payerName: ofr.buyerCo || ofr.buyerCd || '', sourceCustomerCd: ofr.buyerCd || '', sourceInvoiceCd: invCd,
        invoiceCd: invCd, receiptCd: payRec.cd, kind: 'finance', ownership: 'received', st: 'open',
        files: (window._cfReceiptFiles || []).slice()
      });
      payRec.chequeCd = ch.cd;
    }
    inv.payments = inv.payments || [];
    inv.payments.push(payRec);
    setData('ptf_crm_invoices', invs);
    var dlg = document.getElementById('cfReceiptDlg'); if (dlg) dlg.remove();
    try { audit('وصولی', 'ثبت وصولی ' + amt.toLocaleString('fa-IR') + ' ریال برای فاکتور ' + (inv.no || invCd), inv.no || invCd); } catch (e) {}
    var ofr2 = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {};
    var custCd = ofr2.buyerCd || inv.buyerCd || '';
    if (custCd) cfOpen(custCd);
    if (typeof renderReceivables === 'function') renderReceivables();
    if (typeof ptfToast === 'function') ptfToast('وصولی ثبت شد', 'ok');
  };
  window.cfReceiptVoid = function (invCd, payCd) {
    var reason = prompt('دلیل ابطال این وصولی را وارد کنید:', 'اشتباه ثبت');
    if (reason === null) return;
    var res = window.ptfInvoicePayVoid(invCd, payCd, reason);
    var msg = { role: '⛔ نقش شما مجاز به ابطال وصولی نیست.', invoice: '⛔ فاکتور پیدا نشد.', payment: '⛔ وصولی پیدا نشد.', already: '⛔ این وصولی قبلاً ابطال شده است.', reason: '⛔ دلیل ابطال الزامی است.', legacy: '⛔ رکورد legacy بدون آرایهٔ قابل اصلاح است.', locked: '🔒 سال مالی قفل است؛ ابطال مستقیم مجاز نیست.' };
    if (!res.ok) { alert(msg[res.why] || '⛔ ابطال انجام نشد'); return; }
    var inv = getData('ptf_crm_invoices').filter(function (i) { return i.cd === invCd; })[0];
    var ofr = inv ? getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] : null;
    var custCd = (ofr && ofr.buyerCd) || (inv && inv.buyerCd) || '';
    if (custCd) cfOpen(custCd);
    if (typeof renderReceivables === 'function') renderReceivables();
    if (typeof ptfToast === 'function') ptfToast('ابطال وصولی ثبت شد و ماندهٔ فاکتور بازسازی شد', 'ok');
  };
  window.cfReceiptDelete = function (invCd, payCd) {
    var invs = getData('ptf_crm_invoices');
    var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
    if (!inv) return;
    var pay = ((inv.payments || []).concat(inv.pays || [])).filter(function (p) { return String(p.cd) === String(payCd); })[0];
    if (!pay) return;
    var rawDate = pay.dateFa || pay.t || '';
    var ym = typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(rawDate) : ((rawDate.match(/(13|14)\d{2}/) || [])[0] || '');
    if (ym && (getData('ptf_crm_fiscal_snapshots') || []).some(function (s) { return s && s.locked && String(s.year) === ym; })) { alert('🔒 سال مالی ' + ym + ' قفل است؛ حذف مستقیم مجاز نیست.'); return; }
    if (!confirm('وصولی ' + (+pay.amt || 0).toLocaleString('fa-IR') + ' ریال حذف شود؟ (حذف فیزیکی — بدون ردپای ابطال)')) return;
    if (pay.chequeCd) { var chks = getData('ptf_crm_cheques'); var ch = chks.filter(function (c) { return c.cd === pay.chequeCd; })[0]; if (ch) { ch.st = 'void'; ch.voidAt = faDateTime(); ch.voidBy = curSession().name; ch.reminderDisabled = true; setData('ptf_crm_cheques', chks); } }
    inv.payments = (inv.payments || []).filter(function (p) { return String(p.cd) !== String(payCd); });
    inv.pays = (inv.pays || []).filter(function (p) { return String(p.cd) !== String(payCd); });
    setData('ptf_crm_invoices', invs);
    try { audit('وصولی', 'حذف وصولی ' + (+pay.amt || 0) + ' برای فاکتور ' + (inv.no || invCd), String(payCd)); } catch (e) {}
    var ofr = getData('ptf_crm_offers').filter(function (x) { return x.no === inv.offerNo; })[0] || {};
    var custCd = ofr.buyerCd || inv.buyerCd || '';
    if (custCd) cfOpen(custCd);
    if (typeof renderReceivables === 'function') renderReceivables();
    if (typeof ptfToast === 'function') ptfToast('وصولی حذف شد', 'warn');
  };
  function cfFiltersFromDom() {
    var from = ((document.getElementById('cfFfrom') || {}).value || '').trim();
    var to = ((document.getElementById('cfFto') || {}).value || '').trim();
    if (typeof ptfJToISO === 'function') { from = ptfJToISO(from) || from; to = ptfJToISO(to) || to; }
    return { from: from, to: to, status: ((document.getElementById('cfFstatus') || {}).value || 'all'), ref: ((document.getElementById('cfFref') || {}).value || '').trim() };
  }
  function cfFaDigits(v) { return String(v == null ? '' : v).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function cfClaimAsOfHtml(rows, asOfFa) {
    var last = 0;
    rows.forEach(function (e) { last = +e.balance || 0; });
    var label = last > 0.5 ? 'مطالبه از مشتری در تاریخ گزارش' : (last < -0.5 ? 'اعتبار مشتری نزد شرکت در تاریخ گزارش' : 'مانده مشتری در تاریخ گزارش');
    return '<tr style="background:#fef3c7;font-weight:800"><td colspan="5">' + escP(label + ' (' + (asOfFa || '') + ')') + '</td><td><b>' + cfFaDigits(m(Math.abs(last))) + ' ریال</b></td><td></td></tr>';
  }
  function cfPrintRows(rows) {
    return rows.map(function (e) {
      return '<tr><td>' + cfFaDigits(e.date) + '</td><td>' + escP(e.type) + '</td><td><b>' + escP(e.no) + '</b>' + (e.ref ? '<br><small>' + escP(e.ref) + '</small>' : '') + (e.note ? '<br><small style="color:#64748b">' + escP(e.note) + '</small>' : '') + '</td><td>' + (e.debit ? cfFaDigits(m(e.debit)) : '—') + '</td><td>' + (e.credit ? cfFaDigits(m(e.credit)) : '—') + '</td><td><b>' + cfFaDigits(m(e.balance)) + '</b></td></tr>';
    }).join('');
  }
  window.cfLedgerCsv = function (cd) {
    var c = cust(cd), f = cfFiltersFromDom(), rows = cfLedgerRows(cd, f);
    var csv = '\uFEFF' + [['تاریخ', 'نوع', 'سند', 'مرجع', 'یادداشت', 'بدهکار', 'بستانکار', 'مانده']]
      .concat(rows.map(function (e) { return [e.date, e.type, e.no, e.ref, e.note || '', e.debit || '', e.credit || '', e.balance]; }))
      .map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'customer-ledger-' + cd + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };
  window.cfLedgerPrint = function (cd) {
    var c = cust(cd), f = cfFiltersFromDom(), rows = cfLedgerRows(cd, f);
    var rng = (f.from || f.to) ? 'بازه: ' + (typeof ptfISOToJ === 'function' && f.from ? ptfISOToJ(f.from) : (f.from || 'ابتدا')) + ' تا ' + (typeof ptfISOToJ === 'function' && f.to ? ptfISOToJ(f.to) : (f.to || 'امروز')) : 'بازه: همه تاریخ‌ها';
    var asOfIso = f.to || (new Date().toISOString().slice(0, 10));
    var asOfFa = typeof ptfISOToJ === 'function' ? ptfISOToJ(asOfIso) : asOfIso;
    var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}</style></head><body><h2>گردش حساب مشتری — ' + escP(nameOf(c)) + '</h2><p>' + escP(rng) + '</p><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>' + cfPrintRows(rows) + cfClaimAsOfHtml(rows, asOfFa) + '</tbody></table></body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گردش حساب مشتری — ' + escP(nameOf(c)), html, 'customer-ledger-' + cd); return; }
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.print();
  };

  function cfLedgerFilesHtml(e) {
    var files = (e && e.files) || [];
    if (!files.length) return '';
    return '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:6px;padding-top:5px;border-top:1px dashed var(--brd)">' +
      '<small style="color:#64748b">📎 ' + files.length.toLocaleString('fa-IR') + ' سند:</small>' +
      files.map(function (f, idx) {
        var key = String((f && f.key) || '');
        if (!key) return '';
        var name = String((f && f.name) || ('سند ' + (idx + 1)));
        var remove = '';
        if (e.link && e.link.kind === 'invoice') remove = '<button type="button" class="ba" style="color:#dc2626;padding:1px 4px" title="حذف سند" onclick="cfInvoiceRemoveFile(\'' + ptfOnClickArg(e.link.cd) + '\',\'' + ptfOnClickArg(key) + '\')">✕</button>';
        else if (e.link && e.link.kind === 'payment') remove = '<button type="button" class="ba" style="color:#dc2626;padding:1px 4px" title="حذف سند" onclick="cfReceiptRemoveFile(\'' + ptfOnClickArg(e.link.invoiceCd) + '\',\'' + ptfOnClickArg(e.link.cd) + '\',\'' + ptfOnClickArg(key) + '\')">✕</button>';
        return '<span style="display:inline-flex;align-items:center;gap:2px"><button type="button" class="ba" style="color:#0e7490;padding:2px 5px" title="مشاهده ' + escP(name) + '" onclick="openStoredFile(\'' + ptfOnClickArg(key) + '\',\'' + ptfOnClickArg(name) + '\')">👁 ' + escP(name) + '</button>' + remove + '</span>';
      }).join('') + '</div>';
  }
  function cfLedgerTable(rows) {
    return rows.map(function (e) {
      var displayRef = '<b>' + (e.type.indexOf('فاکتور') > -1 ? 'فاکتور ' : '') + escP(e.no) + '</b>' + (e.ref ? '<br><small>' + escP(e.ref) + '</small>' : '') + (e.note ? '<br><small style="color:#64748b">' + escP(e.note) + '</small>' : '');
      displayRef += cfLedgerFilesHtml(e);
      var act = '';
      if (e.link && e.link.kind === 'invoice') {
        act = '<button class="ba" title="افزودن سند" onclick="cfInvoiceAddFile(\'' + ptfOnClickArg(e.link.cd) + '\')">📎</button>' +
          ' <button class="ba" style="color:#b45309" title="پیش‌نمایش مرجوعی" onclick="cfSalesReturnPreview(\'' + ptfOnClickArg(e.link.cd) + '\')">↩️ مرجوعی</button>' +
          (e.status === 'open' ? ' <button class="ba" style="color:#047857" title="ثبت وصولی" onclick="cfReceiptOpen(\'' + ptfOnClickArg(e.link.cd) + '\')">＋ وصولی</button>' : '');
      } else if (e.link && e.link.kind === 'payment' && !e.voided) {
        act = '<button class="ba" title="افزودن سند" onclick="cfReceiptAddFile(\'' + ptfOnClickArg(e.link.invoiceCd) + '\',\'' + ptfOnClickArg(e.link.cd) + '\')">📎</button>' +
          ' <button class="ba" style="color:#dc2626" title="ابطال وصولی" onclick="cfReceiptVoid(\'' + ptfOnClickArg(e.link.invoiceCd) + '\',\'' + ptfOnClickArg(e.link.cd) + '\')">⛔ ابطال</button>' +
          ' <button class="ba" style="color:#dc2626" title="حذف وصولی" onclick="cfReceiptDelete(\'' + ptfOnClickArg(e.link.invoiceCd) + '\',\'' + ptfOnClickArg(e.link.cd) + '\')">🗑 حذف</button>';
      } else if (e.link && e.link.kind === 'case-receipt' && !e.voided) {
        act = '<button class="ba" title="اسناد دریافت قطعی" onclick="ptfFinAttachOpen(\'receipt\',\'' + ptfOnClickArg(e.link.cd) + '\')">📎</button>' +
          ' <button class="ba" style="color:#dc2626" title="ابطال دریافت قطعی" onclick="cfCaseReceiptVoid(\'' + ptfOnClickArg(e.link.cd) + '\',\'' + ptfOnClickArg(e.link.customerCd || '') + '\')">⛔ ابطال</button>' +
          ((typeof curRole === 'function' && curRole() === 'admin') ? ' <button class="ba" style="color:#991b1b" title="حذف قطعی دریافت" onclick="cfCaseReceiptDelete(\'' + ptfOnClickArg(e.link.cd) + '\',\'' + ptfOnClickArg(e.link.customerCd || '') + '\')">🗑 حذف</button>' : '');
      } else if (e.link && e.link.kind === 'return') {
        var rtn = (getData('ptf_crm_sales_returns') || []).filter(function (r) { return r.cd === e.link.cd; })[0];
        if (rtn && rtn.disposition === 'stock' && rtn.stockStatus === 'pending_product_definition') act = '<button class="ba" style="color:#b45309" onclick="cfSalesReturnStockRetry(\'' + ptfOnClickArg(e.link.cd) + '\')">📦 تکمیل موجودی</button>';
      }
      return '<tr><td>' + escP(e.date || '—') + '</td><td>' + escP(e.type) + '</td><td>' + displayRef + '</td><td>' + (e.debit ? m(e.debit) : '—') + '</td><td>' + (e.credit ? m(e.credit) : '—') + '</td><td><b>' + m(e.balance) + '</b></td><td>' + act + '</td></tr>';
    }).join('');
  }
  window.cfCaseReceiptVoid = function (receiptId, customerCd) {
    var reason = prompt('دلیل ابطال دریافت قطعی را وارد کنید:', 'ثبت تکراری / اشتباه در دریافت');
    if (reason === null || !reason.trim()) return;
    if (typeof window.ptfSalesDomainApi !== 'function') { alert('موتور مالی سرور در دسترس نیست'); return; }
    window.ptfSalesDomainApi('void_receipt', { receiptId: receiptId, reason: reason.trim(), idempotencyKey: 'CF-VOID-RCPT|' + receiptId })
      .then(function () { var dlg=document.getElementById('cfAccountDlg');if(dlg)dlg.remove();if(typeof ptfToast==='function')ptfToast('دریافت قطعی ابطال و مانده بازسازی شد','warn');cfOpen(customerCd); })
      .catch(function(e){alert('⛔ ابطال دریافت انجام نشد: '+e.message);});
  };
  window.cfCaseReceiptDelete = function (receiptId, customerCd) {
    if (typeof curRole !== 'function' || curRole() !== 'admin') { alert('حذف قطعی دریافت فقط برای ادمین مجاز است'); return; }
    if (typeof window.ptfAdminHardDelete !== 'function') { alert('موتور حذف کنترل‌شده در دسترس نیست'); return; }
    window.ptfAdminHardDelete('receipt', receiptId, function(){var dlg=document.getElementById('cfAccountDlg');if(dlg)dlg.remove();cfOpen(customerCd);});
  };
  window.cfLedgerApply = function (cd) { var m = document.getElementById('cfAccountDlg'); if (m) m.remove(); cfOpen(cd, cfFiltersFromDom()); };
  window.cfOpen = function (cd, filters) {
    /* Account dialogs are singleton: refresh in place, never stack overlays. */
    document.querySelectorAll('#cfAccountDlg').forEach(function (el) { el.remove(); });
    var c = cust(cd); if (!c) return;
    var f = filters || {};
    var rows = cfLedgerRows(cd, f);
    var pos = accountPosition(cd), migratedPairs = window.cfMigratedReceiptPairs(cd);
    var fromHtml = typeof ptfDatePicker === 'function' ? ptfDatePicker('cfFfrom', f.from || '', '1405/01/01') : '<input id="cfFfrom" value="' + escP(f.from || '') + '" placeholder="1405/01/01">';
    var toHtml = typeof ptfDatePicker === 'function' ? ptfDatePicker('cfFto', f.to || '', '1405/12/29') : '<input id="cfFto" value="' + escP(f.to || '') + '" placeholder="1405/12/29">';
    var statusHtml = '<select id="cfFstatus"><option value="all">همه</option><option value="open"' + (f.status === 'open' ? ' selected' : '') + '>فاکتور باز</option><option value="settled"' + (f.status === 'settled' ? ' selected' : '') + '>فاکتور تسویه</option><option value="payment"' + (f.status === 'payment' ? ' selected' : '') + '>وصولی</option><option value="return"' + (f.status === 'return' ? ' selected' : '') + '>مرجوعی</option><option value="cheque"' + (f.status === 'cheque' ? ' selected' : '') + '>چک وارده</option></select>';
    var h = '<div class="md-b" id="cfAccountDlg" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1000px;max-height:92vh;overflow:auto"><h3>📘 گردش حساب مشتری — ' + escP(nameOf(c)) + '</h3>' +
      '<div style="background:#fefce8;padding:10px;border-radius:10px">' +
      'مطالبات باز (ناخالص): <b>' + m(pos.balance) + ' ریال</b>' +
      (pos.credit ? ' | اعتبار نزد مشتری (ناخالص): <b style="color:#047857">' + m(pos.credit) + ' ریال</b>' : '') +
      '<br><small style="color:#475569">' + (pos.netCredit ? 'وضعیت خالص: <b style="color:#047857">' + m(pos.netCredit) + ' ریال بستانکار</b>' : 'وضعیت خالص: <b style="color:#b45309">' + m(pos.net) + ' ریال بدهکار</b>') + '</small></div>' +
      (migratedPairs.length ? '<div style="margin-top:8px;padding:8px 10px;border:1px solid '+(migratedPairs.some(function(x){return !x.ok;})?'#fdba74':'#86efac')+';border-radius:10px;background:'+(migratedPairs.some(function(x){return !x.ok;})?'#fff7ed':'#ecfdf5')+';font-size:11.5px;line-height:1.8"><b>🔄 تطبیق مهاجرت وصولی:</b> '+migratedPairs.length.toLocaleString('fa-IR')+' وصولی قدیمی به دریافت قطعی تبدیل شده است. فقط ردیف «دریافت قطعی» اثر مالی دارد و ردیف قدیمی دوباره محاسبه نمی‌شود.'+(migratedPairs.some(function(x){return !x.ok;})?' <b style="color:#b45309">برای یک ردیف، دریافت قطعی متناظر پیدا نشد؛ کیفیت داده را بررسی کنید.</b>':'')+'</div>' : '') +
      '<div class="fr" style="margin-top:8px"><div class="fld"><label>از تاریخ (شمسی)</label>' + fromHtml + '</div><div class="fld"><label>تا تاریخ (شمسی)</label>' + toHtml + '</div></div>' +
      '<div class="fr"><div class="fld"><label>وضعیت</label>' + statusHtml + '</div><div class="fld"><label>جستجوی سند/مرجع</label><input id="cfFref" value="' + escP(f.ref || '') + '" placeholder="شماره فاکتور / وصولی"></div></div>' +
      '<div class="cf-ledger-toolbar" style="display:flex;gap:7px;justify-content:flex-end;margin-bottom:9px;flex-wrap:wrap"><button class="bt bt-o" onclick="cfLedgerApply(\'' + ptfOnClickArg(cd) + '\')">🔎 اعمال فیلتر</button><button class="bt bt-o" style="background:#0e7490;color:#fff" onclick="cfLedgerPrint(\'' + ptfOnClickArg(cd) + '\')">🖨 PDF/چاپ</button><button class="bt bt-o" onclick="cfLedgerCsv(\'' + ptfOnClickArg(cd) + '\')">📥 CSV</button><button class="bt" onclick="cfReceiptPick(\'' + ptfOnClickArg(cd) + '\')">💵 ثبت وصولی</button></div>' +
      '<div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده جاری</th><th>عملیات</th></tr></thead><tbody>' +
      (cfLedgerTable(rows) || '<tr><td colspan="7">گردشی مطابق فیلتر نیست</td></tr>') +
      cfClaimAsOfHtml(rows, (typeof ptfISOToJ === 'function' && f.to ? ptfISOToJ(f.to) : (typeof ptfTodayJ === 'function' ? ptfTodayJ() : ''))) +
      '</tbody></table></div>' +
      '<div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">✕ بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', h);
  };

  window.cfFinanceRowsRender = function () {
    var tbl = document.getElementById('cfFinanceTbl');
    if (tbl) tbl.innerHTML = window.cfFinanceRowsHtml();
  };
  window.cfFinanceRowsHtml = function () {
    var q = String(window._cfSearch || ''), all = window.cfAccountRows(''), rows = window.cfAccountRows(q);
    var openN = all.filter(accountIsOpen).length;
    /* UR-2026-08-01-07: سورت ستون‌ها (مشتری/مطالبات/اعتبار) */
    if (window.ptfRegisterSortable) window.ptfRegisterSortable('cf', {
      getters: { co: function (r) { return r.co || ''; }, balance: function (r) { return r.balance; }, credit: function (r) { return r.credit; } },
      render: window.cfFinanceRowsRender
    });
    rows = (typeof window.ptfSorted === 'function') ? window.ptfSorted('cf', rows) : rows;
    /* حساب باز همیشه بالاست؛ sort انتخابی فقط ترتیب داخل گروه باز/بسته را تعیین می‌کند. */
    rows = rows.filter(accountIsOpen).concat(rows.filter(function(r){return !accountIsOpen(r);}));
    var table = rows.map(function (r) {
      var open = accountIsOpen(r);
      return '<tr' + (open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(r.co || r.cd) + '</b><br><small style="color:#94a3b8;direction:ltr">' + escP(r.cd || '') + '</small></td><td style="font-weight:' + (open ? '900' : '400') + ';color:' + (open ? '#b45309' : '#64748b') + '">' + m(r.balance) + ' ریال</td><td style="color:#047857">' + (r.credit ? m(r.credit) + ' ریال' : '—') + '</td><td><button class="ba" onclick="cfOpen(\'' + ptfOnClickArg(r.cd) + '\')">📘 حساب</button></td></tr>';
    }).join('');
    return table || '<tr><td colspan="4">موردی مطابق جست‌وجو نیست</td></tr>';
  };
  window.cfFinanceHtml = function () {
    var q = String(window._cfSearch || ''), all = window.cfAccountRows(''), rows = window.cfAccountRows(q);
    var openN = all.filter(accountIsOpen).length;
    var table = rows.map(function (r) {
      var open = accountIsOpen(r);
      return '<tr' + (open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(r.co || r.cd) + '</b><br><small style="color:#94a3b8;direction:ltr">' + escP(r.cd || '') + '</small></td><td style="font-weight:' + (open ? '900' : '400') + ';color:' + (open ? '#b45309' : '#64748b') + '">' + m(r.balance) + ' ریال</td><td style="color:#047857">' + (r.credit ? m(r.credit) + ' ریال' : '—') + '</td><td><button class="ba" onclick="cfOpen(\'' + ptfOnClickArg(r.cd) + '\')">📘 حساب</button></td></tr>';
    }).join('');
    return '<div id="cfFinanceHubBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">📘 حساب مشتریان</h4><small style="color:#64748b">' + openN.toLocaleString('fa-IR') + ' حساب باز یا دارای اعتبار، ابتدا نمایش داده می‌شود.</small></div><input id="cfSearch" value="' + escP(q) + '" oninput="cfFinanceSearch(this.value)" placeholder="جست‌وجوی نام یا کد مشتری" style="min-width:230px;direction:rtl"></div><div class="tb2" style="margin-top:10px"><table><thead><tr>' +
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

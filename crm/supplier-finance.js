/* =====================================================================
   PTF CRM — Sprint 262 / v26.2
   Supplier Finance — Phase 1: purchase invoices + read-only supplier balance
   Isolated data key; no automatic migration of legacy payables.
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'ptf_crm_supplier_finance';
  function data() {
    try { var d = JSON.parse(localStorage.getItem(KEY) || '{}'); return d && !Array.isArray(d) ? Object.assign({ schema: 1, invoices: [], payments: [] }, d) : { schema: 1, invoices: [], payments: [] }; }
    catch (e) { return { schema: 1, invoices: [], payments: [] }; }
  }
  function save(d) { d = d || { schema: 1, invoices: [], payments: [] }; d.schema = 1; d.invoices = d.invoices || []; d.payments = d.payments || []; setData(KEY, d); }
  function nrm(v) { try { return typeof dedupNorm === 'function' ? dedupNorm(v) : String(v || '').trim().toLowerCase(); } catch (e) { return String(v || '').trim().toLowerCase(); } }
  function money(v) { return (+v || 0).toLocaleString('fa-IR'); }
  function supplier(cd) { return getData('ptf_crm_suppliers').filter(function (s) { return s.cd === cd; })[0]; }
  function canSee() { try { return !!((roleDef() || {}).buyPrice || isSenior()); } catch (e) { return false; } }
  function canWrite() { return canSee(); } /* Sprint 262: همان policy فعلی تامین‌کنندگان؛ پرداخت در Sprint 263 RBAC جدا دارد. */
  function activeInvoices(d) { return (d.invoices || []).filter(function (i) { return i.status !== 'void'; }); }
  function invPaid(inv, d) {
    return (d.payments || []).filter(function (p) { return p.status !== 'void'; }).reduce(function (sum, p) {
      return sum + (p.allocations || []).filter(function (a) { return a.invoiceCd === inv.cd; }).reduce(function (s, a) { return s + (+a.amount || 0); }, 0);
    }, 0);
  }
  function invRemain(inv, d) { return Math.max(0, (+inv.amount || 0) - invPaid(inv, d)); }
  function legacyOpen(sup) {
    return getData('ptf_crm_payables').filter(function (p) {
      return p.pay === 'credit' && !p.settled && !p.sfInvoiceCd && nrm(p.sup) === nrm(sup.co || sup.name || '');
    });
  }
  function linkedLegacyIds(d) {
    var out = {}; activeInvoices(d).forEach(function (i) { (i.legacyPayableCds || []).forEach(function (cd) { out[cd] = true; }); }); return out;
  }
  function balance(supCd) {
    var d = data(), sup = supplier(supCd), name = sup ? sup.co : '';
    var by = {}, linked = linkedLegacyIds(d);
    activeInvoices(d).filter(function (i) { return i.supplierCd === supCd; }).forEach(function (i) {
      var c = i.cur || 'IRR', r = invRemain(i, d); if (!by[c]) by[c] = { cur: c, amount: 0, irr: 0, invoices: 0, legacy: 0, warn: 0 };
      by[c].amount += r; by[c].irr += c === 'IRR' ? r : r * (+i.rate || 0); by[c].invoices++;
      if ((i.legacyPayableCds || []).length) {
        var legacyTotal = getData('ptf_crm_payables').filter(function (p) { return (i.legacyPayableCds || []).indexOf(p.cd) > -1; }).reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
        if (i.amountIrr && Math.abs((+i.amountIrr || 0) - legacyTotal) > 1) by[c].warn++;
      }
    });
    legacyOpen(sup || { co: name }).forEach(function (p) {
      if (linked[p.cd]) return;
      var c = p.cur || 'IRR', r = typeof ptfPayableRemain === 'function' ? ptfPayableRemain(p) : Math.max(0, (+p.amount || 0) - (p.paid || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0));
      if (!by[c]) by[c] = { cur: c, amount: 0, irr: 0, invoices: 0, legacy: 0, warn: 0, credit: 0 };
      by[c].amount += r; by[c].irr += c === 'IRR' ? r : r * (+p.rate || 0); by[c].legacy++;
    });
    (d.adjustments || []).filter(function (a) { return a.status !== 'void' && a.supplierCd === supCd; }).forEach(function (a) { var c=a.cur||'IRR'; if(!by[c]) by[c]={cur:c,amount:0,irr:0,invoices:0,legacy:0,warn:0,credit:0}; by[c].amount += (+a.amount||0); by[c].irr += c==='IRR'?(+a.amount||0):(+a.amount||0)*(+a.rate||0); });
    (d.payments || []).filter(function (p) { return p.status !== 'void' && p.supplierCd === supCd; }).forEach(function (p) {
      var c = p.cur || 'IRR';
      if (!by[c]) by[c] = { cur: c, amount: 0, irr: 0, invoices: 0, legacy: 0, warn: 0, credit: 0 };
    });
    Object.keys(by).forEach(function (c) {
      var cr = supplierCredit(supCd, c, d);
      if (!cr) return;
      by[c].amount -= cr;
      by[c].irr -= c === 'IRR' ? cr : cr * ((activeInvoices(d).filter(function (i) { return i.supplierCd === supCd && i.cur === c; })[0] || {}).rate || 0);
      by[c].credit = cr;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  function balanceHtml(supCd) {
    var b = balance(supCd); if (!b.length) return '<span style="color:#059669">مانده باز ندارد</span>';
    return b.map(function (x) { return '<span><b style="color:#b45309">' + money(x.amount) + ' ' + escP(x.cur) + '</b>' + (x.legacy ? ' <small style="color:#64748b">(' + x.legacy + ' تعهد legacy)</small>' : '') + (x.warn ? ' <small style="color:#dc2626">⚠️ مغایرت لینک</small>' : '') + '</span>'; }).join('<br>');
  }
  window.slSupplierOpenTotalsIRR = function () {
    var debt = 0, credit = 0, fx = {};
    getData('ptf_crm_suppliers').forEach(function (s) {
      balance(s.cd).forEach(function (b) {
        if (b.cur === 'IRR') {
          if (b.amount >= 0) debt += b.amount;
          else credit += Math.abs(b.amount);
        } else {
          fx[b.cur] = (fx[b.cur] || 0) + b.amount;
        }
      });
    });
    return { debt: Math.round(debt), credit: Math.round(credit), fx: fx, source: 'supplier_finance_balance' };
  };
  function supplierOptions(selected) {
    return getData('ptf_crm_suppliers').map(function (s) { return '<option value="' + escP(s.cd) + '"' + (s.cd === selected ? ' selected' : '') + '>' + escP(s.co || s.cd) + '</option>'; }).join('');
  }
  window.slNewInvoice = function (supCd) {
    if (!canWrite()) { alert('⛔ دسترسی ثبت فاکتور خرید ندارید'); return; }
    if (supCd) { window.slInvoiceForm(supCd); return; }
    ptfDialog({ title: '🧾 انتخاب تأمین‌کننده برای فاکتور خرید', fields: [{ id: 'sup', label: 'تأمین‌کننده *', type: 'select', optionsHtml: '<option value="">— انتخاب کنید —</option>' + supplierOptions(''), required: true }], okText: 'ادامه', onOk: function (v) { if (!v.sup) { alert('تأمین‌کننده را انتخاب کنید'); return; } window.slInvoiceForm(v.sup); } });
  };
  window.slInvoiceForm = function (supCd) {
    var sup = supplier(supCd); if (!sup) { alert('تأمین‌کننده یافت نشد'); return; }
    var legacy = legacyOpen(sup), d = data(); window._slInvFiles = [];
    var legacyHtml = legacy.length ? legacy.map(function (p) {
      var rem = typeof ptfPayableRemain === 'function' ? ptfPayableRemain(p) : (+p.amount || 0);
      return '<label style="display:flex;gap:7px;padding:6px 0;border-bottom:1px dashed var(--brd);font-size:12px"><input class="slLegacy" type="checkbox" value="' + escP(p.cd) + '"><span><b>' + escP(p.item || '-') + '</b> — ' + money(rem) + ' ' + escP(p.cur || 'IRR') + ' <small style="color:#94a3b8">(' + escP(p.inqNo || '') + ')</small></span></label>';
    }).join('') : '<small style="color:#94a3b8">تعهد خرید اعتباری legacy بازی برای این تأمین‌کننده نیست.</small>';
    var html = '<div class="md-b" id="slInvDlg" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px;max-height:92vh;overflow:auto"><h3>🧾 ثبت فاکتور خرید — ' + escP(sup.co || '') + '</h3>' +
      '<div style="font-size:12px;line-height:1.8;color:#64748b;margin-bottom:10px">فاکتور مستقل ثبت می‌شود. اتصال به تعهدهای خرید واقعی اختیاری است و فقط برای جلوگیری از دوباره‌شماری در زیر‌دفتر استفاده می‌شود.</div>' +
      '<div class="fr"><div class="fld"><label>شماره فاکتور *</label><input id="slInvNo" style="direction:ltr"></div><div class="fld"><label>تاریخ فاکتور *</label><input id="slInvDate" value="' + (typeof ptfTodayJ === 'function' ? ptfTodayJ() : '') + '" placeholder="1405/04/22" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>ارز *</label><select id="slInvCur" onchange="document.getElementById(\'slInvRateWrap\').style.display=this.value===\'IRR\'?\'none\':\'\'"><option value="IRR">ریال (IRR)</option><option value="USD">دلار (USD)</option><option value="EUR">یورو (EUR)</option><option value="CNY">یوان (CNY)</option><option value="AED">درهم (AED)</option><option value="GBP">پوند (GBP)</option></select></div><div class="fld"><label>مبلغ فاکتور *</label><input id="slInvAmt" data-money="1" inputmode="numeric" style="direction:ltr"></div></div>' +
      '<div class="fld" id="slInvRateWrap" style="display:none"><label>نرخ تسعیر (ریال به‌ازای هر واحد ارز) *</label><input id="slInvRate" data-money="1" inputmode="numeric" style="direction:ltr"></div>' +
      '<div class="fr"><div class="fld"><label>نوع فاکتور *</label><select id="slInvType"><option value="unofficial">غیررسمی (بدون کد اقتصادی)</option><option value="official">رسمی (ارزش افزوده/کد اقتصادی)</option></select></div><div class="fld"><label>یادداشت / شرح</label><input id="slInvNote"></div></div>' +
      '<div class="fld"><label>اتصال اختیاری به تعهدهای خرید واقعی</label><div style="border:1px solid var(--brd);border-radius:10px;padding:7px 10px;max-height:150px;overflow:auto">' + legacyHtml + '</div></div>' +
      '<div class="fld"><label>تصویر/فایل فاکتور (اختیاری)</label><div id="slInvFileWrap"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="document.getElementById(\'slInvDlg\').remove()">انصراف</button><button class="bt" onclick="slInvoiceSave(\'' + escP(supCd) + '\')">💾 ثبت فاکتور</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget === 'function') attachUploadWidget('slInvFileWrap', 'supplier-invoices/' + supCd, function (f) { window._slInvFiles.push(f); });
  };
  window.slInvoiceSave = function (supCd) {
    // v30.8 FIN-EX-01: یکتایی شماره فاکتور خرید
    try{
      var noCheck = ((document.getElementById('slInvNo') || {}).value || '').trim();
      if(noCheck){
        var allInv = (function(){ try{return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance')||'{}')}catch(e){return {}}; })();
        var exists = (allInv.invoices||[]).some(function(inv){ return (inv.no||'').toLowerCase()===noCheck.toLowerCase() && inv.supplierCd===supCd; });
        if(exists){ alert('⛔ فاکتور با شماره '+noCheck+' قبلاً برای همین تامین‌کننده ثبت شده - شماره تکراری مجاز نیست (FIN-EX-01)'); return; }
      }
    }catch(e){}

    var sup = supplier(supCd), no = ((document.getElementById('slInvNo') || {}).value || '').trim(), date = ((document.getElementById('slInvDate') || {}).value || '').trim(); date = (typeof ptfJToISO === 'function' ? (ptfJToISO(date) || date) : date);
    var cur = ((document.getElementById('slInvCur') || {}).value || 'IRR'), amount = typeof ptfNum === 'function' ? ptfNum((document.getElementById('slInvAmt') || {}).value) : +(document.getElementById('slInvAmt') || {}).value || 0;
    var rate = cur === 'IRR' ? 1 : (typeof ptfNum === 'function' ? ptfNum((document.getElementById('slInvRate') || {}).value) : +(document.getElementById('slInvRate') || {}).value || 0);
    if (!sup || !no || !date || amount <= 0 || (cur !== 'IRR' && rate <= 0)) { alert('شماره، تاریخ، مبلغ و برای ارز خارجی نرخ تسعیر الزامی است'); return; }
    var d = data();
    if (activeInvoices(d).some(function (i) { return i.supplierCd === supCd && String(i.no || '').trim() === no; })) { alert('این شماره فاکتور قبلاً برای همین تأمین‌کننده ثبت شده است'); return; }
    var links = []; document.querySelectorAll('#slInvDlg .slLegacy:checked').forEach(function (x) { links.push(x.value); });
    var isOfficial = ((document.getElementById('slInvType') || {}).value) === 'official';
    var inv = { cd: genCode('SFINV'), supplierCd: supCd, supName: sup.co || '', no: no, dateISO: date, dateFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(date) : date, cur: cur, rate: rate, amount: amount, amountIrr: cur === 'IRR' ? amount : Math.round(amount * rate), note: ((document.getElementById('slInvNote') || {}).value || '').trim(), isOfficial: isOfficial, legacyPayableCds: links, files: (window._slInvFiles || []).slice(), status: 'open', t: faDateTime(), by: curSession().name };
    d.invoices.unshift(inv); save(d);
    if (links.length) { var pays = getData('ptf_crm_payables'); pays.forEach(function (p) { if (links.indexOf(p.cd) > -1) p.sfInvoiceCd = inv.cd; }); setData('ptf_crm_payables', pays); }
    try { audit('فاکتور خرید تامین', 'ثبت فاکتور ' + no + ' برای ' + sup.co + ' — ' + money(amount) + ' ' + cur + (links.length ? ' | اتصال به ' + links.length + ' تعهد خرید' : ''), inv.cd); } catch (e) {}
    var m = document.getElementById('slInvDlg'); if (m) m.remove();
    if (typeof ptfToast === 'function') ptfToast('✅ فاکتور خرید ثبت شد', 'ok');
    window.slOpenLedger(supCd);
  };
  window.slOpenLedger = function (supCd) {
    if (!canSee()) { alert('⛔ دسترسی ندارید'); return; }
    var sup = supplier(supCd); if (!sup) return; var d = data(), invs = activeInvoices(d).filter(function (i) { return i.supplierCd === supCd; }), linked = linkedLegacyIds(d), legacy = legacyOpen(sup).filter(function (p) { return !linked[p.cd]; });
    var invRows = invs.map(function (i) { return '<tr><td>' + escP(i.dateFa || i.dateISO) + '</td><td><b>' + escP(i.no) + '</b></td><td>' + money(i.amount) + ' ' + escP(i.cur) + '</td><td>' + money(invRemain(i, d)) + ' ' + escP(i.cur) + '</td><td>' + (i.files || []).map(function (f) { return f.key ? '<a href="javascript:void(0)" onclick="openStoredFile(\'' + escP(f.key) + '\')">📎</a>' : '📎'; }).join(' ') + '</td><td><button class="ba" onclick="slInvoiceEdit(\'' + escP(i.cd) + '\')">✏️</button> <button class="ba" onclick="slInvoiceAddFile(\'' + escP(i.cd) + '\')">📎</button> <button class="ba" style="color:#dc2626" onclick="slInvoiceVoid(\'' + escP(i.cd) + '\')">ابطال</button></td></tr>'; }).join('');
    var legRows = legacy.map(function (p) { var rem = typeof ptfPayableRemain === 'function' ? ptfPayableRemain(p) : (+p.amount || 0); return '<tr><td>' + escP(p.t || '') + '</td><td>تعهد خرید</td><td>' + escP(p.item || '') + '</td><td>' + money(rem) + ' ' + escP(p.cur || 'IRR') + '</td></tr>'; }).join('');
    var payRows = (d.payments || []).filter(function (p) { return p.supplierCd === supCd; }).map(function (p) { return '<tr><td>' + escP(p.dateFa || p.dateISO) + '</td><td>' + escP(p.method || '') + '</td><td>' + money(p.amount) + ' ' + escP(p.cur) + '</td><td>' + (p.status === 'void' ? 'ابطال‌شده' : (p.unallocated ? 'اعتبار: ' + money(p.unallocated) : 'تخصیص‌یافته')) + '</td><td>' + (p.status === 'void' ? '' : '<button class="ba" onclick="slPaymentEdit(\'' + escP(p.cd) + '\')">✏️</button> <button class="ba" onclick="slPaymentAddFile(\'' + escP(p.cd) + '\')">📎</button> <button class="ba" style="color:#dc2626" onclick="slPaymentVoid(\'' + escP(p.cd) + '\')">ابطال</button>') + '</td></tr>'; }).join('');
    var html = '<div class="md-b" id="slLedgerDlg" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:92vh;overflow:auto"><h3>📒 حساب تأمین‌کننده — ' + escP(sup.co || '') + '</h3><div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:9px 12px;margin-bottom:10px">' + balanceHtml(supCd) + '<br><small style="color:#64748b">مانده مثبت = بدهی ما / بستانکاری تأمین‌کننده. پرداخت و چک در Sprint 263 و 264 افزوده می‌شوند.</small></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px"><button class="bt bt-o" onclick="document.getElementById(\'slLedgerDlg\').remove();slPaymentStart(\'' + escP(supCd) + '\')">💰 پرداخت</button><button class="bt" onclick="document.getElementById(\'slLedgerDlg\').remove();slNewInvoice(\'' + escP(supCd) + '\')">＋ فاکتور خرید</button></div><h4>فاکتورهای خرید</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>شماره</th><th>مبلغ</th><th>مانده</th><th>فایل</th><th></th></tr></thead><tbody>' + (invRows || '<tr><td colspan="6">فاکتوری ثبت نشده</td></tr>') + '</tbody></table></div><h4 style="margin-top:14px">پرداخت‌ها و اعتبار</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>روش</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead><tbody>' + (payRows || '<tr><td colspan="5">پرداختی ثبت نشده</td></tr>') + '</tbody></table></div><h4 style="margin-top:14px">تعهدهای خرید legacy بدون فاکتور لینک‌شده</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>شرح</th><th>مانده</th></tr></thead><tbody>' + (legRows || '<tr><td colspan="4">موردی نیست</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.slInvoiceVoid = function (cd) {
    var d = data(), inv = (d.invoices || []).filter(function (i) { return i.cd === cd; })[0]; if (!inv) return;
    if (invPaid(inv, d) > 0) { alert('فاکتور دارای پرداخت است؛ ابطال آن به Sprint پرداخت/reversal نیاز دارد'); return; }
    if (!confirm('فاکتور ' + inv.no + ' ابطال شود؟')) return;
    inv.status = 'void'; inv.voidAt = faDateTime(); inv.voidBy = curSession().name; save(d);
    var pays = getData('ptf_crm_payables'); pays.forEach(function (p) { if (p.sfInvoiceCd === cd) delete p.sfInvoiceCd; }); setData('ptf_crm_payables', pays);
    try { audit('فاکتور خرید تامین', 'ابطال فاکتور ' + inv.no + ' — ' + inv.supName, cd); } catch (e) {}
    var m = document.getElementById('slLedgerDlg'); if (m) m.remove(); window.slOpenLedger(inv.supplierCd);
  };
  /* ============ Sprint 263: payment + manual allocation ============ */
  function paymentAllocated(p) { return (p.allocations || []).reduce(function (s, a) { return s + (+a.amount || 0); }, 0); }
  function supplierCredit(supCd, cur, d) {
    return (d.payments || []).filter(function (p) { return p.status !== 'void' && p.supplierCd === supCd && p.cur === cur; }).reduce(function (s, p) { return s + Math.max(0, (+p.amount || 0) - paymentAllocated(p)); }, 0);
  }
  function slCustomerOptions() {
    return getData('ptf_crm_customers').map(function (c) { return '<option value="' + escP(c.cd) + '">' + escP(c.co || c.cd) + '</option>'; }).join('');
  }
  function slCustomerInvoicesOptions() {
    var offers = getData('ptf_crm_offers'), customers = getData('ptf_crm_customers'), invs = getData('ptf_crm_invoices');
    return invs.filter(function (i) { var paid = ((i.payments || []).concat(i.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0); return (+i.amount || 0) - paid > 0; }).map(function (i) {
      var o = offers.filter(function (x) { return x.no === i.offerNo; })[0] || {}, c = customers.filter(function (x) { return x.cd === o.buyerCd; })[0] || {};
      return '<option value="' + escP(i.cd) + '" data-cust="' + escP(o.buyerCd || '') + '">' + escP(c.co || o.buyerCo || '-') + ' — ' + escP(i.no || i.cd) + ' — مانده ' + money((+i.amount || 0) - ((i.payments || []).concat(i.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0)) + ' ریال</option>';
    }).join('');
  }
  window.slPayMethodUi = function () {
    var m = (document.getElementById('slPayMethod') || {}).value || '';
    var c = document.getElementById('slChequeWrap'), t = document.getElementById('slThirdWrap');
    if (c) c.style.display = (m === 'company_cheque' || m === 'third_party_cheque') ? '' : 'none';
    if (t) t.style.display = m === 'third_party_cheque' ? '' : 'none';
  };
  function slChequeCreate(method, sup, amount, cur, payCd, date) {
    if (method !== 'company_cheque' && method !== 'third_party_cheque') return { ok: true };
    if (cur !== 'IRR') return { ok: false, error: 'پرداخت با چک در این Sprint فقط برای فاکتورهای ریالی مجاز است' };
    var no = ((document.getElementById('slChNo') || {}).value || '').trim(), due = ((document.getElementById('slChDue') || {}).value || '').trim(), bank = ((document.getElementById('slChBank') || {}).value || '').trim();
    if (!no || !due) return { ok: false, error: 'شماره/صیاد و تاریخ سررسید چک الزامی است' };
    var checks = getData('ptf_crm_cheques');
    if (checks.some(function (c) { return (c.sayad || c.no) === no && c.st !== 'voided_transfer'; })) return { ok: false, error: 'این شماره/شناسه چک قبلاً ثبت شده است' };
    var rec = { cd: genCode('CHQ'), no: no, sayad: no, amt: amount, dueISO: due, dueFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(due) : due, bank: bank, toWhom: sup.co || '', kind: 'finance', ownership: method === 'company_cheque' ? 'company' : 'third_party', supplierPaymentCd: payCd, supplierCd: sup.cd, createdBySupplierFinance: true, t: faDateTime(), by: curSession().user, byNm: curSession().name, notified: {} };
    if (method === 'company_cheque') { rec.st = 'open'; }
    else {
      var sourceCd = ((document.getElementById('slThirdCust') || {}).value || '').trim(), invCd = ((document.getElementById('slThirdInv') || {}).value || '').trim();
      var invs = getData('ptf_crm_invoices'), inv = invs.filter(function (i) { return i.cd === invCd; })[0];
      /* Sprint 267: چک ثالث می‌تواند صرفاً انتقالی باشد؛ اتصال به مشتری/مطالبات اختیاری است. */
      if ((sourceCd && !inv) || (!sourceCd && inv)) return { ok: false, error: 'برای کسر از مطالبات، مشتری و فاکتور مشتری را هر دو انتخاب کنید؛ در غیر این صورت هر دو را خالی بگذارید.' };
      if (sourceCd && inv) {
        var srcOffer = getData('ptf_crm_offers').filter(function (o) { return o.no === inv.offerNo; })[0] || {};
        if (srcOffer.buyerCd !== sourceCd) return { ok: false, error: 'فاکتور انتخاب‌شده متعلق به مشتری انتخاب‌شده نیست' };
        var paid = ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0);
        if (amount > (+inv.amount || 0) - paid) return { ok: false, error: 'مبلغ چک از مانده فاکتور مشتری بیشتر است' };
        inv.payments = inv.payments || []; inv.payments.push({ amt: amount, how: 'چک ثالث منتقل‌شده به تامین‌کننده', t: faDate(), by: curSession().name, chequeCd: rec.cd, supplierPaymentCd: payCd, transferred: true }); setData('ptf_crm_invoices', invs);
      }
      rec.st = 'transferred'; rec.reminderDisabled = true; rec.sourceCustomerCd = sourceCd; rec.sourceInvoiceCd = invCd; rec.transferredAt = faDateTime(); rec.transferNote = 'انتقال به تامین‌کننده ' + (sup.co || '');
    }
    checks.unshift(rec); setData('ptf_crm_cheques', checks);
    if (method === 'company_cheque' && typeof chUpsertReminder === 'function') chUpsertReminder(rec);
    try { audit('چک‌ها', method === 'company_cheque' ? 'ثبت چک شرکت برای پرداخت تامین‌کننده ' + sup.co : 'ثبت و انتقال چک ثالث به تامین‌کننده ' + sup.co, rec.cd); } catch (e) {}
    return { ok: true, cheque: rec };
  }

    window.slPaymentStart = function (supCd) {
    var sup = supplier(supCd); if (!sup) return;
    var d = data(), curs = activeInvoices(d).filter(function (i) { return i.supplierCd === supCd && invRemain(i, d) > 0; }).map(function (i) { return i.cur || 'IRR'; });
    curs = curs.filter(function (x, i, a) { return a.indexOf(x) === i; });
    if (!curs.length) curs = ['IRR'];
    ptfDialog({ title: '💰 پرداخت به ' + escP(sup.co), fields: [{ id: 'cur', label: 'ارز پرداخت', type: 'select', options: curs }], okText: 'ادامه', onOk: function (v) { slPaymentForm(supCd, v.cur); } });
  };
  window.slPaymentForm = function (supCd, cur) {
    var sup = supplier(supCd), d = data(); if (!sup) return;
    var invs = activeInvoices(d).filter(function (i) { return i.supplierCd === supCd && (i.cur || 'IRR') === cur && invRemain(i, d) > 0; });
    var rows = invs.map(function (i) { var rem = invRemain(i, d); return '<tr><td><b>' + escP(i.no) + '</b><br><small>' + escP(i.dateFa || i.dateISO) + '</small></td><td>' + money(rem) + ' ' + escP(cur) + '</td><td><input class="slAlloc" data-inv="' + escP(i.cd) + '" data-rem="' + rem + '" data-money="1" inputmode="numeric" value="0" style="width:130px;direction:ltr"></td></tr>'; }).join('');
    var legacyRows = legacyOpen(sup).filter(function (p) { return (p.cur || 'IRR') === cur; }).map(function (p) { var rem = typeof ptfPayableRemain === 'function' ? ptfPayableRemain(p) : (+p.amount || 0); return '<tr style="background:#fff7ed"><td><b>تعهد خرید بدون فاکتور</b><br><small>' + escP(p.item || p.inqNo || '') + '</small></td><td>' + money(rem) + ' ' + escP(cur) + '</td><td><input class="slAlloc" data-legacy="' + escP(p.cd) + '" data-rem="' + rem + '" data-money="1" inputmode="numeric" value="0" style="width:130px;direction:ltr"></td></tr>'; }).join('');
    rows += legacyRows;
    var html = '<div class="md-b" id="slPayDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto"><h3>💰 ثبت پرداخت — ' + escP(sup.co) + '</h3><div class="fr"><div class="fld"><label>تاریخ پرداخت *</label><input id="slPayDate" value="' + (typeof ptfTodayJ === 'function' ? ptfTodayJ() : '') + '" placeholder="1405/04/22" style="direction:ltr"></div><div class="fld"><label>روش پرداخت *</label><select id="slPayMethod" onchange="slPayMethodUi()"><option value="cash">💵 نقدی</option><option value="bank">🏦 حواله / بانکی</option><option value="credit">🔁 تهاتر / اعتبار</option><option value="company_cheque">🧾 چک شرکت</option><option value="third_party_cheque">↪ چک ثالث منتقل‌شده</option></select></div></div><div class="fld"><label>مبلغ کل پرداخت (' + escP(cur) + ') *</label><input id="slPayAmt" data-money="1" inputmode="numeric" style="direction:ltr"></div>' + (cur !== 'IRR' ? '<div class="fld"><label>نرخ تسعیر (ریال به‌ازای هر ' + escP(cur) + ') *</label><input id="slPayRate" data-money="1" inputmode="numeric" style="direction:ltr"></div>' : '') + '<div class="fld"><label>شرح</label><input id="slPayNote"></div><div id="slChequeWrap" style="display:none"><div class="fr"><div class="fld"><label>شماره / شناسه صیادی چک *</label><input id="slChNo" style="direction:ltr"></div><div class="fld"><label>تاریخ سررسید *</label><input id="slChDue" placeholder="1405/04/29" style="direction:ltr"></div></div><div class="fld"><label>بانک / شعبه</label><input id="slChBank"></div></div><div id="slThirdWrap" style="display:none"><div class="fld"><label>مشتری / صادرکننده چک ثالث *</label><select id="slThirdCust"><option value="">— مشتری را انتخاب کنید —</option>'+ slCustomerOptions() +'</select></div><div class="fld"><label>فاکتور مشتری که از مطالبات آن کسر می‌شود *</label><select id="slThirdInv"><option value="">— فاکتور را انتخاب کنید —</option>'+ slCustomerInvoicesOptions() +'</select></div><small style="color:#0369a1">این چک منتقل‌شده خارج از ید شرکت است؛ reminder ندارد و مبلغ آن از فاکتور مشتری انتخاب‌شده کسر می‌شود.</small></div><h4>تخصیص دستی به فاکتورها</h4><div class="tb2"><table><thead><tr><th>فاکتور</th><th>مانده</th><th>مبلغ تخصیص</th></tr></thead><tbody>' + (rows || '<tr><td colspan="3">فاکتور بازی در این ارز نیست؛ مبلغ پرداخت به اعتبار تأمین‌کننده تبدیل می‌شود.</td></tr>') + '</tbody></table></div><small style="color:#64748b">مجموع تخصیص‌ها می‌تواند کمتر از مبلغ پرداخت باشد؛ باقیمانده به اعتبار شرکت نزد تأمین‌کننده تبدیل می‌شود.</small><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="document.getElementById(\'slPayDlg\').remove()">انصراف</button><button class="bt" onclick="slPaymentSave(\'' + escP(supCd) + '\',\'' + escP(cur) + '\')">💾 ثبت پرداخت</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.slPaymentSave = function (supCd, cur) {
    var d = data(), date = ((document.getElementById('slPayDate') || {}).value || '').trim(); date = (typeof ptfJToISO === 'function' ? (ptfJToISO(date) || date) : date); var method = ((document.getElementById('slPayMethod') || {}).value || 'cash');
    var amount = typeof ptfNum === 'function' ? ptfNum((document.getElementById('slPayAmt') || {}).value) : +(document.getElementById('slPayAmt') || {}).value || 0;
    var rate = cur === 'IRR' ? 1 : (typeof ptfNum === 'function' ? ptfNum((document.getElementById('slPayRate') || {}).value) : +(document.getElementById('slPayRate') || {}).value || 0);
    if (!date || amount <= 0 || (cur !== 'IRR' && rate <= 0)) { alert('تاریخ، مبلغ و برای ارز خارجی نرخ تسعیر الزامی است'); return; }
    var alloc = [], total = 0, bad = false;
    document.querySelectorAll('#slPayDlg .slAlloc').forEach(function (el) { var a = typeof ptfNum === 'function' ? ptfNum(el.value) : (+el.value || 0), rem = +el.getAttribute('data-rem') || 0; if (a < 0 || a > rem) bad = true; if (a > 0) { var legacyCd = el.getAttribute('data-legacy'); alloc.push(legacyCd ? { legacyCd: legacyCd, amount: a } : { invoiceCd: el.getAttribute('data-inv'), amount: a }); total += a; } });
    if (bad || total > amount) { alert('تخصیص هر فاکتور نباید از مانده آن و مجموع تخصیص‌ها نباید از مبلغ پرداخت بیشتر باشد'); return; }
    var sup = supplier(supCd), payCd = genCode('SFPAY'); if (!sup) { alert('تأمین‌کننده یافت نشد'); return; }
    var ch = slChequeCreate(method, sup, amount, cur, payCd, date); if (!ch.ok) { alert(ch.error); return; }
    var rec = { cd: payCd, supplierCd: supCd, supName: sup.co || '', dateISO: date, dateFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(date) : date, cur: cur, rate: rate, amount: amount, amountIrr: cur === 'IRR' ? amount : Math.round(amount * rate), method: method, note: ((document.getElementById('slPayNote') || {}).value || '').trim(), allocations: alloc, unallocated: amount - total, status: 'posted', chequeCd: ch.cheque ? ch.cheque.cd : '', thirdPartyInvoiceCd: ch.cheque ? (ch.cheque.sourceInvoiceCd || '') : '', t: faDateTime(), by: curSession().name };
    d.payments.unshift(rec); save(d);
    var legacyList = getData('ptf_crm_payables'); alloc.filter(function(a){return a.legacyCd;}).forEach(function(a){ var lp=legacyList.filter(function(x){return x.cd===a.legacyCd;})[0]; if(lp){ lp.paid=lp.paid||[]; lp.paid.push({amt:a.amount,t:faDate(),by:curSession().name,note:'پرداخت از حساب تامین‌کننده',supplierPaymentCd:payCd}); lp.settled=(typeof ptfPayableRemain==='function'?ptfPayableRemain(lp):0)<=0; }}); setData('ptf_crm_payables',legacyList);
    try { audit('پرداخت تامین', 'پرداخت ' + money(amount) + ' ' + cur + ' به ' + rec.supName + ' — تخصیص ' + money(total) + (rec.unallocated ? ' | اعتبار ' + money(rec.unallocated) : ''), rec.cd); } catch (e) {}
    var m = document.getElementById('slPayDlg'); if (m) m.remove(); if (typeof ptfToast === 'function') ptfToast('✅ پرداخت ثبت شد', 'ok'); slOpenLedger(supCd);
  };
  window.slPaymentVoid = function (cd) {
    var d = data(), p = (d.payments || []).filter(function (x) { return x.cd === cd; })[0]; if (!p || p.status === 'void') return;
    if (!confirm('پرداخت و همه تخصیص‌های آن ابطال شود؟')) return;
    p.status = 'void'; p.voidAt = faDateTime(); p.voidBy = curSession().name;
    var legacyList = getData('ptf_crm_payables'); legacyList.forEach(function(lp){ lp.paid=(lp.paid||[]).filter(function(x){return x.supplierPaymentCd!==cd;}); lp.settled=(typeof ptfPayableRemain==='function'?ptfPayableRemain(lp):lp.settled)<=0; }); setData('ptf_crm_payables',legacyList);
    if (p.chequeCd) { var checks = getData('ptf_crm_cheques'); var ch = checks.filter(function (c) { return c.cd === p.chequeCd; })[0]; if (ch) { if (ch.ownership === 'third_party') { ch.st = 'voided_transfer'; var invs = getData('ptf_crm_invoices'); invs.forEach(function (i) { i.payments = (i.payments || []).filter(function (x) { return x.supplierPaymentCd !== cd; }); }); setData('ptf_crm_invoices', invs); } else { ch.st = 'void'; ch.voidAt = faDateTime(); ch.voidBy = curSession().name; ch.reminderDisabled = true; if (typeof chUpsertReminder === 'function') chUpsertReminder(ch); } setData('ptf_crm_cheques', checks); } }
    save(d);
    try { audit('پرداخت تامین', 'ابطال پرداخت ' + cd + ' برای ' + p.supName, cd); } catch (e) {}
    var m = document.getElementById('slLedgerDlg'); if (m) m.remove(); slOpenLedger(p.supplierCd);
  };
  function liquidityHtml() {
    try {
      if (['admin','chairman','ceo','commercial'].indexOf(curRole()) < 0) return '';
      var sups = getData('ptf_crm_suppliers'), debt = 0, credit = 0, fx = {};
      sups.forEach(function (s) { balance(s.cd).forEach(function (b) { if (b.cur === 'IRR') { if (b.amount >= 0) debt += b.amount; else credit += Math.abs(b.amount); } else fx[b.cur] = (fx[b.cur] || 0) + b.amount; }); });
      var today = new Date().toISOString().slice(0,10), in7 = 0, in30 = 0, checks = 0;
      getData('ptf_crm_cheques').forEach(function (c) { if (c.ownership !== 'company' || c.kind === 'guarantee' || c.st === 'cleared' || c.st === 'void' || c.st === 'transferred' || c.ownership === 'third_party') return; checks += +c.amt || 0; if (c.dueISO) { var d = Math.ceil((new Date(c.dueISO) - new Date(today))/86400000); if (d >= 0 && d <= 7) in7 += +c.amt || 0; if (d >= 0 && d <= 30) in30 += +c.amt || 0; } });
      var fxt = Object.keys(fx).map(function (k) { return money(fx[k]) + ' ' + k; }).join(' | ');
      return '<div id="slLiquidity" style="background:#fff7ed;border:1px solid #fdba74;border-radius:14px;padding:12px 14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><b style="color:#9a3412">📊 تعهدات نقدینگی تأمین و چک‌های شرکت</b><br><small style="color:#92400e">چک ثالث منتقل‌شده در این شاخص وارد نمی‌شود.</small></div><button class="bt bt-o" style="font-size:11px" onclick="goPanel(\'sup\')">جزئیات تأمین‌کنندگان</button></div><div class="sr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:10px 0 0"><div class="sc"><b>' + money(debt) + '</b><span>بدهی باز تأمین‌کنندگان (IRR)</span></div><div class="sc"><b>' + money(credit) + '</b><span>اعتبار نزد تأمین‌کنندگان (IRR)</span></div><div class="sc"><b>' + money(checks) + '</b><span>چک‌های شرکت در راه</span></div><div class="sc"><b>' + money(in7) + '</b><span>چک سررسید ۷ روز آینده</span></div><div class="sc"><b>' + money(in30) + '</b><span>چک سررسید ۳۰ روز آینده</span></div></div>' + (fxt ? '<small style="display:block;margin-top:8px;color:#92400e">مانده ارزی تأمین‌کنندگان: ' + fxt + '</small>' : '') + '</div>';
    } catch (e) { return ''; }
  }
  var oldPetty = window.buildPetty;
  if (typeof oldPetty === 'function' && !window._slLiquidityHooked) { window._slLiquidityHooked = true; window.buildPetty = function () { return liquidityHtml() + oldPetty(); }; }

    /* ============ Sprint 265: supplier account events, filters and exports ============ */
  function slEventRows(supCd, f) {
    f = f || {}; var d = data(), sup = supplier(supCd), linked = linkedLegacyIds(d), out = [];
    function keep(date, cur, status, refs) {
      if (f.cur && f.cur !== 'all' && cur !== f.cur) return false;
      if (f.from && date && date < f.from) return false;
      if (f.to && date && date > f.to) return false;
      if (f.ref && String(refs || '').toLowerCase().indexOf(String(f.ref).toLowerCase()) < 0) return false;
      if (f.status && f.status !== 'all' && status !== f.status) return false;
      return true;
    }
    activeInvoices(d).filter(function (i) { return i.supplierCd === supCd; }).forEach(function (i) {
      var status = invRemain(i, d) > 0 ? 'open' : 'settled', refs = (i.legacyPayableCds || []).map(function (cd) { var p = getData('ptf_crm_payables').filter(function (x) { return x.cd === cd; })[0] || {}; return p.inqNo || cd; }).join('، ');
      if (keep(i.dateISO || '', i.cur || 'IRR', status, refs)) out.push({ date: i.dateISO || '', dateFa: i.dateFa || i.dateISO || '', type: 'فاکتور خرید', no: i.no, ref: refs, cur: i.cur || 'IRR', debit: +i.amount || 0, credit: 0, status: status, link: { kind: 'invoice', cd: i.cd } });
    });
    (d.payments || []).filter(function (p) { return p.supplierCd === supCd; }).forEach(function (p) {
      var cheque = p.chequeCd ? getData('ptf_crm_cheques').filter(function (c) { return c.cd === p.chequeCd; })[0] : null, refs = (p.allocations || []).map(function (a) { var i = (d.invoices || []).filter(function (x) { return x.cd === a.invoiceCd; })[0] || {}; return i.no || a.invoiceCd || a.legacyCd; }).join('، '), isVoid = p.status === 'void';
      // v30.6.2: نمایش نام قلم برای پرداخت‌ها اگر item دارد
      var itemNm = p.item || (p.note||'').split(' - ')[0] || '';
      if(!itemNm){
        try{
          var allCmp = getData('ptf_crm_buycmp')||[];
          for(var ci=0; ci<allCmp.length; ci++){
            var cmp = allCmp[ci];
            (cmp.purchases||[]).forEach(function(pur){
              if(pur.cd && p.allocations && p.allocations.some(function(a){ return a.legacyCd===pur.cd || a.invoiceCd===pur.cd; })){
                var link = typeof window.ptfResolveItemForPurchase === 'function' ? window.ptfResolveItemForPurchase(cmp, pur) : {ok:false};
                var it = link.ok ? link.item : {};
                if(it.nm || it.name) itemNm = it.nm || it.name;
              }
            });
          }
        }catch(e){}
      }
      if (keep(p.dateISO || '', p.cur || 'IRR', isVoid ? 'void' : 'payment', refs)) out.push({ date: p.dateISO || '', dateFa: p.dateFa || p.dateISO || '', type: isVoid ? 'پرداخت/چک ابطال‌شده' : (cheque ? (cheque.ownership === 'third_party' ? 'چک ثالث منتقل‌شده' : 'چک شرکت') : (p.method === 'bank' ? 'حواله بانکی' : p.method === 'credit' ? 'تهاتر/اعتبار' : 'پرداخت نقدی')), no: cheque ? (cheque.sayad || cheque.no || p.cd) : p.cd, ref: refs, cur: p.cur || 'IRR', debit: 0, credit: isVoid ? 0 : (+p.amount || 0), status: isVoid ? 'void' : 'payment', note: (itemNm? itemNm+' | ':'')+(p.note||''), itemName: itemNm, link: { kind: 'payment', cd: p.cd } });
    });
    legacyOpen(sup || {}).filter(function (p) { return !linked[p.cd]; }).forEach(function (p) {
      var rem = typeof ptfPayableRemain === 'function' ? ptfPayableRemain(p) : (+p.amount || 0);
      var itemNm = p.item || p.desc || '';
      if(!itemNm){
        try{
          var allCmp2 = getData('ptf_crm_buycmp')||[];
          for(var ci2=0; ci2<allCmp2.length; ci2++){
            var cmp2 = allCmp2[ci2];
            if(cmp2.inqNo===p.inqNo || cmp2.inqNo===p.inqNo || (cmp2.id && p.inqNo && cmp2.inqNo.indexOf(p.inqNo)>-1)){
              var link2 = typeof window.ptfResolveItemForPurchase === 'function' ? window.ptfResolveItemForPurchase(cmp2, p) : {ok:false};
              var it2 = link2.ok ? link2.item : {};
              if(it2.nm || it2.name) { itemNm = it2.nm || it2.name; break; }
            }
          }
        }catch(e){}
      }
      if(!itemNm) itemNm = p.item || p.desc || 'قلم '+ (p.idx!=null ? (p.idx+1) : '');
      if (keep(p.t || '', p.cur || 'IRR', 'legacy', p.inqNo || '')) out.push({ date: p.t || '', dateFa: p.t || '', type: 'تعهد خرید legacy', no: p.cd, ref: p.inqNo || '', cur: p.cur || 'IRR', debit: rem, credit: 0, status: 'legacy', note: itemNm, itemName: itemNm });
    });
    out.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.no).localeCompare(String(b.no)); });
    var running = {}; out.forEach(function (e) { running[e.cur] = (running[e.cur] || 0) + e.debit - e.credit; e.balance = running[e.cur]; });
    return out;
  }
  function slFiltersFromDom() { var from=((document.getElementById('slFfrom')||{}).value||''),to=((document.getElementById('slFto')||{}).value||''); if(typeof ptfJToISO==='function'){from=ptfJToISO(from)||from;to=ptfJToISO(to)||to;} return { from: from, to: to, cur: ((document.getElementById('slFcur') || {}).value || 'all'), status: ((document.getElementById('slFstatus') || {}).value || 'all'), ref: ((document.getElementById('slFref') || {}).value || '').trim() }; }
    function slLedgerTable(rows) { return rows.map(function (e) {
    var itemName = e.itemName || e.note || '';
    var extraInfo = e.ref || '';
    try {
      if(!itemName && e.no){
        var allCmp = (typeof getData==='function' ? getData('ptf_crm_buycmp') : []);
        for(var ci=0; ci<allCmp.length; ci++){
          var cmp = allCmp[ci];
          (cmp.purchases||[]).forEach(function(p){
            if(p.cd===e.no){
              var link = typeof window.ptfResolveItemForPurchase === 'function' ? window.ptfResolveItemForPurchase(cmp, p) : {ok:false};
              var it = link.ok ? link.item : {};
              if(it.nm || it.name) itemName = it.nm || it.name;
            }
          });
        }
      }
    } catch(ex){}
    var act = e.link && e.link.kind === 'invoice' ? '<button class="ba" onclick="slInvoiceEdit(\'' + escP(e.link.cd) + '\')">✏️</button> <button class="ba" onclick="slInvoiceAddFile(\'' + escP(e.link.cd) + '\')">📎</button>' : e.link && e.link.kind === 'payment' ? '<button class="ba" onclick="slPaymentEdit(\'' + escP(e.link.cd) + '\')">✏️</button> <button class="ba" onclick="slPaymentAddFile(\'' + escP(e.link.cd) + '\')">📎</button>' : '';
    var displayRef = '';
    if(e.type && e.type.indexOf('legacy')>-1){
      displayRef = '<b>'+escP(e.no)+'</b><br><small style="color:#0e7490">📦 '+(itemName?escP(itemName):'بدون نام')+'</small><br><small style="color:#64748b">درخواست: '+escP(e.ref||'')+'</small>';
    } else {
      displayRef = '<b>'+escP(e.no)+'</b>' + (e.ref ? '<br><small>'+escP(e.ref)+'</small>' : '') + (itemName ? '<br><small style="color:#0e7490">📦 '+escP(itemName)+'</small>' : '');
    }
    return '<tr><td>' + escP(e.dateFa) + '</td><td>' + escP(e.type) + '</td><td>' + displayRef + '</td><td>' + (e.debit ? money(e.debit) : '—') + '</td><td>' + (e.credit ? money(e.credit) : '—') + '</td><td><b>' + money(e.balance) + ' ' + escP(e.cur) + '</b></td><td>' + act + '</td></tr>';
  }).join(''); }
  window.slOpenLedger = function (supCd, filters) {
    if (!canSee()) { alert('⛔ دسترسی ندارید'); return; }
    var sup = supplier(supCd); if (!sup) return; var rows = slEventRows(supCd, filters), curs = ['all'].concat(rows.map(function (r) { return r.cur; }).filter(function (x, i, a) { return a.indexOf(x) === i; }));
    var f = filters || {}; var opts = curs.map(function (c) { return '<option value="' + escP(c) + '"' + ((f.cur || 'all') === c ? ' selected' : '') + '>' + (c === 'all' ? 'همه ارزها' : escP(c)) + '</option>'; }).join('');
    var html = '<div class="md-b" id="slLedgerDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1000px;max-height:92vh;overflow:auto"><h3>📒 گردش حساب تأمین‌کننده — ' + escP(sup.co || '') + '</h3><div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:9px 12px;margin-bottom:10px">' + balanceHtml(supCd) + '</div><div class="fr"><div class="fld"><label>از تاریخ</label><input id="slFfrom" value="' + escP(f.from || '') + '"></div><div class="fld"><label>تا تاریخ</label><input id="slFto" value="' + escP(f.to || '') + '"></div></div><div class="fr"><div class="fld"><label>ارز</label><select id="slFcur">' + opts + '</select></div><div class="fld"><label>وضعیت</label><select id="slFstatus"><option value="all">همه</option><option value="open"' + (f.status === 'open' ? ' selected' : '') + '>فاکتور باز</option><option value="settled"' + (f.status === 'settled' ? ' selected' : '') + '>فاکتور تسویه</option><option value="payment"' + (f.status === 'payment' ? ' selected' : '') + '>پرداخت</option><option value="legacy"' + (f.status === 'legacy' ? ' selected' : '') + '>تعهد legacy</option></select></div></div><div class="fld"><label>جستجوی RFQ / مرجع خرید</label><input id="slFref" value="' + escP(f.ref || '') + '"></div><div style="display:flex;gap:7px;justify-content:flex-end;margin-bottom:9px"><button class="bt bt-o" onclick="slLedgerApply(\'' + escP(supCd) + '\')">اعمال فیلتر</button><button class="bt bt-o" onclick="slLedgerCsv(\'' + escP(supCd) + '\')">📥 CSV</button><button class="bt bt-o" onclick="slLedgerPrint(\'' + escP(supCd) + '\')">🖨 PDF/چاپ</button><button class="bt" onclick="document.getElementById(\'slLedgerDlg\').remove();slPaymentStart(\'' + escP(supCd) + '\')">💰 پرداخت</button><button class="bt" onclick="document.getElementById(\'slLedgerDlg\').remove();slNewInvoice(\'' + escP(supCd) + '\')">＋ فاکتور</button></div><div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده جاری</th><th>عملیات</th></tr></thead><tbody>' + (slLedgerTable(rows) || '<tr><td colspan="6">گردشی مطابق فیلتر نیست</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.slLedgerApply = function (supCd) { var m = document.getElementById('slLedgerDlg'); if (m) m.remove(); slOpenLedger(supCd, slFiltersFromDom()); };
  function slCsv(rows) { return '\uFEFF' + [['تاریخ','نوع','سند/مرجع','کالا','بدهکار','بستانکار','مانده','ارز']].concat(rows.map(function (e) { var item = e.itemName||e.note||''; return [e.dateFa,e.type,e.no+' '+(e.ref||''),item,e.debit||'',e.credit||'',e.balance,e.cur]; })).map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g,'""') + '"'; }).join(','); }).join('\r\n'); }
  window.slLedgerCsv = function (supCd) { var rows = slEventRows(supCd, slFiltersFromDom()), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([slCsv(rows)], { type:'text/csv;charset=utf-8' })); a.download = 'supplier-ledger-' + supCd + '-' + new Date().toISOString().slice(0,10) + '.csv'; a.click(); };
  function slFaDigits(v) { return String(v == null ? '' : v).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function slCurFa(c) { return ({ IRR: 'ریال', USD: 'دلار', EUR: 'یورو', CNY: 'یوان', AED: 'درهم', GBP: 'پوند' })[c] || c || ''; }
  function slPrintRows(rows) { return rows.map(function (e) { var item = e.itemName||e.note||''; return '<tr><td>' + slFaDigits(e.dateFa) + '</td><td>' + escP(e.type === 'payment' ? 'پرداخت' : e.type) + '</td><td><b>' + escP(e.no) + '</b><br><small>' + escP(e.ref || '') + '</small>' + (item ? '<br><small style="color:#0e7490">📦 '+escP(item)+'</small>' : '') + '</td><td>' + (e.debit ? slFaDigits(money(e.debit)) : '—') + '</td><td>' + (e.credit ? slFaDigits(money(e.credit)) : '—') + '</td><td><b>' + slFaDigits(money(e.balance)) + ' ' + slCurFa(e.cur) + '</b></td></tr>'; }).join(''); }
  window.slLedgerPrint = function (supCd) { var sup=supplier(supCd), rows=slEventRows(supCd,slFiltersFromDom()), w=window.open('','_blank'); if(!w)return; w.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>گردش حساب '+escP(sup.co||'')+'</title><style>body{font-family:Tahoma;direction:rtl;padding:20px;color:#111}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}@media print{button{display:none}}</style></head><body><h2>گردش حساب تأمین‌کننده — '+escP(sup.co||'')+'</h2><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>'+slPrintRows(rows)+'</tbody></table></body></html>'); w.document.close(); w.print(); };

    function box() {
    if (!canSee()) return '';
    var sups = getData('ptf_crm_suppliers'), sd=data(); var rows = sups.map(function (s) { var b = balance(s.cd), has=(sd.invoices||[]).some(function(i){return i.supplierCd===s.cd;})||(sd.payments||[]).some(function(p){return p.supplierCd===s.cd;})||legacyOpen(s).length; if (!b.length && !has) return ''; return '<tr><td><b>' + escP(s.co || '') + '</b></td><td>' + (b.length ? balanceHtml(s.cd) : '<span style="color:#059669">مانده صفر / فقط تاریخچه</span>') + '</td><td><button class="ba" onclick="slOpenLedger(\'' + escP(s.cd) + '\')">📒 حساب و اسناد</button></td></tr>'; }).filter(Boolean).join('');
    return '<details id="slBox" open style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:12px 14px;margin-bottom:14px"><summary style="cursor:pointer;font-weight:900;color:#0c4a6e">🧾 فاکتور، حساب و پرداخت تأمین‌کنندگان</summary><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><small style="color:#0369a1">فاکتور، پرداخت و چک؛ برای باز/بستن روی عنوان کلیک کنید.</small><button class="bt" onclick="slNewInvoice()">＋ فاکتور خرید</button></div>' + (rows ? '<div class="tb2" style="margin-top:10px"><table><thead><tr><th>تأمین‌کننده</th><th>مانده</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') + '</details>';
  }
  var oldBuild = window.buildSuppliers;
  if (typeof oldBuild === 'function' && !window._slHooked) { window._slHooked = true; window.buildSuppliers = function () { return box() + oldBuild(); }; }
  /* ============ Sprint 266: reconciliation + fiscal-safe adjustment ============ */
  function slLockedYear(iso) {
    if (!iso) return '';
    var y = (typeof ptfISOToJ === 'function' ? ptfISOToJ(iso) : iso).slice(0,4);
    var snap = getData('ptf_crm_fiscal_snapshots').filter(function (s) { return s.locked && String(s.year) === String(y); })[0];
    return snap ? String(y) : '';
  }
  function slCanAdjust() { try { return ['admin','chairman','ceo','commercial'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  var _slSaveInv = window.slInvoiceSave;
  window.slInvoiceSave = function (supCd) {
    // v30.8 FIN-EX-01: یکتایی شماره فاکتور خرید
    try{
      var noCheck = ((document.getElementById('slInvNo') || {}).value || '').trim();
      if(noCheck){
        var allInv = (function(){ try{return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance')||'{}')}catch(e){return {}}; })();
        var exists = (allInv.invoices||[]).some(function(inv){ return (inv.no||'').toLowerCase()===noCheck.toLowerCase() && inv.supplierCd===supCd; });
        if(exists){ alert('⛔ فاکتور با شماره '+noCheck+' قبلاً برای همین تامین‌کننده ثبت شده - شماره تکراری مجاز نیست (FIN-EX-01)'); return; }
      }
    }catch(e){}
 var iso = ((document.getElementById('slInvDate') || {}).value || ''); if (slLockedYear(iso)) { alert('سال مالی ' + slLockedYear(iso) + ' قفل است؛ سند اصلی تغییر نمی‌کند. از «سند اصلاحی» استفاده کنید.'); return; } return _slSaveInv(supCd); };
  var _slSavePay = window.slPaymentSave;
  window.slPaymentSave = function (supCd, cur) { var iso = ((document.getElementById('slPayDate') || {}).value || ''); if (slLockedYear(iso)) { alert('سال مالی ' + slLockedYear(iso) + ' قفل است؛ پرداخت جدید برای آن سال باید با سند اصلاحی ثبت شود.'); return; }
    /* v31.7.3 BUG-AUDIT-002-FINANCIAL-CODEGEN: پرداخت با کد TMP ذخیره نمی‌شود —
       شماره رسمی فقط از سرور. اگر pool خالی باشد، کاربر باید refresh/ورود مجدد کند. */
    var _testCd = typeof genCode === 'function' ? genCode('SFPAY') : '';
    if (/^TMP-(SFPAY)-/.test(String(_testCd))) { alert('⛔ شماره رسمی پرداخت از سرور دریافت نشده است. اتصال/ورود را برقرار کنید و دوباره تلاش کنید.'); return; }
    return _slSavePay(supCd, cur); };
  var _slVoidInv = window.slInvoiceVoid;
  window.slInvoiceVoid = function (cd) { var i = (data().invoices || []).filter(function (x) { return x.cd === cd; })[0]; if (i && slLockedYear(i.dateISO)) { alert('فاکتور مربوط به سال مالی قفل‌شده است؛ ابطال مستقیم مجاز نیست.'); return; } return _slVoidInv(cd); };
  var _slVoidPay = window.slPaymentVoid;
  window.slPaymentVoid = function (cd) { var p = (data().payments || []).filter(function (x) { return x.cd === cd; })[0]; if (p && slLockedYear(p.dateISO)) { alert('پرداخت مربوط به سال مالی قفل‌شده است؛ ابطال مستقیم مجاز نیست.'); return; } return _slVoidPay(cd); };
  window.slAdjustmentOpen = function (supCd) {
    if (!slCanAdjust()) { alert('⛔ سند اصلاحی فقط برای مدیران ارشد مجاز است'); return; }
    var locked = getData('ptf_crm_fiscal_snapshots').filter(function (s) { return s.locked; }).map(function (s) { return String(s.year); }).filter(function (x,i,a) { return a.indexOf(x) === i; });
    if (!locked.length) { alert('سال مالی قفل‌شده‌ای برای اصلاح وجود ندارد'); return; }
    ptfDialog({ title: '🧾 سند اصلاحی حساب تأمین‌کننده', body: 'سند اصلی سال قفل‌شده تغییر نمی‌کند؛ این رکورد با تاریخ جاری و مرجع سال قفل‌شده ثبت می‌شود.', fields: [{id:'year',label:'سال مرجع قفل‌شده',type:'select',options:locked},{id:'cur',label:'ارز',type:'select',options:['IRR','USD','EUR','CNY','AED','GBP']},{id:'amount',label:'مبلغ اصلاحی (+ افزایش بدهی / − کاهش بدهی)',type:'number',money:false,dir:'ltr',required:true},{id:'rate',label:'نرخ تسعیر (برای ارز خارجی)',type:'number',money:false,dir:'ltr'},{id:'note',label:'دلیل اصلاح *',type:'textarea',rows:2,required:true}], okText:'ثبت سند اصلاحی', onOk:function(v){ var amt=+v.amount||0, cur=v.cur||'IRR', rate=cur==='IRR'?1:(+v.rate||0); if(!amt || !v.note || (cur!=='IRR'&&!rate)){alert('مبلغ، دلیل و برای ارز خارجی نرخ الزامی است');return;} var d=data(); d.adjustments=d.adjustments||[]; var sup=supplier(supCd); var a={cd:genCode('SFADJ'),supplierCd:supCd,supName:sup?sup.co:'',refYear:v.year,cur:cur,rate:rate,amount:amt,amountIrr:cur==='IRR'?amt:Math.round(amt*rate),note:v.note,dateISO:new Date().toISOString().slice(0,10),dateFa:faDate(),status:'posted',t:faDateTime(),by:curSession().name}; d.adjustments.unshift(a);save(d);try{audit('حساب تامین','سند اصلاحی سال '+v.year+' برای '+a.supName+' — '+money(amt)+' '+cur,a.cd)}catch(e){};slOpenLedger(supCd); } });
  };
  window.slReconcileOpen = function (supCd) {
    var d = data(), sup = supplier(supCd) || {}, allPayables = getData('ptf_crm_payables') || [];
    var invs = activeInvoices(d).filter(function (i) { return i.supplierCd === supCd; });
    var linkedIds = {};
    invs.forEach(function (i) { (i.legacyPayableCds || []).forEach(function (cd) { linkedIds[cd] = 1; }); });
    var officialIrr = invs.reduce(function (s, i) { return s + (+i.amountIrr || +i.amount || 0); }, 0);
    var linkedIrr = allPayables.filter(function (p) { return linkedIds[p.cd]; }).reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
    var openingIrr = (d.adjustments || []).filter(function (a) { return a.supplierCd === supCd && a.status !== 'void' && (a.kind === 'opening' || a.refYear === 'opening'); }).reduce(function (s, a) { return s + (+a.amountIrr || +a.amount || 0); }, 0);
    var rows = invs.map(function (i) {
      var ps = allPayables.filter(function (p) { return (i.legacyPayableCds || []).indexOf(p.cd) > -1; });
      var legacy = ps.reduce(function (s, p) { return s + (+p.amount || 0); }, 0), diff = (+i.amountIrr || +i.amount || 0) - legacy;
      return '<tr><td>' + escP(i.no) + '</td><td>' + money(i.amountIrr || i.amount) + ' ریال</td><td>' + money(legacy) + ' ریال</td><td>' + (i.legacyPayableCds || []).length + '</td><td>' + (Math.abs(diff) <= 1 ? '<span style="color:#059669">✓ منطبق</span>' : '<span style="color:#dc2626">⚠️ اختلاف ' + money(diff) + ' ریال</span>') + '</td></tr>';
    }).join('');
    var unlinked = legacyOpen(sup).filter(function (p) { return !p.sfInvoiceCd && !linkedIds[p.cd]; });
    var unlinkedIrr = unlinked.reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
    var html = '<div class="md-b" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:920px"><h3>🔎 تطبیق افتتاحیه، فاکتور و خرید واقعی — ' + escP(sup.co || '') + '</h3><div style="font-size:12px;color:#64748b;margin-bottom:8px">این گزارش فقط‌خواندنی است؛ migration یا اصلاح خودکار انجام نمی‌شود و هیچ مبلغی در این مسیر تغییر نمی‌کند.</div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px"><span class="bd">فاکتور رسمی: ' + money(officialIrr) + ' ریال</span><span class="bd">خرید legacy لینک‌شده: ' + money(linkedIrr) + ' ریال</span><span class="bd">افتتاحیه/adjustment: ' + money(openingIrr) + ' ریال</span><span class="bd" style="background:#fff7ed;color:#9a3412">legacy بدون لینک: ' + unlinked.length + ' مورد / ' + money(unlinkedIrr) + ' ریال</span></div><div class="tb2"><table><thead><tr><th>فاکتور</th><th>مبلغ فاکتور</th><th>خرید لینک‌شده</th><th>تعداد لینک</th><th>نتیجه</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">فاکتور لینک‌شده‌ای نیست</td></tr>') + '</tbody></table></div><div style="margin-top:10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:9px">تعهدهای legacy لینک‌نشده: <b>' + unlinked.length + '</b> مورد — این موارد در گزارش رسمی جدا می‌مانند تا دوباره‌شماری نشوند.</div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  var _slOpenLedger265 = window.slOpenLedger;
  window.slOpenLedger = function (supCd, filters) { _slOpenLedger265(supCd, filters); var dlg=document.getElementById('slLedgerDlg'); if(!dlg)return; var h=dlg.querySelector('h3'); if(h&&!dlg.querySelector('.slReconBtn')) h.insertAdjacentHTML('afterend','<div style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:7px"><button class="bt bt-o slReconBtn" style="font-size:11px;color:#7c3aed" onclick="slReconcileOpen(\''+escP(supCd)+'\')">🔎 تطبیق خرید/فاکتور</button><button class="bt bt-o" style="font-size:11px" onclick="slAdjustmentOpen(\''+escP(supCd)+'\')">🧾 سند اصلاحی</button></div>'); };

  /* ============ Sprint 267: UAT corrections / editing / Jalali / instant refresh ============ */
  function slJalali(id) { var el=document.getElementById(id); if(el && typeof ptfISOToJ==='function'){ try{el.type='text';el.value=ptfISOToJ(el.value)||el.value;el.placeholder='1405/04/22';}catch(e){} } }
  var _slInvForm267=window.slInvoiceForm;
  window.slInvoiceForm=function(supCd){_slInvForm267(supCd);slJalali('slInvDate');var l=document.querySelector('#slInvDlg label');if(l&&l.textContent.indexOf('تاریخ')>-1)l.textContent='شماره فاکتور *';var ds=document.querySelectorAll('#slInvDlg label');ds.forEach(function(x){if(x.textContent.indexOf('تاریخ فاکتور')>-1)x.textContent='تاریخ فاکتور (شمسی) *';});};
  var _slPayForm267=window.slPaymentForm;
  window.slPaymentForm=function(supCd,cur){_slPayForm267(supCd,cur);slJalali('slPayDate');slJalali('slChDue');document.querySelectorAll('#slPayDlg label').forEach(function(x){if(x.textContent.indexOf('تاریخ پرداخت')>-1)x.textContent='تاریخ پرداخت (شمسی) *';if(x.textContent.indexOf('تاریخ سررسید')>-1)x.textContent='تاریخ سررسید (شمسی) *';});};
  window.slInvoiceEdit=function(cd){var d=data(),i=(d.invoices||[]).filter(function(x){return x.cd===cd})[0];if(!i)return;ptfDialog({title:'✏️ ویرایش فاکتور خرید '+escP(i.no),fields:[{id:'no',label:'شماره فاکتور',value:i.no,required:true},{id:'date',label:'تاریخ فاکتور (شمسی)',value:i.dateFa||i.dateISO,dir:'ltr',required:true},{id:'amount',label:'مبلغ',type:'number',money:false,value:i.amount,dir:'ltr',required:true},{id:'note',label:'یادداشت',type:'textarea',value:i.note||''}],okText:'ذخیره',onOk:function(v){var iso=typeof ptfJToISO==='function'?(ptfJToISO(v.date)||v.date):v.date,amt=+v.amount||0;if(!v.no||!iso||amt<invPaid(i,d)){alert('شماره، تاریخ و مبلغ معتبر (حداقل برابر پرداخت تخصیص‌یافته) الزامی است');return;}i.no=v.no;i.dateISO=iso;i.dateFa=typeof ptfISOToJ==='function'?ptfISOToJ(iso):iso;i.amount=amt;i.amountIrr=i.cur==='IRR'?amt:Math.round(amt*(+i.rate||0));i.note=v.note||'';save(d);try{audit('فاکتور خرید تامین','ویرایش فاکتور '+i.no,cd)}catch(e){};slOpenLedger(i.supplierCd);}});};
  window.slPaymentEdit=function(cd){var d=data(),p=(d.payments||[]).filter(function(x){return x.cd===cd})[0];if(!p)return;ptfDialog({title:'✏️ ویرایش پرداخت',fields:[{id:'date',label:'تاریخ پرداخت (شمسی)',value:p.dateFa||p.dateISO,dir:'ltr',required:true},{id:'amount',label:'مبلغ پرداخت',type:'number',money:false,value:p.amount,dir:'ltr',required:true},{id:'note',label:'شرح',type:'textarea',value:p.note||''}],okText:'ذخیره',onOk:function(v){var iso=typeof ptfJToISO==='function'?(ptfJToISO(v.date)||v.date):v.date,amt=+v.amount||0,min=(p.allocations||[]).reduce(function(s,a){return s+(+a.amount||0)},0);if(!iso||amt<min){alert('مبلغ نباید از مجموع تخصیص‌ها کمتر باشد');return;}p.dateISO=iso;p.dateFa=typeof ptfISOToJ==='function'?ptfISOToJ(iso):iso;p.amount=amt;p.amountIrr=p.cur==='IRR'?amt:Math.round(amt*(+p.rate||0));p.unallocated=Math.max(0,amt-min);p.note=v.note||'';save(d);try{audit('پرداخت تامین','ویرایش پرداخت '+cd,cd)}catch(e){};slOpenLedger(p.supplierCd);}});};
  function slAttach(kind,cd){var html='<div class="md-b" id="slAttachDlg" style="display:grid;z-index:2900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px"><h3>📎 افزودن سند</h3><div id="slAttachWrap"></div><div style="text-align:left;margin-top:9px"><button class="bt" onclick="document.getElementById(\'slAttachDlg\').remove()">تمام</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',html);attachUploadWidget('slAttachWrap','supplier-finance/'+kind+'/'+cd,function(f){var d=data(),r=(kind==='invoice'?d.invoices:d.payments).filter(function(x){return x.cd===cd})[0];if(!r)return;r.files=r.files||[];r.files.push(f);save(d);try{audit('حساب تامین','افزودن پیوست '+kind,cd)}catch(e){};if(typeof ptfToast==='function')ptfToast('پیوست ذخیره شد','ok');});}
  window.slInvoiceAddFile=function(cd){slAttach('invoice',cd)};window.slPaymentAddFile=function(cd){slAttach('payment',cd)};
  window.slRefreshSupplierPanel=function(){if(document.getElementById('sTb')){var p=document.getElementById('panels');if(p){p.innerHTML=buildSuppliers();if(typeof renderSuppliers==='function')renderSuppliers();}}};
  ['ptfPayableUpsert','ptfPayablePay'].forEach(function(n){var old=window[n];if(typeof old==='function'){window[n]=function(){var r=old.apply(this,arguments);setTimeout(function(){if(typeof slRefreshSupplierPanel==='function')slRefreshSupplierPanel();},120);return r;};}});


  /* Sprint 270: explicit deletion/reversal with allocation release */
  window.slPaymentDelete=function(cd){ return window.slPaymentVoid(cd); };
  window.slInvoiceDelete=function(cd){var d=data(),i=(d.invoices||[]).filter(function(x){return x.cd===cd})[0];if(!i)return;if(!confirm('فاکتور حذف/ابطال شود؟ تخصیص‌های پرداخت آن به اعتبار تامین‌کننده تبدیل می‌شوند.'))return;(d.payments||[]).forEach(function(p){p.allocations=(p.allocations||[]).filter(function(a){return a.invoiceCd!==cd;});p.unallocated=(+p.amount||0)-(p.allocations||[]).reduce(function(s,a){return s+(+a.amount||0)},0);});i.status='void';i.voidAt=faDateTime();i.voidBy=curSession().name;var pays=getData('ptf_crm_payables');pays.forEach(function(p){if(p.sfInvoiceCd===cd)delete p.sfInvoiceCd;});setData('ptf_crm_payables',pays);save(d);if(typeof slRefreshSupplierPanel==='function')slRefreshSupplierPanel();slOpenLedger(i.supplierCd);};
  /* ============ Sprint 270: visible management, Jalali filters, opening balance ============ */
  function slJalaliFilter(id, label, iso) { return typeof ptfDatePicker === 'function' ? '<label>'+label+'</label>'+ptfDatePicker(id, iso || '') : '<label>'+label+'</label><input id="'+id+'" value="'+escP(iso||'')+'" placeholder="1405/04/22">'; }
  window.slOpeningOpen=function(supCd){if(!slCanAdjust()){alert('مانده افتتاحیه فقط برای مدیران ارشد مجاز است');return;}ptfDialog({title:'🏁 ثبت مانده افتتاحیه تامین‌کننده',body:'مبلغ مثبت = بدهی اولیه ما به تامین‌کننده؛ مبلغ منفی = اعتبار اولیه شرکت نزد تامین‌کننده.',fields:[{id:'cur',label:'ارز',type:'select',options:['IRR','USD','EUR','CNY','AED','GBP']},{id:'amount',label:'مانده افتتاحیه (+ بدهی / − اعتبار)',type:'number',money:false,dir:'ltr',required:true},{id:'rate',label:'نرخ تسعیر برای ارز خارجی',type:'number',money:false,dir:'ltr'},{id:'note',label:'شرح/مبنای مانده افتتاحیه',type:'textarea',required:true}],okText:'ثبت مانده افتتاحیه',onOk:function(v){var a=+v.amount||0,c=v.cur||'IRR',r=c==='IRR'?1:(+v.rate||0);if(!a||!v.note||(c!=='IRR'&&!r)){alert('مبلغ، شرح و برای ارز خارجی نرخ الزامی است');return;}var d=data(),sup=supplier(supCd);d.adjustments=d.adjustments||[];d.adjustments.unshift({cd:genCode('SFOPEN'),supplierCd:supCd,supName:sup?sup.co:'',refYear:'opening',kind:'opening',cur:c,rate:r,amount:a,amountIrr:c==='IRR'?a:Math.round(a*r),note:v.note,dateISO:new Date().toISOString().slice(0,10),dateFa:faDate(),status:'posted',t:faDateTime(),by:curSession().name});save(d);audit('حساب تامین','ثبت مانده افتتاحیه '+(sup?sup.co:''),supCd);slOpenLedger(supCd);}});};
  var _slLedger270=window.slOpenLedger;
  window.slOpenLedger=function(supCd,filters){_slLedger270(supCd,filters);var dlg=document.getElementById('slLedgerDlg');if(!dlg)return;var from=document.getElementById('slFfrom'),to=document.getElementById('slFto');if(from&&from.closest('.fld'))from.closest('.fld').innerHTML=slJalaliFilter('slFfrom','از تاریخ (شمسی)',from.value);if(to&&to.closest('.fld'))to.closest('.fld').innerHTML=slJalaliFilter('slFto','تا تاریخ (شمسی)',to.value);var d=data(),invs=activeInvoices(d).filter(function(i){return i.supplierCd===supCd;}),pays=(d.payments||[]).filter(function(p){return p.supplierCd===supCd&&p.status!=='void';});var h='<div id="slManage" style="margin-top:12px;border:1px solid var(--brd);border-radius:10px;padding:10px"><b>مدیریت فاکتور و پرداخت</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px"><button class="bt bt-o" onclick="slOpeningOpen(\''+escP(supCd)+'\')">🏁 مانده افتتاحیه</button>' + invs.map(function(i){return '<button class="bt bt-o" onclick="slInvoiceEdit(\''+escP(i.cd)+'\')">✏️ فاکتور '+escP(i.no)+'</button><button class="bt bt-o" style="color:#dc2626" onclick="slInvoiceDelete(\''+escP(i.cd)+'\')">🗑 حذف فاکتور</button>';}).join('') + pays.map(function(p){return '<button class="bt bt-o" onclick="slPaymentEdit(\''+escP(p.cd)+'\')">✏️ پرداخت '+escP(p.cd)+'</button><button class="bt bt-o" style="color:#dc2626" onclick="slPaymentDelete(\''+escP(p.cd)+'\')">🗑 حذف پرداخت</button>';}).join('')+'</div></div>';dlg.querySelector('.md').insertAdjacentHTML('beforeend',h);};
  var _slPrint270=window.slLedgerPrint;
  window.slLedgerPrint=function(supCd){var f=slFiltersFromDom(),sup=supplier(supCd),rows=slEventRows(supCd,f),rng=(f.from||f.to)?'بازه: '+slFaDigits(typeof ptfISOToJ==='function'&&f.from?ptfISOToJ(f.from):f.from||'ابتدا')+' تا '+slFaDigits(typeof ptfISOToJ==='function'&&f.to?ptfISOToJ(f.to):f.to||'امروز'):'بازه: همه تاریخ‌ها',w=window.open('','_blank');if(!w)return;w.document.write('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px}th{background:#eee}</style><h2>گردش حساب تامین‌کننده — '+escP((sup||{}).co||'')+'</h2><p>'+rng+'</p><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>'+slPrintRows(rows)+'</tbody></table></html>');w.document.close();w.print();};

  /* Sprint 271: internal PDF preview, no new browser tab */
  window.slLedgerPrint=function(supCd){var f=slFiltersFromDom(),sup=supplier(supCd),rows=slEventRows(supCd,f),rng=(f.from||f.to)?'بازه: '+slFaDigits(typeof ptfISOToJ==='function'&&f.from?ptfISOToJ(f.from):f.from||'ابتدا')+' تا '+slFaDigits(typeof ptfISOToJ==='function'&&f.to?ptfISOToJ(f.to):f.to||'امروز'):'بازه: همه تاریخ‌ها',html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}</style></head><body><h2>گردش حساب تامین‌کننده — '+escP((sup||{}).co||'')+'</h2><p>'+rng+'</p><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>'+slPrintRows(rows)+'</tbody></table></body></html>';if(typeof ptfPreviewPrintableDoc==='function'){ptfPreviewPrintableDoc('گردش حساب تامین‌کننده — '+escP((sup||{}).co||''),html,'supplier-ledger-'+supCd);return;}var m='<div class="md-b" style="display:grid;z-index:4000"><div class="md" style="max-width:95vw;width:1000px;height:90vh"><h3>پیش‌نمایش گردش حساب</h3><iframe style="width:100%;height:72vh;border:1px solid #ccc" srcdoc="'+html.replace(/"/g,'&quot;')+'"></iframe><div style="text-align:left"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',m);};


  /* Sprint 275: read-only finance branch, same source of truth. */
  /* Sprint 283: searchable derived supplier accounts. No balance is stored here. */
  window.slAccountRows = function (query) {
    var q = String(query == null ? (window._slFinanceSearch || '') : query).trim().toLowerCase();
    return getData('ptf_crm_suppliers').map(function (x) {
      var b = balance(x.cd);
      var open = b.some(function (z) { return Math.abs(+z.amount || 0) > 0.000001 || Math.abs(+z.irr || 0) > 0.000001; });
      var exposure = b.reduce(function (sum, z) { return sum + Math.abs(+z.irr || +z.amount || 0); }, 0);
      return { cd: x.cd, co: x.co || x.name || x.cd, balance: b, open: open, exposure: exposure };
    }).filter(function (x) {
      return !q || String(x.co || '').toLowerCase().indexOf(q) > -1 || String(x.cd || '').toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) {
      if (a.open !== b.open) return a.open ? -1 : 1; /* non-zero accounts first */
      if (a.open && a.exposure !== b.exposure) return b.exposure - a.exposure;
      return String(a.co).localeCompare(String(b.co), 'fa');
    });
  };
  window.slFinanceHubHtml = function () {
    var q = String(window._slFinanceSearch || ''), all = window.slAccountRows(''), rows = window.slAccountRows(q);
    var openN = all.filter(function (x) { return x.open; }).length;
    var body = rows.map(function (x) {
      return '<tr' + (x.open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(x.co || '') + '</b><br><small style="direction:ltr;color:#94a3b8">' + escP(x.cd || '') + '</small></td><td>' + (x.balance.length ? balanceHtml(x.cd) : '<span style="color:#64748b">مانده ندارد</span>') + '</td><td><button class="ba" onclick="slOpenLedger(\'' + escP(x.cd) + '\')">گردش حساب</button></td></tr>';
    }).join('');
    return '<div id="slFinanceHubBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">🏭 حساب تأمین‌کنندگان</h4><small style="color:#64748b">' + openN.toLocaleString('fa-IR') + ' حساب با مانده غیرصفر، ابتدا نمایش داده می‌شود.</small></div><input id="slFinanceSearch" value="' + escP(q) + '" oninput="slFinanceSearch(this.value)" placeholder="جست‌وجوی نام یا کد تأمین‌کننده" style="min-width:240px;direction:rtl"></div><div class="tb2" style="margin-top:10px"><table><thead><tr><th>تأمین‌کننده</th><th>مانده/اعتبار</th><th></th></tr></thead><tbody>' + (body || '<tr><td colspan="3">موردی مطابق جست‌وجو نیست</td></tr>') + '</tbody></table></div><div style="margin-top:10px"><input id="slChkDiag" placeholder="شماره چک برای تشخیص" style="direction:ltr"><button class="bt bt-o" onclick="slChequeDiag()">تشخیص چک</button><div id="slChkDiagOut"></div></div></div>';
  };
  window.slFinanceSearch = function (v) {
    window._slFinanceSearch = String(v || '');
    var el = document.getElementById('slFinanceHubBox');
    if (el) el.outerHTML = window.slFinanceHubHtml();
  };
  window.slChequeDiag=function(){var no=((document.getElementById('slChkDiag')||{}).value||'').trim(),c=getData('ptf_crm_cheques').filter(function(x){return String(x.sayad||x.no||'')===no;})[0],o=document.getElementById('slChkDiagOut');if(!o)return;if(!c){o.textContent='چک یافت نشد';return;}var d=data(),p=(d.payments||[]).filter(function(x){return x.cd===c.supplierPaymentCd;})[0];o.innerHTML='<div style="margin-top:8px;font-size:12px">وضعیت چک: <b>'+escP(c.st||'open')+'</b> | مالکیت: <b>'+escP(c.ownership||'نامشخص')+'</b> | پرداخت مرتبط: <b>'+escP(p?p.status:'ندارد')+'</b></div>';};
  var _slPetty275=window.buildPetty; if(typeof _slPetty275==='function'){window.buildPetty=function(){return _slPetty275()+ (typeof window.slFinanceHubHtml==='function'?window.slFinanceHubHtml():'');};}
  /* Sprint 278: real purchase -> single supplier finance trail */
  window.slImportRealPurchase=function(o){if(!o||!o.purchaseCd||!o.payableCd)return;var d=data(),exists=(d.invoices||[]).filter(function(i){return i.sourcePurchaseCd===o.purchaseCd;})[0];if(exists)return exists;var sup=supplier(o.supplierCd)||{},inv={cd:genCode('SFINV'),supplierCd:o.supplierCd,supName:sup.co||o.supName||'',no:'PUR-'+o.purchaseCd,dateISO:new Date().toISOString().slice(0,10),dateFa:faDate(),cur:'IRR',rate:1,amount:+o.amount||0,amountIrr:+o.amount||0,note:'ثبت خودکار از خرید واقعی '+(o.item||''),legacyPayableCds:[o.payableCd],sourcePurchaseCd:o.purchaseCd,status:'open',files:o.files||[],t:faDateTime(),by:curSession().name};d.invoices.unshift(inv);if(o.pay==='cash'){d.payments.unshift({cd:genCode('SFPAY'),supplierCd:o.supplierCd,supName:inv.supName,dateISO:inv.dateISO,dateFa:inv.dateFa,cur:'IRR',rate:1,amount:inv.amount,amountIrr:inv.amount,method:'cash',note:'تسویه نقدی خرید واقعی',allocations:[{invoiceCd:inv.cd,amount:inv.amount}],unallocated:0,status:'posted',sourcePurchaseCd:o.purchaseCd,t:faDateTime(),by:curSession().name});}save(d);var ps=getData('ptf_crm_payables');ps.forEach(function(p){if(p.cd===o.payableCd)p.sfInvoiceCd=inv.cd;});setData('ptf_crm_payables',ps);try{audit('حساب تامین','انتقال خرید واقعی به زیر‌دفتر مالی '+inv.supName,inv.cd)}catch(e){};return inv;};
  var _slDiag278=window.slChequeDiag;window.slChequeDiag=function(){_slDiag278();var no=((document.getElementById('slChkDiag')||{}).value||'').trim(),c=getData('ptf_crm_cheques').filter(function(x){return String(x.sayad||x.no||'')===no;})[0],o=document.getElementById('slChkDiagOut');if(c&&o){var active=c.ownership==='company'&&c.st==='open'&&c.kind!=='guarantee';o.innerHTML+= '<div style="font-size:12px">ورود به نقدینگی شرکت: <b>'+ (active?'بله':'خیر')+'</b></div>';}};


  /* Sprint 279: repair legacy one-way cheque/payment links. */
  window.slReconcileVoidCheques=function(){var d=data(),checks=getData('ptf_crm_cheques'),n=0;checks.forEach(function(c){if(c.ownership!=='company'||c.st!=='open'||!c.supplierPaymentCd)return;var p=(d.payments||[]).filter(function(x){return x.cd===c.supplierPaymentCd;})[0];if(p&&p.status==='void'){c.st='void';c.reminderDisabled=true;c.voidAt=faDateTime();c.voidBy='سیستم تطبیق';if(typeof chUpsertReminder==='function')chUpsertReminder(c);n++;}});if(n)setData('ptf_crm_cheques',checks);return n;};
  try{window.slReconcileVoidCheques();}catch(e){}
  var _slDiag279=window.slChequeDiag;window.slChequeDiag=function(){var n=window.slReconcileVoidCheques();_slDiag279();var o=document.getElementById('slChkDiagOut');if(o&&n)o.innerHTML+='<div style="color:#059669">تطبیق خودکار: '+n+' چک ابطال‌شده اصلاح شد.</div>';};
})();

// v29.8 FIN-WF-004 کامل: گارد مرکزی سال مالی برای ویرایش/حذف فاکتور/پرداخت تأمین
(function(){
  function slLockedYear(iso){
    if(!iso) return '';
    var y=(typeof ptfISOToJ==='function'?ptfISOToJ(iso):iso).slice(0,4);
    var snap=(getData('ptf_crm_fiscal_snapshots')||[]).filter(function(s){ return s.locked && String(s.year)===String(y); })[0];
    return snap?String(y):'';
  }
  var _editInv = window.slInvoiceEdit;
  if(_editInv){
    window.slInvoiceEdit = function(cd){
      var d=(function(){ try{return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance')||'{}')}catch(e){return {}}; })();
      var i=(d.invoices||[]).filter(function(x){ return x.cd===cd; })[0];
      if(i && slLockedYear(i.dateISO)){ alert('🔒 فاکتور مربوط به سال مالی '+slLockedYear(i.dateISO)+' قفل است - ویرایش مجاز نیست. سند اصلاحی بزنید.'); return; }
      return _editInv(cd);
    };
  }
  var _editPay = window.slPaymentEdit;
  if(_editPay){
    window.slPaymentEdit = function(cd){
      var d=(function(){ try{return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance')||'{}')}catch(e){return {}}; })();
      var p=(d.payments||[]).filter(function(x){ return x.cd===cd; })[0];
      if(p && slLockedYear(p.dateISO)){ alert('🔒 پرداخت مربوط به سال مالی '+slLockedYear(p.dateISO)+' قفل است - ویرایش مجاز نیست.'); return; }
      return _editPay(cd);
    };
  }
})();

/* =====================================================================
   PTF CRM — Sprint 262 / v26.2
   Supplier Finance — Phase 1: purchase invoices + read-only supplier balance
   Isolated data key; no automatic migration of legacy payables.
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'ptf_crm_supplier_finance';
  function data() {
    var d = null;
    try {
      if (typeof getData === 'function') d = getData(KEY);
      else d = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) { d = null; }
    return d && typeof d === 'object' && !Array.isArray(d)
      ? Object.assign({ schema: 1, invoices: [], payments: [] }, d)
      : { schema: 1, invoices: [], payments: [] };
  }
  function save(d) { d = d || { schema: 1, invoices: [], payments: [] }; d.schema = 1; d.invoices = d.invoices || []; d.payments = d.payments || []; return setData(KEY, d); }
  /* v34.4.38: metadata سندِ آپلودشده باید مستقل از دکمهٔ «ذخیره فرم» و همان
     لحظه روی source-of-truth نوشته شود؛ وگرنه بستن modal فایل را orphan می‌کرد. */
  function fileRecord(kind, cd, d) {
    var rows = kind === 'invoice' ? (d.invoices || []) : (d.payments || []);
    return rows.filter(function (x) { return x.cd === cd; })[0] || null;
  }
  window.slPersistFile = function (kind, cd, f) {
    var rec = (typeof window.ptfNormalizeFileRec === 'function') ? window.ptfNormalizeFileRec(f) : (f && f.key ? f : null);
    if (!rec || !rec.key || (kind !== 'invoice' && kind !== 'payment')) return { ok: false, why: 'input' };
    var d = data(), r = fileRecord(kind, cd, d);
    if (!r) return { ok: false, why: 'record' };
    r.files = r.files || [];
    if (!r.files.some(function (x) {
      var xk = (typeof window.ptfFileStorageKey === 'function') ? window.ptfFileStorageKey(x) : (x && x.key);
      return xk && xk === rec.key;
    })) r.files.push(rec);
    r._deletedFileKeys = (r._deletedFileKeys || []).filter(function (key) { return key !== rec.key; });
    r.updatedAtISO = new Date().toISOString();
    try { r.updatedBy = curSession().name; } catch (eBy) {}
    save(d);
    return { ok: true, record: r };
  };
  window.slForgetPersistedFile = function (kind, cd, key) {
    var d = data(), r = fileRecord(kind, cd, d);
    if (!r) return { ok: false, why: 'record' };
    r.files = (r.files || []).filter(function (f) { return f && f.key !== key; });
    r._deletedFileKeys = (r._deletedFileKeys || []).concat([key]).filter(function (v, i, all) { return v && all.indexOf(v) === i; });
    r.updatedAtISO = new Date().toISOString();
    try { r.updatedBy = curSession().name; } catch (eBy2) {}
    save(d);
    return { ok: true, record: r };
  };
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
      return p.pay === 'credit' && !p.settled && !p.sfInvoiceCd &&
        /* P0-2 FIX: اولویت با supplierCd (یکتاست)؛ اگر legacy data فقط نام دارد، از نام به‌عنوان fallback استفاده شود */
        (p.supplierCd ? p.supplierCd === sup.cd : nrm(p.sup) === nrm(sup.co || sup.name || ''));
    });
  }
  function linkedLegacyIds(d) {
    var out = {}; activeInvoices(d).forEach(function (i) { (i.legacyPayableCds || []).forEach(function (cd) { out[cd] = true; }); }); return out;
  }
  function invoiceLegacyTotal(inv) {
    return getData('ptf_crm_payables').filter(function (p) { return (inv.legacyPayableCds || []).indexOf(p.cd) > -1; }).reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
  }
  function invoiceLinkMismatch(inv) {
    if (!inv || !(inv.legacyPayableCds || []).length) return { mismatch: false, legacyTotal: 0, invoiceIrr: 0, sig: '' };
    var legacyTotal = invoiceLegacyTotal(inv);
    var invoiceIrr = +inv.amountIrr || +inv.amount || 0;
    var mismatch = invoiceIrr && Math.abs(invoiceIrr - legacyTotal) > 1;
    var sig = Math.round(invoiceIrr) + ':' + Math.round(legacyTotal) + ':' + (inv.legacyPayableCds || []).slice().sort().join(',');
    return { mismatch: mismatch, legacyTotal: legacyTotal, invoiceIrr: invoiceIrr, sig: sig };
  }
  function invoiceLinkMismatchActive(inv) {
    var m = invoiceLinkMismatch(inv);
    if (!m.mismatch) return false;
    return !(inv.linkMismatchAck && inv.linkMismatchAckSig === m.sig);
  }
  function balance(supCd) {
    var d = data(), sup = supplier(supCd), name = sup ? sup.co : '';
    var by = {}, linked = linkedLegacyIds(d);
    activeInvoices(d).filter(function (i) { return i.supplierCd === supCd; }).forEach(function (i) {
      var c = i.cur || 'IRR';
      /* v34.7.89 (SUP-VAT-002): فاکتور صوری/پوششی خرید واقعی نیست، ولی «منفعت خالص»
         (اعتبار ارزش‌افزوده − کارمزد فاکتورساز) باید در مانده/اعتبار این تأمین‌کننده
         دیده شود. پیش‌تر فقط کارمزد به بدهی اضافه می‌شد و اعتبار VAT کسر نمی‌شد؛
         این با گزارش‌های official-ledger/working-capital/fiscal ناهماهنگ بود.
         حالا: بدهی واقعی = کارمزد؛ و اگر اعتبار VAT بزرگ‌تر باشد به‌عنوان
         «اعتبار/منفعت» کسر می‌شود. */
      if (i.isCover === true) {
        var comm = (+i.coverCommissionAmount != null && +i.coverCommissionAmount > 0) ? (+i.coverCommissionAmount || 0)
          : Math.round((i.cur && i.cur !== 'IRR' ? (+i.amount || 0) * (+i.rate || 0) : (+i.amount || 0)) * (+i.coverCommissionPct || 0) / 100);
        var vat = (+i.coverVatAmount != null && +i.coverVatAmount > 0) ? (+i.coverVatAmount || 0)
          : Math.round((i.cur && i.cur !== 'IRR' ? (+i.amount || 0) * (+i.rate || 0) : (+i.amount || 0)) * (+i.coverVatPct || 0) / 100);
        var r = comm - vat; /* منفعت خالص پوششی: اگر منفی باشد یعنی اعتبار/بدهیِ ناخالص کاهش */
        if (!by[c]) by[c] = { cur: c, amount: 0, irr: 0, invoices: 0, legacy: 0, warn: 0, credit: 0 };
        by[c].amount += r; by[c].irr += (c === 'IRR') ? r : r * (+i.rate || 0); by[c].invoices++;
        if (invoiceLinkMismatchActive(i)) by[c].warn++;
        return;
      }
      var rr = invRemain(i, d);
      if (!by[c]) by[c] = { cur: c, amount: 0, irr: 0, invoices: 0, legacy: 0, warn: 0, credit: 0 };
      by[c].amount += rr; by[c].irr += c === 'IRR' ? rr : rr * (+i.rate || 0); by[c].invoices++;
      if (invoiceLinkMismatchActive(i)) by[c].warn++;
    });
    /* v34.0.8-alpha (فاز ۳ — مورد B تأییدشده): گردش حساب تأمین‌کننده فقط بر «فاکتور خرید + ماندهٔ
       باقیماندهٔ همان» استوار است؛ «تعهد خرید legacy» دیگر در مانده‌ٔ بدهی اضافه نمی‌شود (چون خریدِ
       تعهدی بی‌معناست). فقط به‌عنوان شمارشِ اطلاع‌رسانی (legacy count) دیده می‌شود تا کاربر بداند
       تعهدِ بازِ لینک‌نشده هست، ولی در مبلغ گردش/بدهی اثر نمی‌گذارد. */
    legacyOpen(sup || { co: name }).forEach(function (p) {
      if (linked[p.cd]) return;
      var c = p.cur || 'IRR';
      if (!by[c]) by[c] = { cur: c, amount: 0, irr: 0, invoices: 0, legacy: 0, warn: 0, credit: 0 };
      by[c].legacy++;
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
    return balanceHtmlFrom(balance(supCd), supCd);
  }
  /* v34.7.81 (SUP-PERF-001): نمایش HTML مانده از روی آرایهٔ محاسبه‌شده — در box()
     پیش‌تر balance(s.cd) جداگانه محاسبه می‌شد و بعد balanceHtml(supCd) دوباره همان
     محاسبهٔ سنگین را تکرار می‌کرد (و نیز در slSupplierOpenTotalsIRR). این کمک می‌کند
     با رشد فاکتور/پرداخت تامین‌کنندگان، پنل بدون تکرار محاسبه ساخته شود. */
  function balanceHtmlFrom(b, supCd) {
    if (!b || !b.length) return '<span style="color:#059669">مانده باز ندارد</span>';
    return b.map(function (x) { return '<span><b style="color:#b45309">' + money(x.amount) + ' ' + escP(x.cur) + '</b>' + (x.legacy ? ' <small style="color:#64748b">(' + x.legacy + ' تعهد legacy)</small>' : '') + (x.warn ? ' <small style="color:#dc2626">⚠️ مغایرت مبلغ لینک</small> <button type="button" class="ba" style="color:#7c3aed;font-size:11px;padding:1px 6px" onclick="slAckLinkMismatch(\'' + ptfOnClickArg(supCd) + '\')">برداشتن اخطار</button>' : '') + '</span>'; }).join('<br>');
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
  window.slInvoiceForm = function (supCd, prefill) {
    var sup = supplier(supCd); if (!sup) { alert('تأمین‌کننده یافت نشد'); return; }
    prefill = prefill || {};
    var legacy = legacyOpen(sup), d = data(); window._slInvFiles = [];
    var legacyHtml = legacy.length ? legacy.map(function (p) {
      var rem = typeof ptfPayableRemain === 'function' ? ptfPayableRemain(p) : (+p.amount || 0);
      return '<label style="display:flex;gap:7px;padding:6px 0;border-bottom:1px dashed var(--brd);font-size:12px"><input class="slLegacy" type="checkbox" value="' + escP(p.cd) + '"><span><b>' + escP(p.item || '-') + '</b> — ' + money(rem) + ' ' + escP(p.cur || 'IRR') + ' <small style="color:#94a3b8">(' + escP(p.inqNo || '') + ')</small></span></label>';
    }).join('') : '<small style="color:#94a3b8">تعهد خرید اعتباری legacy بازی برای این تأمین‌کننده نیست.</small>';
    /* فاز ۲ / گام ۵ (crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md):
       ارزش‌افزوده برای فاکتور خرید رسمی واقعی + بخش فاکتور پوششی/صوری (فقط نقش‌های ارشد). */
    var _canCover = (function () { try { return isSenior(); } catch (e) { return false; } })();
    var coverHtml = _canCover ? (
      '<div class="fld" style="border:1px dashed #f59e0b;border-radius:10px;padding:9px 11px;background:#fffbeb;margin:6px 0">' +
      '<label style="display:flex;gap:7px;align-items:center;cursor:pointer;font-size:12.5px"><input type="checkbox" id="slInvCover" onchange="slInvCoverToggle()"> <b>🔖 این فاکتور، فاکتور پوششی/صوری برای پر کردن گپ ممیزی فصلی است</b></label>' +
      '<div id="slInvCoverBox" style="display:none;margin-top:9px">' +
      '<div style="font-size:11.5px;color:#92400e;margin-bottom:8px;line-height:1.9">مبلغ اسمی فاکتور در دفتر رسمی به‌عنوان خرید لحاظ می‌شود؛ فقط کارمزد فاکتورساز نقداً پرداخت می‌شود و در «دفتر واقعی» منفعت خالص (اعتبار ارزش‌افزوده منهای کارمزد) اثر می‌گذارد.</div>' +
      '<div class="fr"><div class="fld"><label>درصد کارمزد فاکتورساز (٪) *</label><input id="slInvCommissionPct" type="number" min="0" max="100" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr" oninput="slInvCalcLive()"></div><div class="fld"><label>فصل مرتبط</label><select id="slInvCoverSeason"><option value="1">🌸 بهار</option><option value="2" selected>☀️ تابستان</option><option value="3">🍁 پاییز</option><option value="4">❄️ زمستان</option></select></div></div>' +
      '<div id="slInvCoverNet" style="font-size:12.5px;font-weight:800;margin:8px 0;padding:7px 10px;border-radius:8px;background:#fff"></div>' +
      '<label style="display:flex;gap:7px;align-items:flex-start;font-size:11px;color:#92400e;cursor:pointer"><input type="checkbox" id="slInvCoverConfirm" style="margin-top:2px"> <span>تایید می‌کنم این یک فاکتور پوششی/صوری داخلی است.</span></label>' +
      '</div></div>'
    ) : '';
    var html = '<div class="md-b" id="slInvDlg" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px;max-height:92vh;overflow:auto">' +
      '<h3 style="margin:0 0 6px">🧾 ثبت فاکتور خرید — ' + escP(sup.co || '') + '</h3>' +
      '<div style="font-size:12px;line-height:1.8;color:#64748b;margin-bottom:12px">فاکتور مستقل ثبت می‌شود. اتصال به تعهدهای خرید واقعی اختیاری است.</div>' +
      '<div class="fr"><div class="fld"><label>شماره فاکتور *</label><input id="slInvNo" style="direction:ltr"></div><div class="fld"><label>تاریخ فاکتور *</label><input id="slInvDate" value="' + (typeof ptfTodayJ === 'function' ? ptfTodayJ() : '') + '" placeholder="1405/04/22" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>ارز *</label><select id="slInvCur" onchange="document.getElementById(\'slInvRateWrap\').style.display=this.value===\'IRR\'?\'none\':\'\'"><option value="IRR">ریال (IRR)</option><option value="USD">دلار (USD)</option><option value="EUR">یورو (EUR)</option><option value="CNY">یوان (CNY)</option><option value="AED">درهم (AED)</option><option value="GBP">پوند (GBP)</option></select></div><div class="fld"><label>مبلغ فاکتور (بدون ارزش افزوده) *</label><input id="slInvAmt" data-money="1" inputmode="numeric" style="direction:ltr" oninput="slInvCalcLive()"></div></div>' +
      '<div class="fld" id="slInvRateWrap" style="display:none"><label>نرخ تسعیر (ریال به‌ازای هر واحد ارز) *</label><input id="slInvRate" data-money="1" inputmode="numeric" style="direction:ltr" oninput="slInvCalcLive()"></div>' +
      '<div class="fr"><div class="fld"><label>نوع فاکتور *</label><select id="slInvType" onchange="slInvTypeChanged()"><option value="unofficial">غیررسمی (بدون کد اقتصادی)</option><option value="official">رسمی (ارزش افزوده/کد اقتصادی)</option></select></div><div class="fld"><label>یادداشت / شرح</label><input id="slInvNote" style="direction:ltr" oninput="slInvCalcLive()"></div></div>' +
      '<div class="fld" id="slInvVatWrap" style="display:none;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:9px 11px;margin:6px 0">' +
        '<label style="font-size:12.5px;color:#065f46">💰 ارزش افزوده (VAT) — درصد *</label>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">' +
          '<input id="slInvVatPct" type="number" min="0" max="100" step="any" value="' + (typeof window.ptfVatRateOf === 'function' ? window.ptfVatRateOf(prefill.date || date || '') : 10) + '" style="width:110px;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr" oninput="slInvCalcLive()">' +
          '<span style="font-size:13px;font-weight:700;color:#065f46">٪</span>' +
          '<span style="font-size:11.5px;color:#065f46;flex:1;min-width:200px">مبلغ را <b>بدون ارزش افزوده</b> وارد کنید؛ ارزش افزوده و جمع خودکار محاسبه می‌شود.</span>' +
        '</div>' +
        '<small id="slInvVatSum" style="color:#0e7490;display:block;margin-top:6px"></small>' +
      '</div>' +
      coverHtml +
      '<div class="fld"><label>اتصال اختیاری به تعهدهای خرید واقعی</label><div style="border:1px solid var(--brd);border-radius:10px;padding:7px 10px;max-height:140px;overflow:auto">' + legacyHtml + '</div></div>' +
      '<div class="fld"><label>تصویر/فایل فاکتور (اختیاری)</label><div id="slInvFileWrap"></div></div>' +
      '<div class="sl-inv-footer" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap">' +
        '<button type="button" class="bt bt-o" style="min-width:110px" onclick="document.getElementById(\'slInvDlg\').remove()">انصراف</button>' +
        '<button type="button" class="bt" style="min-width:130px" onclick="slInvoiceSave(\'' + ptfOnClickArg(supCd) + '\')">💾 ثبت فاکتور</button>' +
      '</div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    if (typeof attachUploadWidget === 'function') attachUploadWidget('slInvFileWrap', 'supplier-invoices/' + supCd, function (f) { window._slInvFiles.push(f); });
    /* پیش‌پرکردن (برای استفاده‌ی آینده‌ی گام ۶ — دکمه‌ی ثبت مستقیم از داشبورد موازنه فصلی) */
    try {
      if (prefill.amount) document.getElementById('slInvAmt').value = prefill.amount;
      if (prefill.note) document.getElementById('slInvNote').value = prefill.note;
      if (prefill.cover) {
        document.getElementById('slInvType').value = 'official';
        var _cb = document.getElementById('slInvCover');
        if (_cb) { _cb.checked = true; }
        if (prefill.coverPeriod && prefill.coverPeriod.season) {
          var _seasonEl = document.getElementById('slInvCoverSeason');
          if (_seasonEl) _seasonEl.value = String(prefill.coverPeriod.season);
        }
      }
      if (typeof window.slInvTypeChanged === 'function') window.slInvTypeChanged();
      if (prefill.cover && typeof window.slInvCoverToggle === 'function') window.slInvCoverToggle();
      if (typeof window.slInvCalcLive === 'function') window.slInvCalcLive();
    } catch (ePrefill) {}
  };
  /* فاز ۲ / گام ۵: تغییر نمایش فیلد ارزش‌افزوده بر اساس نوع فاکتور */
  window.slInvTypeChanged = function () {
    var t = (document.getElementById('slInvType') || {}).value;
    var vatWrap = document.getElementById('slInvVatWrap');
    if (vatWrap) vatWrap.style.display = t === 'official' ? '' : 'none';
    if (t !== 'official') {
      var cb = document.getElementById('slInvCover');
      if (cb && cb.checked) { cb.checked = false; if (typeof window.slInvCoverToggle === 'function') window.slInvCoverToggle(); }
    }
    if (typeof window.slInvCalcLive === 'function') window.slInvCalcLive();
  };
  /* فاز ۲ / گام ۵: نمایش/مخفی‌سازی بخش فاکتور پوششی/صوری — فاکتور پوششی همیشه رسمی است */
  window.slInvCoverToggle = function () {
    var cb = document.getElementById('slInvCover'), box = document.getElementById('slInvCoverBox');
    var on = !!(cb && cb.checked);
    if (box) box.style.display = on ? '' : 'none';
    if (on) {
      var typeSel = document.getElementById('slInvType');
      if (typeSel) { typeSel.value = 'official'; typeSel.disabled = true; }
      var vatWrap = document.getElementById('slInvVatWrap');
      if (vatWrap) vatWrap.style.display = '';
    } else {
      var typeSel2 = document.getElementById('slInvType');
      if (typeSel2) typeSel2.disabled = false;
    }
    if (typeof window.slInvCalcLive === 'function') window.slInvCalcLive();
  };
  /* فاز ۲ / گام ۵: محاسبه‌ی زنده‌ی ارزش‌افزوده و سود/زیان خالص فاکتور پوششی (فقط نمایشی — چیزی ذخیره نمی‌کند) */
  window.slInvCalcLive = function () {
    var num = function (id) { var el = document.getElementById(id); if (!el) return 0; return typeof ptfNum === 'function' ? ptfNum(el.value) : (+el.value || 0); };
    var cur = (document.getElementById('slInvCur') || {}).value || 'IRR';
    var amount = num('slInvAmt');
    var rate = cur === 'IRR' ? 1 : num('slInvRate');
    var amountIrr = cur === 'IRR' ? amount : Math.round(amount * rate);
    var vatWrap = document.getElementById('slInvVatWrap');
    var vatSumEl = document.getElementById('slInvVatSum');
    var vatAmountIrr = 0;
    if (vatWrap && vatWrap.style.display !== 'none' && vatSumEl) {
      var vatPct = num('slInvVatPct');
      vatAmountIrr = Math.round(amountIrr * vatPct / 100);
      vatSumEl.textContent = amountIrr ? ('ارزش‌افزوده: ' + vatAmountIrr.toLocaleString('fa-IR') + ' ریال — جمع با ارزش‌افزوده: ' + (amountIrr + vatAmountIrr).toLocaleString('fa-IR') + ' ریال') : '';
    }
    var coverCb = document.getElementById('slInvCover'), netEl = document.getElementById('slInvCoverNet');
    if (coverCb && coverCb.checked && netEl) {
      var commissionPct = num('slInvCommissionPct');
      var commissionAmountIrr = Math.round(amountIrr * commissionPct / 100);
      var net = vatAmountIrr - commissionAmountIrr;
      netEl.style.color = net >= 0 ? '#059669' : '#dc2626';
      netEl.textContent = (net >= 0 ? '✅ سود خالص واقعی این فاکتور: ' : '⚠️ زیان خالص این فاکتور (کارمزد از ارزش‌افزوده بیشتر است): ') + Math.abs(net).toLocaleString('fa-IR') + ' ریال (اعتبار ارزش‌افزوده ' + vatAmountIrr.toLocaleString('fa-IR') + ' − کارمزد ' + commissionAmountIrr.toLocaleString('fa-IR') + ')';
    }
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
    var amountIrr = cur === 'IRR' ? amount : Math.round(amount * rate);
    /* فاز ۲ / گام ۵: ارزش‌افزوده برای فاکتور خرید رسمی (پوششی یا واقعی) */
    var vatPct = 0, vatAmountIrr = 0;
    if (isOfficial) {
      var vatWrap = document.getElementById('slInvVatWrap');
      if (vatWrap && vatWrap.style.display !== 'none') {
        vatPct = typeof ptfNum === 'function' ? ptfNum((document.getElementById('slInvVatPct') || {}).value) : +(document.getElementById('slInvVatPct') || {}).value || 0;
        vatAmountIrr = Math.round(amountIrr * vatPct / 100);
      }
    }
    /* فاز ۲ / گام ۵: فاکتور پوششی/صوری — فقط نقش‌های ارشد */
    var isCover = false, coverCommissionPct = 0, coverCommissionAmountIrr = 0, coverPeriod = null, coverNetBenefitIrr = 0;
    var _coverCb = document.getElementById('slInvCover');
    if (_coverCb && _coverCb.checked) {
      if (!(function () { try { return isSenior(); } catch (e) { return false; } })()) { alert('⛔ ثبت فاکتور پوششی/صوری فقط برای مدیران ارشد مجاز است'); return; }
      if (!isOfficial) { alert('⛔ فاکتور پوششی/صوری همیشه باید «رسمی» باشد'); return; }
      coverCommissionPct = typeof ptfNum === 'function' ? ptfNum((document.getElementById('slInvCommissionPct') || {}).value) : +(document.getElementById('slInvCommissionPct') || {}).value || 0;
      if (!(coverCommissionPct > 0)) { alert('⛔ درصد کارمزد فاکتورساز الزامی است'); return; }
      var _confirmCb = document.getElementById('slInvCoverConfirm');
      if (!_confirmCb || !_confirmCb.checked) { alert('⛔ برای ثبت فاکتور پوششی/صوری باید تاییدیه را علامت بزنید'); return; }
      isCover = true;
      coverCommissionAmountIrr = Math.round(amountIrr * coverCommissionPct / 100);
      coverNetBenefitIrr = vatAmountIrr - coverCommissionAmountIrr;
      var seasonEl = document.getElementById('slInvCoverSeason');
      coverPeriod = { year: (typeof ptfFiscalYearOf === 'function' ? ptfFiscalYearOf(date) : '') || '', season: seasonEl ? seasonEl.value : '' };
    }
    var inv = { cd: genCode('SFINV'), supplierCd: supCd, supName: sup.co || '', no: no, dateISO: date, dateFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(date) : date, cur: cur, rate: rate, amount: amount, amountIrr: amountIrr, note: ((document.getElementById('slInvNote') || {}).value || '').trim(), isOfficial: isOfficial, legacyPayableCds: links, files: (window._slInvFiles || []).slice(), status: 'open', t: faDateTime(), by: curSession().name };
    if (isOfficial && vatPct) { inv.vatPct = vatPct; inv.vatAmount = vatAmountIrr; }
    if (isCover) {
      inv.isCover = true;
      inv.coverVatPct = vatPct;
      inv.coverVatAmount = vatAmountIrr;
      inv.coverCommissionPct = coverCommissionPct;
      inv.coverCommissionAmount = coverCommissionAmountIrr;
      inv.coverNetBenefit = coverNetBenefitIrr;
      inv.coverPeriod = coverPeriod;
    }
    d.invoices.unshift(inv);
    if (save(d) === false) { alert('⛔ فاکتور خرید روی حافظهٔ پایدار این دستگاه ذخیره نشد؛ تب را نبندید و پس از رفع خطا دوباره ثبت کنید.'); return; }
    if (links.length) { var pays = getData('ptf_crm_payables'); pays.forEach(function (p) { if (links.indexOf(p.cd) > -1) p.sfInvoiceCd = inv.cd; }); if (setData('ptf_crm_payables', pays) === false) { alert('⛔ لینک تعهدهای خرید ذخیره نشد؛ تب را نبندید.'); return; } }
    try { audit('فاکتور خرید تامین', 'ثبت فاکتور ' + no + ' برای ' + sup.co + ' — ' + money(amount) + ' ' + cur + (links.length ? ' | اتصال به ' + links.length + ' تعهد خرید' : ''), inv.cd); } catch (e) {}
    var m = document.getElementById('slInvDlg'); if (m) m.remove();
    if (typeof window.ptfSyncTrackRecordSave === 'function') window.ptfSyncTrackRecordSave({ key: KEY, id: inv.cd, label: 'فاکتور خرید' });
    else if (typeof ptfToast === 'function') ptfToast('🟡 فاکتور خرید روی این دستگاه ثبت شد؛ در انتظار تأیید سرور…', 'info');
    window.slOpenLedger(supCd);
  };
  window.slOpenLedger = function (supCd) {
    if (!canSee()) { alert('⛔ دسترسی ندارید'); return; }
    var sup = supplier(supCd); if (!sup) return; var d = data(), invs = activeInvoices(d).filter(function (i) { return i.supplierCd === supCd; }), linked = linkedLegacyIds(d), legacy = legacyOpen(sup).filter(function (p) { return !linked[p.cd]; });
    var invRows = invs.map(function (i) { return '<tr><td>' + escP(i.dateFa || i.dateISO) + '</td><td><b>' + escP(i.no) + '</b></td><td>' + money(i.amount) + ' ' + escP(i.cur) + '</td><td>' + money(invRemain(i, d)) + ' ' + escP(i.cur) + '</td><td>' + (i.files || []).map(function (f) { return f.key ? '<a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="margin-left:4px">📎</a><button class="ba" style="color:#dc2626" onclick="slInvoiceRemoveFile(\'' + ptfOnClickArg(i.cd) + '\',\'' + ptfOnClickArg(f.key) + '\')" title="حذف سند">✕</button>' : '📎'; }).join(' ') + '</td><td><button class="ba" onclick="slInvoiceEdit(\'' + ptfOnClickArg(i.cd) + '\')">✏️</button> <button class="ba" onclick="slInvoiceAddFile(\'' + ptfOnClickArg(i.cd) + '\')">📎</button> <button class="ba" style="color:#dc2626" onclick="slInvoiceVoid(\'' + ptfOnClickArg(i.cd) + '\')">ابطال</button></td></tr>'; }).join('');
    var legRows = legacy.map(function (p) { var rem = typeof ptfPayableRemain === 'function' ? ptfPayableRemain(p) : (+p.amount || 0); return '<tr><td>' + escP(p.t || '') + '</td><td>تعهد خرید</td><td>' + escP(p.item || '') + '</td><td>' + money(rem) + ' ' + escP(p.cur || 'IRR') + '</td></tr>'; }).join('');
    var payRows = (d.payments || []).filter(function (p) { return p.supplierCd === supCd; }).map(function (p) { return '<tr><td>' + escP(p.dateFa || p.dateISO) + '</td><td>' + escP(p.method || '') + '</td><td>' + money(p.amount) + ' ' + escP(p.cur) + '</td><td>' + (p.status === 'void' ? 'ابطال‌شده' : (p.unallocated ? 'اعتبار: ' + money(p.unallocated) : 'تخصیص‌یافته')) + '</td><td>' + '</td><td>' + ((p.files || []).map(function (f) { var key = String(f.key || '').replace(/[\\']/g, ''); return key ? '<a href="javascript:void(0)" onclick="openStoredFile(\'' + key + '\')" style="margin-left:4px">📎</a><button class="ba" style="color:#dc2626" onclick="slPaymentRemoveFile(\'' + ptfOnClickArg(p.cd) + '\',\'' + key + '\')" title="حذف سند">✕</button>' : ''; }).join(' ') || '<span style="color:#94a3b8">—</span>') + (p.status === 'void' ? '' : '<button class="ba" onclick="slPaymentEdit(\'' + ptfOnClickArg(p.cd) + '\')">✏️</button> <button class="ba" onclick="slPaymentAddFile(\'' + ptfOnClickArg(p.cd) + '\')">📎</button> <button class="ba" style="color:#dc2626" onclick="slPaymentVoid(\'' + ptfOnClickArg(p.cd) + '\')">ابطال</button>') + '</td></tr>'; }).join('');
    var html = '<div class="md-b" id="slLedgerDlg" style="display:grid;z-index:2600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:900px;max-height:92vh;overflow:auto"><h3>📒 حساب تأمین‌کننده — ' + escP(sup.co || '') + '</h3><div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:9px 12px;margin-bottom:10px">' + balanceHtml(supCd) + '<br><small style="color:#64748b">مانده مثبت = بدهی ما / بستانکاری تأمین‌کننده. پرداخت و چک به‌زودی افزوده می‌شوند.</small></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px"><button class="bt bt-o" onclick="document.getElementById(\'slLedgerDlg\').remove();slPaymentStart(\'' + ptfOnClickArg(supCd) + '\')">💰 پرداخت</button><button class="bt" onclick="document.getElementById(\'slLedgerDlg\').remove();slNewInvoice(\'' + ptfOnClickArg(supCd) + '\')">＋ فاکتور خرید</button></div><h4>فاکتورهای خرید</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>شماره</th><th>مبلغ</th><th>مانده</th><th>فایل</th><th></th></tr></thead><tbody>' + (invRows || '<tr><td colspan="6">فاکتوری ثبت نشده</td></tr>') + '</tbody></table></div><h4 style="margin-top:14px">پرداخت‌ها و اعتبار</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>روش</th><th>مبلغ</th><th>وضعیت</th><th>فایل</th><th></th></tr></thead><tbody>' + (payRows || '<tr><td colspan="6">پرداختی ثبت نشده</td></tr>') + '</tbody></table></div><h4 style="margin-top:14px">تعهدهای خرید legacy بدون فاکتور لینک‌شده</h4><div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>شرح</th><th>مانده</th></tr></thead><tbody>' + (legRows || '<tr><td colspan="4">موردی نیست</td></tr>') + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    /* v34.0.20-alpha (فاز ۱۸): رفع پنجرهٔ همپوشان/تکراری هنگام حذف/ابطال فاکتور — مودال قبلی گردش حساب را قبل از باز کردن جدید حذف می‌کنیم. */
    try { var _oldLg = document.getElementById('slLedgerDlg'); if (_oldLg) _oldLg.remove(); } catch (eOldLg) {}
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.slInvoiceVoid = function (cd) {
    var d = data(), inv = (d.invoices || []).filter(function (i) { return i.cd === cd; })[0]; if (!inv) return;
    if (invPaid(inv, d) > 0) { alert('فاکتور دارای پرداخت است؛ ابتدا پرداخت‌ها را حذف کنید'); return; }
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
    /* v33.23.x فاز ۳: استفاده از helpers مشترک برای تشخیص فعال بودن پرداخت و مبلغ صحیح (amountIrr > amt > amount) */
    var _amtIrr = (window.PTF && window.PTF.paymentAmtIrr) ? window.PTF.paymentAmtIrr : function(p){ return +p.amt || 0; };
    var _isActive = (window.PTF && window.PTF.isPaymentActive) ? window.PTF.isPaymentActive : function(){ return true; };
    return invs.filter(function (i) {
      var paid = ((i.payments || []).concat(i.pays || []).filter(_isActive)).reduce(function (s, p) { return s + _amtIrr(p); }, 0);
      return (+i.amount || 0) - paid > 0;
    }).map(function (i) {
      var o = offers.filter(function (x) { return x.no === i.offerNo; })[0] || {}, c = customers.filter(function (x) { return x.cd === o.buyerCd; })[0] || {};
      var paid = ((i.payments || []).concat(i.pays || []).filter(_isActive)).reduce(function (s, p) { return s + _amtIrr(p); }, 0);
      return '<option value="' + escP(i.cd) + '" data-cust="' + escP(o.buyerCd || '') + '">' + escP(c.co || o.buyerCo || '-') + ' — ' + escP(i.no || i.cd) + ' — مانده ' + money((+i.amount || 0) - paid) + ' ریال</option>';
    }).join('');
  }
  window.slPayMethodUi = function () {
    var m = (document.getElementById('slPayMethod') || {}).value || '';
    var c = document.getElementById('slChequeWrap'), t = document.getElementById('slThirdWrap');
    if (c) c.style.display = (m === 'company_cheque' || m === 'third_party_cheque') ? '' : 'none';
    if (t) t.style.display = m === 'third_party_cheque' ? '' : 'none';
  };
  function slChequeCreate(method, sup, amount, cur, payCd, date, files) {
    if (method !== 'company_cheque' && method !== 'third_party_cheque') return { ok: true };
    /* AUD-05 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
       فرم پرداخت تأمین‌کننده گزینه‌ی «چک شرکت» را به هر کاربری با canWrite()
       (یعنی buyPrice:true یا isSenior — شامل نقش «کارشناس خرید») نشان
       می‌دهد، اما تا این‌جا هیچ گیت نقشی روی خودِ ساخت رکورد چک شرکتی
       نبود؛ بر خلاف فرم عمومی چک (cheques.js) که canCreateCompanyCheque()
       را چک می‌کند. طبق سیاست مصوب، فقط رییس هیات‌مدیره/مدیرعامل/مدیر
       بازرگانی مجاز به صدور چک شرکتی هستند. */
    if (method === 'company_cheque' && !(typeof window.ptfCanCreateCompanyCheque === 'function' && window.ptfCanCreateCompanyCheque())) {
      return { ok: false, error: '⛔ فقط رییس هیات مدیره، مدیرعامل و مدیر بازرگانی می‌توانند چک شرکتی ثبت کنند' };
    }
    if (cur !== 'IRR') return { ok: false, error: 'پرداخت با چک فقط برای فاکتورهای ریالی مجاز است' };
    var no = ((document.getElementById('slChNo') || {}).value || '').trim(), due = ((document.getElementById('slChDue') || {}).value || '').trim(), bank = ((document.getElementById('slChBank') || {}).value || '').trim();
    if (!no || !due) return { ok: false, error: 'شماره/صیاد و تاریخ سررسید چک الزامی است' };
    var checks = getData('ptf_crm_cheques');
    if (checks.some(function (c) { return (c.sayad || c.no) === no && c.st !== 'voided_transfer'; })) return { ok: false, error: 'این شماره/شناسه چک قبلاً ثبت شده است' };
    var rec = { cd: genCode('CHQ'), no: no, sayad: no, amt: amount, dueISO: due, dueFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(due) : due, bank: bank, toWhom: sup.co || '', kind: 'finance', ownership: method === 'company_cheque' ? 'company' : 'third_party', supplierPaymentCd: payCd, supplierCd: sup.cd, createdBySupplierFinance: true, files: (files || []).slice(), t: faDateTime(), by: curSession().user, byNm: curSession().name, notified: {} };
    if (method === 'company_cheque') { rec.st = 'open'; }
    else {
      var sourceCd = ((document.getElementById('slThirdCust') || {}).value || '').trim(), invCd = ((document.getElementById('slThirdInv') || {}).value || '').trim();
      var invs = getData('ptf_crm_invoices'), inv = invs.filter(function (i) { return i.cd === invCd; })[0];
      /* Sprint 267: چک ثالث می‌تواند صرفاً انتقالی باشد؛ اتصال به مشتری/مطالبات اختیاری است. */
      if ((sourceCd && !inv) || (!sourceCd && inv)) return { ok: false, error: 'برای کسر از مطالبات، مشتری و فاکتور مشتری را هر دو انتخاب کنید؛ در غیر این صورت هر دو را خالی بگذارید.' };
      if (sourceCd && inv) {
        var srcOffer = getData('ptf_crm_offers').filter(function (o) { return o.no === inv.offerNo; })[0] || {};
        if (srcOffer.buyerCd !== sourceCd) return { ok: false, error: 'فاکتور انتخاب‌شده متعلق به مشتری انتخاب‌شده نیست' };
        var paid = (window.PTF && PTF.invPaidSum) ? PTF.invPaidSum(inv) : ((inv.payments || []).concat(inv.pays || [])).reduce(function (s, p) { return s + (window.PTF && PTF.paymentAmtIrr ? PTF.paymentAmtIrr(p) : (+p.amt || 0)); }, 0);
        if (amount > (+inv.amount || 0) - paid) return { ok: false, error: 'مبلغ چک از مانده فاکتور مشتری بیشتر است' };
        inv.payments = inv.payments || []; inv.payments.push({ amt: amount, how: 'چک ثالث منتقل‌شده به تامین‌کننده', t: faDate(), by: curSession().name, chequeCd: rec.cd, supplierPaymentCd: payCd, transferred: true }); setData('ptf_crm_invoices', invs);
      }
      rec.st = 'transferred'; rec.reminderDisabled = true; rec.sourceCustomerCd = sourceCd; rec.sourceInvoiceCd = invCd; rec.transferredAt = faDateTime(); rec.transferNote = 'انتقال به تامین‌کننده ' + (sup.co || '');
    }
    /* CHQ-MOD-001: چک شرکت → صادره (issued)؛ چک ثالث → وارده (received) + انتقال (endorsed) */
    if (typeof window.ptfChequeCreate === 'function') {
      if (method === 'company_cheque') {
        window.ptfChequeCreate('issued', rec);
      } else {
        rec.st = 'endorsed'; rec.reminderDisabled = true; rec.sourceCustomerCd = sourceCd; rec.sourceInvoiceCd = invCd; rec.transferredAt = faDateTime(); rec.transferNote = 'انتقال به تامین‌کننده ' + (sup.co || ''); rec.endorsedAt = rec.transferredAt; rec.endorsedBy = curSession().name; rec.endorseTo = sup.co || '';
        window.ptfChequeCreate('received', rec);
      }
    } else {
      checks.unshift(rec); setData('ptf_crm_cheques', checks);
    }
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
    var html = '<div class="md-b" id="slPayDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto"><h3>💰 ثبت پرداخت — ' + escP(sup.co) + '</h3><div class="fr"><div class="fld"><label>تاریخ پرداخت *</label><input id="slPayDate" value="' + (typeof ptfTodayJ === 'function' ? ptfTodayJ() : '') + '" placeholder="1405/04/22" style="direction:ltr"></div><div class="fld"><label>روش پرداخت *</label><select id="slPayMethod" onchange="slPayMethodUi()"><option value="cash">💵 نقدی</option><option value="bank">🏦 حواله / بانکی</option><option value="credit">🔁 تهاتر / اعتبار</option>' + (typeof window.ptfCanCreateCompanyCheque === 'function' && window.ptfCanCreateCompanyCheque() ? '<option value="company_cheque">🧾 چک شرکت</option>' : '') + '<option value="third_party_cheque">↪ چک ثالث منتقل‌شده</option></select></div></div><div class="fld"><label>مبلغ کل پرداخت (' + escP(cur) + ') *</label><input id="slPayAmt" data-money="1" inputmode="numeric" style="direction:ltr"></div>' + (cur !== 'IRR' ? '<div class="fld"><label>نرخ تسعیر (ریال به‌ازای هر ' + escP(cur) + ') *</label><input id="slPayRate" data-money="1" inputmode="numeric" style="direction:ltr"></div>' : '') + '<div class="fld"><label>شرح</label><input id="slPayNote"></div><div class="fld"><label>📎 رسید / تصویر چک (اختیاری)</label><div id="slPayFileWrap" style="min-height:38px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div></div><div id="slChequeWrap" style="display:none"><div class="fr"><div class="fld"><label>شماره / شناسه صیادی چک *</label><input id="slChNo" style="direction:ltr"></div><div class="fld"><label>تاریخ سررسید *</label><input id="slChDue" placeholder="1405/04/29" style="direction:ltr"></div></div><div class="fld"><label>بانک / شعبه</label><input id="slChBank"></div></div><div id="slThirdWrap" style="display:none"><div class="fld"><label>مشتری / صادرکننده چک ثالث *</label><select id="slThirdCust"><option value="">— مشتری را انتخاب کنید —</option>'+ slCustomerOptions() +'</select></div><div class="fld"><label>فاکتور مشتری که از مطالبات آن کسر می‌شود *</label><select id="slThirdInv"><option value="">— فاکتور را انتخاب کنید —</option>'+ slCustomerInvoicesOptions() +'</select></div><small style="color:#0369a1">این چک منتقل‌شده خارج از ید شرکت است؛ reminder ندارد و مبلغ آن از فاکتور مشتری انتخاب‌شده کسر می‌شود.</small></div><h4>تخصیص دستی به فاکتورها</h4><div class="tb2"><table><thead><tr><th>فاکتور</th><th>مانده</th><th>مبلغ تخصیص</th></tr></thead><tbody>' + (rows || '<tr><td colspan="3">فاکتور بازی در این ارز نیست؛ مبلغ پرداخت به اعتبار تأمین‌کننده تبدیل می‌شود.</td></tr>') + '</tbody></table></div><small style="color:#64748b">مجموع تخصیص‌ها می‌تواند کمتر از مبلغ پرداخت باشد؛ باقیمانده به اعتبار شرکت نزد تأمین‌کننده تبدیل می‌شود.</small><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="document.getElementById(\'slPayDlg\').remove()">انصراف</button><button class="bt" onclick="slPaymentSave(\'' + ptfOnClickArg(supCd) + '\',\'' + ptfOnClickArg(cur) + '\')">💾 ثبت پرداخت</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    window._slPayFiles = [];
    try { if (typeof attachUploadWidget === 'function') attachUploadWidget('slPayFileWrap', 'supplier-finance/payment-cheque/' + supCd, function (f) { if (f) window._slPayFiles.push(f); }); } catch (eU) {}
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
    var payFiles = (window._slPayFiles || []).slice();
    var ch = slChequeCreate(method, sup, amount, cur, payCd, date, payFiles); if (!ch.ok) { alert(ch.error); return; }
    var rec = { cd: payCd, supplierCd: supCd, supName: sup.co || '', dateISO: date, dateFa: typeof ptfISOToJ === 'function' ? ptfISOToJ(date) : date, cur: cur, rate: rate, amount: amount, amountIrr: cur === 'IRR' ? amount : Math.round(amount * rate), method: method, note: ((document.getElementById('slPayNote') || {}).value || '').trim(), files: payFiles, allocations: alloc, unallocated: amount - total, status: 'posted', chequeCd: ch.cheque ? ch.cheque.cd : '', thirdPartyInvoiceCd: ch.cheque ? (ch.cheque.sourceInvoiceCd || '') : '', t: faDateTime(), by: curSession().name };
    d.payments.unshift(rec);
    if (save(d) === false) { alert('⛔ پرداخت روی حافظهٔ پایدار این دستگاه ذخیره نشد؛ تب را نبندید و پس از رفع خطا دوباره ثبت کنید.'); return; }
    var legacyList = getData('ptf_crm_payables'); alloc.filter(function(a){return a.legacyCd;}).forEach(function(a){ var lp=legacyList.filter(function(x){return x.cd===a.legacyCd;})[0]; if(lp){ lp.paid=lp.paid||[]; lp.paid.push({amt:a.amount,t:faDate(),by:curSession().name,note:'پرداخت از حساب تامین‌کننده',supplierPaymentCd:payCd}); lp.settled=(typeof ptfPayableRemain==='function'?ptfPayableRemain(lp):0)<=0; }}); if (setData('ptf_crm_payables',legacyList) === false) { alert('⛔ تخصیص پرداخت به تعهدهای خرید ذخیره نشد؛ تب را نبندید.'); return; }
    try { audit('پرداخت تامین', 'پرداخت ' + money(amount) + ' ' + cur + ' به ' + rec.supName + ' — تخصیص ' + money(total) + (rec.unallocated ? ' | اعتبار ' + money(rec.unallocated) : ''), rec.cd); } catch (e) {}
    var m = document.getElementById('slPayDlg'); if (m) m.remove(); if (typeof window.ptfSyncTrackRecordSave === 'function') window.ptfSyncTrackRecordSave({ key: KEY, id: rec.cd, label: 'پرداخت تأمین‌کننده' }); else if (typeof ptfToast === 'function') ptfToast('🟡 پرداخت روی این دستگاه ثبت شد؛ در انتظار تأیید سرور…', 'info'); slOpenLedger(supCd);
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
      if (keep(i.dateISO || '', i.cur || 'IRR', status, refs)) out.push({ date: i.dateISO || '', dateFa: i.dateFa || i.dateISO || '', type: 'فاکتور خرید', no: i.no, ref: refs, itemCount: (i.itemLinks || []).length || (i.legacyPayableCds || []).length || 0, cur: i.cur || 'IRR', debit: +i.amount || 0, credit: 0, status: status, files: (i.files || []).slice(), link: { kind: 'invoice', cd: i.cd } });
    });
    /* فاز ۲ / گام ۷ (crm/DESIGN-OFFICIAL-UNOFFICIAL-SEPARATION-PHASE2.md بند ۱۱):
       طبق تصمیم کارفرما، پرداخت ابطال‌شده باید مثل فاکتور ابطال‌شده کاملاً از
       گردش حساب محو شود؛ برخلاف رفتار قبلی که با برچسب «پرداخت/چک ابطال‌شده»
       باقی می‌ماند. رکورد در ptf_crm_supplier_finance حفظ می‌شود (برای
       audit/رفع‌ابهام آینده)، فقط از این نمای گردش حساب حذف می‌شود. */
    (d.payments || []).filter(function (p) { return p.supplierCd === supCd && p.status !== 'void'; }).forEach(function (p) {
      var cheque = p.chequeCd ? (typeof window.ptfChequeFind === 'function' ? window.ptfChequeFind(p.chequeCd) : getData('ptf_crm_cheques').filter(function (c) { return c.cd === p.chequeCd; })[0]) : null, refs = (p.allocations || []).map(function (a) { var i = (d.invoices || []).filter(function (x) { return x.cd === a.invoiceCd; })[0] || {}; return i.no || a.invoiceCd || a.legacyCd; }).join('، ');
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
      if (keep(p.dateISO || '', p.cur || 'IRR', 'payment', refs)) out.push({ date: p.dateISO || '', dateFa: p.dateFa || p.dateISO || '', type: (cheque ? (cheque.ownership === 'third_party' ? 'چک ثالث منتقل‌شده' : 'چک شرکت') : (p.method === 'bank' ? 'حواله بانکی' : p.method === 'credit' ? 'تهاتر/اعتبار' : 'پرداخت نقدی')), no: cheque ? (cheque.sayad || cheque.no || p.cd) : p.cd, ref: refs, cur: p.cur || 'IRR', debit: 0, credit: (+p.amount || 0), status: 'payment', note: (itemNm? itemNm+' | ':'')+(p.note||''), itemName: itemNm, files: (p.files || []).slice(), link: { kind: 'payment', cd: p.cd } });
    });
    /* CHQ-MOD-001: چک‌های صادرهٔ ماژول (issued) برای همین تامین‌کننده که هنوز وصول/ابطال نشده‌اند
       و payment لینک‌شده ندارند → ردیف گردش (بستانکار = مبلغ چک) */
    try {
      var issuedChq = (typeof window.ptfChequeIssued === 'function') ? window.ptfChequeIssued() : [];
      issuedChq.forEach(function (c) {
        if (!c || c.supplierCd !== supCd) return;
        if (c.st !== 'open' && c.st !== 'transferred') return;
        var payLink = (d.payments || []).some(function (p) { return p.chequeCd === c.cd; });
        if (payLink) return; /* قبلاً در ردیف پرداخت آمده */
        if (keep(c.dueISO || '', 'IRR', 'cheque', '')) out.push({ date: c.dueISO || '', dateFa: c.dueFa || c.dueISO || '', type: 'چک صادره (در گردش)', no: c.sayad || c.no || c.cd, ref: sup.co || '', cur: 'IRR', debit: 0, credit: (+c.amt || 0), status: 'cheque', note: (c.bank ? c.bank : ''), link: { kind: 'cheque', cd: c.cd } });
      });
    } catch (eChq) {}
    (d.adjustments || []).filter(function (a) { return a && a.supplierCd === supCd && a.status !== 'void'; }).forEach(function (a) {
      var amt = +a.amount || 0;
      var isOpen = a.kind === 'opening' || a.refYear === 'opening';
      var curA = a.cur || 'IRR';
      var typ = isOpen ? 'مانده افتتاحیه' : 'سند اصلاحی';
      var refs = a.note || a.cd || '';
      var date = a.dateISO || '';
      /* افتتاحیه همیشه در گردش/چاپ می‌آید (حتی اگر تاریخ ثبت بعد از فیلتر باشد)
         چون ماندهٔ اول دوره است، نه یک تراکنش داخل بازه. */
      var pass = isOpen
        ? (!(f.cur && f.cur !== 'all' && curA !== f.cur) && !(f.status && f.status !== 'all' && f.status !== 'opening') && !(f.ref && String(refs).toLowerCase().indexOf(String(f.ref).toLowerCase()) < 0))
        : keep(date, curA, 'adjustment', refs);
      if (pass) out.push({
        date: isOpen ? (date || '0000-01-01') : date,
        dateFa: a.dateFa || date,
        type: typ,
        no: a.cd,
        ref: refs,
        cur: curA,
        debit: amt > 0 ? amt : 0,
        credit: amt < 0 ? Math.abs(amt) : 0,
        status: isOpen ? 'opening' : 'adjustment',
        note: a.note || '',
        opening: !!isOpen
      });
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
    out.sort(function (a, b) { if (!!a.opening !== !!b.opening) return a.opening ? -1 : 1; return String(a.date).localeCompare(String(b.date)) || String(a.no).localeCompare(String(b.no)); });
    var running = {}; out.forEach(function (e) { running[e.cur] = (running[e.cur] || 0) + e.debit - e.credit; e.balance = running[e.cur]; });
    return out;
  }
  function slFiltersFromDom() { var from=((document.getElementById('slFfrom')||{}).value||''),to=((document.getElementById('slFto')||{}).value||''); if(typeof ptfJToISO==='function'){from=ptfJToISO(from)||from;to=ptfJToISO(to)||to;} return { from: from, to: to, cur: ((document.getElementById('slFcur') || {}).value || 'all'), status: ((document.getElementById('slFstatus') || {}).value || 'all'), ref: ((document.getElementById('slFref') || {}).value || '').trim() }; }
    function supplierInvoiceSummary(e) {
    if (e.type !== 'فاکتور خرید') return '';
    return (e.itemCount ? e.itemCount + ' قلم' : 'تعداد اقلام نامشخص') + ' — تاریخ ' + (e.dateFa || e.date || 'نامشخص');
  }
  function slLedgerFilesHtml(e) {
    var files = (e && e.files) || [];
    if (!files.length) return '';
    return '<div class="sl-ledger-files" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:6px;padding-top:5px;border-top:1px dashed var(--brd)">' +
      '<small style="color:#64748b">📎 ' + files.length.toLocaleString('fa-IR') + ' سند:</small>' +
      files.map(function (f, idx) {
        var key = String((typeof window.ptfFileStorageKey === 'function' ? window.ptfFileStorageKey(f) : (f && f.key)) || '');
        if (!key) return '';
        var name = String((f && f.name) || ('سند ' + (idx + 1)));
        var remove = '';
        if (e.link && e.link.kind === 'invoice') remove = '<button type="button" class="ba" style="color:#dc2626;padding:1px 4px" title="حذف سند" onclick="slInvoiceRemoveFile(\'' + ptfOnClickArg(e.link.cd) + '\',\'' + ptfOnClickArg(key) + '\')">✕</button>';
        else if (e.link && e.link.kind === 'payment') remove = '<button type="button" class="ba" style="color:#dc2626;padding:1px 4px" title="حذف سند" onclick="slPaymentRemoveFile(\'' + ptfOnClickArg(e.link.cd) + '\',\'' + ptfOnClickArg(key) + '\')">✕</button>';
        return '<span style="display:inline-flex;align-items:center;gap:2px"><button type="button" class="ba" style="color:#0e7490;padding:2px 5px" title="مشاهده ' + escP(name) + '" onclick="openStoredFile(\'' + ptfOnClickArg(key) + '\',\'' + ptfOnClickArg(name) + '\')">👁 ' + escP(name) + '</button>' + remove + '</span>';
      }).join('') + '</div>';
  }
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
    var act = e.link && e.link.kind === 'invoice' ? '<button class="ba" onclick="slInvoiceEdit(\'' + ptfOnClickArg(e.link.cd) + '\')">✏️</button> <button class="ba" onclick="slInvoiceAddFile(\'' + ptfOnClickArg(e.link.cd) + '\')">📎</button>' : e.link && e.link.kind === 'payment' ? '<button class="ba" onclick="slPaymentEdit(\'' + ptfOnClickArg(e.link.cd) + '\')">✏️</button> <button class="ba" onclick="slPaymentAddFile(\'' + ptfOnClickArg(e.link.cd) + '\')">📎</button>' : '';
    var displayRef = '';
    if(e.type && e.type.indexOf('legacy')>-1){
      displayRef = '<b>'+escP(e.no)+'</b><br><small style="color:#0e7490">📦 '+(itemName?escP(itemName):'بدون نام')+'</small><br><small style="color:#64748b">درخواست: '+escP(e.ref||'')+'</small>';
    } else {
      displayRef = '<b>' + (e.type === 'فاکتور خرید' ? 'فاکتور ' : '') + escP(e.no) + '</b>' + (e.type === 'فاکتور خرید' ? '<br><small style="color:#64748b">' + escP(supplierInvoiceSummary(e)) + '</small>' : (e.ref ? '<br><small>'+escP(e.ref)+'</small>' : '')) + (itemName ? '<br><small style="color:#0e7490">📦 '+escP(itemName)+'</small>' : '');
    }
    displayRef += slLedgerFilesHtml(e);
    return '<tr><td>' + escP(e.dateFa) + '</td><td>' + escP(e.type) + '</td><td>' + displayRef + '</td><td>' + (e.debit ? money(e.debit) : '—') + '</td><td>' + (e.credit ? money(e.credit) : '—') + '</td><td><b>' + money(e.balance) + ' ' + escP(e.cur) + '</b></td><td>' + act + '</td></tr>';
  }).join(''); }
  window.slOpenLedger = function (supCd, filters) {
    if (!canSee()) { alert('⛔ دسترسی ندارید'); return; }
    var oldLedger = document.getElementById('slLedgerDlg'); if (oldLedger) oldLedger.remove();
    var sup = supplier(supCd); if (!sup) return; var rows = slEventRows(supCd, filters), curs = ['all'].concat(rows.map(function (r) { return r.cur; }).filter(function (x, i, a) { return a.indexOf(x) === i; }));
    var f = filters || {}; var opts = curs.map(function (c) { return '<option value="' + escP(c) + '"' + ((f.cur || 'all') === c ? ' selected' : '') + '>' + (c === 'all' ? 'همه ارزها' : escP(c)) + '</option>'; }).join('');
    var html = '<div class="md-b" id="slLedgerDlg" style="display:grid;z-index:2700" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:1000px;max-height:92vh;overflow:auto"><h3>📒 گردش حساب تأمین‌کننده — ' + escP(sup.co || '') + '</h3><div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:9px 12px;margin-bottom:10px">' + balanceHtml(supCd) + '</div><div class="fr"><div class="fld"><label>از تاریخ</label><input id="slFfrom" value="' + escP(f.from || '') + '"></div><div class="fld"><label>تا تاریخ</label><input id="slFto" value="' + escP(f.to || '') + '"></div></div><div class="fr"><div class="fld"><label>ارز</label><select id="slFcur">' + opts + '</select></div><div class="fld"><label>وضعیت</label><select id="slFstatus"><option value="all">همه</option><option value="open"' + (f.status === 'open' ? ' selected' : '') + '>فاکتور باز</option><option value="settled"' + (f.status === 'settled' ? ' selected' : '') + '>فاکتور تسویه</option><option value="payment"' + (f.status === 'payment' ? ' selected' : '') + '>پرداخت</option><option value="legacy"' + (f.status === 'legacy' ? ' selected' : '') + '>تعهد legacy</option><option value="opening"' + (f.status === 'opening' ? ' selected' : '') + '>مانده افتتاحیه</option><option value="adjustment"' + (f.status === 'adjustment' ? ' selected' : '') + '>سند اصلاحی</option></select></div></div><div class="fld"><label>جستجوی RFQ / مرجع خرید</label><input id="slFref" value="' + escP(f.ref || '') + '"></div><div style="display:flex;gap:7px;justify-content:flex-end;margin-bottom:9px"><button class="bt bt-o" onclick="slLedgerApply(\'' + ptfOnClickArg(supCd) + '\')">اعمال فیلتر</button><button class="bt bt-o" onclick="slLedgerCsv(\'' + ptfOnClickArg(supCd) + '\')">📥 CSV</button><button class="bt bt-o" onclick="slLedgerPrint(\'' + ptfOnClickArg(supCd) + '\')">🖨 PDF/چاپ</button><button class="bt" onclick="document.getElementById(\'slLedgerDlg\').remove();slPaymentStart(\'' + ptfOnClickArg(supCd) + '\')">💰 پرداخت</button><button class="bt" onclick="document.getElementById(\'slLedgerDlg\').remove();slNewInvoice(\'' + ptfOnClickArg(supCd) + '\')">＋ فاکتور</button></div><div class="tb2"><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده جاری</th><th>عملیات</th></tr></thead><tbody>' + (slLedgerTable(rows) || '<tr><td colspan="6">گردشی مطابق فیلتر نیست</td></tr>') + slClaimAsOfHtml(rows, slFaDigits((typeof ptfISOToJ==='function'&&f.to?ptfISOToJ(f.to):f.to)||(typeof ptfTodayJ==='function'?ptfTodayJ():''))) + '</tbody></table></div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.slLedgerApply = function (supCd) { var m = document.getElementById('slLedgerDlg'); if (m) m.remove(); slOpenLedger(supCd, slFiltersFromDom()); };
  function slCsv(rows) { return '\uFEFF' + [['تاریخ','نوع','سند/مرجع','کالا','بدهکار','بستانکار','مانده','ارز']].concat(rows.map(function (e) { var item = e.itemName||e.note||'', visibleRef = e.type === 'فاکتور خرید' ? supplierInvoiceSummary(e) : (e.ref || ''); return [e.dateFa,e.type,e.no+' '+visibleRef,item,e.debit||'',e.credit||'',e.balance,e.cur]; })).map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g,'""') + '"'; }).join(','); }).join('\r\n'); }
  window.slLedgerCsv = function (supCd) { var f=slFiltersFromDom(), rows = slEventRows(supCd, f), asOfIso=f.to||(new Date().toISOString().slice(0,10)), asOfFa=typeof ptfISOToJ==='function'?ptfISOToJ(asOfIso):asOfIso; var extra=slClaimAsOfCsv(rows,asOfFa); var csv=slCsv(rows); extra.forEach(function(r){ csv += '\r\n' + r.map(function(x){ return '"' + String(x).replace(/"/g,'""') + '"'; }).join(','); }); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' })); a.download = 'supplier-ledger-' + supCd + '-' + new Date().toISOString().slice(0,10) + '.csv'; a.click(); };

  function slClaimAsOfHtml(rows, asOfFa) {
    var last = {};
    (rows || []).forEach(function (e) { last[e.cur || 'IRR'] = +e.balance || 0; });
    var curs = Object.keys(last);
    if (!curs.length) return '<tr style="background:#fff7ed;font-weight:800"><td colspan="7">مطالبه تأمین‌کننده در تاریخ گزارش (' + escP(asOfFa || '') + '): صفر</td></tr>';
    return curs.map(function (c) {
      var v = last[c];
      var label = v >= 0
        ? ('مطالبه تأمین‌کننده در تاریخ گزارش (' + (asOfFa || '') + ')')
        : ('اعتبار شرکت نزد تأمین‌کننده در تاریخ گزارش (' + (asOfFa || '') + ')');
      return '<tr style="background:#fef3c7;font-weight:800"><td colspan="5">' + escP(label) + '</td><td><b>' + slFaDigits(money(Math.abs(v))) + ' ' + slCurFa(c) + '</b></td><td></td></tr>';
    }).join('');
  }
  function slClaimAsOfCsv(rows, asOfFa) {
    var last = {};
    (rows || []).forEach(function (e) { last[e.cur || 'IRR'] = +e.balance || 0; });
    return Object.keys(last).map(function (c) {
      var v = last[c];
      var label = v >= 0 ? 'مطالبه تأمین‌کننده در تاریخ گزارش' : 'اعتبار شرکت نزد تأمین‌کننده در تاریخ گزارش';
      return [asOfFa || '', label, '', '', v > 0 ? v : '', v < 0 ? Math.abs(v) : '', v, c];
    });
  }
  function slFaDigits(v) { return String(v == null ? '' : v).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function slCurFa(c) { return ({ IRR: 'ریال', USD: 'دلار', EUR: 'یورو', CNY: 'یوان', AED: 'درهم', GBP: 'پوند' })[c] || c || ''; }
  function slPrintRows(rows) { return rows.map(function (e) { var item = e.itemName||e.note||'', visibleRef = e.type === 'فاکتور خرید' ? supplierInvoiceSummary(e) : (e.ref || ''); return '<tr><td>' + slFaDigits(e.dateFa) + '</td><td>' + escP(e.type === 'payment' ? 'پرداخت' : e.type) + '</td><td><b>' + escP(e.no) + '</b>' + (visibleRef ? '<br><small>' + escP(visibleRef) + '</small>' : '') + (item ? '<br><small style="color:#0e7490">📦 '+escP(item)+'</small>' : '') + '</td><td>' + (e.debit ? slFaDigits(money(e.debit)) : '—') + '</td><td>' + (e.credit ? slFaDigits(money(e.credit)) : '—') + '</td><td><b>' + slFaDigits(money(e.balance)) + ' ' + slCurFa(e.cur) + '</b></td></tr>'; }).join(''); }
  window.slLedgerPrint = function (supCd) { var sup=supplier(supCd), rows=slEventRows(supCd,slFiltersFromDom()), w=window.open('','_blank'); if(!w)return; w.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>گردش حساب '+escP(sup.co||'')+'</title><style>body{font-family:Tahoma;direction:rtl;padding:20px;color:#111}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}@media print{button{display:none}}</style></head><body><h2>گردش حساب تأمین‌کننده — '+escP(sup.co||'')+'</h2><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>'+slPrintRows(rows)+'</tbody></table></body></html>'); w.document.close(); w.print(); };

    function slBoxRows() {
      if (!canSee()) return '';
      var sups = getData('ptf_crm_suppliers'), sd = data();
      return sups.map(function (s) {
        var b = balance(s.cd);
        var has = (sd.invoices || []).some(function (i) { return i.supplierCd === s.cd; }) ||
          (sd.payments || []).some(function (p) { return p.supplierCd === s.cd; }) ||
          legacyOpen(s).length;
        if (!b.length && !has) return '';
        return '<tr><td><b>' + escP(s.co || '') + '</b></td><td>' + (b.length ? balanceHtmlFrom(b, s.cd) : '<span style="color:#059669">مانده صفر / فقط تاریخچه</span>') + '</td><td><button class="ba" onclick="slOpenLedger(\'' + ptfOnClickArg(s.cd) + '\')">📒 حساب و اسناد</button></td></tr>';
      }).filter(Boolean).join('');
    }
    /* v34.7.89 (SUP-PERF-003): lazy-load کادر «فاکتور، حساب و پرداخت».
       قبلاً همهٔ balance ها (که روی همه فاکتور/پرداخت لوپ می‌زنند) همزمان با ساخت پنل
       محاسبه می‌شد و باز شدن تب تامین‌کنندگان را کند می‌کرد. اکنون قاب با placeholder
       ساخته می‌شود و پس از رندر پنل، جدول با slBoxRows پر می‌شود (یک‌بار). */
    window.ptfSlBoxLazy = function () {
      var body = document.getElementById('slBoxBody');
      if (!body || window._slBoxLazyDone) return;
      var rows = slBoxRows();
      if (rows) body.innerHTML = rows;
      else body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:14px;font-size:12px">گردش حسابی برای نمایش نیست.</td></tr>';
      window._slBoxLazyDone = true;
    };
    function box() {
      if (!canSee()) return '';
      var loading = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:14px;font-size:12px">⏳ در حال محاسبه گردش حساب تامین‌کنندگان…</td></tr>';
      setTimeout(function () { if (typeof window.ptfSlBoxLazy === 'function') window.ptfSlBoxLazy(); }, 30);
      return '<details id="slBox" open style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:12px 14px;margin-bottom:14px"><summary style="cursor:pointer;font-weight:900;color:#0c4a6e">🧾 فاکتور، حساب و پرداخت تأمین‌کنندگان</summary><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px"><small style="color:#0369a1">فاکتور، پرداخت و چک؛ برای باز/بستن روی عنوان کلیک کنید.</small><button class="bt" onclick="slNewInvoice()">＋ فاکتور خرید</button></div><div class="tb2" style="margin-top:10px"><table><thead><tr><th>تأمین‌کننده</th><th>مانده</th><th></th></tr></thead><tbody id="slBoxBody">' + loading + '</tbody></table></div></details>';
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
  window.slAckLinkFromQuality = function (invoiceCd) {
    var d = data();
    var inv = (d.invoices || []).filter(function (x) { return x.cd === invoiceCd; })[0];
    if (!inv) { if (typeof ptfToast === 'function') ptfToast('فاکتور پیدا نشد', 'e'); return; }
    window.slAckLinkMismatch(inv.supplierCd, invoiceCd);
  };
  window.slAckLinkMismatch = function (supCd, invoiceCd) {
    var d = data();
    var invs = activeInvoices(d).filter(function (i) { return i.supplierCd === supCd && (!invoiceCd || i.cd === invoiceCd) && invoiceLinkMismatchActive(i); });
    if (!invs.length) { if (typeof ptfToast === 'function') ptfToast('اخطار فعالی برای برداشتن نیست', 'info'); return; }
    var msg = invoiceCd
      ? 'اخطار مغایرت مبلغ فاکتور با تعهدهای لینک‌شده برای این فاکتور برداشته شود؟ مانده حساب عوض نمی‌شود.'
      : ('اخطار مغایرت مبلغ لینک برای ' + invs.length + ' فاکتور این تأمین‌کننده برداشته شود؟\n\nمعمولاً وقتی بعضی اقلام قیمت خرید واقعی ندارند، جمع تعهدها با فاکتور یکی نمی‌شود. این تأیید فقط اخطار را پنهان می‌کند.');
    if (!confirm(msg)) return;
    var who = '';
    try { who = curSession().name || ''; } catch (e) {}
    invs.forEach(function (i) {
      var m = invoiceLinkMismatch(i);
      i.linkMismatchAck = true;
      i.linkMismatchAckSig = m.sig;
      i.linkMismatchAckAt = faDateTime();
      i.linkMismatchAckBy = who;
    });
    save(d);
    try { audit('حساب تامین', 'تأیید و برداشتن اخطار مغایرت مبلغ لینک — ' + invs.map(function (i) { return i.no || i.cd; }).join('، '), supCd); } catch (eA) {}
    if (typeof ptfToast === 'function') ptfToast('✅ اخطار مغایرت مبلغ لینک برداشته شد', 'ok');
    if (typeof slRefreshSupplierPanel === 'function') slRefreshSupplierPanel();
    if (typeof slFinanceRowsRender === 'function') slFinanceRowsRender();
    if (document.getElementById('slLedgerDlg')) slOpenLedger(supCd);
  };
  window.slInvoiceLinkLegacy = function (invoiceCd) {
    var d = data(), inv = (d.invoices || []).filter(function (x) { return x.cd === invoiceCd; })[0];
    if (!inv) return;
    var supplierRecord = getData('ptf_crm_suppliers').filter(function (s) { return s.cd === inv.supplierCd; })[0] || {};
    var normSupplier = function (v) { return String(v || '').replace(/[\u200c\u200e\u200f\s\-_.،,؛;]/g, '').toLowerCase(); };
    var supplierNames = [inv.supName, supplierRecord.co, supplierRecord.name].filter(Boolean).map(normSupplier);
    var linkedToThisInvoice = {};
    (inv.legacyPayableCds || []).forEach(function (cd) { linkedToThisInvoice[cd] = true; });
    var pays = getData('ptf_crm_payables').filter(function (p) {
      var sameSupplier = (inv.supplierCd && p.supplierCd && inv.supplierCd === p.supplierCd) || supplierNames.indexOf(normSupplier(p.sup || p.supName)) > -1;
      return linkedToThisInvoice[p.cd] || (sameSupplier && (p.pay === 'credit' || p.sfInvoiceCd === invoiceCd));
    });
    if (!pays.length) { alert('تعهد خرید مرتبطی برای این تأمین‌کننده پیدا نشد.'); return; }
    var checked = {};
    (inv.legacyPayableCds || []).forEach(function (cd) { checked[cd] = true; });
    var rows = pays.map(function (p) {
      var owned = p.sfInvoiceCd && p.sfInvoiceCd !== invoiceCd;
      return '<label style="display:flex;gap:8px;align-items:flex-start;padding:7px 4px;border-bottom:1px dashed #e2e8f0;' + (owned ? 'opacity:.65' : '') + '"><input type="checkbox" class="sfLegacyLink" value="' + escP(p.cd) + '"' + (checked[p.cd] ? ' checked' : '') + '><span><b>' + escP(p.item || p.desc || 'تعهد خرید') + '</b><br><small>' + escP(p.cd) + ' — ' + escP(p.inqNo || '') + ' — ' + money(p.amount) + ' ' + escP(p.cur || 'IRR') + (owned ? ' — متصل به فاکتور دیگر' : '') + '</small></span></label>';
    }).join('');
    var html = '<div class="md-b" id="sfLinkDlg" style="display:grid;z-index:3000" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:620px"><h3>🧷 اصلاح لینک فاکتور ' + escP(inv.no || inv.cd) + '</h3><div style="font-size:12px;color:#64748b;margin-bottom:8px">فقط رابطهٔ فاکتور با تعهدهای خرید تغییر می‌کند؛ مبلغ فاکتور و مبلغ تعهدها تغییر نمی‌کند.</div><div style="max-height:360px;overflow:auto">' + rows + '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button><button class="bt" onclick="slInvoiceLinkLegacySave(\'' + ptfOnClickArg(invoiceCd) + '\')">ذخیره لینک‌ها</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.slInvoiceLinkLegacySave = function (invoiceCd) {
    var d = data(), inv = (d.invoices || []).filter(function (x) { return x.cd === invoiceCd; })[0];
    if (!inv) return;
    var selected = {};
    document.querySelectorAll('#sfLinkDlg .sfLegacyLink:checked').forEach(function (x) { selected[x.value] = true; });
    var pays = getData('ptf_crm_payables'), linked = [];
    pays.forEach(function (p) {
      if (selected[p.cd]) {
        d.invoices.forEach(function (other) { other.legacyPayableCds = (other.legacyPayableCds || []).filter(function (cd) { return cd !== p.cd || other.cd === invoiceCd; }); });
        p.sfInvoiceCd = invoiceCd;
        linked.push(p.cd);
      } else if (p.sfInvoiceCd === invoiceCd) {
        delete p.sfInvoiceCd;
      }
    });
    inv.legacyPayableCds = linked;
    setData('ptf_crm_payables', pays);
    save(d);
    try { audit('حساب تامین', 'اصلاح لینک فاکتور ' + (inv.no || inv.cd) + ' — ' + linked.length + ' تعهد', invoiceCd); } catch (e) {}
    var dlg = document.getElementById('sfLinkDlg'); if (dlg) dlg.remove();
    slReconcileOpen(inv.supplierCd);
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
      var stHtml = typeof window.ptfInvoiceLinkStatusHtml === 'function' ? window.ptfInvoiceLinkStatusHtml(i) : '';
      var mismatchOn = invoiceLinkMismatchActive(i);
      var ackNote = (!mismatchOn && i.linkMismatchAck && Math.abs(diff) > 1) ? '<br><small style="color:#64748b">اخطار با تأیید کاربر برداشته شد</small>' : '';
      var ackBtn = mismatchOn ? ' <button class="bt bt-o" style="padding:3px 8px;font-size:11px;margin-top:4px;color:#7c3aed" onclick="slAckLinkMismatch(\'' + ptfOnClickArg(supCd) + '\',\'' + ptfOnClickArg(i.cd) + '\')">برداشتن اخطار</button>' : '';
      return '<tr><td>' + escP(i.no) + '</td><td>' + money(i.amountIrr || i.amount) + ' ریال</td><td>' + money(legacy) + ' ریال</td><td>' + (i.legacyPayableCds || []).length + '</td><td>' + stHtml + (Math.abs(diff) <= 1 ? '' : '<br><small style="color:#dc2626">اختلاف ' + money(diff) + ' ریال</small>') + ackNote + '<br><button class="bt bt-o" style="padding:3px 8px;font-size:11px;margin-top:4px" onclick="slInvoiceLinkLegacy(\'' + ptfOnClickArg(i.cd) + '\')">🧷 اصلاح لینک</button>' + ackBtn + '</td></tr>';
    }).join('');
    var unlinked = legacyOpen(sup).filter(function (p) { return !p.sfInvoiceCd && !linkedIds[p.cd]; });
    var unlinkedIrr = unlinked.reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
    var html = '<div class="md-b" style="display:grid;z-index:2800" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:920px"><h3>🔎 تطبیق افتتاحیه، فاکتور و خرید واقعی — ' + escP(sup.co || '') + '</h3><div style="font-size:12px;color:#64748b;margin-bottom:8px">این گزارش فقط‌خواندنی است؛ migration یا اصلاح خودکار انجام نمی‌شود و هیچ مبلغی در این مسیر تغییر نمی‌کند.</div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px"><span class="bd">فاکتور رسمی: ' + money(officialIrr) + ' ریال</span><span class="bd">خرید legacy لینک‌شده: ' + money(linkedIrr) + ' ریال</span><span class="bd">افتتاحیه/adjustment: ' + money(openingIrr) + ' ریال</span><span class="bd" style="background:#fff7ed;color:#9a3412">legacy بدون لینک: ' + unlinked.length + ' مورد / ' + money(unlinkedIrr) + ' ریال</span></div><div class="tb2"><table><thead><tr><th>فاکتور</th><th>مبلغ فاکتور</th><th>خرید لینک‌شده</th><th>تعداد لینک</th><th>نتیجه</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">فاکتور لینک‌شده‌ای نیست</td></tr>') + '</tbody></table></div><div style="margin-top:10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:9px">تعهدهای legacy لینک‌نشده: <b>' + unlinked.length + '</b> مورد — این موارد در گزارش رسمی جدا می‌مانند تا دوباره‌شماری نشوند.</div><div style="text-align:left;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  var _slOpenLedger265 = window.slOpenLedger;
  window.slOpenLedger = function (supCd, filters) { _slOpenLedger265(supCd, filters); var dlg=document.getElementById('slLedgerDlg'); if(!dlg)return; var h=dlg.querySelector('h3'); if(h&&!dlg.querySelector('.slReconBtn')) h.insertAdjacentHTML('afterend','<div style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:7px"><button class="bt bt-o slReconBtn" style="font-size:11px;color:#7c3aed" onclick="slReconcileOpen(\''+ptfOnClickArg(supCd)+'\')">🔎 تطبیق خرید/فاکتور</button><button class="bt bt-o" style="font-size:11px" onclick="slAdjustmentOpen(\''+ptfOnClickArg(supCd)+'\')">🧾 سند اصلاحی</button></div>'); };

  /* ============ Sprint 267: UAT corrections / editing / Jalali / instant refresh ============ */
  function slJalali(id) { var el=document.getElementById(id); if(el && typeof ptfISOToJ==='function'){ try{el.type='text';el.value=ptfISOToJ(el.value)||el.value;el.placeholder='1405/04/22';}catch(e){} } }
  var _slInvForm267=window.slInvoiceForm;
  window.slInvoiceForm=function(supCd){_slInvForm267(supCd);slJalali('slInvDate');var l=document.querySelector('#slInvDlg label');if(l&&l.textContent.indexOf('تاریخ')>-1)l.textContent='شماره فاکتور *';var ds=document.querySelectorAll('#slInvDlg label');ds.forEach(function(x){if(x.textContent.indexOf('تاریخ فاکتور')>-1)x.textContent='تاریخ فاکتور (شمسی) *';});};
  var _slPayForm267=window.slPaymentForm;
  window.slPaymentForm=function(supCd,cur){_slPayForm267(supCd,cur);slJalali('slPayDate');slJalali('slChDue');document.querySelectorAll('#slPayDlg label').forEach(function(x){if(x.textContent.indexOf('تاریخ پرداخت')>-1)x.textContent='تاریخ پرداخت (شمسی) *';if(x.textContent.indexOf('تاریخ سررسید')>-1)x.textContent='تاریخ سررسید (شمسی) *';});};
  window.slInvoiceEdit = function (cd) {
    var initialData = data(), initial = fileRecord('invoice', cd, initialData); if (!initial) return;
    window._slInvEditCd = cd; window._slInvEditNewFiles = []; /* سازگاری با نسخه‌های قبلی */
    var filesHtml = (initial.files || []).map(function (f) {
      var key = String(f.key || '').replace(/[\\']/g, '');
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;flex-wrap:wrap"><a href="javascript:void(0)" onclick="openStoredFile(\'' + key + '\',\'' + ptfOnClickArg(f.name || 'فایل') + '\')" style="color:#0e7490;flex:1">📎 ' + escP(f.name || 'فایل') + '</a><button class="ba" style="color:#dc2626" onclick="slInvoiceRemoveFile(\'' + ptfOnClickArg(cd) + '\',\'' + key + '\')">✕</button></div>';
    }).join('') || '<div style="color:#94a3b8;font-size:12px">سندی ثبت نشده است</div>';
    var filesBox = '<div style="margin-top:6px;border:1px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"><b style="font-size:12px">📎 اسناد فاکتور</b><small style="display:block;color:#047857;margin-top:3px">فایل پس از آپلود همان لحظه ذخیره می‌شود؛ بستن فرم آن را حذف نمی‌کند.</small>' + filesHtml + '<div id="slInvEditFilesUp" style="margin-top:6px"></div></div>';
    var linkBox = typeof window.ptfInvoiceLinkStatusHtml === 'function'
      ? '<div style="margin-bottom:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;font-size:12px">وضعیت لینک: ' + window.ptfInvoiceLinkStatusHtml(initial) + '</div>'
      : '';
    ptfDialog({
      title: '✏️ ویرایش فاکتور خرید ' + escP(initial.no), body: linkBox + filesBox,
      fields: [{id:'no',label:'شماره فاکتور',value:initial.no,required:true},{id:'date',label:'تاریخ فاکتور (شمسی)',value:initial.dateFa||initial.dateISO,dir:'ltr',required:true},{id:'amount',label:'مبلغ',type:'number',money:false,value:initial.amount,dir:'ltr',required:true},{id:'isOfficial',label:'نوع فاکتور خرید',type:'select',optionsHtml:'<option value=""' + (!Object.prototype.hasOwnProperty.call(initial,'isOfficial') ? ' selected' : '') + '>تعیین نشده</option><option value="yes"' + (initial.isOfficial === true ? ' selected' : '') + '>رسمی</option><option value="no"' + (initial.isOfficial === false ? ' selected' : '') + '>غیررسمی</option>'},{id:'note',label:'یادداشت',type:'textarea',value:initial.note||''}],
      okText: 'ذخیره', onOk: function (v) {
        var d = data(), i = fileRecord('invoice', cd, d); if (!i) return;
        var oldOfficial = Object.prototype.hasOwnProperty.call(i,'isOfficial') ? i.isOfficial : null;
        var iso = typeof ptfJToISO === 'function' ? (ptfJToISO(v.date) || v.date) : v.date, amt = +v.amount || 0;
        if (!v.no || !iso || amt < invPaid(i, d)) { alert('شماره، تاریخ و مبلغ معتبر (حداقل برابر پرداخت تخصیص‌یافته) الزامی است'); return; }
        i.no=v.no; i.dateISO=iso; i.dateFa=typeof ptfISOToJ==='function'?ptfISOToJ(iso):iso; i.amount=amt; i.amountIrr=i.cur==='IRR'?amt:Math.round(amt*(+i.rate||0)); i.note=v.note||'';
        if(v.isOfficial==='yes') i.isOfficial=true; else if(v.isOfficial==='no') i.isOfficial=false; else delete i.isOfficial;
        i.updatedAtISO = new Date().toISOString(); i.updatedBy = curSession().name;
        save(d); try { audit('فاکتور خرید تامین','ویرایش فاکتور '+i.no+(oldOfficial!==(Object.prototype.hasOwnProperty.call(i,'isOfficial')?i.isOfficial:null)?' — تغییر نوع سند':''),cd); } catch(e) {}
        slOpenLedger(i.supplierCd);
      }
    });
    setTimeout(function () {
      try { if (typeof attachUploadWidget === 'function') attachUploadWidget('slInvEditFilesUp', 'supplier-invoices/' + initial.supplierCd, function (f) {
        var r = window.slPersistFile('invoice', cd, f);
        if (r.ok && typeof ptfToast === 'function') ptfToast('✅ سند فاکتور ذخیره شد و پس از بازکردن مجدد باقی می‌ماند', 'ok');
      }, function (key) { window.slForgetPersistedFile('invoice', cd, key); }); } catch (eU) {}
    }, 0);
  };
  window.slPaymentEdit = function (cd) {
    var initialData = data(), initial = fileRecord('payment', cd, initialData); if (!initial) return;
    window._slPayEditCd = cd; window._slPayEditNewFiles = []; /* سازگاری */
    var filesHtml = (initial.files || []).map(function (f) {
      var key = String(f.key || '').replace(/[\\']/g, '');
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;flex-wrap:wrap"><a href="javascript:void(0)" onclick="openStoredFile(\'' + key + '\',\'' + ptfOnClickArg(f.name || 'فایل') + '\')" style="color:#0e7490;flex:1">📎 ' + escP(f.name || 'فایل') + '</a><button class="ba" style="color:#dc2626" onclick="slPaymentRemoveFile(\'' + ptfOnClickArg(cd) + '\',\'' + key + '\')">✕</button></div>';
    }).join('') || '<div style="color:#94a3b8;font-size:12px">سندی ثبت نشده است</div>';
    var filesBox = '<div style="margin-top:6px;border:1px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"><b style="font-size:12px">📎 اسناد / عکس چک پرداخت</b><small style="display:block;color:#047857;margin-top:3px">فایل پس از آپلود همان لحظه ذخیره می‌شود.</small>' + filesHtml + '<div id="slPayEditFilesUp" style="margin-top:6px"></div></div>';
    ptfDialog({
      title:'✏️ ویرایش پرداخت', body:filesBox,
      fields:[{id:'date',label:'تاریخ پرداخت (شمسی)',value:initial.dateFa||initial.dateISO,dir:'ltr',required:true},{id:'amount',label:'مبلغ پرداخت',type:'number',money:false,value:initial.amount,dir:'ltr',required:true},{id:'note',label:'شرح',type:'textarea',value:initial.note||''}],
      okText:'ذخیره', onOk:function(v) {
        var d=data(), p=fileRecord('payment', cd, d); if(!p) return;
        var iso=typeof ptfJToISO==='function'?(ptfJToISO(v.date)||v.date):v.date, amt=+v.amount||0, min=(p.allocations||[]).reduce(function(s,a){return s+(+a.amount||0)},0);
        if(!iso||amt<min){alert('مبلغ نباید از مجموع تخصیص‌ها کمتر باشد');return;}
        p.dateISO=iso; p.dateFa=typeof ptfISOToJ==='function'?ptfISOToJ(iso):iso; p.amount=amt; p.amountIrr=p.cur==='IRR'?amt:Math.round(amt*(+p.rate||0)); p.unallocated=Math.max(0,amt-min); p.note=v.note||''; p.updatedAtISO=new Date().toISOString(); p.updatedBy=curSession().name;
        save(d); try{audit('پرداخت تامین','ویرایش پرداخت '+cd,cd)}catch(e){} slOpenLedger(p.supplierCd);
      }
    });
    setTimeout(function () {
      try { if (typeof attachUploadWidget === 'function') attachUploadWidget('slPayEditFilesUp', 'supplier-finance/payment/' + cd, function (f) {
        var r = window.slPersistFile('payment', cd, f);
        if (r.ok && typeof ptfToast === 'function') ptfToast('✅ سند پرداخت ذخیره شد و پس از بازکردن مجدد باقی می‌ماند', 'ok');
      }, function (key) { window.slForgetPersistedFile('payment', cd, key); }); } catch (eU) {}
    }, 0);
  };
  /* حذف یک فایل از پرداخت (همانند slInvoiceRemoveFile) */
  window.slPaymentRemoveFile = function (cd, key) {
    if (!confirm('این سند از پرداخت و فضای ابری حذف شود؟')) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      var d = data(), p = (d.payments || []).filter(function (x) { return x.cd === cd; })[0];
      if (!p) return;
      p.files = (p.files || []).filter(function (f) { return f.key !== key; });
      p._deletedFileKeys = (p._deletedFileKeys || []).concat([key]).filter(function (v, i, all) { return v && all.indexOf(v) === i; });
      p.updatedAtISO = new Date().toISOString(); p.updatedBy = curSession().name;
      save(d);
      if (typeof ptfToast === 'function') ptfToast('سند از رکورد و فضای ابری حذف شد', 'warn');
      if (window._slPayEditCd === cd && document.querySelector('.ptfdlg-b') && typeof window.slPaymentEdit === 'function') { window.slPaymentEdit(cd); }
      else slOpenLedger(p.supplierCd);
    });
  };
  /* v34.4.44: افزودن سند یک جریان تک‌موداله دارد. قبلاً callback هر آپلود در حالی که
     slAttachDlg هنوز باز بود، slOpenLedger را دوباره می‌ساخت؛ pull هم‌زمان ضمایم نیز
     می‌توانست یک ledger دیگر زیر آن باقی بگذارد. ledger فقط هنگام بستن پنجرهٔ سند،
     دقیقاً یک‌بار و با دادهٔ ذخیره‌شده باز می‌شود. */
  function slRemoveAllDialogs(id) {
    Array.prototype.slice.call(document.querySelectorAll('#' + id)).forEach(function (el) { el.remove(); });
  }
  window.slAttachClose = function (supCd) {
    slRemoveAllDialogs('slAttachDlg');
    slRemoveAllDialogs('slLedgerDlg');
    if (supCd && typeof window.slOpenLedger === 'function') window.slOpenLedger(supCd);
  };
  function slAttach(kind, cd) {
    var d = data();
    var records = kind === 'invoice' ? (d.invoices || []) : (d.payments || []);
    var record = records.filter(function (x) { return x.cd === cd; })[0];
    var supCd = record ? String(record.supplierCd || '') : '';
    var safeSupCd = typeof ptfOnClickArg === 'function' ? ptfOnClickArg(supCd) : supCd.replace(/[\\']/g, '');
    slRemoveAllDialogs('slAttachDlg');
    slRemoveAllDialogs('slLedgerDlg');
    var html='<div class="md-b" id="slAttachDlg" style="display:grid;z-index:2900" onclick="if(event.target===this)slAttachClose(\''+safeSupCd+'\')"><div class="md" style="max-width:460px"><h3>📎 افزودن سند</h3><div style="font-size:11.5px;color:#047857;margin-bottom:7px">پس از تکمیل آپلود، سند همان لحظه در گردش حساب ذخیره می‌شود.</div><div id="slAttachWrap"></div><div style="text-align:left;margin-top:9px"><button class="bt" onclick="slAttachClose(\''+safeSupCd+'\')">تمام</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend',html);
    attachUploadWidget('slAttachWrap','supplier-finance/'+kind+'/'+cd,function(f){
      var res=window.slPersistFile(kind,cd,f);
      if(!res.ok) { if(typeof ptfToast==='function')ptfToast('⛔ اتصال سند به رکورد ناموفق بود','warn'); return; }
      try{audit('حساب تامین','افزودن پیوست '+kind,cd)}catch(e){}
      if(typeof ptfToast==='function')ptfToast('✅ پیوست در گردش حساب ذخیره شد','ok');
    },function(key){
      window.slForgetPersistedFile(kind,cd,key);
    });
  }
  window.slInvoiceAddFile=function(cd){slAttach('invoice',cd)};window.slPaymentAddFile=function(cd){slAttach('payment',cd)};
  /* v34.0.16-alpha: حذف سند از فاکتور خرید (در همان گردش حساب) */
  window.slInvoiceRemoveFile = function (cd, key) {
    if (!confirm('این سند از فاکتور و فضای ابری حذف شود؟')) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      var d = data(), i = (d.invoices || []).filter(function (x) { return x.cd === cd; })[0];
      if (!i) return;
      i.files = (i.files || []).filter(function (f) { return f.key !== key; });
      i._deletedFileKeys = (i._deletedFileKeys || []).concat([key]).filter(function (v, idx, all) { return v && all.indexOf(v) === idx; });
      i.updatedAtISO = new Date().toISOString(); i.updatedBy = curSession().name;
      save(d);
      if (typeof ptfToast === 'function') ptfToast('سند از رکورد و فضای ابری حذف شد', 'warn');
      /* v34.0.20-alpha: اگر از مودال ویرایش صدا زده شده، دوباره ویرایش را باز کن؛ وگرنه گردش حساب */
      if (window._slInvEditCd === cd && document.querySelector('.ptfdlg-b') && typeof window.slInvoiceEdit === 'function') { window.slInvoiceEdit(cd); }
      else slOpenLedger(i.supplierCd);
    });
  };
  window.slRefreshSupplierPanel=function(){if(document.getElementById('sTb')){var p=document.getElementById('panels');if(p){p.innerHTML=buildSuppliers();if(typeof renderSuppliers==='function')renderSuppliers();}}};
  ['ptfPayableUpsert','ptfPayablePay'].forEach(function(n){var old=window[n];if(typeof old==='function'){window[n]=function(){var r=old.apply(this,arguments);setTimeout(function(){if(typeof slRefreshSupplierPanel==='function')slRefreshSupplierPanel();},120);return r;};}});


  /* Sprint 270: explicit deletion/reversal with allocation release */
  window.slPaymentDelete=function(cd){ return window.slPaymentVoid(cd); };
  window.slInvoiceDelete=function(cd){var d=data(),i=(d.invoices||[]).filter(function(x){return x.cd===cd})[0];if(!i)return;if(!confirm('فاکتور حذف/ابطال شود؟ تخصیص‌های پرداخت آن به اعتبار تامین‌کننده تبدیل می‌شوند.'))return;(d.payments||[]).forEach(function(p){p.allocations=(p.allocations||[]).filter(function(a){return a.invoiceCd!==cd;});p.unallocated=(+p.amount||0)-(p.allocations||[]).reduce(function(s,a){return s+(+a.amount||0)},0);});i.status='void';i.voidAt=faDateTime();i.voidBy=curSession().name;var pays=getData('ptf_crm_payables');pays.forEach(function(p){if(p.sfInvoiceCd===cd)delete p.sfInvoiceCd;});setData('ptf_crm_payables',pays);save(d);if(typeof slRefreshSupplierPanel==='function')slRefreshSupplierPanel();slOpenLedger(i.supplierCd);};
  /* ============ Sprint 270: visible management, Jalali filters, opening balance ============ */
  function slJalaliFilter(id, label, iso) { return typeof ptfDatePicker === 'function' ? '<label>'+label+'</label>'+ptfDatePicker(id, iso || '') : '<label>'+label+'</label><input id="'+id+'" value="'+escP(iso||'')+'" placeholder="1405/04/22">'; }
  window.slOpeningOpen=function(supCd){if(!slCanAdjust()){alert('مانده افتتاحیه فقط برای مدیران ارشد مجاز است');return;}ptfDialog({title:'🏁 ثبت مانده افتتاحیه تامین‌کننده',body:'مبلغ مثبت = بدهی اولیه ما به تامین‌کننده؛ مبلغ منفی = اعتبار اولیه شرکت نزد تامین‌کننده.',fields:[{id:'cur',label:'ارز',type:'select',options:['IRR','USD','EUR','CNY','AED','GBP']},{id:'amount',label:'مانده افتتاحیه (+ بدهی / − اعتبار)',type:'number',money:false,dir:'ltr',required:true},{id:'rate',label:'نرخ تسعیر برای ارز خارجی',type:'number',money:false,dir:'ltr'},{id:'note',label:'شرح/مبنای مانده افتتاحیه',type:'textarea',required:true}],okText:'ثبت مانده افتتاحیه',onOk:function(v){var a=+v.amount||0,c=v.cur||'IRR',r=c==='IRR'?1:(+v.rate||0);if(!a||!v.note||(c!=='IRR'&&!r)){alert('مبلغ، شرح و برای ارز خارجی نرخ الزامی است');return;}var d=data(),sup=supplier(supCd);d.adjustments=d.adjustments||[];d.adjustments.unshift({cd:genCode('SFOPEN'),supplierCd:supCd,supName:sup?sup.co:'',refYear:'opening',kind:'opening',cur:c,rate:r,amount:a,amountIrr:c==='IRR'?a:Math.round(a*r),note:v.note,dateISO:new Date().toISOString().slice(0,10),dateFa:faDate(),status:'posted',t:faDateTime(),by:curSession().name});save(d);audit('حساب تامین','ثبت مانده افتتاحیه '+(sup?sup.co:''),supCd);slOpenLedger(supCd);}});};
  var _slLedger270=window.slOpenLedger;
  window.slOpenLedger=function(supCd,filters){_slLedger270(supCd,filters);var dlg=document.getElementById('slLedgerDlg');if(!dlg)return;var from=document.getElementById('slFfrom'),to=document.getElementById('slFto');if(from&&from.closest('.fld'))from.closest('.fld').innerHTML=slJalaliFilter('slFfrom','از تاریخ (شمسی)',from.value);if(to&&to.closest('.fld'))to.closest('.fld').innerHTML=slJalaliFilter('slFto','تا تاریخ (شمسی)',to.value);var d=data(),invs=activeInvoices(d).filter(function(i){return i.supplierCd===supCd;}),pays=(d.payments||[]).filter(function(p){return p.supplierCd===supCd&&p.status!=='void';});var h='<div id="slManage" style="margin-top:12px;border:1px solid var(--brd);border-radius:10px;padding:10px"><b>مدیریت فاکتور و پرداخت</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px"><button class="bt bt-o" onclick="slOpeningOpen(\''+ptfOnClickArg(supCd)+'\')">🏁 مانده افتتاحیه</button>' + invs.map(function(i){return '<button class="bt bt-o" onclick="slInvoiceEdit(\''+ptfOnClickArg(i.cd)+'\')">✏️ فاکتور '+escP(i.no)+'</button><button class="bt bt-o" style="color:#dc2626" onclick="slInvoiceDelete(\''+ptfOnClickArg(i.cd)+'\')">🗑 حذف فاکتور</button>';}).join('') + pays.map(function(p){return '<button class="bt bt-o" onclick="slPaymentEdit(\''+ptfOnClickArg(p.cd)+'\')">✏️ پرداخت '+escP(p.cd)+'</button><button class="bt bt-o" style="color:#dc2626" onclick="slPaymentDelete(\''+ptfOnClickArg(p.cd)+'\')">🗑 حذف پرداخت</button>';}).join('')+'</div></div>';dlg.querySelector('.md').insertAdjacentHTML('beforeend',h);};
  /* CHQ-DOC-002 (۱۴۰۵/۰۵/۱۹): همان مشکل چک/تنخواه اینجا هم صادق است — این مودال یک‌بار
     از localStorage محلی می‌خواند؛ اگر سند فاکتور/پرداختی از دستگاه/کاربر دیگر همین‌الان
     ثبت شده و pull دورهٔ ۲۰ثانیه‌ای هنوز نرسیده باشد، دیده نمی‌شود تا کاربر به تب دیگری
     برود و برگردد. یک pull فوری می‌زنیم و اگر امضای اسناد (فاکتور+پرداخت) این تأمین‌کننده
     تغییر کرده باشد، خودِ مودال را (بدون دست‌کاری فیلترهای بازِ کاربر) دوباره می‌سازیم. */
  var _slLedgerDocRefresh = window.slOpenLedger;
  window.slOpenLedger = function (supCd, filters) {
    /* پاک‌سازی همهٔ نمونه‌های احتمالی قدیمی، نه فقط اولین id تکراری. */
    slRemoveAllDialogs('slLedgerDlg');
    _slLedgerDocRefresh(supCd, filters);
    if (typeof window.ptfAttachRefreshOnOpen === 'function') {
      window.ptfAttachRefreshOnOpen('slLedgerDlg', function () {
        var d = data();
        var invs = (d.invoices || []).filter(function (i) { return i.supplierCd === supCd; });
        var pays = (d.payments || []).filter(function (p) { return p.supplierCd === supCd; });
        var sig = [];
        invs.forEach(function (i) { (i.files || []).forEach(function (f) { sig.push(f.key); }); });
        pays.forEach(function (p) { (p.files || []).forEach(function (f) { sig.push(f.key); }); });
        return sig;
      }, function () { window.slOpenLedger(supCd, filters); });
    }
  };

  var _slPrint270=window.slLedgerPrint;
  window.slLedgerPrint=function(supCd){var f=slFiltersFromDom(),sup=supplier(supCd),rows=slEventRows(supCd,f),rng=(f.from||f.to)?'بازه: '+slFaDigits(typeof ptfISOToJ==='function'&&f.from?ptfISOToJ(f.from):f.from||'ابتدا')+' تا '+slFaDigits(typeof ptfISOToJ==='function'&&f.to?ptfISOToJ(f.to):f.to||'امروز'):'بازه: همه تاریخ‌ها',w=window.open('','_blank');if(!w)return;w.document.write('<!doctype html><html dir="rtl"><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px}th{background:#eee}</style><h2>گردش حساب تامین‌کننده — '+escP((sup||{}).co||'')+'</h2><p>'+rng+'</p><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>'+slPrintRows(rows)+'</tbody></table></html>');w.document.close();w.print();};

  /* Sprint 271: internal PDF preview, no new browser tab */
  window.slLedgerPrint=function(supCd){var f=slFiltersFromDom(),sup=supplier(supCd),rows=slEventRows(supCd,f),rng=(f.from||f.to)?'بازه: '+slFaDigits(typeof ptfISOToJ==='function'&&f.from?ptfISOToJ(f.from):f.from||'ابتدا')+' تا '+slFaDigits(typeof ptfISOToJ==='function'&&f.to?ptfISOToJ(f.to):f.to||'امروز'):'بازه: همه تاریخ‌ها',html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}</style></head><body><h2>گردش حساب تامین‌کننده — '+escP((sup||{}).co||'')+'</h2><p>'+rng+'</p><table><thead><tr><th>تاریخ</th><th>نوع</th><th>سند/مرجع</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>'+slPrintRows(rows)+slClaimAsOfHtml(rows,(function(){var asOfIso=f.to||(new Date().toISOString().slice(0,10));return slFaDigits(typeof ptfISOToJ==='function'?ptfISOToJ(asOfIso):asOfIso);})())+'</tbody></table></body></html>';if(typeof ptfPreviewPrintableDoc==='function'){ptfPreviewPrintableDoc('گردش حساب تامین‌کننده — '+escP((sup||{}).co||''),html,'supplier-ledger-'+supCd);return;}var m='<div class="md-b" style="display:grid;z-index:4000"><div class="md" style="max-width:95vw;width:1000px;height:90vh"><h3>پیش‌نمایش گردش حساب</h3><iframe style="width:100%;height:72vh;border:1px solid #ccc" srcdoc="'+html.replace(/"/g,'&quot;')+'"></iframe><div style="text-align:left"><button class="bt" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';document.getElementById('panels').insertAdjacentHTML('beforeend',m);};


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
  window.slFinanceRowsRender = function () {
    var tbl = document.getElementById('slFinanceTbl');
    if (tbl) tbl.innerHTML = window.slFinanceHubBodyHtml();
  };
  window.slFinanceHubBodyHtml = function () {
    var q = String(window._slFinanceSearch || ''), all = window.slAccountRows(''), rows = window.slAccountRows(q);
    /* UR-2026-08-01-07: سورت ستون‌ها (تأمین‌کننده/مانده) */
    if (window.ptfRegisterSortable) window.ptfRegisterSortable('slf', {
      getters: { co: function (x) { return x.co || ''; }, exposure: function (x) { return x.exposure || 0; } },
      render: window.slFinanceRowsRender
    });
    rows = (typeof window.ptfSorted === 'function') ? window.ptfSorted('slf', rows) : rows;
    var body = rows.map(function (x) {
      return '<tr' + (x.open ? '' : ' style="color:#64748b"') + '><td><b>' + escP(x.co || '') + '</b><br><small style="direction:ltr;color:#94a3b8">' + escP(x.cd || '') + '</small></td><td>' + (x.balance.length ? balanceHtml(x.cd) : '<span style="color:#64748b">مانده ندارد</span>') + '</td><td><button class="ba" onclick="slOpenLedger(\'' + ptfOnClickArg(x.cd) + '\')">گردش حساب</button></td></tr>';
    }).join('');
    return body || '<tr><td colspan="3">موردی مطابق جست‌وجو نیست</td></tr>';
  };
  window.slFinanceHubHtml = function () {
    var q = String(window._slFinanceSearch || ''), all = window.slAccountRows('');
    var openN = all.filter(function (x) { return x.open; }).length;
    return '<div id="slFinanceHubBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">🏭 حساب تأمین‌کنندگان</h4><small style="color:#64748b">' + openN.toLocaleString('fa-IR') + ' حساب با مانده غیرصفر ابتدا نمایش داده می‌شود؛ خرید نقدی در گردش می‌ماند حتی اگر مانده صفر باشد.</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt bt-o" style="font-size:11px" onclick="slRepairCashPurchaseLedger()">🧩 ترمیم گردش خرید نقدی</button><input id="slFinanceSearch" value="' + escP(q) + '" oninput="slFinanceSearch(this.value)" placeholder="جست‌وجوی نام یا کد تأمین‌کننده" style="min-width:240px;direction:rtl"></div></div><div class="tb2" style="margin-top:10px"><table><thead><tr>' +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('slf', 'co', 'تأمین‌کننده') : '<th>تأمین‌کننده</th>') +
      (typeof window.ptfSortHeader === 'function' ? window.ptfSortHeader('slf', 'exposure', 'مانده/اعتبار') : '<th>مانده/اعتبار</th>') + '<th></th>' +
      '</tr></thead><tbody id="slFinanceTbl">' + window.slFinanceHubBodyHtml() + '</tbody></table></div><div style="margin-top:10px"><input id="slChkDiag" placeholder="شماره چک برای تشخیص" style="direction:ltr"><button class="bt bt-o" onclick="slChequeDiag()">تشخیص چک</button><div id="slChkDiagOut"></div></div></div>';
  };
  window.slFinanceSearch = function (v) {
    window._slFinanceSearch = String(v || '');
    /* UR-2026-08-01-02 (هم‌خانواده): فقط tbody به‌روز می‌شود تا فوکوس کادر جستجو حفظ شود. */
    window.slFinanceRowsRender();
  };
  window.slChequeDiag=function(){var no=((document.getElementById('slChkDiag')||{}).value||'').trim(),c=getData('ptf_crm_cheques').filter(function(x){return String(x.sayad||x.no||'')===no;})[0],o=document.getElementById('slChkDiagOut');if(!o)return;if(!c){o.textContent='چک یافت نشد';return;}var d=data(),p=(d.payments||[]).filter(function(x){return x.cd===c.supplierPaymentCd;})[0];o.innerHTML='<div style="margin-top:8px;font-size:12px">وضعیت چک: <b>'+escP(c.st||'open')+'</b> | مالکیت: <b>'+escP(c.ownership||'نامشخص')+'</b> | پرداخت مرتبط: <b>'+escP(p?p.status:'ندارد')+'</b></div>';};
  var _slPetty275=window.buildPetty; if(typeof _slPetty275==='function'){window.buildPetty=function(){return _slPetty275()+ (typeof window.slFinanceHubHtml==='function'?window.slFinanceHubHtml():'');};}
  /* v34.6.1: خرید واقعی نقدی باید در گردش تأمین‌کننده بماند، حتی با مانده صفر.
     برای هر purchaseCd دقیقاً یک سند خرید و یک پرداخت کاملاً تخصیص‌یافته ساخته می‌شود. */
  window.slResolveSupplierByName = function (name) {
    var key = nrm(name);
    var matches = getData('ptf_crm_suppliers').filter(function (s) { return key && (nrm(s.co) === key || nrm(s.name) === key || nrm(s.coEn) === key); });
    return matches.length === 1 ? { ok: true, supplier: matches[0] } : { ok: false, why: matches.length ? 'ambiguous' : 'missing', count: matches.length };
  };
  window.slImportRealPurchase = function (o) {
    if (!o || !o.purchaseCd || !o.supplierCd || !(+o.amount > 0)) return { ok: false, why: 'input' };
    var d = data(), sup = supplier(o.supplierCd);
    if (!sup) return { ok: false, why: 'supplier' };
    var inv = (d.invoices || []).filter(function (i) { return i.sourcePurchaseCd === o.purchaseCd && i.status !== 'void'; })[0];
    if (!inv) {
      inv = { cd: genCode('SFINV'), supplierCd: o.supplierCd, supName: sup.co || sup.name || o.supName || '', no: 'PUR-' + o.purchaseCd,
        dateISO: o.dateISO || new Date().toISOString().slice(0,10), dateFa: o.dateFa || faDate(), cur: 'IRR', rate: 1,
        amount: Math.round(+o.amount || 0), amountIrr: Math.round(+o.amount || 0), note: 'ثبت خودکار از خرید واقعی ' + (o.item || ''),
        item: o.item || '', qty: +o.qty || 0, unitPrice: +o.unitPrice || 0, sourceCurrency:o.sourceCurrency||'', sourceUnitPrice:+o.sourceUnitPrice||0, sourceFxRate:+o.sourceFxRate||0,
        legacyPayableCds: o.payableCd ? [o.payableCd] : [], sourcePurchaseCd: o.purchaseCd, status: 'open', files: (o.files || []).slice(), t: faDateTime(), by: curSession().name };
      d.invoices.unshift(inv);
    } else {
      inv.supplierCd=o.supplierCd; inv.supName=sup.co||sup.name||o.supName||''; inv.amount=Math.round(+o.amount||0); inv.amountIrr=inv.amount;
      inv.item=o.item||inv.item||''; inv.qty=+o.qty||inv.qty||0; inv.unitPrice=+o.unitPrice||inv.unitPrice||0; inv.sourceCurrency=o.sourceCurrency||inv.sourceCurrency||''; inv.sourceUnitPrice=+o.sourceUnitPrice||inv.sourceUnitPrice||0; inv.sourceFxRate=+o.sourceFxRate||inv.sourceFxRate||0; inv.files=inv.files||[]; inv.updatedAtISO=new Date().toISOString();
    }
    var pay = (d.payments || []).filter(function (p) { return p.sourcePurchaseCd === o.purchaseCd && p.status !== 'void'; })[0];
    if (o.pay === 'cash') {
      if (!pay) {
        pay = { cd: genCode('SFPAY'), supplierCd: o.supplierCd, supName: inv.supName, dateISO: inv.dateISO, dateFa: inv.dateFa,
          cur: 'IRR', rate: 1, amount: inv.amount, amountIrr: inv.amount, method: 'cash', note: 'تسویه نقدی خرید واقعی — ' + (o.item || ''),
          item: o.item || '', allocations: [{ invoiceCd: inv.cd, amount: inv.amount }], unallocated: 0, status: 'posted', sourcePurchaseCd: o.purchaseCd,
          files: [], t: faDateTime(), by: curSession().name };
        d.payments.unshift(pay);
      } else {
        pay.amount = inv.amount; pay.amountIrr = inv.amount; pay.supplierCd = o.supplierCd; pay.supName = inv.supName;
        pay.allocations = [{ invoiceCd: inv.cd, amount: inv.amount }]; pay.unallocated = 0; pay.status = 'posted';
      }
    }
    if (save(d) === false) return { ok: false, why: 'save' };
    if (o.payableCd) {
      var ps = getData('ptf_crm_payables');
      ps.forEach(function (p) { if (p.cd === o.payableCd) p.sfInvoiceCd = inv.cd; });
      setData('ptf_crm_payables', ps);
    }
    try { audit('حساب تامین', 'خرید ' + (o.pay === 'cash' ? 'نقدی و تسویه‌شده' : 'واقعی') + ' در گردش ' + inv.supName + ' — ' + inv.amount.toLocaleString('fa-IR') + ' ریال', inv.cd); } catch (e) {}
    return { ok: true, invoice: inv, payment: pay || null };
  };
  window.slVoidRealPurchaseFinance = function (purchaseCd, reason) {
    if (!purchaseCd) return { ok: true, changed: 0 };
    var d = data(), changed = 0;
    (d.invoices || []).forEach(function (i) { if (i.sourcePurchaseCd === purchaseCd && i.status !== 'void') { i.status='void'; i.voidReason=reason||'اصلاح خرید واقعی'; i.voidAt=faDateTime(); changed++; } });
    (d.payments || []).forEach(function (p) { if (p.sourcePurchaseCd === purchaseCd && p.status !== 'void') { p.status='void'; p.voidReason=reason||'اصلاح خرید واقعی'; p.voidAt=faDateTime(); changed++; } });
    if (changed) { save(d); try { audit('حساب تامین','ابطال اثر خرید واقعی '+purchaseCd+' — '+(reason||'اصلاح'),purchaseCd); } catch(e){} }
    return { ok: true, changed: changed };
  };
  window.slAttachRealPurchaseReceipt = function (purchaseCd, f) {
    f = (typeof window.ptfNormalizeFileRec === 'function') ? window.ptfNormalizeFileRec(f) : f;
    if (!purchaseCd || !f || !f.key) return false;
    var d=data(), p=(d.payments||[]).filter(function(x){return x.sourcePurchaseCd===purchaseCd&&x.status!=='void';})[0];
    if(!p)return false; p.files=p.files||[]; if(!p.files.some(function(x){return x.key===f.key;}))p.files.push(f); save(d); return true;
  };
  window.slCashPurchaseLedgerAudit = function () {
    var sf=data(), invoiceByPurchase={};
    (sf.invoices||[]).forEach(function(i){if(i.sourcePurchaseCd&&i.status!=='void')invoiceByPurchase[i.sourcePurchaseCd]=i;});
    var missing=[],ambiguous=[];
    (getData('ptf_crm_buycmp')||[]).forEach(function(c){(c.purchases||[]).forEach(function(p){if(!p||p.pay!=='cash'||invoiceByPurchase[p.cd])return;var resolved=p.supplierCd?{ok:!!supplier(p.supplierCd),supplier:supplier(p.supplierCd)}:window.slResolveSupplierByName(p.sup);var item=(c.items||[])[p.idx]||{};var row={cmpId:c.id,purchaseCd:p.cd,supplier:p.sup||'',amount:(+p.price||0)*(+p.qty||+item.qty||1),item:item.nm||item.name||item.desc||''};if(resolved&&resolved.ok){row.supplierCd=resolved.supplier.cd;missing.push(row);}else{row.why=resolved&&resolved.why||'missing';ambiguous.push(row);}});});
    return {safe:missing,ambiguous:ambiguous};
  };
  window.slRepairCashPurchaseLedger = function () {
    if(!canWrite()){alert('⛔ دسترسی ثبت زیر‌دفتر تأمین ندارید');return;}
    var report=window.slCashPurchaseLedgerAudit();
    if(!report.safe.length){alert(report.ambiguous.length?'خرید قابل ترمیم خودکار نیست؛ '+report.ambiguous.length+' نام تأمین‌کننده مفقود/مبهم است.':'همه خریدهای نقدی در گردش تأمین‌کنندگان ثبت شده‌اند.');return;}
    if(!confirm(report.safe.length+' خرید نقدی بدون گردش شناسایی شد. فقط موارد دارای تأمین‌کننده یکتای قطعی ترمیم شوند؟\nموارد مبهم: '+report.ambiguous.length))return;
    var cmps=getData('ptf_crm_buycmp'),fixed=0,failed=0;
    report.safe.forEach(function(row){var c=cmps.filter(function(x){return x.id===row.cmpId;})[0],p=c&&(c.purchases||[]).filter(function(x){return x.cd===row.purchaseCd;})[0],it=c&&((c.items||[])[p.idx]||{});if(!p||!it){failed++;return;}p.supplierCd=row.supplierCd;var r=window.slImportRealPurchase({purchaseCd:p.cd,supplierCd:p.supplierCd,supName:p.sup,amount:row.amount,unitPrice:+p.price||0,qty:+p.qty||+it.qty||1,item:row.item,pay:'cash',files:p.files||[],dateFa:p.t||faDate(),sourceCurrency:p.srcCur||'',sourceUnitPrice:+p.priceFx||0,sourceFxRate:+p.rate||0});if(r&&r.ok){p.supplierInvoiceCd=r.invoice.cd;p.supplierPaymentCd=r.payment&&r.payment.cd||'';p.financeLinked=true;fixed++;}else failed++;});
    setData('ptf_crm_buycmp',cmps);try{audit('حساب تامین','ترمیم گردش خرید نقدی: '+fixed+' موفق، '+failed+' ناموفق، '+report.ambiguous.length+' مبهم','CASH-PURCHASE-REPAIR');}catch(e){}
    alert('ترمیم انجام شد: '+fixed+' خرید\nناموفق: '+failed+'\nنیازمند تعیین هویت تأمین‌کننده: '+report.ambiguous.length);if(typeof window.slFinanceRowsRender==='function')window.slFinanceRowsRender();
  };
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
  /* AUD-04 (ممیزی ۱۴۰۵/۰۵/۰۷ — crm/AUDIT-FINANCIAL-SYSTEM-2026-07-29.md):
     دکمه‌ی «🗑 حذف فاکتور» در بخش «مدیریت فاکتور و پرداخت» (Sprint 270) از
     slInvoiceDelete استفاده می‌کند که همان اثر void را دارد اما تا این‌جا
     گارد قفل سال مالی نداشت — بر خلاف slInvoiceVoid که چند خط بالاتر
     به‌درستی پوشانده شده. slPaymentDelete نیازی به گارد جداگانه ندارد چون
     مستقیماً به slPaymentVoid (که همین‌جا/بالاتر پوشانده شده) delegate
     می‌کند. */
  var _delInv = window.slInvoiceDelete;
  if(_delInv){
    window.slInvoiceDelete = function(cd){
      var d=(function(){ try{return JSON.parse(localStorage.getItem('ptf_crm_supplier_finance')||'{}')}catch(e){return {}}; })();
      var i=(d.invoices||[]).filter(function(x){ return x.cd===cd; })[0];
      if(i && typeof window.ptfFinanceAssertWritable==='function' && !window.ptfFinanceAssertWritable(i.dateISO,{action:'حذف فاکتور'}).ok) return;
      if(i && slLockedYear(i.dateISO)){ alert('🔒 فاکتور مربوط به سال مالی '+slLockedYear(i.dateISO)+' قفل است - حذف مجاز نیست. سند اصلاحی بزنید.'); return; }
      return _delInv(cd);
    };
  }
  /* Read-only audit: operational purchases vs supplier ledger. No writes/deletes. */
  window.slLegacyFinanceAudit = function () {
    var buycmp = getData('ptf_crm_buycmp') || [];
    var payables = getData('ptf_crm_payables') || [];
    var sf = data();
    var invoices = sf.invoices || [], payments = sf.payments || [];
    var purchases = [];
    buycmp.forEach(function (c) {
      (c.purchases || []).forEach(function (p) {
        var item = (c.items || [])[p.idx] || {};
        purchases.push({ purchaseCd: p.cd || '', cmpId: c.id || '', inqNo: c.inqNo || '', idx: p.idx, item: item.nm || item.name || item.desc || '', supplier: p.sup || '', amount: (+p.price || 0) * (+p.qty || +item.qty || 1), sourceInvoiceCd: p.supplierInvoiceCd || p.invoiceCd || '' });
      });
    });
    var purchaseByCd = {};
    purchases.forEach(function (p) { if (p.purchaseCd) purchaseByCd[p.purchaseCd] = p; });
    var explicitAutoInvoices = invoices.filter(function (i) { return !!i.sourcePurchaseCd; }).map(function (i) {
      return { invoiceCd: i.cd, invoiceNo: i.no, sourcePurchaseCd: i.sourcePurchaseCd, existsInBuycmp: !!purchaseByCd[i.sourcePurchaseCd], status: i.status || 'open', amount: +i.amountIrr || +i.amount || 0 };
    });
    var explicitAutoPayments = payments.filter(function (p) { return !!p.sourcePurchaseCd; }).map(function (p) {
      return { paymentCd: p.cd, sourcePurchaseCd: p.sourcePurchaseCd, existsInBuycmp: !!purchaseByCd[p.sourcePurchaseCd], status: p.status || 'posted', amount: +p.amountIrr || +p.amount || 0 };
    });
    var candidates = payables.filter(function (p) {
      return !p.sfInvoiceCd && purchases.some(function (buy) {
        return (p.inqNo && p.inqNo === buy.inqNo && (+p.idx === +buy.idx)) || (p.inqNo && p.inqNo === buy.inqNo && Math.abs((+p.amount || 0) - buy.amount) <= 1 && String(p.sup || '').trim() === String(buy.supplier || '').trim());
      });
    }).map(function (p) {
      return { payableCd: p.cd, inqNo: p.inqNo, item: p.item || '', supplier: p.sup || '', amount: +p.amount || 0, confidence: 'candidate — نیازمند تایید دستی' };
    });
    var unlinkedLegacy = payables.filter(function (p) { return p.pay === 'credit' && !p.settled && !p.sfInvoiceCd && candidates.every(function (c) { return c.payableCd !== p.cd; }); }).map(function (p) {
      return { payableCd: p.cd, inqNo: p.inqNo, item: p.item || '', supplier: p.sup || '', amount: +p.amount || 0 };
    });
    var report = { readOnly: true, operationalPurchaseCount: purchases.length, operationalPurchases: purchases, explicitAutoInvoiceCount: explicitAutoInvoices.length, explicitAutoInvoices: explicitAutoInvoices, orphanAutoInvoices: explicitAutoInvoices.filter(function (i) { return !i.existsInBuycmp; }), explicitAutoPaymentCount: explicitAutoPayments.length, explicitAutoPayments: explicitAutoPayments, candidateLegacyPayablesCount: candidates.length, candidateLegacyPayables: candidates, unlinkedLegacyPayablesCount: unlinkedLegacy.length, unlinkedLegacyPayables: unlinkedLegacy, note: 'این گزارش فقط خواند؛ هیچ رکوردی را تغییر نداد.' };
    console.table({ operationalPurchases: report.operationalPurchaseCount, autoInvoices: report.explicitAutoInvoiceCount, orphanAutoInvoices: report.orphanAutoInvoices.length, autoPayments: report.explicitAutoPaymentCount, candidateLegacyPayables: report.candidateLegacyPayablesCount, unlinkedLegacyPayables: report.unlinkedLegacyPayablesCount });
    console.log(JSON.stringify(report, null, 2));
    return report;
  };
})();

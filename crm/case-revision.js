/* =====================================================================
   PTF CRM — بازرسی قلم‌به‌قلم، بازنگری سند برد و گزارش آن  (v34.7.31 / P4–P6)
   سناریوی کارفرما (۱۴۰۵/۰۵/۲۶):
     «پیشنهاد را برنده شدیم؛ در بازرسی بعضی اقلام مردود شد و قرار شد بعضی اقلام با
      قیمت جدید پیش‌فاکتور شوند. اقلام مردود هم بعضی وارد انبار می‌شوند و بعضی به
      فروشنده عودت داده می‌شوند. باید بتوان سند برد را از همان پروندهٔ فروش تغییر داد
      و گزارشش را داشت.»

   اصول این ماژول (وفادار به معماری فعلی):
     • هیچ رکورد مالی حذف نمی‌شود؛ سند برد قبلی superseded می‌شود و می‌ماند.
     • تغییر سند برد فقط از فرمان سروری revise_award (اتمیک + correction + بازسازی تخصیص).
     • سرنوشت اقلام مردود صریح است: انبار / عودت به فروشنده / دوباره‌کاری / اسقاط.
     • عودت به فروشنده اثر مالی فوری دارد (تصمیم کارفرما): سند اصلاحی بستانکار در
       حساب تأمین‌کننده + رکورد مرجوعی خرید.
     • هویت رکوردها با قرارداد PTF.id/sameEntity (ARCHITECTURE-GUARDRAILS.md).
   ===================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : globalThis;

  var DISPOSITIONS = [
    { v: 'stock', lb: '📦 ورود به انبار (موجودی)' },
    { v: 'supplier_return', lb: '↩️ عودت به فروشنده' },
    { v: 'rework', lb: '🔧 دوباره‌کاری/اصلاح' },
    { v: 'scrap', lb: '🗑 اسقاط' }
  ];
  W.PTF_DISPOSITIONS = DISPOSITIONS;
  function dispLabel(v) { for (var i = 0; i < DISPOSITIONS.length; i++) if (DISPOSITIONS[i].v === v) return DISPOSITIONS[i].lb; return v || '—'; }

  function list(k) { try { var v = getData(k); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function idOf(x) { return (W.PTF && typeof W.PTF.id === 'function') ? W.PTF.id(x) : String((x && (x._id || x.cd)) || ''); }
  function same(a, b) { return (W.PTF && typeof W.PTF.sameEntity === 'function') ? W.PTF.sameEntity(a, b) : (idOf(a) && idOf(a) === String(b || '')); }
  function esc(v) { return typeof escP === 'function' ? escP(v == null ? '' : v) : String(v == null ? '' : v); }
  function arg(v) { return typeof ptfOnClickArg === 'function' ? ptfOnClickArg(v) : String(v == null ? '' : v); }
  function money(v) { return (+v || 0).toLocaleString('fa-IR'); }
  function who() { try { return (curSession() || {}).name || ''; } catch (e) { return ''; } }
  function nowFa() { try { return faDateTime(); } catch (e) { return ''; } }
  function toast(m, k) { try { if (typeof ptfToast === 'function') ptfToast(m, k || 'ok'); } catch (e) {} }
  function canRevise() {
    try { if (typeof isSenior === 'function' && isSenior()) return true; } catch (e) {}
    try { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(String(curRole() || '').toLowerCase()) > -1; } catch (e2) { return false; }
  }

  function findCase(id) {
    var key = String(id || ''); if (!key) return null;
    return list('ptf_crm_deals').filter(function (c) { return same(c, key); })[0] || null;
  }
  /* سند برد فعلی پرونده (پس از هر بازنگری، همان آخرین سند است) */
  W.ptfCaseAwardOffer = function (c) {
    if (!c) return null;
    var no = String(c.wonOffer || '');
    if (!no) return null;
    return list('ptf_crm_offers').filter(function (o) { return o && String(o.no || '') === no; })[0] || null;
  };
  function awardLines(c) {
    var o = W.ptfCaseAwardOffer(c);
    var snap = (o && o.wonRevisionSnapshot && Array.isArray(o.wonRevisionSnapshot.items) && o.wonRevisionSnapshot.items.length)
      ? o.wonRevisionSnapshot.items : ((o && o.items) || []);
    return { offer: o, items: snap.map(function (it, i) {
      /* v34.7.45: فرم رویژن همان مدل کامل قلم پیشنهاد مالی را مصرف می‌کند؛
         projection کم‌فیلد قبلی نرخ مرجع، حاشیه، ستون‌های اضافه و زمان تحویل را حذف می‌کرد. */
      var row;try{row=JSON.parse(JSON.stringify(it||{}));}catch(e){row=Object.assign({},it||{});}
      row.i=i;row._revisionSourceIndex=i;row.name=row.name||'';row.desc=row.desc||'';row.model=row.model||'';
      row.unit=row.unit||'NO';row.pcode=row.pcode||'';row.brand=row.brand||'';row.qty=+row.qty||0;row.price=+row.price||0;
      row.lineId=row.lineId||'';row.sourceItemKey=row.sourceItemKey||'';return row;
    }) };
  }
  W.ptfCaseAwardLines = awardLines;

  /* ---------------- P4: بازرسی قلم‌به‌قلم ---------------- */
  W.ptfCaseInspectionOpen = function (caseId) {
    var c = findCase(caseId);
    if (!c) { alert('⛔ پروندهٔ فروش یافت نشد'); return; }
    var aw = awardLines(c);
    if (!aw.items.length) { alert('⛔ سند برد این پرونده قلمی ندارد؛ ابتدا سند برد را بررسی کنید.'); return; }
    document.querySelectorAll('#ptfInspDlg').forEach(function (x) { x.remove(); });
    var rows = aw.items.map(function (it, i) {
      return '<tr data-i="' + i + '">' +
        '<td style="padding:4px;font-size:12px"><b>' + esc(it.name || '—') + '</b>' + (it.desc && it.desc !== it.name ? '<br><small style="color:#94a3b8">' + esc(it.desc) + '</small>' : '') + '</td>' +
        '<td style="padding:4px;text-align:center;font-size:12px">' + money(it.qty) + '</td>' +
        '<td style="padding:4px"><input type="number" min="0" step="any" data-f="rej" value="0" style="width:80px;padding:4px;border:1px solid var(--brd);border-radius:7px;direction:ltr"></td>' +
        '<td style="padding:4px"><select data-f="disp" style="padding:4px;border:1px solid var(--brd);border-radius:7px;font-size:12px">' +
          DISPOSITIONS.map(function (d) { return '<option value="' + d.v + '">' + d.lb + '</option>'; }).join('') + '</select></td>' +
        '<td style="padding:4px"><input type="number" min="0" step="any" data-f="cost" value="' + (it.price || '') + '" style="width:110px;padding:4px;border:1px solid var(--brd);border-radius:7px;direction:ltr" title="بهای واحد برای ارزش‌گذاری انبار/عودت"></td>' +
        '<td style="padding:4px"><input type="text" data-f="note" placeholder="توضیح" style="width:130px;padding:4px;border:1px solid var(--brd);border-radius:7px;font-size:12px"></td>' +
        '</tr>';
    }).join('');
    var sups = list('ptf_crm_suppliers').map(function (s) { return '<option value="' + esc(s.cd) + '">' + esc(s.co || s.nm || s.cd) + '</option>'; }).join('');
    var html = '<div class="md-b" id="ptfInspDlg" style="display:grid;z-index:2900" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:940px;max-height:92vh;overflow:auto">' +
      '<h3>🔬 بازرسی قلم‌به‌قلم — ' + esc(c.inqNo || c.wonOffer || idOf(c)) + '</h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:8px">تعداد مردود هر قلم و سرنوشت آن را ثبت کنید. «ورود به انبار» رکورد موجودی می‌سازد و «عودت به فروشنده» سند بستانکار در حساب تأمین‌کننده ثبت می‌کند. این ثبت، سند برد را تغییر نمی‌دهد؛ برای تغییر مبلغ/اقلام از «بازنگری سند برد» استفاده کنید.</div>' +
      '<div class="tb2"><table><thead><tr><th>قلم</th><th>تعداد سند برد</th><th>مردود</th><th>سرنوشت</th><th>بهای واحد</th><th>توضیح</th></tr></thead><tbody id="ptfInspBody">' + rows + '</tbody></table></div>' +
      '<div class="fr" style="margin-top:8px"><div class="fld"><label>تأمین‌کننده (برای اقلام عودتی)</label><select id="ptfInspSup"><option value="">— انتخاب —</option>' + sups + '</select></div>' +
      '<div class="fld"><label>شمارهٔ گزارش بازرسی</label><input type="text" id="ptfInspNo" placeholder="مثلاً IR-1405-12" style="direction:ltr"></div></div>' +
      '<div class="fld"><label>شرح کلی بازرسی *</label><textarea id="ptfInspDesc" rows="2" placeholder="نتیجهٔ بازرسی و مبنای رد اقلام"></textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#0e7490;color:#fff" onclick="ptfCaseInspectionSave(\'' + arg(idOf(c)) + '\')">ثبت بازرسی</button></div>' +
      '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  W.ptfCaseInspectionSave = function (caseId) {
    /* قرارداد «بدون شکست خاموش» (ARCHITECTURE-GUARDRAILS §۳) */
    var dlg = document.getElementById('ptfInspDlg');
    if (!dlg) { alert('⛔ پنجرهٔ بازرسی باز نیست؛ دوباره از کشوی پرونده «بازرسی قلم‌به‌قلم» را باز کنید.'); return; }
    var deals = list('ptf_crm_deals');
    var c = deals.filter(function (x) { return same(x, caseId); })[0];
    if (!c) { alert('⛔ پرونده یافت نشد'); return; }
    var aw = awardLines(c);
    var desc = String((dlg.querySelector('#ptfInspDesc') || {}).value || '').trim();
    if (!desc) { alert('⛔ شرح بازرسی الزامی است'); return; }
    var supCd = String((dlg.querySelector('#ptfInspSup') || {}).value || '');
    var lines = [], invalid = '';
    dlg.querySelectorAll('#ptfInspBody tr').forEach(function (tr) {
      var i = +tr.getAttribute('data-i');
      var src = aw.items[i]; if (!src) return;
      function g(f) { var el = tr.querySelector('[data-f="' + f + '"]'); return el ? el.value : ''; }
      var rej = +g('rej') || 0;
      if (rej <= 0) return;
      if (rej > src.qty) { invalid = src.name || ('ردیف ' + (i + 1)); return; }
      lines.push({
        itemKey: (typeof W.ptfProcLineKey === 'function') ? W.ptfProcLineKey(src) : (src.pcode || src.name),
        name: src.name, desc: src.desc, unit: src.unit, pcode: src.pcode,
        qtyOffered: src.qty, qtyRejected: rej, qtyAccepted: Math.max(0, src.qty - rej),
        disposition: g('disp') || 'stock', dispositionQty: rej,
        unitCost: +g('cost') || 0, note: String(g('note') || '')
      });
    });
    if (invalid) { alert('⛔ تعداد مردود «' + invalid + '» از تعداد سند برد بیشتر است.'); return; }
    if (!lines.length) { alert('⛔ برای هیچ قلمی تعداد مردود ثبت نشده است.'); return; }
    var needsSup = lines.some(function (l) { return l.disposition === 'supplier_return'; });
    if (needsSup && !supCd) { alert('⛔ برای اقلام «عودت به فروشنده» انتخاب تأمین‌کننده الزامی است.'); return; }

    var rec = {
      cd: (typeof genCode === 'function' ? genCode('INSP') : 'INSP-' + Date.now()),
      no: String((dlg.querySelector('#ptfInspNo') || {}).value || ''),
      at: nowFa(), by: who(), offerNo: c.wonOffer || '', desc: desc, supplierCd: supCd, lines: lines
    };
    c.inspections = Array.isArray(c.inspections) ? c.inspections : [];
    c.inspections.unshift(rec);
    c.timeline = Array.isArray(c.timeline) ? c.timeline : [];
    c.timeline.unshift({ t: nowFa(), by: rec.by, tx: '🔬 بازرسی قلم‌به‌قلم: ' + lines.length + ' قلم مردود ثبت شد' });
    if (setData('ptf_crm_deals', deals) === false) { alert('⛔ ثبت بازرسی روی حافظهٔ پایدار ذخیره نشد.'); return; }

    var effects = W.ptfInspectionApplyDispositions(rec, c);
    try { if (typeof audit === 'function') audit('پرونده فروش', 'بازرسی قلم‌به‌قلم ' + rec.cd + ' — ' + lines.length + ' قلم مردود' +
      (effects.stock ? ' | انبار: ' + effects.stock : '') + (effects.supplierReturn ? ' | عودت: ' + effects.supplierReturn : ''), idOf(c)); } catch (eA) {}
    dlg.remove();
    toast('🔬 بازرسی ثبت شد' + (effects.stock ? ' — ' + effects.stock + ' قلم به انبار' : '') + (effects.supplierReturn ? ' — ' + effects.supplierReturn + ' قلم عودت' : ''), 'ok');
    if (typeof renderDeals === 'function') renderDeals();
  };

  /* اثر عملیاتی/مالی سرنوشت اقلام مردود */
  W.ptfInspectionApplyDispositions = function (rec, c) {
    var out = { stock: 0, supplierReturn: 0, returnValue: 0 };
    if (!rec || !Array.isArray(rec.lines)) return out;
    /* ۱) انبار */
    rec.lines.filter(function (l) { return l.disposition === 'stock'; }).forEach(function (l) {
      try {
        if (typeof W.ptfSurplusAdd === 'function') {
          var pcode = l.pcode || l.name;
          W.ptfSurplusAdd(pcode, l.dispositionQty, 'انبار — مردود بازرسی', idOf(c),
            'مردود بازرسی ' + (rec.no || rec.cd) + ' — پروندهٔ ' + (c.inqNo || idOf(c)));
          out.stock++;
        }
      } catch (e) {}
    });
    /* ۲) عودت به فروشنده — رکورد مرجوعی خرید + سند بستانکار حساب تأمین‌کننده (تصمیم کارفرما) */
    var retLines = rec.lines.filter(function (l) { return l.disposition === 'supplier_return'; });
    if (retLines.length && rec.supplierCd) {
      var value = retLines.reduce(function (s, l) { return s + (+l.dispositionQty || 0) * (+l.unitCost || 0); }, 0);
      var prs = list('ptf_crm_purchase_returns');
      var pr = {
        cd: (typeof genCode === 'function' ? genCode('PRET') : 'PRET-' + Date.now()),
        supplierCd: rec.supplierCd, caseId: idOf(c), inqNo: c.inqNo || '', offerNo: c.wonOffer || '',
        inspectionCd: rec.cd, at: nowFa(), by: who(), status: 'posted', cur: 'IRR', amount: value,
        lines: retLines.map(function (l) { return { name: l.name, pcode: l.pcode, qty: l.dispositionQty, unitCost: l.unitCost, note: l.note }; })
      };
      prs.unshift(pr);
      out.supplierReturn = retLines.length; out.returnValue = value;
      if (value > 0) {
        var fin = W.ptfSupplierReturnCredit(pr);
        if (fin && fin.ok) { pr.financePaymentCd = fin.paymentCd || ''; pr.allocatedToInvoices = fin.allocated || []; pr.unallocated = +fin.unallocated || 0; }
      }
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_purchase_returns', prs, { reason: 'w4' }); else setData('ptf_crm_purchase_returns', prs);
    }
    return out;
  };

  /* P7 (v34.7.32): تخصیص FIFO بستانکاری عودت به فاکتورهای خرید باز همان تأمین‌کننده.
     یک پرداخت تهاتری ثبت می‌شود (نه سند اصلاحی جدا) تا ماندهٔ فاکتور خرید واقعاً کم شود
     و اعتبار باقیمانده مثل سایر پرداخت‌ها در unallocated بماند — بدون دوباره‌شماری. */
  W.ptfSupplierOpenPurchaseInvoices = function (supCd, cur, d) {
    d = d || {};
    var invs = Array.isArray(d.invoices) ? d.invoices : [];
    var pays = Array.isArray(d.payments) ? d.payments : [];
    function paidOf(inv) {
      return pays.filter(function (p) { return p && p.status !== 'void'; }).reduce(function (sum, p) {
        return sum + (p.allocations || []).filter(function (a) { return a && a.invoiceCd === inv.cd; })
          .reduce(function (s, a) { return s + (+a.amount || 0); }, 0);
      }, 0);
    }
    return invs.filter(function (i) {
      if (!i || i.status === 'void' || i.isCover === true) return false;
      if (String(i.supplierCd || '') !== String(supCd || '')) return false;
      if (String(i.cur || 'IRR') !== String(cur || 'IRR')) return false;
      return Math.max(0, (+i.amount || 0) - paidOf(i)) > 0;
    }).map(function (i) {
      return { inv: i, remain: Math.max(0, (+i.amount || 0) - paidOf(i)) };
    }).sort(function (a, b) {
      return String(a.inv.dateISO || a.inv.dateFa || '').localeCompare(String(b.inv.dateISO || b.inv.dateFa || ''));
    });
  };

  W.ptfSupplierReturnAllocateFifo = function (amount, openRows) {
    var left = Math.max(0, +amount || 0), alloc = [];
    (openRows || []).forEach(function (row) {
      if (left <= 0) return;
      var take = Math.min(left, +row.remain || 0);
      if (take <= 0) return;
      alloc.push({ invoiceCd: row.inv.cd, invoiceNo: row.inv.no || '', amount: take });
      left -= take;
    });
    return { allocations: alloc, unallocated: left };
  };

  /* سند بستانکار در حساب تأمین‌کننده = پرداخت تهاتری + تخصیص FIFO به فاکتور خرید (P7) */
  W.ptfSupplierReturnCredit = function (pr) {
    try {
      var KEY = 'ptf_crm_supplier_finance';
      var d = {};
      try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { d = {}; }
      if (Array.isArray(d)) d = {};
      d.schema = 1; d.invoices = d.invoices || []; d.payments = d.payments || [];
      d.adjustments = Array.isArray(d.adjustments) ? d.adjustments : [];
      var iso = ''; try { iso = (typeof ptfJToISO === 'function') ? ptfJToISO(pr.at) : ''; } catch (e2) {}
      if (!iso) { try { iso = new Date().toISOString().slice(0, 10); } catch (e3) { iso = ''; } }
      var amt = Math.abs(+pr.amount || 0);
      var cur = pr.cur || 'IRR';
      var fifo = W.ptfSupplierReturnAllocateFifo(amt, W.ptfSupplierOpenPurchaseInvoices(pr.supplierCd, cur, d));
      var payCd = (typeof genCode === 'function' ? genCode('SFPAY') : 'SFPAY-' + Date.now());
      var pay = {
        cd: payCd, supplierCd: pr.supplierCd, supName: '', dateISO: iso, dateFa: pr.at || '',
        cur: cur, rate: 1, amount: amt, amountIrr: amt, method: 'purchase_return',
        note: 'تهاتر مرجوعی خرید (اقلام مردود بازرسی) — پرونده ' + (pr.inqNo || pr.caseId || '') + ' | سند ' + pr.cd,
        allocations: fifo.allocations, unallocated: fifo.unallocated, status: 'posted',
        sourceReturnCd: pr.cd, caseId: pr.caseId || '', t: nowFa(), by: pr.by || who()
      };
      d.payments.unshift(pay);
      if (typeof setData === 'function') setData(KEY, d); else localStorage.setItem(KEY, JSON.stringify(d));
      try { if (typeof audit === 'function') audit('حساب تامین', 'تهاتر مرجوعی خرید ' + money(pr.amount) + ' ریال — تخصیص به ' + fifo.allocations.length + ' فاکتور، اعتبار باقی ' + money(fifo.unallocated) + ' — ' + pr.cd, pr.supplierCd); } catch (eA) {}
      return { ok: true, paymentCd: payCd, allocated: fifo.allocations, unallocated: fifo.unallocated };
    } catch (e) { try { console.error('ptfSupplierReturnCredit', e); } catch (e4) {} return { ok: false }; }
  };

  /* ---------------- P5: بازنگری سند برد ---------------- */
  function revisionCopy(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return Object.assign({}, v || {}); } }
  function revisionContext() { return W._ptfAwardRevisionContext || null; }
  function revisionDraftKey(ctx){return ctx&&ctx.operationId?'ptf_autodraft_award_revision_'+String(ctx.operationId).replace(/[^A-Za-z0-9_.|:-]/g,'_'):'';}
  /* v34.8.40 (R2/T5-2c — DEV→IDB): پیش‌نویس بازنگری جایزه در Dev-KV است؛
     ptfDevKv.remove خودش ردیف IDB و legacy LS را با هم پاک می‌کند. */
  function clearRevisionDraft(ctx){var key=revisionDraftKey(ctx);if(key)try{if(window.ptfDevKv)window.ptfDevKv.remove(key);else localStorage.removeItem(key);}catch(e){}}
  function lockRevisionIdentityFields() {
    var ctx=revisionContext(),dlg=document.getElementById('ptfReviseDlg');if(!ctx||!dlg)return;
    ['ofBuyer','ofInq','ofCurrency'].forEach(function(id){var el=document.getElementById(id);if(!el)return;el.disabled=true;el.setAttribute('aria-disabled','true');el.title='هویت قراردادی پس از تشکیل پرونده در رویژن قابل تغییر نیست';el.style.background='#f1f5f9';});
  }
  function setRevisionControlsLocked(locked, keepSubmit) {
    var dlg=document.getElementById('ptfReviseDlg');if(!dlg)return;
    dlg.querySelectorAll('input,select,textarea,button').forEach(function(el){
      if(keepSubmit&&el.id==='offSaveBtn')return;
      if(el.getAttribute('data-revision-cancel')==='1')return;
      el.disabled=!!locked;
    });
    if(!locked)lockRevisionIdentityFields();
  }

  /* v34.7.45: رویژن دیگر یک جدول کوچک موازی نیست. همان offerForm مالی، همان
     state، رندر اقلام، کاتالوگ، بارگذاری درخواست، نرخ مرجع، حاشیه، Excel، پیش‌نمایش
     و Terms استفاده می‌شود؛ فقط submit آن به revise_award اتمیک متصل است. */
  W.ptfAwardReviseOpen = function (caseId) {
    if (!canRevise()) { alert('⛔ بازنگری سند برد فقط برای مدیران ارشد/تجاری مجاز است'); return; }
    var c=findCase(caseId);if(!c){alert('⛔ پروندهٔ فروش یافت نشد');return;}
    var aw=awardLines(c);if(!aw.offer){alert('⛔ سند برد این پرونده پیدا نشد (wonOffer: '+(c.wonOffer||'—')+')');return;}
    if(typeof W.offerForm!=='function'||typeof W.ptfSetOffState!=='function'){alert('⛔ فرم کامل پیشنهاد مالی بارگذاری نشده است؛ صفحه را آنلاین تازه‌سازی کنید.');return;}

    var original=revisionCopy(aw.offer),items=aw.items.length?aw.items:[{name:'',qty:1,price:0,unit:'NO',_revisionSourceIndex:-1}];
    /* سازگاری با رفتار قبلی: آخرین بازرسی فقط مقدار پذیرفته‌شده را به‌عنوان پیش‌فرض
       پیشنهاد می‌کند؛ کاربر در همان جدول کامل مالی می‌تواند آن را تغییر دهد. */
    var insp=(c.inspections||[])[0],rejByKey={};
    if(insp)(insp.lines||[]).forEach(function(l){rejByKey[String(l.itemKey||l.pcode||l.name)]=+l.qtyRejected||0;});
    items=items.map(function(it){var row=revisionCopy(it),key=(typeof W.ptfProcLineKey==='function')?W.ptfProcLineKey(row):(row.pcode||row.name),rej=+rejByKey[String(key)]||0;row.qty=Math.max(0,(+row.qty||0)-rej);return row;});
    var draft=revisionCopy(original);draft.items=items;draft.terms=Array.isArray(original.terms)?revisionCopy(original.terms):[];draft.extraCols=Array.isArray(original.extraCols)?original.extraCols.slice():[];draft.st='won';draft.status='won';draft.editMode='award_revision';
    var operationId='REV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
    var ctx={caseId:idOf(c),operationId:operationId,expectedRev:+original.rev||0,expectedOfferId:String(original._id||original.no||''),currency:String(original.currency||c.currency||'IRR').toUpperCase(),offerNo:String(original.no||''),oldTotal:aw.items.reduce(function(sum,it){return sum+(+it.qty||0)*(+it.price||0);},0),originalOffer:original,pendingPayload:null};
    W._ptfAwardRevisionContext=ctx;W.ptfSetOffState(draft);W.offerForm();

    var wrap=document.getElementById('offItemsWrap'),dlg=wrap&&wrap.closest?wrap.closest('.md-b'):null;
    if(!dlg){W._ptfAwardRevisionContext=null;alert('⛔ فرم رویژن ساخته نشد؛ صفحه را تازه‌سازی کنید.');return;}
    dlg.id='ptfReviseDlg';dlg.style.zIndex='2950';dlg.setAttribute('data-operation-id',operationId);dlg.setAttribute('data-expected-rev',ctx.expectedRev);dlg.setAttribute('data-offer-id',ctx.expectedOfferId);dlg.setAttribute('data-currency',ctx.currency);dlg.setAttribute('onclick','if(event.target===this)ptfAwardRevisionCancel()');
    var title=dlg.querySelector('h3');if(title)title.innerHTML='✏️ رویژن پیشنهاد برنده — '+title.innerHTML;
    var banner='<div id="ptfRevIdentityNotice" style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:9px;font-size:12px;color:#9a3412;margin-bottom:9px">رویژن روی <b dir="ltr">'+esc(ctx.offerNo)+'</b> و همان شناسه ثبت می‌شود. فرم زیر دقیقاً فرم پیشنهاد مالی است؛ کالا، اقلام درخواست، بارگذاری از درخواست دیگر، نرخ مرجع، حاشیه سود، شرایط و پیش‌نمایش قابل استفاده‌اند. هویت مشتری، درخواست و ارز پس از تشکیل پرونده قفل است.</div>';
    if(title)title.insertAdjacentHTML('afterend',banner);
    var save=dlg.querySelector('#offSaveBtn');
    if(!save){W._ptfAwardRevisionContext=null;dlg.remove();alert('⛔ دکمهٔ ثبت فرم رویژن پیدا نشد.');return;}
    var actions=save.parentElement&&save.parentElement.parentElement;
    var special='<div id="ptfRevCommitFields" style="margin-top:12px"><div id="ptfRevPreview" style="background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:9px;font-size:12.5px"></div><label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12.5px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px"><input type="checkbox" id="ptfRevVoidInv"> <span>فاکتورهای فعال این پرونده باطل شوند و مطالبه بازسازی شود.</span></label><div class="fld" style="margin-top:8px"><label>دلیل رویژن * (در سند اصلاحی ثبت می‌شود)</label><textarea id="ptfRevReason" rows="2" placeholder="علت تغییر اقلام، قیمت، نرخ مرجع یا شرایط را ثبت کنید"></textarea></div></div>';
    if(actions)actions.insertAdjacentHTML('beforebegin',special);
    save.setAttribute('onclick','window.ptfAwardReviseSubmit(\''+arg(ctx.caseId)+'\')');save.textContent='ثبت رویژن پیشنهاد برنده';
    var actionButtons=actions?actions.querySelectorAll('button'):[];
    if(actionButtons.length){actionButtons[0].setAttribute('onclick','ptfAwardRevisionCancel()');actionButtons[0].setAttribute('data-revision-cancel','1');}
    try{dlg.addEventListener('input',function(){W.ptfAwardRevisePreview();});}catch(eBind){}
    lockRevisionIdentityFields();setTimeout(lockRevisionIdentityFields,120);W.ptfAwardRevisePreview();
  };

  W.ptfAwardRevisionCancel = function () {
    var ctx=revisionContext(),dlg=document.getElementById('ptfReviseDlg');
    if(dlg&&dlg.getAttribute('data-in-flight')==='1'){toast('فرمان رویژن هنوز در انتظار پاسخ سرور است.','warn');return;}
    clearRevisionDraft(ctx);if(dlg)dlg.remove();if(ctx===W._ptfAwardRevisionContext)W._ptfAwardRevisionContext=null;
  };

  W.ptfAwardReviseAddLine = function () {
    if(typeof W.offAddItem==='function')W.offAddItem({name:'',desc:'',model:'',qty:1,unit:'NO',brand:'',dlv:'',price:0});
  };

  W.ptfAwardRevisePreview = function () {
    var ctx=revisionContext(),box=document.getElementById('ptfRevPreview'),o=W._offState;if(!ctx||!box||!o)return;
    var items=Array.isArray(o.items)?o.items:[],newTotal=items.reduce(function(sum,it){return sum+(+it.qty||0)*(+it.price||0);},0),delta=newTotal-ctx.oldTotal,label=ctx.currency==='IRR'?'ریال':ctx.currency;
    box.innerHTML='<b>مبلغ فعلی سند برد:</b> '+money(ctx.oldTotal)+' '+esc(label)+' &nbsp;|&nbsp; <b>مبلغ رویژن:</b> '+money(newTotal)+' '+esc(label)+' &nbsp;|&nbsp; <b style="color:'+(delta<0?'#b91c1c':delta>0?'#047857':'#475569')+'">دلتا: '+(delta>0?'+':'')+money(delta)+' '+esc(label)+'</b><div style="color:#64748b;margin-top:4px">تعداد اقلام رویژن: '+items.length+' | شماره و هویت پیشنهاد ثابت می‌ماند.</div>';
  };

  W.ptfAwardReviseSubmit = function (caseId) {
    var dlg=document.getElementById('ptfReviseDlg'),ctx=revisionContext();
    if(!dlg||!ctx){alert('⛔ پنجرهٔ رویژن باز نیست؛ دوباره از پرونده باز کنید.');return;}
    if(String(ctx.caseId)!==String(caseId)){alert('⛔ هویت پروندهٔ فرم رویژن تغییر کرده است؛ فرم را ببندید و دوباره باز کنید.');return;}
    if(dlg.getAttribute('data-in-flight')==='1'){toast('رویژن قبلی هنوز در انتظار پاسخ سرور است.','warn');return;}
    if(!canRevise()){alert('⛔ مجاز نیستید');return;}
    var c=findCase(caseId),aw=c?awardLines(c):null;if(!c||!aw||!aw.offer){alert('⛔ پیشنهاد برنده دیگر در cache موجود نیست؛ داده را تازه‌سازی و فرم را دوباره باز کنید.');return;}
    if(typeof W.ptfSalesDomainCommand!=='function'){alert('⛔ ماژول سرور فروش بارگذاری نشده است؛ رویژن فقط از مسیر سرور انجام می‌شود.');return;}

    var payload=ctx.pendingPayload;
    if(!payload){
      var o=W._offState;if(!o||!Array.isArray(o.items)){alert('⛔ state فرم مالی در دسترس نیست؛ فرم را دوباره باز کنید.');return;}
      var reason=String((dlg.querySelector('#ptfRevReason')||{}).value||'').trim();if(!reason){alert('⛔ دلیل رویژن الزامی است');return;}
      /* کنترل‌های غیر-live همان offerSave اصلی از DOM به state منتقل می‌شوند. */
      var buyer=document.getElementById('ofBuyer'),inq=document.getElementById('ofInq'),cur=document.getElementById('ofCurrency');
      o.buyerCd=buyer?buyer.value:(o.buyerCd||'');o.inqNo=inq?String(inq.value||'').trim():(o.inqNo||'');o.currency=String(cur?cur.value:(o.currency||ctx.currency)).toUpperCase();
      o.dateEn=(typeof W.ptfJToISO==='function'?W.ptfJToISO(((document.getElementById('ofDateJ')||{}).value||'')):'')||o.dateEn||new Date().toISOString().slice(0,10);
      if(o.kind==='CO'||o.kind==='TC')o.validUntil=(typeof W.ptfJToISO==='function'?W.ptfJToISO(((document.getElementById('ofValidJ')||{}).value||'')):'')||o.validUntil||'';
      o.printAs=((document.getElementById('ofPrintAs')||{}).value)||o.printAs||'CO';o.useSig=!!(document.getElementById('ofUseSig')||{}).checked;
      var signAs=document.getElementById('ofSignAs');if(signAs&&signAs.value)o.signAs=signAs.value;
      var fxBasis=document.getElementById('ofFxBasis'),fxRate=document.getElementById('ofFxRate');
      o.fxBasis=fxBasis?fxBasis.value:(o.fxBasis||'');o.fxRateRef=fxRate?((typeof W.ptfNum==='function')?W.ptfNum(fxRate.value):(+String(fxRate.value||'').replace(/[^\d.-]/g,'')||0)):(+o.fxRateRef||0);
      if(o.currency!=='IRR'&&(!o.fxBasis||!(+o.fxRateRef>0))){alert('⛔ برای پیشنهاد ارزی، مبنا و نرخ مرجع ارز به ریال الزامی است.');return;}
      if(String(o.buyerCd||'')!==String(ctx.originalOffer.buyerCd||'')||String(o.inqNo||'')!==String(ctx.originalOffer.inqNo||'')||o.currency!==ctx.currency){alert('⛔ هویت مشتری، درخواست یا ارز پیشنهاد برنده در رویژن قابل تغییر نیست. فرم را دوباره باز کنید.');return;}
      if(typeof W.offValidateItems==='function'){var validation=W.offValidateItems();if(validation){alert('⛔ '+validation);return;}}
      if(typeof W.offDedupeOfferItems==='function'){var ded=W.offDedupeOfferItems(o.items||[]);if(ded&&ded.removed){o.items=ded.items;if(typeof W.offRenderItems==='function')W.offRenderItems();toast('🧹 '+ded.removed+' ردیف تکراری حذف شد','warn');}}
      if(!o.items.length){alert('⛔ حداقل یک قلم لازم است');return;}
      var lines=o.items.map(function(item){
        var line=revisionCopy(item);
        if(!String(line.unit||'').trim())line.unit='NO';if(typeof W.ptfOfferUnitEn==='function')line.unit=W.ptfOfferUnitEn(line.unit);
        /* مقدار نمایشی نرخ مرجع ممکن است از resolver کاتالوگ آمده باشد ولی هنوز در
           state قلم materialize نشده باشد؛ قبل از command آن را صریح ثبت می‌کنیم. */
        if(!(+line.refPrice>0)&&typeof W.ptfItemRefPrice==='function'){
          try{var ref=W.ptfItemRefPrice(line,{inqNo:o.inqNo});if(ref&&+ref.price>0){line.refPrice=+ref.price;line.refCur=ref.cur||'IRR';line.refSrc=ref.src||'';line.refAt=ref.at||'';line.refFrom=ref.from||'';}}catch(eRef){}
        }
        var sourceIndex=+line._revisionSourceIndex;if(sourceIndex>=0)line.sourceIndex=sourceIndex;
        delete line.i;delete line._revisionSourceIndex;return line;
      }).filter(function(line){return String(line.name||'').trim()&&+line.qty>0;});
      if(!lines.length){alert('⛔ حداقل یک قلم معتبر با تعداد بزرگ‌تر از صفر لازم است.');return;}
      var newTotal=lines.reduce(function(sum,it){return sum+(+it.qty||0)*(+it.price||0);},0);if(!(newTotal>0)){alert('⛔ مبلغ کل رویژن باید بزرگ‌تر از صفر باشد.');return;}
      var voidInv=!!(dlg.querySelector('#ptfRevVoidInv')||{}).checked,label=ctx.currency==='IRR'?'ریال':ctx.currency;
      var msg='رویژن پیشنهاد برنده '+ctx.offerNo+' با مبلغ '+money(newTotal)+' '+label+' ثبت شود؟\n\nمبلغ فعلی: '+money(ctx.oldTotal)+' '+label+'\nدلتا: '+money(newTotal-ctx.oldTotal)+' '+label;
      if(voidInv)msg+='\n\nفاکتورهای فعال این پرونده باطل می‌شوند؛ رسیدها می‌مانند.';if(!confirm(msg))return;
      payload={caseId:ctx.caseId,reason:reason,lines:lines,voidInvoices:voidInv,expectedOfferId:ctx.expectedOfferId,expectedRev:ctx.expectedRev,idempotencyKey:ctx.operationId,toCatalog:!!(document.getElementById('ofRefToCatalog')||{}).checked,
        offerDocument:{buyerCd:o.buyerCd||'',inqNo:o.inqNo||'',currency:o.currency||ctx.currency,dateEn:o.dateEn||'',dateFa:o.dateFa||'',validUntil:o.validUntil||'',sellerContact:o.sellerContact||'',buyerContact:o.buyerContact||'',buyerTel:o.buyerTel||'',printAs:o.printAs||'',useSig:!!o.useSig,signAs:o.signAs||'',fxBasis:o.fxBasis||'',fxRateRef:+o.fxRateRef||0,terms:Array.isArray(o.terms)?revisionCopy(o.terms):[],extraCols:Array.isArray(o.extraCols)?o.extraCols.slice():[]}};
      ctx.pendingPayload=revisionCopy(payload);
    }

    var submitBtn=dlg.querySelector('#offSaveBtn');dlg.setAttribute('data-in-flight','1');setRevisionControlsLocked(true,true);
    if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='⏳ در انتظار تأیید سرور…';}
    return W.ptfSalesDomainCommand('revise_award',payload,{onAck:function(d){
      var r=(d&&d.result)||{},canonical=list('ptf_crm_offers').filter(function(x){return x&&String(x.no||'')===ctx.offerNo;})[0]||W._offState;
      try{if(typeof W.ptfSyncRefPriceBack==='function'){var rb=W.ptfSyncRefPriceBack(canonical,{toCatalog:!!payload.toCatalog});if(rb.request||rb.catalog)toast('💰 نرخ مرجع به‌روز شد — اقلام درخواست: '+rb.request+(rb.catalog?' | بانک کالا: '+rb.catalog:''),'ok');}}catch(eBack){}
      clearRevisionDraft(ctx);dlg.remove();W._ptfAwardRevisionContext=null;
      toast('✅ رویژن '+(r.revisionOfferNo||ctx.offerNo)+(r.rev?' Rev.'+r.rev:'')+' ثبت شد — مبلغ: '+money(r.effectiveAmount||r.newAmount||0)+' '+(ctx.currency==='IRR'?'ریال':ctx.currency)+(d&&d.compactReceipt?' (بازیابی رسید قطعی)':''),'ok');
      if(typeof W.renderDeals==='function')W.renderDeals();if(typeof W.renderOffers==='function')W.renderOffers();
    },onReject:function(e){
      var msg=(e&&e.message)?e.message:String(e||''),stale=msg.indexOf('award_revision_conflict')>-1||msg.indexOf('award_offer_identity_conflict')>-1||msg.indexOf('duplicate_sales_cases')>-1||msg.indexOf('duplicate_offer_no')>-1;
      ctx.pendingPayload=null;dlg.removeAttribute('data-in-flight');setRevisionControlsLocked(false,false);
      if(submitBtn){submitBtn.disabled=!!stale;submitBtn.textContent=stale?'نیاز به بازکردن مجدد فرم':'ثبت رویژن پیشنهاد برنده';}
      if(msg.indexOf('official_invoice_blocks_decrease')>-1)alert('⛔ برای این پرونده فاکتور رسمی صادر شده است؛ کاهش مبلغ سند برد مسدود است.\n\nمسیر درست: ابطال/اصلاحیهٔ فاکتور رسمی، سپس رویژن.');
      else if(stale)alert('⛔ از زمان بازشدن فرم، پیشنهاد یا پرونده روی دستگاه دیگری تغییر کرده است. داده را دریافت و فرم رویژن را دوباره باز کنید.');
      else if(msg.indexOf('revision_precondition_required')>-1)alert('⛔ نسخهٔ صفحه قدیمی است؛ صفحه را آنلاین تازه‌سازی و فرم را دوباره باز کنید.');
      else if(msg.indexOf('award_revision_identity_change_forbidden')>-1)alert('⛔ هویت قراردادی مشتری/درخواست/ارز پس از تشکیل پرونده قابل تغییر نیست.');
      else alert('⛔ رویژن پیشنهاد برنده انجام نشد: '+msg);
    },onUncertain:function(e){
      dlg.removeAttribute('data-in-flight');setRevisionControlsLocked(true,true);
      if(submitBtn){submitBtn.disabled=false;submitBtn.textContent='بررسی رسید قطعی / تلاش همان فرمان';}
      alert('⚠️ نتیجه رویژن هنوز نامشخص است. فرم برای جلوگیری از تغییر payload قفل و operationId حفظ شد؛ همین دکمه فقط رسید همان فرمان را بازیابی می‌کند. شناسه پیگیری: '+e.operationId);
    }});
  };

  /* ---------------- P6: گزارش بازنگری و سرنوشت اقلام ---------------- */
  W.ptfAwardRevisionReportData = function (caseId) {
    var c = findCase(caseId); if (!c) return null;
    var offers = list('ptf_crm_offers');
    var revs = (c.awardRevisions || []).slice();
    var insp = (c.inspections || []).slice();
    var invs = list('ptf_crm_invoices').filter(function (i) {
      return i && String(i.status || '') !== 'void' && same(c, String(i.caseId || ''));
    });
    var dispTotals = {};
    insp.forEach(function (r) {
      (r.lines || []).forEach(function (l) {
        var k = l.disposition || 'stock';
        dispTotals[k] = dispTotals[k] || { qty: 0, value: 0, items: 0 };
        dispTotals[k].qty += +l.dispositionQty || 0;
        dispTotals[k].value += (+l.dispositionQty || 0) * (+l.unitCost || 0);
        dispTotals[k].items++;
      });
    });
    var returns = list('ptf_crm_purchase_returns').filter(function (r) { return r && same(c, String(r.caseId || '')); });
    var award = W.ptfCaseAwardOffer(c);
    var first = revs.length ? revs[0].oldAmount : (award ? (award.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0) : 0);
    var effective = +c.effectiveContractAmount || +c.contractAmount || (award ? (award.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0) : 0);
    var billed = invs.reduce(function (s, i) { return s + (+i.amount || 0); }, 0);
    var paid = 0, open = 0;
    try {
      if (W.PTF && W.PTF.ar && typeof W.PTF.ar.invoiceState === 'function') {
        invs.forEach(function (i) { var st = W.PTF.ar.invoiceState(i); paid += st.paid; open += st.open; });
      }
    } catch (e) {}
    return {
      caseId: idOf(c), inqNo: c.inqNo || '', buyer: c.buyerCo || '', award: award ? award.no : (c.wonOffer || ''),
      revisions: revs, inspections: insp, dispositions: dispTotals, purchaseReturns: returns,
      firstAmount: first, effectiveAmount: effective, delta: effective - first,
      billed: billed, paid: paid, open: open, invoices: invs.length,
      supersededOffers: offers.filter(function (o) { return o && o.supersededByOfferNo && String(o.no || '') !== String(c.wonOffer || '') && (String(o.inqNo || '') === String(c.inqNo || '')); })
        .map(function (o) { return { no: o.no, by: o.supersededByOfferNo, at: o.supersededAt || '' }; })
    };
  };

  W.ptfAwardRevisionReport = function (caseId) {
    var d = W.ptfAwardRevisionReportData(caseId);
    if (!d) { alert('⛔ پرونده یافت نشد'); return; }
    if (!d.revisions.length && !d.inspections.length) {
      alert('برای این پرونده هنوز بازنگری سند برد یا بازرسی قلم‌به‌قلمی ثبت نشده است.');
      return;
    }
    var revRows = d.revisions.map(function (r) {
      return '<tr><td>' + esc(r.seq) + '</td><td dir="ltr">' + esc(r.fromOfferNo) + ' ⇐ ' + esc(r.toOfferNo) + '</td>' +
        '<td>' + money(r.oldAmount) + '</td><td>' + money(r.newAmount) + '</td>' +
        '<td style="color:' + ((r.delta || 0) < 0 ? '#b91c1c' : '#047857') + '">' + ((r.delta || 0) > 0 ? '+' : '') + money(r.delta) + '</td>' +
        '<td>' + esc(r.at) + '<br><small>' + esc(r.by) + '</small></td><td>' + esc(r.reason) + '</td></tr>';
    }).join('') || '<tr><td colspan="7">بازنگری ثبت نشده است.</td></tr>';
    var itemRows = [];
    d.inspections.forEach(function (r) {
      (r.lines || []).forEach(function (l) {
        itemRows.push('<tr><td>' + esc(l.name) + '</td><td>' + money(l.qtyOffered) + '</td><td>' + money(l.qtyAccepted) + '</td>' +
          '<td style="color:#b45309">' + money(l.qtyRejected) + '</td><td>' + esc(dispLabel(l.disposition)) + '</td>' +
          '<td>' + money((+l.dispositionQty || 0) * (+l.unitCost || 0)) + '</td><td>' + esc(r.no || r.cd) + '<br><small>' + esc(r.at) + '</small></td></tr>');
      });
    });
    var dispRows = Object.keys(d.dispositions).map(function (k) {
      var x = d.dispositions[k];
      return '<tr><td>' + esc(dispLabel(k)) + '</td><td>' + x.items + '</td><td>' + money(x.qty) + '</td><td>' + money(x.value) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">موردی ثبت نشده است.</td></tr>';

    var html = '<div class="md-b" id="ptfRevReportDlg" style="display:grid;z-index:2960" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:1000px;max-height:92vh;overflow:auto">' +
      '<h3>📑 گزارش بازنگری سند برد و سرنوشت اقلام — ' + esc(d.inqNo || d.caseId) + '</h3>' +
      '<div style="font-size:12px;color:#64748b">مشتری: <b>' + esc(d.buyer) + '</b> | سند برد فعلی: <b dir="ltr">' + esc(d.award) + '</b></div>' +
      '<div class="sr" style="margin:10px 0">' +
      '<div class="sc"><b>' + money(d.firstAmount) + '</b><span>مبلغ اولیه</span></div>' +
      '<div class="sc"><b>' + money(d.effectiveAmount) + '</b><span>مبلغ مؤثر فعلی</span></div>' +
      '<div class="sc"><b style="color:' + (d.delta < 0 ? '#b91c1c' : '#047857') + '">' + (d.delta > 0 ? '+' : '') + money(d.delta) + '</b><span>دلتا</span></div>' +
      '<div class="sc"><b>' + money(d.billed) + '</b><span>فاکتورشده (' + d.invoices + ')</span></div>' +
      '<div class="sc"><b>' + money(d.paid) + '</b><span>وصول‌شده</span></div>' +
      '<div class="sc"><b>' + money(d.open) + '</b><span>مطالبهٔ باز</span></div></div>' +
      '<h4>بازنگری‌های سند برد</h4><div class="tb2"><table><thead><tr><th>#</th><th>از ⇐ به</th><th>مبلغ قبلی</th><th>مبلغ جدید</th><th>دلتا</th><th>زمان/کاربر</th><th>دلیل</th></tr></thead><tbody>' + revRows + '</tbody></table></div>' +
      '<h4>اقلام مردود بازرسی</h4><div class="tb2"><table><thead><tr><th>قلم</th><th>تعداد سند</th><th>پذیرفته</th><th>مردود</th><th>سرنوشت</th><th>ارزش</th><th>گزارش</th></tr></thead><tbody>' +
        (itemRows.join('') || '<tr><td colspan="7">بازرسی قلم‌به‌قلمی ثبت نشده است.</td></tr>') + '</tbody></table></div>' +
      '<h4>جمع سرنوشت اقلام</h4><div class="tb2"><table><thead><tr><th>سرنوشت</th><th>تعداد ردیف</th><th>تعداد کالا</th><th>ارزش (ریال)</th></tr></thead><tbody>' + dispRows + '</tbody></table></div>' +
      (d.purchaseReturns.length ? '<div style="font-size:12px;color:#0e7490;margin-top:6px">↩️ ' + d.purchaseReturns.length + ' سند مرجوعی خرید ثبت شده و بستانکاری آن در حساب تأمین‌کننده اعمال شده است.</div>' : '') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="ptfAwardRevisionReportCsv(\'' + arg(d.caseId) + '\')">⬇️ CSV</button>' +
      '<button class="bt bt-o" onclick="window.print()">🖨 چاپ</button>' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div>' +
      '</div></div>';
    document.querySelectorAll('#ptfRevReportDlg').forEach(function (x) { x.remove(); });
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  W.ptfAwardRevisionReportCsv = function (caseId) {
    var d = W.ptfAwardRevisionReportData(caseId); if (!d) return;
    var rows = [['گزارش بازنگری سند برد و سرنوشت اقلام'], ['پرونده', d.inqNo || d.caseId], ['مشتری', d.buyer],
      ['سند برد فعلی', d.award], ['مبلغ اولیه', d.firstAmount], ['مبلغ مؤثر', d.effectiveAmount], ['دلتا', d.delta],
      ['فاکتورشده', d.billed], ['وصول‌شده', d.paid], ['مطالبهٔ باز', d.open], []];
    rows.push(['بازنگری‌ها']); rows.push(['#', 'از', 'به', 'مبلغ قبلی', 'مبلغ جدید', 'دلتا', 'زمان', 'کاربر', 'دلیل']);
    d.revisions.forEach(function (r) { rows.push([r.seq, r.fromOfferNo, r.toOfferNo, r.oldAmount, r.newAmount, r.delta, r.at, r.by, r.reason]); });
    rows.push([]); rows.push(['اقلام مردود']); rows.push(['قلم', 'تعداد سند', 'پذیرفته', 'مردود', 'سرنوشت', 'بهای واحد', 'ارزش', 'گزارش', 'زمان']);
    d.inspections.forEach(function (r) {
      (r.lines || []).forEach(function (l) {
        rows.push([l.name, l.qtyOffered, l.qtyAccepted, l.qtyRejected, dispLabel(l.disposition), l.unitCost,
          (+l.dispositionQty || 0) * (+l.unitCost || 0), r.no || r.cd, r.at]);
      });
    });
    var csv = '\uFEFF' + rows.map(function (r) {
      return r.map(function (x) { var s = String(x == null ? '' : x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
    }).join('\n');
    try {
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'award-revision-' + (d.inqNo || d.caseId) + '.csv';
      a.click();
      toast('فایل CSV گزارش ساخته شد', 'ok');
    } catch (e) { alert('⛔ ساخت فایل CSV ممکن نشد: ' + (e && e.message ? e.message : e)); }
  };
})();

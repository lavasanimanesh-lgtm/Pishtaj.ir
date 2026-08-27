/* =====================================================================
   PTF CRM — guards.js — Sprint 87 — US-197
   حذف ایمن با حفظ وابستگی‌ها: هر رکورد فقط وقتی حذف می‌شود که در هیچ
   جای دیگر سیستم از آن استفاده نشده باشد. پیام خطا وابستگی‌ها را نام می‌برد.
   + افزودن دکمه حذف 🗑 به مشتری/تامین‌کننده (که تاکنون نداشتند)
   ===================================================================== */
(function () {
  'use strict';

  function nrm(s) { return typeof dedupNorm === 'function' ? dedupNorm(s) : String(s || '').trim().toLowerCase(); }

  /* ---------- محاسبه وابستگی‌ها per نوع ---------- */
  window.ptfDeleteBlockers = function (kind, id) {
    var out = [];
    var offers = getData('ptf_crm_offers');

    if (kind === 'customer') {
      var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === id; })[0];
      if (!c) return out;
      getData('ptf_crm_rfqs').forEach(function (r) {
        if (r.custCd === id || nrm(r.co) === nrm(c.co)) out.push('درخواست ' + r.cd);
      });
      offers.forEach(function (o) {
        if (o.buyerCd === id) out.push((o.kind === 'CO' ? 'پیشنهاد مالی ' : 'پیشنهاد فنی ') + o.no);
      });
      getData('ptf_crm_invoices').forEach(function (v) { if (nrm(v.buyerCo) === nrm(c.co)) out.push('فاکتور ' + (v.cd || v.no || '')); });
      getData('ptf_crm_projects').forEach(function (p) { if (p.buyerCd === id) out.push('پرونده ' + p.no); });
      getData('ptf_crm_contracts').forEach(function (k) { if (nrm(k.party || k.buyerCo) === nrm(c.co)) out.push('قرارداد ' + (k.no || k.cd || '')); });
    }

    if (kind === 'supplier') {
      var s = getData('ptf_crm_suppliers').filter(function (x) { return x.cd === id; })[0];
      if (!s) return out;
      getData('ptf_crm_buyquotes').forEach(function (b) { if (nrm(b.sup) === nrm(s.co)) out.push('قیمت خرید ' + (b.cd || '')); });
      getData('ptf_crm_buycmp').forEach(function (c2) {
        if ((c2.quotes || []).some(function (q) { return nrm(q.sup) === nrm(s.co); })) out.push('جدول مقایسه ' + c2.inqNo);
        if ((c2.purchases || []).some(function (p) { return nrm(p.sup) === nrm(s.co); })) out.push('خرید نهایی ' + c2.inqNo);
      });
      getData('ptf_crm_rfqsmart').forEach(function (r) {
        if ((r.sups || []).some(function (x) { return nrm(x.co || x) === nrm(s.co); })) out.push('استعلام تامین ' + (r.no || ''));
      });
    }

    if (kind === 'product') {
      var p = getData('ptf_crm_products').filter(function (x) { return x.cd === id; })[0];
      if (!p) return out;
      offers.forEach(function (o) {
        if ((o.items || []).some(function (it) { return nrm(it.name) === nrm(p.nm) || (p.en && nrm(it.name) === nrm(p.en)); }))
          out.push((o.kind === 'CO' ? 'پیش‌فاکتور ' : 'پیشنهاد فنی ') + o.no);
      });
      getData('ptf_crm_inqitems').forEach(function (iq) {
        if (nrm(iq.nm) === nrm(p.nm) || (iq.en && nrm(iq.en) === nrm(p.nm))) out.push('اقلام درخواست ' + iq.inqNo);
      });
    }

    if (kind === 'offer') {
      var o = offers.filter(function (x) { return x.no === id; })[0];
      if (!o) return out;
      if (o.kind === 'TO') {
        if (o.coNo && offers.some(function (x) { return x.no === o.coNo; })) out.push('پیشنهاد مالی ' + o.coNo + ' (از این TO ساخته شده)');
        offers.forEach(function (x) { if (x.srcToNo === id) out.push('پیشنهاد مالی ' + x.no); });
      } else {
        if (o.st === 'won') out.push('وضعیت «برنده» (قفل — فقط ادمین با «بازگشت از برنده»)');
        if (o.invRef) out.push('ارجاع صدور فاکتور');
        getData('ptf_crm_invoices').forEach(function (v) { if (v.offerNo === id) out.push('فاکتور ' + (v.cd || v.no || '')); });
        getData('ptf_crm_projects').forEach(function (p2) { if (p2.offerNo === id) out.push('پرونده ' + p2.no); });
        getData('ptf_crm_packinglists').forEach(function (pl) { if (pl.offerNo === id) out.push('پکینگ لیست ' + pl.no); });
        if (o.advance) out.push('پیش‌پرداخت ثبت‌شده در مطالبات');
      }
    }

    if (kind === 'lead') {
      var l = getData('ptf_crm_leads').filter(function (x) { return x.cd === id; })[0];
      if (l && l.custCd) out.push('مشتری ' + l.custCd + ' (تبدیل‌شده از این لید)');
    }

    // یکتا و حداکثر ۸ مورد برای پیام
    var seen = {};
    return out.filter(function (x) { return !seen[x] && (seen[x] = 1); });
  };

  /* ---------- گارد مرکزی: false = مجاز به حذف ---------- */
  window.ptfDeleteGuard = function (kind, id, label) {
    // Sprint 102: حذف قفل‌های ضدچابکی. اجازه حذف به تیم بدون مانع‌تراشی.
    return false;
  };

  /* ---------- پوشش حذف‌های موجود ---------- */
  // کالا
  var _delProd = window.delProd;
  if (typeof _delProd === 'function') {
    window.delProd = function (cd) {
      if (ptfDeleteGuard('product', cd, 'کالای ' + cd)) return;
      _delProd(cd);
    };
  }
  // TO/CO (دکمه حذف عادی)
  var _offerDel = window.offerDel;
  if (typeof _offerDel === 'function') {
    window.offerDel = function (no) {
      if (ptfDeleteGuard('offer', no, no)) return;
      _offerDel(no);
    };
  }
  // حذف ادمین (backup.js) — دیرتر لود می‌شود
  var gt = 0;
  var gi = setInterval(function () {
    gt++;
    if (typeof window.adminDelOffer === 'function' && !window._admDelGuarded) {
      var _admDel = window.adminDelOffer;
      window.adminDelOffer = function (no) {
        var deps = ptfDeleteBlockers('offer', no).filter(function (d) { return d.indexOf('برنده') < 0; });
        if (deps.length) {
          alert('⛔ حتی ادمین: ابتدا وابستگی‌ها حذف شود:\n\n' + deps.slice(0, 8).map(function (d) { return '• ' + d; }).join('\n'));
          return;
        }
        _admDel(no);
      };
      window._admDelGuarded = true;
    }
    if (window._admDelGuarded || gt > 40) clearInterval(gi);
  }, 400);
  // لید — نام واقعی API: leadDel (delLead فقط alias است)
  function ptfWrapLeadDelete(fnName) {
    var _old = window[fnName];
    if (typeof _old !== 'function' || _old._ptfLeadGuarded) return;
    var wrapped = function (cd) {
      if (ptfDeleteGuard('lead', cd, 'لید ' + cd)) return;
      return _old.apply(this, arguments);
    };
    wrapped._ptfLeadGuarded = true;
    window[fnName] = wrapped;
  }
  ptfWrapLeadDelete('leadDel');
  ptfWrapLeadDelete('delLead');
  ptfWrapLeadDelete('ptfLeadDelDo');

  /* ---------- US-197: دکمه حذف برای مشتری/تامین‌کننده (جدید) ---------- */
  window.ptfDelEntity = function (kind, cd) {
    var key = kind === 'customer' ? 'ptf_crm_customers' : 'ptf_crm_suppliers';
    var rec = getData(key).filter(function (x) { return x.cd === cd; })[0];
    if (!rec) return;
    var lb = (kind === 'customer' ? 'مشتری' : 'تامین‌کننده') + ' «' + rec.co + '»';
    if (ptfDeleteGuard(kind, cd, lb)) return;
    window.ptfReasonedDelete(kind, cd, lb, function() {
      setData(key, getData(key).filter(function (x) { return x.cd !== cd; }));
      if (kind === 'customer' && typeof renderCustomers === 'function') renderCustomers();
      if (kind === 'supplier' && typeof renderSuppliers === 'function') renderSuppliers();
    });
  };

  // Sprint 104 Refactoring: جایگزینی تایمر حذف با Hook
  window.injectDelBtns = function () {
    try {
      [{ tb: 'cTb', kind: 'customer' }, { tb: 'sTb', kind: 'supplier' }].forEach(function (m) {
        var tb = document.getElementById(m.tb);
        if (!tb) return;
        tb.querySelectorAll('tr').forEach(function (tr) {
          var strong = tr.querySelector('td strong');
          if (!strong || tr.querySelector('.del-ent')) return;
          var cd = strong.textContent.trim();
          var tds = tr.querySelectorAll('td');
          if (!tds.length) return;
          tds[tds.length - 1].insertAdjacentHTML('beforeend',
            ' <button class="bt bt-o del-ent entity-row-action" data-entity-action="delete" style="padding:4px 9px;font-size:12px;color:#dc2626" title="حذف ' + (m.kind === 'customer' ? 'مشتری' : 'تأمین‌کننده') + '" aria-label="حذف ' + (m.kind === 'customer' ? 'مشتری' : 'تأمین‌کننده') + '" onclick="ptfDelEntity(\'' + m.kind + '\',\'' + ptfOnClickArg(cd) + '\')">🗑</button>');
        });
      });
    } catch (e) {}
  };
  var _gdOldC = window.renderCustomers;
  window.renderCustomers = function() { if(_gdOldC) _gdOldC(); if(typeof injectDelBtns==='function') injectDelBtns(); };
  var _gdOldC2 = window.renderCustomers2;
  window.renderCustomers2 = function() { if(_gdOldC2) _gdOldC2(); if(typeof injectDelBtns==='function') injectDelBtns(); };
  var _gdOldS = window.renderSuppliers;
  window.renderSuppliers = function() { if(_gdOldS) _gdOldS(); if(typeof injectDelBtns==='function') injectDelBtns(); };
  var _gdOldS2 = window.renderSuppliers2;
  window.renderSuppliers2 = function() { if(_gdOldS2) _gdOldS2(); if(typeof injectDelBtns==='function') injectDelBtns(); };
})();

  /* ============ Sprint 105: موتور حذف با ثبت دلیل و بایگانی آماری ============ */
  window.ptfReasonedDelete = function (kind, id, label, callback) {
    var reasons = [
      'انصراف کارفرما / لغو درخواست',
      'ثبت تکراری / آزمایشی',
      'اشتباه تایپی / ورود اطلاعات نادرست',
      'عدم امکان تأمین فنی / مالی',
      'سایر دلایل'
    ];
    var rOpts = reasons.map(function (r) { return '<option value="' + escP(r) + '">' + escP(r) + '</option>'; }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:1600" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px">' +
      '<h3>🗑 بایگانی و حذف ایمن با ثبت دلیل</h3>' +
      '<div style="background:#fff8f5;border:1px solid #fed7aa;border-radius:10px;padding:10px;font-size:12.5px;color:#9a3412;margin-bottom:12px">رکورد <b>«' + escP(label || id) + '»</b> از کارتابل فعال حذف خواهد شد. جهت شفافیت و بررسی‌های آماری مدیریت، لطفاً دلیل حذف را مشخص فرمایید:</div>' +
      '<div class="fld"><label>دلیل اصلی حذف *</label><select id="delReason">' + rOpts + '</select></div>' +
      '<div class="fld"><label>توضیح تکمیلی (اختیاری)</label><input type="text" id="delNote" placeholder="جزئیات بیشتر..."></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#dc2626;border-color:#dc2626" onclick="ptfConfirmReasonedDelete(\'' + ptfOnClickArg(kind) + '\',\'' + ptfOnClickArg(id) + '\',\'' + ptfOnClickArg(label||id) + '\')">🗑 تأیید حذف و بایگانی</button></div></div></div>';
    window._curDelCb = callback;
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.ptfConfirmReasonedDelete = function (kind, id, label) {
    var reasonSel = document.getElementById('delReason');
    var noteInp = document.getElementById('delNote');
    var reason = reasonSel ? reasonSel.value : 'حذف دستی';
    var note = noteInp ? noteInp.value.trim() : '';
    
    var arc = getData('ptf_crm_deleted_archive');
    var user = (typeof curSession === 'function' && curSession().name) ? curSession().name : 'کاربر';
    var nowFa = (typeof faDateTime === 'function') ? faDateTime() : new Date().toLocaleDateString('fa-IR');
    
    arc.unshift({
      id: id,
      kind: kind,
      label: label,
      reason: reason,
      note: note,
      by: user,
      t: nowFa,
      iso: new Date().toISOString()
    });
    if (arc.length > 500) arc = arc.slice(0, 500); /* v14.0 US-264: هرس ۵۰۰تایی */
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_deleted_archive', arc, { reason: 'w4' }); else setData('ptf_crm_deleted_archive', arc);
    // Sprint 106: Auto-delete S3 attached files when record is deleted
    try {
      var rec = null;
      if (kind === 'RFQ') {
        rec = getData('ptf_crm_rfqs').filter(function(x){return x.cd===id;})[0];
        if (rec && rec.files) {
          Object.keys(rec.files).forEach(function(g) {
            (rec.files[g]||[]).forEach(function(f) {
              if (f.key) fetch('../api/storage.php?action=delete', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'key='+encodeURIComponent(f.key)});
            });
          });
        }
      }
    } catch(e) {}

    if (typeof audit === 'function') audit('بایگانی حذفیات', 'حذف ' + kind + ' «' + label + '» — دلیل: ' + reason, id);
    
    var md = document.querySelector('#panels .md-b:last-child');
    if (md) md.remove();
    if (typeof window._curDelCb === 'function') {
      try { window._curDelCb(); } catch(e){}
      /* v14.0 (US-260): وضعیت درخواست مرتبط یتیم نماند — رفرش گردش کار پس از حذف */
      try {
        if (typeof wfRefresh === 'function') {
          var _inqs = {};
          /* شماره درخواست مرتبط را از خود رکورد حذف‌شده و از همه اسناد باقیمانده استخراج کن */
          if (kind === 'RFQ') _inqs[id] = 1;
          getData('ptf_crm_offers').forEach(function (o) { if (o.inqNo) _inqs[o.inqNo] = 1; });
          getData('ptf_crm_rfqs').forEach(function (r2) { _inqs[r2.cd] = 1; if (r2.inqNo) _inqs[r2.inqNo] = 1; });
          Object.keys(_inqs).forEach(function (q) { try { wfRefresh(q, 'حذف سند (' + kind + ' ' + id + ')'); } catch (e2) {} });
        }
      } catch (eW) {}
    }
    if (typeof ptfToast === 'function') ptfToast('رکورد حذف و دلیل آن در بایگانی آماری ثبت شد ✅', 'ok');
  };

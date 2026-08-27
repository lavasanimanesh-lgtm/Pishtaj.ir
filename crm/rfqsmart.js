/* =====================================================================
   PTF CRM — Sprint 74 (rfqsmart.js)
   US-131: استعلام هوشمند از تامین‌کنندگان
   - استخراج اقلام از پیوست (اکسل/CSV مستقیم + PDF/عکس → صف بازبینی/LLM)
   - اکسل پاک بدون داده کارفرما (AC2)
   - پیشنهادگر تامین‌کننده امتیازدهی‌شده (AC3)
   - فرم استعلام PDF رسمی PTF-RFQS (AC4)
   - ارسال ایمیل/واتساپ + رهگیری پاسخ (AC5/AC6)
   - Human-in-the-loop: هیچ ارسالی بدون تایید کاربر (AC7)
   ===================================================================== */
(function () {
  'use strict';

  var CATS_MAP = [
    { k: /لوله|پایپ|فلنج|اتصال|pipe|flange|fitting|elbow|زانو|تی|رد[یو]وسر/i, cat: 'پایپینگ' },
    { k: /شیر|ولو|valve|گیت|گلوب|بال|چک|butterfly|پروانه/i, cat: 'شیرآلات' },
    { k: /ترانسمیتر|گیج|فلومتر|ابزار دقیق|transmitter|gauge|flow|level|pressure sw/i, cat: 'ابزار دقیق' },
    { k: /کابل|تابلو|برق|کلید|سوئیچ|switchgear|cable|breaker|درایو|اینورتر/i, cat: 'برق' },
    { k: /پمپ|کمپرسور|pump|compressor|الکتروموتور|motor/i, cat: 'پمپ و کمپرسور' },
    { k: /گسکت|واشر|آب‌?بند|gasket|seal|پیچ|مهره|bolt|nut|stud/i, cat: 'گسکت و آب‌بندی' }
  ];

  function detectCat(text) {
    for (var i = 0; i < CATS_MAP.length; i++) if (CATS_MAP[i].k.test(text)) return CATS_MAP[i].cat;
    return '';
  }

  function rfqsSerial(list) {
    list = Array.isArray(list) ? list : getData('ptf_crm_rfqsmart');
    var max = 0;
    var yr = faYear();
    list.forEach(function (r) { var m = (r.no || '').match(new RegExp('^PTF-RFQS-' + yr + '-(\\d+)$')); if (m && +m[1] > max) max = +m[1]; });
    return 'PTF-RFQS-' + yr + '-' + String(max + 1).padStart(3, '0');
  }

  var _st = null; // state ویزارد جاری

  /* v34.4.43: جستجوی جامع و کنترل درخواست تامین تکراری بر مبنای aliasهای
     درخواست داخلی (cd) و شماره درخواست کارفرما (inqNo). */
  function rfqsSearchNorm(v) {
    var fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩';
    return String(v == null ? '' : v)
      .replace(/[۰-۹]/g, function (d) { return fa.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return ar.indexOf(d); })
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200e\u200f]/g, ' ')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function rfqsSourceRecord(src) {
    if (!src) return null;
    return (getData('ptf_crm_rfqs') || []).filter(function (r) { return r && (r.cd === src || r.inqNo === src); })[0] || null;
  }
  function rfqsSourceAliases(src) {
    var seen = {}, out = [];
    function add(v) { v = String(v || '').trim(); if (v && !seen[v]) { seen[v] = 1; out.push(v); } }
    add(src);
    try { if (typeof ptfInqAliases === 'function') (ptfInqAliases(src) || []).forEach(add); } catch (eAlias) {}
    var parent = rfqsSourceRecord(src);
    if (parent) { add(parent.cd); add(parent.inqNo); }
    return out;
  }
  function rfqsSameSource(a, b) {
    if (!a || !b) return false;
    var aa = rfqsSourceAliases(a), bb = rfqsSourceAliases(b);
    return aa.some(function (x) { return bb.indexOf(x) > -1; });
  }
  window.ptfRfqsExistingForSource = function (src, excludeNo) {
    if (!src) return [];
    return (getData('ptf_crm_rfqsmart') || []).filter(function (r) {
      return r && r.no !== excludeNo && r.srcRfq && rfqsSameSource(r.srcRfq, src);
    });
  };
  function rfqsSourceCaption(src) {
    var p = rfqsSourceRecord(src);
    if (!p) return src || 'بدون منبع';
    return (p.cd || src) + (p.inqNo && p.inqNo !== p.cd ? (' | شماره کارفرما: ' + p.inqNo) : '') + (p.co ? (' | ' + p.co) : '');
  }
  window.ptfRfqsFilterRecords = function (list, query) {
    var q = rfqsSearchNorm(query);
    if (!q) return (list || []).slice();
    return (list || []).filter(function (r) {
      var p = rfqsSourceRecord(r.srcRfq), statusFa = ({ draft: 'پیش نویس', sent: 'ارسال شده', done: 'جمع بندی شده' })[r.st] || '';
      var values = [
        r.no, r.srcRfq, r.duplicateOf, r.st, statusFa, r.t, r.by, r.deadline,
        p && p.cd, p && p.inqNo, p && p.co, p && p.subj, p && p.con, p && p.ca, p && p.stxt
      ];
      (r.items || []).forEach(function (it) { values.push(it && (it.name || it.nm), it && (it.spec || it.st || it.desc), it && (it.model || it.md), it && (it.brand || it.br), it && (it.unit || it.un), it && (it.pcode || it.cd)); });
      (r.targets || []).forEach(function (t) { values.push(t && t.co, t && t.cd); });
      return rfqsSearchNorm(values.filter(Boolean).join(' | ')).indexOf(q) > -1;
    });
  };
  function rfqsDuplicateApprovalKey(src) { return rfqsSourceAliases(src).sort().join('|'); }
  function rfqsSetStateSource(src) {
    src = src || '';
    if (_st && _st.srcRfq && !rfqsSameSource(_st.srcRfq, src)) {
      delete _st._duplicateApprovedSource;
      delete _st.duplicateOf;
      delete _st.duplicateConfirmedAt;
      delete _st.duplicateConfirmedBy;
    }
    if (_st) _st.srcRfq = src;
  }
  function rfqsOpenExistingAfterCancel(existing, triggerEl) {
    var dlg = triggerEl && triggerEl.closest ? triggerEl.closest('.md-b') : null;
    if (!dlg) {
      var srcEl = document.getElementById('rqsSrc');
      dlg = srcEl && srcEl.closest ? srcEl.closest('.md-b') : null;
    }
    if (dlg) dlg.remove();
    var switched = false;
    try {
      if (window.ptfActivePanel !== 'rfqs' && typeof goPanelByName === 'function') { goPanelByName('rfqs'); switched = true; }
      else renderRfqSmart();
    } catch (eRender) {}
    setTimeout(function () { if (existing && typeof rfqsOpen === 'function') rfqsOpen(existing.no); }, switched ? 350 : 0);
  }
  function rfqsGuardDuplicateSource(src, currentNo, triggerEl) {
    if (!src) return true;
    var existing = window.ptfRfqsExistingForSource(src, currentNo);
    if (!existing.length) return true;
    var approvalKey = rfqsDuplicateApprovalKey(src);
    if (_st && _st._duplicateApprovedSource === approvalKey) return true;
    var first = existing[0], nums = existing.map(function (r) { return r.no; }).join('، ');
    var makeAnother = confirm('⚠️ برای «' + rfqsSourceCaption(src) + '» قبلاً ' + existing.length + ' درخواست تامین ثبت شده است:\n' + nums + '\n\nآیا با وجود درخواست قبلی، درخواست تامین جدید دیگری ثبت شود؟\n\nتأیید = ثبت درخواست جدید\nانصراف = باز کردن درخواست تامین قبلی');
    if (makeAnother) {
      if (_st) {
        _st._duplicateApprovedSource = approvalKey;
        _st.duplicateOf = first.no;
        _st.duplicateConfirmedAt = new Date().toISOString();
        try { _st.duplicateConfirmedBy = curSession().name || ''; } catch (eBy) {}
      }
      return true;
    }
    rfqsOpenExistingAfterCancel(first, triggerEl);
    return false;
  }
  window.ptfRfqsGuardDuplicateSource = rfqsGuardDuplicateSource;
  window.ptfRfqsOpenExisting = function (no) { if (no) rfqsOpenExistingAfterCancel({ no: no }, null); };

  /* ============ پنل ============ */
  window.buildRfqSmart = function () {
    return '<div class="ph"><h3>🛒 درخواست تامین</h3>' +
      '<div class="sb2"><button class="bt" onclick="rfqsNew()">+ تامین جدید</button></div></div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12.5px;color:#0c4a6e">' +
      'ℹ️ چرخه: پیوست/اقلام درخواست مشتری ← استخراج و پاکسازی (بدون نام و اطلاعات کارفرما) ← پیشنهاد بهترین تامین‌کنندگان ← فرم استعلام PDF ← ارسال ایمیل/واتساپ ← رهگیری پاسخ‌ها</div>' +
      '<div class="rfqs-list-toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
      '<input type="search" id="rfqsSearch" value="' + escP(window._rfqsListSearch || '') + '" placeholder="🔍 جستجو: شماره درخواست تامین، RFQ داخلی، شماره درخواست کارفرما، کالا، شرکت یا تامین‌کننده…" oninput="rfqsSetListSearch(this.value)" style="flex:1;min-width:260px;padding:9px 12px;border:1.5px solid var(--brd);border-radius:10px;font-family:inherit">' +
      '<span id="rfqsSearchCount" style="font-size:11.5px;color:#64748b"></span>' +
      '<button type="button" class="bt bt-o" style="padding:7px 10px;font-size:11.5px" onclick="rfqsClearListSearch()">پاک کردن</button></div>' +
      '<div id="rfqsWrap"></div>';
  };

  window.renderRfqSmart = function () {
    var el = document.getElementById('rfqsWrap');
    if (!el) return;
    var all = getData('ptf_crm_rfqsmart'), query = window._rfqsListSearch || '';
    var list = window.ptfRfqsFilterRecords(all, query);
    var countEl = document.getElementById('rfqsSearchCount');
    if (countEl) countEl.textContent = query ? (list.length.toLocaleString('fa-IR') + ' از ' + all.length.toLocaleString('fa-IR') + ' درخواست') : (all.length.toLocaleString('fa-IR') + ' درخواست تامین');
    var STL = { draft: '📝 پیش‌نویس', sent: '📤 ارسال شده', done: '✅ جمع‌بندی شده' };
    el.innerHTML = list.map(function (r) {
      var resp = (r.targets || []).filter(function (t) { return t.st === 'replied'; }).length;
      var parent = rfqsSourceRecord(r.srcRfq);
      var sourceMeta = r.srcRfq ? ('درخواست داخلی: ' + ((parent && parent.cd) || r.srcRfq) + ((parent && parent.inqNo && parent.inqNo !== parent.cd) ? (' | شماره درخواست کارفرما: ' + parent.inqNo) : '') + ((parent && parent.co) ? (' | کارفرما: ' + parent.co) : '')) : '';
      /* v34.4.45: فقط پیش‌نمایش نام کالا حذف شده است. مشخصات منبع، شماره درخواست
         کارفرما و نام کارفرما مانند v34.4.43 روی کارت باقی می‌مانند؛ اطلاعات کالا نیز
         همچنان در index جست‌وجو حضور دارد. */
      return '<div class="rfqs-list-card" style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-bottom:8px">' +
        '<div class="rfqs-list-head">' +
        '<div class="rfqs-list-copy" style="font-size:13px"><b dir="ltr">' + escP(r.no) + '</b>' + (r.duplicateOf ? ' <span class="bd" style="background:#fff7ed;color:#c2410c" title="با تایید کاربر در کنار درخواست قبلی ثبت شده">تکرارِ ' + escP(r.duplicateOf) + '</span>' : '') + (r.needsResend ? ' <span class="bd" style="background:#fee2e2;color:#b91c1c">⚠️ اقلام اصلاح شد — نیاز به ارسال مجدد</span>' : '') + (sourceMeta ? '<div class="rfqs-list-source" title="' + escP(sourceMeta) + '">🔗 ' + escP(sourceMeta) + '</div>' : '') +
        '<div class="rfqs-list-meta">' + (r.items || []).length + ' قلم | ' + (r.targets || []).length + ' تامین‌کننده | پاسخ: ' + resp + ' | ' + escP(r.t || '') + ' | ' + (STL[r.st] || '') + '</div></div>' +
        '<div class="rfqs-list-actions">' +
        '<button class="bt" style="padding:5px 11px;font-size:12px;background:#0e7490;color:#fff;font-weight:bold" onclick="rfqsToggleAccordion(\'' + ptfOnClickArg(r.no) + '\')">🔻 تخصیص و استعلام کشویی (بدون مودال)</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="rfqsOpen(\'' + ptfOnClickArg(r.no) + '\')">📂 باز کردن</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="rfqsEditItems(\'' + ptfOnClickArg(r.no) + '\')">✏️ ویرایش اقلام</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="rfqsPrintPreview(\'' + ptfOnClickArg(r.no) + '\',null)">🖨️ PDF</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#059669" onclick="rfqsShareToMessenger(\'' + ptfOnClickArg(r.no) + '\',null)">📤 پیام‌رسان</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#0e7490" onclick="rfqsPrintPickSupplier(\'' + ptfOnClickArg(r.no) + '\')">🖨 اختصاصی</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="rfqsXls(\'' + ptfOnClickArg(r.no) + '\')">⬇️ اکسل پاک</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#dc2626" onclick="rfqsDel(\'' + ptfOnClickArg(r.no) + '\')">🗑️</button>' +
        '</div></div>' +
        '<div id="rfqAcc_' + escP(r.no) + '" style="display:none;margin-top:12px;border-top:1px dashed var(--brd);padding-top:12px"></div>' +
        '</div>';
    }).join('') || (query
      ? '<div style="text-align:center;color:#64748b;padding:24px;border:1px dashed var(--brd);border-radius:12px">موردی مطابق «' + escP(query) + '» پیدا نشد.<br><button class="bt bt-o" style="margin-top:8px" onclick="rfqsClearListSearch()">نمایش همه درخواست‌ها</button></div>'
      : '<div style="text-align:center;color:#94a3b8;padding:24px">درخواست تامینی ثبت نشده — با «+ تامین جدید» شروع کنید</div>');
  };
  window.rfqsSetListSearch = function (value) {
    window._rfqsListSearch = String(value || '');
    renderRfqSmart();
  };
  window.rfqsClearListSearch = function () {
    window._rfqsListSearch = '';
    var input = document.getElementById('rfqsSearch'); if (input) { input.value = ''; input.focus(); }
    renderRfqSmart();
  };

  /* ============ US-216..218: پنل کشویی استعلام، تخصیص اقلام و مقایسه قیمت (بدون مودال) ============ */
  window.rfqsToggleAccordion = function(no) {
    var el = document.getElementById('rfqAcc_' + no);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    rfqsRenderAccordion(no);
  };

  window.rfqsRenderAccordion = function(no) {
    var el = document.getElementById('rfqAcc_' + no);
    if (!el) return;
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var sups = getData('ptf_crm_suppliers');
    
    var itemsRows = (r.items || []).map(function(it, i) {
      it.assignedSups = it.assignedSups || [];
      /* v34.1 US-SUP-SEARCH: منوی انتخاب تامین‌کننده با جستجوی زنده */
      var comboId = 'rqsSupCombo_' + i;
      var tagsId = 'rqsSupTags_' + i;
      var assignedTags = it.assignedSups.map(function(scd) {
        var sObj = sups.filter(function(x){ return x.cd === scd; })[0] || { co: scd };
        return '<span style="background:#e0e7ff;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:11px;display:inline-flex;align-items:center;gap:4px;margin-left:4px">' +
          escP(sObj.co || sObj.nm) + ' <a href="javascript:void(0)" onclick="rfqsRemoveSup(\'' + ptfOnClickArg(no) + '\',' + i + ',\'' + ptfOnClickArg(scd) + '\')" style="color:#dc2626;font-weight:bold;text-decoration:none">✕</a></span>';
      }).join('');
      return '<tr>' +
        '<td>' + (i+1) + '</td>' +
        '<td><b>' + escP(it.name) + '</b><br><small style="color:#64748b">' + escP(it.spec||'') + '</small></td>' +
        '<td>' + (it.qty||1) + ' ' + escP(it.unit||'عدد') + '</td>' +
        '<td><div id="' + tagsId + '">' + assignedTags + '</div>' +
        '<div id="' + comboId + '" class="ptf-sup-combo" style="position:relative;margin-top:4px">' +
        '<input type="text" placeholder="🔍 جستجوی تامین‌کننده..." ' +
        'onfocus="ptfSupComboOpen(this,\'' + ptfOnClickArg(no) + '\',' + i + ')" ' +
        'oninput="ptfSupComboFilter(this,\'' + ptfOnClickArg(no) + '\',' + i + ')" ' +
        'autocomplete="off" ' +
        'style="width:100%;padding:7px 10px;border:1.5px solid var(--brd,#cbd5e1);border-radius:8px;font-size:12px;box-sizing:border-box">' +
        '<div class="ptf-sup-combo-list" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;max-height:220px;overflow-y:auto;background:var(--crd,#fff);border:1.5px solid var(--brd,#cbd5e1);border-top:0;border-radius:0 0 8px 8px;box-shadow:0 8px 24px rgba(15,23,42,.12)"></div>' +
        '</div></td>' +
        '</tr>';
    }).join('');

    var isSent = r.st === 'sent' || r.st === 'replied' || r.priceCompareActive;
    
    var priceCompTable = '';
    if (isSent) {
      var allAssignedSups = {};
      (r.items || []).forEach(function(it) {
        (it.assignedSups || []).forEach(function(scd){ allAssignedSups[scd] = true; });
      });
      var supList = Object.keys(allAssignedSups).map(function(scd){ return sups.filter(function(x){ return x.cd === scd; })[0] || { cd: scd, co: scd }; });
      
      var compRows = (r.items || []).map(function(it, i) {
        it.quotes = it.quotes || {};
        var minP = Infinity, maxP = -1;
        supList.forEach(function(s) { var p = +(it.quotes[s.cd]||0); if (p > 0) { if (p < minP) minP = p; if (p > maxP) maxP = p; } });
        // v30.6.2: محاسبه سریع‌ترین تحویل برای هایلایت
        var minD = Infinity;
        supList.forEach(function(s){
          var dv = it.quoteDelivery && it.quoteDelivery[s.cd] ? parseInt(it.quoteDelivery[s.cd],10) : 0;
          if(dv>0 && dv<minD) minD=dv;
        });
        var tdSups = supList.map(function(s) {
          var p = +(it.quotes[s.cd]||0);
          var d = (it.quoteDelivery && it.quoteDelivery[s.cd]) ? it.quoteDelivery[s.cd] : '';
          var dv = parseInt(d,10)||0;
          var bg = '#fff', col = '#334155', bd = 'none';
          if (p > 0 && p === minP && minP !== maxP) { bg = '#d1fae5'; col = '#065f46'; bd = '1px solid #10b981'; }
          else if (p > 0 && p === maxP && minP !== maxP) { bg = '#fee2e2'; col = '#b91c1c'; bd = '1px solid #ef4444'; }
          // هایلایت سریع‌ترین تحویل - سبز کم‌رنگ
          var dBg = (dv>0 && dv===minD) ? 'background:#e0f2fe;border:1px solid #7dd3fc;' : '';
          var dBadge = (dv>0 && dv===minD) ? '<span style="font-size:9px;color:#0369a1">⚡ سریع‌ترین</span>' : '';
          return '<td style="background:' + bg + ';border:' + bd + ';padding:4px"><div style="display:flex;flex-direction:column;gap:3px"><input type="text" inputmode="numeric" data-rqsprice="' + escP(no) + '" value="' + (p > 0 ? p.toLocaleString('en-US') : '') + '" placeholder="قیمت (' + escP(r.quoteCur || 'IRR') + ')" oninput="rfqsUpdatePriceCompare(\'' + ptfOnClickArg(no) + '\',' + i + ',\'' + ptfOnClickArg(s.cd) + '\',this.value)" onblur="rfqsPriceBlur(\'' + ptfOnClickArg(no) + '\')" style="width:100px;padding:4px;border:1px solid #cbd5e1;border-radius:5px;direction:ltr;font-size:11px;color:' + col + ';font-weight:' + (p === minP && p>0 ? 'bold' : 'normal') + '"><div style="'+dBg+'border-radius:4px;padding:2px;display:flex;align-items:center;gap:2px"><input type="text" placeholder="تحویل (روز)" value="' + escP(d) + '" oninput="rfqsUpdateDeliveryTime(\'' + ptfOnClickArg(no) + '\',' + i + ',\'' + ptfOnClickArg(s.cd) + '\',this.value)" style="width:60px;padding:3px;border:1px dashed #94a3b8;border-radius:4px;direction:ltr;font-size:10px" title="زمان تحویل به روز">'+dBadge+'</div></div></td>';
        }).join('');
        return '<tr><td>' + (i+1) + '</td><td><b>' + escP(it.name) + '</b></td>' + tdSups + '</tr>';
      }).join('');

      var thSups = supList.map(function(s){ return '<th>' + escP(s.co || s.nm) + '</th>'; }).join('');
      /* v15.6 (US-387 ②): انتخاب ارز قیمت‌های خرید — IRR (ریال) پیش‌فرض؛ روی رکورد ذخیره و به قیمت مرجع کالا منتقل می‌شود */
      var qCur = r.quoteCur || 'IRR';
      var curList = (window.PTF_CURRENCIES || [{ id: 'IRR', lb: 'ریال ایران (IRR)' }, { id: 'EUR', lb: 'یورو (EUR)' }, { id: 'USD', lb: 'دلار آمریکا (USD)' }]);
      var qCurSel = '<label style="font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:6px">💱 ارز قیمت‌ها: <select onchange="rfqsSetQuoteCur(\'' + ptfOnClickArg(no) + '\',this.value)" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:7px;font-size:12px;direction:ltr">' +
        curList.map(function (c) { return '<option value="' + c.id + '"' + (qCur === c.id ? ' selected' : '') + '>' + c.lb + '</option>'; }).join('') + '</select></label>';
      // v30.6.3: خلاصه سریع‌ترین تحویل
      var deliverySummary = '';
      try {
        var avgDel = {};
        supList.forEach(function(s){
          var total=0, cnt=0;
          (r.items||[]).forEach(function(it){
            var d = it.quoteDelivery && it.quoteDelivery[s.cd] ? parseInt(it.quoteDelivery[s.cd],10) : 0;
            if(d>0){ total+=d; cnt++; }
          });
          if(cnt>0) avgDel[s.cd]={avg:Math.round(total/cnt), cnt:cnt, co:s.co||s.nm};
        });
        var sortedDel = Object.keys(avgDel).map(function(cd){ return {cd:cd, avg:avgDel[cd].avg, cnt:avgDel[cd].cnt, co:avgDel[cd].co}; }).sort(function(a,b){return a.avg-b.avg;});
        if(sortedDel.length){
          var fastest = sortedDel[0];
          deliverySummary = '<div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
            + '<span>⚡ <b>سریع‌ترین میانگین تحویل:</b> '+escP(fastest.co)+' — '+fastest.avg+' روز (از '+fastest.cnt+' قلم) — بقیه: '+sortedDel.map(function(x){ return escP(x.co)+': '+x.avg+' روز'; }).join(' | ')+'</span>'
            + '<span class="rfqs-price-actions" style="display:flex;gap:6px"><button class="bt bt-o" style="font-size:11px;padding:4px 10px;background:#dbeafe" onclick="rfqsHighlightFastest(\''+ptfOnClickArg(no)+'\')">🔍 نمایش سریع‌ترین</button>'
            + '<button class="bt bt-o" style="font-size:11px;padding:4px 10px;background:#d1fae5" onclick="rfqsSelectCheapest(\''+ptfOnClickArg(no)+'\')">💰 انتخاب ارزان‌ترین</button></span></div>';
        }
      } catch(e){}

      priceCompTable = '<div style="margin-top:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px"><h4 style="margin:0;color:#1e293b">💰 جدول مقایسه قیمت‌های دریافتی خرید (سبز 🟢 ارزان‌ترین / قرمز گران‌ترین / آبی 🔵 سریع‌ترین تحویل)</h4>' + qCurSel + '</div>' +
        deliverySummary +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead style="background:#e2e8f0"><tr><th>#</th><th>کالا</th>' + thSups + '</tr></thead><tbody>' + compRows + '</tbody></table></div>' +
        '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap">' +
        '<small style="color:#64748b">قیمت‌ها حین تایپ خودکار ذخیره می‌شوند؛ زمان تحویل برای مقایسه سریع‌ترین تامین‌کننده استفاده می‌شود. با «ثبت قیمت‌ها» قیمت مرجع کالاها هم به‌روزرسانی می‌شود.</small>' +
        '<button type="button" class="bt" style="background:#059669;color:#fff;font-weight:bold" onclick="rfqsCommitPrices(\'' + ptfOnClickArg(no) + '\')">💾 ثبت قیمت‌ها' + (r.pricesCommittedAt ? ' (آخرین ثبت: ' + escP(r.pricesCommittedAt) + ')' : '') + '</button></div></div>';
    }

    el.innerHTML = '<div style="background:#fcfcfc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">' +
      '<h4 style="margin:0 0 8px">📦 تخصیص اقلام استعلام به تامین‌کنندگان مرتبط</h4>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead style="background:#f1f5f9"><tr><th>#</th><th>شرح کالا</th><th>مقدار</th><th>تامین‌کنندگان اختصاص‌یافته</th></tr></thead><tbody>' + itemsRows + '</tbody></table></div>' +
      '<div class="rfqs-accordion-actions" style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap">' +
      '<button type="button" class="bt" style="background:#7c3aed;color:#fff;font-size:12px" onclick="rfqsGenDedicatedPdfs(\'' + ptfOnClickArg(no) + '\')">🖨️ تولید PDF اختصاصی هر تامین‌کننده (بدون ذخیره ابری)</button>' +
      (!isSent ? '<button type="button" class="bt" style="background:#059669;color:#fff;font-size:12.5px;font-weight:bold" onclick="rfqsMarkSentLive(\'' + ptfOnClickArg(no) + '\')">📤 ارسال به تامین‌کنندگان انجام شد (فعال‌سازی جدول ثبت قیمت)</button>' : '<span style="color:#059669;font-weight:bold">✅ ارسال‌شده (جدول مقایسه قیمت فعال است)</span>') +
      '</div>' + priceCompTable + '</div>';
  };

  window.rfqsHighlightFastest = function(no){
    try{
      var list=getData('ptf_crm_rfqsmart'); var r=list.filter(function(x){return x.no===no;})[0]; if(!r) return;
      var msg='سریع‌ترین تحویل per قلم:\n';
      (r.items||[]).forEach(function(it,i){
        var minD=Infinity, minSup='';
        Object.keys(it.quoteDelivery||{}).forEach(function(sc){
          var d=parseInt(it.quoteDelivery[sc],10)||0;
          if(d>0 && d<minD){ minD=d; var sup=(getData('ptf_crm_suppliers')||[]).filter(function(s){return s.cd===sc;})[0]; minSup=sup?sup.co:sc; }
        });
        if(minD!==Infinity) msg+=(i+1)+'. '+it.name+': '+minSup+' - '+minD+' روز\n';
      });
      alert(msg||'هنوز زمان تحویلی وارد نشده');
    }catch(e){ alert('خطا: '+e.message); }
  };
  window.rfqsSelectCheapest = function(no){
    try{
      var list=getData('ptf_crm_rfqsmart'); var r=list.filter(function(x){return x.no===no;})[0]; if(!r) return;
      var msg='ارزان‌ترین قیمت per قلم:\n';
      (r.items||[]).forEach(function(it,i){
        var minP=Infinity, minSup='';
        Object.keys(it.quotes||{}).forEach(function(sc){
          var p=+(it.quotes[sc]||0);
          if(p>0 && p<minP){ minP=p; var sup=(getData('ptf_crm_suppliers')||[]).filter(function(s){return s.cd===sc;})[0]; minSup=sup?sup.co:sc; }
        });
        if(minP!==Infinity) msg+=(i+1)+'. '+it.name+': '+minSup+' - '+minP.toLocaleString()+'\n';
      });
      alert(msg||'هنوز قیمتی وارد نشده');
    }catch(e){ alert('خطا: '+e.message); }
  };
  /* ===== v34.1 US-SUP-SEARCH: Searchable Supplier Combobox ===== */
  function supComboItems(q) {
    var sups = getData('ptf_crm_suppliers') || [];
    if (!q) return sups;
    var ql = q.toLowerCase();
    return sups.filter(function (s) {
      return (s.co && s.co.toLowerCase().indexOf(ql) > -1) ||
             (s.nm && s.nm.toLowerCase().indexOf(ql) > -1) ||
             (s.ca && s.ca.toLowerCase().indexOf(ql) > -1) ||
             (s.cd && s.cd.toLowerCase().indexOf(ql) > -1) ||
             (s.coEn && s.coEn.toLowerCase().indexOf(ql) > -1);
    });
  }

  function supComboRenderList(input, no, idx) {
    var wrap = input.closest('.ptf-sup-combo');
    var listEl = wrap && wrap.querySelector('.ptf-sup-combo-list');
    if (!listEl) return;
    var q = (input.value || '').trim();
    var results = supComboItems(q);
    if (!results.length) {
      listEl.innerHTML = '<div style="padding:10px 12px;color:#94a3b8;font-size:12px;text-align:center">تامین‌کننده‌ای یافت نشد</div>';
      listEl.style.display = 'block';
      return;
    }
    listEl.innerHTML = results.slice(0, 30).map(function (s) {
      return '<div class="ptf-sup-combo-opt" onmousedown="ptfSupComboPick(this,\'' + ptfOnClickArg(no) + '\',' + idx + ',\'' + ptfOnClickArg(s.cd) + '\')" ' +
        'style="padding:8px 12px;cursor:pointer;font-size:12.5px;border-bottom:1px solid var(--brd,#f1f5f9);display:flex;justify-content:space-between;align-items:center">' +
        '<span><b>' + escP(s.co || s.nm) + '</b>' +
        (s.ca ? ' <small style="color:#64748b">(' + escP(s.ca) + ')</small>' : '') + '</span>' +
        (s.ph ? '<small style="color:#94a3b8;direction:ltr">' + escP(s.ph) + '</small>' : '') +
        '</div>';
    }).join('') +
    (results.length > 30 ? '<div style="padding:6px 12px;color:#94a3b8;font-size:11px;text-align:center">و ' + (results.length - 30) + ' مورد دیگر — تایپ کنید...</div>' : '');
    listEl.style.display = 'block';
  }

  window.ptfSupComboOpen = function (input, no, idx) {
    supComboRenderList(input, no, idx);
  };
  window.ptfSupComboFilter = function (input, no, idx) {
    supComboRenderList(input, no, idx);
  };
  window.ptfSupComboPick = function (optEl, no, idx, supCd) {
    /* بستن لیست + خالی کردن ورودی */
    var wrap = optEl.closest('.ptf-sup-combo');
    var inp = wrap && wrap.querySelector('input');
    if (inp) inp.value = '';
    var listEl = wrap && wrap.querySelector('.ptf-sup-combo-list');
    if (listEl) listEl.style.display = 'none';
    /* ثبت تامین‌کننده */
    rfqsAssignSup(no, idx, supCd);
  };
  /* بستن لیست با blur (با تاخیر تا mousedown ثبت شود) */
  document.addEventListener('focusout', function (e) {
    if (!e.target || !e.target.closest || !e.target.closest('.ptf-sup-combo')) return;
    setTimeout(function () {
      var wrap = e.target.closest('.ptf-sup-combo');
      if (wrap && !wrap.contains(document.activeElement)) {
        var listEl = wrap.querySelector('.ptf-sup-combo-list');
        if (listEl) listEl.style.display = 'none';
      }
    }, 200);
  });

  /* hover highlight */
  (function () {
    var css = document.createElement('style');
    css.textContent = '.ptf-sup-combo-opt:hover{background:var(--bg,#f1f5f9)!important}';
    document.head.appendChild(css);
  })();

  /* v34.1: بروزرسانی فقط تگ‌های تامین‌کننده یک ردیف (بدون ری‌رندر کل جدول)
     — combobox باز می‌ماند و کاربر می‌تواند پشت سر هم انتخاب کند */
  function rfqsRefreshRowTags(no, idx) {
    var tagsEl = document.getElementById('rqsSupTags_' + idx);
    if (!tagsEl) { rfqsRenderAccordion(no); return; } /* fallback: اگر DOM پیدا نشد */
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r || !r.items[idx]) return;
    var sups = getData('ptf_crm_suppliers') || [];
    var assignedSups = r.items[idx].assignedSups || [];
    tagsEl.innerHTML = assignedSups.map(function(scd) {
      var sObj = sups.filter(function(x){ return x.cd === scd; })[0] || { co: scd };
      return '<span style="background:#e0e7ff;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:11px;display:inline-flex;align-items:center;gap:4px;margin-left:4px">' +
        escP(sObj.co || sObj.nm) + ' <a href="javascript:void(0)" onclick="rfqsRemoveSup(\'' + ptfOnClickArg(no) + '\',' + idx + ',\'' + ptfOnClickArg(scd) + '\')" style="color:#dc2626;font-weight:bold;text-decoration:none">✕</a></span>';
    }).join('');
  }

  window.rfqsAssignSup = function(no, idx, supCd) {
    if (!supCd) return;
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    r.items[idx].assignedSups = r.items[idx].assignedSups || [];
    if (r.items[idx].assignedSups.indexOf(supCd) < 0) r.items[idx].assignedSups.push(supCd);
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    rfqsRefreshRowTags(no, idx);
  };

  window.rfqsRemoveSup = function(no, idx, supCd) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var arr = r.items[idx].assignedSups || [];
    var pos = arr.indexOf(supCd);
    if (pos > -1) arr.splice(pos, 1);
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    rfqsRefreshRowTags(no, idx);
  };

  window.rfqsGenDedicatedPdfs = function(no) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var sups = getData('ptf_crm_suppliers');
    var supItemsMap = {};
    (r.items || []).forEach(function(it) {
      (it.assignedSups || []).forEach(function(scd) {
        supItemsMap[scd] = supItemsMap[scd] || [];
        supItemsMap[scd].push(it);
      });
    });
    var keys = Object.keys(supItemsMap);
    if (!keys.length) { alert('ابتدا حداقل برای یک کالا، تامین‌کننده مشخص کنید.'); return; }
    keys.forEach(function(scd) {
      var sObj = sups.filter(function(x){ return x.cd === scd; })[0] || { co: scd };
      var items = supItemsMap[scd];
      var tbody = items.map(function(it, i){ return '<tr><td>' + (i+1) + '</td><td><b>' + escP(it.name) + '</b></td><td dir="ltr">' + escP(it.spec||'—') + '</td><td>' + (it.qty||1) + '</td><td>' + escP(it.unit||'عدد') + '</td></tr>'; }).join('');
      var w = window.open('', '_blank');
      w.document.write('<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>' + escP(r.no + ' - ' + (sObj.co||sObj.nm)) + '</title><style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:right}th{background:#f1f5f9}</style></head><body>' +
        '<div style="text-align:center;border-bottom:2px solid #0e7490;padding-bottom:10px"><h2>شرکت پیشرو تجهیز فرتاک</h2><h3>استعلام قیمت خرید کالا — شماره: ' + escP(r.no) + '</h3></div>' +
        '<div style="margin-top:15px"><b>تامین‌کننده محترم: ' + escP(sObj.co||sObj.nm) + '</b><br>خواهشمند است قیمت پیشنهادی و زمان تحویل اقلام مشروحه زیر را اعلام فرمایید.</div>' +
        '<table><thead><tr><th>#</th><th>شرح کالا</th><th>مشخصات فنی</th><th>تعداد</th><th>واحد</th></tr></thead><tbody>' + tbody + '</tbody></table>' +
        '<script>setTimeout(function(){window.print()},600)<\/script></body></html>');
      w.document.close();
    });
    alert('✅ ' + keys.length + ' پنجره استعلام اختصاصی تامین‌کنندگان جهت چاپ/ذخیره PDF باز شد.');
  };

  window.rfqsMarkSentLive = function(no) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    r.st = 'sent'; r.needsResend = false;
    (r.targets || []).forEach(function (t) { delete t.itemsChangedAfterSend; });
    r.priceCompareActive = true;
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    if (r.srcRfq) {
      var rfqs = getData('ptf_crm_rfqs');
      var parent = rfqs.filter(function(x){ return x.cd === r.srcRfq || x.inqNo === r.srcRfq; })[0];
      if (parent) { parent.st = 'st2'; parent.stxt = '⏳ منتظر دریافت قیمت'; if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs); }
    }
    rfqsRenderAccordion(no);
    alert('🟢 وضعیت استعلام به «منتظر دریافت قیمت» تغییر کرد و جدول مقایسه قیمت‌های خرید فعال شد.');
  };

  /* v14.3 (US-373 ①): ورود قیمت بدون پرش فوکوس — oninput فقط داده را ذخیره می‌کند؛
     رندر مجدد (رنگ‌بندی ارزان/گران) به blur یا دکمه ثبت موکول شد. */
  /* v15.2 (US-385 ①): ارقام فارسی/عربی کیبورد → انگلیسی؛ قبلا regex فقط ارقام EN را نگه می‌داشت
     و «۱۲۳۴» به‌کل حذف می‌شد → «عددی ثبت نشده» */
  function rqsNum(val) {
    var s = String(val == null ? '' : val);
    if (typeof window.ptfToEnDigits === 'function') s = window.ptfToEnDigits(s);
    else {
      var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
      s = s.replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
    }
    return +s.replace(/[^\d]/g, '') || 0;
  }
  window.rfqsUpdateDeliveryTime = function(no, idx, supCd, val){
    try {
      var list=getData('ptf_crm_rfqsmart'); var r=list.filter(function(x){return x.no===no;})[0]; if(!r) return;
      r.items[idx].quoteDelivery=r.items[idx].quoteDelivery||{};
      r.items[idx].quoteDelivery[supCd]=String(val||'').trim();
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    } catch(e){}
  };
  window.rfqsUpdatePriceCompare = function(no, idx, supCd, val) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r || !r.items[idx]) return;
    r.items[idx].quotes = r.items[idx].quotes || {};
    var p = rqsNum(val);
    r.items[idx].quotes[supCd] = p;

    // ذخیره کمترین قیمت در buyquotes برای راهنمای قیمت فروش (US-219)
    var minP = Infinity, bestSup = '';
    Object.keys(r.items[idx].quotes).forEach(function(sc) {
      var qp = r.items[idx].quotes[sc];
      if (qp > 0 && qp < minP) { minP = qp; bestSup = sc; }
    });
    if (minP < Infinity) {
      r.items[idx].bestBuyPrice = minP;
      r.items[idx].bestBuySup = bestSup;
    }
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list); /* داده لحظه‌ای ذخیره — رفرش وسط کار = بدون از دست رفتن */
    window._rfqsCmpDirty = no; /* برای دکمه ثبت */
  };
  /* v15.6 (US-387 ②): ذخیره ارز قیمت‌های جدول مقایسه */
  window.rfqsSetQuoteCur = function (no, cur) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    r.quoteCur = cur;
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    if (typeof ptfToast === 'function') ptfToast('💱 ارز قیمت‌های خرید این استعلام: ' + cur, 'ok');
    rfqsRenderAccordion(no);
  };

  /* v14.3 (US-373): blur فیلد → رندر رنگ‌بندی (فوکوس دیگر داخل جدول نیست) */
  window.rfqsPriceBlur = function(no) {
    setTimeout(function () {
      var ae = document.activeElement;
      if (ae && ae.getAttribute && ae.getAttribute('data-rqsprice') === no) return; /* هنوز در جدول است */
      rfqsRenderAccordion(no);
    }, 120);
  };
  /* v14.3 (US-373 ②): دکمه «ثبت قیمت‌ها» — ذخیره قطعی + به‌روزرسانی قیمت مرجع کالا (US-335) */
  window.rfqsCommitPrices = function(no) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var cnt = 0;
    (r.items || []).forEach(function (it) {
      Object.keys(it.quotes || {}).forEach(function (sc) { if (+it.quotes[sc] > 0) cnt++; });
    });
    if (!cnt) { alert('هنوز قیمتی در جدول وارد نشده است.'); return; }
    /* قیمت مرجع کالا: از قیمت‌های جدول مقایسه (per-item) — دقیق‌تر از مسیر پاسخ کلی
       v15.2 (US-385 ②): ریشه «به جایی ارسال نمی‌شود» — تطبیق exact بود (x.nm === nm)؛
       کوچک‌ترین تفاوت فاصله/نیم‌فاصله/ارقام فا-EN = هیچ کالایی پیدا نمی‌شد و قیمت بی‌صدا گم می‌شد.
       حالا: تطبیق نرمال‌شده (dedupNorm) + ثبت خودکار کالاهای یافت‌نشده با تایید کاربر (هم‌راستا US-381). */
    var prods = getData('ptf_crm_products');
    var updated = 0, missing = [], ambiguous = [];
    (r.items || []).forEach(function (it) {
      var ps = Object.keys(it.quotes || {}).map(function (sc) { return +it.quotes[sc] || 0; }).filter(function (x) { return x > 0; });
      if (!ps.length) return;
      var avg = ps.reduce(function (a, b) { return a + b; }, 0) / ps.length;
      var nm = (it.name || it.nm || '').trim();
      if (!nm) return;
      /* BUG-PROC-LINK-287: duplicate product names are never resolved by first result. */
      var productMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false, reason:'resolver' };
      if (!productMatch.ok) {
        if (productMatch.reason === 'ambiguous') ambiguous.push({ it: it, avg: avg, n: ps.length });
        else missing.push({ it: it, avg: avg, n: ps.length });
        return;
      }
      var pd = productMatch.item;
      pd.pr = Math.round(avg);
      pd.prCur = r.quoteCur || 'IRR'; /* v15.6 US-387 ③: ارز قیمت مرجع */
      pd.refPriceAt = faDate();
      pd.refPriceSrc = 'جدول مقایسه ' + (r.no || '') + ' — میانگین ' + ps.length + ' قیمت (' + (r.quoteCur || 'IRR') + ')';
      updated++;
    });
    /* کالاهای یافت‌نشده → با تایید کاربر در ماژول کالا ثبت می‌شوند (قیمت به هیچ‌جا گم نمی‌شود) */
    var added = 0;
    if (missing.length && confirm('📦 ' + missing.length + ' قلم این جدول در ماژول کالا وجود ندارد:\n' +
        missing.slice(0, 6).map(function (m) { return '• ' + (m.it.name || ''); }).join('\n') + (missing.length > 6 ? '\n…' : '') +
        '\n\nهمین حالا با قیمت مرجعِ ثبت‌شده به ماژول کالا اضافه شوند؟ (توصیه می‌شود)')) {
      missing.forEach(function (m) {
        var cd2 = (window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-' + (1001 + prods.length));
        prods.push({ cd: cd2, nm: m.it.name || '', en: '', ca: (typeof ptfNormCat === 'function' && m.it.tp ? ptfNormCat(m.it.tp) : 'سایر'), st: m.it.spec || '', br: m.it.brand || '', md: m.it.model || '', un: m.it.unit || 'عدد',
          pr: Math.round(m.avg), prCur: r.quoteCur || 'IRR', refPriceAt: faDate(), refPriceSrc: 'جدول مقایسه ' + (r.no || '') + ' — میانگین ' + m.n + ' قیمت (' + (r.quoteCur || 'IRR') + ')',
          ds: 'ثبت خودکار از جدول مقایسه قیمت (US-385)', ts: new Date().toISOString(), ts0: new Date().toISOString() });
        added++;
      });
    }
    if (updated || added) { /* v34.8.23 (W1-iterate) */
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', prods, { reason: 'rfq-prices' });
      else setData('ptf_crm_products', prods); }
    r.pricesCommittedAt = faDateTime();
    r.pricesCommittedBy = curSession().name;
    r.referenceAmbiguousCount = ambiguous.length;
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    window._rfqsCmpDirty = null;
    audit('استعلام هوشمند', 'ثبت قیمت‌های جدول مقایسه ' + no + ' (' + cnt + ' قیمت' + (updated ? '، مرجع ' + updated + ' کالا به‌روز' : '') + (added ? '، ' + added + ' کالای جدید ثبت' : '') + (ambiguous.length ? '، ' + ambiguous.length + ' تطبیق مبهم بدون تغییر' : '') + ')', no);
    if (typeof ptfToast === 'function') ptfToast('💾 ' + cnt + ' قیمت ثبت شد' + (updated ? ' — قیمت مرجع ' + updated + ' کالا به‌روزرسانی شد 💰' : '') + (added ? ' — ' + added + ' کالای جدید با قیمت مرجع به ماژول کالا اضافه شد 📦' : '') + (ambiguous.length ? ' — ⚠️ ' + ambiguous.length + ' قلم مبهم بود و مرجع آن‌ها تغییر نکرد' : ''), ambiguous.length ? 'warn' : 'ok');
    rfqsRenderAccordion(no);
  };

  /* ============ گام ۱: منبع اقلام ============ */
  window.rfqsNew = function (sourceNo) {
    /* پنجره فوراً نمایش داده می‌شود و ساخت optionهای حجیم به task بعدی می‌رود؛
       نسخه قبلی پیش از نمایش modal برای هر RFQ دوباره کل دیتاست را می‌خواند (N+1). */
    var old = document.getElementById('rqsNewModal'); if (old) old.remove();
    var openToken = 'RQS-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    var shell = '<div class="md-b" id="rqsNewModal" data-rqs-open="' + openToken + '" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:680px"><h3>🛒 درخواست تامین جدید</h3><div id="rqsNewLoading" style="padding:24px;text-align:center;color:#0e7490">⏳ در حال آماده‌سازی فرم…</div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', shell);

    setTimeout(function () {
      var modal = document.getElementById('rqsNewModal'); if (!modal || modal.getAttribute('data-rqs-open') !== openToken) return;
      var smartList = getData('ptf_crm_rfqsmart') || [];
      var rfqs = getData('ptf_crm_rfqs') || [];
      var iq = getData('ptf_crm_inqitems') || [];
      var parentByAlias = {};
      rfqs.forEach(function (r) { if (r.cd) parentByAlias[r.cd] = r; if (r.inqNo) parentByAlias[r.inqNo] = r; });
      var sourceParent = parentByAlias[sourceNo] || null;
      var selectedSource = sourceParent ? sourceParent.cd : (sourceNo || '');
      _st = { no: rfqsSerial(smartList), items: [], targets: [], st: 'draft', t: faDateTime(), by: curSession().name, deadline: '', srcRfq: selectedSource };
      /* مسیرهای ورودی از پرونده/خرید واقعی نیز دقیقاً همان تصمیم تکراری را می‌گیرند. */
      if (selectedSource && !rfqsGuardDuplicateSource(selectedSource, _st.no, modal)) return;

      /* شمارش تامین‌های قبلی با یک پیمایش؛ حذف N+1 ناشی از ptfRfqsExistingForSource داخل map. */
      var existingByAlias = {};
      smartList.forEach(function (row) {
        if (!row || !row.srcRfq) return;
        var p = parentByAlias[row.srcRfq];
        var aliases = [row.srcRfq, p && p.cd, p && p.inqNo].filter(Boolean);
        var seen = {};
        aliases.forEach(function (a) { if (!seen[a]) { seen[a] = true; existingByAlias[a] = (existingByAlias[a] || 0) + 1; } });
      });
      var rfqOpts = '<option value="">— بدون اتصال —</option>' + rfqs.slice(0, 120).map(function (r) {
        var clientNo = r.inqNo && r.inqNo !== r.cd ? (' | شماره کارفرما: ' + r.inqNo) : '';
        var existingN = Math.max(existingByAlias[r.cd] || 0, existingByAlias[r.inqNo] || 0);
        return '<option value="' + escP(r.cd) + '"' + (selectedSource === r.cd ? ' selected' : '') + '>' + escP(r.cd + clientNo + ' — ' + (r.co || '')) + (existingN ? (' — ⚠️ ' + existingN + ' تامین ثبت‌شده') : '') + '</option>';
      }).join('');
      var inqNos = {};
      iq.forEach(function (x) { if (x && x.inqNo) inqNos[x.inqNo] = (inqNos[x.inqNo] || 0) + 1; });
      rfqs.forEach(function (r) { if (r && r.cd && Array.isArray(r.items) && r.items.length && !inqNos[r.cd]) inqNos[r.cd] = r.items.length; });
      var inqOpts = Object.keys(inqNos).map(function (k) { return '<option value="' + escP(k) + '"' + (selectedSource === k ? ' selected' : '') + '>' + escP(k) + ' (' + inqNos[k] + ' قلم)</option>'; }).join('');

      modal.querySelector('.md').innerHTML = '<h3>🛒 درخواست تامین — گام ۱: ورود اقلام</h3>' +
        '<div class="fld"><label>اتصال به درخواست مشتری (اختیاری — برای رهگیری)</label><select id="rqsSrc" onchange="rfqsSyncSrcInqUI()">' + rfqOpts + '</select></div>' +
        '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 10px;font-size:12px;color:#0c4a6e;margin:8px 0">یکی از روش‌های زیر را انتخاب کنید. در گام بعد همه اقلام قابل ویرایش، افزودن و حذف ردیف هستند.</div>' +
        '<div style="display:grid;gap:8px;margin:10px 0">' +
        (inqOpts ? '<div class="rfqs-import-row" style="display:flex;gap:6px;align-items:center"><select id="rqsInq" aria-label="انتخاب اقلام درخواست فروش" style="flex:1;padding:9px;border:1px solid var(--brd);border-radius:10px">' + inqOpts + '</select><button class="bt bt-o" onclick="rfqsFromInq()">📥 وارد کردن اقلام درخواست</button></div>' : '') +
        '<button class="bt bt-o" style="text-align:right;padding:12px" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'rqsFile\');else rfqsFromFile()">📊 <b>ورود فایل Excel / CSV با راهنما</b> — ستون‌ها و نمونه استاندارد نمایش داده می‌شود</button>' +
        '<button class="bt bt-o" style="text-align:right;padding:12px;color:#0e7490;border-color:#bae6fd" onclick="document.getElementById(\'rqsAiFile\').click()">🤖 <b>خواندن فایل با هوش مصنوعی</b> — PDF، تصویر، Excel، CSV یا متن</button>' +
        '<button class="bt bt-o" style="text-align:right;padding:12px;color:#6d28d9;border-color:#ddd6fe" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'rqsFile\')">📋 <b>راهنما و پرامپت آماده AI</b> — تبدیل فایل نامنظم به اکسل قابل ورود</button>' +
        '<button class="bt bt-o" style="text-align:right;padding:12px" onclick="rfqsManual()">✍️ <b>ورود و ویرایش دستی اقلام</b> — افزودن/حذف ردیف و اصلاح تمام ستون‌ها</button>' +
        '<input type="file" id="rqsFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="rfqsHandleFile(this)">' +
        '<input type="file" id="rqsAiFile" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md" style="display:none" onchange="rfqsReadFileAi(this)">' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button></div>';
      try { rfqsSyncSrcInqUI(); } catch (e0) {}
    }, 0);
  };

  /* v21.9 US-454: همگام‌سازی rqsSrc (اتصال درخواست) با rqsInq (اقلام) + قفل */
  window.rfqsSyncSrcInqUI = function () {
    var src = document.getElementById('rqsSrc');
    var inq = document.getElementById('rqsInq');
    if (!src) return;
    var v = src.value || '';
    rfqsSetStateSource(v);
    /* کنترل زودهنگام: کاربر پیش از ورود اقلام/انتخاب تامین‌کننده از درخواست قبلی
       مطلع می‌شود؛ انصراف او را مستقیم به همان درخواست هدایت می‌کند. */
    if (v && !rfqsGuardDuplicateSource(v, _st && _st.no, src)) return;
    if (!inq) return;
    if (!v) {
      inq.disabled = false;
      inq.style.background = '';
      inq.title = '';
      return;
    }
    /* اگر value دقیق نبود، با alias پیدا کن */
    var opts = inq.options || [];
    var found = false;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value === v) { found = true; break; }
    }
    if (!found) {
      try {
        var aliases = (typeof ptfInqAliases === 'function') ? ptfInqAliases(v) : [v];
        for (var j = 0; j < opts.length && !found; j++) {
          if (aliases.indexOf(opts[j].value) > -1) { v = opts[j].value; found = true; }
        }
        /* اگر اقلام با cd/inqNo دیگری است، option موقت */
        if (!found) {
          var nItems = 0;
          try {
            aliases.forEach(function (a) {
              nItems += getData('ptf_crm_inqitems').filter(function (x) { return x.inqNo === a; }).length;
            });
          } catch (eN) {}
          var opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v + (nItems ? (' (' + nItems + ' قلم)') : ' (از اتصال درخواست)');
          inq.insertBefore(opt, inq.firstChild ? inq.firstChild.nextSibling : null);
        }
      } catch (eA) {}
    }
    inq.value = v;
    inq.disabled = true;
    inq.style.background = '#f1f5f9';
    inq.title = 'قفل‌شده بر اساس «اتصال به درخواست مشتری» — برای تغییر، اتصال بالا را عوض کنید';
  };

  window.rfqsFromFile = function () { var el = document.getElementById('rqsFile'); if (el) el.click(); };

  function rfqsReadSpreadsheet(file, cb) {
    if (typeof XLSX === 'undefined') { cb(new Error('کتابخانه Excel بارگذاری نشده؛ صفحه را بازخوانی کنید')); return; }
    var rd = new FileReader();
    rd.onerror = function () { cb(new Error('خواندن فایل از دستگاه ناموفق بود')); };
    rd.onload = function () {
      try {
        var isCsv = /\.csv$/i.test(file.name || '');
        var wb = isCsv ? XLSX.read(String(rd.result || '').replace(/^\uFEFF/, ''), { type: 'string' }) : XLSX.read(new Uint8Array(rd.result), { type: 'array' });
        if (!wb.SheetNames || !wb.SheetNames.length) throw new Error('شیت قابل خواندن پیدا نشد');
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
          .map(function (row) { return (row || []).map(function (cell) { return String(cell == null ? '' : cell).trim(); }); });
        var items = rfqsParseRows(rows);
        if (!items.length) throw new Error('هیچ ردیف کالای معتبر پیدا نشد؛ ساختار ستون‌ها را با راهنما تطبیق دهید');
        cb(null, items);
      } catch (e) { cb(e instanceof Error ? e : new Error('پردازش فایل ناموفق بود')); }
    };
    if (/\.csv$/i.test(file.name || '')) rd.readAsText(file, 'utf-8'); else rd.readAsArrayBuffer(file);
  }

  function rfqsMergeItems(items, append) {
    _st.items = (_st.items || []).filter(function (x) { return String((x && x.name) || '').trim(); });
    if (!append) _st.items = [];
    (items || []).forEach(function (item) { _st.items.push(item); });
  }

  window.rfqsHandleFile = function (inp) {
    var f = (inp.files || [])[0]; if (!f) return;
    var srcEl = document.getElementById('rqsSrc');
    rfqsSetStateSource((_st && _st.srcRfq) || (srcEl || { value: '' }).value);
    if (!rfqsGuardDuplicateSource(_st.srcRfq, _st.no, srcEl)) { inp.value = ''; return; }
    rfqsReadSpreadsheet(f, function (err, items) {
      if (err) { alert('❌ ورود Excel/CSV ناموفق بود:\n' + err.message); return; }
      rfqsMergeItems(items, false);
      var modal = document.getElementById('rqsNewModal'); if (modal) modal.remove();
      rfqsReviewItems();
      if (typeof ptfToast === 'function') ptfToast('✅ ' + items.length + ' ردیف از ' + f.name + ' وارد شد؛ همه ردیف‌ها قابل ویرایش‌اند.', 'ok');
    });
    inp.value = '';
  };

  window.rfqsImportMoreFile = function (inp) {
    var f = (inp.files || [])[0]; if (!f) return;
    rfqsReadSpreadsheet(f, function (err, items) {
      if (err) { alert('❌ ورود Excel/CSV ناموفق بود:\n' + err.message); return; }
      rfqsMergeItems(items, true); rfqsRenderRows();
      if (typeof ptfToast === 'function') ptfToast('✅ ' + items.length + ' ردیف جدید به جدول اضافه شد.', 'ok');
    });
    inp.value = '';
  };

  window.rfqsReadFileAi = function (inp) {
    var f = (inp.files || [])[0]; if (!f) return;
    if (typeof window.ptfExtractRfqFileWithAi !== 'function') { alert('ماژول خواندن فایل AI بارگذاری نشده؛ صفحه را بازخوانی کنید.'); return; }
    var srcEl = document.getElementById('rqsSrc');
    if (srcEl) {
      rfqsSetStateSource(srcEl.value || '');
      if (!rfqsGuardDuplicateSource(_st.srcRfq, _st.no, srcEl)) { inp.value = ''; return; }
    }
    var stateNo = _st && _st.no;
    /* فایل ورودی به‌عنوان مرجع روی درخواست تامین نگه داشته می‌شود؛ استخراج AI و
       آپلود مستقل‌اند تا شکست یکی دیگری را از بین نبرد. */
    if (typeof uploadFile === 'function') uploadFile(f, 'rfqsmart', function (res) {
      if (!res || !res.ok || !res.key) { if (typeof ptfToast === 'function') ptfToast('⚠️ خواندن AI ادامه دارد ولی ذخیره فایل مرجع ناموفق بود: ' + ((res || {}).error || ''), 'warn'); return; }
      var ref = { name: res.name || f.name, key: res.key, size: f.size || 0, t: faDateTime(), by: curSession().name };
      if (_st && _st.no === stateNo) {
        _st.attachments = _st.attachments || [];
        if (!_st.attachments.some(function (x) { return x.key === ref.key; })) _st.attachments.push(ref);
        _st.attach = _st.attach || ref; /* سازگاری رکوردهای قدیمی */
      }
      var saved = getData('ptf_crm_rfqsmart') || [], hit = saved.filter(function (x) { return x.no === stateNo; })[0];
      if (hit) { hit.attachments = hit.attachments || []; if (!hit.attachments.some(function (x) { return x.key === ref.key; })) hit.attachments.push(ref); hit.attach = hit.attach || ref; if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', saved, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', saved); }
    });
    if (typeof ptfToast === 'function') ptfToast('🤖 در حال خواندن «' + f.name + '» و استخراج اقلام...', 'info');
    window.ptfExtractRfqFileWithAi(f, function (err, result) {
      if (err) { alert('❌ AI فایل را نخواند:\n' + err.message + '\n\nاز Excel راهنمادار، پرامپت آماده یا ورود دستی استفاده کنید.'); return; }
      if (!_st || _st.no !== stateNo) { if (typeof ptfToast === 'function') ptfToast('خواندن فایل پایان یافت ولی درخواست تامین دیگری باز شده است؛ فایل را دوباره انتخاب کنید.', 'warn'); return; }
      var items = result.rows.map(function (row) { return { name: row.nm, spec: row.spec, qty: row.qty, unit: row.un, type: row.tp, brand: row.brand, model: row.model, aiSource: result.sourceName }; });
      rfqsMergeItems(items, true);
      var newModal = document.getElementById('rqsNewModal');
      if (newModal) { newModal.remove(); rfqsReviewItems(); } else rfqsRenderRows();
      if (typeof ptfToast === 'function') ptfToast('✅ ' + items.length + ' قلم با AI اضافه شد؛ قبل از ادامه بازبینی کنید.', 'ok');
    });
    inp.value = '';
  };

  // تشخیص ستون‌ها (موتور US-124 بهبود یافته)
  window.rfqsParseRows = function (rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (c) { return String(c).toLowerCase(); });
    function find(keys) {
      for (var i = 0; i < head.length; i++) for (var j = 0; j < keys.length; j++)
        if (head[i].indexOf(keys[j]) > -1) return i;
      return -1;
    }
    var map = {
      name: find(['شرح', 'نام کالا', 'کالا', 'item', 'desc', 'name', 'material']),
      spec: find(['مشخصات', 'استاندارد', 'spec', 'standard', 'grade', 'سایز', 'size']),
      qty: find(['تعداد', 'مقدار', 'qty', 'quantity', 'q\'ty']),
      unit: find(['واحد', 'unit', 'uom']),
      type: find(['نوع', 'خانواده', 'type', 'family']),
      brand: find(['برند', 'سازنده', 'brand', 'make', 'manufacturer']),
      model: find(['مدل', 'پارت', 'part no', 'part number', 'model'])
    };
    var hasHeader = map.name > -1 || map.qty > -1;
    var body = hasHeader ? rows.slice(1) : rows;
    if (!hasHeader) map = { name: 0, spec: 1, qty: 2, unit: 3, type: 4, brand: 5, model: 6 };
    var items = [];
    body.forEach(function (r) {
      var nm = map.name > -1 ? (r[map.name] || '') : (r[0] || '');
      if (!String(nm).trim()) return;
      var rawQty = map.qty > -1 ? r[map.qty] : 1;
      var qty = typeof ptfNum === 'function' ? ptfNum(rawQty) : (+String(rawQty == null ? '' : rawQty).replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);}).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}).replace(/[^\d.\-]/g, '') || 1);
      items.push({
        name: String(nm).trim(),
        spec: map.spec > -1 ? String(r[map.spec] || '').trim() : '',
        qty: qty > 0 ? qty : 1,
        unit: map.unit > -1 ? (String(r[map.unit] || '').trim() || 'عدد') : 'عدد',
        type: map.type > -1 ? String(r[map.type] || '').trim() : '',
        brand: map.brand > -1 ? String(r[map.brand] || '').trim() : '',
        model: map.model > -1 ? String(r[map.model] || '').trim() : ''
      });
    });
    return items;
  };

  window.rfqsFromInq = function () {
    var srcEl = document.getElementById('rqsSrc');
    var inqEl = document.getElementById('rqsInq');
    var src = (srcEl || { value: '' }).value || '';
    var no = (inqEl || { value: '' }).value || '';
    /* اگر اتصال بالا انتخاب شده، همان مبناست (حتی اگر inq قفل/همگام باشد) */
    if (src) no = src;
    if (!no) { alert('ابتدا درخواست را از منوی اتصال یا فهرست اقلام انتخاب کنید'); return; }
    rfqsSetStateSource(src || no);
    if (srcEl && !_st.srcRfq) { /* no-op */ }
    if (srcEl && src) srcEl.value = src;
    if (!rfqsGuardDuplicateSource(_st.srcRfq, _st.no, srcEl || inqEl)) return;
    /* اقلام با همه aliasهای شماره درخواست */
    var aliases = (typeof ptfInqAliases === 'function') ? ptfInqAliases(no) : [no];
    _st.items = getData('ptf_crm_inqitems').filter(function (x) { return aliases.indexOf(x.inqNo) > -1; })
      .map(function (x) { return { name: x.en || x.nm, spec: x.st || x.spec || '', qty: x.qty || 1, unit: x.un || x.unit || 'عدد', type: x.tp || '', brand: x.brand || x.br || '', model: x.model || x.md || '', pcode: x.cd || '' }; });
    if (!_st.items.length) {
      var parent = (getData('ptf_crm_rfqs') || []).filter(function (x) { return aliases.indexOf(x.cd) > -1 || aliases.indexOf(x.inqNo) > -1; })[0];
      _st.items = ((parent && parent.items) || []).map(function (x) { return { name: x.en || x.nm || x.name || '', spec: x.st || x.spec || '', qty: x.qty || 1, unit: x.un || x.unit || 'عدد', type: x.tp || '', brand: x.brand || x.br || '', model: x.model || x.md || '', pcode: x.cd || '' }; });
    }
    if (!_st.items.length) { alert('برای این درخواست هنوز قلمی ثبت نشده است؛ از Excel، AI یا ورود دستی استفاده کنید.'); return; }
    hideModal();
    rfqsReviewItems();
  };

  window.rfqsManual = function () {
    var srcEl = document.getElementById('rqsSrc');
    rfqsSetStateSource(_st.srcRfq || (srcEl || { value: '' }).value);
    if (!rfqsGuardDuplicateSource(_st.srcRfq, _st.no, srcEl)) return;
    if (!_st.items.length) _st.items = [{ name: '', spec: '', qty: 1, unit: 'عدد', brand: '', model: '' }];
    var modal = document.getElementById('rqsNewModal'); if (modal) modal.remove();
    rfqsReviewItems();
  };

  window.rfqsEditItems = function (no) {
    var record = (getData('ptf_crm_rfqsmart') || []).filter(function (x) { return x.no === no; })[0];
    if (!record) { alert('درخواست تامین پیدا نشد'); return; }
    if (record.st === 'sent' && !confirm('این درخواست قبلاً ارسال شده است. اصلاح اقلام، PDF و استعلام بعدی را تغییر می‌دهد ولی سابقه ارسال حفظ می‌شود. ادامه می‌دهید؟')) return;
    _st = JSON.parse(JSON.stringify(record));
    _st.items = _st.items || [];
    _st.targets = _st.targets || [];
    _st._editing = true;
    _st._originalStatus = record.st || 'draft';
    _st._originalTargets = JSON.parse(JSON.stringify(_st.targets));
    document.querySelectorAll('.md-b').forEach(function (m) { if (m.id === 'rqsNewModal' || (m.hasAttribute && m.hasAttribute('data-rfqs-detail'))) m.remove(); });
    rfqsReviewItems();
  };

  /* ============ گام ۲: بازبینی اقلام (AC2/AC7 — اکسل پاک) ============ */
  window.rfqsReviewItems = function () {
    var srcLb = _st.srcRfq || '';
    var srcCo = '';
    try {
      if (srcLb) {
        var pr = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === srcLb || x.inqNo === srcLb; })[0];
        if (pr) srcCo = pr.co || '';
      }
    } catch (eS) {}
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this&&confirm(\'بستن بدون ذخیره؟\'))this.remove()"><div class="md" style="max-width:780px;max-height:92vh;overflow:auto">' +
      '<h3>🤖 گام ۲: بازبینی اقلام <small style="color:#94a3b8">(' + escP(_st.no) + ')</small></h3>' +
      (srcLb
        ? ('<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#0c4a6e;margin-bottom:8px">' +
          '🔗 درخواست متصل (قفل): <b dir="ltr">' + escP(srcLb) + '</b>' + (srcCo ? ' — ' + escP(srcCo) : '') +
          ' <small style="color:#64748b">| اقلام درخواست + اقلام اضافی از ماژول کالا مجاز است</small></div>')
        : '') +
      '<div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:8px 12px;font-size:12px;color:#854d0e;margin-bottom:8px">' +
      '🔒 محرمانگی: در فرم و اکسل ارسالی به تامین‌کننده فقط شرح/مشخصات/تعداد/واحد می‌رود — <b>هیچ نام یا اطلاعاتی از کارفرما درج نمی‌شود.</b></div>' +
      '<div id="rqsItemsWrap"></div>' +
      '<div class="rfqs-step-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding:8px;background:#f8fafc;border:1px solid var(--brd);border-radius:10px">' +
      '<button type="button" class="bt bt-o" style="font-size:12px" onclick="rfqsAddRow()">➕ افزودن ردیف جدید</button>' +
      '<button type="button" class="bt bt-o" style="font-size:12px;color:#7c3aed;border-color:#ddd6fe" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'rqsMoreXls\');else document.getElementById(\'rqsMoreXls\').click()">📊 افزودن از Excel با راهنما</button>' +
      '<button type="button" class="bt bt-o" style="font-size:12px;color:#0e7490;border-color:#bae6fd" onclick="document.getElementById(\'rqsMoreAi\').click()">🤖 افزودن با خواندن فایل AI</button>' +
      '<button type="button" class="bt bt-o" style="font-size:12px;color:#6d28d9;border-color:#ddd6fe" onclick="if(typeof ptfShowExcelGuidelineModal===\'function\')ptfShowExcelGuidelineModal(\'INQ\',\'rqsMoreXls\')">📋 راهنما / پرامپت آماده</button>' +
      '<button type="button" class="bt bt-o" style="font-size:12px;color:#059669;border-color:#a7f3d0" onclick="rfqsOpenProductPicker()">📦 افزودن از ماژول کالا</button>' +
      '<input type="file" id="rqsMoreXls" accept=".xlsx,.xls,.csv" style="display:none" onchange="rfqsImportMoreFile(this)">' +
      '<input type="file" id="rqsMoreAi" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.md" style="display:none" onchange="rfqsReadFileAi(this)">' +
      '</div>' +
      '<div class="fr" style="margin-top:12px"><div class="fld"><label>مهلت پاسخ تامین‌کننده</label><select id="rqsDl"><option value="24 ساعت"' + (_st.deadline === '24 ساعت' ? ' selected' : '') + '>۲۴ ساعت</option><option value="48 ساعت"' + (!_st.deadline || _st.deadline === '48 ساعت' ? ' selected' : '') + '>۴۸ ساعت</option><option value="72 ساعت"' + (_st.deadline === '72 ساعت' ? ' selected' : '') + '>۷۲ ساعت</option><option value="1 هفته"' + (_st.deadline === '1 هفته' ? ' selected' : '') + '>۱ هفته</option></select></div><div class="fld"></div></div>' +
      '<div class="rfqs-step-footer" style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="if(confirm(\'انصراف؟\'))this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" onclick="rfqsToTargets()">ادامه: انتخاب تامین‌کنندگان ←</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    rfqsRenderRows();
  };

  window.rfqsRenderRows = function () {
    var el = document.getElementById('rqsItemsWrap');
    if (!el) return;
    var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead style="background:#f1f5f9"><tr><th>#</th><th style="min-width:180px">شرح کالا</th><th style="min-width:90px">برند</th><th style="min-width:100px">مدل / پارت‌نامبر</th><th style="min-width:160px">مشخصات فنی</th><th>تعداد</th><th>واحد</th><th>عملیات ردیف</th></tr></thead><tbody>';
    _st.items.forEach(function (it, i) {
      h += '<tr><td>' + (i + 1) + '</td>' +
        '<td><input aria-label="شرح کالای ردیف ' + (i + 1) + '" type="text" value="' + escP(it.name) + '" oninput="_stU(' + i + ',\'name\',this.value)" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px"></td>' +
        '<td><input aria-label="برند ردیف ' + (i + 1) + '" type="text" value="' + escP(it.brand || '') + '" oninput="_stU(' + i + ',\'brand\',this.value)" style="width:90px;padding:5px;border:1px solid var(--brd);border-radius:6px;direction:ltr"></td>' +
        '<td><input aria-label="مدل ردیف ' + (i + 1) + '" type="text" value="' + escP(it.model || '') + '" oninput="_stU(' + i + ',\'model\',this.value)" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px;direction:ltr"></td>' +
        '<td><input aria-label="مشخصات فنی ردیف ' + (i + 1) + '" type="text" value="' + escP(it.spec) + '" oninput="_stU(' + i + ',\'spec\',this.value)" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px;direction:ltr"></td>' +
        '<td><input aria-label="تعداد ردیف ' + (i + 1) + '" type="number" value="' + (it.qty || 1) + '" oninput="_stU(' + i + ',\'qty\',this.value)" style="width:64px;padding:5px;border:1px solid var(--brd);border-radius:6px"></td>' +
        '<td><input aria-label="واحد ردیف ' + (i + 1) + '" type="text" value="' + escP(it.unit) + '" oninput="_stU(' + i + ',\'unit\',this.value)" style="width:64px;padding:5px;border:1px solid var(--brd);border-radius:6px"></td>' +
        '<td style="white-space:nowrap"><button type="button" class="bt bt-o" onclick="rfqsDuplicateRow(' + i + ')" style="padding:2px 6px;font-size:10.5px;color:#0e7490" title="کپی این ردیف">＋ کپی</button> <button type="button" class="bt bt-o" onclick="rfqsDelRow(' + i + ')" style="padding:2px 6px;font-size:10.5px;color:#dc2626" title="حذف این ردیف">🗑 حذف</button></td></tr>';
    });
    el.innerHTML = h + '</tbody></table></div>';
  };
  window._stU = function (i, f, v) { _st.items[i][f] = f === 'qty' ? (+v || 1) : v; };
  window.rfqsAddRow = function () { _st.items.push({ name: '', spec: '', qty: 1, unit: 'عدد', brand: '', model: '' }); rfqsRenderRows(); };
  window.rfqsDuplicateRow = function (i) { if (!_st.items[i]) return; var copy = JSON.parse(JSON.stringify(_st.items[i])); _st.items.splice(i + 1, 0, copy); rfqsRenderRows(); };
  window.rfqsDelRow = function (i) { _st.items.splice(i, 1); if (!_st.items.length) _st.items.push({ name: '', spec: '', qty: 1, unit: 'عدد', brand: '', model: '' }); rfqsRenderRows(); };

  /* v21.9 US-454: افزودن از ماژول کالا به اقلام درخواست تامین */
  window.rfqsOpenProductPicker = function () {
    var prods = getData('ptf_crm_products');
    if (!prods.length) { alert('ابتدا در ماژول کالاها، کالا ثبت کنید.'); return; }
    var html = '<div class="md-b" id="rqsProdPick" style="display:grid;z-index:1900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto" onclick="event.stopPropagation()">'
      + '<h3>📦 افزودن از ماژول کالا به درخواست تامین</h3>'
      + '<div style="font-size:12.5px;color:#475569;margin-bottom:10px">اقلام انتخابی <b>علاوه بر</b> اقلام درخواست به جدول گام ۲ اضافه می‌شوند.</div>'
      + '<input type="text" id="rqsPickSrch" placeholder="جستجو: کد، شرح، برند، دسته..." oninput="rfqsRenderProductPicker()" style="width:100%;padding:8px 12px;border:1.5px solid var(--brd);border-radius:10px;margin-bottom:10px;box-sizing:border-box">'
      + '<div class="tb2" style="max-height:360px;overflow:auto"><table><thead><tr><th style="width:34px">#</th><th>کد</th><th>شرح</th><th>دسته</th><th>واحد</th></tr></thead><tbody id="rqsPickTb"></tbody></table></div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px;flex-wrap:wrap">'
      + '<span id="rqsPickCount" style="font-size:12px;color:#0e7490;font-weight:800">۰ کالا</span>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="bt bt-o" onclick="var m=document.getElementById(&quot;rqsProdPick&quot;);if(m)m.remove()">انصراف</button>'
      + '<button class="bt" style="background:#059669" onclick="rfqsInsertPickedProducts()">➕ درج در اقلام تامین</button>'
      + '</div></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    rfqsRenderProductPicker();
  };
  window.rfqsRenderProductPicker = function () {
    var tb = document.getElementById('rqsPickTb');
    if (!tb) return;
    var q = ((document.getElementById('rqsPickSrch') || {}).value || '').trim().toLowerCase();
    var prods = getData('ptf_crm_products') || [];
    var list = prods.filter(function (p) {
      if (!q) return true;
      if (typeof ptfProdSearchMatch === 'function') return ptfProdSearchMatch(p, q);
      return ((p.cd || '') + ' ' + (p.nm || '') + ' ' + (p.en || '') + ' ' + (p.br || '') + ' ' + (p.ca || '') + ' ' + (p.st || '')).toLowerCase().indexOf(q) > -1;
    });
    tb.innerHTML = list.map(function (p) {
      return '<tr><td><input type="checkbox" class="rqs-pick-chk" value="' + escP(p.cd || '') + '" onchange="rfqsUpdatePickCount()"></td>'
        + '<td dir="ltr"><b style="color:#7c3aed">' + escP(p.cd || '') + '</b></td>'
        + '<td>' + escP(p.nm || '') + (p.st ? (' <small style="color:#64748b">[' + escP(p.st) + ']</small>') : '') + '</td>'
        + '<td>' + escP(p.ca || '-') + '</td><td>' + escP(p.un || 'عدد') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">کالایی یافت نشد</td></tr>';
    rfqsUpdatePickCount();
  };
  window.rfqsUpdatePickCount = function () {
    var n = document.querySelectorAll('.rqs-pick-chk:checked').length;
    var el = document.getElementById('rqsPickCount');
    if (el) el.textContent = n + ' کالا انتخاب شده';
  };
  window.rfqsInsertPickedProducts = function () {
    if (!_st) return;
    var cds = [];
    document.querySelectorAll('.rqs-pick-chk:checked').forEach(function (ch) { if (ch.value) cds.push(ch.value); });
    if (!cds.length) { alert('حداقل یک کالا را انتخاب کنید'); return; }
    var prods = getData('ptf_crm_products') || [];
    var added = 0;
    cds.forEach(function (cd) {
      var p = prods.filter(function (x) { return x.cd === cd; })[0];
      if (!p) return;
      _st.items = _st.items || [];
      _st.items.push({
        name: p.nm || p.en || cd,
        spec: p.st || p.ds || '',
        qty: 1,
        unit: p.un || 'عدد',
        brand: p.br || '',
        model: p.md || '',
        pcode: p.cd || '',
        fromCatalog: true
      });
      added++;
    });
    var m = document.getElementById('rqsProdPick');
    if (m) m.remove();
    rfqsRenderRows();
    if (typeof ptfToast === 'function') ptfToast('✅ ' + added + ' کالا از ماژول کالا به اقلام تامین اضافه شد', 'ok');
  };

  /* ============ گام ۳: پیشنهادگر تامین‌کننده (AC3) ============ */
  window.rfqsScoreSuppliers = function (items) {
    var sups = getData('ptf_crm_suppliers');
    var bq = getData('ptf_crm_buyquotes');
    var allText = items.map(function (i) { return i.name + ' ' + i.spec; }).join(' ');
    var cat = detectCat(allText);
    return sups.map(function (s) {
      var score = 0, why = [];
      // تطبیق دسته
      if (cat && (s.ca || '').indexOf(cat) > -1) { score += 40; why.push('دسته منطبق: ' + cat); }
      else if (cat && detectCat(s.ca || '') === cat) { score += 30; why.push('دسته مشابه'); }
      // تطبیق برند/کلمات کلیدی
      var kw = (s.brands || s.ca || '').toLowerCase();
      var hits = 0;
      items.forEach(function (i) {
        String(i.name + ' ' + i.spec).toLowerCase().split(/[\s,،/]+/).forEach(function (w) {
          if (w.length > 2 && kw.indexOf(w) > -1) hits++;
        });
      });
      if (hits) { score += Math.min(25, hits * 5); why.push(hits + ' واژه منطبق'); }
      /* v16.5 (US-399 AC3): امتیاز تخصصی — برند (وزن بالا) > تجهیز (متوسط) > سابقه خرید موفق.
         تامین‌کننده بدون تخصص فقط از مسیرهای قبلی امتیاز می‌گیرد (AC5 — هیچ رفتاری نمی‌شکند) */
      if (typeof ptfSupSpecScore === 'function') {
        var sp = ptfSupSpecScore(s, items);
        if (sp.score) { score += sp.score; why = why.concat(sp.why); }
      }
      /* v16.6 (US-400): بونوس امتیاز وندور + ضریب اعتباردهی غیرنقدی (ابلاغ کارفرما) */
      if (typeof ptfSupScoreBonus === 'function') {
        var sb = ptfSupScoreBonus(s);
        if (sb.bonus) { score += sb.bonus; why.push(sb.why); }
      }
      // سابقه قیمت‌دهی
      var quotes = bq.filter(function (b) { return (b.sup || '') === s.co; }).length;
      if (quotes) { score += Math.min(25, quotes * 5); why.push(quotes + ' سابقه قیمت‌دهی'); }
      // تاییدشده از سایت
      if (s.src === 'site' && s.approvedBy) { score += 5; why.push('تاییدشده'); }
      // اطلاعات تماس کامل
      if (s.email || s.ph) score += 5;
      return { cd: s.cd, co: s.co, ph: s.ph || '', email: s.email || '', ca: s.ca || '', score: score, why: why.join('، ') || 'بدون سیگنال خاص' };
    }).sort(function (a, b) { return b.score - a.score; });
  };


  /* v21.7 US-452 / US-HT-v214-2: تامین‌کنندگان اخیر همین درخواست (srcRfq) */
  window.ptfRfqsRecentSuppliers = function (srcRfq, excludeNo) {
    if (!srcRfq) return [];
    var aliases = [srcRfq];
    try {
      if (typeof ptfInqAliases === 'function') aliases = ptfInqAliases(srcRfq);
      else {
        (getData('ptf_crm_rfqs') || []).forEach(function (r) {
          if (r.cd === srcRfq || r.inqNo === srcRfq) {
            if (r.cd && aliases.indexOf(r.cd) < 0) aliases.push(r.cd);
            if (r.inqNo && aliases.indexOf(r.inqNo) < 0) aliases.push(r.inqNo);
          }
        });
      }
    } catch (eA) {}
    function hitSrc(v) { return v && aliases.indexOf(v) > -1; }
    var map = {};
    function add(cd, co, ph, email, t, extraWhy) {
      if (!cd && !co) return;
      var key = cd || ('co:' + String(co || '').toLowerCase());
      if (!map[key]) {
        map[key] = { cd: cd || '', co: co || '', ph: ph || '', email: email || '', times: 0, lastAt: '', why: '' };
      }
      var row = map[key];
      row.times++;
      if (co && !row.co) row.co = co;
      if (ph && !row.ph) row.ph = ph;
      if (email && !row.email) row.email = email;
      if (cd && !row.cd) row.cd = cd;
      var ts = String(t || '');
      if (!row.lastAt || ts > row.lastAt) row.lastAt = ts;
      row.why = '🕒 اخیر این درخواست ×' + row.times + (extraWhy ? ' — ' + extraWhy : '');
    }
    try {
      (getData('ptf_crm_rfqsmart') || []).forEach(function (r) {
        if (!r || (excludeNo && r.no === excludeNo)) return;
        if (!hitSrc(r.srcRfq)) return;
        (r.targets || []).forEach(function (tg) {
          add(tg.cd, tg.co, tg.ph, tg.email, r.t || r.deadline || '', tg.st === 'replied' ? 'پاسخ‌داده' : '');
        });
      });
    } catch (e1) {}
    try {
      (getData('ptf_crm_buycmp') || []).forEach(function (c) {
        if (!c || !hitSrc(c.inqNo)) return;
        (c.purchases || c.items || []).forEach(function (p) {
          if (!p) return;
          add(p.supCd || p.cd || '', p.sup || p.supName || p.co || '', p.ph || '', p.email || '', p.t || c.t || '', 'خرید واقعی');
        });
        /* sometimes supplier on round quotes */
        (c.rounds || []).forEach(function (rd) {
          (rd.quotes || rd.rows || []).forEach(function (q) {
            if (q && (q.sup || q.co)) add(q.supCd || q.cd || '', q.sup || q.co, q.ph || '', q.email || '', c.t || '', 'مقایسه قیمت');
          });
        });
      });
    } catch (e2) {}
    /* enrich from suppliers master */
    try {
      var sups = getData('ptf_crm_suppliers') || [];
      Object.keys(map).forEach(function (k) {
        var row = map[k];
        var s = null;
        if (row.cd) s = sups.filter(function (x) { return x.cd === row.cd; })[0];
        if (!s && row.co) {
          s = sups.filter(function (x) {
            return x.co === row.co || (typeof dedupNorm === 'function' && dedupNorm(x.co) === dedupNorm(row.co));
          })[0];
        }
        if (s) {
          row.cd = s.cd || row.cd;
          row.co = s.co || row.co;
          row.ph = row.ph || s.ph || '';
          row.email = row.email || s.email || '';
        }
      });
    } catch (e3) {}
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (r) { return r.cd || r.co; })
      .sort(function (a, b) {
        if (b.times !== a.times) return b.times - a.times;
        return String(b.lastAt || '').localeCompare(String(a.lastAt || ''));
      })
      .slice(0, 12);
  };

  /* v21.2 US-402: فیلتر زنده + چیپ انتخاب + گروه‌بندی پیشنهاد/سایر */
  window.rfqsMatchSup = function (row, q) {
    if (!q) return true;
    q = String(q).trim();
    if (!q) return true;
    var blob = (row.co || '') + ' ' + (row.ca || '') + ' ' + (row.why || '') + ' ' + (row.email || '') + ' ' + (row.ph || '');
    var qCanon = (typeof ptfBrandCanon === 'function') ? ptfBrandCanon(q) : q;
    try {
      var full = (getData('ptf_crm_suppliers') || []).filter(function (s) { return s.cd === row.cd; })[0];
      if (full) {
        if (typeof ptfSupSpecBlob === 'function') blob += ' ' + ptfSupSpecBlob(full);
        else blob += ' ' + (full.brands || '') + ' ' + ((full.spBrands || []).join(' ')) + ' ' + ((full.spEquip || []).join(' ')) + ' ' + (full.coEn || '');
        if (typeof entityMatches === 'function' && entityMatches(full, q)) return true;
        if (typeof entityMatches === 'function' && qCanon && qCanon !== q && entityMatches(full, qCanon)) return true;
      }
    } catch (e) {}
    var nq = (typeof dedupNorm === 'function') ? dedupNorm(q) : q.toLowerCase();
    var nqc = (typeof dedupNorm === 'function') ? dedupNorm(qCanon) : String(qCanon || '').toLowerCase();
    var nb = (typeof dedupNorm === 'function') ? dedupNorm(blob) : blob.toLowerCase();
    return nb.indexOf(nq) > -1 || (nqc && nb.indexOf(nqc) > -1) || blob.toLowerCase().indexOf(q.toLowerCase()) > -1;
  };

  window.rfqsToTargets = function () {
    _st.items = _st.items.filter(function (i) { return i.name && i.name.trim(); });
    if (!_st.items.length) { alert('حداقل یک قلم لازم است'); return; }
    _st.deadline = (document.getElementById('rqsDl') || { value: '48 ساعت' }).value;
    var mds = document.querySelectorAll('.md-b');
    for (var _mi = mds.length - 1; _mi >= 0; _mi--) { if ((mds[_mi].style || {}).display !== 'none') { mds[_mi].remove(); break; } } /* v16.2 BUG-017 */

    var ranked = rfqsScoreSuppliers(_st.items);
    var top5 = {};
    if (!_st._editing) ranked.slice(0, 5).forEach(function (r) { top5[r.cd] = true; });
    _st._ranked = ranked;
    _st._sel = top5;
    /* هنگام اصلاح فقط تامین‌کنندگان قبلی پیش‌تیک می‌مانند؛ پیشنهاد top-5 نباید ناخواسته اضافه شود. */
    (_st._originalTargets || _st.targets || []).forEach(function (t) { if (t && t.cd) _st._sel[t.cd] = true; });
    _st._tgQ = '';
    _st._tgOtherOpen = false;
    /* v21.7 US-452: اخیر همین درخواست — نمایش + پیش‌تیک (قابل تغییر) */
    var recent = [];
    try { recent = ptfRfqsRecentSuppliers(_st.srcRfq, _st.no) || []; } catch (eR) { recent = []; }
    _st._recent = recent;
    if (!_st._editing) recent.forEach(function (r) {
      var key = r.cd || '';
      if (!key && r.co) {
        var hit = ranked.filter(function (x) { return x.co === r.co; })[0];
        if (hit) key = hit.cd;
      }
      if (key) _st._sel[key] = true;
    });

    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this&&confirm(\'بستن؟\'))this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>🤖 گام ۳: انتخاب تامین‌کنندگان</h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:8px">' + (_st._editing ? '💡 تامین‌کنندگان قبلی تیک خورده و قابل تغییرند؛ تامین‌کننده جدید فقط با انتخاب شما اضافه می‌شود.' : '💡 ۵ پیشنهاد برتر خودکار تیک خورده‌اند و قابل تغییر هستند.') + ' جستجوی زنده دوزبانه + بخش «تامین‌کنندگان اخیر همین درخواست».</div>' +
      '<div id="rqsTgChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;min-height:8px"></div>' +
      '<input type="search" id="rqsTgQ" placeholder="🔍 جستجو: نام، برند، تجهیز، زمینه… (زیمنس = Siemens)" ' +
      'oninput="rfqsSetSearch(this.value)" style="width:100%;padding:10px 12px;border:1px solid var(--brd);border-radius:12px;font-size:13px;margin-bottom:10px;box-sizing:border-box">' +
      '<div id="rqsTgWrap" style="max-height:380px;overflow:auto"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="rfqsReviewItems();this.closest(\'.md-b\').remove()">→ بازگشت به اقلام</button>' +
      '<button class="bt" onclick="rfqsFinalize()">ثبت و رفتن به ارسال ←</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    rfqsRenderTargets();
  };

  window.rfqsToggleSup = function (cd, on) {
    if (!_st._sel) _st._sel = {};
    _st._sel[cd] = !!on;
    rfqsRenderTargets();
  };

  window.rfqsSelectRecent = function (on) {
    if (!_st) return;
    _st._sel = _st._sel || {};
    (_st._recent || []).forEach(function (r) {
      var cd = r.cd;
      if (!cd && r.co && _st._ranked) {
        var hit = _st._ranked.filter(function (x) { return x.co === r.co; })[0];
        if (hit) cd = hit.cd;
      }
      if (cd) _st._sel[cd] = !!on;
    });
    rfqsRenderTargets();
  };

  /* v34.0.13-alpha (فاز ۱۰ — رفع باگ ناوبری/جستجوی تامین‌کنندگان در گام ۳):
     دسترسی مستقیم به `_st` (متغیر خصوصی داخل IIFE) از onclick/oninput inline شکست می‌خورد
     (ReferenceError: _st is not defined) → دکمهٔ «▼ نمایش» و جستجوی زنده کار نمی‌کردند.
     این دو wrapper سراسری، وضعیت را از داخل IIFE مدیریت می‌کنند (مثل الگوی rfqsToggleSup). */
  window.rfqsToggleOther = function () { _st._tgOtherOpen = !_st._tgOtherOpen; rfqsRenderTargets(); };
  window.rfqsSetSearch = function (v) { _st._tgQ = v; rfqsRenderTargets(); };

  window.rfqsRenderTargets = function () {
    var el = document.getElementById('rqsTgWrap');
    var chips = document.getElementById('rqsTgChips');
    if (!el) return;
    var ranked = _st._ranked || [];
    var q = _st._tgQ || '';
    var filtered = ranked.filter(function (r) { return rfqsMatchSup(r, q); });
    var smart = filtered.filter(function (r, i) {
      /* top-5 by original rank index */
      var oi = ranked.indexOf(r);
      return oi > -1 && oi < 5;
    });
    var others = filtered.filter(function (r) {
      var oi = ranked.indexOf(r);
      return !(oi > -1 && oi < 5);
    });

    function rowHtml(r, badgeHtml, bg, bd) {
      var cd = r.cd || '';
      return '<label style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border:1px solid ' + (bd || 'var(--brd)') + ';border-radius:11px;margin-bottom:6px;cursor:pointer;background:' + (bg || 'var(--crd,#fff)') + '">' +
        '<input type="checkbox" ' + (_st._sel[cd] ? 'checked' : '') + ' onchange="rfqsToggleSup(\'' + ptfOnClickArg(cd) + '\',this.checked)" style="margin-top:3px"' + (cd ? '' : ' disabled') + '>' +
        '<span style="flex:1;min-width:0"><b style="font-size:13px">' + escP(r.co) + '</b> ' + (badgeHtml || '') +
        '<span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px">' +
        (r.score != null ? ('امتیاز ' + r.score + ' — ') : '') + escP(r.why || '') +
        (r.email || r.ph ? ' | ' + (r.email ? '✉️ ' + escP(r.email) : '') + (r.ph ? ' 📱 ' + escP(r.ph) : '') : '') + '</span></span></label>';
    }

    /* recent rows aligned to ranked cds when possible */
    var recent = (_st._recent || []).map(function (r) {
      var hit = null;
      if (r.cd) hit = ranked.filter(function (x) { return x.cd === r.cd; })[0];
      if (!hit && r.co) hit = ranked.filter(function (x) { return x.co === r.co; })[0];
      return {
        cd: (hit && hit.cd) || r.cd || '',
        co: (hit && hit.co) || r.co,
        ph: r.ph || (hit && hit.ph) || '',
        email: r.email || (hit && hit.email) || '',
        score: hit ? hit.score : null,
        why: r.why || '🕒 اخیر این درخواست',
        times: r.times || 1
      };
    }).filter(function (r) { return rfqsMatchSup(r, q); });
    var recentCds = {};
    recent.forEach(function (r) { if (r.cd) recentCds[r.cd] = 1; });

    var h = '';
    if ((_st.srcRfq || recent.length) && !q) {
      h += '<div style="font-size:12.5px;font-weight:800;color:#0e7490;margin:4px 0 8px">🕒 تامین‌کنندگان اخیر همین درخواست (' + recent.length + ')' +
        (_st.srcRfq ? ' <small style="font-weight:600;color:#64748b">— ' + escP(_st.srcRfq) + '</small>' : '') + '</div>';
      if (recent.length) {
        h += '<div style="margin-bottom:6px"><button type="button" class="bt bt-o" style="padding:3px 10px;font-size:11.5px;color:#0e7490" onclick="rfqsSelectRecent(true)">✅ انتخاب همه اخیر</button> ' +
          '<button type="button" class="bt bt-o" style="padding:3px 10px;font-size:11.5px" onclick="rfqsSelectRecent(false)">پاک کردن اخیر</button></div>';
        h += recent.map(function (r) {
          return rowHtml(r, '<span class="bd" style="background:#e0f2fe;color:#0369a1">×' + (r.times || 1) + '</span>', '#f0f9ff', '#7dd3fc');
        }).join('');
      } else {
        h += '<div style="color:#94a3b8;font-size:12px;padding:6px 0;margin-bottom:8px">برای این درخواست سابقه تامین‌کننده ثبت نشده (اولین استعلام)</div>';
      }
    } else if (q && recent.length) {
      h += '<div style="font-size:12.5px;font-weight:800;color:#0e7490;margin:4px 0 8px">🕒 اخیر (فیلتر شده: ' + recent.length + ')</div>';
      h += recent.map(function (r) {
        return rowHtml(r, '<span class="bd" style="background:#e0f2fe;color:#0369a1">اخیر</span>', '#f0f9ff', '#7dd3fc');
      }).join('');
    }

    h += '<div style="font-size:12.5px;font-weight:800;color:#b45309;margin:4px 0 8px">⭐ پیشنهاد هوشمند (' + smart.length + ')</div>';
    h += smart.map(function (r) {
      var oi = ranked.indexOf(r);
      var badge = ' <span class="bd" style="background:#fef3c7;color:#b45309">پیشنهاد ' + (oi + 1) + '</span>' +
        (recentCds[r.cd] ? ' <span class="bd" style="background:#e0f2fe;color:#0369a1">اخیر</span>' : '');
      return rowHtml(r, badge, '#fff7ed', '#fdba74');
    }).join('') || '<div style="color:#94a3b8;font-size:12px;padding:6px 0">موردی در پیشنهادها با این جستجو نیست</div>';
    h += '<div style="margin:12px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<span style="font-size:12.5px;font-weight:800;color:#475569">سایر تامین‌کنندگان (' + others.length + ')</span>' +
      '<button type="button" class="bt bt-o" style="padding:3px 10px;font-size:11.5px" onclick="rfqsToggleOther()">' +
      (_st._tgOtherOpen ? '▲ جمع کردن' : '▼ نمایش') + '</button></div>';
    if (_st._tgOtherOpen || q) {
      h += others.map(function (r) { return rowHtml(r, recentCds[r.cd] ? '<span class="bd" style="background:#e0f2fe;color:#0369a1">اخیر</span>' : '', 'var(--crd,#fff)', 'var(--brd)'); }).join('') || '<div style="color:#94a3b8;font-size:12px;padding:6px 0">موردی نیست</div>';
    } else {
      h += '<div style="color:#94a3b8;font-size:11.5px;padding:4px 0">برای دیدن بقیه فهرست، «نمایش» را بزنید یا جستجو کنید</div>';
    }
    if (!ranked.length) h = '<div style="color:#94a3b8;text-align:center;padding:16px">تامین‌کننده‌ای ثبت نشده — ابتدا در ماژول تامین‌کنندگان اضافه کنید</div>';
    el.innerHTML = h;

    if (chips) {
      var selRows = ranked.filter(function (r) { return _st._sel[r.cd]; });
      chips.innerHTML = selRows.length
        ? selRows.map(function (r) {
            return '<span style="display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;border:1px solid #bbf7d0;color:#065f46;border-radius:999px;padding:4px 10px;font-size:12px">' +
              escP(r.co) +
              ' <button type="button" onclick="rfqsToggleSup(\'' + ptfOnClickArg(r.cd) + '\',false)" style="border:0;background:transparent;color:#b91c1c;cursor:pointer;font-weight:900;padding:0 2px" title="حذف">✕</button></span>';
          }).join('')
        : '<span style="font-size:11.5px;color:#94a3b8">هنوز تامین‌کننده‌ای انتخاب نشده</span>';
    }
  };

  window.rfqsFinalize = function () {
    var list = getData('ptf_crm_rfqsmart');
    var idx = -1;
    list.forEach(function (x, i) { if (x.no === _st.no) idx = i; });
    /* گارد نهایی race-safe: اگر از زمان گام اول دستگاه/کاربر دیگری برای همین درخواست
       رکورد ساخته باشد، دوباره تصمیم صریح می‌گیریم؛ «انصراف» قبلی را باز می‌کند. */
    if (idx === -1 && _st.srcRfq && !rfqsGuardDuplicateSource(_st.srcRfq, _st.no, document.getElementById('rqsTgList'))) return;
    var originalTargets = _st._originalTargets || _st.targets || [];
    var targets = _st._ranked.filter(function (r) { return _st._sel[r.cd]; }).map(function (r) {
      var oldTarget = originalTargets.filter(function (x) { return x && x.cd === r.cd; })[0];
      if (oldTarget) { oldTarget.co = r.co; oldTarget.ph = r.ph; oldTarget.email = r.email; return oldTarget; }
      return { cd: r.cd, co: r.co, ph: r.ph, email: r.email, st: 'pending', sends: [] };
    });
    if (!targets.length) { alert('حداقل یک تامین‌کننده انتخاب کنید'); return; }
    var wasEditing = !!_st._editing;
    var originalStatus = _st._originalStatus || _st.st || 'draft';
    _st.targets = targets;
    if (wasEditing && ['sent', 'done'].indexOf(originalStatus) > -1) {
      _st.priorStatusBeforeItemEdit = originalStatus;
      _st.st = 'draft'; _st.needsResend = true; _st.itemsRevision = (+_st.itemsRevision || 1) + 1;
      _st.targets.forEach(function (t) { if ((t.sends || []).length || t.st === 'replied') t.itemsChangedAfterSend = true; });
    }
    _st.updatedAt = faDateTime(); _st.updatedBy = curSession().name;
    /* v16.5 (US-399 AC4): یادگیری از اصلاح کاربر — انتخاب دستی خارج از پیشنهاد برند → افزودن تخصص با تایید */
    if (typeof ptfSupSpecLearn === 'function') { try { ptfSupSpecLearn(_st.items, targets, _st._ranked); } catch (eL) {} }
    delete _st._ranked; delete _st._sel; delete _st._duplicateApprovedSource; delete _st._originalTargets; delete _st._originalStatus; delete _st._editing; delete _st._recent; delete _st._tgQ; delete _st._tgOtherOpen;
    if (idx > -1) list[idx] = _st; else list.unshift(_st);
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    /* ساخت استعلام تامین برای RFQ ارجاع‌شده، کار «استعلام قیمت از تامین‌کننده» را می‌بندد. */
    try { if (_st.srcRfq && typeof window.ptfResolveRfqReferral === 'function') window.ptfResolveRfqReferral(_st.srcRfq, 'create_supplier_rfq'); } catch (eResolveTask) {}
    audit('استعلام هوشمند', (wasEditing ? 'اصلاح اقلام ' : 'ثبت ') + _st.no + ' با ' + _st.items.length + ' قلم و ' + targets.length + ' تامین‌کننده', _st.no);
    var mds = document.querySelectorAll('.md-b');
    for (var _mi = mds.length - 1; _mi >= 0; _mi--) { if ((mds[_mi].style || {}).display !== 'none') { mds[_mi].remove(); break; } } /* v16.2 BUG-017 */
    renderRfqSmart();
    rfqsOpen(_st.no);
  };

  /* ============ گام ۴: کارت ارسال و رهگیری (AC5/AC6/AC7) ============ */
  window.rfqsOpen = function (no) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var refs = (r.attachments || []).slice(); if (r.attach && r.attach.key && !refs.some(function (x) { return x.key === r.attach.key; })) refs.push(r.attach);
    var referenceFiles = refs.map(function (f) { return '<button class="bt bt-o" style="font-size:11px;color:#0e7490" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')">📎 ' + escP(f.name || 'فایل مرجع') + '</button>'; }).join(' ');
    var itemsRows = (r.items || []).map(function (it, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + escP(it.name) + '</td><td style="direction:ltr">' + escP(it.spec || '—') + '</td><td>' + it.qty + '</td><td>' + escP(it.unit) + '</td></tr>';
    }).join('');
    var tgRows = (r.targets || []).map(function (t, i) {
      var stBadge = t.st === 'replied' ? '<span class="bd b-st4">✅ پاسخ داد</span>' : t.st === 'declined' ? '<span class="bd" style="background:#fee2e2;color:#b91c1c">✖ رد کرد</span>' : (t.sends || []).length ? '<span class="bd" style="background:#dbeafe;color:#1d4ed8">📤 ارسال شد</span>' : '<span class="bd" style="background:#f1f5f9;color:#64748b">⏳ در انتظار ارسال</span>';
      var waTxt = encodeURIComponent('با سلام،\nشرکت پیشرو تجهیز فرتاک\nاستعلام شماره ' + r.no + ' شامل ' + (r.items || []).length + ' قلم کالا خدمت شما ارسال می‌گردد. خواهشمند است ظرف ' + (r.deadline || '48 ساعت') + ' قیمت و زمان تحویل اعلام فرمایید.\n(فرم PDF مختص شما را از دکمه «🖨 PDF» کنار نامتان ذخیره و پیوست کنید)\nتلفن: 021-46087679');
      var mailBody = encodeURIComponent('با سلام\r\n\r\nاستعلام شماره ' + r.no + ' از شرکت پیشرو تجهیز فرتاک به پیوست (فرم PDF) خدمتتان ارسال می‌گردد.\r\nمهلت پاسخ: ' + (r.deadline || '48 ساعت') + '\r\n\r\nبا احترام\r\nPishro Tajhiz Fartak Co.\r\nTel: +98 21 4608 7679');
      return '<div style="border:1px solid var(--brd);border-radius:11px;padding:9px 12px;margin-bottom:6px">' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;align-items:center">' +
        '<span style="font-size:13px"><b>' + escP(t.co) + '</b> ' + stBadge +
        ((t.sends || []).length ? '<small style="color:#94a3b8"> | آخرین ارسال: ' + escP(t.sends[t.sends.length - 1].t) + ' (' + t.sends.map(function (s) { return s.ch; }).join('، ') + ')</small>' : '') + '</span>' +
        '<span style="display:flex;gap:4px;flex-wrap:wrap">' +
        (t.email ? '<a class="bt bt-o" style="padding:4px 9px;font-size:11.5px;text-decoration:none" href="mailto:' + escP(t.email) + '?subject=' + encodeURIComponent('استعلام ' + r.no + ' — پیشرو تجهیز فرتاک') + '&body=' + mailBody + '" onclick="rfqsMarkSend(\'' + ptfOnClickArg(r.no) + '\',' + i + ',\'email\')">✉️ ایمیل</a>' : '') +
        (t.ph ? '<a class="bt bt-o" style="padding:4px 9px;font-size:11.5px;text-decoration:none" target="_blank" href="https://wa.me/98' + escP(String(t.ph).replace(/\D/g, '').replace(/^0/, '')) + '?text=' + waTxt + '" onclick="rfqsMarkSend(\'' + ptfOnClickArg(r.no) + '\',' + i + ',\'whatsapp\')">💬 واتساپ</a>' : '') +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px;color:#0e7490" onclick="rfqsPrintPreview(\'' + ptfOnClickArg(r.no) + '\',' + i + ')" title="پیش‌نمایش/دانلود PDF افقی مختص این تامین‌کننده">🖨 PDF</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px;color:#059669" onclick="rfqsShareToMessenger(\'' + ptfOnClickArg(r.no) + '\',' + i + ')" title="ارسال سند به پیام‌رسان بدون ذخیره">📤</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px;color:#059669" onclick="rfqsReply(\'' + ptfOnClickArg(r.no) + '\',' + i + ')">💰 ثبت پاسخ</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px;color:#dc2626" onclick="rfqsDecline(\'' + ptfOnClickArg(r.no) + '\',' + i + ')">رد کرد</button>' +
        '</span></div></div>';
    }).join('');
    var html = '<div class="md-b" data-rfqs-detail="' + escP(r.no) + '" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px;max-height:94vh;overflow:auto">' +
      '<h3>🤖 ' + escP(r.no) + ' <small style="color:#94a3b8">مهلت پاسخ: ' + escP(r.deadline || '—') + (r.srcRfq ? ' | درخواست: ' + escP(r.srcRfq) : '') + '</small></h3>' +
      (referenceFiles ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:12px">فایل مرجع:</b> ' + referenceFiles + '</div>' : '') +
      '<h4 style="margin:10px 0 6px;font-size:13.5px">📦 اقلام (' + (r.items || []).length + ')</h4>' +
      '<div class="tb2"><table><thead><tr><th>#</th><th>شرح</th><th>مشخصات</th><th>تعداد</th><th>واحد</th></tr></thead><tbody>' + itemsRows + '</tbody></table></div>' +
      '<h4 style="margin:14px 0 6px;font-size:13.5px">🏭 تامین‌کنندگان و ارسال <small style="color:#94a3b8">(هیچ ارسالی خودکار نیست — با کلیک شما انجام می‌شود)</small></h4>' + tgRows +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button class="bt bt-o" style="color:#7c3aed;border-color:#ddd6fe" onclick="rfqsEditItems(\'' + ptfOnClickArg(r.no) + '\')">✏️ ویرایش / افزودن / حذف اقلام</button>' +
      '<button class="bt bt-o" onclick="rfqsXls(\'' + ptfOnClickArg(r.no) + '\')">⬇️ اکسل پاک</button>' +
      '<button class="bt bt-o" onclick="rfqsPrintPreview(\'' + ptfOnClickArg(r.no) + '\',null)">🖨️ PDF عمومی (افقی)</button>' +
      '<button class="bt bt-o" style="color:#0e7490" onclick="rfqsPrintPickSupplier(\'' + ptfOnClickArg(r.no) + '\')">🖨 PDF اختصاصی تامین‌کننده</button>' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.rfqsMarkSend = function (no, ti, ch) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r || !r.targets[ti]) return;
    r.targets[ti].sends = r.targets[ti].sends || [];
    r.targets[ti].sends.push({ ch: ch, t: faDateTime(), by: curSession().name });
    r.st = 'sent'; r.needsResend = false; delete r.targets[ti].itemsChangedAfterSend;
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    audit('استعلام هوشمند', 'ارسال ' + ch + ' به ' + r.targets[ti].co, no);
    setTimeout(function () {
      var mds = document.querySelectorAll('.md-b');
      for (var _mj = mds.length - 1; _mj >= 0; _mj--) { if ((mds[_mj].style || {}).display !== 'none') { mds[_mj].remove(); break; } } rfqsOpen(no); /* v16.2 BUG-017 */
    }, 400);
  };

  // AC6: ثبت پاسخ → اتصال به ماژول قیمت‌های خرید
  window.rfqsReply = function (no, ti) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var t = r.targets[ti];
    // US-153: مودال استاندارد
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '💰 ثبت پاسخ ' + t.co,
        fields: [
          { id: 'price', label: 'قیمت کل اعلامی (ریال)', type: 'number', required: true, dir: 'ltr' },
          { id: 'note', label: 'توضیح (زمان تحویل، شرایط...)', type: 'textarea', rows: 2 }
        ],
        onOk: function (v) { rfqsReplyCommit(no, ti, v.price, v.note); }
      });
      return;
    }
    var price = prompt('قیمت کل اعلامی ' + t.co + ' (ریال):', '');
    if (price === null) return;
    rfqsReplyCommit(no, ti, +String(price).replace(/[^\d]/g, '') || 0, prompt('توضیح:', '') || '');
  };

  window.rfqsReplyCommit = function (no, ti, price, note) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var t = r.targets[ti];
    t.st = 'replied';
    t.reply = { price: +price || 0, note: note, t: faDateTime() };
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    // اتصال به buyquotes (AC6)
    var bq = getData('ptf_crm_buyquotes');
    bq.unshift({ cd: genCode('BQ'), ref: no, sup: t.co, desc: (r.items[0] ? r.items[0].name : '') + (r.items.length > 1 ? ' و ' + (r.items.length - 1) + ' قلم دیگر' : ''), price: t.reply.price, t: faDate(), by: curSession().name, note: note });
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_buyquotes', bq, { reason: 'w4' }); else setData('ptf_crm_buyquotes', bq);
    /* v13.7 (US-335): قیمت/میانگین قیمت‌های دریافتی → قیمت مرجع کالا در ماژول کالا (با قید تاریخ و منبع) */
    try { ptfUpdateRefPrices(r); } catch (e) {}
    audit('استعلام هوشمند', 'ثبت پاسخ ' + t.co + ' — ' + (+t.reply.price).toLocaleString('fa-IR') + ' ریال', no);
    if (typeof notify === 'function') notify({ toRoles: SENIOR_ROLES, title: '💰 پاسخ استعلام ' + no + ' از ' + t.co + ' ثبت شد', kind: 'buyq', channels: ['cart'], link: { panel: 'buyq' } });
    var mds = document.querySelectorAll('.md-b');
    for (var _mj = mds.length - 1; _mj >= 0; _mj--) { if ((mds[_mj].style || {}).display !== 'none') { mds[_mj].remove(); break; } } rfqsOpen(no); /* v16.2 BUG-017 */
  };

  window.rfqsDecline = function (no, ti) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    r.targets[ti].st = 'declined';
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', list, { reason: 'w4' }); else setData('ptf_crm_rfqsmart', list);
    var mds = document.querySelectorAll('.md-b');
    for (var _mj = mds.length - 1; _mj >= 0; _mj--) { if ((mds[_mj].style || {}).display !== 'none') { mds[_mj].remove(); break; } } rfqsOpen(no); /* v16.2 BUG-017 */
  };

  window.rfqsDel = function (no) {
    if (!confirm('استعلام ' + no + ' حذف شود؟')) return;
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqsmart', getData('ptf_crm_rfqsmart').filter(function (x) { return x.no !== no; }), { reason: 'w4' }); else setData('ptf_crm_rfqsmart', getData('ptf_crm_rfqsmart').filter(function (x) { return x.no !== no; }));
    renderRfqSmart();
  };

  /* ============ AC2: اکسل پاک (بدون داده کارفرما) ============ */
  window.rfqsXls = function (no) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var rows = [['Row', 'Description', 'Technical Spec', 'Qty', 'Unit']];
    (r.items || []).forEach(function (it, i) { rows.push([i + 1, it.name, it.spec || '', it.qty, it.unit]); });
    var csv = '\uFEFF' + rows.map(function (rr) { return rr.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = r.no + '-items.csv';
    a.click();
  };


  /* ============ AC4 + v21.9 US-454: PDF افقی با پیش‌نمایش و دانلود ============ */
  window.ptfRfqsPrintHtml = function (r, tgt) {
    /* v31.7.20 BUG-RFQS-MODEL-001 (گزارش کارفرما): ستون Model در PDF استعلام تامین حذف می‌شد؛
       فیلد model از ماژول کالا (x.md) می‌آمد ولی در جدول چاپ رندر نمی‌شد. */
    var _hasModel = (r.items || []).some(function (x) { return x && String(x.model || '').trim(); });
    var tbody = (r.items || []).map(function (it, i) { var desc=String(it.name||''), fa=/[\u0600-\u06FF]/.test(desc); return '<tr><td>'+(i+1)+'</td><td class="desc '+(fa?'fa':'en')+'" dir="'+(fa?'rtl':'ltr')+'">'+escP(desc)+'</td>'+(_hasModel?'<td class="spec" dir="ltr">'+escP(it.model||'—')+'</td>':'')+'<td class="spec" dir="ltr">'+escP(it.spec||'—')+'</td><td>'+ (it.qty||1)+'</td><td>'+escP(it.unit||'PCS')+'</td><td></td><td></td></tr>'; }).join('');
    var toLine = tgt
      ? ('<div class="sub" style="font-size:11pt;color:#111"><b>To:</b> ' + escP(tgt.co) + (tgt.ph ? ' | Tel: ' + escP(tgt.ph) : '') + (tgt.email ? ' | ' + escP(tgt.email) : '') + '</div>')
      : '';
    var dear = tgt
      ? ('Dear Supplier «' + escP(tgt.co) + '»; ')
      : 'Dear Supplier; ';
    return '<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>' +
      escP(r.no) + (tgt ? (' — ' + escP(tgt.co || '')) : '') +
      '</title><style>' +
      '@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}' +
      'body{font-family:Arial,Tahoma,sans-serif;direction:ltr;margin:0;font-size:11pt;color:#222;line-height:1.7}' +
      '.bar{height:6mm;background:linear-gradient(90deg,#e87200,#ee8100,#ecb003,#ecc506)}' +
      '.hd{display:flex;justify-content:space-between;align-items:center;padding:4mm 10mm 2mm}' +
      '.hd img{height:18mm}' +
      '.hd .m{text-align:left;font-size:9.5pt;line-height:1.8}' +
      '.tt{text-align:center;font-size:14pt;font-weight:900;margin:2mm 0}' +
      '.sub{text-align:center;font-size:9.5pt;color:#444;margin-bottom:3mm;padding:0 10mm}' +
      'table{width:calc(100% - 20mm);margin:0 10mm;border-collapse:collapse;font-size:9.5pt}' +
      'th{background:#f79400;color:#fff;padding:2mm;border:1px solid #e0e0e0}' +
      'td{border:1px solid #d8dbe0;padding:1.8mm;text-align:center}.desc{text-align:left}.desc.fa{text-align:right;font-family:Vazirmatn,Tahoma,sans-serif}.spec{text-align:left}' +
      '.note{margin:4mm 10mm;background:#fff8f0;border:1px solid #f6c17c;border-radius:2mm;padding:2.5mm 4mm;font-size:9pt}' +
      '.ftr{margin:4mm 10mm 0;text-align:center;font-size:8pt;color:#a06000;border-top:1px solid #f0d9b8;padding-top:2mm}' +
      '</style></head><body><div class="bar"></div>' +
      '<div class="hd"><img src="../assets/images/ptf-logo.png" alt="PTF">' +
      '<div class="m">No: <b dir="ltr">' + escP(r.no) + '</b><br>Date: <b dir="ltr">' + new Date().toISOString().slice(0,10) + '</b><br>Delivery Deadline: <b>' + escP(r.deadline || '48 hours') + '</b></div></div>' +
      '<div class="tt">Request for Quotation (RFQ)</div>' + toLine +
      '<div class="sub">' + dear + 'Please quote unit price and delivery time for the items below and return to Pishro Tajhiz Fartak.</div>' +
      '<table><thead><tr><th style="width:6%">No.</th><th>Description</th>' + (_hasModel ? '<th style="width:12%">Model</th>' : '') + '<th style="width:' + (_hasModel ? '18%' : '24%') + '">Technical Specification</th><th style="width:8%">Qty</th><th style="width:8%">Unit</th><th style="width:14%">Unit Price (IRR)</th><th style="width:12%">Delivery</th></tr></thead><tbody>' + tbody + '</tbody></table>' +
      '<div class="note">Please mention RFQ No <b dir="ltr">' + escP(r.no) + '</b> in your reply. Reply: Info@pishtaj.ir | Tel: 021-46087679</div>' +
      '<div class="ftr">Pishro Tajhiz Fartak Co. | Tehran | www.pishtaj.ir</div></body></html>';
  };

  window.rfqsShareToMessenger = function (no, targetIdx) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    var tgt = (hasIdx && r.targets && r.targets[+targetIdx]) ? r.targets[+targetIdx] : null;
    var html = ptfRfqsPrintHtml(r, tgt);
    var fname = (r.no || 'RFQ') + (tgt && tgt.co ? ('__' + String(tgt.co).replace(/[^\w\u0600-\u06FF\-]+/g, '_').slice(0, 40)) : '');
    if (typeof ptfShareHtmlToMessenger === 'function') ptfShareHtmlToMessenger(html, fname);
    else if (typeof ptfToast === 'function') ptfToast('ارسال به پیام‌رسان در این نسخه در دسترس نیست', 'warn');
  };

  window.rfqsPrintPreview = function (no, targetIdx) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    var tgt = (hasIdx && r.targets && r.targets[+targetIdx]) ? r.targets[+targetIdx] : null;
    var html = ptfRfqsPrintHtml(r, tgt);
    if (typeof ptfPreviewPrintableDoc === 'function') {
      ptfPreviewPrintableDoc('پیش‌نمایش درخواست تامین — ' + escP(r.no) + (tgt ? (' | ' + escP(tgt.co || '')) : ''), html, r.no + (tgt && tgt.co ? ('__' + tgt.co) : ''));
      return;
    }
    var idxArg = hasIdx ? String(+targetIdx) : 'null';
    var titleSup = tgt ? (' | To: ' + escP(tgt.co)) : ' | عمومی';
    var dlg = ''
      + '<div class="md-b" id="rqsPdfDlg" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()">'
      + '<div class="md" style="max-width:min(96vw,1100px);width:96vw;max-height:94vh;overflow:auto" onclick="event.stopPropagation()">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
      + '<h3 style="margin:0">🖨️ پیش‌نمایش PDF افقی — <span dir="ltr">' + escP(r.no) + '</span><small style="color:#0e7490">' + titleSup + '</small></h3>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button class="bt" style="font-size:12px;background:#059669" onclick="rfqsDownloadPrintHtml(\'' + ptfOnClickArg(no) + '\',' + idxArg + ')">⬇️ دانلود</button>'
      + '<button class="bt bt-o" style="font-size:12px" onclick="rfqsOpenPrintWindow(\'' + ptfOnClickArg(no) + '\',' + idxArg + ')">🖨 چاپ / Save as PDF</button>'
      + '<button class="bt" style="font-size:12px" onclick="var m=document.getElementById(\'rqsPdfDlg\');if(m)m.remove()">بستن</button>'
      + '</div></div>'
      + '<iframe id="rqsPdfFrame" style="width:100%;height:70vh;border:1px solid var(--brd);border-radius:12px;background:#fff"></iframe>'
      + '</div></div>';
    try { var old = document.getElementById('rqsPdfDlg'); if (old) old.remove(); } catch (e0) {}
    document.getElementById('panels').insertAdjacentHTML('beforeend', dlg);
    try { var fr = document.getElementById('rqsPdfFrame'); var doc = fr.contentDocument || fr.contentWindow.document; doc.open(); doc.write(html); doc.close(); } catch (eF) {}
  };

  window.rfqsOpenPrintWindow = function (no, targetIdx) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    var tgt = (hasIdx && r.targets && r.targets[+targetIdx]) ? r.targets[+targetIdx] : null;
    var w = window.open('', '_blank');
    if (!w) { alert('پنجره چاپ مسدود شد — از دکمه دانلود استفاده کنید'); return; }
    w.document.write(ptfRfqsPrintHtml(r, tgt));
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400);
  };

  window.rfqsDownloadPrintHtml = function (no, targetIdx) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    var tgt = (hasIdx && r.targets && r.targets[+targetIdx]) ? r.targets[+targetIdx] : null;
    var html = ptfRfqsPrintHtml(r, tgt);
    var fname = (r.no || 'RFQ') + (tgt && tgt.co ? ('__' + String(tgt.co).replace(/[^\w\u0600-\u06FF\-]+/g, '_').slice(0, 40)) : '') + '_A4-landscape.html';
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 500);
    if (typeof ptfToast === 'function') ptfToast('⬇️ فایل افقی دانلود شد', 'ok');
  };

  window.rfqsPrint = function (no, targetIdx) {
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    rfqsPrintPreview(no, hasIdx ? +targetIdx : null);
  };

  window.rfqsPrintPickSupplier = function (no) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var tgs = r.targets || [];
    if (!tgs.length) { alert('هنوز تامین‌کننده‌ای برای این استعلام انتخاب نشده است'); return; }
    var opts = tgs.map(function (tg, i) {
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--brd);border-radius:12px;margin-bottom:6px;cursor:pointer;background:var(--crd,#fff)">'
        + '<input type="radio" name="rqsPdfSup" value="' + i + '"' + (i === 0 ? ' checked' : '') + '>'
        + '<span style="flex:1"><b>' + escP(tg.co) + '</b>'
        + (tg.ph || tg.email ? ('<span style="display:block;font-size:11.5px;color:#64748b">' + (tg.email ? ('✉️ ' + escP(tg.email) + ' ') : '') + (tg.ph ? ('📱 ' + escP(tg.ph)) : '') + '</span>') : '')
        + '</span></label>';
    }).join('');
    var html = ''
      + '<div class="md-b" id="rqsPdfPick" style="display:grid;z-index:2450" onclick="if(event.target===this)this.remove()">'
      + '<div class="md" style="max-width:480px" onclick="event.stopPropagation()">'
      + '<h3>🖨 PDF اختصاصی تامین‌کننده</h3>'
      + '<div style="font-size:12.5px;color:#475569;margin-bottom:10px">ابتدا تامین‌کننده را از فهرست انتخاب‌شده‌های این استعلام برگزینید، سپس پیش‌نمایش افقی را ببینید و در صورت نیاز دانلود کنید.</div>'
      + '<div style="max-height:50vh;overflow:auto;margin-bottom:12px">' + opts + '</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">'
      + '<button class="bt bt-o" onclick="var m=document.getElementById(\'rqsPdfPick\');if(m)m.remove()">انصراف</button>'
      + '<button class="bt bt-o" style="color:#059669" onclick="rfqsPrintPickShare(\'' + ptfOnClickArg(no) + '\')">📤 پیام‌رسان</button>'
      + '<button class="bt" style="background:#0e7490" onclick="rfqsPrintPickGo(\'' + ptfOnClickArg(no) + '\')">👁 پیش‌نمایش / دانلود</button>'
      + '</div></div></div>';
    try { var old = document.getElementById('rqsPdfPick'); if (old) old.remove(); } catch (e1) {}
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.rfqsPrintPickGo = function (no) {
    var sel = document.querySelector('input[name="rqsPdfSup"]:checked');
    if (!sel) { alert('یک تامین‌کننده را انتخاب کنید'); return; }
    try { var m = document.getElementById('rqsPdfPick'); if (m) m.remove(); } catch (e2) {}
    rfqsPrintPreview(no, +sel.value);
  };
  window.rfqsPrintPickShare = function (no) {
    var sel = document.querySelector('input[name="rqsPdfSup"]:checked');
    if (!sel) { alert('یک تامین‌کننده را انتخاب کنید'); return; }
    rfqsShareToMessenger(no, +sel.value);
  };

  /* ============ روتینگ ============ */
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'rfqs') {
      var rr = roleDef();
      if (!(rr.panels === '*' || rr.panels.indexOf('sup') > -1)) { alert('⛔ دسترسی ندارید'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '🛒 درخواست تامین';
      document.getElementById('panels').innerHTML = buildRfqSmart();
      renderRfqSmart();
      return;
    }
    _go(id, btn);
  };

  /* ============ v13.7 (US-335): به‌روزرسانی قیمت مرجع کالاها از پاسخ‌های درخواست تامین ============
     قیمت پاسخ = کل استعلام؛ سهم هر قلم = نسبت به مجموع تعداد (تقریب یکنواخت واحد).
     اگر چند پاسخ باشد میانگین قیمت‌ها مبنا می‌شود. کالا در ماژول کالا با نام/مشخصات پیدا و
     pr + refPriceAt + refPriceSrc به‌روزرسانی می‌شود. */
  window.ptfUpdateRefPrices = function (r) {
    if (!r || !r.items || !r.items.length) return 0;
    var replies = (r.targets || []).filter(function (t) { return t.st === 'replied' && t.reply && +t.reply.price > 0; });
    if (!replies.length) return 0;
    var avgTotal = replies.reduce(function (s2, t) { return s2 + (+t.reply.price || 0); }, 0) / replies.length;
    var totQty = r.items.reduce(function (s2, it) { return s2 + (+it.qty || 1); }, 0) || 1;
    var perUnit = avgTotal / totQty;
    var prods = getData('ptf_crm_products');
    var updated = 0;
    /* v15.2 (US-385): تطبیق نرمال‌شده در مسیر پاسخ کلی (US-335) هم */
    var normU = function (x) { return (typeof dedupNorm === 'function') ? dedupNorm(x) : String(x || '').trim().toLowerCase(); };
    r.items.forEach(function (it) {
      var nm = (it.name || it.nm || '').trim();
      if (!nm) return;
      var productMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false };
      var p = productMatch.ok ? productMatch.item : null;
      if (!p) return; /* no positional/first-name fallback for ambiguous products */
      p.pr = Math.round(perUnit);
      p.prCur = r.quoteCur || p.prCur || 'IRR'; /* v15.6 US-387 ③ */
      p.refPriceAt = faDate();
      p.refPriceSrc = 'درخواست تامین ' + (r.no || '') + ' — ' + (replies.length > 1 ? 'میانگین ' + replies.length + ' قیمت' : replies[0].co);
      updated++;
    });
    if (updated) {
      /* v34.8.23 (W1-iterate) */
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_products', prods, { reason: 'rfq-refprice' });
      else setData('ptf_crm_products', prods);
      try { audit('کالاها', 'به‌روزرسانی قیمت مرجع ' + updated + ' کالا از پاسخ‌های ' + (r.no || ''), r.no || ''); } catch (e) {}
      if (typeof ptfToast === 'function') ptfToast('💰 قیمت مرجع ' + updated + ' کالا در ماژول کالا به‌روزرسانی شد (با قید تاریخ)', 'ok');
    }
    return updated;
  };
})();

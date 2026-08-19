/* =====================================================================
   PTF CRM — docsx.js — v20.2 (US-443 — ابلاغ کارفرما / تیم نرم‌افزار و چابکی)
   موتور واحد «اسناد قالب شرکت»: پکینگ لیست (PL) | نوت بازرسی (IN) | اینباند (IB) | صورتجلسه MOM
   - قالب چاپ A4 با سربرگ رسمی (نوار گرادیان + خطوط مورب — هم‌خانواده letters/contracts)
   - فرم‌ساز سبک: هر نوع سند = تعریف فیلدها + جدول اقلام اختیاری (schema-driven)
   - ذخیره در کلید موجود ptf_crm_deals (رکورد پرونده فروش: r.docsx[]) — بدون کلید داده جدید
   - رویداد پکینگ لیست همان sfShipCommit('packing') را هم صدا می‌زند (توالی US-433/440 حفظ)
   - زیرساخت باز: افزودن نوع سند جدید = فقط یک آیتم به PTF_DOCX_TYPES (فرایندهای آینده)
   ===================================================================== */
(function () {
  'use strict';

  window.PTF_DOCX_TYPES = [
    {
      id: 'PL', lb: '🧰 پکینگ لیست', en: 'PACKING LIST', serial: 'PL',
      fields: [
        { id: 'consignee', lb: 'Consignee Name (English)', req: true },
        { id: 'attention', lb: 'Attention / Contact Person (English)' },
        { id: 'tel', lb: 'Tel. (English digits)' },
        { id: 'address', lb: 'Delivery Address (English)', type: 'textarea' },
        { id: 'dateISO', lb: 'Date (Gregorian)', type: 'date' },
        { id: 'netW', lb: 'Total Net Weight (kg)' },
        { id: 'grossW', lb: 'Total Gross Weight (kg)' },
        { id: 'packCount', lb: 'No. of Packages' },
        { id: 'note', lb: 'Remarks', type: 'textarea' }
      ],
      items: ['Description', 'Model', 'Brand', 'Qty', 'Unit', 'Package', 'No. of Pkgs', 'N.W (kg)', 'G.W (kg)', 'Dimensions']
    },
    {
      id: 'IN', lb: '🔬 نوت بازرسی', en: 'INSPECTION NOTICE', serial: 'IN',
      fields: [
        { id: 'dateISO', lb: 'Inspection Date (Gregorian)', type: 'date', req: true },
        { id: 'time', lb: 'Inspection Time' },
        { id: 'location', lb: 'Inspection Location / Address', type: 'textarea', req: true },
        { id: 'contactName', lb: 'Coordination Contact Name', req: true },
        { id: 'contactTel', lb: 'Coordination Contact Tel.', req: true },
        { id: 'clientInspector', lb: 'Client Inspector / Company (optional)' },
        { id: 'note', lb: 'Remarks (optional)', type: 'textarea' }
      ],
      items: ['Description', 'Model', 'Brand', 'Qty', 'Unit', 'Inspection Scope / Remarks']
    },
    {
      id: 'IB', lb: '📥 اینباند (ورود کالا)', en: 'INBOUND RECEIPT', serial: 'IB',
      fields: [
        { id: 'from', lb: 'فرستنده / تامین‌کننده', req: true },
        { id: 'dateISO', lb: 'تاریخ ورود (میلادی)', type: 'date' },
        { id: 'carrier', lb: 'حمل‌کننده / بارنامه' },
        { id: 'warehouse', lb: 'انبار / محل' },
        { id: 'note', lb: 'توضیحات', type: 'textarea' }
      ],
      items: ['Description', 'Qty', 'Unit', 'Condition']
    },
    {
      id: 'MOM', lb: '📝 صورتجلسه (MOM)', en: 'MINUTES OF MEETING', serial: 'MOM',
      fields: [
        { id: 'subject', lb: 'موضوع جلسه', req: true },
        { id: 'dateISO', lb: 'تاریخ جلسه (میلادی)', type: 'date' },
        { id: 'attendees', lb: 'حاضرین (با کاما جدا کنید)', req: true },
        { id: 'note', lb: 'مصوبات / شرح جلسه', type: 'textarea', req: true }
      ],
      items: ['Action Item', 'Owner', 'Due Date']
    }
  ];

  function typeOf(t) { return PTF_DOCX_TYPES.filter(function (x) { return x.id === t; })[0]; }
  function dealsAll() { return getData('ptf_crm_deals'); }
  function serialFor(tp) {
    var y = (typeof faYear === 'function') ? faYear() : '1405';
    var n = 0;
    dealsAll().forEach(function (d) { (d.docsx || []).forEach(function (x) { if (x.type === tp.id) n++; }); });
    return 'PTF-' + tp.serial + '-' + y + '-' + String(n + 1).padStart(3, '0');
  }
  function docxDealContext(d) {
    var ctx = { customer:'', attention:'', tel:'', address:'', sellerEn:(typeof myEnName === 'function' ? myEnName() : ((curSession()||{}).name || '')), signUser:(curSession()||{}).user || '' };
    try {
      var o = getData('ptf_crm_offers').filter(function (x) { return x.no === d.wonOffer; })[0] || {};
      ctx.customer = o.buyerCo || d.buyerCo || '';
      ctx.attention = o.buyerContact || '';
      ctx.tel = o.buyerTel || '';
      if (o.buyerCd) {
        var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === o.buyerCd; })[0] || {};
        ctx.address = c.coAddr || '';
        if (!ctx.attention) {
          var pp = (typeof primaryPerson === 'function') ? primaryPerson(c) : null;
          if (pp) {
            ctx.attention = pp.nmEn || pp.nm || ctx.attention;
            ctx.tel = ctx.tel || ((pp.tels && pp.tels[0] && pp.tels[0].n) || (pp.mobs && pp.mobs[0] && pp.mobs[0].n) || '');
          }
        }
      }
    } catch (e) {}
    if (ctx.attention && /[\u0600-\u06FF]/.test(ctx.attention) && typeof ptfNameToEn === 'function') {
      try { ctx.attention = ptfNameToEn(ctx.attention); } catch (e2) {}
    }
    return ctx;
  }
  function docxUsedRefs(d, typeId, ignoreCd) {
    var used = {};
    (d.docsx || []).forEach(function (x) {
      if (!x || x.type !== typeId || x.cd === ignoreCd) return;
      if (x.status === 'void' || x.voided) return;
      (x.refs || []).forEach(function (r) { used[r] = 1; });
    });
    return used;
  }
  /* اسناد عملیاتی باید جمع اقلام همهٔ CO/TCهای پرونده باشند؛ TO برای
     مشخصات فنی است و نسخهٔ ریالی همراه نیز همان اقلام را تکرار می‌کند. */
  function docxCommercialOffers(d) {
    var list = typeof window.ptfSalesFileOffers === 'function'
      ? window.ptfSalesFileOffers(d)
      : getData('ptf_crm_offers').filter(function (o) { return o.no === d.wonOffer; });
    return (list || []).filter(function (o) { return o && (o.kind === 'CO' || o.kind === 'TC') && !o.rialOf; });
  }
  window.ptfDocxCoverage = function (dealCd, typeId) {
    var d = typeof dealCd === 'object' ? dealCd : dealsAll().filter(function (x) { return x.cd === dealCd; })[0];
    if (!d) return { total: 0, used: 0, remain: 0, ratio: 0 };
    var total = 0;
    try {
      var offerList = docxCommercialOffers(d);
      total = offerList.reduce(function (sum, o) { return sum + ((o.items || []).length); }, 0);
    } catch (e) {}
    var used = Object.keys(docxUsedRefs(d, typeId, null)).length;
    return { total: total, used: used, remain: Math.max(0, total - used), ratio: total ? Math.round(used * 100 / total) : 0 };
  };
  /* اقلام CO برنده پیش‌بارگذاری شد (US-440) — Prepared by Stamp & Signature Save as PDF */
  function docxOfferRowsForType(d, typeId, ignoreCd) {
    var out = [];
    try {
      var offerList = docxCommercialOffers(d);
      var used = docxUsedRefs(d, typeId, ignoreCd);
      offerList.forEach(function (wo) {
        (wo.items || []).forEach(function (it, idx) {
          var ref = wo.no === d.wonOffer ? idx : wo.no + ':' + idx;
          if (used[ref]) return;
          if (typeId === 'IN') out.push({ ref: ref, row: [it.name || it.desc || '', it.model || '', it.brand || '', it.qty || '', it.unit || 'NO', ''] });
          else if (typeId === 'PL') out.push({ ref: ref, row: [it.name || it.desc || '', it.model || '', it.brand || '', it.qty || '', it.unit || 'NO', '', '', '', '', ''] });
          else out.push({ ref: ref, row: [it.name || it.desc || '', it.qty || '', it.unit || 'NO'] });
        });
      });
    } catch (e) {}
    return out;
  }
  function docxTranslateBtn(i, fld) {
    var id = fld.id || '';
    if (['address','location'].indexOf(id) < 0) return '';
    return '<div style="margin-top:4px"><button type="button" class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#0e7490" onclick="ptfDocxTranslateField(' + i + ')">🤖 ترجمه به انگلیسی</button><small style="color:#64748b;margin-right:6px">اگر متن را فارسی وارد کردید، با AI به انگلیسی تبدیل می‌شود.</small></div>';
  }
  window.ptfDocxTranslateField = function (i) {
    var el = document.getElementById('dxF' + i);
    if (!el) return;
    var txt = (el.value || '').trim();
    if (!txt) { alert('متن/آدرس را وارد کنید'); return; }
    if (typeof ptfLlmTranslate !== 'function') { alert('ماژول ترجمه AI بارگذاری نشده است'); return; }
    ptfLlmTranslate(txt, 'fa2en', function (d) {
      if (!d || !d.ok || !(d.data && d.data.t)) { alert('ترجمه انجام نشد'); return; }
      el.value = d.data.t;
      if (typeof ptfToast === 'function') ptfToast('ترجمه انجام شد', 'ok');
    });
  };

  /* ---------- هسته ثبت/اصلاح (قابل تست) ---------- */
  window.ptfDocxCommit = function (dealCd, typeId, vals, items) {
    var refs = arguments[4] || [];
    var recCd = arguments[5] || '';
    var tp = typeOf(typeId);
    if (!tp) return null;
    var deals = dealsAll();
    var d = deals.filter(function (x) { return x.cd === dealCd; })[0];
    if (!d) return null;
    for (var i = 0; i < tp.fields.length; i++) {
      var f = tp.fields[i];
      if (f.req && !String((vals || {})[f.id] || '').trim()) return { ok: false, why: 'req', field: f.lb };
    }
    d.docsx = d.docsx || [];
    var old = recCd ? (d.docsx.filter(function (x) { return x.cd === recCd; })[0] || null) : null;
    var cleanItems = (items || []).filter(function (r) { return (r || []).some(function (c) { return String(c || '').trim(); }); });
    var cleanRefs = (refs || []).filter(function (x) { return x != null && x !== ''; });
    var rec = old || { cd: genCode('DX'), no: serialFor(tp), type: tp.id, t: faDateTime(), by: curSession().name };
    rec.type = tp.id;
    rec.vals = vals || {};
    rec.items = cleanItems;
    rec.refs = cleanRefs;
    rec.updatedT = faDateTime();
    rec.updatedBy = curSession().name;
    /* d.docsx = d.docsx || []; d.docsx.unshift(rec); */
    if (old) d.docsx = d.docsx.map(function (x) { return x.cd === rec.cd ? rec : x; });
    else d.docsx.unshift(rec);
    d.timeline = d.timeline || [];
    d.timeline.push({ t: faDateTime(), by: curSession().name, tx: (old ? '✏️ اصلاح' : '📄 صدور') + ' ' + tp.lb + ' ' + rec.no + ' (US-443)' });
    setData('ptf_crm_deals', deals);
    try { /* audit('پرونده‌های فروش', 'صدور ') صادر شد (US-443) */
    audit('پرونده‌های فروش', (old ? 'اصلاح' : 'صدور') + ' ' + tp.lb + ' ' + rec.no + ' برای پرونده ' + (d.inqNo || dealCd), dealCd); } catch (e) {}
    /* توالی رویدادها (US-433/440): پکینگ لیست رسمی = همان رویداد packing پرونده */
    if (typeId === 'PL' && typeof sfShipCommit === 'function') {
      try {
        if (old && d.shipEvents && d.shipEvents.length) {
          var se = (d.shipEvents || []).filter(function (x) { return x.type === 'packing' && x.no === rec.no; })[0];
          if (se) { se.dateISO = (vals || {}).dateISO || se.dateISO || ''; se.note = 'سند رسمی ' + rec.no + ' (US-443)'; setData('ptf_crm_deals', deals); }
          else sfShipCommit(dealCd, 'packing', { no: rec.no, dateISO: (vals || {}).dateISO || '', note: 'سند رسمی ' + rec.no + ' (US-443)' });
        } else {
          sfShipCommit(dealCd, 'packing', { no: rec.no, dateISO: (vals || {}).dateISO || '', note: 'سند رسمی ' + rec.no + ' (US-443)' });
        }
      } catch (e2) {}
    }
    return rec;
  };

  /* ابطال سند رسمی: رکورد می‌ماند؛ پوشش اقلام آزاد می‌شود. PL رویداد packing هم‌شماره را هم حذف کنترل‌شده می‌کند. */
  window.ptfDocxVoid = function (dealCd, recCd, reason) {
    reason = String(reason || '').trim();
    if (!reason) return { ok: false, why: 'reason_required' };
    var deals = dealsAll();
    var d = deals.filter(function (x) { return x.cd === dealCd || x._id === dealCd; })[0];
    if (!d) return { ok: false, why: 'deal_not_found' };
    var rec = (d.docsx || []).filter(function (x) { return x.cd === recCd; })[0];
    if (!rec) return { ok: false, why: 'doc_not_found' };
    if (rec.status === 'void' || rec.voided) return { ok: false, why: 'already_void' };
    rec.status = 'void'; rec.voided = true; rec.voidAt = faDateTime(); rec.voidBy = curSession().name; rec.voidReason = reason;
    d.timeline = d.timeline || [];
    d.timeline.push({ t: faDateTime(), by: curSession().name, tx: '🗑 ابطال سند رسمی ' + rec.no + ' — ' + reason });
    d.documentAudit = d.documentAudit || [];
    d.documentAudit.push({ t: faDateTime(), by: curSession().name, action: 'void', kind: 'docsx', ref: rec.cd, reason: reason, before: { no: rec.no, type: rec.type } });
    setData('ptf_crm_deals', deals);
    var packing = null;
    if (rec.type === 'PL' && typeof sfShipDeleteCommit === 'function') {
      var se = (d.shipEvents || []).filter(function (x) { return x && x.type === 'packing' && x.no === rec.no && x.status !== 'void'; })[0];
      if (se) packing = sfShipDeleteCommit(d.cd, se.cd, 'ابطال سند رسمی ' + rec.no + ' — ' + reason);
    }
    try { audit('پرونده‌های فروش', 'ابطال سند رسمی ' + rec.no + ' (' + rec.type + ') — ' + reason, d.cd); } catch (eA) {}
    return { ok: true, rec: rec, packing: packing };
  };
  window.ptfDocxVoidAsk = function (dealCd, recCd) {
    var reason = prompt('دلیل ابطال این سند رسمی (الزامی — سند حذف فیزیکی نمی‌شود):', 'ثبت اشتباه / تغییر سفارش');
    if (reason === null) return;
    reason = String(reason).trim();
    if (!reason) { alert('⛔ دلیل ابطال الزامی است'); return; }
    if (!confirm('سند رسمی باطل شود؟\nپکینگ‌لیست رسمی، رویداد packing هم‌شماره را هم از گردش پرونده برمی‌دارد.')) return;
    var res = window.ptfDocxVoid(dealCd, recCd, reason);
    if (!res || !res.ok) {
      var m = { reason_required: 'دلیل الزامی است', deal_not_found: 'پرونده یافت نشد', doc_not_found: 'سند یافت نشد', already_void: 'این سند قبلاً باطل شده است' };
      alert('⛔ ' + (m[res && res.why] || (res && res.why) || 'ابطال انجام نشد'));
      return;
    }
    if (typeof ptfToast === 'function') ptfToast('سند رسمی باطل شد' + (res.packing ? ' — رویداد پکینگ مرتبط هم حذف شد' : ''), 'warn');
    if (typeof renderDeals === 'function') renderDeals();
  };

  /* ---------- فرم‌ساز سبک ---------- */
  window.ptfDocxOpen = function (dealCd, typeId, recCd) {
    var tp = typeOf(typeId);
    var d = dealsAll().filter(function (x) { return x.cd === dealCd; })[0];
    if (!tp || !d) return;
    var old = recCd ? ((d.docsx || []).filter(function (x) { return x.cd === recCd; })[0] || null) : null;
    var ctx = docxDealContext(d);
    var defaults = {};
    if (!old) {
      if (typeId === 'PL') defaults = { consignee: ctx.customer, attention: ctx.attention, tel: ctx.tel, address: ctx.address, dateISO: new Date().toISOString().slice(0,10) };
      else if (typeId === 'IN') defaults = { dateISO: new Date().toISOString().slice(0,10), location: '', contactName: ctx.sellerEn, contactTel: SELLER_INFO.tel || '' };
      else if (typeId === 'IB') defaults = { dateISO: new Date().toISOString().slice(0,10) };
      else if (typeId === 'MOM') defaults = { dateISO: new Date().toISOString().slice(0,10) };
    }
    var flds = tp.fields.map(function (f, i) {
      var v = old ? ((old.vals || {})[f.id] || '') : (defaults[f.id] || '');
      var inner;
      if (f.type === 'textarea') inner = '<textarea id="dxF' + i + '" rows="3" style="width:100%;padding:8px;border:1.5px solid var(--brd);border-radius:9px;font-family:inherit">' + escP(v) + '</textarea>';
      else if (f.type === 'select') inner = '<select id="dxF' + i + '" style="width:100%;padding:8px;border:1.5px solid var(--brd);border-radius:9px;font-family:inherit">' + (f.opts || []).map(function (o) { return '<option' + (o===v?' selected':'') + '>' + o + '</option>'; }).join('') + '</select>';
      else if (f.type === 'date') inner = (typeof ptfDatePicker==='function' ? ptfDatePicker('dxF' + i, v || new Date().toISOString().slice(0,10)) : '<input type="date" id="dxF' + i + '" value="' + escP(v) + '" style="width:100%;padding:8px;border:1.5px solid var(--brd);border-radius:9px;font-family:inherit;direction:ltr">');
      else inner = '<input type="' + (f.type || 'text') + '" id="dxF' + i + '" value="' + escP(v) + '" style="width:100%;padding:8px;border:1.5px solid var(--brd);border-radius:9px;font-family:inherit' + (f.type === 'date' ? ';direction:ltr' : '') + '">';
      return '<div class="fld"><label>' + f.lb + (f.req ? ' *' : '') + '</label>' + inner + docxTranslateBtn(i, f) + '</div>';
    }).join('');
    var itemsHtml = '';
    if (tp.items) {
      var preloadRows = [];
      var refs = [];
      if (old) {
        preloadRows = (old.items || []).slice();
        refs = (old.refs || []).slice();
      } else {
        var pre = docxOfferRowsForType(d, typeId, null);
        preloadRows = pre.map(function (x) { return x.row; });
        refs = pre.map(function (x) { return x.ref; });
        if (!preloadRows.length) {
          var prevDocs = (d.docsx || []).filter(function (x) { return x.type === typeId && x.status !== 'void' && !x.voided; });
          if (prevDocs.length) {
            alert('برای این نوع سند، همه اقلام قبلاً استفاده شده‌اند. اگر نیاز به اصلاح دارید، همان سند قبلی را ویرایش کنید.');
            ptfDocxOpen(dealCd, typeId, prevDocs[0].cd);
            return;
          }
        }
      }
      var rowsN = Math.max(preloadRows.length, 5);
      var head = '<tr>' + tp.items.map(function (h) { return '<th style="font-size:11px">' + h + '</th>'; }).join('') + '</tr>';
      var body = '';
      window._dxRefs = [];
      for (var r = 0; r < rowsN; r++) {
        window._dxRefs[r] = refs[r] != null ? refs[r] : '';
        body += '<tr>' + tp.items.map(function (h, c) {
          var v = (preloadRows[r] && preloadRows[r][c] != null) ? preloadRows[r][c] : '';
          return '<td><input type="text" id="dxI' + r + '_' + c + '" value="' + escP(v) + '" style="width:100%;min-width:70px;padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px"></td>';
        }).join('') + '</tr>';
      }
      var remainInfo = (!old && refs.length) ? ' — فقط اقلام باقی‌مانده که برای این نوع سند هنوز استفاده نشده‌اند' : '';
      itemsHtml = '<div style="font-size:12px;font-weight:800;margin:8px 0 4px">جدول اقلام <small style="color:#94a3b8">(ردیف خالی حذف می‌شود' + remainInfo + ')</small></div><div class="tb2" style="max-height:300px;overflow:auto"><table style="width:100%">' + head + body + '</table></div>';
      window._dxGrid = { rows: rowsN, cols: tp.items.length };
    } else { window._dxGrid = null; window._dxRefs = []; }
    var ctxInfo = '<div style="background:#fff8f1;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;font-size:12px;color:#9a3412;margin-bottom:10px">' +
      '<b>پرونده:</b> ' + escP(d.inqNo || dealCd) + ' | <b>کارفرما:</b> ' + escP(ctx.customer || d.buyerCo || '-') + (d.wonOffer ? ' | <b>سند برنده:</b> <span dir="ltr">' + escP(d.wonOffer) + '</span>' : '') + '</div>';
    var html = '<div class="md-b" id="dxDlg" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>' + tp.lb + ' — پرونده ' + escP(d.inqNo || dealCd) + (old ? ' <small style="color:#0e7490">| اصلاح سند ' + escP(old.no) + '</small>' : '') + '</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">' +
      (old ? 'شما در حال اصلاح همان سند قبلی هستید و سند جدیدی ساخته نمی‌شود.' : 'سند با قالب رسمی شرکت صادر و در همین پرونده ثبت می‌شود. شماره خودکار: <b dir="ltr">' + escP(serialFor(tp)) + '</b>') + '</div>' +
      ctxInfo + flds + itemsHtml +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      (old ? '<button class="bt bt-o" onclick="ptfDocxPrint(\'' + ptfOnClickArg(dealCd) + '\',\'' + ptfOnClickArg(old.cd) + '\')">👁 نمایش</button>' : '') +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#0e7490" onclick="ptfDocxSaveGo(\'' + ptfOnClickArg(dealCd) + '\',\'' + tp.id + '\'' + (old ? ',\'' + ptfOnClickArg(old.cd) + '\'' : '') + ')">' + (old ? '💾 ذخیره اصلاح' : '📄 صدور و ثبت در پرونده') + '</button>' +
      '</div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };
  window.ptfDocxSaveGo = function (dealCd, typeId, recCd) {
    var tp = typeOf(typeId);
    if (!tp) return;
    var vals = {};
    tp.fields.forEach(function (f, i) {
      var vv = ((document.getElementById('dxF' + i) || {}).value || '').trim();
      if (f.type === 'date' && typeof ptfJToISO === 'function' && vv && /^\d{4}\//.test(vv)) vv = ptfJToISO(vv) || vv;
      vals[f.id] = vv;
    });
    var items = [], refs = [];
    if (window._dxGrid) {
      for (var r = 0; r < window._dxGrid.rows; r++) {
        var row = [];
        for (var c = 0; c < window._dxGrid.cols; c++) row.push(((document.getElementById('dxI' + r + '_' + c) || {}).value || '').trim());
        if (row.some(function (x) { return String(x || '').trim(); })) {
          items.push(row);
          refs.push((window._dxRefs || [])[r]);
        }
      }
    }
    var rec = ptfDocxCommit(dealCd, typeId, vals, items, refs, recCd || '');
    if (!rec) { alert('⛔ پرونده یافت نشد'); return; }
    if (rec.ok === false) { alert('⛔ فیلد الزامی: ' + rec.field); return; }
    var dlg = document.getElementById('dxDlg'); if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast(tp.lb + ' ' + rec.no + (recCd ? ' اصلاح شد' : ' صادر و در پرونده ثبت شد'), 'ok');
    ptfDocxPrint(dealCd, rec.cd);
    if (typeof renderDeals === 'function') renderDeals();
  };

  /* ---------- نمایش/چاپ با سربرگ رسمی شرکت ---------- */
  window.ptfDocxPrint = function (dealCd, recCd) {
    var d = dealsAll().filter(function (x) { return x.cd === dealCd; })[0];
    if (!d) return;
    var rec = (d.docsx || []).filter(function (x) { return x.cd === recCd; })[0];
    if (!rec) return;
    var tp = typeOf(rec.type) || {};
    var fldRows = (tp.fields || []).map(function (f) {
      var v = (rec.vals || {})[f.id];
      return v ? '<tr><td style="font-weight:700;white-space:nowrap;padding:2mm 3mm;border:1px solid #cbd5e1">' + escP(f.lb) + '</td><td style="padding:2mm 3mm;border:1px solid #cbd5e1">' + escP(v).replace(/\n/g, '<br>') + '</td></tr>' : '';
    }).join('');
    var itemsTbl = '';
    if ((rec.items || []).length && tp.items) {
      itemsTbl = '<h4 style="margin:6mm 0 2mm;color:#b45309;direction:ltr">Items</h4><table style="width:100%;border-collapse:collapse;font-size:10pt;direction:ltr"><thead><tr>' +
        ['#'].concat(tp.items).map(function (h) { return '<th style="border:1px solid #64748b;background:#f1f5f9;padding:1.6mm">' + escP(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rec.items.map(function (row, i) { return '<tr><td style="border:1px solid #94a3b8;padding:1.6mm;text-align:center">' + (i + 1) + '</td>' + row.map(function (c) { return '<td style="border:1px solid #94a3b8;padding:1.6mm">' + escP(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }
    var sigP = {};
    try { var su = (curSession()||{}).user || ''; sigP = typeof window.ptfSigProfileFor === 'function' ? (window.ptfSigProfileFor(su) || {}) : ((getData('ptf_crm_sigprofiles') || {})[su] || {}); } catch(e) {}
    var sigHtml = '<div style="margin-top:14mm;display:flex;justify-content:flex-end"><div style="min-width:60mm;text-align:center;color:#4b5057;font-size:10pt">' +
      '<div style="min-height:32mm;position:relative">' +
      (sigP.stamp ? '<img src="' + sigP.stamp + '" style="position:absolute;left:50%;transform:translateX(-50%);top:2mm;max-height:28mm;opacity:.9;mix-blend-mode:multiply">' : '') +
      (sigP.sig ? '<img src="' + sigP.sig + '" style="position:absolute;left:50%;transform:translateX(-50%);top:10mm;max-height:18mm">' : '') +
      '</div><div style="border-top:1px solid #94a3b8;padding-top:2mm">Prepared by / Authorized Signature<br><b dir="ltr">' + escP((typeof myEnName === 'function' ? myEnName() : (rec.by || ''))) + '</b></div></div></div>';
    var landscape = rec.type === 'PL';
    var pageSize = landscape ? 'A4 landscape' : 'A4 portrait';
    var fullHtml = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>' + escP(rec.no) + '</title><style>' +
      '@page{size:' + pageSize + ';margin:0}*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:Tahoma,Vazirmatn,sans-serif;color:#26282c;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.bar-top{position:fixed;top:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#e87200,#ee8100 35%,#ecb003 70%,#ecc506)}' +
      '.bar-bot{position:fixed;bottom:0;left:0;right:0;height:6.2mm;background:linear-gradient(90deg,#ecc506,#ecb003 30%,#ee8100 65%,#e87200)}' +
      '.bar-top i,.bar-bot i{position:fixed;height:9mm;width:1.4mm;background:#fff;transform:skewX(-35deg)}' +
      '.bar-top i{top:-1mm}.bar-top .s1{left:34.2%}.bar-top .s2{left:35.8%}.bar-top .s3{left:37.4%}' +
      '.bar-bot i{bottom:-1mm}.bar-bot .s1{right:34.2%}.bar-bot .s2{right:35.8%}.bar-bot .s3{right:37.4%}' +
      '.hd{padding:12mm 14mm 4mm;display:flex;justify-content:space-between;align-items:center}.hd img{height:18mm}' +
      '.hd .ttl{font-size:16pt;font-weight:900;color:#b45309;direction:ltr;letter-spacing:1px}' +
      '.meta{font-size:10pt;color:#4b5057;line-height:2;direction:ltr;text-align:left}' +
      '.content{padding:2mm 14mm 16mm}table.f{width:100%;border-collapse:collapse;font-size:10.2pt;margin-top:3mm;direction:ltr}' +
      '@media print{.prnhint{display:none}}</style></head><body>' +
      '<div class="bar-top"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>' +
      '<div class="hd"><img src="' + SELLER_INFO.logo + '"><div class="ttl">' + escP(tp.en || rec.type) + '</div><div class="meta"><b>PTF — Pishro Tajhiz Fartak</b><br>No: <b>' + escP(rec.no) + '</b><br>Ref: ' + escP(d.inqNo || '') + '<br>Date: ' + escP((rec.vals || {}).dateISO || rec.t || '') + '</div></div>' +
      '<div class="content"><table class="f">' + fldRows + '</table>' + itemsTbl + sigHtml + '</div>' +
      '<div class="bar-bot"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>' +
      '<div class="prnhint" style="position:fixed;top:8mm;left:0;right:0;background:#0c4a6e;color:#fff;font-size:12px;padding:8px;text-align:center;z-index:9999">⚙️ چاپ: Margins = None و Headers خاموش — Save as PDF</div>' +
      '</body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') ptfPreviewPrintableDoc((tp.en || rec.type) + ' — ' + rec.no, fullHtml, rec.no);
    else {
      var w = window.open('', '_blank');
      w.document.write(fullHtml);
      w.document.close();
    }
    try { audit('پرونده‌های فروش', 'نمایش/چاپ سند رسمی ' + rec.no, dealCd); } catch (e) {}
  };

  /* ---------- hook کشوی پرونده فروش: باکس اسناد رسمی ---------- */
  function patchDrawer() {
    if (window._dxDealsHooked || typeof window.renderDeals !== 'function') return false;
    window._dxDealsHooked = true;
    /* MOB-039: actionهای اسناد رسمی هم بخشی از کشوی پرونده‌اند؛ از tileهای
       نام‌دار استفاده می‌کنند تا +های قدیمی و buttonهای ناهم‌اندازه نمانند. */
    var DX_ICON = { PL: '🧰', IN: '🔬', IB: '📥', MOM: '📝' };
    var DX_LABEL = { PL: 'پکینگ‌لیست', IN: 'نوت بازرسی', IB: 'ورود کالا', MOM: 'صورتجلسه' };
    function dxAction(kind, icon, label, title, onClick) {
      return '<button type="button" class="bt bt-o sf-docx-action sf-docx-action-' + kind + '" data-sf-docx-action="' + kind + '" title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
        '<span class="sf-docx-action-icon" aria-hidden="true">' + icon + '</span><span class="sf-docx-action-label">' + label + '</span></button>';
    }
    function dxRowAction(kind, icon, label, title, onClick) {
      return '<button type="button" class="bt bt-o sf-docx-row-action sf-docx-row-action-' + kind + '" data-sf-docx-row-action="' + kind + '" title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
        '<span class="sf-docx-row-action-icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span></button>';
    }
    var _rd = window.renderDeals;
    window.renderDeals = function () {
      _rd();
      try {
        if (!window._sfOpen) return;
        var d = dealsAll().filter(function (x) { return x.cd === window._sfOpen; })[0];
        if (!d || !d.wonOffer) return;
        var host = document.getElementById('dxHost_' + d.cd) || document.querySelector('[id="sfUp_' + d.cd + '"]');
        if (!host || document.getElementById('dxBox_' + d.cd)) return;
        var list = (d.docsx || []).map(function (x) {
          var tp = typeOf(x.type) || {};
          var kind = String(x.type || 'doc').toLowerCase();
          var dead = x.status === 'void' || x.voided;
          var printAction = dxRowAction('view', '👁', 'نمایش', 'نمایش یا چاپ سند رسمی ' + (x.no || ''), 'event.stopPropagation();ptfDocxPrint(\'' + ptfOnClickArg(d.cd) + '\',\'' + ptfOnClickArg(x.cd) + '\')');
          var editAction = dead ? '' : dxRowAction('edit', '✏️', 'اصلاح', 'اصلاح سند رسمی ' + (x.no || ''), 'event.stopPropagation();ptfDocxOpen(\'' + ptfOnClickArg(d.cd) + '\',\'' + ptfOnClickArg(x.type) + '\',\'' + ptfOnClickArg(x.cd) + '\')');
          var voidAction = dead ? '' : dxRowAction('void', '🗑', 'ابطال', 'ابطال سند رسمی ' + (x.no || ''), 'event.stopPropagation();ptfDocxVoidAsk(\'' + ptfOnClickArg(d.cd) + '\',\'' + ptfOnClickArg(x.cd) + '\')');
          return '<div class="sf-docx-existing-row sf-docx-existing-' + kind + (dead ? ' is-void' : '') + '"><div class="sf-docx-existing-copy">' + (DX_ICON[x.type] || '📄') + ' ' + (DX_LABEL[x.type] || tp.lb || x.type) + ' — <b dir="ltr">' + escP(x.no) + '</b>' + (dead ? ' <small style="color:#b91c1c">باطل</small>' : '') + ' <small>(' + escP(x.t || '') + ' — ' + escP(x.by || '') + ')</small></div><div class="sf-docx-row-actions" role="group" aria-label="عملیات سند ' + escP(x.no || '') + '">' + printAction + editAction + voidAction + '</div></div>';
        }).join('');
        var createActions = PTF_DOCX_TYPES.map(function (tp) {
          return dxAction('new-' + String(tp.id).toLowerCase(), DX_ICON[tp.id] || '📄', DX_LABEL[tp.id] || tp.lb || tp.id, 'ثبت سند رسمی ' + (DX_LABEL[tp.id] || tp.lb || tp.id), 'event.stopPropagation();ptfDocxOpen(\'' + ptfOnClickArg(d.cd) + '\',\'' + tp.id + '\')');
        }).join('');
        (host.id && host.id.indexOf('dxHost_') === 0 ? host : host.closest('div')).insertAdjacentHTML(host.id && host.id.indexOf('dxHost_') === 0 ? 'beforeend' : 'beforebegin',
          '<section id="dxBox_' + escP(d.cd) + '" class="sf-docx-summary" onclick="event.stopPropagation()">' +
          '<div class="sf-docx-heading"><span class="sf-docx-heading-icon" aria-hidden="true">📄</span><span><b>اسناد رسمی قالب شرکت</b><small>ایجاد، مشاهده و اصلاح اسناد رسمی پرونده</small></span></div>' +
          '<div class="sf-docx-actions" role="group" aria-label="ثبت سند رسمی پرونده ' + escP(d.inqNo || d.cd) + '">' + createActions + '</div>' +
          (list ? '<div class="sf-docx-existing">' + list + '</div>' : '') + '</section>');
      } catch (e) {}
    };
    return true;
  }
  var t = 0;
  var iv = setInterval(function () { t++; if (patchDrawer() || t > 50) clearInterval(iv); }, 400);
})();

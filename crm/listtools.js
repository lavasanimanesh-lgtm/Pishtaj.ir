/* =====================================================================
   PTF CRM — listtools.js — Sprint 85 — US-189
   ابزار سراسری فهرست‌ها: فیلتر پیشرفته + خروجی Excel(CSV)/PDF(چاپ)
   با انتخاب ستون‌ها و اعمال فیلترهای فعال — برای همه ماژول‌های فهرست‌دار.
   استفاده: دکمه «🧰 فیلتر و خروجی» خودکار کنار جستجوی هر فهرست ثبت‌شده.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- تعریف فهرست‌ها: کلید داده + ستون‌ها (id, برچسب, گتر, نوع) ---------- */
  function C(id, lb, get, type) { return { id: id, lb: lb, get: get, type: type || 'text' }; }
  var LISTS = {
    sup: {
      lb: 'تامین‌کنندگان', key: 'ptf_crm_suppliers',
      cols: [
        C('cd', 'کد', function (r) { return r.cd; }),
        C('co', 'نام', function (r) { return r.co; }),
        C('kind', 'نوع', function (r) { return r.kind || 'حقوقی'; }, 'enum'),
        C('ca', 'دسته', function (r) { return r.ca || ''; }, 'enum'),
        C('ph', 'تلفن', function (r) { return r.ph || ''; }),
        C('crAt', 'تاریخ ثبت', function (r) { return r.crAt || ''; })
      ]
    },
    cust: {
      lb: 'مشتریان', key: 'ptf_crm_customers',
      cols: [
        C('cd', 'کد', function (r) { return r.cd; }),
        C('co', 'نام', function (r) { return r.co; }),
        C('kind', 'نوع', function (r) { return r.kind || 'حقوقی'; }, 'enum'),
        C('ind', 'صنعت', function (r) { return r.ind || ''; }, 'enum'),
        /* v14.7 (US-370 — دستور کارفرما): رابط اصلی (با سمت) در خروجی PDF/CSV — پیش‌فرض تیک‌خورده */
        C('con', 'رابط اصلی', function (r) {
          var pp = (r.people || []).filter(function (p) { return p.primary; })[0] || (r.people || [])[0];
          if (pp && pp.nm) return pp.nm + (pp.role ? ' (' + pp.role + ')' : '');
          return r.con || '';
        }),
        C('ph', 'تلفن', function (r) { return r.ph || ''; }),
        C('crAt', 'تاریخ ثبت', function (r) { return r.crAt || ''; })
      ]
    },
    prod: {
      lb: 'کالاها', key: 'ptf_crm_products',
      cols: [
        C('cd', 'کد', function (r) { return r.cd; }),
        C('nm', 'شرح', function (r) { return r.nm; }),
        C('en', 'نام EN', function (r) { return r.en || ''; }),
        C('ca', 'دسته', function (r) { return r.ca || ''; }, 'enum'),
        C('br', 'برند', function (r) { return r.br || ''; }, 'enum'),
        C('un', 'واحد', function (r) { return r.un || ''; }, 'enum'),
        C('pr', 'قیمت مرجع', function (r) { return +r.pr || 0; }, 'number')
      ]
    },
    off: {
      lb: 'پیشنهادها (TO/CO)', key: 'ptf_crm_offers',
      cols: [
        C('no', 'شماره', function (r) { return r.no; }),
        C('kind', 'نوع', function (r) { return r.kind; }, 'enum'),
        C('buyerCo', 'خریدار', function (r) { return r.buyerCo || ''; }, 'enum'),
        C('inqNo', 'شماره درخواست', function (r) { return r.inqNo || ''; }),
        C('dateEn', 'تاریخ', function (r) { return r.dateEn || ''; }, 'date'),
        C('st', 'وضعیت', function (r) { return r.st || 'draft'; }, 'enum'),
        C('currency', 'ارز', function (r) { return r.currency || 'IRR'; }, 'enum'),
        C('total', 'مبلغ کل', function (r) { return (r.items || []).reduce(function (s, it) { return s + (+it.qty || 0) * (+it.price || 0); }, 0); }, 'number')
      ]
    },
    leads: {
      lb: 'لیدها', key: 'ptf_crm_leads',
      cols: [
        C('cd', 'کد', function (r) { return r.cd; }),
        C('co', 'شرکت', function (r) { return r.co; }),
        C('stage', 'مرحله', function (r) { return r.stage || ''; }, 'enum'),
        C('ind', 'صنعت', function (r) { return r.ind || ''; }, 'enum'),
        C('src', 'منبع', function (r) { return r.src || ''; }, 'enum'),
        C('val', 'ارزش تخمینی', function (r) { return +r.val || 0; }, 'number'),
        C('firstISO', 'اولین تماس', function (r) { return r.firstISO || ''; }, 'date')
      ]
    },
    rfq: {
      lb: 'درخواست‌ها', key: 'ptf_crm_rfqs',
      cols: [
        C('cd', 'کد', function (r) { return r.cd; }),
        C('co', 'کارفرما', function (r) { return r.co || ''; }, 'enum'),
        C('inqNo', 'شماره درخواست', function (r) { return r.inqNo || ''; }),
        C('ca', 'حوزه', function (r) { return r.ca || ''; }, 'enum'),
        C('stxt', 'وضعیت', function (r) { return r.stxt || ''; }, 'enum'),
        C('dt', 'تاریخ', function (r) { return r.dt || ''; })
      ]
    },
    inv: {
      lb: 'فاکتورها', key: 'ptf_crm_invoices',
      cols: [
        C('cd', 'کد', function (r) { return r.cd || r.no || ''; }),
        C('offerNo', 'پیش‌فاکتور', function (r) { return r.offerNo || ''; }),
        C('buyerCo', 'خریدار', function (r) { return r.buyerCo || ''; }, 'enum'),
        C('amount', 'مبلغ', function (r) { return +r.amount || 0; }, 'number'),
        C('paid', 'پرداختی', function (r) { return ((r.payments || []).concat(r.pays || [])).reduce(function (s, p) { return s + (+p.amt || 0); }, 0); }, 'number'),
        C('t', 'تاریخ', function (r) { return r.t || ''; })
      ]
    },
    cnt: {
      lb: 'قراردادها', key: 'ptf_crm_contracts',
      cols: [
        C('no', 'شماره', function (r) { return r.no || r.cd || ''; }),
        C('party', 'طرف قرارداد', function (r) { return r.party || r.buyerCo || ''; }, 'enum'),
        C('t', 'تاریخ', function (r) { return r.t || ''; })
      ]
    },
    let: {
      lb: 'مکاتبات', key: 'ptf_crm_letters',
      cols: [
        C('no', 'اندیکاتور', function (r) { return r.no || '—'; }),
        C('kind', 'صادره/وارده', function (r) { return r.kind === 'IN' ? 'وارده' : 'صادره'; }, 'enum'),
        C('to', 'مخاطب/فرستنده', function (r) { return r.to || r.from || ''; }, 'enum'),
        C('subject', 'موضوع', function (r) { return r.subject || ''; }),
        C('lang', 'زبان', function (r) { return r.lang === 'en' ? 'EN' : 'فا'; }, 'enum'),
        C('t', 'تاریخ', function (r) { return r.t || ''; })
      ]
    },
    prj: {
      lb: 'بایگانی', key: 'ptf_crm_projects',
      cols: [
        C('no', 'شماره', function (r) { return r.no; }),
        C('buyerCo', 'کارفرما', function (r) { return r.buyerCo || ''; }, 'enum'),
        C('offerNo', 'CO مبدا', function (r) { return r.offerNo || ''; }),
        C('state', 'وضعیت', function (r) { return r.state || 'open'; }, 'enum'),
        C('docs', 'تعداد مدارک', function (r) { return (r.docs || []).length; }, 'number'),
        C('t', 'تاریخ تشکیل', function (r) { return r.t || ''; })
      ]
    }
  };

  var _st = { listId: null, filters: [], cols: {} };

  /* ---------- دکمه در پنل‌ها ---------- */
  function injectButtons() {
    // نگاشت پنل فعال → فهرست: با گشتن دنبال باکس‌های sb2 موجود در DOM
    var map = [
      { sel: '#sSrch', id: 'sup' }, { sel: '#cSrch', id: 'cust' }, { sel: '#pSrch', id: 'prod' },
      { sel: '#oFsrch', id: 'off' }, { sel: '#ldSrch', id: 'leads' }, { sel: '#rSrch', id: 'rfq' },
      { sel: '#ltSrch', id: 'let' }, { sel: '#prjSrch', id: 'prj' }
    ];
    map.forEach(function (m) {
      var inp = document.querySelector(m.sel);
      if (!inp || inp.parentElement.querySelector('.lt-btn')) return;
      var b = document.createElement('button');
      b.className = 'bt bt-o lt-btn';
      b.style.cssText = 'font-size:12px;white-space:nowrap';
      b.textContent = '🧰 فیلتر و خروجی';
      b.onclick = function () { ptfListTools(m.id); };
      inp.parentElement.appendChild(b);
    });
  }
  setInterval(function () { try { injectButtons(); } catch (e) {} }, 1200);

  /* ---------- ابزار: مقادیر یکتا برای enum ---------- */
  function uniqVals(def, col) {
    var out = {};
    getData(def.key).forEach(function (r) { var v = col.get(r); if (v !== '' && v != null) out[v] = 1; });
    return Object.keys(out).slice(0, 40);
  }

  /* ---------- دیالوگ اصلی ---------- */
  window.ptfListTools = function (listId) {
    var def = LISTS[listId];
    if (!def) return;
    _st = { listId: listId, filters: [], cols: {} };
    def.cols.forEach(function (c) { _st.cols[c.id] = true; });
    renderToolModal();
  };

  function renderToolModal() {
    var def = LISTS[_st.listId];
    var old = document.getElementById('ltModal');
    if (old) old.remove();
    var colsHtml = def.cols.map(function (c) {
      return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;margin:0 0 6px 12px;cursor:pointer">' +
        '<input type="checkbox" ' + (_st.cols[c.id] ? 'checked' : '') + ' onchange="ltToggleCol(\'' + c.id + '\', this.checked)"> ' + c.lb + '</label>';
    }).join('');
    var filtersHtml = _st.filters.map(function (f, i) {
      var col = def.cols.filter(function (c) { return c.id === f.col; })[0];
      var lbOp = { eq: '=', neq: '≠', gt: '≥', lt: '≤', has: 'شامل' }[f.op] || f.op;
      return '<span style="display:inline-flex;align-items:center;gap:5px;background:#eef2ff;color:#4338ca;border-radius:9px;padding:3px 9px;font-size:11.5px;margin:0 0 5px 6px">' +
        escP(col ? col.lb : f.col) + ' ' + lbOp + ' «' + escP(f.v) + (f.v2 ? ' تا ' + escP(f.v2) : '') + '»' +
        '<a href="javascript:void(0)" onclick="ltDelFilter(' + i + ')" style="color:#dc2626">✕</a></span>';
    }).join('') || '<span style="color:#94a3b8;font-size:12px">فیلتری فعال نیست — همه ردیف‌ها</span>';
    var colOpts = def.cols.map(function (c) { return '<option value="' + c.id + '">' + c.lb + '</option>'; }).join('');
    var rows = ltApply();
    var html = '<div class="md-b" id="ltModal" style="display:grid;z-index:1500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>🧰 فیلتر و خروجی — ' + def.lb + '</h3>' +
      '<div style="border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-bottom:10px">' +
      '<b style="font-size:12.5px">➕ افزودن فیلتر</b>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center">' +
      '<select id="ltFCol" onchange="ltColChanged()" style="padding:7px;border:1px solid var(--brd);border-radius:8px;font-size:12px">' + colOpts + '</select>' +
      '<select id="ltFOp" style="padding:7px;border:1px solid var(--brd);border-radius:8px;font-size:12px"></select>' +
      '<span id="ltFVWrap" style="display:inline-flex;gap:6px"></span>' +
      '<button class="bt" style="font-size:12px" onclick="ltAddFilter()">افزودن</button></div></div>' +
      '<div style="margin-bottom:10px"><b style="font-size:12.5px">فیلترهای فعال:</b><div style="margin-top:6px">' + filtersHtml + '</div></div>' +
      '<div style="border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin-bottom:10px"><b style="font-size:12.5px">🗂 ستون‌های خروجی:</b><div style="margin-top:8px">' + colsHtml + '</div></div>' +
      '<div style="background:#f0f9ff;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#0c4a6e;margin-bottom:10px">📊 نتیجه با فیلترهای فعلی: <b>' + rows.length + '</b> ردیف از ' + getData(def.key).length + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="document.getElementById(\'ltModal\').remove()">بستن</button>' +
      '<button class="bt bt-o" style="color:#059669" onclick="ltExportCsv()">📗 خروجی Excel (CSV)</button>' +
      '<button class="bt" onclick="ltExportPdf()">🖨 خروجی PDF / چاپ</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    ltColChanged();
  }

  window.ltToggleCol = function (id, on) { _st.cols[id] = on; };
  window.ltDelFilter = function (i) { _st.filters.splice(i, 1); renderToolModal(); };

  window.ltColChanged = function () {
    var def = LISTS[_st.listId];
    var colId = (document.getElementById('ltFCol') || {}).value;
    var col = def.cols.filter(function (c) { return c.id === colId; })[0];
    if (!col) return;
    var opEl = document.getElementById('ltFOp');
    var vw = document.getElementById('ltFVWrap');
    var inp = function (id, ph, type) { return '<input id="' + id + '" type="' + (type || 'text') + '" placeholder="' + ph + '" style="padding:7px;border:1px solid var(--brd);border-radius:8px;font-size:12px;width:130px;direction:ltr">'; };
    if (col.type === 'number') {
      opEl.innerHTML = '<option value="between">بازه</option><option value="gt">≥ حداقل</option><option value="lt">≤ حداکثر</option>';
      vw.innerHTML = inp('ltFV', 'از', 'number') + inp('ltFV2', 'تا', 'number');
    } else if (col.type === 'date') {
      opEl.innerHTML = '<option value="between">بازه تاریخ</option>';
      vw.innerHTML = inp('ltFV', '', 'date') + inp('ltFV2', '', 'date');
    } else if (col.type === 'enum') {
      opEl.innerHTML = '<option value="eq">=</option><option value="neq">≠</option>';
      var vals = uniqVals(def, col);
      vw.innerHTML = '<select id="ltFV" style="padding:7px;border:1px solid var(--brd);border-radius:8px;font-size:12px;max-width:190px">' +
        vals.map(function (v) { return '<option>' + escP(v) + '</option>'; }).join('') + '</select>';
    } else {
      opEl.innerHTML = '<option value="has">شامل</option><option value="eq">=</option>';
      vw.innerHTML = inp('ltFV', 'مقدار');
    }
  };

  window.ltAddFilter = function () {
    var colId = document.getElementById('ltFCol').value;
    var op = document.getElementById('ltFOp').value;
    var v = (document.getElementById('ltFV') || {}).value || '';
    var v2 = (document.getElementById('ltFV2') || {}).value || '';
    if (v === '' && v2 === '') { alert('مقدار فیلتر را وارد کنید'); return; }
    _st.filters.push({ col: colId, op: op, v: v, v2: v2 });
    renderToolModal();
  };

  /* ---------- اعمال فیلترها ---------- */
  function ltApply() {
    var def = LISTS[_st.listId];
    var rows = getData(def.key);
    _st.filters.forEach(function (f) {
      var col = def.cols.filter(function (c) { return c.id === f.col; })[0];
      if (!col) return;
      rows = rows.filter(function (r) {
        var val = col.get(r);
        if (col.type === 'number') {
          val = +val || 0;
          if (f.op === 'between') return (f.v === '' || val >= +f.v) && (f.v2 === '' || val <= +f.v2);
          if (f.op === 'gt') return val >= +f.v;
          if (f.op === 'lt') return val <= +f.v;
        }
        if (col.type === 'date') {
          var s = String(val);
          return (f.v === '' || s >= f.v) && (f.v2 === '' || s <= f.v2);
        }
        var sv = String(val).toLowerCase(), fv = String(f.v).toLowerCase();
        if (f.op === 'eq') return sv === fv;
        if (f.op === 'neq') return sv !== fv;
        return sv.indexOf(fv) > -1; // has
      });
    });
    return rows;
  }
  function activeCols() {
    return LISTS[_st.listId].cols.filter(function (c) { return _st.cols[c.id]; });
  }

  /* ---------- خروجی Excel (CSV با BOM — در اکسل فارسی درست باز می‌شود) ---------- */
  window.ltExportCsv = function () {
    var def = LISTS[_st.listId];
    var cols = activeCols();
    var rows = ltApply();
    if (!rows.length) { alert('ردیفی مطابق فیلترها نیست'); return; }
    var data = [cols.map(function (c) { return c.lb; })];
    rows.forEach(function (r) { data.push(cols.map(function (c) { return String(c.get(r)); })); });
    var csv = '\uFEFF' + data.map(function (row) {
      return row.map(function (c) { return '"' + c.replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ptf-' + _st.listId + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    audit('گزارش', 'خروجی Excel از ' + def.lb + ' (' + rows.length + ' ردیف، ' + _st.filters.length + ' فیلتر)', '');
  };

  /* ---------- خروجی PDF (چاپ تمیز) ---------- */
  window.ltExportPdf = function () {
    var def = LISTS[_st.listId];
    var cols = activeCols();
    var rows = ltApply();
    if (!rows.length) { alert('ردیفی مطابق فیلترها نیست'); return; }
    var fDesc = _st.filters.map(function (f) {
      var col = def.cols.filter(function (c) { return c.id === f.col; })[0];
      return (col ? col.lb : f.col) + ' ' + ({ eq: '=', neq: '≠', gt: '≥', lt: '≤', has: 'شامل', between: 'بازه' }[f.op] || '') + ' ' + f.v + (f.v2 ? '–' + f.v2 : '');
    }).join('، ');
    var thead = '<tr><th>#</th>' + cols.map(function (c) { return '<th>' + escP(c.lb) + '</th>'; }).join('') + '</tr>';
    var tbody = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' + cols.map(function (c) {
        var v = c.get(r);
        return '<td' + (c.type === 'number' ? ' class="num"' : '') + '>' + (c.type === 'number' ? (+v).toLocaleString('fa-IR') : escP(String(v))) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var fullHtml = '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>' + def.lb + '</title><style>' +
      '@page{size:A4 ' + (cols.length > 6 ? 'landscape' : 'portrait') + ';margin:12mm}' +
      '*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:Vazirmatn,Tahoma,sans-serif;color:#1f2328;font-size:10.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2pt solid #ef4b1a;padding-bottom:3mm;margin-bottom:4mm}' +
      '.hd img{height:13mm}.hd .t{font-size:13pt;font-weight:800}' +
      '.mt{font-size:8.5pt;color:#64748b;margin-bottom:3mm}' +
      'table{width:100%;border-collapse:collapse;font-size:9pt}thead{display:table-header-group}' +
      'th{background:#f79400;color:#fff;padding:2mm;border:.4pt solid #d98700}' +
      'td{border:.4pt solid #cbd5e1;padding:1.8mm;text-align:center}td.num{text-align:left;direction:ltr;font-variant-numeric:tabular-nums}' +
      'tr:nth-child(even) td{background:#fafbfc}tr{page-break-inside:avoid}' +
      '</style></head><body>' +
      '<div class="hd"><div class="t">📋 ' + def.lb + ' <small style="color:#64748b;font-weight:400">(' + rows.length + ' ردیف)</small></div>' +
      '<img src="../assets/images/ptf-logo-full.png"></div>' +
      '<div class="mt">تاریخ گزارش: ' + faDateTime() + ' | کاربر: ' + escP(curSession().name || '') + (fDesc ? ' | فیلترها: ' + escP(fDesc) : ' | بدون فیلتر') + '</div>' +
      '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>' +
      '</body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') ptfPreviewPrintableDoc('گزارش فهرست — ' + def.lb, fullHtml, 'list-report');
    else {
      var w = window.open('', '_blank');
      w.document.write(fullHtml);
      w.document.close();
    }
    audit('گزارش', 'خروجی PDF از ' + def.lb + ' (' + rows.length + ' ردیف)', '');
  };
})();

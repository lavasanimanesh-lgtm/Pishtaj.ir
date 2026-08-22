/* =====================================================================
   PTF CRM — vat-quarterly.js — v34.7.89 (VAT-LEDGER-001)
   «ارزش افزوده فصلی» — باکس فقط‌محاسبه/نمایش در هاب مالی (تب «ارزش افزوده»)
   ---------------------------------------------------------------------
   منطق (مطابق تصمیم کارفرما):
   - بدهی VAT = جمع VAT فاکتورهای رسمی فروش در فصل.
   - اعتبار VAT = جمع VAT فاکتورهای رسمی خرید (واقعی) + جمع اعتبار VAT
     فاکتورهای صوری/پوششی (coverVatAmount) در همان فصل.
   - کارمزد فاکتورساز «هرگز» در اعتبار/بدهی VAT لحاظ نمی‌شود (نه مالیات است نه
     هزینه رسمی)؛ فقط به‌صورت خودکار در «هزینه جاری غیررسمی» همان ماه ثبت/نمایش
     می‌شود.
   - مانده کاهش‌یافته (net) = بدهی − اعتبار.
     * اعتبار > بدهی → مازاد اعتبار به فصل بعد منتقل می‌شود.
     * بدهی > اعتبار → مبلغ «پرداختنی/تسویه» نمایش داده می‌شود.
   - «تسویه»: بدهی فصل با ثبت «مدرک پرداخت» بسته می‌شود؛ از فصل بعد از صفر شروع.
   - این باکس فقط خواندنی/محاسبه است؛ هیچ داده‌ی مالی دیگر را تغییر نمی‌دهد.
   ===================================================================== */
(function () {
  'use strict';

  var SEASONS = [
    { k: 1, fa: 'بهار', months: [1, 2, 3], icon: '🌸' },
    { k: 2, fa: 'تابستان', months: [4, 5, 6], icon: '☀️' },
    { k: 3, fa: 'پاییز', months: [7, 8, 9], icon: '🍁' },
    { k: 4, fa: 'زمستان', months: [10, 11, 12], icon: '❄️' }
  ];

  function can() { try { return ['admin', 'chairman', 'ceo', 'commercial', 'accountant'].indexOf(curRole()) > -1; } catch (e) { return false; } }
  function money(n) { n = +n || 0; try { return n.toLocaleString('fa-IR'); } catch (e) { return String(n); } }
  function fa(n) { return String(n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function nowYear() { try { var p = new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/'); return p[0]; } catch (e) { try { return String(parseInt(faDate().split('/')[0], 10)); } catch (e2) { return '1405'; } } }
  function yearOfJ(m) { return String(m || '').split('/')[0]; }
  function monthOfJ(m) { var p = String(m || '').split('/'); return p[1] ? parseInt(p[1], 10) : 0; }
  function isoYear(s) { try { var mm = String(s || '').match(/(13|14)\d{2}/); return mm ? mm[0] : ''; } catch (e) { return ''; } }
  function isoMonth(s) { try { var mm = String(s || '').match(/-(0[1-9]|1[0-2])-/); return mm ? +mm[1] : 0; } catch (e) { return 0; } }

  /* تشخیص فصل یک فاکتور — تاریخ شمسی یا ISO */
  function seasonOfInv(inv, which) {
    var y = '', m = 0;
    if (which === 'sales') {
      var d = inv && (inv.invDate || inv.issueDate || inv.t || '');
      y = isoYear(d) || yearOfJ(d);
      m = isoMonth(d) || monthOfJ(d);
    } else {
      var d2 = inv && (inv.dateFa || inv.dateISO || inv.t || '');
      y = isoYear(d2) || yearOfJ(d2);
      m = isoMonth(d2) || monthOfJ(d2);
    }
    for (var i = 0; i < SEASONS.length; i++) if (SEASONS[i].months.indexOf(m) > -1) return { year: y, season: SEASONS[i].k };
    return null;
  }

  function activeSales(inv) {
    if (!inv) return false;
    var st = String(inv.status || inv.st || '');
    if (/void|voided|deleted|superseded|replaced/i.test(st) || inv.voided) return false;
    if (inv.isUnofficial) return false;
    return true;
  }
  function activePurchase(inv) {
    if (!inv) return false;
    if (inv.status === 'void' || inv.st === 'void' || inv.voided) return false;
    if (inv.isOfficial === false) return false;
    /* فاکتور غیررسمی یا نامشخص وارد نمی‌شود */
    if (inv.isOfficial !== true && !inv.isCover) return false;
    return true;
  }

  function byYearSeason(rows) {
    var out = {};
    rows.forEach(function (r) { var k = (r.year || '') + '|' + (r.season || ''); out[k] = out[k] || []; out[k].push(r); });
    return out;
  }

  /* محاسبه یک دوره */
  function calc(year, season) {
    var sales = [], purchase = [];
    (getData('ptf_crm_invoices') || []).forEach(function (i) {
      if (!activeSales(i)) return;
      var st = seasonOfInv(i, 'sales');
      if (st && String(st.year) === String(year) && st.season === season) sales.push(i);
    });
    var sf = (function () { try { var d = getData('ptf_crm_supplier_finance') || {}; return d && d.invoices ? d.invoices : []; } catch (e) { return []; } })();
    sf.forEach(function (i) {
      if (!activePurchase(i)) return;
      var st = seasonOfInv(i, 'purchase');
      if (st && String(st.year) === String(year) && st.season === season) purchase.push(i);
    });
    var salesVat = sales.reduce(function (s, i) { return s + (+i.vat || +i.vatAmountIRR || 0); }, 0);
    var purchaseCredit = purchase.reduce(function (s, i) {
      /* فاکتور پوششی: اعتبار = coverVatAmount (کارمزد جدا می‌شود) */
      if (i.isCover === true) return s + (+i.coverVatAmount || 0);
      /* فاکتور رسمی واقعی: اعتبار = vatAmount */
      return s + (+i.vatAmount || 0);
    }, 0);
    var coverComm = purchase.reduce(function (s, i) { return s + (i.isCover === true ? (+i.coverCommissionAmount || 0) : 0); }, 0);
    var net = salesVat - purchaseCredit;
    return { year: year, season: season, salesVat: salesVat, purchaseCredit: purchaseCredit, coverCommission: coverComm, net: net, salesCount: sales.length, purchaseCount: purchase.length };
  }

  /* خواندن/ذخیره مانده تسویه‌ها (بدهی بسته‌شده) — کلید جدا برای جلوگیری از قاطی‌شدن */
  function settlements() { try { var v = getData('ptf_crm_vat_settlements') || []; return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function saveSettlements(list) { setData('ptf_crm_vat_settlements', list); }
  function settlementFor(y, s) { return settlements().filter(function (x) { return String(x.year) === String(y) && +x.season === +s; }).sort(function (a, b) { return String(b.t || '').localeCompare(String(a.t || '')); })[0] || null; }

  /* حالت یک فصل: carry از قبلی + تسویه */
  function stateFor(y, s) {
    var cur = calc(y, s);
    var sett = settlementFor(y, s);
    var prev = s === 1 ? null : calc(y, s - 1);
    /* اعتبار مازاد فصل قبل به این فصل منتقل می‌شود (فقط اگر تسویه نشده باشد) */
    var prevCarry = 0;
    if (prev && !settlementFor(y, s - 1)) {
      if (prev.net < 0) prevCarry = Math.abs(prev.net);
    }
    var availableCredit = cur.purchaseCredit + prevCarry;
    var due = Math.max(0, cur.salesVat - availableCredit);
    var carryToNext = Math.max(0, availableCredit - cur.salesVat);
    var payable = sett ? 0 : due; /* اگر تسویه شده → پرداختی ندارد */
    return { cur: cur, prevCarry: prevCarry, availableCredit: availableCredit, due: due, carryToNext: carryToNext, payable: payable, settled: !!sett, settlement: sett };
  }

  function html() {
    if (!can()) return '<div style="text-align:center;color:#94a3b8;padding:30px">⛔ این بخش فقط برای مدیران ارشد و حسابدار است.</div>';
    var y = window._ptfVatYear || nowYear();
    var rate = (typeof window.ptfVatRateOf === 'function') ? window.ptfVatRateOf(y) : 10;
    var s = (function () { try { var v = getData('ptf_crm_settings') || {}; return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; } catch (e) { return {}; } })();
    var h = '<div id="vatBox" style="background:var(--crd,#fff);border:1px solid var(--brd,#cbd5e1);border-radius:14px;padding:15px;margin-top:15px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      '<h4 style="margin:0;font-size:14px;color:#0f172a">📊 ارزش افزوده فصلی (بدهی/اعتبار مالیاتی)</h4>' +
      '<span style="font-size:11.5px;color:#64748b">درصد مصوب سال ' + fa(y) + ': <b style="color:#c2410c">' + rate + '٪</b> — از هاب مالی.</span></div>' +
      '<div class="fr" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '<div class="fld" style="flex:1;min-width:120px"><label>سال مالی</label><input id="vatYear" type="number" value="' + escP(y) + '" style="width:100%;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr" onchange="ptfVatQuarterlyRender()"></div>' +
      '<div class="fld" style="flex:1;min-width:200px"><label>درصد مصوب ارزش افزوده این سال</label><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input id="vatRateInput" type="number" min="0" max="100" step="0.01" value="' + rate + '" style="width:90px;padding:6px;border:1px solid var(--brd);border-radius:8px;direction:ltr"><span style="font-weight:700">٪</span><button class="bt bt-o" style="font-size:11px;padding:3px 9px" onclick="ptfVatRateSaveYear()">ذخیره نرخ سال</button></div></div>' +
      '</div>' +
      '<div id="vatQuarterlyResults"></div></div>';
    return h;
  }

  window.ptfVatQuarterlyHtml = html;

  window.ptfVatQuarterlyRender = function () {
    if (!can()) return;
    var y = String((document.getElementById('vatYear') || {}).value || window._ptfVatYear || nowYear()).trim();
    window._ptfVatYear = y;
    var el = document.getElementById('vatQuarterlyResults');
    if (!el) return;
    var rate = (typeof window.ptfVatRateOf === 'function') ? window.ptfVatRateOf(y) : 10;
    var rateEl = document.getElementById('vatRateInput');
    if (rateEl) rateEl.value = rate;

    var rows = SEASONS.map(function (s) { return stateFor(y, s.k); });
    var h = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead>' +
      '<tr><th style="text-align:right;padding:7px;border-bottom:2px solid var(--brd)">فصل</th>' +
      '<th style="text-align:left;padding:7px;border-bottom:2px solid var(--brd)">بدهی VAT فروش</th>' +
      '<th style="text-align:left;padding:7px;border-bottom:2px solid var(--brd)">اعتبار VAT خرید</th>' +
      '<th style="text-align:left;padding:7px;border-bottom:2px solid var(--brd)">اعتبار منتقل‌شده</th>' +
      '<th style="text-align:left;padding:7px;border-bottom:2px solid var(--brd)">مانده</th>' +
      '<th style="text-align:left;padding:7px;border-bottom:2px solid var(--brd)">وضعیت</th>' +
      '<th style="text-align:left;padding:7px;border-bottom:2px solid var(--brd)">عملیات</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var st = r.cur.net;
      var status = r.settled
        ? '<span style="color:#059669;font-weight:800">✔ تسویه شد</span>'
        : (st < 0
          ? '<span style="color:#0e7490;font-weight:800">اعتبار مازاد → ' + fa(r.carryToNext) + ' ریال به فصل بعد</span>'
          : (st > 0 ? '<span style="color:#b91c1c;font-weight:800">پرداختنی: ' + money(r.payable) + ' ریال</span>' : '<span style="color:#64748b">—</span>'));
      var act = '';
      if (r.payable > 0 && !r.settled) {
        act = '<button class="bt bt-o" style="font-size:11px;padding:3px 9px;color:#b91c1c" onclick="ptfVatSettle(' + y + ',' + r.cur.season + ',' + r.payable + ')">💳 تسویه</button>';
      }
      h += '<tr>' +
        '<td style="padding:7px;border-bottom:1px solid var(--brd)">' + SEASONS[r.cur.season - 1].icon + ' ' + SEASONS[r.cur.season - 1].fa + '</td>' +
        '<td style="padding:7px;border-bottom:1px solid var(--brd);text-align:left">' + money(r.cur.salesVat) + '</td>' +
        '<td style="padding:7px;border-bottom:1px solid var(--brd);text-align:left">' + money(r.cur.purchaseCredit) + '</td>' +
        '<td style="padding:7px;border-bottom:1px solid var(--brd);text-align:left">' + money(r.prevCarry) + '</td>' +
        '<td style="padding:7px;border-bottom:1px solid var(--brd);text-align:left;font-weight:800">' + money(st) + '</td>' +
        '<td style="padding:7px;border-bottom:1px solid var(--brd)">' + status + '</td>' +
        '<td style="padding:7px;border-bottom:1px solid var(--brd)">' + act + '</td></tr>';
    });
    h += '</tbody></table><p style="font-size:11px;color:#64748b;margin-top:8px">' +
      '💡 کارمزد فاکتورساز در اعتبار/بدهی VAT محاسبه نمی‌شود (فقط هزینه جاری غیررسمی همان ماه ثبت می‌شود). تسویه‌ی بدهی با «مدرک پرداخت» ثبت می‌شود و فصل بعد از صفر شروع می‌شود.</p>';
    el.innerHTML = h;
  };

  /* ذخیره نرخ سال در هاب مالی (همان منبعی که فاکتورها می‌خوانند) */
  window.ptfVatRateSaveYear = function () {
    var y = String((document.getElementById('vatYear') || {}).value || window._ptfVatYear || nowYear()).trim();
    var pct = +(document.getElementById('vatRateInput') || {}).value || 0;
    var reason = prompt('دلیل ثبت درصد مصوب ارزش افزوده سال ' + y + ':', 'نرخ مصوب سال مالی') || '';
    if (!reason.trim()) { alert('دلیل الزامی است'); return; }
    if (typeof window.ptfVatRateSet === 'function') {
      var r = window.ptfVatRateSet(y, pct, reason.trim());
      if (!r.ok) { alert('❌ ذخیره نشد: ' + r.error); return; }
    }
    if (typeof ptfToast === 'function') ptfToast('درصد ' + pct + '٪ به‌عنوان نرخ سال ' + y + ' ذخیره شد', 'ok');
    window.ptfVatQuarterlyRender();
  };

  /* تسویه بدهی با مدرک پرداخت */
  window.ptfVatSettle = function (year, season, amount) {
    if (!can()) { alert('⛔ دسترسی ندارید'); return; }
    var y = String(year), s = +season, amt = +amount || 0;
    if (amt <= 0) { alert('مبلغ پرداختی صفر است'); return; }
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '💳 تسویه بدهی ارزش افزوده — فصل ' + SEASONS[s - 1].fa + ' ' + y,
        body: 'مبلغ پرداختی (از مانده محاسبه‌شده) و مدرک/مرجع پرداخت ثبت می‌شود. پس از تایید، این فصل «تسویه شده» و فصل بعد از صفر شروع می‌شود.',
        fields: [
          { id: 'amt', label: 'مبلغ تسویه (ریال) *', type: 'number', value: amt, dir: 'ltr', required: true },
          { id: 'ref', label: 'شماره/مرجع مدرک پرداخت *', type: 'text', required: true },
          { id: 'note', label: 'توضیح', type: 'textarea', rows: 2 },
          { id: 'files', label: 'پیوست رسید/مدرک پرداخت', type: 'upload', uploadFolder: 'vat-settlements/' + y + '-' + s }
        ],
        okText: '💳 ثبت تسویه',
        onOk: function (v) {
          var list = settlements();
          var already = settlementFor(y, s);
          if (already) { alert('این فصل قبلاً تسویه شده است.'); return; }
          list.unshift({
            cd: (typeof genCode === 'function' ? genCode('VATSTL') : ('VATSTL-' + Date.now())),
            year: y, season: s, amount: +v.amt || 0, ref: (v.ref || '').trim(),
            note: (v.note || '').trim(), files: (v.files || []).slice(),
            t: (typeof faDateTime === 'function' ? faDateTime() : new Date().toLocaleString('fa-IR')),
            by: (function () { try { return curSession().name; } catch (e) { return ''; } })()
          });
          saveSettlements(list);
          try { if (typeof audit === 'function') audit('ارزش افزوده', 'تسویه بدهی فصل ' + y + ' / ' + s + ' — ' + money(v.amt || 0) + ' ریال', (v.ref || '')); } catch (e) {}
          if (typeof ptfToast === 'function') ptfToast('✅ تسویه ثبت شد — فصل بعد از صفر شروع می‌شود', 'ok');
          window.ptfVatQuarterlyRender();
        }
      });
      return;
    }
    var amt2 = prompt('مبلغ تسویه (ریال):', String(amt));
    if (!amt2) return;
    var ref = prompt('شماره/مرجع مدرک پرداخت:');
    if (!ref) return;
    var list = settlements();
    list.unshift({ cd: 'VATSTL-' + Date.now(), year: y, season: s, amount: +amt2 || 0, ref: ref.trim(), note: '', files: [], t: new Date().toLocaleString('fa-IR'), by: (function () { try { return curSession().name; } catch (e) { return ''; } })() });
    saveSettlements(list);
    window.ptfVatQuarterlyRender();
  };
})();

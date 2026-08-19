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
      return { i: i, name: it.name || '', desc: it.desc || '', model: it.model || '', unit: it.unit || '',
        pcode: it.pcode || '', brand: it.brand || '', qty: +it.qty || 0, price: +it.price || 0 };
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
      setData('ptf_crm_purchase_returns', prs);
      out.supplierReturn = retLines.length; out.returnValue = value;
      if (value > 0) W.ptfSupplierReturnCredit(pr);
    }
    return out;
  };

  /* سند بستانکار در حساب تأمین‌کننده (کاهش بدهی ما) — علامت منفی طبق قرارداد supplier-finance */
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
      d.adjustments.unshift({
        cd: (typeof genCode === 'function' ? genCode('ADJ') : 'ADJ-' + Date.now()),
        supplierCd: pr.supplierCd, amount: -Math.abs(+pr.amount || 0), cur: pr.cur || 'IRR',
        kind: 'purchase_return', status: 'posted', dateISO: iso, dateFa: pr.at,
        by: pr.by || who(), sourceReturnCd: pr.cd, caseId: pr.caseId || '',
        note: 'مرجوعی خرید (اقلام مردود بازرسی) — پرونده ' + (pr.inqNo || pr.caseId || '') + ' | سند ' + pr.cd
      });
      if (typeof setData === 'function') setData(KEY, d); else localStorage.setItem(KEY, JSON.stringify(d));
      try { if (typeof audit === 'function') audit('حساب تامین', 'سند بستانکار مرجوعی خرید ' + money(pr.amount) + ' ریال — ' + pr.cd, pr.supplierCd); } catch (eA) {}
      return true;
    } catch (e) { try { console.error('ptfSupplierReturnCredit', e); } catch (e4) {} return false; }
  };

  /* ---------------- P5: بازنگری سند برد ---------------- */
  W.ptfAwardReviseOpen = function (caseId) {
    if (!canRevise()) { alert('⛔ بازنگری سند برد فقط برای مدیران ارشد/تجاری مجاز است'); return; }
    var c = findCase(caseId);
    if (!c) { alert('⛔ پروندهٔ فروش یافت نشد'); return; }
    var aw = awardLines(c);
    if (!aw.offer) { alert('⛔ سند برد این پرونده پیدا نشد (wonOffer: ' + (c.wonOffer || '—') + ')'); return; }
    if (!aw.items.length) { alert('⛔ سند برد قلمی ندارد'); return; }
    /* پیش‌پرکردن با آخرین بازرسی: تعداد پذیرفته‌شده جای تعداد اولیه می‌نشیند */
    var insp = (c.inspections || [])[0];
    var rejByKey = {};
    if (insp) (insp.lines || []).forEach(function (l) { rejByKey[String(l.itemKey || l.pcode || l.name)] = +l.qtyRejected || 0; });

    document.querySelectorAll('#ptfReviseDlg').forEach(function (x) { x.remove(); });
    var rows = aw.items.map(function (it, i) {
      var key = (typeof W.ptfProcLineKey === 'function') ? W.ptfProcLineKey(it) : (it.pcode || it.name);
      var rej = +rejByKey[String(key)] || 0;
      var keepQty = Math.max(0, it.qty - rej);
      return '<tr data-i="' + i + '">' +
        '<td style="padding:4px;text-align:center"><input type="checkbox" data-f="keep" ' + (keepQty > 0 ? 'checked' : '') + '></td>' +
        '<td style="padding:4px;font-size:12px"><b>' + esc(it.name || '—') + '</b>' + (it.desc && it.desc !== it.name ? '<br><small style="color:#94a3b8">' + esc(it.desc) + '</small>' : '') +
          (rej ? '<br><small style="color:#b45309">مردود بازرسی: ' + money(rej) + '</small>' : '') + '</td>' +
        '<td style="padding:4px;text-align:center;font-size:12px;color:#64748b">' + money(it.qty) + '</td>' +
        '<td style="padding:4px"><input type="number" min="0" step="any" data-f="qty" value="' + keepQty + '" style="width:82px;padding:4px;border:1px solid var(--brd);border-radius:7px;direction:ltr" oninput="ptfAwardRevisePreview()"></td>' +
        '<td style="padding:4px;text-align:center;font-size:12px;color:#64748b">' + money(it.price) + '</td>' +
        '<td style="padding:4px"><input type="number" min="0" step="any" data-f="price" value="' + it.price + '" style="width:120px;padding:4px;border:1px solid #ddd6fe;border-radius:7px;direction:ltr" oninput="ptfAwardRevisePreview()"></td>' +
        '<td style="padding:4px;text-align:left;direction:ltr;font-size:12px" class="ptfRevRowTotal">' + money(keepQty * it.price) + '</td>' +
        '</tr>';
    }).join('');
    var oldTotal = aw.items.reduce(function (s, it) { return s + it.qty * it.price; }, 0);
    var html = '<div class="md-b" id="ptfReviseDlg" style="display:grid;z-index:2950" onclick="if(event.target===this)this.remove()">' +
      '<div class="md" style="max-width:980px;max-height:92vh;overflow:auto">' +
      '<h3>✏️ بازنگری سند برد — ' + esc(c.inqNo || idOf(c)) + '</h3>' +
      '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:8px;font-size:12px;color:#9a3412;margin-bottom:8px">' +
      'سند برد فعلی <b>' + esc(aw.offer.no) + '</b> حذف نمی‌شود؛ بایگانی می‌شود و یک «سند برد جایگزین» با اقلام و قیمت‌های جدید ساخته می‌شود. ' +
      'اگر برای این پرونده فاکتور رسمی صادر شده باشد، کاهش مبلغ مسدود است.</div>' +
      '<div class="tb2"><table><thead><tr><th>حفظ</th><th>قلم</th><th>تعداد قبلی</th><th>تعداد جدید</th><th>قیمت قبلی</th><th>قیمت جدید</th><th>جمع</th></tr></thead>' +
      '<tbody id="ptfRevBody">' + rows + '</tbody></table></div>' +
      '<div id="ptfRevPreview" data-old="' + oldTotal + '" style="margin-top:10px;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:9px;font-size:12.5px"></div>' +
      '<div class="fld" style="margin-top:8px"><label>دلیل بازنگری * (در سند اصلاحی ثبت می‌شود)</label>' +
      '<textarea id="ptfRevReason" rows="2" placeholder="مثلاً: رد شدن ۳ عدد شیر توپی در بازرسی و توافق قیمت جدید برای اقلام باقی‌مانده"></textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#7c3aed;color:#fff;font-weight:800" onclick="ptfAwardReviseSubmit(\'' + arg(idOf(c)) + '\')">ثبت سند برد جدید</button></div>' +
      '</div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    W.ptfAwardRevisePreview();
  };

  W.ptfAwardRevisePreview = function () {
    var dlg = document.getElementById('ptfReviseDlg'); if (!dlg) return;
    var box = dlg.querySelector('#ptfRevPreview'); if (!box) return;
    var oldTotal = +box.getAttribute('data-old') || 0, newTotal = 0, kept = 0, removed = 0, repriced = 0;
    dlg.querySelectorAll('#ptfRevBody tr').forEach(function (tr) {
      var keep = (tr.querySelector('[data-f="keep"]') || {}).checked;
      var qty = +((tr.querySelector('[data-f="qty"]') || {}).value) || 0;
      var price = +((tr.querySelector('[data-f="price"]') || {}).value) || 0;
      var tds = tr.querySelectorAll('td');
      var oldQty = +String((tds[2] || {}).textContent || '').replace(/[^\d.]/g, function (m) { return ''; }) || 0;
      var cell = tr.querySelector('.ptfRevRowTotal');
      var rowTotal = (keep && qty > 0) ? qty * price : 0;
      if (cell) cell.textContent = money(rowTotal);
      if (!keep || qty <= 0) { removed++; return; }
      kept++; newTotal += rowTotal;
      if (oldQty && qty !== oldQty) repriced++;
    });
    var delta = newTotal - oldTotal;
    box.innerHTML = '<b>مبلغ فعلی سند برد:</b> ' + money(oldTotal) + ' ریال &nbsp;|&nbsp; ' +
      '<b>مبلغ جدید:</b> ' + money(newTotal) + ' ریال &nbsp;|&nbsp; ' +
      '<b style="color:' + (delta < 0 ? '#b91c1c' : delta > 0 ? '#047857' : '#475569') + '">دلتا: ' + (delta > 0 ? '+' : '') + money(delta) + ' ریال</b>' +
      '<div style="color:#64748b;margin-top:4px">اقلام باقی‌مانده: ' + kept + ' | حذف‌شده: ' + removed + '</div>';
  };

  W.ptfAwardReviseSubmit = function (caseId) {
    var dlg = document.getElementById('ptfReviseDlg'); if (!dlg) return;
    if (!canRevise()) { alert('⛔ مجاز نیستید'); return; }
    var c = findCase(caseId); if (!c) { alert('⛔ پرونده یافت نشد'); return; }
    var aw = awardLines(c);
    var reason = String((dlg.querySelector('#ptfRevReason') || {}).value || '').trim();
    if (!reason) { alert('⛔ دلیل بازنگری الزامی است'); return; }
    var lines = [];
    dlg.querySelectorAll('#ptfRevBody tr').forEach(function (tr) {
      var i = +tr.getAttribute('data-i'); var src = aw.items[i]; if (!src) return;
      if (!(tr.querySelector('[data-f="keep"]') || {}).checked) return;
      var qty = +((tr.querySelector('[data-f="qty"]') || {}).value) || 0;
      var price = +((tr.querySelector('[data-f="price"]') || {}).value) || 0;
      if (qty <= 0) return;
      lines.push({ name: src.name, desc: src.desc, model: src.model, unit: src.unit, pcode: src.pcode, brand: src.brand, qty: qty, price: price });
    });
    if (!lines.length) { alert('⛔ حداقل یک قلم با تعداد بزرگ‌تر از صفر باید باقی بماند.'); return; }
    var oldTotal = aw.items.reduce(function (s, it) { return s + it.qty * it.price; }, 0);
    var newTotal = lines.reduce(function (s, it) { return s + it.qty * it.price; }, 0);
    if (!confirm('سند برد ' + (aw.offer.no || '') + ' بایگانی و سند جدید با مبلغ ' + money(newTotal) + ' ریال ثبت شود؟\n\nمبلغ فعلی: ' + money(oldTotal) + ' ریال\nدلتا: ' + money(newTotal - oldTotal) + ' ریال')) return;
    if (typeof W.ptfSalesDomainApi !== 'function') { alert('⛔ ماژول سرور فروش بارگذاری نشده است؛ بازنگری سند برد فقط از مسیر سرور انجام می‌شود.'); return; }
    W.ptfSalesDomainApi('revise_award', {
      caseId: idOf(c), reason: reason, lines: lines,
      idempotencyKey: 'REVISE-AWARD|' + idOf(c) + '|' + newTotal + '|' + Date.now()
    }).then(function (d) {
      var r = (d && d.result) || {};
      dlg.remove();
      toast('✅ سند برد جدید ' + (r.revisionOfferNo || '') + ' ثبت شد — مبلغ مؤثر: ' + money(r.newAmount || newTotal) + ' ریال', 'ok');
      if (typeof renderDeals === 'function') renderDeals();
      if (typeof renderOffers === 'function') renderOffers();
    }).catch(function (e) {
      var msg = (e && e.message) ? e.message : String(e || '');
      if (msg.indexOf('official_invoice_blocks_decrease') > -1) {
        alert('⛔ برای این پرونده فاکتور رسمی صادر شده است؛ کاهش مبلغ سند برد مسدود است.\n\nمسیر درست: ابطال/اصلاحیهٔ فاکتور رسمی، سپس بازنگری سند برد.');
      } else {
        alert('⛔ بازنگری سند برد انجام نشد: ' + msg);
      }
    });
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

/* =====================================================================
   PTF CRM — cheque-panel.js — CHQ-MOD-001
   پنل «🧾 چک‌ها» در هاب مالی: دو زیرتب صادره/وارده + ثبت + عملیات + گزارش.
   ===================================================================== */
(function () {
  'use strict';

  function stLabel(c) {
    if (!c) return '';
    if (c.direction === 'received') {
      return { open: 'دریافت‌شده', held: 'در ید شرکت', endorsed: 'انتقال به تامین‌کننده', cleared: 'وصول‌شده', bounced: 'برگشتی', voided_transfer: 'انتقال ابطال‌شده', void: 'ابطال‌شده' }[c.st] || c.st;
    }
    return { open: 'صادرشده / در گردش', cleared: 'وصول‌شده', retrieved: 'مسترد شد (ضمانت)', void: 'ابطال‌شده', transferred: 'انتقال', voided_transfer: 'انتقال ابطال‌شده' }[c.st] || c.st;
  }
  function stColor(c) {
    var s = (c && c.st) || '';
    if (s === 'cleared' || s === 'retrieved') return '#047857';
    if (s === 'bounced' || s === 'void' || s === 'voided_transfer') return '#dc2626';
    if (s === 'endorsed' || s === 'transferred') return '#0e7490';
    return '#b45309';
  }
  function money(v) { return (+v || 0).toLocaleString('fa-IR'); }
  function faD(d) { return d || '—'; }
  function escP(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  window.ptfChequePanelSub = 'issued'; /* issued | received */
  window.ptfChequeSetSub = function (s) { window.ptfChequePanelSub = s === 'received' ? 'received' : 'issued'; window.ptfChequePanelRender(); };

  function issuedRows() {
    return (typeof window.ptfChequeIssued === 'function' ? window.ptfChequeIssued() : [])
      .slice().sort(function (a, b) { return (a.dueISO || '') < (b.dueISO || '') ? -1 : 1; });
  }
  function receivedRows() {
    return (typeof window.ptfChequeReceived === 'function' ? window.ptfChequeReceived() : [])
      .slice().sort(function (a, b) { return (a.dueISO || '') < (b.dueISO || '') ? -1 : 1; });
  }

  function kindBadge(c) {
    if (c.kind !== 'guarantee') return '<span class="bd cheque-kind-badge cheque-kind-finance">مالی</span>';
    var sub = ({ advance: 'پیش‌پرداخت', performance: 'حسن انجام کار', bid: 'مناقصه', other: 'سایر' })[c.guarType] || 'ضمانت';
    return '<span class="bd cheque-kind-badge cheque-kind-guarantee"><span class="cheque-kind-icon" aria-hidden="true">🛡</span><span>ضمانت ' + sub + '</span></span>';
  }
  function partyBadge(c) {
    var k = typeof window.ptfChequePartyKind === 'function' ? window.ptfChequePartyKind(c) : 'other';
    if (k === 'sup') return '<span class="bd cheque-party-badge cheque-party-sup">تأمین‌کننده</span>';
    if (k === 'cust') return '<span class="bd cheque-party-badge cheque-party-cust">مشتری</span>';
    if (k === 'third') return '<span class="bd cheque-party-badge cheque-party-third">ثالث</span>';
    return '<span class="bd cheque-party-badge cheque-party-other">سایر</span>';
  }
  /* MOB-041: actionهای ردیف چک باید آیکون صریح داشته باشند؛ «حذف» دائمی و
     «ابطال» عملیاتی دو معنا/دو نشانهٔ متفاوت دارند و دیگر به شکل دو سطل یا چرخ‌دنده دیده نمی‌شوند. */
  function chequeRowAction(kind, icon, label, title, onClick, wide) {
    return '<button type="button" class="ba cheque-row-action cheque-row-' + kind + (wide ? ' is-wide' : '') + '" data-cheque-action="' + kind + '" title="' + escP(title || label) + '" aria-label="' + escP(title || label) + '" onclick="' + onClick + '">' +
      '<span class="cheque-row-icon" aria-hidden="true">' + icon + '</span><span class="cheque-row-label">' + label + '</span></button>';
  }
  function issuedTable() {
    var rows = issuedRows();
    var body = rows.map(function (c) {
      return '<tr><td class="cheque-cell-id"><div class="cheque-cell-content"><b dir="ltr">' + escP(c.sayad || c.no || '—') + '</b><br>' + kindBadge(c) + '</div></td><td class="cheque-cell-party"><div class="cheque-cell-content"><span class="cheque-party-name">' + escP(c.toWhom || c.payeeName || '—') + '</span><br>' + partyBadge(c) + (c.dealCd ? '<br><small class="cheque-deal-link">📁 ' + escP(c.dealLabel || c.dealCd) + '</small>' : '') + '</div></td><td>' + escP(c.bank || '—') + '</td><td>' + faD(c.dueFa || c.dueISO) + '</td><td>' + money(c.amt) + '</td><td style="color:' + stColor(c) + '">' + stLabel(c) + '</td><td class="cheque-cell-actions">' + issuedActs(c) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px">چک صادره‌ای ثبت نشده است</td></tr>';
    var openSum = rows.filter(function (c) { return c.st === 'open'; }).reduce(function (s, c) { return s + (+c.amt || 0); }, 0);
    return '<div class="tb2" style="margin-top:8px"><table><thead><tr><th>شماره/صیادی</th><th>طرف</th><th>بانک</th><th>سررسید</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div style="margin-top:8px;font-size:12.5px"><b style="color:#b45309">جمع چک‌های در گردش: ' + money(openSum) + ' ریال</b></div>';
  }

  function receivedTable() {
    var rows = receivedRows();
    var body = rows.map(function (c) {
      var custNm = c.payerName || c.toWhom || c.sourceCustomerCd || '—';
      return '<tr><td class="cheque-cell-id"><div class="cheque-cell-content"><b dir="ltr">' + escP(c.sayad || c.no || '—') + '</b><br>' + kindBadge(c) + '</div></td><td class="cheque-cell-party"><div class="cheque-cell-content"><span class="cheque-party-name">' + escP(custNm) + '</span><br>' + partyBadge(c) + (c.sourceInvoiceCd ? '<br><small class="cheque-deal-link">🧾 ' + escP(c.sourceInvoiceCd) + '</small>' : '') + '</div></td><td>' + escP(c.bank || '—') + '</td><td>' + faD(c.dueFa || c.dueISO) + '</td><td>' + money(c.amt) + '</td><td style="color:' + stColor(c) + '">' + stLabel(c) + '</td><td class="cheque-cell-actions">' + receivedActs(c) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px">چک وارده‌ای ثبت نشده است</td></tr>';
    var openSum = rows.filter(function (c) { return c.st === 'open' || c.st === 'held' || c.st === 'endorsed'; }).reduce(function (s, c) { return s + (+c.amt || 0); }, 0);
    return '<div class="tb2" style="margin-top:8px"><table><thead><tr><th>شماره/صیادی</th><th>صادرکننده</th><th>بانک</th><th>سررسید</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div style="margin-top:8px;font-size:12.5px"><b style="color:#0e7490">جمع چک‌های فعال وارده: ' + money(openSum) + ' ریال</b></div>';
  }

  function issuedActs(c) {
    var acts = '';
    var hasDocs = (c.files || []).length > 0;
    acts += chequeRowAction('docs', hasDocs ? '📎' : '📎', hasDocs ? 'سند (' + c.files.length + ')' : 'سند', hasDocs ? 'مشاهده/حذف عکس یا کپی چک' : 'افزودن عکس/کپی چک', 'ptfChequeFilesUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    acts += chequeRowAction('edit', '✏️', 'ویرایش', 'ویرایش چک', 'ptfChequeEditUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    acts += chequeRowAction('delete', '🗑', 'حذف', 'حذف کامل چک و اثر مالی مرتبط', 'ptfChequeDeleteUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    if (c.st === 'open' || c.st === 'transferred') {
      if (c.kind === 'guarantee') {
        /* 🏆 استرداد ضمانت: با پایان پروژه مسترد می‌شود؛ این مسیر با حذف کامل فرق دارد. */
        acts += chequeRowAction('retrieve', '🏆', 'استرداد ضمانت', 'ثبت استرداد چک ضمانت از کارفرما', 'ptfChequeRetrieveUi(\'' + ptfOnClickArg(c.cd) + '\')', true);
      } else {
        acts += chequeRowAction('clear', '✓', 'وصول', 'ثبت وصول یا پاس‌شدن چک صادره', 'ptfChequeClearIssuedUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
        acts += chequeRowAction('void', '⛔', 'ابطال', 'ابطال عملیاتی چک بدون حذف کامل رکورد', 'ptfChequeVoidIssuedUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
      }
    } else if (c.st === 'retrieved') {
      acts += '<span class="bd cheque-status-retrieved">مسترد شد</span>';
    }
    if (c.dealCd && typeof window.ptfGoSalesFile === 'function') acts += chequeRowAction('deal', '📁', 'پرونده', 'رفتن به پرونده فروش مرتبط', 'ptfGoSalesFile(\'' + ptfOnClickArg(c.dealCd) + '\')', false);
    else if (c.dealCd && typeof goPanel === 'function') acts += chequeRowAction('deal', '📁', 'پرونده', 'رفتن به پرونده‌های فروش', 'goPanel(\'deals\')', false);
    /* چاپ برگه از هاب مالی حذف شده و فقط در ماژول چاپ چک فیزیکی است. */
    return acts || '<span style="color:#94a3b8">—</span>';
  }
  /* v33.7.0: استرداد چک ضمانت (با پایان پروژه) */
  window.ptfChequeRetrieveUi = function (cd) {
    var c = window.ptfChequeFind(cd);
    if (!c) return;
    if (!confirm('چک ضمانت ' + (c.sayad || c.no || '') + ' از کارفرما مسترد شد؟' + (c.dealCd ? '\nپرونده: ' + (c.dealLabel || c.dealCd) : ''))) return;
    var r = window.ptfChequeClearIssued(cd, 'استرداد ضمانت با پایان پروژه');
    if (!r.ok) { alert('استرداد ممکن نشد.'); return; }
    try { audit('چک‌ها', 'استرداد چک ضمانت ' + (c.sayad || c.no || '') + ' — پرونده ' + (c.dealLabel || c.dealCd || ''), cd); } catch (eA) {}
    if (typeof ptfToast === 'function') ptfToast('🏆 چک ضمانت مسترد شد', 'ok');
    window.ptfChequePanelRender();
  };
  /* ===== v34.0.4-alpha (BUG-CHEQUE-CLEAR-UI-001): دکمهٔ «✔ وصول» چک صادرهٔ عادی در هاب مالی
     ptfChequeClearIssuedUi را صدا می‌زد که هیچ‌جا تعریف نشده بود → ReferenceError. ===== */
  window.ptfChequeClearIssuedUi = function (cd) {
    var c = window.ptfChequeFind(cd);
    if (!c) return;
    if (c.kind === 'guarantee') return; /* ضمانت مسیر «استرداد» دارد */
    if (!confirm('وصول چک «' + (c.sayad || c.no || cd) + '» به مبلغ ' + money(c.amt) + ' ریال ثبت شود؟\nوضعیت چک «پاس‌شده» می‌شود و اثر مالیِ معوقش (در صورت وجود) اعمال می‌گردد.')) return;
    var r = window.ptfChequeClearIssued(cd, 'وصول از پنل مالی');
    if (!r.ok) { alert('وصول ممکن نشد (' + (r.why || 'خطا') + ').'); return; }
    try { audit('چک‌ها', 'وصول چک صادره ' + (c.sayad || c.no || '') + ' — مبلغ ' + money(c.amt), cd); } catch (eA) {}
    if (typeof ptfToast === 'function') ptfToast('✔ چک پاس/وصول شد', 'ok');
    window.ptfChequePanelRender();
  };
  function receivedActs(c) {
    var acts = '';
    var hasDocs2 = (c.files || []).length > 0;
    acts += chequeRowAction('docs', '📎', hasDocs2 ? 'سند (' + c.files.length + ')' : 'سند', hasDocs2 ? 'مشاهده/حذف عکس یا کپی چک' : 'افزودن عکس/کپی چک', 'ptfChequeFilesUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    acts += chequeRowAction('edit', '✏️', 'ویرایش', 'ویرایش چک', 'ptfChequeEditUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    acts += chequeRowAction('delete', '🗑', 'حذف', 'حذف کامل چک', 'ptfChequeDeleteUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    if (c.st === 'open' || c.st === 'held') {
      acts += chequeRowAction('endorse', '↪', 'انتقال', 'انتقال چک به تامین‌کننده', 'ptfChequeEndorseUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
      acts += chequeRowAction('collect', '✓', 'وصول', 'ثبت وصول چک وارده', 'ptfChequeCollectUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
      acts += chequeRowAction('bounce', '↩', 'برگشتی', 'ثبت برگشت چک وارده', 'ptfChequeBounceUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    } else if (c.st === 'endorsed') {
      acts += chequeRowAction('collect', '✓', 'وصول', 'ثبت وصول چک وارده', 'ptfChequeCollectUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
      acts += chequeRowAction('return-transfer', '↩', 'بازگشت انتقال', 'بازگرداندن انتقال چک', 'ptfChequeVoidTransferUi(\'' + ptfOnClickArg(c.cd) + '\')', true);
    } else if (c.st === 'bounced') {
      acts += chequeRowAction('endorse', '↪', 'انتقال مجدد', 'انتقال دوبارهٔ چک برگشتی', 'ptfChequeEndorseUi(\'' + ptfOnClickArg(c.cd) + '\')', true);
      acts += chequeRowAction('void', '⛔', 'ابطال', 'ابطال عملیاتی چک بدون حذف کامل رکورد', 'ptfChequeVoidIssuedUi(\'' + ptfOnClickArg(c.cd) + '\')', false);
    }
    return acts || '<span style="color:#94a3b8">—</span>';
  }

  window.ptfChequePanelHtml = function () {
    var sub = window.ptfChequePanelSub === 'received' ? 'received' : 'issued';
    var tbtn = function (id, lb, cl) {
      var on = sub === id;
      return '<button type="button" class="bt cheque-panel-subtab" title="' + lb + '" aria-label="' + lb + '" aria-pressed="' + (on ? 'true' : 'false') + '" style="' + (on ? 'background:' + cl + ';color:#fff' : '') + '" onclick="ptfChequeSetSub(\'' + id + '\')">' + lb + '</button>';
    };
    var body = sub === 'received' ? receivedTable() : issuedTable();
    /* MOB-036: ابزارهای چک پیش‌تر یک flex بدون wrap بودند و پنج button سمت چپ
       در viewport 320px با x منفی رندر می‌شدند. گروه‌بندی semantic برای grid موبایل. */
    return '<div id="chequeBox" style="display:none;background:var(--crd);border:1px solid var(--brd);border-radius:14px;padding:12px;margin-top:12px">' +
      '<div class="cheque-panel-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h4 style="margin:0">🧾 چک‌ها</h4><small style="color:#64748b">ماژول مستقل — صادره و وارده</small></div>' +
      '<div class="cheque-panel-tools" style="display:flex;gap:6px;flex-wrap:wrap"><div class="cheque-panel-subtabs" style="display:flex;gap:6px;flex-wrap:wrap">' + tbtn('issued', '🏢 چک‌های صادره', '#b45309') + tbtn('received', '📥 چک‌های وارده', '#0e7490') +
      '</div><div class="cheque-panel-actions" style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button type="button" class="bt cheque-panel-action" title="دستیار هوشمند چک" aria-label="دستیار هوشمند چک" style="background:#7c3aed;color:#fff" onclick="ptfChequeAiOpenSub()">🤖 دستیار هوشمند</button>' + '<button type="button" class="bt bt-o cheque-panel-action" title="ثبت چک جدید" aria-label="ثبت چک جدید" onclick="ptfChequeNewUi()">+ چک جدید</button>' +
      '<button type="button" class="bt bt-o cheque-panel-action" title="مدیریت دسته چک" aria-label="مدیریت دسته چک" onclick="ptfChequeBookUi()">📒 دسته چک</button>' +
      '<button type="button" class="bt bt-o cheque-panel-action" title="خروجی PDF چک‌ها" aria-label="خروجی PDF چک‌ها" onclick="ptfChequePanelPdf()">🖨 PDF</button>' +
      '<button type="button" class="bt bt-o cheque-panel-action" title="خروجی اکسل چک‌ها" aria-label="خروجی اکسل چک‌ها" onclick="ptfChequePanelCsv()">⬇ اکسل</button></div></div></div>' + body + '</div>';
  };

  window.ptfChequePanelRender = function () {
    var el = document.getElementById('chequeBox');
    if (el) el.outerHTML = window.ptfChequePanelHtml();
  };

  /* ---------- ثبت چک جدید ----------
     v33.8.0 (مصوب کارفرما): اول می‌پرسد «وارده است یا صادره» و سپس فیلدها بر آن اساس ساخته می‌شوند. */
  window.ptfChequeNewUi = function () {
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2700) : 2700;
    var html = '<div class="md-b" id="ptfChNewDirDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:460px">' +
      '<h3>🧾 ثبت چک — نوع چک چیست؟</h3>' +
      '<div style="font-size:12.5px;color:#475569;margin-bottom:12px">ابتدا مشخص کنید چک <b>وارده</b> (دریافتی از مشتری/ثالث) است یا <b>صادره</b> (پرداختی/ضمانت شرکت) — فیلدها بر همان اساس تنظیم می‌شوند.</div>' +
      '<div style="display:grid;gap:10px">' +
      '<button class="bt" style="background:#0e7490;font-size:14px;padding:14px" onclick="ptfChequeNewForm(\'received\');document.getElementById(\'ptfChNewDirDlg\').remove()">📥 چک وارده — دریافت از مشتری / ثالث</button>' +
      '<button class="bt" style="background:#b45309;font-size:14px;padding:14px" onclick="ptfChequeNewForm(\'issued\');document.getElementById(\'ptfChNewDirDlg\').remove()">🏢 چک صادره — پرداخت / ضمانت شرکت</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="document.getElementById(\'ptfChNewDirDlg\').remove()">انصراف</button></div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
  };
  window.ptfChequeNewForm = function (dir) {
    var sub = dir === 'received' ? 'received' : 'issued';
    var isR = sub === 'received';
    var supOpts = '<option value="">— تامین‌کننده دارای مطالبه —</option>', custOpts = '<option value="">— مشتری دارای پرونده باز —</option>';
    try {
      (window.ptfChequeSupOptions ? window.ptfChequeSupOptions() : []).forEach(function (x) { supOpts += '<option value="' + escP(x.cd) + '">' + escP(x.lb) + '</option>'; });
      (window.ptfChequeCustOptions ? window.ptfChequeCustOptions() : []).forEach(function (x) { custOpts += '<option value="' + escP(x.cd) + '">' + escP(x.lb) + '</option>'; });
    } catch (eL) {}
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2700) : 2700;
    var html = '<div class="md-b" id="ptfChNewDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:720px;max-height:94vh;overflow:auto">' +
      '<h3>' + (isR ? '📥 ثبت چک وارده' : '🏢 ثبت چک صادره') + '</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;font-size:12px;color:#0c4a6e;line-height:2;margin-bottom:10px">' +
      (isR
        ? 'چک دریافتی: ذی‌نفع/صادرکننده را از «مشتریان دارای پرونده فروش باز» یا «سایر» انتخاب کنید. اگر فاکتور باز انتخاب شود، همان لحظه از مطالبات کسر می‌شود؛ بدون فاکتور، چک در گردش می‌ماند و با «وصول» اثر مالی می‌گیرد.'
        : 'چک صادره: ذی‌نفع را از «تامین‌کنندگان دارای مطالبه از ما» یا «سایر» انتخاب کنید. چک مالی همان لحظه روی بدهی تامین‌کننده اثر می‌گذارد؛ چک ضمانت اثر مالی ندارد؛ ضمانت شرکت در مناقصه می‌تواند مستقل از پرونده فروش ثبت شود.') +
      '</div>' +
      '<div class="fr"><div class="fld"><label>نوع ذی‌نفع *</label><select id="ptfChNParty" onchange="ptfChNPartyUi()">' +
      (isR
        ? '<option value="cust">🤝 مشتری (دارای پرونده باز)</option><option value="third">🪪 ثالث (چک شخص/شرکت دیگر)</option><option value="other">👤 سایر</option>'
        : '<option value="sup">🏭 تامین‌کننده (دارای مطالبه)</option><option value="other">👤 سایر</option>') +
      '</select></div>' +
      '<div class="fld" id="ptfChNPickWrap" style="min-width:260px"></div></div>' +
      '<div class="fr"><div class="fld"><label>شماره / شناسه صیادی *</label><input id="ptfChNNo" style="direction:ltr" placeholder="در صورت موجود بودن"></div>' +
      '<div class="fld"><label>مبلغ (ریال) *</label><input id="ptfChNAmt" type="text" inputmode="numeric" data-money="1" autocomplete="off" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>تاریخ سررسید (شمسی) *</label>' + (typeof window.ptfDatePicker === 'function' ? window.ptfDatePicker('ptfChNDue', '', '1405/05/11') : '<input id="ptfChNDue" placeholder="1405/05/11" style="direction:ltr">') + '</div>' +
      '<div class="fld"><label>بانک / شعبه</label><input id="ptfChNBank" style="direction:ltr"></div></div>' +
      (!isR ? '<div class="fld"><label>📒 دسته چک (اختیاری — انتخاب خودکار بانک/شعبه/سری)</label><select id="ptfChNBook" onchange="ptfChNBookPick()"></select></div>' : '') +
      '<div class="fld"><label>📎 کپی چک (اختیاری — ضمیمه شود)</label><div id="ptfChNUp" style="min-height:38px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div></div>' +
      (isR
        ? '<div class="fld" id="ptfChNInvWrap" style="display:none"><label>فاکتور باز مشتری (اختیاری — کسر از مطالبات)</label><select id="ptfChNInv"><option value="">— بدون فاکتور (در گردش) —</option></select></div>'
        : '<div class="fr"><div class="fld"><label>نوع چک *</label><select id="ptfChNKind" onchange="ptfChNKindUi()">' +
          '<option value="finance">💰 مالی</option>' +
          '<option value="guarantee">🛡 ضمانت / سپرده</option></select></div>' +
          '<div class="fld" id="ptfChNGuarWrap" style="display:none"><label>نوع ضمانت</label><select id="ptfChNGuarType" onchange="ptfChNKindUi()">' +
          '<option value="advance">ضمانت پیش‌پرداخت</option><option value="performance">ضمانت حسن انجام کار</option><option value="bid">ضمانت شرکت در مناقصه (مستقل)</option><option value="other">سایر</option></select></div></div>' +
          '<div class="fld" id="ptfChNDealWrap" style="display:none"><label>پرونده فروش (برای پیش‌پرداخت/حسن انجام کار)</label><select id="ptfChNDeal"><option value="">— انتخاب پرونده فروش —</option></select></div>') +
      '<div class="fld"><label>بابت / یادداشت</label><input id="ptfChNNote"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button type="button" class="bt bt-o" onclick="document.getElementById(\'ptfChNewDlg\').remove()">انصراف</button>' +
      '<button type="button" class="bt" onclick="ptfChNCommit()">✅ ثبت چک</button></div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
    window._ptfChNFormDir = sub;
    window._ptfChNCustOpts = custOpts;
    window._ptfChNSupOpts = supOpts;
    window.ptfChNPartyUi();
    /* v34.0.16-alpha (فاز ۱۳): فیلد دسته چک و کپی چک در فرم ثبت */
    window._ptfChNFiles = [];
    try { if (typeof attachUploadWidget === 'function') attachUploadWidget('ptfChNUp', 'cheques/', function (fr) { if (fr) window._ptfChNFiles.push(fr); }); } catch (eU) {}
    var bookSel = document.getElementById('ptfChNBook');
    if (bookSel) {
      var bookOpts = '<option value="">— بدون دسته (دستی) —</option>';
      try {
        (typeof window.ptfChequeBooks === 'function' ? window.ptfChequeBooks() : []).forEach(function (b) {
          bookOpts += '<option value="' + escP(b.cd) + '">' + escP(b.bookName || b.bank || b.cd) + (b.fromNo ? ' (' + b.fromNo + '..' + b.toNo + ')' : '') + '</option>';
        });
      } catch (eB) {}
      bookSel.innerHTML = bookOpts;
    }
    if (!isR) window.ptfChNKindUi();
  };
  /* انتخاب دسته چک → انتقال خودکار بانک/شعبه/سری به فرم */
  window.ptfChNBookPick = function () {
    var sel = document.getElementById('ptfChNBook'); if (!sel) return;
    var bookCd = sel.value || '';
    var book = (typeof window.ptfChequeBooks === 'function' ? window.ptfChequeBooks() : []).filter(function (b) { return b.cd === bookCd; })[0];
    if (!book) return;
    var bankEl = document.getElementById('ptfChNBank'); if (bankEl) bankEl.value = (book.bank || '') + (book.branch ? ' — ' + book.branch : '');
    window._ptfChNBook = book;
  };
  window.ptfChNPartyUi = function () {
    var isR = window._ptfChNFormDir === 'received';
    var v = ((document.getElementById('ptfChNParty') || {}).value || (isR ? 'cust' : 'sup'));
    var wrap = document.getElementById('ptfChNPickWrap'); if (!wrap) return;
    var html = '';
    if (isR) {
      if (v === 'cust') html = '<label>مشتری (صادرکننده) *</label><select id="ptfChNCust" onchange="ptfChNInvReload()">' + (window._ptfChNCustOpts || '') + '</select>';
      else if (v === 'third') html = '<label>نام ثالث (صادرکننده چک) *</label><input id="ptfChNThird" placeholder="نام شخص/شرکت ثالث — بدون پرونده">';
      else html = '<label>نام ذی‌نفع (سایر) *</label><input id="ptfChNOther">';
    } else {
      if (v === 'sup') html = '<label>تامین‌کننده (ذی‌نفع) *</label><select id="ptfChNSup">' + (window._ptfChNSupOpts || '') + '</select>';
      else html = '<label>نام ذی‌نفع (سایر) *</label><input id="ptfChNOther">';
    }
    wrap.innerHTML = html;
    var invWrap = document.getElementById('ptfChNInvWrap');
    if (invWrap) invWrap.style.display = (isR && v === 'cust' && ((document.getElementById('ptfChNCust') || {}).value)) ? '' : 'none';
    if (isR && v === 'cust') window.ptfChNInvReload();
  };
  window.ptfChNKindUi = function () {
    var k = ((document.getElementById('ptfChNKind') || {}).value || 'finance');
    var g = k === 'guarantee';
    var gt = ((document.getElementById('ptfChNGuarType') || {}).value || 'advance');
    var needDeal = g && gt !== 'bid'; /* ضمانت شرکت در مناقصه می‌تواند مستقل از پرونده فروش باشد. */
    var w1 = document.getElementById('ptfChNGuarWrap'); if (w1) w1.style.display = g ? '' : 'none';
    var w2 = document.getElementById('ptfChNDealWrap'); if (w2) w2.style.display = needDeal ? '' : 'none';
    if (needDeal && typeof window.ptfChNDealReload === 'function') window.ptfChNDealReload();
  };
  window.ptfChNDealReload = function () {
    var sel = document.getElementById('ptfChNDeal'); if (!sel) return;
    var opts = '<option value="">— انتخاب پرونده فروش —</option>';
    try {
      (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).forEach(function (d) {
        opts += '<option value="' + escP(d.cd) + '">' + escP((d.inqNo || d.cd) + ' — ' + (d.buyerCo || '')) + '</option>';
      });
    } catch (e) {}
    sel.innerHTML = opts;
  };
  window.ptfChNInvReload = function () {
    var custCd = ((document.getElementById('ptfChNCust') || {}).value || '');
    var wrap = document.getElementById('ptfChNInvWrap'); if (wrap) wrap.style.display = custCd ? '' : 'none';
    var sel = document.getElementById('ptfChNInv'); if (!sel) return;
    var opts = '<option value="">— بدون فاکتور (در گردش) —</option>';
    try {
      (typeof window.ptfChequeOpenInvoicesOf === 'function' ? window.ptfChequeOpenInvoicesOf(custCd) : []).forEach(function (inv) {
        opts += '<option value="' + escP(inv.cd) + '">' + escP(inv.lb) + '</option>';
      });
    } catch (e) {}
    sel.innerHTML = opts;
  };
  window.ptfChNCommit = function () {
    var isR = window.ptfChequePanelSub === 'received';
    var partyKind = ((document.getElementById('ptfChNParty') || {}).value || 'other');
    var no = ((document.getElementById('ptfChNNo') || {}).value || '').trim();
    var amt = (typeof window.ptfNum === 'function') ? window.ptfNum((document.getElementById('ptfChNAmt') || {}).value) : +((document.getElementById('ptfChNAmt') || {}).value || 0);
    var dueRaw = ((document.getElementById('ptfChNDue') || {}).value || '').trim();
    var dueISO = (typeof window.ptfJToISO === 'function') ? window.ptfJToISO(dueRaw) : '';
    var bank = ((document.getElementById('ptfChNBank') || {}).value || '').trim();
    var note = ((document.getElementById('ptfChNNote') || {}).value || '').trim();
    var custCd = '', supCd = '', toWhom = '', thirdParty = false;
    if (isR) {
      if (partyKind === 'cust') {
        custCd = ((document.getElementById('ptfChNCust') || {}).value || '');
        var cust = (getData('ptf_crm_customers') || []).filter(function (x) { return x.cd === custCd; })[0];
        toWhom = cust ? (cust.co || cust.nm || cust.cd) : '';
        if (!custCd) { alert('⛔ مشتری (صادرکننده) را از فهرست انتخاب کنید'); return; }
      } else if (partyKind === 'third') {
        /* v33.8.0: چک ثالث — صادرکننده شخص/شرکت دیگری است (بدون پرونده) */
        toWhom = ((document.getElementById('ptfChNThird') || {}).value || '').trim();
        thirdParty = true;
        if (!toWhom) { alert('⛔ نام ثالث (صادرکننده چک) الزامی است'); return; }
      } else {
        toWhom = ((document.getElementById('ptfChNOther') || {}).value || '').trim();
        if (!toWhom) { alert('نام ذی‌نفع الزامی است'); return; }
      }
    } else {
      if (partyKind === 'sup') {
        supCd = ((document.getElementById('ptfChNSup') || {}).value || '');
        var sup = (getData('ptf_crm_suppliers') || []).filter(function (x) { return x.cd === supCd; })[0];
        toWhom = sup ? (sup.co || sup.cd) : '';
        if (!supCd) { alert('⛔ تامین‌کننده را از فهرست انتخاب کنید'); return; }
      } else {
        toWhom = ((document.getElementById('ptfChNOther') || {}).value || '').trim();
        if (!toWhom) { alert('نام ذی‌نفع الزامی است'); return; }
      }
    }
    if (!no && !confirm('شماره صیادی وارد نشده — بدون شماره ثبت شود؟')) return;
    if (!amt || amt <= 0) { alert('مبلغ معتبر الزامی است'); return; }
    if (!dueISO && !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dueRaw)) { alert('تاریخ سررسید شمسی معتبر الزامی است'); return; }
    var kind = 'finance', guarType = '';
    if (!isR) {
      kind = ((document.getElementById('ptfChNKind') || {}).value || 'finance');
      if (kind === 'guarantee') {
        guarType = ((document.getElementById('ptfChNGuarType') || {}).value || 'advance');
        var dealCd = ((document.getElementById('ptfChNDeal') || {}).value || '');
        if (guarType !== 'bid' && !dealCd) { alert('⛔ برای ضمانت پیش‌پرداخت، حسن انجام کار یا سایر، انتخاب پرونده فروش الزامی است. ضمانت شرکت در مناقصه می‌تواند مستقل ثبت شود.'); return; }
        var deal = (getData('ptf_crm_deals') || []).filter(function (x) { return x.cd === dealCd; })[0];
        var book = window._ptfChNBook || null;
        var rec = {
          no: no, sayad: no, amt: amt, kind: kind, guarType: guarType, dealCd: dealCd,
          dealLabel: deal ? ((deal.inqNo || deal.cd) + ' — ' + (deal.buyerCo || '')) : '',
          toWhom: toWhom, supplierCd: supCd || undefined, bank: bank || (book ? book.bank : ''), branch: book ? book.branch : '',
          note: note, dueISO: dueISO, dueFa: dueISO && typeof window.ptfISOToJ === 'function' ? window.ptfISOToJ(dueISO) : dueRaw,
          ownership: 'company', files: window._ptfChNFiles || [],
          bookCd: book ? book.cd : '', series: book ? (book.series || '') : '',
          accountNo: book ? (book.accountNo || '') : '', owner: book ? (book.owner || '') : ''
        };
        var saved = window.ptfChequeCreate('issued', rec);
        if (!saved || saved.why === 'sayad_locked') { alert(saved && saved.error ? saved.error : '⛔ ثبت چک ممکن نشد'); return; }
        try { if (typeof chUpsertReminder === 'function') chUpsertReminder(saved); } catch (eR) {}
        var dlg = document.getElementById('ptfChNewDlg'); if (dlg) dlg.remove();
        if (typeof ptfToast === 'function') ptfToast(guarType === 'bid' ? '✅ ضمانت شرکت در مناقصه به‌صورت مستقل ثبت شد (بدون اثر مالی)' : '✅ چک ضمانت ثبت شد — در پرونده فروش نشانده شد (با پایان پروژه مسترد می‌شود)', 'ok');
        window.ptfChequePanelRender();
        return;
      } else {
        var book = window._ptfChNBook || null;
        var rec2 = {
          no: no, sayad: no, amt: amt, kind: 'finance', toWhom: toWhom, supplierCd: supCd || undefined,
          bank: bank || (book ? book.bank : ''), branch: book ? book.branch : '',
          note: note, dueISO: dueISO,
          dueFa: dueISO && typeof window.ptfISOToJ === 'function' ? window.ptfISOToJ(dueISO) : dueRaw,
          ownership: 'company', files: window._ptfChNFiles || [],
          bookCd: book ? book.cd : '', series: book ? (book.series || '') : '',
          accountNo: book ? (book.accountNo || '') : '', owner: book ? (book.owner || '') : ''
        };
        var saved2 = window.ptfChequeCreate('issued', rec2);
        /* قفل صیاد: اگر ثبت مجدد صیادِ رزرو‌شده ممنوع شد */
        if (!saved2 || saved2.why === 'sayad_locked') { alert(saved2 && saved2.error ? saved2.error : '⛔ ثبت چک ممکن نشد'); return; }
        try { if (typeof chUpsertReminder === 'function') chUpsertReminder(saved2); } catch (eR2) {}
        var dlg2 = document.getElementById('ptfChNewDlg'); if (dlg2) dlg2.remove();
        if (typeof ptfToast === 'function') ptfToast('✅ چک مالی صادره ثبت شد' + ((saved2.financial && saved2.financial.ok) ? ' — اثر مالی روی بدهی تامین‌کننده اعمال شد' : ''), 'ok');
        window.ptfChequePanelRender();
        return;
      }
    } else {
      var invCd = ((document.getElementById('ptfChNInv') || {}).value || '');
      var rec3 = {
        no: no, sayad: no, amt: amt, kind: 'finance', toWhom: toWhom, custCd: custCd || undefined,
        payerName: toWhom, sourceInvoiceCd: invCd || undefined, thirdParty: thirdParty || undefined,
        bank: bank, note: note, dueISO: dueISO,
        dueFa: dueISO && typeof window.ptfISOToJ === 'function' ? window.ptfISOToJ(dueISO) : dueRaw,
        files: window._ptfChNFiles || []
      };
      var saved3 = window.ptfChequeCreate('received', rec3);
      if (!saved3 || saved3.why === 'sayad_locked') { alert(saved3 && saved3.error ? saved3.error : '⛔ ثبت چک ممکن نشد'); return; }
      try { if (typeof chUpsertReminder === 'function') chUpsertReminder(saved3); } catch (eR3) {}
      var dlg3 = document.getElementById('ptfChNewDlg'); if (dlg3) dlg3.remove();
      if (typeof ptfToast === 'function') ptfToast('✅ چک وارده ثبت شد' + ((saved3.financial && saved3.financial.ok) ? ' — اثر مالی روی فاکتور مشتری اعمال شد' : (invCd ? '' : ' — بدون فاکتور؛ با وصول اثر مالی می‌گیرد')), 'ok');
      window.ptfChequePanelRender();
    }
  };

  /* ---------- عملیات ---------- */
  window.ptfChequeEndorseUi = function (cd) {
    var chk = window.ptfChequeFind(cd);
    var dueFa = (chk && (chk.dueFa || chk.dueISO)) || '';
    var fy = String(dueFa).match(/(13|14)\d{2}/);
    try { if (fy && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(fy[0])) { alert('🔒 سال مالی ' + fy[0] + ' قفل است؛ انتقال چک مجاز نیست.'); return; } } catch (eF) {}
    /* v33.8.0 (مصوب کارفرما): خرج کردن چک (ثالث یا مشتری) نزد تامین‌کننده —
       انتخاب تامین‌کننده از فهرست دارای مطالبه → اثر مالی همان لحظه روی بدهی. */
    var supOpts = '<option value="">— انتخاب تامین‌کننده —</option>';
    try {
      (typeof window.ptfChequeSupOptions === 'function' ? window.ptfChequeSupOptions() : []).forEach(function (x) {
        supOpts += '<option value="' + escP(x.cd) + '">' + escP(x.lb) + '</option>';
      });
    } catch (eL) {}
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2600) : 2600;
    var html = '<div class="md-b" id="ptfChEndDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px">' +
      '<h3>↪ خرج کردن چک به تامین‌کننده</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;font-size:12px;color:#0c4a6e;line-height:2;margin-bottom:10px">چک وارده (' + escP((chk && (chk.sayad || chk.no)) || cd) + ' — ' + (+(chk && chk.amt) || 0).toLocaleString('fa-IR') + ' ریال) به تامین‌کننده داده می‌شود. اگر چک مالی باشد، همان لحظه <b>روی بدهی تامین‌کننده اثر می‌گذارد</b> (کسر بدهی ما).</div>' +
      '<div class="fld"><label>تامین‌کننده (ذی‌نفع خرج) *</label><select id="ptfChEndSup">' + supOpts + '</select></div>' +
      '<div class="fld"><label>یادداشت</label><input id="ptfChEndNote" placeholder="اختیاری"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="document.getElementById(\'ptfChEndDlg\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#0e7490" onclick="ptfChEndGo(\'' + ptfOnClickArg(cd) + '\')">↪ خرج چک</button></div></div></div>';
    (document.body || document.getElementById('panels')).insertAdjacentHTML('beforeend', html);
  };
  window.ptfChEndGo = function (cd) {
    var supCd = ((document.getElementById('ptfChEndSup') || {}).value || '');
    var note = ((document.getElementById('ptfChEndNote') || {}).value || '').trim();
    if (!supCd) { alert('⛔ تامین‌کننده را از فهرست انتخاب کنید'); return; }
    var sup = (getData('ptf_crm_suppliers') || []).filter(function (x) { return x.cd === supCd; })[0] || {};
    var r = window.ptfChequeEndorse(cd, sup.co || sup.cd, note, supCd);
    if (!r.ok) { alert(r.why === 'state' ? 'وضعیت چک اجازه خرج/انتقال نمی‌دهد.' : 'چک یافت نشد.'); return; }
    var dlg = document.getElementById('ptfChEndDlg'); if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast('چک خرج شد' + ((r.financial && r.financial.ok) ? ' — اثر مالی روی بدهی تامین‌کننده اعمال شد' : '') + '.', 'ok');
    window.ptfChequePanelRender();
  };
  window.ptfChequeCollectUi = function (cd) {
    var chk2 = window.ptfChequeFind(cd);
    var fy2 = String((chk2 && (chk2.dueFa || chk2.dueISO)) || '').match(/(13|14)\d{2}/);
    try { if (fy2 && typeof ptfFiscalYearLocked === 'function' && ptfFiscalYearLocked(fy2[0])) { alert('🔒 سال مالی ' + fy2[0] + ' قفل است؛ ثبت وصول مجاز نیست.'); return; } } catch (eF2) {}
    ptfDialog({ title: '✔ ثبت وصول چک', fields: [{ id: 'note', label: 'یادداشت', type: 'textarea', rows: 2 }], okText: 'وصول شد', onOk: function (v) {
      var c = window.ptfChequeFind(cd);
      var r = c && c.direction === 'received' ? window.ptfChequeCollect(cd, v.note) : window.ptfChequeClearIssued(cd, v.note);
      if (!r.ok) { alert('ثبت وصول ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('وصول چک ثبت شد.', 'ok');
      window.ptfChequePanelRender();
    } });
  };
  window.ptfChequeBounceUi = function (cd) {
    ptfDialog({ title: '↩ ثبت چک برگشتی', fields: [{ id: 'reason', label: 'دلیل برگشت *', type: 'text', required: true }], okText: 'ثبت برگشتی', onOk: function (v) {
      var r = window.ptfChequeBounce(cd, String(v.reason).trim());
      if (!r.ok) { alert('ثبت برگشتی ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('چک برگشتی ثبت شد.', 'warn');
      window.ptfChequePanelRender();
    } });
  };
  window.ptfChequeVoidTransferUi = function (cd) {
    ptfDialog({ title: '↩ بازگشت انتقال چک', fields: [{ id: 'reason', label: 'دلیل', type: 'text' }], okText: 'بازگشت', onOk: function (v) {
      var r = window.ptfChequeVoidTransfer(cd, String(v.reason || '').trim());
      if (!r.ok) { alert('بازگشت ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('انتقال بازگردانده شد.', 'ok');
      window.ptfChequePanelRender();
    } });
  };
  window.ptfChequeVoidIssuedUi = function (cd) {
    ptfDialog({ title: 'ابطال چک', fields: [{ id: 'reason', label: 'دلیل ابطال *', type: 'text', required: true }], okText: 'ابطال', danger: true, onOk: function (v) {
      var r = window.ptfChequeVoidIssued(cd, String(v.reason).trim());
      if (!r.ok) { alert('ابطال ممکن نشد.'); return; }
      if (typeof ptfToast === 'function') ptfToast('چک ابطال شد.', 'warn');
      window.ptfChequePanelRender();
    } });
  };

  /* ---------- گزارش ---------- */
  window.ptfChequePanelRows = function () {
    var sub = window.ptfChequePanelSub === 'received' ? 'received' : 'issued';
    var rows = (sub === 'received' ? receivedRows() : issuedRows());
    return rows.map(function (c) {
      return { no: c.sayad || c.no || '', party: sub === 'received' ? (c.payerName || c.sourceCustomerCd || '') : (c.toWhom || c.payeeName || ''), bank: c.bank || '', due: c.dueFa || c.dueISO || '', amt: +c.amt || 0, st: stLabel(c), stEn: c.st };
    });
  };
  window.ptfChequePanelCsv = function () {
    var rows = window.ptfChequePanelRows();
    var csv = '\uFEFF' + [['شماره/صیادی', 'طرف', 'بانک', 'سررسید', 'مبلغ', 'وضعیت']]
      .concat(rows.map(function (r) { return [r.no, r.party, r.bank, r.due, r.amt, r.st]; }))
      .map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = (window.ptfChequePanelSub === 'received' ? 'cheques-received' : 'cheques-issued') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  };
  window.ptfChequePanelPdf = function () {
    var rows = window.ptfChequePanelRows(), sub = window.ptfChequePanelSub === 'received' ? 'وارده' : 'صادره';
    var body = rows.map(function (r) { return '<tr><td>' + escP(r.no) + '</td><td>' + escP(r.party) + '</td><td>' + escP(r.bank) + '</td><td>' + escP(r.due) + '</td><td>' + money(r.amt) + '</td><td>' + escP(r.st) + '</td></tr>'; }).join('');
    var html = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma;padding:20px;color:#111}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px;text-align:right}th{background:#eee}</style></head><body><h2>گزارش چک‌های ' + sub + '</h2><table><thead><tr><th>شماره/صیادی</th><th>طرف</th><th>بانک</th><th>سررسید</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>' + body + '</tbody></table></body></html>';
    if (typeof ptfPreviewPrintableDoc === 'function') { ptfPreviewPrintableDoc('گزارش چک‌های ' + sub, html, 'cheques-' + window.ptfChequePanelSub); return; }
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.print();
  };

  /* توجه: نسخهٔ قدیمی ptfChequeEditUi/ptfChequeEditSave (v34.0.14-alpha، بدون فیلد بانک/شعبه/سری/مالک/حساب و بدون مدیریت سند) حذف شد؛ نسخهٔ کامل‌تر (v34.0.16-alpha، فاز ۱۳) پایین‌تر در همین فایل تعریف شده و همان است که واقعاً بارگذاری می‌شود. */

  /* حذف کامل چک + حذف کامل اثر مالی/گردش حساب (نه void) */
  window.ptfChequeDeleteUi = function (cd) {
    var c = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
    if (!c) { alert('چک یافت نشد'); return; }
    var hasFin = (c.direction === 'issued' || c.ownership === 'company') && (c.supplierCd || c.supplierPaymentCd);
    var msg = 'چک «' + (c.sayad || c.no || cd) + '» به مبلغ ' + money(c.amt) + ' ریال به‌طور کامل حذف شود؟' +
      (hasFin ? '\\n\\nاین چک اثر مالی روی حساب تأمین‌کننده دارد — حذف آن، اثر مالی و گردش حساب را هم به‌طور کامل حذف می‌کند.' : '');
    if (!confirm(msg)) return;
    var r = (typeof window.ptfChequeDelete === 'function') ? window.ptfChequeDelete(cd) : { ok: false, why: 'no_fn' };
    if (!r.ok) { alert('حذف نشد (' + (r.why || 'خطا') + ')'); return; }
    try { audit('چک‌ها', 'حذف کامل چک ' + (c.sayad || c.no || cd) + ' — مبلغ ' + money(c.amt) + (hasFin ? ' + حذف اثر مالی تأمین‌کننده' : ''), cd); } catch (eA) {}
    if (typeof ptfToast === 'function') ptfToast('🗑 چک و اثر مالی/گردش مرتبط حذف شد', 'warn');
    window.ptfChequePanelRender();
  };

  /* لینک از تب کیفیت داده — همان مودال ویرایش چک را برای چک مشخص باز می‌کند */
  window.ptfChequeEditFromQuality = function (cd) {
    try { if (typeof window.finHubSet === 'function') window.finHubSet('cheque'); } catch (e) {}
    setTimeout(function () { window.ptfChequeEditUi(cd); }, 150);
  };

  /* ================= v34.0.16-alpha (فاز ۱۳): مدیریت دسته چک + ویرایش کامل چک + سند ================= */

  /* مودال مدیریت دسته‌های چک (لیست + ثبت + حذف) */
  window.ptfChequeBookUi = function () {
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2850) : 2850;
    var books = (typeof window.ptfChequeBooks === 'function') ? window.ptfChequeBooks() : [];
    var rows = books.map(function (b) {
      return '<tr><td><b>' + escP(b.bookName || b.bank || b.cd) + '</b><br><small style="color:#64748b">' + escP(b.bank || '') + (b.branch ? ' — ' + escP(b.branch) : '') + (b.series ? ' | سری ' + escP(b.series) : '') + '</small></td>' +
        '<td style="direction:ltr">' + escP(b.accountNo || '—') + '</td><td>' + escP(b.owner || '—') + '</td>' +
        '<td style="direction:ltr">' + escP(b.fromNo || '') + ' .. ' + escP(b.toNo || '') + '</td>' +
        '<td><button class="ba" style="color:#dc2626" onclick="ptfChequeBookDeleteUi(\'' + ptfOnClickArg(b.cd) + '\')">🗑</button></td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px">دسته چکی ثبت نشده است</td></tr>';
    var html = '<div class="md-b" id="ptfChBookDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:90vh;overflow:auto">' +
      '<h3>📒 دسته‌های چک شرکت</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 11px;font-size:12px;color:#0c4a6e;margin-bottom:10px">دسته چک = کتاب چکِ شرکت (بانک/شماره حساب/مالک/شعبه/سری/شماره از..تا). هنگام ثبت چک صادره از منوی کشویی انتخاب می‌شود و مشخصات به‌صورت خودکار منتقل می‌شود.</div>' +
      '<div class="tb2"><table><thead><tr><th>نام/بانک</th><th>شماره حساب</th><th>مالک</th><th>شماره از..تا</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="bt" onclick="ptfChequeBookForm()">+ دسته چک جدید</button><button class="bt bt-o" onclick="document.getElementById(\'ptfChBookDlg\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };

  /* فرم ثبت دسته چک */
  window.ptfChequeBookForm = function (bookCd) {
    var book = null;
    if (bookCd) book = (typeof window.ptfChequeBooks === 'function' ? window.ptfChequeBooks() : []).filter(function (b) { return b.cd === bookCd; })[0];
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2860) : 2860;
    var html = '<div class="md-b" id="ptfChBookFormDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:560px;max-height:92vh;overflow:auto">' +
      '<h3>' + (book ? '✏️ ویرایش' : '📒 ثبت') + ' دسته چک</h3>' +
      '<div class="fr"><div class="fld"><label>نام دسته (اختیاری)</label><input id="cbName" value="' + escP(book ? book.bookName || '' : '') + '"></div>' +
      '<div class="fld"><label>بانک *</label><input id="cbBank" value="' + escP(book ? book.bank : '') + '"></div></div>' +
      '<div class="fr"><div class="fld"><label>شعبه</label><input id="cbBranch" value="' + escP(book ? book.branch || '' : '') + '"></div>' +
      '<div class="fld"><label>سری</label><input id="cbSeries" value="' + escP(book ? book.series || '' : '') + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>شماره حساب / شبا</label><input id="cbAcc" value="' + escP(book ? book.accountNo || '' : '') + '" style="direction:ltr"></div>' +
      '<div class="fld"><label>مالک چک</label><input id="cbOwner" value="' + escP(book ? book.owner || '' : '') + '"></div></div>' +
      '<div class="fr"><div class="fld"><label>شماره چک از *</label><input id="cbFrom" value="' + escP(book ? book.fromNo || '' : '') + '" inputmode="numeric" style="direction:ltr"></div>' +
      '<div class="fld"><label>شماره چک تا *</label><input id="cbTo" value="' + escP(book ? book.toNo || '' : '') + '" inputmode="numeric" style="direction:ltr"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="bt bt-o" onclick="document.getElementById(\'ptfChBookFormDlg\').remove()">انصراف</button>' +
      '<button class="bt" onclick="ptfChequeBookSaveUi(\'' + ptfOnClickArg(book ? book.cd : '') + '\')">💾 ذخیره</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
  };
  window.ptfChequeBookSaveUi = function (cd) {
    function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    var bank = String(val('cbBank') || '').trim(), fromNo = String(val('cbFrom') || '').trim(), toNo = String(val('cbTo') || '').trim();
    if (!bank || !fromNo || !toNo) { alert('بانک و شماره چک از..تا الزامی است'); return; }
    var book = cd ? ((typeof window.ptfChequeBooks === 'function' ? window.ptfChequeBooks() : []).filter(function (b) { return b.cd === cd; })[0] || { cd: cd }) : { cd: (typeof genCode === 'function' ? genCode('CHQB') : 'CHQB-' + Date.now()) };
    book.bookName = String(val('cbName') || '').trim();
    book.bank = bank; book.branch = String(val('cbBranch') || '').trim(); book.series = String(val('cbSeries') || '').trim();
    book.accountNo = String(val('cbAcc') || '').trim(); book.owner = String(val('cbOwner') || '').trim();
    book.fromNo = fromNo; book.toNo = toNo;
    var r = (typeof window.ptfChequeBookSave === 'function') ? window.ptfChequeBookSave(book) : { ok: false };
    if (!r.ok) { alert('ذخیره نشد'); return; }
    var dlg = document.getElementById('ptfChBookFormDlg'); if (dlg) dlg.remove();
    try { audit('چک‌ها', 'ثبت دسته چک ' + (book.bank || '') + ' شماره ' + fromNo + '..' + toNo, book.cd); } catch (eA) {}
    if (typeof ptfToast === 'function') ptfToast('✅ دسته چک ذخیره شد', 'ok');
    window.ptfChequeBookUi();
  };
  window.ptfChequeBookDeleteUi = function (cd) {
    if (!confirm('دسته چک حذف شود؟')) return;
    if (typeof window.ptfChequeBookDelete === 'function') window.ptfChequeBookDelete(cd);
    window.ptfChequeBookUi();
  };

  /* مشاهدهٔ سریع/افزودن/حذف عکس یا کپی چک — بدون نیاز به باز کردن فرم کامل ویرایش.
     پاسخ به گزارش: «عکس چک را می‌دهیم اما بعداً جایی برای دیدنش نیست» — این دکمه
     مستقیماً در ردیف چک (صادره/وارده) در دسترس است. */
  window.ptfChequeFilesUi = function (cd) {
    var c = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
    if (!c) { alert('چک یافت نشد'); return; }
    window._ptfChFilesCd = cd;
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2820) : 2820;
    var existing = (c.files || []).map(function (f) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12.5px;border-bottom:1px dashed var(--brd)"><a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')" style="color:#0e7490;flex:1">👁 مشاهده — ' + escP(f.name || 'فایل') + '</a> <button class="ba" style="color:#dc2626" onclick="ptfChequeQuickRemoveFile(' + JSON.stringify(f.key) + ')">✕ حذف</button></div>';
    }).join('') || '<div style="color:#94a3b8;font-size:12.5px;padding:6px 0">هنوز سندی (عکس/کپی چک) برای این چک ثبت نشده است.</div>';
    var html = '<div class="md-b" id="ptfChFilesDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px;max-height:88vh;overflow:auto">' +
      '<h3>📎 اسناد چک ' + escP(c.sayad || c.no || c.cd) + '</h3>' +
      '<div style="margin-bottom:8px">' + existing + '</div>' +
      '<div class="fld"><label>افزودن عکس/کپی چک جدید</label><div id="ptfChFilesUp" style="min-height:40px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="document.getElementById(\'ptfChFilesDlg\').remove()">بستن</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    try { if (typeof attachUploadWidget === 'function') attachUploadWidget('ptfChFilesUp', 'cheques/', function (fr) {
      if (!fr) return;
      var cc = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
      if (!cc) return;
      var files = (cc.files || []).concat([fr]);
      if (typeof window.ptfChequeUpdate === 'function') window.ptfChequeUpdate(cd, { files: files });
      var dlg = document.getElementById('ptfChFilesDlg'); if (dlg) dlg.remove();
      window.ptfChequeFilesUi(cd);
      if (typeof window.ptfChequePanelRender === 'function') window.ptfChequePanelRender();
    }); } catch (eU) {}
    /* CHQ-DOC-002: مثل تنخواه — اگر سند از دستگاه/کاربر دیگر تازه ثبت شده، pull فوری
       بزن و اگر تعداد اسناد تغییر کرد، مودال را خودکار به‌روز کن. */
    if (typeof window.ptfAttachRefreshOnOpen === 'function') {
      window.ptfAttachRefreshOnOpen('ptfChFilesDlg', function () {
        var cc = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
        return (cc && cc.files || []).map(function (f) { return f.key; });
      }, function () { window.ptfChequeFilesUi(cd); });
    }
  };
  /* حذف سریع یک سند از همان دیالوگ (بدون بازکردن فرم کامل ویرایش) */
  window.ptfChequeQuickRemoveFile = function (key) {
    var cd = window._ptfChFilesCd;
    if (!cd) return;
    if (!confirm('این سند از چک حذف شود؟')) return;
    var c = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
    if (!c) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      var fresh = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
      if (!fresh) return;
      var files = (fresh.files || []).filter(function (f) { return f.key !== key; });
      var deleted = (fresh._deletedFileKeys || []).concat([key]).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      if (typeof window.ptfChequeUpdate === 'function') window.ptfChequeUpdate(cd, { files: files, _deletedFileKeys: deleted });
      if (typeof ptfToast === 'function') ptfToast('سند از رکورد و فضای ابری حذف شد', 'warn');
      var dlg = document.getElementById('ptfChFilesDlg'); if (dlg) dlg.remove();
      window.ptfChequeFilesUi(cd);
      if (typeof window.ptfChequePanelRender === 'function') window.ptfChequePanelRender();
    });
  };

  /* ارتقای مودال ویرایش چک — افزودن سند/کپی چک + بانک/شعبه/سری/مالک/حساب */
  window.ptfChequeEditUi = function (cd) {
    var c = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
    if (!c) { alert('چک یافت نشد'); return; }
    /* رفع باگ: قبلاً window._ptfChEditCd فقط داخل ptfChequeEditSave ست می‌شد؛
       در نتیجه دکمهٔ «✕ حذف سند» بلافاصله بعد از باز شدن مودال (قبل از هر ذخیره) کار نمی‌کرد. */
    window._ptfChEditCd = cd;
    var z = (typeof window.ptfTopZIndex === 'function') ? window.ptfTopZIndex(2800) : 2800;
    var financialNote = '';
    if ((c.direction === 'issued' || c.ownership === 'company') && (c.supplierCd || c.supplierPaymentCd)) {
      financialNote = '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;padding:7px 10px;font-size:12px;color:#065f46;margin-bottom:8px">💳 این چک اثر مالی روی حساب تأمین‌کننده دارد — با تغییر مبلغ، گردش حساب همان لحظه اصلاح می‌شود.</div>';
    }
    var html = '<div class="md-b" id="ptfChEditDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:680px;max-height:92vh;overflow:auto">' +
      '<h3>✏️ ویرایش چک ' + escP(c.sayad || c.no || c.cd) + '</h3>' + financialNote +
      '<div class="fr"><div class="fld"><label>شماره برگه چک</label><input id="chE_No" value="' + escP(c.no || '') + '" style="direction:ltr"></div>' +
      '<div class="fld"><label>شناسه صیادی *</label><input id="chE_Sayad" value="' + escP(c.sayad || '') + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>مبلغ (ریال) *</label><input id="chE_Amt" inputmode="numeric" data-money="1" value="' + escP(c.amt != null ? String(+c.amt).toLocaleString("en-US") : '') + '" style="direction:ltr"></div>' +
      '<div class="fld"><label>تاریخ سررسید (شمسی)</label><input id="chE_Due" value="' + escP(c.dueFa || '') + '" placeholder="1405/04/19" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>ذی‌نفع *</label><input id="chE_To" value="' + escP(c.toWhom || '') + '"></div>' +
      '<div class="fld"><label>بانک</label><input id="chE_Bank" value="' + escP(c.bank || '') + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>شعبه</label><input id="chE_Branch" value="' + escP(c.branch || '') + '"></div>' +
      '<div class="fld"><label>سری چک</label><input id="chE_Series" value="' + escP(c.series || '') + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>مالکیت چک *</label><select id="chE_Own">' + (function () {
        var cur = (typeof window.ptfChequeOwnershipOf === 'function' ? window.ptfChequeOwnershipOf(c) : (c.ownership || '')) || (c.direction === 'received' ? 'third_party' : 'company');
        return [['company', '🏢 چک شرکت'], ['personal', '👤 چک شخصی'], ['received', '📥 چک وارده مشتری'], ['third_party', '🪪 چک ثالث']].map(function (o) {
          return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('');
      })() + '</select></div>' +
      '<div class="fld"><label>نام روی دسته / حساب</label><input id="chE_Owner" value="' + escP(c.owner || '') + '"></div></div>' +
      '<div class="fr"><div class="fld"><label>شماره حساب</label><input id="chE_Acc" value="' + escP(c.accountNo || '') + '" style="direction:ltr"></div><div class="fld"></div></div>' +
      '<div class="fld"><label>یادداشت</label><input id="chE_Note" value="' + escP(c.note || '') + '"></div>' +
      '<div class="fld"><label>📎 اسناد / کپی چک (افزودن + حذف)</label><div id="chE_Files" style="min-height:40px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="document.getElementById(\'ptfChEditDlg\').remove()">انصراف</button>' +
      '<button class="bt" onclick="ptfChequeEditSave(\'' + ptfOnClickArg(cd) + '\')">💾 ذخیره</button></div></div></div>';
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', html);
    window._ptfChEditNewFiles = [];
    /* نمایش اسناد موجود + آپلود سند جدید */
    var fw = document.getElementById('chE_Files');
    if (fw) {
      var existing = (c.files || []).map(function (f) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px"><a href="javascript:void(0)" onclick="openStoredFile(\'' + ptfOnClickArg(f.key) + '\')">📎 ' + escP(f.name || 'فایل') + '</a> <button class="ba" style="color:#dc2626" onclick="ptfChEditRemoveFile(' + JSON.stringify(f.key) + ')">✕</button></div>';
      }).join('');
      fw.innerHTML = existing + '<div id="chE_Up" style="margin-top:4px"></div>';
      try { if (typeof attachUploadWidget === 'function') attachUploadWidget('chE_Up', 'cheques/', function (fr) { if (fr) window._ptfChEditNewFiles.push(fr); }); } catch (eU) {}
    }
  };
  /* حذف یک فایل از چک در ویرایش (با کلید) */
  window.ptfChEditRemoveFile = function (key) {
    var cd = window._ptfChEditCd;
    if (!cd) return;
    var c = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
    if (!c) return;
    if (!confirm('این سند از چک و فضای ابری حذف شود؟')) return;
    if (typeof window.ptfDeleteStoredFile !== 'function') { alert('سرویس حذف فایل آماده نیست؛ صفحه را تازه کنید.'); return; }
    window.ptfDeleteStoredFile(key, function (res) {
      if (!res.ok) { if (typeof ptfToast === 'function') ptfToast('⛔ سند حذف نشد: ' + res.error, 'warn'); else alert(res.error); return; }
      var fresh = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
      if (!fresh) return;
      var files = (fresh.files || []).filter(function (f) { return f.key !== key; });
      var deleted = (fresh._deletedFileKeys || []).concat([key]).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      if (typeof window.ptfChequeUpdate === 'function') window.ptfChequeUpdate(cd, { files: files, _deletedFileKeys: deleted });
      var old = document.getElementById('ptfChEditDlg'); if (old) old.remove();
      window.ptfChequeEditUi(cd);
    });
  };
  /* ذخیرهٔ ویرایش چک — با فایل‌های موجود + جدید + اصلاح آنی مبلغ اثر مالی */
  window.ptfChequeEditSave = function (cd) {
    window._ptfChEditCd = cd;
    var c = (typeof window.ptfChequeFind === 'function') ? window.ptfChequeFind(cd) : null;
    if (!c) { alert('چک یافت نشد'); return; }
    function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    var sayad = String(val('chE_Sayad') || '').trim();
    var amt = (typeof ptfNum === 'function') ? ptfNum(val('chE_Amt')) : (+String(val('chE_Amt') || '').replace(/[^\\d.-]/g, '') || 0);
    var to = String(val('chE_To') || '').trim();
    if (!sayad || !amt || !to) { alert('شناسه صیادی، مبلغ و ذی‌نفع الزامی است'); return; }
    var dueJ = String(val('chE_Due') || '').trim();
    var dueISO = '';
    if (dueJ) { try { dueISO = (typeof ptfJToISO === 'function') ? (ptfJToISO(dueJ) || '') : ''; } catch (eD) {} }
    var patch = {
      no: String(val('chE_No') || '').trim() || sayad,
      sayad: sayad, amt: amt, toWhom: to,
      bank: String(val('chE_Bank') || '').trim(), branch: String(val('chE_Branch') || '').trim(),
      series: String(val('chE_Series') || '').trim(), owner: String(val('chE_Owner') || '').trim(),
      ownership: String(val('chE_Own') || '').trim() || (c.direction === 'received' ? 'third_party' : 'company'),
      accountNo: String(val('chE_Acc') || '').trim(),
      note: String(val('chE_Note') || '').trim()
    };
    if (dueISO) patch.dueISO = dueISO; else if (c.dueISO && !dueJ) patch.dueISO = c.dueISO;
    /* ترکیب فایل‌های موجود + جدید */
    var newFiles = (window._ptfChEditNewFiles || []).slice();
    if (newFiles.length) patch.files = (c.files || []).concat(newFiles);
    var oldAmt = +c.amt || 0;
    var r = (typeof window.ptfChequeUpdate === 'function') ? window.ptfChequeUpdate(cd, patch) : { ok: false };
    if (!r.ok) { alert('ذخیره نشد (' + (r.why || 'خطا') + ')'); return; }
    var finMsg = '';
    if (oldAmt !== amt && (c.direction === 'issued' || c.ownership === 'company') && typeof window.ptfChequeApplyFinancialAmount === 'function') {
      var fr = window.ptfChequeApplyFinancialAmount(cd, amt);
      if (fr.ok && fr.updated) finMsg = ' — اثر مالی حساب تأمین‌کننده از ' + money(oldAmt) + ' به ' + money(amt) + ' اصلاح شد';
    }
    try { audit('چک‌ها', 'ویرایش چک ' + (sayad || cd) + ' — مبلغ ' + money(amt) + ' در وجه ' + to, cd); } catch (eA) {}
    var dlg = document.getElementById('ptfChEditDlg'); if (dlg) dlg.remove();
    if (typeof ptfToast === 'function') ptfToast('✅ چک ویرایش شد' + finMsg, 'ok');
    window.ptfChequePanelRender();
    try { if (typeof window.ptfDataQualityRender === 'function') window.ptfDataQualityRender(); } catch (eQ) {}
  };
})();

/* CHQ-V2: باز کردن دستیار با جهتِ زیرتب فعلی پنل */
window.ptfChequeAiOpenSub = function () {
  window.ptfChequeAiOpen(window.ptfChequePanelSub === 'received' ? 'received' : 'issued');
};

/* ============ CHQ-V2: دستیار هوشمند چک (OCR) در پنل چک — ثبت در ماژول جدید + اثر مالی ============ */
window.ptfChequeAiOpen = function (direction) {
  var dir = direction === 'received' ? 'received' : 'issued';
  var html = '<div class="md-b" id="ptfChAiDlg" style="display:grid;z-index:2300" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:700px;max-height:94vh;overflow:auto">' +
    '<h3>🤖 دستیار هوشمند چک — ' + (dir === 'received' ? 'چک وارده' : 'چک صادره') + '</h3>' +
    /* v33.8.0 (مصوب کارفرما): در دستیار هم اول نوع وارده/صادره پرسیده می‌شود */
    '<div class="fld" style="max-width:280px;margin-bottom:8px"><label>نوع چک</label><select id="ptfChAiDirSel" onchange="ptfChAiDirChange(this.value)">' +
    '<option value="received"' + (dir === 'received' ? ' selected' : '') + '>📥 چک وارده (دریافتی از مشتری/ثالث)</option>' +
    '<option value="issued"' + (dir === 'issued' ? ' selected' : '') + '>🏢 چک صادره (پرداخت/ضمانت شرکت)</option></select></div>' +
    '<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 12px;font-size:12.5px;color:#5b21b6;margin-bottom:10px">عکس/PDF چک را بدهید؛ سیستم شناسه صیادی، مبلغ، تاریخ و ذینفع را می‌خواند. اگر موردی ناقص بود، از فهرست تامین‌کننده/مشتری انتخاب کنید یا دستی وارد کنید. ثبت نهایی فقط پس از تایید شما.</div>' +
    '<input type="file" id="ptfChAiFile" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="ptfChAiFileGo(this)">' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt" onclick="document.getElementById(\'ptfChAiFile\').click()">📎 عکس/PDF چک</button><button class="bt bt-o" onclick="ptfChAiTextBox()">📝 ورود متن</button></div>' +
    '<div id="ptfChAiStatus" style="margin-top:10px;font-size:12.5px;color:#64748b"></div>' +
    '<div id="ptfChAiOut" style="margin-top:12px"></div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  window._ptfChAiDir = dir;
};
window.ptfChAiDirChange = function (d) {
  window._ptfChAiDir = d === 'received' ? 'received' : 'issued';
  try {
    var h = document.querySelector('#ptfChAiDlg h3');
    if (h) h.textContent = '🤖 دستیار هوشمند چک — ' + (window._ptfChAiDir === 'received' ? 'چک وارده' : 'چک صادره');
  } catch (eH) {}
  var out = document.getElementById('ptfChAiOut');
  if (out) {
    if (window._ptfChAiData && Object.keys(window._ptfChAiData).length) window.ptfChAiRender(window._ptfChAiData);
    else out.innerHTML = '';
  }
};
window.ptfChAiApi = function (body, cb) {
  fetch('../api/llm.php?action=cheque', { method: 'POST', headers: (typeof ptfApiAuthHeaders === 'function' ? ptfApiAuthHeaders(true) : { 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
    .then(function (r) { return r.json(); }).then(cb).catch(function () { cb({ ok: false, error: 'عدم دسترسی به سرور AI' }); });
};
window.ptfChAiTextBox = function () {
  var out = document.getElementById('ptfChAiOut'); if (!out) return;
  out.innerHTML = '<div class="fld"><label>متن مشخصات چک</label><textarea id="ptfChAiText" rows="4" placeholder="چک صیاد... مبلغ... سررسید 1405/06/15..."></textarea></div><button class="bt" onclick="ptfChAiTextGo()">استخراج از متن</button>';
};
window.ptfChAiTextGo = function () {
  var txt = ((document.getElementById('ptfChAiText') || {}).value || '').trim();
  if (!txt) { alert('متن را وارد کنید'); return; }
  var st = document.getElementById('ptfChAiStatus'); if (st) st.textContent = '⏳ در حال استخراج...';
  ptfChAiApi({ text: txt }, function (d) { if (!d.ok) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + (d.error || 'خطا') + '</span>'; return; } if (st) st.textContent = '✅ استخراج شد'; ptfChAiRender(d.data || {}); });
};
window.ptfChAiFileGo = function (inp) {
  var f = inp.files[0]; if (!f) return;
  if (f.size > 8 * 1048576) { alert('فایل بزرگتر از ۸MB است'); return; }
  var st = document.getElementById('ptfChAiStatus'); if (st) st.textContent = '⏳ در حال خواندن فایل...';
  var rd = new FileReader();
  rd.onload = function () {
    var b64 = String(rd.result).split(',')[1];
    ptfChAiApi({ mime: f.type, b64: b64 }, function (d) { if (!d.ok) { if (st) st.innerHTML = '<span style="color:#dc2626">❌ ' + (d.error || 'خطا') + '</span>'; return; } if (st) st.textContent = '✅ استخراج شد'; ptfChAiRender(d.data || {}, f); });
  };
  rd.readAsDataURL(f); inp.value = '';
};
window.ptfChAiRender = function (c, fileObj) {
  window._ptfChAiData = c || {};
  var dir = window._ptfChAiDir === 'received' ? 'received' : 'issued';
  var out = document.getElementById('ptfChAiOut'); if (!out) return;
  /* v33.7.0: فهرست‌های شرطی — تامین‌کنندگان دارای مطالبه از ما / مشتریان دارای پرونده فروش باز */
  var supOpts = '<option value="">— تامین‌کننده دارای مطالبه —</option>';
  var custOpts = '<option value="">— مشتری دارای پرونده باز —</option>';
  try {
    (typeof window.ptfChequeSupOptions === 'function' ? window.ptfChequeSupOptions() : []).forEach(function (x) { supOpts += '<option value="' + escP(x.cd) + '">' + escP(x.lb) + '</option>'; });
    (typeof window.ptfChequeCustOptions === 'function' ? window.ptfChequeCustOptions() : []).forEach(function (x) { custOpts += '<option value="' + escP(x.cd) + '">' + escP(x.lb) + '</option>'; });
  } catch (eL) {}
  out.innerHTML =
    '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:12px">' +
    '<div class="fr"><div class="fld"><label>شماره چک / صیاد *</label><input id="ptfChAiNo" value="' + escP(c.no || c.sayad || '') + '" style="direction:ltr"></div>' +
    '<div class="fld"><label>مبلغ (ریال) *</label><input id="ptfChAiAmt" data-money="1" inputmode="numeric" value="' + escP(c.amt || '') + '" style="direction:ltr"></div></div>' +
    '<div class="fr"><div class="fld"><label>در وجه (ذینفع)</label><input id="ptfChAiTo" value="' + escP(c.toWhom || c.payee || '') + '" placeholder="نام ذینفع (اگر روی چک هست)"></div>' +
    '<div class="fld"><label>بانک / شعبه</label><input id="ptfChAiBank" value="' + escP(c.bank || '') + '"></div></div>' +
    '<div class="fr"><div class="fld"><label>تاریخ سررسید (شمسی) *</label>' + (typeof ptfDatePicker === 'function' ? ptfDatePicker('ptfChAiDueJ', c.dueISO || '', '1405/06/15') : '<input id="ptfChAiDueJ" value="' + escP(c.dueJ || '') + '" style="direction:ltr">') + '</div>' +
    '<div class="fld"><label>نوع چک</label><select id="ptfChAiKind" onchange="ptfChAiKindUi()"><option value="finance">💰 مالی</option><option value="guarantee">🛡 ضمانت / سپرده</option></select></div></div>' +
    (dir === 'received'
      ? '<div class="fr"><div class="fld"><label>نوع ذی‌نفع</label><select id="ptfChAiParty" onchange="ptfChAiPartyUi()"><option value="cust">🤝 مشتری (پرونده باز)</option><option value="third">🪪 ثالث (چک شخص/شرکت دیگر)</option><option value="other">👤 سایر</option></select></div><div class="fld" id="ptfChAiPartyWrap" style="min-width:240px"></div></div>' +
        '<div class="fld" id="ptfChAiInvWrap" style="display:none"><label>فاکتور باز (اختیاری — کسر از مطالبات)</label><select id="ptfChAiInv"><option value="">— بدون فاکتور (در گردش) —</option></select></div>'
      : '<div class="fld"><label>تامین‌کننده (ذینفع) *</label><select id="ptfChAiSup">' + supOpts + '</select></div>' +
        '<div class="fld" id="ptfChAiGuarWrap" style="display:none"><label>نوع ضمانت</label><select id="ptfChAiGuarType" onchange="ptfChAiKindUi()"><option value="advance">ضمانت پیش‌پرداخت</option><option value="performance">ضمانت حسن انجام کار</option><option value="bid">ضمانت شرکت در مناقصه</option><option value="other">سایر</option></select></div>' +
        '<div class="fld" id="ptfChAiDealWrap" style="display:none"><label>پرونده فروش (برای پیش‌پرداخت/حسن انجام کار)</label><select id="ptfChAiDeal"><option value="">— انتخاب پرونده فروش —</option></select></div>') +
    '<div class="fld"><label>📎 کپی چک (اختیاری — ضمیمه شود)</label><div id="ptfChAiUp" style="min-height:40px;border:1.5px dashed var(--brd);border-radius:10px;padding:8px;background:#f8fafc"></div></div>' +
    '<div class="fld"><label>یادداشت</label><input id="ptfChAiNote" value="' + escP(c.note || '') + '"></div>' +
    '<button class="bt" style="margin-top:6px" onclick="ptfChAiCommit()">✅ ثبت چک</button></div>';
  window._ptfChAiCustOpts = custOpts;
  window._ptfChAiSupOpts = supOpts;
  window.ptfChAiKindUi();
  if (dir === 'received') window.ptfChAiPartyUi();
  else window.ptfChAiDealReload();
  /* کپی چک (اختیاری) */
  window._ptfChAiFiles = [];
  try { if (typeof attachUploadWidget === 'function') attachUploadWidget('ptfChAiUp', 'cheques/', function (fr) { if (fr) window._ptfChAiFiles.push(fr); }); } catch (eU) {}
  if (fileObj && fileObj.name) window._ptfChAiFileName = fileObj.name;
};
window.ptfChAiKindUi = function () {
  var g = ((document.getElementById('ptfChAiKind') || {}).value === 'guarantee');
  var gt = ((document.getElementById('ptfChAiGuarType') || {}).value || 'advance');
  var needDeal = g && gt !== 'bid'; /* ضمانت شرکت در مناقصه مستقل از پرونده فروش است. */
  var w1 = document.getElementById('ptfChAiGuarWrap'); if (w1) w1.style.display = g ? '' : 'none';
  var w2 = document.getElementById('ptfChAiDealWrap'); if (w2) w2.style.display = needDeal ? '' : 'none';
  if (needDeal && typeof window.ptfChAiDealReload === 'function') window.ptfChAiDealReload();
};
/* v33.8.0: نوع ذی‌نفع در دستیار (مشتری/ثالث/سایر) برای چک وارده */
window.ptfChAiPartyUi = function () {
  var v = ((document.getElementById('ptfChAiParty') || {}).value || 'cust');
  var wrap = document.getElementById('ptfChAiPartyWrap'); if (!wrap) return;
  if (v === 'cust') {
    wrap.innerHTML = '<label>مشتری (صادرکننده) *</label><select id="ptfChAiCust" onchange="ptfChAiCustInv()">' + (window._ptfChAiCustOpts || '') + '</select>';
  } else if (v === 'third') {
    wrap.innerHTML = '<label>نام ثالث (صادرکننده چک) *</label><input id="ptfChAiThird" placeholder="نام شخص/شرکت ثالث — بدون پرونده">';
  } else {
    wrap.innerHTML = '<label>نام ذی‌نفع (سایر) *</label><input id="ptfChAiOther">';
  }
  var iw = document.getElementById('ptfChAiInvWrap');
  if (iw) iw.style.display = (v === 'cust' && ((document.getElementById('ptfChAiCust') || {}).value)) ? '' : 'none';
  if (v === 'cust') window.ptfChAiCustInv();
};
window.ptfChAiDealReload = function () {
  var sel = document.getElementById('ptfChAiDeal'); if (!sel) return;
  var opts = '<option value="">— انتخاب پرونده فروش —</option>';
  try {
    (getData('ptf_crm_deals') || []).filter(function (d) { return d.wonOffer && d.st !== 'archived'; }).forEach(function (d) {
      opts += '<option value="' + escP(d.cd) + '">' + escP((d.inqNo || d.cd) + ' — ' + (d.buyerCo || '')) + '</option>';
    });
  } catch (e) {}
  sel.innerHTML = opts;
};
window.ptfChAiCustInv = function () {
  var custCd = ((document.getElementById('ptfChAiCust') || {}).value || '');
  var sel = document.getElementById('ptfChAiInv'); if (!sel) return;
  var opts = '<option value="">— بدون فاکتور (در گردش) —</option>';
  try {
    (typeof window.ptfChequeOpenInvoicesOf === 'function' ? window.ptfChequeOpenInvoicesOf(custCd) : []).forEach(function (inv) {
      opts += '<option value="' + escP(inv.cd) + '">' + escP(inv.lb) + '</option>';
    });
  } catch (eI) {}
  sel.innerHTML = opts;
};
window.ptfChAiCommit = function () {
  var dir = window._ptfChAiDir === 'received' ? 'received' : 'issued';
  var no = ((document.getElementById('ptfChAiNo') || {}).value || '').trim();
  var amt = (typeof ptfNum === 'function') ? ptfNum((document.getElementById('ptfChAiAmt') || {}).value) : +((document.getElementById('ptfChAiAmt') || {}).value || 0);
  var dueRaw = ((document.getElementById('ptfChAiDueJ') || {}).value || '').trim();
  var bank = ((document.getElementById('ptfChAiBank') || {}).value || '').trim();
  var note = ((document.getElementById('ptfChAiNote') || {}).value || '').trim();
  var kind = ((document.getElementById('ptfChAiKind') || {}).value === 'guarantee') ? 'guarantee' : 'finance';
  var toWhom = ((document.getElementById('ptfChAiTo') || {}).value || '').trim();
  if (!no || !amt) { alert('شماره چک و مبلغ الزامی است'); return; }
  if (kind !== 'guarantee' && !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(window.ptfPettyNormDate ? window.ptfPettyNormDate(dueRaw) : dueRaw) && !/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) { alert('تاریخ سررسید (شمسی) الزامی است'); return; }
  var dueFa = /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dueRaw) ? dueRaw : (typeof ptfISOToJ === 'function' ? (ptfISOToJ(dueRaw) || '') : '');
  var rec = { no: no, sayad: no, amt: amt, bank: bank, note: note, kind: kind, toWhom: toWhom, files: window._ptfChAiFiles || [] };
  if (dir === 'received') {
    var partyKind = ((document.getElementById('ptfChAiParty') || {}).value || 'cust');
    var custCd = '', invCd = '';
    if (partyKind === 'cust') {
      custCd = ((document.getElementById('ptfChAiCust') || {}).value || '');
      invCd = ((document.getElementById('ptfChAiInv') || {}).value || '');
      if (!custCd) { alert('مشتری (صادرکننده چک) را از فهرست مشتریان دارای پرونده باز انتخاب کنید'); return; }
      var cRec = (getData('ptf_crm_customers') || []).filter(function (x) { return x.cd === custCd; })[0] || {};
      rec.sourceCustomerCd = custCd; rec.custCd = custCd; rec.payerName = cRec.co || cRec.name || custCd; rec.sourceInvoiceCd = invCd || '';
      rec.toWhom = rec.toWhom || cRec.co || custCd;
    } else if (partyKind === 'third') {
      var thirdNm = ((document.getElementById('ptfChAiThird') || {}).value || '').trim();
      if (!thirdNm) { alert('نام ثالث (صادرکننده چک) الزامی است'); return; }
      rec.thirdParty = true; rec.payerName = thirdNm; rec.toWhom = rec.toWhom || thirdNm;
    } else {
      var otherNm = ((document.getElementById('ptfChAiOther') || {}).value || '').trim();
      if (!otherNm) { alert('نام ذی‌نفع الزامی است'); return; }
      rec.payerName = otherNm; rec.toWhom = rec.toWhom || otherNm;
    }
    rec.dueFa = dueFa;
  } else {
    var supCd = ((document.getElementById('ptfChAiSup') || {}).value || '');
    if (!supCd) { alert('تامین‌کننده (ذینفع) را از فهرست تامین‌کنندگان دارای مطالبه انتخاب کنید'); return; }
    var sRec = (getData('ptf_crm_suppliers') || []).filter(function (x) { return x.cd === supCd; })[0] || {};
    rec.supplierCd = supCd; rec.supplierName = sRec.co || sRec.name || supCd; rec.toWhom = rec.toWhom || sRec.co || supCd;
    rec.dueFa = dueFa;
    if (kind === 'guarantee') {
      rec.guarType = ((document.getElementById('ptfChAiGuarType') || {}).value || 'advance');
      var dealCd = ((document.getElementById('ptfChAiDeal') || {}).value || '');
      if (rec.guarType !== 'bid' && !dealCd) { alert('⛔ برای این نوع ضمانت، انتخاب پرونده فروش الزامی است. ضمانت شرکت در مناقصه می‌تواند مستقل ثبت شود.'); return; }
      var deal = (getData('ptf_crm_deals') || []).filter(function (x) { return x.cd === dealCd; })[0];
      rec.dealCd = dealCd; rec.dealLabel = deal ? ((deal.inqNo || deal.cd) + ' — ' + (deal.buyerCo || '')) : '';
    }
  }
  var ch = window.ptfChequeCreate(dir, rec);
  try { if (typeof chUpsertReminder === 'function') chUpsertReminder(ch); } catch (eR) {}
  var dlg = document.getElementById('ptfChAiDlg'); if (dlg) dlg.remove();
  if (typeof ptfToast === 'function') {
    if (kind === 'guarantee') ptfToast(rec.guarType === 'bid' ? 'ضمانت شرکت در مناقصه به‌صورت مستقل ثبت شد (بدون اثر مالی)' : 'چک ضمانت ثبت شد — در پرونده فروش نشانده شد (با پایان پروژه مسترد می‌شود)', 'ok');
    else ptfToast('چک ثبت شد' + ((ch.financial && ch.financial.ok) ? ' — اثر مالی در حساب ' + (dir === 'received' ? 'مشتری' : 'تامین‌کننده') + ' اعمال شد' : (dir === 'received' ? ' — بدون فاکتور؛ با وصول اثر مالی می‌گیرد' : '')) + '.', 'ok');
  }
  window.ptfChequePanelRender();
};
/* CHQ-PRINT (v33.6.0): چاپ برگه چک و تابع مبلغ‌به‌حروف از هاب مالی به ماژول مستقل
   «چاپ چک فیزیکی» (crm/cheque-print.js — گروه کالا و اسناد) منتقل شد. */

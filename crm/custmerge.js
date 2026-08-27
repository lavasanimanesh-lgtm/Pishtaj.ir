/* =====================================================================
   PTF CRM — custmerge.js — v14.7 — US-363 (بزرگ — اسپرینت هـ «مشتریان یکپارچه»)
   ادغام مشتریان تکراری (Merge) با انتخاب فیلدبه‌فیلد:
   - نقطه ورود ۱: پیام ضدتکرار (ptfDupBlock مشتری) → گزینه «🔀 ادغام با رکورد موجود»
   - نقطه ورود ۲: دکمه «🔀 ادغام» روی فهرست مشتریان (انتخاب دو رکورد موجود)
   - ویزارد: دو رکورد کنار هم؛ هر فیلد انتخاب جدید/قدیم؛ پیش‌فرض هوشمند = کامل‌تر
   - رابط‌ها و شماره‌های غیرتکراری جمع می‌شوند (نه جایگزینی)
   - بازنویسی همه ارجاعات کد مشتری: rfqs(custCd) / offers(buyerCd) / deals / projects
     / invoices(از طریق offers) / reminders / cheques / letters
   - رکورد حذف‌شده → deleted_archive (حذف نرم با ذکر merge) + snapshot دو رکورد + audit
   - فقط نقش‌های admin/chairman/ceo/commercial + confirm دومرحله‌ای
   ===================================================================== */
(function () {
  'use strict';

  var MERGE_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
  function canMerge() { try { return MERGE_ROLES.indexOf(curRole()) > -1; } catch (e) { return false; } }

  /* فیلدهای ساده قابل انتخاب در ویزارد */
  var FIELDS = [
    { k: 'co', lb: 'نام شرکت (فارسی)' },
    { k: 'coEn', lb: 'نام انگلیسی' },
    { k: 'kind', lb: 'نوع (حقیقی/حقوقی)' },
    { k: 'ind', lb: 'صنعت' },
    { k: 'natId', lb: 'شناسه ملی' },
    { k: 'melli', lb: 'کد ملی' },
    { k: 'venSt', lb: 'وضعیت وندور' },
    { k: 'venNo', lb: 'شماره وندور' },
    { k: 'coWeb', lb: 'وب‌سایت/ایمیل' },
    { k: 'coAddr', lb: 'آدرس' },
    { k: 'creditLimit', lb: 'سقف اعتبار' }
  ];

  /* پیش‌فرض هوشمند: مقدار «کامل‌تر» (ناخالی و طولانی‌تر) — AC2 */
  function smarter(a, b) {
    var sa = String(a == null ? '' : a).trim(), sb = String(b == null ? '' : b).trim();
    if (!sa) return 'b';
    if (!sb) return 'a';
    return sb.length > sa.length ? 'b' : 'a';
  }

  var _mg = null; /* {keepCd, dropCd, choices:{}} */

  /* ---------- نقطه ورود ۲: انتخاب دو مشتری ---------- */
  window.ptfMergeStart = function (dropCd) {
    if (!canMerge()) { alert('⛔ ادغام مشتریان فقط توسط ادمین/رییس هیات مدیره/مدیرعامل/مدیر بازرگانی مجاز است (US-363)'); return; }
    var custs = getData('ptf_crm_customers');
    var drop = custs.filter(function (c) { return c.cd === dropCd; })[0];
    if (!drop) return;
    var others = custs.filter(function (c) { return c.cd !== dropCd; });
    if (!others.length) { alert('مشتری دیگری برای ادغام وجود ندارد'); return; }
    var opts = others.map(function (c) { return '<option value="' + escP(c.cd) + '">' + escP(c.co) + ' (' + escP(c.cd) + ')</option>'; }).join('');
    var html = '<div class="md-b" id="mgPick" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px">' +
      '<h3>🔀 ادغام مشتری «' + escP(drop.co) + '»</h3>' +
      '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:10px 14px;font-size:12.5px;margin-bottom:10px">رکورد انتخابی <b>در رکورد مقصد ادغام و سپس حذف نرم</b> می‌شود؛ همه درخواست‌ها، پیشنهادها، پرونده‌ها و اسناد به مقصد منتقل می‌شوند.</div>' +
      '<div class="fld"><label>ادغام در (رکورد مقصد که باقی می‌ماند):</label><select id="mgTarget">' + opts + '</select></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#7c3aed" onclick="var t=document.getElementById(\'mgTarget\').value;document.getElementById(\'mgPick\').remove();ptfMergeWizard(t,\'' + ptfOnClickArg(dropCd) + '\')">ادامه ← ویزارد ادغام</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  /* ---------- ویزارد فیلدبه‌فیلد (AC2) ---------- */
  window.ptfMergeWizard = function (keepCd, dropCd) {
    if (!canMerge()) return;
    var custs = getData('ptf_crm_customers');
    var keep = custs.filter(function (c) { return c.cd === keepCd; })[0];
    var drop = custs.filter(function (c) { return c.cd === dropCd; })[0];
    if (!keep || !drop) { alert('رکورد یافت نشد'); return; }
    _mg = { keepCd: keepCd, dropCd: dropCd, choices: {} };
    var rows = FIELDS.map(function (f) {
      var va = keep[f.k], vb = drop[f.k];
      var sa = String(va == null ? '' : va), sb = String(vb == null ? '' : vb);
      if (sa === sb) { _mg.choices[f.k] = 'a'; return ''; } /* یکسان — نیازی به انتخاب نیست */
      var def = smarter(va, vb);
      _mg.choices[f.k] = def;
      return '<tr><td style="font-size:12px;font-weight:800;white-space:nowrap">' + f.lb + '</td>' +
        '<td><label style="display:flex;gap:6px;align-items:flex-start;cursor:pointer;font-size:12px"><input type="radio" name="mg_' + f.k + '" value="a"' + (def === 'a' ? ' checked' : '') + ' onchange="_ptfMgSet(\'' + f.k + '\',\'a\')"><span>' + (sa ? escP(sa) : '<i style="color:#cbd5e1">خالی</i>') + '</span></label></td>' +
        '<td><label style="display:flex;gap:6px;align-items:flex-start;cursor:pointer;font-size:12px"><input type="radio" name="mg_' + f.k + '" value="b"' + (def === 'b' ? ' checked' : '') + ' onchange="_ptfMgSet(\'' + f.k + '\',\'b\')"><span>' + (sb ? escP(sb) : '<i style="color:#cbd5e1">خالی</i>') + '</span></label></td></tr>';
    }).join('');
    var pplA = (keep.people || []).length, pplB = (drop.people || []).length;
    var refCount = mergeRefCount(dropCd);
    var html = '<div class="md-b" id="mgWiz" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:94vh;overflow:auto">' +
      '<h3>🔀 ویزارد ادغام مشتریان (US-363)</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
      '<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:9px 12px;font-size:12.5px">✅ <b>مقصد (می‌ماند):</b><br>' + escP(keep.co) + ' <small dir="ltr">(' + escP(keep.cd) + ')</small></div>' +
      '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:9px 12px;font-size:12.5px">🗑 <b>ادغام‌شونde (حذف نرم):</b><br>' + escP(drop.co) + ' <small dir="ltr">(' + escP(drop.cd) + ')</small></div></div>' +
      (rows.trim()
        ? '<div style="font-size:12.5px;color:#475569;margin-bottom:6px">برای هر فیلدِ متفاوت، مقدار نهایی را انتخاب کنید (پیش‌فرض هوشمند = مقدار کامل‌تر):</div>' +
          '<div class="tb2" style="max-height:280px;overflow:auto"><table><thead><tr><th>فیلد</th><th>✅ مقصد</th><th>🗑 ادغام‌شونده</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div style="font-size:12.5px;color:#059669;background:#f0fdf4;border-radius:10px;padding:8px 12px">همه فیلدهای ساده یکسان‌اند — چیزی برای انتخاب نیست.</div>') +
      '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px 14px;font-size:12.5px;margin:10px 0;line-height:2">' +
      '👥 اشخاص رابط: ' + pplA + ' + ' + pplB + ' ← رابط‌ها و شماره‌های <b>غیرتکراری جمع می‌شوند</b> (AC3)<br>' +
      '🔗 ارجاعات قابل انتقال به مقصد: <b>' + refCount.total + '</b> رکورد (' + refCount.desc + ')<br>' +
      '🗂 قبل از ادغام، snapshot هر دو رکورد در آرشیو حذف‌شده‌ها ذخیره می‌شود (AC8)</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#7c3aed" onclick="ptfMergeCommit()">🔀 تایید و ادغام نهایی</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window._ptfMgSet = function (k, v) { if (_mg) _mg.choices[k] = v; };

  /* شمار ارجاعات رکورد حذف‌شونده (برای پیش‌نمایش) */
  function mergeRefCount(cd) {
    var n = { rfqs: 0, offers: 0, deals: 0, projects: 0, reminders: 0, cheques: 0 };
    getData('ptf_crm_rfqs').forEach(function (r) { if (r.custCd === cd) n.rfqs++; });
    getData('ptf_crm_offers').forEach(function (o) { if (o.buyerCd === cd) n.offers++; });
    getData('ptf_crm_deals').forEach(function (d) { if (d.custCd === cd || d.buyerCd === cd) n.deals++; });
    getData('ptf_crm_projects').forEach(function (p) { if (p.custCd === cd || p.buyerCd === cd) n.projects++; });
    getData('ptf_crm_reminders').forEach(function (r) { if (r.custCd === cd || r.ref === cd) n.reminders++; });
    getData('ptf_crm_cheques').forEach(function (c) { if (c.custCd === cd) n.cheques++; });
    var parts = [];
    Object.keys(n).forEach(function (k) { if (n[k]) parts.push(k + ':' + n[k]); });
    return { total: n.rfqs + n.offers + n.deals + n.projects + n.reminders + n.cheques, desc: parts.join('، ') || 'بدون ارجاع' };
  }

  /* ---------- اجرای ادغام (AC4..AC8) ---------- */
  window.ptfMergeCommit = function () {
    if (!_mg || !canMerge()) return;
    var custs = getData('ptf_crm_customers');
    var keep = custs.filter(function (c) { return c.cd === _mg.keepCd; })[0];
    var drop = custs.filter(function (c) { return c.cd === _mg.dropCd; })[0];
    if (!keep || !drop) return;
    /* AC8: confirm دومرحله‌ای — برگشت‌ناپذیر */
    if (!confirm('🔀 تایید نهایی ادغام (غیرقابل بازگشت)\n\n«' + drop.co + '» (' + drop.cd + ') در «' + keep.co + '» (' + keep.cd + ') ادغام و حذف نرم می‌شود.\nهمه ارجاعات به مقصد منتقل می‌شوند.\n\nادامه می‌دهید؟')) return;

    /* AC8: snapshot دو رکورد قبل از ادغام */
    try {
      var arch = getData('ptf_crm_deleted_archive');
      arch.unshift({
        t: faDateTime(), by: curSession().name, user: curSession().user,
        kind: 'customer-merge-snapshot', reason: 'ادغام مشتریان (US-363): ' + drop.cd + ' ← ' + keep.cd,
        snapshot: { keep: JSON.parse(JSON.stringify(keep)), drop: JSON.parse(JSON.stringify(drop)) }
      });
      if (arch.length > 500) arch = arch.slice(0, 500);
      setData('ptf_crm_deleted_archive', arch);
    } catch (eS) {}

    /* فیلدهای ساده طبق انتخاب کاربر */
    var changedFields = [];
    FIELDS.forEach(function (f) {
      if (_mg.choices[f.k] === 'b') {
        if (String(keep[f.k] || '') !== String(drop[f.k] || '')) changedFields.push(f.lb);
        keep[f.k] = drop[f.k];
      }
    });

    /* AC3: جمع رابط‌ها و شماره‌های غیرتکراری */
    keep.people = keep.people || [];
    var addedPpl = 0;
    (drop.people || []).forEach(function (p) {
      var dup = keep.people.some(function (kp) { return (kp.nm || '').trim() === (p.nm || '').trim(); });
      if (!dup && (p.nm || '').trim()) { keep.people.push(p); addedPpl++; }
    });
    /* تلفن‌های سطح شرکت/شخص */
    keep.coTels = keep.coTels || [];
    (drop.coTels || []).forEach(function (t) {
      if (!keep.coTels.some(function (kt) { return kt.n === t.n; })) keep.coTels.push(t);
    });
    keep.phones = keep.phones || [];
    (drop.phones || []).forEach(function (t) {
      if (!keep.phones.some(function (kt) { return kt.n === t.n; })) keep.phones.push(t);
    });

    /* AC4: بازنویسی همه ارجاعات کد مشتری */
    var moved = 0;
    var rfqs = getData('ptf_crm_rfqs');
    rfqs.forEach(function (r) { if (r.custCd === drop.cd) { r.custCd = keep.cd; r.co = keep.co; moved++; } else if (r.co === drop.co) { r.co = keep.co; r.custCd = r.custCd || keep.cd; moved++; } });
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs);
    var offers = getData('ptf_crm_offers');
    offers.forEach(function (o) { if (o.buyerCd === drop.cd) { o.buyerCd = keep.cd; o.buyerCo = keep.coEn || keep.co; moved++; } });
    setData('ptf_crm_offers', offers);
    var deals = getData('ptf_crm_deals');
    deals.forEach(function (d) {
      if (d.custCd === drop.cd) { d.custCd = keep.cd; moved++; }
      if (d.buyerCd === drop.cd) { d.buyerCd = keep.cd; moved++; }
      if (d.buyerCo === drop.co) d.buyerCo = keep.co;
    });
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_deals', deals, { reason: 'w2' }); else setData('ptf_crm_deals', deals);
    var prjs = getData('ptf_crm_projects');
    prjs.forEach(function (p) {
      if (p.custCd === drop.cd) { p.custCd = keep.cd; moved++; }
      if (p.buyerCd === drop.cd) { p.buyerCd = keep.cd; moved++; }
      if (p.buyerCo === drop.co) p.buyerCo = keep.co;
    });
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_projects', prjs, { reason: 'w2' }); else setData('ptf_crm_projects', prjs);
    var rems = getData('ptf_crm_reminders');
    rems.forEach(function (r) { if (r.custCd === drop.cd) { r.custCd = keep.cd; moved++; } if (r.ref === drop.cd) { r.ref = keep.cd; moved++; } });
    setData('ptf_crm_reminders', rems);
    var chq = getData('ptf_crm_cheques');
    chq.forEach(function (c) { if (c.custCd === drop.cd) { c.custCd = keep.cd; moved++; } });
    setData('ptf_crm_cheques', chq);
    var lets = getData('ptf_crm_letters');
    lets.forEach(function (l) { if (l.to_co === drop.co) { l.to_co = keep.co; moved++; } });
    setData('ptf_crm_letters', lets);
    /* یادداشت ادغام روی مقصد (AC5: تجمیع مسیر اسناد از طریق انتقال deals/projects انجام شد) */
    keep.mergedFrom = keep.mergedFrom || [];
    keep.mergedFrom.push({ cd: drop.cd, co: drop.co, t: faDateTime(), by: curSession().name });

    /* AC4: حذف نرم رکورد دوم → deleted_archive */
    try {
      var arch2 = getData('ptf_crm_deleted_archive');
      arch2.unshift({
        t: faDateTime(), by: curSession().name, user: curSession().user,
        kind: 'customer', cd: drop.cd, name: drop.co,
        reason: '🔀 ادغام در ' + keep.co + ' (' + keep.cd + ') — US-363', rec: drop
      });
      if (arch2.length > 500) arch2 = arch2.slice(0, 500);
      setData('ptf_crm_deleted_archive', arch2);
    } catch (eA) {}
    custs = custs.filter(function (c) { return c.cd !== drop.cd; });
    /* v34.8.23 (W1-iterate): حذفِ ادغام با فرمان tombstone (بازیافت‌پذیر) */
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custs, { reason: 'custmerge' });
    else setData('ptf_crm_customers', custs);

    /* AC6: audit کامل */
    try {
      audit('مشتریان', '🔀 ادغام مشتری «' + drop.co + '» (' + drop.cd + ') در «' + keep.co + '» (' + keep.cd + ') — ' + moved + ' ارجاع منتقل، ' + addedPpl + ' رابط جمع' + (changedFields.length ? '، فیلدهای گرفته‌شده از ادغام‌شونده: ' + changedFields.join('/') : ''), keep.cd);
    } catch (eAu) {}
    if (typeof notify === 'function') {
      try { notify({ toRoles: MERGE_ROLES, title: '🔀 مشتری «' + drop.co + '» در «' + keep.co + '» ادغام شد (' + moved + ' ارجاع منتقل شد)', kind: 'admin', channels: ['cart'], link: { panel: 'cust' } }); } catch (eN) {}
    }
    var wiz = document.getElementById('mgWiz'); if (wiz) wiz.remove();
    _mg = null;
    if (typeof renderCustomers === 'function') try { renderCustomers(); } catch (eR) {}
    alert('✅ ادغام کامل شد.\n\n🔗 ' + moved + ' ارجاع (درخواست/پیشنهاد/پرونده/یادآور/چک/نامه) به «' + keep.co + '» منتقل شد.\n👥 ' + addedPpl + ' رابط غیرتکراری جمع شد.\n🗂 snapshot و رد کامل در گزارشات → آرشیو حذف‌شده‌ها موجود است.');
  };

  /* ---------- نقطه ورود ۱: گزینه ادغام داخل پیام ضدتکرار مشتری (AC1) ---------- */
  var _dupBlock = window.ptfDupBlock;
  if (typeof _dupBlock === 'function') {
    window.ptfDupBlock = function (kind, rec, excludeCd) {
      if (kind !== 'customer' || !canMerge()) return _dupBlock(kind, rec, excludeCd);
      var c = (typeof ptfCheckDup === 'function') ? ptfCheckDup('customer', rec, excludeCd) : [];
      if (!c.length) return false;
      /* v14.7 (US-363 AC1): به‌جای فقط سد، گزینه ادغام هم پیشنهاد بده */
      var first = c[0];
      var msg = (typeof dedupMsg === 'function' ? dedupMsg(c) : 'اطلاعات تکراری است') +
        '\n\n🔀 می‌خواهید این اطلاعات را با رکورد موجود «' + (first.name || '') + '» (' + (first.cd || '') + ') ادغام کنید؟\n' +
        '(OK = باز کردن ویزارد ادغام | Cancel = انصراف از ثبت)';
      if (confirm(msg)) {
        try { audit('ضد تکرار', 'پیشنهاد ادغام از پیام تکراری (US-363): ' + (first.cd || ''), first.cd || ''); } catch (eD) {}
        /* اگر در حال ویرایش رکورد موجود بود (excludeCd) → ادغام دو رکورد موجود؛
           وگرنه رکورد جدید هنوز ذخیره نشده — کاربر را به ویرایش رکورد موجود هدایت کن */
        if (excludeCd) {
          setTimeout(function () { ptfMergeWizard(first.cd, excludeCd); }, 200);
        } else {
          alert('ℹ️ رکورد جدید ذخیره نشد. ویزارد ادغام برای رکوردهای «موجود» است؛ اطلاعات جدید (مثل رابط) را در همان رکورد «' + (first.name || '') + '» ویرایش/اضافه کنید یا اگر دو رکورد موجود تکراری دارید از دکمه 🔀 فهرست مشتریان استفاده کنید.');
          if (typeof showCustModal === 'function' && first.cd) { try { hideModal(); showCustModal(first.cd); } catch (eM) {} }
        }
      } else {
        try { audit('ضد تکرار', 'جلوگیری از ثبت تکراری (customer): ' + (first.v || ''), first.cd || ''); } catch (eD2) {}
      }
      return true; /* در هر صورت ثبتِ رکورد جدید متوقف می‌شود */
    };
  }

  /* ---------- دکمه 🔀 روی فهرست مشتریان (hook رندر — الگوی رویدادمحور) ---------- */
  var _renderCust = window.renderCustomers;
  if (typeof _renderCust === 'function') {
    window.renderCustomers = function () {
      _renderCust();
      if (!canMerge()) return;
      try {
        var tb = document.getElementById('cTb');
        if (!tb) return;
        tb.querySelectorAll('tr').forEach(function (tr) {
          var strong = tr.querySelector('td strong');
          if (!strong || tr.querySelector('.mg-btn')) return;
          var cd = strong.textContent.trim();
          var tds = tr.querySelectorAll('td');
          tds[tds.length - 1].insertAdjacentHTML('beforeend',
            ' <button class="bt bt-o mg-btn entity-row-action" data-entity-action="merge" style="padding:4px 9px;font-size:12px;color:#7c3aed" title="ادغام این مشتری در مشتری دیگر (US-363)" aria-label="ادغام مشتری" onclick="ptfMergeStart(\'' + ptfOnClickArg(cd) + '\')">🔗</button>');
        });
      } catch (e) {}
    };
  }
})();

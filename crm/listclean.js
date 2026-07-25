/* =====================================================================
   PTF CRM — listclean.js — v17.6 — US-417 فاز ۱ (بک‌لاگ R7 — مصوب کارفرما)
   ویراستار فهرست‌ها: اسکن تکراری‌ها + تلفیق + تعیین تکلیف رکوردهای بی‌مصرف
   اصول (قاعده ایمنی پنل):
   - هیچ ادغام/حذف خودکاری بدون تایید انسانی — سیستم فقط «پیدا می‌کند و پیشنهاد می‌دهد»
   - اسکن با همان موتور مشترک dedup (dedupNorm/dedupPhones) — نه الگوریتم موازی
   - ادغام مشتری = عین ویزارد موجود custmerge (US-363 با بازنویسی همه لینک‌ها)
   - ادغام تامین‌کننده/سرنخ = همان الگو (snapshot + بازنویسی ارجاعات + حذف نرم + audit)
   - رکورد بی‌مصرف = بدون هیچ راه تماس + بدون هیچ تراکنش → فهرست تعیین تکلیف
     (تکمیل دستی با فرم موجود یا حذف با دلیل ptfReasonedDelete)
   - فاز ۲ (آینده): لایه هوش مصنوعی موارد خاکستری + تکمیل خودکار (llm.php)
   ===================================================================== */
(function () {
  'use strict';

  var CLEAN_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
  function canClean() { try { return CLEAN_ROLES.indexOf(curRole()) > -1; } catch (e) { return false; } }
  function norm(s) { return (typeof dedupNorm === 'function') ? dedupNorm(s) : String(s || '').toLowerCase(); }

  var KINDS = {
    cust: { key: 'ptf_crm_customers', lb: 'مشتریان', ic: '🤝' },
    sup: { key: 'ptf_crm_suppliers', lb: 'تامین‌کنندگان', ic: '🏭' },
    lead: { key: 'ptf_crm_leads', lb: 'سرنخ‌ها', ic: '🎯' }
  };

  /* ---------- اسکن زوج‌های مشکوک (موتور dedup مشترک) ---------- */
  window.ptfCleanScan = function (kind) {
    var K = KINDS[kind];
    var list = getData(K.key);
    var pairs = [];
    var phonesOf = function (r) { return (typeof dedupPhones === 'function') ? dedupPhones(r) : []; };
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var score = 0, why = [];
        var na = norm(a.co || a.nm), nb = norm(b.co || b.nm);
        /* نام: یکسان نرمال = قوی؛ شمول (آریاکنترل ⊂ آریاکنترل صنعت) = متوسط */
        if (na && na === nb) { score += 60; why.push('نام یکسان (نرمال‌شده)'); }
        else if (na && nb && na.length > 4 && nb.length > 4 && (na.indexOf(nb) > -1 || nb.indexOf(na) > -1)) { score += 30; why.push('نام مشابه (شمول)'); }
        /* نام EN */
        var ea = norm(a.coEn), eb = norm(b.coEn);
        if (ea && ea === eb) { score += 40; why.push('نام انگلیسی یکسان'); }
        /* شناسه ملی / کد ملی */
        if (a.natId && b.natId && norm(a.natId) === norm(b.natId)) { score += 80; why.push('شناسه ملی یکسان'); }
        if (a.melli && b.melli && norm(a.melli) === norm(b.melli)) { score += 80; why.push('کد ملی یکسان'); }
        /* تلفن مشترک */
        var pa = phonesOf(a), pb = phonesOf(b);
        var shared = pa.filter(function (p) { return pb.indexOf(p) > -1; });
        if (shared.length) { score += 50; why.push(shared.length + ' شماره مشترک'); }
        if (score >= 50) pairs.push({ a: a, b: b, score: Math.min(100, score), why: why.join('، ') });
      }
    }
    pairs.sort(function (x, y) { return y.score - x.score; });
    return pairs;
  };

  /* ---------- رکوردهای بی‌مصرف: بدون راه تماس + بدون تراکنش ---------- */
  window.ptfCleanUseless = function (kind) {
    var K = KINDS[kind];
    var list = getData(K.key);
    var out = [];
    list.forEach(function (r) {
      var phones = (typeof dedupPhones === 'function') ? dedupPhones(r) : [];
      var hasContact = phones.length > 0 || !!(r.coWeb || r.email || (r.people || []).length);
      if (hasContact) return;
      /* تراکنش؟ — هر ارجاع = مصرف دارد، حذف پیشنهاد نمی‌شود */
      var used = false;
      try {
        if (kind === 'cust') {
          used = getData('ptf_crm_rfqs').some(function (x) { return x.custCd === r.cd || norm(x.co) === norm(r.co); }) ||
                 getData('ptf_crm_offers').some(function (x) { return x.buyerCd === r.cd; }) ||
                 getData('ptf_crm_deals').some(function (x) { return norm(x.buyerCo) === norm(r.co); });
        } else if (kind === 'sup') {
          used = getData('ptf_crm_buycmp').some(function (c) {
            return (c.quotes || []).some(function (q) { return norm(q.sup) === norm(r.co); }) ||
                   (c.purchases || []).some(function (p) { return norm(p.sup) === norm(r.co); });
          }) ||
          getData('ptf_crm_rfqsmart').some(function (q) { return (q.targets || []).some(function (t) { return t.cd === r.cd || norm(t.co) === norm(r.co); }); }) ||
          getData('ptf_crm_payables').some(function (p) { return norm(p.sup) === norm(r.co); });
        } else if (kind === 'lead') {
          used = (r.hist || []).length > 0 || r.st === 'won' || r.st === 'converted';
        }
      } catch (eU) {}
      if (!used) out.push(r);
    });
    return out;
  };

  /* ---------- پنل ویراستار ---------- */
  window.ptfCleanOpen = function (kind) {
    if (!canClean()) { alert('⛔ ویراستار فهرست فقط برای مدیران ارشد (US-417)'); return; }
    var K = KINDS[kind];
    var pairs = ptfCleanScan(kind);
    var useless = ptfCleanUseless(kind);
    var pairRows = pairs.map(function (p, i) {
      var cl = p.score >= 80 ? '#dc2626' : p.score >= 60 ? '#d97706' : '#0ea5e9';
      return '<div style="border:1px solid var(--brd);border-right:4px solid ' + cl + ';border-radius:11px;padding:9px 12px;margin-bottom:7px">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<span style="font-size:12.5px"><b>' + escP(p.a.co || p.a.nm || '-') + '</b> <small dir="ltr">(' + escP(p.a.cd) + ')</small> ↔ <b>' + escP(p.b.co || p.b.nm || '-') + '</b> <small dir="ltr">(' + escP(p.b.cd) + ')</small>' +
        '<br><small style="color:' + cl + ';font-weight:800">شباهت ' + p.score + '٪</small> <small style="color:#64748b">— ' + escP(p.why) + '</small></span>' +
        '<span style="white-space:nowrap">' +
        '<button class="bt" style="padding:4px 11px;font-size:12px;background:#7c3aed" onclick="ptfCleanMerge(\'' + kind + '\',\'' + escP(p.a.cd) + '\',\'' + escP(p.b.cd) + '\')">🔀 تلفیق (با تایید)</button> ' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px" onclick="ptfCleanNotDup(\'' + kind + '\',\'' + escP(p.a.cd) + '\',\'' + escP(p.b.cd) + '\',this)" title="این دو، تکراری نیستند — دیگر پیشنهاد نشود">✋ تکراری نیست</button></span></div></div>';
    }).join('');
    var uRows = useless.map(function (r) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 10px;border:1px dashed var(--brd);border-radius:10px;margin-bottom:6px;font-size:12.5px;flex-wrap:wrap">' +
        '<span><b>' + escP(r.co || r.nm || '-') + '</b> <small dir="ltr">(' + escP(r.cd) + ')</small> <small style="color:#94a3b8">— بدون راه تماس و بدون تراکنش</small></span>' +
        '<span style="white-space:nowrap">' +
        '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#059669" onclick="ptfCleanEdit(\'' + kind + '\',\'' + escP(r.cd) + '\')">✏️ تکمیل</button> ' +
        '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#dc2626" onclick="ptfCleanDrop(\'' + kind + '\',\'' + escP(r.cd) + '\')">🗑 حذف با دلیل</button></span></div>';
    }).join('');
    var html = '<div class="md-b" id="cleanMd" style="display:grid;z-index:2450" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:860px;max-height:94vh;overflow:auto">' +
      '<h3>🧹 ویراستار فهرست ' + K.lb + ' (US-417 فاز ۱)</h3>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px">اسکن با موتور ضدتکرار موجود (نام نرمال/شناسه/تلفن مشترک). هیچ ادغام یا حذفی بدون تایید شما انجام نمی‌شود؛ قبل از هر تلفیق snapshot ذخیره و همه لینک‌ها (درخواست/پیشنهاد/پرونده/بستانکاری/...) به رکورد نهایی منتقل می‌شوند.</div>' +
      '<h4 style="margin:6px 0">🔀 زوج‌های مشکوک به تکرار (' + pairs.length + ')</h4>' +
      (pairRows || '<div style="color:#059669;font-size:12.5px;background:#f0fdf4;border-radius:10px;padding:8px 12px">تکراری مشکوکی یافت نشد ✅</div>') +
      '<h4 style="margin:14px 0 6px">🕳 رکوردهای بی‌مصرف — تعیین تکلیف (' + useless.length + ')</h4>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">بدون هیچ راه تماس و بدون هیچ تراکنش/سابقه — اول «تکمیل» را امتحان کنید؛ حذف فقط با دلیل ثبت می‌شود.</div>' +
      (uRows || '<div style="color:#059669;font-size:12.5px;background:#f0fdf4;border-radius:10px;padding:8px 12px">رکورد بی‌مصرفی نیست ✅</div>') +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    try { audit('ویراستار فهرست', 'اسکن ' + K.lb + ': ' + pairs.length + ' زوج مشکوک، ' + useless.length + ' بی‌مصرف (US-417)', ''); } catch (eA) {}
  };

  /* «تکراری نیست» — علامت‌گذاری زوج تا دیگر پیشنهاد نشود (per زوج، در settings) */
  window.ptfCleanNotDup = function (kind, cdA, cdB, btn) {
    try {
      var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      st.cleanNotDup = st.cleanNotDup || [];
      var key = [cdA, cdB].sort().join('|');
      if (st.cleanNotDup.indexOf(key) < 0) st.cleanNotDup.push(key);
      setData('ptf_crm_settings', st);
      audit('ویراستار فهرست', 'علامت «تکراری نیست»: ' + cdA + ' ↔ ' + cdB, '');
      if (btn) { var card = btn.closest('div[style*="border-right"]'); if (card) card.remove(); }
      if (typeof ptfToast === 'function') ptfToast('✋ ثبت شد — این زوج دیگر پیشنهاد نمی‌شود', 'ok');
    } catch (e) {}
  };

  /* ---------- تلفیق per نوع ---------- */
  window.ptfCleanMerge = function (kind, cdA, cdB) {
    var md = document.getElementById('cleanMd');
    if (kind === 'cust') {
      /* مشتری: عین ویزارد موجود US-363 (فیلدبه‌فیلد + بازنویسی همه لینک‌ها) */
      if (typeof ptfMergeWizard !== 'function') { alert('ماژول ادغام مشتری بارگذاری نشده'); return; }
      if (md) md.remove();
      ptfMergeWizard(cdA, cdB); /* پیش‌فرض: اولی مقصد — داخل ویزارد قابل بررسی است */
      return;
    }
    /* تامین‌کننده/سرنخ: ادغام سبک همان الگو — confirm + snapshot + جمع فیلدها + بازنویسی ارجاعات + حذف نرم */
    var K = KINDS[kind];
    var list = getData(K.key);
    var keep = list.filter(function (x) { return x.cd === cdA; })[0];
    var drop = list.filter(function (x) { return x.cd === cdB; })[0];
    if (!keep || !drop) return;
    if (!confirm('🔀 تلفیق ' + K.lb + ' (غیرقابل بازگشت — snapshot ذخیره می‌شود)\n\n«' + (drop.co || drop.nm) + '» (' + drop.cd + ') در «' + (keep.co || keep.nm) + '» (' + keep.cd + ') ادغام و حذف نرم می‌شود؛ همه ارجاعات به مقصد منتقل می‌شوند.\n\nادامه؟')) return;
    /* snapshot */
    try {
      var arch = getData('ptf_crm_deleted_archive');
      arch.unshift({ t: faDateTime(), by: curSession().name, user: curSession().user, kind: kind + '-merge-snapshot', reason: 'تلفیق ویراستار (US-417): ' + drop.cd + ' ← ' + keep.cd, snapshot: { keep: JSON.parse(JSON.stringify(keep)), drop: JSON.parse(JSON.stringify(drop)) } });
      if (arch.length > 500) arch = arch.slice(0, 500);
      setData('ptf_crm_deleted_archive', arch);
    } catch (eS) {}
    /* جمع فیلدها: خالی‌های مقصد از ادغام‌شونده پر می‌شوند؛ آرایه‌ها غیرتکراری جمع */
    ['co', 'coEn', 'nm', 'ph', 'ca', 'natId', 'melli', 'coWeb', 'coAddr', 'email', 'origin', 'ind', 'src'].forEach(function (f) {
      if (!String(keep[f] || '').trim() && String(drop[f] || '').trim()) keep[f] = drop[f];
    });
    keep.people = keep.people || [];
    (drop.people || []).forEach(function (p) { if ((p.nm || '').trim() && !keep.people.some(function (kp) { return norm(kp.nm) === norm(p.nm); })) keep.people.push(p); });
    ['coTels', 'phones'].forEach(function (f) {
      keep[f] = keep[f] || [];
      (drop[f] || []).forEach(function (t) { if (!keep[f].some(function (kt) { return kt.n === t.n; })) keep[f].push(t); });
    });
    if (kind === 'sup') {
      /* تخصص‌های US-399 غیرتکراری جمع */
      ['spBrands', 'spEquip'].forEach(function (f) {
        keep[f] = keep[f] || [];
        (drop[f] || []).forEach(function (v) { if (!keep[f].some(function (x) { return norm(x) === norm(v); })) keep[f].push(v); });
      });
      if (drop.brands && !keep.brands) keep.brands = drop.brands;
    }
    /* بازنویسی ارجاعات */
    var moved = 0;
    if (kind === 'sup') {
      var bc = getData('ptf_crm_buycmp');
      bc.forEach(function (c) {
        (c.quotes || []).forEach(function (q) { if (norm(q.sup) === norm(drop.co)) { q.sup = keep.co; moved++; } });
        (c.purchases || []).forEach(function (p) { if (norm(p.sup) === norm(drop.co)) { p.sup = keep.co; moved++; } });
      });
      setData('ptf_crm_buycmp', bc);
      var pay = getData('ptf_crm_payables');
      pay.forEach(function (p) { if (norm(p.sup) === norm(drop.co)) { p.sup = keep.co; moved++; } });
      setData('ptf_crm_payables', pay);
      var rq = getData('ptf_crm_rfqsmart');
      rq.forEach(function (r) {
        (r.targets || []).forEach(function (t) { if (t.cd === drop.cd || norm(t.co) === norm(drop.co)) { t.cd = keep.cd; t.co = keep.co; moved++; } });
      });
      setData('ptf_crm_rfqsmart', rq);
      var bq = getData('ptf_crm_buyquotes');
      bq.forEach(function (b) { if (norm(b.sup) === norm(drop.co)) { b.sup = keep.co; moved++; } });
      setData('ptf_crm_buyquotes', bq);
    } else if (kind === 'lead') {
      keep.hist = (keep.hist || []).concat(drop.hist || []);
    }
    keep.mergedFrom = keep.mergedFrom || [];
    keep.mergedFrom.push({ cd: drop.cd, co: drop.co || drop.nm, t: faDateTime(), by: curSession().name });
    /* حذف نرم ادغام‌شونده */
    try {
      var arch2 = getData('ptf_crm_deleted_archive');
      arch2.unshift({ t: faDateTime(), by: curSession().name, user: curSession().user, kind: kind, cd: drop.cd, name: drop.co || drop.nm, reason: '🔀 تلفیق ویراستار در ' + (keep.co || keep.nm) + ' (' + keep.cd + ') — US-417', rec: drop });
      if (arch2.length > 500) arch2 = arch2.slice(0, 500);
      setData('ptf_crm_deleted_archive', arch2);
    } catch (eA2) {}
    setData(K.key, list.filter(function (x) { return x.cd !== drop.cd; }));
    try { audit(K.lb, '🔀 تلفیق «' + (drop.co || drop.nm) + '» در «' + (keep.co || keep.nm) + '» — ' + moved + ' ارجاع منتقل شد (US-417)', keep.cd); } catch (eAu) {}
    if (typeof smsBookSyncAll === 'function') { try { smsBookSyncAll(); } catch (eSm) {} }
    if (md) md.remove();
    if (kind === 'sup' && typeof renderSuppliers === 'function') { try { renderSuppliers(); } catch (eR) {} }
    if (kind === 'lead' && typeof renderLeads === 'function') { try { renderLeads(); } catch (eR2) {} }
    alert('✅ تلفیق کامل شد — ' + moved + ' ارجاع به «' + (keep.co || keep.nm) + '» منتقل شد.\nsnapshot در آرشیو حذف‌شده‌ها موجود است.');
    ptfCleanOpen(kind);
  };

  /* ---------- تعیین تکلیف بی‌مصرف‌ها ---------- */
  window.ptfCleanEdit = function (kind, cd) {
    var md = document.getElementById('cleanMd');
    if (md) md.remove();
    if (kind === 'cust' && typeof showCustModal === 'function') showCustModal(cd);
    else if (kind === 'sup' && typeof showSupModal2 === 'function') showSupModal2(cd);
    else if (kind === 'lead' && typeof leadEdit === 'function') leadEdit(cd);
    else alert('فرم ویرایش در دسترس نیست');
  };
  window.ptfCleanDrop = function (kind, cd) {
    var K = KINDS[kind];
    var rec = getData(K.key).filter(function (x) { return x.cd === cd; })[0];
    if (!rec) return;
    var lb = K.lb + ' «' + (rec.co || rec.nm || cd) + '»';
    if (typeof ptfReasonedDelete === 'function') {
      ptfReasonedDelete(kind === 'cust' ? 'customer' : kind === 'sup' ? 'supplier' : 'lead', cd, lb, function () {
        setData(K.key, getData(K.key).filter(function (x) { return x.cd !== cd; }));
        try { audit('ویراستار فهرست', 'حذف رکورد بی‌مصرف: ' + lb + ' (US-417)', cd); } catch (eA) {}
        var md = document.getElementById('cleanMd');
        if (md) md.remove();
        ptfCleanOpen(kind);
      });
    } else if (confirm('حذف ' + lb + '؟')) {
      setData(K.key, getData(K.key).filter(function (x) { return x.cd !== cd; }));
      ptfCleanOpen(kind);
    }
  };

  /* فیلتر زوج‌های علامت‌خورده «تکراری نیست» در اسکن */
  var _scan = window.ptfCleanScan;
  window.ptfCleanScan = function (kind) {
    var pairs = _scan(kind);
    try {
      var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      var skip = st.cleanNotDup || [];
      return pairs.filter(function (p) { return skip.indexOf([p.a.cd, p.b.cd].sort().join('|')) < 0; });
    } catch (e) { return pairs; }
  };

  /* ---------- دکمه «🧹 ویراستار» روی سه فهرست (hook انتهای زنجیره) ---------- */
  function injectBtn(kind, srchId) {
    if (!canClean()) return;
    var srch = document.getElementById(srchId);
    if (!srch || document.getElementById('cleanBtn-' + kind)) return;
    var bar = srch.closest('.sb2');
    if (!bar) return;
    bar.insertAdjacentHTML('beforeend', '<button id="cleanBtn-' + kind + '" class="bt bt-o" style="color:#7c3aed;border-color:#ddd6fe" onclick="ptfCleanOpen(\'' + kind + '\')" title="اسکن تکراری‌ها و رکوردهای بی‌مصرف (US-417)">🧹 ویراستار</button>');
  }
  function hookRenders() {
    if (window._cleanHooked) return true;
    if (typeof window.renderSuppliers !== 'function' || typeof window.renderCustomers !== 'function') return false;
    window._cleanHooked = true;
    var _rs = window.renderSuppliers;
    window.renderSuppliers = function () { _rs(); try { injectBtn('sup', 'sSrch'); } catch (e) {} };
    var _rc = window.renderCustomers;
    window.renderCustomers = function () { _rc(); try { injectBtn('cust', 'cSrch'); } catch (e) {} };
    if (typeof window.renderLeads === 'function') {
      var _rl = window.renderLeads;
      window.renderLeads = function () { _rl(); try { injectBtn('lead', 'ldSrch'); } catch (e) {} };
    }
    return true;
  }
  var tries = 0;
  var t = setInterval(function () { tries++; if (hookRenders() || tries > 50) clearInterval(t); }, 350);
})();

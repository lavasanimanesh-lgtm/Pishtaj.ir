/* =====================================================================
   PTF CRM — workflow.js — Sprint 89 — US-204 + US-205
   ماشین وضعیت خودکار درخواست (طراحی متخصص ارشد سیستم):

   ┌─ فلوچارت گردش کار درخواست ─────────────────────────────────────────┐
   │ WF10 دریافت اولیه                                                  │
   │   └▶ (صدور TO)            WF20 در حال صدور پیشنهاد فنی → صادر شد   │
   │        └▶ (ارسال TO)      WF30 منتظر پاسخ کارفرما (فنی)            │
   │             ├▶ تایید فنی        WF40 منتظر صدور پیشنهاد مالی        │
   │             ├▶ درخواست اصلاح    WF35 در حال صدور پیشنهاد اصلاحی     │
   │             │     └▶ (ارسال TO اصلاحی) → WF30                      │
   │             └▶ عدم تایید        WF90 بایگانی (عدم تایید فنی)        │
   │   (صدور CO از TO تاییدشده)      WF50 پیشنهاد مالی صادر شد          │
   │        └▶ (ارسال CO)            WF60 منتظر پاسخ کارفرما (مالی)      │
   │             ├▶ برنده (won)      WF70 در حال تامین                  │
   │             ├▶ درخواست اصلاح    WF55 در حال اصلاح پیشنهاد مالی      │
   │             │     └▶ (ارسال CO اصلاحی) → WF60                      │
   │             └▶ بازنده (lost)    WF91 بایگانی (بازنده مالی)          │
   │   WF70 → (تحویل کامل پرونده/PL) WF80 تحویل شده → (تسویه) WF85 مختومه│
   └────────────────────────────────────────────────────────────────────┘
   اصول:
   - وضعیت درخواست «تابع رویدادها» است: صدور/ارسال/پاسخ کارفرما/تحویل.
   - انتخاب دستی وضعیت حذف شد؛ فقط «پاسخ کارفرما» را کاربر ثبت می‌کند
     (تایید/اصلاح/عدم تایید) چون رویدادی بیرونی است.
   - TO برنده/بازنده ندارد → tst: draft|sent|approved|revise|rejected.
   - CO: draft|sent|revise + won/lost قبلی (سازگار با قفل برنده/پرونده).
   - رویدادهای قدیمی خراب نمی‌شوند: mapping از st های قدیمی انجام می‌شود.
   US-205: انگلیسی‌سازی خودکار نام مشتری/رابط روی اسناد (Mr./Ms. + ترجما)
   ===================================================================== */
(function () {
  'use strict';

  /* ============ تعریف وضعیت‌ها ============ */
  var WF = {
    WF10: { lb: '📥 دریافت اولیه', cl: '#fee2e2;color:#dc2626' },
    WF20: { lb: '🔧 پیشنهاد فنی صادر شد', cl: '#ede9fe;color:#6d28d9' },
    WF30: { lb: '⏳ منتظر پاسخ کارفرما (فنی)', cl: '#fef3c7;color:#d97706' },
    WF35: { lb: '✏️ در حال صدور پیشنهاد اصلاحی (فنی)', cl: '#fce7f3;color:#be185d' },
    WF40: { lb: '💰 منتظر صدور پیشنهاد مالی', cl: '#e0e7ff;color:#4338ca' },
    WF50: { lb: '💵 پیشنهاد مالی صادر شد', cl: '#cffafe;color:#0e7490' },
    WF55: { lb: '✏️ در حال اصلاح پیشنهاد مالی', cl: '#fce7f3;color:#be185d' },
    WF60: { lb: '⏳ منتظر پاسخ کارفرما (مالی)', cl: '#fef3c7;color:#d97706' },
    WF70: { lb: '🏗 در حال تامین', cl: '#d1fae5;color:#059669' },
    WF80: { lb: '📦 تحویل شده', cl: '#dbeafe;color:#2563eb' },
    WF85: { lb: '✅ مختومه (تسویه)', cl: '#d1fae5;color:#065f46' },
    WF90: { lb: '🗂 بایگانی — عدم تایید فنی', cl: '#f1f5f9;color:#64748b' },
    WF91: { lb: '🗂 بایگانی — بازنده مالی', cl: '#f1f5f9;color:#64748b' }
  };
  window.PTF_WF = WF;

  function rfqOf(inqNoOrCd) {
    return getData('ptf_crm_rfqs').filter(function (r) {
      return r.cd === inqNoOrCd || (r.inqNo && r.inqNo === inqNoOrCd);
    })[0];
  }
  function offersOf(r) {
    if (!r) return [];
    return getData('ptf_crm_offers').filter(function (o) {
      /* v34.7.39: پیش‌نویس command که هنوز ACK سرور ندارد «صادرشده» نیست. */
      var confirmed = o && o._serverState !== 'pending' && o._serverState !== 'sending' && o._serverState !== 'rejected';
      return confirmed && o.inqNo && (o.inqNo === r.inqNo || o.inqNo === r.cd);
    });
  }

  /* ============ موتور: محاسبه وضعیت از رویدادها ============ */
  window.wfCompute = function (r) {
    var os = offersOf(r);
    var tos = os.filter(function (o) { return o.kind === 'TO'; });
    var cos = os.filter(function (o) { return o.kind === 'CO' || o.kind === 'TC'; }); // v122 US-261: TC هم‌رده مالی
    var lastTo = tos[0], lastCo = cos[0]; // unshift → جدیدترین اول
    // مالی مقدم بر فنی
    if (lastCo) {
      if (lastCo.st === 'won') {
        // تحویل؟
        var prj = getData('ptf_crm_projects').filter(function (p) { return p.offerNo === lastCo.no; })[0];
        if (prj && (prj.state === 'done' || prj.state === 'closed' || prj.state === 'archived')) {
          var inv = getData('ptf_crm_invoices').filter(function (v) { return v.offerNo === lastCo.no; })[0];
          var paid = inv && (window.PTF && PTF.invPaidSum ? PTF.invPaidSum(inv) : ((inv.pays || []).concat(inv.payments || [])).reduce(function(s, p) { return s + (+p.amt || 0); }, 0)) >= (+inv.amount || 1);
          return paid ? 'WF85' : 'WF80';
        }
        return 'WF70';
      }
      if (lastCo.st === 'lost') return 'WF91';
      if (lastCo.st === 'revise') return 'WF55';
      if (lastCo.st === 'sent') return 'WF60';
      return 'WF50'; // draft
    }
    if (lastTo) {
      if (lastTo.tst === 'rejected' || lastTo.st === 'rejected') return 'WF90'; /* v14.3 US-367 */
      if (lastTo.tst === 'approved' || lastTo.st === 'approved') return 'WF40';
      if (lastTo.tst === 'revise' || lastTo.st === 'revise') return 'WF35';
      if (lastTo.tst === 'sent' || lastTo.st === 'sent') return 'WF30';
      return 'WF20'; // draft
    }
    return 'WF10';
  };

  /* بازمحاسبه و ذخیره وضعیت درخواست + تایم‌لاین */
  window.wfRefresh = function (inqNoOrCd, evtText) {
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function (x) { return x.cd === inqNoOrCd || (x.inqNo && x.inqNo === inqNoOrCd); })[0];
    if (!r) return;
    var wf = wfCompute(r);
    if (r.wf !== wf) {
      r.wf = wf;
      r.stxt = WF[wf].lb; // سازگاری با نمایش‌های قدیمی
      r.wfLog = r.wfLog || [];
      r.wfLog.push({ t: faDateTime(), by: curSession().name, wf: wf, ev: evtText || '' });
      if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs);
      audit('گردش کار', 'وضعیت ' + r.cd + ' → ' + WF[wf].lb + (evtText ? ' (' + evtText + ')' : ''), r.cd);
      if (typeof renderRfq === 'function') renderRfq();
    }
  };

  /* ============ رویدادها: hook روی عملیات‌ها ============ */
  // ۱) ذخیره TO/CO (صدور) → WF20/WF50
  var _save = window.offerSave;
  if (typeof _save === 'function') {
    window.offerSave = function () {
      var result = _save.apply(this, arguments);
      /* در مسیر v35، خود register_offer وضعیت RFQ و wfLog را در همان commit
         سروری می‌نویسد. فقط fallback قدیمیِ بدون command اجازه refresh محلی دارد. */
      if (!window.PTF_OFFER_COMMAND_SAVE_ACTIVE && result && result.ok) {
        try { if (_offState && _offState.inqNo) wfRefresh(_offState.inqNo, (_offState.kind === 'TO' ? 'صدور پیشنهاد فنی ' : 'صدور پیشنهاد مالی ') + _offState.no); } catch (e) {}
      }
      return result;
    };
  }
  // ۲) تغییر وضعیت پیشنهاد (ارسال/برنده/بازنده) → wfRefresh
  var _setSt = window.offerSetSt;
  if (typeof _setSt === 'function') {
    window.offerSetSt = function (no, st, selEl) {
      _setSt(no, st, selEl);
      try {
        var o = getData('ptf_crm_offers').filter(function (x) { return x.no === no; })[0];
        if (o && o.inqNo) wfRefresh(o.inqNo, 'تغییر وضعیت ' + no + ' → ' + st);
      } catch (e) {}
    };
  }

  /* ============ پاسخ کارفرما برای TO (رویداد بیرونی — تنها ورودی دستی) ============ */
  window.wfToResponse = function (no) {
    var offers = getData('ptf_crm_offers');
    var o = offers.filter(function (x) { return x.no === no; })[0];
    if (!o || o.kind !== 'TO') return;
    if (o.tst !== 'sent' && o.st !== 'sent') { alert('ابتدا پیشنهاد فنی باید «ارسال‌شده» باشد'); return; }
    ptfDialog({
      title: '📨 ثبت پاسخ کارفرما — ' + no,
      body: 'پیشنهاد فنی برنده/بازنده ندارد؛ فقط یکی از سه پاسخ:',
      fields: [{ id: 'resp', label: 'پاسخ کارفرما', type: 'select', options: [
        { v: 'approved', lb: '✅ تایید فنی → آماده صدور پیشنهاد مالی' },
        { v: 'revise', lb: '✏️ درخواست اصلاح → ویرایش TO باز می‌شود' },
        { v: 'rejected', lb: '⛔ عدم تایید → بایگانی' }
      ] }, { id: 'note', label: 'یادداشت (اختیاری)' }],
      okText: 'ثبت پاسخ',
      onOk: function (v) {
        var offers2 = getData('ptf_crm_offers');
        var o2 = offers2.filter(function (x) { return x.no === no; })[0];
        o2.tst = v.resp;
        o2.tstNote = v.note || '';
        o2.tstAt = faDateTime();
        o2.tstBy = curSession().name;
        /* v14.3 (US-367): سینک st شش‌وضعیتی TO با پاسخ کارفرما */
        if (v.resp === 'approved') o2.st = 'approved';
        else if (v.resp === 'rejected') o2.st = 'rejected';
        else if (v.resp === 'revise') o2.st = 'revise';
        setData('ptf_crm_offers', offers2);
        audit('پیشنهادها', 'پاسخ کارفرما برای ' + no + ': ' + v.resp + (v.note ? ' — ' + v.note : ''), no);
        wfRefresh(o2.inqNo, 'پاسخ کارفرما (فنی): ' + v.resp);
        if (typeof renderOffers === 'function') renderOffers();
        if (v.resp === 'revise') ptfToast('✏️ TO برای اصلاح باز شد — پس از ویرایش دوباره «ارسال‌شده» کنید', 'warn');
        if (v.resp === 'approved') ptfToast('✅ تایید فنی ثبت شد — حالا از TO پیشنهاد مالی بسازید', 'ok');
      }
    });
  };
  // CO: درخواست اصلاح (بین ارسال و برنده/بازنده)
  window.wfCoRevise = function (no) {
    var offers = getData('ptf_crm_offers');
    var o = offers.filter(function (x) { return x.no === no; })[0];
    if (!o || o.kind !== 'CO' || o.st !== 'sent') { alert('فقط CO ارسال‌شده'); return; }
    if (!confirm('کارفرما درخواست اصلاح پیشنهاد مالی ' + no + ' را داده؟\nCO برای ویرایش باز می‌شود.')) return;
    o.st = 'revise';
    setData('ptf_crm_offers', offers);
    audit('پیشنهادها', 'درخواست اصلاح مالی ' + no, no);
    wfRefresh(o.inqNo, 'درخواست اصلاح مالی');
    if (typeof renderOffers === 'function') renderOffers();
  };

  /* ============ UI: جایگزینی وضعیت دستی درخواست‌ها ============ */
  // editRfq (تغییر دستی) → نمایش تایم‌لاین گردش کار به جای انتخاب دستی
  var wt = 0;
  var wi = setInterval(function () {
    wt++;
    if (typeof window.editRfq === 'function' && !window._wfEditPatched) {
      window._wfEditPatched = true;
      window.editRfq = function (cd) {
        var r = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === cd; })[0];
        if (!r) return;
        var wf = wfCompute(r) || r.wf;
        var log = (r.wfLog || []).slice().reverse().map(function (e) {
          return '<div style="border-right:2px solid var(--brd);padding:3px 10px 3px 0;margin-bottom:4px;font-size:12px"><span style="color:#94a3b8">' + escP(e.t) + ' — ' + escP(e.by || '') + '</span> ' + escP((WF[e.wf] || {}).lb || e.wf) + (e.ev ? ' <small style="color:#64748b">(' + escP(e.ev) + ')</small>' : '') + '</div>';
        }).join('') || '<div style="color:#94a3b8;font-size:12px">رویدادی ثبت نشده</div>';
        var sts = [
          {id:'st1', lb:'🔴 دریافت اولیه'}, {id:'st2', lb:'🔵 بررسی فنی'},
          {id:'st3', lb:'🟡 تایید'}, {id:'st4', lb:'🟢 پیش‌فاکتور'},
          {id:'st5', lb:'🔵 ابلاغ سفارش'}, {id:'st6', lb:'🟠 آماده‌سازی'}, {id:'st7', lb:'✅ تحویل شده'}
        ];
        var stOpts = sts.map(function(s){ return '<option value="' + s.id + '"' + ((r.st||'st1')===s.id ? ' selected':'') + '>' + s.lb + '</option>'; }).join('');
        var html = '<div class="md-b" style="display:grid;z-index:1500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:600px;max-height:92vh;overflow:auto">' +
          '<h3>✏️ ویرایش و گردش کار درخواست — ' + escP(cd) + '</h3>' +
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;font-size:12px;color:#166534;margin-bottom:10px">قفل ویرایش برداشته شده است؛ شما می‌توانید مشخصات استعلام یا وضعیت آن را آزادانه ویرایش و ذخیره کنید.</div>' +
          '<div style="text-align:center;margin-bottom:12px"><span class="bd" style="background:' + (WF[wf] || {}).cl + ';font-size:13px;padding:7px 16px">' + escP((WF[wf] || {}).lb || '') + '</span></div>' +
          '<div class="fld"><label>نام شرکت / مشتری</label><input type="text" id="er_co" value="' + escP(r.co||'') + '"></div>' +
          '<div class="fr"><div class="fld"><label>مسئول / رابط</label><input type="text" id="er_con" value="' + escP(r.con||'') + '"></div>' +
          '<div class="fld"><label>حوزه کاری</label><input type="text" id="er_ca" value="' + escP(r.ca||'') + '"></div></div>' +
          '<div class="fld"><label>موضوع / شرح</label><input type="text" id="er_subj" value="' + escP(r.subj||'') + '"></div>' +
          '<div class="fld"><label>وضعیت دستی</label><select id="er_st">' + stOpts + '</select></div>' +
          '<h4 style="margin:10px 0 6px;font-size:13px">🕓 تاریخچه گردش کار</h4>' + log +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;border-top:1px solid var(--brd);padding-top:10px">' +
          '<button class="bt bt-o" style="color:#dc2626;border-color:#fecaca" onclick="delRfq(\'' + ptfOnClickArg(cd) + '\')">🗑 حذف درخواست</button>' +
          '<div style="display:flex;gap:8px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button>' +
          '<button class="bt" onclick="saveRfqEdit(\'' + ptfOnClickArg(cd) + '\')">💾 ذخیره تغییرات</button></div></div></div></div>';
        document.getElementById('panels').insertAdjacentHTML('beforeend', html);
      };

      window.saveRfqEdit = function (cd) {
        var rfqs = getData('ptf_crm_rfqs');
        for (var i = 0; i < rfqs.length; i++) {
          if (rfqs[i].cd === cd) {
            rfqs[i].co = document.getElementById('er_co').value.trim();
            rfqs[i].con = document.getElementById('er_con').value.trim();
            rfqs[i].ca = document.getElementById('er_ca').value.trim();
            rfqs[i].subj = document.getElementById('er_subj').value.trim();
            var sel = document.getElementById('er_st');
            if (sel) {
              rfqs[i].st = sel.value;
              rfqs[i].stxt = sel.options[sel.selectedIndex].text;
            }
            break;
          }
        }
        if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs);
        if (typeof audit === 'function') audit('استعلامات', 'ویرایش دستی درخواست ' + cd, cd);
        var md = document.querySelector('#panels .md-b:last-child');
        if (md) md.remove();
        if (typeof renderRfq === 'function') renderRfq();
        if (typeof ptfToast === 'function') ptfToast('تغییرات درخواست ذخیره شد ✅', 'ok');
      };

      window.delRfq = function (cd) {
        var r = getData('ptf_crm_rfqs').filter(function(x){return x.cd===cd;})[0];
        var lb = 'استعلام ' + cd + (r ? ' (' + r.co + ')' : '');
        if (typeof window.ptfReasonedDelete === 'function') {
          window.ptfReasonedDelete('RFQ', cd, lb, function() {
            var rfqs = getData('ptf_crm_rfqs').filter(function (x) { return x.cd !== cd; });
            if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs);
            var md = document.querySelector('#panels .md-b:last-child');
            if (md) md.remove();
            if (typeof renderRfq === 'function') renderRfq();
          });
        } else {
          if (!confirm('🗑 آیا از حذف درخواست «' + cd + '» اطمینان دارید؟')) return;
          var rfqs = getData('ptf_crm_rfqs').filter(function (x) { return x.cd !== cd; });
          if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_rfqs', rfqs, { reason: 'w2' }); else setData('ptf_crm_rfqs', rfqs);
          if (typeof renderRfq === 'function') renderRfq();
        }
      };
    }
    if (window._wfEditPatched || wt > 40) clearInterval(wi);
  }, 400);

  // بج وضعیت WF در فهرست درخواست‌ها (جایگزین بج قدیمی) + دکمه پاسخ کارفرما در پیشنهادها
  // Sprint 104 Refactoring: جایگزینی تایمرهای مخرب DOM با Event Hooks اصولی
  window.wfInjectUI = function () {
    try {
      var tb = document.getElementById('rTb');
      if (tb) {
        var rfqs = getData('ptf_crm_rfqs');
        tb.querySelectorAll('tr').forEach(function (tr) {
          if (tr.getAttribute('data-wf')) return;
          var strong = tr.querySelector('td strong');
          if (!strong) return;
          var r = rfqs.filter(function (x) { return x.cd === strong.textContent.trim(); })[0];
          if (!r) return;
          /* نمایش نیز باید از projectionهای موجود self-heal شود؛ wf ذخیره‌شدهٔ
             قدیمی حق ندارد نبودن پیشنهاد authoritative را پنهان کند. */
          var wf = wfCompute(r) || r.wf;
          var bd = tr.querySelector('.bd');
          if (bd) { bd.textContent = (WF[wf] || {}).lb || ''; bd.setAttribute('style', 'background:' + (WF[wf] || {}).cl); }
          tr.setAttribute('data-wf', '1');
        });
      }
      var oTb = document.querySelector('#panels .tb2 tbody');
      if (oTb && document.querySelector('#panels .ph h3') && document.querySelector('#panels .ph h3').textContent.indexOf('پیشنهاد') > -1) {
        var offers = getData('ptf_crm_offers');
        oTb.querySelectorAll('tr').forEach(function (tr) {
          if (tr.querySelector('.wf-resp')) return;
          var b = tr.querySelector('td b, td strong');
          if (!b) return;
          var no = b.textContent.trim().split(' ')[0];
          var o = offers.filter(function (x) { return x.no === no; })[0];
          if (!o) return;
          var tds = tr.querySelectorAll('td');
          if (o.kind === 'TO' && (o.st === 'sent' || o.tst === 'sent') && !o.tst) {
            tds[tds.length - 1].insertAdjacentHTML('beforeend', ' <button class="ba wf-resp" style="color:#d97706" onclick="wfToResponse(\'' + ptfOnClickArg(no) + '\')">📨 پاسخ کارفرما</button>');
          } else if (o.kind === 'TO' && o.tst && o.tst !== 'sent') {
            var TL = { approved: '✅ تایید فنی', revise: '✏️ اصلاح‌خواسته', rejected: '⛔ عدم تایید' };
            tds[tds.length - 1].insertAdjacentHTML('beforeend', ' <span class="wf-resp" style="font-size:10.5px;color:#64748b">' + (TL[o.tst] || '') + '</span>');
          } else if (o.kind === 'CO' && o.st === 'sent') {
            tds[tds.length - 1].insertAdjacentHTML('beforeend', ' <button class="ba wf-resp" style="color:#be185d" onclick="wfCoRevise(\'' + ptfOnClickArg(no) + '\')">✏️ درخواست اصلاح</button>');
          } else {
            tr.querySelectorAll('td')[tds.length - 1].insertAdjacentHTML('beforeend', '<span class="wf-resp" style="display:none"></span>');
          }
        });
      }
    } catch (e) {}
  };
  var _wfOldRfq = window.renderRfq;
  window.renderRfq = function() { if(_wfOldRfq) _wfOldRfq(); if(typeof wfInjectUI==='function') wfInjectUI(); };
  var _wfOldOff = window.renderOffers;
  window.renderOffers = function() { if(_wfOldOff) _wfOldOff(); if(typeof wfInjectUI==='function') wfInjectUI(); };

  /* ============ US-205: انگلیسی‌سازی خودکار نام‌ها روی اسناد ============ */
  // ترانویسی فارسی → لاتین (قاعده‌مند، بدون نیاز به AI؛ AI در دسترس باشد دقیق‌تر می‌کند)
  var FA2EN = { 'ا': 'a', 'آ': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': '', 'غ': 'gh', 'ف': 'f', 'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'ou', 'ه': 'h', 'ی': 'i', 'ئ': 'i', 'ء': '', 'ي': 'i', 'ك': 'k' };
  // نام‌های زنانه رایج برای تشخیص جنسیت (Ms.)
  var FEMALE = ['شیوا', 'مریم', 'زهرا', 'فاطمه', 'سارا', 'نازنین', 'الهام', 'لیلا', 'نرگس', 'مینا', 'رویا', 'پریسا', 'نسرین', 'شبنم', 'آزاده', 'مهسا', 'ندا', 'سمیرا', 'فرزانه', 'معصومه', 'اکرم', 'اعظم', 'زینب', 'سحر', 'هانیه', 'ریحانه', 'مائده', 'ملیکا', 'یاسمن', 'غزل', 'ترانه', 'شهره', 'شهلا', 'فریبا', 'کتایون', 'سیما', 'نیلوفر', 'بهاره', 'مونا', 'الناز', 'ساناز', 'گلناز', 'مهناز', 'شیرین', 'ژاله', 'افسانه', 'منیژه', 'سپیده', 'مرضیه', 'راضیه', 'سمانه', 'حدیثه', 'محدثه', 'عاطفه', 'نفیسه'];

  /* v14.4 (US-360 — بازخورد کارفرما «مراد → Mrad غلط، Morad درست»):
     ① فرهنگ املای استاندارد نام‌های رایج ایرانی (اولویت اول)
     ② بازسازی واکه کوتاه میان خوشه‌های صامت برای نام‌های خارج از فرهنگ */
  var NAME_DICT = {
    'مراد': 'Morad', 'محمد': 'Mohammad', 'محمدرضا': 'Mohammadreza', 'علی': 'Ali', 'حسین': 'Hossein', 'حسن': 'Hassan',
    'رضا': 'Reza', 'مهدی': 'Mahdi', 'احمد': 'Ahmad', 'محمود': 'Mahmoud', 'مصطفی': 'Mostafa', 'مجتبی': 'Mojtaba',
    'مرتضی': 'Morteza', 'عباس': 'Abbas', 'جواد': 'Javad', 'سعید': 'Saeed', 'حمید': 'Hamid', 'حامد': 'Hamed',
    'وحید': 'Vahid', 'مجید': 'Majid', 'امید': 'Omid', 'امیر': 'Amir', 'امیرحسین': 'Amirhossein', 'ابراهیم': 'Ebrahim',
    'اسماعیل': 'Esmaeil', 'یوسف': 'Yousef', 'ناصر': 'Nasser', 'اکبر': 'Akbar', 'اصغر': 'Asghar', 'قاسم': 'Ghasem',
    'کاظم': 'Kazem', 'کریم': 'Karim', 'رحیم': 'Rahim', 'جعفر': 'Jafar', 'صادق': 'Sadegh', 'داوود': 'Davoud',
    'داود': 'Davoud', 'سجاد': 'Sajjad', 'میلاد': 'Milad', 'بهرام': 'Bahram', 'بهروز': 'Behrouz', 'بهنام': 'Behnam',
    'بابک': 'Babak', 'سیاوش': 'Siavash', 'کوروش': 'Kourosh', 'داریوش': 'Dariush', 'فرهاد': 'Farhad', 'فرزاد': 'Farzad',
    'فرید': 'Farid', 'شهرام': 'Shahram', 'شاهین': 'Shahin', 'پیمان': 'Peyman', 'پژمان': 'Pejman', 'آرش': 'Arash',
    'آرمان': 'Arman', 'اشکان': 'Ashkan', 'کیوان': 'Keyvan', 'کامران': 'Kamran', 'ایمان': 'Iman', 'احسان': 'Ehsan',
    'پویا': 'Pouya', 'نیما': 'Nima', 'رامین': 'Ramin', 'مازیار': 'Maziar', 'مهرداد': 'Mehrdad', 'خسرو': 'Khosrow',
    'منوچهر': 'Manouchehr', 'هوشنگ': 'Houshang', 'ایرج': 'Iraj', 'پرویز': 'Parviz', 'فریدون': 'Fereydoun',
    'اردشیر': 'Ardeshir', 'عبداله': 'Abdollah', 'عبدالله': 'Abdollah', 'روح‌اله': 'Rouhollah', 'نعمت': 'Nemat',
    'مریم': 'Maryam', 'زهرا': 'Zahra', 'فاطمه': 'Fatemeh', 'سارا': 'Sara', 'شیوا': 'Shiva', 'نازنین': 'Nazanin',
    'الهام': 'Elham', 'لیلا': 'Leila', 'نرگس': 'Narges', 'مینا': 'Mina', 'رویا': 'Roya', 'پریسا': 'Parisa',
    'نسرین': 'Nasrin', 'شبنم': 'Shabnam', 'آزاده': 'Azadeh', 'مهسا': 'Mahsa', 'ندا': 'Neda', 'سمیرا': 'Samira',
    'شیرین': 'Shirin', 'سپیده': 'Sepideh', 'یاسمن': 'Yasaman', 'نیلوفر': 'Niloufar', 'مونا': 'Mona', 'الناز': 'Elnaz',
    'ساناز': 'Sanaz', 'مهناز': 'Mahnaz', 'فریبا': 'Fariba', 'سیما': 'Sima', 'بهاره': 'Bahareh', 'معصومه': 'Masoumeh',
    'زینب': 'Zeinab', 'سحر': 'Sahar', 'هانیه': 'Haniyeh', 'ریحانه': 'Reyhaneh', 'ملیکا': 'Melika', 'غزل': 'Ghazal',
    'پور': 'Pour', 'پورشاد': 'Pourshad', 'زاده': 'Zadeh', 'لواسانی': 'Lavasani', 'کریمی': 'Karimi', 'یوسفی': 'Yousefi',
    'محمدی': 'Mohammadi', 'حسینی': 'Hosseini', 'رضایی': 'Rezaei', 'احمدی': 'Ahmadi', 'موسوی': 'Mousavi',
    'هاشمی': 'Hashemi', 'کاظمی': 'Kazemi', 'رحیمی': 'Rahimi', 'ابراهیمی': 'Ebrahimi', 'صادقی': 'Sadeghi',
    'جعفری': 'Jafari', 'قاسمی': 'Ghasemi', 'انصاریان': 'Ansarian', 'انصاری': 'Ansari', 'یافتیان': 'Yaftian',
    'خوشحال': 'Khoshhal', 'مهندس': 'Eng.',
    /* واژه‌های سازمانی رایج (شرکت‌ها) */
    'مجتمع': 'Complex', 'صنایع': 'Industries', 'صنعتی': 'Industrial', 'فولاد': 'Steel', 'ذوب': 'Zob',
    'آهن': 'Ahan', 'پاسارگاد': 'Pasargad', 'پتروشیمی': 'Petrochemical', 'پالایش': 'Refining', 'پالایشگاه': 'Refinery',
    'نیروگاه': 'Power Plant', 'سیمان': 'Cement', 'توسعه': 'Development', 'تجهیز': 'Tajhiz', 'پیشرو': 'Pishro'
  };
  window.PTF_NAME_DICT = NAME_DICT;
  var VOWELS_EN = { a: 1, e: 1, i: 1, o: 1, u: 1 };
  /* درج واکه «a» میان صامت‌های پشت‌سرهم — تقریب واکه کوتاه نانوشته فارسی (Mrad→Marad نمی‌شود چون فرهنگ اولویت دارد؛ برای ناشناخته‌ها Mrad→Morad ممکن نیست ولی حداقل تلفظ‌پذیر Marad می‌شود) */
  function vowelize(out) {
    var digraph = { kh: 1, gh: 1, sh: 1, ch: 1, zh: 1 };
    var units = [];
    for (var i = 0; i < out.length; i++) {
      var two = out.slice(i, i + 2).toLowerCase();
      if (digraph[two]) { units.push(out.slice(i, i + 2)); i++; } else units.push(out[i]);
    }
    var res = '';
    for (var j = 0; j < units.length; j++) {
      res += units[j];
      var cur = units[j].toLowerCase(), nxt = (units[j + 1] || '').toLowerCase();
      var curC = cur && !VOWELS_EN[cur[cur.length - 1]];
      var nxtC = nxt && !VOWELS_EN[nxt[0]];
      if (curC && nxtC && j < units.length - 1) {
        /* سه صامت پیاپی یا خوشه آغازین → واکه میانی */
        var nxt2 = (units[j + 2] || '').toLowerCase();
        if (j === 0 || (nxt2 && !VOWELS_EN[nxt2[0]])) res += 'a';
      }
    }
    return res;
  }
  function fa2enWord(w) {
    /* ① فرهنگ نام‌ها — املای استاندارد */
    var clean = String(w || '').replace(/\u200c/g, '');
    if (NAME_DICT[w]) return NAME_DICT[w];
    if (NAME_DICT[clean]) return NAME_DICT[clean];
    var out = '';
    for (var i = 0; i < w.length; i++) out += (FA2EN[w[i]] !== undefined ? FA2EN[w[i]] : w[i]);
    // e پایانی برای «ه» غیرملفوظ
    out = out.replace(/h$/, 'eh').replace(/^$/, '');
    if (!out) return '';
    out = vowelize(out); /* v14.4 US-360: پرهیز از خروجی بی‌واکه مثل Mrad */
    return out[0].toUpperCase() + out.slice(1);
  }
  window.ptfFa2EnWord = fa2enWord; /* برای تست و مصرف بیرونی */
  window.ptfNameToEn = function (faName) {
    var s = String(faName || '').trim();
    if (!s) return '';
    if (!/[\u0600-\u06FF]/.test(s)) return s; // از قبل لاتین
    var title = '';
    // حذف القاب فارسی + تعیین جنسیت
    var mMr = /^(آقای|اقای|جناب آقای|جناب|مهندس|دکتر)\s+/;
    var mMs = /^(خانم|سرکار خانم|سرکار)\s+/;
    if (mMr.test(s)) { title = 'Mr. '; s = s.replace(mMr, ''); }
    else if (mMs.test(s)) { title = 'Ms. '; s = s.replace(mMs, ''); }
    var parts = s.split(/\s+/).filter(Boolean);
    if (!title && parts.length) {
      title = FEMALE.indexOf(parts[0]) > -1 ? 'Ms. ' : 'Mr. ';
    }
    var en = parts.map(fa2enWord).join(' ');
    return title + en;
  };
  // شرکت: بدون لقب، فقط ترانویسی + Co.
  window.ptfCoToEn = function (faCo) {
    var s = String(faCo || '').trim();
    if (!s || !/[\u0600-\u06FF]/.test(s)) return s;
    var suffix = /شرکت|گروه|هلدینگ/.test(s) ? ' Co.' : '';
    s = s.replace(/^(شرکت|گروه صنعتی|گروه|هلدینگ)\s+/, '');
    var parts = s.split(/\s+/).filter(Boolean);
    var en = parts.map(fa2enWord);
    /* v14.4 (US-360): ترتیب انگلیسی نام سازمان — اگر عبارت با «نوع سازمان» شروع شود
       (مجتمع/صنایع/پتروشیمی/فولاد/…)، ساختار مضافی فارسی معکوس می‌شود:
       «مجتمع صنایع فولاد پاسارگاد» → Pasargad Steel Industries Complex */
    var ORG_TYPES = ['مجتمع', 'صنایع', 'پتروشیمی', 'پالایشگاه', 'پالایش', 'نیروگاه', 'سیمان', 'فولاد', 'ذوب'];
    if (parts.length > 1 && ORG_TYPES.indexOf(parts[0].replace(/\u200c/g, '')) > -1) en.reverse();
    return en.join(' ') + suffix;
  };

  // hook روی چاپ پیشنهاد: نام خریدار/رابط فارسی → EN خودکار (بدون دخالت کاربر)
  var _printTpl = window.offerPrintTpl;
  if (typeof _printTpl === 'function') {
    window.offerPrintTpl = function (o, tpl, isPreview) {
      try {
        var o2 = JSON.parse(JSON.stringify(o));
        if (/[\u0600-\u06FF]/.test(o2.buyerCo || '')) o2.buyerCo = ptfCoToEn(o2.buyerCo);
        /* v14.4 (US-362 AC3): اولویت با نام EN ذخیره‌شده رابط (people[].nmEn) — فقط در نبود آن ترانویسی */
        if (/[\u0600-\u06FF]/.test(o2.buyerContact || '')) {
          var _cx = getData('ptf_crm_customers').filter(function (c) { return c.cd === o2.buyerCd; })[0];
          var _px = _cx && (_cx.people || []).filter(function (pp) { return pp.nm && o2.buyerContact.indexOf(pp.nm) > -1 && pp.nmEn; })[0];
          o2.buyerContact = _px ? _px.nmEn : ptfNameToEn(o2.buyerContact);
        }
        _printTpl(o2, tpl, isPreview);
        // اگر AI فعال است، ترجمه دقیق‌تر را در پس‌زمینه برای دفعات بعد ذخیره کن
        if (typeof ptfLlmStatus === 'function' && /[\u0600-\u06FF]/.test(o.buyerCo || '')) {
          ptfLlmStatus(function (ok) {
            if (!ok) return;
            ptfLlmTranslate(o.buyerCo, 'fa2en', function (d) {
              if (d.ok && d.data && d.data.t) {
                var custs = getData('ptf_crm_customers');
                var c = custs.filter(function (x) { return x.cd === o.buyerCd; })[0];
                if (c && !c.coEn) { c.coEn = d.data.t; /* v34.8.23 (W1-iterate) */ if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custs, { reason: 'coen-fill' }); else setData('ptf_crm_customers', custs); }
              }
            });
          });
        }
      } catch (e) { _printTpl(o, tpl, isPreview); }
    };
  }

  /* ============ دکمه + مدارک در تب‌های فرم ثبت درخواست ============ */
  // فرم RFQ از قبل ۵ تب آپلود دارد (attachUploadWidget) — فقط مطمئن شویم دکمه + واضح است
  var css = document.createElement('style');
  css.textContent = '[id^="rUp_"] > div{border-color:#7c3aed!important}' +
    '[id^="rUp_"] > div:before{content:"＋ ";font-weight:900;color:#7c3aed}';
  document.head.appendChild(css);
})();

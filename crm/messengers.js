/* =====================================================================
   PTF CRM — messengers.js — v13.5
   US-332: دکمه‌های پیام‌رسان با deep-link (واتساپ/تلگرام/بله/ایتا/روبیکا)
           هر کاربر با اکانت خودِ لاگین‌شده‌اش ارسال می‌کند + متن آماده {نام}
   US-333: کلاینت بات اعلان (تلگرام/بله) — ارسال اعلان‌های مهم به گروه شرکت
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- US-332: deep-link سازها ---------- */
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹', AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function enDigits(v) {
    return String(v == null ? '' : v)
      .replace(/[۰-۹]/g, function (d) { return FA_DIGITS.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR_DIGITS.indexOf(d); });
  }
  /* خروجی استاندارد بین‌المللی فقط با رقم؛ wa.me و t.me/+ همین قالب را می‌خواهند. */
  function digits(n) {
    var raw = enDigits(n).trim();
    if (!raw) return '';
    var hadPlus = raw.indexOf('+') > -1 || /^00/.test(raw);
    var d = raw.replace(/\D/g, '');
    if (/^0098\d{10}$/.test(d)) d = d.slice(2);
    else if (/^09\d{9}$/.test(d)) d = '98' + d.slice(1);
    else if (/^9\d{9}$/.test(d)) d = '98' + d;
    else if (!hadPlus && /^0\d+/.test(d)) return ''; /* تلفن ثابت داخلی، نه موبایل پیام‌رسان */
    return /^\d{8,15}$/.test(d) ? d : '';
  }
  function cleanHandle(v) {
    var s = String(v || '').trim().replace(/^@+/, '');
    s = s.replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me|ble\.ir|eitaa\.com|rubika\.ir)\//i, '');
    s = s.split(/[?#/]/)[0].replace(/[^A-Za-z0-9_.-]/g, '');
    return s.slice(0, 64);
  }
  function firstMobile(c) {
    c = c || {};
    var pp = (typeof primaryPerson === 'function' ? primaryPerson(c) : null);
    var candidates = [];
    function add(v, trusted) { if (v) candidates.push({ v: v, trusted: !!trusted }); }
    (c.phones || []).forEach(function (p) { if (p && (p.k === 'mob' || p.kind === 'mob' || p.type === 'mobile')) add(p.n, true); });
    if (pp) (pp.mobs || []).forEach(function (p) { add(p && p.n, true); });
    (c.people || []).forEach(function (p) { if (p !== pp) (p.mobs || []).forEach(function (m) { add(m && m.n, true); }); });
    add(c.mob, true); add(c.mobile, true); add(c.ph, false); add(c.phone, false);
    for (var i = 0; i < candidates.length; i++) {
      var d = digits(candidates[i].v);
      if (!d) continue;
      /* fallbackهای ph/phone فقط وقتی موبایل ایران‌اند؛ آرایهٔ mobs برای خارجی trusted است. */
      if (candidates[i].trusted || /^989\d{9}$/.test(d)) return d;
    }
    return '';
  }
  var APPS = [
    { id: 'wa', lb: 'واتساپ', short: 'واتساپ', ic: '🟢', link: function (c) { var n = digits(c.mob); return n ? 'https://wa.me/' + n + (c.txt ? '?text=' + encodeURIComponent(c.txt) : '') : null; } },
    { id: 'tg', lb: 'تلگرام', short: 'تلگرام', ic: '🔵', link: function (c) { var u = cleanHandle(c.tg), n = digits(c.mob); return u ? 'https://t.me/' + u : (n ? 'https://t.me/+' + n + (c.txt ? '?text=' + encodeURIComponent(c.txt) : '') : null); } },
    { id: 'bale', lb: 'بله', short: 'بله', ic: '🟩', link: function (c) { var u = cleanHandle(c.bale); return u ? 'https://ble.ir/' + u : null; } },
    { id: 'eitaa', lb: 'ایتا', short: 'ایتا', ic: '🟧', link: function (c) { var u = cleanHandle(c.eitaa); return u ? 'https://eitaa.com/' + u : null; } },
    { id: 'rubika', lb: 'روبیکا', short: 'روبیکا', ic: '🟣', link: function (c) { var u = cleanHandle(c.rubika); return u ? 'https://rubika.ir/' + u : null; } }
  ];
  window.ptfMsgNormalizeMobile = digits;
  window.ptfMsgContactMobile = firstMobile;

  /* دیالوگ ارسال پیام به مخاطب: انتخاب پیام‌رسان + متن آماده */
  window.ptfMsgSend = function (entityKey, cd) {
    var c = getData(entityKey).filter(function (x) { return x.cd === cd; })[0];
    if (!c) return;
    var pp = (typeof primaryPerson === 'function' ? primaryPerson(c) : null);
    var nm = (pp && pp.nm) || c.con || c.nm || c.co || '';
    var mob = firstMobile(c);
    var ids = c.msgIds || {}; /* شناسه‌های پیام‌رسان ذخیره‌شده روی رکورد */
    var aud = entityKey === 'ptf_crm_customers' ? 'مشتری' : entityKey === 'ptf_crm_suppliers' ? 'تامین‌کننده' : 'سایر';
    var tpls = (typeof ptfMsgTpls === 'function' ? ptfMsgTpls() : []).filter(function (t) { return t.aud === aud; });
    var tplOpts = '<option value="">— بدون متن آماده —</option>' + tpls.map(function (t, i) { return '<option value="' + i + '">' + escP(t.title) + '</option>'; }).join('');
    var oldDlg = document.getElementById('ptfMsgSendDlg'); if (oldDlg) oldDlg.remove();
    var html = '<div class="md-b" id="ptfMsgSendDlg" style="display:grid;z-index:2400" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:520px">' +
      '<h3>💬 ارسال پیام — ' + escP(nm || c.co) + '</h3>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:10px">پیام از اکانت خودِ شما در پیام‌رسان انتخابی ارسال می‌شود (چت مستقیم باز می‌شود)</div>' +
      '<div class="fld"><label>متن آماده (نام مخاطب خودکار جایگذاری می‌شود)</label><select id="msgTpl" onchange="ptfMsgTplPick(this.value,\'' + ptfOnClickArg(nm) + '\',\'' + aud + '\')">' + tplOpts + '</select></div>' +
      '<div class="fld"><label>متن پیام</label><textarea id="msgTxt" rows="4" style="font-size:13px"></textarea></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
      APPS.map(function (a) {
        var lnk = a.link({ mob: mob, txt: '', tg: ids.tg, bale: ids.bale, eitaa: ids.eitaa, rubika: ids.rubika });
        return '<button type="button" class="bt bt-o" style="font-size:12.5px"' + (lnk ? '' : ' disabled title="شناسه/شماره ثبت نشده"') +
          ' onclick="ptfMsgOpen(\'' + a.id + '\',\'' + ptfOnClickArg(entityKey) + '\',\'' + ptfOnClickArg(cd) + '\')">' + a.ic + ' ' + a.lb + '</button>';
      }).join('') +
      '</div>' +
      '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:#0e7490">⚙️ شناسه‌های پیام‌رسان این مخاطب (تلگرام/بله/ایتا/روبیکا)</summary>' +
      '<div class="fr" style="margin-top:8px"><div class="fld"><label>آیدی تلگرام</label><input type="text" id="msgIdTg" value="' + escP(ids.tg || '') + '" placeholder="@username" style="direction:ltr"></div>' +
      '<div class="fld"><label>آیدی بله</label><input type="text" id="msgIdBale" value="' + escP(ids.bale || '') + '" style="direction:ltr"></div></div>' +
      '<div class="fr"><div class="fld"><label>آیدی ایتا</label><input type="text" id="msgIdEitaa" value="' + escP(ids.eitaa || '') + '" style="direction:ltr"></div>' +
      '<div class="fld"><label>آیدی روبیکا</label><input type="text" id="msgIdRubika" value="' + escP(ids.rubika || '') + '" style="direction:ltr"></div></div>' +
      '<button type="button" class="bt bt-o" style="font-size:12px" onclick="ptfMsgSaveIds(\'' + ptfOnClickArg(entityKey) + '\',\'' + ptfOnClickArg(cd) + '\')">💾 ذخیره شناسه‌ها</button></details>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.ptfMsgTplPick = function (i, nm, aud) {
    if (i === '') return;
    var tpls = (typeof ptfMsgTpls === 'function' ? ptfMsgTpls() : []).filter(function (t) { return t.aud === aud; });
    var t = tpls[+i];
    if (!t) return;
    var ta = document.getElementById('msgTxt');
    if (ta) ta.value = (typeof ptfTplRender === 'function' ? ptfTplRender(t, nm) : t.body);
  };

  window.ptfMsgSaveIds = function (entityKey, cd) {
    var list = getData(entityKey);
    var c = list.filter(function (x) { return x.cd === cd; })[0];
    if (!c) return;
    c.msgIds = {
      tg: cleanHandle(((document.getElementById('msgIdTg') || {}).value || '').trim()),
      bale: cleanHandle(((document.getElementById('msgIdBale') || {}).value || '').trim()),
      eitaa: cleanHandle(((document.getElementById('msgIdEitaa') || {}).value || '').trim()),
      rubika: cleanHandle(((document.getElementById('msgIdRubika') || {}).value || '').trim())
    };
    c.updatedAtISO = new Date().toISOString();
    try { c.updatedBy = curSession().name; } catch (eBy) {}
    setData(entityKey, list);
    if (entityKey === 'ptf_crm_customers' && typeof renderCustomers === 'function') renderCustomers();
    if (entityKey === 'ptf_crm_suppliers' && typeof renderSuppliers === 'function') renderSuppliers();
    if (typeof ptfToast === 'function') ptfToast('شناسه‌های پیام‌رسان ذخیره شد', 'ok');
  };

  window.ptfMsgOpen = function (appId, entityKey, cd) {
    var c = getData(entityKey).filter(function (x) { return x.cd === cd; })[0];
    if (!c) return;
    var mob = firstMobile(c);
    var txt = (document.getElementById('msgTxt') || {}).value || '';
    var ids = c.msgIds || {};
    var a = APPS.filter(function (x) { return x.id === appId; })[0];
    if (!a) return;
    var lnk = a.link({ mob: mob, txt: txt, tg: ids.tg, bale: ids.bale, eitaa: ids.eitaa, rubika: ids.rubika });
    if (!lnk) { alert('شناسه/شماره این مخاطب برای ' + a.lb + ' ثبت نشده — از بخش ⚙️ شناسه‌ها اضافه کنید'); return; }
    /* پیام‌رسان‌های بدون پارامتر text: متن در کلیپ‌بورد */
    if (appId !== 'wa' && txt) {
      try { navigator.clipboard.writeText(txt); if (typeof ptfToast === 'function') ptfToast('متن کپی شد — در چت Paste کنید', 'ok'); } catch (e) {}
    }
    window.open(lnk, '_blank', 'noopener,noreferrer');
    try { audit('پیام‌رسان', 'باز کردن چت ' + a.lb + ' با ' + (c.co || c.nm || cd), cd); } catch (e) {}
  };

  /* v34.4.37: کلیدهای مستقیم زیر شماره تماس در جدول مشتری/تأمین‌کننده. واتساپ با
     موبایل کار می‌کند؛ تلگرام با username یا phone-link؛ بله/روبیکا به شناسه نیاز دارند. */
  function msgContext(c, txt) {
    var ids = (c && c.msgIds) || {};
    return { mob: firstMobile(c), txt: txt || '', tg: ids.tg, bale: ids.bale, eitaa: ids.eitaa, rubika: ids.rubika };
  }
  function quickApps() { return APPS.filter(function (a) { return ['wa', 'tg', 'bale', 'rubika'].indexOf(a.id) > -1; }); }
  window.ptfMsgQuickHtml = function (entityKey, c) {
    if (!c || !c.cd) return '';
    var ctx = msgContext(c, '');
    var colors = { wa: '#15803d', tg: '#0369a1', bale: '#047857', rubika: '#7e22ce' };
    return '<div class="msg-quick-links" data-msg-entity="' + escP(c.cd) + '" style="direction:rtl;display:flex;gap:3px;flex-wrap:wrap;align-items:center;margin-top:5px">' +
      quickApps().map(function (a) {
        var active = !!a.link(ctx);
        var hint = active ? ('باز کردن چت مستقیم در ' + a.lb) : ('شناسه/موبایل ' + a.lb + ' ثبت نشده — برای تنظیم کلیک کنید');
        return '<button type="button" class="ba msg-quick-app' + (active ? '' : ' is-missing') + '" data-msg-app="' + a.id + '"' +
          ' style="padding:2px 5px;font-size:10.5px;border:1px solid ' + (active ? colors[a.id] : '#cbd5e1') + ';border-radius:7px;color:' + (active ? colors[a.id] : '#94a3b8') + ';background:#fff;white-space:nowrap;opacity:' + (active ? '1' : '.72') + '"' +
          ' title="' + escP(hint) + '" aria-label="' + escP(hint) + '" onclick="event.stopPropagation();ptfMsgQuickOpen(\'' + a.id + '\',\'' + ptfOnClickArg(entityKey) + '\',\'' + ptfOnClickArg(c.cd) + '\')">' + a.ic + ' ' + a.short + '</button>';
      }).join('') + '</div>';
  };
  window.ptfMsgQuickOpen = function (appId, entityKey, cd) {
    var c = getData(entityKey).filter(function (x) { return x.cd === cd; })[0];
    var a = APPS.filter(function (x) { return x.id === appId; })[0];
    if (!c || !a) return;
    var lnk = a.link(msgContext(c, ''));
    if (!lnk) {
      window.ptfMsgSend(entityKey, cd);
      setTimeout(function () {
        var dlg = document.getElementById('ptfMsgSendDlg');
        var details = dlg ? dlg.querySelector('details') : null;
        if (details) details.open = true;
      }, 0);
      if (typeof ptfToast === 'function') ptfToast('ابتدا شناسهٔ ' + a.lb + ' این مخاطب را ثبت کنید', 'info');
      return;
    }
    var opened = window.open(lnk, '_blank', 'noopener,noreferrer');
    try { if (opened) opened.opener = null; } catch (eOp) {}
    try { audit('پیام‌رسان', 'باز کردن مستقیم چت ' + a.lb + ' با ' + (c.co || c.nm || cd), cd); } catch (eA) {}
  };

  /* دکمه 💬 روی ردیف‌های مشتری/تامین‌کننده + کلیدهای مستقیم زیر شماره */
  function injectRowBtns() {
    ['cTb', 'sTb'].forEach(function (tbId) {
      var tb = document.getElementById(tbId);
      if (!tb) return;
      var isCustomer = tbId === 'cTb';
      var key = isCustomer ? 'ptf_crm_customers' : 'ptf_crm_suppliers';
      var byCd = {};
      (getData(key) || []).forEach(function (x) { if (x && x.cd) byCd[x.cd] = x; });
      tb.querySelectorAll('tr').forEach(function (tr) {
        var strong = tr.querySelector('td strong');
        if (!strong) return;
        var cd = strong.textContent.trim();
        var rec = byCd[cd];
        if (!rec) return;
        var tds = tr.querySelectorAll('td');
        /* ستون تماس: مشتری ستون پنجم، تأمین‌کننده ستون چهارم. */
        var contactCell = tds[isCustomer ? 4 : 3];
        if (contactCell && !contactCell.querySelector('.msg-quick-links')) {
          contactCell.insertAdjacentHTML('beforeend', window.ptfMsgQuickHtml(key, rec));
        }
        if (tr.querySelector('.msg-btn')) return;
        var last = tds[tds.length - 1];
        if (last) last.insertAdjacentHTML('beforeend',
          ' <button class="bt bt-o msg-btn entity-row-action" data-entity-action="message" style="padding:4px 9px;font-size:12px;color:#059669;border-color:#a7f3d0" title="ارسال پیام با متن آماده و تنظیم شناسه‌ها" aria-label="ارسال پیام" onclick="ptfMsgSend(\'' + key + '\',\'' + ptfOnClickArg(cd) + '\')">💬</button>');
      });
    });
  }
  var mo = new MutationObserver(function () { try { injectRowBtns(); } catch (e) {} });
  function bootBtns() {
    var panels = document.getElementById('panels');
    if (!panels) { setTimeout(bootBtns, 600); return; }
    mo.observe(panels, { childList: true, subtree: true });
    injectRowBtns();
  }
  bootBtns();

  /* ---------- US-333: بات اعلان تلگرام/بله — کلاینت ---------- */
  /* اعلان‌های مهم (چک/ارجاع/مختومه) علاوه بر کارتابل به گروه شرکت هم می‌روند.
     سرور: api/notify-bot.php (توکن‌ها در bot-config.php خارج از webroot) */
  window.ptfBotSend = function (text, cb) {
    fetch('../api/notify-bot.php?action=send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    }).then(function (r) { return r.json(); }).then(function (d) { if (cb) cb(d); })
      .catch(function () { if (cb) cb({ ok: false, error: 'offline' }); });
  };
  window.ptfBotStatus = function (cb) {
    fetch('../api/notify-bot.php?action=status').then(function (r) { return r.json(); }).then(cb)
      .catch(function () { cb({ ok: false, error: 'خطای اتصال' }); });
  };
  /* هوک notify: اعلان‌های حیاتی به بات هم برود (اگر کانفیگ فعال باشد — سرور خودش چک می‌کند) */
  function hookNotify() {
    if (window._botNotifyHooked || typeof window.notify !== 'function') return false;
    window._botNotifyHooked = true;
    var _n = window.notify;
    window.notify = function (opt) {
      var r = _n(opt);
      /* v31.7.15 BUG-BOT-SPAM-001: اگر notify به‌دلیل تکراری بودن (dedup v31.7.10) سرکوب شد،
         بات تلگرام/بله هم نباید دوباره به گروه بفرستد — ریشه پیام‌های تکراری گروه با هر رفرش. */
      if (window._ptfNotifySuppressed) return r;
      try {
        /* v14.1 (US-355 — سوال کارفرما): مسیریابی هوشمند اعلان بات
           - اعلان شخصی (toUsers مشخص، بدون نقش عمومی: چک شخصی، ارجاع به فرد، یادآور فردی)
             → فقط به چت خصوصی همان کاربر (اگر جفت‌سازی کرده باشد)؛ گروه نمی‌بیند
           - اعلان مدیریتی/عمومی (toRoles) → گروه شرکت
           - حسابدار طبق RBAC فقط اعلان‌های نقش خودش (accountant) را می‌گیرد — بات هم همان را رعایت می‌کند */
        var CRITICAL = ['cheque', 'system', 'admin', 'referral', 'payment', 'buyq', 'status', 'reminder'];
        if (opt && CRITICAL.indexOf(opt.kind || '') > -1 && localStorage.getItem('ptf_bot_enabled') === '1') {
          var KIND_ICON = { cheque: '🏦', system: '⚙️', admin: '👑', referral: '📨', payment: '💰', buyq: '🛒', status: '📊', reminder: '⏰' };
          var txt = (KIND_ICON[opt.kind] || '🔔') + ' ' + (opt.title || '') + (opt.body ? '\n' + opt.body : '');
          var personalOnly = (opt.toUsers || []).length > 0 && (opt.toRoles || []).length === 0;
          if (personalOnly) {
            /* فقط به چت شخصی گیرندگان جفت‌سازی‌شده — هرگز به گروه */
            var pairs = {};
            try { pairs = JSON.parse(localStorage.getItem('ptf_bot_pairs') || '{}'); } catch (e3) {}
            (opt.toUsers || []).forEach(function (u) {
              var pr = pairs[u];
              if (pr && pr.chat_id) ptfBotSendPersonal(txt, pr);
            });
          } else {
            ptfBotSend(txt);
          }
        }
      } catch (e) {}
      return r;
    };
    return true;
  }
  var bt = 0;
  var bi = setInterval(function () { bt++; if (hookNotify() || bt > 50) clearInterval(bi); }, 400);

  /* باکس تنظیمات بات در تنظیمات */
  function hookSettings() {
    if (window._botSetHooked || typeof window.buildSettings !== 'function') return false;
    window._botSetHooked = true;
    var _bs = window.buildSettings;
    window.buildSettings = function () {
      var on = localStorage.getItem('ptf_bot_enabled') === '1';
      return _bs() + '<div style="max-width:560px">' +
        '<hr style="border:none;border-top:1px solid var(--brd);margin:16px 0">' +
        '<h4 style="margin:0 0 8px">🤖 بات اعلان تلگرام/بله (US-333)</h4>' +
        '<div style="background:var(--crd,#f8fafc);border:1px solid var(--brd);border-radius:12px;padding:12px 14px;font-size:12.5px;margin-bottom:10px">' +
        'اعلان‌های حیاتی (چک، سیستم، ادمین) علاوه بر کارتابل به گروه شرکت در تلگرام/بله ارسال می‌شود.<br>' +
        '<small style="color:#94a3b8">پیش‌نیاز: فایل bot-config.php روی هاست طبق راهنمای BOT-SETUP-GUIDE.md</small></div>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:8px">' +
        '<input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="localStorage.setItem(\'ptf_bot_enabled\',this.checked?\'1\':\'0\')"> فعال‌سازی ارسال به بات</label>' +
        '<button class="bt bt-o" onclick="ptfBotStatus(function(d){alert(d.ok?\'✅ اتصال بات برقرار است\\n\'+(d.info||\'\'):\'❌ \'+(d.error||\'کانفیگ یافت نشد\'))})">🔌 تست اتصال بات</button>' +
        '<button class="bt bt-o" style="margin-right:6px" onclick="ptfBotSend(\'🔔 پیام آزمایشی از CRM پیشرو تجهیز فرتاک\',function(d){alert(d.ok?\'✅ پیام آزمایشی ارسال شد\':\'❌ \'+(d.error||\'\'))})">📨 ارسال پیام آزمایشی</button>' +
        '<button class="bt" style="margin-right:6px;background:#0e7490" onclick="ptfBotCompose()">✍️ نوشتن پیام به گروه</button>' +
        '<div style="margin-top:10px;border-top:1px dashed var(--brd);padding-top:10px">' +
        '<b style="font-size:12.5px">🔗 اعلان شخصی (US-355):</b> ' +
        '<span style="font-size:11.5px;color:#64748b">' + (function () { try { var pp = JSON.parse(localStorage.getItem('ptf_bot_pairs') || '{}')[curSession().user]; return pp ? '✅ چت شخصی شما متصل است (' + (pp.app === 'bale' ? 'بله' : 'تلگرام') + ')' : 'چت شخصی شما هنوز متصل نیست'; } catch (e) { return ''; } })() + '</span><br>' +
        '<button class="bt bt-o" style="font-size:12px;margin-top:6px" onclick="ptfBotPairStart()">🔗 اتصال چت شخصی من به بات</button>' +
        '<div style="font-size:11px;color:#94a3b8;margin-top:4px">اعلان‌های شخصی (چک شخصی، ارجاع به شما، یادآور فردی) فقط به چت خودتان می‌رود — نه گروه</div></div>' +
        '</div>';
    };
    return true;
  }
  var st2 = 0;
  var si = setInterval(function () { st2++; if (hookSettings() || st2 > 50) clearInterval(si); }, 400);

  /* ============ v13.8 (US-340): نوشتن و ارسال پیام دلخواه از طریق بات ============ */
  window.ptfBotCompose = function () {
    var html = '<div class="md-b" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px">' +
      '<h3>✍️ ارسال پیام به گروه شرکت (از طریق بات)</h3>' +
      '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">پیام با نام شما به گروه مدیران در تلگرام/بله ارسال می‌شود</div>' +
      '<div class="fld"><textarea id="botMsgTxt" rows="5" style="font-size:13px" placeholder="متن پیام..."></textarea></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" id="botMsgSendBtn" onclick="ptfBotComposeSend(this)">📤 ارسال به گروه</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.ptfBotComposeSend = function (btn) {
    var txt = ((document.getElementById('botMsgTxt') || {}).value || '').trim();
    if (!txt) { alert('متن پیام خالی است'); return; }
    btn.disabled = true;
    btn.textContent = '⏳ در حال ارسال…';
    var me = (typeof curSession === 'function' ? (curSession().name || curSession().user) : '');
    ptfBotSend('💬 پیام از ' + me + ':\n' + txt, function (d) {
      if (d.ok) {
        try { audit('پیام‌رسان', 'ارسال پیام دستی به گروه بات', ''); } catch (e) {}
        var m = btn.closest('.md-b'); if (m) m.remove();
        if (typeof ptfToast === 'function') ptfToast('✅ پیام به گروه ارسال شد', 'ok');
      } else {
        btn.disabled = false;
        btn.textContent = '📤 ارسال به گروه';
        alert('❌ ارسال نشد: ' + (d.error || 'کانفیگ بات را بررسی کنید'));
      }
    });
  };

  /* دکمه «پیام به گروه» در کارتابل (دسترسی سریع‌تر از تنظیمات) */
  function hookCartable() {
    if (window._botCartHooked || typeof window.buildCartable !== 'function') return false;
    window._botCartHooked = true;
    var _bc = window.buildCartable;
    window.buildCartable = function () {
      return _bc() ;
    };
    /* تزریق دکمه بعد از رندر کارتابل */
    var mo2 = new MutationObserver(function () {
      try {
        var ph = document.querySelector('#panels .ph h3');
        if (ph && ph.textContent.indexOf('کارتابل') > -1 && !document.getElementById('botCartBtn')) {
          /* MOB-034: action گروه هم‌ردیف actionهای اختصاصی کارتابل باشد، نه یک
             sibling شناور کنار عنوان که در عرض 320px فشرده/هم‌پوشان می‌شد. */
          var quick = document.getElementById('cartableQuickActions');
          var button = '<button id="botCartBtn" class="bt bt-o cartable-action cartable-message-action" type="button" title="پیام به گروه شرکت" aria-label="پیام به گروه شرکت" onclick="ptfBotCompose()"><span class="cartable-action-icon" aria-hidden="true">✍️</span><span class="cartable-action-label">پیام گروه</span></button>';
          if (quick) quick.insertAdjacentHTML('beforeend', button);
          else ph.insertAdjacentHTML('afterend', button); /* fallback برای نسخه‌های قدیمی markup */
        }
      } catch (e) {}
    });
    var panels = document.getElementById('panels');
    if (panels) mo2.observe(panels, { childList: true, subtree: false });
    return true;
  }
  var ct2 = 0;
  var ci2 = setInterval(function () { ct2++; if (hookCartable() || ct2 > 50) clearInterval(ci2); }, 400);

  /* ============ v14.1 (US-355): اعلان شخصی بات ============ */
  window.ptfBotSendPersonal = function (text, pair, cb) {
    fetch('../api/notify-bot.php?action=send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, chat_id: pair.chat_id, app: pair.app || 'telegram' })
    }).then(function (r) { return r.json(); }).then(function (d) { if (cb) cb(d); })
      .catch(function () { if (cb) cb({ ok: false }); });
  };

  function botPairs() { try { return JSON.parse(localStorage.getItem('ptf_bot_pairs') || '{}'); } catch (e) { return {}; } }
  function botPairsSave(p2) {
    localStorage.setItem('ptf_bot_pairs', JSON.stringify(p2));
    /* سینک بین دستگاه‌ها از طریق settings */
    try {
      var st = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
      st.botPairs = p2;
      setData('ptf_crm_settings', st);
    } catch (e) {}
  }
  /* بازیابی از settings سینک‌شده (دستگاه دوم) */
  try {
    var stp = JSON.parse(localStorage.getItem('ptf_crm_settings') || '{}');
    if (stp.botPairs && !localStorage.getItem('ptf_bot_pairs')) localStorage.setItem('ptf_bot_pairs', JSON.stringify(stp.botPairs));
  } catch (e) {}

  window.ptfBotPairStart = function () {
    var me = curSession().user;
    var code = 'PTF-' + me.toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
    window._botPairCode = code;
    var html = '<div class="md-b" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:480px">' +
      '<h3>🔗 اتصال چت شخصی من به بات</h3>' +
      '<div style="font-size:12.5px;line-height:2.2;color:var(--tx,#334155)">' +
      '۱. در تلگرام (یا بله) بات شرکت را باز کنید: <b dir="ltr">@PTF_CRM_bot</b><br>' +
      '۲. این کد را برای بات <b>بفرستید</b> (Start را زده باشید):<br>' +
      '<div style="text-align:center;margin:8px 0"><code style="background:var(--bg,#f1f5f9);border:1px dashed var(--brd);border-radius:10px;padding:8px 18px;font-size:16px;font-weight:900;letter-spacing:1px;direction:ltr;display:inline-block">' + code + '</code> ' +
      '<button class="bt bt-o" style="font-size:11px;padding:4px 10px" onclick="navigator.clipboard.writeText(\'' + code + '\');ptfToast&&ptfToast(\'کپی شد\',\'ok\')">📋 کپی</button></div>' +
      '۳. سپس دکمه زیر را بزنید:</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" onclick="ptfBotPairCheck(this)">✅ کد را فرستادم — بررسی کن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.ptfBotPairCheck = function (btn) {
    btn.disabled = true; btn.textContent = '⏳ در حال بررسی…';
    fetch('../api/notify-bot.php?action=pair&code=' + encodeURIComponent(window._botPairCode || ''))
      .then(function (r) { return r.json(); }).then(function (d) {
        if (d.ok && d.chat_id) {
          var p2 = botPairs();
          p2[curSession().user] = { chat_id: d.chat_id, app: d.app || 'telegram', name: d.name || '', t: faDateTime() };
          botPairsSave(p2);
          var m = btn.closest('.md-b'); if (m) m.remove();
          alert('✅ چت شخصی شما متصل شد' + (d.name ? ' (' + d.name + ')' : '') + '\nاز این پس اعلان‌های شخصی (چک، ارجاع به شما، یادآور) فقط به خودتان ارسال می‌شود.');
          ptfBotSendPersonal('✅ اتصال چت شخصی شما به CRM پیشرو تجهیز فرتاک برقرار شد.', p2[curSession().user]);
        } else {
          btn.disabled = false; btn.textContent = '✅ کد را فرستادم — بررسی کن';
          alert('❌ ' + (d.error || 'پیدا نشد — کد را برای بات بفرستید و دوباره بزنید'));
        }
      }).catch(function () { btn.disabled = false; btn.textContent = '✅ کد را فرستادم — بررسی کن'; alert('❌ خطای اتصال'); });
  };
})();

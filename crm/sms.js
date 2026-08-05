/* =====================================================================
   PTF CRM — Sprint 73 (sms.js)
   US-150: ماژول سامانه پیامکی
   - دفترچه تلفن ۳دسته‌ای (مشتریان/تامین‌کنندگان/سایرین) با سینک خودکار
   - ایمپورت اکسل مستقل (→ سایرین) + انتقال بین دسته‌ها
   - ارسال انبوه با انتخاب دسته/دلخواه + تایید
   - پیامک تکی (ارجاعات + خوش‌آمد کاربر)
   - دسترسی: فقط ادمین + رییس هیات مدیره + مدیرعامل + مدیر بازرگانی
   ===================================================================== */
(function () {
  'use strict';
  function smsAuthHeaders(json) { var h = json ? { 'Content-Type': 'application/json' } : {}; try { h['X-CRM-Role'] = (typeof curRole === 'function' ? curRole() : 'admin'); var t = localStorage.getItem('ptf_crm_token'); if (t) h['X-CRM-Token'] = t; } catch (e) {} return h; }
  var API = '../api/crm.php';
  var SMS_ROLES = ['admin', 'chairman', 'ceo', 'commercial']; // AC4
  var CRM_URL = 'https://pishtaj.ir/crm/';
  var CATS = [
    { id: 'cust', lb: '🤝 مشتریان' },
    { id: 'sup', lb: '🏭 تامین‌کنندگان' },
    { id: 'other', lb: '👥 سایرین' }
  ];

  function canSms() { return SMS_ROLES.indexOf(curRole()) > -1; }
  function book() { return getData('ptf_crm_smsbook'); }
  /* v33.22.6 (UR-33): ریشه‌کن حلقهٔ بی‌نهایت + پرش smsStatusBox —
     ① saveBook با early-return اگر محتوا تغییر نکرده (جلوگیری از چرخهٔ setData → ptfScheduleDataRefresh → refreshCurrentPanel → goPanelByName('sms') → goPanel('sms') → ...)
     ② smsStatusCache ۱۵ ثانیه‌ای (جلوگیری از re-render مکرر و پرش ارتفاع) */
  function saveBook(b) {
    var str = JSON.stringify(b);
    try {
      if (localStorage.getItem('ptf_crm_smsbook') === str) return;
    } catch (e) {}
    setData('ptf_crm_smsbook', b);
  }
  /* v21.3 BUG-038: ریشه خالی بودن تب مشتریان —
     phonefmt (US-338) شماره‌ها را با ارقام فارسی ذخیره می‌کند؛
     replace(/\D/g,'') ارقام فارسی را «غیررقم» می‌شمارد و کل شماره را حذف می‌کرد.
     همچنین coTels و tels موبایل‌مانند و phones بدون k جمع نمی‌شد.
     normMob خودکفا است (برای extract تسترها مثل tester85). */
  function normMob(m) {
    /* لاتین‌سازی ارقام فارسی/عربی — بدون وابستگی به scope بیرونی */
    if (typeof ptfToEnDigits === 'function') m = ptfToEnDigits(m);
    else {
      var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
      m = String(m == null ? '' : m)
        .replace(/[۰-۹]/g, function (d) { return String(FA.indexOf(d)); })
        .replace(/[٠-٩]/g, function (d) { return String(AR.indexOf(d)); });
    }
    m = String(m || '').replace(/[^\d+]/g, '');
    if (!m) return '';
    if (m.indexOf('+98') === 0) m = '0' + m.slice(3);
    else if (m.indexOf('0098') === 0) m = '0' + m.slice(4);
    else if (m.indexOf('98') === 0 && m.length === 12) m = '0' + m.slice(2);
    m = m.replace(/\D/g, '');
    if (m.length === 10 && m.charAt(0) === '9') m = '0' + m;
    return /^09\d{9}$/.test(m) ? m : '';
  }
  /* ============ AC2: سینک خودکار از مشتریان و تامین‌کنندگان ============ */
  window.smsBookSyncAll = function () {
    /* v16.7 (BUG-018): دو گارد ضد پاک‌شدن دفترچه —
       ① بازسازی auto فقط پس از تکمیل pull اولیه سینک (روی داده کهنه/خالی rebuild نکن)
       ② اگر هر دو فهرست منبع خالی‌اند، دست به دفترچه نزن (رکوردهای قبلی حفظ) */
    if (window._ptfSyncBootstrapped === false) return book().length; /* سینک فعال ولی pull اولیه ناتمام */
    var srcCust = getData('ptf_crm_customers');
    var srcSup = getData('ptf_crm_suppliers');
    if (!srcCust.length && !srcSup.length) return book().length;
    var b = book();
    // رکوردهای سینک‌شده قبلی (src=auto) حذف و بازسازی؛ دستی/اکسل و انتقال‌یافته‌ها حفظ
    b = b.filter(function (r) { return r.src !== 'auto'; });
    var manualMobs = {};
    b.forEach(function (r) { manualMobs[r.mob] = true; });
    /* v21.3: داخل تابع تا extract تسترها (tester85) خودکفا باشد */
    function pushMob(bArr, seen, mob, nm, cat, ent) {
      mob = normMob(mob);
      if (!mob || seen[mob]) return false;
      seen[mob] = true;
      /* v31.7.26 BUG-SYNC-OSC-001: cd پایدار مشتق از موبایل — rebuild در هر دستگاه همان cd را می‌سازد */
      bArr.push({ cd: 'PB-' + mob, nm: nm || ent || '', mob: mob, cat: cat, src: 'auto', ent: ent || '', t: faDate() });
      return true;
    }
    function collect(listKey, cat) {
      getData(listKey).forEach(function (e) {
        var ent = e.co || e.nm || '';
        var found = false;
        /* 1) اشخاص → mobs */
        (e.people || []).forEach(function (p) {
          (p.mobs || []).forEach(function (m) {
            if (pushMob(b, manualMobs, m && m.n, p.nm || ent, cat, ent)) found = true;
          });
          /* 2) tels که در واقع موبایل 09 هستند (اشتباه ثبت کاربر) */
          (p.tels || []).forEach(function (m) {
            if (pushMob(b, manualMobs, m && m.n, p.nm || ent, cat, ent)) found = true;
          });
        });
        /* 3) phones[] — با یا بدون k=mob (ساختارهای قدیمی) */
        (e.phones || []).forEach(function (p) {
          if (!p) return;
          if (p.k && p.k !== 'mob' && p.k !== 'mobile') {
            /* فقط اگر شبیه موبایل باشد قبول کن */
            if (!normMob(p.n)) return;
          }
          if (pushMob(b, manualMobs, p.n, ent, cat, ent)) found = true;
        });
        /* 4) coTels سطح شرکت — قبلاً اصلاً جمع نمی‌شد (ریشه مهم تب خالی) */
        (e.coTels || []).forEach(function (t) {
          if (pushMob(b, manualMobs, t && t.n, e.con || e.nm || ent, cat, ent)) found = true;
        });
        /* 5) فیلدهای تخت قدیمی */
        ['ph', 'mob', 'tel', 'phone'].forEach(function (k) {
          if (e[k] && pushMob(b, manualMobs, e[k], e.nm || e.con || ent, cat, ent)) found = true;
        });
        /* 6) اگر هنوز چیزی پیدا نشد ولی ph داشت — یک‌بار دیگر با نرمال قوی */
        if (!found && e.ph) pushMob(b, manualMobs, e.ph, e.nm || e.con || ent, cat, ent);
      });
    }
    collect('ptf_crm_customers', 'cust');
    collect('ptf_crm_suppliers', 'sup');
    saveBook(b);
    return b.length;
  };

  /* ============ v16.7 (BUG-018 AC3): بازیابی فقط دفترچه تلفن از بک‌آپ‌های سروری ============
     پاک شدن دفترچه (Lost Update قبل از سپر v16.7) → مخاطبان دستی از hourly/daily برمی‌گردند.
     فقط کلید ptf_crm_smsbook لمس می‌شود؛ ادغام امن: مخاطب فعلی حفظ، از بک‌آپ فقط اضافه. */
  window.smsBookRecover = function () {
    var _r = (typeof curRole === 'function') ? curRole() : '';
    if (_r !== 'admin' && _r !== 'chairman') { alert('⛔ بازیابی از بک‌آپ فقط برای ادمین و رییس هیات مدیره (هم‌راستا با دسترسی سروری get_backup)'); return; }
    fetch(API + '?action=list_backups', { headers: smsAuthHeaders(false) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var files = (d && d.backups) ? d.backups : ((d && d.files) ? d.files : []);
        if (!files.length) { alert('بک‌آپ سروری یافت نشد'); return; }
        var names = files.map(function (f) { return typeof f === 'string' ? f : (f.name || ''); }).filter(Boolean);
        /* ترتیب امتحان: hourly → daily های اخیر → weekly → monthly */
        var order = names.filter(function (n) { return n.indexOf('hourly') === 0; })
          .concat(names.filter(function (n) { return n.indexOf('daily') === 0; }).sort().reverse())
          .concat(names.filter(function (n) { return n.indexOf('weekly') === 0; }))
          .concat(names.filter(function (n) { return n.indexOf('monthly') === 0; }));
        if (!order.length) { alert('بک‌آپ قابل استفاده‌ای یافت نشد'); return; }
        (function attempt(i, best) {
          if (i >= order.length || i > 5) {
            if (!best || !best.list.length) { alert('در بک‌آپ‌های اخیر، دفترچه تلفن ناخالی پیدا نشد'); return; }
            applyRecover(best);
            return;
          }
          fetch(API + '?action=get_backup&name=' + encodeURIComponent(order[i]), { headers: smsAuthHeaders(false) })
            .then(function (r) { return r.json(); })
            .then(function (j) {
              var lst = [];
              try { lst = (j && j.data && j.data.ptf_crm_smsbook) ? j.data.ptf_crm_smsbook : []; } catch (e) {}
              if (lst.length && (!best || lst.length > best.list.length)) best = { name: order[i], list: lst };
              /* اولین بک‌آپ دارای دفترچه ناخالی معمولا بهترین است — ولی تا ۳ فایل مقایسه می‌کنیم */
              if (best && i >= 2) { applyRecover(best); return; }
              attempt(i + 1, best);
            })
            .catch(function () { attempt(i + 1, best); });
        })(0, null);
        function applyRecover(best) {
          var cur = book();
          var have = {};
          cur.forEach(function (r) { have[r.mob] = true; });
          var added = 0;
          best.list.forEach(function (r) {
            if (!r || !r.mob || have[r.mob]) return;
            have[r.mob] = true;
            cur.push(r);
            added++;
          });
          if (!confirm('🩹 بازیابی دفترچه تلفن از «' + best.name + '»:\n\n' + best.list.length + ' مخاطب در بک‌آپ | ' + added + ' مخاطب جدید به دفترچه فعلی اضافه می‌شود (هیچ مخاطب فعلی حذف نمی‌شود).\n\nادامه؟')) return;
          saveBook(cur);
          if (typeof audit === 'function') audit('پیامک', 'بازیابی دفترچه تلفن از بک‌آپ ' + best.name + ' — ' + added + ' مخاطب بازگشت (BUG-018)', '');
          if (typeof addLog === 'function') addLog('دفترچه تلفن از بک‌آپ سرور بازیابی شد (' + added + ' مخاطب)');
          renderSmsPanel();
          alert('✅ ' + added + ' مخاطب از بک‌آپ بازگشت' + (added === 0 ? ' (دفترچه فعلی از بک‌آپ کامل‌تر بود)' : ''));
        }
      })
      .catch(function () { alert('سرور در دسترس نیست'); });
  };

  /* ============ پنل ============ */
  var _smsTab = 'cust';
  var _selected = {};

  window.buildSmsPanel = function () {
    return '<div class="ph"><h3>💬 سامانه پیامکی</h3>' +
      '<div class="sb2">' +
      '<button class="bt bt-o" onclick="smsBookSyncAll();renderSmsPanel();addLog(\'دفترچه تلفن پیامکی بروزرسانی شد\')">🔄 سینک از مشتریان/تامین‌کنندگان</button>' +
      '<button class="bt bt-o" style="color:#7c3aed;border-color:#ddd6fe" onclick="smsBookRecover()" title="فقط دفترچه تلفن از بک‌آپ سرور برمی‌گردد — سایر داده‌ها دست نمی‌خورند (BUG-018)">🩹 بازیابی دفترچه از بک‌آپ سرور</button>' +
      '<button class="bt bt-o" onclick="document.getElementById(\'smsXls\').click()">⬆️ ایمپورت اکسل</button>' +
      '<input type="file" id="smsXls" accept=".xlsx,.xls,.csv" style="display:none" onchange="smsImportXls(this)">' +
      '<button class="bt" onclick="smsAddModal()">+ مخاطب جدید</button>' +
      '</div></div>' +
      '<div id="smsStatusBox" style="margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap" id="smsTabs"></div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:8px 14px;margin-bottom:10px;font-size:12px;color:#0c4a6e">' +
      'ℹ️ مخاطبین ایمپورت اکسل/دستی در تب «سایرین» ثبت می‌شوند. رکوردهای سینک خودکار از <b>موبایل‌های فارسی/لاتین</b> مشتریان و تامین‌کنندگان (اشخاص، coTels، phones) استخراج می‌شوند — v21.3. فقط شماره همراه 09xxxxxxxxx وارد دفترچه می‌شود (تلفن ثابت وارد نمی‌شود).</div>' +
      '<div id="smsBookWrap"></div>' +
      '<div id="smsSendBox" style="margin-top:14px"></div>';
  };

  window.renderSmsPanel = function () {
    var tabsEl = document.getElementById('smsTabs');
    if (!tabsEl) return;
    var b = book();
    var tabsHtml = CATS.map(function (c) {
      var n = b.filter(function (r) { return r.cat === c.id; }).length;
      var on = _smsTab === c.id;
      return '<button type="button" onclick="smsSetTab(\'' + c.id + '\')" style="border:0;border-radius:10px;padding:8px 16px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;' +
        (on ? 'background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff' : 'background:#f1f5f9;color:#475569') + '">' + c.lb + ' (' + n + ')</button>';
    }).join('');
    /* v33.22.6: چک تغییر قبل از innerHTML — جلوگیری از re-render بیهوده و پرش UI */
    if (tabsEl.innerHTML !== tabsHtml) tabsEl.innerHTML = tabsHtml;

    var list = b.filter(function (r) { return r.cat === _smsTab; });
    var h = '<div class="tb2"><table><thead><tr>' +
      '<th style="width:36px"><input type="checkbox" id="smsSelAll" onchange="smsToggleAll(this.checked)"></th>' +
      '<th>نام و نام خانوادگی</th><th>شماره همراه</th><th>وابسته به</th><th>منبع</th><th>عملیات</th></tr></thead><tbody>';
    list.forEach(function (r) {
      var moveOpts = CATS.filter(function (c) { return c.id !== r.cat; }).map(function (c) {
        return '<button class="bt bt-o" style="padding:3px 8px;font-size:11px" title="انتقال به ' + c.lb + '" onclick="smsMove(\'' + r.cd + '\',\'' + c.id + '\')">↔ ' + c.lb.split(' ')[1] + '</button>';
      }).join(' ');
      h += '<tr><td><input type="checkbox" ' + (_selected[r.cd] ? 'checked' : '') + ' onchange="smsToggle(\'' + r.cd + '\',this.checked)"></td>' +
        '<td>' + escP(r.nm || '—') + '</td><td style="direction:ltr"><b>' + escP(r.mob) + '</b></td>' +
        '<td style="font-size:12px;color:#64748b">' + escP(r.ent || '—') + '</td>' +
        '<td style="font-size:11px">' + (r.src === 'auto' ? '<span class="bd" style="background:#e0f2fe;color:#0369a1">سینک خودکار</span>' : r.src === 'xls' ? '<span class="bd" style="background:#fef3c7;color:#b45309">اکسل</span>' : '<span class="bd" style="background:#f1f5f9;color:#475569">دستی</span>') + '</td>' +
        '<td>' + moveOpts + (r.src !== 'auto' ? ' <button class="bt bt-o" style="padding:3px 8px;font-size:11px;color:#dc2626" onclick="smsDel(\'' + r.cd + '\')">🗑️</button>' : '') + '</td></tr>';
    });
    var bw = document.getElementById('smsBookWrap');
    var bwHtml = h + '</tbody></table></div>' +
      (list.length ? '' : '<div style="text-align:center;color:#94a3b8;padding:18px;font-size:13px">مخاطبی در این دسته نیست</div>');
    if (bw && bw.innerHTML !== bwHtml) bw.innerHTML = bwHtml;
    renderSmsSendBox();
    smsRenderStatus();
  };

  window.smsSetTab = function (t) { _smsTab = t; renderSmsPanel(); };
  window.smsToggle = function (cd, on) { if (on) _selected[cd] = true; else delete _selected[cd]; renderSmsSendBox(); };
  window.smsToggleAll = function (on) {
    book().filter(function (r) { return r.cat === _smsTab; }).forEach(function (r) {
      if (on) _selected[r.cd] = true; else delete _selected[r.cd];
    });
    renderSmsPanel();
  };
  window.smsMove = function (cd, cat) {
    var b = book();
    b.forEach(function (r) { if (r.cd === cd) { r.cat = cat; r.src = r.src === 'auto' ? 'moved' : r.src; } });
    saveBook(b);
    audit('پیامک', 'انتقال مخاطب به دسته ' + cat, cd);
    renderSmsPanel();
  };
  window.smsDel = function (cd) {
    if (!confirm('مخاطب حذف شود؟')) return;
    saveBook(book().filter(function (r) { return r.cd !== cd; }));
    delete _selected[cd];
    renderSmsPanel();
  };

  /* ============ AC3: افزودن دستی + ایمپورت اکسل (→ سایرین) ============ */
  window.smsAddModal = function () {
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:420px">' +
      '<h3>➕ مخاطب جدید (→ سایرین)</h3>' +
      '<div class="fld"><label>نام و نام خانوادگی *</label><input type="text" id="nPbNm"></div>' +
      '<div class="fld"><label>شماره همراه *</label><input type="text" id="nPbMob" placeholder="09xxxxxxxxx" style="direction:ltr"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button><button class="bt" onclick="smsAddSave()">ثبت</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };
  window.smsAddSave = function () {
    var nm = document.getElementById('nPbNm').value.trim();
    var mob = normMob(document.getElementById('nPbMob').value); /* v21.3: ارقام فارسی هم قبول */
    if (!nm || !mob) { alert('نام و شماره همراه معتبر (09xxxxxxxxx) الزامی است'); return; }
    var b = book();
    if (b.some(function (r) { return r.mob === mob; })) { alert('این شماره قبلاً در دفترچه ثبت شده'); return; }
    b.unshift({ cd: genCode('PB'), nm: nm, mob: mob, cat: 'other', src: 'manual', ent: '', t: faDate() });
    saveBook(b);
    hideModal();
    _smsTab = 'other';
    renderSmsPanel();
    audit('پیامک', 'افزودن مخاطب دستی: ' + nm, mob);
  };

  window.smsImportXls = function (inp) {
    var f = inp.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var rows = [];
      try {
        var wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      } catch (e) { alert('خطا در خواندن فایل'); return; }
      var b = book();
      var existing = {};
      b.forEach(function (r) { existing[r.mob] = true; });
      var added = 0, skipped = 0;
      rows.forEach(function (r) {
        if (!r || !r.length) return;
        // تشخیص ستون: اولین سلولِ شبیه موبایل = شماره؛ بقیه = نام
        var mob = '', nm = [];
        r.forEach(function (c) {
          var m = normMob(c);
          if (m && !mob) mob = m;
          else if (c != null && String(c).trim()) nm.push(String(c).trim());
        });
        if (!mob) { skipped++; return; }
        if (existing[mob]) { skipped++; return; }
        existing[mob] = true;
        b.push({ cd: genCode('PB'), nm: nm.join(' ') || 'بدون نام', mob: mob, cat: 'other', src: 'xls', ent: '', t: faDate() });
        added++;
      });
      saveBook(b);
      inp.value = '';
      _smsTab = 'other';
      renderSmsPanel();
      audit('پیامک', 'ایمپورت اکسل دفترچه تلفن: ' + added + ' مخاطب', '');
      alert('✅ ' + added + ' مخاطب به تب «سایرین» افزوده شد' + (skipped ? ' | ' + skipped + ' ردیف رد شد (نامعتبر/تکراری)' : ''));
    };
    rd.readAsArrayBuffer(f);
  };

  /* ============ AC5: ارسال انبوه ============ */
  function selectedRecipients() {
    return book().filter(function (r) { return _selected[r.cd]; });
  }
  window.smsPickCat = function (cat, on) {
    book().filter(function (r) { return cat === 'all' || r.cat === cat; }).forEach(function (r) {
      if (on) _selected[r.cd] = true; else delete _selected[r.cd];
    });
    renderSmsPanel();
  };

  window.renderSmsSendBox = function () {
    var el = document.getElementById('smsSendBox');
    if (!el) return;
    var sel = selectedRecipients();
    el.innerHTML = '<div style="background:#fff;border:1px solid var(--brd);border-radius:14px;padding:14px">' +
      '<h4 style="margin:0 0 10px;font-size:14px">📤 ارسال پیامک (' + sel.length + ' گیرنده انتخاب شده)</h4>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
      '<button class="bt bt-o" style="font-size:12px" onclick="smsPickCat(\'cust\',true)">+ همه مشتریان</button>' +
      '<button class="bt bt-o" style="font-size:12px" onclick="smsPickCat(\'sup\',true)">+ همه تامین‌کنندگان</button>' +
      '<button class="bt bt-o" style="font-size:12px" onclick="smsPickCat(\'other\',true)">+ همه سایرین</button>' +
      '<button class="bt bt-o" style="font-size:12px" onclick="smsPickCat(\'all\',true)">+ هر سه دسته</button>' +
      '<button class="bt bt-o" style="font-size:12px;color:#dc2626" onclick="smsPickCat(\'all\',false)">✕ پاک کردن انتخاب</button></div>' +
      '<textarea id="smsText" rows="3" placeholder="متن پیامک... (متغیرها: {نام} = نام مخاطب)" style="width:100%;padding:10px;border:1px solid var(--brd);border-radius:10px;font-family:inherit;font-size:13px"></textarea>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:8px">' +
      '<small style="color:#94a3b8">«لغو11» خودکار به انتهای پیامک تبلیغاتی اضافه می‌شود</small>' +
      '<button class="bt" onclick="smsBulkSend()">📤 ارسال به ' + sel.length + ' نفر</button></div></div>';
  };

  window.smsBulkSend = function () {
    var sel = selectedRecipients();
    var txt = (document.getElementById('smsText') || { value: '' }).value.trim();
    if (!sel.length) { alert('حداقل یک گیرنده انتخاب کنید'); return; }
    if (!txt) { alert('متن پیامک را بنویسید'); return; }
    if (!confirm('تایید ارسال:\n\nگیرندگان: ' + sel.length + ' نفر\nمتن: ' + txt.slice(0, 120) + (txt.length > 120 ? '…' : '') + '\n\nارسال شود؟')) return;
    var recipients = sel.map(function (r) { return { nm: r.nm, mob: r.mob }; });
    var fd = new FormData();
    fd.append('recipients', JSON.stringify(recipients));
    fd.append('text', txt);
    fd.append('by', curSession().name);
    fetch(API + '?action=sms_bulk', { method: 'POST', headers: smsAuthHeaders(false), body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok && d.sent > 0) {
          alert('✅ ' + d.sent + ' پیامک ارسال شد' + (d.failed ? ' | ' + d.failed + ' ناموفق' + (d.reason ? '\nعلت: ' + d.reason : '') : ''));
          audit('پیامک', 'ارسال انبوه به ' + sel.length + ' نفر', '');
        } else if (d.ok && d.sent === 0) {
          // همه ناموفق → علت دقیق از کاوه‌نگار
          smsQueueLocal(recipients, txt);
          alert('❌ ارسال ناموفق (' + d.failed + ' پیامک)\n\n📋 علت: ' + (d.reason || 'نامشخص') +
            '\n\n💾 پیامک‌ها در صف ذخیره شدند — پس از رفع مشکل با «ارسال صف ←» دوباره بفرستید.');
        } else if (d.queued) {
          smsQueueLocal(recipients, txt);
          alert('ℹ️ پنل پیامک هنوز فعال نیست — ' + sel.length + ' پیامک در صف ارسال ذخیره شد و پس از فعال‌سازی ارسال می‌شود');
        } else alert('⚠️ ' + (d.error || 'خطا در ارسال'));
        smsRenderStatus();
      })
      .catch(function () {
        smsQueueLocal(recipients, txt);
        alert('⚠️ سرور در دسترس نیست — پیامک‌ها در صف محلی ذخیره شدند');
      });
  };

  function smsQueueLocal(recipients, txt) {
    var q = getData('ptf_crm_sendqueue');
    q.unshift({ cd: genCode('SND'), ch: 'sms', bulk: true, n: recipients.length, recipients: recipients, text: txt, st: 'queued', t: faDateTime(), by: curSession().name });
    setData('ptf_crm_sendqueue', q);
  }

  var _smsStatusCache = null;
  var _smsStatusTime = 0;
  window.smsRenderStatus = function (force) {
    var el = document.getElementById('smsStatusBox');
    if (!el) return;

    var now = Date.now();
    if (!force && _smsStatusCache && (now - _smsStatusTime < 15000)) {
      if (el.innerHTML !== _smsStatusCache) el.innerHTML = _smsStatusCache;
      return;
    }

    fetch(API + '?action=sms_status')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var q = getData('ptf_crm_sendqueue').filter(function (x) { return x.ch === 'sms' && x.st === 'queued'; }).length;
        var newHtml = d.enabled
          ? '<div style="background:#ecfdf5;border:1px solid #10b981;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#065f46;display:flex;align-items:center;gap:10px;flex-wrap:wrap">✅ پنل پیامک متصل است' +
            ' <button class="bt" style="padding:4px 12px;font-size:12px;background:#059669" onclick="smsTestSend()">📲 ارسال پیامک تست به خودم</button>' +
            (q ? ' | ' + q + ' پیامک در صف — <a href="javascript:void(0)" onclick="smsFlushQueue()" style="color:#0e7490">ارسال صف ←</a>' : '') + '</div>'
          : '<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:8px 14px;font-size:12.5px;color:#92400e">⚠️ پنل پیامک هنوز پیکربندی نشده (sms-config.php) — ارسال‌ها در صف ذخیره می‌شوند' + (q ? ' | صف فعلی: ' + q : '') + '</div>';
        _smsStatusCache = newHtml;
        _smsStatusTime = Date.now();
        if (el.innerHTML !== newHtml) el.innerHTML = newHtml;
      }).catch(function () { el.innerHTML = ''; });
  };

  // تست سریع اتصال کاوه‌نگار: ارسال به شماره خود کاربر
  window.smsTestSend = function () {
    var me = getData('ptf_crm_users').filter(function (u) { return u.username === curSession().user; })[0];
    var mob = me ? normMob(me.mobile) : '';
    if (!mob) mob = normMob(prompt('شماره موبایل خودتان برای تست:', '09') || '');
    if (!mob) { alert('شماره معتبر وارد نشد'); return; }
    smsSendSingle(mob, 'پیامک آزمایشی سامانه CRM پیشرو تجهیز فرتاک — اتصال پنل پیامک برقرار است ✅', function (d) {
      if (d.ok && d.sent) {
        if (d.reason === 'sent-default-line')
          alert('✅ پیامک تست ارسال شد به ' + mob + ' — اما با «خط پیش‌فرض پنل»!\n\n⚠️ شماره خطی که در sms-config.php نوشته‌اید توسط کاوه‌نگار رد شد (تایید نشده یا اشتباه است).\n\n🔧 راه‌حل: شماره دقیق خط را از پنل کاوه‌نگار → منوی «خطوط» کپی و در sms-config.php جایگزین کنید؛ یا مقدار line را خالی بگذارید تا همیشه خط پیش‌فرض استفاده شود.');
        else
          alert('✅ پیامک تست ارسال شد به ' + mob + ' — گوشی را چک کنید');
      }
      else alert('❌ ارسال ناموفق\n\n📋 علت دقیق: ' + (d.reason || d.error || 'خطای نامشخص') +
        '\n\n🔧 شایع‌ترین‌ها:\n• خط هنوز تایید نشده (احراز هویت در حال بررسی) → منتظر تایید کاوه‌نگار بمانید\n• اعتبار پنل صفر → شارژ کنید\n• کلید API غلط → دوباره کپی کنید');
    });
  };

  window.smsFlushQueue = function () {
    var q = getData('ptf_crm_sendqueue');
    var items = q.filter(function (x) { return x.ch === 'sms' && x.st === 'queued' && x.recipients; });
    if (!items.length) { alert('صفی وجود ندارد'); return; }
    var done = 0;
    items.forEach(function (it) {
      var fd = new FormData();
      fd.append('recipients', JSON.stringify(it.recipients));
      fd.append('text', it.text);
      fd.append('by', it.by || '');
      fetch(API + '?action=sms_bulk', { method: 'POST', headers: smsAuthHeaders(false), body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok && d.sent != null) {
            it.st = 'sent';
            done++;
            setData('ptf_crm_sendqueue', q);
            smsRenderStatus();
          }
        });
    });
  };

  /* ============ AC6/AC7: پیامک تکی (ارجاع/خوش‌آمد) ============ */
  window.smsSendSingle = function (mob, text, cb) {
    mob = normMob(mob);
    if (!mob) { cb && cb({ ok: false, error: 'شماره نامعتبر' }); return; }
    var fd = new FormData();
    fd.append('recipients', JSON.stringify([{ nm: '', mob: mob }]));
    fd.append('text', text);
    fd.append('by', curSession().name);
    fd.append('kind', 'system');
    fetch(API + '?action=sms_bulk', { method: 'POST', headers: smsAuthHeaders(false), body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.queued) smsQueueLocal([{ nm: '', mob: mob }], text);
        cb && cb(d);
      })
      .catch(function () { smsQueueLocal([{ nm: '', mob: mob }], text); cb && cb({ ok: false, queued: true }); });
  };

  window.smsUserMobile = function (username) {
    var u = getData('ptf_crm_users').filter(function (x) { return x.username === username; })[0];
    return u ? normMob(u.mobile) : '';
  };
  window.smsUserMobileByName = function (name) {
    var u = getData('ptf_crm_users').filter(function (x) { return x.name === name; })[0];
    return u ? normMob(u.mobile) : '';
  };

  /* ============ v14.5 (US-376): ارسال مجدد پیامک اطلاعات ورود ============
     رمز ذخیره‌شده hash است و قابل بازیابی نیست → رمز موقت جدید ساخته و ارسال می‌شود
     + الزام تغییر رمز در اولین ورود (mustChangePass) + سقف ۳ ارسال در ساعت + audit. */
  window.smsResendLogin = function (username) {
    /* v14.9 (US-383): مدیرعامل و مدیر بازرگانی هم‌سطح رییس هیات مدیره */
    if (['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) < 0) { alert('⛔ فقط مدیران ارشد'); return; }
    var users = getData('ptf_crm_users');
    var u = users.filter(function (x) { return x.username === username; })[0];
    if (!u) { alert('کاربر یافت نشد'); return; }
    /* ضداسپم: حداکثر ۳ ارسال در ساعت per کاربر */
    var now = Date.now();
    u.smsResends = (u.smsResends || []).filter(function (t2) { return now - t2 < 3600000; });
    if (u.smsResends.length >= 3) { alert('⛔ سقف ارسال مجدد (۳ بار در ساعت) برای این کاربر پر شده — کمی بعد تلاش کنید'); return; }
    /* اصلاح شماره موبایل پیش از ارسال (اگر غلط ثبت شده بود) */
    var mob = prompt('شماره موبایل مقصد (در صورت نیاز اصلاح کنید):', u.mobile || '09');
    if (mob === null) return;
    mob = normMob(mob);
    if (!mob) { alert('شماره معتبر نیست (09xxxxxxxxx)'); return; }
    if (!confirm('📱 ارسال مجدد اطلاعات ورود برای «' + u.name + '»\n\n⚠️ رمز فعلی به دلایل امنیتی قابل بازیابی نیست؛ یک رمز موقت جدید ساخته و پیامک می‌شود و کاربر در اولین ورود باید آن را تغییر دهد.\n\nادامه می‌دهید؟')) return;
    var tmp = 'PTF' + (function(){ try { var a=new Uint32Array(1); (window.crypto||window.msCrypto).getRandomValues(a); return 100000 + (a[0] % 900000); } catch(e){ return 100000 + Math.floor(Math.random()*900000); } })();
    sha256Hex(tmp).then(function (ph) {
      u.passhash = ph;
      u.mustChangePass = true;
      u.mobile = mob;
      u.smsResends.push(now);
      setData('ptf_crm_users', users);
      if (typeof usersSyncToServer === 'function') usersSyncToServer();
      var text = 'جناب/سرکار ' + u.name + '\n' + (u.role || '') + ' محترم شرکت پیشرو تجهیز فرتاک،\n' +
        'اطلاعات ورود جدید شما (ارسال مجدد):\n' +
        'نام کاربری: ' + u.username + '\nرمز موقت: ' + tmp + '\n' +
        'پس از ورود، رمز را از تنظیمات تغییر دهید.\nلینک ورود: ' + CRM_URL;
      smsSendSingle(mob, text, function (d) {
        audit('کاربران', 'ارسال مجدد پیامک ورود (رمز موقت) برای ' + u.name + ' به ' + mob, u.username);
        if (d.ok && d.sent) alert('✅ پیامک اطلاعات ورود جدید به ' + mob + ' ارسال شد\n(رمز موقت — الزام تغییر در اولین ورود)');
        else alert('ℹ️ پیامک در صف ارسال قرار گرفت' + (d.reason ? '\nعلت: ' + d.reason : '') + '\n(رمز موقت روی حساب اعمال شده است)');
      });
    });
  };

  // AC7: پیامک خوش‌آمد کاربر جدید (از rbac.js صدا زده می‌شود)
  window.smsWelcomeUser = function (nm, roleLb, username, pass, mob) {
    var text = 'جناب/سرکار ' + nm + '\n' + roleLb + ' محترم شرکت پیشرو تجهیز فرتاک،\n' +
      'اطلاعات ورود شما به سامانه یکپارچه مدیریت شرکت:\n' +
      'نام کاربری: ' + username + '\nرمز عبور: ' + pass + '\n' +
      'لینک ورود: ' + CRM_URL;
    smsSendSingle(mob, text, function (d) {
      if (d.ok && d.sent) addLog('پیامک اطلاعات ورود برای ' + nm + ' ارسال شد');
      else addLog('پیامک اطلاعات ورود ' + nm + ' در صف ارسال قرار گرفت');
    });
  };

  /* ============ سینک خودکار با wrap توابع ثبت ============ */
  ['saveCust2', 'saveSup2', 'supApprove'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig === 'function') {
      window[fn] = function () {
        var r = orig.apply(this, arguments);
        try { smsBookSyncAll(); } catch (e) {}
        return r;
      };
    }
  });

  /* ============ روتینگ + دسترسی ============ */
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'sms') {
      if (!canSms()) { alert('⛔ سامانه پیامکی فقط برای ادمین، رییس هیات مدیره، مدیرعامل و مدیر بازرگانی در دسترس است'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '💬 سامانه پیامکی';
      smsBookSyncAll();
      document.getElementById('panels').innerHTML = buildSmsPanel();
      renderSmsPanel();
      return;
    }
    _go(id, btn);
  };

  function hideSmsBtn() {
    document.querySelectorAll('.sb-i').forEach(function (b) {
      if ((b.getAttribute('onclick') || '').indexOf("'sms'") > -1) b.style.display = canSms() ? '' : 'none';
    });
  }
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { hideSmsBtn(); clearInterval(t); }
    if (tries > 40) clearInterval(t);
  }, 300);
  var _showCrm = window.showCrm;
  if (_showCrm) {
    window.showCrm = function () { _showCrm(); setTimeout(hideSmsBtn, 400); };
  }

  /* ============ v14.5 (US-376): الزام تغییر رمز موقت در اولین ورود ============ */
  function checkMustChangePass() {
    try {
      var me = curSession().user;
      if (!me || me === 'admin') return;
      var u = getData('ptf_crm_users').filter(function (x) { return x.username === me; })[0];
      if (u && u.mustChangePass && typeof ptfChangePassDialog === 'function') {
        alert('🔑 شما با رمز موقت وارد شده‌اید — طبق سیاست امنیتی، لطفا همین حالا رمز عبور جدید تعیین کنید.');
        ptfChangePassDialog();
      }
    } catch (e) {}
  }
  var mtries = 0;
  var mt = setInterval(function () {
    mtries++;
    var vis = document.getElementById('crmL') && document.getElementById('crmL').style.display !== 'none';
    if (vis) { clearInterval(mt); setTimeout(checkMustChangePass, 1500); }
    if (mtries > 40) clearInterval(mt);
  }, 500);

  /* v21.3: پس از ذخیره مشتری/تامین‌کننده دفترچه را تازه کن */
  function hookEntitySaves() {
    if (window._smsCustHooked) return true;
    var ok = false;
    if (typeof window.saveCust2 === 'function') {
      var _sc = window.saveCust2;
      window.saveCust2 = function (cd) {
        _sc(cd);
        try { if (window._ptfSyncBootstrapped !== false) smsBookSyncAll(); } catch (e) {}
      };
      ok = true;
    }
    if (typeof window.saveSup2 === 'function') {
      var _ss = window.saveSup2;
      window.saveSup2 = function (cd) {
        _ss(cd);
        try { if (window._ptfSyncBootstrapped !== false) smsBookSyncAll(); } catch (e) {}
      };
      ok = true;
    }
    if (ok) window._smsCustHooked = true;
    return ok;
  }
  var _hk = 0, _hki = setInterval(function () { _hk++; if (hookEntitySaves() || _hk > 40) clearInterval(_hki); }, 400);
  hookEntitySaves();

  /* ================= v34.0.20-alpha (فاز ۱۷): اطلاع‌رسانی پیامکی به مشتری =================
     helper مرکزی: موبایل مشتری را از رکورد مشتری (people.mobs / phones / ph) استخراج و پیامک می‌فرستد.
     توسط نقاط کلیدی فرایند (ثبت درخواست، صدور پیشنهاد مالی و…) صدا زده می‌شود. */
  function ptfCustomerMobile(c) {
    if (!c) return '';
    try {
      if (c.ph) return c.ph;
      if (Array.isArray(c.phones)) {
        var m = c.phones.filter(function (p) { return p && (p.k === 'mob' || p.k === 'mobile') && p.n; })[0];
        if (m) return m.n;
      }
      if (Array.isArray(c.people)) {
        var mb = null;
        c.people.forEach(function (p) { if (!mb && p && Array.isArray(p.mobs) && p.mobs[0] && p.mobs[0].n) mb = p.mobs[0].n; });
        if (mb) return mb;
      }
      if (c.mobile) return c.mobile;
      if (c.phone) return c.phone;
    } catch (e) {}
    return '';
  }
  /* ارسال پیامک به مشتری با شمارهٔ درخواست — همیشه از صف سرور می‌گذرد (در صورت قطع، local queue) */
  window.ptfSmsCustomer = function (customerCd, text, cb) {
    try {
      var c = getData('ptf_crm_customers').filter(function (x) { return x.cd === customerCd; })[0];
      if (!c) { cb && cb({ ok: false, error: 'no_customer' }); return; }
      var mob = ptfCustomerMobile(c);
      if (!mob) {
        if (typeof addLog === 'function') try { addLog('📱 پیامک به ' + (c.co || c.cd) + ': شماره موبایل مشتری ثبت نشده — ارسال نشد'); } catch (eL) {}
        cb && cb({ ok: false, error: 'no_mobile', customerCd: customerCd });
        return;
      }
      if (typeof smsSendSingle === 'function') {
        smsSendSingle(mob, text, function (d) {
          cb && cb(d);
          if (typeof addLog === 'function') try { addLog('📱 پیامک به ' + (c.co || c.cd) + ' (' + mob + '): ' + (d && d.ok ? 'ارسال شد' : (d && d.queued ? 'در صف' : 'ناموفق'))); } catch (eL2) {}
        });
      } else { cb && cb({ ok: false, error: 'no_sms_fn' }); }
    } catch (e) { cb && cb({ ok: false, error: e && e.message ? e.message : 'err' }); }
  };
  window.ptfCustomerMobile = ptfCustomerMobile;

})();

/* =====================================================================
   PTF CRM — supspec.js — v16.5 — US-399
   پروفایل تخصصی تامین‌کننده (برندها + تجهیزات) و تامین‌یاب هوشمند
   - AC1: دو فیلد چیپ در فرم تامین‌کننده: «🏷 برندهای تخصصی» و «🔧 تجهیزات تخصصی»
          (hook روی showSupModal2/saveSup2 — الگوی مصوب cheques.js برای nS2Origin)
          + مهاجرت نرم فیلد قدیمی brands (رشته ثبت‌نام سایت) → آرایه spBrands
   - AC2: جستجوی دوزبانه برند-آگاه: «زیمنس» و «Siemens» یک نتیجه —
          جدول مترادف PTF_BRAND_ALIASES + گسترش entityMatches با dedupNorm
          (همان موتور مشترک dedup — الگوی PTF_CAT_ALIASES v15.9)
   - AC3: امتیازدهی تخصصی per قلم برای پیشنهادگر «درخواست تامین»:
          برند قلم (وزن بالا) > تجهیز (متوسط) > زمینه کاری (پایه، در rfqsmart موجود)
          + سابقه خرید موفق (purchases از buycmp v16.0) — با ذکر دلیل
   - AC4: یادگیری از اصلاح کاربر: انتخاب دستی تامین‌کننده خارج از پیشنهادها →
          با تایید کاربر، برندهای شناسایی‌شده اقلام به تخصص او اضافه می‌شود
   - AC5: سازگاری کامل — تامین‌کننده بدون تخصص مثل قبل با زمینه کاری امتیاز می‌گیرد
   ===================================================================== */
(function () {
  'use strict';

  /* ============ جدول مترادف برندها (فارسی ↔ انگلیسی) ============ */
  /* عضو اول هر گروه = نام متعارف (canonical) — بقیه مترادف/نگارش فارسی */
  window.PTF_BRAND_ALIASES = [
    ['Siemens', 'زیمنس'],
    ['WIKA', 'ویکا'],
    ['Rosemount', 'روزمونت', 'رزمونت'],
    ['Yokogawa', 'یوکوگاوا'],
    ['Endress+Hauser', 'E+H', 'اندرس هاوزر', 'اندرس+هاوزر', 'اندرث هاوزر'],
    ['ABB', 'ای بی بی', 'ای‌بی‌بی'],
    ['Honeywell', 'هانیول', 'هانی ول'],
    ['Samson', 'سامسون'],
    ['Fisher', 'فیشر'],
    ['Swagelok', 'سواژلوک', 'سوئیج لاک', 'سوئیجلاک'],
    ['Flowserve', 'فلوسرو'],
    ['KROHNE', 'کرونه'],
    ['FOXBORO', 'فاکسبورو'],
    ['Masoneilan', 'ماسونیلان'],
    ['Ashcroft', 'اشکرافت'],
    ['Vega', 'وگا'],
    ['Danfoss', 'دانفوس'],
    ['Spirax Sarco', 'اسپیراکس سارکو', 'اسپیراکس'],
    ['Rotork', 'روتورک'],
    ['Cameron', 'کامرون'],
    ['KITZ', 'کیتز'],
    ['Tenaris', 'تناریس'],
    ['Schneider', 'اشنایدر', 'اشنایدر الکتریک'],
    ['Emerson', 'امرسون'],
    ['Grundfos', 'گراندفوس'],
    ['KSB', 'کا اس بی'],
    ['AUMA', 'آاوما', 'اوما'],
    ['SKF', 'اس کا اف'],
    ['Pepperl+Fuchs', 'پپرل فوکس', 'پپرل+فوکس'],
    ['Phoenix Contact', 'فونیکس کانتکت', 'فینیکس کانتکت']
  ];

  /* تجهیزات متداول برای پیشنهاد چیپ (آزاد — کاربر هر چیزی می‌تواند بنویسد) */
  var EQUIP_SUGGEST = ['ترانسمیتر فشار', 'ترانسمیتر دما', 'ترانسمیتر سطح', 'فلومتر', 'گیج فشار', 'شیر کنترلی',
    'شیر توپی', 'شیر دروازه‌ای', 'شیر اطمینان', 'اکچویتور', 'الکتروموتور', 'پمپ سانتریفیوژ', 'کمپرسور',
    'کابل ابزار دقیق', 'کابل قدرت', 'تابلو برق', 'اینورتر / درایو', 'فلنج', 'اتصالات', 'لوله', 'گسکت', 'پیچ و مهره'];

  function norm(s) { return (typeof dedupNorm === 'function') ? dedupNorm(s) : String(s || '').toLowerCase(); }

  /* نام متعارف برند: «زیمنس» → Siemens؛ ناشناخته → همان ورودی trim شده */
  window.ptfBrandCanon = function (s) {
    var n = norm(s);
    if (!n) return String(s || '').trim();
    for (var i = 0; i < PTF_BRAND_ALIASES.length; i++) {
      var g = PTF_BRAND_ALIASES[i];
      for (var j = 0; j < g.length; j++) if (norm(g[j]) === n) return g[0];
    }
    return String(s || '').trim();
  };

  /* همه مترادف‌های یک برند (برای blob جستجو) */
  function brandGroup(b) {
    var n = norm(b);
    for (var i = 0; i < PTF_BRAND_ALIASES.length; i++) {
      var g = PTF_BRAND_ALIASES[i];
      for (var j = 0; j < g.length; j++) if (norm(g[j]) === n) return g;
    }
    return [String(b || '').trim()];
  }

  /* متن جستجوی تخصص‌های تامین‌کننده: چیپ‌ها + مترادف‌ها + فیلد قدیمی brands + نرمال‌شده */
  window.ptfSupSpecBlob = function (s) {
    var parts = [];
    (s.spBrands || []).forEach(function (b) { parts = parts.concat(brandGroup(b)); });
    (s.spEquip || []).forEach(function (e) { parts.push(e); });
    if (s.brands) {
      String(s.brands).split(/[,،;/]+/).forEach(function (b) { if (b.trim()) parts = parts.concat(brandGroup(b)); });
    }
    var raw = parts.join(' ');
    return (raw + ' ' + norm(raw)).toLowerCase();
  };

  /* ============ AC2: گسترش جستجوی موجودیت‌ها (برند-آگاه دوزبانه) ============ */
  /* entityMatches تعریف سراسری offers.js است — override سراسری، مسیر قبلی حفظ:
     اول همان تطبیق قدیمی؛ اگر نبود، تخصص‌ها + مترادف برند (زیمنس↔Siemens) با dedupNorm */
  function hookSearch() {
    if (window._spSearchHooked || typeof window.entityMatches !== 'function') return false;
    window._spSearchHooked = true;
    var _em = window.entityMatches;
    window.entityMatches = function (entity, q) {
      if (_em(entity, q)) return true;
      try {
        var blob = ptfSupSpecBlob(entity);
        if (!blob.trim()) return false;
        var qq = String(q || '').toLowerCase();
        /* کوئری هم به‌صورت خام، هم نرمال، هم متعارف‌شده برند چک می‌شود */
        return blob.indexOf(qq) > -1 || blob.indexOf(norm(q)) > -1 || blob.indexOf(norm(ptfBrandCanon(q))) > -1;
      } catch (e) { return false; }
    };
    return true;
  }

  /* ============ AC1: چیپ‌های تخصص در فرم تامین‌کننده ============ */
  var _chips = { br: [], eq: [] };

  function chipsHtml(kind) {
    var list = kind === 'br' ? _chips.br : _chips.eq;
    var cl = kind === 'br' ? 'background:#ede9fe;color:#6d28d9' : 'background:#ecfdf5;color:#047857';
    return list.map(function (v, i) {
      return '<span style="' + cl + ';border-radius:999px;padding:3px 10px;font-size:11.5px;display:inline-flex;align-items:center;gap:5px;margin:2px">' + escP(v) +
        '<a href="javascript:void(0)" onclick="ptfSpChipDel(\'' + kind + '\',' + i + ')" style="color:inherit;text-decoration:none;font-weight:800">✕</a></span>';
    }).join('') || '<small style="color:#94a3b8">هنوز موردی ثبت نشده</small>';
  }

  window.ptfSpChipRender = function () {
    var b = document.getElementById('spChipsBr');
    var e = document.getElementById('spChipsEq');
    if (b) b.innerHTML = chipsHtml('br');
    if (e) e.innerHTML = chipsHtml('eq');
  };
  window.ptfSpChipDel = function (kind, i) {
    (kind === 'br' ? _chips.br : _chips.eq).splice(i, 1);
    ptfSpChipRender();
  };
  window.ptfSpChipAdd = function (kind, inpId) {
    var inp = document.getElementById(inpId);
    if (!inp) return;
    var v = inp.value.trim();
    if (!v) return;
    if (kind === 'br') v = ptfBrandCanon(v); /* زیمنس → Siemens: یک نگارش واحد ذخیره می‌شود */
    var list = kind === 'br' ? _chips.br : _chips.eq;
    var nv = norm(v);
    if (!list.some(function (x) { return norm(x) === nv; })) list.push(v);
    inp.value = '';
    ptfSpChipRender();
  };
  window.ptfSpChipKey = function (ev, kind, inpId) {
    if (ev.key === 'Enter') { ev.preventDefault(); ptfSpChipAdd(kind, inpId); }
  };

  /* فهرست برندهای شناخته‌شده برای datalist: متعارف‌ها + برندهای موجود در کالاها */
  function knownBrands() {
    var seen = {}, out = [];
    function add(b) { var n = norm(b); if (b && n && !seen[n]) { seen[n] = 1; out.push(b); } }
    PTF_BRAND_ALIASES.forEach(function (g) { add(g[0]); });
    try { getData('ptf_crm_products').forEach(function (p) { add((p.br || '').trim()); }); } catch (e) {}
    try { getData('ptf_crm_suppliers').forEach(function (s) { (s.spBrands || []).forEach(add); }); } catch (e) {}
    return out;
  }

  function hookSupModal() {
    if (window._spModalHooked || typeof window.showSupModal2 !== 'function' || typeof window.saveSup2 !== 'function') return false;
    window._spModalHooked = true;
    var _sm = window.showSupModal2;
    window.showSupModal2 = function (cd) {
      _sm(cd);
      try {
        var c = cd ? getData('ptf_crm_suppliers').filter(function (x) { return x.cd === cd; })[0] : null;
        _chips.br = (c && c.spBrands ? c.spBrands.slice() : []);
        _chips.eq = (c && c.spEquip ? c.spEquip.slice() : []);
        var catSel = document.getElementById('nS2Cat');
        if (!catSel || document.getElementById('spChipsBr')) return;
        var fr = catSel.closest('.fr') || catSel.closest('.fld');
        if (!fr) return;
        var dlBr = knownBrands().map(function (b) { return '<option value="' + escP(b) + '">'; }).join('');
        var dlEq = EQUIP_SUGGEST.map(function (b) { return '<option value="' + escP(b) + '">'; }).join('');
        fr.insertAdjacentHTML('afterend',
          '<div style="background:#f8fafc;border:1px solid var(--brd);border-radius:12px;padding:10px 12px;margin:8px 0">' +
          '<div style="font-size:12px;font-weight:800;margin-bottom:4px">🏷 برندهای تخصصی <small style="color:#94a3b8;font-weight:400">(US-399 — جستجو و پیشنهاد هوشمند تامین از همین‌ها استفاده می‌کند؛ فارسی یا انگلیسی فرقی ندارد)</small></div>' +
          '<div id="spChipsBr" style="margin-bottom:6px"></div>' +
          '<div style="display:flex;gap:6px"><input type="text" id="spInpBr" list="spDlBr" placeholder="مثلا: Siemens یا زیمنس — Enter برای افزودن" onkeydown="ptfSpChipKey(event,\'br\',\'spInpBr\')" style="flex:1;padding:7px 10px;border:1.5px solid var(--brd);border-radius:9px;font-size:12.5px"><datalist id="spDlBr">' + dlBr + '</datalist>' +
          '<button type="button" class="bt bt-o" style="padding:6px 12px;font-size:12px" onclick="ptfSpChipAdd(\'br\',\'spInpBr\')">＋</button></div>' +
          '<div style="font-size:12px;font-weight:800;margin:10px 0 4px">🔧 تجهیزات تخصصی</div>' +
          '<div id="spChipsEq" style="margin-bottom:6px"></div>' +
          '<div style="display:flex;gap:6px"><input type="text" id="spInpEq" list="spDlEq" placeholder="مثلا: ترانسمیتر فشار — Enter برای افزودن" onkeydown="ptfSpChipKey(event,\'eq\',\'spInpEq\')" style="flex:1;padding:7px 10px;border:1.5px solid var(--brd);border-radius:9px;font-size:12.5px"><datalist id="spDlEq">' + dlEq + '</datalist>' +
          '<button type="button" class="bt bt-o" style="padding:6px 12px;font-size:12px" onclick="ptfSpChipAdd(\'eq\',\'spInpEq\')">＋</button></div>' +
          '</div>');
        ptfSpChipRender();
      } catch (e) {}
    };
    var _ss = window.saveSup2;
    window.saveSup2 = function (cd) {
      /* چیپ نیمه‌تایپ‌شده در input هم لحاظ شود (کاربر Enter نزده) */
      try { if ((document.getElementById('spInpBr') || {}).value) ptfSpChipAdd('br', 'spInpBr'); } catch (e) {}
      try { if ((document.getElementById('spInpEq') || {}).value) ptfSpChipAdd('eq', 'spInpEq'); } catch (e) {}
      _ss(cd);
      try {
        if (!document.getElementById('spChipsBr') && !_chips.br.length && !_chips.eq.length) return;
        var items = getData('ptf_crm_suppliers');
        /* رکورد ذخیره‌شده: با cd یا جدیدترین (همان الگوی nS2Origin در cheques.js) */
        var rec = cd ? items.filter(function (x) { return x.cd === cd; })[0] : items[0];
        if (!rec) return;
        var same = JSON.stringify(rec.spBrands || []) === JSON.stringify(_chips.br) && JSON.stringify(rec.spEquip || []) === JSON.stringify(_chips.eq);
        if (same) return;
        rec.spBrands = _chips.br.slice();
        rec.spEquip = _chips.eq.slice();
        setData('ptf_crm_suppliers', items);
        if (typeof renderSuppliers === 'function') renderSuppliers();
      } catch (e) {}
    };
    return true;
  }

  /* ============ AC1 (مهاجرت نرم): فیلد قدیمی brands رشته‌ای → spBrands ============ */
  function migrate() {
    try {
      var items = getData('ptf_crm_suppliers');
      var changed = false;
      items.forEach(function (s) {
        if (s.brands && (!s.spBrands || !s.spBrands.length)) {
          var out = [];
          String(s.brands).split(/[,،;/]+/).forEach(function (b) {
            b = b.trim();
            if (!b) return;
            var c = ptfBrandCanon(b);
            if (!out.some(function (x) { return norm(x) === norm(c); })) out.push(c);
          });
          if (out.length) { s.spBrands = out; changed = true; }
        }
      });
      if (changed) setData('ptf_crm_suppliers', items);
    } catch (e) {}
  }

  /* ============ نمایش چیپ تخصص در جدول تامین‌کنندگان ============ */
  /* پس-پردازش ردیف‌ها (الگوی فیلتر داخلی/خارجی cheques.js) — بدون دست زدن به رندر اصلی */
  function decorate() {
    try {
      var tb = document.getElementById('sTb');
      if (!tb) return;
      var items = getData('ptf_crm_suppliers');
      var byCd = {};
      items.forEach(function (s) { byCd[s.cd] = s; });
      tb.querySelectorAll('tr').forEach(function (tr) {
        if (tr.getAttribute('data-spdec')) return;
        var strong = tr.querySelector('td strong');
        if (!strong) return;
        var s = byCd[strong.textContent.trim()];
        if (!s) return;
        tr.setAttribute('data-spdec', '1');
        var tds = tr.querySelectorAll('td');
        var caTd = tds[4]; /* ستون «دسته» */
        if (!caTd) return;
        var h = '';
        (s.spBrands || []).slice(0, 3).forEach(function (b) { h += ' <span style="background:#ede9fe;color:#6d28d9;border-radius:8px;padding:1px 7px;font-size:10px;white-space:nowrap">🏷 ' + escP(b) + '</span>'; });
        if ((s.spBrands || []).length > 3) h += ' <small style="color:#94a3b8">+' + (s.spBrands.length - 3) + '</small>';
        (s.spEquip || []).slice(0, 2).forEach(function (b) { h += ' <span style="background:#ecfdf5;color:#047857;border-radius:8px;padding:1px 7px;font-size:10px;white-space:nowrap">🔧 ' + escP(b) + '</span>'; });
        if (h) caTd.insertAdjacentHTML('beforeend', '<div style="margin-top:3px;line-height:1.9">' + h + '</div>');
      });
    } catch (e) {}
  }
  function hookRender() {
    if (window._spRenderHooked || typeof window.renderSuppliers !== 'function') return false;
    window._spRenderHooked = true;
    var _rs = window.renderSuppliers;
    window.renderSuppliers = function () {
      _rs();
      decorate();
    };
    return true;
  }

  /* ============ AC3: موتور امتیاز تخصصی per قلم (مصرف در rfqsScoreSuppliers) ============ */
  /* برندهای شناسایی‌شده در اقلام: از فیلد brand قلم + اسکن نام/مشخصات با جدول مترادف */
  window.ptfItemsBrands = function (items) {
    var found = {}, out = [];
    (items || []).forEach(function (it) {
      var texts = [it.brand || it.br || '', (it.name || it.nm || '') + ' ' + (it.spec || it.st || it.desc || '')];
      texts.forEach(function (tx) {
        var n = norm(tx);
        if (!n) return;
        PTF_BRAND_ALIASES.forEach(function (g) {
          g.forEach(function (al) {
            var an = norm(al);
            if (an && n.indexOf(an) > -1 && !found[g[0]]) { found[g[0]] = 1; out.push(g[0]); }
          });
        });
        /* برند صریح قلم خارج از جدول مترادف هم لحاظ شود */
        var explicit = String(it.brand || it.br || '').trim();
        if (explicit) {
          var c = ptfBrandCanon(explicit);
          if (!found[c]) { found[c] = 1; out.push(c); }
        }
      });
    });
    return out;
  };

  /* سابقه خرید موفق: purchases ثبت‌شده (buycmp — خرید واقعی v16.0/16.3) از این تامین‌کننده */
  function purchaseHistory(s) {
    var n = 0;
    try {
      getData('ptf_crm_buycmp').forEach(function (c) {
        (c.purchases || []).forEach(function (p) {
          if (p.sup && (p.sup === s.co || p.sup === s.cd || norm(p.sup) === norm(s.co))) n++;
        });
      });
    } catch (e) {}
    return n;
  }

  /* خروجی: {score, why[]} — وزن‌ها طبق AC3: برند(۴۰ per برند، سقف ۸۰) > تجهیز(۲۰ per، سقف ۴۰) > سابقه خرید(۱۰ per، سقف ۳۰)
     زمینه کاری (وزن پایه) در خود rfqsScoreSuppliers مثل قبل محاسبه می‌شود (AC5) */
  window.ptfSupSpecScore = function (s, items) {
    var score = 0, why = [];
    var itemBrands = ptfItemsBrands(items);
    var supBrandsN = (s.spBrands || []).map(norm);
    var hitBrands = itemBrands.filter(function (b) { return supBrandsN.indexOf(norm(b)) > -1; });
    if (hitBrands.length) {
      score += Math.min(80, hitBrands.length * 40);
      why.push('تخصص برند: ' + hitBrands.join('، '));
    }
    var eqHits = 0, eqNames = [];
    var itemText = norm((items || []).map(function (it) { return (it.name || it.nm || '') + ' ' + (it.spec || it.st || it.desc || ''); }).join(' '));
    (s.spEquip || []).forEach(function (eq) {
      var en = norm(eq);
      if (en && itemText.indexOf(en) > -1) { eqHits++; eqNames.push(eq); }
    });
    if (eqHits) {
      score += Math.min(40, eqHits * 20);
      why.push('تخصص تجهیز: ' + eqNames.join('، '));
    }
    var ph = purchaseHistory(s);
    if (ph) {
      score += Math.min(30, ph * 10);
      why.push('سابقه ' + ph + ' خرید موفق');
    }
    return { score: score, why: why };
  };

  /* ============ AC4: یادگیری از اصلاح کاربر ============ */
  /* پس از نهایی شدن انتخاب تامین‌کنندگان در «درخواست تامین»:
     تامین‌کننده‌ای که کاربر دستی انتخاب کرده ولی تخصص برند منطبق نداشت →
     با تایید کاربر، برندهای شناسایی‌شده اقلام به spBrands او اضافه می‌شود */
  window.ptfSupSpecLearn = function (items, targets, ranked) {
    try {
      var itemBrands = ptfItemsBrands(items);
      if (!itemBrands.length || !targets || !targets.length) return;
      var whyByCd = {};
      (ranked || []).forEach(function (r) { whyByCd[r.cd] = r.why || ''; });
      var sups = getData('ptf_crm_suppliers');
      var changed = false;
      targets.forEach(function (t) {
        var s = sups.filter(function (x) { return x.cd === t.cd; })[0];
        if (!s) return;
        var supBrandsN = (s.spBrands || []).map(norm);
        var newBrands = itemBrands.filter(function (b) { return supBrandsN.indexOf(norm(b)) < 0; });
        if (!newBrands.length) return;
        /* فقط وقتی بپرسیم که سیستم خودش این تامین‌کننده را بابت برند پیشنهاد نکرده بود */
        if ((whyByCd[t.cd] || '').indexOf('تخصص برند') > -1) return;
        if (confirm('🎓 یادگیری تامین‌یاب (US-399):\n\nشما «' + t.co + '» را برای استعلام اقلام برند ' + newBrands.join('، ') + ' انتخاب کردید.\n\nاین برند(ها) به «برندهای تخصصی» این تامین‌کننده اضافه شود تا دفعه بعد خودکار پیشنهاد شود؟')) {
          s.spBrands = (s.spBrands || []).concat(newBrands);
          changed = true;
          if (typeof audit === 'function') audit('تامین‌کنندگان', 'یادگیری تخصص: ' + newBrands.join('، ') + ' → ' + t.co, s.cd);
        }
      });
      if (changed) setData('ptf_crm_suppliers', sups);
    } catch (e) {}
  };

  /* ============ بوت ============ */
  migrate();
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var a = hookSearch();
    var b = hookSupModal();
    var c = hookRender();
    if ((a || window._spSearchHooked) && (b || window._spModalHooked) && (c || window._spRenderHooked)) clearInterval(t);
    if (tries > 50) clearInterval(t);
  }, 300);
})();

/* =====================================================================
   PTF CRM — Sprint 74 (rfqsmart.js)
   US-131: استعلام هوشمند از تامین‌کنندگان
   - استخراج اقلام از پیوست (اکسل/CSV مستقیم + PDF/عکس → صف بازبینی/LLM)
   - اکسل پاک بدون داده کارفرما (AC2)
   - پیشنهادگر تامین‌کننده امتیازدهی‌شده (AC3)
   - فرم استعلام PDF رسمی PTF-RFQS (AC4)
   - ارسال ایمیل/واتساپ + رهگیری پاسخ (AC5/AC6)
   - Human-in-the-loop: هیچ ارسالی بدون تایید کاربر (AC7)
   ===================================================================== */
(function () {
  'use strict';

  var CATS_MAP = [
    { k: /لوله|پایپ|فلنج|اتصال|pipe|flange|fitting|elbow|زانو|تی|رد[یو]وسر/i, cat: 'پایپینگ' },
    { k: /شیر|ولو|valve|گیت|گلوب|بال|چک|butterfly|پروانه/i, cat: 'شیرآلات' },
    { k: /ترانسمیتر|گیج|فلومتر|ابزار دقیق|transmitter|gauge|flow|level|pressure sw/i, cat: 'ابزار دقیق' },
    { k: /کابل|تابلو|برق|کلید|سوئیچ|switchgear|cable|breaker|درایو|اینورتر/i, cat: 'برق' },
    { k: /پمپ|کمپرسور|pump|compressor|الکتروموتور|motor/i, cat: 'پمپ و کمپرسور' },
    { k: /گسکت|واشر|آب‌?بند|gasket|seal|پیچ|مهره|bolt|nut|stud/i, cat: 'گسکت و آب‌بندی' }
  ];

  function detectCat(text) {
    for (var i = 0; i < CATS_MAP.length; i++) if (CATS_MAP[i].k.test(text)) return CATS_MAP[i].cat;
    return '';
  }

  function rfqsSerial() {
    var list = getData('ptf_crm_rfqsmart');
    var max = 0;
    var yr = faYear();
    list.forEach(function (r) { var m = (r.no || '').match(new RegExp('^PTF-RFQS-' + yr + '-(\\d+)$')); if (m && +m[1] > max) max = +m[1]; });
    return 'PTF-RFQS-' + yr + '-' + String(max + 1).padStart(3, '0');
  }

  var _st = null; // state ویزارد جاری

  /* ============ پنل ============ */
  window.buildRfqSmart = function () {
    return '<div class="ph"><h3>🛒 درخواست تامین</h3>' +
      '<div class="sb2"><button class="bt" onclick="rfqsNew()">+ درخواست تامین جدید</button></div></div>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12.5px;color:#0c4a6e">' +
      'ℹ️ چرخه: پیوست/اقلام درخواست مشتری ← استخراج و پاکسازی (بدون نام و اطلاعات کارفرما) ← پیشنهاد بهترین تامین‌کنندگان ← فرم استعلام PDF ← ارسال ایمیل/واتساپ ← رهگیری پاسخ‌ها</div>' +
      '<div id="rfqsWrap"></div>';
  };

  window.renderRfqSmart = function () {
    var el = document.getElementById('rfqsWrap');
    if (!el) return;
    var list = getData('ptf_crm_rfqsmart');
    var STL = { draft: '📝 پیش‌نویس', sent: '📤 ارسال شده', done: '✅ جمع‌بندی شده' };
    el.innerHTML = list.map(function (r) {
      var resp = (r.targets || []).filter(function (t) { return t.st === 'replied'; }).length;
      return '<div style="background:#fff;border:1px solid var(--brd);border-radius:12px;padding:12px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">' +
        '<div style="font-size:13px"><b dir="ltr">' + escP(r.no) + '</b>' + (r.srcRfq ? ' <small style="color:#64748b">(از درخواست ' + escP(r.srcRfq) + ')</small>' : '') +
        '<div style="font-size:11.5px;color:#64748b;margin-top:2px">' + (r.items || []).length + ' قلم | ' + (r.targets || []).length + ' تامین‌کننده | پاسخ: ' + resp + ' | ' + escP(r.t || '') + ' | ' + (STL[r.st] || '') + '</div></div>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
        '<button class="bt" style="padding:5px 11px;font-size:12px;background:#0e7490;color:#fff;font-weight:bold" onclick="rfqsToggleAccordion(\'' + ptfOnClickArg(r.no) + '\')">🔻 تخصیص و استعلام کشویی (بدون مودال)</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="rfqsOpen(\'' + ptfOnClickArg(r.no) + '\')">📂 باز کردن</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="rfqsPrintPreview(\'' + ptfOnClickArg(r.no) + '\',null)">🖨️ PDF</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#0e7490" onclick="rfqsPrintPickSupplier(\'' + ptfOnClickArg(r.no) + '\')">🖨 اختصاصی</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px" onclick="rfqsXls(\'' + ptfOnClickArg(r.no) + '\')">⬇️ اکسل پاک</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:12px;color:#dc2626" onclick="rfqsDel(\'' + ptfOnClickArg(r.no) + '\')">🗑️</button>' +
        '</div></div>' +
        '<div id="rfqAcc_' + escP(r.no) + '" style="display:none;margin-top:12px;border-top:1px dashed var(--brd);padding-top:12px"></div>' +
        '</div>';
    }).join('') || '<div style="text-align:center;color:#94a3b8;padding:24px">استعلامی ثبت نشده — با «+ استعلام جدید» شروع کنید</div>';
  };

  /* ============ US-216..218: پنل کشویی استعلام، تخصیص اقلام و مقایسه قیمت (بدون مودال) ============ */
  window.rfqsToggleAccordion = function(no) {
    var el = document.getElementById('rfqAcc_' + no);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    rfqsRenderAccordion(no);
  };

  window.rfqsRenderAccordion = function(no) {
    var el = document.getElementById('rfqAcc_' + no);
    if (!el) return;
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var sups = getData('ptf_crm_suppliers');
    
    var itemsRows = (r.items || []).map(function(it, i) {
      it.assignedSups = it.assignedSups || [];
      var supOpts = '<option value="">+ افزودن تامین‌کننده برای این قلم...</option>' + sups.map(function(s) {
        return '<option value="' + escP(s.cd) + '">' + escP(s.co || s.nm) + ' (' + escP(s.ca || 'عمومی') + ')</option>';
      }).join('');
      var assignedTags = it.assignedSups.map(function(scd) {
        var sObj = sups.filter(function(x){ return x.cd === scd; })[0] || { co: scd };
        return '<span style="background:#e0e7ff;color:#1e40af;padding:2px 8px;border-radius:10px;font-size:11px;display:inline-flex;align-items:center;gap:4px;margin-left:4px">' +
          escP(sObj.co || sObj.nm) + ' <a href="javascript:void(0)" onclick="rfqsRemoveSup(\'' + ptfOnClickArg(no) + '\',' + i + ',\'' + ptfOnClickArg(scd) + '\')" style="color:#dc2626;font-weight:bold;text-decoration:none">✕</a></span>';
      }).join('');
      return '<tr>' +
        '<td>' + (i+1) + '</td>' +
        '<td><b>' + escP(it.name) + '</b><br><small style="color:#64748b">' + escP(it.spec||'') + '</small></td>' +
        '<td>' + (it.qty||1) + ' ' + escP(it.unit||'عدد') + '</td>' +
        '<td>' + assignedTags + '<br><select style="margin-top:4px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px" onchange="rfqsAssignSup(\'' + ptfOnClickArg(no) + '\',' + i + ',this.value)">' + supOpts + '</select></td>' +
        '</tr>';
    }).join('');

    var isSent = r.st === 'sent' || r.st === 'replied' || r.priceCompareActive;
    
    var priceCompTable = '';
    if (isSent) {
      var allAssignedSups = {};
      (r.items || []).forEach(function(it) {
        (it.assignedSups || []).forEach(function(scd){ allAssignedSups[scd] = true; });
      });
      var supList = Object.keys(allAssignedSups).map(function(scd){ return sups.filter(function(x){ return x.cd === scd; })[0] || { cd: scd, co: scd }; });
      
      var compRows = (r.items || []).map(function(it, i) {
        it.quotes = it.quotes || {};
        var minP = Infinity, maxP = -1;
        supList.forEach(function(s) { var p = +(it.quotes[s.cd]||0); if (p > 0) { if (p < minP) minP = p; if (p > maxP) maxP = p; } });
        // v30.6.2: محاسبه سریع‌ترین تحویل برای هایلایت
        var minD = Infinity;
        supList.forEach(function(s){
          var dv = it.quoteDelivery && it.quoteDelivery[s.cd] ? parseInt(it.quoteDelivery[s.cd],10) : 0;
          if(dv>0 && dv<minD) minD=dv;
        });
        var tdSups = supList.map(function(s) {
          var p = +(it.quotes[s.cd]||0);
          var d = (it.quoteDelivery && it.quoteDelivery[s.cd]) ? it.quoteDelivery[s.cd] : '';
          var dv = parseInt(d,10)||0;
          var bg = '#fff', col = '#334155', bd = 'none';
          if (p > 0 && p === minP && minP !== maxP) { bg = '#d1fae5'; col = '#065f46'; bd = '1px solid #10b981'; }
          else if (p > 0 && p === maxP && minP !== maxP) { bg = '#fee2e2'; col = '#b91c1c'; bd = '1px solid #ef4444'; }
          // هایلایت سریع‌ترین تحویل - سبز کم‌رنگ
          var dBg = (dv>0 && dv===minD) ? 'background:#e0f2fe;border:1px solid #7dd3fc;' : '';
          var dBadge = (dv>0 && dv===minD) ? '<span style="font-size:9px;color:#0369a1">⚡ سریع‌ترین</span>' : '';
          return '<td style="background:' + bg + ';border:' + bd + ';padding:4px"><div style="display:flex;flex-direction:column;gap:3px"><input type="text" inputmode="numeric" data-rqsprice="' + escP(no) + '" value="' + (p > 0 ? p.toLocaleString('en-US') : '') + '" placeholder="قیمت (' + escP(r.quoteCur || 'IRR') + ')" oninput="rfqsUpdatePriceCompare(\'' + ptfOnClickArg(no) + '\',' + i + ',\'' + ptfOnClickArg(s.cd) + '\',this.value)" onblur="rfqsPriceBlur(\'' + ptfOnClickArg(no) + '\')" style="width:100px;padding:4px;border:1px solid #cbd5e1;border-radius:5px;direction:ltr;font-size:11px;color:' + col + ';font-weight:' + (p === minP && p>0 ? 'bold' : 'normal') + '"><div style="'+dBg+'border-radius:4px;padding:2px;display:flex;align-items:center;gap:2px"><input type="text" placeholder="تحویل (روز)" value="' + escP(d) + '" oninput="rfqsUpdateDeliveryTime(\'' + ptfOnClickArg(no) + '\',' + i + ',\'' + ptfOnClickArg(s.cd) + '\',this.value)" style="width:60px;padding:3px;border:1px dashed #94a3b8;border-radius:4px;direction:ltr;font-size:10px" title="زمان تحویل به روز">'+dBadge+'</div></div></td>';
        }).join('');
        return '<tr><td>' + (i+1) + '</td><td><b>' + escP(it.name) + '</b></td>' + tdSups + '</tr>';
      }).join('');

      var thSups = supList.map(function(s){ return '<th>' + escP(s.co || s.nm) + '</th>'; }).join('');
      /* v15.6 (US-387 ②): انتخاب ارز قیمت‌های خرید — IRR (ریال) پیش‌فرض؛ روی رکورد ذخیره و به قیمت مرجع کالا منتقل می‌شود */
      var qCur = r.quoteCur || 'IRR';
      var curList = (window.PTF_CURRENCIES || [{ id: 'IRR', lb: 'ریال ایران (IRR)' }, { id: 'EUR', lb: 'یورو (EUR)' }, { id: 'USD', lb: 'دلار آمریکا (USD)' }]);
      var qCurSel = '<label style="font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:6px">💱 ارز قیمت‌ها: <select onchange="rfqsSetQuoteCur(\'' + ptfOnClickArg(no) + '\',this.value)" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:7px;font-size:12px;direction:ltr">' +
        curList.map(function (c) { return '<option value="' + c.id + '"' + (qCur === c.id ? ' selected' : '') + '>' + c.lb + '</option>'; }).join('') + '</select></label>';
      // v30.6.3: خلاصه سریع‌ترین تحویل
      var deliverySummary = '';
      try {
        var avgDel = {};
        supList.forEach(function(s){
          var total=0, cnt=0;
          (r.items||[]).forEach(function(it){
            var d = it.quoteDelivery && it.quoteDelivery[s.cd] ? parseInt(it.quoteDelivery[s.cd],10) : 0;
            if(d>0){ total+=d; cnt++; }
          });
          if(cnt>0) avgDel[s.cd]={avg:Math.round(total/cnt), cnt:cnt, co:s.co||s.nm};
        });
        var sortedDel = Object.keys(avgDel).map(function(cd){ return {cd:cd, avg:avgDel[cd].avg, cnt:avgDel[cd].cnt, co:avgDel[cd].co}; }).sort(function(a,b){return a.avg-b.avg;});
        if(sortedDel.length){
          var fastest = sortedDel[0];
          deliverySummary = '<div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
            + '<span>⚡ <b>سریع‌ترین میانگین تحویل:</b> '+escP(fastest.co)+' — '+fastest.avg+' روز (از '+fastest.cnt+' قلم) — بقیه: '+sortedDel.map(function(x){ return escP(x.co)+': '+x.avg+' روز'; }).join(' | ')+'</span>'
            + '<span style="display:flex;gap:6px"><button class="bt bt-o" style="font-size:11px;padding:4px 10px;background:#dbeafe" onclick="rfqsHighlightFastest(\''+ptfOnClickArg(no)+'\')">🔍 نمایش سریع‌ترین</button>'
            + '<button class="bt bt-o" style="font-size:11px;padding:4px 10px;background:#d1fae5" onclick="rfqsSelectCheapest(\''+ptfOnClickArg(no)+'\')">💰 انتخاب ارزان‌ترین</button></span></div>';
        }
      } catch(e){}

      priceCompTable = '<div style="margin-top:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px"><h4 style="margin:0;color:#1e293b">💰 جدول مقایسه قیمت‌های دریافتی خرید (سبز 🟢 ارزان‌ترین / قرمز گران‌ترین / آبی 🔵 سریع‌ترین تحویل)</h4>' + qCurSel + '</div>' +
        deliverySummary +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead style="background:#e2e8f0"><tr><th>#</th><th>کالا</th>' + thSups + '</tr></thead><tbody>' + compRows + '</tbody></table></div>' +
        '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap">' +
        '<small style="color:#64748b">قیمت‌ها حین تایپ خودکار ذخیره می‌شوند؛ زمان تحویل برای مقایسه سریع‌ترین تامین‌کننده استفاده می‌شود. با «ثبت قیمت‌ها» قیمت مرجع کالاها هم به‌روزرسانی می‌شود.</small>' +
        '<button type="button" class="bt" style="background:#059669;color:#fff;font-weight:bold" onclick="rfqsCommitPrices(\'' + ptfOnClickArg(no) + '\')">💾 ثبت قیمت‌ها' + (r.pricesCommittedAt ? ' (آخرین ثبت: ' + escP(r.pricesCommittedAt) + ')' : '') + '</button></div></div>';
    }

    el.innerHTML = '<div style="background:#fcfcfc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">' +
      '<h4 style="margin:0 0 8px">📦 تخصیص اقلام استعلام به تامین‌کنندگان مرتبط</h4>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead style="background:#f1f5f9"><tr><th>#</th><th>شرح کالا</th><th>مقدار</th><th>تامین‌کنندگان اختصاص‌یافته</th></tr></thead><tbody>' + itemsRows + '</tbody></table></div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap">' +
      '<button type="button" class="bt" style="background:#7c3aed;color:#fff;font-size:12px" onclick="rfqsGenDedicatedPdfs(\'' + ptfOnClickArg(no) + '\')">🖨️ تولید PDF اختصاصی هر تامین‌کننده (بدون ذخیره ابری)</button>' +
      (!isSent ? '<button type="button" class="bt" style="background:#059669;color:#fff;font-size:12.5px;font-weight:bold" onclick="rfqsMarkSentLive(\'' + ptfOnClickArg(no) + '\')">📤 ارسال به تامین‌کنندگان انجام شد (فعال‌سازی جدول ثبت قیمت)</button>' : '<span style="color:#059669;font-weight:bold">✅ ارسال‌شده (جدول مقایسه قیمت فعال است)</span>') +
      '</div>' + priceCompTable + '</div>';
  };

  window.rfqsHighlightFastest = function(no){
    try{
      var list=getData('ptf_crm_rfqsmart'); var r=list.filter(function(x){return x.no===no;})[0]; if(!r) return;
      var msg='سریع‌ترین تحویل per قلم:\n';
      (r.items||[]).forEach(function(it,i){
        var minD=Infinity, minSup='';
        Object.keys(it.quoteDelivery||{}).forEach(function(sc){
          var d=parseInt(it.quoteDelivery[sc],10)||0;
          if(d>0 && d<minD){ minD=d; var sup=(getData('ptf_crm_suppliers')||[]).filter(function(s){return s.cd===sc;})[0]; minSup=sup?sup.co:sc; }
        });
        if(minD!==Infinity) msg+=(i+1)+'. '+it.name+': '+minSup+' - '+minD+' روز\n';
      });
      alert(msg||'هنوز زمان تحویلی وارد نشده');
    }catch(e){ alert('خطا: '+e.message); }
  };
  window.rfqsSelectCheapest = function(no){
    try{
      var list=getData('ptf_crm_rfqsmart'); var r=list.filter(function(x){return x.no===no;})[0]; if(!r) return;
      var msg='ارزان‌ترین قیمت per قلم:\n';
      (r.items||[]).forEach(function(it,i){
        var minP=Infinity, minSup='';
        Object.keys(it.quotes||{}).forEach(function(sc){
          var p=+(it.quotes[sc]||0);
          if(p>0 && p<minP){ minP=p; var sup=(getData('ptf_crm_suppliers')||[]).filter(function(s){return s.cd===sc;})[0]; minSup=sup?sup.co:sc; }
        });
        if(minP!==Infinity) msg+=(i+1)+'. '+it.name+': '+minSup+' - '+minP.toLocaleString()+'\n';
      });
      alert(msg||'هنوز قیمتی وارد نشده');
    }catch(e){ alert('خطا: '+e.message); }
  };
  window.rfqsAssignSup = function(no, idx, supCd) {
    if (!supCd) return;
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    r.items[idx].assignedSups = r.items[idx].assignedSups || [];
    if (r.items[idx].assignedSups.indexOf(supCd) < 0) r.items[idx].assignedSups.push(supCd);
    setData('ptf_crm_rfqsmart', list);
    rfqsRenderAccordion(no);
  };

  window.rfqsRemoveSup = function(no, idx, supCd) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var arr = r.items[idx].assignedSups || [];
    var pos = arr.indexOf(supCd);
    if (pos > -1) arr.splice(pos, 1);
    setData('ptf_crm_rfqsmart', list);
    rfqsRenderAccordion(no);
  };

  window.rfqsGenDedicatedPdfs = function(no) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var sups = getData('ptf_crm_suppliers');
    var supItemsMap = {};
    (r.items || []).forEach(function(it) {
      (it.assignedSups || []).forEach(function(scd) {
        supItemsMap[scd] = supItemsMap[scd] || [];
        supItemsMap[scd].push(it);
      });
    });
    var keys = Object.keys(supItemsMap);
    if (!keys.length) { alert('ابتدا حداقل برای یک کالا، تامین‌کننده مشخص کنید.'); return; }
    keys.forEach(function(scd) {
      var sObj = sups.filter(function(x){ return x.cd === scd; })[0] || { co: scd };
      var items = supItemsMap[scd];
      var tbody = items.map(function(it, i){ return '<tr><td>' + (i+1) + '</td><td><b>' + escP(it.name) + '</b></td><td dir="ltr">' + escP(it.spec||'—') + '</td><td>' + (it.qty||1) + '</td><td>' + escP(it.unit||'عدد') + '</td></tr>'; }).join('');
      var w = window.open('', '_blank');
      w.document.write('<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>' + escP(r.no + ' - ' + (sObj.co||sObj.nm)) + '</title><style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:right}th{background:#f1f5f9}</style></head><body>' +
        '<div style="text-align:center;border-bottom:2px solid #0e7490;padding-bottom:10px"><h2>شرکت پیشرو تجهیز فرتاک</h2><h3>استعلام قیمت خرید کالا — شماره: ' + escP(r.no) + '</h3></div>' +
        '<div style="margin-top:15px"><b>تامین‌کننده محترم: ' + escP(sObj.co||sObj.nm) + '</b><br>خواهشمند است قیمت پیشنهادی و زمان تحویل اقلام مشروحه زیر را اعلام فرمایید.</div>' +
        '<table><thead><tr><th>#</th><th>شرح کالا</th><th>مشخصات فنی</th><th>تعداد</th><th>واحد</th></tr></thead><tbody>' + tbody + '</tbody></table>' +
        '<script>setTimeout(function(){window.print()},600)<\/script></body></html>');
      w.document.close();
    });
    alert('✅ ' + keys.length + ' پنجره استعلام اختصاصی تامین‌کنندگان جهت چاپ/ذخیره PDF باز شد.');
  };

  window.rfqsMarkSentLive = function(no) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    r.st = 'sent';
    r.priceCompareActive = true;
    setData('ptf_crm_rfqsmart', list);
    if (r.srcRfq) {
      var rfqs = getData('ptf_crm_rfqs');
      var parent = rfqs.filter(function(x){ return x.cd === r.srcRfq || x.inqNo === r.srcRfq; })[0];
      if (parent) { parent.st = 'st2'; parent.stxt = '⏳ منتظر دریافت قیمت'; setData('ptf_crm_rfqs', rfqs); }
    }
    rfqsRenderAccordion(no);
    alert('🟢 وضعیت استعلام به «منتظر دریافت قیمت» تغییر کرد و جدول مقایسه قیمت‌های خرید فعال شد.');
  };

  /* v14.3 (US-373 ①): ورود قیمت بدون پرش فوکوس — oninput فقط داده را ذخیره می‌کند؛
     رندر مجدد (رنگ‌بندی ارزان/گران) به blur یا دکمه ثبت موکول شد. */
  /* v15.2 (US-385 ①): ارقام فارسی/عربی کیبورد → انگلیسی؛ قبلا regex فقط ارقام EN را نگه می‌داشت
     و «۱۲۳۴» به‌کل حذف می‌شد → «عددی ثبت نشده» */
  function rqsNum(val) {
    var s = String(val == null ? '' : val);
    if (typeof window.ptfToEnDigits === 'function') s = window.ptfToEnDigits(s);
    else {
      var FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
      s = s.replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
    }
    return +s.replace(/[^\d]/g, '') || 0;
  }
  window.rfqsUpdateDeliveryTime = function(no, idx, supCd, val){
    try {
      var list=getData('ptf_crm_rfqsmart'); var r=list.filter(function(x){return x.no===no;})[0]; if(!r) return;
      r.items[idx].quoteDelivery=r.items[idx].quoteDelivery||{};
      r.items[idx].quoteDelivery[supCd]=String(val||'').trim();
      setData('ptf_crm_rfqsmart', list);
    } catch(e){}
  };
  window.rfqsUpdatePriceCompare = function(no, idx, supCd, val) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r || !r.items[idx]) return;
    r.items[idx].quotes = r.items[idx].quotes || {};
    var p = rqsNum(val);
    r.items[idx].quotes[supCd] = p;

    // ذخیره کمترین قیمت در buyquotes برای راهنمای قیمت فروش (US-219)
    var minP = Infinity, bestSup = '';
    Object.keys(r.items[idx].quotes).forEach(function(sc) {
      var qp = r.items[idx].quotes[sc];
      if (qp > 0 && qp < minP) { minP = qp; bestSup = sc; }
    });
    if (minP < Infinity) {
      r.items[idx].bestBuyPrice = minP;
      r.items[idx].bestBuySup = bestSup;
    }
    setData('ptf_crm_rfqsmart', list); /* داده لحظه‌ای ذخیره — رفرش وسط کار = بدون از دست رفتن */
    window._rfqsCmpDirty = no; /* برای دکمه ثبت */
  };
  /* v15.6 (US-387 ②): ذخیره ارز قیمت‌های جدول مقایسه */
  window.rfqsSetQuoteCur = function (no, cur) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    r.quoteCur = cur;
    setData('ptf_crm_rfqsmart', list);
    if (typeof ptfToast === 'function') ptfToast('💱 ارز قیمت‌های خرید این استعلام: ' + cur, 'ok');
    rfqsRenderAccordion(no);
  };

  /* v14.3 (US-373): blur فیلد → رندر رنگ‌بندی (فوکوس دیگر داخل جدول نیست) */
  window.rfqsPriceBlur = function(no) {
    setTimeout(function () {
      var ae = document.activeElement;
      if (ae && ae.getAttribute && ae.getAttribute('data-rqsprice') === no) return; /* هنوز در جدول است */
      rfqsRenderAccordion(no);
    }, 120);
  };
  /* v14.3 (US-373 ②): دکمه «ثبت قیمت‌ها» — ذخیره قطعی + به‌روزرسانی قیمت مرجع کالا (US-335) */
  window.rfqsCommitPrices = function(no) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function(x){ return x.no === no; })[0];
    if (!r) return;
    var cnt = 0;
    (r.items || []).forEach(function (it) {
      Object.keys(it.quotes || {}).forEach(function (sc) { if (+it.quotes[sc] > 0) cnt++; });
    });
    if (!cnt) { alert('هنوز قیمتی در جدول وارد نشده است.'); return; }
    /* قیمت مرجع کالا: از قیمت‌های جدول مقایسه (per-item) — دقیق‌تر از مسیر پاسخ کلی
       v15.2 (US-385 ②): ریشه «به جایی ارسال نمی‌شود» — تطبیق exact بود (x.nm === nm)؛
       کوچک‌ترین تفاوت فاصله/نیم‌فاصله/ارقام فا-EN = هیچ کالایی پیدا نمی‌شد و قیمت بی‌صدا گم می‌شد.
       حالا: تطبیق نرمال‌شده (dedupNorm) + ثبت خودکار کالاهای یافت‌نشده با تایید کاربر (هم‌راستا US-381). */
    var prods = getData('ptf_crm_products');
    var updated = 0, missing = [], ambiguous = [];
    (r.items || []).forEach(function (it) {
      var ps = Object.keys(it.quotes || {}).map(function (sc) { return +it.quotes[sc] || 0; }).filter(function (x) { return x > 0; });
      if (!ps.length) return;
      var avg = ps.reduce(function (a, b) { return a + b; }, 0) / ps.length;
      var nm = (it.name || it.nm || '').trim();
      if (!nm) return;
      /* BUG-PROC-LINK-287: duplicate product names are never resolved by first result. */
      var productMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false, reason:'resolver' };
      if (!productMatch.ok) {
        if (productMatch.reason === 'ambiguous') ambiguous.push({ it: it, avg: avg, n: ps.length });
        else missing.push({ it: it, avg: avg, n: ps.length });
        return;
      }
      var pd = productMatch.item;
      pd.pr = Math.round(avg);
      pd.prCur = r.quoteCur || 'IRR'; /* v15.6 US-387 ③: ارز قیمت مرجع */
      pd.refPriceAt = faDate();
      pd.refPriceSrc = 'جدول مقایسه ' + (r.no || '') + ' — میانگین ' + ps.length + ' قیمت (' + (r.quoteCur || 'IRR') + ')';
      updated++;
    });
    /* کالاهای یافت‌نشده → با تایید کاربر در ماژول کالا ثبت می‌شوند (قیمت به هیچ‌جا گم نمی‌شود) */
    var added = 0;
    if (missing.length && confirm('📦 ' + missing.length + ' قلم این جدول در ماژول کالا وجود ندارد:\n' +
        missing.slice(0, 6).map(function (m) { return '• ' + (m.it.name || ''); }).join('\n') + (missing.length > 6 ? '\n…' : '') +
        '\n\nهمین حالا با قیمت مرجعِ ثبت‌شده به ماژول کالا اضافه شوند؟ (توصیه می‌شود)')) {
      missing.forEach(function (m) {
        var cd2 = (window.ptfUnifiedCode ? window.ptfUnifiedCode('PROD') : 'P-' + (1001 + prods.length));
        prods.push({ cd: cd2, nm: m.it.name || '', en: '', ca: (typeof ptfNormCat === 'function' && m.it.tp ? ptfNormCat(m.it.tp) : 'سایر'), st: m.it.spec || '', br: m.it.brand || '', md: m.it.model || '', un: m.it.unit || 'عدد',
          pr: Math.round(m.avg), prCur: r.quoteCur || 'IRR', refPriceAt: faDate(), refPriceSrc: 'جدول مقایسه ' + (r.no || '') + ' — میانگین ' + m.n + ' قیمت (' + (r.quoteCur || 'IRR') + ')',
          ds: 'ثبت خودکار از جدول مقایسه قیمت (US-385)', ts: new Date().toISOString(), ts0: new Date().toISOString() });
        added++;
      });
    }
    if (updated || added) setData('ptf_crm_products', prods);
    r.pricesCommittedAt = faDateTime();
    r.pricesCommittedBy = curSession().name;
    r.referenceAmbiguousCount = ambiguous.length;
    setData('ptf_crm_rfqsmart', list);
    window._rfqsCmpDirty = null;
    audit('استعلام هوشمند', 'ثبت قیمت‌های جدول مقایسه ' + no + ' (' + cnt + ' قیمت' + (updated ? '، مرجع ' + updated + ' کالا به‌روز' : '') + (added ? '، ' + added + ' کالای جدید ثبت' : '') + (ambiguous.length ? '، ' + ambiguous.length + ' تطبیق مبهم بدون تغییر' : '') + ')', no);
    if (typeof ptfToast === 'function') ptfToast('💾 ' + cnt + ' قیمت ثبت شد' + (updated ? ' — قیمت مرجع ' + updated + ' کالا به‌روزرسانی شد 💰' : '') + (added ? ' — ' + added + ' کالای جدید با قیمت مرجع به ماژول کالا اضافه شد 📦' : '') + (ambiguous.length ? ' — ⚠️ ' + ambiguous.length + ' قلم مبهم بود و مرجع آن‌ها تغییر نکرد' : ''), ambiguous.length ? 'warn' : 'ok');
    rfqsRenderAccordion(no);
  };

  /* ============ گام ۱: منبع اقلام ============ */
  window.rfqsNew = function () {
    _st = { no: rfqsSerial(), items: [], targets: [], st: 'draft', t: faDateTime(), by: curSession().name, deadline: '', srcRfq: '' };
    var rfqs = getData('ptf_crm_rfqs');
    var rfqOpts = '<option value="">— بدون اتصال —</option>' + rfqs.slice(0, 40).map(function (r) {
      return '<option value="' + escP(r.cd) + '">' + escP(r.cd) + ' — ' + escP(r.co) + '</option>';
    }).join('');
    var iq = getData('ptf_crm_inqitems');
    var inqNos = {};
    iq.forEach(function (x) { inqNos[x.inqNo] = (inqNos[x.inqNo] || 0) + 1; });
    var inqOpts = Object.keys(inqNos).map(function (k) { return '<option value="' + escP(k) + '">' + escP(k) + ' (' + inqNos[k] + ' قلم)</option>'; }).join('');

    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:640px">' +
      '<h3>🛒 درخواست تامین — گام ۱: اقلام از کجا بیایند؟</h3>' +
      '<div class="fld"><label>اتصال به درخواست مشتری (اختیاری — برای رهگیری)</label><select id="rqsSrc" onchange="rfqsSyncSrcInqUI()">' + rfqOpts + '</select></div>' +
      '<div style="display:grid;gap:8px;margin:10px 0">' +
      '<button class="bt bt-o" style="text-align:right;padding:12px" onclick="rfqsFromFile()">📎 <b>خواندن از فایل پیوست</b> — اکسل/CSV مستقیم خوانده می‌شود؛ PDF و عکس به بازبینی سریع می‌رود<input type="file" id="rqsFile" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.zip" style="display:none" onchange="rfqsHandleFile(this)"></button>' +
      (inqOpts ? '<div style="display:flex;gap:6px;align-items:center"><select id="rqsInq" style="flex:1;padding:9px;border:1px solid var(--brd);border-radius:10px">' + inqOpts + '</select><button class="bt bt-o" onclick="rfqsFromInq()">📥 از اقلام درخواست‌ها</button></div>' : '') +
      '<button class="bt bt-o" style="text-align:right;padding:12px" onclick="rfqsManual()">✍️ <b>ورود دستی اقلام</b> — فرم سریع چندردیفی</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    try { if (typeof rfqsSyncSrcInqUI === 'function') rfqsSyncSrcInqUI(); } catch (e0) {}
  };

  /* v21.9 US-454: همگام‌سازی rqsSrc (اتصال درخواست) با rqsInq (اقلام) + قفل */
  window.rfqsSyncSrcInqUI = function () {
    var src = document.getElementById('rqsSrc');
    var inq = document.getElementById('rqsInq');
    if (!src) return;
    var v = src.value || '';
    if (_st) _st.srcRfq = v;
    if (!inq) return;
    if (!v) {
      inq.disabled = false;
      inq.style.background = '';
      inq.title = '';
      return;
    }
    /* اگر value دقیق نبود، با alias پیدا کن */
    var opts = inq.options || [];
    var found = false;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value === v) { found = true; break; }
    }
    if (!found) {
      try {
        var aliases = (typeof ptfInqAliases === 'function') ? ptfInqAliases(v) : [v];
        for (var j = 0; j < opts.length && !found; j++) {
          if (aliases.indexOf(opts[j].value) > -1) { v = opts[j].value; found = true; }
        }
        /* اگر اقلام با cd/inqNo دیگری است، option موقت */
        if (!found) {
          var nItems = 0;
          try {
            aliases.forEach(function (a) {
              nItems += getData('ptf_crm_inqitems').filter(function (x) { return x.inqNo === a; }).length;
            });
          } catch (eN) {}
          var opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v + (nItems ? (' (' + nItems + ' قلم)') : ' (از اتصال درخواست)');
          inq.insertBefore(opt, inq.firstChild ? inq.firstChild.nextSibling : null);
        }
      } catch (eA) {}
    }
    inq.value = v;
    inq.disabled = true;
    inq.style.background = '#f1f5f9';
    inq.title = 'قفل‌شده بر اساس «اتصال به درخواست مشتری» — برای تغییر، اتصال بالا را عوض کنید';
  };

  window.rfqsFromFile = function () { document.getElementById('rqsFile').click(); };

  window.rfqsHandleFile = function (inp) {
    var f = inp.files[0];
    if (!f) return;
    _st.srcRfq = (document.getElementById('rqsSrc') || { value: '' }).value;
    var name = f.name.toLowerCase();
    if (/\.(xlsx|xls|csv)$/.test(name)) {
      // AC1: اکسل/CSV — خواندن مستقیم با تشخیص ستون
      var rd = new FileReader();
      rd.onload = function () {
        var rows = [];
        try {
          if (/\.csv$/.test(name)) {
            rows = String(rd.result).replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); })
              .map(function (l) { return l.split(',').map(function (c) { return c.replace(/^"|"$/g, '').trim(); }); });
          } else {
            var wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' });
            rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' })
              .map(function (r) { return r.map(function (c) { return String(c == null ? '' : c).trim(); }); });
          }
        } catch (e) { alert('خطا در خواندن فایل: ' + e.message); return; }
        _st.items = rfqsParseRows(rows);
        hideModal();
        rfqsReviewItems();
      };
      if (/\.csv$/.test(name)) rd.readAsText(f, 'utf-8'); else rd.readAsArrayBuffer(f);
    } else {
      // AC1: PDF/عکس/zip — بدون کلید LLM → صف بازبینی دستی با فرم سریع
      hideModal();
      alert('📄 این نوع فایل (PDF/عکس) نیاز به خواندن ماشینی دارد.\n\n' +
        'تا فعال‌سازی کلید هوش مصنوعی تصویری، فایل را باز کنید و اقلام را در «فرم سریع» وارد نمایید — فایل هم به‌عنوان پیوست مرجع در استعلام ذخیره می‌شود.');
      if (typeof uploadFile === 'function') {
        uploadFile(f, 'rfqsmart', function (res) {
          if (res && res.ok && res.key) _st.attach = { name: res.name, key: res.key };
          else alert('⚠️ فایل روی فضای ابری ذخیره نشد و به استعلام افزوده نشد: ' + ((res || {}).error || 'خطای نامشخص'));
        });
      }
      rfqsManual();
    }
    inp.value = '';
  };

  // تشخیص ستون‌ها (موتور US-124 بهبود یافته)
  window.rfqsParseRows = function (rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (c) { return String(c).toLowerCase(); });
    function find(keys) {
      for (var i = 0; i < head.length; i++) for (var j = 0; j < keys.length; j++)
        if (head[i].indexOf(keys[j]) > -1) return i;
      return -1;
    }
    var map = {
      name: find(['شرح', 'نام', 'کالا', 'item', 'desc', 'name', 'material']),
      spec: find(['مشخصات', 'استاندارد', 'spec', 'standard', 'grade', 'سایز', 'size']),
      qty: find(['تعداد', 'مقدار', 'qty', 'quantity', 'q\'ty']),
      unit: find(['واحد', 'unit', 'uom'])
    };
    var hasHeader = map.name > -1 || map.qty > -1;
    var body = hasHeader ? rows.slice(1) : rows;
    if (!hasHeader) map = { name: 0, spec: 1, qty: 2, unit: 3 };
    var items = [];
    body.forEach(function (r) {
      var nm = map.name > -1 ? (r[map.name] || '') : (r[0] || '');
      if (!String(nm).trim()) return;
      items.push({
        name: String(nm).trim(),
        spec: map.spec > -1 ? String(r[map.spec] || '').trim() : '',
        qty: map.qty > -1 ? (+String(r[map.qty]).replace(/[^\d.]/g, '') || 1) : 1,
        unit: map.unit > -1 ? (String(r[map.unit] || '').trim() || 'عدد') : 'عدد'
      });
    });
    return items;
  };

  window.rfqsFromInq = function () {
    var srcEl = document.getElementById('rqsSrc');
    var inqEl = document.getElementById('rqsInq');
    var src = (srcEl || { value: '' }).value || '';
    var no = (inqEl || { value: '' }).value || '';
    /* اگر اتصال بالا انتخاب شده، همان مبناست (حتی اگر inq قفل/همگام باشد) */
    if (src) no = src;
    if (!no) { alert('ابتدا درخواست را از منوی اتصال یا فهرست اقلام انتخاب کنید'); return; }
    _st.srcRfq = src || no;
    if (srcEl && !_st.srcRfq) { /* no-op */ }
    if (srcEl && src) srcEl.value = src;
    /* اقلام با همه aliasهای شماره درخواست */
    var aliases = (typeof ptfInqAliases === 'function') ? ptfInqAliases(no) : [no];
    _st.items = getData('ptf_crm_inqitems').filter(function (x) { return aliases.indexOf(x.inqNo) > -1; })
      .map(function (x) { return { name: x.en || x.nm, spec: x.st || '', qty: x.qty || 1, unit: x.un || 'عدد', brand: x.br || '', model: x.md || '', pcode: x.cd || '' }; });
    hideModal();
    rfqsReviewItems();
  };

  window.rfqsManual = function () {
    _st.srcRfq = _st.srcRfq || (document.getElementById('rqsSrc') || { value: '' }).value;
    if (!_st.items.length) _st.items = [{ name: '', spec: '', qty: 1, unit: 'عدد' }];
    var mds = document.querySelectorAll('.md-b');
    for (var _mi = mds.length - 1; _mi >= 0; _mi--) { if ((mds[_mi].style || {}).display !== 'none') { mds[_mi].remove(); break; } } /* v16.2 BUG-017 */
    rfqsReviewItems();
  };

  /* ============ گام ۲: بازبینی اقلام (AC2/AC7 — اکسل پاک) ============ */
  window.rfqsReviewItems = function () {
    var srcLb = _st.srcRfq || '';
    var srcCo = '';
    try {
      if (srcLb) {
        var pr = getData('ptf_crm_rfqs').filter(function (x) { return x.cd === srcLb || x.inqNo === srcLb; })[0];
        if (pr) srcCo = pr.co || '';
      }
    } catch (eS) {}
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this&&confirm(\'بستن بدون ذخیره؟\'))this.remove()"><div class="md" style="max-width:780px;max-height:92vh;overflow:auto">' +
      '<h3>🤖 گام ۲: بازبینی اقلام <small style="color:#94a3b8">(' + escP(_st.no) + ')</small></h3>' +
      (srcLb
        ? ('<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#0c4a6e;margin-bottom:8px">' +
          '🔗 درخواست متصل (قفل): <b dir="ltr">' + escP(srcLb) + '</b>' + (srcCo ? ' — ' + escP(srcCo) : '') +
          ' <small style="color:#64748b">| اقلام درخواست + اقلام اضافی از ماژول کالا مجاز است</small></div>')
        : '') +
      '<div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:8px 12px;font-size:12px;color:#854d0e;margin-bottom:8px">' +
      '🔒 محرمانگی: در فرم و اکسل ارسالی به تامین‌کننده فقط شرح/مشخصات/تعداد/واحد می‌رود — <b>هیچ نام یا اطلاعاتی از کارفرما درج نمی‌شود.</b></div>' +
      '<div id="rqsItemsWrap"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
      '<button type="button" class="bt bt-o" style="font-size:12px" onclick="rfqsAddRow()">+ ردیف دستی</button>' +
      '<button type="button" class="bt bt-o" style="font-size:12px;color:#059669;border-color:#a7f3d0" onclick="rfqsOpenProductPicker()">📦 افزودن از ماژول کالا</button>' +
      '</div>' +
      '<div class="fr" style="margin-top:12px"><div class="fld"><label>مهلت پاسخ تامین‌کننده</label><select id="rqsDl"><option value="24 ساعت">۲۴ ساعت</option><option value="48 ساعت" selected>۴۸ ساعت</option><option value="72 ساعت">۷۲ ساعت</option><option value="1 هفته">۱ هفته</option></select></div><div class="fld"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="bt bt-o" onclick="if(confirm(\'انصراف؟\'))this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" onclick="rfqsToTargets()">ادامه: انتخاب تامین‌کنندگان ←</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    rfqsRenderRows();
  };

  window.rfqsRenderRows = function () {
    var el = document.getElementById('rqsItemsWrap');
    if (!el) return;
    var h = '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead style="background:#f1f5f9"><tr><th>#</th><th style="min-width:180px">شرح کالا</th><th style="min-width:90px">مدل</th><th style="min-width:140px">مشخصات فنی</th><th>تعداد</th><th>واحد</th><th></th></tr></thead><tbody>';
    _st.items.forEach(function (it, i) {
      h += '<tr><td>' + (i + 1) + '</td>' +
        '<td><input type="text" value="' + escP(it.name) + '" oninput="_stU(' + i + ',\'name\',this.value)" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px"></td>' +
        '<td><input type="text" value="' + escP(it.model || '') + '" oninput="_stU(' + i + ',\'model\',this.value)" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px;direction:ltr"></td>' + /* v31.7.20 BUG-RFQS-MODEL-001 */
        '<td><input type="text" value="' + escP(it.spec) + '" oninput="_stU(' + i + ',\'spec\',this.value)" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px;direction:ltr"></td>' +
        '<td><input type="number" value="' + (it.qty || 1) + '" oninput="_stU(' + i + ',\'qty\',this.value)" style="width:64px;padding:5px;border:1px solid var(--brd);border-radius:6px"></td>' +
        '<td><input type="text" value="' + escP(it.unit) + '" oninput="_stU(' + i + ',\'unit\',this.value)" style="width:64px;padding:5px;border:1px solid var(--brd);border-radius:6px"></td>' +
        '<td><button type="button" onclick="rfqsDelRow(' + i + ')" style="border:0;background:none;color:#dc2626;cursor:pointer">✕</button></td></tr>';
    });
    el.innerHTML = h + '</tbody></table>';
  };
  window._stU = function (i, f, v) { _st.items[i][f] = f === 'qty' ? (+v || 1) : v; };
  window.rfqsAddRow = function () { _st.items.push({ name: '', spec: '', qty: 1, unit: 'عدد' }); rfqsRenderRows(); };
  window.rfqsDelRow = function (i) { _st.items.splice(i, 1); rfqsRenderRows(); };

  /* v21.9 US-454: افزودن از ماژول کالا به اقلام درخواست تامین */
  window.rfqsOpenProductPicker = function () {
    var prods = getData('ptf_crm_products');
    if (!prods.length) { alert('ابتدا در ماژول کالاها، کالا ثبت کنید.'); return; }
    var html = '<div class="md-b" id="rqsProdPick" style="display:grid;z-index:1900" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto" onclick="event.stopPropagation()">'
      + '<h3>📦 افزودن از ماژول کالا به درخواست تامین</h3>'
      + '<div style="font-size:12.5px;color:#475569;margin-bottom:10px">اقلام انتخابی <b>علاوه بر</b> اقلام درخواست به جدول گام ۲ اضافه می‌شوند.</div>'
      + '<input type="text" id="rqsPickSrch" placeholder="جستجو: کد، شرح، برند، دسته..." oninput="rfqsRenderProductPicker()" style="width:100%;padding:8px 12px;border:1.5px solid var(--brd);border-radius:10px;margin-bottom:10px;box-sizing:border-box">'
      + '<div class="tb2" style="max-height:360px;overflow:auto"><table><thead><tr><th style="width:34px">#</th><th>کد</th><th>شرح</th><th>دسته</th><th>واحد</th></tr></thead><tbody id="rqsPickTb"></tbody></table></div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px;flex-wrap:wrap">'
      + '<span id="rqsPickCount" style="font-size:12px;color:#0e7490;font-weight:800">۰ کالا</span>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="bt bt-o" onclick="var m=document.getElementById(&quot;rqsProdPick&quot;);if(m)m.remove()">انصراف</button>'
      + '<button class="bt" style="background:#059669" onclick="rfqsInsertPickedProducts()">➕ درج در اقلام تامین</button>'
      + '</div></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    rfqsRenderProductPicker();
  };
  window.rfqsRenderProductPicker = function () {
    var tb = document.getElementById('rqsPickTb');
    if (!tb) return;
    var q = ((document.getElementById('rqsPickSrch') || {}).value || '').trim().toLowerCase();
    var prods = getData('ptf_crm_products') || [];
    var list = prods.filter(function (p) {
      if (!q) return true;
      if (typeof ptfProdSearchMatch === 'function') return ptfProdSearchMatch(p, q);
      return ((p.cd || '') + ' ' + (p.nm || '') + ' ' + (p.en || '') + ' ' + (p.br || '') + ' ' + (p.ca || '') + ' ' + (p.st || '')).toLowerCase().indexOf(q) > -1;
    });
    tb.innerHTML = list.map(function (p) {
      return '<tr><td><input type="checkbox" class="rqs-pick-chk" value="' + escP(p.cd || '') + '" onchange="rfqsUpdatePickCount()"></td>'
        + '<td dir="ltr"><b style="color:#7c3aed">' + escP(p.cd || '') + '</b></td>'
        + '<td>' + escP(p.nm || '') + (p.st ? (' <small style="color:#64748b">[' + escP(p.st) + ']</small>') : '') + '</td>'
        + '<td>' + escP(p.ca || '-') + '</td><td>' + escP(p.un || 'عدد') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">کالایی یافت نشد</td></tr>';
    rfqsUpdatePickCount();
  };
  window.rfqsUpdatePickCount = function () {
    var n = document.querySelectorAll('.rqs-pick-chk:checked').length;
    var el = document.getElementById('rqsPickCount');
    if (el) el.textContent = n + ' کالا انتخاب شده';
  };
  window.rfqsInsertPickedProducts = function () {
    if (!_st) return;
    var cds = [];
    document.querySelectorAll('.rqs-pick-chk:checked').forEach(function (ch) { if (ch.value) cds.push(ch.value); });
    if (!cds.length) { alert('حداقل یک کالا را انتخاب کنید'); return; }
    var prods = getData('ptf_crm_products') || [];
    var added = 0;
    cds.forEach(function (cd) {
      var p = prods.filter(function (x) { return x.cd === cd; })[0];
      if (!p) return;
      _st.items = _st.items || [];
      _st.items.push({
        name: p.nm || p.en || cd,
        spec: p.st || p.ds || '',
        qty: 1,
        unit: p.un || 'عدد',
        brand: p.br || '',
        model: p.md || '',
        pcode: p.cd || '',
        fromCatalog: true
      });
      added++;
    });
    var m = document.getElementById('rqsProdPick');
    if (m) m.remove();
    rfqsRenderRows();
    if (typeof ptfToast === 'function') ptfToast('✅ ' + added + ' کالا از ماژول کالا به اقلام تامین اضافه شد', 'ok');
  };

  /* ============ گام ۳: پیشنهادگر تامین‌کننده (AC3) ============ */
  window.rfqsScoreSuppliers = function (items) {
    var sups = getData('ptf_crm_suppliers');
    var bq = getData('ptf_crm_buyquotes');
    var allText = items.map(function (i) { return i.name + ' ' + i.spec; }).join(' ');
    var cat = detectCat(allText);
    return sups.map(function (s) {
      var score = 0, why = [];
      // تطبیق دسته
      if (cat && (s.ca || '').indexOf(cat) > -1) { score += 40; why.push('دسته منطبق: ' + cat); }
      else if (cat && detectCat(s.ca || '') === cat) { score += 30; why.push('دسته مشابه'); }
      // تطبیق برند/کلمات کلیدی
      var kw = (s.brands || s.ca || '').toLowerCase();
      var hits = 0;
      items.forEach(function (i) {
        String(i.name + ' ' + i.spec).toLowerCase().split(/[\s,،/]+/).forEach(function (w) {
          if (w.length > 2 && kw.indexOf(w) > -1) hits++;
        });
      });
      if (hits) { score += Math.min(25, hits * 5); why.push(hits + ' واژه منطبق'); }
      /* v16.5 (US-399 AC3): امتیاز تخصصی — برند (وزن بالا) > تجهیز (متوسط) > سابقه خرید موفق.
         تامین‌کننده بدون تخصص فقط از مسیرهای قبلی امتیاز می‌گیرد (AC5 — هیچ رفتاری نمی‌شکند) */
      if (typeof ptfSupSpecScore === 'function') {
        var sp = ptfSupSpecScore(s, items);
        if (sp.score) { score += sp.score; why = why.concat(sp.why); }
      }
      /* v16.6 (US-400): بونوس امتیاز وندور + ضریب اعتباردهی غیرنقدی (ابلاغ کارفرما) */
      if (typeof ptfSupScoreBonus === 'function') {
        var sb = ptfSupScoreBonus(s);
        if (sb.bonus) { score += sb.bonus; why.push(sb.why); }
      }
      // سابقه قیمت‌دهی
      var quotes = bq.filter(function (b) { return (b.sup || '') === s.co; }).length;
      if (quotes) { score += Math.min(25, quotes * 5); why.push(quotes + ' سابقه قیمت‌دهی'); }
      // تاییدشده از سایت
      if (s.src === 'site' && s.approvedBy) { score += 5; why.push('تاییدشده'); }
      // اطلاعات تماس کامل
      if (s.email || s.ph) score += 5;
      return { cd: s.cd, co: s.co, ph: s.ph || '', email: s.email || '', ca: s.ca || '', score: score, why: why.join('، ') || 'بدون سیگنال خاص' };
    }).sort(function (a, b) { return b.score - a.score; });
  };


  /* v21.7 US-452 / US-HT-v214-2: تامین‌کنندگان اخیر همین درخواست (srcRfq) */
  window.ptfRfqsRecentSuppliers = function (srcRfq, excludeNo) {
    if (!srcRfq) return [];
    var aliases = [srcRfq];
    try {
      if (typeof ptfInqAliases === 'function') aliases = ptfInqAliases(srcRfq);
      else {
        (getData('ptf_crm_rfqs') || []).forEach(function (r) {
          if (r.cd === srcRfq || r.inqNo === srcRfq) {
            if (r.cd && aliases.indexOf(r.cd) < 0) aliases.push(r.cd);
            if (r.inqNo && aliases.indexOf(r.inqNo) < 0) aliases.push(r.inqNo);
          }
        });
      }
    } catch (eA) {}
    function hitSrc(v) { return v && aliases.indexOf(v) > -1; }
    var map = {};
    function add(cd, co, ph, email, t, extraWhy) {
      if (!cd && !co) return;
      var key = cd || ('co:' + String(co || '').toLowerCase());
      if (!map[key]) {
        map[key] = { cd: cd || '', co: co || '', ph: ph || '', email: email || '', times: 0, lastAt: '', why: '' };
      }
      var row = map[key];
      row.times++;
      if (co && !row.co) row.co = co;
      if (ph && !row.ph) row.ph = ph;
      if (email && !row.email) row.email = email;
      if (cd && !row.cd) row.cd = cd;
      var ts = String(t || '');
      if (!row.lastAt || ts > row.lastAt) row.lastAt = ts;
      row.why = '🕒 اخیر این درخواست ×' + row.times + (extraWhy ? ' — ' + extraWhy : '');
    }
    try {
      (getData('ptf_crm_rfqsmart') || []).forEach(function (r) {
        if (!r || (excludeNo && r.no === excludeNo)) return;
        if (!hitSrc(r.srcRfq)) return;
        (r.targets || []).forEach(function (tg) {
          add(tg.cd, tg.co, tg.ph, tg.email, r.t || r.deadline || '', tg.st === 'replied' ? 'پاسخ‌داده' : '');
        });
      });
    } catch (e1) {}
    try {
      (getData('ptf_crm_buycmp') || []).forEach(function (c) {
        if (!c || !hitSrc(c.inqNo)) return;
        (c.purchases || c.items || []).forEach(function (p) {
          if (!p) return;
          add(p.supCd || p.cd || '', p.sup || p.supName || p.co || '', p.ph || '', p.email || '', p.t || c.t || '', 'خرید واقعی');
        });
        /* sometimes supplier on round quotes */
        (c.rounds || []).forEach(function (rd) {
          (rd.quotes || rd.rows || []).forEach(function (q) {
            if (q && (q.sup || q.co)) add(q.supCd || q.cd || '', q.sup || q.co, q.ph || '', q.email || '', c.t || '', 'مقایسه قیمت');
          });
        });
      });
    } catch (e2) {}
    /* enrich from suppliers master */
    try {
      var sups = getData('ptf_crm_suppliers') || [];
      Object.keys(map).forEach(function (k) {
        var row = map[k];
        var s = null;
        if (row.cd) s = sups.filter(function (x) { return x.cd === row.cd; })[0];
        if (!s && row.co) {
          s = sups.filter(function (x) {
            return x.co === row.co || (typeof dedupNorm === 'function' && dedupNorm(x.co) === dedupNorm(row.co));
          })[0];
        }
        if (s) {
          row.cd = s.cd || row.cd;
          row.co = s.co || row.co;
          row.ph = row.ph || s.ph || '';
          row.email = row.email || s.email || '';
        }
      });
    } catch (e3) {}
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (r) { return r.cd || r.co; })
      .sort(function (a, b) {
        if (b.times !== a.times) return b.times - a.times;
        return String(b.lastAt || '').localeCompare(String(a.lastAt || ''));
      })
      .slice(0, 12);
  };

  /* v21.2 US-402: فیلتر زنده + چیپ انتخاب + گروه‌بندی پیشنهاد/سایر */
  window.rfqsMatchSup = function (row, q) {
    if (!q) return true;
    q = String(q).trim();
    if (!q) return true;
    var blob = (row.co || '') + ' ' + (row.ca || '') + ' ' + (row.why || '') + ' ' + (row.email || '') + ' ' + (row.ph || '');
    var qCanon = (typeof ptfBrandCanon === 'function') ? ptfBrandCanon(q) : q;
    try {
      var full = (getData('ptf_crm_suppliers') || []).filter(function (s) { return s.cd === row.cd; })[0];
      if (full) {
        if (typeof ptfSupSpecBlob === 'function') blob += ' ' + ptfSupSpecBlob(full);
        else blob += ' ' + (full.brands || '') + ' ' + ((full.spBrands || []).join(' ')) + ' ' + ((full.spEquip || []).join(' ')) + ' ' + (full.coEn || '');
        if (typeof entityMatches === 'function' && entityMatches(full, q)) return true;
        if (typeof entityMatches === 'function' && qCanon && qCanon !== q && entityMatches(full, qCanon)) return true;
      }
    } catch (e) {}
    var nq = (typeof dedupNorm === 'function') ? dedupNorm(q) : q.toLowerCase();
    var nqc = (typeof dedupNorm === 'function') ? dedupNorm(qCanon) : String(qCanon || '').toLowerCase();
    var nb = (typeof dedupNorm === 'function') ? dedupNorm(blob) : blob.toLowerCase();
    return nb.indexOf(nq) > -1 || (nqc && nb.indexOf(nqc) > -1) || blob.toLowerCase().indexOf(q.toLowerCase()) > -1;
  };

  window.rfqsToTargets = function () {
    _st.items = _st.items.filter(function (i) { return i.name && i.name.trim(); });
    if (!_st.items.length) { alert('حداقل یک قلم لازم است'); return; }
    _st.deadline = (document.getElementById('rqsDl') || { value: '48 ساعت' }).value;
    var mds = document.querySelectorAll('.md-b');
    for (var _mi = mds.length - 1; _mi >= 0; _mi--) { if ((mds[_mi].style || {}).display !== 'none') { mds[_mi].remove(); break; } } /* v16.2 BUG-017 */

    var ranked = rfqsScoreSuppliers(_st.items);
    var top5 = {};
    ranked.slice(0, 5).forEach(function (r) { top5[r.cd] = true; });
    _st._ranked = ranked;
    _st._sel = top5;
    _st._tgQ = '';
    _st._tgOtherOpen = false;
    /* v21.7 US-452: اخیر همین درخواست — نمایش + پیش‌تیک (قابل تغییر) */
    var recent = [];
    try { recent = ptfRfqsRecentSuppliers(_st.srcRfq, _st.no) || []; } catch (eR) { recent = []; }
    _st._recent = recent;
    recent.forEach(function (r) {
      var key = r.cd || '';
      if (!key && r.co) {
        var hit = ranked.filter(function (x) { return x.co === r.co; })[0];
        if (hit) key = hit.cd;
      }
      if (key) _st._sel[key] = true;
    });

    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this&&confirm(\'بستن؟\'))this.remove()"><div class="md" style="max-width:760px;max-height:92vh;overflow:auto">' +
      '<h3>🤖 گام ۳: انتخاب تامین‌کنندگان</h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:8px">💡 ۵ پیشنهاد برتر خودکار تیک خورده‌اند و قابل تغییر هستند. جستجوی زنده دوزبانه + بخش «تامین‌کنندگان اخیر همین درخواست» (v21.7 US-452).</div>' +
      '<div id="rqsTgChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;min-height:8px"></div>' +
      '<input type="search" id="rqsTgQ" placeholder="🔍 جستجو: نام، برند، تجهیز، زمینه… (زیمنس = Siemens)" ' +
      'oninput="_st._tgQ=this.value;rfqsRenderTargets()" style="width:100%;padding:10px 12px;border:1px solid var(--brd);border-radius:12px;font-size:13px;margin-bottom:10px;box-sizing:border-box">' +
      '<div id="rqsTgWrap" style="max-height:380px;overflow:auto"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="rfqsReviewItems();this.closest(\'.md-b\').remove()">→ بازگشت به اقلام</button>' +
      '<button class="bt" onclick="rfqsFinalize()">ثبت و رفتن به ارسال ←</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
    rfqsRenderTargets();
  };

  window.rfqsToggleSup = function (cd, on) {
    if (!_st._sel) _st._sel = {};
    _st._sel[cd] = !!on;
    rfqsRenderTargets();
  };

  window.rfqsSelectRecent = function (on) {
    if (!_st) return;
    _st._sel = _st._sel || {};
    (_st._recent || []).forEach(function (r) {
      var cd = r.cd;
      if (!cd && r.co && _st._ranked) {
        var hit = _st._ranked.filter(function (x) { return x.co === r.co; })[0];
        if (hit) cd = hit.cd;
      }
      if (cd) _st._sel[cd] = !!on;
    });
    rfqsRenderTargets();
  };

  window.rfqsRenderTargets = function () {
    var el = document.getElementById('rqsTgWrap');
    var chips = document.getElementById('rqsTgChips');
    if (!el) return;
    var ranked = _st._ranked || [];
    var q = _st._tgQ || '';
    var filtered = ranked.filter(function (r) { return rfqsMatchSup(r, q); });
    var smart = filtered.filter(function (r, i) {
      /* top-5 by original rank index */
      var oi = ranked.indexOf(r);
      return oi > -1 && oi < 5;
    });
    var others = filtered.filter(function (r) {
      var oi = ranked.indexOf(r);
      return !(oi > -1 && oi < 5);
    });

    function rowHtml(r, badgeHtml, bg, bd) {
      var cd = r.cd || '';
      return '<label style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border:1px solid ' + (bd || 'var(--brd)') + ';border-radius:11px;margin-bottom:6px;cursor:pointer;background:' + (bg || 'var(--crd,#fff)') + '">' +
        '<input type="checkbox" ' + (_st._sel[cd] ? 'checked' : '') + ' onchange="rfqsToggleSup(\'' + ptfOnClickArg(cd) + '\',this.checked)" style="margin-top:3px"' + (cd ? '' : ' disabled') + '>' +
        '<span style="flex:1;min-width:0"><b style="font-size:13px">' + escP(r.co) + '</b> ' + (badgeHtml || '') +
        '<span style="display:block;font-size:11.5px;color:#64748b;margin-top:2px">' +
        (r.score != null ? ('امتیاز ' + r.score + ' — ') : '') + escP(r.why || '') +
        (r.email || r.ph ? ' | ' + (r.email ? '✉️ ' + escP(r.email) : '') + (r.ph ? ' 📱 ' + escP(r.ph) : '') : '') + '</span></span></label>';
    }

    /* recent rows aligned to ranked cds when possible */
    var recent = (_st._recent || []).map(function (r) {
      var hit = null;
      if (r.cd) hit = ranked.filter(function (x) { return x.cd === r.cd; })[0];
      if (!hit && r.co) hit = ranked.filter(function (x) { return x.co === r.co; })[0];
      return {
        cd: (hit && hit.cd) || r.cd || '',
        co: (hit && hit.co) || r.co,
        ph: r.ph || (hit && hit.ph) || '',
        email: r.email || (hit && hit.email) || '',
        score: hit ? hit.score : null,
        why: r.why || '🕒 اخیر این درخواست',
        times: r.times || 1
      };
    }).filter(function (r) { return rfqsMatchSup(r, q); });
    var recentCds = {};
    recent.forEach(function (r) { if (r.cd) recentCds[r.cd] = 1; });

    var h = '';
    if ((_st.srcRfq || recent.length) && !q) {
      h += '<div style="font-size:12.5px;font-weight:800;color:#0e7490;margin:4px 0 8px">🕒 تامین‌کنندگان اخیر همین درخواست (' + recent.length + ')' +
        (_st.srcRfq ? ' <small style="font-weight:600;color:#64748b">— ' + escP(_st.srcRfq) + '</small>' : '') + '</div>';
      if (recent.length) {
        h += '<div style="margin-bottom:6px"><button type="button" class="bt bt-o" style="padding:3px 10px;font-size:11.5px;color:#0e7490" onclick="rfqsSelectRecent(true)">✅ انتخاب همه اخیر</button> ' +
          '<button type="button" class="bt bt-o" style="padding:3px 10px;font-size:11.5px" onclick="rfqsSelectRecent(false)">پاک کردن اخیر</button></div>';
        h += recent.map(function (r) {
          return rowHtml(r, '<span class="bd" style="background:#e0f2fe;color:#0369a1">×' + (r.times || 1) + '</span>', '#f0f9ff', '#7dd3fc');
        }).join('');
      } else {
        h += '<div style="color:#94a3b8;font-size:12px;padding:6px 0;margin-bottom:8px">برای این درخواست سابقه تامین‌کننده ثبت نشده (اولین استعلام)</div>';
      }
    } else if (q && recent.length) {
      h += '<div style="font-size:12.5px;font-weight:800;color:#0e7490;margin:4px 0 8px">🕒 اخیر (فیلتر شده: ' + recent.length + ')</div>';
      h += recent.map(function (r) {
        return rowHtml(r, '<span class="bd" style="background:#e0f2fe;color:#0369a1">اخیر</span>', '#f0f9ff', '#7dd3fc');
      }).join('');
    }

    h += '<div style="font-size:12.5px;font-weight:800;color:#b45309;margin:4px 0 8px">⭐ پیشنهاد هوشمند (' + smart.length + ')</div>';
    h += smart.map(function (r) {
      var oi = ranked.indexOf(r);
      var badge = ' <span class="bd" style="background:#fef3c7;color:#b45309">پیشنهاد ' + (oi + 1) + '</span>' +
        (recentCds[r.cd] ? ' <span class="bd" style="background:#e0f2fe;color:#0369a1">اخیر</span>' : '');
      return rowHtml(r, badge, '#fff7ed', '#fdba74');
    }).join('') || '<div style="color:#94a3b8;font-size:12px;padding:6px 0">موردی در پیشنهادها با این جستجو نیست</div>';
    h += '<div style="margin:12px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<span style="font-size:12.5px;font-weight:800;color:#475569">سایر تامین‌کنندگان (' + others.length + ')</span>' +
      '<button type="button" class="bt bt-o" style="padding:3px 10px;font-size:11.5px" onclick="_st._tgOtherOpen=!_st._tgOtherOpen;rfqsRenderTargets()">' +
      (_st._tgOtherOpen ? '▲ جمع کردن' : '▼ نمایش') + '</button></div>';
    if (_st._tgOtherOpen || q) {
      h += others.map(function (r) { return rowHtml(r, recentCds[r.cd] ? '<span class="bd" style="background:#e0f2fe;color:#0369a1">اخیر</span>' : '', 'var(--crd,#fff)', 'var(--brd)'); }).join('') || '<div style="color:#94a3b8;font-size:12px;padding:6px 0">موردی نیست</div>';
    } else {
      h += '<div style="color:#94a3b8;font-size:11.5px;padding:4px 0">برای دیدن بقیه فهرست، «نمایش» را بزنید یا جستجو کنید</div>';
    }
    if (!ranked.length) h = '<div style="color:#94a3b8;text-align:center;padding:16px">تامین‌کننده‌ای ثبت نشده — ابتدا در ماژول تامین‌کنندگان اضافه کنید</div>';
    el.innerHTML = h;

    if (chips) {
      var selRows = ranked.filter(function (r) { return _st._sel[r.cd]; });
      chips.innerHTML = selRows.length
        ? selRows.map(function (r) {
            return '<span style="display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;border:1px solid #bbf7d0;color:#065f46;border-radius:999px;padding:4px 10px;font-size:12px">' +
              escP(r.co) +
              ' <button type="button" onclick="rfqsToggleSup(\'' + ptfOnClickArg(r.cd) + '\',false)" style="border:0;background:transparent;color:#b91c1c;cursor:pointer;font-weight:900;padding:0 2px" title="حذف">✕</button></span>';
          }).join('')
        : '<span style="font-size:11.5px;color:#94a3b8">هنوز تامین‌کننده‌ای انتخاب نشده</span>';
    }
  };

  window.rfqsFinalize = function () {
    var targets = _st._ranked.filter(function (r) { return _st._sel[r.cd]; })
      .map(function (r) { return { cd: r.cd, co: r.co, ph: r.ph, email: r.email, st: 'pending', sends: [] }; });
    if (!targets.length) { alert('حداقل یک تامین‌کننده انتخاب کنید'); return; }
    _st.targets = targets;
    /* v16.5 (US-399 AC4): یادگیری از اصلاح کاربر — انتخاب دستی خارج از پیشنهاد برند → افزودن تخصص با تایید */
    if (typeof ptfSupSpecLearn === 'function') { try { ptfSupSpecLearn(_st.items, targets, _st._ranked); } catch (eL) {} }
    delete _st._ranked; delete _st._sel;
    var list = getData('ptf_crm_rfqsmart');
    var idx = -1;
    list.forEach(function (x, i) { if (x.no === _st.no) idx = i; });
    if (idx === -1 && _st.srcRfq) {
      var exist = list.filter(function(x){ return x.srcRfq === _st.srcRfq; })[0];
      if (exist) {
        if (!confirm('⛔ برای درخواست کارفرما شماره «' + _st.srcRfq + '» قبلاً استعلام تامین شماره «' + exist.no + '» ثبت شده است.\n\nآیا مایل به ثبت به عنوان استعلام دوم هستید؟ (در غیر این صورت لغو کنید و همان استعلام قبلی را ویرایش کنید)')) {
          return;
        }
      }
    }
    if (idx > -1) list[idx] = _st; else list.unshift(_st);
    setData('ptf_crm_rfqsmart', list);
    audit('استعلام هوشمند', 'ثبت ' + _st.no + ' با ' + _st.items.length + ' قلم و ' + targets.length + ' تامین‌کننده', _st.no);
    var mds = document.querySelectorAll('.md-b');
    for (var _mi = mds.length - 1; _mi >= 0; _mi--) { if ((mds[_mi].style || {}).display !== 'none') { mds[_mi].remove(); break; } } /* v16.2 BUG-017 */
    renderRfqSmart();
    rfqsOpen(_st.no);
  };

  /* ============ گام ۴: کارت ارسال و رهگیری (AC5/AC6/AC7) ============ */
  window.rfqsOpen = function (no) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var itemsRows = (r.items || []).map(function (it, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + escP(it.name) + '</td><td style="direction:ltr">' + escP(it.spec || '—') + '</td><td>' + it.qty + '</td><td>' + escP(it.unit) + '</td></tr>';
    }).join('');
    var tgRows = (r.targets || []).map(function (t, i) {
      var stBadge = t.st === 'replied' ? '<span class="bd b-st4">✅ پاسخ داد</span>' : t.st === 'declined' ? '<span class="bd" style="background:#fee2e2;color:#b91c1c">✖ رد کرد</span>' : (t.sends || []).length ? '<span class="bd" style="background:#dbeafe;color:#1d4ed8">📤 ارسال شد</span>' : '<span class="bd" style="background:#f1f5f9;color:#64748b">⏳ در انتظار ارسال</span>';
      var waTxt = encodeURIComponent('با سلام،\nشرکت پیشرو تجهیز فرتاک\nاستعلام شماره ' + r.no + ' شامل ' + (r.items || []).length + ' قلم کالا خدمت شما ارسال می‌گردد. خواهشمند است ظرف ' + (r.deadline || '48 ساعت') + ' قیمت و زمان تحویل اعلام فرمایید.\n(فرم PDF مختص شما را از دکمه «🖨 PDF» کنار نامتان ذخیره و پیوست کنید)\nتلفن: 021-46087679');
      var mailBody = encodeURIComponent('با سلام\r\n\r\nاستعلام شماره ' + r.no + ' از شرکت پیشرو تجهیز فرتاک به پیوست (فرم PDF) خدمتتان ارسال می‌گردد.\r\nمهلت پاسخ: ' + (r.deadline || '48 ساعت') + '\r\n\r\nبا احترام\r\nPishro Tajhiz Fartak Co.\r\nTel: +98 21 4608 7679');
      return '<div style="border:1px solid var(--brd);border-radius:11px;padding:9px 12px;margin-bottom:6px">' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;align-items:center">' +
        '<span style="font-size:13px"><b>' + escP(t.co) + '</b> ' + stBadge +
        ((t.sends || []).length ? '<small style="color:#94a3b8"> | آخرین ارسال: ' + escP(t.sends[t.sends.length - 1].t) + ' (' + t.sends.map(function (s) { return s.ch; }).join('، ') + ')</small>' : '') + '</span>' +
        '<span style="display:flex;gap:4px;flex-wrap:wrap">' +
        (t.email ? '<a class="bt bt-o" style="padding:4px 9px;font-size:11.5px;text-decoration:none" href="mailto:' + escP(t.email) + '?subject=' + encodeURIComponent('استعلام ' + r.no + ' — پیشرو تجهیز فرتاک') + '&body=' + mailBody + '" onclick="rfqsMarkSend(\'' + ptfOnClickArg(r.no) + '\',' + i + ',\'email\')">✉️ ایمیل</a>' : '') +
        (t.ph ? '<a class="bt bt-o" style="padding:4px 9px;font-size:11.5px;text-decoration:none" target="_blank" href="https://wa.me/98' + escP(String(t.ph).replace(/\D/g, '').replace(/^0/, '')) + '?text=' + waTxt + '" onclick="rfqsMarkSend(\'' + ptfOnClickArg(r.no) + '\',' + i + ',\'whatsapp\')">💬 واتساپ</a>' : '') +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px;color:#0e7490" onclick="rfqsPrintPreview(\'' + ptfOnClickArg(r.no) + '\',' + i + ')" title="پیش‌نمایش/دانلود PDF افقی مختص این تامین‌کننده">🖨 PDF</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px;color:#059669" onclick="rfqsReply(\'' + ptfOnClickArg(r.no) + '\',' + i + ')">💰 ثبت پاسخ</button>' +
        '<button class="bt bt-o" style="padding:4px 9px;font-size:11.5px;color:#dc2626" onclick="rfqsDecline(\'' + ptfOnClickArg(r.no) + '\',' + i + ')">رد کرد</button>' +
        '</span></div></div>';
    }).join('');
    var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:820px;max-height:94vh;overflow:auto">' +
      '<h3>🤖 ' + escP(r.no) + ' <small style="color:#94a3b8">مهلت پاسخ: ' + escP(r.deadline || '—') + (r.srcRfq ? ' | درخواست: ' + escP(r.srcRfq) : '') + '</small></h3>' +
      '<h4 style="margin:10px 0 6px;font-size:13.5px">📦 اقلام (' + (r.items || []).length + ')</h4>' +
      '<div class="tb2"><table><thead><tr><th>#</th><th>شرح</th><th>مشخصات</th><th>تعداد</th><th>واحد</th></tr></thead><tbody>' + itemsRows + '</tbody></table></div>' +
      '<h4 style="margin:14px 0 6px;font-size:13.5px">🏭 تامین‌کنندگان و ارسال <small style="color:#94a3b8">(هیچ ارسالی خودکار نیست — با کلیک شما انجام می‌شود)</small></h4>' + tgRows +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">' +
      '<button class="bt bt-o" onclick="rfqsXls(\'' + ptfOnClickArg(r.no) + '\')">⬇️ اکسل پاک</button>' +
      '<button class="bt bt-o" onclick="rfqsPrintPreview(\'' + ptfOnClickArg(r.no) + '\',null)">🖨️ PDF عمومی (افقی)</button>' +
      '<button class="bt bt-o" style="color:#0e7490" onclick="rfqsPrintPickSupplier(\'' + ptfOnClickArg(r.no) + '\')">🖨 PDF اختصاصی تامین‌کننده</button>' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">بستن</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.rfqsMarkSend = function (no, ti, ch) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r || !r.targets[ti]) return;
    r.targets[ti].sends = r.targets[ti].sends || [];
    r.targets[ti].sends.push({ ch: ch, t: faDateTime(), by: curSession().name });
    r.st = 'sent';
    setData('ptf_crm_rfqsmart', list);
    audit('استعلام هوشمند', 'ارسال ' + ch + ' به ' + r.targets[ti].co, no);
    setTimeout(function () {
      var mds = document.querySelectorAll('.md-b');
      for (var _mj = mds.length - 1; _mj >= 0; _mj--) { if ((mds[_mj].style || {}).display !== 'none') { mds[_mj].remove(); break; } } rfqsOpen(no); /* v16.2 BUG-017 */
    }, 400);
  };

  // AC6: ثبت پاسخ → اتصال به ماژول قیمت‌های خرید
  window.rfqsReply = function (no, ti) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var t = r.targets[ti];
    // US-153: مودال استاندارد
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '💰 ثبت پاسخ ' + t.co,
        fields: [
          { id: 'price', label: 'قیمت کل اعلامی (ریال)', type: 'number', required: true, dir: 'ltr' },
          { id: 'note', label: 'توضیح (زمان تحویل، شرایط...)', type: 'textarea', rows: 2 }
        ],
        onOk: function (v) { rfqsReplyCommit(no, ti, v.price, v.note); }
      });
      return;
    }
    var price = prompt('قیمت کل اعلامی ' + t.co + ' (ریال):', '');
    if (price === null) return;
    rfqsReplyCommit(no, ti, +String(price).replace(/[^\d]/g, '') || 0, prompt('توضیح:', '') || '');
  };

  window.rfqsReplyCommit = function (no, ti, price, note) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var t = r.targets[ti];
    t.st = 'replied';
    t.reply = { price: +price || 0, note: note, t: faDateTime() };
    setData('ptf_crm_rfqsmart', list);
    // اتصال به buyquotes (AC6)
    var bq = getData('ptf_crm_buyquotes');
    bq.unshift({ cd: genCode('BQ'), ref: no, sup: t.co, desc: (r.items[0] ? r.items[0].name : '') + (r.items.length > 1 ? ' و ' + (r.items.length - 1) + ' قلم دیگر' : ''), price: t.reply.price, t: faDate(), by: curSession().name, note: note });
    setData('ptf_crm_buyquotes', bq);
    /* v13.7 (US-335): قیمت/میانگین قیمت‌های دریافتی → قیمت مرجع کالا در ماژول کالا (با قید تاریخ و منبع) */
    try { ptfUpdateRefPrices(r); } catch (e) {}
    audit('استعلام هوشمند', 'ثبت پاسخ ' + t.co + ' — ' + (+t.reply.price).toLocaleString('fa-IR') + ' ریال', no);
    if (typeof notify === 'function') notify({ toRoles: SENIOR_ROLES, title: '💰 پاسخ استعلام ' + no + ' از ' + t.co + ' ثبت شد', kind: 'buyq', channels: ['cart'], link: { panel: 'buyq' } });
    var mds = document.querySelectorAll('.md-b');
    for (var _mj = mds.length - 1; _mj >= 0; _mj--) { if ((mds[_mj].style || {}).display !== 'none') { mds[_mj].remove(); break; } } rfqsOpen(no); /* v16.2 BUG-017 */
  };

  window.rfqsDecline = function (no, ti) {
    var list = getData('ptf_crm_rfqsmart');
    var r = list.filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    r.targets[ti].st = 'declined';
    setData('ptf_crm_rfqsmart', list);
    var mds = document.querySelectorAll('.md-b');
    for (var _mj = mds.length - 1; _mj >= 0; _mj--) { if ((mds[_mj].style || {}).display !== 'none') { mds[_mj].remove(); break; } } rfqsOpen(no); /* v16.2 BUG-017 */
  };

  window.rfqsDel = function (no) {
    if (!confirm('استعلام ' + no + ' حذف شود؟')) return;
    setData('ptf_crm_rfqsmart', getData('ptf_crm_rfqsmart').filter(function (x) { return x.no !== no; }));
    renderRfqSmart();
  };

  /* ============ AC2: اکسل پاک (بدون داده کارفرما) ============ */
  window.rfqsXls = function (no) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var rows = [['Row', 'Description', 'Technical Spec', 'Qty', 'Unit']];
    (r.items || []).forEach(function (it, i) { rows.push([i + 1, it.name, it.spec || '', it.qty, it.unit]); });
    var csv = '\uFEFF' + rows.map(function (rr) { return rr.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = r.no + '-items.csv';
    a.click();
  };


  /* ============ AC4 + v21.9 US-454: PDF افقی با پیش‌نمایش و دانلود ============ */
  window.ptfRfqsPrintHtml = function (r, tgt) {
    /* v31.7.20 BUG-RFQS-MODEL-001 (گزارش کارفرما): ستون Model در PDF استعلام تامین حذف می‌شد؛
       فیلد model از ماژول کالا (x.md) می‌آمد ولی در جدول چاپ رندر نمی‌شد. */
    var _hasModel = (r.items || []).some(function (x) { return x && String(x.model || '').trim(); });
    var tbody = (r.items || []).map(function (it, i) { var desc=String(it.name||''), fa=/[\u0600-\u06FF]/.test(desc); return '<tr><td>'+(i+1)+'</td><td class="desc '+(fa?'fa':'en')+'" dir="'+(fa?'rtl':'ltr')+'">'+escP(desc)+'</td>'+(_hasModel?'<td class="spec" dir="ltr">'+escP(it.model||'—')+'</td>':'')+'<td class="spec" dir="ltr">'+escP(it.spec||'—')+'</td><td>'+ (it.qty||1)+'</td><td>'+escP(it.unit||'PCS')+'</td><td></td><td></td></tr>'; }).join('');
    var toLine = tgt
      ? ('<div class="sub" style="font-size:11pt;color:#111"><b>To:</b> ' + escP(tgt.co) + (tgt.ph ? ' | Tel: ' + escP(tgt.ph) : '') + (tgt.email ? ' | ' + escP(tgt.email) : '') + '</div>')
      : '';
    var dear = tgt
      ? ('Dear Supplier «' + escP(tgt.co) + '»; ')
      : 'Dear Supplier; ';
    return '<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>' +
      escP(r.no) + (tgt ? (' — ' + escP(tgt.co || '')) : '') +
      '</title><style>' +
      '@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}' +
      'body{font-family:Arial,Tahoma,sans-serif;direction:ltr;margin:0;font-size:11pt;color:#222;line-height:1.7}' +
      '.bar{height:6mm;background:linear-gradient(90deg,#e87200,#ee8100,#ecb003,#ecc506)}' +
      '.hd{display:flex;justify-content:space-between;align-items:center;padding:4mm 10mm 2mm}' +
      '.hd img{height:18mm}' +
      '.hd .m{text-align:left;font-size:9.5pt;line-height:1.8}' +
      '.tt{text-align:center;font-size:14pt;font-weight:900;margin:2mm 0}' +
      '.sub{text-align:center;font-size:9.5pt;color:#444;margin-bottom:3mm;padding:0 10mm}' +
      'table{width:calc(100% - 20mm);margin:0 10mm;border-collapse:collapse;font-size:9.5pt}' +
      'th{background:#f79400;color:#fff;padding:2mm;border:1px solid #e0e0e0}' +
      'td{border:1px solid #d8dbe0;padding:1.8mm;text-align:center}.desc{text-align:left}.desc.fa{text-align:right;font-family:Vazirmatn,Tahoma,sans-serif}.spec{text-align:left}' +
      '.note{margin:4mm 10mm;background:#fff8f0;border:1px solid #f6c17c;border-radius:2mm;padding:2.5mm 4mm;font-size:9pt}' +
      '.ftr{margin:4mm 10mm 0;text-align:center;font-size:8pt;color:#a06000;border-top:1px solid #f0d9b8;padding-top:2mm}' +
      '</style></head><body><div class="bar"></div>' +
      '<div class="hd"><img src="../assets/images/ptf-logo.png" alt="PTF">' +
      '<div class="m">No: <b dir="ltr">' + escP(r.no) + '</b><br>Date: <b dir="ltr">' + new Date().toISOString().slice(0,10) + '</b><br>Delivery Deadline: <b>' + escP(r.deadline || '48 hours') + '</b></div></div>' +
      '<div class="tt">Request for Quotation (RFQ)</div>' + toLine +
      '<div class="sub">' + dear + 'Please quote unit price and delivery time for the items below and return to Pishro Tajhiz Fartak.</div>' +
      '<table><thead><tr><th style="width:6%">No.</th><th>Description</th>' + (_hasModel ? '<th style="width:12%">Model</th>' : '') + '<th style="width:' + (_hasModel ? '18%' : '24%') + '">Technical Specification</th><th style="width:8%">Qty</th><th style="width:8%">Unit</th><th style="width:14%">Unit Price (IRR)</th><th style="width:12%">Delivery</th></tr></thead><tbody>' + tbody + '</tbody></table>' +
      '<div class="note">Please mention RFQ No <b dir="ltr">' + escP(r.no) + '</b> in your reply. Reply: Info@pishtaj.ir | Tel: 021-46087679</div>' +
      '<div class="ftr">Pishro Tajhiz Fartak Co. | Tehran | www.pishtaj.ir</div></body></html>';
  };

  window.rfqsPrintPreview = function (no, targetIdx) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    var tgt = (hasIdx && r.targets && r.targets[+targetIdx]) ? r.targets[+targetIdx] : null;
    var html = ptfRfqsPrintHtml(r, tgt);
    if (typeof ptfPreviewPrintableDoc === 'function') {
      ptfPreviewPrintableDoc('پیش‌نمایش درخواست تامین — ' + escP(r.no) + (tgt ? (' | ' + escP(tgt.co || '')) : ''), html, r.no + (tgt && tgt.co ? ('__' + tgt.co) : ''));
      return;
    }
    var idxArg = hasIdx ? String(+targetIdx) : 'null';
    var titleSup = tgt ? (' | To: ' + escP(tgt.co)) : ' | عمومی';
    var dlg = ''
      + '<div class="md-b" id="rqsPdfDlg" style="display:grid;z-index:2500" onclick="if(event.target===this)this.remove()">'
      + '<div class="md" style="max-width:min(96vw,1100px);width:96vw;max-height:94vh;overflow:auto" onclick="event.stopPropagation()">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
      + '<h3 style="margin:0">🖨️ پیش‌نمایش PDF افقی — <span dir="ltr">' + escP(r.no) + '</span><small style="color:#0e7490">' + titleSup + '</small></h3>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button class="bt" style="font-size:12px;background:#059669" onclick="rfqsDownloadPrintHtml(\'' + ptfOnClickArg(no) + '\',' + idxArg + ')">⬇️ دانلود</button>'
      + '<button class="bt bt-o" style="font-size:12px" onclick="rfqsOpenPrintWindow(\'' + ptfOnClickArg(no) + '\',' + idxArg + ')">🖨 چاپ / Save as PDF</button>'
      + '<button class="bt" style="font-size:12px" onclick="var m=document.getElementById(\'rqsPdfDlg\');if(m)m.remove()">بستن</button>'
      + '</div></div>'
      + '<iframe id="rqsPdfFrame" style="width:100%;height:70vh;border:1px solid var(--brd);border-radius:12px;background:#fff"></iframe>'
      + '</div></div>';
    try { var old = document.getElementById('rqsPdfDlg'); if (old) old.remove(); } catch (e0) {}
    document.getElementById('panels').insertAdjacentHTML('beforeend', dlg);
    try { var fr = document.getElementById('rqsPdfFrame'); var doc = fr.contentDocument || fr.contentWindow.document; doc.open(); doc.write(html); doc.close(); } catch (eF) {}
  };

  window.rfqsOpenPrintWindow = function (no, targetIdx) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    var tgt = (hasIdx && r.targets && r.targets[+targetIdx]) ? r.targets[+targetIdx] : null;
    var w = window.open('', '_blank');
    if (!w) { alert('پنجره چاپ مسدود شد — از دکمه دانلود استفاده کنید'); return; }
    w.document.write(ptfRfqsPrintHtml(r, tgt));
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400);
  };

  window.rfqsDownloadPrintHtml = function (no, targetIdx) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    var tgt = (hasIdx && r.targets && r.targets[+targetIdx]) ? r.targets[+targetIdx] : null;
    var html = ptfRfqsPrintHtml(r, tgt);
    var fname = (r.no || 'RFQ') + (tgt && tgt.co ? ('__' + String(tgt.co).replace(/[^\w\u0600-\u06FF\-]+/g, '_').slice(0, 40)) : '') + '_A4-landscape.html';
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 500);
    if (typeof ptfToast === 'function') ptfToast('⬇️ فایل افقی دانلود شد', 'ok');
  };

  window.rfqsPrint = function (no, targetIdx) {
    var hasIdx = (targetIdx != null && targetIdx !== '' && !isNaN(+targetIdx));
    rfqsPrintPreview(no, hasIdx ? +targetIdx : null);
  };

  window.rfqsPrintPickSupplier = function (no) {
    var r = getData('ptf_crm_rfqsmart').filter(function (x) { return x.no === no; })[0];
    if (!r) return;
    var tgs = r.targets || [];
    if (!tgs.length) { alert('هنوز تامین‌کننده‌ای برای این استعلام انتخاب نشده است'); return; }
    var opts = tgs.map(function (tg, i) {
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--brd);border-radius:12px;margin-bottom:6px;cursor:pointer;background:var(--crd,#fff)">'
        + '<input type="radio" name="rqsPdfSup" value="' + i + '"' + (i === 0 ? ' checked' : '') + '>'
        + '<span style="flex:1"><b>' + escP(tg.co) + '</b>'
        + (tg.ph || tg.email ? ('<span style="display:block;font-size:11.5px;color:#64748b">' + (tg.email ? ('✉️ ' + escP(tg.email) + ' ') : '') + (tg.ph ? ('📱 ' + escP(tg.ph)) : '') + '</span>') : '')
        + '</span></label>';
    }).join('');
    var html = ''
      + '<div class="md-b" id="rqsPdfPick" style="display:grid;z-index:2450" onclick="if(event.target===this)this.remove()">'
      + '<div class="md" style="max-width:480px" onclick="event.stopPropagation()">'
      + '<h3>🖨 PDF اختصاصی تامین‌کننده</h3>'
      + '<div style="font-size:12.5px;color:#475569;margin-bottom:10px">ابتدا تامین‌کننده را از فهرست انتخاب‌شده‌های این استعلام برگزینید، سپس پیش‌نمایش افقی را ببینید و در صورت نیاز دانلود کنید.</div>'
      + '<div style="max-height:50vh;overflow:auto;margin-bottom:12px">' + opts + '</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">'
      + '<button class="bt bt-o" onclick="var m=document.getElementById(\'rqsPdfPick\');if(m)m.remove()">انصراف</button>'
      + '<button class="bt" style="background:#0e7490" onclick="rfqsPrintPickGo(\'' + ptfOnClickArg(no) + '\')">👁 پیش‌نمایش / دانلود</button>'
      + '</div></div></div>';
    try { var old = document.getElementById('rqsPdfPick'); if (old) old.remove(); } catch (e1) {}
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.rfqsPrintPickGo = function (no) {
    var sel = document.querySelector('input[name="rqsPdfSup"]:checked');
    if (!sel) { alert('یک تامین‌کننده را انتخاب کنید'); return; }
    try { var m = document.getElementById('rqsPdfPick'); if (m) m.remove(); } catch (e2) {}
    rfqsPrintPreview(no, +sel.value);
  };

  /* ============ روتینگ ============ */
  var _go = window.goPanel;
  window.goPanel = function (id, btn) {
    if (id === 'rfqs') {
      var rr = roleDef();
      if (!(rr.panels === '*' || rr.panels.indexOf('sup') > -1)) { alert('⛔ دسترسی ندارید'); return; }
      var btns = document.querySelectorAll('.sb-i');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('act');
      if (btn) btn.classList.add('act');
      document.getElementById('pgTitle').textContent = '🛒 درخواست تامین';
      document.getElementById('panels').innerHTML = buildRfqSmart();
      renderRfqSmart();
      return;
    }
    _go(id, btn);
  };

  /* ============ v13.7 (US-335): به‌روزرسانی قیمت مرجع کالاها از پاسخ‌های درخواست تامین ============
     قیمت پاسخ = کل استعلام؛ سهم هر قلم = نسبت به مجموع تعداد (تقریب یکنواخت واحد).
     اگر چند پاسخ باشد میانگین قیمت‌ها مبنا می‌شود. کالا در ماژول کالا با نام/مشخصات پیدا و
     pr + refPriceAt + refPriceSrc به‌روزرسانی می‌شود. */
  window.ptfUpdateRefPrices = function (r) {
    if (!r || !r.items || !r.items.length) return 0;
    var replies = (r.targets || []).filter(function (t) { return t.st === 'replied' && t.reply && +t.reply.price > 0; });
    if (!replies.length) return 0;
    var avgTotal = replies.reduce(function (s2, t) { return s2 + (+t.reply.price || 0); }, 0) / replies.length;
    var totQty = r.items.reduce(function (s2, it) { return s2 + (+it.qty || 1); }, 0) || 1;
    var perUnit = avgTotal / totQty;
    var prods = getData('ptf_crm_products');
    var updated = 0;
    /* v15.2 (US-385): تطبیق نرمال‌شده در مسیر پاسخ کلی (US-335) هم */
    var normU = function (x) { return (typeof dedupNorm === 'function') ? dedupNorm(x) : String(x || '').trim().toLowerCase(); };
    r.items.forEach(function (it) {
      var nm = (it.name || it.nm || '').trim();
      if (!nm) return;
      var productMatch = typeof window.ptfResolveProcurementLine === 'function' ? window.ptfResolveProcurementLine(it, prods) : { ok:false };
      var p = productMatch.ok ? productMatch.item : null;
      if (!p) return; /* no positional/first-name fallback for ambiguous products */
      p.pr = Math.round(perUnit);
      p.prCur = r.quoteCur || p.prCur || 'IRR'; /* v15.6 US-387 ③ */
      p.refPriceAt = faDate();
      p.refPriceSrc = 'درخواست تامین ' + (r.no || '') + ' — ' + (replies.length > 1 ? 'میانگین ' + replies.length + ' قیمت' : replies[0].co);
      updated++;
    });
    if (updated) {
      setData('ptf_crm_products', prods);
      try { audit('کالاها', 'به‌روزرسانی قیمت مرجع ' + updated + ' کالا از پاسخ‌های ' + (r.no || ''), r.no || ''); } catch (e) {}
      if (typeof ptfToast === 'function') ptfToast('💰 قیمت مرجع ' + updated + ' کالا در ماژول کالا به‌روزرسانی شد (با قید تاریخ)', 'ok');
    }
    return updated;
  };
})();

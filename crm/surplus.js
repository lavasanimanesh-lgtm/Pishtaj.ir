/* =====================================================================
   PTF CRM - Surplus Inventory Module - US-436 / v31.7.16 US-STOCK-RENAME
   «موجودی انبار» (نام قبلی: مازاد پروژه) — سبک و بدون انبار کامل.
   کلید داده ptf_crm_surplus و نام توابع عمداً حفظ شده تا sync/backup/tester نشکند.
   ===================================================================== */
(function(){
'use strict';
var K='ptf_crm_surplus';
function all(){ try { var a=getData(K); return Array.isArray(a)?a:[]; } catch(e){ try{return JSON.parse(localStorage.getItem(K)||'[]');}catch(e2){return [];} } }
function save(a){ if(typeof setData==='function') setData(K,a||[]); else localStorage.setItem(K,JSON.stringify(a||[])); }
function gen(){ return (typeof ptfUnifiedCode==='function'?ptfUnifiedCode('SURP'):'SURP-'+Date.now()); }
function activeQty(s){ return Math.max(0,(+s.qty||0)-(+s.soldQty||0)-(+s.reservedQty||0)); }
function statusOf(s){ if((+s.soldQty||0)>=(+s.qty||0)) return 'sold'; if((+s.reservedQty||0)>0) return 'reserved'; return 'available'; }
function auditSafe(msg,ref){ try{ if(typeof audit==='function') audit('موجودی انبار',msg,ref||''); }catch(e){} }
function sourceCd(it){ return String((it&& (it.sourceSurplusCd||it.surplusCd))||'').trim(); }
function offerLines(o){
  var groups={};
  (o&&Array.isArray(o.items)?o.items:[]).forEach(function(it){
    var cd=sourceCd(it), qty=+it.qty||0;
    if(cd&&qty>0) groups[cd]=(groups[cd]||0)+qty;
  });
  return Object.keys(groups).map(function(cd){return {cd:cd,qty:groups[cd]};});
}
function saleQtyForOffer(s,offerNo){
  return (Array.isArray(s&&s.saleRefs)?s.saleRefs:[]).filter(function(x){return x&&x.offerNo===offerNo;}).reduce(function(n,x){return n+(+x.qty||0);},0);
}
function consumeReservation(s,offerNo,qty){
  var left=qty, refs=Array.isArray(s.reservations)?s.reservations:[];
  refs.forEach(function(r){
    if(left<=0||!r||r.offerNo!==offerNo||r.status!=='reserved') return;
    var use=Math.min(+r.qty||0,left); r.qty=(+r.qty||0)-use; left-=use;
    if(r.qty<=0) r.status='consumed';
  });
  return left<=0;
}
window.ptfSurplusAll = all;
window.ptfSurplusAdd = function(prodCd, qty, location, sourceDealCd, note){
  var prods=getData('ptf_crm_products')||[];
  var prod=prods.filter(function(p){ return p.cd===prodCd; })[0]||{nm:prodCd, cd:prodCd};
  qty=+qty||0; if(!prodCd||qty<=0) return null;
  var rec={cd:gen(),prodCd:prodCd,prodName:prod.nm||prodCd,qty:qty,location:location||'کارگاه',sourceDealCd:sourceDealCd||'',note:note||'',status:'available',reservedQty:0,soldQty:0,reservations:[],saleRefs:[],t:faDateTime(),by:(typeof curSession==='function'?curSession().name:'')};
  var list=all(); list.unshift(rec); save(list); auditSafe('ثبت مازاد '+rec.prodName+' - '+qty+' عدد از پرونده '+(sourceDealCd||'-'),rec.cd); return rec;
};
window.ptfSurplusStatus = function(s){ return statusOf(s||{}); };
window.ptfSurplusAvailableQty = function(s){ return activeQty(s||{}); };
window.ptfSurplusRender = function(el, filtered){
  var list=Array.isArray(filtered)?filtered:all();
  if(!list.length){ el.innerHTML='<div style="text-align:center;color:#94a3b8;padding:20px">موجودی انباری ثبت نشده</div>'; return; }
  var html='<div class="tb2"><table><thead><tr><th>کد</th><th>کالا</th><th>کل</th><th>رزروشده</th><th>فروخته‌شده</th><th>قابل استفاده</th><th>محل</th><th>منبع پروژه</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>';
  list.forEach(function(s){ var st=statusOf(s), avail=activeQty(s); html+='<tr><td>'+escP(s.cd)+'</td><td><b>'+escP(s.prodName||s.prodCd)+'</b><br><small>'+escP(s.prodCd)+'</small></td><td>'+ (+s.qty||0) +'</td><td>'+ (+s.reservedQty||0) +'</td><td>'+ (+s.soldQty||0) +'</td><td>'+avail+'</td><td>'+escP(s.location||'-')+'</td><td><small>'+escP(s.sourceDealCd||'-')+'</small></td><td><span class="bd" style="background:'+(st==='available'?'#d1fae5':st==='reserved'?'#fef3c7':'#e2e8f0')+'">'+({available:'✅ موجود',reserved:'⏳ رزرو',sold:'💰 فروخته'}[st]||st)+'</span></td><td>'+(avail>0?'<button class="bt bt-o" style="font-size:11px;padding:3px 8px" onclick="ptfSurplusSell(\''+ptfOnClickArg(s.cd)+'\')">💰 فروش</button> ':'')+(st!=='sold'&&st!=='reserved'?'<button class="bt bt-o" style="font-size:11px;padding:3px 8px;color:#dc2626" onclick="ptfSurplusDel(\''+ptfOnClickArg(s.cd)+'\')">✕</button>':'')+'</td></tr>'; });
  html+='</tbody></table></div>'; el.innerHTML=html;
};
window.ptfSurplusDel = function(cd){ var s=all().filter(function(x){return x.cd===cd;})[0]; if(!s||statusOf(s)!=='available'){alert('⛔ موجودی رزروشده/فروخته‌شده قابل حذف مستقیم نیست.');return;} if(!confirm('این ردیف موجودی حذف شود؟'))return; save(all().filter(function(x){return x.cd!==cd;})); auditSafe('حذف مازاد با تایید کاربر '+cd,cd); renderSurplus(); };
window.ptfSurplusReserve = function(cd, qty, offerNo){
  var list=all(), s=list.filter(function(x){return x.cd===cd;})[0]; qty=+qty||0;
  if(!s||qty<=0||qty>activeQty(s)) return {ok:false,why:'qty'};
  s.reservedQty=(+s.reservedQty||0)+qty;
  s.reservations=Array.isArray(s.reservations)?s.reservations:[];
  if(offerNo) s.reservations.push({offerNo:String(offerNo),qty:qty,status:'reserved',t:faDateTime()});
  save(list); auditSafe('رزرو مازاد '+qty+' عدد برای '+cd,cd); return {ok:true};
};
window.ptfSurplusFinalizeSale = function(cd, qty, offerNo){
  var list=all(), s=list.filter(function(x){return x.cd===cd;})[0]; qty=+qty||0;
  if(!s||qty<=0) return {ok:false,why:'qty'};
  var prior=offerNo?saleQtyForOffer(s,String(offerNo)):0, needed=Math.max(0,qty-prior);
  if(!needed) return {ok:true,idempotent:true};
  if(needed>(+s.reservedQty||0)) return {ok:false,why:'reservation'};
  s.reservedQty-=needed; s.soldQty=(+s.soldQty||0)+needed;
  s.saleRefs=Array.isArray(s.saleRefs)?s.saleRefs:[];
  if(offerNo){
    var ref=s.saleRefs.filter(function(x){return x.offerNo===String(offerNo);})[0];
    if(ref) ref.qty=Math.max(+ref.qty||0,qty); else s.saleRefs.push({offerNo:String(offerNo),qty:qty,t:faDateTime()});
    consumeReservation(s,String(offerNo),needed);
  }
  s.lastSaleOffer=offerNo||''; save(list); auditSafe('ثبت فروش نهایی مازاد '+needed+' عدد از '+cd+' — پیشنهاد '+(offerNo||'-'),cd); return {ok:true,qty:needed};
};
/* پیش‌بررسی و ثبت اتمیکِ منطقیِ تمام اقلام مازادِ یک پیشنهاد برنده */
window.ptfSurplusWinGuard = function(o){
  var lines=offerLines(o), list=all(), problems=[];
  lines.forEach(function(line){
    var s=list.filter(function(x){return x.cd===line.cd;})[0];
    var already=s? saleQtyForOffer(s,String(o.no||'')):0;
    var needed=Math.max(0,line.qty-already);
    if(!s) problems.push(line.cd+' پیدا نشد');
    else if(needed>(+s.reservedQty||0)) problems.push(line.cd+' رزرو کافی ندارد (نیاز '+needed+'، رزرو '+(+s.reservedQty||0)+')');
  });
  return {ok:problems.length===0,lines:lines,problems:problems};
};
window.ptfSurplusFinalizeForOffer = function(o){
  var guard=window.ptfSurplusWinGuard(o); if(!guard.ok) return guard;
  var done=0;
  guard.lines.forEach(function(line){ var r=window.ptfSurplusFinalizeSale(line.cd,line.qty,o.no||''); if(r.ok) done+=r.qty||0; });
  return {ok:true,lines:guard.lines,qty:done};
};
window.ptfSurplusReleaseForOffer = function(o){
  var lines=offerLines(o), list=all(), released=0;
  lines.forEach(function(line){
    var s=list.filter(function(x){return x.cd===line.cd;})[0]; if(!s||!Array.isArray(s.reservations)) return;
    var releasedHere=0;
    s.reservations.forEach(function(r){ if(r&&r.offerNo===String(o.no||'')&&r.status==='reserved'){ releasedHere+=(+r.qty||0); r.status='released'; r.qty=0; } });
    s.reservedQty=Math.max(0,(+s.reservedQty||0)-releasedHere);
    released+=releasedHere;
  });
  if(released){ save(list); auditSafe('آزادسازی رزرو مازاد برای پیشنهاد باخته '+(o.no||'-')+' — '+released+' عدد',o.no||''); }
  return {ok:true,qty:released};
};
/* ===== v34.1 US-SELL: فروش کالا از انبار — دیالوگ حرفه‌ای =====
   سناریو: کاربر روی «💰 فروش» می‌زند →
   ۱. دیالوگ با اطلاعات کالا + فیلد تعداد + انتخاب خریدار + قیمت پیشنهادی
   ۲. تأیید → ساخت پیشنهاد مالی (CO) با اقلام پُرشده
   ۳. باز شدن فرم CO برای بررسی نهایی و ذخیره
*/
window.ptfSurplusSell = function(cd){
  var s=all().filter(function(x){return x.cd===cd;})[0]; if(!s) return;
  var avail=activeQty(s); if(!avail) return;

  /* اطلاعات کالا از ماژول محصولات */
  var prods=getData('ptf_crm_products')||[];
  var prod=prods.filter(function(p){return p.cd===s.prodCd;})[0]||{};
  var refPrice=+(prod.pr||0);
  var refUnit=prod.un||'عدد';
  var refBrand=prod.br||'';

  /* لیست خریداران */
  var custs=getData('ptf_crm_customers')||[];
  var custOpts='<option value="">— انتخاب خریدار —</option>'+custs.map(function(c){
    return '<option value="'+escP(c.cd)+'">'+escP(c.co||c.nm)+'</option>';
  }).join('');

  var esc=function(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
  var dlgId='ptfSurplusSellDlg';
  var old=document.getElementById(dlgId); if(old)old.remove();

  var html=
    '<div id="'+dlgId+'" class="md-b" style="display:grid;z-index:2800">'+
    '<div class="md" style="width:480px;max-width:96vw">'+
    '<h3>💰 فروش کالا از انبار</h3>'+

    /* اطلاعات کالا */
    '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.8">'+
    '<b>'+esc(s.prodName||s.prodCd)+'</b>'+
    (refBrand?' <span style="color:#6d28d9">('+esc(refBrand)+')</span>':'')+
    '<br><span style="color:#475569">موجودی قابل فروش: <b style="color:#059669">'+avail+' '+esc(refUnit)+'</b></span>'+
    (s.sourceDealCd?' | <small style="color:#94a3b8">از پروژه '+esc(s.sourceDealCd)+'</small>':'')+
    (refPrice?'<br><span style="color:#0e7490">قیمت مرجع: <b>'+refPrice.toLocaleString('fa-IR')+' ریال</b></span>':'')+
    '</div>'+

    /* فرم */
    '<div class="fr" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="fld"><label style="font-weight:900;font-size:12px">تعداد فروش *</label>'+
    '<input type="number" id="ptfSlQty" value="'+avail+'" min="1" max="'+avail+'" '+
    'style="padding:10px;border:2px solid var(--brd);border-radius:10px;font-size:14px;width:100%;box-sizing:border-box"></div>'+

    '<div class="fld"><label style="font-weight:900;font-size:12px">قیمت واحد (ریال)</label>'+
    '<input type="number" id="ptfSlPrice" value="'+refPrice+'" min="0" '+
    'style="padding:10px;border:2px solid var(--brd);border-radius:10px;font-size:14px;width:100%;box-sizing:border-box;direction:ltr"></div>'+
    '</div>'+

    '<div class="fld" style="margin-top:12px"><label style="font-weight:900;font-size:12px">خریدار (کارفرما) *</label>'+
    '<select id="ptfSlBuyer" style="padding:10px;border:2px solid var(--brd);border-radius:10px;font-size:13px;width:100%;box-sizing:border-box">'+custOpts+'</select></div>'+

    /* جمع کل */
    '<div id="ptfSlTotal" style="margin-top:12px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:13px;color:#1e40af;font-weight:700;text-align:center"></div>'+

    /* دکمه‌ها */
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'+
    '<button class="bt bt-o" onclick="document.getElementById(\''+dlgId+'\').remove()">انصراف</button>'+
    '<button class="bt" id="ptfSlGo" onclick="ptfSurplusSellGo(\''+esc(cd)+'\')">📄 صدور پیشنهاد مالی</button>'+
    '</div></div></div>';

  document.body.insertAdjacentHTML('beforeend',html);

  /* بروزرسانی جمع کل */
  function updTotal(){
    var q=+(document.getElementById('ptfSlQty')||{}).value||0;
    var p=+(document.getElementById('ptfSlPrice')||{}).value||0;
    var t=q*p;
    var el=document.getElementById('ptfSlTotal');
    if(el) el.textContent='جمع کل: '+t.toLocaleString('fa-IR')+' ریال';
  }
  document.getElementById('ptfSlQty').addEventListener('input',updTotal);
  document.getElementById('ptfSlPrice').addEventListener('input',updTotal);
  updTotal();
};

/* ساخت CO و باز کردن فرم */
window.ptfSurplusSellGo = function(cd){
  var s=all().filter(function(x){return x.cd===cd;})[0]; if(!s) return;
  var qty=+(document.getElementById('ptfSlQty')||{}).value||0;
  var price=+(document.getElementById('ptfSlPrice')||{}).value||0;
  var buyerCd=(document.getElementById('ptfSlBuyer')||{}).value||'';
  var avail=activeQty(s);

  if(qty<=0||qty>avail){alert('تعداد نامعتبر است (حداکثر '+avail+')');return;}
  if(!buyerCd){alert('لطفاً خریدار را انتخاب کنید');return;}

  /* بستن دیالوگ */
  var dlg=document.getElementById('ptfSurplusSellDlg'); if(dlg)dlg.remove();

  try{
    if(typeof offerNew!=='function'){alert('ماژول پیشنهادها بارگذاری نشده');return;}

    /* ساخت CO جدید */
    offerNew('CO');
    var offerNo=window._offState&&window._offState.no||'';

    /* رزرو موجودی */
    var res=ptfSurplusReserve(cd,qty,offerNo);
    if(!res.ok){alert('⛔ تعداد فروش از موجودی قابل استفاده بیشتر است.');return;}

    /* اطلاعات کالا */
    var prods=getData('ptf_crm_products')||[];
    var prod=prods.filter(function(p){return p.cd===s.prodCd;})[0]||{};

    /* پُر کردن فرم CO */
    if(window._offState){
      window._offState.buyerCd=buyerCd;
      var cust=(getData('ptf_crm_customers')||[]).filter(function(c){return c.cd===buyerCd;})[0];
      if(cust) window._offState.buyerCo=cust.coEn||cust.co||'';
      window._offState.items=[{
        pcode:s.prodCd,
        name:s.prodName||prod.nm||'',
        desc:(prod.st||'')+(s.sourceDealCd?' — از پروژه '+s.sourceDealCd:''),
        model:prod.model||'',
        qty:qty,
        unit:prod.un||'عدد',
        brand:prod.br||'',
        price:price,
        dlv:'',
        surplusCd:s.cd,
        sourceSurplusCd:s.cd,
        sourceDealCd:s.sourceDealCd||'',
        reservationOfferNo:offerNo
      }];
      /* بروزرسانی فرم */
      if(typeof offRenderItems==='function') offRenderItems();
      if(typeof offerPickBuyer==='function') offerPickBuyer(buyerCd);
    }

    if(typeof ptfToast==='function') ptfToast('✅ پیشنهاد مالی '+offerNo+' با '+qty+' عدد '+escP(s.prodName)+' ساخته شد — بررسی و ذخیره کنید','ok');
    auditSafe('صدور پیشنهاد فروش مازاد: '+qty+' عدد '+s.prodName+' به پیشنهاد '+offerNo,cd);

  }catch(e){
    auditSafe('خطا در ساخت پیشنهاد فروش مازاد '+cd,cd);
    alert('⛔ خطا: '+(e&&e.message?e.message:e));
  }
};
window.buildSurplus = function(){ return '<div class="ph"><h3>🏬 موجودی انبار (US-436)</h3><div class="sb2"><input type="text" id="surpSrch" placeholder="جستجو کالا/پروژه/محل..." oninput="renderSurplus()" style="flex:1"><button class="bt" onclick="ptfSurplusAddDialog()">+ ثبت موجودی</button></div></div><div id="surplusStats"></div><div id="surplusWrap"></div>'; };
window.renderSurplus = function(){
  var el=document.getElementById('surplusWrap'); if(!el)return;
  var q=((document.getElementById('surpSrch')||{}).value||'').toLowerCase();
  var list=all().filter(function(s){return !q||((s.prodName||'')+' '+(s.prodCd||'')+' '+(s.sourceDealCd||'')+' '+(s.location||'')).toLowerCase().indexOf(q)>-1;});
  /* v31.7.16 US-STOCK-RENAME: نوار آمار موجودی انبار */
  try{
    var stEl=document.getElementById('surplusStats');
    if(stEl){
      var full=all(), tAvail=0,tRes=0,tSold=0;
      full.forEach(function(s){ tAvail+=activeQty(s); tRes+=(+s.reservedQty||0); tSold+=(+s.soldQty||0); });
      stEl.innerHTML = full.length ? '<div class="sr" style="grid-template-columns:repeat(4,1fr);margin-bottom:10px">'+
        '<div class="sc"><b>'+full.length+'</b><span>ردیف موجودی</span></div>'+
        '<div class="sc"><b style="color:#047857">'+tAvail+'</b><span>قابل استفاده</span></div>'+
        '<div class="sc"><b style="color:#b45309">'+tRes+'</b><span>رزروشده</span></div>'+
        '<div class="sc"><b style="color:#64748b">'+tSold+'</b><span>فروخته‌شده</span></div></div>' : '';
    }
  }catch(eStats){}
  ptfSurplusRender(el,list);
};
window.ptfSurplusAddDialog = function(){
  var prods=getData('ptf_crm_products')||[], prodOpts=prods.slice(0,100).map(function(p){return '<option value="'+escP(p.cd)+'">'+escP(p.nm||p.cd)+' ('+escP(p.cd)+')</option>';}).join('');
  var deals=(getData('ptf_crm_deals')||[]).concat(getData('ptf_crm_projects')||[]).slice(0,100), dealOpts='<option value="">— بدون منبع - مازاد قدیمی —</option>'+deals.map(function(d){return '<option value="'+escP(d.cd||d.inqNo)+'">'+escP((d.inqNo||d.cd)+' - '+(d.buyerCo||''))+'</option>';}).join('');
  ptfDialog({title:'🏬 ثبت موجودی انبار',fields:[{id:'prodCd',label:'کالا (از کاتالوگ)',type:'select',optionsHtml:prodOpts},{id:'qty',label:'تعداد',type:'number',value:1,required:true},{id:'location',label:'محل نگهداری',value:'کارگاه',required:true},{id:'sourceDealCd',label:'منبع پرونده/بایگانی (اختیاری)',type:'select',optionsHtml:dealOpts},{id:'note',label:'یادداشت',type:'textarea',rows:2,value:'موجودی انبار'}],okText:'ثبت موجودی',onOk:function(v){if(!ptfSurplusAdd(v.prodCd,v.qty,v.location,v.sourceDealCd,v.note)){alert('کالا و تعداد معتبر الزامی است');return;} renderSurplus();if(typeof ptfToast==='function')ptfToast('موجودی انبار ثبت شد','ok');}});
};
(function hookOfferNew(){
  if(typeof window.offerNew!=='function'||window._surplusHooked)return;
  window._surplusHooked=true; var orig=window.offerNew;
  window.offerNew=function(kind){ orig(kind); try{ var avail=all().filter(function(s){return activeQty(s)>0;}); var box=document.getElementById('offItemsWrap'); if(!box||!avail.length)return; var html='<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:12px">📦 <b>مازاد موجود:</b> '+avail.slice(0,5).map(function(s){return escP(s.prodName)+' - '+activeQty(s)+' عدد ('+escP(s.location)+')';}).join(' | ')+' — برای انتخاب دقیق از ماژول موجودی انبار استفاده کنید</div>'; box.insertAdjacentHTML('beforebegin',html); }catch(e){} };
})();
/* offerSetSt از offers.js قبل از این فایل در runtime حاضر است؛ wrapperهای بعدی
   workflow/petty/archive نیز به original زنجیره‌ای خودشان صدا می‌زنند. */
(function hookOfferStatus(){
  if(typeof window.offerSetSt!=='function'||window._surplusStatusHooked)return;
  window._surplusStatusHooked=true;
  var orig=window.offerSetSt;
  window.offerSetSt=function(no,st,selEl){
    var before=(getData('ptf_crm_offers')||[]).filter(function(x){return x.no===no;})[0]||null;
    var beforeSt=before&&before.st;
    if(st==='won'&&before&&beforeSt!=='won'){
      var guard=window.ptfSurplusWinGuard(before);
      if(!guard.ok){ if(selEl)selEl.value=beforeSt||'draft'; alert('⛔ فروش از موجودی انبار قابل نهایی‌سازی نیست:\n'+guard.problems.join('\n')); return; }
    }
    orig.apply(this,arguments);
    try{
      var after=(getData('ptf_crm_offers')||[]).filter(function(x){return x.no===no;})[0]||null;
      if(st==='won'&&after&&after.st==='won'&&beforeSt!=='won') window.ptfSurplusFinalizeForOffer(after);
      if(st==='lost'&&after&&after.st==='lost'&&beforeSt!=='lost') window.ptfSurplusReleaseForOffer(after);
    }catch(e){ auditSafe('خطا در نهایی‌سازی/آزادسازی مازاد برای پیشنهاد '+no,no); }
  };
})();
})();

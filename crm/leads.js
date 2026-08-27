/* =====================================================================
   PTF CRM — Sprint 57 — US-113
   سرنخ‌ها (Leads) + یادآورها (Reminders)
   ===================================================================== */

/* ---------- ابزار تاریخ شمسی ---------- */
function faDate(d) { return (d || new Date()).toLocaleDateString('fa-IR'); }
// US-152 AC1: سال شمسی پویا برای شماره‌گذاری اسناد (جایگزین 1405 هاردکد)
function faYear() {
  var y = new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/')[0];
  return /^\d{4}$/.test(y) ? y : String(new Date().getFullYear() - 621);
}
function faDateTime(d) { var n = d || new Date(); return n.toLocaleDateString('fa-IR') + ' ' + n.toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'}); }
// تبدیل input type=date (میلادی) به نمایش شمسی
function gDateToFa(iso) { if (!iso) return ''; if (typeof ptfISOToJ === 'function') return ptfISOToJ(iso) || iso; try { return new Date(iso + 'T12:00:00').toLocaleDateString('fa-IR'); } catch(e){ return iso; } }
function todayISO() { return new Date().toISOString().slice(0,10); }

/* ============================================================
   LEADS — سرنخ‌ها
   ============================================================ */
var LEAD_STAGES = [
  { id: 'new',   lb: 'جدید',           cl: '#64748b' },
  { id: 'call1', lb: 'تماس اولیه',     cl: '#0ea5e9' },
  { id: 'nego',  lb: 'در حال مذاکره',  cl: '#f59e0b' },
  { id: 'offer', lb: 'ارسال پیشنهاد',  cl: '#8b5cf6' },
  { id: 'won',   lb: 'تبدیل‌شده ✅',    cl: '#10b981' },
  { id: 'lost',  lb: 'از دست رفته ❌', cl: '#ef4444' }
];
var LEAD_SOURCES = ['وب‌سایت','اینستاگرام','معرفی','نمایشگاه','تماس سرد','سایر'];
var LEAD_INDS = ['نفت و گاز','پتروشیمی','نیروگاه','فولاد','سیمان','آب','سایر'];

function stageOf(id) { for (var i=0;i<LEAD_STAGES.length;i++) if (LEAD_STAGES[i].id===id) return LEAD_STAGES[i]; return LEAD_STAGES[0]; }

/* MOB-031: Kanban دسکتاپ حفظ می‌شود، اما روی گوشی به «نمای مرحله‌ای» تبدیل
   می‌شود تا شش ستونِ 900px به محتوای پنهان و بدون نشانهٔ swipe تبدیل نشوند. */
var LEAD_MOBILE_STAGE = '';

function leadClickArg(v) {
  if (typeof ptfOnClickArg === 'function') return ptfOnClickArg(v);
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function leadStageId(l) { return stageOf(l && l.stage).id; }
function leadStageKnown(id) {
  return LEAD_STAGES.some(function (s) { return s.id === id; });
}
function leadStageCards(leads, stage) {
  return leads.filter(function (l) { return leadStageId(l) === stage; });
}
function leadEmptyStageHtml(stage) {
  return '<div class="lead-stage-empty" role="status">' +
    '<span aria-hidden="true">○</span><b>لیدی در «' + escP(stage.lb) + '» نیست</b>' +
    '<small>از مرحله‌های بالا وضعیت دیگری را انتخاب کنید یا لید تازه ثبت کنید.</small>' +
    '</div>';
}

function buildLeads() {
  return '<div class="ph leads-head"><h3>🎯 سرنخ‌ها</h3>' +
    '<div class="sb2 leads-toolbar" aria-label="ابزارهای سرنخ‌ها">' +
    '<input type="text" id="ldSrch" placeholder="جستجو: شرکت، رابط، تلفن..." aria-label="جستجو در سرنخ‌ها" oninput="renderLeads()">' +
    '<select id="ldView" aria-label="انتخاب نمای سرنخ‌ها" onchange="renderLeads()"><option value="kanban">🧭 نمای مراحل</option><option value="table">📋 جدول</option></select>' +
    '<div class="leads-toolbar-actions">' +
    '<button type="button" class="bt leads-toolbar-action leads-create-action" title="ثبت سرنخ جدید" aria-label="ثبت سرنخ جدید" onclick="showLeadModal()"><span aria-hidden="true">＋</span><span>لید جدید</span></button>' +
    '<button type="button" class="bt bt-o leads-toolbar-action leads-import-action" title="ورود سرنخ از اکسل" aria-label="ورود سرنخ از اکسل" onclick="ptfShowExcelGuidelineModal(&quot;LEADS&quot;, &quot;leadsXlsInp&quot;)"><span aria-hidden="true">⇧</span><span>ورود اکسل</span></button><input type="file" id="leadsXlsInp" accept=".csv,.xlsx,.xls" style="display:none" onchange="ptfStandardImportLeadsXls(this)">' +
    '<button type="button" class="bt bt-o leads-toolbar-action leads-export-action" title="خروجی اکسل سرنخ‌ها" aria-label="خروجی اکسل سرنخ‌ها" onclick="exportLeadsCsv()"><span aria-hidden="true">⇩</span><span>خروجی اکسل</span></button>' +
    '<button type="button" class="bt bt-o leads-toolbar-action leads-report-action" title="گزارش تبدیل سرنخ‌ها" aria-label="گزارش تبدیل سرنخ‌ها" onclick="showLeadReport()"><span aria-hidden="true">◔</span><span>گزارش تبدیل</span></button>' +
    '</div></div></div>' +
    '<div id="ldWrap"></div>';
}

function leadBoardCardHtml(l, st) {
  var id = leadClickArg(l.cd);
  return '<article class="lead-board-card" style="--lead-stage:' + st.cl + '" aria-label="سرنخ ' + escP(l.co) + '، ' + escP(st.lb) + '">' +
    '<div class="lead-board-card-copy">' +
    '<b>' + escP(l.co) + '</b>' +
    '<span>' + escP(l.person || 'بدون رابط ثبت‌شده') + '</span>' +
    (l.val ? '<small class="lead-value">' + (+l.val).toLocaleString('fa-IR') + ' ریال</small>' : '') +
    '<small>تماس اول: ' + escP(l.firstFa || '-') + '</small>' +
    (l.nextFa ? '<small class="lead-next">اقدام بعدی: ' + escP(l.nextFa) + '</small>' : '') +
    '</div>' +
    '<div class="lead-board-card-actions">' +
    '<button type="button" class="lead-board-action lead-board-view" title="مشاهده پرونده ' + escP(l.co) + '" aria-label="مشاهده پرونده ' + escP(l.co) + '" onclick="showLeadCard(\'' + id + '\')">مشاهده</button>' +
    '<button type="button" class="lead-board-action lead-board-edit" title="ویرایش سرنخ ' + escP(l.co) + '" aria-label="ویرایش سرنخ ' + escP(l.co) + '" onclick="showLeadModal(\'' + id + '\')">ویرایش</button>' +
    '<button type="button" class="lead-board-action lead-board-delete" title="حذف سرنخ ' + escP(l.co) + '" aria-label="حذف سرنخ ' + escP(l.co) + '" onclick="leadDel(\'' + id + '\')">حذف</button>' +
    '</div></article>';
}

function leadMobileCardHtml(l, st) {
  var id = leadClickArg(l.cd);
  var otherStages = LEAD_STAGES.filter(function (s) { return s.id !== leadStageId(l); }).map(function (s) {
    return '<option value="' + s.id + '">' + escP(s.lb) + '</option>';
  }).join('');
  return '<article class="lead-mobile-card" style="--lead-stage:' + st.cl + '">' +
    '<div class="lead-mobile-card-head">' +
    '<div class="lead-mobile-card-title"><b>' + escP(l.co) + '</b><small>' + escP(l.cd) + '</small></div>' +
    '<span class="lead-mobile-status">' + escP(st.lb) + '</span></div>' +
    '<dl class="lead-mobile-card-meta">' +
    '<div><dt>رابط</dt><dd>' + escP(l.person || 'ثبت نشده') + '</dd></div>' +
    '<div><dt>تماس اول</dt><dd>' + escP(l.firstFa || '-') + '</dd></div>' +
    (l.val ? '<div><dt>ارزش برآوردی</dt><dd>' + (+l.val).toLocaleString('fa-IR') + ' ریال</dd></div>' : '') +
    (l.nextFa ? '<div class="lead-mobile-next"><dt>اقدام بعدی</dt><dd>' + escP(l.nextFa) + '</dd></div>' : '') +
    '</dl>' +
    '<div class="lead-mobile-card-actions">' +
    '<button type="button" class="lead-mobile-card-action lead-mobile-view" title="مشاهده پرونده ' + escP(l.co) + '" aria-label="مشاهده پرونده ' + escP(l.co) + '" onclick="showLeadCard(\'' + id + '\')"><span aria-hidden="true">⌕</span><span>مشاهده پرونده</span></button>' +
    '<button type="button" class="lead-mobile-card-action lead-mobile-edit" title="ویرایش سرنخ ' + escP(l.co) + '" aria-label="ویرایش سرنخ ' + escP(l.co) + '" onclick="showLeadModal(\'' + id + '\')"><span aria-hidden="true">✎</span><span>ویرایش</span></button>' +
    '</div>' +
    '<label class="lead-mobile-stage-move"><span>تغییر مرحله</span>' +
    '<select aria-label="تغییر مرحلهٔ سرنخ ' + escP(l.co) + '" onchange="ptfLeadMoveFromPipeline(\'' + id + '\',this.value,this)">' +
    '<option value="">انتقال به مرحله…</option>' + otherStages + '</select></label>' +
    '</article>';
}

function leadKanbanHtml(leads) {
  var selectedId = leadStageKnown(LEAD_MOBILE_STAGE) ? LEAD_MOBILE_STAGE : 'new';
  var selected = stageOf(selectedId);
  var selectedLeads = leadStageCards(leads, selected.id);
  var columns = LEAD_STAGES.map(function (st) {
    var cards = leadStageCards(leads, st.id);
    return '<section class="lead-board-column" style="--lead-stage:' + st.cl + '" aria-label="مرحله ' + escP(st.lb) + '، ' + cards.length + ' سرنخ">' +
      '<header class="lead-board-column-head"><span>' + escP(st.lb) + '</span><b>' + cards.length + '</b></header>' +
      '<div class="lead-board-column-cards">' + (cards.map(function (l) { return leadBoardCardHtml(l, st); }).join('') || leadEmptyStageHtml(st)) + '</div></section>';
  }).join('');
  var stageTabs = LEAD_STAGES.map(function (st) {
    var count = leadStageCards(leads, st.id).length;
    var active = st.id === selected.id;
    return '<button type="button" class="lead-stage-tab' + (active ? ' is-active' : '') + '" id="ldStageTab-' + st.id + '" data-lead-stage="' + st.id + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '" aria-controls="ldMobileStagePanel" tabindex="' + (active ? '0' : '-1') + '" title="نمایش سرنخ‌های مرحلهٔ ' + escP(st.lb) + '" aria-label="مرحلهٔ ' + escP(st.lb) + '، ' + count + ' سرنخ" style="--lead-stage:' + st.cl + '" onclick="ptfLeadSelectStage(\'' + st.id + '\',this)" onkeydown="ptfLeadStageKeydown(event,\'' + st.id + '\')">' +
      '<span class="lead-stage-tab-dot" aria-hidden="true"></span><span class="lead-stage-tab-copy"><b>' + escP(st.lb) + '</b><small>' + count + ' سرنخ</small></span></button>';
  }).join('');
  return '<div class="lead-kanban-shell">' +
    '<section class="lead-board-view" aria-labelledby="leadBoardTitle">' +
    '<div class="lead-board-intro"><div><h4 id="leadBoardTitle">نمای کانبان سرنخ‌ها</h4><p>برای دیدن همهٔ مراحل، برد را افقی حرکت دهید؛ عملیات هر کارت همچنان در دسترس است.</p></div><span>' + leads.length + ' سرنخ</span></div>' +
    '<div class="lead-board-scroll" role="region" tabindex="0" aria-label="برد کانبان سرنخ‌ها؛ برای دیدن مرحله‌های بیشتر افقی حرکت دهید"><div class="lead-board-grid">' + columns + '</div></div>' +
    '</section>' +
    '<section class="lead-pipeline-view" aria-labelledby="leadPipelineTitle">' +
    '<header class="lead-pipeline-intro"><div><h4 id="leadPipelineTitle">نمای مرحله‌ای سرنخ‌ها</h4><p>یک مرحله را انتخاب کنید؛ تغییر وضعیت هر سرنخ از داخل کارت انجام می‌شود.</p></div><span>' + leads.length + ' سرنخ</span></header>' +
    '<div class="lead-stage-tabs" role="tablist" aria-label="مرحله‌های سرنخ">' + stageTabs + '</div>' +
    '<div class="lead-mobile-stage-panel" id="ldMobileStagePanel" role="tabpanel" aria-labelledby="ldStageTab-' + selected.id + '">' +
    '<header><div><span class="lead-mobile-stage-dot" style="background:' + selected.cl + '" aria-hidden="true"></span><b>' + escP(selected.lb) + '</b><small>' + selectedLeads.length + ' سرنخ در این مرحله</small></div><span>برای انتقال، منوی هر کارت را باز کنید</span></header>' +
    '<div class="lead-mobile-cards">' + (selectedLeads.map(function (l) { return leadMobileCardHtml(l, selected); }).join('') || leadEmptyStageHtml(selected)) + '</div></div>' +
    '</section></div>';
}

function renderLeads() {
  var el = document.getElementById('ldWrap');
  if (!el) return;
  var q = ((document.getElementById('ldSrch')||{}).value || '').trim().toLowerCase();
  var view = (document.getElementById('ldView')||{}).value || 'kanban';
  var leads = getData('ptf_crm_leads').filter(function(l) {
    if (!q) return true;
    return ((l.co||'')+' '+(l.person||'')+' '+(l.tel||'')+' '+(l.mob||'')+' '+(l.email||'')).toLowerCase().indexOf(q) > -1;
  });
  updateLeadBadge();
  if (view === 'table') { renderLeadsTable(el, leads); return; }
  el.innerHTML = leadKanbanHtml(leads);
}

window.ptfLeadSelectStage = function (stage, trigger) {
  if (!leadStageKnown(stage)) return;
  LEAD_MOBILE_STAGE = stage;
  renderLeads();
  window.requestAnimationFrame(function () {
    var next = document.querySelector('.lead-stage-tab[data-lead-stage="' + stage + '"]');
    if (next && typeof next.focus === 'function') next.focus();
  });
};
window.ptfLeadStageKeydown = function (ev, stage) {
  var ix = LEAD_STAGES.map(function (s) { return s.id; }).indexOf(stage);
  if (ix < 0) return;
  var next = null;
  if (ev.key === 'ArrowRight') next = (ix + LEAD_STAGES.length - 1) % LEAD_STAGES.length;
  else if (ev.key === 'ArrowLeft') next = (ix + 1) % LEAD_STAGES.length;
  else if (ev.key === 'Home') next = 0;
  else if (ev.key === 'End') next = LEAD_STAGES.length - 1;
  if (next === null) return;
  ev.preventDefault();
  window.ptfLeadSelectStage(LEAD_STAGES[next].id);
};
window.ptfLeadMoveFromPipeline = function (cd, stage, select) {
  if (select) select.value = '';
  if (!stage || !leadStageKnown(stage)) return;
  leadSetStage(cd, stage, { fromPipeline: true });
};

function renderLeadsTable(el, leads) {
  var h = '<div class="tb2"><table><thead><tr><th>کد</th><th>شرکت</th><th>رابط</th><th>تماس</th><th>صنعت</th><th>منبع</th><th>تماس اول</th><th>وضعیت</th><th>ارزش</th><th></th></tr></thead><tbody>';
  leads.forEach(function(l) {
    var st = stageOf(leadStageId(l));
    var id = leadClickArg(l.cd);
    h += '<tr><td>' + escP(l.cd) + '</td><td><b>' + escP(l.co) + '</b></td><td>' + escP(l.person||'-') + '</td>' +
      '<td style="direction:ltr">' + escP(l.mob || l.tel || '-') + '</td><td>' + escP(l.ind||'-') + '</td><td>' + escP(l.src||'-') + '</td>' +
      '<td>' + escP(l.firstFa||'-') + '</td>' +
      '<td><span style="color:' + st.cl + ';font-weight:bold;font-size:12px">' + escP(st.lb) + '</span></td>' +
      '<td>' + (l.val ? (+l.val).toLocaleString('fa-IR') : '-') + '</td>' +
      '<td class="lead-table-actions" data-mobile-label="">' +
      '<button type="button" class="lead-table-action lead-table-view" onclick="event.stopPropagation();showLeadCard(\'' + id + '\')" title="مشاهده پرونده ' + escP(l.co) + '" aria-label="مشاهده پرونده ' + escP(l.co) + '">مشاهده</button>' +
      '<button type="button" class="lead-table-action lead-table-edit" onclick="event.stopPropagation();showLeadModal(\'' + id + '\')" title="ویرایش سرنخ ' + escP(l.co) + '" aria-label="ویرایش سرنخ ' + escP(l.co) + '">ویرایش</button>' +
      '<button type="button" class="lead-table-action lead-table-delete" onclick="event.stopPropagation();leadDel(\'' + id + '\')" title="حذف سرنخ ' + escP(l.co) + '" aria-label="حذف سرنخ ' + escP(l.co) + '">حذف</button>' +
      '</td></tr>';
  });
  h += '</tbody></table></div>';
  el.innerHTML = h + (leads.length ? '' : '<div class="lead-stage-empty" style="margin-top:10px">لیدی ثبت نشده</div>');
}

function updateLeadBadge() {
  /* v12.8 (US-317): بج قرمز = فقط نیازمند اقدام — سرنخ‌های «جدید» که هنوز هیچ اقدامی (تماس/تاریخچه) ندارند */
  var need = getData('ptf_crm_leads').filter(function(l){ return l.stage === 'new' && !(l.hist && l.hist.length); }).length;
  var b = document.getElementById('ldBadge');
  if (b) { b.textContent = need; b.style.display = need ? '' : 'none'; }
}

/* ---- ثبت / ویرایش لید ---- */
function showLeadModal(cd) {
  var l = cd ? getData('ptf_crm_leads').filter(function(x){ return x.cd === cd; })[0] : null;
  var srcOpts = LEAD_SOURCES.map(function(s){ return '<option' + (l && l.src === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
  var indOpts = LEAD_INDS.map(function(s){ return '<option' + (l && l.ind === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:620px;max-height:92vh;overflow:auto">' +
    '<h3>' + (l ? '✏️ ویرایش لید' : '🎯 سرنخ جدید') + '</h3>' +
    '<div class="fr"><div class="fld"><label>نام شرکت *</label><input type="text" id="nLCo" value="' + (l?escP(l.co):'') + '"></div>' +
    '<div class="fld"><label>شخص رابط</label><input type="text" id="nLPer" value="' + (l?escP(l.person||''):'') + '"></div></div>' +
    '<div class="fr"><div class="fld"><label>سمت</label><input type="text" id="nLRole" value="' + (l?escP(l.role||''):'') + '"></div>' +
    '<div class="fld"><label>صنعت</label><select id="nLInd">' + indOpts + '</select></div></div>' +
    '<div class="fr"><div class="fld"><label>تلفن ثابت</label><input type="text" id="nLTel" value="' + (l?escP(l.tel||''):'') + '" style="direction:ltr"></div>' +
    '<div class="fld"><label>موبایل</label><input type="text" id="nLMob" value="' + (l?escP(l.mob||''):'') + '" style="direction:ltr"></div></div>' +
    '<div class="fr"><div class="fld"><label>ایمیل</label><input type="email" id="nLMail" value="' + (l?escP(l.email||''):'') + '" style="direction:ltr"></div>' +
    '<div class="fld"><label>منبع آشنایی</label><select id="nLSrc">' + srcOpts + '</select></div></div>' +
    '<div class="fr"><div class="fld"><label>تاریخ اولین تماس *</label>' + (typeof ptfDatePicker==='function'?ptfDatePicker('nLFirst',l&&l.firstISO?l.firstISO:todayISO()):'<input type="text" id="nLFirst" value="'+gDateToFa(l&&l.firstISO?l.firstISO:todayISO())+'" placeholder="1405/04/19" style="direction:ltr">') + '<small id="nLFirstFa" style="color:#94a3b8">شمسی</small></div>' +
    '<div class="fld"><label>برآورد ارزش (ریال)</label><input type="text" inputmode="numeric" data-money="1" autocomplete="off" id="nLVal" value="' + (l&&l.val?(+l.val).toLocaleString('en-US'):'') + '" style="direction:ltr"></div></div>' +
    '<div class="fld"><label>شرح نیاز</label><textarea id="nLNeed" rows="2">' + (l?escP(l.need||''):'') + '</textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button type="button" class="bt" onclick="saveLead(' + (l ? "'" + l.cd + "'" : 'null') + ')">' + (l?'ذخیره':'ثبت لید') + '</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  var di = document.getElementById('nLFirst');
  di.addEventListener('input', function(){ document.getElementById('nLFirstFa').textContent = (typeof ptfJToISO==='function' && ptfJToISO(di.value)) ? '✓ ' + ptfJToISO(di.value) : 'فرمت: 1405/04/19'; });
}

function saveLead(cd) {
  var co = document.getElementById('nLCo').value.trim();
  if (!co) { alert('نام شرکت الزامی است'); return; }
  var firstISO = (typeof ptfJToISO==='function') ? ptfJToISO(document.getElementById('nLFirst').value) : document.getElementById('nLFirst').value;
  if (!firstISO) { alert('تاریخ اولین تماس الزامی است'); return; }
  var leads = getData('ptf_crm_leads');
  var rec;
  if (cd) {
    rec = leads.filter(function(x){ return x.cd === cd; })[0];
  } else {
    rec = { cd: genCode('LEAD'), stage: 'new', hist: [], createdFa: faDate(), createdISO: todayISO() };
    leads.unshift(rec);
  }
  rec.co = co;
  rec.person = document.getElementById('nLPer').value.trim();
  rec.role = document.getElementById('nLRole').value.trim();
  rec.ind = document.getElementById('nLInd').value;
  rec.tel = document.getElementById('nLTel').value.trim();
  rec.mob = document.getElementById('nLMob').value.trim();
  rec.email = document.getElementById('nLMail').value.trim();
  rec.src = document.getElementById('nLSrc').value;
  rec.firstISO = firstISO;
  rec.firstFa = gDateToFa(firstISO);
  rec.val = ptfNum(document.getElementById('nLVal').value);
  rec.need = document.getElementById('nLNeed').value.trim();
  // US-174: جلوگیری از لید تکراری (نام شرکت / تلفن / موبایل) + چک با مشتریان موجود
  if (typeof ptfDupBlock === 'function') {
    if (ptfDupBlock('lead', rec, cd)) { if (!cd) leads.shift(); return; }
    var dupCust = ptfCheckDup('customer', { co: rec.co, tel: rec.tel, mob: rec.mob }, null);
    if (dupCust.length) { alert(dedupMsg(dupCust) + '\n\n💡 این اطلاعات قبلاً به‌عنوان «مشتری» ثبت شده — نیازی به لید جدید نیست.'); if (!cd) leads.shift(); return; }
  }
  if (!cd) { if (typeof dedupStamp === 'function') dedupStamp(rec); rec.hist.push({ t: faDateTime(), k: 'ثبت', tx: 'لید ثبت شد — منبع: ' + rec.src }); }
  /* v34.8.14 (C3-گام۱): ذخیرهٔ سرنخ با فرمان اتمیک سروری؛ legacy فقط وقتی فرمان خاموش است. */
  if (window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED['ptf_crm_leads'] && typeof window.ptfEntityUpsert === 'function') {
    window.ptfEntityUpsert('ptf_crm_leads', rec, { cb: function (st) { if (st.state !== 'acked' && typeof ptfToast === 'function') ptfToast((typeof window.ptfEntityCommandMessage === 'function' ? window.ptfEntityCommandMessage(st, 'ذخیرهٔ سرنخ') : 'ذخیرهٔ سرنخ روی سرور قطعی نشد؛ دوباره تلاش کنید'), 'warn'); try { renderLeads(); } catch (eRr) {} } });
  } else setData('ptf_crm_leads', leads);
  hideModal(); renderLeads();
  addLog('لید ' + co + (cd ? ' ویرایش' : ' ثبت') + ' شد');
}

/* ---- کارت لید: تاریخچه پیگیری + تغییر وضعیت + تبدیل ---- */
function showLeadCard(cd) {
  var l = getData('ptf_crm_leads').filter(function(x){ return x.cd === cd; })[0];
  if (!l) return;
  var st = stageOf(l.stage);
  var stBtns = LEAD_STAGES.map(function(s) {
    if (s.id === l.stage) return '<span style="background:' + s.cl + ';color:#fff;border-radius:9px;padding:4px 10px;font-size:11.5px">' + s.lb + '</span>';
    return '<button class="bt bt-o" style="padding:4px 10px;font-size:11.5px" onclick="leadSetStage(\'' + cd + '\',\'' + s.id + '\')">' + s.lb + '</button>';
  }).join(' ');
  var hist = (l.hist || []).slice().reverse().map(function(hh) {
    return '<div style="border-right:2px solid var(--brd);padding:4px 10px 4px 0;margin-bottom:5px;font-size:12px">' +
      '<span style="color:#94a3b8;font-size:11px">' + escP(hh.t) + (hh.by ? ' — ' + escP(hh.by) : '') + '</span> <b style="color:#334155">[' + escP(hh.k) + ']</b> ' + escP(hh.tx) +
      (hh.next ? '<div style="color:#d97706;font-size:11px">اقدام بعدی: ' + escP(hh.next) + (hh.nextFa ? ' — ' + escP(hh.nextFa) : '') + '</div>' : '') + '</div>';
  }).join('') || '<div style="color:#94a3b8;font-size:12px">پیگیری ثبت نشده</div>';
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:680px;max-height:92vh;overflow:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;flex-wrap:wrap">' +
    '<h3 style="margin:0">' + escP(l.co) + ' <small style="color:#94a3b8;font-size:12px">' + escP(l.cd) + '</small></h3>' +
    '<div style="display:flex;gap:6px">' +
    '<button class="bt bt-o" style="font-size:12px" onclick="hideModal();showLeadModal(\'' + cd + '\')">✏️ ویرایش</button>' +
    (l.stage !== 'won' ? '<button class="bt" style="font-size:12px;background:#10b981" onclick="leadConvert(\'' + cd + '\')">🤝 تبدیل به مشتری</button>' : '') +
    '<button class="bt bt-o" style="font-size:12px;color:#dc2626" onclick="leadDel(\'' + cd + '\')">🗑️</button>' +
    '</div></div>' +
    '<div style="font-size:12.5px;color:#475569;margin:8px 0;line-height:2">' +
    (l.person ? '👤 ' + escP(l.person) + (l.role ? ' (' + escP(l.role) + ')' : '') + ' &nbsp; ' : '') +
    (l.mob ? '<a href="tel:' + escP(l.mob) + '">📱 ' + escP(l.mob) + '</a> &nbsp; ' : '') +
    (l.tel ? '<a href="tel:' + escP(l.tel) + '">☎️ ' + escP(l.tel) + '</a> &nbsp; ' : '') +
    (l.email ? '<a href="mailto:' + escP(l.email) + '">📧 ' + escP(l.email) + '</a>' : '') + '<br>' +
    '🏭 ' + escP(l.ind||'-') + ' | منبع: ' + escP(l.src||'-') + ' | تماس اول: <b>' + escP(l.firstFa||'-') + '</b>' +
    (l.val ? ' | برآورد: <b>' + (+l.val).toLocaleString('fa-IR') + ' ریال</b>' : '') +
    (l.need ? '<br>📝 ' + escP(l.need) : '') +
    (l.convFa ? '<br>✅ تاریخ تبدیل به مشتری: <b>' + escP(l.convFa) + '</b>' : '') +
    (l.lostWhy ? '<br>❌ دلیل از دست رفتن: ' + escP(l.lostWhy) : '') +
    '</div>' +
    '<div style="margin:10px 0"><b style="font-size:12.5px">وضعیت:</b> ' + stBtns + '</div>' +
    '<h4 style="margin:14px 0 6px">📞 ثبت پیگیری جدید</h4>' +
    '<div class="fr"><div class="fld"><label>نوع</label><select id="fuKind"><option>تماس</option><option>جلسه</option><option>ایمیل</option><option>پیامک</option></select></div>' +
    '<div class="fld"><label>تاریخ اقدام بعدی (اختیاری)</label>' + (typeof ptfDatePicker==='function'?ptfDatePicker('fuNext',''):'<input type="text" id="fuNext" placeholder="1405/04/19" style="direction:ltr">') + '</div></div>' +
    '<div class="fld"><label>خلاصه مذاکره / نتیجه</label><textarea id="fuTx" rows="2"></textarea></div>' +
    '<div class="fld"><label>اقدام بعدی</label><input type="text" id="fuNextTx" placeholder="مثال: ارسال کاتالوگ ولو"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:8px">' +
    '<button class="bt" style="font-size:12.5px" onclick="leadFollowUp(\'' + cd + '\')">ثبت پیگیری</button></div>' +
    '<h4 style="margin:10px 0 6px">🕓 تاریخچه</h4>' + hist +
    '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="hideModal()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

function currentUserSession() {
  try { return JSON.parse(localStorage.getItem('ptf_crm_session')) || {}; } catch(e){ return {}; }
}
function currentUserName() {
  var s = currentUserSession();
  return s ? (s.name || '') : '';
}
function currentUserId() {
  var s = currentUserSession();
  return s ? (s.user || '') : '';
}
function allUsersLite() {
  try {
    return (getData('ptf_crm_users') || []).map(function(u){
      return { id: (u.username || u.user || ''), name: (u.name || u.nm || u.username || u.user || '') };
    }).filter(function(u){ return u.id; });
  } catch(e) { return []; }
}
function remParticipants(r) {
  var ids = [];
  if (r && r.ownerUser) ids.push(r.ownerUser);
  (r && r.shareUsers || []).forEach(function(u){ if (u && ids.indexOf(u) < 0) ids.push(u); });
  return ids;
}
function remIsMine(r) {
  var meId = currentUserId();
  var meName = currentUserName();
  var ids = remParticipants(r);
  if (meId && ids.indexOf(meId) > -1) return true;
  /* سازگاری با یادآورهای legacy که فقط by داشتند */
  return !ids.length && r && r.by === meName;
}
function remTargetNames(r) {
  var map = {};
  allUsersLite().forEach(function(u){ map[u.id] = u.name || u.id; });
  var names = [];
  if (r && r.ownerUser) names.push(map[r.ownerUser] || r.ownerName || r.by || r.ownerUser);
  (r && r.shareUsers || []).forEach(function(id){
    var nm = map[id] || id;
    if (nm && names.indexOf(nm) < 0) names.push(nm);
  });
  if (!names.length && r && r.by) names.push(r.by);
  return names;
}

function leadFollowUp(cd) {
  var tx = document.getElementById('fuTx').value.trim();
  if (!tx) { alert('خلاصه پیگیری را بنویسید'); return; }
  var leads = getData('ptf_crm_leads');
  var l = leads.filter(function(x){ return x.cd === cd; })[0];
  if (!l) return;
  var nextISO = (typeof ptfJToISO==='function') ? ptfJToISO(document.getElementById('fuNext').value) : document.getElementById('fuNext').value;
  var ev = { t: faDateTime(), by: currentUserName(), k: document.getElementById('fuKind').value, tx: tx,
    next: document.getElementById('fuNextTx').value.trim(), nextISO: nextISO, nextFa: gDateToFa(nextISO) };
  l.hist = l.hist || [];
  l.hist.push(ev);
  if (nextISO) { l.nextISO = nextISO; l.nextFa = gDateToFa(nextISO); }
  /* v34.8.27 (W4) */
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_leads', leads, { reason: 'w4' });
  else setData('ptf_crm_leads', leads);
  // اگر اقدام بعدی دارد → یادآور خودکار
  if (nextISO) {
    addReminder({ title: 'پیگیری لید: ' + l.co + (ev.next ? ' — ' + ev.next : ''), topic: 'پیگیری لید',
      dueISO: nextISO, pri: 'متوسط', link: { kind: 'lead', cd: cd, lb: l.co } });
  }
  hideModal(); showLeadCard(cd); renderLeads();
  addLog('پیگیری لید ' + l.co + ' ثبت شد');
}

function leadSetStage(cd, stage, opt) {
  opt = opt || {};
  if (!leadStageKnown(stage)) return;
  var leads = getData('ptf_crm_leads');
  var l = leads.filter(function(x){ return x.cd === cd; })[0];
  if (!l || leadStageId(l) === stage) return;
  if (stage === 'lost') {
    var why = null;
    if (typeof ptfDialog === 'function') {
      ptfDialog({
        title: '❌ دلیل از دست رفتن لید',
        fields: [{ id: 'why', label: 'دلیل (الزامی)', type: 'textarea', rows: 2, required: true }],
        danger: true, okText: 'ثبت باخت',
        onOk: function (v) { leadLoseCommit(cd, v.why, opt); }
      });
      return;
    }
    why = prompt('دلیل از دست رفتن این لید؟ (الزامی)');
    if (!why || !why.trim()) return;
    leadLoseCommit(cd, why, opt);
    return;
  }
  if (stage === 'won') { leadConvert(cd, opt); return; }
  var old = stageOf(l.stage).lb;
  l.stage = stage;
  l.hist = l.hist || [];
  l.hist.push({ t: faDateTime(), by: currentUserName(), k: 'وضعیت', tx: old + ' ← ' + stageOf(stage).lb });
  /* v34.8.27 (W4) */
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_leads', leads, { reason: 'w4' });
  else setData('ptf_crm_leads', leads);
  if (opt.fromPipeline) {
    LEAD_MOBILE_STAGE = stage;
    renderLeads();
    if (typeof ptfToast === 'function') ptfToast('مرحلهٔ «' + l.co + '» به «' + stageOf(stage).lb + '» تغییر کرد', 'ok');
    addLog('مرحلهٔ لید ' + l.co + ' به «' + stageOf(stage).lb + '» تغییر کرد');
    return;
  }
  hideModal(); showLeadCard(cd); renderLeads();
}

// US-153: ثبت باخت لید (از مودال استاندارد یا fallback)
function leadLoseCommit(cd, why, opt) {
  opt = opt || {};
  if (!why || !String(why).trim()) return;
  var leads = getData('ptf_crm_leads');
  var l = leads.filter(function(x){ return x.cd === cd; })[0];
  if (!l) return;
  var old = stageOf(l.stage).lb;
  l.lostWhy = String(why).trim();
  l.stage = 'lost';
  l.hist = l.hist || [];
  l.hist.push({ t: faDateTime(), by: currentUserName(), k: 'وضعیت', tx: old + ' ← ' + stageOf('lost').lb + ' (' + l.lostWhy + ')' });
  /* v34.8.27 (W4) */
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_leads', leads, { reason: 'w4' });
  else setData('ptf_crm_leads', leads);
  if (opt.fromPipeline) {
    LEAD_MOBILE_STAGE = 'lost';
    renderLeads();
  } else {
    hideModal(); showLeadCard(cd); renderLeads();
  }
  if (typeof ptfToast === 'function') ptfToast('باخت لید ثبت شد', 'warn');
  addLog('باخت لید ' + l.co + ' ثبت شد');
}

/* ---- تبدیل به مشتری (AC6) ---- */
function leadConvert(cd, opt) {
  opt = opt || {};
  var leads = getData('ptf_crm_leads');
  var l = leads.filter(function(x){ return x.cd === cd; })[0];
  if (!l) return;
  if (!confirm('لید «' + l.co + '» به کارفرما (مشتری بالفعل) تبدیل شود؟\nاطلاعات و تاریخچه منتقل می‌شود.')) return;
  var custs = getData('ptf_crm_customers');
  // جلوگیری از تکرار
  var dup = custs.filter(function(c){ return c.co === l.co; })[0];
  var newCd;
  if (dup) { newCd = dup.cd; }
  else {
    newCd = genCode('CUST');
    custs.unshift({
      cd: newCd, co: l.co, ind: l.ind || 'سایر',
      people: l.person ? [{ nm: l.person, nmEn: '', role: l.role || 'رابط اصلی', dept: '',
        tels: l.tel ? [{ n: l.tel, ext: '', lb: '' }] : [],
        mobs: l.mob ? [{ n: l.mob, lb: '' }] : [],
        mails: l.email ? [{ n: l.email, lb: '' }] : [], note: 'منتقل‌شده از لید ' + l.cd, primary: true }] : [],
      coTels: [], coWeb: '', coAddr: '',
      con: l.person || '', ph: l.mob || l.tel || '',
      fromLead: l.cd
    });
    /* v34.8.22 (W1): تبدیل سرنخ به مشتری با فرمان اتمیک سروری. */
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_customers', custs, { reason: 'lead-convert' });
    else setData('ptf_crm_customers', custs);
  }
  l.stage = 'won';
  l.convFa = faDate();
  l.convISO = todayISO();
  l.custCd = newCd;
  l.hist = l.hist || [];
  l.hist.push({ t: faDateTime(), by: currentUserName(), k: 'تبدیل', tx: 'تبدیل به مشتری بالفعل — کد کارفرما: ' + newCd + (dup ? ' (موجود)' : ' (جدید)') });
  /* v34.8.27 (W4) */
  if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_leads', leads, { reason: 'w4' });
  else setData('ptf_crm_leads', leads);
  if (opt.fromPipeline) {
    LEAD_MOBILE_STAGE = 'won';
    renderLeads();
  } else {
    hideModal(); renderLeads();
  }
  alert('✅ «' + l.co + '» به فهرست کارفرمایان اضافه شد (' + newCd + ')');
  addLog('لید ' + l.co + ' به مشتری تبدیل شد');
}

function leadDel(cd) {
  if (!cd) return;
  var ok = true;
  try {
    if (window.dialogx && typeof window.dialogx.confirm === 'function') {
      window.dialogx.confirm('این لید حذف شود؟', { icon: '🗑', title: 'حذف سرنخ', danger: true, okLabel: 'حذف شود' }).then(function (yes) {
        if (yes) ptfLeadDelDo(cd);
      });
      return;
    }
  } catch (eDlg) {}
  if (!confirm('این لید حذف شود؟')) return;
  ptfLeadDelDo(cd);
}
function ptfLeadDelDo(cd) {
  try {
    if (typeof ptfDeleteGuard === 'function' && ptfDeleteGuard('lead', cd, 'لید ' + cd)) return;
  } catch (eG) {}
  /* v34.8.14 (C3-گام۱): حذف سرنخ با فرمان سروری + tombstone. */
  if (window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED['ptf_crm_leads'] && typeof window.ptfEntityDelete === 'function') {
    window.ptfEntityDelete('ptf_crm_leads', cd, { reason: 'حذف سرنخ از UI', cb: function (st) { if (st.state !== 'acked' && typeof ptfToast === 'function') ptfToast((typeof window.ptfEntityCommandMessage === 'function' ? window.ptfEntityCommandMessage(st, 'حذف سرنخ') : 'حذف سرنخ روی سرور قطعی نشد؛ دوباره تلاش کنید'), 'warn'); try { renderLeads(); } catch (eR2) {} } });
  } else setData('ptf_crm_leads', getData('ptf_crm_leads').filter(function(x){ return x.cd !== cd; }));
  try { if (typeof hideModal === 'function') hideModal(); } catch (eH) {}
  try { renderLeads(); } catch (eR) {}
  try { if (typeof addLog === 'function') addLog('لید ' + cd + ' حذف شد'); } catch (eL) {}
  try { if (typeof ptfToast === 'function') ptfToast('🗑 سرنخ حذف شد', 'warn'); } catch (eT) {}
}
window.leadDel = leadDel;
window.ptfLeadDelDo = ptfLeadDelDo;
window.delLead = leadDel; /* alias برای guards.js قدیمی */

/* ---- گزارش تبدیل (AC7) ---- */
function showLeadReport() {
  var leads = getData('ptf_crm_leads');
  var total = leads.length;
  var won = leads.filter(function(l){ return l.stage === 'won'; });
  var lost = leads.filter(function(l){ return l.stage === 'lost'; });
  var open_ = total - won.length - lost.length;
  var rate = total ? Math.round(won.length * 100 / total) : 0;
  // میانگین زمان تبدیل
  var days = won.filter(function(l){ return l.firstISO && l.convISO; }).map(function(l) {
    return Math.max(0, Math.round((new Date(l.convISO) - new Date(l.firstISO)) / 864e5));
  });
  var avg = days.length ? Math.round(days.reduce(function(a,b){return a+b;},0) / days.length) : 0;
  // تفکیک منبع و صنعت
  var bySrc = {}, byInd = {};
  leads.forEach(function(l) {
    bySrc[l.src||'?'] = bySrc[l.src||'?'] || { t:0, w:0 };
    bySrc[l.src||'?'].t++; if (l.stage==='won') bySrc[l.src||'?'].w++;
    byInd[l.ind||'?'] = byInd[l.ind||'?'] || { t:0, w:0 };
    byInd[l.ind||'?'].t++; if (l.stage==='won') byInd[l.ind||'?'].w++;
  });
  var rows = function(obj) {
    return Object.keys(obj).map(function(k) {
      var v = obj[k];
      return '<tr><td>' + escP(k) + '</td><td>' + v.t + '</td><td>' + v.w + '</td><td>' + (v.t ? Math.round(v.w*100/v.t) : 0) + '٪</td></tr>';
    }).join('');
  };
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px;max-height:90vh;overflow:auto">' +
    '<h3>📊 گزارش تبدیل لیدها</h3>' +
    '<div class="sr" style="grid-template-columns:repeat(4,1fr)">' +
    '<div class="sc"><b>' + total + '</b><span>کل لیدها</span></div>' +
    '<div class="sc"><b style="color:#10b981">' + won.length + '</b><span>تبدیل‌شده</span></div>' +
    '<div class="sc"><b style="color:#ef4444">' + lost.length + '</b><span>از دست رفته</span></div>' +
    '<div class="sc"><b>' + open_ + '</b><span>باز</span></div></div>' +
    '<div style="font-size:13.5px;margin:10px 0">نرخ تبدیل: <b style="color:#0e7490">' + rate + '٪</b> | میانگین زمان تبدیل از اولین تماس: <b>' + avg + ' روز</b></div>' +
    '<h4 style="margin:10px 0 6px">به تفکیک منبع آشنایی</h4>' +
    '<div class="tb2"><table><thead><tr><th>منبع</th><th>تعداد</th><th>تبدیل</th><th>نرخ</th></tr></thead><tbody>' + rows(bySrc) + '</tbody></table></div>' +
    '<h4 style="margin:10px 0 6px">به تفکیک صنعت</h4>' +
    '<div class="tb2"><table><thead><tr><th>صنعت</th><th>تعداد</th><th>تبدیل</th><th>نرخ</th></tr></thead><tbody>' + rows(byInd) + '</tbody></table></div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="bt bt-o" onclick="hideModal()">بستن</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
}

function exportLeadsCsv() {
  var leads = getData('ptf_crm_leads');
  if (!leads.length) { alert('لیدی ثبت نشده'); return; }
  var rows = [['کد','شرکت','رابط','سمت','صنعت','تلفن','موبایل','ایمیل','منبع','تاریخ تماس اول','وضعیت','ارزش برآوردی','تاریخ تبدیل','دلیل باخت']];
  leads.forEach(function(l) {
    rows.push([l.cd,l.co,l.person||'',l.role||'',l.ind||'',l.tel||'',l.mob||'',l.email||'',l.src||'',l.firstFa||'',stageOf(l.stage).lb,l.val||'',l.convFa||'',l.lostWhy||'']);
  });
  var csv = '\uFEFF' + rows.map(function(r){ return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(','); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'ptf-leads-' + todayISO() + '.csv';
  a.click();
}

/* ============================================================
   REMINDERS — یادآورها (AC4, AC5)
   ============================================================ */
/* v13.9 (US-341 — مصوبه تیم): یادآورهای مهم فرآیند بازرگانی شرکت */
var REM_TOPICS = ['پیگیری لید','پیگیری استعلام','وصول مطالبات','سررسید چک صادره','اعتبار پیشنهاد مالی (Validity)','پیگیری پاسخ درخواست تامین','پیگیری وندور لیست','تمدید ضمانت‌نامه بانکی','تمدید گواهینامه/ISO','ترخیص و حمل کالا','تحویل به کارفرما','جلسه/بازدید','سایر'];
var REM_PRIS = [{id:'فوری',cl:'#ef4444'},{id:'متوسط',cl:'#f59e0b'},{id:'عادی',cl:'#64748b'}];

function addReminder(r) {
  var me = currentUserSession();
  var shareUsers = (r.shareUsers || []).filter(Boolean).filter(function(u, i, a){ return a.indexOf(u) === i && u !== (me.user || ''); });
  var row = {
    cd: genCode('REM'), title: r.title, topic: r.topic || 'سایر',
    dueISO: r.dueISO, dueFa: gDateToFa(r.dueISO), dueTime: r.dueTime || '',
    pri: r.pri || 'عادی', link: r.link || null, note: r.note || '',
    st: 'open', createdFa: faDate(),
    by: currentUserName(),
    ownerUser: me.user || '', ownerName: me.name || currentUserName(),
    shareUsers: shareUsers, notifiedUsers: {}
  };
  /* v34.8.14 (C3-گام۱): ثبت یادآور با فرمان اتمیک سروری (کلید این ماژول کامل شد). */
  if (window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED['ptf_crm_reminders'] && typeof window.ptfEntityUpsert === 'function') {
    window.ptfEntityUpsert('ptf_crm_reminders', row, { cb: function (st) { if (st.state !== 'acked' && typeof ptfToast === 'function') ptfToast((typeof window.ptfEntityCommandMessage === 'function' ? window.ptfEntityCommandMessage(st, 'ثبت یادآور') : 'ثبت یادآور روی سرور قطعی نشد؛ دوباره تلاش کنید'), 'warn'); updateRemBadge(); } });
  } else {
    var rems = getData('ptf_crm_reminders');
    rems.unshift(row);
    /* v34.8.27 (W4) */
    if (window.ptfEntitySaveCollection) window.ptfEntitySaveCollection('ptf_crm_reminders', rems, { reason: 'w4' });
    else setData('ptf_crm_reminders', rems);
  }
  updateRemBadge();
}

function remState(r) {
  if (r.st !== 'open') return r.st; // done | snoozed handled via dueISO
  var today = todayISO();
  if (r.dueISO < today) return 'over';
  if (r.dueISO === today) return 'today';
  return 'future';
}

function buildReminders() {
  var topicOpts = '<option value="">همه موضوعات</option>' + REM_TOPICS.map(function(t){ return '<option>' + t + '</option>'; }).join('');
  /* MOB-035: toolbar یادآورها از .sb2 عمومی جداست؛ input و action در 320px
     دیگر با هم فشرده نمی‌شوند و action ایجاد برچسب قابل‌دیدن دارد. */
  return '<div class="ph reminders-head"><h3>⏰ یادآورها</h3>' +
    '<div class="reminders-toolbar">' +
      '<select class="reminders-select" id="rmTopic" aria-label="فیلتر موضوع یادآورها" onchange="renderReminders()">' + topicOpts + '</select>' +
      '<select class="reminders-select" id="rmBy" aria-label="فیلتر مالک یادآورها" onchange="renderReminders()"><option value="__me">فقط یادآورهای من</option><option value="">همه کاربران</option></select>' +
      '<div class="reminders-footer">' +
        '<label class="reminders-toggle" for="rmDone"><input type="checkbox" id="rmDone" onchange="renderReminders()"><span>نمایش انجام‌شده‌ها</span></label>' +
        '<button class="bt reminders-new-action" type="button" title="ثبت یادآور جدید" aria-label="ثبت یادآور جدید" onclick="showRemModal()"><span class="reminders-action-icon" aria-hidden="true">⏰</span><span class="reminders-action-label">یادآور جدید</span></button>' +
      '</div>' +
    '</div></div>' +
    '<div id="rmWrap"></div>';
}

function renderReminders() {
  var el = document.getElementById('rmWrap');
  if (!el) return;
  var topic = (document.getElementById('rmTopic')||{}).value || '';
  var showDone = (document.getElementById('rmDone')||{}).checked;
  var byFilter = (document.getElementById('rmBy')||{}).value || '__me';
  var me = currentUserName();
  var rems = getData('ptf_crm_reminders').filter(function(r) {
    if (topic && r.topic !== topic) return false;
    if (!showDone && r.st === 'done') return false;
    if (byFilter === '__me' && !remIsMine(r)) return false;
    return true;
  });
  // مرتب‌سازی: عقب‌افتاده > امروز > آینده > انجام‌شده؛ درون هر گروه بر اساس تاریخ و اولویت
  var ord = { over: 0, today: 1, future: 2, done: 3 };
  var pOrd = { 'فوری': 0, 'متوسط': 1, 'عادی': 2 };
  rems.sort(function(a, b) {
    var sa = a.st === 'done' ? 'done' : remState(a), sb = b.st === 'done' ? 'done' : remState(b);
    if (ord[sa] !== ord[sb]) return ord[sa] - ord[sb];
    if (a.dueISO !== b.dueISO) return a.dueISO < b.dueISO ? -1 : 1;
    return (pOrd[a.pri]||2) - (pOrd[b.pri]||2);
  });
  var h = '';
  rems.forEach(function(r) {
    var stt = r.st === 'done' ? 'done' : remState(r);
    var band = stt === 'over' ? '#ef4444' : stt === 'today' ? '#f59e0b' : stt === 'done' ? '#cbd5e1' : '#0ea5e9';
    var badge = stt === 'over' ? '<span style="background:#fee2e2;color:#b91c1c;border-radius:8px;padding:1px 8px;font-size:11px">عقب‌افتاده</span>'
      : stt === 'today' ? '<span style="background:#fef3c7;color:#b45309;border-radius:8px;padding:1px 8px;font-size:11px">امروز</span>'
      : stt === 'done' ? '<span style="background:#f1f5f9;color:#64748b;border-radius:8px;padding:1px 8px;font-size:11px">انجام شد</span>' : '';
    var pri = REM_PRIS.filter(function(p){ return p.id === r.pri; })[0] || REM_PRIS[2];
    var targets = remTargetNames(r);
    h += '<div style="background:#fff;border:1px solid var(--brd);border-right:4px solid ' + band + ';border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center' + (stt==='done'?';opacity:.6':'') + '">' +
      '<div style="font-size:13px"><b>' + escP(r.title) + '</b> ' + badge +
      '<div style="font-size:11.5px;color:#64748b;margin-top:3px">📅 ' + escP(r.dueFa) + (r.dueTime ? ' ' + escP(r.dueTime) : '') +
      ' | <span style="color:' + pri.cl + '">' + escP(r.pri) + '</span> | ' + escP(r.topic) +
      (targets.length ? ' | 👥 ' + escP(targets.join('، ')) : '') +
      (r.link ? ' | 🔗 <a href="javascript:void(0)" onclick="remOpenLink(\'' + r.cd + '\')" style="color:#0e7490">' + escP(r.link.lb) + '</a>' : '') +
      (r.note ? '<br>📝 ' + escP(r.note) : '') + '</div></div>' +
      '<div style="display:flex;gap:5px">' +
      (r.st !== 'done' ? '<button class="bt" style="padding:4px 10px;font-size:12px;background:#10b981" onclick="remDone(\'' + r.cd + '\')">✔ انجام شد</button>' +
      '<button class="bt bt-o" style="padding:4px 10px;font-size:12px" onclick="remSnooze(\'' + r.cd + '\')">⏳ تعویق</button>' : '') +
      '<button class="bt bt-o" style="padding:4px 10px;font-size:12px;color:#dc2626" onclick="remDel(\'' + r.cd + '\')">🗑️</button>' +
      '</div></div>';
  });
  el.innerHTML = h || '<div style="text-align:center;color:#94a3b8;padding:24px">یادآوری ثبت نشده</div>';
  updateRemBadge();
}

function updateRemBadge() {
  var n = getData('ptf_crm_reminders').filter(function(r) {
    return r.st === 'open' && r.dueISO <= todayISO() && remIsMine(r);
  }).length;
  var b = document.getElementById('rmBadge');
  if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
}

function showRemModal() {
  var topicOpts = REM_TOPICS.map(function(t){ return '<option>' + t + '</option>'; }).join('');
  var priOpts = REM_PRIS.map(function(p){ return '<option>' + p.id + '</option>'; }).join('');
  var meId = currentUserId();
  var users = allUsersLite().filter(function(u){ return u.id !== meId; });
  var shareHtml = users.length
    ? '<div class="fld"><label>نمایش برای کاربران دیگر (اختیاری)</label><div style="display:flex;gap:8px;flex-wrap:wrap;background:#f8fafc;border:1px solid var(--brd);border-radius:10px;padding:8px 10px">' +
        users.map(function(u){ return '<label style="font-size:12px;display:flex;align-items:center;gap:4px"><input type="checkbox" class="rm-share" value="' + escP(u.id) + '"> ' + escP(u.name || u.id) + '</label>'; }).join('') +
        '</div><small style="color:#64748b">به‌صورت پیش‌فرض یادآور فقط برای شماست؛ در صورت نیاز می‌توانید یک یا چند کاربر دیگر را هم انتخاب کنید.</small></div>'
    : '';
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px">' +
    '<h3>⏰ یادآور جدید</h3>' +
    '<div class="fld"><label>عنوان *</label><input type="text" id="nRmT"></div>' +
    '<div class="fr"><div class="fld"><label>موضوع</label><select id="nRmTopic">' + topicOpts + '</select></div>' +
    '<div class="fld"><label>اولویت</label><select id="nRmPri">' + priOpts + '</select></div></div>' +
    '<div class="fr"><div class="fld"><label>تاریخ سررسید *</label>' + (typeof ptfDatePicker==='function'?ptfDatePicker('nRmDue',todayISO()):'<input type="text" id="nRmDue" value="'+gDateToFa(todayISO())+'" placeholder="1405/04/19" style="direction:ltr">') + '<small id="nRmDueFa" style="color:#94a3b8">شمسی</small></div>' +
    '<div class="fld"><label>ساعت (اختیاری)</label><input type="time" id="nRmTime" style="direction:ltr"></div></div>' +
    shareHtml +
    '<div class="fld"><label>یادداشت</label><textarea id="nRmNote" rows="2"></textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bt bt-o" onclick="hideModal()">انصراف</button>' +
    '<button class="bt" onclick="saveRem()">ثبت</button></div></div></div>';
  document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  var di = document.getElementById('nRmDue');
  di.addEventListener('input', function(){ document.getElementById('nRmDueFa').textContent = (typeof ptfJToISO==='function' && ptfJToISO(di.value)) ? '✓ ' + ptfJToISO(di.value) : 'فرمت: 1405/04/19'; });
}

function saveRem() {
  var t = document.getElementById('nRmT').value.trim();
  var due = (typeof ptfJToISO==='function') ? ptfJToISO(document.getElementById('nRmDue').value) : document.getElementById('nRmDue').value;
  if (!t || !due) { alert('عنوان و تاریخ سررسید الزامی است'); return; }
  var shareUsers = Array.prototype.slice.call(document.querySelectorAll('.rm-share:checked')).map(function(el){ return el.value; });
  addReminder({ title: t, topic: document.getElementById('nRmTopic').value,
    dueISO: due, dueTime: document.getElementById('nRmTime').value,
    pri: document.getElementById('nRmPri').value, note: document.getElementById('nRmNote').value.trim(), shareUsers: shareUsers });
  hideModal(); renderReminders();
  addLog('یادآور «' + t + '» ثبت شد' + (shareUsers.length ? ' و برای ' + shareUsers.length + ' کاربر دیگر هم قابل مشاهده شد' : ''));
}

function remDone(cd) {
  var rems = getData('ptf_crm_reminders');
  var row = null;
  rems.forEach(function(r){ if (r.cd === cd) { r.st = 'done'; r.doneFa = faDate(); r.doneBy = currentUserName(); row = r; } });
  /* v34.8.13 (PHASE-C2 پایلوت): یادآور با فرمان اتمیک سروری ثبت می‌شود؛
     مسیر legacy فقط وقتی فرمان در دسترس/فعال نیست. */
  if (row && window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED['ptf_crm_reminders'] && typeof window.ptfEntityUpsert === 'function') {
    window.ptfEntityUpsert('ptf_crm_reminders', row, { cb: function (st) { if (st.state !== 'acked' && typeof ptfToast === 'function') ptfToast((typeof window.ptfEntityCommandMessage === 'function' ? window.ptfEntityCommandMessage(st, 'ثبت «انجام شد» یادآور') : 'ثبت «انجام شد» روی سرور قطعی نشد؛ وضعیت را بازبینی کنید'), 'warn'); renderReminders(); } });
  } else setData('ptf_crm_reminders', rems);
  try { if (typeof window.ntfResolveByRef === 'function') window.ntfResolveByRef(cd); } catch (eNR) {} /* v33.4.1: یادآور انجام شد — اعلان مرتبط برای همه حذف شود */
  renderReminders();
}

function remSnooze(cd) {
  var d = prompt('چند روز تعویق؟ (عدد)', '3');
  var n = parseInt(d, 10);
  if (!n || n < 1) return;
  var rems = getData('ptf_crm_reminders');
  var row = null;
  rems.forEach(function(r){
    if (r.cd === cd) {
      var nd = new Date(r.dueISO < todayISO() ? todayISO() : r.dueISO);
      nd.setDate(nd.getDate() + n);
      r.dueISO = nd.toISOString().slice(0,10);
      r.dueFa = gDateToFa(r.dueISO);
      r.msgSent = false;
      r.notifiedUsers = {};
      row = r;
    }
  });
  /* v34.8.13 (PHASE-C2 پایلوت): تعویق با فرمان سروری. */
  if (row && window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED['ptf_crm_reminders'] && typeof window.ptfEntityUpsert === 'function') {
    window.ptfEntityUpsert('ptf_crm_reminders', row, { cb: function (st) { if (st.state !== 'acked' && typeof ptfToast === 'function') ptfToast((typeof window.ptfEntityCommandMessage === 'function' ? window.ptfEntityCommandMessage(st, 'تعویق یادآور') : 'تعویق روی سرور قطعی نشد؛ دوباره تلاش کنید'), 'warn'); renderReminders(); } });
  } else setData('ptf_crm_reminders', rems);
  renderReminders();
}

function remDel(cd) {
  if (!confirm('یادآور حذف شود؟')) return;
  /* v34.8.13 (PHASE-C2 پایلوت): حذف با فرمان سروری + tombstone (عدم زنده‌شدن روی دستگاه‌های stale). */
  if (window.PTF_ENTITY_CMD_ENABLED && window.PTF_ENTITY_CMD_ENABLED['ptf_crm_reminders'] && typeof window.ptfEntityDelete === 'function') {
    window.ptfEntityDelete('ptf_crm_reminders', cd, { reason: 'حذف یادآور از UI', cb: function (st) {
      if (st.state !== 'acked' && typeof ptfToast === 'function') ptfToast((typeof window.ptfEntityCommandMessage === 'function' ? window.ptfEntityCommandMessage(st, 'حذف یادآور') : 'حذف روی سرور قطعی نشد؛ دوباره تلاش کنید'), 'warn');
      renderReminders();
    } });
  } else setData('ptf_crm_reminders', getData('ptf_crm_reminders').filter(function(r){ return r.cd !== cd; }));
  try { if (typeof window.ntfResolveByRef === 'function') window.ntfResolveByRef(cd); } catch (eNR) {} /* v33.4.1: یادآور حذف شد — اعلان مرتبط برای همه حذف شود */
  renderReminders();
}

function remOpenLink(cd) {
  var r = getData('ptf_crm_reminders').filter(function(x){ return x.cd === cd; })[0];
  if (!r || !r.link) return;
  if (r.link.kind === 'lead') { hideModal(); if (typeof ptfNavGoto === 'function') ptfNavGoto('leads', { kind: 'lead', id: r.link.cd }); else { goPanelByName('leads'); setTimeout(function(){ showLeadCard(r.link.cd); }, 150); } }
}

function goPanelByName(name) {
  var btns = document.querySelectorAll('.sb-i');
  for (var i = 0; i < btns.length; i++) {
    if ((btns[i].getAttribute('onclick')||'').indexOf("'" + name + "'") > -1) { btns[i].click(); return; }
  }
}

/* ---- ویجت داشبورد: یادآورهای امروز/عقب‌افتاده (AC5) ---- */
function dashRemindersHtml() {
  var rems = getData('ptf_crm_reminders').filter(function(r){ return r.st === 'open' && r.dueISO <= todayISO() && remIsMine(r); });
  if (!rems.length) return '';
  rems.sort(function(a,b){ return a.dueISO < b.dueISO ? -1 : 1; });
  var items = rems.slice(0, 6).map(function(r) {
    var over = r.dueISO < todayISO();
    return '<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px dashed #fecaca">' +
      '<span>' + (over ? '🔴' : '🟠') + ' ' + escP(r.title) + '</span><span style="color:#94a3b8;font-size:11px">' + escP(r.dueFa) + '</span></div>';
  }).join('');
  return '<div style="background:#fff5f5;border:1px solid #fecaca;border-radius:16px;padding:14px 16px;margin-bottom:14px">' +
    '<h4 style="margin:0 0 8px;font-size:13.5px;color:#b91c1c">⏰ یادآورهای امروز و عقب‌افتاده (' + rems.length + ')</h4>' + items +
    '<div style="text-align:left;margin-top:6px"><a href="javascript:void(0)" onclick="goPanelByName(\'rem\')" style="font-size:12px;color:#0e7490">مشاهده همه ←</a></div></div>';
}

// تزریق ویجت به داشبورد + بج‌ها هنگام لود
(function() {
  var _origBuild = typeof buildDashboard === 'function' ? buildDashboard : null;
  if (_origBuild) {
    buildDashboard = function() { return dashRemindersHtml() + _origBuild(); };
  }
  setTimeout(function(){ updateRemBadge(); updateLeadBadge(); }, 400);
})();

/* v24.6: export سراسری API سرنخ برای onclick مودال/لیست */
window.showLeadModal = showLeadModal;
window.saveLead = saveLead;
window.showLeadCard = showLeadCard;
window.leadFollowUp = leadFollowUp;
window.leadSetStage = leadSetStage;
window.leadConvert = leadConvert;
window.renderLeads = renderLeads;
window.buildLeads = buildLeads;
window.showLeadReport = showLeadReport;


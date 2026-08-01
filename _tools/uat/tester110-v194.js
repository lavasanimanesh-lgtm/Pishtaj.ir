/* tester110 — v19.4 (اسپرینت ۵ از R12 — پایان رودمپ: US-437 مختومه‌سازی فقط پس از تحویل موفق و تسویه کامل + کنترل اسناد) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.4+', (function () { var m = idx.match(/var VER = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.4; })());
T('کش sw >= v19.4', (function () { var m = sw.match(/ptf-crm-v([0-9.]+)/); return m && parseFloat(m[1]) >= 19.4; })());
T('cache-bust salesfiles >= 19.4', (function () { var m = idx.match(/salesfiles\.js\?v=([0-9.]+)/); return m && parseFloat(m[1]) >= 19.4; })());

SECTION('US-437 — ساختار کد: کنترل پیش از مختومه');
T('هسته ممیزی قابل تست sfCloseAudit → {blockers, warns, docs}', sf.indexOf('window.sfCloseAudit') > -1 && sf.indexOf('out.blockers.push') > -1);
T('AC1: مدرک تحویل الزامی و مستقل از مرحله (ضد دور زدن با پرداخت نقدی) = blocker سخت (با مسیر تأیید صریح UR-12)', sf.indexOf("ev.type === 'delivered'") > -1 && sf.indexOf("if (!hasDelivery) {") > -1 && sf.indexOf("out.blockers.push({ id: 'delivery'") > -1 && sf.indexOf("deliveryConfirmed") > -1 && sf.indexOf("rfqD.st === 'st7'") > -1);
T('AC1: مطالبات باز = بدون تیک تسویه، مختومه ممنوع', sf.indexOf('با مطالبات باز نمی‌توان مختومه کرد (US-437)') > -1);
T('سد برنامه‌ای نه فقط UI (درس US-371): commit هم blocker را چک می‌کند', sf.indexOf('window.sfCloseSettledCommit') > -1 && sf.indexOf('if (au.blockers.length) return false;') > -1);
T('UR-12: بدهی تامین‌کننده از کنترل مختومه مستقل است (نه blocker و نه هشدار)', sf.indexOf("id: 'payable'") === -1 && sf.indexOf('بستن پرونده فروش لزوماً به معنای') > -1);
T('هشدار QC عدم انطباق بدون ثبت زیان (کیس R9)', sf.indexOf("id: 'qc'") > -1 && sf.indexOf('بدون ثبت زیان/رفع') > -1);
T('AC2: کنترل اسناد ۹گانه پیش از بایگانی (سند برد/فاکتور/ارسال/QC/هزینه/...)', sf.indexOf('out.docs = { award:') > -1 && sf.indexOf('ship: (r.shipEvents || []).length') > -1);
T('مهاجرت نرم سند برد قبل از کنترل + هشدار نبود آن', sf.indexOf("sfAwardEnsure === 'function') sfAwardEnsure(r); /* مهاجرت نرم سند برد قبل از کنترل */") > -1 && sf.indexOf("id: 'award'") > -1);
T('مودال کنترل: چک‌لیست + مرحله + دکمه قفل هنگام blocker', sf.indexOf('🏁 کنترل پیش از مختومه') > -1 && sf.indexOf('🔒 مختومه قفل است') > -1);
T('چک‌باکس تسویه (US-324 حفظ‌شده): پیش‌فرض تیک', sf.indexOf('id="sfClsSettle" checked') > -1 && sf.indexOf("how: 'تسویه هنگام مختومه شدن پرونده'") > -1);
T('audit عبور کنترل با فهرست هشدارها', sf.indexOf('کنترل پیش از مختومه US-437 عبور کرد') > -1);
T('AC4: مسیر lost/بدون فاکتور با دلیل استاندارد محفوظ', sf.indexOf('sfLostModal(cd);') > -1 && sf.indexOf('window.sfCloseLost = function (cd, reasonId, note)') > -1);
T('AC3: انتقال کامل به بایگانی پابرجا (award/qc/ship/cost/loss)', ['awardDocs: (r.awardDocs || []).slice()', 'qcEvents: (r.qcEvents || []).slice()', 'shipEvents: (r.shipEvents || []).slice()', 'costEvents: (r.costEvents || []).slice()', 'lossEvents: (r.lossEvents || []).slice()'].every(function (k) { return sf.indexOf(k) > -1; }));

SECTION('رفتاری — sfCloseAudit / sfCloseSettledCommit');
global.window = global;
global.curSession = function () { return { user: 'lavasani', name: 'حامد لاوسانی' }; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.faDate = function () { return '1405/04/21'; };
global.faDateTime = function () { return '1405/04/21 13:00'; };
global.notify = function () { return 'NTF-1'; };
(function () {
  global.sfAll = function () { return getData('ptf_crm_deals'); };
  global.sfSave = function (l) { setData('ptf_crm_deals', l); };
  global.sfDocsOf = function (r) {
    return { offers: getData('ptf_crm_offers').filter(function (o) { return o.inqNo === r.inqNo; }), letters: [], misc: r.docs || [], invoices: getData('ptf_crm_invoices').filter(function (i) { return i.offerNo === 'CO-7'; }), supply: [] };
  };
  global.ptfPayableRemain = function (p) { var paid = (p.paid || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0); return Math.max(0, (+p.amount || 0) - paid); };
  global.sfAwardEnsure = function (r) { return r.awardDocs || []; };
  eval(sf.match(/window\.PTF_SF_STAGES = \[[\s\S]*?\];/)[0]);
  eval(sf.match(/window\.sfStageOf = function \(r\) \{[\s\S]*?\n  \};/)[0].replace(/var d = sfDocsOf\(/, 'var d = global.sfDocsOf('));
  eval(sf.match(/window\.sfStageLabel = function \(r\) \{[\s\S]*?\n  \};/)[0]);
  var mA = sf.match(/window\.sfCloseAudit = function \(r\) \{[\s\S]*?\n  \};/);
  T('استخراج sfCloseAudit', !!mA);
  if (!mA) return;
  eval(mA[0].replace(/var d = sfDocsOf\(/, 'var d = global.sfDocsOf(').replace(/sfStageOf === 'function'\) \? sfStageOf\(r\)/, "sfStageOf === 'function') ? global.sfStageOf(r)"));
  var mC = sf.match(/window\.sfCloseSettledCommit = function \(cd, settleOpen(?:, settleReason)?\) \{[\s\S]*?\n  \};/);
  T('استخراج sfCloseSettledCommit', !!mC);
  if (!mC) return;
  global._archived = null;
  global.sfArchive = function (r, kind, keep) { global._archived = { cd: r.cd, kind: kind, keep: keep }; };
  eval(mC[0].replace(/sfAll\(\)/g, 'global.sfAll()').replace(/sfCloseAudit\(r\)/, 'global.sfCloseAudit(r)').replace(/sfArchive\(r, 'settled', true\)/, "global.sfArchive(r, 'settled', true)"));

  /* سناریو ۱: فاکتور هست ولی تحویل ثبت نشده → blocker + رد commit */
  setData('ptf_crm_rfqs', [{ cd: 'INQ-7', st: 'st8' }]);
  setData('ptf_crm_offers', [{ no: 'CO-7', kind: 'CO', inqNo: 'INQ-7' }]);
  setData('ptf_crm_invoices', [{ cd: 'I7', offerNo: 'CO-7', amount: 500000, payments: [{ amt: 500000 }] }]);
  setData('ptf_crm_payables', []);
  var deal = { cd: 'D7', inqNo: 'INQ-7', wonOffer: 'CO-7', docs: [], awardDocs: [{ no: 'CO-7' }] };
  setData('ptf_crm_deals', [deal]);
  var au1 = sfCloseAudit(deal);
  T('بدون تحویل: blocker delivery (با اینکه فاکتور تسویه است)', au1.blockers.length === 1 && au1.blockers[0].id === 'delivery');
  T('commit رد می‌شود — سد برنامه‌ای', sfCloseSettledCommit('D7', true) === false && global._archived === null);

  /* سناریو ۲: تحویل ثبت شد + تسویه کامل → بدون blocker → مختومه موفق */
  deal.shipEvents = [{ cd: 'S1', type: 'delivered', receiver: 'رضایی', t: '', by: '' }];
  setData('ptf_crm_deals', [deal]);
  var au2 = sfCloseAudit(deal);
  T('تحویل + تسویه کامل: بدون blocker و بدون هشدار مطالبات', au2.blockers.length === 0 && !au2.warns.some(function (w) { return w.id === 'recv'; }));
  T('کنترل اسناد: award=1، invoices=1، ship=1 شمارش شد (AC2)', au2.docs.award === 1 && au2.docs.invoices === 1 && au2.docs.ship === 1);
  T('commit موفق → بایگانی settled با اسناد کامل', sfCloseSettledCommit('D7', false) === true && global._archived && global._archived.kind === 'settled' && global._archived.keep === true);

  /* سناریو ۳: مطالبات باز + تیک تسویه → payment خودکار سپس بایگانی */
  global._archived = null;
  setData('ptf_crm_invoices', [{ cd: 'I7', offerNo: 'CO-7', amount: 500000, payments: [{ amt: 200000 }] }]);
  setData('ptf_crm_deals', [deal]);
  var au3 = sfCloseAudit(deal);
  T('مانده ۳۰۰,۰۰۰: هشدار recv (blocker نرم)', au3.blockers.length === 0 && au3.warns.some(function (w) { return w.id === 'recv'; }) && au3.remainSum === 300000);
  T('commit با settleOpen=true → تسویه خودکار + بایگانی', sfCloseSettledCommit('D7', true) === true && global._archived !== null);
  var iv = getData('ptf_crm_invoices')[0];
  var paidAll = iv.payments.reduce(function (s, p) { return s + p.amt; }, 0);
  T('payment خودکار autoSettle ثبت شد (جمع = مبلغ فاکتور)', paidAll === 500000 && iv.payments.some(function (p) { return p.autoSettle === true; }));

  /* سناریو ۴: هشدار بدهی تامین‌کننده + QC عدم انطباق بدون زیان */
  setData('ptf_crm_invoices', [{ cd: 'I7', offerNo: 'CO-7', amount: 500000, payments: [{ amt: 500000 }] }]);
  setData('ptf_crm_payables', [{ cd: 'P1', inqNo: 'INQ-7', sup: 'WIKA', pay: 'credit', amount: 900000, paid: [] }]);
  deal.qcEvents = [{ cd: 'Q1', type: 'report', conf: 'nonconform', desc: 'مغایرت' }];
  delete deal.lossEvents;
  setData('ptf_crm_deals', [deal]);
  var au4 = sfCloseAudit(deal);
  T('UR-12: با بدهی باز تامین‌کننده هیچ هشدار/بلوکی در مختومه نیست', !au4.warns.some(function (w) { return w.id === 'payable'; }) && !au4.blockers.some(function (b) { return b.id === 'payable'; }));
  T('هشدار QC عدم انطباق بدون زیان', au4.warns.some(function (w) { return w.id === 'qc'; }));
  T('با ثبت زیان، هشدار QC رفع می‌شود', (function () { deal.lossEvents = [{ cd: 'L1', amt: 100 }]; setData('ptf_crm_deals', [deal]); return !sfCloseAudit(deal).warns.some(function (w) { return w.id === 'qc'; }); })());
  T('هشدارها مانع مختومه نیستند (فقط blocker سخت است)', sfCloseSettledCommit('D7', false) === true);
})();

SECTION('رگرسیون');
T('US-435/436 (v19.3) پابرجا', sf.indexOf('window.sfInvoiceRefCommit') > -1 && sf.indexOf('🧾 ارجاع فاکتور به حسابدار</button>') > -1);
T('US-433 موتور مراحل (v19.2) پابرجا', sf.indexOf('window.sfStageOf') > -1 && sf.indexOf('window.PTF_SF_STAGES') > -1);
T('US-432/434ف۱ (v19.1) پابرجا', sf.indexOf('window.sfAwardPrint') > -1 && sf.indexOf('window.sfQcCommit') > -1);
T('US-349 دلایل استاندارد باخت پابرجا', sf.indexOf('window.SF_LOST_REASONS') > -1 && sf.indexOf("closeReason: reasonId || (closeKind === 'settled' ? 'won' : '')") > -1);
T('حذف اسناد ابری مسیر lost پابرجا', sf.indexOf('sfDeleteCloud(miscKeys)') > -1);
T('BUG-027 (تحویل تعهدی) پابرجا', sf.indexOf('window.sfDueSave') > -1 && sf.indexOf('window.sfClearDue') > -1);

DONE('tester110-v194');

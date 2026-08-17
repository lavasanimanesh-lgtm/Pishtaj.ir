/* ============================================================
   دستیار تست ۱ — «جریان کامل کسب‌وکار» (End-to-End)
   سناریو: لید → تبدیل → درخواست → TO → CO → برنده → پرونده →
            PL جزئی → فاکتور → وصول → تسویه → تحلیلگر
   ============================================================ */
require('./harness');
console.log('🧑‍💼 TESTER-1: چرخه کامل کسب‌وکار');

loadFns('offers.js', ['offerSerial', 'numToWords']);
loadFns('projects.js', ['plRemaining', 'plSerial', 'prjSerial']);
loadFns('leads.js', ['gDateToFa', 'todayISO']);
loadFns('analyzer.js', ['anlOfferFunnel', 'anlForecast', '_daysBetween', '_anlWinStatsFallback']);

SECTION('۱. ثبت لید و تبدیل به مشتری');
setData('ptf_crm_leads', [{ cd:'LEAD-1', co:'پالایش پارس', person:'مهندس اکبری', mob:'0912', stage:'new', firstISO:'2026-06-01', hist:[], val:2e9, src:'وب‌سایت', ind:'نفت و گاز' }]);
var leads = getData('ptf_crm_leads');
leads[0].stage='nego'; setData('ptf_crm_leads', leads);
T('لید ثبت و مرحله تغییر کرد', getData('ptf_crm_leads')[0].stage==='nego');
// تبدیل
var custs = [{ cd:'CUST-100', co:'پالایش پارس', coEn:'Pars Refining Co.', people:[{nm:'مهندس اکبری', nmEn:'Mr. Akbari', role:'مدیر خرید', tels:[{n:'021-88', ext:'12'}], mobs:[{n:'0912'}], mails:[], primary:true}] }];
setData('ptf_crm_customers', custs);
leads[0].stage='won'; leads[0].convISO='2026-06-20'; leads[0].custCd='CUST-100'; setData('ptf_crm_leads', leads);
T('تبدیل: کارفرما با دفترچه تماس ساخته شد', getData('ptf_crm_customers')[0].people[0].nmEn==='Mr. Akbari');
T('زمان تبدیل = ۱۹ روز', _daysBetween('2026-06-01','2026-06-20')===19);

SECTION('۲. درخواست + اقلام اکسلی');
setData('ptf_crm_inqitems', [
  { inqNo:'REQ-501', cd:'I1', nm:'کابل ۱۶', en:'Cable 16mm', qty:5, un:'M' },
  { inqNo:'REQ-501', cd:'I2', nm:'ترانسمیتر', en:'Tx 3051', qty:2, un:'NO' }
]);
T('اقلام درخواست گروه شدند', getData('ptf_crm_inqitems').filter(r=>r.inqNo==='REQ-501').length===2);

SECTION('۳. TO → CO با شماره مستقل');
setData('ptf_crm_offers', []);
var toNo = offerSerial('TO');
setData('ptf_crm_offers', [{ no: toNo, kind:'TO', st:'sent', inqNo:'REQ-501', buyerCd:'CUST-100', buyerCo:'Pars Refining Co.', items:[{name:'Cable 16mm', qty:5, unit:'M'},{name:'Tx 3051', qty:2, unit:'NO'}] }]);
var coNo = offerSerial('CO');
var offers = getData('ptf_crm_offers');
offers.push({ no: coNo, kind:'CO', st:'won', inqNo:'REQ-501', buyerCd:'CUST-100', buyerCo:'Pars Refining Co.', dateEn:'2026-06-25',
  items:[{name:'Cable 16mm', qty:5, unit:'M', price:1200000},{name:'Tx 3051', qty:2, unit:'NO', price:850000000}], extraCols:[] });
setData('ptf_crm_offers', offers);
T('TO و CO با prefix و شماره مستقل', toNo !== coNo && /TO/.test(toNo) && /CO/.test(coNo));
var total = 5*1200000 + 2*850000000;
T('جمع CO = 1,706,000,000', total===1706000000);
T('عدد به حروف صحیح', numToWords(total).indexOf('One Billion Seven Hundred Six Million')>-1, numToWords(total));

SECTION('۴. پرونده پروژه + پکینگ لیست جزئی');
setData('ptf_crm_projects', [{ no: prjSerial(), offerNo: coNo, buyerCo:'Pars Refining Co.', state:'open', docs:[], timeline:[] }]);
setData('ptf_crm_packinglists', []);
T('پرونده PRJ-001', getData('ptf_crm_projects')[0].no==='PTF-PRJ-1405-001');
// PL اول: ۲ کابل از ۵ (سناریوی عینی کارفرما)
var pls = getData('ptf_crm_packinglists');
pls.push({ no: plSerial(), offerNo: coNo, lines:[{idx:0, qty:2}] });
setData('ptf_crm_packinglists', pls);
var rem = plRemaining(coNo);
T('PL#1 (۲ کابل): باقیمانده [3,2]', JSON.stringify(rem)==='[3,2]');
// PL دوم: باقی همه
pls = getData('ptf_crm_packinglists');
pls.push({ no: plSerial(), offerNo: coNo, lines:[{idx:0, qty:3},{idx:1, qty:2}] });
setData('ptf_crm_packinglists', pls);
T('PL#2: تحویل کامل [0,0]', JSON.stringify(plRemaining(coNo))==='[0,0]');
// ابطال PL دوم
pls = getData('ptf_crm_packinglists'); pls[1].voided = true; setData('ptf_crm_packinglists', pls);
T('ابطال PL#2: برگشت به [3,2]', JSON.stringify(plRemaining(coNo))==='[3,2]');
pls[1].voided = false; setData('ptf_crm_packinglists', pls);

SECTION('۵. فاکتور + وصول مرحله‌ای');
setData('ptf_crm_invoices', [{ cd:'INV-1', offerNo: coNo, no:'ACC-7701', amount: total, payments: [] }]);
var invs = getData('ptf_crm_invoices');
invs[0].payments.push({ amt: Math.round(total*0.3), how:'حواله', t:faDate() }); // پیش‌پرداخت ۳۰٪
setData('ptf_crm_invoices', invs);
var paid = invs[0].payments.reduce((s,p)=>s+p.amt,0);
T('وصول ۳۰٪', Math.abs(paid/total - 0.3) < 0.01);
// تسویه
invs[0].payments.push({ amt: total - paid, how:'چک', t:faDate() });
setData('ptf_crm_invoices', invs);
paid = invs[0].payments.reduce((s,p)=>s+p.amt,0);
T('تسویه کامل', paid === total);

SECTION('۶. تحلیلگر روی داده واقعی چرخه');
var f = anlOfferFunnel();
/* v34.7.17: نرخ برد با نمونهٔ کمتر از ۳ پیشنهاد نمایش داده نمی‌شود (F-08) و مخرج «کل پیشنهادهای
   صادرشده» است (F-01)؛ در این سناریو تنها CO موجود برنده است، پس پوشش ۱۰۰٪ و بی‌تکلیف صفر است. */
T('قیف: ۱ برنده، بدون پیشنهاد بی‌تکلیف، پوشش ۱۰۰٪', f.won===1 && f.open===0 && f.coverage===100);
T('نرخ برد با نمونهٔ ۱ نمایش داده نمی‌شود', f.winRateAll===null && f.winRateDecided===null);
T('ارزش برد = مبلغ CO (ریالی)', f.wonValue===total);
var fc = anlForecast();
T('مطالبات باز = 0 (تسویه شد)', fc.openRecv===0);
DONE('TESTER-1 (E2E Flow)');

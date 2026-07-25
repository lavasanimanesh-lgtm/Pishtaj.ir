/* ============================================================
   دستیار تست ۳ — «موارد مرزی و خرابکار» (نگاه QA بدبین)
   ورودی‌های خراب، صفر، منفی، یونیکد، XSS، حجم بالا
   ============================================================ */
require('./harness');
console.log('😈 TESTER-3: موارد مرزی، ورودی خراب، XSS');

loadFns('offers.js', ['offerSerial', 'numToWords']);
loadFns('projects.js', ['plRemaining']);
loadFns('letters.js', ['letAutoSize', 'letSerial', 'letNorm', 'letExtract']);
loadVar('letters.js', 'LET_STOP');
loadFns('analyzer.js', ['anlScoreLead']);
var path = require('path');
require(path.join(__dirname, '../../assets/js/ptf-tools.js'));
var TOOLS = global.PTF_TOOLS;

SECTION('۱. XSS: داده مخرب باید escape شود');
var evil = '<script>alert(1)</script>"><img onerror=x>';
T('escP خنثی می‌کند', escP(evil).indexOf('<script>') === -1 && escP(evil).indexOf('&lt;script&gt;') > -1);
T('escP روی null/undefined امن', escP(null) === '' && escP(undefined) === '');

SECTION('۲. numToWords موارد مرزی');
T('صفر', numToWords(0) === 'Zero');
T('اعشاری گرد می‌شود', numToWords(99.6) === 'One Hundred');
T('تریلیون', numToWords(2e12).indexOf('Two Trillion') > -1);
T('19 (مرز teen)', numToWords(19) === 'Nineteen');
T('20 (مرز tens)', numToWords(20) === 'Twenty');
T('105', numToWords(105) === 'One Hundred Five');

SECTION('۳. سریال‌ها با داده خراب');
setData('ptf_crm_offers', [{no:'GARBAGE'}, {no:null}, {no:'PTF-CO-1405-ABC'}, {no:'PTF-CO-1405-002'}]);
var safeCoSerial = offerSerial('CO');
T('داده خراب رد می‌شود و fallback رسمی نمی‌سازد', (/^PTF-CO-\d{4}-\d{3,}$/.test(safeCoSerial) || /^TMP-CO-\d+/.test(safeCoSerial)) && safeCoSerial !== 'PTF-CO-1405-ABC');
setData('ptf_crm_letters', []);
T('سریال از خالی = 0001 (v85.3)', letSerial('OUT') === '1405/پ/ص/0001');

SECTION('۴. پکینگ لیست: مرزها');
setData('ptf_crm_offers', [{no:'CO-X', kind:'CO', items:[{qty:5},{qty:0},{qty:'3'}]}]);
setData('ptf_crm_packinglists', []);
var rem = plRemaining('CO-X');
T('qty صفر و رشته‌ای هندل می‌شود', JSON.stringify(rem) === '[5,0,3]');
setData('ptf_crm_packinglists', [{offerNo:'CO-X', lines:[{idx:0, qty:99}]}]); // بیش از کل
rem = plRemaining('CO-X');
T('تحویل بیش از کل → کف صفر (نه منفی)', rem[0] === 0);
T('CO ناموجود → آرایه خالی', JSON.stringify(plRemaining('NOPE')) === '[]');

SECTION('۵. فونت تطبیقی نامه: مرزهای دقیق');
T('1500 کاراکتر → 14', letAutoSize('x'.repeat(1500)) === 14);
T('1501 → 13.5', letAutoSize('x'.repeat(1501)) === 13.5);
T('متن خالی → 14', letAutoSize('') === 14);
T('10000 → 12 (کف)', letAutoSize('x'.repeat(10000)) === 12);

SECTION('۶. نرمال‌سازی و استخراج نامه');
T('ی/ک عربی + ارقام فارسی', letNorm('يک ۱۲۳ کيلو') === 'یک 123 کیلو');
var ex = letExtract('', '');
T('متن خالی کرش نمی‌کند', Array.isArray(ex.keywords) && typeof ex.summary === 'string');
var exFa = letExtract('موضوع', 'شماره PTF-CO-1405-001 و مبلغ 5,000,000 ریال مهم است. جمله دوم اینجاست و طولانی‌تر است.');
T('شماره ارجاع استخراج شد', exFa.keywords.indexOf('ptf-co-1405-001') > -1);

SECTION('۷. ابزار مهندسی: ورودی نامعتبر');
var r = TOOLS.sizeCv({fluid:'liquid', Q:50, P1:5, P2:8, SG:1});
T('P2>P1 → خطای کنترل‌شده', !!r.err);
var r2 = TOOLS.pipeWeight('99', 'S40', 'cs', 10);
T('سایز ناموجود → null (نه کرش)', r2 === null);
var r3 = TOOLS.pipePressure({nps:'4', sch:'S80', mat:'cs', T:38, E:1, CA:99});
T('خوردگی بیشتر از ضخامت → فشار صفر نه منفی', r3.P_bar >= 0, 'got ' + r3.P_bar);
var r4 = TOOLS.trackTable(100, 'eqp');
T('ترک‌تیبل EQ% در ۰٪ = 0 (نه R^-1)', r4[0].cvPct === 0);

SECTION('۸. Lead Scoring مرزها');
T('لید خالی → امتیاز محدود', anlScoreLead({}) >= 0 && anlScoreLead({}) <= 100);
var maxL = { val: 9e9, ind:'نفت و گاز', src:'معرفی', stage:'offer', hist:[{k:'a'},{k:'b'},{k:'c'},{k:'d'},{k:'e'}] };
T('لید حداکثری ≤ 100', anlScoreLead(maxL) <= 100, 'got ' + anlScoreLead(maxL));

SECTION('۹. حجم بالا: 1000 لید');
var big = [];
for (var i = 0; i < 1000; i++) big.push({ cd:'L'+i, co:'شرکت '+i, stage: i%4===0?'won':'new', src:'وب‌سایت', firstISO:'2026-01-01', convISO:'2026-02-01', hist:[] });
setData('ptf_crm_leads', big);
var t0 = Date.now();
big.forEach(function (l) { anlScoreLead(l); });
var ms = Date.now() - t0;
T('امتیازدهی 1000 لید < 200ms', ms < 200, ms + 'ms');
DONE('TESTER-3 (Edge/Abuse)');

/* =====================================================================
   PTF Smart Assistant — v31.7.53 (US-107 + STORAGE-IDB-PUBLIC-CACHE-001)
   منشی هوشمند پیشرو تجهیز فرتاک — ویجت چت + موتور پاسخ محلی
   بدون وابستگی خارجی؛ فاز ۲: اتصال LLM
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfChatLoaded) return;
  window.__ptfChatLoaded = true;

  /* ---------- مسیر پایه (بر اساس محل خود اسکریپت) ---------- */
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src || '';
    var i = s.indexOf('assets/js/ptf-chat.js');
    return i > -1 ? s.slice(0, i) : '/';
  })();

  /* v31.7.33 WEB-MEAS-002: load privacy-first conversion metrics on all
     public pages that already include the chat widget (397/398 pages). */
  (function loadMetrics() {
    try {
      if (window.__ptfMetricsLoaded || document.querySelector('script[src*="ptf-metrics.js"]')) return;
      var m = document.createElement('script');
      m.src = BASE + 'assets/js/ptf-metrics.js';
      m.defer = true;
      document.head.appendChild(m);
    } catch (e) {}
  })();

  /* ---------- پیکربندی LLM (فاز ۲) ---------- */
  // v34.0.7-alpha: فعال شد — پروکسی سرور api/chat-llm.php در .htaccess دوباره باز شد
  // (کلید API فقط سمت سرور نگهداری می‌شود). اگر llm-config.php نباشد یا خطایی رخ دهد،
  // askLLM خودکار به موتور محلی KB برمی‌گردد (cb(null) → fallback).
  var LLM = { enabled: true, endpoint: BASE + 'api/chat-llm.php', timeoutMs: 12000 };

  function askLLM(question, history, cb) {
    if (!LLM.enabled) { cb(null); return; }
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, LLM.timeoutMs);
    fetch(LLM.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: question, h: history.slice(-6) }), signal: ctrl.signal
    }).then(function (r) { return r.json(); })
      .then(function (d) { clearTimeout(to); cb(d && d.ok ? d.answer : null); })
      .catch(function () { clearTimeout(to); cb(null); }); // fallback خودکار به موتور محلی
  }

  /* ---------- پایگاه دانش شرکت (AC2) ---------- */
  var KB = {
    company: {
      name: 'پیشرو تجهیز فرتاک',
      tel: '021-46087679',
      mobile: '09925868479',
      email: 'Info@pishrotajheez.ir',
      address: 'تهران، بلوار کوهک، مجتمع تجاری اداری طوبی، بلوک A اداری، طبقه ۱۶',
      hours: 'شنبه تا چهارشنبه ۸:۳۰ تا ۱۷ — پنجشنبه ۸:۳۰ تا ۱۳'
    },
    services: [
      { k: ['پایپینگ', 'لوله', 'فلنج', 'اتصالات', 'فیتینگ', 'گسکت'], lb: 'تامین تجهیزات پایپینگ (لوله مانیسمان و درزدار، فلنج، اتصالات، گسکت و پیچ‌ومهره)', url: 'services/piping-equipment/' },
      { k: ['شیر', 'ولو', 'valve', 'بال ولو', 'گیت', 'گلوب', 'کنترل ولو'], lb: 'تامین شیرآلات صنعتی (Gate, Globe, Ball, Check, Butterfly, Control Valve)', url: 'services/valves-supply.html' },
      { k: ['ابزار دقیق', 'ترانسمیتر', 'گیج', 'فلومتر', 'سطح سنج', 'روزمونت', 'ویکا'], lb: 'تامین تجهیزات ابزار دقیق (ترانسمیتر فشار/دما، گیج، فلومتر، سطح‌سنج)', url: 'services/instrumentation-equipment/' },
      { k: ['برق', 'تابلو', 'کابل', 'سوییچگیر', 'الکتروموتور', 'اینورتر', 'درایو'], lb: 'تامین تجهیزات برق صنعتی (تابلو، سوییچگیر، کابل، الکتروموتور، درایو)', url: 'services/electrical-equipment/' },
      { k: ['پمپ', 'pump', 'سانتریفیوژ'], lb: 'تامین انواع پمپ صنعتی (سانتریفیوژ، جابجایی مثبت — ANSI/API 610)', url: 'services/pumps/' },
      { k: ['کمپرسور', 'هوای فشرده', 'اسکرو'], lb: 'تامین کمپرسور و تجهیزات هوای فشرده', url: 'services/compressors/' },
      { k: ['بویلر', 'دیگ بخار', 'مشعل'], lb: 'تامین بویلر و تجهیزات بخار', url: 'services/boilers/' },
      { k: ['بازرسی', 'mtc', 'tpi', 'گواهی', 'تست'], lb: 'خدمات بازرسی و کنترل کیفیت (MTC، بازرسی شخص ثالث TPI، تست FAT)', url: 'services/inspection-quality.html' }
    ],
    industries: ['نفت و گاز', 'پتروشیمی', 'نیروگاه', 'فولاد', 'سیمان', 'آب و تصفیه'],
    brands: 'Emerson (Rosemount)، Endress+Hauser، WIKA، Siemens، ABB، Schneider، Danfoss، KSB، Grundfos، Jamesbury، Neway و بیش از ۴۳ برند معتبر دیگر',
    faqs: [
      { k: ['استعلام', 'قیمت', 'خرید', 'سفارش', 'rfq', 'پیش فاکتور'], a: 'برای دریافت قیمت، از سامانه استعلام هوشمند ما استفاده کنید — معمولاً در کمتر از ۲۴ ساعت کاری پاسخ می‌دهیم. 📋', link: { lb: 'ثبت استعلام آنلاین', url: 'rfq/' } },
      { k: ['رهگیری', 'پیگیری استعلام', 'وضعیت درخواست'], a: 'با شماره رهگیری که هنگام ثبت استعلام دریافت کردید، می‌توانید وضعیت پرونده را آنلاین ببینید.', link: { lb: 'رهگیری استعلام', url: 'tracking/' } },
      { k: ['گواهینامه', 'ایزو', 'iso'], a: 'شرکت دارای گواهینامه‌های ISO 9001:2015، ISO 10002 و ISO 10004 از مرجع GQS آلمان است.', link: { lb: 'مشاهده گواهینامه‌ها', url: 'about/certificates/' } },
      { k: ['کاتالوگ', 'دیتاشیت', 'دانلود'], a: 'کاتالوگ‌ها و مدارک فنی در مرکز دانلود در دسترس است.', link: { lb: 'مرکز دانلود', url: 'catalog/' } },
      { k: ['تامین کننده', 'همکاری', 'فروشنده'], a: 'اگر تامین‌کننده هستید، از فرم ثبت‌نام تامین‌کنندگان استفاده کنید تا در شبکه تامین ما قرار بگیرید.', link: { lb: 'ثبت‌نام تامین‌کنندگان', url: 'supplier/' } },
      { k: ['ادرس', 'آدرس', 'دفتر', 'کجاست', 'کجایید', 'موقعیت', 'لوکیشن'], a: '📍 ' + 'تهران، بلوار کوهک، مجتمع تجاری اداری طوبی، بلوک A اداری، طبقه ۱۶' },
      { k: ['تلفن', 'تماس', 'شماره'], a: '☎️ خط ویژه: 021-46087679\n📱 مهندسی فروش: 09925868479\n📧 Info@pishrotajheez.ir' },
      { k: ['ساعت', 'کاری', 'باز'], a: '🕓 ساعات کاری: شنبه تا چهارشنبه ۸:۳۰ تا ۱۷ — پنجشنبه ۸:۳۰ تا ۱۳' },
      { k: ['برند', 'مارک', 'سازنده'], a: 'ما با بیش از ۴۳ برند معتبر جهانی کار می‌کنیم از جمله: Emerson، E+H، WIKA، Siemens، ABB، KSB و…', link: { lb: 'مشاهده برندها', url: '#brands' } },
      { k: ['مقاله', 'دانش', 'آموزش', 'راهنما'], a: 'مرکز دانش ما بیش از ۲۵۰ مقاله تخصصی درباره لوله، شیرآلات، ابزار دقیق و استانداردها دارد.', link: { lb: 'مرکز دانش', url: 'knowledge-center/' } },
      { k: ['زمان تحویل', 'چند روز', 'کی میرسه', 'موجودی', 'انبار'], a: 'زمان تحویل بسته به کالا متفاوت است: اقلام موجود در انبار معمولاً ظرف چند روز کاری و اقلام سفارشی/وارداتی طبق زمان اعلامی در پیشنهاد. زمان دقیق در پاسخ استعلام شما قید می‌شود.', link: { lb: 'ثبت استعلام', url: 'rfq/' } },
      { k: ['پرداخت', 'پیش پرداخت', 'تسویه', 'اقساط', 'چک'], a: 'شرایط پرداخت (درصد پیش‌پرداخت و نحوه تسویه) برای هر معامله در پیشنهاد مالی مشخص می‌شود و قابل مذاکره است.', link: { lb: 'استعلام و دریافت شرایط', url: 'rfq/' } },
      { k: ['گارانتی', 'ضمانت', 'وارانتی'], a: 'کالاها با گارانتی اصالت و ضمانت ۱۲ ماهه در برابر عیوب ساخت (طبق شرایط سازنده) تحویل می‌شوند + امکان ارائه MTC و بازرسی TPI.', link: { lb: 'تضمین کیفیت', url: 'quality/' } },
      { k: ['اصالت', 'اورجینال', 'فیک', 'تقلبی'], a: 'اصالت کالا خط قرمز ماست: تامین از نمایندگی‌های رسمی و منابع معتبر + گواهی MTC + امکان بازرسی شخص ثالث (SGS, BV, DNV).', link: { lb: 'نظام تضمین کیفیت', url: 'quality/' } },
      { k: ['سایزینگ', 'محاسبه cv', 'محاسبه وزن', 'ترک تیبل', 'اریفیس', 'ابزار محاسبه', 'تحمل فشار'], a: 'ابزارهای مهندسی رایگان ما: سایزینگ ولو کنترلی (Cv/Kv)، سایزینگ PRV با اریفیس API 526، وزن متریال، تحمل فشار B31.3 و ترک‌تیبل — همه با خروجی PDF.', link: { lb: 'ابزارهای مهندسی', url: 'tools/' } },
      { k: ['مشاور متریال', 'انتخاب متریال', 'چه گریدی', 'چه متریالی', 'کدوم گرید', 'انتخاب ولو', 'چه لوله'], a: 'مشاور هوشمند انتخاب متریال ما در ۳ کلیک گرید، استاندارد و نکات فنی را پیشنهاد می‌دهد — از لوله و فلنج تا ولو، برق، ابزار دقیق و پمپ.', link: { lb: 'مشاور انتخاب متریال', url: 'assistant/' } },
      { k: ['واردات', 'خارجی', 'ارز', 'گمرک', 'ترخیص'], a: 'تامین از منابع خارجی با مدیریت کامل واردات، حمل و ترخیص انجام می‌شود — شما فقط کالا را درب پروژه تحویل می‌گیرید.', link: { lb: 'خدمات لجستیک', url: 'logistics/' } }
    ],
    kcSuggest: [
      { k: ['a106', 'مانیسمان'], lb: 'راهنمای لوله A106', url: 'knowledge-center/a106-gr-b.html' },
      { k: ['فلنج'], lb: 'راهنمای انواع فلنج', url: 'blog/flange-types-guide.html' },
      { k: ['بال ولو', 'ball'], lb: 'راهنمای انتخاب بال ولو', url: 'blog/ball-valve-selection-guide.html' },
      { k: ['ترانسمیتر', 'روزمونت', '3051'], lb: 'راهنمای ترانسمیتر فشار', url: 'blog/pressure-transmitter-guide.html' }
    ]
  };

  /* ---------- موتور پاسخ محلی (AC3-الف) ---------- */
  function norm(t) {
    return (t || '').toLowerCase()
      .replace(/[يی]/g, 'ی').replace(/[كک]/g, 'ک')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[۰-۹]/g, function (d) { return '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]; });
  }
  function hasAny(t, keys) {
    for (var i = 0; i < keys.length; i++) if (t.indexOf(norm(keys[i])) > -1) return true;
    return false;
  }

  function answer(q) {
    var t = norm(q);
    // سلام و خداحافظی
    if (/^(سلام|درود|hi|hello|سلام علیکم|وقت بخیر)/.test(t.trim()))
      return { a: 'سلام! 👋 من دستیار هوشمند پیشرو تجهیز فرتاک هستم.\nدرباره تامین تجهیزات (پایپینگ، شیرآلات، ابزار دقیق، برق، پمپ…)، استعلام قیمت، رهگیری پرونده یا اطلاعات شرکت بپرسید.' };
    if (/(خداحافظ|بای|ممنون|مرسی|تشکر)/.test(t))
      return { a: 'خواهش می‌کنم! 🙏 اگر سوال دیگری داشتید در خدمتم. برای استعلام قیمت هم می‌توانید از دکمه زیر استفاده کنید.', link: { lb: 'ثبت استعلام', url: 'rfq/' } };

    // خدمات — امتیازدهی: اگر چند خدمت در سوال بود، همه را معرفی کن
    var hits = [];
    for (var i = 0; i < KB.services.length; i++)
      if (hasAny(t, KB.services[i].k)) hits.push(KB.services[i]);
    if (hits.length >= 2) {
      var names = hits.map(function (s) { return s.lb.split('(')[0].trim(); }).join('، ');
      return { a: 'بله! همه این موارد در حوزه خدمات ماست:\n• ' + hits.map(function(s){return s.lb;}).join('\n• ') + '\n\nبرای دریافت قیمت یکجا، همه اقلام را در یک استعلام ثبت کنید.', link: { lb: 'ثبت استعلام چندقلمی', url: 'rfq/' }, link2: { lb: hits[0].lb.split('(')[0].trim(), url: hits[0].url } };
    }
    if (hits.length === 1) {
      var svc = hits[0];
      var res = { a: 'بله! ' + svc.lb + ' از خدمات اصلی ماست.\nبرای دریافت قیمت، استعلام ثبت کنید یا با کارشناسان تماس بگیرید: 021-46087679', link: { lb: 'صفحه این خدمت', url: svc.url }, link2: { lb: 'استعلام قیمت', url: 'rfq/' } };
      for (var j = 0; j < KB.kcSuggest.length; j++)
        if (hasAny(t, KB.kcSuggest[j].k)) { res.link3 = { lb: 'مقاله: ' + KB.kcSuggest[j].lb, url: KB.kcSuggest[j].url }; break; }
      return res;
    }
    // FAQ ها (بعد از خدمات)
    for (var i = 0; i < KB.faqs.length; i++)
      if (hasAny(t, KB.faqs[i].k)) return { a: KB.faqs[i].a, link: KB.faqs[i].link };

    // صنایع
    for (var i = 0; i < KB.industries.length; i++)
      if (t.indexOf(norm(KB.industries[i])) > -1)
        return { a: 'ما سابقه تامین تجهیزات برای صنعت ' + KB.industries[i] + ' را داریم — از پروژه‌های EPC تا اورهال.\nنیاز مشخصی دارید؟ استعلام ثبت کنید تا کارشناس مربوطه پیگیری کند.', link: { lb: 'صنایع ما', url: 'industries/' }, link2: { lb: 'استعلام', url: 'rfq/' } };

    // شماره رهگیری (عدد بلند)
    if (/\b\d{5,}\b/.test(t) && /(رهگیر|پیگیر|وضعیت|track)/.test(t))
      return { a: 'برای بررسی این شماره رهگیری، لطفاً از صفحه رهگیری استفاده کنید:', link: { lb: 'رهگیری استعلام', url: 'tracking/' } };

    // پیش‌فرض
    return {
      a: 'سوال خوبی است! برای پاسخ دقیق‌تر پیشنهاد می‌کنم:\n۱) استعلام آنلاین ثبت کنید تا کارشناس فنی پاسخ دهد\n۲) یا مستقیم تماس بگیرید: 021-46087679\n\nهمچنین می‌توانید گفتگو را با دکمه «ارسال به کارشناس» برای ما بفرستید تا با شما تماس بگیریم.',
      link: { lb: 'ثبت استعلام', url: 'rfq/' },
      unknown: true
    };
  }

  /* ---------- UI ویجت (AC1) ---------- */
  var css = '#ptfChatBtn{position:fixed;bottom:20px;left:20px;z-index:9990;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;font-size:26px;box-shadow:0 12px 30px rgba(239,75,26,.4);transition:.25s;display:grid;place-items:center}' +
    '#ptfChatBtn:hover{transform:scale(1.08)}' +
    '#ptfChatBtn .dot{position:absolute;top:2px;right:2px;width:13px;height:13px;border-radius:50%;background:#22c55e;border:2px solid #fff}' +
    '#ptfChatBox{position:fixed;bottom:90px;left:20px;z-index:9991;width:min(360px,calc(100vw - 30px));height:min(520px,calc(100vh - 120px));background:#fff;border-radius:20px;box-shadow:0 25px 60px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl}' +
    '#ptfChatBox.open{display:flex}' +
    '.ptfc-hd{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;padding:13px 16px;display:flex;justify-content:space-between;align-items:center}' +
    '.ptfc-hd b{font-size:14.5px;display:block}.ptfc-hd small{font-size:11px;opacity:.9}' +
    '.ptfc-hd button{background:rgba(255,255,255,.2);border:0;color:#fff;width:28px;height:28px;border-radius:9px;cursor:pointer;font-size:14px}' +
    '.ptfc-body{flex:1;overflow-y:auto;padding:14px;background:#f7f8fa}' +
    '.ptfc-m{max-width:85%;padding:9px 13px;border-radius:15px;margin-bottom:9px;font-size:13px;line-height:1.9;white-space:pre-wrap;word-break:break-word}' +
    '.ptfc-bot{background:#fff;border:1px solid #eceef1;border-radius:15px 15px 15px 4px;color:#2f3237}' +
    '.ptfc-user{background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;margin-right:auto;margin-left:0;border-radius:15px 15px 4px 15px}' +
    '.ptfc-lnk{display:inline-block;margin:4px 4px 0 0;padding:6px 11px;border-radius:10px;background:rgba(239,75,26,.09);color:#c73616;font-size:12px;font-weight:800;text-decoration:none}' +
    '.ptfc-lnk:hover{background:rgba(239,75,26,.16)}' +
    '.ptfc-quick{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;background:#f7f8fa}' +
    '.ptfc-quick button{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 11px;font-size:11.5px;cursor:pointer;color:#374151;font-family:inherit}' +
    '.ptfc-quick button:hover{border-color:#ef4b1a;color:#ef4b1a}' +
    '.ptfc-ft{display:flex;gap:8px;padding:10px;background:#fff;border-top:1px solid #eef0f3}' +
    '.ptfc-ft input{flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:9px 12px;font-size:13px;font-family:inherit;outline:none}' +
    '.ptfc-ft input:focus{border-color:#f79400}' +
    '.ptfc-ft button{border:0;border-radius:12px;background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;width:42px;cursor:pointer;font-size:16px}' +
    '.ptfc-send2{text-align:center;padding:4px 0 8px;background:#fff}' +
    '.ptfc-send2 a{font-size:11px;color:#94a3b8;cursor:pointer;text-decoration:underline}' +
    '@media(max-width:600px){#ptfChatBtn{width:46px;height:46px;bottom:14px;left:12px;font-size:20px}#ptfChatBox{bottom:70px}body{padding-bottom:70px}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'ptfChatBtn';
  btn.setAttribute('aria-label', 'گفتگو با دستیار هوشمند');
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg><span class="dot"></span>';
  document.body.appendChild(btn);

  var box = document.createElement('div');
  box.id = 'ptfChatBox';
  box.innerHTML =
    '<div class="ptfc-hd"><div><b>دستیار هوشمند پیشرو تجهیز فرتاک</b><small>🟢 پاسخگوی سوالات شما</small></div><button id="ptfcClose" aria-label="بستن">✕</button></div>' +
    '<div class="ptfc-body" id="ptfcBody"></div>' +
    '<div class="ptfc-quick" id="ptfcQuick"></div>' +
    '<div class="ptfc-ft"><input id="ptfcIn" type="text" placeholder="سوال خود را بنویسید..." maxlength="500"><button id="ptfcSend" aria-label="ارسال">➤</button></div>' +
    '<div class="ptfc-send2"><a id="ptfcToExpert">📨 ارسال گفتگو به کارشناس (تماس با من)</a></div>';
  document.body.appendChild(box);

  var body = document.getElementById('ptfcBody');
  var input = document.getElementById('ptfcIn');

  /* ---------- تاریخچه (AC5) — v31.7.53: full در IndexedDB، summary سبک در localStorage ---------- */
  var HKEY = 'ptf_chat_history';
  var DB_NAME = 'ptf-public-cache-v1';
  var DB_STORE = 'kv';
  var IDB_KEY = HKEY + ':idb-full';
  var MAX_IDB = 120;
  var MAX_LOCAL = 16;
  var chatSeq = 0;
  var chatMem = historyLocal();

  function idbOpen(cb) {
    try {
      if (!window.indexedDB) { cb(null); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { cb(req.result); };
      req.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function idbSet(id, value) {
    idbOpen(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ id: String(id), value: String(value), updatedAt: new Date().toISOString() });
        tx.oncomplete = function () { try { db.close(); } catch (e) {} };
        tx.onerror = function () { try { db.close(); } catch (e2) {} };
      } catch (e3) { try { db.close(); } catch (e4) {} }
    });
  }
  function idbGet(id, cb) {
    idbOpen(function (db) {
      if (!db) { cb(null); return; }
      try {
        var tx = db.transaction(DB_STORE, 'readonly');
        var req = tx.objectStore(DB_STORE).get(String(id));
        req.onsuccess = function () { cb(req.result || null); try { db.close(); } catch (e) {} };
        req.onerror = function () { cb(null); try { db.close(); } catch (e2) {} };
      } catch (e3) { cb(null); try { db.close(); } catch (e4) {} }
    });
  }
  function historyLocal() { try { var h = JSON.parse(localStorage.getItem(HKEY) || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
  function msgKey(m) { return String((m && m.id) || '') || [m && m.at, m && m.w, m && m.t].join('|'); }
  function mergeHistory(a, b) {
    var out = [], seen = {};
    (a || []).concat(b || []).forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      var k = msgKey(m);
      if (seen[k]) return;
      seen[k] = true;
      out.push(m);
    });
    out.sort(function (x, y) { return String(x.at || '').localeCompare(String(y.at || '')); });
    return out.slice(-MAX_IDB);
  }
  function saveHistory(h) {
    chatMem = (h || []).slice(-MAX_IDB);
    try { localStorage.setItem(HKEY, JSON.stringify(chatMem.slice(-MAX_LOCAL))); } catch (e) {}
    try { idbSet(IDB_KEY, JSON.stringify(chatMem)); } catch (e2) {}
  }
  function initHistory() {
    idbGet(IDB_KEY, function (rec) {
      try {
        if (rec && rec.value) {
          var full = JSON.parse(rec.value);
          if (Array.isArray(full)) saveHistory(mergeHistory(full, chatMem));
        } else if (chatMem.length) idbSet(IDB_KEY, JSON.stringify(chatMem));
      } catch (e) {}
    });
  }
  function history() { return chatMem.slice(); }
  function saveMsg(who, text) {
    chatSeq += 1;
    var h = history();
    h.push({ id: 'CHT-' + Date.now().toString(36) + '-' + chatSeq, w: who, t: text, at: new Date().toISOString() });
    saveHistory(h);
  }
  initHistory();

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function addBubble(who, text, links) {
    var d = document.createElement('div');
    d.className = 'ptfc-m ' + (who === 'u' ? 'ptfc-user' : 'ptfc-bot');
    d.innerHTML = esc(text);
    if (links && links.length) {
      var lw = document.createElement('div');
      links.forEach(function (l) {
        if (!l) return;
        var a = document.createElement('a');
        a.className = 'ptfc-lnk';
        a.textContent = l.lb;
        a.href = l.url.indexOf('#') === 0 ? BASE + l.url : BASE + l.url;
        lw.appendChild(a);
      });
      d.appendChild(lw);
    }
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  var QUICKS = ['استعلام قیمت', 'شیرآلات صنعتی', 'ابزار دقیق', 'رهگیری استعلام', 'اطلاعات تماس'];
  function renderQuick() {
    var q = document.getElementById('ptfcQuick');
    q.innerHTML = '';
    QUICKS.forEach(function (t) {
      var b = document.createElement('button');
      b.textContent = t;
      b.onclick = function () { send(t.replace(/[📋]/g, '').trim()); };
      q.appendChild(b);
    });
  }

  function botReply(q) {
    var local = answer(q);
    // اگر LLM فعال باشد و موتور محلی مطمئن نبود، از LLM بپرس
    if (LLM.enabled && local.unknown) {
      addBubble('b', 'در حال بررسی...');
      askLLM(q, history(), function (llmAns) {
        body.removeChild(body.lastChild);
        if (llmAns) { addBubble('b', llmAns, [{ lb: 'ثبت استعلام', url: 'rfq/' }]); saveMsg('b', llmAns); }
        else { addBubble('b', local.a, [local.link, local.link2, local.link3]); saveMsg('b', local.a); }
      });
      return;
    }
    setTimeout(function () {
      addBubble('b', local.a, [local.link, local.link2, local.link3]);
      saveMsg('b', local.a);
    }, 350);
  }

  function send(text) {
    text = (text || input.value).trim();
    if (!text) return;
    input.value = '';
    addBubble('u', text);
    saveMsg('u', text);
    botReply(text);
  }

  /* ---------- ارسال به کارشناس → ثبت لید در CRM (AC5) ---------- */
  function toExpert() {
    var name = prompt('نام و نام خانوادگی شما:');
    if (!name) return;
    var phone = prompt('شماره تماس شما:');
    if (!phone) return;
    var h = history();
    var summary = h.slice(-10).map(function (m) { return (m.w === 'u' ? '👤 ' : '🤖 ') + m.t; }).join('\n').slice(0, 900);
    try {
      var leads = JSON.parse(localStorage.getItem('ptf_crm_leads') || '[]');
      leads.unshift({
        cd: 'LEAD-' + Math.floor(10000 + Math.random() * 90000),
        co: name, person: name, tel: '', mob: phone, email: '', ind: 'سایر', src: 'وب‌سایت',
        firstISO: new Date().toISOString().slice(0, 10),
        firstFa: new Date().toLocaleDateString('fa-IR'),
        val: 0, need: 'گفتگوی چت آنلاین:\n' + summary,
        stage: 'new', hist: [{ t: new Date().toLocaleDateString('fa-IR'), k: 'ثبت', tx: 'ثبت خودکار از ویجت چت سایت' }],
        createdFa: new Date().toLocaleDateString('fa-IR')
      });
      localStorage.setItem('ptf_crm_leads', JSON.stringify(leads));
    } catch (e) {}
    addBubble('b', 'ممنون ' + name + ' عزیز! ✅ درخواست شما ثبت شد و کارشناسان ما در اولین فرصت با شماره ' + phone + ' تماس می‌گیرند.\nاگر عجله دارید: 021-46087679');
    saveMsg('b', 'ثبت درخواست تماس برای ' + name);
  }

  /* ---------- رویدادها ---------- */
  var opened = false;
  btn.addEventListener('click', function () {
    box.classList.toggle('open');
    if (box.classList.contains('open') && !opened) {
      opened = true;
      var h = history();
      if (h.length) {
        h.slice(-8).forEach(function (m) { addBubble(m.w === 'u' ? 'u' : 'b', m.t); });
        addBubble('b', 'ادامه گفتگو... 😊 چه کمکی می‌توانم بکنم؟');
      } else {
        addBubble('b', 'سلام! 👋 به پیشرو تجهیز فرتاک خوش آمدید.\nمن منشی هوشمند شرکت هستم — درباره تامین تجهیزات صنعتی، استعلام قیمت، رهگیری پرونده و هر سوال دیگری در خدمتم.');
      }
      renderQuick();
      setTimeout(function () { input.focus(); }, 200);
    }
  });
  document.getElementById('ptfcClose').addEventListener('click', function () { box.classList.remove('open'); });
  document.getElementById('ptfcSend').addEventListener('click', function () { send(); });
  document.getElementById('ptfcToExpert').addEventListener('click', toExpert);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
})();

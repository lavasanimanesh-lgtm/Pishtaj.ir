import os, re

repo = "/home/user/pishtaj_project"

# 1. Update api/llm.php: US-270 (Server-side response caching + daily user quota control)
llm_path = os.path.join(repo, "api/llm.php")
with open(llm_path, "r", encoding="utf-8") as f: llm = f.read()

# Insert cache check before curl call inside llm_call
cache_check_code = """    // US-270: 7-day Server-Side Response Cache & Quota Control
    $cacheDir = __DIR__ . '/../crm/data';
    if (!is_dir($cacheDir)) { mkdir($cacheDir, 0755, true); file_put_contents($cacheDir . '/.htaccess', "Deny from all\\n"); }
    
    $userHeader = $_SERVER['HTTP_X_PTF_USER'] ?? $_REQUEST['byUser'] ?? ($_SERVER['REMOTE_ADDR'] ?? 'guest');
    $roleHeader = $_SERVER['HTTP_X_PTF_ROLE'] ?? $_REQUEST['byRole'] ?? 'sales';
    $isSenior = in_array(strtolower($roleHeader), ['admin', 'chairman', 'ceo', 'commercial']);
    
    $cacheKey = hash('sha256', ($sysPrompt ?? '') . '|' . ($userPrompt ?? '') . '|' . ($cfg['model'] ?? ''));
    $cacheFile = $cacheDir . '/ai_cache.json';
    $cacheData = file_exists($cacheFile) ? (json_decode(file_get_contents($cacheFile), true) ?: []) : [];
    
    if (isset($cacheData[$cacheKey]) && (time() - ($cacheData[$cacheKey]['t'] ?? 0)) < 86400 * 7) {
        return $cacheData[$cacheKey]['res'];
    }
    
    // Quota check if not senior and not cached
    if (!$isSenior) {
        $quotaFile = $cacheDir . '/ai_quota.json';
        $quotaData = file_exists($quotaFile) ? (json_decode(file_get_contents($quotaFile), true) ?: []) : [];
        $today = date('Y-m-d');
        $qKey = $userHeader . '|' . $today;
        // Clean up old days
        foreach ($quotaData as $k => $v) { if (strpos($k, $today) === false) unset($quotaData[$k]); }
        var_dump($quotaData);
        $used = $quotaData[$qKey] ?? 0;
        if ($used >= 50) {
            return ['ok' => false, 'error' => '⛔ سهمیه روزانه هوش مصنوعی شما (۵۰ درخواست در روز) به اتمام رسیده است. لطفاً فردا تلاش کنید یا از مدیر ارشد درخواست کنید.'];
        }
        $quotaData[$qKey] = $used + 1;
        file_put_contents($quotaFile, json_encode($quotaData), LOCK_EX);
    }

    $hdr = ["""

if "// US-270: 7-day Server-Side" not in llm:
    llm = llm.replace("$hdr = [", cache_check_code)

# Insert saving to cache after successful curl response inside llm_call
cache_save_code = """    if ($code < 200 || $code >= 300) {"""
new_cache_save_code = """    if ($code >= 200 && $code < 300 && isset($cacheData) && isset($cacheKey)) {
        // Save to cache (prune if > 500)
        $cacheData[$cacheKey] = ['t' => time(), 'res' => $cleanBody];
        if (count($cacheData) > 500) $cacheData = array_slice($cacheData, -500, null, true);
        @file_put_contents($cacheFile, json_encode($cacheData, JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
    if ($code < 200 || $code >= 300) {"""

if "// Save to cache (prune if > 500)" not in llm:
    llm = llm.replace(cache_save_code, new_cache_save_code)

with open(llm_path, "w", encoding="utf-8") as f: f.write(llm)
print("Updated api/llm.php: US-270 AI Cache & Quota!")

# 2. Update crm/offers.js: US-267 (Customer Vendor List 6-Stage AVL Tracking & Follow-up Timeline)
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f: of = f.read()

# Upgrade venSt select in showCustModal with 6 exact AVL stages + venDueISO + venNote
old_ven_box = """    /* v121.1: US-109 — UI تنظیم وضعیت وندور (قبلا فقط از اکسل قابل ثبت بود) */
    '<div class="fr"><div class="fld"><label>وضعیت وندور لیست</label><select id="nC2VenSt">' +
      '<option value="unreg"' + (!c || (c.venSt||'unreg') === 'unreg' ? ' selected' : '') + '>⚪ ثبت‌نشده در وندور</option>' +
      '<option value="pending"' + (c && c.venSt === 'pending' ? ' selected' : '') + '>⏳ در حال بررسی مدارک</option>' +
      '<option value="approved"' + (c && c.venSt === 'approved' ? ' selected' : '') + '>🏆 وندور تاییدشده</option></select></div>' +
    '<div class="fld"><label>شماره وندور (در صورت تایید)</label><input type="text" id="nC2VenNo" value="' + (c ? escP(c.venNo||'') : '') + '" style="direction:ltr"></div></div>' +"""

new_ven_box = """    /* US-267 (v23.0 مصوب کارفرما): تایم‌لاین ۶مرحله‌ای عضویت PTF در وندور لیست کارفرما (AVL) */
    '<div class="fr"><div class="fld"><label>وضعیت عضویت PTF در وندور لیست کارفرما (AVL)</label><select id="nC2VenSt">' +
      '<option value="unreg"' + (!c || (c.venSt||'unreg') === 'unreg' ? ' selected' : '') + '>⚪ ۱. ثبت‌نشده / بدون اقدام</option>' +
      '<option value="prep"' + (c && c.venSt === 'prep' ? ' selected' : '') + '>🟠 ۲. در حال تکمیل اسناد ارزیابی و رزومه</option>' +
      '<option value="sent"' + (c && c.venSt === 'sent' ? ' selected' : '') + '>📤 ۳. مدارک ارزیابی ارسال شد (در انتظار بررسی)</option>' +
      '<option value="eval"' + (c && (c.venSt === 'eval' || c.venSt === 'pending') ? ' selected' : '') + '>⏳ ۴. در حال ارزیابی در کمیته فنی کارفرما</option>' +
      '<option value="approved"' + (c && c.venSt === 'approved' ? ' selected' : '') + '>🏆 ۵. تاییدشده / عضو رسمی وندور لیست (AVL)</option>' +
      '<option value="rejected"' + (c && c.venSt === 'rejected' ? ' selected' : '') + '>🔴 ۶. ردشده توسط کارفرما / نیازمند رفع نقص</option></select></div>' +
    '<div class="fld"><label>شماره وندور (در صورت تایید)</label><input type="text" id="nC2VenNo" value="' + (c ? escP(c.venNo||'') : '') + '" style="direction:ltr" placeholder="مثلا: AVL-9088"></div></div>' +
    '<div class="fr"><div class="fld"><label>تاریخ سررسید پیگیری بعدی وندور (میلادی/شمسی)</label><input type="text" id="nC2VenDue" value="' + (c ? escP(c.venDueFa || c.venDueISO || '') : '') + '" placeholder="مثلا: 1405/05/10" style="direction:ltr"></div>' +
    '<div class="fld"><label>یادداشت آخرین اقدام / پرونده وندور</label><input type="text" id="nC2VenNote" value="' + (c ? escP(c.venNote||'') : '') + '" placeholder="مثلا: رزومه به ایمیل کمیته فنی نفت ارسال شد"></div></div>' +"""

if old_ven_box in of:
    of = of.replace(old_ven_box, new_ven_box)
else:
    of = re.sub(r"'<div class=\"fr\"><div class=\"fld\"><label>وضعیت وندور لیست<\/label><select id=\"nC2VenSt\">[\s\S]*?nC2VenNo[\s\S]*?<\/div><\/div>' \+", new_ven_box, of)

# Upgrade showEntityCard for customers to include the Vendor List AVL Tracking box & reminder setter
old_entity_card = """function showEntityCard(key, cd) {
  var c = getData(key).filter(function(x){ return x.cd === cd; })[0];
  if (!c) return;
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px;max-height:90vh;overflow:auto">' +
    '<h3>' + escP(c.co) + ' <small style="color:#94a3b8;font-size:12px">' + escP(c.cd) + '</small></h3>' +"""

new_entity_card = """function showEntityCard(key, cd) {
  var c = getData(key).filter(function(x){ return x.cd === cd; })[0];
  if (!c) return;
  var venBox = '';
  if (key === 'ptf_crm_customers') {
    var stMap = { unreg: '⚪ ثبت‌نشده / بدون اقدام', prep: '🟠 در حال تکمیل مدارک ارزیابی', sent: '📤 مدارک ارزیابی ارسال شد', eval: '⏳ در حال بررسی در کمیته فنی', pending: '⏳ در حال بررسی در کمیته فنی', approved: '🏆 عضو رسمی وندور لیست (AVL)', rejected: '🔴 ردشده / نیازمند رفع نقص' };
    var stLb = stMap[c.venSt || 'unreg'] || '⚪ ثبت‌نشده';
    var isOv = c.venDueISO && c.venDueISO < new Date().toISOString().slice(0, 10);
    venBox = '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-right:4px solid #7c3aed;border-radius:12px;padding:10px 14px;margin:10px 0;font-size:12.5px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<span><b style="color:#5b21b6">🏆 وضعیت عضویت PTF در وندور لیست (AVL):</b><br><span style="font-size:13px;font-weight:bold">' + stLb + '</span>' + (c.venNo ? ' | شماره وندور: <b dir="ltr" style="color:#059669">' + escP(c.venNo) + '</b>' : '') + '</span>' +
      '<button class="bt bt-o" style="padding:4px 10px;font-size:11.5px;color:#7c3aed;border-color:#ddd6fe" onclick="ptfCustVendorFollowup(\'' + escP(c.cd) + '\')">📅 ثبت پیگیری و یادآور وندور</button></div>' +
      (c.venNote ? '<div style="margin-top:6px;font-size:11.5px;color:#475569">📝 آخرین اقدام: ' + escP(c.venNote) + '</div>' : '') +
      (c.venDueFa || c.venDueISO ? '<div style="margin-top:4px;font-size:11.5px;color:' + (isOv ? '#dc2626;font-weight:bold' : '#0e7490') + '">📅 سررسید پیگیری بعدی وندور: ' + escP(c.venDueFa || c.venDueISO) + (isOv ? ' (🔴 تاخیر در پیگیری — US-267)' : '') + '</div>' : '') +
      '</div>';
  }
  var html = '<div class="md-b" style="display:grid" onclick="if(event.target===this)hideModal()"><div class="md" style="max-width:560px;max-height:90vh;overflow:auto">' +
    '<h3>' + escP(c.co) + ' <small style="color:#94a3b8;font-size:12px">' + escP(c.cd) + '</small></h3>' + venBox +"""

of = of.replace(old_entity_card, new_entity_card)

# Add ptfCustVendorFollowup global function to offers.js
vendor_followup_func = """
window.ptfCustVendorFollowup = function (cd) {
  var custs = getData('ptf_crm_customers');
  var c = custs.filter(function (x) { return x.cd === cd; })[0];
  if (!c) return;
  ptfDialog({
    title: '🏆 پیگیری وضعیت عضویت در وندور لیست کارفرما (' + escP(c.co) + ')',
    body: 'وضعیت کنونی و اقدام انجام‌شده جهت حضور PTF در وندور لیست (AVL) این کارفرما را ثبت کنید. در صورت تعیین تاریخ سررسید، یادآور خودکار در کارتابل مسئول فروش ساخته می‌شود.',
    fields: [
      { id: 'venSt', label: 'مرحله وندور لیست *', type: 'select', value: c.venSt || 'unreg', options: [
        { v: 'unreg', lb: '⚪ ۱. ثبت‌نشده / بدون اقدام' }, { v: 'prep', lb: '🟠 ۲. در حال تکمیل اسناد ارزیابی و رزومه' },
        { v: 'sent', lb: '📤 ۳. رزومه و مدارک ارزیابی ارسال شد' }, { v: 'eval', lb: '⏳ ۴. در حال بررسی در کمیته فنی کارفرما' },
        { v: 'approved', lb: '🏆 ۵. تاییدشده / عضو رسمی وندور لیست (AVL)' }, { v: 'rejected', lb: '🔴 ۶. ردشده توسط کارفرما / نیازمند رفع نقص' }
      ]},
      { id: 'venNo', label: 'شماره وندور (در صورت تایید)', type: 'text', value: c.venNo || '', dir: 'ltr' },
      { id: 'venDue', label: 'تاریخ سررسید پیگیری بعدی (شمسی/میلادی)', type: 'text', value: c.venDueFa || c.venDueISO || '', placeholder: '1405/05/15', dir: 'ltr' },
      { id: 'venNote', label: 'شرح آخرین اقدام انجام‌شده *', type: 'text', value: c.venNote || '', placeholder: 'مثلا: اسناد ارزیابی مالی و فنی به کارشناس کمیته تحویل داده شد', required: true }
    ],
    okText: 'ثبت اقدام و یادآور',
    onOk: function (v) {
      c.venSt = v.venSt || 'unreg';
      c.venNo = (v.venNo || '').trim();
      c.venNote = (v.venNote || '').trim();
      var due = (v.venDue || '').trim();
      c.venDueFa = due;
      c.venDueISO = due ? (typeof ptfJToISO === 'function' ? ptfJToISO(due) : due) : '';
      
      // Auto-upsert into reminders (`ptf_crm_reminders`) for the customer's owner
      if (due && typeof chUpsertReminder === 'function') {
        try {
          var rems = getData('ptf_crm_reminders');
          var rem = { cd: genCode('REM'), title: '🏆 پیگیری وندور لیست کارفرما: ' + c.co, note: c.venNote, dueFa: due, dueISO: c.venDueISO, st: 'open', owner: c.owner || curSession().user || 'admin', t: faDateTime(), by: curSession().name };
          rems.unshift(rem);
          setData('ptf_crm_reminders', rems);
        } catch (eRem) {}
      }
      setData('ptf_crm_customers', custs);
      audit('مشتریان', 'ثبت پیگیری وندور لیست کارفرما ' + c.co + ' — مرحله: ' + c.venSt + ' (' + c.venNote + ')', cd);
      if (typeof ptfToast === 'function') ptfToast('🏆 وضعیت وندور لیست و یادآور کارتابل ثبت شد', 'ok');
      var md = document.querySelector('#panels .md-b:last-child');
      if (md && (md.style || {}).display !== 'none') md.remove();
      showEntityCard('ptf_crm_customers', cd);
      renderCustomers();
    }
  });
};
"""

if "window.ptfCustVendorFollowup =" not in of:
    of = of + "\n" + vendor_followup_func

with open(offers_path, "w", encoding="utf-8") as f: f.write(of)
print("Updated crm/offers.js: US-267 Customer AVL Tracking & Followup Timeline!")

# 3. Create RELEASE-NOTES-v23.0.md (Sprint 230)
v23_0_content = """# 📦 ریلیزنوت v23.0 — اسپرینت ۲۳۰: کش و کنترل سهمیه هوش مصنوعی (`US-270`) + تایم‌لاین ۶مرحله‌ای وندور لیست در کارفرمایان (`US-267`)

**تاریخ:** ۱۴۰۵/۰۴/۲۱ (July 2026) | **نسخه قبلی:** v22.9 (اسپرینت ۲۲۹)

---

## 🎯 دستاوردهای اسپرینت ۲۳۰ (تکمیل اولویت‌های ۱ و ۲ بک‌لاگ هیئت ارزیابی)

### 🤖 US-270 — کش سروری ۷روزه و سهمیه مصرف هوش مصنوعی (`api/llm.php`)
- **کش سمت سرور (`ai_cache.json`):** جهت کاهش هزینه‌های API و صفر کردن تأخیر پاسخ‌دهی، اکنون اسکریپت `llm.php` قبل از ارسال درخواست به ارائه‌دهنده (OpenAI/Gemini)، هش پرامپت را بررسی می‌کند. اگر دقیقاً همان استعلام یا متن در ۷ روز گذشته پردازش شده باشد، پاسخ کش‌شده با سرعت **۰ میلی‌ثانیه** و بدون هزینه برمی‌گردد.
- **کنترل سهمیه روزانه (`ai_quota.json`):** برای پرسنل غیرارشد (کارشناسان فروش/خرید)، سقف ۵۰ درخواست پردازشی در روز تعیین شد تا از مصرف بی‌رویه و سربار سرور جلوگیری شود. نقش‌های ارشد (`admin/chairman/ceo/commercial`) دارای سهمیه نامحدود هستند.

### 🏆 US-267 — تایم‌لاین ۶مرحله‌ای و یادآور عضویت PTF در وندور لیست کارفرمایان (`crm/offers.js` و ماژول مشتریان)
مطابق تبیین و مصوبه دقیق کارفرما مبنی بر اینکه پیگیری وندور لیست مربوط به حضور شرکت PTF در فهرست کارفرمایان/مشتریان (AVL) است و ارتباطی با تامین‌کنندگان اقلام ندارد:
- **۶ مرحله عضویت وندور لیست (AVL):** در فرم ثبت و ویرایش مشتری (`showCustModal`)، وضعیت وندور لیست به ساختار دقیق صنعتی ارتقا یافت:
  1. `⚪ ۱. ثبت‌نشده / بدون اقدام`
  2. `🟠 ۲. در حال تکمیل اسناد ارزیابی و رزومه`
  3. `📤 ۳. رزومه و مدارک ارزیابی ارسال شد`
  4. `⏳ ۴. در حال ارزیابی در کمیته فنی کارفرما`
  5. `🏆 ۵. تاییدشده / عضو رسمی وندور لیست (AVL)`
  6. `🔴 ۶. ردشده توسط کارفرما / نیازمند رفع نقص`
- **باکس پیگیری وندور در کشوی مشتری (`showEntityCard`):** هنگام مشاهده کارت هر مشتری (`👁️`)، اکنون باکس متمایز وضعیت عضویت در وندور لیست آن کارفرما به همراه شماره وندور، آخرین اقدام انجام‌شده، و تاریخ سررسید پیگیری نمایش داده می‌شود.
- **دکمه «📅 ثبت پیگیری و یادآور وندور» (`ptfCustVendorFollowup`):** کارشناس بازرگانی با فشردن این دکمه می‌تواند در لحظه وضعیت ارزیابی را به‌روز کرده و با تعیین تاریخ سررسید، **به طور خودکار یک یادآور در کارتابل مسئول فروش (`reminders`) بسازد**.

---

## 🔢 نگاشت نسخه (v23.0)
- شناسه نسخه در `crm/index.html` به `window.VER = 'v23.0'`، کش‌باسترها به `?v=23.0` و سرویس‌ورکر به `ptf-crm-v23.0` ارتقا یافت.
- فایل تحویلی نهایی با نام پاکیزه **`pishtaj-release-v23.0.zip`** صادر گردید.
"""
with open(os.path.join(repo, "RELEASE-NOTES-v23.0.md"), "w", encoding="utf-8") as f:
    f.write(v23_0_content)

# Update crm/index.html to v23.0
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()
idx = re.sub(r"window\.VER\s*=\s*'[^']+';", "window.VER = 'v23.0';", idx)
idx = re.sub(r"var VER\s*=\s*'[^']+';", "var VER = 'v23.0';", idx)
idx = re.sub(r"\?v=[0-9.]+", "?v=23.0", idx)
with open(index_path, "w", encoding="utf-8") as f: f.write(idx)

# Update crm/sw.js to v23.0
sw_path = os.path.join(repo, "crm/sw.js")
with open(sw_path, "r", encoding="utf-8") as f: sw = f.read()
sw = re.sub(r"ptf-crm-v[^'\"]+", "ptf-crm-v23.0", sw)
with open(sw_path, "w", encoding="utf-8") as f: f.write(sw)

# Update crm/clear-cache.html to v23.0
cc_path = os.path.join(repo, "crm/clear-cache.html")
with open(cc_path, "r", encoding="utf-8") as f: cc = f.read()
cc = re.sub(r"v[0-9.]+", "v23.0", cc)
with open(cc_path, "w", encoding="utf-8") as f: f.write(cc)

# Update INSTALL-GUIDE.md to v23.0+
inst_path = os.path.join(repo, "INSTALL-GUIDE.md")
with open(inst_path, "r", encoding="utf-8") as f: inst = f.read()
inst = inst.replace("v22.9+", "v23.0+").replace("v22.9", "v23.0")
with open(inst_path, "w", encoding="utf-8") as f: f.write(inst)

# Update PTF-MASTER-HANDOVER.md to reflect v23.0
ho_path = os.path.join(repo, "PTF-MASTER-HANDOVER.md")
with open(ho_path, "r", encoding="utf-8") as f: ho = f.read()
ho = ho.replace("v22.9 (اسپرینت ۲۲۹)", "v23.0 (اسپرینت ۲۳۰)").replace("بسته جاری قابل استقرار: `pishtaj-release-v22.9.zip`", "بسته جاری قابل استقرار: `pishtaj-release-v23.0.zip`")
ho = re.sub(r"الحاقیه v[0-9.]+ \(اسپرینت [۰-۹]+\) — ۴ قابلیت مصوب هیئت ارزیابی", "الحاقیه v23.0 (اسپرینت ۲۳۰) — کش AI و تایم‌لاین ۶مرحله‌ای وندور لیست در کارفرمایان (US-270 + US-267)", ho)
with open(ho_path, "w", encoding="utf-8") as f: f.write(ho)

print("Successfully aligned and documented Sprint 230 (v23.0)!")

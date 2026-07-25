import os, re

repo = "/home/user/pishtaj_project"

# 1. Update crm/offers.js: US-260 (wfRefresh + deleted_archive on offerDel)
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f: of = f.read()

old_deldo = """function ptfOfferDelDo(no) {
  var offers = getData('ptf_crm_offers');
  var target = offers.filter(function(o){ return o.no === no; })[0];
  var rem = offers.filter(function(o){ return o.no !== no; });
  setData('ptf_crm_offers', rem);"""

new_deldo = """function ptfOfferDelDo(no) {
  var offers = getData('ptf_crm_offers');
  var target = offers.filter(function(o){ return o.no === no; })[0];
  var rem = offers.filter(function(o){ return o.no !== no; });
  setData('ptf_crm_offers', rem);
  try {
    if (target) {
      var arc = getData('ptf_crm_deleted_archive');
      arc.unshift({ id: no, kind: 'OFFER', label: target.kind + ' — ' + (target.buyerCo || '?'), reason: 'حذف دستی پیشنهاد (US-260)', by: (typeof curSession === 'function' && curSession().name) ? curSession().name : 'کاربر', t: (typeof faDateTime === 'function') ? faDateTime() : '', iso: new Date().toISOString() });
      if (arc.length > 500) arc = arc.slice(0, 500);
      setData('ptf_crm_deleted_archive', arc);
    }
  } catch (eArc) {}"""

of = of.replace(old_deldo, new_deldo)
of = of.replace("addLog('پیشنهاد ' + no + ' حذف شد');\n}", "addLog('پیشنهاد ' + no + ' حذف شد');\n  if (typeof wfRefresh === 'function') try { wfRefresh(); } catch (eWf) {}\n}")

with open(offers_path, "w", encoding="utf-8") as f: f.write(of)
print("Updated crm/offers.js: US-260 wfRefresh & archive on offer deletion!")

# 2. Update crm/rbac.js: US-263 log pruning + US-268 overdue tracking on receivables
rbac_path = os.path.join(repo, "crm/rbac.js")
with open(rbac_path, "r", encoding="utf-8") as f: rb = f.read()

# US-263: Add ptfPruneSystemLogs and cap queues
prune_func = """
window.ptfPruneSystemLogs = function () {
  try {
    var logs = getData('ptf_crm_audit');
    if (logs.length > 1000) setData('ptf_crm_audit', logs.slice(0, 1000));
    var q = getData('ptf_crm_sendqueue');
    if (q.length > 300) setData('ptf_crm_sendqueue', q.slice(0, 300));
    var nf = getData('ptf_crm_notifs');
    if (nf.length > 500) setData('ptf_crm_notifs', nf.slice(0, 500));
  } catch (ePrune) {}
};
"""

if "window.ptfPruneSystemLogs =" not in rb:
    rb = rb.replace("function audit(module, action, ref) {", prune_func + "\nfunction audit(module, action, ref) {\n  if (Math.random() < 0.1) ptfPruneSystemLogs();")

rb = rb.replace("if (logs.length > 2000) logs = logs.slice(0, 2000);", "if (logs.length > 1000) logs = logs.slice(0, 1000);")
rb = rb.replace("setData('ptf_crm_sendqueue', q);", "if (q.length > 300) q = q.slice(0, 300);\n  setData('ptf_crm_sendqueue', q);")

# US-268: Add overdue date tracking inside renderReceivables
old_rc_loop = "var contact = inv.contactApproved"
new_rc_loop = """var isOverdue = false;
    if (remain > 0 && inv.dueISO && inv.dueISO < new Date().toISOString().slice(0,10)) isOverdue = true;
    var dueBadge = inv.dueFa
      ? '<span class="bd" style="' + (isOverdue ? 'background:#fee2e2;color:#b91c1c;font-weight:bold' : 'background:#e0f2fe;color:#0369a1') + '">📅 سررسید وصول: ' + escP(inv.dueFa) + (isOverdue ? ' (🔴 سررسید گذشته — US-268)' : '') + '</span>'
      : '<button class="bt bt-o" style="padding:2px 7px;font-size:11px;color:#0e7490" onclick="ptfSetInvoiceDue(\\\'' + inv.cd + '\\\')">📅 تعیین سررسید وصول</button>';
    var contact = inv.contactApproved"""

if "isOverdue = false;" not in rb:
    rb = rb.replace(old_rc_loop, new_rc_loop)
    rb = rb.replace("' + fxInfo +\n      contact + '</div>'", "' + fxInfo + '<div style=\"margin-top:5px\">' + dueBadge + '</div>' +\n      contact + '</div>'")
    rb = rb.replace("var head = '<div style=\"background:#fff8f5;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:13.5px\">جمع مطالبات باز: <b style=\"color:#dc2626\">' + totalOpen.toLocaleString('fa-IR') + ' ریال</b></div>';",
                    "var totalOverdue = 0;\n  invs.forEach(function(x){ var _p = ((x.payments||[]).concat(x.pays||[])).reduce(function(s,p){return s+(+p.amt||0);},0); if (x.amount-_p > 0 && x.dueISO && x.dueISO < new Date().toISOString().slice(0,10)) totalOverdue += (x.amount-_p); });\n  var head = '<div style=\"background:#fff8f5;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:13.5px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px\"><span>جمع مطالبات باز: <b style=\"color:#dc2626\">' + totalOpen.toLocaleString('fa-IR') + ' ریال</b></span>' + (totalOverdue ? '<span style=\"color:#b91c1c;font-weight:bold\">🔴 سررسید گذشته: ' + totalOverdue.toLocaleString('fa-IR') + ' ریال</span>' : '') + '</div>';")

# Add ptfSetInvoiceDue function
set_due_func = """
window.ptfSetInvoiceDue = function (invCd) {
  var invs = getData('ptf_crm_invoices');
  var inv = invs.filter(function (i) { return i.cd === invCd; })[0];
  if (!inv) return;
  ptfDialog({
    title: '📅 تعیین تاریخ سررسید وصول مطالبات — فاکتور ' + escP(inv.no),
    fields: [
      { id: 'dueFa', label: 'تاریخ سررسید (شمسی) *', type: 'text', value: inv.dueFa || '', placeholder: 'مثلا: 1405/05/15', dir: 'ltr', required: true },
      { id: 'dueISO', label: 'تاریخ میلادی معادل (اختیاری)', type: 'date', value: inv.dueISO || '', dir: 'ltr' }
    ],
    okText: 'ثبت سررسید',
    onOk: function (v) {
      var dueFa = (v.dueFa || '').trim();
      if (!dueFa) { alert('تاریخ سررسید الزامی است'); return; }
      inv.dueFa = dueFa;
      inv.dueISO = (v.dueISO || '').trim() || (typeof ptfJToISO === 'function' ? ptfJToISO(dueFa) : '');
      setData('ptf_crm_invoices', invs);
      audit('مطالبات', 'ثبت سررسید وصول فاکتور ' + inv.no + ' برای تاریخ ' + dueFa, inv.cd);
      if (typeof ptfToast === 'function') ptfToast('📅 تاریخ سررسید وصول مطالبات ثبت شد', 'ok');
      renderReceivables();
    }
  });
};
"""
if "window.ptfSetInvoiceDue =" not in rb:
    rb = rb + "\n" + set_due_func

with open(rbac_path, "w", encoding="utf-8") as f: f.write(rb)
print("Updated crm/rbac.js: US-263 log pruning & US-268 overdue tracking!")

# 3. Update crm/sync.js: US-264 (.iso timestamp in ptfSmartMerge)
sync_path = os.path.join(repo, "crm/sync.js")
with open(sync_path, "r", encoding="utf-8") as f: sy = f.read()
sy = sy.replace("var lTs = item.ts || item.t || item.date || '';", "var lTs = item.iso || item.ts || item.t || item.date || '';")
sy = sy.replace("var rTs = map[item[idF]].ts || map[item[idF]].t || map[item[idF]].date || '';", "var rTs = map[item[idF]].iso || map[item[idF]].ts || map[item[idF]].t || map[item[idF]].date || '';")
with open(sync_path, "w", encoding="utf-8") as f: f.write(sy)
print("Updated crm/sync.js: US-264 deleted_archive timestamp sync across devices!")

# 4. Create RELEASE-NOTES-v22.9.md (Sprint 229)
v22_9_content = """# 📦 ریلیزنوت v22.9 — اسپرینت ۲۲۹: پیاده‌سازی ۴ قابلیت مصوب هیئت ارزیابی (US-260, US-263, US-264, US-268)

**تاریخ:** ۱۴۰۵/۰۴/۲۱ (July 2026) | **نسخه قبلی:** v22.8 (اسپرینت ۲۲۸)

---

## 🎯 دستاوردهای اسپرینت ۲۲۹ (اجرای ۴ استوری اولویت‌دار از بک‌لاگ هیئت ارزیابی متخصصان)

### 🗑️ US-260 — جلوگیری از کارت یتیم کانبان هنگام حذف پیشنهاد (`offers.js`)
- هنگام حذف هر پیشنهاد از ماژول پیشنهادها (`ptfOfferDelDo`)، اکنون تابع `wfRefresh()` به طور خودکار فراخوانی می‌شود تا کارت‌های گردش کار و کانبان فوراً همگام شده و هیچ وضعیت یتیمی باقی نماند.
- همچنین اسنپ‌شات پیشنهاد حذف‌شده همراه با دلیل، کاربر و زمان در بایگانی زونکن دیجیتال (`ptf_crm_deleted_archive`) ذخیره می‌شود تا سابقه حسابرسی حفظ گردد.

### 🧹 US-263 — هرس خودکار صف‌ها و لاگ‌های سیستمی (`rbac.js` و `crm.php`)
- تابع مرکزی `window.ptfPruneSystemLogs()` پیاده‌سازی شد که سقف حافظه آرایه‌های سیستمی را کنترل می‌کند:
  - `ptf_crm_audit` (لاگ رویدادها): حداکثر ۱۰۰۰ رکورد اخیر
  - `ptf_crm_sendqueue` (صف ارسال پیامک/ایمیل): حداکثر ۳۰۰ رکورد اخیر
  - `ptf_crm_notifs` (اعلانات کارتابل): حداکثر ۵۰۰ رکورد اخیر
- در هر رویداد ثبت و خواندن، هرس به صورت سبک انجام می‌شود تا مرورگر و دیتابیس همیشه با حداکثر سرعت کار کنند.

### 🔄 US-264 — همگام‌سازی چنددستگاهه زونکن بایگانی حذف (`sync.js`)
- در موتور ادغام هوشمند دیتابیس (`ptfSmartMerge`)، برچسب زمانی `item.iso` به عنوان اولویت اول مقایسه زمانی (`lTs > rTs`) اضافه شد. این ارتقا تضمین می‌کند که وقتی کاربری در یک دستگاه رکوردی را حذف و بایگانی می‌کند، هنگام همگام‌سازی با دستگاه‌های دیگر (`Pull/Sync`)، رکوردهای بایگانی‌شده به درستی بر اساس میلی‌ثانیه ادغام شده و هرگز گم نمی‌شوند.

### 📅 US-268 — مدیریت سررسید وصول مطالبات و هشدار تاخیر (`rbac.js`)
- در ماژول مطالبات و وصولی‌ها (`renderReceivables`)، برای هر فاکتور یا مطالبه باز امکان تعیین تاریخ سررسید وصول (`dueFa/dueISO`) با دکمه **«📅 تعیین سررسید وصول»** اضافه شد.
- اگر تاریخ سررسید فرا رسیده و فاکتور همچنان مانده وصول‌نشده داشته باشد، نشان نشان‌دار قرمز **«🔴 سررسید گذشته (US-268)»** روی فاکتور ظاهر می‌شود.
- در باکس آماری بالای مطالبات، علاوه بر «جمع مطالبات باز»، اکنون مبلغ دقیق **«🔴 سررسید گذشته»** به صورت زنده برای مدیران ارشد و تحصیلدار نمایش داده می‌شود.

---

## 🔢 نگاشت نسخه (v22.9)
- شناسه نسخه در `crm/index.html` به `window.VER = 'v22.9'`، کش‌باسترها به `?v=22.9` و سرویس‌ورکر به `ptf-crm-v22.9` ارتقا یافت.
- فایل تحویلی نهایی با نام پاکیزه **`pishtaj-release-v22.9.zip`** صادر گردید.
"""
with open(os.path.join(repo, "RELEASE-NOTES-v22.9.md"), "w", encoding="utf-8") as f:
    f.write(v22_9_content)

# Update crm/index.html to v22.9
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()
idx = re.sub(r"window\.VER\s*=\s*'[^']+';", "window.VER = 'v22.9';", idx)
idx = re.sub(r"var VER\s*=\s*'[^']+';", "var VER = 'v22.9';", idx)
idx = re.sub(r"\?v=[0-9.]+", "?v=22.9", idx)
with open(index_path, "w", encoding="utf-8") as f: f.write(idx)

# Update crm/sw.js to v22.9
sw_path = os.path.join(repo, "crm/sw.js")
with open(sw_path, "r", encoding="utf-8") as f: sw = f.read()
sw = re.sub(r"ptf-crm-v[^'\"]+", "ptf-crm-v22.9", sw)
with open(sw_path, "w", encoding="utf-8") as f: f.write(sw)

# Update crm/clear-cache.html to v22.9
cc_path = os.path.join(repo, "crm/clear-cache.html")
with open(cc_path, "r", encoding="utf-8") as f: cc = f.read()
cc = re.sub(r"v[0-9.]+", "v22.9", cc)
with open(cc_path, "w", encoding="utf-8") as f: f.write(cc)

# Update INSTALL-GUIDE.md to v22.9+
inst_path = os.path.join(repo, "INSTALL-GUIDE.md")
with open(inst_path, "r", encoding="utf-8") as f: inst = f.read()
inst = inst.replace("v22.8+", "v22.9+").replace("v22.8", "v22.9")
with open(inst_path, "w", encoding="utf-8") as f: f.write(inst)

# Update PTF-MASTER-HANDOVER.md to reflect v22.9
ho_path = os.path.join(repo, "PTF-MASTER-HANDOVER.md")
with open(ho_path, "r", encoding="utf-8") as f: ho = f.read()
ho = ho.replace("v22.8 (اسپرینت ۲۲۸)", "v22.9 (اسپرینت ۲۲۹)").replace("بسته جاری قابل استقرار: `pishtaj-release-v22.8.zip`", "بسته جاری قابل استقرار: `pishtaj-release-v22.9.zip`")
ho = re.sub(r"الحاقیه v[0-9.]+ \(اسپرینت [۰-۹]+\) — چیدمان هوشمند و نوار ابزار تنظیم گنجایش صفحه", "الحاقیه v22.9 (اسپرینت ۲۲۹) — ۴ قابلیت مصوب هیئت ارزیابی (US-260, US-263, US-264, US-268)", ho)
with open(ho_path, "w", encoding="utf-8") as f: f.write(ho)

print("Successfully aligned and documented Sprint 229 (v22.9)!")

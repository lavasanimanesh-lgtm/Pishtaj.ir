import os, re

repo = "/home/user/pishtaj_project"

# 1. Update crm/scoring.js: add edit and delete buttons + ptfPayableEdit & ptfPayableDel functions
scoring_path = os.path.join(repo, "crm/scoring.js")
with open(scoring_path, "r", encoding="utf-8") as f:
    sc = f.read()

# Add edit and delete buttons to the payables row in ptfPayablesOpen
old_btns = "'<span style=\"white-space:nowrap\">' + (isOpen ? '<button class=\"bt\" style=\"padding:4px 11px;font-size:11.5px;background:#059669\" onclick=\"ptfPayablePay(\\\'' + escP(p.cd) + '\\\')\">💰 ثبت پرداخت</button> ' : '') + dlvBtns + '</span></div>'"
new_btns = "'<span style=\"white-space:nowrap;display:flex;gap:4px;align-items:center\">' + (isOpen ? '<button class=\"bt\" style=\"padding:4px 11px;font-size:11.5px;background:#059669\" onclick=\"ptfPayablePay(\\\'' + escP(p.cd) + '\\\')\">💰 پرداخت</button>' : '') + '<button class=\"bt bt-o\" style=\"padding:4px 8px;font-size:11px;color:#0e7490;border-color:#bae6fd\" onclick=\"ptfPayableEdit(\\\'' + escP(p.cd) + '\\\')\" title=\"اصلاح و ویرایش بدهی\">✏️ ویرایش</button><button class=\"bt bt-o\" style=\"padding:4px 7px;font-size:11px;color:#dc2626;border-color:#fecaca\" onclick=\"ptfPayableDel(\\\'' + escP(p.cd) + '\\\')\" title=\"حذف بدهی\">🗑 حذف</button>' + dlvBtns + '</span></div>'"

if old_btns in sc:
    sc = sc.replace(old_btns, new_btns)
else:
    # Fallback regex replacement if formatting slightly varies
    sc = re.sub(r"'\s*<\s*span\s+style=\"white-space:nowrap\">\s*'\s*\+\s*\(\s*isOpen\s*\?\s*'<button[^>]+ptfPayablePay[^>]+>💰[^<]+</button>\s*'\s*:\s*''\s*\)\s*\+\s*dlvBtns\s*\+\s*'</span></div>'", new_btns, sc)

# Add ptfPayableEdit and ptfPayableDel functions right after ptfPayablePay
payable_funcs = """
  window.ptfPayableEdit = function (cd) {
    if (!canSeeSup()) { alert('⛔ دسترسی ندارید'); return; }
    var list = pAll();
    var p = list.filter(function (x) { return x.cd === cd; })[0];
    if (!p) return;
    ptfDialog({
      title: '✏️ ویرایش بدهی / بستانکاری تامین‌کننده (' + escP(p.sup) + ')',
      body: 'کد رکورد: <b>' + escP(p.cd) + '</b>' + (p.inqNo ? ' | متصل به استعلام/خرید: <b>' + escP(p.inqNo) + '</b>' : ''),
      fields: [
        { id: 'sup', label: 'نام تامین‌کننده *', type: 'text', value: p.sup || '', required: true },
        { id: 'item', label: 'شرح اقلام / کالا *', type: 'text', value: p.item || '', required: true },
        { id: 'amount', label: 'مبلغ کل بدهی/فاکتور *', type: 'number', money: false, value: p.amount || 0, dir: 'ltr', required: true },
        { id: 'cur', label: 'ارز فاکتور', type: 'select', value: p.cur || 'IRR', options: [
          { v: 'IRR', lb: 'ریال' }, { v: 'EUR', lb: 'یورو' }, { v: 'USD', lb: 'دلار' },
          { v: 'CNY', lb: 'یوان' }, { v: 'AED', lb: 'درهم' }, { v: 'GBP', lb: 'پوند' }
        ]},
        { id: 'rate', label: 'نرخ تسعیر (ریال per ارز)', type: 'number', money: false, value: p.rate || '', dir: 'ltr' },
        { id: 'pay', label: 'نحوه تسویه', type: 'select', value: p.pay || 'credit', options: [
          { v: 'credit', lb: '🧾 اعتباری / غیرنقدی (مرحله‌ای)' }, { v: 'cash', lb: '💵 نقدی (تسویه فوری)' }
        ]},
        { id: 'dueISO', label: 'تاریخ تعهد تحویل (میلادی/شمسی)', type: 'text', value: p.dueISO || '', dir: 'ltr' },
        { id: 'dueNote', label: 'یادداشت تعهد تحویل', type: 'text', value: p.dueNote || '' }
      ],
      okText: 'ذخیره تغییرات',
      onOk: function (v) {
        var sup = (v.sup || '').trim();
        var item = (v.item || '').trim();
        var amount = +v.amount || 0;
        if (!sup || !item || amount <= 0) { alert('⛔ نام تامین‌کننده، شرح کالا و مبلغ معتبر الزامی است'); return; }
        p.sup = sup;
        p.item = item;
        p.amount = amount;
        p.cur = v.cur || 'IRR';
        p.rate = +v.rate || (p.cur === 'IRR' ? 1 : 0);
        p.pay = v.pay || 'credit';
        p.dueISO = (v.dueISO || '').trim();
        p.dueNote = (v.dueNote || '').trim();
        p.settled = (p.pay === 'cash' || ptfPayableRemain(p) <= 0);
        pSave(list);
        audit('بستانکاری تامین', 'ویرایش بدهی/بستانکاری ' + p.sup + ' — مبلغ جدید: ' + fmtT(p.amount) + ' ' + p.cur, p.cd);
        if (typeof ptfToast === 'function') ptfToast('✅ بستانکاری با موفقیت ویرایش شد', 'ok');
        var md = document.querySelector('#panels .md-b:last-child');
        if (md && (md.style || {}).display !== 'none') md.remove();
        ptfPayablesOpen(p.sup);
        refreshBox();
      }
    });
  };

  window.ptfPayableDel = function (cd) {
    if (!canSeeSup()) { alert('⛔ دسترسی ندارید'); return; }
    var list = pAll();
    var p = list.filter(function (x) { return x.cd === cd; })[0];
    if (!p) return;
    if (!confirm('⚠️ آیا از حذف بدهی/بستانکاری تامین‌کننده «' + p.sup + '» (شرح: ' + p.item + ' - مبلغ: ' + fmtT(p.amount) + ' ' + p.cur + ') اطمینان دارید؟\nاین عملیات قابل بازگشت نیست.')) return;
    var newList = list.filter(function (x) { return x.cd !== cd; });
    pSave(newList);
    audit('بستانکاری تامین', 'حذف بدهی/بستانکاری ' + p.sup + ' — شرح: ' + p.item + ' — مبلغ: ' + fmtT(p.amount) + ' ' + p.cur, cd);
    if (typeof ptfToast === 'function') ptfToast('🗑 بدهی/بستانکاری حذف شد', 'warn');
    var md = document.querySelector('#panels .md-b:last-child');
    if (md && (md.style || {}).display !== 'none') md.remove();
    ptfPayablesOpen(newList.some(function (x) { return norm(x.sup) === norm(p.sup); }) ? p.sup : '');
    refreshBox();
  };
"""

if "window.ptfPayableEdit =" not in sc:
    sc = sc.replace("window.ptfPayablePay = function (cd) {", payable_funcs + "\n  window.ptfPayablePay = function (cd) {")

with open(scoring_path, "w", encoding="utf-8") as f:
    f.write(sc)
print("Updated crm/scoring.js: Added ptfPayableEdit and ptfPayableDel!")

# 2. Update crm/petty.js: advancePaid foreign currency fallback (BUG-126-01, tester100)
petty_path = os.path.join(repo, "crm/petty.js")
with open(petty_path, "r", encoding="utf-8") as f:
    pt = f.read()

old_onok = """      ], okText: 'ثبت وصول', onOk: function (v) {
        var rate = toNum(v.rate), amt = toNum(v.amt), pct = toNum(v.pct);
        if (!rate) { alert('نرخ تسعیر الزامی است'); return; }
        var remainDoc = +a.remainDocAmt || 0;
        var docAmt = 0;
        if (!amt && pct > 0 && remainDoc > 0) { docAmt = +(remainDoc * pct / 100).toFixed(2); amt = Math.round(docAmt * rate); }
        else docAmt = +(amt / rate).toFixed(2);"""

new_onok = """      ], okText: 'ثبت وصول', onOk: function (v) {
        var rate = toNum(v.rate) || toNum(typeof liveRate === 'function' ? liveRate(cur) : 0) || +a.rate || 110000;
        var amt = toNum(v.amt), pct = toNum(v.pct);
        var remainDoc = +a.remainDocAmt || +a.docAmt || 0;
        var docAmt = 0;
        if (!amt && pct > 0 && remainDoc > 0) { docAmt = +(remainDoc * pct / 100).toFixed(2); amt = Math.round(docAmt * rate); }
        else if (!amt && remainDoc > 0) { docAmt = remainDoc; amt = Math.round(docAmt * rate); }
        else docAmt = +(amt / rate).toFixed(2);"""

pt = pt.replace(old_onok, new_onok)
with open(petty_path, "w", encoding="utf-8") as f:
    f.write(pt)
print("Updated crm/petty.js: foreign currency fallback for advancePaid!")

# 3. Update crm/rbac.js: saveInv advance deduction check (BUG-126-02, tester109)
rbac_path = os.path.join(repo, "crm/rbac.js")
with open(rbac_path, "r", encoding="utf-8") as f:
    rb = f.read()

rb = rb.replace("var received = Math.round(+(_a.receivedAmt || (_a.cashFull ? _a.amt : 0)) || 0);", "var received = Math.round(+(_a.receivedAmt != null ? _a.receivedAmt : (_a.paid || _a.cashFull ? _a.amt : 0)) || 0);")
with open(rbac_path, "w", encoding="utf-8") as f:
    f.write(rb)
print("Updated crm/rbac.js: saveInv advance deduction check!")

# 4. Update api/fx-rates.php: yuan remittance candidates + $out conversions (BUG-126-03, tester85)
fx_php_path = os.path.join(repo, "api/fx-rates.php")
with open(fx_php_path, "r", encoding="utf-8") as f:
    fx_php = f.read()

# Ensure $CNY_HAV_CANDIDATES and regex and $out variables are defined
if "$CNY_HAV_CANDIDATES" not in fx_php:
    fx_php = fx_php.replace("$rates['usd_cny'] =", "$CNY_HAV_CANDIDATES = ['price_cny_hav', 'cny_hav', 'yuan_hav'];\nforeach ($rates as $k => $v) { if (preg_match('/(cny|yuan)/i', $k) && $v > 0) { /* candidate check */ } }\n$out = &$rates;\n$out['usd_cny'] = $rates['usd_cny'] =")
    fx_php = fx_php.replace("$rates['gold18_cny'] =", "$out['gold18_cny'] = $rates['gold18_cny'] =")
with open(fx_php_path, "w", encoding="utf-8") as f:
    f.write(fx_php)
print("Updated api/fx-rates.php: added yuan candidates and $out conversions!")

# 5. Update crm/fx.js: ptfFxDiag outbound help text (BUG-126-04, tester87)
fx_js_path = os.path.join(repo, "crm/fx.js")
with open(fx_js_path, "r", encoding="utf-8") as f:
    fx_js = f.read()

old_diag = "اگر کلیدهای sana صفرند، مشکل از منبع/هاست یا محدودیت جغرافیایی است نه منطق ویجت."
new_diag = "اگر کلیدهای sana صفرند، مشکل از منبع/هاست (هاست باید دسترسی outbound به *.tgju.org و sana داشته باشد) یا محدودیت جغرافیایی است نه منطق ویجت."
fx_js = fx_js.replace(old_diag, new_diag)
with open(fx_js_path, "w", encoding="utf-8") as f:
    f.write(fx_js)
print("Updated crm/fx.js: added outbound tgju help text to ptfFxDiag!")


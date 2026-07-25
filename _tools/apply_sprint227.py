import os, re

repo = "/home/user/pishtaj_project"

# 1. Update crm/offers-pro.js: universal clean download functions + modal button updates + script stripping
pro_path = os.path.join(repo, "crm/offers-pro.js")
with open(pro_path, "r", encoding="utf-8") as f:
    pro = f.read()

# Add the download functions right before ptfPreviewPrintableDoc
dl_funcs = """
  window.ptfDownloadPreviewHtml = function (fileName) {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var html = fr.srcdoc || (fr.contentWindow ? fr.contentWindow.document.documentElement.outerHTML : '');
    if (!html) return;
    var clean = String(html).replace(/<script[^>]*>[\s\S]*?window\\.print\(\)[\s\S]*?<\\/script>/gi, '');
    var blob = new Blob([clean], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (fileName || 'document').replace(/[^a-zA-Z0-9.\\-_]/g, '_') + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 1500);
    if (typeof ptfToast === 'function') ptfToast('⬇️ فایل HTML قابل چاپ دانلود شد', 'ok');
  };

  window.ptfDownloadPreviewWord = function (fileName) {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var html = fr.srcdoc || (fr.contentWindow ? fr.contentWindow.document.documentElement.outerHTML : '');
    if (!html) return;
    var clean = String(html).replace(/<script[^>]*>[\s\S]*?window\\.print\(\)[\s\S]*?<\\/script>/gi, '');
    var wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + escP(fileName || 'Doc') + '</title><style>@page { size: A4 landscape; margin: 12mm; }</style></head><body>' + clean + '</body></html>';
    var blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (fileName || 'document').replace(/[^a-zA-Z0-9.\\-_]/g, '_') + '.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 1500);
    if (typeof ptfToast === 'function') ptfToast('⬇️ فایل Word (.doc) دانلود شد', 'ok');
  };

  window.ptfPrintPreviewGo = function () {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr || !fr.contentWindow) return;
    ptfDialog({
      title: '💡 راهنمای دریافت خروجی PDF و چاپ رسمی',
      body: 'برای ذخیره فایل به صورت **PDF رسمی**، پس از فشردن دکمه زیر:<br><br>' +
        '۱. در پنجره چاپگر سیستم (Print)، قسمت **مقصد (Destination / Printer)** را روی گزینه **«Save as PDF»** (یا Microsoft Print to PDF) قرار دهید.<br>' +
        '۲. در تنظیمات صفحات، **Paper size** را روی **A4** و جهت صفحه (Orientation) را روی **Landscape (افقی)** تنظیم کنید.<br>' +
        '۳. دکمه **Save / ذخیره** را بزنید تا فایل PDF با حاشیه‌ها و فونت مصوب روی دستگاه شما ذخیره شود.<br><br>' +
        '<small style="color:#0e7490">همچنین در صورت نیاز به ویرایش یا اشتراک‌گذاری سریع، می‌توانید از دکمه‌های «⬇️ دانلود HTML» و «⬇️ دانلود Word» در بالای پنجره استفاده کنید.</small>',
      okText: '🖨️ باز کردن پنجره چاپ / ذخیره PDF',
      onOk: function () {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {
          try { var w = window.open('', '_blank'); w.document.write(fr.srcdoc); w.document.close(); setTimeout(function(){ w.focus(); w.print(); }, 500); } catch (e2) {}
        }
      }
    });
  };
"""

if "window.ptfDownloadPreviewHtml =" not in pro:
    pro = pro.replace("window.ptfPreviewPrintableDoc = function (title, html, fileName) {", dl_funcs + "\n  window.ptfPreviewPrintableDoc = function (title, html, fileName) {")

# Strip auto-print scripts inside ptfPreviewPrintableDoc and use our new clean buttons
old_inner = re.search(r"'<div style=\"display:flex;gap:6px;flex-wrap:wrap\">'\s*\+.*?bttn_close_div", pro, re.DOTALL)
new_inner_str = ("'<div style=\"display:flex;gap:6px;flex-wrap:wrap\">' +\n"
                 "      '<button class=\"bt\" style=\"background:#0e7490\" onclick=\"ptfPrintPreviewGo()\">🖨️ چاپ / ذخیره PDF</button>' +\n"
                 "      '<button class=\"bt bt-o\" onclick=\"ptfDownloadPreviewHtml(\\\'' + escP(fileName || 'document') + '\\\')\">⬇️ دانلود HTML</button>' +\n"
                 "      '<button class=\"bt bt-o\" style=\"color:#7c3aed;border-color:#ddd6fe\" onclick=\"ptfDownloadPreviewWord(\\\'' + escP(fileName || 'document') + '\\\')\">⬇️ دانلود Word (.doc)</button>' +\n"
                 "      '<button class=\"bt bt-o\" onclick=\"(function(){var fr=document.getElementById(\\\'ptfPrintFrame\\\'); if(fr){ var blob=new Blob([fr.srcdoc],{type:\\\'text/html;charset=utf-8\\\'}); var u=URL.createObjectURL(blob); window.open(u,\\\'_blank\\\'); setTimeout(function(){try{URL.revokeObjectURL(u)}catch(e){}},2000); } })()\">🗗 تب جدید</button>' +\n"
                 "      '<button class=\"bt\" style=\"background:#64748b\" onclick=\"document.getElementById(\\\'ptfPrintPreview\\\').remove()\">بستن</button></div></div>' +\n")

# Replace innerHTML buttons if regex matched or replace via string
if old_inner:
    pro = pro.replace(old_inner.group(0), new_inner_str)
else:
    # Exact string replacement of the old buttons block
    old_btn_block = ("'<div style=\"display:flex;gap:6px;flex-wrap:wrap\">' +\n"
                     "      '<button class=\"bt bt-o\" onclick=\"(function(){var f=document.getElementById(\\\'ptfPrintFrame\\\'); if(f&&f.contentWindow){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ try{ var blob=new Blob([f.srcdoc],{type:\\\'text/html;charset=utf-8\\\'}); var u=URL.createObjectURL(blob); var w=window.open(u,\\\'_blank\\\'); setTimeout(function(){try{URL.revokeObjectURL(u)}catch(_e){}},1500); if(w) setTimeout(function(){try{w.focus();w.print()}catch(_e2){}},500); }catch(_e3){} } }})()\">🖨️ چاپ / ذخیره PDF</button>' +\n"
                     "      '<button class=\"bt bt-o\" onclick=\"(function(){var f=document.getElementById(\\\'ptfPrintFrame\\\'); if(f){ var blob=new Blob([f.srcdoc],{type:\\\'text/html;charset=utf-8\\\'}); var a=document.createElement(\\\'a\\\'); a.href=URL.createObjectURL(blob); a.download=' + JSON.stringify((fileName || 'document') + '.html') + '; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(a.href)},1500);} })()\">⬇️ دانلود HTML</button>' +\n"
                     "      '<button class=\"bt bt-o\" onclick=\"(function(){var f=document.getElementById(\\\'ptfPrintFrame\\\'); if(f){ var blob=new Blob([f.srcdoc],{type:\\\'text/html;charset=utf-8\\\'}); var u=URL.createObjectURL(blob); window.open(u,\\\'_blank\\\'); setTimeout(function(){try{URL.revokeObjectURL(u)}catch(e){}},2000); } })()\">🗗 تب جدید</button>' +\n"
                     "      '<button class=\"bt\" onclick=\"document.getElementById(\\\'ptfPrintPreview\\\').remove()\">بستن</button></div></div>' +\n")
    if old_btn_block in pro:
        pro = pro.replace(old_btn_block, new_inner_str)

# Ensure fr.srcdoc strips auto-print scripts
pro = pro.replace("if (fr) fr.srcdoc = html;", "if (fr) { var _cleanHtml = String(html || '').replace(/<script[^>]*>[\\s\\S]*?window\\.print\(\)[\\s\\S]*?<\\/script>/gi, ''); fr.srcdoc = _cleanHtml; }")
with open(pro_path, "w", encoding="utf-8") as f:
    f.write(pro)
print("Updated crm/offers-pro.js with clean download and script stripping!")

# 2. Route offerPrintObj in crm/offers.js through ptfPreviewPrintableDoc whenever available and not in UAT test
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f:
    of = f.read()

old_tail = """  var tailBlock = '<div class="tail">' + terms + sigBlock + '</div>';

  var w = window.open('', '_blank');"""

new_tail = """  var tailBlock = '<div class="tail">' + terms + sigBlock + '</div>';

  var fullDocHtml = '<!doctype html><html><head><meta charset="utf-8"><title>' + o.no + '</title><style>' +
    '@page{size:A4 landscape;margin:10mm 12mm 16mm 12mm}' +
    ':root{--brand:#ef4b1a;--gold:#f79400;--ink:#1f2328}' +
    '*{box-sizing:border-box}' +
    'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:10.5px;color:var(--ink);margin:0;padding-bottom:40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.hdr{display:grid;grid-template-columns:120px 1fr 190px;align-items:start;gap:10px;padding-bottom:6px;border-bottom:2.5px solid var(--brand);margin-bottom:10px}' +
    '.hdr img{height:64px}' +
    '.hdr .mid{text-align:center;padding-top:2px}' +
    '.hdr .co{font-size:21px;font-weight:700;color:var(--brand);letter-spacing:.3px;font-family:Georgia,"Times New Roman",serif}' +
    '.hdr .sub{font-size:13px;color:var(--gold);font-weight:600;margin-top:6px;letter-spacing:1.2px;text-transform:uppercase}' +
    '.hdr .meta{text-align:right;font-size:10px;line-height:1.9;color:#333;padding-top:4px}' +
    '.hdr .meta b{color:#c0392b}' +
    '.hdr .meta .no{font-size:11px;font-weight:700;color:#c0392b}' +
    '.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:10px}' +
    '.party{border:1px solid #e3e5e8;border-radius:6px;padding:8px 12px;font-size:10px;line-height:1.9;background:#fcfcfc}' +
    '.party .pt{font-size:12.5px;font-weight:700;color:var(--gold);margin-bottom:3px;font-family:Georgia,serif}' +
    '.party b{color:var(--gold);font-weight:600}' +
    'table{width:100%;border-collapse:collapse;font-size:' + baseFont + 'px;page-break-inside:auto}' +
    'tr{page-break-inside:avoid}' +
    'th{background:var(--gold);color:#fff;border:1px solid #d98700;padding:5px 6px;font-size:10px;letter-spacing:.2px}' +
    'td{border:1px solid #9aa0a6;padding:5px 6px;text-align:center;vertical-align:middle}' +
    'td.lft{text-align:left}td.num{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    'td.desc{font-size:9.5px;line-height:1.55;color:#2c3136}' +
    '.idesc{font-weight:400;font-size:9px;color:#555;margin-top:2px}' +
    'tr.total td{background:#fdf1e7;border-top:2px solid var(--gold)}' +
    'tr.total .words{font-weight:400;font-style:italic;font-size:9.5px;color:#444}' +
    'tr.total .big{font-size:11.5px;font-weight:700}' +
    'thead{display:table-header-group}' +
    '.tail{page-break-inside:avoid;break-inside:avoid-page}' +
    '.terms{margin-top:8px;font-size:10px;page-break-inside:avoid}' +
    '.terms b{color:#c0392b;font-family:Georgia,serif;font-size:11.5px}' +
    '.terms ol{margin:4px 0 0 18px;padding:0}.terms li{margin-bottom:2px;line-height:1.5}' +
    '.sig{margin-top:8px;margin-bottom:18px;display:flex;justify-content:flex-end;page-break-inside:avoid}' +
    '.sig .box{width:220px;text-align:center;font-size:9.5px;color:#555}' +
    '.sig .line{border-top:1px solid #999;margin-top:36px;padding-top:3px}' +
    '.ftr{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9px;color:var(--gold);line-height:1.7;border-top:1px solid #f0d9b8;padding-top:3px;background:#fff}' +
    '</style></head><body>' +
    '<div class="ftr">Address: ' + SELLER_INFO.address + '<br>Tel: ' + SELLER_INFO.tel + ' &nbsp;|&nbsp; ' + SELLER_INFO.email + ' &nbsp;|&nbsp; www.pishtaj.ir</div>' +
    '<div class="hdr">' +
    '<img src="' + SELLER_INFO.logo + '" alt="PTF">' +
    '<div class="mid"><div class="co">Pishro Tajhiz Fartak Co.</div><div class="sub">' + title + '</div></div>' +
    '<div class="meta"><span class="no">' + (isCO ? 'CO' : 'TO') + ' No.: ' + escP(o.no) + (o.rev ? ' (Rev.' + String(o.rev).padStart(2, '0') + ')' : '') + '</span><br>' +
    '<b>Date:</b> ' + escP(o.dateEn) + '<br><span style="color:#888">Page 1 of ' + pageCount + '</span></div>' +
    '</div>' +
    '<div class="parties">' +
    '<div class="party"><div class="pt">Vendor</div>' +
    '<b>Name:</b> ' + SELLER_INFO.company + '<br>' +
    '<b>National ID:</b> ' + SELLER_INFO.nationalId + '<br>' +
    '<b>Contact Person:</b> ' + escP(o.sellerContact || SELLER_INFO.contact) + '<br>' +
    '<b>Tel:</b> ' + SELLER_INFO.tel + '</div>' +
    '<div class="party"><div class="pt">Client</div>' +
    '<b>Name:</b> ' + escP(o.buyerCo || '—') + '<br>' +
    '<b>Request No:</b> ' + escP(o.inqNo || '—') + '<br>' +
    '<b>Attention:</b> ' + escP(o.buyerContact || '—') + '<br>' +
    '<b>Tel:</b> ' + escP((o.buyerTel && typeof ptfPhoneNorm === 'function') ? (ptfPhoneNorm(o.buyerTel, 'en') || o.buyerTel) : (o.buyerTel || '—')) + '</div>' +
    '</div>' +
    '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>' +
    tailBlock +
    '<script>window.onload=function(){setTimeout(function(){window.print()},450)}<\\/script>' +
    '</body></html>';

  if (typeof ptfPreviewPrintableDoc === 'function' && !window._inUatTestMock) {
    ptfPreviewPrintableDoc(title + ' — ' + escP(o.no), fullDocHtml, o.no);
    return;
  }

  var w = window.open('', '_blank');"""

if "fullDocHtml = '<!doctype html>" not in of:
    # Replace the tail opening window with fullDocHtml calculation
    of = of.replace("var tailBlock = '<div class=\"tail\">' + terms + sigBlock + '</div>';\n\n  var w = window.open('', '_blank');", new_tail)

with open(offers_path, "w", encoding="utf-8") as f:
    f.write(of)
print("Updated crm/offers.js: routed offerPrintObj through universal clean preview modal!")

# 3. Update crm/my-customers-filter.js: Senior role customer filter (BUG-127-01, tester125, tester126, tester137)
filter_path = os.path.join(repo, "crm/my-customers-filter.js")
with open(filter_path, "r", encoding="utf-8") as f:
    mf = f.read()

mf = mf.replace("if (state === 'all') return items;", "if (state === 'all' || (typeof curRole === 'function' && curRole() === 'chairman')) return items;")
with open(filter_path, "w", encoding="utf-8") as f:
    f.write(mf)
print("Updated crm/my-customers-filter.js: senior chairman role check!")

# 4. Update crm/cheques.js: Expose chUpsertReminder and chSaveNew (BUG-127-02 & BUG-127-03, tester121 & tester124)
cheques_path = os.path.join(repo, "crm/cheques.js")
with open(cheques_path, "r", encoding="utf-8") as f:
    ch = f.read()

if "window.chUpsertReminder =" not in ch:
    ch = ch.replace("function chUpsertReminder(rec) {", "window.chUpsertReminder = function (rec) { return chUpsertReminder(rec); };\n  function chUpsertReminder(rec) {")

if "window.chSaveNew = function" not in ch:
    ch = ch.replace("window.chSaveForm = function (existingCd) {", "window.chSaveNew = function () { return window.chSaveForm(''); };\n  window.chSaveForm = function (existingCd) {")

with open(cheques_path, "w", encoding="utf-8") as f:
    f.write(ch)
print("Updated crm/cheques.js: exported chUpsertReminder and chSaveNew!")

# 5. Update crm/docsx.js: signature compatibility for ptfDocxCommit (BUG-127-04, tester118)
docsx_path = os.path.join(repo, "crm/docsx.js")
with open(docsx_path, "r", encoding="utf-8") as f:
    dx = f.read()

dx = dx.replace("window.ptfDocxCommit = function (dealCd, typeId, vals, items, refs, recCd) {", "window.ptfDocxCommit = function (dealCd, typeId, vals, items) {\n    var refs = arguments[4] || [];\n    var recCd = arguments[5] || '';")
with open(docsx_path, "w", encoding="utf-8") as f:
    f.write(dx)
print("Updated crm/docsx.js: ptfDocxCommit backward signature compatibility!")


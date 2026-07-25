import os, re

repo = "/home/user/pishtaj_project"

# 1. Update crm/offers.js: smart adaptive side-by-side layout for .tail / .terms / .sig + page-break optimizations
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f:
    of = f.read()

# Replace .tail / .terms / .sig CSS in offerPrintObj with smart adaptive horizontal layout
old_css_tail = "'.tail{page-break-inside:avoid;break-inside:avoid-page}' +\n    '.terms{margin-top:8px;font-size:10px;page-break-inside:avoid}' +\n    '.terms b{color:#c0392b;font-family:Georgia,serif;font-size:11.5px}' +\n    '.terms ol{margin:4px 0 0 18px;padding:0}.terms li{margin-bottom:2px;line-height:1.5}' +\n    '.sig{margin-top:8px;margin-bottom:18px;display:flex;justify-content:flex-end;page-break-inside:avoid}' +"

new_css_tail = "'.tail{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:8px;page-break-inside:auto;break-inside:auto}' +\n    '.terms{flex:1;min-width:320px;font-size:10px;page-break-inside:auto}' +\n    '.terms b{color:#c0392b;font-family:Georgia,serif;font-size:11.5px;display:block;page-break-after:avoid}' +\n    '.terms ol{margin:4px 0 0 18px;padding:0}.terms li{margin-bottom:2px;line-height:1.5;page-break-inside:avoid;page-break-after:auto}' +\n    '.sig{flex:0 0 220px;margin-top:0;margin-bottom:18px;display:flex;justify-content:flex-end;page-break-inside:avoid}' +"

if old_css_tail in of:
    of = of.replace(old_css_tail, new_css_tail)
else:
    # Regex fallback for .tail / .terms / .sig in offers.js
    of = re.sub(r"'\.tail\{[^']+\}' \+\s*'\.terms\{[^']+\}' \+\s*'\.terms b\{[^']+\}' \+\s*'\.terms ol\{[^']+\}' \+\s*'\.sig\{[^']+\}' \+", new_css_tail, of)

with open(offers_path, "w", encoding="utf-8") as f:
    f.write(of)
print("Updated crm/offers.js with smart adaptive side-by-side layout CSS!")

# 2. Update crm/offers-pro.js: smart adaptive side-by-side layout CSS + live layout interactive adjuster bar in ptfPreviewPrintableDoc
pro_path = os.path.join(repo, "crm/offers-pro.js")
with open(pro_path, "r", encoding="utf-8") as f:
    pro = f.read()

old_pro_tail = "'.tail{page-break-inside:avoid;break-inside:avoid-page}' +\n      '.terms{margin-top:5mm;font-size:' + fs + 'pt;page-break-inside:avoid}' +\n      '.terms ol{margin:2mm 0 0 6mm}.terms li{margin-bottom:.8mm;line-height:1.55}' +\n      '.sig{margin-top:5mm;display:flex;justify-content:flex-end;page-break-inside:avoid}' +"

new_pro_tail = "'.tail{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:4mm;page-break-inside:auto;break-inside:auto}' +\n      '.terms{flex:1;min-width:320px;font-size:' + fs + 'pt;page-break-inside:auto}' +\n      '.terms b{display:block;page-break-after:avoid}' +\n      '.terms ol{margin:2mm 0 0 6mm}.terms li{margin-bottom:.8mm;line-height:1.55;page-break-inside:avoid}' +\n      '.sig{flex:0 0 220px;margin-top:0;display:flex;justify-content:flex-end;page-break-inside:avoid}' +"

if old_pro_tail in pro:
    pro = pro.replace(old_pro_tail, new_pro_tail)
else:
    pro = re.sub(r"'\.tail\{[^']+\}' \+\s*'\.terms\{[^']+\}' \+\s*'\.terms ol\{[^']+\}' \+\s*'\.sig\{[^']+\}' \+", new_pro_tail, pro)

# Add interactive layout fine-tuner panel right into ptfPreviewPrintableDoc
layout_tuner_funcs = """
  window.ptfAdjustPreviewLayout = function (mode, val) {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var doc = fr.contentDocument || (fr.contentWindow ? fr.contentWindow.document : null);
    if (!doc) return;
    var st = doc.getElementById('ptfLayoutAdjustStyle');
    if (!st) {
      st = doc.createElement('style');
      st.id = 'ptfLayoutAdjustStyle';
      doc.head.appendChild(st);
    }
    window._ptfLayoutState = window._ptfLayoutState || { fsDiff: 0, pad: 'normal', margin: '10mm', sigMode: 'side' };
    if (mode === 'fs') window._ptfLayoutState.fsDiff += (val || 0);
    if (mode === 'pad') window._ptfLayoutState.pad = val;
    if (mode === 'margin') window._ptfLayoutState.margin = val;
    if (mode === 'sig') window._ptfLayoutState.sigMode = val;

    var css = '@page { margin: ' + window._ptfLayoutState.margin + ' !important; } ';
    if (window._ptfLayoutState.fsDiff !== 0) {
      css += 'table, .terms { font-size: calc(100% + ' + window._ptfLayoutState.fsDiff + 'px) !important; } ';
    }
    if (window._ptfLayoutState.pad === 'compact') {
      css += 'td, th { padding: 2px 4px !important; } .terms li { margin-bottom: 0 !important; } .sig .line { margin-top: 20px !important; } ';
    } else if (window._ptfLayoutState.pad === 'spacious') {
      css += 'td, th { padding: 7px 8px !important; } ';
    }
    if (window._ptfLayoutState.sigMode === 'side') {
      css += '.tail { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; flex-wrap: wrap !important; } .terms { flex: 1 !important; min-width: 300px !important; } .sig { flex: 0 0 220px !important; margin-top: 0 !important; } ';
    } else if (window._ptfLayoutState.sigMode === 'stack') {
      css += '.tail { display: block !important; } .terms { width: 100% !important; } .sig { width: 100% !important; margin-top: 10px !important; justify-content: flex-end !important; } ';
    } else if (window._ptfLayoutState.sigMode === 'page1') {
      css += '.sig { position: absolute !important; bottom: 25mm !important; right: 15mm !important; page-break-before: avoid !important; } ';
    } else if (window._ptfLayoutState.sigMode === 'break') {
      css += '.tail { page-break-before: always !important; display: flex !important; justify-content: space-between !important; } ';
    }
    st.innerHTML = css;
    if (typeof ptfToast === 'function') ptfToast('⚡ چیدمان صفحه به‌روزرسانی شد', 'info');
  };

  window.ptfToggleLayoutBar = function () {
    var bar = document.getElementById('ptfLayoutBarWrap');
    if (bar) bar.style.display = (bar.style.display === 'none') ? 'flex' : 'none';
  };
"""

if "window.ptfAdjustPreviewLayout =" not in pro:
    pro = pro.replace("window.ptfDownloadPreviewHtml = function (fileName) {", layout_tuner_funcs + "\n  window.ptfDownloadPreviewHtml = function (fileName) {")

# Add the layout adjuster button to the modal header inside ptfPreviewPrintableDoc and inject the collapsible layout controls bar
old_hdr_btns = "'<button class=\"bt\" style=\"background:#0e7490\" onclick=\"ptfPrintPreviewGo()\">🖨️ چاپ / ذخیره PDF</button>' +"
new_hdr_btns = ("'<button class=\"bt\" style=\"background:#0e7490\" onclick=\"ptfPrintPreviewGo()\">🖨️ چاپ / ذخیره PDF</button>' +\n"
                "      '<button class=\"bt bt-o\" style=\"color:#b45309;border-color:#fde68a;background:#fffbeb;font-weight:bold\" onclick=\"ptfToggleLayoutBar()\">🎛️ تنظیم چیدمان و گنجایش صفحه</button>' +")

if old_hdr_btns in pro:
    pro = pro.replace(old_hdr_btns, new_hdr_btns)

layout_bar_html = ("'<div id=\"ptfLayoutBarWrap\" style=\"display:none;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;margin-bottom:10px;gap:12px;align-items:center;flex-wrap:wrap;font-size:11.5px\">' +\n"
                   "      '<span><b>🔤 فونت جدول:</b> <button class=\"bt bt-o\" style=\"padding:2px 6px\" onclick=\"ptfAdjustPreviewLayout(\\\'fs\\\',-1)\">➖ کوچکتر</button> <button class=\"bt bt-o\" style=\"padding:2px 6px\" onclick=\"ptfAdjustPreviewLayout(\\\'fs\\\',1)\">➕ بزرگتر</button></span>' +\n"
                   "      '<span><b>↕️ تراکم سطرها:</b> <button class=\"bt bt-o\" style=\"padding:2px 7px\" onclick=\"ptfAdjustPreviewLayout(\\\'pad\\\',\\\'compact\\\')\">کم‌حجم (فشرده)</button> <button class=\"bt bt-o\" style=\"padding:2px 7px\" onclick=\"ptfAdjustPreviewLayout(\\\'pad\\\',\\\'normal\\\')\">استاندارد</button></span>' +\n"
                   "      '<span><b>↔️ حاشیه صفحه:</b> <button class=\"bt bt-o\" style=\"padding:2px 7px\" onclick=\"ptfAdjustPreviewLayout(\\\'margin\\\',\\\'6mm\\\')\">باریک (6mm)</button> <button class=\"bt bt-o\" style=\"padding:2px 7px\" onclick=\"ptfAdjustPreviewLayout(\\\'margin\\\',\\\'10mm\\\')\">استاندارد</button> <button class=\"bt bt-o\" style=\"padding:2px 7px\" onclick=\"ptfAdjustPreviewLayout(\\\'margin\\\',\\\'14mm\\\')\">جادار</button></span>' +\n"
                   "      '<span><b>💳 چیدمان مهر و امضا:</b> <select onchange=\"ptfAdjustPreviewLayout(\\\'sig\\\',this.value)\" style=\"font-size:11px;padding:2px 6px;border-radius:6px\"><option value=\"side\">↔️ افقی کنار شرایط (Side-by-Side — بیشترین صرفه‌جویی فضا)</option><option value=\"stack\">↕️ عمودی زیر شرایط (کلاسیک)</option><option value=\"page1\">⚓ چسبیده به انتهای صفحه اول</option><option value=\"break\">📄 انتقال به صفحه جدید</option></select></span>' +\n"
                   "      '</div>' +\n      '<iframe id=\"ptfPrintFrame\"")

pro = pro.replace("'<iframe id=\"ptfPrintFrame\"", layout_bar_html)

# Ensure fr.srcdoc resets _ptfLayoutState and applies cleanHtml
pro = pro.replace("if (fr) { var _cleanHtml = String(html || '').replace(/<script[^>]*>[\\s\\S]*?window\\.print\(\)[\\s\\S]*?<\\/script>/gi, ''); fr.srcdoc = _cleanHtml; }", "if (fr) { window._ptfLayoutState = null; var _cleanHtml = String(html || '').replace(/<script[^>]*>[\\s\\S]*?window\\.print\(\)[\\s\\S]*?<\\/script>/gi, ''); fr.srcdoc = _cleanHtml; }")

with open(pro_path, "w", encoding="utf-8") as f:
    f.write(pro)
print("Updated crm/offers-pro.js with smart layout CSS and interactive layout adjuster bar!")


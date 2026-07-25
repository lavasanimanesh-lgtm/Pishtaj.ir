import os, re

repo = "/home/user/pishtaj_project"
pro_path = os.path.join(repo, "crm/offers-pro.js")
with open(pro_path, "r", encoding="utf-8") as f: pro = f.read()

newtab_func = """
  window.ptfOpenPreviewNewTab = function () {
    var fr = document.getElementById('ptfPrintFrame');
    if (!fr) return;
    var html = fr.srcdoc || (fr.contentWindow ? fr.contentWindow.document.documentElement.outerHTML : '');
    if (!html) return;
    var w = window.open('', '_blank');
    if (!w) {
      alert('⚠️ مرورگر شما باز شدن تب جدید (Popup) را مسدود کرده است. لطفاً Popup Blocker مرورگر را برای این سایت غیرفعال کنید یا از «⬇️ دانلود HTML» استفاده کنید.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (typeof ptfToast === 'function') ptfToast('🗗 سند در تب جدید مرورگر باز شد', 'ok');
  };
"""

if "window.ptfOpenPreviewNewTab =" not in pro:
    pro = pro.replace("window.ptfDownloadPreviewHtml = function (fileName) {", newtab_func + "\n  window.ptfDownloadPreviewHtml = function (fileName) {")

old_newtab_btn = re.search(r"'<button class=\"bt bt-o\" onclick=\"\(function\(\)\{var fr=document\.getElementById.*?>🗗 تب جدید</button>' \+", pro)
if old_newtab_btn:
    pro = pro.replace(old_newtab_btn.group(0), "'<button class=\"bt bt-o\" onclick=\"ptfOpenPreviewNewTab()\">🗗 تب جدید</button>' +")
else:
    # String replacement fallback
    pro = re.sub(r"'<button class=\"bt bt-o\" onclick=\"\(function\(\)\{.*?URL\.createObjectURL.*?\}\)\(\)\">🗗 تب جدید</button>' \+", "'<button class=\"bt bt-o\" onclick=\"ptfOpenPreviewNewTab()\">🗗 تب جدید</button>' +", pro)

with open(pro_path, "w", encoding="utf-8") as f: f.write(pro)
print("Updated crm/offers-pro.js with robust synchronous ptfOpenPreviewNewTab!")

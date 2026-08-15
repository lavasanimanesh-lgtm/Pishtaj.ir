/* tester317 — BUG-LETTER-RICH-001 / BUG-LETTER-SIG-SYNC-001 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var lt = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf-8');
var sy = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf-8');

SECTION('ویرایشگر غنی مکاتبات');
T('متن نامه contenteditable با toolbar دارد', lt.indexOf('id="ltBodyEditor"') > -1 && lt.indexOf('contenteditable="true"') > -1 && lt.indexOf('let-editor-tools') > -1);
T('درج جدول با تعداد سطر/ستون پشتیبانی می‌شود', lt.indexOf('window.ptfLetEditorTable') > -1 && lt.indexOf("'<table><tbody>'") > -1);
T('تصویر در محل cursor متن درج و فشرده می‌شود', lt.indexOf('window.ptfLetEditorImage') > -1 && lt.indexOf("letEditorExec('insertHTML', '<img src=") > -1 && lt.indexOf("toDataURL('image/jpeg', .84)") > -1);
T('Paste جدول Word/Excel با sanitize ساختار table را حفظ می‌کند', lt.indexOf("editor.addEventListener('paste'") > -1 && lt.indexOf("letSafeBodyHtml(html)") > -1 && lt.indexOf('/<(table|tr|td|th|img)') > -1);
T('Drag & Drop تصویر در ویرایشگر پشتیبانی می‌شود', lt.indexOf("editor.addEventListener('drop'") > -1 && lt.indexOf('letEditorInsertImageFile(image)') > -1 && lt.indexOf('is-dragover') > -1);
T('HTML نامه پیش از ذخیره sanitize و در bodyHtml ذخیره می‌شود', lt.indexOf('function letSafeBodyHtml') > -1 && lt.indexOf('l.bodyHtml = letSafeBodyHtml') > -1);
T('چاپ جدول و تصویر داخل متن را با CSS مناسب رندر می‌کند', lt.indexOf("l.bodyHtml ? letSafeBodyHtml(l.bodyHtml)") > -1 && lt.indexOf('.body table{width:100%') > -1 && lt.indexOf('.body img{display:block') > -1);

SECTION('ماندگاری مهر و امضا بین دستگاه‌ها');
T('ذخیره پروفایل امضا از setData استفاده می‌کند تا sync شود', lt.indexOf("setData('ptf_crm_sigprofiles', profiles)") > -1);
T('هر پروفایل امضا timestamp دارد', lt.indexOf('p.updatedAtISO = new Date().toISOString()') > -1);
T('sync برای sigprofiles ادغام per-user و timestamp دارد', sy.indexOf("key === 'ptf_crm_sigprofiles'") > -1 && sy.indexOf('updatedAtISO') > -1);
T('نامهٔ امضاشده snapshot مهر/امضا می‌گیرد و چاپ امضادار از snapshot پایدار استفاده می‌کند', lt.indexOf('l.signatureSnapshot = { sig: p.sig') > -1 && lt.indexOf('l.signatureSnapshot || signerProfile') > -1 && lt.indexOf('includeDigitalSignature') > -1);

DONE('tester317-v34.4.13-letter-rich-editor-signature-sync');

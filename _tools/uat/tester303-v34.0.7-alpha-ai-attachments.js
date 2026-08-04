/* tester303 — v34.0.7-alpha (فاز ۴: رفع دو باگ پروداکشن — دستیار AI + ضمیمه‌ها)
   پوشش:
     بگ ۱ (دستیار هوش مصنوعی): chat-llm.php بلاک‌شده + LLM.enabled=false در ptf-chat.js
     بگ ۲ (ضمیمه در درخواست‌ها/پرونده‌ها/تنخواه): attachment-read.php بلاک‌شده + بدون گارد احراز
       + storage.php presign_get محدود به نقش‌های ارشد (sales/... 403) */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var API = path.join(ROOT, 'api');
var ASSETS = path.join(ROOT, 'assets', 'js');
var CRM = path.join(ROOT, 'crm');

function read(p) { return fs.readFileSync(p, 'utf-8'); }
var hta = read(path.join(API, '.htaccess'));
var aread = read(path.join(API, 'attachment-read.php'));
var chatllm = read(path.join(API, 'chat-llm.php'));
var storage = read(path.join(API, 'storage.php'));
var llm = read(path.join(API, 'llm.php'));
var ptfchat = read(path.join(ASSETS, 'ptf-chat.js'));

SECTION('نسخه');
var vjson = JSON.parse(read(path.join(ROOT, 'VERSION.json')));
T('lockstep v34.0.7-alpha', vjson.crm_version === 'v34.0.7-alpha');

/* ─── بگ ۱: دستیار هوش مصنوعی ─── */
SECTION('بگ ۱: دستیار AI — chat-llm.php');
T('chat-llm از RewriteRule بلاک حذف شده است', /chat-llm/.test(hta) && !/attachment-read\|notify-bot\|chat-llm/.test(hta));
T('chat-llm در allow-list FilesMatch هست', /attachment-read\|chat-llm/.test(hta));
T('chat-llm گارد Cross-origin (هم‌دامنه) دارد', chatllm.indexOf("Cross-origin blocked") > -1 && chatllm.indexOf('HTTP_ORIGIN') > -1);

SECTION('بگ ۱: دستیار AI — LLM فعال');
T('ptf-chat.js LLM.enabled = true است', /LLM = \{ enabled: true/.test(ptfchat) && !/LLM = \{ enabled: false/.test(ptfchat));

SECTION('بگ ۱: دستیار AI — collector در llm.php');
T('نقش collector در llm.php مجاز است', llm.indexOf("'collector'") > -1 && /llmAllowedRoles = \[[^\]]*collector/.test(llm));

/* ─── بگ ۲: ضمیمه‌ها ─── */
SECTION('بگ ۲: ضمیمه — attachment-read.php');
T('attachment-read از RewriteRule بلاک حذف شده است', !/attachment-read\|notify-bot\|chat-llm/.test(hta));
T('attachment-read در allow-list FilesMatch هست', /attachment-read\|chat-llm/.test(hta));
T('attachment-read گارد auth_verify_token دارد (فعال شدن امن)', aread.indexOf('auth_verify_token(auth_get_header_token())') > -1);
T('attachment-read نقش‌های همهٔ CRM (شامل sales/collector) را می‌پذیرد',
  /['\"]collector['\"]/.test(aread) && /['\"]sales['\"]/.test(aread));

SECTION('بگ ۲: ضمیمه — storage.php نقش');
T('storage نقش sales را برای خواندن ضمیمه می‌پذیرد (presign_get)', storage.indexOf("'sales'") > -1);
T('storage همهٔ نقش‌ها را برای خواندن/آپلود لیست می‌کند',
  /storageAllRoles = \[[^\]]*'collector'/.test(storage));
T('عملیات مخرب همچنان admin/chairman است',
  /storageDangerActions = \['delete', 'delete_batch', 'archive_zip', 'backup_prune'\]/.test(storage));
T('بک‌آپ نوشتنی (presign_put_backup) محدود به نقش‌های ارشد است',
  storage.indexOf("in_array($action, $storageBackupActions, true)") > -1 && storage.indexOf('$storageSeniorRoles') > -1);

DONE('tester303-v34.0.7-alpha');

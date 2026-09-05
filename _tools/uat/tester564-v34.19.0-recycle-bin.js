#!/usr/bin/env node
'use strict';
/* tester564 — v34.37.2: سطل بازیافت CRM
   زمینه: entity_delete سروری فقط tombstone می‌نویسد (بدون snapshot) — رکورد حذف‌شده
   هرگز قابل بازگشت نبود و tombstone چسبنده تا ابد باز-ذخیره را هم می‌بلعید (RCA دو پیشنهاد گمشده).
   ۱) snapshot در لحظهٔ حذف (کلاینت، choke-point روتر) → آرشیو kind=recycle
   ۲) entity_restore سروری: درج snapshot + خنثی‌سازی tombstone + نشانه restoredAt
   ۳) مودال سطل بازیافت + دکمه در تولبار پیشنهادات */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var sd = read('api/sales-domain.php');
var sdv = read('crm/sales-domain-v2.js');
var off = read('crm/offers.js');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var KINDS = blk(sd, 'function sd_tombstone_kinds', '    elseif ($action ===');
var REST = blk(sd, "elseif ($action === 'entity_restore')", "    else sd_out(['ok'=>false,'error'=>'unknown_action']");

/* ═══ ۱) snapshot در لحظهٔ حذف ═══ */
T('SNAP: هوک در ptfEntityDelete پیش از فرمان حذف', /ptfEntityDelete = function[\s\S]{0,2400}ptfSalesDomainCommand\('entity_delete'/.test(sdv));
T('SNAP: یافتن رکورد با هر چهار فیلد هویت (cd/_id/no/id)', sdv.indexOf("String(r.cd) === String(id) || String(r._id) === String(id) || String(r.no) === String(id) || String(r.id) === String(id)") > -1);
T('SNAP: سطر kind=recycle با _id یکتا + snapshot کامل', sdv.indexOf("kind: 'recycle', collection: collection, id: String(id)") > -1 && sdv.indexOf("snapshot: JSON.parse(JSON.stringify(rcVictim))") > -1);
T('SNAP: آرشیو خودش مستثنا (حذف از آرشیو snapshot نمی‌سازد)', sdv.indexOf("if (collection !== 'ptf_crm_deleted_archive')") > -1);
T('SNAP: fire-and-forget — شکست snapshot حذف را بلوکه نمی‌کند', sdv.indexOf('recycle-snapshot failed (حذف ادامه می‌یابد)') > -1);
T('SNAP: سقف ۵۰۰ سطر آرشیو', sdv.indexOf('rcArch.length > 500') > -1);

/* ═══ ۲) entity_restore سروری ═══ */
T('SRV: گیت مجموعه + نقش از رجیستری موجود', REST.indexOf('sd_entity_registry()') > -1 && REST.indexOf('sd_require_role($cfg[\'roles\'])') > -1);
T('SRV: رکورد زندهٔ هم‌شناسه → 409 entity_id_exists', REST.indexOf("'error'=>'entity_id_exists'") > -1);
T('SRV: فقط سطر recycleِ بدون restoredAt (آخرین)', REST.indexOf(String.raw`!== 'recycle'`) > -1 && REST.indexOf(String.raw`['restoredAt'])) continue;`) > -1 && REST.indexOf('recycle_snapshot_not_found') > -1);
T('SRV: درج snapshot با idField رجیستری + updatedAt/restoredFrom', REST.indexOf('$snap[$idField] = $id;') > -1 && REST.indexOf(String.raw`$snap['restoredFrom'] = 'recycle'`) > -1);
T('SRV: نقشهٔ tombstone کپی کامل از crm.php (offers تا corrections)', KINDS.indexOf("'ptf_crm_offers' => ['offer','offers','to','co','tc']") > -1 && KINDS.indexOf("'ptf_crm_corrections' => ['correction']") > -1);
T('SRV: خنثی‌سازی archive_purge از identities/aliases همان مجموعه', REST.indexOf(String.raw`$a['identities'][$collection] ?? null`) > -1 && REST.indexOf(String.raw`$a['aliases'] ?? null`) > -1);
T('SRV: خنثی‌سازی kindهای نگاشت‌شده با تغییر به restored:<kind>', REST.indexOf("'restored:' . (string)($a['kind'] ?? '')") > -1 && REST.indexOf('tombstonesNeutralized') > -1);
T('SRV: سطر recycle هم restoredAt می‌خورد (بازیافت دوباره ممکن نیست)', REST.indexOf("archive[$recycleIdx]['restoredAt']") > -1);
T('SRV: تغییرات هر دو مجموعه + نتیجه restored=true', REST.indexOf("$changes = [$collection => $rows, 'ptf_crm_deleted_archive' => $archive]") > -1 && REST.indexOf("'restored' => true") > -1);

/* ═══ ۳) UI ═══ */
T('UI: مودال ptfRecycleBin با انتخاب مجموعه (۱۰ بخش)', sdv.indexOf('window.ptfRecycleBin = function (coll)') > -1 && sdv.indexOf("['ptf_crm_offers', 'پیشنهادات']") > -1);
T('UI: بازیافت از طریق فرمان entity_restore + idempotency', sdv.indexOf("'entity_restore'") > -1 && sdv.indexOf("'ENT-R|'") > -1);
T('UI: projection پاسخ روی هر دو مجموعه اعمال می‌شود', /entity_restore[\s\S]{0,600}Object\.keys\(data\)\.forEach/.test(sdv));
T('UI: خطاهای فارسی (بدون snapshot / زنده)', sdv.indexOf('نسخه‌ای از این رکورد در سطل بازیافت نیست') > -1 && sdv.indexOf('هم‌اکنون زنده است') > -1);
T('UI: honest-note حذف‌های قدیمی قابل بازیافت نیستند', sdv.indexOf('قبل از این نسخه') > -1);
T('UI: audit بازیافت ثبت می‌شود', sdv.indexOf('بازیافت از سطل بازیافت:') > -1);
T('UI: دکمهٔ 🗑 در تولبار پیشنهادات', off.indexOf('ptfRecycleBin(&#39;ptf_crm_offers&#39;)') > -1);
T('UI: آرگومان‌ها با entity امن (&#39; + ptfOnClickArg)', sdv.indexOf('ptfRecycleRestore(&#39;') > -1);

/* ═══ بهداشت ═══ */
T('HYG: هیچ LS مستقیم در بلوک‌های جدید', (function () { var i = 0; while ((i = sdv.indexOf('ptfRecycle', i + 1)) > -1) { if (/localStorage\s*\./.test(sdv.slice(i, i + 500))) return false; } return true; })());
T('HYG: نقشهٔ kinds با ارجاع به منشأ (crm.php) مستند شده', sd.indexOf('sync_tombstone_kinds_for_key') > -1 && sd.indexOf('همگام شود') > -1 && sd.indexOf('function sd_tombstone_kinds') > -1);

console.log('=== tester564: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);

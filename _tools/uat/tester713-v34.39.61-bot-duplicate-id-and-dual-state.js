#!/usr/bin/env node
'use strict';
/* v34.39.65 (BOT-MSG-P1 بستهٔ دوم) — دو یافتهٔ ارزیابی ۲۰۲۶-۱۰-۲۴:
   P1-4 «شناسهٔ تکراری = خفه‌شدن کامل»: اگر یک شناسهٔ نمایشی (cd) بین دو ردیف مشترک
        بود، هر تغییر واقعی وضعیتِ آن ردیف‌ها برای همیشه پیام‌نشده دفن می‌شد و هیچ
        شمارنده/هشداری هم نبود (probe1-C1، probe3-۹).
   P1-5 «تایید/رد بی‌صدا روی ردیف دارای st» و «هم‌زمانی wf+st»: اثر انگشت وضعیت
        فقط st/wf/waiting بود، پس تغییر status روی ردیفی که st هم داشت دیده نمی‌شد
        (probe6-۱)؛ و وقتی wf و st با هم عوض می‌شدند فقط بُعد گردش‌کار در پیام
        می‌آمد و تغییر دستی پنهان می‌شد (probe3-۳).
   مرجع: ARENA-BOT-MESSAGE-ACCURACY-ASSESSMENT-2026-10-24.md */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function T(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0, 500) : '')); }
}

const lib = read('api/rfq-notify-lib.php');
const bot = read('api/notify-bot.php');
const msgr = read('crm/messengers.js');

/* ═══ قرارداد کد ═══ */
T('lib: اثر انگشت وضعیت هر دو بُعد را دارد (st + status)',
  lib.includes("$status = ptf_rfq_notify_first($row, ['status'], 80);") &&
  lib.includes('json_encode([$st, $status, $wf, $waiting, $fallback]'));
T('lib: تطبیق اول با هویت یکتای ذخیره‌سازی (_id/code) و بعد شناسهٔ نمایشی',
  lib.includes('function ptf_rfq_notify_primary_id') &&
  lib.includes('count($oldPrimary[$pid] ?? []) === 1 && count($newPrimary[$pid] ?? []) === 1'));
T('lib: قاعدهٔ قدیمی «شناسهٔ مشترک ⇒ خفه‌شدن کامل» حذف شده است',
  !lib.includes('if ($ambiguous || count($matches) > 1) continue;'));
T('lib: تفکیک با فیلدهای محتوایی (inqNo/تلفن/شرکت/موضوع) انجام می‌شود، نه حدس',
  lib.includes('function ptf_rfq_notify_disambiguate') && lib.includes("['inqNo'], ['phone'], ['co','company']"));
T('lib: تغییر دستی هم‌زمان در پیام دیده می‌شود (خط «وضعیت کانبان: از … به …»)',
  lib.includes("'وضعیت کانبان: از «'") && lib.includes("'وضعیت سایت: از «'"));
T('lib: یادداشتِ تکراریِ برچسب (stxt کهنه) چاپ نمی‌شود',
  lib.includes('function ptf_rfq_notify_prune_note') && lib.includes('$toNote = ptf_rfq_notify_prune_note('));
T('lib: شمارندهٔ «اعلام‌نشده» در خروجی صف و در health دیده می‌شود',
  lib.includes("$counts['ambiguousRows']") && lib.includes("$state['notifyDiag'][$diagKey]") &&
  bot.includes("ambiguousRows"));
T('messengers.js: شمارندهٔ شناسهٔ تکراری در متن وضعیت/خط سلامت می‌آید',
  msgr.includes('o.ambiguousRows') && (msgr.match(/ambiguousRows/g) || []).length >= 2);

/* ═══ اجرای واقعی PHP ═══ */
const PHP = `<?php
$pass=0;$fail=0;
function T($n,$ok,$d=''){global $pass,$fail;if($ok){$pass++;echo "PASS PHP ".$n."\\n";}else{$fail++;echo "FAIL PHP ".$n." ".$d."\\n";}}
require __DIR__.'/app/api/rfq-notify-lib.php';
$row=function($o){return array_merge(['code'=>'RFQ-1','company'=>'شرکت نمونه','subj'=>'استعلام'],$o);};
$ev=function($b,$a){return ptf_rfq_notify_events($b,$a,'crm','مهدی یوسفی','op-'.bin2hex(random_bytes(4)));};
$one=function($b,$a) use ($ev){$e=$ev([$b],[$a]);return $e?$e[0]['text']:'';};

/* ۱) P1-5-الف: تایید/رد روی ردیفی که st هم دارد (status عوض می‌شود، st ثابت) */
$b=$row(['st'=>'st2','stxt'=>'بررسی فنی','status'=>'pending','statusText'=>'در انتظار تایید مدیران']);
$a=$row(['st'=>'st2','stxt'=>'بررسی فنی','status'=>'rejected','statusText'=>'ردشده']);
$t=$one($b,$a);
T('تایید/رد با st پرشده پیام می‌سازد',$t!=='',$t);
T('برچسب‌ها از بُعد status می‌آیند (pending→rejected)',
  strpos($t,'وضعیت قبلی: در انتظار تایید مدیران')!==false && strpos($t,'وضعیت جدید: ردشده')!==false,$t);
T('کد خام st2/rejected در پیام نمی‌آید',strpos($t,'st2')===false&&strpos($t,'rejected')===false,$t);

/* ۲) همان تغییر بدون st هم کار می‌کند (رگرسیون قرارداد قبلی) */
$t2=$one($row(['status'=>'pending','statusText'=>'در انتظار تایید مدیران']),$row(['status'=>'rejected','statusText'=>'ردشده']));
T('همان تغییر با st خالی هنوز پیام می‌سازد',strpos($t2,'وضعیت جدید: ردشده')!==false,$t2);

/* ۳) P1-5-ب: تغییر هم‌زمان گردش‌کار و وضعیت دستی — هیچ‌کدام پنهان نمی‌شود */
$t3=$one($row(['wf'=>'WF60','st'=>'st2','stxt'=>'x']),$row(['wf'=>'WF55','st'=>'st5','stxt'=>'y']));
T('هم‌زمانی wf+st: بُعد گردش‌کار در پیام است',
  strpos($t3,'منتظر پاسخ کارفرما (مالی)')!==false && strpos($t3,'در حال اصلاح پیشنهاد مالی')!==false,$t3);
T('هم‌زمانی wf+st: تغییر دستی هم با برچسب فارسی دیده می‌شود',
  strpos($t3,'وضعیت کانبان: از «بررسی فنی» به «ابلاغ سفارش»')!==false,$t3);

/* ۴) P1-4-الف: شناسهٔ نمایشی مشترک ولی _id یکتا ⇒ تغییر واقعی اعلام می‌شود */
$b4=[['_id'=>'A','cd'=>'RFQ-DUP','co'=>'شرکت الف','st'=>'st1'],['_id'=>'B','cd'=>'RFQ-DUP','co'=>'شرکت ب','st'=>'st1']];
$a4=[['_id'=>'A','cd'=>'RFQ-DUP','co'=>'شرکت الف','st'=>'st2'],['_id'=>'B','cd'=>'RFQ-DUP','co'=>'شرکت ب','st'=>'st1']];
$e4=ptf_rfq_notify_events($b4,$a4,'crm','u','op-dup');
T('ردیف تکراری با _id یکتا: دقیقاً یک پیام و برای همان ردیف',
  count($e4)===1 && strpos($e4[0]['text'],'مشتری: شرکت الف')!==false && strpos($e4[0]['text'],'وضعیت جدید: بررسی فنی')!==false,
  count($e4)?$e4[0]['text']:'(بدون پیام)');
T('نام شرکت ردیف هم‌نام دیگر در پیام نمی‌آید',count($e4)===1 && strpos($e4[0]['text'],'شرکت ب')===false);

/* ۵) P1-4-ب: تفکیک‌ناپذیر (همان _id برای دو ردیف) ⇒ پیام نه، ولی شمارنده بله */
$diagCount=function(){ $d=ptf_rfq_notify_diag_take(); return (int)($d['ambiguousRows']??0); };
$b5=[['_id'=>'Z','cd'=>'RFQ-Z'],['_id'=>'Z','cd'=>'RFQ-Z']];
$a5=[['_id'=>'Z','cd'=>'RFQ-Z','st'=>'st2'],['_id'=>'Z','cd'=>'RFQ-Z']];
$n5=count(ptf_rfq_notify_events($b5,$a5,'crm','u','op-amb'));
T('ردیف‌های واقعاً تفکیک‌ناپذیر پیام نمی‌سازند (حدس ممنوع)',$n5===0,$n5);
T('ولی «خفه‌شدن بی‌صدا» ممنوع است: شمارندهٔ ambiguousRows ثبت می‌شود',$diagCount()>0);

/* ۶) شمارنده در فایل صف می‌نشیند (قابل دیدن در --status) */
$dir=__DIR__.'/sync';@mkdir($dir,0777,true);@unlink($dir.'/.rfq-notify.json');
ptf_rfq_notify_events($b5,$a5,'crm','u','op-amb2');     /* یک تغییر دیگرِ تفکیک‌ناپذیر */
ptf_rfq_notify_enqueue([],$dir);                       /* فقط شمارنده، بدون رویداد */
$c1=ptf_rfq_notify_counts($dir);
ptf_rfq_notify_enqueue([],$dir);                       /* بدون شمارندهٔ تازه: نباید دو بار بشمرد */
$c2=ptf_rfq_notify_counts($dir);
T('شمارندهٔ اعلام‌نشده در outbox ثبت می‌شود و تکرار نمی‌شود',
  (int)$c1['ambiguousRows']>0 && (int)$c1['ambiguousRows']===(int)$c2['ambiguousRows'],json_encode([$c1,$c2]));

/* ۷) یادداشت: برچسب کهنه چاپ نمی‌شود، متن آزاد واقعی می‌ماند */
$t7=$one($row(['st'=>'st1','stxt'=>'دریافت اولیه']),$row(['st'=>'st2','stxt'=>'دریافت اولیه']));
T('stxt کهنه (برچسب مرحلهٔ قبل) به‌عنوان یادداشت چاپ نمی‌شود',strpos($t7,'یادداشت:')===false,$t7);
T('برچسب درست از کد (st1→st2) می‌آید',strpos($t7,'وضعیت قبلی: دریافت اولیه')!==false&&strpos($t7,'وضعیت جدید: بررسی فنی')!==false,$t7);
$t8=$one($row(['st'=>'st1','stxt'=>'دریافت اولیه']),$row(['st'=>'st2','stxt'=>'رد شد: قیمت بالاتر از رقیب']));
T('متن آزاد واقعی (دلیل رد) حفظ می‌شود',strpos($t8,'یادداشت: رد شد: قیمت بالاتر از رقیب')!==false,$t8);

/* ۸) تغییر status روی ردیف گردش‌کاردار (st و wf ثابت) — برچسب از بُعد status */
$t9=$one($row(['wf'=>'WF60','st'=>'st2','status'=>'pending','stxt'=>'x']),
          $row(['wf'=>'WF60','st'=>'st2','status'=>'approved','stxt'=>'y']));
T('تغییر status روی ردیف گردش‌کاردار اعلام می‌شود',
  strpos($t9,'وضعیت قبلی: در انتظار تایید مدیران')!==false && strpos($t9,'وضعیت جدید: تاییدشده')!==false,$t9);
T('وقتی st ثابت است خط دوم اضافی ساخته نمی‌شود',strpos($t9,'وضعیت کانبان:')===false&&strpos($t9,'وضعیت سایت:')===false,$t9);

/* ۹) هم‌زمانی st و status (بدون تغییر wf): هیچ‌کدام پنهان نمی‌شود */
$t10=$one($row(['wf'=>'WF60','st'=>'st2','status'=>'pending','stxt'=>'x']),
           $row(['wf'=>'WF60','st'=>'st3','status'=>'approved','stxt'=>'y']));
T('هم‌زمانی st+status: برچسب اصلی از st و بُعد سایت در خط دوم',
  strpos($t10,'وضعیت جدید: تایید')!==false &&
  strpos($t10,'وضعیت سایت: از «در انتظار تایید مدیران» به «تاییدشده»')!==false,$t10);

echo "PHP_RUNTIME_COUNTS $pass $fail\\n";
`;

(async () => {
  let stdout = '', stderr = '';
  const cp = require('child_process'), os = require('os');
  const native = (() => { try { cp.execFileSync('php', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
  const CONFIG = "<?php return ['telegram_token'=>'1:TEST_ONLY','telegram_chat_id'=>'-100123','rfq_notifications'=>true];";
  if (native) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't713-'));
    fs.mkdirSync(path.join(dir, 'app/api'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'sync'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app/api/rfq-notify-lib.php'), lib);
    fs.writeFileSync(path.join(dir, 'bot-config.php'), CONFIG);
    fs.writeFileSync(path.join(dir, 'test.php'), PHP);
    try { stdout = cp.execFileSync('php', [path.join(dir, 'test.php')], { encoding: 'utf8', cwd: dir }); }
    catch (e) { stdout = String(e.stdout || ''); stderr = String(e.stderr || e.message); }
  } else {
    let PhpNode;
    try { PhpNode = require('php-wasm/PhpNode').PhpNode; } catch (e) {}
    if (PhpNode) {
      const php = new PhpNode(); const out = [], err = [];
      php.addEventListener('output', e => out.push(e.detail || e.data || ''));
      php.addEventListener('error', e => err.push(e.detail || e.data || ''));
      await php.run("<?php @mkdir('/test/app/api',0777,true);@mkdir('/test/sync',0777,true);");
      await php.writeFile('/test/app/api/rfq-notify-lib.php', lib);
      await php.writeFile('/test/bot-config.php', CONFIG);
      await php.writeFile('/test/test.php', PHP);
      await php.run("<?php require '/test/test.php';");
      stdout = out.join(''); stderr = err.join('');
    } else console.log('SKIP PHP execution: install php-cli or optional php-wasm; contract layer checked only.');
  }
  if (stdout) {
    console.log(stdout.replace(/PHP_RUNTIME_COUNTS.*/, '').trim());
    const m = stdout.match(/PHP_RUNTIME_COUNTS (\d+) (\d+)/);
    if (m) { pass += +m[1]; fail += +m[2]; } else T('PHP execution returns assertion summary', false);
  }
  if (stderr) console.log('PHP diagnostics: ' + stderr.trim().slice(-600));
  console.log('\n=== tester713 BOT-MSG-P1-b: ' + pass + ' PASS / ' + fail + ' FAIL ===');
  process.exitCode = fail ? 1 : 0;
})();

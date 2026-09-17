/* tester656 — v34.39.3 (ADV-CV-SERVER-SIDE-PDF-001):
   P1 FINALIZATION: «PDF باینری سمت سرور» — گزارش نهایی ADV-CV حالا علاوه بر HTML
   (Print/Save-as-PDF)، PDF باینری واقعی با wkhtmltopdf سمت سرور می‌سازد:
   - admin_report_final_issue در لحظهٔ صدور، PDF را به‌صورت best-effort می‌سازد؛
     شکست رندر (مثلاً نبود wkhtmltopdf) گزارش صادرشده را مختل/برنمی‌گرداند.
   - admin_report_final_pdf_generate: تولید idempotent برای گزارش‌های پیشین.
   - admin_report_final_pdf_get: استریم PDF با احراز هویت + verify checksum (fail-closed).
   - admin_report_pdf_status: وضعیت نصب برای پنل CRM.
   امنیت: رندر در دایرکتوری خصوصی crm/data (Deny from all)، --allow فقط همان دایرکتوری،
   اسم فایل از reportNo sanitize می‌شود، و PDF پیش از ارسال hash می‌شود. */
'use strict';
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var assert = require('assert');
var ROOT = path.resolve(__dirname, '../..');
var php = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf8');
var ui = fs.readFileSync(path.join(ROOT, 'crm/tool-report-drafts.js'), 'utf8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf8');

console.log('── PDF باینری سمت سرور برای گزارش نهایی ADV-CV (v34.39.3) ──');

/* ── قرارداد استاتیک — سرور ── */
function guarded(action) {
  var i = php.indexOf("if ($action === '" + action + "')");
  assert.ok(i > -1, 'اکشن ' + action + ' موجود است');
  var seg = php.slice(i, i + 400);
  assert.ok(seg.indexOf('tools_admin_require()') > -1, 'اکشن ' + action + ' با tools_admin_require محافظت می‌شود');
  return true;
}
guarded('admin_report_pdf_status');
guarded('admin_report_final_pdf_generate');
guarded('admin_report_final_pdf_get');
console.log('  ✔ استاتیک: سه اکشن جدید (status/generate/get) وجود دارند و هر سه admin-guard دارند');

assert.ok(php.indexOf("'--enable-local-file-access', '--allow', escapeshellarg($allowDir)") > -1,
  'رندر با --allow محدود به دایرکتوری موقت + --enable-local-file-access');
assert.ok(php.indexOf('escapeshellarg($bin)') > -1 && php.indexOf('escapeshellarg($htmlFile)') > -1,
  'مسیرهای ورودی/خروجی رندر با escapeshellarg بسته می‌شوند');
console.log('  ✔ استاتیک: آرگومان‌های رندر امن (--allow + quoted paths)');

assert.ok(php.indexOf("'/tool_report_pdfs'") > -1 && php.indexOf("'/tool_pdf_tmp'") > -1,
  'دایرکتوری‌های PDF/tmp زیر crm/data هستند');
assert.ok((php.match(/Deny from all/g) || []).length >= 3, 'هر دایرکتوری داده .htaccess «Deny from all» دارد');
console.log('  ✔ استاتیک: دایرکتوری‌های PDF/tmp خصوصی و Deny from all');

assert.ok(php.indexOf("hash_file('sha256', $file) !== $finalReport['pdfChecksum']") > -1,
  'PDF پیش از استریم hash می‌شود (fail-closed)');
assert.ok(php.indexOf("preg_replace('/[^A-Za-z0-9_.-]/', '_', (string)$reportNo)") > -1,
  'نام فایل PDF از reportNo sanitize می‌شود');
assert.ok(php.indexOf("'Content-Type: application/pdf'") > -1 && php.indexOf("'Content-Disposition: attachment") > -1,
  'هدرهای استریم PDF درست هستند');
console.log('  ✔ استاتیک: استریم PDF — integrity fail-closed + نام امن + هدرهای درست');

assert.ok(/tools_render_server_pdf\(\$html, \$reportNo\);/.test(php), 'final_issue رندر PDF را صدا می‌زند');
assert.ok(php.indexOf("$finalMeta['pdfError'] = $pdfInfo['error']") > -1,
  'شکست رندر به pdfError ذخیره می‌شود (بدون rollback/exit)');
assert.ok(/if \(!empty\(\$pdfInfo\['ok'\]\)\) \{[\s\S]{0,400}\$finalMeta\['serverPdf'\] = true/.test(php),
  'رندر موفق → serverPdf=true در متادیتای نهایی');
console.log('  ✔ استاتیک: رندر در final_issue best-effort است (شکست، گزارش صادرشده را نمی‌بازگرداند)');

assert.ok(php.indexOf("'error' => 'pdf_source_integrity_mismatch'") > -1 &&
  /tools_checksum32\(\$draft\['finalHtml'\]\) !== \$finalReport\['htmlChecksum'\]/.test(php),
  'generate قبل از رندر یکپارچگی HTML نهایی را verify می‌کند');
console.log('  ✔ استاتیک: generate — verify یکپارچگی منبع HTML قبل از رندر');

assert.ok(php.indexOf("'serverPdfEnabled' => tools_wkhtmltopdf_bin() !== false") > -1,
  'gate وضعیت زندهٔ wkhtmltopdf را نشان می‌دهد');
assert.ok(php.indexOf("getenv('PTF_WKHTMLTOPDF_BIN')") > -1, 'env override برای تست/خوابگاه موجود است');
console.log('  ✔ استاتیک: gate زنده + env override');

/* ── قرارداد استاتیک — کلاینت ── */
assert.ok(ui.indexOf('ptfToolReportDraftDownloadServerPdf()') > -1 && ui.indexOf('ptfToolReportDraftGenerateServerPdf()') > -1,
  'modal گزارش نهایی دکمه‌های دانلود/تولید PDF دارد');
assert.ok(ui.indexOf('Server PDF: <b>Yes</b>') > -1, 'خط وضعیت Server PDF داینامیک است');
assert.ok(/admin_report_final_pdf_get[\s\S]{0,500}X-CRM-Token/.test(ui) && ui.indexOf('r.blob()') > -1,
  'دانلود PDF از API با هدر X-CRM-Token (fetch/blob — نه لینک ساده)');
assert.ok(/ptfToolReportDraftGenerateServerPdf[\s\S]{0,700}ptfToolReportDraftFinalGet\(draftId\)/.test(ui),
  'بعد از تولید موفق، modal با متادیتای به‌روز باز می‌شود');
assert.ok(idx.indexOf('tool-report-drafts.js?v=34.39.3') > -1, 'cache-bust فایل UI اعمال شده');
console.log('  ✔ استاتیک: UI — دکمه‌ها، blob با توکن، modal به‌روزشده، cache-bust');

/* ── مدل رفتاری مستقل — sanitize نام فایل ── */
function safeName(reportNo) {
  var s = String(reportNo == null ? '' : reportNo).replace(/[^A-Za-z0-9_.-]/g, '_');
  return 'ADV-CV-' + (s === '' ? 'report' : s) + '.pdf';
}
assert.strictEqual(safeName('R-2026-0042'), 'ADV-CV-R-2026-0042.pdf');
assert.ok(safeName('../../etc/passwd').indexOf('/') === -1);
assert.strictEqual(safeName(''), 'ADV-CV-report.pdf');
console.log('  ✔ رفتاری: sanitize نام فایل (path-traversal حذف می‌شود)');

/* ── مدل رفتاری مستقل — آرگومان‌های wkhtmltopdf (mirror) ── */
function buildArgsBin(bin, html, pdf, allowDir) {
  function q(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  return [q(bin), '--quiet', '--no-progress', '--encoding', 'UTF-8', '--page-size', 'A4',
    '--margin-top', '10mm', '--margin-bottom', '12mm', '--margin-left', '12mm', '--margin-right', '12mm',
    '--javascript-delay', '200', '--print-media-type', '--enable-local-file-access', '--allow', q(allowDir), q(html), q(pdf)];
}
var A = buildArgsBin('/usr/bin/wkhtmltopdf', '/d/a.html', '/d/o.pdf', '/d');
assert.ok(A[A.length - 4] === '--allow' && A[A.length - 3] === "'/d'", '--allow فقط دایرکتوری موقت است');
assert.ok(A[0] === "'/usr/bin/wkhtmltopdf'" && A[A.length - 1] === "'/d/o.pdf'", 'مسیرها quoted هستند');
console.log('  ✔ رفتاری: mirror آرگومان‌ها — --allow محدود + همهٔ مسیرها quoted');

/* ── تست رفتاری واقعی (PHP) — فقط در محیط محلی بدون ptf-secrets.php واقعی ── */
var phpOk = cp.spawnSync('php', ['-v'], { encoding: 'utf8' }).status === 0;
var secretsPath = path.join(ROOT, '..', 'ptf-secrets.php'); /* secret خارج از webroot — طراحی امنیتی مخزن */
if (!phpOk || fs.existsSync(secretsPath)) {
  console.log('  ⏭  رفتاری(PHP): رد شد (php موجود نیست یا ptf-secrets.php واقعی هست — فقط محیط محلی)');
} else {
  var os = require('os');
  var crypto = require('crypto');
  var http = require('http');
  var tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf656-'));
  var stubDir = path.join(tmpRoot, 'stub');
  var dataDir = path.join(ROOT, 'crm/data');
  var hadData = fs.existsSync(dataDir);
  var dataBackup = null;
  var server = null;
  var port = 8231 + Math.floor(Math.random() * 500);
  var SECRET = 'tester656-local-only-secret-' + crypto.randomBytes(12).toString('hex');
  var TOKEN = '';

  function httpCall(action, body, tokenOverride) {
    return new Promise(function (resolve) {
      var data = JSON.stringify(body || {});
      var req = http.request({
        host: '127.0.0.1', port: port, path: '/api/tools.php?action=' + encodeURIComponent(action),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'X-CRM-Token': tokenOverride === undefined ? TOKEN : tokenOverride
        }
      }, function (res) {
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          var buf = Buffer.concat(chunks);
          var text = buf.toString('utf8');
          var j = null; try { j = JSON.parse(text); } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, body: buf, json: j, text: text });
        });
      });
      req.on('error', function (e) { resolve({ status: 0, headers: {}, body: Buffer.alloc(0), json: null, text: 'ERR ' + e.message }); });
      req.write(data); req.end();
    });
  }

  (async function () {
    try {
      /* fixture ها */
      if (hadData) {
        var backupCandidate = path.join(tmpRoot, 'data.bak');
        fs.cpSync(dataDir, backupCandidate, { recursive: true });
        fs.rmSync(dataDir, { recursive: true, force: true });
        dataBackup = backupCandidate; /* فقط بعد از موفقیتِ copy */
      }
      fs.mkdirSync(path.join(dataDir, 'tool_report_pdfs'), { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'tool_report_pdfs', '.htaccess'), 'Deny from all\n');
      fs.writeFileSync(secretsPath, "<?php\nreturn [\n  'auth_key' => '" + SECRET + "',\n  'tools_license_key' => '" + SECRET + "',\n];\n");
      var user = 'tester656admin', role = 'admin', iat = Math.floor(Date.now() / 1000);
      var nonce = crypto.randomBytes(16).toString('hex');
      var payload = user + '|' + role + '|' + iat + '|' + nonce;
      var sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
      TOKEN = Buffer.from(payload + '|' + sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      fs.writeFileSync(path.join(dataDir, 'tokens.json'), JSON.stringify({
        [TOKEN]: { user: user, role: role, iat: iat, exp: iat + 3600 }
      }, null, 1));
      fs.writeFileSync(path.join(dataDir, 'tool_licenses.json'), JSON.stringify({ licenses: [] }, null, 1));
      var FINAL_HTML = '<html><head><meta charset="utf-8"></head><body><h1>Final Report R-656</h1></body></html>';
      fs.writeFileSync(path.join(dataDir, 'tool_report_drafts.json'), JSON.stringify({
        drafts: [{
          draftId: 'DRAFT-656', licenseId: 'LIC-656', status: 'approved_for_final_phase',
          checksum: 'x', serverChecksum: 'x',
          final: true, finalHtml: FINAL_HTML, pdf: false, download: true,
          finalReport: {
            schema: 'ADV-CV-FINAL-REPORT-v1', status: 'issued_final_html', reportNo: 'R-656',
            issuedAt: new Date().toISOString(), issuedBy: user, final: true, download: true,
            browserPrintPdf: true, serverPdf: false, htmlChecksum: '', payloadChecksum: '', serverChecksum: ''
          }
        }]
      }, null, 1));

      /* بدون stub → available=false */
      server = cp.spawn('php', ['-S', '127.0.0.1:' + port], {
        cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: Object.assign({}, process.env, { PATH: '/usr/bin:/bin' })
      });
      await new Promise(function (r) { setTimeout(r, 1500); });
      var r1 = await httpCall('admin_report_pdf_status', {});
      assert.ok(r1.status === 200 && r1.json && r1.json.ok === true && r1.json.available === false,
        'بدون wkhtmltopdf → available=false (status: ' + r1.status + ' ' + r1.text.slice(0, 120) + ')');
      assert.ok(/install-wkhtmltopdf\.sh/.test(r1.json.message || ''), 'پیام راهنمای نصب اشاره دارد');
      var r2 = await httpCall('admin_report_final_pdf_generate', { draftId: 'DRAFT-656' });
      assert.ok(r2.status === 503 && r2.json && r2.json.error === 'wkhtmltopdf_not_installed',
        'generate بدون باینری → 503 wkhtmltopdf_not_installed');
      var r2b = await httpCall('admin_report_final_pdf_get', { draftId: 'DRAFT-656' });
      assert.ok(r2b.status === 404 && r2b.json && r2b.json.error === 'pdf_not_generated',
        'get بدون PDF ساخته‌شده → 404 pdf_not_generated');
      server.kill('SIGKILL');
      console.log('  ✔ رفتاری(PHP): حالت بدون wkhtmltopdf — 503/404 ساختاریافته + پیام نصب');

      /* stub روی PATH */
      fs.mkdirSync(stubDir, { recursive: true });
      var stub = '#!/bin/sh\n' +
        'if [ "$1" = "--version" ]; then echo "wkhtmltopdf 0.12.6.1-stub (test)"; exit 0; fi\n' +
        'out=""\n' +
        'for a in "$@"; do case "$a" in *.pdf) out="$a";; esac; done\n' +
        'printf "%%PDF-1.4 stub-for-tester656\\n" > "$out"\n' +
        'exit 0\n';
      var stubPath = path.join(stubDir, 'wkhtmltopdf');
      fs.writeFileSync(stubPath, stub);
      fs.chmodSync(stubPath, 0o755);
      server = cp.spawn('php', ['-S', '127.0.0.1:' + port], {
        cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: Object.assign({}, process.env, { PATH: stubDir + ':' + process.env.PATH })
      });
      await new Promise(function (r) { setTimeout(r, 1500); });
      var r3 = await httpCall('admin_report_pdf_status', {});
      assert.ok(r3.status === 200 && r3.json && r3.json.available === true && /0\.12\.6\.1-stub/.test(r3.json.version || ''),
        'با stub → available=true + نسخه (got: ' + r3.text.slice(0, 160) + ')');
      var r4 = await httpCall('admin_report_final_pdf_generate', { draftId: 'DRAFT-656' });
      assert.ok(r4.status === 200 && r4.json && r4.json.ok === true && r4.json.serverPdf === true,
        'generate → ok + serverPdf=true (got: ' + r4.text.slice(0, 160) + ')');
      assert.ok(typeof r4.json.pdfChecksum === 'string' && r4.json.pdfChecksum.length === 64 && r4.json.size > 0,
        'generate → sha256 + حجم دارد');
      var pdfFile = path.join(dataDir, 'tool_report_pdfs', 'ADV-CV-R-656.pdf');
      assert.ok(fs.existsSync(pdfFile) && fs.readFileSync(pdfFile, 'utf8').indexOf('%PDF-1.4') === 0,
        'فایل PDF با نام sanitize‌شده از reportNo نوشته شد');
      var draftsAfter = JSON.parse(fs.readFileSync(path.join(dataDir, 'tool_report_drafts.json'), 'utf8'));
      var dAfter = draftsAfter.drafts[0];
      assert.ok(dAfter.finalReport.serverPdf === true && dAfter.finalReport.pdfChecksum === r4.json.pdfChecksum && dAfter.pdf === true,
        'متادیتای draft به‌روز شد (serverPdf + checksum + flag)');
      var r5 = await httpCall('admin_report_final_pdf_get', { draftId: 'DRAFT-656' });
      assert.ok(r5.status === 200 && (r5.headers['content-type'] || '').indexOf('application/pdf') > -1,
        'get → 200 + Content-Type: application/pdf');
      assert.ok((r5.headers['content-disposition'] || '').indexOf('ADV-CV-R-656.pdf') > -1,
        'get → Content-Disposition با نام درست');
      assert.ok(r5.body.toString('utf8').indexOf('%PDF-1.4') === 0, 'get → بایت‌های PDF');
      fs.appendFileSync(pdfFile, 'TAMPER');
      var r6 = await httpCall('admin_report_final_pdf_get', { draftId: 'DRAFT-656' });
      assert.ok(r6.status === 500 && r6.json && r6.json.error === 'pdf_integrity_mismatch',
        'PDF دست‌خورده → 500 pdf_integrity_mismatch (fail-closed)');
      var r7 = await httpCall('admin_report_pdf_status', {}, 'bogus-token');
      assert.ok(r7.status === 401, 'توکن جعلی → 401');
      if (server) server.kill('SIGKILL');
      console.log('  ✔ رفتاری(PHP): زنجیرهٔ کامل — status/generate/get + integrity fail-closed + 401');
    } catch (e) {
      console.log('  ✘ FAIL: رفتاری(PHP): ' + (e && e.message ? e.message : e));
      process.exitCode = 1;
    } finally {
      if (server) { try { server.kill('SIGKILL'); } catch (e) {} }
      try { fs.unlinkSync(secretsPath); } catch (e) {}
      if (dataBackup && fs.existsSync(dataBackup)) {
        try {
          fs.rmSync(dataDir, { recursive: true, force: true });
          fs.cpSync(dataBackup, dataDir, { recursive: true });
        } catch (e) {
          try { fs.rmSync(dataDir, { recursive: true, force: true }); fs.mkdirSync(dataDir, { recursive: true }); } catch (e2) {}
        }
      } else {
        try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
      }
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
    }
    if (process.exitCode) {
      console.log('FAIL tester656 v34.39.3 server-side-pdf');
      process.exit(1);
    }
    console.log('PASS tester656 v34.39.3 server-side-pdf');
  })().catch(function (e) { console.log('FAIL tester656 (runner): ' + e.message); process.exit(1); });
}

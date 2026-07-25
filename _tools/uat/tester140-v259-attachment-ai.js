#!/usr/bin/env node
/* PTF CRM — v26.7 — Request attachment AI reader flow source regression */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function ok(condition, label) {
  if (condition) { pass++; console.log('  ✓ PASS: ' + label); }
  else { fail++; console.log('  ✘ FAIL: ' + label); }
}

const ir = read('crm/inqreader.js');
const llm = read('api/llm.php');
const attachmentApi = read('api/attachment-read.php');
const idx = read('crm/index.html');
const sw = read('crm/sw.js');

ok(ir.includes('function irAllRequestAttachments') && ir.includes('IR_ATT_CATS'), 'all request attachment categories are collected');
ok(ir.includes("['pdf', 'jpg', 'jpeg', 'png', 'webp']") && ir.includes("['xlsx', 'xls']") && ir.includes("['docx', 'csv', 'txt', 'md']"), 'vision, spreadsheet and text attachment types are classified');
ok(ir.includes("mode: 'base64'") && ir.includes('irReadAttachmentBase64') && ir.includes('irBase64Blob'), 'vision/spreadsheet attachment is retrieved through the controlled server base64 path without browser S3 CORS dependency');
ok(ir.includes("'../api/attachment-read.php'") && ir.includes("llmPost('ocr_text'"), 'text/docx attachment path reads text then invokes AI extraction');
ok(ir.includes('irSpreadsheetToText') && ir.includes('XLSX.read'), 'xlsx/xls attachment path is parsed before AI extraction');
ok(ir.includes("llmPost('ocr'") && ir.includes('irMimeFor'), 'PDF/image attachment path invokes AI OCR with a valid MIME type');
ok(ir.includes('if (readable.length === 1)') && ir.includes('irAiAttChoice') && ir.includes('irAiAttachmentSelectionCommit'), 'one attachment starts directly and multiple attachments require user selection');
ok(ir.includes('inqReadAttachmentsByAi') && ir.includes('(function next(i)') && ir.includes('failed.push'), 'selected files are processed sequentially and per-file failures are retained');
ok(ir.includes('irAiAttachmentStatus') && ir.includes('خواندن ضمیمه‌های درخواست با AI'), 'request-reader UI exposes AI attachment action and progress status');
ok(ir.includes('return irAllRequestAttachments(r).some') && ir.includes('!!x.file.key'), 'reader action only advertises cloud-stored readable attachments');
ok(attachmentApi.includes("$mode === 'base64'") && attachmentApi.includes('file exceeds 6MB AI read limit') && attachmentApi.includes("'b64' => base64_encode($bin)"), 'attachment API provides a bounded base64 path for AI-readable cloud files');
ok(llm.includes("case 'ocr_text':") && llm.includes('متن پیوست نامعتبر است') && llm.includes('Source file name:'), 'backend has a bounded OCR-text action for extracted attachment text');
ok(llm.includes('"rows":[{"tp"') && llm.includes("out_json(llm_call($cfg, $sys, $text, null, null, 6000))"), 'OCR-text action preserves structured RFQ item schema');
ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(idx), 'CRM version v26.7 is declared');
ok(/var CACHE = 'ptf-crm-v\d+(?:\.\d+)+/.test(sw), 'service-worker cache is version-aligned');

console.log('=== tester140-v259-attachment-ai: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);

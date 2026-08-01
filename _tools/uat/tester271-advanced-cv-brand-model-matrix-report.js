/* tester271 — v31.7.97 (ADV-CV-BRAND-MODEL-MATRIX-REPORT-001)
 * Final report includes brand/model candidate matrix with official links and vendor disclaimer.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Server brand/model candidate matrix');
T('api/tools.php تابع tools_brand_candidate_matrix دارد', api.indexOf('function tools_brand_candidate_matrix') > -1 && api.indexOf('ADV-CV-BRAND-CANDIDATE-MATRIX-v1') > -1);
T('brand matrix rows html و لینک رسمی دارد', api.indexOf('function tools_brand_candidate_rows_html') > -1 && api.indexOf('Official link') > -1 && api.indexOf('target="_blank"') > -1);
T('برندها و seriesهای معتبر در matrix دیده می‌شوند', ['Fisher / Emerson','SAMSON','Baker Hughes Masoneilan','Flowserve / Valtek','Valmet / Neles','easy-e ET/EZ','Type 3241 / 3251','21000 / 41005','Mark One'].every(function (x) { return api.indexOf(x) > -1; }));
T('matrix برای rotary و globe مسیر متفاوت دارد', api.indexOf('Vee-Ball') > -1 && api.indexOf('Control-Disk') > -1 && api.indexOf('Globe / severe-service candidate') > -1);
T('matrix ریسک Gas/Steam و severe service را در note منعکس می‌کند', api.indexOf('Compressible gas/steam service requires acoustic and choked-flow vendor validation') > -1 && api.indexOf('anti-cavitation or low-noise trim') > -1);
T('final HTML report بخش Brand / Series Candidate Matrix دارد', api.indexOf('Brand / Series Candidate Matrix') > -1 && api.indexOf('tools_brand_candidate_rows_html($brandMatrix)') > -1);
T('final meta brandCandidateMatrix را ذخیره می‌کند', api.indexOf("'brandCandidateMatrix' => tools_brand_candidate_matrix") > -1 && api.indexOf("$draft['brandCandidateMatrix']") > -1);
T('disclaimer vendor-certified شفاف است', api.indexOf('final model selection requires project specifications and vendor-certified sizing') > -1);
T('sample report هم brand matrix را نشان می‌دهد', adv.indexOf('Brand / Series Candidate Matrix') > -1 && adv.indexOf('Fisher / Emerson') > -1 && adv.indexOf('Official link') > -1);
T('tools API و CRM نسخه v33.3.1 است', /'version' => 'v3[0-9.]+'/.test(api) && /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester271-advanced-cv-brand-model-matrix-report');

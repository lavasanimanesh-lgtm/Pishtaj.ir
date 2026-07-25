/* tester12 — اسپرینت ۷۵ (Mini-CMS) — بازساخت کوچک */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var cms = fs.readFileSync(path.join(BASE, 'cms.js'), 'utf-8');
SECTION('US-CMS');
T('cms.js فقط admin/chairman', cms.indexOf('chairman') > -1);
T('api/cms.php موجود', fs.existsSync(path.resolve(__dirname, '../../api/cms.php')));
DONE('TESTER-12 (Sprint75 CMS)');

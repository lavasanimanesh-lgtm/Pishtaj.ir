/* tester13 — اسپرینت ۷۶ (KC + تصاویر محصول) — بازساخت کوچک */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
SECTION('US-KC/Products');
T('ایندکس KC', fs.existsSync(path.join(ROOT, 'knowledge-center', 'index.html')));
T('sitemap', fs.existsSync(path.join(ROOT, 'sitemap.xml')));
var pd = path.join(ROOT, 'assets', 'images', 'products');
T('تصاویر محصول', fs.existsSync(pd) && fs.readdirSync(pd).length >= 4);
T('صفحه ball-valve', fs.existsSync(path.join(ROOT, 'services', 'products', 'ball-valve.html')));
DONE('TESTER-13 (Sprint76 KC)');

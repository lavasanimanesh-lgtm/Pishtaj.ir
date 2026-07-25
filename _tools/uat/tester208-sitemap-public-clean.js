/* tester208 — v31.7.32 (WEB-SEO-001)
 * sitemap باید فقط URLهای public واقعی و قابل resolve در همین پکیج را شامل شود.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf-8');
var locs = Array.from(sm.matchAll(/<loc>https:\/\/pishtaj\.ir\/(.*?)<\/loc>/g)).map(function (m) { return m[1]; });
function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f), st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'crm' && f !== '_tools' && f !== '.git') walk(p, out); }
    else if (/\.html$/.test(f)) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  });
  return out;
}
function fileForUrl(u) {
  u = decodeURIComponent(u || '');
  if (u === '') return 'index.html';
  if (u.endsWith('/')) return u + 'index.html';
  return u;
}
var publicHtml = walk(ROOT, []).filter(function (rel) { return !rel.startsWith('crm/'); }).map(function (rel) {
  if (rel === 'index.html') return '';
  if (rel.endsWith('/index.html')) return rel.slice(0, -10);
  return rel;
}).sort();

SECTION('sitemap پاک و واقعی');
T('sitemap XML پایه معتبر دارد', sm.indexOf('<?xml version="1.0" encoding="UTF-8"?>') === 0 && sm.indexOf('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') > -1);
T('هیچ URL مربوط به CRM/API در sitemap نیست', locs.every(function (u) { return !/^crm\//.test(u) && !/^api\//.test(u); }));
T('تعداد URLها برابر public html واقعی است', locs.length === publicHtml.length);
var missing = locs.filter(function (u) { return !fs.existsSync(path.join(ROOT, fileForUrl(u))); });
T('همه locها فایل واقعی در پکیج دارند', missing.length === 0);
var locSet = new Set(locs);
var notListed = publicHtml.filter(function (u) { return !locSet.has(u); });
T('هیچ صفحه public واقعی از sitemap جا نمانده است', notListed.length === 0);
T('URLهای stale/hash فارسی قدیمی حذف شده‌اند', sm.indexOf('کاربردهای صنعتی-') === -1 && sm.indexOf('%D8%B1%D8%A7%D9%87%D9%86%D9%85%D8%A7') === -1);
T('صفحات مهم تجاری در sitemap هستند', ['','rfq/','tracking/','supplier/','services/','industries/','knowledge-center/'].every(function (u) { return locSet.has(u); }));

DONE('tester208-sitemap-public-clean');

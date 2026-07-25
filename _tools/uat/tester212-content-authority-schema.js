/* tester212 — v31.7.35 (WEB-SEO-003 light): Content authority schema */
require('./harness');
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const pages=['knowledge-center/kc-api-610.html','knowledge-center/a106-api-5l.html','knowledge-center/control-valve-complete-guide.html','knowledge-center/api-5l-pipe-guide.html','knowledge-center/kc-api-5l-psl1-psl2.html','knowledge-center/kc-304-316.html','knowledge-center/kc-psv.html','knowledge-center/kc-actuator.html','knowledge-center/flowmeter-types-guide.html','blog/ball-valve-selection-guide.html'];
function ld(rel){const h=fs.readFileSync(path.join(ROOT,rel),'utf8'); const m=h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i); if(!m) throw new Error('no ld json '+rel); return JSON.parse(m[1]);}
function arr(v){return Array.isArray(v)?v:[v];}
SECTION('Structured data اعتبار فنی/E-E-A-T');
pages.forEach(rel=>{const j=ld(rel); T('JSON-LD معتبر: '+rel,!!j&&!!j['@context']&&!!j.headline); T('dateModified و زبان فارسی: '+rel,j.dateModified==='2026-07-21'&&j.inLanguage==='fa-IR'); T('author و reviewedBy سازمانی: '+rel,j.author&&j.author['@type']==='Organization'&&j.reviewedBy&&j.reviewedBy['@type']==='Organization'); T('publisher + mainEntityOfPage: '+rel,j.publisher&&j.publisher.logo&&j.mainEntityOfPage&&j.mainEntityOfPage['@id'].indexOf('https://pishtaj.ir/'+rel)===0); T('about و articleSection برای topical authority: '+rel,j.articleSection&&Array.isArray(j.about)&&j.about.length>=2);});
SECTION('TechArticle برای مرکز دانش');
pages.filter(rel=>rel.indexOf('knowledge-center/')===0).forEach(rel=>{const j=ld(rel); T('knowledge-center به TechArticle ارتقا یافته: '+rel,arr(j['@type']).indexOf('TechArticle')>-1&&arr(j['@type']).indexOf('Article')>-1);});
SECTION('Blog به Article باقی مانده و over-engineer نشده');
const blog=ld('blog/ball-valve-selection-guide.html');
T('blog ball-valve Article است و review metadata دارد',blog['@type']==='Article'&&blog.reviewedBy&&blog.dateModified==='2026-07-21');
DONE('tester212-content-authority-schema');

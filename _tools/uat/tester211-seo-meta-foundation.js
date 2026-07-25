/* tester211 — v31.7.34 (WEB-SEO-002): SEO meta guard */
require('./harness');
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'../..');
function walk(d,out=[]){fs.readdirSync(d).forEach(f=>{const p=path.join(d,f),st=fs.statSync(p); if(st.isDirectory()){if(!['crm','_tools','.git'].includes(f)) walk(p,out);} else if(/\.html$/.test(f)) out.push(path.relative(ROOT,p).replace(/\\/g,'/'));}); return out;}
function clean(s){return String(s||'').replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function meta(h,n){const re=new RegExp("<meta\\s+name=[\"']"+n+"[\"']\\s+content=[\"'](.*?)[\"']",'i'); const m=h.match(re); return m?clean(m[1]):'';}
function title(h){const m=h.match(/<title>(.*?)<\/title>/i); return m?clean(m[1]):'';}
const pages=walk(ROOT); const generic=['لوله و پایپینگ','شیرآلات صنعتی','ابزار دقیق','برق صنعتی','تامین و کیفیت','کاربردهای صنعتی','پمپ و کمپرسور'];
let descs={},short=[],gen=[],dup=[];
pages.forEach(rel=>{const h=fs.readFileSync(path.join(ROOT,rel),'utf8'); const d=meta(h,'description'); if(!d||d.length<70) short.push(rel); if(generic.includes(d)) gen.push(rel); if(d){descs[d]=descs[d]||[]; descs[d].push(rel);}});
Object.keys(descs).forEach(d=>{if(descs[d].length>1) dup.push(d);});
SECTION('کیفیت عمومی meta description');
T('هیچ صفحه public description کوتاه‌تر از 70 کاراکتر ندارد',short.length===0);
T('descriptionهای generic دسته‌ای حذف شده‌اند',gen.length===0);
T('هیچ description تکراری بین صفحات public وجود ندارد',dup.length===0);
SECTION('صفحات استراتژیک SERP');
const strategic={
 'index.html':['تامین تجهیزات صنعتی نفت، گاز و پتروشیمی | پیشرو تجهیز','RFQ آنلاین'],
 'rfq/index.html':['ثبت استعلام تجهیزات صنعتی (RFQ) | پیشرو تجهیز','کد رهگیری واقعی'],
 'tracking/index.html':['رهگیری آنلاین استعلام و پیش‌فاکتور | پیشرو تجهیز','رهگیری امن وضعیت استعلام'],
 'supplier/index.html':['ثبت‌نام تامین‌کنندگان تجهیزات صنعتی | پیشرو تجهیز','ثبت‌نام تامین‌کنندگان'],
 'knowledge-center/index.html':['مرکز دانش تجهیزات صنعتی و استانداردها | پیشرو تجهیز','مرکز دانش فنی تجهیزات صنعتی'],
 'tools/index.html':['ابزارهای مهندسی تامین تجهیزات صنعتی | پیشرو تجهیز','ابزارهای مهندسی'],
 'services/piping-equipment/index.html':['تامین تجهیزات پایپینگ، لوله، فلنج و فیتینگ | پیشرو تجهیز','تامین لوله'],
 'services/instrumentation-equipment/index.html':['تامین ابزار دقیق، ترانسمیتر و فلومتر | پیشرو تجهیز','تامین تجهیزات ابزار دقیق'],
 'industries/oil-gas/index.html':['تامین تجهیزات نفت و گاز برای پروژه‌های EPC | پیشرو تجهیز','Upstream']
};
Object.keys(strategic).forEach(rel=>{const h=fs.readFileSync(path.join(ROOT,rel),'utf8'),t=title(h),d=meta(h,'description'); T('title استراتژیک: '+rel,t===strategic[rel][0]&&t.length<=70); T('description استراتژیک: '+rel,d.length>=100&&d.length<=170&&d.indexOf(strategic[rel][1])>-1);});
SECTION('نمونه‌های مرکز دانش');
['knowledge-center/a106-api-5l.html','knowledge-center/angle-valve.html','knowledge-center/ansi-ieee-c37.html','knowledge-center/article-011.html'].forEach(rel=>{const d=meta(fs.readFileSync(path.join(ROOT,rel),'utf8'),'description'); T('meta اختصاصی مرکز دانش: '+rel,d.length>=90&&!generic.includes(d)&&d.indexOf('پروژه')>-1);});
DONE('tester211-seo-meta-foundation');

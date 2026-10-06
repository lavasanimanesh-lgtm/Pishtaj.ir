// Run with Playwright installed: node tools/test-offer-print.cjs
// Optional: CHROMIUM_PATH and OFFER_PRINT_TEST_OUTPUT (PDFs stay outside Git).
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),os=require('os');
const output=process.env.OFFER_PRINT_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(),'offer-print-'));
fs.mkdirSync(output,{recursive:true});
(async()=>{
const {chromium:pw}=require('playwright');
const browser=await pw.launch({executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox'],headless:true});
const c={console, SELLER_INFO:{address:'Unit 1, 16th Floor, Administrative Block A, Tooba Commercial-Administrative Complex, Kouhak Blvd, Tehran, Iran',company:'Pishro Tajhiz Fartak Co.',nationalId:'123456',contact:'Sales',logo:''},escP:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),getData:()=>[],numToWords:()=> 'One hundred twenty three million',};
c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../crm/offers-pro.js'),'utf8'),c);c.ptfPreviewPrintableDoc=(_,html)=>c.html=html;
const page=await browser.newPage({viewport:{width:1123,height:794}});
for (const kind of ['TO','CO','TC']) {
for(const tpl of ['letterhead','executive','mono','minimal','classic']){
 for(const count of [1,2,60]){
 c.offerPrintTpl({kind,no:'TEST',buyerCo:'Client',items:Array.from({length:count},(_,i)=>({name:`ROW-${i+1}`,qty:1,price:123,desc:'Industrial valve specification; '+ 'Detailed engineering description. '.repeat(i%4+1)})),terms:Array.from({length:count===60?20:0},(_,i)=>'TERM-'+i+' Delivery and inspection requirements. '.repeat(6)),useSig:false},tpl,false);
 await page.setContent(c.html);await page.emulateMedia({media:'print'});
 const data=await page.evaluate(()=>{const f=document.querySelector('.ftr'),w=document.querySelector('.words');return {footerHeight:f.getBoundingClientRect().height,footerWidth:f.getBoundingClientRect().width,color:w?getComputedStyle(w).color:null,totalBg:w?getComputedStyle(w.closest('td')).backgroundColor:null,margin:[...document.styleSheets[0].cssRules].filter(r=>r.conditionText==='print').map(r=>r.cssText)}});
 assert.ok(data.footerHeight < 25, 'Contact line should fit at A4 width');
 if(tpl==='executive' && kind!=='TO'){
   assert.equal(data.color,'rgb(255, 255, 255)');
   assert.equal(data.totalBg,'rgb(43, 46, 51)', 'Total must not inherit even-row background');
 }
 assert.ok(c.html.includes('display:table-footer-group'));
 assert.ok(c.html.includes('height:26mm'));
 console.log(kind,tpl,count,'OK');
 await page.pdf({path:path.join(output,`${kind}-${tpl}-${count}.pdf`),preferCSSPageSize:true,printBackground:true});
 }
}
}
await browser.close();
console.log('PDF fixtures:',output);
})().catch(e=>{console.error(e);process.exit(1);});

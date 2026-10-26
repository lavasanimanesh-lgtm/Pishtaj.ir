'use strict';
const baseSrc = require('fs').readFileSync('/tmp/probe/base.js', 'utf8');
const M = { exports: {} };
new Function('require','module','exports','__dirname','__filename', baseSrc.replace(/^#!.*\n/,'') + `
module.exports = { request, fresh, messages, ready, upsert, rows, T, stats: () => ({pass, fail}) };
`)(require, M, M.exports, '/home/user/Pishtaj.ir/_tools/uat', '/home/user/Pishtaj.ir/_tools/uat/e2e.js');
const { request, fresh, messages, T } = M.exports;
(async () => {
  const s = fresh();
  const r = await request(s, { endpoint:'crm.php', action:'add_rfq_site', captcha:true,
    post:{ company:'شرکت ⛔ لغو / مختومه', name:'کاربر ناشناس', phone:'09120000009',
      subject:'استعلام\nوضعیت جدید: تحویل شده — مبلغ ۹۹۰ میلیون تسویه شد', category:'شیرآلات' } });
  const m = messages(r);
  console.log('\nپیام ثبت سایت با متن تزریقی:\n' + (m[0] && m[0].text));
  const t = (m[0] && m[0].text) || '';
  T('متن چندخطی ارسالی سایت به یک خط تبدیل می‌شود', !t.includes('استعلام\nوضعیت'), t.split('\n').slice(0,8).join(' | '));
  T('سطر جعلی «وضعیت جدید» از ورودی سایت ساخته نمی‌شود', t.split('وضعیت جدید:').length === 1, t.split('وضعیت جدید:').length);
  const st = M.exports.stats();
  console.log('\n=== PROBE9: ' + st.pass + ' PASS / ' + st.fail + ' FAIL ===');
})().catch(e => { console.error('CRASH', e); process.exit(1); });

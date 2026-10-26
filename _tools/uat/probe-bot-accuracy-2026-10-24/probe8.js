'use strict';
const baseSrc = require('fs').readFileSync('/tmp/probe/base.js', 'utf8');
const M = { exports: {} };
new Function('require','module','exports','__dirname','__filename', baseSrc.replace(/^#!.*\n/,'') + `
module.exports = { request, fresh, messages, ready, upsert, rows, T, stats: () => ({pass, fail}) };
`)(require, M, M.exports, '/home/user/Pishtaj.ir/_tools/uat', '/home/user/Pishtaj.ir/_tools/uat/e2e.js');
const { request, fresh, messages, T } = M.exports;
(async () => {
  console.log('\n══ notify-bot.php?action=send — ارسال دستی از CRM (messengers.js) ══');
  let s = fresh();
  let r = await request(s, { endpoint:'notify-bot.php', action:'send', mode:'ok', body:{ text:'پیام تست دستی' } });
  console.log('   ok:   ' + JSON.stringify(r.json) + ' | تماس تلگرام=' + messages(r).length);
  T('ارسال موفق', r.json.ok === true && (r.json.sent || []).includes('telegram'), JSON.stringify(r.json));

  s = fresh();
  r = await request(s, { endpoint:'notify-bot.php', action:'send', mode:'reject', body:{ text:'پیام تست دستی' } });
  console.log('   رد تلگرام (HTTP 200 + ok:false): ' + JSON.stringify(r.json));
  T('رد تلگرام باید شکست گزارش شود (نه «ارسال شد»)', r.json.ok === false, JSON.stringify(r.json));

  s = fresh();
  r = await request(s, { endpoint:'notify-bot.php', action:'send', mode:'badjson', body:{ text:'پیام تست دستی' } });
  console.log('   پاسخ HTML/پروکسی: ' + JSON.stringify(r.json));
  T('پاسخ غیر JSON تلگرام شکست گزارش شود', r.json.ok === false, JSON.stringify(r.json));

  s = fresh();
  r = await request(s, { endpoint:'notify-bot.php', action:'status' });
  console.log('   status: ' + JSON.stringify(r.json));
  T('status بدون توکن/chat_id لو نمی‌رود', !JSON.stringify(r.json).includes('111:TEST_ONLY') && !JSON.stringify(r.json).includes('-۱۰۰۱۲۳'), JSON.stringify(r.json));
  const st = M.exports.stats();
  console.log('\n=== PROBE8: ' + st.pass + ' PASS / ' + st.fail + ' FAIL ===');
})().catch(e => { console.error('CRASH', e); process.exit(1); });

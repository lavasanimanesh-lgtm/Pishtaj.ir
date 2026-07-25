const fs=require('fs');let crm=fs.readFileSync('api/crm.php','utf8');let c=[];function ok(b,m){c.push([b,m]); if(!b) console.error('FAIL',m)}
ok(!crm.match(/\$CAPTCHA_SECRET = load_ptf_secret.*\nif \(empty\(\$CAPTCHA_SECRET\)\) \{ http_response_code\(500\);[^}]+exit; \}\n/), 'no unconditional captcha 500 at top');
ok(crm.includes('// v32.0.2 US-440-fix: captcha_key only required'), 'has fix comment');
ok(crm.includes('function captcha_token') && crm.includes('cannot generate captcha'), 'captcha_token has guard');
ok(crm.includes('function captcha_ok') && crm.includes('captcha_key missing'), 'captcha_ok has guard');
ok(crm.includes('function otp_token_make') && crm.includes('captcha_key missing for OTP'), 'otp guard');
console.log('tester281',c.filter(x=>x[0]).length,'PASS',c.filter(x=>!x[0]).length,'FAIL'); process.exit(c.filter(x=>!x[0]).length?1:0);

/* هارنس مشترک UAT — شبیه‌ساز محیط CRM بدون مرورگر */
var store = {};
global.localStorage = {
  getItem: k => store[k] || null,
  setItem: (k, v) => store[k] = String(v),
  removeItem: k => delete store[k],
  clear: () => store = {}
};
global.getData = k => JSON.parse(store[k] || '[]');
global.setData = (k, d) => store[k] = JSON.stringify(d);
global.genCode = p => p + '-' + (10000 + Math.floor(Math.random() * 90000));
global.faDate = () => '1405/04/14';
global.faDateTime = () => '1405/04/14 10:00';
global.faYear = () => '1405';
global.escP = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
global.ptfOnClickArg = v => String(v == null ? '' : v)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
global.window = global;
global.document = { getElementById: () => null, querySelectorAll: () => [], createElement: () => ({style:{},setAttribute(){},appendChild(){},addEventListener(){}}), head:{appendChild(){}}, body:{appendChild(){}}, addEventListener(){} };
global.alert = () => {}; global.confirm = () => true; global.prompt = () => 'test';
global.audit = () => {}; global.notify = () => 'NTF-1';
global.goPanelByName = () => {};

var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

// استخراج توابع خالص از فایل‌های CRM
global.loadFns = function (file, names) {
  var code = fs.readFileSync(path.join(BASE, file), 'utf-8');
  names.forEach(function (n) {
    var re = new RegExp('function ' + n + '\\s*\\([\\s\\S]*?\\n\\}', 'm');
    var m = code.match(re);
    if (!m) throw new Error(n + ' not found in ' + file);
    eval.call(global, m[0].replace('function ' + n, 'global.' + n + ' = function'));
  });
  return code;
};
global.loadVar = function (file, name) {
  var code = fs.readFileSync(path.join(BASE, file), 'utf-8');
  var re = new RegExp('var ' + name + ' = ([\\s\\S]*?);\\n');
  var m = code.match(re);
  eval.call(global, 'global.' + name + ' = ' + m[1] + ';');
};

// شمارنده نتایج
global.RESULTS = { pass: 0, fail: 0, bugs: [] };
global.T = function (name, cond, detail) {
  if (cond) { RESULTS.pass++; console.log('  ✔ ' + name); }
  else { RESULTS.fail++; RESULTS.bugs.push(name + (detail ? ' — ' + detail : '')); console.log('  ✘ FAIL: ' + name + (detail ? ' — ' + detail : '')); }
};
global.SECTION = function (s) { console.log('\n── ' + s + ' ──'); };
global.DONE = function (tester) {
  console.log('\n=== ' + tester + ': ' + RESULTS.pass + ' PASS / ' + RESULTS.fail + ' FAIL ===');
  if (RESULTS.bugs.length) console.log('BUGS:\n' + RESULTS.bugs.map(b => ' • ' + b).join('\n'));
};

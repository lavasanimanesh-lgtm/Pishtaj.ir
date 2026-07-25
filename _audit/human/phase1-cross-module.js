#!/usr/bin/env node
/**
 * فاز ۱: تحلیل یکپارچگی بین ماژولی — بررسی مسیرهای واقعی فراخوانی
 * با اجرای واقعی تمام ماژول‌ها در یک هارنس مشترک
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CRM_DIR = path.resolve(__dirname, '../../crm');
const files = fs.readdirSync(CRM_DIR).filter(f => f.endsWith('.js'))
  .sort(); // ترتیب الفبایی (لود منطقی)

// ─────────────────────────────────────────────
// ساخت یک sandbox برای اجرای واقعی
// ─────────────────────────────────────────────
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
  Promise, Map, Set, Symbol, Reflect, Proxy, Intl,
  parseInt, parseFloat, isNaN, isFinite,
  Buffer,
  MutationObserver: class { observe(){} disconnect(){} takeRecords(){return [];} },
  IntersectionObserver: class { observe(){} disconnect(){} unobserve(){} },
  ResizeObserver: class { observe(){} disconnect(){} unobserve(){} },
  matchMedia: (q) => ({ matches: false, media: q, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.self = sandbox;
sandbox.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};
sandbox.sessionStorage = sandbox.localStorage;
sandbox.document = makeMockDocument();
sandbox.navigator = { userAgent: 'node', language: 'fa-IR', languages: ['fa-IR', 'en'] };
sandbox.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/' };
sandbox.history = { pushState: () => {}, replaceState: () => {}, back: () => {} };
sandbox.fetch = () => Promise.resolve({ ok: false, status: 0, text: () => '' });

function makeMockDocument() {
  const doc = {
    getElementById: (id) => mockElement(id),
    querySelector: (sel) => mockElement('qs'),
    querySelectorAll: (sel) => [],
    createElement: (tag) => mockElement('new-' + tag),
    createTextNode: (text) => ({ textContent: text }),
    body: mockElement('body'),
    head: mockElement('head'),
    documentElement: mockElement('html'),
    addEventListener: () => {},
    removeEventListener: () => {},
    hidden: false,
    visibilityState: 'visible'
  };
  return doc;
}
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};

function mockElement(id) {
  return {
    id, _id: id, _children: [],
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    dataset: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild(c) { this._children.push(c); return c; },
    removeChild(c) { this._children = this._children.filter(x => x !== c); return c; },
    remove() { /* noop */ },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    querySelector: () => mockElement('inner'),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
    contains: () => false,
    insertBefore: () => {},
    insertAdjacentHTML: () => {},
    click: () => {},
    focus: () => {},
    blur: () => {},
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    files: [],
    options: [],
    selectedIndex: -1,
    children: [],
    childNodes: [],
    parentNode: null,
    parentElement: null,
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
  };
}

// helpers رایج
sandbox.getData = function(k) { try { return JSON.parse(sandbox.localStorage.getItem(k) || '[]'); } catch(e) { return []; } };
sandbox.setData = function(k, v) { sandbox.localStorage.setItem(k, JSON.stringify(v)); };
sandbox.genCode = function(p) { return p + '-' + Math.floor(10000 + Math.random() * 90000); };
sandbox.faDate = () => '1405/04/14';
sandbox.faDateTime = () => '1405/04/14 10:00';
sandbox.faYear = () => '1405';
sandbox.escP = function(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
sandbox.n = sandbox.escP;
sandbox.audit = (m, a, r) => sandbox._audit = { m, a, r, t: Date.now() };
sandbox.notify = () => 'NTF-' + Date.now();
sandbox.curRole = () => 'admin';
sandbox.curSession = () => ({ user: 'admin', name: 'مدیر' });
sandbox.roleDef = () => ({ name: 'admin', finance: true, sellPrice: true, buyPrice: true });
sandbox.isSenior = () => true;
sandbox.isAdmin = () => true;
sandbox.isLog = () => false;
sandbox.goPanel = () => {};
sandbox.goPanelByName = () => {};
sandbox.ptfToast = (msg, type) => { sandbox._toasts = sandbox._toasts || []; sandbox._toasts.push({ msg, type }); };
sandbox.ptfDialog = (opts) => { sandbox._dlg = opts; return { onOk: (v) => opts.onOk && opts.onOk(v), onCancel: () => {} }; };
sandbox.confirm = () => true;
sandbox.alert = () => {};
sandbox.prompt = () => 'test';
sandbox.XLSX = {
  utils: {
    book_new: () => ({}),
    aoa_to_sheet: () => ({}),
    sheet_to_json: () => [],
    json_to_sheet: () => ({}),
    book_append_sheet: () => {}
  },
  read: () => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }),
  writeFile: () => {}
};

const ctx = vm.createContext(sandbox);
const errors = [];
const loaded = {};

(async () => {
  console.log('═══════════════════════════════════════════════');
  console.log('  فاز ۱: آنالیز یکپارچگی بین ماژولی');
  console.log('═══════════════════════════════════════════════\n');

  for (const f of files) {
    const code = fs.readFileSync(path.join(CRM_DIR, f), 'utf-8');
    try {
      vm.runInContext(code, ctx, { filename: f });
      loaded[f] = true;
    } catch (e) {
      errors.push({ file: f, error: e.message, line: e.stack });
    }
  }

  console.log(`✓ فایل‌های لود‌شده: ${Object.keys(loaded).length}/${files.length}`);
  console.log(`✗ فایل‌های ناموفق: ${errors.length}\n`);

  if (errors.length) {
    console.log('═══ خطاهای لود ═══');
    errors.forEach(e => {
      console.log(`\n❌ ${e.file}`);
      console.log(`   ${e.error}`);
      if (e.line) console.log(`   ${e.line.split('\n')[0]}`);
    });
  }

  // استخراج تمام توابع تعریف‌شده
  const allDefs = Object.keys(sandbox).filter(k => typeof sandbox[k] === 'function' && !isBuiltin(k));
  console.log(`\n✓ توابع تعریف‌شده در window: ${allDefs.length}`);

  // آمار
  const stats = {};
  for (const k of allDefs) {
    stats[k] = (stats[k] || 0) + 1;
  }

  // ذخیره نتیجه
  fs.writeFileSync(
    path.join(__dirname, 'phase1-load-result.json'),
    JSON.stringify({
      loaded: Object.keys(loaded),
      failed: errors,
      windowFunctions: allDefs
    }, null, 2)
  );
  console.log(`\n💾 phase1-load-result.json`);
})();

function isBuiltin(name) {
  return [
    'window', 'document', 'self', 'navigator', 'location', 'history',
    'localStorage', 'sessionStorage', 'console', 'setTimeout', 'setInterval',
    'clearTimeout', 'clearInterval', 'Date', 'Math', 'JSON', 'Array', 'Object',
    'String', 'Number', 'Boolean', 'RegExp', 'Error', 'Promise', 'Map', 'Set',
    'Symbol', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'fetch', 'alert',
    'confirm', 'prompt', 'navigator', 'Intl', 'Reflect', 'Proxy', 'Buffer'
  ].includes(name);
}

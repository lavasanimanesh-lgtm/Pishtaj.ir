#!/usr/bin/env node
/* PTF CRM — v26.7 — Dark-mode contrast guard source regression */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function ok(condition, label) {
  if (condition) { pass++; console.log('  ✓ PASS: ' + label); }
  else { fail++; console.log('  ✘ FAIL: ' + label); }
}

const index = read('crm/index.html');
const sw = read('crm/sw.js');
const guard = read('crm/theme-contrast.js');

ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(index), 'version CRM v26.7 is declared');
ok(/theme-contrast\.js\?v=\d+\.\d+/.test(index), 'contrast guard is loaded by CRM');
ok(index.indexOf('theme-contrast.js?v=') > index.indexOf('financehub.js?v=') && index.indexOf('theme-contrast.js?v=') < index.indexOf('sync.js?v='), 'guard is loaded after UI modules and before sync');
ok(/var CACHE = 'ptf-crm-v\d+(?:\.\d+)+'/.test(sw), 'service-worker cache is version-aligned');
ok(sw.includes("'./theme-contrast.js'"), 'contrast guard is included in the offline PWA shell');
ok(guard.includes('MutationObserver') && !guard.includes('setInterval'), 'dynamic content is handled event-driven without polling');
ok(guard.includes('ptf-theme-surface') && guard.includes('ptf-theme-bg-danger') && guard.includes('ptf-theme-bg-warning') && guard.includes('ptf-theme-bg-success'), 'surface and semantic alert palettes exist');
ok(guard.includes('ptf-theme-text-primary') && guard.includes('ptf-theme-text-muted') && guard.includes('ptf-theme-text-subtle'), 'neutral text contrast classes exist');
ok(guard.includes('body.ptf-dark input') && guard.includes('input::placeholder') && guard.includes('color-scheme:dark'), 'form controls and native dark widgets are covered');
ok(guard.includes('body.ptf-dark .b-st1') && guard.includes('body.ptf-dark .b-stTO'), 'built-in workflow/status badges are covered');
ok(guard.includes('window.ptfThemeContrastAudit'), 'manual browser contrast audit helper is available');

function rgb(hex) {
  hex = hex.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
function lum(c) {
  const a = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function ratio(fg, bg) {
  const a = lum(rgb(fg)), b = lum(rgb(bg));
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
[
  ['#f8fafc', '#162235', 'main text/surface'],
  ['#d5dfed', '#162235', 'muted text/surface'],
  ['#dbeafe', '#082f49', 'info text/surface'],
  ['#d1fae5', '#064e3b', 'success text/surface'],
  ['#fde68a', '#451a03', 'warning text/surface'],
  ['#fecaca', '#451a1a', 'danger text/surface'],
  ['#e9d5ff', '#2e1065', 'purple text/surface'],
  ['#fbcfe8', '#500724', 'pink text/surface'],
  ['#ffffff', '#047857', 'success action'],
  ['#ffffff', '#b91c1c', 'danger action']
].forEach(([fg, bg, label]) => ok(ratio(fg, bg) >= 4.5, 'WCAG AA normal-text contrast: ' + label));

console.log('=== tester138-v258-theme: ' + pass + ' PASS / ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);

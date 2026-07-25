/* =====================================================================
   PTF CRM — dialogx.js — v16.4 — US-372
   دیالوگ‌های هم‌تم نرم‌افزار به‌جای پیام‌های بومی مرورگر (pishtaj.ir says)
   - Promise-محور: dialogx.alert / dialogx.confirm / dialogx.prompt
   - RTL، حالت روشن/تاریک (متغیرهای --crd/--tx/--brd)، آیکون، دکمه‌های برند
   - ESC / کلیک بیرون = انصراف امن (resolve(false|null)) — هرگز reject نمی‌کند
   - focus trap (Tab بین دکمه‌ها می‌چرخد) — دسترس‌پذیری AC4
   - موبایل: دکمه‌های تمام‌عرض (media query)
   فاز ۱ (AC2): alert های ضدتکرار dedup + اعتبارسنجی فرم‌های اصلی مهاجرت کردند.
   confirm حیاتی مهاجرت‌یافته این فاز: حذف پیشنهاد (offerDel).
   نکته: «حذف با دلیل» (ptfReasonedDelete) و «مختومه‌سازی باخت» (sfLostModal)
   از قبل مودال هم-تم اختصاصی دارند و نیازی به مهاجرت نداشتند.
   ===================================================================== */
(function () {
  'use strict';

  /* استایل سراسری — فقط یک‌بار تزریق */
  var css = document.createElement('style');
  css.textContent =
    '.ptfdlg-b{position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.55);display:grid;place-items:center;padding:18px;backdrop-filter:blur(2px)}' +
    '.ptfdlg{background:var(--crd,#fff);color:var(--tx,#1e293b);border-radius:18px;max-width:420px;width:100%;padding:20px 22px;box-shadow:0 24px 70px rgba(15,23,42,.35);font-family:inherit;direction:rtl;animation:ptfdlgIn .18s ease}' +
    '@keyframes ptfdlgIn{from{transform:translateY(10px) scale(.97);opacity:0}to{transform:none;opacity:1}}' +
    '.ptfdlg .dx-h{display:flex;align-items:center;gap:10px;margin-bottom:10px}' +
    '.ptfdlg .dx-ic{font-size:26px;line-height:1}' +
    '.ptfdlg .dx-t{font-size:14.5px;font-weight:800}' +
    '.ptfdlg .dx-m{font-size:13px;line-height:2;color:var(--tx,#334155);white-space:pre-line;max-height:46vh;overflow:auto}' +
    '.ptfdlg .dx-in{width:100%;margin-top:10px;padding:9px 12px;border:1.5px solid var(--brd,#e2e8f0);border-radius:10px;font-family:inherit;font-size:13px;background:var(--crd,#fff);color:var(--tx,#1e293b)}' +
    '.ptfdlg .dx-bts{display:flex;gap:8px;justify-content:flex-start;margin-top:16px;flex-direction:row-reverse}' +
    '.ptfdlg .dx-bt{border:0;border-radius:11px;padding:9px 22px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:.15s}' +
    '.ptfdlg .dx-ok{background:linear-gradient(135deg,var(--pri,#ef4b1a),var(--org,#f79400));color:#fff}' +
    '.ptfdlg .dx-ok.dx-danger{background:linear-gradient(135deg,#dc2626,#ef4444)}' +
    '.ptfdlg .dx-cl{background:transparent;border:1.5px solid var(--brd,#e2e8f0);color:var(--tx,#475569)}' +
    '.ptfdlg .dx-bt:hover{filter:brightness(1.06)}' +
    '@media(max-width:600px){.ptfdlg{max-width:100%}.ptfdlg .dx-bts{flex-direction:column}.ptfdlg .dx-bt{width:100%;padding:12px}}';
  document.head.appendChild(css);

  /* هسته: ساخت دیالوگ و برگرداندن Promise — kind: alert | confirm | prompt */
  function open(kind, msg, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var icon = opts.icon || (kind === 'confirm' ? '❓' : kind === 'prompt' ? '✏️' : 'ℹ️');
      var title = opts.title || (kind === 'confirm' ? 'تایید عملیات' : kind === 'prompt' ? 'ورود اطلاعات' : 'پیام سامانه');
      var okLb = opts.okLabel || (kind === 'alert' ? 'متوجه شدم' : 'تایید');
      var clLb = opts.cancelLabel || 'انصراف';
      var esc = function (s2) { return String(s2 == null ? '' : s2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

      var b = document.createElement('div');
      b.className = 'ptfdlg-b';
      b.innerHTML = '<div class="ptfdlg" role="dialog" aria-modal="true">' +
        '<div class="dx-h"><span class="dx-ic">' + esc(icon) + '</span><span class="dx-t">' + esc(title) + '</span></div>' +
        '<div class="dx-m">' + esc(msg) + '</div>' +
        (kind === 'prompt' ? '<input type="text" class="dx-in" value="' + esc(opts.def || '') + '">' : '') +
        '<div class="dx-bts">' +
        '<button type="button" class="dx-bt dx-ok' + (opts.danger ? ' dx-danger' : '') + '">' + esc(okLb) + '</button>' +
        (kind !== 'alert' ? '<button type="button" class="dx-bt dx-cl">' + esc(clLb) + '</button>' : '') +
        '</div></div>';
      document.body.appendChild(b);

      var inp = b.querySelector('.dx-in');
      var okB = b.querySelector('.dx-ok');
      var clB = b.querySelector('.dx-cl');

      function done(val) {
        document.removeEventListener('keydown', onKey, true);
        b.remove();
        resolve(val);
      }
      function cancelVal() { return kind === 'confirm' ? false : kind === 'prompt' ? null : undefined; }
      function okVal() { return kind === 'confirm' ? true : kind === 'prompt' ? (inp ? inp.value : '') : undefined; }

      okB.onclick = function () { done(okVal()); };
      if (clB) clB.onclick = function () { done(cancelVal()); };
      /* کلیک بیرون = انصراف امن (AC4) */
      b.addEventListener('click', function (ev) { if (ev.target === b) done(cancelVal()); });

      /* focus trap + ESC + Enter */
      function onKey(ev) {
        if (ev.key === 'Escape') { ev.stopPropagation(); done(cancelVal()); return; }
        if (ev.key === 'Enter' && (kind !== 'prompt' || ev.target === inp)) { ev.stopPropagation(); done(okVal()); return; }
        if (ev.key === 'Tab') {
          var f = [].slice.call(b.querySelectorAll('button,input'));
          if (!f.length) return;
          var i = f.indexOf(document.activeElement);
          ev.preventDefault();
          f[(i + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      }
      document.addEventListener('keydown', onKey, true);
      setTimeout(function () { (inp || okB).focus(); }, 30);
    });
  }

  window.dialogx = {
    alert: function (msg, opts) { return open('alert', msg, opts); },
    confirm: function (msg, opts) { return open('confirm', msg, opts); },
    prompt: function (msg, def, opts) { var o = opts || {}; o.def = def; return open('prompt', msg, o); }
  };

  /* helper مهاجرت تدریجی (AC2/AC6): اگر dialogx در دسترس نبود → alert بومی (هیچ جریانی نمی‌شکند) */
  window.ptfDlgAlert = function (msg, opts) {
    if (window.dialogx) return window.dialogx.alert(msg, opts);
    alert(msg);
    return Promise.resolve();
  };
})();

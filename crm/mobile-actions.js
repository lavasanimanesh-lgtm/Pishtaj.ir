/* =====================================================================
   PTF CRM — mobile-actions.js — MOB-028 / MOB-033
   قرارداد runtime برای actionهای mobile که قبلاً با font-size:0 و
   first-letter به آیکون مبهم/خالی تبدیل می‌شدند.
   - toolbar: آیکون صریح + title + aria-label
   - .ba در جدول‌ها: آیکون وسط‌چین + نام قابل‌دسترسی
   - فقط در عرض موبایل؛ متن اصلی برای desktop دست‌نخورده می‌ماند.
   ===================================================================== */
(function () {
  'use strict';

  var BP = 768;
  var TONES = {
    blue:   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    violet: { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    amber:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    teal:   { color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
    cyan:   { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
    green:  { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
    pink:   { color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
    red:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    slate:  { color: '#475569', bg: '#f8fafc', border: '#cbd5e1' }
  };

  function isMob() { return window.innerWidth <= BP; }
  function norm(s) { return String(s || '').replace(/[\u200c\s]+/g, ' ').trim().toLowerCase(); }
  function cleanLabel(s) { return String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, '').replace(/\s+/g, ' ').trim(); }
  function panelName() { return norm((document.getElementById('pgTitle') || {}).textContent); }

  function tone(btn, name) {
    var t = TONES[name] || TONES.slate;
    btn.setAttribute('data-mobile-tone', name || 'slate');
    /* theme helperها گاهی رنگ inline را تغییر می‌دهند؛ این actionها باید معنا را حفظ کنند. */
    btn.style.setProperty('color', t.color, 'important');
    btn.style.setProperty('background', t.bg, 'important');
    btn.style.setProperty('border-color', t.border, 'important');
  }

  function guess(btn, kind) {
    var raw = [btn.getAttribute('aria-label'), btn.getAttribute('title'), btn.textContent, btn.getAttribute('onclick')].join(' ');
    var s = norm(raw), p = panelName();
    var fallback = cleanLabel(btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent) || 'عملیات';
    var out = { icon: '⚙️', label: fallback, tone: 'slate' };

    if (/حذف|ابطال|پاک/.test(s) || /\b(del|delete|remove|void)\b/.test(s)) return { icon: '🗑️', label: /ابطال/.test(s) ? 'ابطال' : 'حذف', tone: 'red' };
    if (/برگشت|برگشتی|بازگرد/.test(s)) return { icon: '⏪', label: 'بازگشت', tone: 'amber' };
    if (/ویرایش|اصلاح|نگارش/.test(s) || /\b(edit|revise|upd)\b/.test(s)) return { icon: '✏️', label: /نگارش/.test(s) ? 'نگارش جدید' : 'ویرایش', tone: 'amber' };
    if (/مشاهده|باز کردن|جزئیات|پیش.?نمایش/.test(s) || /\b(view|preview|open)\b/.test(s)) return { icon: '👁', label: /جزئیات/.test(s) ? 'جزئیات' : 'مشاهده', tone: 'blue' };
    if (/پیام|واتساپ|تلگرام|چت/.test(s) || /\bmsg\b/.test(s)) return { icon: '💬', label: 'پیام', tone: 'green' };
    if (/ادغام|merge/.test(s)) return { icon: '🔗', label: 'ادغام', tone: 'violet' };
    if (/پرداخت مستقیم/.test(s)) return { icon: '💳', label: 'پرداخت', tone: 'teal' };
    if (/شارژ/.test(s)) return { icon: '💰', label: 'شارژ', tone: 'green' };
    if (/ارجاع دوره|ارجاع/.test(s)) return { icon: '📨', label: 'ارجاع', tone: 'cyan' };
    if (/گردش حساب|حساب|ledger/.test(s)) return { icon: '💳', label: 'حساب', tone: 'teal' };
    if (/پرداخت|وصول|تایید|خواندم|خوانده/.test(s)) return { icon: '✅', label: /وصول/.test(s) ? 'وصول' : (/خوان/.test(s) ? 'خواندم' : 'تایید'), tone: 'green' };
    if (/تطبیق/.test(s)) return { icon: '🔗', label: 'تطبیق', tone: 'violet' };
    if (/فاکتور|invoice/.test(s)) return { icon: '🧾', label: 'فاکتور', tone: 'violet' };
    if (/لینک|اتصال/.test(s)) return { icon: '🔗', label: 'اتصال', tone: 'violet' };
    if (/اکسل|excel|خروجی/.test(s)) return { icon: /ورود/.test(s) ? '📥' : '📤', label: /ورود/.test(s) ? 'ورود اکسل' : 'خروجی', tone: 'teal' };
    if (/راهنما|help/.test(s)) return { icon: 'ℹ️', label: 'راهنما', tone: 'violet' };
    if (/تنظیمات/.test(s)) return { icon: '⚙️', label: 'تنظیمات', tone: 'slate' };
    if (/چاپ|pdf/.test(s)) return { icon: '🖨', label: 'چاپ', tone: 'indigo' };
    if (/گزارش|report/.test(s)) return { icon: '📊', label: 'گزارش', tone: 'violet' };
    if (/پیشنهاد فنی/.test(s)) return { icon: '🔧', label: 'پیشنهاد فنی', tone: 'violet' };
    if (/پیشنهاد مالی/.test(s)) return { icon: '💰', label: 'پیشنهاد مالی', tone: 'teal' };
    if (/لید/.test(s)) return { icon: '🎯', label: 'لید جدید', tone: 'blue' };
    if (/مشتری/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '🤝', label: 'مشتری جدید', tone: 'blue' };
    if (/تامین|تأمین/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '🏭', label: 'تأمین جدید', tone: 'violet' };
    if (/کالا/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '📦', label: 'کالای جدید', tone: 'amber' };
    if (/موجودی/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '🏬', label: 'ثبت موجودی', tone: 'teal' };
    if (/نامه وارده/.test(s)) return { icon: '📥', label: 'نامه وارده', tone: 'blue' };
    if (/نامه صادره/.test(s)) return { icon: '✉️', label: 'نامه صادره', tone: 'violet' };
    if (/قرارداد/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '📜', label: 'قرارداد جدید', tone: 'violet' };
    if (/یادآور/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '⏰', label: 'یادآور جدید', tone: 'amber' };
    if (/مخاطب/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '👤', label: 'مخاطب جدید', tone: 'blue' };
    if (/خبر/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '📄', label: 'خبر جدید', tone: 'blue' };
    if (/کاربر/.test(s) && /ثبت|جدید|\+/.test(s)) return { icon: '👥', label: 'کاربر جدید', tone: 'blue' };
    if (/ثبت هزینه/.test(s)) return { icon: '💵', label: 'ثبت هزینه', tone: 'amber' };
    if (/ثبت|جدید|اضافه|\+/.test(s)) {
      if (/سرنخ/.test(p)) return { icon: '🎯', label: 'لید جدید', tone: 'blue' };
      if (/درخواست/.test(p)) return { icon: '📋', label: 'درخواست جدید', tone: 'blue' };
      if (/تأمین/.test(p)) return { icon: '🏭', label: 'ثبت جدید', tone: 'violet' };
      if (/کالا/.test(p)) return { icon: '📦', label: 'ثبت جدید', tone: 'amber' };
      if (/مکاتبات/.test(p)) return { icon: '✉️', label: 'ثبت جدید', tone: 'violet' };
      return { icon: '➕', label: 'افزودن', tone: 'blue' };
    }
    if (kind === 'ba' && /ابطال/.test(s)) return { icon: '🗑️', label: 'ابطال', tone: 'red' };
    return out;
  }

  function appendIcon(btn, cls, meta) {
    var old = btn.querySelector('.' + cls);
    if (old) return;
    var i = document.createElement('span');
    i.className = cls;
    i.setAttribute('aria-hidden', 'true');
    i.textContent = meta.icon;
    btn.appendChild(i);
    try { if (typeof window.ptfIconxSweep === 'function') window.ptfIconxSweep(i); } catch (e) {}
  }

  function blocked(btn) {
    return !!(btn.classList && btn.classList.contains('msg-quick-app')) ||
      !!btn.closest('.md,.ptfdlg,#oTb,#rTb,#cTb,#sTb,#pTb,#chqpToolbar,#chqpGraphicActions,.offer-row-action,.entity-row-action,.chqp-action,.payable-action,.msg-quick-links,.rfq-offer-bar');
  }

  function toolbar(btn) {
    if (btn.getAttribute('data-mobile-toolbar-ready') || blocked(btn)) return;
    var cs = getComputedStyle(btn);
    if (cs.fontSize !== '0px') return;
    var meta = guess(btn, 'toolbar');
    btn.setAttribute('data-mobile-toolbar-ready', '1');
    btn.classList.add('mobile-toolbar-action');
    btn.setAttribute('title', btn.getAttribute('title') || meta.label);
    btn.setAttribute('aria-label', btn.getAttribute('aria-label') || meta.label);
    tone(btn, meta.tone);
    appendIcon(btn, 'mobile-toolbar-icon', meta);
  }

  function ba(btn) {
    if (btn.getAttribute('data-mobile-ba-ready') || blocked(btn)) return;
    if (!btn.closest('.tb2')) return;
    var meta = guess(btn, 'ba');
    btn.setAttribute('data-mobile-ba-ready', '1');
    btn.classList.add('mobile-ba-action');
    btn.setAttribute('title', btn.getAttribute('title') || meta.label);
    btn.setAttribute('aria-label', btn.getAttribute('aria-label') || meta.label);
    var td = btn.closest('td'); if (td) td.classList.add('mobile-ba-row');
    tone(btn, meta.tone);
    appendIcon(btn, 'mobile-ba-icon', meta);
  }

  function apply() {
    if (!isMob()) return;
    var root = document.getElementById('panels');
    if (!root) return;
    root.querySelectorAll('.ph .bt,.ph .bt-o,.sb2 .bt,.sb2 .bt-o').forEach(toolbar);
    root.querySelectorAll('.tb2 .ba').forEach(ba);
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || setTimeout)(function () { scheduled = false; apply(); });
  }
  function boot() {
    var panels = document.getElementById('panels');
    if (!panels || window._ptfMobileActionsBooted) return false;
    window._ptfMobileActionsBooted = true;
    new MutationObserver(schedule).observe(panels, {childList:true, subtree:true});
    apply();
    return true;
  }
  var tries = 0;
  var timer = setInterval(function () { tries++; if (boot() || tries > 50) clearInterval(timer); }, 200);
  window.addEventListener('resize', schedule);
  window.ptfMobileActionAuditApply = apply;
})();

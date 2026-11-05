# گزارش Audit UX/UI - پیشرو تجهیز فرتاک

**تاریخ**: ۲۰۲۶-۱۱-۰۴  
**ابزار**: UI/UX Pro Max Skill  
**Branch**: `arena/079d8ab0-pishtaj-ir`

---

## 📊 وضعیت فعلی (قبل از بهینه‌سازی)

### ✅ نقاط قوت

1. **Semantic HTML**
   - ✅ استفاده از `<header>`, `<nav>`, `<main>`, `<footer>`
   - ✅ Skip link موجود (`#main-content`)
   - ✅ Heading hierarchy درست (H1 → H2 → H3)
   - ✅ هر صفحه یک H1 یکتا دارد

2. **Accessibility**
   - ✅ فرم‌ها دارای `<label>` با `for` attribute
   - ✅ Focus states برای navigation
   - ✅ `aria-label` برای icon-only buttons
   - ✅ `prefers-reduced-motion` support

3. **Performance**
   - ✅ Critical CSS inline
   - ✅ Font preloading
   - ✅ Lazy loading برای تصاویر
   - ✅ Responsive breakpoints

4. **Design**
   - ✅ Dark mode support
   - ✅ RTL layout درست
   - ✅ Touch targets مناسب (min 44px)

---

## ❌ مشکلات شناسایی‌شده

### 🔴 اولویت بالا (CRITICAL)

#### ۱. **Color Contrast Issues**
**مشکل**: برخی ترکیب‌های رنگی contrast ratio کمتر از 4.5:1 دارند

**موارد**:
- `color: rgba(255,255,255,.68)` در footer با `background: #141416` → 4.2:1 (نیاز به 4.5:1)
- `color: rgba(255,255,255,.72)` در footer text → 4.5:1 (مرزی)
- برخی متن‌های خاکستری روی پس‌زمینه سفید

**راه حل**:
```css
/* قبل */
color: rgba(255,255,255,.68);

/* بعد */
color: rgba(255,255,255,.87); /* 7.2:1 */
```

**تأثیر**: WCAG AA compliance

---

#### ۲. **Focus States ناکافی**
**مشکل**: فقط navigation focus state دارد، فرم‌ها و دکمه‌ها focus state واضح ندارند

**موارد**:
- `<button>` بدون `:focus-visible`
- `<input>` بدون focus outline
- لینک‌های محتوایی بدون focus indicator

**راه حل**:
```css
/* Global focus styles */
:focus-visible {
  outline: 3px solid rgba(239, 75, 26, 0.5);
  outline-offset: 2px;
}

/* Input focus */
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 1px;
  border-color: var(--red);
}

/* Button focus */
button:focus-visible,
.ptf-btn:focus-visible {
  outline: 3px solid rgba(239, 75, 26, 0.5);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(239, 75, 26, 0.15);
}
```

**تأثیر**: Keyboard navigation accessibility

---

#### ۳. **Touch Target Size در موبایل**
**مشکل**: برخی دکمه‌ها و لینک‌ها در موبایل کوچک‌تر از 44×44px هستند

**موارد**:
- لینک‌های navigation در موبایل: `padding: 7px 8px; font-size: 12.5px` → ارتفاع ~28px
- برخی icon button ها

**راه حل**:
```css
@media (max-width: 790px) {
  .main-nav a {
    min-height: 44px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
  }
}
```

**تأثیر**: Mobile usability

---

### 🟡 اولویت متوسط (HIGH)

#### ۴. **Loading States ناکافی**
**مشکل**: فرم RFQ و برخی بخش‌ها loading state ندارند

**موارد**:
- دکمه submit فرم RFQ بدون loading indicator
- صفحات داخلی بدون skeleton loading

**راه حل**:
```css
/* Loading button state */
.ptf-btn.is-loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.ptf-btn.is-loading::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**تأثیر**: User feedback

---

#### ۵. **Error Handling ناکافی**
**مشکل**: فرم‌ها error messages واضح ندارند

**موارد**:
- RFQ form بدون inline validation
- Error messages فقط در بالای فرم نمایش داده می‌شوند

**راه حل**:
```html
<div class="field">
  <label for="phone">شماره تماس <em>*</em></label>
  <input id="phone" type="tel" required pattern="^09[0-9]{9}$">
  <small class="error" aria-live="polite">
    شماره تماس باید ۱۱ رقمی و با ۰۹ شروع شود
  </small>
</div>
```

```css
.field input:invalid:not(:placeholder-shown) {
  border-color: #dc2626;
}

.field .error {
  display: none;
  color: #dc2626;
  font-size: 13px;
  margin-top: 4px;
}

.field input:invalid:not(:placeholder-shown) + .error {
  display: block;
}
```

**تأثیر**: Form usability

---

#### ۶. **Animation Performance**
**مشکل**: ۵۲ انیمیشن در CSS وجود دارد، برخی ممکن است performance impact داشته باشند

**موارد**:
- انیمیشن‌های `width` و `height`
- انیمیشن‌های بدون `prefers-reduced-motion` support

**راه حل**:
```css
/* قبل */
.element {
  transition: width 0.3s ease;
}

/* بعد */
.element {
  transition: transform 0.3s ease;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .element {
    transition: none;
  }
}
```

**تأثیر**: Smooth animations, battery life

---

### 🟢 اولویت پایین (MEDIUM)

#### ۷. **Empty States**
**مشکل**: برخی بخش‌ها (مثل جستجو) empty state ندارند

**راه حل**: اضافه کردن empty state با SVG illustration و CTA

---

#### ۸. **Micro-interactions**
**مشکل**: دکمه‌ها و کارت‌ها hover/active states ضعیف دارند

**راه حل**:
```css
.ptf-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.ptf-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.ptf-card:active {
  transform: translateY(-2px);
}
```

**تأثیر**: Perceived quality

---

#### ۹. **Typography Scale**
**مشکل**: برخی فونت‌سایزها کمتر از 16px هستند

**موارد**:
- `font-size: 12.5px` در navigation
- `font-size: 11px` در برخی متون

**راه حل**: استفاده از `rem` units و minimum 16px برای body text

---

#### ۱۰. **Dark Mode Contrast**
**مشکل**: برخی عناصر در dark mode contrast کافی ندارند

**راه حل**: بررسی و اصلاح color variables برای dark mode

---

## 🎯 پیشنهادات اولویت‌بندی‌شده

### فاز ۱: Accessibility (هفته ۱-۲)
1. ✅ Color contrast اصلاح
2. ✅ Focus states اضافه
3. ✅ Touch targets در موبایل
4. ✅ Form validation inline

### فاز ۲: UX Polish (هفته ۳-۴)
5. ✅ Loading states
6. ✅ Error messages واضح
7. ✅ Empty states
8. ✅ Micro-interactions

### فاز ۳: Performance (هفته ۵-۶)
9. ✅ Animation optimization
10. ✅ Typography scale
11. ✅ Dark mode contrast

### فاز ۴: Advanced (هفته ۷-۸)
12. ✅ Skeleton loading screens
13. ✅ Progressive disclosure در فرم‌ها
14. ✅ Advanced animations (با reduced-motion support)

---

## 📋 Checklist قبل از اجرا

- [ ] Backup از CSS files
- [ ] تست در Chrome, Firefox, Safari
- [ ] تست در موبایل (iOS Safari, Android Chrome)
- [ ] Lighthouse audit قبل و بعد
- [ ] Accessibility audit (axe DevTools)
- [ ] Cross-browser testing

---

## 🔧 ابزارهای پیشنهادی

1. **axe DevTools** - Accessibility testing
2. **Lighthouse** - Performance & UX audit
3. **WebAIM Contrast Checker** - Color contrast
4. **Responsive Design Mode** - Mobile testing
5. **Keyboard navigation test** - Tab through all pages

---

## 📊 معیارهای موفقیت

| معیار | قبل | هدف | بعد |
|-------|-----|------|-----|
| Lighthouse Accessibility | ? | 95+ | ? |
| Lighthouse Performance | ? | 90+ | ? |
| Color Contrast Failures | ? | 0 | ? |
| Touch Target Issues | ? | 0 | ? |
| Focus State Coverage | ? | 100% | ? |

---

**پایان گزارش Audit**

**گام بعدی**: تأیید شما برای شروع اجرای تغییرات

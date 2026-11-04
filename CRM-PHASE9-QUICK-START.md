# راهنمای سریع Phase 9 - UX/UI Enhancements
## CRM Pishtaj - نسخه 100/100

---

## 🚀 شروع سریع

### 1. Helper Text برای فرم‌ها

```javascript
// Helper ساده
CRMPhase9.addHelper('input[name="email"]', 'ایمیل معتبر وارد کنید', 'info');

// Helper با نوع‌های مختلف
CRMPhase9.addHelper('input[name="password"]', 'حداقل 8 کاراکتر', 'warning');
CRMPhase9.addHelper('input[name="username"]', 'این نام قبلاً استفاده شده', 'error');
CRMPhase9.addHelper('input[name="code"]', 'کد تایید ارسال شد', 'success');
```

---

### 2. Tooltip برای دکمه‌ها

```javascript
// Tooltip ساده
CRMPhase9.addTooltip('button#save', 'ذخیره تغییرات (Ctrl+S)');
CRMPhase9.addTooltip('button#delete', 'حذف رکورد (Ctrl+D)');
CRMPhase9.addTooltip('a#help', 'راهنما (F1)');
```

---

### 3. Expandable Sections

```html
<!-- HTML -->
<div class="crm-expandable">
  <div class="crm-expandable__header">
    <h3 class="crm-expandable__title">تنظیمات پیشرفته</h3>
    <svg class="crm-expandable__icon" viewBox="0 0 24 24">
      <path d="M7 10l5 5 5-5z"/>
    </svg>
  </div>
  <div class="crm-expandable__content">
    <div class="crm-expandable__body">
      <!-- محتوای قابل باز/بسته شدن -->
      <p>تنظیمات بیشتر اینجا...</p>
    </div>
  </div>
</div>
```

```javascript
// کنترل با JavaScript
const expandable = document.querySelector('.crm-expandable');
CRMPhase9.expandSection(expandable);   // باز کردن
CRMPhase9.collapseSection(expandable); // بستن
```

---

### 4. Skeleton Loading

```javascript
// Skeleton برای فرم (5 فیلد)
CRMPhase9.showSkeletonForm('#form-container', 5);

// Skeleton برای آمار (4 کارت)
CRMPhase9.showSkeletonStats('#stats-container', 4);

// Skeleton برای جدول
CRMComponents.showSkeleton('#table-container', 'table');

// Skeleton برای لیست (10 آیتم)
CRMComponents.showSkeleton('#list-container', 'list', 10);
```

---

### 5. Progress Steps

```javascript
// ایجاد progress bar
CRMPhase9.showProgressSteps('#progress', [
  'ایجاد درخواست',
  'تایید مدیر',
  'ارسال به تامین‌کننده',
  'دریافت پاسخ'
], 1); // مرحله فعلی: 1 (0-based)

// بروزرسانی مرحله
CRMPhase9.updateProgressStep('#progress', 2); // رفتن به مرحله 2
```

---

### 6. Skip Link برای Accessibility

```javascript
// اضافه کردن skip link
CRMPhase9.addSkipLink('#main-content', 'پرش به محتوای اصلی');
```

---

### 7. Focus Trap برای Modals

```javascript
// Trap focus داخل modal
const modal = document.querySelector('.modal');
CRMPhase9.trapFocus(modal);
```

---

### 8. Keyboard Shortcuts

```javascript
// ثبت shortcut جدید
CRMComponents.registerShortcut('Ctrl+Shift+N', function() {
  createNewRecord();
}, 'ایجاد رکورد جدید');

// نمایش راهنمای shortcuts
CRMPhase9.showShortcutsHelp();
```

---

## 🎨 نمونه‌های کامل

### نمونه 1: فرم با Helper و Validation

```javascript
function renderForm() {
  const html = `
    <form id="userForm">
      <div class="fld">
        <label>نام کاربری</label>
        <input type="text" name="username" required>
      </div>
      <div class="fld">
        <label>ایمیل</label>
        <input type="email" name="email" required>
      </div>
      <div class="fld">
        <label>رمز عبور</label>
        <input type="password" name="password" required>
      </div>
      <button type="submit">ثبت نام</button>
    </form>
  `;
  
  document.getElementById('container').innerHTML = html;
  
  // اضافه کردن helper text
  CRMPhase9.addHelper('input[name="username"]', 
    'نام کاربری باید 3-20 کاراکتر و شامل حروف و اعداد باشد', 
    'info'
  );
  
  CRMPhase9.addHelper('input[name="email"]', 
    'ایمیل سازمانی وارد کنید (مثال: user@company.com)', 
    'info'
  );
  
  CRMPhase9.addHelper('input[name="password"]', 
    'حداقل 8 کاراکتر شامل حروف بزرگ، کوچک و اعداد', 
    'warning'
  );
  
  // اضافه کردن tooltip به دکمه
  CRMPhase9.addTooltip('button[type="submit"]', 
    'ثبت اطلاعات و ایجاد حساب کاربری'
  );
}
```

---

### نمونه 2: صفحه با Loading State

```javascript
function loadDashboard() {
  // نمایش skeleton
  CRMPhase9.showSkeletonStats('#stats', 4);
  CRMPhase9.showSkeletonForm('#form', 3);
  
  // بارگذاری داده‌ها
  Promise.all([
    fetchStats(),
    fetchFormData()
  ]).then(([stats, formData]) => {
    // نمایش آمار
    renderStats(stats);
    
    // نمایش فرم
    renderForm(formData);
    
    // نمایش پیام موفقیت
    CRMComponents.showToast('داده‌ها بارگذاری شدند', 'success');
  }).catch(error => {
    CRMComponents.showToast('خطا در بارگذاری داده‌ها', 'error');
  });
}
```

---

### نمونه 3: Wizard با Progress Steps

```javascript
let currentStep = 0;
const steps = ['اطلاعات شخصی', 'آدرس', 'تایید', 'پایان'];

function renderWizard() {
  const html = `
    <div id="progress"></div>
    <div id="wizard-content"></div>
    <div class="actions">
      <button id="prevBtn" onclick="prevStep()">قبلی</button>
      <button id="nextBtn" onclick="nextStep()">بعدی</button>
    </div>
  `;
  
  document.getElementById('container').innerHTML = html;
  updateWizard();
}

function updateWizard() {
  // بروزرسانی progress
  CRMPhase9.showProgressSteps('#progress', steps, currentStep);
  
  // نمایش محتوای مرحله فعلی
  const content = getStepContent(currentStep);
  document.getElementById('wizard-content').innerHTML = content;
  
  // بروزرسانی دکمه‌ها
  document.getElementById('prevBtn').disabled = currentStep === 0;
  document.getElementById('nextBtn').textContent = 
    currentStep === steps.length - 1 ? 'پایان' : 'بعدی';
}

function nextStep() {
  if (currentStep < steps.length - 1) {
    currentStep++;
    updateWizard();
    CRMComponents.showToast(`مرحله ${currentStep + 1} از ${steps.length}`, 'info', 1500);
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    updateWizard();
  }
}
```

---

### نمونه 4: Expandable FAQ

```javascript
function renderFAQ() {
  const faqs = [
    {
      question: 'چگونه می‌توانم رمز عبور خود را تغییر دهم؟',
      answer: 'از منوی تنظیمات > تغییر رمز عبور اقدام کنید.'
    },
    {
      question: 'آیا می‌توانم داده‌ها را export کنم؟',
      answer: 'بله، از منوی گزارشات > export استفاده کنید.'
    },
    {
      question: 'چگونه با پشتیبانی تماس بگیرم؟',
      answer: 'از طریق چت آنلاین یا ایمیل support@company.com'
    }
  ];
  
  let html = '';
  faqs.forEach((faq, index) => {
    html += `
      <div class="crm-expandable">
        <div class="crm-expandable__header">
          <h3 class="crm-expandable__title">${faq.question}</h3>
          <svg class="crm-expandable__icon" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
        <div class="crm-expandable__content">
          <div class="crm-expandable__body">
            <p>${faq.answer}</p>
          </div>
        </div>
      </div>
    `;
  });
  
  document.getElementById('faq-container').innerHTML = html;
  // Expandable sections به صورت خودکار initialize می‌شوند
}
```

---

### نمونه 5: Table با Skeleton و Empty State

```javascript
function loadTable() {
  // نمایش skeleton
  CRMComponents.showSkeleton('#table-container', 'table');
  
  fetchTableData().then(data => {
    if (data.length === 0) {
      // نمایش empty state
      CRMComponents.showEmptyState('#table-container', {
        icon: '📊',
        title: 'هیچ داده‌ای موجود نیست',
        description: 'برای شروع، اولین رکورد را ایجاد کنید.',
        actionText: '➕ ایجاد رکورد جدید',
        actionCallback: createNewRecord
      });
    } else {
      // نمایش جدول
      renderTable(data);
      
      // اضافه کردن helper text
      CRMPhase9.addHelper('#table-search', 
        'برای جستجو از عنوان، شماره یا تاریخ استفاده کنید', 
        'info'
      );
      
      // اضافه کردن tooltip به دکمه‌ها
      CRMPhase9.addTooltip('button#export', 'خروجی Excel (Ctrl+E)');
      CRMPhase9.addTooltip('button#print', 'چاپ جدول (Ctrl+P)');
    }
  });
}
```

---

## ⌨️ کلیدهای میانبر پیش‌فرض

| کلید | عملکرد |
|------|--------|
| `Ctrl+K` | جستجو |
| `Ctrl+S` | ذخیره |
| `Ctrl+N` | ایجاد جدید |
| `Ctrl+F` | جستجو در صفحه |
| `Ctrl+E` | خروجی Excel |
| `Ctrl+P` | چاپ |
| `Ctrl+1-9` | رفتن به بخش‌ها |
| `Ctrl+?` | نمایش راهنما |
| `Escape` | بستن پنجره |

---

## 🎨 رنگ‌ها و Typography

### رنگ‌های Helper Text:
```css
.crm-helper--info    { color: #0e7490; }  /* آبی */
.crm-helper--success { color: #059669; }  /* سبز */
.crm-helper--warning { color: #d97706; }  /* نارنجی */
.crm-helper--error   { color: #dc2626; }  /* قرمز */
```

### سایز فونت‌ها:
```css
Helper text:  12px
Labels:       14px
Body text:    14-16px
Headings:     18-24px
```

---

## 📱 Responsive Design

تمام components به صورت responsive هستند:

- **Desktop (>768px):** Full features
- **Tablet (480-768px):** Adjusted layout
- **Mobile (<480px):** Simplified UI, larger touch targets

---

## 🌙 Dark Mode

تمام components از dark mode پشتیبانی می‌کنند:

```css
/* به صورت خودکار اعمال می‌شود */
html.ptf-dark .crm-helper {
  color: #94a3b8;
}

html.ptf-dark .crm-expandable {
  border-color: #334155;
}

html.ptf-dark .crm-skeleton {
  background: linear-gradient(...);
}
```

---

## ♿ Accessibility

### WCAG 2.1 AA Compliant:

✅ Focus states (3px outline)  
✅ Keyboard navigation  
✅ Skip links  
✅ ARIA attributes  
✅ Screen reader support  
✅ Reduced motion support  
✅ Color contrast (4.5:1 minimum)  

---

## 🔗 لینک‌های مفید

- **CRM-PHASE9-REPORT.md** - گزارش کامل Phase 9
- **CRM-COMPONENTS-GUIDE.md** - راهنمای Components Library
- **CRM-UX-PROMAX-REPORT.md** - گزارش UX/UI Pro Max

---

**نسخه:** 1.0  
**تاریخ:** 2026-11-04  
**امتیاز CRM:** 100/100 🎉

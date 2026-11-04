# راهنمای استفاده از CRM Components Library
## Phase 8 - Professional UI Components

**نسخه:** 1.0  
**تاریخ:** 2026-11-04

---

## 📦 Components موجود

### 1. Empty State Component
برای نمایش حالت خالی (وقتی داده‌ای وجود ندارد)

### 2. Loading State Component
برای نمایش حالت بارگذاری

### 3. Skeleton Loading Component
برای نمایش skeleton به جای loading spinner

### 4. Confirmation Dialog Component
برای نمایش dialog تایید/حذف

### 5. Toast Notification Helper
برای نمایش پیام‌های toast

### 6. Keyboard Shortcuts System
برای ثبت و مدیریت keyboard shortcuts

---

## 🎨 نحوه استفاده

### 1. Empty State

#### روش 1: HTML String
```javascript
const emptyHtml = CRMComponents.createEmptyState({
  icon: '✉️',
  title: 'هنوز نامه‌ای ثبت نشده',
  description: 'برای شروع، اولین نامه خود را ایجاد کنید.',
  actionText: '✉️ ایجاد نامه جدید',
  actionCallback: function() {
    openNewLetterForm();
  }
});

document.getElementById('container').innerHTML = emptyHtml;
```

#### روش 2: مستقیم در container
```javascript
CRMComponents.showEmptyState('#my-container', {
  icon: '📋',
  title: 'درخواستی یافت نشد',
  description: 'هیچ درخواستی با این فیلترها وجود ندارد.',
  actionText: '🔄 پاک کردن فیلترها',
  actionCallback: function() {
    clearFilters();
  }
});
```

#### روش 3: با لینک به جای callback
```javascript
CRMComponents.showEmptyState('#container', {
  icon: '👥',
  title: 'مشتری‌ای ثبت نشده',
  description: 'اولین مشتری خود را اضافه کنید.',
  actionText: '➕ افزودن مشتری',
  actionUrl: '/crm/customers?new=1'
});
```

---

### 2. Loading State

```javascript
// نمایش loading
CRMComponents.showLoading('#container', {
  text: 'در حال بارگذاری داده‌ها...'
});

// پس از بارگذاری
fetchData().then(data => {
  renderData(data);
});
```

---

### 3. Skeleton Loading

#### Skeleton Cards
```javascript
CRMComponents.showSkeleton('#container', 'card', 6);
```

#### Skeleton List
```javascript
CRMComponents.showSkeleton('#container', 'list', 10);
```

#### Skeleton Table
```javascript
CRMComponents.showSkeleton('#container', 'table');
```

#### Skeleton Text
```javascript
CRMComponents.showSkeleton('#container', 'text', 5);
```

---

### 4. Confirmation Dialog

#### Dialog حذف
```javascript
CRMComponents.showConfirmDialog({
  title: 'حذف رکورد',
  message: 'آیا از حذف این رکورد مطمئن هستید؟ این عمل قابل بازگشت نیست.',
  icon: 'danger',
  confirmText: 'حذف',
  cancelText: 'انصراف',
  confirmClass: 'danger',
  onConfirm: function() {
    deleteRecord(recordId);
  },
  onCancel: function() {
    console.log('Cancelled');
  }
});
```

#### Dialog تایید
```javascript
CRMComponents.showConfirmDialog({
  title: 'تایید عملیات',
  message: 'آیا می‌خواهید این عملیات را انجام دهید؟',
  icon: 'warning',
  confirmText: 'تایید',
  cancelText: 'انصراف',
  onConfirm: function() {
    performOperation();
  }
});
```

#### Dialog اطلاعات
```javascript
CRMComponents.showConfirmDialog({
  title: 'اطلاعات',
  message: 'عملیات با موفقیت انجام شد.',
  icon: 'info',
  confirmText: 'باشه',
  onConfirm: function() {
    closeModal();
  }
});
```

---

### 5. Toast Notifications

```javascript
// Success
CRMComponents.showToast('رکورد با موفقیت ذخیره شد', 'success');

// Error
CRMComponents.showToast('خطا در ذخیره‌سازی', 'error');

// Warning
CRMComponents.showToast('لطفاً تمام فیلدها را پر کنید', 'warning');

// Info
CRMComponents.showToast('در حال بارگذاری...', 'info');

// با مدت زمان دلخواه
CRMComponents.showToast('پیام', 'info', 5000); // 5 ثانیه
```

---

### 6. Keyboard Shortcuts

#### ثبت shortcut
```javascript
// Ctrl+N = ایجاد رکورد جدید
CRMComponents.registerShortcut('Ctrl+N', function() {
  createNewRecord();
}, 'ایجاد رکورد جدید');

// Ctrl+S = ذخیره
CRMComponents.registerShortcut('Ctrl+S', function() {
  saveForm();
}, 'ذخیره فرم');

// Ctrl+F = جستجو
CRMComponents.registerShortcut('Ctrl+F', function() {
  focusSearch();
}, 'جستجو');

// Ctrl+E = ویرایش
CRMComponents.registerShortcut('Ctrl+E', function() {
  editSelectedRecord();
}, 'ویرایش رکورد');

// Ctrl+D = حذف
CRMComponents.registerShortcut('Ctrl+D', function() {
  deleteSelectedRecord();
}, 'حذف رکورد');
```

#### نمایش راهنمای shortcuts
```javascript
CRMComponents.showShortcutsHelp();
```

---

## 🔧 نمونه‌های کامل

### نمونه 1: بارگذاری داده با Skeleton
```javascript
function loadData() {
  // نمایش skeleton
  CRMComponents.showSkeleton('#data-container', 'list', 10);
  
  // بارگذاری داده
  fetchData().then(data => {
    if (data.length === 0) {
      // نمایش empty state
      CRMComponents.showEmptyState('#data-container', {
        icon: '📭',
        title: 'داده‌ای یافت نشد',
        description: 'هیچ رکوردی وجود ندارد.',
        actionText: '➕ ایجاد رکورد جدید',
        actionCallback: createNew
      });
    } else {
      // نمایش داده‌ها
      renderData(data);
    }
  }).catch(error => {
    CRMComponents.showToast('خطا در بارگذاری داده‌ها', 'error');
  });
}
```

### نمونه 2: حذف با Confirmation
```javascript
function deleteRecord(id) {
  CRMComponents.showConfirmDialog({
    title: 'حذف رکورد',
    message: 'آیا از حذف این رکورد مطمئن هستید؟',
    icon: 'danger',
    confirmText: 'حذف',
    cancelText: 'انصراف',
    confirmClass: 'danger',
    onConfirm: function() {
      // نمایش loading
      CRMComponents.showLoading('#container');
      
      // حذف رکورد
      api.deleteRecord(id).then(() => {
        CRMComponents.showToast('رکورد حذف شد', 'success');
        loadData();
      }).catch(error => {
        CRMComponents.showToast('خطا در حذف رکورد', 'error');
      });
    }
  });
}
```

### نمونه 3: فرم با Validation و Toast
```javascript
function submitForm() {
  const formData = getFormData();
  
  // Validation
  if (!formData.name) {
    CRMComponents.showToast('لطفاً نام را وارد کنید', 'warning');
    return;
  }
  
  if (!formData.email) {
    CRMComponents.showToast('لطفاً ایمیل را وارد کنید', 'warning');
    return;
  }
  
  // نمایش loading
  CRMComponents.showLoading('#form-container');
  
  // ارسال فرم
  api.submitForm(formData).then(response => {
    CRMComponents.showToast('فرم با موفقیت ارسال شد', 'success');
    resetForm();
    loadData();
  }).catch(error => {
    CRMComponents.showToast('خطا در ارسال فرم', 'error');
  });
}
```

---

## 📋 الگوهای Empty State برای بخش‌های مختلف

### داشبورد
```javascript
CRMComponents.showEmptyState('#dashboard', {
  icon: '📊',
  title: 'داشبورد خالی است',
  description: 'برای مشاهده آمار، ابتدا داده‌هایی ثبت کنید.',
  actionText: '📋 رفتن به درخواست‌ها',
  actionUrl: '/crm?panel=rfq'
});
```

### مشتریان
```javascript
CRMComponents.showEmptyState('#customers', {
  icon: '👥',
  title: 'هنوز مشتری‌ای ثبت نشده',
  description: 'اولین مشتری خود را اضافه کنید تا بتوانید فاکتور و قرارداد صادر کنید.',
  actionText: '➕ افزودن مشتری',
  actionCallback: openNewCustomerForm
});
```

### کالاها
```javascript
CRMComponents.showEmptyState('#products', {
  icon: '📦',
  title: 'کالایی ثبت نشده',
  description: 'کالاهای خود را اضافه کنید تا بتوانید فاکتور و درخواست تامین ایجاد کنید.',
  actionText: '📦 افزودن کالا',
  actionCallback: openNewProductForm
});
```

### فاکتورها
```javascript
CRMComponents.showEmptyState('#invoices', {
  icon: '🧾',
  title: 'فاکتوری صادر نشده',
  description: 'اولین فاکتور خود را صادر کنید.',
  actionText: '🧾 صدور فاکتور',
  actionCallback: openNewInvoiceForm
});
```

### مکاتبات
```javascript
CRMComponents.showEmptyState('#letters', {
  icon: '✉️',
  title: 'نامه‌ای ثبت نشده',
  description: 'اولین نامه خود را ایجاد کنید یا از قالب‌های آماده استفاده کنید.',
  actionText: '✉️ ایجاد نامه',
  actionCallback: openNewLetterForm
});
```

### گزارشات
```javascript
CRMComponents.showEmptyState('#reports', {
  icon: '📈',
  title: 'گزارشی موجود نیست',
  description: 'با تغییر فیلترها، گزارش‌های متفاوتی دریافت کنید.',
  actionText: '🔄 پاک کردن فیلترها',
  actionCallback: clearFilters
});
```

---

## 🎯 Best Practices

### 1. همیشه Empty State نمایش دهید
وقتی داده‌ای وجود ندارد، حتماً empty state نمایش دهید تا کاربر بداند چه کار کند.

### 2. از Skeleton به جای Spinner استفاده کنید
Skeleton loading تجربه کاربری بهتری دارد.

### 3. Confirmation Dialog برای عملیات مهم
برای حذف، ارسال، و عملیات غیرقابل بازگشت حتماً confirmation dialog نمایش دهید.

### 4. Toast برای بازخورد فوری
برای هر عملیات (موفق/ناموفق) toast نمایش دهید.

### 5. Keyboard Shortcuts برای کاربران حرفه‌ای
Keyboard shortcuts را برای عملیات پرکاربرد ثبت کنید.

### 6. Accessibility
از `aria-live` و screen reader announcements استفاده کنید.

---

## 📊 آمار استفاده

تاکنون در فایل‌های زیر استفاده شده:
- ✅ letters.js (مکاتبات)
- ✅ petty.js (هاب مالی)
- ✅ rfqsmart.js (درخواست تامین)

---

## 🚀 آینده

### Phase 9: Apply to All Sections
- اضافه کردن به تمام 29 بخش
- جایگزینی تمام empty states ساده

### Phase 10: Advanced Features
- Drag & drop
- Gesture support
- Offline support
- Push notifications

---

**تهیه شده توسط:** Arena.ai Agent  
**بر اساس:** UX/UI Pro Max Skill  
**تاریخ:** 2026-11-04

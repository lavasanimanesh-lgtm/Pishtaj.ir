# 📦 داده تست برای v20.9 (US-411 Phase 1A)

## داده پیشنهادی (۶ مشتری)

این داده را قبل از شروع تست در کنسول مرورگر وارد کنید (بعد از ورود به CRM):

```javascript
// پاک کردن داده قبلی (اختیاری — فقط در محیط تست)
localStorage.removeItem('ptf_crm_customers');

// تنظیم داده تست
const testData = [
  { cd: 'C-1001', co: 'پتروشیمی الف',    crBy: 'ali' },
  { cd: 'C-1002', co: 'فولاد ب',         crBy: 'sara' },
  { cd: 'C-1003', co: 'نیروگاه ج',       crBy: 'ali' },
  { cd: 'C-1004', co: 'سیمان د' },                          // قدیمی (بدون crBy)
  { cd: 'C-1005', co: 'پالایشگاه ه',     crBy: 'mohammad' },
  { cd: 'C-1006', co: 'معدن و',          crBy: 'admin' }
];
localStorage.setItem('ptf_crm_customers', JSON.stringify(testData));
console.log('✅ داده تست بارگذاری شد: 6 مشتری');

// reload برای اعمال
location.reload();
```

## داده برای تست چابکی (۱۰۰ مشتری)

```javascript
// بعد از تست سناریو ۹
const bigData = Array.from({length:100}, (_,i) => ({
  cd: 'C-' + (2000 + i),
  co: 'مشتری تست ' + i,
  crBy: ['ali', 'sara', 'mohammad', 'admin', 'newuser'][i % 5]
}));
// + 10 رکورد قدیمی (بدون crBy)
for (let i = 0; i < 10; i++) {
  bigData.push({
    cd: 'C-LEG-' + i,
    co: 'قدیمی ' + i
  });
}
localStorage.setItem('ptf_crm_customers', JSON.stringify(bigData));
console.log('✅ داده بزرگ بارگذاری شد: 110 مشتری (100 با crBy + 10 قدیمی)');
location.reload();
```

## حساب‌های تست (نقش‌ها)

اگر حساب‌های زیر در سیستم موجود نیست، از admin ایجاد کنید:

| username | نقش (roleId) | نام |
|----------|--------------|-----|
| `admin` | admin | مدیر ارشد (سیستم) |
| `ali` | sales | علی محمدی (فروشنده) |
| `sara` | sales | سارا احمدی (فروشنده) |
| `mohammad` | sales | محمدرضا کریمی (فروشنده) |
| `newuser` | sales | کاربر جدید (تازه ایجاد شده) |
| `chairman1` | chairman | رییس هیات مدیره (تست) |
| `ceo1` | ceo | مدیرعامل (تست) |
| `commercial1` | commercial | مدیر بازرگانی (تست) |

## نکات مهم

1. **اول کار تست**: localStorage را با داده فوق پر کنید
2. **state پیش‌فرض**: `ptf_my_cust_filter='mine'` (هنگام اولین ورود)
3. **پاک کردن state**: `localStorage.removeItem('ptf_my_cust_filter')` → رفرش
4. **ریست کامل داده تست**: `localStorage.clear(); location.reload()`

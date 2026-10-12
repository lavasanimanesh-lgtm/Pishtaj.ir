#  گزارش بررسی مشکل دسترسی‌ها و دوره‌های تنخواه در CRM
**تاریخ بررسی:** ۰۲۶-۱۰-۱۲

---

##  مشکل گزارش‌شده

کاربر گزارش داده:
1. **دوره تنخواه ارجاع‌شده به حسابدار دیده نمی‌شود** وقتی حسابدار وارد می‌شود
2. **فاکتورهای فروش به‌عنوان "یافته بدون پرونده فروش" نمایش داده می‌شوند** در حساب حسابدار
3. **احتمالاً با حذف دسترسی‌ها این اتفاق افتاده است**
4. **نیاز به سیستم انعطاف‌پذیر برای کاربران جدید با سطوح دسترسی مختلف** (کارشناس فروش، etc.)

---

## 🔍 تحلیل ریشه‌ای

### ۱. مشکل دوره‌های تنخواه

#### کد فعلی (`petty.js` خط ۱۲۲):
```javascript
function renderPeriods() {
  var el = document.getElementById('ptPeriods');
  if (!el) return;
  var periods = prAll().slice(0, 8); // فقط ۸ دورهٔ اول!
  if (!periods.length && !isTreasurer() && !isAccountant()) {
    el.innerHTML = '';
    return;
  }
  // ... رندر دوره‌ها
}
```

#### مشکل شناسایی‌شده:

**مشکل ۱: محدودیت ۸ دوره**
- فقط ۸ دورهٔ اول (جدیدترین‌ها) نمایش داده می‌شوند
- اگر بیش از ۸ دوره وجود داشته باشد، بقیه مخفی می‌مانند
- حسابدار ممکن است دورهٔ ارجاع‌شده را نبیند اگر در ۸ تای اول نباشد

**مشکل : عدم فیلتر بر اساس وضعیت**
- همه دوره‌ها (regardless of status) نمایش داده می‌شوند
- هیچ فیلتری برای "فقط دوره‌های ارجاع‌شده به من" وجود ندارد
- حسابدار باید بتواند دوره‌های `st === 'referred'` را ببیند

**مشکل : عدم نگاشت به کاربر**
- دوره‌ها `by` field دارند (ثبت‌کننده) اما `assignedTo` ندارند
- وقتی تنخواه‌گردان ارجاع می‌دهد، مشخص نمی‌کند به کدام حسابدار
- حسابدار نمی‌داند کدام دوره‌ها به او ارجاع شده‌اند

### ۲. مشکل فاکتورهای "بدون پرونده فروش"

#### ساختار داده:

فاکتورهای فروش در `ptf_crm_offers` ذخیره می‌شوند با فیلدهای:
- `cd`: کد پیشنهاد
- `no`: شماره پیشنهاد
- `custCd`: کد مشتری
- `owner`: کارشناس مسئول (مالک پورسانت)
- `crBy`: ثبت‌کننده

#### مشکل شناسایی‌شده:

**"یافته بدون پرونده فروش" یعنی:**
- فاکتور ثبت شده اما به `deal` (پرونده فروش) متصل نیست
- یا `owner` فاکتور با کاربر فعلی مطابقت ندارد
- یا فاکتور در بازهٔ دید کاربر نیست

**علت احتمالی:**
1. فاکتور توسط کارشناس فروش A ثبت شده
2. دسترسی A حذف یا تغییر کرده
3. حسابدار فاکتور را می‌بیند اما `owner` آن A است (که دیگر دسترسی ندارد)
4. سیستم نمی‌تواند فاکتور را به پرونده فروش متصل کند → "بدون پرونده"

---

## ️ معماری فعلی سیستم دسترسی

### نقش‌های تعریف‌شده (`rbac.js`):

| نقش | دسترسی به تنخواه | دسترسی به فاکتور | ledgerScope |
|-----|-----------------|-----------------|-------------|
| admin/chairman/ceo/commercial |  بله |  بله | all |
| sales |  خیر |  بله (فقط فروش) | none |
| buyer |  خیر |  خیر | none |
| **accountant** |  **بله** |  **بله** | **official** |
| collector |  خیر |  بله (مطالبات) | all |

### سیستم override (`perms.js`):

```javascript
window.ptfCanAccess = function (panelId) {
  var s = curSession();
  var ov = permOverride(s.user, panelId);
  if (ov === 'allow') return true;
  if (ov === 'deny') return false;
  // پیش‌فرض نقش
  var r = roleDef();
  if (panelId === 'petty') return true; // همه به تنخواه دسترسی دارند!
  // ...
};
```

**نکته مهم:** `panelId === 'petty'` همیشه `true` برمی‌گرداند! یعنی همه به پنل تنخواه دسترسی دارند، اما **دید داخل پنل** بر اساس نقش کنترل می‌شود.

---

##  راهکارهای پیشنهادی

### راهکار ۱: بهبود نمایش دوره‌های تنخواه

#### الف) حذف محدودیت  دوره

**فایل:** `petty.js` خط ۱۲

**تغییر:**
```javascript
// قبلی:
var periods = prAll().slice(0, 8);

// جدید:
var periods = prAll(); // همه دوره‌ها
// یا با صفحه‌بندی:
var periods = prAll().slice(0, 50); // ۵۰ دوره با صفحه‌بندی
```

#### ب) فیلتر بر اساس نقش

```javascript
function renderPeriods() {
  var el = document.getElementById('ptPeriods');
  if (!el) return;
  var periods = prAll();
  var role = curRole();
  
  // فیلتر بر اساس نقش
  if (role === 'accountant') {
    // حسابدار فقط دوره‌های ارجاع‌شده را ببیند
    periods = periods.filter(function(p) { 
      return p.st === 'referred' || p.st === 'registered'; 
    });
  } else if (role === 'sales' || role === 'buyer') {
    // کارشناس فروش/خرید فقط دوره‌های خود را ببیند
    var me = curSession();
    periods = periods.filter(function(p) { 
      return p.by === me.name; 
    });
  }
  
  // مرتب‌سازی: جدیدترین اول
  periods.sort(function(a, b) { 
    return (b.iso || '').localeCompare(a.iso || ''); 
  });
  
  // صفحه‌بندی
  periods = periods.slice(0, 50);
  
  // رندر
  // ...
}
```

#### ج) اضافه کردن فیلد `assignedTo`

**در `pettyClosePeriod`:**
```javascript
var rec = { 
  cd: genCode('PPR'), 
  from: from, 
  to: to, 
  st: 'referred', 
  by: userName(),
  assignedTo: selectedAccountant, // حسابدار انتخابی
  t: faDateTime(), 
  // ...
};
```

**UI جدید:**
```javascript
fields: [
  // ...
  { 
    id: 'accountant', 
    label: 'ارجاع به حسابدار', 
    type: 'select',
    options: accountants().map(function(u) { 
      return { v: u.username, lb: u.name }; 
    })
  }
]
```

---

### راهکار : بهبود مدیریت فاکتورهای "بدون پرونده"

#### الف) نرمال‌سازی `owner` هنگام تغییر دسترسی

**وقتی دسترسی کاربر حذف می‌شود:**
```javascript
function onUserAccessRemoved(username) {
  // ۱. یافتن همه فاکتورهای متعلق به این کاربر
  var offers = getData('ptf_crm_offers');
  var affected = offers.filter(function(o) { 
    return o.owner === username || o.crBy === username; 
  });
  
  // ۲. انتقال مالکیت به مدیر یا بدون مالک
  affected.forEach(function(o) {
    o.owner = ''; // یا o.owner = 'admin';
    o.transferReason = 'دسترسی کاربر حذف شد: ' + username;
    o.transferDate = isoNow();
  });
  
  // ۳. ذخیره
  setData('ptf_crm_offers', offers);
  
  // ۴. ثبت در audit
  audit('فاکتورها', 'انتقال ' + affected.length + ' فاکتور از کاربر ' + username, 'system');
}
```

#### ب) بهبود نمایش "بدون پرونده"

**فایل:** `official-invoice-v2.js`

**تغییر:** به‌جای نمایش "بدون پرونده"، لینک به ایجاد پرونده جدید بده:

```javascript
var orphanHtml = orphans.map(function(i) {
  return '<div style="...">' +
    '<span>فاکتور ' + escP(i.no) + ' — ' + money(i.total) + '</span>' +
    '<button onclick="linkToNewDeal(\\'' + i.cd + '\\')">اتصال به پرونده جدید</button>' +
    '<button onclick="linkToExistingDeal(\\'' + i.cd + '\\')">اتصال به پرونده موجود</button>' +
  '</div>';
}).join('');
```

---

### راهکار ۳: سیستم دسترسی انعطاف‌پذیر برای کاربران جدید

#### الف) تعریف نقش‌های جدید

**فایل:** `rbac.js`

```javascript
var ROLES = {
  // ... نقش‌های موجود
  salesSenior: { 
    lb: 'کارشناس ارشد فروش',
    users: false,
    panels: ['dash','rfq','cust','leads','rem','prod','surplus','off','cart','inqs','deals','ai','fin'],
    buyPrice: false, 
    sellPrice: true,
    finance: false,
    ledgerScope: 'none',
    canApprove: true, // می‌تواند فاکتورهای زیر ۱۰۰M تأیید کند
    canTransfer: true  // می‌تواند مالکیت فاکتور را منتقل کند
  },
  salesJunior: {
    lb: 'کارشناس فروش (جدید)',
    users: false,
    panels: ['dash','rfq','cust','leads','rem','prod','off','cart','ai'],
    buyPrice: false,
    sellPrice: true,
    finance: false,
    ledgerScope: 'none',
    canApprove: false,
    canTransfer: false,
    maxDealValue: 50000000 // سقف ۵۰ میلیون
  },
  accountantSenior: {
    lb: 'حسابدار ارشد',
    users: false,
    panels: ['inv','recv','petty','chqprint','cart','ai','taxret','rep'],
    buyPrice: false,
    sellPrice: false,
    finance: true,
    ledgerScope: 'official',
    canClosePeriod: true, // می‌تواند دوره تنخواه را ببندد
    canApproveInvoice: true
  }
};
```

#### ب) سیستم "دید بر اساس مالکیت"

**برای کارشناسان فروش:**
```javascript
function canSeeOffer(offer) {
  var role = curRole();
  var me = curSession();
  
  // مدیران همه را می‌بینند
  if (['admin','chairman','ceo','commercial'].indexOf(role) > -1) return true;
  
  // حسابدار همه فاکتورهای رسمی را می‌بیند
  if (role === 'accountant' && !offer.isUnofficial) return true;
  
  // کارشناس فروش فقط مال خود را می‌بیند
  if (role === 'sales' || role === 'salesSenior' || role === 'salesJunior') {
    return offer.owner === me.user || offer.crBy === me.user;
  }
  
  // خرید فقط فاکتورهای خرید را می‌بیند
  if (role === 'buyer') {
    return offer.type === 'buy';
  }
  
  return false;
}
```

#### ج) سیستم "انتقال مالکیت" هنگام حذف دسترسی

**فایل:** `rbac.js` یا `perms.js`

```javascript
window.removeUserAccess = function(username) {
  // ۱. حذف override
  var perms = permsAll();
  if (perms[username]) {
    delete perms[username];
    permsSave(perms);
  }
  
  // ۲. انتقال مالکیت فاکتورها
  transferOffersFromUser(username);
  
  // . انتقال مالکیت مشتریان
  transferCustomersFromUser(username);
  
  // ۴. ثبت در audit
  audit('دسترسی', 'حذف دسترسی کاربر ' + username + ' و انتقال مالکیت‌ها', username);
  
  // ۵. رفرش UI
  if (typeof renderUsers === 'function') renderUsers();
};

function transferOffersFromUser(username) {
  var offers = getData('ptf_crm_offers');
  var admin = 'admin'; // یا کاربر مدیر انتخابی
  var transferred = 0;
  
  offers.forEach(function(o) {
    if (o.owner === username || o.crBy === username) {
      o.previousOwner = o.owner;
      o.owner = admin;
      o.transferReason = 'حذف دسترسی کاربر: ' + username;
      o.transferDate = isoNow();
      transferred++;
    }
  });
  
  if (transferred > 0) {
    setData('ptf_crm_offers', offers);
    ptfToast(transferred + ' فاکتور به مدیر منتقل شد', 'info');
  }
}

function transferCustomersFromUser(username) {
  var customers = getData('ptf_crm_customers');
  var admin = 'admin';
  var transferred = 0;
  
  customers.forEach(function(c) {
    if (c.owner === username || c.crBy === username) {
      c.previousOwner = c.owner;
      c.owner = admin;
      c.transferReason = 'حذف دسترسی کاربر: ' + username;
      c.transferDate = isoNow();
      transferred++;
    }
  });
  
  if (transferred > 0) {
    setData('ptf_crm_customers', customers);
    ptfToast(transferred + ' مشتری به مدیر منتقل شد', 'info');
  }
}
```

---

##  اولویت‌بندی اقدامات

### فوری (هفته اول):
1. **رفع محدودیت  دوره در `petty.js`** → ساده، تأثیر بالا
2. **اضافه کردن فیلتر نقش در `renderPeriods`** → حسابدار فقط دوره‌های ارجاع‌شده را ببیند

### میان‌مدت (ماه اول):
3. **اضافه کردن فیلد `assignedTo` به دوره‌های تنخواه** → نیاز به migration داده
4. **سیستم انتقال مالکیت هنگام حذف دسترسی** → جلوگیری از "فاکتور بدون پرونده"
5. **بهبود UI "بدون پرونده"** → لینک به ایجاد/اتصال پرونده

### بلندمدت (ماه ۲-۳):
6. **تعریف نقش‌های جدید** (salesSenior, salesJunior, accountantSenior)
7. **سیستم "دید بر اساس مالکیت"** برای کارشناسان فروش
8. **داشبورد مدیریتی برای انتقال مالکیت**

---

##  مراحل بعدی

### برای رفع فوری مشکل حسابدار:

1. **تست:** وارد حساب حسابدار شوید و بررسی کنید:
   - آیا دوره‌های تنخواه نمایش داده می‌شوند؟
   - آیا فاکتورها به‌عنوان "بدون پرونده" نمایش داده می‌شوند؟

2. **اگر دوره‌ها نمایش داده نمی‌شوند:**
   - در `petty.js` خط ۱۲، `slice(0, 8)` را به `slice(0, 50)` تغییر دهید
   - فیلتر نقش اضافه کنید (فقط `referred` و `registered`)

3. **اگر فاکتورها "بدون پرونده" هستند:**
   - بررسی کنید `owner` فاکتورها چیست
   - اگر `owner` کاربر حذف‌شده است، به `admin` تغییر دهید
   - یا از UI "اتصال به پرونده" استفاده کنید

---

##  خلاصه

**علت اصلی مشکلات:**

1. **دوره‌های تنخواه:** محدودیت ۸ دوره + عدم فیلتر بر اساس نقش
2. **فاکتورهای بدون پرونده:** حذف دسترسی کاربر بدون انتقال مالکیت فاکتورها

**راهکار دائمی:**

1. سیستم انتقال خودکار مالکیت هنگام حذف دسترسی
2. فیلترهای هوشمند بر اساس نقش
3. نقش‌های جدید با سطوح دسترسی مختلف
4. UI بهتر برای مدیریت فاکتورهای "بدون پرونده"

**آیا این راهکارها نیاز به تغییر کد دارند؟**

**بله،** اما تغییرات تدریجی و قابل rollback هستند. پیشنهاد می‌کنم با رفع فوری (محدودیت ۸ دوره) شروع کنیم و سپس به سراغ راهکارهای بلندمدت برویم.

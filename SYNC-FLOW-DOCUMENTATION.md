# مستند فنی: مسیر کامل Sync و Source of Truth

**تاریخ:** 2026-07-19  
**نسخه مورد بررسی:** v31.7.4  
**هدف:** تشخیص Root Cause مشکل divergence بین Deviceها

---

## ۱. Source of Truth

### معماری فعلی: **Server-First با Dirty Blocking Pull**

- **Server** = Source of Truth نهایی
- **localStorage** = Cache محلی
- اما: **اگر کلید `dirty` باشد، pull از سرور رد می‌شود!**

این یک تضاد در معماری است - سرور source of truth است ولی dirty keys آن را block می‌کنند.

---

## ۲. مسیر کامل Sync (Flow Diagram)

### ۲.۱ مسیر Push (Local → Server)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. تغییر داده در UI                                         │
│    ↓                                                        │
│ 2. window.setData(key, data) [در index.html]               │
│    ↓                                                        │
│ 3. Override در sync.js:                                     │
│    if (SYNC_KEYS.indexOf(k) > -1 && !state.pulling) {     │
│      state.dirty[k] = true;     // ⚠️ flag dirty           │
│      schedulePush();                                         │
│    }                                                        │
│    ↓                                                        │
│ 4. schedulePush():                                          │
│    - اگر کلید urgent: 500ms debounce                       │
│    - در غیر این صورت: 4000ms debounce                       │
│    ↓                                                        │
│ 5. pushDirty():                                             │
│    - اگر !bootstrapped → schedulePush() و return            │
│    - اگر !hasSyncToken() → badge warn و return              │
│    - guard: اگر کلید حیاتی خالی است → alert و return        │
│    ↓                                                        │
│ 6. POST /api/crm.php?action=data_push                       │
│    Headers: X-CRM-Token, X-CRM-Role, Content-Type           │
│    Body: { by, data, base }                                 │
│    ↓                                                        │
│ 7. Server:                                                  │
│    - validate token                                         │
│    - role authorization (sync_write)                        │
│    - role-based key filtering                               │
│    - base revision check → conflict detection               │
│    - write to crm/data/sync/{key}.json                     │
│    - update meta.json                                       │
│    ↓                                                        │
│ 8. Response:                                                │
│    { ok, saved, rev, conflicts, krevs, forbidden }         │
│    ↓                                                        │
│ 9. Client:                                                  │
│    - اگر ok: apply krevs، delete dirty[k]                  │
│    - اگر conflict: ptfSmartMerge → push مجدد              │
│    - اگر forbidden: badge warn                             │
│    - اگر !ok: pushDirty() مجدد                             │
└─────────────────────────────────────────────────────────────┘
```

### ۲.۲ مسیر Pull (Server → Local)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. setInterval(pullCheck, 20000) - هر 20 ثانیه            │
│    ↓                                                        │
│ 2. pullCheck():                                             │
│    - اگر !user یا state.pushing → return                    │
│    - اگر dirty keys وجود دارد:                              │
│        pushDirty();                                         │
│        return;    // ⚠️ Pull انجام نمی‌شود!                │
│    - اگر !hasSyncToken() → retryPullAfterAuth               │
│    ↓                                                        │
│ 3. GET /api/crm.php?action=data_pull&since={lastRev}        │
│    ↓                                                        │
│ 4. Server:                                                  │
│    - اگر since >= globalRev → { ok, rev, fresh: true }    │
│    - در غیر این صورت: داده‌های changed keys               │
│    ↓                                                        │
│ 5. Client: برای هر key در response:                         │
│    - اگر curStr === newStr → skip                           │
│    - اگر forceFull && initialReconcile → ptfSmartMerge     │
│    - ⚠️ اگر state.dirty[k]:                                 │
│        اگر ptfSmartMerge موجود: merge (ولی return!)         │
│        در غیر این صورت: return (کاملاً رد می‌شود!)        │
│    - اگر dirty نباشد: localStorage.setItem(k, newStr)      │
│    ↓                                                        │
│ 6. setRev(d.rev) - به‌روزرسانی global rev                  │
│ 7. applyKrevs() - به‌روزرسانی key revs                     │
│ 8. refreshCurrentPanel() - رندر مجدد                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ۳. Root Cause شناسایی شده

### 🔴 مشکل اصلی: Dirty Blocking Pull

**موقعیت:** `crm/sync.js` در تابع `pullCheck`

```javascript
// خط ۳۲۷ (در sync.js v31.7.4)
if (state.dirty[k]) return;
```

**اثر:**
- اگر یک کلید dirty باشد، pull آن کلید **هرگز** انجام نمی‌شود
- dirty می‌ماند تا push موفق شود
- اگر push برای مدت طولانی fail شود، device هرگز pull نمی‌کند
- device‌های دیگر تغییر می‌کنند ولی device اول divergence می‌کند

### 🟠 Push Before Pull Block

```javascript
if (!forceFull && state.bootstrapped && Object.keys(state.dirty).length) { 
  pushDirty(); 
  if (done) done(); 
  return;  // ⚠️ pull انجام نمی‌شود!
}
```

اگر dirty keys وجود داشته باشد، pullCheck فقط push می‌کند و pull نمی‌کند.

### 🟡 Smart Merge Return زودهنگام

```javascript
if (state.dirty[k] && typeof window.ptfSmartMerge === 'function') {
  try {
    var merged = window.ptfSmartMerge(k, curStr, newStr);
    // ...
  } catch(e) {}
  return;  // ⚠️ بعد از merge، return!
}
```

اگر ptfSmartMerge خطا بدهد، pull کاملاً رد می‌شود.

---

## ۴. بررسی Update vs Insert

### آیا Update‌ها واقعاً وارد Queue Sync می‌شوند؟

**بله، اما در سطح کلید، نه رکورد:**

```javascript
window.setData = function (k, d) {
  _setData(k, d);
  if (SYNC_KEYS.indexOf(k) > -1 && !state.pulling) {
    state.dirty[k] = true;  // ⚠️ کل کلید dirty می‌شود، نه رکورد خاص
    schedulePush();
  }
};
```

**نتیجه:**
- Insert = push همه رکوردهای کلید (شامل رکورد جدید)
- Update = push همه رکوردهای کلید (شامل رکورد ویرایش‌شده)
- Delete = push همه رکوردهای کلید (به جز رکورد حذف‌شده)

---

## ۵. مکانیزم Conflict Resolution

### در Server (data_push):
```php
$curRev = (int)($meta[$k]['rev'] ?? 0);
if ($base[$k] < $curRev) {
    // Conflict! دستگاه دیگری زودتر نوشته
    $conflicts[] = $k;
    $conflictData[$k] = file_get_contents($sdir . '/' . $k . '.json');
    continue;
}
file_put_contents($sdir . '/' . $k . '.json', $v, LOCK_EX);
```

### در Client (ptfSmartMerge):
```javascript
// merge بر اساس id field (cd, no, id, code)
// اگر رکورد فقط در یکی باشد: preserve
// اگر در هر دو باشد: timestamp جدیدتر برنده
// ⚠️ اگر timestamp نداشته باشد: local برنده!
```

---

## ۶. نتیجه‌گیری

**Root Cause اصلی:**

معماری فعلی sync دارای یک باگ طراحی است:

> **اگر یک کلید dirty باشد، pull آن کلید هرگز انجام نمی‌شود.**

این باگ در سناریوهای زیر divergence ایجاد می‌کند:
1. Network timeout هنگام push
2. Token expiry هنگام sync
3. Race condition بین push و pull
4. Push fail برای هر دلیل

**توصیه برای رفع:**

اصلاح `pullCheck` برای:
1. merge حتی وقتی dirty است (با ptfSmartMerge)
2. حذف dirty flag بعد از merge موفق
3. pull جداگانه برای رکوردهای dirty و non-dirty

**تغییر timing لازم نیست** - مشکل در منطق pull است، نه فرکانس.

---

*پایان مستند*

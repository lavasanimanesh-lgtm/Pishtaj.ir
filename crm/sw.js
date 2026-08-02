/* PTF CRM — Service Worker (US-112) — Sprint 69 */
var CACHE = 'ptf-crm-v33.21.1';
var SHELL = [
  './index.html',
  './codegen.js', './surplus.js', './sortable.js', './offers.js', './leads.js', './rbac.js', './storage.js', './projects.js',
  './letters.js', './draftx.js', './analyzer.js', './contracts.js', './shell.js', './bridge.js', './reports.js', './backup.js', './sms.js', './rfqsmart.js', './cms.js', './ui-kit.js', './moneyx.js', './datex.js', './dedup.js', './perms.js', './petty.js', './opex.js', './shareholders.js', './theme.js', './archive.js', './offers-pro.js', './buycompare.js', './procurement-link.js', './listtools.js', './icons.js', './guards.js', './tables.js', './inqreader.js', './offerlock.js', './workflow.js', './fx.js', './modalx.js', './iconx.js', './salesfiles.js', './docsx.js', './oppo.js', './cheque-module.js', './cheque-panel.js', './cheque-print.js', './cheques.js', './messengers.js', './phonefmt.js', './tour.js', './golive.js', './custmerge.js', './listclean.js', './insights.js', './myday.js', './lossguard.js', './fiscal.js', './financehub.js', './data-quality.js', './official-ledger.js', './ledger-report.js', './dialogx.js', './kanban.js', './supspec.js', './scoring.js', './supplier-finance.js', './customer-finance.js', './working-capital.js', './commission.js', './my-customers-filter.js', './ai-workbench.js', './mobilenav.js', './launcher.js', './theme-contrast.js', './sync.js', './xlsx.min.js',
  './manifest.json',
  '../assets/images/favicon/favicon-192.png',
  '../assets/images/favicon/favicon-512.png',
  '../assets/images/ptf-logo.png',
  '../assets/images/ptf-logo-full.png',
  '../assets/fonts/Vazirmatn-Regular.woff2',
  '../assets/fonts/Vazirmatn-Bold.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll با تحمل خطا: اگر یک فایل نبود، کل نصب شکست نخورد
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // API ها: Network-First (داده تازه)؛ استاتیک: Cache-First
  if (url.pathname.indexOf('/api/') > -1) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return new Response(JSON.stringify({ ok: false, offline: true }), { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }
  // v78.1: صفحه اصلی CRM و اسکریپت‌های آن → Network-First
  // (رفع باگ: فایرفاکس نسخه قدیمی صفحه ورود را از کش می‌داد و منطق «کاربران سروری» اجرا نمی‌شد)
  var isShell = e.request.mode === 'navigate' ||
    /\/crm\/(index\.html)?$/.test(url.pathname) ||
    /\/crm\/[a-z-]+\.js$/.test(url.pathname);
  if (isShell) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.status === 200 && url.origin === location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // به‌روزرسانی در پس‌زمینه (stale-while-revalidate)
        fetch(e.request).then(function (res) {
          if (res && res.status === 200) caches.open(CACHE).then(function (c) { c.put(e.request, res); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && url.origin === location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});


self.addEventListener('message', function (event) {
  if (event.data && event.data.action === 'purge_old_cache') {
    var keepName = event.data.currentVersion || CACHE_NAME;
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== keepName && k.indexOf('ptf-crm-v') === 0) {
          return caches.delete(k);
        }
      }));
    });
  }
});

/* PTF CRM — Service Worker (MOB-009 release cache contract) */
/* `RELEASE` باید با window.PTF_CRM_RELEASE، VERSION.json و query تمام scriptها یکی باشد. */
var RELEASE = 'v34.4.4';
var ASSET_VERSION = '34.4.4';
var CACHE = 'ptf-crm-' + RELEASE;
var ASSET_QUERY = '?v=' + ASSET_VERSION;

/* همهٔ entryهای JS دقیقاً با URLهای queryدار index.html precache می‌شوند؛
   بنابراین fallback آفلاین به cache key بی‌ربط بدون query نمی‌افتد. */
var SHELL = [
  './index.html',
  './manifest.json' + ASSET_QUERY,
  './ui-kit.js' + ASSET_QUERY,
  './mobilenav.js' + ASSET_QUERY,
  './storage-quota.js' + ASSET_QUERY,
  './moneyx.js' + ASSET_QUERY,
  './finance-helpers.js' + ASSET_QUERY,
  './finance-core.js' + ASSET_QUERY,
  './date-kit.js' + ASSET_QUERY,
  './dialogx.js' + ASSET_QUERY,
  './dedup.js' + ASSET_QUERY,
  './codegen.js' + ASSET_QUERY,
  './xlsx.min.js' + ASSET_QUERY,
  './sortable.js' + ASSET_QUERY,
  './offers.js' + ASSET_QUERY,
  './surplus.js' + ASSET_QUERY,
  './launcher.js' + ASSET_QUERY,
  './leads.js' + ASSET_QUERY,
  './storage.js' + ASSET_QUERY,
  './rbac.js' + ASSET_QUERY,
  './official-ledger.js' + ASSET_QUERY,
  './projects.js' + ASSET_QUERY,
  './letters.js' + ASSET_QUERY,
  './draftx.js' + ASSET_QUERY,
  './analyzer.js' + ASSET_QUERY,
  './contracts.js' + ASSET_QUERY,
  './shell.js' + ASSET_QUERY,
  './bridge.js' + ASSET_QUERY,
  './kanban.js' + ASSET_QUERY,
  './reports.js' + ASSET_QUERY,
  './backup.js' + ASSET_QUERY,
  './tool-licenses.js' + ASSET_QUERY,
  './tool-report-drafts.js' + ASSET_QUERY,
  './tool-feedback.js' + ASSET_QUERY,
  './sms.js' + ASSET_QUERY,
  './rfqsmart.js' + ASSET_QUERY,
  './cms.js' + ASSET_QUERY,
  './perms.js' + ASSET_QUERY,
  './petty.js' + ASSET_QUERY,
  './opex.js' + ASSET_QUERY,
  './shareholders.js' + ASSET_QUERY,
  './theme.js' + ASSET_QUERY,
  './archive.js' + ASSET_QUERY,
  './offers-pro.js' + ASSET_QUERY,
  './buycompare.js' + ASSET_QUERY,
  './procurement-link.js' + ASSET_QUERY,
  './listtools.js' + ASSET_QUERY,
  './icons.js' + ASSET_QUERY,
  './guards.js' + ASSET_QUERY,
  './tables.js' + ASSET_QUERY,
  './inqreader.js' + ASSET_QUERY,
  './offerlock.js' + ASSET_QUERY,
  './workflow.js' + ASSET_QUERY,
  './fx.js' + ASSET_QUERY,
  './modalx.js' + ASSET_QUERY,
  './iconx.js' + ASSET_QUERY,
  './salesfiles.js' + ASSET_QUERY,
  './offer-rial-convert.js' + ASSET_QUERY,
  './docsx.js' + ASSET_QUERY,
  './oppo.js' + ASSET_QUERY,
  './cheque-module.js' + ASSET_QUERY,
  './cheque-panel.js' + ASSET_QUERY,
  './cheque-print.js' + ASSET_QUERY,
  './cheques.js' + ASSET_QUERY,
  './messengers.js' + ASSET_QUERY,
  './phonefmt.js' + ASSET_QUERY,
  './tour.js' + ASSET_QUERY,
  './ai-workbench.js' + ASSET_QUERY,
  './golive.js' + ASSET_QUERY,
  './custmerge.js' + ASSET_QUERY,
  './listclean.js' + ASSET_QUERY,
  './supspec.js' + ASSET_QUERY,
  './scoring.js' + ASSET_QUERY,
  './supplier-finance.js' + ASSET_QUERY,
  './customer-finance.js' + ASSET_QUERY,
  './working-capital.js' + ASSET_QUERY,
  './ledger-report.js' + ASSET_QUERY,
  './data-quality.js' + ASSET_QUERY,
  './commission.js' + ASSET_QUERY,
  './my-customers-filter.js' + ASSET_QUERY,
  './insights.js' + ASSET_QUERY,
  './myday.js' + ASSET_QUERY,
  './lossguard.js' + ASSET_QUERY,
  './fiscal.js' + ASSET_QUERY,
  './financehub.js' + ASSET_QUERY,
  './theme-contrast.js' + ASSET_QUERY,
  './sync.js' + ASSET_QUERY,
  './client-server.js' + ASSET_QUERY,
  './unofficial-invoice.js' + ASSET_QUERY,
  './settings-accordion.js' + ASSET_QUERY,
  './mobile-actions.js' + ASSET_QUERY,
  './mobile-table-labels.js' + ASSET_QUERY,
  './mobile-nav-state.js' + ASSET_QUERY,
  '../assets/images/favicon/favicon-192.png',
  '../assets/images/favicon/favicon-512.png',
  '../assets/images/ptf-logo.png',
  '../assets/images/ptf-logo-full.png',
  '../assets/fonts/Vazirmatn-Regular.woff2',
  '../assets/fonts/Vazirmatn-Bold.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* یک asset نباید نصب کل shell را متوقف کند؛ در آنلاین بعدی network-first آن را می‌گیرد. */
      return Promise.all(SHELL.map(function (url) { return cache.add(url).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function offlineFallback(request, url) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;
    /* navigation با query (مثلاً ?fresh=) همچنان از index precache شده بالا می‌آید. */
    if (/\/crm\/(index\.html)?$/.test(url.pathname)) {
      return caches.match(new URL('./index.html', self.location.href).href);
    }
    return Response.error();
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (request.method !== 'GET') return;

  /* API همیشه network-first است؛ هنگام آفلاین پاسخ ساخت‌یافته دارد. */
  if (url.pathname.indexOf('/api/') > -1) {
    event.respondWith(
      fetch(request).catch(function () {
        return new Response(JSON.stringify({ ok: false, offline: true }), { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  /* HTML، manifest و JS نسخه‌دار باید ابتدا تازه‌سازی شوند؛ همان request دقیق cache می‌شود. */
  var isShell = request.mode === 'navigate' ||
    /\/crm\/(index\.html)?$/.test(url.pathname) ||
    /\/crm\/[a-z0-9.-]+\.js$/.test(url.pathname) ||
    /\/crm\/manifest\.json$/.test(url.pathname);
  if (isShell) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () { return offlineFallback(request, url); })
    );
    return;
  }

  /* باقی assetها stale-while-revalidate هستند. */
  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) {
        fetch(request).then(function (response) {
          if (response && response.status === 200 && url.origin === self.location.origin) {
            caches.open(CACHE).then(function (cache) { cache.put(request, response); });
          }
        }).catch(function () {});
        return hit;
      }
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data || event.data.action !== 'purge_old_cache') return;
  var requested = event.data.currentVersion || RELEASE;
  var keepName = String(requested).indexOf('ptf-crm-') === 0 ? String(requested) : 'ptf-crm-' + String(requested);
  caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (key) {
      if (key !== keepName && key.indexOf('ptf-crm-') === 0) return caches.delete(key);
    }));
  });
});

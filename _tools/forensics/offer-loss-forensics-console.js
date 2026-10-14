/* ============================================================================
   PTF CRM — OFFER LOSS FORENSICS (Console) — 2026-10-14
   کارآگاهی «پیشنهادهای ۵–۶ روز اخیر از سرور پاک شدهاند و در CRM دیده نمیشوند»
   ----------------------------------------------------------------------------
   نحوهٔ استفاده:
     ۱) CRM را در مرورگر با نقش مدیر/رییس باز کنید (pishtaj.ir/crm/).
     ۲) F12 → Console → کل این فایل را paste کنید و Enter بزنید.
     ۳) چند ثانیه صبر کنید؛ گزارش در کنسول چاپ میشود و فایلی به نام
        offer-loss-report-YYYY-MM-DD.json خودکار دانلود میشود.
     ۴) همان فایل JSON را برگردانید (یا متن کنسول را کپی کنید).
   ----------------------------------------------------------------------------
   ⚠️ فقط خواندنی است: هیچ چیزی روی سرور نوشته/تغییر/حذف نمیشود.
      actionهای بهکاررفته: sync_stats, list_backups, get_backup,
      collection_query (روی ptf_crm_offers و ptf_crm_deleted_archive)
   ============================================================================ */
(async function () {
  'use strict';
  var LOG = function (m, c) { try { console.log('%c[OFFER-LOSS] ' + m, 'color:' + (c || '#0e7490') + ';font-weight:bold'); } catch (e) {} };
  var START = Date.now();

  function token() {
    try { if (typeof window.ptfAuthToken === 'function') return window.ptfAuthToken() || ''; } catch (e) {}
    try { return localStorage.getItem('ptf_crm_token') || ''; } catch (e2) { return ''; }
  }
  function role() {
    try { if (typeof window.curRole === 'function') return window.curRole() || ''; } catch (e) {}
    try { return localStorage.getItem('ptf_crm_token_role') || ''; } catch (e2) { return ''; }
  }
  function base() {
    try { if (window.PTF_API) return window.PTF_API; } catch (e) {}
    return (location.pathname.indexOf('/crm/') > -1) ? '../api/crm.php' : 'api/crm.php';
  }
  function headers() {
    var h = { 'Accept': 'application/json' };
    var t = token(); if (t) h['X-CRM-Token'] = t;
    var r = role(); if (r) h['X-CRM-Role'] = r;
    return h;
  }
  async function api(params) {
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    var res = await fetch(base() + '?' + qs, { headers: headers(), credentials: 'same-origin', cache: 'no-store' });
    var txt = await res.text();
    var j = null;
    try { j = JSON.parse(txt); } catch (e) { return { ok: false, error: 'bad-json(' + res.status + ')', raw: txt.slice(0, 300) }; }
    if (!res.ok && j && j.ok === undefined) { j.ok = false; j.httpStatus = res.status; }
    return j;
  }
  async function queryAll(collection, fields, maxPages) {
    maxPages = maxPages || 40;
    var rows = [], page = 1, pages = 1, total = null;
    while (page <= pages && page <= maxPages) {
      var d = await api({ action: 'collection_query', collection: collection, page: page, pageSize: 100, fields: fields });
      if (!d || !d.ok) return { ok: false, error: (d && (d.error || d.httpStatus)) || 'query-failed', rows: rows, total: total };
      total = d.total; pages = d.pages || 1;
      rows = rows.concat(d.rows || []);
      page++;
    }
    return { ok: true, rows: rows, total: total, pages: pages, truncated: total !== null && rows.length < total };
  }
  function offerNo(o) { return o && o.no !== undefined && o.no !== null ? String(o.no).trim() : ''; }
  function dayOf(o) {
    var v = String((o && (o.dateEn || o.t || o.updatedAtISO || o.date)) || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}/.test(v) ? v : '';
  }
  function toSet(arr) { var s = {}; (arr || []).forEach(function (x) { if (x) s[x] = 1; }); return s; }
  function keys(o) { return Object.keys(o || {}); }

  var report = {
    generatedAt: new Date().toISOString(),
    page: location.href,
    role: role() || '(cookie-session)',
    steps: {}, errors: []
  };

  try {
    /* ---------- ۰) تشخیص «همین دستگاه» ----------
       مکانیزم اصلیِ حادثه این است: دستگاهی که «krevs تازه + دادهٔ کهنه» دارد.
       یعنی نوشتنِ محلیِ کلید پیشنهادها یک‌بار شکست خورده (سقف localStorage /
       آب‌رسانی‌نشدن آینه) ولی watermark همان کلید جلو رفته است. نتیجه: آن دستگاه
       فهرست کهنه را با مهر تازه push می‌کند ⇒ سرور بازنویسی می‌شود.
       این بلوک همان ترکیب را روی دستگاهِ فعلی می‌سنجد. */
    LOG('۰/۵ تشخیص وضعیت همین دستگاه (دادهٔ محلی × watermark)…');
    var ld = { notes: [] };
    try { ld.storageHealth = (typeof window.ptfStorageHealthSync === 'function') ? window.ptfStorageHealthSync() : null; } catch (e0) {}
    try { ld.failedWrites = (typeof window.ptfStorageFailedWrites === 'function') ? window.ptfStorageFailedWrites() : null; } catch (e1) {}
    try { ld.topKeys = (typeof window.ptfStorageTopKeys === 'function') ? (window.ptfStorageTopKeys() || []).slice(0, 10) : null; } catch (e2) {}
    try { ld.mirrorActive = (typeof window.ptfBMirrorActive === 'function') ? !!window.ptfBMirrorActive() : null; } catch (e3) {}
    try { ld.offersIsHeavyKey = (typeof window.ptfBIsHeavyKey === 'function') ? !!window.ptfBIsHeavyKey('ptf_crm_offers') : null; } catch (e4) {}
    try { ld.idbHydrated = window.ptfBIdbHydrated === undefined ? null : !!window.ptfBIdbHydrated; } catch (e5) {}
    try { ld.syncBootstrapped = window._ptfSyncBootstrapped === undefined ? null : !!window._ptfSyncBootstrapped; } catch (e6) {}
    var lk = {};
    try { lk = JSON.parse(localStorage.getItem('ptf_sync_krevs') || '{}') || {}; } catch (e7) {}
    ld.localKrevOffers = +lk['ptf_crm_offers'] || 0;
    ld.localGlobalRev = parseInt(localStorage.getItem('ptf_sync_rev') || '0', 10) || 0;
    try { ld.dirtyKeys = keys(JSON.parse(localStorage.getItem('ptf_sync_dirty') || '{}')); } catch (e8) {}
    try { ld.guardCounts = JSON.parse(localStorage.getItem('ptf_guard_counts') || '{}'); } catch (e9) {}
    try {
      var localRows = (typeof window.getData === 'function') ? window.getData('ptf_crm_offers') : null;
      if (Array.isArray(localRows)) {
        ld.localOffersCount = localRows.length;
        ld.localOffersFullLength = (function () { try { return JSON.stringify(localRows).length; } catch (e10) { return null; } })();
        var lset = {};
        localRows.forEach(function (o) { var n = offerNo(o); if (n) lset[n] = 1; });
        ld.localNosCount = keys(lset).length;
        ld.localNosList = keys(lset);          /* فقط شماره‌ها — برای کراس‌چک با سرور */
        ld.localNewestDay = (function () { var b = ''; localRows.forEach(function (o) { var d = dayOf(o); if (d > b) b = d; }); return b; })();
      }
    } catch (e11) { ld.notes.push('getData در دسترس نبود: ' + e11); }
    report.steps.localDevice = ld;
    if (ld.failedWrites && ld.failedWrites.length) {
      LOG('  ⚠️ ' + ld.failedWrites.length + ' شکستِ نوشتنِ محلی ثبت شده: ' + JSON.stringify(ld.failedWrites.slice(0, 5)), '#b45309');
    }
    if (ld.storageHealth) LOG('  سلامت حافظه: ' + (ld.storageHealth.percent !== undefined ? ld.storageHealth.percent + '٪' : JSON.stringify(ld.storageHealth)));
    if (ld.localOffersCount !== undefined) LOG('  پیشنهاد محلی روی همین دستگاه: ' + ld.localOffersCount + ' | krev محلی: ' + ld.localKrevOffers + ' | rev سراسری محلی: ' + ld.localGlobalRev);

    /* ---------- ۱) تلمتری پوش سرور ---------- */
    LOG('۱/۵ خواندن telemetry پوش (sync_stats)…');
    var st = await api({ action: 'sync_stats' });
    if (st && st.ok) {
      var stats = st.stats || [];
      var offRow = null;
      stats.forEach(function (r) { if (r && r.key === 'ptf_crm_offers') offRow = r; });
      report.steps.syncStats = { offers: offRow || null, top: stats.slice(0, 12), win7From: st.win7From };
      if (offRow) {
        LOG('  کلید پیشنهادها: n=' + offRow.n + ' | conflicts=' + offRow.conflicts + ' | rejects=' + offRow.rejects +
            ' | lastAt=' + (offRow.lastAt || '?') + ' | lastBy=' + (offRow.lastBy || '?'), '#b45309');
      } else { LOG('  ردیف ptf_crm_offers در telemetry نیست (یعنی از زمان v34.8.12 هرگز push شمرده نشده).', '#b45309'); }
    } else { report.errors.push('sync_stats: ' + ((st && st.error) || 'failed')); LOG('  ✖ sync_stats ناموفق: ' + ((st && st.error) || 'failed'), '#b91c1c'); }

    /* ---------- ۱.۵) meta سرور: آخرین نویسندهٔ کلید (شاهد «چه کسی») ----------
       data_manifest کل meta.json را برمی‌گرداند: per-key {rev,t,by}.
       • by === 'sales-domain-v35' ⇒ آخرین نوشتن از مسیر فرمانِ سرور (register_offer/...)
       • هر نام دیگر ⇒ نامِ همان کاربری که آخرین «push کل آرایه» (legacy) را انجام داده
         = نامزدِ اصلی نویسندهٔ نسخهٔ کهنه. */
    LOG('۱.۵/۵ خواندن meta سرور (آخرین نویسندهٔ هر کلید)…');
    try {
      var mf = await api({ action: 'data_manifest' });
      if (mf && mf.ok && mf.meta && typeof mf.meta === 'object') {
        var mm = mf.meta;
        report.steps.serverMeta = { global: mm._global || null, offers: mm.ptf_crm_offers || null, rfqs: mm.ptf_crm_rfqs || null, archive: mm.ptf_crm_deleted_archive || null, all: mm };
        if (mm.ptf_crm_offers) LOG('  آخرین نویسندهٔ کلید پیشنهادها روی سرور: by=' + (mm.ptf_crm_offers.by || '?') + ' @ ' + (mm.ptf_crm_offers.t || '?') + ' (rev ' + mm.ptf_crm_offers.rev + ')', '#b45309');
      } else { report.errors.push('data_manifest: ' + ((mf && mf.error) || 'failed')); }
    } catch (eMf) { report.errors.push('data_manifest exception: ' + eMf); }

    /* ---------- ۲) وضعیت فعلی سرور ---------- */
    LOG('۲/۵ خواندن فهرست فعلیِ پیشنهادهای روی سرور…');
    var cur = await queryAll('ptf_crm_offers', 'no,kind,st,t,dateEn,updatedAtISO,inqNo,rialOf,fxOf,srcToNo,buyerCo');
    if (!cur.ok) throw new Error('collection_query ptf_crm_offers: ' + cur.error);
    var curNos = {};
    cur.rows.forEach(function (o) { var n = offerNo(o); if (n) curNos[n] = o; });
    var curList = keys(curNos);
    var byDay = {};
    curList.forEach(function (n) { var d = dayOf(curNos[n]) || '?'; byDay[d] = (byDay[d] || 0) + 1; });
    var sortedByDay = keys(byDay).sort();
    report.steps.current = {
      total: cur.total, fetched: cur.rows.length, truncated: !!cur.truncated,
      newestExistingByDate: (function () { var best = ''; curList.forEach(function (n) { var d = dayOf(curNos[n]); if (d && d > best) best = d; }); return best; })(),
      byDay: sortedByDay.map(function (d) { return { day: d, count: byDay[d] }; }).slice(-20),
      sample: curList.slice(0, 5).map(function (n) { return { no: n, day: dayOf(curNos[n]), kind: curNos[n].kind || '' }; })
    };
    LOG('  پیشنهاد روی سرور: ' + cur.total + ' ردیف | جدیدترین روزِ موجود: ' + report.steps.current.newestExistingByDate, '#0f766e');

    /* ---------- ۲.۵) حکمِ ترکیبیِ «دستگاه فعلی در برابر سرور» ----------
       اگر تعداد محلی از سرور کمتر باشد و در همان حال krev محلی >= rev سرور باشد،
       این دستگاه دقیقاً همان «krevs تازه + دادهٔ کهنه» است که در حادثه نقش نویسنده
       را دارد: هر نوشتنِ بعدی روی پیشنهادها، فهرست کهنه را جایگزین سرور می‌کند. */
    try {
      var ld2 = report.steps.localDevice || {};
      var srvMeta = (report.steps.serverMeta || {}).offers || null;
      var verdict = { localCount: ld2.localOffersCount === undefined ? null : ld2.localOffersCount, serverCount: cur.total, flags: [] };
      if (srvMeta) { verdict.serverRev = srvMeta.rev; verdict.serverLastBy = srvMeta.by; verdict.serverLastAt = srvMeta.t; }
      verdict.localKrev = ld2.localKrevOffers || 0;
      if (verdict.localCount !== null && verdict.serverCount !== null && verdict.localCount < verdict.serverCount) {
        verdict.flags.push('local_count_less_than_server:' + (verdict.serverCount - verdict.localCount) + '_rows_missing_locally');
        if (srvMeta && verdict.localKrev >= (+srvMeta.rev || 0)) {
          verdict.flags.push('CRITICAL_fresh_krev_with_stale_data');
          LOG('  🚨 همین دستگاه دادهٔ کهنه دارد ولی watermark آن تازه است — اگر روی پیشنهادها بنویسد، سرور را با نسخهٔ کهنه بازنویسی می‌کند. تا اصلاح، روی این دستگاه «تنظیمات ← وضعیت دستگاه ← دریافت کامل مجدد» بزنید.', '#b91c1c');
        }
      }
      if (ld2.failedWrites && ld2.failedWrites.length) {
        var fw = ld2.failedWrites.filter(function (x) { return x && String(x.key || '').indexOf('ptf_crm_offers') === 0; });
        verdict.flags.push('failed_local_writes_total:' + ld2.failedWrites.length + (fw.length ? ' (شامل پیشنهادها!)' : ''));
        if (fw.length) verdict.flags.push('CRITICAL_offers_write_failed_locally');
      }
      /* کدام ردیف‌ها فقط روی همین دستگاه هستند (کاندید بازیابی) و کدام فقط سرور؟ */
      try {
        if (ld2.localNosList && ld2.localNosList.length) {
          var localOnly = [], serverOnly = 0, lsetObj = {};
          ld2.localNosList.forEach(function (n) { lsetObj[n] = 1; if (!curNos[n]) localOnly.push(n); });
          curList.forEach(function (n) { if (!lsetObj[n]) serverOnly++; });
          verdict.localOnlyCount = localOnly.length;
          verdict.serverOnlyCount = serverOnly;
          verdict.localOnlySample = localOnly.slice(0, 60);
          if (localOnly.length) {
            verdict.flags.push('local_only_rows:' + localOnly.length);
            LOG('  🔎 ' + localOnly.length + ' پیشنهاد فقط روی همین دستگاه هست (روی سرور نیست) — نمونه: ' + localOnly.slice(0, 8).join('، '), '#b45309');
          }
        }
      } catch (eLO) { report.errors.push('localOnly: ' + eLO); }
      report.steps.deviceVerdict = verdict;
      LOG('  حکم دستگاه فعلی: ' + (verdict.flags.length ? verdict.flags.join(' | ') : 'سالم (ناهم‌خوانی محلی/سروری دیده نشد)'), verdict.flags.length ? '#b45309' : '#0f766e');
    } catch (eV) { report.errors.push('device verdict: ' + eV); }

    /* ---------- ۳) آرشیو حذف (سنگقبرها) ---------- */
    LOG('۳/۵ خواندن آرشیو حذف (سطل بازیافت) و فیلترِ ردیفهای مربوط به پیشنهاد…');
    var arc = await queryAll('ptf_crm_deleted_archive', '_id,kind,id,label,reason,by,iso,deletedAt,collection,aliases,identities', 12);
    var offerTomb = [], purgeTomb = [], otherKinds = {};
    if (arc.ok) {
      arc.rows.forEach(function (r) {
        if (!r) return;
        var k = String(r.kind || '').toLowerCase();
        otherKinds[k] = (otherKinds[k] || 0) + 1;
        if (/^(offer|offers|to|co|tc)$/.test(k)) offerTomb.push({ kind: r.kind, id: r.id || '', label: r.label || '', by: r.by || r.deletedBy || '', at: r.iso || r.deletedAt || '', reason: String(r.reason || '').slice(0, 120) });
        if (k === 'archive_purge') {
          var ids = (r.identities && r.identities['ptf_crm_offers']) || (r.identities && r.identities.ptf_crm_offers) || null;
          if (ids && ids.length) purgeTomb.push({ id: r.id || '', collection: r.collection || '', by: r.by || r.deletedBy || '', at: r.iso || r.deletedAt || '', reason: String(r.reason || '').slice(0, 120), count: ids.length, ids: ids.slice(0, 20) });
        }
      });
    } else { report.errors.push('archive: ' + arc.error); }
    report.steps.deletedArchive = { ok: arc.ok, total: arc.total, fetched: arc.rows.length, offerTombstones: offerTomb, offerPurgeTombstones: purgeTomb, kindHistogram: otherKinds };
    LOG('  سنگقبر پیشنهاد (kind=OFFER): ' + offerTomb.length + ' | archive_purge با identities پیشنهاد: ' + purgeTomb.length, offerTomb.length + purgeTomb.length ? '#b91c1c' : '#0f766e');

    /* ---------- ۴) بکآپهای سرور ---------- */
    LOG('۴/۵ خواندن فهرست بکآپهای سرور…');
    var lb = await api({ action: 'list_backups' });
    var all = (lb && lb.ok && lb.backups) ? lb.backups : [];
    var selected = [];
    all.forEach(function (b) {
      var n = String(b.name || '');
      if (n.indexOf('hourly-latest') === 0) { selected.push(b); return; }
      if (n.indexOf('daily-') === 0) {   /* همهٔ روزهای موجود را برمیداریم؛ تحلیل به ۱۰ فایل آخر محدود میشود */
        selected.push(b); return;
      }
      if (n.indexOf('weekly-latest') === 0 || n.indexOf('monthly-latest') === 0 || n.indexOf('suspect-') === 0) selected.push(b);
    });
    selected.sort(function (a, b) { return String(b.t || '').localeCompare(String(a.t || '')); });   /* جدید → قدیم */
    var use = selected.slice(0, 10);
    report.steps.backups = { listed: all.length, selected: use.map(function (b) { return { name: b.name, t: b.t, kb: Math.round((+b.size || 0) / 1024) }; }) };
    LOG('  بکآپهای بررسیشده: ' + use.length + ' (از ' + all.length + ' فایل)');

    var snaps = [];
    for (var i = 0; i < use.length; i++) {
      var b = use[i];
      try {
        var txt = await (async function () {
          var qs = 'action=get_backup&name=' + encodeURIComponent(b.name);
          var res = await fetch(base() + '?' + qs, { headers: headers(), credentials: 'same-origin', cache: 'no-store' });
          return await res.text();
        })();
        var j = null;
        try { j = JSON.parse(txt); } catch (e0) { j = null; }
        if (!j || !j.data) continue;
        var raw = j.data['ptf_crm_offers'];
        var rows = [];
        if (typeof raw === 'string') { try { rows = JSON.parse(raw) || []; } catch (e1) { rows = []; } }
        else if (Array.isArray(raw)) rows = raw;
        var set = {};
        rows.forEach(function (o) { var n = offerNo(o); if (n) set[n] = o; });
        snaps.push({
          name: b.name, fileT: b.t, snapT: j.t || '', by: j.by || '',
          counts: j.counts || {}, offersCount: rows.length, nos: set
        });
        LOG('  ✅ ' + b.name + ' — پیشنهاد: ' + rows.length + ' (نوشته: ' + (j.t || '?') + ' توسط ' + (j.by || '?') + ')');
      } catch (eB) { report.errors.push('get_backup ' + b.name + ': ' + eB); }
    }
    report.steps.snapshots = snaps.map(function (s) {
      return { name: s.name, snapT: s.snapT, by: s.by, offersCount: s.offersCount, countsOffers: (s.counts || {})['ptf_crm_offers'], countsRfqs: (s.counts || {})['ptf_crm_rfqs'] };
    });

    /* ---------- ۵) تحلیل: چه چیزی، چه زمانی رفت ---------- */
    LOG('۵/۵ تحلیل دیف (کدام «شمارهٔ پیشنهاد» در بکآپ بود و الان نیست)…');
    var lostByNo = {};
    snaps.forEach(function (s, idx) {
      keys(s.nos).forEach(function (n) {
        if (curNos[n]) return;
        if (!lostByNo[n]) lostByNo[n] = { no: n, presentIn: [], absentIn: [] };
        lostByNo[n].presentIn.push(idx);
      });
    });
    /* برای هر شمارهٔ گمشده: آخرین بکآپی که داشته + اولین بکآپِ جدیدتر که نداشته */
    var lost = [];
    keys(lostByNo).forEach(function (n) {
      var e = lostByNo[n];
      var iHas = Math.min.apply(null, e.presentIn);             /* snaps جدید→قدیم: کمترین اندیس = جدیدترین فایل */
      var iMiss = -1;
      for (var k2 = iHas - 1; k2 >= 0; k2--) { if (!snaps[k2].nos[n]) { iMiss = k2; break; } }
      var src = snaps[iHas].nos[n] || {};
      lost.push({
        no: n, kind: src.kind || '', st: src.st || '', buyerCo: String(src.buyerCo || '').slice(0, 60),
        day: dayOf(src), inqNo: src.inqNo || '', srcToNo: src.srcToNo || '', rialOf: src.rialOf || '', fxOf: src.fxOf || '',
        lastSeenBackup: snaps[iHas].name, lastSeenAt: snaps[iHas].snapT || snaps[iHas].fileT,
        firstMissingBackup: iMiss >= 0 ? snaps[iMiss].name : null,
        vanishedBetween: [snaps[iHas].snapT || snaps[iHas].fileT, iMiss >= 0 ? (snaps[iMiss].snapT || snaps[iMiss].fileT) : null]
      });
    });
    lost.sort(function (a, b) { return String(a.day + a.no) > String(b.day + b.no) ? 1 : -1; });
    var lostByDay = {};
    lost.forEach(function (x) { var d = x.day || '?'; lostByDay[d] = (lostByDay[d] || 0) + 1; });
    report.steps.loss = {
      lostCount: lost.length,
      lostByDay: lostByDay,
      windows: (function () {
        var w = {};
        lost.forEach(function (x) {
          var k = x.lastSeenAt + ' ← ' + (x.vanishedBetween[1] || '—');
          if (!w[k]) w[k] = { from: x.lastSeenAt, to: x.vanishedBetween[1], count: 0, sample: [] };
          w[k].count++;
          if (w[k].sample.length < 30) w[k].sample.push(x.no);
        });
        return keys(w).map(function (k) { return w[k]; });
      })(),
      notInAnyBackup: (function () { var s = []; keys(curNos).forEach(function (n) { var found = false; snaps.forEach(function (b) { if (b.nos[n]) found = true; }); if (!found) s.push(n); }); return s.length; })(),
      lost: lost.slice(0, 500)
    };

    /* ---------- خروجی ---------- */
    var cnt = report.steps.current.total;
    var bkOffers = snaps.length ? snaps[0].offersCount : null;
    LOG('===== خلاصهٔ کارآگاهی =====', '#b45309');
    try {
      console.table([{
        'پیشنهاد روی سرور (الان)': cnt,
        'پیشنهاد در جدیدترین بکآپ': bkOffers === null ? '—' : bkOffers,
        'شمارههای گمشده (در بکآپ بود، الان نیست)': lost.length,
        'سنگقبر پیشنهاد در آرشیو': offerTomb.length,
        'archive_purge با هویت پیشنهاد': purgeTomb.length,
        'آخرین push کلید پیشنهاد (lastAt)': (report.steps.syncStats.offers || {}).lastAt || '—',
        'آخرین pushکننده (lastBy)': (report.steps.syncStats.offers || {}).lastBy || '—',
        'conflicts کلید پیشنهاد': (report.steps.syncStats.offers || {}).conflicts === undefined ? '—' : report.steps.syncStats.offers.conflicts,
        'rejects کلید پیشنهاد': (report.steps.syncStats.offers || {}).rejects === undefined ? '—' : report.steps.syncStats.offers.rejects,
        'روزهای push کلید پیشنهاد (۷ روز)': JSON.stringify((report.steps.syncStats.offers || {}).d || {}),
        'تعداد روزهای گمشده': keys(lostByDay).length,
        'آخرین نویسندهٔ کلید (meta.by)': (report.steps.serverMeta || {}).offers ? ((report.steps.serverMeta.offers.by || '?') + ' @ ' + (report.steps.serverMeta.offers.t || '?')) : '—',
        'پیشنهاد محلی همین دستگاه': (report.steps.localDevice || {}).localOffersCount === undefined ? '—' : report.steps.localDevice.localOffersCount,
        'شکستِ نوشتنِ محلی': (report.steps.localDevice || {}).failedWrites ? report.steps.localDevice.failedWrites.length : '—',
        'حکم دستگاه فعلی': (report.steps.deviceVerdict || {}).flags ? (report.steps.deviceVerdict.flags.join(' | ') || 'سالم') : '—',
        'ردیف‌های فقط-این-دستگاه (کاندید بازیابی)': (report.steps.deviceVerdict || {}).localOnlyCount === undefined ? '—' : report.steps.deviceVerdict.localOnlyCount,
        'ردیف‌هایی که این دستگاه ندارد': (report.steps.deviceVerdict || {}).serverOnlyCount === undefined ? '—' : report.steps.deviceVerdict.serverOnlyCount
      }]);
      if (report.steps.loss.windows.length) console.table(report.steps.loss.windows.map(function (w) { return { 'از': w.from, 'تا': w.to, 'تعداد': w.count, 'نمونه': w.sample.slice(0, 8).join('، ') }; }));
      if (keys(lostByDay).length) console.table(keys(lostByDay).sort().map(function (d) { return { 'روز صدور پیشنهاد': d, 'تعداد گمشده': lostByDay[d] }; }));
    } catch (eT) {}

    var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'offer-loss-report-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    LOG('✅ گزارش دانلود شد: ' + a.download + '  (' + Math.round((Date.now() - START) / 1000) + ' ثانیه) — همین فایل را برگردانید.', '#0f766e');
    return report;
  } catch (eFatal) {
    console.error('[OFFER-LOSS] خطای کشنده:', eFatal);
    console.log('[OFFER-LOSS] تا این نقطه انجام شد:', report);
    try {
      var b2 = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      var a2 = document.createElement('a'); a2.href = URL.createObjectURL(b2);
      a2.download = 'offer-loss-report-partial.json'; document.body.appendChild(a2); a2.click();
    } catch (e2) {}
    return report;
  }
})();

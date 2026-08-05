/* =====================================================================
   PTF CRM — archive.js — Sprint 82 — US-178
   چرخه کامل فایل‌های پرونده پروژه:
   - دانلود کل پرونده (نگهداری محلی) → فقط بعد از حداقل یک دانلود، حذف مجاز است
   - حذف فایل‌های غیرضروری (متادیتا می‌ماند — اطلاعات پروژه از دست نمی‌رود)
   - بایگانی: فشرده‌سازی فایل‌های باقیمانده با تایید نهایی (zip سروری در آروان)
   - آزادسازی فضا: حذف فایل‌های ابری بعد از دانلود محلی
   - US-178 AC7: پیشنهادهای بازنده → پاکسازی فایل‌ها، فقط مشخصات آماری می‌ماند
   ===================================================================== */
(function () {

  function getPrj(no) { return getData('ptf_crm_projects').filter(function (p) { return p.no === no; })[0]; }
  function savePrjs(prjs) { setData('ptf_crm_projects', prjs); }
  function tl(p, tx) { p.timeline = p.timeline || []; p.timeline.push({ t: faDateTime(), by: curSession().name, tx: tx }); }
  function cloudDocs(p) {
    var out = [];
    (p.docs || []).forEach(function (d, gi) { if (d.key && !d.purged) { out.push({ gi: gi, d: d }); } });
    return out;
  }
  window.ptfCloudDocsOf = cloudDocs; /* v21.1 test/helper */
  window.ptfPrjHasCloudFiles = function (p) { return cloudDocs(p || {}).length > 0; };

  /* ---------- حذف ابری یک کلید ---------- */
  window.ptfCloudDelete = function (key, cb) {
    fetch(STORAGE_API + '?action=delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key })
    }).then(function (r) { return r.json(); }).then(function (d) { cb(!!d.ok, d); })
      .catch(function () { cb(false, { error: 'عدم دسترسی به سرور' }); });
  };

  /* ---------- AC4: دانلود کل پرونده (شرط لازم برای هر حذف) ---------- */
  window.prjDownloadAll = function (no) {
    var p = getPrj(no);
    if (!p) return;
    var files = cloudDocs(p);
    if (!files.length && !p.archiveKey) {
      /* v21.1 BUG-036: تفاوت «نبود فایل» با «خطای دانلود» + آزادسازی مسیر فشرده‌سازی متادیتایی */
      if (typeof ptfToast === 'function') ptfToast('این پرونده فایل ابری قابل دانلود ندارد — فقط متادیتا/اسناد سیستمی', 'ok');
      else alert('ℹ️ فایل ابری‌ای در این پرونده نیست.\nاگر فقط متادیتا دارد، می‌توانید بدون دانلود آن را «بایگانی متادیتایی» کنید.');
      return { ok: false, why: 'no-cloud' };
    }
    var keys = files.map(function (f) { return f.d.key; });
    if (p.archiveKey) keys.push(p.archiveKey);
    if (!confirm('⬇️ دانلود کل پرونده ' + no + '\n\n' + keys.length + ' فایل یکی‌یکی دانلود می‌شود (لینک‌های امن موقت).\nپس از اتمام، این پرونده «دانلود‌شده» علامت می‌خورد و حذف/بایگانی فایل‌ها مجاز می‌شود.\n\nادامه می‌دهید؟')) return;
    var i = 0, failed = 0;
    (function next() {
      if (i >= keys.length) {
        var prjs = getData('ptf_crm_projects');
        var pp = prjs.filter(function (x) { return x.no === no; })[0];
        if (pp && !failed) {
          pp.dlAt = faDateTime(); pp.dlBy = curSession().name;
          tl(pp, '⬇️ کل پرونده دانلود شد (' + keys.length + ' فایل) — حذف/بایگانی از این پس مجاز است');
          savePrjs(prjs);
          audit('پرونده پروژه', 'دانلود کامل پرونده ' + no, keys.length + ' فایل');
          if (typeof ptfToast === 'function') ptfToast('✅ دانلود کامل شد — پرونده علامت «دانلود‌شده» خورد', 'ok');
        } else if (failed) {
          alert('⚠️ ' + failed + ' فایل دانلود نشد — علامت «دانلود‌شده» ثبت نشد. دوباره تلاش کنید.');
        }
        if (typeof openProject === 'function') { hideModal(); openProject(no); }
        return;
      }
      var k = keys[i++];
      fetch(STORAGE_API + '?action=presign_get', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k })
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            var a = document.createElement('a');
            a.href = d.url; a.download = ''; a.target = '_blank';
            document.body.appendChild(a); a.click(); a.remove();
          } else failed++;
          setTimeout(next, 900);
        })
        .catch(function () { failed++; setTimeout(next, 900); });
    })();
  };

  /* ---------- AC6: گارد — قبل از حداقل یک دانلود کامل، حذف ممنوع ---------- */
  window.prjCanDelete = function (p) { return !!(p && p.dlAt); };

  /* ---------- AC3/AC5: حذف فایل غیرضروری — متادیتا می‌ماند ---------- */
  window.prjDocDel = function (no, gi) {
    var prjs = getData('ptf_crm_projects');
    var p = prjs.filter(function (x) { return x.no === no; })[0];
    if (!p || !p.docs || !p.docs[gi]) return;
    var d = p.docs[gi];
    /* v13.3 (US-323): پرونده بایگانی‌شده — حذف فقط برای نقش‌های مجاز */
    if (p.state === 'archived' && !(typeof ptfArcDocAllowed === 'function' && ptfArcDocAllowed())) {
      alert('🔒 حذف سند از پرونده بایگانی‌شده فقط توسط ادمین، رییس هیات مدیره، مدیر بازرگانی و مدیرعامل مجاز است.');
      return;
    }
    if (!prjCanDelete(p)) {
      alert('🔒 حذف فایل مجاز نیست.\n\nبرای جلوگیری از از دست رفتن مدارک، ابتدا باید حداقل یک بار «دانلود کل پرونده» انجام شده باشد (نگهداری نسخه محلی).');
      return;
    }
    if (!d.key || d.purged) { alert('این مدرک فایل ابری ندارد'); return; }
    if (!confirm('🗑 فایل «' + d.name + '» از فضای ابری پاک شود؟\n\nمتادیتا (نام، تاریخ، ثبت‌کننده) در پرونده می‌ماند و روند پروژه گم نمی‌شود — فقط خود فایل حذف می‌شود.')) return;
    ptfCloudDelete(d.key, function (ok, res) {
      if (!ok) { alert('خطا در حذف ابری: ' + (res.error || res.http || '')); return; }
      var prjs2 = getData('ptf_crm_projects');
      var p2 = prjs2.filter(function (x) { return x.no === no; })[0];
      if (p2 && p2.docs[gi]) {
        p2.docs[gi].purged = true;
        p2.docs[gi].purgedAt = faDateTime();
        p2.docs[gi].purgedBy = curSession().name;
        p2.docs[gi].key = null;
        tl(p2, '🗑 فایل «' + d.name + '» برای آزادسازی فضا حذف شد (متادیتا حفظ شد)');
        /* v13.3 (US-323): رد تغییر روی پرونده بایگانی‌شده */
        if (p2.state === 'archived') {
          p2.changeLog = p2.changeLog || [];
          p2.changeLog.push({ t: faDateTime(), by: curSession().name, user: curSession().user, act: 'del', doc: d.name, folder: d.folder });
        }
        savePrjs(prjs2);
      }
      audit('پرونده پروژه', 'حذف فایل ابری از ' + no, d.name);
      localStorage.removeItem('ptf_cloud_usage');
      if (typeof prjShowFolder === 'function') prjShowFolder(d.folder);
      if (typeof ptfToast === 'function') ptfToast('فایل حذف شد — متادیتا در پرونده ماند', 'ok');
    });
  };

  /* ---------- AC2/AC3: ویزارد بایگانی — پاکسازی + فشرده‌سازی با تایید نهایی ---------- */
  window.prjArchiveWizard = function (no) {
    var p = getPrj(no);
    if (!p) return;
    if (p.archiveKey) { alert('این پرونده قبلاً بایگانی و فشرده شده است ✅\n(آرشیو: ' + p.archiveKey + ')'); return; }
    /* v21.1 BUG-036: stateهای salesfile archived + done/closed مجازند */
    var stOk = ['done', 'closed', 'archived'].indexOf(p.state) > -1 || p.origin === 'salesfile';
    if (!stOk) {
      alert('بایگانی فقط پس از اتمام/مختومه شدن پروژه ممکن است.\nابتدا وضعیت پرونده را «تحویل کامل»، «بسته‌شده» یا مختومه کنید.');
      return;
    }
    var files = cloudDocs(p);
    /* v21.1 BUG-036: بدون فایل ابری → بایگانی متادیتایی (بدون شرط dlAt) */
    if (!files.length) {
      if (!confirm('ℹ️ این پرونده فایل ابری قابل فشرده‌سازی ندارد.\n\nآیا فقط به‌صورت «بایگانی متادیتایی/سیستمی» علامت بخورد؟\n(اطلاعات پرونده حفظ می‌شود؛ zip ابری ساخته نمی‌شود)')) return;
      var prjs0 = getData('ptf_crm_projects');
      var p0 = prjs0.filter(function (x) { return x.no === no; })[0];
      if (!p0) return;
      p0.archiveMetaOnly = true;
      p0.archivePurged = true;
      p0.archivedAt = (typeof faDateTime === 'function' ? faDateTime() : '');
      p0.archivedBy = (typeof curSession === 'function' ? curSession().name : '');
      if (p0.state !== 'archived') p0.state = 'archived';
      tl(p0, '🗄 بایگانی متادیتایی (بدون فایل ابری) — BUG-036');
      savePrjs(prjs0);
      try { audit('پرونده پروژه', 'بایگانی متادیتایی ' + no, 'no-cloud'); } catch (e) {}
      if (typeof ptfToast === 'function') ptfToast('✅ پرونده بدون فایل ابری، بایگانی متادیتایی شد', 'ok');
      if (typeof openProject === 'function') { try { hideModal(); openProject(no); } catch (e2) {} }
      return;
    }
    /* شرط دانلود فقط وقتی فایل ابری واقعی وجود دارد */
    if (!prjCanDelete(p)) {
      alert('🔒 قبل از فشرده‌سازی باید حداقل یک بار «دانلود کل پرونده» انجام شده باشد (نسخه محلی امن).\n\nاین پرونده ' + files.length + ' فایل ابری دارد.');
      return;
    }
    var rows = files.map(function (f) {
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--brd);border-radius:9px;margin-bottom:5px;font-size:12px;cursor:pointer">' +
        '<input type="checkbox" class="arcDel" data-gi="' + f.gi + '"> ' +
        '<span style="flex:1">📄 ' + escP(f.d.name) + ' <small style="color:#94a3b8">' + (f.d.size ? fmtSizeH(f.d.size) : '') + ' — ' + escP(f.d.t || '') + '</small></span></label>';
    }).join('');
    var html = '<div class="md-b" style="display:grid;z-index:70" onclick="if(event.target===this)this.remove()"><div class="md" style="max-width:600px;max-height:92vh;overflow:auto">' +
      '<h3>🗄 بایگانی پرونده ' + escP(no) + '</h3>' +
      '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:9px 12px;font-size:12px;color:#0c4a6e;margin-bottom:10px">' +
      'گام ۱: فایل‌های <b>غیرضروری</b> را تیک بزنید تا حذف شوند (آزادسازی فضا).<br>گام ۲: بقیه فایل‌ها با تایید نهایی <b>فشرده (zip)</b> شده و به بایگانی ابری منتقل می‌شوند؛ اصل‌ها پاک می‌شوند.</div>' +
      rows +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
      '<button class="bt bt-o" onclick="this.closest(\'.md-b\').remove()">انصراف</button>' +
      '<button class="bt" style="background:#7c3aed" onclick="prjArchiveGo(\'' + ptfOnClickArg(no) + '\', this)">تایید و اجرا</button></div></div></div>';
    document.getElementById('panels').insertAdjacentHTML('beforeend', html);
  };

  window.prjArchiveGo = function (no, btnEl) {
    var dels = [];
    document.querySelectorAll('.arcDel').forEach(function (c) { if (c.checked) dels.push(+c.getAttribute('data-gi')); });
    var p = getPrj(no);
    if (!p) return;
    var keep = cloudDocs(p).filter(function (f) { return dels.indexOf(f.gi) < 0; });
    if (!keep.length) { alert('حداقل یک فایل باید برای بایگانی بماند.\nاگر می‌خواهید همه فایل‌ها حذف شوند، از حذف تکی استفاده کنید.'); return; }
    if (!confirm('تایید نهایی بایگانی:\n\n• ' + dels.length + ' فایل غیرضروری حذف می‌شود\n• ' + keep.length + ' فایل باقیمانده در یک zip فشرده و بایگانی می‌شود\n• اصل فایل‌ها بعد از فشرده‌سازی موفق پاک می‌شوند\n\nادامه؟')) return;
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ در حال بایگانی...'; }

    // گام ۱: حذف انتخابی‌ها (متادیتا می‌ماند)
    var di = 0;
    (function delNext() {
      if (di >= dels.length) { doZip(); return; }
      var gi = dels[di++];
      var d = p.docs[gi];
      if (!d || !d.key) { delNext(); return; }
      ptfCloudDelete(d.key, function () {
        var prjs = getData('ptf_crm_projects');
        var p2 = prjs.filter(function (x) { return x.no === no; })[0];
        if (p2 && p2.docs[gi]) {
          p2.docs[gi].purged = true; p2.docs[gi].key = null;
          p2.docs[gi].purgedAt = faDateTime(); p2.docs[gi].purgedBy = curSession().name;
          savePrjs(prjs);
        }
        delNext();
      });
    })();

    // گام ۲: فشرده‌سازی باقیمانده در سرور
    function doZip() {
      fetch(STORAGE_API + '?action=archive_zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prj: no, keys: keep.map(function (f) { return f.d.key; }) })
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          var prjs = getData('ptf_crm_projects');
          var p2 = prjs.filter(function (x) { return x.no === no; })[0];
          if (!p2) return;
          if (d.ok) {
            keep.forEach(function (f) {
              if (p2.docs[f.gi]) { p2.docs[f.gi].archived = true; p2.docs[f.gi].key = null; }
            });
            p2.archiveKey = d.zipKey;
            p2.archiveAt = faDateTime();
            p2.archiveBy = curSession().name;
            p2.state = 'archived';
            tl(p2, '🗄 پرونده بایگانی شد: ' + d.zipped + ' فایل فشرده (' + fmtSizeH(d.bytesIn) + ' → ' + fmtSizeH(d.bytesZip) + ')' + (dels.length ? ' + ' + dels.length + ' فایل غیرضروری حذف شد' : ''));
            savePrjs(prjs);
            audit('پرونده پروژه', 'بایگانی و فشرده‌سازی ' + no, d.zipKey);
            localStorage.removeItem('ptf_cloud_usage');
            alert('✅ بایگانی کامل شد\n\n' + d.zipped + ' فایل فشرده شد: ' + fmtSizeH(d.bytesIn) + ' → ' + fmtSizeH(d.bytesZip) + '\nاصل فایل‌ها (' + d.deleted + ' عدد) از فضای ابری پاک شدند.');
            document.querySelectorAll('.md-b').forEach(function (m) { if ((m.style || {}).display !== 'none') m.remove(); }); /* v16.2 BUG-017: مینیمایزها محفوظ */
            if (typeof renderProjects2 === 'function') renderProjects2();
            openProject(no);
          } else if (d.error === 'no-zip') {
            // ZipArchive روی هاست نیست — بایگانی بدون فشرده‌سازی
            tl(p2, '🗄 پرونده بایگانی شد (بدون فشرده‌سازی — ZipArchive روی هاست فعال نیست)');
            p2.state = 'archived';
            savePrjs(prjs);
            alert('⚠️ ' + (d.msg || 'ZipArchive فعال نیست') + '\nپرونده «بایگانی‌شده» علامت خورد ولی فایل‌ها فشرده نشدند.');
            document.querySelectorAll('.md-b').forEach(function (m) { if ((m.style || {}).display !== 'none') m.remove(); }); /* v16.2 BUG-017: مینیمایزها محفوظ */
            openProject(no);
          } else {
            alert('❌ خطا در بایگانی: ' + (d.error || '') + '\nفایل‌های باقیمانده دست نخورده ماندند.');
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'تایید و اجرا'; }
          }
        })
        .catch(function () {
          alert('❌ عدم دسترسی به سرور — بایگانی انجام نشد');
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'تایید و اجرا'; }
        });
    }
  };

  /* ---------- آزادسازی کامل فضا: حذف zip بایگانی بعد از دانلود محلی ---------- */
  window.prjFreeCloud = function (no) {
    var p = getPrj(no);
    if (!p || !p.archiveKey) return;
    if (!prjCanDelete(p)) { alert('🔒 ابتدا «دانلود کل پرونده» (شامل zip بایگانی) انجام شود.'); return; }
    if (!confirm('☁️ فایل بایگانی فشرده (' + p.archiveKey + ') از فضای ابری پاک شود؟\n\nاطلاعات و روند پروژه در سیستم می‌ماند — فقط فایل‌ها روی فضای محلی شما خواهند بود.')) return;
    ptfCloudDelete(p.archiveKey, function (ok, res) {
      if (!ok) { alert('خطا: ' + (res.error || res.http || '')); return; }
      var prjs = getData('ptf_crm_projects');
      var p2 = prjs.filter(function (x) { return x.no === no; })[0];
      if (p2) {
        tl(p2, '☁️ فایل بایگانی از فضای ابری پاک شد (نسخه محلی نزد ' + (p2.dlBy || 'کاربر') + ') — فضا آزاد شد');
        p2.archivePurged = true;
        p2.archiveKey = null;
        savePrjs(prjs);
      }
      audit('پرونده پروژه', 'آزادسازی فضای ابری ' + no, '');
      localStorage.removeItem('ptf_cloud_usage');
      if (typeof ptfToast === 'function') ptfToast('فضای ابری آزاد شد ✅', 'ok');
      hideModal(); openProject(no);
    });
  };

  /* ---------- US-178 AC7: پیشنهاد بازنده → پاکسازی فایل‌های درخواست ---------- */
  function purgeLostFiles(o) {
    // فایل‌های RFQ مرتبط (از سایت یا ثبت داخلی)
    var rfqs = getData('ptf_crm_rfqs');
    var r = rfqs.filter(function (x) { return (o.inqNo && (x.inqNo === o.inqNo || x.cd === o.inqNo)); })[0];
    var keys = [];
    if (r && r.files) {
      Object.keys(r.files).forEach(function (k) {
        (r.files[k] || []).forEach(function (f) { if (f.key) keys.push({ k: k, f: f }); });
      });
    }
    if (!keys.length) return;
    if (!confirm('🧹 این درخواست بازنده شد.\n\n' + keys.length + ' فایل پیوست (استعلام/دیتاشیت/نقشه...) روی فضای ابری است.\nطبق سیاست سیستم، برای درخواست‌های بازنده فقط مشخصات کلی (برای بررسی آماری) می‌ماند و فایل‌ها از سرور پاک می‌شوند.\n\nفایل‌ها الان پاک شوند؟')) return;
    var i = 0, done = 0;
    (function next() {
      if (i >= keys.length) {
        var rfqs2 = getData('ptf_crm_rfqs');
        var r2 = rfqs2.filter(function (x) { return x.cd === r.cd; })[0];
        if (r2 && r2.files) {
          Object.keys(r2.files).forEach(function (k) {
            r2.files[k] = (r2.files[k] || []).map(function (f) {
              return { name: f.name, size: f.size, t: f.t, purged: true, key: null };
            });
          });
          r2.filesPurgedAt = faDateTime();
          setData('ptf_crm_rfqs', rfqs2);
        }
        audit('استعلامات', 'پاکسازی فایل‌های درخواست بازنده ' + r.cd, done + ' فایل');
        localStorage.removeItem('ptf_cloud_usage');
        if (typeof ptfToast === 'function') ptfToast('🧹 ' + done + ' فایل درخواست بازنده پاک شد — مشخصات آماری ماند', 'ok');
        return;
      }
      var it = keys[i++];
      ptfCloudDelete(it.f.key, function (ok) { if (ok) done++; next(); });
    })();
  }

  // هوک روی offerSetSt: باخت → پیشنهاد پاکسازی (بعد از هوک‌های قبلی petty)
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var _setSt = window.offerSetSt;
      if (typeof _setSt !== 'function') return;
      window.offerSetSt = function (no, st, selEl) {
        _setSt(no, st, selEl);
        if (st === 'lost') {
          var o = getData('ptf_crm_offers').filter(function (x) { return x.no === no; })[0];
          if (o && o.st === 'lost') setTimeout(function () { purgeLostFiles(o); }, 400);
        }
      };
    }, 800);
  });
})();

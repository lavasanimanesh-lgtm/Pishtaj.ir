/* PTF careers apply — PDF ≤5MB + captcha + OTP + وضعیت پیوست رزومه */
(function () {
  'use strict';
  var MAX = 5 * 1048576;
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtSize(n) {
    n = +n || 0;
    if (n < 1024) return n + ' بایت';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' کیلوبایت';
    return (n / 1048576).toFixed(2) + ' مگابایت';
  }
  function ensureCss() {
    if (document.getElementById('jobResumeUiCss')) return;
    var st = document.createElement('style');
    st.id = 'jobResumeUiCss';
    st.textContent =
      '#jobResumeBox{margin-top:8px;border:1.5px dashed #cbd5e1;border-radius:14px;padding:12px 14px;background:#f8fafc;color:#475569;font-size:13.5px;line-height:1.75;font-weight:800}' +
      '#jobResumeBox.is-ok{border-style:solid;border-color:#86efac;background:#ecfdf5;color:#065f46}' +
      '#jobResumeBox.is-err{border-style:solid;border-color:#fca5a5;background:#fef2f2;color:#b91c1c}' +
      '#jobResumeBox.is-up{border-style:solid;border-color:#fcd34d;background:#fffbeb;color:#92400e}' +
      '#jobResumeBox.is-done{border-style:solid;border-color:#34d399;background:#ecfdf5;color:#047857}' +
      '#jobResumeBox .nm{font-weight:900;overflow-wrap:anywhere}' +
      '#jobResumeBox .sub{display:block;font-weight:800;opacity:.9;margin-top:2px}' +
      '#jobResumeBar{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-top:10px}' +
      '#jobResumeBar>i{display:block;height:100%;width:0;background:linear-gradient(135deg,#ef4b1a,#f79400);transition:width .15s}';
    document.head.appendChild(st);
  }
  function ensureBox(fileEl) {
    var box = document.getElementById('jobResumeBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'jobResumeBox';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      fileEl.insertAdjacentElement('afterend', box);
    }
    return box;
  }
  function setBox(box, kind, html) {
    box.className = 'job-resume-box' + (kind ? ' is-' + kind : '');
    box.innerHTML = html;
  }
  function idleHtml() {
    return 'هنوز فایلی انتخاب نشده است. رزومه را انتخاب کنید تا نام فایل اینجا دیده شود.';
  }
  function readyHtml(file) {
    return '<span class="nm">📄 ' + esc(file.name) + '</span>' +
      '<span class="sub">' + fmtSize(file.size) + ' — PDF</span>' +
      '<span class="sub">✅ رزومه پیوست شد. می‌توانید درخواست را ارسال کنید.</span>';
  }
  function postApply(api, fd, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', api + '?action=apply');
      xhr.upload.onprogress = function (ev) {
        if (!onProgress) return;
        if (ev.lengthComputable && ev.total) onProgress(Math.round((ev.loaded / ev.total) * 100));
        else onProgress(null);
      };
      xhr.onload = function () {
        var d;
        try { d = JSON.parse(xhr.responseText); } catch (e) { reject(new Error('bad-json')); return; }
        resolve(d);
      };
      xhr.onerror = function () { reject(new Error('network')); };
      xhr.send(fd);
    });
  }
  ready(function () {
    var form = document.getElementById('jobApplyForm');
    if (!form) return;
    ensureCss();
    if (typeof ptfCaptchaMount === 'function') {
      ptfCaptchaMount('jobCaptcha');
      ptfOtpMount('jobOtp', 'jobPhone');
    }
    var fileEl = document.getElementById('jobResume');
    var box = fileEl ? ensureBox(fileEl) : null;
    if (box) setBox(box, '', idleHtml());
    var picked = null;
    function readFile() {
      if (!fileEl || !box) return null;
      var file = fileEl.files && fileEl.files[0];
      if (!file) {
        picked = null;
        setBox(box, '', idleHtml());
        return null;
      }
      var n = (file.name || '').toLowerCase();
      if (!/\.pdf$/.test(n)) {
        picked = null;
        fileEl.value = '';
        setBox(box, 'err', 'فقط فایل PDF مجاز است. فایل انتخاب‌شده پیوست نشد.');
        return null;
      }
      if (file.size < 1 || file.size > MAX) {
        picked = null;
        fileEl.value = '';
        setBox(box, 'err', 'حجم رزومه باید حداکثر ۵ مگابایت باشد. فایل پیوست نشد.');
        return null;
      }
      picked = file;
      setBox(box, 'ok', readyHtml(file));
      return file;
    }
    if (fileEl) fileEl.addEventListener('change', readFile);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = document.getElementById('jobStatus');
      function msg(t, err) {
        if (!status) return;
        status.textContent = t;
        status.style.color = err ? '#dc2626' : '#047857';
      }
      var name = (document.getElementById('jobName') || {}).value || '';
      var phone = ((document.getElementById('jobPhone') || {}).value || '').replace(/\D/g, '');
      var email = (document.getElementById('jobEmail') || {}).value || '';
      var edu = (document.getElementById('jobEdu') || {}).value || '';
      var exp = (document.getElementById('jobExp') || {}).value || '';
      var sal = (document.getElementById('jobSal') || {}).value || '';
      var file = readFile();
      if (!name.trim() || !/^09\d{9}$/.test(phone) || !email.trim() || !edu || !exp || !sal) {
        msg('همه فیلدها الزامی است. موبایل را به‌صورت 09xxxxxxxxx وارد کنید.', true);
        return;
      }
      if (!file) { msg('فایل رزومه PDF الزامی است.', true); return; }
      if (typeof ptfCaptchaValid === 'function' && !ptfCaptchaValid()) {
        msg(window.ptfCaptchaMsg || 'کپچا را تکمیل کنید', true);
        return;
      }
      if (typeof ptfOtpVerified === 'function' && !ptfOtpVerified()) {
        msg('لطفاً ابتدا شماره موبایل را با رمز پیامکی تایید کنید.', true);
        return;
      }
      var btn = document.getElementById('jobSubmit');
      if (btn) { btn.disabled = true; btn.textContent = 'در حال بارگذاری رزومه...'; }
      if (box) {
        setBox(box, 'up',
          '<span class="nm">📄 ' + esc(file.name) + '</span>' +
          '<span class="sub" id="jobResumeUpTxt">در حال بارگذاری رزومه...</span>' +
          '<div id="jobResumeBar" aria-hidden="true"><i></i></div>');
      }
      var fd = new FormData(form);
      if (typeof ptfCaptchaAppend === 'function') ptfCaptchaAppend(fd);
      if (typeof ptfOtpToken === 'function' && ptfOtpToken()) fd.append('otp_token', ptfOtpToken());
      var api = form.getAttribute('data-api') || '../../api/careers.php';
      postApply(api, fd, function (pct) {
        var bar = document.querySelector('#jobResumeBar > i');
        var txt = document.getElementById('jobResumeUpTxt');
        if (pct == null) {
          if (txt) txt.textContent = 'در حال بارگذاری رزومه...';
          return;
        }
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = 'در حال بارگذاری رزومه... ' + pct + '٪';
      }).then(function (d) {
        if (d && d.ok) {
          var savedName = file.name;
          if (box) {
            setBox(box, 'done',
              '<span class="nm">✅ رزومه با موفقیت پیوست شد</span>' +
              '<span class="sub">' + esc(savedName) + ' — ' + fmtSize(file.size) + '</span>' +
              '<span class="sub">درخواست همکاری ثبت شد.</span>');
          }
          msg('رزومه با موفقیت پیوست شد و درخواست شما ثبت گردید.', false);
          form.reset();
          picked = null;
          if (typeof ptfCaptchaMount === 'function') {
            ptfCaptchaMount('jobCaptcha');
            ptfOtpMount('jobOtp', 'jobPhone');
          }
          if (box) {
            setBox(box, 'done',
              '<span class="nm">✅ رزومه با موفقیت پیوست شد</span>' +
              '<span class="sub">' + esc(savedName) + '</span>' +
              '<span class="sub">درخواست همکاری ثبت شد. برای ارسال رزومه دیگر، فایل جدید انتخاب کنید.</span>');
          }
        } else {
          var err = (d && (d.message || d.error)) || 'ثبت انجام نشد';
          if (err === 'captcha') err = window.ptfCaptchaMsg || 'کپچا نامعتبر است';
          if (err === 'otp') err = 'شماره موبایل با پیامک تایید نشده است';
          msg(err, true);
          if (box && picked) setBox(box, 'ok', readyHtml(picked) + '<span class="sub">ارسال انجام نشد؛ رزومه هنوز پیوست است.</span>');
        }
      }).catch(function () {
        msg('ارتباط با سرور برقرار نشد.', true);
        if (box && picked) setBox(box, 'ok', readyHtml(picked) + '<span class="sub">بارگذاری به سرور نرسید؛ رزومه هنوز پیوست است.</span>');
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'ارسال درخواست'; }
      });
    });
  });
})();

/* PTF careers apply — PDF ≤5MB + captcha + OTP */
(function () {
  'use strict';
  var MAX = 5 * 1048576;
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(function () {
    var form = document.getElementById('jobApplyForm');
    if (!form) return;
    if (typeof ptfCaptchaMount === 'function') {
      ptfCaptchaMount('jobCaptcha');
      ptfOtpMount('jobOtp', 'jobPhone');
    }
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
      var fileEl = document.getElementById('jobResume');
      var file = fileEl && fileEl.files && fileEl.files[0];
      if (!name.trim() || !/^09\d{9}$/.test(phone) || !email.trim() || !edu || !exp || !sal) {
        msg('همه فیلدها الزامی است. موبایل را به‌صورت 09xxxxxxxxx وارد کنید.', true);
        return;
      }
      if (!file) { msg('فایل رزومه PDF الزامی است.', true); return; }
      var n = (file.name || '').toLowerCase();
      if (!/\.pdf$/.test(n) || file.size > MAX) {
        msg('رزومه فقط PDF و حداکثر ۵ مگابایت است.', true);
        return;
      }
      if (typeof ptfCaptchaValid === 'function' && !ptfCaptchaValid()) {
        msg(window.ptfCaptchaMsg || 'کپچا را تکمیل کنید', true);
        return;
      }
      if (typeof ptfOtpVerified === 'function' && !ptfOtpVerified()) {
        msg('لطفاً ابتدا شماره موبایل را با رمز پیامکی تایید کنید.', true);
        return;
      }
      var btn = document.getElementById('jobSubmit');
      if (btn) { btn.disabled = true; btn.textContent = 'در حال ارسال...'; }
      var fd = new FormData(form);
      if (typeof ptfCaptchaAppend === 'function') ptfCaptchaAppend(fd);
      if (typeof ptfOtpToken === 'function' && ptfOtpToken()) fd.append('otp_token', ptfOtpToken());
      var api = form.getAttribute('data-api') || '../../api/careers.php';
      fetch(api + '?action=apply', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ok) {
            msg('درخواست شما ثبت شد. با سپاس.', false);
            form.reset();
            if (typeof ptfCaptchaMount === 'function') {
              ptfCaptchaMount('jobCaptcha');
              ptfOtpMount('jobOtp', 'jobPhone');
            }
          } else {
            var err = (d && (d.message || d.error)) || 'ثبت انجام نشد';
            if (err === 'captcha') err = window.ptfCaptchaMsg || 'کپچا نامعتبر است';
            if (err === 'otp') err = 'شماره موبایل با پیامک تایید نشده است';
            msg(err, true);
          }
        })
        .catch(function () { msg('ارتباط با سرور برقرار نشد.', true); })
        .then(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'ارسال درخواست'; }
        });
    });
  });
})();

/* =====================================================================
   PTF Guard — Sprint 72 (US-149)
   کپچای «من ربات نیستم» (چالش سروری) + تایید پیامکی شماره (OTP)
   استفاده:
     ptfCaptchaMount(containerId)                 → درج ویجت کپچا
     ptfCaptchaAppend(formDataOrForm)             → افزودن پاسخ+توکن به ارسال
     ptfCaptchaValid()                            → آیا کاربر پاسخ داده؟
     ptfOtpMount(containerId, phoneInputId)       → ویجت تایید پیامکی
     ptfOtpToken()                                → توکن OTP تاییدشده (یا '')
   ===================================================================== */
(function () {
  'use strict';
  var parts = location.pathname.replace(/\/index\.html$/, '/').split('/').filter(Boolean);
  if (/\.html$/.test(parts[parts.length - 1] || '')) parts.pop();
  var depth = parts.length;
  var API = (depth ? new Array(depth + 1).join('../') : '') + 'api/crm.php';

  var state = { token: '', answer: '', solved: false };

  /* ============ کپچا ============ */
  window.ptfCaptchaMount = function (id) {
    var c = document.getElementById(id);
    if (!c) return;
    c.innerHTML =
      '<div style="border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 16px;background:#f8fafc;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      '<label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-weight:800;font-size:14px;color:#334155;margin:0">' +
      '<input type="checkbox" id="' + id + '_chk" style="width:20px;height:20px;accent-color:#ef4b1a"> من ربات نیستم</label>' +
      '<span id="' + id + '_box" style="display:none;align-items:center;gap:8px">' +
      '<span id="' + id + '_q" style="font-weight:900;color:#ef4b1a;font-size:15px;direction:ltr"></span>' +
      '<input type="text" id="' + id + '_a" inputmode="numeric" autocomplete="off" placeholder="جواب" style="width:74px;padding:8px;border:1.5px solid #e2e8f0;border-radius:10px;text-align:center;font-weight:900;font-size:15px">' +
      '<span id="' + id + '_ok" style="display:none;color:#059669;font-weight:900">✔</span></span>' +
      '<span id="' + id + '_err" style="display:none;color:#dc2626;font-size:12px;font-weight:800">خطا در دریافت کپچا — دوباره تیک بزنید</span></div>';
    var chk = document.getElementById(id + '_chk');
    chk.addEventListener('change', function () {
      var box = document.getElementById(id + '_box');
      var err = document.getElementById(id + '_err');
      err.style.display = 'none';
      state.solved = false; state.token = ''; state.answer = '';
      if (!chk.checked) { box.style.display = 'none'; return; }
      fetch(API + '?action=captcha_new')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) throw 0;
          state.token = d.token;
          document.getElementById(id + '_q').textContent = d.q + ' = ?';
          box.style.display = 'inline-flex';
          document.getElementById(id + '_a').value = '';
          document.getElementById(id + '_ok').style.display = 'none';
          document.getElementById(id + '_a').focus();
        })
        .catch(function () { chk.checked = false; err.style.display = 'inline'; });
    });
    c.addEventListener('input', function (e) {
      if (e.target.id !== id + '_a') return;
      state.answer = e.target.value.trim();
      state.solved = state.answer !== '' && !isNaN(state.answer);
      document.getElementById(id + '_ok').style.display = state.solved ? 'inline' : 'none';
    });
  };

  window.ptfCaptchaValid = function () { return state.solved && !!state.token; };
  window.ptfCaptchaAppend = function (fd) {
    if (fd instanceof FormData) {
      fd.append('captcha_token', state.token);
      fd.append('captcha_answer', state.answer);
    }
    return fd;
  };
  // برای پیام خطای یکسان
  window.ptfCaptchaMsg = 'لطفاً ابتدا گزینه «من ربات نیستم» را تیک بزنید و پاسخ را وارد کنید.';

  /* ============ OTP تایید شماره (فرم تامین‌کننده) ============ */
  var otp = { token: '', verified: false, smsOff: false, timer: null, sends: 0 };
  window.ptfOtpToken = function () { return otp.token; };
  window.ptfOtpVerified = function () { return otp.verified || otp.smsOff; };
  window.ptfOtpSmsOff = function () { return otp.smsOff; };

  window.ptfOtpMount = function (id, phoneId) {
    var c = document.getElementById(id);
    if (!c) return;
    // AC5: اگر پنل پیامک هنوز فعال نیست، ویجت به حالت اطلاع‌رسانی می‌رود و مانع ثبت نمی‌شود
    fetch(API + '?action=sms_status')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok && !d.enabled) {
          otp.smsOff = true;
          c.innerHTML = '<div style="border:1.5px dashed #e2e8f0;border-radius:14px;padding:10px 16px;background:#f8fafc;font-size:12.5px;color:#64748b">📱 تایید پیامکی شماره تلفن پس از فعال‌سازی سامانه پیامکی شرکت الزامی می‌شود — فعلاً ثبت‌نام با تایید کپچا انجام می‌گیرد.</div>';
        }
      })
      .catch(function () { /* سرور در دسترس نیست — ویجت عادی می‌ماند */ });
    c.innerHTML =
      '<div style="border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 16px;background:#fff7ed">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<b style="font-size:13.5px;color:#9a3412">📱 تایید شماره تلفن</b>' +
      '<button type="button" id="' + id + '_send" style="background:linear-gradient(135deg,#ef4b1a,#f79400);color:#fff;border:0;border-radius:10px;padding:8px 16px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer">ارسال رمز تایید</button>' +
      '<span id="' + id + '_st" style="font-size:12px;color:#78716c"></span></div>' +
      '<div id="' + id + '_vbox" style="display:none;margin-top:10px;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<input type="text" id="' + id + '_code" inputmode="numeric" maxlength="5" placeholder="رمز ۵ رقمی" style="width:110px;padding:9px;border:1.5px solid #e2e8f0;border-radius:10px;text-align:center;font-weight:900;letter-spacing:3px;font-size:16px;direction:ltr">' +
      '<button type="button" id="' + id + '_vfy" style="background:#059669;color:#fff;border:0;border-radius:10px;padding:8px 16px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer">تایید رمز</button>' +
      '<span id="' + id + '_cnt" style="font-weight:900;color:#ef4b1a;font-size:14px;direction:ltr;min-width:44px;display:inline-block;text-align:center"></span>' +
      '</div>' +
      '<div id="' + id + '_done" style="display:none;margin-top:8px;color:#059669;font-weight:900;font-size:13.5px">✅ شماره تلفن با موفقیت تایید شد</div>' +
      '<div id="' + id + '_msg" style="margin-top:6px;font-size:12px;color:#b45309"></div></div>';

    function setMsg(t, red) {
      var m = document.getElementById(id + '_msg');
      m.textContent = t || '';
      m.style.color = red ? '#dc2626' : '#b45309';
    }

    function countdown(sec) {
      var el = document.getElementById(id + '_cnt');
      var sendBtn = document.getElementById(id + '_send');
      clearInterval(otp.timer);
      sendBtn.disabled = true;
      sendBtn.style.opacity = '.45';
      sendBtn.textContent = 'رمز ارسال شد';
      function tick() {
        if (otp.verified) { clearInterval(otp.timer); el.textContent = ''; return; }
        if (sec <= 0) {
          clearInterval(otp.timer);
          el.textContent = '';
          sendBtn.disabled = false;
          sendBtn.style.opacity = '1';
          sendBtn.textContent = '🔄 ارسال مجدد رمز';
          return;
        }
        var m = Math.floor(sec / 60), s = sec % 60;
        el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        sec--;
      }
      tick();
      otp.timer = setInterval(tick, 1000);
    }

    document.getElementById(id + '_send').addEventListener('click', function () {
      var phone = (document.getElementById(phoneId) || { value: '' }).value.replace(/\D/g, '');
      if (!/^09\d{9}$/.test(phone)) { setMsg('ابتدا شماره موبایل معتبر (09xxxxxxxxx) را در فرم وارد کنید', true); return; }
      if (!ptfCaptchaValid()) { setMsg(ptfCaptchaMsg, true); return; }
      var fd = new FormData();
      fd.append('phone', phone);
      ptfCaptchaAppend(fd);
      setMsg('در حال ارسال...');
      fetch(API + '?action=otp_send', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok && d.degraded && d.otp_token) {
            otp.verified = true;
            otp.smsOff = true;
            otp.token = d.otp_token;
            document.getElementById(id + '_vbox').style.display = 'none';
            document.getElementById(id + '_send').style.display = 'none';
            document.getElementById(id + '_done').style.display = 'block';
            document.getElementById(id + '_done').textContent = d.message || 'سامانه پیامک موقتاً در دسترس نیست — ثبت‌نام با بررسی تلفنی ادامه می‌یابد';
            setMsg('');
          } else if (d.ok) {
            otp.sends++;
            document.getElementById(id + '_vbox').style.display = 'flex';
            setMsg('رمز پیامک شد — ' + (d.left != null ? 'ارسال‌های باقیمانده: ' + d.left : ''));
            countdown(d.ttl || 120);
          } else if (d.error === 'sms_off') {
            // AC5: پنل پیامک هنوز فعال نیست → ثبت‌نام بدون OTP (کپچا همچنان الزامی)
            otp.smsOff = true;
            document.getElementById(id + '_done').style.display = 'block';
            document.getElementById(id + '_done').textContent = 'ℹ️ سامانه پیامکی هنوز فعال نشده — ثبت‌نام بدون تایید پیامکی ادامه می‌یابد';
            document.getElementById(id + '_send').style.display = 'none';
            setMsg('');
          } else if (d.error === 'locked') {
            setMsg(d.message || 'این آدرس به دلیل درخواست‌های مکرر ۲۴ ساعت مسدود شد', true);
            document.getElementById(id + '_send').disabled = true;
            document.getElementById(id + '_send').style.opacity = '.4';
          } else {
            setMsg(d.message || d.error || 'خطا در ارسال', true);
          }
        })
        .catch(function () { setMsg('عدم دسترسی به سرور — بعداً تلاش کنید', true); });
    });

    document.getElementById(id + '_vfy').addEventListener('click', function () {
      var phone = (document.getElementById(phoneId) || { value: '' }).value.replace(/\D/g, '');
      var code = document.getElementById(id + '_code').value.trim();
      if (code.length < 4) { setMsg('رمز ۵ رقمی پیامک‌شده را وارد کنید', true); return; }
      var fd = new FormData();
      fd.append('phone', phone);
      fd.append('code', code);
      fetch(API + '?action=otp_verify', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok && d.otp_token) {
            otp.verified = true;
            otp.token = d.otp_token;
            clearInterval(otp.timer);
            document.getElementById(id + '_vbox').style.display = 'none';
            document.getElementById(id + '_send').style.display = 'none';
            document.getElementById(id + '_done').style.display = 'block';
            setMsg('');
          } else setMsg(d.error || 'رمز نادرست', true);
        })
        .catch(function () { setMsg('عدم دسترسی به سرور', true); });
    });
  };
})();

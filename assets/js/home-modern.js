/* ==========================================================================
   PTF — home-modern.js — v34.38.25
   داینامیک‌سازی بدون تغییر محتوا
   ========================================================================== */
(function(){
  'use strict';

  /* 1. Scroll Progress Bar */
  function initProgress(){
    var bar = document.createElement('div');
    bar.id = 'ptf-scroll-progress';
    document.body.prepend(bar);
    var ticking = false;
    function update(){
      var h = document.documentElement;
      var scrolled = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      bar.style.transform = 'scaleX(' + (scrolled/100) + ')';
      ticking = false;
    }
    window.addEventListener('scroll', function(){
      if(!ticking){ requestAnimationFrame(update); ticking = true; }
    }, {passive:true});
    update();
  }

  /* 2. Hero Orbs — inject without touching HTML content */
  function initOrbs(){
    var hero = document.querySelector('.hero');
    if(!hero) return;
    ['ptf-orb-1','ptf-orb-2','ptf-orb-3'].forEach(function(cls){
      var orb = document.createElement('div');
      orb.className = 'ptf-orb ' + cls;
      orb.setAttribute('aria-hidden','true');
      hero.appendChild(orb);
    });
  }

  /* 3. Count-up for data-counter */
  function initCounters(){
    var counters = document.querySelectorAll('[data-counter]');
    if(!counters.length) return;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var raw = el.getAttribute('data-counter') || el.textContent;
        var num = parseInt(String(raw).replace(/[^0-9]/g,''),10);
        var suffix = String(raw).replace(/[0-9]/g,'').trim(); // + or text like RFQ
        var hasPlus = raw.indexOf('+')>-1;
        if(isNaN(num) || num>1000){ // for RFQ/AVL keep as is with animation
          el.style.transform = 'scale(1.15)';
          setTimeout(function(){ el.style.transform=''; }, 320);
          return;
        }
        var start = 0, duration = 1200, startTime = null;
        function step(ts){
          if(!startTime) startTime = ts;
          var p = Math.min((ts - startTime)/duration, 1);
          var eased = 1 - Math.pow(1-p, 3); // easeOutCubic
          var cur = Math.round(start + (num - start)*eased);
          el.textContent = (hasPlus?'+':'') + cur + (suffix && !hasPlus ? suffix : '');
          if(p<1) requestAnimationFrame(step);
          else el.textContent = raw; // restore original like +۱۴
        }
        requestAnimationFrame(step);
      });
    }, {threshold:.6});
    counters.forEach(function(c){ io.observe(c); });
  }

  /* 4. Stats count-up */
  function initStats(){
    var stats = document.querySelectorAll('#stats [style*=\"border-top\"] div[style*=\"font-size:2.4rem\"]');
    stats.forEach(function(el){
      var raw = el.textContent.trim();
      var num = parseInt(raw,10);
      if(isNaN(num)) return;
      var suffix = raw.replace(/[0-9]/g,'');
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(!entry.isIntersecting) return;
          io.unobserve(entry.target);
          var start=0, dur=1100, st=null;
          function step(ts){
            if(!st) st=ts;
            var p=Math.min((ts-st)/dur,1);
            var eased=1-Math.pow(1-p,3);
            el.textContent = Math.round(start + (num-start)*eased) + suffix;
            if(p<1) requestAnimationFrame(step);
            else el.textContent = raw;
          }
          requestAnimationFrame(step);
        });
      }, {threshold:.6});
      io.observe(el);
    });
  }

  /* 5. Magnetic Buttons */
  function initMagnetic(){
    var btns = document.querySelectorAll('.btn');
    btns.forEach(function(btn){
      btn.addEventListener('mousemove', function(e){
        var r = btn.getBoundingClientRect();
        var x = ((e.clientX - r.left)/r.width)*100;
        var y = ((e.clientY - r.top)/r.height)*100;
        btn.style.setProperty('--mx', x+'%');
        btn.style.setProperty('--my', y+'%');
        // subtle magnetic pull
        var dx = (e.clientX - (r.left + r.width/2)) * 0.12;
        var dy = (e.clientY - (r.top + r.height/2)) * 0.18;
        btn.style.transform = 'translate('+dx+'px,'+dy+'px)';
      });
      btn.addEventListener('mouseleave', function(){
        btn.style.transform = '';
      });
    });
  }

  /* 6. Tilt for cards (Journey + Why PTF + Service) */
  function initTilt(){
    var cards = document.querySelectorAll('#journey a[data-ptf-event], #why-ptf [style*=\"background:#f8fafc\"], .service-card');
    cards.forEach(function(card){
      card.addEventListener('mousemove', function(e){
        var r = card.getBoundingClientRect();
        var x = ((e.clientX - r.left)/r.width)*100;
        var y = ((e.clientY - r.top)/r.height)*100;
        card.style.setProperty('--mx', x+'%');
        card.style.setProperty('--my', y+'%');
        if(card.matches('#journey a')){
          var rx = ((e.clientY - r.top)/r.height - .5) * -6;
          var ry = ((e.clientX - r.left)/r.width - .5) * 8;
          card.style.transform = 'translateY(-6px) rotateX('+rx+'deg) rotateY('+ry+'deg)';
        }
      });
      card.addEventListener('mouseleave', function(){
        card.style.transform = '';
      });
    });
  }

  /* 7. Hero slider — add progress and Ken Burns reset */
  function initHeroSlider(){
    var slides = document.querySelectorAll('.hero .slide');
    var dotsWrap = document.getElementById('sliderDots');
    if(!slides.length || !dotsWrap) return;
    // enhance existing goSlide
    var origGoSlide = window.goSlide;
    // we hook via MutationObserver on active class
    var observer = new MutationObserver(function(){
      slides.forEach(function(s){
        if(s.classList.contains('active')){
          s.style.animation = 'none';
          void s.offsetWidth;
          s.style.animation = '';
        }
      });
    });
    slides.forEach(function(s){ observer.observe(s, {attributes:true, attributeFilter:['class']}); });
  }

  /* 8. FAQ — close others when opening (optional, keeps content) */
  function initFAQ(){
    var faqs = document.querySelectorAll('#home-faq details');
    faqs.forEach(function(det){
      det.addEventListener('toggle', function(){
        if(det.open){
          // optional: close others for focus
          // faqs.forEach(function(other){ if(other!==det) other.open=false; });
          try{ window.ptfTrack && window.ptfTrack('faq_open', {q: det.querySelector('summary').textContent.trim().slice(0,60)}); }catch(e){}
        }
      });
    });
  }

  /* 9. Reveal stagger — add delay based on index */
  function initRevealStagger(){
    var groups = document.querySelectorAll('.trust-grid, .service-cards, #journey [style*=\"grid-template-columns\"]');
    groups.forEach(function(group){
      var items = group.querySelectorAll('.reveal');
      items.forEach(function(item, i){
        item.style.animationDelay = (i*0.07)+'s';
      });
    });
  }

  /* 10. Smooth scroll for anchor links */
  function initSmoothScroll(){
    document.querySelectorAll('a[href^=\"#\"]').forEach(function(a){
      a.addEventListener('click', function(e){
        var href = a.getAttribute('href');
        if(href.length<=1) return;
        var target = document.querySelector(href);
        if(!target) return;
        e.preventDefault();
        target.scrollIntoView({behavior:'smooth', block:'start'});
        history.pushState(null,'',href);
      });
    });
  }

  /* 11. Header — add subtle shadow on scroll already exists, enhance */
  function initHeader(){
    var header = document.querySelector('.site-header');
    if(!header) return;
    window.addEventListener('scroll', function(){
      var y = window.scrollY;
      header.style.setProperty('--scroll', Math.min(y/200,1));
    }, {passive:true});
  }

  /* Init */
  document.addEventListener('DOMContentLoaded', function(){
    initProgress();
    initOrbs();
    initCounters();
    initStats();
    initMagnetic();
    initTilt();
    initHeroSlider();
    initFAQ();
    initRevealStagger();
    initSmoothScroll();
    initHeader();
  });

})();

/* ==========================================================================
   v34.38.26 — لایه دوم مدرن‌سازی بدون تغییر محتوا
   ========================================================================== */
(function(){
  'use strict';

  /* 12. Cursor Spotlight */
  function initSpotlight(){
    var spot = document.createElement('div');
    spot.id = 'ptf-cursor-spot';
    document.body.appendChild(spot);
    var raf = null, x=0, y=0;
    function move(e){
      x = (e.clientX / window.innerWidth)*100;
      y = (e.clientY / window.innerHeight)*100;
      if(raf) return;
      raf = requestAnimationFrame(function(){
        spot.style.setProperty('--x', x+'%');
        spot.style.setProperty('--y', y+'%');
        raf = null;
      });
    }
    window.addEventListener('mousemove', move, {passive:true});
    window.addEventListener('mouseenter', function(){ document.body.classList.add('ptf-spot-active'); });
    window.addEventListener('mouseleave', function(){ document.body.classList.remove('ptf-spot-active'); });
  }

  /* 13. Parallax for Hero */
  function initParallax(){
    var heroCopy = document.querySelector('.hero-copy');
    var heroPanel = document.querySelector('.hero-panel');
    var hero = document.querySelector('.hero');
    if(!hero) return;
    var ticking=false;
    function onScroll(){
      if(ticking) return;
      ticking=true;
      requestAnimationFrame(function(){
        var y = window.scrollY;
        var prog = Math.min(y / (hero.offsetHeight || 600), 1);
        if(heroCopy) heroCopy.style.transform = 'translate3d(0,'+(prog*38)+'px,0)';
        if(heroPanel) heroPanel.style.transform = 'translate3d(0,'+(prog*22)+'px,0)';
        // orbs move opposite
        document.querySelectorAll('.ptf-orb').forEach(function(orb, i){
          var factor = (i+1)*0.12;
          orb.style.transform = 'translate3d('+(prog*20*factor)+'px,'+(-prog*30*factor)+'px,0) scale('+(1+prog*0.06)+')';
        });
        ticking=false;
      });
    }
    window.addEventListener('scroll', onScroll, {passive:true});
  }

  /* 14. Section in-view + gradient dividers */
  function initSectionView(){
    var sections = document.querySelectorAll('.section');
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('ptf-in-view');
          // random orb position for mesh
          entry.target.style.setProperty('--ox', (30+Math.random()*60)+'%');
          entry.target.style.setProperty('--oy', (10+Math.random()*40)+'%');
        }
      });
    }, {threshold:0.12});
    sections.forEach(function(s){ io.observe(s); });
  }

  /* 15. Image reveal */
  function initImgReveal(){
    var imgs = document.querySelectorAll('.about-images img, .service-card .card-img img, .contact-info img');
    imgs.forEach(function(img){
      img.classList.add('ptf-img-reveal');
    });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('ptf-visible');
          io.unobserve(entry.target);
        }
      });
    }, {threshold:0.22, rootMargin:'0px 0px -10% 0px'});
    imgs.forEach(function(img){ io.observe(img); });
  }

  /* 16. Live RFQ Ticker — reads from localStorage ptf_local_rfqs */
  function initLiveRfq(){
    var box = document.createElement('div');
    box.id = 'ptf-live-rfq';
    document.body.appendChild(box);
    function render(){
      try{
        var list = JSON.parse(localStorage.getItem('ptf_local_rfqs') || '[]');
        if(!list.length) return;
        var last = list[0];
        var code = last.code || '';
        if(!code) return;
        box.innerHTML = '<b>●</b> آخرین استعلام شما: <span dir="ltr" style="font-weight:900;letter-spacing:.5px">'+code+'</span> <a href="tracking/?code='+encodeURIComponent(code)+'">رهگیری ←</a>';
        box.classList.add('ptf-show');
        setTimeout(function(){ box.classList.remove('ptf-show'); }, 8000);
      }catch(e){}
    }
    // show after 1.5s, and on new RFQ
    setTimeout(render, 1800);
    window.addEventListener('storage', function(e){
      if(e.key==='ptf_local_rfqs') render();
    });
    // also hook fetch success
    var origTrack = window.ptfTrack;
    window.ptfTrack = function(ev, data){
      try{ if(origTrack) origTrack(ev,data); }catch(e){}
      if(ev==='home_rfq_submit_success' || ev==='rfq_submit_success') setTimeout(render, 400);
    };
  }

  /* 17. Header hide/show on scroll */
  function initHeaderHide(){
    var header = document.querySelector('.site-header');
    if(!header) return;
    var lastY = window.scrollY, ticking=false;
    function onScroll(){
      if(ticking) return;
      ticking=true;
      requestAnimationFrame(function(){
        var y = window.scrollY;
        if(y>320){
          if(y>lastY && y-lastY>8) header.classList.add('ptf-hide');
          else if(lastY-y>8) header.classList.remove('ptf-hide');
        }else{
          header.classList.remove('ptf-hide');
        }
        lastY=y;
        ticking=false;
      });
    }
    window.addEventListener('scroll', onScroll, {passive:true});
  }

  /* 18. FAQ smooth height */
  function initFaqSmooth(){
    var details = document.querySelectorAll('#home-faq details');
    details.forEach(function(det){
      var p = det.querySelector('p');
      if(!p) return;
      function setH(){
        det.style.setProperty('--h', p.scrollHeight+16+'px');
      }
      setH();
      det.addEventListener('toggle', function(){
        if(det.open) setH();
      });
      window.addEventListener('resize', setH);
    });
  }

  /* 19. Footer wave */
  function initFooterWave(){
    var footer = document.querySelector('.footer');
    if(!footer) return;
    var wave = document.createElement('div');
    wave.className = 'ptf-footer-wave';
    footer.prepend(wave);
  }

  /* 20. Hero live badge — inject without changing content */
  function initHeroLive(){
    var actions = document.querySelector('.hero-actions');
    if(!actions) return;
    var badge = document.createElement('div');
    badge.className = 'ptf-hero-live';
    badge.innerHTML = '<i></i> پاسخ‌گویی آنلاین · رهگیری ۲۴ ساعته · اصالت کالا';
    badge.setAttribute('aria-hidden','true');
    actions.parentNode.insertBefore(badge, actions.nextSibling);
  }

  /* 21. Service cards — add glow on mouse move */
  function initCardGlow(){
    var cards = document.querySelectorAll('.service-card, .trust-item, #journey a');
    cards.forEach(function(card){
      card.addEventListener('mousemove', function(e){
        var r=card.getBoundingClientRect();
        var x=((e.clientX-r.left)/r.width)*100;
        var y=((e.clientY-r.top)/r.height)*100;
        card.style.setProperty('--mx', x+'%');
        card.style.setProperty('--my', y+'%');
      });
    });
  }

  /* 22. Preloader — keep logo but add text */
  function initPreloader(){
    var pre = document.getElementById('preloader');
    if(!pre) return;
    // add subtle text under logo if not exists
    if(!pre.querySelector('.ptf-pre-text')){
      var t=document.createElement('div');
      t.className='ptf-pre-text';
      t.textContent='Pishro Tajhiz Fartak';
      t.style.cssText='margin-top:14px;font-weight:900;letter-spacing:1px;color:#ef4b1a;font-size:12px;opacity:.8';
      pre.appendChild(t);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    initSpotlight();
    initParallax();
    initSectionView();
    initImgReveal();
    initLiveRfq();
    initHeaderHide();
    initFaqSmooth();
    initFooterWave();
    initHeroLive();
    initCardGlow();
    initPreloader();
  });

})();

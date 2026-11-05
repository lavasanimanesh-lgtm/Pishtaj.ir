/**
 * UX/UI Pro Max Interactions for CRM
 * Based on UX/UI Pro Max Skill (161 reasoning rules, 99 UX guidelines)
 * Version: 1.0
 * Date: 2026-11-04
 * 
 * این فایل تمام micro-interactions و رفتارهای پویا را پیاده‌سازی می‌کند
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    TOAST_DURATION: 3000,
    SCROLL_THRESHOLD: 100,
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 250,
    TOUCH_TARGET_SIZE: 48,
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function
   */
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Check if element is in viewport
   */
  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. TOAST NOTIFICATION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    // Remove existing toast
    const existingToast = document.querySelector('.ptf-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `ptf-toast ptf-toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    document.body.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('ptf-toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);

    // Announce to screen readers
    announceToScreenReader(message);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. SCROLL PROGRESS INDICATOR
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create and update scroll progress indicator
   */
  function initScrollProgress() {
    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'ptf-scroll-progress';
    document.body.appendChild(progressBar);

    // Update on scroll
    const updateProgress = throttle(() => {
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (window.scrollY / windowHeight) * 100;
      progressBar.style.width = `${scrolled}%`;
    }, 100);

    window.addEventListener('scroll', updateProgress, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. SMOOTH SCROLL FOR ANCHOR LINKS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Smooth scroll to anchor links
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          // Update URL without scroll
          history.pushState(null, null, targetId);

          // Focus target for accessibility
          target.setAttribute('tabindex', '-1');
          target.focus();

          // Announce to screen readers
          announceToScreenReader('به بخش مورد نظر منتقل شدید');
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. INTERSECTION OBSERVER FOR ANIMATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Animate elements when they come into view
   */
  function initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('ptf-fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe cards and panels
    document.querySelectorAll('.pn, .ptf-card, .card').forEach(el => {
      observer.observe(el);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Keyboard shortcuts system
   */
  function initKeyboardShortcuts() {
    const shortcuts = {
      'Ctrl+K': () => {
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput) {
          searchInput.focus();
          showToast('جستجو فعال شد', 'info', 1500);
        }
      },
      'Ctrl+S': () => {
        const saveBtn = document.querySelector('button[type="submit"], .btn-save');
        if (saveBtn) {
          saveBtn.click();
          showToast('ذخیره شد', 'success', 1500);
        }
      },
      'Escape': () => {
        // Close modals
        const modals = document.querySelectorAll('.md-b, .ptf-modal');
        modals.forEach(modal => {
          if (modal.style.display !== 'none') {
            modal.style.display = 'none';
            showToast('پنجره بسته شد', 'info', 1500);
          }
        });
      }
    };

    document.addEventListener('keydown', (e) => {
      const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.key.toUpperCase()}`;
      
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. FORM ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Form auto-save draft
   */
  function initFormAutoSave() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      const formId = form.id || `form-${Math.random().toString(36).substr(2, 9)}`;
      
      // Load draft
      const draft = localStorage.getItem(`draft-${formId}`);
      if (draft) {
        try {
          const data = JSON.parse(draft);
          Object.keys(data).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
              input.value = data[key];
            }
          });
          showToast('پیش‌نویس بازیابی شد', 'info', 2000);
        } catch (e) {
          console.warn('Failed to load draft:', e);
        }
      }

      // Auto-save on input
      const saveDraft = debounce(() => {
        const formData = {};
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
          if (input.name && input.type !== 'submit') {
            formData[input.name] = input.value;
          }
        });

        localStorage.setItem(`draft-${formId}`, JSON.stringify(formData));
      }, CONFIG.DEBOUNCE_DELAY);

      form.addEventListener('input', saveDraft);

      // Clear draft on submit
      form.addEventListener('submit', () => {
        localStorage.removeItem(`draft-${formId}`);
        showToast('فرم با موفقیت ارسال شد', 'success');
      });
    });
  }

  /**
   * Form validation feedback
   */
  function initFormValidation() {
    const inputs = document.querySelectorAll('input[required], textarea[required], select[required]');
    
    inputs.forEach(input => {
      // Validate on blur
      input.addEventListener('blur', function() {
        validateField(this);
      });

      // Clear error on input
      input.addEventListener('input', function() {
        if (this.classList.contains('is-invalid')) {
          this.classList.remove('is-invalid');
          const errorEl = this.parentElement.querySelector('.error');
          if (errorEl) {
            errorEl.style.display = 'none';
          }
        }
      });
    });
  }

  /**
   * Validate a single field
   */
  function validateField(field) {
    const isValid = field.checkValidity();
    const errorEl = field.parentElement.querySelector('.error');
    
    if (!isValid) {
      field.classList.add('is-invalid');
      
      if (errorEl) {
        let errorMsg = '';
        
        if (field.validity.valueMissing) {
          errorMsg = 'این فیلد الزامی است';
        } else if (field.validity.typeMismatch) {
          if (field.type === 'email') {
            errorMsg = 'لطفاً یک ایمیل معتبر وارد کنید';
          } else if (field.type === 'tel') {
            errorMsg = 'لطفاً یک شماره تلفن معتبر وارد کنید';
          }
        } else if (field.validity.patternMismatch) {
          errorMsg = 'فرمت وارد شده صحیح نیست';
        }
        
        errorEl.textContent = errorMsg;
        errorEl.style.display = 'block';
      }
    }
    
    return isValid;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. ACCESSIBILITY ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create live region for screen readers
   */
  function createLiveRegion() {
    if (document.querySelector('.ptf-live-region')) return;
    
    const liveRegion = document.createElement('div');
    liveRegion.className = 'ptf-live-region';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
    document.body.appendChild(liveRegion);
  }

  /**
   * Announce message to screen readers
   */
  function announceToScreenReader(message) {
    const liveRegion = document.querySelector('.ptf-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 3000);
    }
  }

  /**
   * Enhance button accessibility
   */
  function enhanceButtonAccessibility() {
    const buttons = document.querySelectorAll('button:not([aria-label])');
    
    buttons.forEach(btn => {
      const text = btn.textContent.trim();
      const title = btn.getAttribute('title');
      
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', title || text || 'دکمه');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. EMPTY STATES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show empty state when no data
   */
  function showEmptyState(container, message, actionText, actionUrl) {
    if (!container) return;
    
    // Check if already has content
    if (container.children.length > 0) return;
    
    const emptyState = document.createElement('div');
    emptyState.className = 'ptf-empty-state';
    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h3>${message || 'موردی یافت نشد'}</h3>
      <p>برای شروع، یک مورد جدید اضافه کنید یا فیلترها را تغییر دهید.</p>
      ${actionText ? `<a href="${actionUrl || '#'}" class="btn bt">${actionText}</a>` : ''}
    `;
    
    container.appendChild(emptyState);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. PERFORMANCE OPTIMIZATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Lazy load images
   */
  function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 10. INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    console.log('✅ UX/UI Pro Max Interactions initialized');
    
    // Create live region first
    createLiveRegion();
    
    // Initialize all features
    initScrollProgress();
    initSmoothScroll();
    initScrollAnimations();
    initKeyboardShortcuts();
    initFormAutoSave();
    initFormValidation();
    enhanceButtonAccessibility();
    initLazyLoading();
    
    // Expose utility functions globally
    window.ptfUX = {
      showToast,
      announceToScreenReader,
      showEmptyState,
      debounce,
      throttle
    };
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/**
 * UX Enhancements - Loading States, Form Validation, Empty States
 * Based on UI/UX Pro Max Skill recommendations
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. LOADING STATES FOR FORMS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show loading state on form submit
   */
  function initFormLoadingStates() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      form.addEventListener('submit', function(e) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        
        if (submitBtn && !submitBtn.disabled) {
          // Add loading state
          submitBtn.classList.add('is-loading');
          submitBtn.disabled = true;
          
          // Store original text
          if (submitBtn.tagName === 'BUTTON') {
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = 'در حال ارسال...';
          }
          
          // Re-enable after 30 seconds (safety timeout)
          setTimeout(() => {
            if (submitBtn.classList.contains('is-loading')) {
              submitBtn.classList.remove('is-loading');
              submitBtn.disabled = false;
              if (submitBtn.tagName === 'BUTTON' && submitBtn.dataset.originalText) {
                submitBtn.textContent = submitBtn.dataset.originalText;
              }
            }
          }, 30000);
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. INLINE FORM VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show validation errors inline
   */
  function initInlineValidation() {
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
        // Get validation message
        let errorMsg = '';
        
        if (field.validity.valueMissing) {
          errorMsg = 'این فیلد الزامی است';
        } else if (field.validity.typeMismatch) {
          if (field.type === 'email') {
            errorMsg = 'لطفاً یک ایمیل معتبر وارد کنید';
          } else if (field.type === 'tel') {
            errorMsg = 'لطفاً یک شماره تلفن معتبر وارد کنید';
          } else if (field.type === 'url') {
            errorMsg = 'لطفاً یک آدرس وب معتبر وارد کنید';
          }
        } else if (field.validity.patternMismatch) {
          errorMsg = 'فرمت وارد شده صحیح نیست';
        } else if (field.validity.tooShort) {
          errorMsg = `حداقل ${field.minLength} کاراکتر وارد کنید`;
        } else if (field.validity.tooLong) {
          errorMsg = `حداکثر ${field.maxLength} کاراکتر وارد کنید`;
        }
        
        errorEl.textContent = errorMsg;
        errorEl.style.display = 'block';
      }
    } else {
      field.classList.remove('is-invalid');
      if (errorEl) {
        errorEl.style.display = 'none';
      }
    }
    
    return isValid;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. ERROR SUMMARY FOR FORMS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show error summary at top of form
   */
  function showErrorSummary(form, errors) {
    let summaryEl = form.querySelector('.ptf-error-summary');
    
    if (!summaryEl) {
      summaryEl = document.createElement('div');
      summaryEl.className = 'ptf-error-summary';
      summaryEl.setAttribute('role', 'alert');
      summaryEl.setAttribute('aria-live', 'polite');
      form.insertBefore(summaryEl, form.firstChild);
    }
    
    let html = '<h3>لطفاً خطاهای زیر را اصلاح کنید:</h3>';
    html += '<ul>';
    
    errors.forEach(error => {
      html += `<li><a href="#${error.fieldId}">${error.message}</a></li>`;
    });
    
    html += '</ul>';
    summaryEl.innerHTML = html;
    summaryEl.style.display = 'block';
    
    // Focus first error
    const firstErrorLink = summaryEl.querySelector('a');
    if (firstErrorLink) {
      firstErrorLink.focus();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. LIVE REGION FOR DYNAMIC CONTENT
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
    document.body.appendChild(liveRegion);
  }

  /**
   * Announce message to screen readers
   */
  function announce(message) {
    const liveRegion = document.querySelector('.ptf-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
      
      // Clear after 3 seconds
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 3000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. SMOOTH SCROLL FOR ANCHOR LINKS
  // ═══════════════════════════════════════════════════════════════════════════════

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
          
          // Focus target for accessibility
          target.setAttribute('tabindex', '-1');
          target.focus();
          
          // Announce to screen readers
          announce('به بخش مورد نظر منتقل شدید');
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. FOCUS MANAGEMENT FOR MODALS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Trap focus in modal
   */
  function trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    modal.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
      
      if (e.key === 'Escape') {
        closeModal(modal);
      }
    });
    
    // Focus first element
    firstFocusable.focus();
  }

  /**
   * Close modal
   */
  function closeModal(modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    
    // Return focus to trigger
    if (modal.dataset.triggerId) {
      const trigger = document.getElementById(modal.dataset.triggerId);
      if (trigger) {
        trigger.focus();
      }
    }
    
    announce('پنجره بسته شد');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. PERFORMANCE: DEBOUNCE AND THROTTLE
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. SEARCH EMPTY STATE
  // ═══════════════════════════════════════════════════════════════════════════════

  function initSearchEmptyState() {
    const searchInputs = document.querySelectorAll('input[type="search"]');
    
    searchInputs.forEach(input => {
      input.addEventListener('input', debounce(function() {
        const query = this.value.trim();
        const resultsContainer = document.querySelector('.search-results, .ptf-search-results');
        
        if (query.length > 0 && resultsContainer) {
          // Check if results are empty
          const results = resultsContainer.querySelectorAll('.search-result-item, .ptf-result-item');
          
          if (results.length === 0) {
            showEmptyState(resultsContainer, query);
          }
        }
      }, 300));
    });
  }

  function showEmptyState(container, query) {
    let emptyState = container.querySelector('.ptf-empty-state');
    
    if (!emptyState) {
      emptyState = document.createElement('div');
      emptyState.className = 'ptf-empty-state';
      emptyState.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <h3>نتیجه‌ای یافت نشد</h3>
        <p>متأسفانه نتیجه‌ای برای "${query}" پیدا نشد. لطفاً کلمات دیگری را امتحان کنید.</p>
        <a href="/contact/" class="ptf-btn">تماس با ما</a>
      `;
      container.appendChild(emptyState);
    }
    
    announce('نتیجه‌ای یافت نشد');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. SCROLL PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════════════════

  function initScrollPerformance() {
    // Throttle scroll events
    const handleScroll = throttle(function() {
      // Add scrolled class to header
      const header = document.querySelector('#top[data-ptf-shell="header"]');
      if (header) {
        if (window.scrollY > 10) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
    }, 100);
    
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    createLiveRegion();
    initFormLoadingStates();
    initInlineValidation();
    initSmoothScroll();
    initSearchEmptyState();
    initScrollPerformance();
    
    console.log('✅ UX Enhancements initialized');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

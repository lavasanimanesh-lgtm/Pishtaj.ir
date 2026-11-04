/**
 * CRM UX Enhancements - Mobile JavaScript
 * Phase 1-5: Accessibility, Performance, Touch Targets, Forms, UI
 * Based on comprehensive UX audit (2026-11-04)
 */

(function() {
  'use strict';

  const BP = 768; // Mobile breakpoint

  function isMob() {
    return window.innerWidth <= BP;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE 1: ACCESSIBILITY ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Add ARIA labels to buttons without labels
   */
  function enhanceButtonAccessibility() {
    if (!isMob()) return;

    // Find all buttons without aria-label
    const buttons = document.querySelectorAll('button:not([aria-label])');
    buttons.forEach(btn => {
      // Try to infer label from content
      const text = btn.textContent.trim();
      const title = btn.getAttribute('title');
      const onclick = btn.getAttribute('onclick');
      
      let label = title || text;
      
      // If no text, try to infer from onclick
      if (!label && onclick) {
        if (/edit|ویرایش/.test(onclick)) label = 'ویرایش';
        else if (/delete|حذف/.test(onclick)) label = 'حذف';
        else if (/view|مشاهده/.test(onclick)) label = 'مشاهده';
        else if (/save|ذخیره/.test(onclick)) label = 'ذخیره';
        else if (/cancel|لغو/.test(onclick)) label = 'لغو';
        else if (/close|بستن/.test(onclick)) label = 'بستن';
        else if (/print|چاپ/.test(onclick)) label = 'چاپ';
      }
      
      if (label) {
        btn.setAttribute('aria-label', label);
      }
    });

    // Add aria-label to icon-only links
    const links = document.querySelectorAll('a:not([aria-label])');
    links.forEach(link => {
      const text = link.textContent.trim();
      const title = link.getAttribute('title');
      
      if (!text && title) {
        link.setAttribute('aria-label', title);
      }
    });
  }

  /**
   * Add alt text to images without alt
   */
  function enhanceImageAccessibility() {
    const images = document.querySelectorAll('img:not([alt])');
    images.forEach(img => {
      const src = img.getAttribute('src');
      const title = img.getAttribute('title');
      
      // Try to infer alt from filename or title
      let alt = title || '';
      
      if (!alt && src) {
        const filename = src.split('/').pop().split('.')[0];
        alt = filename.replace(/[-_]/g, ' ');
      }
      
      if (alt) {
        img.setAttribute('alt', alt);
      } else {
        // Decorative image
        img.setAttribute('alt', '');
        img.setAttribute('role', 'presentation');
      }
    });
  }

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
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 3000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE 2: TOUCH TARGET ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Ensure all interactive elements have minimum touch target size
   */
  function enhanceTouchTargets() {
    if (!isMob()) return;

    const interactiveElements = document.querySelectorAll(
      'button, .btn, .bt, .bt-o, .ba, a.btn, a.bt, input[type="button"], input[type="submit"]'
    );

    interactiveElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      
      // If element is smaller than 44px, add padding
      if (rect.width < 44 || rect.height < 44) {
        const currentPadding = window.getComputedStyle(el).padding;
        el.style.setProperty('min-height', '44px', 'important');
        el.style.setProperty('min-width', '44px', 'important');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE 3: FORM VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Add inline validation to forms
   */
  function enhanceFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
      
      inputs.forEach(input => {
        // Add error message element if not exists
        if (!input.nextElementSibling || !input.nextElementSibling.classList.contains('error')) {
          const errorEl = document.createElement('small');
          errorEl.className = 'error';
          errorEl.setAttribute('aria-live', 'polite');
          input.parentNode.insertBefore(errorEl, input.nextSibling);
        }

        // Validate on blur
        input.addEventListener('blur', function() {
          validateField(this);
        });

        // Clear error on input
        input.addEventListener('input', function() {
          if (this.classList.contains('is-invalid')) {
            this.classList.remove('is-invalid');
            const errorEl = this.nextElementSibling;
            if (errorEl && errorEl.classList.contains('error')) {
              errorEl.style.display = 'none';
            }
          }
        });
      });

      // Form submit with loading state
      form.addEventListener('submit', function(e) {
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (submitBtn) {
          // Validate all required fields
          const invalidFields = form.querySelectorAll(':invalid');
          
          if (invalidFields.length > 0) {
            e.preventDefault();
            invalidFields[0].focus();
            announce('لطفاً خطاهای فرم را اصلاح کنید');
            return;
          }
          
          // Show loading state
          submitBtn.classList.add('is-loading');
          submitBtn.disabled = true;
          
          // Re-enable after 30 seconds (safety timeout)
          setTimeout(() => {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
          }, 30000);
        }
      });
    });
  }

  /**
   * Validate a single field
   */
  function validateField(field) {
    const isValid = field.checkValidity();
    const errorEl = field.nextElementSibling;
    
    if (!isValid) {
      field.classList.add('is-invalid');
      
      if (errorEl && errorEl.classList.contains('error')) {
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
      
      if (errorEl && errorEl.classList.contains('error')) {
        errorEl.style.display = 'none';
      }
    }
    
    return isValid;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE 4: PERFORMANCE - SKELETON LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show skeleton loading for cards
   */
  function showSkeletonLoading(container) {
    if (!container) return;
    
    const skeleton = document.createElement('div');
    skeleton.className = 'ptf-skeleton-card';
    skeleton.innerHTML = `
      <div class="ptf-skeleton ptf-skeleton-title"></div>
      <div class="ptf-skeleton ptf-skeleton-text"></div>
      <div class="ptf-skeleton ptf-skeleton-text" style="width: 80%"></div>
      <div class="ptf-skeleton ptf-skeleton-text" style="width: 60%"></div>
    `;
    
    container.appendChild(skeleton);
  }

  /**
   * Remove skeleton loading
   */
  function removeSkeletonLoading(container) {
    if (!container) return;
    
    const skeletons = container.querySelectorAll('.ptf-skeleton-card');
    skeletons.forEach(skeleton => skeleton.remove());
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE 5: UI ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show empty state when no data
   */
  function showEmptyState(container, message, actionText, actionUrl) {
    if (!container) return;
    
    const emptyState = document.createElement('div');
    emptyState.className = 'ptf-empty-state';
    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h3>${message || 'موردی یافت نشد'}</h3>
      ${actionText ? `<a href="${actionUrl || '#'}" class="btn bt">${actionText}</a>` : ''}
    `;
    
    container.appendChild(emptyState);
  }

  /**
   * Show toast notification
   */
  function showToast(message, duration = 3000) {
    const existingToast = document.querySelector('.ptf-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'ptf-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'ptf-toast-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
    
    announce(message);
  }

  /**
   * Smooth scroll to element
   */
  function smoothScrollTo(element) {
    if (!element) return;
    
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    
    // Focus for accessibility
    element.setAttribute('tabindex', '-1');
    element.focus();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PERFORMANCE: DEBOUNCE AND THROTTLE
  // ═══════════════════════════════════════════════════════════════════════════════

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
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    if (!isMob()) return;
    
    console.log('✅ CRM UX Enhancements (Mobile) initialized');
    
    // Phase 1: Accessibility
    createLiveRegion();
    enhanceButtonAccessibility();
    enhanceImageAccessibility();
    
    // Phase 2: Touch Targets
    enhanceTouchTargets();
    
    // Phase 3: Form Validation
    enhanceFormValidation();
    
    // Phase 4 & 5: UI enhancements are CSS-based, no JS needed
    
    // Re-run on resize
    window.addEventListener('resize', debounce(() => {
      if (isMob()) {
        enhanceButtonAccessibility();
        enhanceImageAccessibility();
        enhanceTouchTargets();
      }
    }, 250));
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose utility functions globally
  window.ptfUX = {
    announce,
    showToast,
    showEmptyState,
    showSkeletonLoading,
    removeSkeletonLoading,
    smoothScrollTo
  };

})();

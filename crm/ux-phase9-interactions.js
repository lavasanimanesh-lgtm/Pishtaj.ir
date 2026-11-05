/**
 * CRM Phase 9 - Ultimate UX Interactions
 * Based on UX/UI Pro Max Skill (161 laws + 99 guidelines)
 * Version: 1.0
 * Date: 2026-11-04
 * 
 * ویژگی‌ها:
 * - Expandable sections با انیمیشن
 * - Skeleton form/stats
 * - Progress steps
 * - Micro-copy helpers
 * - Enhanced focus management
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. EXPANDABLE SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Initialize expandable sections
   */
  function initExpandableSections() {
    const expandables = document.querySelectorAll('.crm-expandable');
    
    expandables.forEach(expandable => {
      const header = expandable.querySelector('.crm-expandable__header');
      if (!header) return;

      header.addEventListener('click', () => {
        const isExpanded = expandable.classList.contains('is-expanded');
        
        if (isExpanded) {
          collapseSection(expandable);
        } else {
          expandSection(expandable);
        }
      });

      // Keyboard support
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });

      // Add ARIA attributes
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Expand section
   */
  function expandSection(expandable) {
    expandable.classList.add('is-expanded');
    const header = expandable.querySelector('.crm-expandable__header');
    if (header) {
      header.setAttribute('aria-expanded', 'true');
    }
    
    // Announce to screen readers
    if (window.CRMComponents) {
      window.CRMComponents.announceToScreenReader('بخش باز شد');
    }
  }

  /**
   * Collapse section
   */
  function collapseSection(expandable) {
    expandable.classList.remove('is-expanded');
    const header = expandable.querySelector('.crm-expandable__header');
    if (header) {
      header.setAttribute('aria-expanded', 'false');
    }
    
    // Announce to screen readers
    if (window.CRMComponents) {
      window.CRMComponents.announceToScreenReader('بخش بسته شد');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. SKELETON FORM
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create skeleton form
   * @param {number} fieldCount - Number of fields
   * @returns {string} HTML string
   */
  function createSkeletonForm(fieldCount = 5) {
    let html = '<div class="crm-skeleton-form">';
    
    for (let i = 0; i < fieldCount; i++) {
      html += `
        <div class="crm-skeleton-field">
          <div class="crm-skeleton-label"></div>
          <div class="crm-skeleton-input"></div>
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Show skeleton form in container
   */
  function showSkeletonForm(container, fieldCount) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    container.innerHTML = createSkeletonForm(fieldCount);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. SKELETON STATS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create skeleton stats
   * @param {number} count - Number of stat cards
   * @returns {string} HTML string
   */
  function createSkeletonStats(count = 4) {
    let html = '<div class="crm-skeleton-stats">';
    
    for (let i = 0; i < count; i++) {
      html += `
        <div class="crm-skeleton-stat">
          <div class="crm-skeleton-stat__label"></div>
          <div class="crm-skeleton-stat__value"></div>
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Show skeleton stats in container
   */
  function showSkeletonStats(container, count) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    container.innerHTML = createSkeletonStats(count);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. PROGRESS STEPS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create progress steps
   * @param {Array} steps - Array of step labels
   * @param {number} currentStep - Current step index (0-based)
   * @returns {string} HTML string
   */
  function createProgressSteps(steps, currentStep = 0) {
    let html = '<div class="crm-progress-steps">';
    
    steps.forEach((label, index) => {
      let stepClass = 'crm-progress-step';
      if (index < currentStep) {
        stepClass += ' is-completed';
      } else if (index === currentStep) {
        stepClass += ' is-active';
      }
      
      html += `
        <div class="${stepClass}">
          <div class="crm-progress-step__circle">${index + 1}</div>
          <div class="crm-progress-step__label">${label}</div>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }

  /**
   * Show progress steps in container
   */
  function showProgressSteps(container, steps, currentStep) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    container.innerHTML = createProgressSteps(steps, currentStep);
  }

  /**
   * Update progress step
   */
  function updateProgressStep(container, newStep) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    const steps = container.querySelectorAll('.crm-progress-step');
    steps.forEach((step, index) => {
      step.classList.remove('is-active', 'is-completed');
      if (index < newStep) {
        step.classList.add('is-completed');
      } else if (index === newStep) {
        step.classList.add('is-active');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. MICRO-COPY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Add helper text to form field
   * @param {string} selector - Field selector
   * @param {string} text - Helper text
   * @param {string} type - Type: 'info', 'success', 'warning', 'error'
   */
  function addHelper(selector, text, type = 'info') {
    const field = document.querySelector(selector);
    if (!field) return;

    // Remove existing helper
    const existingHelper = field.parentElement.querySelector('.crm-helper');
    if (existingHelper) {
      existingHelper.remove();
    }

    // Create helper
    const helper = document.createElement('span');
    helper.className = `crm-helper crm-helper--${type}`;
    helper.textContent = text;
    helper.setAttribute('role', 'note');

    // Insert after field
    field.parentElement.insertBefore(helper, field.nextSibling);
  }

  /**
   * Add tooltip to element
   * @param {string} selector - Element selector
   * @param {string} text - Tooltip text
   */
  function addTooltip(selector, text) {
    const element = document.querySelector(selector);
    if (!element) return;

    element.classList.add('crm-tooltip');
    element.setAttribute('data-tooltip', text);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. ENHANCED FOCUS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Add skip link
   * @param {string} targetSelector - Target element selector
   * @param {string} text - Skip link text
   */
  function addSkipLink(targetSelector, text = 'پرش به محتوای اصلی') {
    // Remove existing skip link
    const existingSkip = document.querySelector('.crm-skip-link');
    if (existingSkip) {
      existingSkip.remove();
    }

    // Create skip link
    const skipLink = document.createElement('a');
    skipLink.className = 'crm-skip-link';
    skipLink.href = targetSelector;
    skipLink.textContent = text;

    // Insert at beginning of body
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  /**
   * Trap focus within element
   * @param {HTMLElement} element - Element to trap focus in
   */
  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', (e) => {
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
    });

    // Focus first element
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. ENHANCED KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Register default keyboard shortcuts
   */
  function registerDefaultShortcuts() {
    if (!window.CRMComponents) return;

    // Ctrl+? = Show shortcuts help
    window.CRMComponents.registerShortcut('Ctrl+?', () => {
      showShortcutsHelp();
    }, 'نمایش راهنمای کلیدهای میانبر');

    // Ctrl+1-9 = Navigate to panels
    for (let i = 1; i <= 9; i++) {
      window.CRMComponents.registerShortcut(`Ctrl+${i}`, () => {
        const panels = document.querySelectorAll('.sb-i');
        if (panels[i - 1]) {
          panels[i - 1].click();
          if (window.CRMComponents) {
            window.CRMComponents.showToast(`بخش ${i} فعال شد`, 'info', 1500);
          }
        }
      }, `رفتن به بخش ${i}`);
    }
  }

  /**
   * Show shortcuts help dialog
   */
  function showShortcutsHelp() {
    const shortcuts = [
      { key: 'Ctrl+K', desc: 'جستجو' },
      { key: 'Ctrl+S', desc: 'ذخیره' },
      { key: 'Ctrl+N', desc: 'ایجاد جدید' },
      { key: 'Ctrl+F', desc: 'جستجو در صفحه' },
      { key: 'Escape', desc: 'بستن پنجره' },
      { key: 'Ctrl+1-9', desc: 'رفتن به بخش‌ها' },
      { key: 'Ctrl+?', desc: 'راهنمای کلیدها' }
    ];

    let message = 'کلیدهای میانبر:\n\n';
    shortcuts.forEach(s => {
      message += `${s.key}: ${s.desc}\n`;
    });

    alert(message);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    console.log('✅ CRM Phase 9 Enhancements initialized');

    // Initialize expandable sections
    initExpandableSections();

    // Register default shortcuts
    registerDefaultShortcuts();

    // Add skip link
    addSkipLink('#panels', 'پرش به محتوای اصلی');

    // Expose API globally
    window.CRMPhase9 = {
      // Expandable
      expandSection,
      collapseSection,

      // Skeleton
      createSkeletonForm,
      showSkeletonForm,
      createSkeletonStats,
      showSkeletonStats,

      // Progress
      createProgressSteps,
      showProgressSteps,
      updateProgressStep,

      // Micro-copy
      addHelper,
      addTooltip,

      // Focus
      addSkipLink,
      trapFocus,

      // Shortcuts
      showShortcutsHelp
    };
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

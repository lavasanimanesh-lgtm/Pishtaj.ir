/**
 * CRM Components Library - Phase 8
 * Professional UI Components based on UX/UI Pro Max Skill
 * Version: 1.0
 * Date: 2026-11-04
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. EMPTY STATE COMPONENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create empty state HTML
   * @param {Object} options
   * @param {string} options.icon - SVG icon or emoji
   * @param {string} options.title - Title text
   * @param {string} options.description - Description text
   * @param {string} options.actionText - Action button text
   * @param {Function} options.actionCallback - Action button callback
   * @param {string} options.actionUrl - Action button URL (alternative to callback)
   * @returns {string} HTML string
   */
  function createEmptyState(options) {
    const defaults = {
      icon: '📭',
      title: 'موردی یافت نشد',
      description: 'برای شروع، یک مورد جدید اضافه کنید.',
      actionText: '',
      actionCallback: null,
      actionUrl: '#'
    };

    const opts = { ...defaults, ...options };

    let actionHtml = '';
    if (opts.actionText) {
      if (opts.actionCallback) {
        const callbackId = `crm_empty_${Date.now()}`;
        window[callbackId] = opts.actionCallback;
        actionHtml = `<button class="crm-empty-state__action" onclick="${callbackId}(); delete window['${callbackId}'];">${opts.actionText}</button>`;
      } else {
        actionHtml = `<a href="${opts.actionUrl}" class="crm-empty-state__action">${opts.actionText}</a>`;
      }
    }

    return `
      <div class="crm-empty-state">
        <div class="crm-empty-state__icon">${opts.icon}</div>
        <h3 class="crm-empty-state__title">${opts.title}</h3>
        <p class="crm-empty-state__description">${opts.description}</p>
        ${actionHtml}
      </div>
    `;
  }

  /**
   * Show empty state in a container
   */
  function showEmptyState(container, options) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    container.innerHTML = createEmptyState(options);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. LOADING STATE COMPONENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create loading state HTML
   * @param {Object} options
   * @param {string} options.text - Loading text
   * @returns {string} HTML string
   */
  function createLoadingState(options) {
    const defaults = {
      text: 'در حال بارگذاری...'
    };

    const opts = { ...defaults, ...options };

    return `
      <div class="crm-loading">
        <div class="crm-loading__spinner"></div>
        <div class="crm-loading__text">${opts.text}</div>
      </div>
    `;
  }

  /**
   * Show loading state in a container
   */
  function showLoading(container, options) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    container.innerHTML = createLoadingState(options);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. SKELETON LOADING COMPONENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create skeleton loading HTML
   * @param {string} type - Type: 'card', 'list', 'table', 'text', 'title'
   * @param {number} count - Number of skeleton items
   * @returns {string} HTML string
   */
  function createSkeleton(type = 'card', count = 3) {
    let html = '';

    switch (type) {
      case 'card':
        html = '<div class="crm-skeleton-grid">';
        for (let i = 0; i < count; i++) {
          html += '<div class="crm-skeleton crm-skeleton--card"></div>';
        }
        html += '</div>';
        break;

      case 'list':
        html = '<div class="crm-skeleton-list">';
        for (let i = 0; i < count; i++) {
          html += `
            <div class="crm-skeleton-list-item">
              <div class="crm-skeleton crm-skeleton--avatar"></div>
              <div class="crm-skeleton crm-skeleton--text"></div>
            </div>
          `;
        }
        html += '</div>';
        break;

      case 'table':
        html = '<div class="crm-skeleton crm-skeleton--table"></div>';
        break;

      case 'text':
        for (let i = 0; i < count; i++) {
          html += '<div class="crm-skeleton crm-skeleton--text"></div>';
        }
        break;

      case 'title':
        html = '<div class="crm-skeleton crm-skeleton--title"></div>';
        break;
    }

    return html;
  }

  /**
   * Show skeleton loading in a container
   */
  function showSkeleton(container, type, count) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    container.innerHTML = createSkeleton(type, count);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. CONFIRMATION DIALOG COMPONENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show confirmation dialog
   * @param {Object} options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {string} options.icon - Icon type: 'warning', 'danger', 'info'
   * @param {string} options.confirmText - Confirm button text
   * @param {string} options.cancelText - Cancel button text
   * @param {string} options.confirmClass - Confirm button class: 'confirm', 'danger'
   * @param {Function} options.onConfirm - Confirm callback
   * @param {Function} options.onCancel - Cancel callback
   */
  function showConfirmDialog(options) {
    const defaults = {
      title: 'آیا مطمئن هستید؟',
      message: 'این عمل قابل بازگشت نیست.',
      icon: 'warning',
      confirmText: 'تایید',
      cancelText: 'انصراف',
      confirmClass: 'confirm',
      onConfirm: null,
      onCancel: null
    };

    const opts = { ...defaults, ...options };

    // Create dialog element
    const dialog = document.createElement('div');
    dialog.className = 'crm-confirm-dialog';
    dialog.innerHTML = `
      <div class="crm-confirm-dialog__content">
        <div class="crm-confirm-dialog__icon crm-confirm-dialog__icon--${opts.icon}">
          ${opts.icon === 'warning' ? '⚠️' : opts.icon === 'danger' ? '🗑️' : 'ℹ️'}
        </div>
        <h3 class="crm-confirm-dialog__title">${opts.title}</h3>
        <p class="crm-confirm-dialog__message">${opts.message}</p>
        <div class="crm-confirm-dialog__actions">
          <button class="crm-confirm-dialog__btn crm-confirm-dialog__btn--cancel">${opts.cancelText}</button>
          <button class="crm-confirm-dialog__btn crm-confirm-dialog__btn--${opts.confirmClass}">${opts.confirmText}</button>
        </div>
      </div>
    `;

    // Add to body
    document.body.appendChild(dialog);

    // Get buttons
    const cancelBtn = dialog.querySelector('.crm-confirm-dialog__btn--cancel');
    const confirmBtn = dialog.querySelector('.crm-confirm-dialog__btn--confirm, .crm-confirm-dialog__btn--danger');

    // Close function
    function close() {
      dialog.style.animation = 'crm-fade-in 0.2s ease-out reverse';
      setTimeout(() => dialog.remove(), 200);
    }

    // Event listeners
    cancelBtn.addEventListener('click', () => {
      if (opts.onCancel) opts.onCancel();
      close();
    });

    confirmBtn.addEventListener('click', () => {
      if (opts.onConfirm) opts.onConfirm();
      close();
    });

    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        if (opts.onCancel) opts.onCancel();
        close();
      }
    });

    // Close on Escape key
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (opts.onCancel) opts.onCancel();
        close();
        document.removeEventListener('keydown', onKeyDown);
      }
    }
    document.addEventListener('keydown', onKeyDown);

    // Focus trap
    cancelBtn.focus();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. TOAST NOTIFICATION HELPER
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in milliseconds
   */
  function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existingToast = document.querySelector('.crm-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Icons for each type
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    // Create toast
    const toast = document.createElement('div');
    toast.className = `crm-toast crm-toast--${type}`;
    toast.innerHTML = `
      <span class="crm-toast__icon">${icons[type]}</span>
      <span>${message}</span>
    `;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    document.body.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('crm-toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);

    // Announce to screen readers
    announceToScreenReader(message);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. ACCESSIBILITY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create live region for screen readers
   */
  function createLiveRegion() {
    if (document.querySelector('.crm-live-region')) return;

    const liveRegion = document.createElement('div');
    liveRegion.className = 'crm-live-region';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
    document.body.appendChild(liveRegion);
  }

  /**
   * Announce message to screen readers
   */
  function announceToScreenReader(message) {
    createLiveRegion();
    const liveRegion = document.querySelector('.crm-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 3000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. KEYBOARD SHORTCUTS SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════════

  const keyboardShortcuts = {};

  /**
   * Register keyboard shortcut
   * @param {string} key - Key combination (e.g., 'Ctrl+N', 'Escape')
   * @param {Function} callback - Callback function
   * @param {string} description - Description for help
   */
  function registerShortcut(key, callback, description = '') {
    keyboardShortcuts[key] = { callback, description };
  }

  /**
   * Initialize keyboard shortcuts listener
   */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Build key combination
      let key = '';
      if (e.ctrlKey) key += 'Ctrl+';
      if (e.shiftKey) key += 'Shift+';
      if (e.altKey) key += 'Alt+';
      key += e.key.toUpperCase();

      // Check if shortcut exists
      if (keyboardShortcuts[key]) {
        e.preventDefault();
        keyboardShortcuts[key].callback(e);
      }
    });
  }

  /**
   * Show keyboard shortcuts help
   */
  function showShortcutsHelp() {
    let message = 'کلیدهای میانبر:\n\n';
    for (const [key, { description }] of Object.entries(keyboardShortcuts)) {
      if (description) {
        message += `${key}: ${description}\n`;
      }
    }
    alert(message);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. UTILITY FUNCTIONS
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
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  function init() {
    console.log('✅ CRM Components Library initialized');

    // Create live region
    createLiveRegion();

    // Initialize keyboard shortcuts
    initKeyboardShortcuts();

    // Register default shortcuts
    registerShortcut('ESCAPE', () => {
      // Close any open modals
      const modals = document.querySelectorAll('.md-b, .crm-confirm-dialog');
      modals.forEach(modal => {
        if (modal.style.display !== 'none') {
          modal.style.display = 'none';
        }
      });
    }, 'بستن پنجره‌ها');

    // Expose API globally
    window.CRMComponents = {
      // Empty State
      createEmptyState,
      showEmptyState,

      // Loading State
      createLoadingState,
      showLoading,

      // Skeleton
      createSkeleton,
      showSkeleton,

      // Confirmation Dialog
      showConfirmDialog,

      // Toast
      showToast,

      // Accessibility
      announceToScreenReader,
      createLiveRegion,

      // Keyboard Shortcuts
      registerShortcut,
      showShortcutsHelp,

      // Utilities
      debounce,
      throttle
    };

    // Also expose shorter aliases
    window.crmUI = window.CRMComponents;
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

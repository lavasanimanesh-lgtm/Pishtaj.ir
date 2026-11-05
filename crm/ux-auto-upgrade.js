/**
 * CRM Auto-Upgrade System
 * Automatically upgrades simple inline-style empty states to professional components
 * Version: 1.0
 * Date: 2026-11-04
 */

(function() {
  'use strict';

  /**
   * Auto-upgrade all simple empty states on page
   * Finds elements with inline style "text-align:center;color:#94a3b8" 
   * and upgrades them to professional empty states
   */
  function autoUpgradeEmptyStates() {
    // Find all elements with simple empty state styling
    const candidates = document.querySelectorAll('div[style*="text-align"][style*="center"][style*="color"][style*="#94a3b8"], td[style*="text-align"][style*="center"][style*="color"][style*="#94a3b8"]');
    
    let upgraded = 0;
    
    candidates.forEach(el => {
      const text = el.textContent.trim();
      if (!text || text.length < 5) return;
      
      // Determine icon and message based on content
      const config = getEmptyStateConfig(text);
      
      // Upgrade to professional empty state
      upgradeToProfessional(el, config);
      upgraded++;
    });
    
    if (upgraded > 0) {
      console.log(`✅ Auto-upgraded ${upgraded} empty states`);
    }
    
    return upgraded;
  }

  /**
   * Get appropriate config based on text content
   */
  function getEmptyStateConfig(text) {
    const textLower = text.toLowerCase();
    
    // Icon mapping based on keywords
    const iconMap = [
      { keywords: ['نامه', 'مکاتبه', 'letter'], icon: '✉️' },
      { keywords: ['هزینه', 'مالی', 'expense', 'petty'], icon: '💵' },
      { keywords: ['درخواست', 'تامین', 'rfq', 'استعلام'], icon: '📋' },
      { keywords: ['مشتری', 'customer', 'مشتری‌ای'], icon: '🤝' },
      { keywords: ['تامین‌کننده', 'supplier'], icon: '🏭' },
      { keywords: ['کالا', 'محصول', 'product'], icon: '📦' },
      { keywords: ['فاکتور', 'invoice'], icon: '🧾' },
      { keywords: ['چک', 'cheque'], icon: '🏦' },
      { keywords: ['قرارداد', 'contract'], icon: '📜' },
      { keywords: ['پرونده', 'project', 'case'], icon: '📁' },
      { keywords: ['سرنخ', 'lead'], icon: '🎯' },
      { keywords: ['یادآور', 'reminder'], icon: '⏰' },
      { keywords: ['گزارش', 'report'], icon: '📊' },
      { keywords: ['پیشنهاد', 'offer'], icon: '📄' },
      { keywords: ['کاربر', 'user', 'personnel'], icon: '👥' },
      { keywords: ['مخاطب', 'contact'], icon: '📱' },
      { keywords: ['پیامک', 'sms'], icon: '💬' },
      { keywords: ['انبار', 'موجودی', 'surplus', 'inventory'], icon: '🏬' },
      { keywords: ['مطلبه', 'receivable'], icon: '💰' },
      { keywords: ['دسته چک'], icon: '📒' },
      { keywords: ['اظهارنامه', 'tax'], icon: '📁' },
      { keywords: ['فرصت شغلی', 'job'], icon: '💼' },
      { keywords: ['بایگانی', 'archive'], icon: '🗄️' },
      { keywords: ['بازخورد', 'feedback'], icon: '💡' },
      { keywords: ['لایسنس', 'license'], icon: '🔑' },
      { keywords: ['یافت نشد', 'نیست', 'ثبت نشده', 'خالی'], icon: '📭' },
      { keywords: ['⛔', 'فقط برای مدیران', 'access denied'], icon: '🔒' },
    ];
    
    let icon = '📭';
    for (const { keywords, icon: i } of iconMap) {
      if (keywords.some(k => text.includes(k))) {
        icon = i;
        break;
      }
    }
    
    // Generate title and description
    let title = text;
    let description = '';
    let actionText = '';
    
    // Custom messages based on text patterns
    if (text.includes('ثبت نشده')) {
      title = text.replace(/ثبت نشده.*$/, 'ثبت نشده');
      description = 'برای شروع، اولین مورد خود را اضافه کنید.';
      actionText = '➕ ایجاد مورد جدید';
    } else if (text.includes('یافت نشد')) {
      title = 'نتیجه‌ای یافت نشد';
      description = 'فیلترهای جستجو را تغییر دهید یا کلیدواژه دیگری را امتحان کنید.';
      actionText = '🔄 پاک کردن فیلترها';
    } else if (text.includes('نیست')) {
      title = text;
      description = 'در حال حاضر موردی برای نمایش وجود ندارد.';
    } else if (text.includes('⛔')) {
      title = 'دسترسی محدود';
      description = text.replace('⛔', '').trim();
    } else if (text.includes('⏳')) {
      title = 'در حال بارگذاری';
      description = text.replace('⏳', '').trim();
    } else {
      title = text;
      description = '';
    }
    
    return { icon, title, description, actionText };
  }

  /**
   * Upgrade a simple empty state element to professional version
   */
  function upgradeToProfessional(element, config) {
    // Create professional empty state
    const wrapper = document.createElement('div');
    wrapper.className = 'crm-empty-state';
    wrapper.innerHTML = `
      <div class="crm-empty-state__icon">${config.icon}</div>
      <h3 class="crm-empty-state__title">${config.title}</h3>
      ${config.description ? `<p class="crm-empty-state__description">${config.description}</p>` : ''}
    `;
    
    // Replace element
    if (element.parentNode) {
      element.parentNode.replaceChild(wrapper, element);
    }
  }

  /**
   * Create a professional empty state string (for use in JS templates)
   */
  function createProfessionalEmpty(text) {
    const config = getEmptyStateConfig(text);
    
    return `<div class="crm-empty-state">
      <div class="crm-empty-state__icon">${config.icon}</div>
      <h3 class="crm-empty-state__title">${config.title}</h3>
      ${config.description ? `<p class="crm-empty-state__description">${config.description}</p>` : ''}
    </div>`;
  }

  // Auto-run on page load
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(autoUpgradeEmptyStates, 500);
      });
    } else {
      setTimeout(autoUpgradeEmptyStates, 500);
    }
    
    // Also run after panel changes
    const originalGoPanel = window.goPanel;
    if (originalGoPanel) {
      window.goPanel = function(...args) {
        const result = originalGoPanel.apply(this, args);
        setTimeout(autoUpgradeEmptyStates, 300);
        return result;
      };
    }
    
    // Expose API
    window.CRMUpgrade = {
      autoUpgradeEmptyStates,
      createProfessionalEmpty,
      getEmptyStateConfig
    };
  }

  init();

})();

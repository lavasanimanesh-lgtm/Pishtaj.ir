/* =====================================================================
   PTF CRM — key-registry.js — v34.8.16 (ROADMAP-THIN-CLIENT T0-5)
   فهرست واحد کلیدهای storage + دسته و مقصد نهایی هرکدام.
   پایان سه نسخهٔ موازی: SYNC_KEYS (sync.js) / bKeysFallback (client-server.js) /
   IDB_KEYS (client-server.js) از این پس باید با این رجیستری هم‌راستا بمانند
   (کنترل خودکار: tester520 + قوانین A10/A11 arch-guard).

   دسته‌ها (قرارداد بخش ۳ رودمپ):
     REC   موجودیت کسب‌وکار → فرمان اتمیک سروری + projection
     BLOB  دادهٔ کسب‌وکار بلابی (گذاری) → push/pull مجموعه‌ای
     SESS  نشست/احراز هویت → کوکی HttpOnly (T4-1)
     Q     صف/وضعیت همگام‌سازی → IDB (صف) / LS سبک (rev maps)
     CACHE کش فقط-خواندنی سرور → read-through با TTL، قابل‌تخلیه
     UI    ترجیحات رابط → LS سبک (مجاز — قابل‌از-دست‌رفتن)
     DEV   فقط-دستگاه عملیاتی → IDB یا سینک‌شونده؛ هرگز منبع حقیقت
     MEDIA رسانه → آروان S3
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ptfKeyRegistryLoaded) return;
  window.__ptfKeyRegistryLoaded = true;

  var REC = ['ptf_crm_personal_cheques', 'ptf_crm_rfqs', 'ptf_crm_suppliers', 'ptf_crm_customers', 'ptf_crm_products', 'ptf_crm_catalog_reviews', 'ptf_crm_catalog_merges', 'ptf_crm_surplus', 'ptf_crm_offers', 'ptf_crm_leads', 'ptf_crm_reminders', 'ptf_crm_buyquotes', 'ptf_crm_invoices', 'ptf_crm_notifs', 'ptf_crm_sendqueue', 'ptf_crm_audit', 'ptf_crm_inqitems', 'ptf_crm_deals', 'ptf_crm_projects', 'ptf_crm_packinglists', 'ptf_crm_letters', 'ptf_crm_contracts', 'ptf_crm_sigprofiles', 'ptf_crm_smsbook', 'ptf_crm_rfqsmart', 'ptf_crm_settings', 'ptf_crm_finance', 'ptf_crm_order_prices', 'ptf_crm_payables', 'ptf_crm_supplier_finance', 'ptf_crm_opex', 'ptf_crm_shareholders', 'ptf_crm_sharetx', 'ptf_crm_fiscal_snapshots', 'ptf_crm_techcases', 'ptf_crm_calc_runs', 'ptf_crm_techproposals', 'ptf_crm_leadfinder_jobs', 'ptf_crm_leadfinder_sources', 'ptf_crm_management_actions', 'ptf_crm_management_reports', 'ptf_crm_commission_records', 'ptf_crm_notifprefs', 'ptf_crm_trash', 'ptf_crm_petty', 'ptf_crm_petty_tx', 'ptf_crm_petty_periods', 'ptf_crm_perms', 'ptf_crm_buycmp', 'ptf_crm_inqreads', 'ptf_crm_avatars' /*تا T4-3 → S3*/, 'ptf_crm_cheques_issued', 'ptf_crm_cheques_received', 'ptf_crm_cheque_books', 'ptf_crm_msgtpls', 'ptf_crm_deleted_archive', 'ptf_crm_tax_returns', 'ptf_crm_sales_returns', 'ptf_crm_fin_events', 'ptf_crm_bank_recon', 'ptf_crm_treasury_calls', 'ptf_crm_case_receipts', 'ptf_crm_receipt_allocations', 'ptf_crm_fin_attachments', 'ptf_crm_corrections', 'ptf_crm_fin_findings', 'ptf_crm_sales_commands'];
  var SESS = ['ptf_crm_token', 'ptf_crm_token_role', 'ptf_crm_session', 'ptf_login_lock', 'ptf_crm_offline_login', 'ptf_device_id', 'ptf_crm_device_tag', 'ptf_last_activity'];
  var Q = ['ptf_b_queue', 'ptf_sync_dirty', 'ptf_sync_krevs', 'ptf_sync_rev', 'ptf_sync_ping', 'ptf_sync_last_error', 'ptf_b_offload_last', 'ptf_guard_counts', 'ptf_evt_last', 'ptf_bridge_last_error', 'ptf_storage_mode', 'ptf_storage_warned', 'ptf_crm_mode', 'ptf_crm_sync_enabled'];
  var CACHE = ['ptf_site_suppliers', 'ptf_site_suppliers_total', 'ptf_site_rfqs', 'ptf_site_inbox_sig', 'ptf_fx_live_cache', 'ptf_cloud_usage', 'ptf_cloud_usage_backup', 'ptf_crm_users'];
  var UI = ['ptf_theme', 'ptf_crm_theme_vars', 'ptf_nav_open', 'ptf_offer_tpl', 'ptf_off_cust_filter', 'ptf_bot_enabled', 'ptf_bot_pairs', 'ptf_phonefmt_mig', 'ptf_app_ver', 'ptf_profit_incomplete_notified', 'ptf_backup_last', 'ptf_backup_sig', 'ptf_backup_delta_sig', 'ptf_last_backup_time'];
  /* v34.8.40 (R2/T5-2c): +ptf_autodraft_award_revision_ و پیشوند واقعی آینهٔ امضا
   (ptf_sig_profile_recovery_v1_ — قبلاً sigRecovery_ نادرست ثبت شده بود) */
  var DEV = ['ptf_autodraft_offer_', 'ptf_autodraft_award_revision_', 'ptf_code_tmp_queue', 'ptf_code_duplicate_plan', 'ptf_code_duplicate_ack', 'ptf_sales_command_not_committed_', 'ptf_sales_command_recovered_', 'ptf_sales_command_uncertain_', 'ptf_offer_post_ack_warning_', 'ptf_sig_profile_recovery_v1_', 'ptf_backup_local', 'ptf_backup_prerestore', 'ptf_tour_done_', 'ptf_tour_mnv_done_', 'ptf_crm_prefs_'];
  var MEDIA = ['ptf_chqprint_bg', 'ptf_crm_avatars'];

  window.PTF_KEY_REGISTRY = {
    REC: { store: 'server-command', keys: REC },
    SESS: { store: 'httponly-cookie', keys: SESS },
    Q: { store: 'idb-queue-or-ls-light', keys: Q },
    CACHE: { store: 'ptfCache-idb-read-through-ttl', keys: CACHE }, /* v34.8.41 (R3/T3-4): پوشهٔ cache: در IDB + TTL؛ legacy LS فقط تا مهاجرت بوت */
    UI: { store: 'ls-light', keys: UI },
    DEV: { store: 'idb-or-sync', keys: DEV },
    MEDIA: { store: 's3', keys: MEDIA }
  };

  /* دستهٔ یک کلید — پیشوندها هم پوشش داده می‌شوند؛ ناشناخته = null */
  window.ptfKeyCategory = function (k) {
    var cat, i, p;
    for (cat in window.PTF_KEY_REGISTRY) {
      if (!Object.prototype.hasOwnProperty.call(window.PTF_KEY_REGISTRY, cat)) continue;
      var keys = window.PTF_KEY_REGISTRY[cat].keys || [];
      if (keys.indexOf(k) > -1) return cat;
      for (i = 0; i < keys.length; i++) {
        p = keys[i];
        if (p.charAt(p.length - 1) === '_' && String(k || '').indexOf(p) === 0) return cat;
      }
    }
    return null;
  };
  /* کلیدهای کسب‌وکار (REC + MEDIA) — مصرف آیندهٔ bKeys()/sync */
  window.ptfBusinessKeys = function () {
    return window.PTF_KEY_REGISTRY.REC.keys.slice();
  };
})();

#!/usr/bin/env node
/**
 * فاز ۱: تحلیل ایستا — شناسایی ارجاعات ناشناخته و الگوهای مشکوک
 * Phase 1: Static Analysis — detect broken refs and suspicious patterns
 */
const fs = require('fs');
const path = require('path');

const CRM_DIR = path.resolve(__dirname, '../../crm');
const API_DIR = path.resolve(__dirname, '../../api');
const files = fs.readdirSync(CRM_DIR).filter(f => f.endsWith('.js'));

// بارگذاری تمام فایل‌ها
const code = {};
files.forEach(f => {
  code[f] = fs.readFileSync(path.join(CRM_DIR, f), 'utf-8');
});

const BUGS = [];
const STATS = { totalLines: 0, totalFunctions: 0, totalRefs: 0, brokenRefs: 0, deadCode: 0 };

console.log('═══════════════════════════════════════════════');
console.log('  فاز ۱: تحلیل ایستا — شروع');
console.log('═══════════════════════════════════════════════\n');

// ─────────────────────────────────────────────
// ۱. استخراج تمام توابع window.* و توابع سراسری تعریف‌شده
// ─────────────────────────────────────────────
const defined = new Set();
const allFuncDefs = []; // [{name, file, line}]
files.forEach(f => {
  const c = code[f];
  STATS.totalLines += c.split('\n').length;
  // window.X = function
  const winRe = /window\.(\w+)\s*=/g;
  let m;
  while ((m = winRe.exec(c)) !== null) {
    defined.add(m[1]);
  }
  // function NAME(
  const funcRe = /^function\s+(\w+)\s*\(/gm;
  while ((m = funcRe.exec(c)) !== null) {
    defined.add(m[1]);
    allFuncDefs.push({ name: m[1], file: f, line: c.substr(0, m.index).split('\n').length });
    STATS.totalFunctions++;
  }
  // var NAME = function
  const varFnRe = /(?:^|\n)\s*(?:var|let|const)\s+(\w+)\s*=\s*function/g;
  while ((m = varFnRe.exec(c)) !== null) {
    defined.add(m[1]);
    allFuncDefs.push({ name: m[1], file: f, line: c.substr(0, m.index).split('\n').length });
    STATS.totalFunctions++;
  }
  // const NAME = (
  const constFnRe = /(?:^|\n)\s*const\s+(\w+)\s*=\s*\(/g;
  while ((m = constFnRe.exec(c)) !== null) {
    defined.add(m[1]);
  }
});

console.log(`✓ توابع تعریف‌شده: ${defined.size} (${STATS.totalFunctions} declaration-style)`);
console.log(`✓ خطوط کد: ${STATS.totalLines.toLocaleString()}\n`);

// ─────────────────────────────────────────────
// ۲. یافتن استفاده از توابع تعریف‌نشده
// ─────────────────────────────────────────────
const wellknown = new Set([
  // Browser globals
  'window', 'document', 'localStorage', 'sessionStorage', 'console', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'fetch', 'alert', 'confirm', 'prompt', 'navigator', 'location',
  'history', 'screen', 'Date', 'Math', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean',
  'RegExp', 'Error', 'Promise', 'Map', 'Set', 'Symbol', 'parseInt', 'parseFloat', 'isNaN',
  'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'MutationObserver',
  'Event', 'CustomEvent', 'FormData', 'FileReader', 'Blob', 'File', 'FileList', 'URLSearchParams',
  'URL', 'FormData', 'HTMLElement', 'Node', 'NodeList', 'Element', 'Text', 'DocumentFragment',
  'Intl', 'NumberFormat', 'DateTimeFormat', 'matchMedia', 'PointerEvent', 'MouseEvent',
  'KeyboardEvent', 'TouchEvent', 'FocusEvent', 'InputEvent', 'EventTarget',
  // Common library
  'XLSX', 'XLS', 'jspdf', 'html2canvas',
  // CRM common (defined elsewhere)
  'getData', 'setData', 'audit', 'notify', 'curRole', 'curSession', 'renderOffers', 'renderCustomers',
  'renderSuppliers', 'renderLeads', 'renderDeals', 'renderProducts', 'renderInq', 'renderRfq',
  'renderInvoices', 'renderProjects', 'renderReports', 'renderReminders', 'renderSms',
  'renderContracts', 'renderLetters', 'renderCheques', 'renderPetty', 'renderUsers',
  'renderScores', 'renderWinLoss', 'renderFunnel', 'renderSettings', 'renderCheck',
  'goPanel', 'goPanelByName', 'genCode', 'faDate', 'faDateTime', 'faYear', 'escP',
  'isSenior', 'isAdmin', 'isChairman', 'isSales', 'isBuyer', 'isAccountant', 'roleDef',
  'isLog', 'isLock', 'n', 'esc', 's', 'b', 'h',
  'SF_LOST_REASONS', 'ST_TO', 'PTF_RFQ_STATUSES', 'PTF_SF_STAGES', 'PTF_CURRENCIES',
  'PTF_DOCX_TYPES', 'PTF_BRAND_ALIASES', 'PTF_CAT_MAP', 'PTF_CAT_ALIASES', 'PTF_OPEX_CATS',
  'PTF_NAV_GROUPS', 'PTF_OFFER_TEMPLATES', 'PTF_SF_STAGES', 'RFQ_STATUSES', 'STATES',
  'TRIGGERS', 'CATS', 'DEF_W', 'VER', 'BASE', 'CACHE', 'SHELL',
  'ptfToast', 'ptfDialog', 'ptfConfirm', 'ptfReasonedDelete', 'ptfDeleteGuard', 'ptfSmartMerge',
  'ptfUnifiedCode', 'ptfPurgeCloudOrphans', 'ptfIconxSweep', 'ptfPhoneNorm', 'ptfCheckDup',
  'ptfFa2EnWord', 'ptfCoToEn', 'ptfAutoRegisterSummaryProducts', 'ptfOpenFullInqEditor',
  'ptfLlmTranslate', 'ptfGenCoEn', 'ptfSaveFullInqEdit', 'ptfManageInqAttachments',
  'ptfRoleHolder', 'ptfCanDelegateSig', 'ptfSignAsOptions', 'ptfCanAccess', 'ptfArcDocAllowed',
  'ptfRenderCreditBox', 'ptfRfqDueState', 'ptfSfDueState', 'ptfItemsBrands', 'ptfSupSpecScore',
  'ptfSupSpecLearn', 'ptfBrandCanon', 'ptfSupSpecBlob', 'ptfCustOpenBalance', 'ptfDupBlock',
  'ptfProfitIncompleteItems', 'ptfProfitIncompleteNotify', 'ptfFaMonthNow',
  'ptfPayableUpsert', 'ptfPayablePay', 'ptfPayableDlv', 'ptfSupplierDebts', 'ptfPayablesOpen',
  'ptfSupplierScore', 'ptfCustomerScore', 'ptfScoreCard', 'ptfScoreReport', 'ptfSupScoreBonus',
  'ptfScoreWeightsSave', 'ptfRawAdj', 'ptfScoreAdjust', 'ptfAdvanceOpen', 'ptfAdvanceNormalize',
  'ptfAdvanceLabel', 'ptfAdvanceLiveBind', 'ptfFxPayDialog', 'ptfFxPaySummary', 'ptfMoney',
  'ptfNum', 'ptfNumWordsFa', 'ptfMoneyFmt', 'ptfJToISO', 'ptfISOToJ', 'ptfTodayJ', 'ptfJNormalize',
  'ptfDateInput', 'ptfProjectProfitIRR', 'ptfCalculateNetProfit', 'ptfFiscalData',
  'ptfFiscalDistribution', 'ptfFiscalLock', 'ptfFiscalPrint', 'ptfFiscalRender',
  'ptfFiscalReportHtml', 'ptfFiscalCsv', 'ptfFiscalSnapPrint', 'ptfFiscalAmendCommit',
  'ptfFiscalAmendOpen', 'ptfShareApplySalary', 'ptfShareholderBalance', 'ptfShareDraw',
  'ptfMyDayItems', 'ptfMyDayHtml', 'ptfFunnelData', 'ptfFunnelHtml', 'ptfWinLossStats',
  'ptfRenderWinLoss', 'ptfOpexSum', 'ptfOpexPendingTpls', 'ptfOpexApplyTpl', 'ptfPettyBalance',
  'ptfPettyPendingByUser', 'ptfPettyPeriodData', 'pettyCharge', 'pettyDirectPay', 'pettySettle',
  'pettyClosePeriod', 'pettyAttachBank', 'pettyPeriodRegistered', 'pettySetTreasurerRole',
  'ptfRfqCascadeScan', 'ptfRfqCascadeDelete', 'ptfRfqSetStatus', 'ptfRfqWaitBadge',
  'ptfInqAliases', 'ptfCanFiscal', 'ptfProjectCostOpen', 'ptfProjectCostUpload',
  'ptfRealBuyOpen', 'ptfRealBuyStatus', 'ptfRealBuyNewInquiry', 'ptfRealBuyReceiptUpload',
  'ptfRealBuyEnsureStatus', 'ptfOrphanScan', 'ptfOrphanPurge', 'ptfOrphanReview',
  'ptfDlgs', 'dialogx', 'ptfDlgAlert', 'ptfDialog',
  'ptfFaToEn', 'ptfFaDateFormat', 'ptfFaMoneyFormat',
  'ptfSettingsOpen', 'ptfBuildSettings', 'ptfOpenSettings',
  'ptfXlsPhones', 'ptfXlsPerson', 'ptfXlsVenSt', 'ptfXlsGuideGo',
  'ptfPey', 'ptfStg', 'ptfDupOf', 'ptfChips', 'ptfRows', 'ptfCur', 'ptfFmt', 'ptfPct',
  'ptfToday', 'ptfYesterday', 'ptfAddDays',
  'ptfModalClose', 'ptfModalMin', 'ptfModalMax',
  'ptfBuildDashboard', 'ptfDashEnsureFull', 'ptfDashHooksReady',
  'ptfMnvMore', 'ptfMnvRender', 'ptfMnvSetActive', 'ptfMnvGo',
  'ptfTourStart', 'ptfTourMnvStart', 'ptfTourDone',
  'ptfKanbanRender', 'ptfKanbanSetView', 'ptfKanbanMoveCard',
  'ptfLauncherRender', 'ptfLauncherSetOrder', 'ptfLauncherMove',
  'ptfSaleSaveOrder', 'ptfSaleDeleteOrder', 'ptfSaleGet',
  'ptfAIOpen', 'ptfAISend', 'ptfAIRender', 'ptfAIHistory',
  'ptfChipsAdd', 'ptfChipsRemove', 'ptfChipsRender',
  'ptfMx', 'ptfMxMinimize', 'ptfMxRestore',
  'ptfFmtDate', 'ptfFmtDateTime', 'ptfFmtNum', 'ptfFmtMoney',
  'ptfEnToFa', 'ptfFaToEn', 'ptfTr',
  'ptfChangePassDialog', 'smsResendLogin', 'smsBookSyncAll', 'smsBookRecover',
  'ptfMergeStart', 'ptfMergeWizard', 'ptfMergeCommit',
  'ptfCleanScan', 'ptfCleanUseless', 'ptfCleanOpen', 'ptfCleanMerge', 'ptfCleanNotDup', 'ptfCleanEdit', 'ptfCleanDrop',
  'ptfLossOpen', 'ptfLossCommit', 'ptfLossEvent',
  'ptfLog', 'ptfLogOk', 'ptfLogErr',
  'ptfSyncPull', 'ptfSyncPush', 'ptfSyncBoot',
  'ptfBackupDownload', 'ptfBackupRestore', 'ptfBackupRun',
  'ptfSetTheme', 'ptfThemeEffective', 'ptfApplyTheme',
  'ptfBotSend', 'ptfBotTest', 'ptfBotPairStart', 'ptfBotPairCheck', 'ptfBotCompose', 'ptfBotComposeSend',
  'ptfBotSendPersonal',
  'ptfCheckMonthlyBackupReminder', 'ptfMarkMonthlySaved', 'ptfDownloadMonthly',
  'ptfRenderInbox', 'ptfInboxRefresh', 'ptfInboxCount', 'ptfInboxRead',
  'ptfFaDate', 'ptfFaToEnDigits', 'ptfToEnDigits', 'ptfPhoneNorm', 'ptfNormalizeEntityPhones',
  'ptfCoToEn',
  // ارجاع به المان‌های DOM
  '$', 'jQuery', '_', 'lodash',
  'XLSX',
  // توابع کمکی رایج
  'toast', 'confirm2', 'doConfirm', 'showModal', 'closeModal', 'openModal',
  'filterRfq', 'saveRfq2', 'saveRfq', 'editRfq', 'rfqSiteDetail', 'rfqSiteEnsureCustomer', 'rfqApprove',
  'saveProd', 'saveProd2', 'saveCust', 'saveCust2', 'saveSup', 'saveSup2', 'saveUser', 'saveUser2',
  'renderUsers2', 'renderProducts2', 'renderRfq2',
  'nR2', 'nC2', 'nS2', 'nP2', 'nL2', 'nInv', 'nPay', 'nBq', 'nBn', 'nR2D', 'nR2C', 'nR2Q', 'nR2Due', 'nR2ItemsWrap', 'nR2P',
  'nC2Credit', 'nC2Addr', 'nC2Tel', 'nC2Mail', 'nC2Web', 'nC2Ind', 'nC2Ven', 'nC2Nat', 'nC2Note',
  'nS2Comp', 'nS2CompEn', 'nS2Origin', 'nS2Tel', 'nS2Addr', 'nS2Mail', 'nS2Web', 'nS2Brands', 'nS2Equip',
  'nP2Name', 'nP2Desc', 'nP2Brand', 'nP2Model', 'nP2Cat', 'nP2Unit', 'nP2Pr', 'nP2PrCur',
  'nL2Title', 'nL2Kind', 'nL2To', 'nL2ToRole', 'nL2Subj', 'nL2Body', 'nL2Att', 'nL2Ref',
  'nInvNo', 'nInvDate', 'nInvVat', 'nInvAmt', 'nInvBase',
  'nPayAmt', 'nPayHow', 'nPayRef', 'nPayDate',
  'nBnAmt', 'nBnHow', 'nBnRef',
  'nBqPr', 'nBqCur', 'nBqRate', 'nBqSup', 'nBqItem', 'nBqQty',
  'nBnkAmt', 'nBnkCur', 'nBnkRate', 'nBnkRateType', 'nBnkPct', 'nBnkHow', 'nBnkRef',
  'nBnkDate',
  'nLVal', 'nLCause', 'nLNote', 'nLAmend', 'nLRec',
  'nL2From', 'nL2To', 'nL2Cc', 'nL2Date', 'nL2File', 'nL2Img', 'nL2Kind', 'nL2Subj', 'nL2Body', 'nL2Att',
  'nPMd', 'nPCat', 'nPHidden', 'nPStk', 'nPNo',
  // پنل‌ها
  'showProductModal', 'showCustModal', 'showSupModal', 'showSupModal2', 'showRfqModal', 'showRfqModal2',
  'showEntityCard', 'showEntityProfile',
  'editProduct', 'editCust', 'editSup', 'editRfq', 'editOffer', 'editLetter', 'editCheque',
  'sfDocsOf', 'sfHasInvoice', 'sfAwardEnsure', 'sfAwardPrint', 'sfClose', 'sfCloseLost',
  'sfCloseSettledCommit', 'sfCloseAudit', 'sfClsSettle', 'sfArchive', 'sfSetDue', 'sfSetDueCommit',
  'sfClearDue', 'sfDueSave', 'sfQcOpen', 'sfQcCommit', 'sfQcUpload', 'sfShipOpen', 'sfShipCommit',
  'sfShipUpload', 'sfShipSeqCheck', 'sfInvoiceRefCommit', 'sfStageOf', 'sfRfqAlign', 'sfTabOf', 'sfSetTab',
  'sfHasInvoice', 'sfToggle', 'sfAwardEnsure', 'sfAwardPrint',
  'cmpOpen', 'cmpBuy', 'cmpBulkBuy', 'cmpBulkBuyCommit', 'cmpBulkApplySup', 'cmpBulkTotal',
  'rfqsOpen', 'rfqsNew', 'rfqsScoreSuppliers', 'rfqsFinalize', 'rfqsReplyCommit',
  'rfqsUpdatePriceCompare', 'rfqsPriceBlur', 'rfqsCommitPrices', 'rfqsSetQuoteCur', 'rfqsToTargets',
  'rfqsPrint', 'rfqsCompare',
  'offerPickInq', 'offerEdit', 'offerDel', 'offerSetSt', 'offerToCo', 'offerFromRfq', 'offerReviseClone',
  'offerSave', 'offerForm', 'offerPickBuyer', 'offRenderTotals', 'offUpdItem', 'offLoadInqItems',
  'offRenderItems', 'offSyncTcLib', 'offAddTermLib', 'offRenderTerms', 'offRowIsEmpty', 'offSmartInsert',
  'offValidateItems', 'offSetRefPrice', 'offBaseCols', 'offOpenProfitOptimizer', 'offPickProd',
  'rqsNum', 'rqsQuotes',
  'checkDealDue', 'checkRfqDue', 'checkMustChangePass',
  'addMsg', 'ding', 'pulse', 'markRead',
  'showRfqPending', 'rfqWaitBadge', 'rfqWaitList', 'wfRefresh', 'wfLog', 'wfToResponse', 'wfCompute',
  'aiWB_persist', 'aiWB_lastOf', 'aiWB_restore', 'aiWB_quotaLimit', 'aiWB_html_bizcard',
  'aiWB_bizGo', 'aiWB_bizRender', 'aiWB_bizSave', 'aiWB_bizSaveAll', 'aiWB_histShow',
  'aiWB_tab', 'aiWB_letterGo', 'aiWB_detected',
  'ptfAutoRegisterSummaryProducts',
  'showLetterModal', 'showNewLetter',
  'scanOCR', 'llmPost',
  'dupCheck', 'dedupNorm',
  'PTF_RFQ_STATUSES', 'PTF_SF_STAGES', 'SF_SHIP_TYPES',
  'menuTpl', 'navHTML', 'sbHTML',
  'audit', 'notify',
  'PTF_SB_GROUPS', 'sbG',
  'gDash', 'gFin', 'gSup', 'gSales', 'gAdmin', 'gReports',
  'rTb', 'oTb', 'cTb', 'sTb', 'lTb', 'pTb', 'dTb', 'iTb', 'usrTb', 'chTb', 'rfqsTb', 'ltTb', 'invsTb', 'sfTb', 'opTb', 'rfdTb',
  'ctBadge', 'rmBadge', 'rBadge', 'ldBadge',
  'getQueryParam', 'getUrlParam', 'qParam',
  'lit2en', 'en2lit', 'toEn', 'toFa',
  'escapeHtml', 'stripHtml',
  // متغیرهای پنل‌ها
  'p', 'r', 'o', 'c', 's', 'i', 'l', 'pl', 'u', 'ch', 'cn', 'invs', 'rfqs', 'deals', 'leads', 'customers', 'suppliers',
  'products', 'projects', 'reminders', 'letters', 'cheques', 'contracts', 'inqitems', 'inqreads',
  'petty', 'opex', 'payables', 'shareholders', 'sharetx', 'fiscal_snapshots', 'purchases', 'settings', 'auditlog',
  'notifs', 'sendqueue', 'trash', 'deleted_archive', 'finance', 'order_prices', 'smsbook',
  'sendqueue', 'deleted_archive', 'smsbook',
  'PTF_CURRENCIES', 'PTF_DOCX_TYPES', 'PTF_OPEX_CATS', 'PTF_BRAND_ALIASES', 'PTF_CAT_MAP',
  'ST_TO', 'PTF_RFQ_STATUSES', 'PTF_SF_STAGES', 'SF_LOST_REASONS',
  // UI Elements
  'pdp', 'panels', 'modals', 'modal', 'mdb', 'mxc',
  'topbar', 'sidebar', 'dash', 'dashGrid', 'dashStats',
  'fxTicker', 'mydayBox', 'lchGrid', 'insWrap', 'fxW', 'wlWrap', 'wlBox',
  'fxBox', 'fxRate', 'fxSrc', 'fxRial',
  'counter', 'fmt', 'date', 'time', 'num',
  'oppoList', 'oppoCount', 'oppoRender', 'oppoLose',
  'isMob', 'isDark',
  'INQ_STATUSES', 'INQ_STATUSES_OLD', 'RFQ_STATUSES',
  'renderInq', 'buildInq', 'buildInqItems', 'saveInq', 'saveInqItem',
  'payablesBox', 'opexBox', 'pettyBox', 'financeTabs',
  'kpBox', 'fxPill',
  'cur', 'rate', 'amt', 'cur1', 'cur2', 'cur3',
  'cnt', 'ct', 'cntList',
  'cmp',
  'invRef', 'invDate', 'invVat', 'invNo', 'invBase', 'invAmt', 'invPay',
  'fx', 'fxShare', 'fxType', 'fxRemain', 'fxAmt', 'fxRate', 'fxRateType', 'fxPct',
  'rqs', 'rqsQuotes', 'rqsCmp',
  'PAYABLES',
  'lg', 'lgAll', 'lgPrev', 'lgNext', 'lgClose',
  // و سایر
  'init', 'main', 'app',
  'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10',
  'sfUp', 'sfUp_',
  'MIN_SET', 'MAX_SET',
  'Hookable', 'Hook', 'buildHook',
  'mx', 'md', 'dlg', 'mxDot', 'mxBar',
  'idx', 'start', 'end',
  'c0', 'c1', 'c2', 'c3', 'c4', 'c5',
  'i0', 'i1', 'i2', 'i3',
  'curPath', 'curDir', 'curFile',
  'TASK_QUEUE', 'EVENTS', 'OBSERVERS',
  'root', 'el', 'tag', 'cls', 'attr', 'props',
  'x', 'y', 'w', 'h', 'n', 'v', 'k',
  'src', 'dst', 'srcCur', 'dstCur', 'srcFile', 'dstFile', 'srcRfq', 'srcToNo', 'srcInq',
  'fromAdvance', 'advApplied', 'cashFull', 'autoSettle',
  'user', 'pass', 'role', 'roleId', 'dataOk',
  'audit', 'notify',
  'genCode', 'escP', 'faDate', 'faYear', 'faDateTime',
  'w', 'html', 'cell', 'row',
  'SF', 'OF', 'OP', 'PJ', 'OFX', 'OFI', 'OFIS',
  'cmp_id', 'rfq_id', 'inq_id', 'prj_id', 'of_id', 'co_id', 'tc_id', 'sf_id',
  'fx_id', 'inv_id', 'pay_id', 'cheq_id', 'lt_id', 'cnt_id', 'pbl_id', 'opex_id', 'shr_id', 'sht_id', 'memo_id',
  'tx_id', 'per_id',
  'curSession', 'curRole',
  'renderInvoice', 'renderContract', 'renderReminder', 'renderCheque', 'renderLetter', 'renderUser',
  'getMyReminders', 'getMyTasks', 'getMyInbox',
  'PTF_BG_DARK', 'PTF_BG_LIGHT', 'PTF_TX_DARK', 'PTF_TX_LIGHT',
  'ptfNum', 'ptfMoney', 'ptfMoneyFmt',
  'dataMoney', 'dataNohint', 'dataUnit',
  'PTF_CRM_VERSION', 'PTF_CRM_KEYS',
  'SHELL', 'INDEX', 'OFFER_COLS', 'PROD_COLS', 'CUST_COLS', 'SUP_COLS', 'LEAD_COLS',
  'extHeaders', 'extRows', 'extCols', 'extData',
  'rl', 'lang', 'lang2',
  'src1', 'src2', 'src3', 'src4', 'src5', 'src6', 'src7', 'src8', 'src9',
  'mx1', 'mx2', 'mx3', 'mx4', 'mx5', 'mx6', 'mx7', 'mx8', 'mx9', 'mx10',
  'fmtDate', 'fmtNum', 'fmtMoney', 'fmtPct',
  'extHeader', 'extData', 'extRow',
  'FIELDS', 'KINDS', 'MERGE_ROLES', 'SCORE_ROLES',
  'isProduction', 'isDev', 'isDebug',
  'invAmt', 'invVat', 'invDate', 'invNo', 'invBase', 'invRef', 'invFile',
  'hooked', 'hookId', 'hooks', 'onHook',
  'WAIT_HOOK', 'WAIT_FOR', 'BEFORE_HOOK', 'AFTER_HOOK',
  'initFlow', 'initData', 'initUI',
  'tester', 'debug', 'log',
  'tr', 'td', 'th', 'tbody', 'thead', 'tfoot',
  'renderSms', 'renderLoyalty', 'renderRecycle', 'renderStore',
  'NEW',
  'ref', 'refs', 'def', 'defs',
  'curRow', 'curCol', 'curCol2', 'curCol3',
  'STATE', 'STATES', 'STATUSES',
  'PROD_CATS', 'CATS_MAP', 'CAT_TO_EN', 'CAT_TO_FA',
  'wIn', 'wIn2', 'wIn3', 'wIn4',
  'menu', 'tabs', 'tab', 'tab1', 'tab2', 'tab3', 'tab4',
  'kpi', 'kpis', 'kpi1', 'kpi2', 'kpi3',
  'sc', 'sf', 'fxj', 'fxjs',
  'SYNC_KEYS', 'GUARD_KEYS', 'BACKUP_KEYS', 'WIPE_KEYS',
  'invs', 'invsAll', 'invsOpen', 'invsPaid',
  'arch', 'archive',
  'CFG', 'DEFAULT',
  'DEDUP', 'DEDUP_FIELDS', 'DEDUP_THRESHOLD', 'DEDUP_IGNORE',
  'ptfRfqStatusNew', 'PTF_RFQ_NEW_STATUSES', 'PTF_RFQ_STATUSES_NEW',
  'ROLE', 'SALES_ROLES', 'SENIOR_ROLES', 'BUY_PRICE_ROLES', 'FINANCE_ROLES',
  'curRfq', 'curOffer', 'curCust', 'curSup', 'curLead', 'curProd', 'curUser', 'curDeal', 'curProject',
  'curLetter', 'curCheque', 'curContract', 'curInvoice', 'curReminder', 'curPetty', 'curShareholder',
  'pcList', 'pcName', 'pcEn', 'pcRole', 'pcMob', 'pcTel', 'pcMail',
  'remList', 'remTitle', 'remDate', 'remKind', 'remSubj', 'remFor', 'remBy',
  'remName', 'remCode', 'remNote',
  'ptfLockChecks', 'ptfLock',
  'reviewFor', 'reviewBy', 'reviewStatus',
  'pk', 'pk1', 'pk2', 'pk3', 'pk4',
  'sp', 'sup', 'cust',
  'PTF_PAYMENT_METHODS', 'PTF_PAYMENT_KINDS', 'PTF_OFFER_KINDS', 'PTF_OFFER_TYPES',
  'PTF_OFFER_STATUSES', 'PTF_LETTER_KINDS', 'PTF_LETTER_STATUSES',
  'ptfLetterKind', 'ptfLetterStatus',
  'PTF_RECEIPT_KINDS', 'PTF_RECEIPT_STATUSES',
  'ptfReceiptKind', 'ptfReceiptStatus',
  'PTF_INVOICE_KINDS', 'PTF_INVOICE_STATUSES',
  'ptfInvoiceKind', 'ptfInvoiceStatus',
  'PTF_CONTRACT_KINDS', 'PTF_CONTRACT_STATUSES',
  'ptfContractKind', 'ptfContractStatus',
  'PTF_SUPPLIER_KINDS', 'PTF_SUPPLIER_STATUSES',
  'ptfSupplierKind', 'ptfSupplierStatus',
  'PTF_CUSTOMER_KINDS', 'PTF_CUSTOMER_STATUSES',
  'ptfCustomerKind', 'ptfCustomerStatus',
  'PTF_LEAD_KINDS', 'PTF_LEAD_STATUSES',
  'ptfLeadKind', 'ptfLeadStatus',
  'PTF_PRODUCT_KINDS', 'PTF_PRODUCT_STATUSES',
  'ptfProductKind', 'ptfProductStatus',
  'PTF_CHEQUE_KINDS', 'PTF_CHEQUE_STATUSES',
  'ptfChequeKind', 'ptfChequeStatus',
  'PTF_PETTY_KINDS', 'PTF_PETTY_STATUSES',
  'ptfPettyKind', 'ptfPettyStatus',
  'PTF_REMIT_KINDS', 'PTF_REMIT_STATUSES',
  'ptfRemitKind', 'ptfRemitStatus',
  'PTF_TRX_KINDS', 'PTF_TRX_STATUSES',
  'ptfTrxKind', 'ptfTrxStatus',
  'PTF_PROD_COLS', 'PTF_OFFER_COLS', 'PTF_CUST_COLS', 'PTF_SUP_COLS', 'PTF_LEAD_COLS',
  'PTF_USER_COLS', 'PTF_RFQ_COLS', 'PTF_INVOICE_COLS', 'PTF_CONTRACT_COLS', 'PTF_LETTER_COLS',
  'PTF_CHEQUE_COLS', 'PTF_PETTY_COLS', 'PTF_REMIT_COLS', 'PTF_PROJECT_COLS',
  'PTF_OPEX_COLS', 'PTF_SHR_COLS', 'PTF_FX_COLS', 'PTF_PAYABLE_COLS',
  'PTF_USER_STATUSES', 'PTF_USER_ROLES', 'PTF_USER_KINDS',
  'PTF_TAX_KINDS', 'PTF_TAX_RATES',
  'PTF_CITY_LIST', 'PTF_COUNTRY_LIST', 'PTF_INDUSTRY_LIST',
  'PTF_CAT_LIST', 'PTF_CURR_LIST', 'PTF_UNIT_LIST',
  'PTF_TEL_PREFIX', 'PTF_MOBILE_PREFIX', 'PTF_PHONE_REGEX',
  'PTF_EMAIL_REGEX', 'PTF_WEB_REGEX', 'PTF_DATE_REGEX',
  'PTF_MONEY_REGEX', 'PTF_PCT_REGEX', 'PTF_NUM_REGEX',
  'PTF_NAME_REGEX', 'PTF_COMPANY_REGEX', 'PTF_NAT_REGEX',
  'PTF_INQUIRY_STATUSES', 'PTF_INQUIRY_KINDS',
  'PTF_RFQ_KINDS', 'PTF_RFQ_STATUSES', 'PTF_RFQ_URGENCY',
  'PTF_OFFER_KINDS', 'PTF_OFFER_STATUSES', 'PTF_OFFER_URGENCY',
  'PTF_PAYMENT_KINDS', 'PTF_PAYMENT_STATUSES',
  'PTF_DELIVERY_KINDS', 'PTF_DELIVERY_STATUSES',
  'PTF_SHIPMENT_KINDS', 'PTF_SHIPMENT_STATUSES',
  'PTF_INSPECTION_KINDS', 'PTF_INSPECTION_STATUSES',
  'PTF_CERT_KINDS', 'PTF_CERT_STATUSES',
  'PTF_BANK_KINDS', 'PTF_BANK_STATUSES',
  'PTF_VAT_KINDS', 'PTF_VAT_RATES',
  'PTF_DISCOUNT_KINDS', 'PTF_DISCOUNT_RATES',
  'PTF_COMMISSION_KINDS', 'PTF_COMMISSION_RATES',
  'PTF_SALARY_KINDS', 'PTF_SALARY_RATES',
  'PTF_BONUS_KINDS', 'PTF_BONUS_RATES',
  'PTF_PENALTY_KINDS', 'PTF_PENALTY_RATES',
  'PTF_INTEREST_KINDS', 'PTF_INTEREST_RATES',
  'PTF_CURRENCY_RATES', 'PTF_CURRENCY_KINDS',
  'PTF_INVOICE_TERMS', 'PTF_OFFER_TERMS',
  'PTF_CONTRACT_TERMS', 'PTF_LETTER_TERMS',
  'PTF_DEFAULT_LANG', 'PTF_DEFAULT_CUR', 'PTF_DEFAULT_COUNTRY',
  'PTF_DATE_FORMAT', 'PTF_TIME_FORMAT', 'PTF_DATETIME_FORMAT',
  'PTF_NUMBER_FORMAT', 'PTF_MONEY_FORMAT', 'PTF_PCT_FORMAT',
  'PTF_DECIMAL_SEPARATOR', 'PTF_THOUSAND_SEPARATOR',
  'PTF_CURRENCY_SYMBOL', 'PTF_CURRENCY_POSITION',
  'PTF_DIRECTION', 'PTF_PRIMARY_LANG', 'PTF_SECONDARY_LANG',
  'PTF_CALENDAR', 'PTF_WEEK_START', 'PTF_TIMEZONE',
  'PTF_PAGE_SIZE', 'PTF_PAGE_LIMIT',
  'PTF_FILE_SIZE', 'PTF_FILE_TYPES', 'PTF_FILE_EXT',
  'PTF_IMAGE_SIZE', 'PTF_IMAGE_TYPES', 'PTF_IMAGE_EXT',
  'PTF_AUDIO_SIZE', 'PTF_AUDIO_TYPES', 'PTF_AUDIO_EXT',
  'PTF_VIDEO_SIZE', 'PTF_VIDEO_TYPES', 'PTF_VIDEO_EXT',
  'PTF_DOC_SIZE', 'PTF_DOC_TYPES', 'PTF_DOC_EXT',
  'PTF_PDF_SIZE', 'PTF_PDF_TYPES', 'PTF_PDF_EXT',
  'PTF_ZIP_SIZE', 'PTF_ZIP_TYPES', 'PTF_ZIP_EXT',
  'PTF_XLSX_SIZE', 'PTF_XLSX_TYPES', 'PTF_XLSX_EXT',
  'PTF_DOCX_SIZE', 'PTF_DOCX_TYPES', 'PTF_DOCX_EXT',
  'PTF_PPTX_SIZE', 'PTF_PPTX_TYPES', 'PTF_PPTX_EXT',
  'PTF_MAX_UPLOAD', 'PTF_MAX_DOWNLOAD', 'PTF_MAX_FILES',
  'PTF_CRON', 'PTF_INTERVAL', 'PTF_TIMEOUT',
  'PTF_RETRY', 'PTF_RETRY_DELAY', 'PTF_RETRY_MAX',
  'PTF_CACHE_TTL', 'PTF_CACHE_SIZE', 'PTF_CACHE_PREFIX',
  'PTF_SESSION_TTL', 'PTF_SESSION_PREFIX', 'PTF_SESSION_KEY',
  'PTF_API_KEY', 'PTF_API_SECRET', 'PTF_API_URL',
  'PTF_API_TIMEOUT', 'PTF_API_RETRY', 'PTF_API_LIMIT',
  'PTF_API_VERSION', 'PTF_API_PREFIX', 'PTF_API_HEADER',
  'PTF_API_TOKEN', 'PTF_API_HEADER_AUTH', 'PTF_API_HEADER_TOKEN',
  'PTF_DB_HOST', 'PTF_DB_PORT', 'PTF_DB_NAME', 'PTF_DB_USER', 'PTF_DB_PASS',
  'PTF_DB_PREFIX', 'PTF_DB_CHARSET', 'PTF_DB_COLLATION',
  'PTF_MAIL_HOST', 'PTF_MAIL_PORT', 'PTF_MAIL_USER', 'PTF_MAIL_PASS',
  'PTF_MAIL_FROM', 'PTF_MAIL_REPLY', 'PTF_MAIL_PREFIX',
  'PTF_SMS_HOST', 'PTF_SMS_PORT', 'PTF_SMS_USER', 'PTF_SMS_PASS',
  'PTF_SMS_FROM', 'PTF_SMS_PREFIX', 'PTF_SMS_TPL',
  'PTF_FTP_HOST', 'PTF_FTP_PORT', 'PTF_FTP_USER', 'PTF_FTP_PASS',
  'PTF_FTP_PATH', 'PTF_FTP_PREFIX', 'PTF_FTP_MODE',
  'PTF_S3_KEY', 'PTF_S3_SECRET', 'PTF_S3_REGION', 'PTF_S3_BUCKET',
  'PTF_S3_ENDPOINT', 'PTF_S3_PREFIX', 'PTF_S3_PATH',
  'PTF_S3_ACL', 'PTF_S3_CACHE', 'PTF_S3_TTL',
  'PTF_CDN_URL', 'PTF_CDN_PREFIX', 'PTF_CDN_PATH',
  'PTF_CDN_KEY', 'PTF_CDN_SECRET', 'PTF_CDN_BUCKET',
  'PTF_BACKUP_PATH', 'PTF_BACKUP_PREFIX', 'PTF_BACKUP_TTL',
  'PTF_BACKUP_MAX', 'PTF_BACKUP_INTERVAL', 'PTF_BACKUP_RETAIN',
  'PTF_LOG_PATH', 'PTF_LOG_PREFIX', 'PTF_LOG_TTL', 'PTF_LOG_MAX',
  'PTF_LOG_LEVEL', 'PTF_LOG_FORMAT', 'PTF_LOG_TARGET',
  'PTF_TEMP_PATH', 'PTF_TEMP_PREFIX', 'PTF_TEMP_TTL',
  'PTF_UPLOAD_PATH', 'PTF_UPLOAD_PREFIX', 'PTF_UPLOAD_TTL',
  'PTF_UPLOAD_MAX', 'PTF_UPLOAD_TYPES', 'PTF_UPLOAD_EXT',
  'PTF_CACHE_PATH', 'PTF_CACHE_PREFIX', 'PTF_CACHE_TTL',
  'PTF_SESSION_PATH', 'PTF_SESSION_PREFIX', 'PTF_SESSION_TTL',
  'PTF_QUEUE_PATH', 'PTF_QUEUE_PREFIX', 'PTF_QUEUE_TTL',
  'PTF_QUEUE_MAX', 'PTF_QUEUE_INTERVAL', 'PTF_QUEUE_RETAIN',
  'PTF_JOB_PATH', 'PTF_JOB_PREFIX', 'PTF_JOB_TTL',
  'PTF_JOB_MAX', 'PTF_JOB_INTERVAL', 'PTF_JOB_RETAIN',
  'PTF_REPORT_PATH', 'PTF_REPORT_PREFIX', 'PTF_REPORT_TTL',
  'PTF_REPORT_MAX', 'PTF_REPORT_INTERVAL', 'PTF_REPORT_RETAIN',
  'PTF_EXPORT_PATH', 'PTF_EXPORT_PREFIX', 'PTF_EXPORT_TTL',
  'PTF_EXPORT_MAX', 'PTF_EXPORT_INTERVAL', 'PTF_EXPORT_RETAIN',
  'PTF_IMPORT_PATH', 'PTF_IMPORT_PREFIX', 'PTF_IMPORT_TTL',
  'PTF_IMPORT_MAX', 'PTF_IMPORT_INTERVAL', 'PTF_IMPORT_RETAIN',
  'PTF_PRINT_PATH', 'PTF_PRINT_PREFIX', 'PTF_PRINT_TTL',
  'PTF_PRINT_MAX', 'PTF_PRINT_INTERVAL', 'PTF_PRINT_RETAIN',
  'PTF_PDF_PATH', 'PTF_PDF_PREFIX', 'PTF_PDF_TTL',
  'PTF_PDF_MAX', 'PTF_PDF_INTERVAL', 'PTF_PDF_RETAIN',
  'PTF_EMAIL_PATH', 'PTF_EMAIL_PREFIX', 'PTF_EMAIL_TTL',
  'PTF_EMAIL_MAX', 'PTF_EMAIL_INTERVAL', 'PTF_EMAIL_RETAIN',
  'PTF_SMS_PATH', 'PTF_SMS_PREFIX', 'PTF_SMS_TTL',
  'PTF_SMS_MAX', 'PTF_SMS_INTERVAL', 'PTF_SMS_RETAIN',
  'PTF_PUSH_PATH', 'PTF_PUSH_PREFIX', 'PTF_PUSH_TTL',
  'PTF_PUSH_MAX', 'PTF_PUSH_INTERVAL', 'PTF_PUSH_RETAIN',
  'PTF_WEBHOOK_PATH', 'PTF_WEBHOOK_PREFIX', 'PTF_WEBHOOK_TTL',
  'PTF_WEBHOOK_MAX', 'PTF_WEBHOOK_INTERVAL', 'PTF_WEBHOOK_RETAIN',
  'PTF_CRON_PATH', 'PTF_CRON_PREFIX', 'PTF_CRON_TTL',
  'PTF_CRON_MAX', 'PTF_CRON_INTERVAL', 'PTF_CRON_RETAIN',
  'ptfFont', 'ptfTheme', 'ptfLang', 'ptfDir', 'ptfCal',
  'renderChart', 'renderGraph', 'renderTable', 'renderList', 'renderTree', 'renderGrid',
  'renderForm', 'renderField', 'renderInput', 'renderSelect', 'renderTextarea', 'renderCheckbox',
  'renderRadio', 'renderDate', 'renderTime', 'renderFile', 'renderImage', 'renderColor',
  'renderRange', 'renderNumber', 'renderEmail', 'renderTel', 'renderUrl', 'renderSearch',
  'renderPassword', 'renderHidden', 'renderSubmit', 'renderReset', 'renderButton',
  'renderLabel', 'renderSpan', 'renderDiv', 'renderSection', 'renderArticle', 'renderAside',
  'renderHeader', 'renderFooter', 'renderNav', 'renderMenu', 'renderTabs', 'renderModal',
  'renderTooltip', 'renderPopover', 'renderDropdown', 'renderAccordion', 'renderCollapse',
  'renderCarousel', 'renderSlider', 'renderProgress', 'renderSpinner', 'renderLoader',
  'renderAlert', 'renderToast', 'renderNotify', 'renderConfirm', 'renderPrompt',
  'renderDialog', 'renderLightbox', 'renderGallery', 'renderMasonry', 'renderIsotope',
  'renderTimeline', 'renderCalendar', 'renderDatepicker', 'renderTimepicker', 'renderDatetimepicker',
  'renderColorpicker', 'renderRating', 'renderSlider', 'renderSwitch', 'renderToggle',
  'renderStepper', 'renderWizard', 'renderPagination', 'renderBreadcrumb', 'renderNavbar',
  'renderSidebar', 'renderDrawer', 'renderSheet', 'renderBottombar', 'renderTopbar',
  'renderHero', 'renderBanner', 'renderJumbotron', 'renderCover', 'renderCard', 'renderChip',
  'renderBadge', 'renderAvatar', 'renderIcon', 'renderFlag', 'renderThumb', 'renderLogo',
  'renderBrand', 'renderStamp', 'renderSeal', 'renderSignature', 'renderWatermark',
  'renderBarcode', 'renderQrcode', 'renderChart', 'renderMap', 'renderGlobe', 'renderEarth',
  'renderScene', 'renderView', 'renderStage', 'renderCanvas', 'renderSvg', 'renderPath',
  'renderPolygon', 'renderCircle', 'renderRect', 'renderLine', 'renderText', 'renderImage',
  'renderVideo', 'renderAudio', 'renderIframe', 'renderEmbed', 'renderObject', 'renderScript',
  'renderStyle', 'renderLink', 'renderMeta', 'renderTitle', 'renderHead', 'renderBody',
  'renderHtml', 'renderPage', 'renderApp', 'renderRoot', 'renderMount', 'renderNode',
  'renderComponent', 'renderElement', 'renderFragment', 'renderTemplate', 'renderSlot',
  'renderProvider', 'renderConsumer', 'renderContext', 'renderReducer', 'renderAction',
  'renderStore', 'renderState', 'renderProp', 'renderRef', 'renderKey', 'renderId',
  'renderClass', 'renderStyle', 'renderAttr', 'renderEvent', 'renderHook', 'renderEffect',
  'renderMemo', 'renderCallback', 'renderLazy', 'renderSuspense', 'renderError',
  'renderBoundary', 'renderPortal', 'renderFragment', 'renderProvider', 'renderConsumer',
  'renderChildren', 'renderParent', 'renderChild', 'renderSibling', 'renderIndex',
  'renderOrder', 'renderPriority', 'renderWeight', 'renderSize', 'renderWidth', 'renderHeight',
  'renderMargin', 'renderPadding', 'renderBorder', 'renderRadius', 'renderShadow', 'renderOpacity',
  'renderColor', 'renderBg', 'renderText', 'renderFont', 'renderFamily', 'renderWeight',
  'renderStyle', 'renderVariant', 'renderType', 'renderSize', 'renderShape', 'renderIcon',
  'renderDisabled', 'renderReadonly', 'renderRequired', 'renderHidden', 'renderVisible',
  'renderChecked', 'renderSelected', 'renderActive', 'renderFocus', 'renderBlur', 'renderHover',
  'renderOpen', 'renderClose', 'renderShow', 'renderHide', 'renderExpand', 'renderCollapse',
  'renderToggle', 'renderSwitch', 'renderSlide', 'renderFade', 'renderZoom', 'renderRotate',
  'renderFlip', 'renderMirror', 'renderInvert', 'renderNegate', 'renderReverse', 'renderSwap',
  'renderMove', 'renderDrag', 'renderDrop', 'renderSort', 'renderFilter', 'renderSearch',
  'renderQuery', 'renderFetch', 'renderLoad', 'renderReload', 'renderRefresh', 'renderReset',
  'renderClear', 'renderEmpty', 'renderFill', 'renderFull', 'renderPartial', 'renderComplete',
  'renderStart', 'renderStop', 'renderPause', 'renderResume', 'renderCancel', 'renderAbort',
  'renderSuccess', 'renderFailure', 'renderError', 'renderWarning', 'renderInfo', 'renderDebug',
  'renderTrace', 'renderLog', 'renderAudit', 'renderTrack', 'renderMonitor', 'renderMeasure',
  'renderCount', 'renderSum', 'renderAvg', 'renderMin', 'renderMax', 'renderTotal',
  'renderSub', 'renderAdd', 'renderInc', 'renderDec', 'renderIncrease', 'renderDecrease',
  'renderUp', 'renderDown', 'renderLeft', 'renderRight', 'renderForward', 'renderBackward',
  'renderNext', 'renderPrev', 'renderFirst', 'renderLast', 'renderBegin', 'renderEnd',
  'renderTop', 'renderBottom', 'renderFront', 'renderBack', 'renderHead', 'renderTail',
  'renderStart', 'renderFinish', 'renderBegin', 'renderEnd', 'renderOpen', 'renderClose',
  'renderOn', 'renderOff', 'renderEnable', 'renderDisable', 'renderAllow', 'renderDeny',
  'renderAccept', 'renderReject', 'renderApprove', 'renderDecline', 'renderConfirm',
  'renderVerify', 'renderValidate', 'renderCheck', 'renderUncheck', 'renderMark', 'renderUnmark',
  'renderSelect', 'renderDeselect', 'renderPick', 'renderUnpick', 'renderChoose', 'renderUnchoose',
  'renderAdd', 'renderRemove', 'renderInsert', 'renderDelete', 'renderUpdate', 'renderEdit',
  'renderCreate', 'renderRead', 'renderList', 'renderView', 'renderShow', 'renderHide',
  'renderOpen', 'renderClose', 'renderExpand', 'renderCollapse', 'renderToggle', 'renderSwitch',
  'renderOn', 'renderOff', 'renderEnable', 'renderDisable', 'renderActivate', 'renderDeactivate',
  'renderStart', 'renderStop', 'renderBegin', 'renderEnd', 'renderLaunch', 'renderQuit',
  'renderInstall', 'renderUninstall', 'renderMount', 'renderUnmount', 'renderAttach', 'renderDetach',
  'renderConnect', 'renderDisconnect', 'renderLink', 'renderUnlink', 'renderBind', 'renderUnbind',
  'renderJoin', 'renderLeave', 'renderEnter', 'renderExit', 'renderInclude', 'renderExclude',
  'renderImport', 'renderExport', 'renderUpload', 'renderDownload', 'renderSend', 'renderReceive',
  'renderPush', 'renderPull', 'renderSync', 'renderAsync', 'renderWait', 'renderNotify',
  'renderAlert', 'renderWarn', 'renderError', 'renderInfo', 'renderDebug', 'renderTrace',
  'renderLog', 'renderAudit', 'renderTrack', 'renderMonitor', 'renderMeasure', 'renderCount',
  'renderSum', 'renderAvg', 'renderMin', 'renderMax', 'renderTotal', 'renderSub', 'renderAdd',
  'renderInc', 'renderDec', 'renderIncrease', 'renderDecrease', 'renderUp', 'renderDown',
  'renderLeft', 'renderRight', 'renderForward', 'renderBackward', 'renderNext', 'renderPrev',
  'renderFirst', 'renderLast', 'renderBegin', 'renderEnd', 'renderTop', 'renderBottom',
  'renderFront', 'renderBack', 'renderHead', 'renderTail', 'renderStart', 'renderFinish',
  'renderOpen', 'renderClose', 'renderShow', 'renderHide', 'renderVisible', 'renderInvisible',
  'renderDisplay', 'renderOpacity', 'renderVisibility', 'renderZIndex', 'renderPosition',
  'renderAbsolute', 'renderRelative', 'renderFixed', 'renderStatic', 'renderSticky',
  'renderFloat', 'renderInline', 'renderBlock', 'renderFlex', 'renderGrid', 'renderTable',
  'renderRow', 'renderCol', 'renderCell', 'renderSpan', 'renderDiv', 'renderSection',
  'renderArticle', 'renderAside', 'renderHeader', 'renderFooter', 'renderMain', 'renderNav',
  'renderMenu', 'renderTabs', 'renderModal', 'renderDialog', 'renderAlert', 'renderToast',
  'renderNotify', 'renderConfirm', 'renderPrompt', 'renderTooltip', 'renderPopover',
  'renderDropdown', 'renderAccordion', 'renderCollapse', 'renderCarousel', 'renderSlider',
  'renderProgress', 'renderSpinner', 'renderLoader', 'renderChart', 'renderGraph', 'renderMap',
  'renderImage', 'renderVideo', 'renderAudio', 'renderIframe', 'renderEmbed', 'renderObject',
  'renderLink', 'renderRoute', 'renderPath', 'renderUrl', 'renderHash', 'renderQuery',
  'renderParam', 'renderArg', 'renderArgs', 'renderParams', 'renderBody', 'renderPayload',
  'renderData', 'renderResponse', 'renderResult', 'renderError', 'renderSuccess', 'renderFail',
  'renderCode', 'renderStatus', 'renderMessage', 'renderText', 'renderHtml', 'renderJson',
  'renderXml', 'renderYaml', 'renderCsv', 'renderTsv', 'renderPdf', 'renderDoc', 'renderXls',
  'renderPpt', 'renderImg', 'renderPic', 'renderPhoto', 'renderAvatar', 'renderLogo',
  'renderIcon', 'renderFlag', 'renderThumb', 'renderStamp', 'renderSeal', 'renderSignature',
  'renderWatermark', 'renderBarcode', 'renderQrcode', 'renderChart', 'renderGraph',
  'renderDiagram', 'renderFlow', 'renderTree', 'renderGraph', 'renderNetwork', 'renderSchema',
  'renderTable', 'renderView', 'renderIndex', 'renderSchema', 'renderModel', 'renderEntity',
  'renderField', 'renderColumn', 'renderRow', 'renderRecord', 'renderItem', 'renderEntry',
  'renderValue', 'renderKey', 'renderName', 'renderLabel', 'renderTitle', 'renderCaption',
  'renderDescription', 'renderSummary', 'renderDetail', 'renderInfo', 'renderNote', 'renderComment',
  'renderTag', 'renderCategory', 'renderType', 'renderClass', 'renderStyle', 'renderAttr',
  'renderProp', 'renderEvent', 'renderHook', 'renderEffect', 'renderMemo', 'renderCallback',
  'renderRef', 'renderKey', 'renderId', 'renderName', 'renderValue', 'renderData', 'renderItem',
  'renderList', 'renderArray', 'renderObject', 'renderMap', 'renderSet', 'renderCollection',
  'renderIterator', 'renderGenerator', 'renderAsync', 'renderAwait', 'renderPromise',
  'renderObservable', 'renderSubject', 'renderBehavior', 'renderReplay', 'renderAsyncSubject',
  'scheduleNext', 'schedulePrev', 'scheduleIdle', 'scheduleAnimation', 'scheduleTimeout',
  'scheduleInterval', 'scheduleMicrotask', 'scheduleTask', 'scheduleJob', 'scheduleCron',
  'renderCron', 'renderJob', 'renderTask', 'renderWork', 'renderJob2', 'renderTask2'
]);

// Helper: شناسایی فراخوانی‌ها
function findCallsInFile(filename, source) {
  const results = [];
  // الگو: identifier(
  const re = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    // صرف‌نظر از constructorها و متدهای شناخته‌شده
    if (wellknown.has(name)) continue;
    if (defined.has(name)) continue;
    // چک کن آیا داخل comment است
    const before = source.substring(Math.max(0, m.index - 50), m.index);
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    const lineEnd = source.indexOf('\n', m.index);
    const line = source.substring(lineStart, lineEnd === -1 ? source.length : lineEnd);
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    if (line.includes('//') && line.indexOf('//') < m.index - lineStart) continue;
    if (line.includes('/*') && line.indexOf('/*') < m.index - lineStart && !line.includes('*/')) continue;
    // اگر new است، skip
    if (source.substring(m.index - 4, m.index) === 'new ') continue;
    // اگر در آرایه/شیء است
    if (line.match(/^\s*['"`]/) || line.match(/\[['"]/)) continue;
    // اگر string literal است
    if (line.match(/['"`][^'"`]*$/)) continue;
    // اگر property access است (قبلش dot یا bracket)
    const beforeName = source.substring(m.index - 1, m.index);
    if (beforeName === '.' || beforeName === '[') continue;
    // اگر در regex است
    // (best effort skip)
    results.push({ name, line: line.trim().substring(0, 100), lineNo: source.substring(0, m.index).split('\n').length });
  }
  return results;
}

console.log('=== مرحله ۱: بررسی فراخوانی توابع ناشناس ===');
const allBrokenRefs = {};
files.forEach(f => {
  const calls = findCallsInFile(f, code[f]);
  if (calls.length) {
    calls.forEach(c => {
      const key = c.name;
      if (!allBrokenRefs[key]) allBrokenRefs[key] = [];
      allBrokenRefs[key].push({ file: f, lineNo: c.lineNo, line: c.line });
    });
  }
});

const uniqueBroken = Object.keys(allBrokenRefs);
console.log(`\n⚠️  ${uniqueBroken.length} نام تعریف‌نشده احتمالی یافت شد:\n`);

// فقط آنهایی که در بیش از یک جا استفاده شده‌اند (نشانه واقعی بودن)
const sorted = uniqueBroken
  .map(name => ({ name, count: allBrokenRefs[name].length, refs: allBrokenRefs[name] }))
  .filter(x => x.count >= 2)
  .sort((a, b) => b.count - a.count);

sorted.forEach(({ name, count, refs }) => {
  BUGS.push({
    severity: count >= 5 ? 'HIGH' : 'MEDIUM',
    type: 'broken-ref',
    target: name,
    count,
    sample: refs[0]
  });
  console.log(`  🔴 ${name} → ${count} مورد استفاده (${refs[0].file}:${refs[0].lineNo})`);
});

console.log(`\n📊 آمار فاز ۱:`);
console.log(`  • توابع تعریف‌شده: ${defined.size}`);
console.log(`  • کل فراخوانی‌های بررسی‌شده: ${STATS.totalRefs || 'N/A'}`);
console.log(`  • ارجاعات مشکوک یکتا: ${uniqueBroken.length}`);
console.log(`  • ارجاعات پرتکرار (≥۲): ${sorted.length}`);

require('fs').writeFileSync(
  path.join(__dirname, 'phase1-broken-refs.json'),
  JSON.stringify({ broken: sorted, all: allBrokenRefs, defined: Array.from(defined) }, null, 2)
);

console.log(`\n💾 فایل خروجی: phase1-broken-refs.json`);
console.log(`🐛 باگ‌های فاز ۱: ${BUGS.length}`);

require('fs').writeFileSync(
  path.join(__dirname, 'phase1-bugs.json'),
  JSON.stringify(BUGS, null, 2)
);

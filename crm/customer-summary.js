/* =====================================================================
   PTF CRM — v34.39.42 — Customer overview (read-only)
   Entry points: customer name / «خلاصه» in the sales customer list.
   No balances, statuses, migrations or customer fields are written here.
   Identity: _id/cd aliases first; name fallback must have exactly one owner.
   Sales: effective order value, once per case; not invoices + won offers.
   Collections/accounts: the existing PTF.ar kernel is the only money source.
   ===================================================================== */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : globalThis;
  W.PTF = W.PTF || {};
  var PAGE_SIZE = 20, view = null, generation = 0;
  var SENIOR = ['admin', 'chairman', 'ceo', 'commercial'];
  var OFFER_STATUS = { draft: 'پیش‌نویس', registered: 'ثبت‌شده', sent: 'ارسال‌شده', revise: 'در حال اصلاح', approved: 'تأیید فنی', rejected: 'عدم تأیید فنی', won: 'برنده / ابلاغ سفارش', lost: 'بازنده', cancelled: 'لغوشده', closed: 'مختومه' };

  function text(v) { return String(v == null ? '' : v).trim(); }
  function dict() { return Object.create(null); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function idOf(r) { return text(W.PTF.id ? W.PTF.id(r) : (r && (r._id || r.cd))); }
  function aliases(r) { return W.PTF.aliases ? W.PTF.aliases(r).map(text).filter(Boolean) : [text(r && r._id), text(r && r.cd)].filter(Boolean); }
  function num(v) { var n = W.PTF.toFaEnNum ? W.PTF.toFaEnNum(v) : Number(v); return isFinite(n) ? n : 0; }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function digits(v) { return String(v == null ? '' : v).replace(/[۰-۹٠-٩]/g, function (c) { var i = '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); return String(i < 0 ? '٠١٢٣٤٥٦٧٨٩'.indexOf(c) : i); }); }
  function normName(v) {
    if (typeof W.dedupNorm === 'function') return W.dedupNorm(v);
    return digits(v).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200e\u200f\s\-_.،,؛;()]/g, '').toLowerCase();
  }
  function retained(r) {
    if (!r || r.deleted || r._deleted || r.void || r.voided) return false;
    return ['void', 'voided', 'deleted', 'replaced', 'superseded'].indexOf(text(r.status || r.st).toLowerCase()) < 0 && !r.supersededByOfferNo;
  }
  function can(panel) {
    try {
      if (typeof W.ptfCanAccess === 'function') return !!W.ptfCanAccess(panel);
      return typeof W.canPanel === 'function' && !!W.canPanel(panel);
    } catch (e) { return false; }
  }
  function rights() {
    var r = {};
    try { r = typeof W.roleDef === 'function' ? W.roleDef() || {} : {}; } catch (e) {}
    function ledger(k) { try { return typeof W.ptfCanSeeLedger === 'function' && !!W.ptfCanSeeLedger(k); } catch (e) { return false; } }
    var finance = can('inv') || can('recv');
    return { rfq: can('rfq'), offers: can('off'), cases: can('deals'), archive: can('prj'), sell: !!r.sellPrice,
      official: finance && ledger('official'), unofficial: finance && ledger('unofficial') };
  }
  function read(k, warnings) {
    try {
      if (typeof W.getData !== 'function') throw new Error('reader_unavailable');
      var v = W.getData(k);
      if (!Array.isArray(v)) throw new Error('collection_not_array');
      return v.filter(function (r) { return r && typeof r === 'object'; });
    } catch (e) { warnings.push('خواندن اطلاعات «' + k.replace('ptf_crm_', '') + '» انجام نشد؛ خلاصه ممکن است ناقص باشد.'); return []; }
  }
  function outcome(ids, blocked) {
    ids = ids.filter(function (v, i) { return !!v && ids.indexOf(v) === i; });
    return { status: ids.length > 1 ? 'ambiguous' : (ids.length === 1 && !blocked ? 'resolved' : 'unresolved'), customerId: ids.length === 1 && !blocked ? ids[0] : '', candidates: ids, blocked: !!blocked };
  }
  function mergeOwners(owners) {
    var ids = [], blocked = false;
    owners.forEach(function (o) { if (!o) return; ids = ids.concat(o.candidates || []); blocked = blocked || o.blocked; });
    return outcome(ids, blocked);
  }
  function partyIndex(customers) {
    var byId = dict(), byName = dict();
    function add(map, key, id) { if (!key || !id) return; var l = map[key] || (map[key] = []); if (l.indexOf(id) < 0) l.push(id); }
    customers.forEach(function (c) {
      var id = idOf(c); if (!id) return;
      aliases(c).forEach(function (a) { add(byId, a, id); });
      [c.co, c.name, c.coEn].forEach(function (n) { add(byName, normName(n), id); });
    });
    function explicit(r) {
      var refs = [r.customerId, r.buyerCd, r.custCd, r.customerCd].map(text).filter(Boolean);
      if (!refs.length) return null;
      var ids = [], blocked = false;
      refs.forEach(function (ref) { var hits = byId[ref] || []; ids = ids.concat(hits); if (!hits.length) blocked = true; });
      var result = outcome(ids, blocked); result.explicit = true;
      return result;
    }
    function named(r) {
      var names = [r.buyerCo, r.co, r.company, r.customerName].map(normName).filter(Boolean), ids = [], blocked = false;
      names.forEach(function (n) { var hits = byName[n] || []; ids = ids.concat(hits); if (!hits.length) blocked = true; });
      return outcome(ids, blocked);
    }
    return { byId: byId, explicit: explicit, named: named };
  }
  function refIndex(records, extra) {
    var idx = dict();
    records.forEach(function (r) {
      aliases(r).concat(extra(r)).map(text).filter(Boolean).forEach(function (k) {
        var l = idx[k] || (idx[k] = []); if (l.indexOf(r) < 0) l.push(r);
      });
    });
    return idx;
  }
  function latest(records, offer) {
    var map = dict(), out = [];
    records.forEach(function (r, i) {
      var k = (offer && text(r.no)) || idOf(r) || ('anonymous:' + i), prev = map[k];
      if (!prev) { map[k] = r; out.push(k); }
      else if (num(r.rev) > num(prev.rev) || (num(r.rev) === num(prev.rev) && text(r.updatedAtISO || r.updatedAt) > text(prev.updatedAtISO || prev.updatedAt))) map[k] = r;
    });
    return out.map(function (k) { return map[k]; }).filter(retained);
  }
  function caseRefs(c) {
    var refs = [c.rootOfferId, c.wonOffer, c.offerNo].concat(arr(c.offerNos));
    arr(c.linkedOffers).forEach(function (l) { if (l) refs.push(l.offerId, l.offerNo, l.no); });
    arr(c.awardDocs).forEach(function (d) { if (d) refs.push(d.offerId, d.offerNo, d.no, d.snap && d.snap.no); });
    arr(c.docSnap && c.docSnap.offers).forEach(function (d) { if (typeof d === 'object' && d) refs = refs.concat(aliases(d), [d.offerId, d.no, d.offerNo]); else refs.push(d); });
    var archiveNo = text(c.no).replace(/^ARC-/i, '');
    if (/^(CO|TC)-/i.test(archiveNo)) refs.push(archiveNo);
    return refs.map(text).filter(function (v, i, a) { return !!v && a.indexOf(v) === i; });
  }
  function commercialDoc(d) { return d && (d.role === 'commercial' || ['CO', 'TC', 'won_snapshot'].indexOf(d.kind) > -1); }
  function cancelled(c) { return [c.status, c.st, c.state].some(function (s) { return text(s) === 'cancelled'; }); }
  function caseRootRefs(c, offers) {
    var refs = [c.rootOfferId, c.wonOffer, c.offerNo].map(text).filter(Boolean);
    if (!refs.length) arr(c.linkedOffers).forEach(function (l) { if (l && l.relationType === 'root') refs.push(l.offerId, l.offerNo, l.no); });
    if (!refs.filter(Boolean).length) {
      var doc = arr(c.awardDocs).filter(commercialDoc).sort(function (a, b) { return num(b.rev) - num(a.rev); })[0];
      if (doc) refs = [doc.offerId, doc.offerNo, doc.no, doc.snap && doc.snap.no];
    }
    if (!refs.filter(Boolean).length) {
      var links = caseRefs(c), winners = offers.filter(function (o) {
        return ['CO', 'TC'].indexOf(o.kind) > -1 && offerStatus(o) === 'won' && !companionOf(o) && !o.isAmendment && !o.amendmentOf && !o.amendmentOfCaseId &&
          aliases(o).concat([text(o.no)]).some(function (ref) { return ref && links.indexOf(ref) > -1; });
      });
      if (winners.length === 1) refs = aliases(winners[0]).concat([winners[0].no]);
      else {
        var snaps = arr(c.docSnap && c.docSnap.offers).filter(function (s) { return s && ['CO', 'TC'].indexOf(s.kind) > -1 && text(s.st || s.status) === 'won' && !companionOf(s) && !s.isAmendment; });
        if (snaps.length === 1) refs = [snaps[0].offerId, snaps[0].offerNo, snaps[0].no];
      }
    }
    refs = refs.map(text).filter(Boolean);
    /* _id-only live roots and no-only archived roots still identify one order. */
    offers.forEach(function (o) { if (aliases(o).concat([text(o.no)]).some(function (a) { return a && refs.indexOf(a) > -1; })) refs = refs.concat(aliases(o), [text(o.no)]); });
    return refs.filter(function (v, i) { return v && refs.indexOf(v) === i; });
  }
  function companionOf(o) { return text(o.rialOf || o.fxOf || (o.fxConvert && o.fxConvert.from)); }
  function offerStatus(o) { var st = text(o.st || o.status) || 'draft'; return o.kind === 'TO' ? (st === 'won' ? 'approved' : st === 'lost' ? 'rejected' : st) : st; }
  function dateOf(r, kind) {
    var raw = kind === 'case' ? (r.wonAtISO || r.wonAt || r.t || r.closedAt) : kind === 'invoice' ? (r.invDate || r.dateISO || r.t) : (r.dateEn || r.dateISO || r.dateFa || r.dt || r.createdAtISO || r.crAt || r.t);
    var s = digits(text(raw)), m = s.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/), iso = '';
    if (m) {
      if (+m[1] >= 1900) iso = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
      else if (typeof W.ptfJToISO === 'function') { try { iso = W.ptfJToISO(m[0]) || ''; } catch (e) {} }
    }
    var display = text(raw);
    if (iso && typeof W.ptfISOToJ === 'function') { try { display = W.ptfISOToJ(iso) || display; } catch (e2) {} }
    return { date: display || '—', iso: iso };
  }
  function sorted(rows) {
    return rows.slice().sort(function (a, b) { return a.iso === b.iso ? 0 : (a.iso < b.iso ? 1 : -1); });
  }
  function stats(rows) {
    var byStatus = dict();
    rows.forEach(function (r) { var b = byStatus[r.status] || (byStatus[r.status] = { label: r.label, count: 0 }); b.count++; });
    return { total: rows.length, byStatus: byStatus };
  }
  function nominal(o) { return arr(o && o.items).reduce(function (s, it) { return it ? s + num(it.qty) * num(it.price) : s; }, 0); }
  function moneyValue(raw, currency, source) {
    currency = text(currency).toUpperCase() || 'IRR';
    var rate = currency === 'IRR' ? 1 : 0;
    source = source || {};
    /* The order can carry currency even when its legacy offer does not. Never let
       fxRateOf's default IRR=1 turn an unpriced USD/EUR order into one-rial FX. */
    if (!rate && (!source.currency || text(source.currency).toUpperCase() === currency)) {
      var fxContext = { currency: currency, fxRateRef: source.fxRateRef, fxConvert: source.fxConvert, marginAtClose: source.marginAtClose };
      if (W.PTF.metrics && typeof W.PTF.metrics.fxRateOf === 'function') rate = num(W.PTF.metrics.fxRateOf(fxContext));
      else rate = num(source.fxRateRef || (source.fxConvert && source.fxConvert.rate));
    }
    return { raw: raw, currency: currency, irr: rate > 0 ? Math.round(raw * rate) : null };
  }
  function emptyMoney() { return { byCurrency: dict(), irr: 0, fxMissing: 0, unpriced: 0, count: 0 }; }
  function addMoney(total, value) {
    total.count++;
    if (!value) { total.unpriced++; return; }
    total.byCurrency[value.currency] = (total.byCurrency[value.currency] || 0) + value.raw;
    if (value.irr === null) total.fxMissing++; else total.irr += value.irr;
  }
  function caseMoney(c, offers, rootRefs) {
    rootRefs = rootRefs || caseRootRefs(c, offers);
    var roots = offers.filter(function (o) { return rootRefs.some(function (ref) { return text(o.no) === ref || aliases(o).indexOf(ref) > -1; }); });
    var root = roots.length === 1 ? roots[0] : null;
    var docs = arr(c.awardDocs).filter(function (d) {
      return commercialDoc(d) && (!rootRefs.length || [d.no, d.offerNo, d.offerId, d.snap && d.snap.no].map(text).some(function (ref) { return ref && rootRefs.indexOf(ref) > -1; }));
    }).sort(function (a, b) { return num(b.rev) - num(a.rev); });
    var doc = docs[0] || null, snap = doc && doc.snap;
    var raw = null;
    /* win_offer updates contractAmount for a newly won amendment; the
       effectiveContractAmount mirror is refreshed only by revise_award.
       Keep legitimate zero amounts and use the mirror only for legacy data. */
    if (c.contractAmount != null && c.contractAmount !== '') raw = num(c.contractAmount);
    else if (c.effectiveContractAmount != null && c.effectiveContractAmount !== '') raw = num(c.effectiveContractAmount);
    else {
      if (snap && Array.isArray(snap.items)) raw = nominal(snap);
      else if (doc && doc.total != null) raw = num(doc.total);
      else if (root && Array.isArray(root.items)) raw = root.wonRevisionSnapshot && root.wonRevisionSnapshot.total != null ? num(root.wonRevisionSnapshot.total) : nominal(root);
      if (raw !== null) arr(c.linkedOffers).forEach(function (l) { if (l && l.relationType === 'amendment') raw += num(l.amount); });
    }
    if (raw === null) return null; // Archive stats.totalCO is NOT a sale: it also contains losing/draft offers.
    var source = num(c.fxRateRef || (c.fxConvert && c.fxConvert.rate)) > 0 ? c : (root || snap || c), currency = c.currency || (snap && snap.currency) || (root && root.currency) || 'IRR';
    return moneyValue(raw, currency, source);
  }
  function caseLabel(c, archived) {
    if (c.closeKind === 'lost') return 'مختومه بدون خرید';
    if (cancelled(c)) return 'سفارش لغوشده';
    if (archived) return c.closeKind === 'settled' ? 'بایگانی / تسویه‌شده' : 'بایگانی‌شده';
    /* Do not call the legacy sfStageLabel: sfStageOf/sfDocsOf reads unrestricted
       invoices, payments and supply data even for users without ledger access.
       Overall active/archive/lost/cancelled state here uses this record only. */
    return c.wonOffer || c.rootOfferId ? 'ابلاغ سفارش / فعال' : 'پرونده در جریان';
  }
  function customerAllowed(c, customers, rfqs, parties) {
    try {
      if (W.ptfMyCustFilter && typeof W.ptfMyCustFilter.applyFilter === 'function') return W.ptfMyCustFilter.applyFilter(customers).some(function (x) { return idOf(x) && idOf(x) === idOf(c); });
      if (typeof W.curRole === 'function' && SENIOR.indexOf(W.curRole()) > -1) return true;
      var user = typeof W.curSession === 'function' ? text((W.curSession() || {}).user) : '';
      if (!user) return false;
      if (text(c.owner || c.crBy) === user) return true;
      return rfqs.some(function (r) { var owner = parties.explicit(r); return text(r.crBy || r.owner) === user && owner && owner.status === 'resolved' && owner.customerId === idOf(c); });
    } catch (e) { return false; }
  }

  /* DOM-independent model; also enforces the caller's current panel/customer scope. */
  function build(customerId) {
    if (!can('cust')) return { ok: false, error: 'دسترسی به بخش مشتریان ندارید.' };
    var warnings = [], customers = read('ptf_crm_customers', warnings), parties = partyIndex(customers);
    var ids = parties.byId[text(customerId)] || [];
    if (ids.length !== 1) return { ok: false, error: ids.length ? 'شناسهٔ مشتری مبهم است؛ ابتدا رکوردهای تکراری را بررسی کنید.' : 'مشتری پیدا نشد؛ فهرست مشتریان را بازخوانی کنید.' };
    var cid = ids[0], c = customers.filter(function (r) { return idOf(r) === cid; })[0], access = rights();
    var rfqs = access.rfq ? read('ptf_crm_rfqs', warnings) : [];
    if (!customerAllowed(c, customers, rfqs, parties)) return { ok: false, error: 'این مشتری در محدودهٔ دسترسی شما نیست.' };
    var offers = access.offers ? read('ptf_crm_offers', warnings) : [];
    var deals = access.cases ? read('ptf_crm_deals', warnings) : [];
    var archives = access.archive ? read('ptf_crm_projects', warnings) : [];
    var rfqIdx = refIndex(rfqs, function (r) { return [r.inqNo]; });
    var offerIdx = refIndex(offers, function (o) { return [o.no]; });
    function rfqOwner(r) { return parties.explicit(r) || parties.named(r); }
    function offerOwner(o) {
      var direct = parties.explicit(o); if (direct) return direct;
      var name = parties.named(o); if (name.status === 'resolved') return name;
      var linked = [];
      [o.rfqId, o.srcRfq, o.inqNo].map(text).filter(Boolean).forEach(function (ref) { arr(rfqIdx[ref]).forEach(function (r) { linked.push(rfqOwner(r)); }); });
      if (linked.length) return mergeOwners(linked);
      return name;
    }
    function caseOwner(r) {
      var proofs = [], identifiers = [], direct = parties.explicit(r); if (direct) identifiers.push(direct);
      caseRefs(r).forEach(function (ref) { arr(offerIdx[ref]).forEach(function (o) {
        var explicit = parties.explicit(o);
        if (explicit) identifiers.push(explicit); else proofs.push(offerOwner(o));
      }); });
      arr(r.awardDocs).forEach(function (d) { if (d && d.snap) {
        var explicit = parties.explicit(d.snap);
        if (explicit) identifiers.push(explicit); else proofs.push(parties.named(d.snap));
      } });
      /* As in AR, proven identifiers outrank old display names; conflicting IDs
         remain fail-closed. Renaming a customer must not lose its order history. */
      if (identifiers.length) return mergeOwners(identifiers);
      if (proofs.length) return mergeOwners(proofs);
      [r.rfqId, r.inqNo].map(text).filter(Boolean).forEach(function (ref) { arr(rfqIdx[ref]).forEach(function (q) { proofs.push(rfqOwner(q)); }); });
      return proofs.length ? mergeOwners(proofs) : parties.named(r);
    }
    var ambiguous = 0;
    function mine(records, resolver) {
      return records.filter(function (r) {
        var o = resolver(r);
        if (o.status !== 'resolved' && o.candidates.indexOf(cid) > -1) ambiguous++;
        return o.status === 'resolved' && o.customerId === cid;
      });
    }
    /* Select current revisions before customer filtering. Otherwise a corrected
       owner on the latest revision could leave its old revision in another account. */
    var ownRfqs = mine(latest(rfqs), rfqOwner), ownOffers = mine(latest(offers, true), offerOwner);
    var requestRows = ownRfqs.map(function (r, i) {
      var date = dateOf(r, 'rfq'), st = text(r.st || r.status) || 'st1';
      var status = arr(W.PTF_RFQ_STATUSES).filter(function (s) { return s.v === st; })[0];
      return { id: idOf(r) || ('rfq:' + i), ref: text(r.cd) || idOf(r), inqNo: text(r.inqNo), kind: 'rfq', openRef: text(r.cd),
        title: text(r.subj || r.ca) || 'درخواست مشتری', date: date.date, iso: date.iso, status: st, label: text(r.stxt) || (status && status.t) || st,
        assignee: typeof r.assignee === 'string' ? r.assignee : text(r.assignee && (r.assignee.name || r.assignee.user)) || text(r.owner || r.crBy) };
    });
    var offerRows = ownOffers.map(function (o, i) {
      var date = dateOf(o, 'offer'), st = offerStatus(o), companion = companionOf(o), validUntil = dateOf({ dateEn: o.validUntil }, 'offer').iso;
      return { id: idOf(o) || text(o.no) || ('offer:' + i), ref: text(o.no) || idOf(o), openRef: text(o.no), inqNo: text(o.inqNo), kind: 'offer', offerKind: o.kind,
        rev: num(o.rev), date: date.date, iso: date.iso, status: st, label: OFFER_STATUS[st] || st, companion: companion,
        expired: !!(validUntil && ['won', 'lost', 'approved', 'rejected', 'cancelled', 'closed'].indexOf(st) < 0 && validUntil < new Date().toISOString().slice(0, 10)),
        value: access.sell && o.kind !== 'TO' ? moneyValue(nominal(o), o.currency, o) : null };
    });
    var technical = offerRows.filter(function (r) { return r.offerKind === 'TO' && !r.companion; });
    var commercial = offerRows.filter(function (r) { return (r.offerKind === 'CO' || r.offerKind === 'TC') && !r.companion; });
    var rawCases = mine(deals, caseOwner).filter(retained).map(function (r) { return { record: r, source: 'deal', archived: text(r.st || r.status) === 'archived' }; })
      .concat(mine(archives, caseOwner).filter(retained).map(function (r) { return { record: r, source: 'archive', archived: r.state === 'archived' || r.origin === 'salesfile' }; }));
    /* Same order in live + archive is one order. A restored live record wins;
       otherwise its archived copy wins. Never deduplicate by inquiry number alone. */
    var uniqueCases = [];
    rawCases.forEach(function (entry) {
      var keys = aliases(entry.record).concat([text(entry.record.dealCd)]).filter(Boolean), roots = caseRootRefs(entry.record, ownOffers);
      /* These are ephemeral entry DTOs, not source records. Avoid scanning all
         offers again for every pair of customer orders during deduplication. */
      entry.keys = keys; entry.roots = roots;
      var at = -1;
      uniqueCases.some(function (old, i) {
        var oldKeys = old.keys, oldRoots = old.roots;
        if (keys.some(function (k) { return oldKeys.indexOf(k) > -1; }) || roots.some(function (k) { return oldRoots.indexOf(k) > -1; })) { at = i; return true; }
        return false;
      });
      if (at < 0) uniqueCases.push(entry);
      else if (entry.source === 'deal' && entry.record.restoredFrom || (entry.archived && !uniqueCases[at].record.restoredFrom)) uniqueCases[at] = entry;
    });
    var sale = emptyMoney(), pipeline = emptyMoney(), covered = dict(), caseRows = [], orphanWon = 0;
    uniqueCases.forEach(function (entry, i) {
      var r = entry.record, date = dateOf(r, 'case'), refs = caseRefs(r).concat(entry.roots);
      refs.forEach(function (ref) { covered[ref] = true; });
      var purchased = r.closeKind !== 'lost' && !cancelled(r) && !!(entry.roots.length || r.closeKind === 'settled' || r.contractAmount != null || r.effectiveContractAmount != null || arr(r.awardDocs).some(commercialDoc));
      var value = access.sell && purchased ? caseMoney(r, ownOffers, entry.roots) : null;
      if (purchased) addMoney(sale, value);
      caseRows.push({ id: idOf(r) || ('case:' + i), ref: text(r.cd || r.no) || idOf(r), openRef: text(entry.source === 'archive' ? r.no : r.cd), kind: entry.source,
        inqNo: text(r.inqNo), date: date.date, iso: date.iso, status: cancelled(r) ? 'cancelled' : entry.archived ? 'archived' : (r.closeKind === 'lost' ? 'lost' : 'active'), label: caseLabel(r, entry.archived), value: value });
    });
    ownOffers.forEach(function (o) {
      if (['CO', 'TC'].indexOf(o.kind) < 0 || companionOf(o)) return;
      var st = offerStatus(o);
      if (st === 'won') {
        if (aliases(o).concat([text(o.no)]).some(function (k) { return !!k && covered[k]; })) return;
        /* A conflicting case must not reappear as a made-up orphan sale. */
        if (deals.concat(archives).some(function (c2) { return retained(c2) && caseRefs(c2).some(function (ref) { return ref === text(o.no) || aliases(o).indexOf(ref) > -1; }); })) return;
        orphanWon++;
        var snap = o.wonRevisionSnapshot, raw = snap && snap.total != null ? num(snap.total) : nominal(o);
        if (access.sell) addMoney(sale, moneyValue(raw, o.currency, o));
        else sale.count++;
      } else if (access.sell && ['lost', 'cancelled', 'closed'].indexOf(st) < 0) addMoney(pipeline, moneyValue(nominal(o), o.currency, o));
    });
    if (ambiguous) warnings.push(ambiguous.toLocaleString('fa-IR') + ' رکورد با ارتباط مبهم یا متعارض با این مشتری در آمار لحاظ نشد.');
    if (orphanWon) warnings.push(orphanWon.toLocaleString('fa-IR') + ' پیشنهاد برنده، پروندهٔ قابل‌مشاهده ندارد؛ مبلغ آن فقط یک بار در فروش قطعی لحاظ شده است.');
    if (access.sell && sale.unpriced) warnings.push(sale.unpriced.toLocaleString('fa-IR') + ' سفارش فاقد مبلغ قابل‌اتکا است و در جمع مبلغ فروش لحاظ نشده است.');
    var finance = null, invoiceRows = [];
    if (access.official || access.unofficial) {
      var ar = W.PTF.ar;
      if (!ar || typeof ar.customerInvoices !== 'function' || typeof ar.invoiceState !== 'function' || typeof ar.customerPosition !== 'function') warnings.push('ماژول حساب مشتری در دسترس نیست؛ مبالغ وصول و مانده محاسبه نشد.');
      else try {
        var invoices = ar.customerInvoices(cid).filter(function (inv) { return inv.isUnofficial ? access.unofficial : access.official; });
        var legacyPaid = 0, invoiceCredit = 0;
        invoiceRows = invoices.map(function (inv) {
          var state = ar.invoiceState(inv), date = dateOf(inv, 'invoice');
          legacyPaid += num(state.legacyPaid); invoiceCredit += num(state.overPaid);
          var st = state.open > 0.5 ? (state.applied > 0 ? 'partial' : 'open') : (state.billed === 0 && state.returned > 0 ? 'returned' : 'settled');
          return { id: idOf(inv), ref: text(inv.no || inv.cd) || idOf(inv), kind: 'invoice', date: date.date, iso: date.iso, unofficial: !!inv.isUnofficial,
            status: st, label: { partial: 'تسویه جزئی', open: 'باز / وصول‌نشده', returned: 'مرجوع‌شده', settled: 'تسویه‌شده' }[st], gross: num(state.grossBilled), returned: num(state.returned), paid: num(state.paid), open: num(state.open) };
        });
        var pos = ar.customerPosition(cid, { invoices: invoices }), fullLedger = access.official && access.unofficial;
        finance = { gross: num(pos.grossBilled), returned: num(pos.returned), billed: num(pos.billed), open: num(pos.open),
          collected: fullLedger ? num(pos.received) + legacyPaid : num(pos.paid), credit: fullLedger ? num(pos.credit) : invoiceCredit, fullLedger: fullLedger };
      } catch (eFinance) { warnings.push('خواندن حساب مشتری انجام نشد؛ برای جلوگیری از نمایش ماندهٔ اشتباه، خلاصهٔ مالی نمایش داده نمی‌شود.'); invoiceRows = []; }
    }
    var activity = sorted(requestRows.concat(offerRows, caseRows, invoiceRows).filter(function (r) { return !!r.iso; }))[0] || null;
    return { ok: true, customer: { id: cid, cd: text(c.cd), name: text(c.co || c.name || c.coEn) || cid, en: text(c.coEn), industry: text(c.ind), owner: text(c.owner || c.crBy), vendor: text(c.venSt) },
      access: access, requests: sorted(requestRows), technical: sorted(technical), commercial: sorted(commercial),
      technicalAll: sorted(offerRows.filter(function (r) { return r.offerKind === 'TO'; })), commercialAll: sorted(offerRows.filter(function (r) { return ['CO', 'TC'].indexOf(r.offerKind) > -1; })),
      cases: sorted(caseRows), invoices: sorted(invoiceRows), counts: { requests: stats(requestRows), technical: stats(technical), commercial: stats(commercial), cases: stats(caseRows) },
      sale: sale, pipeline: pipeline, orphanWon: orphanWon, finance: finance, lastActivity: activity, warnings: warnings, at: new Date().toISOString() };
  }

  /* ---------- View: native buttons, safe data attributes, responsive RTL ---------- */
  function count(n) { return num(n).toLocaleString('fa-IR'); }
  function money(n, cur) { return num(n).toLocaleString(cur && cur !== 'IRR' ? 'en-US' : 'fa-IR', { maximumFractionDigits: cur && cur !== 'IRR' ? 2 : 0 }) + ' ' + (cur && cur !== 'IRR' ? esc(cur) : 'ریال'); }
  function dataButton(label, action, id, cls) { return '<button type="button" class="bt bt-o ' + (cls || '') + '" data-cs-action="' + action + '" data-cs-id="' + esc(id) + '" onclick="ptfCustomerSummaryNavigate(this.getAttribute(\'data-cs-action\'),this.getAttribute(\'data-cs-id\'))">' + label + '</button>'; }
  function badge(status, label) {
    var tone = ['won', 'approved', 'settled', 'st7'].indexOf(status) > -1 ? 'good' : ['lost', 'rejected', 'cancelled', 'stX'].indexOf(status) > -1 ? 'bad' : ['draft', 'archived', 'closed'].indexOf(status) > -1 ? 'muted' : 'info';
    return '<span class="cs-badge cs-' + tone + '">' + esc(label) + '</span>';
  }
  function moneyHtml(total) {
    var keys = Object.keys(total.byCurrency).sort(function (a, b) { return a === 'IRR' ? -1 : b === 'IRR' ? 1 : a.localeCompare(b); });
    var h = keys.map(function (cur) { return '<strong class="cs-money" dir="' + (cur === 'IRR' ? 'rtl' : 'ltr') + '">' + money(total.byCurrency[cur], cur) + '</strong>'; }).join('');
    if (!h) h = '<strong class="cs-money">' + (total.unpriced ? 'مبلغ نامشخص' : money(0, 'IRR')) + '</strong>';
    if (keys.some(function (k) { return k !== 'IRR'; })) h += '<small class="cs-sub">جمع معادل ریالی با نرخ‌های ثبت‌شده: ' + money(total.irr, 'IRR') + (total.fxMissing ? ' (ناقص)' : '') + '</small>';
    if (total.fxMissing) h += '<small class="cs-fx-warning">' + count(total.fxMissing) + ' مبلغ ارزی بدون نرخ مرجع؛ در جمع معادل ریالی لحاظ نشده است.</small>';
    return h;
  }
  function tabs(m) {
    var t = [];
    if (m.access.rfq) t.push({ id: 'requests', label: 'درخواست‌ها', rows: m.requests });
    if (m.access.offers) { t.push({ id: 'technical', label: 'پیشنهادهای فنی', rows: m.technicalAll }); t.push({ id: 'commercial', label: 'پیشنهادهای مالی', rows: m.commercialAll }); }
    if (m.access.cases || m.access.archive) t.push({ id: 'cases', label: 'پرونده‌های فروش', rows: m.cases });
    if (m.finance) t.push({ id: 'invoices', label: 'فاکتورها و وصول', rows: m.invoices });
    return t;
  }
  function statusHtml(rows) {
    var s = stats(rows).byStatus;
    return '<div class="cs-statuses">' + Object.keys(s).map(function (k) { return badge(k, s[k].label + ' · ' + count(s[k].count)); }).join('') + '</div>';
  }
  function valueCell(r) { return r.value ? money(r.value.raw, r.value.currency) : '—'; }
  function rowHtml(r, tab, showMoney) {
    var ref = '<b dir="ltr">' + esc(r.ref || 'بدون کد') + '</b>' + (r.inqNo && r.inqNo !== r.ref ? '<small class="cs-sub">درخواست: <bdi>' + esc(r.inqNo) + '</bdi></small>' : '');
    if (r.kind === 'offer') ref += '<small class="cs-sub">رویژن ' + count(r.rev) + (r.companion ? ' · نسخهٔ تبدیل‌شده از ' + esc(r.companion) : '') + (r.offerKind === 'TC' ? ' · فنی‌ـ‌مالی' : '') + '</small>';
    var h = '<td>' + ref + '</td>';
    if (tab === 'requests') h += '<td>' + esc(r.title) + '</td>';
    if (tab === 'invoices') h += '<td>' + (r.unofficial ? 'غیررسمی' : 'رسمی') + '</td>';
    h += '<td>' + esc(r.date) + '</td><td>' + badge(r.status, r.label) + (r.expired ? '<small class="cs-fx-warning">مهلت اعتبار گذشته</small>' : '') + '</td>';
    if (tab === 'requests') h += '<td>' + esc(r.assignee || '—') + '</td>';
    if (showMoney && (tab === 'commercial' || tab === 'cases')) h += '<td>' + valueCell(r) + '</td>';
    if (tab === 'invoices') h += '<td>' + money(r.gross) + '</td><td>' + money(r.paid) + '</td><td>' + money(r.open) + '</td>';
    else h += '<td>' + (r.openRef ? dataButton('مشاهده', r.kind, r.id, 'cs-row-button') : '<span class="cs-sub">بدون شناسهٔ قابل‌نمایش</span>') + '</td>';
    return '<tr>' + h + '</tr>';
  }
  function historyHtml(m, tab, limit) {
    var selected = tabs(m).filter(function (t) { return t.id === tab; })[0];
    if (!selected) return '<div class="cs-empty">بخشی برای نمایش در محدودهٔ دسترسی شما وجود ندارد.</div>';
    var rows = selected.rows, heads = ['شماره'];
    if (tab === 'requests') heads.push('موضوع');
    if (tab === 'invoices') heads.push('نوع سند');
    heads.push('تاریخ', 'وضعیت');
    if (tab === 'requests') heads.push('مسئول پیگیری');
    if (m.access.sell && (tab === 'commercial' || tab === 'cases')) heads.push(tab === 'cases' ? 'مبلغ قطعی سفارش' : 'مبلغ پیشنهاد');
    if (tab === 'invoices') heads = heads.concat(['مبلغ با مالیات', 'وصول تخصیصی', 'مانده']); else heads.push('عملیات');
    var conversionCount = rows.filter(function (r) { return !!r.companion; }).length;
    var h = statusHtml(rows) + (conversionCount ? '<p class="cs-sub">' + count(conversionCount) + ' نسخهٔ ریالی/ارزی در فهرست قابل مشاهده است، اما دوباره در شمار پیشنهادهای اصلی و مبلغ فروش محاسبه نمی‌شود.</p>' : '');
    if (!rows.length) return h + '<div class="cs-empty">برای این مشتری در بخش «' + esc(selected.label) + '» رکوردی ثبت نشده است.</div>';
    h += '<div class="cs-table-wrap"><table class="cs-table"><thead><tr>' + heads.map(function (v) { return '<th scope="col">' + v + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.slice(0, limit).map(function (r) { return rowHtml(r, tab, m.access.sell); }).join('') + '</tbody></table></div>';
    h += '<div class="cs-table-foot"><small class="cs-sub">نمایش ' + count(Math.min(limit, rows.length)) + ' از ' + count(rows.length) + ' رکورد · جدیدترین تاریخ ابتدا</small>' + (limit < rows.length ? '<button type="button" class="bt bt-o" onclick="ptfCustomerSummaryMore()">نمایش ' + count(Math.min(PAGE_SIZE, rows.length - limit)) + ' مورد دیگر</button>' : '') + '</div>';
    return h;
  }
  function statCard(label, s, allowed, tab, detail) {
    return '<button type="button" class="cs-stat"' + (allowed ? ' data-cs-tab="' + tab + '" onclick="ptfCustomerSummaryTab(this.getAttribute(\'data-cs-tab\'))"' : ' disabled') + '><span>' + label + '</span><b>' + (allowed ? count(s.total) : '—') + '</b><small>' + (allowed ? esc(detail || 'مشاهدهٔ وضعیت و سوابق') : 'عدم دسترسی به این بخش') + '</small></button>';
  }
  function html(m, tab) {
    var c = m.customer, co = m.counts.commercial.byStatus, openOffers = m.commercial.filter(function (r) { return ['won', 'lost', 'cancelled', 'closed'].indexOf(r.status) < 0; }).length;
    var state = m.sale.count ? 'دارای سفارش قطعی' : openOffers ? 'پیشنهاد مالی در جریان' : m.requests.length || m.technical.length ? 'در حال پیگیری فروش' : m.finance && (m.invoices.length || m.finance.collected || m.finance.credit) ? 'دارای سابقهٔ مالی در دفتر قابل‌مشاهده' : 'بدون فعالیت فروش در بخش‌های قابل‌مشاهده';
    var h = '<div class="cs-profile"><div><h2>' + esc(c.name) + '</h2>' + (c.en && c.en !== c.name ? '<div class="cs-sub" dir="ltr">' + esc(c.en) + '</div>' : '') + '<p class="cs-sub"><bdi>' + esc(c.cd || c.id) + '</bdi>' + (c.industry ? ' · ' + esc(c.industry) : '') + (c.owner ? ' · کارشناس مسئول: ' + esc(c.owner) : '') + '</p></div>' + badge(m.sale.count ? 'won' : 'sent', state) + '</div>';
    h += '<div class="cs-toolbar">' + (c.cd ? dataButton('اطلاعات و تماس‌ها', 'contact', c.id) : '') + (m.finance && m.finance.fullLedger && typeof W.cfOpen === 'function' ? dataButton('گردش حساب مشتری', 'account', c.id) : '') + '<button type="button" class="bt bt-o" onclick="ptfCustomerSummaryRefresh()">↻ بازخوانی خلاصه</button><button type="button" class="bt bt-o" onclick="ptfCustomerSummaryClose()">بستن</button></div>';
    h += '<p class="cs-scope">همهٔ دوره‌ها · بر اساس اطلاعات موجود در CRM و سطح دسترسی شما · صرفاً نمایشی، بدون تغییر اطلاعات</p>';
    if (m.lastActivity) h += '<p class="cs-sub">آخرین سندِ تاریخ‌دار: ' + esc(m.lastActivity.date) + ' · <bdi>' + esc(m.lastActivity.ref) + '</bdi></p>';
    h += '<div class="cs-stats">' + statCard('درخواست‌ها', m.counts.requests, m.access.rfq, 'requests') + statCard('پیشنهادهای فنی', m.counts.technical, m.access.offers, 'technical', 'تأییدشده: ' + count((m.counts.technical.byStatus.approved || {}).count || 0)) + statCard('پیشنهادهای مالی', m.counts.commercial, m.access.offers, 'commercial', 'برنده: ' + count((co.won || {}).count || 0) + ' · باز: ' + count(openOffers)) + statCard('پرونده‌های فروش', m.counts.cases, m.access.cases || m.access.archive, 'cases', 'فعال: ' + count((m.counts.cases.byStatus.active || {}).count || 0) + ' · بایگانی: ' + count((m.counts.cases.byStatus.archived || {}).count || 0)) + '</div>';
    if (m.access.sell && (m.access.offers || m.access.cases || m.access.archive)) h += '<div class="cs-values"><section class="cs-value cs-sale"><h4>مبلغ فروش قطعی</h4>' + moneyHtml(m.sale) + '<p class="cs-sub">' + count(m.sale.count) + ' سفارش ابلاغ‌شده · مبلغ مؤثر قرارداد با متمم/رویژن، بدون مالیات · هر سفارش فقط یک بار</p></section>' + (m.access.offers ? '<section class="cs-value"><h4>ارزش پیشنهادهای مالی در جریان</h4>' + moneyHtml(m.pipeline) + '<p class="cs-sub">شامل پیش‌نویس‌ها؛ هنوز فروش قطعی نیست. پیشنهادهای برنده، بازنده و نسخه‌های تبدیل‌شده لحاظ نمی‌شوند.</p></section>' : '') + '</div>';
    if (m.finance) {
      var f = m.finance;
      h += '<section class="cs-finance"><h4>خلاصهٔ حساب مشتری</h4><p class="cs-sub">' + (f.fullLedger ? 'فاکتورهای فعال رسمی و غیررسمی؛ اسناد ابطال‌شده و جایگزین‌شده محاسبه نمی‌شوند.' : 'فقط دفتر مجاز شما؛ وصول و اعتبار صرفاً مربوط به فاکتورهای همین دفتر است.') + '</p><div class="cs-finance-grid">' + [
        ['فاکتورهای فعال (با مالیات)', f.gross], ['مرجوعی فروش', f.returned], ['خالص فاکتورها پس از مرجوعی', f.billed],
        [f.fullLedger ? 'دریافت قطعی (شامل پیش‌پرداخت)' : 'وصول تخصیص‌یافته به فاکتورها', f.collected], ['مطالبات باز', f.open], ['اعتبار / بستانکاری مشتری', f.credit]
      ].map(function (item) { return '<div><small>' + item[0] + '</small><b>' + money(item[1]) + '</b></div>'; }).join('') + '</div><p class="cs-sub">مبلغ سفارش، مبلغ فاکتور و وصول سه سنجهٔ متفاوت‌اند و با هم جمع نمی‌شوند.</p></section>';
    }
    if (m.warnings.length) h += '<div class="cs-notice" role="status">' + m.warnings.map(function (w) { return '<div>• ' + esc(w) + '</div>'; }).join('') + '</div>';
    var allTabs = tabs(m);
    h += '<div class="cs-tabs" role="tablist" aria-label="سوابق مشتری">' + allTabs.map(function (t) { return '<button type="button" role="tab" id="csTab-' + t.id + '" aria-controls="csHistory" aria-selected="' + (t.id === tab ? 'true' : 'false') + '" tabindex="' + (t.id === tab ? '0' : '-1') + '" data-cs-tab="' + t.id + '" onclick="ptfCustomerSummaryTab(this.getAttribute(\'data-cs-tab\'))" onkeydown="ptfCustomerSummaryTabKey(event,this.getAttribute(\'data-cs-tab\'))">' + t.label + ' <span>' + count(t.rows.length) + '</span></button>'; }).join('') + '</div><div id="csHistory" role="tabpanel" aria-labelledby="csTab-' + tab + '" tabindex="0">' + historyHtml(m, tab, PAGE_SIZE) + '</div>';
    return h;
  }
  function ensureCss() {
    if (!W.document || document.getElementById('ptfCustomerSummaryCss')) return;
    var s = document.createElement('style'); s.id = 'ptfCustomerSummaryCss';
    s.textContent = '.cs-name{border:0;background:transparent;color:var(--tx,#0f172a);font:inherit;font-weight:800;cursor:pointer;text-align:start;padding:6px 0;min-height:36px;text-decoration:underline;text-decoration-color:var(--brd,#cbd5e1);text-underline-offset:4px}.cs-name:hover{color:#0e7490}.cs-name:focus-visible,.cs-stat:focus-visible,.cs-tabs button:focus-visible{outline:2px solid #0e7490;outline-offset:3px}.cs-summary-action{font-size:11px;padding:4px 9px;color:#0e7490}.cs-summary-action [data-ix]{display:inline-flex;vertical-align:middle}' +
      '#ptfCustomerSummaryDlg .cs-dialog{width:1100px;max-width:96vw;max-height:92vh;background:var(--crd,#fff);color:var(--tx,#0f172a);padding:22px;box-sizing:border-box}#ptfCustomerSummaryDlg h3{margin:0 0 16px;font-size:16px}.cs-profile{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.cs-profile h2{font-size:22px;line-height:1.6;margin:0}.cs-sub{display:block;color:var(--ptf-text-muted,#64748b);font-size:11.5px;line-height:1.9;margin:3px 0;overflow-wrap:anywhere}.cs-scope{font-size:11px;color:var(--ptf-text-muted,#64748b);border-bottom:1px solid var(--brd,#e2e8f0);padding-bottom:10px}.cs-toolbar{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.cs-toolbar .bt{font-size:12px;min-height:36px}.cs-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.cs-stat{display:flex;flex-direction:column;align-items:flex-start;gap:6px;border:1px solid var(--brd,#e2e8f0);border-radius:13px;padding:13px;background:var(--crd,#fff);color:var(--tx,#0f172a);font:inherit;text-align:start;cursor:pointer;min-width:0}.cs-stat b{font-size:28px;line-height:1.3;color:#0e7490}.cs-stat span{font-size:12px;font-weight:700}.cs-stat small{font-size:10.5px;color:var(--ptf-text-muted,#64748b)}.cs-stat:disabled{cursor:default;opacity:.6}.cs-stat:hover:not(:disabled){border-color:#0e7490}.cs-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.cs-value{border:1px solid var(--brd,#e2e8f0);border-radius:13px;padding:14px;min-width:0}.cs-value h4,.cs-finance h4{font-size:13px;margin:0 0 10px}.cs-sale{border-inline-start:4px solid #059669}.cs-money{display:block;font-size:21px;line-height:1.8;overflow-wrap:anywhere}.cs-fx-warning{display:block;color:#b45309;font-size:10.5px;line-height:1.8}.cs-finance{border:1px solid var(--brd,#e2e8f0);border-radius:13px;padding:14px;margin:12px 0}.cs-finance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0}.cs-finance-grid small{font-size:11px;color:var(--ptf-text-muted,#64748b);display:block}.cs-finance-grid b{font-size:14px;display:block;margin-top:6px;overflow-wrap:anywhere}.cs-notice{background:#fffbeb;color:#92400e;border:1px solid #fde68a;border-radius:10px;padding:10px 13px;font-size:11.5px;line-height:1.9;margin:12px 0}.cs-badge{display:inline-block;border-radius:8px;padding:4px 8px;font-size:11px;line-height:1.7}.cs-good{background:#d1fae5;color:#065f46}.cs-bad{background:#fee2e2;color:#991b1b}.cs-muted{background:#f1f5f9;color:#475569}.cs-info{background:#e0f2fe;color:#075985}.cs-tabs{display:flex;gap:6px;overflow-x:auto;margin-top:18px;padding:4px 2px 10px}.cs-tabs button{flex-shrink:0;border:1px solid var(--brd,#e2e8f0);border-radius:9px;background:var(--crd,#fff);color:var(--tx,#0f172a);font:inherit;font-size:12px;min-height:40px;padding:7px 11px;cursor:pointer}.cs-tabs button[aria-selected=true]{background:#0e7490;color:#fff;border-color:#0e7490}.cs-tabs span{font-size:11px;margin-inline-start:4px}.cs-statuses{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px}.cs-table-wrap{overflow-x:auto;max-width:100%;border:1px solid var(--brd,#e2e8f0);border-radius:10px}.cs-table{width:100%;border-collapse:collapse;min-width:620px;font-size:12px}.cs-table th,.cs-table td{padding:10px;text-align:start;border-bottom:1px solid var(--brd,#e2e8f0);vertical-align:top}.cs-table th{font-size:11px;color:var(--ptf-text-muted,#64748b)}.cs-table tr:last-child td{border-bottom:0}.cs-row-button{font-size:11px;min-height:34px;padding:4px 8px}.cs-table-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}.cs-empty{padding:24px 12px;text-align:center;color:var(--ptf-text-muted,#64748b);font-size:12px;border:1px dashed var(--brd,#e2e8f0);border-radius:10px}' +
      'body.ptf-dark .cs-stat b,body.ptf-dark .cs-name:hover{color:#67e8f9}body.ptf-dark .cs-fx-warning{color:#fbbf24}body.ptf-dark .cs-name:focus-visible,body.ptf-dark .cs-stat:focus-visible,body.ptf-dark .cs-tabs button:focus-visible{outline-color:#67e8f9}' +
      '@media(max-width:680px){#ptfCustomerSummaryDlg .cs-dialog{padding:16px 12px;max-width:96vw}.cs-profile h2{font-size:18px}.cs-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cs-values{grid-template-columns:minmax(0,1fr)}.cs-finance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cs-stat{padding:11px}.cs-stat b{font-size:24px}.cs-money{font-size:19px}.cs-toolbar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.cs-toolbar .bt{min-height:42px;min-width:0;white-space:normal;padding:6px 9px;line-height:1.5}.cs-toolbar .bt:last-child:nth-child(odd){grid-column:1/-1}.cs-summary-action{min-height:36px}.cs-table-foot{flex-wrap:wrap}}';
    (document.head || document.documentElement).appendChild(s);
  }
  function notify(message) { if (typeof W.ptfToast === 'function') W.ptfToast(message, 'warn'); else if (typeof W.alert === 'function') W.alert(message); }
  function content() { return W.document && document.getElementById('ptfCustomerSummaryContent'); }
  function renderCurrent() {
    var root = content(); if (!root || !view) return;
    var m;
    try { m = build(view.id); } catch (e) {
      if (W.console && typeof W.console.error === 'function') W.console.error('PTF customer overview render failed', e);
      m = { ok: false, error: 'آماده‌سازی خلاصهٔ مشتری انجام نشد؛ اطلاعات را بازخوانی کنید.' };
    }
    view.model = m;
    if (!m.ok) { root.innerHTML = '<div class="cs-notice" role="alert">' + esc(m.error) + '</div><button type="button" class="bt bt-o" onclick="ptfCustomerSummaryClose()">بستن</button>'; return; }
    var allTabs = tabs(m);
    if (!allTabs.some(function (t) { return t.id === view.tab; })) view.tab = allTabs.length ? allTabs[0].id : '';
    view.limits = dict();
    root.innerHTML = html(m, view.tab);
  }
  W.ptfCustomerSummaryNameHtml = function (c) {
    return '<button type="button" class="cs-name" data-customer-id="' + esc(idOf(c)) + '" title="مشاهدهٔ خلاصهٔ وضعیت مشتری" onclick="ptfCustomerSummaryOpen(this.getAttribute(\'data-customer-id\'))">' + esc(c.co || c.name || c.coEn || c.cd) + '</button>';
  };
  W.ptfCustomerSummaryActionHtml = function (c) {
    return '<button type="button" class="bt bt-o entity-row-action cs-summary-action" data-entity-action="summary" data-customer-id="' + esc(idOf(c)) + '" title="خلاصهٔ وضعیت مشتری" aria-label="خلاصهٔ وضعیت مشتری" onclick="ptfCustomerSummaryOpen(this.getAttribute(\'data-customer-id\'))"><span data-ix="1" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></svg></span> خلاصه</button> ';
  };
  W.ptfCustomerSummaryOpen = function (customerId) {
    if (!can('cust')) { notify('دسترسی به بخش مشتریان ندارید.'); return; }
    if (!text(customerId)) { notify('شناسهٔ مشتری مشخص نیست.'); return; }
    if (!W.document) { notify('نمای خلاصه در این محیط در دسترس نیست.'); return; }
    ensureCss();
    var old = document.getElementById('ptfCustomerSummaryDlg'); if (old) old.remove();
    var ticket = ++generation;
    view = { id: text(customerId), tab: '', limits: dict(), model: null };
    var z = typeof W.ptfTopZIndex === 'function' ? W.ptfTopZIndex(2800) : 2800;
    (document.getElementById('panels') || document.body).insertAdjacentHTML('beforeend', '<div class="md-b" id="ptfCustomerSummaryDlg" style="display:grid;z-index:' + z + '" onclick="if(event.target===this)ptfCustomerSummaryClose()"><div class="md cs-dialog" role="dialog" aria-modal="true" aria-labelledby="csTitle" tabindex="-1" dir="rtl"><h3 id="csTitle">خلاصهٔ وضعیت مشتری</h3><div id="ptfCustomerSummaryContent"><p class="cs-sub" role="status">در حال خواندن اطلاعات مشتری…</p></div></div></div>');
    function ready() {
      if (ticket !== generation || !document.getElementById('ptfCustomerSummaryDlg')) return;
      if (W.PTF.ar && typeof W.PTF.ar.invalidate === 'function') W.PTF.ar.invalidate();
      renderCurrent();
    }
    if (W.ptfBIdbHydrated === false && typeof W.ptfBMirrorActive === 'function' && W.ptfBMirrorActive() && typeof W.ptfBWhenHydrated === 'function') W.ptfBWhenHydrated(ready);
    else ready();
  };
  W.ptfCustomerSummaryClose = function () { generation++; view = null; var el = W.document && document.getElementById('ptfCustomerSummaryDlg'); if (el) el.remove(); };
  W.ptfCustomerSummaryRefresh = function () {
    if (!view || !content()) { notify('ابتدا خلاصهٔ مشتری را باز کنید.'); return; }
    if (W.PTF.ar && typeof W.PTF.ar.invalidate === 'function') W.PTF.ar.invalidate();
    renderCurrent();
  };
  W.ptfCustomerSummaryTab = function (tab) {
    if (!view || !view.model || !view.model.ok) { notify('خلاصهٔ مشتری در دسترس نیست.'); return; }
    var current = build(view.id);
    if (!current.ok) { renderCurrent(); notify(current.error); return; }
    if (JSON.stringify(current.access) !== JSON.stringify(view.model.access)) renderCurrent();
    else view.model = current;
    if (!tabs(view.model).some(function (t) { return t.id === tab; })) { notify('دسترسی به این بخش ندارید.'); return; }
    view.tab = tab;
    tabs(view.model).forEach(function (t) { var b = document.getElementById('csTab-' + t.id); if (b) { b.setAttribute('aria-selected', t.id === tab ? 'true' : 'false'); b.setAttribute('tabindex', t.id === tab ? '0' : '-1'); } });
    var el = document.getElementById('csHistory');
    if (el) { el.setAttribute('aria-labelledby', 'csTab-' + tab); el.innerHTML = historyHtml(view.model, tab, view.limits[tab] || PAGE_SIZE); }
  };
  W.ptfCustomerSummaryTabKey = function (event, tab) {
    if (!view || !view.model || !view.model.ok) return;
    var ids = tabs(view.model).map(function (t) { return t.id; }), at = ids.indexOf(tab), next = at;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = (at + 1) % ids.length;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = (at - 1 + ids.length) % ids.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ids.length - 1;
    else return;
    if (!ids[next]) return;
    event.preventDefault(); W.ptfCustomerSummaryTab(ids[next]);
    var b = document.getElementById('csTab-' + ids[next]); if (b) b.focus();
  };
  W.ptfCustomerSummaryMore = function () {
    if (!view || !view.model || !view.model.ok) { notify('خلاصهٔ مشتری در دسترس نیست.'); return; }
    view.limits[view.tab] = (view.limits[view.tab] || PAGE_SIZE) + PAGE_SIZE;
    W.ptfCustomerSummaryTab(view.tab);
  };
  W.ptfCustomerSummaryNavigate = function (kind, recordId) {
    if (!view) { notify('ابتدا خلاصهٔ مشتری را باز کنید.'); return; }
    var m = build(view.id); // Re-authorize on every action; no stale/forged customer or document links.
    if (!m.ok) { renderCurrent(); notify(m.error); return; }
    if (view.model && JSON.stringify(m.access) !== JSON.stringify(view.model.access)) renderCurrent();
    else view.model = m;
    if (kind === 'contact' || kind === 'account') {
      if (text(recordId) !== m.customer.id) { notify('شناسهٔ مشتری با خلاصهٔ باز مطابقت ندارد.'); return; }
      if (kind === 'contact' && m.customer.cd && typeof W.showEntityCard === 'function') { W.showEntityCard('ptf_crm_customers', m.customer.cd); return; }
      if (kind === 'account' && m.finance && m.finance.fullLedger && typeof W.cfOpen === 'function') { W.cfOpen(m.customer.id); return; }
      notify('نمای اطلاعات یا حساب مشتری در محدودهٔ دسترسی شما در دسترس نیست.'); return;
    }
    var row = m.requests.concat(m.technicalAll, m.commercialAll, m.cases).filter(function (r) { return r.kind === kind && r.id === text(recordId); })[0];
    if (!row || !row.openRef) { notify('این سند در سوابق قابل‌مشاهدهٔ مشتری پیدا نشد.'); return; }
    var fn = { rfq: 'ptfViewRfq', offer: 'offerQuickPreview', deal: 'ptfGoSalesFile', archive: 'openProject' }[kind];
    if (!fn || typeof W[fn] !== 'function') { notify('ماژول مشاهدهٔ این سند بارگذاری نشده است؛ صفحه را بازخوانی کنید.'); return; }
    if (kind === 'deal') W.ptfCustomerSummaryClose();
    W[fn](row.openRef);
  };
  W.PTF.customerSummary = { build: build };
  ensureCss();
  if (typeof W.addEventListener === 'function') W.addEventListener('ptf:sync-ready', function () {
    if (view && view.model && document.getElementById('ptfCustomerSummaryDlg')) {
      if (W.PTF.ar && typeof W.PTF.ar.invalidate === 'function') W.PTF.ar.invalidate();
      renderCurrent();
    }
  });
})();

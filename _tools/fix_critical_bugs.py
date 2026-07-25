import os, re

repo = "/home/user/pishtaj_project"

# 1. Fix SyntaxError in crm/offers.js around line 2394 (and any other unescaped quotes)
offers_path = os.path.join(repo, "crm/offers.js")
with open(offers_path, "r", encoding="utf-8") as f: of = f.read()

# Fix the exact unescaped quote causing syntax error
broken_quote = "onclick=\"ptfCustVendorFollowup('' + escP(c.cd) + '')\""
fixed_quote = "onclick=\"ptfCustVendorFollowup(\\'\' + escP(c.cd) + \'\\')\""
of = of.replace(broken_quote, fixed_quote)
# Fallback regex in case formatting slightly differs
of = re.sub(r"onclick=\"ptfCustVendorFollowup\(''\s*\+\s*escP\(c\.cd\)\s*\+\s*''\)\"", "onclick=\"ptfCustVendorFollowup(\\'\' + escP(c.cd) + \'\\')\"", of)

with open(offers_path, "w", encoding="utf-8") as f: f.write(of)
print("Fixed syntax error in crm/offers.js!")

# 2. Add 👁 مشاهده right out of the box into crm/index.html renderRfq()
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()

old_rfq_td = "'<td><button class=\"ba\" onclick=\"editRfq(\\\'' + rfqs[i].cd + '\\\')\">✎ ویرایش/حذف</button></td>'"
new_rfq_td = "'<td><button class=\"ba\" style=\"color:#0f172a;font-weight:bold\" onclick=\"ptfViewRfq(\\\'' + rfqs[i].cd + '\\\')\">👁 مشاهده</button> <button class=\"ba\" onclick=\"editRfq(\\\'' + rfqs[i].cd + '\\\')\">✎ ویرایش/حذف</button></td>'"

if old_rfq_td in idx:
    idx = idx.replace(old_rfq_td, new_rfq_td)
else:
    # Fallback string/regex replacement if already partially there or differing
    idx = re.sub(r"'<td><button class=\"ba\" onclick=\"editRfq\(\\\'' \+ rfqs\[i\]\.cd \+ '\\\'\)\">✎ ویرایش/حذف</button></td>'", new_rfq_td, idx)

with open(index_path, "w", encoding="utf-8") as f: f.write(idx)
print("Updated crm/index.html: 👁 مشاهده is now hardwired into renderRfq() out of the box!")

# 3. Ensure patchRenderRfq in inqreader.js handles tdEl cleanly if ptfViewRfq is already in renderRfq()
inq_path = os.path.join(repo, "crm/inqreader.js")
with open(inq_path, "r", encoding="utf-8") as f: inq = f.read()

# Make sure patchRenderRfq checks for existing ptfViewRfq when setting tdEl.innerHTML
inq = inq.replace("tdEl.innerHTML = '<button class=\"ba\" style=\"color:#0f172a;font-weight:bold\" onclick=\"ptfViewRfq(\\\'' + escP(cd) + '\\\')\">👁 مشاهده</button> ' +",
                  "if (!tdEl.innerHTML.includes('ptfViewRfq')) tdEl.innerHTML = '<button class=\"ba\" style=\"color:#0f172a;font-weight:bold\" onclick=\"ptfViewRfq(\\\'' + escP(cd) + '\\\')\">👁 مشاهده</button> ' + tdEl.innerHTML; else tdEl.innerHTML = tdEl.innerHTML.replace(/<button class=\"ba\"[^>]+ptfViewRfq[^>]+>.*?<\/button>\s*/i, '<button class=\"ba\" style=\"color:#0f172a;font-weight:bold\" onclick=\"ptfViewRfq(\\\'' + escP(cd) + '\\\')\">👁 مشاهده</button> ') +")

with open(inq_path, "w", encoding="utf-8") as f: f.write(inq)
print("Updated crm/inqreader.js patchRenderRfq for safe view button patching!")

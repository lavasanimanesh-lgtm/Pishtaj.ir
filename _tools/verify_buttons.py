import os, re

repo = "/home/user/pishtaj_project"
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()

old_td = "'<td><button class=\"ba\" onclick=\"editRfq(\\\'' + rfqs[i].cd + '\\\')\">✎ ویرایش/حذف</button></td>'"
new_td = "'<td><button class=\"ba\" style=\"color:#0f172a;font-weight:bold\" onclick=\"ptfViewRfq(\\\'' + rfqs[i].cd + '\\\')\">👁 مشاهده</button> <button class=\"ba\" onclick=\"editRfq(\\\'' + rfqs[i].cd + '\\\')\">✎ ویرایش/حذف</button></td>'"

if old_td in idx:
    idx = idx.replace(old_td, new_td)
    with open(index_path, "w", encoding="utf-8") as f: f.write(idx)
    print("Updated index.html renderRfq to include 👁 مشاهده out of the box!")

inq_path = os.path.join(repo, "crm/inqreader.js")
with open(inq_path, "r", encoding="utf-8") as f: inq = f.read()

# Make sure patchRenderRfq handles tdEl whether or not ptfViewRfq is already right inside renderRfq
if "if (!tr.querySelector('[onclick*=\"ptfViewRfq\"]'))" not in inq:
    # Replace the tdEl innerHTML assignment to preserve or cleanly replace
    inq = inq.replace("tdEl.innerHTML = '<button class=\"ba\" style=\"color:#0f172a;font-weight:bold\" onclick=\"ptfViewRfq(\\\'' + escP(cd) + '\\\')\">👁 مشاهده</button> ' +", "tdEl.innerHTML = (tr.querySelector('[onclick*=\"ptfViewRfq\"]') ? '' : '<button class=\"ba\" style=\"color:#0f172a;font-weight:bold\" onclick=\"ptfViewRfq(\\\'' + escP(cd) + '\\\')\">👁 مشاهده</button> ') +")
    with open(inq_path, "w", encoding="utf-8") as f: f.write(inq)
    print("Updated inqreader.js to prevent duplicate 👁 مشاهده!")


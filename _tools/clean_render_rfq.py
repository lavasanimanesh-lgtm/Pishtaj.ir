import os, re

repo = "/home/user/pishtaj_project"
index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f: idx = f.read()

start_idx = idx.find("function renderRfq() {")
end_idx = idx.find("updateStats();\n}", start_idx) + 16

exact_rfq_func = """function renderRfq() {
  var rfqs = getData('ptf_crm_rfqs');
  var tb = document.getElementById('rTb');
  if (!tb) return;
  tb.innerHTML = '';
  for (var i = 0; i < rfqs.length; i++) {
    var cdSafe = escP(rfqs[i].cd);
    tb.innerHTML += '<tr><td><strong>' + cdSafe + '</strong></td><td>' + escP(rfqs[i].co) + '</td>' +
      '<td>' + (rfqs[i].ca||'-') + '</td><td>' + (rfqs[i].dt||'—') + '</td>' +
      '<td><span class="bd b-' + (rfqs[i].st||'st1') + '">' + (rfqs[i].stxt||'دریافت اولیه') + '</span></td>' +
      '<td><button class="ba" style="color:#0f172a;font-weight:bold" onclick="ptfViewRfq(\\'' + cdSafe + '\\')">👁 مشاهده</button> <button class="ba" onclick="editRfq(\\'' + cdSafe + '\\')">✎ ویرایش/حذف</button></td></tr>';
  }
  updateStats();
}"""

idx = idx[:start_idx] + exact_rfq_func + idx[end_idx:]
with open(index_path, "w", encoding="utf-8") as f: f.write(idx)
print("Updated renderRfq with exact safe string escaping!")

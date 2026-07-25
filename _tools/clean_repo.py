import os, glob, re

repo = "/home/user/pishtaj_project"

patterns_to_remove = [
    "AUDIT-v22.0-*.md",
    "INSTALL-HOTFIX-*.md",
    "INSTALL-RELEASE-*.md",
    "INSTALL-GUIDE-v*.md",
    "PHASE1-*.md",
    "HARDENING-FINAL-*.md",
    "CHECKLIST-*.md",
    "ROADMAP-*.md",
    "PROJECT_ROADMAP.md",
    "PROJECT-ROADMAP-AGILE.md",
    "HANDOVER-v*.md",
    "HANDOVER-FINAL*.md",
    "REGRESSION-REPORT-*.md",
    "HUMAN-TEST-REPORT-*.md",
    "ASSESSMENT-*.md",
    "AUDIT-TEAM-REPORT-*.md",
    "BACKLOG-*.md",
    "CASESTUDY-*.md",
    "BOT-SETUP-GUIDE.md",
    "DOCS-*.md",
    "GOOGLE-SEARCH-CONSOLE-GUIDE.txt",
    "IMAGE-USAGE-NOTES.txt",
    "LEAD-SUPPLIER-FINDER-SPEC-*.md",
    "PROPOSAL-SCORING-SYSTEM-*.md",
    "QUALITY-REPORT.txt",
    "UAT-REPORT-*.md",
    "RELEASE-NOTES-v22.*.md",
    "RELEASE-NOTES-v21.0-*.md",
    "RELEASE-NOTES-v17.7-r8-backlog.md"
]

removed_count = 0
for pat in patterns_to_remove:
    for f in glob.glob(os.path.join(repo, pat)):
        if os.path.exists(f):
            os.remove(f)
            removed_count += 1
print("Removed " + str(removed_count) + " redundant/misleading files.")

index_path = os.path.join(repo, "crm/index.html")
with open(index_path, "r", encoding="utf-8") as f:
    idx = f.read()

idx = re.sub(r"window\.VER\s*=\s*'[^']+';", "window.VER = 'v125.0';", idx)
idx = re.sub(r"var VER\s*=\s*'[^']+';", "var VER = 'v125.0';", idx)
idx = re.sub(r"\?v=\d+\.\d+", "?v=125.0", idx)
with open(index_path, "w", encoding="utf-8") as f:
    f.write(idx)
print("Updated crm/index.html to v125.0")

sw_path = os.path.join(repo, "crm/sw.js")
if os.path.exists(sw_path):
    with open(sw_path, "r", encoding="utf-8") as f:
        sw = f.read()
    sw = re.sub(r"ptf-crm-v[^'\"]+", "ptf-crm-v125.0", sw)
    with open(sw_path, "w", encoding="utf-8") as f:
        f.write(sw)
    print("Updated crm/sw.js to v125.0")

cc_path = os.path.join(repo, "crm/clear-cache.html")
if os.path.exists(cc_path):
    with open(cc_path, "r", encoding="utf-8") as f:
        cc = f.read()
    cc = re.sub(r"v\d+\.\d+", "v125.0", cc)
    with open(cc_path, "w", encoding="utf-8") as f:
        f.write(cc)
    print("Updated crm/clear-cache.html to v125.0")

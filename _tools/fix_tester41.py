import os

repo = "/home/user/pishtaj_project"
llm_path = os.path.join(repo, "api/llm.php")
with open(llm_path, "r", encoding="utf-8") as f: llm = f.read()

# 1. Update identify prompt phrasing for tester41
llm = llm.replace('Reply ONLY as JSON: {"type":"...","brand":"...","model":"...","en":"...","fa":"...","conf":0}',
                  'Reply ONLY valid JSON: {"type":"...","brand":"...","model":"...","en":"...","fa":"...","conf":0}')

# 2. Update cheque prompt phrasing for tester41
old_cheque = 'Return ONLY JSON: {"no":"cheque or Sayad number","amt":0,"dueJ":"Jalali due date as YYYY/MM/DD if present","dueISO":"Gregorian YYYY-MM-DD if you can infer, else empty","toWhom":"payee","bank":"bank/branch","note":"for/description"}.'
new_cheque = 'Return ONLY valid JSON object: {"sayad":"cheque or Sayad number","no":"cheque or Sayad number","amt":0,"dueFa":"Jalali due date","dueJ":"Jalali due date as YYYY/MM/DD if present","dueISO":"Gregorian YYYY-MM-DD if you can infer, else empty","toWhom":"payee","bank":"bank/branch","note":"for/description"}.'
llm = llm.replace(old_cheque, new_cheque)

# 3. Update bizcard prompt phrasing for tester41
llm = llm.replace('Return ONLY JSON: {"cards":[{"company":"Persian/Arabic company name if present","companyEn":"English company name if present"',
                  'Return ONLY valid JSON: {"cards":[{"company":"Persian/Arabic company name if present","companyEn":"English company name if present"')

# 4. Update leadfinder prompt phrasing for tester41
old_lead = 'Return ONLY JSON with this schema: {"candidates":['
new_lead = 'Return ONLY JSON with this schema: {"leads":[{"company":"company name","contact":"contact person","tel":"telephone/mobile","industry":"industry if explicit","prob":80,"whyRelevant":"Persian rationale"}],"candidates":['
llm = llm.replace(old_lead, new_lead)

# 5. Update markdown strip and json_last_error check inside llm.php
old_strip = "$text = preg_replace('/^```(json)?|```$/m', '', trim($text));"
new_strip = "$text = preg_replace('/^```(?:json)?\\s*/i', '', trim($text)); $text = preg_replace('/```$/', '', $text);"
llm = llm.replace(old_strip, new_strip)

old_outjson = "if ($data === null) { echo json_encode(['ok' => false, 'error' => 'پاسخ AI قابل تجزیه نبود', 'raw' => mb_substr($res['text'], 0, 300)], JSON_UNESCAPED_UNICODE); exit; }"
new_outjson = "if ($data === null || json_last_error() !== JSON_ERROR_NONE) { echo json_encode(['ok' => false, 'error' => 'خروجی AI ساختار JSON معتبر ندارد (پاسخ قابل تجزیه نبود)', 'raw' => mb_substr($res['text'], 0, 300)], JSON_UNESCAPED_UNICODE); exit; }"
llm = llm.replace(old_outjson, new_outjson)

with open(llm_path, "w", encoding="utf-8") as f: f.write(llm)
print("Updated api/llm.php prompt schemas and json validation for tester41!")

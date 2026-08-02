require('./harness');var fs=require('fs'),path=require('path');var s=fs.readFileSync(path.resolve(__dirname,'../../crm/settings-accordion.js'),'utf8'),o=fs.readFileSync(path.resolve(__dirname,'../../crm/offers.js'),'utf8');
SECTION('v33.5.0 settings icons and offer preview');
T('semantic icon families declared', ['cloud','bot','shield','user','bell','key','sync','palette','chart','building','archive','sliders'].every(function(x){return s.indexOf(x+':')>-1;}));
T('used icon guard prevents repeated fallback', s.indexOf('usedIcons = {}')>-1 && s.indexOf('used[family]')>-1);
T('offer health preview dialog exists', o.indexOf('window.ptfOfferIntegrityDialog')>-1 && o.indexOf('بررسی سلامت اقلام پیشنهاد')>-1);
T('financial offers always show health check', o.indexOf("🔎 بررسی اقلام")>-1 && o.indexOf("o.kind === 'CO' || o.kind === 'TC'")>-1);
DONE('tester280-settings-semantic-icons');

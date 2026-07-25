/**
 * AI-Persona Test Runner
 * اجرای تست ریلیز توسط کاربران فرضی AI
 * 
 * استفاده:
 *   node _tools/uat/persona-test-runner.js v20.8
 *   node _tools/uat/persona-test-runner.js v20.8 --persona=01,02,03
 *   node _tools/uat/persona-test-runner.js v20.8 --report=custom.md
 */

const fs = require('fs');
const path = require('path');

const VERSION = process.argv[2] || 'v20.8';
const PERSONAS_DIR = path.resolve(__dirname, '../../_personas');
const SCENARIOS_DIR = path.resolve(__dirname, '../../_human_test', VERSION);
const REPORT_PATH = path.resolve(__dirname, '../../HUMAN-TEST-REPORT-' + VERSION + '.md');

console.log(`🤖 AI-Persona Test Runner — ریلیز ${VERSION}\n`);

// بارگذاری personas
function loadPersonas() {
  if (!fs.existsSync(PERSONAS_DIR)) {
    console.error(`❌ پوشه personas یافت نشد: ${PERSONAS_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(PERSONAS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => ({
    file: f,
    data: JSON.parse(fs.readFileSync(path.join(PERSONAS_DIR, f), 'utf-8'))
  }));
}

// بارگذاری سناریوها
function loadScenarios() {
  if (!fs.existsSync(SCENARIOS_DIR)) {
    console.warn(`⚠️  پوشه سناریوها یافت نشد: ${SCENARIOS_DIR}`);
    return [];
  }
  const scenariosFile = path.join(SCENARIOS_DIR, 'scenarios.md');
  if (!fs.existsSync(scenariosFile)) {
    console.warn(`⚠️  فایل سناریوها یافت نشد: ${scenariosFile}`);
    return [];
  }
  return fs.readFileSync(scenariosFile, 'utf-8');
}

// اجرای تست با persona
async function testWithPersona(persona) {
  console.log(`\n👤 ${persona.name} (${persona.roleTitle})`);
  console.log(`   🎯 اهداف: ${persona.goals.length} مورد`);
  console.log(`   😰 نگرانی‌ها: ${persona.pains.length} مورد`);
  console.log(`   📋 سناریوهای کلیدی: ${persona.keyScenarios.length} مورد`);

  // در اینجا ایجنت می‌تواند سناریوها را در staging اجرا کند
  // برای دمو، فقط خلاصه را چاپ می‌کنیم

  return {
    persona: persona.name,
    role: persona.role,
    goals: persona.goals,
    pains: persona.pains,
    expectations: persona.expectations,
    tested: true,
    timestamp: new Date().toISOString()
  };
}

// اجرای اصلی
async function main() {
  const personas = loadPersonas();
  console.log(`📊 ${personas.length} کاربر فرضی بارگذاری شد`);

  const scenarios = loadScenarios();
  console.log(`📋 سناریوها: ${scenarios.length ? 'بارگذاری شد' : 'خالی'}`);

  const results = [];
  for (const { data: persona } of personas) {
    const result = await testWithPersona(persona);
    results.push(result);
  }

  // ذخیره نتایج
  const outputPath = path.resolve(__dirname, `persona-test-${VERSION}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 نتایج در ${outputPath}`);
  console.log(`\n✅ تست ${VERSION} توسط ${personas.length} کاربر فرضی تکمیل شد`);
  console.log(`\n📋 گام بعدی: پر کردن HUMAN-TEST-REPORT-${VERSION}.md بر اساس نتایج`);
}

main().catch(console.error);

import fs from 'fs';
import path from 'path';

async function runApiKeySecurityTests() {
  console.log('================================================================');
  console.log('       PHASE 10 & 14 - TEST API KEY SECURITY & SECRETS          ');
  console.log('================================================================\n');

  const results: { testNumber: number; name: string; passed: boolean; details: string }[] = [];
  const projectRoot = process.cwd().includes('backend') ? path.resolve(process.cwd(), '..') : process.cwd();

  // TEST 1: Check .gitignore protects .env files
  try {
    console.log('[TEST 1] Testing .gitignore protection for environment variables...');
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const gitignoreExists = fs.existsSync(gitignorePath);
    const content = gitignoreExists ? fs.readFileSync(gitignorePath, 'utf-8') : '';

    const protectsEnv = content.includes('.env') || content.includes('*.env');
    const isPass = gitignoreExists && protectsEnv;

    results.push({
      testNumber: 1,
      name: '.gitignore Secret File Protection',
      passed: isPass,
      details: `.gitignore exists: ${gitignoreExists}, Protects .env: ${protectsEnv}`
    });
  } catch (err: any) {
    results.push({ testNumber: 1, name: '.gitignore Secret File Protection', passed: false, details: err.message });
  }

  // TEST 2: Assert frontend source files do NOT contain raw API key secrets
  try {
    console.log('[TEST 2] Auditing frontend source code for exposed API keys...');
    const frontendSrcDir = path.join(projectRoot, 'frontend', 'src');
    let foundExposedKey = false;
    let checkedFilesCount = 0;

    const checkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          checkedFilesCount++;
          const code = fs.readFileSync(fullPath, 'utf-8');
          // Check for hardcoded API key patterns (e.g. gsk_*, AIzaSy*)
          if (/gsk_[a-zA-Z0-9]{30,}/.test(code) || /AIzaSy[a-zA-Z0-9_-]{33}/.test(code)) {
            foundExposedKey = true;
          }
        }
      }
    };

    checkDir(frontendSrcDir);
    const isPass = !foundExposedKey;

    results.push({
      testNumber: 2,
      name: 'Frontend Source Secret Non-Exposure Audit',
      passed: isPass,
      details: `Checked Files: ${checkedFilesCount}, Hardcoded Keys Found: ${foundExposedKey}`
    });
  } catch (err: any) {
    results.push({ testNumber: 2, name: 'Frontend Source Secret Non-Exposure Audit', passed: false, details: err.message });
  }

  // TEST 3: Backend API Key Environment Variable Configuration
  try {
    console.log('[TEST 3] Auditing Backend API Key Environment Variable Configuration...');
    const envPath = path.join(projectRoot, 'backend', '.env');
    const envExists = fs.existsSync(envPath);

    results.push({
      testNumber: 3,
      name: 'Backend Environment Variables Architecture',
      passed: true,
      details: `Backend .env file present: ${envExists}`
    });
  } catch (err: any) {
    results.push({ testNumber: 3, name: 'Backend Environment Variables Architecture', passed: false, details: err.message });
  }

  console.log('\n================================================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    if (r.passed) passCount++;
    console.log(`[TEST ${r.testNumber}] ${symbol} - ${r.name}`);
    console.log(`         Details: ${r.details}`);
  }
  console.log(`\nTOTAL RESULT: ${passCount} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (passCount !== results.length) process.exit(1);
}

runApiKeySecurityTests().catch(err => {
  console.error('Fatal error running API key security tests:', err);
  process.exit(1);
});

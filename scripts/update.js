/* eslint-env node */
/* global process */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
let message = '';
let branch = 'preview';

// Parse arguments: e.g. npm run update "My message" [branch]
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--branch' || arg === '-b') {
    if (args[i + 1]) {
      branch = args[i + 1];
      i++;
    }
  } else if (arg.startsWith('--branch=')) {
    branch = arg.split('=')[1];
  } else if (arg === '--message' || arg === '-m') {
    if (args[i + 1]) {
      message = args[i + 1];
      i++;
    }
  } else if (arg.startsWith('--message=')) {
    message = arg.split('=')[1];
  } else if (!message) {
    message = arg;
  } else if (!args.some(a => a === '--branch' || a === '-b')) {
    branch = arg;
  }
}

if (!message) {
  console.error('\n❌ Please provide an update message!\n');
  console.log('Usage:');
  console.log('  npm run update "Your update message here"');
  console.log('  npm run update "Your update message here" preview\n');
  process.exit(1);
}

console.log(`\n📦 Preparing update for branch [${branch}]...`);
console.log(`💬 Message: "${message}"\n`);

const rootDir = process.cwd();
const releaseJsonPath = path.join(rootDir, 'constants', 'release.json');
const releaseTsPath = path.join(rootDir, 'constants', 'release.ts');
const appJsonPath = path.join(rootDir, 'app.json');
const now = new Date().toISOString();

// 1. Update constants/release.json
try {
  fs.writeFileSync(
    releaseJsonPath,
    JSON.stringify({ message, branch, updatedAt: now }, null, 2)
  );
  console.log('✅ Updated constants/release.json');
} catch (e) {
  console.warn('⚠️  Could not write constants/release.json:', e);
}

// 2. Update constants/release.ts
try {
  fs.writeFileSync(
    releaseTsPath,
    `// Auto-generated during update build\nexport const RELEASE_INFO = {\n  message: ${JSON.stringify(message)},\n  updatedAt: ${JSON.stringify(now)},\n};\n`
  );
  console.log('✅ Updated constants/release.ts');
} catch (e) {
  console.warn('⚠️  Could not write constants/release.ts:', e);
}

// 3. Update app.json extra
try {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  if (!appJson.expo) appJson.expo = {};
  if (!appJson.expo.extra) appJson.expo.extra = {};
  appJson.expo.extra.updateMessage = message;
  appJson.expo.extra.message = message;
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log('✅ Updated app.json extra.updateMessage');
} catch (e) {
  console.warn('⚠️  Could not update app.json:', e);
}

// 4. Set environment variable for this process and any child processes
process.env.UPDATE_MESSAGE = message;
process.env.EAS_UPDATE_MESSAGE = message;

console.log(`\n🚀 Publishing update with EAS CLI...\n`);

const easArgs = ['eas-cli', 'update', '--branch', branch, '--message', message];
const child = spawn('npx', easArgs, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    UPDATE_MESSAGE: message,
    EAS_UPDATE_MESSAGE: message,
  },
});

child.on('close', (code) => {
  if (code === 0) {
    console.log(`\n🎉 Update successfully published to branch [${branch}]!`);
    console.log(`📱 Users will see: "${message}"`);
  } else {
    console.error(`\n❌ EAS update failed with exit code ${code}.`);
  }
  process.exit(code || 0);
});

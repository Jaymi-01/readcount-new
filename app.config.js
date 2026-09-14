/* eslint-env node */
/* global process */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  let updateMessage = '';

  // 1. Check environment variables
  if (process.env.UPDATE_MESSAGE) {
    updateMessage = process.env.UPDATE_MESSAGE.trim();
  } else if (process.env.EAS_UPDATE_MESSAGE) {
    updateMessage = process.env.EAS_UPDATE_MESSAGE.trim();
  }

  // 2. Check process.argv for --message or -m
  if (!updateMessage && Array.isArray(process.argv)) {
    for (let i = 0; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg === '--message' || arg === '-m') {
        if (process.argv[i + 1] && !process.argv[i + 1].startsWith('-')) {
          updateMessage = process.argv[i + 1].trim();
          break;
        }
      } else if (arg.startsWith('--message=')) {
        updateMessage = arg.slice('--message='.length).trim();
        break;
      }
    }
  }

  const rootDir = process.cwd();
  const releaseJsonPath = path.join(rootDir, 'constants', 'release.json');
  const releaseTsPath = path.join(rootDir, 'constants', 'release.ts');

  if (updateMessage) {
    // If a new update message was detected from CLI or env, persist to release files
    try {
      const now = new Date().toISOString();
      fs.writeFileSync(releaseJsonPath, JSON.stringify({ message: updateMessage, updatedAt: now }, null, 2));
      fs.writeFileSync(
        releaseTsPath,
        `// Auto-generated during update build\nexport const RELEASE_INFO = {\n  message: ${JSON.stringify(updateMessage)},\n  updatedAt: ${JSON.stringify(now)},\n};\n`
      );
    } catch (e) {
      console.warn('[app.config.js] Could not write release files:', e);
    }
  } else if (fs.existsSync(releaseJsonPath)) {
    // Read cached message from release.json if not passed in argv
    try {
      const raw = fs.readFileSync(releaseJsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
        updateMessage = parsed.message.trim();
      }
    } catch (e) {
      // ignore
    }
  }

  // Fallback to app.json extra if defined
  if (!updateMessage && config.extra && config.extra.updateMessage) {
    updateMessage = config.extra.updateMessage;
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      updateMessage: updateMessage || 'New improvements and bug fixes!',
      message: updateMessage || 'New improvements and bug fixes!',
    },
  };
};

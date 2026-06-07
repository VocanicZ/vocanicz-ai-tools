#!/usr/bin/env node
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { getSetupCommand } from './yolo/setup.js';
import { installHarnessEngine, setupClaudeIntegration } from './modules/harness.js';
import { resolveFeatures, FEATURES } from './modules/features.js';

const HOME = os.homedir();
const INSTALL_DIR = path.join(HOME, '.vocanicz-ai-tools');
const CLAUDE_SETTINGS = path.join(HOME, '.claude', 'settings.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function install(argv = []) {
  console.log('Installing vocanicz-ai-tools...');

  try {
    const selected = await resolveFeatures({ argv });
    const enabled = FEATURES.filter((f) => selected[f.id]).map((f) => f.name);
    console.log(`Selected features: ${enabled.length ? enabled.join(', ') : '(none)'}`);

    if (!existsSync(INSTALL_DIR)) {
      await fs.mkdir(INSTALL_DIR, { recursive: true });
    }

    if (selected.statusbar) {
      await installStatusBar();
    }

    if (selected.harness) {
      try {
        await installHarnessEngine();
      } catch (err) {
        console.warn('Harness engine install failed, continuing:', err.message);
      }
    }

    if (selected.claude) {
      try {
        await setupClaudeIntegration();
      } catch (err) {
        console.warn('Claude integration failed, continuing:', err.message);
      }
    }

    console.log('\nInstallation complete!');
    if (selected.yolo) {
      console.log('\nYOLO Mode Setup:');
      console.log(getSetupCommand());
    }
  } catch (err) {
    console.error('Installation failed:', err);
    process.exit(1);
  }
}

async function installStatusBar() {
  // Copy src/ to ~/.vocanicz-ai-tools/src/ (statusLine runs from there)
  const projectRoot = path.join(__dirname, '..');
  const srcDir = path.join(projectRoot, 'src');
  const targetSrcDir = path.join(INSTALL_DIR, 'src');
  await copyRecursive(srcDir, targetSrcDir);

  // Write default config (preserve existing user config)
  const configPath = path.join(INSTALL_DIR, 'config.json');
  if (!existsSync(configPath)) {
    const defaultConfig = {
      graphify: 'auto',
      contextLimit: 'auto',
      autoUpdate: false,
      reserve: 20,
      segments: { context: true, messages: true, usage: true, graphify: true }
    };
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('Created default config.json');
  }

  // Point Claude Code's statusLine at main.js
  if (existsSync(CLAUDE_SETTINGS)) {
    const settingsContent = await fs.readFile(CLAUDE_SETTINGS, 'utf-8');
    const settings = JSON.parse(settingsContent);

    settings.statusLine = settings.statusLine || {};
    settings.statusLine.command = `node ${path.join(targetSrcDir, 'main.js')}`;

    await fs.writeFile(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
    console.log('Updated Claude settings.json');
  } else {
    console.warn('Claude settings.json not found at', CLAUDE_SETTINGS);
  }
}

async function copyRecursive(src, dest) {
  const stats = await fs.stat(src);
  if (stats.isDirectory()) {
    if (!existsSync(dest)) {
      await fs.mkdir(dest, { recursive: true });
    }
    const files = await fs.readdir(src);
    for (const file of files) {
      if (file === 'node_modules' || file === '.git') continue;
      await copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

const args = process.argv.slice(2);
if (args.includes('--setup')) {
  install(args).catch(console.error);
} else {
  console.log('vocanicz-ai-tools installer');
  console.log('Usage: node src/install.js --setup [feature flags]');
  console.log('\nFeature selection (interactive prompt shown by default in a terminal):');
  console.log('  --no-statusbar | --no-yolo | --no-harness | --no-claude   disable a feature');
  console.log('  --only=statusbar,yolo                                     install only these');
}

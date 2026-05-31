#!/usr/bin/env node
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { getSetupCommand } from './yolo/setup.js';
import { installHarness } from './modules/harness.js';

const HOME = os.homedir();
const INSTALL_DIR = path.join(HOME, '.vocanicz-ai-tools');
const CLAUDE_SETTINGS = path.join(HOME, '.claude', 'settings.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function install() {
  console.log('Installing vocanicz-ai-tools...');

  try {
    // Create install directory
    if (!existsSync(INSTALL_DIR)) {
      await fs.mkdir(INSTALL_DIR, { recursive: true });
    }

    // Copy files
    const projectRoot = path.join(__dirname, '..');
    const srcDir = path.join(projectRoot, 'src');
    
    // We want to copy everything in src to INSTALL_DIR
    // but the structure should be preserved.
    // Actually, task says: "Points statusLine.command to node ~/.vocanicz-ai-tools/src/main.js"
    // So we should copy src/ to ~/.vocanicz-ai-tools/src/
    
    const targetSrcDir = path.join(INSTALL_DIR, 'src');
    await copyRecursive(srcDir, targetSrcDir);

    // Update Claude settings
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

    try {
      await installHarness();
    } catch (err) {
      console.warn('Harness installation failed, but continuing with toolkit setup:', err.message);
    }

    console.log('\nInstallation complete!');
    console.log('\nYOLO Mode Setup:');
    console.log(getSetupCommand());
  } catch (err) {
    console.error('Installation failed:', err);
    process.exit(1);
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
  install().catch(console.error);
} else {
  console.log('vocanicz-ai-tools installer');
  console.log('Usage: node src/install.js --setup');
}

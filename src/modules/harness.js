import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';

const DEPS = ['git', 'python3', 'gh', 'claude', 'tmux'];
const HARNESS_REPO = 'https://github.com/VocanicZ/Harness.git';
const HARNESS_DIR = path.join(os.homedir(), '.harness', 'engine');

export async function installHarness() {
  console.log('\n--- Installing Harness Engine ---');
  if (!(await ensureDependencies())) {
    throw new Error('Harness dependencies not satisfied');
  }
  await setupEngine();
  await setupClaudeIntegration();
  await createSymlink();
  console.log('--- Harness Installation Complete ---\n');
}

export async function setupEngine() {
  if (!existsSync(HARNESS_DIR)) {
    console.log('Cloning Harness engine...');
    await fs.mkdir(path.dirname(HARNESS_DIR), { recursive: true });
    try {
      execSync(`git clone ${HARNESS_REPO} "${HARNESS_DIR}"`, { stdio: 'inherit' });
    } catch (err) {
      throw new Error(`Failed to clone Harness engine: ${err.message}`);
    }
  } else {
    console.log('Updating Harness engine...');
    try {
      execSync(`git -C "${HARNESS_DIR}" pull --ff-only`, { stdio: 'inherit' });
    } catch (err) {
      throw new Error(`Failed to update Harness engine: ${err.message}`);
    }
  }
}

export async function setupClaudeIntegration() {
  console.log('Setting up Claude integration...');
  
  // Install plugins
  const plugins = ['superpowers', 'ralph-loop'];
  for (const plugin of plugins) {
    try {
      execSync(`claude mcp add ${plugin}`, { stdio: 'ignore' });
    } catch (err) {
      // Best effort
    }
  }

  // Install skills (best effort as per original script)
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  await fs.mkdir(skillsDir, { recursive: true });

  const externalSkills = [
    { name: 'to-prd', url: 'https://github.com/mattpocock/to-prd-skill.git' },
    { name: 'to-issues', url: 'https://github.com/mattpocock/to-issues-skill.git' }
  ];

  for (const { name, url } of externalSkills) {
    const skillPath = path.join(skillsDir, name);
    if (!existsSync(skillPath)) {
       try {
         execSync(`git clone ${url} "${skillPath}"`, { stdio: 'ignore' });
       } catch (err) {}
    }
  }

  // Copy internal Harness skills
  const harnessSkillsDir = path.join(HARNESS_DIR, 'skill');
  if (existsSync(harnessSkillsDir)) {
    try {
      const files = await fs.readdir(harnessSkillsDir);
      for (const file of files) {
        try {
          await fs.copyFile(path.join(harnessSkillsDir, file), path.join(skillsDir, file));
        } catch (err) {
          // Best effort for individual files
        }
      }
    } catch (err) {
      // Best effort for directory reading
    }
  }
}

export async function ensureDependencies() {
  console.log('Checking dependencies...');
  for (const dep of DEPS) {
    if (!await checkAndInstall(dep)) {
      console.error(`- ${dep}: Failed to satisfy dependency.`);
      return false;
    }
  }
  return true;
}

async function checkAndInstall(dep) {
  try {
    const checkCmd = getCheckCommand(dep);
    execSync(checkCmd, { stdio: 'ignore' });
    console.log(`- ${dep}: Found`);
    return true;
  } catch (err) {
    console.warn(`- ${dep}: Missing. Attempting auto-install...`);
    return await attemptInstall(dep);
  }
}

function getCheckCommand(dep) {
  if (dep === 'python3' && os.platform() === 'win32') {
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      return 'python3 --version';
    } catch {
      return 'python --version';
    }
  }
  return `${dep} --version`;
}

async function attemptInstall(dep) {
  const platform = os.platform();
  const installCmds = {
    win32: { git: 'scoop install git', python3: 'scoop install python', gh: 'scoop install gh', tmux: 'scoop install tmux' },
    darwin: { git: 'brew install git', python3: 'brew install python', gh: 'brew install gh', tmux: 'brew install tmux' },
    linux: { git: 'sudo apt install -y git', python3: 'sudo apt install -y python3', gh: 'sudo apt install -y gh', tmux: 'sudo apt install -y tmux' }
  };

  let cmd = installCmds[platform]?.[dep];
  
  if (dep === 'claude') {
    cmd = 'npm install -g @anthropic-ai/claude-code';
  }

  if (cmd) {
    console.log(`Running: ${cmd}`);
    try {
      execSync(cmd, { stdio: 'inherit' });
      // Double check after install
      const checkCmd = getCheckCommand(dep);
      execSync(checkCmd, { stdio: 'ignore' });
      return true;
    } catch (err) {
      console.error(`Failed to install ${dep} automatically.`);
      return false;
    }
  }

  console.error(`No installation command found for ${dep} on ${platform}.`);
  return false;
}

async function createSymlink() {
  const binDir = path.join(os.homedir(), '.local', 'bin');
  await fs.mkdir(binDir, { recursive: true });
  const target = path.join(binDir, 'harness');
  const source = path.join(HARNESS_DIR, 'bin', 'harness');

  if (os.platform() === 'win32') {
    // Windows: create a .cmd shim
    const cmdContent = `@echo off\nnode "${source}" %*`;
    await fs.writeFile(`${target}.cmd`, cmdContent);
  } else {
    try {
      if (existsSync(target)) await fs.unlink(target);
      await fs.symlink(source, target);
    } catch (err) {
       console.warn(`Could not create symlink at ${target}. Please add ${path.join(HARNESS_DIR, 'bin')} to your PATH.`);
    }
  }
}

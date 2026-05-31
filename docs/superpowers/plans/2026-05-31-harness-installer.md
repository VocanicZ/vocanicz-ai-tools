# Harness Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a cross-platform (Node.js) Harness engine installer into `vocanicz-ai-tools`.

**Architecture:** Create a new `src/modules/harness.js` module that handles dependency checks, engine cloning, and Claude integration. Update `src/install.js` to invoke this module.

**Tech Stack:** Node.js, `child_process`, `fs/promises`.

---

### Task 1: Scaffolding the Harness Module and Tests

**Files:**
- Create: `src/modules/harness.js`
- Create: `test/harness.test.js`

- [x] **Step 1: Create the failing test file**
Create `test/harness.test.js` with a basic test for the `installHarness` function.

```javascript
import { describe, it, expect, vi } from 'vitest';
import { installHarness } from '../src/modules/harness.js';

describe('harness installer', () => {
  it('should exist', () => {
    expect(installHarness).toBeDefined();
  });
});
```

- [x] **Step 2: Create the Harness module**
Create `src/modules/harness.js` with an empty `installHarness` function.

```javascript
export async function installHarness() {
  // To be implemented
}
```

- [x] **Step 3: Run tests to verify**
Run: `npm test test/harness.test.js`
Expected: PASS

- [x] **Step 4: Commit**
```bash
git add src/modules/harness.js test/harness.test.js
git commit -m "feat(harness): scaffold harness module and tests"
```

---

### Task 2: Implement Dependency Check Logic

**Files:**
- Modify: `src/modules/harness.js`
- Modify: `test/harness.test.js`

- [x] **Step 1: Write tests for dependency check**
Update `test/harness.test.js` to test dependency detection.

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installHarness, ensureDependencies } from '../src/modules/harness.js';
import { execSync } from 'node:child_process';

vi.mock('node:child_process', () => ({
  execSync: vi.fn()
}));

describe('ensureDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if all dependencies are present', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('version 1.0.0'));
    const result = await ensureDependencies();
    expect(result).toBe(true);
  });
});
```

- [x] **Step 2: Implement `ensureDependencies`**
Implement the check logic in `src/modules/harness.js`.

```javascript
import { execSync } from 'node:child_process';
import os from 'node:os';

const DEPS = ['git', 'python3', 'gh', 'claude'];

export async function ensureDependencies() {
  console.log('Checking dependencies...');
  for (const dep of DEPS) {
    try {
      execSync(`${dep} --version`, { stdio: 'ignore' });
      console.log(`- ${dep}: Found`);
    } catch (err) {
      console.warn(`- ${dep}: Missing. Attempting auto-install...`);
      await attemptInstall(dep);
    }
  }
  return true;
}

async function attemptInstall(dep) {
  const platform = os.platform();
  const installCmds = {
    win32: { git: 'scoop install git', python3: 'scoop install python', gh: 'scoop install gh' },
    darwin: { git: 'brew install git', python3: 'brew install python', gh: 'brew install gh', tmux: 'brew install tmux' },
    linux: { git: 'sudo apt install -y git', python3: 'sudo apt install -y python3', gh: 'sudo apt install -y gh', tmux: 'sudo apt install -y tmux' }
  };

  const cmd = installCmds[platform]?.[dep];
  if (cmd) {
    console.log(`Running: ${cmd}`);
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.error(`Failed to install ${dep} automatically.`);
    }
  } else if (dep === 'claude') {
    console.log('Installing Claude CLI...');
    execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit' });
  }
}
```

- [x] **Step 3: Run tests**
Run: `npm test test/harness.test.js`
Expected: PASS

- [x] **Step 4: Commit**
```bash
git add src/modules/harness.js test/harness.test.js
git commit -m "feat(harness): implement dependency check and auto-install"
```

---

### Task 3: Implement Engine Setup (Clone/Update)

**Files:**
- Modify: `src/modules/harness.js`
- Modify: `test/harness.test.js`

- [ ] **Step 1: Write tests for `setupEngine`**
Update `test/harness.test.js`.

```javascript
// ... existing imports
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

vi.mock('node:fs/promises');
vi.mock('node:fs', () => ({
  existsSync: vi.fn()
}));

// ... in describe block
it('should clone engine if not exists', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  // Implementation will call execSync for git clone
});
```

- [ ] **Step 2: Implement `setupEngine`**
Add logic to `src/modules/harness.js`.

```javascript
import path from 'node:path';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';

const HARNESS_REPO = 'https://github.com/VocanicZ/Harness.git';
const HARNESS_DIR = path.join(os.homedir(), '.harness', 'engine');

export async function setupEngine() {
  if (!existsSync(HARNESS_DIR)) {
    console.log('Cloning Harness engine...');
    await fs.mkdir(path.dirname(HARNESS_DIR), { recursive: true });
    execSync(`git clone ${HARNESS_REPO} "${HARNESS_DIR}"`, { stdio: 'inherit' });
  } else {
    console.log('Updating Harness engine...');
    execSync(`git -C "${HARNESS_DIR}" pull --ff-only`, { stdio: 'inherit' });
  }
}
```

- [ ] **Step 3: Run tests**
Run: `npm test test/harness.test.js`

- [ ] **Step 4: Commit**
```bash
git add src/modules/harness.js
git commit -m "feat(harness): implement engine setup"
```

---

### Task 4: Claude Integration (Plugins & Skills)

**Files:**
- Modify: `src/modules/harness.js`

- [ ] **Step 1: Implement `setupClaudeIntegration`**
Add logic to install plugins and skills.

```javascript
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
    const files = await fs.readdir(harnessSkillsDir);
    for (const file of files) {
       await fs.copyFile(path.join(harnessSkillsDir, file), path.join(skillsDir, file));
    }
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add src/modules/harness.js
git commit -m "feat(harness): implement Claude integration setup"
```

---

### Task 5: Integrate into Main Installer

**Files:**
- Modify: `src/install.js`

- [ ] **Step 1: Update `install` function**
Import and call `installHarness` in `src/install.js`.

```javascript
// ... existing imports
import { installHarness } from './modules/harness.js';

// ... in install()
    await copyRecursive(srcDir, targetSrcDir);

    // Install Harness
    try {
      await installHarness();
    } catch (err) {
      console.warn('Harness installation failed, but continuing with toolkit setup:', err.message);
    }
// ...
```

- [ ] **Step 2: Implement `installHarness` orchestration**
Complete the `installHarness` function in `src/modules/harness.js`.

```javascript
export async function installHarness() {
  console.log('\n--- Installing Harness Engine ---');
  await ensureDependencies();
  await setupEngine();
  await setupClaudeIntegration();
  await createSymlink();
  console.log('--- Harness Installation Complete ---\n');
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
```

- [ ] **Step 3: Verify full installation**
Run: `node src/install.js --setup`
Check output and verify `~/.harness/engine` exists.

- [ ] **Step 4: Commit**
```bash
git add src/install.js src/modules/harness.js
git commit -m "feat(harness): integrate Harness installer into main setup"
```

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installHarness, ensureDependencies, setupEngine, setupClaudeIntegration } from '../src/modules/harness.js';
import { execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

vi.mock('node:child_process', () => ({
  execSync: vi.fn()
}));

vi.mock('node:os', () => ({
  default: {
    platform: vi.fn(),
    homedir: vi.fn(() => '/home/user')
  },
  platform: vi.fn(),
  homedir: vi.fn(() => '/home/user')
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    readdir: vi.fn(),
    copyFile: vi.fn(),
    unlink: vi.fn(),
    symlink: vi.fn(),
    writeFile: vi.fn()
  },
  mkdir: vi.fn(),
  readdir: vi.fn(),
  copyFile: vi.fn(),
  unlink: vi.fn(),
  symlink: vi.fn(),
  writeFile: vi.fn()
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn()
}));

describe('ensureDependencies', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(execSync).mockReturnValue(Buffer.from('ok'));
  });

  it('should return true if all dependencies are present', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('version 1.0.0'));
    const result = await ensureDependencies();
    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith('git --version', { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith('python3 --version', { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith('gh --version', { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith('claude --version', { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith('tmux --version', { stdio: 'ignore' });
  });

  it('should return false if a dependency is missing and auto-install fails', async () => {
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (cmd.includes('--version')) {
        throw new Error('command not found');
      }
      if (cmd.includes('apt install')) {
        throw new Error('permission denied');
      }
      return Buffer.from('ok');
    });

    const result = await ensureDependencies();
    expect(result).toBe(false);
  });

  it('should attempt to install missing dependencies with correct command on Linux', async () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    let installed = false;
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (cmd === 'git --version') {
        if (!installed) {
          throw new Error('command not found');
        }
        return Buffer.from('git version 2.34.1');
      }
      if (cmd === 'sudo apt install -y git') {
        installed = true;
        return Buffer.from('installed');
      }
      return Buffer.from('version 1.0.0');
    });

    const result = await ensureDependencies();
    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith('sudo apt install -y git', { stdio: 'inherit' });
  });

  it('should attempt to install missing dependencies with correct command on Darwin', async () => {
    vi.mocked(os.platform).mockReturnValue('darwin');
    let installed = false;
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (cmd === 'git --version') {
        if (!installed) {
          throw new Error('command not found');
        }
        return Buffer.from('git version 2.34.1');
      }
      if (cmd === 'brew install git') {
        installed = true;
        return Buffer.from('installed');
      }
      return Buffer.from('version 1.0.0');
    });

    const result = await ensureDependencies();
    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith('brew install git', { stdio: 'inherit' });
  });

  it('should attempt to install missing dependencies with correct command on Windows', async () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    let installed = false;
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (cmd === 'git --version') {
        if (!installed) {
          throw new Error('command not found');
        }
        return Buffer.from('git version 2.34.1');
      }
      if (cmd === 'scoop install git') {
        installed = true;
        return Buffer.from('installed');
      }
      return Buffer.from('version 1.0.0');
    });

    const result = await ensureDependencies();
    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith('scoop install git', { stdio: 'inherit' });
  });

  it('should check for python if python3 is missing on Windows', async () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (cmd === 'python3 --version') {
        throw new Error('command not found');
      }
      return Buffer.from('Python 3.10.0');
    });

    const result = await ensureDependencies();
    expect(result).toBe(true);
    expect(execSync).toHaveBeenCalledWith('python --version', { stdio: 'ignore' });
  });

  it('should return false if no installation command is found for a platform', async () => {
    vi.mocked(os.platform).mockReturnValue('freebsd');
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('command not found');
    });

    const result = await ensureDependencies();
    expect(result).toBe(false);
  });
});

describe('setupEngine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(execSync).mockReturnValue(Buffer.from('ok'));
  });

  it('should clone engine if not exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    await setupEngine();
    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.harness'), { recursive: true });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git clone'), { stdio: 'inherit' });
  });

  it('should update engine if exists', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    await setupEngine();
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git -C'), { stdio: 'inherit' });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('pull --ff-only'), { stdio: 'inherit' });
  });

  it('should throw error if git clone fails', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('clone failed');
    });
    await expect(setupEngine()).rejects.toThrow('Failed to clone Harness engine: clone failed');
  });

  it('should throw error if git pull fails', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('pull failed');
    });
    await expect(setupEngine()).rejects.toThrow('Failed to update Harness engine: pull failed');
  });
});

describe('setupClaudeIntegration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(execSync).mockReturnValue(Buffer.from('ok'));
    vi.mocked(fs.readdir).mockResolvedValue([]);
  });

  it('should install plugins and external skills', async () => {
    vi.mocked(existsSync).mockReturnValue(false); // Skills don't exist yet
    
    await setupClaudeIntegration();

    expect(execSync).toHaveBeenCalledWith('claude mcp add superpowers', { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith('claude mcp add ralph-loop', { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git clone https://github.com/mattpocock/to-prd-skill.git'), { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git clone https://github.com/mattpocock/to-issues-skill.git'), { stdio: 'ignore' });
  });

  it('should copy internal skills if they exist', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      if (path.includes('skill')) return true;
      return false;
    });
    vi.mocked(fs.readdir).mockResolvedValue(['test-skill.md']);

    await setupClaudeIntegration();

    expect(fs.copyFile).toHaveBeenCalledWith(
      expect.stringContaining('test-skill.md'),
      expect.stringContaining('.claude/skills/test-skill.md')
    );
  });
});

describe('installHarness', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(execSync).mockReturnValue(Buffer.from('ok'));
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(existsSync).mockReturnValue(true);
  });

  it('should run all installation steps on Linux', async () => {
    await installHarness();
    
    expect(execSync).toHaveBeenCalledWith('git --version', { stdio: 'ignore' });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git -C'), { stdio: 'inherit' });
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('claude mcp add'), { stdio: 'ignore' });
    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.local/bin'), { recursive: true });
    expect(fs.symlink).toHaveBeenCalled();
  });

  it('should create a .cmd shim on Windows', async () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    await installHarness();
    
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('harness.cmd'),
      expect.stringContaining('@echo off')
    );
  });

  it('should throw error if dependencies are not satisfied', async () => {
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (cmd.includes('--version')) throw new Error('missing');
      return Buffer.from('ok');
    });
    vi.mocked(os.platform).mockReturnValue('freebsd'); // Force auto-install failure
    
    await expect(installHarness()).rejects.toThrow('Harness dependencies not satisfied');
  });
});

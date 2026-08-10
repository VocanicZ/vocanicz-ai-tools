import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { assetName, rcPath, rcPaths, switchFunction, upsertBlock } from '../src/modules/accswitch.js';
import { FEATURE_IDS } from '../src/modules/features.js';

describe('accswitch module', () => {
  it('is a selectable feature', () => {
    expect(FEATURE_IDS).toContain('accswitch');
  });

  describe('assetName', () => {
    it('maps every published release asset', () => {
      expect(assetName('linux', 'x64')).toBe('claude-acc-linux-x86_64');
      expect(assetName('linux', 'arm64')).toBe('claude-acc-linux-aarch64');
      expect(assetName('darwin', 'x64')).toBe('claude-acc-macos-x86_64');
      expect(assetName('darwin', 'arm64')).toBe('claude-acc-macos-aarch64');
      expect(assetName('win32', 'x64')).toBe('claude-acc-windows-x86_64.exe');
    });

    it('returns null for unpublished combinations', () => {
      expect(assetName('win32', 'arm64')).toBeNull();
      expect(assetName('linux', 'ia32')).toBeNull();
      expect(assetName('freebsd', 'x64')).toBeNull();
    });
  });

  describe('rcPath', () => {
    it('picks the rc file matching $SHELL', () => {
      expect(rcPath('linux', '/usr/bin/zsh')).toBe(path.join(os.homedir(), '.zshrc'));
      expect(rcPath('linux', '/bin/bash')).toBe(path.join(os.homedir(), '.bashrc'));
      expect(rcPath('darwin', '')).toBe(path.join(os.homedir(), '.bashrc'));
      expect(rcPath('win32', '')).toMatch(/Microsoft\.PowerShell_profile\.ps1$/);
    });
  });

  describe('rcPaths', () => {
    it('returns a single rc on POSIX', () => {
      expect(rcPaths('linux', '/usr/bin/zsh')).toEqual([path.join(os.homedir(), '.zshrc')]);
      expect(rcPaths('darwin', '')).toEqual([path.join(os.homedir(), '.bashrc')]);
    });

    it('covers both PowerShell 7 and Windows PowerShell 5.1 profiles', () => {
      const paths = rcPaths('win32', '');
      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe(
        path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
      );
      expect(paths[1]).toBe(
        path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
      );
    });

    it('agrees with rcPath on the primary entry', () => {
      expect(rcPath('win32', '')).toBe(rcPaths('win32', '')[0]);
      expect(rcPath('linux', '/bin/bash')).toBe(rcPaths('linux', '/bin/bash')[0]);
    });
  });

  describe('switchFunction', () => {
    it('calls the binary by absolute path so the wrapper cannot recurse', () => {
      const posix = switchFunction('linux');
      expect(posix).toContain('claude-acc() {');
      expect(posix).toContain(path.join(os.homedir(), '.claude-switch', 'bin', 'claude-acc'));
      expect(posix).toContain('unset CLAUDE_CONFIG_DIR __CLAUDE_ACC_PREV_DIR');
    });

    it('emits PowerShell syntax on win32', () => {
      const pwsh = switchFunction('win32');
      expect(pwsh).toContain('function claude-acc {');
      expect(pwsh).toContain('Remove-Item Env:CLAUDE_CONFIG_DIR');
      expect(pwsh).toContain('claude-acc.exe');
    });

    it('re-activates on win32 so `switch` lands in the calling shell', () => {
      // Clearing CLAUDE_CONFIG_DIR alone only worked if the activate-on-cd hook
      // fired afterwards; `switch` never cds, so the shell fell back to
      // ~/.claude (the default account) instead of the one just selected.
      const pwsh = switchFunction('win32');
      expect(pwsh).toContain("Invoke-Expression (& '");
      expect(pwsh).toContain("activate --shell powershell");
      expect(pwsh.indexOf('Remove-Item Env:CLAUDE_CONFIG_DIR'))
        .toBeLessThan(pwsh.indexOf('activate --shell powershell'));
    });

    it('self-loads upstream integration and guards the 5.1-only failure', () => {
      const pwsh = switchFunction('win32');
      expect(pwsh).toContain('Get-Command __claude_acc_activate');
      expect(pwsh).toContain("init pwsh");
      // LocationChangedAction is PowerShell 6+; 5.1 throws on profile load.
      expect(pwsh).toContain('$PSVersionTable.PSVersion.Major -lt 6');
      expect(pwsh).toContain('LocationChangedAction');
    });

    it('keeps the PowerShell block free of unescaped template artifacts', () => {
      const pwsh = switchFunction('win32');
      // `-join "\`n"` and the regex escapes must survive JS template literals.
      expect(pwsh).toContain('-join "`n"');
      expect(pwsh).toContain('\\$ExecutionContext\\.SessionState');
      expect(pwsh).not.toContain('${');
    });

    it('re-runs share-state.sh after `add` so new accounts get linked', () => {
      const posix = switchFunction('linux');
      expect(posix).toContain('elif [ "$1" = "add" ]');
      expect(posix).toContain(path.join(os.homedir(), '.claude-switch', 'share-state.sh'));
      expect(posix).toContain(path.join(os.homedir(), '.claude-switch', 'accounts'));
    });
  });

  describe('upsertBlock', () => {
    let rc;

    beforeEach(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'accswitch-test-'));
      rc = path.join(dir, '.bashrc');
    });

    afterEach(async () => {
      await fs.rm(path.dirname(rc), { recursive: true, force: true });
    });

    it('appends to an existing rc without touching prior content', async () => {
      await fs.writeFile(rc, 'export EDITOR=vim\n');
      await upsertBlock(rc, switchFunction('linux'));
      const out = await fs.readFile(rc, 'utf-8');
      expect(out).toContain('export EDITOR=vim');
      expect(out).toContain('claude-acc() {');
    });

    it('creates the rc when absent', async () => {
      await upsertBlock(rc, switchFunction('linux'));
      expect(await fs.readFile(rc, 'utf-8')).toContain('claude-acc() {');
    });

    it('replaces rather than duplicates on re-install', async () => {
      await fs.writeFile(rc, 'export EDITOR=vim\n');
      await upsertBlock(rc, switchFunction('linux'));
      await upsertBlock(rc, switchFunction('linux'));
      await upsertBlock(rc, switchFunction('linux'));
      const out = await fs.readFile(rc, 'utf-8');
      expect(out.match(/claude-acc\(\) \{/g)).toHaveLength(1);
      expect(out.match(/export EDITOR=vim/g)).toHaveLength(1);
    });

    it('keeps content written after the block', async () => {
      await fs.writeFile(rc, 'before=1\n');
      await upsertBlock(rc, switchFunction('linux'));
      await fs.appendFile(rc, '\nafter=1\n');
      await upsertBlock(rc, switchFunction('linux'));
      const out = await fs.readFile(rc, 'utf-8');
      expect(out).toContain('before=1');
      expect(out).toContain('after=1');
      expect(out.match(/claude-acc\(\) \{/g)).toHaveLength(1);
    });
  });
});

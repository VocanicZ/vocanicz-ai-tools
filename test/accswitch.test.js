import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { assetName, rcPath, switchFunction, upsertBlock } from '../src/modules/accswitch.js';
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

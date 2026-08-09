import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claudeConfigDir } from '../src/modules/paths.js';
import os from 'node:os';

vi.mock('node:os');

describe('paths module', () => {
  const mockHome = '/home/user';

  beforeEach(() => {
    vi.resetAllMocks();
    os.homedir.mockReturnValue(mockHome);
  });

  describe('claudeConfigDir', () => {
    it('falls back to ~/.claude when CLAUDE_CONFIG_DIR is unset', () => {
      expect(claudeConfigDir({})).toBe('/home/user/.claude');
    });

    it('honors CLAUDE_CONFIG_DIR when set', () => {
      const env = { CLAUDE_CONFIG_DIR: '/home/user/.claude-switch/accounts/work' };
      expect(claudeConfigDir(env)).toBe('/home/user/.claude-switch/accounts/work');
    });

    it('treats an empty or blank CLAUDE_CONFIG_DIR as unset', () => {
      expect(claudeConfigDir({ CLAUDE_CONFIG_DIR: '' })).toBe('/home/user/.claude');
      expect(claudeConfigDir({ CLAUDE_CONFIG_DIR: '   ' })).toBe('/home/user/.claude');
    });

    it('defaults to process.env', () => {
      const prev = process.env.CLAUDE_CONFIG_DIR;
      process.env.CLAUDE_CONFIG_DIR = '/tmp/acct';
      try {
        expect(claudeConfigDir()).toBe('/tmp/acct');
      } finally {
        if (prev === undefined) delete process.env.CLAUDE_CONFIG_DIR;
        else process.env.CLAUDE_CONFIG_DIR = prev;
      }
    });
  });
});

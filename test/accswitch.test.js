import { describe, it, expect } from 'vitest';
import { assetName } from '../src/modules/accswitch.js';
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
});

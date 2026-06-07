import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadConfig, shouldShowGraphify, DEFAULT_CONFIG } from '../src/modules/config.js';
import fs from 'node:fs';

describe('config module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfig', () => {
    it('returns defaults when file missing', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(loadConfig('/tmp/none.json')).toEqual(DEFAULT_CONFIG);
    });

    it('merges file over defaults', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{"graphify":"off"}');
      expect(loadConfig('/tmp/c.json')).toEqual({ graphify: 'off' });
    });

    it('returns defaults on malformed JSON', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{ not json');
      expect(loadConfig('/tmp/c.json')).toEqual(DEFAULT_CONFIG);
    });

    it('keeps default keys when file omits them', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{}');
      expect(loadConfig('/tmp/c.json')).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('shouldShowGraphify', () => {
    it('off hides even when detected', () => {
      expect(shouldShowGraphify('off', true)).toBe(false);
    });

    it('on shows even when not detected', () => {
      expect(shouldShowGraphify('on', false)).toBe(true);
    });

    it('auto follows detection', () => {
      expect(shouldShowGraphify('auto', true)).toBe(true);
      expect(shouldShowGraphify('auto', false)).toBe(false);
    });

    it('unknown mode falls back to detection', () => {
      expect(shouldShowGraphify(undefined, true)).toBe(true);
      expect(shouldShowGraphify(undefined, false)).toBe(false);
    });
  });
});

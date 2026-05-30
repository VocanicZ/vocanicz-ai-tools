import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTokens, detectGraphify } from '../src/modules/context.js';
import fs from 'node:fs';
import path from 'node:path';

describe('context module', () => {
  describe('parseTokens', () => {
    it('should return 0 tokens for empty transcript', () => {
      expect(parseTokens(null)).toEqual({ total: 0, messages: 0 });
      expect(parseTokens({})).toEqual({ total: 0, messages: 0 });
    });

    it('should calculate tokens correctly', () => {
      const transcript = {
        usage: {
          input_tokens: 10000,
          cache_creation_input_tokens: 5000,
          cache_read_input_tokens: 15000
        }
      };
      // total = 10000 + 5000 + 15000 = 30000
      // fixed = 8800 + 11800 + 700 + 100 + 3600 = 25000
      // messages = 30000 - 25000 = 5000
      expect(parseTokens(transcript)).toEqual({ total: 30000, messages: 5000 });
    });

    it('should handle missing usage properties', () => {
      const transcript = {
        usage: {
          input_tokens: 10000
        }
      };
      // total = 10000 + 0 + 0 = 10000
      // fixed = 25000
      // messages = max(0, 10000 - 25000) = 0
      expect(parseTokens(transcript)).toEqual({ total: 10000, messages: 0 });
    });
  });

  describe('detectGraphify', () => {
    const mockCwd = '/tmp/mock-cwd';

    beforeEach(() => {
      vi.mock('node:fs');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return false if graphify-out directory does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(detectGraphify('some text with graphify', mockCwd)).toBe(false);
    });

    it('should return false if graphify-out exists but transcript does not contain graphify', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      expect(detectGraphify('just some text', mockCwd)).toBe(false);
    });

    it('should return true if graphify-out exists and transcript contains graphify', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      expect(detectGraphify('let us use graphify', mockCwd)).toBe(true);
    });

    it('should handle object transcript', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const transcriptObj = { history: [{ content: 'use graphify' }] };
      expect(detectGraphify(transcriptObj, mockCwd)).toBe(true);
    });
  });
});

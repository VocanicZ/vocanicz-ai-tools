import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTokens, detectGraphify, getContextLimit, modelId } from '../src/modules/context.js';
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

  describe('modelId', () => {
    it('handles object model {id}', () => {
      expect(modelId({ id: 'claude-opus-4-8', display_name: 'Opus' })).toBe('claude-opus-4-8');
    });
    it('falls back to display_name', () => {
      expect(modelId({ display_name: 'Sonnet' })).toBe('sonnet');
    });
    it('handles string model', () => {
      expect(modelId('Claude-Sonnet')).toBe('claude-sonnet');
    });
    it('handles missing model', () => {
      expect(modelId(null)).toBe('');
      expect(modelId(undefined)).toBe('');
    });
  });

  describe('getContextLimit', () => {
    it('numeric config override wins', () => {
      expect(getContextLimit({ id: 'claude-opus-4-8' }, 250000)).toBe(250000);
    });
    it('object opus-4 model -> 1M (the reported bug)', () => {
      expect(getContextLimit({ id: 'claude-opus-4-8', display_name: 'Opus' }, 'auto')).toBe(1000000);
    });
    it('sonnet -> 1M', () => {
      expect(getContextLimit({ id: 'claude-sonnet-4-6' }, 'auto')).toBe(1000000);
    });
    it('unknown/older model -> 200k', () => {
      expect(getContextLimit({ id: 'claude-3-haiku' }, 'auto')).toBe(200000);
    });
    it('defaults to auto when limit omitted', () => {
      expect(getContextLimit({ id: 'claude-opus-4-8' })).toBe(1000000);
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsage, fetchUsage } from '../src/modules/usage.js';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';

vi.mock('node:fs/promises');
vi.mock('node:fs', () => ({
  existsSync: vi.fn()
}));
vi.mock('node:os');

global.fetch = vi.fn();

describe('usage module', () => {
  const mockHome = '/home/user';

  beforeEach(() => {
    vi.resetAllMocks();
    os.homedir.mockReturnValue(mockHome);
  });

  describe('getUsage', () => {
    it('returns null and triggers fetch if cache does not exist', async () => {
      existsSync.mockReturnValue(false);
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify({ claudeAiOauth: { accessToken: 'token' } }));
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ usage: 123 })
      });

      const data = await getUsage();
      expect(data).toBeNull();
      
      // Give it a moment to trigger the async fetch
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(fetch).toHaveBeenCalled();
    });

    it('returns cached data if it is fresh', async () => {
      existsSync.mockReturnValue(true);
      const now = Date.now();
      fs.stat.mockResolvedValue({ mtimeMs: now - 30000 }); // 30s old
      fs.readFile.mockResolvedValue(JSON.stringify({ usage: 456 }));

      const data = await getUsage();
      expect(data).toEqual({ usage: 456 });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns cached data and triggers fetch if it is stale', async () => {
      existsSync.mockReturnValue(true);
      const now = Date.now();
      fs.stat.mockResolvedValue({ mtimeMs: now - 70000 }); // 70s old
      fs.readFile.mockImplementation(async (path) => {
        if (path.toString().includes('cache.json')) return JSON.stringify({ usage: 789 });
        if (path.toString().includes('.credentials.json')) return JSON.stringify({ claudeAiOauth: { accessToken: 'token' } });
        return '';
      });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ usage: 1000 })
      });

      const data = await getUsage();
      expect(data).toEqual({ usage: 789 });
      
      // Give it a moment to trigger the async fetch
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('fetchUsage', () => {
    it('fetches from Anthropic API and updates cache', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ claudeAiOauth: { accessToken: 'secret-token' } }));
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'ok' })
      });
      existsSync.mockReturnValue(true);

      const data = await fetchUsage();
      expect(data).toEqual({ result: 'ok' });
      expect(fetch).toHaveBeenCalledWith('https://api.anthropic.com/api/oauth/usage', {
        headers: {
          'Authorization': 'Bearer secret-token',
          'anthropic-beta': 'oauth-2025-04-20'
        }
      });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('throws error if token is missing', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({}));
      await expect(fetchUsage()).rejects.toThrow('No OAuth token found in credentials');
    });
  });
});

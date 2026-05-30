import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function getPaths() {
  const HOME = os.homedir();
  const CREDENTIALS_PATH = path.join(HOME, '.claude', '.credentials.json');
  const CACHE_DIR = path.join(HOME, '.claude', 'usagebar');
  const CACHE_PATH = path.join(CACHE_DIR, 'cache.json');
  return { CREDENTIALS_PATH, CACHE_DIR, CACHE_PATH };
}

const STALE_THRESHOLD = 60 * 1000; // 60 seconds

/**
 * Gets usage data from cache or triggers a background fetch.
 * @returns {Promise<Object|null>}
 */
export async function getUsage() {
  const { CACHE_PATH } = getPaths();
  let cachedData = null;
  let isStale = true;

  try {
    if (existsSync(CACHE_PATH)) {
      const stats = await fs.stat(CACHE_PATH);
      const now = Date.now();
      const age = now - stats.mtimeMs;
      
      const content = await fs.readFile(CACHE_PATH, 'utf-8');
      cachedData = JSON.parse(content);
      
      if (age < STALE_THRESHOLD) {
        isStale = false;
      }
    }
  } catch (err) {
    // Ignore cache read errors
  }

  if (isStale) {
    // Trigger background fetch without awaiting it
    fetchUsage().catch(() => {});
  }

  return cachedData;
}

/**
 * Fetches usage data from Anthropic API and updates cache.
 * @returns {Promise<Object>}
 */
export async function fetchUsage() {
  const { CREDENTIALS_PATH, CACHE_DIR, CACHE_PATH } = getPaths();
  const credsContent = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const creds = JSON.parse(credsContent);
  const token = creds?.claudeAiOauth?.accessToken;

  if (!token) {
    throw new Error('No OAuth token found in credentials');
  }

  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20'
    }
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  
  if (!existsSync(CACHE_DIR)) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
  
  await fs.writeFile(CACHE_PATH, JSON.stringify(data));
  return data;
}

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { claudeConfigDir } from './paths.js';

function getPaths() {
  // Read the credentials of the account Claude Code is actually running as, and
  // cache next to them so switching accounts switches the meters instead of
  // showing (and clobbering) the previous account's numbers. Falls back to
  // ~/.claude when CLAUDE_CONFIG_DIR is unset or holds no credentials.
  const DEFAULT_DIR = path.join(os.homedir(), '.claude');
  let configDir = claudeConfigDir();
  if (!existsSync(path.join(configDir, '.credentials.json'))) configDir = DEFAULT_DIR;
  const CREDENTIALS_PATH = path.join(configDir, '.credentials.json');
  const CACHE_DIR = path.join(configDir, 'usagebar');
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

// ---- Rich usage-meter rendering --------------------------------------------

const R = '\x1b[0m';
const DIM = '\x1b[2m';
const FILLED = '▊';
const EMPTY = '░';

/** Threshold color for a utilization percentage (green / yellow / red). */
function utilColor(u) {
  if (u >= 80) return '\x1b[38;2;220;80;80m';
  if (u >= 50) return '\x1b[38;2;255;193;7m';
  return '\x1b[38;2;80;200;120m';
}

/** Compact "time until reset": Xd / Xh / Xm (empty if unknown). */
export function countdown(resetsAt, now = Date.now()) {
  if (!resetsAt) return '';
  const te = Date.parse(resetsAt);
  if (Number.isNaN(te)) return '';
  let d = Math.floor((te - now) / 1000);
  if (d < 0) d = 0;
  if (d >= 86400) return `${Math.floor(d / 86400)}d`;
  if (d >= 3600) return `${Math.floor(d / 3600)}h`;
  return `${Math.ceil(d / 60)}m`;
}

/**
 * Renders one labelled meter: `<label> <bar> <util>% <reset>`.
 * @param {string} label
 * @param {number} util - utilization percent (0..100)
 * @param {Object} [opts]
 * @param {number} [opts.len=8] - bar length in glyphs
 * @param {boolean} [opts.color=true]
 * @param {string} [opts.reset] - precomputed countdown string
 * @returns {string}
 */
export function meter(label, util, opts = {}) {
  if (util === null || util === undefined || Number.isNaN(util)) return '';
  const len = opts.len || 8;
  const color = opts.color !== false;
  const u = Math.round(util);
  let f = Math.round((u * len) / 100);
  if (f > len) f = len;
  if (f < 0) f = 0;
  const bar = FILLED.repeat(f) + EMPTY.repeat(len - f);
  const c = color ? utilColor(u) : '';
  const cd = opts.reset ? ` ${DIM}${opts.reset}${R}` : '';
  return `${label} ${c}${bar}${color ? R : ''} ${u}%${cd}`;
}

/**
 * Renders the Claude usage meters (5h / 7d / Sonnet-7d) from the cached API JSON.
 * @param {Object} data - cached https://api.anthropic.com/api/oauth/usage payload
 * @param {Object} [opts] - { len, color, sep, now }
 * @returns {string}
 */
export function renderUsage(data, opts = {}) {
  if (!data || typeof data !== 'object') return '';
  const sep = opts.sep || '   ';
  const now = opts.now || Date.now();
  const parts = [];
  const add = (label, node) => {
    if (!node || node.utilization === null || node.utilization === undefined) return;
    parts.push(meter(label, node.utilization, { ...opts, reset: countdown(node.resets_at, now) }));
  };
  add('5h', data.five_hour);
  add('7d', data.seven_day);
  add('S', data.seven_day_sonnet);
  return parts.filter(Boolean).join(sep);
}

/**
 * Renders Antigravity quota meters in the same Claude bar style.
 * Each quota exposes `remaining_fraction` (0..1); utilization = 1 - remaining.
 * @param {Object} quota - data.quota map { name: { remaining_fraction, resets_at? } }
 * @param {Object} [opts]
 * @returns {string}
 */
export function renderAntigravityUsage(quota, opts = {}) {
  if (!quota || typeof quota !== 'object') return '';
  const sep = opts.sep || '   ';
  const now = opts.now || Date.now();
  const parts = [];
  for (const [key, q] of Object.entries(quota)) {
    if (!q || typeof q.remaining_fraction !== 'number') continue;
    const util = (1 - q.remaining_fraction) * 100;
    const label = shortLabel(key);
    parts.push(meter(label, util, { ...opts, reset: countdown(q.resets_at, now) }));
  }
  return parts.filter(Boolean).join(sep);
}

/** Compacts a quota key into a short status-line label. */
function shortLabel(key) {
  const map = { five_hour: '5h', seven_day: '7d', daily: '1d', hourly: '1h', monthly: '30d' };
  if (map[key]) return map[key];
  return key.replace(/_/g, ' ').split(' ').map((w) => w[0] || '').join('').toUpperCase() || key;
}

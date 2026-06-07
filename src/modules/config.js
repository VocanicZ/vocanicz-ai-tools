import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_PATH = path.join(os.homedir(), '.vocanicz-ai-tools', 'config.json');

/**
 * Default configuration.
 *   graphify     - "auto" | "off" | "on" (the [Graphify] indicator)
 *   contextLimit - "auto" (model->limit map) | number (explicit max context tokens)
 *   autoUpdate   - boolean; throttled background refresh of the toolkit
 *   reserve      - columns reserved for Claude Code's own indicators
 *   segments     - per-segment visibility in the status bar
 */
export const DEFAULT_CONFIG = {
  graphify: 'auto',
  contextLimit: 'auto',
  autoUpdate: false,
  reserve: 20,
  segments: {
    context: true,
    messages: true,
    usage: true,
    graphify: true
  }
};

/**
 * Loads config from disk, merged over defaults (segments deep-merged). Never throws.
 * @param {string} [configPath] - Override path (for testing).
 * @returns {Object}
 */
export function loadConfig(configPath = CONFIG_PATH) {
  try {
    if (!fs.existsSync(configPath)) return clone(DEFAULT_CONFIG);
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return mergeConfig(parsed);
  } catch (err) {
    return clone(DEFAULT_CONFIG);
  }
}

/** Merges a partial config object over the defaults (segments deep-merged). */
export function mergeConfig(parsed = {}) {
  const merged = { ...DEFAULT_CONFIG, ...parsed };
  merged.segments = { ...DEFAULT_CONFIG.segments, ...(parsed.segments || {}) };
  return merged;
}

function clone(obj) {
  return mergeConfig(obj);
}

/**
 * Decides whether the Graphify indicator should render.
 * @param {string} mode - "auto" | "off" | "on".
 * @param {boolean} detected - Result of detectGraphify().
 * @returns {boolean}
 */
export function shouldShowGraphify(mode, detected) {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return detected;
}

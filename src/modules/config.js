import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_PATH = path.join(os.homedir(), '.vocanicz-ai-tools', 'config.json');

/**
 * Default configuration. `graphify` controls the Graphify status indicator:
 *   "auto" - show only when graphify is detected (graphify-out/ + transcript)
 *   "off"  - never show the indicator
 *   "on"   - always show when graphify-out/ exists (skip transcript check)
 */
export const DEFAULT_CONFIG = {
  graphify: 'auto'
};

/**
 * Loads config from disk, merged over defaults. Never throws.
 * @param {string} [configPath] - Override path (for testing).
 * @returns {Object}
 */
export function loadConfig(configPath = CONFIG_PATH) {
  try {
    if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Decides whether the Graphify indicator should render.
 * @param {string} mode - Config value: "auto" | "off" | "on".
 * @param {boolean} detected - Result of detectGraphify().
 * @returns {boolean}
 */
export function shouldShowGraphify(mode, detected) {
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return detected; // "auto" or anything else
}

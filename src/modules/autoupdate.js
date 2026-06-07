import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const INSTALL_DIR = path.join(os.homedir(), '.vocanicz-ai-tools');
export const STAMP_PATH = path.join(INSTALL_DIR, '.last-update');
export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // once/day

/**
 * Pure throttle decision: should an update run now?
 * @param {Object} config
 * @param {number} lastTs - epoch ms of last update (0 if never)
 * @param {number} now - epoch ms
 * @returns {boolean}
 */
export function shouldUpdate(config, lastTs, now) {
  if (!config || !config.autoUpdate) return false;
  return now - lastTs >= UPDATE_INTERVAL_MS;
}

function readStamp() {
  try {
    return parseInt(fs.readFileSync(STAMP_PATH, 'utf-8').trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * If enabled and throttle elapsed, kick off a detached background refresh of the
 * status-bar source from GitHub. Non-blocking; never throws into the status line.
 * @param {Object} config
 * @param {number} [now]
 * @returns {boolean} whether an update was triggered
 */
export function maybeAutoUpdate(config, now = Date.now()) {
  try {
    if (!shouldUpdate(config, readStamp(), now)) return false;
    fs.writeFileSync(STAMP_PATH, String(now));
    const child = spawn(
      'npx',
      ['-y', 'github:VocanicZ/vocanicz-ai-tools', '--setup', '--only=statusbar'],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    return true;
  } catch {
    return false;
  }
}

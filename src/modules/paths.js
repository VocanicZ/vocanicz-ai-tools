import os from 'node:os';
import path from 'node:path';

/**
 * Claude Code's active config directory.
 *
 * Claude Code reads its credentials, settings and skills from $CLAUDE_CONFIG_DIR
 * when that variable is set, and from ~/.claude otherwise. Account switchers
 * (claude-acc, see accswitch.js) switch accounts by pointing CLAUDE_CONFIG_DIR at
 * a per-account directory, so anything that resolves ~/.claude directly keeps
 * reading the previous account's state.
 *
 * @param {Object} [env=process.env] - environment to read CLAUDE_CONFIG_DIR from
 * @returns {string} absolute path of the active config dir
 */
export function claudeConfigDir(env = process.env) {
  const dir = (env.CLAUDE_CONFIG_DIR || '').trim();
  return dir || path.join(os.homedir(), '.claude');
}

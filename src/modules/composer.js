import fs from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Probes the controlling terminal's column count.
 *
 * A Claude Code / Antigravity status-line command runs as a subprocess whose
 * stdout is a pipe, so `process.stdout.columns` is undefined and the harness
 * does not pass the width on stdin. Mirror the bash composer: walk the parent
 * process tree to the controlling pts and read its winsize via `stty size`.
 * Falls back to `tput cols`, then $COLUMNS. Returns 0 when nothing is found.
 * @returns {number}
 */
export function probeWidth() {
  try {
    let p = process.pid;
    for (let i = 0; i < 8; i++) {
      for (const fd of [0, 1, 2]) {
        let link;
        try {
          link = fs.readlinkSync(`/proc/${p}/fd/${fd}`);
        } catch {
          continue;
        }
        if (/^\/dev\/(pts\/|tty)/.test(link)) {
          try {
            const out = execSync(`stty size < ${link}`, { shell: '/bin/sh', stdio: ['ignore', 'pipe', 'ignore'] })
              .toString().trim();
            const cols = parseInt(out.split(/\s+/)[1], 10);
            if (cols > 0) return cols;
          } catch {
            // fall through to parent
          }
        }
      }
      let stat;
      try {
        stat = fs.readFileSync(`/proc/${p}/stat`, 'utf-8');
      } catch {
        break;
      }
      // field 4 (ppid) sits after the "(comm)" group, which may contain spaces.
      const after = stat.slice(stat.lastIndexOf(')') + 1).trim().split(/\s+/);
      const ppid = parseInt(after[1], 10); // state, ppid, ...
      if (!ppid || ppid === p) break;
      p = ppid;
    }
  } catch {
    // ignore
  }
  try {
    const cols = parseInt(execSync('tput cols', { stdio: ['inherit', 'pipe', 'ignore'] }).toString().trim(), 10);
    if (cols > 0) return cols;
  } catch {
    // ignore
  }
  const env = parseInt(process.env.COLUMNS || '', 10);
  return env > 0 ? env : 0;
}

/**
 * Strips ANSI escape codes from a string.
 * @param {string} str - The string to strip.
 * @returns {string}
 */
export function stripAnsi(str) {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><]))'
  ].join('|');
  const regex = new RegExp(pattern, 'g');
  return str.replace(regex, '');
}

/**
 * Composes the layout with left-aligned and right-aligned content.
 * @param {string} left - Left-aligned content.
 * @param {string} right - Right-aligned content.
 * @param {Object} options - Configuration options.
 * @param {number} [options.width] - Terminal width override.
 * @param {number} [options.reserve=20] - Reserved space for Claude Code indicators.
 * @returns {string}
 */
export function compose(left, right, options = {}) {
  // Right part absent: behave exactly like the left status line alone.
  if (!right) return left;

  const width = options.width || process.stdout.columns || probeWidth() || 120;
  const reserve = options.reserve !== undefined ? options.reserve : 20;

  const effectiveWidth = Math.max(10, width - reserve);

  const leftVisible = stripAnsi(left).length;
  const rightVisible = stripAnsi(right).length;

  const paddingSize = Math.max(1, effectiveWidth - leftVisible - rightVisible);
  const padding = ' '.repeat(paddingSize);

  return `${left}${padding}${right}`;
}

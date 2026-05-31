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
  const width = options.width || process.stdout.columns || 80;
  const reserve = options.reserve !== undefined ? options.reserve : 20;
  
  const effectiveWidth = Math.max(10, width - reserve);

  const leftVisible = stripAnsi(left).length;
  const rightVisible = stripAnsi(right).length;

  const paddingSize = Math.max(1, effectiveWidth - leftVisible - rightVisible);
  const padding = ' '.repeat(paddingSize);

  return `${left}${padding}${right}`;
}

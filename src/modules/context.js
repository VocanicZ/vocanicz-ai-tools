import fs from 'node:fs';
import path from 'node:path';

// Fixed-overhead estimates (match Claude Code's /context category sizes). Only
// the assistant's internal /context knows the exact values; these approximate it.
export const OVERHEAD = {
  SYS_PROMPT: 8800,
  SYS_TOOLS: 11800,
  AGENTS: 700,
  MEMORY: 100,
  SKILLS: 3600
};
export const FIXED_OVERHEAD =
  OVERHEAD.SYS_PROMPT + OVERHEAD.SYS_TOOLS + OVERHEAD.AGENTS + OVERHEAD.MEMORY + OVERHEAD.SKILLS;

/**
 * Sums the context tokens from a usage object (input + cache create + cache read).
 * @param {Object} usage
 * @returns {number}
 */
export function sumUsage(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  return (usage.input_tokens || 0) +
         (usage.cache_creation_input_tokens || 0) +
         (usage.cache_read_input_tokens || 0);
}

/** Messages = total minus fixed overhead, floored at 0. */
export function messagesFromTotal(total) {
  return Math.max(0, total - FIXED_OVERHEAD);
}

/**
 * Calculates total and message tokens from a transcript usage object.
 * (Kept for the object-shaped input; status-line input uses readTranscriptTotal.)
 * @param {Object} transcript - The transcript object containing usage data.
 * @returns {Object} { total, messages }
 */
export function parseTokens(transcript) {
  if (!transcript || !transcript.usage) return { total: 0, messages: 0 };
  const total = sumUsage(transcript.usage);
  return { total, messages: messagesFromTotal(total) };
}

/**
 * Reads a JSONL transcript file and returns the most recent context-token total.
 * Mirrors the bash contextbar: scan from the end for the last line carrying a
 * usage block (`.message.usage` or `.usage`) and sum its token fields.
 * @param {string} transcriptPath
 * @returns {{ total: number, messages: number }}
 */
export function readTranscriptTotal(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return { total: 0, messages: 0 };
  let content;
  try {
    if (!fs.existsSync(transcriptPath)) return { total: 0, messages: 0 };
    content = fs.readFileSync(transcriptPath, 'utf-8');
  } catch {
    return { total: 0, messages: 0 };
  }
  const lines = content.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || line.indexOf('"usage"') === -1) continue;
    try {
      const obj = JSON.parse(line);
      const usage = (obj.message && obj.message.usage) || obj.usage;
      if (usage) {
        const total = sumUsage(usage);
        return { total, messages: messagesFromTotal(total) };
      }
    } catch {
      // keep scanning older lines
    }
  }
  return { total: 0, messages: 0 };
}

/**
 * Normalizes Claude Code's `model` field to a lowercase identifier string.
 * Claude Code sends an object ({ id, display_name }); older/custom inputs
 * may send a plain string. Returns '' when nothing usable is present.
 * @param {Object|string} model
 * @returns {string}
 */
export function modelId(model) {
  if (!model) return '';
  if (typeof model === 'string') return model.toLowerCase();
  return String(model.id || model.display_name || '').toLowerCase();
}

/**
 * Resolves the max context window (tokens).
 *   - numeric config.contextLimit wins (explicit override)
 *   - the "[1m]" id suffix (harness 1M-context signal) forces 1M
 *   - otherwise "auto": map known 1M-capable models, else 200k
 * @param {Object|string} model
 * @param {number|string} [contextLimit="auto"]
 * @returns {number}
 */
export function getContextLimit(model, contextLimit = 'auto') {
  if (typeof contextLimit === 'number' && contextLimit > 0) return contextLimit;

  const id = modelId(model);
  if (id.includes('[1m]')) return 1000000;
  // Current-gen Claude 4.x (Opus/Sonnet) and Sonnet support 1M context.
  if (/opus-4|sonnet-4|claude-(opus|sonnet)-4/.test(id)) return 1000000;
  if (id.includes('sonnet')) return 1000000;
  if (id.includes('gemini')) {
    if (id.includes('pro')) return 2000000;
    return 1000000;
  }
  return 200000;
}

/**
 * Detects "graphify" skill usage and existence of graphify-out/ directory.
 * `transcript` may be a path (string read on demand), parsed content, or any
 * object stringified for the keyword check.
 * @param {Object|string} transcript - Transcript content, path, or object.
 * @param {string} cwd - Current working directory.
 * @returns {boolean}
 */
export function detectGraphify(transcript, cwd) {
  const hasGraphifyDir = fs.existsSync(path.join(cwd, 'graphify-out'));
  if (!hasGraphifyDir) return false;
  if (!transcript) return false;

  // A path to an existing transcript file: grep its contents. If the read
  // fails (or it was never a real path), fall back to the string itself.
  if (typeof transcript === 'string' && fs.existsSync(transcript)) {
    try {
      return fs.readFileSync(transcript, 'utf-8').toLowerCase().includes('graphify');
    } catch {
      // not a readable file — treat the string as content below
    }
  }

  const transcriptString = typeof transcript === 'string'
    ? transcript
    : JSON.stringify(transcript);

  return transcriptString ? transcriptString.includes('graphify') : false;
}

// ---- Rich /context-style bar rendering -------------------------------------

const R = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const C = {
  SYS_PROMPT: '\x1b[38;2;136;136;136m',
  SYS_TOOLS: '\x1b[38;2;153;153;153m',
  AGENTS: '\x1b[38;2;177;185;249m',
  MEMORY: '\x1b[38;2;215;119;87m',
  SKILLS: '\x1b[38;2;255;193;7m',
  MESSAGES: '\x1b[38;2;130;125;189m',
  FREE: '\x1b[38;2;153;153;153m'
};

const GLYPH = { FILLED: '⛁', HALF: '⛀', EMPTY: '⛶' };

/**
 * Builds the colored block bar (matches the bash ContextBar segment layout).
 * @param {number} total - current context tokens (unused directly; segments sum to it)
 * @param {number} messages - message tokens (total - fixed overhead)
 * @param {number} maxBar - token value at which the bar fills completely
 * @param {number} [blocks=20] - number of blocks
 * @returns {string}
 */
export function renderContextBar(total, messages, maxBar, blocks = 20) {
  const perBlock = Math.max(1, Math.floor(maxBar / blocks));
  const segments = [
    [OVERHEAD.SYS_PROMPT, C.SYS_PROMPT, GLYPH.FILLED],
    [OVERHEAD.SYS_TOOLS, C.SYS_TOOLS, GLYPH.FILLED],
    [OVERHEAD.AGENTS, C.AGENTS, GLYPH.HALF],
    [OVERHEAD.MEMORY, C.MEMORY, GLYPH.HALF],
    [OVERHEAD.SKILLS, C.SKILLS, GLYPH.FILLED],
    [messages, C.MESSAGES, GLYPH.FILLED]
  ];

  let bar = '';
  let placed = 0;
  let acc = 0;
  for (const [tk, color, sym] of segments) {
    acc += tk;
    let target = Math.floor(acc / perBlock);
    if (target > blocks) target = blocks;
    while (placed < target) {
      bar += `${color}${sym}${R} `;
      placed++;
    }
  }
  while (placed < blocks) {
    bar += `${C.FREE}${GLYPH.EMPTY}${R} `;
    placed++;
  }
  return bar;
}

/**
 * Renders the full left context line: `<k>k <bar> (<maxBar%>|<actual%>)`.
 * @param {Object} opts
 * @param {number} opts.total
 * @param {number} opts.messages
 * @param {number} opts.limit - the model's actual context limit
 * @param {number} [opts.maxBar] - bar full-point (default min(150k, limit))
 * @param {number} [opts.blocks=20]
 * @param {boolean} [opts.includeMessages=true] - fold message blocks into the bar
 * @returns {string}
 */
export function renderContext({ total, messages, limit, maxBar, blocks = 20, includeMessages = true }) {
  const actualMax = limit > 0 ? limit : 200000;
  let bound = maxBar !== undefined ? maxBar : Math.min(150000, actualMax);
  if (bound > actualMax) bound = actualMax;
  if (bound < 1) bound = 1;

  const msg = includeMessages ? messages : 0;
  const bar = renderContextBar(total, msg, bound, blocks);

  let k = (total / 1000).toFixed(1);
  if (k.endsWith('.0')) k = k.slice(0, -2);
  const maxPct = Math.round((total * 100) / bound);
  const actualPct = Math.round((total * 100) / actualMax);

  return `${BOLD}${k}k${R} ${bar}${DIM}(${maxPct}%|${actualPct}%)${R}`;
}

import readline from 'node:readline/promises';

/**
 * Installable features. `id` is used for flags (--no-<id>) and selection keys.
 */
export const FEATURES = [
  {
    id: 'statusbar',
    name: 'Status Bar',
    description: 'Context/token tracking, usage limits, model awareness, graphify indicator.'
  },
  {
    id: 'yolo',
    name: 'YOLO Mode',
    description: 'claude --yolo / yolo shell alias to skip permission prompts.'
  },
  {
    id: 'harness',
    name: 'Harness Engine',
    description: 'Clone Harness, install deps (git/gh/tmux/...), and link the harness CLI.'
  },
  {
    id: 'claude',
    name: 'Claude Integration',
    description: 'Install Claude plugins and external/internal skills.'
  }
];

export const FEATURE_IDS = FEATURES.map((f) => f.id);

/** Selection with every feature enabled. */
export function allEnabled() {
  return Object.fromEntries(FEATURE_IDS.map((id) => [id, true]));
}

/**
 * Parses feature flags from argv.
 * Supports:
 *   --no-<id>            disable one feature (starts from all-enabled)
 *   --only=a,b           enable only the listed features
 *   --features=a,b       alias for --only
 * @param {string[]} argv
 * @returns {{ selection: Object|null, hasFlags: boolean }}
 *   selection is null when no feature flags were given (caller decides: prompt or default).
 */
export function parseFeatureFlags(argv) {
  const onlyArg = argv.find((a) => a.startsWith('--only=') || a.startsWith('--features='));
  const noFlags = argv.filter((a) => /^--no-[a-z]+$/.test(a));

  if (onlyArg) {
    const wanted = onlyArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
    const selection = Object.fromEntries(FEATURE_IDS.map((id) => [id, wanted.includes(id)]));
    return { selection, hasFlags: true };
  }

  if (noFlags.length) {
    const selection = allEnabled();
    for (const flag of noFlags) {
      const id = flag.slice('--no-'.length);
      if (id in selection) selection[id] = false;
    }
    return { selection, hasFlags: true };
  }

  return { selection: null, hasFlags: false };
}

/**
 * Interactive y/n prompt per feature. Falls back to default on empty answer.
 * @param {Object} [opts]
 * @param {Object} [opts.input] - readable (default stdin)
 * @param {Object} [opts.output] - writable (default stdout)
 * @returns {Promise<Object>} selection
 */
export async function promptFeatures(opts = {}) {
  const rl = readline.createInterface({
    input: opts.input || process.stdin,
    output: opts.output || process.stdout
  });
  const selection = {};
  console.log('\nSelect features to install (Y/n):');
  for (const f of FEATURES) {
    const answer = (await rl.question(`  ${f.name} — ${f.description} [Y/n] `)).trim().toLowerCase();
    selection[f.id] = answer === '' || answer === 'y' || answer === 'yes';
  }
  rl.close();
  return selection;
}

/**
 * Resolves which features to install.
 *   - explicit flags win (non-interactive)
 *   - else prompt when interactive (TTY)
 *   - else default to all enabled
 * @param {Object} opts
 * @param {string[]} opts.argv
 * @param {boolean} [opts.isInteractive] - default process.stdin.isTTY
 * @param {Function} [opts.prompt] - override prompt (for testing)
 * @returns {Promise<Object>} selection
 */
export async function resolveFeatures({ argv, isInteractive, prompt } = {}) {
  const { selection, hasFlags } = parseFeatureFlags(argv || []);
  if (hasFlags) return selection;

  const interactive = isInteractive !== undefined ? isInteractive : Boolean(process.stdin.isTTY);
  if (interactive) {
    return (prompt || promptFeatures)();
  }
  return allEnabled();
}

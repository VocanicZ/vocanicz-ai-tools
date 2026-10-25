import { spawnSync } from 'node:child_process';
import os from 'node:os';
import readline from 'node:readline/promises';

const INSTALL_URL = 'https://raw.githubusercontent.com/VocanicZ/swarm/main/install.sh';
// The only shell string we run. User values never enter it: they arrive as
// positional args ("$@") and are handed to install.sh as separate argv entries.
const PIPELINE = `curl -fsSL ${INSTALL_URL} | sudo bash -s -- "$@"`;
const USAGE = 'pass --swarm-role=worker --swarm-coord=<ip> or --swarm-role=coordinator';

/**
 * Parses the swarm-specific flags (independent of --only / --no-<id>).
 * A bare --swarm-coord implies the worker role.
 * @param {string[]} argv
 * @returns {{ role?: string, coord?: string, cpuLimit?: string, linkMbps?: string }}
 */
export function parseSwarmFlags(argv = []) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const coord = get('swarm-coord');
  return {
    role: get('swarm-role') || (coord ? 'worker' : undefined),
    coord,
    cpuLimit: get('swarm-cpu-limit'),
    linkMbps: get('swarm-link-mbps')
  };
}

/**
 * Hostname / IPv4 / IPv6 characters only, and no leading '-' (install.sh
 * would read it as an option).
 */
export function isValidCoord(value) {
  return typeof value === 'string' && value.length <= 253 && /^[A-Za-z0-9.:][A-Za-z0-9.:-]*$/.test(value);
}

/**
 * Builds the [command, args] to spawn. Throws on invalid input so nothing
 * unvalidated reaches a command line.
 * @param {{ role: string, coord?: string, cpuLimit?: string, linkMbps?: string, update?: boolean }} opts
 * @returns {[string, string[]]}
 */
export function swarmCommand({ role, coord, cpuLimit, linkMbps, update } = {}) {
  if (update) return ['sudo', ['swarm', 'update']];
  const num = (flag, v) => {
    if (v === undefined) return [];
    if (!/^\d+$/.test(v)) throw new Error(`Invalid ${flag} value: ${v}`);
    return [flag, v];
  };
  let args;
  if (role === 'worker') {
    if (!isValidCoord(coord)) throw new Error(`Invalid coordinator address: ${coord}`);
    args = ['worker', coord, ...num('--link-mbps', linkMbps)];
  } else if (role === 'coordinator') {
    args = ['coordinator', ...num('--cpu-limit', cpuLimit)];
  } else {
    throw new Error(`Unknown swarm role: ${role}`);
  }
  // bash -c '<pipeline>' <$0> <$1...>
  return ['bash', ['-c', PIPELINE, 'swarm-install', ...args]];
}

function hasSwarm() {
  return spawnSync('sh', ['-c', 'command -v swarm'], { stdio: 'ignore' }).status === 0;
}

async function defaultAsk(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function run([cmd, args]) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} exited with status ${res.status}`);
}

/**
 * Joins this machine to a swarm (worker or coordinator), or updates an
 * existing install. Needs root and a coordinator address, so it never runs
 * from the non-interactive "all features" default without explicit flags.
 * @param {Object} [opts]
 * @param {string[]} [opts.argv]
 * @param {boolean} [opts.isInteractive] - default process.stdin.isTTY
 * @param {string} [opts.platform] - default os.platform()
 * @param {Function} [opts.ask] - prompt override (for testing)
 * @param {Function} [opts.installed] - "swarm on PATH" check override (for testing)
 * @returns {Promise<string>} what happened: 'skipped' | 'update' | 'worker' | 'coordinator'
 */
export async function installSwarm({ argv = [], isInteractive, platform = os.platform(), ask = defaultAsk, installed = hasSwarm } = {}) {
  console.log('\n--- Swarm ---');
  if (platform !== 'linux') {
    console.log('Swarm: skipped (Linux + systemd only).');
    return 'skipped';
  }
  const interactive = isInteractive !== undefined ? isInteractive : Boolean(process.stdin.isTTY);
  const flags = parseSwarmFlags(argv);

  if (!interactive && !flags.role) {
    console.log(`Swarm: skipped (non-interactive; ${USAGE}).`);
    return 'skipped';
  }

  if (installed()) {
    if (interactive && !flags.role) {
      const answer = (await ask('  swarm is already installed. Run `sudo swarm update`? [Y/n] ')).toLowerCase();
      if (answer !== '' && answer !== 'y' && answer !== 'yes') {
        console.log('Swarm: skipped.');
        return 'skipped';
      }
    }
    run(swarmCommand({ update: true }));
    return 'update';
  }

  let { role, coord } = flags;
  if (!role) {
    const answer = (await ask('  Swarm role — worker / coordinator / skip [skip] ')).toLowerCase();
    role = { w: 'worker', worker: 'worker', c: 'coordinator', coordinator: 'coordinator' }[answer];
    if (!role) {
      console.log('Swarm: skipped.');
      return 'skipped';
    }
  }
  if (role === 'worker' && !coord) {
    if (!interactive) {
      console.log(`Swarm: skipped (worker needs a coordinator; ${USAGE}).`);
      return 'skipped';
    }
    coord = await ask('  Coordinator IP/host: ');
  }

  run(swarmCommand({ ...flags, role, coord }));
  return role;
}

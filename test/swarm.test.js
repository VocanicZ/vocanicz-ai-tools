import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { parseSwarmFlags, isValidCoord, swarmCommand, installSwarm } from '../src/modules/swarm.js';
import { parseFeatureFlags } from '../src/modules/features.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn()
}));

const PIPE = 'curl -fsSL https://raw.githubusercontent.com/VocanicZ/swarm/main/install.sh | sudo bash -s -- "$@"';

describe('parseSwarmFlags', () => {
  it('reads role, coord and numeric options', () => {
    expect(parseSwarmFlags(['--setup', '--swarm-role=coordinator', '--swarm-cpu-limit=4'])).toEqual({
      role: 'coordinator', coord: undefined, cpuLimit: '4', linkMbps: undefined
    });
  });

  it('a bare --swarm-coord implies worker', () => {
    const f = parseSwarmFlags(['--swarm-coord=10.0.0.5', '--swarm-link-mbps=100']);
    expect(f.role).toBe('worker');
    expect(f.coord).toBe('10.0.0.5');
    expect(f.linkMbps).toBe('100');
  });

  it('returns nothing when no swarm flags', () => {
    expect(parseSwarmFlags(['--setup']).role).toBeUndefined();
  });

  it('swarm flags are not mistaken for feature flags', () => {
    expect(parseFeatureFlags(['--swarm-role=worker']).hasFlags).toBe(false);
    expect(parseFeatureFlags(['--no-swarm']).selection.swarm).toBe(false);
  });
});

describe('isValidCoord', () => {
  it.each(['192.168.1.10', 'coord.lan', 'my-host', 'fe80::1', '::1'])('accepts %s', (v) => {
    expect(isValidCoord(v)).toBe(true);
  });

  it.each(['', '1.2.3.4; rm -rf /', '$(id)', 'a b', '-x', 'host`id`', undefined])('rejects %s', (v) => {
    expect(isValidCoord(v)).toBe(false);
  });
});

describe('swarmCommand', () => {
  it('worker: user values are separate bash -s args', () => {
    expect(swarmCommand({ role: 'worker', coord: '10.0.0.5', linkMbps: '100' })).toEqual([
      'bash', ['-c', PIPE, 'swarm-install', 'worker', '10.0.0.5', '--link-mbps', '100']
    ]);
  });

  it('coordinator with and without cpu limit', () => {
    expect(swarmCommand({ role: 'coordinator', cpuLimit: '8' })[1].slice(3)).toEqual(['coordinator', '--cpu-limit', '8']);
    expect(swarmCommand({ role: 'coordinator' })[1].slice(3)).toEqual(['coordinator']);
  });

  it('update', () => {
    expect(swarmCommand({ update: true })).toEqual(['sudo', ['swarm', 'update']]);
  });

  it('rejects a bad coord, bad numbers and unknown roles', () => {
    expect(() => swarmCommand({ role: 'worker', coord: '1.2.3.4;id' })).toThrow('Invalid coordinator');
    expect(() => swarmCommand({ role: 'worker' })).toThrow('Invalid coordinator');
    expect(() => swarmCommand({ role: 'coordinator', cpuLimit: '4; id' })).toThrow('Invalid --cpu-limit');
    expect(() => swarmCommand({ role: 'bogus' })).toThrow('Unknown swarm role');
  });
});

describe('installSwarm', () => {
  const notInstalled = () => false;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(spawnSync).mockReturnValue({ status: 0 });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('skips on non-Linux', async () => {
    const r = await installSwarm({ argv: ['--swarm-role=coordinator'], platform: 'darwin', isInteractive: false });
    expect(r).toBe('skipped');
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('skips when non-interactive with no role (not installed by the all-features default)', async () => {
    const r = await installSwarm({ argv: [], platform: 'linux', isInteractive: false, installed: () => true });
    expect(r).toBe('skipped');
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('skips non-interactive worker with no coord', async () => {
    const r = await installSwarm({ argv: ['--swarm-role=worker'], platform: 'linux', isInteractive: false, installed: notInstalled });
    expect(r).toBe('skipped');
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('non-interactive worker from flags spawns the installer with inherited stdio', async () => {
    const r = await installSwarm({
      argv: ['--swarm-role=worker', '--swarm-coord=10.0.0.5'], platform: 'linux', isInteractive: false, installed: notInstalled
    });
    expect(r).toBe('worker');
    expect(spawnSync).toHaveBeenCalledWith('bash', ['-c', PIPE, 'swarm-install', 'worker', '10.0.0.5'], { stdio: 'inherit' });
  });

  it('interactive: asks role then coord', async () => {
    const ask = vi.fn().mockResolvedValueOnce('worker').mockResolvedValueOnce('coord.lan');
    const r = await installSwarm({ platform: 'linux', isInteractive: true, ask, installed: notInstalled });
    expect(r).toBe('worker');
    expect(ask).toHaveBeenCalledTimes(2);
    expect(spawnSync).toHaveBeenCalledWith('bash', ['-c', PIPE, 'swarm-install', 'worker', 'coord.lan'], { stdio: 'inherit' });
  });

  it('interactive: empty role answer skips', async () => {
    const r = await installSwarm({ platform: 'linux', isInteractive: true, ask: async () => '', installed: notInstalled });
    expect(r).toBe('skipped');
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('interactive: invalid coord throws before spawning', async () => {
    const ask = vi.fn().mockResolvedValueOnce('w').mockResolvedValueOnce('$(reboot)');
    await expect(installSwarm({ platform: 'linux', isInteractive: true, ask, installed: notInstalled })).rejects.toThrow('Invalid coordinator');
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('already installed: interactive offers update', async () => {
    const r = await installSwarm({ platform: 'linux', isInteractive: true, ask: async () => '', installed: () => true });
    expect(r).toBe('update');
    expect(spawnSync).toHaveBeenCalledWith('sudo', ['swarm', 'update'], { stdio: 'inherit' });
  });

  it('already installed: declining the update skips', async () => {
    const r = await installSwarm({ platform: 'linux', isInteractive: true, ask: async () => 'n', installed: () => true });
    expect(r).toBe('skipped');
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('already installed + role flag non-interactive updates instead of reinstalling', async () => {
    const r = await installSwarm({ argv: ['--swarm-role=coordinator'], platform: 'linux', isInteractive: false, installed: () => true });
    expect(r).toBe('update');
    expect(spawnSync).toHaveBeenCalledWith('sudo', ['swarm', 'update'], { stdio: 'inherit' });
  });

  it('throws when the installer exits non-zero', async () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1 });
    await expect(installSwarm({
      argv: ['--swarm-role=coordinator'], platform: 'linux', isInteractive: false, installed: notInstalled
    })).rejects.toThrow('exited with status 1');
  });
});

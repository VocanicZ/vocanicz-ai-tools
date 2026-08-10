import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const INSTALLER = fileURLToPath(new URL('../src/install.js', import.meta.url));

/**
 * Runs the real installer in an isolated HOME. install.js has no exports (it is
 * a bin entry), so drive it the way users do rather than refactoring it.
 * Returns stdout and stderr combined — warnings go to console.warn.
 */
function runInstaller(home, env = {}) {
  const res = spawnSync(process.execPath, [INSTALLER, '--setup', '--only=statusbar'], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: home, USERPROFILE: home, ...env }
  });
  if (res.status !== 0) {
    throw new Error(`installer exited ${res.status}: ${res.stdout}${res.stderr}`);
  }
  return `${res.stdout}${res.stderr}`;
}

describe('installStatusBar settings.json handling', () => {
  let home;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'vat-install-'));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it('creates settings.json when the config dir has none', async () => {
    // A freshly added claude-acc account looks exactly like this: the dir
    // exists (it holds .credentials.json) but there is no settings.json yet.
    const account = path.join(home, '.claude-switch', 'accounts', 'work');
    await fs.mkdir(account, { recursive: true });

    runInstaller(home, { CLAUDE_CONFIG_DIR: account });

    const written = JSON.parse(await fs.readFile(path.join(account, 'settings.json'), 'utf-8'));
    expect(written.statusLine.type).toBe('command');
    expect(written.statusLine.command).toContain('main.js');
  });

  it('creates settings.json even when the config dir does not exist yet', async () => {
    const account = path.join(home, '.claude-switch', 'accounts', 'missing');

    runInstaller(home, { CLAUDE_CONFIG_DIR: account });

    const written = JSON.parse(await fs.readFile(path.join(account, 'settings.json'), 'utf-8'));
    expect(written.statusLine.type).toBe('command');
  });

  it('preserves unrelated keys in an existing settings.json', async () => {
    const claudeDir = path.join(home, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({ theme: 'dark', statusLine: { padding: 0 } })
    );

    runInstaller(home);

    const written = JSON.parse(await fs.readFile(path.join(claudeDir, 'settings.json'), 'utf-8'));
    expect(written.theme).toBe('dark');
    expect(written.statusLine.padding).toBe(0);
    expect(written.statusLine.type).toBe('command');
  });

  it('leaves a malformed settings.json untouched instead of clobbering it', async () => {
    const claudeDir = path.join(home, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.writeFile(path.join(claudeDir, 'settings.json'), '{ not json');

    const out = runInstaller(home);

    expect(out).toContain('Could not parse');
    expect(await fs.readFile(path.join(claudeDir, 'settings.json'), 'utf-8')).toBe('{ not json');
  });
});

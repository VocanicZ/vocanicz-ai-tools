import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

const REPO = 'Nemo-Illusionist/claude-code-account-switcher';

/**
 * Release asset name for a platform/arch pair.
 * @param {string} platform - os.platform() value
 * @param {string} arch - os.arch() value
 * @returns {string|null} asset name, or null when unsupported
 */
export function assetName(platform = os.platform(), arch = os.arch()) {
  const cpu = { x64: 'x86_64', arm64: 'aarch64' }[arch];
  if (!cpu) return null;
  if (platform === 'linux') return `claude-acc-linux-${cpu}`;
  if (platform === 'darwin') return `claude-acc-macos-${cpu}`;
  if (platform === 'win32') return cpu === 'x86_64' ? 'claude-acc-windows-x86_64.exe' : null;
  return null;
}

/**
 * Downloads the latest claude-acc release binary and runs its own `install`
 * subcommand, which copies it to ~/.claude-switch/bin and wires shell integration.
 */
export async function installAccSwitch() {
  console.log('\n--- Installing Claude Account Switcher ---');
  const asset = assetName();
  if (!asset) {
    throw new Error(`No claude-acc release for ${os.platform()}/${os.arch()}`);
  }

  const url = `https://github.com/${REPO}/releases/latest/download/${asset}`;
  console.log(`Downloading ${asset}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-acc-'));
  const binary = path.join(tmpDir, asset);
  await fs.writeFile(binary, Buffer.from(await res.arrayBuffer()), { mode: 0o755 });

  try {
    execFileSync(binary, ['install'], { stdio: 'inherit' });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  console.log('--- Account Switcher Complete (restart your shell) ---\n');
}

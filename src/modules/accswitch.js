import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = 'Nemo-Illusionist/claude-code-account-switcher';
const SWITCH_DIR = path.join(os.homedir(), '.claude-switch');
const ACCOUNTS_DIR = path.join(SWITCH_DIR, 'accounts');
const BEGIN = '# >>> vocanicz-ai-tools: claude-acc switch >>>';
const END = '# <<< vocanicz-ai-tools: claude-acc switch <<<';

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
 * Every rc file the wrapper has to be written into.
 *
 * On Windows there are two independent PowerShell profiles, and upstream's
 * `claude-acc install` only writes the PowerShell 7 one:
 *   PowerShell 7+       Documents\PowerShell\Microsoft.PowerShell_profile.ps1
 *   Windows PowerShell  Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1
 * Windows PowerShell 5.1 ships with the OS and is still what most terminals
 * open by default, so writing only the 7 profile leaves `claude-acc` undefined
 * (and its bin dir off PATH) in the shell many users actually have.
 *
 * @param {string} platform - os.platform() value
 * @param {string} shell - $SHELL value
 * @returns {string[]} absolute rc paths, most-preferred first
 */
export function rcPaths(platform = os.platform(), shell = process.env.SHELL || '') {
  const home = os.homedir();
  if (platform === 'win32') {
    return [
      path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
      path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
    ];
  }
  return [path.join(home, shell.includes('zsh') ? '.zshrc' : '.bashrc')];
}

/**
 * Primary rc file — the one upstream's `claude-acc install` wires itself into.
 * @param {string} platform - os.platform() value
 * @param {string} shell - $SHELL value
 * @returns {string} absolute rc path
 */
export function rcPath(platform = os.platform(), shell = process.env.SHELL || '') {
  return rcPaths(platform, shell)[0];
}

/**
 * Persists ~/.claude-switch/bin onto the user PATH so `claude-acc` resolves in
 * cmd.exe, in GUI-launched terminals, and in any shell whose profile has not
 * run upstream's `init` (which only prepends PATH for the current session).
 *
 * Skipped when the stored PATH contains `%VAR%` references: writing it back
 * through SetEnvironmentVariable would flatten REG_EXPAND_SZ to REG_SZ and
 * permanently break those references.
 *
 * @param {string} platform - os.platform() value
 * @returns {boolean} whether PATH was modified
 */
export function ensureBinOnPath(platform = os.platform()) {
  if (platform !== 'win32') return false;
  const bin = path.join(SWITCH_DIR, 'bin');
  const script = `
$bin = '${bin}'
$cur = [Environment]::GetEnvironmentVariable('Path','User')
if ($null -eq $cur) { $cur = '' }
if ($cur -match '%') { Write-Output 'skip:expandable'; exit 0 }
if (($cur -split ';') -contains $bin) { Write-Output 'skip:present'; exit 0 }
$next = if ($cur.Trim().Length) { $cur.TrimEnd(';') + ';' + $bin } else { $bin }
[Environment]::SetEnvironmentVariable('Path', $next, 'User')
Write-Output 'added'
`.trim();

  try {
    const out = String(
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf-8'
      })
    ).trim();
    if (out === 'added') {
      console.log(`Added ${bin} to your user PATH (new terminals only).`);
      return true;
    }
    if (out === 'skip:expandable') {
      console.warn(`Left PATH alone (it uses %VAR% references). Add ${bin} manually.`);
    }
    return false;
  } catch (err) {
    console.warn(`Could not update user PATH: ${err.message}`);
    return false;
  }
}

/**
 * The `switch` wrapper. Has to be a shell function, not a claude-acc
 * subcommand: unsetting CLAUDE_CONFIG_DIR must affect the calling shell.
 * @param {string} platform - os.platform() value
 * @returns {string} rc snippet, marker-delimited
 */
export function switchFunction(platform = os.platform()) {
  const bin = path.join(SWITCH_DIR, 'bin', platform === 'win32' ? 'claude-acc.exe' : 'claude-acc');
  const shareState = path.join(SWITCH_DIR, 'share-state.sh');
  const accountsDir = ACCOUNTS_DIR;

  const body = platform === 'win32'
    ? `# Load upstream's integration when the profile above has not already (it is
# written only into the PowerShell 7 profile, so Windows PowerShell 5.1 has
# none). This also puts ~/.claude-switch/bin on PATH for the session.
if (-not (Get-Command __claude_acc_activate -ErrorAction SilentlyContinue)) {
    $__acc_init = (& '${bin}' init pwsh) -join "\`n"
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        # LocationChangedAction is PowerShell 6+. Drop the activate-on-cd hook so
        # 5.1 does not throw on every shell start; \`switch\` still works, but a
        # bare \`cd\` into a linked directory will not auto-activate there.
        $__acc_init = [regex]::Replace(
            $__acc_init,
            '(?m)^\\$ExecutionContext\\.SessionState\\.InvokeCommand\\.LocationChangedAction\\s*=\\s*\\{[^}]*\\}\\s*$',
            '')
    }
    Invoke-Expression $__acc_init
    Remove-Variable __acc_init -ErrorAction SilentlyContinue
}

function claude-acc {
    if ($args[0] -eq 'switch') {
        if (-not $args[1]) { Write-Error 'usage: claude-acc switch <account>'; return }
        & '${bin}' default $args[1]
        if ($LASTEXITCODE -ne 0) { return }
        Remove-Item Env:CLAUDE_CONFIG_DIR -ErrorAction SilentlyContinue
        Remove-Item Env:__CLAUDE_ACC_PREV_DIR -ErrorAction SilentlyContinue
        # re-run upstream's activation so the flip lands in this shell, not on
        # next cd — \`switch\` never cds, so without this the shell keeps no
        # CLAUDE_CONFIG_DIR at all and silently falls back to ~/.claude.
        Invoke-Expression (& '${bin}' activate --shell powershell)
    } else {
        & '${bin}' @args
        # share-state.sh is POSIX sh — Windows accounts don't get auto-linked.
    }
}`
    : `claude-acc() {
    if [ "$1" = "switch" ]; then
        if [ -z "$2" ]; then
            echo "usage: claude-acc switch <account>" >&2
            return 1
        fi
        '${bin}' default "$2" || return 1
        unset CLAUDE_CONFIG_DIR __CLAUDE_ACC_PREV_DIR
        # re-run upstream's activation so the flip lands in this shell, not on next cd
        if type __claude_acc_activate >/dev/null 2>&1; then __claude_acc_activate; fi
    elif [ "$1" = "add" ]; then
        '${bin}' "$@" || return 1
        # new account won't share sessions/memory/statusbar with ~/.claude until linked
        if [ -x '${shareState}' ]; then
            '${shareState}' $(command ls '${accountsDir}' 2>/dev/null) >/dev/null
        fi
    else
        '${bin}' "$@"
    fi
}`;

  return `${BEGIN}\n# claude-acc switch <name> — flip account without needing a cd.\n${body}\n${END}`;
}

/**
 * Writes a marker-delimited block into a file, replacing any previous copy.
 * Idempotent, and picks up edits to the block across re-installs.
 * @param {string} file
 * @param {string} block - must start with BEGIN and end with END
 */
export async function upsertBlock(file, block) {
  let current = '';
  try {
    current = await fs.readFile(file, 'utf-8');
  } catch {
    // rc file does not exist yet — created below
  }

  const start = current.indexOf(BEGIN);
  const stop = current.indexOf(END);
  const next = start !== -1 && stop > start
    ? current.slice(0, start) + block + current.slice(stop + END.length)
    : `${current.replace(/\n*$/, '')}\n\n${block}\n`;

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, next);
}

/** Account names currently registered with claude-acc. */
export async function listAccounts() {
  try {
    const entries = await fs.readdir(ACCOUNTS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Installs share-state.sh and links every existing account's state to ~/.claude,
 * so sessions, memory, skills and settings follow you across accounts.
 * POSIX-only: the script is /bin/sh.
 */
export async function installShareState() {
  const dest = path.join(SWITCH_DIR, 'share-state.sh');
  await fs.mkdir(SWITCH_DIR, { recursive: true });
  await fs.copyFile(path.join(__dirname, '..', '..', 'scripts', 'share-state.sh'), dest);
  await fs.chmod(dest, 0o755);
  console.log(`Installed ${dest}`);

  if (os.platform() === 'win32') {
    console.log('Shared state: skipped (share-state.sh is POSIX sh).');
    return;
  }

  const accounts = await listAccounts();
  if (!accounts.length) {
    console.log('Shared state: no accounts yet — run it after `claude-acc add <name>`.');
    return;
  }
  execFileSync('/bin/sh', [dest, ...accounts], { stdio: 'inherit' });
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

  // Must come after upstream's install: the wrapper needs the binary in place,
  // and the rc block has to sit below the `claude-acc init` line it depends on.
  const block = switchFunction();
  for (const rc of rcPaths()) {
    await upsertBlock(rc, block);
    console.log(`Wired \`claude-acc switch\` into ${rc}`);
  }

  ensureBinOnPath();

  await installShareState();
  console.log('--- Account Switcher Complete (restart your shell) ---\n');
}

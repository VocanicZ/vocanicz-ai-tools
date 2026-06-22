import os from 'node:os';

/**
 * Returns the setup commands for the current OS.
 * @returns {string}
 */
export function getSetupCommand() {
  const isWindows = os.platform() === 'win32';
  
  if (isWindows) {
    return `
# Add this to your $PROFILE:
function claude-yolo {
    claude --dangerously-skip-permissions $args
}
function agy-yolo {
    agy --dangerously-skip-permissions $args
}
function yolo-command {
    if (Get-Command agy -ErrorAction SilentlyContinue) {
        agy --dangerously-skip-permissions $args
    } else {
        claude --dangerously-skip-permissions $args
    }
}
Set-Alias yolo yolo-command
Set-Alias agy-yolo agy-yolo
`.trim();
  } else {
    const shell = process.env.SHELL || '/bin/bash';
    const rcFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
    
    return `
# Add this to your ${rcFile}:
alias claude-yolo='claude --dangerously-skip-permissions'
alias agy-yolo='agy --dangerously-skip-permissions'
yolo() {
  if command -v agy >/dev/null 2>&1; then
    agy --dangerously-skip-permissions "$@"
  else
    claude --dangerously-skip-permissions "$@"
  fi
}
`.trim();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(getSetupCommand());
}

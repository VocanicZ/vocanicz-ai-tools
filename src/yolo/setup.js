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
Set-Alias yolo claude-yolo
`.trim();
  } else {
    const shell = process.env.SHELL || '/bin/bash';
    const rcFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
    
    return `
# Add this to your ${rcFile}:
alias yolo='claude --dangerously-skip-permissions'
`.trim();
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  console.log(getSetupCommand());
}

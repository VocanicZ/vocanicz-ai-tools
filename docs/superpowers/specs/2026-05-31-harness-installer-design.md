# Design Spec: Harness Installer for vocanicz-ai-tools

**Date**: 2026-05-31
**Topic**: Adding a cross-platform Harness engine installer to `vocanicz-ai-tools`.

## 1. Overview
Integrate the installation logic of the `VocanicZ/Harness` engine into the `vocanicz-ai-tools` package. This allows users to set up both the Claude Code status bar tools and the autonomous agent orchestrator with a single command.

## 2. Goals
- Provide a cross-platform (Node.js) implementation of the Harness `install.sh`.
- Automate the installation of system dependencies (Python, Git, GH CLI, Tmux).
- Provision the Harness engine, Claude plugins, and required skills.
- Integrate seamlessly into the existing `vocanicz-ai-tools --setup` flow.

## 3. Architecture

### 3.1 New Module: `src/modules/harness.js`
This module will manage the Harness-specific installation logic.

#### Key Functions:
- `installHarness()`: Main entry point.
- `ensureDependencies()`: Iterates through required tools and attempts auto-install via `scoop` (Windows), `brew` (macOS), or `apt`/`dnf` (Linux).
- `setupEngine()`: Clones/updates `VocanicZ/Harness` to `~/.harness/engine`.
- `setupClaudeIntegration()`: Installs Claude plugins (`superpowers`, `ralph-loop`) and skills (`to-prd`, `to-issues`).
- `createSymlink()`: Ensures the `harness` command is available globally.

### 3.2 Main Installer Integration: `src/install.js`
- Modify `install()` to call `installHarness()` after the base toolkit setup.
- Add error handling to ensure a Harness failure doesn't necessarily revert the base toolkit setup, but informs the user.

## 4. Platform-Specific Implementation

### 4.1 Dependency Management (Smart Check & Install)
| Dependency | Check Command | Install (Windows/Scoop) | Install (macOS/Brew) | Install (Linux/Apt) |
|------------|---------------|-------------------------|----------------------|---------------------|
| Git        | `git --version`| `scoop install git`     | `brew install git`   | `sudo apt install git`|
| Python3    | `python3 --version`| `scoop install python` | `brew install python`| `sudo apt install python3`|
| GH CLI     | `gh --version`| `scoop install gh`      | `brew install gh`    | `sudo apt install gh`|
| Tmux       | `tmux -V`     | (Manual/WSL Recommendation) | `brew install tmux` | `sudo apt install tmux`|
| Claude CLI | `claude --version`| `npm install -g @anthropic-ai/claude-code` | Same | Same |

### 4.2 Paths
- **Harness Engine**: `path.join(os.homedir(), '.harness', 'engine')`
- **Harness Binary**: 
  - *nix: `path.join(os.homedir(), '.local', 'bin', 'harness')` (Symlink to `engine/bin/harness`)
  - Windows: Create a `harness.cmd` in a directory already in PATH, or instructions for adding the engine bin to PATH.

## 5. Implementation Plan

1. **Step 1**: Create `src/modules/harness.js` with dependency check logic.
2. **Step 2**: Implement engine cloning and update logic.
3. **Step 3**: Implement Claude plugin and skill installation logic.
4. **Step 4**: Integrate `installHarness` into `src/install.js`.
5. **Step 5**: Add tests for the new installer logic (mocking shell commands).

## 6. Success Criteria
- Running `node src/install.js --setup` successfully installs/updates Harness.
- The `harness` command is available in the shell.
- Required Claude plugins and skills are present in the respective directories.
- Clear error messages if a dependency cannot be auto-installed.

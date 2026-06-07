# vocanicz-ai-tools

A unified, cross-platform toolkit for Claude Code and Gemini CLI, written in Node.js. Replaces legacy Bash scripts with high-performance, responsive modules that work on Windows, Linux, and macOS.

## Features

The installer is modular — pick which features to install (see [Selecting features](#selecting-features)). Available features:

| Feature | What it does |
|---------|--------------|
| **📊 Status Bar** | Claude Code status line: real-time token/context tracking, background-cached Anthropic usage limits (5h/7d), model-aware context limits (e.g. 1M for Claude 3.5 Sonnet), and a configurable `[Graphify]` indicator. |
| **⚡ YOLO Mode** | `yolo` / `claude --yolo` shell alias that skips permission prompts. Injected into your profile (`.zshrc`, `.bashrc`, or PowerShell `$PROFILE`). |
| **🔧 Harness Engine** | Clones the [Harness](https://github.com/VocanicZ/Harness) repo, checks/auto-installs deps (`git`, `python3`, `gh`, `claude`, `tmux`), and links the `harness` CLI onto your `PATH`. |
| **🧩 Claude Integration** | Installs Claude plugins and external/internal skills (e.g. `to-prd`, `to-issues`, and bundled Harness skills). |

Plus a **🚀 Universal Installer** with one-line setup for Windows (PowerShell) and Linux/macOS (Bash/Zsh).

### Status Bar detail

- **Token Tracking**: Real-time context window monitoring.
- **Usage Limits**: Background-cached Anthropic usage tracking (5h, 7d).
- **Model Awareness**: Automatically adjusts limits for Claude 3.5 Sonnet (1M) and other models.
- **Graphify Integration**: Detects graphify usage and missing indices. The `[Graphify]` indicator is configurable (see [Configuration](#configuration)).

## Configuration

Settings live in `~/.vocanicz-ai-tools/config.json` (created on install):

```json
{
  "graphify": "auto"
}
```

**`graphify`** — controls the `[Graphify]` status indicator:

| Value    | Behavior                                                        |
|----------|----------------------------------------------------------------|
| `"auto"` | (default) Show only when graphify is detected (`graphify-out/` exists + transcript mentions graphify). |
| `"off"`  | Never show the indicator.                                       |
| `"on"`   | Always show the indicator.                                      |

## Installation

Run this single command in your terminal:

```bash
npx github:VocanicZ/vocanicz-ai-tools --setup
```

### Selecting features

When run in a terminal, the installer prompts you to choose which features to install (`Y/n` per feature). For non-interactive use (CI, piped installs), select via flags instead:

```bash
# Disable specific features (everything else is installed)
npx github:VocanicZ/vocanicz-ai-tools --setup --no-harness --no-claude

# Install only the listed features
npx github:VocanicZ/vocanicz-ai-tools --setup --only=statusbar,yolo
```

Feature ids: `statusbar`, `yolo`, `harness`, `claude`. With no flags and no terminal (non-interactive), all features install by default.

## How it Works

1. **Installer**: Clones the tools to `~/.vocanicz-ai-tools` and updates your `~/.claude/settings.json`.
2. **Status Line**: Claude Code executes `node main.js`, which aggregates data from the context and usage modules.
3. **YOLO Alias**: Injects a shell function into your profile (`.zshrc`, `.bashrc`, or PowerShell `$PROFILE`).

## Development

### Running Tests
```bash
npm test
```

### Manual Run
```bash
cat test/mock-stdin.json | node src/main.js
```

## License
MIT

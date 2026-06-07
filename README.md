# vocanicz-ai-tools

A unified, cross-platform toolkit for Claude Code and Gemini CLI, written in Node.js. Replaces legacy Bash scripts with high-performance, responsive modules that work on Windows, Linux, and macOS.

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

## Features

The installer is modular — pick which features to install (see [Selecting features](#selecting-features)). Available features:

| Feature | What it does |
|---------|--------------|
| **📊 Status Bar** | Claude Code status line: real-time token/context tracking, background-cached Anthropic usage limits (5h/7d), model-aware context limits (1M for Claude 4.x Opus/Sonnet), and a configurable `[Graphify]` indicator. |
| **⚡ YOLO Mode** | `yolo` / `claude --yolo` shell alias that skips permission prompts. Injected into your profile (`.zshrc`, `.bashrc`, or PowerShell `$PROFILE`). |
| **🔧 Harness Engine** | Clones the [Harness](https://github.com/VocanicZ/Harness) repo, checks/auto-installs deps (`git`, `python3`, `gh`, `claude`, `tmux`), and links the `harness` CLI onto your `PATH`. |
| **🧩 Claude Integration** | Installs Claude plugins and external/internal skills (e.g. `to-prd`, `to-issues`, and bundled Harness skills). |

Plus a **🚀 Universal Installer** with one-line setup for Windows (PowerShell) and Linux/macOS (Bash/Zsh).

### Status Bar detail

- **Token Tracking**: Real-time context window monitoring.
- **Usage Limits**: Background-cached Anthropic usage tracking (5h, 7d).
- **Model Awareness**: Resolves the max context window from the model (1M for Claude 4.x Opus/Sonnet), overridable via `contextLimit`.
- **Graphify Integration**: Detects graphify usage and missing indices. The `[Graphify]` indicator is configurable.
- **Segment toggles**: Show/hide each segment of the bar independently.

## Configuration

Settings live in `~/.vocanicz-ai-tools/config.json` (created on install). Full schema with defaults:

```json
{
  "graphify": "auto",
  "contextLimit": "auto",
  "autoUpdate": false,
  "reserve": 20,
  "segments": {
    "context": true,
    "messages": true,
    "usage": true,
    "graphify": true
  }
}
```

| Key | Values | Behavior |
|-----|--------|----------|
| `graphify` | `"auto"` / `"off"` / `"on"` | `"auto"` (default) shows `[Graphify]` only when detected (`graphify-out/` exists + transcript mentions graphify); `"off"` never; `"on"` always. |
| `contextLimit` | `"auto"` or a number | `"auto"` (default) maps the model to its context window (1M for Claude 4.x Opus/Sonnet, else 200k). Set a number (e.g. `1000000`) to force a specific max. |
| `autoUpdate` | `true` / `false` | When `true`, the status bar triggers a throttled (once/day), detached background refresh of the toolkit. Default `false`. |
| `reserve` | number | Columns reserved on the right for Claude Code's own indicators. Default `20`. |
| `segments.context` | `true` / `false` | Show the `[N% ctx]` segment. |
| `segments.messages` | `true` / `false` | Show the `[N msg]` segment. |
| `segments.usage` | `true` / `false` | Show the right-side `[$ rem]` usage segment (also skips the usage fetch when off). |
| `segments.graphify` | `true` / `false` | Show the `[Graphify]` segment (combined with the `graphify` mode above). |

## How it Works

1. **Installer**: Copies the tools to `~/.vocanicz-ai-tools` and (for the Status Bar) updates your `~/.claude/settings.json`.
2. **Status Line**: Claude Code executes `node main.js`, which aggregates data from the context and usage modules.
3. **YOLO Alias**: Injects a shell function into your profile (`.zshrc`, `.bashrc`, or PowerShell `$PROFILE`).

## Development

### Running Tests
```bash
npm test
```

### Manual Run
```bash
echo '{"model":{"id":"claude-opus-4-8"},"transcript":{"usage":{"input_tokens":69000}},"cwd":"/tmp"}' | node src/main.js
```

## License
MIT

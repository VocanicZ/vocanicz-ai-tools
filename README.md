# vocanicz-ai-tools

A unified, cross-platform toolkit for Claude Code and Gemini CLI, written in Node.js. Replaces legacy Bash scripts with high-performance, responsive modules that work on Windows, Linux, and macOS.

## Features

- **🚀 Universal Installer**: One-line setup for Windows (PowerShell) and Linux/macOS (Bash/Zsh).
- **📊 Modular Status Bar**:
  - **Token Tracking**: Real-time context window monitoring.
  - **Usage Limits**: Background-cached Anthropic usage tracking (5h, 7d).
  - **Model Awareness**: Automatically adjusts limits for Claude 3.5 Sonnet (1M) and other models.
  - **Graphify Integration**: Detects graphify usage and missing indices. The `[Graphify]` indicator is configurable (see Configuration).
- **⚡ YOLO Mode**: Simple `claude --yolo` alias to skip permission prompts safely.

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

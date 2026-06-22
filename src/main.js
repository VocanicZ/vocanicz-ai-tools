#!/usr/bin/env node
import {
  readTranscriptTotal,
  messagesFromTotal,
  detectGraphify,
  getContextLimit,
  renderContext
} from './modules/context.js';
import { getUsage, renderUsage, renderAntigravityUsage } from './modules/usage.js';
import { compose } from './modules/composer.js';
import { loadConfig, shouldShowGraphify } from './modules/config.js';
import { maybeAutoUpdate } from './modules/autoupdate.js';

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input) {
    return;
  }

  try {
    const data = JSON.parse(input);
    const model = data.model;
    // Claude Code sends a transcript_path (file); resolve cwd from workspace too.
    const transcriptPath = data.transcript_path || data.transcript;
    const cwd = (data.workspace && data.workspace.current_dir) || data.cwd || process.cwd();
    const isAntigravity = data.product === 'antigravity';

    const config = loadConfig();
    const seg = config.segments;

    // ---- Context tokens -----------------------------------------------------
    let total = 0;
    let messages = 0;
    let limit = 200000;

    if (data.context_window) {
      // Antigravity / hosts that pass the window inline.
      const cw = data.context_window;
      const usage = cw.current_usage || {};
      total = (usage.input_tokens || 0) +
              (usage.cache_creation_input_tokens || 0) +
              (usage.cache_read_input_tokens || 0);
      limit = cw.context_window_size || getContextLimit(model, config.contextLimit);
      messages = messagesFromTotal(total);
    } else {
      // Claude Code: read the latest usage block out of the transcript file.
      const tokens = readTranscriptTotal(transcriptPath);
      total = tokens.total;
      messages = tokens.messages;
      limit = getContextLimit(model, config.contextLimit);
    }

    // ---- Left part: [Graphify] + /context-style bar -------------------------
    const isGraphify = detectGraphify(transcriptPath, cwd);
    const showGraphify = seg.graphify && shouldShowGraphify(config.graphify, isGraphify);

    let left = '';
    if (showGraphify) left += '[Graphify] ';
    if (seg.context) {
      left += renderContext({
        total,
        messages,
        limit,
        includeMessages: seg.messages !== false
      });
    }

    // ---- Right part: usage meters (Claude 5h/7d, or Antigravity quotas) -----
    let right = '';
    if (seg.usage) {
      if (isAntigravity && data.quota) {
        right = renderAntigravityUsage(data.quota);
      } else if (!isAntigravity) {
        const usage = await getUsage();
        right = renderUsage(usage);
      }
    }

    console.log(compose(left, right, { reserve: config.reserve }));

    // Fire-and-forget background refresh (throttled, no-op unless enabled)
    maybeAutoUpdate(config);
  } catch (err) {
    // Silent error for status line
  }
}

main();

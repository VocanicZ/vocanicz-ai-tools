#!/usr/bin/env node
import { parseTokens, detectGraphify, getContextLimit } from './modules/context.js';
import { getUsage } from './modules/usage.js';
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
    const { transcript, model, cwd } = data;

    const config = loadConfig();
    const seg = config.segments;

    let total = 0;
    let messages = 0;
    let limit = 200000;

    if (data.context_window) {
      const cw = data.context_window;
      const usage = cw.current_usage || {};
      total = (usage.input_tokens || 0) + 
              (usage.cache_creation_input_tokens || 0) + 
              (usage.cache_read_input_tokens || 0);
      limit = cw.context_window_size || 1000000;
      
      const SYS_PROMPT = 8800;
      const SYS_TOOLS = 11800;
      const AGENTS = 700;
      const MEMORY = 100;
      const SKILLS = 3600;
      const fixed = SYS_PROMPT + SYS_TOOLS + AGENTS + MEMORY + SKILLS;
      messages = Math.max(0, total - fixed);
    } else {
      const tokens = parseTokens(transcript);
      total = tokens.total;
      messages = tokens.messages;
      limit = getContextLimit(model, config.contextLimit);
    }

    const isGraphify = detectGraphify(transcript, cwd || process.cwd());
    const showGraphify = seg.graphify && shouldShowGraphify(config.graphify, isGraphify);

    const contextPercent = Math.round((total / limit) * 100);

    let usage = null;
    if (seg.usage) {
      if (data.product === 'antigravity' && data.quota) {
        let lowestFraction = 1.0;
        let quotaName = '';
        for (const [key, q] of Object.entries(data.quota)) {
          if (q && typeof q.remaining_fraction === 'number') {
            if (q.remaining_fraction < lowestFraction) {
              lowestFraction = q.remaining_fraction;
              quotaName = key;
            }
          }
        }
        usage = {
          isAntigravity: true,
          remaining_fraction: lowestFraction,
          quota_name: quotaName
        };
      } else {
        usage = await getUsage();
      }
    }

    const parts = [];
    if (seg.context) parts.push(`[${contextPercent}% ctx]`);
    if (seg.messages) parts.push(`[${messages} msg]`);
    if (showGraphify) parts.push('[Graphify]');
    const left = parts.join(' ');

    let right = '';
    if (usage) {
      if (usage.isAntigravity) {
        right = `[${Math.round(usage.remaining_fraction * 100)}% quota]`;
      } else if (usage.monthly_limit !== undefined) {
        const remaining = usage.monthly_limit - (usage.monthly_usage || 0);
        right = `[$${(remaining).toFixed(2)} rem]`;
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

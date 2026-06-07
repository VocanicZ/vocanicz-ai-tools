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

    const { total, messages } = parseTokens(transcript);
    const isGraphify = detectGraphify(transcript, cwd || process.cwd());
    const showGraphify = seg.graphify && shouldShowGraphify(config.graphify, isGraphify);

    const limit = getContextLimit(model, config.contextLimit);
    const contextPercent = Math.round((total / limit) * 100);

    const usage = seg.usage ? await getUsage() : null;

    const parts = [];
    if (seg.context) parts.push(`[${contextPercent}% ctx]`);
    if (seg.messages) parts.push(`[${messages} msg]`);
    if (showGraphify) parts.push('[Graphify]');
    const left = parts.join(' ');

    let right = '';
    if (usage && usage.monthly_limit !== undefined) {
      const remaining = usage.monthly_limit - (usage.monthly_usage || 0);
      right = `[$${(remaining).toFixed(2)} rem]`;
    }

    console.log(compose(left, right, { reserve: config.reserve }));

    // Fire-and-forget background refresh (throttled, no-op unless enabled)
    maybeAutoUpdate(config);
  } catch (err) {
    // Silent error for status line
  }
}

main();

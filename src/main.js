#!/usr/bin/env node
import { parseTokens, detectGraphify } from './modules/context.js';
import { getUsage } from './modules/usage.js';
import { compose } from './modules/composer.js';

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

    const { total, messages } = parseTokens(transcript);
    const isGraphify = detectGraphify(transcript, cwd || process.cwd());
    const usage = await getUsage();

    const limit = model?.toLowerCase().includes('sonnet') ? 1000000 : 200000;
    const contextPercent = Math.round((total / limit) * 100);

    const left = `[${contextPercent}% ctx] [${messages} msg]${isGraphify ? ' [Graphify]' : ''}`;
    
    let right = '';
    if (usage && usage.monthly_limit !== undefined) {
      const remaining = usage.monthly_limit - (usage.monthly_usage || 0);
      right = `[$${(remaining).toFixed(2)} rem]`;
    }

    console.log(compose(left, right));
  } catch (err) {
    // Silent error for status line
  }
}

main();

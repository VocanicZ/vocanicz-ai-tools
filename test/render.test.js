import { describe, it, expect } from 'vitest';
import {
  renderContext,
  renderContextBar,
  readTranscriptTotal,
  messagesFromTotal,
  sumUsage,
  FIXED_OVERHEAD
} from '../src/modules/context.js';
import { meter, renderUsage, renderAntigravityUsage, countdown } from '../src/modules/usage.js';
import { stripAnsi } from '../src/modules/composer.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('context rendering', () => {
  it('sumUsage adds the three token fields', () => {
    expect(sumUsage({ input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3 })).toBe(6);
    expect(sumUsage(null)).toBe(0);
  });

  it('messagesFromTotal floors at 0 and subtracts fixed overhead', () => {
    expect(messagesFromTotal(FIXED_OVERHEAD + 5000)).toBe(5000);
    expect(messagesFromTotal(100)).toBe(0);
  });

  it('renderContextBar produces exactly N blocks', () => {
    const bar = stripAnsi(renderContextBar(50000, 25000, 150000, 20)).trim();
    // each block is one glyph; count non-space chars
    const glyphs = bar.replace(/\s/g, '').length;
    expect(glyphs).toBe(20);
  });

  it('renderContext shows k tokens and both percentages', () => {
    const out = stripAnsi(renderContext({ total: 50000, messages: 25000, limit: 1000000 }));
    expect(out).toContain('50k');
    // maxBar default min(150k, 1M) = 150k -> 33%; actual 1M -> 5%
    expect(out).toContain('(33%|5%)');
  });

  it('renderContext clamps maxBar to the actual limit', () => {
    const out = stripAnsi(renderContext({ total: 100000, messages: 50000, limit: 120000 }));
    // bound clamped to 120k -> both percentages equal
    expect(out).toContain('(83%|83%)');
  });

  it('readTranscriptTotal reads the last usage line of a JSONL file', () => {
    const tmp = path.join(os.tmpdir(), `vat-test-${process.pid}.jsonl`);
    fs.writeFileSync(tmp, [
      JSON.stringify({ message: { usage: { input_tokens: 10, cache_read_input_tokens: 10 } } }),
      JSON.stringify({ type: 'noise' }),
      JSON.stringify({ message: { usage: { input_tokens: 30000, cache_read_input_tokens: 0 } } })
    ].join('\n'));
    const { total, messages } = readTranscriptTotal(tmp);
    expect(total).toBe(30000);
    expect(messages).toBe(messagesFromTotal(30000));
    fs.unlinkSync(tmp);
  });

  it('readTranscriptTotal returns zero for a missing file', () => {
    expect(readTranscriptTotal('/no/such/file.jsonl')).toEqual({ total: 0, messages: 0 });
  });
});

describe('usage rendering', () => {
  it('meter renders label, bar of len glyphs, and percent', () => {
    const out = stripAnsi(meter('5h', 50, { len: 8, color: false }));
    expect(out).toBe('5h ▊▊▊▊░░░░ 50%');
  });

  it('meter caps fill at the bar length', () => {
    const out = stripAnsi(meter('7d', 100, { len: 4, color: false }));
    expect(out).toBe('7d ▊▊▊▊ 100%');
  });

  it('renderUsage emits a meter per present window', () => {
    const out = stripAnsi(renderUsage({
      five_hour: { utilization: 26 },
      seven_day: { utilization: 3 }
    }, { color: false }));
    expect(out).toContain('5h ');
    expect(out).toContain('26%');
    expect(out).toContain('7d ');
    expect(out).toContain('3%');
  });

  it('renderUsage returns empty string for no data', () => {
    expect(renderUsage(null)).toBe('');
    expect(renderUsage({})).toBe('');
  });

  it('renderAntigravityUsage maps remaining_fraction to utilization', () => {
    const out = stripAnsi(renderAntigravityUsage({
      five_hour: { remaining_fraction: 0.75 }
    }, { color: false }));
    // 1 - 0.75 = 0.25 -> 25%
    expect(out).toContain('5h ');
    expect(out).toContain('25%');
  });

  it('countdown formats days/hours/minutes', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(countdown('2026-01-03T00:00:00Z', now)).toBe('2d');
    expect(countdown('2026-01-01T05:00:00Z', now)).toBe('5h');
    expect(countdown('2026-01-01T00:30:00Z', now)).toBe('30m');
    expect(countdown(null, now)).toBe('');
  });
});

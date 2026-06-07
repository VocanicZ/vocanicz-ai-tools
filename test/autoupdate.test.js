import { describe, it, expect } from 'vitest';
import { shouldUpdate, UPDATE_INTERVAL_MS } from '../src/modules/autoupdate.js';

describe('autoupdate module', () => {
  describe('shouldUpdate', () => {
    const now = 1_000_000_000_000;

    it('false when autoUpdate disabled', () => {
      expect(shouldUpdate({ autoUpdate: false }, 0, now)).toBe(false);
    });

    it('false when config missing', () => {
      expect(shouldUpdate(null, 0, now)).toBe(false);
    });

    it('true when enabled and never updated', () => {
      expect(shouldUpdate({ autoUpdate: true }, 0, now)).toBe(true);
    });

    it('false when within throttle window', () => {
      const last = now - (UPDATE_INTERVAL_MS - 1000);
      expect(shouldUpdate({ autoUpdate: true }, last, now)).toBe(false);
    });

    it('true when throttle window elapsed', () => {
      const last = now - UPDATE_INTERVAL_MS - 1;
      expect(shouldUpdate({ autoUpdate: true }, last, now)).toBe(true);
    });
  });
});

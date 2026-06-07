import { describe, it, expect } from 'vitest';
import {
  parseFeatureFlags,
  resolveFeatures,
  allEnabled,
  FEATURE_IDS
} from '../src/modules/features.js';

describe('features module', () => {
  describe('parseFeatureFlags', () => {
    it('returns null selection when no flags', () => {
      const { selection, hasFlags } = parseFeatureFlags(['--setup']);
      expect(selection).toBeNull();
      expect(hasFlags).toBe(false);
    });

    it('--no-<id> disables that feature, others stay enabled', () => {
      const { selection, hasFlags } = parseFeatureFlags(['--setup', '--no-yolo']);
      expect(hasFlags).toBe(true);
      expect(selection.yolo).toBe(false);
      expect(selection.statusbar).toBe(true);
      expect(selection.harness).toBe(true);
      expect(selection.claude).toBe(true);
    });

    it('multiple --no flags', () => {
      const { selection } = parseFeatureFlags(['--no-harness', '--no-claude']);
      expect(selection.harness).toBe(false);
      expect(selection.claude).toBe(false);
      expect(selection.statusbar).toBe(true);
    });

    it('--only enables only listed', () => {
      const { selection, hasFlags } = parseFeatureFlags(['--only=statusbar,yolo']);
      expect(hasFlags).toBe(true);
      expect(selection.statusbar).toBe(true);
      expect(selection.yolo).toBe(true);
      expect(selection.harness).toBe(false);
      expect(selection.claude).toBe(false);
    });

    it('--features is an alias for --only', () => {
      const { selection } = parseFeatureFlags(['--features=harness']);
      expect(selection.harness).toBe(true);
      expect(selection.statusbar).toBe(false);
    });

    it('ignores unknown ids in --no', () => {
      const { selection } = parseFeatureFlags(['--no-bogus']);
      expect(selection).toEqual(allEnabled());
    });
  });

  describe('allEnabled', () => {
    it('has every feature id set true', () => {
      const sel = allEnabled();
      for (const id of FEATURE_IDS) expect(sel[id]).toBe(true);
    });
  });

  describe('resolveFeatures', () => {
    it('flags win over prompt/default', async () => {
      const sel = await resolveFeatures({
        argv: ['--no-yolo'],
        isInteractive: true,
        prompt: async () => ({ everything: 'wrong' })
      });
      expect(sel.yolo).toBe(false);
    });

    it('non-interactive with no flags defaults to all', async () => {
      const sel = await resolveFeatures({ argv: [], isInteractive: false });
      expect(sel).toEqual(allEnabled());
    });

    it('interactive with no flags calls prompt', async () => {
      const sel = await resolveFeatures({
        argv: [],
        isInteractive: true,
        prompt: async () => ({ statusbar: true, yolo: false, harness: false, claude: false })
      });
      expect(sel).toEqual({ statusbar: true, yolo: false, harness: false, claude: false });
    });
  });
});

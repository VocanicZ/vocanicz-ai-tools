import { describe, it, expect } from 'vitest';
import { compose, stripAnsi } from '../src/modules/composer.js';

describe('composer module', () => {
  describe('stripAnsi', () => {
    it('should strip standard color codes', () => {
      const input = '\x1b[31mHello\x1b[0m \x1b[32mWorld\x1b[0m';
      expect(stripAnsi(input)).toBe('Hello World');
    });

    it('should strip complex ANSI codes', () => {
      const input = '\x1b[38;5;208mColored\x1b[0m \x1b[1mBold\x1b[0m';
      expect(stripAnsi(input)).toBe('Colored Bold');
    });

    it('should return plain string as is', () => {
      const input = 'Plain String';
      expect(stripAnsi(input)).toBe('Plain String');
    });
  });

  describe('compose', () => {
    it('should align left and right with padding', () => {
      const left = 'Left';
      const right = 'Right';
      const width = 20;
      const reserve = 0;
      const result = compose(left, right, { width, reserve });
      
      // Effective width 20. Left(4) + Padding(12) + Right(5) = 21? 
      // Wait, 4 + 5 = 9. 20 - 9 = 11. 
      // Left(4) + Padding(11) + Right(5) = 20.
      expect(stripAnsi(result).length).toBe(20);
      expect(result).toBe('Left           Right');
    });

    it('should use default reserve of 20', () => {
      const left = 'L';
      const right = 'R';
      const width = 40;
      const result = compose(left, right, { width });
      
      // Effective width = 40 - 20 = 20.
      // Left(1) + Padding(18) + Right(1) = 20.
      expect(stripAnsi(result).length).toBe(20);
      expect(result).toBe('L' + ' '.repeat(18) + 'R');
    });

    it('should handle ANSI colors in length calculation', () => {
      const left = '\x1b[31mRed\x1b[0m';
      const right = '\x1b[32mGreen\x1b[0m';
      const width = 30;
      const reserve = 10;
      const result = compose(left, right, { width, reserve });
      
      // Effective width = 30 - 10 = 20.
      // Visible Left(3) + Right(5) = 8.
      // Padding = 20 - 8 = 12.
      expect(stripAnsi(result).length).toBe(20);
      expect(stripAnsi(result)).toBe('Red' + ' '.repeat(12) + 'Green');
    });

    it('should ensure at least 1 space padding when content exceeds width', () => {
      const left = 'Very long left side content';
      const right = 'Very long right side content';
      const width = 20;
      const reserve = 0;
      const result = compose(left, right, { width, reserve });
      
      expect(stripAnsi(result).length).toBe(left.length + 1 + right.length);
      expect(result).toBe(left + ' ' + right);
    });
  });
});

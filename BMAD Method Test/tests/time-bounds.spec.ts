import { describe, it, expect } from 'vitest';
import { getLastQuarterBoundsUTC, getCurrentQuarterBoundsUTC, parseTimeExpression } from '../src/utils/time-bounds';

describe('time-bounds', () => {
  describe('getLastQuarterBoundsUTC', () => {
    it('should return correct bounds for Q1 when current is Q2', () => {
      // May 15, 2025 (Q2)
      const referenceDate = new Date('2025-05-15T10:00:00Z');
      const result = getLastQuarterBoundsUTC(referenceDate);
      
      expect(result.start).toBe('2025-01-01');
      expect(result.end).toBe('2025-03-31');
      expect(result.period).toBe('2025 Q1');
    });

    it('should return Q4 of previous year when current is Q1', () => {
      // January 15, 2025 (Q1)
      const referenceDate = new Date('2025-01-15T10:00:00Z');
      const result = getLastQuarterBoundsUTC(referenceDate);
      
      expect(result.start).toBe('2024-10-01');
      expect(result.end).toBe('2024-12-31');
      expect(result.period).toBe('2024 Q4');
    });

    it('should handle Q3 to Q2 transition', () => {
      // September 27, 2025 (Q3)
      const referenceDate = new Date('2025-09-27T15:00:00Z');
      const result = getLastQuarterBoundsUTC(referenceDate);
      
      expect(result.start).toBe('2025-04-01');
      expect(result.end).toBe('2025-06-30');
      expect(result.period).toBe('2025 Q2');
    });

    it('should handle Q4 to Q3 transition', () => {
      // December 15, 2025 (Q4)
      const referenceDate = new Date('2025-12-15T10:00:00Z');
      const result = getLastQuarterBoundsUTC(referenceDate);
      
      expect(result.start).toBe('2025-07-01');
      expect(result.end).toBe('2025-09-30');
      expect(result.period).toBe('2025 Q3');
    });
  });

  describe('getCurrentQuarterBoundsUTC', () => {
    it('should return correct bounds for Q3', () => {
      // September 27, 2025 (Q3)
      const referenceDate = new Date('2025-09-27T15:00:00Z');
      const result = getCurrentQuarterBoundsUTC(referenceDate);
      
      expect(result.start).toBe('2025-07-01');
      expect(result.end).toBe('2025-09-30');
      expect(result.period).toBe('2025 Q3');
    });

    it('should return correct bounds for Q1', () => {
      // February 15, 2025 (Q1)
      const referenceDate = new Date('2025-02-15T10:00:00Z');
      const result = getCurrentQuarterBoundsUTC(referenceDate);
      
      expect(result.start).toBe('2025-01-01');
      expect(result.end).toBe('2025-03-31');
      expect(result.period).toBe('2025 Q1');
    });
  });

  describe('parseTimeExpression', () => {
    it('should parse "last quarter" expression', () => {
      const referenceDate = new Date('2025-09-27T15:00:00Z'); // Q3
      const result = parseTimeExpression('Top 5 cities by total order revenue last quarter', referenceDate);
      
      expect(result).not.toBeNull();
      expect(result!.start).toBe('2025-04-01');
      expect(result!.end).toBe('2025-06-30');
      expect(result!.period).toBe('2025 Q2');
    });

    it('should parse "this quarter" expression', () => {
      const referenceDate = new Date('2025-09-27T15:00:00Z'); // Q3
      const result = parseTimeExpression('Sales this quarter', referenceDate);
      
      expect(result).not.toBeNull();
      expect(result!.start).toBe('2025-07-01');
      expect(result!.end).toBe('2025-09-30');
      expect(result!.period).toBe('2025 Q3');
    });

    it('should parse year expressions', () => {
      const result = parseTimeExpression('Orders in 2024');
      
      expect(result).not.toBeNull();
      expect(result!.start).toBe('2024-01-01');
      expect(result!.end).toBe('2024-12-31');
      expect(result!.period).toBe('Year 2024');
    });

    it('should parse "last N days" expressions', () => {
      const referenceDate = new Date('2025-09-27T15:00:00Z');
      const result = parseTimeExpression('Orders last 30 days', referenceDate);
      
      expect(result).not.toBeNull();
      expect(result!.start).toBe('2025-08-29'); // 30 days back including today
      expect(result!.end).toBe('2025-09-27');
      expect(result!.period).toBe('Last 30 days');
    });

    it('should return null for unrecognized expressions', () => {
      const result = parseTimeExpression('Some random text');
      expect(result).toBeNull();
    });

    it('should handle case insensitive matching', () => {
      const referenceDate = new Date('2025-09-27T15:00:00Z');
      const result = parseTimeExpression('LAST QUARTER revenue', referenceDate);
      
      expect(result).not.toBeNull();
      expect(result!.period).toBe('2025 Q2');
    });
  });
});

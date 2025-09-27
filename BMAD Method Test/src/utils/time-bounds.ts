/**
 * Utilities for computing time bounds for relative time queries
 */

export interface TimePeriod {
  start: string; // YYYY-MM-DD format
  end: string;   // YYYY-MM-DD format
  period: string; // Human readable description
}

/**
 * Get the bounds for the last quarter (UTC)
 * @param referenceDate The date to calculate from (defaults to now)
 * @returns TimePeriod with start/end dates and period description
 */
export function getLastQuarterBoundsUTC(referenceDate: Date = new Date()): TimePeriod {
  const month = referenceDate.getUTCMonth(); // 0..11
  const year = referenceDate.getUTCFullYear();
  const currentQuarter = Math.floor(month / 3) + 1; // 1..4
  
  let lastQuarter = currentQuarter - 1;
  let targetYear = year;
  
  if (lastQuarter < 1) {
    lastQuarter = 4;
    targetYear = year - 1;
  }
  
  const startMonth = (lastQuarter - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(targetYear, startMonth, 1));
  
  // End = last day of quarter (inclusive)
  const nextQuarterStart = new Date(Date.UTC(targetYear, startMonth + 3, 1));
  const end = new Date(nextQuarterStart.getTime() - 24 * 60 * 60 * 1000);
  
  return {
    start: start.toISOString().split('T')[0]!,
    end: end.toISOString().split('T')[0]!,
    period: `${targetYear} Q${lastQuarter}`
  };
}

/**
 * Get the bounds for the current quarter (UTC)
 * @param referenceDate The date to calculate from (defaults to now)
 * @returns TimePeriod with start/end dates and period description
 */
export function getCurrentQuarterBoundsUTC(referenceDate: Date = new Date()): TimePeriod {
  const month = referenceDate.getUTCMonth(); // 0..11
  const year = referenceDate.getUTCFullYear();
  const currentQuarter = Math.floor(month / 3) + 1; // 1..4
  
  const startMonth = (currentQuarter - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(year, startMonth, 1));
  
  // End = last day of quarter (inclusive)
  const nextQuarterStart = new Date(Date.UTC(year, startMonth + 3, 1));
  const end = new Date(nextQuarterStart.getTime() - 24 * 60 * 60 * 1000);
  
  return {
    start: start.toISOString().split('T')[0]!,
    end: end.toISOString().split('T')[0]!,
    period: `${year} Q${currentQuarter}`
  };
}

/**
 * Get bounds for last N days (UTC)
 * @param days Number of days back to include (inclusive)
 * @param referenceDate The date to calculate from (defaults to now)
 * @returns TimePeriod with start/end dates
 */
export function getLastNDaysBoundsUTC(days: number, referenceDate: Date = new Date()): TimePeriod {
  const end = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  ));
  
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  
  return {
    start: start.toISOString().split('T')[0]!,
    end: end.toISOString().split('T')[0]!,
    period: `Last ${days} days`
  };
}

/**
 * Parse natural language time expressions and return appropriate bounds
 * @param timeExpression Natural language time expression
 * @param referenceDate Reference date for calculations
 * @returns TimePeriod or null if expression not recognized
 */
export function parseTimeExpression(timeExpression: string, referenceDate: Date = new Date()): TimePeriod | null {
  const expr = timeExpression.toLowerCase().trim();
  
  if (expr.includes('last quarter')) {
    return getLastQuarterBoundsUTC(referenceDate);
  }
  
  if (expr.includes('current quarter') || expr.includes('this quarter')) {
    return getCurrentQuarterBoundsUTC(referenceDate);
  }
  
  // Match "last N days"
  const lastDaysMatch = expr.match(/last (\d+) days?/);
  if (lastDaysMatch && lastDaysMatch[1]) {
    const days = parseInt(lastDaysMatch[1], 10);
    return getLastNDaysBoundsUTC(days, referenceDate);
  }
  
  // Match specific years like "2024"
  const yearMatch = expr.match(/\b(20\d{2})\b/);
  if (yearMatch && yearMatch[1]) {
    const year = parseInt(yearMatch[1], 10);
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      period: `Year ${year}`
    };
  }
  
  return null;
}

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { subDays, startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';
import { config } from '../config/env.js';

const TZ = config.timezone;

/**
 * Get date range for daily job (previous day in JST)
 * @param {string} testDate - Optional test date in yyyy-MM-dd format (for testing)
 * @returns {Object} { startDate, endDate, dateStr }
 */
export function getDailyDateRange(testDate = null) {
  let targetDate;
  
  if (testDate) {
    // Test mode: use specified date
    targetDate = toZonedTime(new Date(testDate + 'T12:00:00+09:00'), TZ);
  } else {
    // Production mode: use previous day
    const now = toZonedTime(new Date(), TZ);
    targetDate = subDays(now, 1);
  }
  
  const dateStr = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');
  
  // CRITICAL: Use UTC time to avoid timezone issues
  // Start: target day 00:00:00 JST = previous day 15:00:00 UTC
  // End: target day 23:59:59 JST = target day 14:59:59 UTC
  const startDate = new Date(dateStr + 'T00:00:00+09:00');
  const endDate = new Date(dateStr + 'T23:59:59+09:00');
  
  console.log('=== Date Range Calculation ===');
  console.log('Target date (JST):', dateStr);
  console.log('Start (UTC):', startDate.toISOString());
  console.log('End (UTC):', endDate.toISOString());
  console.log('Start (JST):', formatInTimeZone(startDate, TZ, 'yyyy-MM-dd HH:mm:ss zzz'));
  console.log('End (JST):', formatInTimeZone(endDate, TZ, 'yyyy-MM-dd HH:mm:ss zzz'));
  
  return { startDate, endDate, dateStr };
}

/**
 * Get date range for weekly job (previous week Mon-Sun in JST)
 * @returns {Object} { startDate, endDate, weekStartStr, weekEndStr }
 */
export function getWeeklyDateRange() {
  const now = toZonedTime(new Date(), TZ);
  
  // Get start of current week (Monday)
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  
  // Previous week = current week start - 7 days
  const prevWeekStart = subWeeks(currentWeekStart, 1);
  const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
  
  // Start: previous Monday 00:00:00 JST
  const startDate = new Date(formatInTimeZone(prevWeekStart, TZ, 'yyyy-MM-dd') + 'T00:00:00+09:00');
  
  // End: previous Sunday 23:59:59 JST
  const endDate = new Date(formatInTimeZone(prevWeekEnd, TZ, 'yyyy-MM-dd') + 'T23:59:59+09:00');
  
  const weekStartStr = formatInTimeZone(prevWeekStart, TZ, 'yyyy-MM-dd');
  const weekEndStr = formatInTimeZone(prevWeekEnd, TZ, 'yyyy-MM-dd');
  
  return { startDate, endDate, weekStartStr, weekEndStr };
}

/**
 * Convert ISO string to JST formatted string
 * @param {string} isoString 
 * @returns {string} JST formatted string
 */
export function toJSTString(isoString) {
  return formatInTimeZone(new Date(isoString), TZ, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Format milliseconds to mm:ss
 * @param {number} ms 
 * @returns {string}
 */
export function formatTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

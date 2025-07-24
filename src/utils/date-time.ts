/**
 * Date and time utilities
 */

export type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export interface TimeSpan {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  years: number;
}

export interface ScheduleOptions {
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
  skipWeekends?: boolean;
  skipHolidays?: string[];
}

/**
 * Time conversion utilities
 */
export const TIME_CONSTANTS = {
  MILLISECOND: 1,
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000, // Approximate
  YEAR: 365 * 24 * 60 * 60 * 1000  // Approximate
};

export function convertTime(value: number, from: TimeUnit, to: TimeUnit): number {
  const fromMs = toMilliseconds(value, from);
  
  switch (to) {
    case 'milliseconds': return fromMs;
    case 'seconds': return fromMs / TIME_CONSTANTS.SECOND;
    case 'minutes': return fromMs / TIME_CONSTANTS.MINUTE;
    case 'hours': return fromMs / TIME_CONSTANTS.HOUR;
    case 'days': return fromMs / TIME_CONSTANTS.DAY;
    case 'weeks': return fromMs / TIME_CONSTANTS.WEEK;
    case 'months': return fromMs / TIME_CONSTANTS.MONTH;
    case 'years': return fromMs / TIME_CONSTANTS.YEAR;
    default: return fromMs;
  }
}

export function toMilliseconds(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'milliseconds': return value;
    case 'seconds': return value * TIME_CONSTANTS.SECOND;
    case 'minutes': return value * TIME_CONSTANTS.MINUTE;
    case 'hours': return value * TIME_CONSTANTS.HOUR;
    case 'days': return value * TIME_CONSTANTS.DAY;
    case 'weeks': return value * TIME_CONSTANTS.WEEK;
    case 'months': return value * TIME_CONSTANTS.MONTH;
    case 'years': return value * TIME_CONSTANTS.YEAR;
    default: return value;
  }
}

/**
 * Date arithmetic
 */
export function addTime(date: Date, value: number, unit: TimeUnit): Date {
  const ms = toMilliseconds(value, unit);
  return new Date(date.getTime() + ms);
}

export function subtractTime(date: Date, value: number, unit: TimeUnit): Date {
  const ms = toMilliseconds(value, unit);
  return new Date(date.getTime() - ms);
}

export function differenceInTime(date1: Date, date2: Date, unit: TimeUnit): number {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return convertTime(diffMs, 'milliseconds', unit);
}

export function isAfter(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}

export function isBefore(date1: Date, date2: Date): boolean {
  return date1.getTime() < date2.getTime();
}

export function isBetween(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/**
 * Date comparison utilities
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

export function isSameWeek(date1: Date, date2: Date): boolean {
  const week1 = getWeekNumber(date1);
  const week2 = getWeekNumber(date2);
  return week1.year === week2.year && week1.week === week2.week;
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth();
}

export function isSameYear(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear();
}

/**
 * Date parsing and validation
 */
export function parseDate(dateString: string): Date | null {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export function parseISO(isoString: string): Date | null {
  try {
    const date = new Date(isoString);
    return isValidDate(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Date formatting utilities
 */
export function formatDate(date: Date, format: string): string {
  const tokens: { [key: string]: string } = {
    'YYYY': date.getFullYear().toString(),
    'YY': date.getFullYear().toString().slice(-2),
    'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
    'M': (date.getMonth() + 1).toString(),
    'DD': date.getDate().toString().padStart(2, '0'),
    'D': date.getDate().toString(),
    'HH': date.getHours().toString().padStart(2, '0'),
    'H': date.getHours().toString(),
    'mm': date.getMinutes().toString().padStart(2, '0'),
    'm': date.getMinutes().toString(),
    'ss': date.getSeconds().toString().padStart(2, '0'),
    's': date.getSeconds().toString(),
    'SSS': date.getMilliseconds().toString().padStart(3, '0')
  };

  let result = format;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(token, 'g'), value);
  }

  return result;
}

export function toISO(date: Date): string {
  return date.toISOString();
}

export function toLocaleDateString(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale);
}

export function toLocaleTimeString(date: Date, locale?: string): string {
  return date.toLocaleTimeString(locale);
}

/**
 * Timezone utilities
 */
export function getTimezoneOffset(date: Date): number {
  return date.getTimezoneOffset();
}

export function convertToTimezone(date: Date, timezone: string): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
}

export function getTimezoneAbbr(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'short'
  });
  
  return formatter.formatToParts(now)
    .find(part => part.type === 'timeZoneName')?.value || '';
}

/**
 * Week and calendar utilities
 */
export function getWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return { year: d.getUTCFullYear(), week };
}

export function getStartOfWeek(date: Date, startDayOfWeek: number = 0): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + startDayOfWeek;
  
  return new Date(d.setDate(diff));
}

export function getEndOfWeek(date: Date, startDayOfWeek: number = 0): Date {
  const startOfWeek = getStartOfWeek(date, startDayOfWeek);
  return addTime(startOfWeek, 6, 'days');
}

export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Business day utilities
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

export function isWeekday(date: Date): boolean {
  return !isWeekend(date);
}

export function getNextBusinessDay(date: Date, holidays: Date[] = []): Date {
  let nextDay = addTime(date, 1, 'days');
  
  while (isWeekend(nextDay) || holidays.some(holiday => isSameDay(nextDay, holiday))) {
    nextDay = addTime(nextDay, 1, 'days');
  }
  
  return nextDay;
}

export function countBusinessDays(startDate: Date, endDate: Date, holidays: Date[] = []): number {
  let count = 0;
  let current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWeekday(current) && !holidays.some(holiday => isSameDay(current, holiday))) {
      count++;
    }
    current = addTime(current, 1, 'days');
  }
  
  return count;
}

/**
 * Duration and span utilities
 */
export function createTimeSpan(milliseconds: number): TimeSpan {
  return {
    milliseconds,
    seconds: convertTime(milliseconds, 'milliseconds', 'seconds'),
    minutes: convertTime(milliseconds, 'milliseconds', 'minutes'),
    hours: convertTime(milliseconds, 'milliseconds', 'hours'),
    days: convertTime(milliseconds, 'milliseconds', 'days'),
    weeks: convertTime(milliseconds, 'milliseconds', 'weeks'),
    months: convertTime(milliseconds, 'milliseconds', 'months'),
    years: convertTime(milliseconds, 'milliseconds', 'years')
  };
}

export function humanizeDuration(milliseconds: number): string {
  const span = createTimeSpan(milliseconds);
  
  if (span.years >= 1) {
    return `${Math.floor(span.years)} year${Math.floor(span.years) > 1 ? 's' : ''}`;
  } else if (span.months >= 1) {
    return `${Math.floor(span.months)} month${Math.floor(span.months) > 1 ? 's' : ''}`;
  } else if (span.weeks >= 1) {
    return `${Math.floor(span.weeks)} week${Math.floor(span.weeks) > 1 ? 's' : ''}`;
  } else if (span.days >= 1) {
    return `${Math.floor(span.days)} day${Math.floor(span.days) > 1 ? 's' : ''}`;
  } else if (span.hours >= 1) {
    return `${Math.floor(span.hours)} hour${Math.floor(span.hours) > 1 ? 's' : ''}`;
  } else if (span.minutes >= 1) {
    return `${Math.floor(span.minutes)} minute${Math.floor(span.minutes) > 1 ? 's' : ''}`;
  } else {
    return `${Math.floor(span.seconds)} second${Math.floor(span.seconds) > 1 ? 's' : ''}`;
  }
}

/**
 * Scheduling utilities
 */
export function scheduleNextExecution(
  interval: number,
  unit: TimeUnit,
  options: ScheduleOptions = {}
): Date {
  let nextDate = addTime(options.startDate || new Date(), interval, unit);
  
  // Skip weekends if requested
  if (options.skipWeekends && isWeekend(nextDate)) {
    nextDate = getNextBusinessDay(nextDate);
  }
  
  // Skip holidays if provided
  if (options.skipHolidays && options.skipHolidays.length > 0) {
    const holidays = options.skipHolidays.map(h => parseDate(h)).filter(Boolean) as Date[];
    while (holidays.some(holiday => isSameDay(nextDate, holiday))) {
      nextDate = addTime(nextDate, 1, 'days');
    }
  }
  
  // Respect end date
  if (options.endDate && nextDate > options.endDate) {
    throw new Error('Next execution would exceed end date');
  }
  
  return nextDate;
}

/**
 * Age calculation utilities
 */
export function calculateAge(birthDate: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Relative time utilities
 */
export function getRelativeTime(date: Date, baseDate: Date = new Date()): string {
  const diffMs = baseDate.getTime() - date.getTime();
  const future = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);
  
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  
  if (absDiffMs < TIME_CONSTANTS.MINUTE) {
    return rtf.format(future ? Math.ceil(diffMs / TIME_CONSTANTS.SECOND) : -Math.floor(absDiffMs / TIME_CONSTANTS.SECOND), 'second');
  } else if (absDiffMs < TIME_CONSTANTS.HOUR) {
    return rtf.format(future ? Math.ceil(diffMs / TIME_CONSTANTS.MINUTE) : -Math.floor(absDiffMs / TIME_CONSTANTS.MINUTE), 'minute');
  } else if (absDiffMs < TIME_CONSTANTS.DAY) {
    return rtf.format(future ? Math.ceil(diffMs / TIME_CONSTANTS.HOUR) : -Math.floor(absDiffMs / TIME_CONSTANTS.HOUR), 'hour');
  } else if (absDiffMs < TIME_CONSTANTS.WEEK) {
    return rtf.format(future ? Math.ceil(diffMs / TIME_CONSTANTS.DAY) : -Math.floor(absDiffMs / TIME_CONSTANTS.DAY), 'day');
  } else if (absDiffMs < TIME_CONSTANTS.MONTH) {
    return rtf.format(future ? Math.ceil(diffMs / TIME_CONSTANTS.WEEK) : -Math.floor(absDiffMs / TIME_CONSTANTS.WEEK), 'week');
  } else {
    return rtf.format(future ? Math.ceil(diffMs / TIME_CONSTANTS.MONTH) : -Math.floor(absDiffMs / TIME_CONSTANTS.MONTH), 'month');
  }
}

/**
 * Utility class for date ranges
 */
export class DateRange {
  constructor(public readonly start: Date, public readonly end: Date) {
    if (start > end) {
      throw new Error('Start date must be before end date');
    }
  }

  contains(date: Date): boolean {
    return isBetween(date, this.start, this.end);
  }

  overlaps(other: DateRange): boolean {
    return this.start <= other.end && this.end >= other.start;
  }

  getDuration(): number {
    return this.end.getTime() - this.start.getTime();
  }

  getDurationIn(unit: TimeUnit): number {
    return convertTime(this.getDuration(), 'milliseconds', unit);
  }

  split(interval: number, unit: TimeUnit): DateRange[] {
    const ranges: DateRange[] = [];
    let current = new Date(this.start);
    
    while (current < this.end) {
      const next = addTime(current, interval, unit);
      const rangeEnd = next > this.end ? this.end : next;
      
      ranges.push(new DateRange(new Date(current), rangeEnd));
      current = next;
    }
    
    return ranges;
  }
}
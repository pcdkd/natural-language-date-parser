import { RuleModule, ParseResult, DateParsePreferences, Pattern } from '../types/types';
import { DateTime } from 'luxon';

// Helper function to get Easter Sunday for a given year
function getEasterSunday(year: number): DateTime {
  // Meeus/Jones/Butcher algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return DateTime.utc(year, month, day);
}

// Helper function to get nth weekday of a month
function getNthWeekday(year: number, month: number, weekday: number, n: number): DateTime {
  let date = DateTime.utc(year, month, 1);
  
  // Adjust to first occurrence of weekday
  while (date.weekday !== weekday) {
    date = date.plus({ days: 1 });
  }
  
  // Add weeks to get to nth occurrence
  date = date.plus({ weeks: n - 1 });
  
  return date;
}

// Helper function to get last weekday of a month
function getLastWeekday(year: number, month: number, weekday: number): DateTime {
  let date = DateTime.utc(year, month + 1, 1).minus({ days: 1 });
  
  while (date.weekday !== weekday) {
    date = date.minus({ days: 1 });
  }
  
  return date;
}

// Helper function to get Chinese New Year
function getChineseNewYear(year: number): DateTime {
  // Simplified calculation - actual date requires complex lunar calendar
  // These are approximate dates for 2024-2025
  const dates: Record<number, [number, number]> = {
    2024: [2, 10],
    2025: [1, 29]
  };
  
  const [month, day] = dates[year] || [2, 1]; // Default to Feb 1st if year not known
  return DateTime.utc(year, month, day);
}

// Helper function to get Diwali
function getDiwali(year: number): DateTime {
  // Simplified calculation - actual date requires complex lunar calendar
  // These are approximate dates for 2024-2025
  const dates: Record<number, [number, number]> = {
    2024: [10, 31],
    2025: [10, 20]
  };
  
  const [month, day] = dates[year] || [11, 1]; // Default to Nov 1st if year not known
  return DateTime.utc(year, month, day);
}

const patterns: Pattern[] = [
  // Fixed date holidays
  {
    regex: /^(?:on\s+)?(?:new\s+year'?s?\s+(?:day|eve)|christmas\s+(?:day|eve)|valentine'?s?\s+day|independence\s+day|halloween|tax\s+day)$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const holiday = matches[0].toLowerCase();
      const year = preferences.referenceDate?.year || new Date().getFullYear();
      let date: DateTime;

      switch (true) {
        case /new\s+year'?s?\s+day/.test(holiday):
          date = DateTime.utc(year, 1, 1);
          break;
        case /new\s+year'?s?\s+eve/.test(holiday):
          date = DateTime.utc(year, 12, 31);
          break;
        case /christmas\s+day/.test(holiday):
          date = DateTime.utc(year, 12, 25);
          break;
        case /christmas\s+eve/.test(holiday):
          date = DateTime.utc(year, 12, 24);
          break;
        case /valentine'?s?\s+day/.test(holiday):
          date = DateTime.utc(year, 2, 14);
          break;
        case /independence\s+day/.test(holiday):
          date = DateTime.utc(year, 7, 4);
          break;
        case /halloween/.test(holiday):
          date = DateTime.utc(year, 10, 31);
          break;
        case /tax\s+day/.test(holiday):
          date = DateTime.utc(year, 4, 15);
          break;
        default:
          return null;
      }

      return {
        type: 'single',
        start: date,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  // Variable date holidays
  {
    regex: /^(?:on\s+)?(?:easter\s+sunday|memorial\s+day|labor\s+day|thanksgiving(?:\s+day)?|chinese\s+new\s+year(?:\s+\d{4})?|diwali(?:\s+\d{4})?)$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const holiday = matches[0].toLowerCase();
      const year = preferences.referenceDate?.year || new Date().getFullYear();
      let date: DateTime;

      switch (true) {
        case /easter\s+sunday/.test(holiday):
          date = getEasterSunday(year);
          break;
        case /memorial\s+day/.test(holiday):
          // Last Monday in May
          date = getLastWeekday(year, 5, 1);
          break;
        case /labor\s+day/.test(holiday):
          // First Monday in September
          date = getNthWeekday(year, 9, 1, 1);
          break;
        case /thanksgiving/.test(holiday):
          // Fourth Thursday in November
          date = getNthWeekday(year, 11, 4, 4);
          break;
        case /chinese\s+new\s+year/.test(holiday):
          const cnyYear = parseInt(holiday.match(/\d{4}/)?.[0] || year.toString());
          date = getChineseNewYear(cnyYear);
          break;
        case /diwali/.test(holiday):
          const diwaliYear = parseInt(holiday.match(/\d{4}/)?.[0] || year.toString());
          date = getDiwali(diwaliYear);
          break;
        default:
          return null;
      }

      return {
        type: 'single',
        start: date,
        confidence: 1,
        text: matches[0]
      };
    }
  }
];

export const holidaysRule: RuleModule = {
  name: 'holidays',
  patterns
}; 
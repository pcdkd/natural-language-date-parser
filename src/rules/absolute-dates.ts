import { RuleModule, IntermediateParse, ParseResult, DateParsePreferences, Pattern } from '../types/types';
import { parseTimeString, timeComponentsToString } from '../utils/time-parser';
import { Logger } from '../utils/Logger';
import { DateTime } from 'luxon';

const MONTHS = {
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12
} as const;

function parseMonthName(monthStr: string): number {
  const month = MONTHS[monthStr.toLowerCase() as keyof typeof MONTHS];
  return month || 0;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= lastDay;
}

function createDateParser(format: string) {
  return (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
    const [_, ...parts] = matches;
    let year: number, month: number, day: number;

    switch (format) {
      case 'YMD':
        [year, month, day] = parts.map(p => parseInt(p));
        break;
      case 'MDY':
        [month, day, year] = parts.map(p => parseInt(p));
        break;
      case 'DMY':
        [day, month, year] = parts.map(p => parseInt(p));
        break;
      default:
        return null;
    }

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    const date = DateTime.utc(year, month, day);
    if (!date.isValid) {
      return null;
    }

    return {
      type: 'single',
      start: date,
      confidence: 1,
      text: matches[0]
    };
  };
}

function createMonthNameParser(format: 'MonthFirst' | 'DayFirst') {
  return (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
    Logger.debug('Parsing month name date', {
      format,
      matches: matches.map(m => m),
    });
    
    let year: number, month: number, day: number;
    const currentYear = preferences.referenceDate?.toUTC().year || new Date().getUTCFullYear();
    
    if (format === 'MonthFirst') {
      month = parseMonthName(matches[1]);
      day = parseInt(matches[2]);
      year = matches[3] ? parseInt(matches[3]) : currentYear;
    } else {
      day = parseInt(matches[1]);
      month = parseMonthName(matches[2]);
      year = matches[3] ? parseInt(matches[3]) : currentYear;
    }

    if (!isValidDate(year, month, day)) {
      Logger.debug('Invalid date components', { year, month, day });
      return null;
    }

    const result = DateTime.utc(year, month, day);
    return {
      type: 'single',
      start: result,
      confidence: 1.0,
      text: matches[0]
    };
  };
}

const patterns: Pattern[] = [
  // ISO format (YYYY-MM-DD)
  {
    regex: /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?(?:\s*([+-]\d{4})?)?$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, year, month, day, hours, minutes, timezone] = matches;
      
      // Create base date in UTC
      let date = DateTime.utc(
        parseInt(year),
        parseInt(month),
        parseInt(day)
      );

      // Add time if provided
      if (hours && minutes) {
        date = date.set({
          hour: parseInt(hours),
          minute: parseInt(minutes)
        });
      }

      // Handle timezone if provided
      if (timezone) {
        // Convert timezone offset from ±HHMM to ±HH:MM format
        const formattedTz = timezone.replace(/([+-])(\d{2})(\d{2})/, '$1$2:$3');
        date = date.setZone(formattedTz, { keepLocalTime: true });
      } else if (preferences.timeZone) {
        // If no explicit timezone but preferences has one
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // European/International formats (DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY)
  {
    regex: /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:\s+(\d{1,2})[:\.](\d{2}))?(?:\s*([+-]\d{4})?)?$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, day, month, year, hours, minutes, timezone] = matches;
      let parsedYear = parseInt(year);
      
      // Handle 2-digit years
      if (parsedYear < 100) {
        parsedYear += parsedYear < 50 ? 2000 : 1900;
      }

      // Create base date in UTC
      let date = DateTime.utc(
        parsedYear,
        parseInt(month),
        parseInt(day)
      );

      // Add time if provided
      if (hours && minutes) {
        date = date.set({
          hour: parseInt(hours),
          minute: parseInt(minutes)
        });
      }

      // Handle timezone if provided
      if (timezone) {
        // Convert timezone offset from ±HHMM to ±HH:MM format
        const formattedTz = timezone.replace(/([+-])(\d{2})(\d{2})/, '$1$2:$3');
        date = date.setZone(formattedTz, { keepLocalTime: true });
      } else if (preferences.timeZone) {
        // If no explicit timezone but preferences has one
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // US format (MM/DD/YYYY)
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, month, day, year, hours, minutes, meridiem] = matches;
      let parsedYear = parseInt(year);
      
      // Handle 2-digit years
      if (parsedYear < 100) {
        parsedYear += parsedYear < 50 ? 2000 : 1900;
      }

      // Create base date in UTC
      let date = DateTime.utc(
        parsedYear,
        parseInt(month),
        parseInt(day)
      );

      // Add time if provided
      if (hours && minutes) {
        let hour = parseInt(hours);
        if (meridiem) {
          if (hour > 12) return null;
          if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
          if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
        }
        date = date.set({
          hour,
          minute: parseInt(minutes)
        });
      }

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // Written date with ordinal (March 15th, 2024)
  {
    regex: /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{2,4})?(?:\s+at\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, monthStr, dayStr, yearStr, hours, minutes, meridiem] = matches;
      const month = parseMonthName(monthStr);
      const day = parseInt(dayStr);
      const currentYear = preferences.referenceDate?.year || new Date().getFullYear();
      const year = yearStr ? parseInt(yearStr) : currentYear;
      
      // Parse time if provided
      let hour = hours ? parseInt(hours) : 0;
      const minute = minutes ? parseInt(minutes) : 0;

      if (meridiem) {
        if (hour > 12) return null;
        if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }

      // Create date in UTC
      let date = DateTime.utc(
        year,
        month,
        day,
        hour,
        minute
      );

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // Japanese/Chinese format (YYYY年MM月DD日)
  {
    regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})時(\d{2})分)?$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, year, month, day, hours, minutes] = matches;
      
      // Create base date in UTC
      let date = DateTime.utc(
        parseInt(year),
        parseInt(month),
        parseInt(day)
      );

      // Add time if provided
      if (hours && minutes) {
        date = date.set({
          hour: parseInt(hours),
          minute: parseInt(minutes)
        });
      }

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // ISO Week format (YYYY-Www-D)
  {
    regex: /^(\d{4})-W(\d{2})-?(\d)?$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, year, week, day] = matches;
      const parsedYear = parseInt(year);
      const parsedWeek = parseInt(week);
      const parsedDay = day ? parseInt(day) : 1;

      if (parsedWeek < 1 || parsedWeek > 53 || parsedDay < 1 || parsedDay > 7) {
        return null;
      }

      // Create date from ISO week
      let date = DateTime.fromObject({
        weekYear: parsedYear,
        weekNumber: parsedWeek,
        weekday: parsedDay as 1 | 2 | 3 | 4 | 5 | 6 | 7
      }, { zone: 'UTC' });

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // Ordinal date format (YYYY-DDD)
  {
    regex: /^(\d{4})-(\d{3})$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, year, dayOfYear] = matches;
      const parsedYear = parseInt(year);
      const parsedDay = parseInt(dayOfYear);

      if (parsedDay < 1 || parsedDay > 366) {
        return null;
      }

      // Create date from ordinal day
      let date = DateTime.fromObject({
        year: parsedYear,
        ordinal: parsedDay
      }, { zone: 'UTC' });

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // Persian/Iranian format (YYYY/MM/DD)
  {
    regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, year, month, day] = matches;
      
      // Create base date in UTC
      let date = DateTime.utc(
        parseInt(year),
        parseInt(month),
        parseInt(day)
      );

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // German format (DD.MM.YY)
  {
    regex: /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, day, month, year] = matches;
      let parsedYear = parseInt(year);
      
      // Handle 2-digit years
      parsedYear += parsedYear < 50 ? 2000 : 1900;

      // Create base date in UTC
      let date = DateTime.utc(
        parsedYear,
        parseInt(month),
        parseInt(day)
      );

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // Indian format (DD-MM-YY)
  {
    regex: /^(\d{1,2})-(\d{1,2})-(\d{2})$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, day, month, year] = matches;
      let parsedYear = parseInt(year);
      
      // Handle 2-digit years
      parsedYear += parsedYear < 50 ? 2000 : 1900;

      // Create base date in UTC
      let date = DateTime.utc(
        parsedYear,
        parseInt(month),
        parseInt(day)
      );

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // Scandinavian format (YYYY.MM.DD)
  {
    regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, year, month, day] = matches;
      
      // Create base date in UTC
      let date = DateTime.utc(
        parseInt(year),
        parseInt(month),
        parseInt(day)
      );

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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
  // Written date with month first (15 March 2024)
  {
    regex: /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+|,\s*)(\d{2,4})$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, dayStr, monthStr, yearStr] = matches;
      const month = parseMonthName(monthStr);
      const day = parseInt(dayStr);
      let year = parseInt(yearStr);
      
      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      // Create date in UTC
      let date = DateTime.utc(year, month, day);

      // Handle timezone
      if (preferences.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      // Validate the date
      if (!date.isValid) {
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

export const absoluteDatesRule: RuleModule = {
  name: 'absolute-dates',
  patterns
}; 
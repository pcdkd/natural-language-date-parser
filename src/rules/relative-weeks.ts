import { RuleModule, ParseResult, DateParsePreferences, Pattern } from '../types/types';
import { DateTime } from 'luxon';

function createDateTimeInZone(year: number, month: number, day: number, hour: number = 0, minute: number = 0, preferences?: DateParsePreferences): DateTime {
  // Create date in the target timezone directly to avoid conversion issues
  const zone = preferences?.timeZone || 'UTC';
  return DateTime.fromObject(
    { year, month, day, hour, minute },
    { zone }
  );
}

function getWeekRange(referenceDate: DateTime, offset: number = 0, preferences?: DateParsePreferences, isBusinessWeek: boolean = false): { start: DateTime; end: DateTime } {
  // Determine week start based on preferences (default to Sunday = 7)
  const weekStartsOn = preferences?.weekStartsOn ?? 7;
  
  // Calculate the start of the week
  let weekStart = referenceDate.plus({ weeks: offset });
  const currentWeekday = weekStart.weekday;
  
  // Adjust to the start of the week based on weekStartsOn preference
  const daysToSubtract = (currentWeekday - weekStartsOn + 7) % 7;
  weekStart = weekStart.minus({ days: daysToSubtract });

  // For business week, end is Friday, otherwise it's the last day of the week
  const daysToAdd = isBusinessWeek ? 4 : 6; // Friday is 4 days after Monday, or 6 days for full week
  const weekEnd = weekStart.plus({ days: daysToAdd });

  return {
    start: createDateTimeInZone(
      weekStart.year,
      weekStart.month,
      weekStart.day,
      0,
      0,
      preferences
    ),
    end: createDateTimeInZone(
      weekEnd.year,
      weekEnd.month,
      weekEnd.day,
      23,
      59,
      preferences
    )
  };
}

function getNextWeekday(date: DateTime, weekday: number): DateTime {
  let result = date.plus({ days: 1 });
  while (result.weekday !== weekday) {
    result = result.plus({ days: 1 });
  }
  return result;
}

const patterns: Pattern[] = [
  // This week
  {
    regex: /^(?:this\s+)?week$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const referenceDate = preferences.referenceDate || DateTime.now().setZone(preferences.timeZone || 'UTC');
      const { start, end } = getWeekRange(referenceDate, 0, preferences);

      return {
        type: 'range',
        start,
        end,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  // Next week
  {
    regex: /^next\s+week$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const referenceDate = preferences.referenceDate || DateTime.now().setZone(preferences.timeZone || 'UTC');
      const { start, end } = getWeekRange(referenceDate, 1, preferences);

      return {
        type: 'range',
        start,
        end,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  // Last week
  {
    regex: /^last\s+week$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const referenceDate = preferences.referenceDate || DateTime.now().setZone(preferences.timeZone || 'UTC');
      const { start, end } = getWeekRange(referenceDate, -1, preferences);

      return {
        type: 'range',
        start,
        end,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  // End of week expressions
  {
    regex: /^end\s+of\s+(?:this\s+)?week$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const referenceDate = preferences.referenceDate || DateTime.now().setZone(preferences.timeZone || 'UTC');
      const { end } = getWeekRange(referenceDate, 0, preferences, true); // Use business week for end of week

      return {
        type: 'single',
        start: end,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  // End of next week
  {
    regex: /^end\s+of\s+next\s+week$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const referenceDate = preferences.referenceDate || DateTime.now().setZone(preferences.timeZone || 'UTC');
      const { end } = getWeekRange(referenceDate, 1, preferences, true); // Use business week for end of week

      return {
        type: 'single',
        start: end,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  // Every other week
  {
    regex: /^every\s+other\s+(?:week\s+on\s+)?(\w+)$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const dayName = matches[1].toLowerCase();
      const weekdays: Record<string, number> = {
        'monday': 1, 'mon': 1,
        'tuesday': 2, 'tue': 2,
        'wednesday': 3, 'wed': 3,
        'thursday': 4, 'thu': 4,
        'friday': 5, 'fri': 5,
        'saturday': 6, 'sat': 6,
        'sunday': 7, 'sun': 7
      };

      const weekday = weekdays[dayName];
      if (!weekday) return null;

      const referenceDate = preferences.referenceDate || DateTime.now().setZone(preferences.timeZone || 'UTC');
      let start = getNextWeekday(referenceDate, weekday);
      
      // Ensure start date is in the correct timezone
      start = createDateTimeInZone(
        start.year,
        start.month,
        start.day,
        start.hour,
        start.minute,
        preferences
      );

      return {
        type: 'recurring',
        start,
        confidence: 1,
        text: matches[0],
        recurrence: {
          interval: 14, // 14 days = every other week
          dayOfWeek: weekday,
          frequency: 'weekly'
        }
      };
    }
  },
  // Daily/Weekly/Monthly patterns
  {
    regex: /^(daily|weekly|monthly)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, frequency, hours, minutes, meridiem] = matches;
      const referenceDate = preferences.referenceDate || DateTime.now().setZone(preferences.timeZone || 'UTC');
      
      let hour = hours ? parseInt(hours) : 9; // Default to 9 AM
      const minute = minutes ? parseInt(minutes) : 0;

      if (meridiem) {
        if (hour > 12) return null;
        if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }

      const start = createDateTimeInZone(
        referenceDate.year,
        referenceDate.month,
        referenceDate.day,
        hour,
        minute,
        preferences
      );

      const intervals: Record<string, number> = {
        'daily': 1,
        'weekly': 7,
        'monthly': 0 // Special case handled by frequency
      };

      const freqLower = frequency.toLowerCase();
      if (freqLower !== 'daily' && freqLower !== 'weekly' && freqLower !== 'monthly') {
        return null;
      }

      return {
        type: 'recurring',
        start,
        confidence: 1,
        text: matches[0],
        recurrence: {
          interval: intervals[freqLower],
          frequency: freqLower as 'daily' | 'weekly' | 'monthly'
        }
      };
    }
  },
  // Recurrence with end conditions
  {
    regex: /^every\s+(\w+)(?:\s+until\s+(.+))$/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, dayName, endCondition] = matches;
      const weekdays: Record<string, number> = {
        'monday': 1, 'mon': 1,
        'tuesday': 2, 'tue': 2,
        'wednesday': 3, 'wed': 3,
        'thursday': 4, 'thu': 4,
        'friday': 5, 'fri': 5,
        'saturday': 6, 'sat': 6,
        'sunday': 7, 'sun': 7
      };

      const weekday = weekdays[dayName.toLowerCase()];
      if (!weekday) return null;

      const referenceDate = preferences.referenceDate || DateTime.now();
      let start = getNextWeekday(referenceDate, weekday);
      let endDate: DateTime | undefined;

      if (endCondition.toLowerCase() === 'end of year') {
        endDate = DateTime.utc(start.year, 12, 31);
      }

      return {
        type: 'recurring',
        start,
        confidence: 1,
        text: matches[0],
        recurrence: {
          interval: 7,
          dayOfWeek: weekday,
          frequency: 'weekly',
          endDate
        }
      };
    }
  }
];

export const relativeWeeksRule: RuleModule = {
  name: 'relative-weeks',
  patterns
};

import { RuleModule, IntermediateParse, ParseResult, DateParsePreferences, ParserState, Pattern } from '../types/types';
import { DateTime } from 'luxon';

function createTimeResult(hour: number, minute: number, preferences?: DateParsePreferences): ParseResult {
  const referenceDate = preferences?.referenceDate || DateTime.now();
  let start = DateTime.fromObject({
    year: referenceDate.year,
    month: referenceDate.month,
    day: referenceDate.day,
    hour,
    minute
  }, { zone: 'UTC' });

  return {
    type: 'single',
    start,
    confidence: 1,
    text: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  };
}

const patterns: Pattern[] = [
  {
    regex: /(?:^|\s)(?:in\s+the\s+)?(morning|afternoon|evening|night)(?:\s|$)/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const timeOfDay = matches[1].toLowerCase();
      let hour = 0;
      let endHour = 0;
      
      switch (timeOfDay) {
        case 'morning':
          hour = 8;  // 8 AM
          endHour = 12; // 12 PM
          break;
        case 'afternoon':
          hour = 12; // 12 PM
          endHour = 17; // 5 PM
          break;
        case 'evening':
          hour = 17; // 5 PM
          endHour = 22; // 10 PM
          break;
        case 'night':
          hour = 22; // 10 PM
          endHour = 4; // 4 AM next day
          break;
      }

      const referenceDate = preferences?.referenceDate || DateTime.now();
      let start = DateTime.fromObject({
        year: referenceDate.year,
        month: referenceDate.month,
        day: referenceDate.day,
        hour,
        minute: 0
      }, { zone: 'UTC' });

      let end = DateTime.fromObject({
        year: referenceDate.year,
        month: referenceDate.month,
        day: referenceDate.day + (endHour < hour ? 1 : 0),
        hour: endHour,
        minute: 0
      }, { zone: 'UTC' });

      if (preferences?.timeZone) {
        start = start.setZone(preferences.timeZone, { keepLocalTime: true });
        end = end.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      return {
        type: 'range',
        start,
        end,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  {
    regex: /(?:^|\s)(?:at\s+)?(?:a\s+)?(?:quarter|half)\s+(?:past|to)\s+(\d{1,2})(?:\s*(AM|PM))?(?:\s|$)/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, hourStr, meridiem] = matches;
      let baseHour = parseInt(hourStr);
      let minute = 0;
      
      // Handle meridiem
      if (meridiem) {
        if (baseHour > 12) return null;
        if (meridiem.toUpperCase() === 'PM' && baseHour < 12) baseHour += 12;
        if (meridiem.toUpperCase() === 'AM' && baseHour === 12) baseHour = 0;
      }

      // Extract minute based on quarter/half and past/to
      const fullMatch = matches[0].toLowerCase();
      if (fullMatch.includes('quarter past')) {
        minute = 15;
      } else if (fullMatch.includes('quarter to')) {
        minute = 45;
        baseHour = ((baseHour - 1 + 24) % 24);
      } else if (fullMatch.includes('half past')) {
        minute = 30;
      } else if (fullMatch.includes('half to')) {
        minute = 30;
        baseHour = ((baseHour - 1 + 24) % 24);
      }

      const referenceDate = preferences?.referenceDate || DateTime.now();
      let date = DateTime.fromObject({
        year: referenceDate.year,
        month: referenceDate.month,
        day: referenceDate.day,
        hour: baseHour,
        minute
      }, { zone: 'UTC' });

      if (preferences?.timeZone) {
        date = date.setZone(preferences.timeZone, { keepLocalTime: true });
      }

      return {
        type: 'single',
        start: date,
        confidence: 1,
        text: matches[0]
      };
    }
  },
  {
    regex: /(?:^|\s)(?:at\s+)?(\d{1,2})\s+(?:minutes?\s+)?(?:past|to)\s+(\d{1,2})(?:\s*(AM|PM))?(?:\s|$)/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      const [_, minuteStr, hourStr, meridiem] = matches;
      let baseHour = parseInt(hourStr);
      let minutes = parseInt(minuteStr);
      
      // Handle meridiem
      if (meridiem) {
        if (baseHour > 12) return null;
        if (meridiem.toUpperCase() === 'PM' && baseHour < 12) baseHour += 12;
        if (meridiem.toUpperCase() === 'AM' && baseHour === 12) baseHour = 0;
      }

      // Handle "to" vs "past"
      if (matches[0].toLowerCase().includes(' to ')) {
        minutes = 60 - minutes;
        baseHour = (baseHour - 1 + 24) % 24;
      }

      if (minutes >= 60) return null;

      return createTimeResult(baseHour, minutes, preferences);
    }
  },
  {
    regex: /(?:^|\s)(?:at\s+)?(\d{1,2}):(\d{2})(?:\s*(AM|PM))?(?:\s|$)/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      let [_, hours, minutes, meridiem] = matches;
      let hour = parseInt(hours);
      const minute = parseInt(minutes);

      if (minute >= 60) return null;

      if (meridiem) {
        if (hour > 12) return null;
        if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
      } else {
        if (hour >= 24) return null;
      }

      return createTimeResult(hour, minute, preferences);
    }
  },
  {
    regex: /(?:^|\s)(?:at\s+)?(\d{1,2})(?:\s*)(AM|PM)(?:\s|$)/i,
    parse: (matches: RegExpExecArray, preferences: DateParsePreferences): ParseResult | null => {
      let [_, hours, meridiem] = matches;
      let hour = parseInt(hours);

      if (hour > 12) return null;
      if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;

      return createTimeResult(hour, 0, preferences);
    }
  },
  {
    regex: /(?:^|\s)(?:at\s+)?noon(?:\s|$)/i,
    parse: (_: RegExpExecArray, preferences: DateParsePreferences): ParseResult => {
      return createTimeResult(12, 0, preferences);
    }
  },
  {
    regex: /(?:^|\s)(?:at\s+)?midnight(?:\s|$)/i,
    parse: (_: RegExpExecArray, preferences: DateParsePreferences): ParseResult => {
      return createTimeResult(0, 0, preferences);
    }
  }
];

export const timeOnlyRule: RuleModule = {
  name: 'time-only',
  patterns
};

export function parse(state: ParserState, input: string, preferences?: DateParsePreferences): ParseResult | null {
  const timePattern = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i;
  const match = input.match(timePattern);

  if (!match) {
    if (input.toLowerCase() === 'noon') {
      return createTimeResult(12, 0, preferences);
    }
    if (input.toLowerCase() === 'midnight') {
      return createTimeResult(0, 0, preferences);
    }
    return null;
  }

  let [_, hours, minutes, meridiem] = match;
  let hour = parseInt(hours);
  const minute = parseInt(minutes);

  if (minute >= 60) return null;

  if (meridiem) {
    if (hour > 12) return null;
    if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
  } else {
    if (hour >= 24) return null;
  }

  return createTimeResult(hour, minute, preferences);
} 
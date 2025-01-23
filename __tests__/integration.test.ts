import { createNLDP } from '../src/nldp';
import { DateTime } from 'luxon';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Natural Language Date Parser', () => {
  let parser: any;
  const referenceDate = DateTime.fromISO('2024-03-14T12:00:00Z');

  beforeEach(() => {
    parser = createNLDP({ referenceDate });
  });

  describe('absolute dates', () => {
    it('should parse ISO dates', () => {
      expect(parser.parse('2024-03-20')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-20');
    });

    it('should parse MM/DD/YYYY dates', () => {
      expect(parser.parse('03/20/2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-20');
    });
  });

  describe('absolute dates and times', () => {
    it('should parse dates with times', () => {
      const result = parser.parse('2024-03-20 at 3:30 PM');
      expect(result?.start.toUTC().toISO()).toBe('2024-03-20T15:30:00.000Z');
    });

    it('should parse dates with times in 24h format', () => {
      const result = parser.parse('2024-03-20 at 15:30');
      expect(result?.start.toUTC().toISO()).toBe('2024-03-20T15:30:00.000Z');
    });
  });

  describe('time parsing', () => {
    it('should parse times in 12h format', () => {
      const result = parser.parse('3:30 PM');
      expect(result?.start.toUTC().hour).toBe(15);
      expect(result?.start.toUTC().minute).toBe(30);
    });

    it('should parse special times', () => {
      expect(parser.parse('at noon')?.start.toUTC().hour).toBe(12);
      expect(parser.parse('at midnight')?.start.toUTC().hour).toBe(0);
    });
  });

  describe('relative dates', () => {
    it('should parse relative dates', () => {
      expect(parser.parse('today')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-14');
      expect(parser.parse('tomorrow')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(parser.parse('yesterday')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-13');
    });

    it('should parse relative dates with offsets', () => {
      expect(parser.parse('3 days ago')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-11');
      expect(parser.parse('3 days from now')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-17');
    });
  });

  describe('ordinal dates', () => {
    it('should parse ordinal dates', () => {
      expect(parser.parse('1st of March')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-01');
      expect(parser.parse('15th of March')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
    });
  });

  describe('fuzzy ranges', () => {
    it('should parse fuzzy ranges', () => {
      const early = parser.parse('beginning of March');
      expect(early?.start.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-01');
      expect(early?.end?.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-10');

      const mid = parser.parse('middle of March');
      expect(mid?.start.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-11');
      expect(mid?.end?.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-20');

      const late = parser.parse('end of March');
      expect(late?.start.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-21');
      expect(late?.end?.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-31');
    });
  });

  describe('ordinal weeks', () => {
    it('should parse ordinal weeks', () => {
      const firstWeek = parser.parse('first week of March');
      expect(firstWeek?.start.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-04');

      const lastWeek = parser.parse('last week of March');
      expect(lastWeek?.end?.toUTC().toISO()?.slice(0, 10)).toBe('2024-03-31');
    });
  });

  describe('time ranges', () => {
    it('should parse time ranges', () => {
      const result = parser.parse('3:30 PM to 5:00 PM');
      expect(result?.start.toUTC().hour).toBe(15);
      expect(result?.start.toUTC().minute).toBe(30);
      expect(result?.end?.toUTC().hour).toBe(17);
      expect(result?.end?.toUTC().minute).toBe(0);
    });

    it('should parse time ranges with dates', () => {
      const result = parser.parse('next tuesday from 3pm to 5pm', {debug: true});
      const nextTuesday = referenceDate.plus({ days: ((2 - referenceDate.weekday + 7) % 7) });
      
      expect(result?.start.toUTC().toISO()?.slice(0, 10))
        .toBe(nextTuesday.toUTC().toISO()?.slice(0, 10));
      expect(result?.start.toUTC().hour).toBe(15);
      expect(result?.start.toUTC().minute).toBe(0);
      expect(result?.end?.toUTC().hour).toBe(17);
      expect(result?.end?.toUTC().minute).toBe(0);
      expect(result?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe(nextTuesday.toUTC().toISO()?.slice(0, 10));
    });

    it('should handle overnight ranges', () => {
      const result = parser.parse('next tuesday from 10pm to 2am');
      const nextTuesday = referenceDate.plus({ days: ((2 - referenceDate.weekday + 7) % 7) });
      
      expect(result?.start.toUTC().toISO()?.slice(0, 10))
        .toBe(nextTuesday.toUTC().toISO()?.slice(0, 10));
      expect(result?.start.toUTC().hour).toBe(22);
      expect(result?.start.toUTC().minute).toBe(0);
      expect(result?.end?.toUTC().hour).toBe(2);
      expect(result?.end?.toUTC().minute).toBe(0);
      expect(result?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe(nextTuesday.plus({ days: 1 }).toUTC().toISO()?.slice(0, 10));
    });

    it('should handle timezone-specific ranges', () => {
      const result = parser.parse('next tuesday from 3pm to 5pm', {
        timeZone: 'America/New_York'
      });
      const nextTuesday = referenceDate.setZone('America/New_York').plus({ days: ((2 - referenceDate.weekday + 7) % 7) });
      
      expect(result?.start.zoneName).toBe('America/New_York');
      expect(result?.start.hour).toBe(15);
      expect(result?.start.minute).toBe(0);
      expect(result?.end?.hour).toBe(17);
      expect(result?.end?.minute).toBe(0);
      expect(result?.start.toISO()?.slice(0, 10))
        .toBe(nextTuesday.toISO()?.slice(0, 10));
    });

    it('should handle alternative range formats', () => {
      const result = parser.parse('between 3pm-5pm');
      expect(result?.start.toUTC().hour).toBe(15);
      expect(result?.start.toUTC().minute).toBe(0);
      expect(result?.end?.toUTC().hour).toBe(17);
      expect(result?.end?.toUTC().minute).toBe(0);
    });
  });

  describe('timezone handling', () => {
    it('should handle timezone conversions', () => {
      const result = parser.parse('tomorrow at 3 PM', {
        timeZone: 'America/New_York'
      });

      expect(result?.start.toISO()).toBe('2024-03-15T15:00:00.000-04:00');

      const result2 = parser.parse('next Monday at 3:30 PM', {
        timeZone: 'America/New_York'
      });

      expect(result2?.start.toISO()).toBe('2024-03-18T15:30:00.000-04:00');
    });

    it('should handle special times in different timezones', () => {
      const result = parser.parse('tomorrow at noon', {
        timeZone: 'America/New_York'
      });
      expect(result?.start.toISO()).toBe('2024-03-15T12:00:00.000-04:00');
    });

    it('should handle month boundaries in different timezones', () => {
      const result = parser.parse('beginning of next month', {
        timeZone: 'America/New_York'
      });
      expect(result?.start.toISO()).toBe('2024-04-01T00:00:00.000-04:00');
    });

    it('should handle DST transitions', () => {
      // Test before DST transition
      const result = parser.parse('3 PM', {
        referenceDate,
        timeZone: 'America/New_York'
      });
      expect(result?.start.toUTC().toISO()).toBe('2024-03-14T19:00:00.000Z');

      // Test after DST transition
      const result2 = parser.parse('2 AM', {
        referenceDate,
        timeZone: 'Asia/Tokyo'
      });
      expect(result2?.start.toISO()).toBe('2024-03-14T02:00:00.000+09:00');

      // Test during DST transition
      const before = parser.parse('3 PM', {
        referenceDate: DateTime.fromISO('2024-03-09T12:00:00Z'), // Day before DST
        timeZone: 'America/New_York'
      });
      expect(before?.start.toISO()).toBe('2024-03-09T15:00:00.000-05:00');

      const after = parser.parse('3 PM', {
        referenceDate: DateTime.fromISO('2024-03-10T12:00:00Z'), // Day of DST
        timeZone: 'America/New_York'
      });
      expect(after?.start.toISO()).toBe('2024-03-10T15:00:00.000-04:00');
    });
  });

  describe('additional date formats', () => {
    it('should parse European format dates (DD/MM/YYYY)', () => {
      expect(parser.parse('15/03/2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(parser.parse('31/12/2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-12-31');
    });

    it('should parse written dates', () => {
      expect(parser.parse('March 15th, 2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(parser.parse('March fifteenth 2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
    });

    it('should parse abbreviated month formats', () => {
      expect(parser.parse('Mar 15, 2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(parser.parse('Dec 31st, 2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-12-31');
    });

    it('should parse dates with different separators', () => {
      expect(parser.parse('15.03.24')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(parser.parse('15-03-2024')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
    });

    it('should parse two-digit years correctly', () => {
      expect(parser.parse('15/03/24')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(parser.parse('15/03/85')?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('1985-03-15');
    });
  });

  describe('natural language expressions', () => {
    it('should parse weekend expressions', () => {
      const nextWeekend = parser.parse('next weekend');
      expect(nextWeekend?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-16'); // Saturday
      expect(nextWeekend?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-17'); // Sunday

      const thisWeekend = parser.parse('this weekend');
      expect(thisWeekend?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-16');
      expect(thisWeekend?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-17');
    });

    it('should parse week-based expressions', () => {
      const endOfWeek = parser.parse('end of this week');
      expect(endOfWeek?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15'); // Friday
      
      const nextWeek = parser.parse('next week');
      expect(nextWeek?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-18'); // Following Monday
      expect(nextWeek?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-24'); // Following Sunday
    });

    it('should parse complex relative expressions', () => {
      const inTwoWeeks = parser.parse('in two weeks');
      expect(inTwoWeeks?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-28');

      const weekFromToday = parser.parse('a week from today');
      expect(weekFromToday?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-21');

      const thirdThursday = parser.parse('third Thursday of next month');
      expect(thirdThursday?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-18');
    });

    it('should parse business day expressions', () => {
      const nextBusinessDay = parser.parse('next business day');
      expect(nextBusinessDay?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15'); // Friday (assuming Thursday reference)

      const firstWorkingDay = parser.parse('first working day of next month');
      expect(firstWorkingDay?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-01'); // Monday, April 1st
    });
  });

  describe('complex time expressions', () => {
    it('should parse informal time expressions', () => {
      const quarterPast = parser.parse('quarter past three');
      expect(quarterPast?.start.toUTC().hour).toBe(15);
      expect(quarterPast?.start.toUTC().minute).toBe(15);

      const halfPast = parser.parse('half past noon');
      expect(halfPast?.start.toUTC().hour).toBe(12);
      expect(halfPast?.start.toUTC().minute).toBe(30);

      const tenTill = parser.parse('ten till midnight');
      expect(tenTill?.start.toUTC().hour).toBe(23);
      expect(tenTill?.start.toUTC().minute).toBe(50);
    });

    it('should parse time of day expressions', () => {
      const morning = parser.parse('morning');
      expect(morning?.start.toUTC().hour).toBe(8);
      expect(morning?.end?.toUTC().hour).toBe(12);

      const afternoon = parser.parse('afternoon');
      expect(afternoon?.start.toUTC().hour).toBe(12);
      expect(afternoon?.end?.toUTC().hour).toBe(17);

      const evening = parser.parse('evening');
      expect(evening?.start.toUTC().hour).toBe(17);
      expect(evening?.end?.toUTC().hour).toBe(21);
    });

    it('should parse combined date and informal time', () => {
      const result = parser.parse('quarter to noon tomorrow');
      expect(result?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(result?.start.toUTC().hour).toBe(11);
      expect(result?.start.toUTC().minute).toBe(45);
    });
  });

  describe('additional relative expressions', () => {
    it('should parse recurring expressions', () => {
      const everyOtherTuesday = parser.parse('every other Tuesday');
      expect(everyOtherTuesday?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-19');
      expect(everyOtherTuesday?.recurrence?.interval).toBe(14); // 14 days
      expect(everyOtherTuesday?.recurrence?.dayOfWeek).toBe(2); // Tuesday
    });

    it('should parse end of next week', () => {
      const endOfNextWeek = parser.parse('end of next week');
      expect(endOfNextWeek?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-22'); // Friday of next week
    });

    it('should parse same time expressions', () => {
      const sameTimeNextWeek = parser.parse('same time next week');
      expect(sameTimeNextWeek?.start.toUTC().toISO())
        .toBe('2024-03-21T12:00:00.000Z'); // Same hour/minute, next week

      const thisTimeTomorrow = parser.parse('this time tomorrow');
      expect(thisTimeTomorrow?.start.toUTC().toISO())
        .toBe('2024-03-15T12:00:00.000Z'); // Same hour/minute, next day
    });
  });

  describe('additional holiday expressions', () => {
    it('should parse more holidays', () => {
      const independenceDay = parser.parse('Independence Day');
      expect(independenceDay?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-07-04');

      const easter = parser.parse('Easter Sunday');
      expect(easter?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-31'); // Easter 2024

      const memorialDay = parser.parse('Memorial Day');
      expect(memorialDay?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-05-27'); // Last Monday in May
    });
  });

  describe('additional edge cases', () => {
    it('should handle year transitions', () => {
      const newYearsEve = parser.parse('New Year\'s Eve');
      expect(newYearsEve?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-12-31');

      const lastDayOfYear = parser.parse('last day of the year');
      expect(lastDayOfYear?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-12-31');

      const firstDayNextYear = parser.parse('first day of next year');
      expect(firstDayNextYear?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2025-01-01');
    });

    it('should handle multi-year expressions', () => {
      const nextYear = parser.parse('same day next year');
      expect(nextYear?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2025-03-14');

      const twoYearsFromNow = parser.parse('2 years from now');
      expect(twoYearsFromNow?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2026-03-14');
    });
  });

  describe('holiday expressions', () => {
    it('should parse common holidays', () => {
      const christmas = parser.parse('Christmas');
      expect(christmas?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-12-25');

      const christmasEve = parser.parse('Christmas Eve');
      expect(christmasEve?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-12-24');

      const newYear = parser.parse('New Year\'s Day');
      expect(newYear?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2025-01-01');
    });

    it('should parse holidays with variable dates', () => {
      const thanksgiving = parser.parse('Thanksgiving');
      expect(thanksgiving?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-11-28'); // Fourth Thursday of November

      const laborDay = parser.parse('Labor Day');
      expect(laborDay?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-09-02'); // First Monday in September
    });
  });

  describe('edge cases', () => {
    it('should handle month transitions correctly', () => {
      const endOfMonth = parser.parse('end of this month');
      expect(endOfMonth?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-31');

      const lastDayNextMonth = parser.parse('last day of next month');
      expect(lastDayNextMonth?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-30');
    });

    it('should handle leap year dates', () => {
      const leapDay = parser.parse('February 29th, 2024');
      expect(leapDay?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-02-29');

      const nextLeapDay = parser.parse('February 29th, 2025');
      expect(nextLeapDay).toBeNull(); // Invalid date
    });

    it('should handle invalid dates', () => {
      expect(parser.parse('February 30th, 2024')).toBeNull();
      expect(parser.parse('April 31st, 2024')).toBeNull();
    });

    it('should handle ambiguous times during DST transitions', () => {
      // 2:00 AM on DST transition day (spring forward)
      const springForward = parser.parse('2 AM on March 10, 2024', {
        timeZone: 'America/New_York'
      });
      expect(springForward?.start.toISO()).toBe('2024-03-10T02:00:00.000-05:00');

      // 1:30 AM on DST transition day (fall back)
      const fallBack = parser.parse('1:30 AM on November 3, 2024', {
        timeZone: 'America/New_York'
      });
      expect(fallBack?.start.toISO()).toBe('2024-11-03T01:30:00.000-04:00');
    });
  });

  describe('recurring patterns', () => {
    it('should handle complex recurring patterns', () => {
      // Every other week
      const biweekly = parser.parse('every other week on Tuesday');
      expect(biweekly?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-19');
      expect(biweekly?.recurrence?.interval).toBe(14); // 14 days
      expect(biweekly?.recurrence?.dayOfWeek).toBe(2); // Tuesday

      // Monthly patterns
      const monthly = parser.parse('first Monday of every month');
      expect(monthly?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-01');
      expect(monthly?.recurrence?.interval).toBe('monthly');
      expect(monthly?.recurrence?.dayOfWeek).toBe(1);
      expect(monthly?.recurrence?.weekOfMonth).toBe(1);

      // Yearly patterns
      const yearly = parser.parse('every year on March 15th');
      expect(yearly?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-15');
      expect(yearly?.recurrence?.interval).toBe('yearly');
      expect(yearly?.recurrence?.month).toBe(3);
      expect(yearly?.recurrence?.dayOfMonth).toBe(15);
    });

    it('should handle frequency modifiers', () => {
      // Daily
      const daily = parser.parse('daily at 9 AM');
      expect(daily?.start.toUTC().toISO())
        .toBe('2024-03-14T09:00:00.000Z');
      expect(daily?.recurrence?.interval).toBe(1);
      expect(daily?.recurrence?.frequency).toBe('daily');

      // Weekly
      const weekly = parser.parse('weekly on Friday at 3 PM');
      expect(weekly?.start.toUTC().toISO())
        .toBe('2024-03-15T15:00:00.000Z');
      expect(weekly?.recurrence?.interval).toBe(7);
      expect(weekly?.recurrence?.dayOfWeek).toBe(5);

      // Monthly with ordinal
      const monthly = parser.parse('monthly on the second Tuesday');
      expect(monthly?.recurrence?.interval).toBe('monthly');
      expect(monthly?.recurrence?.dayOfWeek).toBe(2);
      expect(monthly?.recurrence?.weekOfMonth).toBe(2);
    });

    it('should handle recurrence with end conditions', () => {
      // With end date
      const withEnd = parser.parse('every Monday until end of year');
      expect(withEnd?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-18');
      expect(withEnd?.recurrence?.interval).toBe(7);
      expect(withEnd?.recurrence?.endDate?.toISO()?.slice(0, 10))
        .toBe('2024-12-31');

      // With count
      const withCount = parser.parse('next 5 Tuesdays');
      expect(withCount?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-19');
      expect(withCount?.recurrence?.interval).toBe(7);
      expect(withCount?.recurrence?.count).toBe(5);
    });

    it('should handle complex recurrence exclusions', () => {
      // Excluding holidays
      const excludeHolidays = parser.parse('every weekday except holidays');
      expect(excludeHolidays?.recurrence?.exceptions).toContain('holidays');
      expect(excludeHolidays?.recurrence?.daysOfWeek).toEqual([1, 2, 3, 4, 5]);

      // Excluding specific dates
      const excludeDates = parser.parse('every Monday except March 25');
      expect(excludeDates?.recurrence?.excludeDates?.[0].toISO()?.slice(0, 10))
        .toBe('2024-03-25');

      // With multiple exclusions
      const multiExclusions = parser.parse('daily except weekends and holidays');
      expect(multiExclusions?.recurrence?.exceptions).toContain('holidays');
      expect(multiExclusions?.recurrence?.excludeDaysOfWeek).toEqual([0, 6]);
    });
  });

  describe('cultural date formats', () => {
    it('should handle international holidays', () => {
      const chineseNewYear = parser.parse('Chinese New Year 2024');
      expect(chineseNewYear?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-02-10');

      const diwali = parser.parse('Diwali 2024');
      expect(diwali?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-10-31');

      const ramadanStart = parser.parse('start of Ramadan 2024');
      expect(ramadanStart?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-10');

      const hanukkahStart = parser.parse('first day of Hanukkah 2024');
      expect(hanukkahStart?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-12-25');
    });

    it('should handle international date formats', () => {
      // European format (day first)
      const europeanDate = parser.parse('23.04.2024', { format: 'EU' });
      expect(europeanDate?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-23');

      // Asian format (year first)
      const asianDate = parser.parse('2024年4月23日', { format: 'JP' });
      expect(asianDate?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-23');

      // Islamic calendar date
      const islamicDate = parser.parse('15 Ramadan 1445');
      expect(islamicDate?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-25');
    });

    it('should handle fiscal calendar dates', () => {
      const taxDay = parser.parse('Tax Day 2024');
      expect(taxDay?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-15');

      const fiscalYearEnd = parser.parse('Fiscal Year End 2024', { 
        fiscalYearStart: 4 // April
      });
      expect(fiscalYearEnd?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-31');

      const quarterEnd = parser.parse('Q1 2024 end');
      expect(quarterEnd?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-31');
    });
  });

  describe('error handling', () => {
    it('should handle malformed input gracefully', () => {
      // Misspellings
      expect(parser.parse('next tusday')).toBeNull();
      expect(parser.parse('tommorow')).toBeNull();
      
      // Impossible dates
      expect(parser.parse('35th of March')).toBeNull();
      expect(parser.parse('February 30th')).toBeNull();
      
      // Contradictory terms
      expect(parser.parse('tomorrow yesterday')).toBeNull();
      expect(parser.parse('next week last week')).toBeNull();
    });

    it('should handle ambiguous inputs', () => {
      // Ambiguous date format
      const usDate = parser.parse('03/04/24', { format: 'US' });
      expect(usDate?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-04');

      const euDate = parser.parse('03/04/24', { format: 'EU' });
      expect(euDate?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-04-03');

      // Noon/Midnight edge cases
      const midnight = parser.parse('midnight tonight');
      expect(midnight?.start.toUTC().toISO())
        .toBe('2024-03-15T00:00:00.000Z');

      const nextMidnight = parser.parse('midnight tomorrow');
      expect(nextMidnight?.start.toUTC().toISO())
        .toBe('2024-03-16T00:00:00.000Z');
    });

    it('should handle partial and incomplete inputs', () => {
      // Just month
      const monthOnly = parser.parse('March');
      expect(monthOnly?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-01');
      expect(monthOnly?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-31');

      // Just day of week
      const dayOnly = parser.parse('Monday');
      expect(dayOnly?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-18');

      // Just time
      const timeOnly = parser.parse('3 PM');
      expect(timeOnly?.start.toUTC().toISO())
        .toBe('2024-03-14T15:00:00.000Z');
    });
  });

  describe('complex scenarios', () => {
    it('should handle compound expressions', () => {
      // Multiple conditions
      const result = parser.parse('next Tuesday afternoon unless it\'s a holiday');
      expect(result?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-19');
      expect(result?.start.toUTC().hour).toBe(12);
      expect(result?.end?.toUTC().hour).toBe(17);
      expect(result?.conditional).toBe('not_holiday');

      // Business day aware
      const businessResult = parser.parse('3 business days after next Friday');
      expect(businessResult?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-27'); // Friday + 3 business days (skipping weekend)

      // Periodic with exceptions
      const periodic = parser.parse('every Monday except holidays');
      expect(periodic?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-18');
      expect(periodic?.recurrence?.interval).toBe(7);
      expect(periodic?.recurrence?.exceptions).toContain('holidays');
    });

    it('should handle relative business expressions', () => {
      // End of business day
      const eod = parser.parse('EOD tomorrow');
      expect(eod?.start.toUTC().toISO())
        .toBe('2024-03-15T17:00:00.000Z');

      // Start of business day
      const sob = parser.parse('start of business next Monday');
      expect(sob?.start.toUTC().toISO())
        .toBe('2024-03-18T09:00:00.000Z');

      // Business quarter
      const quarter = parser.parse('end of Q2');
      expect(quarter?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-06-30');
    });

    it('should handle complex ranges with conditions', () => {
      const result = parser.parse('9 AM to 5 PM every weekday until end of month');
      expect(result?.start.toUTC().hour).toBe(9);
      expect(result?.end?.toUTC().hour).toBe(17);
      expect(result?.recurrence?.interval).toBe(1);
      expect(result?.recurrence?.endDate?.toISO()?.slice(0, 10))
        .toBe('2024-03-31');
      expect(result?.recurrence?.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle fiscal periods', () => {
      const fiscalYear = parser.parse('FY2024 Q3');
      expect(fiscalYear?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-01-01');
      expect(fiscalYear?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-31');

      const fiscalQuarter = parser.parse('current fiscal quarter');
      expect(fiscalQuarter?.start.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-01-01');
      expect(fiscalQuarter?.end?.toUTC().toISO()?.slice(0, 10))
        .toBe('2024-03-31');
    });
  });

  describe('timezone awareness', () => {
    it('should handle different timezone expressions', () => {
      // Explicit timezone in query
      const result = parser.parse('3 PM PST', {
        timeZone: 'America/New_York'
      });
      expect(result?.start.toISO()).toBe('2024-03-14T18:00:00.000-04:00');

      // Multiple timezones in range
      const crossTimezone = parser.parse('9 AM EST to 3 PM PST');
      expect(crossTimezone?.start.toISO()).toBe('2024-03-14T09:00:00.000-05:00');
      expect(crossTimezone?.end?.toISO()).toBe('2024-03-14T18:00:00.000-05:00');
    });

    it('should handle international date formats with timezones', () => {
      const tokyoTime = parser.parse('15/03/2024 14:30 JST', {
        timeZone: 'Asia/Tokyo'
      });
      expect(tokyoTime?.start.toISO()).toBe('2024-03-15T14:30:00.000+09:00');

      const londonTime = parser.parse('15/03/2024 14:30 GMT', {
        timeZone: 'Europe/London'
      });
      expect(londonTime?.start.toISO()).toBe('2024-03-15T14:30:00.000+00:00');
    });

    it('should handle timezone abbreviations', () => {
      const results = [
        parser.parse('3 PM EDT'),
        parser.parse('3 PM EST'),
        parser.parse('3 PM GMT'),
        parser.parse('3 PM BST'),
      ];
      
      expect(results[0]?.start.toISO()).toBe('2024-03-14T15:00:00.000-04:00');
      expect(results[1]?.start.toISO()).toBe('2024-03-14T15:00:00.000-05:00');
      expect(results[2]?.start.toISO()).toBe('2024-03-14T15:00:00.000+00:00');
      expect(results[3]?.start.toISO()).toBe('2024-03-14T15:00:00.000+01:00');
    });

    it('should handle timezone-aware relative expressions', () => {
      const nextDayTokyo = parser.parse('tomorrow at 9 AM', {
        timeZone: 'Asia/Tokyo'
      });
      expect(nextDayTokyo?.start.toISO()).toBe('2024-03-15T09:00:00.000+09:00');

      const endOfDayLA = parser.parse('end of day', {
        timeZone: 'America/Los_Angeles'
      });
      expect(endOfDayLA?.start.toISO()).toBe('2024-03-14T23:59:59.999-07:00');
    });

    it('should handle timezone transitions across date boundaries', () => {
      const midnightTransition = parser.parse('midnight', {
        timeZone: 'America/New_York',
        referenceDate: DateTime.fromISO('2024-03-09T23:00:00Z')
      });
      expect(midnightTransition?.start.toISO()).toBe('2024-03-10T00:00:00.000-05:00');

      const nextDayTransition = parser.parse('tomorrow at midnight', {
        timeZone: 'Europe/London',
        referenceDate: DateTime.fromISO('2024-03-30T23:00:00Z')
      });
      expect(nextDayTransition?.start.toISO()).toBe('2024-03-31T00:00:00.000+01:00');
    });
  });
}); 
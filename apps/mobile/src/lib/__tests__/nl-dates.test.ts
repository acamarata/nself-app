/**
 * nl-dates.test.ts: fixed-clock tests for the shared natural-language
 * due-date parser.
 * Purpose: Lock the extraction contract mobile relies on: phrase → ISO due
 *   date, phrase stripped from title, false positives rejected, date-only
 *   phrases at local midnight, forward resolution of weekday mentions.
 * Inputs: Literal phrases plus a fixed reference date.
 * Outputs: jest assertions.
 * Constraints: Expected values are built from local-constructed Dates so the
 *   suite is timezone-independent (the parser is local-time by design).
 */
import { parseNaturalDueDate, extractNaturalDueDate } from '../nl-dates';

// Monday 2026-08-24 10:00 local time.
const NOW = new Date(2026, 7, 24, 10, 0, 0, 0);

const localIso = (y: number, mo: number, d: number, h = 0, mi = 0): string =>
  new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();

describe('parseNaturalDueDate', () => {
  test('parses "tomorrow 5pm" to the next day at 17:00 local', () => {
    expect(parseNaturalDueDate('tomorrow 5pm', NOW)).toBe(localIso(2026, 8, 25, 17, 0));
  });

  test('parses a date-only phrase to local midnight', () => {
    expect(parseNaturalDueDate('tomorrow', NOW)).toBe(localIso(2026, 8, 25, 0, 0));
  });

  test('resolves weekday mentions forward', () => {
    // Friday after Monday 2026-08-24 is 2026-08-28.
    expect(parseNaturalDueDate('friday 3:30pm', NOW)).toBe(localIso(2026, 8, 28, 15, 30));
  });

  test('keeps an explicit noon explicit', () => {
    expect(parseNaturalDueDate('tomorrow noon', NOW)).toBe(localIso(2026, 8, 25, 12, 0));
  });

  test('parses numeric dates', () => {
    expect(parseNaturalDueDate('2026-09-01', NOW)).toBe(localIso(2026, 9, 1, 0, 0));
  });

  test('returns null for text without a date phrase', () => {
    expect(parseNaturalDueDate('Buy milk', NOW)).toBeNull();
  });

  test('rejects a bare "at 3" false positive', () => {
    // chrono alone matches "at 3" as 3am; the guard must refuse it.
    expect(parseNaturalDueDate('meet at 3', NOW)).toBeNull();
  });

  test('returns null for empty input', () => {
    expect(parseNaturalDueDate('', NOW)).toBeNull();
    expect(parseNaturalDueDate('   ', NOW)).toBeNull();
  });
});

describe('extractNaturalDueDate', () => {
  test('strips the phrase from the title and returns the due date', () => {
    const r = extractNaturalDueDate('Pay rent tomorrow 5pm', NOW);
    expect(r.title).toBe('Pay rent');
    expect(r.dueDate).toBe(localIso(2026, 8, 25, 17, 0));
  });

  test('collapses whitespace left by the stripped phrase', () => {
    // chrono's match includes the leading preposition, so stripping removes
    // the dangling "on" as well.
    const r = extractNaturalDueDate('Call mom on friday 9am about lunch', NOW);
    expect(r.title).toBe('Call mom about lunch');
    expect(r.dueDate).toBe(localIso(2026, 8, 28, 9, 0));
  });

  test('keeps the original text when the phrase is the whole input', () => {
    const r = extractNaturalDueDate('tomorrow 5pm', NOW);
    expect(r.title).toBe('tomorrow 5pm');
    expect(r.dueDate).toBe(localIso(2026, 8, 25, 17, 0));
  });

  test('returns the title unchanged with no due date for plain text', () => {
    const r = extractNaturalDueDate('Buy milk', NOW);
    expect(r.title).toBe('Buy milk');
    expect(r.dueDate).toBeNull();
  });
});

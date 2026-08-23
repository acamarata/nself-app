/**
 * nl-dates/index.ts: natural-language due-date parsing via chrono-node.
 *
 * Purpose: Parse a free-text due date out of what the user typed, so mobile
 *   accepts "Pay rent tomorrow 5pm" the way FEATURES.md has always claimed.
 *
 * WHY IT LIVES HERE AND NOT IN @nself/ntask-core: packages/ is a gitignored
 *   clone of nself-org/packages that CI re-clones from that repo's main, so a
 *   module added there is invisible to this repo's build. It is also the only
 *   consumer today: web has no natural-language parser (its UX is native
 *   date/time inputs; its only chrono references are two test files). Promote
 *   this to ntask-core when a second surface needs it, through a PR to the
 *   packages repo.
 * Inputs: Free text and an optional reference Date. Pass a fixed `now` in
 *   tests for deterministic results; production callers use the default.
 * Outputs: parseNaturalDueDate → ISO timestamptz string or null.
 *   extractNaturalDueDate → { title, dueDate } with the matched phrase
 *   stripped from the title (whitespace collapsed).
 * Constraints:
 *   - English phrases only (chrono-node's default `casual` config is
 *     English; locale configs exist if a surface needs them later).
 *   - Local time zone throughout, matching web date/time input semantics.
 *   - Date-only matches resolve to local midnight: web's splitDueDate treats
 *     exact local midnight as "date without time", so phrases like "tomorrow"
 *     round-trip as date-only due dates instead of silently inheriting the
 *     reference clock's time-of-day.
 *   - Ambiguous weekday/day mentions resolve FORWARD (the next occurrence),
 *     because a due date in the past is almost never what the user typed.
 * SPORT: MB-6 natural-language due dates.
 */

import * as chrono from 'chrono-node';
import type { ParsedResult } from 'chrono-node';

export interface ExtractedDueDate {
  /** Input with the matched date phrase removed and whitespace collapsed. */
  title: string;
  /** ISO timestamptz string, or null when no date phrase was accepted. */
  dueDate: string | null;
}

/**
 * False-positive guard, not a parser. chrono's casual config happily matches
 * fragments a user would not intend as a date (bare "at 3" becomes 3am, lone
 * month names match prose). A chrono match is only accepted when its own text
 * carries an explicit signal: relative/weekday/month words, a numeric date,
 * an a.m./p.m. marker, or a HH:MM time.
 */
const DATELIKE_PHRASE_RE = new RegExp(
  [
    '(?:next|last)\\s+(?:week|month|year|weekend|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)',
    '(?:today|tonight|tomorrow|tmrw?|yesterday)',
    '(?:monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)\\b',
    'in\\s+\\d+\\s+(?:day|week|month|hour)s?',
    '\\d+\\s+days?\\s+from\\s+now',
    '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)',
    '\\d{4}-\\d{1,2}-\\d{1,2}',
    '\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?',
    '\\d{1,2}:\\d{2}',
    '\\d{1,2}\\s?(?:a\\.?m\\.?|p\\.?m\\.?)',
  ].join('|'),
  'i',
);

/** First chrono match whose text passes the date-like guard, or null. */
function findDateMatch(text: string, now: Date): ParsedResult | null {
  const results = chrono.casual.parse(text, now, { forwardDate: true });
  return results.find((r) => DATELIKE_PHRASE_RE.test(r.text)) ?? null;
}

/**
 * Time-of-day signals. chrono's date-only matches inherit the reference
 * clock's time-of-day (an implied, not stated, time); without a signal in the
 * phrase itself the match is a pure date, so it resolves to local midnight.
 * Phrases that do signal a time ("5pm", "tonight", "noon") keep the parsed
 * time.
 */
const TIME_OF_DAY_RE =
  /(\d{1,2}:\d{2}|\d{1,2}\s?[ap]\.?m\.?|noon|midnight|tonight|morning|afternoon|evening)/i;

/**
 * Resolve a chrono match to a Date. Pure-date matches become local midnight
 * (web's splitDueDate treats exact local midnight as "date without time");
 * matches that state a time-of-day keep it.
 */
function matchToDate(match: ParsedResult): Date {
  const date = match.start.date();
  if (!TIME_OF_DAY_RE.test(match.text)) {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

/**
 * Parse free text into an ISO due date, or null when no date phrase is found.
 * Example: parseNaturalDueDate('tomorrow 5pm', now) → ISO of tomorrow 17:00.
 */
export function parseNaturalDueDate(text: string, now: Date = new Date()): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = findDateMatch(trimmed, now);
  return match ? matchToDate(match).toISOString() : null;
}

/**
 * Extract a due date from a task title and return the cleaned title.
 * Example: 'Pay rent tomorrow 5pm' → { title: 'Pay rent', dueDate: <ISO> }.
 * When the phrase is the whole input, stripping would leave nothing usable,
 * so the original text is kept as the title and the date is still returned.
 */
export function extractNaturalDueDate(text: string, now: Date = new Date()): ExtractedDueDate {
  const trimmed = text.trim();
  if (!trimmed) return { title: trimmed, dueDate: null };

  const match = findDateMatch(trimmed, now);
  if (!match) return { title: trimmed, dueDate: null };

  const stripped = (
    trimmed.slice(0, match.index) +
    trimmed.slice(match.index + match.text.length)
  )
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { title: stripped || trimmed, dueDate: matchToDate(match).toISOString() };
}

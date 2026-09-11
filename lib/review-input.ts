import { isDate, parseSources } from './domain.ts';

export function validateReviewInput(input: string, asOf: string) {
  if (!isDate(asOf)) throw new Error('Choose a valid review date.');
  const sources = parseSources(input);
  if (sources.length > 8)
    throw new Error('Keep each review to eight source updates or fewer.');
  return sources;
}

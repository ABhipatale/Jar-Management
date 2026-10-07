import { today } from '../../lib/format';

/** Whole days from today until a YYYY-MM-DD date (negative = already past). */
export function daysLeft(date) {
  return Math.round((new Date(`${date}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000);
}

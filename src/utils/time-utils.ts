/**
 * Time and duration utilities for the RPG system.
 *
 * Handles ISO 8601 duration parsing, date arithmetic,
 * midnight counting, and date formatting.
 */

/**
 * Parse an ISO 8601 duration string into milliseconds.
 * Supports P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S format.
 */
function parseDuration(durationStr: string): number {
  const regex = /P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)W)?(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?)?/;
  const matches = durationStr.match(regex);

  if (!matches) return 0;

  const years = parseInt(matches[1] || '0', 10);
  const months = parseInt(matches[2] || '0', 10);
  const weeks = parseInt(matches[3] || '0', 10);
  const days = parseInt(matches[4] || '0', 10);
  const hours = parseInt(matches[5] || '0', 10);
  const minutes = parseInt(matches[6] || '0', 10);
  const seconds = parseInt(matches[7] || '0', 10);

  let ms = 0;
  ms += seconds * 1000;
  ms += minutes * 60 * 1000;
  ms += hours * 60 * 60 * 1000;
  ms += days * 24 * 60 * 60 * 1000;
  ms += weeks * 7 * 24 * 60 * 60 * 1000;
  ms += months * 30 * 24 * 60 * 60 * 1000;
  ms += years * 365 * 24 * 60 * 60 * 1000;

  return ms;
}

/**
 * Add an ISO 8601 duration (string or ms) to a date string.
 * Returns a date string in "yyyy-MM-ddTHH:mm:ss" format.
 */
function addDuration(dateStr: string, duration: string | number): string {
  const date = new Date(dateStr);
  let msToAdd = 0;

  if (typeof duration === 'string') {
    msToAdd = parseDuration(duration);
  } else {
    msToAdd = duration;
  }

  const newTime = date.getTime() + msToAdd;
  return new Date(newTime).toISOString().split('.')[0];
}

/**
 * Check if a date is in the past relative to a reference date.
 */
function isPast(dateStr: string, referenceDateStr: string): boolean {
  const date = new Date(dateStr);
  const refDate = new Date(referenceDateStr);
  return date < refDate;
}

/**
 * Validate a "yyyy-MM-ddTHH:mm:ss" date string.
 */
function isValidDateStr(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate an ISO 8601 duration string.
 */
function isValidDurationStr(durationStr: string): boolean {
  const regex = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;
  if (!regex.test(durationStr)) return false;
  return durationStr.length > 1 && durationStr !== 'PT';
}

/**
 * Format a Date object to "yyyy-MM-ddTHH:mm:ss".
 */
function formatDate(date: Date): string {
  const pad = function (num: number): string { return (num < 10 ? '0' : '') + num; };
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds());
}

/**
 * Format a date or date string to 12-hour format "yyyy-MM-ddThh:mm:ss AM/PM".
 */
function formatDate12Hr(date: Date | string): string {
  const pad = function (num: number): string { return (num < 10 ? '0' : '') + num; };
  const d = (typeof date === 'string') ? new Date(date) : date;
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    'T' + pad(hours) +
    ':' + pad(d.getMinutes()) +
    ':' + pad(d.getSeconds()) +
    ' ' + ampm;
}

/**
 * Get day of week string from a date or date string.
 */
function getDow(date: Date | string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = (typeof date === 'string') ? new Date(date) : date;
  return days[d.getDay()];
}

/**
 * Clamp a timestamp between optional min and max bounds.
 */
function clampTime(minTime: string | null, maxTime: string | null, inputTime: string): string {
  if (maxTime !== null && inputTime > maxTime) {
    return maxTime;
  }
  if (minTime !== null && inputTime < minTime) {
    return minTime;
  }
  return inputTime;
}

/**
 * Count the number of midnights that have passed between two timestamps.
 */
function getMidnightsPassed(oldTime: string, newTime: string): number {
  const oldMs = Date.parse(oldTime);
  const newMs = Date.parse(newTime);
  const oldDays = Math.floor(oldMs / 86400000);
  const newDays = Math.floor(newMs / 86400000);
  return newDays - oldDays;
}

export {
  parseDuration,
  addDuration,
  isPast,
  isValidDateStr,
  isValidDurationStr,
  formatDate,
  formatDate12Hr,
  getDow,
  clampTime,
  getMidnightsPassed
};

/**
 * Time utilities for handling ISO 8601 durations and datetime strings.
 *
 * These utilities handle:
 * - Parsing ISO 8601 duration strings (e.g., "PT1H30M", "P1DT2H")
 * - Adding durations to datetime strings
 * - Validating datetime and duration formats
 * - Formatting dates in various formats
 * - Time comparisons and calculations
 */

/**
 * Parse an ISO 8601 duration string and return the total milliseconds.
 * Format: P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S
 * Example: "PT1H30M" = 1 hour 30 minutes = 5400000 ms
 */
function parseDuration(durationStr: string): number {
  const regex = /P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)W)?(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?)?/;
  const matches = durationStr.match(regex);

  if (!matches) {
    return 0;
  }

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
 * Add a duration to a datetime string and return the new datetime.
 * Returns format: "yyyy-mm-ddTHH:MM:SS" (without milliseconds or timezone)
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
 * Check if a datetime is in the past relative to a reference datetime.
 */
function isPast(dateStr: string, referenceDateStr: string): boolean {
  const date = new Date(dateStr);
  const refDate = new Date(referenceDateStr);
  return date < refDate;
}

/**
 * Check if a string is a valid datetime in "yyyy-mm-ddTHH:MM:SS" format.
 */
function isValidDateStr(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Check if a string is a valid ISO 8601 duration format.
 * Examples: "PT1H30M", "P1DT2H", "PT5S"
 */
function isValidDurationStr(durationStr: string): boolean {
  const regex = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;
  if (!regex.test(durationStr)) {
    return false;
  }
  // Must have at least one time component after P
  return durationStr.length > 1 && durationStr !== 'PT';
}

/**
 * Format a Date object to "yyyy-mm-ddTHH:MM:SS".
 */
function formatDate(date: Date): string {
  const pad = (num: number): string => (num < 10 ? '0' : '') + num;
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds());
}

/**
 * Format a Date object or datetime string to "yyyy-mm-ddTHH:MM:SS AM/PM".
 */
function formatDate12Hr(date: Date | string): string {
  const pad = (num: number): string => (num < 10 ? '0' : '') + num;
  const d = (typeof date === 'string') ? new Date(date) : date;
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    'T' + pad(hours) +
    ':' + pad(d.getMinutes()) +
    ':' + pad(d.getSeconds()) +
    ' ' + ampm;
}

/**
 * Get the day of week name for a date.
 */
function getDow(date: Date | string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = (typeof date === 'string') ? new Date(date) : date;
  return days[d.getDay()];
}

/**
 * Clamp a timestamp between optional minimum and maximum bounds.
 */
function clampTime(minTime: string | null, maxTime: string | null, inputTime: string): string {
  // Clamp to maxTime if inputTime is later
  if (maxTime !== null && inputTime > maxTime) {
    return maxTime;
  }

  // Clamp to minTime if inputTime is earlier
  if (minTime !== null && inputTime < minTime) {
    return minTime;
  }

  // Otherwise return as-is
  return inputTime;
}

/**
 * Calculate the number of midnights that passed between two timestamps.
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

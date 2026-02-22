/** Parse an ISO 8601 duration string into milliseconds. */
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

/** Add an ISO 8601 duration to a date string. Uses strict arithmetic to avoid JS Date timezone bugs. */
function addDuration(dateStr: string, duration: string | number): string {
  let msToAdd: number;
  if (typeof duration === 'string') {
    msToAdd = parseDuration(duration);
  } else {
    msToAdd = duration;
  }

  // Parse YYYY-MM-DDTHH:mm:ss manually
  const parts = dateStr.split('T');  if (parts.length !== 2) return dateStr;

  const dateParts = parts[0].split('-');
  const timeParts = parts[1].split(':');

  if (dateParts.length !== 3 || timeParts.length !== 3) return dateStr;

  let y = parseInt(dateParts[0], 10);
  let m = parseInt(dateParts[1], 10) - 1; // 0-indexed month
  let d = parseInt(dateParts[2], 10);
  let h = parseInt(timeParts[0], 10);
  let min = parseInt(timeParts[1], 10);
  let s = parseInt(timeParts[2], 10);

  // UTC avoids local time zone shifts across centuries
  const date = new Date(Date.UTC(y, m, d, h, min, s));
  // JS maps year 0-99 to 1900-1999
  if (y < 100) {
    date.setUTCFullYear(y);
  }

  date.setTime(date.getTime() + msToAdd);

  y = date.getUTCFullYear();
  m = date.getUTCMonth() + 1;
  d = date.getUTCDate();
  h = date.getUTCHours();
  min = date.getUTCMinutes();
  s = date.getUTCSeconds();

  const pad = (num: number) => num.toString().padStart(2, '0');
  const padYear = (num: number) => num.toString().padStart(4, '0');

  return `${padYear(y)}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}`;
}

function isPast(dateStr: string, referenceDateStr: string): boolean {
  return dateStr < referenceDateStr; // ISO strings sort naturally
}

function isValidDateStr(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isValidDurationStr(durationStr: string): boolean {
  const regex = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;
  if (!regex.test(durationStr)) return false;
  return durationStr.length > 1 && durationStr !== 'PT';
}

function formatDate(date: Date): string {
  const pad = function (num: number): string { return (num < 10 ? '0' : '') + num; };
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds());
}

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

function getDow(date: Date | string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = (typeof date === 'string') ? new Date(date) : date;
  return days[d.getDay()];
}

function clampTime(minTime: string | null, maxTime: string | null, inputTime: string): string {
  if (maxTime !== null && inputTime > maxTime) {
    return maxTime;
  }
  if (minTime !== null && inputTime < minTime) {
    return minTime;
  }
  return inputTime;
}

function getMidnightsPassed(oldTime: string, newTime: string): number {
  const oldMs = Date.parse(oldTime + 'Z');
  const newMs = Date.parse(newTime + 'Z');
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

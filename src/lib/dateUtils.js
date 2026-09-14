export function pad2(value) {
  return String(value ?? '').padStart(2, '0');
}

export function parseDateValue(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return validCalendarDate(year, month, day);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/').map(Number);
    return validCalendarDate(year, month, day);
  }

  const timestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(raw);
  if (!timestamp) return null;
  const [,year,month,day,hour,minute,second,zone] = timestamp;
  if (!validCalendarDate(Number(year),Number(month),Number(day)) || Number(hour)>23 || Number(minute)>59 || Number(second)>59) return null;
  if (zone !== 'Z') {
    const [offsetHours,offsetMinutes] = zone.slice(1).split(':').map(Number);
    if (offsetHours>14 || offsetMinutes>59 || (offsetHours===14 && offsetMinutes!==0)) return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validCalendarDate(year, month, day) {
  if (year<1 || month<1 || month>12 || day<1 || day>31) return null;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12,0,0,0);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : null;
}

export function formatDisplayDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function toInputDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  return `${String(date.getFullYear()).padStart(4,'0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function todayDisplayDate() {
  return formatDisplayDate(todayInputDate());
}

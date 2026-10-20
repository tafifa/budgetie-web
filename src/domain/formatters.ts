/** Date, currency (IDR) and number helpers. Dates are plain `YYYY-MM-DD` strings in local time. */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (value: number) => String(value).padStart(2, '0');

/** Local calendar date of `date` as `YYYY-MM-DD`. */
export const toDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayKey = (): string => toDateKey(new Date());

/** `YYYY-MM` for a `YYYY-MM-DD` key or a Date. */
export const monthKey = (value: string | Date = new Date()): string =>
  typeof value === 'string' ? value.slice(0, 7) : toDateKey(value).slice(0, 7);

const parts = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day: day || 1 };
};

/** "Oct 2026" for a `YYYY-MM` or `YYYY-MM-DD` key. */
export const monthLabel = (key: string): string => {
  const { year, month } = parts(key);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

/** "18 Oct 2026". */
export const formatDate = (key: string): string => {
  const { year, month, day } = parts(key);
  return `${pad(day)} ${MONTH_NAMES[month - 1]} ${year}`;
};

export const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

/** Adds months to a `YYYY-MM-DD` key, clamping the day to the target month's length. */
export const addMonthsClamped = (key: string, months: number): string => {
  const { year, month, day } = parts(key);
  const index = month - 1 + months;
  const targetYear = year + Math.floor(index / 12);
  const targetMonth = (((index % 12) + 12) % 12) + 1;
  const targetDay = Math.min(Math.max(day, 1), daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
};

export const formatIdr = (amount: number): string => {
  const negative = amount < 0;
  const digits = String(Math.round(Math.abs(amount)));
  return `${negative ? '-' : ''}Rp ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};

/** Accepts "1.250.000", "1,250,000", "1250000,50" or "1250000.50". */
export const parseAmount = (value: string): number => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const commas = normalized.split(',').length - 1;
  const dots = normalized.split('.').length - 1;
  let cleaned: string;
  if (commas && dots) {
    // Both present: the last one is the decimal separator.
    cleaned =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '');
  } else if (commas) {
    // "1,5" is a decimal; "1,250,000" groups thousands.
    cleaned = commas > 1 ? normalized.replace(/,/g, '') : normalized.replace(',', '.');
  } else {
    // "1.5" is a decimal; "1.250.000" groups thousands.
    cleaned = dots > 1 ? normalized.replace(/\./g, '') : normalized;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Strict integer parse (Dart's int.tryParse): "3" -> 3, "3.5" / "" -> null. */
export const parseIntStrict = (value: string): number | null => (/^\s*[-+]?\d+\s*$/.test(value) ? Number.parseInt(value, 10) : null);

/** Rounds to 2 decimals, as stored amounts are. */
export const money = (value: number): number => Number(value.toFixed(2));

/** Local timestamp without timezone, matching the format the Dart app stored. */
export const localTimestamp = (date: Date = new Date()): string =>
  `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(
    date.getMilliseconds(),
  ).padStart(3, '0')}`;

/** Recent month options: `back` months before now (including this month) and `forward` after. */
export const monthOptions = (back: number, forward = 0, currentLabel = 'This month') => {
  const today = todayKey();
  const options: { value: string; label: string }[] = [];
  for (let offset = 0; offset < back; offset++) {
    const key = addMonthsClamped(today, -offset);
    options.push({ value: monthKey(key), label: offset === 0 ? currentLabel : monthLabel(key) });
  }
  for (let offset = 1; offset <= forward; offset++) {
    const key = addMonthsClamped(today, offset);
    options.push({ value: monthKey(key), label: monthLabel(key) });
  }
  return options;
};

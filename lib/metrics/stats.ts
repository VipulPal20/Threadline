/** Small pure helpers for the admin metrics. No database, so every number can be checked by hand. */

const DAY_MS = 86_400_000;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Gini coefficient of non-negative counts: 0 = everyone gets the same, near 1 = one person gets almost everything. */
export function gini(values: readonly number[]): number | null {
  const count = values.length;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (count < 2 || total === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  let weighted = 0;
  sorted.forEach((value, index) => {
    weighted += (index + 1) * value;
  });
  return (2 * weighted) / (count * total) - (count + 1) / count;
}

/** Share of the total held by the top 10% of people (at least one person), counting people with zero too. */
export function topDecileShare(values: readonly number[]): number | null {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.length === 0 || total === 0) return null;
  const take = Math.max(1, Math.ceil(values.length * 0.1));
  const top = [...values].sort((a, b) => b - a).slice(0, take);
  return top.reduce((sum, value) => sum + value, 0) / total;
}

export const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export const percent = (part: number, whole: number): number | null => (whole > 0 ? round((100 * part) / whole) : null);

/** Monday 00:00 UTC of the week containing the date, as YYYY-MM-DD. */
export function weekStart(date: Date): string {
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day)).toISOString().slice(0, 10);
}

/** Every week start from the week of `from` to the week of `to`, so empty weeks still appear as zeros. */
export function weekStarts(from: Date, to: Date): string[] {
  const weeks: string[] = [];
  for (let cursor = new Date(`${weekStart(from)}T00:00:00Z`).getTime(); cursor <= to.getTime(); cursor += 7 * DAY_MS) {
    weeks.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return weeks;
}

export const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

/** Quotes a CSV cell and defuses spreadsheet formulas (a leading = + - @ would otherwise run in Excel). */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (cells: ReadonlyArray<string | number | null | undefined>) => cells.map(csvCell).join(",");

export interface DateRange {
  from: Date;
  to: Date;
}

const MAX_RANGE_DAYS = 366;

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD. Defaults to the last 30 days; `to` includes the whole last day. */
export function parseRange(from: string | null | undefined, to: string | null | undefined, now = new Date()): DateRange {
  const isDate = (value: string | null | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
  const end = isDate(to) ? new Date(`${to}T23:59:59.999Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  let start = isDate(from) ? new Date(`${from}T00:00:00Z`) : new Date(end.getTime() - 30 * DAY_MS + 1);
  if (start > end) start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) start = new Date(end.getTime() - MAX_RANGE_DAYS * DAY_MS + 1);
  return { from: start, to: end };
}

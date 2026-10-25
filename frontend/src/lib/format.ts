type DateInput = Date | number | string;

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/** 14:05:09 — always 24-hour, for logs. */
export function formatClockTime(value: DateInput, language: string): string {
  return new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(toDate(value));
}

/** Oct 24, 2026, 2:05 PM / 2026年10月24日 下午2:05 */
export function formatDateTime(value: DateInput, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(toDate(value));
}

/** 10/24, 14:05 — compact, for lists. */
export function formatShortDateTime(value: DateInput, language: string): string {
  return new Intl.DateTimeFormat(language, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(toDate(value));
}

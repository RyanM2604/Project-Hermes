import { createHash } from "node:crypto";

const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

export function createSourceFingerprint(
  source: string,
  sourceId: string,
): string | null {
  const trimmedSourceId = sourceId.trim();

  if (!trimmedSourceId) {
    return null;
  }

  return createHash("sha256")
    .update(`${source}:${trimmedSourceId}`)
    .digest("hex");
}

export function parseRequiredDate(value: string): string | null {
  const match = ISO_DATE_TIME_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, , , offsetHour, offsetMinute] =
    match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const numericHour = Number(hour);
  const numericMinute = Number(minute);
  const numericSecond = Number(second);
  const numericOffsetHour = Number(offsetHour ?? 0);
  const numericOffsetMinute = Number(offsetMinute ?? 0);
  const daysInMonth = new Date(
    Date.UTC(numericYear, numericMonth, 0),
  ).getUTCDate();

  if (
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1 ||
    numericDay > daysInMonth ||
    numericHour > 23 ||
    numericMinute > 59 ||
    numericSecond > 59 ||
    numericOffsetHour > 14 ||
    numericOffsetMinute > 59 ||
    (numericOffsetHour === 14 && numericOffsetMinute !== 0)
  ) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

import type { TrimRange } from "../types";

export function clampTrimStart(
  start: number,
  end: number,
  duration: number,
  minSpan: number
): number {
  const safeDuration = Math.max(duration, 0);
  const safeMinSpan = Math.min(Math.max(minSpan, 0), safeDuration);
  const upperBound = Math.max(safeDuration - safeMinSpan, 0);
  const maxStart = Math.min(Math.max(end - safeMinSpan, 0), upperBound);

  return Math.min(Math.max(start, 0), maxStart);
}

export function clampTrimEnd(
  start: number,
  end: number,
  duration: number,
  minSpan: number
): number {
  const safeDuration = Math.max(duration, 0);
  const safeMinSpan = Math.min(Math.max(minSpan, 0), safeDuration);
  const lowerBound = Math.min(Math.max(start + safeMinSpan, safeMinSpan), safeDuration);

  return Math.max(Math.min(end, safeDuration), lowerBound);
}

export function getTrimDuration(trimRange: TrimRange): number {
  return Math.max(trimRange.endTime - trimRange.startTime, 0);
}

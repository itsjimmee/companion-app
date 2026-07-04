/** ET calendar helpers for scanner date ranges (polygon_scan.resolve_scan_dates port). */

export function formatDateEt(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2025';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

export function todayEt(): string {
  return formatDateEt(new Date());
}

export function parseIsoDate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T12:00:00`);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseIsoDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateEt(d);
}

export function weekdaysBetween(from: string, to: string): number {
  let count = 0;
  for (const d of iterWeekdays(from, to)) {
    count++;
    void d;
  }
  return count;
}

export function* iterWeekdays(from: string, to: string): Generator<string> {
  let start = from.slice(0, 10);
  let end = to.slice(0, 10);
  if (start > end) [start, end] = [end, start];

  const cur = parseIsoDate(start);
  const last = parseIsoDate(end);
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) yield formatDateEt(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

export function resolveScanDates(dateFrom: string, dateTo: string): {
  dateFrom: string;
  dateTo: string;
  adjusted: boolean;
  adjustmentNote?: string;
  error?: string;
} {
  let from = dateFrom.slice(0, 10);
  let to = dateTo.slice(0, 10);
  const notes: string[] = [];

  if (from > to) {
    [from, to] = [to, from];
  }

  // Snap to weekdays (holiday snap requires grouped data — weekend snap here)
  const snapNext = (s: string): string => {
    const d = parseIsoDate(s);
    for (let i = 0; i < 7; i++) {
      if (d.getDay() !== 0 && d.getDay() !== 6) return formatDateEt(d);
      d.setDate(d.getDate() + 1);
    }
    return s;
  };

  const snapPrev = (s: string): string => {
    const d = parseIsoDate(s);
    for (let i = 0; i < 7; i++) {
      if (d.getDay() !== 0 && d.getDay() !== 6) return formatDateEt(d);
      d.setDate(d.getDate() - 1);
    }
    return s;
  };

  const origFrom = from;
  const origTo = to;
  from = snapNext(from);
  if (from !== origFrom) notes.push(`From ${origFrom} → ${from}`);

  if (to < from) to = from;
  else {
    const d = parseIsoDate(to);
    if (d.getDay() === 0 || d.getDay() === 6) {
      const adj = snapPrev(to);
      if (adj !== origTo) notes.push(`To ${origTo} → ${adj}`);
      to = adj;
    }
  }
  if (to < from) to = from;

  return {
    dateFrom: from,
    dateTo: to,
    adjusted: notes.length > 0,
    adjustmentNote: notes.length ? notes.join('; ') : undefined,
  };
}

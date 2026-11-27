const HOUR = 3600000;
const DAY = 24 * HOUR;
const OFFSET = 7 * HOUR;
const PRESETS = ['TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'];
const UNITS = ['hour', 'day', 'week', 'month'];
const iso = (stamp) => new Date(stamp).toISOString();
const local = (stamp) => new Date(stamp + OFFSET);
const invalid = () => Object.assign(new Error('Bộ lọc báo cáo không hợp lệ.'), { statusCode: 400, code: 'ERR_OWNER_REPORT_QUERY' });

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004 */
function calendarStamp(year, month, day = 1) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date.getTime() - OFFSET;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004 */
function addMonths(stamp, count) {
  const date = local(stamp);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + count;
  const lastDay = local(calendarStamp(year, month + 1, 0)).getUTCDate();
  return calendarStamp(year, month, Math.min(date.getUTCDate(), lastDay));
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-005 */
export function parseLocalReportDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid();
  const stamp = Date.parse(`${value}T00:00:00.000+07:00`);
  if (!Number.isFinite(stamp) || local(stamp).toISOString().slice(0, 10) !== value) throw invalid();
  return stamp;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004 */
function presetRange(preset, now) {
  const date = local(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const midnight = calendarStamp(year, month, date.getUTCDate());
  const starts = {
    TODAY: midnight,
    WEEK: midnight - ((date.getUTCDay() + 6) % 7) * DAY,
    MONTH: calendarStamp(year, month),
    QUARTER: calendarStamp(year, Math.floor(month / 3) * 3),
    YEAR: calendarStamp(year, 0),
  };
  const start = starts[preset];
  const comparisonStart = preset === 'TODAY' ? start - DAY : preset === 'WEEK' ? start - 7 * DAY
    : addMonths(start, preset === 'MONTH' ? -1 : preset === 'QUARTER' ? -3 : -12);
  return { start, end: now, comparisonStart, comparisonEnd: start };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004 */
function customRange(query, now) {
  const start = parseLocalReportDate(query.startDate);
  const endDay = parseLocalReportDate(query.endDate);
  const today = local(now).toISOString().slice(0, 10);
  if (start > endDay || query.endDate > today || endDay + DAY > addMonths(start, 24)) throw invalid();
  const calendarEnd = endDay + DAY;
  const span = calendarEnd - start;
  return { start, end: Math.min(calendarEnd, now), comparisonStart: start - span, comparisonEnd: start };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#NFR-SOA-006 */
function resolutionFor(preset, span) {
  if (preset !== 'CUSTOM') return { TODAY: 'hour', WEEK: 'day', MONTH: 'day', QUARTER: 'week', YEAR: 'month' }[preset];
  return span <= 48 * HOUR ? 'hour' : span <= 92 * DAY ? 'day' : span <= 548 * DAY ? 'week' : 'month';
}

/**
 * Calendar arithmetic uses the approved Vietnamese +07 report clock, never
 * host-local Date getters; returned timestamps are UTC query boundaries.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-005
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006
 */
export function resolveOwnerReportTimeWindow(query = {}, now = new Date()) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw invalid();
  const preset = query.timeRange === undefined ? 'MONTH' : query.timeRange;
  if (!PRESETS.includes(preset)) throw invalid();
  const reference = new Date(now);
  if (now === null || !Number.isFinite(reference.getTime())) {
    throw Object.assign(new Error('Không thể xác minh thời điểm báo cáo.'), { statusCode: 500, code: 'ERR_OWNER_REPORT_TIME' });
  }
  const stamp = reference.getTime();
  const range = preset === 'CUSTOM' ? customRange(query, stamp) : presetRange(preset, stamp);
  return {
    preset, timezone: 'Asia/Ho_Chi_Minh', generatedAt: iso(stamp),
    startAt: iso(range.start), endAtExclusive: iso(range.end),
    comparisonStartAt: iso(range.comparisonStart), comparisonEndAtExclusive: iso(range.comparisonEnd),
    resolution: resolutionFor(preset, range.end - range.start),
  };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#NFR-SOA-006 */
function floorBucket(stamp, unit) {
  if (unit === 'hour') return Math.floor((stamp + OFFSET) / HOUR) * HOUR - OFFSET;
  const date = local(stamp);
  const midnight = calendarStamp(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (unit === 'month') return calendarStamp(date.getUTCFullYear(), date.getUTCMonth());
  return unit === 'week' ? midnight - ((date.getUTCDay() + 6) % 7) * DAY : midnight;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#NFR-SOA-002 */
function bucketLabel(stamp, unit) {
  const date = local(stamp).toISOString();
  return unit === 'hour' ? `${date.slice(0, 13).replace('T', ' ')}:00`
    : unit === 'month' ? date.slice(0, 7) : unit === 'week' ? `Tuần ${date.slice(0, 10)}` : date.slice(0, 10);
}

/**
 * Empty buckets are temporal only, without fabricated metric zeroes or snapshots.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006
 */
export function buildOwnerReportBuckets(window, { comparison = false } = {}) {
  const start = Date.parse(comparison ? window.comparisonStartAt : window.startAt);
  const end = Date.parse(comparison ? window.comparisonEndAtExclusive : window.endAtExclusive);
  const unit = window.resolution;
  if (!UNITS.includes(unit) || !Number.isFinite(start) || !Number.isFinite(end) || start > end) throw invalid();
  const buckets = [];
  let cursor = floorBucket(start, unit);
  while (cursor < end) {
    const next = unit === 'month' ? addMonths(cursor, 1) : cursor + (unit === 'hour' ? HOUR : unit === 'week' ? 7 * DAY : DAY);
    buckets.push({ startAt: iso(Math.max(cursor, start)), endAtExclusive: iso(Math.min(next, end)), label: bucketLabel(cursor, unit) });
    cursor = next;
  }
  return buckets;
}

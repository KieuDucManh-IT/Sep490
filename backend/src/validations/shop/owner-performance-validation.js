import { z } from 'zod';

export const OWNER_REPORT_PRESETS = ['TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'];
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  timeRange: z.enum(OWNER_REPORT_PRESETS).default('MONTH'),
  startDate: localDate.optional(),
  endDate: localDate.optional(),
}).strict().superRefine((query, context) => {
  if (query.timeRange === 'CUSTOM' && (!query.startDate || !query.endDate)) {
    context.addIssue({ code: 'custom', message: 'CUSTOM requires both dates.' });
  }
  if (query.timeRange !== 'CUSTOM' && (query.startDate !== undefined || query.endDate !== undefined)) {
    context.addIssue({ code: 'custom', message: 'Dates require CUSTOM.' });
  }
});

/**
 * Transport shape validation; calendar/future/duration validation follows in
 * resolveOwnerReportTimeWindow, using the same injected now for the request.
 * Never return Zod issues or caller values across the error boundary.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-005
 */
export function validateOwnerPerformanceQuery(query = {}) {
  const result = querySchema.safeParse(query);
  if (!result.success) {
    throw Object.assign(new Error('Bộ lọc báo cáo không hợp lệ.'), {
      statusCode: 400, code: 'ERR_OWNER_REPORT_QUERY',
    });
  }
  return result.data;
}

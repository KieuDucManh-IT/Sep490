import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchOwnerPerformanceReport, ownerPerformanceQuery } from '../services/owner-performance-api';

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-019 */
export default function useOwnerPerformanceReport(initialFilters = {}) {
  const { user, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState({ timeRange: 'MONTH', startDate: '', endDate: '', ...initialFilters });
  const [revision, setRevision] = useState(0), [state, setState] = useState({ key: null, data: null, error: null });
  const sequence = useRef(0);
  const identity = user?._id || user?.id || '';
  const role = String(user?.Role || user?.role || '').toLowerCase().replace(/[\s_-]/g, '');
  const allowed = Boolean(identity) && ['owner', 'shopowner'].includes(role) && !authLoading;
  let query;
  try { query = ownerPerformanceQuery(filters); } catch (_) { query = `invalid:${filters.timeRange}:${filters.startDate}:${filters.endDate}`; }
  const key = JSON.stringify([identity, role, Boolean(authLoading), query, revision]);
  useEffect(() => {
    const controller = new AbortController(), request = ++sequence.current;
    let active = true;
    setState({ key, data: null, error: null });
    if (allowed) {
      fetchOwnerPerformanceReport(filters, { signal: controller.signal }).then((data) => {
        if (active && request === sequence.current) setState({ key, data, error: null });
      }).catch((error) => {
        if (active && request === sequence.current && error.name !== 'AbortError') setState({ key, data: null, error: error.message });
      });
    }
    return () => { active = false; controller.abort(); };
    // The transport query excludes locally retained CUSTOM dates for preset requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, allowed]);
  const updateFilters = useCallback((next) => setFilters((previous) => ({ ...previous, ...next })), []);
  const retry = useCallback(() => setRevision((previous) => previous + 1), []);
  const visible = state.key === key ? state : { data: null, error: null };
  return { filters, updateFilters, retry, data: visible.data, error: visible.error,
    loading: Boolean(authLoading) || (allowed && !visible.data && !visible.error), forbidden: !authLoading && !allowed };
}

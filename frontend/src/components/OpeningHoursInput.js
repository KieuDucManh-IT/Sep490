import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Form } from 'react-bootstrap';

export const DAY_OPTIONS = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ Nhật',
];

/**
 * Parse formatted opening hours string into structured time and day object
 */
export const parseOpeningHours = (hoursStr) => {
  const defaultVal = {
    fromTime: '09:00',
    toTime: '21:30',
    fromDay: 'Thứ 2',
    toDay: 'Chủ Nhật',
  };

  if (!hoursStr || typeof hoursStr !== 'string') return defaultVal;

  const timeMatch = hoursStr.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (timeMatch) {
    defaultVal.fromTime = timeMatch[1].padStart(5, '0');
    defaultVal.toTime = timeMatch[2].padStart(5, '0');
  }

  const daysMatch = hoursStr.match(/\((.*?)\)/);
  if (daysMatch) {
    const parts = daysMatch[1].split(/[-–—]/).map((s) => s.trim());
    if (parts.length === 2) {
      if (DAY_OPTIONS.includes(parts[0])) defaultVal.fromDay = parts[0];
      if (DAY_OPTIONS.includes(parts[1])) defaultVal.toDay = parts[1];
    } else if (parts.length === 1 && DAY_OPTIONS.includes(parts[0])) {
      defaultVal.fromDay = parts[0];
      defaultVal.toDay = parts[0];
    }
  }

  return defaultVal;
};

/**
 * Format structured time and day values into standardized opening hours string
 */
export const formatOpeningHours = (fTime, tTime, fDay, tDay) => {
  const dayStr = fDay === tDay ? fDay : `${fDay} - ${tDay}`;
  return `${fTime || '09:00'} - ${tTime || '21:30'} (${dayStr})`;
};

/**
 * OpeningHoursInput - Component for configuring branch store operating hours and days
 */
export default function OpeningHoursInput({
  value,
  onChange,
  isInvalid = false,
  errorMessage = '',
  error = '',
  disabled = false,
  label = 'Thời Gian Mở Cửa & Hoạt Động',
  required = true,
  className = '',
}) {
  const effectiveError = errorMessage || error || '';
  const effectiveIsInvalid = isInvalid || Boolean(error);
  const parsed = parseOpeningHours(value);
  const [fromTime, setFromTime] = useState(parsed.fromTime);
  const [toTime, setToTime] = useState(parsed.toTime);
  const [fromDay, setFromDay] = useState(parsed.fromDay);
  const [toDay, setToDay] = useState(parsed.toDay);

  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      const p = parseOpeningHours(value);
      setFromTime(p.fromTime);
      setToTime(p.toTime);
      setFromDay(p.fromDay);
      setToDay(p.toDay);
      lastEmittedRef.current = value;
    }
  }, [value]);

  const handleChange = (newFTime, newTTime, newFDay, newTDay) => {
    setFromTime(newFTime);
    setToTime(newTTime);
    setFromDay(newFDay);
    setToDay(newTDay);

    const formatted = formatOpeningHours(newFTime, newTTime, newFDay, newTDay);
    lastEmittedRef.current = formatted;
    if (onChange) {
      onChange(formatted);
    }
  };

  const fromDayIndex = DAY_OPTIONS.indexOf(fromDay);
  const toDayIndex = DAY_OPTIONS.indexOf(toDay);
  const isTimeOrderInvalid = Boolean(fromTime && toTime && toTime <= fromTime);
  const isDayOrderInvalid = Boolean(fromDayIndex !== -1 && toDayIndex !== -1 && toDayIndex < fromDayIndex);
  const hasError = effectiveIsInvalid || isTimeOrderInvalid || isDayOrderInvalid;
  const currentFormatted = formatOpeningHours(fromTime, toTime, fromDay, toDay);

  const handleFromDayChange = (newFromDay) => {
    const newFromIdx = DAY_OPTIONS.indexOf(newFromDay);
    const currToIdx = DAY_OPTIONS.indexOf(toDay);
    let newToDay = toDay;
    if (newFromIdx !== -1 && currToIdx !== -1 && currToIdx < newFromIdx) {
      newToDay = newFromDay;
    }
    handleChange(fromTime, toTime, newFromDay, newToDay);
  };

  return (
    <div className={`opening-hours-picker-container ${className}`}>
      {label && (
        <Form.Label
          className="d-flex align-items-center gap-1 mb-2"
          style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{label}</span>
          {required && <span className="text-danger">*</span>}
        </Form.Label>
      )}

      <div
        className="p-3 rounded-2 border"
        style={{
          background: '#F8FAFC',
          borderColor: hasError ? '#EF4444' : '#E2E8F0',
          transition: 'border-color 0.15s ease',
        }}
      >
        <Row className="g-3">
          <Col sm={6}>
            <div className="d-flex align-items-center gap-1 mb-1 text-muted" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              <span>Giờ Hoạt Động</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ flex: 1 }}>
                <div className="text-muted mb-1" style={{ fontSize: '10.5px', fontWeight: 600 }}>TỪ GIỜ</div>
                <Form.Control
                  type="time"
                  required={required}
                  disabled={disabled}
                  value={fromTime}
                  isInvalid={isTimeOrderInvalid}
                  onChange={(e) => handleChange(e.target.value, toTime, fromDay, toDay)}
                  style={{ fontSize: '13px', borderRadius: '6px', padding: '6px 10px', background: '#FFFFFF' }}
                  title="Giờ mở cửa"
                />
              </div>
              <div style={{ flex: 1 }}>
                <div className="text-muted mb-1" style={{ fontSize: '10.5px', fontWeight: 600 }}>ĐẾN GIỜ</div>
                <Form.Control
                  type="time"
                  required={required}
                  disabled={disabled}
                  value={toTime}
                  isInvalid={isTimeOrderInvalid}
                  onChange={(e) => handleChange(fromTime, e.target.value, fromDay, toDay)}
                  style={{ fontSize: '13px', borderRadius: '6px', padding: '6px 10px', background: '#FFFFFF' }}
                  title="Giờ đóng cửa"
                />
              </div>
            </div>
          </Col>

          <Col sm={6}>
            <div className="d-flex align-items-center gap-1 mb-1 text-muted" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              <span>Lịch Thứ Trong Tuần</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ flex: 1 }}>
                <div className="text-muted mb-1" style={{ fontSize: '10.5px', fontWeight: 600 }}>TỪ THỨ</div>
                <Form.Select
                  disabled={disabled}
                  value={fromDay}
                  isInvalid={isDayOrderInvalid}
                  onChange={(e) => handleFromDayChange(e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '6px', padding: '6px 10px', background: '#FFFFFF' }}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Form.Select>
              </div>
              <div style={{ flex: 1 }}>
                <div className="text-muted mb-1" style={{ fontSize: '10.5px', fontWeight: 600 }}>ĐẾN THỨ</div>
                <Form.Select
                  disabled={disabled}
                  value={toDay}
                  isInvalid={isDayOrderInvalid}
                  onChange={(e) => handleChange(fromTime, toTime, fromDay, e.target.value)}
                  style={{ fontSize: '13px', borderRadius: '6px', padding: '6px 10px', background: '#FFFFFF' }}
                >
                  {DAY_OPTIONS.map((d, idx) => (
                    <option key={d} value={d} disabled={idx < fromDayIndex}>
                      {d}{idx < fromDayIndex ? ' (Không hợp lệ)' : ''}
                    </option>
                  ))}
                </Form.Select>
              </div>
            </div>
          </Col>
        </Row>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2 pt-2 border-top" style={{ borderColor: '#E2E8F0', fontSize: '11.5px' }}>
          <div className="text-muted">
            Hiển thị trên hồ sơ: <span className="fw-semibold text-dark">{currentFormatted}</span>
          </div>

          {isTimeOrderInvalid && isDayOrderInvalid ? (
            <div className="text-danger fw-semibold" style={{ fontSize: '11.5px' }}>
              Giờ đóng cửa phải sau giờ mở cửa & Thứ kết thúc phải sau Thứ bắt đầu
            </div>
          ) : isTimeOrderInvalid ? (
            <div className="text-danger fw-semibold" style={{ fontSize: '11.5px' }}>
              Giờ đóng cửa phải sau giờ mở cửa ({fromTime})
            </div>
          ) : isDayOrderInvalid ? (
            <div className="text-danger fw-semibold" style={{ fontSize: '11.5px' }}>
              Thứ kết thúc ({toDay}) phải sau hoặc cùng Thứ bắt đầu ({fromDay}) trong tuần
            </div>
          ) : effectiveError ? (
            <div className="text-danger fw-semibold" style={{ fontSize: '11.5px' }}>
              {effectiveError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

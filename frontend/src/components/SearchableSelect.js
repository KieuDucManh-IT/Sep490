import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export function normalizeVietnamese(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Chọn một mục...',
  searchPlaceholder = 'Tìm kiếm nhanh...',
  isInvalid = false,
  disabled = false,
  id,
  allowClear = false,
  clearLabel = '-- Bỏ chọn / Để trống --',
  renderItem,
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt) };
      }
      return {
        ...opt,
        value: String(opt.value ?? opt._id ?? opt.id ?? ''),
        label: String(opt.label ?? opt.name ?? opt.FullName ?? opt.title ?? ''),
      };
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === '') return null;
    return normalizedOptions.find((o) => String(o.value) === String(value)) || null;
  }, [normalizedOptions, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const cleanSearch = normalizeVietnamese(searchTerm);

    return normalizedOptions.filter((opt) => {
      const labelMatch = normalizeVietnamese(opt.label).includes(cleanSearch);
      const subMatch = opt.subLabel ? normalizeVietnamese(opt.subLabel).includes(cleanSearch) : false;
      const emailMatch = opt.email ? normalizeVietnamese(opt.email).includes(cleanSearch) : false;
      const phoneMatch = opt.phone ? normalizeVietnamese(opt.phone).includes(cleanSearch) : false;
      const valueMatch = normalizeVietnamese(opt.value).includes(cleanSearch);
      return labelMatch || subMatch || emailMatch || phoneMatch || valueMatch;
    });
  }, [normalizedOptions, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = useCallback(
    (opt) => {
      if (onChange) {
        onChange(opt.value, opt);
      }
      setIsOpen(false);
      setSearchTerm('');
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    if (onChange) {
      onChange('', null);
    }
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);

  return (
    <div
      ref={containerRef}
      className={`vestora-searchable-select ${disabled ? 'disabled' : ''} ${isInvalid ? 'is-invalid' : ''} ${isOpen ? 'open' : ''}`}
      style={{ position: 'relative', width: '100%', ...style }}
      id={id}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`vestora-select-control ${isOpen ? 'active' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`${id || 'vestora-select'}-listbox`}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: disabled ? '#F3F4F6' : '#FFFFFF',
          border: isInvalid ? '1.5px solid #EF4444' : (isOpen ? '1.5px solid #D97706' : '1px solid #D1D5DB'),
          borderRadius: '10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '42px',
          boxShadow: isOpen ? '0 0 0 3px rgba(217, 119, 6, 0.12)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          {selectedOption ? (
            <>
              {selectedOption.avatar && (
                <img
                  src={selectedOption.avatar}
                  alt={selectedOption.label}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <span
                style={{
                  fontSize: '13.5px',
                  fontWeight: 500,
                  color: '#111827',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#FEF3C7',
                    color: '#92400E',
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
          {allowClear && selectedOption && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              title="Xóa lựa chọn"
              style={{
                border: 'none',
                background: 'none',
                color: '#9CA3AF',
                cursor: 'pointer',
                padding: '2px',
                fontSize: '14px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
          <span
            style={{
              color: '#6B7280',
              fontSize: '11px',
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {isOpen && (
        <div
          className="vestora-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #ECE7DD',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 1060,
            overflow: 'hidden',
            animation: 'fadeInMenu 0.15s ease-out',
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6', background: '#FAF9F6' }}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9CA3AF',
                  fontSize: '12px',
                }}
              >
                🔍
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  fontSize: '12.5px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '7px',
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div
            id={`${id || 'vestora-select'}-listbox`}
            role="listbox"
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {allowClear && (
              <div
                onClick={handleClear}
                style={{
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  color: '#6B7280',
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  borderBottom: '1px dashed #E5E7EB',
                  marginBottom: '2px',
                }}
              >
                {clearLabel}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  fontSize: '12.5px',
                  color: '#9CA3AF',
                  textAlign: 'center',
                }}
              >
                Không tìm thấy kết quả phù hợp cho &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedOption && String(selectedOption.value) === String(opt.value);

                if (renderItem) {
                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleSelect(opt)}
                      style={{ cursor: 'pointer' }}
                    >
                      {renderItem(opt, isSelected)}
                    </div>
                  );
                }

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? 'rgba(217, 119, 6, 0.08)' : 'transparent',
                      color: isSelected ? '#B45309' : '#1F2937',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                      {opt.avatar && (
                        <img
                          src={opt.avatar}
                          alt={opt.label}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '1px solid #E5E7EB',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: '#FEF3C7',
                                color: '#92400E',
                                flexShrink: 0,
                              }}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {(opt.subLabel || opt.email || opt.phone) && (
                          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '1px' }}>
                            {[opt.subLabel, opt.email, opt.phone].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span style={{ color: '#D97706', fontSize: '14px', marginLeft: '8px' }}>✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

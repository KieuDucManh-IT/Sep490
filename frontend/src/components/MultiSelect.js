import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export default function MultiSelect({ options, value = [], onChange, placeholder = 'Chọn...' }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedValues = Array.isArray(value) ? value : [];
  const selectedOptions = useMemo(
    () => selectedValues.map((id) => options.find((option) => option.value === id)).filter(Boolean),
    [options, selectedValues]
  );
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const toggle = (option) => {
    const nextValues = selectedValues.includes(option.value)
      ? selectedValues.filter((id) => id !== option.value)
      : [...selectedValues, option.value];
    onChange(nextValues);
  };

  return <div className="wm-multi-select" ref={rootRef}>
    <div className="wm-multi-select-control" onClick={() => setOpen(true)}>
      <div className="wm-multi-select-content">
        {selectedOptions.map((option) => <span className="wm-multi-select-chip" key={option.value}>
          {option.label}
          <button type="button" aria-label={`Bỏ ${option.label}`} onClick={(event) => { event.stopPropagation(); toggle(option); }}><X size={13} /></button>
        </span>)}
        <input
          type="text"
          value={query}
          placeholder={selectedOptions.length ? '' : placeholder}
          aria-label="Tìm loại sản phẩm"
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && filteredOptions[0]) {
              event.preventDefault();
              toggle(filteredOptions[0]);
            }
          }}
        />
      </div>
      <div className="wm-multi-select-actions">
        {selectedValues.length > 0 && <button type="button" aria-label="Xóa tất cả lựa chọn" onClick={(event) => { event.stopPropagation(); onChange([]); }}><X size={17} /></button>}
        <button type="button" aria-label={open ? 'Đóng danh sách' : 'Mở danh sách'} aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}><ChevronDown size={17} /></button>
      </div>
    </div>
    {open && <div className="wm-multi-select-menu" role="listbox" aria-multiselectable="true">
      {filteredOptions.length ? filteredOptions.map((option) => <label role="option" aria-selected={selectedValues.includes(option.value)} className="wm-multi-select-option" key={option.value}>
        <input type="checkbox" checked={selectedValues.includes(option.value)} onChange={() => toggle(option)} />
        <span>{option.label}</span>
      </label>) : <div className="wm-multi-select-empty">Không tìm thấy loại sản phẩm.</div>}
    </div>}
  </div>;
}

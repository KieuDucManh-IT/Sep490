import React, { useEffect, useRef, useState } from 'react';

export default function SearchableSelect({ value, options, onChange, placeholder, searchPlaceholder, emptyText }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value));
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="searchable-select" ref={root}>
      <button type="button" className="searchable-select-trigger" onClick={() => { setOpen((shown) => !shown); setQuery(''); }} aria-expanded={open}>
        <span>{selected?.label || placeholder}</span><span aria-hidden="true">⌄</span>
      </button>
      {open && <div className="searchable-select-menu">
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder || 'Tìm kiếm...'} aria-label={searchPlaceholder || 'Tìm kiếm'} />
        <div className="searchable-select-options">
          {filtered.length ? filtered.map((option) => <button type="button" key={option.value} className={String(option.value) === String(value) ? 'selected' : ''} onClick={() => { onChange(option.value); setOpen(false); }}>
            {option.label}
          </button>) : <span className="searchable-select-empty">{emptyText || 'Không có kết quả'}</span>}
        </div>
      </div>}
    </div>
  );
}

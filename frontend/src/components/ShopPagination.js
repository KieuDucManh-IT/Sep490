import React from 'react';

export default function ShopPagination({ page, pages, pageSize, onPageChange, onPageSizeChange }) {
  const pageCount = Math.max(1, pages || 1);
  const numbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => {
    const start = Math.max(1, Math.min(page - 2, pageCount - 4));
    return start + index;
  });
  const jump = (next) => onPageChange(Math.max(1, Math.min(pageCount, next)));
  return <div className="shop-products-pagination">
    <button aria-label="Trang đầu" disabled={page <= 1} onClick={() => jump(1)}>«</button>
    <button aria-label="Trang trước" disabled={page <= 1} onClick={() => jump(page - 1)}>‹</button>
    {numbers.map((number) => <button key={number} className={number === page ? 'active' : ''} aria-current={number === page ? 'page' : undefined} onClick={() => jump(number)}>{number}</button>)}
    <button aria-label="Trang sau" disabled={page >= pageCount} onClick={() => jump(page + 1)}>›</button>
    <button aria-label="Trang cuối" disabled={page >= pageCount} onClick={() => jump(pageCount)}>»</button>
    <select aria-label="Số dòng mỗi trang" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
      {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
    </select>
  </div>;
}

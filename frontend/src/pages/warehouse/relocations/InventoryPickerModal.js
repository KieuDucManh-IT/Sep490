import React, { useMemo, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Pagination } from '../../../components/warehouse';
import { PICKER_PAGE_SIZE, filterAvailable } from './relocationHelpers';

/**
 * Chọn các dòng tồn (biến thể tại một kệ, còn hàng khả dụng) để đưa vào phiếu tách / gộp.
 * Dữ liệu là báo cáo tồn đã tải sẵn, nên tìm và phân trang ngay trên trình duyệt.
 */
export default function InventoryPickerModal({ inventory, onHide, onAdd }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState([]);

  const available = useMemo(() => filterAvailable(inventory, query), [inventory, query]);
  const visible = available.slice((page - 1) * PICKER_PAGE_SIZE, page * PICKER_PAGE_SIZE);
  const allVisibleChosen = visible.length > 0 && visible.every((row) => chosen.includes(row.key));

  const toggleRow = (key) => setChosen((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  const toggleVisible = () => setChosen((keys) => {
    if (allVisibleChosen) return keys.filter((key) => !visible.some((row) => row.key === key));
    return [...new Set([...keys, ...visible.map((row) => row.key)])];
  });

  const add = () => onAdd(inventory.filter((row) => chosen.includes(row.key)));

  return (
    <Modal show onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <div>
          <small className="wh-page-eyebrow">TỒN KHO</small>
          <Modal.Title as="h5">Chọn sản phẩm / biến thể</Modal.Title>
        </div>
      </Modal.Header>
      <Modal.Body>
        <label className="wm-search-field">
          Tìm theo tên, SKU hoặc vị trí
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </label>
        <div className="wm-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Chọn cả trang" checked={allVisibleChosen} onChange={toggleVisible} />
                </th>
                <th>Sản phẩm / biến thể</th>
                <th>Vị trí</th>
                <th>Khả dụng</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.key}>
                  <td><input type="checkbox" checked={chosen.includes(row.key)} onChange={() => toggleRow(row.key)} /></td>
                  <td>{[row.productName, row.productCode, row.sku, row.size, row.color].filter(Boolean).join(' · ')}</td>
                  <td>{row.storagePath}</td>
                  <td>{row.quantityAvailable}</td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan="4">Không tìm thấy hàng hóa phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={page} limit={PICKER_PAGE_SIZE} total={available.length} onChange={setPage} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Đóng</Button>
        <Button variant="dark" onClick={add} disabled={!chosen.length}>Thêm hàng hóa đã chọn ({chosen.length})</Button>
      </Modal.Footer>
    </Modal>
  );
}

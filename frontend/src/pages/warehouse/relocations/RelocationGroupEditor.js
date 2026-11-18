import React from 'react';
import { Button } from 'react-bootstrap';
import { codeAndName, idOf } from '../shared/slipHelpers';
import { allocatedTotal } from './relocationHelpers';

function ShelfSelect({ value, shelves, onChange, placeholder = 'Chọn kệ đích' }) {
  return (
    <select required value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {shelves.map((shelf) => <option key={shelf._id} value={shelf._id}>{codeAndName(shelf)}</option>)}
    </select>
  );
}

/**
 * Một mặt hàng trong phiếu tách / gộp.
 * Tách: kệ nguồn cố định, chọn nhiều kệ đích + số lượng. Gộp: nhiều kệ nguồn (cố định), chọn một kệ đích.
 */
export default function RelocationGroupEditor({ group, isSplit, shelves, shelfCode, onChange, onRemove }) {
  const setPlace = (index, patch) => onChange({
    ...group,
    places: group.places.map((place, i) => (i === index ? { ...place, ...patch } : place)),
  });
  const removePlace = (index) => onChange({ ...group, places: group.places.filter((_, i) => i !== index) });
  const addPlace = () => onChange({ ...group, places: [...group.places, { storageId: '', quantity: 1 }] });

  const sourceIds = group.places.map((place) => idOf(place.storageId));
  const mergeTargets = shelves.filter((shelf) => !sourceIds.includes(idOf(shelf)));
  const splitTargetsFor = (index) => shelves.filter((shelf) => idOf(shelf) !== idOf(group.fromStorageId)
    && !group.places.some((other, i) => i !== index && idOf(other.storageId) === idOf(shelf)));

  return (
    <section className="wm-relocation-group">
      <div className="wm-relocation-group-header">
        <strong>{group.label}</strong>
        <Button size="sm" variant="outline-secondary" onClick={onRemove}>Xóa hàng</Button>
      </div>
      {isSplit ? (
        <small>Nguồn: {shelfCode(group.fromStorageId)} · Khả dụng: {group.available}</small>
      ) : (
        <label>
          Kệ đích
          <ShelfSelect value={group.toStorageId} shelves={mergeTargets} onChange={(toStorageId) => onChange({ ...group, toStorageId })} />
        </label>
      )}
      <div className="wm-relocation-places">
        {group.places.map((place, index) => (
          <div className="wm-relocation-place-row" key={index}>
            {isSplit ? (
              <ShelfSelect value={place.storageId} shelves={splitTargetsFor(index)}
                onChange={(storageId) => setPlace(index, { storageId })} />
            ) : (
              <select required value={place.storageId} disabled aria-label="Kệ nguồn">
                <option value={place.storageId}>{shelfCode(place.storageId)}</option>
              </select>
            )}
            <input
              required
              type="number"
              min="1"
              aria-label="Số lượng"
              max={isSplit ? group.available : place.available}
              value={place.quantity}
              onChange={(event) => setPlace(index, { quantity: event.target.value })}
            />
            <Button size="sm" variant="outline-secondary" onClick={() => removePlace(index)}>Xóa kệ</Button>
          </div>
        ))}
      </div>
      {isSplit && (
        <>
          <Button size="sm" variant="outline-secondary" onClick={addPlace}>+ Thêm kệ</Button>
          <small> Tổng phân bổ: {allocatedTotal(group.places)} / {group.available}</small>
        </>
      )}
    </section>
  );
}

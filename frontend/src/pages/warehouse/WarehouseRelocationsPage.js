
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import WarehouseSidebar from '../../components/WarehouseSidebar';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import inventoryReportService from '../../services/warehouse/inventoryReportService';
import stockRelocationService from '../../services/warehouse/stockRelocationService';

import '../../styles/WarehouseManager.css';
import '../../styles/WarehouseUx.css';

const id = (v) => String(v?._id || v || '');

const empty = () => ({
  storageId: '',
  quantity: 1
});

export default function WarehouseRelocationsPage({
  mode = 'manager',
  operationType = ''
}) {
  const manager = mode === 'manager';

  // =========================
  // STATE
  // =========================

  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [storages, setStorages] = useState([]);
  const [staff, setStaff] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [show, setShow] = useState(false);
  const [picker, setPicker] = useState(false);

  const [chosen, setChosen] = useState([]);
  const [groups, setGroups] = useState([]);

  const [assigned, setAssigned] = useState('');

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [error, setError] = useState('');

  // =========================
  // LOAD DATA
  // =========================

  const load = useCallback(async () => {
    try {
      setError('');

      const relocationRows =
        await stockRelocationService.list(operationType);

      setRows(relocationRows || []);

      if (manager) {
        const [ls, ss, st] = await Promise.all([
          inventoryLocationService.list(),
          storageLocationService.list(),
          stockRelocationService.listStaff()
        ]);

        const w = ls.filter(
          x =>
            x.type === 'warehouse' &&
            x.status === 'active'
        );

        const central = w.length === 1 ? w[0] : null;

        setLocations(ls || []);

        setStorages(
          (ss || []).filter(
            x =>
              x.type === 'shelf' &&
              x.status === 'active' &&
              id(x.locationId) === id(central)
          )
        );

        setStaff(st || []);

        if (central) {
          const result = await inventoryReportService.get({
            locationId: central._id,
            storageLevel: 'shelf',
            itemLevel: 'variant'
          });

          setInventory(result.items || []);
        } else {
          setInventory([]);
        }
      }
    } catch (e) {
      setError(e.message);
    }
  }, [manager, operationType]);

  useEffect(() => {
    load();
  }, [load]);

  // =========================
  // FILTER INVENTORY
  // =========================

  const available = useMemo(() => {
    return inventory
      .filter(
        x =>
          x.storageId &&
          Number(x.quantityAvailable) > 0
      )
      .filter(x => {
        if (!query) return true;

        const keyword = [
          x.productName,
          x.productCode,
          x.sku,
          x.size,
          x.color,
          x.storagePath
        ]
          .join(' ')
          .toLowerCase();

        return keyword.includes(query.toLowerCase());
      });
  }, [inventory, query]);

  // =========================
  // PAGINATION
  // =========================

  const visible = available.slice(
    (page - 1) * 10,
    page * 10
  );

  const pages = Math.max(
    1,
    Math.ceil(available.length / 10)
  );

  // =========================
  // SELECT ALL
  // =========================

  const selectAll = () => {
    setChosen(keys => {
      const allVisibleSelected = visible.every(
        x => keys.includes(x.key)
      );

      if (allVisibleSelected) {
        return keys.filter(
          k => !visible.some(x => x.key === k)
        );
      }

      return [
        ...new Set([
          ...keys,
          ...visible.map(x => x.key)
        ])
      ];
    });
  };

  // =========================
  // ADD GOODS
  // =========================

  const addGoods = () => {
    const selected = inventory.filter(
      x => chosen.includes(x.key)
    );

    setGroups(old => {
      const next = old.map(g => ({
        ...g,
        places: [...g.places]
      }));

      selected.forEach(r => {
        let g;

        if (operationType === 'split') {
          // Tách riêng theo biến thể và kệ nguồn
          g = next.find(
            x =>
              id(x.variantId) === id(r.variantId) &&
              id(x.fromStorageId) === id(r.storageId)
          );

          if (!g) {
            next.push({
              variantId: r.variantId,

              label: [
                r.productName,
                r.sku,
                r.size,
                r.color
              ]
                .filter(Boolean)
                .join(' · '),

              fromStorageId: r.storageId,

              available: Number(r.quantityAvailable),

              places: [
                empty(),
                empty()
              ]
            });
          }
        } else {
          // Gộp theo biến thể
          g = next.find(
            x => id(x.variantId) === id(r.variantId)
          );

          const source = {
            storageId: r.storageId,
            quantity: Number(r.quantityAvailable),
            available: Number(r.quantityAvailable)
          };

          if (g) {
            const existed = g.places.some(
              p => id(p.storageId) === id(r.storageId)
            );

            if (!existed) {
              g.places.push(source);
            }
          } else {
            next.push({
              variantId: r.variantId,

              label: [
                r.productName,
                r.sku,
                r.size,
                r.color
              ]
                .filter(Boolean)
                .join(' · '),

              toStorageId: '',

              places: [source]
            });
          }
        }
      });

      return next;
    });

    setChosen([]);
    setPicker(false);
  };

  // =========================
  // ADD SHELF
  // =========================

  const addShelf = (gi) => {
    setGroups(prev =>
      prev.map((g, i) =>
        i === gi
          ? {
              ...g,
              places: [
                ...g.places,
                empty()
              ]
            }
          : g
      )
    );
  };

  // =========================
  // REMOVE SHELF
  // =========================

  const removeShelf = (gi, pi) => {
    setGroups(prev =>
      prev.map((g, i) =>
        i === gi
          ? {
              ...g,
              places: g.places.filter(
                (_, index) => index !== pi
              )
            }
          : g
      )
    );
  };

  // =========================
  // REMOVE GOODS
  // =========================

  const removeGoods = (gi) => {
    setGroups(prev =>
      prev.filter((_, i) => i !== gi)
    );
  };

  // =========================
  // UPDATE PLACE
  // =========================

  const setPlace = (gi, pi, patch) => {
    setGroups(all =>
      all.map((g, i) =>
        i === gi
          ? {
              ...g,
              places: g.places.map((p, j) =>
                j === pi
                  ? { ...p, ...patch }
                  : p
              )
            }
          : g
      )
    );
  };

  // =========================
  // UPDATE MERGE DESTINATION
  // =========================

  const setDestination = (gi, value) => {
    setGroups(prev =>
      prev.map((g, i) =>
        i === gi
          ? {
              ...g,
              toStorageId: value
            }
          : g
      )
    );
  };

  // =========================
  // VALIDATE FORM
  // =========================

  const validateGroups = () => {
    if (!groups.length) {
      return 'Vui lòng thêm ít nhất một mặt hàng.';
    }

    for (const g of groups) {
      if (!g.places.length) {
        return `Mặt hàng ${g.label} chưa có kệ được chọn.`;
      }

      if (operationType === 'split') {
        let totalQuantity = 0;

        const selectedShelves = [];

        for (const p of g.places) {
          if (!p.storageId) {
            return `Vui lòng chọn kệ đích cho ${g.label}.`;
          }

          if (id(p.storageId) === id(g.fromStorageId)) {
            return `Kệ đích không được trùng kệ nguồn của ${g.label}.`;
          }

          const quantity = Number(p.quantity);

          if (!Number.isInteger(quantity) || quantity <= 0) {
            return `Số lượng phân bổ của ${g.label} phải là số nguyên lớn hơn 0.`;
          }

          if (selectedShelves.includes(id(p.storageId))) {
            return `Không được chọn trùng kệ đích cho ${g.label}.`;
          }

          selectedShelves.push(id(p.storageId));

          totalQuantity += quantity;
        }

        if (totalQuantity > Number(g.available)) {
          return `Tổng số lượng phân bổ của ${g.label} vượt quá số lượng khả dụng (${g.available}).`;
        }
      } else {
        if (!g.toStorageId) {
          return `Vui lòng chọn kệ đích cho ${g.label}.`;
        }

        const sourceIds = g.places.map(
          p => id(p.storageId)
        );

        if (sourceIds.includes(id(g.toStorageId))) {
          return `Kệ đích không được trùng với kệ nguồn của ${g.label}.`;
        }

        for (const p of g.places) {
          const quantity = Number(p.quantity);

          if (!Number.isInteger(quantity) || quantity <= 0) {
            return `Số lượng gộp của ${g.label} phải là số nguyên lớn hơn 0.`;
          }

          if (quantity > Number(p.available)) {
            return `Số lượng lấy từ kệ nguồn của ${g.label} vượt quá tồn khả dụng.`;
          }
        }
      }
    }

    return '';
  };

  // =========================
  // CREATE RELOCATION
  // =========================

  const create = async (e) => {
    e.preventDefault();

    try {
      setError('');

      if (!assigned) {
        setError('Vui lòng chọn nhân viên kho.');
        return;
      }

      const validationError = validateGroups();

      if (validationError) {
        setError(validationError);
        return;
      }

      const items = groups.flatMap(g =>
        g.places.map(p =>
          operationType === 'split'
            ? {
                variantId: g.variantId,
                fromStorageId: g.fromStorageId,
                toStorageId: p.storageId,
                quantity: Number(p.quantity)
              }
            : {
                variantId: g.variantId,
                fromStorageId: p.storageId,
                toStorageId: g.toStorageId,
                quantity: Number(p.quantity)
              }
        )
      );

      await stockRelocationService.create({
        assignedStaffId: assigned,
        operationType,
        items
      });

      setShow(false);
      setGroups([]);
      setAssigned('');
      setChosen([]);

      await load();
    } catch (e2) {
      setError(e2.message);
    }
  };

  // =========================
  // STORAGE NAME
  // =========================

  const storageName = s =>
    `${s.code} · ${s.name}`;

  const getStorageCode = storageId =>
    storages.find(
      s => id(s) === id(storageId)
    )?.code || 'Không xác định';

  // =========================
  // RENDER
  // =========================

  return (
    <div className="wm-layout">
      <WarehouseSidebar mode={mode} />

      <main className="wm-main">

        {/* HEADER */}

        <header className="wm-header">
          <div>
            <span>WAREHOUSE</span>

            <h1>
              {operationType === 'split'
                ? 'Tách tồn kho'
                : 'Gộp tồn kho'}
            </h1>
          </div>

          {manager && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setShow(true);
              }}
            >
              Tạo phiếu
            </button>
          )}
        </header>

        {/* ERROR */}

        {error && (
          <div className="wm-error">
            {error}
          </div>
        )}

        {/* RELOCATION TABLE */}

        <section className="wm-panel">
          <div className="wm-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Nhân viên</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {rows.map(r => (
                  <tr key={r._id}>
                    <td>{r.relocationCode}</td>

                    <td>
                      {r.assignedStaffId?.FullName}
                    </td>

                    <td>{r.status}</td>

                    <td />
                  </tr>
                ))}

                {!rows.length && (
                  <tr>
                    <td colSpan="4">
                      Chưa có phiếu tách/gộp tồn kho.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* CREATE MODAL */}

        {show && (
          <div className="wm-modal-backdrop">
            <section className="wm-crud-modal">

              <header>
                <div>
                  <h2>Tạo phiếu</h2>
                </div>

                <button
                  className="secondary"
                  type="button"
                  onClick={() => setShow(false)}
                >
                  Đóng
                </button>
              </header>

              <form onSubmit={create}>

                {/* ASSIGN STAFF */}

                <label>
                  Nhân viên kho

                  <select
                    required
                    value={assigned}
                    onChange={e =>
                      setAssigned(e.target.value)
                    }
                  >
                    <option value="">
                      Chọn nhân viên
                    </option>

                    {staff.map(s => (
                      <option
                        key={s._id}
                        value={s._id}
                      >
                        {s.FullName}
                      </option>
                    ))}
                  </select>
                </label>

                {/* ADD GOODS BUTTON */}

                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setError('');
                    setPicker(true);
                  }}
                >
                  + Thêm hàng hóa
                </button>

                {/* GOODS GROUPS */}

                {groups.map((g, gi) => (
                  <section
                    className="wm-relocation-group"
                    key={
                      operationType === 'split'
                        ? `${id(g.variantId)}-${id(g.fromStorageId)}`
                        : id(g.variantId)
                    }
                  >

                    {/* GROUP HEADER */}

                    <div className="wm-relocation-group-header">
                      <strong>{g.label}</strong>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => removeGoods(gi)}
                      >
                        Xóa hàng
                      </button>
                    </div>

                    {/* SPLIT SOURCE */}

                    {operationType === 'split' ? (
                      <small>
                        Nguồn: {getStorageCode(g.fromStorageId)}
                        {' · '}
                        Khả dụng: {g.available}
                      </small>
                    ) : (
                      /* MERGE DESTINATION */

                      <label>
                        Kệ đích

                        <select
                          required
                          value={g.toStorageId}
                          onChange={e =>
                            setDestination(
                              gi,
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            Chọn kệ đích
                          </option>

                          {storages
                            .filter(
                              s =>
                                !g.places.some(
                                  p =>
                                    id(p.storageId) === id(s._id)
                                )
                            )
                            .map(s => (
                              <option
                                key={s._id}
                                value={s._id}
                              >
                                {storageName(s)}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}

                    {/* SHELF ROWS */}

                    <div className="wm-relocation-places">

                      {g.places.map((p, pi) => (
                        <div
                          className="wm-relocation-place-row"
                          key={pi}
                        >

                          {/* SHELF */}

                          {operationType === 'split' ? (
                            <select
                              required
                              value={p.storageId}
                              onChange={e =>
                                setPlace(
                                  gi,
                                  pi,
                                  {
                                    storageId: e.target.value
                                  }
                                )
                              }
                            >
                              <option value="">
                                Chọn kệ đích
                              </option>

                              {storages
                                .filter(
                                  s =>
                                    id(s._id) !== id(g.fromStorageId) &&
                                    !g.places.some(
                                      (other, index) =>
                                        index !== pi &&
                                        id(other.storageId) === id(s._id)
                                    )
                                )
                                .map(s => (
                                  <option
                                    key={s._id}
                                    value={s._id}
                                  >
                                    {storageName(s)}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <select
                              required
                              value={p.storageId}
                              disabled
                            >
                              <option value={p.storageId}>
                                {getStorageCode(p.storageId)}
                              </option>
                            </select>
                          )}

                          {/* QUANTITY */}

                          <input
                            required
                            type="number"
                            min="1"
                            max={
                              operationType === 'split'
                                ? g.available
                                : p.available
                            }
                            value={p.quantity}
                            onChange={e =>
                              setPlace(
                                gi,
                                pi,
                                {
                                  quantity: e.target.value
                                }
                              )
                            }
                          />

                          {/* REMOVE SHELF */}

                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              removeShelf(gi, pi)
                            }
                          >
                            Xóa kệ
                          </button>

                        </div>
                      ))}

                    </div>

                    {/* ADD SHELF BUTTON */}

                    {operationType === 'split' && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => addShelf(gi)}
                      >
                        + Thêm kệ
                      </button>
                    )}

                    {/* SPLIT QUANTITY SUMMARY */}

                    {operationType === 'split' && (
                      <small>
                        Tổng phân bổ:{' '}
                        {g.places.reduce(
                          (sum, p) =>
                            sum + (
                              Number(p.quantity) > 0
                                ? Number(p.quantity)
                                : 0
                            ),
                          0
                        )}
                        {' / '}
                        {g.available}
                      </small>
                    )}

                  </section>
                ))}

                {/* SUBMIT */}

                <footer>
                  <button
                    type="submit"
                    disabled={!groups.length}
                  >
                    Tạo và giao nhân viên
                  </button>
                </footer>

              </form>
            </section>
          </div>
        )}

        {/* INVENTORY PICKER MODAL */}

        {picker && (
          <div className="wm-modal-backdrop wm-inventory-picker-backdrop">

            <section className="wm-crud-modal wm-relocation-inventory-modal">

              <header>
                <div>
                  <small>TỒN KHO</small>
                  <h2>Chọn sản phẩm / biến thể</h2>
                </div>

                <button
                  className="secondary"
                  type="button"
                  onClick={() => setPicker(false)}
                >
                  Đóng
                </button>
              </header>

              {/* SEARCH */}

              <label className="wm-search-field">
                Tìm kiếm

                <input
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>

              {/* INVENTORY TABLE */}

              <div className="wm-table-wrap">
                <table>

                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            visible.length > 0 &&
                            visible.every(
                              x => chosen.includes(x.key)
                            )
                          }
                          onChange={selectAll}
                        />
                      </th>

                      <th>Sản phẩm / biến thể</th>
                      <th>Vị trí</th>
                      <th>Khả dụng</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visible.map(r => (
                      <tr key={r.key}>

                        <td>
                          <input
                            type="checkbox"
                            checked={chosen.includes(r.key)}
                            onChange={() =>
                              setChosen(k =>
                                k.includes(r.key)
                                  ? k.filter(x => x !== r.key)
                                  : [...k, r.key]
                              )
                            }
                          />
                        </td>

                        <td>
                          {[
                            r.productName,
                            r.productCode,
                            r.sku,
                            r.size,
                            r.color
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </td>

                        <td>{r.storagePath}</td>

                        <td>{r.quantityAvailable}</td>

                      </tr>
                    ))}

                    {!visible.length && (
                      <tr>
                        <td colSpan="4">
                          Không tìm thấy hàng hóa phù hợp.
                        </td>
                      </tr>
                    )}
                  </tbody>

                </table>
              </div>

              {/* PAGINATION */}

              <div className="wm-pagination">

                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() =>
                    setPage(p => Math.max(1, p - 1))
                  }
                >
                  Trước
                </button>

                <span>
                  {page}/{pages}
                </span>

                <button
                  type="button"
                  disabled={page === pages}
                  onClick={() =>
                    setPage(p => Math.min(pages, p + 1))
                  }
                >
                  Sau
                </button>

              </div>

              {/* ADD SELECTED GOODS */}

              <footer>
                <button
                  type="button"
                  onClick={addGoods}
                  disabled={!chosen.length}
                >
                  Thêm hàng hóa đã chọn ({chosen.length})
                </button>
              </footer>

            </section>
          </div>
        )}

      </main>
    </div>
  );
}

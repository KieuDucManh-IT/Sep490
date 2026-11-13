
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

      // Lấy danh sách phiếu tách/gộp
      setRows(
        await stockRelocationService.list(operationType)
      );

      if (manager) {
        const [ls, ss, st] = await Promise.all([
          inventoryLocationService.list(),
          storageLocationService.list(),
          stockRelocationService.listStaff()
        ]);

        // Xác định kho tổng đang hoạt động
        const w = ls.filter(
          x =>
            x.type === 'warehouse' &&
            x.status === 'active'
        );

        const central = w.length === 1 ? w[0] : null;

        setLocations(ls);

        // Lấy danh sách kệ thuộc kho tổng
        setStorages(
          ss.filter(
            x =>
              x.type === 'shelf' &&
              x.status === 'active' &&
              id(x.locationId) === id(central)
          )
        );

        setStaff(st);

        // Lấy tồn kho theo kệ và biến thể
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

  // Phân trang: 10 sản phẩm/trang
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
        let g = next.find(
          x => id(x.variantId) === id(r.variantId)
        );

        // -------------------------
        // SPLIT INVENTORY
        // -------------------------

        if (operationType === 'split') {
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

              available: r.quantityAvailable,

              places: [
                empty(),
                empty()
              ]
            });
          }
        }

        // -------------------------
        // MERGE INVENTORY
        // -------------------------

        else {
          const source = {
            storageId: r.storageId,
            quantity: r.quantityAvailable,
            available: r.quantityAvailable
          };

          if (g) {
            // Tránh thêm trùng kệ nguồn
            if (
              !g.places.some(
                p =>
                  id(p.storageId) === id(r.storageId)
              )
            ) {
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
  // CREATE RELOCATION
  // =========================

  const create = async (e) => {
    e.preventDefault();

    try {
      setError('');

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

      await load();
    } catch (e2) {
      setError(e2.message);
    }
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
  // STORAGE NAME
  // =========================

  const storageName = s =>
    `${s.code} · ${s.name}`;

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
            <button onClick={() => setShow(true)}>
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
                    onChange={e => setAssigned(e.target.value)}
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
                  onClick={() => setPicker(true)}
                >
                  + Thêm hàng hóa
                </button>

                {/* GOODS GROUPS */}

                {groups.map((g, gi) => (
                  <section
                    className="wm-relocation-group"
                    key={id(g.variantId)}
                  >
                    <strong>{g.label}</strong>

                    {/* SPLIT SOURCE */}

                    {operationType === 'split' ? (
                      <small>
                        Nguồn:{' '}
                        {
                          storages.find(
                            s =>
                              id(s) === id(g.fromStorageId)
                          )?.code
                        }

                        {' · '}

                        Khả dụng: {g.available}
                      </small>
                    ) : (
                      // MERGE DESTINATION
                      <label>
                        Kệ đích

                        <select
                          required
                          value={g.toStorageId}
                          onChange={e =>
                            setGroups(a =>
                              a.map((x, i) =>
                                i === gi
                                  ? {
                                      ...x,
                                      toStorageId: e.target.value
                                    }
                                  : x
                              )
                            )
                          }
                        >
                          <option value="">
                            Chọn kệ đích
                          </option>

                          {storages.map(s => (
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

                    {/* SOURCE / DESTINATION PLACES */}

                    <div className="wm-relocation-places">

                      {g.places.map((p, pi) => (
                        <div key={pi}>

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
                            {operationType === 'split' ? (
                              <>
                                <option value="">
                                  Chọn kệ đích
                                </option>

                                {storages.map(s => (
                                  <option
                                    key={s._id}
                                    value={s._id}
                                  >
                                    {storageName(s)}
                                  </option>
                                ))}
                              </>
                            ) : (
                              <option value={p.storageId}>
                                {
                                  storages.find(
                                    s =>
                                      id(s) === id(p.storageId)
                                  )?.code
                                }
                              </option>
                            )}
                          </select>

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

                        </div>
                      ))}

                    </div>
                  </section>
                ))}

                {/* SUBMIT */}

                <footer>
                  <button
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
                  </tbody>

                </table>
              </div>

              {/* PAGINATION */}

              <div className="wm-pagination">

                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Trước
                </button>

                <span>
                  {page}/{pages}
                </span>

                <button
                  type="button"
                  disabled={page === pages}
                  onClick={() => setPage(page + 1)}
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

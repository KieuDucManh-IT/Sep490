import { useEffect, useState } from 'react';
import inboundReceiptService from '../../../services/warehouse/inboundReceiptService';
import inventoryLocationService from '../../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import supplierService from '../../../services/masterdata/supplierService';

/** Kho tổng, kệ đang hoạt động; chủ kho cần thêm nhà cung cấp và nhân viên để tạo phiếu. */
export default function useInboundMasterData(isManager) {
  const [data, setData] = useState({ centralLocation: null, shelves: [], suppliers: [], staff: [], error: '' });
  useEffect(() => {
    let active = true;
    Promise.all([
      inventoryLocationService.list(),
      storageLocationService.list(),
      isManager ? supplierService.list() : Promise.resolve([]),
      isManager ? inboundReceiptService.listStaff() : Promise.resolve([]),
    ])
      .then(([locations, storages, suppliers, staff]) => {
        const centrals = locations.filter((row) => row.type === 'warehouse' && row.status === 'active');
        if (!active) return;
        setData({
          centralLocation: centrals.length === 1 ? centrals[0] : null,
          shelves: storages.filter((row) => row.type === 'shelf' && row.status === 'active'),
          suppliers: suppliers.filter((row) => row.status === 'active'),
          staff: staff || [],
          error: '',
        });
      })
      .catch((loadError) => {
        if (active) setData((old) => ({ ...old, error: loadError.message }));
      });
    return () => {
      active = false;
    };
  }, [isManager]);
  return data;
}

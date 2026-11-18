import { useEffect, useState } from 'react';
import inventoryLocationService from '../../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import productVariantService from '../../../services/masterdata/productVariantService';
import productService from '../../../services/masterdata/productService';
import stocktakeService from '../../../services/warehouse/stocktakeService';

const isActive = (row) => row.status === 'active' && row.isDeleted !== true;
const isActiveVariant = (variant) => isActive(variant)
  && variant.productId?.status === 'active'
  && variant.productId?.isDeleted !== true;

/**
 * Dữ liệu danh mục cho màn kiểm kê: kho tổng, vị trí, sản phẩm / biến thể đang hoạt động
 * và (với chủ kho) danh sách nhân viên để giao phiếu.
 */
export default function useStocktakeMasterData(isManager) {
  const [data, setData] = useState({ central: null, storages: [], variants: [], products: [], staff: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [locations, storages, variants, products, staff] = await Promise.all([
        inventoryLocationService.list(),
        storageLocationService.list(),
        productVariantService.list(),
        isManager ? productService.list() : Promise.resolve([]),
        isManager ? stocktakeService.listStaff() : Promise.resolve([]),
      ]);
      const centrals = locations.filter((row) => row.type === 'warehouse' && row.status === 'active');
      return {
        central: centrals.length === 1 ? centrals[0] : null,
        storages: storages.filter((row) => row.status === 'active'),
        variants: variants.filter(isActiveVariant),
        products: products.filter(isActive),
        staff: staff || [],
      };
    };
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [isManager]);

  return { ...data, error };
}

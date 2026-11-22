import api from '../api';
import { createCrudService } from '../../generic/createCrudService';

const PATH = '/warehouse/locations/inventoryLocations';

const inventoryLocationService = {
  ...createCrudService(PATH),
  /** Kho tổng đang hoạt động kèm `currentQuantity` (số đang chứa) — màn "Thiết lập kho tổng". */
  central: async () => (await api.get(`${PATH}/central`)).data,
};

export default inventoryLocationService;

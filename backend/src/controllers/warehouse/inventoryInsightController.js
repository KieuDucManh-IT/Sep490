import { getCentralCapacity, getItemHistory } from '../../services/warehouse/inventoryInsightService.js';

const respond = (work) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await work(req) });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

export const itemHistory = respond((req) => getItemHistory(req.params.id, req.query));
export const centralCapacity = respond(() => getCentralCapacity());

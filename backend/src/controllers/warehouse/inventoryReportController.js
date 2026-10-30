import { getIndividualItemDetails, getInventoryReport } from '../../services/warehouse/inventoryReportService.js';

export const inventoryReport = async (req, res, next) => {
  try {
    res.json({ success: true, data: await getInventoryReport(req.query) });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

export const inventoryReportDetails = async (req, res, next) => {
  try {
    const items = await getIndividualItemDetails(req.query);
    res.json({ success: true, data: items });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

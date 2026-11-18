import {
  getBranchAvailability, getBranchInventoryItemDetails, getBranchInventoryReport,
} from '../../services/warehouse/branchInventoryReportService.js';

const handleError = (error, res, next) => {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

export const branchInventoryReport = async (req, res, next) => {
  try { res.json({ success: true, data: await getBranchInventoryReport(req.user, req.query) }); }
  catch (error) { handleError(error, res, next); }
};

export const branchInventoryReportDetails = async (req, res, next) => {
  try { res.json({ success: true, data: await getBranchInventoryItemDetails(req.user, req.query) }); }
  catch (error) { handleError(error, res, next); }
};

export const branchAvailability = async (req, res, next) => {
  try { res.json({ success: true, data: await getBranchAvailability(req.user, req.query) }); }
  catch (error) { handleError(error, res, next); }
};

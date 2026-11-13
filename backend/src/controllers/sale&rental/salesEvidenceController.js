import {
  salesEvidenceService,
} from '../../services/sale&rental/salesEvidenceService.js';

export const authorizeSaleEvidenceUpload = async (
  req,
  res,
  next
) => {
  try {
    await salesEvidenceService.authorize(
      req.params.id,
      req.user,
      req.params.kind
    );

    next();
  } catch (error) {
    next(error);
  }
};

export const listSaleEvidence = async (
  req,
  res,
  next
) => {
  try {
    const data = await salesEvidenceService.list(
      req.params.id,
      req.user
    );

    res.set('Cache-Control', 'no-store');

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadSaleEvidence = async (
  req,
  res,
  next
) => {
  try {
    const data = await salesEvidenceService.upload(
      req.params.id,
      req.user,
      req.file,
      req.params.kind
    );

    res.set('Cache-Control', 'no-store');

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  } finally {
    req.releaseEvidenceUpload?.();
  }
};
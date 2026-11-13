import {
  rentalEvidenceService,
} from '../../services/sale&rental/rentalEvidenceService.js';

// Kiểm tra quyền trước khi nhận dữ liệu video.
export const authorizeEvidenceUpload = async (
  req,
  res,
  next
) => {
  try {
    await rentalEvidenceService.authorize(
      req.params.id,
      req.user,
      req.params.kind
    );

    next();
  } catch (error) {
    next(error);
  }
};

export const listEvidence = async (req, res, next) => {
  try {
    const data = await rentalEvidenceService.list(
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

export const uploadEvidence = async (
  req,
  res,
  next
) => {
  try {
    const data = await rentalEvidenceService.upload(
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
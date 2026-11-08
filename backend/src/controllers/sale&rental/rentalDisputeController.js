/**
 * Rental Dispute Controller
 * Xử lý khiếu nại đổi trả 24h
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009..REQ-RENT-012
 */

import * as rentalDisputeService from '../../services/sale&rental/rentalDisputeService.js';
import { RentalDispute } from '../../models/sale&rental/RentalDispute.js';

export const createClaim = async (req, res, next) => {
  const service = req?.deps?.rentalDisputeService || rentalDisputeService;
  try {
    const { id: rentalOrderId } = req.params;
    const { reason, description, evidenceImages } = req.body;

    const result = await service.createReturnClaim({
      rentalOrderId,
      customerId: req.user?._id,
      reason,
      description,
      evidenceImages,
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.dispute,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const respondClaim = async (req, res, next) => {
  const service = req?.deps?.rentalDisputeService || rentalDisputeService;
  try {
    const { id: disputeId } = req.params;
    const { decision, cskhNote } = req.body;

    const result = await service.respondReturnClaim({
      disputeId,
      decision,
      cskhNote,
      cskhStaffId: req.user?._id,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.dispute,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const confirmReceived = async (req, res, next) => {
  const service = req?.deps?.rentalDisputeService || rentalDisputeService;
  try {
    const { id: disputeId } = req.params;
    const { trackingNumber } = req.body;

    const result = await service.confirmReturnReceived({
      disputeId,
      trackingNumber,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.dispute,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const completeKCS = async (req, res, next) => {
  const service = req?.deps?.rentalDisputeService || rentalDisputeService;
  try {
    const { id: disputeId } = req.params;
    const { kcsResult, refundMethod, note } = req.body;

    const result = await service.completeDisputeKCS({
      disputeId,
      kcsResult,
      refundMethod,
      note,
      operatorId: req.user?._id,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.dispute,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getDisputeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dispute = await RentalDispute.findById(id)
      .populate('rentalOrderId')
      .populate('customerId', 'name phone email avatar')
      .lean();

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại',
      });
    }

    return res.status(200).json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

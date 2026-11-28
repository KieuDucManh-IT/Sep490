/**
 * Sales Order Routes
 * Quản lý vòng đời đơn mua trang phục (thanh lý / bán đứt)
 */

import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import * as salesOrderController from '../controllers/sale&rental/salesOrderController.js';
import * as salesReturnController from '../controllers/sale&rental/salesReturnController.js';
import { withStatus } from '../services/warehouse/orderStockService.js';
import { SalesOrder } from '../models/sale&rental/SalesOrder.js';
import * as salesFlow from '../services/sale&rental/salesOrderService.js';
import { createEvidenceUploadHandlers } from './rentalReturnRoutes.js';

const router = express.Router();

// Tất cả endpoints đơn mua đều yêu cầu đăng nhập
router.use(authMiddleware);

const handle = fn => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    await fn(req, res);
  } catch (error) {
    next(withStatus(error));
  }
};

router.get('/:id/return-flow', handle(async (req, res) => {
  res.json({
    success: true,
    data: await salesFlow.getSalesReturnFlow(req.user, req.params.id),
  });
}));

router.post('/:id/return/request', handle(async (req, res) => {
  const data = await salesFlow.requestSalesReturn(
    req.user,
    req.params.id,
    req.body.reason
  );

  res.json({
    success: true,
    message: 'Yêu cầu trả đã được chấp nhận. Vui lòng đợi đơn vị giao hàng đến lấy.',
    data,
  });
}));

router.post('/:id/return/simulate', handle(async (req, res) => {
  res.json({
    success: true,
    data: await salesFlow.advanceSalesReturn(
      req.user,
      req.params.id,
      req.body.newStatus
    ),
  });
}));

router.post('/:id/return/complete', handle(async (req, res) => {
  if (req.body.confirmed !== true) {
    return res.status(400).json({
      message: 'Cần xác nhận đã nhận đủ hàng nguyên vẹn.',
    });
  }

  res.json({
    success: true,
    data: await salesFlow.completeSalesReturn(req.user, req.params.id),
  });
}));

router.post(
  '/:id/evidence/:kind',
  ...createEvidenceUploadHandlers({
    Model: SalesOrder,
    checkAccess: salesFlow.checkSalesEvidenceAccess,
    folder: 'sales-evidence',
    statusFilter: kind => ({
      orderStatus: {
        $in: kind === 'packing'
          ? ['draft', 'confirmed', 'processing']
          : ['completed'],
      },
      returnStatus: kind === 'return-received'
        ? 'received'
        : kind === 'return'
          ? { $in: [null, 'none', 'requested'] }
          : { $ne: 'completed' },
    }),
  })
);

// 1. Tạo đơn mua mới (Khách hàng)
router.post('/', salesOrderController.createOrder);

// 2. Danh sách đơn mua của chính khách hàng
router.get('/my-orders', requireRole('customer'), salesOrderController.getMyOrders);

// 3. Danh sách đơn mua tại chi nhánh (Nhân viên chi nhánh / Staff / Admin)
router.get(
  '/branch/:locationId',
  requireRole('branchstaff', 'branchmanager', 'warehouse_staff', 'staff', 'admin'),
  salesOrderController.getBranchOrders
);

// TASK-015/016: trả hàng bán theo món (quản lý chi nhánh của đơn / admin; service kiểm chi nhánh).
router.get('/:id/returns', requireRole('branchmanager', 'admin'), salesReturnController.listReturns);
router.get('/:id/returnable-items', requireRole('branchmanager', 'admin'), salesReturnController.getReturnableItems);
router.post('/:id/returns', requireRole('branchmanager', 'admin'), salesReturnController.createReturn);

// 4. Chi tiết đơn mua của khách hàng theo ID
router.get('/:id', requireRole('customer'), salesOrderController.getOrderById);

// 5. Cập nhật trạng thái đơn mua (Nhân viên chi nhánh / Staff / Admin)
router.patch(
  '/:id/status',
  requireRole('branchstaff', 'branchmanager', 'warehouse_staff', 'staff', 'admin'),
  salesOrderController.updateOrderStatus
);

export default router;

import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';

import { SalesOrderEvidence } from '../../models/sale&rental/SalesOrderEvidence.js';

import {
  createRentalEvidenceService,
} from './rentalEvidenceService.js';

export const salesEvidenceService =
  createRentalEvidenceService({
    orders: SalesOrder,
    evidence: SalesOrderEvidence,

    orderIdField: 'salesOrderId',
    statusField: 'orderStatus',

    orderLabel: 'đơn mua',
    cloudFolder: 'sales-evidence',
  });
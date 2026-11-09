import React from 'react';
import { OrdersMonitoringView } from '../orders';

export default function BranchSaleOrdersPage() {
  return <OrdersMonitoringView type="sale" isBranch={true} />;
}

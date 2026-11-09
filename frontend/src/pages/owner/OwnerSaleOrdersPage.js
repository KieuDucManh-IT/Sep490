import React from 'react';
import { OrdersMonitoringView } from '../orders';

export default function OwnerSaleOrdersPage() {
  return <OrdersMonitoringView type="sale" isBranch={false} />;
}

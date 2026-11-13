import React from 'react';
import { OrdersMonitoringView } from '../orders';

export default function BranchRentalOrdersPage() {
  return (
    <OrdersMonitoringView
      type="rental"
      isBranch={true}
    />
  );
}
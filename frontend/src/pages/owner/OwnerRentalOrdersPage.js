import React from 'react';
import { OrdersMonitoringView } from '../orders';

export default function OwnerRentalOrdersPage() {
  return <OrdersMonitoringView type="rental" isBranch={false} />;
}

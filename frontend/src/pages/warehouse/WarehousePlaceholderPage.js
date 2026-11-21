import React from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/warehouse';
import WarehousePageLayout from './shared/WarehousePageLayout';

/** Trang tạm cho các phân hệ kho chưa làm (route cũ vẫn giữ để không vỡ link). */
export default function WarehousePlaceholderPage() {
  const { kind } = useParams();
  const title = decodeURIComponent(kind || '');
  return (
    <WarehousePageLayout>
      <PageHeader eyebrow="QUẢN LÝ KHO" title={title} />
      <section className="wm-panel">
        <p>Phân hệ {title.toLowerCase()} sẽ được triển khai ở bước tiếp theo.</p>
      </section>
    </WarehousePageLayout>
  );
}

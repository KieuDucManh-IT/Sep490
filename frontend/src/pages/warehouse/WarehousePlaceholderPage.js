import React from 'react';
import { useParams } from 'react-router-dom';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import '../../styles/WarehouseManager.css';

export default function WarehousePlaceholderPage() {
  const { kind } = useParams();
  const title = decodeURIComponent(kind || '');
  return <div className="wm-layout"><WarehouseSidebar /><main className="wm-main"><header className="wm-header"><div><span>WAREHOUSE MANAGER</span><h1>{title}</h1></div></header><section className="wm-panel"><p>Phân hệ {title.toLowerCase()} sẽ được triển khai ở bước tiếp theo.</p></section></main></div>;
}

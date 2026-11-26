import React from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Award,
  Shirt,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

function formatVnd(amount) {
  const num = Number(amount || 0);
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} ₫`;
}

function getOptimizedImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('f_auto')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_360/');
  }
  return url;
}

export default function BranchReportInventoryTab({
  stock = {},
  topProducts = [],
  slowMovingProducts = [],
}) {
  const stockTotal = Number(stock.totalUnits || 0);
  const stockRatio = (val) => (stockTotal > 0 ? `${(Number(val || 0) / stockTotal) * 100}%` : '0%');

  return (
    <div className="ba-tab-content">
      {/* Tình trạng tồn kho chi nhánh */}
      <section className="ba-card" aria-label="Tình trạng kho cửa hàng">
        <div className="ba-card__header">
          <div>
            <h2 className="ba-card__title">
              <Package size={18} aria-hidden="true" />
              <span>Tình Trạng Kho Tại Chi Nhánh ({stockTotal} đơn vị)</span>
            </h2>
            <p className="ba-card__subtitle">
              Tổng hợp đồng thời sản phẩm theo số lượng (InventoryBalance) và mã định danh (InventoryItem)
            </p>
          </div>
          <Link to="/branch/inventory" className="ba-link-action">
            <span>Chi tiết tồn kho</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="ba-stock-bar" aria-hidden="true">
          <div
            className="ba-stock-bar__seg--available"
            style={{ width: stockRatio(stock.available) }}
          />
          <div
            className="ba-stock-bar__seg--rented"
            style={{ width: stockRatio(stock.rented) }}
          />
          <div
            className="ba-stock-bar__seg--inspecting"
            style={{ width: stockRatio(stock.inspecting) }}
          />
          <div
            className="ba-stock-bar__seg--maintenance"
            style={{ width: stockRatio(stock.maintenance) }}
          />
          <div
            className="ba-stock-bar__seg--reserved"
            style={{ width: stockRatio(stock.reserved) }}
          />
        </div>

        <div className="ba-stock-metrics">
          <div className="ba-stock-tile">
            <span className="ba-stock-tile__label">
              <span className="ba-stock-tile__dot ba-stock-bar__seg--available" />
              Sẵn sàng phục vụ
            </span>
            <span className="ba-stock-tile__value">{stock.available || 0}</span>
          </div>
          <div className="ba-stock-tile">
            <span className="ba-stock-tile__label">
              <span className="ba-stock-tile__dot ba-stock-bar__seg--rented" />
              Đang cho thuê
            </span>
            <span className="ba-stock-tile__value">{stock.rented || 0}</span>
          </div>
          <div className="ba-stock-tile">
            <span className="ba-stock-tile__label">
              <span className="ba-stock-tile__dot ba-stock-bar__seg--inspecting" />
              Phiếu chờ kiểm định
            </span>
            <span className="ba-stock-tile__value">{stock.inspecting || 0}</span>
          </div>
          <div className="ba-stock-tile">
            <span className="ba-stock-tile__label">
              <span className="ba-stock-tile__dot ba-stock-bar__seg--maintenance" />
              Bảo dưỡng / Hỏng
            </span>
            <span className="ba-stock-tile__value">{stock.maintenance || 0}</span>
          </div>
          <div className="ba-stock-tile">
            <span className="ba-stock-tile__label">
              <span className="ba-stock-tile__dot ba-stock-bar__seg--reserved" />
              Đang giữ chỗ
            </span>
            <span className="ba-stock-tile__value">{stock.reserved || 0}</span>
          </div>
        </div>
      </section>

      {/* Hiệu suất sản phẩm & Sản phẩm tồn chậm */}
      <article className="ba-card">
        <div className="ba-card__header">
          <div>
            <h2 className="ba-card__title">
              <Award size={18} aria-hidden="true" />
              <span>Hiệu Suất Sản Phẩm Chi Nhánh</span>
            </h2>
            <p className="ba-card__subtitle">
              Top 5 mẫu doanh thu cao nhất và các mẫu tồn chậm cần đẩy mạnh
            </p>
          </div>
        </div>

        {topProducts.length === 0 ? (
          <div className="ba-section-empty">
            <Shirt size={20} aria-hidden="true" />
            <span>Chưa có sản phẩm phát sinh doanh thu trong kỳ báo cáo này.</span>
          </div>
        ) : (
          <div className="ba-product-list">
            {topProducts.map((prod, idx) => {
              const thumbUrl = getOptimizedImageUrl(prod.imageUrl);
              return (
                <div key={prod.productId || idx} className="ba-product-row">
                  <div className="ba-product-row__left">
                    <span className="ba-product-row__rank">{idx + 1}</span>
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={prod.name}
                        className="ba-product-row__thumb"
                        loading="lazy"
                      />
                    ) : (
                      <div className="ba-product-row__thumb" aria-hidden="true">
                        <Shirt size={18} />
                      </div>
                    )}
                    <div className="ba-product-row__info">
                      <div className="ba-product-row__name" title={prod.name}>
                        {prod.name}
                      </div>
                      <div className="ba-product-row__meta">
                        {prod.category} • {prod.rentalCount || 0} thuê • {prod.salesCount || 0} bán
                      </div>
                    </div>
                  </div>
                  <div className="ba-product-row__right">
                    <div className="ba-product-row__rev">{formatVnd(prod.revenue)}</div>
                    <div className="ba-product-row__orders">{prod.orderCount || 0} đơn</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="ba-subblock">
          <h3 className="ba-subblock__title">Sản phẩm tồn sẵn sàng nhưng chưa có đơn trong kỳ</h3>
          {slowMovingProducts.length === 0 ? (
            <div className="ba-section-empty">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>Không ghi nhận mẫu tồn chậm tại quầy trong kỳ.</span>
            </div>
          ) : (
            <div className="ba-slow-chip-list">
              {slowMovingProducts.map((item, idx) => (
                <div key={item.productId || idx} className="ba-slow-item">
                  <span>
                    <strong>{item.name}</strong> ({item.category})
                  </span>
                  <span className="ba-badge ba-badge--neutral">
                    Còn {item.availableQty} chiếc
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

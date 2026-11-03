import { memo } from 'react';
import { Search, ShieldCheck, Edit3, Sparkles } from 'lucide-react';
import { fmtCurrency, formatDate } from '../utils/pricingHelpers';

/**
 * Bảng hiển thị danh sách trang phục kèm bảng giá và tiền cọc
 * Tối ưu hóa UI/UX:
 * - Skeleton loading chống CLS (Cumulative Layout Shift)
 * - Vector icon thay thế hoàn toàn emoji
 * - Tabular numbers căn chỉnh số tiền không bị nhảy layout
 * - Trạng thái rỗng (Empty state) trực quan có nút xóa bộ lọc
 * - Memoized component chống lãng phí re-render
 */
function PricingTable({
  items,
  loading,
  onOpenEdit,
  onResetFilters,
  hasActiveFilters,
}) {
  return (
    <div className="admin-card-table-wrapper pricing-table-card">
      <div className="tailadmin-table-container">
        <table className="tailadmin-table pricing-table" aria-label="Bảng giá thuê và tiền cọc trang phục">
          <thead className="pricing-table-head">
            <tr>
              <th scope="col" className="pricing-th th-product">
                MẪU TRANG PHỤC
              </th>
              <th scope="col" className="pricing-th th-category">
                DANH MỤC
              </th>
              <th scope="col" className="pricing-th th-rental">
                GIÁ THUÊ / NGÀY
              </th>
              <th scope="col" className="pricing-th th-deposit">
                TIỀN CỌC
              </th>
              <th scope="col" className="pricing-th th-sale">
                GIÁ BÁN / GIÁ TRỊ
              </th>
              <th scope="col" className="pricing-th th-action">
                THAO TÁC
              </th>
            </tr>
          </thead>
          <tbody>
            {/* 1. Trạng thái tải dữ liệu: Skeleton Shimmer Rows */}
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="pricing-skeleton-tr" aria-hidden="true">
                  <td className="pricing-td td-product">
                    <div className="pricing-skeleton-product">
                      <div className="pricing-skeleton-avatar shimmer" />
                      <div className="pricing-skeleton-lines">
                        <div className="pricing-skeleton-line short shimmer" />
                        <div className="pricing-skeleton-line medium shimmer" />
                        <div className="pricing-skeleton-line tiny shimmer" />
                      </div>
                    </div>
                  </td>
                  <td className="pricing-td">
                    <div className="pricing-skeleton-pill shimmer" />
                  </td>
                  <td className="pricing-td">
                    <div className="pricing-skeleton-line medium shimmer" />
                    <div className="pricing-skeleton-line tiny shimmer" />
                  </td>
                  <td className="pricing-td">
                    <div className="pricing-skeleton-line medium shimmer" />
                    <div className="pricing-skeleton-line tiny shimmer" />
                  </td>
                  <td className="pricing-td">
                    <div className="pricing-skeleton-line medium shimmer" />
                  </td>
                  <td className="pricing-td td-action">
                    <div className="pricing-skeleton-btn shimmer" />
                  </td>
                </tr>
              ))
            ) : (
              items.map((it) => (
                <tr key={it.id} className="pricing-tr">
                  {/* Product Name & Code */}
                  <td className="pricing-td td-product">
                    <div className="pricing-product-info">
                      {it.image ? (
                        <img
                          src={it.image}
                          alt={it.name}
                          loading="lazy"
                          className="pricing-product-thumb"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="pricing-product-avatar-fallback"
                        style={{ display: it.image ? 'none' : 'flex' }}
                        aria-hidden="true"
                      >
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <div className="pricing-product-code-row">
                          <span className="pricing-product-code">{it.code}</span>
                          {it.variantsCount > 0 ? (
                            <span className="pricing-variants-badge">
                              {it.variantsCount} kích cỡ/màu
                            </span>
                          ) : null}
                        </div>
                        <div className="pricing-product-name">{it.name}</div>
                        <div className="pricing-product-updated">
                          Cập nhật: {formatDate(it.updatedAt)}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category Badge */}
                  <td className="pricing-td">
                    <span className="pricing-category-tag">{it.category}</span>
                  </td>

                  {/* Rental Price Per Day */}
                  <td className="pricing-td">
                    <div className="pricing-cell-rental">
                      {fmtCurrency(it.rentalPricePerDay)}
                    </div>
                    {it.salePrice > 0 && it.rentalPricePerDay > 0 ? (
                      <div className="pricing-rental-ratio">
                        ≈ {Math.round((it.rentalPricePerDay / it.salePrice) * 100)}% giá trị
                      </div>
                    ) : null}
                  </td>

                  {/* Deposit Amount */}
                  <td className="pricing-td">
                    <div className="pricing-deposit-amount-row">
                      <ShieldCheck size={15} color="#059669" aria-hidden="true" />
                      <span className="pricing-cell-deposit">
                        {fmtCurrency(it.deposit)}
                      </span>
                    </div>
                    {it.salePrice > 0 && it.deposit > 0 ? (
                      <div className="pricing-deposit-ratio">
                        ≈ {Math.round((it.deposit / it.salePrice) * 100)}% giá trị
                      </div>
                    ) : null}
                  </td>

                  {/* Sale / Appraisal Price */}
                  <td className="pricing-td">
                    <span className="pricing-cell-sale">
                      {fmtCurrency(it.salePrice)}
                    </span>
                  </td>

                  {/* Action Button */}
                  <td className="pricing-td td-action">
                    <button
                      type="button"
                      className="pricing-edit-btn"
                      onClick={() => onOpenEdit(it)}
                      aria-label={`Sửa bảng giá và tiền cọc cho ${it.name}`}
                    >
                      <Edit3 size={13.5} className="pricing-edit-icon" aria-hidden="true" />
                      <span>Sửa giá & cọc</span>
                    </button>
                  </td>
                </tr>
              ))
            )}

            {/* Empty State */}
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan="6" className="pricing-empty-cell">
                  <div className="pricing-empty-container">
                    <div className="pricing-empty-icon-wrap" aria-hidden="true">
                      <Search size={24} />
                    </div>
                    <h4 className="pricing-empty-title">
                      Không tìm thấy trang phục phù hợp
                    </h4>
                    <p className="pricing-empty-desc">
                      Vui lòng thử lại với từ khóa khác hoặc chọn danh mục "Tất cả danh mục".
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={onResetFilters}
                        className="pricing-empty-reset-btn"
                      >
                        Xóa bộ lọc tìm kiếm
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(PricingTable);

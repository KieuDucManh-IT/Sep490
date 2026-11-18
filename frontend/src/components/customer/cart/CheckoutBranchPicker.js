import React, { useRef, useState } from 'react';
import productService from '../../../services/productService';
import { variantStock } from '../../../services/cart/productSelection';
import { useCartStore } from '../../../stores/useCartStore';
import { Link } from 'react-router-dom';
import { pendingCheckout, acknowledgeCheckoutHistory, uncertainMessage } from '../../../services/cart/checkoutFlow';

/** Branch changes always require explicit customer selection; never repair a variant silently. */
export default function CheckoutBranchPicker({ items, disabled = false }) {
  const [selection, setSelection] = useState(null);
  const [error, setError] = useState('');
  const request = useRef(0);
  const [, refresh] = useState(0);
  const open = async (item) => {
    const token = ++request.current;
    setError(''); setSelection({ item, branches: null });
    try {
      const response = await productService.getProductById(item.productId);
      const product = response?.data;
      if (!product?.variants?.some(v => String(v._id) === String(item.variantId))) throw new Error('Biến thể không còn khả dụng. Vui lòng chọn lại sản phẩm từ trang chi tiết.');
      const branches = (product.branches || []).filter(branch => (variantStock(branch, item.variantId) ?? 0) >= item.quantity);
      if (token === request.current) setSelection({ item, branches });
    } catch (e) { if (token === request.current) { setSelection(null); setError(e.message); } }
  };
  return <section className="cart-branch-picker" aria-label="Chi nhánh nhận đơn">
    {pendingCheckout(items) && <div role="alert">
      <p>{uncertainMessage}</p>
      <Link to="/rental-orders" target="_blank" rel="noopener noreferrer">Mở lịch sử đơn hàng</Link>
      <button type="button" disabled={disabled} onClick={() => {
        acknowledgeCheckoutHistory(items); refresh(value => value + 1);
      }}>Tôi đã kiểm tra lịch sử và chưa có đơn, cho phép đặt lại</button>
    </div>}
    {items.map(item => <div key={item.cartItemId}>
      <span>{item.name} ({item.size} / {item.color}): {item.selectedBranch?.name || 'Chưa chọn chi nhánh'}</span>
      <button type="button" disabled={disabled} onClick={() => open(item)}>Chọn / đổi chi nhánh</button>
    </div>)}
    {selection && <div>
      <label>Chi nhánh cho {selection.item.name}
        <select value="" disabled={disabled || !selection.branches} onChange={e => {
          const branch = selection.branches.find(b => String(b.locationId) === e.target.value);
          if (branch) { useCartStore.getState().updateItemBranch(selection.item.cartItemId, { locationId: String(branch.locationId), name: branch.name, address: branch.address }); setSelection(null); }
        }}>
          <option value="">{selection.branches ? 'Chọn chi nhánh' : 'Đang tải chi nhánh...'}</option>
          {(selection.branches || []).map(b => <option value={String(b.locationId)} key={String(b.locationId)}>{b.name} — còn {variantStock(b, selection.item.variantId)}</option>)}
        </select>
      </label>
      {selection.branches?.length === 0 && <p>Không có chi nhánh đủ số lượng cho biến thể này.</p>}
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

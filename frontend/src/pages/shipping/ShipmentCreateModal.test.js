import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import ShipmentCreateModal from './ShipmentCreateModal';
import * as shippingApi from '../../services/shippingApi';

jest.mock('../../services/shippingApi', () => ({
  calculateShippingFeeApi: jest.fn(),
  createOutboundShipmentApi: jest.fn(),
  getGHNNewProvincesApi: jest.fn(),
  getGHNNewWardsApi: jest.fn(),
}));

describe('ShipmentCreateModal', () => {
  const sampleOrder = {
    _id: 'order-1',
    orderCode: 'SO-20261128-TEST',
    orderStatus: 'processing',
    paymentStatus: 'paid',
    totalAmount: 1000000,
    paidAmount: 1000000,
    shippingAddress: {
      receiverName: 'Nguyen Hang',
      phone: '0378654625',
      street: 'Dia chi cu',
      city: 'Hà Nội',
      ward: 'Phường Cầu Giấy',
    },
    locationId: {
      shopId: {
        name: 'Vestora FPT',
        address: 'Khu CNC Hòa Lạc, Hà Nội',
        phone: '0386789999',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    shippingApi.getGHNNewWardsApi.mockResolvedValue({
      data: [{ _id: '100101', name: 'Phường Cầu Giấy' }],
    });
  });

  it('không ghi đè mất dữ liệu người dùng đã gõ khi danh sách Tỉnh/Thành tải xong muộn và tự xóa errorMsg khi chỉnh sửa', async () => {
    let resolveProvinces;
    shippingApi.getGHNNewProvincesApi.mockImplementation(
      () => new Promise((resolve) => { resolveProvinces = resolve; })
    );

    render(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    const addressInput = screen.getByPlaceholderText('VD: Số 24, Ngõ 105 Đường Cầu Giấy');
    fireEvent.change(addressInput, { target: { value: 'Số 12 Xuân Thủy mới' } });
    expect(addressInput.value).toBe('Số 12 Xuân Thủy mới');

    await act(async () => {
      resolveProvinces({
        data: [
          { _id: '1000001', name: 'Thành phố Hồ Chí Minh' },
          { _id: '1000000', name: 'Thành phố Hà Nội' },
        ],
      });
    });

    await waitFor(() => {
      expect(shippingApi.getGHNNewWardsApi).toHaveBeenCalledWith('1000000');
    });

    // Dữ liệu vừa gõ phải còn nguyên (không bị reset bởi useEffect chạy lại theo provinces)
    expect(addressInput.value).toBe('Số 12 Xuân Thủy mới');

    // Gây lỗi validate rồi sửa số điện thoại -> errorMsg phải tự biến mất
    const phoneInput = screen.getByLabelText(/Số điện thoại nhận hàng/i);
    fireEvent.change(phoneInput, { target: { value: '0123456789' } });
    fireEvent.submit(screen.getByRole('form', { name: /Tạo vận đơn GHN/i }));

    expect(await screen.findByText(/Số điện thoại không hợp lệ/i)).toBeTruthy();

    fireEvent.change(phoneInput, { target: { value: '0912345678' } });
    expect(screen.queryByText(/Số điện thoại không hợp lệ/i)).toBeNull();
  });

  it('reset khối lượng/kích thước/ghi chú về mặc định khi mở lại modal không có initialShipment', async () => {
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [{ _id: '1000000', name: 'Thành phố Hà Nội' }],
    });

    const { rerender } = render(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        initialShipment={{ weight: 1200, length: 45, width: 35, height: 25, note: 'Ghi chú retry' }}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByLabelText(/Khối lượng \(gram\)/i).value).toBe('1200');

    rerender(
      <ShipmentCreateModal
        show={false}
        order={sampleOrder}
        initialShipment={null}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    rerender(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        initialShipment={null}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    const weightInput = screen.getByLabelText(/Khối lượng \(gram\)/i);
    await waitFor(() => {
      expect(weightInput.value).toBe('500');
    });
    expect(await screen.findByText('Phường Cầu Giấy')).toBeTruthy();

    // Chặn khối lượng <= 0 ngay trên form tạo vận đơn
    fireEvent.change(weightInput, { target: { value: '0' } });
    fireEvent.submit(screen.getByRole('form', { name: /Tạo vận đơn GHN/i }));
    expect(await screen.findByText(/Khối lượng kiện hàng phải lớn hơn 0/i)).toBeTruthy();
    expect(shippingApi.createOutboundShipmentApi).not.toHaveBeenCalled();
  });

  it('ép COD về 0 khi mở retry đơn đã thanh toán đủ (paid) dù initialShipment từng có COD > 0', async () => {
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [{ _id: '1000000', name: 'Thành phố Hà Nội' }],
    });
    shippingApi.createOutboundShipmentApi.mockResolvedValue({
      success: true,
      data: { trackingCode: 'GHN-OK-0' },
    });

    const onClose = jest.fn();
    render(
      <ShipmentCreateModal
        show
        order={{ ...sampleOrder, paymentStatus: 'paid', totalAmount: 2000000, paidAmount: 2000000 }}
        initialShipment={{ codAmount: 2000000, weight: 500, length: 30, width: 20, height: 10 }}
        orderType="sale"
        onClose={onClose}
        onSuccess={jest.fn()}
      />
    );

    const wardEl = await screen.findByText('Phường Cầu Giấy');
    expect(wardEl).toBeTruthy();

    const codInput = screen.getByLabelText(/Tiền thu hộ COD/i);
    expect(codInput.value).toBe('0');

    fireEvent.submit(screen.getByRole('form', { name: /Tạo vận đơn GHN/i }));

    await waitFor(() => {
      expect(shippingApi.createOutboundShipmentApi).toHaveBeenCalledWith(
        expect.objectContaining({ customCodAmount: 0 })
      );
    });
  });

  it('không tự ép đơn TP.HCM thành Hà Nội và hiển thị cảnh báo ngoài phạm vi Hà Nội', async () => {
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [{ _id: '1000000', name: 'Thành phố Hà Nội' }],
    });

    render(
      <ShipmentCreateModal
        show
        order={{
          ...sampleOrder,
          shippingAddress: {
            receiverName: 'Khách HCM',
            phone: '0912345678',
            street: '15 Lê Duẩn',
            city: 'Thành phố Hồ Chí Minh',
            ward: 'Phường Bến Nghé',
            provinceId: 1000001,
            wardCode: '200101',
            isNewAddress: true,
          },
        }}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(await screen.findByText(/ngoài khu vực Hà Nội/i)).toBeTruthy();
    expect(shippingApi.getGHNNewWardsApi).not.toHaveBeenCalled();
  });

  it('chặn async race khi đổi đơn nhanh và reset phân cấp khi mở lại modal cho đơn khác', async () => {
    let resolveFirstWards;
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [
        { _id: '1000000', name: 'Thành phố Hà Nội' },
        { _id: '1000001', name: 'Thành phố Hồ Chí Minh' },
      ],
    });
    shippingApi.getGHNNewWardsApi
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirstWards = resolve; }))
      .mockResolvedValueOnce({ data: [{ _id: '100202', name: 'Phường Dịch Vọng' }] });

    const { rerender } = render(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    // Đóng rồi mở sang đơn thứ 2 trong lúc request phường của đơn đầu chưa resolve
    await waitFor(() => {
      expect(shippingApi.getGHNNewWardsApi).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ShipmentCreateModal
        show={false}
        order={sampleOrder}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    rerender(
      <ShipmentCreateModal
        show
        order={{
          ...sampleOrder,
          _id: 'order-2',
          shippingAddress: {
            receiverName: 'Khách Mới',
            phone: '0912345678',
            street: '10 Đường Láng',
            city: 'Hà Nội',
            ward: 'Phường Dịch Vọng',
          },
        }}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(await screen.findByText('Phường Dịch Vọng')).toBeTruthy();

    // Resolve muộn response lần đầu -> không được ghi đè mất Phường Dịch Vọng của đơn 2
    await act(async () => {
      resolveFirstWards?.({ data: [{ _id: '100101', name: 'Phường Cầu Giấy' }] });
    });

    expect(screen.getByText('Phường Dịch Vọng')).toBeTruthy();
    expect(screen.queryByText('Phường Cầu Giấy')).toBeNull();
  });

  it('xóa feeResult khi đổi kích thước, validate kích thước khi tính phí, và chấp nhận số bàn 024...', async () => {
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [{ _id: '1000000', name: 'Thành phố Hà Nội' }],
    });
    shippingApi.calculateShippingFeeApi.mockResolvedValue({
      success: true,
      data: { total_fee: 35000 },
    });
    shippingApi.createOutboundShipmentApi.mockResolvedValue({
      success: true,
      data: { trackingCode: 'GHN-LANDLINE-1' },
    });

    const onSuccess = jest.fn();
    const onClose = jest.fn();
    render(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        orderType="sale"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(await screen.findByText('Phường Cầu Giấy')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra cước phí/i }));
    expect(await screen.findByText(/35\.000 VND/i)).toBeTruthy();

    // Đổi chiều dài -> xóa feeResult cũ
    const lengthInput = screen.getByLabelText(/Chiều dài \(cm\)/i);
    fireEvent.change(lengthInput, { target: { value: '40' } });
    expect(screen.queryByText(/35\.000 VND/i)).toBeNull();

    // Nhập chiều dài 0 rồi bấm Kiểm tra cước phí -> báo lỗi trước khi gọi API
    fireEvent.change(lengthInput, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra cước phí/i }));
    expect(await screen.findByText(/Kích thước kiện hàng/i)).toBeTruthy();
    expect(shippingApi.calculateShippingFeeApi).toHaveBeenCalledTimes(1);

    // Phục hồi chiều dài và dùng SĐT bàn 0243888999 -> submit thành công
    fireEvent.change(lengthInput, { target: { value: '30' } });
    const phoneInput = screen.getByLabelText(/Số điện thoại nhận hàng/i);
    fireEvent.change(phoneInput, { target: { value: '0243888999' } });

    fireEvent.submit(screen.getByRole('form', { name: /Tạo vận đơn GHN/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(shippingApi.createOutboundShipmentApi).toHaveBeenCalledWith(
      expect.objectContaining({ toPhone: '0243888999' })
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('nút "Thử tải lại" gọi lại API tải Phường/Xã khi tải danh mục phường bị lỗi', async () => {
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [{ _id: '1000000', name: 'Thành phố Hà Nội' }],
    });
    shippingApi.getGHNNewWardsApi
      .mockRejectedValueOnce(new Error('Lỗi tải phường GHN'))
      .mockResolvedValueOnce({ data: [{ _id: '100101', name: 'Phường Cầu Giấy' }] });

    render(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(await screen.findByText(/Lỗi tải phường GHN/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Thử tải lại/i }));

    expect(await screen.findByText('Phường Cầu Giấy')).toBeTruthy();
    expect(shippingApi.getGHNNewWardsApi).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Lỗi tải phường GHN/i)).toBeNull();
  });

  it('chặn double submit đồng bộ bằng submittingRef khi nhấn gửi hai lần liên tiếp', async () => {
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [{ _id: '1000000', name: 'Thành phố Hà Nội' }],
    });
    let resolveSubmit;
    shippingApi.createOutboundShipmentApi.mockImplementation(
      () => new Promise((resolve) => { resolveSubmit = resolve; })
    );

    render(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(await screen.findByText('Phường Cầu Giấy')).toBeTruthy();

    const form = screen.getByRole('form', { name: /Tạo vận đơn GHN/i });
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(shippingApi.createOutboundShipmentApi).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveSubmit?.({ success: true, data: { trackingCode: 'GHN-ONCE' } });
    });
  });

  it('chỉ kích hoạt cooldown 5s khi 504/GHN_TIMEOUT, không khóa nút khi lỗi 400, và gán id trực tiếp lên combobox', async () => {
    shippingApi.getGHNNewProvincesApi.mockResolvedValue({
      data: [{ _id: '1000000', name: 'Thành phố Hà Nội' }],
    });
    const err400 = new Error('Sai địa chỉ');
    err400.status = 400;
    const err504 = new Error('Timeout GHN');
    err504.status = 504;
    err504.code = 'GHN_TIMEOUT';

    shippingApi.createOutboundShipmentApi
      .mockRejectedValueOnce(err400)
      .mockRejectedValueOnce(err504);

    const { unmount } = render(
      <ShipmentCreateModal
        show
        order={sampleOrder}
        orderType="sale"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    expect(await screen.findByText('Phường Cầu Giấy')).toBeTruthy();
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes[0].id).toBe('shipToProvince');
    expect(comboboxes[1].id).toBe('shipToWard');

    const form = screen.getByRole('form', { name: /Tạo vận đơn GHN/i });
    fireEvent.submit(form);
    expect(await screen.findByText(/Sai địa chỉ/i)).toBeTruthy();
    expect(screen.queryByText(/Vui lòng đợi/i)).toBeNull();

    fireEvent.submit(form);
    expect(await screen.findByText(/Vui lòng đợi \(\d+s\)/i)).toBeTruthy();
    unmount();
  });
});


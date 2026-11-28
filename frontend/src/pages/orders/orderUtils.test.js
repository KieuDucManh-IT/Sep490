import { resolveOrderDisplayStatus } from './orderUtils';

describe('resolveOrderDisplayStatus', () => {
  it('không đánh dấu "Đã hủy" khi đơn mua đang processing chỉ vì vận đơn outbound GHN bị hủy', () => {
    const order = {
      orderStatus: 'processing',
      shipments: [
        { _id: 's1', shipmentType: 'outbound', shipmentStatus: 'cancelled' },
      ],
    };

    expect(resolveOrderDisplayStatus(order, 'sale', true)).toEqual({
      text: 'Đang chuẩn bị hàng',
      chipClass: 'processing',
    });
    expect(resolveOrderDisplayStatus(order, 'sale', false)).toEqual({
      text: 'Đang Chuẩn Bị',
      chipClass: 'processing',
    });
  });

  it('không đánh dấu "Đã hủy" khi đơn thuê đang confirmed và toàn bộ vận đơn outbound bị hủy', () => {
    const order = {
      rentalStatus: 'confirmed',
      shipments: [
        { _id: 's1', shipmentType: 'outbound', shipmentStatus: 'cancelled' },
      ],
    };

    expect(resolveOrderDisplayStatus(order, 'rental', true)).toEqual({
      text: 'Chờ giao hàng',
      chipClass: 'confirmed',
    });
  });

  it('vẫn hiển thị "Đã hủy" khi chính đơn hàng có trạng thái cancelled', () => {
    const cancelledSale = {
      orderStatus: 'cancelled',
      shipments: [],
    };

    expect(resolveOrderDisplayStatus(cancelledSale, 'sale', true)).toEqual({
      text: 'Đã hủy',
      chipClass: 'cancelled',
    });
  });
});


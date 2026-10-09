import express from 'express';

const router = express.Router();

// Mock initial data for VESTORA API
const MOCK_PRODUCTS = [
  {
    id: 'VESTORA-DR-089',
    name: 'Đầm Dạ Hội Haute Couture Rose Gold',
    category: 'Đầm Dạ Hội',
    retailValue: '25.000.000 đ',
    rental3DaysPrice: 850000,
    resalePrice: 12500000,
    escrowDeposit: 2000000,
    sizeStock: { S: 2, M: 4, L: 3, XL: 1 },
    shopName: 'MÂY FASHION HAUTE ATELIER'
  },
  {
    id: 'VESTORA-SU-102',
    name: 'Bộ Vest Nam Tailored Smoking Tuxedo',
    category: 'Vest Nam',
    retailValue: '18.000.000 đ',
    rental3DaysPrice: 650000,
    resalePrice: 8800000,
    escrowDeposit: 1500000,
    sizeStock: { S: 1, M: 2, L: 2, XL: 1 },
    shopName: 'LUMIÈRE BOUTIQUE PRIVÉE'
  }
];

// System Health Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'VESTORA Haute Couture & Rental Luxury Backend Service',
    timestamp: new Date().toISOString(),
    escrowProvider: 'PayOS Escrow API Active'
  });
});

// Products API
router.get('/products', (req, res) => {
  res.json({
    success: true,
    total: MOCK_PRODUCTS.length,
    data: MOCK_PRODUCTS
  });
});

// PayOS Escrow Payment Intent Mock API
router.post('/escrow/create-intent', (req, res) => {
  const { productId, durationDays } = req.body;
  res.json({
    success: true,
    transactionId: `PAYOS-ESCROW-${Date.now()}`,
    status: 'PENDING_DEPOSIT',
    depositAmount: 2000000,
    rentalFee: 850000,
    qrCodeUrl: 'https://pay.payos.vn/web/v2/vestora-escrow-mock-qr'
  });
});

export default router;

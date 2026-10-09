// Order & PayOS Escrow Controller Domain
export const createEscrowIntent = async (req, res) => {
  res.json({
    success: true,
    transactionId: `PAYOS-ESCROW-${Date.now()}`,
    escrowStatus: 'HOLDING',
    depositAmount: 2000000,
    message: 'Tạo lệnh giữ cọc PayOS Escrow thành công'
  });
};

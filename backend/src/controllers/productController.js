// Product Controller Domain
export const getProducts = async (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'VESTORA-DR-089',
        name: 'Đầm Dạ Hội Haute Couture Rose Gold',
        category: 'Đầm Dạ Hội',
        rental3DaysPrice: 850000,
        resalePrice: 12500000,
        escrowDeposit: 2000000,
        shopName: 'MÂY FASHION HAUTE ATELIER'
      }
    ]
  });
};

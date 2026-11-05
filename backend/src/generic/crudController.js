const handleError = (error, res, next) => {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error.code === 11000) {
    const duplicate = Object.entries(error.keyValue || {})[0];
    const labels = { productCode: 'Mã sản phẩm', sku: 'SKU', supplierCode: 'Mã nhà cung cấp', code: 'Mã dữ liệu' };
    const message = duplicate
      ? `${labels[duplicate[0]] || duplicate[0]} "${duplicate[1]}" đã tồn tại.`
      : 'Giá trị bị trùng đã tồn tại.';
    return res.status(409).json({ success: false, message });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  return next(error);
};

export const createCrudController = (service) => ({
  list: async (req, res, next) => {
    try { res.json({ success: true, data: await service.list() }); }
    catch (error) { handleError(error, res, next); }
  },
  create: async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await service.create(req.body) }); }
    catch (error) { handleError(error, res, next); }
  },
  update: async (req, res, next) => {
    try {
      const data = await service.update(req.params.id, req.body);
      if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu.' });
      res.json({ success: true, data });
    } catch (error) { handleError(error, res, next); }
  },
  remove: async (req, res, next) => {
    try {
      const data = await service.remove(req.params.id);
      if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu.' });
      res.json({ success: true, data });
    } catch (error) { handleError(error, res, next); }
  },
});

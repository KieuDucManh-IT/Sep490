export const createCrudService = (Model, validate, populateFields = []) => ({
  list: () => {
    let query = Model.find().sort({ createdAt: -1 });
    for (const field of populateFields) query = query.populate(field);
    return query;
  },
  create: async (payload) => {
    validate(payload);
    return Model.create(payload);
  },
  update: async (id, payload) => {
    const document = await Model.findById(id);
    if (!document) return null;
    const merged = { ...document.toObject(), ...payload };
    validate(merged);
    Object.assign(document, payload);
    return document.save();
  },
  remove: (id) => Model.findByIdAndDelete(id),
});
